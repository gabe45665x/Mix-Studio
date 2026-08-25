// SPDX-License-Identifier: GPL-3.0-or-later
// Modified from Mix Studio (c) Black Mixture; zh-TW customization (c) gabe45665x 2026
'use strict';

(function exposePayloadStub(root) {
  // WP-05 replaces this explicit stub with the reviewed four-mode mappings.
  function buildSimplePayload(mode, fields = {}) {
    return { pending: true, mode: String(mode || ''), fields: { ...fields } };
  }

  root.MixStudioSimplePayloads = { buildSimplePayload };
}(globalThis));
