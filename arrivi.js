'use strict';
// Riquadro «Nuovi iscritti» (4.2.5), uguale nella pagina Persone dell'estensione e in quella del sito.
// Mostra solo quanti e quando: events = [{at: ISO, n}], mai nomi o id. Si aggiorna da solo ogni minuto («2 ore fa»).
(root => {
  const DAY = 86400000;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = String(text); return e; };
  const romeDay = ms => new Date(ms).toLocaleDateString('sv-SE', {timeZone: 'Europe/Rome'});
  const hm = ms => new Date(ms).toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome'});
  const dayName = (ms, now) => { const d = romeDay(ms); if (d === romeDay(now)) return 'oggi'; if (d === romeDay(now - DAY)) return 'ieri'; return new Date(ms).toLocaleDateString('it-IT', {weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Rome'}); };
  function ago(ms, now) { const m = Math.floor((now - ms) / 60000); if (m < 1) return 'adesso'; if (m < 60) return m + ' min fa'; const h = Math.floor(m / 60); if (h < 24) return h === 1 ? '1 ora fa' : h + ' ore fa'; const d = Math.floor(h / 24); return d === 1 ? '1 giorno fa' : d + ' giorni fa'; }
  // Arrivi raggruppati al minuto: [{at, n}] dal più vecchio al più recente.
  function group(list) {
    const m = new Map();
    for (const a of list || []) { const t = Date.parse(a.at); if (!Number.isFinite(t)) continue; const k = Math.floor(t / 60000) * 60000; m.set(k, (m.get(k) || 0) + (a.n || 1)); }
    return [...m].sort((a, b) => a[0] - b[0]).map(([t, n]) => ({at: new Date(t).toISOString(), n}));
  }
  // Quanti arrivi nelle ultime 24 ore (per l'indicatore nel menu).
  const last24 = (events, now = Date.now()) => (events || []).filter(e => now - Date.parse(e.at) <= DAY).reduce((n, e) => n + (e.n || 1), 0);
  function render(host, events, {now = Date.now(), ready = true} = {}) {
    if (!host) return;
    const list = group(events), recent = list.filter(e => now - Date.parse(e.at) <= 7 * DAY);
    const today = recent.filter(e => romeDay(Date.parse(e.at)) === romeDay(now)).reduce((n, e) => n + e.n, 0);
    const day = last24(recent, now), last = list.at(-1);
    const tile = (label, value, note, hot) => { const t = el('div', 'a-tile' + (hot ? ' a-hot' : '')); t.append(el('small', null, label), el('strong', null, value)); if (note) t.append(el('span', null, note)); return t; };
    const tiles = el('div', 'a-tiles');
    tiles.append(tile('Ultime 24 ore', (day ? '+' : '') + day, day ? 'nuovi cittadini' : 'nessun arrivo', day > 0), tile('Oggi', (today ? '+' : '') + today, 'dalla mezzanotte'),
      tile('Ultimo arrivo', last ? hm(Date.parse(last.at)) : '—', last ? dayName(Date.parse(last.at), now) + ' · ' + ago(Date.parse(last.at), now) : ready ? 'nessuno registrato' : 'raccolta appena partita'));
    // Ultimi 7 giorni, giorno per giorno (oggi per primo).
    const week = el('ol', 'a-week');
    for (let i = 0; i < 7; i++) {
      const t = now - i * DAY, d = romeDay(t), n = recent.filter(e => romeDay(Date.parse(e.at)) === d).reduce((a, e) => a + e.n, 0);
      // Etichetta corta (il giorno della settimana basta, sono 7 giorni di fila); la data intera nel suggerimento.
      const li = el('li', n ? 'a-yes' : null); li.title = new Date(t).toLocaleDateString('it-IT', {weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome'});
      li.append(el('span', null, i === 0 ? 'oggi' : i === 1 ? 'ieri' : new Date(t).toLocaleDateString('it-IT', {weekday: 'short', timeZone: 'Europe/Rome'})), el('b', null, n ? '+' + n : '0'));
      week.append(li);
    }
    // Arrivi recenti: solo ora e quanti, dal più recente (al massimo 12).
    const times = el('ul', 'a-times');
    for (const e of [...recent].reverse().slice(0, 12)) { const t = Date.parse(e.at), li = el('li'); li.append(el('time', null, (dayName(t, now) === 'oggi' ? '' : dayName(t, now) + ' ') + hm(t)), el('b', null, '+' + e.n)); times.append(li); }
    if (!recent.length) times.append(el('li', 'a-none', ready ? 'Nessun nuovo iscritto negli ultimi 7 giorni.' : 'Prima raccolta: da adesso ogni nuovo arrivo comparirà qui.'));
    host.replaceChildren(tiles, el('h3', null, 'Ultimi 7 giorni'), week, el('h3', null, 'Arrivi recenti'), times);
  }
  root.DipArrivi = {group, last24, render};
})(globalThis);
