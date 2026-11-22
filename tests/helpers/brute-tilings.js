// 도미노 깔기 모두 찾기를 풀이 프로그램과 다른 방법으로 다시 따진다(테스트 전용).
// 1. 칸 묶음을 비트로 들고, 아직 덮지 않은 칸 가운데 번호가 가장 작은 칸(위 줄부터, 왼쪽부터)을 오른쪽이나 아래 칸과 묶어 보는 셈.
//    풀이 프로그램은 왼쪽 열부터 훑고 열마다 삐져나온 칸만 들고 가므로, 훑는 차례와 들고 가는 것이 다르다.
// 2. 도미노를 놓을 수 있는 자리(붙어 있는 두 칸)를 모두 늘어놓고, 그 가운데 칸 수의 절반만큼을 고르는 모든 묶음을 따지는 셈(작은 판만).
// 3. 계단: 길이마다 한 칸·두 칸 걸음의 모든 줄을 이진수처럼 세어 늘어놓고 합이 맞는 것만 남긴다.

/** 판의 덮을 칸들(위 줄부터, 왼쪽부터 번호. 칸 번호는 y * w + x) */
const openCells = (h, w, holes) => Array.from({ length: h * w }, (_, cell) => cell).filter((cell) => !holes.includes(cell));

/** 도미노 자리들: [작은 칸, 큰 칸] */
function slots(h, w, holes) {
  const open = new Set(openCells(h, w, holes));
  const list = [];
  for (const cell of open) {
    if (cell % w < w - 1 && open.has(cell + 1)) list.push([cell, cell + 1]);
    if (cell + w < h * w && open.has(cell + w)) list.push([cell, cell + w]);
  }
  return list;
}

/** 깔기를 글자로(도미노들을 차례대로 적는다. 놓은 차례와 상관없이 같은 깔기는 같은 글자다) */
export const coverText = (placed) =>
  placed
    .map((pair) => pair.slice().sort((a, b) => a - b).join('-'))
    .sort()
    .join(' ');

/** 1. 비트 묶음으로 모두 늘어놓기 */
export function bruteCoverings(h, w, holes = []) {
  const all = openCells(h, w, holes).reduce((mask, cell) => mask | (2 ** cell), 0);
  const found = [];
  const go = (left, now) => {
    if (left === 0) {
      found.push(coverText(now));
      return;
    }
    let cell = 0;
    while (Math.floor(left / 2 ** cell) % 2 === 0) cell += 1;
    const has = (other) => Math.floor(left / 2 ** other) % 2 === 1;
    if (cell % w < w - 1 && has(cell + 1)) go(left - 2 ** cell - 2 ** (cell + 1), [...now, [cell, cell + 1]]);
    if (cell + w < h * w && has(cell + w)) go(left - 2 ** cell - 2 ** (cell + w), [...now, [cell, cell + w]]);
  };
  go(all, []);
  return found;
}

/** 2. 도미노 자리를 칸 수의 절반만큼 고르는 모든 묶음에서 겹치지 않는 것을 센다(작은 판만) */
export function bruteChoose(h, w, holes = []) {
  const cells = openCells(h, w, holes);
  if (cells.length % 2 === 1) return 0;
  const need = cells.length / 2;
  const list = slots(h, w, holes);
  let total = 0;
  const go = (from, used, picked) => {
    if (picked === need) {
      total += 1;
      return;
    }
    if (list.length - from < need - picked) return;
    for (let at = from; at < list.length; at++) {
      const [a, b] = list[at];
      if (used.has(a) || used.has(b)) continue;
      used.add(a);
      used.add(b);
      go(at + 1, used, picked + 1);
      used.delete(a);
      used.delete(b);
    }
  };
  go(0, new Set(), 0);
  return total;
}

/** 3. 계단 n칸을 한 칸·두 칸씩 오르는 모든 걸음의 줄 */
export function bruteClimbs(n) {
  const found = [];
  for (let length = 1; length <= n; length++) {
    for (let bits = 0; bits < 2 ** length; bits++) {
      const hops = Array.from({ length }, (_, index) => (Math.floor(bits / 2 ** index) % 2) + 1);
      if (hops.reduce((sum, hop) => sum + hop, 0) === n) found.push(hops.join(''));
    }
  }
  return found;
}
