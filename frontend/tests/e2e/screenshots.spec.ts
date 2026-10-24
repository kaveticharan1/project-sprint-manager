import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

/**
 * Captures the README screenshots into /docs/screenshots. Expects the seeded sample data
 * (`npm run seed`). Read-only: nothing is created or changed.
 */

const API = "http://localhost:8000/api/v1";
const OUT = path.resolve(__dirname, "../../../docs/screenshots");

async function shot(page: Page, name: string, fullPage = false) {
  // Let charts, fonts and toasts settle.
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
}

async function idFor(page: Page, url: string): Promise<string> {
  const response = await page.request.get(`${API}${url}`);
  return (await response.json()).items[0].id;
}

test.describe.configure({ mode: "serial" });

test("dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Tasks by status")).toBeVisible();
  await expect(page.getByText("Recently updated")).toBeVisible();
  await shot(page, "01-dashboard", true);
});

test("tasks table with filters", async ({ page }) => {
  const learn = await idFor(page, "/products?q=LEARN");
  await page.goto(
    `/tasks?product_id=${learn}&status=To+Do&status=In+Progress&status=Blocked&sort=severity`,
  );
  await expect(page.getByText("Product: LEARN")).toBeVisible();
  await expect(page.getByRole("row").nth(1)).toBeVisible();
  await shot(page, "02-tasks-filtered");
});

test("task form", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByRole("main").getByRole("button", { name: "New task" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Add password reset flow");
  await dialog
    .getByLabel("Description")
    .fill("Users can request a reset link by email; link expires after 1 hour.");
  await dialog.getByRole("combobox", { name: "Product" }).click();
  await page.getByRole("option", { name: /Learning Platform/ }).click();
  await dialog.getByRole("combobox", { name: "Sprint" }).click();
  await page.getByRole("option", { name: /Sprint 2/ }).click();
  await dialog.getByRole("combobox", { name: "Severity" }).click();
  await page.getByRole("option", { name: "High" }).click();
  await shot(page, "03-task-form");
});

test("validation errors", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByRole("main").getByRole("button", { name: "New task" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Create task" }).click();
  await expect(page.getByText("Title must be at least 3 characters")).toBeVisible();
  await shot(page, "04-validation-errors");
});

test("task detail sheet", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByRole("button", { name: "PAY-104", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Refund API endpoint").first()).toBeVisible();
  await shot(page, "05-task-detail");
});

test("sprint detail", async ({ page }) => {
  const pay = await idFor(page, "/products?q=PAY");
  const sprint = await idFor(page, `/sprints?product_id=${pay}&state=Active`);
  await page.goto(`/sprints/${sprint}`);
  await expect(page.getByText("Progress", { exact: true })).toBeVisible();
  await expect(page.getByRole("row").nth(1)).toBeVisible();
  await shot(page, "06-sprint-detail");
});

test("product detail", async ({ page }) => {
  const learn = await idFor(page, "/products?q=LEARN");
  await page.goto(`/products/${learn}?tab=sprints`);
  await expect(page.getByRole("link", { name: "Sprint 1" })).toBeVisible();
  await shot(page, "07-product-detail");
});

test("developers", async ({ page }) => {
  await page.goto("/developers");
  await expect(page.getByText("Emma Johansson")).toBeVisible();
  await shot(page, "08-developers");
});

test("blocked delete dialog", async ({ page }) => {
  await page.goto("/developers");
  await page.getByRole("button", { name: "Actions for Marcus Chen" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByText("Marcus Chen can't be deleted")).toBeVisible();
  await shot(page, "09-delete-blocked");
});

test("sprints", async ({ page }) => {
  await page.goto("/sprints");
  await expect(page.getByText("Learning Platform")).toBeVisible();
  await shot(page, "10-sprints");
});

test("kanban board", async ({ page }) => {
  await page.goto("/tasks?view=board");
  await expect(page.getByRole("region", { name: /^In Progress column/ })).toBeVisible();
  await shot(page, "11-kanban-board");
});

test("dark mode", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.goto("/");
  await expect(page.getByText("Tasks by status")).toBeVisible();
  await shot(page, "12-dark-mode-dashboard");
  await page.goto("/tasks");
  await expect(page.getByRole("row").nth(1)).toBeVisible();
  await shot(page, "13-dark-mode-tasks");
});

test("tablet layout", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/tasks");
  await expect(page.getByRole("row").nth(1)).toBeVisible();
  await shot(page, "14-tablet-tasks");
});
