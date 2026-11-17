// 약수 세금의 규칙과 풀이 프로그램. 순수 함수만 둔다.
//
// 판: 수 카드 몇 장(1부터 30까지의 수 가운데 서로 다른 것들). 혼자 한다.
// - 카드 하나를 골라 가진다. 그러면 판에 남아 있는 그 수의 약수(자기 자신은 빼고)가 모두 세금으로 나간다.
// - 세금으로 나갈 약수가 판에 하나도 남아 있지 않은 수는 가질 수 없다.
// - 가질 수 있는 카드가 더 없으면 끝난다. 그때 판에 남은 카드는 모두 세금으로 나간다.
// - 가진 수의 합을 가장 크게 만드는 것이 목표다. 이 합은 놀이의 내용이다. 다른 것으로 바꿔 보여 주지 않는다.
//
// 풀이 프로그램은 지름길 규칙을 쓰지 않는다. 남은 카드의 묶음마다 "여기서부터 가장 많이 가질 수 있는 합"을
// 끝에서부터 따지고, 같은 묶음을 두 번 따지지 않게 적어 둔다.
// 남은 카드의 묶음은 수 하나(카드 k가 남아 있으면 k-1번째 자리가 1)로 적는다.
// 다시는 가질 수도, 세금으로 나갈 수도 없는 카드(남은 약수도 남은 배수도 없는 카드)는 빼고 적는다. 그래야 같은 꼴이 하나로 묶인다.

/** 카드에 적을 수 있는 가장 큰 수 */
export const MAX_CARD = 30;
/** 직접 만들기에서 "1부터 n까지"로 정할 수 있는 n의 아래 끝 */
export const MIN_N = 2;
/**
 * 풀이 프로그램이 따져 보는 묶음 수의 위 끝. 1부터 30까지를 모두 놓은 판이 가장 많이 따지는 판으로 보이지만
 * (테스트에서 여러 묶음을 재 본다) 모든 묶음을 다 재 본 것은 아니다. 넘으면 끝까지 못 따졌다고 사실대로 알린다.
 */
export const NODE_LIMIT = 200_000;

const BIT = [0];
const PROPER = [0]; // PROPER[k]: k의 약수(k는 빼고)들의 자리
const MULTIPLES = [0]; // MULTIPLES[k]: k의 배수(k는 빼고)들의 자리
for (let k = 1; k <= MAX_CARD; k++) BIT.push(1 << (k - 1));
for (let k = 1; k <= MAX_CARD; k++) {
  let proper = 0;
  let multiples = 0;
  for (let d = 1; d < k; d++) if (k % d === 0) proper |= BIT[d];
  for (let m = 2 * k; m <= MAX_CARD; m += k) multiples |= BIT[m];
  PROPER.push(proper);
  MULTIPLES.push(multiples);
}

/** 1부터 n까지의 카드 */
export function cardsUpTo(n) {
  return Array.from({ length: n }, (_, index) => index + 1);
}

/** k의 약수(k는 빼고). 작은 것부터 */
export function properDivisors(k) {
  const found = [];
  for (let d = 1; d < k; d++) if (k % d === 0) found.push(d);
  return found;
}

/**
 * 판이 쓸 수 있는 값인가. 쓸 수 있으면 null, 아니면 까닭.
 * @param {{cards: number[]}} board cards: 판에 놓인 카드(작은 것부터, 서로 다른 수)
 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object' || !Array.isArray(board.cards)) return 'shape';
  const { cards } = board;
  if (cards.length < 1 || cards.length > MAX_CARD) return 'count';
  for (let index = 0; index < cards.length; index++) {
    const card = cards[index];
    if (!Number.isInteger(card) || card < 1 || card > MAX_CARD) return 'card';
    if (index > 0 && card <= cards[index - 1]) return 'order';
  }
  return null;
}

/** 판이 "1부터 n까지"이면 그 n, 아니면 null */
export function plainN(board) {
  const { cards } = board;
  return cards.every((card, index) => card === index + 1) ? cards.length : null;
}

function maskOf(cards) {
  let mask = 0;
  for (const card of cards) mask |= BIT[card];
  return mask;
}

function cardsOf(mask) {
  const cards = [];
  for (let k = 1; k <= MAX_CARD; k++) if (mask & BIT[k]) cards.push(k);
  return cards;
}

