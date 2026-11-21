// 블랙홀: 판의 규칙과 풀이 프로그램. 순수 함수만 둔다.
//
// 판(board)은 { rows, rocks, kid, teacher, first }다.
//   rows     세모꼴로 놓인 동그라미 칸의 줄 수(3~5줄. 맨 위 줄에 1칸, 그 아래 줄마다 1칸씩 늘어 6, 10, 15칸)
//   rocks    돌이 놓인 칸(아무도 수를 놓지 못하는 칸. 이웃으로도 치지 않는다). 작은 번호부터
//   kid      아이(나)의 수가 미리 놓인 칸. kid[0]에 1, kid[1]에 2, …가 놓여 있다(수는 1부터 차례로 놓으므로 칸만 적는다)
//   teacher  선생님의 수가 미리 놓인 칸(같은 꼴)
//   first    먼저 두는 쪽('kid' | 'teacher'). 아이가 두기 전에 고르는 판은 null이다
// 칸 번호는 맨 위 칸이 0이고, 줄마다 왼쪽부터 센다(r번째 줄의 c번째 칸은 r(r+1)/2 + c).
// 이웃 칸: 동그라미가 맞닿은 칸. 같은 줄의 왼쪽과 오른쪽, 윗줄의 둘, 아랫줄의 둘(많아야 여섯).
//
// 게임의 규칙
//   - 돌이 없는 칸(열린 칸)은 홀수 개다(2k + 1개). 두 사람이 번갈아 자기 다음 수(1, 2, 3, …, k)를 빈칸 하나에 놓는다.
//   - 둘 다 k를 놓으면 빈칸이 하나 남는다. 그 칸이 블랙홀이 되어 이웃 칸의 수를 모두 빨아들인다(누구의 수든).
//   - 남은 수의 합이 큰 쪽이 이긴다. 같으면 비긴다.
//   - 두 사람이 놓는 수는 똑같이 1부터 k까지라서 합도 같다. 그래서 빨려 들어간 합이 큰 쪽이 진다.
// 둔 수들(trail)은 놓은 칸의 차례이고, 미리 놓인 수 다음에 둘 차례인 쪽부터 번갈아 적는다.
//
// 풀이 프로그램: 끝까지 모든 수를 따진다. 지금 모습 대신 "빈칸들과, 빈칸마다 이웃에 놓인 수의 합(내 수는 더하고 선생님 수는 뺀다)"을
// 자리로 삼아 적어 둔다(끝에 남는 칸은 빈칸 가운데 하나이고, 끝 점수는 그 칸의 이 합으로만 정해지기 때문이다).
// 빈칸이 EXACT_LEFT개 이하일 때만 이렇게 끝까지 따진다(9칸 판은 처음부터, 15칸 판은 끝의 여덟 수만).
// 테스트에서 자리를 줄이지 않고 모든 차례를 하나하나 놓아 보는 다른 방법으로 다시 구해 견준다.
import { latestById } from './level.js';
import { createRng, randInt, seedFrom } from './rng.js';

export const SIDES = ['kid', 'teacher'];

/** 판의 줄 수(임시). 3줄(6칸)부터 5줄(15칸)까지 */
export const LIMITS = { min: 3, max: 5 };

/** 빈칸이 이만큼 이하이면 끝까지 모두 따진다(15칸 판에서 끝의 여덟 수. 2026-11-22 정함) */
export const EXACT_LEFT = 9;

/** 보통 선생님(fair)은 빈칸이 이만큼 이하가 되면 모두 따져서 둔다(끝의 세 수) */
export const FAIR_LEFT = 4;

/** 끝까지 둔 게임이 이만큼 쌓이면 "왜 그럴까?"가 열린다(임시) */
export const WHY_AFTER = 2;

const whole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

/** 다른 쪽 */
export const otherSide = (side) => (side === 'kid' ? 'teacher' : 'kid');

