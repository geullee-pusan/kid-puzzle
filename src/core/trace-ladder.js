// 한붓그리기의 사다리(단계)와 그림 만들어 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 그림. 같은 번호는 늘 같은 그림이다. 풀이 프로그램으로 확인한 그림만 내보낸다.
import { createRng, randInt, seedFrom } from './rng.js';
import { applyEdit, crossesEdge, degreesOf, editsOf, fixesOf, passesPoint, pieceCount, sideOf, solve, strokePlan } from './trace.js';

/**
 * 안 되는 그림이 섞이는 단계에서 안 되는 그림의 비율. 임시값이다(셋에 하나쯤).
 * 늘 되거나 늘 안 되면 해 보지 않고 찍게 된다.
 */
export const IMPOSSIBLE_RATE = 1 / 3;

/**
 * 사다리. 기획 문서의 표를 옮겼다.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   'draw'(끝까지 긋거나 "불가능해요") | 'judge'(긋지 않고 가리기) | 'start'(시작점 고르기)
 *          | 'fix'(선 하나를 더하거나 빼서 고치기) | 'pen'(펜을 떼며 여러 번에 나눠 긋기. 더 적게 떼기)
 *          | 'bridge'(섬과 다리. 같은 두 섬 사이에 다리가 여럿일 수 있다. 끝까지 건너거나 "불가능해요")
 *          | 'twin'(선 하나만 다른 닮은 두 그림에서 끝까지 그을 수 있는 쪽 고르기) | 'make'(아이가 직접 만든다)
 *   counts 점의 수의 후보(닮은 두 그림은 한쪽 그림의 점의 수)
 *   grid   점을 놓을 격자의 [가로 칸 수, 세로 칸 수]
 *   extra  한 덩어리로 이은 뒤에 더 긋는 선의 수의 [아래 끝, 위 끝]. 클수록 갈림길이 많다
 *   mix    true면 안 되는 그림을 IMPOSSIBLE_RATE만큼 섞는다
 *   doubles 다리 건너기에서 다리를 겹으로 놓는 섬 짝의 수의 [아래 끝, 위 끝]
 *
 * 점의 수, 격자의 크기, 더 긋는 선의 수는 임시로 정한 것이다(3단계와 4단계의 5~7개는 기획 문서에 없다).
 *
 * 5~7단계는 2026-11-20에 직접 만들기 앞에 더했다(기획 문서의 "펜을 몇 번 떼야 할까", 다리 문제, 거의 같은 두 그림).
 * 1~4단계의 번호는 그대로이고, 직접 만들기는 5단계에서 8단계가 되었다.
 *   5단계 펜 몇 번 떼기: 한 번에 그을 수 없는 그림(점 6~8개). 가장 적게 떼는 횟수는 1번이거나 2번이다(2번은 THREE_RATE만큼)
 *   6단계 다리 건너기: 섬 4~6개. 두 섬 사이에 다리가 둘이나 셋인 곳이 꼭 있다. 안 되는 판은 셋에 하나
 *   7단계 닮은 두 그림: 점 5~6개인 그림 둘. 선 하나만 다르고, 끝까지 그을 수 있는 것은 하나뿐이다
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'draw', counts: [4, 5, 6], grid: [3, 3], extra: [1, 3], mix: true },
  { level: 2, tag: 'applied', mode: 'judge', counts: [6, 7, 8], grid: [4, 3], extra: [2, 3], mix: true },
  { level: 3, tag: 'applied', mode: 'start', counts: [5, 6, 7], grid: [4, 3], extra: [2, 3], mix: false },
  { level: 4, tag: 'challenge', mode: 'fix', counts: [5, 6, 7], grid: [4, 3], extra: [2, 3], mix: false },
  { level: 5, tag: 'applied', mode: 'pen', counts: [6, 7, 8], grid: [4, 3], extra: [3, 5], mix: false },
  { level: 6, tag: 'challenge', mode: 'bridge', counts: [4, 5, 6], grid: [4, 3], extra: [0, 2], doubles: [1, 3], mix: true },
  { level: 7, tag: 'applied', mode: 'twin', counts: [5, 6], grid: [3, 3], extra: [1, 3], mix: false },
  { level: 8, tag: 'challenge', mode: 'make' },
];

/** 그림을 만들어 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 7;
export const MAKE_LEVEL = 8;
/** 5~7단계를 더하기 전의 직접 만들기 단계. 그때 적어 둔 하던 판과 공책의 만든 판은 이 번호를 갖고 있다(그대로 받는다). */
export const OLD_MAKE_LEVEL = 5;

