// 켜고 끄기와 숫자 마술을 풀이 프로그램과 다른 방법으로 다시 푼다(테스트 전용).
// 불: 켜고 끄는 모든 묶음(2의 불 수 제곱 가지)을 하나씩 켜 보고 합을 센다(프로그램은 합마다 방법의 수를 쌓아 간다).
// 숫자 마술: 숫자를 글자로 늘어놓고 자리마다 빌려 오고 받아 올리며 세로셈을 한다(프로그램은 수로 바로 뺀다).

/** 모든 불 묶음: [{ mask, lit(번호들), sum }] */
export function allSubsets(lamps) {
  const list = [];
  for (let mask = 0; mask < 1 << lamps.length; mask++) {
    const lit = lamps.map((_, at) => at).filter((at) => mask & (1 << at));
    list.push({ mask, lit, sum: lit.reduce((total, at) => total + lamps[at], 0) });
  }
  return list;
}

/** 수 → 그 수를 만드는 불 묶음의 수(0은 아무것도 켜지 않은 것) */
export function bruteWays(lamps) {
  const ways = new Map();
  for (const { sum } of allSubsets(lamps)) ways.set(sum, (ways.get(sum) ?? 0) + 1);
  return ways;
}

/** 1부터 하나씩 올라가며 처음으로 못 만드는 수 */
export function bruteFirstMissing(lamps) {
  const ways = bruteWays(lamps);
  let n = 1;
  while (ways.has(n)) n += 1;
  return n;
}

/** 불 하나를 더 달 때: v를 1부터 limit까지 모두 달아 보고 가장 멀리 가는 v들(여럿이면 모두) */
export function bruteBestNext(lamps, limit) {
  let best = -1;
  let values = [];
  for (let v = 1; v <= limit; v++) {
    const reach = bruteFirstMissing([...lamps, v]) - 1;
    if (reach > best) {
      best = reach;
      values = [v];
    } else if (reach === best) values.push(v);
  }
  return { reach: best, values };
}

/** 카드 트릭: 수마다 그 수를 만드는 불 묶음이 하나뿐일 때, 카드(불)마다 그 불이 켜지는 수들 */
export function bruteCards(lamps) {
  const total = lamps.reduce((a, b) => a + b, 0);
  const cards = lamps.map(() => []);
  for (let n = 1; n <= total; n++) {
    const ways = allSubsets(lamps).filter((item) => item.sum === n);
    if (ways.length !== 1) return null;
    for (const at of ways[0].lit) cards[at].push(n);
  }
  return cards;
}

// ---- 숫자 마술: 글자로 하는 세로셈 ----
const digitsOf = (n) => String(n).split('').map(Number);
const fromDigits = (digits) => Number(digits.join('')) || 0;

/** 숫자를 거꾸로 늘어놓는다(앞의 0은 읽지 않는다) */
export const bruteReverse = (n) => fromDigits(digitsOf(n).reverse());

/** 큰 수에서 작은 수를 자리마다 빌려 오며 뺀다 */
export function columnSubtract(big, small) {
  const a = digitsOf(big).reverse();
  const b = digitsOf(small).reverse();
  const out = [];
  let borrow = 0;
  for (let at = 0; at < a.length; at++) {
    let d = a[at] - borrow - (b[at] ?? 0);
    borrow = d < 0 ? 1 : 0;
    if (d < 0) d += 10;
    out.push(d);
  }
  return fromDigits(out.reverse());
}

/** 두 수를 자리마다 받아 올리며 더한다. 자리마다 더한 값(받아 올림 전)도 돌려준다 */
export function columnAdd(x, y) {
  const a = digitsOf(x).reverse();
  const b = digitsOf(y).reverse();
  const out = [];
  const sums = [];
  let carry = 0;
  for (let at = 0; at < Math.max(a.length, b.length); at++) {
    const plain = (a[at] ?? 0) + (b[at] ?? 0);
    sums.push(plain);
    const d = plain + carry;
    out.push(d % 10);
    carry = d >= 10 ? 1 : 0;
  }
  if (carry) out.push(1);
  return { sum: fromDigits(out.reverse()), sums: sums.reverse() };
}

/** 숫자 마술 한 번: 뒤집어 큰 수에서 작은 수를 빼고, 나온 수를 뒤집어 더한다 */
export function bruteMagic(n) {
  const r = bruteReverse(n);
  const diff = columnSubtract(Math.max(n, r), Math.min(n, r));
  return { diff, back: bruteReverse(diff), sum: columnAdd(diff, bruteReverse(diff)).sum };
}
