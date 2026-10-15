"use client";

import { useCallback, useEffect, useState } from "react";
import { InboxIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/pagination";
import { TicketFilters } from "@/components/ticket-filters";
import { TicketTable, TicketTableSkeleton } from "@/components/ticket-table";
import { ApiError, deleteTicket, listTickets } from "@/lib/api";
import type { ListTicketsResponse, Ticket, TicketQuery } from "@/lib/types";

const DEFAULT_QUERY: TicketQuery = { q: "", category: "", priority: "", sort: "newest", page: 1, limit: 10 };

interface FetchState {
  /** Identifies the request this state belongs to; a mismatch with the current key means "loading". */
  key: string;
  data?: ListTicketsResponse;
  error?: string;
}

/** `refreshKey` changes whenever a ticket is created so the list reloads. */
export function TicketList({ refreshKey = 0 }: { refreshKey?: number }) {
  const [query, setQuery] = useState<TicketQuery>(DEFAULT_QUERY);
  const [retry, setRetry] = useState(0);
  const [clearCount, setClearCount] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [state, setState] = useState<FetchState>({ key: "" });

  const requestKey = JSON.stringify([query, refreshKey, retry]);

  useEffect(() => {
    const controller = new AbortController();
    listTickets(query, { signal: controller.signal })
      .then((data) => setState({ key: requestKey, data }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return; // superseded by a newer request
        setState({ key: requestKey, error: err instanceof ApiError ? err.message : "Could not load tickets." });
      });
    return () => controller.abort(); // discards stale responses
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestKey encodes query
  }, [requestKey]);

  // Any filter change goes back to page 1; only page changes keep the current page.
  const handleChange = useCallback((patch: Partial<TicketQuery>) => {
    setQuery((q) => ({ ...q, page: 1, ...patch }));
  }, []);
  const handleClear = useCallback(() => {
    setQuery(DEFAULT_QUERY);
    setClearCount((n) => n + 1);
  }, []);

  async function handleDelete(ticket: Ticket) {
    setDeletingId(ticket.id);
    try {
      await deleteTicket(ticket.id);
      toast.success("Ticket deleted");
    } catch (err) {
      // A 404 means it is already gone (e.g. deleted in another tab): refresh instead of reporting a failure.
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.error(err instanceof ApiError ? err.message : "Could not delete the ticket.");
        setDeletingId(null);
        return;
      }
    }
    setDeletingId(null);
    // Deleting the last row of a later page would leave an empty page, so step back one page.
    const onlyRowOnPage = (state.data?.data.length ?? 0) <= 1;
    if (onlyRowOnPage && query.page > 1) setQuery((q) => ({ ...q, page: q.page - 1 }));
    else setRetry((n) => n + 1);
  }

  const loading = state.key !== requestKey;
  const { data } = state;
  const showError = !loading && state.error;
  const hasFilters = query.q !== "" || query.category !== "" || query.priority !== "";

  return (
    <Card className="border-slate-200/80 bg-card shadow-sm dark:border-border">
      <CardHeader>
        <CardTitle className="text-lg">Tickets</CardTitle>
        <CardDescription>Search, filter and sort every submitted ticket.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TicketFilters key={clearCount} query={query} onChange={handleChange} onClear={handleClear} />

        {showError ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Could not load tickets</AlertTitle>
            <AlertDescription>
              <p>{state.error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setRetry((n) => n + 1)}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : !data ? (
          <TicketTableSkeleton />
        ) : data.data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <InboxIcon className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">{hasFilters ? "No tickets match these filters" : "No tickets yet"}</p>
            <p className="text-sm text-muted-foreground">
              {hasFilters ? "Try a different search or clear the filters." : "Submit your first ticket using the form."}
            </p>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={handleClear}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
            <TicketTable tickets={data.data} onDelete={handleDelete} deletingId={deletingId} />
          </div>
        )}

        {data && data.data.length > 0 && !showError && (
          <Pagination pagination={data.pagination} onPageChange={(page) => handleChange({ page })} disabled={loading} />
        )}
      </CardContent>
    </Card>
  );
}
