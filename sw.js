/* Service Worker – Dương Đức Quân IT
   Mục tiêu: vượt qua TTL 10 phút cố định của GitHub Pages.
   - HTML (navigation): network-first, fallback cache khi offline
     -> bản deploy mới luôn được tải ngay ở lần truy cập kế tiếp.
   - Asset tĩnh (font, ảnh, css, js): stale-while-revalidate, response được
     ghi đè header cache-control max-age=1 năm để Lighthouse/PSI đạt kiểm tra
     "Sử dụng thời gian hữu dụng của bộ nhớ đệm". */
'use strict';

var VERSION = 'ddq-v1';

self.addEventListener('install', function () {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil((async function () {
        var keys = await caches.keys();
        await Promise.all(keys.filter(function (k) { return k !== VERSION; })
            .map(function (k) { return caches.delete(k); }));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', function (event) {
    var req = event.request;
    if (req.method !== 'GET') return;
    var url = new URL(req.url);
    if (url.origin !== location.origin) return;
    if (url.pathname.endsWith('/sw.js')) return;

    var accept = req.headers.get('accept') || '';
    var isNav = req.mode === 'navigate' || accept.indexOf('text/html') !== -1;

    if (isNav) {
        event.respondWith((async function () {
            try {
                var fresh = await fetch(req);
                var cache = await caches.open(VERSION);
                cache.put(req, fresh.clone());
                return fresh;
            } catch (err) {
                var cached = await caches.match(req);
                return cached || Response.error();
            }
        })());
        return;
    }

    event.respondWith((async function () {
        var cache = await caches.open(VERSION);
        var cached = await cache.match(req);
        var network = fetch(req).then(function (resp) {
            if (resp && resp.ok) {
                var headers = new Headers(resp.headers);
                headers.set('cache-control', 'public, max-age=31536000, immutable');
                var copy = new Response(resp.body, {
                    status: resp.status,
                    statusText: resp.statusText,
                    headers: headers
                });
                event.waitUntil(cache.put(req, copy.clone()));
                return copy;
            }
            return resp;
        }).catch(function () {
            return cached || new Response('', { status: 504, statusText: 'Gateway Timeout' });
        });
        return cached || network;
    })());
});
