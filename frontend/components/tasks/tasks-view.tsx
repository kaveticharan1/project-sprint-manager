"use client";

import { ListTodo, Plus, SearchX } from "lucide-react";

import { useBreadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  TaskFilterToolbar,
  type TaskFilterState,
} from "@/components/tasks/task-filters";
import { TaskTable } from "@/components/tasks/task-table";
import { useTaskUI } from "@/components/tasks/task-ui-provider";
import { Button } from "@/components/ui/button";
import { useAllDevelopers } from "@/hooks/use-developers";
import { useAllProducts } from "@/hooks/use-products";
import { useProductSprints } from "@/hooks/use-sprints";
import { useTasks } from "@/hooks/use-tasks";
import { useUrlState } from "@/hooks/use-url-state";
import {
  SEVERITIES,
  STATUSES,
  type Severity,
  type Status,
  type TaskSort,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

export function TasksView() {
  useBreadcrumbs([{ label: "Tasks" }]);
  const url = useUrlState();
  const { openCreate } = useTaskUI();

  // The query string is the single source of truth for every filter.
  const filters: TaskFilterState = {
    q: url.get("q"),
    product_id: url.get("product_id"),
    sprint_id: url.get("sprint_id"),
    developer_id: url.get("developer_id"),
    severity: url.getAll("severity").filter((s): s is Severity => SEVERITIES.includes(s as Severity)),
    status: url.getAll("status").filter((s): s is Status => STATUSES.includes(s as Status)),
    overdue: url.get("overdue") === "true",
  };
  const sort = (url.get("sort") || "number") as TaskSort;

  const products = useAllProducts();
  const developers = useAllDevelopers();
  const sprints = useProductSprints(filters.product_id || undefined);
  const query = useTasks({
    q: filters.q || undefined,
    product_id: filters.product_id || undefined,
    sprint_id: filters.sprint_id || undefined,
    developer_id: filters.developer_id || undefined,
    severity: filters.severity.length ? filters.severity : undefined,
    status: filters.status.length ? filters.status : undefined,
    overdue: filters.overdue || undefined,
    sort,
    page: url.page,
    page_size: PAGE_SIZE,
  });

  const updateFilters = (changes: Partial<TaskFilterState>) => url.set(changes);
  const filtered = hasActiveFilters(filters);

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Search, filter and update work across every product and sprint."
        actions={
          <Button
            onClick={() =>
              openCreate({
                product_id: filters.product_id || undefined,
                sprint_id: filters.sprint_id || undefined,
              })
            }
          >
            <Plus aria-hidden /> New task
          </Button>
        }
      />

      <div className="mb-4">
        <TaskFilterToolbar
          filters={filters}
          onChange={updateFilters}
          products={products.data?.items ?? []}
          sprints={filters.product_id ? (sprints.data?.items ?? []) : []}
          developers={developers.data?.items ?? []}
        />
      </div>

      {query.isPending ? (
        <TableSkeleton rows={10} columns={8} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.items.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={SearchX}
            title="No tasks match these filters"
            description="Try removing a filter or searching for something else."
            action={
              <Button variant="outline" onClick={() => updateFilters(EMPTY_FILTERS)}>
                Clear all filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={ListTodo}
            title="No tasks yet"
            description="Create a task inside a sprint to start tracking work."
            action={
              <Button onClick={() => openCreate()}>
                <Plus aria-hidden /> New task
              </Button>
            }
          />
        )
      ) : (
        <div className={cn("transition-opacity", query.isPlaceholderData && "opacity-60")}>
          <TaskTable tasks={query.data.items} sort={sort} onSort={(next) => url.set({ sort: next })} />
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
    </>
  );
}
