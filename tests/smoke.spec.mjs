import {test,expect} from '@playwright/test';

function debug(page){
  page.on('console',m=>console.log('[browser console]',m.type(),m.text()));
  page.on('pageerror',e=>console.log('[browser pageerror]',e.message,e.stack||''));
  page.on('requestfailed',r=>console.log('[request failed]',r.url(),r.failure()?.errorText||''));
}
async function expectReady(page){
  await page.waitForFunction(()=>document.body.dataset.appReady==='true'||document.body.dataset.appReady==='error',{timeout:20000});
  const state=await page.locator('body').getAttribute('data-app-ready');
  if(state!=='true'){
    console.log('[boot status]',await page.locator('#mapStatus').textContent().catch(()=>'(sin estado)'));
    throw new Error('App boot terminó en '+state);
  }
}

test('app carga, navega y dibuja la PR-G 119 local',async({page})=>{
  debug(page);
  await page.goto('/?v=120b1&mode=research');
  await expectReady(page);
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
  const tools=page.locator('details').filter({hasText:'Herramientas'});
  await tools.locator('summary').click();
  await expect(page.locator('#diagnosticBtn')).toBeVisible();
});

test('visitante oculta herramientas de investigación',async({page})=>{
  debug(page);
  await page.goto('/?v=120b1');
  await expectReady(page);
  await expect(page.locator('[data-nav="field"]')).toBeHidden();
  await page.locator('[data-nav="more"]').click();
  await expect(page.locator('#modeSelect')).toHaveValue('visitor');
});


test('ficha de lugar ofrece acciones principales y enlace profundo',async({page})=>{
  debug(page);
  await page.goto('/?v=120b1#poi=POI-001');
  await expectReady(page);
  await expect(page.locator('#poiSheet')).toHaveClass(/open/);
  await expect(page.locator('#poiDirections')).toBeVisible();
  await expect(page.locator('#poiListenBtn')).toBeVisible();
  await expect(page.locator('#poiFavBtn')).toBeVisible();
  await expect(page.locator('#poiShareBtn')).toBeVisible();
});

test('apariencia y filtros funcionan sin romper el mapa',async({page})=>{
  debug(page);
  await page.goto('/?v=120b1');
  await expectReady(page);
  await page.locator('[data-nav="more"]').click();
  await page.locator('#appearanceSelect').selectOption('dark');
  await expect(page.locator('body')).toHaveAttribute('data-theme','dark');
  await page.locator('[data-nav="explore"]').click();
  await page.locator('#photosBtn').click();
  await expect(page.locator('#photosBtn')).toHaveClass(/active/);
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
});
