// 모눈 자동차 경주의 판과 풀이 프로그램. 순수 함수만 둔다.
//
// 판(board): { rows, start, finish, flags }
//   rows    줄마다의 글자. '.'는 길 칸, '#'는 벽 칸. 판의 가로 w = rows[0].length, 세로 h = rows.length
//   start   [c, r] 차가 처음 서 있는 길 칸(c는 왼쪽부터의 열, r은 위부터의 줄). 차는 늘 칸의 가운데 점에 선다
//   finish  { side, from, to } 판의 한 변(side: 'top' | 'bottom' | 'left' | 'right')에 붙은 길 칸 from~to의 바깥 변이 결승선이다.
//           가로변(top, bottom)이면 from, to는 열이고 세로변이면 줄이다. 결승선 양옆(from - 1, to + 1)의 변 칸은 벽이다
//   flags   [[c, r], ...] 깃발 칸(없으면 빈 목록). 있으면 결승선을 넘기 전에 지나온 선이 깃발 칸에 한 번은 닿아야 한다
// 차(state): { x, y, vx, vy, flag } 칸의 가운데 점(x, y)과 지난번 움직임(vx, vy). flag는 깃발 칸에 닿았는가(깃발이 없는 판은 처음부터 참)
// 움직임 [ax, ay]: ax, ay는 -1, 0, 1. 다음 점은 (x + vx + ax, y + vy + ay)이고 그만큼이 새 움직임이 된다.
//   지난번 움직임에서 가로와 세로를 1칸까지 바꿀 수 있다는 규칙이다. 처음에는 움직임이 0이라서 둘레의 아홉 점 가운데 하나로 간다(제자리도 된다).
// 갈 수 있다: 지금 점에서 다음 점까지의 선이 벽에 닿지 않는다. 선이 벽 칸에 닿기만 해도(모서리 한 점이어도) 부딪힌 것이다.
//   판의 바깥은 모두 벽이고, 결승선만 열려 있다. 결승선을 지나 판 밖으로 나가는 움직임이 끝이다(그 뒤의 점은 어디여도 된다).
//   선이 결승선의 끝점에 닿으면 결승선 옆의 벽 칸에 닿는 것이라서 부딪힌 것이다.
//   깃발이 있는 판에서 깃발 칸에 닿기 전에 결승선을 넘으려 하면 그 움직임은 할 수 없다.
//
// 셈은 모두 정수로 한다. 칸 (c, r)을 [2c, 2c + 2] × [2r, 2r + 2]의 네모로 보면 가운데 점이 (2c + 1, 2r + 1)이 되어 나눗셈이 없다.
// 선과 칸이 닿는가: 선의 둘레 네모와 칸이 겹치고, 칸의 네 꼭짓점이 모두 선의 한쪽에만 있지 않으면 닿는다(닫힌 네모끼리).
//
// 풀이 프로그램: 처음 차에서 (점, 움직임, 깃발)을 함께 따지는 너비 우선 탐색. 갈 수 있는 차를 모두 돌아보며
// 결승선을 넘는 가장 적은 움직임 수와 그 방법 하나, 화면에 그려야 하는 둘레(결승선 너머의 점까지)를 구한다.

export const SIDES = ['top', 'bottom', 'left', 'right'];
/** 판의 가로와 세로의 위 끝 */
export const MAX_W = 12;
export const MAX_H = 12;
/** 움직임을 고르는 아홉 가지(왼쪽 위부터 줄마다) */
export const ACCELS = [-1, 0, 1].flatMap((ay) => [-1, 0, 1].map((ax) => [ax, ay]));

export const widthOf = (board) => board.rows[0].length;
export const heightOf = (board) => board.rows.length;
export const inBoard = (board, x, y) => x >= 0 && y >= 0 && x < widthOf(board) && y < heightOf(board);
export const isOpen = (board, x, y) => inBoard(board, x, y) && board.rows[y][x] === '.';
export const isFlag = (board, x, y) => board.flags.some(([c, r]) => c === x && r === y);

