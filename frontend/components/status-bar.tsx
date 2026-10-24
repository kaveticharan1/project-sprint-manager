import { STATUSES, type Status } from "@/lib/api/types";
import { STATUS_META } from "@/lib/meta";
import { cn } from "@/lib/utils";

/** Segmented progress bar of task counts by status, with an accessible text summary. */
export function StatusBar({
  counts,
  className,
  showLegend = false,
}: {
  counts: Record<Status, number>;
  className?: string;
  showLegend?: boolean;
}) {
  const total = STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  const done = counts.Done ?? 0;
  const summary = total
    ? STATUSES.filter((s) => counts[s]).map((s) => `${counts[s]} ${s}`).join(", ")
    : "No tasks";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        role="img"
        aria-label={`${summary}${total ? ` (${Math.round((done / total) * 100)}% done)` : ""}`}
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        {total > 0 &&
          STATUSES.map((status) =>
            counts[status] ? (
              <div
                key={status}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${(counts[status] / total) * 100}%`,
                  backgroundColor: STATUS_META[status].chart,
                }}
              />
            ) : null,
          )}
      </div>
      {showLegend && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {STATUSES.map((status) => (
            <li key={status} className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: STATUS_META[status].chart }}
                aria-hidden
              />
              {status} <span className="tabular font-medium text-foreground">{counts[status] ?? 0}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
