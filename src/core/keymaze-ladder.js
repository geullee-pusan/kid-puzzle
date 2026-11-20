// 열쇠 미로의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 판은 시드 난수(rng.js)로 만들고, 풀이 프로그램이 잣대에 맞는다고 확인한 판만 낸다.
//
// 판 만들기: 방들을 아무렇게나 이은 길(모든 방이 이어진 나무)에 문을 몇 개 더 뚫고, 그 가운데 몇 개를 한쪽 문과 잠긴 문으로 바꾸고,
// 잠긴 문의 색마다 열쇠를 놓는다. 처음 방과 나가는 문은 서로 먼 자리에 둔다.
// 고르는 잣대(전략 9.1절: 아무렇게나 해서는 잘 안 되는 판):
//   - 가장 적은 걸음이 단계마다 정한 수 이상
//   - 갇히는 곳(들어가면 나갈 수 없게 되는 모습)이 있다(1단계의 첫 판만은 없다. 형식의 첫 판은 실패할 수 없다)
//   - 아무렇게나 걸으면 나가는 비율이 단계마다 정한 수 이하(시드 난수로 80번 걸어 본다)
//   - 열쇠가 있는 단계: 잠긴 문 없이는 나갈 수 없고, 열쇠를 가지러 길을 돌아가야 한다(잠긴 문이 다 열려 있을 때보다 두 걸음 이상 길다)
//   - 한 번 쓰면 없어지는 열쇠의 단계: 열쇠를 엉뚱한 문에 써서 갇히는 모습이 있다(열쇠를 계속 가진다면 나갈 수 있는 모습)
//   - 가장 적은 걸음의 단계: 아무렇게나 걸어 나간 길 가운데 가장 적은 걸음인 것이 넷에 하나 이하
// 나갈 수 없는 판은 셋에 하나(판 번호를 3으로 나눈 나머지가 2)이고, 까닭이 아이에게 보이는 판(arrows, nokey, trap, twice)만 낸다.
// 모든 걸음을 따져 보고서야 아는 판(search)은 사다리와 작은 판에 내지 않는다(직접 만들기에서만 만날 수 있다).
import { allUnlocked, countDoors, measure, neighbourOf, SIDES, solve, walkRate, withoutLocks, orderMatters, sameBoard } from './keymaze.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'oneway'(한쪽 문만) | 'keys'(열쇠를 계속 가진다) | 'mixed'(나갈 수 없는 판이 섞인다) | 'used'(한 번 쓰면 없어지는 열쇠, 나갈 수 없는 판이 섞인다)
 *           | 'fewest'(가장 적은 걸음으로 나간다) | 'make'(직접 만든다)
 *   spec    판을 만드는 값(크기, 한쪽 문과 잠긴 문의 수, 색의 수, 더 뚫는 문의 비율, 나가는 문이 잠길 비율, 열쇠 약속)
 *   rule    고르는 잣대(가장 적은 걸음, 아무렇게나 걸어 나가는 비율의 위 끝)
 *   reasons 나갈 수 없는 판의 까닭(없으면 그 단계에는 나갈 수 없는 판이 없다)
 */