/** 결승선 칸들(판 안의 길 칸) */
export function finishCells(board) {
  const { side, from, to } = board.finish;
  const cells = [];
  for (let at = from; at <= to; at++) {
    if (side === 'top') cells.push([at, 0]);
    else if (side === 'bottom') cells.push([at, heightOf(board) - 1]);
    else if (side === 'left') cells.push([0, at]);
    else cells.push([widthOf(board) - 1, at]);
  }
  return cells;
}

/** 판이 맞는 값인가. 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  const { rows, start, finish, flags } = board;
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > MAX_H) return 'rows';
  const w = typeof rows[0] === 'string' ? rows[0].length : 0;
  if (w < 2 || w > MAX_W || !rows.every((row) => typeof row === 'string' && row.length === w && /^[.#]+$/.test(row))) return 'rows';
  if (!Array.isArray(start) || start.length !== 2 || !start.every(Number.isInteger) || !isOpen(board, start[0], start[1])) return 'start';
  if (!finish || !SIDES.includes(finish.side) || !Number.isInteger(finish.from) || !Number.isInteger(finish.to) || finish.from > finish.to) return 'finish';
  const along = finish.side === 'top' || finish.side === 'bottom' ? w : rows.length;
  if (finish.from < 0 || finish.to >= along) return 'finish';
  if (!finishCells(board).every(([c, r]) => isOpen(board, c, r))) return 'finish';
  // 결승선 양옆의 변 칸은 벽이다(결승선이 어디서 끝나는지 판에서 보이게)
  const edge = (at) => (finish.side === 'top' ? [at, 0] : finish.side === 'bottom' ? [at, rows.length - 1] : finish.side === 'left' ? [0, at] : [w - 1, at]);
  for (const at of [finish.from - 1, finish.to + 1]) {
    if (at < 0 || at >= along) continue;
    const [c, r] = edge(at);
    if (isOpen(board, c, r)) return 'finish-edge';
  }
  if (!Array.isArray(flags) || !flags.every((cell) => Array.isArray(cell) && cell.length === 2 && cell.every(Number.isInteger) && isOpen(board, cell[0], cell[1]))) return 'flags';
  if (new Set(flags.map(String)).size !== flags.length) return 'flags';
  return null;
}

export const copyBoard = (board) => ({
  rows: board.rows.slice(),
  start: board.start.slice(),
  finish: { side: board.finish.side, from: board.finish.from, to: board.finish.to },
  flags: board.flags.map((cell) => cell.slice()),
});
export const sameBoard = (a, b) => JSON.stringify(copyBoard(a)) === JSON.stringify(copyBoard(b));

/** 처음 차: 출발 칸에 서 있고 움직임은 0 */
export const startState = (board) => ({ x: board.start[0], y: board.start[1], vx: 0, vy: 0, flag: board.flags.length === 0 });

// ---- 선과 칸 ----

/** 두 배로 늘린 자리에서 선 a→b가 칸 (c, r)의 닫힌 네모에 닿는가 */
function touchesCell(ax, ay, bx, by, c, r) {
  const x0 = 2 * c;
  const x1 = x0 + 2;
  const y0 = 2 * r;
  const y1 = y0 + 2;
  if (Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1 || Math.max(ay, by) < y0 || Math.min(ay, by) > y1) return false;
  const dx = bx - ax;
  const dy = by - ay;
  let above = 0;
  let below = 0;
  for (const [px, py] of [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ]) {
    const side = dx * (py - ay) - dy * (px - ax);
    if (side > 0) above += 1;
    else if (side < 0) below += 1;
  }
  return above < 4 && below < 4;
}

