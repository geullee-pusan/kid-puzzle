// 낼 수 없는 금액의 판과 풀이. 순수 함수만 둔다.
// 동전은 두세 가지(작은 것부터, 서로 다른 값)이고 몇 개든 쓸 수 있다. 띠에는 1원부터 top원까지의 금액이 있다.
// 판의 종류(kind):
//   'all'   모두 찾기: 띠의 금액 가운데 낼 수 없는 금액을 모두 고른다(동전은 늘 함께 묶이지 않는 짝이고, 띠는 낼 수 없는 가장 큰 금액보다 길다).
//   'from'  어디부터: 어느 금액부터는 모두 낼 수 있는지 자물쇠에 넣는다(띠는 그 금액 뒤로 작은 동전의 값만큼과 조금 더 있다).
//   'end'   끝이 있을까: 어디부터와 같고, "끝이 없어요"로도 답할 수 있다. 동전이 모두 같은 수로 묶이면(함께 나누는 수가 1보다 크면) 끝이 없다.
// 한 일(trail)의 글자:
//   'c0'  0번 동전 하나 담기          'x0'  담은 0번 동전 하나 빼기
//   'p'   담은 동전의 합을 띠에 칠하기(낼 수 있는 금액)   'm12'  띠의 12원을 "못 내요"로 고르거나 그만두기(칠한 금액은 고를 수 없다)
//   'w12' 칠한 12원을 낸 동전을 다시 담기
//
// 풀이: 0원부터 차례로 "그 금액에서 동전 하나를 뺀 금액을 낼 수 있는가"를 따지는 표(가장 적은 동전으로 내는 법도 적는다).
//   낼 수 있는 금액이 가장 작은 동전의 값만큼 잇달아 나오면 멈춘다. 그 뒤의 금액은 그 가운데 하나에 가장 작은 동전을 몇 개 더하면 되므로
//   모두 낼 수 있다. 그래서 그 바로 앞이 낼 수 없는 가장 큰 금액이다(가장 작은 동전이 1원이면 0, 곧 낼 수 없는 금액이 없다).
//   동전들을 함께 나누는 가장 큰 수(g)가 1보다 크면 낼 수 있는 금액은 모두 g로 나누어떨어지므로 끝이 없다.
// 테스트는 동전마다 몇 개를 쓸지를 모두 늘어놓는 다른 방법으로 다시 따진다(tests/helpers/brute-nopay.js).

/** 동전 값의 범위: 사다리는 2~20원, 직접 만들기는 1~9원 */
export const MIN_COIN = 1;
export const MAX_COIN = 20;
export const MAKE_MAX_COIN = 9;
/** 띠의 길이 위 끝과, "줄 맞추기"로 놓았을 때의 줄 수 위 끝(띠의 길이는 가장 작은 동전 × 이 수를 넘지 않는다) */
export const MAX_TOP = 40;
export const MAX_ROWS = 8;
/** 띠의 길이 아래 끝 */
export const MIN_TOP = 6;
/** 담은 동전의 합의 위 끝(자물쇠도 두 자리) */
export const MAX_SUM = 99;

const KINDS = ['all', 'from', 'end'];

export const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
/** 동전들을 함께 나누는 가장 큰 수 */
export const gcdOf = (coins) => coins.reduce((acc, value) => gcd(acc, value));

/** 동전 목록이 규격에 맞는가: 두세 가지, 작은 것부터, 서로 다른 값 */
export function coinsOk(coins, max = MAX_COIN) {
  if (!Array.isArray(coins) || coins.length < 2 || coins.length > 3) return false;
  if (!coins.every((value) => Number.isInteger(value) && value >= MIN_COIN && value <= max)) return false;
  return coins.every((value, index) => index === 0 || value > coins[index - 1]);
}

/** 띠의 길이가 가질 수 있는 위 끝(줄 맞추기로 놓아도 여덟 줄 안) */
export const topLimit = (coins) => Math.min(MAX_TOP, MAX_ROWS * coins[0]);

