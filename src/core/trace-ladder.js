// 한붓그리기의 사다리(단계)와 그림 만들어 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 그림. 같은 번호는 늘 같은 그림이다. 풀이 프로그램으로 확인한 그림만 내보낸다.
import { createRng, randInt, seedFrom } from './rng.js';
import { crossesEdge, degreesOf, fixesOf, passesPoint, solve } from './trace.js';

/**
 * 안 되는 그림이 섞이는 단계에서 안 되는 그림의 비율. 임시값이다(셋에 하나쯤).
 * 늘 되거나 늘 안 되면 해 보지 않고 찍게 된다.
 */
export const IMPOSSIBLE_RATE = 1 / 3;

/**
 * 사다리. 기획 문서의 표를 옮겼다.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   'draw'(끝까지 긋거나 "불가능해요") | 'judge'(긋지 않고 가리기) | 'start'(시작점 고르기)
 *          | 'fix'(선 하나를 더하거나 빼서 고치기) | 'make'(아이가 직접 만든다)
 *   counts 점의 수의 후보
 *   grid   점을 놓을 격자의 [가로 칸 수, 세로 칸 수]
 *   extra  한 덩어리로 이은 뒤에 더 긋는 선의 수의 [아래 끝, 위 끝]. 클수록 갈림길이 많다
 *   mix    true면 안 되는 그림을 IMPOSSIBLE_RATE만큼 섞는다
 *
 * 점의 수, 격자의 크기, 더 긋는 선의 수는 임시로 정한 것이다(3단계와 4단계의 5~7개는 기획 문서에 없다).
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'draw', counts: [4, 5, 6], grid: [3, 3], extra: [1, 3], mix: true },
  { level: 2, tag: 'applied', mode: 'judge', counts: [6, 7, 8], grid: [4, 3], extra: [2, 3], mix: true },
  { level: 3, tag: 'applied', mode: 'start', counts: [5, 6, 7], grid: [4, 3], extra: [2, 3], mix: false },
  { level: 4, tag: 'challenge', mode: 'fix', counts: [5, 6, 7], grid: [4, 3], extra: [2, 3], mix: false },
  { level: 5, tag: 'challenge', mode: 'make' },
];

/** 그림을 만들어 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 4;
export const MAKE_LEVEL = 5;

/**
 * 직접 만들기의 점 여섯 개의 자리(임시). 어느 세 점도 한 줄에 놓이지 않아서,
 * 두 점을 잇는 선이 다른 점 위를 지나는 일이 없다.
 */
export const MAKE_POINTS = [
  [1, 0],
  [3, 0],
  [4, 1],
  [3, 2],
  [1, 2],
  [0, 1],
];

/** 선 하나가 가로나 세로로 건너갈 수 있는 칸 수의 위 끝(임시). 너무 긴 선은 그림을 어지럽힌다. */
const MAX_REACH = 2;
/** 한 그림을 고르려고 다시 뽑아 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다). */
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

/**
 * 격자 위에 점 n개를 놓고 선을 긋는다. 한 덩어리가 되지 않으면 null.
 * 지키는 것: 같은 두 점 사이에 선은 하나, 선이 다른 점 위를 지나지 않는다, 선끼리 엇갈리지 않는다.
 */
export function randomFigure(rng, n, [columns, rows], [fewest, most]) {
  const cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) cells.push([x, y]);
  // 점 번호는 위에서 아래로, 왼쪽에서 오른쪽으로 붙인다.
  const points = shuffle(rng, cells)
    .slice(0, n)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);

  const pairs = [];
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      if (Math.abs(points[a][0] - points[b][0]) > MAX_REACH || Math.abs(points[a][1] - points[b][1]) > MAX_REACH) continue;
      if (!passesPoint(points, a, b)) pairs.push([a, b]);
    }
  }
  const order = shuffle(rng, pairs);
  const figure = { points, edges: [] };

  // 먼저 모든 점을 한 덩어리로 잇는다.
  const group = points.map((_, index) => index);
  const find = (index) => (group[index] === index ? index : (group[index] = find(group[index])));
  const rest = [];
  for (const [a, b] of order) {
    if (find(a) === find(b) || crossesEdge(figure, a, b)) {
      rest.push([a, b]);
      continue;
    }
    group[find(a)] = find(b);
    figure.edges.push([a, b]);
  }
  if (figure.edges.length !== n - 1) return null;

  // 그다음 선을 몇 개 더 긋는다.
  let extra = randInt(rng, fewest, most);
  for (const [a, b] of rest) {
    if (extra === 0) break;
    if (crossesEdge(figure, a, b)) continue;
    figure.edges.push([a, b]);
    extra -= 1;
  }
  // 더 그을 자리가 모자라면 이 그림은 버린다.
  if (extra > 0) return null;
  figure.edges.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  return figure;
}

/** 너무 뻔한 그림을 거른다: 선이 서너 개뿐인 그림, 갈림길이 없는 그림(한 줄, 고리 하나) */
export function tooPlain(figure) {
  if (figure.edges.length < Math.max(5, figure.points.length)) return true;
  return Math.max(...degreesOf(figure)) < 3;
}

/**
 * 그림 하나를 만든다.
 * @param {number} level 1~4
 * @param {number} seed 판 번호
 * @param {{small?: boolean}} options small: 그 단계에서 점이 적은 그림을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: {points: number[][], edges: number[][]}, solution: object, fixes?: object[]}}
 *   solution 풀이 프로그램의 결과. fixes는 4단계에서만: 한 군데 고쳐서 되는 그림으로 만드는 방법들
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 그림을 만들어 내지 않아요');
  const rng = createRng(seedFrom('trace', level, seed, small ? 'small' : 'any'));
  const counts = small ? rung.counts.slice(0, 2) : rung.counts;
  // 되는 그림을 낼지 안 되는 그림을 낼지 먼저 정하고, 풀이 프로그램이 그렇다고 할 때까지 다시 뽑는다.
  const wantImpossible = rung.mix && rng() < IMPOSSIBLE_RATE;
  let fallback = null;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const n = counts[randInt(rng, 0, counts.length - 1)];
    const board = randomFigure(rng, n, rung.grid, rung.extra);
    if (!board || tooPlain(board)) continue;
    const solution = solve(board);
    if (rung.mode === 'start') {
      // 시작할 수 있는 점이 꼭 둘인 그림만
      if (solution.possible && solution.starts.length === 2) return { level, seed, small, board, solution };
      continue;
    }
    if (rung.mode === 'fix') {
      // 선 하나를 더하거나 빼서 고칠 수 있는 안 되는 그림만
      if (solution.possible) continue;
      const fixes = fixesOf(board);
      if (fixes.length > 0) return { level, seed, small, board, solution, fixes };
      continue;
    }
    if (!fallback) fallback = { level, seed, small, board, solution };
    if (solution.possible === !wantImpossible) return { level, seed, small, board, solution };
  }
  if (!fallback) throw new Error(`그림을 만들지 못했어요: ${level}단계 ${seed}번`);
  return fallback;
}

const sameFigure = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 다음 판 번호. 방금 한 그림과 똑같은 그림이 나오는 번호는 건너뛴다. */
export function nextSeed(level, seed, options = {}) {
  const now = generateBoard(level, seed, options).board;
  for (let next = seed + 1; next < seed + 40; next++) {
    if (!sameFigure(generateBoard(level, next, options).board, now)) return next;
  }
  return seed + 1;
}
