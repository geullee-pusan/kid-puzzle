// 눈대중의 판과 풀이. 순수 함수만 둔다.
// 판의 종류(kind):
//   area   모눈 위의 얼룩이 몇 칸쯤인지 어림한다. 칸의 한가운데가 얼룩 안에 있는 칸을 얼룩의 칸으로 센다
//   cover  같은 얼룩의 칸(점이 찍힌 칸)을 직사각형 k개까지로 모두 덮는다. 얼룩이 아닌 칸을 덮은 수(더 덮은 칸)가 적을수록 가깝다
//   line   수직선 위에서 수가 있을 자리를 눈으로 찍고 진짜 자리와 견준다
//   side   수마다 가까운 몇십이나 몇백으로 바꿔 어림한 값이 실제 값보다 큰지, 작은지, 알 수 없는지 가린다
//
// 얼룩: 둥근 덩어리(원) 몇 개를 합친 것이다. 원은 [x, y, r]로 적는다. 가운데 (x, y)는 칸의 꼭짓점(격자점, 칸 단위의 정수)이고
// 반지름 r은 반 칸 단위의 정수다. 칸 (cx, cy)의 한가운데는 반 칸 단위로 (2cx + 1, 2cy + 1)이다.
// 그래서 한가운데와 원의 가운데 사이의 거리의 제곱(반 칸 단위)은 홀수의 제곱 둘의 합이라 8로 나눈 나머지가 2이고,
// 어떤 제곱수(r²)도 8로 나눈 나머지가 2가 아니므로 칸의 한가운데가 원의 둘레에 꼭 놓이는 일이 없다. 안인지 밖인지가 늘 또렷하다.
//
// 덮기의 가장 좋은 답(더 덮은 칸이 가장 적은 덮기)은 모두 따져서 구한다:
//   - 덮기에 쓴 직사각형은 그 안의 얼룩 칸을 꼭 감싸는 직사각형(얼룩 칸의 위아래 왼쪽 오른쪽 끝에 맞춘 것)으로 줄여도 된다(덮는 칸은 그대로, 더 덮은 칸은 늘지 않는다).
//   - 아직 덮이지 않은 얼룩 칸 가운데 맨 위 왼쪽 칸은 어느 직사각형엔가 들어야 하므로, 그 칸을 품은 꼭 감싸는 직사각형을 하나씩 놓아 본다.
//   - 마지막 하나는 남은 얼룩 칸을 꼭 감싸는 직사각형 하나로 정해진다.
// 수직선: { from, to, step, ticks, targets }. 찍은 자리는 step의 배수(from에서 센)로 맞춘다.
// 어림: { op: '+' | '-' | '×', items: [{ n, unit, hide }] }. n은 수(hide가 참이면 일의 자리를 가린 수. 일의 자리는 0으로 적는다),
//   unit은 어림하는 자리(1이면 어림하지 않는다, 10이면 가까운 몇십, 100이면 가까운 몇백). 가린 수는 n부터 n + 9까지 무엇이든 될 수 있다.

export const MIN_W = 4;
export const MAX_W = 10;
export const MIN_H = 3;
export const MAX_H = 8;
/** 얼룩 하나의 둥근 덩어리 수의 위 끝 */
export const MAX_CIRCLES = 8;
/** 둥근 덩어리의 반지름(반 칸 단위)의 위 끝 */
export const MAX_RADIUS = 12;
/** 직사각형 수 */
export const RECT_COUNTS = [1, 2, 3];
export const KINDS = ['area', 'cover', 'line', 'side'];
export const OPS = ['+', '-', '×'];
const UNITS = [1, 10, 100];

const isInt = (value) => Number.isInteger(value);
const POP = Array.from({ length: 1 << 12 }, (_, mask) => {
  let count = 0;
  for (let m = mask; m; m &= m - 1) count += 1;
  return count;
});

// ---- 얼룩 ----

/** 칸 (cx, cy)의 한가운데가 원 [x, y, r] 안에 있는가(정수로만 견준다) */
export function insideCircle([x, y, r], cx, cy) {
  const dx = 2 * cx + 1 - 2 * x;
  const dy = 2 * cy + 1 - 2 * y;
  return dx * dx + dy * dy < r * r;
}

