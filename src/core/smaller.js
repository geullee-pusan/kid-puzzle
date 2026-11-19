// "더 작은 판": 하던 판과 규칙이 같고 눈에 띄게 작은 판을 내준다. 순수 함수만 둔다.
// 형식마다 함수가 하나씩 있다. (원래 판, 몇 번째로 여는 작은 판인지) → { board } 또는 null(더 작은 판이 없다).
//   원래 판(origin): { mode, board }. mode는 그 판의 종류(형식이 정한 것), board는 판의 처음 모습
//   차례(turn): 0부터. 같은 원래 판, 같은 차례에는 늘 같은 판이 나온다
// 지키는 것:
//   - 풀이 프로그램으로 확인한 판만 낸다.
//   - 원래 판이 되는 판이면 되는 판만 낸다. 원래 판이 안 되는 판이면 되는 판부터, 안 되는 판과 번갈아 낸다.
//     (안 되는 판부터 내면 첫 작은 판만 보고도 원래 판이 안 되는 판인 줄 알게 된다. 그래서 첫 판은 늘 되는 판이다.)
//   - 한 번에 끝나는 판은 피한다. 더 줄일 수 없으면 가장 작은 뜻 있는 판을 낸다.
//   - 원래 판이 이미 가장 작은 판이면 null을 낸다.
import { allPlacements as blockSpots, checkBoard as checkBlock, solve as solveBlock } from './block.js';
import { allCodes, checkBoard as checkCode, solveTable } from './code.js';
import { makeTable } from './code-ladder.js';
import { RULES, checkBoard as checkCoins, fromMask, headCount, solve as solveCoins } from './coins.js';
import { placeDown, solveOnce as solveCups } from './cups-ladder.js';
import { RANGES as CUP_RANGES, checkBoard as checkCups, downCount } from './cups.js';
import { checkBoard as checkDuel, smallBoards } from './duel.js';
import { boxBoards, smallFolkBoards } from './logic-ladder.js';
import { checkBoard as checkLogic, solve as solveLogic } from './logic.js';
import { createRng, randInt, seedFrom } from './rng.js';
import { solveOnce as solveRiver } from './river-ladder.js';
import { castOf as castOfRiver, checkBoard as checkRiver } from './river.js';
import { checkBoard as checkSwap, solve as solveSwap } from './swap.js';
import { cardsUpTo, checkBoard as checkTax, plainN } from './tax.js';
import { MIN_SIZE, checkBoard as checkTile, deadCells, solve as solveTile, xyOf } from './tile.js';
import { randomFigure, tooPlain } from './trace-ladder.js';
import { checkFigure, fixesOf, solve as solveTrace } from './trace.js';

/** 한 판을 고르려고 다시 뽑아 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다). */
const MAX_TRIES = 3000;

