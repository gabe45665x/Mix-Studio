// SPDX-License-Identifier: GPL-3.0-or-later
// Modified from Mix Studio (c) Black Mixture; zh-TW customization (c) gabe45665x 2026
'use strict';

(function registerTasks(root) {
  function render(state, ctx) {
    const filters = { active: ['queued', 'running'], completed: ['completed'], failed: ['failed', 'cancelled'] };
    const jobs = state.jobs.filter((job) => filters[state.taskFilter].includes(job.status));
    const pendingOrder = (state.queue?.pending || []).map((item) => String(item.jobId || ''));
    const timeLabel = (value) => value ? new Intl.DateTimeFormat(state.language === 'en' ? 'en' : 'zh-TW', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
    return `<section><div class="page-head"><div><p class="eyebrow">${ctx.t('tasks.eyebrow')}</p><h1>${ctx.t('tasks.title')}</h1><p>${ctx.t('shell.tasksIntro')}</p></div><button class="icon-button" type="button" data-action="refresh-tasks" aria-label="${ctx.t('actions.refresh')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a7 7 0 0 1 6.3 4H16l3.3 3.3L22.6 9h-2.2A9 9 0 0 0 4 8.2L5.7 9A7 7 0 0 1 12 5Zm-7.3 6.7L1.4 15h2.2A9 9 0 0 0 20 15.8l-1.7-.8A7 7 0 0 1 5.7 15H8l-3.3-3.3Z"/></svg></button></div>
      <div class="task-tabs" role="tablist">${['active', 'completed', 'failed'].map((filter) => `<button type="button" role="tab" data-task-filter="${filter}" aria-selected="${state.taskFilter === filter}" class="${state.taskFilter === filter ? 'active' : ''}">${ctx.t(`tasks.${filter}`)}</button>`).join('')}</div>
      ${jobs.length ? jobs.map((job) => {
        const queueIndex = pendingOrder.indexOf(job.id);
        const progressMeta = ['running','queued'].includes(job.status) ? `<progress class="progress" aria-label="${job.progress}%" max="100" value="${job.progress}"></progress><div class="task-meta"><span>${ctx.h(job.stageLabel)}</span><span>${job.progress}%</span></div>${job.etaLabel ? `<p class="field-help">${ctx.t('tasks.eta', { time: job.etaLabel })}</p>` : ''}${state.connectionState === 'lost' && job.lastProgressAt ? `<p class="field-help warning-copy">${ctx.t('tasks.lastKnownProgress', { time: timeLabel(job.lastProgressAt) })}</p>` : ''}` : '';
        const reorder = job.reorderable ? `<div class="reorder-row" aria-label="${ctx.t('tasks.reorder')}"><button class="secondary-button" type="button" data-reorder-job="${ctx.h(job.id)}" data-direction="-1" ${queueIndex <= 0 ? 'disabled' : ''}>${ctx.t('actions.moveUp')}</button><button class="secondary-button" type="button" data-reorder-job="${ctx.h(job.id)}" data-direction="1" ${queueIndex < 0 || queueIndex >= pendingOrder.length - 1 ? 'disabled' : ''}>${ctx.t('actions.moveDown')}</button></div>` : '';
        return `<article class="card"><div class="card-head"><div><h2>${ctx.h(job.modeLabel)}</h2><p class="support">${ctx.h(job.prompt || ctx.t('tasks.otherProfile'))}</p></div><span class="status-badge ${job.status === 'completed' ? 'good' : job.status === 'failed' ? 'bad' : ''}">${ctx.h(job.statusLabel)}</span></div>${progressMeta}${reorder}<details class="task-details"><summary>${ctx.t('tasks.details')}</summary><dl><div><dt>${ctx.t('tasks.submittedAt')}</dt><dd>${ctx.h(timeLabel(job.submittedAt))}</dd></div><div><dt>${ctx.t('tasks.promptId')}</dt><dd>${ctx.h(job.id)}</dd></div><div><dt>${ctx.t('tasks.originalStage')}</dt><dd>${ctx.h(job.originalStage || '—')}</dd></div><div><dt>${ctx.t('fields.engine')}</dt><dd>${ctx.h(job.engine || '—')}</dd></div></dl></details><div class="button-row spaced">${['running','queued'].includes(job.status) && job.canCancel ? `<button class="secondary-button" type="button" data-cancel-job="${ctx.h(job.id)}">${ctx.t('actions.cancel')}</button>` : ''}${job.status === 'failed' ? `<button class="secondary-button" type="button" data-retry-job="${ctx.h(job.id)}" disabled title="${ctx.h(ctx.t('tasks.retryUnavailable'))}">${ctx.t('actions.retry')}</button>` : ''}</div></article>`;
      }).join('') : `<div class="empty-state"><h2>${ctx.t('tasks.empty')}</h2><p>${ctx.t('shell.tasksEmptyDetail')}</p><a class="secondary-button" href="#/">${ctx.t('nav.home')}</a></div>`}
    </section>`;
  }
  root.MixStudioSimpleViews = root.MixStudioSimpleViews || {};
  root.MixStudioSimpleViews.tasks = { render };
}(globalThis));
