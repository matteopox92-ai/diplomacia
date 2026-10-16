(function(root){
 'use strict';
 const $=id=>document.getElementById(id),labels=['Diamanti','Pelle','Oro','Petrolio','NTE'];
 const ids=['benefitDays','benefitTurns','benefitPremium','benefitMinutes','benefitAdditive',...labels.map((_,i)=>'production'+i),...[0,1,2,3,4].map(i=>'pilRate'+i),'pilPerLevelMoney','pilPerLevel','benefitHpPill'];
 const defaults={benefitDays:'1',benefitTurns:'',benefitPremium:'100',benefitMinutes:'10',benefitAdditive:'0',pilPerLevelMoney:'3',pilPerLevel:'2',benefitHpPill:'1'};
 let pilData=null;
 const fmt=n=>Number(n).toLocaleString('it-IT',{maximumFractionDigits:2});let province='',memory=Object.create(null),storageStatus=Object.create(null),manuals=Object.create(null),applied=Object.create(null);
 function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
 function num(id,optional=false){const input=$(id);if(input.value.trim()===''){if(optional)return null;throw Error('Completa «'+input.closest('label').childNodes[0].textContent.trim()+'».');}if(!input.validity.valid)throw Error('Controlla il valore di «'+input.closest('label').childNodes[0].textContent.trim()+'».');return Number(input.value);}
 function restore(name){province=name;let draft=memory[name];if(!draft){try{draft=JSON.parse(localStorage.getItem('dip_benefits_v1:'+name)||'null');}catch{storageStatus[name]='Memoria locale non disponibile: dati mantenuti solo per questa sessione.';}}manuals[name]=new Set(Array.isArray(draft?._manual)?draft._manual:draft?ids.filter(id=>draft[id]!==undefined&&draft[id]!==defaults[id]&&draft[id]!==''):[]);ids.forEach(id=>{$(id).value=draft?.[id]??defaults[id]??'';});$('benefitStorage').textContent=storageStatus[name]||'Dati salvati solo in questo browser, per questa provincia.';}
 function save(id){if(id)manuals[province].add(id);const data={...Object.fromEntries(ids.map(id=>[id,$(id).value])),_manual:[...manuals[province]]};memory[province]=data;try{localStorage.setItem('dip_benefits_v1:'+province,JSON.stringify(data));storageStatus[province]='Dati salvati solo in questo browser, per questa provincia.';$('benefitStorage').textContent=storageStatus[province];}catch{storageStatus[province]='Memoria locale non disponibile: dati mantenuti solo per questa sessione.';$('benefitStorage').textContent=storageStatus[province];}}
 function init(callback){ids.forEach(id=>$(id).addEventListener('input',()=>{save(id);callback();}));$('clearBenefits').addEventListener('click',()=>{memory[province]={...defaults,_manual:[]};delete applied[province];try{localStorage.removeItem('dip_benefits_v1:'+province);}catch{}restore(province);$('benefitStorage').textContent='Valori dello scarico ripristinati.';callback();});}
 function prepare(p,field,history){if(province!==p.name)restore(p.name);const row=DipFiscal.latest(history,p.name);const key=row?row.day+'|'+row.capturedAt+'|'+p.development_score:'';if(row&&applied[p.name]!==key){const values=DipFiscal.defaults(row,p.development_score);for(const [id,value] of Object.entries(values))if(!manuals[province].has(id))$(id).value=value;applied[p.name]=key;save();}pilData=root.DipPIL?DipPIL.averageGettito(history,p.name):null;if(pilData?.rates)pilData.rates.forEach((r,i)=>{if(!manuals[province].has('pilRate'+i)&&$('pilRate'+i).value==='')$('pilRate'+i).value=String(r);});const manual=manuals[province]?.size>0;$('fiscalSource').textContent=row?'Gettito regionale del '+row.day.split('-').reverse().join('/')+' · '+fmt(row.turns)+' tassazioni'+(manual?' · correzioni manuali attive.':'.'):'Gettito non ancora ricevuto: apri il gioco in Firefox.';$('healthInputs').classList.toggle('hide',field.key!=='ospedali');$('benefitDays').closest('label').classList.toggle('hide',field.key==='strade');$('developmentInputs').classList.toggle('hide',field.key!=='strade');$('economicInputs').classList.toggle('hide',!['strade','ospedali'].includes(field.key));$('benefitOutput').replaceChildren();}
 function card(label,value,sub){const n=el('div',undefined,'benefit-stat');n.append(el('small',label),el('strong',value));if(sub)n.append(el('span',sub));return n;}
 function render(p,plan,field){const out=$('benefitOutput');out.replaceChildren();const section=el('section',undefined,'benefit-result');section.append(el('h3','Cosa cambia con il nuovo indice'));out.append(section);const target=plan.reached?plan.current:plan.target;
  if(field.key==='ospedali'){
   const before=DipBenefits.healthRate(plan.current),after=DipBenefits.healthRate(target),intro=el('div',undefined,'benefit-heading');intro.append(el('strong','+'+before+' → +'+after+' HP'),el('span','ogni 6 minuti'));section.append(intro);
   if(before===after){section.append(el('p','Stessa fascia di salute: la rigenerazione non cambia e il risparmio aggiuntivo stimato è zero.','empty-benefit'));return;}
   try{const days=num('benefitDays'),r=DipBenefits.health({current:plan.current,target,turns:num('benefitTurns'),days,premium:num('benefitPremium'),minutes:num('benefitMinutes'),hpPerPill:num('benefitHpPill')});const grid=el('div',undefined,'benefit-grid');grid.append(card('Pillole risparmiate',fmt(r.pills),'nel periodo · '+fmt(r.pillsPerDay)+' / giorno'),card('Diamanti equivalenti',fmt(r.diamonds),'nel periodo · '+fmt(r.diamondsPerDay)+' / giorno'));section.append(grid,el('p',fmt(r.eligible)+' turni Premium stimati nel periodo di '+fmt(days)+' giorni. Consumo medio: '+fmt(r.consumptionBefore)+' → '+fmt(r.consumptionAfter)+' pillole / turno.','foot'));}
   catch(e){section.append(el('p',e.message+' Inserisci i turni del periodo per vedere il risparmio.','empty-benefit'));}
   section.append(el('p','Stima: 1 tassazione = 1 turno; '+fmt(num('benefitHpPill',true)??1)+' HP per pillola; 5 pillole = 1 diamante.','assumption-note'));
  }else if(field.key==='strade'){
   section.append(el('div','Denaro (fabbriche di diamanti) +'+fmt(DipBenefits.developmentBonus(plan.current,true)*100)+'% → +'+fmt(DipBenefits.developmentBonus(target,true)*100)+'% · Risorse +'+fmt(DipBenefits.developmentBonus(plan.current)*100)+'% → +'+fmt(DipBenefits.developmentBonus(target)*100)+'%','bonus-line'));
   // La produzione si ricava dal gettito (sezione PIL): niente più quantità da inserire a mano.
   renderPIL(section,plan,target);
  }else{const percent=i=>i===11?30:i*2;section.append(el('div',fmt(percent(plan.current))+'% → '+fmt(percent(target))+'%','benefit-heading'),el('p',field.key==='scuole'?'Riduzione del tempo di potenziamento delle abilità. Il risparmio economico non viene stimato.':'Bonus al danno militare. Il risparmio economico non viene stimato.','foot'));}
 }
 // Effetto sul PIL per Denaro, Pelle, Oro, Petrolio, NTE e confronto con il mantenimento in più delle nuove strade.
 function renderPIL(section,plan,target){
  if(!root.DipPIL)return;
  const box=el('section',undefined,'pil-result');box.append(el('h3','Quanto cresce la produzione rispetto al mantenimento'));section.append(box);
  if(!pilData){box.append(el('p','Serve il gettito della provincia: si compila da solo con il gioco aperto in Firefox.','empty-benefit'));return;}
  let rows;
  try{rows=DipPIL.compute({gettito:pilData.amounts,rates:[0,1,2,3,4].map(i=>$('pilRate'+i).value===''?null:Number($('pilRate'+i).value)),current:plan.current,target,maintenance:plan.increase||[0,0,0,0,0],perLevel:num('pilPerLevel'),moneyPerLevel:num('pilPerLevelMoney')});}
  catch(e){box.append(el('p',e.message,'empty-benefit'));return;}
  const money=rows[0],sign=n=>(n>0?'+':n<0?'−':'')+fmt(Math.abs(n)),minus=n=>n>0?'−'+fmt(n):'0';
  if(!money.missing){
   const grid=el('div',undefined,'pil-summary');
   const payback=money.net>0&&plan.investment?.[0]>0?' · rientro del denaro in '+fmt(plan.investment[0]/money.net)+' giorni':'';
   grid.append(card('Denaro in più / giorno',sign(money.increase),'bonus sviluppo sul netto dopo le tasse'),card('Mantenimento in denaro in più / giorno',minus(money.maintenance)),card('Saldo in denaro / giorno',sign(money.net),money.net>0?'la produzione cresce più del mantenimento'+payback:'il mantenimento supera la crescita della produzione'));
   if(money.net<=0)grid.lastChild.classList.add('bad');box.append(grid);
  }
  const wrap=el('div',undefined,'table-wrap'),table=el('table');
  table.append(el('caption','Al giorno · media del gettito di '+pilData.days+(pilData.days===1?' giorno':' giorni')));
  const pct=n=>fmt(n*100)+'%';
  const head=el('thead'),tr=el('tr');['Voce · bonus','Produzione lorda','Netto dopo le tasse','Bonus oggi','Bonus nuovo','Aumento','Mantenimento in più','Saldo'].forEach(x=>tr.append(el('th',x)));head.append(tr);table.append(head);
  const body=el('tbody');
  for(const r of rows){const row=el('tr');row.append(el('th',r.label+' · '+pct(r.before)+' → '+pct(r.after)));
   if(r.missing){['aliquota mancante','—','—','—','—',minus(r.maintenance),'—'].forEach(x=>row.append(el('td',x)));}
   else{[fmt(r.gross),fmt(r.afterTax),fmt(r.bonusNow),fmt(r.bonusNew),sign(r.increase),minus(r.maintenance)].forEach(x=>row.append(el('td',x)));const s=el('td',sign(r.net));s.className=r.net<0?'neg':'pos';row.append(s);}
   body.append(row);}
  table.append(body);wrap.append(table);box.append(wrap);
  box.append(el('p','Come nel gioco: bonus sviluppo sul netto dopo le tasse, non tassato; denaro (fabbriche di diamanti) +3% per livello, 40% alla fascia 10+; risorse +2%, 30% alla fascia 10+. Lordo = gettito ÷ aliquota. Con l’Esperto fiscale il lordo risulta un po’ più basso del vero.','assumption-note'));
 }
 root.DipBenefitUI={init,prepare,render};
})(globalThis);
