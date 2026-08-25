// SPDX-License-Identifier: GPL-3.0-or-later
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const simpleRoot = path.join(__dirname, '..', 'public', 'simple');

test('simple PWA launch URL is controlled by its isolated service worker', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(simpleRoot, 'manifest.webmanifest'), 'utf8'));
  const worker = fs.readFileSync(path.join(simpleRoot, 'sw.js'), 'utf8');
  const app = fs.readFileSync(path.join(simpleRoot, 'app.js'), 'utf8');

  assert.equal(manifest.scope, '/simple/');
  assert.match(manifest.start_url, /^\/simple\//);
  assert.match(worker, /['"]\/simple\/index\.html['"]/);
  assert.match(app, /register\('\/simple\/sw\.js', \{ scope: '\/simple\/' \}\)/);
});
