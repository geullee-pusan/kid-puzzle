// 자르고 붙이기의 사다리(단계)와 판 내기, "더 작은 판"의 재료. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 모든 판은 풀이 프로그램으로 확인한 뒤에 낸다.
// 잘라 옮겨 네모의 도형은 칸 하나에서 시작해 옆 칸을 시드 난수로 하나씩 붙여 만든다(구멍이 있거나 이미 네모인 것은 버린다).
// 그림자는 조각들을 시드 난수로 하나씩 붙여 만든다(그래서 늘 채울 수 있다. 풀이 프로그램으로 다시 확인한다).
// 가짜 그림자는 그렇게 만든 그림자에 한 칸을 붙이거나 떼어 만든다(칸 수가 조각들과 달라 채울 수 없다).
import { createRng, randInt, seedFrom } from './rng.js';
import { MOVE_H, MOVE_W, PIECES, SEVEN, SHADOW_H, SHADOW_W, TRAY_W, boxOf, checkBoard, components, copyBoard, hasHole, isPrime, isRect, normalize, orientations, setArea, solve, solveMove, solveShadow } from './cutpaste.js';

/**
 * 안 되는 판이 섞이는 단계에서 안 되는 판의 비율. 임시값이다(셋에 하나쯤).
 * 늘 되거나 늘 안 되면 해 보지 않고 찍게 된다.
 */
export const IMPOSSIBLE_RATE = 1 / 3;

/**
 * 사다리.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'move'(잘라 옮겨 네모) | 'share'(가장 적게 잘라 나누기) | 'shadow'(가짜 그림자)
 *           | 'mixed'(나누기, 잘라 옮겨 네모, 가짜 그림자가 번갈아 나온다) | 'make'(직접 만들기)
 *   cuts    자를 수 있는 수, area: 도형의 칸 수 [아래 끝, 위 끝], box: 도형을 꼭 감싸는 네모의 [가로, 세로] 위 끝
 *   mixed   true면 안 되는 판이 섞인다(IMPOSSIBLE_RATE)
 *   pairs   나누기의 [막대 수, 사람 수]들, small: 수준 맞추기가 "작은 판부터"라고 할 때
 *   compact 그림자를 만들 때 조각을 가장 많이 맞닿는 자리에 붙인다(덜 들쭉날쭉하다)
 *
 * 1단계: 한 번 잘라 네모 만들기(칸 6~10, 한 번 잘라야만 되는 도형). 첫 판은 두 줄이 비껴 놓인 계단.
 * 2단계: 가장 적게 잘라 나누기(빵 2~4개, 2~4명). 첫 판은 빵 2개를 3명이.
 * 3단계: 두 번 잘라 네모 만들기(칸 7~12). 되는 판은 두 번 잘라야만 되는 도형이고, 안 되는 판이 셋에 하나쯤 섞인다(두 번으로는 안 되는 도형).
 *        첫 판은 되는 판, 둘째 판은 칸이 7개인 안 되는 판.
 * 4단계: 가짜 그림자(일곱 조각). 칸 수가 다른 그림자가 셋에 하나쯤 섞인다. 첫 판은 집 모양, 둘째 판은 5×5 네모(25칸이라 채울 수 없다).
 * 5단계: 큰 나누기(빵 3~5개, 3~6명), 두 번 잘라 네모 만들기(칸 9~12), 들쭉날쭉한 그림자가 번갈아 나온다.
 * 6단계: 직접 만들기(나누기).
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'move', cuts: 1, area: [6, 10], box: [5, 4], small: { area: [4, 6], box: [4, 3] }, mixed: false },
  { level: 2, tag: 'basic', mode: 'share', pairs: [[2, 3], [3, 2], [3, 4], [4, 3]], small: [[2, 3], [3, 2]] },
  { level: 3, tag: 'applied', mode: 'move', cuts: 2, area: [7, 12], box: [6, 5], small: { area: [5, 8], box: [4, 4] }, mixed: true },
  { level: 4, tag: 'applied', mode: 'shadow', set: SEVEN, compact: true, small: 4, mixed: true },
  {
    level: 5,
    tag: 'challenge',
    mode: 'mixed',
    kinds: ['share', 'move', 'shadow'],
    share: { pairs: [[3, 5], [5, 3], [4, 5], [5, 4], [4, 6], [5, 6]], small: [[3, 4], [4, 3]] },
    move: { cuts: 2, area: [9, 12], box: [6, 5], small: { area: [5, 8], box: [4, 4] }, mixed: true },
    shadow: { set: SEVEN, compact: false, small: 4, mixed: true },
  },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 판 하나를 고르려고 다시 뽑아 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 400;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

const pick = (rng, list) => list[randInt(rng, 0, list.length - 1)];

function shuffle(rng, list) {
  const items = list.slice();
  for (let index = items.length - 1; index > 0; index--) {
    const other = randInt(rng, 0, index);
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

/** 5단계는 판 번호마다 나누기, 잘라 옮겨 네모, 가짜 그림자가 번갈아 나온다 */
export function kindOf(level, seed) {
  const rung = rungOf(level);
  if (rung.mode === 'mixed') return rung.kinds[(Math.max(1, seed) - 1) % rung.kinds.length];
  return rung.mode;
}

