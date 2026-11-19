// 규칙 기계와 규칙이 깨지는 판의 사다리(단계)와 판 내기, "더 작은 판"의 재료. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 처음 칸, 나온 수, 보기와 맞힐 수는 시드 난수로 고른다.
import { applyMachine, checkBoard, copyBoard, cycleOf, preimagesOf, solve } from './machine.js';
import { createRng, randInt, seedFrom } from './rng.js';

const one = (...steps) => ({ kind: 'one', steps });
/** 자주 쓰는 기계 */
export const MACHINES = {
  revAdd: one({ op: 'rev' }, { op: 'add', k: 1 }),
  squares: one({ op: 'dsq' }),
  pair: { kind: 'pair' },
  double: one({ op: 'mul', k: 2 }, { op: 'last2' }),
  addRev: one({ op: 'addrev' }),
  product: one({ op: 'dprod' }),
  times3plus1: one({ op: 'mul', k: 3 }, { op: 'add', k: 1 }),
  seven: one({ op: 'mul', k: 7 }, { op: 'last2' }),
  times2: one({ op: 'mul', k: 2 }),
};

/** 숨은 규칙 상자에 넣는 규칙들(차례로 돈다) */
const BOX_RULES = [
  () => one({ op: 'add', k: 0 }),
  () => one({ op: 'mul', k: 0 }),
  () => one({ op: 'rev' }),
  () => one({ op: 'mul', k: 2 }, { op: 'add', k: 1 }),
  () => one({ op: 'dsum' }),
  () => one({ op: 'addrev' }),
];

/**
 * 사다리.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   modes  판 번호가 달라지면 차례로 도는 판의 종류(src/core/machine.js). 'make'는 직접 만들기
 *   hint   처음 화면의 물음을 고르는 이름(판의 종류마다 힌트와 규칙 글은 따로 있다)
 *
 * 1단계: 몇 칸 채우기. 말로 준 규칙과 처음 칸을 보고 다음 칸들을 채운다. 첫 판은 "자리를 뒤집고 1을 더해요", 13에서 네 칸.
 * 2단계: 넣은 수와 나온 수. 나온 수를 보고 넣은 수를 모두 찾는 판(없는 판이 셋에 하나)과, 숨은 규칙의 상자에 넣어 보고 나올 수를 맞히는 판이 번갈아 나온다.
 * 3단계: 먼 칸 맞히기. 앞의 스무 칸까지만 돌려 볼 수 있고, 75번째(또는 50, 100번째) 칸을 맞힌다. 줄은 어딘가에서 되풀이된다.
 * 4단계: 계속 작아지기만 하는 줄(기록 깨기). 처음 칸을 골라 줄이 처음부터 계속 작아지는 칸을 가장 길게. 두 수 기계(99까지, 가장 긴 것 10칸)와 자리 숫자 곱하기(999까지, 6칸).
 * 5단계: 규칙이 깨지는 판. 원 위의 점을 모두 이은 조각(1, 2, 4, 8, 16 다음은 31)과 약수가 둘뿐인 수를 내는 차림표(0~39는 모두, 40에서 41 × 41).
 * 6단계: 직접 만들기. 블록으로 기계를 만들고 처음 칸을 넣으면 선생님이 돌려 보고 어디서 되풀이되는지 알려 준다.
 */
