// 세모 피하기: 판의 규칙과 풀이 프로그램. 순수 함수만 둔다.
//
// 판(board)은 { kind, n, gone, red, blue }다.
//   kind  'game'(선생님과 번갈아 긋기) | 'paint'(혼자 모든 선을 두 색으로 칠하기)
//   n     원 위에 놓인 점의 수(4~6). 점 번호는 맨 위에서부터 시계 방향으로 0, 1, 2, …
//   gone  선이 없는 두 점(칠하기 판에서만. 그 두 점은 잇지 않는다)
//   red   처음부터 빨갛게 그어 둔 선, blue 처음부터 파랗게 그어 둔 선(직접 만든 판과 칠하기 판)
// 선 번호는 두 점 a < b를 (0,1), (0,2), …, (0,n-1), (1,2), … 차례로 0부터 센다. 선 목록은 늘 작은 것부터 적는다.
// 세모는 판의 점 세 개를 잇는 세 선이다. 선이 판 가운데에서 엇갈리는 곳은 점이 아니라서 세모를 만들지 않는다.
//
// 게임의 규칙(kind 'game')
//   - 아이는 늘 빨강, 선생님은 늘 파랑이다. 번갈아 아직 긋지 않은 선 하나를 자기 색으로 긋는다.
//   - 자기 색 선 세 개로 세모(점 세 개를 모두 자기 색으로 이은 것)를 만든 쪽이 진다. 그을 선이 하나뿐이어도 그어야 한다.
//   - 세모 없이 모든 선을 그었으면 비긴다(점이 여섯이면 이렇게 끝나는 일이 없다).
//   수(move)는 선 번호 하나다. 둔 수들(trail)은 처음부터의 차례이고, 먼저 두는 쪽(first: 'red' | 'blue')부터 번갈아 둔다.
// 칠하기의 규칙(kind 'paint')
//   - 혼자 모든 선(gone을 뺀 것)을 빨강이나 파랑으로 칠한다. 한 색 세모가 하나도 없게 다 칠하면 끝난다.
//   - 어떻게 칠해도 한 색 세모가 생기는 판이면 "안 돼요"가 답이다.
//
// 풀이 프로그램(게임): 자리(둘 차례인 쪽의 선들, 상대의 선들)마다 "둘 차례인 쪽이 잘 두면 이기는가(1), 비기는가(0), 지는가(-1)"를
// 끝에서부터 따진다. 한 번 따진 자리는 적어 둔다. 이기는 수를 하나 찾으면 그 자리는 더 따지지 않는다. 지름길 규칙은 쓰지 않는다.
// 점이 여섯이어도 처음 자리에서 첫 수 열다섯을 모두 따지는 데 적어 두는 자리가 15만 개쯤이다(테스트가 잰다).
// 풀이 프로그램(칠하기): 칠하지 않은 선을 차례로 두 색으로 칠해 보며, 한 색 세모가 생기면 그 길은 더 가지 않는다.
// 다른 방법(규칙을 따로 적고 적어 두지 않고 모두 따지는 탐색)으로 다시 구한 값과 테스트에서 견준다.
import { latestById } from './level.js';
import { createRng, randInt, seedFrom } from './rng.js';

export const COLORS = ['red', 'blue'];
export const KINDS = ['game', 'paint'];

/** 점의 수(임시). 풀이 프로그램이 모든 자리를 바로 따질 수 있는 크기만 넣는다(여섯까지) */
export const LIMITS = { min: 4, max: 6 };

/** 선생님이 두는 법: 'easy'(자기 세모만 피한다), 'fair'(남은 선이 FAIR_LEFT개 이하면 잘 둔다), 'best'(늘 잘 둔다) */
export const TEACHERS = ['easy', 'fair', 'best'];
export const FAIR_LEFT = 6;

/** 다른 색 */
export const otherColor = (color) => (color === 'red' ? 'blue' : 'red');

