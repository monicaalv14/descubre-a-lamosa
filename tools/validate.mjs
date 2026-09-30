import fs from 'node:fs/promises';
const must=['dist/index.html','dist/app.js','dist/vendor/maplibre-gl.mjs','dist/vendor/maplibre-gl.css','dist/data/generated/prg119.geojson','dist/data/generated/osm-network.geojson','dist/data/generated/pois-all.json'];
for(const f of must){await fs.access(f);}
const pois=JSON.parse(await fs.readFile('dist/data/generated/pois-all.json','utf8'));
if(pois.length<70)throw new Error('Inventario incompleto: '+pois.length);
const prg=JSON.parse(await fs.readFile('dist/data/generated/prg119.geojson','utf8'));
if(!prg.features?.[0]?.geometry?.coordinates?.length)throw new Error('PR-G 119 sin geometría');
const info=JSON.parse(await fs.readFile('dist/data/generated/build-info.json','utf8'));
console.log('VALID',JSON.stringify({pois:pois.length,prg_points:info.prg119_points,osm:info.osm_segments}));
