// 자리 바꾸기: 판, 움직이는 규칙, 풀이 프로그램(너비 우선 탐색), 막힌 모양 가리기, 오답 짐작.
// 순수 함수만 둔다. 화면에 손대지 않고, 무작위 수와 지금 시각을 쓰지 않는다. 같은 입력은 늘 같은 출력을 낸다.
//
// 한 형식에 판이 두 가지다.
//
// 가. 개구리 자리 바꾸기: { kind: 'frogs', left, right }
//   한 줄로 이어진 칸. 왼쪽에 left마리(오른쪽을 본다), 오른쪽에 right마리(왼쪽을 본다), 그 사이에 빈칸 하나.
//   칸의 모습은 글자열로 적는다. 'R'은 오른쪽을 보는 말, 'L'은 왼쪽을 보는 말, '_'는 빈칸이다.
//   말은 보는 쪽으로만 간다. 바로 앞이 빈칸이면 한 칸 가고, 바로 앞의 말 하나를 뛰어넘어 그 뒤의 빈칸으로 간다.
//   두 무리의 자리를 통째로 맞바꾸면 끝이다.
//
// 나. 건너뛰어 짝 짓기: { kind: 'pairs', n, skip }
//   한 줄로 놓인 돌 n개. 돌 하나를 집어 꼭 skip개를 건너뛰어(짝이 된 둘은 두 개로 센다) 혼자 있는 돌 위에 얹는다.
//   칸의 모습은 글자열로 적는다. '1'은 혼자 있는 돌, '2'는 짝이 된 돌, '0'은 돌이 떠난 빈자리다(빈자리는 세지 않는다).
//   모두 짝을 지으면 끝이다.
//
// 움직임(move): { from, to, jump }. jump는 개구리 판에서 뛰어넘었는가이다(짝 짓기에서는 늘 true).
// 지나온 길(trail)은 [from, to]의 목록이다.

/** 개구리 판에서 한쪽에 놓을 수 있는 마릿수의 위 끝 */
export const MAX_FROGS = 5;
/** 짝 짓기 판에 놓을 수 있는 돌의 수의 아래 끝과 위 끝 */
export const MIN_STONES = 2;
export const MAX_STONES = 12;
/** 짝 짓기에서 건너뛰는 수로 고를 수 있는 것 */
export const SKIPS = [1, 2, 3];

/**
 * 뛰어넘기 규칙.
 *   'other'  다른 무리의 말 하나만 뛰어넘는다
 *   'any'    어느 무리든 말 하나를 뛰어넘는다
 * 풀이 프로그램으로 두 규칙을 견주어 보았다(tests/swap.test.js). 가장 적은 횟수는 1~5마리의 모든 짝에서 같다.
 * 같은 무리를 뛰어넘으면 그 길은 꼭 막힌다. 그래서 'any'는 막히는 길만 늘린다.
 * 앱은 'other'를 쓴다. "개구리는 두꺼비를, 두꺼비는 개구리를 뛰어넘는다"고 말하면 되고,
 * 끝까지 간 풀이마다 뛰어넘기의 수가 꼭 (왼쪽 수 × 오른쪽 수)가 되어 "왜 그럴까?"의 이야기가 그대로 맞는다.
 */
export const JUMP_RULES = ['other', 'any'];
export const JUMP_RULE = 'other';

export const KINDS = ['frogs', 'pairs'];

/** 판이 규격에 맞는지 본다. 맞으면 null, 아니면 무엇이 틀렸는지 알리는 열쇠 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  if (board.kind === 'frogs') {
    for (const count of [board.left, board.right]) {
      if (!Number.isInteger(count) || count < 1 || count > MAX_FROGS) return 'bad-count';
    }
    return null;
  }
  if (board.kind === 'pairs') {
    if (!Number.isInteger(board.n) || board.n < MIN_STONES || board.n > MAX_STONES) return 'bad-count';
    if (!SKIPS.includes(board.skip)) return 'bad-skip';
    return null;
  }
  return 'bad-kind';
}

/** 처음 모습 */
export function startCells(board) {
  if (board.kind === 'frogs') return `${'R'.repeat(board.left)}_${'L'.repeat(board.right)}`;
  return '1'.repeat(board.n);
}

