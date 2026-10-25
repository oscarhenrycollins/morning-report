'use strict';
/* App-item Reply uses only the shared shell draft capability. No session/run/send API. */
(() => {
  function payload(date, text, start, end) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !text.trim()) throw new Error('Select part of the report to reply.');
    if (text.length > 32000) throw new Error('Select a shorter passage (up to 32,000 characters).');
    // Stable bounded item identity, including content as editions can be corrected in place.
    // Not an authorization token; the shell owns source admission and draft storage.
    let a = 2166136261, b = 5381;
    for (let i = 0; i < text.length; i++) {
      a = Math.imul(a ^ text.charCodeAt(i), 16777619);
      b = Math.imul(b, 33) ^ text.charCodeAt(i);
    }
    return { id: 'mr-' + date + '-' + start + '-' + end + '-' + (a >>> 0).toString(16) + (b >>> 0).toString(16),
      title: 'Morning Report · ' + date, message: text };
  }

  function bind({ paper, button, say, host = () => window.WizardApp }) {
    let date = null, selected = null, pressing = false;
    function capture() {
      if (pressing) return;
      const s = window.getSelection();
      selected = null;
      if (date && s && !s.isCollapsed && s.rangeCount === 1) {
        const r = s.getRangeAt(0);
        if (paper.contains(r.startContainer) && paper.contains(r.endContainer)) {
          const before = r.cloneRange(); before.selectNodeContents(paper); before.setEnd(r.startContainer, r.startOffset);
          const text = s.toString();
          if (text.trim()) selected = { date, text, start: before.toString().length, end: before.toString().length + text.length };
        }
      }
      button.hidden = !selected;
      place();
    }
    /* Float Reply just above the selected passage (below it when there is no room above),
     * kept inside the window and following the text as the report scrolls. */
    function place() {
      if (!selected) return;
      const s = window.getSelection();
      if (!s || !s.rangeCount) return;
      const rects = [...s.getRangeAt(0).getClientRects()].filter((r) => r.width || r.height);
      if (!rects.length) return;
      const first = rects[0], last = rects[rects.length - 1];
      const w = button.offsetWidth || 72, h = button.offsetHeight || 40, gap = 8, vw = document.documentElement.clientWidth, vh = window.innerHeight;
      let top = first.top - h - gap;
      if (top < gap) top = last.bottom + gap;
      top = Math.max(gap, Math.min(vh - h - gap, top));
      const left = Math.max(gap, Math.min(vw - w - gap, first.left + first.width / 2 - w / 2));
      button.style.left = Math.round(left) + 'px';
      button.style.top = Math.round(top) + 'px';
    }
    document.addEventListener('selectionchange', capture);
    document.addEventListener('scroll', () => { if (!pressing) place(); }, true);
    window.addEventListener('resize', () => { if (!pressing) place(); });
    button.addEventListener('pointerdown', (e) => {
      capture(); pressing = true;
      // Keep the selected passage on mouse/touch activation rather than selecting the control.
      e.preventDefault();
    });
    window.addEventListener('pointerup', () => { pressing = false; });
    window.addEventListener('pointercancel', () => { pressing = false; capture(); });
    button.addEventListener('click', () => {
      if (!selected || selected.date !== date) return;
      try {
        const data = payload(date, selected.text, selected.start, selected.end);
        const nav = host()?.nav;
        if (typeof nav?.openContextDraft !== 'function') throw new Error('Reply needs a Wizard shell with Morning Report draft support. Nothing sent.');
        const receipt = nav.openContextDraft(data);
        if (receipt?.kind !== 'unsent-draft' || receipt.sent !== false) throw new Error('Could not confirm an unsent draft. Nothing was sent by Morning Report.');
        say('Reply opened in Chats. Nothing sent.', 'note');
      } catch (error) {
        // Host admission may reject this app even when Notifications is supported. Never bypass it.
        say(error.message === 'Context draft unavailable' ? 'Reload Wizard (refresh the whole page) to turn on Reply. Nothing sent.' : (error.message || 'Could not open Chats. Nothing sent.'), 'error');
      }
    });
    return { clear(nextDate = null) {
      date = nextDate; selected = null; pressing = false; button.hidden = true;
      const s = window.getSelection();
      if (s?.rangeCount && (paper.contains(s.anchorNode) || paper.contains(s.focusNode))) s.removeAllRanges();
    } };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { payload };
  else window.MorningReply = Object.freeze({ bind });
})();
