export const VERSION='0.12.2-beta.1';
export const S={
  map:null,pois:[],places:[],trails:[],projectRoutes:[],stories:[],osmNetwork:null,osmNetworkLoading:null,
  mode:localStorage.getItem('aLamosaMode')||'visitor',
  lang:localStorage.getItem('aLamosaLang')||'es',
  appearance:localStorage.getItem('aLamosaAppearance')||'system',
  userPosition:null,userMarker:null,activeRoute:null,routeFollow:null,
  mapPickResolver:null,audioWatch:null,audioSpoken:new Set(),errors:[],priorityMarkers:[],lastViewportPois:[]
};
export const $=s=>document.querySelector(s);
export const $$=s=>[...document.querySelectorAll(s)];
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function emit(name,detail){window.dispatchEvent(new CustomEvent('alm:'+name,{detail}));}
export function on(name,fn){window.addEventListener('alm:'+name,e=>fn(e.detail,e));}
export function toast(msg,ms=2600){const e=$('#toast');if(!e)return;e.textContent=msg;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,ms);}
export function setMode(mode){S.mode=mode;localStorage.setItem('aLamosaMode',mode);emit('mode',mode);}
export function setLang(lang){S.lang=lang;localStorage.setItem('aLamosaLang',lang);emit('lang',lang);}
export function setAppearance(value){S.appearance=value;localStorage.setItem('aLamosaAppearance',value);emit('appearance',value);}
export function favorites(){try{return new Set(JSON.parse(localStorage.getItem('aLamosaFavorites')||'[]'));}catch{return new Set();}}
export function setFavorite(id,on){const f=favorites();on?f.add(id):f.delete(id);localStorage.setItem('aLamosaFavorites',JSON.stringify([...f]));emit('favorites');}
export function distanceM(a,b){const R=6371000,rad=Math.PI/180,p1=a[1]*rad,p2=b[1]*rad,dp=(b[1]-a[1])*rad,dl=(b[0]-a[0])*rad;const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
export function formatDistance(m){if(!Number.isFinite(m))return '—';return m<1000?Math.round(m)+' m':(m/1000).toFixed(m<10000?1:0)+' km';}
export function copyText(text){
  if(!navigator.clipboard?.writeText){toast('Copiado no disponible');return Promise.resolve(false);}
  return navigator.clipboard.writeText(text).then(()=>{toast('Copiado');return true;}).catch(()=>{toast('No se pudo copiar');return false;});
}
export function downloadBlob(name,blob){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),3000);}
export function downloadText(name,text,type='text/plain'){downloadBlob(name,new Blob([text],{type}));}
export async function getJSON(url,{timeout=15000}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const r=await fetch(url,{signal:controller.signal});
    if(!r.ok)throw new Error(url+' → '+r.status);
    return await r.json();
  }finally{clearTimeout(timer);}
}
export function recordError(error,context='runtime'){const item={at:new Date().toISOString(),context,message:String(error?.message||error),stack:String(error?.stack||'').slice(0,3000)};S.errors.push(item);if(S.errors.length>30)S.errors.shift();console.error(context,error);}
window.addEventListener('error',e=>recordError(e.error||e.message,'window'));
window.addEventListener('unhandledrejection',e=>recordError(e.reason,'promise'));

const DB_NAME='a-lamosa-field',DB_VERSION=2;
let dbPromise=null;
export function openDB(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB_NAME,DB_VERSION);
    r.onupgradeneeded=()=>{const db=r.result;
      if(!db.objectStoreNames.contains('records'))db.createObjectStore('records',{keyPath:'id'});
      if(!db.objectStoreNames.contains('tracks'))db.createObjectStore('tracks',{keyPath:'id'});
      if(!db.objectStoreNames.contains('contributions'))db.createObjectStore('contributions',{keyPath:'id'});
    };
    r.onsuccess=()=>{
      const db=r.result;
      db.onversionchange=()=>{db.close();dbPromise=null;};
      resolve(db);
    };
    r.onerror=()=>{dbPromise=null;reject(r.error);};
    r.onblocked=()=>recordError(new Error('IndexedDB bloqueada por otra pestaña'),'indexeddb');
  });
  return dbPromise;
}
export async function dbGetAll(store){const db=await openDB();return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});}
export async function dbPut(store,value){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);});}
export async function dbDelete(store,id){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
export function xmlEsc(s){return String(s??'').replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));}