/** 선 (x0, y0)→(x1, y1)(칸의 가운데 점끼리)이 닿는 판 안의 칸들 */
export function cellsTouched(board, x0, y0, x1, y1) {
  const w = widthOf(board);
  const h = heightOf(board);
  const ax = 2 * x0 + 1;
  const ay = 2 * y0 + 1;
  const bx = 2 * x1 + 1;
  const by = 2 * y1 + 1;
  const cells = [];
  const cLow = Math.max(0, Math.ceil((Math.min(ax, bx) - 2) / 2));
  const cHigh = Math.min(w - 1, Math.floor(Math.max(ax, bx) / 2));
  const rLow = Math.max(0, Math.ceil((Math.min(ay, by) - 2) / 2));
  const rHigh = Math.min(h - 1, Math.floor(Math.max(ay, by) / 2));
  for (let r = rLow; r <= rHigh; r++) for (let c = cLow; c <= cHigh; c++) if (touchesCell(ax, ay, bx, by, c, r)) cells.push([c, r]);
  return cells;
}

/**
 * 선 (x0, y0)→(x1, y1)이 어떻게 되는가. 앞 점은 판 안의 길 칸이다.
 *   'move'    판 안에서 벽에 닿지 않는다
 *   'finish'  벽에 닿지 않고 결승선을 지나 판 밖으로 나간다
 *   'wall'    벽(판의 바깥 변이나 결승선의 끝점도 벽이다)에 닿는다
 */
export function segmentKind(board, x0, y0, x1, y1) {
  for (const [c, r] of cellsTouched(board, x0, y0, x1, y1)) if (board.rows[r][c] !== '.') return 'wall';
  if (inBoard(board, x1, y1)) return 'move';
  // 판 밖으로 나간다: 결승선의 안쪽(끝점은 빼고)을 지나야 한다
  const w2 = 2 * widthOf(board);
  const h2 = 2 * heightOf(board);
  const ax = 2 * x0 + 1;
  const ay = 2 * y0 + 1;
  const bx = 2 * x1 + 1;
  const by = 2 * y1 + 1;
  const { side, from, to } = board.finish;
  // n: 결승선 바깥쪽으로 얼마나 나갔는가(선 위가 0), a: 결승선을 따라가는 자리
  const normal = { top: (x, y) => -y, bottom: (x, y) => y - h2, left: (x) => -x, right: (x) => x - w2 }[side];
  const along = side === 'top' || side === 'bottom' ? (x) => x : (x, y) => y;
  const nA = normal(ax, ay);
  const nB = normal(bx, by);
  if (nB <= 0) return 'wall';
  const span = nB - nA;
  const cross = along(ax, ay) * span + -nA * (along(bx, by) - along(ax, ay));
  return 2 * from * span < cross && cross < 2 * (to + 1) * span ? 'finish' : 'wall';
}

/** 선이 깃발 칸에 닿는가 */
export function touchesFlag(board, x0, y0, x1, y1) {
  if (board.flags.length === 0) return false;
  return cellsTouched(board, x0, y0, x1, y1).some(([c, r]) => isFlag(board, c, r));
}

/** 차가 [ax, ay]로 움직이면 닿는 점 */
export const targetOf = (state, ax, ay) => [state.x + state.vx + ax, state.y + state.vy + ay];

/**
 * 차를 [ax, ay]로 움직여 본다.
 * @returns {{kind: 'move'|'finish'|'wall'|'flag', next: object|null, flagged: boolean}}
 *   kind 'flag'는 깃발 칸에 닿기 전에 결승선을 넘으려 한 것이다(할 수 없다). flagged는 이 움직임의 선이 깃발 칸에 닿았는가
 */
export function tryMove(board, state, ax, ay) {
  const [x, y] = targetOf(state, ax, ay);
  const kind = segmentKind(board, state.x, state.y, x, y);
  if (kind === 'wall') return { kind, next: null, flagged: false };
  const flagged = touchesFlag(board, state.x, state.y, x, y);
  const flag = state.flag || flagged;
  if (kind === 'finish' && !flag) return { kind: 'flag', next: null, flagged };
  return { kind, next: { x, y, vx: x - state.x, vy: y - state.y, flag }, flagged };
}

