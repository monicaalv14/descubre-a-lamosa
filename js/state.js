export const VERSION='0.8.1';
export const S={
  POIS:[],ROUTES:[],PLACES:[],map:null,poiMarkers:[],placeMarkers:[],fieldMarkers:[],
  userMarker:null,userPosition:null,currentFieldFix:null,mapPickMode:false,
  nearbyMode:false,favoritesOnly:false,prgData:null,
  trackingWatchId:null,trackingPoints:[],trackStartedAt:null,wakeLock:null
};
export const $=s=>document.querySelector(s);
export const $$=s=>[...document.querySelectorAll(s)];
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function emit(name,detail){window.dispatchEvent(new CustomEvent('alm:'+name,{detail}));}
export function toast(msg,ms=2400){
  const e=$('#toast');e.textContent=msg;e.hidden=false;clearTimeout(toast.t);
  toast.t=setTimeout(()=>e.hidden=true,ms);
}
export function setStatus(t){const e=$('#appStatus');if(e)e.textContent='v'+VERSION+' · '+t;}
export function connectionStatus(){const e=$('#offline');if(e)e.textContent=navigator.onLine?'● En línea':'● Sin conexión';}
export async function getJSON(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(url+' → HTTP '+r.status);return r.json();}
export function distanceM(a,b){
  const R=6371000,rad=Math.PI/180,lat1=a[1]*rad,lat2=b[1]*rad,dlat=(b[1]-a[1])*rad,dlon=(b[0]-a[0])*rad;
  const h=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
export function formatDistance(m){return m<1000?Math.round(m)+' m':(m/1000).toFixed(m<10000?1:0)+' km';}
export function favorites(){try{return new Set(JSON.parse(localStorage.getItem('aLamosaFavorites')||'[]'));}catch(e){return new Set();}}
export function setFavorite(id,on){const f=favorites();on?f.add(id):f.delete(id);localStorage.setItem('aLamosaFavorites',JSON.stringify([...f]));emit('rerender');}
export async function copyText(t){try{await navigator.clipboard.writeText(t);toast('Copiado');}catch(e){toast('No se pudo copiar');}}
const DB_NAME='a-lamosa-field',DB_VERSION=1;
export function openDB(){return new Promise((resolve,reject)=>{
  const r=indexedDB.open(DB_NAME,DB_VERSION);
  r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('records'))db.createObjectStore('records',{keyPath:'id'});if(!db.objectStoreNames.contains('tracks'))db.createObjectStore('tracks',{keyPath:'id'});};
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
});}
export async function dbPut(store,value){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);});}
export async function dbGetAll(store){const db=await openDB();return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>{db.close();resolve(r.result||[]);};r.onerror=()=>reject(r.error);});}
export async function dbDelete(store,id){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);});}
export function downloadText(name,text,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
export async function updateStorageInfo(){try{const est=await navigator.storage?.estimate?.();if(est?.usage!=null)$('#storageInfo').textContent=(est.usage/1048576).toFixed(1)+' MB usados';}catch(e){}}
export function xmlEsc(s){return String(s).replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));}
