// 암호 놀이의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 판은 시드 난수(rng.js)로 고른다.
// 판의 글은 대본(src/content/cipher.json의 messages)에 있다. src/core는 대본을 불러오지 않으므로, 글 묶음(book)을 받아서 판을 낸다.
// 화면 코드는 makeLadder(T.messages)로 사다리를 만들어 틀에 내놓고, 테스트는 대본을 읽어 같은 것을 만든다.
//
// 고르는 잣대
//   미는 암호 풀기(decode)  자음을 2~11칸 민다. 밀다가 ㅎ을 지나 ㄱ으로 돌아가는 글자가 하나 이상 있다(숫자 판은 9를 지나 0으로)
//   열쇠 찾기(findkey)      자음을 2~12칸 민다. 열쇠는 알려 주지 않는다
//   글자를 수로(table)      글자표의 수(자음 1~14, 모음 15~24)로 적는다. 판 번호를 3으로 나눈 나머지가 1이면 그대로, 아니면 자음의 수에 2~12를 더한다(14를 넘는 수가 하나 이상)
//   달아난 숫자(sum)        세 자리 덧셈이나 뺄셈에서 서너 자리를 가린다. 채우는 방법이 하나뿐이고, 받아올림(받아내림)을 따져야 채울 수 있는 자리가 있다
//   자주 나오는 글자(freq)  세 문장짜리 글의 자음과 모음을 함께 민다. 원래 글에서 ㅇ이 다른 어떤 자음보다 많은 글만 쓴다
import { RING_SIZE, carriesOf, carryCells, cellsOf, checkBoard, cipherOf, frequencyWorks, sameBoard, sizeOf, solveSum, sumHolds } from './cipher.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   'decode' | 'findkey' | 'table' | 'sum' | 'freq' | 'make'
 *   group  판의 글을 고르는 대본의 묶음
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'decode', group: 'short' },
  { level: 2, tag: 'basic', mode: 'findkey', group: 'words' },
  { level: 3, tag: 'applied', mode: 'table', group: 'table' },
  { level: 4, tag: 'applied', mode: 'sum' },
  { level: 5, tag: 'challenge', mode: 'freq', group: 'letters' },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 미는 암호 풀기에서 숫자 판(자물쇠 번호)이 나오는 판 번호: 3으로 나눈 나머지가 2인 판(2, 5, 8, …번) */
export const digitSeed = (seed) => seed % 3 === 2;
/** 글자를 수로에서 수를 더하지 않은 표가 나오는 판 번호: 3으로 나눈 나머지가 1인 판(1, 4, 7, …번) */
export const plainTableSeed = (seed) => seed % 3 === 1;
/** 달아난 숫자에서 뺄셈이 나오는 판 번호: 3으로 나눈 나머지가 0인 판(3, 6, 9, …번) */
export const subSeed = (seed) => seed % 3 === 0;

/** 1단계에서 "작은 판부터"일 때 글의 글자 수의 위 끝, 숫자 판의 자리 수 */
export const SMALL_TEXT = 5;
const DIGITS = 4;
/** 1단계 첫 판의 열쇠 */
export const FIRST_KEY = 3;
const SMALL_DIGITS = 3;
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

/** 원래 글의 자음 가운데 열쇠만큼 밀면 ㅎ을 지나 ㄱ 쪽으로 돌아가는 것이 있는가 */
export function wrapsAround(plain, c) {
  return cellsOf(plain).some((cell) => cell.parts.some((part) => part.ring === 'c' && part.index + c >= RING_SIZE.c));
}

/**
 * 0과 1로만 된 세 자리 이상의 숫자 줄인가. 그런 줄은 다른 수 체계의 수처럼 보이므로 판에 내지 않는다
 * (이 형식은 미는 것, 끝에서 처음으로 돌아가는 것, 열쇠, 글자표를 다룬다).
 */
export const looksLikeBits = (text) => text.length >= 3 && /^[01]+$/.test(text);

/** 숫자 줄 가운데 열쇠만큼 밀면 9를 지나 0 쪽으로 돌아가는 숫자가 있는가 */
export const digitsWrap = (plain, d) => [...plain].some((ch) => Number(ch) + d >= 10);

/** 묶음의 글 가운데 이 단계에 쓰는 글(자주 나오는 글자의 단계는 ㅇ이 가장 많은 글만) */
export function groupOf(book, rung) {
  const list = book?.[rung.group];
  if (!Array.isArray(list) || list.length === 0) throw new Error(`대본에 글 묶음이 없어요: ${rung.group}`);
  return rung.mode === 'freq' ? list.filter(frequencyWorks) : list;
}

