// 방 한 번씩 돌기의 사다리(단계)와 판 내기, "더 작은 판"의 재료. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 정원 자리, 처음 방, 길은 시드 난수로 고르고, 풀이 프로그램으로 확인한 판만 낸다.
// 안 되는 판은 까닭을 아이에게 설명할 수 있는 판(색, 문이 하나뿐인 방, 지나면 집이 나뉘는 방)만 낸다. 모든 길을 따져야만 아는 판은 내지 않는다.
import { createRng, randInt, seedFrom } from './rng.js';
import { MIN_SIZE, colorCheck, copyBoard, countPaths, partsOf, roomsOf, searchPaths, shapeCheck, solve, solveHouse } from './rooms.js';

/**
 * 안 되는 판이 섞이는 단계에서 안 되는 판의 비율. 임시값이다(셋에 하나쯤).
 * 늘 되거나 늘 안 되면 해 보지 않고 찍게 된다.
 */
export const IMPOSSIBLE_RATE = 1 / 3;

/**
 * 사다리. 기획 문서의 표를 옮겼다.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   'draw'(되는 판만) | 'mix'(안 되는 판이 섞인다. "불가능해요"가 있다) | 'numbers'(수 몇 개가 적힌 판에 지나는 차례대로 긋기)
 *          | 'judge'(긋지 않고 여러 집 가운데 안 되는 집 고르기) | 'big'(큰 집, 정원이 있는 집. 색은 맞는데 안 되는 판도 섞인다) | 'make'(직접 만들기)
 *   sizes  집의 크기 [가로, 세로]의 후보, small: 수준 맞추기가 "작은 판부터"라고 할 때
 *   walls  정원 칸 수의 [아래 끝, 위 끝]
 *
 * 1단계: 4×4, 되는 판만. 첫 판은 맨 위 왼쪽 방에서 맨 아래 왼쪽 방까지(줄마다 왔다 갔다 하면 된다).
 * 2단계: 4×4, 안 되는 판이 셋에 하나쯤 섞인다. 첫 판은 되는 판, 둘째 판은 맨 위 왼쪽에서 맨 아래 오른쪽(아주 쉬운 안 되는 판).
 *        4×4에서는 색이 맞으면 늘 되므로(풀이 프로그램으로 확인) 안 되는 판은 모두 색 때문이다.
 * 3단계: 4×4와 5×4. 처음 방(1)과 끝 방, 그리고 몇 방에 지나는 차례가 적혀 있다. 길은 하나뿐이다(풀이 프로그램으로 센다).
 * 4단계: 같은 꼴의 집 넷(3×3, 4×3, 4×4, 5×3. 정원이 있는 꼴도 있다)에서 처음 방과 끝 방만 다르다. 안 되는 집은 대개 둘이다.
 * 5단계: 5×5, 6×5, 6×6에 정원 1~4칸. 안 되는 판이 셋에 하나쯤이고, 그 가운데 반은 색은 맞는데 생김새 때문에 안 되는 판이다.
 * 6단계: 직접 만들기.
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'draw', sizes: [[4, 4]], small: [[4, 3]], walls: [0, 0] },
  { level: 2, tag: 'applied', mode: 'mix', sizes: [[4, 4]], small: [[4, 3]], walls: [0, 0] },
  { level: 3, tag: 'applied', mode: 'numbers', sizes: [[4, 4], [5, 4]], small: [[4, 3]], walls: [0, 0] },
  { level: 4, tag: 'challenge', mode: 'judge', sizes: [[3, 3], [4, 3], [4, 4], [5, 3]], small: [[3, 3], [4, 3]], walls: [0, 2] },
  { level: 5, tag: 'challenge', mode: 'big', sizes: [[5, 5], [6, 5], [6, 6]], small: [[5, 4], [4, 4]], walls: [1, 4] },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 판 하나를 고르려고 다시 뽑아 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 600;
/** 판을 만들 때 길 하나를 찾느라 들르는 자리의 위 끝(넘으면 다른 자리에서 다시 찾는다) */
const MAKE_LIMIT = 60000;
/** 수가 적힌 판에 적는 수의 아래 끝(처음 방과 끝 방은 빼고) */
const MIN_CLUES = { 12: 2, 16: 3, 20: 4 };

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

