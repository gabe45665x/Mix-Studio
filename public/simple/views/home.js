// SPDX-License-Identifier: GPL-3.0-or-later
// Modified from Mix Studio (c) Black Mixture; zh-TW customization (c) gabe45665x 2026
'use strict';

(function registerHome(root) {
  const modeKeys = {
    'text-image': 'modes.textToImage',
    'image-image': 'modes.imageToImage',
    'text-video': 'modes.textToVideo',
    'image-video': 'modes.imageToVideo',
  };
  const imageAspects = ['1:1', '4:5', '3:4', '2:3', '9:16', '3:2', '4:3', '16:9', '21:9'];
  const videoAspects = ['16:9', '9:16', '1:1', '4:3', '3:4'];

  function formatBytes(bytes, ctx) {
    const value = Number(bytes || 0);
    if (!value) return '';
    if (value >= 1024 * 1024) return ctx.t('common.megabytes', { count: (value / (1024 * 1024)).toFixed(1) });
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  function uploadZone(state, ctx) {
    if (!state.mode.startsWith('image-')) return '';
    const label = state.mode === 'image-image' ? ctx.t('fields.referenceImage') : ctx.t('fields.firstFrame');
    if (!state.uploadName) {
      return `<button class="upload-zone" type="button" data-action="choose-upload" aria-label="${ctx.h(label)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 16V7.8L8.4 10.4 7 9l5-5 5 5-1.4 1.4L13 7.8V16h-2ZM5 18h14v2H5v-2Z"/></svg>
        <span><strong>${ctx.h(label)}</strong><small>${ctx.t('shell.uploadHint')}</small></span>
      </button>`;
    }
    const detail = [state.uploadName, formatBytes(state.uploadSize, ctx)].filter(Boolean).join(' · ');
    return `<article class="upload-preview">
      <img src="/api/input?name=${encodeURIComponent(state.uploadName)}" alt="${ctx.h(label)}">
      <div class="upload-preview-copy"><strong>${ctx.h(label)}</strong><small>${ctx.h(detail)}</small></div>
      <div class="upload-preview-actions"><button class="text-button" type="button" data-action="choose-upload">${ctx.t('actions.replace')}</button><button class="text-button danger-text" type="button" data-action="remove-upload">${ctx.t('actions.remove')}</button></div>
    </article>`;
  }

  function countControl(state, ctx) {
    return `<div class="control-group compact-control"><label class="control-label" for="batchCount"><span>${ctx.t('fields.count')}</span><small>${ctx.t('help.count')}</small></label><input class="field compact-number" id="batchCount" data-field="count" type="number" inputmode="numeric" min="1" max="8" step="1" value="${state.count}"></div>`;
  }

  function styleControl(state, ctx) {
    const presets = Array.isArray(state.addons) ? state.addons : [];
    if (!presets.length) return '';
    return `<div class="control-group"><label class="control-label" for="stylePreset"><span>${ctx.t('fields.stylePreset')}</span><small>${ctx.t('help.stylePreset')}</small></label><select class="select-field" id="stylePreset" data-field="stylePreset"><option value="">${ctx.t('common.none')}</option>${presets.map((preset) => `<option value="${ctx.h(preset.id)}"${state.stylePreset === preset.id ? ' selected' : ''}>${ctx.h(preset.label)}</option>`).join('')}</select></div>`;
  }

  function negativePromptControl(state, ctx) {
    return `<details class="inline-disclosure"><summary>${ctx.t('fields.negativePrompt')}</summary><div class="disclosure-body"><label class="sr-only" for="negativePrompt">${ctx.t('fields.negativePrompt')}</label><textarea class="field" id="negativePrompt" data-field="negativePrompt" rows="3" placeholder="${ctx.h(ctx.t('help.negativePrompt'))}">${ctx.h(state.negativePrompt)}</textarea></div></details>`;
  }

  function denoiseControl(state, ctx) {
    return `<div class="control-group"><label class="control-label" for="denoise"><span>${ctx.t('fields.denoise')}</span><output data-output-for="denoise">${Number(state.denoise).toFixed(2)}</output></label><input class="range-field" id="denoise" data-field="denoise" type="range" min="0.1" max="1" step="0.05" value="${state.denoise}" aria-describedby="denoiseHelp"><small class="field-help" id="denoiseHelp">${ctx.t('help.denoise')}</small></div>`;
  }

  function videoControls(state, ctx) {
    const video = state.capabilities?.engines?.video || {};
    const limits = state.capabilities?.limits || {};
    const ltxReady = video.ltx25 || video.ltx;
    const min = ltxReady ? 1 : video.h3 ? Number(limits.h3Min || 5) : 1;
    const max = ltxReady ? Number(limits.ltx25MaxSeconds || limits.ltxMaxSeconds || 20) : video.h3 ? Number(limits.h3Max || 15) : 20;
    const audioReady = video.ltx25 || video.ltx || video.h3;
    return `<div class="control-group"><label class="control-label" for="duration"><span>${ctx.t('fields.duration')}</span><output data-output-for="duration">${ctx.t('common.seconds', { count: state.duration })}</output></label><input class="range-field" id="duration" data-field="duration" type="range" min="${min}" max="${max}" step="1" value="${state.duration}"></div>
      <div class="control-group"><div class="control-label"><span>${ctx.t('fields.motion')}</span><small>${ctx.t('shell.motionPromptEffect')}</small></div><div class="segmented" role="group" aria-label="${ctx.t('fields.motion')}">${['low', 'medium', 'high'].map((motion) => `<button type="button" data-motion="${motion}" aria-pressed="${state.motion === motion}">${ctx.t(`fields.motion${motion[0].toUpperCase()}${motion.slice(1)}`)}</button>`).join('')}</div></div>
      ${audioReady ? `<div class="readonly-row"><span>${ctx.t('fields.audio')}</span><strong>${ctx.t('help.audioGenerated')}</strong></div>` : ''}`;
  }

  function qualityAvailable(state, quality) {
    if (!state.capabilities) return true;
    const isVideo = state.mode.endsWith('video');
    if (!isVideo) {
      const image = state.capabilities.engines?.image || {};
      if (quality === 'quick') return image.turbo === true;
      if (quality === 'standard') return image.raw === true;
      return image.raw === true && state.capabilities.features?.upscale === true;
    }
    const video = state.capabilities.engines?.video || {};
    const anyVideo = video.ltx25 || video.ltx || video.h3 || (state.mode === 'image-video' && video.wan);
    if (quality === 'quick') return Boolean(anyVideo);
    const standard = video.ltx || video.h3 || video.ltx25quality;
    return quality === 'standard' ? Boolean(standard) : Boolean(standard && state.capabilities.features?.upscale);
  }

  function currentTask(state, ctx) {
    const job = state.jobs.find((entry) => entry.status === 'running' || entry.status === 'queued');
    if (!job) return '';
    return `<section aria-labelledby="currentTaskTitle"><h2 class="section-title" id="currentTaskTitle">${ctx.t('home.currentTask')}</h2>
      <article class="card"><div class="card-head"><div><h3>${ctx.h(job.modeLabel)}</h3><p class="support">${ctx.h(job.prompt || ctx.t('tasks.processing'))}</p></div><span class="status-badge">${ctx.h(job.statusLabel)}</span></div>
      <progress class="progress" aria-label="${job.progress}%" max="100" value="${job.progress}"></progress><div class="task-meta"><span>${ctx.h(job.stageLabel)}</span><span>${job.progress}%</span></div></article></section>`;
  }

  function recentResults(state, ctx) {
    const items = state.galleryItems.slice(0, 8);
    if (!items.length) return '';
    return `<section aria-labelledby="recentTitle"><div class="page-head"><div><h2 class="section-title" id="recentTitle">${ctx.t('home.recentResults')}</h2></div><a class="support" href="#/library">${ctx.t('shell.viewAll')}</a></div>
      <div class="gallery-grid">${items.slice(0, 4).map((item) => ctx.mediaCard(item)).join('')}</div></section>`;
  }

  function render(state, ctx) {
    const connected = state.setup?.comfy?.connected === true;
    const gpu = state.hardwareLabel;
    const capabilities = state.capabilities;
    const imageReady = capabilities?.engines?.image?.installed === true;
    const editReady = Object.values(capabilities?.engines?.edit || {}).some(Boolean);
    const videoReady = Object.values(capabilities?.engines?.video || {}).some(Boolean);
    const modeReady = state.mode === 'text-image' ? imageReady
      : state.mode === 'image-image' ? editReady : videoReady;
    const isVideo = state.mode.endsWith('video');
    const isImageInput = state.mode.startsWith('image-');
    const aspects = isVideo ? videoAspects : (state.mode === 'image-image' ? ['follow', ...imageAspects] : imageAspects);
    const promptKey = isVideo ? 'home.motionPromptPlaceholder' : 'home.promptPlaceholder';
    const count = state.jobs.filter((job) => job.status === 'queued' || job.status === 'running').length;
    const summary = [state.aspect === 'follow' ? ctx.t('fields.followSource') : state.aspect, ctx.t(`modes.${state.quality}`)];
    if (isVideo) summary.push(ctx.t('common.seconds', { count: state.duration }), ctx.t(`fields.motion${state.motion[0].toUpperCase()}${state.motion.slice(1)}`));
    return `<section class="home-page">
      <div class="hero-copy"><p class="eyebrow">${ctx.t('home.eyebrow')}</p><h1>${ctx.t('home.title')}</h1><p>${ctx.t('home.subtitle')}</p></div>
      <div class="status-strip" aria-label="${ctx.t('home.status')}">
        <span class="status-item"><i class="status-dot ${connected ? 'good' : 'bad'}"></i>${connected ? ctx.t('home.connected') : ctx.t('home.disconnected')}</span>
        ${gpu ? `<span class="status-item">${ctx.h(gpu)}</span>` : ''}
        <span class="status-item">${ctx.t('home.queueCount', { count })}</span>
        ${!connected && state.profile?.isOwner ? `<button class="text-button" type="button" data-action="start-comfy">${ctx.t('actions.start')}</button>` : ''}
      </div>

      <div class="prompt-card">
        <textarea id="mainPrompt" data-field="prompt" rows="3" maxlength="8000" placeholder="${ctx.h(ctx.t(promptKey))}" aria-label="${ctx.h(ctx.t('fields.prompt'))}">${ctx.h(state.prompt)}</textarea>
        <div class="prompt-actions"><button type="button" data-action="clear-prompt">${ctx.t('home.clearPrompt')}</button><button type="button" data-action="enhance-prompt">${ctx.t('home.enhancePrompt')}</button></div>
      </div>

      <div class="mode-switcher" role="group" aria-label="${ctx.t('shell.modeGroup')}">
        ${Object.entries(modeKeys).map(([mode, key]) => `<button type="button" data-mode="${mode}" aria-pressed="${state.mode === mode}">${ctx.t(key)}</button>`).join('')}
      </div>

      ${isImageInput ? uploadZone(state, ctx) : ''}
      <div class="quick-controls">
        ${state.mode === 'text-image' ? negativePromptControl(state, ctx) : ''}
        ${state.mode === 'image-image' ? denoiseControl(state, ctx) : ''}
        <div class="control-group"><div class="control-label"><span>${ctx.t('fields.aspectRatio')}</span></div><div class="chip-row" role="group" aria-label="${ctx.t('fields.aspectRatio')}">${aspects.map((aspect) => `<button class="chip" type="button" data-aspect="${aspect}" aria-pressed="${state.aspect === aspect}">${aspect === 'follow' ? ctx.t('fields.followSource') : aspect}</button>`).join('')}</div></div>
        <div class="control-group"><div class="control-label"><span>${ctx.t('fields.quality')}</span></div><div class="segmented" role="group" aria-label="${ctx.t('fields.quality')}">${['quick', 'standard', 'quality'].map((quality) => { const enabled = qualityAvailable(state, quality); return `<button type="button" data-quality="${quality}" aria-pressed="${state.quality === quality}"${enabled ? '' : ` disabled title="${ctx.h(ctx.t('home.installRequired'))}"`}>${ctx.t(`modes.${quality}`)}</button>`; }).join('')}</div></div>
        ${isVideo ? videoControls(state, ctx) : `${countControl(state, ctx)}${styleControl(state, ctx)}`}
      </div>
      <div class="summary-row"><span>${ctx.h(summary.join(' · '))}</span><button class="advanced-button" type="button" data-action="open-advanced">${ctx.t('fields.advanced')} →</button></div>
      ${currentTask(state, ctx)}
      ${recentResults(state, ctx)}
      <div class="generate-dock">${capabilities && !modeReady ? `<a class="primary-button full" href="/studio">${ctx.t('home.installRequired')}</a>` : `<button class="primary-button full" type="button" data-action="generate"${state.connectionState === 'lost' ? ` disabled title="${ctx.h(ctx.t('errors.offline'))}"` : ''}>${ctx.t('actions.generate')}</button>`}</div>
    </section>`;
  }

  function engineOptions(state, ctx) {
    const options = [];
    if (state.mode === 'text-image') {
      if (state.capabilities?.engines?.image?.turbo) options.push(['krea2-turbo', 'Krea 2 Turbo']);
      if (state.capabilities?.engines?.image?.raw) options.push(['krea2-raw', 'Krea 2 Raw']);
    } else if (state.mode === 'image-image') {
      if (state.capabilities?.engines?.image?.installed) options.push(['krea2', 'Krea 2']);
      const edit = state.capabilities?.engines?.edit || {};
      for (const [id, label] of [['klein4', 'Klein 4B'], ['klein9', 'Klein 9B'], ['qwen', 'Qwen Edit'], ['krea2ref', 'Krea 2 Reference'], ['krea2remix', 'Krea 2 Remix']]) if (edit[id]) options.push([id, label]);
    } else {
      const video = state.capabilities?.engines?.video || {};
      for (const [id, label] of [['ltx25', 'LTX 2.5'], ['ltx', 'LTX 2.3'], ['h3', 'MiniMax H3']]) if (video[id]) options.push([id, label]);
      if (state.mode === 'image-video' && video.wan) options.push(['wan', 'Wan 2.2']);
    }
    if (!options.length) return `<option value="">${ctx.t('shell.notInstalled')}</option>`;
    return options.map(([id, label]) => `<option value="${id}"${state.engine === id ? ' selected' : ''}>${label}</option>`).join('');
  }

  function capabilityToggle(field, label, enabled, ctx) {
    return `<label class="switch-row${enabled ? '' : ' disabled'}"><span><strong>${ctx.t(label)}</strong><small>${enabled ? ctx.t('shell.mappingPending') : ctx.t('home.installRequired')}</small></span><input data-field="${field}" type="checkbox"${enabled ? '' : ' disabled'}></label>`;
  }

  function advanced(state, ctx) {
    const isVideo = state.mode.endsWith('video');
    const isImageVideo = state.mode === 'image-video';
    const features = state.capabilities?.features || {};
    return `<div class="sheet-grid">
      <section class="advanced-group"><h3>${ctx.t('fields.model')}</h3><div class="sheet-field"><label for="engine">${ctx.t('fields.engine')}</label><select class="select-field" id="engine" data-field="engine">${engineOptions(state, ctx)}</select></div></section>
      <section class="advanced-group"><h3>${ctx.t('fields.lora')}</h3><div class="sheet-field"><label for="loras">${ctx.t('fields.lora')}</label><select class="select-field" id="loras" data-field="loras" disabled><option>${ctx.t('shell.mappingPending')}</option></select></div></section>
      <section class="advanced-group"><h3>${ctx.t('fields.seed')}</h3><div class="sheet-field"><label for="seed">${ctx.t('fields.seed')}</label><input class="field" id="seed" data-field="seed" type="number" inputmode="numeric" min="0" max="281474976710656" placeholder="${ctx.t('fields.randomSeed')}" value="${ctx.h(state.seed)}"></div></section>
      ${!isVideo ? `<section class="advanced-group"><h3>${ctx.t('shell.sampling')}</h3><div class="sheet-two-column"><div class="sheet-field"><label for="steps">${ctx.t('fields.steps')}</label><input class="field" id="steps" data-field="steps" type="number" min="1" max="100" value="${state.steps}"></div><div class="sheet-field"><label for="cfg">${ctx.t('fields.cfg')}</label><input class="field" id="cfg" data-field="cfg" type="number" min="0" max="30" step="0.1" value="${state.cfg}"></div></div><p class="field-help">${ctx.t('shell.engineControlsSampler')}</p></section>
      <section class="advanced-group"><h3>${ctx.t('shell.preciseSize')}</h3><div class="sheet-two-column"><div class="sheet-field"><label for="width">${ctx.t('fields.width')}</label><input class="field" id="width" data-field="width" type="number" min="64" max="4096" step="16" value="${state.width}"></div><div class="sheet-field"><label for="height">${ctx.t('fields.height')}</label><input class="field" id="height" data-field="height" type="number" min="64" max="4096" step="16" value="${state.height}"></div></div></section>` : `<section class="advanced-group"><h3>${ctx.t('shell.videoPost')}</h3><div class="readonly-row"><span>${ctx.t('fields.fps')}</span><strong>${ctx.t('shell.engineDetermined')}</strong></div>${capabilityToggle('interpolation', 'fields.interpolation', features.rife, ctx)}${capabilityToggle('longVideo', 'shell.longVideo', features.h3context, ctx)}</section>`}
      <section class="advanced-group"><h3>${ctx.t('shell.postProcessing')}</h3>${capabilityToggle('postUpscale', 'fields.upscale', features.upscale, ctx)}</section>
      ${isImageVideo ? `<section class="advanced-group"><h3>${ctx.t('fields.reference')}</h3><div class="sheet-field"><label for="endImageName">${ctx.t('fields.lastFrame')}</label><input class="field file-field" id="endImageName" data-field="endImageName" type="file" accept="image/jpeg,image/png,image/webp"></div><div class="sheet-field"><label for="referenceVideo">${ctx.t('fields.referenceVideo')}</label><input class="field file-field" id="referenceVideo" data-field="referenceVideo" type="file" accept="video/mp4,video/webm"></div><div class="sheet-field"><label for="referenceAudio">${ctx.t('fields.referenceAudio')}</label><input class="field file-field" id="referenceAudio" data-field="referenceAudio" type="file" accept="audio/wav,audio/mpeg,audio/mp4"></div>${capabilityToggle('faceId', 'shell.faceId', features.faceid, ctx)}</section>` : ''}
      <button class="secondary-button" type="button" data-action="reset-advanced">${ctx.t('actions.reset')}</button>
    </div>`;
  }

  root.MixStudioSimpleViews = root.MixStudioSimpleViews || {};
  root.MixStudioSimpleViews.home = { render, advanced };
}(globalThis));
