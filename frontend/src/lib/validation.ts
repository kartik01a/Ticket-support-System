import { z } from "zod";
import type { NewTicketInput } from "./types";

/** Mirrors the backend rules so users get instant feedback. The server remains the source of truth. */
export const ticketFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be at most 200 characters"),
  description: z.string().trim().min(1, "Description is required").max(5000, "Description must be at most 5000 characters"),
  customerEmail: z.string().trim().max(254, "Email must be at most 254 characters").pipe(z.email("Enter a valid email address")),
});

export type FormErrors = Partial<Record<keyof NewTicketInput, string>>;

export function validateTicketForm(values: NewTicketInput): { data?: NewTicketInput; errors: FormErrors } {
  const result = ticketFormSchema.safeParse(values);
  if (result.success) return { data: result.data, errors: {} };
  const errors: FormErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof NewTicketInput;
    if (!errors[field]) errors[field] = issue.message;
  }
  return { errors };
}
