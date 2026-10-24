"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface BarDatum {
  label: string;
  value: number;
  color: string;
  /** Extra line for the tooltip, e.g. "3 done". */
  detail?: string;
}

/**
 * Horizontal bar chart: one labelled bar per category with its value printed at the end, so
 * identity never depends on color. Bars are clickable (``onSelect``) to drill into tasks.
 */
export function HorizontalBars({
  data,
  onSelect,
  ariaLabel,
  height,
}: {
  data: BarDatum[];
  onSelect?: (datum: BarDatum) => void;
  ariaLabel: string;
  height?: number;
}) {
  const chartHeight = height ?? data.length * 40 + 8;
  return (
    <figure aria-label={ariaLabel}>
      <div style={{ height: chartHeight }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={8}>
            <XAxis type="number" hide allowDecimals={false} domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="label"
              width={96}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 13 }}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload }) => {
                const datum = payload?.[0]?.payload as BarDatum | undefined;
                if (!active || !datum) return null;
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
                    <div className="flex items-center gap-2 font-medium">
                      <span className="size-2.5 rounded-sm" style={{ backgroundColor: datum.color }} />
                      {datum.label}
                    </div>
                    <div className="tabular text-muted-foreground">
                      {datum.value} task{datum.value === 1 ? "" : "s"}
                      {datum.detail ? ` · ${datum.detail}` : ""}
                    </div>
                    {onSelect && <div className="mt-1 text-xs text-muted-foreground">Click to view tasks</div>}
                  </div>
                );
              }}
            />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
              minPointSize={2}
              cursor={onSelect ? "pointer" : undefined}
              onClick={(entry) => onSelect?.(entry.payload as BarDatum)}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.label} fill={d.color} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                className="tabular"
                style={{ fill: "var(--foreground)", fontSize: 13, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Screen-reader and keyboard equivalent of the chart. */}
      <figcaption className="sr-only">
        <ul>
          {data.map((d) => (
            <li key={d.label}>
              {d.label}: {d.value}
              {d.detail ? `, ${d.detail}` : ""}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
