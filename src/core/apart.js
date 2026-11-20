// 닿지 않게 놓기와 구역 긋기: 판, 닿는 칸, 구슬 놓기, 구역 살피기, 풀이 프로그램. 순수 함수만 둔다.
// 화면에 손대지 않고, 무작위 수를 쓰지 않고, 지금 시각을 쓰지 않는다. 같은 입력은 늘 같은 출력을 낸다.
//
// 판(board): { w, h, holes, touch, regions }
//   w, h     가로와 세로의 칸 수(MIN_SIZE~MAX_SIZE)
//   holes    판에서 빠진 칸의 번호들(작은 것부터). 빠진 칸에는 구슬을 놓지 못하고, 구역에도 넣지 않는다
//   touch    'side'(변이 붙은 칸끼리 닿는다) | 'king'(변이나 꼭짓점이 붙은 칸끼리 닿는다)
//   regions  선생님이 미리 그어 둔 구역(구역마다 칸 번호들, 작은 것부터). 구역이 없는 판은 null
//   칸 번호는 왼쪽 위가 0이고 오른쪽으로, 그다음 아래 줄로 센다(번호 = 세로 × w + 가로).
//
// 구슬은 서로 닿지 않게 놓는다. 구역은 판의 칸 묶음이다. 구역 안의 칸이 서로 다 닿으면 그 구역에는 구슬이 하나만 들어간다.
// 판을 그런 구역 n개로 빠짐없이 나누면 구슬은 n개보다 많이 놓을 수 없다(구역이 천장이다).
//
// 풀이 프로그램 둘
//   가장 많이 놓기: 줄마다 구슬을 놓는 모습(비트)을 정하고, 위 줄과 닿지 않는 모습끼리 이어 가며 줄 단위로 센다.
//     가장 많이 놓는 수, 그렇게 놓는 방법의 수, 한 가지 방법을 낸다.
//   가장 적은 구역: 구역은 서로 다 닿는 칸 묶음이라 두 줄 안에 든다. 줄마다 "위 줄의 구역이 이미 차지한 칸"을 모습으로 삼아
//     줄 단위로 가장 적은 구역 수를 센다. 가장 적은 구역 수와 한 가지 나누기를 낸다.
//   구역 수는 늘 가장 많이 놓는 수 이상이다. 둘이 같은 판에서만 구역으로 "더 놓을 수 없다"를 보일 수 있다.

import { createRng, randInt, seedFrom } from './rng.js';

/** 판의 가로와 세로의 아래 끝과 위 끝 */
export const MIN_SIZE = 2;
export const MAX_SIZE = 8;
export const TOUCHES = ['side', 'king'];

export const xyOf = (board, cell) => [cell % board.w, Math.floor(cell / board.w)];

/** 판을 베낀다(구역도 함께) */
export function copyBoard(board) {
  return { w: board.w, h: board.h, holes: board.holes.slice(), touch: board.touch, regions: board.regions ? board.regions.map((region) => region.slice()) : null };
}

/** 그림 글자로 판을 만든다: 줄마다 '#'은 칸, '.'은 빠진 칸 */
export function boardFromRows(rows, touch = 'king') {
  const h = rows.length;
  const w = rows[0].length;
  const holes = [];
  rows.forEach((row, y) => {
    [...row].forEach((mark, x) => {
      if (mark === '.') holes.push(y * w + x);
    });
  });
  return { w, h, holes, touch, regions: null };
}

/** 판에 있는 칸들(빠진 칸을 뺀다) */
export function cellsOf(board) {
  const gone = new Set(board.holes);
  const cells = [];
  for (let cell = 0; cell < board.w * board.h; cell++) if (!gone.has(cell)) cells.push(cell);
  return cells;
}

/** 두 칸(다른 칸)이 닿는가 */
export function touches(board, a, b) {
  if (a === b) return false;
  const [ax, ay] = xyOf(board, a);
  const [bx, by] = xyOf(board, b);
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  if (board.touch === 'side') return dx + dy === 1;
  return dx <= 1 && dy <= 1;
}

