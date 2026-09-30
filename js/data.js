import {S,getJSON,recordError} from './state.js';

export async function loadData(){
  const [pois,places,trails,projectRoutes,stories,build]=await Promise.all([
    getJSON('data/generated/pois-all.json'),
    getJSON('data/generated/places-all.json'),
    getJSON('data/trails.json'),
    getJSON('data/routes.json'),
    getJSON('data/stories.json'),
    getJSON('data/generated/build-info.json').catch(()=>({}))
  ]);
  S.pois=pois;S.places=places;S.trails=trails;S.projectRoutes=projectRoutes;S.stories=stories;S.buildInfo=build;
}
export async function loadOsmNetwork(){
  if(S.osmNetwork)return S.osmNetwork;
  if(S.osmNetworkLoading)return S.osmNetworkLoading;
  S.osmNetworkLoading=getJSON('data/generated/osm-network.geojson')
    .then(net=>{S.osmNetwork=net;return net;})
    .catch(e=>{recordError(e,'osm-network-load');S.osmNetwork={type:'FeatureCollection',features:[]};return S.osmNetwork;})
    .finally(()=>{S.osmNetworkLoading=null;});
  return S.osmNetworkLoading;
}
export function visiblePois(){
  return S.mode==='research'?S.pois:S.pois.filter(x=>x.visitor_visible);
}
