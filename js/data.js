import {S,getJSON} from './state.js';
export async function loadData(){
  const [pois,places,trails,projectRoutes,stories,network,build]=await Promise.all([
    getJSON('data/generated/pois-all.json'),
    getJSON('data/generated/places-all.json'),
    getJSON('data/trails.json'),
    getJSON('data/routes.json'),
    getJSON('data/stories.json'),
    getJSON('data/generated/osm-network.geojson').catch(()=>({type:'FeatureCollection',features:[]})),
    getJSON('data/generated/build-info.json').catch(()=>({}))
  ]);
  S.pois=pois;S.places=places;S.trails=trails;S.projectRoutes=projectRoutes;S.stories=stories;S.osmNetwork=network;S.buildInfo=build;
}
export function visiblePois(){
  return S.mode==='research'?S.pois:S.pois.filter(x=>x.visitor_visible);
}
