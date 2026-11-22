// 숫자 넷으로 수 만들기의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 숫자는 시드 난수(rng.js)로 고르고, 풀이 프로그램으로 따진 판만 낸다.
// 사다리에는 안 되는 판(만들 수 없는 목표 수)이 없다. 1부터 차례로 하는 판의 끝(처음 막히는 수)은 모든 차례를 해 본 풀이 프로그램이 안다.
//   아이에게 그 수가 안 된다고 답하게 하지 않고, 차례가 거기에 닿으면 "더 이어 갈 수는 없어요"라는 사실만 말한다(기록 깨기, 커리큘럼 12절).
import { canMake, checkBoard, firstMissing, needsFraction, sameBoard, wholeReach } from './fourdigits.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag   'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode  'three'(숫자 셋으로 목표 수 하나) | 'four'(숫자 넷으로 목표 수 셋) | 'run'(1부터 차례로) | 'same'(네 개의 같은 숫자로 1부터 차례로)
 *         | 'fraction'(분수를 거쳐야만 나오는 목표 수) | 'make'(직접 만든다)
 *
 * 1단계 숫자 셋으로: 숫자 셋(서로 다른 1~9)으로 목표 수 하나(5~30). 분수 없이 되고, 셋을 모두 더하거나 모두 곱한 수가 아니다. 첫 판은 2, 3, 4로 10.
 * 2단계 숫자 넷으로: 숫자 넷으로 목표 수 셋(10~40). 저마다 분수 없이 되고, 넷을 모두 더하거나 모두 곱한 수가 아니다. 첫 판은 1, 2, 3, 4로 10, 21, 25.
 * 3단계 1부터 차례로: 처음 막히는 수가 10~16인 숫자 넷(같은 숫자는 둘까지, RUN_SETS). 늘 풀지 않은 수 둘이 열려 있다. 첫 판은 1, 1, 2, 3(1부터 10까지).
 * 4단계 네 개의 같은 숫자: 2, 3, 4, 5, 6을 넷씩(1부터 6, 10, 9, 7, 8까지). 첫 판은 네 개의 4.
 * 5단계 까다로운 목표 수: 분수를 거쳐야만 나오는 목표 수(10~30, FRACTION_BOARDS). 첫 판은 1, 1, 4, 4로 5.
 * 6단계 직접 만들기: 숫자 넷을 고르면 선생님이 1부터 어디까지 차례로 되는지, 만들 수 없는 수가 무엇인지 따져 준다.
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'three' },
  { level: 2, tag: 'basic', mode: 'four' },
  { level: 3, tag: 'applied', mode: 'run' },
  { level: 4, tag: 'applied', mode: 'same' },
  { level: 5, tag: 'challenge', mode: 'fraction' },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 단계마다 정해 둔 첫 판 */
export const FIRST_BOARDS = {
  three: { kind: 'target', digits: [2, 3, 4], targets: [10] },
  four: { kind: 'target', digits: [1, 2, 3, 4], targets: [10, 21, 25] },
  run: { kind: 'run', digits: [1, 1, 2, 3] },
  same: { kind: 'run', digits: [4, 4, 4, 4] },
  fraction: { kind: 'target', digits: [1, 1, 4, 4], targets: [5] },
};

/** 3단계의 숫자 넷: 처음 막히는 수가 10~16이고 서로 다른 숫자가 셋 이상인 것 모두(풀이 프로그램으로 골랐고, 테스트가 다시 고른다) */
export const RUN_SETS = (
  '1123 1124 1146 1156 1159 1339 1347 1369 1379 1448 1455 1457 1458 1459 1566 1567 1568 1577 1579 1667 1668 1677 1678 1688 1789 1799 2257 2279 ' +
  '2339 2368 2399 2446 2448 2488 2499 2568 2579 2589 2669 2699 2779 3345 3348 3357 3358 3368 3369 3378 3389 3448 3479 3556 3557 3558 3559 3566 ' +
  '3567 3589 3668 3669 3677 3678 3779 3789 3799 4457 4459 4467 4478 4479 4489 4556 4588 4668 4669 4679 4688 5568 5578 5667 5689 5799'
)
  .split(' ')
  .map((text) => [...text].map(Number));
export const RUN_LOW = 10;
export const RUN_HIGH = 16;

/** 4단계의 숫자: 넷씩 놓는다 */
export const SAME_DIGITS = [2, 3, 4, 5, 6];

