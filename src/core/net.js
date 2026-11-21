// 그물 끊기의 판과 풀이. 순수 함수만 둔다.
// 판: 매듭(점)과 매듭 둘을 잇는 줄(선). 매듭의 자리는 칸 단위의 수(가로 x, 세로 y)다.
// 아이는 줄을 눌러 끊는다(끊은 줄을 다시 누르면 이어진다). 그물이 조각나지 않게 가장 많이 몇 줄을 끊을 수 있는지 본다.
// 처음부터 여러 조각인 판(두 그물을 나란히 둔 판, 처음부터 두 조각인 그물)은 조각 수가 늘지 않게 끊는다.
// 더 끊을 줄이 없는 때: 조각 수가 처음과 같고, 남은 줄 가운데 고리(한 바퀴 돌아 제자리로 오는 길)에 든 줄이 없다.
// 그때 끊은 줄의 수는 어떤 차례로 끊었든 늘 (줄 수) - (매듭 수) + (처음 조각 수)다. 이 수는 풀이에서 따로 구하고,
// 테스트가 끊는 차례를 모두 따라가 보거나 끊을 줄을 모두 골라 보는 다른 방법으로 다시 센다.
//
// 판의 꼴: { knots: [[x, y], …], strings: [[a, b], …], family }. family는 판의 종류 이름(그림을 고르거나 작은 판을 찾을 때 쓴다).

/** 판 크기의 범위 */
export const MIN_KNOTS = 3;
export const MAX_KNOTS = 30;
export const MAX_STRINGS = 60;
/** 매듭이 놓일 수 있는 자리(칸 단위) */
export const MAX_X = 12;
export const MAX_Y = 8;
/** 매듭 사이는 이만큼 떨어진다(칸 단위). 줄이 다른 매듭 곁을 이만큼 안으로 지나가지 않는다 */
export const KNOT_GAP = 0.6;
export const PASS_GAP = 0.25;
/** 줄을 누른 것으로 보는 거리(칸 단위). 누른 곳에서 가장 가까운 줄이 눌린다 */
export const REACH = 0.45;
/** 짐작할 수 있는 수의 위 끝 */
export const MAX_GUESS = 20;
/** 기록에 남기는 누름의 수의 위 끝(넘으면 지금 끊긴 줄만 남긴다) */
export const MAX_MOVES = 400;

const isInt = (value) => Number.isInteger(value);
const isNum = (value) => typeof value === 'number' && Number.isFinite(value);

/** 점 p에서 선분 a-b까지의 거리 */
export function segmentDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** 줄 하나의 두 끝 자리 */
export const endsOf = (board, index) => board.strings[index].map((knot) => board.knots[knot]);

/**
 * 판이 규격에 맞는가. 맞으면 null, 아니면 까닭(개발자용 글).
 * 매듭은 서로 떨어져 있고, 모든 매듭에 줄이 하나 이상 있고, 같은 두 매듭을 잇는 줄은 하나뿐이고,
 * 줄이 다른 매듭 위를 지나가지 않는다(지나가면 이어진 것처럼 보인다).
 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return '판이 없어요';
  const { knots, strings } = board;
  if (!Array.isArray(knots) || !Array.isArray(strings)) return '매듭이나 줄이 없어요';
  if (knots.length < MIN_KNOTS || knots.length > MAX_KNOTS) return `매듭 수가 범위 밖이에요: ${knots.length}`;
  if (strings.length < 1 || strings.length > MAX_STRINGS) return `줄 수가 범위 밖이에요: ${strings.length}`;
  for (const knot of knots) {
    if (!Array.isArray(knot) || knot.length !== 2 || !isNum(knot[0]) || !isNum(knot[1])) return '매듭의 자리가 수가 아니에요';
    if (knot[0] < 0 || knot[0] > MAX_X || knot[1] < 0 || knot[1] > MAX_Y) return `매듭이 판 밖에 있어요: ${knot}`;
  }
  for (let a = 0; a < knots.length; a++) {
    for (let b = a + 1; b < knots.length; b++) {
      if (Math.hypot(knots[a][0] - knots[b][0], knots[a][1] - knots[b][1]) < KNOT_GAP) return `매듭이 너무 가까워요: ${a}, ${b}`;
    }
  }
  const seen = new Set();
  const degree = Array(knots.length).fill(0);
  for (const string of strings) {
    if (!Array.isArray(string) || string.length !== 2) return '줄의 꼴이 맞지 않아요';
    const [a, b] = string;
    if (!isInt(a) || !isInt(b) || a < 0 || b < 0 || a >= knots.length || b >= knots.length || a === b) return `줄의 매듭이 맞지 않아요: ${string}`;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return `같은 두 매듭을 잇는 줄이 둘이에요: ${key}`;
    seen.add(key);
    degree[a] += 1;
    degree[b] += 1;
    for (let other = 0; other < knots.length; other++) {
      if (other === a || other === b) continue;
      if (segmentDistance(knots[other], knots[a], knots[b]) < PASS_GAP) return `줄이 매듭 ${other} 위를 지나가요: ${key}`;
    }
  }
  if (degree.some((value) => value === 0)) return '줄이 없는 매듭이 있어요';
  return null;
}

/**
 * 묶음 찾기: 매듭 n개를 줄(쓸 수 있는 것만)로 이은 조각들.
 * @param {number} n 매듭 수
 * @param {number[][]} strings 줄들
 * @param {(index: number) => boolean} keep 이 줄이 남아 있는가
 * @returns {{count: number, label: number[]}} 조각 수와 매듭마다 조각 번호(조각 안의 가장 앞 번호 매듭의 차례로 0, 1, …)
 */
