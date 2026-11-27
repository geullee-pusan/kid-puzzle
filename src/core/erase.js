// 지우고 쓰기 예언의 판과 풀이. 순수 함수만 둔다.
// 판: { rule: 규칙, nums: 칠판에 적힌 수들(왼쪽 위부터 차례로) }
//   규칙(rule)
//     same  두 수가 같으면 0, 다르면 1을 쓴다. 칠판의 수는 0과 1뿐이다
//     less  두 수의 합에서 1 뺀 수를 쓴다. 칠판의 수는 1 이상이다(0이 있으면 음수가 나올 수 있다)
//     diff  두 수의 차(큰 수에서 작은 수를 뺀 수)를 쓴다. 칠판의 수는 0 이상이다
// 한 번 지우기: 칠판의 수 둘을 지우고 규칙대로 수 하나를 쓴다. 수가 하나 남을 때까지 한다.
// 화면에서는 수마다 이름(번호)이 있다. 처음 수는 0번부터 n - 1번이고, 새로 쓴 수는 n번, n + 1번, … 차례로 이름이 붙는다.
//   지우기는 [먼저 누른 수의 이름, 나중에 누른 수의 이름]으로 적는다. 새 수는 나중에 누른 수의 자리에 쓴다.
//
// 바뀌지 않는 것(풀이 프로그램이 모든 차례를 따져 확인한다. 테스트가 다른 방법으로 다시 따진다)
//   same  1의 개수는 그대로이거나(0과 0, 0과 1) 2 줄어든다(1과 1). 그래서 끝에 남는 수는 1의 개수가 홀수면 1, 짝수면 0이다.
//         0과 1뿐이라 1의 개수가 곧 합이다.
//   less  합이 한 번에 꼭 1 줄어든다. 수가 n개면 n - 1번 지우므로 끝에 남는 수는 늘 (처음 합) - (n - 1)이다.
//   diff  두 수 a, b를 지우고 차를 쓰면 합은 작은 수의 두 배만큼 줄어든다. 그래서 합의 홀짝이 그대로이고,
//         끝에 남는 수의 홀짝은 처음 합의 홀짝과 같다. 끝에 남는 수 자체는 차례에 따라 달라질 수 있다.
//         합이 홀수인 판은 0을 남길 수 없다. 합이 짝수여도 0을 남길 수 없는 판이 있다(2와 4는 2가 남는다).

export const RULES = ['same', 'less', 'diff'];
/** 칠판에 놓이는 수의 개수와 수의 범위 */
export const MIN_CHIPS = 2;
export const MAX_CHIPS = 20;
export const MAX_VALUE = 20;
/** 남길 수 있는 수를 모두 따지는 판의 크기(차를 쓰는 판). 이보다 크면 홀짝만 말한다 */
export const SEARCH_CHIPS = 8;
/** 끝에 남는 수를 지우지 않고 쪽지로 열어 볼 수 있는 판의 크기(수가 이만큼 이상이면 다 지우기에 오래 걸린다) */
export const LONG_CHIPS = 10;
/** "왜 그럴까?"에 아이의 칠판을 그대로 쓰는 크기. 더 크면 아래의 작은 칠판으로 이야기한다 */
export const STORY_MAX = 6;
export const STORY = {
  same: { rule: 'same', nums: [1, 0, 1, 1, 0] },
  less: { rule: 'less', nums: [3, 5, 2, 4] },
  diff: { rule: 'diff', nums: [4, 1, 5, 3] },
};

/** 규칙대로 두 수에서 새로 쓰는 수 */
export function combine(rule, a, b) {
  if (rule === 'same') return a === b ? 0 : 1;
  if (rule === 'less') return a + b - 1;
  return Math.abs(a - b);
}

/** 그 규칙의 칠판에 놓일 수 있는 수인가 */
export function valueOk(rule, value) {
  if (!Number.isInteger(value)) return false;
  if (rule === 'same') return value === 0 || value === 1;
  if (rule === 'less') return value >= 1 && value <= MAX_VALUE;
  return value >= 0 && value <= MAX_VALUE;
}

