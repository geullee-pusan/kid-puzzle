// 낼 수 없는 금액을 풀이 프로그램과 다른 방법으로 다시 따진다(테스트에서만 쓴다).
// 풀이 프로그램은 0원부터 차례로 "동전 하나를 뺀 금액을 낼 수 있는가"를 따지는 표를 만들고, 작은 동전의 값만큼 잇달아 낼 수 있으면 멈춘다.
// 여기서는 동전마다 몇 개를 쓸지를 모두 늘어놓아(겹친 반복) 그 합이 금액과 같은지를 본다. 멈추는 까닭(잇달아 낼 수 있으면 그 뒤도 된다)도 쓰지 않고,
// 넉넉한 끝(limit)까지 모두 세어 본다.

/** 동전마다 몇 개를 쓸지 모두 늘어놓아 그 금액을 낼 수 있는가 */
export function bruteCanPay(coins, amount) {
  const [a, b, c = null] = coins;
  for (let i = 0; i * a <= amount; i++) {
    for (let j = 0; i * a + j * b <= amount; j++) {
      const rest = amount - i * a - j * b;
      if (c === null) {
        if (rest === 0) return true;
      } else if (rest % c === 0) return true;
    }
  }
  return false;
}

/** 1원부터 limit원까지 낼 수 없는 금액들 */
export function bruteUnpayable(coins, limit) {
  const list = [];
  for (let amount = 1; amount <= limit; amount++) if (!bruteCanPay(coins, amount)) list.push(amount);
  return list;
}

/** 두 수를 함께 나누는 가장 큰 수(1부터 하나씩 따져 본다) */
export function bruteGcd(values) {
  let best = 1;
  for (let d = 2; d <= Math.min(...values); d++) if (values.every((value) => value % d === 0)) best = d;
  return best;
}
