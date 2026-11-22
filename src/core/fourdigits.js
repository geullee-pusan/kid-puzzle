// 숫자 넷으로 수 만들기의 판과 풀이. 순수 함수만 둔다.
// 놀이: 숫자 카드(1~9)를 늘어놓는다. 카드 하나, 셈 기호(+ − × ÷) 하나, 다른 카드 하나를 차례로 누르면 두 카드가 셈한 값의 카드 하나로 합쳐진다.
//   카드가 한 장 남을 때까지 합친다. 그러면 숫자 카드를 모두 꼭 한 번씩 쓴 것이다(합치는 차례가 괄호를 대신한다).
//   빼기는 앞의 카드가 뒤의 카드보다 작지 않을 때만 된다(0보다 작은 수는 만들지 않는다). 0으로는 나누지 않는다.
//   나누어떨어지지 않는 나누기도 된다. 그때 생긴 카드는 분수다(셈은 늘 정확한 분수로 한다). 목표 수는 1 이상의 자연수다.
// 풀이 프로그램이 모든 숫자 넷(1~9, 495가지)을 따져 본 것: 0보다 작은 수를 거쳐도 되게 해도 만들 수 있는 1~200의 수는 하나도 늘지 않는다(테스트는 고른 숫자 넷에서 식을 모두 적어 다시 확인한다).
//   분수를 거치지 못하게 하면 315가지 숫자 넷에서 만들 수 있는 수가 줄어든다(1, 3, 4, 6의 24처럼). 그래서 분수는 거쳐도 되게 했다.
//   숫자 셋으로는 분수를 거쳐야만 나오는 1~200의 수가 없다(테스트가 다시 확인한다).
// 판의 종류(kind):
//   'target' 목표 수: digits(숫자 2~4개)로 targets(목표 수 1~3개)를 하나씩 만든다. 목표 수는 모두 만들 수 있는 수다.
//   'run'    1부터 차례로: digits(숫자 3~4개)로 1, 2, 3, …을 만든다. 기록은 1부터 몇까지 차례로 만들었는가다.
// 한 번 합치기(step)는 글자 하나로 적는다: '0+2'는 0번 카드 + 2번 카드, '2-1'은 2번 카드 − 1번 카드(앞이 먼저 누른 카드).
//   op는 '+', '-', '*', '/'다. 새 카드는 두 카드 가운데 왼쪽 자리에 놓이고, 다른 카드는 빠진다.
//
// 풀이: 카드가 n장일 때 두 장을 고르는 방법은 n(n−1)/2가지, 고른 두 장으로 하는 셈은 여섯 가지(더하기, 곱하기, 앞에서 빼기, 뒤에서 빼기,
//   앞을 나누기, 뒤를 나누기)다. 그래서 숫자 넷을 하나로 합치는 차례는 (6×6)×(3×6)×(1×6) = 3888가지이고, 그것을 모두 해 본다
//   (빼기가 0보다 작아지거나 0으로 나누는 차례는 셈만 하고 버린다). 나온 값마다 그 값이 나온 차례의 수(ways), 그 가운데 분수를 한 번도 거치지 않은
//   차례의 수(plain), 한 가지 식(tree)을 적는다. 적어 두는 식은 분수를 거치지 않는 것, 그 가운데 글이 짧은 것, 같으면 글 차례가 앞선 것이다.

export const MIN_DIGIT = 1;
export const MAX_DIGIT = 9;
/** 목표 수의 위 끝 */
export const MAX_TARGET = 99;
/** 띠(1부터 차례로)에 적을 수 있는 수의 위 끝 */
export const STRIP_CAP = 60;
export const OPS = ['+', '-', '*', '/'];
/** 숫자 넷(1~9, 495가지) 가운데 1부터 가장 멀리 차례로 가는 것(풀이 프로그램으로 모두 따졌고, 테스트가 다시 따진다). 하나뿐이다 */
export const FARTHEST = { digits: [1, 2, 5, 8], best: 51 };
/** 띠를 늘리는 한 줄의 칸 수(처음 띠의 끝이기도 하다) */
export const STRIP_STEP = 10;
const KINDS = ['target', 'run'];

// ---- 분수: [분자, 분모], 분모는 1 이상, 약분해 둔다 ----

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

/** 분수 하나 */
export function ratio(n, d = 1) {
  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d) || 1;
  return [(sign * n) / g + 0, (sign * d) / g];
}

export const isWhole = (value) => value[1] === 1;
/** 같은 분수인지 견주는 글 */
export const valueKey = (value) => `${value[0]}/${value[1]}`;

/**
 * 두 카드의 값을 셈한다. 앞의 값(a) op 뒤의 값(b).
 * @returns {number[]|null} 새 값. 빼기가 0보다 작아지거나 0으로 나누면 null
 */
