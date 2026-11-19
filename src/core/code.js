// 숫자 추리의 규칙과 풀이 프로그램. 순수 함수만 둔다.
// 암호와 추측은 숫자 글자를 이은 글자열이다(예: '047'). 같은 숫자는 두 번 쓰지 않는다.
// 추측에 돌려주는 답은 두 수다.
//   hit    추측의 숫자 가운데 암호에 들어 있는 것의 수
//   place  그 가운데 자리까지 맞는 것의 수
// 표의 한 줄은 { guess, hit, place } 이다.
// 판의 종류에 따라 답의 한쪽만 알려 주기도 한다(fieldsOf). 그때 줄에는 알려 준 수만 적는다.
//   자리만 알려 주는 표(place)   { guess, place }
//   카드 세 장 맞히기(cards)     { guess, hit }. 숨긴 것과 고른 것이 차례가 없는 카드 묶음이라 hit만 뜻이 있다.
//                                 카드 묶음은 숫자를 작은 것부터 이은 글자열이다(예: '147').
import { createRng, randInt, seedFrom } from './rng.js';

/** 암호의 자릿수의 아래 끝과 위 끝. 두 자리는 "더 작은 판"(src/core/smaller.js)에서만 쓴다. 사다리와 직접 만들기는 세 자리부터다 */
export const MIN_LENGTH = 2;
export const MAX_LENGTH = 4;

/** 쓸 수 있는 숫자들(예: '123456')이 제대로 된 값인가. 문제가 없으면 null */
export function checkDigits(digits, length = 3) {
  if (typeof digits !== 'string' || !/^[0-9]+$/.test(digits)) return 'digits';
  if (new Set(digits).size !== digits.length) return 'digits';
  if (digits.length < length) return 'digits';
  return null;
}

/** 암호나 추측으로 쓸 수 있는 글자열인가. 문제가 없으면 null */
export function checkCode(code, length, digits) {
  if (typeof code !== 'string' || code.length !== length) return 'length';
  for (const ch of code) if (!digits.includes(ch)) return 'digit';
  if (new Set(code).size !== code.length) return 'repeat';
  return null;
}

/** 두 수 매기기: 추측과 암호를 견주어 들어 있는 숫자의 수와 자리도 맞는 것의 수를 낸다. */
export function judge(guess, secret) {
  let hit = 0;
  let place = 0;
  for (let index = 0; index < guess.length; index++) {
    if (secret[index] === guess[index]) place += 1;
    if (secret.includes(guess[index])) hit += 1;
  }
  return { hit, place };
}

/** 될 수 있는 암호를 모두 만든다(작은 것부터). 1~6에서 셋이면 120개, 0~9에서 셋이면 720개, 넷이면 5040개다. */
export function allCodes(length, digits) {
  const found = [];
  const build = (prefix) => {
    if (prefix.length === length) {
      found.push(prefix);
      return;
    }
    for (const ch of digits) if (!prefix.includes(ch)) build(prefix + ch);
  };
  build('');
  return found;
}

/** 될 수 있는 카드 묶음을 모두 만든다(숫자를 작은 것부터 이은 글자열, 작은 것부터). 1~9에서 셋이면 84개다. */
export function allSets(length, digits) {
  const found = [];
  const build = (prefix, from) => {
    if (prefix.length === length) {
      found.push(prefix);
      return;
    }
    for (let index = from; index < digits.length; index++) build(prefix + digits[index], index + 1);
  };
  build('', 0);
  return found;
}

/** 카드 묶음은 숫자를 작은 것부터 늘어놓는다. */
export const sortSet = (code) => [...code].sort().join('');

/** 카드 묶음으로 쓸 수 있는 글자열인가(서로 다른 숫자를 작은 것부터 이었다). 문제가 없으면 null */
export function checkSet(code, length, digits) {
  const problem = checkCode(code, length, digits);
  if (problem !== null) return problem;
  return sortSet(code) === code ? null : 'order';
}

/** 판의 종류마다 답에 적는 수: 두 수, 자리만(place), 들어 있는 카드의 수만(cards) */
export function fieldsOf(mode) {
  if (mode === 'place') return ['place'];
  if (mode === 'cards') return ['hit'];
  return ['hit', 'place'];
}

/** 추측의 답을 그 판의 꼴로 낸다(알려 주는 수만). */
export function replyOf(mode, guess, secret) {
  const full = judge(guess, secret);
  return Object.fromEntries(fieldsOf(mode).map((key) => [key, full[key]]));
}

/** 판의 종류마다 될 수 있는 것 모두: 카드 맞히기는 카드 묶음, 나머지는 암호 */
export const universe = (mode, length, digits) => (mode === 'cards' ? allSets(length, digits) : allCodes(length, digits));

