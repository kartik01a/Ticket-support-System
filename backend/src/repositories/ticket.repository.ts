import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { ListFilters, NewTicket, SortOption, Ticket } from '../types/ticket';

interface TicketRow {
  id: string;
  title: string;
  description: string;
  customer_email: string;
  category: Ticket['category'];
  priority: Ticket['priority'];
  ai_status: Ticket['aiStatus'];
  ai_fallback_reason: Ticket['aiFallbackReason'];
  created_at: string;
}

const PRIORITY_RANK = `CASE priority WHEN 'High' THEN 3 WHEN 'Medium' THEN 2 ELSE 1 END`;

/** Whitelisted ORDER BY clauses: user input only selects a key, it is never interpolated. */
const ORDER_BY: Record<SortOption, string> = {
  newest: 'created_at DESC, rowid DESC',
  oldest: 'created_at ASC, rowid ASC',
  priority: `${PRIORITY_RANK} DESC, created_at DESC, rowid DESC`,
};

const toTicket = (row: TicketRow): Ticket => ({
  id: row.id,
  title: row.title,
  description: row.description,
  customerEmail: row.customer_email,
  category: row.category,
  priority: row.priority,
  aiStatus: row.ai_status,
  aiFallbackReason: row.ai_fallback_reason,
  createdAt: row.created_at,
});

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export class TicketRepository {
  constructor(private readonly db: Database.Database) {}

  create(data: NewTicket): Ticket {
    const ticket: Ticket = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
    this.db
      .prepare(
        `INSERT INTO tickets (id, title, description, customer_email, category, priority, ai_status, ai_fallback_reason, created_at)
         VALUES (@id, @title, @description, @customerEmail, @category, @priority, @aiStatus, @aiFallbackReason, @createdAt)`,
      )
      .run(ticket);
    return ticket;
  }

  list(filters: ListFilters): { rows: Ticket[]; total: number } {
    const where: string[] = [];
    const params: Record<string, string | number> = {};

    if (filters.category) {
      where.push('category = @category');
      params.category = filters.category;
    }
    if (filters.priority) {
      where.push('priority = @priority');
      params.priority = filters.priority;
    }
    if (filters.q) {
      where.push(
        `(title LIKE @q ESCAPE '\\' OR description LIKE @q ESCAPE '\\' OR customer_email LIKE @q ESCAPE '\\')`,
      );
      params.q = `%${escapeLike(filters.q)}%`;
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { total } = this.db.prepare(`SELECT COUNT(*) AS total FROM tickets ${whereSql}`).get(params) as {
      total: number;
    };
    const rows = this.db
      .prepare(`SELECT * FROM tickets ${whereSql} ORDER BY ${ORDER_BY[filters.sort]} LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit: filters.limit, offset: (filters.page - 1) * filters.limit }) as TicketRow[];

    return { rows: rows.map(toTicket), total };
  }

  /** Returns true if a ticket was deleted, false if the id did not exist. */
  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM tickets WHERE id = ?').run(id).changes > 0;
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM tickets').get() as { n: number }).n;
  }
}
