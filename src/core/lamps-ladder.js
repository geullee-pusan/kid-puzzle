// 켜고 끄기와 숫자 마술의 사다리(단계)와 판 내기, "더 작은 판"의 재료. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 만들 수와 선생님이 고르는 수는 시드 난수로 고른다.
import { SECRET_COUNT, checkBoard, isDoubling, solve, sumOf } from './lamps.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   판의 종류(src/core/lamps.js). 'make'는 직접 만들기
 *   hint   힌트와 처음 화면의 물음, 규칙 글을 고르는 이름
 *   first  판 번호 1에 내는 판
 *   sets   판 번호가 달라지면 차례로 도는 불들
 *   small  수준 맞추기가 "작은 판부터"라고 할 때의 불(또는 자리 수)
 *
 * 1단계: 1, 2, 4, 8짜리 불로 적힌 수 넷을 만든다(첫 판은 1, 2, 4로 셋). 셋에 한 번은 16짜리 불까지 다섯이다.
 * 2단계: 1부터 만들어 보고 처음으로 만들 수 없는 수를 찾는다. 첫 판은 1, 2, 4, 8(16). 두 배씩이 아닌 불(1, 2, 4, 9는 8, 1, 3, 5, 7은 2)도 돈다.
 * 3단계: 빈 곳 없는 불에 하나를 더 단다. 몇짜리를 달면 가장 멀리 갈까(1, 2, 4, 8이면 16짜리, 31까지). 가장 멀리 가면 끝난다.
 * 4단계: 마음 읽기 카드. 선생님이 먼저 맞히고, 다음에 아이가 선생님의 수 셋을 맞힌다. 카드 넷(1~15)과 다섯(1~31)이 번갈아 나온다.
 * 5단계: 숫자 마술. 세 자리 수를 고르면 늘 1089가 나온다. 작은 판은 두 자리(늘 99).
 * 6단계: 직접 만들기. 불을 고르면 선생님이 어디까지 만들 수 있는지 알려 준다. 숫자 마술도 아무 수로 해 볼 수 있다.
 */
