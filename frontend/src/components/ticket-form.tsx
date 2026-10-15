"use client";

import { useState, type FormEvent } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { ClassificationResult } from "@/components/classification-result";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, createTicket } from "@/lib/api";
import type { NewTicketInput, Ticket } from "@/lib/types";
import { validateTicketForm, type FormErrors } from "@/lib/validation";

type Status = "idle" | "submitting" | "success" | "error";

const EMPTY: NewTicketInput = { title: "", description: "", customerEmail: "" };

export function TicketForm({ onCreated }: { onCreated?: (ticket: Ticket) => void }) {
  const [values, setValues] = useState<NewTicketInput>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [created, setCreated] = useState<Ticket | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const submitting = status === "submitting";

  function update(field: keyof NewTicketInput, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const { data, errors: clientErrors } = validateTicketForm(values);
    if (!data) {
      setErrors(clientErrors);
      setStatus("idle");
      return;
    }

    setErrors({});
    setErrorMessage("");
    setCreated(null);
    setStatus("submitting");
    try {
      const ticket = await createTicket(data);
      setCreated(ticket);
      setStatus("success");
      setValues(EMPTY);
      toast.success("Ticket submitted");
      onCreated?.(ticket);
    } catch (err) {
      setStatus("error");
      if (err instanceof ApiError && err.details.length > 0) {
        const fieldErrors: FormErrors = {};
        for (const d of err.details) {
          if (d.field in EMPTY && !fieldErrors[d.field as keyof NewTicketInput]) {
            fieldErrors[d.field as keyof NewTicketInput] = d.message;
          }
        }
        setErrors(fieldErrors);
      }
      setErrorMessage(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Card className="border-slate-200/80 bg-card shadow-sm dark:border-border">
      <CardHeader>
        <CardTitle className="text-lg">New ticket</CardTitle>
        <CardDescription>Describe the problem. Our AI will categorise it and suggest a priority.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-label="Submit a support ticket">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              className="bg-card"
              id="title"
              name="title"
              value={values.title}
              onChange={(e) => update("title", e.target.value)}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "title-error" : undefined}
              disabled={submitting}
              maxLength={200}
              placeholder="e.g. Can't log in to my account"
            />
            {errors.title && <FieldError id="title-error" message={errors.title} />}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="customerEmail">Customer email</Label>
            <Input
              className="bg-card"
              id="customerEmail"
              name="customerEmail"
              type="email"
              autoComplete="email"
              value={values.customerEmail}
              onChange={(e) => update("customerEmail", e.target.value)}
              aria-invalid={!!errors.customerEmail}
              aria-describedby={errors.customerEmail ? "customerEmail-error" : undefined}
              disabled={submitting}
              placeholder="you@example.com"
            />
            {errors.customerEmail && <FieldError id="customerEmail-error" message={errors.customerEmail} />}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              className="min-h-40 resize-y bg-card"
              id="description"
              name="description"
              rows={9}
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? "description-error" : undefined}
              disabled={submitting}
              maxLength={5000}
              placeholder="What happened? What did you expect?"
            />
            {errors.description && <FieldError id="description-error" message={errors.description} />}
          </div>

          <Button type="submit" className="w-full bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400" size="lg" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2Icon className="animate-spin" aria-hidden="true" />
                Classifying…
              </>
            ) : (
              "Submit ticket"
            )}
          </Button>
        </form>

        <div className="mt-4 space-y-3" aria-live="polite">
          {status === "error" && (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Could not submit ticket</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          {status === "success" && created && <ClassificationResult ticket={created} />}
        </div>
      </CardContent>
    </Card>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
