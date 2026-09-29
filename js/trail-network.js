import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';
import {S,$,esc,toast} from './state.js';

const DATA_URL='data/trails.json?v=090';
const BBOX='42.185,-8.405,42.235,-8.310';
const OSM_SOURCE='osm-rural-network';
const TRACK_LAYER='osm-rural-tracks';
const PATH_LAYER='osm-rural-paths';
let routesLoaded=false;
let networkBound=false;

export function setupTrailNetwork(){
  try{
    injectRoutesSection();
    injectLayerControl();
    loadRouteCards();
    waitForMap();
  }catch(e){
    console.warn('Rutas/caminos:',e);
  }
}

function injectRoutesSection(){
  if($('#knownTrailsSection'))return;
  const view=$('#routes'),cards=$('#routecards');
  if(!view||!cards)return;
  const sec=document.createElement('section');
  sec.id='knownTrailsSection';
  sec.className='known-trails';
  sec.innerHTML=`<div class="section-title"><div><h3>Rutas existentes y caminos publicados</h3><p class="muted compact">Las oficiales se distinguen de los tracks de usuarios. Un track externo no garantiza paso público ni estado actual.</p></div></div><div id="knownTrailCards" class="cards"></div><h3 class="project-routes-title">Rutas propias por levantar y verificar</h3>`;
  cards.parentNode.insertBefore(sec,cards);
}

function injectLayerControl(){
  const panel=$('#layersPanel');
  if(!panel||$('#layerOsmTrails'))return;
  const box=document.createElement('div');
  box.className='trail-layer-control';
  box.innerHTML=`<label><input type="checkbox" id="layerOsmTrails" checked> Caminos y senderos OSM</label><small id="osmTrailsStatus">Preparando red de caminos…</small><small class="osm-note">Cartografía colaborativa: no implica derecho de paso ni transitabilidad.</small>`;
  panel.appendChild(box);
  $('#layerOsmTrails').onchange=applyVisibility;
}

