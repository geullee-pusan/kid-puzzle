// 공정한 게임일까의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 규칙은 아래의 규칙 모음에서 고르고(글은 대본의 games에 있다),
// 아이가 던질 열 번과 컴퓨터의 첫 1,000번의 시드를 시드 난수로 고른다(src/core/fair.js의 pickSeeds).
//   - 판 번호를 3으로 나눈 나머지가 2인 판은 열 번이 헷갈리게 나오는 판이다(공정한데 한쪽이 4번 넘게 많거나, 유리한 쪽이 많지 않다).
//     나머지 판은 열 번이 판정대로 보인다. 한쪽이 아주 유리한 규칙(차가 경우의 절반 넘게)은 열 번이 헷갈리는 일이 드물어서 늘 판정대로 둔다.
//   - 컴퓨터의 첫 1,000번은 늘 모든 경우를 센 판정과 맞는다(공정하면 두 수의 차가 40 이하, 아니면 유리한 쪽이 40 넘게 많다. 테스트가 본다).
// 누가 유리한지는 늘 모든 경우를 세어서 정한다. 사다리의 규칙은 공정하거나, 한쪽이 경우의 9분의 1 넘게 많아서 1,000번이면 드러난다.
import { checkBoard, countCases, pickSeeds, sameBoard } from './fair.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 규칙 모음. 이름(대본의 games에 같은 이름의 글이 있다) → 규칙.
 * a는 다람쥐가 가져가는 값들이다. 나머지는 고슴도치가 가져간다.
 */
export const RULES = {
  // 동전 둘·셋
  'coin2-same': { device: 'coin2', measure: 'same', a: ['same'] },
  'coin2-both': { device: 'coin2', measure: 'heads', a: [2] },
  'coin2-any': { device: 'coin2', measure: 'heads', a: [1, 2] },
  'coin3-two': { device: 'coin3', measure: 'heads', a: [2, 3] },
  'coin3-same': { device: 'coin3', measure: 'same', a: ['same'] },
  'coin3-one': { device: 'coin3', measure: 'heads', a: [1] },
  // 주사위 하나
  'die1-small': { device: 'die1', measure: 'face', a: [1, 2] },
  'die1-even': { device: 'die1', measure: 'face', a: [2, 4, 6] },
  'die1-six': { device: 'die1', measure: 'face', a: [6] },
  'die1-low': { device: 'die1', measure: 'face', a: [1, 2, 3] },
  'die1-big': { device: 'die1', measure: 'face', a: [3, 4, 5, 6] },
  'die1-ends': { device: 'die1', measure: 'face', a: [1, 6] },
  // 주사위 둘의 합
  'sum-seven': { device: 'die2', measure: 'sum', a: [7] },
  'sum-even': { device: 'die2', measure: 'sumParity', a: ['even'] },
  'sum-eight': { device: 'die2', measure: 'sum', a: [8, 9, 10, 11, 12] },
  'sum-upper': { device: 'die2', measure: 'sum', a: [7, 8, 9, 10] },
  'sum-middle': { device: 'die2', measure: 'sum', a: [5, 6, 7, 8, 9] },
  'sum-near': { device: 'die2', measure: 'sum', a: [6, 7, 8] },
  'sum-lower': { device: 'die2', measure: 'sum', a: [4, 5, 6, 7] },
  'sum-three': { device: 'die2', measure: 'sum', a: [3, 6, 9, 12] },
  // 주사위 둘의 곱, 차, 큰 눈
  'prod-even': { device: 'die2', measure: 'prodParity', a: ['even'] },
  'diff-one-two': { device: 'die2', measure: 'diff', a: [1, 2] },
  'max-four': { device: 'die2', measure: 'max', a: [4, 5, 6] },
  'diff-small': { device: 'die2', measure: 'diff', a: [0, 1] },
  'prod-odd': { device: 'die2', measure: 'prodParity', a: ['odd'] },
  'max-four-six': { device: 'die2', measure: 'max', a: [4, 6] },
  'diff-big': { device: 'die2', measure: 'diff', a: [2, 3, 4, 5] },
  'max-six': { device: 'die2', measure: 'max', a: [6] },
  // 고칠 규칙(한 군데만 바꿔서 공정해지는 곳이 있다)
  'fix-sum-low': { device: 'die2', measure: 'sum', a: [2, 3, 4, 5, 6] },
  'fix-sum-high': { device: 'die2', measure: 'sum', a: [8, 9, 10, 11, 12] },
  'fix-diff': { device: 'die2', measure: 'diff', a: [0, 1] },
  'fix-max': { device: 'die2', measure: 'max', a: [6] },
  'fix-sum-up': { device: 'die2', measure: 'sum', a: [7, 8, 9, 10, 11, 12] },
  'fix-diff-big': { device: 'die2', measure: 'diff', a: [2, 3, 4, 5] },
  'fix-sum-middle': { device: 'die2', measure: 'sum', a: [5, 6, 7, 8, 9] },
  'fix-coin3': { device: 'coin3', measure: 'heads', a: [3] },
  'fix-die1': { device: 'die1', measure: 'face', a: [1, 2] },
};

