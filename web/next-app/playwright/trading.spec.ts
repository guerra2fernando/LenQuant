import { test, expect } from "@playwright/test";

test.describe("Trading Control Center", () => {
  test("navigates to trading page and renders core widgets", async ({ page }) => {
    await page.goto("/trading");
    await expect(page.getByRole("heading", { name: "Approval Wizard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Order Blotter" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Open Positions" })).toBeVisible();
  });

  test("opens risk dashboard", async ({ page }) => {
    await page.goto("/risk");
    await expect(page.getByRole("heading", { name: "Open Breaches" })).toBeVisible();
  });
});

