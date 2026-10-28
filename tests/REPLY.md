# Selected-text Reply — 0.5.0, private owner delivery

Select text inside the report and use **Reply** (mouse, touch or keyboard). The title carries the report date and the reply message is exactly the selected text. No whole-report fallback, automatic send, session creation or run. Selections outside/crossing the report are refused; changing editions clears the selection. Text above 32,000 characters is rejected, not truncated.

`WizardApp.nav.openContextDraft({id,title,message})` is the shared synchronous host API. Only `{kind:'unsent-draft',sent:false}` is success. The verified current visible same-origin installed Wizard app receives its own shell-derived `<appId>:<id>` namespace. Caller-selected app ids and keys cannot spoof Notifications. Hidden, detached, navigated and stale documents remain rejected. Notifications retains its existing namespace and behavior. The shell adapter puts the item in canonical `wos.chat.drafts.v1`, as a reply beside an empty main Chats composer; it never invokes send/run APIs.

## Verification

- `node tests/reply.test.js`
- `node tests/reply.browser.test.js` — staged real HTTP with isolated fixtures and an explicit host contract stub; not full-shell proof.
- `python3 app/build_view.py`, `python3 tools/package.py`, `wam check .` (builder CLI on PATH).
- Shell: `node --test tests/*.test.mjs`; `qa-app-context-draft.cjs` with `QA_PLAYWRIGHT`, `QA_BASE`, `QA_OUT`, optional `QA_HOST_RESOLVER`.

Full-shell baseline on the previous owner build rejected Morning Report as expected. Candidate and privately deployed live owner shell passed desktop + mobile Chromium touch emulation: selected passage → trusted Reply click/tap → visible Chats reply bubble → exact canonical persisted reply readback → reload persistence. The probe uses isolated browser localStorage/IndexedDB, synthetic report GET responses from the read-only stage and blocked workspace/private session reads. All non-read production requests are blocked; zero send/run/session mutation requests were attempted. Screenshots were inspected for both surfaces. App frontend and shell are the live builds, not contract stubs, during final integration.

## Private deployment and rollback

The app remains local/private: no public push or store publication. A user-config Compose override replaces only the inline command payload with the 0.5.0 package. The generated store Compose, report mount, security restrictions and report files stay intact. Supply BOTH generated and user-config `app.env` files to Compose; omitting the latter loses the trusted public host/origin values and causes 403s. Remove the private command override and compose up with those same env files to roll back to the store payload.

The shell is delivered through the supported My release rebuild, with its automatic push redirected to a local bare receipt repository for this no-publication task. Runtime receipts and deployment backups are retained privately on the owner box; no existing owner chat was used for QA.

Limitations: Chromium touch emulation + DOM Range does not prove physical iOS/Android native selection handles. Drafts use the existing device-local canonical Chats store, not cross-device draft sync. Store updates may replace the app's packaged baseline; the private override is reversible and must be reconciled on a future app release.