const whole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

// ---- 점과 선 ----

const tables = new Map();

/**
 * 점이 n개인 판의 선과 세모 목록. 한 번 만든 것은 적어 둔다.
 *   lines   선마다 [a, b]
 *   index   index[a][b] = 선 번호
 *   around  선마다, 그 선과 세모를 이루는 나머지 두 선의 비트 목록
 *   triangles 세모마다 { points: [a, b, c], mask }
 */
export function tableOf(n) {
  if (!tables.has(n)) {
    const lines = [];
    const index = Array.from({ length: n }, () => Array(n).fill(-1));
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        index[a][b] = lines.length;
        index[b][a] = lines.length;
        lines.push([a, b]);
      }
    }
    const around = lines.map(([a, b]) => {
      const list = [];
      for (let c = 0; c < n; c++) if (c !== a && c !== b) list.push((1 << index[a][c]) | (1 << index[b][c]));
      return list;
    });
    const triangles = [];
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) triangles.push({ points: [a, b, c], mask: (1 << index[a][b]) | (1 << index[a][c]) | (1 << index[b][c]) });
    tables.set(n, { lines, index, around, triangles });
  }
  return tables.get(n);
}

export const lineCount = (n) => (n * (n - 1)) / 2;

/** 두 점을 잇는 선의 번호. 같은 점이거나 판 밖이면 -1 */
export function lineOf(n, a, b) {
  if (!whole(n, LIMITS.min, LIMITS.max) || !whole(a, 0, n - 1) || !whole(b, 0, n - 1) || a === b) return -1;
  return tableOf(n).index[a][b];
}

/** 선의 두 끝 점 */
export const endsOf = (n, line) => tableOf(n).lines[line].slice();

const maskOf = (list) => list.reduce((mask, line) => mask | (1 << line), 0);

export function bitsOf(mask) {
  const out = [];
  for (let bit = 0; mask >> bit !== 0; bit++) if ((mask >> bit) & 1) out.push(bit);
  return out;
}

const countBits = (mask) => {
  let count = 0;
  for (let rest = mask; rest !== 0; rest &= rest - 1) count += 1;
  return count;
};

/** 이 선을 그으면 그 색(선 비트 mask)의 세모가 생기는가 */
const closes = (n, mask, line) => tableOf(n).around[line].some((pair) => (mask & pair) === pair);

/** 선 비트 mask 안에 있는 세모들(점 세 개씩) */
export function trianglesIn(n, mask) {
  return tableOf(n)
    .triangles.filter((item) => (mask & item.mask) === item.mask)
    .map((item) => item.points.slice());
}

/** 이 선을 그었을 때 생기는 세모(그 선을 품은 것 하나. 없으면 null) */
function triangleWith(n, mask, line) {
  const [a, b] = tableOf(n).lines[line];
  const { index } = tableOf(n);
  for (let c = 0; c < n; c++) {
    if (c === a || c === b) continue;
    if (((mask >> index[a][c]) & 1) && ((mask >> index[b][c]) & 1)) return [a, b, c].sort((x, y) => x - y);
  }
  return null;
}

// ---- 판 ----

function sortedLines(list, count) {
  if (!Array.isArray(list)) return false;
  for (let at = 0; at < list.length; at++) {
    if (!whole(list[at], 0, count - 1)) return false;
    if (at > 0 && list[at] <= list[at - 1]) return false;
  }
  return true;
}

