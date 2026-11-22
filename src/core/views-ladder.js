// 세 방향에서 본 그림의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 쌓기는 시드 난수(rng.js)로 고르고, 풀이 프로그램(views.js)으로 확인한 판만 낸다.
//
// 사다리의 쌓기는 모두 세로줄과 가로줄마다 쌓기나무가 하나 이상 있다(앞과 옆의 그림에 빈 줄이 없다).
// 위에서 본 그림 맞히기의 안 되는 보기는 모두 판에서 까닭이 보인다: 앞(옆) 그림에 보이는 줄에 칸이 하나도 없거나(empty),
// 그 줄에 놓인 칸이 옆(앞) 그림 때문에 그 높이까지 쌓일 수 없다(short). 되는 보기는 하나뿐이다.
import { MAX_H, checkBoard, countStacks, frontOf, planOf, sameBoard, sideOf, sum, tallest, topReason, viewFrom, viewsOf } from './views.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   'see'(보이는 그림 고르기) | 'build'(쌓아서 맞추기) | 'top'(위에서 본 그림 맞히기) | 'range'(가장 적게, 가장 많이) | 'three'(세 그림 모두 맞추기) | 'make'(직접 만든다)
 *   sizes  판의 가로와 앞뒤 칸 수로 고를 수 있는 것
 *   high   한 칸에 쌓는 수의 위 끝
 *
 * 1단계 보이는 그림 고르기: 쌓기 하나(끌면 돌아간다)를 보고 앞, 오른쪽 옆, 위에서 본 그림을 보기 셋 가운데서 고른다(판 번호마다 차례로).
 *   다른 보기는 뒤(왼쪽 옆)에서 본 그림, 다른 방향에서 본 그림, 한 줄(한 칸)만 다른 그림이다. 첫 판은 가로 셋, 앞뒤 둘의 쌓기에서 앞을 묻는다.
 * 2단계 쌓아서 맞추기: 앞과 옆의 그림만 보고 똑같이 보이게 쌓는다. 첫 판은 2×2다.
 * 3단계 위에서 본 그림 맞히기: 앞과 옆의 그림으로 위에서 본 그림이 될 수 있는 것을 보기 넷 가운데서 고른다. 되는 보기는 하나다.
 *   첫 판의 안 되는 보기는 모두 칸이 하나도 없는 줄이 있는 것(empty)이다. 다른 판에는 높이가 모자라는 보기(short)도 섞는다.
 * 4단계 가장 적게, 가장 많이: 앞과 옆의 그림과 똑같이 보이게 쌓되, 쌓기나무를 가장 적게 쓴 것과 가장 많이 쓴 것을 찾는다.
 *   가장 많은 수와 가장 적은 수의 차가 2 이상이고 가장 많은 수가 16개 이하인 판만 낸다. 첫 판은 2×2다.
 * 5단계 세 그림 모두 맞추기: 앞, 옆, 위의 그림을 모두 준다. 판 번호가 홀수이면 세 그림이 되는 쌓기가 둘 이상인 판, 짝수이면 하나뿐인 판이다.
 *   그림대로 가장 많이 쌓아도 20개 이하인 판만 낸다.
 * 6단계 직접 만들기: 쌓기를 만들면 선생님이 세 방향에서 본 그림을 그리고, 같은 세 그림이 되는 쌓기가 몇 가지인지 말한다.
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'see', sizes: [[3, 2], [2, 2], [2, 3], [3, 3]], high: 3 },
  { level: 2, tag: 'basic', mode: 'build', sizes: [[2, 2], [3, 2], [2, 3], [3, 3]], high: 3 },
  { level: 3, tag: 'applied', mode: 'top', sizes: [[3, 3], [3, 2], [2, 3], [4, 3], [3, 4]], high: 3 },
  { level: 4, tag: 'applied', mode: 'range', sizes: [[2, 3], [3, 2], [3, 3]], high: 3 },
  { level: 5, tag: 'challenge', mode: 'three', sizes: [[3, 3], [4, 3], [3, 4], [4, 4]], high: 4 },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 보기의 수: 보이는 그림 고르기는 셋, 위에서 본 그림 맞히기는 넷 */
export const SEE_OPTIONS = 3;
export const TOP_OPTIONS = 4;
/** 가장 많이 쌓은 수의 위 끝: 가장 적게·가장 많이는 16개, 세 그림 모두 맞추기는 20개(한 번 누를 때 하나씩 쌓으므로 너무 많이 누르지 않게) */
export const RANGE_MOST = 16;
export const THREE_MOST = 20;
/** 판 내기에서 쌓기를 다시 고르는 횟수의 위 끝 */
const TRIES = 400;

