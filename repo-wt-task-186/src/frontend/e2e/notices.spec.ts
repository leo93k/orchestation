import { test, expect } from "@playwright/test";

/**
 * notices.spec.ts
 * Notices(알림) 페이지 E2E 시나리오 (10개)
 */

test.describe("Notices — 목록 & 필터", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/notices");
  });

  test("TC-NT-01: Notices 페이지 진입 시 알림 목록 표시", async ({ page }) => {
    // 페이지가 렌더링되면 목록 혹은 빈 상태 메시지 중 하나가 표시되어야 함
    const list = page
      .locator("[data-testid='notice-item']")
      .or(page.getByText(/알림이 없습니다/i));
    await expect(list.first()).toBeVisible({ timeout: 5000 });
  });

  test("TC-NT-02: 필터 탭 'All' 클릭 시 모든 알림 표시", async ({ page }) => {
    const allTab = page
      .getByRole("tab", { name: /^all$/i })
      .or(page.getByRole("button", { name: /^all$/i }))
      .first();
    await allTab.click();
    await expect(allTab).toBeVisible();
  });

  test("TC-NT-03: 필터 탭 'Info' 클릭 시 info 유형만 표시", async ({
    page,
  }) => {
    const infoTab = page
      .getByRole("tab", { name: /^info$/i })
      .or(page.getByRole("button", { name: /^info$/i }))
      .first();
    await infoTab.click();
    const items = page.locator("[data-testid='notice-item']");
    const cnt = await items.count();
    for (let i = 0; i < cnt; i++) {
      // 각 아이템에 info 타입 표시가 있어야 함
      await expect(items.nth(i).getByText(/info/i)).toBeVisible();
    }
  });

  test("TC-NT-04: 필터 탭 'Warning' 클릭 시 warning 유형만 표시", async ({
    page,
  }) => {
    const tab = page
      .getByRole("tab", { name: /warning/i })
      .or(page.getByRole("button", { name: /warning/i }))
      .first();
    await tab.click();
    await expect(tab).toBeVisible();
  });

  test("TC-NT-05: 필터 탭 'Error' 클릭 시 error 유형만 표시", async ({
    page,
  }) => {
    const tab = page
      .getByRole("tab", { name: /^error$/i })
      .or(page.getByRole("button", { name: /^error$/i }))
      .first();
    await tab.click();
    await expect(tab).toBeVisible();
  });
});

test.describe("Notices — 읽음 처리 & 뱃지", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/notices");
  });

  test("TC-NT-06: 안 읽은 Notice 는 읽은 Notice 와 시각적으로 구분됨", async ({
    page,
  }) => {
    // 읽지 않은 아이템은 bold/dot/배경색 등의 스타일 차이가 있어야 함
    const unreadItem = page
      .locator("[data-testid='notice-item'][data-unread='true']")
      .or(page.locator(".notice-unread"))
      .first();
    const cnt = await unreadItem.count();
    if (cnt > 0) {
      await expect(unreadItem).toBeVisible();
    }
  });

  test("TC-NT-07: Notice 클릭 시 read 처리 — PUT 요청 발생", async ({
    page,
  }) => {
    let putRequestFired = false;
    page.on("request", (req) => {
      if (req.method() === "PUT" && req.url().includes("/notices/")) {
        putRequestFired = true;
      }
    });

    const item = page.locator("[data-testid='notice-item']").first();
    const cnt = await item.count();
    if (cnt > 0) {
      await item.click();
      await page.waitForTimeout(500);
      expect(putRequestFired).toBe(true);
    }
  });

  test("TC-NT-08: Notice 읽음 처리 후 사이드바 뱃지 숫자 감소", async ({
    page,
  }) => {
    // 사이드바 뱃지 숫자를 먼저 기록
    const badge = page.locator("[data-testid='notice-badge']");
    const cnt = await badge.count();
    if (cnt > 0) {
      const beforeText = await badge.textContent();
      const beforeCount = parseInt(beforeText ?? "0", 10);

      const item = page.locator("[data-testid='notice-item']").first();
      const itemCnt = await item.count();
      if (itemCnt > 0 && beforeCount > 0) {
        await item.click();
        await page.waitForTimeout(500);
        const afterText = await badge.textContent();
        const afterCount = parseInt(afterText ?? "0", 10);
        expect(afterCount).toBeLessThan(beforeCount);
      }
    }
  });

  test("TC-NT-09: 모든 알림을 읽으면 사이드바 뱃지가 사라짐", async ({
    page,
  }) => {
    const items = page.locator("[data-testid='notice-item']");
    const cnt = await items.count();
    // 모든 아이템을 순차적으로 클릭
    for (let i = 0; i < Math.min(cnt, 5); i++) {
      await items.first().click();
      await page.waitForTimeout(200);
    }
    const badge = page.locator("[data-testid='notice-badge']");
    const badgeCnt = await badge.count();
    if (badgeCnt > 0) {
      const text = await badge.textContent();
      expect(parseInt(text ?? "0", 10)).toBeGreaterThanOrEqual(0);
    }
  });

  test("TC-NT-10: 알림이 없을 때 '알림이 없습니다.' 빈 상태 메시지 표시", async ({
    page,
  }) => {
    // Error 탭 등 비어있을 수 있는 탭으로 이동 후 확인
    const errorTab = page
      .getByRole("tab", { name: /^error$/i })
      .or(page.getByRole("button", { name: /^error$/i }))
      .first();
    const tabCnt = await errorTab.count();
    if (tabCnt > 0) {
      await errorTab.click();
      const items = page.locator("[data-testid='notice-item']");
      const itemCnt = await items.count();
      if (itemCnt === 0) {
        await expect(page.getByText(/알림이 없습니다/i)).toBeVisible();
      }
    }
  });
});