/** 개구리 판의 끝 모습: 두 무리가 자리를 통째로 맞바꾼 모습 */
export function goalCells(board) {
  return `${'L'.repeat(board.right)}_${'R'.repeat(board.left)}`;
}

/** 끝났는가: 개구리는 자리를 맞바꿨다, 짝 짓기는 혼자 있는 돌이 없다 */
export function isDone(board, cells) {
  if (board.kind === 'frogs') return cells === goalCells(board);
  return !cells.includes('1');
}

function frogMoves(cells, rule) {
  const moves = [];
  for (let from = 0; from < cells.length; from++) {
    const piece = cells[from];
    if (piece === '_') continue;
    const step = piece === 'R' ? 1 : -1;
    const next = cells[from + step];
    if (next === '_') moves.push({ from, to: from + step, jump: false });
    else if (next !== undefined && cells[from + 2 * step] === '_' && (rule === 'any' || next !== piece)) {
      moves.push({ from, to: from + 2 * step, jump: true });
    }
  }
  return moves;
}

/** 짝 짓기에서 from의 돌이 dir 쪽으로 뛰어 얹힐 자리. 없으면 -1 */
function landing(cells, skip, from, dir) {
  let passed = 0;
  for (let at = from + dir; at >= 0 && at < cells.length; at += dir) {
    const pile = Number(cells[at]);
    if (pile === 0) continue;
    if (passed === skip) return pile === 1 ? at : -1;
    passed += pile;
    if (passed > skip) return -1;
  }
  return -1;
}

function pairMoves(cells, skip) {
  const moves = [];
  for (let from = 0; from < cells.length; from++) {
    if (cells[from] !== '1') continue;
    for (const dir of [-1, 1]) {
      const to = landing(cells, skip, from, dir);
      if (to >= 0) moves.push({ from, to, jump: true });
    }
  }
  return moves;
}

/** 지금 모습에서 할 수 있는 움직임 모두 */
export function movesOf(board, cells, rule = JUMP_RULE) {
  return board.kind === 'frogs' ? frogMoves(cells, rule) : pairMoves(cells, board.skip);
}

/** from의 말이 할 수 있는 움직임들(개구리는 하나까지, 짝 짓기는 둘까지) */
export function movesFrom(board, cells, from, rule = JUMP_RULE) {
  return movesOf(board, cells, rule).filter((move) => move.from === from);
}

/** 움직임 하나를 한 뒤의 모습 */
export function applyMove(board, cells, move) {
  const next = [...cells];
  if (board.kind === 'frogs') {
    next[move.to] = cells[move.from];
    next[move.from] = '_';
  } else {
    next[move.from] = '0';
    next[move.to] = '2';
  }
  return next.join('');
}

/**
 * 지나온 길을 처음부터 따라가 본다.
 * @returns {{ok: boolean, cells: string, jumps: number, steps: number}}
 *   ok     길의 모든 움직임이 규칙에 맞는가
 *   jumps  뛰어넘은 횟수, steps 한 칸 간 횟수(개구리 판)
 */
export function replay(board, trail, rule = JUMP_RULE) {
  let cells = startCells(board);
  let jumps = 0;
  let steps = 0;
  if (!Array.isArray(trail)) return { ok: false, cells, jumps, steps };
  for (const pair of trail) {
    const move = Array.isArray(pair) ? movesOf(board, cells, rule).find((item) => item.from === pair[0] && item.to === pair[1]) : null;
    if (!move) return { ok: false, cells, jumps, steps };
    cells = applyMove(board, cells, move);
    if (move.jump) jumps += 1;
    else steps += 1;
  }
  return { ok: true, cells, jumps, steps };
}

