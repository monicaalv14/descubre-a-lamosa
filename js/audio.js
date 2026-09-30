import {S,$,toast,distanceM,recordError} from './state.js';

let watch=null;
let activeAudio=null;
let speakingToken=0;
let voices=[];
const DEFAULT_RATE=.94;

export function initAudio(){
  window.addEventListener('alm:speak-poi',e=>speakPoi(e.detail));
  window.addEventListener('alm:stop-audio',()=>stopSpeech(false));
  window.addEventListener('alm:lang',()=>{refreshVoices();updateVoiceHint();});
  setupSettings();
  refreshVoices();
  if('speechSynthesis'in window){
    speechSynthesis.addEventListener?.('voiceschanged',refreshVoices);
    speechSynthesis.onvoiceschanged=refreshVoices;
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
  if(/natural|neural|premium|enhanced|studio|online/.test(name))score+=45;
  if(/google|microsoft|samsung/.test(name))score+=24;
  if(/female|mujer|feminina|femenina/.test(name))score+=4;
  if(v.localService)score+=navigator.onLine?5:25;
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
  const recorded=recordedAudioFor(p);
  if(recorded){
    try{
      activeAudio=new Audio(recorded);
      activeAudio.preload='auto';
      activeAudio.onended=()=>emitAudioState('idle',p);
      activeAudio.onerror=()=>{activeAudio=null;speakWithDeviceVoice(p);};
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
function buildText(p){
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
  if(S.lang==='gl')return p.audio_gl||p.audio_url_gl||p.audio_url||null;
  return p.audio_es||p.audio_url_es||p.audio_url||null;
}
export function stopSpeech(showToast=false){
  speakingToken++;
  try{speechSynthesis?.cancel?.();}catch{}
  if(activeAudio){try{activeAudio.pause();activeAudio.currentTime=0;}catch{}activeAudio=null;}
  if(showToast)toast('Audioguía detenida');
  emitAudioState('idle');
}
function speakSample(){
  const sample=S.lang==='gl'
    ?'Benvida á Lamosa. A nosa historia vive nos camiños, nas fontes e na memoria da súa xente.'
    :'Bienvenida a A Lamosa. Nuestra historia vive en los caminos, las fuentes y la memoria de su gente.';
  speakWithDeviceVoice({id:'sample',name:'',description:sample});
}
function emitAudioState(state,p=null,source=null){
  window.dispatchEvent(new CustomEvent('alm:audio-state',{detail:{state,poiId:p?.id||null,source}}));
}
function startAuto(){
  if(watch!=null||!navigator.geolocation)return;
  watch=navigator.geolocation.watchPosition(pos=>{
    const c=[pos.coords.longitude,pos.coords.latitude];
    const near=S.pois.filter(p=>p.coordinates&&!S.audioSpoken.has(p.id))
      .map(p=>({...p,_d:distanceM(c,p.coordinates)})).filter(p=>p._d<=45).sort((a,b)=>a._d-b._d)[0];
    if(near){S.audioSpoken.add(near.id);speakPoi(near);}
  },e=>recordError(e,'audio-gps'),{enableHighAccuracy:false,maximumAge:8000,timeout:15000});
}
function stopAuto(){if(watch!=null)navigator.geolocation.clearWatch(watch);watch=null;stopSpeech(false);}
function escapeText(s=''){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function escapeAttr(s=''){return escapeText(s).replace(/'/g,'&#39;');}
