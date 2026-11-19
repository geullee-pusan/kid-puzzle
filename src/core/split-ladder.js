// 똑같이 섞이게 자르기의 사다리(단계)와 판 내기, "더 작은 판"의 재료. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 되는 판은 자르기 하나를 시드 난수로 고르고 조각마다 같은 꼴로 색을 칠해 만든다.
// 안 되는 판은 까닭을 아이에게 보여 줄 수 있는 판(묶음이 모자라는 판, 끝에서 끝까지 어디를 잘라도 두 쪽이 같은 꼴이 안 되는 판)만 낸다.
// 모든 자르기를 따져야만 아는 판은 내지 않는다. 모든 판은 풀이 프로그램으로 확인한 뒤에 낸다.
import { createRng, randInt, seedFrom } from './rng.js';
import { MIN_SIZE, allLayouts, copyBoard, gcd, mixOf, solve } from './split.js';

/**
 * 안 되는 판이 섞이는 단계에서 안 되는 판의 비율. 임시값이다(셋에 하나쯤).
 * 늘 되거나 늘 안 되면 해 보지 않고 찍게 된다.
 */
export const IMPOSSIBLE_RATE = 1 / 3;

/**
 * 사다리.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'cut'(되는 판만. 잘라서 끝낸다) | 'mix'(안 되는 판이 섞인다. "불가능해요"가 있다) | 'count'(되는 자르기를 모두 찾는다)
 *           | 'four'(네 조각. 안 되는 판이 섞인다) | 'make'(직접 만들기)
 *   parts   만들 조각 수
 *   ratios  판 전체의 섞인 꼴 [회색, 흰 칸]의 후보(한 묶음)
 *   sizes   판의 크기 [가로, 세로]의 후보, small: 수준 맞추기가 "작은 판부터"라고 할 때
 *   ways    되는 자르기의 수의 [아래 끝, 위 끝]
 *   strips  true면 되는 판의 바탕 자르기를 나란한 두 선(세 띠)으로만 고른다
 *
 * 1단계: 회색과 흰 칸이 반반인 6×3, 6×4. 나란한 두 선으로 세 띠가 되게 칠한다. 첫 판은 두 칸 너비의 세 띠로 자르면 된다.
 * 2단계: 회색 1칸에 흰 칸 2칸씩, 1칸에 3칸씩, 2칸에 3칸씩. 자르기는 아무것이나.
 * 3단계: 안 되는 판이 셋에 하나쯤 섞인다. 첫 판은 되는 판, 둘째 판은 회색이 2칸뿐인 판(아주 쉬운 안 되는 판).
 * 4단계: 되는 자르기가 2~4가지인 판에서 모두 찾기.
 * 5단계: 선 세 개로 네 조각. 6×4, 6×6, 8×4, 8×6. 안 되는 판이 셋에 하나쯤 섞인다.
 * 6단계: 직접 만들기.
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'cut', parts: 3, ratios: [[1, 1]], sizes: [[6, 3], [6, 4]], small: [[4, 3]], ways: [1, 6], strips: true },
  { level: 2, tag: 'basic', mode: 'cut', parts: 3, ratios: [[1, 2], [1, 3], [2, 3]], sizes: [[6, 3], [6, 4], [6, 5]], small: [[6, 2], [4, 3], [5, 3]], ways: [1, 6], strips: false },
  { level: 3, tag: 'applied', mode: 'mix', parts: 3, ratios: [[1, 1], [1, 2], [1, 3]], sizes: [[6, 3], [6, 4]], small: [[4, 3], [6, 2]], ways: [1, 6], strips: false },
  { level: 4, tag: 'applied', mode: 'count', parts: 3, ratios: [[1, 1], [1, 2]], sizes: [[6, 3], [6, 4], [4, 4]], small: [[4, 3], [6, 2]], ways: [2, 4], strips: false },
  { level: 5, tag: 'challenge', mode: 'four', parts: 4, ratios: [[1, 1], [1, 2], [1, 3]], sizes: [[6, 4], [6, 6], [8, 4], [8, 6]], small: [[6, 3], [4, 4]], ways: [1, 8], strips: false },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 판 하나를 고르려고 다시 뽑아 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 600;
/** 안 되는 판으로 내는 까닭(아이에게 그림으로 보여 줄 수 있는 것만) */
export const SHOWN_REASONS = ['groups', 'edge'];

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

