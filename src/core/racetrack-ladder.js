// 모눈 자동차 경주의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 길의 꼴(곧은 길, ㄱ자 길, ㄷ자 길, ㄹ자 길)과 크기, 돌리고 뒤집기,
// 출발 칸, 깃발 칸을 시드 난수(rng.js)로 고르고, 풀이 프로그램이 잣대에 맞는다고 확인한 판만 낸다.
//
// 고르는 잣대
//   - 결승선까지 갈 수 있다(모든 사다리 판). 가장 적은 움직임 수가 단계마다 정한 범위 안
//   - 화면에 그릴 둘레(결승선 너머의 점까지)가 가로 VIEW_W칸, 세로 VIEW_H칸 안(1180×820 화면에서 점 사이가 44픽셀보다 넓게)
//   - 모퉁이가 있는 길: 아홉 점 모두 벽에 닿는 자리가 있다(모퉁이 앞에서 속도를 줄이지 않으면 막힌다)
//   - 깃발 단계: 깃발 칸을 들르면 들르지 않을 때보다 더 움직여야 한다(돌아가야 한다)
// 모든 사다리 판은 결승선까지 갈 수 있다. 갈 수 없는 판은 직접 만들기에서만 나온다(선생님이 모든 길을 따져 보았다고 말한다).
import { checkBoard, copyBoard, finishCells, flagCosts, sameBoard, solve } from './racetrack.js';
import { createRng, randInt, seedFrom } from './rng.js';

/** 화면에 그릴 둘레의 위 끝(칸). 판 칸이 가로 476픽셀, 세로 432픽셀쯤이라 점 사이가 44픽셀보다 넓다 */
export const VIEW_W = 10;
export const VIEW_H = 9;

/**
 * 사다리.
 *   tag   'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode  'straight'(곧은 길) | 'corner'(모퉁이 하나) | 'fewest'(가장 적게) | 'flag'(깃발 들르기) | 'big'(구불구불한 길) | 'make'(직접 만든다)
 *   shapes 길의 꼴 후보, least·most 가장 적은 움직임 수의 범위
 *   record  true면 결승선을 넘어도 가장 적은 수가 아니면 끝나지 않고 "더 적은 수로 갈 수 있을까요?"를 묻는다(기록 깨기)
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'straight', shapes: ['straight'], least: 3, most: 4 },
  { level: 2, tag: 'basic', mode: 'corner', shapes: ['ell'], least: 5, most: 7 },
  { level: 3, tag: 'applied', mode: 'fewest', record: true, shapes: ['ell', 'you'], least: 6, most: 9 },
  { level: 4, tag: 'applied', mode: 'flag', record: true, shapes: ['ell', 'you'], least: 7, most: 11 },
  { level: 5, tag: 'challenge', mode: 'big', record: true, shapes: ['ess'], least: 9, most: 12 },
  { level: 6, tag: 'challenge', mode: 'make' },
];

export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 가장 적게 가는 판인가(결승선을 넘어도 가장 적은 수가 아니면 더 적게 해 볼지 묻는다). 직접 만든 판도 그렇다 */
export const recordMode = (mode) => mode === 'fewest' || mode === 'flag' || mode === 'big' || mode === 'made';

/** 판 하나를 만들려고 다시 뽑아 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 400;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

// ---- 길의 꼴: 길 칸을 채운 네모들로 만든다 ----

function blank(w, h) {
  return Array.from({ length: h }, () => new Array(w).fill('#'));
}
function fillRect(grid, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y][x] = '.';
}
const rowsOf = (grid) => grid.map((row) => row.join(''));

/**
 * 꼴마다 판(처음 놓인 모습). 결승선은 늘 판의 오른쪽 변이나 위 변에 두고, 돌리고 뒤집기는 transform이 한다.
 * 크기 값은 rng로 고른다.
 */