/** 얼룩의 칸: 한가운데가 어느 원 안에든 있는 칸의 번호(작은 것부터) */
export function blobCells(board) {
  const cells = [];
  for (let cy = 0; cy < board.h; cy++) {
    for (let cx = 0; cx < board.w; cx++) {
      if (board.circles.some((circle) => insideCircle(circle, cx, cy))) cells.push(cy * board.w + cx);
    }
  }
  return cells;
}

/** 얼룩 판이 쓸 수 있는 값인가. 쓸 수 있으면 null. open이 참이면 원이 없거나 얼룩 칸이 없어도 된다(만드는 중인 판) */
export function checkBlob(board, { open = false } = {}) {
  const { w, h, circles } = board;
  if (!isInt(w) || !isInt(h) || w < MIN_W || w > MAX_W || h < MIN_H || h > MAX_H) return '크기가 맞지 않아요';
  if (!Array.isArray(circles) || circles.length > MAX_CIRCLES) return '둥근 덩어리가 맞지 않아요';
  for (const circle of circles) {
    if (!Array.isArray(circle) || circle.length !== 3 || !circle.every(isInt)) return '둥근 덩어리가 맞지 않아요';
    const [x, y, r] = circle;
    if (x < 0 || x > w || y < 0 || y > h || r < 1 || r > MAX_RADIUS) return '둥근 덩어리가 판 밖이에요';
  }
  if (!open && blobCells(board).length === 0) return '얼룩의 칸이 없어요';
  if (board.kind === 'cover' && !RECT_COUNTS.includes(board.k)) return '직사각형 수가 맞지 않아요';
  return null;
}

// ---- 직사각형과 덮기 ----

/** 두 칸을 맞은편 구석으로 하는 직사각형 { x, y, w, h } */
export function rectBetween(board, a, b) {
  const [ax, ay, bx, by] = [a % board.w, Math.floor(a / board.w), b % board.w, Math.floor(b / board.w)];
  const x = Math.min(ax, bx);
  const y = Math.min(ay, by);
  return { x, y, w: Math.abs(ax - bx) + 1, h: Math.abs(ay - by) + 1 };
}

export const rectOk = (board, rect) =>
  Boolean(rect) && [rect.x, rect.y, rect.w, rect.h].every(isInt) && rect.x >= 0 && rect.y >= 0 && rect.w >= 1 && rect.h >= 1 && rect.x + rect.w <= board.w && rect.y + rect.h <= board.h;

export const rectHas = (board, rect, cell) => {
  const cx = cell % board.w;
  const cy = Math.floor(cell / board.w);
  return cx >= rect.x && cx < rect.x + rect.w && cy >= rect.y && cy < rect.y + rect.h;
};

const rectKey = (rect) => `${rect.x},${rect.y},${rect.w},${rect.h}`;
/** 덮기 하나의 이름(직사각형의 차례와 겹친 것은 따지지 않는다) */
export const coverKey = (rects) => [...new Set(rects.map(rectKey))].sort().join(';');

/** 줄마다의 비트(칸 x가 들었으면 x번째 비트) */
function masksOf(board, cells) {
  const masks = new Array(board.h).fill(0);
  for (const cell of cells) masks[Math.floor(cell / board.w)] |= 1 << cell % board.w;
  return masks;
}
const span = (x, w) => ((1 << w) - 1) << x;
const countOf = (masks) => masks.reduce((sum, mask) => sum + POP[mask], 0);

/** 덮은 모습: 덮은 칸 수(size), 덮지 않은 얼룩 칸 수(missing), 얼룩이 아닌데 덮은 칸 수(extra), 덮은 칸들(covered) */
export function coverOf(board, rects, cells = blobCells(board)) {
  const union = new Array(board.h).fill(0);
  for (const rect of rects) for (let y = rect.y; y < rect.y + rect.h; y++) union[y] |= span(rect.x, rect.w);
  const blob = masksOf(board, cells);
  let missing = 0;
  let extra = 0;
  const covered = [];
  for (let y = 0; y < board.h; y++) {
    missing += POP[blob[y] & ~union[y]];
    extra += POP[union[y] & ~blob[y]];
    for (let x = 0; x < board.w; x++) if (union[y] & (1 << x)) covered.push(y * board.w + x);
  }
  return { size: countOf(union), missing, extra, covered };
}