export const LADDER = [
  {
    level: 1,
    tag: 'basic',
    mode: 'oneway',
    spec: { sizes: [[3, 3], [4, 3], [3, 4], [4, 4]], ones: [3, 6], locks: [0, 0], colors: 0, extra: 0.4, exitLock: 0, keep: 'kept' },
    rule: { steps: 4, rate: 0.6 },
  },
  {
    level: 2,
    tag: 'basic',
    mode: 'keys',
    spec: { sizes: [[3, 3], [4, 3], [3, 4], [4, 4]], ones: [1, 3], locks: [1, 2], colors: 2, extra: 0.35, exitLock: 0.3, keep: 'kept' },
    rule: { steps: 5, rate: 0.7 },
  },
  {
    level: 3,
    tag: 'applied',
    mode: 'mixed',
    spec: { sizes: [[4, 3], [3, 4], [4, 4]], ones: [2, 4], locks: [1, 3], colors: 2, extra: 0.35, exitLock: 0.3, keep: 'kept' },
    rule: { steps: 6, rate: 0.5 },
    reasons: ['trap', 'nokey'],
  },
  {
    level: 4,
    tag: 'applied',
    mode: 'used',
    spec: { sizes: [[4, 3], [3, 4], [4, 4]], ones: [0, 3], locks: [2, 4], colors: 2, extra: 0.4, exitLock: 0.3, keep: 'used' },
    rule: { steps: 5, rate: 0.6 },
    reasons: ['twice', 'trap', 'nokey'],
  },
  {
    level: 5,
    tag: 'challenge',
    mode: 'fewest',
    spec: { sizes: [[5, 4], [4, 5], [5, 5]], ones: [2, 5], locks: [1, 3], colors: 2, extra: 0.45, exitLock: 0.3, keep: 'kept' },
    rule: { steps: 8, rate: 0.9, fewest: 0.25 },
  },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 나갈 수 없는 판이 섞이는 단계에서 나갈 수 없는 판의 몫: 판 번호를 3으로 나눈 나머지가 2인 판(2, 5, 8, …번) */
export const impossibleSeed = (rung, seed) => Array.isArray(rung.reasons) && seed % 3 === 2;

/** 맨 처음의 나갈 수 없는 판(2번)은 아주 쉬운 판이다: 3×3에 열쇠를 가져올 수 없는 판 */
const FIRST_IMPOSSIBLE = { sizes: [[3, 3]], reasons: ['nokey'] };

/** 1단계에서 "작은 판부터"일 때의 크기(수준 맞추기에서 쓴다) */
export const SMALL_SIZE = [3, 2];

/** 판 하나를 만들려고 다시 뽑아 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 4000;

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

/** 이웃한 두 방의 짝 모두 */
function allPairs(w, h) {
  const pairs = [];
  for (let room = 0; room < w * h; room++) {
    if (room % w < w - 1) pairs.push([room, room + 1]);
    if (room + w < w * h) pairs.push([room, room + w]);
  }
  return pairs;
}

const distance = (w, a, b) => Math.abs((a % w) - (b % w)) + Math.abs(Math.floor(a / w) - Math.floor(b / w));

/**
 * 판 하나를 아무렇게나 만든다(잣대는 보지 않는다).
 * @param {() => number} rng 시드 난수
 * @param {object} spec 사다리의 spec
 */
export function randomBoard(rng, spec) {
  const [w, h] = spec.sizes[randInt(rng, 0, spec.sizes.length - 1)];
  const n = w * h;
  const board0 = { w, h };
  // 나가는 문: 가장자리의 한 방, 처음 방: 나가는 문에서 먼 방
  const edges = [];
  for (let room = 0; room < n; room++) for (const side of SIDES) if (neighbourOf(board0, room, side) === null) edges.push({ room, side });
  const exit = edges[randInt(rng, 0, edges.length - 1)];
  const far = Math.max(...Array.from({ length: n }, (_, room) => distance(w, room, exit.room)));
  const starts = Array.from({ length: n }, (_, room) => room).filter((room) => distance(w, room, exit.room) >= Math.max(2, far - 1));
  const start = starts[randInt(rng, 0, starts.length - 1)];
  // 모든 방이 이어진 나무(처음 방에서 아무렇게나 뻗어 간다), 그리고 문 몇 개를 더 뚫는다
  const pairs = allPairs(w, h);
  const inTree = new Set([start]);
  const passages = [];
  while (inTree.size < n) {
    const frontier = pairs.filter(([a, b]) => inTree.has(a) !== inTree.has(b));
    const [a, b] = frontier[randInt(rng, 0, frontier.length - 1)];
    passages.push([a, b]);
    inTree.add(a);
    inTree.add(b);
  }
  for (const pair of pairs) if (!passages.some(([a, b]) => a === pair[0] && b === pair[1]) && rng() < spec.extra) passages.push(pair);
  // 문의 종류: 한쪽 문과 잠긴 문을 몇 개 고른다
  const order = shuffle(rng, passages);
  const ones = randInt(rng, spec.ones[0], spec.ones[1]);
  const locks = randInt(rng, spec.locks[0], spec.locks[1]);
  const exitLocked = spec.colors > 0 && rng() < spec.exitLock;
  const lockColors = [];
  const doors = order.map(([a, b], index) => {
    if (index < ones) return { a, b, kind: 'one', to: rng() < 0.5 ? a : b };
    if (index < ones + locks - (exitLocked ? 1 : 0)) {
      const color = randInt(rng, 0, spec.colors - 1);
      lockColors.push(color);
      return { a, b, kind: 'lock', color };
    }
    return { a, b, kind: 'open' };
  });
  let exitColor = null;
  if (exitLocked) {
    exitColor = randInt(rng, 0, spec.colors - 1);
    lockColors.push(exitColor);
  }
  // 열쇠: 잠긴 문의 색마다 하나(한 번 쓰면 없어지는 약속에서는 그 색 문의 수만큼까지). 처음 방에는 두지 않는다
  const free = shuffle(
    rng,
    Array.from({ length: n }, (_, room) => room).filter((room) => room !== start),
  );
  const keys = [];
  for (const color of [...new Set(lockColors)].sort((a, b) => a - b)) {
    const doorsOfColor = lockColors.filter((item) => item === color).length;
    const count = spec.keep === 'used' ? randInt(rng, 1, doorsOfColor) : 1;
    for (let index = 0; index < count && free.length > 0; index++) keys.push({ room: free.pop(), color });
  }
  return {
    w,
    h,
    start,
    exit: { room: exit.room, side: exit.side, color: exitColor },
    doors: doors.sort((p, q) => p.a - q.a || p.b - q.b),
    keys: keys.sort((p, q) => p.room - q.room),
    keep: spec.keep,
  };
}

/**
 * 나갈 수 있는 판이 그 단계의 잣대에 맞는가.
 * @param {object} rung 사다리의 단계
 * @param {object} board 판
 * @param {object} solution 풀이(solve의 결과)
 * @param {{first?: boolean}} options first: 1단계의 첫 판(갇히는 곳이 없어야 한다)
 */
export function goodPossible(rung, board, solution, { first = false, seed = 0 } = {}) {
  if (!solution.possible || solution.steps < rung.rule.steps) return false;
  const shape = measure(board);
  if (first) return shape.doomed === 0;
  if (shape.doomed === 0) return false;
  const { locks } = countDoors(board);
  if (rung.mode !== 'oneway') {
    if (locks === 0 || solve(withoutLocks(board)).possible) return false;
    if (solution.steps < solve(allUnlocked(board)).steps + 2) return false;
  }
  if (rung.mode === 'used' && !orderMatters(board)) return false;
  const walks = walkRate(board, createRng(seedFrom('keymaze-walk', rung.level, seed)));
  if (walks.rate > rung.rule.rate) return false;
  if (rung.rule.fewest !== undefined) {
    // 아무렇게나 걸어 나간 길이 있어야 하고, 그 가운데 가장 적은 걸음인 것이 적어야 한다(더 적은 걸음을 찾을 거리가 있다)
    if (walks.lengths.length < 4) return false;
    const fewest = walks.lengths.filter((length) => length === solution.steps).length;
    if (fewest / walks.lengths.length > rung.rule.fewest) return false;
  }
  return true;
}

/**
 * 나갈 수 없는 판이 그 단계의 잣대에 맞는가: 까닭이 고른 것 가운데 하나이고, 처음 방에서 판의 절반 넘게 걸어 볼 수 있다.
 * 갇히는 판(trap)은 열쇠 색을 모두 가져올 수 있는 판만 쓴다(그래야 "나갈 수 있는 방 보기"로 까닭이 보인다).
 */
export function goodImpossible(reasons, board, solution) {
  if (solution.possible || !reasons.includes(solution.reason)) return false;
  const shape = measure(board);
  if (shape.rooms * 2 <= board.w * board.h) return false;
  const { locks, keys } = countDoors(board);
  if (locks === 0) return false;
  // 열쇠가 하나도 없는 판은 안 쓴다(나가는 문만 잠긴 판은 너무 뻔하다). 맨 처음의 판은 예외다
  if (keys === 0 && board.w * board.h > 9) return false;
  return true;
}

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed, { small = false } = {}) {
  const rng = createRng(seedFrom('keymaze', rung.level, seed, small ? 'small' : ''));
  const impossible = !small && impossibleSeed(rung, seed);
  const firstImpossible = impossible && seed === 2 && rung.level === 3;
  const spec = small ? { ...rung.spec, sizes: [SMALL_SIZE] } : firstImpossible ? { ...rung.spec, sizes: FIRST_IMPOSSIBLE.sizes } : rung.spec;
  // 나갈 수 없는 판은 까닭을 차례로 돌려 가며 낸다(2번은 맨 처음의 판, 5번부터 까닭 목록의 차례대로).
  // 그 까닭의 판을 오래 찾지 못하면 목록의 다른 까닭도 받는다.
  const turn = Math.floor(seed / 3);
  const wanted = firstImpossible ? FIRST_IMPOSSIBLE.reasons : impossible ? [rung.reasons[(turn - 1 + rung.reasons.length) % rung.reasons.length]] : [];
  const first = rung.level === 1 && (seed === 1 || small);
  const relaxed = small ? { ...rung, rule: { ...rung.rule, steps: 3 } } : rung;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const board = randomBoard(rng, spec);
    const solution = solve(board);
    const reasons = attempt < MAX_TRIES / 2 ? wanted : rung.reasons;
    if (impossible ? goodImpossible(reasons, board, solution) : goodPossible(relaxed, board, solution, { first, seed })) return board;
  }
  throw new Error(`판을 만들지 못했어요: ${rung.level}단계 ${seed}번`);
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(3×2)을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object, solution: object}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  const board = boardAt(rung, seed, { small: shrink });
  return { level, seed, small: shrink, board, solution: solve(board) };
}

