// 핀에 실 감기를 풀이 프로그램과 다른 방법으로 다시 따진다(테스트에서만 쓴다).
// 풀이 프로그램은 실을 실제로 따라가며 감는다. 여기서는
//   - 핀 p와 p + k를 잇는 선을 모두 그은 뒤 이어진 묶음을 센다(묶음 찾기: 같은 묶음끼리 대표를 하나로 모은다)
//   - 한 가닥의 핀 수는 "k를 몇 번 더해야 처음으로 n의 배수가 되는가"를 1부터 차례로 세어 구한다
//   - 두 수를 함께 나누는 가장 큰 수는 큰 수를 작은 수로 나눈 나머지를 되풀이해 구한다
// 세 가지가 풀이 프로그램의 가닥 수, 한 가닥의 핀 수와 맞는지를 테스트가 본다.

/** 두 수를 함께 나누는 가장 큰 수 */
export function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

/** 핀 p와 p + k를 모두 이었을 때 이어진 묶음들의 크기(작은 핀 번호의 묶음부터) */
export function groupsOf(n, k) {
  const parent = Array.from({ length: n }, (_, pin) => pin);
  const root = (pin) => {
    let at = pin;
    while (parent[at] !== at) at = parent[at];
    return at;
  };
  for (let pin = 0; pin < n; pin++) {
    const a = root(pin);
    const b = root((pin + k) % n);
    if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
  }
  const sizes = new Map();
  for (let pin = 0; pin < n; pin++) sizes.set(root(pin), (sizes.get(root(pin)) ?? 0) + 1);
  return [...sizes.entries()].sort((a, b) => a[0] - b[0]).map(([, size]) => size);
}

/** k를 몇 번 더해야 처음으로 n의 배수가 되는가 */
export function returnAfter(n, k) {
  let times = 1;
  while ((k * times) % n !== 0) times += 1;
  return times;
}

/** 칸 수를 차례로 번갈아(예: 2칸, 3칸, 2칸, …) 감을 때 처음 핀으로 돌아올 때까지 지나는 핀들 */
export function walkTurns(n, turns, start = 0) {
  const pins = [start];
  let pin = start;
  for (let step = 0; step < 10 * n; step++) {
    pin = (pin + turns[step % turns.length]) % n;
    if (pin === start) return pins;
    pins.push(pin);
  }
  return null;
}

/** 1과 자기 자신으로만 똑같이 나누어지는 수인가(하나씩 나누어 본다) */
export function onlyOneAndItself(n) {
  if (n < 2) return false;
  for (let d = 2; d < n; d++) if (n % d === 0) return false;
  return true;
}
