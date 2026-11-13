// 타설집계 오프라인 캐시
const VER = 'pour-v11';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VER);
    await c.addAll(SHELL);
    // 외부 라이브러리는 실패해도 설치는 계속
    await Promise.all(CDN.map(u => fetch(u, { mode: 'no-cors' }).then(r => c.put(u, r)).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VER) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // 다른 앱에서 '공유'로 보낸 파일 받기
  if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/share')) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const files = fd.getAll('file').filter(f => f && typeof f !== 'string');
        await caches.delete('pour-share');
        const c = await caches.open('pour-share');
        let i = 0;
        for (const f of files) await c.put('./shared/' + (i++), new Response(f, { headers: { 'x-name': encodeURIComponent(f.name || ('file' + i)) } }));
      } catch (err) {}
      return Response.redirect('./?share=1', 303);
    })());
    return;
  }
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 앱 화면: 네트워크 우선(업데이트 반영), 실패 시 캐시
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(VER).then(c => c.put('./index.html', cp)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // 그 외(아이콘, 라이브러리, 글꼴): 캐시 우선, 없으면 받아서 저장
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r && (r.ok || r.type === 'opaque') && (url.origin === location.origin || /cdnjs|jsdelivr|tessdata|fonts\.(googleapis|gstatic)/.test(url.host))) {
      const cp = r.clone(); caches.open(VER).then(c => c.put(req, cp));
    }
    return r;
  })));
});
