// 질문으로 맞히기를 풀이 프로그램과 다른 방법으로 따진다(테스트에서만 쓴다).
// 풀이 프로그램은 후보의 수만 따지지만, 여기서는 후보의 묶음(비트)과 그 묶음을 가르는 모든 물음을 하나하나 해 본다.

/** 묶음 안의 수의 개수 */
export function bitCount(mask) {
  let count = 0;
  for (let m = mask; m; m &= m - 1) count += 1;
  return count;
}

/** 묶음의 모든 부분 묶음(빈 것과 자기 자신도 넣는다) */
function* subsetsOf(mask) {
  let sub = mask;
  while (true) {
    yield sub;
    if (sub === 0) return;
    sub = (sub - 1) & mask;
  }
}

/**
 * 후보 1..n을 질문 k번으로 언제나 하나로 좁힐 수 있는가(아무렇게나 답하는 상대: 두 대답 모두 따진다).
 * 물음은 후보의 아무 부분 묶음이다.
 */
export function bruteWin(n, k) {
  const memo = new Map();
  const win = (alive, left) => {
    if (bitCount(alive) <= 1) return true;
    if (left === 0) return false;
    const key = alive * 8 + left;
    if (memo.has(key)) return memo.get(key);
    let ok = false;
    for (const sub of subsetsOf(alive)) {
      if (win(sub, left - 1) && win(alive & ~sub, left - 1)) {
        ok = true;
        break;
      }
    }
    memo.set(key, ok);
    return ok;
  };
  return win((1 << n) - 1, k);
}

/**
 * 많은 쪽을 남기는 상대에게 이길 수 있는가. 두 쪽이 같으면 상대가 어느 쪽을 남겨도 이겨야 한다.
 */
export function bruteVsGreedy(n, k) {
  const memo = new Map();
  const win = (alive, left) => {
    if (bitCount(alive) <= 1) return true;
    if (left === 0) return false;
    const key = alive * 8 + left;
    if (memo.has(key)) return memo.get(key);
    let ok = false;
    for (const sub of subsetsOf(alive)) {
      const rest = alive & ~sub;
      const a = bitCount(sub);
      const b = bitCount(rest);
      const kept = a > b ? [sub] : a < b ? [rest] : [sub, rest];
      if (kept.every((group) => win(group, left - 1))) {
        ok = true;
        break;
      }
    }
    memo.set(key, ok);
    return ok;
  };
  return win((1 << n) - 1, k);
}

/** 질문 q개를 미리 정해(수마다 넣을지 말지) 1..n의 대답 줄이 모두 다르게 할 수 있는가. 모든 질문 묶음을 해 본다 */
export function brutePrepare(n, q) {
  const all = 1 << n;
  const sets = Array(q).fill(0);
  const distinct = () => {
    const seen = new Set();
    for (let x = 0; x < n; x++) {
      const row = sets.map((set) => ((set >> x) & 1 ? '1' : '0')).join('');
      if (seen.has(row)) return false;
      seen.add(row);
    }
    return true;
  };
  const go = (at) => {
    if (at === q) return distinct();
    for (let set = 0; set < all; set++) {
      sets[at] = set;
      if (go(at + 1)) return true;
    }
    return false;
  };
  return go(0);
}

/** 2를 q번 곱한 수(테스트가 따로 센다) */
export function twoTimes(q) {
  let value = 1;
  for (let step = 0; step < q; step++) value *= 2;
  return value;
}
