// 켜고 끄기와 숫자 마술의 판과 풀이. 순수 함수만 둔다.
// 불마다 수가 적혀 있고, 켠 불의 수를 모두 더한 것이 만든 수다. 숫자 마술은 세 자리(또는 두 자리) 수를 뒤집어 빼고 다시 뒤집어 더한다.
//
// 판의 종류(kind):
//   targets  적힌 수를 불을 켜고 꺼서 하나씩 만든다            { kind, lamps, targets }
//   reach    1부터 만들어 보고 처음으로 만들 수 없는 수를 찾는다  { kind, lamps }
//   next     불 하나를 더 달아 빈 곳 없이 가장 멀리 간다          { kind, lamps }  (lamps는 빈 곳 없는 불)
//   cards    마음 읽기 카드. 카드는 불 하나마다 한 장이다       { kind, lamps, secrets }  (lamps는 1, 2, 4, 8 …)
//   magic    숫자 마술                                         { kind, digits }  (digits는 2 또는 3)
// 불은 작은 것부터 적는다. 같은 수의 불이 둘 있어도 된다(직접 만들기).

export const KINDS = ['targets', 'reach', 'next', 'cards', 'magic'];
/** 한 판의 불의 수와 불 하나에 적는 수의 위 끝 */
export const MAX_LAMPS = 6;
export const MAX_VALUE = 64;
/** 직접 만들기에서 고를 수 있는 불의 수(1~50)와 불의 개수(2~6) */
export const MAKE_VALUES = [1, 50];
export const MAKE_COUNT = [2, 6];
/** 줄(1부터 차례로 놓인 수)에 그리는 수의 위 끝 */
export const STRIP_CAP = 100;
/** 숫자 마술: 자리 수마다 늘 나오는 수 */
export const PREDICTION = { 2: 99, 3: 1089 };
/** 카드 한 판에서 선생님이 고르는 수의 개수 */
export const SECRET_COUNT = 3;

export const sumOf = (values) => values.reduce((total, value) => total + value, 0);
const isCount = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
const sorted = (values) => values.every((value, at) => at === 0 || values[at - 1] <= value);

/**
 * 수마다 만드는 방법의 수. ways[n]은 켠 불의 합이 n이 되는 불 묶음의 수다(ways[0]은 아무것도 켜지 않은 것 하나).
 * 불을 하나씩 더해 가며 센다(같은 불을 두 번 쓰지 않도록 큰 합부터 고친다).
 */
export function waysOf(lamps) {
  const total = sumOf(lamps);
  const ways = Array(total + 1).fill(0);
  ways[0] = 1;
  for (const value of lamps) {
    for (let sum = total; sum >= value; sum--) ways[sum] += ways[sum - value];
  }
  return ways;
}

/** 1부터 빈 곳 없이 만들 수 있는 가장 큰 수(1도 못 만들면 0) */
export function reachOf(lamps) {
  const ways = waysOf(lamps);
  let reach = 0;
  while (reach + 1 < ways.length && ways[reach + 1] > 0) reach += 1;
  return reach;
}

/** 처음으로 만들 수 없는 수 */
export const firstMissing = (lamps) => reachOf(lamps) + 1;

/** 1부터 top까지에서 만들 수 없는 수 */
export function missingOf(lamps, top = sumOf(lamps)) {
  const ways = waysOf(lamps);
  const list = [];
  for (let n = 1; n <= top; n++) if (!(ways[n] > 0)) list.push(n);
  return list;
}

/** 켠 불(불의 번호들)의 합 */
export const litSum = (lamps, lit) => lit.reduce((total, at) => total + lamps[at], 0);

/** 불 묶음(번호들) → 비트 묶음 */
export const maskOf = (lit) => lit.reduce((mask, at) => mask | (1 << at), 0);

/**
 * n을 만드는 한 가지 방법(불의 번호들, 작은 것부터). 큰 불부터 켜 보고 남은 수를 나머지 불로 만든다. 못 만들면 null.
 * 1, 2, 4, 8처럼 두 배씩인 불은 방법이 하나뿐이라 늘 그것이 나온다.
 */
export function litFor(lamps, n) {
  function walk(at, left) {
    if (left === 0) return [];
    if (at < 0) return null;
    if (lamps[at] <= left) {
      const rest = walk(at - 1, left - lamps[at]);
      if (rest) return [...rest, at];
    }
    return walk(at - 1, left);
  }
  return n > 0 ? walk(lamps.length - 1, n) : null;
}

/** 1, 2, 4, 8 …처럼 1부터 두 배씩인 불인가 */
export const isDoubling = (lamps) => lamps.length > 0 && lamps.every((value, at) => value === 2 ** at);

