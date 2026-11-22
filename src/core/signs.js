// 부호 넣어 수 만들기의 판과 풀이. 순수 함수만 둔다.
// 판의 종류(kind):
//   'row'     줄: n, n−1, …, 2, 1을 차례로 쓰고 사이에 +나 −를 넣어 목표 수(target)를 만든다. 맨 앞의 수 앞에는 부호가 없다(늘 +다).
//   'all'     모두 찾기: 같은 줄로 1부터 top까지의 수 가운데 만들 수 없는 수를 모두 고른다.
//   'hop'     메뚜기: 0에서 출발해 1칸, 2칸, …, n칸을 차례로 뛴다. 한 번 뛸 때마다 왼쪽이나 오른쪽을 고른다. 닿을 곳(target)에 설 수 있을까.
//   'largest' 가장 큰 수: 같은 줄로 모두 +일 때보다 작은 수 가운데 만들 수 없는 가장 큰 수를 묻는다.
// 부호: signs[i]는 (i+2)번째 수 앞의 부호 '+' 또는 '-'다. 길이는 n−1이다. 처음에는 모두 '+'다.
// 뜀: dirs[i]는 (i+1)칸 뜀의 방향 1(오른쪽) 또는 -1(왼쪽)이다. 차례대로 하나씩 고른다.
//
// 풀이: 부호를 고르는 2^(n−1)가지(메뚜기는 방향을 고르는 2^n가지)를 모두 해 보고, 나오는 수마다 한 가지 방법을 적어 둔다.
//   적어 두는 방법은 − 부호(왼쪽 뜀)가 가장 적은 것, 그 가운데 뒤쪽 수(작은 수)를 먼저 바꾼 것이다.
//   나오는 수마다 방법이 몇 가지인지도 센다.
// 까닭(테스트가 다른 방법으로 모두 해 보고 확인한다): 모두 +일 때의 수(total = 1 + 2 + … + n)에서 k 앞의 +를 −로 바꾸면 2k만큼 작아진다.
//   그래서 나오는 수는 늘 total과 홀짝이 같고 total보다 크지 않다. 줄(n부터 1까지)에서는 그 범위의 수가 모두 나온다
//   (1부터 n−1까지 몇 개를 고르면 그 합으로 0부터 끝까지의 수를 모두 만들 수 있어서). 메뚜기도 같다(첫 뜀도 고를 수 있어서 −total까지).
//   안 되는 까닭: 'big'(total보다 크다), 'parity'(total과 홀짝이 다르다). 둘 다이면 'big'으로 적는다(먼저 보이는 것).

/** 줄의 가장 큰 수(맨 앞의 수)와 메뚜기의 뜀 수: 2부터 10까지 */
export const MIN_N = 2;
export const MAX_N = 10;
/** 모두 찾기 띠의 칸 수 위 끝 */
export const MAX_TOP = 30;
/** 직접 만들기의 목표 수: 0부터 (모두 +일 때 + 이만큼)까지 */
export const MAKE_EXTRA = 5;

const KINDS = ['row', 'all', 'hop', 'largest'];

/** 1부터 n까지의 합(모두 +일 때의 수) */
export const totalOf = (n) => (n * (n + 1)) / 2;

/** 줄에 쓰는 수들: n, n−1, …, 1 */
export const numbersOf = (n) => Array.from({ length: n }, (_, index) => n - index);

const isN = (n) => Number.isInteger(n) && n >= MIN_N && n <= MAX_N;

/** 판이 규격에 맞는가. 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object' || !KINDS.includes(board.kind)) return 'kind';
  if (!isN(board.n)) return 'n';
  const total = totalOf(board.n);
  if (board.kind === 'row') {
    if (!Number.isInteger(board.target) || board.target < 0 || board.target > total + MAKE_EXTRA) return 'target';
  } else if (board.kind === 'all') {
    if (board.n < 3 || !Number.isInteger(board.top) || board.top < 2 || board.top > MAX_TOP) return 'top';
  } else if (board.kind === 'hop') {
    if (!Number.isInteger(board.target) || Math.abs(board.target) > total) return 'target';
  } else if (board.n < 3) return 'n';
  return null;
}

export function copyBoard(board) {
  const copy = { kind: board.kind, n: board.n };
  if (board.kind === 'row' || board.kind === 'hop') copy.target = board.target;
  if (board.kind === 'all') copy.top = board.top;
  return copy;
}

/** 판을 한 줄의 글로(같은 판인지 견주고, 적어 둘 때 쓴다) */
export function boardKey(board) {
  if (board.kind === 'all') return `all:${board.n}:${board.top}`;
  if (board.kind === 'largest') return `largest:${board.n}`;
  return `${board.kind}:${board.n}:${board.target}`;
}

