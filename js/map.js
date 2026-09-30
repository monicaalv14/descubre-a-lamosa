import * as maplibregl from '../vendor/maplibre-gl.mjs';
import {S,$,$$,emit,toast,distanceM,recordError,dbGetAll} from './state.js';
import {visiblePois} from './data.js';

const COLORS={
  'Patrimonio':'#86532f','Patrimonio interior':'#86532f','Historia':'#806946',
  'Naturaleza':'#427a50','Agua / molinos':'#3e7f9a','Cultura / comunidad':'#8b5f82',
  'Ruta / patrimonio':'#b26138','Comer':'#b06c2d','Dormir':'#536f8e'
};
const PATHS={track:'#876846',path:'#bd653c',foot:'#5a855f',local:'#77838b'};
let fieldVisible=true,pathVisible=true,placeVisible=false,poiVisible=true;
let categoryFilter=[],routeRelatedIds=null;

export async function initMap(){
  const style=navigator.onLine?'data/generated/online-style.json':'data/offline-style.json';
  S.map=new maplibregl.Map({container:'map',style,center:[-8.356,42.209],zoom:13,attributionControl:true});
  S.map.addControl(new maplibregl.NavigationControl({showCompass:true}),'top-right');
  S.map.on('error',e=>recordError(e?.error||e,'map'));
  await new Promise(resolve=>S.map.once('load',resolve));
  await setupSources();bindMapEvents();fitInitial();$('#mapStatus').textContent='Mapa listo';
  return S.map;
}
async function setupSources(){
  addPnoa();addPoiSource();renderPriorityMarkers();addPlaces();addPaths();addOfficialContext();await updateFieldLayer();addRouteSource();addImportedSource();
}
function addPnoa(){
  if(S.map.getSource('pnoa'))return;
  S.map.addSource('pnoa',{type:'raster',tiles:['https://www.ign.es/wmts/pnoa-ma?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=OI.OrthoimageCoverage&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg'],tileSize:256,minzoom:1,maxzoom:19,attribution:'PNOA © IGN-CNIG'});
  S.map.addLayer({id:'pnoa',type:'raster',source:'pnoa',layout:{visibility:'none'},paint:{'raster-opacity':1}},S.map.getStyle().layers.find(l=>l.type==='symbol')?.id);
}
function isPriority(x){return /^(Muy alta|Alta)$/i.test(x.priority||'')&&!!x.coordinates;}
function currentPois(){
  let rows=visiblePois().filter(x=>x.coordinates);
  if(categoryFilter.length)rows=rows.filter(x=>categoryFilter.includes(x.type));
  if(routeRelatedIds)rows=rows.filter(x=>routeRelatedIds.has(x.id));
  return rows;
}
function normalGeo(){
  return {type:'FeatureCollection',features:currentPois().filter(x=>!isPriority(x)).map(x=>({type:'Feature',properties:{id:x.id,name:x.name,type:x.type||'',color:colorFor(x.type)},geometry:{type:'Point',coordinates:x.coordinates}}))};
}
function addPoiSource(){
  S.map.addSource('pois',{type:'geojson',data:normalGeo(),cluster:true,clusterMaxZoom:15,clusterRadius:46});
  S.map.addLayer({id:'poi-clusters',type:'circle',source:'pois',filter:['has','point_count'],paint:{
    'circle-color':'#244b3a','circle-radius':['step',['get','point_count'],16,8,20,20,24,40,28],
    'circle-stroke-color':'#fff','circle-stroke-width':2,'circle-opacity':.92
  }});
  S.map.addLayer({id:'poi-points',type:'circle',source:'pois',filter:['!',['has','point_count']],paint:{
    'circle-color':['get','color'],'circle-radius':['interpolate',['linear'],['zoom'],11,5,15,7.5,18,9],
    'circle-stroke-color':'#fff','circle-stroke-width':2
  }});
}
function renderPriorityMarkers(){
  S.priorityMarkers.forEach(m=>m.remove());S.priorityMarkers=[];
  if(!S.map||!poiVisible)return;
  currentPois().filter(isPriority).forEach(x=>{
    const el=document.createElement('button');
    el.className='priority-marker '+typeClass(x.type);
    el.type='button';el.title=x.name;el.setAttribute('aria-label',x.name);
    el.innerHTML='<span class="priority-icon">'+categoryIcon(x.type)+'</span>';
    el.onclick=e=>{e.stopPropagation();emit('open-poi',x.id);};
    const m=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat(x.coordinates).addTo(S.map);
    S.priorityMarkers.push(m);
  });
}
function addPlaces(){
  const data={type:'FeatureCollection',features:S.places.map(x=>({type:'Feature',properties:{id:x.id,name:x.name},geometry:{type:'Point',coordinates:x.coordinates}}))};
  S.map.addSource('places',{type:'geojson',data});
  S.map.addLayer({id:'places',type:'circle',source:'places',layout:{visibility:'none'},paint:{'circle-radius':7,'circle-color':'#fff','circle-stroke-color':'#244b3a','circle-stroke-width':3}});
}
function pathKind(p){const h=p.highway;return h==='track'?'track':h==='path'?'path':(h==='footway'||h==='bridleway')?'foot':'local';}
function addPaths(){
  const data={type:'FeatureCollection',features:(S.osmNetwork?.features||[]).map(f=>({...f,properties:{...f.properties,kind:pathKind(f.properties||{})}}))};
  S.map.addSource('paths',{type:'geojson',data});
  for(const [kind,color] of Object.entries(PATHS)){
    S.map.addLayer({id:'paths-'+kind,type:'line',source:'paths',filter:['==',['get','kind'],kind],paint:{
      'line-color':color,'line-width':['interpolate',['linear'],['zoom'],11,.8,15,2.2,18,4],'line-opacity':.8,
      ...(kind==='path'||kind==='foot'?{'line-dasharray':[2,1.5]}:{})
    }});
  }
}
async function addOfficialContext(){
  for(const [name,file,color] of [['parish','data/generated/parish.geojson','#315c48'],['hydro','data/generated/hydro.geojson','#4d8dad']]){
    try{
      const r=await fetch(file);if(!r.ok)continue;const data=await r.json();
      S.map.addSource(name,{type:'geojson',data});
      if(name==='parish'){
        S.map.addLayer({id:'parish-fill',type:'fill',source:name,layout:{visibility:'none'},paint:{'fill-color':color,'fill-opacity':.05}});
        S.map.addLayer({id:'parish-line',type:'line',source:name,layout:{visibility:'none'},paint:{'line-color':color,'line-width':2,'line-dasharray':[2,2]}});
      }else S.map.addLayer({id:'hydro-line',type:'line',source:name,layout:{visibility:'none'},paint:{'line-color':color,'line-width':1.4,'line-opacity':.75}});
    }catch(e){recordError(e,'official-context');}
  }
}
export async function updateFieldLayer(){
  const rows=await dbGetAll('records').catch(()=>[]);
  const data={type:'FeatureCollection',features:rows.filter(r=>r.coordinates).map(r=>({type:'Feature',properties:{id:r.id,name:r.name||r.localName||'Campo'},geometry:{type:'Point',coordinates:r.coordinates}}))};
  if(S.map?.getSource('field'))S.map.getSource('field').setData(data);
  else if(S.map){
    S.map.addSource('field',{type:'geojson',data});
    S.map.addLayer({id:'field',type:'circle',source:'field',paint:{'circle-radius':7,'circle-color':'#287da1','circle-stroke-color':'#fff','circle-stroke-width':2}});
  }
  if(S.map?.getLayer('field'))S.map.setLayoutProperty('field','visibility',fieldVisible?'visible':'none');
}
function addRouteSource(){
  S.map.addSource('active-route',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  S.map.addLayer({id:'active-route-case',type:'line',source:'active-route',paint:{'line-color':'#fff','line-width':['interpolate',['linear'],['zoom'],10,6,15,9,18,12],'line-opacity':.96}});
  S.map.addLayer({id:'active-route-line',type:'line',source:'active-route',paint:{'line-color':'#e0b51b','line-width':['interpolate',['linear'],['zoom'],10,3.5,15,6,18,8],'line-opacity':.98}});
}
function addImportedSource(){
  S.map.addSource('imported-route',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  S.map.addLayer({id:'imported-route-line',type:'line',source:'imported-route',paint:{'line-color':'#8c4f84','line-width':5,'line-dasharray':[2,1]}});
}
function bindMapEvents(){
  $('#mapModeBtn').onclick=()=>setBasemap('map');$('#satModeBtn').onclick=()=>setBasemap('satellite');
  $('#locateBtn').onclick=()=>locate(true);$('#layersBtn').onclick=()=>$('#layersPanel').hidden=!$('#layersPanel').hidden;$('#layersClose').onclick=()=>$('#layersPanel').hidden=true;
  $$('[data-layer]').forEach(x=>x.onchange=()=>toggleLayer(x.dataset.layer,x.checked));
  S.map.on('click','poi-clusters',async e=>{const f=e.features?.[0];if(!f)return;toast((f.properties.point_count||'Varios')+' lugares');const z=await S.map.getSource('pois').getClusterExpansionZoom(f.properties.cluster_id);S.map.easeTo({center:f.geometry.coordinates,zoom:z});});
  S.map.on('click','poi-points',e=>{const id=e.features?.[0]?.properties?.id;if(id)emit('open-poi',id);});
  S.map.on('click','places',e=>{const id=e.features?.[0]?.properties?.id;if(id)emit('open-place',id);});
  S.map.on('click','field',async e=>{const id=e.features?.[0]?.properties?.id;if(id){const rows=await dbGetAll('records');emit('open-field',rows.find(x=>x.id===id));}});
  for(const id of ['paths-track','paths-path','paths-foot','paths-local'])S.map.on('click',id,e=>{const p=e.features?.[0]?.properties||{};emit('open-path',{...p,coordinates:e.lngLat.toArray()});});
  S.map.on('moveend',emitViewport);
  S.map.on('click',e=>{if(S.mapPickResolver){const fn=S.mapPickResolver;S.mapPickResolver=null;fn([e.lngLat.lng,e.lngLat.lat]);toast('Punto seleccionado');}});
  window.addEventListener('alm:focus-poi',e=>focusPoi(e.detail));
}
function emitViewport(){
  if(!S.map)return;const b=S.map.getBounds(),center=S.map.getCenter().toArray();
  const rows=currentPois().filter(x=>b.contains(x.coordinates)).map(x=>({...x,_mapd:distanceM(center,x.coordinates)})).sort((a,b)=>{
    const pa=isPriority(a)?0:1,pb=isPriority(b)?0:1;return pa-pb||a._mapd-b._mapd;
  }).slice(0,12);
  S.lastViewportPois=rows;emit('viewport-pois',rows);
}
function toggleLayer(name,on){
  if(name==='pois'){poiVisible=on;for(const id of ['poi-clusters','poi-points'])vis(id,on);S.priorityMarkers.forEach(m=>m.getElement().style.display=on?'':'none');}
  if(name==='places'){placeVisible=on;vis('places',on);}
  if(name==='paths'){pathVisible=on;for(const id of ['paths-track','paths-path','paths-foot','paths-local'])vis(id,on);}
  if(name==='field'){fieldVisible=on;vis('field',on);}
  if(name==='hydro')vis('hydro-line',on);
  if(name==='parish'){vis('parish-fill',on);vis('parish-line',on);}
}
function vis(id,on){if(S.map?.getLayer(id))S.map.setLayoutProperty(id,'visibility',on?'visible':'none');}
export function refreshPoiSource(){S.map?.getSource('pois')?.setData(normalGeo());renderPriorityMarkers();emitViewport();}
export function setCategoryFilter(categories=[]){categoryFilter=[...categories];refreshPoiSource();}
function setBasemap(mode){vis('pnoa',mode==='satellite');$('#mapModeBtn').classList.toggle('active',mode==='map');$('#satModeBtn').classList.toggle('active',mode==='satellite');}
export async function locate(center=false){
  if(!navigator.geolocation){toast('GPS no disponible');return null;}
  return new Promise(resolve=>navigator.geolocation.getCurrentPosition(pos=>{
    const c=[pos.coords.longitude,pos.coords.latitude];S.userPosition=c;updateUserMarker(c);
    if(center)S.map?.easeTo({center:c,zoom:17});emit('location',{coordinates:c,accuracy:pos.coords.accuracy});resolve({coordinates:c,accuracy:pos.coords.accuracy});
  },()=>{toast('No se pudo obtener la ubicación');resolve(null);},{enableHighAccuracy:true,timeout:15000,maximumAge:3000}));
}
export function updateUserMarker(c){
  if(!S.map)return;if(S.userMarker)S.userMarker.remove();const el=document.createElement('div');el.className='user-dot';S.userMarker=new maplibregl.Marker({element:el}).setLngLat(c).addTo(S.map);
}
export function pickMapPoint(){toast('Toca el lugar exacto en el mapa');return new Promise(resolve=>{S.mapPickResolver=resolve;setDrawerMapFocus();});}
function setDrawerMapFocus(){const d=$('#drawer');d.classList.remove('full','half');d.classList.add('collapsed');d.style.height='';}
export function focusPoi(x){
  const p=typeof x==='string'?S.pois.find(v=>v.id===x):x;if(!p?.coordinates||!S.map)return;
  S.map.easeTo({center:p.coordinates,zoom:Math.max(S.map.getZoom(),16),duration:650});
}
export function showRouteGeoJSON(geo,opts={}){
  if(!geo?.features?.length)return false;
  S.map.getSource('active-route')?.setData(geo);S.map.setPaintProperty('active-route-line','line-color',opts.color||'#e0b51b');
  categoryFilter=[];routeRelatedIds=opts.relatedIds?new Set(opts.relatedIds):null;S.activeRoute={...opts,geo};emit('route-mode',opts);refreshPoiSource();fitGeo(geo);
  $('#activeRouteName').textContent=opts.name||'Ruta';$('#activeRouteBar').hidden=false;return true;
}
export function clearRouteGeoJSON(){
  S.map?.getSource('active-route')?.setData({type:'FeatureCollection',features:[]});S.activeRoute=null;routeRelatedIds=null;emit('route-mode-clear');refreshPoiSource();$('#activeRouteBar').hidden=true;$('#routeFollowPanel').hidden=true;
}
export function showImportedGeoJSON(geo){S.map?.getSource('imported-route')?.setData(geo);fitGeo(geo);}
export function clearImported(){S.map?.getSource('imported-route')?.setData({type:'FeatureCollection',features:[]});}
function fitGeo(geo){const b=new maplibregl.LngLatBounds();let n=0;walk(geo,c=>{b.extend(c);n++});if(n)S.map.fitBounds(b,{padding:{top:80,bottom:145,left:55,right:55},maxZoom:16,duration:800});}
function walk(o,fn){if(!o)return;if(Array.isArray(o)&&typeof o[0]==='number'){fn(o);return}if(Array.isArray(o)){o.forEach(x=>walk(x,fn));return}if(o.type==='FeatureCollection')o.features?.forEach(x=>walk(x,fn));else if(o.type==='Feature')walk(o.geometry,fn);else if(o.coordinates)walk(o.coordinates,fn);}
function fitInitial(){const pts=visiblePois().filter(x=>x.coordinates).map(x=>x.coordinates);if(!pts.length)return;const b=new maplibregl.LngLatBounds();pts.forEach(x=>b.extend(x));S.map.fitBounds(b,{padding:70,maxZoom:14,duration:0});emitViewport();}
function colorFor(t=''){return COLORS[t]||'#775f49';}
function categoryIcon(t=''){const s=t.toLowerCase();if(s.includes('agua')||s.includes('molino'))return'≈';if(s.includes('historia'))return'⌛';if(s.includes('natur'))return'♧';if(s.includes('ruta'))return'↝';if(s.includes('comer'))return'◉';if(s.includes('dormir'))return'⌂';if(s.includes('cultura'))return'✦';return'◆';}
function typeClass(t=''){const s=t.toLowerCase();if(s.includes('agua')||s.includes('molino'))return'water';if(s.includes('historia'))return'history';if(s.includes('natur'))return'nature';if(s.includes('ruta'))return'route';if(s.includes('comer'))return'food';if(s.includes('dormir'))return'sleep';return'heritage';}
