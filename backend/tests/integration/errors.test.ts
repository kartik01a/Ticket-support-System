import request from 'supertest';
import { createApp } from '../../src/app';
import { TicketService } from '../../src/services/ticket.service';
import { FakeClassifier } from '../helpers/fake-classifier';
import { buildTestApp, validTicket } from '../helpers/test-app';

describe('error handling & platform behaviour', () => {
  it('GET /health returns ok', async () => {
    const { app } = buildTestApp(FakeClassifier.returning({ category: 'General', priority: 'Low' }));
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns a consistent 404 for unknown routes', async () => {
    const { app } = buildTestApp(FakeClassifier.returning({ category: 'General', priority: 'Low' }));
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns a generic 500 and logs details server-side when something unexpected throws', async () => {
    const errors: unknown[] = [];
    const exploding = {
      listTickets: () => {
        throw new Error('db exploded: /secret/path/tickets.db');
      },
      createTicket: async () => undefined,
    } as unknown as TicketService;
    const app = createApp({ ticketService: exploding, logger: { warn: () => undefined, error: (m, meta) => void errors.push({ m, meta }) } });

    const res = await request(app).get('/api/tickets');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    expect(JSON.stringify(res.body)).not.toContain('secret');
    expect(errors).toHaveLength(1);
  });

  it('sets security headers and hides x-powered-by', async () => {
    const { app } = buildTestApp(FakeClassifier.returning({ category: 'General', priority: 'Low' }));
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rate limits ticket creation with 429 when enabled', async () => {
    const { app } = buildTestApp(FakeClassifier.returning({ category: 'General', priority: 'Low' }), { rateLimitPerMinute: 2 });
    expect((await request(app).post('/api/tickets').send(validTicket)).status).toBe(201);
    expect((await request(app).post('/api/tickets').send(validTicket)).status).toBe(201);
    const third = await request(app).post('/api/tickets').send(validTicket);
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('RATE_LIMITED');
  });
});
