// 세모 피하기의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 풀이 프로그램으로 푼 판만 내보낸다.
import { createRng, randInt, seedFrom } from './rng.js';
import { checkBoard, emptyBoard, lineOf, paintings, solve, tableOf } from './sim.js';

/**
 * 사다리.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'game'(선생님과 번갈아 긋기) | 'paint'(혼자 다 칠하기) | 'make'(아이가 직접 만든다)
 *   n       점의 수. small 수준 맞추기가 "작은 판부터"라고 할 때 내는 판의 점의 수
 *   order   게임에서 아이가 먼저 두는가: 'first'(늘 먼저) | 'choose'(두기 전에 고른다)
 *   teacher 선생님이 두는 법(src/core/sim.js의 pickMove)
 *   hint    힌트와 처음 화면의 물음을 고르는 이름
 *
 * 1단계 다섯 점에서 두기: 아이가 먼저 두고, 선생님은 자기 세모만 피한다. 둘 다 잘 두면 비기는 판이다(풀이 프로그램).
 * 2단계 세모 없이 다 칠하기: 다섯 점의 선 열 개를 혼자 두 색으로 칠한다. 첫 판은 빈 판(되는 판)이다.
 *   그다음은 되는 판, 안 되는 판, 되는 판의 차례다(셋에 하나가 안 되는 판).
 *   되는 판은 세모 없는 칠하기 하나에서 선 몇 개를 미리 칠해 둔다. 안 되는 판은 한 점에서 같은 색 선 셋을 미리 칠해 둔다
 *   (그 끝 세 점 사이를 어떻게 칠해도 한 색 세모가 생긴다. 아이가 볼 수 있는 까닭이다).
 * 3단계 여섯 점, 먼저 둘까 나중에 둘까: 두기 전에 고른다. 선생님은 남은 선이 여섯 개 이하가 되면 잘 둔다.
 * 4단계 잘 두는 선생님: 고르기는 3단계와 같다. 선생님은 늘 잘 둔다(질 자리에서는 자기 세모만 피한다).
 * 5단계 여섯 점을 다 칠하기: 첫 판은 빈 여섯 점(안 되는 판. 한 점에서 나가는 선 다섯 가운데 셋은 같은 색이다).
 *   그다음은 선 하나가 없는 판(되는 판), 안 되는 판, 선 하나가 없는 판의 차례다.
 *   안 되는 판은 미리 칠해 둔 선이 있는 여섯 점, 또는 선 하나가 없고 한 점에서 같은 색 선 셋을 미리 칠해 둔 판이다.
 * 6단계 직접 만들기: 점의 수를 정하고 선을 미리 그어 두면, 선생님이 둘 다 잘 두면 어떻게 끝나는지 알려 준다.
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'game', n: 5, small: 4, order: 'first', teacher: 'easy', hint: 'five' },
  { level: 2, tag: 'basic', mode: 'paint', n: 5, small: 4, hint: 'paint' },
  { level: 3, tag: 'applied', mode: 'game', n: 6, small: 5, order: 'choose', teacher: 'fair', hint: 'choose' },
  { level: 4, tag: 'applied', mode: 'game', n: 6, small: 5, order: 'choose', teacher: 'best', hint: 'choose' },
  { level: 5, tag: 'challenge', mode: 'paint', n: 6, small: 5, hint: 'six' },
  { level: 6, tag: 'challenge', mode: 'make', order: 'choose', teacher: 'best', hint: 'choose' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 칠하기 판의 차례(판 번호 2부터 돈다): open 되는 판, closed 안 되는 판 */
export const PAINT_CYCLE = ['open', 'closed', 'open'];

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 이 단계에서 선생님이 두는 법. 직접 만든 판은 늘 잘 둔다 */
export const teacherOf = (level, custom) => (custom ? 'best' : (LADDER.find((item) => item.level === level)?.teacher ?? 'best'));

/** 판의 풀이 */
export const solutionOf = (board) => solve(board);

const sortLines = (list) => list.slice().sort((a, b) => a - b);

/** 칠한 모습(선마다 1, 2) 가운데 count개를 골라 미리 칠해 둔 선으로 삼는다 */
function revealSome(board, colors, count, rng) {
  const lines = colors.map((color, line) => (color === 1 || color === 2 ? line : -1)).filter((line) => line >= 0);
  const red = [];
  const blue = [];
  for (let left = count; left > 0 && lines.length > 0; left--) {
    const [line] = lines.splice(randInt(rng, 0, lines.length - 1), 1);
    (colors[line] === 1 ? red : blue).push(line);
  }
  return { ...board, red: sortLines(red), blue: sortLines(blue) };
}

/** 점이 n개인 판에서 한 점(point)과 다른 세 점(ends)을 같은 색으로 이은 선 셋 */
function spokes(n, point, ends) {
  return ends.map((end) => lineOf(n, point, end));
}