/** 판으로 쓸 수 있는 값인가. 쓸 수 있으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'board';
  if (!KINDS.includes(board.kind)) return 'kind';
  if (!whole(board.n, LIMITS.min, LIMITS.max)) return 'size';
  const count = lineCount(board.n);
  for (const key of ['gone', 'red', 'blue']) if (!sortedLines(board[key], count)) return 'lines';
  const seen = new Set();
  for (const line of [...board.gone, ...board.red, ...board.blue]) {
    if (seen.has(line)) return 'lines';
    seen.add(line);
  }
  if (board.kind === 'game' && board.gone.length > 0) return 'gone';
  // 처음부터 한 색 세모가 있는 판은 쓰지 않는다.
  if (trianglesIn(board.n, maskOf(board.red)).length > 0 || trianglesIn(board.n, maskOf(board.blue)).length > 0) return 'triangle';
  if (seen.size >= count) return 'full';
  return null;
}

export const copyBoard = (board) => ({ kind: board.kind, n: board.n, gone: board.gone.slice(), red: board.red.slice(), blue: board.blue.slice() });

/** 판을 글자로 적는다(시드와 풀이 기록의 이름에 쓴다) */
export const boardKey = (board) => `${board.kind}:${board.n}:${board.gone.join('.')}:${board.red.join('.')}:${board.blue.join('.')}`;

/** 빈 판(선이 하나도 없는 판) */
export const emptyBoard = (kind, n) => ({ kind, n, gone: [], red: [], blue: [] });

/** 판에 있는 선 모두의 비트(gone을 뺀 것) */
export const usableMask = (board) => ((1 << lineCount(board.n)) - 1) & ~maskOf(board.gone);

// ---- 게임: 두기 ----

/**
 * 둔 수들을 처음부터 다시 둔다.
 * @param {object} board
 * @param {number[]} trail 둔 수들(선 번호)
 * @param {'red'|'blue'} first 먼저 두는 쪽
 * @returns {{ok, red, blue, placed, next, over, winner, loser, draw, triangle, left}}
 *   ok       모두 둘 수 있는 수였는가(둘 수 없는 수를 만나면 그 앞까지의 모습이다)
 *   red, blue 그어진 선의 비트(처음부터 그어 둔 선도 들어간다). placed 둔 수들 { line, color }(둔 차례대로)
 *   next     둘 차례인 쪽(끝났으면 null). over 끝났는가
 *   winner   끝났으면 이긴 쪽(비겼으면 null), loser 세모를 만들어 진 쪽, draw 세모 없이 모든 선을 그어 비겼는가
 *   triangle 진 쪽이 만든 세모의 점 셋(작은 것부터). left 아직 긋지 않은 선의 수
 */
export function replay(board, trail, first) {
  const n = board.n;
  const all = usableMask(board);
  let red = maskOf(board.red);
  let blue = maskOf(board.blue);
  const placed = [];
  let ok = Array.isArray(trail) && COLORS.includes(first);
  let color = first;
  let over = false;
  let loser = null;
  let draw = false;
  let triangle = null;
  if (ok) {
    for (const line of trail) {
      if (over || !whole(line, 0, lineCount(n) - 1) || !((all >> line) & 1) || (((red | blue) >> line) & 1)) {
        ok = false;
        break;
      }
      const mine = color === 'red' ? red : blue;
      const made = closes(n, mine, line) ? triangleWith(n, mine, line) : null;
      if (color === 'red') red |= 1 << line;
      else blue |= 1 << line;
      placed.push({ line, color });
      if (made) {
        over = true;
        loser = color;
        triangle = made;
      } else if ((red | blue) === all) {
        over = true;
        draw = true;
      }
      color = otherColor(color);
    }
  }
  const left = countBits(all & ~(red | blue));
  return { ok, red, blue, placed, next: over ? null : color, over, winner: loser ? otherColor(loser) : null, loser, draw, triangle, left };
}

/** 지금 둘 차례인 쪽이 그을 수 있는 선 모두(작은 것부터). 끝났으면 빈 목록이다 */
export function movesOf(board, trail, first) {
  const now = replay(board, trail, first);
  if (!now.ok || now.over) return [];
  return bitsOf(usableMask(board) & ~(now.red | now.blue));
}