function shuffled(rng, list) {
  const items = list.slice();
  for (let index = items.length - 1; index > 0; index--) {
    const other = randInt(rng, 0, index);
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

/**
 * 되는 판의 목록(yes)과 안 되는 판의 목록(no)에서 이번 차례의 판을 고른다.
 * 원래 판이 되는 판이면 되는 판만 차례로 낸다. 안 되는 판이면 되는 판부터, 안 되는 판과 번갈아 낸다.
 * 첫 작은 판은 원래 판이 되든 안 되든 되는 판이다. 첫 판만 보고 원래 판의 답을 알 수 없게 하려는 것이다.
 * 한쪽 목록이 비어 있으면 다른 쪽만 차례로 낸다. 되는 판에서 안 되는 판만 남으면 내지 않는다.
 */
export function pickByTurn(lists, originPossible, turn) {
  const { yes, no } = lists;
  if (originPossible) return yes.length > 0 ? yes[turn % yes.length] : null;
  if (no.length === 0) return yes.length > 0 ? yes[turn % yes.length] : null;
  if (yes.length === 0) return no[turn % no.length];
  const at = Math.floor(turn / 2);
  return turn % 2 === 0 ? yes[at % yes.length] : no[at % no.length];
}

// ---- 동전 뒤집기: 같은 뒤집는 규칙과 모양, 동전을 둘 줄인 판 ----

/** 규칙마다 작은 판의 동전 수의 아래 끝. 이보다 적으면 한 번에 끝나는 판뿐이다 */
export const COIN_FLOOR = { any2: 3, any3: 4, adj3: 4 };

/** 동전이 n개인 판을 모두 풀어서 되는 판과 안 되는 판으로 가른다. 뻔하지 않은 판을 앞에 둔다. */
function coinLists(origin, n) {
  const { shape, rule } = origin.board;
  const rng = createRng(seedFrom('coins-smaller', JSON.stringify(origin.board), n));
  const groups = { yes: { good: [], plain: [] }, no: { good: [], plain: [] } };
  for (let mask = 1; mask < 1 << n; mask++) {
    const board = { n, shape, rule, coins: fromMask(mask, n) };
    const solution = solveCoins(board);
    const heads = headCount(board.coins);
    // 뻔한 판: 한 번에 끝나는 되는 판, 앞면이 하나뿐인 안 되는 판
    const good = solution.possible ? solution.min >= 2 : heads >= 2;
    groups[solution.possible ? 'yes' : 'no'][good ? 'good' : 'plain'].push(board);
  }
  const allHeads = origin.board.coins.every((coin) => coin === 1);
  const order = ({ good, plain }) => {
    const list = [...shuffled(rng, good), ...(good.length < 2 ? shuffled(rng, plain) : [])];
    // 모두 앞면인 판에서 왔으면 모두 앞면인 판을 맨 앞에 둔다.
    if (!allHeads) return list;
    const full = list.findIndex((board) => headCount(board.coins) === n);
    return full > 0 ? [list[full], ...list.slice(0, full), ...list.slice(full + 1)] : list;
  };
  return { yes: order(groups.yes), no: order(groups.no) };
}

export function smallerCoins(origin, turn = 0) {
  const { board } = origin;
  if (checkCoins(board) !== null) return null;
  const n = Math.max(board.n - 2, COIN_FLOOR[board.rule]);
  if (n >= board.n) return null;
  const possible = solveCoins(board).possible;
  const lists = coinLists(origin, n);
  // 안 되는 판에서 왔는데 그 크기에 안 되는 판이 없으면(작은 고리), 안 되는 판이 있는 더 작은 크기에서 찾는다.
  for (let size = n - 1; !possible && lists.no.length === 0 && size >= RULES[board.rule].count; size--) lists.no = coinLists(origin, size).no;
  const small = pickByTurn(lists, possible, turn);
  return small ? { board: small } : null;
}

// ---- 한붓그리기: 점이 넷이나 다섯인 그림. 시작점 고르기와 고치기는 같은 물음의 작은 그림 ----

export const TRACE_COUNTS = [4, 5];
const TRACE_GRID = [3, 3];
const TRACE_EXTRA = [1, 3];

function smallFigure(rng, counts, accept) {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const figure = randomFigure(rng, counts[randInt(rng, 0, counts.length - 1)], TRACE_GRID, TRACE_EXTRA);
    if (!figure || tooPlain(figure)) continue;
    if (accept(figure, solveTrace(figure))) return figure;
  }
  return null;
}

export function smallerTrace(origin, turn = 0) {
  const { board, mode } = origin;
  if (checkFigure(board) !== null) return null;
  const counts = TRACE_COUNTS.filter((count) => count < board.points.length);
  if (counts.length === 0) return null;
  const rngOf = (kind) => createRng(seedFrom('trace-smaller', mode, kind, JSON.stringify(board), turn));
  // 시작점 고르기: 시작할 수 있는 점이 꼭 둘인 그림. 고치기: 한 군데 고쳐서 되는 그림이 되는 안 되는 그림
  if (mode === 'start') return wrap(smallFigure(rngOf('start'), counts, (_, solution) => solution.possible && solution.starts.length === 2));
  if (mode === 'fix') return wrap(smallFigure(rngOf('fix'), counts, (figure, solution) => !solution.possible && fixesOf(figure).length > 0));
  const possible = solveTrace(board).possible;
  const want = possible || turn % 2 === 1;
  const found = smallFigure(rngOf(want ? 'yes' : 'no'), counts, (_, solution) => solution.possible === want);
  // 점이 넷인 그림에는 뻔하지 않은 안 되는 그림이 없다. 그때는 되는 그림을 낸다.
  return wrap(found ?? smallFigure(rngOf('yes'), counts, (_, solution) => solution.possible));
}

const wrap = (board) => (board ? { board } : null);

// ---- 숫자 추리: 숫자 1~4로 만든 두 자리 암호. 표만 보고 알아내기는 두 자리 표, 역할 바꾸기는 두 자리 ----

export const SMALL_CODE = { length: 2, digits: '1234', rows: [2, 3] };

export function smallerCode(origin, turn = 0) {
  const { board } = origin;
  if (checkCode(board) !== null) return null;
  const { length, digits, rows } = SMALL_CODE;
  if (board.length <= length) return null;
  const { mode } = board;
  if (mode === 'referee') return { board: { mode, length, digits } };
  if (mode === 'guess') {
    // 암호는 원래 판마다 정해 둔 차례로 돈다. 그래서 이어서 여는 두 판의 암호는 늘 다르다.
    const secrets = shuffled(createRng(seedFrom('code-smaller', JSON.stringify(board))), allCodes(length, digits));
    return { board: { mode, length, digits, secret: secrets[turn % secrets.length] } };
  }
  const rng = createRng(seedFrom('code-smaller', JSON.stringify(board), turn));
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const made = makeTable(rng, length, digits, rows);
    if (!made) continue;
    // 풀이 프로그램으로 다시 확인한다: 모든 후보를 따져서 답이 꼭 하나다.
    const solved = solveTable(length, digits, made.rows);
    if (solved.count === 1 && solved.secret === made.secret) return { board: { mode, length, digits, rows: made.rows } };
  }
  return null;
}

