"use client";

import { AlertTriangle, CircleCheck, CircleDot, ListTodo, Plus } from "lucide-react";
import { useParams } from "next/navigation";

import { DeveloperAvatar, InactiveBadge } from "@/components/badges";
import { DeveloperActions } from "@/components/developers/developer-actions";
import { useBreadcrumbs } from "@/components/layout/breadcrumbs";
import { NotFoundState } from "@/components/not-found-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { TaskTable } from "@/components/tasks/task-table";
import { useTaskUI } from "@/components/tasks/task-ui-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDeveloper, useDeveloperTasks } from "@/hooks/use-developers";
import { useUrlState } from "@/hooks/use-url-state";
import { isApiError } from "@/lib/api/client";
import { STATUSES, type Status, type TaskSort } from "@/lib/api/types";
import { plural } from "@/lib/format";

const OPEN_STATUSES: Status[] = STATUSES.filter((s) => s !== "Done");

export function DeveloperDetail() {
  const { id } = useParams<{ id: string }>();
  const url = useUrlState();
  const show = url.get("show") || "open";
  const sort = (url.get("sort") || "end_date") as TaskSort;
  const { openCreate } = useTaskUI();

  const developer = useDeveloper(id);
  // Unfiltered list drives the stat cards; the filtered one drives the table.
  const all = useDeveloperTasks(id, { page_size: 200 });
  const tasks = useDeveloperTasks(id, {
    status: show === "open" ? OPEN_STATUSES : show === "done" ? ["Done"] : undefined,
    sort,
    page_size: 200,
  });

  useBreadcrumbs([
    { label: "Developers", href: "/developers" },
    { label: developer.data?.name ?? "Developer" },
  ]);

  if (developer.isPending) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <TableSkeleton />
      </div>
    );
  }
  if (developer.isError) {
    return isApiError(developer.error, "not_found") ? (
      <NotFoundState entity="Developer" backHref="/developers" backLabel="Back to developers" />
    ) : (
      <ErrorState error={developer.error} onRetry={() => developer.refetch()} />
    );
  }

  const dev = developer.data;
  const items = all.data?.items ?? [];
  const count = (status: Status) => items.filter((t) => t.status === status).length;
  const overdue = items.filter((t) => t.is_overdue).length;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <DeveloperAvatar name={dev.name} inactive={!dev.is_active} size="lg" />
            <span>
              {dev.name}
              <span className="block text-sm font-normal text-muted-foreground">
                {dev.role} · {dev.email}
              </span>
            </span>
            {!dev.is_active && <InactiveBadge />}
          </span>
        }
        actions={
          <>
            {dev.is_active && (
              <Button variant="outline" onClick={() => openCreate({ developer_id: dev.id })}>
                <Plus aria-hidden /> Assign new task
              </Button>
            )}
            <DeveloperActions developer={dev} variant="page" />
          </>
        }
      />

      {!dev.is_active && dev.open_task_count > 0 && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            {dev.name} is inactive but still has {plural(dev.open_task_count, "open task")}. Use{" "}
            <strong>Reassign open tasks</strong> from the actions menu to hand them over.
          </p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open tasks" value={dev.open_task_count} icon={ListTodo} />
        <StatCard label="In progress" value={count("In Progress")} icon={CircleDot} />
        <StatCard label="Done" value={count("Done")} icon={CircleCheck} />
        <StatCard
          label="Overdue"
          value={overdue}
          icon={AlertTriangle}
          tone={overdue ? "danger" : "default"}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Tasks</h2>
        <ToggleGroup
          type="single"
          variant="outline"
          value={show}
          onValueChange={(value) => value && url.set({ show: value === "open" ? null : value })}
          aria-label="Filter tasks"
        >
          <ToggleGroupItem value="open" className="px-3">Open</ToggleGroupItem>
          <ToggleGroupItem value="done" className="px-3">Done</ToggleGroupItem>
          <ToggleGroupItem value="all" className="px-3">All</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {tasks.isPending ? (
        <TableSkeleton />
      ) : tasks.isError ? (
        <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
      ) : tasks.data.items.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title={show === "open" ? "No open tasks" : show === "done" ? "Nothing completed yet" : "No tasks yet"}
          description={
            dev.is_active
              ? `Assign a task to ${dev.name} to see it here.`
              : `${dev.name} is inactive, so new tasks can't be assigned.`
          }
          action={
            dev.is_active ? (
              <Button onClick={() => openCreate({ developer_id: dev.id })}>
                <Plus aria-hidden /> Assign new task
              </Button>
            ) : undefined
          }
        />
      ) : (
        <TaskTable
          tasks={tasks.data.items}
          hide={["assignee"]}
          sort={sort}
          onSort={(next) => url.set({ sort: next })}
        />
      )}
    </>
  );
}
