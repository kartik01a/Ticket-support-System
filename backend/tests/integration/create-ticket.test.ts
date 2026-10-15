import request from 'supertest';
import { FakeClassifier } from '../helpers/fake-classifier';
import { buildTestApp, validTicket } from '../helpers/test-app';

describe('POST /api/tickets', () => {
  describe('validation', () => {
    it('rejects a missing title with a clear validation error and creates nothing', async () => {
      const classifier = FakeClassifier.returning({ category: 'Technical', priority: 'High' });
      const { app, repository } = buildTestApp(classifier);

      const res = await request(app)
        .post('/api/tickets')
        .send({ description: validTicket.description, customerEmail: validTicket.customerEmail });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual([{ field: 'title', message: 'Title is required' }]);
      expect(repository.count()).toBe(0);
      expect(classifier.calls).toHaveLength(0);
    });

    it('rejects a blank (whitespace-only) title', async () => {
      const { app, repository } = buildTestApp(FakeClassifier.returning({ category: 'General', priority: 'Low' }));
      const res = await request(app).post('/api/tickets').send({ ...validTicket, title: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe('title');
      expect(repository.count()).toBe(0);
    });

    it('rejects an invalid customer email and does not create a ticket', async () => {
      const classifier = FakeClassifier.returning({ category: 'Technical', priority: 'High' });
      const { app, repository } = buildTestApp(classifier);

      const res = await request(app).post('/api/tickets').send({ ...validTicket, customerEmail: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual([
        { field: 'customerEmail', message: 'Customer email must be a valid email address' },
      ]);
      expect(repository.count()).toBe(0);
      expect(classifier.calls).toHaveLength(0);
    });

    it('reports every invalid field at once', async () => {
      const { app } = buildTestApp(FakeClassifier.returning({ category: 'General', priority: 'Low' }));
      const res = await request(app).post('/api/tickets').send({});
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual([
        'customerEmail',
        'description',
        'title',
      ]);
    });

    it('ignores client-supplied category/priority', async () => {
      const { app } = buildTestApp(FakeClassifier.returning({ category: 'Billing', priority: 'Low' }));
      const res = await request(app)
        .post('/api/tickets')
        .send({ ...validTicket, category: 'Technical', priority: 'High', id: 'attacker-id' });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ category: 'Billing', priority: 'Low' });
      expect(res.body.data.id).not.toBe('attacker-id');
    });

    it('rejects malformed JSON with 400 INVALID_JSON', async () => {
      const { app } = buildTestApp(FakeClassifier.returning({ category: 'General', priority: 'Low' }));
      const res = await request(app).post('/api/tickets').set('Content-Type', 'application/json').send('{"title": ');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_JSON');
    });

    it('rejects an oversized body with 413', async () => {
      const { app } = buildTestApp(FakeClassifier.returning({ category: 'General', priority: 'Low' }));
      const res = await request(app)
        .post('/api/tickets')
        .send({ ...validTicket, description: 'x'.repeat(20_000) });
      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('valid ticket', () => {
    it('classifies, saves and returns the ticket with the expected fields', async () => {
      const classifier = FakeClassifier.returning({ category: 'Technical', priority: 'High' });
      const { app, repository } = buildTestApp(classifier);

      const res = await request(app)
        .post('/api/tickets')
        .send({ ...validTicket, title: '  Cannot log in  ', customerEmail: 'Jane@Example.com' });

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        title: 'Cannot log in',
        description: validTicket.description,
        customerEmail: 'jane@example.com',
        category: 'Technical',
        priority: 'High',
        aiStatus: 'classified',
        aiFallbackReason: null,
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
      expect(classifier.calls).toEqual([{ title: 'Cannot log in', description: validTicket.description }]);

      const stored = repository.list({ sort: 'newest', page: 1, limit: 10 });
      expect(stored.total).toBe(1);
      expect(stored.rows[0]).toEqual(res.body.data);
    });
  });

  describe('AI failures use the documented fallback (General / Medium) and still save the ticket', () => {
    it('handles an AI timeout safely without crashing or leaking secrets', async () => {
      const secret = 'sk-test-SECRET-1234';
      process.env.OPENAI_API_KEY = secret;
      try {
        const { app, repository, warnings } = buildTestApp(FakeClassifier.hanging(), { aiTimeoutMs: 50 });

        const res = await request(app).post('/api/tickets').send(validTicket);

        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({
          category: 'General',
          priority: 'Medium',
          aiStatus: 'fallback',
          aiFallbackReason: 'timeout',
        });
        expect(repository.count()).toBe(1);
        const serialized = JSON.stringify(res.body) + JSON.stringify(warnings);
        expect(serialized).not.toContain(secret);
        expect(serialized).not.toMatch(/stack|at .*\.ts/i);

        // the API is still healthy afterwards
        expect((await request(app).get('/health')).status).toBe(200);
      } finally {
        delete process.env.OPENAI_API_KEY;
      }
    });

    it('handles the AI throwing an unexpected error', async () => {
      const { app } = buildTestApp(FakeClassifier.failing(new Error('boom: upstream 500 with sk-leak')));
      const res = await request(app).post('/api/tickets').send(validTicket);
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ aiStatus: 'fallback', aiFallbackReason: 'ai_error' });
      expect(JSON.stringify(res.body)).not.toContain('sk-leak');
    });

    it.each([
      ['an invalid priority value', { category: 'Technical', priority: 'Critical' }],
      ['a wrong-case priority', { category: 'Technical', priority: 'high' }],
      ['an invalid category', { category: 'Sales', priority: 'Low' }],
      ['a missing field', { category: 'Technical' }],
      ['a non-object response', 'Technical/High'],
      ['null', null],
    ])('rejects %s from the AI and falls back', async (_label, aiOutput) => {
      const { app, repository } = buildTestApp(FakeClassifier.returning(aiOutput));

      const res = await request(app).post('/api/tickets').send(validTicket);

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        category: 'General',
        priority: 'Medium',
        aiStatus: 'fallback',
        aiFallbackReason: 'invalid_response',
      });
      expect(repository.count()).toBe(1);
    });
  });
});
