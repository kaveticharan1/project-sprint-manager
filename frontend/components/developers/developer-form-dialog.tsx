"use client";

import { Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaveDeveloper } from "@/hooks/use-developers";
import { ROLES, type Developer } from "@/lib/api/types";
import {
  developerSchema,
  type DeveloperFormInput,
  type DeveloperFormOutput,
} from "@/lib/schemas";
import { zodResolver } from "@/lib/zod-resolver";

export function DeveloperFormDialog({
  open,
  onOpenChange,
  developer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  developer?: Developer;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{developer ? `Edit ${developer.name}` : "Add developer"}</DialogTitle>
          <DialogDescription>
            {developer
              ? "Update this developer's details."
              : "Add a teammate who can be assigned tasks."}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <DeveloperForm developer={developer} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeveloperForm({ developer, onDone }: { developer?: Developer; onDone: () => void }) {
  const save = useSaveDeveloper(developer?.id);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DeveloperFormInput, unknown, DeveloperFormOutput>({
    resolver: zodResolver(developerSchema),
    defaultValues: {
      name: developer?.name ?? "",
      email: developer?.email ?? "",
      role: developer?.role ?? ("" as DeveloperFormInput["role"]),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync(values);
      toast.success(developer ? `Saved ${saved.name}` : `Added ${saved.name}`);
      onDone();
    } catch (error) {
      applyServerErrors(error, setError, ["name", "email", "role"]);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <Field id="dev-name" label="Full name" required error={errors.name?.message}>
        <Input
          id="dev-name"
          placeholder="e.g. Ada Lovelace"
          autoComplete="name"
          autoFocus
          {...describedBy("dev-name", errors.name?.message)}
          {...register("name")}
        />
      </Field>
      <Field
        id="dev-email"
        label="Email"
        required
        error={errors.email?.message}
        hint="Must be unique. Stored in lowercase."
      >
        <Input
          id="dev-email"
          type="email"
          placeholder="ada@company.com"
          autoComplete="email"
          {...describedBy("dev-email", errors.email?.message, true)}
          {...register("email")}
        />
      </Field>
      <Field id="dev-role" label="Role" required error={errors.role?.message}>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id="dev-role"
                className="h-9 w-full"
                {...describedBy("dev-role", errors.role?.message)}
              >
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <DialogFooter className="mt-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {developer ? "Save changes" : "Add developer"}
        </Button>
      </DialogFooter>
    </form>
  );
}
