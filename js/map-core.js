import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';
import {S,$,esc,emit,toast} from './state.js';
import {renderFieldMarkers,setupLiveTrackLayer,updateUserMarker} from './map-field.js';
import {loadOfficialLayers,showOfficialRoute} from './map-official.js';

export function setupMapEvents(){
  $('#locateMapBtn').onclick=()=>captureGPS(true);
  $('#layersBtn').onclick=()=>$('#layersPanel').hidden=!$('#layersPanel').hidden;
  ['layerPois','layerPlaces','layerField','layerParish','layerPrg','layerHydro'].forEach(id=>$('#'+id).onchange=applyLayerVisibility);
  window.addEventListener('alm:fly',e=>{if(e.detail)S.map?.flyTo({center:e.detail,zoom:18});});
  window.addEventListener('alm:nearby',async()=>{
    if(!S.nearbyMode){const ok=await captureGPS(false);if(!ok)return;S.nearbyMode=true;$('#nearbyToggle').classList.add('active');$('#nearbyToggle').textContent='◎ Distancia activa';}
    else{S.nearbyMode=false;$('#nearbyToggle').classList.remove('active');$('#nearbyToggle').textContent='◎ Cerca de mí';}
    emit('rerender');
  });
  window.addEventListener('alm:show-prg',showOfficialRoute);
  window.addEventListener('alm:pick-map',()=>{S.mapPickMode=true;$('#pickMapBtn').classList.add('active');toast('Toca el lugar exacto en el mapa o en la ortofoto',3500);window.scrollTo({top:0,behavior:'smooth'});});
  window.addEventListener('alm:field-updated',renderFieldMarkers);
}

export function initMap(){
  try{
    S.map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/bright',center:[-8.356,42.209],zoom:13,attributionControl:true});
    S.map.addControl(new maplibregl.NavigationControl({showCompass:true}),'top-right');
    S.map.on('load',async()=>{
      addSatelliteLayer();setupBasemapToggle();renderMapPoints();await renderFieldMarkers();setupLiveTrackLayer();
      await loadOfficialLayers();applyLayerVisibility();
    });
    S.map.on('click',e=>{if(S.mapPickMode){S.mapPickMode=false;$('#pickMapBtn').classList.remove('active');setFieldFix([e.lngLat.lng,e.lngLat.lat],null,'Mapa');emit('field-visible-request');toast('Punto tomado del mapa');}});
    S.map.on('error',e=>console.warn('Mapa:',e?.error||e));
  }catch(e){console.error(e);$('#officialLayers').textContent='Mapa no disponible; datos locales cargados.';}
}

function addSatelliteLayer(){
  if(!S.map||S.map.getSource('pnoa-satellite'))return;
  S.map.addSource('pnoa-satellite',{type:'raster',tiles:['https://www.ign.es/wmts/pnoa-ma?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=OI.OrthoimageCoverage&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg'],tileSize:256,minzoom:1,maxzoom:19,attribution:'PNOA © IGN-CNIG'});
  const firstSymbol=S.map.getStyle().layers?.find(l=>l.type==='symbol')?.id;
  S.map.addLayer({id:'pnoa-satellite-layer',type:'raster',source:'pnoa-satellite',layout:{visibility:'none'},paint:{'raster-opacity':1}},firstSymbol);
}
function setupBasemapToggle(){
  $('#mapMode').onclick=()=>setBasemap('map');$('#satMode').onclick=()=>setBasemap('satellite');
  let saved='map';try{saved=localStorage.getItem('aLamosaBasemap')||'map';}catch(e){}setBasemap(saved);
}
function setBasemap(mode){
  if(!S.map?.getLayer('pnoa-satellite-layer'))return;const sat=mode==='satellite';
  S.map.setLayoutProperty('pnoa-satellite-layer','visibility',sat?'visible':'none');
  $('#mapMode').classList.toggle('active',!sat);$('#satMode').classList.toggle('active',sat);
  try{localStorage.setItem('aLamosaBasemap',sat?'satellite':'map');}catch(e){}
}
function renderMapPoints(){
  S.poiMarkers.forEach(m=>m.remove());S.placeMarkers.forEach(m=>m.remove());S.poiMarkers=[];S.placeMarkers=[];
  S.POIS.filter(x=>x.coordinates).forEach(x=>{const el=document.createElement('div');el.className='poi-marker';el.title=x.name;el.onclick=()=>emit('open-poi',x.id);S.poiMarkers.push(new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat(x.coordinates).addTo(S.map));});
  S.PLACES.forEach(x=>{const el=document.createElement('div');el.className='place-marker';el.title=x.name;S.placeMarkers.push(new maplibregl.Marker({element:el}).setLngLat(x.coordinates).setPopup(new maplibregl.Popup().setHTML(`<b>${esc(x.name)}</b><br><small>Núcleo oficial · PBA</small>`)).addTo(S.map));});
  const all=[...S.POIS.filter(x=>x.coordinates).map(x=>x.coordinates),...S.PLACES.map(x=>x.coordinates)];
  if(all.length){const b=new maplibregl.LngLatBounds();all.forEach(x=>b.extend(x));S.map.fitBounds(b,{padding:70,maxZoom:14});}
}
export function applyLayerVisibility(){
  S.poiMarkers.forEach(m=>m.getElement().style.display=$('#layerPois').checked?'':'none');
  S.placeMarkers.forEach(m=>m.getElement().style.display=$('#layerPlaces').checked?'':'none');
  S.fieldMarkers.forEach(m=>m.getElement().style.display=$('#layerField').checked?'':'none');
  [['parish-fill','layerParish'],['parish-line','layerParish'],['prg119-line','layerPrg'],['hydro-line','layerHydro']].forEach(([l,b])=>{if(S.map?.getLayer(l))S.map.setLayoutProperty(l,'visibility',$('#'+b).checked?'visible':'none');});
}
export async function captureGPS(center=true){
  if(!navigator.geolocation){toast('Este dispositivo no ofrece geolocalización');return false;}
  $('#captureGpsBtn').disabled=true;$('#fieldFix').textContent='Buscando posición GPS…';
  return new Promise(resolve=>navigator.geolocation.getCurrentPosition(pos=>{
    const c=[pos.coords.longitude,pos.coords.latitude];S.userPosition=c;setFieldFix(c,pos.coords.accuracy,'GPS');updateUserMarker(c);emit('rerender');
    if(center&&S.map)S.map.easeTo({center:c,zoom:17});$('#captureGpsBtn').disabled=false;resolve(true);
  },err=>{console.warn(err);$('#captureGpsBtn').disabled=false;$('#fieldFix').textContent='No se pudo obtener la posición. Comprueba el permiso de ubicación.';toast('GPS no disponible');resolve(false);},{enableHighAccuracy:true,timeout:15000,maximumAge:2000}));
}
export function setFieldFix(coords,accuracy,method){S.currentFieldFix={coordinates:coords,accuracy,method,capturedAt:new Date().toISOString()};emit('field-fix');}
