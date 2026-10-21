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
    document.querySelector('.mr-scroll').scrollTop = 0;
    el('pick').value = data.date;
    el('older').disabled = !data.older;
    el('newer').disabled = !data.newer;
    const pdf = el('pdf');
    pdf.hidden = !data.pdf;
    if (data.pdf) pdf.href = 'api/reports/' + data.date + '.pdf';
    document.title = 'Morning Report · ' + shortDate(data.date);
    say(longDate(data.date));
    markSeen();
  } catch (error) { say(error.message, 'error'); }
}

el('pick').addEventListener('change', (e) => show(e.target.value));
el('older').addEventListener('click', () => current?.older && show(current.older));
el('newer').addEventListener('click', () => current?.newer && show(current.newer));
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

/* Unread badge: editions newer than the newest one you have actually looked at. The shell shows the
 * count on this app's dock/bar mark (WizardApp.badge); a report counts as read once it is on screen
 * in a visible window. "Seen" is the newest edition date read, kept on this device. */
const SEEN = 'morning-report.seen';
const seen = () => { try { return localStorage.getItem(SEEN) || ''; } catch (e) { return ''; } };
const looking = () => !document.hidden && (window.WizardApp?.view?.isVisible?.() ?? true);
function badge() {
  const eds = reports.filter((r) => r.markdown);
  // First run on a device: only the newest edition counts as unread, never the whole archive.
  if (!seen() && eds.length > 1) { try { localStorage.setItem(SEEN, eds[1].date); } catch (e) {} }
  const s = seen(), n = eds.filter((r) => r.date > s).length;
  try { window.WizardApp?.badge?.set(n); } catch (e) {}
}
function markSeen() {
  if (!current?.date || !looking()) return;
  if (current.date > seen()) { try { localStorage.setItem(SEEN, current.date); } catch (e) {} }
  badge();
}
addEventListener('storage', (e) => { if (e.key === SEEN) badge(); });

async function refresh() {
  try {
    const newest = reports.find((r) => r.markdown)?.date;
    const d = await getJSON('api/reports');
    const top = (d.reports || []).find((r) => r.markdown)?.date;
    if (top && top !== newest) { const onNewest = current?.date === newest; reports = d.reports; fillPicker(); if (onNewest) await show(top); }
  } catch (e) {}
  badge(); markSeen();
}

load().then(() => { badge(); markSeen(); });
// A new edition arrives each morning: check every few minutes while open, and whenever it comes back into view.
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
setInterval(refresh, 5 * 60 * 1000);
// Read only when you actually look: re-check visibility often (cheap, no network).
setInterval(markSeen, 2000);
