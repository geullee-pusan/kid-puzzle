// 접히는 모양 가리기의 사다리(단계)와 판 내기, "더 작은 판"의 재료. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 모든 판은 풀이 프로그램으로 확인한 뒤에 낸다.
// 모양은 칸 여섯(작은 판은 다섯) 모양을 모두 만들어 두고 시드 난수로 골라, 돌리거나 뒤집어 놓는다.
import { createRng, randInt, seedFrom } from './rng.js';
import { PICTURES, checkBoard, dieTurns, hasRowOfFour, isCubeNet, normalize, polyominoes, solve, transform } from './fold.js';

/**
 * 모양 하나 판에서 정육면체가 안 되는 모양의 비율. 임시값이다(셋에 하나쯤).
 * 늘 되거나 늘 안 되면 해 보지 않고 찍게 된다.
 */
export const IMPOSSIBLE_RATE = 1 / 3;

/**
 * 사다리.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   'fold'(모양 하나가 정육면체가 될까) | 'dice'(쌓은 주사위의 숨은 면) | 'many'(여럿 가운데 되는 모양 모두 고르기)
 *          | 'opposite'(접고 나면 어디로: 맞은편 칸) | 'all'(열한 가지 모두 찾기) | 'make'(직접 만들기)
 *
 * 1단계: 모양 하나. 돼요나 안 돼요를 고르면 접어 보여 준다. 첫 판은 십자 모양(된다), 둘째 판은 여섯 칸 한 줄(아주 쉬운 안 되는 판).
 *        작은 판은 다섯 칸(뚜껑 없는 상자가 될까)
 * 2단계: 주사위 두세 개(작은 판은 한두 개)를 쌓았다. 안 보이는 면의 눈을 모두 더한다.
 * 3단계: 모양 여섯 가운데 정육면체가 되는 것(둘에서 넷)을 모두 고른다. 작은 판은 셋 가운데 하나나 둘.
 * 4단계: 칸마다 그림이 있는 펼친 모양. 표시한 칸의 맞은편 칸을 고른다. 첫 판은 십자 모양. 작은 판은 네 칸이 한 줄인 모양에서 그 줄의 칸.
 * 5단계: 6×5 모눈에 여섯 칸을 놓아 정육면체가 되는 열한 가지를 모두 찾는다. 작은 판은 네 칸 한 줄이 놓인 4×3 모눈(여섯 가지).
 * 6단계: 직접 만들기.
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'fold' },
  { level: 2, tag: 'basic', mode: 'dice', counts: [2, 3], small: [1, 2] },
  { level: 3, tag: 'applied', mode: 'many', count: 6, nets: [2, 4], smallCount: 3, smallNets: [1, 2] },
  { level: 4, tag: 'applied', mode: 'opposite' },
  { level: 5, tag: 'challenge', mode: 'all', w: 6, h: 5 },
  { level: 6, tag: 'challenge', mode: 'make' },
];

export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 판 하나를 고르려고 다시 뽑아 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 200;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

const pick = (rng, list) => list[randInt(rng, 0, list.length - 1)];

function shuffled(rng, list) {
  const items = list.slice();
  for (let index = items.length - 1; index > 0; index--) {
    const other = randInt(rng, 0, index);
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

/** 모양을 아무렇게나 돌리거나 뒤집어 놓는다. 판에 눕혀 놓기 좋게 가로가 세로보다 짧지 않은 모습으로 */
function laid(rng, cells) {
  const start = randInt(rng, 0, 7);
  for (let step = 0; step < 8; step++) {
    const shape = transform(cells, (start + step) % 8);
    const w = Math.max(...shape.map((cell) => cell[0])) + 1;
    const h = Math.max(...shape.map((cell) => cell[1])) + 1;
    if (w >= h) return shape;
  }
  return transform(cells, start);
}