export const sumOf = (nums) => nums.reduce((total, value) => total + value, 0);

/** 판이 규격에 맞는가. 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  if (!RULES.includes(board.rule)) return 'rule';
  const { nums } = board;
  if (!Array.isArray(nums) || nums.length < MIN_CHIPS || nums.length > MAX_CHIPS) return 'count';
  if (!nums.every((value) => valueOk(board.rule, value))) return 'value';
  return null;
}

export function copyBoard(board) {
  return { rule: board.rule, nums: board.nums.slice() };
}

/** 판을 한 줄의 글로(같은 판인지 견주고, 적어 둘 때 쓴다) */
export const boardKey = (board) => `${board.rule}:${board.nums.join(',')}`;
export const sameBoard = (a, b) => boardKey(a) === boardKey(b);

// ---- 지우기 ----

/** 처음 칠판: 수마다 이름(0부터)과 자리(0부터. 처음에는 이름과 같다) */
export const startChips = (board) => board.nums.map((value, id) => ({ id, value, slot: id }));

/**
 * 처음 칠판에서 지우기들을 차례로 한 모습.
 * @returns {{ok: boolean, chips: {id: number, value: number, slot: number}[], sums: number[], fresh: number|null}}
 *   chips 지금 칠판의 수(놓인 차례대로). slot은 칠판의 자리다. 새 수는 나중에 누른 수의 자리에 쓰고, 먼저 누른 수의 자리는 빈다. sums 처음과 지울 때마다의 합. fresh 방금 새로 쓴 수의 이름
 *   ok가 거짓이면 할 수 없는 지우기가 있었다(chips는 그 앞까지의 모습)
 */
export function replay(board, trail) {
  let chips = startChips(board);
  const sums = [sumOf(board.nums)];
  if (!Array.isArray(trail)) return { ok: false, chips, sums, fresh: null };
  let next = board.nums.length;
  let fresh = null;
  for (const step of trail) {
    if (!Array.isArray(step) || step.length !== 2 || step[0] === step[1]) return { ok: false, chips, sums, fresh };
    const a = chips.find((chip) => chip.id === step[0]);
    const b = chips.find((chip) => chip.id === step[1]);
    if (!a || !b) return { ok: false, chips, sums, fresh };
    const made = { id: next, value: combine(board.rule, a.value, b.value), slot: b.slot };
    chips = chips.filter((chip) => chip.id !== a.id).map((chip) => (chip.id === b.id ? made : chip));
    fresh = next;
    next += 1;
    sums.push(sumOf(chips.map((chip) => chip.value)));
  }
  return { ok: true, chips, sums, fresh };
}

// ---- 풀이 ----

/** 끝에 남는 수가 정해지는 규칙의 그 수(same, less). 차를 쓰는 규칙은 null */
export function fixedFinal(board) {
  const { rule, nums } = board;
  if (rule === 'same') return sumOf(nums) % 2;
  if (rule === 'less') return sumOf(nums) - (nums.length - 1);
  return null;
}

const keyOf = (rule, sorted) => `${rule}:${sorted.join(',')}`;
/** 수의 묶음(작은 것부터) → 끝에 남길 수 있는 수들. 규칙과 묶음마다 한 번만 따진다 */
const reach = new Map();

/**
 * 끝에 남길 수 있는 수를 모두 구한다(모든 차례를 따진다. 같은 묶음은 한 번만).
 * 수의 차례는 상관없으므로 작은 것부터 늘어놓은 묶음으로 따진다.
 * @returns {number[]} 작은 것부터
 */
export function finalsOf(rule, nums) {
  const sorted = nums.slice().sort((a, b) => a - b);
  return [...finalSet(rule, sorted)].sort((a, b) => a - b);
}

function finalSet(rule, sorted) {
  if (sorted.length === 1) return new Set(sorted);
  const key = keyOf(rule, sorted);
  if (reach.has(key)) return reach.get(key);
  const out = new Set();
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] === sorted[i - 1]) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      if (j > i + 1 && sorted[j] === sorted[j - 1]) continue;
      for (const value of finalSet(rule, after(rule, sorted, i, j))) out.add(value);
    }
  }
  reach.set(key, out);
  return out;
}