/** 달아난 숫자의 세로셈 하나를 고른다. width: 위 수의 자리 수, hide: 가릴 자리 수 */
function randomSum(rng, op, width, hide) {
  const low = 10 ** (width - 1);
  const high = 10 ** width - 1;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    let a = randInt(rng, low, high);
    let b = randInt(rng, low, high);
    if (op === 'sub') {
      if (a < b) [a, b] = [b, a];
      if (a - b < low) continue;
    }
    const r = op === 'add' ? a + b : a - b;
    const rows = [String(a), String(b), String(r)];
    // 받아올림(받아내림)이 적어도 한 번 있다
    if (!carriesOf(op, rows).some((carry) => carry > 0)) continue;
    const spots = [];
    rows.forEach((row, line) => [...row].forEach((_, at) => spots.push([line, at])));
    const hidden = shuffle(rng, spots).slice(0, hide).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const board = { kind: 'sum', op, rows, hidden };
    if (!goodSum(board)) continue;
    return board;
  }
  return null;
}

/** 달아난 숫자의 좋은 판: 채우는 방법이 하나뿐이고, 받아올림을 따져야 채울 수 있는 가린 자리가 있다. 한 자리 수 전체를 가리지 않는다 */
export function goodSum(board) {
  if (checkBoard(board) !== null || !sumHolds(board.op, board.rows)) return false;
  if (board.rows.some(looksLikeBits)) return false;
  for (let line = 0; line < 3; line++) if (board.hidden.filter(([row]) => row === line).length === board.rows[line].length) return false;
  if (carryCells(board) === 0) return false;
  return solveSum(board, 2).count === 1;
}

/**
 * 판 하나를 만든다.
 * @param {object} rung 사다리의 단계
 * @param {number} seed 판 번호
 * @param {object} book 대본의 글 묶음
 */
function boardAt(rung, seed, book, { small = false } = {}) {
  const rng = createRng(seedFrom('cipher', rung.level, seed, small ? 'small' : ''));
  if (rung.mode === 'sum') {
    const op = subSeed(seed) ? 'sub' : 'add';
    const board = randomSum(rng, op, 3, seed === 1 ? 3 : randInt(rng, 3, 4));
    if (!board) throw new Error(`판을 만들지 못했어요: ${rung.level}단계 ${seed}번`);
    return board;
  }
  if (rung.mode === 'decode' && digitSeed(seed)) {
    const width = small ? SMALL_DIGITS : DIGITS;
    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      const plain = Array.from({ length: width }, () => String(randInt(rng, 0, 9))).join('');
      const d = randInt(rng, 2, 8);
      if (new Set(plain).size < width - 1 || !digitsWrap(plain, d)) continue;
      const board = { kind: 'digits', plain, keys: { d } };
      if (looksLikeBits(plain) || looksLikeBits(cipherOf(board))) continue;
      return board;
    }
    throw new Error(`판을 만들지 못했어요: ${rung.level}단계 ${seed}번`);
  }
  // 글의 차례: 단계마다 묶음을 한 번 섞어 두고 판 번호 차례로 쓴다(같은 글이 연달아 나오지 않게)
  let list = groupOf(book, rung);
  if (small && list.some((text) => sizeOf({ kind: 'text', plain: text }) <= SMALL_TEXT)) list = list.filter((text) => sizeOf({ kind: 'text', plain: text }) <= SMALL_TEXT);
  const order = shuffle(createRng(seedFrom('cipher-order', rung.level, small ? 'small' : '')), list);
  // 첫 판은 대본의 맨 앞 글이다(1단계는 열쇠 3칸으로 ㅎ을 지나는 글)
  const plain = seed === 1 && !small ? list[0] : order[(seed - 1) % order.length];
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    if (rung.mode === 'decode' && seed === 1 && !small && wrapsAround(plain, FIRST_KEY)) return { kind: 'text', plain, keys: { c: FIRST_KEY, v: 0 } };
    if (rung.mode === 'decode') {
      const c = randInt(rng, 2, 11);
      if (wrapsAround(plain, c)) return { kind: 'text', plain, keys: { c, v: 0 } };
    } else if (rung.mode === 'findkey') {
      return { kind: 'text', plain, keys: { c: randInt(rng, 2, 12), v: 0 } };
    } else if (rung.mode === 'table') {
      if (plainTableSeed(seed)) return { kind: 'text', plain, keys: { c: 0, v: 0 }, show: 'numbers' };
      const c = randInt(rng, 2, 12);
      if (wrapsAround(plain, c)) return { kind: 'text', plain, keys: { c, v: 0 }, show: 'numbers' };
    } else if (rung.mode === 'freq') {
      return { kind: 'text', plain, keys: { c: randInt(rng, 1, 13), v: randInt(rng, 1, 9) } };
    }
  }
  throw new Error(`판을 만들지 못했어요: ${rung.level}단계 ${seed}번`);
}

/**
 * 대본의 글 묶음으로 사다리를 만든다. 틀이 쓰는 것(LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed)을 돌려준다.
 * @param {object} book 대본의 messages({ short, words, table, letters })
 */
