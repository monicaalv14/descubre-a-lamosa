import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';
import {S,$,esc,emit,toast} from './state.js';

const DATA_URL='data/trails.json?v=100';
const BBOX={s:42.175,w:-8.410,n:42.240,e:-8.300};
const BBOX_Q=`${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e}`;
const OSM_SOURCE='osm-rural-network';
const LAYERS={track:'osm-rural-tracks',path:'osm-rural-paths',pedestrian:'osm-rural-pedestrian',local:'osm-rural-local'};
const ACTIVE_SOURCE='active-route-source';
const ACTIVE_CASE='active-route-casing';
const ACTIVE_LINE='active-route-line';
let routesLoaded=false,networkBound=false,activeBound=false,currentRoute=null;

export function setupTrailNetwork(){
  try{
    injectLayerControls();
    loadRouteCards();
    bindRouteClear();
    waitForMap();
  }catch(e){console.warn('Rutas/caminos:',e);}
}

function injectLayerControls(){
  const panel=$('#layersPanel');
  if(!panel||$('#trailClasses'))return;
  const box=document.createElement('div');
  box.id='trailClasses';box.className='trail-layer-control';
  box.innerHTML=`
    <strong>Red de caminos OSM</strong>
    <label><input type="checkbox" id="layerTrailTracks" checked><span class="legend-line track"></span>Pistas rurales / forestales</label>
    <label><input type="checkbox" id="layerTrailPaths" checked><span class="legend-line path"></span>Senderos</label>
    <label><input type="checkbox" id="layerTrailPedestrian" checked><span class="legend-line pedestrian"></span>Peatonales / herradura</label>
    <label><input type="checkbox" id="layerTrailLocal" checked><span class="legend-line local"></span>Caminos locales / accesos</label>
    <small id="osmTrailsStatus">Preparando red de caminos…</small>
    <small>Clasificación OSM: no implica paso público ni estado actual.</small>`;
  panel.appendChild(box);
  ['layerTrailTracks','layerTrailPaths','layerTrailPedestrian','layerTrailLocal'].forEach(id=>$('#'+id).onchange=applyVisibility);
}
function bindRouteClear(){
  const b=$('#clearActiveRoute');
  if(b)b.onclick=clearActiveRoute;
}
async function loadRouteCards(){
  const host=$('#knownTrailCards');if(!host||routesLoaded)return;
  try{
    const r=await fetch(DATA_URL,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
    const rows=await r.json();
    host.innerHTML=rows.map(routeCard).join('');
    host.querySelectorAll('[data-map-route]').forEach(b=>{
      b.onclick=async()=>{const r=rows.find(x=>x.id===b.dataset.mapRoute);if(r)await showRoute(r,b);};
    });
    routesLoaded=true;
  }catch(e){console.warn(e);host.innerHTML='<p class="muted" style="padding:12px">No se pudieron cargar las rutas de referencia.</p>';}
}
function routeCard(r){
  const official=/Oficial/i.test(r.class||''),badge=official?'official-route':'community-route';
  const map=r.map_relation?`<button class="mini-btn" data-map-route="${esc(r.id)}">${esc(r.map_button||'Ver trazado en mapa')}</button>`:'';
  const source=r.source_url?`<a class="mini-btn" href="${esc(r.source_url)}" target="_blank" rel="noopener">Fuente</a>`:'';
  const gpx=r.gpx_url?`<a class="mini-btn" href="${esc(r.gpx_url)}" target="_blank" rel="noopener">GPX oficial</a>`:'';
  const track=r.track_url?`<a class="mini-btn" href="${esc(r.track_url)}" target="_blank" rel="noopener">Track</a>`:'';
  return `<details class="route-disclosure"><summary><span><b>${esc(r.name)}</b><small>${esc(r.class)} · ${esc(r.distance||'')} · ${esc(r.difficulty||'')}</small></span><span class="chip ${badge}">${official?'Oficial':'Referencia'}</span></summary>
    <div class="route-body"><p>${esc(r.description||'')}</p>
    <div class="chips">${r.duration?`<span class="chip">${esc(r.duration)}</span>`:''}${r.elevation?`<span class="chip">${esc(r.elevation)}</span>`:''}${r.route_type?`<span class="chip">${esc(r.route_type)}</span>`:''}</div>
    ${r.warning?`<p class="route-warning">${esc(r.warning)}</p>`:''}
    <div class="card-actions">${map}${source}${gpx}${track}</div></div></details>`;
}

async function showRoute(r,button){
  scrollToMap();
  button.disabled=true;const old=button.textContent;button.textContent='Cargando…';
  try{
    const ready=await waitMapReady();if(!ready)throw new Error('map-not-ready');
    let geo=null,origin='';
    if(r.id==='TR-OF-001'&&S.prgData?.features?.length){geo=S.prgData;origin='Xunta';}
    if(!geo&&r.map_relation){
      if(r.local_only){
        geo=await relationViaOverpass(r.map_relation,true,r.name);
        if(geo)origin='OpenStreetMap/Overpass';
        if(!geo){geo=await relationViaOsmApi(r.map_relation,true,r.name);if(geo)origin='OpenStreetMap API';}
      }else{
        geo=await relationViaOsmApi(r.map_relation,false,r.name);
        if(geo)origin='OpenStreetMap API';
        if(!geo){geo=await relationViaOverpass(r.map_relation,false,r.name);if(geo)origin='OpenStreetMap/Overpass';}
      }
    }
    if(!geo?.features?.length)throw new Error('no-geometry');
    showActiveRoute(geo,r,origin);
    button.textContent='Mostrado en mapa';
    setTimeout(()=>{button.disabled=false;button.textContent=old;},1800);
  }catch(e){
    console.warn('Trazado',r.id,e);
    toast('No se pudo cargar el trazado ahora. Puedes abrir la fuente o el GPX.',3800);
    button.disabled=false;button.textContent=old;
  }
}
async function relationViaOsmApi(id,localOnly,name){
  try{
    const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),18000);
    const r=await fetch(`https://api.openstreetmap.org/api/0.6/relation/${id}/full`,{signal:ctrl.signal});
    clearTimeout(t);if(!r.ok)throw new Error('HTTP '+r.status);
    const txt=await r.text(),doc=new DOMParser().parseFromString(txt,'application/xml');
    if(doc.querySelector('parsererror'))throw new Error('XML');
    const nodes=new Map([...doc.querySelectorAll('node')].map(n=>[n.getAttribute('id'),[Number(n.getAttribute('lon')),Number(n.getAttribute('lat'))]]));
    const features=[];
    doc.querySelectorAll('way').forEach(w=>{
      const coords=[...w.querySelectorAll('nd')].map(nd=>nodes.get(nd.getAttribute('ref'))).filter(Boolean);
      if(coords.length<2)return;
      if(localOnly&&!coords.some(inBounds))return;
      features.push({type:'Feature',properties:{osm_id:w.getAttribute('id'),name},geometry:{type:'LineString',coordinates:coords}});
    });
    return features.length?{type:'FeatureCollection',features}:null;
  }catch(e){console.warn('OSM API relation',id,e);return null;}
}
async function relationViaOverpass(id,localOnly,name){
  const selector=localOnly?`way(r:${id})(${BBOX_Q});`:`way(r:${id});`;
  const data=await fetchOverpass(`[out:json][timeout:30];${selector}out geom;`);
  if(!data)return null;
  const features=(data.elements||[]).filter(e=>e.type==='way'&&Array.isArray(e.geometry)&&e.geometry.length>1).map(e=>({
    type:'Feature',properties:{osm_id:e.id,name},geometry:{type:'LineString',coordinates:e.geometry.map(p=>[p.lon,p.lat])}
  }));
  return features.length?{type:'FeatureCollection',features}:null;
}
function inBounds(c){return c[1]>=BBOX.s&&c[1]<=BBOX.n&&c[0]>=BBOX.w&&c[0]<=BBOX.e;}