export function apply(a, op, b) {
  const [an, ad] = a;
  const [bn, bd] = b;
  if (op === '+') return ratio(an * bd + bn * ad, ad * bd);
  if (op === '*') return ratio(an * bn, ad * bd);
  if (op === '-') {
    const n = an * bd - bn * ad;
    return n < 0 ? null : ratio(n, ad * bd);
  }
  if (op === '/') return bn === 0 ? null : ratio(an * bd, ad * bn);
  return null;
}

/** 셈하지 못하는 까닭: 'minus'(작은 수에서 큰 수를 뺀다) | 'zero'(0으로 나눈다) | null */
export function refusal(a, op, b) {
  if (op === '-' && a[0] * b[1] < b[0] * a[1]) return 'minus';
  if (op === '/' && b[0] === 0) return 'zero';
  return null;
}

// ---- 식 ----

const RANK = { '+': 1, '-': 1, '*': 2, '/': 2 };
/** 기본 셈 기호의 글자(테스트와 풀이 프로그램이 쓴다). 화면은 대본의 글자를 쓴다 */
export const PLAIN_FACES = { '+': '+', '-': '-', '*': '*', '/': '/' };

/**
 * 식(나무)을 글로 적는다.
 *   full이 거짓이면 괄호는 꼭 필요한 곳에만 넣는다(곱하기와 나누기를 먼저 하고, 같은 높이는 왼쪽부터 한다는 약속을 따른다).
 *   full이 참이면 먼저 합친 두 카드마다 괄호로 묶는다(맨 바깥만 빼고). 셈의 차례를 약속 없이 읽을 수 있어서 화면은 이것을 쓴다.
 * @param {number|{op: string, a: object, b: object}} tree 숫자 하나 또는 두 식을 셈한 것
 * @param {object} faces 셈 기호의 글자
 * @param {{full?: boolean}} options
 */
export function exprText(tree, faces = PLAIN_FACES, { full = false } = {}) {
  if (typeof tree === 'number') return String(tree);
  const rank = RANK[tree.op];
  const left = exprText(tree.a, faces, { full });
  const right = exprText(tree.b, faces, { full });
  const inner = (node) => typeof node !== 'number';
  const wrapLeft = inner(tree.a) && (full || RANK[tree.a.op] < rank);
  // 오른쪽은 더 낮은 셈이거나, 같은 높이인데 빼기·나누기의 뒤이면 괄호가 있어야 한다(4−(2+1), 8÷(4÷2), 8÷(2×2))
  const wrapRight = inner(tree.b) && (full || RANK[tree.b.op] < rank || (RANK[tree.b.op] === rank && (tree.op === '-' || tree.op === '/')));
  return `${wrapLeft ? `(${left})` : left}${faces[tree.op]}${wrapRight ? `(${right})` : right}`;
}

// ---- 판 ----

const isDigit = (value) => Number.isInteger(value) && value >= MIN_DIGIT && value <= MAX_DIGIT;

/** 판이 규격에 맞는가. 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object' || !KINDS.includes(board.kind)) return 'kind';
  const { digits } = board;
  const low = board.kind === 'run' ? 3 : 2;
  if (!Array.isArray(digits) || digits.length < low || digits.length > 4 || !digits.every(isDigit)) return 'digits';
  if (board.kind === 'run') return firstMissing(digits) >= 2 ? null : 'run';
  const { targets } = board;
  if (!Array.isArray(targets) || targets.length < 1 || targets.length > 3) return 'targets';
  if (!targets.every((value) => Number.isInteger(value) && value >= 1 && value <= MAX_TARGET)) return 'targets';
  if (new Set(targets).size !== targets.length) return 'targets';
  if (!targets.every((value) => canMake(digits, value))) return 'unreachable';
  return null;
}

export function copyBoard(board) {
  const copy = { kind: board.kind, digits: board.digits.slice() };
  if (board.kind === 'target') copy.targets = board.targets.slice();
  return copy;
}

/** 판을 한 줄의 글로(같은 판인지 견주고, 적어 둘 때 쓴다). 숫자의 차례는 판에 놓인 차례 그대로다 */
export const boardKey = (board) => (board.kind === 'run' ? `run:${board.digits.join('')}` : `target:${board.digits.join('')}:${board.targets.join(',')}`);
export const sameBoard = (a, b) => boardKey(a) === boardKey(b);

// ---- 카드와 합치기 ----

/** 처음 카드들: 숫자마다 한 장 */
export const startCards = (digits) => digits.map((digit) => ({ value: ratio(digit), tree: digit }));

/** 한 번 합치기의 글 */
export const stepOf = (i, op, j) => `${i}${op}${j}`;

/** 한 번 합치기의 글을 읽는다. 맞지 않으면 null */
export function readStep(step) {
  const found = typeof step === 'string' ? step.match(/^(\d)([-+*/])(\d)$/) : null;
  return found ? { i: Number(found[1]), op: found[2], j: Number(found[3]) } : null;
}