/** 불을 하나 더 달아 볼 수 있는 수의 위 끝(줄의 끝이기도 하다): 지금 불의 합보다 하나 큰 수의 두 배 */
export const nextTop = (lamps) => 2 * (sumOf(lamps) + 1);

/** 불 하나(value)를 더 단 불들(작은 것부터) */
export const withLamp = (lamps, value) => [...lamps, value].sort((a, b) => a - b);

/**
 * 불 하나를 더 달 때 1부터 빈 곳 없이 가장 멀리 가는 불. 1부터 nextTop까지 모두 달아 보고 가장 멀리 가는 것(같으면 작은 것)을 고른다.
 * @returns {{ value: number, reach: number, all: number[] }} all[v]는 v짜리를 달았을 때 빈 곳 없이 가는 끝
 */
export function bestNext(lamps) {
  const top = nextTop(lamps);
  const all = [0];
  let best = { value: 1, reach: -1 };
  for (let value = 1; value <= top; value++) {
    const reach = reachOf(withLamp(lamps, value));
    all.push(reach);
    if (reach > best.reach) best = { value, reach };
  }
  return { ...best, all };
}

// ---- 마음 읽기 카드 ----

/** 카드 한 장(불 at)에 적힌 수: 1부터 불의 합까지에서, 그 수를 만들 때 이 불이 켜지는 수 */
export function cardNumbers(lamps, at) {
  const list = [];
  for (let n = 1; n <= sumOf(lamps); n++) if (litFor(lamps, n)?.includes(at)) list.push(n);
  return list;
}

/** n이 적힌 카드들(불의 번호) */
export const cardsWith = (lamps, n) => lamps.map((_, at) => at).filter((at) => cardNumbers(lamps, at).includes(n));

/** 고른 카드들의 맨 앞 수(그 카드의 불)를 더한 수. 선생님은 이것만 한다 */
export const readCards = (lamps, picked) => sumOf(picked.map((at) => lamps[at]));

// ---- 숫자 마술 ----

/** 수를 뒤집는다(적힌 숫자를 거꾸로 읽는다. 0으로 시작하면 그 0은 읽지 않는다: 990 → 99) */
export const reverseOf = (n) => Number(String(n).split('').reverse().join(''));

/** 맨 앞 숫자와 맨 끝 숫자의 차 */
export function gapOf(n) {
  const text = String(n);
  return Math.abs(Number(text[0]) - Number(text[text.length - 1]));
}

/** 숫자 마술에 쓸 수 있는 수인가: 자리 수가 맞고, 맨 앞 숫자와 맨 끝 숫자가 둘 이상 다르다 */
export const magicOk = (n, digits) => Number.isInteger(n) && n > 0 && String(n).length === digits && gapOf(n) >= 2;

/** 숫자 마술의 차례: 고른 수, 뒤집은 수, 큰 수 − 작은 수, 그 차를 뒤집은 수, 둘을 더한 수 */
export function magicSteps(n) {
  const reversed = reverseOf(n);
  const big = Math.max(n, reversed);
  const small = Math.min(n, reversed);
  const diff = big - small;
  const back = reverseOf(diff);
  return { n, reversed, big, small, diff, back, sum: diff + back };
}

/**
 * 자리 수가 digits인 모든 수로 해 본 결과. 맨 앞과 맨 끝 숫자의 차(gap)마다 나온 수와 그 개수.
 * @returns {{ total: number, byGap: Array<{ gap: number, count: number, results: Array<[number, number]> }> }}
 */
export function magicTable(digits) {
  const low = 10 ** (digits - 1);
  const byGap = Array.from({ length: 10 }, (_, gap) => ({ gap, count: 0, results: new Map() }));
  for (let n = low; n < low * 10; n++) {
    const row = byGap[gapOf(n)];
    const { sum } = magicSteps(n);
    row.count += 1;
    row.results.set(sum, (row.results.get(sum) ?? 0) + 1);
  }
  return {
    total: low * 9,
    byGap: byGap.filter((row) => row.count > 0).map((row) => ({ gap: row.gap, count: row.count, results: [...row.results.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]) })),
  };
}

/** 같은 차(gap)의 수는 모두 같은 수가 나온다(테스트가 모든 수로 확인한다). 그 수 */
export function resultForGap(digits, gap) {
  if (gap === 0) return 0;
  if (gap === 1) return digits === 3 ? 198 : 18;
  return PREDICTION[digits];
}

