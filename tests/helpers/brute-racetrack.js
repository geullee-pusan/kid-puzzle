// 모눈 자동차 경주를 다른 방법으로 따진다(테스트 전용). src/core/racetrack.js의 셈을 쓰지 않는다.
// - 선과 칸: 선 위의 점을 a + t(b - a)(0 ≤ t ≤ 1)로 두고, 가로와 세로마다 칸 안에 드는 t의 구간을 분수로 구해 두 구간이 겹치는지 본다.
// - 결승선: 선이 판의 네모를 떠나는 t(분수)와 그때의 자리를 구해, 결승선의 안쪽(끝점은 빼고)인지 본다.
// - 탐색: 차를 글자 열쇠로 적고, 한 번 움직일 때마다의 차 모둠을 통째로 늘려 간다(층마다 너비 우선).

/** 분수 { n, d }(d > 0) */
const frac = (n, d) => (d < 0 ? { n: -n, d: -d } : { n, d });
const less = (a, b) => a.n * b.d < b.n * a.d;
const lessEq = (a, b) => a.n * b.d <= b.n * a.d;
const maxF = (a, b) => (less(a, b) ? b : a);
const minF = (a, b) => (less(a, b) ? a : b);

/** 한 방향(가로나 세로)에서 p + t·q가 [lo, hi]에 드는 t의 구간(없으면 null) */
function band(p, q, lo, hi) {
  if (q === 0) return p >= lo && p <= hi ? [frac(-1e9, 1), frac(1e9, 1)] : null;
  const t1 = frac(lo - p, q);
  const t2 = frac(hi - p, q);
  return less(t1, t2) ? [t1, t2] : [t2, t1];
}

/** 선 a→b(두 배 자리)가 닫힌 네모 [x0, x1] × [y0, y1]에 닿는가 */
function meets(ax, ay, bx, by, x0, y0, x1, y1) {
  const bx1 = band(ax, bx - ax, x0, x1);
  const by1 = band(ay, by - ay, y0, y1);
  if (!bx1 || !by1) return false;
  const low = maxF(maxF(bx1[0], by1[0]), frac(0, 1));
  const high = minF(minF(bx1[1], by1[1]), frac(1, 1));
  return lessEq(low, high);
}

const W = (board) => board.rows[0].length;
const H = (board) => board.rows.length;

/** 선이 닿는 판 안의 칸들(판의 모든 칸을 하나씩 본다) */
export function bruteCells(board, x0, y0, x1, y1) {
  const ax = 2 * x0 + 1;
  const ay = 2 * y0 + 1;
  const bx = 2 * x1 + 1;
  const by = 2 * y1 + 1;
  const cells = [];
  for (let r = 0; r < H(board); r++) for (let c = 0; c < W(board); c++) if (meets(ax, ay, bx, by, 2 * c, 2 * r, 2 * c + 2, 2 * r + 2)) cells.push([c, r]);
  return cells;
}

/** 선의 결과: 'move' | 'finish' | 'wall' */
export function bruteKind(board, x0, y0, x1, y1) {
  if (bruteCells(board, x0, y0, x1, y1).some(([c, r]) => board.rows[r][c] === '#')) return 'wall';
  const inside = x1 >= 0 && y1 >= 0 && x1 < W(board) && y1 < H(board);
  if (inside) return 'move';
  // 판을 떠나는 때: 판의 네모 안에 드는 t 구간의 끝
  const ax = 2 * x0 + 1;
  const ay = 2 * y0 + 1;
  const bx = 2 * x1 + 1;
  const by = 2 * y1 + 1;
  const tx = band(ax, bx - ax, 0, 2 * W(board));
  const ty = band(ay, by - ay, 0, 2 * H(board));
  const leave = minF(tx[1], ty[1]);
  // 떠나는 자리(분수): 2배 자리에 d를 곱한 값
  const px = { n: ax * leave.d + leave.n * (bx - ax), d: leave.d };
  const py = { n: ay * leave.d + leave.n * (by - ay), d: leave.d };
  const { side, from, to } = board.finish;
  const on = (value, line) => value.n === line * value.d;
  const strictly = (value, lo, hi) => lo * value.d < value.n && value.n < hi * value.d;
  if (side === 'top') return on(py, 0) && strictly(px, 2 * from, 2 * to + 2) ? 'finish' : 'wall';
  if (side === 'bottom') return on(py, 2 * H(board)) && strictly(px, 2 * from, 2 * to + 2) ? 'finish' : 'wall';
  if (side === 'left') return on(px, 0) && strictly(py, 2 * from, 2 * to + 2) ? 'finish' : 'wall';
  return on(px, 2 * W(board)) && strictly(py, 2 * from, 2 * to + 2) ? 'finish' : 'wall';
}

