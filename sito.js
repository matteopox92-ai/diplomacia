'use strict';
// Solo nel sito pubblicato (GitHub Pages): le pagine leggono i file in dati/ al posto del motore dell'estensione.
(() => {
  const original = globalThis.fetch.bind(globalThis);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  // Cache del browser: ?v= cambia ogni 5 minuti; i mesi di mercato passati non cambiano più e si leggono senza ?v=.
  const get = async (path, cached = false) => { const r = await original(cached ? path : path + '?v=' + Math.floor(Date.now() / 300000)); if (!r.ok) throw Error('HTTP ' + r.status); return r.json(); };
  let stato = null;
  const readStato = () => (stato ||= get('dati/stato.json').catch(e => { stato = null; throw e; }));
  // Ogni file con il suo catch: una fotografia mancante o rotta non svuota la pagina.
  const snapshots = async (n = Infinity) => {
    const list = (await readStato()).snapshots || [];
    if (n === 1) { for (let i = list.length - 1; i >= 0; i--) { const s = await get(list[i]).catch(() => null); if (s?.items) return [s]; } return []; }
    return (await Promise.all(list.slice(-n).map(p => get(p).catch(() => null)))).filter(s => s?.items);
  };
  // Storico giornaliero dell'ultimo anno (dati/storico/AAAA-MM.json): si ricostruisce una fotografia per giorno.
  // Le voci che il file non porta (regione, bandiera…) si prendono dalla fotografia più recente della stessa provincia.
  const runsToArray = (runs, n) => { const out = []; for (const [v, k] of runs || []) for (let i = 0; i < k; i++) out.push(v); while (out.length < n) out.push(null); return out; };
  function expand(file, latest) {
    const n = file?.days?.length || 0, cols = (file?.provinces || []).map(([name, c]) => [name, Object.entries(c).map(([k, runs]) => [k, runsToArray(runs, n)])]);
    return (file?.days || []).map((d, i) => {
      const items = [];
      for (const [name, c] of cols) {
        if (c.every(([, vals]) => vals[i] === null)) continue; // provincia assente quel giorno
        items.push({...(latest.get(name) || {}), name, ...Object.fromEntries(c.map(([k, vals]) => [k, vals[i]]))});
      }
      const [y, m, g] = d.split('-');
      return {date: g + '/' + m + '/' + y + ' · giornaliera', fetchedAt: null, scoresSynced: true, daily: true, day: d, items};
    }).filter(s => s.items.length);
  }
  async function daily(recent) {
    const list = (await readStato()).storico || [], current = new Date().toISOString().slice(0, 7);
    const files = await Promise.all(list.filter(p => /^dati\/storico\/\d{4}-\d{2}\.json$/.test(p)).map(p => get(p, !p.includes(current)).catch(() => null)));
    const latest = new Map((recent.at(-1)?.items || []).map(p => [p.name, p]));
    // Il giorno delle fotografie recenti è già coperto da quelle: non si ripete.
    const today = recent[0]?.fetchedAt ? new Date(recent[0].fetchedAt).toLocaleDateString('sv-SE', {timeZone: 'Europe/Rome'}) : null;
    return files.filter(Boolean).flatMap(f => expand(f, latest)).filter(s => s.day !== today).sort((a, b) => a.day.localeCompare(b.day));
  }
  // Gettito condiviso: un foglio per Stato, solo degli Stati di chi ha scelto di condividerlo.
  let fiscal = null;
  const readFiscal = () => (fiscal ||= get('dati/gettito/indice.json').then(list => Promise.all(list.filter(f => /^dati\/gettito\/[0-9A-Za-z-]+\.json$/.test(f)).map(f => get(f).catch(() => null)))).then(files => files.filter(Boolean).flatMap(f => f.rows || [])).catch(() => []));
  function income(rows, name) {
    const days = rows.filter(r => r.name === name && r.complete).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 7);
    if (!days.length) return null;
    // Alla provincia arriva solo la tassa provinciale: quota p/(s+p) dalle aliquote della riga più recente che le contiene.
    const rated = days.find(r => Array.isArray(r.rates) && Array.isArray(r.prov));
    const share = [0, 1, 2, 3, 4].map(i => rated ? (rated.rates[i] > 0 ? rated.prov[i] / rated.rates[i] : 0) : null);
    const gettito = [0, 1, 2, 3, 4].map(i => days.reduce((n, r) => n + r.amounts[i], 0) / days.length);
    return {days: days.length, from: days.at(-1).day, to: days[0].day, gettito, share, amounts: gettito.map((n, i) => share[i] === null ? null : n * share[i])};
  }
  async function market() {
    const s = await readStato();
    if (!s.market) return null;
    const series = {}, current = new Date().toISOString().slice(0, 7);
    // Si scaricano solo i mesi dell'ultimo anno (13 mesi): bastano per la vista «1 anno» anche dopo anni di storico.
    const first = new Date(); first.setUTCDate(1); first.setUTCMonth(first.getUTCMonth() - 12);
    const from = first.toISOString().slice(0, 7), recentMonths = (s.market.months || []).filter(m => (m.match(/(\d{4}-\d{2})\.json$/)?.[1] || '') >= from);
    const months = await Promise.all(recentMonths.map(m => get(m, !m.includes(current)).catch(() => ({}))));
    for (const month of months) for (const [k, pts] of Object.entries(month || {})) if (Array.isArray(pts)) (series[k] ??= []).push(...pts);
    return {series, depth: s.market.depth, bucketHours: s.market.bucketHours, checkedAt: s.market.checkedAt};
  }
  async function api(path) {
    try {
      if (path === '/api/snapshot') { const s = await readStato(); return json({schema: 1, history: await snapshots(1), checkedAt: s.status?.checkedAt || null}); }
      if (path === '/api/status') { const s = await readStato(), rows = await readFiscal(); return json({status: s.status, fiscal: rows.length ? {ok: true, regions: new Set(rows.map(r => r.name)).size, days: new Set(rows.map(r => r.day)).size} : null, countryId: null, intervalMinutes: 5, rates: 0, stateRates: null, provinceRates: null, rateNames: null, ratesShape: null, market: s.market?.status || null}); }
      if (path === '/api/market') { const m = await market(); return m ? json(m) : json({error: 'Mercato non ancora pubblicato'}, 503); }
      if (path === '/api/public-world') return json(await get('dati/mondo.json'));
      return json({error: 'Percorso non disponibile'}, 404);
    } catch (e) { return json({error: 'Dati non ancora pubblicati (' + e.message + ')'}, 503); }
  }
  globalThis.fetch = (input, options) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    return url.startsWith('/api/') ? api(url.split('?')[0]) : original(input, options);
  };
  async function message(m) {
    if (m?.action === 'state') { const recent = await snapshots(), history = [...await daily(recent).catch(() => []), ...recent], rows = await readFiscal(); if (history.length) history.at(-1).fiscal = rows; return {ok: true, state: {history}}; }
    if (m?.action === 'province') { const inc = income(await readFiscal(), String(m.name || '')); return {ok: true, income: inc, detail: null, detailError: 'nel sito cassa e scorte si inseriscono a mano', incomeError: inc ? null : 'il gettito di questa provincia non è condiviso nel sito'}; }
    if (m?.action === 'history') return {ok: false, error: 'Il sito è in sola lettura: lo storico si importa solo nell’estensione.'};
    return {ok: false, error: 'Non disponibile nel sito'};
  }
  globalThis.browser = {
    runtime: {sendMessage: message, getURL: p => new URL(p, location.href).href},
    storage: {onChanged: {addListener() {}}},
    tabs: {create: ({url}) => { location.href = url; }}
  };
  globalThis.DipExt = {
    status: async () => (await (await fetch('/api/status')).json()),
    sync: async () => { stato = fiscal = null; location.reload(); },
    openGame: () => { location.href = 'https://diplomacia.com.tr/'; }
  };
  document.documentElement.classList.add('sito');
})();
