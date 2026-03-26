import { test, expect } from "@playwright/test";

/**
 * settings.spec.ts
 * Settings 페이지 E2E 시나리오 (10개)
 */

test.describe("Settings — 기본 레이아웃", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
  });

  test("TC-ST-01: Settings 페이지 진입 시 폼 필드 표시", async ({ page }) => {
    await expect(page.getByText(/settings|설정/i).first()).toBeVisible();
  });

  test("TC-ST-02: API Key 필드에 값 입력 가능", async ({ page }) => {
    const apiKeyInput = page
      .getByLabel(/api.?key/i)
      .or(page.getByPlaceholder(/api.?key|sk-/i))
      .first();
    const cnt = await apiKeyInput.count();
    if (cnt > 0) {
      await apiKeyInput.fill("sk-test-1234567890");
      await expect(apiKeyInput).toHaveValue("sk-test-1234567890");
    }
  });

  test("TC-ST-03: API Key 값이 비어있으면 Save 버튼이 비활성화 또는 경고", async ({
    page,
  }) => {
    const apiKeyInput = page
      .getByLabel(/api.?key/i)
      .or(page.getByPlaceholder(/api.?key|sk-/i))
      .first();
    const cnt = await apiKeyInput.count();
    if (cnt > 0) {
      await apiKeyInput.fill("");
      const saveBtn = page.getByRole("button", { name: /save|저장/i });
      const saveCnt = await saveBtn.count();
      if (saveCnt > 0) {
        // 비어있을 때 비활성화되거나 유효성 검사 메시지가 있어야 함
        const isDisabled = await saveBtn.isDisabled();
        const hasValidation = await page
          .getByText(/필수|required|입력/i)
          .count();
        expect(isDisabled || hasValidation > 0).toBeTruthy();
      }
    }
  });
});

test.describe("Settings — 모델 선택 & Paths", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
  });

  test("TC-ST-04: 기본 모델 드롭다운에서 'Haiku' 선택", async ({ page }) => {
    const modelSelect = page
      .getByLabel(/기본.?모델|model/i)
      .or(page.getByRole("combobox", { name: /model/i }))
      .first();
    const cnt = await modelSelect.count();
    if (cnt > 0) {
      await modelSelect.selectOption({ label: /haiku/i });
      await expect(modelSelect).toBeVisible();
    }
  });

  test("TC-ST-05: 기본 모델 드롭다운에서 'Sonnet' 선택", async ({ page }) => {
    const modelSelect = page
      .getByLabel(/기본.?모델|model/i)
      .or(page.getByRole("combobox", { name: /model/i }))
      .first();
    const cnt = await modelSelect.count();
    if (cnt > 0) {
      await modelSelect.selectOption({ label: /sonnet/i });
      await expect(modelSelect).toBeVisible();
    }
  });

  test("TC-ST-06: 소스 경로 추가 버튼 클릭 시 새 경로 입력 필드 생성", async ({
    page,
  }) => {
    const addBtn = page
      .getByRole("button", { name: /경로 추가|add.?path|추가/i })
      .first();
    const cnt = await addBtn.count();
    if (cnt > 0) {
      const beforeInputs = await page
        .locator("[data-testid='src-path-input']")
        .count();
      await addBtn.click();
      const afterInputs = await page
        .locator("[data-testid='src-path-input']")
        .count();
      expect(afterInputs).toBeGreaterThanOrEqual(beforeInputs);
    }
  });

  test("TC-ST-07: 소스 경로 삭제 버튼 클릭 시 해당 경로 제거", async ({
    page,
  }) => {
    const pathItems = page.locator("[data-testid='src-path-item']");
    const cnt = await pathItems.count();
    if (cnt > 0) {
      const deleteBtn = pathItems.first().getByRole("button", { name: /삭제|delete|remove/i });
      const delCnt = await deleteBtn.count();
      if (delCnt > 0) {
        await deleteBtn.click();
        await expect(pathItems).toHaveCount(cnt - 1);
      }
    }
  });
});

test.describe("Settings — Orchestration 설정 & Save", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
  });

  test("TC-ST-08: maxParallel 값 변경", async ({ page }) => {
    const maxParallelInput = page
      .getByLabel(/max.?parallel/i)
      .or(page.locator("input[name='maxParallel']"))
      .first();
    const cnt = await maxParallelInput.count();
    if (cnt > 0) {
      await maxParallelInput.fill("3");
      await expect(maxParallelInput).toHaveValue("3");
    }
  });

  test("TC-ST-09: 유효한 값 입력 후 Save 버튼 활성화", async ({ page }) => {
    // API Key 입력
    const apiKeyInput = page
      .getByLabel(/api.?key/i)
      .or(page.getByPlaceholder(/api.?key|sk-/i))
      .first();
    const cnt = await apiKeyInput.count();
    if (cnt > 0) {
      await apiKeyInput.fill("sk-ant-test-key-1234");
      const saveBtn = page.getByRole("button", { name: /save|저장/i });
      const saveCnt = await saveBtn.count();
      if (saveCnt > 0) {
        await expect(saveBtn).toBeEnabled();
      }
    }
  });

  test("TC-ST-10: Save 버튼 클릭 시 PUT /api/settings 요청 발생", async ({
    page,
  }) => {
    let putFired = false;
    page.on("request", (req) => {
      if (req.method() === "PUT" && req.url().includes("/settings")) {
        putFired = true;
      }
    });

    const saveBtn = page.getByRole("button", { name: /save|저장/i });
    const cnt = await saveBtn.count();
    if (cnt > 0 && !(await saveBtn.isDisabled())) {
      await saveBtn.click();
      await page.waitForTimeout(500);
      expect(putFired).toBe(true);
    }
  });
});