/** 서로 다른 점 k개를 고른다(gone이 있으면 그 두 점을 함께 고르지 않는다) */
function pickPoints(n, k, rng, avoid = null) {
  for (;;) {
    const pool = Array.from({ length: n }, (_, point) => point);
    const picked = [];
    while (picked.length < k) picked.push(pool.splice(randInt(rng, 0, pool.length - 1), 1)[0]);
    if (!avoid || !(picked.includes(avoid[0]) && picked.includes(avoid[1]))) return picked;
  }
}

/** 안 되는 판: 한 점에서 같은 색 선 셋. 미리 칠해 둔 선이 하나 더 있을 수도 있다(한 색 세모를 만들지 않는 선) */
function closedBoard(base, rng) {
  const { n } = base;
  const gonePair = base.gone.length > 0 ? tableOf(n).lines[base.gone[0]] : null;
  for (;;) {
    const [point, ...rest] = pickPoints(n, 4, rng, gonePair);
    // 고른 점에서 세 점으로 가는 선이 모두 있어야 하고, 세 점 사이의 선도 모두 있어야 한다(gone을 피했으니 있다).
    const ends = rest.sort((a, b) => a - b);
    const lines = spokes(n, point, ends);
    if (lines.some((line) => base.gone.includes(line))) continue;
    const color = randInt(rng, 0, 1) === 0 ? 'red' : 'blue';
    const board = { ...base, red: color === 'red' ? sortLines(lines) : [], blue: color === 'blue' ? sortLines(lines) : [] };
    if (randInt(rng, 0, 1) === 1) {
      const free = Array.from({ length: tableOf(n).lines.length }, (_, line) => line).filter((line) => !board.gone.includes(line) && !lines.includes(line));
      const extra = free[randInt(rng, 0, free.length - 1)];
      const other = color === 'red' ? 'blue' : 'red';
      const more = { ...board, [other]: sortLines([...board[other], extra]) };
      if (checkBoard(more) === null) return more;
    }
    if (checkBoard(board) === null) return board;
  }
}

/** 미리 칠해 둔 선이 count개 있는 여섯 점 판(한 색 세모가 없게) */
function sixWithLines(count, rng) {
  for (;;) {
    const base = emptyBoard('paint', 6);
    const colors = Array(15).fill(0).map(() => randInt(rng, 1, 2));
    const board = revealSome(base, colors, count, rng);
    if (checkBoard(board) === null) return board;
  }
}

/** 칠하기 판 하나 */
function paintBoard(rung, seed) {
  const rng = createRng(seedFrom('sim-board', rung.level, seed));
  const n = rung.n;
  if (seed === 1) return emptyBoard('paint', n);
  const kind = PAINT_CYCLE[(seed - 2) % PAINT_CYCLE.length];
  if (n === 5) {
    const base = emptyBoard('paint', 5);
    if (kind === 'closed') return closedBoard(base, rng);
    const all = paintings(base);
    return revealSome(base, all[randInt(rng, 0, all.length - 1)], randInt(rng, 1, 3), rng);
  }
  // 여섯 점: 되는 판은 이웃한 두 점 사이의 선 하나가 없는 판이다.
  const k = randInt(rng, 0, 5);
  const gone = { ...emptyBoard('paint', 6), gone: [lineOf(6, k, (k + 1) % 6)].sort((a, b) => a - b) };
  if (kind === 'closed') return Math.floor((seed - 2) / PAINT_CYCLE.length) % 2 === 0 ? sixWithLines(randInt(rng, 1, 3), rng) : closedBoard(gone, rng);
  const all = paintings(gone);
  return revealSome(gone, all[randInt(rng, 0, all.length - 1)], randInt(rng, 0, 3), rng);
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 그 단계의 작은 판을 낸다(수준 맞추기에서 쓴다. 점이 하나 적은 빈 판)
 * @returns {{level, seed, small, board, solution}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  const board = small ? emptyBoard(rung.mode, rung.small) : rung.mode === 'game' ? emptyBoard('game', rung.n) : paintBoard(rung, seed);
  if (checkBoard(board) !== null) throw new Error(`쓸 수 없는 판이에요: ${JSON.stringify(board)}`);
  return { level, seed, small, board, solution: solutionOf(board) };
}

const sameBoard = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 다음 판 번호. 방금 한 판과 똑같은 판이 나오는 번호는 건너뛴다(게임 판은 늘 같은 빈 판이라 다음 번호다). */
export function nextSeed(level, seed, options = {}) {
  const now = generateBoard(level, seed, options).board;
  for (let next = seed + 1; next < seed + 40; next++) {
    if (!sameBoard(generateBoard(level, next, options).board, now)) return next;
  }
  return seed + 1;
}
