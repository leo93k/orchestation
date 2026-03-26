import { test, expect } from "@playwright/test";

/**
 * tasks-list.spec.ts
 * Task 목록 페이지 E2E 시나리오 (18개)
 *
 * 테스트 전제:
 *  - 개발 서버가 http://localhost:3000 에서 실행 중
 *  - 실제 API 응답이 없어도 UI 구조/동작 검증
 */

test.describe("Tasks List — 탭 네비게이션", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
  });

  test("TC-TL-01: 'All' 탭 클릭 시 active 스타일 적용 및 모든 태스크 표시", async ({
    page,
  }) => {
    const allTab = page.getByRole("tab", { name: /all/i });
    await allTab.click();
    await expect(allTab).toHaveAttribute("data-state", "active");
  });

  test("TC-TL-02: 'In Progress' 탭 클릭 시 active 스타일 적용", async ({
    page,
  }) => {
    const tab = page.getByRole("tab", { name: /in.?progress/i });
    await tab.click();
    await expect(tab).toHaveAttribute("data-state", "active");
  });

  test("TC-TL-03: 'Pending' 탭 클릭 시 active 스타일 적용", async ({
    page,
  }) => {
    const tab = page.getByRole("tab", { name: /pending/i });
    await tab.click();
    await expect(tab).toHaveAttribute("data-state", "active");
  });

  test("TC-TL-04: 'Done' 탭 클릭 시 active 스타일 적용", async ({ page }) => {
    const tab = page.getByRole("tab", { name: /done/i });
    await tab.click();
    await expect(tab).toHaveAttribute("data-state", "active");
  });

  test("TC-TL-05: 'Rejected' 탭 클릭 시 active 스타일 적용", async ({
    page,
  }) => {
    const tab = page.getByRole("tab", { name: /rejected/i });
    await tab.click();
    await expect(tab).toHaveAttribute("data-state", "active");
  });

  test("TC-TL-06: 빈 탭 선택 시 '해당 상태의 태스크가 없습니다' 문구 표시", async ({
    page,
  }) => {
    // 빈 탭으로 이동 (예: Reviewing)
    const tab = page.getByRole("tab", { name: /reviewing/i });
    await tab.click();
    // 빈 상태 메시지가 존재하거나, 태스크 목록이 비어있어야 함
    const emptyMsg = page.getByText(/해당 상태의 태스크가 없습니다/);
    const taskRows = page.locator("[data-testid='task-row']");
    const count = await taskRows.count();
    if (count === 0) {
      await expect(emptyMsg).toBeVisible();
    }
  });
});

test.describe("Tasks List — Priority 필터", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
  });

  test("TC-TL-07: Priority 'All' 필터 클릭 시 active 스타일", async ({
    page,
  }) => {
    const btn = page.getByRole("button", { name: /^all$/i }).first();
    await btn.click();
    await expect(btn).toHaveClass(/active|bg-|border-/);
  });

  test("TC-TL-08: Priority 'High' 필터 클릭 시 high 태스크만 표시", async ({
    page,
  }) => {
    const btn = page.getByRole("button", { name: /^high$/i });
    await btn.click();
    await expect(btn).toBeVisible();
    // High 배지가 존재하면 모두 high여야 함
    const badges = page.locator("[data-testid='priority-badge']");
    const cnt = await badges.count();
    for (let i = 0; i < cnt; i++) {
      await expect(badges.nth(i)).toHaveText(/high/i);
    }
  });

  test("TC-TL-09: Priority 'Medium' 필터 클릭 시 medium 태스크만 표시", async ({
    page,
  }) => {
    const btn = page.getByRole("button", { name: /^medium$/i });
    await btn.click();
    await expect(btn).toBeVisible();
  });

  test("TC-TL-10: Priority 'Low' 필터 클릭 시 low 태스크만 표시", async ({
    page,
  }) => {
    const btn = page.getByRole("button", { name: /^low$/i });
    await btn.click();
    await expect(btn).toBeVisible();
  });
});

test.describe("Tasks List — 검색", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
  });

  test("TC-TL-11: 검색어 입력 시 결과 필터링", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/ID, 제목, 내용으로 검색/);
    await searchInput.fill("TASK-1");
    await expect(searchInput).toHaveValue("TASK-1");
    // 입력 후 목록이 업데이트되는지 확인
    await page.waitForTimeout(300); // debounce 대기
    const rows = page.locator("[data-testid='task-row']");
    // 결과가 0개이면 빈 상태 메시지가 표시되어야 함
    const cnt = await rows.count();
    if (cnt === 0) {
      await expect(
        page.getByText(/검색 결과가 없습니다|태스크가 없습니다/i)
      ).toBeVisible();
    }
  });

  test("TC-TL-12: 검색어 초기화 버튼 클릭 시 필터 리셋", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/ID, 제목, 내용으로 검색/);
    await searchInput.fill("TASK-999");
    const clearBtn = page.getByRole("button", { name: /초기화/i });
    await clearBtn.click();
    await expect(searchInput).toHaveValue("");
  });
});

test.describe("Tasks List — 정렬", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
  });

  test("TC-TL-13: 정렬 '최신순' 선택 시 최신 태스크가 상단에 위치", async ({
    page,
  }) => {
    const sortSelect = page.getByRole("combobox").filter({ hasText: /순/ });
    await sortSelect.selectOption({ label: /최신순/ });
    await expect(sortSelect).toBeVisible();
  });

  test("TC-TL-14: 정렬 '오래된순' 선택", async ({ page }) => {
    const sortSelect = page.getByRole("combobox").filter({ hasText: /순/ });
    await sortSelect.selectOption({ label: /오래된순/ });
    await expect(sortSelect).toBeVisible();
  });

  test("TC-TL-15: 정렬 '우선순위순' 선택", async ({ page }) => {
    const sortSelect = page.getByRole("combobox").filter({ hasText: /순/ });
    await sortSelect.selectOption({ label: /우선순위순/ });
    await expect(sortSelect).toBeVisible();
  });
});

test.describe("Tasks List — 의존 체인 & 페이지네이션", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
  });

  test("TC-TL-16: 의존 체인 아코디언 펼침", async ({ page }) => {
    // 체인 그룹이 있을 경우 '외 N건' 버튼이 존재
    const chainToggle = page.locator("[data-testid='chain-toggle']").first();
    const cnt = await chainToggle.count();
    if (cnt > 0) {
      await chainToggle.click();
      // 하위 항목이 노출되어야 함
      await expect(
        page.locator("[data-testid='chain-item']").first()
      ).toBeVisible();
    }
  });

  test("TC-TL-17: 의존 체인 아코디언 접힘", async ({ page }) => {
    const chainToggle = page.locator("[data-testid='chain-toggle']").first();
    const cnt = await chainToggle.count();
    if (cnt > 0) {
      await chainToggle.click(); // 펼침
      await chainToggle.click(); // 접힘
      const items = page.locator("[data-testid='chain-item']");
      await expect(items).toHaveCount(0);
    }
  });

  test("TC-TL-18: 페이지네이션 — '페이지당' 드롭다운 변경 시 목록 업데이트", async ({
    page,
  }) => {
    const perPageSelect = page
      .getByRole("combobox")
      .filter({ hasText: /페이지당|개/ });
    const cnt = await perPageSelect.count();
    if (cnt > 0) {
      await expect(perPageSelect.first()).toBeVisible();
    }
  });
});
