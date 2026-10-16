import { createAppError } from '../errors/app-error';
import type { TicketRepository } from '../repositories/ticket.repository';
import type { ListFilters, Ticket } from '../types/ticket';
import { validateClassification } from './ai/classification';
import { isClassifierError, type TicketClassifier } from './ai/types';
import { isTimeoutError, withTimeout } from '../utils/with-timeout';

/** Documented fallback used whenever the AI cannot give a valid answer. */
export const FALLBACK_CLASSIFICATION = { category: 'General', priority: 'Medium' } as const;

export interface Logger {
  warn(message: string, meta?: Record<string, unknown>): void;
}

export interface TicketServiceDeps {
  repository: TicketRepository;
  classifier: TicketClassifier;
  aiTimeoutMs: number;
  logger?: Logger;
}

export interface CreateTicketInput {
  title: string;
  description: string;
  customerEmail: string;
}

export interface TicketService {
  /** Classifies (with safe fallback) and persists a ticket. Never throws because of the AI. */
  createTicket(input: CreateTicketInput): Promise<Ticket>;
  deleteTicket(id: string): void;
  listTickets(filters: ListFilters): {
    data: Ticket[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  };
}

export function createTicketService({ repository, classifier, aiTimeoutMs, logger }: TicketServiceDeps): TicketService {
  return {
    async createTicket(input) {
      try {
        const raw = await withTimeout(
          (signal) => classifier.classify({ title: input.title, description: input.description }, signal),
          aiTimeoutMs,
        );
        // Defence in depth: re-validate even if the classifier already did.
        const { category, priority } = validateClassification(raw);
        return repository.create({ ...input, category, priority, aiStatus: 'classified', aiFallbackReason: null });
      } catch (err) {
        const reason =
          isTimeoutError(err) ? 'timeout' : isClassifierError(err) ? err.reason : 'ai_error';
        // Log only the reason and message; never the raw error object, which could carry request details.
        logger?.warn('AI classification failed, using fallback', {
          reason,
          message: err instanceof Error ? err.message : 'unknown error',
        });
        return repository.create({
          ...input,
          ...FALLBACK_CLASSIFICATION,
          aiStatus: 'fallback',
          aiFallbackReason: reason,
        });
      }
    },

    deleteTicket(id) {
      if (!repository.delete(id)) {
        throw createAppError(404, 'TICKET_NOT_FOUND', 'Ticket not found');
      }
    },

    listTickets(filters) {
      const { rows, total } = repository.list(filters);
      return {
        data: rows,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / filters.limit)),
        },
      };
    },
  };
}
