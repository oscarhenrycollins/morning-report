/* Cards: fenced blocks in a report that the app draws instead of printing as text.
 *   ```portfolio
 *   {"kind":"portfolio","v":1,"value":..,"cost":..,"cash":..,"positions":[{..,"history":[[unix,price],..]}]}
 *   ```
 * Built from DOM nodes only (report text never goes through innerHTML). A block that is not valid
 * JSON of a known kind falls back to plain preformatted text, so a bad block is visible, never hidden.
 * A portfolio is a total line plus one line per position: put in → worth now, a bar, and the P&L. */
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

  /* Short label: the subject's surname ("Benjamin Netanyahu" -> Netanyahu), else the market title. */
  const label = (p) => { const n = String(p.name || p.market || 'Market').trim(); return p.name ? n.split(/\s+/).pop() : n; };

  /* Put in vs worth now: solid = money in (or what is left of it), dotted green = gain, hatched red = loss.
     Widths are shares of `scale` (the biggest amount on the card) so rows compare. */
  function bar(cost, value, scale) {
    const b = h('span', 'mr-pf-bar'); b.setAttribute('aria-hidden', 'true');
    const base = h('span', 'mr-pf-in'), diff = h('span', 'mr-pf-diff mr-' + tone(value - cost));
    base.style.width = (Math.min(cost, value) / scale) * 100 + '%';
    diff.style.width = (Math.abs(value - cost) / scale) * 100 + '%';
    b.append(base, diff);
    return b;
  }

  /* One line: name · bar · $in → $now · ±$P&L ±%. */
  function line(name, cost, value, scale, url, cls) {
    const li = h('li', 'mr-pf' + (cls ? ' ' + cls : ''));
    const pnl = value - cost;
    const n = h(url ? 'a' : 'span', 'mr-pf-name', name);
    if (url) { n.href = url; n.target = '_blank'; n.rel = 'noopener noreferrer'; }
    li.append(n, bar(cost, value, scale), h('span', 'mr-pf-amt', `${money(cost)} → ${money(value)}`),
      h('span', 'mr-pf-pl mr-' + tone(pnl), `${money(pnl, true)} ${cost ? pct((pnl / cost) * 100) : ''}`.trim()));
    li.setAttribute('aria-label', `${name}: put in ${money(cost)}, worth ${money(value)}, ${money(pnl, true)}${cost ? ', ' + pct((pnl / cost) * 100) : ''}`);
    return li;
  }

  function portfolio(d) {
    const ps = (d.positions || []).map((p) => ({ p, cost: num(p.cost) ?? 0, value: num(p.value) ?? num(p.cost) ?? 0 }));
    const cost = num(d.cost) ?? ps.reduce((s, x) => s + x.cost, 0), value = num(d.value) ?? ps.reduce((s, x) => s + x.value, 0);
    const list = h('ul', 'mr-card mr-portfolio');
    const scaleRows = Math.max(...ps.map((x) => Math.max(x.cost, x.value)), 0.01);
    list.append(line('Total', cost, value, Math.max(cost, value, 0.01), '', 'mr-pf-total'));
    if (ps.length > 1) for (const x of ps) list.append(line(label(x.p), x.cost, x.value, scaleRows, safeUrl(x.p.url || '')));
    return list;
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