function showActiveRoute(geo,r,origin){
  clearActiveRoute(false);
  if(!S.map)return;
  S.map.addSource(ACTIVE_SOURCE,{type:'geojson',data:geo});
  S.map.addLayer({id:ACTIVE_CASE,type:'line',source:ACTIVE_SOURCE,paint:{'line-color':'#ffffff','line-width':['interpolate',['linear'],['zoom'],10,6,15,9,18,12],'line-opacity':.95}});
  S.map.addLayer({id:ACTIVE_LINE,type:'line',source:ACTIVE_SOURCE,paint:{'line-color':r.map_color||'#e0b51b','line-width':['interpolate',['linear'],['zoom'],10,3.5,15,6,18,8],'line-opacity':.98}});
  currentRoute={...r,origin};
  const bar=$('#activeRouteBar');if(bar){$('#activeRouteName').textContent=r.name;bar.hidden=false;}
  fitGeo(geo);
  bindActiveRoute();
  toast(r.name+' · trazado visible',2500);
}
function bindActiveRoute(){
  if(activeBound||!S.map)return;
  S.map.on('click',ACTIVE_LINE,e=>{
    if(!currentRoute)return;
    emit('map-feature',{eyebrow:'RUTA ACTIVA',name:currentRoute.name,kind:currentRoute.class,subtitle:currentRoute.description,details:[
      currentRoute.distance&&('Distancia: '+currentRoute.distance),currentRoute.duration&&('Duración: '+currentRoute.duration),
      currentRoute.difficulty&&('Dificultad: '+currentRoute.difficulty),currentRoute.origin&&('Geometría: '+currentRoute.origin)
    ].filter(Boolean),url:currentRoute.source_url||''});
  });
  activeBound=true;
}
function clearActiveRoute(hide=true){
  if(S.map){
    if(S.map.getLayer(ACTIVE_LINE))S.map.removeLayer(ACTIVE_LINE);
    if(S.map.getLayer(ACTIVE_CASE))S.map.removeLayer(ACTIVE_CASE);
    if(S.map.getSource(ACTIVE_SOURCE))S.map.removeSource(ACTIVE_SOURCE);
  }
  currentRoute=null;
  if(hide&&$('#activeRouteBar'))$('#activeRouteBar').hidden=true;
  else if($('#activeRouteBar'))$('#activeRouteBar').hidden=true;
}

