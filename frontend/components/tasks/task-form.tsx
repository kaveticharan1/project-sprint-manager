"use client";

import { Loader2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { DeveloperAvatar, SeverityLabel, StatusLabel, TagBadge } from "@/components/badges";
import { applyServerErrors, DatePicker, describedBy, Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAllDevelopers } from "@/hooks/use-developers";
import { useAllProducts } from "@/hooks/use-products";
import { useProductSprints } from "@/hooks/use-sprints";
import { useSaveTask } from "@/hooks/use-tasks";
import { SEVERITIES, STATUSES, type Sprint, type Task } from "@/lib/api/types";
import { formatRange, formatShortDate, toISODate } from "@/lib/format";
import { taskDateErrors, taskSchema, type TaskFormInput, type TaskFormOutput } from "@/lib/schemas";
import { zodResolver } from "@/lib/zod-resolver";

const NONE = "__none__";
const FIELDS = [
  "title",
  "description",
  "product_id",
  "sprint_id",
  "developer_id",
  "severity",
  "status",
  "start_date",
  "end_date",
] as const;

export type TaskDefaults = Partial<
  Pick<TaskFormInput, "product_id" | "sprint_id" | "developer_id">
>;

function toFormValues(task?: Task, defaults: TaskDefaults = {}): TaskFormInput {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    product_id: task?.product_id ?? defaults.product_id ?? "",
    sprint_id: task?.sprint_id ?? defaults.sprint_id ?? "",
    developer_id: task?.developer_id ?? defaults.developer_id ?? "",
    severity: task?.severity ?? "Medium",
    status: task?.status ?? "To Do",
    start_date: task?.start_date ?? "",
    end_date: task?.end_date ?? "",
  };
}

function clampToSprint(date: string, sprint: Sprint) {
  if (date < sprint.start_date) return sprint.start_date;
  if (date > sprint.end_date) return sprint.end_date;
  return date;
}

