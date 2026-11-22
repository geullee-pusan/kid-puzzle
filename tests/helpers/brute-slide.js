// 번호 말 제자리 찾기를 풀이 프로그램과 다른 방법으로 따진다(테스트 전용).
// - 맞바꾸기: 말의 차례를 글로 적어 두고, 아무 두 말이나 맞바꾸는 너비 우선 탐색으로 가장 적은 횟수를 모두 구한다(고리를 세지 않는다).
// - 밀기: 판을 글로 적어 두고, 빈칸의 (줄, 칸)에서 위아래 왼쪽 오른쪽을 따로 따지는 너비 우선 탐색으로 가장 적은 횟수를 모두 구한다(순열 번호를 쓰지 않는다).
// - 큰 수가 앞에 선 짝: 두 수의 짝을 모두 만들어 센다.

/** 1부터 n까지(밀기는 0부터 n − 1까지)의 모든 차례 */
export function allOrders(values) {
  if (values.length <= 1) return [values.slice()];
  const out = [];
  values.forEach((value, index) => {
    const rest = [...values.slice(0, index), ...values.slice(index + 1)];
    for (const tail of allOrders(rest)) out.push([value, ...tail]);
  });
  return out;
}

/** 맞바꾸기: 제자리에서 모든 차례까지의 가장 적은 맞바꾸기 횟수(차례를 쉼표로 이은 글 → 횟수) */
export function swapDistances(n) {
  const goal = Array.from({ length: n }, (_, index) => index + 1);
  const dist = new Map([[goal.join(','), 0]]);
  let layer = [goal];
  let depth = 0;
  while (layer.length > 0) {
    depth += 1;
    const next = [];
    for (const cells of layer) {
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          const other = cells.slice();
          const keep = other[a];
          other[a] = other[b];
          other[b] = keep;
          const key = other.join(',');
          if (dist.has(key)) continue;
          dist.set(key, depth);
          next.push(other);
        }
      }
    }
    layer = next;
  }
  return dist;
}

/** 밀기: 가로 w, 세로 h 판에서 제자리(1, 2, …, 빈칸 0이 맨 끝)로부터 닿는 모든 모습과 가장 적은 횟수(칸을 쉼표로 이은 글 → 횟수) */
export function slideDistances(w, h) {
  const n = w * h;
  const goal = Array.from({ length: n }, (_, index) => (index === n - 1 ? 0 : index + 1));
  const dist = new Map([[goal.join(','), 0]]);
  const queue = [goal];
  for (let head = 0; head < queue.length; head++) {
    const cells = queue[head];
    const hole = cells.indexOf(0);
    const row = Math.floor(hole / w);
    const col = hole % w;
    const depth = dist.get(cells.join(','));
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= h || c < 0 || c >= w) continue;
      const other = cells.slice();
      other[hole] = other[r * w + c];
      other[r * w + c] = 0;
      const key = other.join(',');
      if (dist.has(key)) continue;
      dist.set(key, depth + 1);
      queue.push(other);
    }
  }
  return dist;
}

/** 큰 수가 앞에 선 짝의 수: 앞뒤 두 수의 짝을 모두 만들어 센다 */
export function pairCount(line) {
  const pairs = line.flatMap((first, i) => line.slice(i + 1).map((second) => [first, second]));
  return pairs.filter(([first, second]) => first > second).length;
}

/** 판을 위 줄부터 한 줄로 읽은 수(빈칸은 건너뛴다) */
export const readLine = (cells) => cells.filter((value) => value !== 0);

/** 그 판에서 한 번 밀 수 있는 모든 것: [민 말이 있던 자리, 민 뒤의 칸들, 위아래로 민 것인가] */
export function slidesFrom(w, h, cells) {
  const hole = cells.indexOf(0);
  const out = [];
  for (let at = 0; at < w * h; at++) {
    const sameRow = Math.floor(at / w) === Math.floor(hole / w) && Math.abs(at - hole) === 1;
    const sameCol = Math.abs(at - hole) === w;
    if (!sameRow && !sameCol) continue;
    const other = cells.slice();
    other[hole] = other[at];
    other[at] = 0;
    out.push([at, other, sameCol]);
  }
  return out;
}
