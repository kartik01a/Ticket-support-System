import { Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CategoryBadge, PriorityBadge } from "@/components/ticket-badges";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type { Ticket } from "@/lib/types";

interface TicketTableProps {
  tickets: Ticket[];
  onDelete: (ticket: Ticket) => void;
  deletingId?: string | null;
}

export function TicketTable({ tickets, onDelete, deletingId }: TicketTableProps) {
  return (
    <Table>
      <TableHeader className="bg-slate-50 dark:bg-muted/30">
        <TableRow>
          <TableHead>Ticket</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead className="text-right">Created</TableHead>
          <TableHead className="w-10">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="max-w-[22rem] whitespace-normal">
              <div className="truncate font-medium" title={t.title}>
                {t.title}
              </div>
              <div className="line-clamp-2 text-xs text-muted-foreground" title={t.description}>
                {t.description}
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{t.customerEmail}</div>
            </TableCell>
            <TableCell>
              <CategoryBadge category={t.category} />
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap items-center gap-1.5">
                <PriorityBadge priority={t.priority} />
                {t.aiStatus === "fallback" && (
                  <Badge variant="outline" title="The AI could not classify this ticket; defaults were applied">
                    default
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="text-right text-xs text-muted-foreground">
              <time dateTime={t.createdAt} title={formatDateTime(t.createdAt)}>
                {formatRelativeTime(t.createdAt)}
              </time>
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete ticket: ${t.title}`}
                title="Delete ticket"
                disabled={deletingId === t.id}
                onClick={() => onDelete(t)}
              >
                <Trash2Icon aria-hidden="true" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function TicketTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading tickets">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
