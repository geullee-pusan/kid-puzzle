// 줄 뒤집기 판의 판과 풀이. 순수 함수만 둔다.
// 판: { w: 가로 칸 수(세로줄의 수), h: 세로 칸 수(가로줄의 수), cells: 칸마다 1(검은 칸) 또는 0(흰 칸), 위 줄부터 왼쪽에서 오른쪽으로 }
// 한 번 움직이기: 가로줄 하나나 세로줄 하나를 통째로 뒤집는다(검은 칸은 흰 칸, 흰 칸은 검은 칸). 'r2'는 위에서 셋째 가로줄, 'c0'은 맨 왼쪽 세로줄이다.
// 물음: 모두 흰 칸으로 만들 수 있을까.
//
// 풀이: 어느 줄을 몇 번 뒤집든 한 줄을 두 번 뒤집으면 제자리이므로, 줄마다 뒤집는지 아닌지만 따지면 된다.
// 가로줄 i를 뒤집는지 r[i], 세로줄 j를 뒤집는지 c[j]라 하면 칸 (i, j)는 r[i]와 c[j] 가운데 하나만 참일 때 바뀐다.
// 그래서 모두 흰 칸이 되는 판은 칸 (i, j)가 검은 칸인 것과 "r[i]와 c[j] 가운데 하나만 참"인 것이 같은 판이다.
//   맨 윗줄로 c를 정하면(r[0]은 거짓으로 둔다) 맨 왼쪽 세로줄로 r이 정해진다. 그 둘로 판 전체가 맞는지 보면 된다.
//   모든 가로줄과 세로줄을 함께 뒤집으면 판이 그대로라서, 되는 방법은 꼭 두 가지(서로 뒤집은 것)다. 둘 가운데 적은 쪽이 가장 적은 횟수다.
// 바뀌지 않는 것: 어느 직사각형의 네 모서리(두 가로줄과 두 세로줄이 만나는 네 칸)를 보면, 줄 하나를 뒤집을 때 네 칸 가운데 0칸이나 2칸만 바뀐다.
//   그래서 네 모서리의 검은 칸 수의 홀짝은 그대로다. 모두 흰 칸이면 0개(짝수)이므로, 홀수인 네 모서리가 하나라도 있으면 안 된다.
//   붙어 있는 2×2 덩이가 모두 짝수이면 어느 직사각형의 네 모서리도 짝수이고, 그런 판은 늘 된다(테스트가 다른 방법으로 모두 해 보고 확인한다).
// 안 되는 까닭으로 보여 줄 네 칸(witness): 판 전체의 네 모서리가 홀수이면 그것, 아니면 홀수인 2×2 덩이(판의 네 구석 덩이를 먼저 본다).

/** 판의 크기: 가로와 세로 모두 2칸에서 5칸까지 */
export const MIN_SIDE = 2;
export const MAX_SIDE = 5;

const isBit = (value) => value === 0 || value === 1;

/** 판이 규격에 맞는가. 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  const { w, h, cells } = board;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < MIN_SIDE || h < MIN_SIDE || w > MAX_SIDE || h > MAX_SIDE) return 'size';
  if (!Array.isArray(cells) || cells.length !== w * h || !cells.every(isBit)) return 'cells';
  return null;
}

export function copyBoard(board) {
  return { w: board.w, h: board.h, cells: board.cells.slice() };
}

/** 판을 한 줄의 글로(같은 판인지 견주고, 적어 둘 때 쓴다) */
export function boardKey(board) {
  return `${board.w}x${board.h}:${board.cells.join('')}`;
}

export const sameBoard = (a, b) => boardKey(a) === boardKey(b);

// ---- 움직임 ----

/** 가로줄과 세로줄의 이름 */
export const rowMove = (r) => `r${r}`;
export const colMove = (c) => `c${c}`;

/** 움직임을 읽는다: { line: 'r' | 'c', at } 또는 판에 없는 움직임이면 null */
export function readMove(w, h, move) {
  const found = typeof move === 'string' ? move.match(/^([rc])(\d)$/) : null;
  if (!found) return null;
  const at = Number(found[2]);
  if (at >= (found[1] === 'r' ? h : w)) return null;
  return { line: found[1], at };
}

export const isMove = (w, h, move) => readMove(w, h, move) !== null;

/** 그 줄에 든 칸 번호들 */
export function lineCells(w, h, move) {
  const read = readMove(w, h, move);
  if (!read) return [];
  if (read.line === 'r') return Array.from({ length: w }, (_, c) => read.at * w + c);
  return Array.from({ length: h }, (_, r) => r * w + read.at);
}

/** 줄 하나를 뒤집은 새 칸들 */
export function applyMove(w, h, cells, move) {
  const next = cells.slice();
  for (const cell of lineCells(w, h, move)) next[cell] = 1 - next[cell];
  return next;
}

/** 처음 모습에서 움직임들을 차례로 한 모습. 판에 없는 움직임이 있으면 ok가 거짓이다 */
export function replay(board, trail) {
  if (!Array.isArray(trail)) return { ok: false, cells: board.cells.slice() };
  let cells = board.cells.slice();
  for (const move of trail) {
    if (!isMove(board.w, board.h, move)) return { ok: false, cells };
    cells = applyMove(board.w, board.h, cells, move);
  }
  return { ok: true, cells };
}

