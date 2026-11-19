// 규칙 기계와 규칙이 깨지는 판: 테스트에서 풀이 프로그램과 견줄 때 쓰는 다른 방법.
// 자리 숫자는 글자가 아니라 10으로 나눈 나머지로 꺼내고, 되풀이는 줄을 아주 길게 돌려 놓고 찾고,
// 원의 조각은 선끼리 엇갈린 곳을 직접 구해 꼭짓점·변·면의 수로 세거나 잘게 나눈 점마다 선의 어느 쪽인지 적어 센다.

/** 자리 숫자(10으로 나눈 나머지를 차례로 꺼낸다. 일의 자리가 먼저) */
function digitsBackward(n) {
  if (n === 0) return [0];
  const list = [];
  while (n > 0) {
    list.push(n % 10);
    n = Math.floor(n / 10);
  }
  return list;
}

/** 블록 하나(풀이 프로그램과 다른 방법으로) */
export function bruteStep(step, n) {
  const digits = digitsBackward(n);
  if (step.op === 'rev') return digits.reduce((total, digit) => total * 10 + digit, 0);
  if (step.op === 'add') return n + step.k;
  if (step.op === 'mul') {
    let total = 0;
    for (let at = 0; at < step.k; at++) total += n;
    return total;
  }
  if (step.op === 'dsum') return digits.reduce((total, digit) => total + digit, 0);
  if (step.op === 'dsq') return digits.reduce((total, digit) => total + digit * digit, 0);
  if (step.op === 'dprod') return digits.reduce((total, digit) => total * digit, 1);
  if (step.op === 'last2') return n - Math.floor(n / 100) * 100;
  if (step.op === 'addrev') return n + bruteStep({ op: 'rev' }, n);
  throw new Error(step.op);
}

/** 줄의 처음 count칸 */
export function bruteRow(machine, start, count) {
  const cells = start.slice();
  while (cells.length < count) {
    if (machine.kind === 'pair') {
      const [a, b] = cells.slice(-2);
      cells.push(a > b ? a - b : b - a);
    } else cells.push(machine.steps.reduce((value, step) => bruteStep(step, value), cells.at(-1)));
  }
  return cells.slice(0, count);
}

/**
 * 되풀이: 줄을 length칸 돌려 놓고, 뒤쪽 절반에서 가장 짧은 되풀이 칸 수를 찾은 다음 그 되풀이가 처음 시작되는 칸을 찾는다.
 * (length가 mu + 2 × lambda보다 넉넉히 길어야 한다)
 */
export function bruteCycle(machine, start, length = 3000) {
  const cells = bruteRow(machine, start, length);
  const tail = Math.floor(length / 2);
  let lambda = 1;
  for (; lambda < tail; lambda++) {
    let ok = true;
    for (let at = tail; at + lambda < length; at++) {
      if (cells[at] !== cells[at + lambda]) {
        ok = false;
        break;
      }
    }
    if (ok) break;
  }
  let mu = tail;
  while (mu > 0 && cells[mu - 1] === cells[mu - 1 + lambda]) mu -= 1;
  return { mu, lambda, cells };
}

/** 계속 작아지는 칸의 수(처음 칸부터) */
export function bruteFalling(machine, start) {
  const cells = bruteRow(machine, start, 80);
  let length = 1;
  while (length < cells.length && cells[length] < cells[length - 1]) length += 1;
  return length;
}

/** 에라토스테네스의 체: limit까지 약수가 둘뿐인 수인가 */
export function sieve(limit) {
  const prime = Array(limit + 1).fill(true);
  prime[0] = false;
  prime[1] = false;
  for (let n = 2; n * n <= limit; n++) if (prime[n]) for (let m = n * n; m <= limit; m += n) prime[m] = false;
  return prime;
}

/** 두 선분이 끝점이 아닌 곳에서 엇갈리는 자리(없으면 null) */
function crossPoint(p, q, r, s) {
  const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
  if (Math.abs(d) < 1e-12) return null;
  const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d;
  const u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
  if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null;
  return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
}

/**
 * 원 안의 조각 수를 꼭짓점(점과 엇갈린 곳), 변(선 조각과 원호), 면으로 센다(오일러: 면 = 변 − 꼭짓점 + 2, 원 바깥 면 하나를 뺀다).
 * 엇갈린 곳이 서로 너무 가까우면(세 선이 한 곳에서 만나면) 따로 알려 준다.
 */
export function eulerRegions(points) {
  const chords = [];
  for (let a = 0; a < points.length; a++) for (let b = a + 1; b < points.length; b++) chords.push([a, b]);
  const crossings = [];
  const onChord = chords.map(() => 0);
  chords.forEach(([a, b], i) => {
    chords.forEach(([c, d], j) => {
      if (j <= i) return;
      const hit = crossPoint(points[a], points[b], points[c], points[d]);
      if (hit) {
        crossings.push(hit);
        onChord[i] += 1;
        onChord[j] += 1;
      }
    });
  });
  let closest = Infinity;
  for (let i = 0; i < crossings.length; i++) for (let j = i + 1; j < crossings.length; j++) closest = Math.min(closest, Math.hypot(crossings[i][0] - crossings[j][0], crossings[i][1] - crossings[j][1]));
  const vertices = points.length + crossings.length;
  const arcs = points.length >= 2 ? points.length : 0;
  const edges = arcs + onChord.reduce((total, count) => total + count + 1, 0);
  // 점이 하나면 원 하나(꼭짓점 하나, 원호 하나)
  const faces = points.length <= 1 ? 2 : edges - vertices + 2;
  return { regions: faces - 1, crossings: crossings.length, closest };
}

/** 원 안을 잘게 나눈 점마다 선의 어느 쪽인지 적어, 서로 다른 것의 수를 센다(아주 가는 조각은 놓칠 수 있다) */
export function sampledRegions(points, steps = 700) {
  const chords = [];
  for (let a = 0; a < points.length; a++) for (let b = a + 1; b < points.length; b++) chords.push([points[a], points[b]]);
  const seen = new Set();
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const x = -1 + (2 * i) / steps;
      const y = -1 + (2 * j) / steps;
      if (x * x + y * y >= 0.9999) continue;
      seen.add(chords.map(([p, q]) => ((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]) > 0 ? '+' : '-')).join(''));
    }
  }
  return seen.size;
}
