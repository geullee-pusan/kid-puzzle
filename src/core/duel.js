// 누가 이길까: 선생님(컴퓨터)과 번갈아 두는 게임의 규칙과 풀이 프로그램. 순수 함수만 둔다.
// 모든 게임에서 마지막 수를 둔 쪽이 이긴다(더 둘 수 없는 쪽이 진다).
//
// 게임은 넷이고, 판(board)의 꼴은 셋이다.
//   초콜릿 쪼개기  { kind: 'choco', w, h }       조각 하나를 금을 따라 곧게 둘로 쪼갠다
//   한 더미        { kind: 'one', n, max }       돌 n개에서 한 번에 1개부터 max개까지 가져간다
//   두 더미·세 더미 { kind: 'piles', piles: [..] } 한 더미에서만, 원하는 만큼(1개 이상) 가져간다
//
// 자리(state)
//   초콜릿: 조각들의 목록. 조각 하나는 { x, y, w, h }(처음 판에서의 자리와 크기)
//   돌:     더미마다 남은 돌의 수(한 더미 게임도 수 하나짜리 목록이다)
// 수(move)
//   초콜릿: { piece, dir, at }  piece번째 조각을 세로 금('v')이나 가로 금('h')을 따라 쪼갠다. at은 그 조각의 왼쪽(위)에서 몇 칸째 금인지
//   돌:     { pile, take }      pile번째 더미에서 take개를 가져간다
//
// 풀이 프로그램은 지름길 규칙을 쓰지 않는다. 더 둘 수 없는 자리(둘 차례인 쪽이 진다)에서 시작해
// "지는 자리로 보낼 수 있으면 이기는 자리, 어디로 가도 이기는 자리뿐이면 지는 자리"를 끝에서부터 따진다.
// 지름길 규칙(칸의 수의 홀짝, 나머지, 같은 두 더미, 이진법)은 테스트에서 이 결과와 견준다.
import { latestById } from './level.js';
import { createRng, randInt, seedFrom } from './rng.js';

/** 게임의 이름표. 힌트와 "왜 그럴까?"는 게임마다 따로다 */
export const GAMES = ['choco', 'one', 'two', 'three'];

/** 직접 만들기에서 고를 수 있는 수(임시). 풀이 프로그램이 모든 자리를 따질 수 있는 크기만 넣는다 */
export const LIMITS = {
  choco: { min: 1, max: 5 },
  one: { min: 1, max: 25 },
  take: { min: 1, max: 4 },
  piles: { min: 2, max: 3 },
  pile: { min: 1, max: 9 },
};

/** 그 게임을 몇 판 끝까지 둔 뒤에 "왜 그럴까?"가 열리는가(임시) */
export const WHY_AFTER = 3;

/** 작은 판으로 두어 보기에서 내는 판의 수의 위 끝(임시) */
export const SMALL_COUNT = 6;

const whole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

/** 판으로 쓸 수 있는 값인가. 쓸 수 있으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'board';
  if (board.kind === 'choco') return whole(board.w, LIMITS.choco.min, LIMITS.choco.max) && whole(board.h, LIMITS.choco.min, LIMITS.choco.max) ? null : 'size';
  if (board.kind === 'one') return whole(board.n, LIMITS.one.min, LIMITS.one.max) && whole(board.max, LIMITS.take.min, LIMITS.take.max) ? null : 'count';
  if (board.kind === 'piles') {
    if (!Array.isArray(board.piles) || !whole(board.piles.length, LIMITS.piles.min, LIMITS.piles.max)) return 'piles';
    return board.piles.every((count) => whole(count, LIMITS.pile.min, LIMITS.pile.max)) ? null : 'count';
  }
  return 'kind';
}

export function copyBoard(board) {
  if (board.kind === 'choco') return { kind: 'choco', w: board.w, h: board.h };
  if (board.kind === 'one') return { kind: 'one', n: board.n, max: board.max };
  return { kind: 'piles', piles: board.piles.slice() };
}

/** 이 판의 게임 */
export function gameOf(board) {
  if (board.kind === 'piles') return board.piles.length === 2 ? 'two' : 'three';
  return board.kind;
}

/** 판을 글자로 적는다(시드와 견주기에 쓴다) */
export function boardKey(board) {
  if (board.kind === 'choco') return `choco-${board.w}x${board.h}`;
  if (board.kind === 'one') return `one-${board.n}-${board.max}`;
  return `piles-${board.piles.join('-')}`;
}

/** 수를 글자로 적는다 */
export function moveKey(move) {
  return 'take' in move ? `${move.pile}-${move.take}` : `${move.piece}${move.dir}${move.at}`;
}

/** 처음 자리 */
export function startState(board) {
  if (board.kind === 'choco') return [{ x: 0, y: 0, w: board.w, h: board.h }];
  if (board.kind === 'one') return [board.n];
  return board.piles.slice();
}

