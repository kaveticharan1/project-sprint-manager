"use client";

import { toast } from "sonner";

import { DeveloperAvatar, StatusBadge, StatusLabel } from "@/components/badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAllDevelopers } from "@/hooks/use-developers";
import { useQuickEditTask } from "@/hooks/use-tasks";
import { errorMessage } from "@/lib/api/client";
import { STATUSES, type Status, type Task } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const NONE = "__none__";

// Inline controls live inside clickable rows; keep their clicks from opening the row.
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

// Borderless until hovered/focused; the chevron is hidden to keep dense tables compact.
const TRIGGER =
  "h-7 gap-1 border-transparent bg-transparent px-1 shadow-none hover:border-input dark:bg-transparent [&>svg:last-child]:hidden";

export function InlineStatus({ task }: { task: Task }) {
  const edit = useQuickEditTask();
  return (
    <div onClick={stop} onKeyDown={stop}>
      <Select
        value={task.status}
        onValueChange={(value) =>
          edit.mutate(
            { task, edit: { field: "status", value: value as Status } },
            {
              onSuccess: (saved) => toast.success(`${saved.number} → ${saved.status}`),
              onError: (error) =>
                toast.error(`Couldn't update ${task.number}: ${errorMessage(error)}`),
            },
          )
        }
      >
        <SelectTrigger size="sm" aria-label={`Status of ${task.number}`} className={TRIGGER}>
          <StatusBadge status={task.status} />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              <StatusLabel status={s} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function InlineAssignee({ task }: { task: Task }) {
  const edit = useQuickEditTask();
  const developers = useAllDevelopers();
  const options = (developers.data?.items ?? []).filter(
    (d) => d.is_active || d.id === task.developer_id,
  );

  return (
    <div onClick={stop} onKeyDown={stop}>
      <Select
        value={task.developer_id ?? NONE}
        onValueChange={(value) => {
          const developer = options.find((d) => d.id === value);
          edit.mutate(
            {
              task,
              edit: {
                field: "assignee",
                value: value === NONE ? null : value,
                developer: developer
                  ? {
                      id: developer.id,
                      name: developer.name,
                      email: developer.email,
                      is_active: developer.is_active,
                    }
                  : null,
              },
            },
            {
              onSuccess: (saved) =>
                toast.success(
                  saved.developer
                    ? `${saved.number} assigned to ${saved.developer.name}`
                    : `${saved.number} is now unassigned`,
                ),
              onError: (error) =>
                toast.error(`Couldn't reassign ${task.number}: ${errorMessage(error)}`),
            },
          );
        }}
      >
        <SelectTrigger
          size="sm"
          aria-label={`Assignee of ${task.number}`}
          className={cn(TRIGGER, "max-w-40")}
        >
          {task.developer ? (
            <span className="flex min-w-0 items-center gap-2">
              <DeveloperAvatar
                name={task.developer.name}
                inactive={!task.developer.is_active}
                size="sm"
              />
              <span
                className={task.developer.is_active ? "truncate" : "truncate text-muted-foreground"}
              >
                {task.developer.name}
              </span>
            </span>
          ) : (
            <SelectValue placeholder="Unassigned">
              <span className="text-muted-foreground">Unassigned</span>
            </SelectValue>
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>
            <span className="text-muted-foreground">Unassigned</span>
          </SelectItem>
          {options.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              <DeveloperAvatar name={d.name} inactive={!d.is_active} size="sm" />
              {d.name}
              {!d.is_active && <span className="text-muted-foreground">(inactive)</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
