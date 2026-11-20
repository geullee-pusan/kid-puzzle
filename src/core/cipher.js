// 암호 놀이의 판과 풀이 프로그램. 순수 함수만 둔다.
// 글자는 한글 자모 스물네 개와 숫자 열 개만 쓴다(다른 나라 글자는 쓰지 않는다).
//   자음 바퀴(c)  ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ 열네 칸. ㅎ 다음은 다시 ㄱ이다
//   모음 바퀴(v)  ㅏ ㅑ ㅓ ㅕ ㅗ ㅛ ㅜ ㅠ ㅡ ㅣ 열 칸. ㅣ 다음은 다시 ㅏ다
//   숫자 바퀴(d)  0~9 열 칸. 9 다음은 다시 0이다
// 미는 암호: 바퀴마다 열쇠(몇 칸 미는지)가 있다. 글자의 첫소리와 받침은 자음 바퀴로, 가운데 소리는 모음 바퀴로 민다.
// 받침이 될 수 있는 자음은 열네 개 모두이므로, 자음을 밀어도 글자는 늘 한 글자로 모인다(뜻은 없는 글자가 된다).
// 그래서 판의 글에는 쌍자음, 겹받침, 두 소리가 섞인 모음이 없는 글자만 쓴다(checkText가 본다).
// 자모는 유니코드의 번호 셈으로 만든다(한글 글자 = 0xAC00 + (첫소리 × 21 + 가운데 소리) × 28 + 받침). 자모 글자를 이 파일에 적어 두지 않는다.
//
// 판의 종류(board.kind)
//   text    글. keys = { c, v }(자음 열쇠 0~13, 모음 열쇠 0~9). show가 'numbers'면 글자표의 수로 보인다
//           (자음 ㄱ~ㅎ은 1~14, 모음 ㅏ~ㅣ는 15~24. 자음의 수에 열쇠만큼 더하고 14를 넘으면 14를 뺀다)
//   digits  자물쇠 번호 같은 숫자 줄. keys = { d }
//   sum     달아난 숫자: 세로셈(덧셈이나 뺄셈)에서 몇 자리가 가려져 있다. rows = [위 수, 가운데 수, 아래 수], hidden = [[줄, 자리], …]

/** 바퀴마다의 칸 수 */
export const RING_SIZE = { c: 14, v: 10, d: 10 };
export const RINGS = ['c', 'v', 'd'];

// ---- 자모: 유니코드 번호 셈 ----
const SYLLABLE_BASE = 0xac00;
const SYLLABLE_LAST = 0xd7a3;
const COMPAT_BASE = 0x3131;
/** 기본 자음 열네 개의 호환 자모 번호(ㄱ 0x3131에서 떨어진 칸) */
const CONSONANT_OFFSETS = [0, 3, 6, 8, 16, 17, 20, 22, 23, 25, 26, 27, 28, 29];
/** 기본 모음 열 개의 호환 자모 번호(ㄱ 0x3131에서 떨어진 칸) */
const VOWEL_OFFSETS = [30, 32, 34, 36, 38, 42, 43, 47, 48, 50];
/** 첫소리 열아홉 개 가운데 기본 자음의 자리, 받침 스물여덟(받침 없음 포함) 가운데 기본 자음의 자리, 가운데 소리 스물하나 가운데 기본 모음의 자리 */
const INITIAL_INDEX = [0, 2, 3, 5, 6, 7, 9, 11, 12, 14, 15, 16, 17, 18];
const FINAL_INDEX = [1, 4, 7, 8, 16, 17, 19, 21, 22, 23, 24, 25, 26, 27];
const VOWEL_INDEX = [0, 2, 4, 6, 8, 12, 13, 17, 18, 20];

/** 바퀴에 놓이는 글자들(자음 열넷, 모음 열, 숫자 열) */
export const LETTERS = {
  c: CONSONANT_OFFSETS.map((offset) => String.fromCharCode(COMPAT_BASE + offset)),
  v: VOWEL_OFFSETS.map((offset) => String.fromCharCode(COMPAT_BASE + offset)),
  d: Array.from({ length: 10 }, (_, digit) => String(digit)),
};

/** 글자표의 수: 자음은 1~14, 모음은 15~24 */
export const tableNumber = (ring, index) => (ring === 'c' ? index + 1 : index + 15);