/** 이 자리에서 둘 수 있는 수 모두 */
export function movesOf(board, state) {
  const moves = [];
  if (board.kind === 'choco') {
    state.forEach((piece, index) => {
      for (let at = 1; at < piece.w; at++) moves.push({ piece: index, dir: 'v', at });
      for (let at = 1; at < piece.h; at++) moves.push({ piece: index, dir: 'h', at });
    });
    return moves;
  }
  const most = board.kind === 'one' ? board.max : Infinity;
  state.forEach((count, pile) => {
    for (let take = 1; take <= Math.min(count, most); take++) moves.push({ pile, take });
  });
  return moves;
}

/** 수 하나를 둔 다음의 자리. 둘 수 없는 수면 null */
export function applyMove(board, state, move) {
  if (!move || typeof move !== 'object') return null;
  if (board.kind === 'choco') {
    const piece = state[move.piece];
    if (!piece || !Number.isInteger(move.at) || move.at < 1) return null;
    let parts;
    if (move.dir === 'v' && move.at < piece.w) {
      parts = [
        { x: piece.x, y: piece.y, w: move.at, h: piece.h },
        { x: piece.x + move.at, y: piece.y, w: piece.w - move.at, h: piece.h },
      ];
    } else if (move.dir === 'h' && move.at < piece.h) {
      parts = [
        { x: piece.x, y: piece.y, w: piece.w, h: move.at },
        { x: piece.x, y: piece.y + move.at, w: piece.w, h: piece.h - move.at },
      ];
    } else return null;
    // 쪼갠 두 조각은 원래 조각의 자리에 차례로 들어간다.
    return [...state.slice(0, move.piece), ...parts, ...state.slice(move.piece + 1)];
  }
  const count = state[move.pile];
  const most = board.kind === 'one' ? board.max : Infinity;
  if (!Number.isInteger(count) || !Number.isInteger(move.take) || move.take < 1 || move.take > Math.min(count, most)) return null;
  return state.map((item, pile) => (pile === move.pile ? item - move.take : item));
}

// ---- 풀이 프로그램: 자리를 이름만 다른 것끼리 하나로 묶어(조각의 자리, 더미의 차례는 승패와 상관없다) 끝에서부터 따진다 ----

/** 풀이 프로그램이 쓰는 자리의 꼴: 수들의 목록(작은 것부터). 초콜릿은 조각의 크기(짧은 쪽 × 10 + 긴 쪽), 돌은 남은 돌의 수 */
function positionOf(board, state) {
  if (board.kind === 'choco') {
    return state
      .filter((piece) => piece.w * piece.h > 1)
      .map((piece) => Math.min(piece.w, piece.h) * 10 + Math.max(piece.w, piece.h))
      .sort((a, b) => a - b);
  }
  return state.filter((count) => count > 0).sort((a, b) => a - b);
}

const familyOf = (board) => (board.kind === 'one' ? `one${board.max}` : board.kind);
const shape = (a, b) => Math.min(a, b) * 10 + Math.max(a, b);
const without = (list, index, extra) => [...list.slice(0, index), ...list.slice(index + 1), ...extra].sort((a, b) => a - b);

/**
 * 수 하나를 둔 다음의 자리 모두. 실제로 둘 수 있는 수마다 하나씩 낸다(같은 자리가 여러 번 나올 수 있다).
 * 아무렇게나 두었을 때의 비율을 구할 때 이 겹침이 그대로 쓰인다.
 */
function nextPositions(kind, max, position) {
  const found = [];
  position.forEach((item, index) => {
    if (kind === 'choco') {
      const a = Math.floor(item / 10);
      const b = item % 10;
      // 한 변을 가르는 금마다 하나씩. 한 칸짜리 조각(11)은 더 쪼갤 수 없어서 자리에 적지 않는다.
      const parts = (side, other) => {
        for (let at = 1; at < side; at++) found.push(without(position, index, [shape(at, other), shape(side - at, other)].filter((code) => code !== 11)));
      };
      parts(a, b);
      parts(b, a);
    } else {
      for (let take = 1; take <= Math.min(item, max); take++) found.push(without(position, index, item > take ? [item - take] : []));
    }
  });
  return found;
}

const winMemo = new Map();

/** 이 자리에서 둘 차례인 쪽이 이기는가. 한 번 따진 자리는 적어 둔다. */
function winAt(family, kind, max, position) {
  const id = `${family}|${position.join(',')}`;
  const known = winMemo.get(id);
  if (known !== undefined) return known;
  // 더 둘 수 없으면(다음 자리가 없으면) 둘 차례인 쪽이 진다. 지는 자리로 보낼 수 있으면 이기는 자리다.
  let win = false;
  for (const next of nextPositions(kind, max, position)) {
    if (!winAt(family, kind, max, next)) {
      win = true;
      break;
    }
  }
  winMemo.set(id, win);
  return win;
}