/** 줄마다 #이 칸인 그림을 칸들로 */
export const rows = (lines) => lines.flatMap((line, y) => [...line].flatMap((ch, x) => (ch === '#' ? [[x, y]] : [])));

// ---- 잘라 옮겨 네모 ----

/** 칸 하나에서 시작해 옆 칸을 하나씩 붙여 칸 area개의 도형을 만든다(꼭 감싸는 네모가 box 안) */
export function growShape(rng, area, [maxW, maxH]) {
  const cells = [[0, 0]];
  const seen = new Set(['0,0']);
  for (let guard = 0; cells.length < area && guard < 2000; guard++) {
    const [x, y] = pick(rng, cells);
    const [dx, dy] = pick(rng, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
    const next = [x + dx, y + dy];
    if (seen.has(next.join())) continue;
    const box = boxOf([...cells, next]);
    if (box.w > maxW || box.h > maxH) continue;
    cells.push(next);
    seen.add(next.join());
  }
  return normalize(cells);
}

/** 도형을 판(MOVE_W × MOVE_H)의 왼쪽, 위아래 가운데에 놓는다 */
export function placeShape(cells) {
  const box = boxOf(cells);
  const y = Math.floor((MOVE_H - box.h) / 2);
  return normalize(cells).map(([x, cy]) => [x + 1, cy + y]);
}

/** 도형(칸들)과 자르는 수로 잘라 옮겨 네모 판을 만든다 */
export const moveBoard = (cells, cuts) => ({ kind: 'move', w: MOVE_W, h: MOVE_H, cells: placeShape(cells), cuts });

/**
 * 잘라 옮겨 네모 판 하나. want는 'yes'(꼭 cuts번 잘라야 되는 판) | 'no'(cuts번으로는 안 되는 판. 칸 수가 소수인 판만) | 'any'(되는 판, 덜 잘라도 된다).
 * 못 만들면 null.
 */
export function makeMove(rng, { cuts, area: [low, high], box }, want) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const area = want === 'no' ? pick(rng, primesIn(low, high)) : randInt(rng, low, high);
    if (!area) return null;
    const cells = growShape(rng, area, box);
    if (cells.length !== area || isRect(cells) || hasHole(cells)) continue;
    const board = moveBoard(cells, cuts);
    if (checkBoard(board) !== null) continue;
    const result = solveMove(board);
    if (want === 'no' ? result.possible || result.reason !== 'line' : !result.possible) continue;
    if (want === 'yes' && result.min !== cuts) continue;
    return board;
  }
  return null;
}

const primesIn = (low, high) => {
  const list = [];
  for (let n = low; n <= high; n++) if (isPrime(n)) list.push(n);
  return list;
};

// ---- 가짜 그림자 ----

const cellKey = ([x, y]) => `${x},${y}`;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * 조각들을 하나씩 붙여 그림자를 만든다. 둘째 조각부터는 앞의 조각들과 맞닿고 겹치지 않는 자리에 놓는다.
 * compact가 참이면 가장 많이 맞닿는 자리들 가운데서 고른다. 그림자의 칸들(맨 위 왼쪽이 0, 0)을 돌려준다.
 */
export function assemble(rng, types, compact) {
  const order = shuffle(rng, types);
  const filled = new Set();
  const put = (cells) => cells.forEach((cell) => filled.add(cellKey(cell)));
  put(pick(rng, orientations(PIECES[order[0]])));
  for (const type of order.slice(1)) {
    const cells = [...filled].map((name) => name.split(',').map(Number));
    const box = boxOf(cells);
    const options = [];
    for (const shape of orientations(PIECES[type])) {
      const sb = boxOf(shape);
      for (let y = box.y - sb.h; y <= box.y + box.h; y++) {
        for (let x = box.x - sb.w; x <= box.x + box.w; x++) {
          const placed = shape.map(([cx, cy]) => [cx + x, cy + y]);
          if (placed.some((cell) => filled.has(cellKey(cell)))) continue;
          let touch = 0;
          for (const [cx, cy] of placed) for (const [dx, dy] of STEPS) if (filled.has(cellKey([cx + dx, cy + dy]))) touch += 1;
          if (touch > 0) options.push({ placed, touch });
        }
      }
    }
    const most = Math.max(...options.map((item) => item.touch));
    const pool = compact ? options.filter((item) => item.touch >= most - 1) : options;
    put(pick(rng, pool).placed);
  }
  return normalize([...filled].map((name) => name.split(',').map(Number)));
}