export const LADDER = [
  { level: 1, tag: 'basic', modes: ['fill'], hint: 'fill' },
  { level: 2, tag: 'basic', modes: ['back', 'box'], hint: 'back' },
  { level: 3, tag: 'applied', modes: ['far'], hint: 'far' },
  { level: 4, tag: 'applied', modes: ['record'], hint: 'record' },
  { level: 5, tag: 'challenge', modes: ['circle', 'prime'], hint: 'circle' },
  { level: 6, tag: 'challenge', modes: ['make'], hint: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 먼 칸 맞히기: 돌려 볼 수 있는 칸 수와 맞힐 칸 번호 */
export const FAR_CAP = 20;
export const FAR_TARGETS = [75, 50, 100];
/** 2단계: 넣을 수 있는 수의 끝(작은 판은 20) */
export const BACK_LIMIT = 99;
export const SMALL_LIMIT = 20;
/** 거꾸로 찾기에서 나온 수를 고르는 범위의 끝 */
const TARGET_TOP = 150;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

export const solutionOf = (board) => solve(board);

const pickFrom = (rng, list) => list[randInt(rng, 0, list.length - 1)];
const cycleIndex = (list, seed) => list[(((seed - 1) % list.length) + list.length) % list.length];

/** 두 자리 수 가운데, 자리 숫자가 0이 아니고 서로 다른 수 */
function twoDigit(rng, ok = () => true) {
  for (let tries = 0; tries < 500; tries++) {
    const n = randInt(rng, 12, 98);
    const [a, b] = String(n).split('').map(Number);
    if (a !== 0 && b !== 0 && a !== b && ok(n)) return n;
  }
  return 13;
}

// ---- 1단계: 몇 칸 채우기 ----
const FILL_SETS = [
  () => ({ machine: MACHINES.revAdd, start: (rng) => [twoDigit(rng)], count: 4 }),
  () => ({ machine: MACHINES.squares, start: (rng) => [twoDigit(rng)], count: 4 }),
  () => ({ machine: MACHINES.pair, start: (rng) => { const a = randInt(rng, 20, 60); return [a, randInt(rng, 5, a - 5)]; }, count: 5 }),
  () => ({ machine: MACHINES.double, start: (rng) => [twoDigit(rng)], count: 5 }),
  () => ({ machine: MACHINES.addRev, start: (rng) => [twoDigit(rng, (n) => Math.floor(n / 10) + (n % 10) < 10)], count: 3 }),
];

function fillBoard(seed, rng, small) {
  if (seed === 1) return { kind: 'fill', machine: copyBoard(MACHINES.revAdd), start: [13], count: small ? 2 : 4 };
  const set = cycleIndex(FILL_SETS, seed)();
  return { kind: 'fill', machine: copyBoard(set.machine), start: set.start(rng), count: small ? 2 : set.count };
}

// ---- 2단계: 거꾸로 찾기와 규칙 상자 ----
const BACK_MACHINES = ['revAdd', 'squares', 'product', 'times3plus1'];
/** 넣은 수가 몇 개인 판을 낼까: 하나, 둘 이상, 없음이 차례로(없는 판이 셋에 하나) */
const BACK_KINDS = ['one', 'many', 'none'];

/** 나온 수 고르기: 넣은 수의 개수가 kind에 맞는 것 가운데 하나. 맞는 것이 없으면 다른 종류로 */
export function pickTarget(machine, kind, rng, limit = BACK_LIMIT) {
  const fits = (count) => (kind === 'none' ? count === 0 : kind === 'one' ? count === 1 : count >= 2 && count <= 4);
  const pool = [];
  // 나올 수 있는 가장 큰 수까지(작은 판에서는 20까지는 본다)
  const top = Math.min(TARGET_TOP, Math.max(SMALL_LIMIT, ...Array.from({ length: limit }, (_, at) => applyMachine(machine, at + 1))));
  for (let target = 1; target <= top; target++) if (fits(preimagesOf(machine, target, 1, limit).length)) pool.push(target);
  if (pool.length > 0) return pickFrom(rng, pool);
  // 맞는 것이 없으면 하나 → 둘 이상 → 없음 차례로 다른 종류를 고른다
  const next = { none: 'one', one: 'many', many: null }[kind];
  return next ? pickTarget(machine, next, rng, limit) : null;
}

function backBoard(seed, rng, small) {
  const at = Math.floor((seed - 1) / 2);
  const name = BACK_MACHINES[at % BACK_MACHINES.length];
  const kind = BACK_KINDS[at % BACK_KINDS.length];
  const limit = small ? SMALL_LIMIT : BACK_LIMIT;
  const machine = copyBoard(MACHINES[name]);
  const target = pickTarget(machine, kind, rng, limit) ?? pickTarget(machine, 'one', rng, limit);
  return { kind: 'back', machine, target, limit };
}

/** 규칙 상자: 규칙 하나와 보기 둘, 맞힐 수 셋(작은 판은 보기 셋, 맞힐 수 하나). 맞힐 수에는 한 자리 수, 두 자리 수, 끝이 0인 수가 섞인다 */
export function boxBoard(seed, rng, small) {
  const at = Math.floor((seed - 1) / 2);
  const machine = BOX_RULES[at % BOX_RULES.length]();
  for (const step of machine.steps) {
    if (step.op === 'add' && step.k === 0) step.k = randInt(rng, 3, 12);
    if (step.op === 'mul' && step.k === 0) step.k = randInt(rng, 2, 5);
  }
  const used = new Set();
  const take = (low, high, ok = () => true) => {
    for (let tries = 0; tries < 200; tries++) {
      const n = randInt(rng, low, high);
      if (!used.has(n) && ok(n)) {
        used.add(n);
        return n;
      }
    }
    for (let n = low; n <= high; n++) if (!used.has(n)) return used.add(n), n;
    return null;
  };
  const shown = [take(2, 9), take(12, 39, (n) => n % 10 !== 0)];
  if (small) shown.push(take(41, 69, (n) => n % 10 !== 0));
  const asks = small ? [take(3, 9)] : [take(3, 9), take(41, 89, (n) => n % 10 !== 0), take(1, 9) * 10];
  return { kind: 'box', machine, shown, asks, limit: BACK_LIMIT };
}

// ---- 3단계: 먼 칸 맞히기 ----
const FAR_MACHINES = ['revAdd', 'squares', 'pair', 'seven'];

/** 되풀이가 돌려 볼 수 있는 칸 안에 다 보이고, 되풀이 앞에 칸이 조금 있는 처음 칸 */
function farStart(name, rng, cap) {
  const machine = MACHINES[name];
  const fits = (start) => {
    const cycle = cycleOf(machine, start);
    return cycle && cycle.mu + cycle.lambda + 1 <= cap && cycle.lambda >= 3 && (name === 'seven' || cycle.mu >= 2);
  };
  for (let tries = 0; tries < 500; tries++) {
    let start;
    if (name === 'pair') {
      const a = randInt(rng, 10, 40);
      start = [a, randInt(rng, 3, a - 3)];
    } else start = [twoDigit(rng)];
    if (fits(start)) return start;
  }
  throw new Error(`먼 칸 맞히기의 처음 칸을 찾지 못했어요: ${name}`);
}

function farBoard(seed, rng, small, turn = 0) {
  const name = seed === 1 ? 'revAdd' : cycleIndex(FAR_MACHINES, seed);
  const start = seed === 1 ? [57] : farStart(name, rng, FAR_CAP);
  const target = small ? FAR_CAP + 10 - 5 * turn : cycleIndex(FAR_TARGETS, seed);
  return { kind: 'far', machine: copyBoard(MACHINES[name]), start, target, cap: FAR_CAP };
}

// ---- 4단계: 계속 작아지기만 하는 줄 ----
/** 고를 수 있는 수의 끝: 두 수 기계와 자리 숫자 곱하기마다, 원래 판과 작은 판들 */
export const RECORD_LIMITS = { pair: [99, 50, 30, 20], product: [999, 99, 30] };

function recordBoard(seed, small) {
  const name = seed % 2 === 1 ? 'pair' : 'product';
  return { kind: 'record', machine: copyBoard(MACHINES[name]), limit: RECORD_LIMITS[name][small ? 1 : 0] };
}

// ---- 5단계: 규칙이 깨지는 판 ----
/** 원: 세어 볼 점의 수들과 짐작할 점의 수. 작은 판은 점이 하나씩 적다 */
export const CIRCLE_BOARDS = [
  { kind: 'circle', counts: [4, 5], guess: 6 },
  { kind: 'circle', counts: [3, 4], guess: 5 },
  { kind: 'circle', counts: [2, 3], guess: 4 },
];
/** 차림표: 더하는 수와 컴퓨터가 넣어 볼 끝(처음으로 깨지는 곳). 작은 판은 더 일찍 깨진다 */
export const PRIME_BOARDS = [
  { kind: 'prime', add: 41, upTo: 40 },
  { kind: 'prime', add: 17, upTo: 16 },
  { kind: 'prime', add: 11, upTo: 10 },
];

function breakBoard(seed, small) {
  const list = seed % 2 === 1 ? CIRCLE_BOARDS : PRIME_BOARDS;
  return copyBoard(list[small ? 1 : 0]);
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 그 단계의 작은 판
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.modes[0] === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  const rng = createRng(seedFrom('machine', level, seed, small ? 'small' : ''));
  let board;
  if (level === 1) board = fillBoard(seed, rng, small);
  else if (level === 2) board = seed % 2 === 1 ? backBoard(seed, rng, small) : boxBoard(seed, rng, small);
  else if (level === 3) board = farBoard(seed, rng, small);
  else if (level === 4) board = recordBoard(seed, small);
  else board = breakBoard(seed, small);
  const problem = checkBoard(board);
  if (problem) throw new Error(`쓸 수 있는 판이 없어요: ${level}단계 ${seed}번(${problem})`);
  return { level, seed, small, board, solution: solutionOf(board) };
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

/**
 * "더 작은 판"의 재료: 같은 종류에서 하나씩 작아지는 판들(원래 판에 가까운 것부터).
 *   fill    채울 칸이 둘 적은 판, 그다음 한 칸(같은 기계, 같은 처음 칸)
 *   back    넣을 수 있는 수가 1~20인 판(같은 기계. 넣은 수가 없는 판에서 왔으면 없는 판, 있는 판에서 왔으면 있는 판)
 *   box     같은 규칙에 보기 셋, 맞힐 수 하나
 *   far     맞힐 칸이 더 가까운 판(30번째, 25번째)
 *   record  고를 수 있는 수의 끝이 작은 판
 *   circle  점이 하나 적은 판, 둘 적은 판
 *   prime   더 일찍 깨지는 차림표(17, 11)
 */
export function smallBoards(board) {
  const list = [];
  if (board.kind === 'fill') {
    for (const count of [board.count - 2, 1]) if (count >= 1 && count < board.count && !list.some((item) => item.count === count)) list.push({ ...copyBoard(board), count });
  } else if (board.kind === 'back') {
    if (board.limit > SMALL_LIMIT) {
      const none = preimagesOf(board.machine, board.target, 1, board.limit).length === 0;
      const rng = createRng(seedFrom('machine-smaller', JSON.stringify(board)));
      const target = pickTarget(board.machine, none ? 'none' : 'one', rng, SMALL_LIMIT);
      if (target !== null) list.push({ kind: 'back', machine: copyBoard(board.machine), target, limit: SMALL_LIMIT });
    }
  } else if (board.kind === 'box') {
    if (board.asks.length > 1) {
      const rng = createRng(seedFrom('machine-smaller', JSON.stringify(board)));
      const small = boxBoard(1, rng, true);
      list.push({ ...small, machine: copyBoard(board.machine) });
    }
  } else if (board.kind === 'far') {
    for (const target of [FAR_CAP + 10, FAR_CAP + 5]) if (target < board.target && target > board.cap) list.push({ ...copyBoard(board), target });
  } else if (board.kind === 'record') {
    const name = board.machine.kind === 'pair' ? 'pair' : 'product';
    for (const limit of RECORD_LIMITS[name] ?? []) if (limit < board.limit) list.push({ ...copyBoard(board), limit });
  } else if (board.kind === 'circle') {
    for (const item of CIRCLE_BOARDS) if (item.guess < board.guess) list.push(copyBoard(item));
  } else if (board.kind === 'prime') {
    for (const item of PRIME_BOARDS) if (item.upTo < board.upTo) list.push(copyBoard(item));
  }
  return list.filter((item) => checkBoard(item) === null);
}
