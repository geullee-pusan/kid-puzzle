// 숨은 규칙 찾기를 다른 방법으로 다시 따진다(테스트 전용).
// 규칙의 뜻을 src/core/rulehunt.js와 다르게 적는다: 수는 글자로 바꿔 끝 글자(일의 자리)를 보고, 배수는 더해 가며 찾고,
// 세 수의 규칙은 줄 세우기와 차례로 본다. 후보 규칙의 목록도 따로 만든다.

/** 수 하나의 성질: 이름표 → 범위의 수 가운데 돼요인 것들의 모임 */
export function bruteAtomSet(id, top) {
  const all = Array.from({ length: top }, (_, index) => index + 1);
  if (id === 'even') return new Set(all.filter((x) => ['0', '2', '4', '6', '8'].includes(String(x).at(-1))));
  if (id === 'odd') return new Set(all.filter((x) => ['1', '3', '5', '7', '9'].includes(String(x).at(-1))));
  if (id.startsWith('m')) {
    const k = Number(id.slice(1));
    const set = new Set();
    for (let x = k; x <= top; x += k) set.add(x);
    return set;
  }
  if (id.startsWith('d')) return new Set(all.filter((x) => String(x).at(-1) === id.slice(1)));
  if (id.startsWith('gt')) return new Set(all.filter((x) => x - Number(id.slice(2)) >= 1));
  if (id.startsWith('lt')) return new Set(all.filter((x) => Number(id.slice(2)) - x >= 1));
  throw new Error(id);
}

/** 둘을 이은 규칙도 받는다: 그리고는 두 모임에 다 든 것, 또는은 어느 한쪽에 든 것 */
export function bruteRuleSet(rule, top) {
  const and = rule.split('&');
  if (and.length === 2) {
    const [a, b] = and.map((id) => bruteAtomSet(id, top));
    return new Set([...a].filter((x) => b.has(x)));
  }
  const or = rule.split('|');
  if (or.length === 2) return new Set([...bruteAtomSet(or[0], top), ...bruteAtomSet(or[1], top)]);
  return bruteAtomSet(rule, top);
}

/** 세 수의 규칙 */
export function bruteTriple(rule, triple) {
  const [a, b, c] = triple;
  const sorted = [...triple].sort((x, y) => x - y);
  const distinct = new Set(triple).size;
  switch (rule) {
    case 'inc':
      return distinct === 3 && triple.every((x, at) => x === sorted[at]);
    case 'dec':
      return distinct === 3 && triple.every((x, at) => x === sorted[2 - at]);
    case 'plus2':
      return [b - a, c - b].every((gap) => gap === 2);
    case 'step':
      return distinct === 3 && triple.every((x, at) => x === sorted[at]) && b * 2 === a + c;
    case 'alleven':
      return triple.filter((x) => x % 2 === 0).length === 3;
    case 'alldiff':
      return distinct === 3;
    case 'lastbig':
      return Math.max(a, b) < c;
    case 'firstsmall':
      return Math.min(b, c) > a;
    case 'sumeven':
      return triple.filter((x) => x % 2 === 1).length % 2 === 0;
    case 'under10':
      return Math.max(...triple) <= 9;
    case 'addup':
      return c - b === a;
    default:
      throw new Error(rule);
  }
}

/** 후보 규칙의 목록(차례는 따지지 않는다) */
export function bruteLibrary(top, lib) {
  if (lib === 'triple') return ['inc', 'dec', 'plus2', 'step', 'alleven', 'alldiff', 'lastbig', 'firstsmall', 'sumeven', 'under10', 'addup'];
  const step = top > 50 ? 10 : 5;
  const cuts = [];
  for (let t = step; t < top; t += step) cuts.push(t);
  const one = ['even', 'odd', 'm3', 'm4', 'm5', 'm6', 'm10', ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `d${d}`), ...cuts.map((t) => `gt${t}`), ...cuts.map((t) => `lt${t}`)];
  if (lib === 'one') return one;
  const two = [];
  for (let i = 0; i < one.length; i++) for (let j = i + 1; j < one.length; j++) two.push(`${one[i]}&${one[j]}`, `${one[i]}|${one[j]}`);
  return [...one, ...two];
}

/** 판의 범위의 것마다 규칙이 돼요인지(수 판은 1~top, 세 수 판은 a, b, c 차례로) */
export function bruteBits(board, rule) {
  if (board.kind === 'number') {
    const set = bruteRuleSet(rule, board.top);
    return Array.from({ length: board.top }, (_, index) => set.has(index + 1));
  }
  const bits = [];
  for (let a = 1; a <= board.top; a++) for (let b = 1; b <= board.top; b++) for (let c = 1; c <= board.top; c++) bits.push(bruteTriple(rule, [a, b, c]));
  return bits;
}

/** 그것의 자리(범위에서 몇 번째) */
export function bruteIndex(board, item) {
  if (board.kind === 'number') return item - 1;
  const [a, b, c] = item;
  return (a - 1) * board.top * board.top + (b - 1) * board.top + (c - 1);
}

/** 답을 아는 것들에서 숨은 규칙과 같은 답을 내는 후보 규칙들, 그 가운데 아직 묻지 않은 것에서 숨은 규칙과 다른 것 */
export function bruteRivals(board, known) {
  const truth = bruteBits(board, board.rule);
  const knownAt = new Set(known.map((item) => bruteIndex(board, item)));
  const fit = [];
  const rivals = [];
  for (const rule of bruteLibrary(board.top, board.lib)) {
    const bits = bruteBits(board, rule);
    if (![...knownAt].every((at) => bits[at] === truth[at])) continue;
    fit.push(rule);
    if (bits.some((bit, at) => !knownAt.has(at) && bit !== truth[at])) rivals.push({ rule, bits });
  }
  return { fit, rivals, truth };
}
