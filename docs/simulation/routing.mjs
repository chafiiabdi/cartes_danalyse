// Calcul sur chaque graphe séparément. Coûts en secondes, longueurs en mètres.
export const CLASSES = ['Conforme', 'Non conforme', 'Inconnu'];
export const BUDGETS = [300, 600, 900];
export function normalizedClass(value) {
  return value === 'Bloquant' ? 'Non conforme' : (CLASSES.includes(value) ? value : 'Inconnu');
}
class Heap {
  items = [];
  push(item) {
    const a = this.items; a.push(item); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= item[0]) break; a[i] = a[p]; i = p; }
    a[i] = item;
  }
  pop() {
    const a = this.items, first = a[0], last = a.pop();
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let j = i * 2 + 1;
        if (j + 1 < a.length && a[j + 1][0] < a[j][0]) j++;
        if (last[0] <= a[j][0]) break;
        a[i] = a[j]; i = j;
      }
      a[i] = last;
    }
    return first;
  }
}
export function buildGraph(collection, network) {
  const edges = new Map(), adjacency = new Map();
  const add = (a, b, cost) => {
    if (Number.isFinite(cost) && cost >= 0) {
      if (!adjacency.has(a)) adjacency.set(a, []);
      adjacency.get(a).push([b, cost]);
    }
  };
  for (const f of collection.features) {
    const p = f.properties;
    if (p.reseau !== network) throw new Error('Réseaux mélangés dans les données.');
    if (edges.has(p.id)) throw new Error('Identifiant de tronçon dupliqué.');
    if (f.geometry?.type !== 'LineString') throw new Error('Géométrie de tronçon invalide.');
    edges.set(p.id, f);
    if (!p.est_escalier) { add(p.source, p.target, p.cost); add(p.target, p.source, p.reverse_cost); }
  }
  return { network, edges, adjacency };
}
export function distances(graph, departure, maximum = 900) {
  const d = departure.properties ?? departure;
  if (d.reseau !== graph.network) throw new Error('Départ et réseau incompatibles.');
  if (!d.calculable) throw new Error(d.statut_raccord);
  const edge = graph.edges.get(d.troncon_quai_id);
  if (!edge || edge.properties.est_escalier) throw new Error('Tronçon de départ absent ou en escalier.');
  const p = edge.properties, f = d.fraction_quai, connection = d.temps_raccord_s;
  if (!Number.isFinite(f) || f < 0 || f > 1 || !Number.isFinite(connection) || connection < 0) throw new Error('Raccord de départ invalide.');
  const dist = new Map(), heap = new Heap();
  const relax = (node, t) => {
    if (t <= maximum && t < (dist.get(node) ?? Infinity)) { dist.set(node, t); heap.push([t, node]); }
  };
  if (p.reverse_cost >= 0) relax(p.source, connection + f * p.reverse_cost);
  if (p.cost >= 0) relax(p.target, connection + (1 - f) * p.cost);
  while (heap.items.length) {
    const [t, node] = heap.pop();
    if (t !== dist.get(node)) continue;
    for (const [next, cost] of graph.adjacency.get(node) ?? []) relax(next, t + cost);
  }
  return dist;
}
export function mergeIntervals(intervals) {
  const out = [];
  for (const [a, b] of intervals.filter(([a,b]) => b > a).sort((x,y) => x[0]-y[0])) {
    const last = out.at(-1);
    if (last && a <= last[1] + 1e-12) last[1] = Math.max(last[1], b);
    else out.push([a,b]);
  }
  return out;
}
export function intervalsAt(graph, departure, dist, budget) {
  const d = departure.properties ?? departure, result = [];
  for (const feature of graph.edges.values()) {
    const p = feature.properties;
    if (p.est_escalier) continue;
    const intervals = [], ts = dist.get(p.source) ?? Infinity, tt = dist.get(p.target) ?? Infinity;
    if (ts < budget && p.cost >= 0) intervals.push([0, p.cost === 0 ? 1 : Math.min(1, (budget-ts)/p.cost)]);
    if (tt < budget && p.reverse_cost >= 0) intervals.push([p.reverse_cost === 0 ? 0 : Math.max(0, 1-(budget-tt)/p.reverse_cost), 1]);
    if (p.id === d.troncon_quai_id && budget > d.temps_raccord_s) {
      const remaining = budget-d.temps_raccord_s, f = d.fraction_quai;
      const lo = p.reverse_cost < 0 ? f : p.reverse_cost === 0 ? 0 : Math.max(0, f-remaining/p.reverse_cost);
      const hi = p.cost < 0 ? f : p.cost === 0 ? 1 : Math.min(1, f+remaining/p.cost);
      intervals.push([lo,hi]);
    }
    for (const [lo,hi] of mergeIntervals(intervals)) result.push({ feature, lo, hi, length: (hi-lo)*p.longueur_m });
  }
  return result;
}
// Les fractions des sommets sont calculées dans le SCR métrique d'origine (EPSG:3943).
export function pointAt(feature, fraction) {
  const coords = feature.geometry.coordinates, f = feature.properties.vertex_fractions;
  if (fraction <= 0) return coords[0].slice();
  if (fraction >= 1) return coords.at(-1).slice();
  let i = 1; while (i < f.length-1 && f[i] < fraction) i++;
  const ratio = f[i] === f[i-1] ? 0 : (fraction-f[i-1])/(f[i]-f[i-1]);
  return [coords[i-1][0]+ratio*(coords[i][0]-coords[i-1][0]), coords[i-1][1]+ratio*(coords[i][1]-coords[i-1][1])];
}
export function clipFeature(portion, budget, accessId) {
  const { feature, lo, hi, length } = portion, p = feature.properties;
  const coords = [pointAt(feature,lo)];
  p.vertex_fractions.forEach((f,i) => { if (f > lo && f < hi) coords.push(feature.geometry.coordinates[i]); });
  coords.push(pointAt(feature,hi));
  const { vertex_fractions, ...properties } = p;
  return { type:'Feature', geometry:{type:'LineString',coordinates:coords}, properties:{...properties,classe_pmr:normalizedClass(p.classe_pmr),troncon_id:p.id,acces_id:accessId,duree_s:budget,fraction_debut:lo,fraction_fin:hi,longueur_atteinte_m:length} };
}
export function statistics(portions) {
  const result = Object.fromEntries(CLASSES.map(c => [c,{length:0,ids:new Set()}]));
  for (const item of portions) { const p=item.feature.properties, s=result[normalizedClass(p.classe_pmr)]; s.length+=item.length; s.ids.add(p.id); }
  const total = Object.values(result).reduce((sum,s)=>sum+s.length,0);
  return {total,count:new Set(portions.map(x=>x.feature.properties.id)).size,classes:Object.fromEntries(Object.entries(result).map(([c,s])=>[c,{length:s.length,count:s.ids.size,percent:total ? s.length/total*100 : 0}]))};
}
