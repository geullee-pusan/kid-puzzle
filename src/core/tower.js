// 탑 옮기기의 판과 풀이 프로그램. 순수 함수만 둔다.
//
// 기둥은 셋이다(0 왼쪽, 1 가운데, 2 오른쪽). 원판은 크기 1(가장 작다)부터 n까지 하나씩 있다.
// 판(board): { n, start, target, ask? }
//   n       원판의 수
//   start   원판마다(크기 1부터 차례로) 처음에 꽂힌 기둥. 한 기둥의 원판은 늘 큰 것이 아래라서, 원판마다 기둥만 알면 모습이 하나로 정해진다
//   target  탑을 모두 쌓을 기둥(깃발 기둥)
//   ask     "몇 번째에 어느 원판?" 판에서 묻는 차례(가장 적게 옮길 때 몇 번째 옮기기인가). 다른 판에는 없다
// 모습(pos): 원판마다 지금 꽂힌 기둥. 옮기기 [from, to]: from 기둥의 맨 위 원판을 to 기둥으로.
// 옮길 수 있다: from 기둥에 원판이 있고, to 기둥이 비었거나 to 기둥의 맨 위 원판이 옮기는 원판보다 크다.
//
// 풀이 프로그램: 다 된 모습(모든 원판이 깃발 기둥)에서 거꾸로 너비 우선 탐색을 한 번 하여 3^n가지 모습 모두의 가장 적은 옮기기 횟수를 적어 둔다.
// 옮기기는 거꾸로 해도 옮기기라서(맨 위 원판을 돌려놓는 것) 다 된 모습까지의 횟수와 다 된 모습에서의 횟수가 같다.
// 원판 8개(6,561가지)까지 따진다. 가장 적게 옮기는 방법은 어느 모습에서나 하나뿐이다(테스트가 길의 수를 세어 확인한다).

/** 원판 수의 아래 끝과 위 끝(직접 만들기는 7개까지, 풀이 프로그램은 8개까지) */
export const MIN_DISCS = 1;
export const MAX_DISCS = 8;
export const MAKE_MAX = 7;
export const PEGS = 3;

/** 판이 맞는 값인가. 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  const { n, start, target } = board;
  if (!Number.isInteger(n) || n < MIN_DISCS || n > MAX_DISCS) return 'size';
  if (!Array.isArray(start) || start.length !== n || !start.every(isPeg)) return 'start';
  if (!isPeg(target)) return 'target';
  if ('ask' in board && board.ask !== undefined) {
    if (!Number.isInteger(board.ask) || board.ask < 1 || board.ask > 2 ** n - 1) return 'ask';
    if (!isTower(board)) return 'ask-start';
  }
  return null;
}

const isPeg = (peg) => Number.isInteger(peg) && peg >= 0 && peg < PEGS;

export function copyBoard(board) {
  const copy = { n: board.n, start: board.start.slice(), target: board.target };
  if (board.ask !== undefined) copy.ask = board.ask;
  return copy;
}
export const sameBoard = (a, b) => JSON.stringify(copyBoard(a)) === JSON.stringify(copyBoard(b));

/** 처음에 원판이 모두 한 기둥(깃발 기둥이 아닌 곳)에 탑으로 쌓여 있는가(흩어지지 않은 탑) */
export const isTower = (board) => board.start.every((peg) => peg === board.start[0]) && board.start[0] !== board.target;

/** 왼쪽 기둥에 쌓인 n개의 탑을 target 기둥으로 옮기는 판 */
export const standardBoard = (n, target = 2) => ({ n, start: new Array(n).fill(0), target });

/** 기둥마다 꽂힌 원판(아래에서 위로, 큰 것부터) */
export function stacksOf(pos) {
  const stacks = [[], [], []];
  for (let disc = pos.length; disc >= 1; disc--) stacks[pos[disc - 1]].push(disc);
  return stacks;
}

/** 기둥의 맨 위 원판(없으면 0) */
export function topOf(pos, peg) {
  for (let disc = 1; disc <= pos.length; disc++) if (pos[disc - 1] === peg) return disc;
  return 0;
}

/**
 * from 기둥의 맨 위 원판을 to 기둥으로 옮길 수 있는가. 되면 null, 아니면 까닭.
 *   { why: 'empty' }                   from 기둥에 원판이 없다
 *   { why: 'same' }                    같은 기둥이다
 *   { why: 'bigger', disc, onto }      옮기는 원판(disc)이 to 기둥의 맨 위 원판(onto)보다 크다
 */
export function moveProblem(pos, from, to) {
  if (!isPeg(from) || !isPeg(to)) return { why: 'peg' };
  if (from === to) return { why: 'same' };
  const disc = topOf(pos, from);
  if (disc === 0) return { why: 'empty' };
  const onto = topOf(pos, to);
  if (onto !== 0 && onto < disc) return { why: 'bigger', disc, onto };
  return null;
}

/** 옮긴 모습(새 값). 옮길 수 없으면 null */
export function moveOf(pos, from, to) {
  if (moveProblem(pos, from, to) !== null) return null;
  const next = pos.slice();
  next[topOf(pos, from) - 1] = to;
  return next;
}

