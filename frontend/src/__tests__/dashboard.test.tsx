import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dashboard } from "@/components/dashboard";
import { createTicket, listTickets } from "@/lib/api";
import { makeList, makeTicket } from "./fixtures";

jest.mock("sonner", () => ({ toast: { success: jest.fn() } }));
jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  createTicket: jest.fn(),
  listTickets: jest.fn(),
}));

const mockCreate = createTicket as jest.MockedFunction<typeof createTicket>;
const mockList = listTickets as jest.MockedFunction<typeof listTickets>;

it("refreshes the ticket list after a ticket is submitted", async () => {
  const user = userEvent.setup();
  const created = makeTicket({ id: "new", title: "Brand new ticket", category: "Billing", priority: "Low" });
  mockList.mockResolvedValueOnce(makeList([])).mockResolvedValue(makeList([created]));
  mockCreate.mockResolvedValue(created);
  render(<Dashboard />);

  expect(await screen.findByText("No tickets yet")).toBeInTheDocument();

  await user.type(screen.getByLabelText("Title"), "Brand new ticket");
  await user.type(screen.getByLabelText("Customer email"), "jane@example.com");
  await user.type(screen.getByLabelText("Description"), "Something");
  await user.click(screen.getByRole("button", { name: "Submit ticket" }));

  await waitFor(() => expect(screen.getByRole("table")).toHaveTextContent("Brand new ticket"));
  expect(screen.queryByText("No tickets yet")).not.toBeInTheDocument();
});
