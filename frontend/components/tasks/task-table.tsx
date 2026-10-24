"use client";

import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";

import { SeverityBadge, TagBadge } from "@/components/badges";
import { InlineAssignee, InlineStatus } from "@/components/tasks/inline-edits";
import { useTaskUI } from "@/components/tasks/task-ui-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Task, TaskSort } from "@/lib/api/types";
import { dueLabel, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TaskColumn = "product" | "sprint" | "assignee";
type SortKey = "number" | "title" | "severity" | "status" | "start_date" | "end_date";

function SortHeader({
  label,
  column,
  sort,
  onSort,
  className,
}: {
  label: string;
  column: SortKey;
  sort?: TaskSort;
  onSort?: (sort: TaskSort) => void;
  className?: string;
}) {
  if (!onSort) return <TableHead className={className}>{label}</TableHead>;
  const active = sort?.replace("-", "") === column;
  const descending = active && sort?.startsWith("-");
  const Icon = !active ? ArrowUpDown : descending ? ArrowDown : ArrowUp;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (descending ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort((active && !descending ? `-${column}` : column) as TaskSort)}
        className={cn(
          "-ml-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-muted hover:text-foreground",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
      </button>
    </TableHead>
  );
}

export function TaskTable({
  tasks,
  hide = [],
  sort,
  onSort,
  className,
}: {
  tasks: Task[];
  hide?: TaskColumn[];
  sort?: TaskSort;
  onSort?: (sort: TaskSort) => void;
  className?: string;
}) {
  const { openTask } = useTaskUI();
  const show = (column: TaskColumn) => !hide.includes(column);

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card shadow-xs", className)}>
      <Table className="min-w-[900px]">
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <SortHeader label="Task" column="number" sort={sort} onSort={onSort} className="pl-4" />
            <SortHeader
              label="Title"
              column="title"
              sort={sort}
              onSort={onSort}
              className="w-full min-w-48"
            />
            {show("product") && <TableHead>Product</TableHead>}
            {show("sprint") && <TableHead>Sprint</TableHead>}
            {show("assignee") && <TableHead>Assignee</TableHead>}
            <SortHeader label="Severity" column="severity" sort={sort} onSort={onSort} />
            <SortHeader label="Status" column="status" sort={sort} onSort={onSort} />
            <SortHeader label="Start" column="start_date" sort={sort} onSort={onSort} />
            <SortHeader
              label="End"
              column="end_date"
              sort={sort}
              onSort={onSort}
              className="pr-4"
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow
              key={task.id}
              onClick={() => openTask(task.id)}
              className={cn(
                "group cursor-pointer",
                task.status === "Done" && "text-muted-foreground",
              )}
            >
              <TableCell className="pl-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openTask(task.id);
                  }}
                  className="rounded font-mono text-[13px] font-semibold text-foreground outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {task.number}
                </button>
              </TableCell>
              <TableCell className="max-w-0">
                <span
                  className={cn(
                    "block truncate font-medium",
                    task.status === "Done"
                      ? "line-through decoration-muted-foreground/40"
                      : "text-foreground",
                  )}
                  title={task.title}
                >
                  {task.title}
                </span>
              </TableCell>
              {show("product") && (
                <TableCell>
                  {task.product && (
                    <Link
                      href={`/products/${task.product.id}`}
                      onClick={(e) => e.stopPropagation()}
                      title={task.product.name}
                    >
                      <TagBadge tag={task.product.tag} />
                    </Link>
                  )}
                </TableCell>
              )}
              {show("sprint") && (
                <TableCell>
                  {task.sprint && (
                    <Link
                      href={`/sprints/${task.sprint.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="tabular rounded font-mono text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                      title={`Sprint ${task.sprint.number}${task.sprint.name ? ` · ${task.sprint.name}` : ""}`}
                    >
                      S{task.sprint.number}
                    </Link>
                  )}
                </TableCell>
              )}
              {show("assignee") && (
                <TableCell>
                  <InlineAssignee task={task} />
                </TableCell>
              )}
              <TableCell>
                <SeverityBadge severity={task.severity} />
              </TableCell>
              <TableCell>
                <InlineStatus task={task} />
              </TableCell>
              <TableCell className="tabular text-sm text-muted-foreground">
                {formatShortDate(task.start_date)}
              </TableCell>
              <TableCell className="tabular pr-4 text-sm">
                {task.is_overdue ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 font-medium text-destructive">
                        <AlertTriangle className="size-3.5" aria-hidden />
                        {formatShortDate(task.end_date)}
                        <span className="sr-only">(overdue)</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{dueLabel(task.end_date)}</TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-muted-foreground">{formatShortDate(task.end_date)}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
