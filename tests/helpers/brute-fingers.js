// 손가락 더하기를 풀이 프로그램과 다른 방법으로 다시 푼다(테스트에서 견주려고).
// 풀이 프로그램은 손의 왼쪽 오른쪽을 가리지 않고 끝에서부터 거꾸로 칠한다. 여기서는 네 손을 왼쪽 오른쪽 그대로 들고,
// "n번 안에 이길 수 있는가 / n번 안에 질 수밖에 없는가"를 n = 1, 2, 3, …으로 늘려 가며 앞으로 따진다.
// 더 늘려도 바뀌는 것이 없으면 멈추고, 끝내 정해지지 않은 자리는 둘 다 잘 치면 끝나지 않는 자리(비김)다.

/** 맞은 손의 손가락 수(0은 빠짐). 넘으면 빠지거나(기본), 빠지는 수만큼 빼 나간다(다시 도는 규칙) */
function hit(limit, wrap, target, power) {
  let sum = target + power;
  if (!wrap) return sum >= limit ? 0 : sum;
  while (sum > limit) sum -= limit;
  return sum === limit ? 0 : sum;
}

/** 자리 하나: 칠 차례인 쪽의 손 a, b와 상대의 손 c, d(왼쪽 오른쪽 그대로) */
const keyOf = (a, b, c, d) => `${a}${b}${c}${d}`;

/** 칠 차례인 쪽이 칠 수 있는 수마다 다음 자리(상대가 칠 차례) */
function nextOf(limit, wrap, [a, b, c, d]) {
  const list = [];
  const mine = [a, b];
  const theirs = [c, d];
  for (let from = 0; from < 2; from++) {
    for (let to = 0; to < 2; to++) {
      if (mine[from] === 0 || theirs[to] === 0) continue;
      const after = [...theirs];
      after[to] = hit(limit, wrap, theirs[to], mine[from]);
      list.push([after[0], after[1], a, b]);
    }
  }
  return list;
}

const memo = new Map();

/**
 * 모든 자리의 값. Map(자리 → { outcome: 'win'|'lose'|'draw', plies })이다(칠 차례인 쪽에서 본 끝, 끝까지 남은 칠 수).
 * 두 손이 다 빠진 쪽이 칠 차례인 자리는 진 자리(0번)다.
 */
export function bruteTable(limit, wrap) {
  const name = `${limit}${wrap}`;
  if (memo.has(name)) return memo.get(name);
  const all = [];
  for (let a = 0; a < limit; a++) for (let b = 0; b < limit; b++) for (let c = 0; c < limit; c++) for (let d = 0; d < limit; d++) if (c + d > 0) all.push([a, b, c, d]);
  const known = new Map();
  for (const state of all) if (state[0] + state[1] === 0) known.set(keyOf(...state), { outcome: 'lose', plies: 0 });
  for (let n = 1; ; n++) {
    const found = [];
    for (const state of all) {
      const key = keyOf(...state);
      if (known.has(key)) continue;
      const next = nextOf(limit, wrap, state).map((item) => known.get(keyOf(...item)));
      // n번 안에 이긴다: 상대가 (n - 1)번 안에 지는 자리로 보내는 수가 있다
      if (next.some((value) => value && value.outcome === 'lose' && value.plies === n - 1)) found.push([key, { outcome: 'win', plies: n }]);
      // n번 안에 진다: 어느 수든 상대가 n - 1번 안에 이기는 자리로 간다(그 가운데 가장 늦은 것이 n - 1)
      else if (next.every((value) => value && value.outcome === 'win') && Math.max(...next.map((value) => value.plies)) === n - 1) found.push([key, { outcome: 'lose', plies: n }]);
    }
    if (found.length === 0 && n > 4 * limit * limit) break;
    for (const [key, value] of found) known.set(key, value);
  }
  const table = new Map();
  for (const state of all) table.set(keyOf(...state), known.get(keyOf(...state)) ?? { outcome: 'draw', plies: null });
  memo.set(name, table);
  return table;
}

/** 판의 값: 칠 차례인 쪽(first)에서 본 끝과 남은 칠 수 */
export function bruteValue(board, first = board.first) {
  const mine = first === 'kid' ? board.kid : board.teacher;
  const theirs = first === 'kid' ? board.teacher : board.kid;
  return bruteTable(board.limit, board.wrap).get(keyOf(mine[0], mine[1], theirs[0], theirs[1]));
}

/** 처음 모습에서 갈 수 있는 모든 자리(칠 차례인 쪽의 손 | 상대의 손, 왼쪽 오른쪽 그대로). 끝난 자리는 넣지 않는다 */
export function bruteReach(limit, wrap, start) {
  const seen = new Set();
  const stack = [start];
  while (stack.length > 0) {
    const state = stack.pop();
    const key = keyOf(...state);
    if (seen.has(key) || state[0] + state[1] === 0) continue;
    seen.add(key);
    stack.push(...nextOf(limit, wrap, state));
  }
  return seen;
}

/**
 * 같은 모습이 다시 나오면 비긴다는 약속을 넣고, 지나온 모습을 모두 들고 끝까지 따진다(작은 판에서만 쓴다).
 * 칠 차례인 쪽에서 본 끝: 1 이김, 0 비김, -1 짐.
 */
export function bruteWithRepeat(limit, wrap, state, path = new Set(), depth = 0) {
  if (state[0] + state[1] === 0) return -1;
  // 같은 네 손이라도 누구 차례인지가 다르면 다른 모습이다(처음에 칠 차례였던 쪽이면 0, 상대면 1)
  const name = (item, at) => `${keyOf(...item)}:${at % 2}`;
  path.add(name(state, depth));
  let best = -1;
  for (const next of nextOf(limit, wrap, state)) {
    const value = path.has(name(next, depth + 1)) ? 0 : 0 - bruteWithRepeat(limit, wrap, next, path, depth + 1);
    if (value > best) best = value;
    if (best === 1) break;
  }
  path.delete(name(state, depth));
  return best;
}
