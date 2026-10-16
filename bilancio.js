import {ASSETS,BUILDINGS,COSTS,calculate} from './budget-core.js';
const labels=['Denaro','Pelle','Oro','Petrolio','NTE'],countFields={scuole:'scuole',strade:'strade',basi:'basi_militari',ospedali:'ospedali'};
const $=id=>document.getElementById(id),fmt=n=>n===null?'Dati mancanti':new Intl.NumberFormat('it-IT',{maximumFractionDigits:2}).format(n);
const input=(id,label,value='',integer=false)=>`<label>${label}<input id="${id}" type="number" min="0" max="${integer?10000000:1e12}" step="${integer?'1':'any'}" value="${value}"></label>`;
$('counts').innerHTML=BUILDINGS.map(([k,l])=>input('count-'+k,l,'',true)).join('');
$('costs').innerHTML='<caption>Costi unitari di costruzione</caption><thead><tr><th>Edificio</th>'+labels.map(l=>'<th>'+l+'</th>').join('')+'</tr></thead><tbody>'+BUILDINGS.map(([k,l])=>'<tr><th>'+l+'</th>'+ASSETS.map((a,i)=>'<td>'+input('cost-'+k+'-'+i,l+' · '+labels[i],COSTS[k][i])+'</td>').join('')+'</tr>').join('')+'</tbody>';
$('prices').innerHTML=labels.slice(1).map((l,i)=>input('price-'+(i+1),'Prezzo unitario · '+l)).join('');
$('finance').innerHTML='<caption>Disponibilità e flussi giornalieri</caption><thead><tr><th>Risorsa</th><th>In cassa</th><th>Entrate / giorno (tassa della provincia)</th><th>Altre spese / giorno</th></tr></thead><tbody>'+labels.map((l,i)=>'<tr><th>'+l+'</th>'+['stock','income','out'].map(t=>'<td>'+input(t+'-'+i,l+' · '+({stock:'scorta',income:'entrate / giorno',out:'altre uscite / giorno'}[t]))+'</td>').join('')+'</tr>').join('')+'</tbody>';
$('plans').innerHTML=['A','B'].map(p=>'<div class="plan"><h3>Piano '+p+'</h3><label>Nome del piano<input id="name-'+p+'" maxlength="60" value="Piano '+p+'"></label><div class="fields">'+BUILDINGS.map(([k,l])=>input('add-'+p+'-'+k,l+' aggiuntive · '+p,0,true)).join('')+'</div><details><summary>Entrate in più / giorno (facoltativo)</summary>'+labels.map((l,i)=>input('benefit-'+p+'-'+i,l+' in più / giorno')).join('')+'</details></div>').join('');
const v=id=>$(id).value;
function model(){return {rate:v('rate'),days:v('days'),current:Object.fromEntries(BUILDINGS.map(([k])=>[k,v('count-'+k)])),costs:Object.fromEntries(BUILDINGS.map(([k])=>[k,ASSETS.map((_,i)=>v('cost-'+k+'-'+i))])),prices:[1,...[1,2,3,4].map(i=>v('price-'+i))],financial:ASSETS.map((_,i)=>['stock','income','out'].map(t=>v(t+'-'+i))),plans:['A','B'].map(p=>({name:v('name-'+p)||'Piano '+p,add:Object.fromEntries(BUILDINGS.map(([k])=>[k,v('add-'+p+'-'+k)])),benefit:ASSETS.map((_,i)=>v('benefit-'+p+'-'+i)||'0')}))};}
// Le entrate in più sono facoltative: vuote = 0. Il rientro si mostra solo se ne è stata inserita almeno una.
const hasBenefit=p=>ASSETS.some((_,i)=>Number(v('benefit-'+p+'-'+i))>0);
function cell(row,value,tag='td',cls){const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;row.append(el);}
const dash=n=>n===null||n===undefined?'—':fmt(n),days=n=>n===null?'—':n===Infinity?'non finisce':n===0?'subito':n<1?'meno di un giorno':Math.floor(n)===1?'1 giorno':fmt(Math.floor(n))+' giorni';
let view='A';
// Situazione di oggi (nessun investimento) calcolata come gli altri piani, per la tabella.
function today(result){const fin=model().financial;return {name:'Oggi',assets:ASSETS.map((_,i)=>{const [stock,income,out]=fin[i].map(x=>x===''?null:Number(x));const net=income===null||out===null?null:income-out-result.base[i];return {initial:0,upkeep:result.base[i],net,projected:stock===null||net===null?null:stock+net*result.days,runway:stock===null||net===null?null:net<0?stock/-net:Infinity};})};}
function render(){try{
 if([...document.querySelectorAll('input[type="number"]')].some(el=>!el.checkValidity()))throw Error('Controlla i campi: quantità intere per gli edifici, valori non negativi e orizzonte valido.');
 const result=calculate(model());$('error').textContent='';$('summary').replaceChildren();
 result.results.forEach((s,k)=>{const p=['A','B'][k],card=document.createElement('div');card.className='plan';const h=document.createElement('h3');h.textContent=s.name;card.append(h);
  const metric=document.createElement('div');metric.className='metric';metric.textContent=s.initialValue===null?fmt(s.assets[0].initial)+' denaro + risorse':fmt(s.initialValue);card.append(metric);
  const sub=document.createElement('p');sub.className='muted';sub.textContent=s.initialValue===null?'Costo di costruzione (prezzi delle risorse mancanti)':'Costo di costruzione in denaro, risorse incluse ai prezzi di mercato';card.append(sub);
  const short=s.assets.map((a,i)=>a.affordable===false?labels[i]:null).filter(Boolean);
  const first=s.assets.map((a,i)=>({i,r:a.runway})).filter(x=>x.r!==null&&x.r!==Infinity).sort((a,b)=>a.r-b.r)[0];
  const lines=[['La cassa basta per costruire?',short.length?'No, manca: '+short.join(', '):s.affordability==='coperta'?'Sì':'Compila la cassa'],['Mantenimento in più / giorno',s.addedValue===null?fmt(s.assets[0].added)+' denaro + risorse':fmt(s.addedValue)],['Prima risorsa a finire',s.assets.every(a=>a.runway===null)?'Compila cassa ed entrate':first?labels[first.i]+' tra '+days(first.r):'Nessuna: i saldi reggono'],['Rientro della spesa',!hasBenefit(p)?'Inserisci le entrate in più del piano':s.payback===null?'Servono i prezzi':s.payback===Infinity?'Non rientra':s.payback===0?'Nessuna spesa':fmt(Math.ceil(s.payback))+' giorni']];
  for(const [label,value] of lines){const line=document.createElement('div');line.className='result-line';const a=document.createElement('span');a.textContent=label;const b=document.createElement('strong');b.textContent=value;line.append(a,b);card.append(line);}$('summary').append(card);});
 // Tabella compatta: una riga per risorsa, scelta tra Oggi, Piano A e Piano B.
 const views={O:today(result),A:result.results[0],B:result.results[1]};
 const tabs=$('compare-tabs');tabs.replaceChildren(...Object.entries(views).map(([k,s])=>{const b=document.createElement('button');b.type='button';b.textContent=s.name;b.setAttribute('aria-pressed',k===view);b.onclick=()=>{view=k;render();};return b;}));
 const s=views[view],table=$('compare');table.replaceChildren();const caption=document.createElement('caption');caption.textContent=s.name+' · al giorno e dopo '+result.days+' giorni';table.append(caption);
 const head=document.createElement('thead'),hr=document.createElement('tr');['Risorsa','Costo di costruzione','Mantenimento / giorno','Saldo / giorno','In cassa tra '+result.days+' giorni','Finisce tra'].forEach(t=>cell(hr,t,'th'));head.append(hr);table.append(head);
 const body=document.createElement('tbody');
 s.assets.forEach((a,i)=>{const tr=document.createElement('tr');cell(tr,labels[i],'th');cell(tr,dash(a.initial));cell(tr,dash(a.upkeep));cell(tr,a.net===null?'—':(a.net>0?'+':'')+fmt(a.net),'td',a.net<0?'neg':a.net>0?'pos':'');cell(tr,dash(a.projected),'td',a.projected<0?'neg':'');cell(tr,days(a.runway),'td',a.runway!==null&&a.runway!==Infinity?'warn':'');body.append(tr);});
 table.append(body);
 }catch(e){$('error').textContent=e.message;$('summary').replaceChildren();$('compare').replaceChildren();}}