/**
 * 두 카드를 합친 새 카드들. 새 카드는 두 자리 가운데 왼쪽에 놓인다.
 * @returns {object[]|null} 셈할 수 없거나 카드 번호가 맞지 않으면 null
 */
export function combine(cards, i, op, j) {
  if (!Number.isInteger(i) || !Number.isInteger(j) || i === j || i < 0 || j < 0 || i >= cards.length || j >= cards.length || !OPS.includes(op)) return null;
  const value = apply(cards[i].value, op, cards[j].value);
  if (!value) return null;
  const card = { value, tree: { op, a: cards[i].tree, b: cards[j].tree } };
  const at = Math.min(i, j);
  const gone = Math.max(i, j);
  return cards.flatMap((item, index) => (index === at ? [card] : index === gone ? [] : [item]));
}

/** 숫자들에서 합치기를 차례로 한 카드들. 맞지 않는 합치기가 있으면 ok가 거짓이다 */
export function replaySteps(digits, steps) {
  let cards = startCards(digits);
  if (!Array.isArray(steps)) return { ok: false, cards };
  for (const step of steps) {
    const read = readStep(step);
    const next = read ? combine(cards, read.i, read.op, read.j) : null;
    if (!next) return { ok: false, cards };
    cards = next;
  }
  return { ok: true, cards };
}

/** 식(나무)이 분수를 한 번이라도 거치는가(마지막 값 말고, 중간에 생긴 카드) */
export function passesFraction(tree) {
  if (typeof tree === 'number') return false;
  const inner = (node) => typeof node !== 'number' && (!isWhole(valueOf(node)) || passesFraction(node));
  return inner(tree.a) || inner(tree.b);
}

/** 식(나무)의 값 */
export function valueOf(tree) {
  if (typeof tree === 'number') return ratio(tree);
  return apply(valueOf(tree.a), tree.op, valueOf(tree.b));
}

// ---- 풀이 ----

/** 카드 n장을 하나로 합치는 차례의 수(빼기와 나누기는 두 방향을 따로 센다): (n(n−1)/2 × 6) × ((n−1)(n−2)/2 × 6) × … */
export function orderCount(n) {
  let count = 1;
  for (let k = n; k >= 2; k--) count *= ((k * (k - 1)) / 2) * 6;
  return count;
}

/** 두 카드로 하는 여섯 가지 셈: [앞 카드 번호, 셈, 뒤 카드 번호]. 더하기와 곱하기는 한 방향만 */
const FORMS = [
  [0, '+', 1],
  [0, '*', 1],
  [0, '-', 1],
  [1, '-', 0],
  [0, '/', 1],
  [1, '/', 0],
];

/** 더 보기 좋은 식인가: 분수를 거치지 않는 것, 글이 짧은 것, 글 차례가 앞선 것 */
function better(next, before) {
  if (next.plain !== before.plain) return next.plain;
  if (next.text.length !== before.text.length) return next.text.length < before.text.length;
  return next.text < before.text;
}

const memo = new Map();
/**
 * 숫자들로 나오는 값을 모두 구한다(합치는 차례를 모두 해 본다).
 * @param {number[]} digits 숫자 1~4개
 * @returns {{orders: number, values: Map<string, {value: number[], ways: number, plain: number, tree: object}>}}
 *   orders는 해 본 차례의 수, values는 값의 글(valueKey) → 그 값이 나온 차례의 수, 분수를 거치지 않은 차례의 수, 한 가지 식
 */
export function explore(digits) {
  const key = digits.slice().sort((a, b) => a - b).join('');
  if (memo.has(key)) return memo.get(key);
  const values = new Map();
  const walk = (cards, plain) => {
    if (cards.length === 1) {
      const [{ value, tree }] = cards;
      const id = valueKey(value);
      const before = values.get(id);
      const candidate = { plain, text: exprText(tree) };
      if (!before) values.set(id, { value, ways: 1, plain: plain ? 1 : 0, tree, text: candidate.text, clean: plain });
      else {
        before.ways += 1;
        if (plain) before.plain += 1;
        if (better(candidate, { plain: before.clean, text: before.text })) Object.assign(before, { tree, text: candidate.text, clean: plain });
      }
      return;
    }
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        for (const [x, op, y] of FORMS) {
          const [first, second] = x === 0 ? [i, j] : [j, i];
          const next = combine(cards, first, op, second);
          if (!next) continue;
          const made = next[Math.min(i, j)];
          // 마지막 카드는 분수여도 "거친" 것이 아니다. 중간에 생긴 카드만 본다
          walk(next, plain && (next.length === 1 || isWhole(made.value)));
        }
      }
    }
  };
  walk(startCards(digits), true);
  for (const entry of values.values()) {
    delete entry.text;
    delete entry.clean;
  }
  const result = { orders: orderCount(digits.length), values };
  memo.set(key, result);
  return result;
}

