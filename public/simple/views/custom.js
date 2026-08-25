// SPDX-License-Identifier: GPL-3.0-or-later
// Modified from Mix Studio (c) Black Mixture; zh-TW customization (c) gabe45665x 2026
'use strict';

(function registerCustom(root) {
  function render(state, ctx) {
    const comfyConnected = state.setup?.comfy?.connected === true;
    return `<section><div class="page-head"><div><p class="eyebrow">${ctx.t('custom.eyebrow')}</p><h1>${ctx.t('custom.title')}</h1><p>${ctx.t('custom.description')}</p></div></div>
      <article class="card"><div class="card-head"><div><h2>${ctx.t('custom.unavailable', { reason: ctx.t('shell.notInstalled') })}</h2><p class="support">${ctx.t('shell.customPending')}</p></div><span class="status-badge">${ctx.t('shell.notInstalled')}</span></div>${!comfyConnected && state.profile?.isOwner ? `<button class="secondary-button full spaced" type="button" data-action="start-comfy">${ctx.t('custom.startComfy')}</button>` : ''}<button class="primary-button full spaced" type="button" disabled>${ctx.t('custom.open')}</button></article>
      <h2 class="section-title">${ctx.t('shell.firstUse')}</h2><article class="card"><ol class="workflow-steps"><li><b>1</b><span>${ctx.t('custom.stepOne')}</span></li><li><b>2</b><span>${ctx.t('custom.stepTwo')}</span></li><li><b>3</b><span>${ctx.t('custom.stepThree')}</span></li></ol></article>
      <h2 class="section-title">${ctx.t('custom.recent')}</h2><article class="card"><p class="support">${ctx.t('custom.noRecent')}</p></article>
    </section>`;
  }
  root.MixStudioSimpleViews = root.MixStudioSimpleViews || {};
  root.MixStudioSimpleViews.custom = { render };
}(globalThis));
