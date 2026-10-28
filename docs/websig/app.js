"use strict";
const $=id=>document.getElementById(id);
const fmt=n=>Number(n||0).toLocaleString('fr-FR',{maximumFractionDigits:1});
const fc={}; const sources={}; const layers={};
const specs=['quartiers','carreaux','arrets','travaux'];
const color={priorite:'#b43a45',normal:'#cbdce0',densite:['#eff4f3','#baded8','#72b7aa','#2c837c','#10514e'],desserte:['#a33d45','#f0a85e','#f2d580','#a6d4a0','#1a8566']};
const hints={priorite:'Carreaux à densité élevée et faible desserte, selon le scénario BDTOPO_PRUDENT / PRIORITAIRES.',densite:'Densité en habitants par km² des carreaux de 200 m.',desserte:'Part du réseau atteignable en 15 minutes dans chaque carreau.',quartiers:'Part de la population desservie en 15 minutes par quartier.',transport:'Nombre de passages par jour type aux arrêts.',travaux:'Emprises intersectant la période sélectionnée (calendrier prévisionnel).'};
let map,geo,theme='priorite',selection=null;
const palettes={
 quartiers:['#ca4149','#e99357','#eed38d','#98c9a8','#147f67'],
 carreaux:['#cbdde1','#b23a4b']
};
function cssFill(hex,alpha=.54){return new ol.style.Fill({color:hex+Math.round(alpha*255).toString(16).padStart(2,'0')});}
function polygonStyle(fill,stroke='#5e7d80'){return new ol.style.Style({fill:cssFill(fill),stroke:new ol.style.Stroke({color:stroke,width:.65})});}
const styles={};
function style(fill){return styles[fill]??(styles[fill]=polygonStyle(fill));}
function group(value,thresholds){let i=0;while(i<thresholds.length&&Number(value)>=thresholds[i])i++;return i;}
function isWorkActive(p){const a=$('from').value,b=$('to').value;const s=p.date_debut||'',e=p.date_fin||'';return (!a||!e||e>=a)&&(!b||!s||s<=b);}
function layerStyle(key,f){
 const p=f.getProperties();
 if(key==='carreaux'){
  if(theme==='priorite')return style(p.prioritaire?color.priorite:color.normal);
  if(theme==='densite')return style(color.densite[group(p.densite_hab_km2,[500,1500,3000,6000])]);
  return style(color.desserte[group(p.part_atteinte_pct,[1,25,50,75])]);
 }
 if(key==='quartiers')return style(color.desserte[group(p.part_pop_desservie_pct,[1,25,50,75])]);
 if(key==='travaux')return isWorkActive(p)?new ol.style.Style({fill:cssFill('#d98e18',.4),stroke:new ol.style.Stroke({color:'#915000',width:2})}):null;
 if(key==='arrets'){const n=Number(p.nb_passages||0);return new ol.style.Style({image:new ol.style.Circle({radius:Math.min(11,Math.max(4,3+Math.sqrt(n)/2)),fill:new ol.style.Fill({color:p.wheelchair_boarding===1?'#067b90':'#435fb0'}),stroke:new ol.style.Stroke({color:'#fff',width:1.5})})});}
 return null;
}
function setTheme(){
 theme=$('theme').value; $('themeHint').textContent=hints[theme];$('works').checked=theme==='travaux'||$('works').checked;
 for(const key of specs){
   let visible=false;
   if(key==='carreaux')visible=['priorite','densite','desserte'].includes(theme);
   if(key==='quartiers')visible=theme==='quartiers'||$('areas').checked;
   if(key==='arrets')visible=theme==='transport'||$('stops').checked;
   if(key==='travaux')visible=theme==='travaux'||$('works').checked;
   layers[key].setVisible(visible);
   layers[key].setZIndex(key==='carreaux'?1:key==='quartiers'?2:key==='travaux'?3:4);
   layers[key].changed();
 }
 drawLegend(); updateStats(); closeDetail();
 const explanations={priorite:'Les secteurs rouges correspondent aux carreaux classés prioritaires par le calcul croisant forte densité de population et faible desserte.',densite:'La couleur des carreaux représente la densité de population. Une forte densité ne signifie pas automatiquement une mauvaise accessibilité.',desserte:'La couleur représente la proportion de linéaire atteignable en 15 minutes, et non la proportion de surface accessible.',quartiers:'Les quartiers sont comparés à partir de la part estimée de population desservie dans les 15 minutes.',transport:'La taille des cercles augmente avec le nombre de passages du jour de référence. Les données ne constituent pas du temps réel.',travaux:'Seules les emprises dont les dates croisent la période choisie sont affichées. La carte ne préjuge pas des impacts réels sur le cheminement.'};
 $('summary').textContent=explanations[theme];
}
function drawLegend(){const el=$('legend');el.replaceChildren();const title=document.createElement('strong');title.textContent='Légende';el.append(title);
 const entries=theme==='priorite'?[['#b43a45','Prioritaire'],['#cbdce0','Autres carreaux']]:theme==='densite'?color.densite.map((c,i)=>[c,['Moins de 500','500 à 1 499','1 500 à 2 999','3 000 à 5 999','6 000 et plus'][i]+' hab/km²']):theme==='desserte'||theme==='quartiers'?color.desserte.map((c,i)=>[c,['0 %','1–24 %','25–49 %','50–74 %','75–100 %'][i]]):theme==='transport'?[['#067b90','Accessible déclaré'],['#435fb0','Autre ou inconnu']]:[['#d98e18','Emprise de chantier']];
 for(const [c,label] of entries){const div=document.createElement('div');div.className='key';const s=document.createElement('span');s.className='swatch';s.style.background=c;const t=document.createElement('span');t.textContent=label;div.append(s,t);el.append(div);}
}
function updateStats(){
 $('nCar').textContent=fmt(fc.carreaux.features.length);
 $('nPriority').textContent=fmt(fc.carreaux.features.filter(f=>f.properties.prioritaire).length);
 $('nStops').textContent=fmt(fc.arrets.features.length);
 $('nWorks').textContent=fmt(fc.travaux.features.filter(f=>isWorkActive(f.properties)).length);
 if(layers.travaux)layers.travaux.changed();
}
function detail(f,key){const p=f.getProperties();delete p.geometry;
 const names={quartiers:'Quartier',carreaux:'Carreau INSEE',arrets:'Arrêt de bus',travaux:'Travaux'};
 $('detail').replaceChildren();const h=document.createElement('h2');h.textContent=names[key]+' · '+(p.libelle||p.stop_name||p.nom_chantier||p.idcar_200m||'');$('detail').append(h);
 const dl=document.createElement('dl');for(const [k,v] of Object.entries(p)){if(v==null||v==='')continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k.replaceAll('_',' ');dd.textContent=typeof v==='number'?fmt(v):String(v);dl.append(dt,dd);}$('detail').append(dl);$('info').hidden=false;$('info').focus();
}
function closeDetail(){$('info').hidden=true;}
function zoomTo(f){let g=f.getGeometry();map.getView().fit(g.getExtent(),{padding:[60,60,60,60],maxZoom:16,duration:450});}
function find(){const q=$('search').value.trim().toLocaleLowerCase('fr');if(!q){$('status').textContent='Saisissez un nom pour rechercher.';return;}for(const key of ['quartiers','arrets','travaux']){const f=sources[key].getFeatures().find(f=>Object.values(f.getProperties()).some(v=>typeof v==='string'&&v.toLocaleLowerCase('fr').includes(q)));if(f){zoomTo(f);detail(f,key);$('status').textContent='Résultat trouvé dans '+key;return;}}$('status').textContent='Aucun résultat pour cette recherche.';}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function exportLayer(csv=false){const key=theme==='quartiers'?'quartiers':theme==='transport'?'arrets':theme==='travaux'?'travaux':'carreaux';
 const features=fc[key].features.filter(f=>key!=='travaux'||isWorkActive(f.properties));const name='anglet_'+key+'_2026';
 if(!csv){download(JSON.stringify({type:'FeatureCollection',features}),name+'.geojson','application/geo+json');return;}
 const rows=features.map(f=>f.properties),keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
 const escape=v=>'"'+String(v??'').replaceAll('"','""')+'"';
 const content='\uFEFF'+[keys.map(escape).join(';'),...rows.map(r=>keys.map(k=>escape(r[k])).join(';'))].join('\r\n');
 download(content,name+'.csv','text/csv;charset=utf-8');
}
async function load(){
 const results=await Promise.allSettled(specs.map(async name=>{const r=await fetch('./data/'+name+'.geojson');if(!r.ok)throw Error(name+': HTTP '+r.status);const data=await r.json();if(data.type!=='FeatureCollection')throw Error(name+': format inattendu');fc[name]=data;return name;}));
 const failures=results.map((r,i)=>r.status==='rejected'?specs[i]+' : '+r.reason.message:null).filter(Boolean);
 if(failures.length){$('status').textContent='Chargement incomplet : '+failures.join(' | ');return;}
 for(const name of specs){const source=new ol.source.Vector({features:geo.readFeatures(fc[name],{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'})});sources[name]=source;const layer=new ol.layer.Vector({source,style:f=>layerStyle(name,f),declutter:name==='arrets'});layers[name]=layer;map.addLayer(layer);}
 map.on('singleclick',ev=>{let found;map.forEachFeatureAtPixel(ev.pixel,(f,l)=>{const key=Object.keys(layers).find(k=>layers[k]===l);if(key&&!(key==='travaux'&&!isWorkActive(f.getProperties()))){found={f,key};return true;}},{hitTolerance:7});if(found)detail(found.f,found.key);else closeDetail();});
 setTheme();$('status').textContent='Données chargées : 9 quartiers, '+fc.carreaux.features.length+' carreaux, '+fc.arrets.features.length+' arrêts, '+fc.travaux.features.length+' chantiers. Données statiques du 28/10/2026.';
}
function boot(){
 geo=new ol.format.GeoJSON();map=new ol.Map({target:'map',layers:[new ol.layer.Tile({source:new ol.source.OSM()})],view:new ol.View({center:ol.proj.fromLonLat([-1.52,43.49]),zoom:12.5}),controls:ol.control.defaults.defaults({rotate:false}).extend([new ol.control.ScaleLine()])});
 $('theme').addEventListener('change',setTheme);for(const id of ['stops','works','areas'])$(id).addEventListener('change',setTheme);for(const id of ['from','to'])$(id).addEventListener('change',()=>{updateStats();if(theme==='travaux')drawLegend();});
 $('find').addEventListener('click',find);$('search').addEventListener('keydown',e=>{if(e.key==='Enter')find()});
 $('fit').addEventListener('click',()=>map.getView().animate({center:ol.proj.fromLonLat([-1.52,43.49]),zoom:12.5,duration:400}));
 $('close').addEventListener('click',closeDetail);
 $('export').addEventListener('click',()=>exportLayer(false));$('csv').addEventListener('click',()=>exportLayer(true));
 $('print').addEventListener('click',()=>window.print());
 $('presentation').addEventListener('click',()=>{document.body.classList.toggle('present');$('presentation').textContent=document.body.classList.contains('present')?'Quitter la présentation':'Mode présentation';setTimeout(()=>map.updateSize(),100);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDetail();if(document.body.classList.contains('present'))$('presentation').click();}});
 load().catch(e=>{$('status').textContent='Erreur d’initialisation : '+e.message;});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();