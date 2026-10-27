# FocusFlow 🍅 — Pomodoro Web App

A mobile-friendly Pomodoro app: add tasks, tag them, start a focused timer per task, and track progress. **Completely free** — no trials, no subscriptions, no paywall.

**No account, no sign-in.** There is no login of any kind (no Google, no demo account). Everything — tasks, focus history, and settings — is stored only in your browser's local storage, on your device. Nothing is sent to a server.

## Run locally (no dependencies, no build step)

Requires Node.js 18+.

```bash
cd pomodoro-app
node server.js
```

Open **http://localhost:3000** in your browser. On a phone on the same Wi-Fi, open `http://<your-computer-ip>:3000`. Just start adding tasks — no sign-in step.

> Because data lives in local storage, it is per-browser and per-device: it does not sync between your phone and computer, and clearing your browser/site data erases it. Use **Settings → Delete all local data** to wipe it deliberately.

## Test

```bash
npm test
```

## Features

| Area | What you get |
|---|---|
| Tasks | Add task with tag + pomodoro estimate, mark done, delete, filter by tag |
| Timer | 25/5/15 defaults (configurable), ring countdown, per-task focus, pause/reset/skip, sound + vibration on finish |
| Tags | Free-form tags with colors, autocomplete from existing tags, filter chips, per-tag stats |
| Progress | Pomodoros today, focus minutes, 7-day bar chart, per-task progress bars, daily goal |
| Settings | Focus/break lengths, long-break interval, daily goal, auto-start, sound, delete-all-local-data |
| Price | Completely free — every feature, for everyone, forever |
| Storage | Browser local storage only (`focusflow:v1`) — no server database, no accounts |
| Mobile | Responsive layout, bottom navigation, large touch targets, safe-area support |

## Files

- `server.js` — zero-dependency static file server (no API, no auth, no database)
- `public/` — `index.html`, `styles.css`, `app.js` (vanilla JS; all state in `localStorage`)

See [deploy/AWS.md](deploy/AWS.md) for the AWS deployment plan.

**Live:** https://d1m1uojl3y8cq4.cloudfront.net — deployed on AWS (account `863181492071`, us-east-1) via CloudFront Functions. See [deploy/AWS.md](deploy/AWS.md) for why and how to redeploy.

## Built by Muse Code

This project was built by **Muse Code**, powered by the **muse-wonder-1.0** model from Meta, working as an agentic coding CLI assistant. Muse Code wrote and polished the application code, fixed the timer (wall-clock deadline countdown, Skip no longer logs a pomodoro), added the regression tests, and carried out the AWS deployment end to end — including diagnosing this account's SCP restrictions and switching to the CloudFront Functions deployment described above.

For project context intended for future Muse Code (or other AI coding assistant) sessions, see [MUSE.md](MUSE.md).

