// 질문으로 맞히기의 판과 풀이. 순수 함수만 둔다.
// 컴퓨터가 1부터 n까지의 수 가운데 하나를 숨긴다. 아이는 수 몇 개를 골라 "숨은 수가 이 안에 있나요?"라고 묻고, 예나 아니요를 듣는다.
// 컴퓨터는 가장 불리하게 답한다: 수를 미리 정해 두지 않고, 앞의 대답과 맞는 후보 가운데 더 많이 남는 쪽으로 답한다
//   (고른 수 안의 후보와 밖의 후보가 같은 수이면 판마다 정해 둔 시드로 고른다. 같은 물음에는 늘 같은 대답이다).
// 후보가 하나 남으면 숨은 수를 알아낸 것이다. 그때까지 정해 둔 질문 수 안에 물으면 판이 끝난다.
//
// 판의 꼴: { kind, n, q, tie }
//   kind  'ask'(하나씩 묻는다) | 'ahead'(질문 q개를 미리 정해 두고 한꺼번에 묻는다)
//   n     숨길 수의 끝(1부터 n까지). 2~32
//   q     쓸 수 있는 질문 수(1~6). 'ask'에서 null이면 정해 두지 않았다(몇 번이든 묻는 판, 아이가 질문 수를 정하는 판)
//   tie   대답이 갈리지 않을 때(두 쪽의 후보 수가 같을 때) 쓰는 시드(0 이상의 정수)
// 물음의 꼴: { set, answer }  set은 고른 수(작은 것부터, 그때 남은 후보 가운데서만), answer는 'yes' | 'no'
//
// 풀이 프로그램이 정확히 아는 것:
//   후보 m개를 질문 k번으로 언제나 하나로 좁힐 수 있는가(canPin). 물음은 고른 수가 남은 후보와 몇 개 겹치는지로만 갈리므로
//   후보의 수만 따지면 된다: 가장 적은 질문 수 fewest(m)는 fewest(1) = 0, fewest(m) = 1 + (a + b = m으로 가르는 모든 갈래 가운데 max(fewest(a), fewest(b))의 가장 작은 값).
//   테스트가 후보의 모든 묶음과 모든 물음을 따져 보는 다른 방법(tests/helpers/brute-yesno.js)으로 다시 구한다.
//   미리 정하는 판은 수마다 대답의 줄(예·아니요를 질문 차례대로)이 모두 달라야 한다. 질문 q개로 생기는 줄의 가짓수(rowKinds)를 넘으면 안 된다.

import { createRng, seedFrom } from './rng.js';

export const MIN_N = 2;
export const MAX_N = 32;
export const MIN_Q = 1;
export const MAX_Q = 6;
/** 물음과 무르기 기록을 간직하는 수의 위 끝(넉넉하게) */
export const MAX_ASKS = 64;
export const MAX_HISTORY = 80;

const isInt = (value) => Number.isInteger(value);

/** 판이 규격에 맞는가. 맞으면 null, 아니면 까닭(개발자용 글) */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return '판이 없어요';
  const { kind, n, q, tie } = board;
  if (kind !== 'ask' && kind !== 'ahead') return `판의 종류가 맞지 않아요: ${kind}`;
  if (!isInt(n) || n < MIN_N || n > MAX_N) return `숨길 수의 끝이 범위 밖이에요: ${n}`;
  if (q === null) {
    if (kind === 'ahead') return '미리 정하는 판에는 질문 수가 있어야 해요';
  } else if (!isInt(q) || q < MIN_Q || q > MAX_Q) return `질문 수가 범위 밖이에요: ${q}`;
  if (!isInt(tie) || tie < 0) return `시드가 맞지 않아요: ${tie}`;
  return null;
}

export const copyBoard = (board) => ({ kind: board.kind, n: board.n, q: board.q, tie: board.tie });
export const boardKey = (board) => `${board.kind}:${board.n}:${board.q ?? '-'}`;
export const sameBoard = (a, b) => boardKey(a) === boardKey(b);
/** 1부터 n까지 */
export const numbersOf = (n) => Array.from({ length: n }, (_, at) => at + 1);

// ---- 하나씩 묻기 ----

/** 두 쪽의 후보 수가 같을 때 "예"로 답하는가(판의 시드와 몇 번째 물음인지로 정한다) */
export function tieYes(tie, step) {
  return createRng(seedFrom('yesno-tie', tie, step))() < 0.5;
}