function shuffle(rng, list) {
  const items = list.slice();
  for (let index = items.length - 1; index > 0; index--) {
    const other = randInt(rng, 0, index);
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

/** 길을 찾을 때 다음 방의 차례: 시드 난수로 섞되, 더 갈 곳이 적은 방을 먼저 간다(빨리 찾게) */
const mixer = (rng) => (nexts, onward) =>
  shuffle(rng, nexts)
    .map((cell, at) => ({ cell, at, key: onward(cell) }))
    .sort((a, b) => a.key - b.key || a.at - b.at)
    .map((item) => item.cell);

/** 정원 칸 count개를 시드 난수로 고른다. 남은 방이 한 덩어리로 이어지는 자리만 쓴다 */
function randomWalls(rng, w, h, count) {
  if (count === 0) return [];
  for (let attempt = 0; attempt < 50; attempt++) {
    const cells = shuffle(
      rng,
      Array.from({ length: w * h }, (_, cell) => cell),
    )
      .slice(0, count)
      .sort((a, b) => a - b);
    if (partsOf({ w, h, walls: cells }).length === 1) return cells;
  }
  return null;
}

const house = (w, h, walls, start, end, numbers = []) => ({ kind: 'house', w, h, walls, start, end, numbers });

/**
 * 원하는 답의 집 하나를 시드 난수로 만든다. 못 만들면 null.
 *   want  'possible'(되는 집) | 'color'(색 때문에 안 되는 집. 생김새는 문제없다) | 'shape'(색은 맞는데 생김새 때문에 안 되는 집)
 *         | 'deadend' | 'cut'(생김새 가운데 그 까닭으로만)
 *   detail  want가 'color'일 때 맞지 않는 것('same' | 'minor' | 'count'). 없으면 아무것이나
 */
export function makeHouse(rng, { w, h, walls = 0, want, detail = null, tries = MAX_TRIES }) {
  for (let attempt = 0; attempt < tries; attempt++) {
    const cells = randomWalls(rng, w, h, walls);
    if (!cells) continue;
    const rooms = roomsOf({ w, h, walls: cells });
    const start = rooms[randInt(rng, 0, rooms.length - 1)];
    if (want === 'possible') {
      const found = searchPaths(house(w, h, cells, start, null), { cap: 1, limit: MAKE_LIMIT, order: mixer(rng) });
      if (!found.path) continue;
      const board = house(w, h, cells, start, found.path.at(-1));
      if (solveHouse(board).possible === true) return board;
      continue;
    }
    for (const end of shuffle(
      rng,
      rooms.filter((cell) => cell !== start),
    )) {
      const board = house(w, h, cells, start, end);
      const color = colorCheck(board);
      const shape = shapeCheck(board);
      if (want === 'color') {
        if (!color.ok && shape === null && (detail === null || color.detail === detail)) return board;
        continue;
      }
      if (!color.ok || !shape || shape.reason === 'split') continue;
      if (want === 'shape' || want === shape.reason) return board;
    }
  }
  return null;
}

/**
 * 수가 몇 개 적힌 집: 시드 난수로 길 하나를 고르고, 그 길에서 몇 방의 차례를 적는다.
 * 길이 하나뿐이 되도록 적고, 하나뿐인 채로 뺄 수 있는 수는 뺀 다음, 너무 적으면 몇 개 다시 적는다.
 */
export function makeNumbers(rng, w, h, minClues = MIN_CLUES[w * h] ?? 2) {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const start = randInt(rng, 0, w * h - 1);
    const found = searchPaths(house(w, h, [], start, null), { cap: 1, limit: MAKE_LIMIT, order: mixer(rng) });
    if (!found.path) continue;
    const path = found.path;
    const n = path.length;
    const end = path.at(-1);
    const board = (orders) => house(w, h, [], start, end, [[start, 1], ...orders.sort((a, b) => a - b).map((order) => [path[order - 1], order]), [end, n]]);
    const inner = shuffle(
      rng,
      Array.from({ length: n - 2 }, (_, at) => at + 2),
    );
    let kept = inner.slice();
    if (countPaths(board(kept.slice()), 2) !== 1) continue;
    const dropped = [];
    for (const order of inner) {
      const without = kept.filter((item) => item !== order);
      if (countPaths(board(without.slice()), 2) === 1) {
        kept = without;
        dropped.push(order);
      }
    }
    while (kept.length < minClues && dropped.length > 0) kept.push(dropped.shift());
    return board(kept.slice());
  }
  throw new Error(`수가 적힌 판을 만들지 못했어요: ${w}×${h}`);
}

/** 집 하나를 처음 방과 끝 방의 짝(순서 없이)으로 부른다 */
const pairKey = (board) => [Math.min(board.start, board.end), Math.max(board.start, board.end)].join('-');

/**
 * 가려 내기 판: 같은 꼴(크기와 정원)의 집 count개. 처음 방과 끝 방만 다르다. 안 되는 집은 bad개다.
 * 정원이 있는 꼴에서 shape가 참이면 안 되는 집 하나는 생김새 때문에 안 되는 집으로 한다(그런 짝이 있는 정원 자리를 앞의 절반 동안 찾는다).
 * 못 만들면 null.
 */
export function makeJudge(rng, { w, h, walls = 0, count = 4, bad = 2, shape = false, tries = 60 }) {
  for (let attempt = 0; attempt < tries; attempt++) {
    const cells = randomWalls(rng, w, h, walls);
    if (!cells) continue;
    const rooms = roomsOf({ w, h, walls: cells });
    const pairs = [];
    for (let a = 0; a < rooms.length; a++) for (let b = a + 1; b < rooms.length; b++) pairs.push(rng() < 0.5 ? [rooms[a], rooms[b]] : [rooms[b], rooms[a]]);
    const buckets = { possible: [], color: [], shape: [] };
    const need = { possible: count - bad, color: bad, shape: 0 };
    if (shape && walls > 0 && attempt < tries / 2) {
      need.shape = 1;
      need.color = bad - 1;
    }
    for (const [start, end] of shuffle(rng, pairs)) {
      const board = house(w, h, cells, start, end);
      const solution = solveHouse(board);
      const kind = solution.possible === true ? 'possible' : solution.reason === 'color' ? 'color' : ['deadend', 'cut'].includes(solution.reason) ? 'shape' : null;
      if (kind && buckets[kind].length < need[kind]) buckets[kind].push(board);
      if (Object.keys(need).every((key) => buckets[key].length >= need[key])) break;
    }
    if (!Object.keys(need).every((key) => buckets[key].length >= need[key])) continue;
    const houses = shuffle(rng, [...buckets.possible, ...buckets.color, ...buckets.shape]);
    return { kind: 'judge', houses };
  }
  return null;
}

// ---- 맨 처음 판들 ----

/** 1단계 첫 판: 맨 위 왼쪽 방에서 맨 아래 왼쪽 방까지. 줄마다 왔다 갔다 하면 된다 */
export const FIRST_BOARD = house(4, 4, [], 0, 12);
/** 2단계 첫 판(되는 판)과 둘째 판(맨 위 왼쪽에서 맨 아래 오른쪽: 아주 쉬운 안 되는 판) */
export const MIX_FIRST = house(4, 4, [], 0, 3);
export const MIX_SECOND = house(4, 4, [], 0, 15);

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 그 단계에서 작은 판을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level, seed, small, board, solution}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  const rng = createRng(seedFrom('rooms', level, seed, small ? 'small' : ''));
  const done = (board) => ({ level, seed, small, board, solution: solve(board) });
  const sizes = small ? rung.small : rung.sizes;
  const pickSize = () => sizes[randInt(rng, 0, sizes.length - 1)];
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    let board = null;
    if (rung.mode === 'draw') {
      if (seed === 1 && !small) return done(FIRST_BOARD);
      const [w, h] = pickSize();
      board = makeHouse(rng, { w, h, want: 'possible' });
    } else if (rung.mode === 'mix') {
      if (seed === 1 && !small) return done(MIX_FIRST);
      if (seed === 2 && !small) return done(MIX_SECOND);
      const [w, h] = pickSize();
      board = makeHouse(rng, { w, h, want: rng() < IMPOSSIBLE_RATE ? 'color' : 'possible' });
    } else if (rung.mode === 'numbers') {
      const [w, h] = pickSize();
      board = makeNumbers(rng, w, h);
    } else if (rung.mode === 'judge') {
      const [w, h] = seed === 1 && !small ? [4, 4] : pickSize();
      const walls = seed === 1 || small ? 0 : randInt(rng, rung.walls[0], Math.min(rung.walls[1], w * h >= 12 ? 2 : 1));
      const count = small ? 3 : 4;
      const bad = small ? randInt(rng, 1, 2) : seed === 1 ? 2 : [1, 2, 2, 3][randInt(rng, 0, 3)];
      board = makeJudge(rng, { w, h, walls, count, bad, shape: walls > 0 && bad >= 2 && rng() < 0.6 });
    } else if (rung.mode === 'big') {
      const [w, h] = seed <= 2 && !small ? [5, 5] : pickSize();
      const walls = seed <= 2 && !small ? 2 : randInt(rng, ...(small ? [1, 2] : rung.walls));
      let want = 'possible';
      if (seed === 2 && !small) want = 'shape';
      else if (seed > 2 && rng() < IMPOSSIBLE_RATE) want = rng() < 0.5 ? 'color' : 'shape';
      board = makeHouse(rng, { w, h, walls, want, tries: 60 });
    }
    if (board) return done(board);
  }
  throw new Error(`판을 만들지 못했어요: ${level}단계 ${seed}번`);
}

