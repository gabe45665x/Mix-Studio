// SPDX-License-Identifier: GPL-3.0-or-later
// Modified from Mix Studio (c) Black Mixture; zh-TW customization (c) gabe45665x 2026
'use strict';

const CACHE = 'mix-studio-simple-v2';
const SHELL = [
  '/simple/index.html',
  '/simple/offline.html',
  '/simple/manifest.webmanifest',
  '/simple/style.css',
  '/simple/i18n.js',
  '/simple/payloads.js',
  '/simple/app.js',
  '/simple/locales/zh-TW.json',
  '/simple/locales/en.json',
  '/simple/icons/app-icon.svg',
  '/simple/views/home.js',
  '/simple/views/tasks.js',
  '/simple/views/library.js',
  '/simple/views/custom.js',
  '/simple/views/settings.js',
  '/simple/views/login.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('mix-studio-simple-') && key !== CACHE).map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok && url.pathname.startsWith('/simple/')) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(async () => (await caches.match(event.request)) || caches.match('/simple/offline.html')));
});
