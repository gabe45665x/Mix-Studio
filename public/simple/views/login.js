// SPDX-License-Identifier: GPL-3.0-or-later
// Modified from Mix Studio (c) Black Mixture; zh-TW customization (c) gabe45665x 2026
'use strict';

(function registerLogin(root) {
  function render(state, ctx) {
    const selected = state.profiles.find((profile) => profile.id === state.loginProfileId);
    const remoteBlocked = state.profileAccess?.remote && !state.profileAccess?.ownerHasPin;
    let content;
    if (!state.profiles.length && !state.profileAccess?.remote) {
      content = `<form class="card pin-form" id="createOwnerForm"><h2>${ctx.t('login.createOwner')}</h2>
        <label>${ctx.t('login.name')}<input class="field" name="name" type="text" maxlength="30" autocomplete="name" required></label>
        <label>${ctx.t('login.pin')}<input class="field" name="pin" type="password" inputmode="numeric" autocomplete="new-password" required></label>
        <label>${ctx.t('login.pinConfirm')}<input class="field" name="pinConfirm" type="password" inputmode="numeric" autocomplete="new-password" required></label>
        <p class="support">${ctx.t('login.pinHint')}</p><button class="primary-button full" type="submit">${ctx.t('actions.save')}</button></form>`;
    } else if (selected) {
      content = `<form class="card pin-form" id="loginForm"><div class="card-head"><div><h2>${ctx.h(selected.name)}</h2><p class="support">${selected.isOwner ? ctx.t('login.owner') : ctx.t('login.profile')}</p></div><button class="text-button" type="button" data-action="choose-profile">${ctx.t('settings.switchProfile')}</button></div><label>${ctx.t('login.pin')}<input class="field" name="pin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="${ctx.h(ctx.t('login.pinPlaceholder'))}" ${remoteBlocked ? 'disabled' : ''} autofocus></label><button class="primary-button full" type="submit" ${remoteBlocked ? 'disabled' : ''}>${ctx.t('actions.signIn')}</button></form>`;
    } else {
      content = `<div class="profile-list" aria-label="${ctx.t('login.chooseProfile')}">${state.profiles.map((profile) => `<button class="profile-button" type="button" data-login-profile="${ctx.h(profile.id)}" ${remoteBlocked ? 'disabled' : ''}><span class="avatar">${ctx.h((profile.name || '?').slice(0,1).toUpperCase())}</span><span><strong>${ctx.h(profile.name)}</strong><small class="support">${profile.isOwner ? ctx.t('login.owner') : ctx.t('login.profile')}</small></span></button>`).join('')}</div>`;
    }
    return `<section class="login-wrap"><div class="login-brand"><span class="wordmark-mark" aria-hidden="true">M</span><h1>${ctx.t('login.title')}</h1><p class="support">${ctx.t('shell.loginPrivacy')}</p></div>
      ${remoteBlocked ? `<div class="login-error">${ctx.t('login.ownerPinRequired')}</div>` : ''}
      ${state.loginError ? `<div class="login-error" role="alert">${ctx.h(state.loginError)}</div>` : ''}
      ${content}
    </section>`;
  }
  root.MixStudioSimpleViews = root.MixStudioSimpleViews || {};
  root.MixStudioSimpleViews.login = { render };
}(globalThis));
