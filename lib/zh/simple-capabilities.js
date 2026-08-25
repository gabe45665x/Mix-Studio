// SPDX-License-Identifier: GPL-3.0-or-later
// Modified from Mix Studio (c) Black Mixture; zh-TW customization (c) gabe45665x 2026
'use strict';

const PUBLIC_LIMITS = Object.freeze({
  ltxMaxSeconds: 20,
  ltx25MaxSeconds: 20,
  h3Min: 5,
  h3Max: 15,
});

function createSimpleCapabilities(options = {}) {
  const available = new Set(Array.isArray(options.availableComponents) ? options.availableComponents : []);
  const missing = new Set(Array.isArray(options.missingComponents) ? options.missingComponents : []);
  const connected = options.connected === true;
  const installed = (id) => connected && available.has(id) && !missing.has(id);

  return {
    engines: {
      image: {
        installed: installed('image'),
        turbo: installed('image'),
        raw: installed('krea2raw'),
      },
      edit: {
        klein4: installed('klein4'),
        klein9: installed('klein9'),
        qwen: installed('qwen'),
        krea2ref: installed('krea2ref'),
        krea2remix: installed('krea2remix'),
      },
      video: {
        ltx: installed('video'),
        ltx25: installed('ltx25'),
        ltx25quality: installed('ltx25quality'),
        h3: installed('h3'),
        h3turbo: installed('h3turbo'),
        wan: installed('wan'),
      },
    },
    features: {
      upscale: installed('upscale'),
      rife: installed('rife'),
      faceid: installed('faceid'),
      h3context: installed('h3context'),
      ltxcamera: installed('ltxcamera'),
      outpaint: installed('krea2outpaint') || installed('editoutpaint'),
      depth: installed('krea2depth'),
      style: installed('krea2style'),
    },
    limits: { ...PUBLIC_LIMITS },
  };
}

module.exports = {
  PUBLIC_LIMITS,
  createSimpleCapabilities,
};
