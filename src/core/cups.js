// 컵 뒤집기와 세 색 무리: 판, 움직이는 규칙, 풀이 프로그램(너비 우선 탐색), 바뀌지 않는 값, 오답 짐작.
// 순수 함수만 둔다. 화면에 손대지 않고, 무작위 수와 지금 시각을 쓰지 않는다. 같은 입력은 늘 같은 출력을 낸다.
//
// 판은 세 가지다. 한 형식 안에 함께 있다(묶음 "바뀌지 않는 것").
// 가. 컵 뒤집기: { kind: 'cups', n, k, cups }
//   컵 n개가 한 줄로 놓여 있다. cups는 길이 n인 배열이고 1은 엎어진 컵, 0은 바로 선 컵이다.
//   한 번에 꼭 k개를 골라 함께 뒤집는다(어느 컵이든 된다). 모두 바로 서면(모두 0) 끝이다.
//   바뀌지 않는 것: k가 짝수면 엎어진 컵 수의 홀짝. 그래서 k가 짝수이고 엎어진 컵이 홀수 개면 안 된다.
//   (그 값이 맞아도 안 되는 판이 있다. 컵 n개를 한 번에 n개씩 뒤집는 판은 처음 모습과 모두 뒤집은 모습만 오간다.)
// 나. 세 색 무리: { kind: 'colors', counts }
//   빨강, 파랑, 노랑 방울이가 counts[0], counts[1], counts[2]마리 있다. 색이 다른 둘이 만나면 둘 다 나머지 한 색이 된다.
//   모두 한 색이 되면 끝이다. 바뀌지 않는 것: 세 마릿수를 3으로 나눈 나머지는 만날 때마다 모두 함께 하나씩 바뀐다
//   (둘은 1 줄고 하나는 2 는다. 2 느는 것은 3으로 나눈 나머지로는 1 주는 것과 같다). 그래서 두 나머지가 같은지는 끝까지 그대로다.
//   모두 한 색이면 두 색이 0마리라서 두 나머지가 같다. 처음에 세 나머지가 모두 다르면 안 된다.
//   (규격 안의 모든 판에서, 나머지가 같은 두 색이 있으면 실제로 된다. 테스트가 다른 방법으로 확인한다.)
// 다. 셋이 하나로: { kind: 'merge', counts, target }
//   방울이 판과 같이 놓이지만, 색이 다른 둘이 만나면 둘이 합쳐져 나머지 한 색 하나가 된다(모두 수가 하나 준다).
//   한 색만 남으면 더 만날 수 없어서 끝난다. 남은 색이 target(0 빨강, 1 파랑, 2 노랑)이면 다 한 것이다.
//   바뀌지 않는 것: 만날 때마다 세 마릿수가 모두 하나씩 늘거나 줄어서, 세 수의 홀짝이 모두 함께 바뀐다.
//   그래서 두 수의 홀짝이 같은지는 끝까지 그대로다. 한 색만 남으면 남지 않은 두 색은 0마리로 홀짝이 같다.
//   세 수 가운데 홀짝이 혼자 다른 색이 있으면 어떻게 만나도 마지막에는 그 색만 남는다(남는 색이 정해진 판).
//   세 수의 홀짝이 모두 같은 판은 차례에 따라 어느 색이든 남을 수 있다(1, 1, 1이면 빨강, 파랑, 노랑이 다 된다).
//   사다리는 남는 색이 정해진 판만 낸다. 테스트가 다른 방법으로 규격 안의 모든 판을 따져 이것을 확인한다.
//
// 모습(items): 길이가 컵 수나 방울이 수인 배열. 컵은 0(바로 섬)과 1(엎어짐), 방울이는 0(빨강), 1(파랑), 2(노랑)다.
//   셋이 하나로 판은 만날 때마다 배열이 하나 짧아진다(앞 번호의 방울이가 셋째 색이 되고 뒤 번호의 방울이는 빠진다).
//   방울이는 처음에 빨강들, 파랑들, 노랑들의 차례로 놓인다. 판에는 마릿수만 적는다.
// 움직임(move): 고른 것들의 번호(작은 것부터). 컵은 k개, 방울이는 둘이다.
// 지나온 길(trail)은 움직임의 목록이다.

export const KINDS = ['cups', 'colors', 'merge'];
/** 방울이로 놓는 판인가(세 색 무리, 셋이 하나로) */
export const isFolk = (board) => board.kind === 'colors' || board.kind === 'merge';
/** 색의 수 */
export const COLORS = 3;
/** 판에 놓을 수 있는 수의 범위 */
export const RANGES = {
  /** 컵 수. 풀이 프로그램이 모습을 2의 n제곱 가지까지 따지므로 작게 둔다 */
  n: [3, 10],
  /** 한 색의 마릿수 */
  count: [0, 6],
  /** 방울이의 모두 수(한 색만 있는 판은 이미 끝난 판이라서 판으로 쓰지 않는 것은 사다리와 만들기가 거른다) */
  total: [2, 18],
};

