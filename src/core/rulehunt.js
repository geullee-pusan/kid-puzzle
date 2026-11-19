// 숨은 규칙 찾기: 판과 규칙, 후보 규칙의 목록, 갈라 볼 수 고르기, 선생님이 규칙을 찾는 방법. 순수 함수만 둔다.
//
// 판(board)
//   kind   'number'(수 하나씩 묻는다) | 'triple'(세 수를 한 묶음으로 묻는다)
//   top    수의 범위의 위 끝(1부터 top까지). 수 판은 10, 20, 30, 50, 100. 세 수 판은 10, 20
//   rule   숨은 규칙의 이름표(아래 "규칙의 이름표")
//   given  처음에 알려 주는 "돼요"인 것들(수, 또는 세 수 [a, b, c])
//   lib    선생님이 견주어 보는 후보 규칙의 목록: 'one'(성질 하나) | 'two'(성질 하나와 둘을 이은 것) | 'triple'(세 수의 규칙)
//
// 규칙의 이름표(화면 글이 아니다. 화면에서 부르는 이름은 대본이 만든다)
//   수 하나의 성질: even(짝수) odd(홀수) m3(3의 배수) d3(일의 자리가 3) gt15(15보다 큰 수) lt15(15보다 작은 수)
//   둘을 이은 것: 'even&lt20'(짝수이면서 20보다 작은 수) 'm3|d5'(3의 배수이거나 일의 자리가 5인 수). 앞뒤는 목록의 차례대로 놓는다
//   세 수의 규칙: inc(점점 커진다) dec(점점 작아진다) plus2(2씩 커진다) step(같은 수만큼씩 커진다) alleven(모두 짝수)
//     alldiff(모두 다르다) lastbig(마지막 수가 가장 크다) firstsmall(첫 수가 가장 작다) sumeven(합이 짝수) under10(모두 10보다 작다)
//     addup(앞의 두 수를 더하면 마지막 수)
//
// 후보 규칙은 범위 안에서 "돼요"인 것들이 같으면 같은 규칙으로 본다(예: 10의 배수와 일의 자리가 0인 수).
// 그런 묶음을 "가름"이라 부르고, 묶음마다 목록에서 가장 앞의 규칙을 대표로 둔다.
import { createRng, randInt } from './rng.js';

/** 수 판의 범위 */
export const TOPS = [10, 20, 30, 50, 100];
/** 세 수 판의 범위(세 수 하나하나가 1부터 top까지) */
export const TRIPLE_TOPS = [10, 20];
/** 배수 규칙에 쓰는 수 */
export const MULTS = [3, 4, 5, 6, 10];
/** 세 수의 규칙(목록의 차례가 대표를 고르는 차례다) */
export const TRIPLE_RULES = ['inc', 'dec', 'plus2', 'step', 'alleven', 'alldiff', 'lastbig', 'firstsmall', 'sumeven', 'under10', 'addup'];
/**
 * 한 번에 갈라 볼 것의 수: 적어도 이만큼(어림으로 맞히기 어렵게).
 * 많을 때는 다른 후보를 모두 가를 때까지 고른다. 사다리의 판에서는 늘 넷이면 되고, 직접 만든 규칙에서 드물게 일곱까지 든다
 * (처음 받은 것이 하나뿐이면 열둘까지. 테스트가 센다). MAX_CHECK는 그래도 넘지 않는 안전한 위 끝이다.
 */
export const MIN_CHECK = 4;
export const MAX_CHECK = 12;

/** 크다·작다 규칙의 경계: 50까지는 5씩, 100은 10씩. 범위의 양 끝은 넣지 않는다 */
export function thresholds(top) {
  const step = top > 50 ? 10 : 5;
  const list = [];
  for (let t = step; t < top; t += step) list.push(t);
  return list;
}

/** 범위마다의 성질 하나짜리 규칙(목록의 차례가 대표를 고르는 차례다) */
export function atomics(top) {
  return [
    'even',
    'odd',
    ...MULTS.map((k) => `m${k}`),
    ...Array.from({ length: 10 }, (_, d) => `d${d}`),
    ...thresholds(top).map((t) => `gt${t}`),
    ...thresholds(top).map((t) => `lt${t}`),
  ];
}