/** 판의 글에 함께 쓸 수 있는 글자(띄어쓰기와 문장 부호). 이것들은 밀지 않는다 */
const PLAIN_MARKS = new Set([' ', '.', ',', '?', '!']);

const mod = (value, n) => ((value % n) + n) % n;
const isInt = (value) => Number.isInteger(value);

/**
 * 한 글자를 나눈다.
 * @returns {{type: 'syllable', l: number, v: number, t: number} | {type: 'jamo', ring: 'c'|'v', index: number} | {type: 'digit', index: number} | {type: 'mark'} | null}
 *   syllable의 l, t는 자음 바퀴의 칸(t는 받침이 없으면 -1), v는 모음 바퀴의 칸. 쓸 수 없는 글자면 null
 */
export function splitChar(ch) {
  const code = ch.codePointAt(0);
  if (PLAIN_MARKS.has(ch)) return { type: 'mark' };
  if (ch >= '0' && ch <= '9' && ch.length === 1) return { type: 'digit', index: code - 48 };
  if (code >= SYLLABLE_BASE && code <= SYLLABLE_LAST) {
    const n = code - SYLLABLE_BASE;
    const final = n % 28;
    const vowel = Math.floor(n / 28) % 21;
    const initial = Math.floor(n / 28 / 21);
    const l = INITIAL_INDEX.indexOf(initial);
    const v = VOWEL_INDEX.indexOf(vowel);
    const t = final === 0 ? -1 : FINAL_INDEX.indexOf(final);
    if (l < 0 || v < 0 || (final !== 0 && t < 0)) return null;
    return { type: 'syllable', l, v, t };
  }
  const c = CONSONANT_OFFSETS.indexOf(code - COMPAT_BASE);
  if (c >= 0) return { type: 'jamo', ring: 'c', index: c };
  const v = VOWEL_OFFSETS.indexOf(code - COMPAT_BASE);
  if (v >= 0) return { type: 'jamo', ring: 'v', index: v };
  return null;
}

/** 첫소리, 가운데 소리, 받침(자음 바퀴와 모음 바퀴의 칸)으로 한 글자를 만든다. t가 -1이면 받침이 없다 */
export function joinSyllable(l, v, t = -1) {
  const final = t < 0 ? 0 : FINAL_INDEX[t];
  return String.fromCharCode(SYLLABLE_BASE + (INITIAL_INDEX[l] * 21 + VOWEL_INDEX[v]) * 28 + final);
}

/** 글이 판에 쓸 수 있는 글인가. 쓸 수 없으면 까닭, 쓸 수 있으면 null */
export function checkText(text, { digits = false } = {}) {
  if (typeof text !== 'string' || text.length === 0) return '글이 없어요';
  if (text.length > MAX_TEXT) return '글이 너무 길어요';
  if (text.trim() !== text || text.includes('  ')) return '띄어쓰기가 맞지 않아요';
  let letters = 0;
  for (const ch of text) {
    const part = splitChar(ch);
    if (!part || part.type === 'jamo') return `쓸 수 없는 글자예요: ${ch}`;
    if (part.type === 'digit' && !digits) return `숫자는 쓸 수 없어요: ${ch}`;
    if (part.type === 'syllable' && digits) return '숫자 판에는 숫자만 써요';
    if (part.type !== 'mark') letters += 1;
  }
  return letters === 0 ? '글자가 없어요' : null;
}

/** 판의 글의 길이 위 끝(글자 수) */
export const MAX_TEXT = 72;

/** 열쇠를 깨끗하게(없는 바퀴는 0) */
export function keysOf(board) {
  const keys = board?.keys ?? {};
  return { c: mod(keys.c ?? 0, 14), v: mod(keys.v ?? 0, 10), d: mod(keys.d ?? 0, 10) };
}

/**
 * 글을 민다. 자음(첫소리와 받침)은 keys.c칸, 모음은 keys.v칸, 숫자는 keys.d칸 앞으로. 음수면 뒤로 민다.
 * 띄어쓰기와 문장 부호는 그대로 둔다.
 */
export function shiftText(text, keys) {
  const c = keys.c ?? 0;
  const v = keys.v ?? 0;
  const d = keys.d ?? 0;
  let out = '';
  for (const ch of text) {
    const part = splitChar(ch);
    if (!part || part.type === 'mark') out += ch;
    else if (part.type === 'digit') out += LETTERS.d[mod(part.index + d, 10)];
    else if (part.type === 'jamo') out += part.ring === 'c' ? LETTERS.c[mod(part.index + c, 14)] : LETTERS.v[mod(part.index + v, 10)];
    else out += joinSyllable(mod(part.l + c, 14), mod(part.v + v, 10), part.t < 0 ? -1 : mod(part.t + c, 14));
  }
  return out;
}

