// 돼지 주사위의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 단계마다 판의 값(견줄 멈추는 수, 겨룰 두 규칙, 바구니의 수)을 아래 모음에서 차례로 고르고,
// 시드는 시드 난수로 고른다(src/core/pig.js의 pickSeed). 실험 판은 컴퓨터의 첫 1,000번이 정확한 셈과 같은 쪽인 시드다(테스트가 본다).
// 다만 한 번 더 굴려도 똑같은 판(바구니 20개, 주사위 하나)은 아무 시드다. 그 판에서는 1,000번 해 본 결과가 셈과 다르게 보이는 것이 그대로 사실이다.
import { LIMITS, checkBoard, pickSeed, sameBoard, solve, winChance } from './pig.js';
import { createRng, randInt, seedFrom } from './rng.js';

/** 1단계 겨루기: 먼저 30개 모으기, 선생님은 바구니가 10개 이상이면 멈춘다 */
export const PLAY = { goal: 30, teacher: 10 };
/** 2단계: 견줄 멈추는 수들(판 번호 1부터 이 차례로) */
export const STOP_SETS = [
  [5, 10, 15, 20, 25, 30],
  [10, 15, 20, 25, 30, 35],
  [4, 8, 12, 16, 20, 24],
  [6, 12, 18, 24, 30, 36],
  [5, 15, 25, 35],
  [10, 20, 30, 40],
];
/** 3단계와 5단계: 바구니의 도토리(주사위 하나, 둘). 주사위 하나의 여섯째 판이 똑같은 판(20개)이다 */
export const POTS_ONE = [10, 30, 15, 24, 6, 20, 18, 26, 12, 40];
export const POTS_TWO = [12, 24, 18, 19, 10, 30, 15, 22];
/** 4단계: 겨룰 두 규칙(먼저 30개 모으기). 첫 판은 20개가 10개보다 자주 먼저 모으고, 둘째 판은 30개가 20개보다 자주 먼저 모은다 */
export const MATCH_GOAL = 30;
export const PAIRS = [
  [10, 20],
  [20, 30],
  [5, 15],
  [10, 25],
  [15, 30],
  [25, 30],
  [5, 25],
  [10, 30],
];
/** 겨룰 두 규칙은 한쪽이 먼저 모을 확률이 이만큼 넘게 50에서 떨어져 있다(1,000판이면 드러난다) */
export const CLEAR = 0.05;

/**
 * 사다리.
 *   tag   'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode  'play'(겨루기) | 'stop'(몇 개에서 멈출까) | 'edge'(한 번만 더 굴릴까) | 'match'(누가 먼저 모을까) | 'two'(주사위 둘이면) | 'make'(직접 만들기)
 * 1단계 선생님과 겨루기, 2단계 몇 개에서 멈출까, 3단계 한 번만 더 굴릴까(주사위 하나), 4단계 누가 먼저 모을까, 5단계 주사위 둘이면, 6단계 직접 만들기.
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'play' },
  { level: 2, tag: 'basic', mode: 'stop' },
  { level: 3, tag: 'applied', mode: 'edge' },
  { level: 4, tag: 'applied', mode: 'match' },
  { level: 5, tag: 'challenge', mode: 'two' },
  { level: 6, tag: 'challenge', mode: 'make' },
];
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 단계의 종류 → 판의 종류(kind) */
const KIND = { play: 'play', stop: 'stop', edge: 'edge', match: 'match', two: 'edge' };
export const kindOf = (mode) => KIND[mode];

/** 직접 만들기: 처음 값과 범위 */
export const MAKE_FIRST = { teacher: 10, goal: 50 };

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 단계마다 판의 값 모음 */
function listOf(rung) {
  if (rung.mode === 'play') return [PLAY];
  if (rung.mode === 'stop') return STOP_SETS.map((stops) => ({ stops }));
  if (rung.mode === 'edge') return POTS_ONE.map((pot) => ({ dice: 1, pot }));
  if (rung.mode === 'two') return POTS_TWO.map((pot) => ({ dice: 2, pot }));
  return PAIRS.map((stops) => ({ stops, goal: MATCH_GOAL }));
}

