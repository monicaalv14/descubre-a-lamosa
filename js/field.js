import {S,$,$$,esc,toast,dbGetAll,dbPut,dbDelete,distanceM,formatDistance,downloadBlob,xmlEsc,emit,recordError} from './state.js';
import {locate,pickMapPoint,updateFieldLayer,showImportedGeoJSON,clearImported} from './map.js';

let fix=null,editing=null,trackWatch=null,trackPoints=[],trackStart=null,wake=null;
export function initField(){
  fillPoiSelect();
  $('#fieldGpsBtn').onclick=async()=>{const p=await locate(true);if(p)setFix(p.coordinates,p.accuracy,'GPS');};
  $('#fieldMapPickBtn').onclick=async()=>{const c=await pickMapPoint();if(c)setFix(c,null,'Mapa');};
  $('#fieldForm').onsubmit=saveRecord;
  $('#trackStartBtn').onclick=startTrack;$('#trackStopBtn').onclick=stopTrack;
  $('#exportWorkBtn').onclick=exportWorkPackage;$('#backupImport').onchange=importBackup;
  window.addEventListener('alm:field-prefill',e=>prefillPoi(e.detail));
  window.addEventListener('alm:field-edit',e=>editRecord(e.detail));
  renderFieldData();
}
function fillPoiSelect(){
  const el=$('#fieldPoiSelect');el.innerHTML='<option value="">Nuevo elemento</option>'+S.pois.slice().sort((a,b)=>a.name.localeCompare(b.name,'es')).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+(x.coordinates?'':' · pendiente')+'</option>').join('');
  const cats=[...new Set(S.pois.map(x=>x.type).filter(Boolean))].sort();$('#fieldCategory').innerHTML=cats.map(c=>'<option>'+esc(c)+'</option>').join('')+'<option>Otro</option>';
}
function setFix(c,accuracy,method){fix={coordinates:c,accuracy,method,capturedAt:new Date().toISOString()};$('#fieldFix').textContent=c[1].toFixed(7)+', '+c[0].toFixed(7)+(accuracy?' · ±'+Math.round(accuracy)+' m':'')+' · '+method;}
function prefillPoi(x){if(!x)return;editing=null;$('#fieldRecordId').value='';$('#fieldPoiSelect').value=x.id;$('#fieldName').value=x.name;$('#fieldCategory').value=x.type||'';$('#fieldLocalName').value='';$('#fieldNotes').value='';if(x.coordinates)setFix(x.coordinates,null,'Inventario');}
function editRecord(r){if(!r)return;editing=r;$('#fieldRecordId').value=r.id;$('#fieldPoiSelect').value=r.linkedPoiId||'';$('#fieldName').value=r.name||'';$('#fieldLocalName').value=r.localName||'';$('#fieldCategory').value=r.category||'';$('#fieldConservation').value=r.conservation||'Sin comprobar';$('#fieldAccess').value=r.access||'Sin comprobar';$('#fieldPermission').value=r.permission||'';$('#fieldInformant').value=r.informant||'';$('#fieldOralDate').value=r.oralDate||'';$('#fieldNotes').value=r.notes||'';if(r.coordinates)setFix(r.coordinates,r.accuracy,r.method||'Guardado');}
async function saveRecord(e){
  e.preventDefault();if(!fix?.coordinates){toast('Captura primero una posición');return;}
  try{
    const files=[...($('#fieldPhotos').files||[])],newPhotos=[];
    for(const f of files)newPhotos.push(await resizePhoto(f));
    const oldPhotos=editing?.photos?.length?editing.photos:(editing?.photo?[editing.photo]:[]);
    const id=editing?.id||'FIELD-'+Date.now();
    const row={...editing,id,linkedPoiId:$('#fieldPoiSelect').value||null,name:$('#fieldName').value.trim()||$('#fieldLocalName').value.trim()||'Punto de campo',localName:$('#fieldLocalName').value.trim(),category:$('#fieldCategory').value,conservation:$('#fieldConservation').value,access:$('#fieldAccess').value,permission:$('#fieldPermission').value.trim(),informant:$('#fieldInformant').value.trim(),oralDate:$('#fieldOralDate').value||null,notes:$('#fieldNotes').value.trim(),coordinates:fix.coordinates,accuracy:fix.accuracy,method:fix.method,capturedAt:editing?.capturedAt||fix.capturedAt,updatedAt:new Date().toISOString(),photos:newPhotos.length?[...oldPhotos,...newPhotos]:oldPhotos,status:'Trabajo de campo sin publicar'};
    await dbPut('records',row);toast(editing?'Ficha actualizada':'Ficha guardada');resetForm();await updateFieldLayer();await renderFieldData();
  }catch(err){recordError(err,'field-save');toast('No se pudo guardar');}
}
function resetForm(){editing=null;fix=null;$('#fieldForm').reset();$('#fieldRecordId').value='';$('#fieldFix').textContent='Sin posición capturada.';}
async function resizePhoto(file){
  const src=await readData(file),img=await loadImage(src),max=1280,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.78);
}
const readData=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(f);});
const loadImage=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});