/** 그림자의 칸들(맨 위 왼쪽이 0, 0)을 판의 오른쪽 자리 가운데에 놓는다 */
export function placeShadow(cells) {
  const box = boxOf(cells);
  const room = SHADOW_W - TRAY_W - 1;
  const x = TRAY_W + 1 + Math.floor((room - box.w) / 2);
  const y = Math.floor((SHADOW_H - box.h) / 2);
  return normalize(cells).map(([cx, cy]) => [cx + x, cy + y]);
}

/** 조각 종류들과 그림자(칸들)로 가짜 그림자 판을 만든다 */
export const shadowBoard = (set, cells) => ({ kind: 'shadow', w: SHADOW_W, h: SHADOW_H, set: set.slice(), shadow: placeShadow(cells) });
/** 그림자가 들어가는 자리(가로, 세로) */
const SHADOW_ROOM = [SHADOW_W - TRAY_W - 1, SHADOW_H];
const fitsRoom = (cells) => {
  const box = boxOf(cells);
  return box.w <= SHADOW_ROOM[0] && box.h <= SHADOW_ROOM[1];
};

/** 그림자에 한 칸을 붙이거나 떼어 칸 수가 다른 그림자를 만든다(이어져 있고 구멍이 없다). 못 만들면 null */
export function fakeShadow(rng, cells) {
  const filled = new Set(cells.map(cellKey));
  const adds = [];
  for (const [x, y] of cells) {
    for (const [dx, dy] of STEPS) {
      const next = [x + dx, y + dy];
      if (filled.has(cellKey(next)) || adds.some((item) => cellKey(item) === cellKey(next))) continue;
      const made = [...cells, next];
      if (fitsRoom(made) && !hasHole(made)) adds.push(next);
    }
  }
  const drops = cells.filter((cell) => {
    const rest = cells.filter((other) => cellKey(other) !== cellKey(cell));
    return components(rest).length === 1 && !hasHole(rest);
  });
  const addFirst = rng() < 0.5;
  const tries = addFirst ? [adds, drops] : [drops, adds];
  for (const list of tries) {
    if (list.length === 0) continue;
    const cell = pick(rng, list);
    return list === adds ? normalize([...cells, cell]) : normalize(cells.filter((other) => cellKey(other) !== cellKey(cell)));
  }
  return null;
}

/** 그림자 판 하나. want는 'yes'(채울 수 있다) | 'no'(칸 수가 달라 채울 수 없다). 못 만들면 null */
export function makeShadow(rng, set, compact, want) {
  for (let attempt = 0; attempt < 60; attempt++) {
    let cells = assemble(rng, set, compact);
    if (!fitsRoom(cells) || hasHole(cells)) continue;
    if (want === 'no') {
      cells = fakeShadow(rng, cells);
      if (!cells) continue;
    }
    const board = shadowBoard(set, cells);
    if (checkBoard(board) !== null) continue;
    const result = solveShadow(board);
    if (want === 'no' ? result.possible || result.reason !== 'area' : !result.possible) continue;
    return board;
  }
  return null;
}

/** 조각 종류 count개를 고른다(한 벌의 차례대로) */
function subset(rng, set, count) {
  const at = shuffle(
    rng,
    set.map((_, index) => index),
  )
    .slice(0, count)
    .sort((a, b) => a - b);
  return at.map((index) => set[index]);
}

// ---- 맨 처음 판들 ----

/** 1단계 첫 판: 네 칸짜리 두 줄이 두 칸 비껴 놓인 계단. 왼쪽 두 칸을 세로로 잘라 오른쪽 끝에 붙이면 네모가 된다 */
export const FIRST_MOVE = moveBoard(rows(['####..', '..####']), 1);
/** 2단계 첫 판: 빵 2개를 3명이 */
export const FIRST_SHARE = { kind: 'share', m: 2, n: 3 };
/** 4단계 첫 판: 집 모양 그림자(20칸) */
export const HOUSE = ['..#..', '.###.', '#####', '.###.', '.###.', '.###.', '.#.#.'];
export const FIRST_SHADOW = shadowBoard(SEVEN, rows(HOUSE));
/** 4단계 둘째 판: 5×5 네모 그림자(25칸. 조각들은 20칸이라 채울 수 없다) */
export const SECOND_SHADOW = shadowBoard(SEVEN, rows(['#####', '#####', '#####', '#####', '#####']));

// ---- 판 내기 ----

const specOf = (rung, kind) => (rung.mode === 'mixed' ? rung[kind] : rung);