// ---- 자리 바꾸기: 개구리는 양쪽에서 한 마리씩 줄인 판, 짝 짓기는 돌을 둘씩 줄인 판 ----

export function smallerSwap(origin, turn = 0) {
  const { board } = origin;
  if (checkSwap(board) !== null) return null;
  if (board.kind === 'frogs') {
    const left = Math.max(1, board.left - 1);
    const right = Math.max(1, board.right - 1);
    if (left === board.left && right === board.right) return null;
    // 양쪽 수가 다른 판은 한 번씩 좌우를 뒤집어 낸다.
    return { board: turn % 2 === 1 ? { kind: 'frogs', left: right, right: left } : { kind: 'frogs', left, right } };
  }
  // 짝 짓기: 돌이 건너뛸 수 있는 가장 작은 판(건너뛰는 수 + 2개)까지만 줄인다.
  const { skip } = board;
  const possible = solveSwap(board).possible;
  const lists = { yes: [], no: [] };
  for (let n = board.n - 1; n >= skip + 2; n--) {
    const small = { kind: 'pairs', n, skip };
    const works = solveSwap(small).possible;
    // 같은 쪽(되는 판이면 되는 판)은 돌을 둘씩 줄인 판만, 안 되는 판에서 견줘 볼 되는 판은 더 작은 판이면 어느 것이나
    if (works === possible ? (board.n - n) % 2 === 0 : works) lists[works ? 'yes' : 'no'].push(small);
  }
  return wrap(pickByTurn(lists, possible, turn));
}

// ---- 조각 덮기: 같은 조각, 한 단 작은 판. 뺀 칸은 원래 판과 닮은 자리 ----

/** 한 변의 칸 수를 한 단 줄인다(8 → 5 → 4, 7 → 4, 6 → 4). 4칸과 3칸은 그대로다 */
export const TILE_DOWN = { 8: 5, 7: 4, 6: 4, 5: 4 };
/** 뺀 칸이 이보다 많은 판(직접 만든 판)은 작은 판을 내지 않는다. 따질 판이 너무 많아진다 */
const TILE_MAX_HOLES = 2;

function downSize(piece, w, h) {
  const next = [TILE_DOWN[w] ?? w, TILE_DOWN[h] ?? h];
  if (next[0] !== w || next[1] !== h) return next;
  // 도미노는 4×4에서 한 줄을 더 줄인다(4×3). 세 칸 조각은 4×4가 가장 작은 판이다.
  if (piece === 'domino' && w === 4 && h === 4) return [4, MIN_SIZE];
  return null;
}

/** 그 크기에서 칸을 count개 뺀 판을 모두 풀어서 되는 판과 안 되는 판으로 가른다. 한 번 구한 것은 적어 둔다. */
const tileMemo = new Map();
function tileLists(piece, w, h, count) {
  const key = `${piece}-${w}-${h}-${count}`;
  if (tileMemo.has(key)) return tileMemo.get(key);
  const lists = { yes: [], no: [] };
  const dead = [];
  const visit = (holes, from) => {
    if (holes.length === count) {
      const board = { w, h, piece, holes };
      const { possible } = solveTile(board);
      if (possible === true) lists.yes.push(holes);
      // 처음부터 조각이 들어갈 수 없는 빈칸이 보이는 판은 뒤로 미룬다(해 보지 않아도 알 수 있어서).
      else if (possible === false) (deadCells(board).length > 0 ? dead : lists.no).push(holes);
      return;
    }
    for (let cell = from; cell < w * h; cell++) visit([...holes, cell], cell + 1);
  };
  visit([], 0);
  if (lists.no.length === 0) lists.no = dead;
  tileMemo.set(key, lists);
  return lists;
}

