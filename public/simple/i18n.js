// SPDX-License-Identifier: GPL-3.0-or-later
// Modified from Mix Studio (c) Black Mixture; zh-TW customization (c) gabe45665x 2026
'use strict';

(function exposeI18n(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MixStudioI18n = api;
}(typeof globalThis === 'object' ? globalThis : this, () => {
  function lookup(messages, key) {
    if (!messages || typeof messages !== 'object') return undefined;
    return String(key || '').split('.').reduce((value, part) => (
      value && typeof value === 'object' ? value[part] : undefined
    ), messages);
  }

  function interpolate(template, variables = {}) {
    return String(template).replace(/\{([A-Za-z0-9_]+)\}/g, (match, name) => (
      Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : match
    ));
  }

  function createI18n(options = {}) {
    const messages = options.messages && typeof options.messages === 'object' ? options.messages : {};
    const fallbackMessages = options.fallbackMessages && typeof options.fallbackMessages === 'object'
      ? options.fallbackMessages
      : {};
    const warn = typeof options.warn === 'function' ? options.warn : console.warn;
    const warned = new Set();

    function reportMissing(key) {
      if (warned.has(key)) return;
      warned.add(key);
      warn(`Missing locale key: ${key}`);
    }

    function t(key, variables = {}) {
      const primary = lookup(messages, key);
      if (typeof primary === 'string') return interpolate(primary, variables);

      reportMissing(key);
      const fallback = lookup(fallbackMessages, key);
      if (typeof fallback === 'string') return interpolate(fallback, variables);
      return String(key);
    }

    return { t };
  }

  return { createI18n };
}));
