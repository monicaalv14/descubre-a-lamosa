import {S,$,$$,esc,emit,toast,distanceM,formatDistance,favorites,setFavorite} from './state.js';
import {openPOI,openPlace,openFieldRecord,openMapFeature,closeDetail} from './ui-detail.js?v=100';
export {openPOI,openPlace,openFieldRecord,openMapFeature} from './ui-detail.js?v=100';

export function setupUI(){
  const types=[...new Set(S.POIS.map(x=>x.type).filter(Boolean))].sort();
  $('#filter').innerHTML='<option value="">Todas las categorías</option>'+types.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  $('#fieldCategory').innerHTML=types.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')+'<option value="Otro">Otro</option>';
  const pending=S.POIS.filter(x=>!x.coordinates).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const located=S.POIS.filter(x=>x.coordinates).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  $('#fieldPoi').innerHTML='<option value="">Nuevo elemento</option><optgroup label="Pendientes de coordenadas">'+pending.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')+'</optgroup><optgroup label="Ya localizados (recaptura)">'+located.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')+'</optgroup>';
  render();renderRoutes();renderPlaces();
  $('#search').addEventListener('input',()=>{$('#inventoryDetails').open=!!$('#search').value.trim();render();});
  $('#filter').addEventListener('change',()=>{$('#inventoryDetails').open=true;render();});
  $('#nearbyToggle').onclick=()=>emit('nearby');
  $('#favoritesToggle').onclick=()=>{S.favoritesOnly=!S.favoritesOnly;$('#favoritesToggle').classList.toggle('active',S.favoritesOnly);$('#inventoryDetails').open=true;render();};
  $('#close').onclick=closeDetail;
  $('#reloadApp').onclick=()=>location.reload();
  $$('.tab').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
  window.addEventListener('alm:rerender',()=>{render();renderPlaces();});
  window.addEventListener('alm:field-poi',e=>{setTab('field');$('#fieldPoi').value=e.detail;$('#fieldPoi').dispatchEvent(new Event('change'));});
  window.addEventListener('alm:prepare-track',e=>{setTab('field');$('#trackName').value=e.detail||'';toast('Nombre de recorrido preparado');});
}
export function setTab(id){
  $$('.tab,.view').forEach(x=>x.classList.remove('active'));
  $(`.tab[data-tab="${id}"]`)?.classList.add('active');$('#'+id)?.classList.add('active');
  if(id==='field')emit('field-visible');
}
export function render(){
  const q=$('#search').value.toLowerCase().trim(),f=$('#filter').value,favs=favorites();
  let rows=S.POIS.filter(x=>(!f||x.type===f)&&(!q||Object.values(x).join(' ').toLowerCase().includes(q))&&(!S.favoritesOnly||favs.has(x.id)));
  if(S.nearbyMode&&S.userPosition)rows=rows.filter(x=>x.coordinates).sort((a,b)=>distanceM(S.userPosition,a.coordinates)-distanceM(S.userPosition,b.coordinates));
  const geo=rows.filter(x=>x.coordinates).length;
  $('#stats').textContent=`${rows.length} lugares · ${geo} en mapa · ${rows.length-geo} por localizar${S.nearbyMode&&S.userPosition?' · por distancia':''}`;
  $('#inventoryCount').textContent=rows.length;
  $('#cards').innerHTML=rows.map(x=>resultRow(x,favs.has(x.id))).join('');
  $$('[data-poi]').forEach(e=>e.onclick=()=>openPOI(e.dataset.poi));
  $$('[data-fav]').forEach(e=>e.onclick=ev=>{ev.stopPropagation();const id=e.dataset.fav;setFavorite(id,!favorites().has(id));});
}
function resultRow(x,isFav){
  const dist=(S.userPosition&&x.coordinates)?formatDistance(distanceM(S.userPosition,x.coordinates)):'';
  return `<article class="result-row" data-poi="${esc(x.id)}">
    <div class="result-icon">${iconFor(x.type)}</div>
    <div class="result-copy"><strong>${esc(x.name)}</strong><small>${esc(x.area||'')}${dist?' · '+dist:''}</small></div>
    <span class="row-status ${x.coordinates?'mapped':'pending'}">${x.coordinates?'●':'○'}</span>
    <button class="row-fav ${isFav?'on':''}" data-fav="${esc(x.id)}" aria-label="Favorito">${isFav?'★':'☆'}</button>
  </article>`;
}
function iconFor(t=''){const s=t.toLowerCase();if(s.includes('agua')||s.includes('molino'))return'≈';if(s.includes('historia'))return'⌛';if(s.includes('natur'))return'♧';if(s.includes('ruta'))return'↝';if(s.includes('comer'))return'◌';if(s.includes('dormir'))return'⌂';return'◆';}

export function renderRoutes(){
  $('#routecards').innerHTML=S.ROUTES.map(r=>`<details class="route-disclosure"><summary><span><b>${esc(r['Nombre provisional'])}</b><small>${esc(r['Tipo'])} · ${esc(r['Estado'])}</small></span><span class="chevron">⌄</span></summary>
    <div class="route-body"><p>${esc(r['Paradas candidatas'])}</p>${r['Longitud']?`<div class="chips"><span class="chip">${esc(r['Longitud'])}</span><span class="chip">${esc(r['Duración'])}</span><span class="chip">${esc(r['Dificultad'])}</span></div>`:''}<p class="muted compact"><b>Siguiente:</b> ${esc(r['Trabajo siguiente'])}</p><div class="card-actions">${r.ID==='R-009'?'<button class="mini-btn" data-show-prg>Ver trazado oficial</button>':''}<button class="mini-btn" data-field-route="${esc(r.ID)}">Levantar en Campo</button></div></div>
  </details>`).join('');
  $$('[data-show-prg]').forEach(b=>b.onclick=()=>emit('show-prg'));
  $$('[data-field-route]').forEach(b=>b.onclick=()=>{const r=S.ROUTES.find(x=>x.ID===b.dataset.fieldRoute);emit('prepare-track',r?.['Nombre provisional']||'');});
}
export function renderPlaces(){
  $('#placecards').innerHTML=S.PLACES.map(x=>{
    const d=S.userPosition?formatDistance(distanceM(S.userPosition,x.coordinates)):'';
    return `<article class="result-row place-row" data-place="${esc(x.id)}"><div class="result-icon">⌂</div><div class="result-copy"><strong>${esc(x.name)}</strong><small>Núcleo oficial · PBA${d?' · '+d:''}</small></div><span class="row-status mapped">●</span></article>`;
  }).join('');
  $$('[data-place]').forEach(e=>e.onclick=()=>openPlace(e.dataset.place));
}
