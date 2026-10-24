"use client";

import { AlertTriangle, CalendarClock, Trash2, User } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { DeveloperAvatar, SeverityBadge, StatusBadge, TagBadge } from "@/components/badges";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ErrorState } from "@/components/states";
import { TaskForm, type TaskDefaults } from "@/components/tasks/task-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteTask, useTask } from "@/hooks/use-tasks";
import { errorMessage } from "@/lib/api/client";
import type { Task } from "@/lib/api/types";
import { dueLabel, relativeTime } from "@/lib/format";

interface TaskUI {
  openCreate: (defaults?: TaskDefaults) => void;
  openTask: (id: string) => void;
}

const TaskUIContext = createContext<TaskUI | null>(null);

export function useTaskUI(): TaskUI {
  const context = useContext(TaskUIContext);
  if (!context) throw new Error("useTaskUI must be used inside <TaskUIProvider>");
  return context;
}

/** Owns the app-wide "New task" dialog and the task detail sheet. */
export function TaskUIProvider({ children }: { children: ReactNode }) {
  const [createState, setCreateState] = useState<{ open: boolean; defaults?: TaskDefaults; key: number }>(
    { open: false, key: 0 },
  );
  const [taskId, setTaskId] = useState<string | null>(null);

  const openCreate = useCallback(
    (defaults?: TaskDefaults) => setCreateState((s) => ({ open: true, defaults, key: s.key + 1 })),
    [],
  );
  const value = useMemo(() => ({ openCreate, openTask: setTaskId }), [openCreate]);

  return (
    <TaskUIContext.Provider value={value}>
      {children}

      <Dialog open={createState.open} onOpenChange={(open) => setCreateState((s) => ({ ...s, open }))}>
        <DialogContent className="flex max-h-[92svh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>
              The task number is generated from the product tag when you create it.
            </DialogDescription>
          </DialogHeader>
          <TaskForm
            key={createState.key}
            defaults={createState.defaults}
            onCancel={() => setCreateState((s) => ({ ...s, open: false }))}
            onSaved={(task) => {
              setCreateState((s) => ({ ...s, open: false }));
              toast.success(`Created ${task.number}`, {
                description: task.title,
                action: { label: "Open", onClick: () => setTaskId(task.id) },
              });
            }}
          />
        </DialogContent>
      </Dialog>

      <Sheet open={taskId !== null} onOpenChange={(open) => !open && setTaskId(null)}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          {taskId && <TaskDetail id={taskId} onClose={() => setTaskId(null)} />}
        </SheetContent>
      </Sheet>
    </TaskUIContext.Provider>
  );
}

function TaskDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useTask(id);
  const remove = useDeleteTask();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const task = query.data;

  if (query.isPending) {
    return (
      <div className="space-y-4 p-6" aria-busy="true">
        <SheetTitle className="sr-only">Loading task</SheetTitle>
        <SheetDescription className="sr-only">Loading task details</SheetDescription>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!task) {
    return (
      <div className="p-6">
        <SheetTitle className="sr-only">Task unavailable</SheetTitle>
        <SheetDescription className="sr-only">The task could not be loaded</SheetDescription>
        <ErrorState error={query.error} onRetry={() => query.refetch()} title="Couldn't load this task" />
      </div>
    );
  }

  return (
    <>
      <SheetHeader className="space-y-3 border-b p-6 pr-12">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono text-sm font-semibold">{task.number}</span>
          {task.product && (
            <Link href={`/products/${task.product.id}`} onClick={onClose} className="hover:opacity-80">
              <TagBadge tag={task.product.tag} />
            </Link>
          )}
          {task.sprint && (
            <Link
              href={`/sprints/${task.sprint.id}`}
              onClick={onClose}
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Sprint {task.sprint.number}
              {task.sprint.name ? ` · ${task.sprint.name}` : ""}
            </Link>
          )}
        </div>
        <SheetTitle className="text-xl leading-snug">{task.title}</SheetTitle>
        <SheetDescription asChild>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <SeverityBadge severity={task.severity} />
            <TaskMeta task={task} onNavigate={onClose} />
          </div>
        </SheetDescription>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col p-6">
        <TaskForm
          key={task.id}
          task={task}
          onSaved={(saved) => toast.success(`Saved ${saved.number}`)}
          footerStart={
            <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden /> Delete
            </Button>
          }
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Created {relativeTime(task.created_at)} · Updated {relativeTime(task.updated_at)}
        </p>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title={`Delete ${task.number}?`}
        confirmLabel="Delete task"
        description={
          <p>
            <span className="font-medium text-foreground">“{task.title}”</span> will be permanently
            removed. Its number won&apos;t be reused.
          </p>
        }
        onConfirm={async () => {
          try {
            await remove.mutateAsync(task.id);
            toast.success(`Deleted ${task.number}`);
            onClose();
          } catch (error) {
            toast.error(errorMessage(error));
            throw error;
          }
        }}
      />
    </>
  );
}

function TaskMeta({ task, onNavigate }: { task: Task; onNavigate: () => void }) {
  return (
    <>
      {task.developer ? (
        <Link
          href={`/developers/${task.developer.id}`}
          onClick={onNavigate}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <DeveloperAvatar name={task.developer.name} inactive={!task.developer.is_active} size="sm" />
          {task.developer.name}
          {!task.developer.is_active && " (inactive)"}
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <User className="size-3.5" aria-hidden /> Unassigned
        </span>
      )}
      {task.status !== "Done" && (
        <span
          className={
            task.is_overdue
              ? "inline-flex items-center gap-1 text-xs font-medium text-destructive"
              : "inline-flex items-center gap-1 text-xs text-muted-foreground"
          }
        >
          {task.is_overdue ? (
            <AlertTriangle className="size-3.5" aria-hidden />
          ) : (
            <CalendarClock className="size-3.5" aria-hidden />
          )}
          {dueLabel(task.end_date)}
        </span>
      )}
    </>
  );
}
