"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DeveloperAvatar, SeverityBadge, TagBadge } from "@/components/badges";
import { useTaskUI } from "@/components/tasks/task-ui-provider";
import { useQuickEditTask } from "@/hooks/use-tasks";
import { errorMessage } from "@/lib/api/client";
import { STATUSES, type Status, type Task } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { STATUS_META } from "@/lib/meta";
import { cn } from "@/lib/utils";

function TaskCard({ task, dragging = false }: { task: Task; dragging?: boolean }) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border bg-card p-3 text-left shadow-xs",
        dragging && "rotate-1 shadow-lg ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold">{task.number}</span>
        {task.product && <TagBadge tag={task.product.tag} />}
      </div>
      <p className={cn("line-clamp-2 text-sm font-medium", task.status === "Done" && "text-muted-foreground")}>
        {task.title}
      </p>
      <div className="flex items-center justify-between gap-2">
        <SeverityBadge severity={task.severity} />
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "tabular inline-flex items-center gap-1 text-xs",
              task.is_overdue ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {task.is_overdue && <AlertTriangle className="size-3" aria-hidden />}
            {formatShortDate(task.end_date)}
          </span>
          {task.developer ? (
            <span title={task.developer.name}>
              <DeveloperAvatar name={task.developer.name} inactive={!task.developer.is_active} size="sm" />
            </span>
          ) : (
            <span className="size-6 rounded-full border border-dashed" title="Unassigned" />
          )}
        </span>
      </div>
    </div>
  );
}

function DraggableCard({ task }: { task: Task }) {
  const { openTask } = useTaskUI();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, data: task });
  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-roledescription="draggable task"
        aria-label={`${task.number}: ${task.title}. ${task.status}. Press space to move between columns, or enter to open.`}
        onClick={() => openTask(task.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") openTask(task.id);
          else listeners?.onKeyDown?.(e);
        }}
        className={cn(
          "block w-full cursor-grab rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
          isDragging && "opacity-40",
        )}
      >
        <TaskCard task={task} />
      </button>
    </li>
  );
}

function Column({ status, tasks }: { status: Status; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const { icon: Icon, text } = STATUS_META[status];
  return (
    <section
      ref={setNodeRef}
      aria-label={`${status} column, ${tasks.length} tasks`}
      className={cn(
        "flex min-h-64 w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors md:w-auto md:shrink",
        isOver && "border-primary/50 bg-accent/60",
      )}
    >
      <h2 className="flex items-center gap-2 px-3 pt-3 pb-2 text-sm font-semibold">
        <Icon className={cn("size-4", text)} aria-hidden />
        {status}
        <span className="tabular ml-auto rounded-full bg-background px-2 text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </h2>
      <ul className="flex flex-1 flex-col gap-2 p-2 pt-0">
        {tasks.map((task) => (
          <DraggableCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
            Drop tasks here
          </li>
        )}
      </ul>
    </section>
  );
}

/** Kanban view grouped by status. Dropping a card in another column updates its status. */
export function TaskBoard({ tasks }: { tasks: Task[] }) {
  const edit = useQuickEditTask();
  const [active, setActive] = useState<Task | null>(null);
  const sensors = useSensors(
    // A small distance keeps plain clicks (open the task) distinct from drags.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const onDragStart = ({ active }: DragStartEvent) => setActive(active.data.current as Task);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActive(null);
    const task = active.data.current as Task | undefined;
    const status = over?.id as Status | undefined;
    if (!task || !status || task.status === status) return;
    edit.mutate(
      { task, edit: { field: "status", value: status } },
      {
        onSuccess: (saved) => toast.success(`${saved.number} → ${saved.status}`),
        onError: (error) => toast.error(`Couldn't move ${task.number}: ${errorMessage(error)}`),
      },
    );
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${(active.data.current as Task).number}.`,
          onDragOver: ({ over }) => (over ? `Over ${over.id}.` : "Not over a column."),
          onDragEnd: ({ active, over }) =>
            over ? `Moved ${(active.data.current as Task).number} to ${over.id}.` : "Move cancelled.",
          onDragCancel: () => "Move cancelled.",
        },
      }}
    >
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
        {STATUSES.map((status) => (
          <Column key={status} status={status} tasks={tasks.filter((t) => t.status === status)} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>{active && <TaskCard task={active} dragging />}</DragOverlay>
    </DndContext>
  );
}
