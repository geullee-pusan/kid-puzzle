// 숨은 규칙 찾기의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 처음 받는 "돼요"는 정해 둔 것이거나 시드 난수로 고른다.
import { checkBoard, classesOf, fitting, holds, ruleFits, signatureOf, solve, universeOf } from './rulehunt.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   'number'(수 하나씩) | 'triple'(세 수) | 'make'(직접 만들기)
 *   hint   힌트와 처음 화면의 물음, 규칙 글을 고르는 이름
 *   top    수의 범위의 위 끝, small: 수준 맞추기가 "작은 판부터"라고 할 때의 범위
 *   lib    선생님이 견주어 보는 후보 규칙의 목록(src/core/rulehunt.js)
 *   rules  판 번호가 달라지면 차례로 도는 숨은 규칙. boards가 있으면 처음 받는 것까지 정해 둔 판이 돈다
 *   first  판 번호 1에 내는 판
 *
 * 1단계: 성질 하나(짝수, 5의 배수, 15보다 큰 수, 일의 자리가 3인 수 …). 처음에 돼요인 수 셋을 받는다. 1~30.
 * 2단계: 처음 받은 수로 떠오르는 생각이 너무 좁거나 너무 넓은 판(4, 8, 16인데 짝수, 7, 17, 27인데 일의 자리가 7). 1~50.
 * 3단계: 성질 둘을 이은 규칙(짝수이면서 20보다 작은 수, 3의 배수이거나 일의 자리가 5인 수). 1~50.
 * 4단계: 세 수를 한 묶음으로 묻는다(처음 받는 것은 2, 4, 6 같은 세 수). 1~20.
 * 5단계: 직접 만들기. 규칙을 고르면 선생님이 물어서 찾는다.
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'number', hint: 'one', top: 30, small: 20, lib: 'one', first: { rule: 'even', given: [2, 4, 6] }, rules: ['m5', 'gt15', 'd3', 'm3', 'odd', 'lt10', 'm4', 'd7', 'gt20', 'even'] },
  {
    level: 2,
    tag: 'applied',
    mode: 'number',
    hint: 'trap',
    top: 50,
    small: 30,
    lib: 'one',
    boards: [
      { rule: 'even', given: [4, 8, 16] },
      { rule: 'odd', given: [3, 13, 23] },
      { rule: 'm5', given: [10, 20, 30] },
      { rule: 'd7', given: [7, 17, 27] },
      { rule: 'gt10', given: [15, 25, 35] },
      { rule: 'lt10', given: [2, 4, 6] },
      { rule: 'm3', given: [12, 24, 36] },
      { rule: 'gt20', given: [21, 23, 25] },
    ],
  },
  { level: 3, tag: 'applied', mode: 'number', hint: 'both', top: 50, small: 30, lib: 'two', rules: ['even&lt20', 'm3|d5', 'odd&gt30', 'm5&lt30', 'even|m5', 'm4|d1', 'odd&lt15', 'm3&gt25'] },
  {
    level: 4,
    tag: 'challenge',
    mode: 'triple',
    hint: 'triple',
    top: 20,
    small: 10,
    lib: 'triple',
    boards: [
      { rule: 'inc', given: [[2, 4, 6]] },
      { rule: 'lastbig', given: [[3, 6, 9]] },
      { rule: 'alldiff', given: [[5, 10, 15]] },
      { rule: 'firstsmall', given: [[1, 5, 9]] },
      { rule: 'sumeven', given: [[4, 8, 12]] },
      { rule: 'inc', given: [[10, 12, 14]] },
    ],
  },
  { level: 5, tag: 'challenge', mode: 'make', hint: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 4;
export const MAKE_LEVEL = 5;
/** 처음 받는 "돼요"의 수(시드 난수로 고르는 판) */
export const GIVEN_COUNT = 3;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 판의 풀이: 숨은 규칙과, 처음 받은 것만으로는 가를 수 없는 다른 규칙들 */
export const solutionOf = (board) => solve(board);

/**
 * 처음 받는 "돼요": 범위에서 숨은 규칙이 돼요인 수 가운데 셋을 시드 난수로 골라 작은 것부터 놓는다.
 * 세 수 판은 하나를 고르되, 다른 세 수의 규칙도 가장 많이 맞는 것(떠오르는 생각이 여럿인 것) 가운데서 고른다.
 */
function randomGiven(rng, rule, kind, top) {
  const yes = universeOf({ kind, top }).filter((item) => holds(rule, item));
  if (kind === 'triple') {
    const fits = yes.map((item) => fitting({ kind, top, rule, given: [item], lib: 'triple' }, [item]).rivals.length);
    const most = yes.filter((_, at) => fits[at] === Math.max(...fits));
    return most.length > 0 ? [most[randInt(rng, 0, most.length - 1)]] : [];
  }
  const picked = [];
  while (picked.length < Math.min(GIVEN_COUNT, yes.length)) {
    const x = yes[randInt(rng, 0, yes.length - 1)];
    if (!picked.includes(x)) picked.push(x);
  }
  return picked.sort((a, b) => a - b);
}

/** 정해 둔 것(규칙의 이름표 또는 { rule, given })으로 판을 만든다. 쓸 수 없으면 null */
function boardOf(pick, rung, top, rng) {
  const rule = typeof pick === 'string' ? pick : pick.rule;
  if (!ruleFits(rule, rung.mode, top)) return null;
  const inRange = (item) => (Array.isArray(item) ? item.every((x) => x <= top) : item <= top);
  let given = typeof pick === 'string' ? randomGiven(rng, rule, rung.mode, top) : pick.given.filter(inRange).map((item) => (Array.isArray(item) ? item.slice() : item));
  // 작은 범위에서 처음 받은 것이 다 빠지면 그 범위에서 다시 고른다.
  if (given.length === 0) given = randomGiven(rng, rule, rung.mode, top);
  const board = { kind: rung.mode, top, rule, given, lib: rung.lib };
  if (checkBoard(board) !== null) return null;
  // 돼요와 안 돼요가 셋 이상씩 있어야 한다. 둘을 이은 규칙은 그 범위에서 성질 하나짜리와 같아지면 쓰지 않는다.
  const truth = universeOf(board).filter((item) => holds(rule, item)).length;
  if (truth < GIVEN_COUNT || board.top ** (rung.mode === 'triple' ? 3 : 1) - truth < GIVEN_COUNT) return null;
  if (rung.lib === 'two' && classesOf({ ...board, lib: 'one' }).some((group) => group.bits === signatureOf(board, rule))) return null;
  return board;
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~4
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 그 단계의 작은 범위로 낸다(수준 맞추기에서 쓴다)
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  const top = small ? rung.small : rung.top;
  const rng = createRng(seedFrom('rulehunt', level, seed, small ? 'small' : ''));
  // 판 번호 1에 정해 둔 판이 있으면 2부터 차례의 처음이다. 작은 범위에서 쓸 수 없는 규칙(경계가 범위 밖 등)은 다음 것으로 넘긴다.
  const list = rung.boards ?? rung.rules;
  const count = list.length;
  const at = seed - (rung.first ? 2 : 1);
  const picks = seed === 1 && rung.first ? [rung.first, ...list] : Array.from({ length: count }, (_, step) => list[(((at + step) % count) + count) % count]);
  for (const pick of picks) {
    const board = boardOf(pick, rung, top, rng);
    if (board) return { level, seed, small, board, solution: solutionOf(board) };
  }
  throw new Error(`쓸 수 있는 판이 없어요: ${level}단계 ${seed}번`);
}

const sameBoard = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 다음 판 번호. 방금 한 판과 똑같은 판이 나오는 번호는 건너뛴다. */
export function nextSeed(level, seed, options = {}) {
  const now = generateBoard(level, seed, options).board;
  for (let next = seed + 1; next < seed + 40; next++) {
    if (!sameBoard(generateBoard(level, next, options).board, now)) return next;
  }
  return seed + 1;
}
