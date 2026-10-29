// Tableau de toutes les longueurs par arrêt : source statistique exportée depuis Supabase.
const el=id=>document.getElementById(id);
let data=null;
const format=n=>Number(n).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
const escape=v=>'"'+String(v??'').replaceAll('"','""')+'"';
function rowsFor(network){
  const options=Array.from(el('departure').options);
  const names=new Map(options.filter(x=>x.value!=='all').map(o=>[Number(o.value),o.textContent.split(' · accès ')[0]]));
  return (data?.networks?.[network]||[]).map(([id,a,b,c])=>({id,name:names.get(id)||'Accès '+id,values:[a,b,c]})).sort((a,b)=>a.name.localeCompare(b.name,'fr')||a.id-b.id);
}
function currentNetwork(){return document.querySelector('input[name="network"]:checked')?.value||'pmr';}
function currentDuration(){return Number(document.querySelector('input[name="budget"]:checked')?.value||900);}
function render(){
  const target=el('allStopsStatistics');
  if(!data||el('departure').value!=='all'){target.hidden=true;return;}
  const rows=rowsFor(currentNetwork()),duration=currentDuration(),index=[300,600,900].indexOf(duration);
  if(index<0){target.hidden=true;return;}
  const totals=[0,1,2].map(i=>rows.reduce((sum,row)=>sum+Number(row.values[i]||0),0));
  const valid=rows.filter(row=>row.values[index]!==null).length;
  const summary=el('allStopsSummary');summary.replaceChildren();
  const p=document.createElement('p');p.className='hint';
  p.textContent='Somme des longueurs par arrêt à '+duration/60+' min : '+format(totals[index]/1000)+' km · '+valid+' arrêts · moyenne '+format(totals[index]/Math.max(1,valid))+' m par arrêt. La couverture cartographiée, sans doublons, figure au-dessus.';
  summary.append(p);
  const tbody=el('allStopsRows');tbody.replaceChildren();
  for(const item of rows){
    const tr=document.createElement('tr'),th=document.createElement('th');th.scope='row';th.textContent=item.name+' · '+item.id;tr.append(th);
    item.values.forEach((value,i)=>{const td=document.createElement('td');td.textContent=value==null?'—':format(value/1000)+' km';if(i===index)td.className='current-duration';tr.append(td);});
    tbody.append(tr);
  }
  const tr=document.createElement('tr'),th=document.createElement('th');tr.className='totals-row';th.textContent='Somme des arrêts';tr.append(th);
  totals.forEach(value=>{const td=document.createElement('td');td.textContent=format(value/1000)+' km';tr.append(td);});
  tbody.append(tr);target.hidden=false;
}
function download(){
  const lines=['acces_id;nom_arret;longueur_5min_m;longueur_10min_m;longueur_15min_m'];
  for(const r of rowsFor(currentNetwork()))lines.push([r.id,r.name,...r.values].map(escape).join(';'));
  const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='distances_tous_les_arrets_'+currentNetwork()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
el('allStopsCsv').addEventListener('click',download);
document.addEventListener('change',e=>{if(e.target.closest('input[name="network"],input[name="budget"],#departure'))queueMicrotask(render);});
document.addEventListener('click',e=>{if(e.target.closest('#calculate'))queueMicrotask(render);});
fetch('./data/longueurs_par_arret.json').then(r=>{if(!r.ok)throw Error('Statistiques indisponibles');return r.json();}).then(value=>{data=value;render();}).catch(e=>{console.warn(e);});
