// 주사위 미로와 길 세기: 판과 규칙, 손님 보내기(시드 난수 주사위), 길의 수를 세는 풀이 프로그램. 순수 함수만 둔다.
//
// 판은 세모꼴로 놓인 갈림길이다. 맨 위 갈림길(0줄)에서 손님이 출발하고, 갈림길마다 왼쪽 아래나 오른쪽 아래로 내려간다.
// 갈림길이 rows줄(0줄 ~ rows−1줄)이면 맨 아래 rows줄에 출구가 rows+1개 있다.
// 칸 번호는 위에서부터 줄마다 왼쪽부터 센다: (r줄, 왼쪽에서 i번째) → r(r+1)/2 + i. 출구도 칸이다(맨 아래 줄).
// 칸 번호는 판의 줄 수와 상관없이 (r, i)로만 정해진다. 그래서 작은 판으로 줄여도 같은 자리의 칸 번호가 같다.
// 막힌 갈림길(돌)은 지나갈 수 없다. 길을 셀 때 막힌 칸은 0으로 센다. 손님은 막힌 갈림길에 닿으면 거기서 멈춘다.
//
// 판의 종류(kind):
//   busy   어느 출구로 손님이 가장 많이 갈지 고르고 손님을 보낸다(실험)
//   count  칸마다 오는 길의 수를 자물쇠에 넣는다. ask가 정한 칸이 모두 열리면 끝난다
//          target 표시한 출구 하나, all 맨 위를 뺀 모든 칸, exits 모든 출구(직접 만든 판)
//   even   길의 수가 짝수인 칸을 모두 칠한다
//
// 주사위: 갈림길마다 1~6 가운데 하나가 고르게 나온다. 1, 2, 3이면 왼쪽, 4, 5, 6이면 오른쪽이다(반반).
// 무작위 수는 시드 난수(rng.js)만 쓴다. 같은 시드는 늘 같은 손님들을 보낸다.
import { createRng, randInt } from './rng.js';

export const KINDS = ['busy', 'count', 'even'];
export const ASKS = ['target', 'all', 'exits'];
/** 판의 줄 수(갈림길의 줄)의 아래 끝과 위 끝. 위 끝에서 칸은 45개, 출구는 9개다 */
export const LIMITS = { minRows: 2, maxRows: 8 };
/** 한 번에 보내는 손님 수: 한 명(주사위를 보며 따라간다)과 백 명 */
export const SEND_SIZES = [1, 100];
/** 판이 끝나는 때: 출구를 고른 뒤 손님을 모두 이만큼 보냈을 때(실험 판) */
export const FINISH_GUESTS = 100;
/** "왜 그럴까?": 실험 판과 세는 판을 한 번씩 끝까지 한 뒤에 열린다(임시) */
export const WHY_NEEDS = ['busy', 'count'];

export const cellCount = (rows) => ((rows + 1) * (rows + 2)) / 2;
export const cellAt = (r, i) => (r * (r + 1)) / 2 + i;

/** 칸 번호 → 줄과 왼쪽에서의 자리 */
export function rowCol(cell) {
  let r = 0;
  while (cellAt(r + 1, 0) <= cell) r += 1;
  return { r, i: cell - cellAt(r, 0) };
}

export const exitCell = (rows, k) => cellAt(rows, k);
export const isExit = (rows, cell) => rowCol(cell).r === rows;

/** 갈림길의 두 아래 칸(왼쪽, 오른쪽). 출구에서는 빈 목록 */
export function childrenOf(rows, cell) {
  const { r, i } = rowCol(cell);
  if (r >= rows) return [];
  return [cellAt(r + 1, i), cellAt(r + 1, i + 1)];
}

/** 칸의 바로 위 칸들(한 칸이나 두 칸). 맨 위 칸에는 없다 */
export function parentsOf(cell) {
  const { r, i } = rowCol(cell);
  if (r === 0) return [];
  const list = [];
  if (i > 0) list.push(cellAt(r - 1, i - 1));
  if (i < r) list.push(cellAt(r - 1, i));
  return list;
}

/** 막을 수 있는 칸: 맨 위와 출구를 뺀 갈림길 */
export function blockableCells(rows) {
  const cells = [];
  for (let r = 1; r < rows; r++) for (let i = 0; i <= r; i++) cells.push(cellAt(r, i));
  return cells;
}

