"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  FolderKanban,
  History,
  IterationCw,
  ListTodo,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { DeveloperAvatar, SeverityBadge, StatusBadge, TagBadge } from "@/components/badges";
import { HorizontalBars } from "@/components/dashboard/bar-chart";
import { useBreadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ErrorState } from "@/components/states";
import { StatusBar } from "@/components/status-bar";
import { useTaskUI } from "@/components/tasks/task-ui-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/hooks/use-tasks";
import { SEVERITIES, STATUSES, type DashboardSummary, type Task } from "@/lib/api/types";
import { dueLabel, formatDate, formatRange, relativeTime } from "@/lib/format";
import { SEVERITY_META, STATUS_META } from "@/lib/meta";
import { cn } from "@/lib/utils";

function Panel({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: typeof ListTodo;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col rounded-xl border bg-card p-5 shadow-xs", className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ViewAll({ href, label = "View all" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded text-sm text-muted-foreground hover:text-foreground"
    >
      {label} <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

function TaskRow({ task, meta }: { task: Task; meta: ReactNode }) {
  const { openTask } = useTaskUI();
  return (
    <li>
      <button
        type="button"
        onClick={() => openTask(task.id)}
        className="flex w-full flex-col gap-1 rounded-lg px-2 py-2 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex w-full min-w-0 items-baseline gap-2">
          <span className="shrink-0 font-mono text-xs font-semibold">{task.number}</span>
          <span className="min-w-0 truncate text-sm">{task.title}</span>
        </span>
        <span className="flex flex-wrap items-center gap-2 text-xs">
          <SeverityBadge severity={task.severity} />
          {meta}
        </span>
      </button>
    </li>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardView() {
  useBreadcrumbs([{ label: "Dashboard" }]);
  const query = useDashboard();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          query.data
            ? `Where things stand today, ${formatDate(query.data.today, "EEEE, MMMM d")}.`
            : "Where things stand today."
        }
      />
      {query.isPending ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          onRetry={() => query.refetch()}
          title="Couldn't load the dashboard"
        />
      ) : (
        <DashboardContent data={query.data} />
      )}
    </>
  );
}

function DashboardContent({ data }: { data: DashboardSummary }) {
  const router = useRouter();
  const { totals } = data;

  const statusBars = STATUSES.map((s) => ({
    label: s,
    value: data.tasks_by_status[s],
    color: STATUS_META[s].chart,
  }));
  const severityBars = SEVERITIES.map((s) => ({
    label: s,
    value: data.tasks_by_severity[s],
    color: SEVERITY_META[s].chart,
  }));
  const maxWorkload = Math.max(1, ...data.tasks_per_developer.map((d) => d.open));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Developers"
          value={totals.developers}
          icon={Users}
          hint={`${totals.active_developers} active`}
          href="/developers"
        />
        <StatCard
          label="Products"
          value={totals.products}
          icon={FolderKanban}
          hint="View all products"
          href="/products"
        />
        <StatCard
          label="Sprints"
          value={totals.sprints}
          icon={IterationCw}
          hint={`${totals.active_sprints} running now`}
          href="/sprints?state=Active"
        />
        <StatCard
          label="Tasks"
          value={totals.tasks}
          icon={ListTodo}
          hint={
            <>
              {totals.open_tasks} open ·{" "}
              <span className={totals.overdue_tasks ? "font-medium text-destructive" : undefined}>
                {totals.overdue_tasks} overdue
              </span>
            </>
          }
          href="/tasks"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Tasks by status" action={<ViewAll href="/tasks" />}>
          <HorizontalBars
            data={statusBars}
            ariaLabel="Tasks by status"
            onSelect={(d) => router.push(`/tasks?status=${encodeURIComponent(d.label)}`)}
          />
        </Panel>
        <Panel title="Tasks by severity" action={<ViewAll href="/tasks?sort=severity" />}>
          <HorizontalBars
            data={severityBars}
            ariaLabel="Tasks by severity"
            onSelect={(d) => router.push(`/tasks?severity=${encodeURIComponent(d.label)}`)}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Tasks per product" icon={FolderKanban} action={<ViewAll href="/products" />}>
          <ul className="space-y-4">
            {data.tasks_per_product.map((p) => {
              const percent = p.total ? Math.round((p.done / p.total) * 100) : 0;
              return (
                <li key={p.product_id}>
                  <Link
                    href={`/tasks?product_id=${p.product_id}`}
                    className="block space-y-1.5 rounded-lg p-1 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <TagBadge tag={p.tag} />
                        <span className="truncate font-medium">{p.name}</span>
                      </span>
                      <span className="tabular shrink-0 text-muted-foreground">
                        {p.done}/{p.total} done · {percent}%
                      </span>
                    </div>
                    <div
                      className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted"
                      aria-hidden
                    >
                      <div
                        className="rounded-full bg-emerald-600"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel
          title="Active sprints"
          icon={IterationCw}
          action={<ViewAll href="/sprints?state=Active" />}
        >
          {data.active_sprints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sprint is running today.</p>
          ) : (
            <ul className="space-y-4">
              {data.active_sprints.map((s) => (
                <li key={s.sprint_id}>
                  <Link
                    href={`/sprints/${s.sprint_id}`}
                    className="block space-y-1.5 rounded-lg p-1 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <TagBadge tag={s.tag} />
                        <span className="truncate font-medium">
                          Sprint {s.number}
                          {s.name && (
                            <span className="font-normal text-muted-foreground"> · {s.name}</span>
                          )}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-xs text-muted-foreground">
                        {formatRange(s.start_date, s.end_date)}
                      </span>
                    </div>
                    <StatusBar counts={s.status_counts} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Overdue"
          icon={AlertTriangle}
          action={<ViewAll href="/tasks?overdue=true&sort=end_date" />}
        >
          {data.overdue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing overdue. 🎉</p>
          ) : (
            <ul className="-mx-2">
              {data.overdue.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  meta={
                    <span className="font-medium text-destructive">{dueLabel(t.end_date)}</span>
                  }
                />
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          title="Due this week"
          icon={CalendarClock}
          action={<ViewAll href="/tasks?sort=end_date" />}
        >
          {data.due_this_week.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due in the next 7 days.</p>
          ) : (
            <ul className="-mx-2">
              {data.due_this_week.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  meta={<span className="text-muted-foreground">{dueLabel(t.end_date)}</span>}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Recently updated"
          icon={History}
          action={<ViewAll href="/tasks?sort=-updated_at" />}
          className="lg:col-span-2"
        >
          <ul className="-mx-2">
            {data.recently_updated.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                meta={
                  <>
                    <StatusBadge status={t.status} />
                    <span className="text-muted-foreground">
                      updated {relativeTime(t.updated_at)}
                    </span>
                  </>
                }
              />
            ))}
          </ul>
        </Panel>
        <Panel title="Team workload" icon={Users} action={<ViewAll href="/developers" />}>
          <ul className="space-y-2.5">
            {data.tasks_per_developer.map((d) => (
              <li key={d.developer_id ?? "unassigned"}>
                <Link
                  href={`/tasks?developer_id=${d.developer_id ?? "unassigned"}&status=To+Do&status=In+Progress&status=Blocked`}
                  className="flex items-center gap-3 rounded-lg p-1 text-sm outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {d.developer_id ? (
                    <DeveloperAvatar name={d.name} inactive={!d.is_active} size="sm" />
                  ) : (
                    <span
                      className="size-6 shrink-0 rounded-full border border-dashed"
                      aria-hidden
                    />
                  )}
                  <span className={cn("w-28 truncate", !d.is_active && "text-muted-foreground")}>
                    {d.name}
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${(d.open / maxWorkload) * 100}%` }}
                    />
                  </span>
                  <span className="tabular w-14 text-right text-xs text-muted-foreground">
                    {d.open} open
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
