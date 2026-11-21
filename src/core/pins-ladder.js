// 핀에 실 감기의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 핀 수와 칸 수는 시드 난수(rng.js)로 고른다.
//
// 감아 보기와 짐작하고 감기는 실이 여러 가닥인 판과 한 가닥인 판이 번갈아 나온다(판 번호가 홀수면 여러 가닥).
// 실이 한 가닥인지 여러 가닥인지는 실제로 감아 본 결과(src/core/pins.js의 countOf)로 가른다.
// 첫 판은 핀 6개를 2칸씩 감는 판이다(세모 두 개, 실 2가닥). 실패할 수 없다(다음 핀은 늘 하나이고, 무를 수 있다).
import { MIN_PINS, checkBoard, choicesOf, copyBoard, countOf, halfOf, sameBoard } from './pins.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag   'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode  'wind'(감아 보기) | 'guess'(짐작하고 감기) | 'table'(표 만들기) | 'one'(한 가닥으로 다 감기)
 *         | 'predict'(핀 12개와 13개: 여러 가닥인 칸 수가 있을지 짐작하고 깨 보기) | 'make'(직접 만든다)
 *   pins  나올 수 있는 핀 수
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'wind', pins: [5, 6, 7, 8, 9, 10] },
  { level: 2, tag: 'basic', mode: 'guess', pins: [6, 7, 8, 9, 10, 11, 12] },
  { level: 3, tag: 'applied', mode: 'table', pins: [8, 9, 10, 12] },
  { level: 4, tag: 'applied', mode: 'one', pins: [9, 10, 12, 14, 15, 16] },
  { level: 5, tag: 'challenge', mode: 'predict', pins: [7, 9, 11, 13, 14, 15, 16] },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 단계마다의 첫 판(판 번호 1). 표 만들기의 첫 판은 핀 12개, 맞히기의 첫 판은 핀 13개다 */
const FIRST = { 1: { n: 6, k: 2 }, 2: { n: 9, k: 3 }, 3: { n: 12, k: null }, 4: { n: 9, k: null }, 5: { n: 13, k: null } };
/** 맞히기의 둘째 판: 핀 15개(2칸씩은 한 가닥이라 더 찾아봐야 한다) */
const SECOND_PREDICT = { n: 15, k: null };

/** 어느 칸 수로 감아도 실 한 가닥인 핀 수(맞히기 판에서 고르는 데 쓴다. 실제로 감아 본 결과로 가른다) */
const isAllOne = (n) => choicesOf(n).every((k) => countOf(n, k).count === 1);

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 감아 보기와 짐작하고 감기: 판 번호가 홀수면 여러 가닥, 짝수면 한 가닥인 판 */
export const manyAt = (seed) => seed % 2 === 1;

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed) {
  if (seed === 1) return copyBoard(FIRST[rung.level]);
  if (rung.mode === 'predict' && seed === 2) return copyBoard(SECOND_PREDICT);
  const rng = createRng(seedFrom('pins', rung.level, seed));
  const pick = (list) => list[randInt(rng, 0, list.length - 1)];
  if (rung.mode === 'wind' || rung.mode === 'guess') {
    // 칸 수는 2부터 핀 수의 절반보다 작은 수까지(1칸씩은 둘레를 한 바퀴 도는 것뿐이고, 절반이면 실이 핀 둘을 오가기만 한다)
    const many = manyAt(seed);
    const all = [];
    for (const n of rung.pins) for (let k = 2; 2 * k < n; k++) if ((countOf(n, k).count > 1) === many) all.push({ n, k });
    return pick(all);
  }
  if (rung.mode === 'predict') {
    // 판마다 반쯤은 어느 칸 수로도 한 가닥인 핀 수, 반쯤은 여러 가닥인 칸 수가 있는 핀 수
    const one = randInt(rng, 0, 1) === 0;
    return { n: pick(rung.pins.filter((n) => isAllOne(n) === one)), k: null };
  }
  return { n: pick(rung.pins), k: null };
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(첫 판)을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  return { level, seed, small: shrink, board: boardAt(rung, shrink ? 1 : seed) };
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

/** 표 만들기와 한 가닥으로 다 감기의 작은 판에 쓸 핀 수 */
const SMALL_TABLE = [6, 8, 9, 10, 12];
/** 맞히기의 작은 판: 어느 칸 수로도 한 가닥인 핀 수와 그렇지 않은 핀 수 */
const SMALL_ONE = [5, 7, 11];
const SMALL_MANY = [6, 8, 9, 10, 12];

/**
 * 더 작은 판들(많아야 둘). 같은 판에는 늘 같은 판들이 나온다.
 *   칸 수가 있는 판: 핀이 더 적고 실 가닥 수가 같은 판. 한 가닥의 핀 수도 줄어든다(같은 칸 수를 먼저, 핀이 적은 것부터).
 *     한 가닥이 핀 셋 이상을 지나던 판은 작은 판에서도 셋 이상이다(실이 핀 둘을 오가는 판은 핀 둘짜리 판에서만 낸다).
 *     한 가닥이 핀 둘만 지나는 판(칸 수가 핀 수의 절반)은 더 줄일 수 없어 작은 판이 없다.
 *   표 만들기와 한 가닥으로 다 감기: 핀이 더 적은 판(핀 6개부터)
 *   맞히기: 핀이 더 적고, 어느 칸 수로도 한 가닥인지가 같은 판
 * @param {object} origin { mode, board }
 * @returns {object[]}
 */
export function smallBoards(origin) {
  const { board } = origin;
  if (checkBoard(board) !== null) return [];
  const { n, k } = board;
  if (k !== null) {
    const { count, per } = countOf(n, k);
    const floor = Math.min(3, per);
    const found = [];
    for (let size = MIN_PINS; size < n; size++) {
      for (let each = 1; each <= halfOf(size); each++) {
        const small = countOf(size, each);
        if (small.count === count && small.per >= floor && small.per < per) found.push({ n: size, k: each });
      }
    }
    // 같은 칸 수가 먼저, 그다음 1칸씩이 아닌 판(1칸씩은 둘레를 도는 것뿐이다), 그다음 핀이 적은 것부터
    found.sort((a, b) => Number(b.k === k) - Number(a.k === k) || Number(b.k > 1) - Number(a.k > 1) || a.n - b.n || a.k - b.k);
    return found.slice(0, 2);
  }
  if (origin.mode === 'predict') {
    const list = isAllOne(n) ? SMALL_ONE : SMALL_MANY;
    return list.filter((size) => size < n).slice(0, 2).map((size) => ({ n: size, k: null }));
  }
  return SMALL_TABLE.filter((size) => size < n).slice(0, 2).map((size) => ({ n: size, k: null }));
}
