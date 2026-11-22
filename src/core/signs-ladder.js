// 부호 넣어 수 만들기의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 수는 시드 난수(rng.js)로 고르고, 풀이 프로그램으로 되는지 안 되는지를 맞춘 판만 낸다.
//
// 안 되는 판의 까닭은 모두 판에서 보인다: 처음 줄은 모두 +라서 모두 +일 때의 수가 판에 나와 있고, 목표 수는 그 수와 홀짝이 다르다.
// 모두 찾기의 띠에는 모두 +일 때보다 큰 수도 둘이나 셋 있다(그 가운데 하나는 홀짝이 맞는데도 크기 때문에 안 된다).
// "모두 +일 때 보기"(도구)를 켜면 부호를 바꿀 때마다 그 수의 두 배만큼 바뀐다는 것이 사실로 적힌다.
import { checkBoard, hopReach, rowReach, sameBoard, solve, totalOf } from './signs.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag   'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode  'five'(5까지의 줄) | 'seven'(7까지의 줄) | 'all'(만들 수 없는 수 모두 찾기) | 'hop'(메뚜기) | 'largest'(만들 수 없는 가장 큰 수) | 'make'(직접 만든다)
 *   ns    맨 앞의 수(메뚜기는 뛰는 횟수)로 고를 수 있는 것
 *
 * 1단계 5부터 1까지: 대개 되는 판이다. 여섯 판에 하나(판 번호를 6으로 나눈 나머지가 3)만 안 되는 판이다. 첫 판은 4, 3, 2, 1로 8을 만드는 판이고,
 *   처음 만나는 안 되는 판(3번)은 3, 2, 1로 3을 만드는 판이다(부호를 넣는 방법이 네 가지뿐이다). 다른 안 되는 판은 수가 셋이나 넷이다.
 * 2단계 7부터 1까지: 여섯 판에 둘(나머지가 2와 5)이 안 되는 판이고 연달아 나오지 않는다. 되는 판은 − 부호를 둘 이상 넣어야 닿는다.
 * 3단계 만들 수 없는 수 모두 찾기: 4, 5, 6부터 1까지의 줄로 1부터 (모두 +일 때 + 2나 3)까지의 수 가운데 만들 수 없는 수를 모두 고른다.
 *   첫 판은 4부터 1까지의 줄과 1부터 12까지의 띠다.
 * 4단계 메뚜기: 1칸부터 n칸(3~7)까지 차례로 왼쪽이나 오른쪽으로 뛴다. 닿을 곳은 대개 0(제자리)이다. 여섯 판에 둘이 안 되는 판이다.
 *   첫 판은 세 번 뛰어 제자리로 오는 판이고, 처음 만나는 안 되는 판(2번)은 두 번 뛰어 제자리로 오는 판이다(뛰는 법이 네 가지뿐이다).
 * 5단계 만들 수 없는 가장 큰 수: 8, 9, 10부터 1까지의 줄. 모두 +일 때보다 작은 수 가운데 만들 수 없는 가장 큰 수를 자물쇠에 넣는다.
 * 6단계 직접 만들기: 맨 앞의 수(2~10)와 목표 수를 정하면 선생님이 되는지 따져 준다.
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'five', ns: [4, 5], noNs: [3, 4, 5] },
  { level: 2, tag: 'basic', mode: 'seven', ns: [6, 7], noNs: [6, 7] },
  { level: 3, tag: 'applied', mode: 'all', ns: [4, 5, 6] },
  { level: 4, tag: 'applied', mode: 'hop', ns: [3, 4, 5, 6, 7] },
  { level: 5, tag: 'challenge', mode: 'largest', ns: [8, 9, 10] },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 1단계의 첫 판(실패할 수 없다. 부호는 몇 번이든 바꿀 수 있다)과 처음 만나는 안 되는 판 */
const FIRST = { kind: 'row', n: 4, target: 8 };
const FIRST_NO = { kind: 'row', n: 3, target: 3 };
/** 3단계의 첫 판: 4부터 1까지의 줄, 1부터 12까지의 띠 */
const ALL_FIRST = { kind: 'all', n: 4, top: 12 };
/** 4단계의 첫 판(세 번 뛰어 제자리)과 처음 만나는 안 되는 판(두 번 뛰어 제자리) */
const HOP_FIRST = { kind: 'hop', n: 3, target: 0 };
const HOP_NO = { kind: 'hop', n: 2, target: 0 };
/** 메뚜기의 닿을 곳이 0이 아닐 때 그 크기의 위 끝 */
const HOP_FAR = 8;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 그 판 번호가 안 되는 판의 자리인가 */
export function impossibleAt(rung, seed) {
  if (rung.mode === 'five') return (seed - 1) % 6 === 2;
  if (rung.mode === 'seven' || rung.mode === 'hop') return [1, 4].includes((seed - 1) % 6);
  return false;
}

/** 한 번 푼 판은 적어 둔다 */
const solved = new Map();
export function solveOnce(board) {
  const key = `${board.kind}:${board.n}:${board.target ?? ''}:${board.top ?? ''}`;
  if (!solved.has(key)) solved.set(key, solve(board));
  return solved.get(key);
}

const pick = (rng, list) => list[randInt(rng, 0, list.length - 1)];
const range = (low, high) => Array.from({ length: Math.max(0, high - low + 1) }, (_, index) => low + index);

