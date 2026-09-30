import {S,$,VERSION,setStatus,connectionStatus,getJSON,updateStorageInfo} from './js/state.js';
import {setupUI,openPOI,setTab} from './js/ui.js?v=091';
import {setupMapEvents,initMap} from './js/map.js';
import {setupField,renderRecords} from './js/field.js';
import {setupTracks,renderTracks} from './js/tracks.js';
import {setupExports} from './js/export.js';

addEventListener('online',connectionStatus);addEventListener('offline',connectionStatus);connectionStatus();
window.addEventListener('alm:open-poi',e=>openPOI(e.detail));

async function boot(){
  try{
    setStatus('cargando datos…');
    const [p1,p2,p3,p4,p5,p6,routes,places,media]=await Promise.all([
      getJSON('data/pois-1.json?v=091'),getJSON('data/pois-2.json?v=091'),getJSON('data/pois-3.json?v=091'),getJSON('data/pois-4.json?v=091'),getJSON('data/pois-5.json?v=091'),getJSON('data/pois-6.json?v=091'),getJSON('data/routes.json?v=091'),getJSON('data/places.json?v=091'),getJSON('data/media.json?v=091')
    ]);
    const mediaMap=Object.fromEntries(media.map(x=>[x.id,x]));S.POIS=[...p1,...p2,...p3,...p4,...p5,...p6].map(x=>({...x,...(mediaMap[x.id]||{})}));S.ROUTES=routes;S.PLACES=places.map(x=>({...x,...(mediaMap[x.id]||{})}));
    setupUI();setupMapEvents();setupField();setupTracks();setupExports();initMap();
    renderRecords();renderTracks();updateStorageInfo();setStatus(S.POIS.length+' elementos · listo');import('./js/trail-network.js?v=091').then(m=>m.setupTrailNetwork()).catch(e=>console.warn('Caminos/rutas:',e));launch();
  }catch(e){console.error(e);setStatus('ERROR al cargar datos');$('#stats').textContent='Error cargando los datos locales: '+e.message;$('#officialLayers').textContent='Datos locales no disponibles.';}
}
function launch(){
  const p=new URLSearchParams(location.search);if(p.get('tab'))setTab(p.get('tab'));if(p.get('near')==='1')setTimeout(()=>$('#nearbyToggle').click(),350);
  const m=location.hash.match(/^#poi=(.+)$/);if(m)setTimeout(()=>openPOI(decodeURIComponent(m[1])),350);
}
let installPrompt=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#install').hidden=false;});
$('#install')?.addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#install').hidden=true;});
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js?v=091',{updateViaCache:'none'}).then(reg=>reg.addEventListener('updatefound',()=>{const w=reg.installing;if(w)w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)$('#updateBanner').hidden=false;});})).catch(console.warn);
boot();