export function piecesOf(n, strings, keep = () => true) {
  const parent = Array.from({ length: n }, (_, index) => index);
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  strings.forEach(([a, b], index) => {
    if (!keep(index)) return;
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  });
  const names = new Map();
  const label = Array.from({ length: n }, (_, knot) => {
    const root = find(knot);
    if (!names.has(root)) names.set(root, names.size);
    return names.get(root);
  });
  return { count: names.size, label };
}

/** 누른 줄의 차례(같은 줄을 두 번 누르면 다시 이어진다)로 지금 끊긴 줄들(작은 번호부터) */
export function cutOf(moves) {
  const cut = new Set();
  for (const index of moves) {
    if (cut.has(index)) cut.delete(index);
    else cut.add(index);
  }
  return [...cut].sort((a, b) => a - b);
}

/** 누른 줄의 차례가 이 판에 맞는가(줄 번호만 본다) */
export const movesOk = (board, moves) => Array.isArray(moves) && moves.length <= MAX_MOVES && moves.every((index) => isInt(index) && index >= 0 && index < board.strings.length);

/** 가장 많이 끊을 수 있는 줄의 수: (줄 수) - (매듭 수) + (처음 조각 수) */
export function maxCut(board) {
  return board.strings.length - board.knots.length + piecesOf(board.knots.length, board.strings).count;
}

/**
 * 지금 모습.
 * @param {object} board
 * @param {number[]} cut 끊긴 줄들
 * @returns {{cut: number, left: number, pieces: number, start: number, loops: boolean, split: boolean, done: boolean, label: number[], startLabel: number[]}}
 *   cut 끊은 줄 수, left 남은 줄 수, pieces 지금 조각 수, start 처음 조각 수, loops 남은 줄에 고리가 있는가,
 *   split 처음보다 조각이 늘었는가, done 더 끊을 줄이 없는가(조각 수가 처음과 같고 고리가 없다)
 */
export function stateOf(board, cut) {
  const off = new Set(cut);
  const n = board.knots.length;
  const now = piecesOf(n, board.strings, (index) => !off.has(index));
  const first = piecesOf(n, board.strings);
  const left = board.strings.length - off.size;
  // 고리가 없는 그물은 매듭 수에서 조각 수를 뺀 만큼만 줄이 있다. 그보다 많으면 어딘가에 고리가 있다.
  const loops = left > n - now.count;
  const split = now.count > first.count;
  return { cut: off.size, left, pieces: now.count, start: first.count, loops, split, done: !split && !loops, label: now.label, startLabel: first.label };
}

/**
 * 남은 줄로 된 고리 가운데 가장 짧은 것 하나(같으면 앞 번호의 줄이 든 것). 없으면 null.
 * @returns {{strings: number[], knots: number[]}|null} 고리를 이루는 줄들과 매듭들(차례대로)
 */
export function loopOf(board, cut) {
  const off = new Set(cut);
  const n = board.knots.length;
  const near = Array.from({ length: n }, () => []);
  board.strings.forEach(([a, b], index) => {
    if (off.has(index)) return;
    near[a].push([b, index]);
    near[b].push([a, index]);
  });
  let best = null;
  board.strings.forEach(([a, b], skip) => {
    if (off.has(skip)) return;
    // 이 줄을 빼고 a에서 b까지 가장 짧은 길
    const from = Array(n).fill(null);
    const seen = Array(n).fill(false);
    seen[a] = true;
    const queue = [a];
    while (queue.length > 0 && !seen[b]) {
      const knot = queue.shift();
      for (const [next, index] of near[knot]) {
        if (index === skip || seen[next]) continue;
        seen[next] = true;
        from[next] = [knot, index];
        queue.push(next);
      }
    }
    if (!seen[b]) return;
    const strings = [skip];
    const knots = [b];
    for (let at = b; at !== a; at = from[at][0]) {
      strings.push(from[at][1]);
      knots.push(from[at][0]);
    }
    if (!best || strings.length < best.strings.length) best = { strings, knots };
  });
  return best;
}