/** 줄 n으로 되는 목표 수들: 0 이상, 모두 +일 때보다 2 이상 작고, − 부호로 줄일 양(모두 +일 때와의 차의 반)이 low 이상 */
export function rowTargets(n, low) {
  const total = totalOf(n);
  return range(0, total - 2).filter((value) => rowReach(n).has(value) && (total - value) / 2 >= low);
}

/** 줄 n으로 안 되는 목표 수들: 1부터 모두 +일 때보다 1 작은 수까지 가운데 홀짝이 다른 수 */
export const rowMisses = (n) => range(1, totalOf(n) - 1).filter((value) => !rowReach(n).has(value));

/** 메뚜기 n으로 닿는 0이 아닌 곳(가까운 곳만) */
const hopTargets = (n) => range(-HOP_FAR, HOP_FAR).filter((value) => value !== 0 && Math.abs(value) < totalOf(n) && hopReach(n).has(value));
const hopMisses = (n) => range(-HOP_FAR, HOP_FAR).filter((value) => value !== 0 && Math.abs(value) < totalOf(n) && !hopReach(n).has(value));

// ---- 판 만들기 ----

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed) {
  if (rung.level === 1 && seed === 1) return { ...FIRST };
  if (rung.level === 1 && seed === 3) return { ...FIRST_NO };
  if (rung.mode === 'all' && seed === 1) return { ...ALL_FIRST };
  if (rung.mode === 'hop' && seed === 1) return { ...HOP_FIRST };
  if (rung.mode === 'hop' && seed === 2) return { ...HOP_NO };
  const rng = createRng(seedFrom('signs', rung.level, seed));
  const no = impossibleAt(rung, seed);
  if (rung.mode === 'five' || rung.mode === 'seven') {
    const n = pick(rng, no ? rung.noNs : rung.ns);
    // 1단계는 − 부호 하나로 되는 판도 내고, 2단계는 − 부호를 둘 이상 넣어야 닿는 판만 낸다
    const targets = no ? rowMisses(n) : rowTargets(n, rung.mode === 'five' ? 2 : n);
    return { kind: 'row', n, target: pick(rng, targets) };
  }
  if (rung.mode === 'all') {
    const n = pick(rng, rung.ns);
    return { kind: 'all', n, top: totalOf(n) + randInt(rng, 2, 3) };
  }
  if (rung.mode === 'hop') {
    // 닿을 곳은 대개 0(제자리)이다. 0으로 되는(안 되는) 뛰는 횟수가 아니면 가까운 다른 곳이다
    const zeroNs = rung.ns.filter((n) => hopReach(n).has(0) !== no);
    if (randInt(rng, 0, 2) > 0) return { kind: 'hop', n: pick(rng, zeroNs), target: 0 };
    const n = pick(rng, rung.ns);
    return { kind: 'hop', n, target: pick(rng, no ? hopMisses(n) : hopTargets(n)) };
  }
  return { kind: 'largest', n: pick(rng, rung.ns) };
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(실패할 수 없는 1번 판)을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  const board = boardAt(rung, shrink ? 1 : seed);
  if (checkBoard(board) !== null) throw new Error(`규격에 맞지 않는 판이에요: ${level}단계 ${seed}번`);
  return { level, seed, small: shrink, board };
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

// ---- 더 작은 판 ----

/** 원래 수와 가장 가까운 수(같으면 작은 쪽) */
function closest(list, value) {
  return list.slice().sort((a, b) => Math.abs(a - value) - Math.abs(b - value) || a - b)[0];
}

/**
 * 더 작은 판들. 같은 판에는 늘 같은 판들이 나온다. 맨 앞의 수(뛰는 횟수)가 하나, 둘 적은 같은 종류의 판이다.
 *   줄과 메뚜기: { yes, no }. yes는 되는 판, no는 안 되는 판이다(목표 수는 원래 목표 수와 가장 가까운 것).
 *     원래 판이 되는 판이면 되는 판만 쓴다(src/core/smaller.js의 pickByTurn). 줄은 수 셋, 메뚜기는 두 번 뛰기까지 줄인다.
 *   모두 찾기와 가장 큰 수: { list }. 띠는 그 줄의 모두 +일 때 + 2까지다. 모두 찾기는 수 셋, 가장 큰 수는 수 다섯까지 줄인다.
 * @param {object} board 원래 판
 */
export function smallBoards(board) {
  const sizes = [board.n - 1, board.n - 2];
  if (board.kind === 'row') {
    const ns = sizes.filter((n) => n >= 3);
    const yes = ns.map((n) => ({ kind: 'row', n, target: closest(rowTargets(n, 1), board.target) }));
    const no = ns.map((n) => ({ kind: 'row', n, target: closest(rowMisses(n), board.target) }));
    return { yes, no };
  }
  if (board.kind === 'hop') {
    const ns = sizes.filter((n) => n >= 2);
    const near = (n, good) => range(-totalOf(n) + 1, totalOf(n) - 1).filter((value) => hopReach(n).has(value) === good);
    return {
      yes: ns.map((n) => ({ kind: 'hop', n, target: closest(near(n, true), board.target) })),
      no: ns.map((n) => ({ kind: 'hop', n, target: closest(near(n, false), board.target) })),
    };
  }
  if (board.kind === 'all') return { list: sizes.filter((n) => n >= 3).map((n) => ({ kind: 'all', n, top: totalOf(n) + 2 })) };
  return { list: sizes.filter((n) => n >= 5).map((n) => ({ kind: 'largest', n })) };
}
