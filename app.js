let POIS=[], ROUTES=[], PLACES=[], map=null;
const VERSION='0.6.2';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);

function setAppStatus(t){const e=$('#appStatus');if(e)e.textContent='v'+VERSION+' · '+t;}
function connectionStatus(){const e=$('#offline');if(e)e.textContent=navigator.onLine?'● En línea':'● Sin conexión';}
addEventListener('online',connectionStatus);addEventListener('offline',connectionStatus);connectionStatus();

async function getJSON(url){
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok) throw new Error(url+' → HTTP '+r.status);
  return r.json();
}

async function boot(){
  try{
    setAppStatus('cargando datos…');
    const [p1,p2,p3,p4,routes,places]=await Promise.all([
      getJSON('data/pois-1.json?v=062'),
      getJSON('data/pois-2.json?v=062'),
      getJSON('data/pois-3.json?v=062'),
      getJSON('data/pois-4.json?v=062'),
      getJSON('data/routes.json?v=062'),
      getJSON('data/places.json?v=062')
    ]);
    POIS=[...p1,...p2,...p3,...p4]; ROUTES=routes; PLACES=places;
    setupUI();
    setAppStatus(POIS.length+' elementos cargados');
    initMap();
  }catch(e){
    console.error(e);
    setAppStatus('ERROR al cargar datos');
    const s=$('#stats'); if(s)s.textContent='Error cargando los datos de la aplicación: '+e.message;
    const note=$('#officialLayers'); if(note)note.textContent='Datos locales no disponibles.';
  }
}

function setupUI(){
  const filter=$('#filter');
  const types=[...new Set(POIS.map(x=>x.type).filter(Boolean))].sort();
  filter.innerHTML='<option value="">Todas las categorías</option>'+types.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  render(); renderRoutes(); renderPlaces();
  $('#search').addEventListener('input',render);
  filter.addEventListener('change',render);
}

function render(){
  const q=$('#search').value.toLowerCase();
  const f=$('#filter').value;
  const rows=POIS.filter(x=>(!f||x.type===f)&&(!q||Object.values(x).join(' ').toLowerCase().includes(q)));
  $('#stats').textContent=`${rows.length} elementos · ${rows.filter(x=>x.coordinates).length} geolocalizados · ${rows.filter(x=>!x.coordinates).length} pendientes de coordenadas`;
  $('#cards').innerHTML=rows.map(card).join('');
  document.querySelectorAll('[data-poi]').forEach(e=>e.addEventListener('click',()=>openPOI(e.dataset.poi)));
}
function card(x){
  const pend=!x.coordinates?'<span class="chip pending">Pendiente de coordenada</span>':'<span class="chip">En el mapa</span>';
  const ev=x.web_evidence?'<span class="chip">Existencia contrastada</span>':'';
  const priv=/privad/i.test(x.access||'')?'<span class="chip private">Acceso sensible</span>':'';
  return `<article class="card" data-poi="${esc(x.id)}"><h3>${esc(x.name)}</h3><div class="muted">${esc(x.area)}</div><div class="chips"><span class="chip">${esc(x.subtype)}</span>${pend}${ev}${priv}</div><div>${esc(x.description)}</div></article>`;
}
function openPOI(id){
  const x=POIS.find(p=>p.id===id); if(!x)return;
  const coords=x.coordinates?`<b>Coordenadas</b><span>${x.coordinates[1].toFixed(6)}, ${x.coordinates[0].toFixed(6)}</span>`:'';
  const evidence=x.web_evidence?`<b>Contraste web</b><span>${esc(x.web_evidence)}</span>`:'';
  $('#detailbody').innerHTML=`<h2>${esc(x.name)}</h2><p>${esc(x.description)}</p><div class="detailgrid"><b>Zona</b><span>${esc(x.area)}</span><b>Tipo</b><span>${esc(x.type)} · ${esc(x.subtype)}</span><b>Estado</b><span>${esc(x.status)}</span>${coords}<b>Acceso</b><span>${esc(x.access)}</span><b>Por comprobar</b><span>${esc(x.verify)}</span><b>Experiencia</b><span>${esc(x.experience)}</span><b>Fuente de trabajo</b><span>${esc(x.source)}</span>${evidence}</div>`;
  $('#detail').showModal();
  if(map&&x.coordinates)map.flyTo({center:x.coordinates,zoom:17});
}
$('#close').addEventListener('click',()=>$('#detail').close());

