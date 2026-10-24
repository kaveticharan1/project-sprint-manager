import { cn } from "@/lib/utils";
import type { Severity, SprintState, Status } from "@/lib/api/types";
import { avatarColor, SEVERITY_META, SPRINT_STATE_BADGE, STATUS_META, tagColor } from "@/lib/meta";
import { initials } from "@/lib/format";

const pill =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset";

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const { icon: Icon, badge } = SEVERITY_META[severity];
  return (
    <span className={cn(pill, badge, className)} data-severity={severity}>
      <Icon className="size-3.5" aria-hidden />
      {severity}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const { icon: Icon, badge } = STATUS_META[status];
  return (
    <span className={cn(pill, badge, className)} data-status={status}>
      <Icon className="size-3.5" aria-hidden />
      {status}
    </span>
  );
}

/** Icon + label in a neutral style, for use inside selects and menus. */
export function StatusLabel({ status }: { status: Status }) {
  const { icon: Icon, text } = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className={cn("size-4", text)} aria-hidden />
      {status}
    </span>
  );
}

export function SeverityLabel({ severity }: { severity: Severity }) {
  const { icon: Icon, text } = SEVERITY_META[severity];
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className={cn("size-4", text)} aria-hidden />
      {severity}
    </span>
  );
}

export function TagBadge({ tag, className }: { tag: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide",
        tagColor(tag),
        className,
      )}
    >
      {tag}
    </span>
  );
}

export function SprintStateBadge({ state }: { state: SprintState }) {
  return (
    <span className={cn(pill, SPRINT_STATE_BADGE[state])}>
      {state === "Active" && (
        <span className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" aria-hidden />
      )}
      {state}
    </span>
  );
}

export function InactiveBadge() {
  return (
    <span
      className={cn(
        pill,
        "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-500/15 dark:text-zinc-300",
      )}
    >
      Inactive
    </span>
  );
}

export function DeveloperAvatar({
  name,
  inactive = false,
  size = "md",
}: {
  name: string;
  inactive?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-12 text-base" };
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none",
        sizes[size],
        inactive ? "bg-zinc-400 dark:bg-zinc-600" : avatarColor(name),
      )}
    >
      {initials(name)}
    </span>
  );
}
