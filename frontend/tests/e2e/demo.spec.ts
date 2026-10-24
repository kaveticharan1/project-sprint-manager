import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * Records a short product tour to /docs/demo.webm (`npm run demo`). Expects the seed data.
 * The one change it makes (a task status) is reverted at the end.
 */

const API = "http://localhost:8000/api/v1";
const OUT = path.resolve(__dirname, "../../../docs/demo.webm");

test.use({
  viewport: { width: 1280, height: 800 },
  video: { mode: "on", size: { width: 1280, height: 800 } },
});

test("product tour", async ({ page, request }) => {
  const pause = (ms = 1200) => page.waitForTimeout(ms);
  const task = (await (await request.get(`${API}/tasks`, { params: { q: "LEARN-108" } })).json())
    .items[0];

  try {
    await page.goto("/");
    await expect(page.getByText("Tasks by status")).toBeVisible();
    await pause(2000);
    await page.mouse.wheel(0, 500);
    await pause();
    await page.mouse.wheel(0, -500);

    // Drill down from the dashboard into the filtered task list.
    await page
      .getByRole("link", { name: /^Tasks/ })
      .first()
      .click();
    await expect(page.getByRole("row").nth(1)).toBeVisible();
    await pause();
    await page.getByRole("button", { name: "Filter by severity" }).click();
    await page.getByRole("option", { name: "Critical" }).click();
    await page.keyboard.press("Escape");
    await pause();
    await page.getByLabel("Search tasks").fill("login");
    await pause(1500);
    await page.getByRole("button", { name: "Clear all" }).click();
    await pause();

    // Open a task in the side sheet.
    await page.getByRole("button", { name: "LEARN-108", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await pause(2000);
    await page.keyboard.press("Escape");

    // Inline status edit with optimistic update.
    await page.getByRole("combobox", { name: "Status of LEARN-108" }).click();
    await page.getByRole("option", { name: "In Progress" }).click();
    await pause(1500);

    // Kanban board.
    await page.getByRole("radio", { name: "Board view" }).click();
    await expect(page.getByRole("region", { name: /^Done column/ })).toBeVisible();
    await pause(2000);

    // Sprint and product pages.
    await page.getByRole("link", { name: "Sprints" }).first().click();
    await expect(page.getByRole("heading", { name: "Learning Platform" })).toBeVisible();
    await pause();
    await page.getByRole("link", { name: "Sprint 2" }).first().click();
    await expect(page.getByText("Progress", { exact: true })).toBeVisible();
    await pause(2000);
    await page.getByRole("link", { name: "Products" }).first().click();
    await page.getByRole("link", { name: "Payments Gateway" }).click();
    await pause(1500);

    // Dark mode.
    await page.getByRole("button", { name: "Toggle dark mode" }).click();
    await pause(1500);
    await page.getByRole("link", { name: "Dashboard" }).first().click();
    await pause(2000);
  } finally {
    await request.patch(`${API}/tasks/${task.id}/status`, { data: { status: task.status } });
  }

  await page.close();
  await page.video()?.saveAs(OUT);
});
