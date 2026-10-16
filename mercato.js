'use strict';
// Mercato: storico raccolto dall'estensione (oltre la settimana del gioco), grafici SVG senza librerie esterne.
(() => {
  const $ = id => document.getElementById(id);
  const NAMES = {altin: 'Oro', deri: 'Pelle', petrol: 'Petrolio', nte: 'NTE', elmas: 'Diamanti', para: 'Denaro'};
  const RANGES = [['1', '24 ore'], ['7', '7 giorni'], ['30', '30 giorni'], ['90', '90 giorni'], ['365', '1 anno'], ['all', 'Tutto']];
  const nf = (n, d = 2) => n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toLocaleString('it-IT', {maximumFractionDigits: d});
  const big = n => !Number.isFinite(n) ? '—' : Math.abs(n) >= 1e6 ? nf(n / 1e6, 2) + ' mln' : Math.abs(n) >= 1e4 ? nf(n / 1e3, 1) + ' mila' : nf(n, 0);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const svg = (tag, attrs = {}) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
  // Formattatore creato una sola volta: crearlo a ogni punto costava quasi mezzo secondo con un anno di dati.
  const ROME = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Rome'});
  const romeDay = iso => ROME.format(new Date(iso));
  let data = null, resource = null, range = '7';
  try { range = localStorage.getItem('dip_market_range') || '7'; resource = localStorage.getItem('dip_market_resource'); } catch {}

  // Giorni: prezzo di chiusura, offerta minima, prezzo medio delle vendite ponderato, totali di scambi, quantità e valore.
  function daily(points) {
    const map = new Map();
    for (const p of points) {
      const d = romeDay(p.t), g = map.get(d) || {t: d + 'T12:00:00Z', label: d, price: null, low: null, volume: 0, trades: 0, value: 0, n: 0};
      if (p.price !== null) g.price = p.price;
      if (p.low !== null) g.low = g.low === null ? p.low : Math.min(g.low, p.low);
      g.volume += p.volume || 0; g.trades += p.trades || 0; g.value += (p.vwap || 0) * (p.volume || 0); g.n++;
      map.set(d, g);
    }
    return [...map.values()].map(g => ({...g, vwap: g.volume ? g.value / g.volume : null}));
  }
  function view() {
    const all = (data.series[resource] || []).map(p => ({...p, value: (p.vwap || 0) * (p.volume || 0)}));
    const from = range === 'all' ? 0 : Date.now() - Number(range) * 86400000;
    const pts = all.filter(p => Date.parse(p.t) >= from);
    const byDay = range === 'all' || Number(range) > 7;
    // Fino a 7 giorni: blocchi del gioco (2 h, oppure 6 h dal 7 giorni) messi sul tempo reale; quantità, scambi e valore per ora,
    // così i blocchi di 6 h non sembrano tre volte più grandi di quelli di 2 h.
    const rows = byDay ? daily(pts) : pts.map(p => { const h = p.coarse ? (p.span || p.hours || 6) : (p.hours || data.bucketHours || 2); return {...p, hours: h, volume: (p.volume || 0) / h, trades: (p.trades || 0) / h, value: p.value / h}; });
    return {pts, rows, byDay};
  }

  function chart(host, rows, series, opts) {
    host.replaceChildren();
    const W = 1000, H = opts.height || 200, L = 64, R = 12, T = 12, B = 26;
    const vals = rows.flatMap(r => series.map(s => r[s.key])).filter(v => v !== null && Number.isFinite(v));
    if (!vals.length) { host.append(el('p', 'm-empty', 'Nessun dato in questo periodo.')); return; }
    let min = opts.zero ? 0 : Math.min(...vals), max = Math.max(...vals);
    if (max === min) { max = max * 1.05 || 1; min = opts.zero ? 0 : min * 0.95; }
    if (!opts.zero) { const pad = (max - min) * 0.1; min -= pad; max += pad; }
    // Asse x sul tempo vero (non sull'indice del punto): i buchi e i blocchi di durata diversa si vedono come sono.
    const times = rows.map(r => Date.parse(r.t)), t0 = times[0], t1 = times.at(-1), span = t1 - t0;
    const xt = t => L + (span ? (t - t0) / span * (W - L - R) : (W - L - R) / 2);
    const x = i => xt(times[i]);
    const y = v => T + (1 - (v - min) / (max - min)) * (H - T - B);
    const s = svg('svg', {viewBox: `0 0 ${W} ${H}`, class: 'm-chart', role: 'img', 'aria-label': opts.label});
    for (const f of [0, 0.5, 1]) { const v = min + (max - min) * f, yy = y(v); s.append(svg('line', {x1: L, x2: W - R, y1: yy, y2: yy, class: 'm-gridline'})); const t = svg('text', {x: L - 8, y: yy + 4, class: 'm-axis', 'text-anchor': 'end'}); t.textContent = big(v); s.append(t); }
    const ticks = Math.min(6, rows.length);
    for (let k = 0; k < ticks; k++) { const i = Math.round(k * (rows.length - 1) / Math.max(1, ticks - 1)), t = svg('text', {x: x(i), y: H - 6, class: 'm-axis', 'text-anchor': k === 0 ? 'start' : k === ticks - 1 ? 'end' : 'middle'}); t.textContent = opts.byDay ? new Date(rows[i].t).toLocaleDateString('it-IT', {day: 'numeric', month: 'short'}) : new Date(rows[i].t).toLocaleString('it-IT', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}); s.append(t); }
    // Barre: un blocco del gioco finisce all'ora del punto e dura «hours»; i giorni sono centrati sul mezzogiorno.
    const bw = r => Math.max(1.5, span ? (r.hours || 24) * 3600000 / span * (W - L - R) * 0.85 : (W - L - R) * 0.1);
    for (const se of series) {
      if (se.type === 'bar') rows.forEach((r, i) => { const v = r[se.key]; if (v > 0) s.append(svg('rect', {x: opts.byDay ? x(i) - bw(r) / 2 : x(i) - bw(r), y: y(v), width: bw(r), height: Math.max(0.5, y(min) - y(v)), class: 'm-bar ' + se.cls})); });
      else { let d = ''; rows.forEach((r, i) => { const v = r[se.key]; if (v === null || !Number.isFinite(v)) return; d += (d && rows[i - 1]?.[se.key] != null ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }); if (d) s.append(svg('path', {d, class: 'm-line ' + se.cls})); }
    }
    const cursor = svg('line', {y1: T, y2: H - B, class: 'm-cursor', visibility: 'hidden'}); s.append(cursor);
    const hit = svg('rect', {x: L, y: 0, width: W - L - R, height: H, fill: 'transparent'}); s.append(hit);
    const info = el('p', 'm-info', opts.hint);
    const show = i => { const r = rows[i]; cursor.setAttribute('x1', x(i)); cursor.setAttribute('x2', x(i)); cursor.setAttribute('visibility', 'visible'); info.textContent = (opts.byDay ? new Date(r.t).toLocaleDateString('it-IT', {weekday: 'short', day: 'numeric', month: 'short'}) : new Date(r.t).toLocaleString('it-IT', {weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})) + ' · ' + series.map(se => se.name + ' ' + nf(r[se.key])).join(' · '); };
    hit.addEventListener('pointermove', e => { const b = s.getBoundingClientRect(), px = (e.clientX - b.left) / b.width * W, t = t0 + (px - L) / (W - L - R) * span; let best = 0; for (let i = 1; i < times.length; i++) if (Math.abs(times[i] - t) < Math.abs(times[best] - t)) best = i; show(best); });
    hit.addEventListener('pointerleave', () => { cursor.setAttribute('visibility', 'hidden'); info.textContent = opts.hint; });
    const legend = el('div', 'm-legend'); for (const se of series) { const k = el('span', 'm-key ' + se.cls, se.name); legend.append(k); }
    host.append(legend, s, info);
  }

  function tiles(v) {
    const p = v.pts, withPrice = p.filter(x => x.price !== null), last = withPrice.at(-1), first = withPrice[0];
    const vol = p.reduce((n, x) => n + (x.volume || 0), 0), val = p.reduce((n, x) => n + x.value, 0), trades = p.reduce((n, x) => n + (x.trades || 0), 0);
    const lows = p.map(x => x.low).filter(x => x !== null), prices = withPrice.map(x => x.price);
    const change = last && first && first.price ? (last.price - first.price) / first.price * 100 : null;
    const items = [['Prezzo attuale', nf(last?.price), 'media delle offerte più economiche'], ['Prezzo medio delle vendite', nf(vol ? val / vol : null), 'ponderato sulle quantità'], ['Minimo · massimo', nf(lows.length ? Math.min(...lows) : null) + ' · ' + nf(prices.length ? Math.max(...prices) : null), 'offerta minima e prezzo più alto'], ['Variazione', change === null ? '—' : (change > 0 ? '+' : '') + nf(change, 1) + '%', 'nel periodo scelto'], ['Scambi', nf(trades, 0), 'numero di vendite'], ['Quantità scambiata', big(vol), 'unità vendute'], ['Valore scambiato', big(val), 'denaro passato di mano']];
    $('m-tiles').replaceChildren(...items.map(([a, b, c]) => { const t = el('div', 'm-tile'); t.append(el('small', '', a), el('strong', '', b), el('span', '', c)); if (a === 'Variazione' && change !== null) t.classList.add(change >= 0 ? 'up' : 'down'); return t; }));
  }

  function table(v) {
    const rows = daily(v.pts).reverse(), body = $('m-rows'); body.replaceChildren();
    for (const r of rows) { const tr = el('tr'); [new Date(r.t).toLocaleDateString('it-IT', {weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'}), nf(r.price), nf(r.vwap), nf(r.low), nf(r.trades, 0), nf(r.volume, 0), nf(r.value, 0)].forEach((t, i) => tr.append(el(i ? 'td' : 'th', '', t))); body.append(tr); }
    $('m-table-wrap').hidden = !rows.length;
  }

  function render() {
    for (const b of document.querySelectorAll('#m-resources button')) b.setAttribute('aria-pressed', b.dataset.r === resource);
    for (const b of document.querySelectorAll('#m-ranges button')) b.setAttribute('aria-pressed', b.dataset.r === range);
    if (!data?.series) return; // mercato non ancora caricato: si aggiorna solo il pulsante scelto
    const v = view(), o = {byDay: v.byDay, hint: 'Passa sul grafico per leggere i valori.'}, per = v.byDay ? ' al giorno' : ' all’ora';
    tiles(v);
    chart($('m-price'), v.rows, [{key: 'price', name: 'Offerta', cls: 's1'}, {key: 'vwap', name: 'Vendite', cls: 's2'}, {key: 'low', name: 'Offerta minima', cls: 's3'}], {...o, label: 'Prezzi', height: 240});
    chart($('m-volume'), v.rows, [{key: 'volume', name: 'Quantità' + per, cls: 's1', type: 'bar'}], {...o, label: 'Quantità scambiata', zero: true, height: 150});
    chart($('m-trades'), v.rows, [{key: 'trades', name: 'Scambi' + per, cls: 's2', type: 'bar'}], {...o, label: 'Numero di scambi', zero: true, height: 150});
    chart($('m-value'), v.rows, [{key: 'value', name: 'Valore' + per, cls: 's4', type: 'bar'}], {...o, label: 'Valore scambiato', zero: true, height: 150});
    table(v);
  }

  function csv() {
    const rows = daily((data.series[resource] || []).map(p => ({...p, value: (p.vwap || 0) * (p.volume || 0)})));
    const lines = ['giorno;prezzo_offerta;prezzo_vendite;offerta_minima;scambi;quantita;valore', ...rows.map(r => [r.label, r.price, r.vwap?.toFixed(4), r.low, r.trades, r.volume, Math.round(r.value)].map(x => x ?? '').join(';'))];
    const a = el('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], {type: 'text/csv'})); a.download = 'mercato_' + (NAMES[resource] || resource) + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function load() {
    try {
      const r = await fetch('/api/market'); const d = await r.json();
      if (!r.ok) throw Error(d.error);
      data = d;
      const keys = Object.keys(d.series).filter(k => d.series[k].length).sort((a, b) => (NAMES[a] || a).localeCompare(NAMES[b] || b));
      if (!keys.length) throw Error('Nessun dato del mercato ancora raccolto.');
      if (!keys.includes(resource)) resource = keys.includes('altin') ? 'altin' : keys[0];
      $('m-resources').replaceChildren(...keys.map(k => { const b = el('button', '', NAMES[k] || k); b.type = 'button'; b.dataset.r = k; return b; }));
      const since = Object.values(d.series).map(p => p[0]?.t).filter(Boolean).sort()[0];
      $('m-status').textContent = 'Aggiornato ' + new Date(d.checkedAt).toLocaleString('it-IT', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) + ' · storico dal ' + new Date(since).toLocaleDateString('it-IT', {day: 'numeric', month: 'long'});
      $('m-main').hidden = false; $('m-empty').hidden = true;
      render();
    } catch (e) { $('m-main').hidden = true; $('m-empty').hidden = false; $('m-empty-text').textContent = e.message; }
  }

  $('m-ranges').replaceChildren(...RANGES.map(([k, t]) => { const b = el('button', '', t); b.type = 'button'; b.dataset.r = k; return b; }));
  $('m-resources').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; resource = b.dataset.r; try { localStorage.setItem('dip_market_resource', resource); } catch {} render(); });
  $('m-ranges').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; range = b.dataset.r; try { localStorage.setItem('dip_market_range', range); } catch {} render(); });
  $('m-csv').addEventListener('click', csv);
  browser.storage.onChanged.addListener((c, area) => { if (area === 'local' && c.dip_market_v1) load(); });
  load();
})();
