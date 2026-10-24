"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SprintStateBadge } from "@/components/badges";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMoveTasks, useProductSprints } from "@/hooks/use-sprints";
import { errorMessage, isApiError } from "@/lib/api/client";
import type { Sprint } from "@/lib/api/types";
import { formatRange, plural, sprintLabel } from "@/lib/format";

/**
 * Guided flow for emptying a sprint: pick another sprint of the same product, move every task
 * there (in one transaction), and optionally delete the now-empty sprint.
 */
export function MoveTasksDialog({
  sprint,
  open,
  onOpenChange,
  deleteAfter = true,
  onDeleted,
}: {
  sprint: Sprint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleteAfter?: boolean;
  onDeleted?: () => void;
}) {
  const siblings = useProductSprints(sprint.product_id);
  const move = useMoveTasks();
  const [target, setTarget] = useState("");
  const [deleteSource, setDeleteSource] = useState(deleteAfter);
  const [conflicts, setConflicts] = useState<string[] | null>(null);
  const label = sprintLabel(sprint.product?.tag, sprint.number);
  const candidates = (siblings.data?.items ?? [])
    .filter((s) => s.id !== sprint.id)
    .sort((a, b) => a.number - b.number);
  const targetSprint = candidates.find((s) => s.id === target);

  const reset = (next: boolean) => {
    if (!next) {
      setTarget("");
      setConflicts(null);
      setDeleteSource(deleteAfter);
    }
    onOpenChange(next);
  };

  const submit = (strategy: "reject" | "clamp") =>
    move.mutate(
      { id: sprint.id, target_sprint_id: target, date_strategy: strategy, delete_source: deleteSource },
      {
        onSuccess: (result) => {
          const where = targetSprint ? `Sprint ${targetSprint.number}` : "the target sprint";
          toast.success(`Moved ${plural(result.moved, "task")} to ${where}`, {
            description: [
              result.adjusted ? `${plural(result.adjusted, "task")} had dates adjusted.` : "",
              result.source_deleted ? `${label} was deleted.` : "",
            ]
              .filter(Boolean)
              .join(" "),
          });
          reset(false);
          if (result.source_deleted) onDeleted?.();
        },
        onError: (error) => {
          if (isApiError(error, "task_dates_outside_target")) {
            setConflicts(error.details.task_numbers ?? []);
          } else {
            toast.error(errorMessage(error));
          }
        },
      },
    );

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Move tasks out of {label}</DialogTitle>
          <DialogDescription>
            {plural(sprint.task_count, "task")} will move to another sprint of{" "}
            {sprint.product?.name ?? "the same product"}. Task numbers stay the same.
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 && !siblings.isPending ? (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            This product has no other sprint. Create one first, then move the tasks into it.
          </p>
        ) : (
          <div className="grid gap-4">
            <Field id="move-target" label="Target sprint" required>
              <Select
                value={target}
                onValueChange={(value) => {
                  setTarget(value);
                  setConflicts(null);
                }}
              >
                <SelectTrigger id="move-target" className="h-9 w-full">
                  <SelectValue placeholder="Select a sprint" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-medium">Sprint {s.number}</span>
                      <span className="text-muted-foreground">
                        {formatRange(s.start_date, s.end_date)}
                      </span>
                      <SprintStateBadge state={s.state} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center gap-2">
              <Checkbox
                id="move-delete"
                checked={deleteSource}
                onCheckedChange={(checked) => setDeleteSource(checked === true)}
              />
              <Label htmlFor="move-delete" className="font-normal">
                Delete {label} after moving its tasks
              </Label>
            </div>
            {conflicts && targetSprint && (
              <div
                role="alert"
                className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
              >
                <p className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="size-4" aria-hidden />
                  {plural(conflicts.length, "task")} fall outside Sprint {targetSprint.number} (
                  {formatRange(targetSprint.start_date, targetSprint.end_date)})
                </p>
                <p className="font-mono text-xs">{conflicts.join(", ")}</p>
                <p>
                  Fit their dates into the target sprint? Dates before it start on its first day,
                  dates after it end on its last day.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => reset(false)} disabled={move.isPending}>
            Cancel
          </Button>
          {conflicts ? (
            <Button onClick={() => submit("clamp")} disabled={move.isPending}>
              {move.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Fit dates and move
            </Button>
          ) : (
            <Button onClick={() => submit("reject")} disabled={!target || move.isPending}>
              {move.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {deleteSource ? "Move tasks and delete" : "Move tasks"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