/**
 * 사다리.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   'judge'(공정한지 고르기) | 'fix'(규칙 고치기) | 'make'(직접 만들기)
 *   names  이 단계에서 쓰는 규칙(판 번호 1부터 이 차례로, 한 바퀴 돈 뒤에는 섞어서)
 *   hint   힌트와 처음 화면의 물음을 고르는 이름
 *
 * 1단계 동전 던지기(동전 둘·셋, 1번 판은 "같은 면이면 다람쥐" 공정한 게임), 2단계 주사위 하나, 3단계 두 주사위의 합,
 * 4단계 두 주사위의 곱·차·큰 눈, 5단계 규칙 고치기(한 군데만 바꿔서 공정하게. 끝난 뒤 까닭을 남길 수 있다), 6단계 직접 만들기.
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'judge', hint: 'coins', names: ['coin2-same', 'coin2-both', 'coin3-two', 'coin2-any', 'coin3-same', 'coin3-one'] },
  { level: 2, tag: 'basic', mode: 'judge', hint: 'die', names: ['die1-small', 'die1-even', 'die1-six', 'die1-low', 'die1-big', 'die1-ends'] },
  { level: 3, tag: 'applied', mode: 'judge', hint: 'dice', names: ['sum-seven', 'sum-even', 'sum-eight', 'sum-upper', 'sum-middle', 'sum-near', 'sum-lower', 'sum-three'] },
  { level: 4, tag: 'applied', mode: 'judge', hint: 'dice', names: ['prod-even', 'diff-one-two', 'max-four', 'diff-small', 'prod-odd', 'max-four-six', 'diff-big', 'max-six'] },
  { level: 5, tag: 'challenge', mode: 'fix', hint: 'fix', names: ['fix-sum-low', 'fix-diff', 'fix-sum-high', 'fix-max', 'fix-sum-up', 'fix-diff-big', 'fix-sum-middle'] },
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

/** 한쪽이 아주 유리한 규칙(차가 경우의 절반 넘게): 열 번이 헷갈리게 나오는 일이 드물다 */
export function lopsided(rule) {
  const { a, b, total } = countCases(rule);
  return Math.abs(a - b) * 2 > total;
}

/** 판 번호에 따라 바라는 열 번의 모습 */
export function lookFor(rule, seed) {
  if (seed % 3 === 2 && !lopsided(rule)) return 'mislead';
  return 'honest';
}

/** 이름 있는 규칙으로 판을 만든다. key는 시드를 고르는 글자(같은 key는 늘 같은 판) */
export function boardOf(name, mode, key, look) {
  const rule = RULES[name];
  const seeds = pickSeeds(rule, key, look);
  return { mode, rule: { ...rule, a: rule.a.slice() }, name, throws: seeds.throws, many: seeds.many };
}

/** 판 번호 → 규칙 이름: 첫 바퀴는 적힌 차례, 그다음 바퀴부터는 바퀴마다 섞는다 */
function nameAt(rung, seed) {
  const count = rung.names.length;
  const lap = Math.floor((seed - 1) / count);
  const at = (seed - 1) % count;
  if (lap === 0) return rung.names[at];
  const items = rung.names.slice();
  const rng = createRng(seedFrom('fair-lap', rung.level, lap));
  for (let index = items.length - 1; index > 0; index--) {
    const other = randInt(rng, 0, index);
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items[at];
}

function boardAt(rung, seed) {
  const name = nameAt(rung, seed);
  const board = boardOf(name, rung.mode, `${rung.level}|${seed}`, lookFor(RULES[name], seed));
  if (checkBoard(board) !== null) throw new Error(`쓸 수 없는 판이에요: ${rung.level}단계 ${seed}번`);
  return board;
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 1번 판(동전 둘, 공정한 게임)을 낸다(수준 맞추기에서 쓴다)
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  return { level, seed, small: shrink, board: boardAt(rung, shrink ? 1 : seed) };
}

/** 다음 판 번호. 방금 한 판과 규칙이 같은 판이 나오는 번호는 건너뛴다 */
export function nextSeed(level, seed) {
  const rung = rungOf(level);
  if (rung.mode === 'make') return seed + 1;
  const before = nameAt(rung, seed);
  let next = seed + 1;
  while (nameAt(rung, next) === before) next += 1;
  return next;
}

// ---- 더 작은 판: 경우가 더 적은 같은 종류의 판 ----

/** 던지는 것마다 더 작은 판에 쓰는 규칙(경우가 적은 것) */
const SMALL = {
  judge: { die2: ['die1-low', 'coin2-same', 'die1-small', 'coin2-both'], die1: ['coin2-same', 'coin2-both'], coin3: ['coin2-same', 'coin2-both'], coin2: [] },
  fix: { die2: ['fix-die1', 'fix-coin3'], die1: [], coin3: [], coin2: [] },
};

/**
 * 더 작은 판들: 경우가 더 적은 던지는 것(주사위 둘 → 주사위 하나나 동전 둘, 주사위 하나와 동전 셋 → 동전 둘)의 같은 종류의 판.
 * 동전 둘의 판(경우 넷)과 고칠 판 가운데 주사위 하나·동전 셋의 판에는 더 작은 판이 없다.
 * @param {object} origin { mode, board }
 * @returns {{yes: object[], no: object[]}}
 */
export function smallBoards(origin) {
  const { board } = origin;
  const names = SMALL[board.mode]?.[board.rule.device] ?? [];
  const yes = names.map((name, index) => boardOf(name, board.mode, `small|${board.throws}|${index}`, 'honest')).filter((item) => !sameBoard(item, board));
  return { yes, no: [] };
}