/** 암호문: 판의 글을 열쇠만큼 민 것 */
export const cipherOf = (board) => (board.kind === 'sum' ? '' : shiftText(board.plain, keysOf(board)));

/** 바퀴를 돌린 만큼 거꾸로 밀어 읽은 글("바퀴대로 읽으면") */
export const readWith = (cipher, turns) => shiftText(cipher, { c: -(turns.c ?? 0), v: -(turns.v ?? 0), d: -(turns.d ?? 0) });

/**
 * 글을 칸으로 나눈다. 칸마다 글자 하나.
 *   syllable  { ch, type, parts: [{ ring, index }] } (첫소리, 가운데 소리, 받침 차례)
 *   digit     { ch, type, parts: [{ ring: 'd', index }] }
 *   mark      { ch, type, parts: [] }
 */
export function cellsOf(text) {
  return [...text].map((ch) => {
    const part = splitChar(ch);
    if (!part || part.type === 'mark' || part.type === 'jamo') return { ch, type: 'mark', parts: [] };
    if (part.type === 'digit') return { ch, type: 'digit', parts: [{ ring: 'd', index: part.index }] };
    const parts = [{ ring: 'c', index: part.l }, { ring: 'v', index: part.v }];
    if (part.t >= 0) parts.push({ ring: 'c', index: part.t });
    return { ch, type: 'syllable', parts };
  });
}

/** 바퀴의 글자 하나를 가리키는 이름("c3", "v0", "d7") */
export const symbolId = (ring, index) => `${ring}${index}`;
export function parseSymbol(id) {
  const match = /^([cvd])(\d+)$/.exec(String(id));
  if (!match) return null;
  const ring = match[1];
  const index = Number(match[2]);
  return index < RING_SIZE[ring] ? { ring, index } : null;
}

/** 이 판에서 아이가 풀어야 하는 바퀴들. 글자표 판은 모든 자모(수로 적혀 있다), 그 밖에는 열쇠가 0이 아닌 바퀴 */
export function ringsToSolve(board) {
  if (board.kind === 'digits') return ['d'];
  if (board.kind !== 'text') return [];
  const keys = keysOf(board);
  if (board.show === 'numbers') return ['c', 'v'];
  return ['c', 'v'].filter((ring) => keys[ring] !== 0);
}

/**
 * 풀어야 할 암호 글자들(겹치지 않게, 글에 처음 나오는 차례). 암호문에 나오는 글자의 이름이다.
 * @returns {string[]}
 */
export function symbolsOf(board) {
  const rings = ringsToSolve(board);
  const seen = [];
  for (const cell of cellsOf(cipherOf(board))) {
    for (const part of cell.parts) {
      const id = symbolId(part.ring, part.index);
      if (rings.includes(part.ring) && !seen.includes(id)) seen.push(id);
    }
  }
  return seen;
}

/** 암호 글자 하나의 원래 글자(바퀴의 칸) */
export function plainOf(board, id) {
  const symbol = parseSymbol(id);
  const keys = keysOf(board);
  return mod(symbol.index - keys[symbol.ring], RING_SIZE[symbol.ring]);
}

/** 원래 글자(plain)를 열쇠만큼 밀면 무엇이 되는가 */
export const pushed = (board, ring, plain) => mod(plain + keysOf(board)[ring], RING_SIZE[ring]);

/** 열쇠가 없는 판에서 바퀴를 놓는 방법의 수: 판에서 민 바퀴들의 칸 수를 곱한다 */
export function keyCount(rings) {
  return rings.reduce((product, ring) => product * RING_SIZE[ring], 1);
}

/** 바퀴들을 돌린 모습 하나하나(맨 앞 바퀴부터 0, 1, 2, …). 테스트와 "모두 읽어 보기"에 쓴다 */
export function allTurns(rings) {
  let list = [{}];
  for (const ring of rings) {
    const next = [];
    for (const item of list) for (let turn = 0; turn < RING_SIZE[ring]; turn++) next.push({ ...item, [ring]: turn });
    list = next;
  }
  return list;
}