/** 칸과 닿는 칸들(판에 있는 칸만) */
export function neighboursOf(board, cell) {
  const gone = new Set(board.holes);
  const [x, y] = xyOf(board, cell);
  const found = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (board.touch === 'side' && dx !== 0 && dy !== 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= board.w || ny >= board.h) continue;
      const other = ny * board.w + nx;
      if (!gone.has(other)) found.push(other);
    }
  }
  return found.sort((p, q) => p - q);
}

const sortedNumbers = (list) => list.slice().sort((a, b) => a - b);

/** 판이 규격에 맞는지 본다. 맞으면 null, 아니면 무엇이 틀렸는지 알리는 열쇠 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  for (const side of [board.w, board.h]) {
    if (!Number.isInteger(side) || side < MIN_SIZE || side > MAX_SIZE) return 'bad-size';
  }
  if (!TOUCHES.includes(board.touch)) return 'bad-touch';
  if (!Array.isArray(board.holes)) return 'bad-holes';
  const total = board.w * board.h;
  let before = -1;
  for (const hole of board.holes) {
    if (!Number.isInteger(hole) || hole <= before || hole >= total) return 'bad-holes';
    before = hole;
  }
  if (board.holes.length >= total) return 'no-cells';
  if (board.regions === null || board.regions === undefined) return board.regions === null ? null : 'bad-regions';
  if (!Array.isArray(board.regions)) return 'bad-regions';
  const state = partitionOf(board, board.regions);
  if (!state.ok || !state.complete) return 'bad-regions';
  return null;
}

/** 놓인 구슬들이 규칙에 맞는가: 판에 있는 칸, 겹치지 않고, 서로 닿지 않는다 */
export function marblesOk(board, marbles) {
  if (!Array.isArray(marbles)) return false;
  const gone = new Set(board.holes);
  const seen = new Set();
  for (const cell of marbles) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= board.w * board.h || gone.has(cell) || seen.has(cell)) return false;
    seen.add(cell);
  }
  for (let i = 0; i < marbles.length; i++) for (let j = i + 1; j < marbles.length; j++) if (touches(board, marbles[i], marbles[j])) return false;
  return true;
}

/** 칸에 구슬을 놓으면 닿는 구슬들(없으면 빈 목록) */
export function conflictsOf(board, marbles, cell) {
  return marbles.filter((other) => touches(board, cell, other));
}

/** 구슬을 더 놓을 수 있는 칸들: 판에 있고, 비었고, 놓인 구슬과 닿지 않는 칸 */
export function freeCells(board, marbles) {
  const taken = new Set(marbles);
  const near = new Set(marbles.flatMap((cell) => neighboursOf(board, cell)));
  return cellsOf(board).filter((cell) => !taken.has(cell) && !near.has(cell));
}

/** 놓인 구슬과 닿는 빈칸들(도구 "닿는 칸 보기"가 그리는 칸) */
export function touchedCells(board, marbles) {
  const taken = new Set(marbles);
  return sortedNumbers([...new Set(marbles.flatMap((cell) => neighboursOf(board, cell)))].filter((cell) => !taken.has(cell)));
}

/**
 * 구역 하나를 살핀다: 칸이 서로 다 닿으면 null, 아니면 서로 닿지 않는 두 칸(구슬 둘이 들어가는 자리).
 * 두 칸은 번호가 작은 쪽부터 찾은 첫 짝이다.
 */
export function twoIn(board, cells) {
  const list = sortedNumbers(cells);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (!touches(board, list[i], list[j])) return [list[i], list[j]];
  return null;
}

/**
 * 구역들을 살핀다.
 * @returns {{ok: boolean, complete: boolean, bad: number[], pairs: (number[]|null)[], missing: number[]}}
 *   ok        구역들이 판에 있는 칸만 쓰고 서로 겹치지 않는가(아니면 아래 값은 쓰지 않는다)
 *   bad       구슬이 둘 들어가는 구역의 차례들
 *   pairs     구역마다 서로 닿지 않는 두 칸(없으면 null)
 *   missing   아직 어느 구역에도 들지 않은 칸
 *   complete  모든 칸이 구역에 들었고, 모든 구역이 구슬 하나만 들어가는 구역인가
 */
