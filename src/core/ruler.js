// 눈금이 가장 적은 자의 판과 풀이 프로그램. 순수 함수만 둔다.
//
// 자는 0부터 길이까지의 자리(정수)이고, 눈금은 그 가운데 몇 자리에 찍는다. 두 눈금 사이가 d이면 길이 d를 잴 수 있다.
// 판(board)은 두 가지다.
//   { kind: 'all', lengths: [L, …] }       1부터 L까지 모든 길이를 잴 수 있게 눈금을 찍는다. 0과 L에는 처음부터 눈금이 있다.
//                                            길이가 여럿이면 차례로 이어지는 자들이다(열린 판 둘). 기록은 찍은 눈금의 수(적을수록 좋다)
//   { kind: 'golomb', count: k, span: N }  0부터 N까지의 자에 눈금 k개를 찍는다(0에는 처음부터 있다). 같은 길이를 두 번 재지 않아야 한다.
//                                            기록은 자의 길이(가장 오른쪽 눈금. 짧을수록 좋다)
// 풀이 프로그램은 눈금을 왼쪽부터 하나씩 놓아 보는 갈래 찾기다. 남은 눈금으로 생길 수 있는 짝의 수가 아직 못 재는 길이의 수보다 적으면
// 그 갈래는 더 보지 않는다. 가장 적은 수와, 그 수로 되는 자를 모두 찾는다(뒤집은 자는 하나로 센다).
// 테스트는 이것과 다른 방법(눈금을 찍을 자리의 모든 묶음을 차례로 늘어놓기)으로 다시 따진다.

/** 판에 쓰는 길이의 범위. 길이 3보다 짧은 자는 찍을 곳이 없거나 하나뿐이다 */
export const MIN_LENGTH = 3;
export const MAX_LENGTH = 20;
/** 같은 길이를 두 번 재지 않는 자: 눈금 수의 범위와 자의 길이의 위 끝 */
export const MIN_COUNT = 3;
export const MAX_COUNT = 6;
/** 이어지는 자의 수 위 끝 */
export const MAX_CHAIN = 6;

const whole = (value) => Number.isInteger(value);

/** 판이 규격에 맞는가. 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  if (board.kind === 'all') {
    const { lengths } = board;
    if (!Array.isArray(lengths) || lengths.length < 1 || lengths.length > MAX_CHAIN) return 'lengths';
    if (!lengths.every((L) => whole(L) && L >= MIN_LENGTH && L <= MAX_LENGTH)) return 'length';
    if (!lengths.every((L, index) => index === 0 || L === lengths[index - 1] + 1)) return 'chain';
    return null;
  }
  if (board.kind === 'golomb') {
    const { count, span } = board;
    if (!whole(count) || count < MIN_COUNT || count > MAX_COUNT) return 'count';
    if (!whole(span) || span > MAX_LENGTH || span < shortestGolomb(count).shortest) return 'span';
    return null;
  }
  return 'kind';
}

export function copyBoard(board) {
  return board.kind === 'all' ? { kind: 'all', lengths: board.lengths.slice() } : { kind: 'golomb', count: board.count, span: board.span };
}

/** 판을 한 줄의 글로(같은 판인지 견주고, 적어 둘 때 쓴다) */
export const boardKey = (board) => (board.kind === 'all' ? `all:${board.lengths.join(',')}` : `golomb:${board.count}:${board.span}`);
export const sameBoard = (a, b) => boardKey(a) === boardKey(b);

/** 판에 있는 자의 수(이어지는 자는 여럿) */
export const itemCount = (board) => (board.kind === 'all' ? board.lengths.length : 1);
/** 자 하나의 그릴 길이(0부터 이 자리까지) */
export const spanOf = (board, at = 0) => (board.kind === 'all' ? board.lengths[at] : board.span);
/** 처음부터 찍혀 있어 뺄 수 없는 눈금 */
export const fixedOf = (board, at = 0) => (board.kind === 'all' ? [0, board.lengths[at]] : [0]);

// ---- 재기 ----

/** 눈금들을 작은 것부터 늘어놓고 같은 자리를 하나로 */
export const sortMarks = (marks) => [...new Set(marks)].sort((a, b) => a - b);

/** 두 눈금의 짝의 수: 눈금이 m개면 m × (m − 1) ÷ 2 */
export const pairCount = (m) => (m * (m - 1)) / 2;

/**
 * 길이마다 그 길이를 재는 두 눈금의 짝들(왼쪽 눈금이 작은 것부터)
 * @param {number[]} marks
 * @returns {Map<number, [number, number][]>}
 */
