// 숫자 추리의 사다리(단계)와 판 만들어 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 암호 또는 표. 같은 번호는 늘 같은 판이다. 풀이 프로그램으로 확인한 판만 내보낸다.
import { allCodes, filterCodes, fits, judge, solveTable } from './code.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리. 기획한 표를 옮겼다.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'guess'(추측을 내서 알아내기) | 'table'(표만 보고 알아내기) | 'referee'(역할 바꾸기: 아이가 심판)
 *           | 'make'(아이가 직접 표를 만든다)
 *   length  암호의 자릿수
 *   digits  쓸 수 있는 숫자들
 *   rows    표의 줄 수의 [아래 끝, 위 끝]
 *
 * 임시로 정한 것: 4단계의 자릿수와 숫자(세 자리, 0~9), 4단계의 줄 수(3~5), 5단계의 자릿수(세 자리).
 * 4단계를 0~9로 하면 줄 수가 3·4·5줄로 고르게 나온다. 1~6으로 하면 거의 다 3줄이다(만들면서 세어 보았다).
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'guess', length: 3, digits: '123456' },
  { level: 2, tag: 'applied', mode: 'guess', length: 3, digits: '0123456789' },
  { level: 3, tag: 'applied', mode: 'guess', length: 4, digits: '0123456789' },
  { level: 4, tag: 'challenge', mode: 'table', length: 3, digits: '0123456789', rows: [3, 5] },
  { level: 5, tag: 'challenge', mode: 'referee', length: 3, digits: '0123456789' },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 만들어 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 직접 만들기의 자릿수, 고를 수 있는 숫자들, 줄 수의 위 끝(모두 임시) */
export const MAKE_LENGTH = 3;
export const MAKE_DIGITS = ['123456', '0123456789'];
export const MAKE_MAX_ROWS = 8;

/** 맨 아래 단계의 작은 판에서 쓰는 숫자(임시). 수준 맞추기가 "작은 판부터"라고 할 때만 쓴다. */
const SMALL_DIGITS = '12345';
/** 표 하나를 고르려고 다시 뽑아 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다). */
const MAX_TRIES = 400;
/** 표를 만들 때 줄을 모아 보는 수의 위 끝 */
const MAX_DRAFT_ROWS = 10;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

const pick = (rng, list) => list[randInt(rng, 0, list.length - 1)];

/**
 * 답이 꼭 하나인 표를 만든다. 암호를 하나 정하고, 누가 그 암호를 맞히려고 낸 것 같은 추측들을 모은 다음,
 * 빼도 답이 하나로 남는 줄(군더더기)을 뺀다. 줄 수가 범위를 벗어나면 null.
 */
export function makeTable(rng, length, digits, [fewest, most]) {
  const codes = allCodes(length, digits);
  const secret = pick(rng, codes);
  let left = codes;
  let rows = [];
  for (let turn = 0; turn < MAX_DRAFT_ROWS * 4 && left.length > 1 && rows.length < MAX_DRAFT_ROWS; turn++) {
    // 절반쯤은 남은 후보 가운데서, 절반쯤은 아무 암호나 낸다(답과 안 맞는 추측도 섞여야 표가 한 가지 꼴로 굳지 않는다).
    const guess = rng() < 0.5 ? pick(rng, left) : pick(rng, codes);
    if (guess === secret) continue;
    const row = { guess, ...judge(guess, secret) };
    const next = left.filter((code) => fits(code, row));
    if (next.length === left.length) continue; // 아무것도 알려 주지 않는 줄
    rows.push(row);
    left = next;
  }
  if (left.length !== 1) return null;
  // 군더더기 줄을 뺀다. 뒤의 줄부터 따져서, 빼도 답이 하나로 남으면 뺀다.
  for (let index = rows.length - 1; index >= 0; index--) {
    const without = rows.filter((_, at) => at !== index);
    if (filterCodes(codes, without).length === 1) rows = without;
  }
  if (rows.length < fewest || rows.length > most) return null;
  return { secret, rows };
}

/**
 * 판 하나를 만든다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 숫자가 적은 판을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object, solution: object}}
 *   board     guess:   { mode, length, digits, secret }
 *             table:   { mode, length, digits, rows }   (답은 solution.secret)
 *             referee: { mode, length, digits }         (암호는 아이가 정한다)
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 만들어 내지 않아요');
  const shrink = small && level === LADDER[0].level;
  const digits = shrink ? SMALL_DIGITS : rung.digits;
  const { length, mode } = rung;
  const rng = createRng(seedFrom('code', level, seed, shrink ? 'small' : 'any'));
  const start = allCodes(length, digits).length;

  if (mode === 'guess') {
    const secret = pick(rng, allCodes(length, digits));
    return { level, seed, small, board: { mode, length, digits, secret }, solution: { possible: true, secret, start } };
  }
  if (mode === 'referee') {
    return { level, seed, small, board: { mode, length, digits }, solution: { possible: true, secret: null, start } };
  }
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const made = makeTable(rng, length, digits, rung.rows);
    if (!made) continue;
    // 풀이 프로그램으로 다시 확인한다: 모든 후보를 따져서 답이 꼭 하나다.
    const solved = solveTable(length, digits, made.rows);
    if (solved.count !== 1 || solved.secret !== made.secret) continue;
    return { level, seed, small, board: { mode, length, digits, rows: made.rows }, solution: { possible: true, ...solved } };
  }
  throw new Error(`표를 만들지 못했어요: ${level}단계 ${seed}번`);
}

const sameBoard = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 다음 판 번호. 방금 한 판과 똑같은 판이 나오는 번호는 건너뛴다(역할 바꾸기는 판이 늘 같아 보이므로 그냥 다음 번호다). */
export function nextSeed(level, seed, options = {}) {
  const now = generateBoard(level, seed, options).board;
  if (now.mode === 'referee') return seed + 1;
  for (let next = seed + 1; next < seed + 40; next++) {
    if (!sameBoard(generateBoard(level, next, options).board, now)) return next;
  }
  return seed + 1;
}
