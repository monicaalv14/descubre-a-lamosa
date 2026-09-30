import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd(), DIST=path.join(ROOT,'dist');
const skip=new Set(['.git','.github','node_modules','dist','tools','tests','.DS_Store']);
async function copyTree(src,dst){
  await fs.mkdir(dst,{recursive:true});
  for(const e of await fs.readdir(src,{withFileTypes:true})){
    if(skip.has(e.name)||e.name==='package-lock.json'||e.name==='package.json')continue;
    const a=path.join(src,e.name),b=path.join(dst,e.name);
    if(e.isDirectory())await copyTree(a,b);else await fs.copyFile(a,b);
  }
}
async function fetchText(url,required=false){
  try{
    const r=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{'user-agent':'Descubre-A-Lamosa-build/1.0'}});
    if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);
    return await r.text();
  }catch(e){
    if(required)throw new Error(`No se pudo descargar ${url}: ${e.message}`);
    console.warn('WARN fetch',url,e.message);return null;
  }
}
function escXml(s=''){return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
function parseGpx(xml){
  const pts=[]; const re=/<trkpt\b[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/trkpt>/gi;
  for(const m of xml.matchAll(re)){
    const lat=Number(m[1]),lon=Number(m[2]); if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
    const em=m[3].match(/<ele>([^<]+)<\/ele>/i); const ele=em?Number(em[1]):null;
    pts.push(ele==null?[lon,lat]:[lon,lat,ele]);
  }
  if(pts.length<2)throw new Error('GPX sin suficientes puntos');
  return pts;
}
function parseOsmRelation(xml){
  const nodes=new Map();
  for(const m of xml.matchAll(/<node\b[^>]*id=["']([^"']+)["'][^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*\/>/gi)){
    nodes.set(m[1],[Number(m[3]),Number(m[2])]);
  }
  const features=[];
  for(const m of xml.matchAll(/<way\b[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/way>/gi)){
    const coords=[...m[2].matchAll(/<nd\b[^>]*ref=["']([^"']+)["'][^>]*\/>/gi)].map(x=>nodes.get(x[1])).filter(Boolean);
    if(coords.length>1)features.push({type:'Feature',properties:{osm_id:m[1]},geometry:{type:'LineString',coordinates:coords}});
  }
  return {type:'FeatureCollection',features};
}
function hav(a,b){const R=6371000,p1=a[1]*Math.PI/180,p2=b[1]*Math.PI/180,dp=(b[1]-a[1])*Math.PI/180,dl=(b[0]-a[0])*Math.PI/180;const q=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(q));}
function length(coords){let d=0;for(let i=1;i<coords.length;i++)d+=hav(coords[i-1],coords[i]);return d;}
function elevation(coords){let up=0,down=0,min=Infinity,max=-Infinity;for(let i=0;i<coords.length;i++){const z=coords[i][2];if(Number.isFinite(z)){min=Math.min(min,z);max=Math.max(max,z);if(i&&Number.isFinite(coords[i-1][2])){const d=z-coords[i-1][2];if(d>0)up+=d;else down-=d;}}}return {up,down,min:Number.isFinite(min)?min:null,max:Number.isFinite(max)?max:null};}
function lineFeature(coords,props){const e=elevation(coords);return {type:'Feature',properties:{...props,distance_m:length(coords),elevation_gain_m:e.up,elevation_loss_m:e.down,elevation_min_m:e.min,elevation_max_m:e.max,elevations:coords.map(c=>c[2]??null)},geometry:{type:'LineString',coordinates:coords.map(c=>c.slice(0,2))}};}

await fs.rm(DIST,{recursive:true,force:true}); await copyTree(ROOT,DIST);
await fs.mkdir(path.join(DIST,'vendor'),{recursive:true});
await fs.mkdir(path.join(DIST,'data/generated'),{recursive:true});
await fs.copyFile(path.join(ROOT,'node_modules/maplibre-gl/dist/maplibre-gl.mjs'),path.join(DIST,'vendor/maplibre-gl.mjs'));
await fs.copyFile(path.join(ROOT,'node_modules/maplibre-gl/dist/maplibre-gl.css'),path.join(DIST,'vendor/maplibre-gl.css'));
await fs.copyFile(path.join(ROOT,'node_modules/jszip/dist/jszip.min.js'),path.join(DIST,'vendor/jszip.min.js'));

const prgUrl='https://www.concellodecovelo.es/archivos_editor/file/nuevos-GPX/roteiro_xabrina_prg119-rmr-covelo-pontevedra.gpx';
const prgXml=await fetchText(prgUrl,true),prgCoords=parseGpx(prgXml);
const prg={type:'FeatureCollection',features:[lineFeature(prgCoords,{id:'TR-OF-001',name:'PR-G 119 · Ruta do Xabriña',source:'Concello de Covelo',source_url:prgUrl,official:true})]};
await fs.writeFile(path.join(DIST,'data/generated/prg119.geojson'),JSON.stringify(prg));

const viaXml=await fetchText('https://api.openstreetmap.org/api/0.6/relation/11075472/full');
const via=viaXml?parseOsmRelation(viaXml):{type:'FeatureCollection',features:[]};
await fs.writeFile(path.join(DIST,'data/generated/via-mariana.geojson'),JSON.stringify(via));

const bbox='42.175,-8.410,42.240,-8.300';
const query='[out:json][timeout:35];way["highway"~"^(track|path|footway|bridleway|unclassified|service)$"]('+bbox+');out geom;';
let osm=null;
for(const ep of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']){
  const txt=await fetchText(ep+'?data='+encodeURIComponent(query));
  if(txt){try{osm=JSON.parse(txt);break;}catch{}}
}
const net={type:'FeatureCollection',features:(osm?.elements||[]).filter(e=>e.type==='way'&&e.geometry?.length>1).map(e=>({type:'Feature',properties:{osm_id:e.id,...(e.tags||{})},geometry:{type:'LineString',coordinates:e.geometry.map(p=>[p.lon,p.lat])}}))};
await fs.writeFile(path.join(DIST,'data/generated/osm-network.geojson'),JSON.stringify(net));

const media=JSON.parse(await fs.readFile(path.join(ROOT,'data/media.json'),'utf8'));
let pois=[];for(let i=1;i<=6;i++)pois.push(...JSON.parse(await fs.readFile(path.join(ROOT,`data/pois-${i}.json`),'utf8')));
const mm=Object.fromEntries(media.filter(x=>x.id?.startsWith('POI-')).map(x=>[x.id,x]));
const catalog=pois.map(x=>({...x,...(mm[x.id]||{}),visitor_visible:!!x.coordinates&&!/pendiente|pista documental|mencionado/i.test(x.status||'')}));
await fs.writeFile(path.join(DIST,'data/generated/pois-all.json'),JSON.stringify(catalog));
const places=JSON.parse(await fs.readFile(path.join(ROOT,'data/places.json'),'utf8'));
const pm=Object.fromEntries(media.filter(x=>x.id?.startsWith('N-')).map(x=>[x.id,x]));
await fs.writeFile(path.join(DIST,'data/generated/places-all.json'),JSON.stringify(places.map(x=>({...x,...(pm[x.id]||{})}))));

const style=await fetchText('https://tiles.openfreemap.org/styles/bright');
if(style)await fs.writeFile(path.join(DIST,'data/generated/online-style.json'),style);
else await fs.copyFile(path.join(ROOT,'data/offline-style.json'),path.join(DIST,'data/generated/online-style.json'));

const parishUrl="https://ideg.xunta.gal/servizos/rest/services/LimitesAdministrativos/LimitesAdministrativos/MapServer/18/query?where="+encodeURIComponent("CONCELLO='Covelo' AND PARROQUIA LIKE '%Lamosa%'")+"&outFields=CONCELLO,PARROQUIA,CODIGOINE&returnGeometry=true&outSR=4326&f=geojson";
const parishTxt=await fetchText(parishUrl);if(parishTxt)await fs.writeFile(path.join(DIST,'data/generated/parish.geojson'),parishTxt);else await fs.writeFile(path.join(DIST,'data/generated/parish.geojson'),JSON.stringify({type:'FeatureCollection',features:[]}));
const hydroUrl="https://ideg.xunta.gal/servizos/rest/services/Hidrografia/Hidrografia/MapServer/0/query?where=1%3D1&geometry=-8.410%2C42.175%2C-8.300%2C42.240&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&outSR=4326&f=geojson";
const hydroTxt=await fetchText(hydroUrl);if(hydroTxt)await fs.writeFile(path.join(DIST,'data/generated/hydro.geojson'),hydroTxt);else await fs.writeFile(path.join(DIST,'data/generated/hydro.geojson'),JSON.stringify({type:'FeatureCollection',features:[]}));
const buildInfo={built_at:new Date().toISOString(),maplibre:'6.11.2',prg119_points:prgCoords.length,osm_segments:net.features.length,via_mariana_segments:via.features.length,parish_local:true,hydro_local:true};
await fs.writeFile(path.join(DIST,'data/generated/build-info.json'),JSON.stringify(buildInfo,null,2));

const files=[];
async function walk(dir,prefix=''){for(const e of await fs.readdir(dir,{withFileTypes:true})){const rel=prefix+e.name;if(e.isDirectory())await walk(path.join(dir,e.name),rel+'/');else if(!rel.startsWith('data/generated/offline-manifest'))files.push('./'+rel);}}
await walk(DIST);
await fs.writeFile(path.join(DIST,'data/generated/offline-manifest.json'),JSON.stringify({version:'0.11.0-beta.1',assets:files.filter(x=>!x.includes('/vendor/jszip'))},null,2));
console.log(JSON.stringify(buildInfo));
