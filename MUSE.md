# Muse Code context — FocusFlow (Pomodoro web app)

This file gives future Muse Code sessions the context they need to
continue this project without re-deriving it. It was built by Muse
Code (powered by muse-wonder-1.0).

## What this is

FocusFlow is a mobile-friendly Pomodoro web app: add tasks, tag them,
run a focused timer per task, and track progress. Vanilla HTML/CSS/JS —
no framework, no build step, no dependencies.

Live: https://d1m1uojl3y8cq4.cloudfront.net

## Product invariants (do not break these)

- **Completely free.** No trials, subscriptions, paywalls, or paid tiers.
- **No account, no sign-in of any kind.** No login UI, no Google/OAuth,
  no demo account, no logout, no avatars. `test/local-only.test.js`
  asserts their absence — keep it green.
- **Local-only data.** Tasks, focus sessions, and settings live only in
  the browser's `localStorage` under the single key `focusflow:v1`.
  Nothing is sent to a server; the browser app must never call `fetch()`
  or any `/api/` route (also asserted by the tests).
- Consequence to preserve in user-facing copy: data is per-browser and
  per-device, does not sync, and is erased by clearing site data.

## Layout

| Path | Purpose |
|---|---|
| `public/index.html` | Single-page UI: Today (timer + tasks), Progress, Settings |
| `public/app.js` | All app logic and state (`localStorage`); timer, tasks, tags, stats |
| `public/styles.css` | All styles; mobile-first, bottom nav, safe-area support |
| `server.js` | Zero-dependency Node static file server (local use only; port `PORT`, default 3000) |
| `Dockerfile` | Node 22 container for the static server (App Runner / ECS path, currently unused) |
| `test/local-only.test.js` | Guards the no-login / local-only invariants against the running server |
| `test/timer-polish.test.js` | Regression coverage for the timer fixes below |
| `deploy/AWS.md` | Deployment record and alternatives |
| `deploy/cloudfront/deploy.py` | Redeploy script for the live CloudFront setup |
| `deploy/cloudfront/function-template.js` | CloudFront Function source template |

## Commands

```bash
node server.js   # run locally at http://localhost:3000 (Node 18+)
npm test         # node --test test/
```

## Timer behavior (fixed Oct 2026 — keep it this way)

- The countdown is deadline-based: `timer.endsAt = Date.now() + timer.left * 1000`
  and `syncLeft()` recomputes from the wall clock. Do not reintroduce
  `timer.left -= 1` per interval tick; background tabs throttle intervals.
- **Skip does not log a pomodoro.** `skipTimer()` moves to the next
  break/focus phase without touching `completedPomodoros` or `sessions`.
  Only `onTimerDone()` (natural expiry) logs progress.
- Saving settings mid-session must not reset the current countdown;
  new lengths apply to the next timer (`midSession` check).
- Deleting or marking-done the currently focused task stops its timer
  and clears `timer.taskId`. A task that reaches its estimate clears
  `timer.taskId` too.
- Defaults: focus 25 min, short break 5, long break 15, long break every
  4 pomodoros, daily goal 4. Settings are clamped on save.

## Deployment (AWS account 863181492071, us-east-1)

The org SCP `p-p1wq965p` explicitly denies `s3:CreateBucket`/`PutObject`,
Amplify, App Runner, Lambda, and EC2, but allows CloudFront, Route 53,
and ACM. There is therefore **no S3 bucket** behind the live site.

Instead, `deploy/cloudfront/deploy.py`:

1. Gzips each file in `public/`, base64-embeds it in its own CloudFront
   Function (`focusflow-html`, `focusflow-css`, `focusflow-js`; each
   under the 10 KB function-code limit), and publishes them.
2. Serves them from CloudFront distribution `E19CRYRH8ZMQM9`
   (`d1m1uojl3y8cq4.cloudfront.net`) via viewer-request associations.
   The origin (`example.com`) is a placeholder that is never reached,
   and caching is disabled so redeploys apply immediately.

Redeploy after editing `public/`:

```bash
aws login   # only if the session has expired
python3 deploy/cloudfront/deploy.py
```

Notes:

- The CloudFront KeyValueStore endpoint was unreachable from the deploy
  machine (DNS), which is why files are embedded in functions instead.
- This machine's `aws login` cache once needed its DPoP key converted
  from SEC1 to PKCS8 (`-----BEGIN PRIVATE KEY-----`) to fix a
  "Key format is not supported" error; a `.bak` of the original cache
  sits next to it in `~/.aws/login/cache/`.
- If the SCP is ever relaxed to allow S3, migrate to the standard
  S3 + CloudFront setup described in `deploy/AWS.md` and retire the
  functions.

## Conventions

- Keep the app dependency-free vanilla JS; escape user text with `esc()`
  before inserting into HTML.
- Add the smallest focused test in `test/` for any behavior change and
  run `npm test` before declaring done.
- Do not add analytics, tracking, accounts, or any network call from
  the browser app.