export function partitionOf(board, regions) {
  const gone = new Set(board.holes);
  const owner = new Map();
  let ok = Array.isArray(regions);
  for (const [index, region] of (ok ? regions : []).entries()) {
    if (!Array.isArray(region) || region.length === 0) {
      ok = false;
      break;
    }
    for (const cell of region) {
      if (!Number.isInteger(cell) || cell < 0 || cell >= board.w * board.h || gone.has(cell) || owner.has(cell)) ok = false;
      else owner.set(cell, index);
    }
  }
  if (!ok) return { ok: false, complete: false, bad: [], pairs: [], missing: [] };
  const pairs = regions.map((region) => twoIn(board, region));
  const bad = pairs.map((pair, index) => (pair ? index : -1)).filter((index) => index >= 0);
  const missing = cellsOf(board).filter((cell) => !owner.has(cell));
  return { ok: true, complete: missing.length === 0 && bad.length === 0, bad, pairs, missing };
}

/** 줄마다 쓸 수 있는 칸의 비트(빠진 칸이 0) */
function rowOpen(board) {
  const gone = new Set(board.holes);
  return Array.from({ length: board.h }, (_, y) => {
    let bits = 0;
    for (let x = 0; x < board.w; x++) if (!gone.has(y * board.w + x)) bits |= 1 << x;
    return bits;
  });
}

/** 한 줄 안에서 구슬을 놓는 모습들: 쓸 수 있는 칸에만, 가로로 붙지 않게 */
function rowChoices(w, open) {
  const found = [];
  for (let mask = 0; mask < 1 << w; mask++) if ((mask & ~open) === 0 && (mask & (mask << 1)) === 0) found.push(mask);
  return found;
}

/** 위 줄과 아래 줄의 모습이 닿지 않는가 */
function rowsApart(touch, upper, lower) {
  if (touch === 'side') return (upper & lower) === 0;
  return (upper & (lower | (lower << 1) | (lower >> 1))) === 0;
}

const bitCount = (mask) => {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n += 1;
  return n;
};

/**
 * 가장 많이 놓기: 줄 단위로 센다.
 * @returns {{best: number, ways: number, example: number[]}}
 *   best     서로 닿지 않게 놓을 수 있는 구슬의 가장 많은 수
 *   ways     그만큼 놓는 방법의 수
 *   example  한 가지 방법(칸 번호, 작은 것부터). 같은 판은 늘 같은 방법이다
 */
export function solveMost(board) {
  const open = rowOpen(board);
  const choices = open.map((bits) => rowChoices(board.w, bits));
  // 맨 아래 줄부터: best[y][모습] = 그 줄을 그 모습으로 놓았을 때 그 줄부터 아래까지 가장 많은 수와 방법의 수
  let below = new Map();
  const steps = [];
  for (let y = board.h - 1; y >= 0; y--) {
    const here = new Map();
    for (const mask of choices[y]) {
      let most = -1;
      let ways = 0;
      let pick = null;
      if (y === board.h - 1) {
        most = 0;
        ways = 1;
      } else {
        for (const next of choices[y + 1]) {
          if (!rowsApart(board.touch, mask, next)) continue;
          const item = below.get(next);
          if (item.most > most) {
            most = item.most;
            ways = item.ways;
            pick = next;
          } else if (item.most === most) ways += item.ways;
        }
      }
      here.set(mask, { most: most + bitCount(mask), ways, pick });
    }
    steps[y] = here;
    below = here;
  }
  let best = -1;
  let ways = 0;
  let start = null;
  for (const mask of choices[0]) {
    const item = steps[0].get(mask);
    if (item.most > best) {
      best = item.most;
      ways = item.ways;
      start = mask;
    } else if (item.most === best) ways += item.ways;
  }
  const example = [];
  let mask = start;
  for (let y = 0; y < board.h; y++) {
    for (let x = 0; x < board.w; x++) if (mask & (1 << x)) example.push(y * board.w + x);
    mask = steps[y].get(mask).pick;
  }
  return { best, ways, example };
}

