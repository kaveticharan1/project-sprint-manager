"use client";

import {
  ArrowRightLeft,
  Ban,
  ListTodo,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { DeveloperAvatar } from "@/components/badges";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DeveloperFormDialog } from "@/components/developers/developer-form-dialog";
import { Field } from "@/components/form";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAllDevelopers,
  useDeleteDeveloper,
  useReassignTasks,
  useSetDeveloperActive,
} from "@/hooks/use-developers";
import { errorMessage, isApiError } from "@/lib/api/client";
import type { Developer } from "@/lib/api/types";
import { plural } from "@/lib/format";

type DialogName = "edit" | "deactivate" | "delete" | "blocked" | "reassign" | null;

/**
 * Every action on a developer, with its dialogs. ``variant="row"`` renders a compact menu for
 * tables; ``variant="page"`` renders an Edit button plus the menu for the detail page.
 */
export function DeveloperActions({
  developer,
  variant = "row",
}: {
  developer: Developer;
  variant?: "row" | "page";
}) {
  const [dialog, setDialog] = useState<DialogName>(null);
  const [blockedCounts, setBlockedCounts] = useState({ total: 0, open: 0 });
  const router = useRouter();
  const setActive = useSetDeveloperActive();
  const remove = useDeleteDeveloper();
  const close = () => setDialog(null);

  const activate = () =>
    setActive.mutate(
      { id: developer.id, active: true },
      {
        onSuccess: () => toast.success(`${developer.name} is active again`),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  const requestDelete = () => {
    if (developer.task_count > 0) {
      setBlockedCounts({ total: developer.task_count, open: developer.open_task_count });
      setDialog("blocked");
    } else {
      setDialog("delete");
    }
  };

  return (
    <>
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {variant === "page" && (
          <Button variant="outline" onClick={() => setDialog("edit")}>
            <Pencil aria-hidden /> Edit
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={variant === "page" ? "outline" : "ghost"}
              size="icon"
              aria-label={`Actions for ${developer.name}`}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {variant === "row" && (
              <>
                <DropdownMenuItem onSelect={() => setDialog("edit")}>
                  <Pencil aria-hidden /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/developers/${developer.id}`}>
                    <ListTodo aria-hidden /> View tasks
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem
              onSelect={() => setDialog("reassign")}
              disabled={developer.open_task_count === 0}
            >
              <ArrowRightLeft aria-hidden /> Reassign open tasks
            </DropdownMenuItem>
            {developer.is_active ? (
              <DropdownMenuItem onSelect={() => setDialog("deactivate")}>
                <UserX aria-hidden /> Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={activate}>
                <UserCheck aria-hidden /> Activate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={requestDelete}>
              <Trash2 aria-hidden /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DeveloperFormDialog
        open={dialog === "edit"}
        onOpenChange={(open) => setDialog(open ? "edit" : null)}
        developer={developer}
      />

      <ConfirmDialog
        open={dialog === "deactivate"}
        onOpenChange={(open) => !open && close()}
        title={`Deactivate ${developer.name}?`}
        confirmLabel="Deactivate"
        description={
          <>
            {developer.open_task_count > 0 ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-50 p-3 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                <strong>{developer.name}</strong> still has{" "}
                <strong>{plural(developer.open_task_count, "open task")}</strong>. They will stay
                assigned, but consider reassigning them so work isn&apos;t stuck.
              </p>
            ) : (
              <p>{developer.name} has no open tasks.</p>
            )}
            <p>
              Inactive developers keep their task history but can&apos;t be assigned new tasks. You
              can reactivate them at any time.
            </p>
          </>
        }
        onConfirm={async () => {
          try {
            await setActive.mutateAsync({ id: developer.id, active: false });
            toast.success(`${developer.name} deactivated`);
          } catch (error) {
            toast.error(errorMessage(error));
            throw error;
          }
        }}
      >
        {developer.open_task_count > 0 && (
          <Button
            variant="link"
            className="h-auto justify-start p-0"
            onClick={() => setDialog("reassign")}
          >
            <ArrowRightLeft aria-hidden /> Reassign their open tasks first
          </Button>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && close()}
        destructive
        title={`Delete ${developer.name}?`}
        confirmLabel="Delete developer"
        description={
          <p>
            {developer.name} ({developer.email}) has no tasks and will be permanently removed. This
            can&apos;t be undone.
          </p>
        }
        onConfirm={async () => {
          try {
            await remove.mutateAsync(developer.id);
            toast.success(`Deleted ${developer.name}`);
            if (variant === "page") router.push("/developers");
          } catch (error) {
            // Someone assigned a task in the meantime: explain instead of failing silently.
            if (isApiError(error, "developer_has_tasks")) {
              setBlockedCounts({
                total: error.details.task_count ?? 0,
                open: error.details.open_task_count ?? 0,
              });
              setDialog("blocked");
            } else {
              toast.error(errorMessage(error));
            }
            // Rethrow so the confirm dialog doesn't treat this as success and reset `dialog`.
            throw error;
          }
        }}
      />

      <AlertDialog open={dialog === "blocked"} onOpenChange={(open) => !open && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="size-5 text-destructive" aria-hidden />
              {developer.name} can&apos;t be deleted
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  They have{" "}
                  <strong className="text-foreground">{plural(blockedCounts.total, "task")}</strong>
                  {blockedCounts.open > 0 && <> ({blockedCounts.open} still open)</>}. Deleting them
                  would leave those tasks pointing at nobody.
                </p>
                <p>
                  Deactivate them instead to keep the history, or reassign their open tasks to
                  someone else.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            {blockedCounts.open > 0 && (
              <Button variant="outline" onClick={() => setDialog("reassign")}>
                <ArrowRightLeft aria-hidden /> Reassign tasks
              </Button>
            )}
            {developer.is_active && (
              <Button onClick={() => setDialog("deactivate")}>
                <UserX aria-hidden /> Deactivate instead
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReassignDialog
        developer={developer}
        open={dialog === "reassign"}
        onOpenChange={(open) => !open && close()}
      />
    </>
  );
}

function ReassignDialog({
  developer,
  open,
  onOpenChange,
}: {
  developer: Developer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const developers = useAllDevelopers();
  const reassign = useReassignTasks();
  const [target, setTarget] = useState("");
  const candidates = (developers.data?.items ?? []).filter(
    (d) => d.is_active && d.id !== developer.id,
  );

  const submit = () =>
    reassign.mutate(
      { id: developer.id, targetId: target },
      {
        onSuccess: ({ moved }) => {
          const name = candidates.find((d) => d.id === target)?.name ?? "the new assignee";
          toast.success(`Moved ${plural(moved, "task")} to ${name}`);
          setTarget("");
          onOpenChange(false);
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign open tasks</DialogTitle>
          <DialogDescription>
            Move {plural(developer.open_task_count, "open task")} from {developer.name} to another
            active developer. Completed tasks keep their original assignee.
          </DialogDescription>
        </DialogHeader>
        <Field id="reassign-target" label="New assignee" required>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id="reassign-target" className="h-9 w-full">
              <SelectValue placeholder="Select a developer" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  <DeveloperAvatar name={d.name} size="sm" />
                  {d.name}
                  <span className="text-muted-foreground">
                    {d.role} · {d.open_task_count} open
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={reassign.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={!target || reassign.isPending}>
            {reassign.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Reassign tasks
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