const maxOf = (board) => (board.kind === 'one' ? board.max : Infinity);

/** 둘 차례인 쪽이 이기는 자리인가(끝에서부터 따진 결과) */
export function isWin(board, state) {
  return winAt(familyOf(board), board.kind, maxOf(board), positionOf(board, state));
}

/** 더 둘 수 없는 자리인가 */
export function isOver(board, state) {
  return movesOf(board, state).length === 0;
}

/** 이기는 수의 목록: 상대를 지는 자리로 보내는 수들. 지는 자리에서는 빈 목록이다 */
export function winningMoves(board, state) {
  return movesOf(board, state).filter((move) => !isWin(board, applyMove(board, state, move)));
}

/**
 * 판에서 나올 수 있는 모든 자리의 승패. 열쇠는 자리를 적은 글자, 값은 둘 차례인 쪽이 이기는지다.
 * (자리의 이름만 다른 것은 하나로 묶는다.)
 */
export function allPositions(board) {
  const family = familyOf(board);
  const max = maxOf(board);
  const seen = new Map();
  const queue = [positionOf(board, startState(board))];
  while (queue.length > 0) {
    const position = queue.pop();
    const key = position.join(',');
    if (seen.has(key)) continue;
    seen.set(key, winAt(family, board.kind, max, position));
    for (const next of nextPositions(board.kind, max, position)) queue.push(next);
  }
  return seen;
}

/**
 * 판을 푼다: 둘 다 잘 두었을 때 어느 쪽이 이기는가.
 * @returns {{first: boolean, winner: 'first'|'second', moves: object[], positions: number}}
 *   first      먼저 두는 쪽이 이기는가
 *   moves      먼저 두는 쪽의 이기는 첫 수들(나중에 두는 쪽이 이기는 판이면 빈 목록)
 *   positions  따져 본 자리의 수
 */
export function solve(board) {
  const state = startState(board);
  const first = isWin(board, state);
  return { first, winner: first ? 'first' : 'second', moves: winningMoves(board, state), positions: allPositions(board).size };
}

// ---- 두기 ----

/** 다른 쪽 */
export const otherOf = (who) => (who === 'kid' ? 'teacher' : 'kid');

/** count번의 수가 놓인 뒤에 둘 차례인 쪽. first는 먼저 두는 쪽('kid' | 'teacher') */
export function turnOf(first, count) {
  return count % 2 === 0 ? first : otherOf(first);
}

/**
 * 둔 수들을 처음부터 다시 둔다.
 * @returns {{ok: boolean, state: any, over: boolean}} ok: 모두 둘 수 있는 수였는가. over: 더 둘 수 없는 자리인가
 */
export function replay(board, trail) {
  let state = startState(board);
  if (!Array.isArray(trail)) return { ok: false, state, over: isOver(board, state) };
  for (const move of trail) {
    const next = applyMove(board, state, move);
    if (next === null) return { ok: false, state, over: isOver(board, state) };
    state = next;
  }
  return { ok: true, state, over: isOver(board, state) };
}

/** 끝난 판에서 마지막 수를 둔 쪽(이긴 쪽). 수가 하나도 없이 끝난 판이면 먼저 두는 쪽이 못 둔 것이다 */
export function winnerOf(first, count) {
  return otherOf(turnOf(first, count));
}

/**
 * 컴퓨터가 두는 수. 이길 수 있는 자리에서는 이기는 수 가운데서, 질 자리에서는 둘 수 있는 수 가운데서 시드 난수로 고른다.
 * 더 둘 수 없으면 null.
 */
export function pickMove(board, state, rng) {
  const winning = winningMoves(board, state);
  const list = winning.length > 0 ? winning : movesOf(board, state);
  return list.length === 0 ? null : list[randInt(rng, 0, list.length - 1)];
}

/**
 * 선생님의 다음 수. 같은 (단계, 판 번호, 먼저 두는 쪽, 지금까지 둔 수들)이면 늘 같은 수를 둔다.
 * 직접 만든 판은 판 번호가 없으므로 판의 모습을 시드로 쓴다.
 */
export function teacherMove(board, trail, { level = null, seed = null, first = 'kid' } = {}) {
  const { ok, state } = replay(board, trail);
  if (!ok) return null;
  const rng = createRng(seedFrom('duel-move', level ?? 'make', seed ?? boardKey(board), first, trail.map(moveKey).join(',')));
  return pickMove(board, state, rng);
}

/**
 * 아이가 이기는 자리에서 지는 수를 둔 곳. 몇 번째 수인지(1부터)의 목록이다.
 * 이기는 자리에서 둔 수가 상대를 이기는 자리로 보냈으면 그 수다.
 */
