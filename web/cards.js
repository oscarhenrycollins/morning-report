/* Cards: fenced blocks in a report that the app draws instead of printing as text.
 *   ```portfolio
 *   {"kind":"portfolio","v":1,"value":..,"cost":..,"cash":..,"positions":[{..,"history":[[unix,price],..]}]}
 *   ```
 * Built from DOM nodes only (report text never goes through innerHTML). A block that is not valid
 * JSON of a known kind falls back to plain preformatted text, so a bad block is visible, never hidden.
 * A portfolio is one total line plus one ticker-style line per position. */
(() => {
  'use strict';
  const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const num = (x) => (typeof x === 'number' && isFinite(x) ? x : null);
  const money = (v, sign) => {
    const s = '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return sign ? (v >= 0 ? '+' : '−') + s : (v < 0 ? '−' : '') + s;
  };
  const cents = (p) => { const c = Math.round(p * 1000) / 10; return (Number.isInteger(c) ? c : c.toFixed(1)) + '¢'; };
  const pct = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : 1) + '%';
  const tone = (v) => (v > 0.00001 ? 'up' : v < -0.00001 ? 'down' : 'flat');
  const arrow = (v) => (v > 0.00001 ? '▲' : v < -0.00001 ? '▼' : '■');
  const safeUrl = (u) => { try { const x = new URL(u); return /^https:$/.test(x.protocol) ? x.href : null; } catch (e) { return null; } };

  /* Short ticker-style label: the subject's surname ("Benjamin Netanyahu" -> NETANYAHU), else the market title. */
  const ticker = (p) => {
    const n = String(p.name || p.market || 'Market').trim();
    return (p.name ? n.split(/\s+/).pop() : n).toUpperCase();
  };

  /* One line per position: TICKER  side  price  24h  P&L. Scales to twenty positions. */
  function row(pos) {
    const li = h('li', 'mr-tk');
    const price = num(pos.price), cost = num(pos.cost) ?? 0, value = num(pos.value) ?? cost, pnl = value - cost;
    const url = safeUrl(pos.url || '');
    const sym = h(url ? 'a' : 'span', 'mr-tk-sym', ticker(pos));
    if (url) { sym.href = url; sym.target = '_blank'; sym.rel = 'noopener noreferrer'; }
    sym.title = [pos.name, pos.market].filter(Boolean).join(' — ');
    li.append(sym, h('span', 'mr-tk-side', String(pos.outcome || 'Yes').toUpperCase()));
    li.append(h('span', 'mr-tk-px', price != null ? cents(price) : '—'));
    const prev = num(pos.prev);
    li.append(h('span', 'mr-tk-d mr-' + tone(price != null && prev != null ? price - prev : 0),
      price != null && prev != null ? `${arrow(price - prev)}${cents(Math.abs(price - prev))}` : ''));
    const pl = h('span', 'mr-tk-pl mr-' + tone(pnl), money(pnl, true));
    if (cost) pl.append(h('span', 'mr-tk-pct', ' ' + pct((pnl / cost) * 100)));
    li.append(pl);
    return li;
  }

  function portfolio(d) {
    const box = h('div', 'mr-card mr-portfolio');
    const value = num(d.value) ?? 0, cost = num(d.cost) ?? 0, pnl = value - cost;
    const top = h('p', 'mr-tk-total');
    top.append(h('strong', '', money(value)), ' ', h('span', 'mr-' + tone(pnl), `${money(pnl, true)}${cost ? ' ' + pct((pnl / cost) * 100) : ''}`));
    if (num(d.cash) != null) top.append(h('span', 'mr-tk-cash', ` · cash ${money(d.cash + (num(d.bonus) || 0))}`));
    box.append(top);
    const list = h('ul', 'mr-tk-list');
    for (const p of d.positions || []) list.append(row(p));
    if ((d.positions || []).length) box.append(list);
    return box;
  }

  const kinds = { portfolio };
  /* Returns a node for a fenced block: a card for a known `lang`, else <pre>. */
  function render(lang, text) {
    if (kinds[lang]) {
      try { const d = JSON.parse(text); if (d && typeof d === 'object') return kinds[lang](d); } catch (e) { /* fall through */ }
    }
    const pre = h('pre', 'mr-pre'); pre.append(h('code', '', text)); return pre;
  }
  window.MorningCards = { render, kinds: Object.keys(kinds) };
})();
