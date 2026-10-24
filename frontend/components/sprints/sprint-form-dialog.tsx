"use client";

import { Loader2 } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { TagBadge } from "@/components/badges";
import { applyServerErrors, DatePicker, describedBy, Field } from "@/components/form";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAllProducts } from "@/hooks/use-products";
import { useProductSprints, useSaveSprint } from "@/hooks/use-sprints";
import type { Sprint } from "@/lib/api/types";
import { sprintLabel } from "@/lib/format";
import { sprintSchema, type SprintFormInput, type SprintFormOutput } from "@/lib/schemas";
import { zodResolver } from "@/lib/zod-resolver";

const FIELDS = ["product_id", "number", "name", "goal", "start_date", "end_date"] as const;

export function SprintFormDialog({
  open,
  onOpenChange,
  sprint,
  productId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprint?: Sprint;
  productId?: string;
  onSaved?: (sprint: Sprint) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {sprint ? `Edit ${sprintLabel(sprint.product?.tag, sprint.number)}` : "New sprint"}
          </DialogTitle>
          <DialogDescription>
            {sprint
              ? "Dates can only shrink as far as the tasks inside the sprint allow."
              : "Sprints are numbered per product. Leave the number blank to use the next one."}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <SprintForm
            sprint={sprint}
            productId={productId}
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

function SprintForm({
  sprint,
  productId,
  onDone,
}: {
  sprint?: Sprint;
  productId?: string;
  onDone: (saved?: Sprint) => void;
}) {
  const save = useSaveSprint(sprint?.id);
  const products = useAllProducts();
  const productLocked = Boolean(sprint && sprint.task_count > 0);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SprintFormInput, unknown, SprintFormOutput>({
    resolver: zodResolver(sprintSchema),
    defaultValues: {
      product_id: sprint?.product_id ?? productId ?? "",
      number: sprint ? String(sprint.number) : "",
      name: sprint?.name ?? "",
      goal: sprint?.goal ?? "",
      start_date: sprint?.start_date ?? "",
      end_date: sprint?.end_date ?? "",
    },
  });

  const selectedProduct = useWatch({ control, name: "product_id" });
  const startDate = useWatch({ control, name: "start_date" });
  const siblings = useProductSprints(sprint ? undefined : selectedProduct || undefined);
  const nextNumber =
    Math.max(0, ...(siblings.data?.items ?? []).map((s) => s.number)) + 1;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync(values);
      toast.success(
        `${sprint ? "Saved" : "Created"} ${sprintLabel(saved.product?.tag, saved.number)}`,
      );
      onDone(saved);
    } catch (error) {
      applyServerErrors(error, setError, FIELDS);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
        <Field
          id="sprint-product"
          label="Product"
          required
          error={errors.product_id?.message}
          hint={productLocked ? "Locked: this sprint already has tasks." : undefined}
        >
          <Controller
            control={control}
            name="product_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={productLocked}>
                <SelectTrigger
                  id="sprint-product"
                  className="h-9 w-full"
                  {...describedBy("sprint-product", errors.product_id?.message, productLocked)}
                >
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.data?.items.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <TagBadge tag={p.tag} /> {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field id="sprint-number" label="Number" error={errors.number?.message}>
          <Input
            id="sprint-number"
            inputMode="numeric"
            placeholder={sprint || !selectedProduct ? "Auto" : `Next: ${nextNumber}`}
            {...describedBy("sprint-number", errors.number?.message)}
            {...register("number")}
          />
        </Field>
      </div>

      <Field id="sprint-name" label="Name" error={errors.name?.message} hint="Optional, e.g. “Checkout revamp”.">
        <Input
          id="sprint-name"
          placeholder="Sprint name"
          {...describedBy("sprint-name", errors.name?.message, true)}
          {...register("name")}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="sprint-start" label="Start date" required error={errors.start_date?.message}>
          <Controller
            control={control}
            name="start_date"
            render={({ field }) => (
              <DatePicker
                id="sprint-start"
                value={field.value}
                onChange={field.onChange}
                invalid={Boolean(errors.start_date)}
                aria-describedby={errors.start_date ? "sprint-start-error" : undefined}
              />
            )}
          />
        </Field>
        <Field id="sprint-end" label="End date" required error={errors.end_date?.message}>
          <Controller
            control={control}
            name="end_date"
            render={({ field }) => (
              <DatePicker
                id="sprint-end"
                value={field.value}
                onChange={field.onChange}
                min={startDate || undefined}
                invalid={Boolean(errors.end_date)}
                aria-describedby={errors.end_date ? "sprint-end-error" : undefined}
              />
            )}
          />
        </Field>
      </div>

      <Field id="sprint-goal" label="Goal" error={errors.goal?.message} hint="Optional. What does success look like?">
        <Textarea
          id="sprint-goal"
          rows={3}
          placeholder="e.g. Ship refunds end to end behind a feature flag"
          {...describedBy("sprint-goal", errors.goal?.message, true)}
          {...register("goal")}
        />
      </Field>

      <DialogFooter className="mt-2">
        <Button type="button" variant="outline" onClick={() => onDone()} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {sprint ? "Save changes" : "Create sprint"}
        </Button>
      </DialogFooter>
    </form>
  );
}
