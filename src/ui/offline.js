// 서비스 워커를 켠다. 설치할 때 앱 파일을 받아 두어 오프라인에서도 열리게 한다.
// (같은 아이를 위한 파이썬 학습 앱의 offline.js에서 가져왔다. 이 앱은 파이썬을 돌리지 않으므로
//  교차 출처 격리와, 그 때문에 처음 한 번 다시 읽던 부분은 뺐다.)

let reloadWaiting = false;
let safeToReload = () => true;

/**
 * @param {{canReload?: () => boolean}} options canReload: 지금 화면을 다시 읽어도 되는가(판을 하는 중에는 안 된다)
 * 돌려주는 값: 'dev'(개발 서버), 'ready', 'unsupported', 'failed'
 */
export async function setupOffline({ canReload } = {}) {
  if (canReload) safeToReload = canReload;
  // 개발 서버에서는 쓰지 않는다. 서비스 워커는 배포물에서만 쓴다.
  if (import.meta.env.DEV) return 'dev';
  if (!('serviceWorker' in navigator)) return 'unsupported';
  try {
    // 새 판이 올라와 서비스 워커가 바뀌면 한 번 다시 읽어서 새 판을 쓴다.
    // 아이가 판을 하는 중이면 기다렸다가, 처음 화면으로 돌아왔을 때 다시 읽는다(reloadIfWaiting).
    // 처음 설치할 때는 다시 읽지 않는다(이미 최신 파일로 떠 있다).
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      if (safeToReload()) location.reload();
      else reloadWaiting = true;
    });
    const registration = await navigator.serviceWorker.register('./sw.js');
    // 새 판을 다 받아 두었으면 넘겨받으라고 알린다. 이 코드가 도는 시점에는 화면이 이미 다 떠 있어서 안전하다.
    const promote = (worker) => {
      if (worker && navigator.serviceWorker.controller) worker.postMessage({ type: 'activate-now' });
    };
    promote(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const incoming = registration.installing;
      if (!incoming) return;
      incoming.addEventListener('statechange', () => {
        if (incoming.state === 'installed') promote(incoming);
      });
    });
    return 'ready';
  } catch {
    return 'failed';
  }
}

/** 미뤄 둔 다시 읽기가 있으면 지금 한다(처음 화면으로 돌아왔을 때 부른다). */
export function reloadIfWaiting() {
  if (!reloadWaiting) return false;
  reloadWaiting = false;
  location.reload();
  return true;
}

/** 서비스 워커와 받아 둔 파일의 상태(점검 화면용) */
export async function offlineStatus() {
  const status = {
    supported: 'serviceWorker' in navigator && 'caches' in globalThis,
    online: navigator.onLine,
    registered: false,
    controlled: false,
    waiting: false,
    caches: 0,
    files: 0,
  };
  if (!status.supported) return status;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    status.registered = Boolean(registration);
    status.waiting = Boolean(registration?.waiting);
    status.controlled = Boolean(navigator.serviceWorker.controller);
    const names = (await caches.keys()).filter((name) => name.startsWith('kidpuzzle-'));
    status.caches = names.length;
    for (const name of names) status.files += (await (await caches.open(name)).keys()).length;
  } catch {
    // 알아내지 못한 것은 기본값(없음)으로 둔다.
  }
  return status;
}