/** 성질 하나짜리 이름표를 읽는다. 읽을 수 없으면 null */
export function parseAtom(id) {
  if (id === 'even' || id === 'odd') return { kind: id, k: null };
  const match = /^(m|d|gt|lt)(\d+)$/.exec(id ?? '');
  if (!match) return null;
  const k = Number(match[2]);
  const kind = { m: 'mult', d: 'ones', gt: 'gt', lt: 'lt' }[match[1]];
  if (String(k) !== match[2]) return null;
  return { kind, k };
}

/** 규칙의 이름표를 읽는다: { op: 'one'|'and'|'or'|'triple', a, b } 또는 null */
export function parseRule(id) {
  if (typeof id !== 'string') return null;
  if (TRIPLE_RULES.includes(id)) return { op: 'triple', a: id, b: null };
  const two = /^([a-z0-9]+)([&|])([a-z0-9]+)$/.exec(id);
  if (two) {
    if (!parseAtom(two[1]) || !parseAtom(two[3])) return null;
    return { op: two[2] === '&' ? 'and' : 'or', a: two[1], b: two[3] };
  }
  return parseAtom(id) ? { op: 'one', a: id, b: null } : null;
}

/** 그 범위에서 쓸 수 있는 성질인가(배수는 정해 둔 수, 일의 자리는 0~9, 경계는 그 범위의 경계) */
function atomFits(id, top) {
  const atom = parseAtom(id);
  if (!atom) return false;
  if (atom.kind === 'mult') return MULTS.includes(atom.k);
  if (atom.kind === 'ones') return atom.k <= 9;
  if (atom.kind === 'gt' || atom.kind === 'lt') return thresholds(top).includes(atom.k);
  return true;
}

function atomHolds(id, x) {
  const { kind, k } = parseAtom(id);
  if (kind === 'even') return x % 2 === 0;
  if (kind === 'odd') return x % 2 === 1;
  if (kind === 'mult') return x % k === 0;
  if (kind === 'ones') return x % 10 === k;
  if (kind === 'gt') return x > k;
  return x < k;
}

function tripleHolds(id, [a, b, c]) {
  switch (id) {
    case 'inc':
      return a < b && b < c;
    case 'dec':
      return a > b && b > c;
    case 'plus2':
      return b === a + 2 && c === b + 2;
    case 'step':
      return b > a && b - a === c - b;
    case 'alleven':
      return a % 2 === 0 && b % 2 === 0 && c % 2 === 0;
    case 'alldiff':
      return a !== b && b !== c && a !== c;
    case 'lastbig':
      return c > a && c > b;
    case 'firstsmall':
      return a < b && a < c;
    case 'sumeven':
      return (a + b + c) % 2 === 0;
    case 'under10':
      return a < 10 && b < 10 && c < 10;
    default:
      return a + b === c;
  }
}

/** 규칙이 그것(수, 또는 세 수)을 "돼요"라고 하는가 */
export function holds(rule, item) {
  const parsed = parseRule(rule);
  if (!parsed) throw new Error(`읽을 수 없는 규칙이에요: ${rule}`);
  if (parsed.op === 'triple') return tripleHolds(rule, item);
  if (parsed.op === 'one') return atomHolds(rule, item);
  if (parsed.op === 'and') return atomHolds(parsed.a, item) && atomHolds(parsed.b, item);
  return atomHolds(parsed.a, item) || atomHolds(parsed.b, item);
}

/** 둘을 이은 규칙의 이름표. 같은 성질 둘이면 하나로, 앞뒤는 목록의 차례대로 놓는다 */
export function joinRule(a, op, b, top) {
  if (op === 'one' || b === null || a === b) return a;
  const order = atomics(top);
  const [first, second] = order.indexOf(a) <= order.indexOf(b) ? [a, b] : [b, a];
  return `${first}${op === 'and' ? '&' : '|'}${second}`;
}

/** 그 범위에서 쓸 수 있는 규칙인가 */
export function ruleFits(rule, kind, top) {
  const parsed = parseRule(rule);
  if (!parsed) return false;
  if (kind === 'triple') return parsed.op === 'triple';
  if (parsed.op === 'triple') return false;
  if (parsed.op === 'one') return atomFits(rule, top);
  return atomFits(parsed.a, top) && atomFits(parsed.b, top) && joinRule(parsed.a, parsed.op, parsed.b, top) === rule;
}

// ---- 범위(묻고 갈라 볼 수 있는 것 모두) ----

