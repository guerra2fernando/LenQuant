import { test, expect } from "@playwright/test";

type Route = {
  fulfill: (options: { status: number; body: string }) => Promise<void>;
  request(): { url(): string };
};

test.describe("Intraday Cohorts Dashboard", () => {
  test("navigates to cohorts page and renders dashboard", async ({ page }) => {
    await page.goto("/trading/cohorts");
    
    // Check main heading
    await expect(page.getByRole("heading", { name: "Intraday Cohorts" })).toBeVisible();
    
    // Check description text
    await expect(
      page.getByText("Track multi-agent intraday experiments")
    ).toBeVisible();
    
    // Check refresh button exists
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
  });

  test("displays empty state when no cohorts exist", async ({ page }) => {
    // Mock API to return empty cohorts
    await page.route("**/api/experiments/cohorts*", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohorts: [],
          pagination: {
            page: 1,
            page_size: 5,
            total_pages: 0,
            total: 0,
          },
        }),
      });
    });

    await page.goto("/trading/cohorts");
    
    // Should show empty state
    await expect(
      page.getByText("No intraday cohorts yet")
    ).toBeVisible();
  });

  test("displays cohort list with summary metrics", async ({ page }) => {
    // Mock API with sample cohort data
    await page.route("**/api/experiments/cohorts*", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohorts: [
            {
              cohort_id: "cohort-test-001",
              created_at: "2025-01-15T10:00:00Z",
              bankroll: 1000,
              agent_count: 30,
              allocation_policy: "equal",
              summary: {
                total_pnl: 50.5,
                total_roi: 0.0505,
                confidence_score: 0.75,
              },
              alerts: [],
              csv_url: "/api/experiments/cohorts/cohort-test-001/export.csv",
            },
          ],
          pagination: {
            page: 1,
            page_size: 5,
            total_pages: 1,
            total: 1,
          },
        }),
      });
    });

    await page.goto("/trading/cohorts");
    
    // Check cohort appears in table
    await expect(page.getByText("cohort-test-001")).toBeVisible();
    await expect(page.getByText("$50.50")).toBeVisible();
    await expect(page.getByText("5.05%")).toBeVisible();
  });

  test("selects cohort and displays detail view", async ({ page }) => {
    // Mock list endpoint
    await page.route("**/api/experiments/cohorts?*", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohorts: [
            {
              cohort_id: "cohort-test-001",
              created_at: "2025-01-15T10:00:00Z",
              bankroll: 1000,
              agent_count: 30,
              summary: {
                total_pnl: 50.5,
                total_roi: 0.0505,
              },
              alerts: [],
              csv_url: "/api/experiments/cohorts/cohort-test-001/export.csv",
            },
          ],
          pagination: { page: 1, page_size: 5, total_pages: 1, total: 1 },
        }),
      });
    });

    // Mock detail endpoint
    await page.route("**/api/experiments/cohorts/cohort-test-001", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohort: {
            cohort_id: "cohort-test-001",
            bankroll: 1000,
            agents: [],
            alerts: [],
          },
          summary: {
            total_pnl: 50.5,
            total_roi: 0.0505,
            best_agent: { strategy_id: "ema-cross-gen5", roi: 0.08 },
          },
          parent: {
            starting_balance: 1000,
            realized_pnl: 50.5,
            drawdown_pct: 0,
          },
          promotion: {
            ready: true,
            checks: [],
            recommended_allocation: 50,
            best_candidate: { strategy_id: "ema-cross-gen5" },
          },
        }),
      });
    });

    await page.goto("/trading/cohorts");
    
    // Wait for cohort to be visible
    await page.waitForSelector('text=cohort-test-001');
    
    // Check bankroll utilization card appears
    await expect(page.getByText("Bankroll Utilisation")).toBeVisible();
    
    // Check parent wallet snapshot appears
    await expect(page.getByText("Parent Wallet Snapshot")).toBeVisible();
  });

  test("filters cohorts by date", async ({ page }) => {
    await page.route("**/api/experiments/cohorts*", async (route: Route) => {
      const url = new URL(route.request().url());
      const dateParam = url.searchParams.get("date");
      
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohorts: dateParam ? [] : [
            {
              cohort_id: "cohort-test-001",
              created_at: "2025-01-15T10:00:00Z",
              bankroll: 1000,
              summary: {},
              alerts: [],
              csv_url: "/api/experiments/cohorts/cohort-test-001/export.csv",
            },
          ],
          pagination: { page: 1, page_size: 5, total_pages: 1, total: dateParam ? 0 : 1 },
        }),
      });
    });

    await page.goto("/trading/cohorts");
    
    // Initially shows cohort
    await expect(page.getByText("cohort-test-001")).toBeVisible();
    
    // Apply date filter
    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill("2025-01-10");
    
    // Wait for filter to apply (cohort should disappear)
    await page.waitForTimeout(500);
  });

  test("refreshes cohort data", async ({ page }) => {
    let requestCount = 0;
    
    await page.route("**/api/experiments/cohorts*", async (route: Route) => {
      requestCount++;
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohorts: [],
          pagination: { page: 1, page_size: 5, total_pages: 0, total: 0 },
        }),
      });
    });

    await page.goto("/trading/cohorts");
    
    const initialCount = requestCount;
    
    // Click refresh button
    await page.getByRole("button", { name: "Refresh" }).click();
    
    // Should trigger new request
    await page.waitForTimeout(300);
    expect(requestCount).toBeGreaterThan(initialCount);
  });

  test("displays guard rail progress indicator", async ({ page }) => {
    await page.route("**/api/experiments/cohorts?*", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohorts: [{
            cohort_id: "cohort-test-001",
            created_at: "2025-01-15T10:00:00Z",
            bankroll: 1000,
            summary: {},
            alerts: [],
            csv_url: "/api/experiments/cohorts/cohort-test-001/export.csv",
          }],
          pagination: { page: 1, page_size: 5, total_pages: 1, total: 1 },
        }),
      });
    });

    await page.route("**/api/experiments/cohorts/cohort-test-001", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohort: {
            cohort_id: "cohort-test-001",
            bankroll: 1000,
            agents: [],
            alerts: [],
          },
          summary: {},
          parent: {},
          promotion: {
            ready: false,
            checks: [
              { id: "check1", status: true, label: "Check 1" },
              { id: "check2", status: true, label: "Check 2" },
              { id: "check3", status: false, label: "Check 3" },
            ],
            recommended_allocation: 50,
            best_candidate: {},
          },
        }),
      });
    });

    await page.goto("/trading/cohorts");
    await page.waitForSelector('text=cohort-test-001');
    
    // Should show guard rail progress
    await expect(page.getByText("Guard Rail Progress")).toBeVisible();
  });

  test("navigates to Day-3 promotion modal", async ({ page }) => {
    await page.route("**/api/experiments/cohorts?*", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohorts: [{
            cohort_id: "cohort-test-001",
            created_at: "2025-01-15T10:00:00Z",
            bankroll: 1000,
            summary: {},
            alerts: [],
            csv_url: "/api/experiments/cohorts/cohort-test-001/export.csv",
          }],
          pagination: { page: 1, page_size: 5, total_pages: 1, total: 1 },
        }),
      });
    });

    await page.route("**/api/experiments/cohorts/cohort-test-001", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohort: {
            cohort_id: "cohort-test-001",
            bankroll: 1000,
            agents: [],
            alerts: [],
          },
          summary: {},
          parent: {},
          promotion: {
            ready: true,
            checks: [],
            recommended_allocation: 50,
            best_candidate: {},
          },
        }),
      });
    });

    await page.goto("/trading/cohorts");
    await page.waitForSelector('text=cohort-test-001');
    
    // Click "Open Day-3 Modal" button
    const modalButton = page.getByRole("link", { name: "Open Day-3 Modal" });
    await expect(modalButton).toBeVisible();
  });

  test("displays promotion guard rails section", async ({ page }) => {
    await page.route("**/api/experiments/cohorts?*", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohorts: [{
            cohort_id: "cohort-test-001",
            created_at: "2025-01-15T10:00:00Z",
            bankroll: 1000,
            summary: {},
            alerts: [],
            csv_url: "/api/experiments/cohorts/cohort-test-001/export.csv",
          }],
          pagination: { page: 1, page_size: 5, total_pages: 1, total: 1 },
        }),
      });
    });

    await page.route("**/api/experiments/cohorts/cohort-test-001", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohort: {
            cohort_id: "cohort-test-001",
            bankroll: 1000,
            agents: [],
            alerts: [],
          },
          summary: {},
          parent: {},
          promotion: {
            ready: true,
            checks: [
              {
                id: "min_trade_count",
                label: "Minimum trades executed",
                status: true,
                value: 12,
                threshold: 6,
              },
            ],
            recommended_allocation: 50,
            best_candidate: {},
          },
        }),
      });
    });

    await page.goto("/trading/cohorts");
    await page.waitForSelector('text=cohort-test-001');
    
    // Check guard rails section
    await expect(page.getByText("Promotion Guard Rails")).toBeVisible();
    await expect(page.getByText("Minimum trades executed")).toBeVisible();
  });
});