/** 판이 규격에 맞는지 본다. 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  if (!KINDS.includes(board.kind)) return 'kind';
  if (!Number.isInteger(board.rows) || board.rows < LIMITS.minRows || board.rows > LIMITS.maxRows) return 'rows';
  if (!Array.isArray(board.blocked)) return 'blocked';
  const allowed = new Set(blockableCells(board.rows));
  if (!board.blocked.every((cell) => allowed.has(cell))) return 'blocked';
  if (new Set(board.blocked).size !== board.blocked.length) return 'blocked';
  if (board.kind === 'count') {
    if (!ASKS.includes(board.ask)) return 'ask';
    if (board.ask === 'target') {
      if (!Number.isInteger(board.target) || board.target < 0 || board.target > board.rows) return 'target';
      if (countPaths(board)[exitCell(board.rows, board.target)] === 0) return 'target';
    } else if (board.target !== null) return 'target';
    if (board.ask === 'exits' && exitCounts(board).every((count) => count === 0)) return 'closed';
  } else {
    if (board.ask !== null || board.target !== null) return 'ask';
    if (board.kind === 'even' && board.blocked.length > 0) return 'blocked';
  }
  if (board.kind === 'busy' && exitCounts(board).every((count) => count === 0)) return 'closed';
  return null;
}

export const copyBoard = (board) => ({ kind: board.kind, rows: board.rows, blocked: board.blocked.slice().sort((a, b) => a - b), target: board.target, ask: board.ask });

/** 풀이 프로그램: 칸마다 맨 위에서 그 칸까지 오는 길의 수. 막힌 칸은 0이다(위 두 칸의 합) */
export function countPaths(board) {
  const blocked = new Set(board.blocked);
  const counts = new Array(cellCount(board.rows)).fill(0);
  counts[0] = 1;
  for (let r = 1; r <= board.rows; r++) {
    for (let i = 0; i <= r; i++) {
      const cell = cellAt(r, i);
      if (blocked.has(cell)) continue;
      counts[cell] = parentsOf(cell).reduce((sum, parent) => sum + counts[parent], 0);
    }
  }
  return counts;
}

/** 출구마다 오는 길의 수 */
export function exitCounts(board) {
  const counts = countPaths(board);
  return Array.from({ length: board.rows + 1 }, (_, k) => counts[exitCell(board.rows, k)]);
}

/** 길의 수가 가장 많은 출구들 */
export function busiestExits(board) {
  const exits = exitCounts(board);
  const max = Math.max(...exits);
  return exits.map((count, k) => (count === max ? k : -1)).filter((k) => k >= 0);
}

/** 자물쇠를 열어야 하는 칸들(이 칸이 모두 열리면 판이 끝난다) */
export function askedCells(board) {
  if (board.kind !== 'count') return [];
  if (board.ask === 'target') return [exitCell(board.rows, board.target)];
  if (board.ask === 'exits') return Array.from({ length: board.rows + 1 }, (_, k) => exitCell(board.rows, k));
  const blocked = new Set(board.blocked);
  return Array.from({ length: cellCount(board.rows) }, (_, cell) => cell).filter((cell) => cell !== 0 && !blocked.has(cell));
}

/** 자물쇠가 있는 칸: 맨 위(처음부터 열려 있다)와 막힌 칸을 뺀 모든 칸. 세는 판과 짝수 판에서 쓴다 */
export function lockCells(board) {
  const blocked = new Set(board.blocked);
  return Array.from({ length: cellCount(board.rows) }, (_, cell) => cell).filter((cell) => cell !== 0 && !blocked.has(cell));
}

/** 길의 수가 짝수인 칸들(막힌 칸은 빼고) */
export function evenCells(board) {
  const blocked = new Set(board.blocked);
  return countPaths(board)
    .map((count, cell) => (count % 2 === 0 && !blocked.has(cell) ? cell : -1))
    .filter((cell) => cell >= 0);
}

/** 판의 풀이: 칸마다의 길의 수, 출구마다의 수, 가장 붐빌 출구, 짝수 칸, 열어야 할 칸 */
export function solve(board) {
  const counts = countPaths(board);
  const exits = exitCounts(board);
  return {
    possible: true,
    counts,
    exits,
    total: exits.reduce((sum, count) => sum + count, 0),
    busiest: busiestExits(board),
    evens: evenCells(board),
    asked: askedCells(board),
    answer: board.kind === 'count' && board.ask === 'target' ? counts[exitCell(board.rows, board.target)] : null,
  };
}

// ---- 길: 'L'(왼쪽)과 'R'(오른쪽)의 글자 줄. 맨 위에서 출발한다 ----

/** 길이 닿는 칸. 막힌 칸을 지나거나(끝 칸이 막힌 칸이어도) 판 밖으로 나가면 null */
export function pathCell(board, path) {
  if (typeof path !== 'string' || !/^[LR]*$/.test(path) || path.length > board.rows) return null;
  const blocked = new Set(board.blocked);
  let i = 0;
  for (let r = 1; r <= path.length; r++) {
    if (path[r - 1] === 'R') i += 1;
    if (blocked.has(cellAt(r, i))) return null;
  }
  return cellAt(path.length, i);
}

