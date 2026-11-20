// 팬케이크 뒤집기의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 더미는 시드 난수(rng.js)로 섞고, 풀이 프로그램이 잣대에 맞는다고 확인한 판만 낸다.
//
// 고르는 잣대
//   - 가장 적은 뒤집기 횟수가 단계마다 정한 수 이상(한두 번에 끝나는 뻔한 판을 뺀다)
//   - 가장 적게 뒤집는 단계: 큰 것부터 보내기(src/core/pancake.js의 biggestFirst)로는 가장 적은 횟수보다 많이 걸리는 더미.
//     늘 되는 방법만 따라 해서는 가장 적은 횟수에 닿지 않아서, 더 줄일 거리가 있다
//   - 탄 면 단계: 가장 적은 횟수가 단계마다 정한 범위 안
// 모든 더미는 다 될 수 있다(뒤집기로 어떤 차례든 만들 수 있다). 그래서 안 되는 판이 없고 "불가능해요"도 없다.
import { biggestFirst, doneBoard, fewestOf, isDone, sameBoard } from './pancake.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag   'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode  'small'(서너 장 쌓기) | 'five'(다섯 장 쌓기) | 'fewest'(가장 적게 뒤집기) | 'big'(큰 더미 가장 적게)
 *         | 'burnt'(탄 면 팬케이크) | 'make'(직접 만든다)
 *   spec  판을 만드는 값: sizes(장 수의 후보), first(1번 판의 장 수), burnt(탄 면이 있는가)
 *   rule  고르는 잣대: least(장 수마다 가장 적은 횟수의 아래 끝), most(위 끝), beat(큰 것부터 보내기가 가장 적은 횟수보다 많아야 하는가)
 *   record  true면 다 쌓아도 가장 적은 횟수가 아니면 끝나지 않고 "더 적게 뒤집어 볼까요?"를 묻는다(기록 깨기)
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'small', spec: { sizes: [4], first: 3, burnt: false }, rule: { least: { 3: 2, 4: 3 } } },
  { level: 2, tag: 'basic', mode: 'five', spec: { sizes: [5], burnt: false }, rule: { least: { 5: 4 } } },
  { level: 3, tag: 'applied', mode: 'fewest', record: true, spec: { sizes: [4, 5, 5], first: 4, burnt: false }, rule: { least: { 4: 3, 5: 3 }, beat: true } },
  { level: 4, tag: 'applied', mode: 'big', record: true, spec: { sizes: [6, 7], first: 6, burnt: false }, rule: { least: { 6: 5, 7: 6 }, beat: true } },
  { level: 5, tag: 'challenge', mode: 'burnt', spec: { sizes: [3, 4, 4], first: 3, burnt: true }, rule: { least: { 2: 2, 3: 3, 4: 4 }, most: { 2: 4, 3: 5, 4: 6 } } },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 1단계에서 "작은 판부터"일 때의 장 수(수준 맞추기에서 쓴다) */
export const SMALL_SIZE = 3;

/** 가장 적게 뒤집는 판인가(다 쌓아도 가장 적은 횟수가 아니면 더 적게 해 볼지 묻는다). 직접 만든 판도 그렇다 */
export const recordMode = (mode) => mode === 'fewest' || mode === 'big' || mode === 'made';

/** 판 하나를 만들려고 다시 섞어 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 2000;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

function shuffle(rng, list) {
  const items = list.slice();
  for (let index = items.length - 1; index > 0; index--) {
    const other = randInt(rng, 0, index);
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

/** n장 더미 하나를 아무렇게나 섞는다(탄 면 판은 위아래도 아무렇게나) */
export function randomBoard(rng, n, burnt) {
  const done = doneBoard(n, burnt);
  const stack = shuffle(rng, done.stack);
  return { stack, up: burnt ? stack.map(() => (rng() < 0.5 ? 1 : 0)) : null };
}

/** 더미가 그 단계의 잣대에 맞는가 */
export function goodBoard(rung, board) {
  if (isDone(board)) return false;
  const n = board.stack.length;
  const fewest = fewestOf(board);
  if (fewest < (rung.rule.least[n] ?? 2)) return false;
  if (rung.rule.most && fewest > (rung.rule.most[n] ?? Infinity)) return false;
  if (rung.rule.beat && biggestFirst(board).length <= fewest) return false;
  return true;
}

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed, { small = false } = {}) {
  const rng = createRng(seedFrom('pancake', rung.level, seed, small ? 'small' : ''));
  const { spec } = rung;
  const n = small ? SMALL_SIZE : seed === 1 && spec.first ? spec.first : spec.sizes[randInt(rng, 0, spec.sizes.length - 1)];
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const board = randomBoard(rng, n, spec.burnt);
    if (goodBoard(rung, board)) return board;
  }
  throw new Error(`판을 만들지 못했어요: ${rung.level}단계 ${seed}번`);
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(세 장)을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object, solution: object}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  const board = boardAt(rung, seed, { small: shrink });
  return { level, seed, small: shrink, board, solution: { possible: true, fewest: fewestOf(board) } };
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

/**
 * 더 작은 판들: 원래 판과 같은 종류(탄 면이 있는지)로 장 수가 적은 판(다섯 장까지는 한 장, 여섯 장부터는 두 장 적게).
 * 가장 적은 횟수가 둘 이상이고 원래 판보다 많지 않은 판을 둘까지 만든다. 같은 판에는 늘 같은 판들이 나온다.
 * 탄 면이 없는 세 장 판보다 작게는 만들지 않는다(두 장은 한 번에 끝난다). 탄 면 판은 두 장까지 줄인다.
 * @param {object} origin { mode, board }
 * @returns {{yes: object[], no: object[]}}
 */
export function smallBoards(origin) {
  const { board } = origin;
  const n = board.stack.length;
  const burnt = board.up !== null;
  const floor = burnt ? 2 : 3;
  const size = Math.max(floor, n - (n >= 6 ? 2 : 1));
  if (size >= n) return { yes: [], no: [] };
  const top = fewestOf(board);
  const rng = createRng(seedFrom('pancake-small', JSON.stringify(board), origin.mode));
  const yes = [];
  for (let attempt = 0; attempt < MAX_TRIES && yes.length < 2; attempt++) {
    const small = randomBoard(rng, size, burnt);
    const fewest = fewestOf(small);
    if (isDone(small) || fewest < 2 || fewest > Math.max(2, top)) continue;
    if (yes.some((item) => sameBoard(item, small))) continue;
    yes.push(small);
  }
  return { yes, no: [] };
}