/** 정해 둔 첫 판들의 쌓기(앞 줄부터) */
const SEE_FIRST = { w: 3, d: 2, heights: [2, 1, 1, 1, 0, 0] };
const BUILD_FIRST = { w: 2, d: 2, heights: [1, 2, 0, 1] };
const TOP_FIRST = { w: 3, d: 3, heights: [1, 0, 2, 0, 2, 1, 1, 0, 0] };
const RANGE_FIRST = { w: 2, d: 2, front: [2, 1], side: [2, 1] };

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 한 번 푼 판은 적어 둔다 */
const memo = new Map();
export function countOnce(w, d, front, side, plan = null) {
  const key = `${w}:${d}:${front.join('')}:${side.join('')}:${plan ? plan.join('') : ''}`;
  if (!memo.has(key)) memo.set(key, countStacks(w, d, front, side, plan));
  return memo.get(key);
}

const pick = (rng, list) => list[randInt(rng, 0, list.length - 1)];

/** 순서를 섞는다(같은 rng면 늘 같은 순서) */
function shuffle(rng, list) {
  const out = list.slice();
  for (let at = out.length - 1; at > 0; at--) {
    const other = randInt(rng, 0, at);
    [out[at], out[other]] = [out[other], out[at]];
  }
  return out;
}

/** 세로줄과 가로줄마다 쌓기나무가 있는가 */
export function linesFull(w, d, heights) {
  return frontOf(w, d, heights).every((value) => value > 0) && sideOf(w, d, heights).every((value) => value > 0);
}

/** 아무렇게나 쌓은 쌓기 하나. 칸은 셋에 하나쯤 비운다. 줄마다 하나 이상 있다 */
function randomStack(rng, w, d, high) {
  for (let tries = 0; tries < TRIES; tries++) {
    const heights = Array.from({ length: w * d }, () => (randInt(rng, 0, 2) === 0 ? 0 : randInt(rng, 1, high)));
    if (linesFull(w, d, heights) && Math.max(...heights) >= 2) return heights;
  }
  throw new Error('쌓기를 고르지 못했어요');
}

// ---- 보이는 그림 고르기의 보기 ----

/**
 * 맞는 그림과 다른 보기들. 다른 보기는 뒤(왼쪽 옆)에서 본 그림, 다른 방향에서 본 그림, 한 줄(한 칸)만 다른 그림 가운데서 고른다.
 * 맞는 그림과 같거나 서로 같은 보기는 뺀다. 고를 것이 모자라면 null
 */
export function seeOptions(rng, w, d, heights, ask) {
  const truth = viewFrom(w, d, heights, ask);
  const front = frontOf(w, d, heights);
  const side = sideOf(w, d, heights);
  const named = [];
  const near = [];
  if (ask === 'front') named.push(front.slice().reverse(), side);
  if (ask === 'side') named.push(side.slice().reverse(), front);
  if (ask === 'top') {
    // 한 칸만 다른 위의 그림. 줄마다 칸이 있게 둔다
    truth.forEach((value, at) => {
      const other = truth.slice();
      other[at] = value ? 0 : 1;
      if (linesFull(w, d, other)) near.push(other);
    });
  } else {
    truth.forEach((value, at) => {
      for (const step of [1, -1]) {
        const next = value + step;
        if (next < 1 || next > MAX_H) continue;
        const other = truth.slice();
        other[at] = next;
        near.push(other);
      }
    });
  }
  const seen = new Set([truth.join(',')]);
  const others = [];
  // 이름 있는 그림(뒤, 다른 방향)을 하나 먼저, 그다음은 한 줄만 다른 그림
  for (const option of [...shuffle(rng, named).slice(0, 1), ...shuffle(rng, near), ...named]) {
    const key = option.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    others.push(option);
    if (others.length === SEE_OPTIONS - 1) break;
  }
  if (others.length < SEE_OPTIONS - 1) return null;
  return shuffle(rng, [truth, ...others]);
}

// ---- 위에서 본 그림 맞히기의 보기 ----

/** 위의 그림에서 칸 하나나 둘을 바꾼 그림들 */
function nearPlans(plan) {
  const out = [];
  const n = plan.length;
  for (let a = 0; a < n; a++) {
    const one = plan.slice();
    one[a] = one[a] ? 0 : 1;
    out.push(one);
    for (let b = a + 1; b < n; b++) {
      const two = one.slice();
      two[b] = two[b] ? 0 : 1;
      out.push(two);
    }
  }
  return out;
}

