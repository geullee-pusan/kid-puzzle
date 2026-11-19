// 테스트에서 컵 뒤집기와 세 색 무리의 풀이 프로그램과 견줄 때 쓰는 다른 방법.
// 풀이 프로그램(src/core/cups.js)은 컵 판을 어느 컵이 엎어졌는지(비트)로, 방울이 판을 색마다의 마릿수로 따진다.
// 여기서는 거꾸로 한다. 컵 판은 엎어진 컵의 수 하나로 따지고(어느 컵이든 고를 수 있으니 수만 알면 된다),
// 방울이 판은 방울이 하나하나의 색(3진법 수 하나)으로 따져 아무 두 마리나 만나게 해 본다. 판의 규칙도 처음부터 다시 적는다.

/**
 * 컵 판을 따로 풀어 본다: 엎어진 컵이 u개일 때 k개를 뒤집으면, 그 가운데 엎어진 컵이 j개면 u + k − 2j개가 된다.
 * @returns {{possible: boolean, min: number|null, reachable: number}} reachable은 갈 수 있는 "엎어진 컵 수"의 가짓수
 */
export function bruteCups(board) {
  const { n, k } = board;
  const start = board.cups.filter((cup) => cup === 1).length;
  const dist = new Map([[start, 0]]);
  let layer = [start];
  while (layer.length > 0) {
    const next = [];
    for (const down of layer) {
      for (let j = 0; j <= k; j++) {
        // 엎어진 컵 j개와 바로 선 컵 k − j개를 고를 수 있어야 한다.
        if (j > down || k - j > n - down) continue;
        const after = down - j + (k - j);
        if (dist.has(after)) continue;
        dist.set(after, dist.get(down) + 1);
        next.push(after);
      }
    }
    layer = next;
  }
  return { possible: dist.has(0), min: dist.has(0) ? dist.get(0) : null, reachable: dist.size };
}

/**
 * 방울이 판을 따로 풀어 본다: 방울이마다의 색을 3진법 수 하나로 적고, 색이 다른 아무 두 마리를 만나게 해 본다.
 * @returns {{possible: boolean, min: number|null, reachable: number}} reachable은 갈 수 있는 "방울이마다의 색"의 가짓수
 */
export function bruteColors(board) {
  const colors = board.counts.flatMap((count, color) => Array(count).fill(color));
  const n = colors.length;
  const pow = Array.from({ length: n }, (_, index) => 3 ** index);
  const encode = (list) => list.reduce((sum, color, index) => sum + color * pow[index], 0);
  const decode = (code) => Array.from({ length: n }, (_, index) => Math.floor(code / pow[index]) % 3);
  const oneColor = (list) => list.every((color) => color === list[0]);
  const start = encode(colors);
  const dist = new Map([[start, 0]]);
  let found = oneColor(colors) ? 0 : null;
  let layer = [start];
  while (layer.length > 0) {
    const next = [];
    for (const code of layer) {
      const list = decode(code);
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          if (list[a] === list[b]) continue;
          const after = list.slice();
          // 빨강(0), 파랑(1), 노랑(2) 가운데 두 색이 아닌 나머지 색
          const third = [0, 1, 2].find((color) => color !== list[a] && color !== list[b]);
          after[a] = third;
          after[b] = third;
          const key = encode(after);
          if (dist.has(key)) continue;
          dist.set(key, dist.get(code) + 1);
          if (found === null && oneColor(after)) found = dist.get(key);
          next.push(key);
        }
      }
    }
    layer = next;
  }
  return { possible: found !== null, min: found, reachable: dist.size };
}

/** 판의 종류에 맞는 다른 방법 */
export const bruteOf = (board) => (board.kind === 'cups' ? bruteCups(board) : board.kind === 'merge' ? bruteMerge(board) : bruteColors(board));

/**
 * 셋이 하나로 판을 따로 풀어 본다: 방울이 하나하나의 색을 늘어놓은 줄로 적고, 색이 다른 아무 두 마리를 합쳐 본다
 * (두 마리를 빼고 나머지 색 하나를 줄 끝에 더한다. 풀이 프로그램과 달리 줄의 차례를 그대로 따진다).
 * @returns {{possible: boolean, min: number|null, ends: number[]}} ends는 더 만날 수 없을 때 남을 수 있는 색들(작은 것부터)
 */
export function bruteMerge(board) {
  const start = board.counts.flatMap((count, color) => Array(count).fill(color));
  const dist = new Map([[start.join(''), 0]]);
  const ends = new Set();
  let found = null;
  let layer = [start];
  while (layer.length > 0) {
    const next = [];
    for (const list of layer) {
      const here = dist.get(list.join(''));
      if (new Set(list).size <= 1) {
        ends.add(list[0]);
        if (list[0] === board.target && found === null) found = here;
        continue;
      }
      for (let a = 0; a < list.length; a++) {
        for (let b = a + 1; b < list.length; b++) {
          if (list[a] === list[b]) continue;
          const third = [0, 1, 2].find((color) => color !== list[a] && color !== list[b]);
          const after = [...list.filter((_, at) => at !== a && at !== b), third];
          const name = after.join('');
          if (dist.has(name)) continue;
          dist.set(name, here + 1);
          next.push(after);
        }
      }
    }
    layer = next;
  }
  return { possible: found !== null, min: found, ends: [...ends].sort((x, y) => x - y) };
}
