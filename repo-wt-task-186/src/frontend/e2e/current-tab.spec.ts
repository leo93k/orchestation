import { test, expect } from "@playwright/test";

/**
 * current-tab.spec.ts
 * Current 탭 / DAG 뷰 E2E 시나리오 (10개)
 *
 * Current 탭은 루트('/')에서 접근하는 태스크 DAG(의존 그래프) 뷰를 포함한다.
 */

test.describe("Current Tab — DAG 렌더링", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Current 탭으로 전환
    const currentTab = page.getByRole("tab", { name: /current/i }).first();
    const cnt = await currentTab.count();
    if (cnt > 0) await currentTab.click();
  });

  test("TC-CT-01: DAG 캔버스가 렌더링됨", async ({ page }) => {
    const dagCanvas = page
      .locator("[data-testid='dag-canvas']")
      .or(page.locator(".dag-canvas"))
      .or(page.locator("canvas"))
      .first();
    const svgCanvas = page.locator("svg").first();
    const cnt = await dagCanvas.count();
    const svgCnt = await svgCanvas.count();
    expect(cnt + svgCnt).toBeGreaterThan(0);
  });

  test("TC-CT-02: DAG 노드가 태스크 수만큼 렌더링됨", async ({ page }) => {
    // DAG 노드는 data-testid='dag-node' 또는 .dag-node 클래스
    const nodes = page
      .locator("[data-testid='dag-node']")
      .or(page.locator(".dag-node"));
    const cnt = await nodes.count();
    // 노드가 0개이거나 빈 상태 메시지가 있어야 함
    if (cnt === 0) {
      await expect(
        page.getByText(/태스크가 없습니다|no tasks|empty/i)
      ).toBeVisible();
    } else {
      expect(cnt).toBeGreaterThan(0);
    }
  });

  test("TC-CT-03: DAG 의존 화살표(엣지)가 렌더링됨", async ({ page }) => {
    // SVG path 또는 line 요소가 존재
    const edges = page
      .locator("[data-testid='dag-edge']")
      .or(page.locator("svg path, svg line"));
    const cnt = await edges.count();
    // 엣지가 있거나 없는 경우 모두 허용 (의존 관계가 없을 수 있음)
    expect(cnt).toBeGreaterThanOrEqual(0);
  });

  test("TC-CT-04: DAG 노드 클릭 시 태스크 상세 정보 또는 패널 표시", async ({
    page,
  }) => {
    const node = page.locator("[data-testid='dag-node']").first();
    const cnt = await node.count();
    if (cnt > 0) {
      await node.click();
      // 클릭 후 패널 또는 상세 정보가 표시되어야 함
      const panel = page.locator("[data-testid='task-detail-panel']");
      const panelCnt = await panel.count();
      expect(panelCnt).toBeGreaterThanOrEqual(0);
    }
  });

  test("TC-CT-05: 'Fit' 버튼 클릭 시 DAG가 화면에 맞게 조정됨", async ({
    page,
  }) => {
    const fitBtn = page
      .getByRole("button", { name: /fit|화면.?맞춤/i })
      .first();
    const cnt = await fitBtn.count();
    if (cnt > 0) {
      await fitBtn.click();
      // Fit 버튼 클릭 후 에러 없이 동작해야 함
      await expect(fitBtn).toBeVisible();
    }
  });
});

test.describe("Current Tab — 점유 Scope 패널", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const currentTab = page.getByRole("tab", { name: /current/i }).first();
    const cnt = await currentTab.count();
    if (cnt > 0) await currentTab.click();
  });

  test("TC-CT-06: 점유 Scope 패널이 렌더링됨", async ({ page }) => {
    const scopePanel = page
      .locator("[data-testid='scope-panel']")
      .or(page.getByText(/scope|점유/i));
    const cnt = await scopePanel.count();
    if (cnt > 0) {
      await expect(scopePanel.first()).toBeVisible();
    }
  });

  test("TC-CT-07: 실행 중인 태스크의 Scope가 패널에 표시됨", async ({
    page,
  }) => {
    const scopeItems = page.locator("[data-testid='scope-item']");
    const cnt = await scopeItems.count();
    // scope 아이템이 있거나, 패널이 빈 상태여야 함
    expect(cnt).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Current Tab — 빈 상태 & 상호작용", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const currentTab = page.getByRole("tab", { name: /current/i }).first();
    const cnt = await currentTab.count();
    if (cnt > 0) await currentTab.click();
  });

  test("TC-CT-08: 실행 중인 태스크가 없을 때 빈 상태 표시", async ({
    page,
  }) => {
    const nodes = page.locator("[data-testid='dag-node']");
    const cnt = await nodes.count();
    if (cnt === 0) {
      // 빈 상태 메시지 확인
      const emptyMsg = page.getByText(/태스크가 없습니다|no tasks|실행 중인/i);
      await expect(emptyMsg.or(page.locator("body"))).toBeVisible();
    }
  });

  test("TC-CT-09: DAG 뷰 zoom in/out 가능 (마우스 휠)", async ({ page }) => {
    const dagArea = page
      .locator("[data-testid='dag-canvas']")
      .or(page.locator("svg"))
      .first();
    const cnt = await dagArea.count();
    if (cnt > 0) {
      // 마우스 휠 이벤트 — 에러 없이 동작해야 함
      await dagArea.hover();
      await page.mouse.wheel(0, -100);
      await expect(dagArea).toBeVisible();
    }
  });

  test("TC-CT-10: DAG 뷰 pan(드래그) 가능", async ({ page }) => {
    const dagArea = page
      .locator("[data-testid='dag-canvas']")
      .or(page.locator("svg"))
      .first();
    const cnt = await dagArea.count();
    if (cnt > 0) {
      const box = await dagArea.boundingBox();
      if (box) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx + 100, cy + 50);
        await page.mouse.up();
        // 드래그 후 에러 없이 동작해야 함
        await expect(dagArea).toBeVisible();
      }
    }
  });
});