/** 판의 칸 수(돌이 놓인 칸까지) */
export const cellCount = (rows) => (rows * (rows + 1)) / 2;

/** 칸 번호 → [줄, 줄 안의 자리](둘 다 0부터) */
export function rowColOf(cell) {
  let r = 0;
  while (((r + 1) * (r + 2)) / 2 <= cell) r += 1;
  return [r, cell - (r * (r + 1)) / 2];
}

export const cellOf = (r, c) => (r * (r + 1)) / 2 + c;

/** 세모꼴 판에서 그 칸의 이웃 칸들(돌을 따지지 않는다) */
export function nearOf(rows, cell) {
  const [r, c] = rowColOf(cell);
  const list = [];
  for (const [a, b] of [[r - 1, c - 1], [r - 1, c], [r, c - 1], [r, c + 1], [r + 1, c], [r + 1, c + 1]]) {
    if (a >= 0 && a < rows && b >= 0 && b <= a) list.push(cellOf(a, b));
  }
  return list;
}

/** 판의 열린 칸(돌이 없는 칸) */
export function openCells(board) {
  const rocks = new Set(board.rocks);
  return Array.from({ length: cellCount(board.rows) }, (_, cell) => cell).filter((cell) => !rocks.has(cell));
}

/** 한 사람이 놓는 수의 개수 k(열린 칸이 2k + 1개) */
export const perSide = (board) => (openCells(board).length - 1) / 2;

/** 판으로 쓸 수 있는 값인가. 쓸 수 있으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'board';
  if (!whole(board.rows, LIMITS.min, LIMITS.max)) return 'rows';
  const total = cellCount(board.rows);
  const lists = [board.rocks, board.kid, board.teacher];
  if (!lists.every((list) => Array.isArray(list) && list.every((cell) => whole(cell, 0, total - 1)))) return 'cells';
  const all = lists.flat();
  if (new Set(all).size !== all.length) return 'overlap';
  if (board.rocks.some((cell, index) => index > 0 && board.rocks[index - 1] > cell)) return 'rocks';
  const open = total - board.rocks.length;
  if (open < 3 || open % 2 === 0) return 'odd';
  const per = (open - 1) / 2;
  const a = board.kid.length;
  const b = board.teacher.length;
  if (Math.abs(a - b) > 1) return 'turns';
  // 둘 수가 하나는 남아야 한다(빈칸이 둘 이상)
  if (a + b >= 2 * per) return 'full';
  if (board.first !== null && !SIDES.includes(board.first)) return 'first';
  // 미리 놓인 수가 한쪽에 하나 더 많으면 그쪽이 먼저 둔 것이다.
  if (a > b && board.first !== 'kid') return 'first';
  if (b > a && board.first !== 'teacher') return 'first';
  return null;
}

export const copyBoard = (board) => ({ rows: board.rows, rocks: [...board.rocks], kid: [...board.kid], teacher: [...board.teacher], first: board.first ?? null });

/** 판을 글자로 적는다(시드와 풀이 기록의 이름에 쓴다) */
export const boardKey = (board) => `${board.rows}-${board.rocks.join('.')}-${board.kid.join('.')}-${board.teacher.join('.')}-${board.first ?? 'choose'}`;

/** 판의 모양(줄 수와 돌)만 적은 이름. 풀이 프로그램이 적어 두는 표를 모양마다 따로 둔다 */
const shapeKey = (board) => `${board.rows}-${board.rocks.join('.')}`;

/** 미리 놓인 수 다음에 둘 차례인 쪽. 먼저 둘 쪽을 아직 고르지 않았으면 first를 건넨다 */
export function sideToMove(board, first = board.first) {
  const a = board.kid.length;
  const b = board.teacher.length;
  if (a > b) return 'teacher';
  if (b > a) return 'kid';
  return first;
}

// ---- 두기 ----

