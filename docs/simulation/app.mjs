import { CLASSES, BUDGETS, buildGraph, distances, intervalsAt, clipFeature, statistics, pointAt } from './routing.mjs';
import { loadOsmDataset } from './osm-data.mjs';
import { exportMap } from './cartographic-export.mjs';
import { calculateAllStops } from './all-stops.mjs';

const $ = id => document.getElementById(id);
const colors = {Conforme:'#147d68','Non conforme':'#c96025',Inconnu:'#8060a3'};
const timeColors = {300:'#007f6f',600:'#288bc2',900:'#7451ac'};
const number = (v,d=0) => Number(v).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d});
const text = (tag,value,className) => { const el=document.createElement(tag); el.textContent=value; if(className)el.className=className; return el; };
const normalize = s => String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
let network='pmr', budget=900, selectedId=1, loaded=false, result=null, dep=null, currentGraph=null;
const datasets={}, graphs={}, allowed=new Set(CLASSES);
let departureFeatures=[], baseSource, stopSource, resultSource, connectionSource, selectedSource, map, geoformat;
const styleCache=new Map();
const busIcon=new ol.style.Icon({src:'./bus-stop.svg',anchor:[0.5,0.94],anchorXUnits:'fraction',anchorYUnits:'fraction',scale:0.48,crossOrigin:'anonymous'});
const selectedBusIcon=new ol.style.Icon({src:'./bus-stop.svg',anchor:[0.5,0.94],anchorXUnits:'fraction',anchorYUnits:'fraction',scale:0.68,crossOrigin:'anonymous'});
function lineStyle(color,width,dash) {
  const key=[color,width,dash].join(':');
  if(!styleCache.has(key))styleCache.set(key,new ol.style.Style({stroke:new ol.style.Stroke({color,width,lineDash:dash})}));
  return styleCache.get(key);
}
function report(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function hideLoadingAlert(){const el=$('loadingAlert');if(el)el.hidden=true;}
function showError(message){hideLoadingAlert();$('mapError').hidden=false;$('mapError').textContent=message;report(message,true);}
function baseStyle(f){
  if(f.get('est_escalier'))return $('showStairs').checked ? lineStyle('#ae3340',3,[4,4]) : null;
  return $('showContext').checked ? lineStyle('#9aaea7aa',1.4) : null;
}
function resultStyle(f){
  if($('colorMode').value==='class'&&!allowed.has(f.get('classe_pmr')))return null;
  return lineStyle($('colorMode').value==='time'?timeColors[f.get('duree_s')]:colors[f.get('classe_pmr')],4.5);
}
function stopStyle(f){
  if(!$('showStops').checked)return null;
  const chosen=f.get('acces_id')===selectedId;
  return new ol.style.Style({zIndex:chosen?10:1,image:chosen?selectedBusIcon:busIcon,text:chosen?new ol.style.Text({text:f.get('nom'),font:'600 12px Arial',offsetY:-21,fill:new ol.style.Fill({color:'#163b30'}),stroke:new ol.style.Stroke({color:'#fff',width:4})}):undefined});
}
function initializeMap(){
  geoformat=new ol.format.GeoJSON({dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'});
  baseSource=new ol.source.Vector();stopSource=new ol.source.Vector();resultSource=new ol.source.Vector();connectionSource=new ol.source.Vector();selectedSource=new ol.source.Vector();
  const basemap=new ol.source.OSM();
  let tileFailures=0;
  basemap.on('tileloaderror',()=>{if(++tileFailures===6)report('Fond cartographique indisponible. Les données et le calcul restent utilisables.');});
  const baseLayer=new ol.layer.Vector({source:baseSource,style:baseStyle});
  const resultLayer=new ol.layer.Vector({source:resultSource,style:resultStyle,renderOrder:(a,b)=>b.get('duree_s')-a.get('duree_s')});
  const connectionLayer=new ol.layer.Vector({source:connectionSource,style:lineStyle('#53625b',2,[5,5])});
  const selectedLayer=new ol.layer.Vector({source:selectedSource,style:[lineStyle('#fff',10),lineStyle('#163b30',7)]});
  const stopsLayer=new ol.layer.Vector({source:stopSource,style:stopStyle});
  map=new ol.Map({target:'map',layers:[new ol.layer.Tile({source:basemap}),baseLayer,resultLayer,connectionLayer,selectedLayer,stopsLayer],view:new ol.View({center:ol.proj.fromLonLat([-1.515,43.495]),zoom:13}),controls:ol.control.defaults.defaults({rotate:false}).extend([new ol.control.ScaleLine({units:'metric'})])});
  map.on('singleclick',event=>{
    let hit=null;
    map.forEachFeatureAtPixel(event.pixel,(f,layer)=>{if(layer===stopsLayer||layer===resultLayer||layer===baseLayer){hit={f,layer};return true;}},{hitTolerance:7});
    if(!hit){closeInspection();return;}
    if(hit.layer===stopsLayer){selectedId=hit.f.get('acces_id');$('search').value='';populateDepartures();calculate(true);return;}
    inspect(hit.f,hit.layer===resultLayer);
  });
  map.on('pointermove',e=>{if(!e.dragging)map.getTargetElement().style.cursor=map.hasFeatureAtPixel(e.pixel,{hitTolerance:5})?'pointer':'';});
  $('showStairs').addEventListener('change',()=>baseLayer.changed());
  $('showContext').addEventListener('change',()=>baseLayer.changed());
  $('showStops').addEventListener('change',()=>stopsLayer.changed());
  document.querySelectorAll('[data-class]').forEach(el=>el.addEventListener('change',()=>{el.checked?allowed.add(el.dataset.class):allowed.delete(el.dataset.class);resultLayer.changed();}));
  $('fit').addEventListener('click',fitResult);
  $('allExtent').addEventListener('click',()=>fitSource(baseSource));
  $('closeInspection').addEventListener('click',closeInspection);
  $('colorMode').addEventListener('change',()=>{renderResult();const isTime=$('colorMode').value==='time';$('classLegend').hidden=isTime;$('timeLegend').hidden=!isTime;$('legendMode').textContent=isTime?'Temps cumulés':'Classes PMR';});
}
function readFeatures(fc){return geoformat.readFeatures(fc,{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'});}
function replaceSource(source,features){source.clear();source.addFeatures(features);}
function fitSource(source){
  if(!source.getFeatures().length)return;
  const compact=window.innerWidth<1000;
  map.getView().fit(source.getExtent(),{padding:[compact?185:170,55,compact?150:95,55],maxZoom:17,duration:450});
}
function fitResult(){
  if(resultSource.getFeatures().length)fitSource(resultSource);
  else if(dep)map.getView().animate({center:ol.proj.fromLonLat(dep.geometry.coordinates),zoom:16,duration:350});
}
function populateDepartures(){
  const q=normalize($('search').value);
  const candidates=departureFeatures.filter(f=>f.properties.reseau===network).sort((a,b)=>a.properties.nom.localeCompare(b.properties.nom,'fr')||a.properties.acces_id-b.properties.acces_id);
  const filtered=candidates.filter(f=>normalize([f.properties.nom,f.properties.acces_id,f.properties.stop_id].join(' ')).includes(q));
  const select=$('departure');select.replaceChildren();
  if(!q)select.append(new Option('Tous les arrêts prioritaires · couverture globale','all'));
  for(const f of filtered){const p=f.properties;select.append(new Option(p.nom+' · accès '+p.acces_id+(p.stop_id?' · '+p.stop_id:'')+(!p.calculable?' · non raccordé':''),p.acces_id));}
  if(!filtered.length){select.append(new Option('Aucun accès correspondant',''));select.disabled=true;$('calculate').disabled=true;selectedId=null;}
  else{select.disabled=false;$('calculate').disabled=false;if(selectedId!=='all'&&!filtered.some(f=>f.properties.acces_id===selectedId))selectedId=filtered[0].properties.acces_id;select.value=String(selectedId);}
  $('searchInfo').textContent=filtered.length+' accès affichés sur '+candidates.length+' · sélection possible sur la carte';
}
function setNetwork(){
  currentGraph=graphs[network];
  replaceSource(baseSource,readFeatures(datasets[network]));
  replaceSource(stopSource,readFeatures({type:'FeatureCollection',features:departureFeatures.filter(f=>f.properties.reseau===network)}));
  $('networkInfo').textContent=number(currentGraph.edges.size)+' tronçons · '+(network==='pmr'?'cheminements PMR relevés':network==='osm'?'OSM piéton · accessibilité indicative':'BD TOPO seule')+' · calcul indépendant';
  populateDepartures();calculate(true);
}
function clearResult(){
  result=null;resultSource.clear();connectionSource.clear();closeInspection();$('connection').hidden=true;
  $('totalLength').textContent='—';$('edgeCount').textContent='—';$('stats').replaceChildren();$('distribution').replaceChildren();
  $('geojson').disabled=true;$('csv').disabled=true;$('mapPng').disabled=true;$('mapPdf').disabled=true;
}
function calculate(fit=false){
  if(!loaded)return;
  selectedId=$('departure').value==='all'?'all':(Number($('departure').value)||null);
  clearResult();
  dep=departureFeatures.find(f=>f.properties.reseau===network&&f.properties.acces_id===selectedId);
  $('resultBudget').textContent=budget/60+' min';stopSource.changed();
  if(selectedId==='all'){
    try{
      const started=performance.now();
      const all=calculateAllStops(currentGraph,departureFeatures);
      result={byBudget:all.byBudget,stats:statistics(all.byBudget[budget]),allStops:true};
      $('resultName').textContent='Tous les accès prioritaires · '+all.numberOfStops+' raccordables · '+network.toUpperCase();
      renderResult();renderStats();
      $('geojson').disabled=false;$('csv').disabled=false;$('mapPng').disabled=false;$('mapPdf').disabled=false;
      report('Couverture globale calculée · '+number(performance.now()-started)+' ms · tronçons communs comptés une seule fois.');
      history.replaceState(null,'','#'+new URLSearchParams({reseau:network,acces:'all',duree:budget}));
      if(fit)fitResult();
    }catch(error){clearResult();report(error.message,true);}
    return;
  }
  if(!dep){$('resultName').textContent='Aucun accès sélectionné';report('Recherchez puis choisissez un accès.');return;}
  const d=dep.properties;
  const selectionParams=new URLSearchParams({reseau:network,acces:selectedId,duree:budget});history.replaceState(null,'','#'+selectionParams);
  $('resultName').textContent=d.nom+' · accès '+d.acces_id+' · '+(network==='pmr'?'PMR':network==='osm'?'OSM':'BD TOPO');
  if(!d.calculable){report(d.statut_raccord,true);$('connection').textContent=d.statut_raccord+'. Aucun cheminement calculé.';$('connection').hidden=false;if(fit)fitResult();return;}
  try{
    const start=performance.now(), dist=distances(currentGraph,dep);
    const byBudget=Object.fromEntries(BUDGETS.map(t=>[t,intervalsAt(currentGraph,dep,dist,t)]));
    result={byBudget,stats:statistics(byBudget[budget])};
    renderResult();renderStats();
    const origin=currentGraph.edges.get(d.troncon_quai_id);
    const connector={type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[dep.geometry.coordinates,pointAt(origin,d.fraction_quai)]}};
    connectionSource.addFeatures(readFeatures(connector));
    $('connection').textContent='Raccord : '+number(d.distance_raccord_m,1)+' m · '+number(d.temps_raccord_s,1)+' s inclus. '+d.statut_raccord.replace(/^Calculable : /,'')+'.';
    $('connection').hidden=false;
    $('geojson').disabled=false;$('csv').disabled=false;$('mapPng').disabled=false;$('mapPdf').disabled=false;
    report('Calcul terminé · '+number(performance.now()-start)+' ms · escaliers exclus'+(result.stats.total===0?' · aucun tronçon atteint.':'.'));
    const params=new URLSearchParams({reseau:network,acces:selectedId,duree:budget});history.replaceState(null,'','#'+params);
    if(fit)fitResult();
  }catch(error){clearResult();report(error.message,true);}
}
function renderResult(){
  if(!result)return;
  const times=$('colorMode').value==='time'?BUDGETS.filter(t=>t<=budget).reverse():[budget];
  const features=times.flatMap(t=>result.byBudget[t].map(p=>clipFeature(p,t,selectedId)));
  replaceSource(resultSource,readFeatures({type:'FeatureCollection',features}));
}
function renderStats(){
  const s=result.stats;
  $('totalLength').textContent=number(s.total/1000,2);$('edgeCount').textContent=number(s.count);
  $('stats').replaceChildren();$('distribution').replaceChildren();
  for(const c of CLASSES){
    const v=s.classes[c], row=text('div','','stat-row'), label=text('span','','stat-label'), bullet=text('i','','bullet');bullet.style.background=colors[c];label.append(bullet,text('span',c));
    const values=text('span',number(v.length)+' m ','stat-values');values.append(text('b',number(v.percent,1)+' %'));row.append(label,values);$('stats').append(row);
    const bar=document.createElement('span');bar.style.width=v.percent+'%';bar.style.background=colors[c];bar.title=c+' : '+number(v.percent,1)+' %';$('distribution').append(bar);
  }
}
function closeInspection(){$('inspection').hidden=true;selectedSource.clear();}
function inspect(feature,reached){
  const p=feature.getProperties(), body=$('inspectionContent');body.replaceChildren();
  const badge=text('span',p.est_escalier?'Bloquant · escalier exclu':p.classe_pmr,'badge '+(p.est_escalier?'stairs':p.classe_pmr==='Non conforme'?'nonconform':p.classe_pmr==='Inconnu'?'unknown':''));
  body.append(badge,text('h2','Tronçon '+p.id));
  body.append(text('p',(p.typtronco||'Type inconnu')+' · '+(network==='pmr'?'Réseau PMR':network==='osm'?'OSM':'BD TOPO')));
  body.append(text('p',p.est_escalier?'Parcours interdit : ce tronçon n’entre jamais dans le calcul.':reached?'Portion atteinte en '+p.duree_s/60+' minutes dans la simulation.':'Réseau hors résultat : tronçon non atteint ou portion située au-delà de la durée choisie.'));
  const grid=text('div','','detail-grid');
  const metric=(name,value)=>{const box=text('div','');box.append(text('span',name),text('b',value));grid.append(box);};
  metric('Vitesse simulée',p.est_escalier?'Exclu':p.vitesse_kmh+' km/h');
  metric(reached?'Longueur atteinte':'Longueur totale',number(reached?p.longueur_atteinte_m:p.longueur_m,1)+' m');
  const val=(v,unit,digits=1)=>v===null||v===undefined?'Inconnue':number(v,digits)+' '+unit;
  metric('Pente',val(p.pente_pct,'%'));metric('Dévers',val(p.devers_pct,'%'));
  metric('Largeur utile',p.largeur_superieure_180?'Code largeur étendue':val(p.largeur_effective_m,'m',2));metric('Ressaut',val(p.ressaut_m==null?null:p.ressaut_m*100,'cm'));
  body.append(grid,text('h3','Motifs et observations'));
  const list=document.createElement('ul');for(const reason of String(p.motifs||'Aucun motif renseigné').split(/\s*;\s*/).filter(Boolean))list.append(text('li',reason));body.append(list);
  if(p.etat_revetement)body.append(text('p','Revêtement : '+p.etat_revetement));
  if(p.source_mesures)body.append(text('p','Mesures : '+p.source_mesures));
  if(p.id_netex)body.append(text('p','Référence : '+p.id_netex));
  replaceSource(selectedSource,[new ol.Feature({geometry:feature.getGeometry().clone()})]);$('inspection').hidden=false;
}
async function downloadCartography(kind){
  if(!result)return;
  const btn=$(kind==='pdf'?'mapPdf':'mapPng');
  try{
    btn.disabled=true;
    report('Préparation de la carte '+kind.toUpperCase()+'…');
    await exportMap({map,format:kind,network,budget,selectedId,accessName:selectedId==='all'?'Tous les arrêts prioritaires':dep.properties.nom,stats:result.stats,
      colorMode:$('colorMode').value,allowed:new Set(allowed),showStairs:$('showStairs').checked,
      showContext:$('showContext').checked,showStops:$('showStops').checked,
      sourceDate:datasets[network].metadata?.source_calculated_at});
    report('Carte '+kind.toUpperCase()+' téléchargée · A4 paysage, titre, échelle, orientation, légende et sources.');
  }catch(error){report('Export cartographique : '+error.message,true);}
  finally{btn.disabled=false;}
}
function download(kind){
  if(!result)return;
  const features=result.byBudget[budget].map(p=>clipFeature(p,budget,selectedId));
  let content,type,extension;
  if(kind==='geojson'){content=JSON.stringify({type:'FeatureCollection',name:'Simulation '+network+' '+budget+' s',metadata:{reseau:network,acces_id:selectedId,duree_s:budget,mode:'Simulation exploratoire, escaliers exclus',date_export:datasets[network].metadata.exported_at,date_calcul_source:datasets[network].metadata.source_calculated_at},features});type='application/geo+json';extension='geojson';}
  else{
    const fields=['acces_id','reseau','duree_s','troncon_id','classe_pmr','vitesse_kmh','longueur_atteinte_m','fraction_debut','fraction_fin','motifs','informations_manquantes'];
    const escape=value=>'"'+String(typeof value==='number'?String(value).replace('.',','):value??'').replaceAll('"','""')+'"';
    content='\uFEFF'+[fields.map(escape).join(';'),...features.map(f=>fields.map(k=>escape(f.properties[k])).join(';'))].join('\r\n');type='text/csv;charset=utf-8';extension='csv';
  }
  const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download='simulation_'+network+'_acces_'+selectedId+'_'+budget+'s.'+extension;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function fetchJSON(url){const response=await fetch(url);if(!response.ok)throw new Error('Chargement impossible : '+url+' (HTTP '+response.status+').');return response.json();}
async function start(){
  try{
    if(!window.ol)throw new Error('Le moteur cartographique OpenLayers n’a pas pu être chargé. Rechargez la page.');
    initializeMap();
    const data=await Promise.all(['pmr','bdtopo','departs'].map(name=>fetchJSON('./data/'+name+'.geojson')));
    datasets.pmr=data[0];datasets.bdtopo=data[1];departureFeatures=data[2].features;
    graphs.pmr=buildGraph(data[0],'pmr');graphs.bdtopo=buildGraph(data[1],'bdtopo');
    const osm=await loadOsmDataset(fetchJSON,departureFeatures);
    datasets.osm=osm.dataset;graphs.osm=buildGraph(osm.dataset,'osm');departureFeatures.push(...osm.departures);
    const params=new URLSearchParams(location.hash.slice(1));if(['pmr','bdtopo','osm'].includes(params.get('reseau')))network=params.get('reseau');if(BUDGETS.includes(Number(params.get('duree'))))budget=Number(params.get('duree'));if(params.get('acces')==='all')selectedId='all';else if(Number(params.get('acces'))>0)selectedId=Number(params.get('acces'));
    document.querySelector('input[name="network"][value="'+network+'"]').checked=true;document.querySelector('input[name="budget"][value="'+budget+'"]').checked=true;
    $('dataDate').textContent='Export du '+new Date(datasets.pmr.metadata.exported_at).toLocaleDateString('fr-FR')+'. Données de calcul du '+new Date(datasets.pmr.metadata.source_calculated_at).toLocaleDateString('fr-FR')+'. Copie statique : les mises à jour de la base ne sont pas automatiques.';
    $('dataCount').textContent=number(graphs.pmr.edges.size+graphs.bdtopo.edges.size+graphs.osm.edges.size)+' segments · OpenLayers';
    loaded=true;setNetwork();
    // Retirer l'avertissement après que les couches ont été affichées.
    // Le délai de sécurité évite de bloquer le visiteur si des tuiles OSM tardent.
    if(map){
      let completed=false;
      const done=()=>{if(completed)return;completed=true;hideLoadingAlert();map.un('rendercomplete',done);};
      map.once('rendercomplete',done);
      map.render();
      setTimeout(done,4500);
    }else hideLoadingAlert();
    document.querySelectorAll('input[name="network"]').forEach(el=>el.addEventListener('change',()=>{network=el.value;setNetwork();}));
    document.querySelectorAll('input[name="budget"]').forEach(el=>el.addEventListener('change',()=>{budget=Number(el.value);calculate(false);}));
    $('departure').addEventListener('change',()=>calculate(true));
    let searchTimer;$('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{populateDepartures();calculate(false);},140);});
    $('calculate').addEventListener('click',()=>calculate(true));
    $('geojson').addEventListener('click',()=>download('geojson'));$('csv').addEventListener('click',()=>download('csv'));
    $('mapPng').addEventListener('click',()=>downloadCartography('png'));
    $('mapPdf').addEventListener('click',()=>downloadCartography('pdf'));
  }catch(error){showError(error.message);}
}
start();