/** 남은 카드 가운데 지금 가질 수 있는 것들(남은 약수가 하나라도 있는 카드). 작은 것부터 */
export function takeable(remaining) {
  const mask = maskOf(remaining);
  return remaining.filter((card) => (PROPER[card] & mask) !== 0);
}

/** 남은 카드에서 k를 가지면 세금으로 나갈 카드들(작은 것부터). k가 남아 있지 않으면 빈 목록 */
export function taxOf(remaining, k) {
  if (!remaining.includes(k)) return [];
  return cardsOf(PROPER[k] & maskOf(remaining));
}

/**
 * 처음 판에서 카드를 차례로 가져 본다.
 * @param {{cards: number[]}} board
 * @param {number[]} taken 가진 카드의 차례
 * @returns {{ok: boolean, remaining: number[], held: number[], paid: number[][], gone: number[], left: number[],
 *   sum: number, tax: number, ended: boolean, open: number[]}}
 *   ok         차례가 모두 규칙에 맞는가(아니면 맞는 데까지만 간다)
 *   remaining  판에 남은 카드
 *   held       가진 카드(차례대로)
 *   paid       카드를 가질 때마다 세금으로 나간 카드들
 *   gone       세금으로 나간 카드(차례대로. 끝난 판에서는 남은 카드까지)
 *   left       끝난 판에서, 아무도 가지지 못하고 남아서 세금으로 나간 카드
 *   sum, tax   가진 수의 합과 세금으로 나간 수의 합(끝난 판에서는 남은 카드까지 더한다)
 *   ended      가질 수 있는 카드가 더 없는가
 *   open       지금 가질 수 있는 카드
 */
export function replay(board, taken = []) {
  let mask = maskOf(board.cards);
  const held = [];
  const paid = [];
  let ok = Array.isArray(taken);
  for (const card of ok ? taken : []) {
    const due = Number.isInteger(card) && card >= 1 && card <= MAX_CARD && mask & BIT[card] ? PROPER[card] & mask : 0;
    if (due === 0) {
      ok = false;
      break;
    }
    mask &= ~(BIT[card] | due);
    held.push(card);
    paid.push(cardsOf(due));
  }
  const remaining = cardsOf(mask);
  const open = remaining.filter((card) => (PROPER[card] & mask) !== 0);
  const ended = open.length === 0;
  const left = ended ? remaining : [];
  const gone = [...paid.flat(), ...left];
  const total = (list) => list.reduce((sum, card) => sum + card, 0);
  return { ok, remaining, held, paid, gone, left, sum: total(held), tax: total(gone), ended, open };
}

/** 다시는 가질 수도 세금으로 나갈 수도 없는 카드를 뺀다(남은 약수도 남은 배수도 없는 카드). */
function trim(mask) {
  let kept = mask;
  for (let k = 1; k <= MAX_CARD; k++) {
    if (mask & BIT[k] && (PROPER[k] & mask) === 0 && (MULTIPLES[k] & mask) === 0) kept &= ~BIT[k];
  }
  return kept;
}

/** 묶음마다 값을 한 번만 따지는 틀. visit(묶음, 다음 묶음의 값을 주는 함수)로 값을 낸다. 따진 묶음이 limit을 넘으면 null */
function memoized(start, limit, visit) {
  const memo = new Map();
  let over = false;
  const valueOf = (raw) => {
    const mask = trim(raw);
    if (mask === 0) return visit(0, valueOf);
    const known = memo.get(mask);
    if (known !== undefined) return known;
    if (memo.size >= limit) {
      over = true;
      return visit(0, valueOf);
    }
    const value = visit(mask, valueOf);
    memo.set(mask, value);
    return value;
  };
  const value = valueOf(start);
  return { value: over ? null : value, nodes: memo.size, valueOf, over: () => over };
}

/** 묶음에서 둘 수 있는 수: [가질 카드, 다음 묶음] */
function movesOf(mask) {
  const moves = [];
  for (let k = MAX_CARD; k >= 1; k--) {
    if (!(mask & BIT[k])) continue;
    const due = PROPER[k] & mask;
    if (due !== 0) moves.push([k, mask & ~(BIT[k] | due)]);
  }
  return moves;
}