/**
 * 미리 놓인 수와 둔 수들을 처음부터 다시 둔다.
 * @param {object} board
 * @param {number[]} trail 놓은 칸들(미리 놓인 수 다음에 둘 차례인 쪽부터 번갈아)
 * @param {'kid'|'teacher'} first 먼저 두는 쪽(미리 놓인 수가 같은 개수일 때 다음에 둘 쪽을 정한다)
 * @returns {{ok, kid, teacher, empty, next, over, hole, swallowed, sums, lost, winner, moves, per}}
 *   ok        모두 둘 수 있는 수였는가(둘 수 없는 수를 만나면 그 앞까지의 모습이다)
 *   kid, teacher 지금 그쪽의 수가 놓인 칸(수 1부터 차례로)
 *   empty     빈칸들(작은 번호부터). next 둘 차례인 쪽(끝났으면 null)
 *   over      끝났는가. hole 블랙홀이 된 칸(끝나지 않았으면 null). swallowed 빨려 들어간 칸들
 *   sums      남은 수의 합 { kid, teacher }(끝나지 않았으면 놓인 수의 합). lost 빨려 들어간 합 { kid, teacher }
 *   winner    'kid' | 'teacher' | 'draw'(끝나지 않았으면 null). moves 둔 수들 { side, cell, number }
 */
export function replay(board, trail, first = board.first) {
  const per = perSide(board);
  const kid = [...board.kid];
  const teacher = [...board.teacher];
  const filled = new Set([...board.rocks, ...kid, ...teacher]);
  const moves = [];
  let side = sideToMove(board, first);
  let ok = Array.isArray(trail) && SIDES.includes(side);
  if (ok) {
    for (const cell of trail) {
      const done = kid.length === per && teacher.length === per;
      if (done || !whole(cell, 0, cellCount(board.rows) - 1) || filled.has(cell)) {
        ok = false;
        break;
      }
      const mine = side === 'kid' ? kid : teacher;
      mine.push(cell);
      filled.add(cell);
      moves.push({ side, cell, number: mine.length });
      side = otherSide(side);
    }
  }
  const empty = openCells(board).filter((cell) => !filled.has(cell));
  const over = kid.length === per && teacher.length === per;
  const sumOf = (cells, skip) => cells.reduce((sum, cell, index) => sum + (skip.has(cell) ? 0 : index + 1), 0);
  let hole = null;
  let swallowed = [];
  const none = new Set();
  let sums = { kid: sumOf(kid, none), teacher: sumOf(teacher, none) };
  let lost = { kid: 0, teacher: 0 };
  let winner = null;
  if (over) {
    hole = empty[0];
    const near = new Set(nearOf(board.rows, hole));
    swallowed = [...kid, ...teacher].filter((cell) => near.has(cell)).sort((x, y) => x - y);
    const gone = new Set(swallowed);
    const after = { kid: sumOf(kid, gone), teacher: sumOf(teacher, gone) };
    lost = { kid: sums.kid - after.kid, teacher: sums.teacher - after.teacher };
    sums = after;
    winner = sums.kid > sums.teacher ? 'kid' : sums.teacher > sums.kid ? 'teacher' : 'draw';
  }
  return { ok, kid, teacher, empty, next: over ? null : side, over, hole, swallowed, sums, lost, winner, moves, per };
}

// ---- 풀이 프로그램 ----

const tables = new Map();
/** 모양 하나의 표가 이만큼 커지면 비운다(기기의 기억을 너무 쓰지 않게) */
const TABLE_LIMIT = 400000;

function tableOf(board) {
  const key = shapeKey(board);
  if (!tables.has(key)) {
    const rocks = new Set(board.rocks);
    const total = cellCount(board.rows);
    const near = Array.from({ length: total }, (_, cell) => new Set(nearOf(board.rows, cell).filter((other) => !rocks.has(other))));
    tables.set(key, { near, memo: new Map(), open: total - board.rocks.length });
  }
  const table = tables.get(key);
  if (table.memo.size > TABLE_LIMIT) table.memo.clear();
  return table;
}

