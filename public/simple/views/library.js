// SPDX-License-Identifier: GPL-3.0-or-later
// Modified from Mix Studio (c) Black Mixture; zh-TW customization (c) gabe45665x 2026
'use strict';

(function registerLibrary(root) {
  function render(state, ctx) {
    const viewer = state.galleryItems.find((item) => item.id === state.viewerMediaId);
    if (viewer) {
      const raw = viewer.raw || {};
      const created = raw.createdAt || raw.timestamp || raw.completedAt;
      const dimensions = raw.width && raw.height ? `${raw.width} × ${raw.height}` : (raw.params?.width && raw.params?.height ? `${raw.params.width} × ${raw.params.height}` : '—');
      const media = viewer.kind === 'video'
        ? `<video src="${ctx.h(viewer.source)}" controls playsinline></video>`
        : `<img src="${ctx.h(viewer.source)}" alt="${ctx.h(viewer.prompt || ctx.t('fields.image'))}">`;
      return `<section class="library-viewer"><div class="page-head"><div><p class="eyebrow">${ctx.t('library.eyebrow')}</p><h1>${ctx.t('library.viewer')}</h1></div><button class="icon-button" type="button" data-action="close-viewer" aria-label="${ctx.t('actions.close')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 12.6 12.6-1.4 1.4L5 6.4 6.4 5Zm11.2 0L19 6.4 6.4 19 5 17.6 17.6 5Z"/></svg></button></div><div class="viewer-media">${media}</div><div class="viewer-actions"><button class="secondary-button" type="button" data-action="download-media">${ctx.t('actions.download')}</button><button class="secondary-button" type="button" data-action="copy-media-prompt">${ctx.t('actions.copy')}</button><button class="secondary-button" type="button" data-action="toggle-favorite">${ctx.t(viewer.liked ? 'actions.unfavorite' : 'actions.favorite')}</button><button class="secondary-button" type="button" data-action="reuse-media">${ctx.t('actions.reuse')}</button><button class="danger-button" type="button" data-action="delete-media">${ctx.t('actions.delete')}</button></div><article class="card viewer-metadata"><h2>${ctx.t('library.metadata')}</h2><dl><div><dt>${ctx.t('fields.prompt')}</dt><dd>${ctx.h(viewer.prompt || '—')}</dd></div><div><dt>${ctx.t('fields.engine')}</dt><dd>${ctx.h(viewer.engine || '—')}</dd></div><div><dt>${ctx.t('library.createdAt')}</dt><dd>${ctx.h(created ? new Date(created).toLocaleString(state.language === 'en' ? 'en' : 'zh-TW') : '—')}</dd></div><div><dt>${ctx.t('library.dimensions')}</dt><dd>${ctx.h(dimensions)}</dd></div></dl></article></section>`;
    }
    const query = state.libraryQuery.trim().toLowerCase();
    const items = state.galleryItems.filter((item) => {
      if (state.libraryFilter === 'images' && item.kind === 'video') return false;
      if (state.libraryFilter === 'videos' && item.kind !== 'video') return false;
      if (state.libraryFilter === 'favorites' && !item.liked) return false;
      if (!query) return true;
      return `${item.prompt || ''} ${item.engine || ''}`.toLowerCase().includes(query);
    });
    return `<section><div class="page-head"><div><p class="eyebrow">${ctx.t('library.eyebrow')}</p><h1>${ctx.t('library.title')}</h1><p>${ctx.t('shell.libraryIntro')}</p></div><button class="icon-button" type="button" data-action="open-trash" aria-label="${ctx.t('library.trash')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8l1 2h4v2H3V5h4l1-2Zm-2 6h12l-1 12H7L6 9Zm3 2 .5 8h2l-.5-8H9Zm4 0-.5 8h2l.5-8h-2Z"/></svg></button></div>
      <div class="library-tools"><input class="search-field" type="search" data-field="libraryQuery" value="${ctx.h(state.libraryQuery)}" placeholder="${ctx.h(ctx.t('library.searchPlaceholder'))}" aria-label="${ctx.h(ctx.t('library.searchPlaceholder'))}"><div class="chip-row" role="group" aria-label="${ctx.t('shell.mediaTypes')}">${['all','images','videos','favorites'].map((filter) => `<button class="chip" type="button" data-library-filter="${filter}" aria-pressed="${state.libraryFilter === filter}">${ctx.t(`library.${filter}`)}</button>`).join('')}</div></div>
      ${items.length ? `<div class="gallery-grid">${items.map((item) => ctx.mediaCard(item)).join('')}</div>` : `<div class="empty-state"><h2>${query ? ctx.t('library.noResults') : ctx.t('library.empty')}</h2><p>${query ? ctx.t('shell.searchAgain') : ctx.t('shell.libraryEmptyDetail')}</p><a class="secondary-button" href="#/">${ctx.t('nav.home')}</a></div>`}
    </section>`;
  }
  root.MixStudioSimpleViews = root.MixStudioSimpleViews || {};
  root.MixStudioSimpleViews.library = { render };
}(globalThis));