const sameBoard = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 다음 판 번호. 방금 한 판과 똑같은 판이 나오는 번호는 건너뛴다. */
export function nextSeed(level, seed, options = {}) {
  const now = generateBoard(level, seed, options).board;
  for (let next = seed + 1; next < seed + 40; next++) {
    if (!sameBoard(generateBoard(level, next, options).board, now)) return next;
  }
  return seed + 1;
}

// ---- "더 작은 판"의 재료 ----

/** 더 작은 크기들: 긴 쪽부터 한 칸씩 줄인다(가로와 세로 모두 3 이상, 칸 수가 줄어드는 것만). 큰 것부터 */
export function smallerSizes(w, h) {
  const list = [
    [w - 1, h],
    [w, h - 1],
    [w - 1, h - 1],
    [w - 2, h],
    [w, h - 2],
  ]
    .map(([a, b]) => (a >= b ? [a, b] : [b, a]))
    .filter(([a, b]) => a >= MIN_SIZE && b >= MIN_SIZE && a * b < w * h);
  const seen = new Set();
  return list
    .filter(([a, b]) => {
      const key = `${a}x${b}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((x, y) => y[0] * y[1] - x[0] * x[1]);
}

/** 판의 답의 종류: 'possible' 또는 안 되는 까닭(색이면 무엇이 맞지 않는지까지) */
export function answerKind(board) {
  const solution = solveHouse(board);
  if (solution.possible === true) return { want: 'possible', detail: null };
  if (solution.reason === 'color') return { want: 'color', detail: solution.detail.detail };
  if (solution.reason === 'deadend' || solution.reason === 'cut') return { want: solution.reason, detail: null };
  return null;
}

/**
 * 원래 판보다 작은 판들(차례는 src/core/smaller.js가 고른다). 원래 판과 답의 종류가 같은 판만 낸다:
 *   되는 집          더 작은 되는 집(정원 수는 원래 판을 넘지 않는다)
 *   안 되는 집        같은 까닭으로 안 되는 더 작은 집(색이면 맞지 않는 것까지 같게: 같은 색, 적은 쪽 색, 수의 차이)
 *   수가 적힌 집      더 작은 수가 적힌 집
 *   가려 내기         더 작은 꼴의 집 셋(안 되는 집의 수는 원래 판을 넘지 않는다)
 * 정원 때문에 나뉜 집과 모든 길을 따져야만 아는 집에는 작은 판이 없다. 더 줄일 수 없는 크기(3×3)도 없다.
 * @param {{mode: string, board: object}} origin
 * @returns {object[]} 판들(많아야 셋)
 */
export function smallBoards(origin) {
  const { board } = origin;
  const rng = createRng(seedFrom('rooms-smaller', JSON.stringify(copyBoard(board))));
  const list = [];
  const keys = new Set();
  const add = (item) => {
    if (!item) return;
    const key = JSON.stringify(item);
    if (keys.has(key)) return;
    keys.add(key);
    list.push(item);
  };
  if (board.kind === 'judge') {
    const first = board.houses[0];
    const bad = solve(board).impossible.length;
    for (const [w, h] of smallerSizes(first.w, first.h).slice(0, 2)) {
      for (let k = 0; k < 2 && list.length < 3; k++) add(makeJudge(rng, { w, h, walls: 0, count: 3, bad: Math.max(1, Math.min(2, bad)) }));
    }
    return list;
  }
  if ((board.numbers ?? []).length > 0) {
    for (const [w, h] of smallerSizes(board.w, board.h).slice(0, 2)) {
      for (let k = 0; k < 2 && list.length < 3; k++) add(makeNumbers(rng, w, h, MIN_CLUES[w * h] ?? 2));
    }
    return list;
  }
  const kind = answerKind(board);
  if (!kind) return list;
  const shaped = kind.want === 'deadend' || kind.want === 'cut';
  const walls = shaped ? Math.max(1, Math.min(2, board.walls.length)) : Math.min(2, board.walls.length);
  for (const [w, h] of smallerSizes(board.w, board.h).slice(0, 3)) {
    for (let k = 0; k < 2 && list.length < 3; k++) {
      // 같은 까닭의 판이 작은 크기에 없으면(예: 방이 홀수 개인 집에는 "같은 색"이 없다) 정원 수를 바꿔 본다
      const made = makeHouse(rng, { w, h, walls, want: kind.want, detail: kind.detail, tries: 80 }) ?? makeHouse(rng, { w, h, walls: walls === 0 ? 1 : walls - 1, want: kind.want, detail: kind.detail, tries: 80 });
      add(made);
    }
  }
  return list;
}