/**
 * 더 끊을 줄이 없게 끊는 방법 하나. 줄을 order의 차례로 보며, 이미 이어진 두 매듭을 잇는 줄을 끊는다(끊어도 조각이 늘지 않는다).
 * @param {number[]} order 줄을 보는 차례(없으면 번호 차례)
 * @returns {number[]} 끊는 줄들(작은 번호부터)
 */
export function wayOf(board, order = board.strings.map((_, index) => index)) {
  const n = board.knots.length;
  const parent = Array.from({ length: n }, (_, index) => index);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const cut = [];
  for (const index of order) {
    const [a, b] = board.strings[index];
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) cut.push(index);
    else parent[ra] = rb;
  }
  return cut.sort((a, b) => a - b);
}

/** 처음 조각(그물)마다의 매듭 수, 줄 수, 끊을 수 있는 줄 수. 왼쪽에 놓인 그물부터 */
export function netsOf(board) {
  const { count, label } = piecesOf(board.knots.length, board.strings);
  const nets = Array.from({ length: count }, (_, piece) => ({ piece, knots: 0, strings: 0, left: Infinity }));
  label.forEach((piece, knot) => {
    nets[piece].knots += 1;
    nets[piece].left = Math.min(nets[piece].left, board.knots[knot][0]);
  });
  for (const [a] of board.strings) nets[label[a]].strings += 1;
  return nets
    .map((net) => ({ ...net, max: net.strings - net.knots + 1 }))
    .sort((p, q) => p.left - q.left || p.piece - q.piece)
    .map(({ piece, knots, strings, max }) => ({ piece, knots, strings, max }));
}

/** 끊은 줄들 가운데 처음 조각(그물)마다 몇 줄인가. netsOf의 차례로 */
export function cutPerNet(board, cut) {
  const { label } = piecesOf(board.knots.length, board.strings);
  return netsOf(board).map((net) => cut.filter((index) => label[board.strings[index][0]] === net.piece).length);
}

/**
 * 풀이: 가장 많이 끊을 수 있는 줄의 수(max), 매듭 수, 줄 수, 처음 조각 수, 그물마다의 수, 끊는 방법 둘(서로 다르면).
 * possible은 늘 참이다(어떤 차례로 끊어도 끝에는 더 끊을 줄이 없는 모습이 된다).
 */
export function solve(board) {
  const order = board.strings.map((_, index) => index);
  const first = wayOf(board, order);
  const second = wayOf(board, order.slice().reverse());
  const ways = first.join(',') === second.join(',') ? [first] : [first, second];
  return { possible: true, max: maxCut(board), knots: board.knots.length, strings: board.strings.length, pieces: piecesOf(board.knots.length, board.strings).count, nets: netsOf(board), ways };
}

/**
 * 누른 자리에서 가장 가까운 줄(REACH 안). 없으면 null. 거리가 같으면 앞 번호의 줄.
 * @param {object} board
 * @param {number[]} spot 칸 단위의 자리 [x, y]
 */
export function stringAt(board, spot, reach = REACH) {
  let best = null;
  let distance = reach;
  board.strings.forEach(([a, b], index) => {
    const far = segmentDistance(spot, board.knots[a], board.knots[b]);
    if (far < distance || (far === distance && best === null)) {
      best = index;
      distance = far;
    }
  });
  return best;
}

/** 판이 차지하는 자리(칸 단위) */
export function boundsOf(board) {
  const xs = board.knots.map((knot) => knot[0]);
  const ys = board.knots.map((knot) => knot[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** 두 줄이 서로 엇갈리는가(끝을 함께 쓰지 않는 두 줄이 가운데에서 만난다) */
export function crosses(board, i, j) {
  const [a, b] = board.strings[i];
  const [c, d] = board.strings[j];
  if (a === c || a === d || b === c || b === d) return false;
  const [p, q, r, s] = [board.knots[a], board.knots[b], board.knots[c], board.knots[d]];
  const side = (o, u, v) => Math.sign((u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]));
  return side(p, q, r) * side(p, q, s) < 0 && side(r, s, p) * side(r, s, q) < 0;
}

export const boardKey = (board) => `${board.knots.map((knot) => knot.join(',')).join(';')}|${board.strings.map((string) => string.join('-')).join(';')}`;
export const sameBoard = (a, b) => boardKey(a) === boardKey(b);
export const copyBoard = (board) => ({ knots: board.knots.map((knot) => [knot[0], knot[1]]), strings: board.strings.map((string) => [string[0], string[1]]), family: board.family ?? 'made' });
