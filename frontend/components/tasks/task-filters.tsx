"use client";

import { AlertTriangle, X } from "lucide-react";

import { SeverityLabel, StatusLabel, TagBadge } from "@/components/badges";
import { SearchInput } from "@/components/search-input";
import { FacetFilter, type FacetOption } from "@/components/tasks/facet-filter";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  SEVERITIES,
  STATUSES,
  type DeveloperRef,
  type ProductRef,
  type Severity,
  type SprintRef,
  type Status,
} from "@/lib/api/types";

export const UNASSIGNED = "unassigned";

export interface TaskFilterState {
  q: string;
  product_id: string;
  sprint_id: string;
  developer_id: string;
  severity: Severity[];
  status: Status[];
  overdue: boolean;
}

export const EMPTY_FILTERS: TaskFilterState = {
  q: "",
  product_id: "",
  sprint_id: "",
  developer_id: "",
  severity: [],
  status: [],
  overdue: false,
};

export function hasActiveFilters(filters: TaskFilterState): boolean {
  return Boolean(
    filters.q ||
    filters.product_id ||
    filters.sprint_id ||
    filters.developer_id ||
    filters.severity.length ||
    filters.status.length ||
    filters.overdue,
  );
}

/**
 * Search + filter toolbar for tasks. Fully controlled: the parent owns the state (the URL on
 * the tasks page) and supplies the option lists.
 */
export function TaskFilterToolbar({
  filters,
  onChange,
  products,
  sprints,
  developers,
}: {
  filters: TaskFilterState;
  onChange: (changes: Partial<TaskFilterState>) => void;
  products: ProductRef[];
  /** Sprints of the selected product only. */
  sprints: SprintRef[];
  developers: DeveloperRef[];
}) {
  const product = products.find((p) => p.id === filters.product_id);
  const sprint = sprints.find((s) => s.id === filters.sprint_id);
  const developer = developers.find((d) => d.id === filters.developer_id);

  const productOptions: FacetOption[] = products.map((p) => ({
    value: p.id,
    label: p.tag,
    content: (
      <span className="flex items-center gap-2">
        <TagBadge tag={p.tag} /> <span className="truncate">{p.name}</span>
      </span>
    ),
  }));
  const sprintOptions: FacetOption[] = [...sprints]
    .sort((a, b) => b.number - a.number)
    .map((s) => ({
      value: s.id,
      label: `Sprint ${s.number}`,
      content: (
        <span className="truncate">
          Sprint {s.number}
          {s.name && <span className="text-muted-foreground"> · {s.name}</span>}
        </span>
      ),
    }));
  const developerOptions: FacetOption[] = [
    { value: UNASSIGNED, label: "Unassigned" },
    ...developers.map((d) => ({
      value: d.id,
      label: d.name,
      content: (
        <span className={d.is_active ? undefined : "text-muted-foreground"}>
          {d.name}
          {!d.is_active && " (inactive)"}
        </span>
      ),
    })),
  ];

  const chips: { key: string; label: string; clear: Partial<TaskFilterState> }[] = [];
  if (filters.q) chips.push({ key: "q", label: `Search: “${filters.q}”`, clear: { q: "" } });
  if (filters.product_id) {
    chips.push({
      key: "product",
      label: `Product: ${product?.tag ?? "…"}`,
      // The sprint filter depends on the product, so it goes too.
      clear: { product_id: "", sprint_id: "" },
    });
  }
  if (filters.sprint_id) {
    chips.push({
      key: "sprint",
      label: `Sprint: ${sprint ? `S${sprint.number}` : "…"}`,
      clear: { sprint_id: "" },
    });
  }
  if (filters.developer_id) {
    chips.push({
      key: "developer",
      label: `Assignee: ${filters.developer_id === UNASSIGNED ? "Unassigned" : (developer?.name ?? "…")}`,
      clear: { developer_id: "" },
    });
  }
  if (filters.severity.length) {
    chips.push({
      key: "severity",
      label: `Severity: ${filters.severity.join(", ")}`,
      clear: { severity: [] },
    });
  }
  if (filters.status.length) {
    chips.push({
      key: "status",
      label: `Status: ${filters.status.join(", ")}`,
      clear: { status: [] },
    });
  }
  if (filters.overdue)
    chips.push({ key: "overdue", label: "Overdue only", clear: { overdue: false } });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={filters.q}
          onChange={(q) => onChange({ q })}
          placeholder="Search number or title…"
          label="Search tasks"
          className="w-full sm:w-64"
        />
        <FacetFilter
          title="Product"
          options={productOptions}
          selected={filters.product_id ? [filters.product_id] : []}
          onChange={([value = ""]) =>
            onChange(
              value === filters.product_id
                ? { product_id: value }
                : { product_id: value, sprint_id: "" },
            )
          }
        />
        <FacetFilter
          title="Sprint"
          options={sprintOptions}
          selected={filters.sprint_id ? [filters.sprint_id] : []}
          onChange={([value = ""]) => onChange({ sprint_id: value })}
          disabled={!filters.product_id}
          disabledHint="Choose a product first"
          searchable={false}
        />
        <FacetFilter
          title="Assignee"
          options={developerOptions}
          selected={filters.developer_id ? [filters.developer_id] : []}
          onChange={([value = ""]) => onChange({ developer_id: value })}
        />
        <FacetFilter
          title="Severity"
          multiple
          searchable={false}
          options={SEVERITIES.map((s) => ({
            value: s,
            label: s,
            content: <SeverityLabel severity={s} />,
          }))}
          selected={filters.severity}
          onChange={(values) => onChange({ severity: values as Severity[] })}
        />
        <FacetFilter
          title="Status"
          multiple
          searchable={false}
          options={STATUSES.map((s) => ({
            value: s,
            label: s,
            content: <StatusLabel status={s} />,
          }))}
          selected={filters.status}
          onChange={(values) => onChange({ status: values as Status[] })}
        />
        <Toggle
          variant="outline"
          pressed={filters.overdue}
          onPressedChange={(overdue) => onChange({ overdue })}
          aria-label="Only overdue tasks"
          className="h-9 border-dashed px-3 data-[state=on]:border-solid data-[state=on]:border-destructive/40 data-[state=on]:bg-destructive/10 data-[state=on]:text-destructive"
        >
          <AlertTriangle aria-hidden /> Overdue
        </Toggle>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full border bg-secondary py-0.5 pr-1 pl-2.5 text-xs font-medium"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => onChange(chip.clear)}
                aria-label={`Remove filter ${chip.label}`}
                className="rounded-full p-0.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
