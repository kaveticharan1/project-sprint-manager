import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end smoke test against the running app and API:
 * create a product -> a sprint -> a task, then find the task with filters.
 * Everything it creates uses a unique tag and is deleted afterwards.
 */

const API = "http://localhost:8000/api/v1";
const suffix = String(Date.now()).slice(-4);
const TAG = `E2E${suffix}`;
const PRODUCT = `E2E Smoke ${suffix}`;
const TITLE = `Smoke test task ${suffix}`;

/** Day button in the open date picker, e.g. "October 24th, 2026". */
function dayButton(page: Page, date: Date) {
  const day = date.getDate();
  const ordinal =
    ["th", "st", "nd", "rd"][day % 100 > 10 && day % 100 < 14 ? 0 : Math.min(day % 10, 4) % 4] ??
    "th";
  const month = date.toLocaleString("en-US", { month: "long" });
  return page.getByRole("button", {
    name: new RegExp(`${month} ${day}${ordinal}, ${date.getFullYear()}`),
  });
}

test.afterAll(async ({ request }) => {
  const products = await (await request.get(`${API}/products`, { params: { q: TAG } })).json();
  for (const product of products.items) {
    const tasks = await (await request.get(`${API}/products/${product.id}/tasks`)).json();
    for (const task of tasks.items) await request.delete(`${API}/tasks/${task.id}`);
    const sprints = await (await request.get(`${API}/products/${product.id}/sprints`)).json();
    for (const sprint of sprints.items) await request.delete(`${API}/sprints/${sprint.id}`);
    await request.delete(`${API}/products/${product.id}`);
  }
});

test("create product, sprint and task, then filter to it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. Product
  await page.goto("/products");
  await page.getByRole("button", { name: "New product" }).click();
  const productDialog = page.getByRole("dialog");
  await productDialog.getByLabel("Name").fill(PRODUCT);
  await productDialog.getByLabel("Tag").fill(TAG.toLowerCase()); // auto-uppercased
  await expect(productDialog.getByLabel("Tag")).toHaveValue(TAG);
  await productDialog.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByText(`Created ${PRODUCT} (${TAG})`)).toBeVisible();
  await page.getByRole("link", { name: PRODUCT }).click();
  await expect(page.getByRole("heading", { name: PRODUCT })).toBeVisible();

  // 2. Sprint (today -> today, the smallest valid range)
  const today = new Date();
  await page.getByRole("button", { name: "New sprint" }).first().click();
  const sprintDialog = page.getByRole("dialog");
  await sprintDialog.getByLabel("Name").fill("Smoke sprint");
  await sprintDialog.getByRole("button", { name: "Start date" }).click();
  await dayButton(page, today).click();
  await sprintDialog.getByRole("button", { name: "End date" }).click();
  await dayButton(page, today).click();
  await sprintDialog.getByRole("button", { name: "Create sprint" }).click();
  await expect(page.getByText(`Created ${TAG} · Sprint 1`)).toBeVisible();

  // 3. Task (product preselected from the product page; dates prefilled from the sprint)
  await page.getByRole("main").getByRole("button", { name: "New task" }).click();
  const taskDialog = page.getByRole("dialog");
  await taskDialog.getByLabel("Title").fill(TITLE);
  await expect(taskDialog.getByRole("combobox", { name: "Product" })).toContainText(PRODUCT);
  await taskDialog.getByRole("combobox", { name: "Sprint" }).click();
  await page.getByRole("option", { name: /Sprint 1/ }).click();
  await taskDialog.getByRole("combobox", { name: "Severity" }).click();
  await page.getByRole("option", { name: "Critical" }).click();
  await taskDialog.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByText(`Created ${TAG}-101`)).toBeVisible();

  // 4. Filter the task list down to it
  await page.goto("/tasks");
  await page.getByRole("button", { name: "Filter by product" }).click();
  await page.getByPlaceholder("Search product…").fill(TAG);
  await page.getByRole("option", { name: new RegExp(PRODUCT) }).click();
  await page.getByRole("button", { name: "Filter by severity" }).click();
  await page.getByRole("option", { name: "Critical" }).click();
  await page.keyboard.press("Escape");

  await expect(page).toHaveURL(/product_id=.+severity=Critical/);
  const rows = page.getByRole("row").filter({ hasText: TITLE });
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(`${TAG}-101`);
  await expect(page.getByText("Showing 1–1 of 1 tasks")).toBeVisible();

  // Search narrows further and survives a reload (filters live in the URL).
  await page.getByLabel("Search tasks").fill("no such task");
  await expect(page.getByText("No tasks match these filters")).toBeVisible();
  await page.reload();
  await expect(page.getByText("No tasks match these filters")).toBeVisible();

  expect(errors).toEqual([]);
});