/** 얼룩 칸을 꼭 감싸는 직사각형들: 그 안의 얼룩 칸의 위, 아래, 왼쪽, 오른쪽 끝이 직사각형의 네 변에 닿는 것 */
export function tightRects(board, cells = blobCells(board)) {
  const blob = masksOf(board, cells);
  const list = [];
  for (let y0 = 0; y0 < board.h; y0++) {
    for (let y1 = y0; y1 < board.h; y1++) {
      for (let x0 = 0; x0 < board.w; x0++) {
        for (let x1 = x0; x1 < board.w; x1++) {
          const band = span(x0, x1 - x0 + 1);
          if (!(blob[y0] & band) || !(blob[y1] & band)) continue;
          let all = 0;
          for (let y = y0; y <= y1; y++) all |= blob[y] & band;
          if (all & (1 << x0) && all & (1 << x1)) list.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
        }
      }
    }
  }
  return list;
}

/** 칸들을 꼭 감싸는 직사각형 */
function boxOf(board, cells) {
  const xs = cells.map((cell) => cell % board.w);
  const ys = cells.map((cell) => Math.floor(cell / board.w));
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 };
}

/**
 * 직사각형 k개까지로 얼룩 칸을 모두 덮을 때, 더 덮은 칸(얼룩이 아닌 칸)이 가장 적은 덮기.
 * @returns {{ extra: number, size: number, rects: object[], nodes: number }} nodes는 따져 본 갈래 수(개발용)
 */
export function bestCover(board, k, cells = blobCells(board)) {
  if (cells.length === 0) return { extra: 0, size: 0, rects: [], nodes: 0 };
  const blob = masksOf(board, cells);
  const total = cells.length;
  // 칸마다 그 칸을 품은 꼭 감싸는 직사각형(큰 것부터)
  const tight = tightRects(board, cells).sort((a, b) => b.w * b.h - a.w * a.h || a.y - b.y || a.x - b.x);
  const holding = new Map(cells.map((cell) => [cell, tight.filter((rect) => rectHas(board, rect, cell))]));
  let best = { size: Infinity, rects: [] };
  let nodes = 0;
  const add = (union, rect) => union.map((mask, y) => (y >= rect.y && y < rect.y + rect.h ? mask | span(rect.x, rect.w) : mask));
  function go(union, rects, left) {
    nodes += 1;
    const size = countOf(union);
    const open = [];
    for (let y = 0; y < board.h; y++) {
      const rest = blob[y] & ~union[y];
      for (let x = 0; x < board.w; x++) if (rest & (1 << x)) open.push(y * board.w + x);
    }
    if (open.length === 0) {
      if (size < best.size) best = { size, rects: rects.slice() };
      return;
    }
    // 남은 얼룩 칸은 모두 새로 덮어야 하므로 덮은 칸은 적어도 그만큼 는다
    if (left === 0 || size + open.length >= best.size) return;
    if (left === 1) {
      const last = boxOf(board, open);
      const next = add(union, last);
      const after = countOf(next);
      if (after < best.size) best = { size: after, rects: [...rects, last] };
      return;
    }
    for (const rect of holding.get(open[0])) {
      const next = add(union, rect);
      if (countOf(next) >= best.size) continue;
      go(next, [...rects, rect], left - 1);
    }
  }
  go(new Array(board.h).fill(0), [], k);
  return { extra: best.size - total, size: best.size, rects: best.rects, nodes };
}

// ---- 수직선 ----

/** 수직선 판이 쓸 수 있는 값인가 */
export function checkLine(board) {
  const { from, to, step, ticks, targets } = board;
  if (![from, to, step].every(isInt) || from < 0 || to <= from || step < 1 || (to - from) % step !== 0) return '선의 수가 맞지 않아요';
  if ((to - from) / step > 1000) return '눈금이 너무 잘아요';
  if (!Array.isArray(ticks) || !ticks.every((value) => isInt(value) && value > from && value < to)) return '눈금이 맞지 않아요';
  if (!Array.isArray(targets) || targets.length < 1 || targets.length > 3) return '찍을 수가 맞지 않아요';
  if (!targets.every((value) => isInt(value) && value > from && value < to && (value - from) % step === 0)) return '찍을 수가 선 밖이에요';
  if (new Set(targets).size !== targets.length) return '같은 수를 두 번 찍지 않아요';
  return null;
}

