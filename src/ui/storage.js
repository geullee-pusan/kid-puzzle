// 기기 저장소. localStorage를 쓰는 곳은 이 파일 하나뿐이다. 늘 try/catch로 감싼다.
// 저장소가 막혀 있거나, 저장된 값이 없거나 깨져 있어도 화면은 떠야 한다. 그럴 때는 기본값을 돌려준다.

const PREFIX = 'kidpuzzle.';

/** 저장된 값을 읽는다. 없거나 깨졌으면 fallback을 돌려준다. */
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    const value = JSON.parse(raw);
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
}

/** 값을 저장한다. 저장했으면 true. 못 해도 오류를 내지 않는다. */
export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
    return true;
  } catch {
    return false;
  }
}

/** 저장소를 쓸 수 있는가(점검 화면용) */
export function available() {
  try {
    const probe = `${PREFIX}probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