/** 맨 위에서 그 칸까지 가는 모든 길(왼쪽이 먼저인 차례). 그 칸의 길의 수만큼 나온다 */
export function pathsTo(board, cell) {
  const { r, i } = rowCol(cell);
  const found = [];
  const walk = (path) => {
    if (path.length === r) {
      if (pathCell(board, path) === cell) found.push(path);
      return;
    }
    const rights = [...path].filter((step) => step === 'R').length;
    // 오른쪽으로 i번보다 많이 가거나, 남은 걸음으로 i번을 못 채우면 그 칸에 닿지 못한다.
    if (rights <= i && rights + (r - path.length) >= i && pathCell(board, path) !== null) {
      walk(`${path}L`);
      walk(`${path}R`);
    }
  };
  walk('');
  return found;
}

/** 길을 차례대로 줄 세운다(짧은 것 먼저, 같은 길이면 왼쪽이 먼저) */
export const sortPaths = (paths) => paths.slice().sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));

/** 그리던 길(path)에서 칸 하나를 눌렀을 때: 바로 아래 두 칸 가운데 하나면 길이 늘고, 길 위의 칸이면 거기까지로 줄어든다 */
export function stepPath(board, path, cell) {
  const end = pathCell(board, path);
  if (end === null) return { ok: false, why: 'broken', path };
  // 길 위의 칸: 거기까지로 되돌린다
  for (let length = 0; length <= path.length; length++) {
    if (pathCell(board, path.slice(0, length)) === cell) return { ok: true, path: path.slice(0, length), back: length < path.length, same: length === path.length };
  }
  const [left, right] = childrenOf(board.rows, end);
  if (cell !== left && cell !== right) return { ok: false, why: 'far', path };
  if (board.blocked.includes(cell)) return { ok: false, why: 'blocked', path };
  return { ok: true, path: `${path}${cell === left ? 'L' : 'R'}`, back: false, same: false };
}

// ---- 손님 보내기 ----

/** 주사위 한 번: 1~6이 고르게 나온다 */
export const rollDie = (rng) => randInt(rng, 1, 6);
/** 주사위 눈 → 가는 쪽. 1, 2, 3은 왼쪽, 4, 5, 6은 오른쪽 */
export const sideOf = (roll) => (roll <= 3 ? 'L' : 'R');

/** 손님 한 명이 내려간다. 갈림길마다 주사위를 굴린다. 막힌 갈림길에 닿으면 거기서 멈춘다 */
export function walkGuest(board, rng) {
  const blocked = new Set(board.blocked);
  const rolls = [];
  const cells = [0];
  let i = 0;
  for (let r = 1; r <= board.rows; r++) {
    const roll = rollDie(rng);
    rolls.push(roll);
    if (sideOf(roll) === 'R') i += 1;
    const cell = cellAt(r, i);
    cells.push(cell);
    if (blocked.has(cell)) return { rolls, cells, end: cell, exit: null };
  }
  return { rolls, cells, end: cells.at(-1), exit: i };
}

/**
 * 손님 n명을 보낸다. 같은 (판, n, 시드)는 늘 같은 결과다.
 * @returns {{ends: number[], walks: object[]}} ends: 칸마다 거기서 끝난 손님 수(출구와 막힌 칸), walks: 한 명씩의 길(n이 1일 때만)
 */
export function sendGuests(board, n, seed) {
  const rng = createRng(seed);
  const ends = new Array(cellCount(board.rows)).fill(0);
  const walks = [];
  for (let guest = 0; guest < n; guest++) {
    const walk = walkGuest(board, rng);
    ends[walk.end] += 1;
    if (n === 1) walks.push(walk);
  }
  return { ends, walks };
}

/** 보낸 손님들({n, seed}의 목록)을 다시 보내 본 결과: 칸마다 끝난 손님 수 */
export function replaySends(board, sends) {
  const ends = new Array(cellCount(board.rows)).fill(0);
  for (const send of sends) {
    const result = sendGuests(board, send.n, send.seed);
    result.ends.forEach((count, cell) => {
      ends[cell] += count;
    });
  }
  return ends;
}

/** 칸마다 끝난 손님 수 → 출구마다의 손님 수 */
export const exitTally = (board, ends) => Array.from({ length: board.rows + 1 }, (_, k) => ends[exitCell(board.rows, k)] ?? 0);

