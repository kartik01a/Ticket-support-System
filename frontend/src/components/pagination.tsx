import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Pagination as PaginationData } from "@/lib/types";

interface Props {
  pagination: PaginationData;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function Pagination({ pagination, onPageChange, disabled }: Props) {
  const { page, limit, total, totalPages } = pagination;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total === 0 ? "No tickets" : `Showing ${from}–${to} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={disabled || page <= 1} aria-label="Previous page">
          <ChevronLeftIcon aria-hidden="true" />
          Prev
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={disabled || page >= totalPages} aria-label="Next page">
          Next
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
