(function(root){
 'use strict';
 // Effetto dello sviluppo sulla produzione della provincia, voce per voce (Denaro, Pelle, Oro, Petrolio, NTE).
 // Ordine del gioco (dettaglio guadagno fabbrica, factoryDetail): lordo → − tassa Stato − tassa provincia → + bonus sviluppo → … → netto.
 // Il bonus sviluppo si applica al netto dopo le tasse e non è tassato.
 // Quindi: lordo = gettito ÷ aliquota (Stato + provincia); aumento = lordo × (1 − aliquota) × (bonus nuovo − bonus attuale).
 const LABELS=['Denaro','Pelle','Oro','Petrolio','NTE'];
 // Testo del gioco (bonusModalDevDesc): fabbriche di diamanti +3% per livello (10+ = 40%), fabbriche di risorse +2% (10+ = 30%).
 // Il denaro tassato viene tutto dalle fabbriche di diamanti: Denaro al 3%/40%, Pelle, Oro, Petrolio e NTE al 2%/30%.
 function bonus(index,perLevel=2,special=30){if(!Number.isInteger(index)||index<0||index>11)throw Error('Indice sviluppo non valido.');return (index===11?special:index*perLevel)/100;}
 function check(n,max,label){if(!Number.isFinite(n)||n<0||n>max)throw Error(label+' non valido.');return n;}
 function compute({gettito,rates,current,target,maintenance=[0,0,0,0,0],perLevel=2,special=30,moneyPerLevel=3,moneySpecial=40}){
  if(!Array.isArray(gettito)||gettito.length!==5||!Array.isArray(rates)||rates.length!==5)throw Error('Servono gettito e aliquote delle cinque voci.');
  check(perLevel,100,'Bonus per livello');check(special,1000,'Bonus della fascia 10+');check(moneyPerLevel,100,'Bonus per livello del denaro');check(moneySpecial,1000,'Bonus della fascia 10+ del denaro');
  const to=Math.max(current,target);
  return LABELS.map((label,i)=>{
   const [pl,sp]=i===0?[moneyPerLevel,moneySpecial]:[perLevel,special],before=bonus(current,pl,sp),after=bonus(to,pl,sp);
   const upkeep=check(Number(maintenance[i])||0,1e15,'Mantenimento'),g=gettito[i],r=rates[i];
   if(g===null||g===undefined||r===null||r===undefined||r===''||Number(r)<=0||Number(r)>=100)return {label,missing:true,before,after,maintenance:upkeep};
   check(g,1e15,'Gettito di '+label);const rate=Number(r)/100;
   const gross=g/rate,afterTax=gross*(1-rate),bonusNow=afterTax*before,bonusNew=afterTax*after,increase=bonusNew-bonusNow;
   return {label,missing:false,gettito:g,rate:Number(r),before,after,gross,afterTax,bonusNow,bonusNew,increase,maintenance:upkeep,net:increase-upkeep};
  });
 }
 // Gettito medio giornaliero di una provincia dagli ultimi giorni conclusi (massimo 7) presenti nello storico.
 function averageGettito(history,name){
  const rows=root.DipFiscal.merge(...history.map(s=>s.fiscal||[])).filter(r=>r.name===name&&r.complete).sort((a,b)=>b.day.localeCompare(a.day)).slice(0,7);
  if(!rows.length)return null;
  return {days:rows.length,from:rows.at(-1).day,to:rows[0].day,amounts:[0,1,2,3,4].map(i=>rows.reduce((s,r)=>s+r.amounts[i],0)/rows.length),rates:rows.find(r=>Array.isArray(r.rates))?.rates||null};
 }
 root.DipPIL={LABELS,bonus,compute,averageGettito};
})(globalThis);