/** 뺀 칸들이 원래 판의 뺀 칸(작은 판의 자리로 옮긴 것)에서 얼마나 떨어져 있는가 */
function holeDistance(shell, holes, targets) {
  const gap = (hole, [tx, ty]) => {
    const [x, y] = xyOf(shell, hole);
    return Math.hypot(x - tx, y - ty);
  };
  if (holes.length === 0) return 0;
  if (holes.length === 1) return gap(holes[0], targets[0]);
  return Math.min(gap(holes[0], targets[0]) + gap(holes[1], targets[1]), gap(holes[0], targets[1]) + gap(holes[1], targets[0]));
}

export function smallerTile(origin, turn = 0) {
  const { board } = origin;
  if (checkTile(board) !== null || board.holes.length > TILE_MAX_HOLES) return null;
  const solution = solveTile(board);
  if (solution.possible === null) return null;
  const { piece } = board;
  for (let size = downSize(piece, board.w, board.h); size !== null; size = downSize(piece, ...size)) {
    const [w, h] = size;
    const shell = { w, h };
    // 원래 판의 뺀 칸을 작은 판의 자리로 옮긴다(구석은 구석으로 간다).
    const targets = board.holes.map((hole) => {
      const [x, y] = xyOf(board, hole);
      return [(x * (w - 1)) / (board.w - 1), (y * (h - 1)) / (board.h - 1)];
    });
    const near = (list) =>
      list
        .map((holes) => ({ holes, far: holeDistance(shell, holes, targets) }))
        // 거리가 같으면 칸 번호가 작은 것부터(늘 같은 차례가 되게)
        .sort((a, b) => a.far - b.far || (a.holes[0] ?? 0) - (b.holes[0] ?? 0) || (a.holes[1] ?? 0) - (b.holes[1] ?? 0))
        .map((item) => item.holes);
    const all = tileLists(piece, w, h, board.holes.length);
    const holes = pickByTurn({ yes: near(all.yes), no: near(all.no) }, solution.possible, turn);
    if (holes) return { board: { w, h, piece, holes: holes.slice() } };
  }
  return null;
}

// ---- 누가 이길까: 같은 게임의 가장 작은 판들을 작은 것부터 차례로 ----

export function smallerDuel(origin, turn = 0) {
  if (checkDuel(origin.board) !== null) return null;
  const list = smallBoards(origin.board);
  return list.length > 0 ? { board: list[turn % list.length] } : null;
}

// ---- 약수 세금: 카드가 넷에서 여섯 장인 판 ----

/** 작은 판의 카드 수. 이 차례대로 낸다(원래 판보다 적은 것만) */
export const TAX_SIZES = [6, 4, 5];

export function smallerTax(origin, turn = 0) {
  if (checkTax(origin.board) !== null) return null;
  // 카드를 골라 놓은 판(직접 만든 판)에는 "같은 식의 더 작은 판"이 없다.
  const n = plainN(origin.board);
  if (n === null) return null;
  const sizes = TAX_SIZES.filter((size) => size < n);
  return sizes.length > 0 ? { board: { cards: cardsUpTo(sizes[turn % sizes.length]) } } : null;
}

// ---- 참말 섬: 주민 셋은 주민 둘로, 상자 셋은 상자 둘로. 질문 고르기와 주민 둘의 판에는 없다 ----

/** 작은 판의 주민 수와 상자 수 */
export const LOGIC_SMALL = { people: 2, boxes: 2 };

