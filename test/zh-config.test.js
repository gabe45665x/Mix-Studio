// SPDX-License-Identifier: GPL-3.0-or-later
// Modified from Mix Studio (c) Black Mixture; zh-TW customization (c) gabe45665x 2026
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  DEFAULT_CONFIG,
  readZhConfig,
  writeZhConfig,
} = require('../lib/zh/config');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mix-studio-zh-config-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'zh-tw.json');
}

test('missing zh-TW config reads as an independent copy of safe defaults', (t) => {
  const filePath = fixture(t);
  const first = readZhConfig({ filePath });
  const second = readZhConfig({ filePath });

  assert.deepEqual(first, DEFAULT_CONFIG);
  assert.deepEqual(second, DEFAULT_CONFIG);
  assert.notEqual(first, DEFAULT_CONFIG);
  first.analytics.enabled = true;
  assert.equal(second.analytics.enabled, false);
  assert.equal(fs.existsSync(filePath), false);
});

test('writes merge known settings, discard unknown keys, and leave no temporary file', (t) => {
  const filePath = fixture(t);
  const written = writeZhConfig({
    analytics: { enabled: true, surprise: 'discard me' },
    customWorkflows: { iframe: true },
    unknownRoot: { enabled: true },
  }, { filePath });

  assert.equal(written.analytics.enabled, true);
  assert.equal(written.customWorkflows.iframe, true);
  assert.equal(written.customWorkflows.ownerOnly, true);
  assert.equal('surprise' in written.analytics, false);
  assert.equal('unknownRoot' in written, false);
  assert.deepEqual(readZhConfig({ filePath }), written);
  assert.equal(fs.existsSync(`${filePath}.tmp`), false);
});

test('a rejected patch never replaces the last valid config', (t) => {
  const filePath = fixture(t);
  const valid = writeZhConfig({ mcww: { port: 7861 } }, { filePath });
  const before = fs.readFileSync(filePath, 'utf8');

  const invalidPatches = [
    { mcww: { port: 0 } },
    { proxyPort: 70000 },
    { analytics: { enabled: 'yes' } },
    { session: { maxAgeDays: 91 } },
    { customWorkflows: { ownerOnly: 1 } },
    { privacy: { cloudLlmAcknowledged: 'true' } },
  ];

  for (const patch of invalidPatches) {
    assert.throws(() => writeZhConfig(patch, { filePath }), /Invalid zh-TW config/);
    assert.equal(fs.readFileSync(filePath, 'utf8'), before);
  }
  assert.deepEqual(readZhConfig({ filePath }), valid);
});

test('malformed persisted JSON is rejected instead of silently overwriting it', (t) => {
  const filePath = fixture(t);
  fs.writeFileSync(filePath, '{not json', 'utf8');
  assert.throws(() => readZhConfig({ filePath }), /Unable to read zh-TW config/);
  assert.equal(fs.readFileSync(filePath, 'utf8'), '{not json');
});

