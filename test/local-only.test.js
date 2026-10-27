'use strict';
/* FocusFlow has no login and no server data: the server only serves
   static files, and the browser app stores everything in localStorage. */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const PORT = 3462;
const BASE = `http://localhost:${PORT}`;
let child;

before(async () => {
  child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${BASE}/`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
});
after(() => { if (child) child.kill(); });

test('home page has no login, Google, or account UI', async () => {
  const html = await (await fetch(`${BASE}/`)).text();
  for (const banned of ['view-login', 'Continue with Google', '/auth/', 'demo-form', 'Log out', 'avatar']) {
    assert.equal(html.includes(banned), false, banned);
  }
  assert.ok(html.includes('id="view-app"'));
  assert.ok(html.includes('Free forever'));
});

test('browser app stores everything in localStorage and calls no API', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  assert.ok(js.includes("localStorage.getItem(STORAGE_KEY)"));
  assert.ok(js.includes("localStorage.setItem(STORAGE_KEY"));
  assert.equal(js.includes('fetch('), false);
  assert.equal(js.includes('/api/'), false);
  assert.equal(/google|oauth|logout/i.test(js), false);
});

test('auth and API routes do not exist on the server', async () => {
  for (const p of ['/api/me', '/api/state', '/api/tasks', '/auth/google', '/auth/google/callback']) {
    assert.equal((await fetch(BASE + p)).status, 404, p);
  }
  assert.equal((await fetch(`${BASE}/auth/demo`, { method: 'POST' })).status, 404);
  assert.equal((await fetch(`${BASE}/auth/logout`, { method: 'POST' })).status, 404);
});
