# Wisdom 2.0 (ProWater CRM) — working conventions

This file is auto-loaded by Codex every session opened in this repo.
It exists so that **any** session — not just the one that made a change —
follows the same bookkeeping. Read this before making any code change.

## 1. On every change that ships, do all four of these — no exceptions

1. **Bump the version** in `src/shared/core.js`:
   - Re-read the file first and check the CURRENT `APP_VERSION` — **do not
     trust a number from earlier in the conversation.** Other sessions may
     be editing this same repo concurrently; if the version has moved since
     you last checked, just take the next number after whatever it is now.
   - Increment the patch number (`2.29.163` → `2.29.164`).
   - Update `VERSION_DATE` to today's date (`YYYY-MM-DD`).
   - Prepend ONE new entry to the top of `VERSION_HISTORY` (newest first).
2. **Write a real changelog note**, not a one-liner. Include:
   - What changed and in which file(s)/function(s).
   - **Why** — the root cause if it's a bug fix, or "per explicit request"
     with a short quote/paraphrase of the ask if it's a feature change.
   - Anything you verified (a live test, a mock, a specific number that
     matched). If you found and fixed something unrelated while in there,
     say so as a separate sentence — don't bury it.
3. **Update `src/DOCUMENTATION.md`**:
   - Bump the `**Reflects:** \`APP_VERSION\` **X.Y.Z**.` line near the top
     (line ~12) to match.
   - Update the actual prose section for the module/feature you touched —
     not just the version line. If a column was removed, a field was
     renamed, a screen's behavior changed — the description of that screen
     needs to say the new thing, not the old thing. A stale doc is worse
     than no doc, because it actively misleads the next reader.
4. **Keep `Wisdom2.0-Overview.docx` (repo root) in sync** for anything
   structurally significant (new module, new tab, major behavior change).
   Skip this for small fixes/tweaks — use judgment, same bar as deciding
   whether something belongs in DOCUMENTATION.md's prose vs. just the
   changelog.

Do this **every time**, including for small fixes. It's cheap and it's the
only reason `VERSION_HISTORY` is a trustworthy record of what actually
happened, instead of a partial one.

## 2. This repo is edited concurrently

Multiple sessions may be working in this folder at the same time. Before
you touch `src/shared/core.js`, `App.jsx`, or any file you're about to
edit:
- **Re-read it fresh** — don't assume it still looks like it did earlier
  in your own conversation. Someone else may have changed it.
- If your edit's `old_string` doesn't match, that's a signal something
  else changed the file — re-read and adapt, don't force it.
- Re-check `APP_VERSION` immediately before you bump it (see §1).

## 3. Verification workflow — do this before saying something is done

1. **Parse check** every file you touched:
   ```bash
   node -e "
   const parser = require('@babel/parser');
   const fs = require('fs');
   const code = fs.readFileSync('src/path/To/File.jsx', 'utf8');
   try { parser.parse(code, { sourceType: 'module', plugins: ['jsx'] }); console.log('OK'); }
   catch (e) { console.log('FAIL:', e.message); }
   "
   ```
2. **Build**: `npm run build` — must exit clean (the chunk-size warning at
   the bottom is pre-existing and expected; anything else is a real error).
3. **Live browser check** — don't just trust the build. See §4 for how to
   get a working session without real credentials.

Only report a change as "done" after all three pass. If you skip live
verification because it's not visually observable (e.g. a pure data-layer
change with no UI surface), say so explicitly rather than staying silent
about it.

## 4. Live browser verification — how to get in without real login

The dev server is `wisdom2-prowater-dev` (in `.Codex/launch.json`),
port **5178**, base path **`/wisdom/`** — open `http://localhost:5178/wisdom/`.

Real Zoho/Firebase auth won't work in this environment (expect 401/403s —
that's fine, the app falls back to sample data). To get past the login
screen, seed `sessionStorage` directly (via the browser tool's JS
execution) **before** navigating, matching what `App.jsx`'s session
restore logic checks for:

```js
sessionStorage.clear();
localStorage.clear(); // clears any stale cached API data too
sessionStorage.setItem("pw_user", JSON.stringify({
  username: "verifier", name: "Verifier Account", role: "admin"
})); // role:"admin" alone grants full module access — no need to build the full access map
sessionStorage.setItem("pw_tokenExpiry", String(Date.now() + 55*60*1000));
sessionStorage.setItem("pw_last_activity", String(Date.now()));
sessionStorage.setItem("pw_session_day", new Date().toDateString());
```
Then navigate/reload to `http://localhost:5178/wisdom/`. **`name` is
required** — `App.jsx` does an unguarded `user.name.split(" ")` in the
sidebar footer; a user object missing `name` crashes the whole `<Shell>`
on render (not a real bug, just a footgun for test seeding — always
include `name`).

To land directly on a specific module: also set
`sessionStorage.setItem("pw_active_module", "<moduleId>")` before loading
(e.g. `"customer"`, `"ticketing"`, `"analytics"`).

**To test a specific API response shape** (e.g. a new field the backend
just added), patch `window.fetch` in the SAME page load, right before
triggering the fetch (a full page reload wipes the patch — Vite HMR from
your own file edits can also silently wipe it, so re-apply it fresh if a
mock stops working after you've edited a source file):
```js
const realFetch = window.fetch.bind(window);
window.fetch = function(url, opts) {
  if (typeof url === "string" && url.includes("/your/endpoint")) {
    return Promise.resolve(new Response(JSON.stringify(yourMockData), {
      status: 200, headers: { "Content-Type": "application/json" }
    }));
  }
  return realFetch(url, opts);
};
```
Then click into the module (client-side nav) or click its own "Refresh"
button — don't force a full page reload after patching.

Most modules gate their sub-tabs behind a "Server unavailable" modal when
their real API is unreachable (expected here). Click **"Continue anyway"**
to proceed with sample/mocked data — it re-arms per tab, so you'll see it
again each time you switch tabs.

## 5. Scope discipline

- When asked to change "this module" or "this screen," don't touch
  siblings unless the fix is a genuinely shared helper (say so if you do).
- Don't resurrect a feature that was deliberately removed in a past
  `VERSION_HISTORY` entry unless the user asks again — the changelog is
  the record of that decision; read a few recent entries for the area
  you're touching before assuming something is a bug vs. intentional.
- For a real product/design decision with more than one reasonable
  answer (which screen's numbers should move to match the other, whether
  to keep or drop a column, etc.) — ask, don't guess. For a mechanical
  fix with an obvious right answer, just do it and say what you did.