/** 막혔는가: 끝나지 않았는데 할 수 있는 움직임이 없다 */
export function isStuck(board, cells, rule = JUMP_RULE) {
  return !isDone(board, cells) && movesOf(board, cells, rule).length === 0;
}

/**
 * 누른 말이 왜 못 가는지. 갈 수 있으면 null.
 * @returns {null | {reason: string, cells: number[]}}
 *   reason  'empty'(말이 없는 칸) | 'edge'(줄의 끝이다) | 'blocked'(앞이 막혔다)
 *           | 'paired'(짝이 된 돌이다) | 'no-landing'(얹을 자리가 없다)
 *   cells   길을 막고 있는 칸들(판에서 보여 준다)
 */
export function blockOf(board, cells, from, rule = JUMP_RULE) {
  const piece = cells[from];
  if (piece === undefined) return { reason: 'empty', cells: [] };
  if (movesFrom(board, cells, from, rule).length > 0) return null;
  if (board.kind === 'pairs') {
    if (piece === '0') return { reason: 'empty', cells: [] };
    return { reason: piece === '2' ? 'paired' : 'no-landing', cells: [] };
  }
  if (piece === '_') return { reason: 'empty', cells: [] };
  const step = piece === 'R' ? 1 : -1;
  const one = from + step;
  const two = from + 2 * step;
  if (cells[one] === undefined) return { reason: 'edge', cells: [] };
  // 바로 앞에 말이 있다. 그 뒤가 빈칸이 아니거나(말이 있거나 줄의 끝), 같은 무리라서 뛰어넘지 못한다.
  return { reason: 'blocked', cells: cells[two] === undefined || cells[two] === '_' ? [one] : [one, two] };
}

/**
 * 개구리 판에서 막힌 모양의 꼴. 본 것만 가린다(까닭을 따지지 않는다).
 *   'pair'   같은 무리의 말 둘이 나란히 붙어 있고 그 바로 앞에 다른 무리의 말이 있다
 *   'plain'  그 밖의 모양
 */
export function stuckKind(cells) {
  return /RRL|RLL/.test(cells) ? 'pair' : 'plain';
}

/**
 * 풀이 프로그램. 처음 모습에서 갈 수 있는 모든 모습을 너비 우선으로 따져, 끝낼 수 있는지와 가장 적은 횟수를 구한다.
 * @returns {{possible: boolean, min: number|null, moves: number[][], states: number}}
 *   moves   가장 짧은 풀이 하나([from, to]의 목록). 안 되는 판이면 빈 목록
 *   states  따져 본 모습의 수
 */
export function solve(board, rule = JUMP_RULE) {
  const start = startCells(board);
  const came = new Map([[start, null]]);
  let layer = [start];
  let found = isDone(board, start) ? start : null;
  while (found === null && layer.length > 0) {
    const next = [];
    for (const cells of layer) {
      for (const move of movesOf(board, cells, rule)) {
        const after = applyMove(board, cells, move);
        if (came.has(after)) continue;
        came.set(after, { before: cells, move });
        if (found === null && isDone(board, after)) found = after;
        next.push(after);
      }
    }
    layer = next;
  }
  if (found === null) return { possible: false, min: null, moves: [], states: came.size };
  const moves = [];
  for (let step = came.get(found); step; step = came.get(step.before)) moves.unshift([step.move.from, step.move.to]);
  return { possible: true, min: moves.length, moves, states: came.size };
}

/**
 * 끝까지 가는 모든 길을 따져, 길마다의 움직인 횟수와 뛰어넘은 횟수가 어떤 값들인지 모은다.
 * 개구리 판은 말이 앞으로만 가므로 같은 모습으로 돌아오지 않는다(길이 끝없이 이어지지 않는다).
 * @returns {{ways: number, lengths: number[], jumps: number[]}}
 *   ways     끝까지 가는 길의 수
 *   lengths  그 길들의 움직인 횟수(서로 다른 값만, 작은 것부터)
 *   jumps    그 길들의 뛰어넘은 횟수(서로 다른 값만, 작은 것부터)
 */