/**
 * 컴퓨터의 대답: 고른 수 안의 후보가 밖의 후보보다 많으면 예, 적으면 아니요. 같으면 시드로 정한다.
 * @param {number[]} alive 지금 남은 후보
 * @param {number[]} set 고른 수
 */
export function answerOf(alive, set, tie, step) {
  const inside = alive.filter((x) => set.includes(x)).length;
  const outside = alive.length - inside;
  if (inside !== outside) return inside > outside ? 'yes' : 'no';
  return tieYes(tie, step) ? 'yes' : 'no';
}

/** 대답과 맞는 후보만 남긴다 */
export const keepAfter = (alive, set, answer) => alive.filter((x) => set.includes(x) === (answer === 'yes'));

/** 고른 수가 쓸 수 있는 값인가: 작은 것부터, 겹치지 않고, 지금 남은 후보 가운데 하나 이상 */
export function setOk(alive, set) {
  if (!Array.isArray(set) || set.length === 0) return false;
  return set.every((x, at) => isInt(x) && alive.includes(x) && (at === 0 || set[at - 1] < x));
}

/**
 * 물은 것을 처음부터 따라간다. 대답이 컴퓨터의 대답과 다르거나 물음이 맞지 않으면 ok가 거짓이다.
 * @returns {{ ok: boolean, alive: number[], lefts: number[] }} lefts는 물음마다 물은 뒤 남은 후보의 수
 */
export function replay(board, asked) {
  let alive = numbersOf(board.n);
  const lefts = [];
  if (!Array.isArray(asked)) return { ok: false, alive, lefts };
  for (let step = 0; step < asked.length; step++) {
    const entry = asked[step];
    if (!entry || !setOk(alive, entry.set) || alive.length < 2) return { ok: false, alive, lefts };
    const answer = answerOf(alive, entry.set, board.tie, step);
    if (entry.answer !== answer) return { ok: false, alive, lefts };
    alive = keepAfter(alive, entry.set, answer);
    lefts.push(alive.length);
  }
  return { ok: true, alive, lefts };
}

/** 묻는다: 대답과 물은 뒤 남은 후보 */
export function ask(board, alive, set, step) {
  const answer = answerOf(alive, set, board.tie, step);
  return { answer, alive: keepAfter(alive, set, answer) };
}

// ---- 가장 적은 질문 수(후보의 수만 따진다) ----

const FEWEST = (() => {
  const table = [0, 0];
  for (let m = 2; m <= 2 * MAX_N; m++) {
    let best = Infinity;
    for (let a = 1; a < m; a++) best = Math.min(best, 1 + Math.max(table[a], table[m - a]));
    table.push(best);
  }
  return table;
})();

/** 후보 m개를 언제나 하나로 좁히는 가장 적은 질문 수 */
export function fewestFor(m) {
  if (!isInt(m) || m < 0 || m >= FEWEST.length) throw new Error(`후보 수가 범위 밖이에요: ${m}`);
  return FEWEST[m];
}

/** 후보 m개를 질문 k번으로 언제나 하나로 좁힐 수 있는가 */
export const canPin = (m, k) => fewestFor(m) <= k;

/** 후보 m개를 한 번 물을 때, 가장 고르게 갈라도 남을 수 있는 많은 쪽의 수(m이 1 이하면 그대로) */
export function evenSplit(m) {
  if (m <= 1) return m;
  let best = m;
  for (let a = 1; a < m; a++) best = Math.min(best, Math.max(a, m - a));
  return best;
}

/** 반씩 나눠 보기: 후보 m개에서 질문 k번 동안 가장 고르게 가를 때 남을 수 있는 많은 쪽의 수들(처음 수부터 k+1개) */
export function halving(m, k) {
  const chain = [m];
  for (let step = 0; step < k; step++) chain.push(evenSplit(chain[chain.length - 1]));
  return chain;
}

/**
 * 반씩 나누는 물음들: 남은 후보의 앞쪽 절반(작은 쪽)을 고른다. 컴퓨터가 많이 남는 쪽으로 답할 때의 차례(풀이에 보인다).
 * @returns {{ set: number[], answer: string, alive: number[] }[]} 후보가 하나 남을 때까지, 또는 limit번까지
 */
