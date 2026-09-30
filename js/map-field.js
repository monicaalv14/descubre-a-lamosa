import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';
import {S,$,emit,dbGetAll} from './state.js';

export function updateUserMarker(c){
  if(!S.map)return;
  if(S.userMarker)S.userMarker.remove();
  const el=document.createElement('div');el.className='user-marker';
  S.userMarker=new maplibregl.Marker({element:el}).setLngLat(c).addTo(S.map);
}
export async function renderFieldMarkers(){
  if(!S.map)return;
  S.fieldMarkers.forEach(m=>m.remove());S.fieldMarkers=[];
  const rows=await dbGetAll('records');
  rows.forEach(r=>{
    const el=document.createElement('div');el.className='field-marker';el.title=r.name||'Punto de campo';
    el.onclick=ev=>{ev.stopPropagation();emit('open-field',r);};
    S.fieldMarkers.push(new maplibregl.Marker({element:el}).setLngLat(r.coordinates).addTo(S.map));
  });
  const visible=$('#layerField')?.checked!==false;
  S.fieldMarkers.forEach(m=>m.getElement().style.display=visible?'':'none');
}
export function setupLiveTrackLayer(){
  if(!S.map?.getSource('field-track-live'))S.map.addSource('field-track-live',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:[]}}});
  if(!S.map?.getLayer('field-track-live-line'))S.map.addLayer({id:'field-track-live-line',type:'line',source:'field-track-live',paint:{'line-color':'#287da1','line-width':5,'line-opacity':.9}});
}
export function updateLiveTrackLayer(coords){
  const src=S.map?.getSource('field-track-live');
  if(src)src.setData({type:'Feature',geometry:{type:'LineString',coordinates:coords}});
}
export function showSavedTrackOnMap(t){
  if(!S.map)return;
  const d={type:'Feature',geometry:{type:'LineString',coordinates:t.points.map(p=>p.coordinates)}};
  if(S.map.getSource('saved-track'))S.map.getSource('saved-track').setData(d);
  else{
    S.map.addSource('saved-track',{type:'geojson',data:d});
    S.map.addLayer({id:'saved-track-line',type:'line',source:'saved-track',paint:{'line-color':'#8f4c79','line-width':5}});
  }
  const b=new maplibregl.LngLatBounds();t.points.forEach(p=>b.extend(p.coordinates));
  document.querySelector('.mapwrap')?.scrollIntoView({behavior:'smooth',block:'start'});
  setTimeout(()=>{S.map.resize();S.map.fitBounds(b,{padding:50,maxZoom:17});},250);
}