async function startTrack(){
  if(trackWatch!=null)return;if(!navigator.geolocation){toast('GPS no disponible');return;}
  trackPoints=[];trackStart=new Date().toISOString();$('#trackStartBtn').disabled=true;$('#trackStopBtn').disabled=false;
  try{wake=await navigator.wakeLock?.request?.('screen');}catch{}
  trackWatch=navigator.geolocation.watchPosition(pos=>{
    const c=[pos.coords.longitude,pos.coords.latitude],last=trackPoints.at(-1),now=Date.now();
    if(!last||distanceM(last.coordinates,c)>=3||now-last.t>=8000){trackPoints.push({coordinates:c,accuracy:pos.coords.accuracy,altitude:pos.coords.altitude,t:now});renderLiveTrack();}
  },()=>toast('Se perdió la señal GPS'),{enableHighAccuracy:true,maximumAge:1000,timeout:15000});
  toast('Grabación iniciada');
}
function renderLiveTrack(){
  const coords=trackPoints.map(x=>x.coordinates),geo={type:'FeatureCollection',features:coords.length>1?[{type:'Feature',properties:{name:'Grabación en curso'},geometry:{type:'LineString',coordinates:coords}}]:[]};showImportedGeoJSON(geo);
  let d=0;for(let i=1;i<coords.length;i++)d+=distanceM(coords[i-1],coords[i]);$('#trackStats').textContent=coords.length+' puntos · '+formatDistance(d);
}
async function stopTrack(){
  if(trackWatch==null)return;navigator.geolocation.clearWatch(trackWatch);trackWatch=null;try{await wake?.release?.();}catch{}wake=null;$('#trackStartBtn').disabled=false;$('#trackStopBtn').disabled=true;
  if(trackPoints.length<2){trackPoints=[];renderLiveTrack();toast('No hubo puntos suficientes');return;}
  let d=0;for(let i=1;i<trackPoints.length;i++)d+=distanceM(trackPoints[i-1].coordinates,trackPoints[i].coordinates);
  const row={id:'TRACK-'+Date.now(),name:$('#trackName').value.trim()||'Recorrido '+new Date().toLocaleString('es-ES'),startedAt:trackStart,endedAt:new Date().toISOString(),distanceM:d,points:trackPoints,status:'Trabajo de campo sin publicar'};
  await dbPut('tracks',row);trackPoints=[];$('#trackName').value='';clearImported();$('#trackStats').textContent='0 puntos · 0 m';await renderFieldData();toast('Recorrido guardado');
}
export async function renderFieldData(){
  const records=(await dbGetAll('records')).sort((a,b)=>(b.updatedAt||b.capturedAt||'').localeCompare(a.updatedAt||a.capturedAt||''));const tracks=(await dbGetAll('tracks')).sort((a,b)=>(b.startedAt||'').localeCompare(a.startedAt||''));
  $('#fieldRecordList').innerHTML=records.length?records.map(r=>'<article class="list-row" data-field-id="'+esc(r.id)+'"><div class="ico">✎</div><div><strong>'+esc(r.name||r.localName)+'</strong><small>'+esc(r.category||'Campo')+' · '+esc(r.conservation||'')+'</small></div><button class="tiny-delete" data-field-del="'+esc(r.id)+'">×</button></article>').join(''):'<p class="section-note">Sin puntos guardados.</p>';
  $('#trackRecordList').innerHTML=tracks.length?tracks.map(t=>'<article class="list-row" data-track-id="'+esc(t.id)+'"><div class="ico">↝</div><div><strong>'+esc(t.name)+'</strong><small>'+formatDistance(t.distanceM)+' · '+t.points.length+' puntos</small></div><button class="tiny-delete" data-track-del="'+esc(t.id)+'">×</button></article>').join(''):'<p class="section-note">Sin recorridos guardados.</p>';
  $$('[data-field-id]').forEach(x=>x.onclick=()=>emit('open-field',records.find(r=>r.id===x.dataset.fieldId)));
  $$('[data-field-del]').forEach(x=>x.onclick=async e=>{e.stopPropagation();if(confirm('¿Eliminar esta ficha?')){await dbDelete('records',x.dataset.fieldDel);await updateFieldLayer();renderFieldData();}});
  $$('[data-track-id]').forEach(x=>x.onclick=()=>{const t=tracks.find(r=>r.id===x.dataset.trackId);if(t)showImportedGeoJSON(trackGeo(t));});
  $$('[data-track-del]').forEach(x=>x.onclick=async e=>{e.stopPropagation();if(confirm('¿Eliminar este recorrido?')){await dbDelete('tracks',x.dataset.trackDel);renderFieldData();}});
}
function trackGeo(t){return {type:'FeatureCollection',features:[{type:'Feature',properties:{name:t.name},geometry:{type:'LineString',coordinates:t.points.map(p=>p.coordinates)}}]};}
function gpx(t){const pts=t.points.map(p=>'<trkpt lat="'+p.coordinates[1]+'" lon="'+p.coordinates[0]+'">'+(p.altitude!=null?'<ele>'+p.altitude+'</ele>':'')+'<time>'+new Date(p.t).toISOString()+'</time></trkpt>').join('');return '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Descubre A Lamosa" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>'+xmlEsc(t.name)+'</name><trkseg>'+pts+'</trkseg></trk></gpx>';}
async function exportWorkPackage(){
  if(!window.JSZip){toast('ZIP no disponible');return;}
  const zip=new JSZip(),records=await dbGetAll('records'),tracks=await dbGetAll('tracks');
  const features=[...records.map(r=>({type:'Feature',geometry:{type:'Point',coordinates:r.coordinates},properties:{...r,photos:undefined,photo:undefined}})),...tracks.map(t=>({type:'Feature',geometry:{type:'LineString',coordinates:t.points.map(p=>p.coordinates)},properties:{id:t.id,name:t.name,startedAt:t.startedAt,endedAt:t.endedAt,distanceM:t.distanceM,status:t.status}}))];
  zip.file('datos.geojson',JSON.stringify({type:'FeatureCollection',features},null,2));
  zip.file('copia-seguridad.json',JSON.stringify({schema:'descubre-a-lamosa-field-v2',version:'0.11',exportedAt:new Date().toISOString(),records,tracks},null,2));
  const tf=zip.folder('rutas');for(const t of tracks)tf.file(safe(t.name)+'.gpx',gpx(t));
  const pf=zip.folder('fotos');for(const r of records){const photos=r.photos?.length?r.photos:(r.photo?[r.photo]:[]);photos.forEach((d,i)=>{const m=d.match(/^data:image\/(\w+);base64,(.+)$/);if(m)pf.file(safe(r.name)+'_'+(i+1)+'.'+(m[1]==='jpeg'?'jpg':m[1]),m[2],{base64:true});});}
  zip.file('manifest.json',JSON.stringify({createdAt:new Date().toISOString(),records:records.length,tracks:tracks.length,photos:records.reduce((n,r)=>n+(r.photos?.length||+(!!r.photo)),0)},null,2));
  const blob=await zip.generateAsync({type:'blob'});downloadBlob('Descubre_A_Lamosa_trabajo_campo.zip',blob);toast('Paquete de trabajo exportado');
}
function safe(s='archivo'){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,80)||'archivo';}
async function importBackup(e){
  const f=e.target.files?.[0];if(!f)return;
  try{const d=JSON.parse(await f.text());if(!Array.isArray(d.records)&&!Array.isArray(d.tracks))throw new Error('Formato');for(const r of d.records||[])await dbPut('records',r);for(const t of d.tracks||[])await dbPut('tracks',t);await updateFieldLayer();await renderFieldData();toast('Copia importada');}catch(err){recordError(err,'backup-import');toast('No se pudo importar');}e.target.value='';
}
