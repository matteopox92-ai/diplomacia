'use strict';
// Tabelle ordinabili: clic sull'intestazione = decrescente, secondo clic = crescente. L'ordine resta quando i dati si aggiornano.
(() => {
  const num = text => {
    const t = String(text).trim().replace(/\s/g, '').replace('−', '-').replace(/%$/, '');
    if (!/^[+-]?[\d.]+(,\d+)?$/.test(t)) return null;
    return Number(t.replace(/\./g, '').replace(',', '.'));
  };
  function setup(table) {
    const body = table.tBodies[0], heads = [...(table.tHead?.rows[0]?.cells || [])];
    if (!body || !heads.length) return;
    let col = -1, dir = -1, observer = null;
    function sort() {
      if (col < 0) return;
      const rows = [...body.rows], key = r => r.cells[col]?.textContent ?? '';
      const numeric = rows.filter(r => num(key(r)) !== null).length >= rows.length / 2;
      rows.sort((a, b) => {
        if (numeric) { const x = num(key(a)), y = num(key(b)); if (x === null) return 1; if (y === null) return -1; return (x - y) * dir; }
        return key(a).localeCompare(key(b), 'it') * dir;
      });
      // Se l'ordine è già giusto non tocca nulla; le modifiche fatte qui vengono scartate dall'osservatore (niente cicli).
      if (rows.every((r, i) => body.rows[i] === r)) return;
      body.append(...rows); observer?.takeRecords();
    }
    heads.forEach((th, i) => {
      th.classList.add('sortable'); th.tabIndex = 0; th.setAttribute('role', 'button'); th.title = 'Ordina';
      // Primo clic: numeri dal più grande, testi dalla A alla Z.
      const numericCol = () => { const rows = [...body.rows]; return rows.filter(r => num(r.cells[i]?.textContent ?? '') !== null).length >= rows.length / 2; };
      const go = () => { dir = col === i ? -dir : numericCol() ? -1 : 1; col = i; heads.forEach(h => h.removeAttribute('aria-sort')); th.setAttribute('aria-sort', dir < 0 ? 'descending' : 'ascending'); sort(); };
      th.addEventListener('click', go); th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    observer = new MutationObserver(() => sort());
    observer.observe(body, {childList: true});
  }
  document.querySelectorAll('table.sortable-table').forEach(setup);
})();