export function smallerLogic(origin, turn = 0) {
  const { board } = origin;
  if (checkLogic(board) !== null || board.kind === 'question') return null;
  // 원래 판마다 정해 둔 차례로 돈다. 같은 원래 판, 같은 차례에는 늘 같은 판이 나온다.
  const rng = createRng(seedFrom('logic-smaller', JSON.stringify(board)));
  if (board.kind === 'box') {
    if (board.labels.length <= LOGIC_SMALL.boxes) return null;
    // 원래 판의 글과 같은 꼴의 글로만 된 판을 앞에 둔다. 상자 둘에서는 "참인 글은 둘"이나 "거짓인 글은 둘"이어야 답이 하나로 정해진다.
    const types = new Set(board.labels.map((label) => label.t));
    const pool = boxBoards(LOGIC_SMALL.boxes);
    const alike = (item) => item.labels.every((label) => types.has(label.t));
    const list = [...shuffled(rng, pool.filter(alike)), ...shuffled(rng, pool.filter((item) => !alike(item)))];
    const chosen = list[turn % list.length];
    return { board: { kind: 'box', labels: chosen.labels, rule: chosen.rule, ask: 'box' } };
  }
  if (board.people.length <= LOGIC_SMALL.people) return null;
  const road = board.kind === 'road';
  const lists = smallFolkBoards(road);
  // 원래 판이 남는 배정이 없는 판이면, 하나로 정해지는 판부터 남는 배정이 없는 판과 번갈아 낸다. 갈림길 판은 길이 정해지는 판만 낸다.
  const says = pickByTurn({ yes: shuffled(rng, lists.yes), no: shuffled(rng, lists.no) }, solveLogic(board).possible !== false, turn);
  if (!says) return null;
  const people = board.people.slice(0, LOGIC_SMALL.people);
  return { board: road ? { kind: 'road', people, says, ask: 'road' } : { kind: 'folk', people, says, ask: 'kinds' } };
}

// ---- 조각 못 들어가게 막기: 같은 조각, 칸 수가 절반 이하인 네모 판 ----

/** 작은 판의 칸 수는 원래 판의 이만큼 이하다(눈에 띄게 작게) */
export const BLOCK_SHRINK = 1 / 2;

/**
 * 같은 조각의 더 작은 네모 판들. 가로와 세로가 원래 판을 넘지 않고, 칸 수는 절반 이하다.
 * 가로가 긴 판에서는 가로가 긴 판만(세로가 긴 판에서는 세로가 긴 판만) 낸다.
 * 한 칸만 막으면 끝나는 판은 뺀다. 큰 것부터, 같으면 정사각형에 가까운 것부터 줄 세운다.
 */
export function smallBlockBoards(board) {
  const found = [];
  const wide = board.w >= board.h;
  for (let w = 2; w <= board.w; w++) {
    for (let h = 2; h <= board.h; h++) {
      if (w * h > board.w * board.h * BLOCK_SHRINK || (wide ? w < h : w > h)) continue;
      const small = { w, h, piece: board.piece, holes: [] };
      if (blockSpots(small).length === 0) continue;
      const solution = solveBlock(small);
      if (solution.exact && solution.best >= 2) found.push(small);
    }
  }
  return found.sort((a, b) => b.w * b.h - a.w * a.h || Math.abs(a.w - a.h) - Math.abs(b.w - b.h) || b.w - a.w);
}

export function smallerBlock(origin, turn = 0) {
  if (checkBlock(origin.board) !== null) return null;
  const list = smallBlockBoards(origin.board);
  return list.length > 0 ? { board: list[turn % list.length] } : null;
}

// ---- 강 건너기: 같은 종류의 판에서 동물을 줄인 판(코끼리나 생쥐를 줄이고, 할머니와 함께 건너는 동물을 빼고, 엄마와 아기를 한 쌍씩 줄인다) ----

/**
 * 원래 판보다 동물이 적은 같은 종류의 판들. 배는 같다(엄마와 아기는 섬도 같다).
 * 배를 한 번만 보내면 끝나는 판은 뺀다. 원래 판에 가까운 것(동물이 많은 것)부터 줄 세운다.
 */