/** 판 번호 → 판의 값: 첫 바퀴는 적힌 차례, 그다음 바퀴부터는 바퀴마다 섞는다 */
function valuesAt(rung, seed) {
  const list = listOf(rung);
  const lap = Math.floor((seed - 1) / list.length);
  const at = (seed - 1) % list.length;
  if (lap === 0) return list[at];
  const items = list.slice();
  const rng = createRng(seedFrom('pig-lap', rung.level, lap));
  for (let index = items.length - 1; index > 0; index--) {
    const other = randInt(rng, 0, index);
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items[at];
}

/** 판의 값과 시드를 고르는 글자로 판을 만든다 */
export function boardOf(kind, values, key) {
  const shape = { kind, ...values, seed: 0 };
  if (values.stops) shape.stops = values.stops.slice();
  return { ...shape, seed: pickSeed(shape, key) };
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 목표가 20개인 겨루기를 낸다(수준 맞추기에서 쓴다)
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  const values = shrink ? { ...PLAY, goal: 20 } : valuesAt(rung, seed);
  const board = boardOf(kindOf(rung.mode), values, `${level}|${seed}|${shrink ? 'small' : ''}`);
  if (checkBoard(board) !== null) throw new Error(`쓸 수 없는 판이에요: ${level}단계 ${seed}번`);
  return { level, seed, small: shrink, board };
}

/** 다음 판 번호. 방금 한 판과 판의 값이 같은 판이 나오는 번호는 건너뛴다(겨루기는 늘 같은 값이라 다음 번호다) */
export function nextSeed(level, seed) {
  const rung = rungOf(level);
  if (rung.mode === 'make' || rung.mode === 'play') return seed + 1;
  const key = (values) => JSON.stringify(values);
  const before = key(valuesAt(rung, seed));
  let next = seed + 1;
  while (key(valuesAt(rung, next)) === before) next += 1;
  return next;
}

/** 직접 만들기: 선생님이 멈추는 수와 목표로 겨루기 판을 만든다. 범위 밖이면 null */
export function madeBoard(teacher, goal) {
  const board = { kind: 'play', goal, teacher, seed: seedFrom('pig-made', teacher, goal) };
  return checkBoard(board) === null ? board : null;
}

// ---- 더 작은 판 ----

/** 두 규칙 가운데 더 자주 먼저 모으는 쪽(0 | 1). 거의 같으면 null */
export function favoriteOf(stops, goal) {
  const chance = winChance(stops, goal);
  if (Math.abs(chance - 0.5) <= CLEAR) return null;
  return chance > 0.5 ? 0 : 1;
}

/**
 * 더 작은 판들(같은 물음의 더 작거나 쉬운 판). 차례대로 낸다.
 *   play   목표를 10개씩 줄인 겨루기(10개까지)
 *   stop   견줄 멈추는 수가 넷 이상이면, 맨 앞과 맨 뒤와 셈으로 가장 많이 모으는 수의 셋(이미 셋이면 없다)
 *   match  목표가 20개인 같은 두 규칙(더 자주 먼저 모으는 쪽이 같을 때만. 20개와 30개는 목표 20개에서 같은 규칙이 되어 없다)
 *   edge   주사위 둘이면 같은 바구니의 주사위 하나 판이 먼저. 주사위 하나는 바구니가 20개보다 적으면 4개(4개 이하면 2개),
 *          많으면 40개(40개 이상이면 60개), 20개면 10개와 30개(셈이 크게 갈리는 판)
 */
export function smallBoards(board) {
  const key = (index) => `small|${board.seed}|${index}`;
  if (board.kind === 'play') {
    const goals = [];
    for (let goal = board.goal - 10; goal >= LIMITS.minGoal && goals.length < 2; goal -= 10) goals.push(goal);
    return goals.map((goal) => ({ kind: 'play', goal, teacher: board.teacher, seed: board.seed }));
  }
  if (board.kind === 'stop') {
    if (board.stops.length <= 3) return [];
    const best = solve(board).best[0];
    const picked = new Set([board.stops[0], best, board.stops.at(-1)]);
    // 가장 많이 모으는 수가 맨 앞이나 맨 뒤면 그 사이의 수를 더한다
    for (const stop of board.stops.slice(1, -1)) if (picked.size < 3) picked.add(stop);
    const stops = [...picked].sort((x, y) => x - y);
    return [boardOf('stop', { stops }, key(0))];
  }
  if (board.kind === 'match') {
    if (board.goal <= 20) return [];
    const favorite = favoriteOf(board.stops, board.goal);
    if (favorite === null || favoriteOf(board.stops, 20) !== favorite) return [];
    return [boardOf('match', { stops: board.stops, goal: 20 }, key(0))];
  }
  const pots = board.pot < 20 ? [board.pot > 4 ? 4 : 2] : board.pot > 20 ? [board.pot < 40 ? 40 : 60] : [10, 30];
  const list = [];
  if (board.dice === 2) list.push(boardOf('edge', { dice: 1, pot: board.pot }, key(0)));
  pots.forEach((pot, index) => list.push(boardOf('edge', { dice: 1, pot }, key(index + 1))));
  return list.filter((item) => !sameBoard({ ...item, seed: 0 }, { ...board, seed: 0 }));
}
