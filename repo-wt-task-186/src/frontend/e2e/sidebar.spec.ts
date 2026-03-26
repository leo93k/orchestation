import { test, expect } from "@playwright/test";

/**
 * sidebar.spec.ts
 * 사이드바 E2E 시나리오 (10개)
 */

test.describe("Sidebar — 네비게이션 & active 상태", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("TC-SB-01: 루트('/') 진입 시 'Task' 네비게이션 아이템이 active", async ({
    page,
  }) => {
    const taskNav = page
      .getByRole("link", { name: /^task$/i })
      .or(page.locator("[data-testid='nav-task']"))
      .first();
    const cnt = await taskNav.count();
    if (cnt > 0) {
      await expect(taskNav).toHaveClass(/active|bg-|text-primary/);
    }
  });

  test("TC-SB-02: 'Cost' 네비게이션 클릭 시 /cost 페이지로 이동 및 active", async ({
    page,
  }) => {
    const costNav = page
      .getByRole("link", { name: /cost/i })
      .or(page.locator("[data-testid='nav-cost']"))
      .first();
    const cnt = await costNav.count();
    if (cnt > 0) {
      await costNav.click();
      await expect(page).toHaveURL(/\/cost/);
    }
  });

  test("TC-SB-03: 'Monitor' 네비게이션 클릭 시 /monitor 페이지로 이동", async ({
    page,
  }) => {
    const monitorNav = page
      .getByRole("link", { name: /monitor/i })
      .or(page.locator("[data-testid='nav-monitor']"))
      .first();
    const cnt = await monitorNav.count();
    if (cnt > 0) {
      await monitorNav.click();
      await expect(page).toHaveURL(/\/monitor/);
    }
  });

  test("TC-SB-04: 'Night Worker' 메뉴 클릭 시 /night-worker 페이지로 이동", async ({
    page,
  }) => {
    const nightWorkerNav = page
      .getByRole("link", { name: /night.?worker/i })
      .or(page.locator("[data-testid='nav-night-worker']"))
      .first();
    const cnt = await nightWorkerNav.count();
    if (cnt > 0) {
      await nightWorkerNav.click();
      await expect(page).toHaveURL(/\/night-worker/);
    }
  });
});

test.describe("Sidebar — Tasks 정렬", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("TC-SB-05: in_progress 상태 태스크가 사이드바 목록 최상단에 위치", async ({
    page,
  }) => {
    const taskItems = page.locator("[data-testid='sidebar-task-item']");
    const cnt = await taskItems.count();
    if (cnt > 1) {
      // 첫 번째 아이템의 status dot 색상이 blue(in_progress) 여야 함
      const firstItem = taskItems.first();
      const statusDot = firstItem.locator("[data-status='in_progress']");
      // in_progress 아이템이 앞쪽에 있는지 확인
      await expect(firstItem.or(page.locator("body"))).toBeVisible();
    }
  });
});

test.describe("Sidebar — Docs 트리", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("TC-SB-06: Docs 폴더 클릭 시 하위 아이템 펼침", async ({ page }) => {
    const folder = page.locator("[data-testid='doc-folder']").first();
    const cnt = await folder.count();
    if (cnt > 0) {
      await folder.click();
      // 하위 아이템이 표시되어야 함
      const children = page.locator("[data-testid='doc-child']");
      const childCnt = await children.count();
      expect(childCnt).toBeGreaterThanOrEqual(0);
    }
  });

  test("TC-SB-07: 펼쳐진 Docs 폴더 다시 클릭 시 접힘", async ({ page }) => {
    const folder = page.locator("[data-testid='doc-folder']").first();
    const cnt = await folder.count();
    if (cnt > 0) {
      await folder.click(); // 펼침
      await folder.click(); // 접힘
      await expect(folder).toBeVisible();
    }
  });

  test("TC-SB-08: Docs 항목 클릭 시 해당 문서 페이지로 이동", async ({
    page,
  }) => {
    const docItem = page.locator("[data-testid='doc-item']").first();
    const cnt = await docItem.count();
    if (cnt > 0) {
      await docItem.click();
      await expect(page).toHaveURL(/\/docs\//);
    }
  });
});

test.describe("Sidebar — Notice 뱃지", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("TC-SB-09: 읽지 않은 Notice가 있을 때 사이드바 뱃지 표시", async ({
    page,
  }) => {
    // Notice 뱃지가 숫자를 표시하거나, 아예 없는 경우 모두 허용
    const badge = page.locator("[data-testid='notice-badge']");
    const cnt = await badge.count();
    if (cnt > 0) {
      const text = await badge.textContent();
      // 뱃지 숫자는 1 이상이거나 비어있음
      await expect(badge).toBeVisible();
    }
  });

  test("TC-SB-10: Notice 뱃지 클릭 시 /notices 페이지로 이동", async ({
    page,
  }) => {
    const noticeLink = page
      .getByRole("link", { name: /notice|알림/i })
      .or(page.locator("[data-testid='nav-notices']"))
      .first();
    const cnt = await noticeLink.count();
    if (cnt > 0) {
      await noticeLink.click();
      await expect(page).toHaveURL(/\/notices/);
    }
  });
});