export function pairsByLength(marks) {
  const sorted = sortMarks(marks);
  const map = new Map();
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const d = sorted[j] - sorted[i];
      if (!map.has(d)) map.set(d, []);
      map.get(d).push([sorted[i], sorted[j]]);
    }
  }
  for (const list of map.values()) list.sort((a, b) => a[0] - b[0]);
  return map;
}

/** 1부터 L까지 가운데 잴 수 있는 길이들 */
export function measuredUpTo(marks, L) {
  const map = pairsByLength(marks);
  return Array.from({ length: L }, (_, index) => index + 1).filter((d) => map.has(d));
}

/** 1부터 L까지 모두 잴 수 있는가 */
export const coversAll = (marks, L) => measuredUpTo(marks, L).length === L;

/** 두 번 이상 재는 길이들 */
export function repeatedLengths(marks) {
  return [...pairsByLength(marks).entries()]
    .filter(([, list]) => list.length > 1)
    .map(([d]) => d)
    .sort((a, b) => a - b);
}

/** 같은 길이를 두 번 재지 않는가 */
export const allDistinct = (marks) => repeatedLengths(marks).length === 0;

/**
 * 자 하나가 다 되었는가.
 *   all     1부터 L까지 모두 잰다
 *   golomb  눈금이 꼭 k개이고 같은 길이를 두 번 재지 않는다
 */
export function isDone(board, at, marks) {
  if (board.kind === 'all') return coversAll(marks, board.lengths[at]);
  return sortMarks(marks).length === board.count && allDistinct(marks);
}

/** 기록: all은 찍은 눈금의 수, golomb은 자의 길이(가장 오른쪽 눈금). 둘 다 작을수록 좋다 */
export const recordOf = (board, marks) => (board.kind === 'all' ? sortMarks(marks).length : Math.max(...marks));

/** 눈금이 m개일 때 짝이 L가지 이상이 되는 가장 작은 m(짝 세기로 아는 아래 끝) */
export function pairBound(L) {
  let m = 2;
  while (pairCount(m) < L) m += 1;
  return m;
}

/** 뒤집은 자(L에서 뺀 자리들) */
export const mirrorOf = (marks, L) => sortMarks(marks.map((x) => L - x));
/** 뒤집은 자를 하나로 볼 때의 이름(둘 가운데 글이 앞서는 쪽) */
export function shapeKey(marks, L) {
  const a = sortMarks(marks).join(',');
  const b = mirrorOf(marks, L).join(',');
  return a < b ? a : b;
}

// ---- 풀이 프로그램: 1부터 L까지 모두 재는 자 ----

/**
 * 0과 L을 넣어 눈금 m개로 1부터 L까지 모두 재는 자들(왼쪽부터 눈금을 놓아 본다).
 * limit개를 찾으면 멈춘다(없음을 보일 때는 1이면 된다).
 */
function coveringRulers(L, m, limit = Infinity) {
  const found = [];
  if (m < 2) return found;
  const marks = [0, L];
  // 길이마다 지금 몇 짝이 재는가
  const counts = new Array(L + 1).fill(0);
  counts[L] = 1;
  let missing = L - 1;
  const add = (p) => {
    for (const q of marks) {
      const d = Math.abs(p - q);
      if (counts[d] === 0) missing -= 1;
      counts[d] += 1;
    }
    marks.push(p);
  };
  const remove = () => {
    const p = marks.pop();
    for (const q of marks) {
      const d = Math.abs(p - q);
      counts[d] -= 1;
      if (counts[d] === 0) missing += 1;
    }
  };
  function go(from, left) {
    if (found.length >= limit) return;
    if (left === 0) {
      if (missing === 0) found.push(sortMarks(marks));
      return;
    }
    // 남은 눈금 left개가 새로 만들 수 있는 짝: 이미 있는 눈금과 left × (지금 눈금 수), 새 눈금끼리 짝의 수
    if (left * marks.length + pairCount(left) < missing) return;
    for (let p = from; p <= L - left; p++) {
      add(p);
      go(p + 1, left - 1);
      remove();
      if (found.length >= limit) return;
    }
  }
  go(1, m - 2);
  return found;
}

const coverMemo = new Map();

/**
 * 길이 L인 자의 풀이: 가장 적은 눈금 수(fewest), 짝 세기로 아는 아래 끝(bound),
 * 그 수로 되는 자의 수(all은 뒤집은 것을 따로, shapes는 하나로 센 수), 그런 자들(shapes. 뒤집은 것 가운데 하나씩)
 */
