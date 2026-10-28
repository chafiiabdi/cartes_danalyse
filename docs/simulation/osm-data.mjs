// Jeu OSM indépendant, publié en instantané pour la simulation OpenLayers.
export async function loadOsmDataset(fetchJSON, departureFeatures) {
  const names=Array.from({length:6},(_,i)=>'osm_graph_'+String(i+1).padStart(2,'0')+'.json');
  const [parts,dep]=await Promise.all([
    Promise.all(names.map(n=>fetchJSON('./data/'+n))),
    fetchJSON('./data/osm_departures.json')
  ]);
  const features=[];
  for(const part of parts) for(const row of part.rows){
    const [id,source,target,cost,reverse_cost,lon1,lat1,lon2,lat2,classe,kind]=row;
    const speed=classe===1?3:6;
    const longueur_m=cost*speed/3.6;
    features.push({type:'Feature',geometry:{type:'LineString',coordinates:[[lon1,lat1],[lon2,lat2]]},
      properties:{id,reseau:'osm',source,target,cost,reverse_cost,longueur_m,
        vertex_fractions:[0,1],classe_pmr:['Conforme','Non conforme','Inconnu'][classe],
        est_escalier:false,typtronco:kind,origine:'osm',vitesse_kmh:speed,
        motifs:classe===1?'OSM : passage difficile signalé':classe===0?'OSM : accessibilité indiquée, à confirmer':'OSM : accessibilité estimée, à vérifier',
        informations_manquantes:'Pente, dévers, largeur utile et obstacles non contrôlés sur le terrain',
        source_mesures:'OpenStreetMap ; simulation indicative'}});
  }
  const pointById=new Map(departureFeatures.filter(f=>f.properties.reseau==='pmr').map(f=>[f.properties.acces_id,f]));
  const departures=[];
  for(const [acces,troncon,source,target,fraction,temps,calculable,distance] of dep.rows){
    const point=pointById.get(acces);
    if(!point)continue;
    departures.push({type:'Feature',geometry:point.geometry,properties:{
      acces_id:acces,nom:point.properties.nom,stop_id:point.properties.stop_id,
      reseau:'osm',calculable,troncon_quai_id:troncon,
      fraction_quai:fraction,temps_raccord_s:Number(temps),
      distance_raccord_m:Number(distance),statut_raccord:calculable?
      'Calculable : accès projeté sur le réseau OSM ; praticabilité du raccord à vérifier':
      'Non calculable : aucun cheminement OSM admissible dans les 30 m'
    }});
  }
  return {dataset:{type:'FeatureCollection',metadata:{
    exported_at:'2026-10-28T00:00:00Z',source_calculated_at:'2026-10-28T00:00:00Z'
  },features},departures};
}
