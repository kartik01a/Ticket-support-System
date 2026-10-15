import type { Express } from 'express';
import { createApp } from '../../src/app';
import { openDatabase } from '../../src/db/connection';
import { TicketRepository } from '../../src/repositories/ticket.repository';
import type { TicketClassifier } from '../../src/services/ai/types';
import { TicketService } from '../../src/services/ticket.service';

export interface TestContext {
  app: Express;
  repository: TicketRepository;
  warnings: { message: string; meta?: Record<string, unknown> }[];
  errors: { message: string; meta?: Record<string, unknown> }[];
}

/** Real Express app + real repository on an in-memory SQLite DB; only the AI is faked. */
export function buildTestApp(classifier: TicketClassifier, options: { aiTimeoutMs?: number; rateLimitPerMinute?: number } = {}): TestContext {
  const db = openDatabase(':memory:');
  const repository = new TicketRepository(db);
  const warnings: TestContext['warnings'] = [];
  const errors: TestContext['errors'] = [];
  const logger = {
    warn: (message: string, meta?: Record<string, unknown>) => void warnings.push({ message, meta }),
    error: (message: string, meta?: Record<string, unknown>) => void errors.push({ message, meta }),
  };
  const ticketService = new TicketService({ repository, classifier, aiTimeoutMs: options.aiTimeoutMs ?? 1000, logger });
  const app = createApp({ ticketService, logger, rateLimitPerMinute: options.rateLimitPerMinute });
  return { app, repository, warnings, errors };
}

export const validTicket = {
  title: 'Cannot log in',
  description: 'I get a 500 error whenever I try to sign in.',
  customerEmail: 'jane@example.com',
};
