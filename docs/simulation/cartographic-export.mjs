// Export cartographique A4 paysage, indépendant des calculs pgRouting.
// Le fond OpenStreetMap et les couches OpenLayers sont assemblés sans les contrôles de l'interface.
const PAGE={width:2806,height:1984};
const COLORS={Conforme:'#147d68','Non conforme':'#c96025',Inconnu:'#8060a3'};
const TIMES={300:'#007f6f',600:'#288bc2',900:'#7451ac'};
const LABELS={pmr:'Réseau PMR (CNIG)',bdtopo:'Réseau BD TOPO',osm:'Réseau OpenStreetMap (OSM)'};
const fr=(value,digits=0)=>Number(value).toLocaleString('fr-FR',{maximumFractionDigits:digits,minimumFractionDigits:digits});
function font(ctx,size=30,weight=400){ctx.font=weight+' '+size+'px Arial, sans-serif';}
function write(ctx,label,x,y,size=30,color='#263c38',weight=400,maxWidth){
  ctx.fillStyle=color;font(ctx,size,weight);ctx.fillText(String(label),x,y,maxWidth);
}
function rounded(ctx,x,y,w,h,r,fill,stroke){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
}
function line(ctx,x,y,width,color= '#147d68',dash=[]){
  ctx.save();ctx.lineWidth=10;ctx.strokeStyle=color;ctx.setLineDash(dash);
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+width,y);ctx.stroke();ctx.restore();
}
function busSymbol(ctx,x,y,r=19){
  ctx.save();
  ctx.fillStyle='#174f51';ctx.strokeStyle='#fff';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  rounded(ctx,x-r*.53,y-r*.65,r*1.06,r*1.24,4,'#fff');
  rounded(ctx,x-r*.38,y-r*.48,r*.76,r*.45,2,'#cfe7e4');
  ctx.fillStyle='#174f51';
  for(const dx of [-r*.32,r*.32]){ctx.beginPath();ctx.arc(x+dx,y+r*.36,2.3,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
function collectCanvases(map){
  const size=map.getSize();
  if(!size||size[0]<10||size[1]<10)throw Error('La carte est trop petite pour être exportée.');
  const canvas=document.createElement('canvas');canvas.width=Math.round(size[0]);canvas.height=Math.round(size[1]);
  const c=canvas.getContext('2d');c.fillStyle='#eaf0ea';c.fillRect(0,0,canvas.width,canvas.height);
  let found=0;
  for(const layerCanvas of map.getViewport().querySelectorAll('.ol-layer canvas, canvas.ol-layer')){
    if(layerCanvas.width===0||layerCanvas.height===0)continue;
    c.save();
    const opacity=layerCanvas.parentElement?.style.opacity||layerCanvas.style.opacity;
    c.globalAlpha=opacity?Number(opacity):1;
    const transform=layerCanvas.style.transform;
    const match=transform&&transform.match(/^matrix\(([^)]+)\)$/);
    if(match){
      const m=match[1].split(',').map(Number);
      if(m.length===6&&m.every(Number.isFinite))c.setTransform(...m);
      else continue;
    }else{
      const w=parseFloat(layerCanvas.style.width)||layerCanvas.clientWidth||size[0];
      const h=parseFloat(layerCanvas.style.height)||layerCanvas.clientHeight||size[1];
      c.setTransform(w/layerCanvas.width,0,0,h/layerCanvas.height,0,0);
    }
    c.drawImage(layerCanvas,0,0);
    c.restore();found++;
  }
  if(found===0)throw Error('Aucune couche cartographique rendue. Actualisez la carte puis réessayez.');
  // Vérifie la possibilité d'exporter le fond de carte (CORS).
  try{c.getImageData(0,0,1,1);}catch{throw Error('Le fond de carte interdit son export. Rechargez la page, puis réessayez.');}
  return canvas;
}
function whenRendered(map){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const timeout=setTimeout(()=>{if(!settled){settled=true;map.un('rendercomplete',done);reject(Error('Le fond de carte n’a pas fini de charger. Réessayez après son affichage.'));}},15000);
    const done=()=>{if(settled)return;settled=true;clearTimeout(timeout);resolve();};
    map.once('rendercomplete',done);map.renderSync();
  });
}
function mapPanel(ctx,snapshot,map){
  const x=105,y=305,w=2035,h=1395;
  rounded(ctx,x-3,y-3,w+6,h+6,12,'#e7efeb','#d4e1db');
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  const ratio=Math.min(w/snapshot.width,h/snapshot.height);
  const iw=snapshot.width*ratio,ih=snapshot.height*ratio;
  const left=x+(w-iw)/2,top=y+(h-ih)/2;
  ctx.drawImage(snapshot,left,top,iw,ih);
  ctx.restore();
  return {x,y,w,h,left,top,ratio};
}
function north(ctx,p,map){
  const x=p.x+p.w-105,y=p.y+105,r=63;
  ctx.save();
  rounded(ctx,x-r,y-r,r*2,r*2,15,'#ffffffed','#dee7e2');
  const angle=-(map.getView().getRotation()||0);
  ctx.translate(x,y+8);ctx.rotate(angle);
  ctx.fillStyle='#163b37';ctx.beginPath();ctx.moveTo(0,-39);ctx.lineTo(-15,14);ctx.lineTo(0,5);ctx.closePath();ctx.fill();
  ctx.fillStyle='#92ada4';ctx.beginPath();ctx.moveTo(0,-39);ctx.lineTo(15,14);ctx.lineTo(0,5);ctx.closePath();ctx.fill();
  ctx.restore();
  write(ctx,'N',x,y-40,24,'#143c35',700);
}
function scaleBar(ctx,map,p){
  const resolution=map.getView().getResolution();
  const point=map.getView().getCenter();
  const metersPerScreenPixel=ol.proj.getPointResolution(map.getView().getProjection(),resolution,point,'m');
  if(!Number.isFinite(metersPerScreenPixel)||metersPerScreenPixel<=0)return;
  const ideal=245*metersPerScreenPixel;
  const pow=Math.pow(10,Math.floor(Math.log10(ideal)));
  const choices=[1,2,5,10].map(n=>n*pow);
  const distance=choices.reduce((a,b)=>Math.abs(b-ideal)<Math.abs(a-ideal)?b:a);
  const w=(distance/metersPerScreenPixel)*p.ratio;
  const x=p.x+45,y=p.y+p.h-78;
  rounded(ctx,x-22,y-68,Math.max(345,w+72),103,13,'#ffffffed','#dae4dd');
  const barY=y-17;
  ctx.fillStyle='#163b35';ctx.fillRect(x,barY,w/2,14);
  ctx.fillStyle='#fff';ctx.fillRect(x+w/2,barY,w/2,14);
  ctx.strokeStyle='#163b35';ctx.lineWidth=3;ctx.strokeRect(x,barY,w,14);
  write(ctx,'0',x,barY-12,19,'#183d35',700);
  ctx.textAlign='right';write(ctx,distance>=1000?fr(distance/1000,2)+' km':fr(distance)+' m',x+w,barY-12,21,'#183d35',700);ctx.textAlign='left';
}
function sidePanel(ctx,opts){
  const x=2180,y=305,w=520,h=1395;
  rounded(ctx,x,y,w,h,14,'#fbfdfb','#dce8e1');
  write(ctx,'LÉGENDE',x+37,y+62,31,'#183d35',700);
  write(ctx,opts.colorMode==='time'?'Temps de parcours':'Accessibilité des tronçons',x+37,y+109,24,'#62736e');
  let yy=y+175;
  function item(label,color,dash=false,access=false){
    if(access)busSymbol(ctx,x+58,yy-9,16);
    else line(ctx,x+39,yy-8,52,color,dash?[13,8]:[]);
    write(ctx,label,x+115,yy,26,'#29413a');
    yy+=73;
  }
  if(opts.colorMode==='time'){
    for(const t of [300,600,900].filter(v=>v<=opts.budget))item('Atteignable en '+t/60+' min',TIMES[t]);
  }else{
    for(const key of ['Conforme','Non conforme','Inconnu']){
      if(opts.allowed.has(key))item(key,COLORS[key]);
    }
  }
  if(opts.showStairs&&opts.network==='pmr')item('Escaliers exclus','#ae3340',true);
  if(opts.showContext)item('Réseau non atteint','#a8b5b1');
  if(opts.showStops)item('Arrêts prioritaires','',false,true);
  yy=Math.max(yy+18,y+700);
  ctx.strokeStyle='#dde8e1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+35,yy);ctx.lineTo(x+w-35,yy);ctx.stroke();yy+=65;
  write(ctx,'RÉSULTATS',x+37,yy,31,'#183d35',700);yy+=68;
  write(ctx,fr(opts.stats.total/1000,2)+' km',x+37,yy,61,'#167d6e',700);yy+=40;
  write(ctx,'de chemins atteignables',x+37,yy,24,'#637773');yy+=73;
  write(ctx,fr(opts.stats.count)+' segments',x+37,yy,30,'#25433b',700);yy+=75;
  const ratio=Math.round(opts.stats.total?opts.stats.classes['Inconnu'].length/opts.stats.total*100:0);
  if(opts.network==='osm') {
    yy+=5;write(ctx,'OSM : données indicatives',x+37,yy,24,'#875f36',700);yy+=38;
    write(ctx,'Conformité PMR non certifiée',x+37,yy,22,'#766957');
  } else {
    write(ctx,fr(ratio)+' % de longueur',x+37,yy,25,'#5e6f69',700);yy+=36;
    write(ctx,'en classe « Inconnu »',x+37,yy,22,'#62736e');
  }
}
function footer(ctx,opts){
  const y=1747;
  ctx.strokeStyle='#dce7e1';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(107,y);ctx.lineTo(2698,y);ctx.stroke();
  write(ctx,'SOURCES ET MÉTHODOLOGIE',108,y+53,25,'#183d35',700);
  const bases=opts.network==='pmr'?'Cheminements PMR (géostandard CNIG, projet Anglet)':opts.network==='bdtopo'?'BD TOPO © IGN – projet Anglet':'© Contributeurs OpenStreetMap – réseau OSM préparé pour Anglet';
  write(ctx,'Données : '+bases+'  |  Fond : © contributeurs OpenStreetMap',108,y+104,25,'#526a63');
  write(ctx,'Simulation indicative ; vitesses 6/3 km/h ; raccordement supposé praticable ; travaux temporaires non intégrés.',108,y+146,22,'#627773');
  write(ctx,'Export : '+new Date().toLocaleDateString('fr-FR')+'  ·  Source : '+opts.sourceDate,108,y+185,22,'#627773');
  ctx.textAlign='right';write(ctx,'EPSG:3857 · échelle graphique',2693,y+53,23,'#617770');ctx.textAlign='left';
}
function compose(snapshot,opts,map){
  const canvas=document.createElement('canvas');canvas.width=PAGE.width;canvas.height=PAGE.height;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#147d68';ctx.fillRect(0,0,PAGE.width,18);
  write(ctx,'ACCESSIBILITÉ PIÉTONNE  ·  ANGLET',107,95,27,'#147d68',700);
  write(ctx,'Cheminements atteignables en '+opts.budget/60+' minutes',107,175,62,'#193f36',700);
  write(ctx,LABELS[opts.network]+'  |  Départ : '+opts.accessName+' (accès n° '+opts.selectedId+')',107,239,32,'#61756e');
  const p=mapPanel(ctx,snapshot,map);
  north(ctx,p,map);scaleBar(ctx,map,p);sidePanel(ctx,opts);footer(ctx,opts);
  return canvas;
}
function save(blob,name){
  const a=document.createElement('a'),url=URL.createObjectURL(blob);
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function blobFromCanvas(canvas,type,quality){
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Impossible de produire l’image.')),type,quality));
}
function pdfFromJpeg(bytes,width,height){
  const encoder=new TextEncoder(),chunks=[];let size=0;const offsets=[0];
  function push(v){const b=typeof v==='string'?encoder.encode(v):v;chunks.push(b);size+=b.length;}
  function obj(n,body){offsets[n]=size;push(n+' 0 obj\n'+body+'\nendobj\n');}
  push('%PDF-1.4\n');
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  offsets[4]=size;
  push('4 0 obj\n<< /Type /XObject /Subtype /Image /Width '+width+' /Height '+height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+bytes.length+' >>\nstream\n');
  push(bytes);push('\nendstream\nendobj\n');
  const cmds='q\n842 0 0 595 0 0 cm\n/Im0 Do\nQ\n';
  obj(5,'<< /Length '+encoder.encode(cmds).length+' >>\nstream\n'+cmds+'endstream');
  const xref=size;
  push('xref\n0 6\n0000000000 65535 f \n');
  for(let i=1;i<=5;i++)push(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
  push('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
  return new Blob(chunks,{type:'application/pdf'});
}
export async function exportMap({map,format,network,budget,selectedId,accessName,
  stats,colorMode,allowed,showStairs,showContext,showStops,sourceDate}){
  if(!map||!stats||!Number.isFinite(stats.total))throw Error('Lancez d’abord le calcul des cheminements.');
  await whenRendered(map);
  const capture=collectCanvases(map);
  const date=sourceDate?new Date(sourceDate):null;
  const readableDate=date&&!Number.isNaN(date.getTime())?date.toLocaleDateString('fr-FR'):'non précisée';
  const img=compose(capture,{network,budget,selectedId,accessName,stats,colorMode,
    allowed,showStairs,showContext,showStops,sourceDate:readableDate},map);
  const slug=String(accessName||'acces').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase().slice(0,55);
  const name='carte_anglet_'+network+'_'+slug+'_'+budget+'s';
  if(format==='png'){
    save(await blobFromCanvas(img,'image/png'),name+'.png');
  }else if(format==='pdf'){
    const jpeg=await blobFromCanvas(img,'image/jpeg',0.94);
    const bytes=new Uint8Array(await jpeg.arrayBuffer());
    save(pdfFromJpeg(bytes,img.width,img.height),name+'.pdf');
  }else throw Error('Format cartographique non reconnu.');
}