/**
 * 끝까지 따진 값: 둘 다 잘 두면 끝에 (내 합 - 선생님 합)이 얼마인가.
 * @param table 모양의 표
 * @param {number[]} empties 빈칸들(작은 번호부터)
 * @param {number[]} sums 빈칸마다 이웃에 놓인 수의 합(내 수는 +, 선생님 수는 -)
 * @param {'kid'|'teacher'} next 둘 차례인 쪽
 */
function exact(table, empties, sums, next) {
  if (empties.length === 1) return 0 - sums[0];
  const key = `${next[0]}${empties.join(',')}|${sums.join(',')}`;
  const known = table.memo.get(key);
  if (known !== undefined) return known;
  const placed = table.open - empties.length;
  const number = Math.floor(placed / 2) + 1;
  const signed = next === 'kid' ? number : -number;
  const after = otherSide(next);
  let best = next === 'kid' ? -Infinity : Infinity;
  for (let i = 0; i < empties.length; i++) {
    const cell = empties[i];
    const near = table.near[cell];
    const restCells = [];
    const restSums = [];
    for (let j = 0; j < empties.length; j++) {
      if (j === i) continue;
      restCells.push(empties[j]);
      restSums.push(sums[j] + (near.has(empties[j]) ? signed : 0));
    }
    const value = exact(table, restCells, restSums, after);
    if (next === 'kid' ? value > best : value < best) best = value;
  }
  table.memo.set(key, best);
  return best;
}

/** 빈칸마다 이웃에 놓인 수의 합(내 수는 +, 선생님 수는 -) */
function nearSums(table, now) {
  const value = new Map();
  now.kid.forEach((cell, index) => value.set(cell, index + 1));
  now.teacher.forEach((cell, index) => value.set(cell, -(index + 1)));
  return now.empty.map((hole) => {
    let sum = 0;
    for (const cell of table.near[hole]) sum += value.get(cell) ?? 0;
    return sum;
  });
}

/** 끝까지 따질 수 있는 자리인가(빈칸이 EXACT_LEFT개 이하) */
export const exactable = (now) => now.empty.length <= EXACT_LEFT;

/**
 * 이 자리에서 둘 다 잘 두면 끝에 (내 합 - 선생님 합)이 얼마인가. 끝난 자리면 그 값이다. 빈칸이 너무 많으면 null.
 */
export function valueAt(board, trail, first = board.first) {
  const now = replay(board, trail, first);
  if (!now.ok) return null;
  if (now.over) return now.sums.kid - now.sums.teacher;
  if (!exactable(now)) return null;
  const table = tableOf(board);
  return exact(table, now.empty, nearSums(table, now), now.next);
}

/**
 * 둘 차례인 쪽이 놓을 수 있는 칸마다, 거기에 놓은 뒤 둘 다 잘 두면 끝에 (내 합 - 선생님 합)이 얼마인가.
 * 빈칸이 너무 많으면 null.
 * @returns {{cell: number, value: number}[] | null}
 */
export function moveValues(board, trail, first = board.first) {
  const now = replay(board, trail, first);
  if (!now.ok || now.over || !exactable(now)) return null;
  return now.empty.map((cell) => ({ cell, value: valueAt(board, [...trail, cell], first) }));
}

/** 값을 아이 쪽에서 본 끝: 'win' | 'draw' | 'lose' */
export const outcomeOf = (value) => (value > 0 ? 'win' : value < 0 ? 'lose' : 'draw');

