# Selected-text Reply (0.5.0 candidate, not released)

Select text inside the report, then use **Reply** (mouse, touch or keyboard). The app supplies `{id,title,message}` to the existing synchronous `WizardApp.nav.openContextDraft` capability. The title includes the ISO report date; the message is exactly the selected visible text. There is deliberately no whole-report fallback: an accidental selection loss must not send a different scope to Chats. Ranges outside or crossing the report are rejected. Selection is cleared when date navigation starts; late edition loads cannot restore stale content. Passages above the shell's 32,000-character limit produce an error instead of being truncated.

Only `{kind:'unsent-draft',sent:false}` is success. The app never calls send, session creation or run APIs. Text stays data, rendered through the existing safe markdown renderer and textContent status messages.

## Release blocker: installed shell admission

Inspection of the running `wizard-ux_wizardapps-wizard-ux-1` container's `/usr/share/nginx/wizard-ux/core/app-services.js` shows that `openContextDraft` still requires `st.appId === 'notifications'` and hardcodes `notifications:` as the item namespace. Therefore this candidate handles the rejection gracefully but **cannot open a real Morning Report Chats draft on the installed shell**. Do not spoof the app id or bypass the shell. A separately authorized shared shell extension must admit Morning Report with app-scoped keys before this app can be released as working end-to-end. Neither other app source nor the production shell was changed by this candidate.

## Tests

- `node tests/reply.test.js`
- `node tests/reply.browser.test.js` (requires Playwright; override `PLAYWRIGHT_MODULE` if needed)
- `python3 app/build_view.py`
- `python3 tools/package.py` (builder CLI on PATH)
- `wam check .`

Browser tests use the real staged HTTP server, an isolated read-only `tests/fixtures` report mount and an explicitly synthetic WizardApp contract stub. This is **not full-shell integration evidence**. Default stage URL: `http://127.0.0.1:18812/morning-report/` (`MR_STAGE_URL` overrides its origin). Fixtures contain no owner data. The stub never creates actual Chats state. All non-read HTTP requests are blocked and asserted absent.

Coverage: exact selected text/date/id payload, repeat identity, keyboard activation and selection, touch button activation, strict receipt handling, host rejection and missing API, ranges outside/crossing report, date switch invalidation, literal HTML text, no send requests, no page errors, no mobile overflow, 44px Reply target. DOM Range supplies the browser's real selection; this does not certify physical OS touch-selection handles.

Real-shell release gate: separately approve and implement app-scoped shared draft admission, then exercise selection → Reply in desktop/mobile shell, read back the canonical persisted unsent draft/reply context and verify zero session/run/send requests. Parent owns production/public release approval. No push, publication or production update is part of this candidate.
