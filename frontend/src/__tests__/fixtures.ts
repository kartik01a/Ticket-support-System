import type { ListTicketsResponse, Ticket } from "@/lib/types";

export const makeTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: "1",
  title: "Cannot log in",
  description: "Server error on sign in",
  customerEmail: "jane@example.com",
  category: "Technical",
  priority: "High",
  aiStatus: "classified",
  aiFallbackReason: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const makeList = (tickets: Ticket[], pagination: Partial<ListTicketsResponse["pagination"]> = {}): ListTicketsResponse => ({
  data: tickets,
  pagination: { page: 1, limit: 10, total: tickets.length, totalPages: 1, ...pagination },
});