/** 손님이 가장 많이 간 출구들과 그 수. 아무도 안 갔으면 빈 목록 */
export function topExits(tally) {
  const max = Math.max(...tally);
  if (max <= 0) return { exits: [], max: 0 };
  return { exits: tally.map((count, k) => (count === max ? k : -1)).filter((k) => k >= 0), max };
}

// ---- 답 ----

/**
 * 자물쇠에 수 하나를 넣었다. 맞으면 열린다. 틀리면 짐작을 낸다.
 *   too-few  정답보다 작다(빠뜨린 길이 있는 것 같다)
 *   too-many 정답보다 크다(두 번 센 길이 있는 것 같다)
 *   none     그 칸까지 오는 길이 없는데 수를 넣었다
 */
export function checkLock(counts, cell, value) {
  const truth = counts[cell];
  if (value === truth) return { correct: true, guess: null };
  if (truth === 0) return { correct: false, guess: 'none' };
  return { correct: false, guess: value < truth ? 'too-few' : 'too-many' };
}

/**
 * 칠한 칸이 짝수 칸과 꼭 같은가. 다르면 짐작 하나를 낸다(한 번에 한 가지만 말한다).
 *   odd   짝수가 아닌 칸을 칠했다(이것을 먼저 말한다)
 *   miss  빠뜨린 짝수 칸이 있다
 */
export function checkPaint(board, painted) {
  const evens = new Set(evenCells(board));
  const mine = new Set(painted);
  const odd = [...mine].filter((cell) => !evens.has(cell)).sort((a, b) => a - b);
  const miss = [...evens].filter((cell) => !mine.has(cell)).sort((a, b) => a - b);
  if (odd.length > 0) return { correct: false, guess: 'odd', odd, miss };
  if (miss.length > 0) return { correct: false, guess: 'miss', odd, miss };
  return { correct: true, guess: null, odd, miss };
}

// ---- 더 작은 판 ----

/**
 * 같은 종류의 더 작은 판들. 원래 판에 가까운 것(줄이 많은 것)부터 낸다.
 *   실험 판은 줄을 줄인다(2줄까지). 짝수 판은 3줄까지.
 *   표시한 출구가 있는 판은 출구의 자리를 비슷하게 옮기고, 길이 둘 이상인 출구만 표시한다.
 *   막힌 갈림길은 작은 판에도 들어가는 것만 남긴다. 막힌 갈림길이 있던 판은 작은 판에도 막힌 갈림길이 하나는 남아 길의 수를 바꿔야 한다.
 */
export function smallBoards(board) {
  const list = [];
  const floor = board.kind === 'even' ? 3 : 2;
  for (let rows = board.rows - 1; rows >= floor; rows--) {
    const blocked = board.blocked.filter((cell) => rowCol(cell).r < rows);
    if (board.kind !== 'count') {
      list.push({ kind: board.kind, rows, blocked: [], target: null, ask: null });
      continue;
    }
    const base = { kind: 'count', rows, blocked, target: null, ask: board.ask };
    if (board.blocked.length > 0) {
      // 막힌 갈림길이 남아서 어느 출구의 길의 수를 바꾸는 판만 낸다.
      const plain = exitCounts({ ...base, blocked: [] });
      const now = exitCounts(base);
      if (blocked.length === 0 || now.every((count, k) => count === plain[k])) continue;
      if (board.ask === 'target') {
        // 길의 수가 막혀서 바뀐 출구 가운데 길이 가장 많은 것(같으면 왼쪽)
        const changed = now.map((count, k) => (count !== plain[k] && count >= 2 ? k : -1)).filter((k) => k >= 0);
        if (changed.length === 0) continue;
        const target = changed.reduce((best, k) => (now[k] > now[best] ? k : best), changed[0]);
        list.push({ ...base, target });
      } else if (now.some((count) => count > 0)) list.push(base);
      continue;
    }
    if (board.ask === 'target') {
      const target = Math.min(rows - 1, Math.max(1, Math.round((board.target * rows) / board.rows)));
      list.push({ ...base, target });
    } else list.push(base);
  }
  return list.filter((small) => checkBoard(small) === null);
}

// ---- "왜 그럴까?" ----

const finishedOf = (records, mode) =>
  (Array.isArray(records) ? records : []).some(
    (record) => record && record.kind === 'round' && record.format === 'maze' && record.side !== true && record.outcome === 'solved' && (mode === 'count' ? record.mode === 'count' || record.mode === 'even' : record.mode === mode),
  );

/** 실험 판(busy)과 세는 판(count 또는 even)을 한 번씩 끝까지 한 뒤에 열린다(작은 판은 세지 않는다) */
export function whyOpen(records) {
  return WHY_NEEDS.every((mode) => finishedOf(records, mode));
}
