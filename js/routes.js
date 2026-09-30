import {S,$,$$,esc,toast,distanceM,formatDistance,recordError} from './state.js';
import {openSheet,closeSheets,openNav} from './ui.js';
import {showRouteGeoJSON,clearRouteGeoJSON,showImportedGeoJSON,updateUserMarker} from './map.js';

let selected=null,selectedGeo=null,lastNearest=null,lastOff=false;

export function initRoutes(){
  renderRoutes();window.addEventListener('alm:mode',renderRoutes);
  $('#activeRouteClose').onclick=()=>{stopFollowing();clearRouteGeoJSON();};
  $('#stopFollowingBtn').onclick=stopFollowing;$('#returnRouteBtn').onclick=()=>{if(lastNearest)S.map?.easeTo({center:lastNearest,zoom:17,duration:600});};
  $('#gpxImport').onchange=importGpx;
  window.addEventListener('alm:open-route',e=>openRoute(e.detail));
}
export function renderRoutes(){
  const host=$('#routeList'),trails=S.mode==='visitor'?S.trails.filter(r=>/oficial/i.test(r.class||'')):S.trails,project=S.mode==='research'?S.projectRoutes:[];
  host.innerHTML=trails.map(r=>{
    const official=/oficial/i.test(r.class||''),icon=official?'↝':'⌁';
    const facts=[r.distance,r.duration].filter(Boolean),difficulty=r.difficulty?'<span class="route-difficulty">'+esc(r.difficulty)+'</span>':'';
    return '<article class="route-row route-card '+(official?'official':'community')+'" data-route-id="'+esc(r.id)+'"><div class="route-row-icon">'+icon+'</div><div class="route-card-copy"><span class="route-kind">'+esc(r.class||'Ruta')+'</span><strong>'+esc(r.name)+'</strong><div class="route-card-meta">'+facts.map(v=>'<span>'+esc(v)+'</span>').join('')+difficulty+'</div></div><span class="route-open">Ver ruta ›</span></article>';
  }).join('')+(project.length?'<div class="section-note route-section-label"><b>Proyectos por verificar</b></div>'+project.map(r=>'<article class="route-row project" data-project-route="'+esc(r.ID)+'"><div class="route-row-icon">✎</div><div><span class="route-kind">Investigación</span><strong>'+esc(r['Nombre provisional'])+'</strong><small>'+esc(r['Tipo'])+' · '+esc(r['Estado'])+'</small></div><span class="route-arrow">›</span></article>').join(''):'');
  $$('[data-project-route]').forEach(x=>x.onclick=()=>openProjectRoute(x.dataset.projectRoute));
  $$('[data-route-id]').forEach(x=>x.onclick=()=>openRoute(x.dataset.routeId));
}
function openProjectRoute(id){
  const p=S.projectRoutes.find(r=>r.ID===id);if(!p)return;
  openSheet('#routeSheet','<div class="route-cover project-cover"><span class="route-cover-icon">✎</span><div><span class="eyebrow">RUTA POR VERIFICAR</span><h2>'+esc(p['Nombre provisional'])+'</h2></div></div><p>'+esc(p['Paradas candidatas'])+'</p><p class="section-note"><b>Siguiente trabajo:</b> '+esc(p['Trabajo siguiente'])+'</p><div class="sheet-actions"><button id="prepareProjectRoute" class="primary-btn">Preparar en Campo</button></div>','half');
  $('#prepareProjectRoute').onclick=()=>{closeSheets();openNav('field');setTimeout(()=>{const i=$('#trackName');if(i)i.value=p['Nombre provisional'];},100);};
}
export async function openRoute(id){
  const r=S.trails.find(x=>x.id===id);if(!r)return;selected=r;selectedGeo=null;
  if(id==='TR-OF-001')selectedGeo=await fetchGeo('data/generated/prg119.geojson');
  else if(id==='TR-OF-002')selectedGeo=await fetchGeo('data/generated/via-mariana.geojson');
  const canMap=selectedGeo?.features?.length,related=canMap?relatedPois(selectedGeo,320):[],profile=canMap?profileSvg(selectedGeo):'',start=canMap?firstCoord(selectedGeo):null;
  const metrics=[['Distancia',r.distance],['Tiempo',r.duration],['Desnivel',r.elevation],['Dificultad',r.difficulty]].filter(x=>x[1]);
  const relatedHtml=related.length?'<section class="route-pois"><h3>Qué vas a encontrar</h3><div class="route-poi-scroll">'+related.slice(0,10).map(p=>'<button data-route-poi="'+esc(p.id)+'">'+(p.image_url?'<img loading="lazy" decoding="async" src="'+esc(p.image_url)+'" alt="">':'<span>'+poiIcon(p.type)+'</span>')+'<small>'+esc(p.name)+'</small></button>').join('')+'</div></section>':'';
  const html='<div class="route-cover '+(/oficial/i.test(r.class||'')?'official-cover':'community-cover')+'"><span class="route-cover-icon">↝</span><div><span class="eyebrow">'+esc(r.class||'RUTA')+'</span><h2>'+esc(r.name)+'</h2></div></div>'+
    '<div class="route-metrics">'+metrics.map(m=>'<div><small>'+m[0]+'</small><strong>'+esc(m[1])+'</strong></div>').join('')+'</div>'+
    '<p class="route-summary">'+esc(r.description||'')+'</p>'+profile+relatedHtml+(r.warning?'<p class="route-warning">'+esc(r.warning)+'</p>':'')+
    '<div class="sheet-actions route-actions">'+
      (canMap?'<button id="showRouteBtn" class="primary-btn">Ver en mapa</button><button id="startRouteBtn" class="soft-btn">▶ Iniciar</button>':'')+
      (start?'<a class="soft-btn" id="routeDirections" target="_blank" rel="noopener" href="'+directionsUrl(start,r.name)+'">➜ Llegar al inicio</a>':'')+
      '<button id="shareRouteBtn" class="soft-btn">↗ Compartir</button>'+
    '</div>'+
    '<details class="sheet-more"><summary>Información y fuentes</summary><div class="detail-grid"><b>Tipo</b><span>'+esc(r.route_type||r.type||'')+'</span><b>Fuente</b><span>'+esc(r.source||'')+'</span></div><div class="source-links">'+
      (r.gpx_url?'<a href="'+esc(r.gpx_url)+'" target="_blank" rel="noopener">GPX oficial</a>':'')+
      (r.source_url?'<a href="'+esc(r.source_url)+'" target="_blank" rel="noopener">Fuente</a>':'')+
      (r.track_url?'<a href="'+esc(r.track_url)+'" target="_blank" rel="noopener">Track publicado</a>':'')+
    '</div></details>';
  openSheet('#routeSheet',html,'half');
  $$('[data-route-poi]').forEach(b=>b.onclick=()=>{closeSheets();const p=S.pois.find(x=>x.id===b.dataset.routePoi);if(p){S.map?.easeTo({center:p.coordinates,zoom:16});setTimeout(()=>window.dispatchEvent(new CustomEvent('alm:open-poi',{detail:p.id})),350);}});
  if($('#showRouteBtn'))$('#showRouteBtn').onclick=()=>{showSelectedRoute(related);closeSheets();};
  if($('#startRouteBtn'))$('#startRouteBtn').onclick=()=>{showSelectedRoute(related);startFollowing(r,selectedGeo);closeSheets();};
  $('#shareRouteBtn').onclick=()=>shareRoute(r);
}
async function fetchGeo(url){try{const r=await fetch(url);if(!r.ok)return null;return await r.json();}catch(e){recordError(e,'route-geo');return null;}}
function showSelectedRoute(related=[]){
  if(!selectedGeo?.features?.length){toast('No hay geometría local disponible');return;}
  showRouteGeoJSON(selectedGeo,{name:selected.name,color:selected.map_color||'#e0b51b',id:selected.id,relatedIds:related.map(x=>x.id)});
}
function flatten(geo){const out=[];for(const f of geo.features||[]){const c=f.geometry?.coordinates;if(f.geometry?.type==='LineString'&&Array.isArray(c))out.push(...c);}return out;}
function firstCoord(geo){return flatten(geo)[0]||null;}
function relatedPois(geo,threshold=300){
  const coords=flatten(geo),step=Math.max(1,Math.floor(coords.length/450)),sample=coords.filter((_,i)=>i%step===0);
  return S.pois.filter(p=>p.coordinates&&p.visitor_visible).map(p=>{
    let best=Infinity;for(const c of sample){const d=distanceM(c,p.coordinates);if(d<best)best=d;if(best<40)break;}
    return {...p,_routeD:best};
  }).filter(p=>p._routeD<=threshold).sort((a,b)=>a._routeD-b._routeD);
}
function profileSvg(geo){
  const f=geo.features?.[0],els=f?.properties?.elevations;if(!Array.isArray(els)||els.filter(Number.isFinite).length<3)return '';
  const vals=els.map(Number).filter(Number.isFinite),min=Math.min(...vals),max=Math.max(...vals),range=Math.max(1,max-min),w=340,h=115,pad=10;
  const pts=els.map((z,i)=>{const x=pad+(i/(els.length-1))*(w-pad*2),y=z==null?h-pad:h-pad-((Number(z)-min)/range)*(h-pad*2);return [x,y];});
  const line=pts.map(p=>p.join(',')).join(' '),area=pad+','+(h-pad)+' '+line+' '+(w-pad)+','+(h-pad);
  return '<section class="route-profile"><h3>Perfil de elevación</h3><svg class="profile" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Perfil de elevación"><polygon class="area" points="'+area+'"></polygon><polyline points="'+line+'"></polyline></svg><div class="profile-labels"><span>'+Math.round(min)+' m</span><span>'+Math.round(max)+' m</span></div></section>';
}
function startFollowing(route,geo){
  if(!navigator.geolocation){toast('GPS no disponible');return;}stopFollowing();
  const coords=flatten(geo);if(coords.length<2)return;
  const cum=[0];for(let i=1;i<coords.length;i++)cum[i]=cum[i-1]+distanceM(coords[i-1],coords[i]);const total=cum.at(-1);
  const sampleStep=Math.max(1,Math.ceil(coords.length/450));
  const sampleIdx=[];for(let i=0;i<coords.length;i+=sampleStep)sampleIdx.push(i);if(sampleIdx.at(-1)!==coords.length-1)sampleIdx.push(coords.length-1);
  const routePois=S.pois.filter(p=>p.coordinates&&p.visitor_visible).map(p=>{
    let routeIdx=0,routeD=Infinity;
    for(const i of sampleIdx){const d=distanceM(p.coordinates,coords[i]);if(d<routeD){routeD=d;routeIdx=i;}}
    const a=Math.max(0,routeIdx-sampleStep),z=Math.min(coords.length-1,routeIdx+sampleStep);
    for(let i=a;i<=z;i++){const d=distanceM(p.coordinates,coords[i]);if(d<routeD){routeD=d;routeIdx=i;}}
    return {p,routeIdx,routeD,along:cum[routeIdx]};
  }).filter(x=>x.routeD<=320).sort((a,b)=>a.along-b.along);
  const watch=navigator.geolocation.watchPosition(pos=>{
    if(Number.isFinite(pos.coords.accuracy)&&pos.coords.accuracy>100){
      $('#routeFollowStatus').textContent='Señal GPS débil';
      $('#routeDeviation').textContent='±'+Math.round(pos.coords.accuracy)+' m';
      return;
    }
    const c=[pos.coords.longitude,pos.coords.latitude];S.userPosition=c;updateUserMarker(c);
    let rough=0,best=Infinity;
    for(const i of sampleIdx){const d=distanceM(c,coords[i]);if(d<best){best=d;rough=i;}}
    let idx=rough;const a=Math.max(0,rough-sampleStep),z=Math.min(coords.length-1,rough+sampleStep);
    for(let i=a;i<=z;i++){const d=distanceM(c,coords[i]);if(d<best){best=d;idx=i;}}
    lastNearest=coords[idx];const remaining=Math.max(0,total-cum[idx]),progress=total?cum[idx]/total:0;
    $('#followDistance').textContent=formatDistance(remaining);$('#routeRemaining').textContent=formatDistance(remaining)+' restantes';$('#followProgressBar').style.width=Math.round(progress*100)+'%';
    const off=best>80;$('#routeFollowStatus').textContent=off?'Fuera del trazado':'Sobre la ruta';$('#routeDeviation').textContent=off?'⚠ '+Math.round(best)+' m':'✓';$('#returnRouteBtn').hidden=!off;
    if(off&&!lastOff&&navigator.vibrate)navigator.vibrate([120,80,120]);lastOff=off;
    const next=routePois.find(x=>x.along>cum[idx]+25);
    const nextD=next?Math.max(0,next.along-cum[idx]):Infinity;
    $('#followNearestPoi').textContent=next?next.p.name+' · '+formatDistance(nextD):'Final de ruta';
  },e=>{recordError(e,'route-follow');toast('Se perdió la señal GPS');},{enableHighAccuracy:true,maximumAge:2000,timeout:15000});
  S.routeFollow={watch,routeId:route.id};$('#routeFollowPanel').hidden=false;$('#activeRouteBar').hidden=true;$('#nearbyStrip').hidden=true;document.body.classList.add('route-following');$('#routeFollowStatus').textContent='Buscando posición…';toast('Seguimiento de ruta iniciado');
}
export function stopFollowing(){
  if(S.routeFollow?.watch!=null)navigator.geolocation.clearWatch(S.routeFollow.watch);
  S.routeFollow=null;lastNearest=null;lastOff=false;$('#routeFollowPanel').hidden=true;$('#returnRouteBtn').hidden=true;$('#routeRemaining').textContent='';$('#routeDeviation').textContent='';document.body.classList.remove('route-following');if(selected)$('#activeRouteBar').hidden=false;
}
async function importGpx(e){
  const file=e.target.files?.[0];if(!file)return;
  try{
    const text=await file.text(),coords=[];for(const m of text.matchAll(/<(?:trkpt|rtept)\b[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>/gi))coords.push([Number(m[2]),Number(m[1])]);
    if(coords.length<2)throw new Error('GPX sin puntos suficientes');
    const geo={type:'FeatureCollection',features:[{type:'Feature',properties:{name:file.name},geometry:{type:'LineString',coordinates:coords}}]};showImportedGeoJSON(geo);toast('GPX importado · '+coords.length+' puntos');closeSheets();
  }catch(err){recordError(err,'gpx-import');toast('No se pudo importar el GPX');}e.target.value='';
}
function shareRoute(r){
  const u=new URL(location.origin+location.pathname),v=new URLSearchParams(location.search).get('v');
  if(v)u.searchParams.set('v',v);u.hash='route='+encodeURIComponent(r.id);
  const url=u.toString();
  if(navigator.share)return navigator.share({title:r.name,text:'Ruta en Descubre A Lamosa',url}).catch(()=>{});
  navigator.clipboard?.writeText(url).then(()=>toast('Enlace copiado')).catch(()=>toast('No se pudo compartir'));
}
function directionsUrl(c,name){return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(c[1]+','+c[0])+'&travelmode=walking';}
function poiIcon(t=''){const s=t.toLowerCase();if(s.includes('agua')||s.includes('molino'))return'≈';if(s.includes('historia'))return'⌛';if(s.includes('natur'))return'♧';if(s.includes('ruta'))return'↝';if(s.includes('comer'))return'◉';if(s.includes('dormir'))return'⌂';return'◆';}
