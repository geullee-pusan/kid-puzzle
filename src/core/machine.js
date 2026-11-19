// 규칙 기계와 규칙이 깨지는 판의 판과 풀이. 순수 함수만 둔다.
// 기계는 수를 받아 정해진 일을 차례로 하고 나온 수를 다음 칸에 적는다. 줄은 그렇게 이어진 칸들이다.
//
// 기계(machine):
//   { kind: 'one', steps: [블록, …] }  수 하나를 받아 블록을 차례로 한다
//   { kind: 'pair' }                  앞의 두 수 가운데 큰 수에서 작은 수를 뺀다(줄의 처음 두 칸을 받는다)
// 블록(step): { op, k? }
//   rev    자리를 뒤집는다(0으로 시작하면 그 0은 읽지 않는다: 120 → 21)
//   add    k를 더한다(k는 1~99)
//   mul    k를 곱한다(k는 2~9)
//   dsum   자리 숫자를 모두 더한다
//   dsq    자리 숫자마다 같은 숫자를 곱해서 모두 더한다(23 → 2×2 + 3×3 = 13)
//   dprod  자리 숫자를 모두 곱한다
//   last2  끝의 두 자리만 남긴다
//   addrev 뒤집은 수를 더한다(23 → 23 + 32 = 55)
//
// 판의 종류(kind):
//   fill    규칙과 처음 칸을 보고 다음 칸들을 채운다          { kind, machine, start, count }
//   back    나온 수를 보고 넣은 수를 모두 찾는다(없을 수도)    { kind, machine, target, limit }
//   box     숨은 규칙의 기계에 수를 넣어 보고 나올 수를 맞힌다 { kind, machine, shown, asks, limit }
//   far     줄을 앞에서 몇 칸만 돌려 보고 먼 칸의 수를 맞힌다  { kind, machine, start, target, cap }
//   record  처음 칸을 골라 계속 작아지기만 하는 줄을 길게      { kind, machine, limit }
//   circle  원 위의 점을 모두 이은 그림의 조각을 센다          { kind, counts, guess }
//   prime   수를 넣는 차림표가 약수가 둘뿐인 수를 언제까지 낼까 { kind, add, upTo }

export const KINDS = ['fill', 'back', 'box', 'far', 'record', 'circle', 'prime'];
export const OPS = ['rev', 'add', 'mul', 'dsum', 'dsq', 'dprod', 'last2', 'addrev'];
/** k를 쓰는 블록과 k의 범위 */
export const K_RANGE = { add: [1, 99], mul: [2, 9] };
/** 기계 하나의 블록 수 */
export const MAX_STEPS = 3;
/** 이보다 큰 수가 나오면 기계를 멈춘다(직접 만들기에서 수가 끝없이 커질 때) */
export const VALUE_CAP = 1e9;
/** 직접 만들기와 먼 칸 맞히기에서 선생님이 되풀이를 찾으려고 돌려 보는 칸 수의 위 끝 */
export const SEARCH_CELLS = 400;
/** 줄의 처음 칸에 넣을 수 있는 수의 위 끝 */
export const START_MAX = 9999;

const isInt = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;

/** 자리 숫자들 */
export const digitsOf = (n) => String(n).split('').map(Number);

/** 수를 뒤집는다(0으로 시작하면 그 0은 읽지 않는다) */
export const reverseOf = (n) => Number(String(n).split('').reverse().join(''));

/** 블록 하나를 한다 */
export function applyStep(step, n) {
  switch (step.op) {
    case 'rev':
      return reverseOf(n);
    case 'add':
      return n + step.k;
    case 'mul':
      return n * step.k;
    case 'dsum':
      return digitsOf(n).reduce((total, digit) => total + digit, 0);
    case 'dsq':
      return digitsOf(n).reduce((total, digit) => total + digit * digit, 0);
    case 'dprod':
      return digitsOf(n).reduce((total, digit) => total * digit, 1);
    case 'last2':
      return n % 100;
    case 'addrev':
      return n + reverseOf(n);
    default:
      throw new Error(`없는 블록이에요: ${step.op}`);
  }
}

/** 수 하나를 받는 기계: 블록마다 한 뒤의 수들(넣은 수부터). 기계 안 보기와 "어디서 멈췄나"에 쓴다 */
export function traceOf(machine, n) {
  const values = [n];
  for (const step of machine.steps) values.push(applyStep(step, values.at(-1)));
  return values;
}