/** 다음 판 번호. 방금 한 판과 같은 판이 나오는 번호는 건너뛴다 */
export function nextSeed(level, seed) {
  const rung = rungOf(level);
  if (rung.mode === 'make') return seed + 1;
  const before = boardAt(rung, seed);
  let next = seed + 1;
  while (sameBoard(boardAt(rung, next), before)) next += 1;
  return next;
}

/**
 * 더 작은 판들: 원래 판과 열쇠 약속과 문 종류가 같고 방이 원래 판의 3분의 2 이하인 판.
 * 되는 판(yes)과, 원래 판이 나갈 수 없는 판이면 까닭이 같은 나갈 수 없는 판(no)을 둘씩 만든다. 같은 판에는 늘 같은 판들이 나온다.
 * @param {object} origin { mode, board }
 * @returns {{yes: object[], no: object[]}}
 */
export function smallBoards(origin) {
  const { board } = origin;
  const rooms = board.w * board.h;
  const sizes = [];
  for (let w = 2; w <= 4; w++) for (let h = 2; h <= 4; h++) if (w * h >= 4 && w * h * 3 <= rooms * 2) sizes.push([w, h]);
  if (sizes.length === 0) return { yes: [], no: [] };
  const from = solve(board);
  const { ones, locks, keys } = countDoors(board);
  const colors = Math.max(0, ...board.doors.filter((door) => door.kind === 'lock').map((door) => door.color + 1), board.exit.color === null ? 0 : board.exit.color + 1, ...board.keys.map((key) => key.color + 1));
  const spec = {
    sizes,
    ones: [Math.min(1, ones), Math.max(Math.min(1, ones), Math.min(ones, 3))],
    locks: [Math.min(1, locks), Math.max(Math.min(1, locks), Math.min(locks, 2))],
    colors: Math.min(colors, 2),
    extra: 0.35,
    exitLock: locks > 0 ? 0.3 : 0,
    keep: board.keep,
  };
  const rng = createRng(seedFrom('keymaze-small', JSON.stringify(board)));
  const yes = [];
  const no = [];
  for (let attempt = 0; attempt < MAX_TRIES && (yes.length < 2 || (!from.possible && no.length < 2)); attempt++) {
    const small = randomBoard(rng, spec);
    if (keys > 0 && small.keys.length === 0) continue;
    const solution = solve(small);
    if (solution.possible) {
      if (yes.length >= 2 || solution.steps < 3) continue;
      // 작은 판도 갇히는 곳이 있게 한다(원래 판에 갇히는 곳이 없던 첫 판이면 없어도 된다)
      const shape = measure(small);
      if (shape.doomed === 0 && measure(board).doomed > 0) continue;
      if (locks > 0 && solve(withoutLocks(small)).possible) continue;
      if (yes.some((item) => sameBoard(item, small))) continue;
      yes.push(small);
    } else if (!from.possible && no.length < 2 && solution.reason === from.reason && goodImpossible([from.reason], small, solution)) {
      if (no.some((item) => sameBoard(item, small))) continue;
      no.push(small);
    }
  }
  return { yes, no };
}