export function solveLength(L) {
  if (!whole(L) || L < 1 || L > MAX_LENGTH) throw new Error(`잴 수 없는 길이예요: ${L}`);
  if (!coverMemo.has(L)) {
    const bound = pairBound(L);
    let fewest = Math.max(bound, 2);
    while (coveringRulers(L, fewest, 1).length === 0) fewest += 1;
    const rulers = coveringRulers(L, fewest);
    const shapes = new Map();
    for (const marks of rulers) {
      const key = shapeKey(marks, L);
      if (!shapes.has(key)) shapes.set(key, key.split(',').map(Number));
    }
    coverMemo.set(L, { length: L, fewest, bound, all: rulers.length, count: shapes.size, shapes: [...shapes.values()] });
  }
  return coverMemo.get(L);
}

/** 눈금 m개로 길이 L인 자를 놓는 모든 경우의 수(0과 L은 정해져 있다) */
export function placements(L, m) {
  const inner = L - 1;
  const pick = m - 2;
  if (pick < 0 || pick > inner) return 0;
  let value = 1;
  for (let i = 0; i < pick; i++) value = (value * (inner - i)) / (i + 1);
  return Math.round(value);
}

// ---- 풀이 프로그램: 같은 길이를 두 번 재지 않는 자 ----

/** 0과 n을 넣어 눈금 k개로 같은 길이를 두 번 재지 않는 자들 */
function distinctRulers(k, n) {
  const found = [];
  if (k === 2) return n >= 1 ? [[0, n]] : [];
  const marks = [0, n];
  const used = new Set([n]);
  function go(from, left) {
    if (left === 0) {
      found.push(sortMarks(marks));
      return;
    }
    for (let p = from; p < n; p++) {
      const fresh = marks.map((q) => Math.abs(p - q));
      if (fresh.some((d) => used.has(d)) || new Set(fresh).size < fresh.length) continue;
      for (const d of fresh) used.add(d);
      marks.push(p);
      go(p + 1, left - 1);
      marks.pop();
      for (const d of fresh) used.delete(d);
    }
  }
  go(1, k - 2);
  return found;
}

const distinctMemo = new Map();

/**
 * 눈금 k개로 같은 길이를 두 번 재지 않는 가장 짧은 자: 길이(shortest), 짝 세기로 아는 아래 끝(bound = 짝의 수),
 * 그 길이로 되는 자의 수(all, count는 뒤집은 것을 하나로), 그런 자들(shapes)
 */
export function shortestGolomb(k) {
  if (!whole(k) || k < 2 || k > MAX_COUNT) throw new Error(`눈금 수가 맞지 않아요: ${k}`);
  if (!distinctMemo.has(k)) {
    const bound = pairCount(k);
    let shortest = bound;
    while (distinctRulers(k, shortest).length === 0) shortest += 1;
    const rulers = distinctRulers(k, shortest);
    const shapes = new Map();
    for (const marks of rulers) {
      const key = shapeKey(marks, shortest);
      if (!shapes.has(key)) shapes.set(key, key.split(',').map(Number));
    }
    distinctMemo.set(k, { count: k, shortest, bound, all: rulers.length, shapes: [...shapes.values()], shapeCount: shapes.size });
  }
  return distinctMemo.get(k);
}

/** 판의 자 하나에서 가장 좋은 기록(all은 가장 적은 눈금 수, golomb은 가장 짧은 길이) */
export function bestScore(board, at = 0) {
  return board.kind === 'all' ? solveLength(board.lengths[at]).fewest : shortestGolomb(board.count).shortest;
}

/**
 * 판의 풀이. possible은 늘 참이다(모든 판에 답이 있다).
 *   items  자마다 { span, best(가장 좋은 기록), bound, count(뒤집은 것을 하나로 센 가장 좋은 자의 수), example(그런 자 하나) }
 */
export function solve(board) {
  const problem = checkBoard(board);
  if (problem) throw new Error(`판이 규격에 맞지 않아요: ${problem}`);
  if (board.kind === 'all') {
    return {
      possible: true,
      kind: 'all',
      items: board.lengths.map((L) => {
        const result = solveLength(L);
        return { span: L, best: result.fewest, bound: result.bound, count: result.count, example: result.shapes[0] };
      }),
    };
  }
  const result = shortestGolomb(board.count);
  return { possible: true, kind: 'golomb', items: [{ span: result.shortest, best: result.shortest, bound: result.bound, count: result.shapeCount, example: result.shapes[0] }] };
}

/** 자 하나에 찍은 눈금들이 판에 맞는가(자리 범위, 처음 눈금, 눈금 수) */
export function marksOk(board, at, marks) {
  if (!Array.isArray(marks) || !marks.every(whole)) return false;
  const span = spanOf(board, at);
  if (!marks.every((x) => x >= 0 && x <= span)) return false;
  if (sortMarks(marks).length !== marks.length) return false;
  if (!fixedOf(board, at).every((x) => marks.includes(x))) return false;
  if (board.kind === 'golomb' && marks.length > board.count) return false;
  return true;
}