function waitForMap(tries=0){
  if(S.map&&S.map.isStyleLoaded()){loadOsmNetwork();return;}
  if(tries>60){setOsmStatus('Mapa no disponible para cargar caminos.');return;}
  setTimeout(()=>waitForMap(tries+1),250);
}
function waitMapReady(tries=0){
  return new Promise(resolve=>{
    if(S.map&&S.map.isStyleLoaded())return resolve(true);
    if(tries>50)return resolve(false);
    setTimeout(async()=>resolve(await waitMapReady(tries+1)),200);
  });
}
async function loadOsmNetwork(){
  setOsmStatus('Cargando red de caminos…');
  const q=`[out:json][timeout:25];way["highway"~"^(track|path|footway|bridleway|unclassified|service)$"](${BBOX_Q});out geom;`;
  const data=await fetchOverpass(q);
  if(!data){setOsmStatus('Red OSM no disponible ahora; el resto de la app funciona.');return;}
  const geo=toGeoJSON(data);if(!geo.features.length){setOsmStatus('Sin caminos recibidos en esta consulta.');return;}
  addNetworkToMap(geo);
  const c=geo.features.reduce((a,f)=>{a[f.properties.kind]=(a[f.properties.kind]||0)+1;return a;},{});
  setOsmStatus(`${geo.features.length} tramos · ${c.track||0} pistas · ${c.path||0} senderos · ${c.pedestrian||0} peatonales · ${c.local||0} locales`);
}
async function fetchOverpass(query){
  const eps=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
  for(const endpoint of eps){
    const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),18000);
    try{
      const r=await fetch(endpoint+'?data='+encodeURIComponent(query),{signal:ctrl.signal});clearTimeout(t);
      if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();
    }catch(e){clearTimeout(t);console.warn(endpoint,e);}
  }
  return null;
}
function toGeoJSON(data){
  return {type:'FeatureCollection',features:(data.elements||[]).filter(e=>e.type==='way'&&Array.isArray(e.geometry)&&e.geometry.length>1).map(e=>{
    const t=e.tags||{},h=t.highway||'';
    return {type:'Feature',id:e.id,geometry:{type:'LineString',coordinates:e.geometry.map(p=>[p.lon,p.lat])},properties:{
      osm_id:e.id,highway:h,kind:classify(h),class_label:classLabel(h),name:t.name||'',surface:t.surface||'',surface_class:surfaceClass(t.surface),
      tracktype:t.tracktype||'',smoothness:t.smoothness||'',width:t.width||'',access:t.access||'',foot:t.foot||'',bicycle:t.bicycle||'',
      sac_scale:t.sac_scale||'',trail_visibility:t.trail_visibility||''
    }};
  })};
}
function classify(h){if(h==='track')return'track';if(h==='path')return'path';if(h==='footway'||h==='bridleway')return'pedestrian';return'local';}
function classLabel(h){return({track:'Pista rural / forestal',path:'Sendero',footway:'Camino peatonal',bridleway:'Camino de herradura',unclassified:'Camino rural / vía local',service:'Acceso / vía de servicio'})[h]||'Camino';}
function surfaceClass(s){if(!s)return'unknown';if(/asphalt|paved|concrete|paving_stones/.test(s))return'paved';if(/unpaved|ground|dirt|earth|gravel|fine_gravel|compacted|grass|sand/.test(s))return'unpaved';return'other';}
function addNetworkToMap(geo){
  if(!S.map)return;
  const src=S.map.getSource(OSM_SOURCE);if(src)src.setData(geo);else S.map.addSource(OSM_SOURCE,{type:'geojson',data:geo});
  addClassLayer(LAYERS.track,['==',['get','kind'],'track'],{'line-color':['match',['get','surface_class'],'paved','#6f7470','unpaved','#8a6541','#967552'],'line-width':['interpolate',['linear'],['zoom'],11,1.1,15,2.6,18,4.4],'line-opacity':.86});
  addClassLayer(LAYERS.path,['==',['get','kind'],'path'],{'line-color':'#c26035','line-width':['interpolate',['linear'],['zoom'],11,1,15,2.1,18,3.6],'line-dasharray':[2,1.5],'line-opacity':.92});
  addClassLayer(LAYERS.pedestrian,['==',['get','kind'],'pedestrian'],{'line-color':'#55845d','line-width':['interpolate',['linear'],['zoom'],11,.9,15,1.8,18,3.2],'line-dasharray':[1,1.5],'line-opacity':.9});
  addClassLayer(LAYERS.local,['==',['get','kind'],'local'],{'line-color':['match',['get','surface_class'],'paved','#6f7470','unpaved','#727f8a','#87929b'],'line-width':['interpolate',['linear'],['zoom'],11,1,15,2.2,18,3.8],'line-opacity':.78});
  applyVisibility();bindNetwork();
}
function addClassLayer(id,filter,paint){if(!S.map.getLayer(id))S.map.addLayer({id,type:'line',source:OSM_SOURCE,filter,paint});}
function applyVisibility(){
  [[LAYERS.track,'layerTrailTracks'],[LAYERS.path,'layerTrailPaths'],[LAYERS.pedestrian,'layerTrailPedestrian'],[LAYERS.local,'layerTrailLocal']].forEach(([l,c])=>{
    if(S.map?.getLayer(l))S.map.setLayoutProperty(l,'visibility',$('#'+c)?.checked===false?'none':'visible');
  });
}
function bindNetwork(){
  if(networkBound||!S.map)return;
  const show=e=>{
    const p=e.features?.[0]?.properties||{};if(!p.osm_id)return;
    emit('map-feature',{name:p.name||p.class_label||'Camino',kind:p.class_label||'Camino',subtitle:'Elemento de la red de caminos cartografiada en OpenStreetMap.',details:[
      p.surface&&('Superficie: '+p.surface),p.tracktype&&('Tipo de pista: '+p.tracktype),p.smoothness&&('Regularidad: '+p.smoothness),
      p.width&&('Anchura: '+p.width),p.sac_scale&&('Dificultad OSM: '+p.sac_scale),p.trail_visibility&&('Visibilidad: '+p.trail_visibility),
      p.access&&('Acceso OSM: '+p.access),p.foot&&('Peatón: '+p.foot),p.bicycle&&('Bicicleta: '+p.bicycle)
    ].filter(Boolean),url:`https://www.openstreetmap.org/way/${p.osm_id}`});
  };
  Object.values(LAYERS).forEach(id=>{S.map.on('click',id,show);S.map.on('mouseenter',id,()=>S.map.getCanvas().style.cursor='pointer');S.map.on('mouseleave',id,()=>S.map.getCanvas().style.cursor='');});
  networkBound=true;
}
function fitGeo(geo){
  const coords=[];collectCoords(geo,coords);if(!coords.length||!S.map)return;
  const b=new maplibregl.LngLatBounds();coords.forEach(c=>b.extend(c));S.map.resize();S.map.fitBounds(b,{padding:55,maxZoom:16,duration:900});
}
function collectCoords(o,out){
  if(!o)return;
  if(Array.isArray(o)&&typeof o[0]==='number'){out.push(o);return;}
  if(Array.isArray(o)){o.forEach(x=>collectCoords(x,out));return;}
  if(o.type==='FeatureCollection')o.features?.forEach(x=>collectCoords(x,out));
  else if(o.type==='Feature')collectCoords(o.geometry,out);
  else if(o.coordinates)collectCoords(o.coordinates,out);
}
function scrollToMap(){document.querySelector('.mapwrap')?.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>S.map?.resize(),300);}
function setOsmStatus(t){const e=$('#osmTrailsStatus');if(e)e.textContent=t;}