/** 판의 범위에 든 것 모두(수 판은 1~top, 세 수 판은 [a, b, c]를 사전 차례로) */
export function universeOf(board) {
  if (board.kind === 'number') return Array.from({ length: board.top }, (_, index) => index + 1);
  const list = [];
  for (let a = 1; a <= board.top; a++) for (let b = 1; b <= board.top; b++) for (let c = 1; c <= board.top; c++) list.push([a, b, c]);
  return list;
}

/** 그것이 범위에서 몇 번째인가(범위 밖이면 -1) */
export function indexOf(board, item) {
  const inRange = (x) => Number.isInteger(x) && x >= 1 && x <= board.top;
  if (board.kind === 'number') return inRange(item) ? item - 1 : -1;
  if (!Array.isArray(item) || item.length !== 3 || !item.every(inRange)) return -1;
  const [a, b, c] = item;
  return ((a - 1) * board.top + (b - 1)) * board.top + (c - 1);
}

/** 같은 것인가(수, 또는 세 수) */
export const sameItem = (x, y) => (Array.isArray(x) ? Array.isArray(y) && x.length === y.length && x.every((value, at) => value === y[at]) : x === y);

/** 후보 규칙의 목록(차례가 대표를 고르는 차례다) */
export function libraryOf(board) {
  if (board.lib === 'triple') return TRIPLE_RULES.slice();
  const one = atomics(board.top);
  if (board.lib === 'one') return one;
  const two = [];
  for (const op of ['and', 'or']) {
    for (let i = 0; i < one.length; i++) for (let j = i + 1; j < one.length; j++) two.push(joinRule(one[i], op, one[j], board.top));
  }
  return [...one, ...two];
}

/** 규칙이 범위의 것마다 "돼요"인지(0과 1의 글자 줄. 같은 가름인지 견줄 때 쓴다) */
export function signatureOf(board, rule) {
  return universeOf(board)
    .map((item) => (holds(rule, item) ? '1' : '0'))
    .join('');
}

const classMemo = new Map();

/**
 * 후보 규칙들을 가름으로 묶는다. 묶음마다 { rule(대표), rules(묶음의 규칙들), bits(범위의 것마다 돼요인지) }.
 * 같은 범위와 목록이면 늘 같은 것을 낸다(한 번 구한 것은 적어 둔다).
 */
export function classesOf(board) {
  const key = `${board.kind}:${board.top}:${board.lib}`;
  if (classMemo.has(key)) return classMemo.get(key);
  const byBits = new Map();
  for (const rule of libraryOf(board)) {
    const bits = signatureOf(board, rule);
    if (byBits.has(bits)) byBits.get(bits).rules.push(rule);
    else byBits.set(bits, { rule, rules: [rule], bits });
  }
  const list = [...byBits.values()];
  classMemo.set(key, list);
  return list;
}

/** 판의 숨은 규칙이 범위의 것마다 "돼요"인지 */
export const truthOf = (board) => signatureOf(board, board.rule);

// ---- 판 ----

/** 판이 쓸 수 있는 것인지 본다. 쓸 수 있으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'board';
  if (board.kind === 'number') {
    if (!TOPS.includes(board.top)) return 'top';
    if (!['one', 'two'].includes(board.lib)) return 'lib';
  } else if (board.kind === 'triple') {
    if (!TRIPLE_TOPS.includes(board.top)) return 'top';
    if (board.lib !== 'triple') return 'lib';
  } else return 'kind';
  if (!ruleFits(board.rule, board.kind, board.top)) return 'rule';
  if (board.lib === 'one' && parseRule(board.rule).op !== 'one') return 'lib';
  const truth = truthOf(board);
  if (!truth.includes('1') || !truth.includes('0')) return 'all-same';
  if (!Array.isArray(board.given) || board.given.length === 0) return 'given';
  for (const [at, item] of board.given.entries()) {
    if (indexOf(board, item) < 0) return 'given';
    if (!holds(board.rule, item)) return 'given-no';
    if (board.given.slice(0, at).some((other) => sameItem(other, item))) return 'given-twice';
  }
  return null;
}

/** 판을 통째로 베낀다(저장할 때 뒤에 바뀌지 않게) */
export function copyBoard(board) {
  return { kind: board.kind, top: board.top, rule: board.rule, given: board.given.map((item) => (Array.isArray(item) ? item.slice() : item)), lib: board.lib };
}