/** 이 판의 열쇠를 찾을 때 돌리는 바퀴들 */
export function turnRings(board) {
  if (board.kind === 'digits') return ['d'];
  if (board.kind !== 'text') return [];
  const keys = keysOf(board);
  return ['c', 'v'].filter((ring) => keys[ring] !== 0);
}

/** 바퀴들을 그렇게 돌렸을 때 판의 열쇠와 같은가 */
export function turnsMatch(board, turns) {
  const keys = keysOf(board);
  return RINGS.every((ring) => mod(turns[ring] ?? 0, RING_SIZE[ring]) === keys[ring]);
}

// ---- 자주 나오는 글자 ----

/** 글에 나오는 자음(첫소리와 받침)과 모음의 수. 바퀴의 칸마다 */
export function letterCounts(text) {
  const counts = { c: Array(14).fill(0), v: Array(10).fill(0), d: Array(10).fill(0) };
  for (const cell of cellsOf(text)) for (const part of cell.parts) counts[part.ring][part.index] += 1;
  return counts;
}

/** 가장 많이 나온 칸들(같은 수가 여럿이면 모두) */
export function mostCommon(list) {
  const top = Math.max(...list);
  if (top === 0) return [];
  return list.map((count, index) => (count === top ? index : -1)).filter((index) => index >= 0);
}

/** 우리말에서 가장 자주 나온다고 보는 자음: ㅇ(자음 바퀴의 일곱째 칸, 0부터 7) */
export const COMMON_CONSONANT = 7;

/**
 * 자주 나오는 글자로 열쇠 찾기: 암호문에서 가장 많이 나온 자음이 하나뿐이면, 그 자음을 ㅇ 자리에 맞춘 열쇠.
 * @returns {{top: number[], count: number, key: number|null}} 가장 많이 나온 자음이 여럿이면 key는 null
 */
export function frequencyGuess(cipher) {
  const counts = letterCounts(cipher).c;
  const top = mostCommon(counts);
  const count = top.length > 0 ? counts[top[0]] : 0;
  return { top, count, key: top.length === 1 ? mod(top[0] - COMMON_CONSONANT, 14) : null };
}

/** 판의 글로 자주 나오는 글자가 열쇠를 바로 알려 주는가: 원래 글에서 ㅇ이 다른 어떤 자음보다 많다 */
export function frequencyWorks(plain) {
  const top = mostCommon(letterCounts(plain).c);
  return top.length === 1 && top[0] === COMMON_CONSONANT;
}

// ---- 달아난 숫자 ----

/** 세로셈의 값: 위 수와 가운데 수를 더하거나 뺀 수 */
export const sumOf = (op, a, b) => (op === 'add' ? a + b : a - b);

/** 자리 숫자 줄들이 셈으로 맞는가(맨 앞 자리에는 0이 오지 않는다) */
export function sumHolds(op, rows) {
  if (rows.some((row) => row.length > 1 && row[0] === '0')) return false;
  const [a, b, r] = rows.map(Number);
  return sumOf(op, a, b) === r;
}

/** 가려진 자리를 채운 줄들 */
export function fillRows(rows, hidden, digits) {
  const grid = rows.map((row) => [...row]);
  hidden.forEach(([row, at], index) => {
    grid[row][at] = digits[index] === null || digits[index] === undefined ? null : String(digits[index]);
  });
  return grid;
}

/**
 * 달아난 숫자의 판을 푼다: 가려진 자리에 0~9를 모두 넣어 보고 맞는 채우기를 모은다.
 * @returns {{answers: number[][], count: number}}
 */
export function solveSum(board, limit = Infinity) {
  const answers = [];
  const h = board.hidden.length;
  const total = 10 ** h;
  // 줄마다 가린 자리를 0으로 둔 값과, 가린 자리 하나하나의 자릿값
  const base = board.rows.map((row, line) => {
    let value = 0;
    [...row].forEach((ch, at) => {
      const hidden = board.hidden.some(([r, a]) => r === line && a === at);
      value = value * 10 + (hidden ? 0 : Number(ch));
    });
    return value;
  });
  const place = board.hidden.map(([row, at]) => 10 ** (board.rows[row].length - 1 - at));
  const lead = board.hidden.map(([row, at]) => at === 0 && board.rows[row].length > 1);
  for (let code = 0; code < total && answers.length < limit; code++) {
    const values = base.slice();
    const digits = [];
    let rest = code;
    let ok = true;
    for (let index = 0; index < h; index++) {
      const digit = rest % 10;
      rest = Math.floor(rest / 10);
      if (digit === 0 && lead[index]) ok = false;
      digits.push(digit);
      values[board.hidden[index][0]] += digit * place[index];
    }
    if (ok && sumOf(board.op, values[0], values[1]) === values[2]) answers.push(digits);
  }
  return { answers, count: answers.length };
}

