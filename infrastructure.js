(function(root){
 'use strict';
 const costs={scuole:[100000,400,440,0,300],strade:[100000,500,0,400,400],basi_militari:[120000,300,0,400,400],ospedali:[110000,0,440,300,500]};
 const labels=['Denaro','Pelle','Oro','Petrolio','NTE'];
 // Soglia osservata per l'indice «target»: il minimo della fascia nelle altre province (stima: D2 in verifica/formule.md).
 // Indice 10+ = N. 1 al mondo: bisogna superare tutte le altre province, il pari merito non basta.
 function threshold(items,province,field,target){
  if(target===11){const others=items.filter(p=>p!==province&&!(province?.name&&p.name===province.name)&&Number.isSafeInteger(p[field.key])&&p[field.key]>=0);return others.length?Math.max(...others.map(p=>p[field.key]))+1:null;}
  const band=items.filter(p=>p[field.score]===target&&Number.isSafeInteger(p[field.key])&&p[field.key]>=0);
  return band.length?Math.min(...band.map(p=>p[field.key])):null;
 }
 // unitCosts: costi di un edificio per tipo (modificabili nella pagina; valori del gioco in «costs»).
 function estimate(items,province,field,target,extra=0,unitCosts=costs){
  if(!costs[field.key]||!Number.isInteger(target)||target<0||target>11||!Number.isSafeInteger(extra)||extra<0||extra>10000000)throw Error('Scegli un indice valido e un margine intero non negativo.');
  const now=province[field.key],current=province[field.score];
  if(!Number.isSafeInteger(now)||now<0||!Number.isInteger(current))throw Error('Dati provinciali incompleti.');
  const reached=current>=target;
  const limit=reached?now:threshold(items,province,field,target);
  if(limit===null)return {missing:true};
  const needed=reached?0:Math.max(0,limit+extra-now);
  const all={...costs,...unitCosts},unit=all[field.key];const investment=unit.map(x=>x*needed),increase=investment.map(x=>x*.03);
  const maintenanceBefore=unit.map(x=>x*now*.03),maintenanceAfter=maintenanceBefore.map((x,i)=>x+increase[i]);
  const validTotals=Object.keys(costs).every(key=>Number.isSafeInteger(province[key])&&province[key]>=0);
  const provinceBefore=validTotals?labels.map((_,i)=>Object.keys(costs).reduce((sum,key)=>sum+all[key][i]*province[key],0)*.03):null;
  const provinceAfter=provinceBefore?provinceBefore.map((x,i)=>x+increase[i]):null;
  return {missing:false,reached,threshold:limit,needed,now,current,target,unit,investment,increase,maintenanceBefore,maintenanceAfter,provinceBefore,provinceAfter};
 }
 root.DipInfrastructure={costs,labels,threshold,estimate};
})(globalThis);
