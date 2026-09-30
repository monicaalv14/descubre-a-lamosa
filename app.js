import {S,$,setMode,recordError} from './js/state.js';
import {loadData} from './js/data.js';
import {initMap} from './js/map.js';
import {initUI} from './js/ui.js';
import {initRoutes} from './js/routes.js';
import {initField} from './js/field.js';
import {initOffline} from './js/offline.js';
import {initAudio} from './js/audio.js';
import {initContributions} from './js/contributions.js';
import {initDiagnostics} from './js/diagnostics.js';

async function boot(){
  try{
    const params=new URLSearchParams(location.search);
    if(params.get('mode')==='research'||params.get('mode')==='visitor')setMode(params.get('mode'));
    await loadData();
    initUI();
    await initMap();
    initRoutes();
    initField();
    initOffline();
    initAudio();
    initContributions();
    initDiagnostics();
    bindPwa();
    connection();
    document.body.dataset.appReady='true';
  }catch(e){
    recordError(e,'boot');document.body.dataset.appReady='error';
    const s=document.querySelector('#mapStatus');if(s)s.textContent='Error de arranque: '+e.message;
  }
}
function connection(){
  const b=$('#connectionBadge');if(!b)return;
  b.textContent=navigator.onLine?'● Online':'● Offline';b.title=navigator.onLine?'Con conexión':'Sin conexión';
}
window.addEventListener('online',connection);window.addEventListener('offline',connection);

function bindPwa(){
  let prompt=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e;$('#installBtn').hidden=false;});
  $('#installBtn').onclick=async()=>{if(!prompt)return;prompt.prompt();await prompt.userChoice;prompt=null;$('#installBtn').hidden=true;};
  $('#reloadBtn').onclick=()=>location.reload();
  if('serviceWorker'in navigator){
    navigator.serviceWorker.register('sw.js?v=110b1',{updateViaCache:'none'}).then(reg=>{
      reg.addEventListener('updatefound',()=>{const w=reg.installing;w?.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)$('#updateBanner').hidden=false;});});
    }).catch(e=>recordError(e,'service-worker'));
  }
}
boot();
