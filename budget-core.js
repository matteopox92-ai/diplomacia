export const ASSETS=['denaro','pelle','oro','petrolio','nte'];
export const BUILDINGS=[['scuole','Scuole'],['strade','Strade'],['basi','Basi militari'],['ospedali','Ospedali']];
export const COSTS={scuole:[100000,400,440,0,300],strade:[100000,500,0,400,400],basi:[120000,300,0,400,400],ospedali:[110000,0,440,300,500]};
export function number(raw,{integer=false,max=1e12}={}) {
 if(raw===''||raw===null||raw===undefined)return null;
 const n=Number(raw);if(!Number.isFinite(n)||n<0||n>max||(integer&&!Number.isSafeInteger(n)))throw Error('Usa valori non negativi e validi'+(integer?' (edifici interi)':''));return n;
}
const zero=()=>ASSETS.map(()=>0);
export function basket(counts,costs){
 const total=zero();for(const [k] of BUILDINGS){const n=number(counts[k],{integer:true,max:1e7});if(n===null)throw Error('Completa tutti i conteggi degli edifici');
 ASSETS.forEach((_,i)=>{const c=number(costs[k][i]);if(c===null)throw Error('Completa tutti i costi unitari');total[i]+=n*c;});}return total;
}
export function equivalent(values,prices){let sum=values[0];for(let i=1;i<5;i++){if(values[i]===0)continue;const p=number(prices[i]);if(p===null)return null;sum+=values[i]*p;}return sum;}
export function calculate(input){
 const rate=number(input.rate,{max:100});const days=number(input.days,{integer:true,max:3650});if(rate===null||days===null||days<1)throw Error('Indica mantenimento e orizzonte da 1 a 3650 giorni');
 const capital=basket(input.current,input.costs);const base=capital.map(x=>x*rate/100);
 const financial=input.financial.map(row=>row.map(x=>number(x)));
 const results=input.plans.map(plan=>{
  const initial=basket(plan.add,input.costs);const added=initial.map(x=>x*rate/100);const upkeep=base.map((x,i)=>x+added[i]);
  const benefit=plan.benefit.map(x=>number(x));
  const assets=ASSETS.map((name,i)=>{
   const [stock,income,other]=financial[i];const b=benefit[i];
   const net=income===null||other===null||b===null?null:income-other-upkeep[i]+b;
   const remaining=stock===null?null:stock-initial[i];
   const affordable=stock===null?null:remaining>=0;
   const projected=remaining===null||net===null?null:remaining+net*days;
   const runway=remaining===null||net===null?null:remaining<0?0:net<0?remaining/-net:Infinity;
   return {name,initial:initial[i],added:added[i],upkeep:upkeep[i],benefit:b,net,remaining,affordable,projected,runway};
  });
  const initialValue=equivalent(initial,input.prices);const addedValue=equivalent(added,input.prices);
  const benefitValue=benefit.some(x=>x===null)?null:equivalent(benefit,input.prices);
  const marginal=addedValue===null||benefitValue===null?null:benefitValue-addedValue;
  const payback=initialValue===null||marginal===null?null:initialValue===0?0:marginal>0?initialValue/marginal:Infinity;
  const knownRuns=assets.map(x=>x.runway).filter(x=>x!==null);
  const partial=assets.some(x=>x.runway===null);
  const runway=knownRuns.length?Math.min(...knownRuns):null;
  const fail=assets.find(x=>x.affordable===false);
  const affordability=fail?'insufficiente':assets.some(x=>x.affordable===null)?'incompleta':'coperta';
  return {name:plan.name,assets,initialValue,addedValue,benefitValue,marginal,payback,runway,partial,affordability,
   totalCost:initial.map((x,i)=>x+upkeep[i]*days),additionalCost:initial.map((x,i)=>x+added[i]*days)};
 });
 return {base,capital,days,rate,results};
}