/** 세로셈의 자리마다 받아올림(덧셈)이나 받아내림(뺄셈): 오른쪽(일의 자리)부터, 그 자리에서 다음 자리로 넘긴 수 */
export function carriesOf(op, rows) {
  const width = Math.max(...rows.map((row) => row.length));
  const pad = rows.map((row) => row.padStart(width, '0'));
  const carries = [];
  let carry = 0;
  for (let at = width - 1; at >= 0; at--) {
    const a = Number(pad[0][at]);
    const b = Number(pad[1][at]);
    if (op === 'add') {
      const total = a + b + carry;
      carry = total >= 10 ? 1 : 0;
    } else {
      const total = a - b - carry;
      carry = total < 0 ? 1 : 0;
    }
    carries.push(carry);
  }
  return carries;
}

/**
 * 받아올림을 따져야 채울 수 있는 가려진 자리의 수: 그 자리로 받아올림(받아내림)이 들어오거나,
 * 아래 수의 맨 앞 자리가 받아올림으로만 생긴 자리다.
 */
export function carryCells(board) {
  const width = Math.max(...board.rows.map((row) => row.length));
  const carries = carriesOf(board.op, board.rows);
  let n = 0;
  for (const [row, at] of board.hidden) {
    const column = width - board.rows[row].length + at; // 왼쪽부터 센 자리
    const fromRight = width - 1 - column;
    const carryIn = fromRight === 0 ? 0 : carries[fromRight - 1];
    const fromCarry = board.op === 'add' && row === 2 && board.rows[2].length > Math.max(board.rows[0].length, board.rows[1].length) && at === 0;
    if (carryIn > 0 || fromCarry) n += 1;
  }
  return n;
}

// ---- 판 ----

/** 판이 규격에 맞는가. 맞지 않으면 까닭, 맞으면 null */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return '판이 없어요';
  if (board.kind === 'text') {
    const problem = checkText(board.plain);
    if (problem) return problem;
    if (board.show !== undefined && board.show !== 'letters' && board.show !== 'numbers') return '보이는 꼴이 맞지 않아요';
    const keys = board.keys ?? {};
    if (!isInt(keys.c ?? 0) || !isInt(keys.v ?? 0) || (keys.c ?? 0) < 0 || (keys.c ?? 0) >= 14 || (keys.v ?? 0) < 0 || (keys.v ?? 0) >= 10) return '열쇠가 맞지 않아요';
    if (keys.d !== undefined) return '글 판에는 숫자 열쇠가 없어요';
    if (board.show === 'numbers' && (keys.v ?? 0) !== 0) return '글자표 판은 자음의 수에만 더해요';
    if (board.show !== 'numbers' && (keys.c ?? 0) === 0 && (keys.v ?? 0) === 0) return '열쇠가 없어요';
    return null;
  }
  if (board.kind === 'digits') {
    const problem = checkText(board.plain, { digits: true });
    if (problem) return problem;
    const d = board.keys?.d;
    if (!isInt(d) || d < 1 || d > 9) return '열쇠가 맞지 않아요';
    return null;
  }
  if (board.kind === 'sum') {
    if (board.op !== 'add' && board.op !== 'sub') return '셈이 맞지 않아요';
    if (!Array.isArray(board.rows) || board.rows.length !== 3) return '줄이 셋이어야 해요';
    if (!board.rows.every((row) => typeof row === 'string' && /^\d{1,5}$/.test(row))) return '줄은 숫자예요';
    if (!sumHolds(board.op, board.rows)) return '셈이 맞지 않아요';
    if (!Array.isArray(board.hidden) || board.hidden.length < 1 || board.hidden.length > 5) return '가린 자리가 맞지 않아요';
    const seen = new Set();
    for (const spot of board.hidden) {
      if (!Array.isArray(spot) || spot.length !== 2) return '가린 자리가 맞지 않아요';
      const [row, at] = spot;
      if (!isInt(row) || row < 0 || row > 2 || !isInt(at) || at < 0 || at >= board.rows[row].length) return '가린 자리가 맞지 않아요';
      if (seen.has(`${row}:${at}`)) return '같은 자리를 두 번 가렸어요';
      seen.add(`${row}:${at}`);
    }
    return null;
  }
  return '판의 종류가 없어요';
}