/** 표의 한 줄을 알려 준 수만 남겨 베낀다. */
export function copyRow(row) {
  const copy = { guess: row.guess };
  if (row.hit !== undefined) copy.hit = row.hit;
  if (row.place !== undefined) copy.place = row.place;
  return copy;
}

/** 그 암호라면 이 줄의 답이 나오는가. 줄에 적힌 수만 견준다(한쪽만 알려 주는 판). */
export function fits(code, row) {
  const result = judge(row.guess, code);
  return (row.hit === undefined || result.hit === row.hit) && (row.place === undefined || result.place === row.place);
}

/** 그 암호가 모든 줄의 답과 맞는가 */
export const fitsAll = (code, rows) => rows.every((row) => fits(code, row));

/** 후보 가운데 모든 줄의 답과 맞는 것만 남긴다. */
export const filterCodes = (codes, rows) => codes.filter((code) => fitsAll(code, rows));

/** 그 암호가 어긋나는 첫 줄의 번호(0부터). 모두 맞으면 -1 */
export const firstMismatch = (code, rows) => rows.findIndex((row) => !fits(code, row));

/**
 * 줄을 차례로 따질 때 남는 후보의 수.
 * @returns {{start: number, counts: number[], left: string[]}} start 처음 후보 수, counts 줄마다 남은 수, left 끝까지 남은 후보
 */
export function trailOf(length, digits, rows, mode = 'table') {
  let left = universe(mode, length, digits);
  const start = left.length;
  const counts = [];
  for (const row of rows) {
    left = left.filter((code) => fits(code, row));
    counts.push(left.length);
  }
  return { start, counts, left };
}

/**
 * 표를 푼다: 표의 모든 줄과 맞는 암호를 모든 후보에서 찾는다.
 * @returns {{count: number, secret: string|null, start: number, trail: number[]}}
 *   count 맞는 암호의 수, secret 하나뿐일 때의 그 암호, trail 줄마다 남은 후보 수
 */
export function solveTable(length, digits, rows) {
  const { start, counts, left } = trailOf(length, digits, rows);
  return { count: left.length, secret: left.length === 1 ? left[0] : null, start, trail: counts };
}

/** 군더더기 줄이 없는 표인가: 답이 하나뿐이고, 줄을 하나라도 빼면 답이 여럿이 된다. */
export function isLean(length, digits, rows) {
  const codes = allCodes(length, digits);
  if (filterCodes(codes, rows).length !== 1) return false;
  return rows.every((_, skip) => filterCodes(codes, rows.filter((__, index) => index !== skip)).length > 1);
}

/**
 * 컴퓨터의 다음 추측. 남은 후보 가운데서만 고른다. 같은 (시드, 차례)는 늘 같은 것을 고른다.
 * @param {string[]} candidates 지금까지의 답과 모두 맞는 후보
 * @param {number} seed 판 번호
 * @param {number} turn 몇 번째 추측인가(0부터)
 */
export function nextGuess(candidates, seed, turn) {
  if (candidates.length === 0) return null;
  const rng = createRng(seedFrom('code-guess', seed ?? 0, turn));
  return candidates[randInt(rng, 0, candidates.length - 1)];
}

/**
 * 컴퓨터가 혼자 끝까지 맞혀 본다(심판이 늘 바르게 답할 때).
 * @returns {{guess: string, hit: number, place: number, left: number}[]} 추측과 답, 그 뒤에 남은 후보 수
 */
export function playComputer(secret, digits, seed) {
  let candidates = allCodes(secret.length, digits);
  const rows = [];
  while (candidates.length > 0) {
    const guess = nextGuess(candidates, seed, rows.length);
    const row = { guess, ...judge(guess, secret) };
    candidates = candidates.filter((code) => fits(code, row));
    rows.push({ ...row, left: candidates.length });
    if (row.place === secret.length) break;
  }
  return rows;
}

/** 표의 줄들이 제대로 된 값인가. 판의 종류가 알려 주는 수만 적혀 있어야 한다. 문제가 없으면 null */
export function checkRows(rows, length, digits, mode = 'table') {
  if (!Array.isArray(rows)) return 'rows';
  const fields = fieldsOf(mode);
  for (const row of rows) {
    if (!row || typeof row !== 'object') return 'rows';
    if ((mode === 'cards' ? checkSet : checkCode)(row.guess, length, digits) !== null) return 'guess';
    for (const key of ['hit', 'place']) {
      const value = row[key];
      if (!fields.includes(key)) {
        if (value !== undefined) return 'reply';
      } else if (!Number.isInteger(value) || value < 0 || value > length) return 'reply';
    }
  }
  return null;
}

/**
 * 판의 종류: 추측해서 알아내기, 표만 보고 알아내기, 역할 바꾸기,
 * 자리만 알려 주는 표, 카드 세 장 맞히기(있다/없다만), 한 번 거짓말하는 표
 */
