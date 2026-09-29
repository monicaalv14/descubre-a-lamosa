const SHELL='a-lamosa-shell-v080';
const RUNTIME='a-lamosa-runtime-v080';
const CORE=['./','./index.html','./styles.css?v=080','./app.js?v=080','./js/state.js','./js/ui.js','./js/ui-detail.js','./js/map.js','./js/map-core.js','./js/map-official.js','./js/map-field.js','./js/field.js','./js/tracks.js','./js/export.js','./manifest.webmanifest?v=080','./data/pois-1.json','./data/pois-2.json','./data/pois-3.json','./data/pois-4.json','./data/routes.json','./data/places.json','./icons/icon-192.png','./icons/icon-512.png','https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs','https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.css'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil((async()=>{const c=await caches.open(SHELL);await Promise.allSettled(CORE.map(u=>c.add(u)));})());});
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>![SHELL,RUNTIME].includes(k)).map(k=>caches.delete(k)));await self.clients.claim();})()));
async function trim(cacheName,max=320){const c=await caches.open(cacheName);const keys=await c.keys();if(keys.length>max)await Promise.all(keys.slice(0,keys.length-max).map(k=>c.delete(k)));}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const req=event.request,u=new URL(req.url),same=u.origin===self.location.origin;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{try{const fresh=await fetch(req);const c=await caches.open(SHELL);c.put('./index.html',fresh.clone());return fresh;}catch(e){return (await caches.match('./index.html',{ignoreSearch:true}))||(await caches.match('./',{ignoreSearch:true}));}})());return;
  }
  if(same){
    event.respondWith((async()=>{try{const fresh=await fetch(req);if(fresh.ok){const c=await caches.open(SHELL);c.put(req,fresh.clone());}return fresh;}catch(e){return (await caches.match(req))||(await caches.match(req,{ignoreSearch:true}));}})());return;
  }
  const cacheable=['unpkg.com','tiles.openfreemap.org','www.ign.es','ideg.xunta.gal'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h));
  if(cacheable){
    event.respondWith((async()=>{const cached=await caches.match(req);if(cached)return cached;try{const fresh=await fetch(req);if(fresh.ok||fresh.type==='opaque'){const c=await caches.open(RUNTIME);c.put(req,fresh.clone());trim(RUNTIME,320);}return fresh;}catch(e){return cached||Response.error();}})());
  }
});