/** 5단계의 판: 숫자 넷과, 분수를 거쳐야만 나오는 목표 수(10~30) 모두(풀이 프로그램으로 골랐고, 테스트가 다시 고른다) */
export const FRACTION_LOW = 10;
export const FRACTION_HIGH = 30;
export const FRACTION_BOARDS = [
  '1158>10 1199>10 1238>28 1336>17 1336>19 1337>10 1337>22 1338>11 1338>23 1338>25 1339>26 1339>28',
  '1345>15 1346>24 1348>22 1348>26 1349>27 1355>16 1377>20 1377>22 1388>23 1388>25 1444>15 1444>17',
  '1446>25 1447>29 1448>30 1449>13 1456>24 1466>23 1466>25 1467>28 1477>27 1477>29 1478>22 1489>26',
  '1555>24 1555>26 1556>11 1558>13 1559>14 1566>11 1567>15 1567>21 1589>15 1667>13 1668>24 1677>13',
  '1778>15 1788>15 1789>28 1889>17 1899>17 2227>11 2229>13 2238>19 2246>15 2255>12 2256>27 2257>14',
  '2277>12 2277>16 2278>23 2279>11 2288>18 2289>25 2299>16 2299>20 2336>16 2336>20 2336>22 2339>25',
  '2339>29 2355>13 2358>16 2358>28 2359>27 2366>19 2369>17 2369>26 2369>28 2377>11 2388>13 2388>19',
  '2446>21 2446>27 2455>14 2455>22 2468>23 2468>25 2477>18 2477>26 2477>30 2478>29 2488>15 2488>17',
  '2499>14 2499>22 2555>23 2555>27 2556>16 2557>17 2566>17 2577>19 2588>21 2599>13 2599>23 2667>19',
  '2677>20 2688>22 2778>22 2778>28 2779>23 2788>23 2799>11 2799>25 2889>25 2899>26 3345>17 3346>22',
  '3346>26 3347>25 3348>20 3348>30 3349>23 3355>18 3356>23 3356>28 3357>16 3357>22 3358>15 3358>23',
  '3358>29 3359>22 3367>25 3369>20 3377>18 3377>24 3377>28 3378>13 3378>17 3388>21 3388>24 3388>27',
  '3389>19 3444>19 3445>17 3446>27 3447>19 3447>25 3448>26 3448>29 3455>19 3455>23 3477>17 3477>25',
  '3478>10 3555>22 3555>28 3566>26 3568>14 3577>26 3588>19 3669>14 3669>22 3677>27 3688>20 3688>28',
  '3689>23 3778>13 3778>29 3788>17 3889>15 4445>11 4446>22 4447>23 4449>25 4456>26 4458>27 4459>11',
  '4466>18 4468>19 4468>21 4468>27 4469>30 4477>21 4477>24 4478>25 4479>19 4479>29 4489>23 4499>27',
  '4555>29 4556>26 4558>30 4559>29 4566>26 4566>29 4569>26 4578>26 4589>22 4666>27 4667>17 4668>27',
  '4669>20 4669>28 4677>22 4688>29 4778>20 5556>19 5557>18 5558>17 5559>16 5567>29 5568>22 5569>21',
  '5577>28 5578>27 5779>26 6667>29 6668>28',
]
  .join(' ')
  .split(' ')
  .map((text) => {
    const [digits, target] = text.split('>');
    return { kind: 'target', digits: [...digits].map(Number), targets: [Number(target)] };
  });

/** 1, 2단계의 목표 수 범위 */
export const THREE_LOW = 5;
export const THREE_HIGH = 30;
export const FOUR_LOW = 10;
export const FOUR_HIGH = 40;
/** 2단계 판의 목표 수 개수 */
export const FOUR_TARGETS = 3;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

const pick = (rng, list) => list[randInt(rng, 0, list.length - 1)];
const sum = (digits) => digits.reduce((total, digit) => total + digit, 0);
const product = (digits) => digits.reduce((total, digit) => total * digit, 1);

/** 숫자들로 분수 없이 만들 수 있는 목표 수들: low~high, 모두 더하거나 모두 곱한 수는 뺀다 */
export function plainTargets(digits, low, high) {
  return wholeReach(digits, high).filter((n) => n >= low && n !== sum(digits) && n !== product(digits) && !needsFraction(digits, n));
}

/** 서로 다른 숫자 count개(작은 것부터) */
function distinctDigits(rng, count) {
  const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const chosen = [];
  while (chosen.length < count) chosen.push(pool.splice(randInt(rng, 0, pool.length - 1), 1)[0]);
  return chosen.sort((a, b) => a - b);
}

/** 숫자 넷(같은 숫자가 둘까지 있어도 된다. 작은 것부터) */
function fourDigits(rng) {
  const digits = distinctDigits(rng, 3);
  digits.push(randInt(rng, 1, 9));
  return digits.sort((a, b) => a - b);
}