/** 수가 선의 어디쯤인가(왼쪽 끝 0, 오른쪽 끝 1) */
export const fracOf = (board, value) => (value - board.from) / (board.to - board.from);

/** 선 위의 자리(0~1)를 가장 가까운 수(from에서 step씩)로 맞춘다 */
export function snapValue(board, frac) {
  const steps = (board.to - board.from) / board.step;
  const at = Math.round(Math.min(1, Math.max(0, frac)) * steps);
  return board.from + at * board.step;
}

/** 열어 보인 뒤의 눈금: 선을 열 칸으로 나눈 자리의 수(끝 포함) */
export const revealTicks = (board) => Array.from({ length: 11 }, (_, index) => board.from + ((board.to - board.from) * index) / 10);

// ---- 어림 ----

/** 가까운 몇십, 몇백(반이면 올린다) */
export const roundTo = (value, unit) => Math.floor(value / unit + 0.5) * unit;

/** 수 하나가 될 수 있는 값의 범위 */
export const rangeOf = (item) => (item.hide ? [item.n, item.n + 9] : [item.n, item.n]);
/** 수 하나를 어림한 값 */
export const estOf = (item) => roundTo(item.n + (item.hide ? 5 : 0), item.unit);

/** 두 수(또는 세 수)로 셈하기 */
export function combine(op, values) {
  if (op === '+') return values.reduce((sum, value) => sum + value, 0);
  if (op === '-') return values[0] - values[1];
  return values[0] * values[1];
}

/** 화면에 보일 수(가린 일의 자리는 □) */
export const shownOf = (item) => (item.hide ? `${String(item.n).slice(0, -1)}□` : String(item.n));

/** 어림 판이 쓸 수 있는 값인가 */
export function checkSide(board) {
  const { op, items } = board;
  if (!OPS.includes(op) || !Array.isArray(items)) return '셈이 맞지 않아요';
  if (op === '+' ? items.length < 2 || items.length > 3 : items.length !== 2) return '수의 개수가 맞지 않아요';
  for (const item of items) {
    if (!item || !isInt(item.n) || item.n < 1 || item.n > 9999 || !UNITS.includes(item.unit) || typeof item.hide !== 'boolean') return '수가 맞지 않아요';
    if (item.hide && (op === '×' || item.n % 10 !== 0 || item.n < 100)) return '가린 수가 맞지 않아요';
    const [lo, hi] = rangeOf(item);
    const est = estOf(item);
    // 가린 수는 어떤 숫자가 들어가도 같은 수로 어림되고, 어림한 수가 그 범위 밖에 있어야 한다(올렸는지 내렸는지가 정해진다)
    for (let value = lo; value <= hi; value++) if (roundTo(value, item.unit) !== est) return '가린 수가 한 수로 어림되지 않아요';
    if (item.hide && est >= lo && est <= hi) return '가린 수의 어림이 범위 안에 있어요';
    if (est <= 0) return '어림한 수가 0이에요';
  }
  const range = trueRange(board);
  if (range[0] <= 0 || combine(op, items.map(estOf)) <= 0) return '셈한 값이 0보다 커야 해요';
  return null;
}

/** 실제 값의 범위 [가장 작을 때, 가장 클 때]. 수는 모두 0보다 크다 */
export function trueRange(board) {
  const [a, b, c] = board.items.map(rangeOf);
  if (board.op === '+') return [a[0] + b[0] + (c ? c[0] : 0), a[1] + b[1] + (c ? c[1] : 0)];
  if (board.op === '-') return [a[0] - b[1], a[1] - b[0]];
  return [a[0] * b[0], a[1] * b[1]];
}

/**
 * 어림한 값과 실제 값의 차(어림한 값 − 실제 값)를 수마다의 몫으로 나눈 것. 막대 그림에 쓴다.
 * 더하기는 수마다 (어림한 수 − 실제 수), 빼기의 뒤의 수는 부호가 바뀐다.
 * 곱하기는 앞의 수를 먼저 바꾸고(뒤의 수는 그대로) 뒤의 수를 바꾼 몫이다: (어림 앞 − 앞) × 뒤 + 어림 앞 × (어림 뒤 − 뒤). 둘을 더하면 꼭 차가 된다.
 * @returns {{ index: number, lo: number, hi: number }[]} 몫이 0인 수는 빠진다. lo와 hi는 그 몫이 될 수 있는 가장 작은 값과 가장 큰 값
 */
