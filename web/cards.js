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
  /* Whole dollars and whole percents (anything above zero but under 1 shows as <$1 / <1%): the card is for a glance. */
  const money = (v, sign) => {
    const a = Math.abs(v), s = a >= 0.005 && a < 1 ? '<$1' : '$' + a.toLocaleString('en-US', { maximumFractionDigits: 0 });
    return sign ? (v >= 0 ? '+' : '−') + s : (v < 0 ? '−' : '') + s;
  };
  const cents = (p) => { const c = Math.round(p * 1000) / 10; return (Number.isInteger(c) ? c : c.toFixed(1)) + '¢'; };
  const pct = (v) => { const a = Math.abs(v); return (v >= 0 ? '+' : '−') + (a >= 0.005 && a < 1 ? '<1' : a.toFixed(0)) + '%'; };
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

  /* Selling: things the owner has listed for sale, one line each, same look as a portfolio.
   *   {"kind":"selling","v":1,"currency":"฿","usdRate":0.0296,"items":[{"name","url","price","market","state","buyers","newBuyers","soldPrice"}]}
   * Line: name · bar · ฿asking · mkt ฿middle (≈ USD caption) · buyers (or Deal/Sold). Every bar shares one scale (the
   * biggest price on the card) so items compare by size; asking above the market middle draws hatched red, below dotted green.
   * With 2+ items a total line comes first, amounts only (no bar). */
  function selling(d) {
    const cur = typeof d.currency === 'string' && d.currency.length <= 3 ? d.currency : '';
    const rate = num(d.usdRate) && d.usdRate > 0 ? d.usdRate : null;
    const amt = (v) => cur + Math.round(Math.abs(v)).toLocaleString('en-US');
    const usd = (v) => { const x = v * rate; return '$' + (x >= 100 ? Math.round(x / 10) * 10 : Math.round(x)).toLocaleString('en-US'); };
    const items = (d.items || []).map((it) => ({ it, price: num(it.price) ?? 0, market: num(it.market) }));
    const scale = Math.max(...items.map((x) => Math.max(x.price, x.market ?? 0)), 0.01);
    const list = h('ul', 'mr-card mr-portfolio mr-selling');
    const status = (it) => {
      const sold = num(it.soldPrice);
      if (it.state === 'sold') return ['Sold' + (sold ? ' ' + amt(sold) : ''), 'up'];
      if (it.state === 'pending') return ['Deal' + (sold ? ' ' + amt(sold) : ''), 'up'];
      const b = num(it.buyers) ?? 0, n = num(it.newBuyers) ?? 0;
      if (!b) return ['No buyers', 'flat'];
      return [`${b} buyer${b === 1 ? '' : 's'}${n ? ` (${n} new)` : ''}`, 'up'];
    };
    const row = (name, price, market, url, st, cls, withBar) => {
      const li = h('li', 'mr-pf' + (cls ? ' ' + cls : ''));
      const n = h(url ? 'a' : 'span', 'mr-pf-name', name);
      if (url) { n.href = url; n.target = '_blank'; n.rel = 'noopener noreferrer'; }
      const b = !withBar ? h('span', 'mr-pf-bar mr-pf-nobar')
        : bar(price, market ?? price, scale);
      const a = h('span', 'mr-pf-amt');
      a.append(h('span', 'mr-sl-main', amt(price) + (market ? ` · mkt ${amt(market)}` : '')));
      if (rate) a.append(h('span', 'mr-sl-usd', '≈ ' + usd(price) + (market ? ` · mkt ${usd(market)}` : '')));
      li.append(n, b, a, h('span', 'mr-pf-pl mr-' + st[1], st[0]));
      li.setAttribute('aria-label', `${name}: asking ${amt(price)}${rate ? ' (about ' + usd(price) + ')' : ''}${market ? ', typical ' + amt(market) : ''}, ${st[0]}`);
      return li;
    };
    if (items.length > 1) {
      const price = items.reduce((s, x) => s + x.price, 0);
      const market = items.every((x) => x.market) ? items.reduce((s, x) => s + x.market, 0) : null;
      const buyers = items.reduce((s, x) => s + (num(x.it.buyers) ?? 0), 0);
      const fresh = items.reduce((s, x) => s + (num(x.it.newBuyers) ?? 0), 0);
      list.append(row(`${items.length} items`, price, market, '', status({ buyers, newBuyers: fresh }), 'mr-pf-total', false));
    }
    for (const x of items) list.append(row(String(x.it.name || 'Item'), x.price, x.market, safeUrl(x.it.url || ''), status(x.it), '', true));
    return list;
  }

  const kinds = { portfolio, selling };
  /* Returns a node for a fenced block: a card for a known `lang`, else <pre>. */
  function render(lang, text) {
    if (kinds[lang]) {
      try { const d = JSON.parse(text); if (d && typeof d === 'object') return kinds[lang](d); } catch (e) { /* fall through */ }
    }
    const pre = h('pre', 'mr-pre'); pre.append(h('code', '', text)); return pre;
  }
  window.MorningCards = { render, kinds: Object.keys(kinds) };
})();