export const MODES = ['guess', 'table', 'referee', 'place', 'cards', 'lie'];
/** 표만 보고 암호를 넣는 판의 종류 */
export const TABLE_MODES = ['table', 'place', 'lie'];
/** 아이가 물어서 알아내는 판의 종류 */
export const ASK_MODES = ['guess', 'cards'];

/** 판이 제대로 된 값인가. 문제가 없으면 null */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'board';
  if (!MODES.includes(board.mode)) return 'mode';
  if (!Number.isInteger(board.length) || board.length < MIN_LENGTH || board.length > MAX_LENGTH) return 'length';
  if (checkDigits(board.digits, board.length) !== null) return 'digits';
  if (board.mode === 'guess') return checkCode(board.secret, board.length, board.digits);
  if (board.mode === 'cards') return checkSet(board.secret, board.length, board.digits);
  if (TABLE_MODES.includes(board.mode)) {
    const problem = checkRows(board.rows, board.length, board.digits, board.mode);
    if (problem !== null) return problem;
    return board.rows.length > 0 ? null : 'rows';
  }
  return null;
}

/**
 * 표만 보고 알아내기에서 넣은 암호를 따진다. 틀렸으면 어긋나는 첫 줄을 가리킨다.
 * @returns {{correct: boolean, guess: string|null, row: number|null}} row 어긋나는 첫 줄(0부터)
 */
export function diagnoseTable(code, rows) {
  const row = firstMismatch(code, rows);
  if (row < 0) return { correct: true, guess: null, row: null };
  return { correct: false, guess: 'table-row', row };
}

/**
 * 역할 바꾸기에서 아이가 넣은 두 수를 따진다.
 * 같은 추측에 처음 어긋났을 때는 견줘 보자고만 하고, 또 어긋나면 두 수 가운데 어느 쪽인지 하나만 짚는다.
 * @param {{hit: number, place: number}} reply 아이가 넣은 두 수
 * @param {number} wrongBefore 이 추측에 앞서 어긋난 답을 넣은 횟수
 */
export function diagnoseReply(guess, secret, reply, wrongBefore = 0) {
  const real = judge(guess, secret);
  if (real.hit === reply.hit && real.place === reply.place) return { correct: true, guess: null };
  if (wrongBefore === 0) return { correct: false, guess: 'referee-reply' };
  return { correct: false, guess: real.hit !== reply.hit ? 'referee-hit' : 'referee-place' };
}

// ---- 한 번 거짓말하는 표: 줄 가운데 딱 하나가 거짓이다 ----

/** 그 암호라면 거짓이 되는 줄의 번호들(0부터) */
export const falseRows = (code, rows) => rows.flatMap((row, index) => (fits(code, row) ? [] : [index]));

/**
 * 한 번 거짓말하는 표를 푼다: 딱 한 줄만 어긋나는 암호를 모든 후보에서 찾는다.
 * @returns {{count: number, secret: string|null, lie: number|null, start: number, honest: number}}
 *   count 딱 한 줄만 어긋나는 암호의 수, secret 하나뿐일 때의 그 암호, lie 그때 거짓인 줄(0부터),
 *   honest 모든 줄과 맞는 암호의 수(이런 암호는 "딱 하나는 거짓"에 맞지 않는다)
 */
export function solveLie(length, digits, rows) {
  const codes = allCodes(length, digits);
  const found = [];
  let honest = 0;
  for (const code of codes) {
    const wrong = falseRows(code, rows);
    if (wrong.length === 1) found.push({ code, lie: wrong[0] });
    else if (wrong.length === 0) honest += 1;
  }
  const one = found.length === 1 ? found[0] : null;
  return { count: found.length, secret: one ? one.code : null, lie: one ? one.lie : null, start: codes.length, honest };
}

/** 답이 하나로 정해지는 한 번 거짓말하는 표인가: 딱 한 줄만 어긋나는 암호가 하나뿐이고, 모든 줄과 맞는 암호는 없다. */
export function isLieTable(length, digits, rows) {
  const solved = solveLie(length, digits, rows);
  return solved.count === 1 && solved.honest === 0;
}

/**
 * 한 번 거짓말하는 표에서 넣은 암호를 따진다.
 * 거짓인 줄이 둘 이상이 되면 그 가운데 앞의 두 줄을 가리키고, 모든 줄이 참이 되면 그렇다고만 한다.
 * @returns {{correct: boolean, guess: string|null, rows: number[]}} rows 가리키는 줄(0부터)
 */
export function diagnoseLie(code, rows) {
  const wrong = falseRows(code, rows);
  if (wrong.length === 1) return { correct: true, guess: null, rows: [] };
  if (wrong.length === 0) return { correct: false, guess: 'lie-none', rows: [] };
  return { correct: false, guess: 'lie-two', rows: wrong.slice(0, 2) };
}