/** 그 색이 그어도 자기 세모가 생기지 않는 선 모두(지금 자리에서) */
export function safeLines(board, red, blue, color) {
  const mine = color === 'red' ? red : blue;
  return bitsOf(usableMask(board) & ~(red | blue)).filter((line) => !closes(board.n, mine, line));
}

// ---- 게임: 풀이 프로그램 ----

/** 점의 수마다 따져 둔 자리. 너무 커지면 다음 물음 앞에서 비운다(태블릿의 기억을 아낀다) */
const memos = new Map();
const MEMO_LIMIT = 500000;

function memoOf(n) {
  if (!memos.has(n) || memos.get(n).size > MEMO_LIMIT) memos.set(n, new Map());
  return memos.get(n);
}

/**
 * 둘 차례인 쪽의 선(me)과 상대의 선(op)이 이렇고 그을 수 있는 선이 all일 때, 둘 차례인 쪽이 잘 두면 어떻게 되는가: 1 이긴다, 0 비긴다, -1 진다.
 * 이름은 me * 2^15 + op다(gone이 있는 판은 게임에 쓰지 않는다). memo에 적어 둔다.
 */
function valueWith(n, all, me, op, memo) {
  const free = all & ~(me | op);
  if (free === 0) return 0;
  const key = me * 32768 + op;
  const known = memo.get(key);
  if (known !== undefined) return known;
  let best = -2;
  const around = tableOf(n).around;
  for (let rest = free; rest !== 0; rest &= rest - 1) {
    const line = 31 - Math.clz32(rest & -rest);
    let value;
    if (around[line].some((pair) => (me & pair) === pair)) value = -1;
    else value = -valueWith(n, all, op, me | (1 << line), memo);
    if (value > best) {
      best = value;
      if (best === 1) break;
    }
  }
  memo.set(key, best);
  return best;
}

/** 지금 자리에서 둘 차례인 쪽이 둘 수 있는 선마다, 그 선을 그은 뒤 그쪽이 잘 두면 어떻게 되는가(1, 0, -1) */
export function moveValues(board, trail, first) {
  const now = replay(board, trail, first);
  if (!now.ok || now.over) return [];
  const n = board.n;
  const all = usableMask(board);
  const memo = memoOf(n);
  const me = now.next === 'red' ? now.red : now.blue;
  const op = now.next === 'red' ? now.blue : now.red;
  return bitsOf(all & ~(me | op)).map((line) => ({ line, value: closes(n, me, line) ? -1 : -valueWith(n, all, op, me | (1 << line), memo) }));
}

/** 이 자리에서 둘 다 잘 두면 어떻게 끝나는가: 'red' | 'blue'(이기는 쪽) | 'draw'. 끝난 자리면 끝난 그대로다 */
export function outcomeAt(board, trail, first) {
  const now = replay(board, trail, first);
  if (now.over) return now.draw ? 'draw' : now.winner;
  const me = now.next === 'red' ? now.red : now.blue;
  const op = now.next === 'red' ? now.blue : now.red;
  const value = valueWith(board.n, usableMask(board), me, op, memoOf(board.n));
  return value === 0 ? 'draw' : value === 1 ? now.next : otherColor(now.next);
}

/** 둘 차례인 쪽의 가장 좋은 수들(이기는 수, 없으면 비기는 수, 그것도 없으면 모든 수) */
export function bestMoves(board, trail, first) {
  const values = moveValues(board, trail, first);
  if (values.length === 0) return [];
  const top = Math.max(...values.map((item) => item.value));
  return values.filter((item) => item.value === top).map((item) => item.line);
}

const solveMemo = new Map();

/**
 * 게임 판을 푼다: 빨강이 먼저 둘 때와 파랑이 먼저 둘 때, 둘 다 잘 두면 어떻게 끝나는가.
 * @returns {{possible: true, red: string, blue: string, positions: number}}
 *   red  빨강이 먼저 두면 'red' | 'blue' | 'draw'. blue 파랑이 먼저 두면
 *   positions 두 처음 자리를 새 기록으로 따지면서 적어 둔 자리의 수
 */
