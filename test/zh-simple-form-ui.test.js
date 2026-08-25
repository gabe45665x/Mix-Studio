// SPDX-License-Identifier: GPL-3.0-or-later
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'simple', 'views', 'home.js'), 'utf8');
const sandbox = { globalThis: {} };
vm.runInNewContext(source, sandbox, { filename: 'public/simple/views/home.js' });
const home = sandbox.globalThis.MixStudioSimpleViews.home;

const ctx = {
  h: (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;'),
  t: (key, variables = {}) => Object.entries(variables).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    key,
  ),
  mediaCard: () => '',
};

function stateFor(mode) {
  return {
    mode,
    prompt: '',
    negativePrompt: '',
    aspect: mode.endsWith('video') ? '16:9' : '1:1',
    quality: 'quick',
    count: 1,
    duration: 5,
    seed: '',
    denoise: 0.45,
    motion: 'medium',
    stylePreset: '',
    uploadName: '',
    uploadSize: 0,
    addons: [{ id: 'cinematic', label: 'Cinematic' }],
    profile: { isOwner: true },
    setup: { comfy: { connected: true } },
    hardwareLabel: 'RTX 5090 · 32 GB',
    capabilities: {
      engines: {
        image: { installed: true, turbo: true, raw: true },
        edit: { klein4: true, klein9: false, qwen: true, krea2ref: false, krea2remix: false },
        video: { ltx: true, ltx25: true, ltx25quality: false, h3: true, h3turbo: false, wan: true },
      },
      features: {
        upscale: true, rife: true, faceid: true, h3context: false,
        ltxcamera: false, outpaint: false, depth: false, style: true,
      },
      limits: { ltxMaxSeconds: 20, ltx25MaxSeconds: 20, h3Min: 5, h3Max: 15 },
    },
    jobs: [],
    galleryItems: [],
  };
}

test('text-to-image renders every WP-04 general field and all image aspects', () => {
  const html = home.render(stateFor('text-image'), ctx);
  for (const field of ['prompt', 'negativePrompt', 'count', 'stylePreset']) {
    assert.match(html, new RegExp(`data-field="${field}"`));
  }
  for (const aspect of ['1:1', '4:5', '3:4', '2:3', '9:16', '3:2', '4:3', '16:9', '21:9']) {
    assert.match(html, new RegExp(`data-aspect="${aspect}"`));
  }
});

test('image-to-image renders an uploaded preview, denoise, follow-source, and count', () => {
  const state = stateFor('image-image');
  state.uploadName = 'ks_reference.png';
  state.uploadSize = 24576;
  const html = home.render(state, ctx);
  assert.match(html, /\/api\/input\?name=ks_reference\.png/);
  assert.match(html, /data-field="denoise"/);
  assert.match(html, /data-aspect="follow"/);
  assert.match(html, /data-field="count"/);
  assert.match(html, /data-action="remove-upload"/);
});

test('text-to-video renders duration, motion, and audio status without image-only controls', () => {
  const html = home.render(stateFor('text-video'), ctx);
  assert.match(html, /data-field="duration"/);
  assert.match(html, /data-motion="low"/);
  assert.match(html, /data-motion="medium"/);
  assert.match(html, /data-motion="high"/);
  assert.match(html, /help\.audioGenerated/);
  assert.doesNotMatch(html, /data-action="choose-upload"/);
  assert.doesNotMatch(html, /data-field="count"/);
});

test('image-to-video renders first-frame preview and video controls', () => {
  const state = stateFor('image-video');
  state.uploadName = 'ks_first.webp';
  const html = home.render(state, ctx);
  assert.match(html, /\/api\/input\?name=ks_first\.webp/);
  assert.match(html, /data-field="duration"/);
  assert.match(html, /data-motion="high"/);
  assert.match(html, /help\.audioGenerated/);
  assert.doesNotMatch(html, /data-field="count"/);
});

test('advanced sheet exposes mode-relevant WP-04 controls and capability guidance', () => {
  const imageHtml = home.advanced(stateFor('text-image'), ctx);
  for (const field of ['engine', 'loras', 'seed', 'steps', 'cfg', 'width', 'height', 'postUpscale']) {
    assert.match(imageHtml, new RegExp(`data-field="${field}"`));
  }

  const videoHtml = home.advanced(stateFor('image-video'), ctx);
  for (const field of ['engine', 'seed', 'interpolation', 'postUpscale', 'endImageName', 'referenceVideo', 'referenceAudio', 'faceId', 'longVideo']) {
    assert.match(videoHtml, new RegExp(`data-field="${field}"`));
  }
});

test('generate is disabled while the connection is lost', () => {
  const state = stateFor('text-image');
  state.connectionState = 'lost';
  const html = home.render(state, ctx);
  assert.match(html, /data-action="generate"[^>]*disabled/);
});
