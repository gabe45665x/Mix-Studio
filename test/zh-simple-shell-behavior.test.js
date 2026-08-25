// SPDX-License-Identifier: GPL-3.0-or-later
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const app = read('public/simple/app.js');
const tasks = read('public/simple/views/tasks.js');
const library = read('public/simple/views/library.js');
const settings = read('public/simple/views/settings.js');
const custom = read('public/simple/views/custom.js');
const index = read('public/simple/index.html');
const server = read('server.js');

test('simple analytics opt-in is sourced from and enforced by the server config', () => {
  assert.match(server, /publicAnalyticsConfig\(RUNTIME,\s*readZhConfig\(\{/);
  assert.match(app, /api\('\/api\/analytics-config'\)/);
  assert.doesNotMatch(app, /localStorage\.(?:getItem|setItem)\('simple\.analytics'/);
});

test('simple shell persists one form draft per creation mode', () => {
  assert.match(app, /simple\.form\.\$\{mode\}/);
  assert.match(app, /function saveModeForm\(/);
  assert.match(app, /function restoreModeForm\(/);
});

test('simple shell handles SSE loss, recovery, and expired sessions', () => {
  assert.match(app, /connectionState/);
  assert.match(app, /setTimeout\([^)]*3000/);
  assert.match(app, /api\('\/api\/me'\)/);
  assert.match(app, /sessionExpired/);
  assert.match(app, /lastProgressAt/);
});

test('simple shell blocks generation offline and updates the rendered control', () => {
  assert.match(app, /!navigator\.onLine\s*\|\|\s*state\.connectionState\s*===\s*'lost'/);
  assert.match(app, /querySelector\('\[data-action="generate"\]'\)/);
});

test('advanced sheet supports inert background, Escape, history back, and visual viewport', () => {
  assert.match(app, /elements\.app\.inert\s*=\s*true/);
  assert.match(app, /history\.pushState/);
  assert.match(app, /event\.key\s*!==\s*'Escape'/);
  assert.match(app, /visualViewport/);
  assert.match(index, /id="app"/);
});

test('task cards expose details, ETA, queue reorder, and retry state', () => {
  assert.match(tasks, /data-reorder-job/);
  assert.match(tasks, /tasks\.eta/);
  assert.match(tasks, /tasks\.lastKnownProgress/);
  assert.match(tasks, /<details/);
  assert.match(app, /\/api\/queue\/reorder/);
});

test('library exposes an actionable viewer and a trash sheet', () => {
  assert.match(library, /library-viewer/);
  assert.match(library, /data-action="download-media"/);
  assert.match(library, /data-action="reuse-media"/);
  assert.match(library, /data-action="delete-media"/);
  assert.match(library, /data-action="toggle-favorite"/);
  assert.match(app, /function openTrash/);
});

test('settings render phone access, local QR, and HTTPS setup', () => {
  assert.ok(index.indexOf('/qrcodegen.js') < index.indexOf('/simple/app.js'));
  assert.match(settings, /mobileAccess/);
  assert.match(settings, /phoneQr/);
  assert.match(app, /\/api\/mobile-access\/enable-https/);
  assert.match(app, /qrcodegen/);
});

test('custom workflow placeholder interpolates its reason and offers owner recovery', () => {
  assert.match(custom, /custom\.unavailable.*reason/);
  assert.match(custom, /data-action="start-comfy"/);
});
