"use strict";
(() => {
  let graph = null, departures = null, graphPromise = null;
  function addOSMChoice() {
    const selector = document.querySelector('.segment');
    if (!selector || selector.querySelector('[value="osm"]')) return;
    selector.style.gridTemplateColumns = 'repeat(3,minmax(0,1fr))';
    const label = document.createElement('label');
    label.innerHTML = '<input type="radio" name="network" value="osm"> OSM';
    selector.append(label);
    label.querySelector('input').addEventListener('change',()=>{if(label.querySelector('input').checked)calculate();});
    const notice = document.querySelector('.note');
    if (notice) notice.textContent += ' Réseau OSM : calcul navigateur sur les données du 28 octobre 2026. Tracés indicatifs, raccordements et accessibilité à vérifier.';
  }
  function heapPush(h, item) {
    let i = h.length; h.push(item);
    while (i) { const p=(i-1)>>1; if (h[p][0] <= item[0]) break;h[i]=h[p];i=p; }h[i]=item;
  }
  function heapPop(h) {
    const first=h[0],last=h.pop();if(h.length){let i=0;while(2*i+1<h.length){let k=2*i+1;if(k+1<h.length&&h[k+1][0]<h[k][0])k++;if(h[k][0]>=last[0])break;h[i]=h[k];i=k;}h[i]=last;}return first;
  }
  async function loadGraph() {
    if(graph) return graph;
    if(graphPromise)return graphPromise;
    graphPromise=(async()=>{
      const requests=[];
      for(let i=1;i<=6;i++)requests.push(jsonFile('osm_graph_'+String(i).padStart(2,'0')+'.json'));
      requests.push(jsonFile('osm_departures.json'));
      const files=await Promise.all(requests);const edges=new Map(),adj=new Map();
      function link(a,b,c){if(c<0||!Number.isFinite(c))return;if(!adj.has(a))adj.set(a,[]);adj.get(a).push([b,c]);}
      for(const f of files.slice(0,6)){for(const e of f.rows){const [id,s,t,c,rc]=e;if(edges.has(id))throw Error('Identifiant OSM dupliqué : '+id);edges.set(id,e);link(s,t,c);link(t,s,rc);}}
      graph={edges,adj};departures=new Map(files[6].rows.map(x=>[x[0],x]));return graph;
    })().catch(e=>{graphPromise=null;throw e;});
    return graphPromise;
  }
  function distanceMap(g,d,max=900) {
    const [acces,id,s,t,f,connect]=d,e=g.edges.get(id);
    if(!e)throw Error('Arête de départ absente.');
    const dist=new Map(),heap=[];
    const push=(n,c)=>{if(c<=max&&c<(dist.get(n)??Infinity)){dist.set(n,c);heapPush(heap,[c,n]);}};
    push(s,connect+f*e[4]);push(t,connect+(1-f)*e[3]);
    while(heap.length){const [cost,node]=heapPop(heap);if(cost!==dist.get(node))continue;for(const [v,w] of g.adj.get(node)||[])push(v,cost+w);}
    return dist;
  }
  function mergeRanges(arr) {
    arr.sort((a,b)=>a[0]-b[0]);const out=[];
    for(const [lo,hi] of arr){if(!(hi>lo))continue;const p=out[out.length-1];if(p&&lo<=p[1]+1e-9)p[1]=Math.max(p[1],hi);else out.push([lo,hi]);}
    return out;
  }
  function clip(e,f0,f1){const x1=e[5],y1=e[6],x2=e[7],y2=e[8];return [[x1+(x2-x1)*f0,y1+(y2-y1)*f0],[x1+(x2-x1)*f1,y1+(y2-y1)*f1]];}
  window.calculateOSM = async function() {
    const id=Number(document.getElementById('acces').value);
    if(!id)return;
    const allowed=new Set([...document.querySelectorAll('.duration:checked')].map(x=>+x.value));
    const classes=new Set([...document.querySelectorAll('.classe:checked')].map(x=>+x.value));
    if(!allowed.size){document.getElementById('status').textContent='Sélectionnez au moins une durée.';return;}
    const btn=document.getElementById('calculate');btn.disabled=true;
    document.getElementById('status').textContent='Chargement et calcul du graphe OSM…';
    try {
      const g=await loadGraph(),d=departures.get(id);
      if(!d||!d[6]) {source.clear();document.getElementById('status').textContent='Raccord OSM non calculable : aucun cheminement piéton à 30 m.';document.getElementById('counts').textContent='';return;}
      const dist=distanceMap(g,d),durations=[...allowed].sort((a,b)=>b-a);
      source.clear();let counted=0,total=0;
      for(const duration of durations){
        for(const e of g.edges.values()){
          const [edgeId,s,t,c,rc,x1,y1,x2,y2,cl,typ]=e;
          const segs=[],ts=dist.get(s)??Infinity,tt=dist.get(t)??Infinity;
          if(ts<duration&&c>0)segs.push([0,Math.min(1,(duration-ts)/c)]);
          if(tt<duration&&rc>0)segs.push([Math.max(0,1-(duration-tt)/rc),1]);
          if(edgeId===d[1]&&duration>d[5]){
            const remain=duration-d[5],f=d[4];segs.push([Math.max(0,f-remain/rc),Math.min(1,f+remain/c)]);
          }
          for(const [f0,f1] of mergeRanges(segs)){
            total++;
            if(!classes.has(cl))continue;
            const row=[id,duration,edgeId,cl,typ,cl===1?'OSM : cheminement difficile':cl===2?'OSM : accessibilité estimée, à vérifier':'OSM : accessibilité indiquée','','',null,null,null,clip(e,f0,f1)];
            source.addFeature(makeFeature(row,'osm'));counted++;
          }
        }
      }
      stairSource.setVisible(false);
      document.getElementById('networkNotice').textContent='OSM : cheminements théoriquement atteignables ; classes tirées des attributs OSM, non du relevé CNIG.';
      const pt=pointSource.getFeatures().find(f=>+f.get('id')===id);
      const extent=source.getExtent();
      if(pt){ol.extent.extend(extent,pt.getGeometry().getExtent());}
      if(!ol.extent.isEmpty(extent))view.fit(extent,{maxZoom:17,padding:[60,50,60,window.innerWidth>700?385:50],duration:350});
      const nums=[0,1,2].map(c=>source.getFeatures().filter(f=>f.get('classe')===c).length);
      document.getElementById('counts').textContent='Portions affichées : '+counted+' | Conforme : '+nums[0]+' · Non conforme : '+nums[1]+' · Inconnu : '+nums[2];
      document.getElementById('status').textContent='Accès '+id+' — réseau OSM · '+counted+' portions affichées sur '+total+' (toutes durées sélectionnées). Raccord '+d[7]+' m inclus dans le temps. Simulation indicative.';
      pointSource.getFeatures().forEach(f=>f.set('selected',+f.get('id')===id));
    }catch(e){document.getElementById('status').textContent='Erreur OSM : '+String(e.message||e);}
    finally{btn.disabled=false;}
  };
  addOSMChoice();
})();