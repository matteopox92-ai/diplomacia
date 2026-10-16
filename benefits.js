(function(root){
 'use strict';
 const validIndex=n=>Number.isInteger(n)&&n>=0&&n<=11;
 function healthRate(index){if(!validIndex(index))throw Error('Indice salute non valido.');return index===11?7:index===10?6:index>=7?5:index>=4?4:3;}
 function developmentBonus(index,diamond=false){if(!validIndex(index))throw Error('Indice sviluppo non valido.');return index===11?(diamond?.4:.3):index*(diamond?.03:.02);}
 function validate(n,min,max,label){if(!Number.isFinite(n)||n<min||n>max)throw Error(label+' non valido.');}
 // hpPerPill: HP ridati da una pillola (ipotesi 1, non verificata nel codice del gioco: modificabile).
 function health({current,target,turns,days=1,premium=100,minutes=10,hpPerPill=1}){
  validate(turns,0,1e9,'Numero turni');if(!Number.isSafeInteger(turns))throw Error('I turni devono essere interi.');validate(days,.01,3660,'Periodo');validate(premium,0,100,'Quota Premium');validate(minutes,.1,1440,'Intervallo');validate(hpPerPill,.01,100,'HP per pillola');
  const before=healthRate(current),after=healthRate(Math.max(current,target));
  const consumptionBefore=Math.max(0,100-before*minutes/6),consumptionAfter=Math.max(0,100-after*minutes/6);
  const eligible=turns*premium/100,pills=(consumptionBefore-consumptionAfter)*eligible/hpPerPill;
  return {before,after,eligible,consumptionBefore,consumptionAfter,pills,diamonds:pills/5,pillsPerDay:pills/days,diamondsPerDay:pills/5/days};
 }
 function development({current,target,production,days=1,additive=0}){
  validate(days,.01,3660,'Periodo');validate(additive,0,1000,'Altri bonus');
  if(!Array.isArray(production)||production.length!==5)throw Error('Indica le cinque produzioni.');
  return production.map((value,i)=>{
   const before=developmentBonus(current,i===0),after=developmentBonus(Math.max(current,target),i===0),rate=(after-before)/(1+before+additive/100);
   if(value===null)return {missing:true,before,after,rate};validate(value,0,1e15,'Produzione');
   const increase=value*rate;return {missing:false,before,after,rate,value,increase,total:value+increase,perDay:increase/days};
  });
 }
 root.DipBenefits={healthRate,developmentBonus,health,development};
})(globalThis);
