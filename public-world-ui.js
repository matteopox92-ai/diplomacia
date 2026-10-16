/* Sezione "Il mondo adesso": dati pubblici letti dal server. Solo DOM e textContent, nessun innerHTML con dati esterni. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = n => n.toLocaleString('it-IT');
  const when = iso => new Date(iso).toLocaleString('it-IT', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  let owners = {};

  function flag(url, color) {
    if (url) { const img = el('img', 'flag'); img.src = url; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.onerror = () => img.replaceWith(dot(color)); return img; }
    return dot(color);
  }
  function dot(color) { const d = el('span', 'flag dot'); if (color) d.style.background = color; return d; }

  function stats(rows) {
    const last = rows.at(-1), target = Date.parse(last.at) - 86400000;
    // Riferimento: la lettura più vicina a 24 ore prima, se ne esiste una di almeno 12 ore prima.
    const old = rows.filter(r => Date.parse(r.at) <= Date.parse(last.at) - 43200000).sort((a, b) => Math.abs(Date.parse(a.at) - target) - Math.abs(Date.parse(b.at) - target))[0];
    const box = $('world-stats'); box.replaceChildren();
    for (const [key, label] of [['players', 'Giocatori registrati'], ['wars', 'Guerre in corso'], ['parties', 'Partiti politici']]) {
      const tile = el('div', 'wtile'); tile.append(el('small', '', label), el('strong', '', fmt(last[key])));
      if (old) { const d = last[key] - old[key]; tile.append(el('span', d > 0 ? 'delta up' : d < 0 ? 'delta down' : 'delta', (d > 0 ? '+' : '') + fmt(d) + ' in 24 ore')); }
      box.append(tile);
    }
  }

  function nations(list) {
    const ol = $('world-nations'); ol.replaceChildren();
    const max = list[0]?.provinces.length || 1;
    for (const n of list.slice(0, 8)) {
      const li = el('li'); const row = el('div', 'nrow');
      row.append(flag(n.flag, n.color), el('span', 'nname', n.name), el('b', '', n.provinces.length + (n.provinces.length === 1 ? ' provincia' : ' province')));
      const bar = el('div', 'nbar'); const fill = el('span'); fill.style.width = (n.provinces.length / max * 100) + '%'; bar.append(fill);
      li.title = n.provinces.join(', '); li.append(row, bar); ol.append(li);
    }
    const free = DipPublic.independent(owners);
    $('world-nation-count').textContent = list.length + ' nazioni' + (free ? ' · ' + free + ' province indipendenti' : '');
  }

  function changes(list, since) {
    const ul = $('world-changes'); ul.replaceChildren();
    if (!list.length) { ul.append(el('li', 'empty', 'Nessun cambio di proprietario registrato dal ' + when(since) + '. Le conquiste compariranno qui.')); return; }
    for (const c of list.slice(0, 8)) {
      const li = el('li'); li.append(el('b', '', c.province), el('span', '', c.from + ' → ' + c.to), el('time', '', when(c.at))); ul.append(li);
    }
  }

  function lookup() {
    const out = $('world-owner'), name = $('world-search').value.trim();
    out.replaceChildren();
    const key = Object.keys(owners).find(k => k.toLowerCase() === name.toLowerCase());
    if (!name) return;
    if (!key) { out.append(el('span', 'muted', 'Provincia non trovata: scegli un nome dall’elenco.')); return; }
    const [nation, color, url, independent] = owners[key];
    out.append(flag(url, color), el('span', '', key + ' è governata da '), el('b', '', nation + (independent ? ' (indipendente)' : '')));
  }

  async function load() {
    const status = $('world-time');
    try {
      const response = await fetch('/api/public-world', {cache: 'no-store', signal: AbortSignal.timeout(20000)});
      const data = await response.json();
      if (!response.ok || !data.owners) throw Error(data.error || 'HTTP ' + response.status);
      owners = data.owners;
      stats(data.stats); nations(DipPublic.nations(owners)); changes(data.changes, data.since);
      const dl = $('world-provinces'); dl.replaceChildren(...Object.keys(owners).map(n => { const o = el('option'); o.value = n; return o; }));
      status.textContent = (data.error ? 'Ultimo dato salvato: ' : 'Aggiornato ') + when(data.checkedAt);
      $('world').classList.remove('loading');
    } catch {
      status.textContent = 'Dati pubblici non disponibili';
      $('world-stats').replaceChildren(el('p', 'muted', 'Non riesco a leggere i dati pubblici in questo momento. Riprova tra poco.'));
    }
  }

  $('world-search').addEventListener('input', lookup);
  load(); setInterval(load, 300000);
})();