const within = (value, [low, high]) => Number.isInteger(value) && value >= low && value <= high;
const sum = (list) => list.reduce((total, value) => total + value, 0);

/** 판이 규격에 맞는지 본다. 맞으면 null, 아니면 무엇이 틀렸는지 알리는 열쇠 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  if (board.kind === 'cups') {
    if (!within(board.n, RANGES.n)) return 'bad-count';
    if (!Number.isInteger(board.k) || board.k < 1 || board.k > board.n) return 'bad-k';
    if (!Array.isArray(board.cups) || board.cups.length !== board.n) return 'bad-cups';
    if (board.cups.some((cup) => cup !== 0 && cup !== 1)) return 'bad-cups';
    return null;
  }
  if (isFolk(board)) {
    const { counts } = board;
    if (!Array.isArray(counts) || counts.length !== COLORS) return 'bad-counts';
    if (!counts.every((count) => within(count, RANGES.count))) return 'bad-counts';
    if (!within(sum(counts), RANGES.total)) return 'bad-total';
    if (board.kind === 'merge' && !(Number.isInteger(board.target) && board.target >= 0 && board.target < COLORS)) return 'bad-target';
    return null;
  }
  return 'bad-kind';
}

/** 판을 같은 꼴로 베낀다(기록과 저장에 쓴다) */
export function copyBoard(board) {
  if (board.kind === 'cups') return { kind: 'cups', n: board.n, k: board.k, cups: board.cups.slice() };
  if (board.kind === 'merge') return { kind: 'merge', counts: board.counts.slice(), target: board.target };
  return { kind: 'colors', counts: board.counts.slice() };
}

/** 엎어진 컵의 수 */
export const downCount = (cups) => sum(cups);

/** 방울이들의 색 → 색마다의 마릿수 */
export function countsOf(colors) {
  const counts = Array(COLORS).fill(0);
  for (const color of colors) counts[color] += 1;
  return counts;
}

/** 마릿수 → 방울이들의 색(빨강들, 파랑들, 노랑들의 차례) */
export function colorsOf(counts) {
  return counts.flatMap((count, color) => Array(count).fill(color));
}

/** 처음 모습 */
export function startItems(board) {
  return board.kind === 'cups' ? board.cups.slice() : colorsOf(board.counts);
}

/** 끝난 모습인가: 컵은 모두 바로 섰는가, 방울이는 모두 한 색인가, 셋이 하나로는 정해진 색만 남았는가 */
export function isDone(board, items) {
  if (board.kind === 'cups') return items.every((cup) => cup === 0);
  if (board.kind === 'merge') return items.length > 0 && items.every((color) => color === board.target);
  return new Set(items).size <= 1;
}

/** 더 만날 수 없는가(셋이 하나로): 한 색만 남았다 */
export function isOver(board, items) {
  return isFolk(board) && new Set(items).size <= 1;
}

/** 두 색이 만나면 되는 나머지 한 색 */
export const thirdColor = (a, b) => 3 - a - b;

/**
 * 움직임이 규칙에 맞는지 본다. 맞으면 null.
 * @returns {null | 'bad' | 'size' | 'same'}
 *   bad   없는 번호이거나 같은 것을 두 번 골랐다
 *   size  컵을 k개가 아니게 골랐거나, 방울이를 둘이 아니게 골랐다
 *   same  같은 색 방울이 둘을 골랐다(만나도 바뀌지 않는다)
 */
export function checkMove(board, items, move) {
  if (!Array.isArray(move)) return 'bad';
  if (move.some((index) => !Number.isInteger(index) || index < 0 || index >= items.length)) return 'bad';
  if (new Set(move).size !== move.length) return 'bad';
  if (board.kind === 'cups') return move.length === board.k ? null : 'size';
  if (move.length !== 2) return 'size';
  return items[move[0]] === items[move[1]] ? 'same' : null;
}

/** 움직임 하나를 한 뒤의 모습(원래 배열은 그대로 둔다) */
export function applyMove(board, items, move) {
  const next = items.slice();
  if (board.kind === 'cups') {
    for (const index of move) next[index] = 1 - next[index];
    return next;
  }
  const [a, b] = move;
  const color = thirdColor(items[a], items[b]);
  next[a] = color;
  // 셋이 하나로: 둘이 합쳐져 하나가 된다. 앞 번호에 셋째 색이 남고 뒤 번호는 빠진다.
  if (board.kind === 'merge') next.splice(b, 1);
  else next[b] = color;
  return next;
}