export const blackCount = (cells) => cells.reduce((sum, value) => sum + value, 0);
export const isWhite = (cells) => cells.every((value) => value === 0);

// ---- 네 모서리 ----

/**
 * 네 모서리: 두 가로줄(r1 < r2)과 두 세로줄(c1 < c2)이 만나는 네 칸.
 * @returns {number[]} 칸 번호 넷(왼쪽 위, 오른쪽 위, 왼쪽 아래, 오른쪽 아래)
 */
export function cornersOf(w, rect) {
  const { r1, c1, r2, c2 } = rect;
  return [r1 * w + c1, r1 * w + c2, r2 * w + c1, r2 * w + c2];
}

/** 네 모서리의 검은 칸 수 */
export function cornerBlack(w, cells, rect) {
  return cornersOf(w, rect).reduce((sum, cell) => sum + cells[cell], 0);
}

/** 두 칸으로 정하는 네 모서리(두 칸이 다른 가로줄, 다른 세로줄에 있을 때). 아니면 null */
export function rectFrom(w, a, b) {
  const [ra, ca, rb, cb] = [Math.floor(a / w), a % w, Math.floor(b / w), b % w];
  if (ra === rb || ca === cb) return null;
  return { r1: Math.min(ra, rb), c1: Math.min(ca, cb), r2: Math.max(ra, rb), c2: Math.max(ca, cb) };
}

/** 판 전체의 네 모서리 */
export const boardCorners = (board) => ({ r1: 0, c1: 0, r2: board.h - 1, c2: board.w - 1 });

/** 붙어 있는 2×2 덩이들(왼쪽 위 칸의 차례). 판의 네 구석 덩이를 앞에 둔다 */
export function blocksOf(w, h) {
  const all = [];
  for (let r = 0; r + 1 < h; r++) for (let c = 0; c + 1 < w; c++) all.push({ r1: r, c1: c, r2: r + 1, c2: c + 1 });
  const corner = (rect) => (rect.r1 === 0 || rect.r2 === h - 1) && (rect.c1 === 0 || rect.c2 === w - 1);
  return [...all.filter(corner), ...all.filter((rect) => !corner(rect))];
}

/** 검은 칸이 홀수 개인 2×2 덩이들 */
export function oddBlocks(board) {
  return blocksOf(board.w, board.h).filter((rect) => cornerBlack(board.w, board.cells, rect) % 2 === 1);
}

/** 안 되는 까닭으로 보여 줄 네 칸. 되는 판이면 null */
export function witnessOf(board) {
  const whole = boardCorners(board);
  if (cornerBlack(board.w, board.cells, whole) % 2 === 1) return { ...whole, kind: 'corners' };
  const [block] = oddBlocks(board);
  return block ? { ...block, kind: 'block' } : null;
}

// ---- 풀이 ----

/**
 * 판을 푼다.
 * @returns {{possible: boolean, min: number|null, moves: string[], witness: object|null, black: number}}
 *   moves 가장 적게 뒤집는 한 가지 방법(가로줄 위에서부터, 그다음 세로줄 왼쪽부터). 안 되는 판이면 빈 목록
 *   witness 안 되는 판에서 검은 칸이 홀수 개인 네 칸(kind: 'corners' 판 전체의 네 모서리 | 'block' 2×2 덩이)
 */
export function solve(board) {
  const { w, h, cells } = board;
  const black = blackCount(cells);
  // 맨 윗줄로 세로줄을, 맨 왼쪽 세로줄로 가로줄을 정한다(맨 윗 가로줄은 뒤집지 않는다고 둔다)
  const cols = Array.from({ length: w }, (_, c) => cells[c]);
  const rows = Array.from({ length: h }, (_, r) => cells[r * w] ^ cols[0]);
  let possible = true;
  for (let r = 0; r < h && possible; r++) for (let c = 0; c < w; c++) if ((rows[r] ^ cols[c]) !== cells[r * w + c]) possible = false;
  if (!possible) return { possible: false, min: null, moves: [], witness: witnessOf(board), black };
  const used = rows.filter(Boolean).length + cols.filter(Boolean).length;
  // 다른 한 가지는 모든 줄을 거꾸로 고른 것이다. 적은 쪽을 고른다(같으면 앞의 것)
  const flip = h + w - used < used;
  const pick = (list) => list.map((value) => (flip ? 1 - value : value));
  const moves = [...pick(rows).flatMap((value, r) => (value ? [rowMove(r)] : [])), ...pick(cols).flatMap((value, c) => (value ? [colMove(c)] : []))];
  return { possible: true, min: moves.length, moves, witness: null, black };
}

/** 대본의 그림 판: 줄마다 한 글('#'는 검은 칸, '.'은 흰 칸) → 판 */
export function boardOfRows(rows) {
  return { w: rows[0].length, h: rows.length, cells: rows.flatMap((row) => [...row].map((mark) => (mark === '#' ? 1 : 0))) };
}

/** 줄을 뒤집는 방법(가로줄마다, 세로줄마다 뒤집는지)으로 만든 판의 칸들 */
export function cellsFrom(rows, cols) {
  return rows.flatMap((r) => cols.map((c) => r ^ c));
}
