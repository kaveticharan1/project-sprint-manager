"use client";

import { CalendarDays, Target } from "lucide-react";
import Link from "next/link";

import { SprintStateBadge, TagBadge } from "@/components/badges";
import { SprintActions } from "@/components/sprints/sprint-actions";
import { StatusBar } from "@/components/status-bar";
import type { Sprint } from "@/lib/api/types";
import { formatRange, plural } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Sprint summary card. The title link stretches over the card; the actions menu sits above it. */
export function SprintCard({ sprint, showProduct = true }: { sprint: Sprint; showProduct?: boolean }) {
  const done = sprint.status_counts.Done ?? 0;
  const percent = sprint.task_count ? Math.round((done / sprint.task_count) * 100) : 0;

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors",
        "hover:border-primary/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring",
        sprint.state === "Active" && "border-emerald-500/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {showProduct && sprint.product && <TagBadge tag={sprint.product.tag} />}
            <Link
              href={`/sprints/${sprint.id}`}
              className="font-semibold outline-none after:absolute after:inset-0 after:rounded-xl"
            >
              Sprint {sprint.number}
            </Link>
            <SprintStateBadge state={sprint.state} />
          </div>
          {sprint.name && <p className="truncate text-sm text-muted-foreground">{sprint.name}</p>}
        </div>
        <div className="relative z-10">
          <SprintActions sprint={sprint} />
        </div>
      </div>

      <p className="tabular inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarDays className="size-4" aria-hidden />
        {formatRange(sprint.start_date, sprint.end_date)}
      </p>

      {sprint.goal && (
        <p className="line-clamp-2 inline-flex gap-1.5 text-sm text-muted-foreground">
          <Target className="mt-0.5 size-4 shrink-0" aria-hidden />
          {sprint.goal}
        </p>
      )}

      <div className="mt-auto space-y-1.5 pt-1">
        <div className="tabular flex justify-between text-xs text-muted-foreground">
          <span>{plural(sprint.task_count, "task")}</span>
          {sprint.task_count > 0 && <span>{percent}% done</span>}
        </div>
        <StatusBar counts={sprint.status_counts} />
      </div>
    </article>
  );
}
