import {S,$,esc,emit,distanceM,formatDistance,favorites,setFavorite,copyText} from './state.js';

function showSheet(html,hash=''){
  const sheet=$('#detail'),back=$('#sheetBackdrop');
  if(!sheet)return;
  $('#detailbody').innerHTML=html;
  sheet.hidden=false;
  if(back){back.hidden=false;back.onclick=closeDetail;}
  requestAnimationFrame(()=>sheet.classList.add('open'));
  document.body.classList.add('sheet-open');
  if(hash)history.replaceState(null,'',hash);
}
export function closeDetail(){
  const sheet=$('#detail'),back=$('#sheetBackdrop');
  sheet?.classList.remove('open');
  document.body.classList.remove('sheet-open');
  if(back)back.hidden=true;
  setTimeout(()=>{if(sheet)sheet.hidden=true;},220);
  if(location.hash.startsWith('#poi='))history.replaceState(null,'',location.pathname+location.search);
}
function photoBlock(x){
  if(!x?.image_url)return '';
  return `<figure class="sheet-photo"><img src="${esc(x.image_url)}" alt="${esc(x.name)}" loading="lazy" referrerpolicy="no-referrer"><figcaption>${esc(x.image_credit||'')}${x.image_date?' · '+esc(x.image_date):''}${x.image_license?` · <a href="${esc(x.image_license_url||x.image_page||'#')}" target="_blank" rel="noopener">${esc(x.image_license)}</a>`:''}</figcaption></figure>`;
}
function actions(buttons){return `<div class="sheet-actions">${buttons.filter(Boolean).join('')}</div>`;}
function button(id,label,primary=false){return `<button id="${id}" class="${primary?'primary-btn':'soft-btn'}">${label}</button>`;}

export function openPOI(id){
  const x=S.POIS.find(p=>p.id===id);if(!x)return;
  const fav=favorites().has(id);
  const dist=(S.userPosition&&x.coordinates)?formatDistance(distanceM(S.userPosition,x.coordinates)):'';
  const coords=x.coordinates?`${x.coordinates[1].toFixed(6)}, ${x.coordinates[0].toFixed(6)}`:'';
  const source=x.web_source?`<a href="${esc(x.web_source)}" target="_blank" rel="noopener">Abrir fuente</a>`:esc(x.source||'');
  const more=Array.isArray(x.media_links)&&x.media_links.length?`<div class="media-links">${x.media_links.map(m=>`<a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.label)}</a>`).join('')}</div>`:'';
  const html=`
    <div class="sheet-heading"><div><span class="eyebrow">${esc(x.type||'Lugar')}</span><h2>${esc(x.name)}</h2></div></div>
    ${photoBlock(x)}
    <p class="sheet-summary">${esc(x.description||'')}</p>
    <div class="chips"><span class="chip">${esc(x.subtype||x.type||'')}</span>${x.coordinates?'<span class="chip ok">En el mapa</span>':'<span class="chip pending">Pendiente de localizar</span>'}${dist?`<span class="chip">${dist}</span>`:''}</div>
    ${actions([
      x.coordinates?button('detailMap','Ver en mapa',true):'',
      button('detailFav',fav?'★ Favorito':'☆ Favorito'),
      button('detailShare','Compartir'),
      !x.coordinates?button('detailField','Localizar en Campo',true):''
    ])}
    <details class="sheet-more">
      <summary>Más información y fuentes</summary>
      <div class="detailgrid">
        <b>Zona</b><span>${esc(x.area||'')}</span>
        <b>Estado</b><span>${esc(x.status||'')}</span>
        ${coords?`<b>Coordenadas</b><span>${coords}</span>`:''}
        <b>Acceso</b><span>${esc(x.access||'Sin comprobar')}</span>
        <b>Por comprobar</b><span>${esc(x.verify||'')}</span>
        <b>Experiencia</b><span>${esc(x.experience||'')}</span>
        <b>Fuente</b><span>${source}</span>
        ${x.web_evidence?`<b>Contraste web</b><span>${esc(x.web_evidence)}</span>`:''}
      </div>
      ${more}
      ${coords?`<button id="detailCopy" class="text-btn">Copiar coordenadas</button>`:''}
    </details>`;
  showSheet(html,'#poi='+encodeURIComponent(id));
  $('#detailFav').onclick=()=>{setFavorite(id,!favorites().has(id));openPOI(id);};
  $('#detailShare').onclick=()=>sharePOI(x);
  if(x.coordinates){
    $('#detailMap').onclick=()=>{closeDetail();emit('fly',x.coordinates);};
    $('#detailCopy').onclick=()=>copyText(`${x.coordinates[1].toFixed(7)}, ${x.coordinates[0].toFixed(7)}`);
  }
  if(!x.coordinates)$('#detailField').onclick=()=>{closeDetail();emit('field-poi',id);};
}