// ---- 풀이 ----

const tableMemo = new Map();
/**
 * 0원부터 limit원까지 금액마다 가장 적은 동전으로 내는 법(동전마다의 수). 낼 수 없으면 null.
 * 같은 수의 동전이면 큰 동전을 많이 쓰는 법을 고른다.
 * @returns {(number[] | null)[]}
 */
export function wayTable(coins, limit) {
  const key = coins.join(',');
  const known = tableMemo.get(key);
  if (known && known.length > limit) return known;
  const table = known ? known.slice() : [coins.map(() => 0)];
  for (let amount = table.length; amount <= limit; amount++) {
    let best = null;
    let bestCount = Infinity;
    for (let at = coins.length - 1; at >= 0; at--) {
      const before = amount - coins[at];
      if (before < 0 || table[before] === null) continue;
      const count = table[before].reduce((sum, value) => sum + value, 0) + 1;
      if (count < bestCount) {
        bestCount = count;
        best = table[before].map((value, index) => (index === at ? value + 1 : value));
      }
    }
    table.push(best);
  }
  tableMemo.set(key, table);
  return table;
}

/** 그 금액을 낼 수 있는가(0원은 동전 없이 낸다) */
export function canPay(coins, amount) {
  if (!Number.isInteger(amount) || amount < 0) return false;
  return wayTable(coins, amount)[amount] !== null;
}

/** 그 금액을 가장 적은 동전으로 내는 법(동전마다의 수). 없으면 null */
export function wayOf(coins, amount) {
  if (!Number.isInteger(amount) || amount < 0) return null;
  const way = wayTable(coins, amount)[amount];
  return way ? way.slice() : null;
}

const endMemo = new Map();
/**
 * 낼 수 없는 금액의 끝.
 *   { gcd, largest, from, count, unpayable }  gcd가 1이면 largest는 낼 수 없는 가장 큰 금액(없으면 0), from = largest + 1(이 금액부터 모두 낼 수 있다),
 *   count는 낼 수 없는 금액의 수, unpayable은 그 금액들. gcd가 1보다 크면 끝이 없어서 largest, from, count, unpayable이 null이다.
 */
export function endOf(coins) {
  const key = coins.join(',');
  if (endMemo.has(key)) return endMemo.get(key);
  const g = gcdOf(coins);
  let result;
  if (g > 1) result = { gcd: g, largest: null, from: null, count: null, unpayable: null };
  else {
    const small = coins[0];
    const unpayable = [];
    let run = 0;
    let amount = 0;
    // 함께 나누는 수가 1이면 언젠가 작은 동전의 값만큼 잇달아 낼 수 있게 된다
    while (run < small) {
      amount += 1;
      if (canPay(coins, amount)) run += 1;
      else {
        run = 0;
        unpayable.push(amount);
      }
    }
    const largest = amount - small;
    result = { gcd: 1, largest, from: largest + 1, count: unpayable.length, unpayable };
  }
  endMemo.set(key, result);
  return result;
}

/** 띠(1원부터 top원까지)에서 낼 수 없는 금액들 */
export function unpayableIn(coins, top) {
  return Array.from({ length: top }, (_, index) => index + 1).filter((amount) => !canPay(coins, amount));
}

/** 띠에서 낼 수 있는 금액들 */
export function payableIn(coins, top) {
  return Array.from({ length: top }, (_, index) => index + 1).filter((amount) => canPay(coins, amount));
}

/** 그 금액보다 큰 금액 가운데 가장 작은 낼 수 없는 금액. 끝이 있고 그 금액이 끝 뒤면 null */
export function nextUnpayable(coins, amount) {
  const end = endOf(coins);
  if (end.gcd === 1 && amount >= end.largest) return null;
  for (let value = amount + 1; ; value++) if (!canPay(coins, value)) return value;
}

// ---- 판 ----

