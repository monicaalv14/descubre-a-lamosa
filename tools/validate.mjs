import fs from 'node:fs/promises';
const must=['dist/index.html','dist/app.js','dist/vendor/maplibre-gl.mjs','dist/vendor/maplibre-gl-shared.mjs','dist/vendor/maplibre-gl-worker.mjs','dist/vendor/maplibre-gl.css','dist/data/generated/prg119.geojson','dist/data/generated/osm-network.geojson','dist/data/generated/pois-all.json'];
for(const f of must){await fs.access(f);}
const pois=JSON.parse(await fs.readFile('dist/data/generated/pois-all.json','utf8'));
if(pois.length<70)throw new Error('Inventario incompleto: '+pois.length);
const prg=JSON.parse(await fs.readFile('dist/data/generated/prg119.geojson','utf8'));
if(!prg.features?.[0]?.geometry?.coordinates?.length)throw new Error('PR-G 119 sin geometría');
const network=JSON.parse(await fs.readFile('dist/data/generated/osm-network.geojson','utf8'));
if((network.features?.length||0)<20)throw new Error('Red OSM insuficiente: '+(network.features?.length||0)+' tramos');
const via=JSON.parse(await fs.readFile('dist/data/generated/via-mariana.geojson','utf8'));
if((via.features?.length||0)<1)throw new Error('Vía Mariana sin tramo local');
const info=JSON.parse(await fs.readFile('dist/data/generated/build-info.json','utf8'));
if(info.osm_segments!==network.features.length)throw new Error('build-info no coincide con la red OSM');
console.log('VALID',JSON.stringify({pois:pois.length,prg_points:info.prg119_points,osm:info.osm_segments,osm_source:info.osm_source,via:via.features.length}));


const jsFiles=['dist/app.js','dist/js/ui.js','dist/js/routes.js','dist/js/field.js','dist/js/map.js','dist/js/audio.js','dist/js/contributions.js'];
for(const file of jsFiles){
  const src=await fs.readFile(file,'utf8');
  if(/^\s*\$\([^\n]+\)\.forEach/m.test(src))throw new Error('Selector único usado como colección en '+file);
}