/**
 * 되는 보기 하나와 안 되는 보기 셋. 되는 보기는 쌓기의 위 그림(plan)이다.
 * 안 되는 보기는 칸 수가 되는 보기와 하나 넘게 다르지 않은 것으로 고른다. kinds가 'empty'면 칸이 하나도 없는 줄이 있는 보기만 쓰고,
 * 'mixed'면 높이가 모자라는 보기(short)를 하나 이상 넣는다. 고를 것이 모자라면 null
 */
export function topOptions(rng, w, d, front, side, plan, kinds = 'mixed') {
  const cells = sum(plan);
  const pool = { empty: [], short: [] };
  const seen = new Set([plan.join('')]);
  for (const other of shuffle(rng, nearPlans(plan))) {
    const key = other.join('');
    if (seen.has(key)) continue;
    seen.add(key);
    const count = sum(other);
    if (count === 0 || Math.abs(count - cells) > 1) continue;
    const reason = topReason(w, d, front, side, other);
    if (!reason || reason.kind === 'seen') continue;
    pool[reason.kind].push(other);
  }
  let wrong;
  if (kinds === 'empty') wrong = pool.empty.slice(0, TOP_OPTIONS - 1);
  else {
    if (pool.short.length === 0) return null;
    const shorts = pool.short.slice(0, randInt(rng, 1, 2));
    wrong = [...shorts, ...pool.empty.slice(0, TOP_OPTIONS - 1 - shorts.length)];
    if (wrong.length < TOP_OPTIONS - 1) wrong = [...wrong, ...pool.short.slice(shorts.length, shorts.length + TOP_OPTIONS - 1 - wrong.length)];
  }
  if (wrong.length < TOP_OPTIONS - 1) return null;
  return shuffle(rng, [plan, ...wrong]);
}

// ---- 판 만들기 ----

/** 쌓기에서 판 하나를 만든다. 보기를 고르지 못하면 null */
export function boardFrom(mode, w, d, heights, rng, { ask = 'front', kinds = 'mixed' } = {}) {
  const views = viewsOf(w, d, heights);
  if (mode === 'see') {
    const options = seeOptions(rng, w, d, heights, ask);
    return options ? { kind: 'see', w, d, heights: heights.slice(), ask, options } : null;
  }
  if (mode === 'build') return { kind: 'build', w, d, front: views.front, side: views.side };
  if (mode === 'top') {
    const options = topOptions(rng, w, d, views.front, views.side, views.plan, kinds);
    return options ? { kind: 'top', w, d, front: views.front, side: views.side, options } : null;
  }
  if (mode === 'range') return { kind: 'range', w, d, front: views.front, side: views.side };
  return { kind: 'three', w, d, front: views.front, side: views.side, plan: views.plan };
}

/** 가장 많이 쌓은 수와 가장 적게 쌓은 수의 차 */
export function gapOf(board) {
  const counted = countOnce(board.w, board.d, board.front, board.side);
  return counted.most - counted.fewest;
}

/** 그 판 번호의 보이는 그림 고르기가 묻는 방향 */
export const askAt = (seed) => ['front', 'side', 'top'][(seed - 1) % 3];

/** 세 그림 모두 맞추기에서 그 판 번호가 쌓기가 둘 이상인 판의 자리인가 */
export const manyAt = (seed) => seed % 2 === 1;

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed) {
  const rng = createRng(seedFrom('views', rung.level, seed));
  if (rung.mode === 'see' && seed === 1) return boardFrom('see', SEE_FIRST.w, SEE_FIRST.d, SEE_FIRST.heights, rng, { ask: 'front' });
  if (rung.mode === 'build' && seed === 1) return boardFrom('build', BUILD_FIRST.w, BUILD_FIRST.d, BUILD_FIRST.heights, rng);
  if (rung.mode === 'top' && seed === 1) return boardFrom('top', TOP_FIRST.w, TOP_FIRST.d, TOP_FIRST.heights, rng, { kinds: 'empty' });
  if (rung.mode === 'range' && seed === 1) return { kind: 'range', ...RANGE_FIRST, front: RANGE_FIRST.front.slice(), side: RANGE_FIRST.side.slice() };
  for (let tries = 0; tries < TRIES; tries++) {
    const [w, d] = pick(rng, rung.sizes);
    const heights = randomStack(rng, w, d, rung.high);
    const board = boardFrom(rung.mode, w, d, heights, rng, { ask: askAt(seed) });
    if (!board) continue;
    if (rung.mode === 'range' && (gapOf(board) < 2 || countOnce(w, d, board.front, board.side).most > RANGE_MOST)) continue;
    if (rung.mode === 'three') {
      const { count, most } = countOnce(w, d, board.front, board.side, board.plan);
      if ((count > 1) !== manyAt(seed) || most > THREE_MOST) continue;
    }
    return board;
  }
  throw new Error(`판을 만들지 못했어요: ${rung.level}단계 ${seed}번`);
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(정해 둔 1번 판)을 낸다(수준 맞추기에서 쓴다)
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  const board = boardAt(rung, shrink ? 1 : seed);
  if (checkBoard(board) !== null) throw new Error(`규격에 맞지 않는 판이에요: ${level}단계 ${seed}번`);
  return { level, seed, small: shrink, board };
}

