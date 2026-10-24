"use client";

import { CalendarIcon, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { ISODate } from "@/lib/api/types";
import { formatDate, parseDate, toISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Field({
  id,
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** aria props wiring an input to its Field's error/hint text. */
export function describedBy(id: string, error?: string, hint?: boolean) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}

export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  invalid,
  disabled,
  placeholder = "Pick a date",
  clearable = false,
  ...aria
}: {
  id: string;
  value: ISODate | "" | undefined;
  onChange: (value: ISODate | "") => void;
  min?: ISODate;
  max?: ISODate;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  clearable?: boolean;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseDate(value) : undefined;
  const bounds = [
    ...(min ? [{ before: parseDate(min) }] : []),
    ...(max ? [{ after: parseDate(max) }] : []),
  ];

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={aria["aria-describedby"]}
            className={cn(
              "h-9 w-full justify-start px-3 font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="text-muted-foreground" aria-hidden />
            {value ? formatDate(value) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? (min ? parseDate(min) : undefined)}
            disabled={bounds}
            onSelect={(date) => {
              if (date) onChange(toISODate(date));
              setOpen(false);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {clearable && value && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-2 -translate-y-1/2"
          aria-label="Clear date"
          onClick={() => onChange("")}
        >
          <X aria-hidden />
        </Button>
      )}
    </div>
  );
}

/**
 * Map an API error onto form fields. Field-level messages land on their inputs; anything
 * else becomes a toast. Returns true if at least one field was marked.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly string[],
): boolean {
  let marked = false;
  if (error instanceof ApiError) {
    for (const [field, message] of Object.entries(error.fields)) {
      if (knownFields.includes(field)) {
        setError(field as Path<T>, { type: "server", message }, { shouldFocus: !marked });
        marked = true;
      }
    }
  }
  if (!marked) toast.error(errorMessage(error));
  return marked;
}
