'use strict';
const el = (id) => document.getElementById(id);
const hosted = document.documentElement.classList.contains('wz-hosted');
let reports = [], current = null;

function say(text, kind = '') {
  const s = el('status');
  s.classList.toggle('wz-sr', !kind);
  s.classList.toggle('note', kind === 'note');
  s.textContent = text;
}
async function getJSON(path) {
  const r = await fetch(path, { cache: 'no-store' });
  let body = {};
  try { body = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(body.error || 'Could not load reports. Try again.');
  return body;
}
const longDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(innerWidth > 480 ? { year: 'numeric' } : {}), timeZone: 'UTC' });

function fillPicker() {
  const pick = el('pick');
  pick.replaceChildren();
  for (const r of reports.filter((x) => x.markdown)) {
    const o = document.createElement('option');
    o.value = r.date; o.textContent = shortDate(r.date);
    pick.append(o);
  }
  const n = reports.filter((x) => x.markdown).length;
  el('count').textContent = n ? `${n} edition${n === 1 ? '' : 's'}` : '';
}

async function show(date) {
  try {
    const data = await getJSON('api/reports/' + (date || 'latest'));
    current = data;
    const paper = el('paper');
    paper.replaceChildren(window.MorningMarkdown.render(data.markdown));
    paper.scrollIntoView?.({ block: 'start' });
    el('pick').value = data.date;
    el('older').disabled = !data.older;
    el('newer').disabled = !data.newer;
    const pdf = el('pdf');
    pdf.hidden = !data.pdf;
    if (data.pdf) pdf.href = 'api/reports/' + data.date + '.pdf';
    document.title = 'Morning Report · ' + shortDate(data.date);
    say(longDate(data.date));
  } catch (error) { say(error.message, 'error'); }
}

el('pick').addEventListener('change', (e) => show(e.target.value));
el('older').addEventListener('click', () => current?.older && show(current.older));
el('newer').addEventListener('click', () => current?.newer && show(current.newer));
el('print').addEventListener('click', () => window.print());
document.addEventListener('keydown', (e) => {
  if (e.target.closest('select, input, textarea')) return;
  if (e.key === 'ArrowLeft' && current?.older) show(current.older);
  if (e.key === 'ArrowRight' && current?.newer) show(current.newer);
});

async function load() {
  try {
    const data = await getJSON('api/reports');
    reports = data.reports || [];
    fillPicker();
    const any = reports.some((r) => r.markdown);
    el('empty').hidden = any;
    el('paper').hidden = !any;
    document.querySelector('.mr-bar').hidden = !any;
    const wanted = new URLSearchParams(location.search).get('date');
    if (any) await show(wanted && /^\d{4}-\d{2}-\d{2}$/.test(wanted) ? wanted : (current?.date || null));
  } catch (error) { say(error.message, 'error'); }
}

/* Back contract (Wizard OS): no nested views, so the shell takes the step. Never push history in a frame. */
window.__wizardCloseOverlay = () => false;
if (!hosted) {
  let warnAt = 0;
  history.pushState({ wzGuard: 1 }, '', location.href);
  addEventListener('popstate', () => {
    if (Date.now() - warnAt < 2000) { history.back(); return; }
    warnAt = Date.now();
    say('Press back again to exit', 'note');
    history.pushState({ wzGuard: 1 }, '', location.href);
  });
}

load();
// A new edition arrives each morning; refresh the list when the app comes back into view.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const newest = reports.find((r) => r.markdown)?.date;
  getJSON('api/reports').then((d) => {
    const top = (d.reports || []).find((r) => r.markdown)?.date;
    if (top && top !== newest) { const onNewest = current?.date === newest; reports = d.reports; fillPicker(); if (onNewest) show(top); }
  }).catch(() => {});
});
