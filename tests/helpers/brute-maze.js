// 주사위 미로의 길의 수를 다른 방법으로 다시 구해 견주는 데 쓴다.
// 규칙을 여기에 따로 적었다(src/core/maze.js의 함수를 쓰지 않는다).
// 맨 위에서 r걸음 내려가는 모든 길(왼쪽 0, 오른쪽 1인 r자리 이진수 2^r개)을 하나씩 걸어 보고, 막힌 칸을 밟지 않은 길만 끝 칸에 센다.
// "위 두 칸의 합"도, 칸 번호를 차례로 채우는 것도 쓰지 않는다. 느리지만 틀릴 곳이 적다.

/** 칸의 이름: "줄,왼쪽에서의 자리" */
const key = (r, i) => `${r},${i}`;

/**
 * 칸마다 맨 위에서 오는 길의 수.
 * @param {number} rows 갈림길의 줄 수(맨 아래 rows줄이 출구)
 * @param {Array<[number, number]>} stones 막힌 칸들 [줄, 자리]
 * @returns {Map<string, number>} 칸의 이름 → 길의 수(막힌 칸은 0)
 */
export function bruteCounts(rows, stones) {
  const blocked = new Set(stones.map(([r, i]) => key(r, i)));
  const counts = new Map();
  for (let r = 0; r <= rows; r++) for (let i = 0; i <= r; i++) counts.set(key(r, i), 0);
  for (let r = 0; r <= rows; r++) {
    for (let mask = 0; mask < 2 ** r; mask++) {
      let i = 0;
      let ok = !blocked.has(key(0, 0));
      for (let step = 0; step < r && ok; step++) {
        if ((mask >> (r - 1 - step)) & 1) i += 1;
        if (blocked.has(key(step + 1, i))) ok = false;
      }
      if (ok) counts.set(key(r, i), counts.get(key(r, i)) + 1);
    }
  }
  return counts;
}

/** 맨 위에서 (r, i) 칸까지 가는 모든 길. 'L'과 'R'의 글자 줄로 */
export function brutePaths(rows, stones, r, i) {
  const blocked = new Set(stones.map(([sr, si]) => key(sr, si)));
  const found = [];
  for (let mask = 0; mask < 2 ** r; mask++) {
    let at = 0;
    let ok = true;
    let path = '';
    for (let step = 0; step < r; step++) {
      const right = (mask >> (r - 1 - step)) & 1;
      path += right ? 'R' : 'L';
      at += right;
      if (blocked.has(key(step + 1, at))) ok = false;
    }
    if (ok && at === i) found.push(path);
  }
  return found;
}

/** n개에서 k개를 고르는 수(파스칼 세모의 수). 곱하고 나누어 구한다 */
export function choose(n, k) {
  let value = 1;
  for (let j = 1; j <= k; j++) value = (value * (n - k + j)) / j;
  return value;
}

/** 루카스의 정리: n개에서 k개를 고르는 수가 홀수인 것은 k와 n−k를 이진수로 적었을 때 겹치는 자리가 없을 때다 */
export const chooseIsOdd = (n, k) => (k & (n - k)) === 0;
