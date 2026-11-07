(function(root){
 'use strict';
 const aliases={'lombardia':'Lombardiya','venezia':'Venedik','marsiglia':'Marsilya','firenze':'Floransa'};
 const norm=s=>String(s).trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const fiscalToday=(now=Date.now())=>new Date(now+10800000).toISOString().slice(0,10);
 const MAX_ROWS=10000; // circa 300 province × 32 giorni
 function canonical(name,names){const key=norm(name),alias=aliases[key];return names.find(n=>norm(n)===key||n===alias)||null;}
 function clean(rows,items,now=Date.now()){
  if(rows===undefined)return [];
  // Limite per difesa: 32 giorni per ogni provincia conosciuta (non più un tetto fisso di 3000 righe, cioè 100 province).
  if(!Array.isArray(rows)||rows.length>Math.max(3000,items.length*32))throw Error('Gettito non valido.');
  const names=new Set(items.map(p=>p.name)),seen=new Set();
  return rows.map(r=>{
   if(!r||!names.has(r.name)||!/^\d{4}-\d{2}-\d{2}$/.test(r.day)||new Date(r.day+'T00:00:00Z').toISOString().slice(0,10)!==r.day||r.day>=fiscalToday(now)||Date.parse(r.day+'T00:00:00Z')<now-32*86400000||r.scope!=='state+region'||r.complete!==true||!Number.isSafeInteger(r.turns)||r.turns<0||r.turns>1e9)throw Error('Riga fiscale non valida.');
   const stamp=Date.parse(r.capturedAt);if(!Number.isFinite(stamp)||stamp>now+300000||stamp<now-32*86400000)throw Error('Data fiscale non valida.');
   if(!Array.isArray(r.amounts)||r.amounts.length!==5||r.amounts.some(n=>!Number.isFinite(n)||n<0||n>1e15))throw Error('Importi fiscali non validi.');
   const key=r.name+'|'+r.day;if(seen.has(key))throw Error('Gettito duplicato.');seen.add(key);
   const out={name:r.name,day:r.day,turns:r.turns,amounts:[...r.amounts],scope:'state+region',complete:true,capturedAt:new Date(stamp).toISOString()};
   for(const k of ['rates','prov'])if(r[k]!==undefined){if(!Array.isArray(r[k])||r[k].length!==5||r[k].some(n=>!Number.isFinite(n)||n<0||n>100))throw Error('Aliquote non valide.');out[k]=[...r[k]];}
   return out;
  });
 }
 function merge(...lists){const out=new Map();for(const rows of lists)for(const row of rows||[]){const key=row.name+'|'+row.day,old=out.get(key);if(!old||row.capturedAt>=old.capturedAt)out.set(key,row);}return [...out.values()].sort((a,b)=>b.day.localeCompare(a.day)||a.name.localeCompare(b.name)).slice(0,MAX_ROWS);}
 // Quota della provincia nel gettito, voce per voce: con aliquote additive (Stato s + provincia p) è p/(s+p).
 // null = aliquote mancanti; 0 se nessuna tassa è impostata (alla provincia non arriva nulla).
 function provinceShare(state,prov){return [0,1,2,3,4].map(i=>{const s=Number(state?.[i]),p=Number(prov?.[i]);if(!state||!prov||!Number.isFinite(s)||!Number.isFinite(p))return null;return s+p>0?p/(s+p):0;});}
 function latest(history,name){return merge(...history.map(s=>s.fiscal||[])).find(r=>r.name===name&&r.complete&&r.day<fiscalToday()&&Date.parse(r.day+'T00:00:00Z')>Date.now()-31*86400000)||null;}
 function defaults(row,score){const bonus=score===11?.3:score*.02;return {benefitDays:'1',benefitTurns:String(row.turns),...Object.fromEntries([1,2,3,4].map(i=>['production'+i,row.rates?.[i]>0&&row.rates[i]<100?String(row.amounts[i]/(row.rates[i]/100)*(1-row.rates[i]/100)*(1+bonus)):'']))};}
 root.DipFiscal={canonical,clean,merge,latest,defaults,fiscalToday,provinceShare};
})(globalThis);
