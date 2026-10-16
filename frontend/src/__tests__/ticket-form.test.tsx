import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TicketForm } from "@/components/ticket-form";
import { createApiError, createTicket } from "@/lib/api";
import { makeTicket } from "./fixtures";

jest.mock("sonner", () => ({ toast: { success: jest.fn() } }));
jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  createTicket: jest.fn(),
}));

const mockCreate = createTicket as jest.MockedFunction<typeof createTicket>;

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Title"), "Cannot log in");
  await user.type(screen.getByLabelText("Customer email"), "jane@example.com");
  await user.type(screen.getByLabelText("Description"), "I get a 500 error");
}

beforeEach(() => jest.resetAllMocks());

describe("TicketForm", () => {
  it("shows validation errors and does not call the API when fields are invalid", async () => {
    const user = userEvent.setup();
    render(<TicketForm />);

    await user.type(screen.getByLabelText("Customer email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Submit ticket" }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(screen.getByText("Description is required")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("shows a loading state and disables the form while the request is in flight", async () => {
    const user = userEvent.setup();
    let resolve!: (t: ReturnType<typeof makeTicket>) => void;
    mockCreate.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<TicketForm />);

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Submit ticket" }));

    const button = await screen.findByRole("button", { name: /classifying/i });
    expect(button).toBeDisabled();
    expect(screen.getByLabelText("Title")).toBeDisabled();

    resolve(makeTicket());
    expect(await screen.findByRole("button", { name: "Submit ticket" })).toBeEnabled();
  });

  it("sends the trimmed values and shows the AI classification on success", async () => {
    const user = userEvent.setup();
    const onCreated = jest.fn();
    const ticket = makeTicket({ category: "Billing", priority: "Medium" });
    mockCreate.mockResolvedValue(ticket);
    render(<TicketForm onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Title"), "  Refund  ");
    await user.type(screen.getByLabelText("Customer email"), "jane@example.com");
    await user.type(screen.getByLabelText("Description"), "Charged twice");
    await user.click(screen.getByRole("button", { name: "Submit ticket" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Billing");
    expect(status).toHaveTextContent("Medium");
    expect(screen.queryByText("Default classification used")).not.toBeInTheDocument();
    expect(mockCreate).toHaveBeenCalledWith({ title: "Refund", description: "Charged twice", customerEmail: "jane@example.com" });
    expect(onCreated).toHaveBeenCalledWith(ticket);
    expect(screen.getByLabelText("Title")).toHaveValue(""); // form reset
  });

  it("tells the user when the default (fallback) classification was used", async () => {
    const user = userEvent.setup();
    mockCreate.mockResolvedValue(makeTicket({ category: "General", priority: "Medium", aiStatus: "fallback", aiFallbackReason: "timeout" }));
    render(<TicketForm />);

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Submit ticket" }));

    expect(await screen.findByText("Default classification used")).toBeInTheDocument();
    expect(screen.getByText(/the AI took too long to respond/)).toBeInTheDocument();
  });

  it("shows an error alert (and keeps the user's input) when the request fails", async () => {
    const user = userEvent.setup();
    mockCreate.mockRejectedValue(createApiError(0, "NETWORK_ERROR", "Could not reach the server."));
    render(<TicketForm />);

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Submit ticket" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not submit ticket");
    expect(alert).toHaveTextContent("Could not reach the server.");
    expect(screen.getByLabelText("Title")).toHaveValue("Cannot log in");
    expect(screen.getByRole("button", { name: "Submit ticket" })).toBeEnabled();
  });

  it("maps server-side field errors onto the matching inputs", async () => {
    const user = userEvent.setup();
    mockCreate.mockRejectedValue(
      createApiError(400, "VALIDATION_ERROR", "Request validation failed", [{ field: "customerEmail", message: "Customer email must be a valid email address" }]),
    );
    render(<TicketForm />);

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Submit ticket" }));

    await waitFor(() => expect(screen.getByLabelText("Customer email")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText("Customer email must be a valid email address")).toBeInTheDocument();
  });

  it("falls back to a generic message for unexpected errors", async () => {
    const user = userEvent.setup();
    mockCreate.mockRejectedValue(new Error("boom"));
    render(<TicketForm />);

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Submit ticket" }));

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
  });

  it("clears a field's error as soon as the user edits it", async () => {
    const user = userEvent.setup();
    render(<TicketForm />);
    await user.click(screen.getByRole("button", { name: "Submit ticket" }));
    expect(await screen.findByText("Title is required")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Title"), "x");
    expect(screen.queryByText("Title is required")).not.toBeInTheDocument();
  });
});
