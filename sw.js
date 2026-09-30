const SHELL='a-lamosa-shell-v110b1';
const RUNTIME='a-lamosa-runtime-v110b1';
const CORE=[
  './','./index.html','./styles.css?v=110b1','./app.js?v=110b1','./manifest.webmanifest?v=110b1',
  './vendor/maplibre-gl.mjs','./vendor/maplibre-gl.css','./vendor/jszip.min.js',
  './js/state.js','./js/i18n.js','./js/data.js','./js/map.js','./js/ui.js','./js/routes.js','./js/field.js',
  './js/offline.js','./js/audio.js','./js/contributions.js','./js/diagnostics.js',
  './data/offline-style.json','./data/trails.json','./data/stories.json',
  './data/generated/pois-all.json','./data/generated/places-all.json','./data/generated/prg119.geojson',
  './data/generated/via-mariana.geojson','./data/generated/osm-network.geojson','./data/generated/parish.geojson','./data/generated/hydro.geojson','./data/generated/build-info.json',
  './icons/icon-192.png','./icons/icon-512.png'
];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil((async()=>{const c=await caches.open(SHELL);await Promise.allSettled(CORE.map(u=>c.add(u)));})());});
self.addEventListener('activate',e=>e.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.filter(k=>k.startsWith('a-lamosa-shell-')&&k!==SHELL).map(k=>caches.delete(k)));await self.clients.claim();})()));
async function trim(name,max=420){const c=await caches.open(name),keys=await c.keys();if(keys.length>max)await Promise.all(keys.slice(0,keys.length-max).map(k=>c.delete(k)));}
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;const req=e.request,u=new URL(req.url),same=u.origin===self.location.origin;
  if(req.mode==='navigate'){e.respondWith((async()=>{try{const r=await fetch(req);const c=await caches.open(SHELL);c.put('./index.html',r.clone());return r;}catch{return (await caches.match('./index.html',{ignoreSearch:true}))||(await caches.match('./'));}})());return;}
  if(same){e.respondWith((async()=>{const cached=await caches.match(req,{ignoreSearch:false});try{const r=await fetch(req);if(r.ok){const c=await caches.open(SHELL);c.put(req,r.clone());}return r;}catch{return cached||(await caches.match(req,{ignoreSearch:true}))||Response.error();}})());return;}
  const allowed=['tiles.openfreemap.org','www.ign.es','thumb.wikimedia.org','upload.wikimedia.org'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h));
  if(allowed)e.respondWith((async()=>{const cached=await caches.match(req);if(cached)return cached;try{const r=await fetch(req);if(r.ok||r.type==='opaque'){const c=await caches.open(RUNTIME);c.put(req,r.clone());trim(RUNTIME);}return r;}catch{return cached||Response.error();}})());
});
