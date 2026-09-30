import {test,expect} from '@playwright/test';

test('app carga, navega y dibuja la PR-G 119 local',async({page})=>{
  await page.goto('/?mode=research');
  await expect(page.locator('body')).toHaveAttribute('data-app-ready','true',{timeout:20000});
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.locator('[data-nav="explore"]')).toBeVisible();

  await page.locator('[data-nav="routes"]').click();
  await expect(page.locator('#routeList')).toBeVisible();
  const route=page.locator('[data-route-id="TR-OF-001"]');
  await expect(route).toBeVisible();
  await route.click();
  await expect(page.locator('#routeSheet')).toHaveClass(/open/);
  await page.locator('#showRouteBtn').click();
  await expect(page.locator('#activeRouteBar')).toBeVisible();

  await page.locator('[data-nav="more"]').click();
  await expect(page.locator('#modeSelect')).toBeVisible();
  await expect(page.locator('#diagnosticBtn')).toBeVisible();
});

test('visitante oculta herramientas de investigación',async({page})=>{
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-app-ready','true',{timeout:20000});
  await expect(page.locator('[data-nav="field"]')).toBeHidden();
  await page.locator('[data-nav="more"]').click();
  await expect(page.locator('#modeSelect')).toHaveValue('visitor');
});