/**
 * 구역의 모양: 구역에서 번호가 가장 작은 칸에서 본 나머지 칸의 자리 [가로, 세로].
 * 서로 다 닿는 칸 묶음은 2×2 네모 안에 든다(꼭짓점까지 닿을 때). 변만 닿을 때는 한 칸이나 나란한 두 칸이다.
 * 큰 구역부터 적었다. 구역 수가 같은 나누기가 여럿이면 큰 구역을 먼저 고른 것을 낸다(선생님이 그어 보이는 구역이 반듯하다).
 */
const SHAPES = {
  side: [[[1, 0]], [[0, 1]], []],
  king: [[[1, 0], [0, 1], [1, 1]], [[1, 0], [0, 1]], [[1, 0], [1, 1]], [[0, 1], [1, 1]], [[-1, 1], [0, 1]], [[1, 0]], [[0, 1]], [[1, 1]], [[-1, 1]], []],
};

/**
 * 가장 적은 구역: 판을 서로 다 닿는 칸 묶음으로 빠짐없이 나눌 때 가장 적은 구역의 수.
 * 칸을 번호 차례로 본다. 모습은 "지금 칸부터 w + 2칸 가운데 이미 구역에 든 칸"의 비트다.
 * 지금 칸이 아직 구역에 들지 않았으면, 그 칸이 가장 작은 칸인 구역 하나를 고른다(나머지 칸은 오른쪽, 아래 줄의 왼쪽·가운데·오른쪽 가운데에 있다).
 * @returns {{cover: number, regions: number[][]}} 가장 적은 구역의 수와 한 가지 나누기(구역마다 작은 칸부터, 구역은 첫 칸 차례로)
 */
export function solveCover(board) {
  const { w, h } = board;
  const total = w * h;
  const gone = new Set(board.holes);
  const shapes = SHAPES[board.touch];
  // 칸마다 고를 수 있는 구역: 지금 칸에서 떨어진 거리(번호의 차)들
  const options = Array.from({ length: total }, (_, cell) => {
    const [x, y] = xyOf(board, cell);
    const list = [];
    for (const shape of shapes) {
      const steps = [];
      let fits = true;
      for (const [dx, dy] of shape) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= w || ny >= h || gone.has(ny * w + nx)) {
          fits = false;
          break;
        }
        steps.push(dy * w + dx);
      }
      if (fits) list.push(steps);
    }
    return list;
  });
  const memo = Array.from({ length: total + 1 }, () => new Map());
  // least(cell, filled): 칸 cell부터 끝까지 덮는 가장 적은 구역 수와 고른 것
  const least = (cell, filled) => {
    if (cell === total) return { used: 0, steps: null };
    const known = memo[cell].get(filled);
    if (known) return known;
    let best;
    if (gone.has(cell) || filled & 1) {
      best = { used: least(cell + 1, filled >> 1).used, steps: null };
    } else {
      best = null;
      for (const steps of options[cell]) {
        let bits = 1;
        let fits = true;
        for (const step of steps) {
          if (filled & (1 << step)) {
            fits = false;
            break;
          }
          bits |= 1 << step;
        }
        if (!fits) continue;
        const used = 1 + least(cell + 1, (filled | bits) >> 1).used;
        if (!best || used < best.used) best = { used, steps };
      }
    }
    memo[cell].set(filled, best);
    return best;
  };
  const top = least(0, 0);
  const regions = [];
  let filled = 0;
  for (let cell = 0; cell < total; cell++) {
    const step = least(cell, filled);
    if (step.steps) {
      regions.push(sortedNumbers([cell, ...step.steps.map((offset) => cell + offset)]));
      for (const offset of step.steps) filled |= 1 << offset;
      filled |= 1;
    }
    filled >>= 1;
  }
  return { cover: top.used, regions };
}

/** 한 번 푼 판은 적어 둔다. 같은 판은 늘 같은 결과다 */
const solvedMemo = new Map();

/**
 * 풀이 프로그램: 가장 많이 놓는 수와 한 가지 방법, 가장 적은 구역 수와 한 가지 나누기.
 * @returns {{best: number, ways: number, example: number[], cover: number, regions: number[][], closes: boolean}}
 *   closes  구역 수가 가장 많이 놓는 수와 같은가(구역으로 "더 놓을 수 없다"를 보일 수 있는가)
 */