/** 판을 깊이 베낀다(값의 차례를 늘 같게) */
export function copyBoard(board) {
  if (board.kind === 'sum') return { kind: 'sum', op: board.op, rows: board.rows.slice(), hidden: board.hidden.map(([row, at]) => [row, at]) };
  if (board.kind === 'digits') return { kind: 'digits', plain: board.plain, keys: { d: board.keys.d } };
  const out = { kind: 'text', plain: board.plain, keys: { c: board.keys?.c ?? 0, v: board.keys?.v ?? 0 } };
  if (board.show === 'numbers') out.show = 'numbers';
  return out;
}

export const sameBoard = (a, b) => JSON.stringify(copyBoard(a)) === JSON.stringify(copyBoard(b));

/** 판의 크기: 글의 글자 수(띄어쓰기와 부호는 빼고)나 가린 자리의 수. 작은 판을 고를 때 쓴다 */
export function sizeOf(board) {
  if (board.kind === 'sum') return board.rows.join('').length + board.hidden.length;
  return [...board.plain].filter((ch) => !PLAIN_MARKS.has(ch)).length;
}

/**
 * 판을 푼다.
 *   글과 숫자 판: 암호문, 풀어야 할 글자들, 열쇠, 바퀴를 놓는 방법의 수
 *   달아난 숫자: 맞는 채우기의 수와 그 채우기(답이 하나뿐인 판만 사다리에 낸다)
 */
export function solve(board) {
  if (board.kind === 'sum') {
    const { answers, count } = solveSum(board);
    return { possible: count > 0, kind: 'sum', count, answer: count === 1 ? answers[0] : null };
  }
  const cipher = cipherOf(board);
  const rings = turnRings(board);
  return { possible: true, kind: board.kind, cipher, plain: board.plain, keys: keysOf(board), symbols: symbolsOf(board), rings, keyCount: keyCount(rings) };
}

// ---- 직접 만들기: 자모를 차례로 눌러 글을 쓴다 ----

/**
 * 누른 자모의 줄을 글자로 모은다. 쌍자음과 겹받침이 없으므로 모으는 방법은 하나뿐이다:
 * 모음 바로 앞의 자음은 그 글자의 첫소리이고, 그렇지 않은 자음은 앞 글자의 받침이다. 모을 수 없는 자모는 혼자 남는다.
 * @param {string[]} tokens 'c3', 'v0', ' ' 같은 것들
 * @returns {{text: string, whole: boolean}} whole: 혼자 남은 자모 없이 모두 글자가 되었는가
 */
export function composeTokens(tokens) {
  let text = '';
  let whole = true;
  let at = 0;
  const symbols = tokens.map((token) => (token === ' ' ? null : parseSymbol(token)));
  const isC = (index) => symbols[index]?.ring === 'c';
  const isV = (index) => symbols[index]?.ring === 'v';
  while (at < tokens.length) {
    if (tokens[at] === ' ') {
      text += ' ';
      at += 1;
      continue;
    }
    if (isC(at) && isV(at + 1)) {
      const l = symbols[at].index;
      const v = symbols[at + 1].index;
      // 받침: 다음 자음 뒤에 모음이 오지 않을 때만
      if (isC(at + 2) && !isV(at + 3)) {
        text += joinSyllable(l, v, symbols[at + 2].index);
        at += 3;
      } else {
        text += joinSyllable(l, v);
        at += 2;
      }
      continue;
    }
    const symbol = symbols[at];
    text += symbol ? LETTERS[symbol.ring][symbol.index] : '';
    whole = false;
    at += 1;
  }
  return { text, whole };
}

/** 글을 누른 자모의 줄로 나눈다(composeTokens의 거꾸로) */
export function tokensOf(text) {
  const tokens = [];
  for (const cell of cellsOf(text)) {
    if (cell.ch === ' ') tokens.push(' ');
    for (const part of cell.parts) tokens.push(symbolId(part.ring, part.index));
  }
  return tokens;
}