/**
 * 물어본 것들(또는 갈라 본 것들)과 맞는 후보 가름들.
 * @param {object} board
 * @param {Array} items 숨은 규칙의 답을 아는 것들(수, 또는 세 수)
 * @returns {{ fit: object[], rivals: object[], same: object|null }}
 *   fit     물어본 것마다 숨은 규칙과 답이 같은 가름 모두
 *   rivals  그 가운데 아직 묻지 않은 것에서 숨은 규칙과 답이 다른 가름(갈라 볼 수로 가를 수 있다)
 *   same    숨은 규칙과 범위 전체에서 같은 가름(목록에 없으면 null)
 */
export function fitting(board, items) {
  const truth = truthOf(board);
  const known = items.map((item) => indexOf(board, item));
  const fit = classesOf(board).filter((group) => known.every((at) => group.bits[at] === truth[at]));
  const same = fit.find((group) => group.bits === truth) ?? null;
  return { fit, rivals: fit.filter((group) => group.bits !== truth), same };
}

/**
 * 갈라 볼 것을 고른다. 숨은 규칙과 함께 지금까지의 것과 맞지만 숨은 규칙과는 다른 후보(rivals)를
 * 모두 가를 수 있게, 하나에 가장 많은 후보를 가르는 것부터 고른다(같으면 시드 난수로).
 * 그다음 MIN_CHECK개가 되도록, 돼요와 안 돼요가 섞이도록 채운다. 묻지 않은 것만 고른다.
 * @returns {{ items: Array, covered: boolean, rivals: number }} covered: 후보를 모두 갈랐는가
 */
export function pickCheck(board, asked, seed) {
  // 세 수 판은 읽기 쉽게 작은 수(NICE 이하)로만 된 세 수에서 먼저 골라 본다. 그것으로 후보를 다 가르지 못하면 범위 전체에서 고른다.
  if (board.kind === 'triple' && board.top > NICE) {
    const nice = pickFrom(board, asked, seed, (item) => item.every((x) => x <= NICE));
    if (nice.covered && nice.items.length >= MIN_CHECK) return nice;
  }
  return pickFrom(board, asked, seed, () => true);
}

/** 세 수 판에서 갈라 볼 것을 먼저 고르는 수의 위 끝 */
const NICE = 12;

function pickFrom(board, asked, seed, allowed) {
  const truth = truthOf(board);
  const all = universeOf(board);
  const known = new Set(asked.map((item) => indexOf(board, item)));
  const pool = all.map((_, at) => at).filter((at) => !known.has(at) && allowed(all[at]));
  const rng = createRng(seed);
  const { rivals } = fitting(board, asked);
  let open = rivals;
  const chosen = [];
  while (open.length > 0 && chosen.length < MAX_CHECK) {
    let best = 0;
    let ties = [];
    for (const at of pool) {
      if (chosen.includes(at)) continue;
      let split = 0;
      for (const group of open) if (group.bits[at] !== truth[at]) split += 1;
      if (split > best) {
        best = split;
        ties = [at];
      } else if (split === best && split > 0) ties.push(at);
    }
    if (best === 0) break;
    const at = ties[randInt(rng, 0, ties.length - 1)];
    chosen.push(at);
    open = open.filter((group) => group.bits[at] === truth[at]);
  }
  // 모자라면 채운다. 돼요와 안 돼요 가운데 적은 쪽부터(모두 같은 답이면 "모두 돼요"로 어림해도 맞게 되므로).
  const left = () => pool.filter((at) => !chosen.includes(at));
  const want = () => {
    const yes = chosen.filter((at) => truth[at] === '1').length;
    return yes * 2 < chosen.length ? '1' : yes * 2 > chosen.length ? '0' : null;
  };
  while (chosen.length < MIN_CHECK && left().length > 0) {
    const side = want();
    const options = left().filter((at) => side === null || truth[at] === side);
    const from = options.length > 0 ? options : left();
    chosen.push(from[randInt(rng, 0, from.length - 1)]);
  }
  const labels = new Set(chosen.map((at) => truth[at]));
  if (labels.size === 1 && chosen.length < MAX_CHECK) {
    const other = left().filter((at) => truth[at] !== truth[chosen[0]]);
    if (other.length > 0) chosen.push(other[randInt(rng, 0, other.length - 1)]);
  }
  chosen.sort((a, b) => a - b);
  return { items: chosen.map((at) => all[at]), covered: open.length === 0, rivals: rivals.length };
}

/**
 * 갈라 본 것을 맞춰 본다.
 * @param {Array} items 갈라 볼 것들
 * @param {Array<'yes'|'no'|null>} picks 아이가 고른 것
 * @returns {{ correct: boolean, wrong: number[] }} wrong: 숨은 규칙이 다르게 가르는 것의 자리(차례)
 */