export function solve(board) {
  const key = JSON.stringify([board.w, board.h, board.holes, board.touch]);
  if (!solvedMemo.has(key)) {
    const most = solveMost(board);
    const cover = solveCover(board);
    solvedMemo.set(key, { ...most, cover: cover.cover, regions: cover.regions, closes: cover.cover === most.best });
  }
  const found = solvedMemo.get(key);
  return { ...found, example: found.example.slice(), regions: found.regions.map((region) => region.slice()) };
}

/** "위 줄 왼쪽부터 놓을 수 있는 칸마다 놓기"로 놓은 구슬(판을 고를 때 이것으로 가장 많이 놓을 수 없는 판을 고른다) */
export function firstFit(board) {
  const placed = [];
  for (const cell of cellsOf(board)) if (conflictsOf(board, placed, cell).length === 0) placed.push(cell);
  return placed;
}

/**
 * 아무렇게나 놓았을 때 가장 많이 놓는 수에 닿는 비율: 칸을 시드 난수로 섞고 놓을 수 있는 칸마다 놓기를 trials번 해 본다.
 * 시드는 판에서 만든다. 그래서 같은 판은 늘 같은 비율이다. 판을 고르는 잣대로 쓴다(전략 9.1절. 너무 높으면 밋밋하다).
 */
export function reachRate(board, trials = 200) {
  const rng = createRng(seedFrom('apart-reach', board.w, board.h, board.holes.join(','), board.touch));
  const best = solve(board).best;
  let reached = 0;
  for (let round = 0; round < trials; round++) {
    const cells = cellsOf(board);
    for (let index = cells.length - 1; index > 0; index--) {
      const other = randInt(rng, 0, index);
      [cells[index], cells[other]] = [cells[other], cells[index]];
    }
    const placed = [];
    for (const cell of cells) if (conflictsOf(board, placed, cell).length === 0) placed.push(cell);
    if (placed.length === best) reached += 1;
  }
  return reached / trials;
}

/** 판의 칸들이 변으로 이어져 있는가(빠진 칸으로 판이 끊기지 않았는가) */
export function connected(board) {
  const cells = cellsOf(board);
  if (cells.length === 0) return false;
  const has = new Set(cells);
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length > 0) {
    const cell = stack.pop();
    const [x, y] = xyOf(board, cell);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= board.w || ny >= board.h) continue;
      const other = ny * board.w + nx;
      if (has.has(other) && !seen.has(other)) {
        seen.add(other);
        stack.push(other);
      }
    }
  }
  return seen.size === cells.length;
}

/** "더 작은 판"으로 줄일 때 넓이의 위 끝(원래 판의 칸 수에 곱한다) */
export const SHRINK = 2 / 3;

/**
 * 원래 판보다 작은 같은 규칙의 네모 판들. 칸 수가 원래 판의 3분의 2 이하이고, 구슬을 둘 이상 놓을 수 있다.
 * 원래 판이 가로로 넓으면(가로 ≥ 세로) 가로가 넓은 판만, 세로로 길면 세로가 긴 판만 낸다. 큰 판부터 줄 세운다.
 * 구역을 그어 둔 판이면 작은 판에도 가장 적은 구역을 그어 둔다(네모 판은 늘 구역 수와 가장 많이 놓는 수가 같다).
 */
export function smallBoards(board) {
  const found = [];
  const room = cellsOf(board).length * SHRINK;
  const wide = board.w >= board.h;
  for (let w = MIN_SIZE; w <= board.w; w++) {
    for (let h = MIN_SIZE; h <= board.h; h++) {
      if (w * h > room || (wide ? w < h : w > h)) continue;
      const small = { w, h, holes: [], touch: board.touch, regions: null };
      const result = solve(small);
      if (result.best < 2) continue;
      if (board.regions) small.regions = result.regions;
      found.push(small);
    }
  }
  return found.sort((a, b) => b.w * b.h - a.w * a.h || Math.abs(a.w - a.h) - Math.abs(b.w - b.h) || b.w - a.w);
}