/** 다음 판 번호. 방금 한 판과 같은 판이 나오는 번호는 건너뛴다 */
export function nextSeed(level, seed) {
  const rung = rungOf(level);
  if (rung.mode === 'make') return seed + 1;
  const before = boardAt(rung, seed);
  let next = seed + 1;
  while (sameBoard(boardAt(rung, next), before)) next += 1;
  return next;
}

// ---- 더 작은 판 ----

/** 판의 쌓기 하나: 보기 판은 보여 준 쌓기, 다른 판은 그림대로 가장 많이 쌓은 것(위에서 본 그림 맞히기는 되는 보기대로) */
export function stackOf(board) {
  if (board.kind === 'see') return board.heights.slice();
  if (board.kind === 'top') {
    const plan = board.options.find((option) => topReason(board.w, board.d, board.front, board.side, option) === null);
    return tallest(board.w, board.d, board.front, board.side, plan);
  }
  return tallest(board.w, board.d, board.front, board.side, board.kind === 'three' ? board.plan : null);
}

/** 쌓기에서 가로 x0부터 nw칸, 앞뒤 y0부터 nd칸만 남긴다 */
function crop(w, heights, x0, y0, nw, nd) {
  const out = [];
  for (let y = y0; y < y0 + nd; y++) for (let x = x0; x < x0 + nw; x++) out.push(heights[y * w + x]);
  return out;
}

/** 덜어 낼 줄: [왼쪽에서 덜어 낼 세로줄 수, 오른쪽, 앞에서 덜어 낼 가로줄 수, 뒤]. 오른쪽과 뒤를 먼저, 한 줄만 덜어 낸 판을 먼저 둔다 */
const CUTS = [
  [0, 1, 0, 0],
  [0, 0, 0, 1],
  [1, 0, 0, 0],
  [0, 0, 1, 0],
  [0, 1, 0, 1],
  [1, 0, 1, 0],
  [0, 1, 1, 0],
  [1, 0, 0, 1],
];

/**
 * 더 작은 판들. 같은 판에는 늘 같은 판들이 나온다. 판의 쌓기에서 가장자리의 세로줄이나 가로줄(오른쪽, 뒤, 왼쪽, 앞, 그리고 둘씩)을
 * 덜어 낸 쌓기로 같은 종류의 판을 만든다.
 * 가로나 앞뒤가 2칸보다 작아지거나, 빈 줄이 생기거나, 보기를 고르지 못하거나, 가장 적게·가장 많이의 차가 없거나, 앞에서 낸 판과 같으면 뺀다.
 * 직접 만든 판(custom)은 빈 줄이 있어도 된다.
 * @param {object} board 원래 판
 * @param {{custom?: boolean}} options custom: 직접 만든 판에서 왔는가
 */
export function smallBoards(board, { custom = false } = {}) {
  const heights = stackOf(board);
  const out = [];
  for (const [left, right, front, back] of CUTS) {
    const nw = board.w - left - right;
    const nd = board.d - front - back;
    if (nw < 2 || nd < 2) continue;
    const small = crop(board.w, heights, left, front, nw, nd);
    if (sum(small) === 0 || (!custom && !linesFull(nw, nd, small))) continue;
    const rng = createRng(seedFrom('views-small', JSON.stringify(board), left, right, front, back));
    const made = boardFrom(board.kind, nw, nd, small, rng, { ask: board.ask ?? 'front' });
    if (!made || checkBoard(made) !== null) continue;
    if (made.kind === 'range' && gapOf(made) < 1) continue;
    if (out.some((item) => sameBoard(item, made))) continue;
    out.push(made);
  }
  return out;
}

/** 직접 만들기에서 만든 쌓기로 낸 판(세 그림 모두 맞추기). 빈 쌓기면 null */
export function madeFrom(w, d, heights) {
  if (sum(heights) === 0) return null;
  const views = viewsOf(w, d, heights);
  return { kind: 'three', w, d, front: views.front, side: views.side, plan: planOf(heights) };
}