document.querySelectorAll('input').forEach(el=>el.addEventListener('input',render));
$('zero-flows').onclick=()=>{ASSETS.forEach((_,i)=>{ $('income-'+i).value=0;$('out-'+i).value=0;});render();};
let snapshots=[],sharedTime='';
$('load-province').disabled=true;
fetch('/api/snapshot',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
 const snap=data.history?.at(-1);if(!snap?.items?.length)throw Error();snapshots=snap.items;sharedTime=snap.fetchedAt||snap.date;
 for(const p of snapshots){const o=document.createElement('option');o.value=p.name;o.textContent=p.name;$('province').append(o);}
}).catch(()=>{$('source').textContent='Nessuna fotografia delle province: apri il gioco in Firefox.';});
// Prezzi delle risorse dal mercato raccolto: media delle vendite degli ultimi 7 giorni (ponderata sulle quantità).
fetch('/api/market').then(r=>r.ok?r.json():null).then(m=>{
 if(!m?.series)return;const keys=['deri','altin','petrol','nte'],from=Date.now()-7*86400000,used=[];
 keys.forEach((k,i)=>{const pts=(m.series[k]||[]).filter(p=>Date.parse(p.t)>=from&&p.vwap&&p.volume);const vol=pts.reduce((s,p)=>s+p.volume,0);if(!vol||$('price-'+(i+1)).value!=='')return;$('price-'+(i+1)).value=Math.round(pts.reduce((s,p)=>s+p.vwap*p.volume,0)/vol*100)/100;used.push(labels[i+1]);});
 if(used.length){$('price-note').textContent='Prezzi dal mercato: media delle vendite degli ultimi 7 giorni.';render();}
}).catch(()=>{});
$('province').onchange=()=>{$('load-province').disabled=!$('province').value;};
const day=d=>new Date(d+'T12:00:00Z').toLocaleDateString('it-IT',{day:'numeric',month:'short'});
$('load-province').onclick=async()=>{
 const p=snapshots.find(p=>p.name===v('province'));if(!p)return;
 for(const [k] of BUILDINGS){const n=p[countFields[k]];if(!Number.isSafeInteger(n)||n<0){$('source').textContent='Fotografia incompleta: verifica i conteggi.';return;}}
 for(const [k] of BUILDINGS)$('count-'+k).value=p[countFields[k]];
 const notes=['Edifici: fotografia '+(sharedTime?new Date(sharedTime).toLocaleString('it-IT'):'')+'.'];
 $('load-province').disabled=true;$('source').textContent='Leggo cassa, costi e gettito di '+p.name+'…';
 // Nell'estensione: entrate dal gettito raccolto, scorte e costi ufficiali letti ora dal gioco.
 try{
  const r=globalThis.browser?.runtime?await browser.runtime.sendMessage({action:'province',name:p.name}):null;
  if(r&&!r.ok)throw Error(r.error);
  const d=r?.detail;
  if(d?.counts)for(const [k] of BUILDINGS)$('count-'+k).value=d.counts[k];
  if(d?.costs)for(const [k] of BUILDINGS)ASSETS.forEach((_,i)=>{$('cost-'+k+'-'+i).value=d.costs[k][i];});
  if(d?.stock)d.stock.forEach((n,i)=>{if(n!==null)$('stock-'+i).value=n;});
  if(d)notes.push('Cassa'+(d.counts?', edifici':'')+(d.costs?' e costi ufficiali':'')+' letti ora dal gioco.');
  else if(r)notes.push('Cassa e costi non letti: '+r.detailError+'.');
  // Entrate della provincia: solo la parte della tassa provinciale (il gettito del gioco somma Stato e provincia).
  if(r?.income){const missing=[];r.income.amounts.forEach((n,i)=>{if(n===null||n===undefined){missing.push(labels[i]);return;}$('income-'+i).value=Math.round(n*100)/100;if($('out-'+i).value==='')$('out-'+i).value=0;});
   const period=r.income.days+(r.income.days===1?' giorno':' giorni')+' ('+day(r.income.from)+' – '+day(r.income.to)+')';
   if(missing.length<5)notes.push('Entrate / giorno: quota della tassa provinciale (p ÷ (Stato + provincia)) nella media del gettito di '+period+'. Altre uscite a zero: correggile se le conosci.');
   if(missing.length)notes.push('Aliquote Stato e provincia mancanti per '+missing.join(', ')+': entrate non compilate, perché il gettito ('+missing.map(l=>l+' '+fmt(r.income.gettito?.[labels.indexOf(l)]??null)).join(', ')+' / giorno) comprende anche la tassa dello Stato. Inseriscile a mano se le conosci.');}
  else if(r)notes.push('Entrate non compilate: '+(r.incomeError||'nessun gettito per questa provincia')+'.');
  if(d?.maintenance)notes.push('Mantenimento notturno indicato dal gioco: '+new Intl.NumberFormat('it-IT').format(d.maintenance[0])+' denaro.');
 }catch(e){notes.push('Dati automatici non disponibili: '+e.message+'.');}
 finally{$('load-province').disabled=false;}
 $('source').textContent=p.name+' · '+notes.join(' ');render();
};
const storageKey='dip_province_budget_v1';
$('save').onclick=()=>{try{const inputs=Object.fromEntries([...document.querySelectorAll('input')].map(el=>[el.id,el.value]));localStorage.setItem(storageKey,JSON.stringify({schema:1,inputs,source:$('source').textContent}));$('save-status').textContent='Salvato solo in questo browser.';}catch{$('save-status').textContent='Salvataggio non riuscito: memoria del browser non disponibile.';}};
$('restore').onclick=()=>{try{const data=JSON.parse(localStorage.getItem(storageKey));if(data?.schema!==1||!data.inputs)throw Error();for(const [id,value] of Object.entries(data.inputs)){const el=$(id);if(el?.tagName==='INPUT'&&typeof value==='string')el.value=value;}$('source').textContent='Salvataggio locale ripristinato. '+(data.source||'Verifica data e conteggi.');$('save-status').textContent='Salvataggio ripristinato; controlla date e parametri.';render();}catch{$('save-status').textContent='Nessun salvataggio valido disponibile.';}};
render();