async function loadRouteCards(){
  const host=$('#knownTrailCards');
  if(!host||routesLoaded)return;
  try{
    const r=await fetch(DATA_URL,{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const rows=await r.json();
    host.innerHTML=rows.map(routeCard).join('');
    host.querySelectorAll('[data-show-prg]').forEach(b=>b.onclick=()=>window.dispatchEvent(new CustomEvent('alm:show-prg')));
    routesLoaded=true;
  }catch(e){
    console.warn(e);
    host.innerHTML='<p class="muted">No se pudieron cargar las rutas de referencia.</p>';
  }
}

function routeCard(r){
  const official=/Oficial/i.test(r.class||'');
  const badge=official?'official-route':'community-route';
  const action=r.action==='show-prg'?'<button class="mini-btn" data-show-prg>Ver trazado en mapa</button>':'';
  const source=r.source_url?`<a class="mini-btn link-btn" href="${esc(r.source_url)}" target="_blank" rel="noopener">Fuente</a>`:'';
  const track=r.track_url?`<a class="mini-btn link-btn" href="${esc(r.track_url)}" target="_blank" rel="noopener">Track actual</a>`:'';
  return `<article class="card trail-card"><div class="chips"><span class="chip ${badge}">${esc(r.class)}</span><span class="chip">${esc(r.type)}</span></div><h3>${esc(r.name)}</h3><p>${esc(r.description)}</p><div class="trail-metrics">${metric('Distancia',r.distance)}${metric('Duración',r.duration)}${metric('Desnivel',r.elevation)}${metric('Dificultad',r.difficulty)}</div>${r.geometry_status?`<p class="muted compact"><b>Geometría:</b> ${esc(r.geometry_status)}</p>`:''}${r.warning?`<p class="route-warning">${esc(r.warning)}</p>`:''}<div class="muted compact">Fuente: ${esc(r.source||'')}</div><div class="card-actions">${action}${source}${track}</div></article>`;
}
function metric(label,value){return value?`<div><b>${label}</b><span>${esc(value)}</span></div>`:'';}

function waitForMap(tries=0){
  if(S.map&&S.map.isStyleLoaded()){
    loadOsmNetwork();
    return;
  }
  if(tries>50){
    setOsmStatus('Mapa no disponible para cargar caminos.');
    return;
  }
  setTimeout(()=>waitForMap(tries+1),250);
}

async function loadOsmNetwork(){
  setOsmStatus('Cargando pistas y senderos de OpenStreetMap…');
  const query=`[out:json][timeout:25];way["highway"~"^(track|path|footway|bridleway|unclassified)$"](${BBOX});out geom;`;
  const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
  let data=null,lastError=null;
  for(const endpoint of endpoints){
    const controller=new AbortController();
    const t=setTimeout(()=>controller.abort(),18000);
    try{
      const url=endpoint+'?data='+encodeURIComponent(query);
      const r=await fetch(url,{signal:controller.signal});
      if(!r.ok)throw new Error('HTTP '+r.status);
      data=await r.json();
      clearTimeout(t);
      break;
    }catch(e){
      clearTimeout(t);lastError=e;
    }
  }
  if(!data){
    console.warn('OSM/Overpass',lastError);
    setOsmStatus('Red OSM no disponible ahora; el resto de la app sigue funcionando.');
    return;
  }
  const geo=toGeoJSON(data);
  if(!geo.features.length){
    setOsmStatus('No se recibieron caminos OSM en esta consulta.');
    return;
  }
  addNetworkToMap(geo);
  setOsmStatus(geo.features.length+' tramos OSM cargados · quedan disponibles en caché tras visitarlos.');
}

function toGeoJSON(data){
  const features=(data.elements||[]).filter(e=>e.type==='way'&&Array.isArray(e.geometry)&&e.geometry.length>1).map(e=>({
    type:'Feature',
    id:e.id,
    geometry:{type:'LineString',coordinates:e.geometry.map(p=>[p.lon,p.lat])},
    properties:{
      osm_id:e.id,
      highway:e.tags?.highway||'',
      name:e.tags?.name||'',
      surface:e.tags?.surface||'',
      tracktype:e.tags?.tracktype||'',
      access:e.tags?.access||'',
      foot:e.tags?.foot||'',
      sac_scale:e.tags?.sac_scale||''
    }
  }));
  return {type:'FeatureCollection',features};
}

function addNetworkToMap(geo){
  if(!S.map)return;
  const existing=S.map.getSource(OSM_SOURCE);
  if(existing)existing.setData(geo);
  else S.map.addSource(OSM_SOURCE,{type:'geojson',data:geo});

  if(!S.map.getLayer(TRACK_LAYER)){
    S.map.addLayer({
      id:TRACK_LAYER,type:'line',source:OSM_SOURCE,
      filter:['in',['get','highway'],['literal',['track','unclassified']]],
      paint:{
        'line-color':'#866746',
        'line-width':['interpolate',['linear'],['zoom'],11,1,15,2.4,18,4],
        'line-opacity':0.78
      }
    });
  }
  if(!S.map.getLayer(PATH_LAYER)){
    S.map.addLayer({
      id:PATH_LAYER,type:'line',source:OSM_SOURCE,
      filter:['in',['get','highway'],['literal',['path','footway','bridleway']]],
      paint:{
        'line-color':'#b45d36',
        'line-width':['interpolate',['linear'],['zoom'],11,1,15,2,18,3.5],
        'line-dasharray':[2,1.5],
        'line-opacity':0.9
      }
    });
  }
  applyVisibility();
  bindNetworkPopups();
}

function applyVisibility(){
  const visible=$('#layerOsmTrails')?.checked!==false?'visible':'none';
  [TRACK_LAYER,PATH_LAYER].forEach(id=>{if(S.map?.getLayer(id))S.map.setLayoutProperty(id,'visibility',visible);});
}

function bindNetworkPopups(){
  if(networkBound||!S.map)return;
  const show=e=>{
    const f=e.features?.[0];if(!f)return;
    const p=f.properties||{};
    const kind=labelKind(p.highway);
    const name=p.name||kind;
    const details=[
      p.surface&&('Superficie: '+p.surface),
      p.tracktype&&('Tipo de pista: '+p.tracktype),
      p.sac_scale&&('Escala senderista OSM: '+p.sac_scale),
      p.access&&('Acceso etiquetado en OSM: '+p.access),
      p.foot&&('Peatón: '+p.foot)
    ].filter(Boolean);
    const osm=`https://www.openstreetmap.org/way/${p.osm_id}`;
    const html=`<div class="trail-popup"><b>${esc(name)}</b><br><span>${esc(kind)}</span>${details.length?'<br><small>'+details.map(esc).join(' · ')+'</small>':''}<br><small>OpenStreetMap no garantiza paso público ni estado del camino.</small><br><a href="${osm}" target="_blank" rel="noopener">Ver elemento OSM</a></div>`;
    new maplibregl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(S.map);
  };
  [TRACK_LAYER,PATH_LAYER].forEach(id=>{
    S.map.on('click',id,show);
    S.map.on('mouseenter',id,()=>S.map.getCanvas().style.cursor='pointer');
    S.map.on('mouseleave',id,()=>S.map.getCanvas().style.cursor='');
  });
  networkBound=true;
}

function labelKind(h){
  return ({track:'Pista / camino rural',path:'Sendero',footway:'Camino peatonal',bridleway:'Camino de herradura',unclassified:'Camino / vía local'})[h]||'Camino';
}
function setOsmStatus(text){const e=$('#osmTrailsStatus');if(e)e.textContent=text;}