// ---- 모양들(한 번만 만든다) ----
let shapes = null;
function shapeLists() {
  if (!shapes) {
    const six = polyominoes(6);
    const five = polyominoes(5);
    shapes = {
      nets: six.filter(isCubeNet),
      others: six.filter((cells) => !isCubeNet(cells)),
      boxes: five.filter((cells) => solve({ kind: 'fold', cells }).possible),
      fiveOthers: five.filter((cells) => !solve({ kind: 'fold', cells }).possible),
    };
    shapes.rowNets = shapes.nets.filter(hasRowOfFour);
  }
  return shapes;
}

// ---- 맨 처음 판들 ----

/** 1단계 첫 판과 4단계 첫 판의 모양: 네 칸 한 줄에 위와 아래로 한 칸씩(십자 모양) */
export const CROSS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [3, 1],
  [1, 2],
];
/** 1단계 둘째 판: 여섯 칸 한 줄. 네 칸을 접으면 한 바퀴 돌아 처음 칸 위에 온다 */
export const LINE = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [4, 0],
  [5, 0],
];
/** 4단계 첫 판: 십자 모양, 표시한 칸은 줄의 왼쪽 끝(맞은편은 하나 건너 오른쪽 칸) */
export const FIRST_OPPOSITE = { kind: 'opposite', cells: normalize(CROSS), pictures: ['triangle', 'circle', 'square', 'heart', 'diamond', 'moon'], mark: 1 };
/** 5단계의 작은 판: 네 칸 한 줄이 놓인 4×3 모눈 */
export const ROW_BOARD = { kind: 'all', w: 4, h: 3, fixed: [[0, 1], [1, 1], [2, 1], [3, 1]] };

// ---- 판마다 ----

function makeFold(rng, wantImpossible, small) {
  const lists = shapeLists();
  const from = small ? (wantImpossible ? lists.fiveOthers : lists.boxes) : wantImpossible ? lists.others : lists.nets;
  return { kind: 'fold', cells: laid(rng, pick(rng, from)) };
}

function makeMany(rng, count, [low, high]) {
  const lists = shapeLists();
  const nets = randInt(rng, low, high);
  const chosen = [...shuffled(rng, lists.nets).slice(0, nets), ...shuffled(rng, lists.others).slice(0, count - nets)];
  return { kind: 'many', shapes: shuffled(rng, chosen).map((cells) => laid(rng, cells)) };
}

/** 네 칸이 한 줄인 곳의 칸들(차례). 없으면 빈 목록 */
export function rowCells(cells) {
  const at = (x, y) => cells.findIndex((cell) => cell[0] === x && cell[1] === y);
  for (const [x, y] of cells) {
    const across = [0, 1, 2, 3].map((step) => at(x + step, y));
    if (across.every((index) => index >= 0)) return across;
    const down = [0, 1, 2, 3].map((step) => at(x, y + step));
    if (down.every((index) => index >= 0)) return down;
  }
  return [];
}

function makeOpposite(rng, { row = false } = {}) {
  const lists = shapeLists();
  const cells = laid(rng, pick(rng, row ? lists.rowNets : lists.nets));
  const mark = row ? pick(rng, rowCells(cells)) : randInt(rng, 0, 5);
  return { kind: 'opposite', cells, pictures: shuffled(rng, PICTURES), mark };
}

