/* Comparaison exploratoire PMR / OSM — WebSIG distinct de la simulation historique.
   Sources statiques : docs/simulation/data/pmr.geojson et osm_graph_01..06.json.
   Aucun mélange des graphes ou recalcul d'isochrones. */
"use strict";
(function () {
  const $=id=>document.getElementById(id);
  const metric=v=>Number(v).toLocaleString('fr-FR',{maximumFractionDigits:1});
  const osmStyle=new ol.style.Style({stroke:new ol.style.Stroke({
    color:'rgba(90,92,112,0.72)',width:1.65,lineDash:[6,4]
  })});
  const pmrStyle=new ol.style.Style({stroke:new ol.style.Stroke({
    color:'#007f85',width:3.5
  })});
  const candidateStyle=new ol.style.Style({
    image:new ol.style.Circle({radius:5.5,
      fill:new ol.style.Fill({color:'#c33d46'}),
      stroke:new ol.style.Stroke({color:'#fff',width:1.5})
    })
  });
  let loaded=false,loading=null;
  let pmrLayer,osmLayer,candidatesLayer, pmrSource,osmSource,candidatesSource;
  const buffer=25; // metres : simple zone de proximité, pas un seuil de conformité
  function ui(text){$('compareStatus').textContent=text;}
  const validGeometry=f=>{
    const g=f.getGeometry();
    return g&&(g.getType()==='LineString'||g.getType()==='MultiLineString');
  };
  function segments(f){
    const g=f.getGeometry();if(!g)return [];
    return g.getType()==='LineString'?[g.getCoordinates()]:
      g.getType()==='MultiLineString'?g.getCoordinates():[];
  }
  function endpointNodes(features){
    // Une extrémité de degré 1 est seulement une discontinuité topologique
    // apparente : une impasse, une limite d'inventaire ou une erreur de
    // raccordement peuvent produire le même signal.
    const nodes=new Map(),cell=2;
    function register(p) {
      const key=Math.round(p[0]/cell)+':'+Math.round(p[1]/cell);
      let rec=nodes.get(key);
      if(!rec){rec={x:p[0],y:p[1],degree:0};nodes.set(key,rec);}
      rec.degree++;
    }
    for(const f of features) for(const c of segments(f)){
      if(c.length<2)continue;
      register(c[0]);register(c[c.length-1]);
    }
    return [...nodes.values()].filter(x=>x.degree===1);
  }
  const sq=(x)=>x*x;
  function segmentDistance(p,a,b){
    const dx=b[0]-a[0],dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy||1)));
    return Math.sqrt(sq(p.x-a[0]-dx*t)+sq(p.y-a[1]-dy*t));
  }
  function candidateFeatures(pmrFeatures,osmFeatures) {
    const terminals=endpointNodes(pmrFeatures);
    const bucket=60,grid=new Map();
    const k=(i,j)=>i+':'+j;
    const put=(i,j,v)=>{const key=k(i,j);if(!grid.has(key))grid.set(key,[]);grid.get(key).push(v);};
    const extent=pmrSource.getExtent();
    const pad=buffer+20;
    const left=extent[0]-pad,right=extent[2]+pad,bottom=extent[1]-pad,top=extent[3]+pad;
    for(const f of osmFeatures)for(const line of segments(f))for(let x=1;x<line.length;x++){
      const a=line[x-1],b=line[x];
      if(Math.max(a[0],b[0])<left||Math.min(a[0],b[0])>right||
         Math.max(a[1],b[1])<bottom||Math.min(a[1],b[1])>top)continue;
      const minx=Math.floor((Math.min(a[0],b[0])-buffer)/bucket);
      const maxx=Math.floor((Math.max(a[0],b[0])+buffer)/bucket);
      const miny=Math.floor((Math.min(a[1],b[1])-buffer)/bucket);
      const maxy=Math.floor((Math.max(a[1],b[1])+buffer)/bucket);
      const entry=[a,b];
      for(let i=minx;i<=maxx;i++)for(let j=miny;j<=maxy;j++)put(i,j,entry);
    }
    const found=[];
    for(const p of terminals){
      const i=Math.floor(p.x/bucket),j=Math.floor(p.y/bucket);
      const cells=grid.get(k(i,j))||[];
      let distance=Infinity;
      for(const [a,b] of cells)distance=Math.min(distance,segmentDistance(p,a,b));
      if(distance>buffer)continue;
      const feature=new ol.Feature({geometry:new ol.geom.Point([p.x,p.y]),
        distance_osm_m:Math.round(distance*10)/10,
        commentaire:'Extrémité apparente du réseau PMR près d’un tronçon OSM. Vérification de terrain nécessaire.'
      });
      found.push(feature);
    }
    return {found,terminals:terminals.length};
  }
  async function fetchJson(path){
    const r=await fetch(path,{cache:'default'});
    if(!r.ok)throw new Error(path.split('/').pop()+' (HTTP '+r.status+')');
    return r.json();
  }
  async function load(){
    if(loaded)return;
    if(loading)return loading;
    loading=(async()=>{
      ui('Chargement des réseaux PMR et OSM…');
      // Aucun export ni lecture de clé Supabase : réutilisation des jeux publiés.
      const osmNames=Array.from({length:6},(_,i)=>
        '../simulation/data/osm_graph_'+String(i+1).padStart(2,'0')+'.json');
      const [pmrData,...osmParts]=await Promise.all([
        fetchJson('../simulation/data/pmr.geojson'),
        ...osmNames.map(fetchJson)
      ]);
      if(pmrData.type!=='FeatureCollection'||!Array.isArray(pmrData.features))throw new Error('Réseau PMR non reconnu');
      const fmt=new ol.format.GeoJSON();
      const allPmr=fmt.readFeatures(pmrData,{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'});
      const usablePmr=allPmr.filter(f=>validGeometry(f)&&
        f.get('est_escalier')!==true&&f.get('est_escalier')!==1&&f.get('est_escalier')!=='true'&&
        !/escalier/i.test(String(f.get('typtronco')||'')));
      if(!usablePmr.length)throw new Error('Aucun tronçon PMR trouvé');
      const osm=[];
      for(const part of osmParts){
        if(!Array.isArray(part.rows))throw new Error('Jeu OSM incomplet');
        for(const row of part.rows){
          const [id,source,target,cost,reverse,lon1,lat1,lon2,lat2,classe,kind]=row;
          if(![lon1,lat1,lon2,lat2].every(Number.isFinite))continue;
          if(kind&&/steps|stair|escalier/i.test(kind))continue; // ne pas suggérer des escaliers
          const feature=new ol.Feature({
            geometry:new ol.geom.LineString([ol.proj.fromLonLat([lon1,lat1]),ol.proj.fromLonLat([lon2,lat2])]),
            osm_id:id, type_osm:kind||'non renseigné'
          });
          osm.push(feature);
        }
      }
      pmrSource=new ol.source.Vector({features:usablePmr});
      osmSource=new ol.source.Vector({features:osm});
      candidatesSource=new ol.source.Vector();
      pmrLayer=new ol.layer.Vector({source:pmrSource,style:pmrStyle,visible:false});
      osmLayer=new ol.layer.Vector({source:osmSource,style:osmStyle,visible:false});
      candidatesLayer=new ol.layer.Vector({source:candidatesSource,style:candidateStyle,visible:false});
      osmLayer.setZIndex(20);pmrLayer.setZIndex(21);candidatesLayer.setZIndex(22);
      map.addLayer(osmLayer);map.addLayer(pmrLayer);map.addLayer(candidatesLayer);
      const result=candidateFeatures(usablePmr,osm);
      candidatesSource.addFeatures(result.found);
      loaded=true;
      ui(metric(usablePmr.length)+' tronçons PMR · '+metric(osm.length)+' segments OSM · '+
         metric(result.found.length)+' extrémités PMR proches d’OSM à examiner (≤ 25 m, sans validation).');
      return true;
    })().catch(e=>{loading=null;ui('Comparaison indisponible : '+e.message);$('compare').checked=false;throw e;});
    return loading;
  }
  function visibility(){
    if(!loaded)return;
    const enabled=$('compare').checked;
    osmLayer.setVisible(enabled&&$('compareOsm').checked);
    pmrLayer.setVisible(enabled&&$('comparePmr').checked);
    candidatesLayer.setVisible(enabled&&$('compareEnds').checked);
    $('networkLegend').hidden=!enabled;
  }
  async function toggle(){
    const on=$('compare').checked;
    for(const id of ['compareOsm','comparePmr','compareEnds','compareFit'])$(id).disabled=!on;
    $('compareOptions').hidden=!on;
    $('networkLegend').hidden=!on;
    if(on)try{await load();}catch(e){$('compareOptions').hidden=true;$('networkLegend').hidden=true;return;}
    visibility();
  }
  function fit(){
    if(!loaded)return;
    map.getView().fit(pmrSource.getExtent(),{padding:[48,48,48,48],maxZoom:15,duration:450});
  }
  function setup(){
    $('compare').addEventListener('change',toggle);
    ['compareOsm','comparePmr','compareEnds'].forEach(id=>$(id).addEventListener('change',visibility));
    $('compareFit').addEventListener('click',async()=>{try{await load();fit();}catch(e){}});
    map.on('singleclick',ev=>{
      if(!loaded||!$('compare').checked||!$('compareEnds').checked)return;
      const f=map.forEachFeatureAtPixel(ev.pixel,(feature,layer)=>{
        if(layer===candidatesLayer)return feature;
      },{hitTolerance:8});
      if(f)ui('Point à examiner : extrémité apparente PMR située à '+metric(f.get('distance_osm_m'))+
              ' m d’un segment OSM. L’existence d’un passage accessible reste à vérifier.');
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();