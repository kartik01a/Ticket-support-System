import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Category, Priority } from "@/lib/types";

const CATEGORY_STYLES: Record<Category, string> = {
  Technical: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300",
  Billing: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300",
  General: "bg-slate-200 text-slate-800 dark:bg-slate-500/20 dark:text-slate-300",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  High: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300",
  Medium: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  Low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
};

export function CategoryBadge({ category }: { category: Category }) {
  return <Badge className={cn(CATEGORY_STYLES[category])}>{category}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge className={cn(PRIORITY_STYLES[priority])}>{priority}</Badge>;
}