/** 묶음에서 i번째와 j번째 수를 지우고 새 수를 쓴 묶음(작은 것부터) */
function after(rule, sorted, i, j) {
  const made = combine(rule, sorted[i], sorted[j]);
  const rest = sorted.filter((_, index) => index !== i && index !== j);
  let at = 0;
  while (at < rest.length && rest[at] < made) at += 1;
  rest.splice(at, 0, made);
  return rest;
}

/**
 * 판의 수로 끝에 target을 남기는 지우기들(이름으로 적은 것). 남길 수 없으면 null.
 * 수가 많은 판은 앞의 두 수부터 차례로 지우는 방법만 본다(그때는 target을 따지지 않는다).
 */
export function trailTo(board, target) {
  const steps = [];
  let chips = startChips(board);
  let next = board.nums.length;
  while (chips.length > 1) {
    let pick = null;
    for (let i = 0; i < chips.length && !pick; i++) {
      for (let j = i + 1; j < chips.length && !pick; j++) {
        const made = combine(board.rule, chips[i].value, chips[j].value);
        const rest = chips.filter((_, index) => index !== i && index !== j).map((chip) => chip.value);
        if (finalSet(board.rule, [...rest, made].sort((a, b) => a - b)).has(target)) pick = [chips[i].id, chips[j].id];
      }
    }
    if (!pick) return null;
    const made = { id: next, value: combine(board.rule, chips.find((chip) => chip.id === pick[0]).value, chips.find((chip) => chip.id === pick[1]).value) };
    chips = chips.filter((chip) => chip.id !== pick[0]).map((chip) => (chip.id === pick[1] ? made : chip));
    next += 1;
    steps.push(pick);
  }
  return chips[0].value === target ? steps : null;
}

/** 앞의 두 수부터 차례로 지우는 방법(첫째와 둘째, 그다음 새 수와 셋째, …). 새 수는 둘째 자리에 쓴다 */
export function leftTrail(board) {
  const steps = [];
  let first = 0;
  for (let index = 1; index < board.nums.length; index++) {
    steps.push([first, index]);
    first = board.nums.length + index - 1;
  }
  return steps;
}

/** 남길 수 있는 수를 모두 따질 수 있는 판인가(차를 쓰는 판은 수가 SEARCH_CHIPS개까지) */
export const searchable = (board) => board.rule !== 'diff' || board.nums.length <= SEARCH_CHIPS;

/**
 * 판을 푼다.
 * @returns {{rule: string, count: number, sum: number, parity: number, final: number|null, finals: number[]|null, zero: boolean|null, order: number[][]}}
 *   final  끝에 남는 수가 정해지면 그 수(same, less). 차를 쓰는 판은 null
 *   finals 끝에 남길 수 있는 수들(작은 것부터). 따지기에 너무 큰 판은 null
 *   parity 처음 합의 홀짝(1이면 홀수). 어느 규칙이든 끝에 남는 수의 홀짝은 이것과 같다(same과 diff는 늘, less는 수의 개수에 따라 다르므로 final을 본다)
 *   zero   0을 남길 수 있는가. 모르면 null(합이 짝수인 큰 판)
 *   order  풀이에 보일 지우는 차례 하나(0을 남길 수 있으면 0을 남기는 차례)
 */
export function solve(board) {
  const { rule, nums } = board;
  const sum = sumOf(nums);
  const final = fixedFinal(board);
  const finals = final !== null ? [final] : searchable(board) ? finalsOf(rule, nums) : null;
  let zero;
  if (finals) zero = finals.includes(0);
  else zero = sum % 2 === 1 ? false : null;
  const order = zero === true && rule === 'diff' ? trailTo(board, 0) : leftTrail(board);
  return { rule, count: nums.length, sum, parity: sum % 2, final, finals, zero, order };
}
