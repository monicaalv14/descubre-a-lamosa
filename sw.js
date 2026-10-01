// Audioguia Santa 0.76 integrada: 16 WAV precargados para uso offline.
const SHELL='a-lamosa-shell-v128-audio';
const RUNTIME='a-lamosa-runtime-v128-audio';
const CORE=[
  './','./index.html','./styles.css?v=127b1','./app.js?v=127b1','./manifest.webmanifest?v=127b1',
  './vendor/maplibre-gl.mjs','./vendor/maplibre-gl-shared.mjs','./vendor/maplibre-gl-worker.mjs','./vendor/maplibre-gl.css','./vendor/jszip.min.js',
  './js/state.js','./js/i18n.js','./js/data.js','./js/map.js','./js/ui.js','./js/routes.js','./js/field.js',
  './js/offline.js','./js/audio.js','./js/contributions.js','./js/diagnostics.js',
  './data/offline-style.json','./data/generated/online-style.json','./data/trails.json','./data/routes.json','./data/stories.json',
  './data/generated/pois-all.json','./data/generated/places-all.json','./data/generated/prg119.geojson',
  './data/generated/via-mariana.geojson','./data/generated/osm-network.geojson','./data/generated/parish.geojson','./data/generated/hydro.geojson','./data/generated/build-info.json',
  './audio/es/poi-001.wav','./audio/es/poi-005.wav','./audio/es/poi-006.wav','./audio/es/poi-007.wav','./audio/es/poi-008.wav','./audio/es/poi-009.wav','./audio/es/poi-010.wav','./audio/es/poi-011.wav','./audio/es/poi-012.wav','./audio/es/poi-013.wav','./audio/es/poi-014.wav','./audio/es/poi-015.wav','./audio/es/poi-016.wav','./audio/es/poi-017.wav','./audio/es/poi-053.wav','./audio/es/poi-057.wav',
  './icons/icon-192.png','./icons/icon-512.png'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL);
    await Promise.allSettled(CORE.map(u=>cache.add(u)));
  })());
});

self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('a-lamosa-shell-')&&k!==SHELL).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));

const delay=(ms,value)=>new Promise(resolve=>setTimeout(()=>resolve(value),ms));
async function trimRuntime(max=420){
  const cache=await caches.open(RUNTIME),keys=await cache.keys();
  if(keys.length>max)await Promise.all(keys.slice(0,keys.length-max).map(k=>cache.delete(k)));
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const req=event.request,u=new URL(req.url),same=u.origin===self.location.origin;

  if(req.mode==='navigate'){
    const fresh=fetch(req).then(async r=>{
      if(r.ok){const cache=await caches.open(SHELL);await cache.put('./index.html',r.clone());}
      return r;
    });
    event.waitUntil(fresh.catch(()=>{}));
    event.respondWith((async()=>{
      const cached=(await caches.match('./index.html',{ignoreSearch:true}))||(await caches.match('./',{ignoreSearch:true}));
      if(!cached)return fresh;
      try{return await Promise.race([fresh,delay(1400,cached)]);}catch{return cached;}
    })());
    return;
  }

  if(same){
    const fresh=fetch(req).then(async r=>{
      if(r.ok){const cache=await caches.open(SHELL);await cache.put(req,r.clone());}
      return r;
    });
    event.waitUntil(fresh.catch(()=>{}));
    event.respondWith((async()=>{
      const cached=(await caches.match(req))||(await caches.match(req,{ignoreSearch:true}));
      if(!cached)return fresh.catch(()=>Response.error());
      try{return await Promise.race([fresh,delay(900,cached)]);}catch{return cached;}
    })());
    return;
  }

  const allowed=['tiles.openfreemap.org','www.ign.es','thumb.wikimedia.org','upload.wikimedia.org'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h));
  if(allowed){
    event.respondWith((async()=>{
      const cached=await caches.match(req);if(cached)return cached;
      try{
        const r=await fetch(req);
        if(r.ok||r.type==='opaque'){
          const cache=await caches.open(RUNTIME);await cache.put(req,r.clone());trimRuntime().catch(()=>{});
        }
        return r;
      }catch{return cached||Response.error();}
    })());
  }
});