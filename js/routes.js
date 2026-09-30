import {S,$,$$,esc,toast,distanceM,formatDistance,emit,recordError} from './state.js';
import {openSheet,closeSheets} from './ui.js';
import {showRouteGeoJSON,clearRouteGeoJSON,showImportedGeoJSON,updateUserMarker} from './map.js';

let selected=null,selectedGeo=null;
export function initRoutes(){
  renderRoutes();
  window.addEventListener('alm:mode',renderRoutes);
  $('#activeRouteClose').onclick=()=>{stopFollowing();clearRouteGeoJSON();};
  $('#stopFollowingBtn').onclick=stopFollowing;
  $('#gpxImport').onchange=importGpx;
}
export function renderRoutes(){
  const host=$('#routeList');
  const trails=S.mode==='visitor'?S.trails.filter(r=>/oficial/i.test(r.class||'')):S.trails;
  const project=S.mode==='research'?S.projectRoutes:[];
  host.innerHTML=trails.map(r=>{
    const official=/oficial/i.test(r.class||'');
    return '<article class="route-row" data-route-id="'+esc(r.id)+'"><div><span class="badge '+(official?'':'pending')+'">'+esc(r.class||'Ruta')+'</span></div><strong>'+esc(r.name)+'</strong><small>'+esc([r.distance,r.duration,r.difficulty].filter(Boolean).join(' · '))+'</small></article>';
  }).join('')+(project.length?'<div class="section-note"><b>Proyectos por verificar</b></div>'+project.map(r=>'<article class="route-row" data-project-route="'+esc(r.ID)+'"><span class="badge pending">Investigación</span><strong>'+esc(r['Nombre provisional'])+'</strong><small>'+esc(r['Tipo'])+' · '+esc(r['Estado'])+'</small></article>').join(''):'');
  $('[data-project-route]').forEach(x=>x.onclick=()=>{const p=S.projectRoutes.find(r=>r.ID===x.dataset.projectRoute);if(!p)return;openSheet('#routeSheet','<div class="sheet-title"><span class="eyebrow">RUTA POR VERIFICAR</span><h2>'+esc(p['Nombre provisional'])+'</h2></div><p>'+esc(p['Paradas candidatas'])+'</p><p class="section-note"><b>Siguiente trabajo:</b> '+esc(p['Trabajo siguiente'])+'</p><div class="sheet-actions"><button id="prepareProjectRoute" class="primary-btn">Preparar en Campo</button></div>','half');$('#prepareProjectRoute').onclick=()=>{closeSheets();document.querySelector('[data-nav="field"]')?.click();setTimeout(()=>{const i=document.querySelector('#trackName');if(i)i.value=p['Nombre provisional'];},100);};});
  $('[data-route-id]').forEach(x=>x.onclick=()=>openRoute(x.dataset.routeId));
}
async function openRoute(id){
  const r=S.trails.find(x=>x.id===id);if(!r)return;selected=r;selectedGeo=null;
  if(id==='TR-OF-001')selectedGeo=await fetchGeo('data/generated/prg119.geojson');
  else if(id==='TR-OF-002')selectedGeo=await fetchGeo('data/generated/via-mariana.geojson');
  const canMap=selectedGeo?.features?.length;
  const profile=canMap?profileSvg(selectedGeo):'';
  const html='<div class="sheet-title"><span class="eyebrow">'+esc(r.class||'RUTA')+'</span><h2>'+esc(r.name)+'</h2></div>'+
    '<p>'+esc(r.description||'')+'</p><div class="chip-scroll">'+[r.distance,r.duration,r.elevation,r.difficulty,r.route_type].filter(Boolean).map(x=>'<span class="badge">'+esc(x)+'</span>').join('')+'</div>'+
    profile+(r.warning?'<p class="section-note">'+esc(r.warning)+'</p>':'')+
    '<div class="sheet-actions">'+
      (canMap?'<button id="showRouteBtn" class="primary-btn">Ver trazado</button><button id="startRouteBtn" class="soft-btn">Iniciar ruta</button>':'')+
      (r.gpx_url?'<a class="soft-btn" href="'+esc(r.gpx_url)+'" target="_blank" rel="noopener">GPX oficial</a>':'')+
      (r.source_url?'<a class="soft-btn" href="'+esc(r.source_url)+'" target="_blank" rel="noopener">Fuente</a>':'')+
      (r.track_url?'<a class="soft-btn" href="'+esc(r.track_url)+'" target="_blank" rel="noopener">Track</a>':'')+
    '</div>';
  openSheet('#routeSheet',html,'half');
  if($('#showRouteBtn'))$('#showRouteBtn').onclick=()=>{showSelectedRoute();closeSheets();};
  if($('#startRouteBtn'))$('#startRouteBtn').onclick=()=>{showSelectedRoute();startFollowing(r,selectedGeo);closeSheets();};
}
async function fetchGeo(url){try{const r=await fetch(url);if(!r.ok)return null;return await r.json();}catch(e){recordError(e,'route-geo');return null;}}
function showSelectedRoute(){
  if(!selectedGeo?.features?.length){toast('No hay geometría local disponible');return;}
  showRouteGeoJSON(selectedGeo,{name:selected.name,color:selected.map_color||'#e0b51b',id:selected.id});
}
function flatten(geo){const out=[];for(const f of geo.features||[]){const c=f.geometry?.coordinates;if(f.geometry?.type==='LineString'&&Array.isArray(c))out.push(...c);}return out;}
function profileSvg(geo){
  const f=geo.features?.[0],els=f?.properties?.elevations;if(!Array.isArray(els)||els.filter(Number.isFinite).length<3)return '';
  const vals=els.map(Number).filter(Number.isFinite),min=Math.min(...vals),max=Math.max(...vals),range=Math.max(1,max-min),w=320,h=105,pad=8;
  const pts=els.map((z,i)=>{const x=pad+(i/(els.length-1))*(w-pad*2),y=z==null?h-pad:h-pad-((Number(z)-min)/range)*(h-pad*2);return [x,y];});
  const line=pts.map(p=>p.join(',')).join(' ');
  const area=pad+','+(h-pad)+' '+line+' '+(w-pad)+','+(h-pad);
  return '<svg class="profile" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Perfil de elevación"><polygon class="area" points="'+area+'"></polygon><polyline points="'+line+'"></polyline></svg><div class="section-note">Altitud '+Math.round(min)+'–'+Math.round(max)+' m</div>';
}
function startFollowing(route,geo){
  if(!navigator.geolocation){toast('GPS no disponible');return;}
  stopFollowing();
  const coords=flatten(geo);if(coords.length<2)return;
  const cum=[0];for(let i=1;i<coords.length;i++)cum[i]=cum[i-1]+distanceM(coords[i-1],coords[i]);
  const total=cum.at(-1);
  const watch=navigator.geolocation.watchPosition(pos=>{
    const c=[pos.coords.longitude,pos.coords.latitude];S.userPosition=c;updateUserMarker(c);
    let idx=0,best=Infinity;
    for(let i=0;i<coords.length;i++){const d=distanceM(c,coords[i]);if(d<best){best=d;idx=i;}}
    const remaining=Math.max(0,total-cum[idx]),progress=total?cum[idx]/total:0;
    $('#followDistance').textContent=formatDistance(remaining);
    $('#routeRemaining').textContent=formatDistance(remaining)+' restantes';
    $('#followProgressBar').style.width=Math.round(progress*100)+'%';
    const off=best>80;$('#routeDeviation').textContent=off?'⚠ '+Math.round(best)+' m fuera':'✓ sobre ruta';
    $('#routeDeviation').style.color=off?'#ffd27a':'#bce4c8';
    const nearest=S.pois.filter(x=>x.coordinates).map(x=>({...x,_d:distanceM(c,x.coordinates)})).sort((a,b)=>a._d-b._d)[0];
    $('#followNearestPoi').textContent=nearest&&nearest._d<1200?nearest.name+' · '+formatDistance(nearest._d):'—';
  },e=>{recordError(e,'route-follow');toast('Se perdió la señal GPS');},{enableHighAccuracy:true,maximumAge:2000,timeout:15000});
  S.routeFollow={watch,routeId:route.id};$('#routeFollowPanel').hidden=false;toast('Seguimiento de ruta iniciado');
}
export function stopFollowing(){
  if(S.routeFollow?.watch!=null)navigator.geolocation.clearWatch(S.routeFollow.watch);
  S.routeFollow=null;$('#routeFollowPanel').hidden=true;$('#routeRemaining').textContent='';$('#routeDeviation').textContent='';
}
async function importGpx(e){
  const file=e.target.files?.[0];if(!file)return;
  try{
    const text=await file.text(),coords=[];
    for(const m of text.matchAll(/<(?:trkpt|rtept)\b[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>/gi)){
      coords.push([Number(m[2]),Number(m[1])]);
    }
    if(coords.length<2)throw new Error('GPX sin puntos suficientes');
    const geo={type:'FeatureCollection',features:[{type:'Feature',properties:{name:file.name},geometry:{type:'LineString',coordinates:coords}}]};
    showImportedGeoJSON(geo);toast('GPX importado · '+coords.length+' puntos');closeSheets();
  }catch(err){recordError(err,'gpx-import');toast('No se pudo importar el GPX');}
  e.target.value='';
}