function makeDice(rng, count) {
  const turns = dieTurns();
  return { kind: 'dice', dice: Array.from({ length: count }, () => pick(rng, turns).slice()) };
}

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
  const rng = createRng(seedFrom('fold', level, seed, small ? 'small' : ''));
  const done = (board) => ({ level, seed, small, board, solution: solve(board) });
  if (!small && level === 1 && seed === 1) return done({ kind: 'fold', cells: normalize(CROSS) });
  if (!small && level === 1 && seed === 2) return done({ kind: 'fold', cells: normalize(LINE) });
  if (!small && level === 4 && seed === 1) return done(FIRST_OPPOSITE);
  if (rung.mode === 'all') return done(small ? ROW_BOARD : { kind: 'all', w: rung.w, h: rung.h, fixed: [] });
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    let board;
    if (rung.mode === 'fold') board = makeFold(rng, rng() < IMPOSSIBLE_RATE, small);
    else if (rung.mode === 'dice') board = makeDice(rng, randInt(rng, ...(small ? rung.small : rung.counts)));
    else if (rung.mode === 'many') board = small ? makeMany(rng, rung.smallCount, rung.smallNets) : makeMany(rng, rung.count, rung.nets);
    else board = makeOpposite(rng, { row: small });
    if (checkBoard(board) === null) return done(board);
  }
  throw new Error(`판을 만들지 못했어요: ${level}단계 ${seed}번`);
}

const sameBoard = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 다음 판 번호. 방금 한 판과 똑같은 판이 나오는 번호는 건너뛴다(5단계는 늘 같은 모눈이라 그다음 번호다). */
export function nextSeed(level, seed, options = {}) {
  const now = generateBoard(level, seed, options).board;
  for (let next = seed + 1; next < seed + 40; next++) {
    if (!sameBoard(generateBoard(level, next, options).board, now)) return next;
  }
  return seed + 1;
}

// ---- "더 작은 판"의 재료 ----

/**
 * 원래 판보다 작은 판들(차례는 src/core/smaller.js가 고른다). yes는 되는 판, no는 안 되는 판이다(모양 하나 판만 no가 있다).
 *   모양 하나   여섯 칸이면 다섯 칸 모양(뚜껑 없는 상자가 되는 것과 안 되는 것). 다섯 칸이면 없다
 *   여럿 고르기  모양 셋(되는 것이 하나나 둘). 이미 셋 이하면 없다
 *   맞은편      네 칸이 한 줄인 모양에서 그 줄의 칸을 표시한 판. 이미 그런 판이면 없다
 *   주사위      주사위가 하나 적은 판. 하나뿐이면 없다
 *   모두 찾기   네 칸 한 줄이 놓인 4×3 모눈. 이미 놓인 칸이 있으면 없다
 * @param {{mode: string, board: object}} origin
 */
export function smallBoards(origin) {
  const { board } = origin;
  const rng = createRng(seedFrom('fold-smaller', JSON.stringify(board)));
  const lists = { yes: [], no: [] };
  const keys = new Set();
  const add = (list, item) => {
    if (!item || checkBoard(item) !== null) return;
    const key = JSON.stringify(item);
    if (keys.has(key)) return;
    keys.add(key);
    list.push(item);
  };
  const all = shapeLists();
  if (board.kind === 'fold') {
    if (board.cells.length <= 5) return lists;
    for (const cells of shuffled(rng, all.boxes).slice(0, 3)) add(lists.yes, { kind: 'fold', cells: laid(rng, cells) });
    for (const cells of shuffled(rng, all.fiveOthers).slice(0, 2)) add(lists.no, { kind: 'fold', cells: laid(rng, cells) });
    return lists;
  }
  if (board.kind === 'many') {
    if (board.shapes.length <= 3) return lists;
    for (let attempt = 0; attempt < 6 && lists.yes.length < 3; attempt++) add(lists.yes, makeMany(rng, 3, [1, 2]));
    return lists;
  }
  if (board.kind === 'opposite') {
    if (rowCells(board.cells).includes(board.mark)) return lists;
    for (let attempt = 0; attempt < 6 && lists.yes.length < 3; attempt++) add(lists.yes, makeOpposite(rng, { row: true }));
    return lists;
  }
  if (board.kind === 'dice') {
    if (board.dice.length <= 1) return lists;
    for (let attempt = 0; attempt < 6 && lists.yes.length < 3; attempt++) add(lists.yes, makeDice(rng, board.dice.length - 1));
    return lists;
  }
  if (board.fixed.length > 0) return lists;
  add(lists.yes, ROW_BOARD);
  return lists;
}
