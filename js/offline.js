import {S,$,toast,recordError} from './state.js';
const PACK='a-lamosa-offline-pack-v123';
export function initOffline(){
  $('#offlinePackBtn').onclick=downloadOfflinePack;
  $('#clearCacheBtn').onclick=clearMapCaches;
  updateOfflineStatus();
}
async function downloadOfflinePack(){
  const btn=$('#offlinePackBtn'),status=$('#offlineStatus');btn.disabled=true;status.textContent='Preparando descarga…';
  try{
    const m=await (await fetch('data/generated/offline-manifest.json')).json(),cache=await caches.open(PACK);
    const media=S.pois.flatMap(p=>[
      p.image_url,
      ...(Array.isArray(p.images)?p.images.map(x=>typeof x==='string'?x:x?.url):[]),
      p.audio_url,p.audio_es,p.audio_gl,p.audio_url_es,p.audio_url_gl
    ]).filter(Boolean);
    const jobs=[
      ...(m.assets||[]).map(url=>({url,opaque:false})),
      ...[...new Set(media)].map(url=>({url,opaque:true}))
    ];
    let ok=0,fail=0,done=0;
    await runPool(jobs,5,async job=>{
      try{
        const req=job.opaque?new Request(job.url,{mode:'no-cors'}):new Request(job.url);
        const r=await fetch(req);
        if(r.ok||r.type==='opaque'){await cache.put(req,r.clone());ok++;}else fail++;
      }catch{fail++;}
      done++;status.textContent='Guardando '+done+'/'+jobs.length+'…';
    });
    localStorage.setItem('aLamosaOfflinePack',JSON.stringify({version:m.version||'0.12.3',at:new Date().toISOString(),ok,fail}));
    status.textContent='Paquete listo · '+ok+' recursos'+(fail?' · '+fail+' no disponibles':'');toast('A Lamosa guardada para uso esencial sin conexión');
  }catch(e){recordError(e,'offline-pack');status.textContent='No se pudo completar la descarga.';toast('Error al preparar offline');}
  btn.disabled=false;
}
async function updateOfflineStatus(){
  try{const d=JSON.parse(localStorage.getItem('aLamosaOfflinePack')||'null');if(d)$('#offlineStatus').textContent='Última descarga: '+new Date(d.at).toLocaleString('es-ES')+' · '+d.ok+' recursos';}catch{}
}
async function clearMapCaches(){
  const keys=await caches.keys();await Promise.all(keys.filter(k=>k.includes('runtime')||k===PACK).map(k=>caches.delete(k)));localStorage.removeItem('aLamosaOfflinePack');$('#offlineStatus').textContent='Caché cartográfica limpiada.';toast('Caché limpiada');
}

async function runPool(items,limit,worker){
  let next=0;
  const runners=Array.from({length:Math.min(limit,items.length)},async()=>{
    while(true){
      const i=next++;if(i>=items.length)return;
      await worker(items[i],i);
    }
  });
  await Promise.all(runners);
}
