'use strict';
// Real staged HTTP app + synthetic report mount. WizardApp is an explicit contract stub,
// NOT proof that the installed shell admits Morning Report (currently Notifications-only).
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || '/home/oscar/wizard-mobile/node_modules/playwright');
const {payload} = require('../web/reply');
const base = process.env.MR_STAGE_URL || 'http://127.0.0.1:18812';
async function select(page, selector = '#paper p', all = false) {
  return page.evaluate(({selector, all}) => {
    const node = document.querySelector(selector), r = document.createRange();
    r.selectNodeContents(node);
    if (!all && node.firstChild.nodeType === Node.TEXT_NODE) { r.setStart(node.firstChild, 6); r.setEnd(node.firstChild, 22); }
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const before = r.cloneRange(); before.selectNodeContents(document.querySelector('#paper')); before.setEnd(r.startContainer, r.startOffset);
    return {text:s.toString(), start:before.toString().length, end:before.toString().length+s.toString().length};
  }, {selector, all});
}
(async () => {
  const browser = await chromium.launch({headless:true});
  const results = [];
  try {
    for (const mobile of [false, true]) {
      const ctx = await browser.newContext({viewport:{width:mobile?390:1280,height:850}, isMobile:mobile, hasTouch:mobile});
      const writes = [], errors = [];
      await ctx.route('**/*', async route => {
        const req = route.request();
        if (!['GET','HEAD','OPTIONS'].includes(req.method())) { writes.push(req.url()); return route.abort(); }
        if (req.url().endsWith('/wizard-os-home/core/app-client.js')) return route.fulfill({contentType:'text/javascript', body:'/* synthetic shell capability supplied by test */'});
        if (!req.url().startsWith(base+'/')) return route.abort();
        return route.continue();
      });
      await ctx.addInitScript(() => {
        window.calls = []; window.replyMode = 'ok';
        window.WizardApp = { badge:{set(){}}, view:{isVisible:()=>true}, nav:{openContextDraft(data) {
          window.calls.push(data);
          if (window.replyMode === 'throw') throw new Error('Context draft unavailable');
          if (window.replyMode === 'bad') return {kind:'sent',sent:true};
          if (window.replyMode === 'missingSent') return {kind:'unsent-draft'};
          return {kind:'unsent-draft',sent:false};
        }}};
      });
      const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(base+'/morning-report/'); await page.waitForLoadState('networkidle');
      await page.locator('#paper p').first().waitFor();
      const reply = page.locator('#reply');
      assert.equal(await reply.isVisible(),false);
      const selected = await select(page);
      await reply.waitFor({state:'visible'});
      await page.keyboard.press('Shift+ArrowLeft');
      assert.equal(await page.locator('#pick').inputValue(),'2026-01-02');
      // Restore the exact range after exercising keyboard selection.
      await select(page);
      if (mobile) await reply.tap(); else await reply.click();
      assert.deepEqual(await page.evaluate(()=>calls),[payload('2026-01-02',selected.text,selected.start,selected.end)]);
      assert.match(await page.locator('#status').innerText(),/Nothing sent/);
      assert.equal(await page.evaluate(()=>getSelection().toString()),selected.text);
      // Keyboard activation and repeated item identity.
      await reply.focus(); await page.keyboard.press('Enter');
      assert.deepEqual(await page.evaluate(()=>calls[1]),payload('2026-01-02',selected.text,selected.start,selected.end));
      for (const mode of ['bad','missingSent','throw']) {
        await page.evaluate(mode=>{replyMode=mode;},mode); await reply.click();
        assert.match(await page.locator('#status').innerText(), mode==='throw'?/does not support Morning Report/:/Could not confirm/);
      }
      await page.evaluate(()=>{delete WizardApp.nav;}); await reply.click();
      assert.match(await page.locator('#status').innerText(),/needs a Wizard shell/);
      await select(page,'.wz-head h1',true);
      await reply.waitFor({state:'hidden'});
      // Crossing the paper boundary must also be rejected.
      await page.evaluate(()=>{const r=document.createRange();r.setStart(document.querySelector('#paper p').firstChild,0);r.setEndAfter(document.querySelector('.mr-reply'));const s=getSelection();s.removeAllRanges();s.addRange(r);});
      await page.waitForTimeout(50); assert.equal(await reply.isVisible(),false);
      await select(page); await reply.waitFor({state:'visible'});
      await page.locator('#older').click();
      await page.waitForFunction(()=>document.querySelector('#pick').value==='2026-01-01');
      assert.equal(await reply.isVisible(),false);
      assert.equal(await page.evaluate(()=>getSelection().toString()),'');
      const beforeCalls = await page.evaluate(()=>calls.length);
      await page.locator('#newer').click(); await page.waitForFunction(()=>document.querySelector('#pick').value==='2026-01-02');
      assert.equal(await reply.isVisible(),false);
      // Cross-node selected markup remains text data, never executable DOM.
      const rich = await select(page,'#paper p',true); await reply.waitFor({state:'visible'});
      await page.evaluate(()=>{WizardApp.nav={openContextDraft(data){calls.push(data);return {kind:'unsent-draft',sent:false};}};});
      await reply.click();
      assert.deepEqual(await page.evaluate(()=>calls.at(-1)),payload('2026-01-02',rich.text,rich.start,rich.end));
      assert.equal(await page.locator('#paper img').count(),0);
      assert.equal(await page.evaluate(()=>calls.length),beforeCalls+1);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
      const box = await reply.boundingBox(); assert.ok(box.height>=44 && box.width>=44);
      await page.screenshot({path:(process.env.MR_QA_OUTPUT || '/home/oscar/.hermes/cache/scratch/mr-reply-qa')+'/'+(mobile?'mobile':'desktop')+'.png',fullPage:true});
      assert.deepEqual(writes,[]); assert.deepEqual(errors,[]);
      results.push({viewport:mobile?'390 mobile touch':'1280 desktop',exact_payload:true,keyboard:true,preserve_selection:true,receipt_errors:true,outside_rejected:true,date_clears:true,safe_text:true,blocked_writes:writes,page_errors:errors});
      await ctx.close();
    }
    console.log(JSON.stringify({PASS:true,scope:'staged real HTTP + synthetic reports + shell contract stub; not full-shell integration',results},null,2));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
