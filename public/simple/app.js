// SPDX-License-Identifier: GPL-3.0-or-later
// Modified from Mix Studio (c) Black Mixture; zh-TW customization (c) gabe45665x 2026
'use strict';

(function startSimpleShell(root) {
  const views = root.MixStudioSimpleViews || {};
  const state = {
    language: localStorage.getItem('simple.lang') === 'en' ? 'en' : 'zh-TW',
    theme: localStorage.getItem('simple.theme') === 'black' ? 'black' : 'dark',
    mode: localStorage.getItem('simple.mode') || 'text-image',
    prompt: '',
    negativePrompt: '',
    aspect: '1:1',
    quality: 'quick',
    count: 1,
    duration: 5,
    seed: '',
    denoise: 0.45,
    motion: 'medium',
    stylePreset: '',
    engine: '',
    steps: 8,
    cfg: 1,
    width: 1024,
    height: 1024,
    interpolation: false,
    postUpscale: false,
    longVideo: false,
    faceId: false,
    uploadName: '',
    uploadSize: 0,
    addons: [],
    profile: null,
    profiles: [],
    profileAccess: null,
    loginProfileId: localStorage.getItem('simple.profile') || '',
    loginError: '',
    setup: null,
    hardware: null,
    hardwareLabel: '',
    capabilities: null,
    queue: null,
    jobs: [],
    galleryItems: [],
    taskFilter: 'active',
    libraryFilter: 'all',
    libraryQuery: '',
    analyticsEnabled: false,
    connectionState: navigator.onLine ? 'ready' : 'lost',
    lastProgressAt: 0,
    viewerMediaId: '',
    trashSummary: null,
    messages: {},
    fallbackMessages: {},
    route: '/',
  };

  const elements = {
    app: document.getElementById('app'),
    appBar: document.getElementById('appBar'),
    view: document.getElementById('view'),
    tabBar: document.getElementById('tabBar'),
    moreButton: document.getElementById('moreButton'),
    moreMenu: document.getElementById('moreMenu'),
    networkBanner: document.getElementById('networkBanner'),
    taskBadge: document.getElementById('taskBadge'),
    sheetLayer: document.getElementById('sheetLayer'),
    sheetContent: document.getElementById('sheetContent'),
    sheetTitle: document.getElementById('sheetTitle'),
    modalLayer: document.getElementById('modalLayer'),
    modalContent: document.getElementById('modalContent'),
    modalTitle: document.getElementById('modalTitle'),
    toast: document.getElementById('toast'),
  };
  let i18n;
  let toastTimer;
  let searchTimer;
  let eventStream;
  let connectionTimer;
  let recoveryTimer;
  let overlayHistoryActive = false;

  const FORM_FIELDS = [
    'prompt', 'negativePrompt', 'aspect', 'quality', 'count', 'duration', 'seed',
    'denoise', 'motion', 'stylePreset', 'engine', 'steps', 'cfg', 'width', 'height',
    'interpolation', 'postUpscale', 'longVideo', 'faceId', 'uploadName', 'uploadSize',
  ];

  function modeFormKey(mode) { return `simple.form.${mode}`; }

  function saveModeForm(mode = state.mode) {
    const saved = Object.fromEntries(FORM_FIELDS.map((field) => [field, state[field]]));
    localStorage.setItem(modeFormKey(mode), JSON.stringify(saved));
  }

  function restoreModeForm(mode) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(modeFormKey(mode)) || 'null'); } catch { /* ignore invalid local drafts */ }
    const defaults = {
      prompt: '', negativePrompt: '', aspect: mode.endsWith('video') ? '16:9' : mode === 'image-image' ? 'follow' : '1:1',
      quality: 'quick', count: 1, duration: 5, seed: '', denoise: 0.45, motion: 'medium',
      stylePreset: '', engine: '', steps: 8, cfg: 1, width: 1024, height: 1024,
      interpolation: false, postUpscale: false, longVideo: false, faceId: false,
      uploadName: '', uploadSize: 0,
    };
    for (const field of FORM_FIELDS) state[field] = saved && Object.prototype.hasOwnProperty.call(saved, field) ? saved[field] : defaults[field];
  }

  function h(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    }[character]));
  }

  function t(key, variables = {}) {
    return i18n ? i18n.t(key, variables) : String(key);
  }

  async function api(route, options = {}) {
    const request = { credentials: 'same-origin', ...options };
    if (request.body && !(request.body instanceof Blob) && !(request.body instanceof ArrayBuffer)) {
      request.headers = { 'Content-Type': 'application/json', ...(request.headers || {}) };
      if (typeof request.body !== 'string') request.body = JSON.stringify(request.body);
    }
    const response = await fetch(route, request);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Request failed (${response.status})`);
      error.code = payload.code;
      error.status = response.status;
      error.retryAfter = response.headers.get('Retry-After');
      throw error;
    }
    return payload;
  }

  async function loadLocales() {
    const [messages, fallback] = await Promise.all([
      fetch(`/simple/locales/${state.language}.json`, { cache: 'no-cache' }).then((response) => response.json()),
      fetch('/simple/locales/en.json', { cache: 'no-cache' }).then((response) => response.json()),
    ]);
    state.messages = messages;
    state.fallbackMessages = fallback;
    i18n = root.MixStudioI18n.createI18n({ messages, fallbackMessages: fallback });
    document.documentElement.lang = state.language === 'en' ? 'en' : 'zh-Hant-TW';
  }

  function formatMemory(bytes) {
    const size = Number(bytes || 0);
    return size > 0 ? `${Math.round(size / (1024 ** 3))} GB` : '';
  }

  function hardwareLabel(hardware) {
    const gpu = hardware?.gpu?.devices?.[0];
    if (!gpu?.name) return '';
    const name = String(gpu.name).replace(/^(?:NVIDIA\s+GeForce|AMD\s+Radeon)\s+/i, '');
    return `${name}${gpu.memoryBytes ? ` · ${formatMemory(gpu.memoryBytes)}` : ''}`;
  }

  function stageTranslation(stage) {
    const raw = String(stage || '');
    return state.messages?.stages?.[raw] || state.fallbackMessages?.stages?.[raw] || t('tasks.processing');
  }

  function modeLabel(item) {
    const value = String(item?.mode || item?.kind || item?.params?.mode || item?.videoInfo?.mode || '').toLowerCase();
    if (value.includes('video') || item?.videoInfo || item?.kind === 'video') return t(item?.inputName || item?.imageName ? 'modes.imageToVideo' : 'modes.textToVideo');
    if (value.includes('edit') || value.includes('img') || item?.imageName) return t('modes.imageToImage');
    return t('modes.textToImage');
  }

  function jobProgress(item) {
    if (Number.isFinite(Number(item?.progress))) return Math.max(0, Math.min(100, Math.round(Number(item.progress))));
    if (Number(item?.max) > 0) return Math.max(0, Math.min(100, Math.round(Number(item.value || 0) / Number(item.max) * 100)));
    return item?.status === 'completed' ? 100 : 0;
  }

  function normalizeJobs(queue) {
    const groups = [
      ['running', 'running'], ['preparing', 'running'], ['finalizing', 'running'],
      ['pending', 'queued'], ['upcoming', 'queued'], ['history', null],
    ];
    return groups.flatMap(([key, forcedStatus]) => (Array.isArray(queue?.[key]) ? queue[key] : []).map((item, index) => {
      const status = forcedStatus || (item.error ? 'failed' : item.cancelled ? 'cancelled' : 'completed');
      const stage = item.stage || item.label || item.message || '';
      const id = item.jobId || item.id || item.pid || item.prompt_id || `${key}-${index}`;
      const progress = jobProgress({ ...item, status });
      const submittedAt = Number(item.queuedAt || item.enqueuedAt || item.createdAt || 0);
      const elapsedMs = Math.max(0, Number(item.elapsedMs || (submittedAt ? Date.now() - submittedAt : 0)) || 0);
      const remainingMs = status === 'running' && progress > 1 ? Math.max(0, Math.round(elapsedMs * (100 - progress) / progress)) : 0;
      return {
        raw: item,
        id: String(id),
        status,
        statusLabel: t(`tasks.${status}`),
        modeLabel: modeLabel(item),
        prompt: String(item.prompt || item.params?.prompt || item.videoInfo?.prompt || '').slice(0, 120),
        progress,
        stageLabel: stageTranslation(stage),
        originalStage: String(stage),
        engine: String(item.engine || item.params?.engine || item.kind || ''),
        submittedAt,
        etaLabel: remainingMs ? `${Math.max(1, Math.ceil(remainingMs / 60000))} min` : '',
        lastProgressAt: state.lastProgressAt,
        reorderable: status === 'queued' && item.reorderable === true,
        canCancel: item.owned !== false && item.cancellable !== false,
      };
    }));
  }

  function normalizeMedia(item, index) {
    const video = Array.isArray(item?.videos) ? item.videos.find((entry) => entry?.file) : null;
    const file = video?.file || item?.file || item?.upscaled || '';
    const kind = video ? 'video' : 'image';
    const source = file ? `/${kind === 'video' ? 'videos' : 'images'}/${encodeURIComponent(file)}` : '';
    return {
      raw: item,
      id: String(item?.id || item?.pid || `media-${index}`),
      file: String(file),
      source,
      kind,
      prompt: String(item?.prompt || item?.params?.prompt || ''),
      engine: String(item?.engine || item?.videoInfo?.engine || ''),
      liked: item?.liked === true,
    };
  }

  function mediaCard(item) {
    const media = item.source
      ? (item.kind === 'video'
        ? `<video src="${h(item.source)}" muted preload="metadata" playsinline></video>`
        : `<img src="${h(item.source)}" alt="${h(item.prompt || t('fields.image'))}" loading="lazy">`)
      : '<span class="media-placeholder"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4V4Zm2 2v10l4-4 3 3 2-2 3 3V6H6Z"/></svg></span>';
    return `<button class="media-card" type="button" data-media-id="${h(item.id)}" aria-label="${h(item.prompt || t(item.kind === 'video' ? 'fields.video' : 'fields.image'))}">${media}<span class="media-kind">${item.kind === 'video' ? t('fields.video') : t('fields.image')}</span></button>`;
  }

  function capabilitySummary(capabilities) {
    if (!capabilities) return t('common.loading');
    const labels = [];
    if (capabilities.engines?.image?.installed) labels.push('Krea 2');
    if (capabilities.engines?.video?.ltx25) labels.push('LTX 2.5');
    else if (capabilities.engines?.video?.ltx) labels.push('LTX 2.3');
    if (capabilities.engines?.video?.h3) labels.push('MiniMax H3');
    if (capabilities.engines?.edit?.klein4 || capabilities.engines?.edit?.qwen) labels.push(t('shell.imageEditing'));
    return labels.length ? t('shell.capabilitiesReady', { items: labels.join(state.language === 'en' ? ', ' : '、') }) : t('shell.capabilitiesEmpty');
  }

  function normalizePromptPresets(payload) {
    return (Array.isArray(payload?.packs) ? payload.packs : [])
      .filter((pack) => pack?.enabled !== false)
      .flatMap((pack) => (Array.isArray(pack?.categories) ? pack.categories : [])
        .flatMap((category) => (Array.isArray(category?.presets) ? category.presets : [])
          .map((preset, index) => ({
            id: `${pack.id || 'pack'}:${preset.id || preset.slug || index}`,
            label: String(preset.name || preset.title || preset.label || preset.id || t('fields.stylePreset')),
          }))));
  }

  const context = { h, t, mediaCard, capabilitySummary };

  function translateChrome() {
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((node) => {
      node.setAttribute('aria-label', t(node.dataset.i18nAria));
    });
  }

  function currentRoute() {
    const raw = location.hash.replace(/^#/, '') || '/';
    return ['/','/tasks','/library','/custom','/settings','/login'].includes(raw) ? raw : '/';
  }

  function render() {
    state.route = currentRoute();
    if (!state.profile && state.route !== '/login') {
      location.hash = '#/login';
      return;
    }
    if (state.profile && state.route === '/login') {
      location.hash = '#/';
      return;
    }
    const name = state.route === '/' ? 'home' : state.route.slice(1);
    const view = views[name];
    if (!view) return;
    translateChrome();
    elements.view.classList.toggle('login-main', name === 'login');
    elements.view.innerHTML = view.render(state, context);
    elements.appBar.hidden = name === 'login';
    elements.tabBar.hidden = name === 'login';
    elements.moreButton.hidden = name === 'login';
    document.body.dataset.uiMode = state.mode;
    document.body.dataset.theme = state.theme;
    document.querySelectorAll('[data-route]').forEach((link) => link.classList.toggle('active', link.dataset.route === state.route));
    const activeCount = state.jobs.filter((job) => ['running', 'queued'].includes(job.status)).length;
    elements.taskBadge.hidden = !activeCount;
    elements.taskBadge.textContent = activeCount > 9 ? '9+' : String(activeCount);
    renderPhoneQr();
  }

  function toast(message, duration = 3000) {
    clearTimeout(toastTimer);
    elements.toast.textContent = String(message || '');
    elements.toast.hidden = false;
    toastTimer = setTimeout(() => { elements.toast.hidden = true; }, duration);
  }

  function updateNetwork() {
    if (!navigator.onLine) state.connectionState = 'lost';
    const banner = {
      lost: ['warn', t('shell.connectionLost')],
      recovered: ['good', t('shell.connectionRecovered')],
      sessionExpired: ['bad', t('shell.sessionExpired')],
    }[state.connectionState];
    elements.networkBanner.hidden = !banner;
    elements.networkBanner.className = `network-banner${banner ? ` ${banner[0]}` : ''}`;
    elements.networkBanner.textContent = banner?.[1] || '';
    const generateButton = document.querySelector('[data-action="generate"]');
    if (generateButton) {
      generateButton.disabled = state.connectionState === 'lost';
      generateButton.title = generateButton.disabled ? t('errors.offline') : '';
    }
  }

  async function loadProfiles() {
    const payload = await api('/api/profiles');
    state.profiles = (Array.isArray(payload.profiles) ? payload.profiles : []).map((profile, index) => ({
      ...profile,
      isOwner: index === 0,
    }));
    state.profileAccess = payload.access || {};
    if (!state.profiles.some((profile) => profile.id === state.loginProfileId)) state.loginProfileId = '';
  }

  async function loadSession() {
    await loadProfiles();
    try {
      const payload = await api('/api/me');
      const profile = payload.profile || null;
      if (profile) profile.isOwner = state.profiles[0]?.id === profile.id;
      state.profile = profile;
      if (profile) localStorage.setItem('simple.profile', profile.id);
    } catch (error) {
      if (error.status !== 401) throw error;
      state.profile = null;
    }
  }

  async function refreshQueue() {
    state.queue = await api('/api/queue');
    state.jobs = normalizeJobs(state.queue);
    render();
  }

  async function refreshData() {
    const results = await Promise.allSettled([
      api('/api/setup/status'),
      api('/api/hardware'),
      api('/api/queue'),
      api('/api/gallery'),
      api('/api/simple/capabilities'),
      api('/api/addons'),
      api('/api/analytics-config'),
    ]);
    if (results[0].status === 'fulfilled') state.setup = results[0].value;
    if (results[1].status === 'fulfilled') {
      state.hardware = results[1].value;
      state.hardwareLabel = hardwareLabel(state.hardware);
    }
    if (results[2].status === 'fulfilled') {
      state.queue = results[2].value;
      state.jobs = normalizeJobs(state.queue);
    }
    if (results[3].status === 'fulfilled') state.galleryItems = (results[3].value.items || []).map(normalizeMedia);
    if (results[4].status === 'fulfilled') state.capabilities = results[4].value;
    if (results[5].status === 'fulfilled') state.addons = normalizePromptPresets(results[5].value);
    if (results[6].status === 'fulfilled') state.analyticsEnabled = results[6].value.enabled === true;
    render();
  }

  function connectEvents() {
    if (!state.profile || typeof EventSource === 'undefined') return;
    if (eventStream) eventStream.close();
    eventStream = new EventSource('/api/events');
    const refresh = () => {
      state.lastProgressAt = Date.now();
      refreshQueue().catch(() => {});
    };
    for (const eventName of ['progress', 'complete', 'error', 'queue', 'cancelled']) eventStream.addEventListener(eventName, refresh);
    eventStream.onopen = async () => {
      clearTimeout(connectionTimer);
      try {
        const session = await api('/api/me');
        if (!session.profile) throw Object.assign(new Error('No session'), { status: 401 });
        const wasLost = state.connectionState === 'lost';
        state.connectionState = wasLost ? 'recovered' : 'ready';
        updateNetwork();
        refresh();
        clearTimeout(recoveryTimer);
        if (wasLost) recoveryTimer = setTimeout(() => {
          state.connectionState = 'ready';
          updateNetwork();
        }, 2000);
      } catch (error) {
        if (error.status === 401) expireSession();
      }
    };
    eventStream.onerror = () => {
      eventStream.close();
      eventStream = null;
      clearTimeout(connectionTimer);
      connectionTimer = setTimeout(async () => {
        state.connectionState = 'lost';
        updateNetwork();
        try { await api('/api/me'); }
        catch (error) { if (error.status === 401) expireSession(); }
      }, 3000);
      setTimeout(connectEvents, 3000);
    };
  }

  function pushOverlayHistory(kind) {
    if (overlayHistoryActive) return;
    history.pushState({ simpleOverlay: kind }, '');
    overlayHistoryActive = true;
  }

  function openSheet(content, title, options = {}) {
    elements.sheetContent.innerHTML = content;
    elements.sheetTitle.textContent = title;
    elements.sheetLayer.hidden = false;
    document.body.classList.add('sheet-open');
    elements.app.inert = true;
    elements.app.setAttribute('inert', '');
    if (options.history !== false) pushOverlayHistory('sheet');
    elements.sheetLayer.querySelector('button, input, select, textarea')?.focus();
  }

  function openAdvanced() {
    openSheet(views.home.advanced(state, context), t('fields.advanced'));
  }

  function closeSheet(fromHistory = false) {
    if (elements.sheetLayer.hidden) return;
    elements.sheetLayer.hidden = true;
    document.body.classList.remove('sheet-open');
    elements.app.inert = false;
    elements.app.removeAttribute('inert');
    if (!fromHistory && overlayHistoryActive) history.back();
    overlayHistoryActive = false;
  }

  function openModal(title, content) {
    elements.modalTitle.textContent = title;
    elements.modalContent.innerHTML = content;
    elements.modalLayer.hidden = false;
    document.body.classList.add('sheet-open');
    elements.app.inert = true;
    elements.app.setAttribute('inert', '');
    pushOverlayHistory('modal');
    elements.modalLayer.querySelector('button')?.focus();
  }

  function closeModal(fromHistory = false) {
    if (elements.modalLayer.hidden) return;
    elements.modalLayer.hidden = true;
    const sheetStillOpen = !elements.sheetLayer.hidden;
    if (sheetStillOpen) {
      document.body.classList.add('sheet-open');
      elements.app.inert = true;
      elements.app.setAttribute('inert', '');
      if (fromHistory) {
        overlayHistoryActive = false;
        pushOverlayHistory('sheet');
      }
      return;
    }
    document.body.classList.remove('sheet-open');
    elements.app.inert = false;
    elements.app.removeAttribute('inert');
    if (!fromHistory && overlayHistoryActive) history.back();
    overlayHistoryActive = false;
  }

  function expireSession() {
    if (eventStream) eventStream.close();
    eventStream = null;
    state.profile = null;
    state.connectionState = 'sessionExpired';
    updateNetwork();
    location.hash = '#/login';
    render();
  }

  function createPhoneAccessQrSvg(url) {
    const QrCode = root.qrcodegen?.QrCode;
    if (!QrCode || !url) return null;
    const qr = QrCode.encodeText(url, QrCode.Ecc.MEDIUM);
    const border = 4;
    const size = qr.size + border * 2;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t('shell.phoneQrLabel'));
    svg.setAttribute('shape-rendering', 'crispEdges');
    let pathData = '';
    for (let y = 0; y < qr.size; y += 1) for (let x = 0; x < qr.size; x += 1) {
      if (qr.getModule(x, y)) pathData += `M${x + border} ${y + border}h1v1h-1z`;
    }
    svg.innerHTML = `<rect width="100%" height="100%" fill="#fff"/><path d="${pathData}" fill="#000"/>`;
    return svg;
  }

  function renderPhoneQr() {
    const target = document.getElementById('phoneQr');
    if (!target) return;
    const access = state.setup?.mobileAccess || {};
    const url = access.secureUrl || access.localUrl || access.tailscaleUrl || '';
    const qr = createPhoneAccessQrSvg(url);
    target.replaceChildren(...(qr ? [qr] : []));
  }

  async function chooseUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const payload = await api('/api/upload', {
          method: 'POST',
          headers: { 'x-filename': file.name, 'x-asset-catalog': '1', 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        state.uploadName = payload.name || payload.file || file.name;
        state.uploadSize = file.size;
        toast(t('toast.uploadComplete'));
        render();
      } catch (error) { toast(error.message); }
    }, { once: true });
    input.click();
  }

  async function login(form) {
    const profile = state.profiles.find((entry) => entry.id === state.loginProfileId);
    if (!profile) return;
    const pin = new FormData(form).get('pin') || '';
    try {
      const payload = await api(`/api/profiles/${encodeURIComponent(profile.id)}/login`, { method: 'POST', body: { pin } });
      state.profile = payload.profile;
      state.profile.isOwner = state.profiles[0]?.id === state.profile.id;
      state.loginError = '';
      localStorage.setItem('simple.profile', profile.id);
      location.hash = '#/';
      await refreshData();
      connectEvents();
      toast(t('toast.signedIn'));
    } catch (error) {
      state.loginError = error.status === 429 ? t('login.tooManyAttempts', { seconds: error.retryAfter || '?' }) : (error.message || t('errors.auth'));
      render();
    }
  }

  async function createOwner(form) {
    const fields = new FormData(form);
    const name = String(fields.get('name') || '').trim();
    const pin = String(fields.get('pin') || '');
    if (pin !== String(fields.get('pinConfirm') || '')) {
      state.loginError = t('login.pinMismatch');
      render();
      return;
    }
    try {
      const payload = await api('/api/profiles', { method: 'POST', body: { name, pin } });
      state.profile = { ...payload.profile, isOwner: true };
      state.loginError = '';
      await loadProfiles();
      localStorage.setItem('simple.profile', state.profile.id);
      location.hash = '#/';
      await refreshData();
      connectEvents();
    } catch (error) {
      state.loginError = error.message;
      render();
    }
  }

  async function logout() {
    try { await api('/api/logout', { method: 'POST', body: {} }); } catch {}
    if (eventStream) eventStream.close();
    eventStream = null;
    state.profile = null;
    state.loginProfileId = localStorage.getItem('simple.profile') || '';
    elements.moreMenu.hidden = true;
    location.hash = '#/login';
    render();
  }

  function currentMedia() {
    return state.galleryItems.find((item) => item.id === state.viewerMediaId) || null;
  }

  async function openTrash() {
    try {
      state.trashSummary = await api('/api/trash');
      const files = Math.max(0, Number(state.trashSummary.files) || 0);
      const bytes = Math.max(0, Number(state.trashSummary.bytes) || 0);
      const size = bytes ? `${Math.max(0.1, bytes / (1024 ** 2)).toFixed(1)} MB` : '0 MB';
      openSheet(`<div class="trash-sheet"><p>${h(t('shell.trashSummary', { count: files, size }))}</p>${files ? `<button class="danger-button full" type="button" data-action="confirm-empty-trash">${h(t('actions.deleteForever'))}</button>` : `<div class="empty-state compact"><p>${h(t('library.trashEmpty'))}</p></div>`}<p class="field-help">${h(t('shell.trashRestoreDeferred'))}</p></div>`, t('library.trash'));
    } catch (error) { toast(error.message); }
  }

  async function reorderJob(id, direction) {
    const order = (state.queue?.pending || []).map((item) => String(item.jobId || '')).filter(Boolean);
    const index = order.indexOf(String(id));
    const target = index + Number(direction);
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    try {
      await api('/api/queue/reorder', { method: 'POST', body: { order } });
      await refreshQueue();
    } catch (error) { toast(error.message); }
  }

  function reuseMedia() {
    const item = currentMedia();
    if (!item) return;
    const params = item.raw?.params || item.raw || {};
    state.mode = item.kind === 'video' ? (params.imageName ? 'image-video' : 'text-video') : (params.imageName ? 'image-image' : 'text-image');
    state.prompt = item.prompt || '';
    for (const field of FORM_FIELDS) if (Object.prototype.hasOwnProperty.call(params, field)) state[field] = params[field];
    saveModeForm();
    localStorage.setItem('simple.mode', state.mode);
    state.viewerMediaId = '';
    location.hash = '#/';
    render();
    toast(t('shell.reuseRestored'));
  }

  async function toggleFavorite() {
    const item = currentMedia();
    if (!item) return;
    try {
      const updated = await api(`/api/item/${encodeURIComponent(item.id)}/like`, { method: 'POST', body: { liked: !item.liked } });
      item.liked = updated.liked === true;
      render();
    } catch (error) { toast(error.message); }
  }

  function confirmMediaDelete() {
    const item = currentMedia();
    if (!item) return;
    openModal(t('actions.delete'), `<p>${h(t('library.confirmDelete'))}</p><div class="button-row spaced"><button class="secondary-button" type="button" data-action="close-modal">${h(t('actions.cancel'))}</button><button class="danger-button" type="button" data-action="delete-media-confirmed">${h(t('actions.delete'))}</button></div>`);
  }

  async function deleteMedia() {
    const item = currentMedia();
    if (!item) return;
    try {
      await api(`/api/item/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      state.galleryItems = state.galleryItems.filter((entry) => entry.id !== item.id);
      state.viewerMediaId = '';
      closeModal();
      render();
      toast(t('toast.deleted'));
    } catch (error) { toast(error.message); }
  }

  async function handleAction(action) {
    if (action === 'clear-prompt') { state.prompt = ''; render(); document.getElementById('mainPrompt')?.focus(); }
    else if (action === 'enhance-prompt') toast(t('shell.enhancePending'));
    else if (action === 'open-advanced') openAdvanced();
    else if (action === 'close-sheet') closeSheet();
    else if (action === 'close-modal') closeModal();
    else if (action === 'choose-upload') chooseUpload();
    else if (action === 'remove-upload') { state.uploadName = ''; state.uploadSize = 0; render(); }
    else if (action === 'generate') {
      if (!navigator.onLine || state.connectionState === 'lost') { toast(t('errors.offline')); return; }
      if (!state.prompt.trim()) { toast(t('shell.promptRequired')); document.getElementById('mainPrompt')?.focus(); return; }
      if (state.mode.startsWith('image-') && !state.uploadName) { toast(t('shell.imageRequired')); return; }
      root.MixStudioSimplePayloads.buildSimplePayload(state.mode, state);
      toast(t('shell.mappingPending'), 4200);
    } else if (action === 'refresh-tasks') refreshQueue().catch((error) => toast(error.message));
    else if (action === 'choose-profile') { state.loginProfileId = ''; state.loginError = ''; render(); }
    else if (action === 'logout') logout();
    else if (action === 'about') { elements.moreMenu.hidden = true; location.hash = '#/settings'; }
    else if (action === 'start-comfy') {
      try { await api('/api/comfy/start', { method: 'POST', body: {} }); toast(t('home.starting')); setTimeout(refreshData, 2500); }
      catch (error) { toast(error.message); }
    } else if (action === 'toggle-analytics') {
      try {
        const enabled = !state.analyticsEnabled;
        await api('/api/simple/analytics', { method: 'POST', body: { enabled } });
        state.analyticsEnabled = enabled;
        render(); toast(t('toast.settingsUpdated'));
      } catch (error) { toast(error.message); }
    } else if (action === 'reset-advanced') {
      state.negativePrompt = ''; state.count = 1; state.duration = 5; state.seed = '';
      state.denoise = 0.45; state.motion = 'medium'; state.engine = ''; state.steps = 8; state.cfg = 1;
      state.width = 1024; state.height = 1024; state.interpolation = false; state.postUpscale = false;
      state.longVideo = false; state.faceId = false;
      openAdvanced();
    } else if (action === 'open-trash') openTrash();
    else if (action === 'close-viewer') { state.viewerMediaId = ''; render(); }
    else if (action === 'download-media') {
      const item = currentMedia();
      if (item?.source) {
        const link = document.createElement('a'); link.href = item.source; link.download = item.file || 'mix-studio-media'; link.click();
      }
    } else if (action === 'copy-media-prompt') {
      const item = currentMedia();
      if (item) navigator.clipboard?.writeText(item.prompt).then(() => toast(t('toast.copied'))).catch(() => toast(item.prompt));
    } else if (action === 'reuse-media') reuseMedia();
    else if (action === 'toggle-favorite') toggleFavorite();
    else if (action === 'delete-media') confirmMediaDelete();
    else if (action === 'delete-media-confirmed') deleteMedia();
    else if (action === 'confirm-empty-trash') openModal(t('actions.deleteForever'), `<p>${h(t('library.confirmDeleteForever'))}</p><div class="button-row spaced"><button class="secondary-button" type="button" data-action="close-modal">${h(t('actions.cancel'))}</button><button class="danger-button" type="button" data-action="empty-trash-confirmed">${h(t('actions.deleteForever'))}</button></div>`);
    else if (action === 'empty-trash-confirmed') {
      try {
        await api('/api/trash', { method: 'DELETE', body: { confirm: 'EMPTY TRASH' } });
        closeModal(); closeSheet(); toast(t('toast.deleted'));
      } catch (error) { toast(error.message); }
    } else if (action === 'enable-https') {
      try {
        const payload = await api('/api/mobile-access/enable-https', { method: 'POST', body: {} });
        state.setup = { ...(state.setup || {}), mobileAccess: payload.mobileAccess };
        render(); toast(t('toast.settingsUpdated'));
      } catch (error) { toast(error.message); }
    } else if (action === 'copy-phone-url') {
      const access = state.setup?.mobileAccess || {};
      const value = access.secureUrl || access.localUrl || access.tailscaleUrl || '';
      if (value) navigator.clipboard?.writeText(value).then(() => toast(t('toast.copied'))).catch(() => toast(value));
    }
  }

  document.addEventListener('click', (event) => {
    const actionNode = event.target.closest('[data-action]');
    if (actionNode) { event.preventDefault(); handleAction(actionNode.dataset.action); return; }
    const mode = event.target.closest('[data-mode]')?.dataset.mode;
    if (mode) { saveModeForm(); state.mode = mode; restoreModeForm(mode); localStorage.setItem('simple.mode', mode); render(); return; }
    const aspect = event.target.closest('[data-aspect]')?.dataset.aspect;
    if (aspect) { state.aspect = aspect; saveModeForm(); render(); return; }
    const quality = event.target.closest('[data-quality]')?.dataset.quality;
    if (quality) { state.quality = quality; saveModeForm(); render(); return; }
    const motion = event.target.closest('[data-motion]')?.dataset.motion;
    if (motion) { state.motion = motion; saveModeForm(); render(); return; }
    const taskFilter = event.target.closest('[data-task-filter]')?.dataset.taskFilter;
    if (taskFilter) { state.taskFilter = taskFilter; render(); return; }
    const libraryFilter = event.target.closest('[data-library-filter]')?.dataset.libraryFilter;
    if (libraryFilter) { state.libraryFilter = libraryFilter; render(); return; }
    const profileId = event.target.closest('[data-login-profile]')?.dataset.loginProfile;
    if (profileId) { state.loginProfileId = profileId; state.loginError = ''; render(); return; }
    const language = event.target.closest('[data-language]')?.dataset.language;
    if (language) { state.language = language; localStorage.setItem('simple.lang', language); loadLocales().then(render); return; }
    const theme = event.target.closest('[data-theme]')?.dataset.theme;
    if (theme) { state.theme = theme; localStorage.setItem('simple.theme', theme); render(); return; }
    const cancelId = event.target.closest('[data-cancel-job]')?.dataset.cancelJob;
    if (cancelId) api('/api/queue/cancel', { method: 'POST', body: { jobId: cancelId } }).then(refreshQueue).catch((error) => toast(error.message));
    const retryId = event.target.closest('[data-retry-job]')?.dataset.retryJob;
    if (retryId) toast(t('tasks.retryUnavailable'));
    const reorder = event.target.closest('[data-reorder-job]');
    if (reorder) reorderJob(reorder.dataset.reorderJob, reorder.dataset.direction);
    const mediaId = event.target.closest('[data-media-id]')?.dataset.mediaId;
    if (mediaId) {
      state.viewerMediaId = mediaId;
      render();
    }
    if (!event.target.closest('#moreMenu') && !event.target.closest('#moreButton')) {
      elements.moreMenu.hidden = true;
      elements.moreButton.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('input', (event) => {
    const field = event.target.dataset.field;
    if (!field) return;
    if (field === 'libraryQuery') {
      state.libraryQuery = event.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(render, 180);
      return;
    }
    const numericFields = ['count', 'duration', 'denoise', 'steps', 'cfg', 'width', 'height'];
    state[field] = event.target.type === 'checkbox' ? event.target.checked
      : event.target.type === 'file' ? (event.target.files?.[0]?.name || '')
        : numericFields.includes(field) ? Number(event.target.value) : event.target.value;
    const output = document.querySelector(`[data-output-for="${CSS.escape(field)}"]`);
    if (output) output.textContent = field === 'duration' ? t('common.seconds', { count: state[field] }) : String(state[field]);
    saveModeForm();
  });

  document.addEventListener('change', (event) => {
    const field = event.target.dataset.field;
    if (!field || ['prompt', 'libraryQuery'].includes(field)) return;
    const numericFields = ['count', 'duration', 'denoise', 'steps', 'cfg', 'width', 'height'];
    state[field] = event.target.type === 'checkbox' ? event.target.checked
      : event.target.type === 'file' ? (event.target.files?.[0]?.name || '')
        : numericFields.includes(field) ? Number(event.target.value) : event.target.value;
    saveModeForm();
  });

  document.addEventListener('submit', (event) => {
    if (!['loginForm', 'createOwnerForm'].includes(event.target.id)) return;
    event.preventDefault();
    if (event.target.id === 'createOwnerForm') createOwner(event.target);
    else login(event.target);
  });

  elements.moreButton.addEventListener('click', () => {
    const open = elements.moreMenu.hidden;
    elements.moreMenu.hidden = !open;
    elements.moreButton.setAttribute('aria-expanded', String(open));
  });
  window.addEventListener('hashchange', render);
  window.addEventListener('online', () => { connectEvents(); refreshData().catch(() => {}); });
  window.addEventListener('offline', updateNetwork);
  window.addEventListener('popstate', () => {
    if (!elements.modalLayer.hidden) closeModal(true);
    else if (!elements.sheetLayer.hidden) closeSheet(true);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!elements.modalLayer.hidden) closeModal();
    else if (!elements.sheetLayer.hidden) closeSheet();
  });
  document.addEventListener('focusin', (event) => {
    if (event.target.id === 'mainPrompt') event.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });

  let longPressTimer;
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.media-card')) return;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => { navigator.vibrate?.(10); }, 520);
  });
  for (const name of ['pointerup', 'pointercancel', 'pointermove']) {
    document.addEventListener(name, () => clearTimeout(longPressTimer), { passive: true });
  }

  function syncVisualViewport() {
    const viewport = root.visualViewport;
    if (!viewport) return;
    const offset = Math.max(0, root.innerHeight - viewport.height - viewport.offsetTop);
    document.documentElement.style.setProperty('--keyboard-offset', `${offset}px`);
    document.body.classList.toggle('keyboard-open', offset > 80);
  }
  root.visualViewport?.addEventListener('resize', syncVisualViewport);
  root.visualViewport?.addEventListener('scroll', syncVisualViewport);

  async function init() {
    document.body.dataset.theme = state.theme;
    restoreModeForm(state.mode);
    syncVisualViewport();
    await loadLocales();
    updateNetwork();
    try {
      await loadSession();
      if (state.profile) {
        await refreshData();
        connectEvents();
      } else {
        if (!location.hash || currentRoute() !== '/login') location.hash = '#/login';
        render();
      }
    } catch (error) {
      elements.view.innerHTML = `<div class="empty-state"><h1>${h(t('errors.unknown'))}</h1><p>${h(error.message)}</p><button class="secondary-button" type="button" data-action="refresh-tasks">${h(t('actions.refresh'))}</button></div>`;
    }
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/simple/sw.js', { scope: '/simple/' }).catch(() => {});
    }
  }

  init();
}(globalThis));
