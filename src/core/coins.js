// 동전 뒤집기: 판, 뒤집는 규칙, 풀이 프로그램(너비 우선 탐색), 오답 짐작.
// 순수 함수만 둔다. 화면에 손대지 않고, 무작위 수와 지금 시각을 쓰지 않는다. 같은 입력은 늘 같은 출력을 낸다.
//
// 판(board): { n, shape, rule, coins }
//   n      동전 수
//   shape  'line'(한 줄) | 'ring'(고리)
//   rule   'any2'(아무 두 개) | 'any3'(아무 세 개) | 'adj3'(이웃한 세 개)
//   coins  길이 n인 배열. 1은 앞면, 0은 뒷면
// 목표는 모두 뒷면(0)으로 만드는 것이다.

/** 한 판에 놓을 수 있는 동전 수의 위 끝. 상태 수가 2의 n제곱이라 작게 둔다. */
export const MAX_COINS = 10;

/** 규칙마다 한 번에 뒤집는 개수와, 이웃해야 하는지 */
export const RULES = {
  any2: { count: 2, adjacent: false },
  any3: { count: 3, adjacent: false },
  adj3: { count: 3, adjacent: true },
};

export const SHAPES = ['line', 'ring'];

/** 판이 규격에 맞는지 본다. 맞으면 null, 아니면 무엇이 틀렸는지 알리는 열쇠 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  const rule = RULES[board.rule];
  if (!rule) return 'bad-rule';
  if (!SHAPES.includes(board.shape)) return 'bad-shape';
  if (!Number.isInteger(board.n) || board.n < rule.count || board.n > MAX_COINS) return 'bad-count';
  if (!Array.isArray(board.coins) || board.coins.length !== board.n) return 'bad-coins';
  if (board.coins.some((coin) => coin !== 0 && coin !== 1)) return 'bad-coins';
  return null;
}

/** 동전 배열을 수 하나로 바꾼다(i번째 동전이 앞면이면 i번째 비트가 1) */
export function toMask(coins) {
  let mask = 0;
  coins.forEach((coin, index) => {
    if (coin) mask |= 1 << index;
  });
  return mask;
}

export function fromMask(mask, n) {
  return Array.from({ length: n }, (_, index) => (mask >> index) & 1);
}

function indexesOf(mask, n) {
  const found = [];
  for (let index = 0; index < n; index++) if ((mask >> index) & 1) found.push(index);
  return found;
}

function maskOf(indexes) {
  let mask = 0;
  for (const index of indexes) mask |= 1 << index;
  return mask;
}

export function headCount(coins) {
  return coins.reduce((sum, coin) => sum + coin, 0);
}

/** 이 판에서 한 번에 뒤집을 수 있는 동전 묶음을 모두 낸다(비트로). 순서는 늘 같다. */
export function moveMasks({ n, shape, rule }) {
  const { count, adjacent } = RULES[rule];
  const masks = [];
  if (adjacent) {
    // 한 줄: 0-1-2, 1-2-3, … / 고리: 끝과 처음도 이웃이다
    const starts = shape === 'ring' ? n : n - count + 1;
    for (let start = 0; start < starts; start++) {
      let mask = 0;
      for (let step = 0; step < count; step++) mask |= 1 << ((start + step) % n);
      if (!masks.includes(mask)) masks.push(mask); // 동전 3개인 고리는 세 묶음이 모두 같다
    }
    return masks;
  }
  // 아무 count개: 작은 번호부터 차례로 고른 모든 묶음
  const pick = (from, left, mask) => {
    if (left === 0) {
      masks.push(mask);
      return;
    }
    for (let index = from; index <= n - left; index++) pick(index + 1, left - 1, mask | (1 << index));
  };
  pick(0, count, 0);
  return masks;
}

/** 고른 동전들이 규칙에 맞는 한 번의 뒤집기인가 */
export function isMove(board, indexes) {
  if (new Set(indexes).size !== indexes.length) return false;
  if (indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= board.n)) return false;
  return moveMasks(board).includes(maskOf(indexes));
}

/**
 * 지금까지 고른 동전에 더 고를 수 있는 동전들.
 * 이웃 규칙에서는 고른 것과 한 묶음이 될 수 있는 동전만 남는다.
 */
export function selectable(board, selected) {
  const chosen = maskOf(selected);
  const masks = moveMasks(board).filter((mask) => (mask & chosen) === chosen);
  const open = [];
  for (let index = 0; index < board.n; index++) {
    if ((chosen >> index) & 1) continue;
    if (masks.some((mask) => (mask >> index) & 1)) open.push(index);
  }
  return open;
}

/** 고른 동전들을 뒤집은 새 배열을 돌려준다(원래 배열은 그대로 둔다) */
export function applyMove(coins, indexes) {
  const next = coins.slice();
  for (const index of indexes) next[index] = next[index] ? 0 : 1;
  return next;
}

/**
 * 풀이 프로그램. 너비 우선 탐색으로 모든 상태를 가까운 것부터 살핀다.
 * @returns {{possible: boolean, min: number|null, moves: number[][]}}
 *   possible 모두 뒷면으로 만들 수 있는가
 *   min      가장 적은 횟수(안 되면 null)
 *   moves    가장 적은 횟수로 끝내는 순서 하나. 한 번에 뒤집는 동전 번호들의 목록
 */
export function solve(board) {
  const problem = checkBoard(board);
  if (problem) throw new Error(`판이 규격에 맞지 않아요: ${problem}`);
  const { n } = board;
  const masks = moveMasks(board);
  const size = 1 << n;
  const start = toMask(board.coins);
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
  if (dist[0] < 0) return { possible: false, min: null, moves: [] };
  const moves = [];
  for (let state = 0; state !== start; state = cameFrom[state]) moves.push(indexesOf(cameBy[state], n));
  moves.reverse();
  return { possible: true, min: dist[0], moves };
}

/**
 * 답을 견주고, 틀렸으면 무엇을 놓쳤을지 짐작한 열쇠를 돌려준다.
 * @param {{possible: boolean, min: number|null}} solution 풀이 프로그램의 결과
 * @param {{kind: 'number', value: number} | {kind: 'impossible'}} answer 아이가 넣은 답
 * @returns {{correct: boolean, guess: string|null}}
 *   guess: 'number-on-impossible' 안 되는 판에 수를 답함
 *          'impossible-on-possible' 되는 판에 불가능이라고 답함
 *          'too-many' 가장 적은 횟수보다 큰 수를 답함(더 적게 할 수 있다)
 *          'too-few' 가장 적은 횟수보다 작은 수를 답함
 */
export function diagnose(solution, answer) {
  if (answer.kind === 'impossible') {
    return solution.possible ? { correct: false, guess: 'impossible-on-possible' } : { correct: true, guess: null };
  }
  if (answer.kind !== 'number' || !Number.isInteger(answer.value) || answer.value < 0) throw new Error('답의 꼴이 맞지 않아요');
  if (!solution.possible) return { correct: false, guess: 'number-on-impossible' };
  if (answer.value === solution.min) return { correct: true, guess: null };
  return { correct: false, guess: answer.value > solution.min ? 'too-many' : 'too-few' };
}
