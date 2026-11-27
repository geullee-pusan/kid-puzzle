// 조건 맞춰 잇기를 풀이 프로그램과 다른 방법으로 따진다(테스트에서만 쓴다).
//   realizable(n): 점 n개에서 그을 수 있는 선 묶음을 모두(2를 선의 가짓수만큼 곱한 수만큼) 해 보고, 나올 수 있는 점마다의 선의 수를 모두 모은다.
//     선 묶음은 한 번에 선 하나만 바뀌는 차례(그레이 부호)로 지나가서 점마다의 수를 한 번에 하나씩 고친다.
//   erdosGallai(need): 에르되시-갈라이 조건(큰 수부터 줄 세워 앞의 k개의 합이 k(k-1)과 뒤의 점들이 받아 줄 수 있는 수의 합을 넘지 않는다)과 합이 짝수인지.

const memo = new Map();

/** 점 n개로 나올 수 있는 점마다의 선의 수(글자 '3,3,2,2'의 모음) */
export function realizable(n) {
  if (memo.has(n)) return memo.get(n);
  const pairs = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push([a, b]);
  const degrees = new Array(n).fill(0);
  const found = new Set([degrees.join(',')]);
  const total = 2 ** pairs.length;
  for (let step = 1; step < total; step++) {
    // 이번에 바뀌는 선: step의 가장 낮은 1의 자리
    let bit = 0;
    while (((step >> bit) & 1) === 0) bit++;
    const on = ((step ^ (step >> 1)) >> bit) & 1;
    const [a, b] = pairs[bit];
    const change = on ? 1 : -1;
    degrees[a] += change;
    degrees[b] += change;
    found.add(degrees.join(','));
  }
  memo.set(n, found);
  return found;
}

export const bruteOk = (need) => realizable(need.length).has(need.join(','));

export function erdosGallai(need) {
  const sorted = need.slice().sort((a, b) => b - a);
  const n = sorted.length;
  if (sorted.reduce((sum, value) => sum + value, 0) % 2 === 1) return false;
  let left = 0;
  for (let k = 1; k <= n; k++) {
    left += sorted[k - 1];
    let right = k * (k - 1);
    for (let at = k; at < n; at++) right += Math.min(sorted[at], k);
    if (left > right) return false;
  }
  return true;
}

/** 큰 수부터 줄 세운 모든 수 목록(수는 0부터 top까지) */
export function sortedLists(n, top) {
  const out = [];
  const walk = (list, max) => {
    if (list.length === n) {
      out.push(list.slice());
      return;
    }
    for (let value = max; value >= 0; value--) {
      list.push(value);
      walk(list, value);
      list.pop();
    }
  };
  walk([], top);
  return out;
}

/** 차례가 있는 모든 수 목록(수는 0부터 top까지) */
export function allLists(n, top) {
  const out = [];
  const walk = (list) => {
    if (list.length === n) {
      out.push(list.slice());
      return;
    }
    for (let value = 0; value <= top; value++) {
      list.push(value);
      walk(list);
      list.pop();
    }
  };
  walk([]);
  return out;
}