/** 처음 모습에서 옮기기를 차례대로 해 본 모습. 옮길 수 없는 것이 있으면 null */
export function replay(board, moves) {
  if (!Array.isArray(moves)) return null;
  let pos = board.start.slice();
  for (const move of moves) {
    if (!Array.isArray(move) || move.length !== 2) return null;
    pos = moveOf(pos, move[0], move[1]);
    if (pos === null) return null;
  }
  return pos;
}

/** 옮기기마다 움직인 원판(크기). 옮길 수 없는 것이 있으면 null */
export function movedDiscs(board, moves) {
  const discs = [];
  let pos = board.start.slice();
  for (const [from, to] of moves) {
    const disc = topOf(pos, from);
    pos = moveOf(pos, from, to);
    if (pos === null) return null;
    discs.push(disc);
  }
  return discs;
}

/** 다 됐는가: 모든 원판이 target 기둥에 있다 */
export const isDone = (pos, target) => pos.every((peg) => peg === target);

// ---- 모습의 번호: 원판 1의 기둥 + 원판 2의 기둥 × 3 + … ----

export function rankOf(pos) {
  let rank = 0;
  for (let index = pos.length - 1; index >= 0; index--) rank = rank * 3 + pos[index];
  return rank;
}

export function posOfRank(n, rank) {
  const pos = [];
  let rest = rank;
  for (let index = 0; index < n; index++) {
    pos.push(rest % 3);
    rest = Math.floor(rest / 3);
  }
  return pos;
}

/** 한 모습에서 할 수 있는 옮기기(왼쪽 기둥부터, 옮겨 갈 기둥도 왼쪽부터) */
export function movesFrom(pos) {
  const list = [];
  for (let from = 0; from < PEGS; from++) for (let to = 0; to < PEGS; to++) if (moveProblem(pos, from, to) === null) list.push([from, to]);
  return list;
}

// ---- 풀이 프로그램: 다 된 모습에서 거꾸로 너비 우선 탐색 ----

const tables = new Map();

/**
 * 원판 n개의 모든 모습에서 target 기둥에 다 쌓기까지의 가장 적은 옮기기 횟수(한 번 만든 표는 적어 둔다).
 * @returns {Int16Array} 모습의 번호 → 횟수
 */
export function fewestTable(n, target) {
  const key = `${n}:${target}`;
  if (tables.has(key)) return tables.get(key);
  const total = 3 ** n;
  const dist = new Int16Array(total).fill(-1);
  const queue = new Int32Array(total);
  const goal = rankOf(new Array(n).fill(target));
  dist[goal] = 0;
  queue[0] = goal;
  let head = 0;
  let tail = 1;
  while (head < tail) {
    const rank = queue[head++];
    const pos = posOfRank(n, rank);
    for (const [from, to] of movesFrom(pos)) {
      const other = rankOf(moveOf(pos, from, to));
      if (dist[other] !== -1) continue;
      dist[other] = dist[rank] + 1;
      queue[tail++] = other;
    }
  }
  tables.set(key, dist);
  return dist;
}

/** 이 모습에서 target 기둥에 다 쌓기까지의 가장 적은 옮기기 횟수 */
export const fewestFrom = (pos, target) => fewestTable(pos.length, target)[rankOf(pos)];

/** 지금 모습에서 가장 적게 옮기는 길(옮기기의 차례). 늘 하나뿐이다 */
export function pathFrom(pos, target) {
  const table = fewestTable(pos.length, target);
  const path = [];
  let now = pos.slice();
  for (let left = table[rankOf(now)]; left > 0; left--) {
    for (const [from, to] of movesFrom(now)) {
      const next = moveOf(now, from, to);
      if (table[rankOf(next)] === left - 1) {
        path.push([from, to]);
        now = next;
        break;
      }
    }
  }
  return path;
}

/**
 * 풀이: 가장 적은 횟수와 그렇게 옮기는 길, 옮기기마다 움직이는 원판. 늘 다 쌓을 수 있다.
 * "몇 번째에 어느 원판?" 판이면 물은 차례에 움직이는 원판(answer)도 낸다.
 */
export function solve(board) {
  const path = pathFrom(board.start, board.target);
  const discs = movedDiscs(board, path);
  const result = { possible: true, fewest: path.length, path, discs };
  if (board.ask !== undefined) result.answer = discs[board.ask - 1];
  return result;
}

/** 움직여 온 차례가 가장 적게 옮기는 길을 그대로 따라왔는가 */
export function onPath(board, moves, path = solve(board).path) {
  if (moves.length > path.length) return false;
  return moves.every((move, index) => move[0] === path[index][0] && move[1] === path[index][1]);
}

/** 왼쪽 기둥의 탑을 target 기둥으로 옮길 때, 원판 수마다 가장 적은 횟수(표와 "왜 그럴까?"에서 쓴다. 그 자리에서 따진다) */
export function fewestRows(sizes, target = 2) {
  return sizes.map((n) => ({ n, fewest: fewestFrom(new Array(n).fill(0), target) }));
}

/** 원판 n개의 모든 모습 가운데 가장 많이 옮겨야 하는 횟수와, 그런 모습의 수 */
export function worstOf(n, target) {
  const table = fewestTable(n, target);
  let worst = 0;
  let count = 0;
  for (const value of table) {
    if (value > worst) {
      worst = value;
      count = 0;
    }
    if (value === worst) count += 1;
  }
  return { worst, count };
}