export function makeLadder(book) {
  /**
   * 판 하나를 낸다.
   * @param {number} level 1~5
   * @param {number} seed 판 번호(1부터)
   * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(짧은 글, 세 자리 숫자)을 낸다(수준 맞추기에서 쓴다)
   */
  function generateBoard(level, seed, { small = false } = {}) {
    const rung = rungOf(level);
    if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
    if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
    const shrink = small && level === LADDER[0].level;
    return { level, seed, small: shrink, board: boardAt(rung, seed, book, { small: shrink }) };
  }

  /** 다음 판 번호. 방금 한 판과 같은 판이 나오는 번호는 건너뛴다 */
  function nextSeed(level, seed, { small = false } = {}) {
    const rung = rungOf(level);
    if (rung.mode === 'make') return seed + 1;
    const shrink = small && level === LADDER[0].level;
    const before = boardAt(rung, seed, book, { small: shrink });
    let next = seed + 1;
    while (sameBoard(boardAt(rung, next, book, { small: shrink }), before)) next += 1;
    return next;
  }

  return { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed };
}

/** 더 작은 판을 고를 때 쓰는 글: 원래 글보다 글자가 적은 글(짧은 것부터 섞어서) */
function shorterTexts(rng, list, origin, most = 3) {
  const size = sizeOf(origin);
  return shuffle(rng, list.filter((text) => sizeOf({ kind: 'text', plain: text }) < size && text !== origin.plain)).slice(0, most);
}

/**
 * 더 작은 판들: 원래 판과 같은 종류의 더 작은 판.
 *   미는 암호 풀기, 직접 만든 판  더 짧은 글을 같은 열쇠로(숫자 판은 세 자리)
 *   열쇠 찾기                    더 짧은 글을 다른 열쇠로
 *   글자를 수로                  더 짧은 글을 같은 표로
 *   자주 나오는 글자             더 짧은 세 문장 글(ㅇ이 가장 많은 글)
 *   달아난 숫자                  같은 셈의 두 자리 세로셈에서 두 자리를 가린다
 * 모두 되는 판(yes)이다. 같은 판에는 늘 같은 판들이 나온다.
 * @param {object} origin { mode, board }
 * @param {object} book 대본의 글 묶음
 * @returns {{yes: object[], no: object[]}}
 */
export function smallBoards(origin, book) {
  const { mode, board } = origin;
  const rng = createRng(seedFrom('cipher-small', JSON.stringify(board)));
  const none = { yes: [], no: [] };
  if (board.kind === 'sum') {
    if (Math.max(...board.rows.map((row) => row.length)) <= 2) return none;
    const yes = [];
    for (let attempt = 0; attempt < 40 && yes.length < 2; attempt++) {
      const small = randomSum(rng, board.op, 2, 2);
      if (small && !yes.some((item) => sameBoard(item, small))) yes.push(small);
    }
    return { yes, no: [] };
  }
  if (board.kind === 'digits') {
    if (board.plain.length <= SMALL_DIGITS) return none;
    const yes = [];
    for (let attempt = 0; attempt < MAX_TRIES && yes.length < 2; attempt++) {
      const plain = Array.from({ length: SMALL_DIGITS }, () => String(randInt(rng, 0, 9))).join('');
      if (new Set(plain).size < SMALL_DIGITS - 1 || !digitsWrap(plain, board.keys.d) || yes.some((item) => item.plain === plain)) continue;
      const small = { kind: 'digits', plain, keys: { d: board.keys.d } };
      if (looksLikeBits(plain) || looksLikeBits(cipherOf(small))) continue;
      yes.push(small);
    }
    return { yes, no: [] };
  }
  const keys = { c: board.keys?.c ?? 0, v: board.keys?.v ?? 0 };
  if (mode === 'freq') {
    const list = shorterTexts(rng, book.letters.filter(frequencyWorks), board, 2);
    return { yes: list.map((plain) => ({ kind: 'text', plain, keys: { c: randInt(rng, 1, 13), v: randInt(rng, 1, 9) } })), no: [] };
  }
  if (mode === 'table') {
    const list = shorterTexts(rng, book.table, board);
    return { yes: list.map((plain) => ({ kind: 'text', plain, keys: { c: keys.c, v: 0 }, show: 'numbers' })), no: [] };
  }
  if (mode === 'findkey') {
    const list = shorterTexts(rng, [...book.words, ...book.short], board);
    return { yes: list.map((plain) => ({ kind: 'text', plain, keys: { c: randInt(rng, 2, 12), v: 0 } })), no: [] };
  }
  // 미는 암호 풀기와 직접 만든 판: 같은 열쇠로 더 짧은 글
  const list = shorterTexts(rng, book.short, board);
  return { yes: list.map((plain) => ({ kind: 'text', plain, keys })), no: [] };
}
