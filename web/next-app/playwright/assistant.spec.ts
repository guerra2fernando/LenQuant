import { test, expect } from "@playwright/test";

test.describe("Assistant Workspace", () => {
  test("renders chat controls and quick prompts", async ({ page }) => {
    await page.goto("/assistant");
    await expect(page.getByRole("heading", { name: "Assistant Workspace" })).toBeVisible();
    await expect(page.getByLabel("Ask the assistant")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
    await expect(page.getByText("Quick prompts")).toBeVisible();
  });
});

