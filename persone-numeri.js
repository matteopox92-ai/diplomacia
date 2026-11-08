'use strict';
// Persone in numeri: la versione della pagina Persone pubblicata sul sito. Solo numeri aggregati (cittadini, attivi,
// partiti, nuovi arrivi per giorno), nessun dato dei singoli giocatori. Nell'estensione i numeri arrivano dal motore,
// nel sito da dati/persone-numeri.json (sito.js). Pagina costruita con createElement/textContent; grafico SVG fatto a mano.
(() => {
  const $ = id => document.getElementById(id);
  const DAY = 86400000;
  // Stessa tavolozza della pagina Persone (controllata per il daltonismo sullo sfondo dei pannelli); gli altri partiti in grigio.
  const COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'], OTHER = '#8a9aa6';
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = String(text); return e; };
  const svg = (tag, attrs = {}) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
  const nf = n => n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toLocaleString('it-IT');
  const pct = n => Number.isFinite(n) ? n.toLocaleString('it-IT', {maximumFractionDigits: 1}) + '%' : '—';
  const dayText = d => { const [y, m, g] = d.split('-'); return g + '/' + m + '/' + y; };
  const dayShort = d => { const [, m, g] = d.split('-'); return g + '/' + m; };
  const romeDay = ms => new Date(ms).toLocaleDateString('sv-SE', {timeZone: 'Europe/Rome'});
  const signed = n => !Number.isFinite(n) ? '—' : (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n).toLocaleString('it-IT');
  let data = null;

  function tile(label, value, note) { const t = el('div', 'p-tile'); t.append(el('small', null, label), el('strong', null, value)); if (note) t.append(el('span', null, note)); return t; }
  const row = offset => { const days = data.days || []; if (!offset) return days.at(-1) || null; const d = romeDay(Date.now() - offset * DAY); return days.find(x => x.day === d) || null; };

  function render() {
    DipArrivi.render($('p-new'), data?.recent || [], {ready: !!data});
    if (!data) {
      $('p-main').hidden = true; $('p-empty').hidden = false; $('p-status').textContent = '';
      $('p-empty-text').textContent = 'Numeri delle persone non ancora disponibili: compaiono dopo la prima lettura dei cittadini dal gioco.';
      return;
    }
    $('p-empty').hidden = true; $('p-main').hidden = false;
    $('p-status').textContent = 'Dati del ' + dayText(data.day) + (data.publishedAt ? ' · pubblicati ' + new Date(data.publishedAt).toLocaleString('it-IT', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '') + '.';
    $('p-tiles').replaceChildren(
      tile('Cittadini', nf(data.citizens), 'conteggio del gioco'),
      tile('Attivi negli ultimi 7 giorni', nf(data.active), pct(data.active / data.citizens * 100) + ' dei cittadini'),
      tile('Attivi oggi', nf(data.byDays?.[0]), 'accesso nelle ultime 24 ore'),
      tile('Partiti', nf((data.parties || []).length), nf((data.parties || []).reduce((n, p) => n + (p.active || 0), 0)) + ' attivi iscritti'));
    renderBars(); renderParties(); renderChart(); renderArrivals();
  }

  // Distribuzione degli attivi: quanti hanno fatto l'ultimo accesso entro 1 giorno, tra 1 e 2 giorni, … fino a 7.
  function renderBars() {
    const counts = data.byDays || [], max = Math.max(1, ...counts);
    $('p-bars').replaceChildren(...counts.map((n, i) => {
      const line = el('div', 'p-bar'), fill = el('i');
      fill.style.width = (n / max * 100).toFixed(1) + '%';
      fill.style.background = 'hsl(' + Math.round(130 * (1 - i / 6)) + ' 55% 45%)';
      const track = el('span', 'p-track'); track.append(fill);
      line.append(el('span', 'p-bar-label', i === 0 ? 'entro 1 giorno' : i + '–' + (i + 1) + ' giorni'), track, el('b', null, nf(n)));
      return line;
    }));
  }

  function renderParties() {
    const yday = row(1), week = row(7), total = data.active;
    const rows = (data.parties || []).map((p, i) => ({p, i})).sort((a, b) => b.p.active - a.p.active || (b.p.members || 0) - (a.p.members || 0));
    const delta = (old, r) => { const o = old?.parties?.[r.i]; return o ? signed(r.p.active - o[1]) + ' (' + signed((r.p.members ?? 0) - o[0]) + ')' : '—'; };
    const cls = (old, r) => { const o = old?.parties?.[r.i]; return 'num' + (o && r.p.active > o[1] ? ' p-up' : o && r.p.active < o[1] ? ' p-down' : ''); };
    $('p-parties').replaceChildren(...rows.map(r => {
      const tr = el('tr');
      tr.append(el('td', null, r.p.name), el('td', 'num', nf(r.p.members)), el('td', 'num', nf(r.p.active)), el('td', 'num', pct(total ? r.p.active / total * 100 : NaN)), el('td', cls(yday, r), delta(yday, r)), el('td', cls(week, r), delta(week, r)));
      return tr;
    }));
    const noParty = total - rows.reduce((n, r) => n + r.p.active, 0);
    $('p-party-note').textContent = rows.length + ' partiti · ' + nf(Math.max(0, noParty)) + ' attivi senza partito noto';
  }

  // Grafico degli attivi per partito: i 7 partiti con più attivi hanno un colore (in ordine alfabetico), gli altri sommati.
  function renderChart() {
    const host = $('p-chart'), legend = $('p-series'), days = data.days || [], names = data.names || [];
    if (!days.length) { host.replaceChildren(el('p', 'p-empty', 'Il grafico si riempie un giorno alla volta.')); legend.replaceChildren(); return; }
    const last = days.at(-1), keys = Object.keys(last.parties || {});
    const top = [...keys].sort((a, b) => last.parties[b][1] - last.parties[a][1]).slice(0, COLORS.length);
    const named = [...top].sort((a, b) => String(names[a]).localeCompare(String(names[b]), 'it'));
    const series = named.map((k, i) => ({name: names[k] || '?', color: COLORS[i], values: days.map(d => d.parties?.[k]?.[1] ?? null)}));
    if (keys.length > top.length) series.push({name: 'Altri partiti', color: OTHER, values: days.map(d => Object.entries(d.parties || {}).filter(([k]) => !top.includes(k)).reduce((n, [, v]) => n + (v[1] || 0), 0))});
    const W = Math.max(300, Math.round(host.clientWidth || 800)), H = W < 520 ? 220 : 280, L = 44, R = 14, T = 14, B = 30, n = days.length;
    const max = Math.max(1, ...series.flatMap(s => s.values.filter(v => v !== null)));
    const step = Math.pow(10, Math.floor(Math.log10(max))), top2 = Math.ceil(max / step) * step;
    const x = i => n === 1 ? L + (W - L - R) / 2 : L + i * (W - L - R) / (n - 1), y = v => T + (H - T - B) * (1 - v / top2);
    const root = svg('svg', {viewBox: '0 0 ' + W + ' ' + H, class: 'p-chart', role: 'img', 'aria-label': 'Attivi per partito negli ultimi ' + n + ' giorni'});
    for (const v of [0, top2 / 2, top2]) { root.append(svg('line', {x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'p-grid'})); const t = svg('text', {x: L - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'p-axis'}); t.textContent = nf(v); root.append(t); }
    for (const i of n === 1 ? [0] : [...new Set([0, Math.round((n - 1) / 2), n - 1])]) { const t = svg('text', {x: x(i), y: H - 8, 'text-anchor': n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle', class: 'p-axis'}); t.textContent = dayShort(days[i].day); root.append(t); }
    for (const s of series) {
      const pts = s.values.map((v, i) => v === null ? null : x(i).toFixed(1) + ',' + y(v).toFixed(1)).filter(Boolean);
      if (pts.length > 1) root.append(svg('polyline', {points: pts.join(' '), class: 'p-line', stroke: s.color}));
      if (n <= 31 || pts.length === 1) s.values.forEach((v, i) => { if (v !== null) root.append(svg('circle', {cx: x(i), cy: y(v), r: 4, fill: s.color, class: 'p-dot'})); });
    }
    // Passando sopra il grafico: linea verticale e valori di quel giorno.
    const cross = svg('line', {y1: T, y2: H - B, class: 'p-cross', visibility: 'hidden'}), hit = svg('rect', {x: L, y: 0, width: W - L - R, height: H, fill: 'transparent'});
    root.append(cross, hit);
    const tip = el('div', 'p-tip'); tip.hidden = true;
    const show = ev => {
      const box = root.getBoundingClientRect(), px = (ev.clientX - box.left) / box.width * W;
      const i = n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round((px - L) / ((W - L - R) / (n - 1)))));
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
      const lines = series.map(s => [s, s.values[i]]).filter(([, v]) => v !== null).sort((a, b) => b[1] - a[1]);
      tip.replaceChildren(el('b', null, dayShort(days[i].day) + ' · ' + nf(days[i].active) + ' attivi nel Paese'), ...lines.map(([s, v]) => { const r = el('span'), name = el('em'), sw = el('i'); sw.style.background = s.color; name.style.fontStyle = 'normal'; name.append(sw, document.createTextNode(s.name)); r.append(name, el('strong', null, nf(v))); return r; }));
      tip.hidden = false;
      const left = x(i) / W * box.width;
      tip.style.left = Math.max(0, Math.min(box.width - tip.offsetWidth, left + (left > box.width / 2 ? -tip.offsetWidth - 12 : 12))) + 'px';
    };
    hit.addEventListener('pointermove', show); hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; });
    host.replaceChildren(root, tip);
    legend.replaceChildren(...series.map(s => { const li = el('li'), sw = el('i'); sw.style.background = s.color; li.append(sw, document.createTextNode(s.name + ' · ' + nf(s.values.at(-1)))); return li; }));
  }

  // Nuovi arrivi: solo quanti per giorno, dal più recente.
  function renderArrivals() {
    const list = [...(data.arrivals || [])].reverse();
    $('p-arrivals-title').textContent = 'Nuovi arrivi in ' + (!data.country || /ital/i.test(data.country) ? 'Italia' : data.country);
    $('p-arrivals-note').textContent = data.arrivalsSince ? 'contati dal ' + dayText(data.arrivalsSince) + ' · ' + nf(list.reduce((n, a) => n + a.n, 0)) + ' in tutto' : '';
    if (!list.length) { const tr = el('tr'), td = el('td', null, 'Nessun nuovo arrivo registrato finora.'); td.colSpan = 2; tr.append(td); $('p-arrivals').replaceChildren(tr); return; }
    $('p-arrivals').replaceChildren(...list.map(a => { const tr = el('tr'); tr.append(el('td', null, dayText(a.day)), el('td', 'num', nf(a.n))); return tr; }));
  }

  async function load() {
    try {
      const r = await browser.runtime.sendMessage({action: 'people-numbers'});
      if (!r?.ok) throw Error(r?.error || 'dati non disponibili');
      data = r.numbers || null; render();
    } catch (error) { $('p-status').textContent = 'Dati non disponibili: ' + error.message; }
  }
  browser.storage.onChanged.addListener((changes, area) => { if (area === 'local' && (changes.dip_people_v1 || changes.dip_party_history_v1)) load(); });
  let resizeTimer = 0;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (data) renderChart(); }, 150); });
  setInterval(() => { if (data) DipArrivi.render($('p-new'), data.recent || []); }, 60000);
  load();
})();
