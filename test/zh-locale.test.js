// SPDX-License-Identifier: GPL-3.0-or-later
// Modified from Mix Studio (c) Black Mixture; zh-TW customization (c) gabe45665x 2026
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { nodeLabelForJob } = require('../lib/progress-labels');
const { createI18n } = require('../public/simple/i18n');

const localeDir = path.join(__dirname, '..', 'public', 'simple', 'locales');

function readLocale(name) {
  return JSON.parse(fs.readFileSync(path.join(localeDir, name), 'utf8'));
}

function flatten(value, prefix = '', result = {}) {
  for (const [key, entry] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      flatten(entry, fullKey, result);
    } else {
      result[fullKey] = entry;
    }
  }
  return result;
}

function labelFor(classType, overrides = {}) {
  const job = {
    kind: overrides.kind || 'gen',
    videoInfo: overrides.videoInfo,
    graph: { node: { class_type: classType } },
  };
  return nodeLabelForJob(job, 'node');
}

test('zh-TW and English locales expose the same complete non-empty key set', () => {
  const zh = flatten(readLocale('zh-TW.json'));
  const en = flatten(readLocale('en.json'));
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();

  assert.deepEqual(zhKeys, enKeys);
  assert.ok(zhKeys.length >= 200, `expected at least 200 locale keys, got ${zhKeys.length}`);
  for (const key of zhKeys) {
    assert.equal(typeof zh[key], 'string', `${key} must be a string in zh-TW`);
    assert.equal(typeof en[key], 'string', `${key} must be a string in English`);
    assert.ok(zh[key].trim(), `${key} must not be empty in zh-TW`);
    assert.ok(en[key].trim(), `${key} must not be empty in English`);
  }
});

test('zh-TW locale uses the approved Taiwan terminology', () => {
  const zh = readLocale('zh-TW.json');
  assert.equal(zh.nav.home, '首頁');
  assert.equal(zh.nav.tasks, '任務');
  assert.equal(zh.nav.library, '素材庫');
  assert.equal(zh.nav.customWorkflows, '自訂工作流');
  assert.equal(zh.nav.settings, '設定');
  assert.equal(zh.fields.video, '影片');
  assert.equal(zh.fields.image, '圖片');
  assert.equal(zh.fields.file, '檔案');
  assert.equal(zh.tasks.queue, '佇列');
  assert.equal(zh.actions.download, '下載');
});

test('stage translations cover every observable static progress label', () => {
  const stages = readLocale('zh-TW.json').stages;
  const cases = [
    ['UNETLoader', 'Loading Krea 2...'],
    ['UnetLoaderGGUF', 'Loading quantized model...'],
    ['CLIPLoader', 'Loading text encoder...'],
    ['VAELoader', 'Loading VAE...'],
    ['LoraLoader', 'Applying LoRAs...'],
    ['TextGenerate', 'Enhancing prompt...'],
    ['CLIPTextEncode', 'Encoding prompt...'],
    ['TextEncodeQwenImageEditPlus', 'Encoding prompt + images...'],
    ['VAEDecode', 'Decoding...'],
    ['SaveImage', 'Saving...'],
    ['SeedVR2LoadDiTModel', 'Loading SeedVR2...'],
    ['SeedVR2LoadVAEModel', 'Loading SeedVR2 VAE...'],
    ['SeedVR2VideoUpscaler', 'Upscaling...'],
    ['ImageScaleBy', 'Pre-resizing...'],
    ['LoadImage', 'Loading image...'],
    ['UpscaleModelLoader', 'Loading upscale model...'],
    ['UltimateSDUpscale', 'Upscaling tiles...'],
    ['Ideogram4PromptBuilderKJ', 'Building region prompt...'],
    ['Krea2RegionalMultiLoRAV3', 'Applying region guidance...'],
    ['ImageToMask', 'Preparing mask...'],
    ['GrowMask', 'Softening mask...'],
    ['VAEEncodeForInpaint', 'Encoding fill area...'],
    ['LoadSAM3Model', 'Loading SAM3...'],
    ['SAM3Grounding', 'Finding matching objects...'],
    ['SAM3CreatePoint', 'Preparing selection point...'],
    ['SAM3CombinePoints', 'Combining selection points...'],
    ['SAM3Segmentation', 'Tracing selected object...'],
    ['MaskToImage', 'Preparing mask...'],
    ['CheckpointLoaderSimple', 'Loading LTX 2.3...'],
    ['LTXAVTextEncoderLoader', 'Loading Gemma...'],
    ['TextGenerateLTX2Prompt', 'Enhancing motion prompt...'],
    ['MiniMaxH3ImageToVideo', 'Preparing H3 video + audio...'],
    ['MiniMaxH3ReferenceToVideo', 'Preparing H3 references...'],
    ['WanAnimate2Cache', 'Loading Wan Animate 2...'],
    ['WanAnimate2ToVideo', 'Preparing character animation...'],
    ['LoadVideo', 'Loading performance video...'],
    ['GetVideoComponents', 'Reading source timing and audio...'],
    ['TrimVideoLatent', 'Aligning video frames...'],
    ['VAEDecodeAudio', 'Decoding audio...'],
    ['LTXVLatentUpsampler', 'Upsampling video...'],
    ['VAEDecodeTiled', 'Decoding frames...'],
    ['RTXVideoSuperResolution', 'RTX 4K pass...'],
    ['CreateVideo', 'Encoding video...'],
    ['SaveVideo', 'Saving video...'],
    ['KSampler', 'Sampling...'],
    ['UnknownNode', 'Working...'],
  ];

  for (const [classType, expected] of cases) {
    assert.equal(labelFor(classType), expected, `${classType} changed its observable label`);
    assert.ok(stages[expected], `missing zh-TW stage translation for ${expected}`);
  }

  const h3 = labelFor('UNETLoader', { kind: 'video', videoInfo: { engine: 'h3' } });
  const wan = labelFor('UNETLoader', { kind: 'video', videoInfo: { engine: 'wan-animate2' } });
  const video = labelFor('KSampler', { kind: 'video' });
  for (const label of [h3, wan, video]) {
    assert.ok(stages[label], `missing zh-TW stage translation for ${label}`);
  }
});

test('stage translations define templates for every dynamic progress label family', () => {
  const stages = readLocale('zh-TW.json').stages;
  for (const template of [
    'Strength comparison {index} of {count}',
    'H3 Turbo chunk {index} of {count}',
    'H3 Long context clip {index} of {count}',
    'Wan Animate 2 clip {index} of {count}',
    '{phase} · stage {index} of {count}',
  ]) {
    assert.ok(stages[template], `missing dynamic zh-TW stage template: ${template}`);
  }
});

test('translator interpolates variables, falls back to English, and reports missing keys', () => {
  const warnings = [];
  const i18n = createI18n({
    messages: { nav: { home: '首頁' }, toast: { count: '共 {count} 個項目' } },
    fallbackMessages: { nav: { home: 'Home' }, onlyFallback: 'English fallback' },
    warn: (message) => warnings.push(message),
  });

  assert.equal(i18n.t('nav.home'), '首頁');
  assert.equal(i18n.t('toast.count', { count: 3 }), '共 3 個項目');
  assert.equal(i18n.t('onlyFallback'), 'English fallback');
  assert.equal(i18n.t('missing.key'), 'missing.key');
  assert.deepEqual(warnings, [
    'Missing locale key: onlyFallback',
    'Missing locale key: missing.key',
  ]);
});
