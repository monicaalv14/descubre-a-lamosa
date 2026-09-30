import {S,$,$$,toast,dbPut,dbGetAll,dbDelete,distanceM,formatDistance,updateStorageInfo,downloadText,xmlEsc,esc} from './state.js';
import {updateUserMarker,updateLiveTrackLayer,showSavedTrackOnMap} from './map.js?v=100';

export function setupTracks(){
  $('#startTrackBtn').onclick=start;$('#stopTrackBtn').onclick=stop;
  window.addEventListener('alm:field-visible',renderTracks);
}
async function start(){
  if(S.trackingWatchId!=null)return;if(!navigator.geolocation){toast('GPS no disponible');return;}
  S.trackingPoints=[];S.trackStartedAt=new Date().toISOString();$('#startTrackBtn').disabled=true;$('#stopTrackBtn').disabled=false;$('#trackBadge').textContent='Grabando';$('#trackBadge').classList.add('track-live');
  try{S.wakeLock=await navigator.wakeLock?.request?.('screen');}catch(e){}
  S.trackingWatchId=navigator.geolocation.watchPosition(pos=>{
    const p=[pos.coords.longitude,pos.coords.latitude];S.userPosition=p;updateUserMarker(p);
    const now=Date.now(),last=S.trackingPoints.at(-1),enough=!last||distanceM(last.coordinates,p)>=3||(now-last.t)>=10000;
    if(enough){S.trackingPoints.push({coordinates:p,accuracy:pos.coords.accuracy,altitude:pos.coords.altitude,t:now});updateLive();}
  },err=>{console.warn(err);toast('Se perdió la señal GPS');},{enableHighAccuracy:true,maximumAge:1000,timeout:15000});toast('Grabación GPS iniciada');
}
function updateLive(){const c=S.trackingPoints.map(x=>x.coordinates);updateLiveTrackLayer(c);let d=0;for(let i=1;i<c.length;i++)d+=distanceM(c[i-1],c[i]);$('#trackStats').textContent=`${c.length} puntos · ${formatDistance(d)}`;}
async function stop(){
  if(S.trackingWatchId==null)return;navigator.geolocation.clearWatch(S.trackingWatchId);S.trackingWatchId=null;try{await S.wakeLock?.release?.();}catch(e){}S.wakeLock=null;
  $('#startTrackBtn').disabled=false;$('#stopTrackBtn').disabled=true;$('#trackBadge').textContent='Parado';$('#trackBadge').classList.remove('track-live');
  if(S.trackingPoints.length<2){toast('No hubo suficientes puntos para guardar');S.trackingPoints=[];updateLive();return;}
  const c=S.trackingPoints.map(x=>x.coordinates);let d=0;for(let i=1;i<c.length;i++)d+=distanceM(c[i-1],c[i]);
  const name=$('#trackName').value.trim()||'Recorrido '+new Date().toLocaleString('es-ES');
  await dbPut('tracks',{id:'TRACK-'+Date.now(),name,startedAt:S.trackStartedAt,endedAt:new Date().toISOString(),distanceM:d,points:S.trackingPoints,status:'Trabajo de campo sin publicar'});
  S.trackingPoints=[];$('#trackName').value='';updateLive();await renderTracks();updateStorageInfo();toast('Recorrido guardado');
}
export async function renderTracks(){
  const rows=(await dbGetAll('tracks')).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
  $('#trackRecords').innerHTML=rows.length?rows.map(t=>`<details class="route-disclosure"><summary><span><b>${esc(t.name)}</b><small>${formatDistance(t.distanceM)} · ${t.points.length} puntos · ${new Date(t.startedAt).toLocaleString('es-ES')}</small></span><span class="chip field-chip">Sin publicar</span></summary><div class="route-body"><div class="card-actions"><button class="mini-btn" data-track-map="${t.id}">Ver en mapa</button><button class="mini-btn" data-track-gpx="${t.id}">GPX</button><button class="mini-btn" data-track-delete="${t.id}">Eliminar</button></div></div></details>`).join(''):'<p class="muted" style="padding:10px">Aún no hay recorridos grabados.</p>';
  $$('[data-track-map]').forEach(b=>b.onclick=async()=>{const t=(await dbGetAll('tracks')).find(x=>x.id===b.dataset.trackMap);if(t)showSavedTrackOnMap(t);});
  $$('[data-track-gpx]').forEach(b=>b.onclick=()=>exportGPX(b.dataset.trackGpx));
  $$('[data-track-delete]').forEach(b=>b.onclick=async()=>{if(confirm('¿Eliminar este recorrido?')){await dbDelete('tracks',b.dataset.trackDelete);renderTracks();updateStorageInfo();}});
}
async function exportGPX(id){
  const t=(await dbGetAll('tracks')).find(x=>x.id===id);if(!t)return;
  const pts=t.points.map(p=>`<trkpt lat="${p.coordinates[1]}" lon="${p.coordinates[0]}">${p.altitude!=null?`<ele>${p.altitude}</ele>`:''}<time>${new Date(p.t).toISOString()}</time></trkpt>`).join('');
  const gpx=`<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Descubre A Lamosa" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${xmlEsc(t.name)}</name><trkseg>${pts}</trkseg></trk></gpx>`;
  downloadText(t.name.replace(/[^a-z0-9áéíóúñ_-]+/gi,'_')+'.gpx',gpx,'application/gpx+xml');
}