export function solveGame(board) {
  const key = boardKey(board);
  if (!solveMemo.has(key)) {
    const memo = new Map();
    const all = usableMask(board);
    const red = maskOf(board.red);
    const blue = maskOf(board.blue);
    const asText = (value, mover) => (value === 0 ? 'draw' : value === 1 ? mover : otherColor(mover));
    const redFirst = asText(valueWith(board.n, all, red, blue, memo), 'red');
    const blueFirst = asText(valueWith(board.n, all, blue, red, memo), 'blue');
    solveMemo.set(key, { possible: true, red: redFirst, blue: blueFirst, positions: memo.size });
  }
  return { ...solveMemo.get(key) };
}

/** 아이(빨강)가 order('first' | 'second')로 둘 때 둘 다 잘 두면 아이는: 'win' | 'draw' | 'lose' */
export function seatOutcome(solution, order) {
  const result = solution[order === 'first' ? 'red' : 'blue'];
  return result === 'draw' ? 'draw' : result === 'red' ? 'win' : 'lose';
}

// ---- 게임: 선생님(컴퓨터)과 두기 ----

/**
 * 컴퓨터가 두는 수. 그을 수 없으면 null.
 *   easy  자기 세모가 바로 생기지 않는 선 가운데서 시드 난수로 고른다(그런 선이 없으면 아무 선)
 *   fair  남은 선이 FAIR_LEFT개보다 많으면 easy처럼, 그 이하면 best처럼 둔다
 *   best  이길 수 있으면 이기는 수, 아니면 비기는 수 가운데서 고른다.
 *         질 자리(어떤 수도 잘 두는 상대에게 진다)에서는 자기 세모가 바로 생기지 않는 선 가운데서 고르게 고른다.
 *         그래서 질 자리에서도 잘 두는 상대가 끝까지 잘 두어야 이긴다.
 */
export function pickMove(board, trail, first, rng, teacher = 'best') {
  const now = replay(board, trail, first);
  if (!now.ok || now.over) return null;
  const moves = bitsOf(usableMask(board) & ~(now.red | now.blue));
  const safe = safeLines(board, now.red, now.blue, now.next);
  const plain = safe.length > 0 ? safe : moves;
  const careful = teacher === 'best' || (teacher === 'fair' && moves.length <= FAIR_LEFT);
  if (!careful) return plain[randInt(rng, 0, plain.length - 1)];
  const values = moveValues(board, trail, first);
  const top = Math.max(...values.map((item) => item.value));
  const list = top === -1 ? plain : values.filter((item) => item.value === top).map((item) => item.line);
  return list[randInt(rng, 0, list.length - 1)];
}

/**
 * 선생님의 다음 수. 같은 (단계, 판 번호, 먼저 두는 쪽, 지금까지 둔 수들)이면 늘 같은 수를 둔다.
 * 직접 만든 판과 작은 판은 판 번호가 없으므로 판의 모습을 시드로 쓴다.
 */
export function teacherMove(board, trail, { level = null, seed = null, first = 'red', teacher = 'best' } = {}) {
  const now = replay(board, trail, first);
  if (!now.ok || now.over) return null;
  const rng = createRng(seedFrom('sim-move', level ?? 'make', seed ?? boardKey(board), first, teacher, trail.join(',')));
  return pickMove(board, trail, first, rng, teacher);
}

const rank = { win: 2, draw: 1, lose: 0 };
const outcomeFor = (result, color) => (result === 'draw' ? 'draw' : result === color ? 'win' : 'lose');

/**
 * 아이가 잘 두면 갈 수 있던 끝보다 나쁜 자리로 보낸 수(이기는 자리에서 비기거나 지는 자리로, 비기는 자리에서 지는 자리로).
 * 몇 번째 수인지(1부터)의 목록이다.
 */
