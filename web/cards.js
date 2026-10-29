/* Cards: fenced blocks in a report that the app draws instead of printing as text.
 *   ```portfolio
 *   {"kind":"portfolio","v":1,"value":..,"cost":..,"cash":..,"positions":[{..,"history":[[unix,price],..]}]}
 *   ```
 * Built from DOM nodes only (report text never goes through innerHTML). A block that is not valid
 * JSON of a known kind falls back to plain preformatted text, so a bad block is visible, never hidden.
 * Charts are ordered-dither (Bayer 4x4) fills on a canvas, the newsprint look of the rest of the sheet. */
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
  const monthYear = (iso) => { const d = new Date(iso + 'T12:00:00Z'); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }); };
  const dayMonth = (t) => new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const INK = { up: '#1d6b45', down: '#a3352a', flat: '#3b3830', rule: '#1b1a17', faint: '#b9b09c' };

  /* One price chart: dithered area under the line, the line, a dashed "your average" rule and a live dot. */
  function chart(pos) {
    const wrap = h('div', 'mr-chart');
    const canvas = h('canvas');
    const hist = (pos.history || []).filter((p) => Array.isArray(p) && num(p[0]) != null && num(p[1]) != null);
    const avg = num(pos.avg), price = num(pos.price);
    const t = tone(price != null && avg != null ? price - avg : 0);
    canvas.setAttribute('role', 'img');
    const lo = hist.length ? Math.min(...hist.map((p) => p[1])) : 0, hi = hist.length ? Math.max(...hist.map((p) => p[1])) : 1;
    canvas.setAttribute('aria-label', `${pos.outcome || ''} price over the last 30 days, from ${cents(hist[0]?.[1] ?? 0)} to ${cents(hist.at(-1)?.[1] ?? 0)}, low ${cents(lo)}, high ${cents(hi)}`);
    wrap.append(canvas);
    const axis = h('div', 'mr-axis');
    if (hist.length > 1) { axis.append(h('span', '', dayMonth(hist[0][0])), h('span', '', '30 days'), h('span', '', 'now')); }
    wrap.append(axis);

    function draw() {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (!W || !H || hist.length < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      const g = canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      let min = Math.min(lo, avg ?? lo), max = Math.max(hi, avg ?? hi);
      const pad = Math.max((max - min) * 0.18, 0.02); min = Math.max(0, min - pad); max = Math.min(1, max + pad);
      const t0 = hist[0][0], t1 = hist.at(-1)[0] || t0 + 1;
      const X = (ts) => 2 + (ts - t0) / (t1 - t0 || 1) * (W - 10);
      const Y = (p) => 6 + (1 - (p - min) / (max - min || 1)) * (H - 12);
      const yAt = (x) => { // line height at pixel x (linear between points)
        for (let i = 1; i < hist.length; i++) {
          const xa = X(hist[i - 1][0]), xb = X(hist[i][0]);
          if (x <= xb) { const k = xb === xa ? 0 : (x - xa) / (xb - xa); return Y(hist[i - 1][1] + (hist[i][1] - hist[i - 1][1]) * k); }
        }
        return Y(hist.at(-1)[1]);
      };
      // Ordered dither: dense at the line, thinning to the floor.
      const cell = 2, x0 = X(t0), x1 = X(t1);
      g.fillStyle = INK[t];
      for (let x = Math.floor(x0 / cell) * cell; x <= x1; x += cell) {
        const top = yAt(x + cell / 2);
        for (let y = Math.ceil(top / cell) * cell; y < H; y += cell) {
          const depth = (y - top) / Math.max(H - top, 1);
          const density = 0.62 * (1 - depth) ** 1.6;
          if (density > BAYER[((y / cell) % 4) * 4 + ((x / cell) % 4)]) g.fillRect(x, y, cell, cell);
        }
      }
      // Your average price: a dashed rule with a label.
      if (avg != null && avg >= min && avg <= max) {
        g.save(); g.strokeStyle = INK.rule; g.globalAlpha = 0.55; g.setLineDash([4, 4]); g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, Math.round(Y(avg)) + 0.5); g.lineTo(W, Math.round(Y(avg)) + 0.5); g.stroke(); g.restore();
        g.font = '600 10.5px ui-monospace, SFMono-Regular, Menlo, monospace'; g.fillStyle = INK.flat;
        const label = 'your avg ' + cents(avg), tw = g.measureText(label).width;
        const ly = Y(avg) + (Y(avg) > H - 16 ? -5 : 13);
        g.fillStyle = '#fffdf8'; g.fillRect(4, ly - 10, tw + 6, 13); g.fillStyle = INK.flat; g.fillText(label, 7, ly);
      }
      // The price line on top.
      g.strokeStyle = INK.rule; g.lineWidth = 1.6; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); hist.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); g.stroke();
      const ex = X(t1), ey = Y(hist.at(-1)[1]);
      g.fillStyle = INK[t]; g.beginPath(); g.arc(ex, ey, 6, 0, Math.PI * 2); g.globalAlpha = 0.22; g.fill();
      g.globalAlpha = 1; g.beginPath(); g.arc(ex, ey, 3.2, 0, Math.PI * 2); g.fill();
    }
    if (hist.length < 2) { wrap.classList.add('mr-chart-empty'); canvas.remove(); wrap.prepend(h('p', 'mr-muted', 'No price history yet.')); }
    else if ('ResizeObserver' in window) new ResizeObserver(draw).observe(canvas);
    else requestAnimationFrame(draw);
    return wrap;
  }

  function stat(label, value, cls, sub) {
    const s = h('div', 'mr-stat' + (cls ? ' ' + cls : ''));
    s.append(h('span', 'mr-stat-k', label), h('span', 'mr-stat-v', value));
    if (sub) s.append(h('span', 'mr-stat-s', sub));
    return s;
  }

  function position(pos) {
    const card = h('section', 'mr-pos');
    const price = num(pos.price), avg = num(pos.avg), cost = num(pos.cost) ?? 0, value = num(pos.value) ?? cost;
    const pnl = value - cost, pnlPct = cost ? (pnl / cost) * 100 : 0;
    const head = h('div', 'mr-pos-head');
    const who = h('div', 'mr-pos-who');
    const name = h('h3', 'mr-pos-name');
    const url = safeUrl(pos.url || '');
    if (url) { const a = h('a', '', pos.name || 'Market'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; name.append(a); }
    else name.textContent = pos.name || 'Market';
    who.append(h('span', 'mr-chip mr-chip-' + String(pos.outcome || 'yes').toLowerCase(), pos.outcome || 'Yes'), name);
    const sub = [pos.market, pos.ends ? 'resolves ' + monthYear(pos.ends) : '', pos.state && pos.state !== 'open' ? 'market ' + pos.state : ''].filter(Boolean).join(' · ');
    if (sub) who.append(h('p', 'mr-pos-sub', sub));
    head.append(who);
    if (price != null) {
      const quote = h('div', 'mr-quote');
      quote.append(h('span', 'mr-quote-px', cents(price)));
      const prev = num(pos.prev);
      if (prev != null) { const d = price - prev; quote.append(h('span', 'mr-delta mr-' + tone(d), `${arrow(d)} ${cents(Math.abs(d))} 24h`)); }
      quote.append(h('span', 'mr-quote-k', Math.round(price * 100) + '% chance'));
      head.append(quote);
    }
    card.append(head, chart(pos));
    const stats = h('div', 'mr-stats');
    stats.append(
      stat('Shares', (num(pos.shares) ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })),
      stat('Avg price', avg != null ? cents(avg) : '—'),
      stat('Cost', money(cost)),
      stat('Value', money(value)),
      stat('P&L', money(pnl, true), 'mr-' + tone(pnl), cost ? pct(pnlPct) : ''),
    );
    card.append(stats);
    return card;
  }

  function portfolio(d) {
    const box = h('div', 'mr-card mr-portfolio');
    const value = num(d.value) ?? 0, cost = num(d.cost) ?? 0, pnl = value - cost;
    const top = h('div', 'mr-card-top');
    const total = h('div', 'mr-total');
    total.append(h('span', 'mr-total-v', money(value)));
    const gain = h('div', 'mr-gain mr-' + tone(pnl));
    gain.append(h('span', 'mr-gain-v', `${arrow(pnl)} ${money(pnl, true)}`), h('span', 'mr-gain-k', cost ? pct((pnl / cost) * 100) + ' unrealized' : 'unrealized'));
    top.append(h('span', 'mr-total-k', `${d.title || 'Portfolio'} · open positions · at ${d.mark === 'mid' ? 'mid price' : String(d.mark || 'last trade')}`), total, gain);
    box.append(top);
    // A cost-vs-value bar: the dithered part is profit (or the hatched gap, loss).
    if (cost > 0 && value >= 0) {
      const bar = h('div', 'mr-bar-cv');
      const big = Math.max(cost, value), c = h('span', 'mr-bar-cost'), g = h('span', 'mr-bar-gap mr-' + tone(pnl));
      c.style.width = (Math.min(cost, value) / big) * 100 + '%'; g.style.width = (Math.abs(pnl) / big) * 100 + '%';
      bar.append(c, g); bar.setAttribute('aria-hidden', 'true');
      box.append(bar);
    }
    const pills = h('div', 'mr-pills');
    if (num(d.cash) != null) pills.append(stat('Cash', money(d.cash)));
    if (num(d.bonus)) pills.append(stat('Bonus', money(d.bonus)));
    if (num(d.openOrders) != null) pills.append(stat('Resting orders', String(d.openOrders)));
    box.append(pills);
    for (const p of d.positions || []) box.append(position(p));
    if (!(d.positions || []).length) box.append(h('p', 'mr-muted', 'No open positions.'));
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