/** 판이 규격에 맞는가. 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object' || !KINDS.includes(board.kind)) return 'kind';
  if (!coinsOk(board.coins)) return 'coins';
  const { coins, top } = board;
  if (!Number.isInteger(top) || top < Math.min(MIN_TOP, topLimit(coins)) || top > topLimit(coins)) return 'top';
  if (board.kind === 'end') return null;
  // 모두 찾기와 어디부터는 끝이 있는 동전이고, 띠에 낼 수 있는 금액이 작은 동전의 값만큼 잇달아 보인다
  const end = endOf(coins);
  if (end.gcd !== 1) return 'end';
  if (top < end.largest + coins[0]) return 'top';
  return null;
}

export function copyBoard(board) {
  return { kind: board.kind, coins: board.coins.slice(), top: board.top };
}

/** 판을 한 줄의 글로(같은 판인지 견주고, 적어 둘 때 쓴다) */
export const boardKey = (board) => `${board.kind}:${board.coins.join(',')}:${board.top}`;

export const sameBoard = (a, b) => boardKey(a) === boardKey(b);

/** 동전마다의 수로 낸 금액 */
export const sumOf = (coins, counts) => counts.reduce((sum, count, index) => sum + count * coins[index], 0);

/**
 * 처음 모습에서 한 일들을 차례로 한 모습.
 * @returns {{ok: boolean, tray: number[], sum: number, paid: Array<[number, number[]]>, marks: number[]}}
 *   tray는 담은 동전(동전마다의 수), paid는 칠한 금액과 그때 담았던 동전(금액이 작은 것부터), marks는 "못 내요"로 고른 금액(작은 것부터)
 */
export function replay(board, trail) {
  const { coins, top } = board;
  let tray = coins.map(() => 0);
  const paid = new Map();
  const marks = new Set();
  const state = (ok) => ({ ok, tray, sum: sumOf(coins, tray), paid: [...paid].sort((a, b) => a[0] - b[0]), marks: [...marks].sort((a, b) => a - b) });
  if (!Array.isArray(trail)) return state(false);
  for (const step of trail) {
    const found = typeof step === 'string' ? step.match(/^([cxmw])(\d+)$|^(p)$/) : null;
    if (!found) return state(false);
    if (found[3] === 'p') {
      const sum = sumOf(coins, tray);
      if (sum < 1 || sum > top) return state(false);
      if (!paid.has(sum)) paid.set(sum, tray.slice());
      marks.delete(sum);
      continue;
    }
    const at = Number(found[2]);
    if (found[1] === 'c') {
      if (at >= coins.length || sumOf(coins, tray) + coins[at] > MAX_SUM) return state(false);
      tray = tray.map((value, index) => (index === at ? value + 1 : value));
    } else if (found[1] === 'x') {
      if (at >= coins.length || tray[at] === 0) return state(false);
      tray = tray.map((value, index) => (index === at ? value - 1 : value));
    } else if (found[1] === 'm') {
      if (at < 1 || at > top || paid.has(at)) return state(false);
      if (marks.has(at)) marks.delete(at);
      else marks.add(at);
    } else {
      if (!paid.has(at)) return state(false);
      tray = paid.get(at).slice();
    }
  }
  return state(true);
}

/**
 * 판을 푼다.
 *   { possible, gcd, largest, from, count, unpayable(띠 안의 낼 수 없는 금액), payable(띠 안의 낼 수 있는 금액) }
 *   possible은 "어느 금액부터는 모두 낼 수 있는가"(끝이 있는가)다. 끝이 없는 판(함께 나누는 수가 1보다 큰 동전)만 거짓이다.
 */
export function solve(board) {
  const { coins, top } = board;
  const end = endOf(coins);
  return {
    possible: end.gcd === 1,
    gcd: end.gcd,
    largest: end.largest,
    from: end.from,
    count: end.count,
    unpayable: unpayableIn(coins, top),
    payable: payableIn(coins, top),
  };
}
