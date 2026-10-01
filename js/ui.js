import {S,$,$$,esc,toast,setMode,setLang,setAppearance,favorites,setFavorite,distanceM,formatDistance,dbGetAll,dbPut,dbDelete,emit} from './state.js';
import {t,applyI18n} from './i18n.js';
import {visiblePois} from './data.js';
import {locate,setCategoryFilter,refreshPoiSource,focusPoi} from './map.js';

let selectedCategories=new Set(),favoritesOnly=false,photosOnly=false,search='',showAll=false;
const SNAP={collapsed:92,half:48,full:88};

export function initUI(){
  bindNavigation();bindDrawer();bindSheets();bindExplore();bindSettings();renderStories();
  $('#languageSelect').value=S.lang;$('#modeSelect').value=S.mode;$('#appearanceSelect').value=S.appearance;
  applyMode(true);applyAppearance();applyI18n();renderExplore();
  window.addEventListener('alm:viewport-pois',e=>{
    renderViewport(e.detail||[]);
    if(!hasExploreIntent())renderExplore();
  });
  window.addEventListener('alm:open-poi',e=>openPoi(e.detail));
  window.addEventListener('alm:open-place',e=>openPlace(e.detail));
  window.addEventListener('alm:open-path',e=>openPath(e.detail));
  window.addEventListener('alm:open-field',e=>openField(e.detail));
  window.addEventListener('alm:favorites',renderExplore);
  window.addEventListener('alm:mode',()=>{applyMode(false);refreshPoiSource();renderExplore();renderStories();});
  window.addEventListener('alm:lang',()=>{applyI18n();renderExplore();renderStories();});
  window.addEventListener('alm:appearance',applyAppearance);
  window.addEventListener('alm:route-mode',()=>{selectedCategories.clear();showAll=false;setCategoryFilter([]);renderExplore();$('#nearbyStrip').hidden=true;});
  window.addEventListener('alm:audio-state',e=>updateAudioButton(e.detail||{}));
  $('#searchInput').addEventListener('focus',()=>setDrawer('full'));
}
function bindNavigation(){
  $$('[data-nav]').forEach(b=>b.onclick=()=>openNav(b.dataset.nav));
  $('#collapseDrawerBtn').onclick=()=>cycleDrawer();
}
export function openNav(name){
  closeSheets();
  $$('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===name));
  $$('.drawer-view').forEach(v=>v.classList.toggle('active',v.dataset.view===name));
  setDrawer(name==='explore'?'half':'full');
  emit('nav',name);
}
function setDrawer(size){
  const d=$('#drawer');d.style.height='';d.style.transform='';d.classList.remove('collapsed','half','full','dragging');d.classList.add(size);d.dataset.snap=size;
  $('#collapseDrawerBtn')?.setAttribute('aria-expanded',size!=='collapsed'?'true':'false');
  const strip=$('#nearbyStrip');
  if(strip)strip.hidden=size!=='collapsed'||!(S.lastViewportPois?.length);
}
function cycleDrawer(){
  const d=$('#drawer'),s=d.dataset.snap||'half';setDrawer(s==='full'?'half':s==='half'?'collapsed':'half');
}
function bindDrawer(){
  const h=$('[data-drawer-drag]'),d=$('#drawer');if(!h||!d)return;
  let startY=0,startOffset=0,currentOffset=0,dragging=false,mode='',pendingOffset=null,raf=0;
  const geometry=()=>{
    const p=d.parentElement?.getBoundingClientRect(),base=p?.height||innerHeight,max=base*.88,min=92;
    return {base,max,min};
  };
  const translateY=()=>{
    const tr=getComputedStyle(d).transform;
    if(!tr||tr==='none')return 0;
    try{return new DOMMatrixReadOnly(tr).m42||0}catch{return 0}
  };
  const paint=()=>{
    raf=0;
    if(pendingOffset==null)return;
    currentOffset=pendingOffset;
    d.style.transform='translate3d(0,'+currentOffset+'px,0)';
    pendingOffset=null;
  };
  const begin=(clientY,inputMode)=>{
    const {max,min}=geometry();
    startY=clientY;startOffset=Math.max(0,Math.min(max-min,translateY()));currentOffset=startOffset;
    dragging=true;mode=inputMode;pendingOffset=null;
    d.classList.add('dragging');h.classList.add('dragging');
  };
  const move=clientY=>{
    if(!dragging)return;
    const {max,min}=geometry();
    pendingOffset=Math.max(0,Math.min(max-min,startOffset+(clientY-startY)));
    if(!raf)raf=requestAnimationFrame(paint);
  };
  const finish=()=>{
    if(!dragging)return;
    if(raf){cancelAnimationFrame(raf);raf=0;}
    paint();
    dragging=false;mode='';
    d.classList.remove('dragging');h.classList.remove('dragging');
    const {base,max}=geometry(),visible=max-currentOffset,ratio=visible/base;
    d.style.transform='';
    setDrawer(ratio<.25?'collapsed':ratio>.68?'full':'half');
  };

  h.addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;
    e.preventDefault();begin(e.touches[0].clientY,'touch');
  },{passive:false});
  h.addEventListener('touchmove',e=>{
    if(!dragging||mode!=='touch'||!e.touches.length)return;
    e.preventDefault();move(e.touches[0].clientY);
  },{passive:false});
  h.addEventListener('touchend',e=>{
    if(!dragging||mode!=='touch')return;
    e.preventDefault();finish();
  },{passive:false});
  h.addEventListener('touchcancel',()=>{if(mode==='touch')finish()},{passive:true});

  h.addEventListener('mousedown',e=>{
    if(e.button!==0)return;
    e.preventDefault();begin(e.clientY,'mouse');
    const onMove=ev=>{if(mode==='mouse'){ev.preventDefault();move(ev.clientY)}};
    const onUp=()=>{
      window.removeEventListener('mousemove',onMove);
      window.removeEventListener('mouseup',onUp);
      if(mode==='mouse')finish();
    };
    window.addEventListener('mousemove',onMove,{passive:false});
    window.addEventListener('mouseup',onUp,{once:true});
  });
}
function bindSheets(){
  $$('[data-close-sheet]').forEach(b=>b.onclick=closeSheets);$('#sheetBackdrop').onclick=closeSheets;
  $$('[data-sheet-drag]').forEach(h=>{let y=0;h.onpointerdown=e=>{y=e.clientY;h.setPointerCapture(e.pointerId)};h.onpointerup=e=>{const sh=h.closest('.entity-sheet'),dy=e.clientY-y;if(dy>120)closeSheets();else{sh.classList.remove('half','full');sh.classList.add(dy<-70?'full':'half');}};});
}
export function openSheet(id,html,mode='half'){
  const el=$(id);if(!el)return;const body=el.querySelector('[id$="Body"]');if(body)body.innerHTML=html;
  $$('.entity-sheet').forEach(x=>{x.classList.remove('open');x.hidden=true;});
  el.hidden=false;el.classList.remove('half','full');el.classList.add(mode);$('#sheetBackdrop').hidden=false;requestAnimationFrame(()=>el.classList.add('open'));
}
export function closeSheets(){
  $$('.entity-sheet').forEach(x=>x.classList.remove('open'));$('#sheetBackdrop').hidden=true;
  setTimeout(()=>$$('.entity-sheet').forEach(x=>x.hidden=true),210);
}
function bindExplore(){
  $('#searchInput').oninput=e=>{search=normalize(e.target.value.trim());showAll=false;renderExplore();};
  $('#favoritesBtn').onclick=()=>{favoritesOnly=!favoritesOnly;showAll=false;$('#favoritesBtn').classList.toggle('active',favoritesOnly);renderExplore();};
  $('#photosBtn').onclick=()=>{photosOnly=!photosOnly;showAll=false;$('#photosBtn').classList.toggle('active',photosOnly);renderExplore();};
  $('#nearbyBtn').onclick=async()=>{
    const pos=await locate(false);if(!pos)return;
    const rows=visiblePois().filter(x=>x.coordinates).map(x=>({...x,_d:distanceM(pos.coordinates,x.coordinates)})).filter(x=>x._d<=1500).sort((a,b)=>a._d-b._d);
    renderViewport(rows.slice(0,12),true);toast(rows.length?rows.length+' lugares en 1,5 km':'No hay lugares cercanos en el inventario');
  };
}
function applyMode(first=false){
  document.body.dataset.mode=S.mode;$('#modeSelect').value=S.mode;
  if(first)setDrawer(S.mode==='visitor'?'collapsed':'half');
}
function applyAppearance(){
  document.body.dataset.theme=S.appearance;$('#appearanceSelect').value=S.appearance;
  const dark=S.appearance==='dark'||(S.appearance==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#17231d':'#244b3a');
}
function bindSettings(){
  $('#languageSelect').onchange=e=>setLang(e.target.value);
  $('#appearanceSelect').onchange=e=>setAppearance(e.target.value);
  $('#modeSelect').onchange=e=>{
    if(e.target.value==='research'&&S.mode!=='research'){
      const ok=confirm('El modo Investigación muestra herramientas de edición, datos pendientes y trabajo de campo. ¿Activarlo?');
      if(!ok){e.target.value=S.mode;return;}
    }
    setMode(e.target.value);
  };
}
export function renderExplore(){
  const rows0=visiblePois(),cats=[...new Set(rows0.map(x=>x.type).filter(Boolean))].sort();
  $('#categoryChips').innerHTML='<button class="filter-chip '+(!selectedCategories.size?'active':'')+'" data-cat="">Todo</button>'+cats.map(c=>'<button class="filter-chip '+(selectedCategories.has(c)?'active':'')+'" data-cat="'+esc(c)+'"><span class="filter-icon">'+icon(c)+'</span>'+esc(shortCat(c))+'</button>').join('');
  $$('[data-cat]').forEach(b=>b.onclick=()=>{
    const c=b.dataset.cat;showAll=false;
    if(!c)selectedCategories.clear();else selectedCategories.has(c)?selectedCategories.delete(c):selectedCategories.add(c);
    setCategoryFilter([...selectedCategories]);renderExplore();
  });
  const fav=favorites(),intent=hasExploreIntent();
  let rows=rows0.filter(x=>(!selectedCategories.size||selectedCategories.has(x.type))&&(!search||searchText(x).includes(search))&&(!favoritesOnly||fav.has(x.id))&&(!photosOnly||!!x.image_url||(x.images?.length)));
  if(S.userPosition)rows=rows.map(x=>({...x,_d:x.coordinates?distanceM(S.userPosition,x.coordinates):Infinity})).sort((a,b)=>a._d-b._d);

  if(!intent){
    const visible=(S.lastViewportPois||[]).filter(x=>rows0.some(p=>p.id===x.id));
    rows=visible.length?visible:rows0.filter(x=>/^(Muy alta|Alta)$/i.test(x.priority||'')).slice(0,10);
    $('#exploreSummary').textContent=visible.length?rows.length+' lugares visibles en el mapa':'Lugares destacados para empezar';
  }else{
    $('#exploreSummary').textContent=rows.length+' resultado'+(rows.length===1?'':'s');
  }

  const limit=intent?60:12;
  $('#exploreList').innerHTML=rows.slice(0,limit).map(x=>row(x,fav.has(x.id))).join('')+
    (!intent?'<button class="show-all-btn" id="showAllPlaces">Ver todo el inventario</button>':'')+
    (intent&&rows.length>limit?'<p class="section-note">Sigue afinando con búsqueda o filtros para reducir resultados.</p>':'');
  $('#showAllPlaces')?.addEventListener('click',()=>{showAll=true;renderExplore();setDrawer('full');});
  $$('[data-poi-row]').forEach(e=>e.onclick=()=>{const x=S.pois.find(p=>p.id===e.dataset.poiRow);if(x?.coordinates)focusPoi(x);openPoi(e.dataset.poiRow);});
  $$('[data-fav]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.fav;setFavorite(id,!favorites().has(id));});
}
function hasExploreIntent(){return !!(search||selectedCategories.size||favoritesOnly||photosOnly||showAll);}
function row(x,isFav){
  const d=Number.isFinite(x._d)?' · '+formatDistance(x._d):'',thumb=x.image_url?'<img class="row-thumb" loading="lazy" decoding="async" src="'+esc(x.image_url)+'" alt="">':'<div class="ico">'+icon(x.type)+'</div>';
  return '<article class="list-row" data-poi-row="'+esc(x.id)+'">'+thumb+'<div><strong>'+esc(x.name)+'</strong><small>'+esc(x.area||'')+d+'</small></div><div class="row-end"><span class="badge '+(x.coordinates?'':'pending')+'">'+(x.coordinates?'Mapa':t('pending'))+'</span><button class="star-btn" data-fav="'+esc(x.id)+'" aria-label="Favorito">'+(isFav?'★':'☆')+'</button></div></article>';
}
function renderViewport(rows,near=false){
  const host=$('#nearbyStrip');if(!rows?.length){host.hidden=true;host.innerHTML='';return;}
  const contextual=rows.slice(0,near?12:6);
  host.setAttribute('aria-label',near?'Lugares cercanos':'Lugares visibles en el mapa');
  host.innerHTML=contextual.map(x=>{
    const d=near&&Number.isFinite(x._d)?formatDistance(x._d):(x._mapd?formatDistance(x._mapd):'');
    const media=x.image_url?'<img loading="lazy" decoding="async" src="'+esc(x.image_url)+'" alt="">':'<span class="nearby-icon">'+icon(x.type)+'</span>';
    return '<button class="nearby-card" data-near-poi="'+esc(x.id)+'">'+media+'<span class="nearby-copy"><strong>'+esc(x.name)+'</strong><small>'+esc(shortCat(x.type))+(d?' · '+d:'')+'</small></span></button>';
  }).join('');
  host.hidden=($('#drawer')?.dataset.snap||'half')!=='collapsed';
  $$('[data-near-poi]').forEach(b=>b.onclick=()=>{const x=S.pois.find(p=>p.id===b.dataset.nearPoi);if(x)focusPoi(x);openPoi(b.dataset.nearPoi);});
}
export async function openPoi(id){
  const x=S.pois.find(p=>p.id===id);if(!x)return;const fav=favorites().has(id),d=S.userPosition&&x.coordinates?formatDistance(distanceM(S.userPosition,x.coordinates)):'';
  const localRows=await dbGetAll('poiPhotos').catch(()=>[]),localRow=localRows.find(r=>r.id===id),localCover=localRow?.photos?.[0];
  const photos=[];if(localCover)photos.push({url:localCover.data,credit:'Foto local · portada'});if(x.image_url)photos.push({url:x.image_url,credit:x.image_credit||''});if(Array.isArray(x.images))photos.push(...x.images);
  const hero=photos[0]?'<figure class="hero-photo"><img loading="eager" decoding="async" src="'+esc(photos[0].url)+'" alt="'+esc(x.name)+'"><figcaption>'+esc(photos[0].credit||'')+'</figcaption></figure>':'<div class="poi-cover '+typeClass(x.type)+'"><span>'+icon(x.type)+'</span></div>';
  const gallery=photos.length>1?'<div class="gallery-strip">'+photos.slice(1).map((p,i)=>'<button class="gallery-thumb" data-gallery="'+(i+1)+'"><img loading="lazy" decoding="async" src="'+esc(p.url)+'" alt=""></button>').join('')+'</div>':'';
  const directions=x.coordinates?'<a class="primary-btn action-card" id="poiDirections" href="'+directionsUrl(x.coordinates,x.name)+'" target="_blank" rel="noopener"><span>➜</span><small>'+t('directions')+'</small></a>':'';
  const research=S.mode==='research'&&!x.coordinates?'<button class="soft-btn action-card" id="poiFieldBtn"><span>⌖</span><small>Localizar</small></button>':'';
  const html='<div class="sheet-title poi-title"><div class="category-orb '+typeClass(x.type)+'">'+icon(x.type)+'</div><div><span class="eyebrow">'+esc(shortCat(x.type))+'</span><h2>'+esc(x.name)+'</h2><div class="poi-meta">'+(d?'<span>'+d+'</span>':'')+(x.area?'<span>'+esc(x.area)+'</span>':'')+'</div></div></div>'+hero+gallery+
    '<section class="poi-intro"><span class="poi-intro-label">En pocas palabras</span><p class="poi-summary">'+esc(x.description||'')+'</p></section>'+
    '<div class="sheet-actions action-grid">'+directions+'<button class="soft-btn action-card" id="poiListenBtn"><span>▶</span><small>'+t('listen')+'</small></button><button class="soft-btn action-card" id="poiFavBtn"><span>'+(fav?'★':'☆')+'</span><small>'+t('favorites')+'</small></button><button class="soft-btn action-card" id="poiShareBtn"><span>↗</span><small>'+t('share')+'</small></button>'+research+'</div>'+
    '<details class="sheet-more"><summary>'+t('info')+'</summary><div class="detail-grid"><b>Tipo</b><span>'+esc(x.subtype||x.type||'')+'</span><b>Acceso</b><span>'+esc(x.access||'Sin comprobar')+'</span><b>Estado</b><span>'+visitorStatus(x)+'</span>'+(S.mode==='research'?'<b>Por comprobar</b><span>'+esc(x.verify||'')+'</span>':'')+'</div></details>'+
    '<details class="sheet-more"><summary>Mis fotografías</summary><div class="poi-photo-tools"><p class="section-note">Fotos guardadas solo en este dispositivo.</p><div class="photo-source-actions"><label class="soft-btn file-btn">▧ Elegir de la galería<input id="poiPhotoAdd" type="file" accept="image/*" multiple hidden></label><label class="soft-btn file-btn">◉ Hacer foto<input id="poiPhotoCamera" type="file" accept="image/*" capture="environment" hidden></label></div><div id="poiLocalPhotos" class="local-photo-grid"></div></div></details>'+
    '<details class="sheet-more"><summary>'+t('sources')+'</summary><div class="source-box">'+sourceHtml(x)+'</div></details>';
  openSheet('#poiSheet',html,'half');
  $$('[data-gallery]').forEach(b=>b.onclick=()=>{
    const p=photos[Number(b.dataset.gallery)];if(!p)return;
    const img=$('#poiSheet .hero-photo img'),cap=$('#poiSheet .hero-photo figcaption');
    if(img){img.src=p.url;img.alt=x.name;}if(cap)cap.textContent=p.credit||'';
  });
  bindPoiLocalPhotos(id);
  $('#poiListenBtn').dataset.poiId=id;
  $('#poiListenBtn').onclick=()=>{
    if($('#poiListenBtn').dataset.playing==='1')emit('stop-audio');
    else emit('speak-poi',x);
  };
  $('#poiFavBtn').onclick=()=>{setFavorite(id,!favorites().has(id));openPoi(id);};
  $('#poiShareBtn').onclick=()=>shareLink(x.name,'#poi='+encodeURIComponent(id));
  if($('#poiFieldBtn'))$('#poiFieldBtn').onclick=()=>{closeSheets();openNav('field');emit('field-prefill',x);};
}
function bindPoiLocalPhotos(id){
  const input=$('#poiPhotoAdd'),camera=$('#poiPhotoCamera'),host=$('#poiLocalPhotos');if(!input||!host)return;
  const render=()=>dbGetAll('poiPhotos').then(rows=>{
    const row=rows.find(r=>r.id===id),photos=row?.photos||[];
    host.innerHTML=photos.map((p,i)=>'<article class="local-photo-card"><img src="'+esc(p.data)+'" alt=""><div><button class="soft-btn compact-btn" data-local-cover="'+i+'">'+(i===0?'★ Portada':'Hacer portada')+'</button><button class="photo-remove" data-local-remove="'+i+'">Eliminar</button></div></article>').join('')||( '<p class="section-note">No has añadido fotos a este lugar.</p>');
    $('[data-local-cover]').forEach(b=>b.onclick=async()=>{const rows=await dbGetAll('poiPhotos'),row=rows.find(r=>r.id===id);if(!row)return;const i=Number(b.dataset.localCover),p=row.photos.splice(i,1)[0];row.photos.unshift(p);await dbPut('poiPhotos',row);const x=S.pois.find(p=>p.id===id),sheet=$('#poiSheet'),oldHero=sheet?.querySelector('.hero-photo'),oldCover=sheet?.querySelector('.poi-cover');if(x&&p){const figure=document.createElement('figure');figure.className='hero-photo';figure.innerHTML='<img loading="eager" decoding="async" src="'+esc(p.data)+'" alt="'+esc(x.name)+'"><figcaption>Foto local · portada</figcaption>';if(oldHero)oldHero.replaceWith(figure);else if(oldCover)oldCover.replaceWith(figure);}toast('Portada actualizada');render();});
    $$('[data-local-remove]').forEach(b=>b.onclick=async()=>{const rows=await dbGetAll('poiPhotos'),row=rows.find(r=>r.id===id);if(!row)return;row.photos.splice(Number(b.dataset.localRemove),1);row.photos.length?await dbPut('poiPhotos',row):await dbDelete('poiPhotos',id);render();});
  }).catch(()=>{host.innerHTML='<p class="section-note">No se pudieron cargar las fotos locales.</p>';});
  const addFiles=async(files,source)=>{let added=0;for(const file of [...files||[]]){if(!file.type.startsWith('image/'))continue;const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});const rows=await dbGetAll('poiPhotos'),row=rows.find(r=>r.id===id)||{id,photos:[]};row.photos.push({data,name:file.name,at:new Date().toISOString()});await dbPut('poiPhotos',row);added++;}if(added){toast(added===1?'Foto añadida':added+' fotos añadidas');render();}source.value='';};
  input.onchange=()=>addFiles(input.files,input);
  if(camera)camera.onchange=()=>addFiles(camera.files,camera);
  render();
}
function updateAudioButton(detail){
  const b=$('#poiListenBtn');if(!b)return;
  const same=detail.poiId&&b.dataset.poiId===detail.poiId,playing=detail.state==='playing'&&same;
  b.dataset.playing=playing?'1':'0';
  b.querySelector('span').textContent=playing?'■':'▶';
  b.querySelector('small').textContent=playing?'Detener':t('listen');
}
function visitorStatus(x){
  if(S.mode==='research')return esc(x.status||'');
  if(!x.coordinates)return t('pending');
  if(/privad/i.test(x.access||''))return 'Acceso con condiciones';
  return 'Ubicación verificada';
}
function sourceHtml(x){
  const label=S.mode==='research'?esc(x.source||''):'Documentación del proyecto';
  const a=x.web_source?'<a href="'+esc(x.web_source)+'" target="_blank" rel="noopener">Consultar fuente</a>':'';
  return label+(a?' · '+a:'');
}
export function openPlace(id){
  const x=S.places.find(p=>p.id===id);if(!x)return;
  const hero=x.image_url?'<figure class="hero-photo"><img loading="eager" decoding="async" src="'+esc(x.image_url)+'" alt="'+esc(x.name)+'"><figcaption>'+esc(x.image_credit||'')+'</figcaption></figure>':'';
  openSheet('#poiSheet','<div class="sheet-title"><div class="category-orb place">⌂</div><div><span class="eyebrow">NÚCLEO</span><h2>'+esc(x.name)+'</h2></div></div>'+hero+'<p class="poi-summary">Uno de los núcleos de población de la parroquia de A Lamosa.</p><div class="sheet-actions"><button class="primary-btn" id="placeFocus">Ver en mapa</button></div>'+(S.mode==='research'?'<details class="sheet-more"><summary>Datos cartográficos</summary><div class="detail-grid"><b>Coordenadas</b><span>'+x.coordinates[1].toFixed(6)+', '+x.coordinates[0].toFixed(6)+'</span><b>Fuente</b><span>Plan Básico Autonómico de Galicia</span></div></details>':''),'half');
  $('#placeFocus').onclick=()=>{closeSheets();S.map?.easeTo({center:x.coordinates,zoom:16});};
}
export function openPath(p={}){
  const visitor='<div class="sheet-title"><div class="category-orb path">↝</div><div><span class="eyebrow">CAMINO</span><h2>'+esc(p.name||pathLabel(p.highway))+'</h2></div></div><p class="poi-summary">Tramo cartografiado de la red de caminos y senderos. Comprueba siempre el estado y el acceso sobre el terreno.</p>';
  const tech=[p.surface&&('Superficie: '+p.surface),p.tracktype&&('Tipo: '+p.tracktype),p.smoothness&&('Regularidad: '+p.smoothness),p.width&&('Anchura: '+p.width),p.access&&('Acceso: '+p.access),p.foot&&('Peatón: '+p.foot),p.sac_scale&&('Dificultad: '+p.sac_scale)].filter(Boolean);
  const details=tech.length?'<details class="sheet-more"><summary>Características</summary><div class="feature-list">'+tech.map(v=>'<span>'+esc(v)+'</span>').join('')+'</div></details>':'';
  const source=S.mode==='research'?'<details class="sheet-more"><summary>Fuente cartográfica</summary><p>OpenStreetMap · way '+esc(p.osm_id||'')+'. La cartografía no demuestra titularidad pública ni transitabilidad.</p><a target="_blank" rel="noopener" href="https://www.openstreetmap.org/way/'+encodeURIComponent(p.osm_id||'')+'">Abrir elemento OSM</a></details>':'';
  openSheet('#poiSheet',visitor+details+source,'half');
}
export function openField(r){
  if(!r)return;const photos=r.photos?.length?r.photos:(r.photo?[r.photo]:[]),hero=photos[0]?'<figure class="hero-photo"><img src="'+photos[0]+'" alt=""><figcaption>Trabajo de campo · sin publicar</figcaption></figure>':'';
  openSheet('#poiSheet','<div class="sheet-title"><div class="category-orb field">✎</div><div><span class="eyebrow">CAMPO · SIN PUBLICAR</span><h2>'+esc(r.name||r.localName||'Punto')+'</h2></div></div>'+hero+'<p>'+esc(r.notes||'')+'</p><div class="sheet-actions"><button class="primary-btn" id="editFieldBtn">Editar</button></div><div class="detail-grid"><b>Conservación</b><span>'+esc(r.conservation||'')+'</span><b>Acceso</b><span>'+esc(r.access||'')+'</span><b>Coordenadas</b><span>'+(r.coordinates?.[1]?.toFixed?.(6)||'')+', '+(r.coordinates?.[0]?.toFixed?.(6)||'')+'</span></div>','half');
  $('#editFieldBtn').onclick=()=>{closeSheets();openNav('field');emit('field-edit',r);};
}
function renderStories(){
  const host=$('#storiesList');if(!host)return;host.innerHTML=S.stories.map(s=>'<article class="timeline-item"><small>'+esc(s.year)+'</small><h3>'+esc(S.lang==='gl'?s.title_gl:s.title_es)+'</h3><p>'+esc(S.lang==='gl'?s.summary_gl:s.summary_es)+'</p><button class="story-map" data-story="'+esc(s.id)+'">Ver lugares</button></article>').join('');
  $$('[data-story]').forEach(b=>b.onclick=()=>{const st=S.stories.find(x=>x.id===b.dataset.story);if(!st)return;const ids=new Set(st.poi_ids||[]),pois=S.pois.filter(x=>ids.has(x.id)&&x.coordinates);if(pois.length){closeSheets();openNav('explore');selectedCategories.clear();const xs=pois.map(p=>p.coordinates[0]),ys=pois.map(p=>p.coordinates[1]);
    S.map?.fitBounds([[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]],{padding:70,maxZoom:16});}});
}
function shareLink(title,hash){
  const u=new URL(location.origin+location.pathname),v=new URLSearchParams(location.search).get('v');
  if(v)u.searchParams.set('v',v);u.hash=hash.replace(/^#/,'');
  const url=u.toString();
  if(navigator.share)return navigator.share({title,text:title,url}).catch(()=>{});
  navigator.clipboard?.writeText(url).then(()=>toast('Enlace copiado')).catch(()=>toast('No se pudo compartir'));
}
function directionsUrl(c,name){return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(c[1]+','+c[0])+'&destination_place_id=&travelmode=walking';}
function searchText(x){
  const aliases={
    'Patrimonio':'iglesia capilla cruceiro cruz peto patrimonio relixioso religioso',
    'Agua / molinos':'auga agua fonte fuente lavadoiro lavadero muiño muino molino molinos',
    'Historia':'historia memoria antigo antigua jose gil escola escuela',
    'Naturaleza':'natureza naturaleza monte bosque fragas',
    'Ruta / patrimonio':'ruta roteiro camino camiño sendero sendeiro pista',
    'Comer':'bar comer comida',
    'Dormir':'alojamiento casa dormir'
  };
  return normalize(Object.values(x).join(' ')+' '+(aliases[x.type]||''));
}
function normalize(v=''){return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ñ/g,'n');}
function shortCat(c=''){return c.replace(' / ',' · ').replace('Patrimonio interior','Patrimonio');}
function pathLabel(h){return({track:'Pista rural / forestal',path:'Sendero',footway:'Camino peatonal',bridleway:'Camino de herradura',service:'Acceso',unclassified:'Camino local'})[h]||'Camino';}
function icon(t=''){const s=t.toLowerCase();if(s.includes('agua')||s.includes('molino'))return'≈';if(s.includes('historia'))return'⌛';if(s.includes('natur'))return'♧';if(s.includes('ruta'))return'↝';if(s.includes('comer'))return'◉';if(s.includes('dormir'))return'⌂';if(s.includes('cultura'))return'✦';return'◆';}
function typeClass(t=''){const s=t.toLowerCase();if(s.includes('agua')||s.includes('molino'))return'water';if(s.includes('historia'))return'history';if(s.includes('natur'))return'nature';if(s.includes('ruta'))return'route';if(s.includes('comer'))return'food';if(s.includes('dormir'))return'sleep';if(s.includes('cultura'))return'culture';return'heritage';}
