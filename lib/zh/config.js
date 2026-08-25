// SPDX-License-Identifier: GPL-3.0-or-later
// Modified from Mix Studio (c) Black Mixture; zh-TW customization (c) gabe45665x 2026
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_CONFIG = Object.freeze({
  mcww: Object.freeze({ port: 7860 }),
  customWorkflows: Object.freeze({ ownerOnly: true, iframe: false }),
  proxyPort: 3301,
  analytics: Object.freeze({ enabled: false }),
  session: Object.freeze({ maxAgeDays: 30 }),
  privacy: Object.freeze({ cloudLlmAcknowledged: false }),
});

const SCHEMA = {
  mcww: {
    port: (value) => Number.isInteger(value) && value >= 1 && value <= 65535,
  },
  customWorkflows: {
    ownerOnly: (value) => typeof value === 'boolean',
    iframe: (value) => typeof value === 'boolean',
  },
  proxyPort: (value) => Number.isInteger(value) && value >= 1 && value <= 65535,
  analytics: {
    enabled: (value) => typeof value === 'boolean',
  },
  session: {
    maxAgeDays: (value) => Number.isFinite(value) && value > 0 && value <= 90,
  },
  privacy: {
    cloudLlmAcknowledged: (value) => typeof value === 'boolean',
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeKnown(target, source, schema = SCHEMA, prefix = '') {
  if (!isPlainObject(source)) throw new TypeError('Invalid zh-TW config: expected an object');
  const result = clone(target);
  for (const [key, value] of Object.entries(source)) {
    if (!Object.prototype.hasOwnProperty.call(schema, key)) continue;
    const rule = schema[key];
    const field = prefix ? `${prefix}.${key}` : key;
    if (typeof rule === 'function') {
      if (!rule(value)) throw new TypeError(`Invalid zh-TW config: ${field}`);
      result[key] = value;
      continue;
    }
    if (!isPlainObject(value)) throw new TypeError(`Invalid zh-TW config: ${field}`);
    result[key] = mergeKnown(result[key], value, rule, field);
  }
  return result;
}

function resolveFilePath(options = {}) {
  if (options.filePath) return path.resolve(options.filePath);
  return path.join(__dirname, '..', '..', 'data', 'zh-tw.json');
}

function readZhConfig(options = {}) {
  const filePath = resolveFilePath(options);
  if (!fs.existsSync(filePath)) return clone(DEFAULT_CONFIG);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read zh-TW config: ${error.message}`, { cause: error });
  }
  try {
    return mergeKnown(DEFAULT_CONFIG, parsed);
  } catch (error) {
    throw new Error(`Unable to read zh-TW config: ${error.message}`, { cause: error });
  }
}

function writeZhConfig(patch, options = {}) {
  if (!isPlainObject(patch)) throw new TypeError('Invalid zh-TW config: expected an object');
  const filePath = resolveFilePath(options);
  const current = readZhConfig({ filePath });
  const next = mergeKnown(current, patch);
  const tempPath = `${filePath}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try { fs.rmSync(tempPath, { force: true }); } catch {}
    throw error;
  }
  return clone(next);
}

module.exports = {
  DEFAULT_CONFIG,
  readZhConfig,
  writeZhConfig,
};