/** 숫자들로 만들 수 있는 1 이상의 자연수들(작은 것부터). top까지만 */
export function wholeReach(digits, top = MAX_TARGET) {
  const found = [];
  for (const { value } of explore(digits).values.values()) if (isWhole(value) && value[0] >= 1 && value[0] <= top) found.push(value[0]);
  return found.sort((a, b) => a - b);
}

/** 그 수의 풀이(나온 차례의 수, 분수를 거치지 않은 차례의 수, 한 가지 식). 만들 수 없으면 null */
export function entryOf(digits, n) {
  return explore(digits).values.get(valueKey(ratio(n))) ?? null;
}

export const canMake = (digits, n) => entryOf(digits, n) !== null;

/** 분수를 거쳐야만 나오는 수인가(만들 수 있는데, 분수를 거치지 않는 차례가 하나도 없다) */
export function needsFraction(digits, n) {
  const entry = entryOf(digits, n);
  return entry !== null && entry.plain === 0;
}

/** 1부터 차례로 만들다 처음 막히는 수(만들 수 없는 가장 작은 자연수) */
export function firstMissing(digits) {
  let n = 1;
  while (canMake(digits, n)) n += 1;
  return n;
}

/**
 * 판을 푼다.
 *   target: { possible: true, orders, targets: [{ n, ways, plain, tree }] }
 *   run:    { possible: false, orders, best(1부터 차례로 만들 수 있는 끝 수), missing(처음 막히는 수), entries(1부터 best까지 수마다 { n, ways, plain, tree }) }
 * 1부터 차례로는 만들 수 없는 수(missing)를 다루는 판이라 possible을 거짓으로 둔다("왜 그럴까?"가 이 판 뒤에 열린다).
 */
export function solve(board) {
  const { digits } = board;
  const orders = orderCount(digits.length);
  const pick = (n) => {
    const entry = entryOf(digits, n);
    return { n, ways: entry.ways, plain: entry.plain, tree: entry.tree };
  };
  if (board.kind === 'target') return { possible: true, orders, targets: board.targets.map(pick) };
  const missing = firstMissing(digits);
  return { possible: false, orders, best: missing - 1, missing, entries: Array.from({ length: missing - 1 }, (_, index) => pick(index + 1)) };
}

/**
 * 식(나무)을 숫자 카드에서 합치는 차례로 바꾼다(앞의 식부터 합친다). 풀이 보기에서 카드를 한 장씩 합쳐 보일 때 쓴다.
 * @returns {string[]|null} 합치기들. 식의 숫자가 카드와 맞지 않으면 null
 */
export function stepsOf(digits, tree) {
  // 카드마다 이름표를 붙여 두고, 합친 카드는 왼쪽 자리의 이름표를 이어받는다
  let tags = digits.map((_, index) => index);
  const free = digits.map((digit, index) => ({ digit, index, used: false }));
  const steps = [];
  let next = digits.length;
  const build = (node) => {
    if (typeof node === 'number') {
      const slot = free.find((item) => !item.used && item.digit === node);
      if (!slot) throw new Error('숫자가 맞지 않아요');
      slot.used = true;
      return slot.index;
    }
    const a = build(node.a);
    const b = build(node.b);
    const [i, j] = [tags.indexOf(a), tags.indexOf(b)];
    steps.push(stepOf(i, node.op, j));
    const tag = next++;
    const at = Math.min(i, j);
    const gone = Math.max(i, j);
    tags = tags.flatMap((item, index) => (index === at ? [tag] : index === gone ? [] : [item]));
    return tag;
  };
  try {
    build(tree);
  } catch {
    return null;
  }
  return free.every((item) => item.used) ? steps : null;
}

// ---- 1부터 차례로: 기록과 열린 수 ----

/** 1부터 차례로 만든 끝 수(만든 수들에서) */
export function runOf(numbers) {
  const set = new Set(numbers);
  let n = 0;
  while (set.has(n + 1)) n += 1;
  return n;
}

/** 열린 수 둘: 아직 만들지 않은 가장 작은 자연수 둘 */
export function openOf(numbers) {
  const set = new Set(numbers);
  const open = [];
  for (let n = 1; open.length < 2; n++) if (!set.has(n)) open.push(n);
  return open;
}

/** 띠의 끝 수: 열린 수와 만든 수가 다 들어가게 열 칸씩 늘린다(위 끝은 STRIP_CAP) */
export function stripTop(numbers, open = openOf(numbers)) {
  const far = Math.max(open[1], ...numbers);
  return Math.min(STRIP_CAP, Math.max(STRIP_STEP, Math.ceil((far + 1) / STRIP_STEP) * STRIP_STEP));
}
