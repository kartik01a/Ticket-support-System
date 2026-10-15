export const CATEGORIES = ["Technical", "Billing", "General"] as const;
export const PRIORITIES = ["Low", "Medium", "High"] as const;
export const SORT_OPTIONS = ["newest", "oldest", "priority"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type SortOption = (typeof SORT_OPTIONS)[number];
export type FallbackReason = "timeout" | "ai_error" | "invalid_response" | "ai_unavailable";

export interface Ticket {
  id: string;
  title: string;
  description: string;
  customerEmail: string;
  category: Category;
  priority: Priority;
  aiStatus: "classified" | "fallback";
  aiFallbackReason: FallbackReason | null;
  createdAt: string;
}

export interface NewTicketInput {
  title: string;
  description: string;
  customerEmail: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListTicketsResponse {
  data: Ticket[];
  pagination: Pagination;
}

export interface TicketQuery {
  q: string;
  category: Category | "";
  priority: Priority | "";
  sort: SortOption;
  page: number;
  limit: number;
}
