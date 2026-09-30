import {S,$,toast,recordError} from './state.js';
const PACK='a-lamosa-offline-pack-v120';
export function initOffline(){
  $('#offlinePackBtn').onclick=downloadOfflinePack;
  $('#clearCacheBtn').onclick=clearMapCaches;
  updateOfflineStatus();
}
async function downloadOfflinePack(){
  const btn=$('#offlinePackBtn'),status=$('#offlineStatus');btn.disabled=true;status.textContent='Preparando descarga…';
  try{
    const m=await (await fetch('data/generated/offline-manifest.json')).json(),cache=await caches.open(PACK);
    const assets=m.assets||[];let ok=0,fail=0;
    for(let i=0;i<assets.length;i++){
      const u=assets[i];status.textContent='Guardando '+(i+1)+'/'+assets.length+'…';
      try{const r=await fetch(u);if(r.ok||r.type==='opaque'){await cache.put(u,r.clone());ok++;}else fail++;}catch{fail++;}
    }
    for(const p of S.pois){
      if(!p.image_url)continue;
      try{const req=new Request(p.image_url,{mode:'no-cors'}),r=await fetch(req);await cache.put(req,r.clone());ok++;}catch{}
    }
    localStorage.setItem('aLamosaOfflinePack',JSON.stringify({version:m.version||'0.12',at:new Date().toISOString(),ok,fail}));
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
