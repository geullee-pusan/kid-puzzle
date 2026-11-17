// 누가 이길까의 풀이 프로그램을 다른 방법으로 다시 구해 견주는 데 쓴다.
// 규칙을 여기에 따로 적었다(src/core/duel.js의 규칙 함수를 쓰지 않는다).
// 자리를 하나로 묶지 않고 실제 자리 그대로 따진다. 느리지만 틀릴 곳이 적다.
//
// 자리의 꼴
//   초콜릿: 조각마다 [가로, 세로]의 목록(자리는 적지 않는다. 쪼개는 데에는 크기만 쓰인다)
//   돌:     더미마다 남은 돌의 수
// max는 한 번에 가져갈 수 있는 돌의 수의 위 끝이다(초콜릿과 여러 더미에서는 Infinity).

/** 수 하나를 둔 다음의 자리 모두 */
export function nextStates(kind, max, state) {
  const found = [];
  state.forEach((item, index) => {
    const rest = (parts) => [...state.slice(0, index), ...parts, ...state.slice(index + 1)];
    if (kind === 'choco') {
      const [w, h] = item;
      for (let at = 1; at < w; at++) found.push(rest([[at, h], [w - at, h]]));
      for (let at = 1; at < h; at++) found.push(rest([[w, at], [w, h - at]]));
    } else {
      for (let take = 1; take <= Math.min(item, max); take++) found.push(rest([item - take]));
    }
  });
  return found;
}

/** 둘 차례인 쪽이 이기는가: 더 둘 수 없으면 지고, 상대가 지는 자리로 보낼 수 있으면 이긴다 */
export function bruteWin(kind, max, state, memo = new Map()) {
  const key = JSON.stringify(state);
  if (memo.has(key)) return memo.get(key);
  const win = nextStates(kind, max, state).some((next) => !bruteWin(kind, max, next, memo));
  memo.set(key, win);
  return win;
}

/** 이 자리에서 끝까지 두었을 때 나올 수 있는 "남은 수의 횟수"를 모두 모은다 */
export function bruteLengths(kind, max, state, memo = new Map()) {
  const key = JSON.stringify(kind === 'choco' ? state.map((item) => item.join('x')).sort() : state);
  if (memo.has(key)) return memo.get(key);
  const nexts = nextStates(kind, max, state);
  const lengths = new Set();
  if (nexts.length === 0) lengths.add(0);
  for (const next of nexts) for (const length of bruteLengths(kind, max, next, memo)) lengths.add(length + 1);
  memo.set(key, lengths);
  return lengths;
}

/** 끝까지 두는 차례가 모두 몇 가지인지, 그 가운데 가장 짧은 것과 가장 긴 것(적어 두지 않고 하나하나 센다. 작은 판에서만 쓴다) */
export function allPlays(kind, max, state) {
  const nexts = nextStates(kind, max, state);
  if (nexts.length === 0) return { plays: 1, shortest: 0, longest: 0 };
  let plays = 0;
  let shortest = Infinity;
  let longest = 0;
  for (const next of nexts) {
    const below = allPlays(kind, max, next);
    plays += below.plays;
    shortest = Math.min(shortest, below.shortest + 1);
    longest = Math.max(longest, below.longest + 1);
  }
  return { plays, shortest, longest };
}

/** 판(src/core/duel.js의 꼴)을 여기서 쓰는 꼴로 바꾼다 */
export function fromBoard(board) {
  if (board.kind === 'choco') return { kind: 'choco', max: Infinity, state: [[board.w, board.h]] };
  if (board.kind === 'one') return { kind: 'stones', max: board.max, state: [board.n] };
  return { kind: 'stones', max: Infinity, state: board.piles.slice() };
}

/** 자리(src/core/duel.js의 꼴)를 여기서 쓰는 꼴로 바꾼다 */
export function fromState(board, state) {
  return board.kind === 'choco' ? state.map((piece) => [piece.w, piece.h]) : state.slice();
}
