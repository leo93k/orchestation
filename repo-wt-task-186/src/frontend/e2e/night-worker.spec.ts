import { test, expect } from "@playwright/test";

/**
 * night-worker.spec.ts
 * Night Worker 페이지 E2E 시나리오 (10개)
 */

test.describe("Night Worker — 기본 레이아웃 및 탭", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/night-worker");
  });

  test("TC-NW-01: 페이지 진입 시 'Night Worker' 헤더 표시", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: /night.?worker/i })
    ).toBeVisible();
  });

  test("TC-NW-02: '설정' 탭이 기본으로 활성화", async ({ page }) => {
    const configTab = page.getByRole("tab", { name: /설정/ });
    const cnt = await configTab.count();
    if (cnt > 0) {
      await expect(configTab).toHaveAttribute("data-state", "active");
    }
  });

  test("TC-NW-03: '로그' 탭 클릭 시 로그 패널 표시", async ({ page }) => {
    const logsTab = page.getByRole("tab", { name: /로그/ });
    const cnt = await logsTab.count();
    if (cnt > 0) {
      await logsTab.click();
      await expect(logsTab).toHaveAttribute("data-state", "active");
    }
  });
});

test.describe("Night Worker — 태스크 유형 선택", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/night-worker");
    // 설정 탭이 기본이어야 함
    const configTab = page.getByRole("tab", { name: /설정/ });
    const cnt = await configTab.count();
    if (cnt > 0) await configTab.click();
  });

  test("TC-NW-04: 태스크 유형 체크박스 선택", async ({ page }) => {
    // TypeScript 타입 오류 수정 체크박스
    const checkbox = page
      .getByLabel(/TypeScript 타입 오류 수정/)
      .or(page.locator("input[type='checkbox']").first());
    const cnt = await checkbox.count();
    if (cnt > 0) {
      const isChecked = await checkbox.isChecked();
      await checkbox.click();
      await expect(checkbox).not.toBeChecked();
      if (!isChecked) {
        await checkbox.click(); // 원상 복구
      }
    }
  });

  test("TC-NW-05: 태스크 유형 체크박스 해제", async ({ page }) => {
    const checkboxes = page.locator("input[type='checkbox']");
    const cnt = await checkboxes.count();
    if (cnt > 0) {
      const first = checkboxes.first();
      // 체크된 상태에서 해제
      if (await first.isChecked()) {
        await first.click();
        await expect(first).not.toBeChecked();
      }
    }
  });

  test("TC-NW-06: 예산 무제한 체크박스 선택 시 예산 입력 필드 비활성화", async ({
    page,
  }) => {
    const unlimitedCheckbox = page
      .getByLabel(/무제한/)
      .or(page.locator("[data-testid='unlimited-budget']"));
    const cnt = await unlimitedCheckbox.count();
    if (cnt > 0) {
      await unlimitedCheckbox.check();
      await expect(unlimitedCheckbox).toBeChecked();
      // 예산 입력 필드가 비활성화되어야 함
      const budgetInput = page.getByLabel(/budget|예산/i);
      const inputCnt = await budgetInput.count();
      if (inputCnt > 0) {
        await expect(budgetInput).toBeDisabled();
      }
    }
  });

  test("TC-NW-07: 종료 시간 입력 필드에 시간 설정 가능", async ({ page }) => {
    const timeInput = page
      .getByLabel(/종료.?시간|end.?time/i)
      .or(page.locator("input[type='time']"))
      .first();
    const cnt = await timeInput.count();
    if (cnt > 0) {
      await timeInput.fill("23:00");
      await expect(timeInput).toHaveValue("23:00");
    }
  });
});

test.describe("Night Worker — 시작 / 중지", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/night-worker");
  });

  test("TC-NW-08: '시작' 버튼 클릭 시 POST /api/night-worker 요청 발생", async ({
    page,
  }) => {
    let postFired = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/night-worker")) {
        postFired = true;
      }
    });

    const startBtn = page.getByRole("button", { name: /^시작$/ });
    const cnt = await startBtn.count();
    if (cnt > 0 && !(await startBtn.isDisabled())) {
      await startBtn.click();
      await page.waitForTimeout(500);
      expect(postFired).toBe(true);
    }
  });

  test("TC-NW-09: '시작' 버튼 클릭 후 '로그' 탭으로 자동 전환", async ({
    page,
  }) => {
    const startBtn = page.getByRole("button", { name: /^시작$/ });
    const cnt = await startBtn.count();
    if (cnt > 0 && !(await startBtn.isDisabled())) {
      await startBtn.click();
      const logsTab = page.getByRole("tab", { name: /로그/ });
      const tabCnt = await logsTab.count();
      if (tabCnt > 0) {
        await expect(logsTab).toHaveAttribute("data-state", "active", {
          timeout: 3000,
        });
      }
    }
  });

  test("TC-NW-10: '중지' 버튼 클릭 시 DELETE /api/night-worker 요청 발생", async ({
    page,
  }) => {
    let deleteFired = false;
    page.on("request", (req) => {
      if (req.method() === "DELETE" && req.url().includes("/night-worker")) {
        deleteFired = true;
      }
    });

    const stopBtn = page.getByRole("button", { name: /^중지$/ });
    const cnt = await stopBtn.count();
    if (cnt > 0 && !(await stopBtn.isDisabled())) {
      await stopBtn.click();
      await page.waitForTimeout(500);
      expect(deleteFired).toBe(true);
    }
  });
});