export function pushesOf(board) {
  const { op, items } = board;
  const list = [];
  items.forEach((item, index) => {
    const [lo, hi] = rangeOf(item);
    const est = estOf(item);
    let range;
    if (op === '×') {
      // 곱하기에는 가린 수가 없다
      range = index === 0 ? [(est - lo) * items[1].n] : [estOf(items[0]) * (est - lo)];
      range = [range[0], range[0]];
    } else if (op === '-' && index === 1) range = [lo - est, hi - est];
    else range = [est - hi, est - lo];
    if (range[0] === 0 && range[1] === 0) return;
    list.push({ index, lo: range[0], hi: range[1] });
  });
  return list;
}

/**
 * 어림한 값이 실제 값보다 큰가, 작은가, 알 수 없는가.
 *   answer  'bigger'(어림한 값이 더 크다) | 'smaller' | 'unknown'(가린 숫자에 따라 다르다) | 'same'(늘 같다)
 *   by      'directions'(수마다 어림한 쪽만 보아도 정해진다: 모든 몫이 같은 쪽이다) | 'sizes'(쪽이 섞였지만 몫의 크기로 정해진다) | 'unknown'
 *   est     어림한 값, low와 high는 실제 값이 될 수 있는 가장 작은 값과 가장 큰 값
 *   touch   가린 숫자에 따라 실제 값이 어림한 값과 같아질 수도 있는가(판으로 내지 않는다)
 */
export function verdict(board) {
  const est = combine(board.op, board.items.map(estOf));
  const [low, high] = trueRange(board);
  let answer;
  if (est > high) answer = 'bigger';
  else if (est < low) answer = 'smaller';
  else if (low === high) answer = 'same';
  else answer = 'unknown';
  const pushes = pushesOf(board);
  const up = pushes.every((item) => item.lo > 0);
  const down = pushes.every((item) => item.hi < 0);
  const by = answer === 'unknown' || answer === 'same' ? 'unknown' : pushes.length > 0 && (up || down) ? 'directions' : 'sizes';
  return { est, low, high, answer, by, touch: low < high && (est === low || est === high) };
}

// ---- 판 하나 ----

/** 판이 쓸 수 있는 값인가. 쓸 수 있으면 null, 아니면 까닭(개발용 글) */
export function checkBoard(board, options = {}) {
  if (!board || typeof board !== 'object' || !KINDS.includes(board.kind)) return '판의 종류가 맞지 않아요';
  if (board.kind === 'area' || board.kind === 'cover') return checkBlob(board, options);
  if (board.kind === 'line') return checkLine(board);
  return checkSide(board);
}

/** 판을 베낀다(기록과 저장에 쓰는 꼴) */
export function copyBoard(board) {
  if (board.kind === 'area') return { kind: 'area', w: board.w, h: board.h, circles: board.circles.map((circle) => circle.slice()) };
  if (board.kind === 'cover') return { kind: 'cover', w: board.w, h: board.h, circles: board.circles.map((circle) => circle.slice()), k: board.k };
  if (board.kind === 'line') return { kind: 'line', from: board.from, to: board.to, step: board.step, ticks: board.ticks.slice(), targets: board.targets.slice() };
  return { kind: 'side', op: board.op, items: board.items.map((item) => ({ n: item.n, unit: item.unit, hide: item.hide })) };
}

/**
 * 판을 푼다.
 *   area   { count: 얼룩 칸 수, cells }
 *   cover  { count, cells, best: 가장 적게 더 덮은 칸 수, rects: 그 덮기 }
 *   line   { targets }
 *   side   verdict와 같은 값. 알 수 없는 판은 possible이 거짓이다(안 되는 판처럼 "왜 그럴까?"를 연다)
 */
export function solve(board) {
  if (board.kind === 'area' || board.kind === 'cover') {
    const cells = blobCells(board);
    if (board.kind === 'area') return { possible: true, count: cells.length, cells };
    const cover = bestCover(board, board.k, cells);
    return { possible: true, count: cells.length, cells, best: cover.extra, rects: cover.rects };
  }
  if (board.kind === 'line') return { possible: true, targets: board.targets.slice() };
  const result = verdict(board);
  return { possible: result.answer !== 'unknown', ...result };
}