export function judgeCheck(board, items, picks) {
  const wrong = [];
  items.forEach((item, at) => {
    const yes = holds(board.rule, item);
    if (picks[at] !== (yes ? 'yes' : 'no')) wrong.push(at);
  });
  return { correct: wrong.length === 0, wrong };
}

/**
 * 판의 풀이: 숨은 규칙이 돼요인 것의 수, 처음 받은 것과 맞는 다른 가름의 수와 그 대표들(풀이 보기에 쓴다).
 */
export function solve(board) {
  const truth = truthOf(board);
  const { rivals, same } = fitting(board, board.given);
  return {
    possible: true,
    rule: board.rule,
    yes: [...truth].filter((bit) => bit === '1').length,
    total: truth.length,
    // 처음 받은 "돼요"만으로는 가를 수 없는 다른 규칙들(가름마다 대표 하나)
    rivals: rivals.map((group) => group.rule),
    // 숨은 규칙과 범위에서 같은 다른 이름들
    sameAs: same ? same.rules.filter((rule) => rule !== board.rule) : [],
  };
}

// ---- 선생님이 규칙을 찾는다(직접 만들기) ----

/**
 * 선생님이 아무것도 모르는 데서부터 물어서 규칙을 찾는다.
 * 아직 맞는 가름들을 가장 고르게 둘로 가르는 수(돼요 쪽과 안 돼요 쪽 가운데 적은 쪽이 가장 많은 수)를 묻고, 같으면 작은 수를 묻는다.
 * 맞는 가름이 하나만 남으면 멈춘다.
 * @returns {{ asks: Array<{ x: number, yes: boolean, left: number }>, rule: string }} left: 물은 뒤 남은 가름의 수, rule: 찾은 가름의 대표
 */
export function findRule(board) {
  const truth = truthOf(board);
  const all = universeOf(board);
  let open = classesOf(board);
  const asks = [];
  const known = new Set();
  while (open.length > 1) {
    let best = -1;
    let pick = -1;
    for (let at = 0; at < all.length; at++) {
      if (known.has(at)) continue;
      let yes = 0;
      for (const group of open) if (group.bits[at] === '1') yes += 1;
      const even = Math.min(yes, open.length - yes);
      if (even > best) {
        best = even;
        pick = at;
      }
    }
    if (best <= 0) break;
    known.add(pick);
    open = open.filter((group) => group.bits[pick] === truth[pick]);
    asks.push({ x: all[pick], yes: truth[pick] === '1', left: open.length });
  }
  return { asks, rule: open[0].rule };
}

// ---- 더 작은 판 ----

/**
 * 같은 규칙을 더 좁은 범위에서 하는 판들(넓은 것부터). 처음 받은 것은 그 범위에 드는 것만 남기고,
 * 둘 이상(처음에 하나였으면 하나) 남아야 한다. 숨은 규칙이 그 범위에서 돼요와 안 돼요가 둘 이상씩 있어야 한다.
 */
export function smallBoards(board) {
  const tops = (board.kind === 'number' ? TOPS : TRIPLE_TOPS).filter((top) => top < board.top).sort((a, b) => b - a);
  const list = [];
  for (const top of tops) {
    if (!ruleFits(board.rule, board.kind, top)) continue;
    const small = { ...copyBoard(board), top };
    small.given = small.given.filter((item) => indexOf(small, item) >= 0);
    if (small.given.length < Math.min(2, board.given.length)) continue;
    const truth = truthOf(small);
    const yes = [...truth].filter((bit) => bit === '1').length;
    if (yes < 2 || truth.length - yes < 2) continue;
    if (checkBoard(small) === null) list.push(small);
  }
  return list;
}

// ---- "왜 그럴까?" ----

/** 이 형식의 판을 끝까지 한 기록들(작은 판은 세지 않는다) */
const finishedOf = (records) =>
  (Array.isArray(records) ? records : []).filter((record) => record && record.kind === 'round' && record.format === 'rulehunt' && record.side !== true && record.outcome === 'solved');

/** 판을 하나 끝까지 하고, 갈라 본 것이 한 번이라도 어긋났거나 판을 둘 끝까지 한 뒤에 열린다(임시) */
export function whyOpen(records) {
  const done = finishedOf(records);
  return done.some((record) => (record.failedChecks ?? 0) > 0) || done.length >= 2;
}