/**
 * 판을 푼다: 아이가 먼저 둘 때와 선생님이 먼저 둘 때, 둘 다 잘 두면 끝에 (내 합 - 선생님 합)이 얼마인가.
 * 미리 놓인 수 때문에 둘 차례가 정해진 판은 그 차례 하나만 있다. 빈칸이 너무 많아 끝까지 따질 수 없으면 exact가 false다.
 * @returns {{possible: true, exact: boolean, kid: number|null, teacher: number|null, value: number|null}}
 *   kid      먼저 둔 쪽이 아이일 때의 값(그런 차례가 없거나 따질 수 없으면 null). teacher 선생님일 때
 *            (미리 놓인 수가 같은 개수이면 "먼저 둔 쪽"이 다음에 둘 쪽이다)
 *   value    판에 먼저 둘 쪽이 정해져 있으면 그때의 값
 */
export function solve(board) {
  const empty = openCells(board).length - board.kid.length - board.teacher.length;
  const can = empty <= EXACT_LEFT;
  // 미리 놓인 수가 같은 개수이면 어느 쪽이 먼저든 따지고, 아니면 판이 정한 먼저 둔 쪽 하나만 따진다.
  const turns = board.kid.length === board.teacher.length ? SIDES : [board.first];
  const valueWhen = (first) => (can && turns.includes(first) ? valueAt({ ...board, first }, [], first) : null);
  const kid = valueWhen('kid');
  const teacher = valueWhen('teacher');
  const first = board.first ?? null;
  return { possible: true, exact: can, kid, teacher, value: first === null ? null : first === 'kid' ? kid : teacher };
}

/** 아이가 먼저 두면(first가 'kid') 또는 나중에 두면, 둘 다 잘 두면 아이는 어떻게 되는가. 모르면 null */
export function seatOutcome(solution, first) {
  const value = solution[first];
  return value === null || value === undefined ? null : outcomeOf(value);
}

// ---- 선생님(컴퓨터)과 두기 ----

/**
 * 어림 값: 빈칸마다 "여기가 블랙홀이 되면 (내 합 - 선생님 합)이 얼마나 바뀌는가"(-합)를 모두 더한 것.
 * 끝까지 따지지 못하는 큰 판의 앞쪽 수에 쓴다. 빈칸을 고르게 본다(어느 칸이 남을지 모르니까).
 */
function roughValue(table, empties, sums) {
  let total = 0;
  for (let i = 0; i < empties.length; i++) total -= sums[i];
  return total / empties.length;
}

/** 어림으로 칸마다 매긴 값(놓는 쪽에서 본 값. 클수록 좋다) */
function roughScores(board, now) {
  const table = tableOf(board);
  const sums = nearSums(table, now);
  const placed = table.open - now.empty.length;
  const number = Math.floor(placed / 2) + 1;
  const signed = now.next === 'kid' ? number : -number;
  return now.empty.map((cell, i) => {
    const near = table.near[cell];
    const rest = [];
    const restSums = [];
    now.empty.forEach((other, j) => {
      if (j === i) return;
      rest.push(other);
      restSums.push(sums[j] + (near.has(other) ? signed : 0));
    });
    const value = roughValue(table, rest, restSums);
    return { cell, score: now.next === 'kid' ? value : -value };
  });
}

/** 선생님이 두는 법(사다리에서 정한다) */
export const TEACHERS = ['easy', 'fair', 'best'];

/**
 * 컴퓨터가 두는 수(놓을 칸). 더 둘 수 없으면 null.
 *   easy  빈칸 가운데 아무 칸이나 시드 난수로 고른다
 *   fair  빈칸이 FAIR_LEFT개 이하이면 best처럼, 그보다 많으면 어림으로 둔다
 *   best  빈칸이 EXACT_LEFT개 이하이면 끝까지 따져서 가장 좋은 수(합의 차가 가장 크게)를 둔다. 그보다 많으면 어림으로 둔다
 *   어림: 빈칸마다 "여기가 블랙홀이면 차가 얼마인가"의 평균이 내게 가장 좋아지는 칸
 * 그래도 여럿이면 시드 난수로 고른다.
 */
