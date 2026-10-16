
// Bonus sviluppo della provincia: diamanti +3% per livello, risorse +2%; 11 = fascia 10+ (40% e 30%), come nel gioco.
const devRate=(lv,diam)=>{lv=Math.min(11,Math.max(0,Math.round(Number(lv)||0)));return lv===11?(diam?.4:.3):lv*(diam?.03:.02);};
const storage={getItem(k){try{return localStorage.getItem(k)}catch(e){return null}},setItem(k,v){try{localStorage.setItem(k,v)}catch(e){}},removeItem(k){try{localStorage.removeItem(k)}catch(e){}}};const $=id=>document.getElementById(id);const ids=['resource','factory','province','development','edict','tax','salary','scribes','player','scientist','expert','actual','compare'];const coeff={gold:[24.837350,1.046605],leather:[90.209720,3.761137],oil:[39.593923,1.668225],nte:[60.070366,2.524993],diamonds:[1240.883164,51.717301]};const defaults={resource:'gold',factory:54,province:10,development:5,edict:3,tax:7,salary:100,scribes:true,player:68,scientist:151,expert:15,actual:'',compare:'total'};const fmt=n=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:2}).format(n);const read=()=>Object.fromEntries(ids.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).tagName==='SELECT'?$(id).value:$(id).value]));function calculate(p){let n=k=>Number(p[k])||0,diam=p.resource==='diamonds',b=Math.round(coeff[p.resource][0]+coeff[p.resource][1]*n('factory')),level=b*.0075*Math.max(0,n('player')-1),scientist=b*(diam?.0025:.005)*n('scientist'),subtotal=b+level+scientist,prov=subtotal*n('province')/100,gross=subtotal+prov,taxes=gross*n('tax')/100*(1-n('expert')/100),after=gross-taxes,dev=after*devRate(n('development'),diam),edict=after*n('edict')/100,before=after+dev+edict,scribe=before*(p.scribes?(diam?.2:.1):0),total=before+scribe,worker=total*Math.max(0,Math.min(100,n('salary')))/100;return {b,level,scientist,subtotal,prov,gross,taxes,after,dev,edict,before,scribe,total,worker}}function render(){const p=read(),c=calculate(p);const devPct=devRate(p.development,p.resource==='diamonds')*100;$('developmentBonus').value='+'+fmt(devPct)+'%';$('total').textContent=fmt(Math.round(c.total));$('worker').textContent=fmt(Math.round(c.worker));$('base').textContent=fmt(c.b);const steps=[['Produzione base',c.b],['Bonus livello giocatore',c.level],['Bonus scienziato',c.scientist],['Subtotale',c.subtotal],['Bonus provincia',c.prov],['Produzione lorda',c.gross],['Tasse effettive',-c.taxes],['Dopo tasse',c.after],['Bonus sviluppo ('+fmt(devPct)+'%)',c.dev],['Bonus editto',c.edict],['Prima degli Scribi',c.before],['Bonus Scribi',c.scribe],['Produzione totale',c.total],['Quota salario al lavoratore',c.worker]];$('steps').innerHTML=steps.map(([k,v])=>`<tr><td>${k}</td><td>${fmt(v)}</td></tr>`).join('');let actual=Number(p.actual);if(p.actual!==''){let predicted=Math.round(c[p.compare]),delta=predicted-actual,err=actual?Math.abs(delta)/actual*100:0;$('difference').innerHTML=`Previsto: <b>${fmt(predicted)}</b> · Reale: <b>${fmt(actual)}</b> · Scarto: <b class="${err<=1?'good':'bad'}">${fmt(delta)} (${fmt(err)}%)</b>`}else $('difference').textContent='Inserisci il valore reale per calcolare lo scostamento.';storage.setItem('diplomacia-params',JSON.stringify(p))}function renderHistory(){let a=JSON.parse(storage.getItem('diplomacia-history')||'[]');$('history').innerHTML=a.length?`<div style="overflow:auto"><table>${a.map((x,i)=>`<tr><td>${new Date(x.date).toLocaleDateString('it-IT')} · ${x.resource} L${x.factory}<br><small>Previsto ${fmt(x.predicted)} · Reale ${fmt(x.actual)} · Scarto ${fmt(x.error)}%</small></td><td><button data-index="${i}" class="load">Apri</button></td></tr>`).join('')}</table></div>`:'Nessuna verifica salvata.';document.querySelectorAll('.load').forEach(b=>b.onclick=()=>{let x=a[Number(b.dataset.index)];ids.forEach(id=>{if(x[id]!==undefined){if($(id).type==='checkbox')$(id).checked=x[id];else $(id).value=x[id]}});render();scrollTo({top:0,behavior:'smooth'})})}ids.forEach(id=>$(id).addEventListener('input',render));$('save').onclick=()=>{let p=read();if(p.actual===''){alert('Inserisci prima la produzione reale.');return}let c=calculate(p),predicted=Math.round(c[p.compare]),actual=Number(p.actual),error=actual?Math.abs(predicted-actual)/actual*100:0;let a=JSON.parse(storage.getItem('diplomacia-history')||'[]');a.unshift({...p,predicted,actual,error,date:new Date().toISOString()});storage.setItem('diplomacia-history',JSON.stringify(a));$('saved').textContent='Verifica salvata sul dispositivo.';renderHistory()};$('reset').onclick=()=>{Object.entries(defaults).forEach(([k,v])=>{if($(k).type==='checkbox')$(k).checked=v;else $(k).value=v});render()};$('clear').onclick=()=>{if(confirm('Eliminare tutte le verifiche salvate?')){storage.removeItem('diplomacia-history');renderHistory()}};$('export').onclick=()=>{let a=JSON.parse(storage.getItem('diplomacia-history')||'[]');if(!a.length){alert('Nessuna verifica da esportare.');return}let keys=['date',...ids,'predicted','error'];let csv=[keys.join(';'),...a.map(x=>keys.map(k=>String(x[k]??'').replaceAll(';',',')).join(';'))].join('\r\n');let url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));let link=document.createElement('a');link.href=url;link.download='verifiche-diplomacia.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};let stored;try{stored=JSON.parse(storage.getItem('diplomacia-params')||'null')}catch{}Object.entries({...defaults,...stored}).forEach(([k,v])=>{if($(k).type==='checkbox')$(k).checked=v;else $(k).value=v});render();renderHistory();


