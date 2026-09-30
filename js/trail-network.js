import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';
import {S,$,esc,toast} from './state.js';

const DATA_URL='data/trails.json?v=091';
const BBOX='42.175,-8.410,42.240,-8.300';
const OSM_SOURCE='osm-rural-network';
const LAYERS={
  track:'osm-rural-tracks',
  path:'osm-rural-paths',
  pedestrian:'osm-rural-pedestrian',
  local:'osm-rural-local'
};
let routesLoaded=false;
let networkBound=false;
let routeEventBound=false;

export function setupTrailNetwork(){
  try{
    injectRoutesSection();
    injectLayerControls();
    loadRouteCards();
    if(!routeEventBound){
      window.addEventListener('alm:show-osm-route',e=>showRelationRoute(e.detail||{}));
      routeEventBound=true;
    }
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
  sec.innerHTML=`
    <div class="section-title"><div>
      <h3>Rutas existentes y caminos publicados</h3>
      <p class="muted compact">Las rutas oficiales se separan de los tracks de usuarios. La geometría mostrada de PR-G 119 y Vía Mariana procede de OpenStreetMap y se enlaza con las fuentes oficiales.</p>
    </div></div>
    <div id="knownTrailCards" class="cards"></div>
    <h3 class="project-routes-title">Rutas propias por levantar y verificar</h3>`;
  cards.parentNode.insertBefore(sec,cards);
}

function injectLayerControls(){
  const panel=$('#layersPanel');
  if(!panel||$('#trailClasses'))return;
  const box=document.createElement('div');
  box.id='trailClasses';
  box.className='trail-layer-control';
  box.innerHTML=`
    <strong class="subhead">Red de caminos OSM</strong>
    <label><input type="checkbox" id="layerTrailTracks" checked> <span class="legend-line track"></span>Pistas rurales / forestales</label>
    <label><input type="checkbox" id="layerTrailPaths" checked> <span class="legend-line path"></span>Senderos</label>
    <label><input type="checkbox" id="layerTrailPedestrian" checked> <span class="legend-line pedestrian"></span>Peatonales / herradura</label>
    <label><input type="checkbox" id="layerTrailLocal" checked> <span class="legend-line local"></span>Caminos locales / accesos</label>
    <small id="osmTrailsStatus">Preparando red de caminos…</small>
    <small class="osm-note">La clase se basa en etiquetas OSM. No demuestra titularidad, derecho de paso ni estado actual.</small>`;
  panel.appendChild(box);
  ['layerTrailTracks','layerTrailPaths','layerTrailPedestrian','layerTrailLocal'].forEach(id=>$('#'+id).onchange=applyVisibility);
}

async function loadRouteCards(){
  const host=$('#knownTrailCards');
  if(!host||routesLoaded)return;
  try{
    const r=await fetch(DATA_URL,{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const rows=await r.json();
    host.innerHTML=rows.map(routeCard).join('');
    host.querySelectorAll('[data-map-relation]').forEach(b=>b.onclick=()=>showRelationRoute({
      relation:Number(b.dataset.mapRelation),
      name:b.dataset.mapName||'Ruta',
      localOnly:b.dataset.localOnly==='1',
      color:b.dataset.mapColor||'#e0b51b'
    }));
    routesLoaded=true;
  }catch(e){
    console.warn(e);
    host.innerHTML='<p class="muted">No se pudieron cargar las rutas de referencia.</p>';
  }
}

function routeCard(r){
  const official=/Oficial/i.test(r.class||'');
  const badge=official?'official-route':'community-route';
  const map=r.map_relation?`<button class="mini-btn" data-map-relation="${r.map_relation}" data-map-name="${esc(r.name)}" data-local-only="${r.local_only?'1':'0'}" data-map-color="${esc(r.map_color||'#e0b51b')}">${esc(r.map_button||'Ver trazado en mapa')}</button>`:'';
  const source=r.source_url?`<a class="mini-btn link-btn" href="${esc(r.source_url)}" target="_blank" rel="noopener">Fuente</a>`:'';
  const track=r.track_url?`<a class="mini-btn link-btn" href="${esc(r.track_url)}" target="_blank" rel="noopener">Track actual</a>`:'';
  const gpx=r.gpx_url?`<a class="mini-btn link-btn" href="${esc(r.gpx_url)}" target="_blank" rel="noopener">GPX oficial</a>`:'';
  return `<article class="card trail-card">
    <div class="chips"><span class="chip ${badge}">${esc(r.class)}</span><span class="chip">${esc(r.type)}</span></div>
    <h3>${esc(r.name)}</h3><p>${esc(r.description)}</p>
    <div class="trail-metrics">${metric('Distancia',r.distance)}${metric('Duración',r.duration)}${metric('Desnivel',r.elevation)}${metric('Dificultad',r.difficulty)}</div>
    ${r.geometry_status?`<p class="muted compact"><b>Geometría:</b> ${esc(r.geometry_status)}</p>`:''}
    ${r.warning?`<p class="route-warning">${esc(r.warning)}</p>`:''}
    <div class="muted compact">Fuente: ${esc(r.source||'')}</div>
    <div class="card-actions">${map}${source}${gpx}${track}</div>
  </article>`;
}
function metric(label,value){return value?`<div><b>${label}</b><span>${esc(value)}</span></div>`:'';}

function waitForMap(tries=0){
  if(S.map&&S.map.isStyleLoaded()){loadOsmNetwork();return;}
  if(tries>60){setOsmStatus('Mapa no disponible para cargar caminos.');return;}
  setTimeout(()=>waitForMap(tries+1),250);
}

async function loadOsmNetwork(){
  setOsmStatus('Cargando pistas y senderos de OpenStreetMap…');
  const query=`[out:json][timeout:25];way["highway"~"^(track|path|footway|bridleway|unclassified|service)$"](${BBOX});out geom;`;
  const data=await fetchOverpass(query);
  if(!data){setOsmStatus('Red OSM no disponible ahora; el resto de la app sigue funcionando.');return;}
  const geo=toGeoJSON(data);
  if(!geo.features.length){setOsmStatus('No se recibieron caminos OSM en esta consulta.');return;}
  addNetworkToMap(geo);
  const counts=geo.features.reduce((a,f)=>{a[f.properties.kind]=(a[f.properties.kind]||0)+1;return a;},{});
  setOsmStatus(`${geo.features.length} tramos · ${counts.track||0} pistas · ${counts.path||0} senderos · ${counts.pedestrian||0} peatonales/herradura · ${counts.local||0} locales/accesos`);
}

async function fetchOverpass(query){
  const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
  let lastError=null;
  for(const endpoint of endpoints){
    const controller=new AbortController(),t=setTimeout(()=>controller.abort(),18000);
    try{
      const r=await fetch(endpoint+'?data='+encodeURIComponent(query),{signal:controller.signal});
      clearTimeout(t);
      if(!r.ok)throw new Error('HTTP '+r.status);
      return await r.json();
    }catch(e){clearTimeout(t);lastError=e;}
  }
  console.warn('OSM/Overpass',lastError);
  return null;
}

function toGeoJSON(data){
  const features=(data.elements||[]).filter(e=>e.type==='way'&&Array.isArray(e.geometry)&&e.geometry.length>1).map(e=>{
    const tags=e.tags||{},highway=tags.highway||'';
    return {
      type:'Feature',id:e.id,
      geometry:{type:'LineString',coordinates:e.geometry.map(p=>[p.lon,p.lat])},
      properties:{
        osm_id:e.id,highway,kind:classify(highway),
        class_label:classLabel(highway),
        name:tags.name||'',surface:tags.surface||'',surface_class:surfaceClass(tags.surface),
        tracktype:tags.tracktype||'',smoothness:tags.smoothness||'',width:tags.width||'',
        access:tags.access||'',foot:tags.foot||'',bicycle:tags.bicycle||'',
        sac_scale:tags.sac_scale||'',trail_visibility:tags.trail_visibility||''
      }
    };
  });
  return {type:'FeatureCollection',features};
}
function classify(h){
  if(h==='track')return'track';
  if(h==='path')return'path';
  if(h==='footway'||h==='bridleway')return'pedestrian';
  return'local';
}
function classLabel(h){
  return ({track:'Pista rural / forestal',path:'Sendero',footway:'Camino peatonal',bridleway:'Camino de herradura',unclassified:'Camino rural / vía local',service:'Acceso / vía de servicio'})[h]||'Camino';
}
function surfaceClass(s){
  if(!s)return'unknown';
  if(/asphalt|paved|concrete|paving_stones/.test(s))return'paved';
  if(/unpaved|ground|dirt|earth|gravel|fine_gravel|compacted|grass|sand/.test(s))return'unpaved';
  return'other';
}

function addNetworkToMap(geo){
  if(!S.map)return;
  const existing=S.map.getSource(OSM_SOURCE);
  if(existing)existing.setData(geo); else S.map.addSource(OSM_SOURCE,{type:'geojson',data:geo});

  addClassLayer(LAYERS.track,['==',['get','kind'],'track'],{
    'line-color':['match',['get','surface_class'],'paved','#6f7470','unpaved','#8a6541','#967552'],
    'line-width':['interpolate',['linear'],['zoom'],11,1.1,15,2.6,18,4.4],
    'line-opacity':.86
  });
  addClassLayer(LAYERS.path,['==',['get','kind'],'path'],{
    'line-color':'#c26035','line-width':['interpolate',['linear'],['zoom'],11,1,15,2.1,18,3.6],
    'line-dasharray':[2,1.5],'line-opacity':.92
  });
  addClassLayer(LAYERS.pedestrian,['==',['get','kind'],'pedestrian'],{
    'line-color':'#55845d','line-width':['interpolate',['linear'],['zoom'],11,.9,15,1.8,18,3.2],
    'line-dasharray':[1,1.5],'line-opacity':.9
  });
  addClassLayer(LAYERS.local,['==',['get','kind'],'local'],{
    'line-color':['match',['get','surface_class'],'paved','#6f7470','unpaved','#727f8a','#87929b'],
    'line-width':['interpolate',['linear'],['zoom'],11,1,15,2.2,18,3.8],
    'line-opacity':.78
  });
  applyVisibility();
  bindNetworkPopups();
}
function addClassLayer(id,filter,paint){
  if(!S.map.getLayer(id))S.map.addLayer({id,type:'line',source:OSM_SOURCE,filter,paint});
}
function applyVisibility(){
  const pairs=[
    [LAYERS.track,'layerTrailTracks'],[LAYERS.path,'layerTrailPaths'],
    [LAYERS.pedestrian,'layerTrailPedestrian'],[LAYERS.local,'layerTrailLocal']
  ];
  pairs.forEach(([layer,control])=>{if(S.map?.getLayer(layer))S.map.setLayoutProperty(layer,'visibility',$('#'+control)?.checked===false?'none':'visible');});
}

function bindNetworkPopups(){
  if(networkBound||!S.map)return;
  const show=e=>{
    const f=e.features?.[0];if(!f)return;
    const p=f.properties||{};
    const name=p.name||p.class_label||'Camino';
    const details=[
      p.surface&&('Superficie: '+p.surface),
      p.tracktype&&('Tracktype: '+p.tracktype),
      p.smoothness&&('Regularidad: '+p.smoothness),
      p.width&&('Anchura OSM: '+p.width),
      p.sac_scale&&('Escala senderista: '+p.sac_scale),
      p.trail_visibility&&('Visibilidad: '+p.trail_visibility),
      p.access&&('Acceso OSM: '+p.access),
      p.foot&&('Peatón: '+p.foot),
      p.bicycle&&('Bicicleta: '+p.bicycle)
    ].filter(Boolean);
    const osm=`https://www.openstreetmap.org/way/${p.osm_id}`;
    const html=`<div class="trail-popup"><b>${esc(name)}</b><br><span>${esc(p.class_label||'Camino')}</span>${details.length?'<br><small>'+details.map(esc).join(' · ')+'</small>':''}<br><small>Clasificación OSM: no prueba paso público ni transitabilidad actual.</small><br><a href="${osm}" target="_blank" rel="noopener">Ver elemento OSM</a></div>`;
    new maplibregl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(S.map);
  };
  Object.values(LAYERS).forEach(id=>{
    S.map.on('click',id,show);
    S.map.on('mouseenter',id,()=>S.map.getCanvas().style.cursor='pointer');
    S.map.on('mouseleave',id,()=>S.map.getCanvas().style.cursor='');
  });
  networkBound=true;
}

async function showRelationRoute({relation,name='Ruta',localOnly=false,color='#e0b51b'}){
  if(!relation)return;
  scrollToMap();
  await waitMapReady();
  const sourceId='osm-route-'+relation,layerId=sourceId+'-line';
  const existing=S.map?.getSource(sourceId);
  if(existing){
    fitSource(existing._data||null);
    toast(name+' · trazado mostrado');
    return;
  }
  toast('Cargando '+name+'…',3500);
  const bbox=localOnly?`(${BBOX})`:'';
  const query=`[out:json][timeout:30];way(r:${relation})${bbox};out geom;`;
  const data=await fetchOverpass(query);
  if(!data){toast('No se pudo descargar el trazado ahora mismo',3500);return;}
  const geo=waysToGeoJSON(data,name);
  if(!geo.features.length){toast('No se encontró geometría para esta ruta',3500);return;}
  S.map.addSource(sourceId,{type:'geojson',data:geo});
  S.map.addLayer({
    id:layerId,type:'line',source:sourceId,
    paint:{'line-color':color,'line-width':['interpolate',['linear'],['zoom'],10,4,15,6,18,8],'line-opacity':.96}
  });
  fitGeo(geo);
  toast(name+' · trazado mostrado',2800);
}
function waysToGeoJSON(data,name){
  return {type:'FeatureCollection',features:(data.elements||[])
    .filter(e=>e.type==='way'&&Array.isArray(e.geometry)&&e.geometry.length>1)
    .map(e=>({type:'Feature',properties:{osm_id:e.id,name},geometry:{type:'LineString',coordinates:e.geometry.map(p=>[p.lon,p.lat])}}))};
}
function fitSource(data){if(data)fitGeo(data);}
function fitGeo(geo){
  const b=new maplibregl.LngLatBounds();let n=0;
  (geo.features||[]).forEach(f=>(f.geometry?.coordinates||[]).forEach(c=>{if(Array.isArray(c)&&typeof c[0]==='number'){b.extend(c);n++;}}));
  if(n&&S.map){S.map.resize();S.map.fitBounds(b,{padding:55,maxZoom:16,duration:900});}
}
function waitMapReady(tries=0){
  return new Promise(resolve=>{
    if(S.map&&S.map.isStyleLoaded())return resolve(true);
    if(tries>50)return resolve(false);
    setTimeout(()=>resolve(waitMapReady(tries+1)),200);
  });
}
function scrollToMap(){
  document.querySelector('.mapwrap')?.scrollIntoView({behavior:'smooth',block:'start'});
  setTimeout(()=>S.map?.resize(),350);
}
function setOsmStatus(text){const e=$('#osmTrailsStatus');if(e)e.textContent=text;}
