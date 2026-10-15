export const CATEGORIES = ['Technical', 'Billing', 'General'] as const;
export const PRIORITIES = ['Low', 'Medium', 'High'] as const;
export const AI_STATUSES = ['classified', 'fallback'] as const;
export const FALLBACK_REASONS = ['timeout', 'ai_error', 'invalid_response', 'ai_unavailable'] as const;

export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type AiStatus = (typeof AI_STATUSES)[number];
export type FallbackReason = (typeof FALLBACK_REASONS)[number];

export interface Ticket {
  id: string;
  title: string;
  description: string;
  customerEmail: string;
  category: Category;
  priority: Priority;
  aiStatus: AiStatus;
  aiFallbackReason: FallbackReason | null;
  createdAt: string;
}

export type NewTicket = Omit<Ticket, 'id' | 'createdAt'>;

export const SORT_OPTIONS = ['newest', 'oldest', 'priority'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export interface ListFilters {
  category?: Category;
  priority?: Priority;
  q?: string;
  sort: SortOption;
  page: number;
  limit: number;
}