/**
 * 지나온 길을 처음부터 따라가 본다.
 * @returns {{ok: boolean, items: number[]}} ok는 길의 모든 움직임이 규칙에 맞고 작은 번호부터 적혀 있는가
 */
export function replay(board, trail) {
  let items = startItems(board);
  if (!Array.isArray(trail)) return { ok: false, items };
  for (const move of trail) {
    if (checkMove(board, items, move) !== null) return { ok: false, items };
    if (move.some((index, at) => at > 0 && index <= move[at - 1])) return { ok: false, items };
    items = applyMove(board, items, move);
  }
  return { ok: true, items };
}

// ---- 풀이 프로그램 ----

/** 컵 n개에서 k개를 고르는 모든 묶음(비트로). 작은 번호부터 차례로 */
function pickMasks(n, k) {
  const masks = [];
  const pick = (from, left, mask) => {
    if (left === 0) {
      masks.push(mask);
      return;
    }
    for (let index = from; index <= n - left; index++) pick(index + 1, left - 1, mask | (1 << index));
  };
  pick(0, k, 0);
  return masks;
}

const indexesOf = (mask, n) => Array.from({ length: n }, (_, index) => index).filter((index) => (mask >> index) & 1);

/** 컵 판: 모습(비트)마다 너비 우선으로 따진다 */
function solveCups(board) {
  const { n, k } = board;
  const masks = pickMasks(n, k);
  const start = board.cups.reduce((mask, cup, index) => mask | (cup << index), 0);
  const size = 1 << n;
  const dist = new Int16Array(size).fill(-1);
  const cameFrom = new Int32Array(size).fill(-1);
  const cameBy = new Int32Array(size).fill(-1);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;
  dist[start] = 0;
  queue[tail++] = start;
  while (head < tail && dist[0] < 0) {
    const state = queue[head++];
    for (const mask of masks) {
      const next = state ^ mask;
      if (dist[next] >= 0) continue;
      dist[next] = dist[state] + 1;
      cameFrom[next] = state;
      cameBy[next] = mask;
      queue[tail++] = next;
    }
  }
  if (dist[0] < 0) return { possible: false, min: null, moves: [], states: tail };
  const moves = [];
  for (let state = 0; state !== start; state = cameFrom[state]) moves.push(indexesOf(cameBy[state], n));
  moves.reverse();
  return { possible: true, min: dist[0], moves, states: tail };
}

const PAIRS = [
  [0, 1],
  [0, 2],
  [1, 2],
];

/** 방울이 판: 색마다의 마릿수(모습)마다 너비 우선으로 따지고, 찾은 차례를 방울이 둘씩의 만남으로 옮긴다 */
function solveColors(board) {
  const key = (counts) => counts.join(',');
  const merge = board.kind === 'merge';
  // 셋이 하나로는 정해진 색만 남아야 끝이다(그 색이 0마리면 끝이 아니다).
  const done = merge ? (counts) => counts[board.target] > 0 && counts.every((count, color) => color === board.target || count === 0) : (counts) => counts.filter((count) => count > 0).length <= 1;
  const start = board.counts.slice();
  const came = new Map([[key(start), null]]);
  let layer = [start];
  let found = done(start) ? start : null;
  while (found === null && layer.length > 0) {
    const next = [];
    for (const counts of layer) {
      for (const [a, b] of PAIRS) {
        if (counts[a] === 0 || counts[b] === 0) continue;
        const after = counts.slice();
        after[a] -= 1;
        after[b] -= 1;
        after[thirdColor(a, b)] += merge ? 1 : 2;
        if (came.has(key(after))) continue;
        came.set(key(after), { before: counts, pair: [a, b] });
        if (found === null && done(after)) found = after;
        next.push(after);
      }
    }
    layer = next;
  }
  if (found === null) return { possible: false, min: null, moves: [], states: came.size };
  const pairs = [];
  for (let step = came.get(key(found)); step; step = came.get(key(step.before))) pairs.unshift(step.pair);
  // 색 둘씩의 차례를 방울이 둘씩으로 옮긴다: 그 색의 방울이 가운데 번호가 가장 작은 것을 고른다.
  let items = startItems(board);
  const moves = pairs.map(([a, b]) => {
    const move = [items.indexOf(a), items.indexOf(b)].sort((x, y) => x - y);
    items = applyMove(board, items, move);
    return move;
  });
  return { possible: true, min: moves.length, moves, states: came.size };
}

