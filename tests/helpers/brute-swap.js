// 테스트에서 자리 바꾸기의 풀이 프로그램과 견줄 때 쓰는 다른 방법.
// 풀이 프로그램은 글자열을 너비 우선으로 따진다. 여기서는 수의 배열을 깊이 우선으로 따라가며 모든 길을 가 본다.

/**
 * 개구리 판을 따로 풀어 본다. 1은 오른쪽으로 가는 말, -1은 왼쪽으로 가는 말, 0은 빈칸이다.
 * @param {boolean} jumpAny true면 같은 무리의 말도 뛰어넘는다
 * @returns {{shortest: number|null, longest: number|null, ways: number, rate: number, stuck: number}}
 *   shortest, longest  끝까지 간 길 가운데 가장 짧은 것과 가장 긴 것의 움직인 횟수
 *   ways               끝까지 간 길의 수
 *   rate               아무렇게나 움직였을 때 끝까지 가는 비율
 *   stuck              막힌 모습의 수
 */
export function bruteFrogs(left, right, jumpAny = false) {
  const start = [...Array(left).fill(1), 0, ...Array(right).fill(-1)];
  const goal = [...Array(right).fill(-1), 0, ...Array(left).fill(1)].join(',');
  const memo = new Map();
  const stuck = new Set();
  const visit = (cells) => {
    const key = cells.join(',');
    if (memo.has(key)) return memo.get(key);
    let result;
    if (key === goal) result = { shortest: 0, longest: 0, ways: 1, rate: 1 };
    else {
      const nexts = [];
      cells.forEach((piece, at) => {
        if (piece === 0) return;
        const one = at + piece;
        const two = at + 2 * piece;
        let to = -1;
        if (cells[one] === 0) to = one;
        else if (cells[one] !== undefined && cells[two] === 0 && (jumpAny || cells[one] !== piece)) to = two;
        if (to < 0) return;
        const next = cells.slice();
        next[to] = piece;
        next[at] = 0;
        nexts.push(next);
      });
      result = { shortest: null, longest: null, ways: 0, rate: 0 };
      if (nexts.length === 0) stuck.add(key);
      for (const next of nexts) {
        const rest = visit(next);
        result.ways += rest.ways;
        result.rate += rest.rate / nexts.length;
        if (rest.shortest !== null) {
          result.shortest = result.shortest === null ? rest.shortest + 1 : Math.min(result.shortest, rest.shortest + 1);
          result.longest = result.longest === null ? rest.longest + 1 : Math.max(result.longest, rest.longest + 1);
        }
      }
    }
    memo.set(key, result);
    return result;
  };
  return { ...visit(start), stuck: stuck.size };
}

/**
 * 짝 짓기 판을 따로 풀어 본다. 돌 더미의 목록(자리와 개수)으로 적고, 돌이 떠난 자리는 목록에서 뺀다.
 * @returns {{possible: boolean, rate: number}}
 */
export function brutePairs(n, skip) {
  const memo = new Map();
  const visit = (piles) => {
    const key = piles.map((pile) => `${pile.at}:${pile.size}`).join(' ');
    if (memo.has(key)) return memo.get(key);
    let result;
    if (piles.every((pile) => pile.size === 2)) result = { possible: true, rate: 1 };
    else {
      const nexts = [];
      piles.forEach((pile, index) => {
        if (pile.size !== 1) return;
        for (const dir of [-1, 1]) {
          // 그 쪽으로 늘어선 더미들을 차례로 세어, 꼭 skip개를 지난 바로 다음 더미를 찾는다.
          const line = dir > 0 ? piles.slice(index + 1) : piles.slice(0, index).reverse();
          let passed = 0;
          let target = null;
          for (const other of line) {
            if (passed === skip) {
              target = other;
              break;
            }
            passed += other.size;
            if (passed > skip) break;
          }
          if (!target || target.size !== 1) continue;
          nexts.push(piles.filter((item) => item !== pile).map((item) => (item === target ? { at: item.at, size: 2 } : item)));
        }
      });
      result = { possible: false, rate: 0 };
      for (const next of nexts) {
        const rest = visit(next);
        if (rest.possible) result.possible = true;
        result.rate += rest.rate / nexts.length;
      }
    }
    memo.set(key, result);
    return result;
  };
  return visit(Array.from({ length: n }, (_, at) => ({ at, size: 1 })));
}