export function TaskForm({
  task,
  defaults,
  onSaved,
  onCancel,
  footerStart,
  submitLabel,
}: {
  task?: Task;
  defaults?: TaskDefaults;
  onSaved: (task: Task) => void;
  onCancel?: () => void;
  footerStart?: ReactNode;
  submitLabel?: string;
}) {
  const isEdit = Boolean(task);
  const save = useSaveTask(task?.id);
  const products = useAllProducts();
  const developers = useAllDevelopers();

  const form = useForm<TaskFormInput, unknown, TaskFormOutput>({
    resolver: zodResolver(taskSchema),
    defaultValues: toFormValues(task, defaults),
  });
  const { register, control, handleSubmit, setValue, setError, getValues, formState } = form;
  const { errors, isSubmitting } = formState;

  const productId = useWatch({ control, name: "product_id" });
  const sprintId = useWatch({ control, name: "sprint_id" });
  const sprints = useProductSprints(productId || undefined);
  const sprintList = useMemo(() => sprints.data?.items ?? [], [sprints.data]);
  const sprint = sprintList.find((s) => s.id === sprintId);

  // Active developers can be assigned; an existing inactive assignee stays visible as-is.
  const assignable = (developers.data?.items ?? []).filter(
    (d) => d.is_active || d.id === task?.developer_id,
  );

  const onProductChange = (value: string) => {
    if (value === getValues("product_id")) return;
    setValue("product_id", value, { shouldValidate: formState.isSubmitted });
    // Sprints belong to a product, so the sprint choice must be made again.
    setValue("sprint_id", "", { shouldValidate: false });
  };

  const onSprintChange = (value: string) => {
    setValue("sprint_id", value, { shouldValidate: formState.isSubmitted });
    const chosen = sprintList.find((s) => s.id === value);
    if (!chosen) return;
    // Pre-fill dates that are empty with sensible values inside the sprint.
    if (!getValues("start_date")) {
      setValue("start_date", clampToSprint(toISODate(new Date()), chosen));
    }
    if (!getValues("end_date")) setValue("end_date", chosen.end_date);
  };

  const onSubmit = handleSubmit(async (values) => {
    // Cross-field rule the static schema can't know: dates must sit inside the chosen sprint.
    const dateErrors = Object.entries(taskDateErrors(values, sprint));
    if (dateErrors.length) {
      dateErrors.forEach(([field, message], i) =>
        setError(
          field as "start_date" | "end_date",
          { type: "sprint", message },
          { shouldFocus: i === 0 },
        ),
      );
      return;
    }
    try {
      const saved = await save.mutateAsync(values);
      onSaved(saved);
    } catch (error) {
      applyServerErrors(error, setError, FIELDS);
    }
  });

  const sprintHint = sprint
    ? `Sprint ${sprint.number} runs ${formatRange(sprint.start_date, sprint.end_date)}`
    : productId
      ? undefined
      : "Choose a product first";

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="grid flex-1 gap-4 overflow-y-auto px-1 pb-1">
        <Field id="task-title" label="Title" required error={errors.title?.message}>
          <Input
            id="task-title"
            placeholder="e.g. Add password reset flow"
            autoFocus={!isEdit}
            {...describedBy("task-title", errors.title?.message)}
            {...register("title")}
          />
        </Field>

        <Field
          id="task-description"
          label="Description"
          error={errors.description?.message}
          hint="Optional. Context, acceptance criteria or links."
        >
          <Textarea
            id="task-description"
            rows={4}
            placeholder="What needs to happen, and how do we know it's done?"
            {...describedBy("task-description", errors.description?.message, true)}
            {...register("description")}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="task-product"
            label="Product"
            required
            error={errors.product_id?.message}
            hint={isEdit ? "A task's product can't change. Create a new task instead." : undefined}
          >
            <Controller
              control={control}
              name="product_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={onProductChange} disabled={isEdit}>
                  <SelectTrigger
                    id="task-product"
                    className="h-9 w-full"
                    {...describedBy("task-product", errors.product_id?.message, isEdit)}
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

          <Field
            id="task-sprint"
            label="Sprint"
            required
            error={errors.sprint_id?.message}
            hint={sprintHint}
          >
            <Controller
              control={control}
              name="sprint_id"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={onSprintChange}
                  disabled={!productId || sprints.isLoading}
                >
                  <SelectTrigger
                    id="task-sprint"
                    className="h-9 w-full"
                    {...describedBy("task-sprint", errors.sprint_id?.message, Boolean(sprintHint))}
                  >
                    <SelectValue
                      placeholder={
                        !productId
                          ? "Select a product first"
                          : sprintList.length || sprints.isLoading
                            ? "Select a sprint"
                            : "This product has no sprints"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {sprintList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="font-medium">Sprint {s.number}</span>
                        <span className="text-muted-foreground">
                          {s.name ? `${s.name} · ` : ""}
                          {formatShortDate(s.start_date)} – {formatShortDate(s.end_date)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="task-assignee" label="Assignee" error={errors.developer_id?.message}>
            <Controller
              control={control}
              name="developer_id"
              render={({ field }) => (
                <Select
                  value={field.value || NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                >
                  <SelectTrigger
                    id="task-assignee"
                    className="h-9 w-full"
                    {...describedBy("task-assignee", errors.developer_id?.message)}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>
                      <span className="text-muted-foreground">Unassigned</span>
                    </SelectItem>
                    {assignable.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <DeveloperAvatar name={d.name} inactive={!d.is_active} size="sm" />
                        {d.name}
                        {!d.is_active && <span className="text-muted-foreground">(inactive)</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field id="task-severity" label="Severity" required error={errors.severity?.message}>
            <Controller
              control={control}
              name="severity"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="task-severity" className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        <SeverityLabel severity={s} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field id="task-status" label="Status" required error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="task-status" className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        <StatusLabel status={s} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="task-start" label="Start date" required error={errors.start_date?.message}>
            <Controller
              control={control}
              name="start_date"
              render={({ field }) => (
                <DatePicker
                  id="task-start"
                  value={field.value}
                  onChange={field.onChange}
                  min={sprint?.start_date}
                  max={sprint?.end_date}
                  invalid={Boolean(errors.start_date)}
                  disabled={!sprintId}
                  placeholder={sprintId ? "Pick a date" : "Choose a sprint first"}
                  aria-describedby={errors.start_date ? "task-start-error" : undefined}
                />
              )}
            />
          </Field>
          <Field id="task-end" label="End date" required error={errors.end_date?.message}>
            <Controller
              control={control}
              name="end_date"
              render={({ field }) => (
                <DatePicker
                  id="task-end"
                  value={field.value}
                  onChange={field.onChange}
                  min={sprint?.start_date}
                  max={sprint?.end_date}
                  invalid={Boolean(errors.end_date)}
                  disabled={!sprintId}
                  placeholder={sprintId ? "Pick a date" : "Choose a sprint first"}
                  aria-describedby={errors.end_date ? "task-end-error" : undefined}
                />
              )}
            />
          </Field>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
        {footerStart}
        <div className="ml-auto flex gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            {submitLabel ?? (isEdit ? "Save changes" : "Create task")}
          </Button>
        </div>
      </div>
    </form>
  );
}
