// 팬케이크 뒤집기의 풀이를 다른 방법으로 다시 구한다(테스트 전용).
// 풀이 프로그램(src/core/pancake.js)은 다 된 모습에서 거꾸로 너비 우선 탐색을 한 번 하여 표를 만든다.
// 여기서는 그 표를 쓰지 않고, 처음 더미에서 앞으로 뒤집어 가며 깊이를 하나씩 늘리는 깊이 우선 탐색(반복 깊이 늘리기)으로 가장 적은 횟수를 구한다.
// 같은 자리를 잇달아 두 번 뒤집으면 제자리라서 가장 짧은 방법에는 그런 것이 없다. 그것만 가지친다.
// 뒤집기도 여기서 따로 만든다(배열 하나를 제자리에서 뒤집고 되돌린다).

/** 위의 k장을 제자리에서 뒤집는다(탄 면은 위아래도 바꾼다). 두 번 하면 제자리다 */
function flipInPlace(stack, up, k) {
  for (let i = 0, j = k - 1; i < j; i++, j--) {
    [stack[i], stack[j]] = [stack[j], stack[i]];
    if (up) [up[i], up[j]] = [up[j], up[i]];
  }
  if (up) for (let i = 0; i < k; i++) up[i] = 1 - up[i];
}

function goal(stack, up) {
  for (let i = 0; i < stack.length; i++) {
    if (stack[i] !== i + 1) return false;
    if (up && up[i] !== 0) return false;
  }
  return true;
}

/**
 * 가장 적은 뒤집기 횟수와 그 방법 하나.
 * @param {number[]} start 위에서부터의 크기
 * @param {number[]|null} startUp 탄 면(1이 위), 없으면 null
 * @param {number} limit 이 깊이까지만 찾는다
 * @returns {{fewest: number, path: number[]} | null}
 */
export function bruteFewest(start, startUp = null, limit = 20) {
  const stack = start.slice();
  const up = startUp ? startUp.slice() : null;
  const n = stack.length;
  const low = up ? 1 : 2;
  const path = [];
  function search(depth, last) {
    if (goal(stack, up)) return true;
    if (depth === 0) return false;
    for (let k = low; k <= n; k++) {
      if (k === last) continue;
      flipInPlace(stack, up, k);
      path.push(k);
      if (search(depth - 1, k)) return true;
      path.pop();
      flipInPlace(stack, up, k);
    }
    return false;
  }
  for (let depth = 0; depth <= limit; depth++) {
    if (search(depth, 0)) return { fewest: depth, path: path.slice() };
  }
  return null;
}

/** 1부터 n까지의 순열 모두 */
export function permutations(n) {
  if (n === 0) return [[]];
  const out = [];
  for (const rest of permutations(n - 1)) {
    for (let at = 0; at <= rest.length; at++) out.push([...rest.slice(0, at), n, ...rest.slice(at)]);
  }
  return out;
}

/** 탄 면의 위아래 모두(길이 n) */
export function sides(n) {
  return Array.from({ length: 2 ** n }, (_, mask) => Array.from({ length: n }, (_, index) => (mask >> (n - 1 - index)) & 1));
}

/**
 * 큰 것부터 보내기를 따로 만든 것: 아직 제자리가 아닌 가장 큰 것을 맨 위로 올렸다가(이미 맨 위면 그대로) 제자리까지 통째로 뒤집는다.
 * @returns {number[]} 뒤집기 k의 차례
 */
export function bruteBiggestFirst(start) {
  const stack = start.slice();
  const flips = [];
  for (let size = stack.length; size >= 2; size--) {
    if (stack[size - 1] === size) continue;
    const at = stack.indexOf(size);
    if (at !== 0) {
      flips.push(at + 1);
      flipInPlace(stack, null, at + 1);
    }
    flips.push(size);
    flipInPlace(stack, null, size);
  }
  return flips;
}

/** 뒤집기를 차례대로 해 본 더미(새 값) */
export function bruteReplay(start, startUp, flips) {
  const stack = start.slice();
  const up = startUp ? startUp.slice() : null;
  for (const k of flips) flipInPlace(stack, up, k);
  return { stack, up };
}

export const bruteDone = (stack, up = null) => goal(stack, up);
