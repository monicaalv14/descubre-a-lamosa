import {S,$,$$,esc,emit,toast,distanceM,formatDistance,favorites,setFavorite} from './state.js';
import {openPOI,closeDetail} from './ui-detail.js';
export {openPOI} from './ui-detail.js';

export function setupUI(){
  const types=[...new Set(S.POIS.map(x=>x.type).filter(Boolean))].sort();
  $('#filter').innerHTML='<option value="">Todas las categorías</option>'+types.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  $('#fieldCategory').innerHTML=types.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')+'<option value="Otro">Otro</option>';
  const pending=S.POIS.filter(x=>!x.coordinates).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const located=S.POIS.filter(x=>x.coordinates).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  $('#fieldPoi').innerHTML='<option value="">Nuevo elemento</option><optgroup label="Pendientes de coordenadas">'+pending.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')+'</optgroup><optgroup label="Ya localizados (recaptura)">'+located.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')+'</optgroup>';
  render();renderRoutes();renderPlaces();
  $('#search').addEventListener('input',render);$('#filter').addEventListener('change',render);
  $('#nearbyToggle').onclick=()=>emit('nearby');$('#favoritesToggle').onclick=()=>{S.favoritesOnly=!S.favoritesOnly;$('#favoritesToggle').classList.toggle('active',S.favoritesOnly);render();};
  $('#close').onclick=closeDetail;$('#reloadApp').onclick=()=>location.reload();
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
  $('#stats').textContent=`${rows.length} elementos · ${geo} geolocalizados · ${rows.length-geo} pendientes${S.nearbyMode&&S.userPosition?' · ordenados por distancia':''}`;
  $('#cards').innerHTML=rows.map(x=>card(x,favs.has(x.id))).join('');
  $$('[data-poi]').forEach(e=>e.onclick=()=>openPOI(e.dataset.poi));
  $$('[data-fav]').forEach(e=>e.onclick=ev=>{ev.stopPropagation();const id=e.dataset.fav;setFavorite(id,!favorites().has(id));});
}
function card(x,isFav){
  const pend=!x.coordinates?'<span class="chip pending">Pendiente de coordenada</span>':'<span class="chip">En el mapa</span>';
  const ev=x.web_evidence?'<span class="chip">Existencia contrastada</span>':'';
  const priv=/privad/i.test(x.access||'')?'<span class="chip private">Acceso sensible</span>':'';
  const dist=(S.userPosition&&x.coordinates)?`<span class="chip">${formatDistance(distanceM(S.userPosition,x.coordinates))}</span>`:'';
  return `<article class="card" data-poi="${esc(x.id)}"><button class="favorite-btn ${isFav?'on':''}" data-fav="${esc(x.id)}">${isFav?'★':'☆'}</button><h3>${esc(x.name)}</h3><div class="muted">${esc(x.area)}</div><div class="chips"><span class="chip">${esc(x.subtype)}</span>${pend}${ev}${priv}${dist}</div><div>${esc(x.description)}</div></article>`;
}
export function renderRoutes(){
  $('#routecards').innerHTML=S.ROUTES.map(r=>`<article class="card"><h3>${esc(r['Nombre provisional'])}</h3><div class="chips"><span class="chip">${esc(r['Tipo'])}</span><span class="chip">Base ${esc(r['Base disponible'])}</span></div><p>${esc(r['Paradas candidatas'])}</p>${r['Longitud']?`<p><b>${esc(r['Longitud'])}</b> · ${esc(r['Duración'])} · ${esc(r['Dificultad'])}</p>`:''}<div class="muted"><b>Estado:</b> ${esc(r['Estado'])}<br><b>Siguiente:</b> ${esc(r['Trabajo siguiente'])}</div><div class="card-actions">${r.ID==='R-009'?'<button class="mini-btn" data-show-prg>Ver trazado oficial</button>':''}<button class="mini-btn" data-field-route="${esc(r.ID)}">Levantar en Campo</button></div></article>`).join('');
  $$('[data-show-prg]').forEach(b=>b.onclick=()=>emit('show-prg'));
  $$('[data-field-route]').forEach(b=>b.onclick=()=>{const r=S.ROUTES.find(x=>x.ID===b.dataset.fieldRoute);emit('prepare-track',r?.['Nombre provisional']||'');});
}
export function renderPlaces(){
  $('#placecards').innerHTML=S.PLACES.map(x=>{const d=S.userPosition?formatDistance(distanceM(S.userPosition,x.coordinates)):'';return `<article class="card place" data-place="${esc(x.id)}"><h3>${esc(x.name)}</h3><div class="chips"><span class="chip">Núcleo oficial</span><span class="chip">PBA</span>${d?`<span class="chip">${d}</span>`:''}</div><div class="muted">${x.coordinates[1].toFixed(6)}, ${x.coordinates[0].toFixed(6)}</div></article>`;}).join('');
  $$('[data-place]').forEach(e=>e.onclick=()=>emit('fly',S.PLACES.find(p=>p.id===e.dataset.place)?.coordinates));
}