/** 수 하나를 받는 기계가 내놓는 수 */
export const applyMachine = (machine, n) => traceOf(machine, n).at(-1);

/** 줄의 다음 칸(앞의 칸들을 보고) */
export function nextCell(machine, cells) {
  if (machine.kind === 'pair') return Math.abs(cells.at(-2) - cells.at(-1));
  return applyMachine(machine, cells.at(-1));
}

/** 처음 칸이 몇 개인가: 두 수 기계는 둘, 나머지는 하나 */
export const startSize = (machine) => (machine.kind === 'pair' ? 2 : 1);

/**
 * 줄의 처음 count칸. 수가 VALUE_CAP을 넘으면 거기서 멈춘다(그 칸까지만 돌려준다).
 * @returns {number[]}
 */
export function runRow(machine, start, count) {
  const cells = start.slice(0, count);
  while (cells.length < count) {
    const next = nextCell(machine, cells);
    if (!(next <= VALUE_CAP)) break;
    cells.push(next);
  }
  return cells;
}

/**
 * 줄이 되풀이되는 곳: 칸 번호(0부터) mu부터 lambda칸마다 같은 수가 되풀이된다(가장 작은 mu와 lambda).
 * 두 수 기계는 이어진 두 칸이 같은 곳을 찾는다(다음 칸은 앞의 두 칸으로 정해지므로). 수 하나 기계는 같은 수가 다시 나온 곳이다.
 * limit칸 안에서 못 찾거나 수가 너무 커지면 null.
 * @returns {{ mu: number, lambda: number } | null}
 */
export function cycleOf(machine, start, limit = SEARCH_CELLS) {
  const size = startSize(machine);
  const cells = start.slice();
  const seen = new Map();
  const keyAt = (at) => (size === 2 ? `${cells[at]},${cells[at + 1]}` : String(cells[at]));
  for (let at = 0; at < limit; at++) {
    while (cells.length < at + size) {
      const next = nextCell(machine, cells);
      if (!(next <= VALUE_CAP)) return null;
      cells.push(next);
    }
    const key = keyAt(at);
    if (seen.has(key)) return { mu: seen.get(key), lambda: at - seen.get(key) };
    seen.set(key, at);
  }
  return null;
}

/**
 * n번째 칸(1부터 센다)의 수. 되풀이를 써서 아무리 먼 칸도 바로 구한다. 되풀이를 못 찾으면 직접 돌린다.
 */
export function cellAt(machine, start, n) {
  const cycle = cycleOf(machine, start);
  if (!cycle || n - 1 < cycle.mu + cycle.lambda) {
    const row = runRow(machine, start, n);
    return row.length === n ? row[n - 1] : null;
  }
  const at = cycle.mu + ((n - 1 - cycle.mu) % cycle.lambda);
  return runRow(machine, start, at + 1)[at];
}

/** 수 하나를 받는 기계에 low~high를 넣어 target이 나오는 수들 */
export function preimagesOf(machine, target, low = 1, high = 99) {
  const list = [];
  for (let n = low; n <= high; n++) if (applyMachine(machine, n) === target) list.push(n);
  return list;
}

// ---- 계속 작아지기만 하는 줄 ----

/** 처음 칸부터 계속 작아지기만 하는 칸의 수(처음 칸도 센다). 같거나 커지는 칸이 나오면 거기서 멈춘다 */
export function fallingLength(machine, start, limit = 60) {
  const row = runRow(machine, start, limit);
  let length = 1;
  while (length < row.length && row[length] < row[length - 1]) length += 1;
  return length;
}

/** 처음 칸으로 고를 수 있는 모든 것(두 수 기계는 두 수의 짝) */
export function startsUpTo(machine, limit) {
  const list = [];
  if (machine.kind === 'pair') {
    for (let a = 1; a <= limit; a++) for (let b = 1; b <= limit; b++) list.push([a, b]);
  } else for (let a = 1; a <= limit; a++) list.push([a]);
  return list;
}

