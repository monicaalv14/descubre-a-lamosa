import {S,$,$$,esc,toast,setMode,setLang,favorites,setFavorite,distanceM,formatDistance,dbGetAll,emit} from './state.js';
import {t,applyI18n} from './i18n.js';
import {visiblePois} from './data.js';
import {locate,setCategoryFilter,refreshPoiSource,showImportedGeoJSON} from './map.js';

let selectedCategories=new Set(),favoritesOnly=false,search='';
export function initUI(){
  bindNavigation();bindDrawer();bindSheets();bindExplore();bindSettings();renderStories();
  $('#languageSelect').value=S.lang;$('#modeSelect').value=S.mode;applyMode();applyI18n();renderExplore();
  window.addEventListener('alm:viewport-pois',e=>renderViewport(e.detail||[]));
  window.addEventListener('alm:open-poi',e=>openPoi(e.detail));
  window.addEventListener('alm:open-place',e=>openPlace(e.detail));
  window.addEventListener('alm:open-path',e=>openPath(e.detail));
  window.addEventListener('alm:open-field',e=>openField(e.detail));
  window.addEventListener('alm:favorites',renderExplore);
  window.addEventListener('alm:mode',()=>{applyMode();refreshPoiSource();renderExplore();renderStories();});
  window.addEventListener('alm:lang',()=>{applyI18n();renderExplore();renderStories();});
}
function bindNavigation(){
  $$('[data-nav]').forEach(b=>b.onclick=()=>openNav(b.dataset.nav));
  $('#collapseDrawerBtn').onclick=()=>setDrawer('collapsed');
}
export function openNav(name){
  $$('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===name));
  $$('.drawer-view').forEach(v=>v.classList.toggle('active',v.dataset.view===name));
  setDrawer(name==='explore'?'half':'full');
}
function setDrawer(size){
  const d=$('#drawer');d.classList.remove('collapsed','half','full');d.classList.add(size);
}
function bindDrawer(){
  const h=$('[data-drawer-drag]');if(!h)return;let y=0;
  h.onpointerdown=e=>{y=e.clientY;h.setPointerCapture(e.pointerId);};
  h.onpointerup=e=>{const dy=e.clientY-y;if(dy>80)setDrawer('collapsed');else if(dy<-80)setDrawer('full');else setDrawer('half');};
}
function bindSheets(){
  $$('[data-close-sheet]').forEach(b=>b.onclick=closeSheets);
  $('#sheetBackdrop').onclick=closeSheets;
  $$('[data-sheet-drag]').forEach(h=>{let y=0;h.onpointerdown=e=>{y=e.clientY;h.setPointerCapture(e.pointerId)};h.onpointerup=e=>{const sh=h.closest('.entity-sheet'),dy=e.clientY-y;if(dy>120)closeSheets();else{sh.classList.remove('half','full');sh.classList.add(dy<-70?'full':'half');}};});
}
export function openSheet(id,html,mode='half'){
  const el=$(id);if(!el)return;const body=el.querySelector('[id$="Body"]');if(body)body.innerHTML=html;
  $$('.entity-sheet').forEach(x=>{x.classList.remove('open');x.hidden=true;});
  el.hidden=false;el.classList.remove('half','full');el.classList.add(mode);
  $('#sheetBackdrop').hidden=false;requestAnimationFrame(()=>el.classList.add('open'));
}
export function closeSheets(){
  $$('.entity-sheet').forEach(x=>x.classList.remove('open'));
  $('#sheetBackdrop').hidden=true;
  setTimeout(()=>$$('.entity-sheet').forEach(x=>x.hidden=true),210);
}
function bindExplore(){
  $('#searchInput').oninput=e=>{search=e.target.value.toLowerCase().trim();renderExplore();};
  $('#favoritesBtn').onclick=()=>{favoritesOnly=!favoritesOnly;$('#favoritesBtn').classList.toggle('active',favoritesOnly);renderExplore();};
  $('#nearbyBtn').onclick=async()=>{
    const pos=await locate(false);if(!pos)return;const rows=visiblePois().filter(x=>x.coordinates).map(x=>({...x,_d:distanceM(pos.coordinates,x.coordinates)})).filter(x=>x._d<=1500).sort((a,b)=>a._d-b._d);
    renderViewport(rows.slice(0,12),true);toast(rows.length?rows.length+' lugares en 1,5 km':'No hay lugares cercanos en el inventario');};
}
function applyMode(){document.body.dataset.mode=S.mode;$('#modeSelect').value=S.mode;}
function bindSettings(){
  $('#modeSelect').onchange=e=>setMode(e.target.value);
  $('#languageSelect').onchange=e=>setLang(e.target.value);
}
export function renderExplore(){
  const rows0=visiblePois(),cats=[...new Set(rows0.map(x=>x.type).filter(Boolean))].sort();
  $('#categoryChips').innerHTML='<button class="filter-chip '+(!selectedCategories.size?'active':'')+'" data-cat="">Todo</button>'+cats.map(c=>'<button class="filter-chip '+(selectedCategories.has(c)?'active':'')+'" data-cat="'+esc(c)+'">'+icon(c)+' '+esc(c)+'</button>').join('');
  $$('[data-cat]').forEach(b=>b.onclick=()=>{const c=b.dataset.cat;if(!c)selectedCategories.clear();else selectedCategories.has(c)?selectedCategories.delete(c):selectedCategories.add(c);setCategoryFilter([...selectedCategories]);renderExplore();});
  const fav=favorites();
  let rows=rows0.filter(x=>(!selectedCategories.size||selectedCategories.has(x.type))&&(!search||Object.values(x).join(' ').toLowerCase().includes(search))&&(!favoritesOnly||fav.has(x.id)));
  if(S.userPosition)rows=rows.map(x=>({...x,_d:x.coordinates?distanceM(S.userPosition,x.coordinates):Infinity})).sort((a,b)=>a._d-b._d);
  $('#exploreSummary').textContent=rows.length+' lugares'+(S.mode==='research'?' · incluyendo pendientes':' verificados');
  $('#exploreList').innerHTML=rows.slice(0,120).map(x=>row(x,fav.has(x.id))).join('');
  $$('[data-poi-row]').forEach(e=>e.onclick=()=>openPoi(e.dataset.poiRow));
  $$('[data-fav]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.fav;setFavorite(id,!favorites().has(id));});
}
function row(x,isFav){
  const d=Number.isFinite(x._d)?' · '+formatDistance(x._d):'';
  return '<article class="list-row" data-poi-row="'+esc(x.id)+'"><div class="ico">'+icon(x.type)+'</div><div><strong>'+esc(x.name)+'</strong><small>'+esc(x.area||'')+d+'</small></div><div><span class="badge '+(x.coordinates?'':'pending')+'">'+(x.coordinates?'Mapa':t('pending'))+'</span><button class="star-btn" data-fav="'+esc(x.id)+'">'+(isFav?'★':'☆')+'</button></div></article>';
}
function renderViewport(rows,near=false){
  const host=$('#nearbyStrip');if(!rows?.length){host.hidden=true;return;}
  host.innerHTML=rows.map(x=>{const d=near&&Number.isFinite(x._d)?'<small>'+formatDistance(x._d)+'</small>':'';return '<button class="nearby-card" data-near-poi="'+esc(x.id)+'"><strong>'+esc(x.name)+'</strong>'+d+'</button>';}).join('');
  host.hidden=false;$$('[data-near-poi]').forEach(b=>b.onclick=()=>openPoi(b.dataset.nearPoi));
}
export function openPoi(id){
  const x=S.pois.find(p=>p.id===id);if(!x)return;const fav=favorites().has(id),d=S.userPosition&&x.coordinates?formatDistance(distanceM(S.userPosition,x.coordinates)):'';
  const photos=[];if(x.image_url)photos.push({url:x.image_url,credit:x.image_credit||''});
  if(Array.isArray(x.images))photos.push(...x.images);
  const hero=photos[0]?'<figure class="hero-photo"><img src="'+esc(photos[0].url)+'" alt="'+esc(x.name)+'"><figcaption>'+esc(photos[0].credit||'')+'</figcaption></figure>':'';
  const gallery=photos.length>1?'<div class="gallery-strip">'+photos.slice(1).map(p=>'<img src="'+esc(p.url)+'" alt="">').join('')+'</div>':'';
  const research=S.mode==='research'&&!x.coordinates?'<button class="soft-btn" id="poiFieldBtn">Localizar</button>':'';
  const html='<div class="sheet-title"><span class="eyebrow">'+esc(x.type||'LUGAR')+'</span><h2>'+esc(x.name)+'</h2></div>'+hero+gallery+
    '<p>'+esc(x.description||'')+'</p><div class="chip-scroll"><span class="badge">'+esc(x.subtype||x.type||'')+'</span>'+(d?'<span class="badge">'+d+'</span>':'')+'<span class="badge '+(x.coordinates?'':'pending')+'">'+(x.coordinates?t('publicData'):t('pending'))+'</span></div>'+
    '<div class="sheet-actions"><button class="primary-btn" id="poiListenBtn">▶ '+t('listen')+'</button><button class="soft-btn" id="poiFavBtn">'+(fav?'★':'☆')+' '+t('favorites')+'</button>'+research+'</div>'+
    '<details class="sheet-more"><summary>'+t('info')+' · '+t('sources')+'</summary><div class="detail-grid"><b>Zona</b><span>'+esc(x.area||'')+'</span><b>Acceso</b><span>'+esc(x.access||'')+'</span><b>Estado</b><span>'+esc(x.status||'')+'</span><b>Comprobar</b><span>'+esc(x.verify||'')+'</span><b>Fuente</b><span>'+sourceHtml(x)+'</span></div></details>';
  openSheet('#poiSheet',html,'half');
  $('#poiListenBtn').onclick=()=>emit('speak-poi',x);
  $('#poiFavBtn').onclick=()=>{setFavorite(id,!favorites().has(id));openPoi(id);};
  if($('#poiFieldBtn'))$('#poiFieldBtn').onclick=()=>{closeSheets();openNav('field');emit('field-prefill',x);};
}
function sourceHtml(x){const a=x.web_source?'<a href="'+esc(x.web_source)+'" target="_blank" rel="noopener">Abrir fuente</a>':'';return esc(x.source||'')+(a?' · '+a:'');}
export function openPlace(id){
  const x=S.places.find(p=>p.id===id);if(!x)return;
  const hero=x.image_url?'<figure class="hero-photo"><img src="'+esc(x.image_url)+'" alt="'+esc(x.name)+'"><figcaption>'+esc(x.image_credit||'')+'</figcaption></figure>':'';
  openSheet('#poiSheet','<div class="sheet-title"><span class="eyebrow">NÚCLEO OFICIAL</span><h2>'+esc(x.name)+'</h2></div>'+hero+'<p>Plan Básico Autonómico de Galicia.</p><div class="detail-grid"><b>Coordenadas</b><span>'+x.coordinates[1].toFixed(6)+', '+x.coordinates[0].toFixed(6)+'</span></div>','half');
}
export function openPath(p={}){
  const details=[p.surface&&('Superficie: '+p.surface),p.tracktype&&('Tipo: '+p.tracktype),p.smoothness&&('Regularidad: '+p.smoothness),p.width&&('Anchura: '+p.width),p.access&&('Acceso OSM: '+p.access),p.foot&&('Peatón: '+p.foot),p.sac_scale&&('Dificultad OSM: '+p.sac_scale)].filter(Boolean);
  openSheet('#poiSheet','<div class="sheet-title"><span class="eyebrow">CAMINO / SENDERO</span><h2>'+esc(p.name||pathLabel(p.highway))+'</h2></div><p>Cartografía colaborativa de OpenStreetMap. No demuestra por sí sola titularidad pública ni transitabilidad actual.</p><div class="detail-grid">'+details.map((d,i)=>'<b>'+(i?'':'Datos')+'</b><span>'+esc(d)+'</span>').join('')+'</div><div class="sheet-actions"><a class="soft-btn" target="_blank" rel="noopener" href="https://www.openstreetmap.org/way/'+encodeURIComponent(p.osm_id||'')+'">OpenStreetMap</a></div>','half');
}
export function openField(r){
  if(!r)return;const photos=r.photos?.length?r.photos:(r.photo?[r.photo]:[]);
  const hero=photos[0]?'<figure class="hero-photo"><img src="'+photos[0]+'" alt=""><figcaption>Trabajo de campo · sin publicar</figcaption></figure>':'';
  openSheet('#poiSheet','<div class="sheet-title"><span class="eyebrow">CAMPO · SIN PUBLICAR</span><h2>'+esc(r.name||r.localName||'Punto')+'</h2></div>'+hero+'<p>'+esc(r.notes||'')+'</p><div class="sheet-actions"><button class="primary-btn" id="editFieldBtn">Editar</button></div><div class="detail-grid"><b>Conservación</b><span>'+esc(r.conservation||'')+'</span><b>Acceso</b><span>'+esc(r.access||'')+'</span><b>Coordenadas</b><span>'+(r.coordinates?.[1]?.toFixed?.(6)||'')+', '+(r.coordinates?.[0]?.toFixed?.(6)||'')+'</span></div>','half');
  $('#editFieldBtn').onclick=()=>{closeSheets();openNav('field');emit('field-edit',r);};
}
function renderStories(){
  const host=$('#storiesList');if(!host)return;host.innerHTML=S.stories.map(s=>'<article class="timeline-item"><small>'+esc(s.year)+'</small><h3>'+esc(S.lang==='gl'?s.title_gl:s.title_es)+'</h3><p>'+esc(S.lang==='gl'?s.summary_gl:s.summary_es)+'</p></article>').join('');
}
function pathLabel(h){return({track:'Pista rural / forestal',path:'Sendero',footway:'Camino peatonal',bridleway:'Camino de herradura',service:'Acceso',unclassified:'Camino local'})[h]||'Camino';}
function icon(t=''){const s=t.toLowerCase();if(s.includes('agua')||s.includes('molino'))return'≈';if(s.includes('historia'))return'⌛';if(s.includes('natur'))return'♧';if(s.includes('ruta'))return'↝';if(s.includes('comer'))return'◌';if(s.includes('dormir'))return'⌂';if(s.includes('patrimonio'))return'◆';return'•';}
