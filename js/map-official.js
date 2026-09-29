import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';
import {S,$,toast} from './state.js';

export async function loadOfficialLayers(){
  const layers=[
    {id:'parish',url:"https://ideg.xunta.gal/servizos/rest/services/LimitesAdministrativos/LimitesAdministrativos/MapServer/18/query?where="+encodeURIComponent("CONCELLO='Covelo' AND PARROQUIA LIKE '%Lamosa%'")+"&outFields=CONCELLO,PARROQUIA,CODIGOINE&returnGeometry=true&outSR=4326&f=geojson",add:d=>{S.map.addSource('parish-official',{type:'geojson',data:d});S.map.addLayer({id:'parish-fill',type:'fill',source:'parish-official',paint:{'fill-color':'#315c48','fill-opacity':.07}});S.map.addLayer({id:'parish-line',type:'line',source:'parish-official',paint:{'line-color':'#244b3a','line-width':3,'line-dasharray':[2,2]}});}},
    {id:'prg',url:"https://ideg.xunta.gal/servizos/rest/services/CatalogoPaisaxesGalicia/CPG_ValorPaisaxistico_Panoramicos_2/MapServer/6/query?where="+encodeURIComponent("DENOMINACI='PR-G 119 Ruta do Xabriña'")+"&outFields=CODIGO,DENOMINACI&returnGeometry=true&outSR=4326&f=geojson",add:d=>{S.prgData=d;S.map.addSource('prg119-official',{type:'geojson',data:d});S.map.addLayer({id:'prg119-line',type:'line',source:'prg119-official',paint:{'line-color':'#168a50','line-width':4,'line-opacity':.9}});}},
    {id:'hydro',url:"https://ideg.xunta.gal/servizos/rest/services/Hidrografia/Hidrografia/MapServer/0/query?where=1%3D1&geometry=-8.40%2C42.18%2C-8.31%2C42.25&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&outSR=4326&f=geojson",add:d=>{S.map.addSource('hydro-official',{type:'geojson',data:d});S.map.addLayer({id:'hydro-line',type:'line',source:'hydro-official',paint:{'line-color':'#327dad','line-width':2,'line-opacity':.8}});}}
  ];
  let ok=0;
  for(const l of layers){
    try{const r=await fetch(l.url);if(!r.ok)throw new Error(r.status);const d=await r.json();if(d.features?.length){l.add(d);ok++;}}
    catch(e){console.warn('Capa',l.id,e);}
  }
  $('#officialLayers').textContent=`Capas Xunta: ${ok}/3`;
}

export function showOfficialRoute(){
  if(!S.prgData){toast('El trazado oficial todavía no está cargado');return;}
  const c=[];collect(S.prgData,c);if(!c.length)return;
  const b=new maplibregl.LngLatBounds();c.forEach(x=>b.extend(x));S.map.fitBounds(b,{padding:55});
}
function collect(o,out){
  if(!o)return;
  if(Array.isArray(o)&&typeof o[0]==='number'){out.push(o);return;}
  if(Array.isArray(o)){o.forEach(x=>collect(x,out));return;}
  if(o.type==='FeatureCollection')o.features.forEach(x=>collect(x.geometry?.coordinates,out));
  else if(o.type==='Feature')collect(o.geometry?.coordinates,out);
  else if(o.coordinates)collect(o.coordinates,out);
}