const SHAPES = {
  /** 곧은 길: 가로 len칸, 세로 wide칸. 왼쪽 끝에서 출발해 오른쪽 변의 결승선으로 */
  straight(rng, { small }) {
    const len = small ? 5 : randInt(rng, 6, 7);
    const wide = randInt(rng, 2, 3);
    const grid = blank(len, wide);
    fillRect(grid, 0, 0, len - 1, wide - 1);
    return { rows: rowsOf(grid), start: [0, randInt(rng, 0, wide - 1)], finish: { side: 'right', from: 0, to: wide - 1 }, flags: [] };
  },
  /** ㄱ자 길: 아래쪽 가로 길(왼쪽에서 출발)과 오른쪽 세로 길(위 변의 결승선) */
  ell(rng, { small }) {
    const w = small ? randInt(rng, 5, 6) : randInt(rng, 6, 8);
    const h = small ? randInt(rng, 4, 5) : randInt(rng, 5, 6);
    const across = randInt(rng, 2, 3);
    const up = randInt(rng, 2, 3);
    const grid = blank(w, h);
    fillRect(grid, 0, h - across, w - 1, h - 1);
    fillRect(grid, w - up, 0, w - 1, h - 1);
    return { rows: rowsOf(grid), start: [0, h - 1 - randInt(rng, 0, across - 1)], finish: { side: 'top', from: w - up, to: w - 1 }, flags: [] };
  },
  /** ㄷ자 길(뒤집은 ㄷ): 왼쪽 세로 길의 위에서 출발해 아래 가로 길을 지나 오른쪽 세로 길의 위 변 결승선으로 */
  you(rng, { small }) {
    const arm = randInt(rng, 2, 3);
    const gap = randInt(rng, 1, 2);
    const w = 2 * arm + gap;
    const h = small ? randInt(rng, 4, 5) : randInt(rng, 5, 6);
    const bottom = randInt(rng, 2, 3);
    const grid = blank(w, h);
    fillRect(grid, 0, 0, arm - 1, h - 1);
    fillRect(grid, 0, h - bottom, w - 1, h - 1);
    fillRect(grid, w - arm, 0, w - 1, h - 1);
    return { rows: rowsOf(grid), start: [randInt(rng, 0, arm - 1), 0], finish: { side: 'top', from: w - arm, to: w - 1 }, flags: [] };
  },
  /**
   * ㄹ자 길: 가로 길 셋을 벽 둘이 가른다. 아래 길의 왼쪽에서 출발해, 오른쪽 틈으로 가운데 길, 왼쪽 틈으로 위 길에 올라
   * 위 길의 오른쪽 끝(오른쪽 변의 결승선)으로 간다. 길의 너비(2~3칸)와 틈의 너비(2~3칸)를 고른다
   */
  ess(rng) {
    const w = randInt(rng, 6, 7);
    const lanes = [2, 2, 2];
    const h = lanes[0] + lanes[1] + lanes[2] + 2;
    const right = randInt(rng, 2, 3);
    const left = randInt(rng, 2, 3);
    const grid = blank(w, h);
    fillRect(grid, 0, 0, w - 1, h - 1);
    const top = lanes[2];
    const middle = top + 1 + lanes[1];
    // 위 길과 가운데 길 사이의 벽(왼쪽에 틈), 가운데 길과 아래 길 사이의 벽(오른쪽에 틈)
    for (let x = left; x < w; x++) grid[top][x] = '#';
    for (let x = 0; x < w - right; x++) grid[middle][x] = '#';
    return { rows: rowsOf(grid), start: [0, h - 1 - randInt(rng, 0, lanes[0] - 1)], finish: { side: 'right', from: 0, to: top - 1 }, flags: [] };
  },
};
/** 꼴 하나를 만든다(테스트와 작은 판이 쓴다) */
export const shapeBoard = (name, rng, options = {}) => SHAPES[name](rng, options);

/**
 * 돌리고 뒤집기(0~7). 1이 켜져 있으면 가로세로를 바꾸고(대각선으로 뒤집기), 2는 좌우, 4는 위아래로 뒤집는다.
 */
export function transform(board, turn) {
  let rows = board.rows.map((row) => [...row]);
  let start = board.start.slice();
  let flags = board.flags.map((cell) => cell.slice());
  let { side, from, to } = board.finish;
  if (turn & 1) {
    rows = rows[0].map((_, x) => rows.map((row) => row[x]));
    start = [start[1], start[0]];
    flags = flags.map(([c, r]) => [r, c]);
    side = { top: 'left', left: 'top', bottom: 'right', right: 'bottom' }[side];
  }
  const w = rows[0].length;
  const h = rows.length;
  if (turn & 2) {
    rows = rows.map((row) => row.slice().reverse());
    start = [w - 1 - start[0], start[1]];
    flags = flags.map(([c, r]) => [w - 1 - c, r]);
    if (side === 'left' || side === 'right') side = side === 'left' ? 'right' : 'left';
    else [from, to] = [w - 1 - to, w - 1 - from];
  }
  if (turn & 4) {
    rows = rows.slice().reverse();
    start = [start[0], h - 1 - start[1]];
    flags = flags.map(([c, r]) => [c, h - 1 - r]);
    if (side === 'top' || side === 'bottom') side = side === 'top' ? 'bottom' : 'top';
    else [from, to] = [h - 1 - to, h - 1 - from];
  }
  return { rows: rows.map((row) => row.join('')), start, finish: { side, from, to }, flags };
}

/** 풀이와 화면에 그릴 둘레 */
export const viewSize = (extent) => ({ w: extent.x1 - extent.x0 + 1, h: extent.y1 - extent.y0 + 1 });
export const fitsView = (extent) => viewSize(extent).w <= VIEW_W && viewSize(extent).h <= VIEW_H;

