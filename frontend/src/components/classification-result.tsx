import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CategoryBadge, PriorityBadge } from "@/components/ticket-badges";
import type { FallbackReason, Ticket } from "@/lib/types";

const FALLBACK_TEXT: Record<FallbackReason, string> = {
  timeout: "the AI took too long to respond",
  ai_error: "the AI service returned an error",
  invalid_response: "the AI returned an unusable answer",
  ai_unavailable: "the AI service is not configured",
};

export function ClassificationResult({ ticket }: { ticket: Ticket }) {
  const fallback = ticket.aiStatus === "fallback";
  return (
    <div role="status" aria-live="polite" className="space-y-3 rounded-lg border bg-muted/40 p-4">
      <p className="text-sm font-medium">Ticket submitted. Here is how it was triaged:</p>
      <p className="truncate text-sm text-muted-foreground" title={ticket.title}>
        {ticket.title}
      </p>
      <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">Category</dt>
          <dd>
            <CategoryBadge category={ticket.category} />
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">Priority</dt>
          <dd>
            <PriorityBadge priority={ticket.priority} />
          </dd>
        </div>
      </dl>
      {fallback && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Default classification used</AlertTitle>
          <AlertDescription>
            Your ticket was saved, but {ticket.aiFallbackReason ? FALLBACK_TEXT[ticket.aiFallbackReason] : "the AI was unavailable"}, so it
            was filed as General / Medium for manual review.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
