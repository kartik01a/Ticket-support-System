import type { ListTicketsResponse, NewTicketInput, Ticket, TicketQuery } from "./types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export interface FieldError {
  field: string;
  message: string;
}

/** Error from the API or the network. `message` is always safe to show to users. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: FieldError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check that the backend is running and try again.");
  }

  if (response.status === 204) return undefined as T;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string; details?: FieldError[] } } | undefined)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "UNKNOWN_ERROR",
      error?.message ?? "Something went wrong. Please try again.",
      error?.details ?? [],
    );
  }
  return body as T;
}

export async function createTicket(input: NewTicketInput, init?: { signal?: AbortSignal }): Promise<Ticket> {
  const result = await request<{ data: Ticket }>("/api/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: init?.signal,
  });
  return result.data;
}

export function buildTicketsQueryString(query: TicketQuery): string {
  const params = new URLSearchParams();
  if (query.q.trim()) params.set("q", query.q.trim());
  if (query.category) params.set("category", query.category);
  if (query.priority) params.set("priority", query.priority);
  params.set("sort", query.sort);
  params.set("page", String(query.page));
  params.set("limit", String(query.limit));
  return params.toString();
}

export function listTickets(query: TicketQuery, init?: { signal?: AbortSignal }): Promise<ListTicketsResponse> {
  return request<ListTicketsResponse>(`/api/tickets?${buildTicketsQueryString(query)}`, { signal: init?.signal });
}

export async function deleteTicket(id: string): Promise<void> {
  await request<void>(`/api/tickets/${encodeURIComponent(id)}`, { method: "DELETE" });
}