/** "가장 큰 카드부터 가지기": 가질 수 있는 카드 가운데 늘 가장 큰 것을 가진다. */
export function greedyLargest(board) {
  let mask = maskOf(board.cards);
  const order = [];
  for (;;) {
    const moves = movesOf(mask);
    if (moves.length === 0) break;
    const [card, next] = moves[0];
    order.push(card);
    mask = next;
  }
  return { sum: order.reduce((sum, card) => sum + card, 0), order };
}

/**
 * 판을 푼다: 가장 많이 가질 수 있는 합과 한 가지 차례.
 * @param {{cards: number[]}} board
 * @param {{limit?: number}} options limit: 따져 보는 묶음 수의 위 끝
 * @returns {{possible: true, exact: boolean, best: number, order: number[], total: number, nodes: number}}
 *   exact  끝까지 따졌는가. false면 best와 order는 "가장 큰 카드부터 가지기"로 얻은 것이고, 더 많이 가질 수 있을지도 모른다
 *   best   가장 많이 가질 수 있는 합(가질 수 있는 카드가 하나도 없는 판은 0)
 *   order  그 합이 되는 한 가지 차례. 같은 합이면 큰 카드를 먼저 고른 차례다
 *   total  판에 놓인 수를 모두 더한 것
 *   nodes  따져 본 묶음의 수
 */
export function solve(board, { limit = NODE_LIMIT } = {}) {
  const start = maskOf(board.cards);
  const total = board.cards.reduce((sum, card) => sum + card, 0);
  const search = memoized(start, limit, (mask, valueOf) => {
    let best = 0;
    for (const [card, next] of movesOf(mask)) best = Math.max(best, card + valueOf(next));
    return best;
  });
  if (search.value === null) {
    const greedy = greedyLargest(board);
    return { possible: true, exact: false, best: greedy.sum, order: greedy.order, total, nodes: search.nodes };
  }
  // 적어 둔 값을 따라 한 가지 차례를 되짚는다.
  const order = [];
  let mask = start;
  for (;;) {
    const here = search.valueOf(mask);
    const step = movesOf(mask).find(([card, next]) => card + search.valueOf(next) === here);
    if (!step) break;
    order.push(step[0]);
    mask = step[1];
  }
  return { possible: true, exact: true, best: search.value, order, total, nodes: search.nodes };
}

/** 가장 많이 가질 수 있는 합이 되는 차례가 몇 가지인가. 끝까지 못 따졌으면 null */
export function countBestOrders(board, { limit = NODE_LIMIT } = {}) {
  const search = memoized(maskOf(board.cards), limit, (mask, valueOf) => {
    let best = 0;
    let ways = 0;
    for (const [card, next] of movesOf(mask)) {
      const after = valueOf(next);
      const sum = card + after.best;
      if (sum > best || ways === 0) {
        best = sum;
        ways = after.ways;
      } else if (sum === best) ways += after.ways;
    }
    return ways === 0 ? { best: 0, ways: 1 } : { best, ways };
  });
  return search.value === null ? null : search.value.ways;
}

/**
 * "아무렇게나 가지기"의 평균: 가질 수 있는 카드 가운데 하나를 고르게 뽑아 가질 때, 끝났을 때 가진 수의 합의 평균.
 * 뽑아 보는 것이 아니라 모든 경우를 따진 값이다. 끝까지 못 따졌으면 null
 */
export function randomAverage(board, { limit = NODE_LIMIT } = {}) {
  const search = memoized(maskOf(board.cards), limit, (mask, valueOf) => {
    const moves = movesOf(mask);
    if (moves.length === 0) return 0;
    let sum = 0;
    for (const [card, next] of moves) sum += card + valueOf(next);
    return sum / moves.length;
  });
  return search.value;
}

/** 끝까지 가는 차례가 모두 몇 가지인가(작은 판에서 다른 방법과 견줄 때 쓴다). 끝까지 못 따졌으면 null */
export function countOrders(board, { limit = NODE_LIMIT } = {}) {
  const search = memoized(maskOf(board.cards), limit, (mask, valueOf) => {
    const moves = movesOf(mask);
    if (moves.length === 0) return 1;
    let ways = 0;
    for (const [, next] of moves) ways += valueOf(next);
    return ways;
  });
  return search.value;
}