/** 계속 작아지기만 하는 줄의 가장 긴 것: 그 길이와, 그 길이가 되는 처음 칸들 */
export function fallingBest(machine, limit) {
  let best = 0;
  let starts = [];
  for (const start of startsUpTo(machine, limit)) {
    const length = fallingLength(machine, start);
    if (length > best) {
      best = length;
      starts = [start];
    } else if (length === best) starts.push(start);
  }
  return { best, starts };
}

// ---- 원 위의 점을 모두 이은 그림 ----

/**
 * 점의 수마다 원 위의 자리(도. 0도는 오른쪽, 시계 반대 방향). 세 선이 한 곳에서 만나지 않고 가장 작은 조각도 너무 작지 않게 골랐다
 * (여러 자리를 시험해 가장 작은 조각이 가장 큰 것을 골랐다. 정육각형처럼 고르게 놓으면 세 대각선이 가운데서 만나 조각이 30개가 된다).
 */
export const CIRCLE_ANGLES = {
  1: [90],
  2: [30, 190],
  3: [39, 159, 279],
  4: [10, 102, 190, 282],
  5: [16, 87, 163, 234, 304],
  6: [9, 61, 133, 187, 256, 307],
  7: [-12, 41, 96, 156, 210, 252, 296],
};
export const CIRCLE_MAX = 7;
/** 원을 그릴 때 쓰는 꼭짓점 수(원 둘레를 이 수의 변으로 나눈다) */
const CIRCLE_SIDES = 144;

const toPoint = (deg) => [Math.cos((deg * Math.PI) / 180), -Math.sin((deg * Math.PI) / 180)];

/** 점의 자리(반지름 1인 원, 가운데가 0, 화면처럼 아래가 + 방향) */
export const circlePoints = (count) => CIRCLE_ANGLES[count].map(toPoint);

/** 모든 점을 이은 선(점의 번호 짝) */
export function chordsOf(count) {
  const list = [];
  for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) list.push([a, b]);
  return list;
}

const sideOf = (p, a, b) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const areaOf = (poly) => Math.abs(poly.reduce((total, p, at) => total + p[0] * poly[(at + 1) % poly.length][1] - poly[(at + 1) % poly.length][0] * p[1], 0)) / 2;