function renderRoutes(){
  $('#routecards').innerHTML=ROUTES.map(r=>`<article class="card"><h3>${esc(r['Nombre provisional'])}</h3><div class="chips"><span class="chip">${esc(r['Tipo'])}</span><span class="chip">Base ${esc(r['Base disponible'])}</span></div><p>${esc(r['Paradas candidatas'])}</p>${r['Longitud']?`<p><b>${esc(r['Longitud'])}</b> · ${esc(r['Duración'])} · ${esc(r['Dificultad'])}</p>`:''}<div class="muted"><b>Estado:</b> ${esc(r['Estado'])}<br><b>Siguiente:</b> ${esc(r['Trabajo siguiente'])}</div></article>`).join('');
}
function renderPlaces(){
  $('#placecards').innerHTML=PLACES.map(x=>`<article class="card place" data-place="${esc(x.id)}"><h3>${esc(x.name)}</h3><div class="chips"><span class="chip">Núcleo oficial</span><span class="chip">PBA</span></div><div class="muted">${x.coordinates[1].toFixed(6)}, ${x.coordinates[0].toFixed(6)}</div></article>`).join('');
  document.querySelectorAll('[data-place]').forEach(e=>e.addEventListener('click',()=>{const x=PLACES.find(p=>p.id===e.dataset.place);if(map&&x)map.flyTo({center:x.coordinates,zoom:16});}));
}

function initMap(){
  const note=$('#officialLayers');
  if(!window.maplibregl){ if(note)note.textContent='Mapa externo no disponible; datos locales cargados.'; return; }
  try{
    map=new maplibregl.Map({container:'map',style:'https://demotiles.maplibre.org/style.json',center:[-8.356,42.209],zoom:13});
    map.addControl(new maplibregl.NavigationControl(),'top-right');
    map.addControl(new maplibregl.GeolocateControl({positionOptions:{enableHighAccuracy:true},trackUserLocation:true,showAccuracyCircle:true}),'top-right');
    map.on('load',()=>{renderMapPoints();loadOfficialLayers();});
    map.on('error',e=>console.warn('Mapa:',e?.error||e));
  }catch(e){
    console.warn('Mapa no disponible',e);
    if(note)note.textContent='Mapa no disponible; datos locales cargados.';
  }
}
function renderMapPoints(){
  if(!map)return;
  const located=POIS.filter(x=>Array.isArray(x.coordinates)&&x.coordinates.length===2);
  located.forEach(x=>new maplibregl.Marker().setLngLat(x.coordinates).setPopup(new maplibregl.Popup().setHTML(`<b>${esc(x.name)}</b><br>${esc(x.area)}`)).addTo(map));
  PLACES.forEach(x=>{const el=document.createElement('div');el.className='place-marker';new maplibregl.Marker({element:el}).setLngLat(x.coordinates).setPopup(new maplibregl.Popup().setHTML(`<b>${esc(x.name)}</b><br><small>Núcleo oficial · PBA</small>`)).addTo(map);});
  const all=[...located.map(x=>x.coordinates),...PLACES.map(x=>x.coordinates)];
  if(all.length){const b=new maplibregl.LngLatBounds();all.forEach(x=>b.extend(x));map.fitBounds(b,{padding:70,maxZoom:14});}
}
async function loadOfficialLayers(){
  if(!map)return;
  const layers=[
    {id:'parish',url:"https://ideg.xunta.gal/servizos/rest/services/LimitesAdministrativos/LimitesAdministrativos/MapServer/18/query?where="+encodeURIComponent("CONCELLO='Covelo' AND PARROQUIA LIKE '%Lamosa%'")+"&outFields=CONCELLO,PARROQUIA,CODIGOINE&returnGeometry=true&outSR=4326&f=geojson",add:data=>{map.addSource('parish-official',{type:'geojson',data});map.addLayer({id:'parish-fill',type:'fill',source:'parish-official',paint:{'fill-color':'#315c48','fill-opacity':0.08}});map.addLayer({id:'parish-line',type:'line',source:'parish-official',paint:{'line-color':'#244b3a','line-width':3,'line-dasharray':[2,2]}});}},
    {id:'prg119',url:"https://ideg.xunta.gal/servizos/rest/services/CatalogoPaisaxesGalicia/CPG_ValorPaisaxistico_Panoramicos_2/MapServer/6/query?where="+encodeURIComponent("DENOMINACI='PR-G 119 Ruta do Xabriña'")+"&outFields=CODIGO,DENOMINACI&returnGeometry=true&outSR=4326&f=geojson",add:data=>{map.addSource('prg119-official',{type:'geojson',data});map.addLayer({id:'prg119-line',type:'line',source:'prg119-official',paint:{'line-color':'#168a50','line-width':4}});}}
  ];
  let ok=0;
  for(const l of layers){try{const r=await fetch(l.url);if(!r.ok)throw new Error(r.status);const d=await r.json();if(d.features?.length){l.add(d);ok++;}}catch(e){console.warn(l.id,e);}}
  const badge=$('#officialLayers');if(badge)badge.textContent=`Capas Xunta: ${ok}/2 cargadas`;
}

document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.tab,.view').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); $('#'+b.dataset.tab).classList.add('active');
}));

let installPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;const b=$('#install');if(b)b.hidden=false;});
$('#install')?.addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#install').hidden=true;});

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js?v=062',{updateViaCache:'none'}).catch(console.warn);
}
boot();