/** 아홉 가지 움직임 모두 벽에 닿는가(깃발 때문에 못 넘는 것은 벽이 아니다) */
export const isStuck = (board, state) => ACCELS.every(([ax, ay]) => segmentKind(board, state.x, state.y, ...targetOf(state, ax, ay)) === 'wall');

/**
 * 움직임을 차례대로 해 본다.
 * @returns {{states: object[], finished: boolean}|null} states는 처음 차부터 움직일 때마다의 차. 할 수 없는 움직임이 있거나 끝난 뒤에 움직이면 null
 */
export function replay(board, moves) {
  if (!Array.isArray(moves)) return null;
  const states = [startState(board)];
  let finished = false;
  for (const move of moves) {
    if (finished || !isAccel(move)) return null;
    const result = tryMove(board, states.at(-1), move[0], move[1]);
    if (result.kind === 'wall' || result.kind === 'flag') return null;
    states.push(result.next);
    finished = result.kind === 'finish';
  }
  return { states, finished };
}

export const isAccel = (move) => Array.isArray(move) && move.length === 2 && move.every((value) => value === -1 || value === 0 || value === 1);

/** 차의 자리들에서 움직임들로(처음 차의 움직임은 0) */
export function accelsOf(states) {
  const moves = [];
  for (let at = 1; at < states.length; at++) moves.push([states[at].vx - states[at - 1].vx, states[at].vy - states[at - 1].vy]);
  return moves;
}

// ---- 풀이 프로그램 ----

/**
 * 너비 우선 탐색.
 * @returns {{possible: boolean, fewest: number|null, path: number[][], reached: number, extent: {x0: number, x1: number, y0: number, y1: number}, stuck: number}}
 *   path: 가장 적게 가는 방법 하나(움직임의 차례). 같은 판에는 늘 같은 방법을 낸다(ACCELS 차례로 본다)
 *   reached: 처음 차에서 갈 수 있는 차(판 안)의 수, stuck: 그 가운데 아홉 가지 모두 벽에 닿는 차의 수
 *   extent: 화면에 그릴 둘레(칸). 판 전체와, 갈 수 있는 차에서 결승선을 넘어 닿는 점을 모두 담는다
 */
export function solve(board) {
  const w = widthOf(board);
  const h = heightOf(board);
  const span = Math.max(w, h);
  const size = 2 * span + 1;
  const keyOf = (s) => ((((s.y * w + s.x) * size + (s.vx + span)) * size + (s.vy + span)) * 2 + (s.flag ? 1 : 0));
  const first = startState(board);
  const parent = new Map([[keyOf(first), null]]);
  const queue = [first];
  const depth = [0];
  let fewest = null;
  let goal = null;
  let stuck = 0;
  const extent = { x0: 0, x1: w - 1, y0: 0, y1: h - 1 };
  for (let head = 0; head < queue.length; head++) {
    const state = queue[head];
    const key = keyOf(state);
    let moved = false;
    for (const [ax, ay] of ACCELS) {
      const result = tryMove(board, state, ax, ay);
      if (result.kind === 'wall') continue;
      moved = true;
      if (result.kind === 'flag') continue;
      const next = result.next;
      if (result.kind === 'finish') {
        extent.x0 = Math.min(extent.x0, next.x);
        extent.x1 = Math.max(extent.x1, next.x);
        extent.y0 = Math.min(extent.y0, next.y);
        extent.y1 = Math.max(extent.y1, next.y);
        if (fewest === null) {
          fewest = depth[head] + 1;
          goal = { key, move: [ax, ay] };
        }
        continue;
      }
      const nextKey = keyOf(next);
      if (parent.has(nextKey)) continue;
      parent.set(nextKey, { key, move: [ax, ay] });
      queue.push(next);
      depth.push(depth[head] + 1);
    }
    if (!moved) stuck += 1;
  }
  const path = [];
  if (goal) {
    path.push(goal.move);
    for (let link = parent.get(goal.key); link; link = parent.get(link.key)) path.push(link.move);
    path.reverse();
  }
  return { possible: fewest !== null, fewest, path, reached: queue.length, extent, stuck };
}