export const LADDER = [
  {
    level: 1,
    tag: 'basic',
    mode: 'targets',
    hint: 'targets',
    count: 4,
    first: { kind: 'targets', lamps: [1, 2, 4], targets: [3, 5, 7] },
    sets: [
      [1, 2, 4, 8],
      [1, 2, 4, 8],
      [1, 2, 4, 8, 16],
    ],
    small: [1, 2, 4],
  },
  {
    level: 2,
    tag: 'basic',
    mode: 'reach',
    hint: 'reach',
    sets: [
      [1, 2, 4, 8],
      [1, 2, 4, 9],
      [1, 2, 3, 6],
      [1, 2, 4, 8, 16],
      [1, 3, 5, 7],
      [1, 2, 4, 7],
      [1, 2, 5, 10],
      [1, 2, 3, 8],
    ],
  },
  {
    level: 3,
    tag: 'applied',
    mode: 'next',
    hint: 'next',
    sets: [
      [1, 2, 4, 8],
      [1, 2, 3, 6],
      [1, 2, 4],
      [1, 2, 4, 8, 16],
      [1, 2, 3],
      [1, 2, 4, 7],
    ],
  },
  {
    level: 4,
    tag: 'applied',
    mode: 'cards',
    hint: 'cards',
    sets: [
      [1, 2, 4, 8],
      [1, 2, 4, 8, 16],
    ],
    small: [1, 2, 4],
  },
  { level: 5, tag: 'challenge', mode: 'magic', hint: 'magic', digits: 3, small: 2 },
  { level: 6, tag: 'challenge', mode: 'make', hint: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

export const solutionOf = (board) => solve(board);

/** 불 하나만 켜서 되는 수(불의 수 그대로)는 빼고, count개를 고른다. 가장 큰 불이 있어야 되는 수가 하나 이상 든다 */
function pickTargets(lamps, count, rng) {
  const total = sumOf(lamps);
  const biggest = lamps[lamps.length - 1];
  const pool = [];
  for (let n = 1; n <= total; n++) if (!lamps.includes(n)) pool.push(n);
  for (let tries = 0; tries < 200; tries++) {
    const picked = [];
    while (picked.length < Math.min(count, pool.length)) {
      const n = pool[randInt(rng, 0, pool.length - 1)];
      if (!picked.includes(n)) picked.push(n);
    }
    if (picked.some((n) => n > biggest) && picked.some((n) => n < biggest)) return picked.sort((a, b) => a - b);
  }
  return pool.slice(0, count);
}

/** 카드에서 선생님이 고르는 수: 서로 다르고, 맨 앞의 수(불 하나)만으로 되는 수는 고르지 않는다 */
export function pickSecrets(lamps, rng, count = SECRET_COUNT) {
  const total = sumOf(lamps);
  const pool = [];
  for (let n = 1; n <= total; n++) if (!lamps.includes(n)) pool.push(n);
  const picked = [];
  while (picked.length < Math.min(count, pool.length)) {
    const n = pool[randInt(rng, 0, pool.length - 1)];
    if (!picked.includes(n)) picked.push(n);
  }
  return picked;
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 그 단계의 작은 판(불이 적거나 두 자리 마술)
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  const rng = createRng(seedFrom('lamps', level, seed, small ? 'small' : ''));
  const pickSet = () => {
    const set = rung.sets[(((seed - 1) % rung.sets.length) + rung.sets.length) % rung.sets.length];
    // 작은 판: 정해 둔 작은 불이 있으면 그것, 없으면 가장 큰 불 하나를 뺀다
    if (!small) return set.slice();
    return (rung.small ?? set.slice(0, -1)).slice();
  };
  let board;
  if (rung.mode === 'magic') board = { kind: 'magic', digits: small ? rung.small : rung.digits };
  else if (rung.mode === 'targets') {
    if (seed === 1 && !small) board = JSON.parse(JSON.stringify(rung.first));
    else {
      const lamps = pickSet();
      board = { kind: 'targets', lamps, targets: pickTargets(lamps, small ? 3 : rung.count, rng) };
    }
  } else if (rung.mode === 'cards') {
    const lamps = pickSet();
    board = { kind: 'cards', lamps, secrets: pickSecrets(lamps, rng) };
  } else board = { kind: rung.mode, lamps: pickSet() };
  const problem = checkBoard(board);
  if (problem) throw new Error(`쓸 수 있는 판이 없어요: ${level}단계 ${seed}번(${problem})`);
  return { level, seed, small, board, solution: solutionOf(board) };
}

const sameBoard = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 다음 판 번호. 방금 한 판과 똑같은 판이 나오는 번호는 건너뛴다(숫자 마술은 판이 늘 같아서 다음 번호를 그대로 쓴다). */
export function nextSeed(level, seed, options = {}) {
  const now = generateBoard(level, seed, options).board;
  for (let next = seed + 1; next < seed + 40; next++) {
    if (!sameBoard(generateBoard(level, next, options).board, now)) return next;
  }
  return seed + 1;
}

/**
 * "더 작은 판"의 재료: 같은 종류의 판에서 불을 하나씩 뺀 판들(원래 판에 가까운 것부터).
 *   targets  가장 큰 불을 빼고(불 셋까지), 남은 불로 되는 적힌 수를 두고 모자라면 작은 수부터 채운다(셋까지)
 *   reach    가장 큰 불을 뺀다(불 둘까지)
 *   next     가장 큰 불을 뺀다(불 둘까지). 빈 곳 없는 불이 그대로 빈 곳이 없다
 *   cards    카드를 한 장씩 뺀다(석 장까지). 선생님의 수는 남은 카드에 있는 것을 두고 다시 고른다
 *   magic    세 자리는 두 자리로
 */
export function smallBoards(board) {
  if (board.kind === 'magic') return board.digits === 3 ? [{ kind: 'magic', digits: 2 }] : [];
  const list = [];
  const floor = { targets: 3, reach: 2, next: 2, cards: 3 }[board.kind];
  for (let count = board.lamps.length - 1; count >= floor; count--) {
    const lamps = board.lamps.slice(0, count);
    const total = sumOf(lamps);
    if (board.kind === 'targets') {
      const kept = board.targets.filter((n) => n <= total && !lamps.includes(n));
      for (let n = 1; n <= total && kept.length < 3; n++) if (!lamps.includes(n) && !kept.includes(n)) kept.push(n);
      list.push({ kind: 'targets', lamps, targets: kept.slice(0, 3).sort((a, b) => a - b) });
    } else if (board.kind === 'cards') {
      if (!isDoubling(lamps)) continue;
      const rng = createRng(seedFrom('lamps-smaller', JSON.stringify(board), count));
      list.push({ kind: 'cards', lamps, secrets: pickSecrets(lamps, rng) });
    } else list.push({ kind: board.kind, lamps });
  }
  return list.filter((item) => checkBoard(item) === null);
}
