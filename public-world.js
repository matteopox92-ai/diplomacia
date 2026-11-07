(function(root){
 'use strict';
 // Dati pubblici del gioco, leggibili senza account: statistiche generali e proprietari delle province.
 // Nessun token o credenziale: il server legge solo gli indirizzi che la pagina di benvenuto del gioco mostra a chiunque.
 const GAME='https://diplomacia.com.tr';
 const SOURCES={stats:GAME+'/api/public-stats',owners:GAME+'/api/countries/map/colors-public'};
 const FLAG_PREFIX=GAME+'/uploads/country-flags/';
 const count=v=>{if(!Number.isSafeInteger(v)||v<0||v>1e9)throw Error('Statistica non valida');return v;};
 const text=(v,max=150)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Testo non valido');return v.trim();};
 function cleanStats(raw){
  if(!raw||typeof raw!=='object')throw Error('Statistiche mancanti');
  return {players:count(raw.total_players),wars:count(raw.active_wars),parties:count(raw.total_parties)};
 }
 // Formato compatto per provincia: [nazione, colore, bandiera, indipendente].
 function cleanOwners(raw){
  const list=raw&&raw.provinceOwners;
  if(!list||typeof list!=='object'||Array.isArray(list))throw Error('Proprietari mancanti');
  const names=Object.keys(list);
  if(names.length<100||names.length>2000)throw Error('Numero di province anomalo');
  const out={};
  for(const name of names.sort((a,b)=>a.localeCompare(b))){
   const o=list[name];if(!o||typeof o!=='object')throw Error('Proprietario non valido');
   const color=/^#[0-9a-f]{6}$/i.test(o.color)?o.color.toLowerCase():'';
   const flag=typeof o.flagUrl==='string'&&o.flagUrl.length<=300&&o.flagUrl.startsWith(FLAG_PREFIX)&&!/["'<>\s\\]/.test(o.flagUrl)?o.flagUrl:'';
   out[text(name)]=[text(o.name),color,flag,o.independent===true];
  }
  return out;
 }
 // Cambi di proprietario tra due fotografie: province nuove o sparite non vengono contate come conquiste.
 function changes(before,after){
  const out=[];
  for(const name of Object.keys(after)){const a=before[name],b=after[name];if(a&&a[0]!==b[0])out.push({province:name,from:a[0],to:b[0]});}
  return out.sort((x,y)=>x.province.localeCompare(y.province));
 }
 // Le province indipendenti non formano una nazione: restano fuori dalla classifica e si contano a parte.
 const independent=owners=>Object.values(owners).filter(o=>o[3]).length;
 function nations(owners){
  const map=new Map();
  for(const [province,[name,color,flag,free]] of Object.entries(owners)){if(free)continue;const n=map.get(name)||{name,color,flag,provinces:[]};n.provinces.push(province);if(!n.flag&&flag)n.flag=flag;map.set(name,n);}
  return [...map.values()].sort((a,b)=>b.provinces.length-a.provinces.length||a.name.localeCompare(b.name));
 }
 root.DipPublic={SOURCES,cleanStats,cleanOwners,changes,nations,independent};
})(globalThis);
