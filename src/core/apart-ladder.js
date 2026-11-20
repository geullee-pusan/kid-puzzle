// 닿지 않게 놓기와 구역 긋기의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 판마다 풀이 프로그램의 결과(가장 많이 놓는 수, 가장 적은 구역 수)를 붙여 내보낸다.
//
// 단계마다 정해 둔 판을 판 번호 차례로 돈다. 3단계만은 정해 둔 판을 한 번 돈 뒤에 시드 난수(rng.js)로 칸을 몇 개 뺀 판을 만든다.
// 만든 판은 칸이 변으로 이어져 있고, 아무렇게나 놓았을 때 가장 많이 놓는 수에 닿는 비율이 낮은 판만 낸다(전략 9.1절).
// 구역을 그어 둔 판(4단계)과 구역을 긋는 판(5단계)은 가장 적은 구역 수가 가장 많이 놓는 수와 같은 판만 쓴다(테스트가 확인한다).
import { boardFromRows, cellsOf, connected, reachRate, solve } from './apart.js';
import { createRng, randInt, seedFrom } from './rng.js';

/** 모양 판(그림 글자: '#'은 칸, '.'은 빠진 칸) */
export const SHAPES = {
  cross: ['.###.', '#####', '#####', '#####', '.###.'],
  diamond: ['..#..', '.###.', '#####', '.###.', '..#..'],
  bigDiamond: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
  zig: ['###...', '####..', '.####.', '..####', '...###'],
  frame: ['#####', '#...#', '#...#', '#...#', '#####'],
  comb: ['#.#.#', '#####', '#.#.#', '#####', '#.#.#'],
  stairs: ['#....', '##...', '###..', '####.', '#####'],
  dots: ['#####', '#.###', '#####', '###.#', '#####'],
};

const rect = (w, h, touch = 'king') => ({ w, h, holes: [], touch, regions: null });
const shape = (name) => boardFromRows(SHAPES[name], 'king');

/**
 * 사다리.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'place'(구슬을 놓는다) | 'shown'(선생님이 그어 둔 구역이 있는 판에 놓는다) | 'prove'(놓고, 구역을 그어 더 놓을 수 없다는 것을 보인다) | 'make'(직접 만든다)
 *   hint    그 단계에서 쓰는 규칙 글과 힌트 묶음의 이름
 *   boards  판의 차례
 *   pool    정해 둔 판을 한 번 돈 뒤에 시드 난수로 판을 만드는가
 *
 * 1단계는 변만 닿지 않으면 되고, 2단계부터 꼭짓점도 닿지 않아야 한다. 1단계의 첫 판(3×3)은 어떻게 놓아도 한 번이 끝난다.
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'place', hint: 'side', boards: [rect(3, 3, 'side'), rect(4, 3, 'side'), rect(5, 3, 'side'), rect(4, 4, 'side'), rect(5, 4, 'side')] },
  { level: 2, tag: 'basic', mode: 'place', hint: 'king', boards: [rect(3, 3), rect(4, 3), rect(5, 3), rect(5, 4), rect(4, 5)] },
  { level: 3, tag: 'applied', mode: 'place', hint: 'king', boards: [rect(5, 5), shape('cross'), shape('zig'), shape('frame'), shape('comb'), shape('bigDiamond')], pool: true },
  { level: 4, tag: 'applied', mode: 'shown', hint: 'shown', boards: [rect(5, 4), rect(5, 5), shape('cross'), shape('zig'), shape('dots'), rect(6, 5)] },
  { level: 5, tag: 'challenge', mode: 'prove', hint: 'prove', boards: [rect(3, 3), rect(5, 3), shape('diamond'), rect(5, 5), shape('stairs'), shape('cross')] },
  { level: 6, tag: 'challenge', mode: 'make', hint: 'king' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 1단계에서 "작은 판부터"일 때 내는 판(수준 맞추기에서 쓴다) */
export const SMALL_BOARD = rect(3, 2, 'side');

/** 3단계에서 만드는 판의 바탕 크기, 빼는 칸 수, 비율의 위 끝, 가장 많이 놓는 수의 아래 끝 */
export const POOL = { sizes: [[5, 5], [6, 5], [5, 6], [6, 6], [7, 5]], holes: [2, 5], rate: 0.15, least: 6 };
/** 판 하나를 만들려고 다시 뽑아 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 400;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 3단계에서 판 번호로 만드는 판: 바탕 네모에서 칸을 몇 개 뺀다 */
export function poolBoard(level, seed) {
  const rng = createRng(seedFrom('apart', level, seed));
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const [w, h] = POOL.sizes[randInt(rng, 0, POOL.sizes.length - 1)];
    const count = randInt(rng, POOL.holes[0], POOL.holes[1]);
    const holes = new Set();
    while (holes.size < count) holes.add(randInt(rng, 0, w * h - 1));
    const board = { w, h, holes: [...holes].sort((a, b) => a - b), touch: 'king', regions: null };
    if (!connected(board)) continue;
    if (solve(board).best < POOL.least) continue;
    if (reachRate(board) > POOL.rate) continue;
    return board;
  }
  throw new Error('판을 만들지 못했어요');
}

/** 그 단계의 판 하나(구역을 그어 두는 단계면 가장 적은 구역도 붙인다) */
function boardAt(rung, seed) {
  const count = rung.boards.length;
  const base = rung.pool && seed > count ? poolBoard(rung.level, seed) : rung.boards[(((seed - 1) % count) + count) % count];
  const board = { ...base, holes: base.holes.slice(), regions: null };
  if (rung.mode === 'shown') board.regions = solve(board).regions;
  return board;
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 가장 작은 판을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object, solution: {best: number, cover: number}}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  const board = shrink ? { ...SMALL_BOARD, holes: [] } : boardAt(rung, seed);
  const { best, cover } = solve(board);
  return { level, seed, small, board, solution: { best, cover } };
}

const sameBoard = (a, b) => a.w === b.w && a.h === b.h && a.touch === b.touch && a.holes.join(',') === b.holes.join(',');

/** 다음 판 번호. 방금 한 판과 같은 판이 나오는 번호는 건너뛴다 */
export function nextSeed(level, seed) {
  const rung = rungOf(level);
  if (rung.mode === 'make') return seed + 1;
  const before = boardAt(rung, seed);
  let next = seed + 1;
  while (sameBoard(boardAt(rung, next), before)) next += 1;
  return next;
}

/** 판의 칸 수(그림과 테스트에서 쓴다) */
export const cellCount = (board) => cellsOf(board).length;
