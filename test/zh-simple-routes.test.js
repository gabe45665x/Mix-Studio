// SPDX-License-Identifier: GPL-3.0-or-later
// Modified from Mix Studio (c) Black Mixture; zh-TW customization (c) gabe45665x 2026
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const fsp = fs.promises;
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');

async function availablePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => socket.listen(0, '127.0.0.1', resolve).once('error', reject));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

async function startServer(dataDirectory, port) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      MIXBOX_DATA_DIR: dataDirectory,
      MIXBOX_COMFY_URL: 'http://127.0.0.1:9',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not start:\n${output}`)), 10_000);
    const onData = (chunk) => {
      output += chunk.toString();
      if (!output.includes('Mix Studio running')) return;
      clearTimeout(timer);
      resolve();
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited with ${code}:\n${output}`));
    });
  });
  return child;
}

test('simple shell routes preserve Studio and return a redacted capability API', async (t) => {
  const dataDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), 'mixstudio-simple-routes-'));
  let port;
  try {
    port = await availablePort();
  } catch (error) {
    await fsp.rm(dataDirectory, { recursive: true, force: true });
    if (error?.code === 'EPERM' || error?.code === 'EACCES') {
      t.skip('This sandbox does not permit loopback test servers');
      return;
    }
    throw error;
  }

  const child = await startServer(dataDirectory, port);
  t.after(async () => {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
    await fsp.rm(dataDirectory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;

  const simpleResponse = await fetch(`${base}/`);
  const simpleHtml = await simpleResponse.text();
  assert.equal(simpleResponse.status, 200);
  assert.match(simpleHtml, /data-simple-shell/);

  const studioResponse = await fetch(`${base}/studio`);
  const studioHtml = await studioResponse.text();
  assert.equal(studioResponse.status, 200);
  assert.doesNotMatch(studioHtml, /data-simple-shell/);
  assert.match(studioHtml, /\/pwa\.js/);

  const capabilityResponse = await fetch(`${base}/api/simple/capabilities`);
  const capabilityText = await capabilityResponse.text();
  assert.equal(capabilityResponse.status, 200);
  assert.doesNotMatch(capabilityText, /8188|comfyUrl|modelsPath|configuredPath|detectedPath|[A-Z]:\\/i);
  const capabilities = JSON.parse(capabilityText);
  assert.deepEqual(Object.keys(capabilities).sort(), ['engines', 'features', 'limits']);

  const analyticsResponse = await fetch(`${base}/api/simple/analytics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true }),
  });
  assert.equal(analyticsResponse.status, 200);
  assert.equal((await analyticsResponse.json()).analytics.enabled, true);
  const saved = JSON.parse(await fsp.readFile(path.join(dataDirectory, 'zh-tw.json'), 'utf8'));
  assert.equal(saved.analytics.enabled, true);
  const publicAnalytics = await fetch(`${base}/api/analytics-config`).then((response) => response.json());
  assert.equal(publicAnalytics.enabled, true);

  const profiles = await fetch(`${base}/api/profiles`).then((response) => response.json());
  const ownerId = profiles.profiles[0].id;
  const ownerSession = await fetch(`${base}/api/me`);
  const ownerCookie = String(ownerSession.headers.get('set-cookie') || '').split(';')[0];
  assert.match(ownerCookie, /^ks_profile=/);
  const guestResponse = await fetch(`${base}/api/profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
    body: JSON.stringify({ name: 'Route test guest', pin: '2468' }),
  });
  assert.equal(guestResponse.status, 200);
  const guestCookie = String(guestResponse.headers.get('set-cookie') || '').split(';')[0];
  assert.match(guestCookie, /^ks_profile=/);
  const guestAnalytics = await fetch(`${base}/api/simple/analytics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: guestCookie },
    body: JSON.stringify({ enabled: false }),
  });
  assert.equal(guestAnalytics.status, 403);
  assert.equal((await fetch(`${base}/api/simple/capabilities`, { headers: { Cookie: guestCookie } })).status, 200);

  const ownerPinResponse = await fetch(`${base}/api/profiles/${ownerId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
    body: JSON.stringify({ pin: '1357' }),
  });
  assert.equal(ownerPinResponse.status, 200);
  assert.equal((await fetch(`${base}/api/simple/capabilities`)).status, 401);
});
