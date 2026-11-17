// 테스트에서 약수 세금의 풀이 프로그램과 견줄 때 쓰는 다른 방법.
// 풀이 프로그램은 남은 카드의 묶음을 수 하나로 적고, 쓸모없는 카드를 빼서 같은 꼴을 묶고, 묶음마다 한 번만 따진다.
// 여기서는 규칙을 따로 적었다(나머지 셈으로 약수를 그때그때 찾는다). 카드는 수의 배열로 든다.

/** 남은 카드 가운데 k의 약수(k는 빼고) */
const dueOf = (left, k) => left.filter((card) => card !== k && k % card === 0);

/**
 * 가질 수 있는 모든 차례를 하나하나 끝까지 해 본다(적어 두지 않는다). 작은 판에서만 쓴다.
 * @param {number[]} cards
 * @returns {{best: number, bestWays: number, bestOrders: number[][], orders: number, worst: number, average: number}}
 *   best, bestWays  가장 많이 가진 합과, 그 합이 되는 차례의 수
 *   bestOrders      그 차례들
 *   orders          끝까지 가는 차례의 수
 *   worst           가장 적게 가진 합
 *   average         가질 수 있는 카드 가운데 하나를 고르게 뽑아 가질 때의 합의 평균
 */
export function bruteTax(cards) {
  const result = { best: -1, bestWays: 0, bestOrders: [], orders: 0, worst: Infinity, average: 0 };
  const walk = (left, path, sum, chance) => {
    const open = left.filter((card) => dueOf(left, card).length > 0);
    if (open.length === 0) {
      result.orders += 1;
      result.average += sum * chance;
      result.worst = Math.min(result.worst, sum);
      if (sum > result.best) {
        result.best = sum;
        result.bestWays = 0;
        result.bestOrders = [];
      }
      if (sum === result.best) {
        result.bestWays += 1;
        result.bestOrders.push(path);
      }
      return;
    }
    for (const card of open) {
      const due = dueOf(left, card);
      walk(left.filter((item) => item !== card && !due.includes(item)), [...path, card], sum + card, chance / open.length);
    }
  };
  walk(cards.slice(), [], 0, 1);
  return result;
}

/**
 * 큰 판에서 쓰는 다른 방법: 남은 카드를 글자열로 적어 두고 따진다. 쓸모없는 카드를 빼지 않는다(같은 꼴을 묶지 않는다).
 * @param {number[]} cards
 * @returns {{best: number, states: number}}
 */
export function plainMemoTax(cards) {
  const memo = new Map();
  const visit = (left) => {
    const key = left.join(',');
    const known = memo.get(key);
    if (known !== undefined) return known;
    let best = 0;
    for (const card of left) {
      const due = dueOf(left, card);
      if (due.length === 0) continue;
      best = Math.max(best, card + visit(left.filter((item) => item !== card && !due.includes(item))));
    }
    memo.set(key, best);
    return best;
  };
  return { best: visit(cards.slice()), states: memo.size };
}

/** "가장 큰 카드부터 가지기"를 따로 해 본다. */
export function bruteLargest(cards) {
  let left = cards.slice();
  const order = [];
  for (;;) {
    const open = left.filter((card) => dueOf(left, card).length > 0);
    if (open.length === 0) break;
    const card = Math.max(...open);
    const due = dueOf(left, card);
    left = left.filter((item) => item !== card && !due.includes(item));
    order.push(card);
  }
  return { sum: order.reduce((sum, card) => sum + card, 0), order };
}
