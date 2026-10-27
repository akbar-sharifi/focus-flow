'use strict';
/* FocusFlow — no accounts. Everything is stored locally in this
   browser's localStorage under one key. Nothing leaves the device. */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const STORAGE_KEY = 'focusflow:v1';

function defaultSettings() {
  return { focusMin: 25, shortBreakMin: 5, longBreakMin: 15, longBreakEvery: 4, autoStartBreaks: false, autoStartFocus: false, sound: true, dailyGoalPomodoros: 4 };
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { tasks: parsed.tasks || [], sessions: parsed.sessions || [], settings: { ...defaultSettings(), ...(parsed.settings || {}) } };
    }
  } catch {}
  return { tasks: [], sessions: [], settings: defaultSettings() };
}
let state = loadState();
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9));
const settings = () => state.settings;
const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();

let activeTag = 'All';
let timer = { mode: 'focus', taskId: null, total: 25 * 60, left: 25 * 60, running: false, int: null, cycles: 0, endsAt: null };
const RING_C = 2 * Math.PI * 100;
const TAG_COLORS = ['#ffe0e6', '#fef3c7', '#d9f99d', '#bfdbfe', '#e9d5ff', '#ffedd5', '#a7f3d0', '#fecaca'];
const tagColor = (tag) => TAG_COLORS[[...String(tag)].reduce((a, c) => a + c.charCodeAt(0), 0) % TAG_COLORS.length];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3200); }

// ---------- navigation ----------
$$('[data-nav]').forEach((b) => b.addEventListener('click', () => showPage(b.dataset.nav)));
function showPage(name) {
  ['today', 'progress', 'settings'].forEach((p) => $('#page-' + p).classList.toggle('hidden', p !== name));
  $$('.bottom-nav button').forEach((b) => b.classList.toggle('active', b.dataset.nav === name));
  window.scrollTo({ top: 0 });
}

// ---------- timer ----------
function durationFor(mode) { const s = settings(); return (mode === 'focus' ? s.focusMin : mode === 'short' ? s.shortBreakMin : s.longBreakMin) * 60; }
function setMode(mode, autoStart = false) {
  stopTick(); timer.mode = mode; timer.total = timer.left = durationFor(mode); timer.running = false; timer.endsAt = null;
  $$('.mode').forEach((b) => { b.classList.toggle('active', b.dataset.mode === mode); b.setAttribute('aria-selected', String(b.dataset.mode === mode)); });
  renderTimer();
  if (autoStart) startTimer();
}
function renderTimer() {
  const m = String(Math.floor(timer.left / 60)).padStart(2, '0'), s = String(timer.left % 60).padStart(2, '0');
  $('#timer-display').textContent = `${m}:${s}`;
  document.title = timer.running ? `${m}:${s} · FocusFlow` : 'FocusFlow — Pomodoro that tracks your progress';
  const fg = $('#ring-fg');
  fg.style.strokeDashoffset = String(RING_C * (1 - (timer.total ? timer.left / timer.total : 0)));
  fg.classList.toggle('break', timer.mode !== 'focus');
  $('#start-btn').textContent = timer.running ? '⏸ Pause' : '▶ Start';
  const task = state.tasks.find((t) => t.id === timer.taskId);
  $('#timer-task').textContent = timer.mode !== 'focus' ? (timer.mode === 'short' ? 'Take a short breather ☕' : 'Long break — well earned 🌿')
    : task ? `Focusing on: ${task.title}` : 'Pick a task below, then start';
  $('#cycle-note').textContent = `Session ${timer.cycles + 1} · long break every ${settings().longBreakEvery} pomodoros · today: ${todaySessions().length}/${settings().dailyGoalPomodoros} done`;
}
function syncLeft() {
  if (timer.endsAt) timer.left = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
}
function tick() {
  syncLeft(); renderTimer();
  if (timer.left <= 0) { stopTick(); timer.endsAt = null; onTimerDone(); }
}
function startTick() { stopTick(); timer.int = setInterval(tick, 250); }
function stopTick() { if (timer.int) clearInterval(timer.int); timer.int = null; }
function startTimer() {
  if (timer.running) { timer.running = false; syncLeft(); stopTick(); timer.endsAt = null; renderTimer(); return; }
  if (timer.mode === 'focus' && !timer.taskId) { toast('Pick a task first — tap “Focus” on any task below 👇'); return; }
  timer.running = true; timer.endsAt = Date.now() + timer.left * 1000; startTick(); renderTimer();
}
function skipTimer() {
  stopTick(); timer.running = false; timer.endsAt = null;
  if (timer.mode === 'focus') {
    toast('Focus skipped — no pomodoro logged');
    const isLong = (timer.cycles + 1) % settings().longBreakEvery === 0;
    setMode(isLong ? 'long' : 'short', settings().autoStartBreaks);
  } else {
    toast('Break skipped — back to it 💪');
    setMode('focus', settings().autoStartFocus);
  }
}
function beep() {
  if (!settings().sound) return;
  try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); [0, .25, .5].forEach((d) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(.15, ctx.currentTime + d); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + .18); }); } catch {}
  if (navigator.vibrate) navigator.vibrate(200);
}
function onTimerDone() {
  timer.running = false; beep();
  if (timer.mode === 'focus') {
    timer.cycles += 1;
    const task = state.tasks.find((t) => t.id === timer.taskId);
    if (task) {
      task.completedPomodoros += 1;
      if (task.completedPomodoros >= task.estimate) { task.done = true; task.completedAt = Date.now(); }
      state.sessions.push({ id: uid(), taskId: task.id, tag: task.tag, minutes: settings().focusMin, endedAt: Date.now() });
      save();
      toast(task.done ? `Task complete! 🎉 “${task.title}” is done.` : `Pomodoro logged for “${task.title}” 🍅`);
      if (task.done) timer.taskId = null;
    }
    renderAll();
    const isLong = timer.cycles % settings().longBreakEvery === 0;
    setMode(isLong ? 'long' : 'short', settings().autoStartBreaks);
  } else {
    toast('Break over — back to it 💪');
    setMode('focus', settings().autoStartFocus);
  }
}
$('#start-btn').addEventListener('click', startTimer);
$('#reset-btn').addEventListener('click', () => setMode(timer.mode));
$('#skip-btn').addEventListener('click', skipTimer);
document.addEventListener('visibilitychange', () => { if (!document.hidden && timer.running) tick(); });
$$('.mode').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