export function slipsOf(board, trail, first) {
  const slips = [];
  let state = startState(board);
  trail.forEach((move, index) => {
    const next = applyMove(board, state, move);
    if (next === null) return;
    if (turnOf(first, index) === 'kid' && isWin(board, state) && isWin(board, next)) slips.push(index + 1);
    state = next;
  });
  return slips;
}

// ---- 아무렇게나 두었을 때 ----

/**
 * 아이가 둘 수 있는 수 가운데 하나를 고르게 뽑아 두기를 되풀이할 때 아이가 이기는 비율(모든 경우를 따진 값).
 * 선생님은 앱에서 두는 대로 둔다(이기는 수가 있으면 그 가운데서, 없으면 둘 수 있는 수 가운데서 고르게).
 * @param {object} board
 * @param {boolean} kidFirst 아이가 먼저 두는가
 */
export function randomKidWinRate(board, kidFirst) {
  const family = familyOf(board);
  const max = maxOf(board);
  const memo = new Map();
  const rate = (position, kidTurn) => {
    const id = `${position.join(',')}|${kidTurn ? 'k' : 't'}`;
    const known = memo.get(id);
    if (known !== undefined) return known;
    const nexts = nextPositions(board.kind, max, position);
    let value;
    if (nexts.length === 0) value = kidTurn ? 0 : 1;
    else {
      const winning = kidTurn ? [] : nexts.filter((next) => !winAt(family, board.kind, max, next));
      const list = winning.length > 0 ? winning : nexts;
      value = list.reduce((sum, next) => sum + rate(next, !kidTurn), 0) / list.length;
    }
    memo.set(id, value);
    return value;
  };
  return rate(positionOf(board, startState(board)), kidFirst);
}

// ---- 작은 판으로 두어 보기 ----

const totalOf = (board) => (board.kind === 'choco' ? board.w * board.h : board.kind === 'one' ? board.n : board.piles.reduce((sum, count) => sum + count, 0));

/**
 * 같은 게임의 가장 작은 판 몇 개(작은 것부터). 원래 판보다 작은 판만 낸다.
 *   초콜릿: 칸이 적은 판부터(가로가 세로보다 길지 않게)
 *   한 더미: 한 번에 가져갈 수 있는 수는 그대로 두고, 돌 1개, 2개, 3개 …
 *   두 더미·세 더미: 돌이 적은 판부터(더미마다 3개까지)
 */
export function smallBoards(board, count = SMALL_COUNT) {
  const found = [];
  if (board.kind === 'choco') {
    for (let h = 1; h <= 3; h++) for (let w = Math.max(h, 2); w <= LIMITS.choco.max; w++) found.push({ kind: 'choco', w, h });
  } else if (board.kind === 'one') {
    for (let n = 1; n <= 2 * (board.max + 1); n++) found.push({ kind: 'one', n, max: board.max });
  } else {
    const build = (piles) => {
      if (piles.length === board.piles.length) found.push({ kind: 'piles', piles });
      else for (let next = piles.at(-1) ?? 1; next <= 3; next++) build([...piles, next]);
    };
    build([]);
  }
  return found
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => totalOf(item) < totalOf(board))
    .sort((a, b) => totalOf(a.item) - totalOf(b.item) || a.index - b.index)
    .slice(0, count)
    .map(({ item }) => item);
}

// ---- "왜 그럴까?"가 열리는 때 ----

/**
 * 그 게임의 "왜 그럴까?"를 열어도 되는가. 그 게임을 WHY_AFTER판 이상 끝까지 둔 뒤에 열린다(임시).
 * 세 더미에는 "왜 그럴까?"가 없다(일부러 까닭을 남겨 둔 판).
 */
export function whyOpen(records, game) {
  return game !== 'three' && finishedCount(records, game) >= WHY_AFTER;
}

/** 끝까지 둔 판들(오래된 것부터). 이긴 판도 진 판도 들어간다. 직접 만든 판과 자리를 바꿔 다시 둔 판도 센다 */
function finishedRounds(records) {
  if (!Array.isArray(records)) return [];
  return latestById(records).filter((record) => record.kind === 'round' && record.format === 'duel' && record.outcome === 'solved' && (record.winner === 'kid' || record.winner === 'teacher'));
}

/** 그 게임을 끝까지 둔 판의 수 */
export function finishedCount(records, game) {
  return finishedRounds(records).filter((record) => record.mode === game).length;
}

/** 맨 뒤에서부터 연달아 진 판의 수(끝까지 둔 판만 본다). 화면에 보여 주지 않는다. 자리를 바꿔 보기를 권할 때만 쓴다 */
export function lostStreak(records) {
  const rounds = finishedRounds(records);
  let streak = 0;
  while (streak < rounds.length && rounds[rounds.length - 1 - streak].winner === 'teacher') streak += 1;
  return streak;
}