export function pickMove(board, trail, first, rng, teacher = 'best') {
  const now = replay(board, trail, first);
  if (!now.ok || now.over) return null;
  const choose = (list) => list[randInt(rng, 0, list.length - 1)];
  if (teacher === 'easy') return choose(now.empty);
  const careful = teacher === 'best' ? exactable(now) : now.empty.length <= FAIR_LEFT;
  if (careful) {
    const values = moveValues(board, trail, first);
    const mine = (value) => (now.next === 'kid' ? value : -value);
    const top = Math.max(...values.map((item) => mine(item.value)));
    return choose(values.filter((item) => mine(item.value) === top).map((item) => item.cell));
  }
  const scores = roughScores(board, now);
  const top = Math.max(...scores.map((item) => item.score));
  return choose(scores.filter((item) => item.score === top).map((item) => item.cell));
}

/**
 * 선생님의 다음 수. 같은 (단계, 판 번호, 먼저 두는 쪽, 선생님이 두는 법, 지금까지 둔 수들)이면 늘 같은 수를 둔다.
 * 직접 만든 판과 작은 판은 판 번호가 없으므로 판의 모습을 시드로 쓴다.
 */
export function teacherMove(board, trail, { level = null, seed = null, first = 'kid', teacher = 'best' } = {}) {
  const now = replay(board, trail, first);
  if (!now.ok || now.over || now.next !== 'teacher') return null;
  const rng = createRng(seedFrom('blackhole-move', level ?? 'make', seed ?? boardKey(board), first, teacher, trail.join(',')));
  return pickMove(board, trail, first, rng, teacher);
}

const rank = { win: 2, draw: 1, lose: 0 };

/**
 * 아이가 잘 두면 갈 수 있던 끝보다 나쁜 자리로 보낸 수(이기는 자리에서 비기거나 지는 자리로, 비기는 자리에서 지는 자리로).
 * 몇 번째 수인지(1부터)의 목록이다. 끝까지 따질 수 있는 자리(빈칸이 EXACT_LEFT개 이하)에서 둔 수만 본다.
 */
export function slipsOf(board, trail, first) {
  const slips = [];
  for (let index = 0; index < trail.length; index++) {
    const before = trail.slice(0, index);
    const now = replay(board, before, first);
    if (!now.ok || now.over) break;
    if (now.next !== 'kid' || !exactable(now)) continue;
    const after = [...before, trail[index]];
    if (!replay(board, after, first).ok) break;
    if (rank[outcomeOf(valueAt(board, after, first))] < rank[outcomeOf(valueAt(board, before, first))]) slips.push(index + 1);
  }
  return slips;
}

// ---- 지난 기록: "왜 그럴까?"가 열리는 때, 연달아 진 판 ----

/** 끝까지 둔 게임들(오래된 것부터). 이긴 판도 진 판도 비긴 판도 들어간다. 작은 판(곁판)은 세지 않는다 */
function finishedGames(records) {
  if (!Array.isArray(records)) return [];
  return latestById(records).filter(
    (record) => record.kind === 'round' && record.format === 'blackhole' && record.side !== true && record.outcome === 'solved' && SIDES.concat('draw').includes(record.winner),
  );
}

/** 끝까지 둔 게임의 수 */
export function finishedCount(records) {
  return finishedGames(records).length;
}

/** "왜 그럴까?"를 열어도 되는가: 게임을 WHY_AFTER판 끝까지 둔 뒤에 열린다(임시) */
export function whyOpen(records) {
  return finishedCount(records) >= WHY_AFTER;
}

/** 맨 뒤에서부터 연달아 진 게임의 수. 화면에 보여 주지 않는다. 자리를 바꿔 보기를 권할 때만 쓴다 */
export function lostStreak(records) {
  const games = finishedGames(records);
  let streak = 0;
  while (streak < games.length && games[games.length - 1 - streak].winner === 'teacher') streak += 1;
  return streak;
}
