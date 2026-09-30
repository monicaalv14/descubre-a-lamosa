import {S,$,$$,emit,toast,copyText,dbPut,dbGetAll,dbDelete,updateStorageInfo,esc} from './state.js';
import {captureGPS} from './map.js?v=100';

export function setupField(){
  $('#fieldPoi').onchange=prefill;$('#captureGpsBtn').onclick=()=>captureGPS(true);$('#pickMapBtn').onclick=()=>emit('pick-map');
  $('#copyFixBtn').onclick=()=>{if(S.currentFieldFix)copyText(`${S.currentFieldFix.coordinates[1].toFixed(7)}, ${S.currentFieldFix.coordinates[0].toFixed(7)}`);};
  $('#saveFieldBtn').onclick=save;
  window.addEventListener('alm:field-fix',renderFix);
  window.addEventListener('alm:field-visible',()=>{renderRecords();updateStorageInfo();});
  window.addEventListener('alm:field-visible-request',()=>{document.querySelector('.tab[data-tab="field"]')?.click();});
}
function renderFix(){
  const f=S.currentFieldFix;if(!f)return;const warn=f.accuracy!=null&&f.accuracy>30?'<br><b>Precisión baja: conviene repetir la captura.</b>':'';
  $('#fieldFix').innerHTML=`<b>${f.method}</b> · ${f.coordinates[1].toFixed(7)}, ${f.coordinates[0].toFixed(7)}${f.accuracy!=null?`<br>Precisión indicada: ±${Math.round(f.accuracy)} m${warn}`:'<br>Posición elegida manualmente sobre el mapa'}`;
  $('#copyFixBtn').disabled=false;
}
function prefill(){const x=S.POIS.find(p=>p.id===$('#fieldPoi').value);if(!x)return;$('#fieldName').value=x.name;if([...$('#fieldCategory').options].some(o=>o.value===x.type))$('#fieldCategory').value=x.type;}
async function save(){
  if(!S.currentFieldFix){toast('Primero captura GPS o elige un punto en el mapa');return;}
  const name=$('#fieldName').value.trim();if(!name){toast('Escribe un nombre para el punto');return;}
  $('#saveFieldBtn').disabled=true;
  try{
    const file=$('#fieldPhoto').files?.[0],photo=file?await compressImage(file):null;
    const r={id:'FIELD-'+Date.now(),linkedPoiId:$('#fieldPoi').value||null,name,category:$('#fieldCategory').value,access:$('#fieldAccess').value,notes:$('#fieldNotes').value.trim(),coordinates:S.currentFieldFix.coordinates,accuracy:S.currentFieldFix.accuracy,method:S.currentFieldFix.method,capturedAt:new Date().toISOString(),status:'Trabajo de campo sin publicar',photo};
    await dbPut('records',r);try{await navigator.storage?.persist?.();}catch(e){}
    reset();await renderRecords();emit('field-updated');updateStorageInfo();toast('Punto guardado como trabajo de campo');
  }catch(e){console.error(e);toast('No se pudo guardar el punto');}
  $('#saveFieldBtn').disabled=false;
}
function reset(){$('#fieldPoi').value='';$('#fieldName').value='';$('#fieldNotes').value='';$('#fieldPhoto').value='';S.currentFieldFix=null;$('#fieldFix').textContent='Todavía no hay una posición capturada.';$('#copyFixBtn').disabled=true;}
async function compressImage(file){const data=await dataURL(file),img=await image(data),max=1280,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.78);}
function dataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(file);});}
function image(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
export async function renderRecords(){
  const rows=(await dbGetAll('records')).sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt));
  $('#fieldRecords').innerHTML=rows.length?rows.map(r=>`<details class="route-disclosure"><summary><span><b>${esc(r.name)}</b><small>${r.coordinates[1].toFixed(6)}, ${r.coordinates[0].toFixed(6)} · ${esc(r.method)}</small></span><span class="chip field-chip">Sin publicar</span></summary><div class="route-body">${r.notes?`<p>${esc(r.notes)}</p>`:''}${r.photo?`<img class="thumb" src="${r.photo}" alt="Foto de campo">`:''}<div class="card-actions"><button class="mini-btn" data-field-map="${r.id}">Mapa</button><button class="mini-btn" data-field-delete="${r.id}">Eliminar</button></div></div></details>`).join(''):'<p class="muted" style="padding:10px">Aún no hay puntos de campo guardados.</p>';
  $$('[data-field-map]').forEach(b=>b.onclick=async()=>{const r=(await dbGetAll('records')).find(x=>x.id===b.dataset.fieldMap);if(r)emit('fly',r.coordinates);});
  $$('[data-field-delete]').forEach(b=>b.onclick=async()=>{if(confirm('¿Eliminar esta captura de campo?')){await dbDelete('records',b.dataset.fieldDelete);renderRecords();emit('field-updated');updateStorageInfo();}});
}