/**
 * 깃발 칸을 하나 둔다면 칸마다 가장 적은 움직임 수가 얼마인가(깃발 단계의 판을 고를 때 쓴다).
 * 깃발이 없는 판에서 갈 수 있는 차를 모두 잇고, 처음 차에서의 거리(앞으로)와 결승선까지의 거리(거꾸로)를 한 번씩 구한다.
 * 칸 g를 깃발로 두면: g에 닿는 움직임 (i → j) 가운데 [처음 → i의 거리] + 1 + [j → 결승선의 거리]가 가장 작은 것이 답이다.
 * (깃발 판에서 가는 길은 g에 처음 닿는 움직임에서 둘로 나뉘고, 앞쪽은 결승선을 넘지 않는 길, 뒤쪽은 아무 길이다.)
 * @returns {Map<string, number>} 'c,r' → 가장 적은 움직임 수(그 칸을 깃발로 두면 결승선에 갈 수 없는 칸은 없다)
 */
export function flagCosts(board) {
  const plain = { ...board, flags: [] };
  const w = widthOf(plain);
  const span = Math.max(w, heightOf(plain));
  const size = 2 * span + 1;
  const keyOf = (s) => ((s.y * w + s.x) * size + (s.vx + span)) * size + (s.vy + span);
  const first = startState(plain);
  const index = new Map([[keyOf(first), 0]]);
  const states = [first];
  const dist = [0];
  const edges = []; // [i, j(결승선이면 -1), 닿는 칸들]
  for (let head = 0; head < states.length; head++) {
    const state = states[head];
    for (const [ax, ay] of ACCELS) {
      const result = tryMove(plain, state, ax, ay);
      if (result.kind === 'wall') continue;
      const next = result.next;
      const cells = cellsTouched(plain, state.x, state.y, next.x, next.y);
      if (result.kind === 'finish') {
        edges.push([head, -1, cells]);
        continue;
      }
      const key = keyOf(next);
      if (!index.has(key)) {
        index.set(key, states.length);
        states.push(next);
        dist.push(dist[head] + 1);
      }
      edges.push([head, index.get(key), cells]);
    }
  }
  // 결승선까지의 거리: 거꾸로 너비 우선
  const back = new Array(states.length).fill(Infinity);
  const into = states.map(() => []);
  const queue = [];
  for (const [i, j] of edges) {
    if (j === -1) {
      if (back[i] === Infinity) {
        back[i] = 1;
        queue.push(i);
      }
    } else into[j].push(i);
  }
  for (let head = 0; head < queue.length; head++) {
    const j = queue[head];
    for (const i of into[j]) {
      if (back[i] !== Infinity) continue;
      back[i] = back[j] + 1;
      queue.push(i);
    }
  }
  const best = new Map();
  for (const [i, j, cells] of edges) {
    const after = j === -1 ? 0 : back[j];
    if (after === Infinity) continue;
    const cost = dist[i] + 1 + after;
    for (const [c, r] of cells) {
      const key = `${c},${r}`;
      if (!best.has(key) || best.get(key) > cost) best.set(key, cost);
    }
  }
  return best;
}

/** 가장 적은 움직임 수(갈 수 없으면 null) */
export const fewestOf = (board) => solve(board).fewest;

/** 지난 움직임의 크기(가로와 세로 가운데 큰 쪽) */
export const speedOf = (state) => Math.max(Math.abs(state.vx), Math.abs(state.vy));