const isFlagCell = (board, c, r) => board.flags.some(([x, y]) => x === c && y === r);

/**
 * 가장 적은 움직임 수(갈 수 없으면 null). 차 모둠을 층마다 늘린다.
 * @param {object} board
 * @param {{limit?: number}} options limit: 이만큼 움직여도 못 가면 null
 */
export function bruteFewest(board, { limit = 40 } = {}) {
  const key = (s) => `${s.x},${s.y},${s.vx},${s.vy},${s.flag ? 1 : 0}`;
  let layer = [{ x: board.start[0], y: board.start[1], vx: 0, vy: 0, flag: board.flags.length === 0 }];
  const seen = new Set(layer.map(key));
  for (let moves = 1; moves <= limit && layer.length > 0; moves++) {
    const next = [];
    for (const s of layer) {
      for (let ay = -1; ay <= 1; ay++) {
        for (let ax = -1; ax <= 1; ax++) {
          const x = s.x + s.vx + ax;
          const y = s.y + s.vy + ay;
          const kind = bruteKind(board, s.x, s.y, x, y);
          if (kind === 'wall') continue;
          const flag = s.flag || bruteCells(board, s.x, s.y, x, y).some(([c, r]) => isFlagCell(board, c, r));
          if (kind === 'finish') {
            if (flag) return moves;
            continue;
          }
          const state = { x, y, vx: x - s.x, vy: y - s.y, flag };
          if (seen.has(key(state))) continue;
          seen.add(key(state));
          next.push(state);
        }
      }
    }
    layer = next;
  }
  return null;
}

/**
 * 움직임을 차례대로 해 본다(다른 방법). 할 수 없는 움직임이 있으면 null.
 * @returns {{points: number[][], finished: boolean, flag: boolean, last: object}|null}
 */
export function bruteReplay(board, moves) {
  let s = { x: board.start[0], y: board.start[1], vx: 0, vy: 0, flag: board.flags.length === 0 };
  const points = [[s.x, s.y]];
  let finished = false;
  for (const [ax, ay] of moves) {
    if (finished) return null;
    const x = s.x + s.vx + ax;
    const y = s.y + s.vy + ay;
    const kind = bruteKind(board, s.x, s.y, x, y);
    if (kind === 'wall') return null;
    const flag = s.flag || bruteCells(board, s.x, s.y, x, y).some(([c, r]) => isFlagCell(board, c, r));
    if (kind === 'finish' && !flag) return null;
    finished = kind === 'finish';
    s = { x, y, vx: x - s.x, vy: y - s.y, flag };
    points.push([x, y]);
  }
  return { points, finished, flag: s.flag, last: s };
}

/** 차가 아홉 가지로 움직여도 모두 벽에 닿는가 */
export function bruteStuck(board, s) {
  for (let ay = -1; ay <= 1; ay++) for (let ax = -1; ax <= 1; ax++) if (bruteKind(board, s.x, s.y, s.x + s.vx + ax, s.y + s.vy + ay) !== 'wall') return false;
  return true;
}