/** 목록에서 서로 다른 것 count개를 골라 작은 것부터 */
function pickSome(rng, list, count) {
  const pool = list.slice();
  const chosen = [];
  while (chosen.length < count && pool.length > 0) chosen.push(pool.splice(randInt(rng, 0, pool.length - 1), 1)[0]);
  return chosen.sort((a, b) => a - b);
}

// ---- 판 만들기 ----

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed) {
  if (seed === 1) return structuredClone(FIRST_BOARDS[rung.mode]);
  const rng = createRng(seedFrom('fourdigits', rung.level, seed));
  if (rung.mode === 'three') {
    for (;;) {
      const digits = distinctDigits(rng, 3);
      const targets = plainTargets(digits, THREE_LOW, THREE_HIGH);
      if (targets.length > 0) return { kind: 'target', digits, targets: [pick(rng, targets)] };
    }
  }
  if (rung.mode === 'four') {
    for (;;) {
      const digits = fourDigits(rng);
      const targets = plainTargets(digits, FOUR_LOW, FOUR_HIGH);
      if (targets.length >= FOUR_TARGETS) return { kind: 'target', digits, targets: pickSome(rng, targets, FOUR_TARGETS) };
    }
  }
  if (rung.mode === 'run') return { kind: 'run', digits: pick(rng, RUN_SETS).slice() };
  if (rung.mode === 'same') {
    const digit = pick(rng, SAME_DIGITS);
    return { kind: 'run', digits: [digit, digit, digit, digit] };
  }
  return structuredClone(pick(rng, FRACTION_BOARDS));
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(정해 둔 첫 판)을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object}}
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

/** 숫자 하나를 뺀 숫자들. 같은 숫자를 빼면 같은 것이라 숫자의 값마다 하나씩, 큰 숫자를 뺀 것부터 */
function dropOne(digits) {
  const values = [...new Set(digits)].sort((a, b) => b - a);
  return values.map((value) => {
    const at = digits.lastIndexOf(value);
    return digits.filter((_, index) => index !== at);
  });
}

/** 목표 수와 가장 가까운 만들 수 있는 수(같으면 작은 쪽). 이미 고른 수는 빼고, 분수를 거쳐야만 나오는 수도 뺀다 */
function closest(digits, target, used) {
  const list = wholeReach(digits).filter((n) => !used.includes(n) && !needsFraction(digits, n));
  return list.sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b)[0] ?? null;
}

/**
 * 더 작은 판들. 같은 판에는 늘 같은 판들이 나온다. 숫자를 하나 뺀 같은 종류의 판이다(큰 숫자를 뺀 것부터).
 *   목표 수 판: 목표 수가 남은 숫자로도 되면 그대로, 안 되면 가장 가까운 되는 수로 바꾼다(분수를 거쳐야만 나오는 수는 고르지 않는다).
 *     숫자 셋은 분수를 거쳐야만 나오는 수가 없어서, 까다로운 목표 수의 작은 판은 분수 없이 된다. 숫자 둘인 판까지 줄인다.
 *   1부터 차례로: 숫자 셋인 판(1부터 2까지는 되는 것만). 그런 판이 없으면(네 개의 4는 숫자 셋으로 1이 안 된다) 숫자 셋으로 만들 수 있는
 *     가장 작은 수 셋을 목표 수로 한 판이다. 숫자 셋인 판은 더 줄이지 않는다.
 *   원래 목표 수를 많이 그대로 둔 판부터 낸다.
 * @param {object} board 원래 판
 * @returns {object[]}
 */
export function smallBoards(board) {
  if (board.kind === 'run') {
    if (board.digits.length <= 3) return [];
    const runs = dropOne(board.digits).filter((digits) => firstMissing(digits) >= 3);
    if (runs.length > 0) return runs.map((digits) => ({ kind: 'run', digits }));
    return dropOne(board.digits).map((digits) => ({ kind: 'target', digits, targets: wholeReach(digits).slice(0, FOUR_TARGETS) }));
  }
  if (board.digits.length <= 2) return [];
  const list = [];
  for (const digits of dropOne(board.digits)) {
    const targets = [];
    for (const target of board.targets) {
      const next = canMake(digits, target) && !needsFraction(digits, target) && !targets.includes(target) ? target : closest(digits, target, targets);
      if (next !== null) targets.push(next);
    }
    if (targets.length > 0) list.push({ kind: 'target', digits, targets: targets.sort((a, b) => a - b) });
  }
  // 원래 목표 수를 많이 그대로 둔 판부터(같으면 큰 숫자를 뺀 판부터)
  const kept = (small) => small.targets.filter((n) => board.targets.includes(n)).length;
  return list.map((small, index) => ({ small, index })).sort((a, b) => kept(b.small) - kept(a.small) || a.index - b.index).map(({ small }) => small);
}
