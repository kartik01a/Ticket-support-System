"use client";

import { useState } from "react";
import { TicketForm } from "@/components/ticket-form";
import { TicketList } from "@/components/ticket-list";

export function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-6">
        <TicketForm onCreated={() => setRefreshKey((k) => k + 1)} />
      </div>
      <TicketList refreshKey={refreshKey} />
    </div>
  );
}
