// 세 방향에서 본 그림을 다른 방법으로 다시 따진다(테스트 전용).
// 풀이 프로그램(src/core/views.js)은 앞뒤 줄을 하나씩 정해 가며 센다. 여기서는 그것을 쓰지 않고
//   1) 작은 판은 쌓을 수 있는 모든 쌓기를 하나하나 만들어 그림마다 묶고,
//   2) 큰 판은 "어느 줄도 그림의 높이에 닿지 못한 쌓기"를 빼고 더하는 셈(포함과 배제)으로 센다.
// 가장 적은 수는 높이마다 "그 높이인 앞의 줄 수와 옆의 줄 수 가운데 큰 쪽"을 더하는 셈으로도 구한다.

const range = (n) => Array.from({ length: n }, (_, index) => index);

/** 앞에서 본 높이, 옆에서 본 높이, 위에서 본 그림(풀이 프로그램과 따로 쓴다) */
export function look(w, d, heights) {
  const front = [];
  const side = [];
  for (let x = 0; x < w; x++) {
    let top = 0;
    for (let y = 0; y < d; y++) top = Math.max(top, heights[y * w + x]);
    front.push(top);
  }
  for (let y = 0; y < d; y++) {
    let top = 0;
    for (let x = 0; x < w; x++) top = Math.max(top, heights[y * w + x]);
    side.push(top);
  }
  return { front, side, plan: heights.map((value) => (value ? 1 : 0)) };
}

/**
 * 가로 w, 앞뒤 d, 한 칸에 high까지 쌓는 모든 쌓기를 만들어 그림마다 묶는다.
 * @returns {{pairs: Map<string, {count, fewest, most}>, triples: Map<string, number>}}
 *   pairs의 열쇠는 '앞|옆', triples의 열쇠는 '앞|옆|위'
 */
export function tally(w, d, high) {
  const pairs = new Map();
  const triples = new Map();
  const cells = w * d;
  const heights = new Array(cells).fill(0);
  const total = (high + 1) ** cells;
  for (let code = 0; code < total; code++) {
    let rest = code;
    let cubes = 0;
    for (let at = 0; at < cells; at++) {
      heights[at] = rest % (high + 1);
      rest = Math.floor(rest / (high + 1));
      cubes += heights[at];
    }
    const { front, side, plan } = look(w, d, heights);
    const key = `${front.join('')}|${side.join('')}`;
    const item = pairs.get(key);
    if (!item) pairs.set(key, { count: 1, fewest: cubes, most: cubes });
    else {
      item.count += 1;
      item.fewest = Math.min(item.fewest, cubes);
      item.most = Math.max(item.most, cubes);
    }
    const triple = `${key}|${plan.join('')}`;
    triples.set(triple, (triples.get(triple) ?? 0) + 1);
  }
  return { pairs, triples };
}

/**
 * 포함과 배제로 센다: 칸마다 쌓을 수 있는 높이의 범위를 두고, 앞(옆)의 어느 줄들이 그 높이에 "닿지 못한다"고 정해 빼고 더한다.
 * plan이 있으면 그 그림의 칸은 1 이상, 빈칸은 0이다. 한 칸은 high를 넘지 않는다.
 */
export function countByExclusion(w, d, front, side, plan = null, high = 4) {
  const cols = range(w).filter((x) => front[x] > 0);
  const rows = range(d).filter((y) => side[y] > 0);
  let sum = 0;
  for (let colMask = 0; colMask < 1 << cols.length; colMask++) {
    for (let rowMask = 0; rowMask < 1 << rows.length; rowMask++) {
      const missCol = new Set(cols.filter((_, at) => colMask & (1 << at)));
      const missRow = new Set(rows.filter((_, at) => rowMask & (1 << at)));
      let product = 1;
      for (let y = 0; y < d && product > 0; y++) {
        for (let x = 0; x < w && product > 0; x++) {
          let hi = Math.min(front[x], side[y], high);
          if (missCol.has(x)) hi = Math.min(hi, front[x] - 1);
          if (missRow.has(y)) hi = Math.min(hi, side[y] - 1);
          let lo = 0;
          if (plan) {
            if (plan[y * w + x]) lo = 1;
            else hi = Math.min(hi, 0);
          }
          product *= Math.max(0, hi - lo + 1);
        }
      }
      sum += (missCol.size + missRow.size) % 2 === 0 ? product : -product;
    }
  }
  return sum;
}

/** 가장 적은 수: 높이 v마다 (앞에서 v인 줄의 수, 옆에서 v인 줄의 수) 가운데 큰 쪽 × v를 더한다 */
export function fewestByLevels(front, side) {
  let total = 0;
  for (let v = 1; v <= Math.max(0, ...front, ...side); v++) {
    total += v * Math.max(front.filter((value) => value === v).length, side.filter((value) => value === v).length);
  }
  return total;
}

/** 가장 많은 수: 칸마다 두 줄 높이 가운데 낮은 쪽을 더한다 */
export function mostByCells(front, side) {
  let total = 0;
  for (const a of front) for (const b of side) total += Math.min(a, b);
  return total;
}

/** 0과 1로 된 위의 그림을 모두 만든다 */
export function allPlans(cells) {
  return range(2 ** cells).map((code) => range(cells).map((at) => (code >> at) & 1));
}