export function slipsOf(board, trail, first, kid = 'red') {
  const slips = [];
  for (let index = 0; index < trail.length; index++) {
    const before = trail.slice(0, index);
    const now = replay(board, before, first);
    if (!now.ok || now.over) break;
    if (now.next !== kid) continue;
    const after = [...before, trail[index]];
    if (!replay(board, after, first).ok) break;
    if (rank[outcomeFor(outcomeAt(board, after, first), kid)] < rank[outcomeFor(outcomeAt(board, before, first), kid)]) slips.push(index + 1);
  }
  return slips;
}

// ---- 칠하기 ----

/** 칠한 모습: 선마다 0(칠하지 않음), 1(빨강), 2(파랑). 처음부터 칠해 둔 선과 아이가 칠한 선(marks)을 합친다 */
export function colorsOf(board, marks = []) {
  const count = lineCount(board.n);
  const colors = Array(count).fill(0);
  for (let line = 0; line < count; line++) {
    const mark = marks[line];
    if (mark === 1 || mark === 2) colors[line] = mark;
  }
  for (const line of board.red) colors[line] = 1;
  for (const line of board.blue) colors[line] = 2;
  for (const line of board.gone) colors[line] = 0;
  return colors;
}

/** 아이가 칠한 것으로 쓸 수 있는 값인가: 선마다 0, 1, 2이고, 처음부터 칠해 둔 선과 없는 선에는 칠하지 않았다 */
export function marksOk(board, marks) {
  if (!Array.isArray(marks) || marks.length !== lineCount(board.n)) return false;
  if (!marks.every((mark) => mark === 0 || mark === 1 || mark === 2)) return false;
  return [...board.gone, ...board.red, ...board.blue].every((line) => marks[line] === 0);
}

/**
 * 칠하기 판의 지금 모습.
 * @returns {{colors, red, blue, triangles, left, painted, done}}
 *   triangles 한 색 세모들 { points, color }. left 아직 칠하지 않은 선의 수, painted 아이가 칠한 선의 수
 *   done      모든 선을 칠했고 한 색 세모가 없다
 */
export function paintState(board, marks) {
  const colors = colorsOf(board, marks);
  let red = 0;
  let blue = 0;
  colors.forEach((color, line) => {
    if (color === 1) red |= 1 << line;
    if (color === 2) blue |= 1 << line;
  });
  const triangles = [...trianglesIn(board.n, red).map((points) => ({ points, color: 'red' })), ...trianglesIn(board.n, blue).map((points) => ({ points, color: 'blue' }))];
  const left = countBits(usableMask(board) & ~(red | blue));
  const painted = Array.isArray(marks) ? marks.filter((mark) => mark === 1 || mark === 2).length : 0;
  return { colors, red, blue, triangles, left, painted, done: left === 0 && triangles.length === 0 };
}

/**
 * 안 되는 까닭 가운데 아이가 볼 수 있는 것. 없으면 null.
 *   given  한 점에서 처음부터 같은 색으로 칠해 둔 선이 셋(point에서 ends 세 점으로, color)이고 그 세 점 사이의 선이 모두 있다.
 *          세 점 사이 선을 그 색으로 칠하면 그 색 세모, 모두 다른 색이면 다른 색 세모가 생긴다.
 *   many   한 점(point)에서 나가는 선이 다섯이고, 그 끝 다섯 점 사이의 선이 모두 있다.
 *          다섯 선을 두 색으로 칠하면 한 색이 셋 이상이고, 그 끝 세 점에서 위와 같다.
 * 둘 다 있으면 given을 고른다(더 눈에 보이는 까닭이다).
 */
