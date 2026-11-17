// 서비스 워커. 앱 파일을 한 번 받아 두었다가 오프라인에서도 열리게 한다.
// (같은 아이를 위한 파이썬 학습 앱의 sw.js에서 가져왔다. 이 앱은 파이썬을 돌리지 않으므로
//  응답에 교차 출처 격리 머리말을 붙이던 부분은 뺐다.)
//
// 아래 두 값은 빌드가 끝난 뒤 scripts/finish-build.mjs가 채운다.
const VERSION = '/*VERSION*/dev';
const FILES = /*FILES*/[];

const CACHE = `kidpuzzle-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' })));
      // 여기서 바로 넘겨받지 않는다. 열려 있는 화면이 옛 파일을 읽는 도중에 옛 파일을 지우면 화면이 깨진다.
      // 화면이 다 뜬 뒤 "지금 바꿔도 돼요"라고 알려 주면 그때 넘겨받는다(아래 message).
      // 처음 설치할 때는 기다릴 옛 판이 없어서 곧바로 켜진다.
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'activate-now') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith('kidpuzzle-') && name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

async function respond(request) {
  const cache = await caches.open(CACHE);
  // ignoreVary: 서버가 Vary 머리말을 붙이면 주소가 같아도 "다른 파일"로 보고 못 찾는 일이 있다.
  // 그러면 조용히 네트워크로 넘어가서, 온라인에서는 되다가 오프라인에서만 깨진다.
  const options = { ignoreSearch: true, ignoreVary: true };
  let response = await cache.match(request, options);
  if (!response && request.mode === 'navigate') response = await cache.match('./index.html', options);
  if (!response) response = await fetch(request);
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // 받아 오는 요청만 맡는다. 기록 전송(PUT)은 건드리지 않는다.
  if (request.method !== 'GET') return;
  // 바깥 주소(기록을 올리는 GitHub API 등)는 가로채지 않고 그대로 통과시킨다.
  if (new URL(request.url).origin !== self.location.origin) return;
  // 우리 앱의 파일만 맡는다.
  if (!request.url.startsWith(self.registration.scope)) return;
  event.respondWith(respond(request));
});
