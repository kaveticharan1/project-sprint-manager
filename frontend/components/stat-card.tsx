import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: ReactNode;
  href?: string;
  tone?: "default" | "danger";
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-lg",
              tone === "danger"
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <div className="tabular mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </>
  );
  const classes = "block rounded-xl border bg-card p-4 shadow-xs transition-colors outline-none";
  return href ? (
    <Link
      href={href}
      className={cn(
        classes,
        "hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