export function allWays(board, rule = JUMP_RULE) {
  const memo = new Map();
  // 모습마다: 거기서 끝까지 가는 길의 수와, (남은 움직임 수, 남은 뛰어넘기 수)의 짝들
  const from = (cells) => {
    if (memo.has(cells)) return memo.get(cells);
    let result;
    if (isDone(board, cells)) result = { ways: 1, pairs: new Set(['0,0']) };
    else {
      result = { ways: 0, pairs: new Set() };
      for (const move of movesOf(board, cells, rule)) {
        const rest = from(applyMove(board, cells, move));
        result.ways += rest.ways;
        for (const pair of rest.pairs) {
          const [length, jumps] = pair.split(',').map(Number);
          result.pairs.add(`${length + 1},${jumps + (move.jump ? 1 : 0)}`);
        }
      }
    }
    memo.set(cells, result);
    return result;
  };
  const all = from(startCells(board));
  const values = (at) => [...new Set([...all.pairs].map((pair) => Number(pair.split(',')[at])))].sort((a, b) => a - b);
  return { ways: all.ways, lengths: values(0), jumps: values(1) };
}

/**
 * 아무렇게나 움직였을 때(할 수 있는 움직임 가운데 하나를 고르게 뽑을 때) 끝까지 가는 비율.
 * 뽑아 보지 않고 모든 갈림을 따져서 셈한다. 판이 얼마나 뻔한지를 재는 값이다(좋은 판 가리기에 쓴다).
 * @returns {number} 0 이상 1 이하
 */
export function randomFinishRate(board, rule = JUMP_RULE) {
  const memo = new Map();
  const from = (cells) => {
    if (memo.has(cells)) return memo.get(cells);
    let rate = 0;
    if (isDone(board, cells)) rate = 1;
    else {
      const moves = movesOf(board, cells, rule);
      for (const move of moves) rate += from(applyMove(board, cells, move)) / moves.length;
    }
    memo.set(cells, rate);
    return rate;
  };
  return from(startCells(board));
}

/** 처음 모습에서 갈 수 있는 모습 가운데 막힌 모습들 */
export function deadEnds(board, rule = JUMP_RULE) {
  const seen = new Set([startCells(board)]);
  const stuck = [];
  const stack = [startCells(board)];
  while (stack.length > 0) {
    const cells = stack.pop();
    const moves = movesOf(board, cells, rule);
    if (moves.length === 0 && !isDone(board, cells)) stuck.push(cells);
    for (const move of moves) {
      const after = applyMove(board, cells, move);
      if (!seen.has(after)) {
        seen.add(after);
        stack.push(after);
      }
    }
  }
  return stuck.sort();
}

/**
 * 짝 짓기 판에서 "불가능해요"라고 답했을 때의 판정과 짐작.
 * @param {{possible: boolean}} solution 풀이 프로그램의 결과
 * @param {{moves?: number, firsts?: string[]}} tried 해 본 것: 얹은 횟수, 처음 모습에서 맨 먼저 해 본 움직임들("from-to")
 * @returns {{correct: boolean, guess: string|null}}
 *   guess  'impossible-no-try'      얹어 보지 않고 답했다
 *          'impossible-same-first'  늘 같은 돌부터 얹었다
 *          'impossible-other-way'   해 보지 않은 차례가 남아 있다
 */
export function diagnoseImpossible(solution, tried = {}) {
  if (!solution.possible) return { correct: true, guess: null };
  if ((tried.moves ?? 0) === 0) return { correct: false, guess: 'impossible-no-try' };
  if ((tried.firsts?.length ?? 0) <= 1) return { correct: false, guess: 'impossible-same-first' };
  return { correct: false, guess: 'impossible-other-way' };
}
