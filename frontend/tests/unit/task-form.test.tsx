import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskForm } from "@/components/tasks/task-form";
import type { Sprint, Task } from "@/lib/api/types";
import { taskDateErrors, taskSchema } from "@/lib/schemas";

// --- A fake API at the client boundary, so the form's real hooks and queries run. ---------

const products = [
  { id: "p1", name: "Learning Platform", tag: "LEARN" },
  { id: "p2", name: "Payments Gateway", tag: "PAY" },
];
const sprint = (id: string, product_id: string, number: number, start: string, end: string) =>
  ({ id, product_id, number, name: null, start_date: start, end_date: end }) as Sprint;
const sprints = [
  sprint("s1", "p1", 1, "2026-10-01", "2026-10-14"),
  sprint("s2", "p1", 2, "2026-10-15", "2026-10-28"),
  sprint("s7", "p2", 7, "2026-10-01", "2026-10-31"),
];
const page = <T,>(items: T[]) => ({
  items,
  total: items.length,
  page: 1,
  page_size: 200,
  pages: 1,
});

const apiMock = vi.fn();
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  api: (...args: unknown[]) => apiMock(...args),
}));

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockImplementation(
    async (path: string, opts: { params?: Record<string, string> } = {}) => {
      if (path === "/products") return page(products);
      if (path === "/developers") return page([]);
      if (path === "/sprints")
        return page(sprints.filter((s) => s.product_id === opts.params?.product_id));
      throw new Error(`Unexpected API call ${path}`);
    },
  );
});

function renderForm(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return userEvent.setup();
}

const sprintOptionNames = () => screen.getAllByRole("option").map((o) => o.textContent ?? "");

// --- Component behaviour -------------------------------------------------------------------

describe("TaskForm sprint selection", () => {
  it("keeps the sprint disabled until a product is chosen, then lists only that product's sprints", async () => {
    const user = renderForm(<TaskForm onSaved={vi.fn()} />);
    const sprintSelect = screen.getByRole("combobox", { name: /sprint/i });
    expect(sprintSelect).toBeDisabled();
    expect(sprintSelect).toHaveTextContent("Select a product first");

    await user.click(screen.getByRole("combobox", { name: /product/i }));
    await user.click(await screen.findByRole("option", { name: /Learning Platform/ }));

    await waitFor(() => expect(sprintSelect).toBeEnabled());
    expect(apiMock).toHaveBeenCalledWith(
      "/sprints",
      expect.objectContaining({
        params: expect.objectContaining({ product_id: "p1" }),
      }),
    );
    await user.click(sprintSelect);
    const names = sprintOptionNames();
    expect(names.some((n) => n.includes("Sprint 1"))).toBe(true);
    expect(names.some((n) => n.includes("Sprint 2"))).toBe(true);
    expect(names.some((n) => n.includes("Sprint 7"))).toBe(false);
  });

  it("resets the chosen sprint when the product changes", async () => {
    const user = renderForm(<TaskForm onSaved={vi.fn()} />);
    await user.click(screen.getByRole("combobox", { name: /product/i }));
    await user.click(await screen.findByRole("option", { name: /Learning Platform/ }));
    const sprintSelect = screen.getByRole("combobox", { name: /sprint/i });
    await waitFor(() => expect(sprintSelect).toBeEnabled());
    await user.click(sprintSelect);
    await user.click(screen.getByRole("option", { name: /Sprint 2/ }));
    expect(sprintSelect).toHaveTextContent("Sprint 2");

    await user.click(screen.getByRole("combobox", { name: /product/i }));
    await user.click(await screen.findByRole("option", { name: /Payments Gateway/ }));
    await waitFor(() => expect(sprintSelect).toHaveTextContent("Select a sprint"));
    await user.click(sprintSelect);
    expect(sprintOptionNames().every((n) => n.includes("Sprint 7"))).toBe(true);
  });

  it("shows required-field errors and sends nothing when submitted empty", async () => {
    const user = renderForm(<TaskForm onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Create task" }));
    expect(await screen.findByText("Title must be at least 3 characters")).toBeInTheDocument();
    expect(screen.getByText("Choose a product")).toBeInTheDocument();
    expect(screen.getByText("Choose a sprint")).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalledWith("/tasks", expect.anything());
  });
});

describe("TaskForm date validation", () => {
  const baseTask = {
    id: "t1",
    number: "LEARN-101",
    title: "Existing task",
    description: null,
    product_id: "p1",
    sprint_id: "s2",
    developer_id: null,
    product: products[0],
    sprint: sprints[1],
    developer: null,
    severity: "Medium",
    status: "To Do",
    is_overdue: false,
    created_at: "2026-10-15T00:00:00Z",
    updated_at: "2026-10-15T00:00:00Z",
  } as const;

  it("rejects an end date before the start date", async () => {
    const task = { ...baseTask, start_date: "2026-10-20", end_date: "2026-10-16" } as Task;
    const user = renderForm(<TaskForm task={task} onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(
      await screen.findByText("End date must be on or after the start date"),
    ).toBeInTheDocument();
  });

  it("rejects dates outside the selected sprint without calling the API", async () => {
    const task = { ...baseTask, start_date: "2026-10-02", end_date: "2026-10-05" } as Task;
    const user = renderForm(<TaskForm task={task} onSaved={vi.fn()} />);
    // Wait until the sprint list (and so the sprint's range) has loaded.
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /sprint/i })).toHaveTextContent("Sprint 2"),
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    const errors = await screen.findAllByText(/Outside the sprint/);
    expect(errors).toHaveLength(2);
    expect(apiMock).not.toHaveBeenCalledWith("/tasks/t1", expect.anything());
  });
});

// --- Pure validation rules -----------------------------------------------------------------

describe("task validation rules", () => {
  const valid = {
    title: "Write docs",
    description: "",
    product_id: "p1",
    sprint_id: "s1",
    developer_id: "",
    severity: "Low",
    status: "To Do",
    start_date: "2026-10-02",
    end_date: "2026-10-03",
  };

  it("accepts a valid task and normalises optional fields", () => {
    const parsed = taskSchema.parse(valid);
    expect(parsed.description).toBeNull();
    expect(parsed.developer_id).toBeNull();
  });

  it("rejects unknown severities and statuses", () => {
    expect(taskSchema.safeParse({ ...valid, severity: "Urgent" }).success).toBe(false);
    expect(taskSchema.safeParse({ ...valid, status: "Doing" }).success).toBe(false);
  });

  it("flags each date outside the sprint range, inclusive bounds allowed", () => {
    expect(
      taskDateErrors({ start_date: "2026-10-01", end_date: "2026-10-14" }, sprints[0]),
    ).toEqual({});
    const errors = taskDateErrors({ start_date: "2026-09-30", end_date: "2026-10-15" }, sprints[0]);
    expect(Object.keys(errors).sort()).toEqual(["end_date", "start_date"]);
    expect(taskDateErrors({ start_date: "2020-01-01", end_date: "2020-01-02" }, undefined)).toEqual(
      {},
    );
  });
});
