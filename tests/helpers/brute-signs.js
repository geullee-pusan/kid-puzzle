// 부호 넣어 수 만들기를 풀이 프로그램과 다른 방법으로 다시 따진다(테스트에서만 쓴다).
// 풀이 프로그램은 부호를 고르는 방법을 비트로 늘어놓고 하나씩 계산한다. 여기서는 수를 하나씩 더해 가며
// "지금까지 나올 수 있는 수와 그 방법의 수, − 부호를 가장 적게 쓴 수"를 표로 들고 간다.

/**
 * 수들 사이에 +나 −를 넣어 나오는 수마다 { ways: 방법의 수, fewest: − 부호를 가장 적게 쓴 수 }.
 * 첫 수 앞에는 부호가 없다(늘 +).
 * @param {number[]} numbers
 * @returns {Map<number, {ways: number, fewest: number}>}
 */
export function bruteRow(numbers) {
  let table = new Map([[numbers[0], { ways: 1, fewest: 0 }]]);
  for (const x of numbers.slice(1)) {
    const next = new Map();
    for (const [value, { ways, fewest }] of table) {
      for (const [to, minus] of [
        [value + x, 0],
        [value - x, 1],
      ]) {
        const before = next.get(to);
        if (before) next.set(to, { ways: before.ways + ways, fewest: Math.min(before.fewest, fewest + minus) });
        else next.set(to, { ways, fewest: fewest + minus });
      }
    }
    table = next;
  }
  return table;
}

/** n부터 1까지의 줄 */
export const rowOf = (n) => bruteRow(Array.from({ length: n }, (_, index) => n - index));

/**
 * 메뚜기가 0에서 1칸, 2칸, …, n칸을 저마다 왼쪽이나 오른쪽으로 뛰어 닿는 곳마다 { ways, fewest(왼쪽 뜀이 가장 적은 수) }.
 * 첫 뜀도 고를 수 있으므로 0을 맨 앞에 둔 줄과 같다.
 */
export const hopOf = (n) => bruteRow([0, ...Array.from({ length: n }, (_, index) => index + 1)]);

/** 1부터 top까지의 수 가운데 n부터 1까지의 줄로 만들 수 없는 수들 */
export function bruteMissing(n, top) {
  const reach = rowOf(n);
  return Array.from({ length: top }, (_, index) => index + 1).filter((value) => !reach.has(value));
}