export const sameBoard = (a, b) => boardKey(a) === boardKey(b);

// ---- 부호와 뜀 ----

/** 처음 부호: 모두 + */
export const plusSigns = (n) => Array(n - 1).fill('+');

export const isSigns = (n, signs) => Array.isArray(signs) && signs.length === n - 1 && signs.every((sign) => sign === '+' || sign === '-');

/** 수들 사이에 부호를 넣은 값. numbers[0] 앞에는 부호가 없다 */
export function evaluate(numbers, signs) {
  let value = numbers[0];
  for (let i = 1; i < numbers.length; i++) value += signs[i - 1] === '-' ? -numbers[i] : numbers[i];
  return value;
}

/** 줄(n부터 1까지)에 부호를 넣은 값 */
export const rowValue = (n, signs) => evaluate(numbersOf(n), signs);

/** 부호 하나를 바꾼 새 부호들 */
export function toggled(signs, at) {
  return signs.map((sign, index) => (index === at ? (sign === '+' ? '-' : '+') : sign));
}

/** 부호를 처음(모두 +)에서 바꾼 차례대로 바꾼 모습. 차례: 바꾼 부호 칸의 번호들 */
export function signsAfter(n, trail) {
  let signs = plusSigns(n);
  for (const at of trail) signs = toggled(signs, at);
  return signs;
}

export const isTrail = (n, trail) => Array.isArray(trail) && trail.every((at) => Number.isInteger(at) && at >= 0 && at < n - 1);

/** 부호 칸 at(0부터)의 뒤에 있는 수 */
export const numberAfter = (n, at) => n - 1 - at;

/** 메뚜기가 뛴 뒤의 자리 */
export const hopPosition = (dirs) => dirs.reduce((sum, dir, index) => sum + dir * (index + 1), 0);

export const isDirs = (n, dirs) => Array.isArray(dirs) && dirs.length <= n && dirs.every((dir) => dir === 1 || dir === -1);

/**
 * 처음 모습에서 한 일들을 차례로 한 모습.
 * 한 일(글자 하나씩): 's3'은 3번 부호 칸 바꾸기(줄이 있는 판), 'm12'는 띠의 12 고르기나 그만두기(모두 찾기), 'l'과 'r'은 왼쪽과 오른쪽으로 뛰기(메뚜기).
 * @returns {{ok: boolean, signs: string[], marks: number[], dirs: number[]}} 판에 없는 일이 있으면 ok가 거짓이다. marks는 작은 수부터
 */
export function replay(board, trail) {
  const { n } = board;
  const hop = board.kind === 'hop';
  let signs = hop ? [] : plusSigns(n);
  const marks = new Set();
  const dirs = [];
  if (!Array.isArray(trail)) return { ok: false, signs, marks: [], dirs };
  for (const step of trail) {
    const found = typeof step === 'string' ? step.match(/^([sm])(\d+)$|^([lr])$/) : null;
    if (!found) return { ok: false, signs, marks: [...marks].sort((a, b) => a - b), dirs };
    if (found[3]) {
      if (!hop || dirs.length >= n) return { ok: false, signs, marks: [], dirs };
      dirs.push(found[3] === 'r' ? 1 : -1);
      continue;
    }
    const at = Number(found[2]);
    if (found[1] === 's') {
      if (hop || at >= n - 1) return { ok: false, signs, marks: [], dirs };
      signs = toggled(signs, at);
    } else {
      if (board.kind !== 'all' || at < 1 || at > board.top) return { ok: false, signs, marks: [], dirs };
      if (marks.has(at)) marks.delete(at);
      else marks.add(at);
    }
  }
  return { ok: true, signs, marks: [...marks].sort((a, b) => a - b), dirs };
}

// ---- 풀이 ----

/** 비트 수 */
function popcount(mask) {
  let count = 0;
  for (let m = mask; m; m &= m - 1) count += 1;
  return count;
}

