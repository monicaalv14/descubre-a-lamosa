import {S,$,$$,esc,toast,dbGetAll,dbPut,dbDelete,downloadBlob,recordError} from './state.js';
export function initContributions(){
  $('#contributionForm').onsubmit=save;
  render();
  window.addEventListener('alm:mode',render);
}
async function save(e){
  e.preventDefault();
  try{
    const f=$('#contribPhoto').files?.[0],photo=f?await resize(f):null;
    const row={id:'CONTRIB-'+Date.now(),name:$('#contribName').value.trim(),type:$('#contribType').value,text:$('#contribText').value.trim(),photo,createdAt:new Date().toISOString(),status:'Pendiente de revisión'};
    await dbPut('contributions',row);e.target.reset();await render();toast('Aportación guardada como pendiente');
  }catch(err){recordError(err,'contribution');toast('No se pudo guardar');}
}
async function render(){
  const rows=(await dbGetAll('contributions')).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  $('#contributionQueue').innerHTML=rows.map(r=>{
    const moderation=S.mode==='research'?'<div class="moderation-actions"><button data-contrib-status="'+esc(r.id)+'|Aceptada">✓</button><button data-contrib-status="'+esc(r.id)+'|Rechazada">×</button></div>':'<button class="tiny-share" data-contrib-share="'+esc(r.id)+'">↗</button>';
    return '<article class="list-row"><div class="ico">+</div><div><strong>'+esc(r.name)+'</strong><small>'+esc(r.type)+' · '+esc(r.status)+'</small></div>'+moderation+'</article>';
  }).join('');
  $('[data-contrib-share]').forEach(b=>b.onclick=()=>share(rows.find(r=>r.id===b.dataset.contribShare)));
  $('[data-contrib-status]').forEach(b=>b.onclick=async()=>{const [id,status]=b.dataset.contribStatus.split('|');const row=rows.find(r=>r.id===id);if(!row)return;row.status=status;row.reviewedAt=new Date().toISOString();await dbPut('contributions',row);render();});
}
async function share(r){
  if(!r)return;const data=JSON.stringify({...r,photo:r.photo?'[foto adjunta en la copia local]':null},null,2);
  try{
    if(navigator.share)await navigator.share({title:'Aportación · Descubre A Lamosa',text:data});
    else{const blob=new Blob([data],{type:'application/json'});downloadBlob('aportacion-'+r.id+'.json',blob);}
  }catch{}
}
async function resize(file){
  const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(file);});
  const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=data;});const max=1000,s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.72);
}