/** 안 되는 판이 섞이는 단계에서 이 판이 안 되는 판일지(첫 판은 늘 되는 판) */
const wantsNo = (rng, spec, seed) => spec.mixed && seed > 1 && rng() < IMPOSSIBLE_RATE;

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
  const rng = createRng(seedFrom('cutpaste', level, seed, small ? 'small' : ''));
  const done = (board) => ({ level, seed, small, board: copyBoard(board), solution: solve(board) });
  if (!small && level === 1 && seed === 1) return done(FIRST_MOVE);
  if (!small && level === 2 && seed === 1) return done(FIRST_SHARE);
  if (!small && level === 4 && seed === 1) return done(FIRST_SHADOW);
  if (!small && level === 4 && seed === 2) return done(SECOND_SHADOW);
  const kind = kindOf(level, seed);
  const spec = specOf(rung, kind);
  // 안 되는 판일지는 판마다 한 번만 정한다(작은 판도 섞인다)
  const no = kind !== 'share' && wantsNo(rng, spec, seed);
  // 3단계 둘째 판은 칸이 7개인 안 되는 판(아주 쉬운 안 되는 판)
  const easy = !small && level === 3 && seed === 2;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    let board = null;
    if (kind === 'share') {
      const [m, n] = pick(rng, small ? spec.small : spec.pairs);
      board = { kind: 'share', m, n };
    } else if (kind === 'move') {
      const shape = small ? { ...spec, ...spec.small } : easy ? { ...spec, area: [7, 7] } : spec;
      board = makeMove(rng, shape, easy || no ? 'no' : small ? 'any' : 'yes');
    } else {
      const set = small ? subset(rng, spec.set, spec.small) : spec.set;
      board = makeShadow(rng, set, spec.compact || small, no ? 'no' : 'yes');
    }
    if (board && checkBoard(board) === null) return done(board);
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

/** 나누기보다 작은 판들: 막대 수와 사람 수가 모두 원래보다 크지 않고 합이 작은 것(둘 다 2 이상, 한쪽이 다른 쪽을 나누어떨어뜨리지 않는다). 큰 것부터 */
export function smallerPairs(board) {
  const list = [];
  for (let m = 2; m <= board.m; m++) {
    for (let n = 2; n <= board.n; n++) {
      if (m + n >= board.m + board.n || m % n === 0 || n % m === 0) continue;
      list.push([m, n]);
    }
  }
  return list.sort((a, b) => b[0] + b[1] - (a[0] + a[1]) || b[0] - a[0]);
}

/**
 * 원래 판보다 작은 판들(차례는 src/core/smaller.js가 고른다).
 *   잘라 옮겨 네모  칸이 원래의 3분의 2 이하(4칸 이상)이고 자르는 수가 같은 도형. 되는 판만 낸다(yes)
 *   가짜 그림자     조각 넷(한 벌에서 고른 것)의 그림자. yes는 채울 수 있는 그림자, no는 칸 수가 다른 그림자
 *   나누기          막대 수와 사람 수가 작은 판(되는 판만 있다)
 *   더 작게 만들 수 없으면 두 목록이 모두 빈다.
 * @param {{mode: string, board: object}} origin
 */
export function smallBoards(origin) {
  const { board } = origin;
  const rng = createRng(seedFrom('cutpaste-smaller', JSON.stringify(board)));
  const lists = { yes: [], no: [] };
  const keys = new Set();
  const add = (list, item) => {
    if (!item || checkBoard(item) !== null) return;
    const name = JSON.stringify(item);
    if (keys.has(name)) return;
    keys.add(name);
    list.push(item);
  };
  if (board.kind === 'share') {
    for (const [m, n] of smallerPairs(board).slice(0, 3)) add(lists.yes, { kind: 'share', m, n });
    return lists;
  }
  if (board.kind === 'move') {
    const high = Math.floor((board.cells.length * 2) / 3);
    if (high < 4) return lists;
    const box = boxOf(board.cells);
    const shape = { cuts: board.cuts, area: [Math.max(4, Math.min(high, Math.ceil(board.cells.length / 2))), high], box: [Math.min(box.w, 5), Math.min(box.h, 4)] };
    // 작은 도형은 두 번 자르면 거의 다 되므로 안 되는 판은 내지 않는다(되는 판만 차례로 낸다)
    for (let attempt = 0; attempt < 8 && lists.yes.length < 3; attempt++) add(lists.yes, makeMove(rng, shape, 'any'));
    return lists;
  }
  if (board.set.length <= 4) return lists;
  for (let attempt = 0; attempt < 12 && (lists.yes.length < 3 || lists.no.length < 2); attempt++) {
    const set = subset(rng, board.set, 4);
    if (lists.yes.length < 3) add(lists.yes, makeShadow(rng, set, true, 'yes'));
    if (lists.no.length < 2) add(lists.no, makeShadow(rng, set, true, 'no'));
  }
  return lists;
}

export { setArea };
