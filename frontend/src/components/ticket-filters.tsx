"use client";

import { useEffect, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { CATEGORIES, PRIORITIES, type Category, type Priority, type SortOption, type TicketQuery } from "@/lib/types";

const SEARCH_DEBOUNCE_MS = 300;

interface Props {
  query: TicketQuery;
  onChange: (patch: Partial<TicketQuery>) => void;
  onClear: () => void;
}

/** The parent remounts this (via `key`) when filters are cleared, which resets the search box. */
export function TicketFilters({ query, onChange, onClear }: Props) {
  const [search, setSearch] = useState(query.q);

  // Debounce typing so we do not query on every keystroke.
  useEffect(() => {
    if (search === query.q) return;
    const timer = setTimeout(() => onChange({ q: search }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, query.q, onChange]);

  const hasFilters = query.q !== "" || query.category !== "" || query.priority !== "" || query.sort !== "newest";

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_9rem_9rem_11rem_auto]" role="search" aria-label="Filter tickets">
      <div className="space-y-1.5 sm:col-span-2 xl:col-span-1">
        <Label htmlFor="search">Search</Label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id="search"
            type="search"
            className="bg-card pl-8"
            placeholder="Title, description or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category">Category</Label>
        <NativeSelect id="category" value={query.category} onChange={(e) => onChange({ category: e.target.value as Category | "" })}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="priority">Priority</Label>
        <NativeSelect id="priority" value={query.priority} onChange={(e) => onChange({ priority: e.target.value as Priority | "" })}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sort">Sort by</Label>
        <NativeSelect id="sort" value={query.sort} onChange={(e) => onChange({ sort: e.target.value as SortOption })}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="priority">Priority (high → low)</option>
        </NativeSelect>
      </div>

      <div className="flex items-end">
        <Button type="button" variant="ghost" onClick={onClear} disabled={!hasFilters}>
          <XIcon aria-hidden="true" />
          Clear
        </Button>
      </div>
    </div>
  );
}