test.describe("Day-3 Promotion Modal", () => {
  test("opens promotion modal from trading page", async ({ page }) => {
    // Mock cohorts list
    await page.route("**/api/experiments/cohorts?*", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohorts: [{
            cohort_id: "cohort-test-001",
            created_at: "2025-01-15T10:00:00Z",
            bankroll: 1000,
            summary: { confidence_score: 0.75, total_roi: 0.05, total_pnl: 50 },
            alerts: [],
          }],
          pagination: { page: 1, page_size: 5, total_pages: 1, total: 1 },
        }),
      });
    });

    // Mock cohort detail
    await page.route("**/api/experiments/cohorts/cohort-test-001", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohort: {
            cohort_id: "cohort-test-001",
            bankroll: 1000,
            agents: [],
            alerts: [],
          },
          summary: {
            total_pnl: 50,
            total_roi: 0.05,
            confidence_score: 0.75,
          },
          parent: {
            starting_balance: 1000,
            realized_pnl: 50,
            drawdown_pct: 0.05,
          },
          promotion: {
            ready: true,
            checks: [
              { id: "check1", status: true, label: "Check passed", value: 10, threshold: 6 },
            ],
            recommended_allocation: 50,
            recommended_bankroll_slice_pct: 0.05,
            best_candidate: {
              strategy_id: "ema-cross-gen5",
              metrics: { roi: 0.08, trade_count: 12 },
            },
          },
        }),
      });
    });

    // Mock trading summary
    await page.route("**/api/trading/summary", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          orders: [],
          fills: [],
          positions: [],
          risk: { open_exposure: {}, kill_switch: { armed: false } },
        }),
      });
    });

    await page.goto("/trading?promo=cohort-test-001");
    
    // Wait for modal to open
    await page.waitForSelector('text=Day-3 Promotion Review');
    
    // Check modal contents
    await expect(page.getByText("Day-3 Promotion Review")).toBeVisible();
    await expect(page.getByText("Guard Rails")).toBeVisible();
    await expect(page.getByText("Candidate")).toBeVisible();
  });

  test("displays guard rail checks in modal", async ({ page }) => {
    await page.route("**/api/experiments/cohorts?*", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohorts: [{
            cohort_id: "cohort-test-001",
            summary: { confidence_score: 0.75 },
          }],
          pagination: { page: 1, page_size: 5, total: 1 },
        }),
      });
    });

    await page.route("**/api/experiments/cohorts/cohort-test-001", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohort: { cohort_id: "cohort-test-001", bankroll: 1000, agents: [], alerts: [] },
          summary: { total_pnl: 50 },
          parent: { starting_balance: 1000 },
          promotion: {
            ready: false,
            checks: [
              { id: "trade_count", status: true, label: "Sufficient trades", value: 12, threshold: 6 },
              { id: "slippage", status: false, label: "Low slippage", value: 0.02, threshold: 0.01 },
            ],
            recommended_allocation: 50,
            best_candidate: { strategy_id: "test" },
          },
        }),
      });
    });

    await page.route("**/api/trading/summary", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          orders: [],
          risk: { open_exposure: {}, kill_switch: { armed: false } },
        }),
      });
    });

    await page.goto("/trading?promo=cohort-test-001");
    await page.waitForSelector('text=Day-3 Promotion Review');
    
    // Check individual guard rails
    await expect(page.getByText("Sufficient trades")).toBeVisible();
    await expect(page.getByText("Low slippage")).toBeVisible();
    
    // Check pass/fail badges
    await expect(page.getByText("Pass")).toBeVisible();
    await expect(page.getByText("Action")).toBeVisible();
  });

  test("requires risk acknowledgement before promotion", async ({ page }) => {
    await page.route("**/api/experiments/cohorts?*", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohorts: [{ cohort_id: "cohort-test-001", summary: {} }],
          pagination: { page: 1, page_size: 5, total: 1 },
        }),
      });
    });

    await page.route("**/api/experiments/cohorts/cohort-test-001", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohort: { cohort_id: "cohort-test-001", bankroll: 1000, agents: [], alerts: [] },
          summary: {},
          parent: {},
          promotion: {
            ready: true,
            checks: [],
            recommended_allocation: 50,
            best_candidate: {},
          },
        }),
      });
    });

    await page.route("**/api/trading/summary", async (route: Route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ orders: [], risk: {} }) });
    });

    await page.goto("/trading?promo=cohort-test-001");
    await page.waitForSelector('text=Day-3 Promotion Review');
    
    // Promote button should be disabled initially
    const promoteButton = page.getByRole("button", { name: "Promote" });
    await expect(promoteButton).toBeDisabled();
    
    // Check acknowledgement checkbox
    const checkbox = page.getByRole("checkbox");
    await checkbox.check();
    
    // Now button should be enabled
    await expect(promoteButton).toBeEnabled();
  });

  test("allows editing promotion parameters", async ({ page }) => {
    await page.route("**/api/experiments/cohorts?*", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohorts: [{ cohort_id: "cohort-test-001", summary: {} }],
          pagination: { page: 1, page_size: 5, total: 1 },
        }),
      });
    });

    await page.route("**/api/experiments/cohorts/cohort-test-001", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          cohort: { cohort_id: "cohort-test-001", bankroll: 1000, agents: [], alerts: [] },
          summary: {},
          parent: {},
          promotion: {
            ready: true,
            checks: [],
            recommended_allocation: 50,
            recommended_bankroll_slice_pct: 0.05,
            best_candidate: {},
          },
        }),
      });
    });

    await page.route("**/api/trading/summary", async (route: Route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ orders: [], risk: {} }) });
    });

    await page.goto("/trading?promo=cohort-test-001");
    await page.waitForSelector('text=Day-3 Promotion Review');
    
    // Find and edit bankroll slice input
    const sliceInput = page.locator('input[id="promotion-slice"]');
    await expect(sliceInput).toBeVisible();
    await sliceInput.fill("10");
    
    // Find and edit min allocation
    const minAllocInput = page.locator('input[id="promotion-min-allocation"]');
    await expect(minAllocInput).toBeVisible();
    await minAllocInput.fill("100");
  });
});

