// 질문으로 맞히기의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 숨길 수의 끝과 질문 수는 시드 난수(rng.js)로 목록에서 고른다.
import { boardKey, canPin, canPrepare, checkBoard, fewestFor, rowKinds, sameBoard } from './yesno.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag   'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode  'free'(몇 번이든 물어서 맞히기) | 'limit'(정한 질문 수 안에) | 'pick'(몇 번이면 될까요: 아이가 질문 수를 정한다)
 *         | 'maybe'(언제나 맞힐 수 있을까: 안 되는 판이 셋에 하나) | 'ahead'(질문 미리 정하기) | 'make'(직접 만든다)
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'free' },
  { level: 2, tag: 'basic', mode: 'limit' },
  { level: 3, tag: 'applied', mode: 'pick' },
  { level: 4, tag: 'applied', mode: 'maybe' },
  { level: 5, tag: 'challenge', mode: 'ahead' },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;
/** 직접 만들기의 처음 값과 범위 */
export const MAKE_FIRST = { n: 10, q: 3 };
export const MAKE_N = [2, 32];
export const MAKE_Q = [1, 6];

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 단계마다 고르는 목록 */
export const FREE_NS = [6, 7, 8, 9, 10, 12, 16];
/** 정한 질문 수 안에: 질문 수는 늘 가장 적은 질문 수와 같다(여유가 없다) */
export const LIMIT_NS = [4, 6, 8, 8, 10, 12, 16, 16, 32];
/** 몇 번이면 될까요: 2를 몇 번 곱한 수가 아닌 끝을 주로 고른다 */
export const PICK_NS = [5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 24];
/** 미리 정하기 */
export const AHEAD_BOARDS = [[4, 2], [8, 3], [6, 3], [16, 4], [12, 4], [5, 3], [10, 4], [8, 3]];

/** 언제나 맞힐 수 있을까: 판 번호를 셋으로 나눈 나머지가 1이면 안 되는 판(셋에 하나), 첫 판은 1부터 3까지를 질문 1번으로 */
export const maybeImpossible = (seed) => seed % 3 === 1;

/** 판의 시드(대답이 갈리지 않을 때 쓴다) */
const tieOf = (...parts) => seedFrom('yesno-tie-seed', ...parts) % 100000;

/** 단계마다의 첫 판(판 번호 1) */
const FIRSTS = {
  free: { kind: 'ask', n: 8, q: null },
  limit: { kind: 'ask', n: 8, q: 3 },
  pick: { kind: 'ask', n: 6, q: null },
  maybe: { kind: 'ask', n: 3, q: 1 },
  ahead: { kind: 'ahead', n: 8, q: 3 },
};

/** 언제나 맞힐 수 있을까의 판: 안 되는 판은 2를 q번 곱한 수보다 1~4 큰 끝, 되는 판은 그 수의 반보다 크고 그 수 이하인 끝 */
function maybeBoard(rng, impossible) {
  const q = randInt(rng, 2, 4);
  const top = rowKinds(q);
  const n = impossible ? top + randInt(rng, 1, Math.min(4, 2 * top - top)) : randInt(rng, top / 2 + 1, top);
  return { kind: 'ask', n, q };
}

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed) {
  const tie = tieOf(rung.level, seed);
  if (seed === 1) return { ...FIRSTS[rung.mode], tie };
  const rng = createRng(seedFrom('yesno', rung.level, seed));
  const pick = (list) => list[randInt(rng, 0, list.length - 1)];
  if (rung.mode === 'free') return { kind: 'ask', n: pick(FREE_NS), q: null, tie };
  if (rung.mode === 'limit') {
    const n = pick(LIMIT_NS);
    return { kind: 'ask', n, q: fewestFor(n), tie };
  }
  if (rung.mode === 'pick') return { kind: 'ask', n: pick(PICK_NS), q: null, tie };
  if (rung.mode === 'maybe') return { ...maybeBoard(rng, maybeImpossible(seed)), tie };
  const [n, q] = pick(AHEAD_BOARDS);
  return { kind: 'ahead', n, q, tie };
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(1부터 4까지)을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  const board = shrink ? { kind: 'ask', n: 4, q: null, tie: tieOf(level, seed, 'small') } : boardAt(rung, seed);
  if (checkBoard(board) !== null) throw new Error(`규격에 맞지 않는 판이에요: ${checkBoard(board)}`);
  return { level, seed, small: shrink, board };
}

