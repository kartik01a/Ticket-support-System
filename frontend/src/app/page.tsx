import { LifeBuoyIcon } from "lucide-react";
import { Dashboard } from "@/components/dashboard";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-gradient-to-b from-indigo-50 via-slate-50 to-slate-100 dark:from-indigo-950/40 dark:via-background dark:to-background">
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm" aria-hidden="true">
            <LifeBuoyIcon className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Support Desk</h1>
            <p className="text-sm text-muted-foreground">Submit a ticket and let AI triage its category and priority.</p>
          </div>
        </header>
        <Dashboard />
      </main>
    </div>
  );
}
