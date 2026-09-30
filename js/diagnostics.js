import {S,$,copyText,dbGetAll,recordError} from './state.js';
export function initDiagnostics(){
  $('#diagnosticBtn').onclick=openDiagnostic;$('#copyDiagnosticBtn').onclick=()=>copyText($('#diagnosticOutput').textContent);
}
async function openDiagnostic(){
  const d=await collect();$('#diagnosticOutput').textContent=JSON.stringify(d,null,2);
  const sh=$('#diagnosticSheet');sh.hidden=false;$('#sheetBackdrop').hidden=false;requestAnimationFrame(()=>sh.classList.add('open','full'));
}
async function collect(){
  const cachesList=await caches.keys().catch(()=>[]),est=await navigator.storage?.estimate?.().catch?.(()=>null);
  const [records,tracks,contribs]=await Promise.all([dbGetAll('records').catch(()=>[]),dbGetAll('tracks').catch(()=>[]),dbGetAll('contributions').catch(()=>[])]);
  return {
    version:'0.12.3-beta.1',time:new Date().toISOString(),online:navigator.onLine,mode:S.mode,lang:S.lang,
    serviceWorker:{supported:'serviceWorker'in navigator,controlled:!!navigator.serviceWorker?.controller},
    performance:{bootMs:Number(document.body.dataset.bootMs||0),navigation:performance.getEntriesByType('navigation')[0]?.duration||null},
    map:{created:!!S.map,loaded:!!S.map?.loaded?.(),style:S.map?.getStyle?.()?.name||null,pathsLoaded:!!S.osmNetwork},
    catalog:{pois:S.pois.length,visitor:S.pois.filter(x=>x.visitor_visible).length,places:S.places.length,osmSegments:S.osmNetwork?.features?.length||0},
    generated:S.buildInfo||{},field:{records:records.length,tracks:tracks.length,contributions:contribs.length},
    audio:{voiceURI:localStorage.getItem('aLamosaVoiceURI')||'auto',rate:Number(localStorage.getItem('aLamosaVoiceRate')||.94),automatic:localStorage.getItem('aLamosaAutoAudio')==='1'},
    storage:est?{usageMB:+((est.usage||0)/1048576).toFixed(1),quotaMB:+((est.quota||0)/1048576).toFixed(1)}:null,
    caches:cachesList,errors:S.errors
  };
}