// ---------- tasks, tags, progress (all local) ----------
const tags = () => ['All', ...new Set(state.tasks.map((t) => t.tag))];
const todaySessions = () => state.sessions.filter((s) => isToday(s.endedAt));
const taskPct = (t) => Math.min(100, Math.round((t.completedPomodoros / Math.max(1, t.estimate)) * 100));

$('#task-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const title = $('#task-title').value.trim();
  if (!title) { toast('Give your task a title first'); return; }
  const task = { id: uid(), title: title.slice(0, 140), tag: ($('#task-tag').value.trim() || 'General').slice(0, 32), estimate: Math.min(24, Math.max(1, parseInt($('#task-estimate').value, 10) || 1)), completedPomodoros: 0, done: false, createdAt: Date.now(), completedAt: null };
  state.tasks.push(task); save();
  timer.taskId = task.id;
  $('#task-title').value = ''; toast('Task added — hit Start when ready 🍅'); renderAll();
});

function renderTasks() {
  const list = $('#task-list');
  const visible = state.tasks.filter((t) => activeTag === 'All' || t.tag === activeTag);
  $('#tasks-empty').classList.toggle('hidden', visible.length > 0);
  $('#tag-list').innerHTML = tags().filter((t) => t !== 'All').map((t) => `<option value="${esc(t)}">`).join('');
  $('#tag-filters').innerHTML = tags().map((t) => `<button type="button" class="chip ${t === activeTag ? 'active' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
  $$('#tag-filters .chip').forEach((c) => c.addEventListener('click', () => { activeTag = c.dataset.tag; renderTasks(); }));
  list.innerHTML = visible.map((t) => `
    <li class="task ${t.done ? 'done' : ''} ${t.id === timer.taskId && !t.done ? 'active-task' : ''}">
      <div class="task-top"><span class="task-title">${esc(t.title)}</span><span class="tag" style="background:${tagColor(t.tag)}">${esc(t.tag)}</span></div>
      <div class="progress"><i style="width:${taskPct(t)}%"></i></div>
      <div class="progress-label">${t.completedPomodoros} / ${t.estimate} pomodoros · ${taskPct(t)}% ${t.done ? '· ✅ Done' : ''}</div>
      <div class="task-actions">
        <button class="btn primary small" data-act="focus" data-id="${t.id}" ${t.done ? 'disabled' : ''}>${t.id === timer.taskId && !t.done ? '🍅 Focusing' : '🍅 Focus'}</button>
        <button class="btn ghost small" data-act="toggle" data-id="${t.id}">${t.done ? 'Reopen' : 'Mark done'}</button>
        <button class="btn ghost small" data-act="del" data-id="${t.id}">Delete</button>
      </div>
    </li>`).join('');
  list.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
    const t = state.tasks.find((x) => x.id === b.dataset.id); if (!t) return;
    if (b.dataset.act === 'focus') { timer.taskId = t.id; setMode('focus'); renderTasks(); window.scrollTo({ top: 0, behavior: 'smooth' }); toast(`Ready: “${t.title}” — press Start ▶`); }
    if (b.dataset.act === 'toggle') { t.done = !t.done; t.completedAt = t.done ? Date.now() : null; if (t.done && timer.taskId === t.id) { stopTick(); timer.running = false; timer.endsAt = null; timer.taskId = null; setMode('focus'); } save(); renderAll(); }
    if (b.dataset.act === 'del' && confirm(`Delete “${t.title}”?`)) { state.tasks = state.tasks.filter((x) => x.id !== t.id); state.sessions = state.sessions.filter((s) => s.taskId !== t.id); if (timer.taskId === t.id) { stopTick(); timer.running = false; timer.endsAt = null; timer.taskId = null; setMode('focus'); } save(); renderAll(); }
  }));
}

function renderStats() {
  const today = todaySessions();
  const mins = today.reduce((a, s) => a + s.minutes, 0);
  const done = state.tasks.filter((t) => t.done).length;
  $('#stats-row').innerHTML = `
    <div class="stat"><b>${today.length} 🍅</b><span>pomodoros today</span></div>
    <div class="stat"><b>${mins}m</b><span>focused today</span></div>
    <div class="stat"><b>${done}/${state.tasks.length}</b><span>tasks done</span></div>`;
  $('#progress-summary').innerHTML = $('#stats-row').innerHTML;
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const counts = days.map((d) => state.sessions.filter((s) => new Date(s.endedAt).toDateString() === d.toDateString()).length);
  const max = Math.max(1, ...counts);
  $('#week-chart').innerHTML = days.map((d, i) => `<div class="col"><div class="bar" style="height:${Math.max(4, counts[i] / max * 100)}%" title="${counts[i]} pomodoros"></div><span>${'SMTWTFS'[d.getDay()]}</span></div>`).join('');
  const byTag = {};
  state.sessions.forEach((s) => { byTag[s.tag] = byTag[s.tag] || { n: 0, mins: 0 }; byTag[s.tag].n += 1; byTag[s.tag].mins += s.minutes; });
  $('#tag-breakdown').innerHTML = Object.keys(byTag).length ? Object.entries(byTag).map(([tag, v]) => `<div class="row-line"><span class="tag" style="background:${tagColor(tag)}">${esc(tag)}</span> &nbsp;${v.n} pomodoros · ${v.mins} min focused</div>`).join('') : '<p class="muted">Complete a pomodoro to see tag stats.</p>';
  $('#task-progress').innerHTML = state.tasks.length ? state.tasks.map((t) => `<div class="row-line"><b>${esc(t.title)}</b><div class="progress"><i style="width:${taskPct(t)}%"></i></div><div class="progress-label">${t.completedPomodoros}/${t.estimate} · ${taskPct(t)}%${t.done ? ' · ✅' : ''}</div></div>`).join('') : '<p class="muted">No tasks yet.</p>';
}

function fillSettings() {
  const s = settings();
  $('#s-focus').value = s.focusMin; $('#s-short').value = s.shortBreakMin; $('#s-long').value = s.longBreakMin;
  $('#s-every').value = s.longBreakEvery; $('#s-goal').value = s.dailyGoalPomodoros;
  $('#s-autobreak').checked = s.autoStartBreaks; $('#s-autofocus').checked = s.autoStartFocus; $('#s-sound').checked = s.sound;
}
$('#settings-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const clamp = (v, lo, hi, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  const midSession = timer.left < timer.total;
  state.settings = {
    focusMin: clamp($('#s-focus').value, 1, 120, 25), shortBreakMin: clamp($('#s-short').value, 1, 60, 5),
    longBreakMin: clamp($('#s-long').value, 1, 90, 15), longBreakEvery: clamp($('#s-every').value, 2, 12, 4),
    dailyGoalPomodoros: clamp($('#s-goal').value, 1, 24, 4),
    autoStartBreaks: $('#s-autobreak').checked, autoStartFocus: $('#s-autofocus').checked, sound: $('#s-sound').checked,
  };
  save();
  if (midSession) { toast('Settings saved — new lengths apply to the next timer ✅'); } else { setMode(timer.mode); toast('Settings saved ✅'); }
  renderAll();
});
$('#clear-data-btn').addEventListener('click', () => {
  if (!confirm('Delete all tasks, progress, and settings stored in this browser?')) return;
  localStorage.removeItem(STORAGE_KEY);
  state = loadState(); timer.taskId = null; timer.cycles = 0;
  setMode('focus'); renderAll(); toast('All local data cleared');
});

function renderAll() { renderStats(); renderTasks(); fillSettings(); renderTimer(); }

// start: sync timer to saved focus length, then render — no login, no network
timer.total = timer.left = durationFor('focus');
renderAll();

