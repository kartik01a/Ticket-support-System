import { buildTicketsQueryString, createTicket, deleteTicket, isApiError, listTickets } from "@/lib/api";
import { makeList, makeTicket } from "./fixtures";

const jsonResponse = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response;

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

const query = { q: "", category: "", priority: "", sort: "newest", page: 1, limit: 10 } as const;

describe("buildTicketsQueryString", () => {
  it("omits empty filters", () => {
    expect(buildTicketsQueryString(query)).toBe("sort=newest&page=1&limit=10");
  });
  it("includes and trims set filters", () => {
    const qs = new URLSearchParams(buildTicketsQueryString({ ...query, q: "  refund ", category: "Billing", priority: "High", page: 2 }));
    expect(Object.fromEntries(qs)).toEqual({ q: "refund", category: "Billing", priority: "High", sort: "newest", page: "2", limit: "10" });
  });
});

describe("createTicket", () => {
  it("POSTs JSON and returns the ticket", async () => {
    const ticket = makeTicket();
    fetchMock.mockResolvedValue(jsonResponse({ data: ticket }, 201));
    const input = { title: "t", description: "d", customerEmail: "a@b.com" };

    await expect(createTicket(input)).resolves.toEqual(ticket);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/tickets");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual(input);
  });

  it("throws an ApiError with code and field details on 400", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: "VALIDATION_ERROR", message: "Request validation failed", details: [{ field: "title", message: "Title is required" }] } }, 400),
    );
    await expect(createTicket({ title: "", description: "d", customerEmail: "a@b.com" })).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      code: "VALIDATION_ERROR",
      details: [{ field: "title", message: "Title is required" }],
    });
  });

  it("turns network failures into a friendly ApiError", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const error = await createTicket({ title: "t", description: "d", customerEmail: "a@b.com" }).catch((e) => e);
    expect(isApiError(error)).toBe(true);
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.message).toMatch(/backend is running/);
  });

  it("handles non-JSON error bodies (e.g. a proxy 502)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new SyntaxError("bad json"); } } as unknown as Response);
    await expect(createTicket({ title: "t", description: "d", customerEmail: "a@b.com" })).rejects.toMatchObject({
      status: 502,
      code: "UNKNOWN_ERROR",
      message: "Something went wrong. Please try again.",
    });
  });
});

describe("listTickets", () => {
  it("GETs with the query string and returns the payload", async () => {
    const payload = makeList([makeTicket()]);
    fetchMock.mockResolvedValue(jsonResponse(payload));
    await expect(listTickets({ ...query, category: "Billing" })).resolves.toEqual(payload);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:4000/api/tickets?category=Billing&sort=newest&page=1&limit=10");
  });

  it("rethrows aborts untouched so callers can ignore them", async () => {
    fetchMock.mockRejectedValue(new DOMException("aborted", "AbortError"));
    await expect(listTickets(query)).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("deleteTicket", () => {
  it("sends DELETE and resolves on 204 with no body", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => { throw new SyntaxError("no body"); } } as unknown as Response);
    await expect(deleteTicket("abc-123")).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/tickets/abc-123");
    expect(init.method).toBe("DELETE");
  });

  it("throws an ApiError on 404", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: "TICKET_NOT_FOUND", message: "Ticket not found" } }, 404));
    await expect(deleteTicket("nope")).rejects.toMatchObject({ status: 404, code: "TICKET_NOT_FOUND" });
  });
});