export function smallRiverBoards(board) {
  const found = [];
  if (board.kind === 'weight') {
    for (let heavy = board.heavy; heavy >= 1; heavy--) {
      for (let light = board.light; light >= 1; light--) {
        if (heavy + light < board.heavy + board.light) found.push({ kind: 'weight', heavy, light });
      }
    }
  } else if (board.kind === 'pets') {
    for (let mask = 1; mask < 1 << board.pets.length; mask++) {
      const pets = board.pets.filter((_, index) => mask & (1 << index));
      if (pets.length < board.pets.length) found.push({ kind: 'pets', pets, seats: board.seats });
    }
  } else {
    for (let pairs = board.pairs - 1; pairs >= RIVER_FLOOR; pairs--) found.push({ kind: 'pairs', pairs, seats: board.seats, island: board.island });
  }
  const size = (item) => castOfRiver(item).length;
  return found
    .filter((item) => checkRiver(item) === null && (solveRiver(item).min ?? 2) >= 2)
    .sort((a, b) => size(b) - size(a) || JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

/** 엄마와 아기 판의 작은 판은 두 쌍까지 줄인다 */
export const RIVER_FLOOR = 2;

export function smallerRiver(origin, turn = 0) {
  if (!origin.board || checkRiver(origin.board) !== null) return null;
  const lists = { yes: [], no: [] };
  for (const board of smallRiverBoards(origin.board)) lists[solveRiver(board).possible ? 'yes' : 'no'].push(board);
  return wrap(pickByTurn(lists, solveRiver(origin.board).possible, turn));
}

// ---- 컵 뒤집기와 세 색 무리: 같은 종류에서 컵이나 방울이를 줄인 판 ----

/** 작은 컵 판의 컵 수는 원래보다 하나나 둘 적게, 한 번에 뒤집는 수보다는 많게 둔다(모두 한 번에 뒤집는 판은 내지 않는다) */
export const CUPS_SHRINK = 2;
/** 작은 방울이 판의 마릿수는 원래보다 하나에서 셋 적게, 셋 아래로는 줄이지 않는다 */
export const COLORS_SHRINK = 3;
export const COLORS_FLOOR = 3;

/**
 * 원래 판보다 작은 같은 종류의 판들. 컵 판은 한 번에 뒤집는 수가 같다.
 * 한 번에 끝나는 되는 판은 뺀다. 원래 판에 가까운 것(컵이나 방울이가 많은 것)부터 줄 세운다.
 */
export function smallCupsBoards(board) {
  const found = [];
  if (board.kind === 'cups') {
    const floor = Math.max(CUP_RANGES.n[0], board.k + 1);
    const want = downCount(board.cups);
    for (let n = board.n - 1; n >= Math.max(floor, board.n - CUPS_SHRINK); n--) {
      // 엎어진 컵 수는 원래 판의 수에 가까운 것부터
      const downs = Array.from({ length: n }, (_, index) => index + 1).sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || b - a);
      for (const down of downs) {
        const rng = createRng(seedFrom('cups-smaller', JSON.stringify(board), n, down));
        found.push({ kind: 'cups', n, k: board.k, cups: placeDown(n, down, rng) });
      }
    }
  } else {
    const total = board.counts.reduce((sum, count) => sum + count, 0);
    for (let size = total - 1; size >= Math.max(COLORS_FLOOR, total - COLORS_SHRINK); size--) {
      const here = [];
      for (let red = 0; red <= size; red++) {
        for (let blue = 0; blue <= size - red; blue++) {
          const counts = [red, blue, size - red - blue];
          if (counts.filter((count) => count > 0).length < 2) continue;
          // 원래 판과 마릿수가 가까운 것부터
          const far = counts.reduce((sum, count, color) => sum + Math.abs(count - board.counts[color]), 0);
          here.push({ far, board: { kind: 'colors', counts } });
        }
      }
      here.sort((a, b) => a.far - b.far || a.board.counts.join(',').localeCompare(b.board.counts.join(',')));
      found.push(...here.map((item) => item.board));
    }
  }
  return found.filter((item) => {
    if (checkCups(item) !== null) return false;
    const solved = solveCups(item);
    return solved.possible ? solved.min >= 2 : true;
  });
}

export function smallerCups(origin, turn = 0) {
  if (!origin.board || checkCups(origin.board) !== null) return null;
  const lists = { yes: [], no: [] };
  for (const board of smallCupsBoards(origin.board)) lists[solveCups(board).possible ? 'yes' : 'no'].push(board);
  // 가장 적게 뒤집는 판(모두 되는 판)에서는 되는 판만 낸다.
  const possible = origin.mode === 'fewest' || solveCups(origin.board).possible;
  return wrap(pickByTurn(lists, possible, turn));
}

export const SMALLER = { coins: smallerCoins, trace: smallerTrace, code: smallerCode, swap: smallerSwap, tile: smallerTile, duel: smallerDuel, tax: smallerTax, logic: smallerLogic, block: smallerBlock, river: smallerRiver, cups: smallerCups };