/** 다음 판 번호. 방금 한 판과 같은 판(숨길 수의 끝과 질문 수가 같은 판)이 나오는 번호는 건너뛴다 */
export function nextSeed(level, seed) {
  const rung = rungOf(level);
  if (rung.mode === 'make') return seed + 1;
  const before = boardAt(rung, seed);
  let next = seed + 1;
  while (sameBoard(boardAt(rung, next), before)) next += 1;
  return next;
}

// ---- 더 작은 판 ----

/** 판이 되는 판인가(질문 수를 정하지 않은 판은 늘 된다) */
export const possibleOf = (board) => (board.q === null ? true : board.kind === 'ahead' ? canPrepare(board.n, board.q) : canPin(board.n, board.q));

/**
 * 더 작은 판들. 되는 판(yes)과 안 되는 판(no)으로 나눠 낸다. 같은 판에는 늘 같은 판들이 나온다.
 *   질문 수를 정하지 않은 판: 숨길 수의 끝이 절반쯤인 판, 그보다 하나 작은 판(2 이상)
 *   정한 질문 수 안에(질문 수가 가장 적은 질문 수와 같다): 질문이 하나 적은 판의 가장 큰 끝과 그보다 하나 작은 끝(질문 수는 다시 가장 적게)
 *   언제나 맞힐 수 있을까와 직접 만든 판: 질문이 하나 적은(1번이면 그대로) 되는 판(끝이 2를 그만큼 곱한 수, 그보다 하나 작은 수)과
 *     안 되는 판(그보다 1, 2 큰 수). 모두 원래 판보다 끝이 작다
 *   미리 정하기: 질문이 하나 적은 판(끝이 2를 그만큼 곱한 수, 그보다 하나 작은 수)
 * @param {object} origin { mode, board }
 * @returns {{ yes: object[], no: object[] }}
 */
export function smallBoards(origin) {
  const { board, mode } = origin;
  const empty = { yes: [], no: [] };
  if (!board || checkBoard(board) !== null) return empty;
  const tie = (at) => seedFrom('yesno-small', boardKey(board), board.tie, at) % 100000;
  const keep = (list) => list.filter((item, at) => item.n >= 2 && item.n < board.n && list.findIndex((other) => other.n === item.n && other.q === item.q) === at);
  const named = (list) => keep(list).map((item, at) => ({ ...item, tie: tie(at) }));
  if (board.q === null) {
    const half = Math.max(2, Math.floor(board.n / 2));
    return { yes: named([{ kind: 'ask', n: half, q: null }, { kind: 'ask', n: half - 1, q: null }]), no: [] };
  }
  const q = Math.max(1, board.q - 1);
  const top = rowKinds(q);
  if (board.kind === 'ahead') return { yes: named([{ kind: 'ahead', n: top, q }, { kind: 'ahead', n: top - 1, q }]), no: [] };
  if (mode === 'limit') {
    const yes = [top, top - 1].map((n) => ({ kind: 'ask', n, q: n >= 2 ? fewestFor(n) : 1 }));
    return { yes: named(yes), no: [] };
  }
  const yes = named([{ kind: 'ask', n: top, q }, { kind: 'ask', n: top - 1, q }]);
  const no = named([{ kind: 'ask', n: top + 1, q }, { kind: 'ask', n: top + 2, q }]);
  return { yes, no };
}
