"use client";

import { ListTodo, Plus } from "lucide-react";

import { Pager } from "@/components/pager";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { TaskTable, type TaskColumn } from "@/components/tasks/task-table";
import { useTaskUI } from "@/components/tasks/task-ui-provider";
import type { TaskDefaults } from "@/components/tasks/task-form";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTasks } from "@/hooks/use-tasks";
import { useUrlState } from "@/hooks/use-url-state";
import { STATUSES, type Status, type TaskQuery, type TaskSort } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

/**
 * Embedded, URL-driven task list for detail pages (product, sprint). ``scope`` fixes the
 * product/sprint; the status toggle, sort and page live in the query string.
 */
export function TaskListPanel({
  scope,
  hide,
  createDefaults,
  canCreate = true,
}: {
  scope: Pick<TaskQuery, "product_id" | "sprint_id">;
  hide?: TaskColumn[];
  createDefaults: TaskDefaults;
  canCreate?: boolean;
}) {
  const url = useUrlState();
  const { openCreate } = useTaskUI();
  const status = url.get("status") as Status | "";
  const sort = (url.get("sort") || "number") as TaskSort;
  const query = useTasks({
    ...scope,
    status: status ? [status] : undefined,
    sort,
    page: url.page,
    page_size: PAGE_SIZE,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          value={status || "all"}
          onValueChange={(value) => value && url.set({ status: value === "all" ? null : value })}
          aria-label="Filter by status"
          className="flex-wrap"
        >
          <ToggleGroupItem value="all" className="px-3">
            All
          </ToggleGroupItem>
          {STATUSES.map((s) => (
            <ToggleGroupItem key={s} value={s} className="px-3">
              {s}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {query.isPending ? (
        <TableSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title={status ? `No “${status}” tasks` : "No tasks yet"}
          description={
            canCreate
              ? "Tasks you add will show up here."
              : "Create a sprint first, then add tasks to it."
          }
          action={
            canCreate && !status ? (
              <Button onClick={() => openCreate(createDefaults)}>
                <Plus aria-hidden /> Add task
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={cn(query.isPlaceholderData && "opacity-60")}>
          <TaskTable
            tasks={query.data.items}
            hide={hide}
            sort={sort}
            onSort={(next) => url.set({ sort: next })}
          />
          <Pager
            page={query.data.page}
            pages={query.data.pages}
            total={query.data.total}
            pageSize={PAGE_SIZE}
            noun="tasks"
            onPageChange={(page) => url.set({ page })}
          />
        </div>
      )}
    </div>
  );
}