/**
 * 풀이 프로그램. 처음 모습에서 갈 수 있는 모든 모습을 너비 우선으로 따져, 끝낼 수 있는지와 가장 적은 횟수를 구한다.
 * @returns {{possible: boolean, min: number|null, moves: number[][], states: number}}
 *   moves   가장 짧은 차례 하나(움직임마다 고른 번호들). 안 되는 판이면 빈 목록
 *   states  따져 본 모습의 수(안 되는 판이면 갈 수 있는 모습 모두)
 */
export function solve(board) {
  const problem = checkBoard(board);
  if (problem) throw new Error(`판이 규격에 맞지 않아요: ${problem}`);
  return board.kind === 'cups' ? solveCups(board) : solveColors(board);
}

/**
 * 셋이 하나로: 어떻게 만나도 마지막에 남는 색이 정해져 있으면 그 색, 아니면 null.
 * 세 마릿수 가운데 홀짝이 혼자 다른 색이 남는다. 세 수의 홀짝이 모두 같으면 정해져 있지 않다.
 * (풀이 프로그램이 아니라 바뀌지 않는 값으로 셈한다. 테스트가 모든 판을 끝까지 따져 이것이 맞는지 본다.)
 */
export function forcedColor(counts) {
  const odd = counts.map((count) => count % 2);
  const alone = [0, 1, 2].filter((color) => odd.filter((value) => value === odd[color]).length === 1);
  return alone.length === 1 ? alone[0] : null;
}

// ---- 바뀌지 않는 값 ----

/** 세 마릿수를 3으로 나눈 나머지 */
export const remainders = (counts) => counts.map((count) => count % 3);

/** 세 나머지가 모두 다른가(그러면 아무리 해도 한 색이 되지 않는다) */
export function remaindersApart(counts) {
  return new Set(remainders(counts)).size === COLORS;
}

/**
 * "왜 그럴까?"의 까닭(바뀌지 않는 값)이 이 판이 왜 안 되는지를 말해 주는가.
 * 컵: 한 번에 짝수 개씩 뒤집고 엎어진 컵이 홀수 개인 판. 방울이: 세 나머지가 모두 다른 판.
 * 셋이 하나로: 정해진 색이 아닌 두 색의 홀짝이 다른 판(끝에는 둘 다 0마리라서 홀짝이 같아야 한다).
 */
export function invariantRulesOut(board) {
  if (board.kind === 'cups') return board.k % 2 === 0 && downCount(board.cups) % 2 === 1;
  if (board.kind === 'merge') {
    const [a, b] = [0, 1, 2].filter((color) => color !== board.target);
    return board.counts[a] % 2 !== board.counts[b] % 2;
  }
  return remaindersApart(board.counts);
}

/**
 * "불가능해요"라고 답했을 때의 판정과 짐작.
 * @param {{possible: boolean}} solution 풀이 프로그램의 결과
 * @param {object} board 판
 * @param {{moves?: number, upPicked?: boolean, pairs?: string[]}} tried 해 본 것
 *   moves 움직인 수, upPicked 바로 선 컵을 한 번이라도 함께 뒤집었는가, pairs 만나게 해 본 색의 짝('0-1' 따위)
 * @returns {{correct: boolean, guess: string|null}}
 *   guess  'impossible-no-try'     움직여 보지 않고 답했다
 *          'impossible-only-down'  엎어진 컵만 골라 뒤집었다(컵)
 *          'impossible-same-pair'  늘 같은 두 색을 만나게 했다(방울이)
 *          'impossible-other-way'  해 보지 않은 길이 남아 있다
 */
export function diagnoseImpossible(solution, board, tried = {}) {
  if (!solution.possible) return { correct: true, guess: null };
  if ((tried.moves ?? 0) === 0) return { correct: false, guess: 'impossible-no-try' };
  if (board.kind === 'cups' && tried.upPicked !== true) return { correct: false, guess: 'impossible-only-down' };
  if (isFolk(board) && (tried.pairs?.length ?? 0) <= 1) return { correct: false, guess: 'impossible-same-pair' };
  return { correct: false, guess: 'impossible-other-way' };
}

/**
 * "왜 그럴까?"를 판의 종류마다 따로 연다: 그 종류의 안 되는 판을 한 번 끝까지 만난 뒤에(맞혔거나 풀이를 보았거나).
 * 작은 판(곁판)의 기록은 세지 않는다. 같은 판의 기록이 여러 번 남았으면 맨 뒤의 것만 본다.
 */
export function whyOpen(records, kind) {
  const latest = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    if (record && typeof record === 'object' && typeof record.id === 'string') latest.set(record.id, record);
  }
  return [...latest.values()].some(
    (record) =>
      record.kind === 'round' &&
      record.format === 'cups' &&
      record.side !== true &&
      record.board?.kind === kind &&
      record.solution?.possible === false &&
      (record.outcome === 'solved' || record.outcome === 'solution'),
  );
}
