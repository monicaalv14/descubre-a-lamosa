import {S,$,toast,distanceM,recordError} from './state.js';
let watch=null;
export function initAudio(){
  window.addEventListener('alm:speak-poi',e=>speakPoi(e.detail));
  $('#autoAudioToggle').checked=localStorage.getItem('aLamosaAutoAudio')==='1';
  $('#autoAudioToggle').onchange=e=>{localStorage.setItem('aLamosaAutoAudio',e.target.checked?'1':'0');e.target.checked?startAuto():stopAuto();};
  if($('#autoAudioToggle').checked)startAuto();
}
export function speakPoi(p){
  if(!p||!('speechSynthesis'in window)){toast('Síntesis de voz no disponible');return;}
  speechSynthesis.cancel();
  const text=[p.name,p.description,p.experience].filter(Boolean).join('. ');
  const u=new SpeechSynthesisUtterance(text);u.lang=S.lang==='gl'?'gl-ES':'es-ES';u.rate=.98;speechSynthesis.speak(u);
}
function startAuto(){
  if(watch!=null||!navigator.geolocation)return;
  watch=navigator.geolocation.watchPosition(pos=>{
    const c=[pos.coords.longitude,pos.coords.latitude],near=S.pois.filter(p=>p.coordinates&&!S.audioSpoken.has(p.id)).map(p=>({...p,_d:distanceM(c,p.coordinates)})).filter(p=>p._d<=45).sort((a,b)=>a._d-b._d)[0];
    if(near){S.audioSpoken.add(near.id);speakPoi(near);}
  },e=>recordError(e,'audio-gps'),{enableHighAccuracy:false,maximumAge:8000,timeout:15000});
}
function stopAuto(){if(watch!=null)navigator.geolocation.clearWatch(watch);watch=null;speechSynthesis?.cancel?.();}
