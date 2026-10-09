import {S,$,toast,distanceM,recordError} from './state.js';

let watch=null;
let activeAudio=null;
let activeAudioUrl=null;
let speakingToken=0;
let voices=[];
let activeNarratedRoute=null;
let routeStopState=new Map();
let routeNarrationState={routeId:null,started:false,nextAnnounced:null,lastTransitionAt:0,finished:false};
const DEFAULT_RATE=.94;

export function initAudio(){
  window.addEventListener('alm:speak-poi',e=>speakPoi(e.detail));
  window.addEventListener('alm:stop-audio',()=>stopSpeech(false));
  window.addEventListener('alm:lang',()=>{refreshVoices();updateVoiceHint();});
  window.addEventListener('alm:route-follow-start',e=>{activeNarratedRoute=e.detail?.routeId||e.detail?.id||null;routeStopState.clear();routeNarrationState={routeId:activeNarratedRoute,started:false,nextAnnounced:null,lastTransitionAt:0,finished:false};stopAuto(false);if(localStorage.getItem('aLamosaAutoAudio')==='1'){speakRouteIntro(activeNarratedRoute);startAuto();}});
  window.addEventListener('alm:route-follow-stop',()=>{activeNarratedRoute=null;routeStopState.clear();routeNarrationState={routeId:null,started:false,nextAnnounced:null,lastTransitionAt:0,finished:false};if(localStorage.getItem('aLamosaAutoAudio')==='1')startAuto();});
  setupSettings();
  refreshVoices();
  if('speechSynthesis'in window){
    if(speechSynthesis.addEventListener)speechSynthesis.addEventListener('voiceschanged',refreshVoices);
    else speechSynthesis.onvoiceschanged=refreshVoices;
  }
  const auto=localStorage.getItem('aLamosaAutoAudio')==='1';
  $('#autoAudioToggle').checked=auto;
  $('#autoAudioToggle').onchange=e=>{
    localStorage.setItem('aLamosaAutoAudio',e.target.checked?'1':'0');
    e.target.checked?startAuto():stopAuto();
  };
  if(auto)startAuto();
}
function setupSettings(){
  const rate=Number(localStorage.getItem('aLamosaVoiceRate')||DEFAULT_RATE);
  $('#voiceRate').value=Number.isFinite(rate)?rate:DEFAULT_RATE;
  updateRateLabel();
  $('#voiceRate').oninput=()=>{localStorage.setItem('aLamosaVoiceRate',$('#voiceRate').value);updateRateLabel();};
  $('#voiceSelect').onchange=()=>{
    localStorage.setItem('aLamosaVoiceURI',$('#voiceSelect').value);
    updateVoiceHint();
  };
  $('#voiceSampleBtn').onclick=()=>speakSample();
  $('#voiceAutoBtn').onclick=()=>{
    localStorage.removeItem('aLamosaVoiceURI');
    selectRecommendedVoice();
    updateVoiceHint();
    toast('Voz recomendada seleccionada');
  };
}
function refreshVoices(){
  if(!('speechSynthesis'in window))return;
  voices=speechSynthesis.getVoices?.()||[];
  const select=$('#voiceSelect');
  if(!select)return;
  const locale=targetLocale(),sorted=[...voices].sort((a,b)=>scoreVoice(b,locale)-scoreVoice(a,locale)||a.name.localeCompare(b.name));
  select.innerHTML=sorted.length?sorted.map(v=>{
    const recommended=v===bestVoice(locale),lang=v.lang||'',offline=v.localService?' · offline':'';
    return '<option value="'+escapeAttr(v.voiceURI)+'">'+(recommended?'★ ':'')+escapeText(v.name)+' · '+escapeText(lang)+offline+'</option>';
  }).join(''):'<option value="">Voz del dispositivo</option>';
  const saved=localStorage.getItem('aLamosaVoiceURI');
  if(saved&&sorted.some(v=>v.voiceURI===saved))select.value=saved;else selectRecommendedVoice();
  select.disabled=!sorted.length;
  updateVoiceHint();
}
function targetLocale(){return S.lang==='gl'?'gl-ES':'es-ES';}
function scoreVoice(v,locale){
  const lang=(v.lang||'').toLowerCase(),want=locale.toLowerCase(),base=want.split('-')[0],name=(v.name||'').toLowerCase();
  let score=0;
  if(lang===want)score+=120;
  else if(lang.startsWith(base))score+=80;
  else if(base==='gl'&&lang.startsWith('es'))score+=18;
  // Prefer high-quality Spanish voices, then likely feminine voices. Voice names vary by Android engine.
  if(/natural|neural|premium|enhanced|studio|wavenet/.test(name))score+=55;
  if(/google|microsoft|samsung/.test(name))score+=24;
  if(/female|mujer|feminina|femenina|woman/.test(name))score+=28;
  // Common feminine names exposed by major Android/browser TTS engines.
  if(/\b(elvira|helena|lucia|lucía|maria|maría|paulina|sabina|sofia|sofía|isabela|dalia|conchita)\b/.test(name))score+=22;
  if(/\b(pablo|jorge|alvaro|álvaro|diego|enrique)\b/.test(name))score-=18;
  // For an offline guide, local voices win unless a remote voice is explicitly higher quality.
  if(v.localService)score+=navigator.onLine?14:32;
  if(v.default)score+=3;
  return score;
}
function bestVoice(locale=targetLocale()){
  if(!voices.length)return null;
  return [...voices].sort((a,b)=>scoreVoice(b,locale)-scoreVoice(a,locale))[0]||null;
}
function selectedVoice(){
  const uri=localStorage.getItem('aLamosaVoiceURI');
  return voices.find(v=>v.voiceURI===uri)||bestVoice();
}
function selectRecommendedVoice(){
  const v=bestVoice();if(!v)return;
  $('#voiceSelect').value=v.voiceURI;
  localStorage.setItem('aLamosaVoiceURI',v.voiceURI);
}
function updateRateLabel(){
  const v=Number($('#voiceRate')?.value||DEFAULT_RATE);
  if($('#voiceRateValue'))$('#voiceRateValue').textContent=v.toFixed(2)+'×';
}
function updateVoiceHint(){
  const h=$('#voiceHint');if(!h)return;
  const v=selectedVoice();
  if(!v){h.textContent='La calidad depende de las voces instaladas en el teléfono.';return;}
  const recommended=v===bestVoice();
  h.textContent=(recommended?'Voz recomendada · ':'')+(v.localService?'disponible sin conexión':'puede depender de conexión')+'.';
}
export async function speakPoi(p){
  if(!p)return;
  stopSpeech(false);
  const guide=guideFor(p);
  const recorded=recordedAudioFor(p);
  if(recorded){
    try{
      activeAudio=await audioFromCachedFile(recorded);
      activeAudio.onended=()=>{releaseActiveAudioUrl();emitAudioState('idle',p);};
      activeAudio.onerror=()=>{releaseActiveAudioUrl();activeAudio=null;speakWithDeviceVoice(p);};
      await activeAudio.play();
      emitAudioState('playing',p,'recorded');
      return;
    }catch(e){recordError(e,'recorded-audio');activeAudio=null;}
  }
  speakWithDeviceVoice(p);
}
function speakWithDeviceVoice(p){
  if(!('speechSynthesis'in window)){toast('La voz no está disponible en este dispositivo');return;}
  const text=buildText(p);if(!text)return;
  const token=++speakingToken,chunks=segmentText(text);
  emitAudioState('playing',p,'tts');
  speakChunks(chunks,p,token,0);
}
function speakChunks(chunks,p,token,index){
  if(token!==speakingToken||index>=chunks.length){if(token===speakingToken)emitAudioState('idle',p);return;}
  const u=new SpeechSynthesisUtterance(chunks[index]);
  u.lang=targetLocale();u.rate=Number(localStorage.getItem('aLamosaVoiceRate')||DEFAULT_RATE);u.pitch=1;
  const v=selectedVoice();if(v)u.voice=v;
  u.onend=()=>{if(token!==speakingToken)return;const pause=pauseFor(chunks[index]);setTimeout(()=>speakChunks(chunks,p,token,index+1),pause);};
  u.onerror=e=>{if(e.error!=='interrupted'&&e.error!=='canceled')recordError(e,'speech');if(token===speakingToken)emitAudioState('idle',p);};
  speechSynthesis.speak(u);
}
function guideFor(p){return S.audioGuides?.[p?.id]||null;}
function buildText(p){
  const g=guideFor(p);
  if(g){const suffix=S.lang==='gl'?'_gl':'_es';const title=g['title'+suffix]||g.title_es||p.name,intro=g['intro'+suffix]||g.intro_es,narration=g['narration'+suffix]||g.narration_es,look=g['look_for'+suffix]||g.look_for_es;return [title,intro,narration,look].filter(Boolean).join('. ');}
  const desc=S.lang==='gl'?(p.description_gl||p.description):(p.description_es||p.description);
  const exp=S.lang==='gl'?(p.experience_gl||p.experience):(p.experience_es||p.experience);
  return [p.name,desc,exp].filter(Boolean).join('. ');
}
function segmentText(text){
  const clean=String(text).replace(/\s+/g,' ').trim();
  if(!clean)return [];
  try{
    const seg=new Intl.Segmenter(S.lang==='gl'?'gl':'es',{granularity:'sentence'});
    return [...seg.segment(clean)].map(x=>x.segment.trim()).filter(Boolean).flatMap(splitLong);
  }catch{
    return clean.match(/[^.!?…]+[.!?…]?/g)?.map(x=>x.trim()).filter(Boolean).flatMap(splitLong)||[clean];
  }
}
function splitLong(s){
  if(s.length<=220)return [s];
  const parts=s.split(/(?<=[,;:])\s+/),out=[];let cur='';
  for(const p of parts){if((cur+' '+p).trim().length>210&&cur){out.push(cur.trim());cur=p;}else cur=(cur+' '+p).trim();}
  if(cur)out.push(cur.trim());return out;
}
function pauseFor(s){if(/[!?…]\s*$/.test(s))return 260;if(/[.;:]\s*$/.test(s))return 190;return 120;}
function recordedAudioFor(p){
  if(S.lang==='gl')return p.audio_gl||p.audio_url_gl||p.audio_es||p.audio_url_es||p.audio_url||null;
  return p.audio_es||p.audio_url_es||p.audio_url||null;
}
export function stopSpeech(showToast=false){
  speakingToken++;
  try{speechSynthesis?.cancel?.();}catch{}
  if(activeAudio){try{activeAudio.pause();activeAudio.currentTime=0;}catch{}activeAudio=null;}releaseActiveAudioUrl();
  if(showToast)toast('Audioguía detenida');
  emitAudioState('idle');
}
async function speakSample(){
  stopSpeech(false);
  const sample='audio/es/poi-001.wav';
  try{
    activeAudio=await audioFromCachedFile('audio/es/poi-001.wav');
    activeAudio.onended=()=>{releaseActiveAudioUrl();emitAudioState('idle');};
    activeAudio.onerror=()=>{releaseActiveAudioUrl();activeAudio=null;toast('No se pudo reproducir la muestra de Santa');};
    await activeAudio.play();
  }catch(e){recordError(e,'santa-sample');activeAudio=null;toast('No se pudo reproducir la muestra de Santa');}
}
async function audioFromCachedFile(path){
  const response=await fetch(path,{cache:'force-cache'});
  if(!response.ok)throw new Error('Audio HTTP '+response.status);
  const blob=await response.blob();
  if(!blob.size)throw new Error('Audio vacío');
  releaseActiveAudioUrl();
  activeAudioUrl=URL.createObjectURL(blob);
  const audio=new Audio(activeAudioUrl);audio.preload='auto';
  return audio;
}
function releaseActiveAudioUrl(){if(activeAudioUrl){try{URL.revokeObjectURL(activeAudioUrl);}catch{}activeAudioUrl=null;}}
function emitAudioState(state,p=null,source=null){
  window.dispatchEvent(new CustomEvent('alm:audio-state',{detail:{state,poiId:p?.id||null,source}}));
}
function startAuto(){
  if(watch!=null||!navigator.geolocation)return;
  watch=navigator.geolocation.watchPosition(pos=>{
    const c=[pos.coords.longitude,pos.coords.latitude];
    const routeNear=activeNarratedRoute?nextRouteStop(c,activeNarratedRoute):null;
    if(routeNear){speakPoi(routeNear);announceUpcomingAfter(routeNear.id,activeNarratedRoute);return;}
    if(activeNarratedRoute){updateRouteNarration(c,activeNarratedRoute);emitRouteGuideProgress(c,activeNarratedRoute);}
    if(activeNarratedRoute)return;
    const near=S.pois.filter(p=>p.coordinates&&!S.audioSpoken.has(p.id))
      .map(p=>({...p,_d:distanceM(c,p.coordinates)})).filter(p=>p._d<=45).sort((a,b)=>a._d-b._d)[0];
    if(near){S.audioSpoken.add(near.id);speakPoi(near);}
  },e=>recordError(e,'audio-gps'),{enableHighAccuracy:false,maximumAge:8000,timeout:15000});
}
function speakNarrationText(text,label='Ruta'){
  if(!text||!('speechSynthesis'in window))return;
  stopSpeech(false);const token=++speakingToken,chunks=segmentText(text),p={id:'route-narration',name:label};
  emitAudioState('playing',p,'route-tts');speakChunks(chunks,p,token,0);
}
function speakRouteIntro(routeId){
  const route=S.routeNarratives?.[routeId];if(!route||routeNarrationState.started)return;
  const intro=S.lang==='gl'?(route.intro_gl||route.intro_es):route.intro_es;
  if(intro){routeNarrationState.started=true;speakNarrationText(intro,route.title||'Ruta');}
}
function orderedRoutePois(routeId){
  const route=S.routeNarratives?.[routeId];return (route?.stops||[]).map(s=>({stop:s,poi:S.pois.find(p=>p.id===s.poi_id)})).filter(x=>x.poi);
}
function announceUpcomingAfter(poiId,routeId){
  const items=orderedRoutePois(routeId),i=items.findIndex(x=>x.poi.id===poiId),next=items.slice(i+1).find(x=>!x.stop.manual_only&&x.poi.coordinates);
  if(!next||routeNarrationState.nextAnnounced===next.poi.id)return;
  routeNarrationState.nextAnnounced=next.poi.id;
  setTimeout(()=>{if(activeNarratedRoute!==routeId)return;const route=S.routeNarratives?.[routeId],transition=S.lang==='gl'?(route?.transition_gl||route?.transition_es):route?.transition_es;const text=[transition,'La próxima parada es '+next.poi.name+'.'].filter(Boolean).join(' ');speakNarrationText(text,route?.title||'Ruta');routeNarrationState.lastTransitionAt=Date.now();},1200);
}
function updateRouteNarration(c,routeId){
  const route=S.routeNarratives?.[routeId],items=orderedRoutePois(routeId).filter(x=>!x.stop.manual_only&&x.poi.coordinates);if(!route||!items.length)return;
  const remaining=items.filter(x=>!routeStopState.get(x.poi.id)?.playedAt);
  if(!remaining.length&&!routeNarrationState.finished){routeNarrationState.finished=true;const end=S.lang==='gl'?(route.outro_gl||route.outro_es):route.outro_es;speakNarrationText(end||('Has completado las paradas narradas de '+(route.title||'esta ruta')+'.'),route.title||'Ruta');return;}
  const next=remaining.map(x=>({...x,d:distanceM(c,x.poi.coordinates)})).sort((a,b)=>a.d-b.d)[0];
  if(next&&next.d<=180&&next.d>60&&routeNarrationState.nextAnnounced!==next.poi.id&&Date.now()-routeNarrationState.lastTransitionAt>90000){routeNarrationState.nextAnnounced=next.poi.id;speakNarrationText('Te estás acercando a '+next.poi.name+'.',route.title||'Ruta');routeNarrationState.lastTransitionAt=Date.now();}
}
function emitRouteGuideProgress(c,routeId){
  const route=S.routeNarratives?.[routeId];if(!route)return;const items=(route.stops||[]).map(s=>({stop:s,poi:S.pois.find(p=>p.id===s.poi_id)})).filter(x=>x.poi),visitedIds=items.filter(x=>routeStopState.get(x.poi.id)?.playedAt).map(x=>x.poi.id);
  const pending=items.filter(x=>!visitedIds.includes(x.poi.id));let next=null,nextDistance=null;
  for(const x of pending){if(x.stop.manual_only||!x.poi.coordinates){if(!next)next=x;continue;}const d=distanceM(c,x.poi.coordinates);if(nextDistance==null||d<nextDistance){next=x;nextDistance=d;}}
  window.dispatchEvent(new CustomEvent('alm:route-guide-progress',{detail:{routeId,visitedIds,nextPoiId:next?.poi.id||null,nextDistance}}));
}
function nextRouteStop(c,routeId){
  const route=S.routeNarratives?.[routeId];if(!route)return null;
  const defaults=S.routeNarrativeDefaults||{},leave=Number(defaults.leave_radius_m||55),cooldown=Number(defaults.replay_cooldown_min||30)*60000,now=Date.now();
  let best=null;
  for(const stop of route.stops||[]){if(stop.manual_only)continue;const p=S.pois.find(x=>x.id===stop.poi_id);if(!p?.coordinates)continue;const d=distanceM(c,p.coordinates),radius=Number(stop.arrival_radius_m||defaults.arrival_radius_m||35),st=routeStopState.get(p.id)||{};
    if(d>Math.max(leave,radius+15)){st.inside=false;routeStopState.set(p.id,st);continue;}
    if(d<=radius&&!st.inside&&(!st.playedAt||now-st.playedAt>cooldown)){if(!best||d<best.d)best={p,d,st};}
  }
  if(best){best.st.inside=true;best.st.playedAt=now;routeStopState.set(best.p.id,best.st);return best.p;}return null;
}
function stopAuto(stopVoice=true){if(watch!=null)navigator.geolocation.clearWatch(watch);watch=null;if(stopVoice)stopSpeech(false);}
function escapeText(s=''){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function escapeAttr(s=''){return escapeText(s).replace(/'/g,'&#39;');}
