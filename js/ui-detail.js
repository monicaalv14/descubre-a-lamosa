import {S,$,esc,emit,toast,distanceM,formatDistance,favorites,setFavorite,copyText} from './state.js';

export function openPOI(id){
  const x=S.POIS.find(p=>p.id===id);if(!x)return;
  const coords=x.coordinates?`<b>Coordenadas</b><span>${x.coordinates[1].toFixed(6)}, ${x.coordinates[0].toFixed(6)}</span>`:'';
  const dist=(S.userPosition&&x.coordinates)?`<b>Desde mi posición</b><span>${formatDistance(distanceM(S.userPosition,x.coordinates))}</span>`:'';
  const evidence=x.web_evidence?`<b>Contraste web</b><span>${esc(x.web_evidence)}</span>`:'';
  const source=x.web_source?`<b>Fuente cartográfica</b><span><a href="${esc(x.web_source)}" target="_blank" rel="noopener">Abrir fuente</a></span>`:'';
  const fav=favorites().has(id);
  $('#detailbody').innerHTML=`<h2>${esc(x.name)}</h2><p>${esc(x.description)}</p><div class="chips"><span class="chip">${esc(x.status)}</span>${x.coordinates?'<span class="chip">Geolocalizado</span>':'<span class="chip pending">Sin coordenada publicada</span>'}</div><div class="detailgrid"><b>Zona</b><span>${esc(x.area)}</span><b>Tipo</b><span>${esc(x.type)} · ${esc(x.subtype)}</span>${coords}${dist}<b>Acceso</b><span>${esc(x.access)}</span><b>Por comprobar</b><span>${esc(x.verify)}</span><b>Experiencia</b><span>${esc(x.experience)}</span><b>Fuente</b><span>${esc(x.source)}</span>${evidence}${source}</div><div class="detail-actions"><button id="detailFav">${fav?'★ Quitar favorito':'☆ Guardar favorito'}</button><button id="detailShare">Compartir</button>${x.coordinates?'<button id="detailMap">Ver en mapa</button><button id="detailCopy">Copiar coordenadas</button>':''}${!x.coordinates?'<button id="detailField">Localizar en Campo</button>':''}</div>`;
  $('#detail').showModal();history.replaceState(null,'','#poi='+encodeURIComponent(id));
  $('#detailFav').onclick=()=>{setFavorite(id,!favorites().has(id));openPOI(id);};
  $('#detailShare').onclick=()=>sharePOI(x);
  if(x.coordinates){$('#detailMap').onclick=()=>{closeDetail();emit('fly',x.coordinates);};$('#detailCopy').onclick=()=>copyText(`${x.coordinates[1].toFixed(7)}, ${x.coordinates[0].toFixed(7)}`);}
  if(!x.coordinates)$('#detailField').onclick=()=>{closeDetail();emit('field-poi',id);};
}
export function closeDetail(){
  if($('#detail').open)$('#detail').close();
  if(location.hash.startsWith('#poi='))history.replaceState(null,'',location.pathname+location.search);
}
async function sharePOI(x){
  const url=location.origin+location.pathname+'#poi='+encodeURIComponent(x.id);
  try{if(navigator.share)await navigator.share({title:x.name,text:`${x.name} · Descubre A Lamosa`,url});else await copyText(url);}catch(e){}
}
