"use strict";
const putInCache = async (request, response) => {
    const cache = await caches.open("v2");
    await cache.put(request, response);
};
const sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
const $self = self;
$self.skipWaiting();
$self.addEventListener('message', console.log);
$self.addEventListener('activate', console.log);
$self.addEventListener('fetch', async (ev) => {
    const request = ev.request;
    if (request.url.startsWith('https:')) {
        ev.respondWith((async () => {
            try {
                const ft = await fetch(request);
                putInCache(request, ft.clone());
                return ft;
            }
            catch {
                const cache = await caches.match(request);
                if (cache) {
                    return cache;
                }
                else {
                    return new Response;
                }
            }
        })());
    }
});