/**
 * 아이가 넣은 답이 계산한 답과 다른 첫 자리(일의 자리부터 0, 1, 2, 3). 같으면 -1.
 * 자리 수가 다르면 없는 자리는 0으로 본다.
 */
export function wrongColumn(expected, typed) {
  const a = String(expected).split('').reverse();
  const b = String(typed).split('').reverse();
  for (let at = 0; at < Math.max(a.length, b.length); at++) {
    if ((a[at] ?? '0') !== (b[at] ?? '0')) return at;
  }
  return -1;
}

// ---- 판 ----

/** 쓸 수 있는 판인가. 아니면 까닭(글자) */
export function checkBoard(board) {
  if (!board || typeof board !== 'object' || !KINDS.includes(board.kind)) return '판의 종류가 없어요';
  if (board.kind === 'magic') return [2, 3].includes(board.digits) ? null : '숫자 마술의 자리 수는 2나 3이에요';
  const { lamps } = board;
  if (!Array.isArray(lamps) || !isCount(lamps.length, 1, MAX_LAMPS)) return '불의 수가 맞지 않아요';
  if (!lamps.every((value) => isCount(value, 1, MAX_VALUE)) || !sorted(lamps)) return '불의 수는 1부터 64까지, 작은 것부터예요';
  const total = sumOf(lamps);
  if (board.kind === 'targets') {
    const { targets } = board;
    if (!Array.isArray(targets) || !isCount(targets.length, 1, 6)) return '만들 수의 개수가 맞지 않아요';
    if (new Set(targets).size !== targets.length) return '같은 수가 두 번 있어요';
    const ways = waysOf(lamps);
    if (!targets.every((n) => isCount(n, 1, total) && ways[n] > 0)) return '만들 수 없는 수가 있어요';
  }
  if (board.kind === 'next') {
    if (lamps.length >= MAX_LAMPS) return '불을 더 달 자리가 없어요';
    if (reachOf(lamps) !== total) return '빈 곳이 있는 불이에요';
  }
  if (board.kind === 'cards') {
    if (!isDoubling(lamps) || !isCount(lamps.length, 2, 5)) return '카드는 1, 2, 4, 8 …짜리 불로 만들어요';
    const { secrets } = board;
    if (!Array.isArray(secrets) || !isCount(secrets.length, 1, 5) || new Set(secrets).size !== secrets.length) return '선생님의 수가 맞지 않아요';
    if (!secrets.every((n) => isCount(n, 1, total))) return '카드에 없는 수예요';
  }
  return null;
}

/** 줄에 그리는 수의 끝: reach는 불의 합보다 넷 더(처음으로 못 만드는 수가 늘 줄 안에 있다), next는 nextTop */
export function stripTop(board) {
  if (board.kind === 'next') return nextTop(board.lamps);
  return Math.min(sumOf(board.lamps) + 4, STRIP_CAP);
}

/** 판의 답 */
export function solve(board) {
  const { kind } = board;
  if (kind === 'magic') return { possible: true, kind, prediction: PREDICTION[board.digits] };
  const { lamps } = board;
  if (kind === 'targets') return { possible: true, kind, lit: board.targets.map((n) => litFor(lamps, n)) };
  if (kind === 'reach') {
    const ways = waysOf(lamps);
    const top = stripTop(board);
    const twice = [];
    for (let n = 1; n < ways.length; n++) if (ways[n] >= 2) twice.push(n);
    return { possible: true, kind, reach: reachOf(lamps), first: firstMissing(lamps), missing: missingOf(lamps, top), twice };
  }
  if (kind === 'next') {
    const best = bestNext(lamps);
    return { possible: true, kind, best: best.value, bestReach: best.reach, top: nextTop(lamps) };
  }
  return { possible: true, kind, secrets: board.secrets.slice(), cards: board.secrets.map((n) => cardsWith(lamps, n)) };
}

export const copyBoard = (board) => JSON.parse(JSON.stringify(board));

/** "왜 그럴까?"의 이야기 묶음: 불(targets, reach, next), 카드, 마술 */
export const familyOf = (kind) => (kind === 'cards' ? 'cards' : kind === 'magic' ? 'magic' : 'lamps');

/**
 * "왜 그럴까?"가 열렸는가: 같은 묶음의 판을 한 번 끝까지 했다(맞혔거나 풀이를 보았다).
 * 마술의 까닭이 마술을 해 보기 전에 나오지 않게, 묶음마다 따로 본다.
 */
export function whyOpen(records, family) {
  return records.some((record) => record.kind === 'round' && record.format === 'lamps' && (record.outcome === 'solved' || record.outcome === 'solution') && familyOf(record.mode) === family);
}
