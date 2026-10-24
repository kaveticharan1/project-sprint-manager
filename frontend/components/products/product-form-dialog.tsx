"use client";

import { Loader2, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { applyServerErrors, describedBy, Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSaveProduct } from "@/hooks/use-products";
import type { Product } from "@/lib/api/types";
import { productSchema, type ProductFormInput, type ProductFormOutput } from "@/lib/schemas";
import { zodResolver } from "@/lib/zod-resolver";

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
  onSaved?: (product: Product) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? `Edit ${product.name}` : "New product"}</DialogTitle>
          <DialogDescription>
            The tag prefixes every task number, e.g. <span className="font-mono">LEARN-101</span>.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ProductForm
            product={product}
            onDone={(saved) => {
              onOpenChange(false);
              if (saved) onSaved?.(saved);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProductForm({
  product,
  onDone,
}: {
  product?: Product;
  onDone: (saved?: Product) => void;
}) {
  const save = useSaveProduct(product?.id);
  const tagLocked = Boolean(product?.tag_locked);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormInput, unknown, ProductFormOutput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      tag: product?.tag ?? "",
      description: product?.description ?? "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync(values);
      toast.success(product ? `Saved ${saved.name}` : `Created ${saved.name} (${saved.tag})`);
      onDone(saved);
    } catch (error) {
      applyServerErrors(error, setError, ["name", "tag", "description"]);
    }
  });

  const tagField = register("tag");

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Field id="product-name" label="Name" required error={errors.name?.message}>
          <Input
            id="product-name"
            placeholder="e.g. Learning Platform"
            autoFocus
            {...describedBy("product-name", errors.name?.message)}
            {...register("name")}
          />
        </Field>
        <Field
          id="product-tag"
          label="Tag"
          required
          error={errors.tag?.message}
          hint={tagLocked ? undefined : "2–8 letters/digits"}
        >
          <div className="relative">
            <Input
              id="product-tag"
              placeholder="LEARN"
              maxLength={8}
              disabled={tagLocked}
              autoCapitalize="characters"
              className="font-mono uppercase"
              {...describedBy("product-tag", errors.tag?.message, !tagLocked)}
              {...tagField}
              onChange={(e) => {
                // Normalise as the user types, then let react-hook-form handle the event.
                e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                return tagField.onChange(e);
              }}
            />
            {tagLocked && (
              <Lock
                className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
            )}
          </div>
        </Field>
      </div>
      {tagLocked && (
        <p className="-mt-2 flex items-start gap-2 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          The tag can&apos;t change because {product?.task_count} task number(s) already use{" "}
          {product?.tag}. Renaming it would break existing references like {product?.tag}-101.
        </p>
      )}
      <Field
        id="product-description"
        label="Description"
        error={errors.description?.message}
        hint="Optional. What is this product and who is it for?"
      >
        <Textarea
          id="product-description"
          rows={3}
          placeholder="A short summary"
          {...describedBy("product-description", errors.description?.message, true)}
          {...register("description")}
        />
      </Field>
      <DialogFooter className="mt-2">
        <Button type="button" variant="outline" onClick={() => onDone()} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {product ? "Save changes" : "Create product"}
        </Button>
      </DialogFooter>
    </form>
  );
}