/** 5단계에서 펜을 2번 떼야 하는 그림(선이 홀수 개 모인 점이 여섯)의 비율(임시). 나머지는 1번 떼면 되는 그림이다 */
export const THREE_RATE = 1 / 3;
/** 다리 건너기에서 겹으로 놓은 다리 가운데 하나를 세 겹으로 놓는 비율(임시) */
export const TRIPLE_RATE = 1 / 5;
/** 닮은 두 그림에서 두 그림 사이의 틈(격자 칸) */
export const TWIN_GAP = 1;

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

// ---- 6단계 다리 건너기: 섬과 다리 ----

/**
 * 섬 n개를 격자 위에 놓고 다리를 놓는다. 먼저 randomFigure로 다리 한 겹을 놓고(한 덩어리, 다리끼리 엇갈리지 않는다),
 * 그 가운데 몇 곳(doubles)에 다리를 하나 더 놓는다. TRIPLE_RATE만큼은 그 가운데 한 곳에 하나를 더 놓아 세 겹으로 한다.
 */
export function randomBridges(rng, n, grid, extra, [fewest, most]) {
  const base = randomFigure(rng, n, grid, extra);
  if (!base) return null;
  const twice = randInt(rng, fewest, most);
  if (twice > base.edges.length) return null;
  const chosen = shuffle(rng, base.edges).slice(0, twice);
  const edges = [...base.edges, ...chosen.map((edge) => edge.slice())];
  if (rng() < TRIPLE_RATE) edges.push(chosen[0].slice());
  edges.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  return { points: base.points, edges, multi: true };
}

/** 같은 두 섬 사이에 다리가 둘 이상인 곳의 수 */
export function doubledPairs(figure) {
  const counts = new Map();
  for (const [a, b] of figure.edges) counts.set(`${a}-${b}`, (counts.get(`${a}-${b}`) ?? 0) + 1);
  return [...counts.values()].filter((count) => count >= 2).length;
}

/**
 * 널리 알려진 옛 도시의 일곱 다리(땅 넷, 다리 일곱. 다리가 다섯, 셋, 셋, 셋 모인 땅)와 같은 꼴의 판인가.
 * 그 그림은 쓰지 않기로 해서 이런 판은 내지 않는다.
 */
export function famousShape(figure) {
  if (figure.points.length !== 4 || figure.edges.length !== 7) return false;
  return degreesOf(figure).sort((x, y) => x - y).join(',') === '3,3,3,5';
}

/** 섬 하나에 모이는 다리의 위 끝(임시). 더 많으면 다리가 섬 둘레에 붐벼서 알아보기 어렵다 */
export const MAX_BRIDGES_AT = 6;

/**
 * 다리 판으로 내지 않을 판을 거른다: 다리가 다섯 개보다 적거나, 다리가 셋 이상 모인 섬이 없거나,
 * 겹으로 놓인 다리가 없거나, 다리가 너무 많이 모인 섬이 있다
 */
export function plainBridges(figure) {
  const most = Math.max(...degreesOf(figure));
  return figure.edges.length < 5 || most < 3 || most > MAX_BRIDGES_AT || doubledPairs(figure) === 0;
}

// ---- 7단계 닮은 두 그림 ----

/**
 * 그림 하나와, 그 그림을 선 하나만 고쳐서(더하거나 빼서) 되는지 안 되는지가 바뀐 그림을 나란히 놓는다.
 * 고친 그림도 한 덩어리이고, 선이 없는 점이 없고, 뻔하지 않다. 어느 쪽을 왼쪽에 둘지는 반반으로 정한다.
 * @returns {{board: object, answer: 'left'|'right'} | null}
 */
