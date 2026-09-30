import fs from 'node:fs/promises';
const must=['dist/index.html','dist/app.js','dist/vendor/maplibre-gl.mjs','dist/vendor/maplibre-gl-shared.mjs','dist/vendor/maplibre-gl-worker.mjs','dist/vendor/maplibre-gl.css','dist/data/generated/prg119.geojson','dist/data/generated/osm-network.geojson','dist/data/generated/pois-all.json'];
for(const f of must){await fs.access(f);}
const pois=JSON.parse(await fs.readFile('dist/data/generated/pois-all.json','utf8'));
if(pois.length<70)throw new Error('Inventario incompleto: '+pois.length);
const prg=JSON.parse(await fs.readFile('dist/data/generated/prg119.geojson','utf8'));
if(!prg.features?.[0]?.geometry?.coordinates?.length)throw new Error('PR-G 119 sin geometría');
const info=JSON.parse(await fs.readFile('dist/data/generated/build-info.json','utf8'));
console.log('VALID',JSON.stringify({pois:pois.length,prg_points:info.prg119_points,osm:info.osm_segments}));


const jsFiles=['dist/app.js','dist/js/ui.js','dist/js/routes.js','dist/js/field.js','dist/js/map.js','dist/js/audio.js','dist/js/contributions.js'];
for(const file of jsFiles){
  const src=await fs.readFile(file,'utf8');
  if(/^\s*\$\([^\n]+\)\.forEach/m.test(src))throw new Error('Selector único usado como colección en '+file);
}
