import {VERSION,$,toast,dbPut,dbGetAll,downloadText,updateStorageInfo} from './state.js';
import {renderRecords} from './field.js';
import {renderTracks} from './tracks.js';

export function setupExports(){
  $('#exportGeoBtn').onclick=exportGeoJSON;$('#backupBtn').onclick=exportBackup;$('#importBtn').onclick=()=>$('#backupImport').click();$('#backupImport').onchange=importBackup;
}
async function exportGeoJSON(){
  const records=await dbGetAll('records'),tracks=await dbGetAll('tracks');
  const features=[...records.map(r=>({type:'Feature',geometry:{type:'Point',coordinates:r.coordinates},properties:{id:r.id,linkedPoiId:r.linkedPoiId,name:r.name,category:r.category,access:r.access,notes:r.notes,accuracy:r.accuracy,method:r.method,capturedAt:r.capturedAt,status:r.status,hasPhoto:!!r.photo}})),...tracks.map(t=>({type:'Feature',geometry:{type:'LineString',coordinates:t.points.map(p=>p.coordinates)},properties:{id:t.id,name:t.name,startedAt:t.startedAt,endedAt:t.endedAt,distanceM:t.distanceM,status:t.status}}))];
  downloadText('a-lamosa-trabajo-campo.geojson',JSON.stringify({type:'FeatureCollection',features},null,2),'application/geo+json');
}
async function exportBackup(){downloadText('a-lamosa-copia-campo.json',JSON.stringify({schema:'descubre-a-lamosa-field-v1',version:VERSION,exportedAt:new Date().toISOString(),records:await dbGetAll('records'),tracks:await dbGetAll('tracks')},null,2),'application/json');}
async function importBackup(e){
  const f=e.target.files?.[0];if(!f)return;
  try{const d=JSON.parse(await f.text());if(d.schema!=='descubre-a-lamosa-field-v1')throw new Error('Formato no reconocido');for(const r of d.records||[])await dbPut('records',r);for(const t of d.tracks||[])await dbPut('tracks',t);await renderRecords();await renderTracks();window.dispatchEvent(new CustomEvent('alm:field-updated'));updateStorageInfo();toast('Copia importada');}catch(err){console.error(err);toast('No se pudo importar la copia');}e.target.value='';
}