/** 판이 그 단계의 잣대에 맞는가. 맞으면 풀이를, 아니면 null */
export function judge(rung, board, { small = false } = {}) {
  if (checkBoard(board) !== null) return null;
  const solution = solve(board);
  if (!solution.possible || !fitsView(solution.extent)) return null;
  const least = small ? 2 : rung.least;
  const most = small ? rung.least : rung.most;
  if (solution.fewest < least || solution.fewest > most) return null;
  if (rung.mode !== 'straight' && solution.stuck === 0) return null;
  if (rung.mode === 'flag') {
    const plain = solve({ ...board, flags: [] });
    if (solution.fewest < plain.fewest + 1) return null;
  }
  return solution;
}

/**
 * 깃발 칸을 하나 고른다: 들르면 들르지 않을 때보다 더 움직여야 하고, 가장 적은 수가 least~most인 칸 가운데 아무것이나.
 * 출발 칸과 결승선 칸은 뺀다. 그런 칸이 없으면 null
 */
function withFlag(rng, board, least, most) {
  const plain = solve(board);
  if (!plain.possible) return null;
  const costs = flagCosts(board);
  const finish = new Set(finishCells(board).map(String));
  const choices = [];
  board.rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch !== '.' || (c === board.start[0] && r === board.start[1]) || finish.has(`${c},${r}`)) return;
      const cost = costs.get(`${c},${r}`);
      if (cost !== undefined && cost >= plain.fewest + 1 && cost >= least && cost <= most) choices.push([c, r]);
    }),
  );
  if (choices.length === 0) return null;
  return { ...board, flags: [choices[randInt(rng, 0, choices.length - 1)]] };
}

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed, { small = false } = {}) {
  const rng = createRng(seedFrom('racetrack', rung.level, seed, small ? 'small' : ''));
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const shape = rung.shapes[randInt(rng, 0, rung.shapes.length - 1)];
    let board = transform(SHAPES[shape](rng, { small }), randInt(rng, 0, 7));
    if (rung.mode === 'flag') board = withFlag(rng, board, small ? 2 : rung.least, small ? rung.least : rung.most);
    if (!board) continue;
    const solution = judge(rung, board, { small });
    if (solution) return { board, solution };
  }
  throw new Error(`판을 만들지 못했어요: ${rung.level}단계 ${seed}번`);
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(짧은 곧은 길)을 낸다(수준 맞추기에서 쓴다)
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  const { board, solution } = boardAt(rung, seed, { small: shrink });
  return { level, seed, small: shrink, board, solution: { possible: true, fewest: solution.fewest } };
}

/** 다음 판 번호. 방금 한 판과 같은 판이 나오는 번호는 건너뛴다 */
export function nextSeed(level, seed) {
  const rung = rungOf(level);
  if (rung.mode === 'make') return seed + 1;
  const before = boardAt(rung, seed).board;
  let next = seed + 1;
  while (sameBoard(boardAt(rung, next).board, before)) next += 1;
  return next;
}

/**
 * 더 작은 판들: 같은 종류(같은 단계의 꼴)로 크기가 작은 판. 가장 적은 움직임 수가 2 이상이고 원래 판보다 적은 판을 둘까지 만든다.
 * 깃발 판은 깃발이 있는 작은 판이다. 같은 판에는 늘 같은 판들이 나온다. 직접 만든 판은 가장 적게 가는 판(3단계)의 작은 판을 낸다.
 * @param {object} origin { mode, board }
 * @returns {object[]}
 */
export function smallBoards(origin) {
  const { board } = origin;
  if (checkBoard(board) !== null) return [];
  const top = solve(board).fewest;
  if (top === null || top <= 3) return [];
  const level = origin.mode === 'made' ? 3 : LADDER.find((rung) => rung.mode === origin.mode)?.level;
  if (!level) return [];
  const rung = rungOf(level);
  const rng = createRng(seedFrom('racetrack-small', JSON.stringify(copyBoard(board)), origin.mode));
  const shapes = rung.mode === 'big' ? ['ell', 'you'] : rung.shapes;
  const found = [];
  for (let attempt = 0; attempt < MAX_TRIES && found.length < 2; attempt++) {
    const shape = shapes[randInt(rng, 0, shapes.length - 1)];
    let small = transform(SHAPES[shape](rng, { small: true }), randInt(rng, 0, 7));
    if (rung.mode === 'flag') small = withFlag(rng, small, 3, top - 1);
    if (!small || checkBoard(small) !== null || found.some((item) => sameBoard(item, small))) continue;
    const solution = solve(small);
    if (!solution.possible || !fitsView(solution.extent) || solution.fewest < 2 || solution.fewest >= top) continue;
    if (rung.mode !== 'straight' && solution.stuck === 0) continue;
    if (rung.mode === 'flag' && solution.fewest < solve({ ...small, flags: [] }).fewest + 1) continue;
    found.push(small);
  }
  return found;
}

/** 직접 만들기의 처음 판과 크기의 범위 */
export const MAKE_W = { low: 4, high: 9, first: 8 };
export const MAKE_H = { low: 3, high: 8, first: 6 };

