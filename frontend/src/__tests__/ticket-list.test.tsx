import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TicketList } from "@/components/ticket-list";
import { toast } from "sonner";
import { ApiError, deleteTicket, listTickets } from "@/lib/api";
import { makeList, makeTicket } from "./fixtures";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  listTickets: jest.fn(),
  deleteTicket: jest.fn(),
}));

const mockList = listTickets as jest.MockedFunction<typeof listTickets>;
const mockDelete = deleteTicket as jest.MockedFunction<typeof deleteTicket>;
const lastQuery = () => mockList.mock.calls[mockList.mock.calls.length - 1][0];

beforeEach(() => {
  jest.resetAllMocks();
  mockList.mockResolvedValue(makeList([makeTicket()]));
});

describe("TicketList", () => {
  it("shows a loading skeleton, then the tickets", async () => {
    let resolve!: (v: ReturnType<typeof makeList>) => void;
    mockList.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<TicketList />);

    expect(screen.getByRole("status", { name: "Loading tickets" })).toBeInTheDocument();

    await act(async () => resolve(makeList([makeTicket({ title: "Login broken" }), makeTicket({ id: "2", title: "Refund request", category: "Billing", priority: "Low" })])));

    expect(await screen.findByText("Login broken")).toBeInTheDocument();
    expect(screen.getByText("Refund request")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading tickets" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Billing")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–2 of 2")).toBeInTheDocument();
  });

  it("requests the default query on mount", async () => {
    render(<TicketList />);
    await screen.findByText("Cannot log in");
    expect(mockList).toHaveBeenCalledWith({ q: "", category: "", priority: "", sort: "newest", page: 1, limit: 10 }, expect.anything());
  });

  it("shows an empty state when there are no tickets", async () => {
    mockList.mockResolvedValue(makeList([], { total: 0 }));
    render(<TicketList />);
    expect(await screen.findByText("No tickets yet")).toBeInTheDocument();
  });

  it("shows an error with a working retry button", async () => {
    const user = userEvent.setup();
    mockList.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "Could not reach the server."));
    render(<TicketList />);

    expect(await screen.findByText("Could not reach the server.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Cannot log in")).toBeInTheDocument();
    expect(screen.queryByText("Could not load tickets")).not.toBeInTheDocument();
  });

  it("filters by category and priority and resets to page 1", async () => {
    const user = userEvent.setup();
    mockList.mockResolvedValue(makeList([makeTicket()], { page: 1, total: 25, totalPages: 3 }));
    render(<TicketList />);
    await screen.findByText("Cannot log in");

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(lastQuery().page).toBe(2));

    await user.selectOptions(screen.getByLabelText("Category"), "Billing");
    await waitFor(() => expect(lastQuery()).toMatchObject({ category: "Billing", page: 1 }));

    await user.selectOptions(screen.getByLabelText("Priority"), "High");
    await waitFor(() => expect(lastQuery()).toMatchObject({ category: "Billing", priority: "High", page: 1 }));
  });

  it("changes the sort order", async () => {
    const user = userEvent.setup();
    render(<TicketList />);
    await screen.findByText("Cannot log in");

    await user.selectOptions(screen.getByLabelText("Sort by"), "priority");
    await waitFor(() => expect(lastQuery().sort).toBe("priority"));
  });

  it("debounces the search box", async () => {
    jest.useFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<TicketList />);
      await screen.findByText("Cannot log in");
      const callsBefore = mockList.mock.calls.length;

      await user.type(screen.getByLabelText("Search"), "refund");
      expect(mockList).toHaveBeenCalledTimes(callsBefore); // not yet

      await act(async () => {
        jest.advanceTimersByTime(350);
      });
      await waitFor(() => expect(lastQuery().q).toBe("refund"));
      expect(mockList).toHaveBeenCalledTimes(callsBefore + 1); // a single request, not one per keystroke
    } finally {
      jest.useRealTimers();
    }
  });

  it("shows a 'no matches' state and clears filters from it", async () => {
    const user = userEvent.setup();
    render(<TicketList />);
    await screen.findByText("Cannot log in");

    mockList.mockResolvedValue(makeList([], { total: 0 }));
    await user.selectOptions(screen.getByLabelText("Category"), "Billing");
    expect(await screen.findByText("No tickets match these filters")).toBeInTheDocument();

    mockList.mockResolvedValue(makeList([makeTicket()]));
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Cannot log in")).toBeInTheDocument();
    expect(lastQuery()).toMatchObject({ category: "", priority: "", q: "", page: 1 });
    expect(screen.getByLabelText("Category")).toHaveValue("");
  });

  it("paginates with Prev/Next", async () => {
    const user = userEvent.setup();
    mockList.mockResolvedValue(makeList([makeTicket()], { total: 25, totalPages: 3 }));
    render(<TicketList />);
    await screen.findByText("Showing 1–10 of 25");
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(lastQuery().page).toBe(2));
  });

  it("reloads when refreshKey changes (a ticket was created)", async () => {
    const { rerender } = render(<TicketList refreshKey={0} />);
    await screen.findByText("Cannot log in");
    const before = mockList.mock.calls.length;

    rerender(<TicketList refreshKey={1} />);
    await waitFor(() => expect(mockList.mock.calls.length).toBe(before + 1));
  });

  it("marks tickets that used the fallback classification", async () => {
    mockList.mockResolvedValue(makeList([makeTicket({ aiStatus: "fallback", aiFallbackReason: "timeout", category: "General", priority: "Medium" })]));
    render(<TicketList />);
    expect(await screen.findByText("default")).toBeInTheDocument();
  });

  describe("deleting a ticket", () => {
    const two = makeList([makeTicket({ id: "a", title: "First" }), makeTicket({ id: "b", title: "Second" })]);

    it("deletes the ticket with the trash button and reloads the list", async () => {
      const user = userEvent.setup();
      mockList.mockResolvedValueOnce(two).mockResolvedValue(makeList([makeTicket({ id: "b", title: "Second" })]));
      mockDelete.mockResolvedValue(undefined);
      render(<TicketList />);
      await screen.findByText("First");

      await user.click(screen.getByRole("button", { name: "Delete ticket: First" }));

      expect(mockDelete).toHaveBeenCalledWith("a");
      await waitFor(() => expect(screen.queryByText("First")).not.toBeInTheDocument());
      expect(screen.getByText("Second")).toBeInTheDocument();
      expect(toast.success).toHaveBeenCalledWith("Ticket deleted");
    });

    it("keeps the row and shows an error toast when deleting fails", async () => {
      const user = userEvent.setup();
      mockList.mockResolvedValue(two);
      mockDelete.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "Something went wrong"));
      render(<TicketList />);
      await screen.findByText("First");

      await user.click(screen.getByRole("button", { name: "Delete ticket: First" }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong"));
      expect(screen.getByText("First")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete ticket: First" })).toBeEnabled();
    });

    it("treats a 404 (already deleted) as success and refreshes", async () => {
      const user = userEvent.setup();
      mockList.mockResolvedValueOnce(two).mockResolvedValue(makeList([makeTicket({ id: "b", title: "Second" })]));
      mockDelete.mockRejectedValue(new ApiError(404, "TICKET_NOT_FOUND", "Ticket not found"));
      render(<TicketList />);
      await screen.findByText("First");

      await user.click(screen.getByRole("button", { name: "Delete ticket: First" }));

      await waitFor(() => expect(screen.queryByText("First")).not.toBeInTheDocument());
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("steps back a page when the last ticket on a later page is deleted", async () => {
      const user = userEvent.setup();
      mockList.mockImplementation(async (q) =>
        q.page === 2
          ? makeList([makeTicket({ id: "z", title: "Only on page two" })], { page: 2, total: 11, totalPages: 2 })
          : makeList([makeTicket({ id: "a", title: "On page one" })], { page: 1, total: 11, totalPages: 2 }),
      );
      mockDelete.mockResolvedValue(undefined);
      render(<TicketList />);
      await screen.findByText("On page one");
      await user.click(screen.getByRole("button", { name: "Next page" }));
      await screen.findByText("Only on page two");

      await user.click(screen.getByRole("button", { name: "Delete ticket: Only on page two" }));

      await waitFor(() => expect(lastQuery().page).toBe(1));
      expect(await screen.findByText("On page one")).toBeInTheDocument();
    });
  });
});
