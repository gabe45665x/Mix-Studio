// SPDX-License-Identifier: GPL-3.0-or-later
// Modified from Mix Studio (c) Black Mixture; zh-TW customization (c) gabe45665x 2026
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createSimpleCapabilities } = require('../lib/zh/simple-capabilities');

test('simple capabilities expose only installed engines, features, and public limits', () => {
  const result = createSimpleCapabilities({
    availableComponents: [
      'image', 'krea2raw', 'klein4', 'klein9', 'qwen', 'krea2ref', 'krea2remix',
      'video', 'ltx25', 'ltx25quality', 'h3', 'h3turbo', 'wan',
      'upscale', 'rife', 'faceid', 'h3context', 'ltxcamera', 'krea2outpaint',
      'editoutpaint', 'krea2depth', 'krea2style',
    ],
    missingComponents: ['krea2raw', 'klein9', 'ltx25quality', 'wan', 'faceid', 'editoutpaint'],
    connected: true,
  });

  assert.deepEqual(result, {
    engines: {
      image: { installed: true, turbo: true, raw: false },
      edit: { klein4: true, klein9: false, qwen: true, krea2ref: true, krea2remix: true },
      video: { ltx: true, ltx25: true, ltx25quality: false, h3: true, h3turbo: true, wan: false },
    },
    features: {
      upscale: true,
      rife: true,
      faceid: false,
      h3context: true,
      ltxcamera: true,
      outpaint: true,
      depth: true,
      style: true,
    },
    limits: { ltxMaxSeconds: 20, ltx25MaxSeconds: 20, h3Min: 5, h3Max: 15 },
  });
  assert.doesNotMatch(JSON.stringify(result), /8188|comfyUrl|modelsPath|configuredPath|detectedPath/i);
});

test('disconnected capability checks fail closed', () => {
  const result = createSimpleCapabilities({
    availableComponents: ['image', 'video', 'upscale'],
    missingComponents: [],
    connected: false,
  });

  assert.equal(result.engines.image.installed, false);
  assert.equal(result.engines.video.ltx, false);
  assert.equal(result.features.upscale, false);
  assert.deepEqual(result.limits, { ltxMaxSeconds: 20, ltx25MaxSeconds: 20, h3Min: 5, h3Max: 15 });
});
