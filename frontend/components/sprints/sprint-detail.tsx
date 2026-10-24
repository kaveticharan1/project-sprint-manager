"use client";

import { CalendarDays, Target } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { SprintStateBadge, TagBadge } from "@/components/badges";
import { useBreadcrumbs } from "@/components/layout/breadcrumbs";
import { NotFoundState } from "@/components/not-found-state";
import { PageHeader } from "@/components/page-header";
import { SprintActions } from "@/components/sprints/sprint-actions";
import { ErrorState, TableSkeleton } from "@/components/states";
import { StatusBar } from "@/components/status-bar";
import { TaskListPanel } from "@/components/tasks/task-list-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useSprint } from "@/hooks/use-sprints";
import { isApiError } from "@/lib/api/client";
import { STATUSES } from "@/lib/api/types";
import { STATUS_META } from "@/lib/meta";
import { formatRange, parseDate, plural } from "@/lib/format";
import { differenceInCalendarDays } from "date-fns";

function timeline(start: string, end: string) {
  const total = differenceInCalendarDays(parseDate(end), parseDate(start)) + 1;
  const elapsed = differenceInCalendarDays(new Date(), parseDate(start)) + 1;
  if (elapsed < 1) return `Starts in ${plural(1 - elapsed, "day")}`;
  if (elapsed > total) return `Ended ${plural(elapsed - total, "day")} ago`;
  return `Day ${elapsed} of ${total} · ${plural(total - elapsed, "day")} left`;
}

export function SprintDetail() {
  const { id } = useParams<{ id: string }>();
  const sprint = useSprint(id);
  const s = sprint.data;

  useBreadcrumbs([
    { label: "Sprints", href: "/sprints" },
    ...(s?.product ? [{ label: s.product.name, href: `/products/${s.product.id}` }] : []),
    { label: s ? `Sprint ${s.number}` : "Sprint" },
  ]);

  if (sprint.isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <TableSkeleton />
      </div>
    );
  }
  if (sprint.isError || !s) {
    return isApiError(sprint.error, "not_found") ? (
      <NotFoundState entity="Sprint" backHref="/sprints" backLabel="Back to sprints" />
    ) : (
      <ErrorState error={sprint.error} onRetry={() => sprint.refetch()} />
    );
  }

  const done = s.status_counts.Done ?? 0;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            {s.product && (
              <Link href={`/products/${s.product.id}`} className="hover:opacity-80">
                <TagBadge tag={s.product.tag} className="text-xs" />
              </Link>
            )}
            <SprintStateBadge state={s.state} />
          </>
        }
        title={
          <>
            {s.product?.tag} · Sprint {s.number}
            {s.name && <span className="font-normal text-muted-foreground"> — {s.name}</span>}
          </>
        }
        actions={<SprintActions sprint={s} variant="page" />}
      />

      <section className="mb-6 grid gap-4 rounded-xl border bg-card p-5 shadow-xs md:grid-cols-[1fr_1.4fr]">
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
            <span className="tabular font-medium">{formatRange(s.start_date, s.end_date)}</span>
            <span className="text-muted-foreground">· {timeline(s.start_date, s.end_date)}</span>
          </p>
          <p className="flex items-start gap-2">
            <Target className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            {s.goal ? (
              <span>{s.goal}</span>
            ) : (
              <span className="text-muted-foreground">No goal set.</span>
            )}
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Progress</span>
            <span className="tabular text-muted-foreground">
              {done} of {plural(s.task_count, "task")} done
            </span>
          </div>
          <StatusBar counts={s.status_counts} />
          <dl className="grid grid-cols-4 gap-2">
            {STATUSES.map((status) => {
              const Icon = STATUS_META[status].icon;
              return (
                <div key={status} className="rounded-lg bg-muted/50 p-2.5">
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon className={`size-3.5 ${STATUS_META[status].text}`} aria-hidden />
                    <span className="truncate">{status}</span>
                  </dt>
                  <dd className="tabular text-lg font-semibold">{s.status_counts[status] ?? 0}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      <h2 className="mb-3 text-lg font-semibold">Tasks</h2>
      <TaskListPanel
        scope={{ sprint_id: s.id }}
        hide={["product", "sprint"]}
        createDefaults={{ product_id: s.product_id, sprint_id: s.id }}
      />
    </>
  );
}