export function halvingAsks(board, limit = Infinity) {
  let alive = numbersOf(board.n);
  const steps = [];
  while (alive.length > 1 && steps.length < limit) {
    const set = alive.slice(0, Math.floor(alive.length / 2));
    const next = ask(board, alive, set, steps.length);
    steps.push({ set, answer: next.answer, alive: next.alive });
    alive = next.alive;
  }
  return steps;
}

// ---- 미리 정하기 ----

/** 수 x의 대답의 줄(질문 차례대로 예면 true) */
export const rowOf = (x, sets) => sets.map((set) => set.includes(x));
export const rowKey = (row) => row.map((yes) => (yes ? '1' : '0')).join('');

/** 대답의 줄이 같은 수끼리 묶는다(작은 수부터, 묶음의 차례는 그 묶음의 가장 작은 수의 차례) */
export function groupsOf(n, sets) {
  const groups = new Map();
  for (const x of numbersOf(n)) {
    const key = rowKey(rowOf(x, sets));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(x);
  }
  return [...groups.entries()].map(([key, members]) => ({ key, members }));
}

/** 질문 q개로 생기는 대답의 줄의 가짓수: 질문 하나가 늘 때마다 예인 줄과 아니요인 줄로 두 갈래가 된다 */
export function rowKinds(q) {
  let kinds = 1;
  for (let step = 0; step < q; step++) kinds += kinds;
  return kinds;
}

/** 질문 q개를 미리 정해 n개의 수를 모두 가를 수 있는가(수마다 줄이 달라야 한다) */
export const canPrepare = (n, q) => n <= rowKinds(q);

/** 미리 정하는 판에서 가장 적은 질문 수 */
export function fewestAhead(n) {
  let q = 0;
  while (!canPrepare(n, q)) q += 1;
  return q;
}

/** 미리 정한 질문들이 쓸 수 있는 값인가: q개이고, 저마다 1부터 n까지의 수를 작은 것부터 겹치지 않게(비어도 된다) */
export function setsOk(board, sets) {
  if (!Array.isArray(sets) || sets.length !== board.q) return false;
  return sets.every((set) => Array.isArray(set) && set.every((x, at) => isInt(x) && x >= 1 && x <= board.n && (at === 0 || set[at - 1] < x)));
}

/**
 * 미리 정한 질문에 한꺼번에 답한다. 컴퓨터는 줄이 같은 수가 가장 많은 묶음의 대답을 고른다(같으면 시드로).
 * @returns {{ key: string, answers: string[], alive: number[] }}
 */
export function answerAhead(board, sets) {
  const groups = groupsOf(board.n, sets);
  const most = Math.max(...groups.map((group) => group.members.length));
  const top = groups.filter((group) => group.members.length === most);
  const pick = top.length === 1 ? top[0] : top[Math.floor(createRng(seedFrom('yesno-ahead', board.tie, sets.map((set) => set.join(',')).join('/')))() * top.length)];
  return { key: pick.key, answers: [...pick.key].map((bit) => (bit === '1' ? 'yes' : 'no')), alive: pick.members.slice() };
}

/** 미리 정하는 판의 한 가지 답: 수를 1부터 차례로 세운 줄에서, 질문 j는 2를 j번 곱한 수만큼씩 묶어 번갈아 고른다(풀이에 보인다) */
export function aheadSets(n, q) {
  return Array.from({ length: q }, (_, j) => numbersOf(n).filter((x) => Math.floor((x - 1) / rowKinds(j)) % 2 === 1));
}

// ---- 풀이 ----

/**
 * 판의 풀이.
 *   possible  정한 질문 수로 언제나 하나로 좁힐 수 있는가(질문 수를 정하지 않은 판은 참)
 *   fewest    언제나 하나로 좁히는 가장 적은 질문 수
 *   chain     반씩 나눠 보기의 수들(질문 수를 정한 판은 q+1개, 아니면 하나가 될 때까지)
 */
export function solve(board) {
  const { kind, n, q } = board;
  const fewest = kind === 'ahead' ? fewestAhead(n) : fewestFor(n);
  const possible = q === null ? true : kind === 'ahead' ? canPrepare(n, q) : canPin(n, q);
  return { possible, fewest, chain: halving(n, q ?? fewest) };
}
