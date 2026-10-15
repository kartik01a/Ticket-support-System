import { z } from 'zod';
import { CATEGORIES, PRIORITIES, SORT_OPTIONS } from '../types/ticket';

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

/** Unknown keys (e.g. category, priority) are stripped: clients cannot set AI fields. */
export const createTicketBody = z.object({
  title: requiredText('Title', 200),
  description: requiredText('Description', 5000),
  customerEmail: z
    .string({ error: 'Customer email is required' })
    .trim()
    .toLowerCase()
    .max(254, 'Customer email must be at most 254 characters')
    .pipe(z.email('Customer email must be a valid email address')),
});

const blankToUndefined = (v: unknown) => (v === '' ? undefined : v);

export const listTicketsQuery = z.object({
  category: z.preprocess(blankToUndefined, z.enum(CATEGORIES).optional()),
  priority: z.preprocess(blankToUndefined, z.enum(PRIORITIES).optional()),
  q: z.preprocess(blankToUndefined, z.string().trim().max(100, 'Search must be at most 100 characters').optional()),
  sort: z.preprocess(blankToUndefined, z.enum(SORT_OPTIONS).default('newest')),
  page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).default(1)),
  limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(50).default(10)),
});

export const ticketIdParams = z.object({ id: z.uuid({ error: 'Ticket id must be a valid UUID' }) });

export type CreateTicketBody = z.infer<typeof createTicketBody>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuery>;