export function reasonOf(board) {
  if (checkBoard(board) !== null || board.kind !== 'paint') return null;
  const n = board.n;
  const { index } = tableOf(n);
  const usable = usableMask(board);
  const has = (a, b) => ((usable >> index[a][b]) & 1) === 1;
  const closedAmong = (points) => points.every((a, i) => points.slice(i + 1).every((b) => has(a, b)));
  for (const [color, list] of [['red', board.red], ['blue', board.blue]]) {
    const mask = maskOf(list);
    for (let point = 0; point < n; point++) {
      const ends = [];
      for (let other = 0; other < n; other++) if (other !== point && ((mask >> index[point][other]) & 1)) ends.push(other);
      // 같은 색 선이 셋 이상이면 그 가운데 세 점 사이가 모두 이어진 셋을 찾는다.
      for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) for (let k = j + 1; k < ends.length; k++) {
        const three = [ends[i], ends[j], ends[k]];
        if (closedAmong(three)) return { kind: 'given', point, ends: three, color };
      }
    }
  }
  for (let point = 0; point < n; point++) {
    const ends = [];
    for (let other = 0; other < n; other++) if (other !== point && has(point, other)) ends.push(other);
    if (ends.length >= 5 && closedAmong(ends)) return { kind: 'many', point, ends };
  }
  return null;
}

const paintMemo = new Map();

/**
 * 칠하기 판을 푼다: 칠하지 않은 선을 모두 칠해서 한 색 세모가 없게 하는 방법이 있는가, 몇 가지인가.
 * @returns {{possible: boolean, count: number, example: number[]|null, reason: object|null}}
 *   count   그런 칠하기의 가짓수(처음부터 칠해 둔 선은 그대로)
 *   example 그 가운데 하나(선마다 1 빨강, 2 파랑, 0 없는 선). 안 되면 null
 *   reason  안 되는 판이면 아이가 볼 수 있는 까닭(reasonOf). 볼 수 있는 까닭이 없으면 null
 */
export function solvePaint(board) {
  const key = boardKey(board);
  if (!paintMemo.has(key)) {
    const n = board.n;
    const { around } = tableOf(n);
    const free = bitsOf(usableMask(board) & ~(maskOf(board.red) | maskOf(board.blue)));
    let count = 0;
    let example = null;
    const walk = (at, red, blue) => {
      if (at === free.length) {
        count += 1;
        if (example === null) example = colorsOf(board, []).map((color, line) => (((red >> line) & 1) ? 1 : ((blue >> line) & 1) ? 2 : color));
        return;
      }
      const line = free[at];
      if (!around[line].some((pair) => (red & pair) === pair)) walk(at + 1, red | (1 << line), blue);
      if (!around[line].some((pair) => (blue & pair) === pair)) walk(at + 1, red, blue | (1 << line));
    };
    walk(0, maskOf(board.red), maskOf(board.blue));
    paintMemo.set(key, { possible: count > 0, count, example, reason: count > 0 ? null : reasonOf(board) });
  }
  const found = paintMemo.get(key);
  return { ...found, example: found.example ? found.example.slice() : null };
}

/** 한 색 세모 없이 다 칠하는 방법들(limit개까지, 선마다 1 빨강, 2 파랑, 0 없는 선). 판을 만들 때 쓴다 */
export function paintings(board, limit = 64) {
  const { around } = tableOf(board.n);
  const free = bitsOf(usableMask(board) & ~(maskOf(board.red) | maskOf(board.blue)));
  const found = [];
  const walk = (at, red, blue) => {
    if (found.length >= limit) return;
    if (at === free.length) {
      found.push(colorsOf(board, []).map((color, line) => (((red >> line) & 1) ? 1 : ((blue >> line) & 1) ? 2 : color)));
      return;
    }
    const line = free[at];
    if (!around[line].some((pair) => (red & pair) === pair)) walk(at + 1, red | (1 << line), blue);
    if (!around[line].some((pair) => (blue & pair) === pair)) walk(at + 1, red, blue | (1 << line));
  };
  walk(0, maskOf(board.red), maskOf(board.blue));
  return found;
}

/** 판을 푼다(판의 종류에 따라) */
export const solve = (board) => (board.kind === 'paint' ? solvePaint(board) : solveGame(board));

