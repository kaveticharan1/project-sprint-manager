import { z } from "zod";

import { ROLES, SEVERITIES, STATUSES, type SprintRef } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

/** Client-side mirrors of the API's validation rules. The API stays the source of truth. */

const requiredDate = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} is required`);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .transform((value) => value || null);

export const TAG_PATTERN = /^[A-Z0-9]{2,8}$/;

export const developerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  role: z.enum(ROLES, { error: "Choose a role" }),
});
export type DeveloperFormInput = z.input<typeof developerSchema>;
export type DeveloperFormOutput = z.output<typeof developerSchema>;

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  tag: z
    .string()
    .trim()
    .toUpperCase()
    .regex(TAG_PATTERN, "Use 2–8 letters or digits (A–Z, 0–9)"),
  description: optionalText(2000, "Description"),
});
export type ProductFormInput = z.input<typeof productSchema>;
export type ProductFormOutput = z.output<typeof productSchema>;

export const sprintSchema = z
  .object({
    product_id: z.string().min(1, "Choose a product"),
    number: z
      .string()
      .trim()
      .regex(/^\d*$/, "Must be a whole number")
      .transform((value) => (value ? Number(value) : undefined))
      .refine((value) => value === undefined || value >= 1, "Must be 1 or more"),
    name: optionalText(100, "Name"),
    goal: optionalText(1000, "Goal"),
    start_date: requiredDate("Start date"),
    end_date: requiredDate("End date"),
  })
  .refine((v) => v.start_date <= v.end_date, {
    path: ["end_date"],
    message: "End date must be on or after the start date",
  });
export type SprintFormInput = z.input<typeof sprintSchema>;
export type SprintFormOutput = z.output<typeof sprintSchema>;

/**
 * Task form schema. ``findSprint`` resolves the selected sprint so dates can be checked
 * against its range before the request is sent.
 */
export function makeTaskSchema(findSprint: (id: string) => SprintRef | undefined) {
  return z
    .object({
      title: z
        .string()
        .trim()
        .min(3, "Title must be at least 3 characters")
        .max(120, "Title must be at most 120 characters"),
      description: optionalText(5000, "Description"),
      product_id: z.string().min(1, "Choose a product"),
      sprint_id: z.string().min(1, "Choose a sprint"),
      developer_id: z.string().transform((value) => value || null),
      severity: z.enum(SEVERITIES, { error: "Choose a severity" }),
      status: z.enum(STATUSES, { error: "Choose a status" }),
      start_date: requiredDate("Start date"),
      end_date: requiredDate("End date"),
    })
    .superRefine((v, ctx) => {
      if (v.start_date > v.end_date) {
        ctx.addIssue({
          code: "custom",
          path: ["end_date"],
          message: "End date must be on or after the start date",
        });
      }
      const sprint = findSprint(v.sprint_id);
      if (!sprint) return;
      const window = `Sprint ${sprint.number} runs ${formatDate(sprint.start_date, "MMM d")} – ${formatDate(sprint.end_date, "MMM d")}`;
      for (const field of ["start_date", "end_date"] as const) {
        const value = v[field];
        if (value < sprint.start_date || value > sprint.end_date) {
          ctx.addIssue({ code: "custom", path: [field], message: `Outside the sprint. ${window}` });
        }
      }
    });
}
export type TaskFormInput = z.input<ReturnType<typeof makeTaskSchema>>;
export type TaskFormOutput = z.output<ReturnType<typeof makeTaskSchema>>;