const pick = (rng, list) => list[randInt(rng, 0, list.length - 1)];

/** 그 꼴로 섞을 수 있는 크기인가: 칸 수가 한 묶음의 배수이고, 묶음이 조각 수 이상이다 */
export const fits = ([w, h], [g, white], parts) => (w * h) % (g + white) === 0 && (w * h) / (g + white) >= parts;

const cellsOf = (board, rect) => {
  const cells = [];
  for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) cells.push(y * board.w + x);
  return cells;
};

/** 나란한 두(세) 선으로만 자른 것인가(모든 조각이 판의 한 변을 끝에서 끝까지 쓴다) */
const isStrips = (pieces, w, h) => pieces.every((rect) => rect.h === h) || pieces.every((rect) => rect.w === w);

/**
 * 되는 판 하나: 자르기 하나를 고르고 조각마다 같은 꼴로 회색을 칠한다. 되는 자르기의 수가 ways 안이어야 낸다. 못 만들면 null.
 */
export function makePossible(rng, { w, h, ratio, parts, ways = [1, 6], strips = false, tries = 80 }) {
  const [g, white] = ratio;
  const unit = g + white;
  const layouts = allLayouts(w, h, parts).filter((pieces) => pieces.every((rect) => (rect.w * rect.h) % unit === 0) && (!strips || isStrips(pieces, w, h)));
  if (layouts.length === 0) return null;
  for (let attempt = 0; attempt < tries; attempt++) {
    const pieces = pick(rng, layouts);
    const grey = [];
    for (const rect of pieces) {
      const cells = shuffle(rng, cellsOf({ w }, rect));
      grey.push(...cells.slice(0, ((rect.w * rect.h) / unit) * g));
    }
    const board = { w, h, grey: grey.sort((a, b) => a - b), parts };
    const result = solve(board);
    if (result.count >= ways[0] && result.count <= ways[1]) return board;
  }
  return null;
}

/** 회색 칸 count개를 아무 데나 칠한 판 */
function randomBoard(rng, w, h, count, parts) {
  const grey = shuffle(
    rng,
    Array.from({ length: w * h }, (_, cell) => cell),
  )
    .slice(0, count)
    .sort((a, b) => a - b);
  return { w, h, grey, parts };
}

/**
 * 안 되는 판 하나. 못 만들면 null.
 *   want 'groups'  묶음이 조각 수보다 적은 판(회색 수를 그 꼴의 수에서 조금 비켜 놓는다)
 *   want 'edge'    묶음은 넉넉한데, 끝에서 끝까지 자르는 어느 선도 두 쪽을 같은 꼴로 나누지 못하는 판
 */
export function makeImpossible(rng, { w, h, ratio, parts, want, tries = 80 }) {
  const area = w * h;
  const [g, white] = ratio;
  const even = Math.round((area * g) / (g + white));
  for (let attempt = 0; attempt < tries; attempt++) {
    let count = even;
    if (want === 'groups') {
      const near = [];
      for (let delta = -3; delta <= 3; delta++) {
        const grey = even + delta;
        if (delta !== 0 && grey >= 2 && grey <= area - 2 && gcd(grey, area - grey) < parts) near.push(grey);
      }
      if (near.length === 0) return null;
      count = pick(rng, near);
    } else if (!fits([w, h], ratio, parts)) return null;
    const board = randomBoard(rng, w, h, count, parts);
    const result = solve(board);
    if (!result.possible && result.reason === want) return board;
  }
  return null;
}

// ---- 맨 처음 판들 ----

/** 판을 줄마다 글로 적은 것(#은 회색)에서 만든다 */
export function boardFrom(rows, parts = 3) {
  const w = rows[0].length;
  const grey = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && grey.push(y * w + x)));
  return { w, h: rows.length, grey, parts };
}