// Modulo indipendente: conserva le funzioni originali di produzione e verifica.
const yieldIds=['yieldPlayer','yieldScientist','yieldProvince','yieldDevelopment','yieldEdict','yieldTax','yieldExpert','yieldSalary','yieldScribes'];
const yieldMap={yieldPlayer:'player',yieldScientist:'scientist',yieldProvince:'province',yieldDevelopment:'development',yieldEdict:'edict',yieldTax:'tax',yieldExpert:'expert',yieldSalary:'salary',yieldScribes:'scribes'};
function syncYieldFromProduction(){for(const [y,src] of Object.entries(yieldMap)){if($(y).type==='checkbox')$(y).checked=$(src).checked;else $(y).value=$(src).value}renderYield()}
function renderYield(){
 const a=Number($('simStart').value),b=Number($('simTarget').value),resource=$('simResource').value;
 const data={resource,factory:a};for(const [y,k] of Object.entries(yieldMap))data[k]=$(y).type==='checkbox'?$(y).checked:$(y).value;
 const nums=[a,b,...yieldIds.filter(id=>id!=='yieldScribes').map(id=>Number($(id).value))];
 const ok=nums.every(Number.isFinite)&&a>=1&&b>a&&b<=200&&Number(data.player)>=1&&Number(data.scientist)>=0&&Number(data.development)>=0&&Number(data.development)<=11&&Number(data.expert)>=0&&Number(data.expert)<=100&&Number(data.salary)>=0&&Number(data.salary)<=100;
 if(!ok){$('yieldError').textContent='Controlla livelli e parametri della resa.';['yieldBefore','yieldAfter','yieldDelta','yieldPercent'].forEach(id=>$(id).textContent='—');$('yieldDetails').innerHTML='';return null}
 $('yieldError').textContent='';
 const before=calculate(data),after=calculate({...data,factory:b});
 const delta=after.total-before.total,workerDelta=after.worker-before.worker;
 const pct=before.total?100*delta/before.total:0;
 $('yieldBefore').textContent=fmt(Math.round(before.total));$('yieldAfter').textContent=fmt(Math.round(after.total));
 $('yieldDelta').textContent=(delta>=0?'+':'')+fmt(Math.round(delta));$('yieldPercent').textContent=(pct>=0?'+':'')+fmt(pct)+'%';
 const lines=[['Produzione base',before.b,after.b],['Produzione lorda',before.gross,after.gross],['Produzione totale per turno',before.total,after.total],['Quota lavoratore per turno',before.worker,after.worker]];
 $('yieldDetails').innerHTML='<tr><th>Voce</th><th>Prima · L'+a+'</th><th>Dopo · L'+b+'</th></tr>'+lines.map(([label,x,y])=>'<tr><td>'+label+'</td><td>'+fmt(Math.round(x))+'</td><td>'+fmt(Math.round(y))+'</td></tr>').join('')+'<tr><td><b>Guadagno quota lavoratore</b></td><td colspan="2"><b>+'+fmt(Math.round(workerDelta))+' / turno</b></td></tr>';
 return {before:before.total,after:after.total,delta,pct,workerDelta};
}
yieldIds.forEach(id=>$(id).addEventListener('input',()=>{renderYield();saveYield()}));
function saveYield(){const obj={};for(const id of yieldIds)obj[id]=$(id).type==='checkbox'?$(id).checked:$(id).value;storage.setItem('diplomacia-yield-params',JSON.stringify(obj))}
$('yieldSync').onclick=()=>{syncYieldFromProduction();saveYield()};
let savedYield;try{savedYield=JSON.parse(storage.getItem('diplomacia-yield-params')||'null')}catch(e){}
if(savedYield){for(const id of yieldIds)if(savedYield[id]!==undefined){if($(id).type==='checkbox')$(id).checked=savedYield[id];else $(id).value=savedYield[id]}}else syncYieldFromProduction();
// simInterval, simXpTurn, simHpPill: ipotesi non verificate nel codice del gioco (D5-D7), modificabili.
const simIds=['simResource','simTargetXP','simStart','simTarget','simXP','simPremium','simFree','simPremHealth','simFreeHealth','simPremHP','simFreeHP','simInterval','simXpTurn','simHpPill'];
const simDefaults={simResource:'gold',simTargetXP:'',simStart:'50',simTarget:'60',simXP:'',simPremium:'5',simFree:'10',simPremHealth:'5',simFreeHealth:'5',simPremHP:'0',simFreeHP:'0',simInterval:'10',simXpTurn:'100',simHpPill:'1'};
const simResourceLabels={gold:'Oro',leather:'Pelli',oil:'Petrolio',nte:'NTE',diamonds:'Diamanti'};
const simInt=id=>Number($(id).value);
const simFmt=n=>Number(n).toLocaleString('it-IT',{maximumFractionDigits:2});
const simThreshold=(level,resource)=>Math.floor((resource==='diamonds'?25000/3:2500)*Math.expm1(level*Math.log(1.06)));
const simRange=(x,y)=>x===y?simFmt(x):simFmt(x)+'–'+simFmt(y);
function simulateFactory(){
 const a=simInt('simStart'),b=simInt('simTarget'),p=simInt('simPremium'),f=simInt('simFree'),rp=simInt('simPremHealth'),rf=simInt('simFreeHealth'),hp=simInt('simPremHP'),hf=simInt('simFreeHP');
 const resource=$('simResource').value,targetText=$('simTargetXP').value.trim(),xpText=$('simXP').value.trim();
 const interval=Number($('simInterval').value),xpTurn=Number($('simXpTurn').value),hpPill=Number($('simHpPill').value);
 const currentXP=xpText===''?simThreshold(a-1,resource):Number(xpText);
 const targetXP=targetText===''?simThreshold(b-1,resource):Number(targetText);
 const valid=[a,b,p,f,rp,rf,hp,hf,currentXP,targetXP].every(Number.isFinite)&&[a,b,p,f,rp,rf,hp,hf].every(Number.isInteger)&&a>=1&&b>a&&b<=200&&p>=0&&f>=0&&p+f>0&&p<=10000&&f<=10000&&hp>=0&&hp<=100&&hf>=0&&hf<=100&&currentXP>=0&&targetXP>=0&&interval>=1&&interval<=1440&&xpTurn>0&&xpTurn<=1e6&&hpPill>0&&hpPill<=100;
 $('simError').textContent='';
 if(!valid){$('simError').textContent='Inserisci livelli validi, HP da 0 a 100 e almeno un giocatore.';return null}
 const missing=Math.max(0,targetXP-currentXP),jobs=Math.ceil(missing/xpTurn);
 // HP: massimo 100; i non Premium lavorano automaticamente appena raggiungono 100.
 // Se iniziano con 100 HP possono lavorare subito (t=0).
 const freeTurns=t=>t<0?0:Math.floor((hf+Math.floor(t/6)*rf)/100);
 // I Premium hanno un turno disponibile all'avvio e poi uno ogni «interval» minuti (10 nel gioco, modalità automatica).
 const premiumTurns=t=>t<0?0:Math.floor(t/interval)+1;
 const available=t=>f*freeTurns(t)+p*premiumTurns(t);
 let time=0;
 if(jobs>0){
  let lo=0,hi=1,limit=10*365*24*60;
  while(available(hi)<jobs&&hi<limit)hi=Math.min(limit,hi*2);
  if(available(hi)<jobs){$('simError').textContent='Obiettivo troppo distante per il limite di simulazione (10 anni).';return null}
  while(lo<hi){const mid=Math.floor((lo+hi)/2);if(available(mid)>=jobs)hi=mid;else lo=mid+1}
  time=lo;
 }
 const freeBefore=time===0?0:freeTurns(time-1),premBefore=time===0?0:premiumTurns(time-1);
 const prior=jobs===0?0:f*freeBefore+p*premBefore;
 let remaining=Math.max(0,jobs-prior);
 // Precedenza ai non Premium quando più turni sono disponibili nello stesso minuto.
 const newFree=jobs===0?0:(freeTurns(time)>freeBefore?Math.min(f,remaining):0);
 remaining-=newFree;
 const newPremium=jobs===0?0:(premiumTurns(time)>premBefore?Math.min(p,remaining):0);
 const usedFree=jobs===0?0:f*freeBefore+newFree;
 const usedPremium=jobs===0?0:p*premBefore+newPremium;
 const fullTurns=jobs===0?0:premBefore;
 // Calcolo per un Premium: tick HP a 6 minuti; turni a 10 minuti.
 // Prima di ogni turno, acquista esattamente gli HP mancanti. Gli HP non superano 100.
 const cumulative=[0];
 if(p>0&&usedPremium>0){
  let natural=hp,previousTicks=0,pills=0;
  for(let j=0;j<fullTurns+(newPremium>0?1:0);j++){
   const tick=Math.floor(j*interval/6);
   natural=Math.min(100,natural+(tick-previousTicks)*rp);
   previousTicks=tick;
   pills+=Math.ceil((100-natural)/hpPill);
   natural=0;
   cumulative.push(pills);
  }
 }
 // Equa ripartizione dei turni dell'ultimo istante.
 const perPlayer=[];
 for(let i=0;i<p;i++){
  const count=fullTurns+(i<newPremium?1:0);
  const pills=cumulative[count]||0;
  perPlayer.push({turns:count,pills,diamonds:Math.ceil(pills/5)});
 }
 const pillCount=perPlayer.reduce((sum,x)=>sum+x.pills,0);
 const pillDiamonds=perPlayer.reduce((sum,x)=>sum+x.diamonds,0);
 const upgradeDiamonds=(b-a)*(5*a+5*b+15)/2;
 const timeString=`${Math.floor(time/1440)} g ${Math.floor(time%1440/60)} h ${time%60} min`;
 const minPill=perPlayer.length?Math.min(...perPlayer.map(x=>x.pills)):0;
 const maxPill=perPlayer.length?Math.max(...perPlayer.map(x=>x.pills)):0;
 const minDiam=perPlayer.length?Math.min(...perPlayer.map(x=>x.diamonds)):0;
 const maxDiam=perPlayer.length?Math.max(...perPlayer.map(x=>x.diamonds)):0;
 $('simTime').textContent=timeString;
 $('simJobs').textContent=simFmt(jobs);
 $('simMissing').textContent=simFmt(missing);
 $('simPillDiamonds').textContent=simFmt(pillDiamonds)+' 💎';
 $('simUpgradeDiamonds').textContent=simFmt(upgradeDiamonds)+' 💎';
 $('simPerPremium').textContent=simRange(minDiam,maxDiam)+' 💎';
 const details=[
  ['Tipo di fabbrica',simResourceLabels[resource]],
  ['Formula XP',resource==='diamonds'?'Diamanti · 25.000/3 × (1,06^L − 1)':'Risorse · 2.500 × (1,06^L − 1)'],
  ['Soglia XP obiettivo',simFmt(targetXP)+(targetText?' (manuale)':' (automatica)')],
  ['XP iniziali fabbrica',simFmt(currentXP)],
  ['XP mancanti',simFmt(missing)],
  ['XP prodotti dai turni',simFmt(jobs*xpTurn)],
  ['Tempo totale in minuti',simFmt(time)+' min'],
  ['Giocatori Premium',simFmt(p)],
  ['Giocatori non Premium',simFmt(f)],
  ['Turni Premium complessivi',simFmt(usedPremium)],
  ['Turni Premium per giocatore',simRange(p?Math.floor(usedPremium/p):0,p?Math.ceil(usedPremium/p):0)],
  ['Turni non Premium complessivi',simFmt(usedFree)],
  ['Turni non Premium per giocatore',simRange(f?Math.floor(usedFree/f):0,f?Math.ceil(usedFree/f):0)],
  ['Pillole per giocatore Premium',simRange(minPill,maxPill)],
  ['Diamanti per giocatore Premium',simRange(minDiam,maxDiam)+' 💎'],
  ['Pillole Premium complessive',simFmt(pillCount)],
  ['Diamanti pillole complessivi',simFmt(pillDiamonds)+' 💎'],
  ['Diamanti potenziamento livelli',simFmt(upgradeDiamonds)+' 💎'],
  ['Diamanti complessivi',simFmt(pillDiamonds+upgradeDiamonds)+' 💎']
 ];
 $('simDetails').innerHTML=details.map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('');
 $('simNotes').textContent=simFmt(xpTurn)+' XP alla fabbrica per turno; '+simFmt(hpPill)+' HP per pillola. Nell’ultimo istante precedenza ai non Premium. I costi per Premium possono variare di un turno: per questo compare un intervallo. Pillole acquistate in pacchetti da 5 per persona; potenziamenti separati. Il primo turno Premium è disponibile a t=0; successivi ogni '+simFmt(interval)+' minuti.';
 return {a,b,p,f,resource,missing,jobs,time,timeString,usedPremium,usedFree,pillCount,pillDiamonds,upgradeDiamonds,minDiam,maxDiam};
}
function renderSimulator(){
 const result=simulateFactory();
 renderYield();
 if(!result){['simTime','simJobs','simMissing','simPillDiamonds','simUpgradeDiamonds','simPerPremium'].forEach(id=>$(id).textContent='—');$('simDetails').innerHTML='';$('simNotes').textContent=''}
 storage.setItem('diplomacia-sim-params',JSON.stringify(Object.fromEntries(simIds.map(id=>[id,$(id).value]))));
 return result;
}
simIds.forEach(id=>$(id).addEventListener('input',renderSimulator));
$('simReset').onclick=()=>{Object.entries(simDefaults).forEach(([k,v])=>$(k).value=v);renderSimulator()};
$('simCopy').onclick=async()=>{const x=renderSimulator();if(!x)return;const content=`Diplomacia · ${simResourceLabels[x.resource]} · Fabbrica L${x.a} → L${x.b}\nGiocatori Premium: ${x.p} · Non Premium: ${x.f}\nXP mancanti: ${x.missing}\nTempo: ${x.timeString} (${x.time} minuti)\nTurni totali: ${x.jobs}\nTurni Premium: ${x.usedPremium} · Non Premium: ${x.usedFree}\nPillole totali: ${x.pillCount}\nDiamanti pillole: ${x.pillDiamonds}\nDiamanti per Premium: ${x.minDiam}–${x.maxDiam}\nDiamanti potenziamenti: ${x.upgradeDiamonds}`;try{await navigator.clipboard.writeText(content);$('simNotes').textContent='Simulazione copiata.'}catch(e){window.prompt('Copia il riepilogo:',content)}};
let simStored;try{simStored=JSON.parse(storage.getItem('diplomacia-sim-params')||'null')}catch(e){}
Object.entries({...simDefaults,...simStored}).forEach(([k,v])=>$(k).value=v);
renderSimulator();
function showScreen(name){$('homeScreen').classList.toggle('hidden',name!=='home');$('productionScreen').classList.toggle('hidden',name!=='production');$('productionRemainder').classList.toggle('hidden',name!=='production');$('growthScreen').classList.toggle('hidden',name!=='growth');window.scrollTo(0,0);storage.setItem('diplomacia-active-screen',name)}
// La navigazione usa collegamenti HTML nativi, indipendenti da JavaScript.

