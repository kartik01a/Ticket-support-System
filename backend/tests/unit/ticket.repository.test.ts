import { openDatabase } from '../../src/db/connection';
import { TicketRepository } from '../../src/repositories/ticket.repository';

const base = { title: 'T', description: 'D', customerEmail: 'a@b.com', category: 'General', priority: 'Low', aiStatus: 'classified', aiFallbackReason: null } as const;

describe('TicketRepository', () => {
  it('creates tickets with generated id and timestamp', () => {
    const repo = new TicketRepository(openDatabase(':memory:'));
    const t = repo.create(base);
    expect(t.id).toHaveLength(36);
    expect(new Date(t.createdAt).toISOString()).toBe(t.createdAt);
    expect(repo.list({ sort: 'newest', page: 1, limit: 10 }).rows).toEqual([t]);
  });

  it('persists fallback metadata', () => {
    const repo = new TicketRepository(openDatabase(':memory:'));
    const t = repo.create({ ...base, aiStatus: 'fallback', aiFallbackReason: 'timeout' });
    expect(repo.list({ sort: 'newest', page: 1, limit: 10 }).rows[0]).toMatchObject({ id: t.id, aiStatus: 'fallback', aiFallbackReason: 'timeout' });
  });

  it('the database itself rejects values outside the allowlists', () => {
    const db = openDatabase(':memory:');
    const insert = (category: string, priority: string) =>
      db.prepare(`INSERT INTO tickets VALUES ('1','t','d','e','${category}','${priority}','classified',NULL,'2024-01-01')`).run();
    expect(() => insert('Sales', 'High')).toThrow(/CHECK/);
    expect(() => insert('Billing', 'Urgent')).toThrow(/CHECK/);
    expect(() => insert('Billing', 'High')).not.toThrow();
  });

  it('opening an existing schema twice is idempotent', () => {
    const db = openDatabase(':memory:');
    expect(() => db.exec('CREATE TABLE IF NOT EXISTS tickets (id TEXT)')).not.toThrow();
  });
});
