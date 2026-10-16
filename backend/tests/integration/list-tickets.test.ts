import request from 'supertest';
import { fakeReturning } from '../helpers/fake-classifier';
import { buildTestApp } from '../helpers/test-app';

const seed = [
  { title: 'Login broken', description: 'Server error on sign in', customerEmail: 'a@x.com', category: 'Technical', priority: 'High' },
  { title: 'Refund request', description: 'Charged twice this month', customerEmail: 'b@x.com', category: 'Billing', priority: 'Medium' },
  { title: 'Feature idea', description: 'Dark mode please', customerEmail: 'c@x.com', category: 'General', priority: 'Low' },
  { title: 'Invoice 100% wrong', description: 'Totals are off', customerEmail: 'd@x.com', category: 'Billing', priority: 'High' },
] as const;

async function seeded() {
  const ctx = buildTestApp(fakeReturning({ category: 'General', priority: 'Low' }));
  for (const t of seed) {
    ctx.repository.create({ ...t, aiStatus: 'classified', aiFallbackReason: null });
    await new Promise((r) => setTimeout(r, 2)); // distinct created_at values
  }
  return ctx;
}

describe('GET /api/tickets', () => {
  it('returns the expected structure and the stored records, newest first', async () => {
    const { app } = await seeded();

    const res = await request(app).get('/api/tickets');

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 1, limit: 10, total: 4, totalPages: 1 });
    expect(res.body.data).toHaveLength(4);
    expect(res.body.data.map((t: { title: string }) => t.title)).toEqual([
      'Invoice 100% wrong',
      'Feature idea',
      'Refund request',
      'Login broken',
    ]);
    expect(res.body.data[0]).toEqual({
      id: expect.any(String),
      title: 'Invoice 100% wrong',
      description: 'Totals are off',
      customerEmail: 'd@x.com',
      category: 'Billing',
      priority: 'High',
      aiStatus: 'classified',
      aiFallbackReason: null,
      createdAt: expect.any(String),
    });
  });

  it('returns an empty list with valid pagination when there are no tickets', async () => {
    const { app } = buildTestApp(fakeReturning({ category: 'General', priority: 'Low' }));
    const res = await request(app).get('/api/tickets');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
  });

  it('lists a ticket created through POST', async () => {
    const { app } = buildTestApp(fakeReturning({ category: 'Billing', priority: 'Low' }));
    await request(app).post('/api/tickets').send({ title: 'T', description: 'D', customerEmail: 'z@x.com' });
    const res = await request(app).get('/api/tickets');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ title: 'T', category: 'Billing', priority: 'Low' });
  });

  describe('filters', () => {
    it('filters by category', async () => {
      const { app } = await seeded();
      const res = await request(app).get('/api/tickets?category=Billing');
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.data.every((t: { category: string }) => t.category === 'Billing')).toBe(true);
    });

    it('filters by priority', async () => {
      const { app } = await seeded();
      const res = await request(app).get('/api/tickets?priority=High');
      expect(res.body.data.map((t: { title: string }) => t.title).sort()).toEqual(['Invoice 100% wrong', 'Login broken']);
    });

    it('combines category and priority', async () => {
      const { app } = await seeded();
      const res = await request(app).get('/api/tickets?category=Billing&priority=High');
      expect(res.body.data.map((t: { title: string }) => t.title)).toEqual(['Invoice 100% wrong']);
    });

    it('searches title, description and email (case-insensitive)', async () => {
      const { app } = await seeded();
      const byTitle = await request(app).get('/api/tickets?q=LOGIN');
      expect(byTitle.body.data.map((t: { title: string }) => t.title)).toEqual(['Login broken']);
      const byDescription = await request(app).get('/api/tickets?q=twice');
      expect(byDescription.body.data.map((t: { title: string }) => t.title)).toEqual(['Refund request']);
      const byEmail = await request(app).get('/api/tickets?q=c@x');
      expect(byEmail.body.data.map((t: { title: string }) => t.title)).toEqual(['Feature idea']);
    });

    it('treats % and _ in the search as literal characters', async () => {
      const { app } = await seeded();
      const res = await request(app).get('/api/tickets?q=' + encodeURIComponent('100%'));
      expect(res.body.data.map((t: { title: string }) => t.title)).toEqual(['Invoice 100% wrong']);
      const none = await request(app).get('/api/tickets?q=' + encodeURIComponent('%'));
      expect(none.body.pagination.total).toBe(1);
    });

    it('is safe against SQL injection in the search term', async () => {
      const { app } = await seeded();
      const res = await request(app).get('/api/tickets?q=' + encodeURIComponent("'; DROP TABLE tickets; --"));
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect((await request(app).get('/api/tickets')).body.pagination.total).toBe(4);
    });

    it('ignores blank filter values (as sent by an empty form)', async () => {
      const { app } = await seeded();
      const res = await request(app).get('/api/tickets?category=&priority=&q=');
      expect(res.body.pagination.total).toBe(4);
    });
  });

  describe('sorting', () => {
    it('sorts oldest first', async () => {
      const { app } = await seeded();
      const res = await request(app).get('/api/tickets?sort=oldest');
      expect(res.body.data[0].title).toBe('Login broken');
    });

    it('sorts by priority High to Low, newest first within a priority', async () => {
      const { app } = await seeded();
      const res = await request(app).get('/api/tickets?sort=priority');
      expect(res.body.data.map((t: { title: string }) => t.title)).toEqual([
        'Invoice 100% wrong',
        'Login broken',
        'Refund request',
        'Feature idea',
      ]);
    });
  });

  describe('pagination', () => {
    it('pages through results with correct metadata', async () => {
      const { app } = await seeded();
      const p1 = await request(app).get('/api/tickets?limit=3&page=1');
      const p2 = await request(app).get('/api/tickets?limit=3&page=2');
      expect(p1.body.data).toHaveLength(3);
      expect(p1.body.pagination).toEqual({ page: 1, limit: 3, total: 4, totalPages: 2 });
      expect(p2.body.data).toHaveLength(1);
      const ids = [...p1.body.data, ...p2.body.data].map((t: { id: string }) => t.id);
      expect(new Set(ids).size).toBe(4);
    });

    it('returns an empty page beyond the last page', async () => {
      const { app } = await seeded();
      const res = await request(app).get('/api/tickets?page=9');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.total).toBe(4);
    });
  });

  describe('query validation', () => {
    it.each([
      ['limit=500', 'limit'],
      ['limit=0', 'limit'],
      ['page=0', 'page'],
      ['page=abc', 'page'],
      ['category=Foo', 'category'],
      ['priority=Urgent', 'priority'],
      ['sort=random', 'sort'],
      ['q=' + 'x'.repeat(101), 'q'],
    ])('rejects %s with 400', async (qs, field) => {
      const { app } = await seeded();
      const res = await request(app).get(`/api/tickets?${qs}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain(field);
    });
  });
});
