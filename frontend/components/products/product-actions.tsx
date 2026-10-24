"use client";

import { Ban, IterationCw, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { SprintFormDialog } from "@/components/sprints/sprint-form-dialog";
import { useTaskUI } from "@/components/tasks/task-ui-provider";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteProduct } from "@/hooks/use-products";
import { errorMessage, isApiError } from "@/lib/api/client";
import type { Product } from "@/lib/api/types";
import { plural } from "@/lib/format";

type DialogName = "edit" | "sprint" | "delete" | "blocked" | null;

export function ProductActions({
  product,
  variant = "row",
}: {
  product: Product;
  variant?: "row" | "page";
}) {
  const [dialog, setDialog] = useState<DialogName>(null);
  const [blocked, setBlocked] = useState({ sprints: 0, tasks: 0 });
  const router = useRouter();
  const remove = useDeleteProduct();
  const { openCreate } = useTaskUI();

  const requestDelete = () => {
    if (product.sprint_count || product.task_count) {
      setBlocked({ sprints: product.sprint_count, tasks: product.task_count });
      setDialog("blocked");
    } else {
      setDialog("delete");
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {variant === "page" && (
          <>
            <Button variant="outline" onClick={() => setDialog("sprint")}>
              <IterationCw aria-hidden /> New sprint
            </Button>
            <Button
              variant="outline"
              onClick={() => openCreate({ product_id: product.id })}
              disabled={product.sprint_count === 0}
              title={product.sprint_count === 0 ? "Create a sprint first" : undefined}
            >
              <Plus aria-hidden /> New task
            </Button>
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={variant === "page" ? "outline" : "ghost"}
              size="icon"
              aria-label={`Actions for ${product.name}`}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => setDialog("edit")}>
              <Pencil aria-hidden /> Edit
            </DropdownMenuItem>
            {variant === "row" && (
              <DropdownMenuItem onSelect={() => setDialog("sprint")}>
                <IterationCw aria-hidden /> New sprint
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={requestDelete}>
              <Trash2 aria-hidden /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ProductFormDialog
        open={dialog === "edit"}
        onOpenChange={(open) => setDialog(open ? "edit" : null)}
        product={product}
      />
      <SprintFormDialog
        open={dialog === "sprint"}
        onOpenChange={(open) => setDialog(open ? "sprint" : null)}
        productId={product.id}
      />

      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        destructive
        title={`Delete ${product.name}?`}
        confirmLabel="Delete product"
        description={
          <p>
            {product.name} ({product.tag}) has no sprints or tasks and will be permanently removed.
          </p>
        }
        onConfirm={async () => {
          try {
            await remove.mutateAsync(product.id);
            toast.success(`Deleted ${product.name}`);
            if (variant === "page") router.push("/products");
          } catch (error) {
            if (isApiError(error, "product_in_use")) {
              setBlocked({
                sprints: error.details.sprint_count ?? 0,
                tasks: error.details.task_count ?? 0,
              });
              setDialog("blocked");
            } else {
              toast.error(errorMessage(error));
            }
            throw error;
          }
        }}
      />

      <AlertDialog open={dialog === "blocked"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="size-5 text-destructive" aria-hidden />
              {product.name} can&apos;t be deleted yet
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  It still has{" "}
                  <strong className="text-foreground">{plural(blocked.sprints, "sprint")}</strong> and{" "}
                  <strong className="text-foreground">{plural(blocked.tasks, "task")}</strong>.
                  Deleting it would orphan them.
                </p>
                <p>Delete its tasks and sprints first, then delete the product.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <Button asChild>
              <Link href={`/products/${product.id}?tab=sprints`} onClick={() => setDialog(null)}>
                Review sprints
              </Link>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