export function randomTwin(rng, n, grid, extra) {
  const first = randomFigure(rng, n, grid, extra);
  if (!first || tooPlain(first)) return null;
  const firstOk = solve(first).possible;
  const edits = editsOf(first).filter((edit) => {
    const other = applyEdit(first, edit);
    if (other.edges.length === 0 || pieceCount(other) !== 1 || degreesOf(other).some((degree) => degree === 0) || tooPlain(other)) return false;
    return solve(other).possible !== firstOk;
  });
  if (edits.length === 0) return null;
  const second = applyEdit(first, edits[randInt(rng, 0, edits.length - 1)]);
  const good = firstOk ? first : second;
  const bad = firstOk ? second : first;
  const answer = rng() < 1 / 2 ? 'left' : 'right';
  const [left, right] = answer === 'left' ? [good, bad] : [bad, good];
  const shift = grid[0] + TWIN_GAP;
  const k = left.points.length;
  return {
    board: {
      points: [...left.points.map((point) => point.slice()), ...right.points.map(([x, y]) => [x + shift, y])],
      edges: [...left.edges.map((edge) => edge.slice()), ...right.edges.map(([a, b]) => [a + k, b + k])],
      split: k,
    },
    answer,
  };
}

/** 닮은 두 그림에서 끝까지 그을 수 있는 쪽. 둘 다 되거나 둘 다 안 되면 null */
export function twinAnswer(board) {
  const left = solve(sideOf(board, 'left')).possible;
  const right = solve(sideOf(board, 'right')).possible;
  return left === right ? null : left ? 'left' : 'right';
}

/**
 * 그림 하나를 만든다.
 * @param {number} level 1~7
 * @param {number} seed 판 번호
 * @param {{small?: boolean}} options small: 그 단계에서 점이 적은 그림을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: {points: number[][], edges: number[][]}, solution: object, fixes?: object[], plan?: object, answer?: string}}
 *   solution 풀이 프로그램의 결과. fixes는 4단계에서만: 한 군데 고쳐서 되는 그림으로 만드는 방법들
 *   plan     5단계에서만: 가장 적게 나눠 긋는 방법(strokePlan)
 *   answer   7단계에서만: 끝까지 그을 수 있는 쪽('left' | 'right')
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 그림을 만들어 내지 않아요');
  const rng = createRng(seedFrom('trace', level, seed, small ? 'small' : 'any'));
  const counts = small ? rung.counts.slice(0, 2) : rung.counts;
  // 되는 그림을 낼지 안 되는 그림을 낼지 먼저 정하고, 풀이 프로그램이 그렇다고 할 때까지 다시 뽑는다.
  const wantImpossible = rung.mix && rng() < IMPOSSIBLE_RATE;
  if (rung.mode === 'pen') return penBoard(rung, level, seed, small, rng, counts);
  if (rung.mode === 'twin') {
    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      const made = randomTwin(rng, counts[randInt(rng, 0, counts.length - 1)], rung.grid, rung.extra);
      if (made) return { level, seed, small, board: made.board, solution: solve(made.board), answer: made.answer };
    }
    throw new Error(`그림을 만들지 못했어요: ${level}단계 ${seed}번`);
  }
  let fallback = null;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const n = counts[randInt(rng, 0, counts.length - 1)];
    if (rung.mode === 'bridge') {
      const board = randomBridges(rng, n, rung.grid, rung.extra, rung.doubles);
      if (!board || plainBridges(board) || famousShape(board)) continue;
      const solution = solve(board);
      if (!fallback) fallback = { level, seed, small, board, solution };
      if (solution.possible === !wantImpossible) return { level, seed, small, board, solution };
      continue;
    }
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

/** 5단계: 한 번에 그을 수 없는 한 덩어리 그림. 펜을 2번 떼야 하는 그림을 THREE_RATE만큼 낸다 */
function penBoard(rung, level, seed, small, rng, counts) {
  const want = rng() < THREE_RATE ? 3 : 2;
  let fallback = null;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const board = randomFigure(rng, counts[randInt(rng, 0, counts.length - 1)], rung.grid, rung.extra);
    if (!board || tooPlain(board)) continue;
    const solution = solve(board);
    if (solution.possible || solution.pieces !== 1) continue;
    const plan = strokePlan(board);
    const made = { level, seed, small, board, solution, plan };
    if (plan.strokes === want) return made;
    if (!fallback) fallback = made;
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
