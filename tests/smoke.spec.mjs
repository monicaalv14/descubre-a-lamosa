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
  await page.goto('/?v=125b1&mode=research');
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
  await page.goto('/?v=125b1');
  await expectReady(page);
  await expect(page.locator('[data-nav="field"]')).toBeHidden();
  await page.locator('[data-nav="more"]').click();
  await expect(page.locator('#modeSelect')).toHaveValue('visitor');
});


test('ficha de lugar ofrece acciones principales y enlace profundo',async({page})=>{
  debug(page);
  await page.goto('/?v=125b1#poi=POI-001');
  await expectReady(page);
  await expect(page.locator('#poiSheet')).toHaveClass(/open/);
  await expect(page.locator('#poiDirections')).toBeVisible();
  await expect(page.locator('#poiListenBtn')).toBeVisible();
  await expect(page.locator('#poiFavBtn')).toBeVisible();
  await expect(page.locator('#poiShareBtn')).toBeVisible();
});

test('apariencia y filtros funcionan sin romper el mapa',async({page})=>{
  debug(page);
  await page.goto('/?v=125b1');
  await expectReady(page);
  await page.locator('[data-nav="more"]').click();
  await page.locator('#appearanceSelect').selectOption('dark');
  await expect(page.locator('body')).toHaveAttribute('data-theme','dark');
  await page.locator('[data-nav="explore"]').click();
  await page.locator('#photosBtn').click();
  await expect(page.locator('#photosBtn')).toHaveClass(/active/);
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
});


test('audioguía muestra controles simples y no rompe sin voces instaladas',async({page})=>{
  debug(page);
  await page.goto('/?v=125b1');
  await expectReady(page);
  await page.locator('[data-nav="more"]').click();
  const audio=page.locator('details').filter({hasText:'Audioguía'});
  await audio.locator('summary').click();
  await expect(page.locator('#voiceSelect')).toBeVisible();
  await expect(page.locator('#voiceRate')).toBeVisible();
  await expect(page.locator('#voiceSampleBtn')).toBeVisible();
  await page.locator('#voiceRate').evaluate(el=>{el.value='0.90';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect(page.locator('#voiceRateValue')).toHaveText('0.90×');
});

test('explorar evita listar todo el inventario por defecto',async({page})=>{
  debug(page);
  await page.goto('/?v=125b1');
  await expectReady(page);
  const count=await page.locator('#exploreList .list-row').count();
  expect(count).toBeLessThanOrEqual(12);
  await expect(page.locator('#showAllPlaces')).toBeAttached();
});

test('capas avanzadas están plegadas',async({page})=>{
  debug(page);
  await page.goto('/?v=125b1');
  await expectReady(page);
  await page.locator('#layersBtn').click();
  await expect(page.locator('.advanced-layers')).toBeVisible();
  await expect(page.locator('.advanced-layers')).not.toHaveAttribute('open','');
});


test('la red OSM generada contiene caminos reales',async({request})=>{
  const r=await request.get('/data/generated/osm-network.geojson');
  expect(r.ok()).toBeTruthy();
  const data=await r.json();
  expect(data.features?.length||0).toBeGreaterThanOrEqual(20);
});

test('la red de caminos no bloquea el arranque inicial',async({page})=>{
  debug(page);
  await page.route('**/data/generated/osm-network.geojson',async route=>{
    const response=await route.fetch();
    await new Promise(r=>setTimeout(r,5000));
    await route.fulfill({response});
  });
  const start=Date.now();
  await page.goto('/?v=125b1',{waitUntil:'domcontentloaded'});
  await expectReady(page);
  const elapsed=Date.now()-start;
  expect(elapsed).toBeLessThan(4000);
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
});

test('una recarga offline arranca desde caché',async({page,context})=>{
  debug(page);
  await page.goto('/?v=125b1');
  await expectReady(page);
  await page.evaluate(async()=>{
    if('serviceWorker'in navigator){
      await navigator.serviceWorker.ready;
      if(!navigator.serviceWorker.controller)await new Promise(resolve=>{
        navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true});
        setTimeout(resolve,3000);
      });
    }
  });
  await context.setOffline(true);
  const start=Date.now();
  await page.reload({waitUntil:'domcontentloaded'});
  await expectReady(page);
  expect(Date.now()-start).toBeLessThan(5000);
  await context.setOffline(false);
});

test('JSZip no se carga durante el arranque normal',async({page})=>{
  debug(page);
  await page.goto('/?v=125b1');
  await expectReady(page);
  await expect(page.locator('script[src*="jszip"]')).toHaveCount(0);
});


test('Vía Mariana tiene tramo local cartografiable',async({request})=>{
  const r=await request.get('/data/generated/via-mariana.geojson');
  expect(r.ok()).toBeTruthy();
  const data=await r.json();
  expect(data.features?.length||0).toBeGreaterThan(0);
});


test('panel inferior tiene agarre táctil amplio y sigue el arrastre',async({page})=>{
  debug(page);
  await page.goto('/?v=125b1');
  await expectReady(page);
  const handle=page.locator('[data-drawer-drag]');
  await expect(handle).toBeVisible();
  const metrics=await handle.evaluate(el=>{
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return {height:r.height,touchAction:s.touchAction};
  });
  expect(metrics.height).toBeGreaterThanOrEqual(48);
  expect(metrics.touchAction).toBe('none');

  const drawer=page.locator('#drawer');
  const before=await drawer.evaluate(el=>el.getBoundingClientRect().top);
  const box=await handle.boundingBox();
  expect(box).toBeTruthy();
  const x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x,y-120,{steps:6});
  await page.waitForTimeout(50);
  const during=await drawer.evaluate(el=>el.getBoundingClientRect().top);
  expect(before-during).toBeGreaterThan(90);
  await page.mouse.up();
  await expect(drawer).not.toHaveClass(/dragging/);
});

test('arrastre táctil real mueve el panel de forma continua',async({page,context})=>{
  debug(page);
  await page.goto('/?v=125b1');
  await expectReady(page);
  const handle=page.locator('[data-drawer-drag]'),drawer=page.locator('#drawer');
  const box=await handle.boundingBox();
  expect(box).toBeTruthy();
  const x=box.x+box.width/2,y=box.y+box.height/2;
  const before=await drawer.evaluate(el=>el.getBoundingClientRect().top);
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  for(let i=1;i<=6;i++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*20,id:1}]});
    await page.waitForTimeout(16);
  }
  const during=await drawer.evaluate(el=>el.getBoundingClientRect().top);
  expect(before-during).toBeGreaterThan(90);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(drawer).not.toHaveClass(/dragging/);
});