export function openPlace(id){
  const x=S.PLACES.find(p=>p.id===id);if(!x)return;
  const d=(S.userPosition&&x.coordinates)?formatDistance(distanceM(S.userPosition,x.coordinates)):'';
  const html=`
    <div class="sheet-heading"><div><span class="eyebrow">NÚCLEO OFICIAL · PBA</span><h2>${esc(x.name)}</h2></div></div>
    ${photoBlock(x)}
    <div class="chips"><span class="chip ok">Núcleo oficial</span>${d?`<span class="chip">${d}</span>`:''}</div>
    ${actions([button('placeMap','Centrar en mapa',true),x.image_page?'<a class="soft-btn action-link" href="'+esc(x.image_page)+'" target="_blank" rel="noopener">Ver fotografía</a>':''])}
    <details class="sheet-more"><summary>Datos cartográficos</summary>
      <div class="detailgrid"><b>Coordenadas</b><span>${x.coordinates[1].toFixed(6)}, ${x.coordinates[0].toFixed(6)}</span><b>Fuente</b><span>Plan Básico Autonómico de Galicia</span></div>
    </details>`;
  showSheet(html);
  $('#placeMap').onclick=()=>{closeDetail();emit('fly',x.coordinates);};
}

export function openFieldRecord(r){
  if(!r)return;
  const photo=r.photo?`<figure class="sheet-photo"><img src="${r.photo}" alt="${esc(r.name||'Punto de campo')}"><figcaption>Trabajo de campo · sin publicar</figcaption></figure>`:'';
  const html=`
    <div class="sheet-heading"><div><span class="eyebrow">TRABAJO DE CAMPO · SIN PUBLICAR</span><h2>${esc(r.name||'Punto de campo')}</h2></div></div>
    ${photo}
    <p class="sheet-summary">${esc(r.notes||'')}</p>
    <div class="chips"><span class="chip field-chip">${esc(r.category||'Campo')}</span></div>
    ${actions([button('fieldMap','Centrar en mapa',true)])}
    <details class="sheet-more"><summary>Datos de captura</summary><div class="detailgrid">
      <b>Coordenadas</b><span>${r.coordinates?.[1]?.toFixed?.(6)||''}, ${r.coordinates?.[0]?.toFixed?.(6)||''}</span>
      <b>Método</b><span>${esc(r.method||'')}</span><b>Precisión</b><span>${r.accuracy?Math.round(r.accuracy)+' m':'—'}</span>
      <b>Acceso observado</b><span>${esc(r.access||'')}</span>
    </div></details>`;
  showSheet(html);
  $('#fieldMap').onclick=()=>{closeDetail();emit('fly',r.coordinates);};
}

export function openMapFeature(p={}){
  const rows=(p.details||[]).map(x=>`<div class="feature-line">${esc(x)}</div>`).join('');
  const html=`
    <div class="sheet-heading"><div><span class="eyebrow">${esc(p.eyebrow||'CAMINO / SENDERO')}</span><h2>${esc(p.name||'Camino')}</h2></div></div>
    <p class="sheet-summary">${esc(p.subtitle||'Elemento cartografiado en OpenStreetMap.')}</p>
    <div class="chips">${p.kind?`<span class="chip">${esc(p.kind)}</span>`:''}</div>
    ${rows?`<div class="feature-lines">${rows}</div>`:''}
    <p class="sheet-caution">La cartografía no demuestra por sí sola titularidad pública, derecho de paso ni transitabilidad actual.</p>
    ${p.url?`<a class="primary-btn action-link wide-link" href="${esc(p.url)}" target="_blank" rel="noopener">Ver en OpenStreetMap</a>`:''}`;
  showSheet(html);
}

async function sharePOI(x){
  const url=location.origin+location.pathname+'#poi='+encodeURIComponent(x.id);
  try{if(navigator.share)await navigator.share({title:x.name,text:`${x.name} · Descubre A Lamosa`,url});else await copyText(url);}catch(e){}
}