/** 1단계 첫 판: 두 칸 너비의 세 띠로 자르면 된다(다른 자르기도 넷 더 있다) */
export const FIRST_BOARD = boardFrom(['##.##.', '..#...', '#.#.##']);
/** 3단계 둘째 판: 회색이 2칸뿐이다. 세 조각 모두에 회색이 있어야 하니 아주 쉬운 안 되는 판이다 */
export const MIX_SECOND = boardFrom(['......', '.#....', '....#.']);

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
  const rng = createRng(seedFrom('split', level, seed, small ? 'small' : ''));
  const done = (board) => ({ level, seed, small, board, solution: solve(board) });
  if (!small && level === 1 && seed === 1) return done(FIRST_BOARD);
  if (!small && rung.mode === 'mix' && seed === 2) return done(MIX_SECOND);
  const sizes = small ? rung.small : rung.sizes;
  const mixed = rung.mode === 'mix' || rung.mode === 'four';
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const ratio = pick(rng, rung.ratios);
    const fitting = sizes.filter((size) => fits(size, ratio, rung.parts));
    if (fitting.length === 0) continue;
    const [w, h] = pick(rng, fitting);
    let board;
    if (mixed && seed > 1 && rng() < IMPOSSIBLE_RATE) board = makeImpossible(rng, { w, h, ratio, parts: rung.parts, want: pick(rng, SHOWN_REASONS) });
    else board = makePossible(rng, { w, h, ratio, parts: rung.parts, ways: rung.ways, strips: rung.strips });
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

/** 판 전체의 꼴에 가장 가까운 쉬운 꼴(묶음이 모자라는 판의 작은 판을 만들 때 쓴다) */
const SIMPLE = [
  [1, 1],
  [1, 2],
  [1, 3],
  [2, 1],
  [3, 1],
  [2, 3],
];
export function nearRatio(board) {
  const mix = mixOf(board);
  if (mix.groups >= board.parts) return [mix.unitGrey, mix.unitWhite];
  const share = mix.grey / (mix.grey + mix.white);
  return SIMPLE.reduce((best, item) => (Math.abs(item[0] / (item[0] + item[1]) - share) < Math.abs(best[0] / (best[0] + best[1]) - share) ? item : best));
}

/**
 * 원래 판보다 작은 크기들: 가로와 세로가 원래 판을 넘지 않고, 칸 수가 원래의 4분의 3 이하이고, 그 꼴로 섞을 수 있는 크기. 큰 것부터
 */
export function smallerSizes(board, ratio) {
  const list = [];
  for (let w = MIN_SIZE; w <= board.w; w++) {
    for (let h = MIN_SIZE; h <= board.h; h++) {
      if (w * h * 4 > board.w * board.h * 3) continue;
      if (!fits([w, h], ratio, board.parts)) continue;
      list.push([w, h]);
    }
  }
  return list.sort((a, b) => b[0] * b[1] - a[0] * a[1] || b[0] - a[0]);
}

/**
 * 원래 판보다 작은 판들(차례는 src/core/smaller.js가 고른다). 조각 수와 섞인 꼴은 원래 판을 따른다.
 *   yes  더 작은 되는 판(모두 찾기 판이면 되는 자르기가 둘이나 셋인 판)
 *   no   더 작은 안 되는 판(원래 판과 같은 까닭. 모든 자르기를 따져야 아는 판에서 왔으면 끝에서 끝까지의 까닭)
 * 더 작게 만들 수 없으면 두 목록이 모두 빈다.
 * @param {{mode: string, board: object}} origin
 */
export function smallBoards(origin) {
  const { board, mode } = origin;
  const rng = createRng(seedFrom('split-smaller', mode, JSON.stringify(copyBoard(board))));
  const result = solve(board);
  const ratio = nearRatio(board);
  const lists = { yes: [], no: [] };
  const keys = new Set();
  const add = (list, item) => {
    if (!item) return;
    const key = JSON.stringify(item);
    if (keys.has(key)) return;
    keys.add(key);
    list.push(item);
  };
  const sizes = smallerSizes(board, ratio).slice(0, 3);
  const ways = mode === 'count' ? [2, 3] : [1, 4];
  const want = result.reason === 'groups' ? 'groups' : 'edge';
  for (const [w, h] of sizes) {
    for (let k = 0; k < 2 && lists.yes.length < 3; k++) add(lists.yes, makePossible(rng, { w, h, ratio, parts: board.parts, ways }));
    if (mode === 'count' || mode === 'cut') continue;
    for (let k = 0; k < 2 && lists.no.length < 3; k++) add(lists.no, makeImpossible(rng, { w, h, ratio, parts: board.parts, want }));
  }
  return lists;
}
