import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  EMPTY_FILTERS,
  TaskFilterToolbar,
  type TaskFilterState,
} from "@/components/tasks/task-filters";
import type { DeveloperRef, ProductRef, SprintRef } from "@/lib/api/types";

const products: ProductRef[] = [
  { id: "p1", name: "Learning Platform", tag: "LEARN" },
  { id: "p2", name: "Payments Gateway", tag: "PAY" },
];
const sprints: SprintRef[] = [
  { id: "s1", number: 1, name: "Foundations", start_date: "2026-10-01", end_date: "2026-10-14" },
  { id: "s2", number: 2, name: null, start_date: "2026-10-15", end_date: "2026-10-28" },
];
const developers: DeveloperRef[] = [
  { id: "d1", name: "Ada Lovelace", email: "ada@x.io", is_active: true },
];

function renderToolbar(initial: Partial<TaskFilterState> = {}) {
  const onChange = vi.fn();
  function Harness() {
    const [filters, setFilters] = useState<TaskFilterState>({ ...EMPTY_FILTERS, ...initial });
    return (
      <TaskFilterToolbar
        filters={filters}
        onChange={(changes) => {
          onChange(changes);
          setFilters((f) => ({ ...f, ...changes }));
        }}
        products={products}
        sprints={filters.product_id ? sprints : []}
        developers={developers}
      />
    );
  }
  render(<Harness />);
  return { onChange, user: userEvent.setup() };
}

describe("TaskFilterToolbar", () => {
  it("disables the sprint filter until a product is chosen", () => {
    renderToolbar();
    expect(screen.getByRole("button", { name: /filter by sprint/i })).toBeDisabled();
    expect(screen.queryByLabelText("Active filters")).not.toBeInTheDocument();
  });

  it("choosing a product resets the sprint and enables the sprint filter", async () => {
    const { onChange, user } = renderToolbar({ product_id: "p2", sprint_id: "s1" });
    await user.click(screen.getByRole("button", { name: "Product: PAY" }));
    await user.click(await screen.findByRole("option", { name: /Learning Platform/ }));

    expect(onChange).toHaveBeenLastCalledWith({ product_id: "p1", sprint_id: "" });
    expect(screen.getByRole("button", { name: /filter by sprint/i })).toBeEnabled();
  });

  it("shows a chip per active filter and removing the product chip also clears its sprint", async () => {
    const { onChange, user } = renderToolbar({
      product_id: "p1",
      sprint_id: "s2",
      developer_id: "unassigned",
      severity: ["Critical", "High"],
      overdue: true,
    });
    const chips = within(screen.getByLabelText("Active filters"));
    expect(chips.getByText("Product: LEARN")).toBeInTheDocument();
    expect(chips.getByText("Sprint: S2")).toBeInTheDocument();
    expect(chips.getByText("Assignee: Unassigned")).toBeInTheDocument();
    expect(chips.getByText("Severity: Critical, High")).toBeInTheDocument();
    expect(chips.getByText("Overdue only")).toBeInTheDocument();

    await user.click(chips.getByRole("button", { name: "Remove filter Product: LEARN" }));
    expect(onChange).toHaveBeenLastCalledWith({ product_id: "", sprint_id: "" });
    expect(chips.queryByText("Sprint: S2")).not.toBeInTheDocument();
  });

  it("supports multi-select for status", async () => {
    const { onChange, user } = renderToolbar();
    await user.click(screen.getByRole("button", { name: /filter by status/i }));
    await user.click(await screen.findByRole("option", { name: /Blocked/ }));
    await user.click(screen.getByRole("option", { name: /Done/ }));
    expect(onChange).toHaveBeenLastCalledWith({ status: ["Blocked", "Done"] });
  });

  it("Clear all resets every filter", async () => {
    const { onChange, user } = renderToolbar({ q: "login", status: ["Done"], overdue: true });
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onChange).toHaveBeenLastCalledWith(EMPTY_FILTERS);
    expect(screen.queryByLabelText("Active filters")).not.toBeInTheDocument();
  });
});