/**
 * 셋씩 쌓기(또는 group개씩 쌓기)를 따로 풀어 본다. 짝 짓기와 같이 더미의 목록으로 적고, 혼자 있는 돌만 움직인다.
 * 꼭 skip개를 지난 바로 다음 더미가 group개보다 적으면 얹는다.
 * @returns {{possible: boolean}}
 */
export function brutePiles(n, skip, group) {
  const memo = new Map();
  const visit = (piles) => {
    const key = piles.map((pile) => `${pile.at}:${pile.size}`).join(' ');
    if (memo.has(key)) return memo.get(key);
    let possible = piles.every((pile) => pile.size === group);
    if (!possible) {
      piles.forEach((pile, index) => {
        if (possible || pile.size !== 1) return;
        for (const dir of [-1, 1]) {
          const line = dir > 0 ? piles.slice(index + 1) : piles.slice(0, index).reverse();
          let passed = 0;
          let target = null;
          for (const other of line) {
            if (passed === skip) {
              target = other;
              break;
            }
            passed += other.size;
            if (passed > skip) break;
          }
          if (!target || target.size >= group) continue;
          const next = piles.filter((item) => item !== pile).map((item) => (item === target ? { at: item.at, size: item.size + 1 } : item));
          if (visit(next).possible) possible = true;
        }
      });
    }
    const result = { possible };
    memo.set(key, result);
    return result;
  };
  return visit(Array.from({ length: n }, (_, at) => ({ at, size: 1 })));
}

/**
 * 둘씩 묶어 옮기기를 따로 풀어 본다. 칸을 수의 배열(1 검은 돌, 2 흰 돌, 0 빈칸)로 적고,
 * 이웃한 돌 둘을 이웃한 빈칸 둘 어디로든(빈칸이 한 곳에 몰려 있다고 미리 보지 않는다) 옮겨 본다.
 * 끝: 돌이 모두 붙어 있고 색이 한 번만 바뀐다.
 * @returns {{possible: boolean, min: number|null, states: number}}
 */
export function bruteCarry(n) {
  const start = [...Array.from({ length: n }, (_, at) => (at % 2 === 0 ? 1 : 2)), 0, 0];
  const done = (cells) => {
    const stones = cells.filter((cell) => cell !== 0);
    const first = cells.findIndex((cell) => cell !== 0);
    const last = cells.length - 1 - [...cells].reverse().findIndex((cell) => cell !== 0);
    if (last - first + 1 !== stones.length) return false;
    let changes = 0;
    for (let at = 1; at < stones.length; at++) if (stones[at] !== stones[at - 1]) changes += 1;
    return changes === 1;
  };
  const key = (cells) => cells.join('');
  const dist = new Map([[key(start), 0]]);
  let layer = [start];
  let found = done(start) ? 0 : null;
  while (found === null && layer.length > 0) {
    const next = [];
    for (const cells of layer) {
      for (let a = 0; a + 1 < cells.length; a++) {
        if (cells[a] === 0 || cells[a + 1] === 0) continue;
        for (let b = 0; b + 1 < cells.length; b++) {
          if (cells[b] !== 0 || cells[b + 1] !== 0) continue;
          const after = cells.slice();
          after[b] = cells[a];
          after[b + 1] = cells[a + 1];
          after[a] = 0;
          after[a + 1] = 0;
          const name = key(after);
          if (dist.has(name)) continue;
          dist.set(name, dist.get(key(cells)) + 1);
          if (found === null && done(after)) found = dist.get(name);
          next.push(after);
        }
      }
    }
    layer = next;
  }
  if (found === null) return { possible: false, min: null, states: dist.size };
  return { possible: true, min: found, states: dist.size };
}