/** 볼록한 다각형을 직선 a-b로 둘로 자른다(직선 위의 꼭짓점은 두 쪽에 모두 넣는다) */
function splitPolygon(poly, a, b) {
  const eps = 1e-9;
  const left = [];
  const right = [];
  poly.forEach((p, at) => {
    const q = poly[(at + 1) % poly.length];
    const sp = sideOf(p, a, b);
    const sq = sideOf(q, a, b);
    if (sp >= -eps) left.push(p);
    if (sp <= eps) right.push(p);
    if ((sp > eps && sq < -eps) || (sp < -eps && sq > eps)) {
      const t = sp / (sp - sq);
      const cut = [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
      left.push(cut);
      right.push(cut);
    }
  });
  return [left, right];
}

/**
 * 조각들. 원(둘레를 잘게 나눈 다각형, 점의 자리도 꼭짓점으로 넣는다)을 선마다 잘라 간다.
 * 선은 원 안에서 원을 가로지르므로 자를 때 선을 끝없이 늘여도 같다. 조각은 모두 볼록하다.
 * key: 선마다 어느 쪽인가(+와 −). 같은 그림에서는 늘 같다(아이가 표시한 조각을 이것으로 적는다).
 * @returns {Array<{ key: string, path: number[][], center: number[], area: number }>}
 */
export function circleRegions(count) {
  const points = circlePoints(count);
  const angles = new Set();
  for (let at = 0; at < CIRCLE_SIDES; at++) angles.add(Number(((at * 360) / CIRCLE_SIDES).toFixed(6)));
  for (const deg of CIRCLE_ANGLES[count]) angles.add(Number((((deg % 360) + 360) % 360).toFixed(6)));
  let polys = [[...angles].sort((a, b) => a - b).map(toPoint)];
  const chords = chordsOf(count);
  for (const [a, b] of chords) {
    const next = [];
    for (const poly of polys) for (const part of splitPolygon(poly, points[a], points[b])) if (part.length >= 3 && areaOf(part) > 1e-7) next.push(part);
    polys = next;
  }
  const regions = polys.map((path) => {
    const center = [path.reduce((total, p) => total + p[0], 0) / path.length, path.reduce((total, p) => total + p[1], 0) / path.length];
    const key = chords.map(([a, b]) => (sideOf(center, points[a], points[b]) > 0 ? '+' : '-')).join('');
    return { key, path, center, area: areaOf(path) };
  });
  // 차례는 key로 정한다(같은 그림이면 늘 같은 차례)
  return regions.sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
}

/** 두 선이 원 안에서 엇갈리는가(두 선의 끝점이 원 둘레에서 번갈아 놓인다) */
export function chordsCross(count, [a, b], [c, d]) {
  if (new Set([a, b, c, d]).size < 4) return false;
  const inside = (x) => x > Math.min(a, b) && x < Math.max(a, b);
  // 점의 번호는 원 둘레를 도는 차례와 같다(CIRCLE_ANGLES는 작은 각부터)
  return inside(c) !== inside(d);
}

/** 선 하나(점 번호의 짝)가 다른 선과 엇갈리는 곳들(원 안의 자리) */
export function crossingsOn(count, chord) {
  const points = circlePoints(count);
  const [p, q] = [points[chord[0]], points[chord[1]]];
  const list = [];
  for (const other of chordsOf(count)) {
    if (!chordsCross(count, chord, other)) continue;
    const [r, s] = [points[other[0]], points[other[1]]];
    const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
    const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d;
    list.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
  }
  return list;
}

/** 조각의 수를 세는 다른 방법: 1 + 선의 수 + 엇갈린 곳의 수(세 선이 한 곳에서 만나지 않을 때) */
export const circleCountByLines = (count) => 1 + (count * (count - 1)) / 2 + (count * (count - 1) * (count - 2) * (count - 3)) / 24;

// ---- 약수가 둘뿐인 수를 내는 차림표 ----

/** 차림표: 수에 그 수를 곱하고, 그 수를 더하고, add를 더한다 */
export const recipeOf = (add, n) => n * n + n + add;

/** 1이 아닌 가장 작은 약수와 짝(약수가 1과 자기 자신 둘뿐이면 null) */
export function factorPair(m) {
  if (m < 4) return null;
  for (let d = 2; d * d <= m; d++) if (m % d === 0) return [d, m / d];
  return null;
}

/** 약수가 1과 자기 자신 둘뿐인가 */
export const twoDivisors = (m) => m >= 2 && factorPair(m) === null;

/** 0부터 넣어 갈 때 처음으로 약수가 둘뿐이 아닌 수가 나오는 넣은 수 */
export function firstBreak(add) {
  for (let n = 0; n < 10000; n++) if (!twoDivisors(recipeOf(add, n))) return n;
  return null;
}

// ---- 판 ----

/** 쓸 수 있는 기계인가. 아니면 까닭(글자) */
export function checkMachine(machine) {
  if (!machine || typeof machine !== 'object') return '기계가 없어요';
  if (machine.kind === 'pair') return Object.keys(machine).length === 1 ? null : '두 수 기계에는 블록이 없어요';
  if (machine.kind !== 'one' || !Array.isArray(machine.steps) || !isInt(machine.steps.length, 1, MAX_STEPS)) return '블록의 수가 맞지 않아요';
  for (const step of machine.steps) {
    if (!step || !OPS.includes(step.op)) return '없는 블록이에요';
    const range = K_RANGE[step.op];
    if (range ? !isInt(step.k, range[0], range[1]) : step.k !== undefined) return '블록의 수가 맞지 않아요';
  }
  return null;
}

const okStart = (machine, start) => Array.isArray(start) && start.length === startSize(machine) && start.every((value) => isInt(value, 0, START_MAX));

/** 쓸 수 있는 판인가. 아니면 까닭(글자) */
export function checkBoard(board) {
  if (!board || typeof board !== 'object' || !KINDS.includes(board.kind)) return '판의 종류가 없어요';
  if (board.kind === 'circle') {
    const { counts, guess } = board;
    if (!Array.isArray(counts) || !isInt(counts.length, 1, 3) || !counts.every((count, at) => isInt(count, 2, CIRCLE_MAX - 1) && (at === 0 || counts[at - 1] + 1 === count))) return '점의 수가 맞지 않아요';
    return guess === counts.at(-1) + 1 && guess <= CIRCLE_MAX - 1 ? null : '짐작할 점의 수가 맞지 않아요';
  }
  if (board.kind === 'prime') {
    if (!isInt(board.add, 2, 99) || !isInt(board.upTo, 1, 60)) return '차림표가 맞지 않아요';
    return firstBreak(board.add) === board.upTo ? null : '컴퓨터가 넣어 볼 끝이 깨지는 곳과 달라요';
  }
  const problem = checkMachine(board.machine);
  if (problem) return problem;
  const { machine } = board;
  if (board.kind === 'fill') {
    if (!okStart(machine, board.start) || !isInt(board.count, 1, 8)) return '처음 칸이나 칸 수가 맞지 않아요';
    return runRow(machine, board.start, board.start.length + board.count).length === board.start.length + board.count ? null : '수가 너무 커져요';
  }
  if (board.kind === 'far') {
    if (!okStart(machine, board.start) || !isInt(board.cap, 6, 40) || !isInt(board.target, board.cap + 1, 1000)) return '처음 칸이나 칸 번호가 맞지 않아요';
    const cycle = cycleOf(machine, board.start);
    // 돌려 볼 수 있는 칸 안에서 되풀이가 한 번 다 보여야 한다
    return cycle && cycle.mu + cycle.lambda + 1 <= board.cap ? null : '돌려 볼 수 있는 칸 안에서 되풀이가 보이지 않아요';
  }
  if (board.kind === 'record') return isInt(board.limit, 5, 999) && (machine.kind === 'pair' || board.limit <= 999) ? null : '고를 수 있는 수의 끝이 맞지 않아요';
  if (machine.kind !== 'one') return '수 하나를 받는 기계예요';
  if (!isInt(board.limit, 5, 999)) return '넣을 수 있는 수의 끝이 맞지 않아요';
  if (board.kind === 'back') return isInt(board.target, 0, VALUE_CAP) ? null : '나온 수가 맞지 않아요';
  // box
  const { shown, asks } = board;
  if (!Array.isArray(shown) || !Array.isArray(asks) || !isInt(asks.length, 1, 4) || !isInt(shown.length, 1, 4)) return '보기나 맞힐 수가 맞지 않아요';
  const all = [...shown, ...asks];
  if (!all.every((n) => isInt(n, 1, board.limit)) || new Set(all).size !== all.length) return '보기와 맞힐 수가 겹치거나 범위 밖이에요';
  return null;
}

/** 판의 답 */
export function solve(board) {
  const { kind } = board;
  if (kind === 'circle') {
    const table = {};
    for (let count = 1; count <= board.guess; count++) table[count] = circleRegions(count).length;
    return { possible: true, kind, table, answer: table[board.guess] };
  }
  if (kind === 'prime') {
    const at = board.upTo;
    return { possible: true, kind, first: at, value: recipeOf(board.add, at), pair: factorPair(recipeOf(board.add, at)) };
  }
  const { machine } = board;
  if (kind === 'fill') return { possible: true, kind, cells: runRow(machine, board.start, board.start.length + board.count) };
  if (kind === 'back') {
    const answers = preimagesOf(machine, board.target, 1, board.limit);
    return { possible: true, kind, answers };
  }
  if (kind === 'box') return { possible: true, kind, outputs: board.asks.map((n) => applyMachine(machine, n)) };
  if (kind === 'far') {
    const cycle = cycleOf(machine, board.start);
    return { possible: true, kind, value: cellAt(machine, board.start, board.target), mu: cycle.mu, lambda: cycle.lambda, row: runRow(machine, board.start, board.cap) };
  }
  const best = fallingBest(machine, board.limit);
  return { possible: true, kind, best: best.best, starts: best.starts };
}

export const copyBoard = (board) => JSON.parse(JSON.stringify(board));

/** "왜 그럴까?"의 이야기 묶음: 되풀이(채우기, 거꾸로, 상자, 먼 칸), 작아지는 줄, 깨지는 판(원, 차림표) */
export const familyOf = (kind) => (kind === 'record' ? 'record' : kind === 'circle' || kind === 'prime' ? 'break' : 'repeat');

/** "왜 그럴까?"가 열렸는가: 같은 묶음의 판을 한 번 끝까지 했다(맞혔거나 풀이를 보았다) */
export function whyOpen(records, family) {
  return records.some((record) => record.kind === 'round' && record.format === 'machine' && (record.outcome === 'solved' || record.outcome === 'solution') && familyOf(record.mode) === family);
}
