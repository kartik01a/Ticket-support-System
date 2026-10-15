import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { FakeClassifier } from '../helpers/fake-classifier';
import { buildTestApp, validTicket } from '../helpers/test-app';

const make = () => buildTestApp(FakeClassifier.returning({ category: 'Technical', priority: 'High' }));

describe('DELETE /api/tickets/:id', () => {
  it('deletes an existing ticket and returns 204 with no body', async () => {
    const { app, repository } = make();
    const created = await request(app).post('/api/tickets').send(validTicket);
    const other = await request(app).post('/api/tickets').send({ ...validTicket, title: 'Keep me' });

    const res = await request(app).delete(`/api/tickets/${created.body.data.id}`);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(repository.count()).toBe(1);
    const list = await request(app).get('/api/tickets');
    expect(list.body.data.map((t: { id: string }) => t.id)).toEqual([other.body.data.id]);
  });

  it('returns 404 TICKET_NOT_FOUND for an unknown id', async () => {
    const { app } = make();
    const res = await request(app).delete(`/api/tickets/${randomUUID()}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TICKET_NOT_FOUND');
  });

  it('returns 404 when deleting the same ticket twice', async () => {
    const { app } = make();
    const created = await request(app).post('/api/tickets').send(validTicket);
    await request(app).delete(`/api/tickets/${created.body.data.id}`).expect(204);
    await request(app).delete(`/api/tickets/${created.body.data.id}`).expect(404);
  });

  it('rejects a malformed id with 400 and deletes nothing', async () => {
    const { app, repository } = make();
    await request(app).post('/api/tickets').send(validTicket);
    const res = await request(app).delete("/api/tickets/1'%20OR%20'1'='1");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('id');
    expect(repository.count()).toBe(1);
  });
});
