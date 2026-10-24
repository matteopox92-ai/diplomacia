(async()=>{
const FIELDS=[{key:'scuole',score:'education_score',label:'Scuole',index:'Istruzione',icon:'🎓'},{key:'strade',score:'development_score',label:'Strade',index:'Sviluppo',icon:'🛣️'},{key:'basi_militari',score:'military_score',label:'Basi militari',index:'Militare',icon:'🛡️'},{key:'ospedali',score:'health_score',label:'Ospedali',index:'Salute',icon:'🏥'}];
const KEY='diplomacia_intelligence_history_v1';const $=id=>document.getElementById(id);const fmt=n=>Number(n||0).toLocaleString('it-IT',{maximumFractionDigits:2});const clone=o=>JSON.parse(JSON.stringify(o));
const loaded = await browser.runtime.sendMessage({action:'state'});
if(!loaded.ok) throw Error(loaded.error);
let history=loaded.state.history;
let knownSignature=DipCore.signature(history.at(-1).items);
async function commitSnapshot(snapshot) {
  const response=await browser.runtime.sendMessage({action:'history',history:[...history,snapshot].slice(-60),expectedSignature:knownSignature});
  if(!response.ok) throw Error(response.error);
  history=response.state.history;knownSignature=DipCore.signature(history.at(-1).items);
}
async function save() {
  try {const response=await browser.runtime.sendMessage({action:'history',history,expectedSignature:knownSignature});if(!response.ok)throw Error(response.error);history=response.state.history;knownSignature=DipCore.signature(history.at(-1).items);return true;}
  catch(e){$('syncStatus').textContent=e.message;return false;}
}
const latest=()=>history[history.length-1];const items=()=>latest().items;const field=()=>FIELDS.find(f=>f.key===$('kind').value)||FIELDS[0];let selected='';
function sorted(f){return [...items()].sort((a,b)=>(b[f.key]||0)-(a[f.key]||0)||a.name.localeCompare(b.name))}
function bands(f){let arr=sorted(f), out={};for(let i=0;i<arr.length;i++){let s=arr[i][f.score];(out[s]??=[]).push(arr[i])}return out}
function selectProvince(n){selected=n;$('provinceSearch').value=n;$('provinceSelect').value=n;renderProvince()}
function el(tag, text, className) {
  const element=document.createElement(tag);
  if(text!==undefined)element.textContent=String(text??'');
  if(className)element.className=className;
  return element;
}
function option(value,label){const n=el('option',label);n.value=String(value);return n;}
function stat(label,value){const n=el('div',undefined,'statline');n.append(el('span',label),el('b',value));return n;}
function tile(label,value){const n=el('div',undefined,'tile');n.append(el('small',label),el('strong',value));return n;}
function setupProvince(){
  const arr=[...items()].sort((a,b)=>a.name.localeCompare(b.name,'it'));
  $('provinceSelect').replaceChildren(...arr.map(p=>option(p.name,p.name)));
  $('provinceList').replaceChildren(...arr.map(p=>option(p.name,'')));
  if(!items().some(p=>p.name===selected))selected=arr.find(p=>p.name==='Venedik')?.name||arr[0]?.name;
  $('provinceSelect').value=selected;$('provinceSearch').value=selected;
  $('provCount').textContent=items().length+' province';
  $('kind').replaceChildren(...FIELDS.map(f=>option(f.key,f.label)));
  renderProvince();
}
function rankOf(p,f){return sorted(f).findIndex(x=>x.name===p.name)+1;}
// Soglie con la stessa regola del simulatore: per l'indice 10+ bisogna superare il N. 1 (pari merito non basta).
function threshold(f,target,p){return target>11?null:DipInfrastructure.threshold(items(),p,f,target);}
// Costi di un edificio: valori del gioco, modificabili nella pagina e salvati solo in questo browser.
const COSTS_KEY='dip_costs_v1';
function savedCosts(){try{const c=JSON.parse(localStorage.getItem(COSTS_KEY)||'{}');return Object.fromEntries(Object.entries(c).filter(([k,v])=>DipInfrastructure.costs[k]&&Array.isArray(v)&&v.length===5&&v.every(x=>Number.isFinite(x)&&x>=0)));}catch{return {};}}
function storeCosts(c){try{localStorage.setItem(COSTS_KEY,JSON.stringify(c));}catch{}}
function renderProvince(){
  const p=items().find(x=>x.name===selected);if(!p)return;
  $('provMeta').textContent=`${p.country_name||'Paese non indicato'} · ${fmt(p.player_count)} giocatori · ${p.region||''}`;
  $('cards').replaceChildren(...FIELDS.map(f=>{
    const n=p[f.key]||0,score=p[f.score]??'—',up=threshold(f,Number(score)+1,p),lo=threshold(f,Number(score),p);
    const card=el('div',undefined,'tile'),title=el('div');
    title.append(el('span',f.icon+' '),el('b',f.index));
    const value=el('strong',score===11?'10+':score),suffix=el('small',score===11?' · N. 1':' / 10');suffix.style.display='inline';suffix.style.fontSize='.85rem';value.append(suffix);
    card.append(title,value,stat(f.label,fmt(n)),stat('Posizione','#'+rankOf(p,f)),stat('Verso indice '+(Number(score)>=10?'10+':Number(score)+1),up===null?'Soglia non disponibile':'+'+fmt(Math.max(0,up-n))+'*'),stat('Margine sulla soglia attuale',lo===null?'—':fmt(Math.max(0,n-lo))+'*'));
    const bar=el('div',undefined,'bar'),fill=el('span');fill.style.width=Math.max(0,Math.min(100,Number(score)/11*100))+'%';bar.append(fill);card.append(bar);
    return card;
  }));
  const current=Number(p[field().score]||0);
  $('target').replaceChildren(...Array.from({length:12},(_,i)=>option(i,i===11?'Indice 10+ · N. 1 al mondo':'Indice '+i)));
  $('target').value=String(Math.min(11,current+1));renderSimulation();
}
function renderSimulation(){
 const p=items().find(x=>x.name===selected);if(!p)return;
 DipBenefitUI.prepare(p,field(),history);
 const out=$('simulation');out.replaceChildren();
 if(!latest().scoresSynced){out.append(el('p','Gli indici di questa fotografia non sono sincronizzati: aggiorna i dati prima di stimare il passaggio di indice.','note'));return;}
 let plan;try{
  if($('extra').value==='')throw Error('Indica un margine (0 se non ne vuoi aggiungere).');
  plan=DipInfrastructure.estimate(items(),p,field(),Number($('target').value),Number($('extra').value),savedCosts());
 }catch(e){out.append(el('p',e.message,'note'));return;}
 if(plan.missing){out.append(el('p','Nessuna provincia della fotografia occupa questo indice: non ci sono dati sufficienti per stimare quanti edifici servono.','note'));return;}
 const summary=el('div',undefined,'grid');
 summary.append(tile('Indice attuale → obiettivo',(plan.current===11?'10+':plan.current)+' → '+(plan.target===11?'10+':plan.target)),tile('Edifici da costruire',fmt(plan.needed)),tile('Costo costruzione · denaro',fmt(plan.investment[0])),tile('Aumento mantenimento · denaro / giorno','+'+fmt(plan.increase[0])));out.append(summary);
 out.append(el('p',plan.reached?'Hai già raggiunto o superato l’indice scelto: nessun edificio aggiuntivo richiesto.':'Edifici attuali: '+fmt(plan.now)+'. Soglia osservata per l’indice '+(plan.target===11?'10+':plan.target)+': '+fmt(plan.threshold)+'.','foot'));
 const wrap=el('div',undefined,'table-wrap');const table=el('table');table.style.width='100%';
 table.append(el('caption','Costo di costruzione e mantenimento provinciale'));
 const head=el('thead'),hr=el('tr');for(const label of ['Denaro / risorsa','Costo totale costruzione','Mantenimento attuale / giorno','Nuovo mantenimento / giorno','Differenza / giorno'])hr.append(el('th',label));head.append(hr);table.append(head);
 const body=el('tbody');DipInfrastructure.labels.forEach((label,i)=>{const row=el('tr');row.append(el('th',label),el('td',fmt(plan.investment[i])),el('td',plan.provinceBefore?fmt(plan.provinceBefore[i]):'Non disponibile'),el('td',plan.provinceAfter?fmt(plan.provinceAfter[i]):'Non disponibile'),el('td','+'+fmt(plan.increase[i])));body.append(row);});table.append(body);wrap.append(table);out.append(wrap);
 if(!plan.provinceBefore)out.append(el('p','Mantenimento provinciale non disponibile: mancano i conteggi di una o più infrastrutture.','note'));
 const details=el('details');details.style.margin='14px 0';details.append(el('summary','Costi per singolo edificio'));
 // Costi modificabili (D3: i valori fissi non sono verificabili dal codice del gioco): si applicano quando si esce dal campo.
 const f=field(),own=savedCosts(),grid=el('div',undefined,'grid');
 DipInfrastructure.labels.forEach((label,i)=>{const l=el('label',label+' per edificio'),inp=el('input');inp.type='number';inp.min='0';inp.step='any';inp.value=String(plan.unit[i]);inp.addEventListener('change',()=>{const v=Number(inp.value);if(inp.value===''||!Number.isFinite(v)||v<0)return;const c=savedCosts(),row=[...(c[f.key]||DipInfrastructure.costs[f.key])];row[i]=v;c[f.key]=row;storeCosts(c);renderSimulation();});l.append(inp);grid.append(l);});
 const reset=el('button','Ripristina i costi del gioco','secondary');reset.type='button';reset.addEventListener('click',()=>{const c=savedCosts();delete c[f.key];storeCosts(c);renderSimulation();});
 details.append(grid,el('p',own[f.key]?'Costi modificati da te, salvati solo in questo browser.':'Valori del gioco consultati il 15/10/2026: correggili se nel gioco sono diversi.','foot'),reset);if(own[f.key])details.open=true;out.append(details);
 DipBenefitUI.render(p,plan,field());
}
function renderWorld(){
  const k=$('worldSort').value,q=$('worldFilter').value.toLocaleLowerCase();
  const arr=[...items()].filter(p=>(p.name+' '+(p.country_name||'')).toLocaleLowerCase().includes(q)).sort((a,b)=>(b[k]||0)-(a[k]||0)||a.name.localeCompare(b.name));
  $('worldRows').replaceChildren(...arr.map((p,i)=>{
    const row=el('tr'),name=el('td'),link=el('a',p.name);link.href='#';link.dataset.p=p.name;name.append(link);
    row.append(el('td',i+1),name,el('td',p.country_name));
    for(const value of [p.scuole,p.strade,p.basi_militari,p.ospedali])row.append(el('td',fmt(value),'num'));
    row.append(el('td',[p.education_score,p.development_score,p.military_score,p.health_score].join(' / '),'num'));return row;
  }));
}
// Storico (4.2.4): nei menu Da/A tutte le fotografie delle ultime 5 ore e, prima, una al giorno dall'archivio giornaliero.
// Nell'estensione l'elenco dei giorni arriva dal motore e le province di un giorno si leggono solo quando servono;
// nel sito i giorni sono già nello storico (fotografie con daily: true).
let archiveList=null;const archiveItems=new Map();let timelineEntries=[],compareToken=0;
async function loadArchiveList(){try{const r=await browser.runtime.sendMessage({action:'archive-days'});if(r?.ok&&Array.isArray(r.days))archiveList=r.days;}catch{/* sito o motore non raggiungibile: restano i giorni dello storico */}}
function dailyLabel(e){const [y,m,g]=e.day.split('-');const t=Date.parse(e.fetchedAt||'');return g+'/'+m+'/'+y+' · giornaliera'+(Number.isFinite(t)?' (ore '+new Date(t).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Rome'})+')':'');}
function buildTimeline(){
  const recent=history.filter(h=>!h.daily);
  const inline=history.filter(h=>h.daily&&h.day).map(h=>({day:h.day,fetchedAt:h.fetchedAt||null,items:h.items}));
  timelineEntries=DipCore.timeline(recent,archiveList||inline,Date.now()).map(e=>e.source==='recent'
    ?{...e,snap:recent[e.index],key:'r'+(recent[e.index].fetchedAt||recent[e.index].date),label:recent[e.index].date}
    :{...e,key:'d'+e.day,label:dailyLabel(e)});
}
async function itemsOf(e){
  if(e.snap)return e.snap.items;
  if(e.items)return e.items;
  if(archiveItems.has(e.day))return archiveItems.get(e.day);
  const r=await browser.runtime.sendMessage({action:'archive-day',day:e.day});
  if(!r?.ok)throw Error(r?.error||'archivio non disponibile');
  archiveItems.set(e.day,r.items);return r.items;
}
function renderHistory(){
  const n0=timelineEntries.length,oldFrom=timelineEntries[+$('fromSnapshot').value]?.key,oldToIndex=+$('toSnapshot').value,oldTo=timelineEntries[oldToIndex]?.key,wasLast=$('toSnapshot').value===''||oldToIndex===n0-1;
  buildTimeline();
  const n=timelineEntries.length,makeOptions=()=>timelineEntries.map((e,i)=>option(i,(i+1)+'. '+e.label));
  $('fromSnapshot').replaceChildren(...makeOptions());$('toSnapshot').replaceChildren(...makeOptions());
  // La scelta resta sulla stessa fotografia anche quando l'elenco cambia; «A» sull'ultima segue le fotografie nuove.
  let from=oldFrom?timelineEntries.findIndex(e=>e.key===oldFrom):-1,to=wasLast?n-1:timelineEntries.findIndex(e=>e.key===oldTo);
  if(from<0)from=Math.max(0,n-2);if(to<0)to=n-1;
  $('fromSnapshot').value=String(Math.max(0,Math.min(n-1,from)));
  $('toSnapshot').value=String(Math.max(0,Math.min(n-1,to)));
  const recent=history.filter(h=>!h.daily),shown=Math.max(0,recent.length-10),days=timelineEntries.filter(e=>e.source==='daily').length;
  $('snapshots').replaceChildren(...recent.slice(shown).map((h,j)=>stat('#'+(shown+j+1)+' '+h.date,h.items.length+' province'+(h.scoresSynced?'':' · indici non aggiornati'))),...(days?[stat('Archivio giornaliero nei menu Da/A',days+' giorni')]:[]));
  compareHistory();
}
async function compareHistory(){
  const token=++compareToken,a=timelineEntries[+$('fromSnapshot').value],b=timelineEntries[+$('toSnapshot').value];if(!a||!b)return;
  let before,after;
  try{[before,after]=await Promise.all([itemsOf(a),itemsOf(b)]);}
  catch(e){if(token===compareToken){$('historyStats').replaceChildren(el('p','Fotografia non disponibile: '+e.message,'note'));$('historyRows').replaceChildren();}return;}
  if(token!==compareToken)return; // nel frattempo è stata scelta un'altra fotografia
  const k=$('historyKind').value,map=new Map(before.map(p=>[p.name,p]));
  const rows=after.filter(p=>map.has(p.name)).map(p=>({name:p.name,old:map.get(p.name)[k]||0,now:p[k]||0,delta:(p[k]||0)-(map.get(p.name)[k]||0)})).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)||a.name.localeCompare(b.name));
  const pos=rows.filter(x=>x.delta>0),neg=rows.filter(x=>x.delta<0);
  $('historyStats').replaceChildren(...[['Province in crescita',pos.length],['Province in calo',neg.length],['Incremento netto',fmt(rows.reduce((s,x)=>s+x.delta,0))],['Province invariate',rows.length-pos.length-neg.length]].map(([label,value])=>tile(label,value)));
  $('historyRows').replaceChildren(...rows.map(r=>{
    const row=el('tr');row.append(el('td',r.name),el('td',fmt(r.old),'num'),el('td',fmt(r.now),'num'),el('td',(r.delta>0?'+':'')+fmt(r.delta),'num '+(r.delta>0?'positive':r.delta<0?'negative':'')));return row;
  }));
}

async function readFile(id){const f=$(id).files[0];if(!f)return null;return JSON.parse(await f.text())}
function byName(r){if(!Array.isArray(r))throw Error('Classifica JSON senza elenco ranking');const map=new Map();for(const x of r){if(!x||typeof x.province_name!=='string'||!x.province_name.trim()||typeof x.count!=='number'||!Number.isFinite(x.count)||x.count<0||!Number.isInteger(x.count)||map.has(x.province_name))throw Error('Classifica con nomi duplicati o conteggi non validi');map.set(x.province_name,x.count)}return map}
async function importData(){try{const ids=['uploadSchools','uploadRoads','uploadBases','uploadHospitals','uploadScores'],raw=await Promise.all(ids.map(readFile));if(!raw.some(Boolean))throw Error('Seleziona almeno un file JSON');let arr=clone(items()),updated=0;for(let i=0;i<4;i++){if(!raw[i])continue;let map=byName(raw[i].ranking),f=FIELDS[i];if(map.size<100)throw Error('Classifica '+f.label+' incompleta ('+map.size+' province)');let matches=0;for(let p of arr){if(map.has(p.name)){p[f.key]=map.get(p.name);matches++}}if(matches<Math.min(100,arr.length))throw Error('Nomi provincia non corrispondenti per '+f.label);updated++}let scoresSynced=false;if(raw[4]){let r=raw[4].provinces;if(!Array.isArray(r))throw Error('Formato indici non riconosciuto');let m=new Map(r.map(p=>[p.name,p]));for(let p of arr){let n=m.get(p.name);if(n)for(let f of FIELDS)if(Number.isFinite(Number(n[f.score])))p[f.score]=Number(n[f.score])}scoresSynced=true}if(updated===0&&!scoresSynced)throw Error('Nessun dato aggiornabile');await commitSnapshot({date:new Date().toLocaleString('it-IT'),items:arr,scoresSynced});setupProvince();renderWorld();renderHistory();$('stamp').textContent='Snapshot '+history.length+' · '+latest().date;$('syncStatus').textContent='Importazione riuscita: '+updated+' classifiche, '+arr.length+' province. '+(scoresSynced?'Indici aggiornati.':'Indici non sincronizzati.')}catch(e){$('syncStatus').textContent='Errore: '+e.message}}
function download(obj,name){let url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('provinceSelect').addEventListener('change',e=>selectProvince(e.target.value));$('provinceSearch').addEventListener('change',e=>{if(items().some(p=>p.name===e.target.value))selectProvince(e.target.value)});$('kind').addEventListener('change',()=>{let p=items().find(x=>x.name===selected),f=field();$('target').value=String(Math.min(11,(+p[f.score]||0)+1));renderSimulation()});['target','extra'].forEach(id=>$(id).addEventListener('input',renderSimulation));['worldSort','worldFilter'].forEach(id=>$(id).addEventListener('input',renderWorld));['fromSnapshot','toSnapshot','historyKind'].forEach(id=>$(id).addEventListener('change',compareHistory));$('worldRows').addEventListener('click',e=>{let a=e.target.closest('a[data-p]');if(a){e.preventDefault();selectProvince(a.dataset.p);document.querySelector('[data-tab="province"]').click();window.scrollTo({top:0,behavior:'smooth'})}});document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-tab]').forEach(x=>{x.classList.toggle('active',x===b);x.classList.toggle('secondary',x!==b)});['province','world','history','sync'].forEach(id=>$(id).classList.toggle('hide',id!==b.dataset.tab))}));$('importBtn').onclick=importData;$('exportBtn').onclick=()=>download(latest(),'diplomacia_snapshot.json');$('exportHistoryBtn').onclick=()=>download(history,'diplomacia_storico.json');$('importHistoryBtn').onclick=()=>$('historyFile').click();$('historyFile').onchange=async e=>{try{let data=JSON.parse(await e.target.files[0].text());if(!Array.isArray(data)||!data.length||!data.every(x=>Array.isArray(x.items)&&typeof x.date==='string'))throw Error('Backup non valido');const previous=history;history=data;if(!await save()){history=previous;throw Error('Backup non salvato: memoria locale non disponibile')}setupProvince();renderWorld();renderHistory();$('stamp').textContent='Snapshot '+history.length+' · '+latest().date;$('syncStatus').textContent='Backup ripristinato.'}catch(err){$('syncStatus').textContent='Errore backup: '+err.message}};
DipBenefitUI.init(renderSimulation);
setupProvince();renderWorld();renderHistory();$('stamp').textContent='Snapshot '+history.length+' · '+latest().date;
loadArchiveList().then(renderHistory);

function refreshFromState(state) {
  history=state.history;knownSignature=DipCore.signature(history.at(-1).items);
  setupProvince();renderWorld();renderHistory();$('stamp').textContent='Snapshot '+history.length+' · '+latest().date;
  loadArchiveList().then(renderHistory); // a ogni controllo l'archivio aggiorna il giorno corrente
}
globalThis.DipApp={refreshFromState};
browser.storage.onChanged.addListener((changes,area)=>{
  if(area==='local'&&changes.dip_firefox_state_v3?.newValue)refreshFromState(changes.dip_firefox_state_v3.newValue);
});
})();
