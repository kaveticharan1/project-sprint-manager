"use client";

import { ArrowRightLeft, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { MoveTasksDialog } from "@/components/sprints/move-tasks-dialog";
import { SprintFormDialog } from "@/components/sprints/sprint-form-dialog";
import { useTaskUI } from "@/components/tasks/task-ui-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteSprint } from "@/hooks/use-sprints";
import { errorMessage, isApiError } from "@/lib/api/client";
import type { Sprint } from "@/lib/api/types";
import { formatRange, sprintLabel } from "@/lib/format";

type DialogName = "edit" | "delete" | "move" | "move-delete" | null;

export function SprintActions({
  sprint,
  variant = "row",
}: {
  sprint: Sprint;
  variant?: "row" | "page";
}) {
  const [dialog, setDialog] = useState<DialogName>(null);
  const router = useRouter();
  const remove = useDeleteSprint();
  const { openCreate } = useTaskUI();
  const label = sprintLabel(sprint.product?.tag, sprint.number);
  const afterDelete = () => {
    if (variant === "page") router.push(`/sprints?product_id=${sprint.product_id}`);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {variant === "page" && (
          <>
            <Button
              variant="outline"
              onClick={() => openCreate({ product_id: sprint.product_id, sprint_id: sprint.id })}
            >
              <Plus aria-hidden /> Add task
            </Button>
            <Button variant="outline" onClick={() => setDialog("edit")}>
              <Pencil aria-hidden /> Edit
            </Button>
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={variant === "page" ? "outline" : "ghost"}
              size="icon"
              aria-label={`Actions for ${label}`}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {variant === "row" && (
              <>
                <DropdownMenuItem
                  onSelect={() => openCreate({ product_id: sprint.product_id, sprint_id: sprint.id })}
                >
                  <Plus aria-hidden /> Add task
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog("edit")}>
                  <Pencil aria-hidden /> Edit
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onSelect={() => setDialog("move")} disabled={sprint.task_count === 0}>
              <ArrowRightLeft aria-hidden /> Move tasks…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDialog(sprint.task_count > 0 ? "move-delete" : "delete")}
            >
              <Trash2 aria-hidden /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SprintFormDialog
        open={dialog === "edit"}
        onOpenChange={(open) => setDialog(open ? "edit" : null)}
        sprint={sprint}
      />

      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        destructive
        title={`Delete ${label}?`}
        confirmLabel="Delete sprint"
        description={
          <p>
            {sprint.name ? `“${sprint.name}” ` : ""}({formatRange(sprint.start_date, sprint.end_date)})
            has no tasks and will be permanently removed.
          </p>
        }
        onConfirm={async () => {
          try {
            await remove.mutateAsync(sprint.id);
            toast.success(`Deleted ${label}`);
            afterDelete();
          } catch (error) {
            if (isApiError(error, "sprint_has_tasks")) {
              // Tasks were added meanwhile: switch to the guided move-then-delete flow.
              setDialog("move-delete");
              toast.info(`${label} now has tasks. Move them first.`);
            } else {
              toast.error(errorMessage(error));
            }
            throw error;
          }
        }}
      />

      <MoveTasksDialog
        key={dialog ?? "closed"}
        sprint={sprint}
        open={dialog === "move" || dialog === "move-delete"}
        deleteAfter={dialog === "move-delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        onDeleted={afterDelete}
      />
    </>
  );
}
