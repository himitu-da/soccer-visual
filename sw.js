// オフライン対応: 一度読み込んだファイル（Google Fontsを含む）をキャッシュし、
// 電波がなくてもキャッシュから表示する。
// アプリ本体はネットワーク優先（HTTPキャッシュも迂回）で常に最新版を表示し、
// 通信できない・遅いときだけキャッシュを使う。フォントはキャッシュ優先。
// ※ アプリを更新したら CACHE の番号を上げる（開いたままのiPadにも更新が届く）
const CACHE = 'soccer-visual-v4';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png'];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// アプリ本体: ネットワーク優先。一定時間応答がなければキャッシュを返し、取得は裏で続けて保存する
async function networkFirst(e) {
  const req = e.request;
  const cache = await caches.open(CACHE);
  const network = fetch(req.url, { cache: 'no-cache' }).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  e.waitUntil(network.catch(() => {}));
  const cached = await cache.match(req, { ignoreSearch: true });
  if (!cached) return network;
  const timeout = new Promise((r) => setTimeout(() => r(cached), NETWORK_TIMEOUT_MS));
  return Promise.race([network.catch(() => cached), timeout]);
}

// フォント: キャッシュ優先（変わらないため）
async function cacheFirst(e) {
  const req = e.request;
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(networkFirst(e));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(e));
  }
});
