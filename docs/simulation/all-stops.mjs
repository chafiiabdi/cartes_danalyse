// Couverture depuis l'ensemble des accès : plus court temps depuis au moins un accès.
// Les portions de réseau sont fusionnées avant les statistiques, afin d'éviter les doubles comptes.
import { BUDGETS, mergeIntervals, statistics } from './routing.mjs';

class Queue {
  constructor(){this.a=[];}
  push(node,t){const a=this.a;let i=a.length;a.push([t,node]);while(i){const p=(i-1)>>1;if(a[p][0]<=t)break;a[i]=a[p];i=p;}a[i]=[t,node];}
  pop(){const a=this.a,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1][0]<a[j][0])j++;if(last[0]<=a[j][0])break;a[i]=a[j];i=j;}a[i]=last;}return first;}
  get length(){return this.a.length;}
}

export function calculateAllStops(graph, departures){
  const valid=departures.filter(f=>f.properties.reseau===graph.network&&f.properties.calculable);
  const times=new Map(), heap=new Queue(), starts=new Map();
  function seed(node,t){if(Number.isFinite(t)&&t>=0&&t<=900&&t<(times.get(node)??Infinity)){times.set(node,t);heap.push(node,t);}}
  for(const f of valid){
    const d=f.properties,e=graph.edges.get(d.troncon_quai_id);
    if(!e||e.properties.est_escalier||!Number.isFinite(d.fraction_quai)||!Number.isFinite(d.temps_raccord_s))continue;
    const p=e.properties,fraction=d.fraction_quai,connection=d.temps_raccord_s;
    if(p.reverse_cost>=0)seed(p.source,connection+fraction*p.reverse_cost);
    if(p.cost>=0)seed(p.target,connection+(1-fraction)*p.cost);
    if(!starts.has(p.id))starts.set(p.id,[]);
    starts.get(p.id).push({fraction,connection,cost:p.cost,reverse:p.reverse_cost});
  }
  while(heap.length){
    const [t,node]=heap.pop();if(t!==times.get(node))continue;
    for(const [next,cost] of graph.adjacency.get(node)??[])seed(next,t+cost);
  }
  const byBudget={};
  for(const budget of BUDGETS){
    const reached=[];
    for(const feature of graph.edges.values()){
      const p=feature.properties;if(p.est_escalier)continue;
      const intervals=[],ts=times.get(p.source)??Infinity,tt=times.get(p.target)??Infinity;
      if(ts<budget&&p.cost>=0)intervals.push([0,p.cost===0?1:Math.min(1,(budget-ts)/p.cost)]);
      if(tt<budget&&p.reverse_cost>=0)intervals.push([p.reverse_cost===0?0:Math.max(0,1-(budget-tt)/p.reverse_cost),1]);
      for(const d of starts.get(p.id)??[]){
        if(budget<=d.connection)continue;
        const remainder=budget-d.connection;
        const lo=d.reverse<0?d.fraction:d.reverse===0?0:Math.max(0,d.fraction-remainder/d.reverse);
        const hi=d.cost<0?d.fraction:d.cost===0?1:Math.min(1,d.fraction+remainder/d.cost);
        intervals.push([lo,hi]);
      }
      for(const [lo,hi] of mergeIntervals(intervals))reached.push({feature,lo,hi,length:(hi-lo)*p.longueur_m});
    }
    byBudget[budget]=reached;
  }
  return {byBudget,stats:statistics(byBudget[900]),numberOfStops:valid.length};
}
