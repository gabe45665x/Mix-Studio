// SPDX-License-Identifier: GPL-3.0-or-later
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const simpleRoot = path.join(__dirname, '..', 'public', 'simple');

test('simple shell retains source and license notices without inline presentation', () => {
  const licenseHtml = fs.readFileSync(path.join(simpleRoot, 'licenses.html'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(simpleRoot, 'index.html'), 'utf8');
  const offlineHtml = fs.readFileSync(path.join(simpleRoot, 'offline.html'), 'utf8');
  const css = fs.readFileSync(path.join(simpleRoot, 'style.css'), 'utf8');

  for (const html of [licenseHtml, indexHtml, offlineHtml]) assert.match(html, /SPDX-License-Identifier: GPL-3\.0-or-later/);
  assert.match(css, /^\/\* SPDX-License-Identifier: GPL-3\.0-or-later \*\//);
  assert.match(licenseHtml, /github\.com\/BlackMixture\/Mix-Studio/);
  assert.match(licenseHtml, /github\.com\/light-and-ray\/Minimalistic-Comfy-Wrapper-WebUI/);
  assert.match(licenseHtml, /GPL-3\.0-or-later/);
  assert.match(licenseHtml, /AGPL-3\.0/);
  assert.doesNotMatch(licenseHtml, /\sstyle=/i);
});