/** 0부터 2^bits−1까지의 수를 켠 비트가 적은 것부터, 같으면 작은 것부터 늘어놓는다 */
function masksInOrder(bits) {
  return Array.from({ length: 2 ** bits }, (_, mask) => mask).sort((a, b) => popcount(a) - popcount(b) || a - b);
}

const rowMemo = new Map();
/**
 * 줄(n부터 1까지)로 나오는 수를 모두 구한다.
 * @returns {Map<number, {signs: string[], ways: number}>} 나오는 수 → 한 가지 방법(− 부호가 가장 적은 것)과 방법의 수
 * 비트 i가 켜져 있으면 1+i 앞의 부호가 −다(작은 수부터 바꾼다).
 */
export function rowReach(n) {
  if (rowMemo.has(n)) return rowMemo.get(n);
  const reach = new Map();
  for (const mask of masksInOrder(n - 1)) {
    const signs = plusSigns(n);
    // 비트 i는 수 1+i, 그 수 앞의 부호 칸은 n−2−i번이다
    for (let i = 0; i < n - 1; i++) if (mask & (1 << i)) signs[n - 2 - i] = '-';
    const value = rowValue(n, signs);
    const before = reach.get(value);
    if (before) before.ways += 1;
    else reach.set(value, { signs, ways: 1 });
  }
  rowMemo.set(n, reach);
  return reach;
}

const hopMemo = new Map();
/**
 * 메뚜기가 1칸부터 n칸까지 뛰어 닿는 자리를 모두 구한다.
 * @returns {Map<number, {dirs: number[], ways: number}>} 자리 → 한 가지 뛰는 법(왼쪽 뜀이 가장 적은 것)과 뛰는 법의 수
 */
export function hopReach(n) {
  if (hopMemo.has(n)) return hopMemo.get(n);
  const reach = new Map();
  for (const mask of masksInOrder(n)) {
    const dirs = Array.from({ length: n }, (_, index) => (mask & (1 << index) ? -1 : 1));
    const value = hopPosition(dirs);
    const before = reach.get(value);
    if (before) before.ways += 1;
    else reach.set(value, { dirs, ways: 1 });
  }
  hopMemo.set(n, reach);
  return reach;
}

/** 안 되는 수의 까닭: 'big' | 'parity' | null(되는 수). 줄은 아래로도 끝이 있지만 목표 수는 0 이상이라 닿지 않는다 */
export function reasonOf(n, value) {
  const total = totalOf(n);
  if (Math.abs(value) > total) return 'big';
  if ((total - value) % 2 !== 0) return 'parity';
  return null;
}

/**
 * 판을 푼다.
 *   row:     { possible, total, signs(한 가지 방법, 안 되면 null), ways(방법의 수), reason('big' | 'parity' | null) }
 *   hop:     { possible, total, dirs, ways, reason }
 *   all:     { possible: false, total, impossible(1부터 top까지 만들 수 없는 수들), reachable(그 가운데 만들 수 있는 수들) }
 *   largest: { possible: false, total, answer(모두 +일 때보다 작은 수 가운데 만들 수 없는 가장 큰 수) }
 * 모두 찾기와 가장 큰 수는 만들 수 없는 수를 다루는 판이라 possible을 거짓으로 둔다("왜 그럴까?"가 이 판들 뒤에도 열린다).
 */
export function solve(board) {
  const { n } = board;
  const total = totalOf(n);
  if (board.kind === 'row' || board.kind === 'hop') {
    const found = (board.kind === 'row' ? rowReach(n) : hopReach(n)).get(board.target);
    const base = { possible: Boolean(found), total, ways: found ? found.ways : 0, reason: found ? null : reasonOf(n, board.target) };
    return board.kind === 'row' ? { ...base, signs: found ? found.signs.slice() : null } : { ...base, dirs: found ? found.dirs.slice() : null };
  }
  const reach = rowReach(n);
  if (board.kind === 'all') {
    const numbers = Array.from({ length: board.top }, (_, index) => index + 1);
    return { possible: false, total, impossible: numbers.filter((value) => !reach.has(value)), reachable: numbers.filter((value) => reach.has(value)) };
  }
  let answer = total - 1;
  while (reach.has(answer)) answer -= 1;
  return { possible: false, total, answer };
}
