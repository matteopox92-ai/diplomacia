'use strict';
// Pannello "Raccolta automatica": usato nella Panoramica e nel menu dell'icona.
(() => {
  const box = document.getElementById('collector');
  if (!box) return;
  const $ = sel => box.querySelector(sel);
  const time = iso => new Date(iso).toLocaleString('it-IT', {weekday: 'short', hour: '2-digit', minute: '2-digit'});
  const ago = iso => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? 'adesso' : m < 60 ? m + ' min fa' : Math.round(m / 60) + ' h fa'; };
  async function render() {
    let info;
    try { info = await DipExt.status(); } catch { $('.c-title').textContent = 'Estensione non raggiungibile'; return; }
    const s = info.status || {}, stale = !s.checkedAt || Date.now() - Date.parse(s.checkedAt) > 2 * info.intervalMinutes * 60000;
    const state = s.ok && !stale ? 'ok' : s.waiting ? 'wait' : s.ok ? 'old' : s.attemptedAt ? 'err' : 'wait';
    box.dataset.state = state;
    $('.c-title').textContent = state === 'ok' ? 'Dati aggiornati ' + ago(s.checkedAt) : state === 'old' ? 'Dati di ' + ago(s.checkedAt) : state === 'err' ? 'Ultimo tentativo non riuscito' : 'In attesa del gioco';
    $('.c-text').textContent = s.message || '';
    const facts = [];
    if (s.checkedAt) facts.push('Ultimo controllo riuscito: ' + time(s.checkedAt));
    if (info.dataAt && info.dataAt !== s.checkedAt) facts.push('Ultimi dati nuovi: ' + time(info.dataAt) + ' (dopo, nessuna novità nel gioco)');
    if (info.newData) facts.push('Sono arrivati dati più recenti: premi «Aggiorna ora» per vederli');
    if (!document.documentElement.classList.contains('sito')) facts.push('Controllo automatico ogni ' + info.intervalMinutes + ' minuti con il gioco aperto');
    // Lo stato salvato dalle versioni 3.x ha un formato diverso: si mostra solo quello della 4.0.
    if (info.fiscal?.ok && Number.isInteger(info.fiscal.regions)) facts.push('Gettito: ' + info.fiscal.regions + ' regioni, ' + info.fiscal.days + ' giorni');
    else if (info.fiscal && info.fiscal.ok === false) facts.push('Gettito: ' + info.fiscal.error);
    const pct = a => a.map(v => v ?? '?').join(' / ') + ' %';
    if (info.stateRates) facts.push('Aliquote dello Stato (denaro / pelle / oro / petrolio / NTE): ' + pct(info.stateRates));
    const firstProvince = info.provinceRates && Object.entries(info.provinceRates)[0];
    if (firstProvince) facts.push('Aliquote della provincia (' + firstProvince[0] + '): ' + pct(firstProvince[1]));
    if (info.rates) facts.push('Aliquote totali lette per ' + info.rates + ' regioni');
    const shapes = info.ratesShape && typeof info.ratesShape === 'object' ? info.ratesShape : {};
    for (const [k, v] of Object.entries(shapes)) if (v) facts.push('Aliquote ' + (k === 'state' ? 'dello Stato' : 'della provincia') + (v === 'assente' ? ': non ricevute' : ': formato non riconosciuto ' + String(v).slice(0, 160)));
    for (const [k, v] of Object.entries(info.rateNames || {})) if (v?.length) facts.push('Voci delle aliquote ' + (k === 'state' ? 'dello Stato' : 'della provincia') + ' nel gioco: ' + v.join(', '));
    if (info.market?.ok) facts.push('Mercato: ' + info.market.resources + ' risorse, storico dal ' + new Date(info.market.since).toLocaleDateString('it-IT'));
    else if (info.market) facts.push('Mercato: ' + info.market.error);
    // Persone: solo il conteggio (nomi e accessi restano nella pagina Persone dell'estensione).
    if (info.people?.ok) facts.push('Persone: ' + info.people.players.toLocaleString('it-IT') + ' cittadini, ' + (info.people.parties ?? '?') + ' partiti');
    else if (info.people?.error) facts.push('Persone: ' + info.people.error);
    $('.c-facts').replaceChildren(...facts.map(t => Object.assign(document.createElement('li'), {textContent: t})));
    $('.c-open').hidden = state === 'ok';
  }
  $('.c-sync').addEventListener('click', async event => {
    const b = event.currentTarget; b.disabled = true; b.textContent = 'Aggiorno…';
    try { await DipExt.sync(); } finally { b.disabled = false; b.textContent = 'Aggiorna ora'; render(); }
  });
  $('.c-open').addEventListener('click', () => DipExt.openGame());
  browser.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.dip_firefox_state_v3) render(); });
  render(); setInterval(render, 30000);
})();