// ---- 작은 판: 점 하나를 뺀 판 ----

/** 점 하나(drop)를 뺀 판. 남은 점은 번호 차례 그대로 0부터 다시 센다. 그 점에 닿은 선은 함께 빠진다 */
export function dropPoint(board, drop) {
  const n = board.n - 1;
  const from = tableOf(board.n).lines;
  const keep = (list) =>
    list
      .map((line) => from[line])
      .filter(([a, b]) => a !== drop && b !== drop)
      .map(([a, b]) => tableOf(n).index[a > drop ? a - 1 : a][b > drop ? b - 1 : b])
      .sort((x, y) => x - y);
  return { kind: board.kind, n, gone: keep(board.gone), red: keep(board.red), blue: keep(board.blue) };
}

/** 칠하지 않은 선의 수 */
export const freeCount = (board) => countBits(usableMask(board) & ~(maskOf(board.red) | maskOf(board.blue)));

/**
 * 원래 판보다 점이 하나 적은 판들(되는 판 yes, 안 되는 판 no). 칠하기 판은 칠할 선이 셋 이상인 판만,
 * 안 되는 판은 아이가 볼 수 있는 까닭이 있는 판만 넣는다. 같은 판은 한 번만 넣는다.
 * 게임 판은 점이 하나 적은 판, 그다음 둘 적은 판(넷까지)이다(빈 판이면 빈 판, 그어 둔 선이 있으면 남은 선 그대로).
 */
export function smallBoards(board) {
  if (checkBoard(board) !== null || board.n <= LIMITS.min) return { yes: [], no: [] };
  if (board.kind === 'game') {
    const yes = [];
    let now = board;
    while (now.n > LIMITS.min) {
      now = dropPoint(now, now.n - 1);
      if (checkBoard(now) === null) yes.push(now);
    }
    return { yes, no: [] };
  }
  const seen = new Set();
  const yes = [];
  const no = [];
  for (let drop = board.n - 1; drop >= 0; drop--) {
    const small = dropPoint(board, drop);
    const name = boardKey(small);
    if (seen.has(name) || checkBoard(small) !== null || freeCount(small) < 3) continue;
    seen.add(name);
    const solved = solvePaint(small);
    if (solved.possible) yes.push(small);
    else if (solved.reason) no.push(small);
  }
  return { yes, no };
}

// ---- 지난 기록: "왜 그럴까?"가 열리는 때, 연달아 진 판 ----

/** 끝까지 둔 게임들(오래된 것부터). 이긴 판도 진 판도 비긴 판도 들어간다. 작은 판(곁판)은 세지 않는다 */
function finishedGames(records) {
  if (!Array.isArray(records)) return [];
  return latestById(records).filter(
    (record) => record.kind === 'round' && record.format === 'sim' && record.side !== true && record.outcome === 'solved' && ['kid', 'teacher', 'draw'].includes(record.winner),
  );
}

/** 끝까지 둔 게임의 수 */
export function finishedCount(records) {
  return finishedGames(records).length;
}

/** "왜 그럴까?"를 열어도 되는가: 점이 여섯인 판(게임이든 칠하기든)을 한 번 끝까지 한 뒤에 열린다(임시) */
export function whyOpen(records) {
  if (!Array.isArray(records)) return false;
  return latestById(records).some(
    (record) => record.kind === 'round' && record.format === 'sim' && record.side !== true && (record.outcome === 'solved' || record.outcome === 'solution') && record.board?.n === 6,
  );
}

/** 맨 뒤에서부터 연달아 진 게임의 수. 화면에 보여 주지 않는다. 자리를 바꿔 보기를 권할 때만 쓴다 */
export function lostStreak(records) {
  const games = finishedGames(records);
  let streak = 0;
  while (streak < games.length && games[games.length - 1 - streak].winner === 'teacher') streak += 1;
  return streak;
}