test.describe("Assistant Cohort Quick Actions", () => {
  test("launches intraday cohort from assistant page", async ({ page }) => {
    await page.route("**/api/assistant/history*", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ history: [] }),
      });
    });

    await page.route("**/api/assistant/recommendations*", async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ recommendations: [] }),
      });
    });

    let launchCalled = false;
    await page.route("**/api/experiments/cohorts/launch", async (route: Route) => {
      launchCalled = true;
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          status: "launched",
          cohort: {
            cohort_id: "new-cohort-001",
            bankroll: 1000,
            agent_count: 30,
          },
        }),
      });
    });

    await page.goto("/assistant");
    
    // Find bankroll input in quick actions
    const bankrollInput = page.locator('input[placeholder="Bankroll"]');
    await bankrollInput.fill("1000");
    
    // Click launch cohort button
    const launchButton = page.getByRole("button", { name: "Launch cohort" });
    await launchButton.click();
    
    // Wait for request
    await page.waitForTimeout(500);
    expect(launchCalled).toBe(true);
  });

  test("navigates to Day-3 review from assistant", async ({ page }) => {
    await page.route("**/api/assistant/history*", async (route: Route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ history: [] }) });
    });

    await page.route("**/api/assistant/recommendations*", async (route: Route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ recommendations: [] }) });
    });

    await page.goto("/assistant");
    
    // Click "Review Day-3 promotion" button
    const reviewButton = page.getByRole("button", { name: "Review Day-3 promotion" });
    await reviewButton.click();
    
    // Should navigate to trading page with promo param
    await page.waitForURL("**/trading?promo=*");
  });
});

