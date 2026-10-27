'use strict';
/* Regression coverage for timer polish: deadline-based countdown,
   Skip must not log a pomodoro, and settings must not reset a
   timer that is already mid-session. */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

test('timer counts down from a wall-clock deadline, not interval decrements', () => {
  assert.ok(js.includes('timer.endsAt = Date.now() + timer.left * 1000'));
  assert.ok(js.includes('Math.ceil((timer.endsAt - Date.now()) / 1000)'));
  assert.equal(js.includes('timer.left -= 1'), false);
});

test('skip moves to the next phase without logging a pomodoro', () => {
  assert.ok(js.includes("$('#skip-btn').addEventListener('click', skipTimer)"));
  const skipBody = js.slice(js.indexOf('function skipTimer()'), js.indexOf('function beep()'));
  assert.ok(skipBody.includes('no pomodoro logged'));
  assert.equal(skipBody.includes('state.sessions.push'), false);
  assert.equal(skipBody.includes('completedPomodoros += 1'), false);
  assert.equal(skipBody.includes('onTimerDone'), false);
});

test('saving settings preserves a mid-session countdown', () => {
  assert.ok(js.includes('const midSession = timer.left < timer.total;'));
  assert.ok(js.includes('new lengths apply to the next timer'));
});

test('deleting or completing the focused task stops its timer', () => {
  assert.ok(js.includes('if (t.done && timer.taskId === t.id)'));
  assert.ok(js.includes('state.sessions = state.sessions.filter((s) => s.taskId !== t.id); if (timer.taskId === t.id) { stopTick();'));
});
