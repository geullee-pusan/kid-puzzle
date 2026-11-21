// 그물 끊기의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 그물의 종류와 뺄 줄은 시드 난수(rng.js)로 고른다.
//
// 그물은 몇 가지 바탕 그림(고기 그물 모눈, 사다리, 바퀴, 집, 나비, 물고기, 상자, 테두리와 섬)에서 시작해
// 고리에 든 줄 몇 개를 빼서 만든다(빼도 조각이 늘지 않는 줄만 뺀다). 사다리의 그물에는 엇갈리는 줄이 없다.
// 가장 많이 끊을 수 있는 줄의 수는 늘 1 이상이다(첫 판부터 끊을 줄이 있다).
import { checkBoard, crosses, maxCut, piecesOf, sameBoard } from './net.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag   'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode  'cut'(끊어 보기) | 'guess'(짐작하고 끊기) | 'twins'(두 그물 견주기) | 'predict'(큰 그물 세어 보기)
 *         | 'pieces'(두 조각 그물) | 'make'(직접 만든다)
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'cut' },
  { level: 2, tag: 'basic', mode: 'guess' },
  { level: 3, tag: 'applied', mode: 'twins' },
  { level: 4, tag: 'applied', mode: 'predict' },
  { level: 5, tag: 'challenge', mode: 'pieces' },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

// ---- 바탕 그림 ----

const round2 = (value) => Math.round(value * 100) / 100;

/** 매듭의 자리를 반올림하고, 왼쪽 위가 (0, 0)에 오게 옮긴다 */
function tidy(board) {
  const minX = Math.min(...board.knots.map((knot) => knot[0]));
  const minY = Math.min(...board.knots.map((knot) => knot[1]));
  return { ...board, knots: board.knots.map(([x, y]) => [round2(x - minX), round2(y - minY)]) };
}

/** 고기 그물 모눈: 가로 c개, 세로 r개의 매듭. 이웃한 매듭끼리 가로세로로 잇는다 */
export function grid(c, r, family = 'grid') {
  const knots = [];
  const strings = [];
  for (let y = 0; y < r; y++) for (let x = 0; x < c; x++) knots.push([x, y]);
  const at = (x, y) => y * c + x;
  for (let y = 0; y < r; y++) for (let x = 0; x + 1 < c; x++) strings.push([at(x, y), at(x + 1, y)]);
  for (let y = 0; y + 1 < r; y++) for (let x = 0; x < c; x++) strings.push([at(x, y), at(x, y + 1)]);
  return { knots, strings, family };
}

/** 둘레의 매듭 k개를 원 위에 놓고 둘레를 잇는다. hub가 참이면 가운데 매듭과 바큇살도 잇는다 */
function circle(k, hub, family) {
  const radius = Math.max(1, 0.6 / Math.sin(Math.PI / k));
  const knots = Array.from({ length: k }, (_, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / k;
    return [radius + radius * Math.cos(angle), radius + radius * Math.sin(angle)];
  });
  const strings = Array.from({ length: k }, (_, index) => [index, (index + 1) % k]);
  if (hub) {
    knots.push([radius, radius]);
    for (let index = 0; index < k; index++) strings.push([k, index]);
  }
  return tidy({ knots, strings, family });
}

/** 바퀴: 둘레의 매듭 k개와 가운데 매듭 */
export const wheel = (k) => circle(k, true, 'wheel');
/** 고리 하나: 둘레의 매듭 k개 */
export const ring = (k) => circle(k, false, 'ring');

/** 손으로 그린 그물들(매듭 자리와 줄) */
const DRAWN = {
  // 네모 집과 세모 지붕
  house: { knots: [[0, 1], [1, 1], [1, 2], [0, 2], [0.5, 0]], strings: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 1]] },
  // 가운데 매듭에서 만나는 세모 둘
  bowtie: { knots: [[0, 0], [0, 1.4], [1, 0.7], [2, 0], [2, 1.4]], strings: [[0, 1], [0, 2], [1, 2], [3, 4], [3, 2], [4, 2]] },
  // 마름모 몸통과 세모 꼬리
  fish: { knots: [[0, 1], [1, 0], [2, 1], [1, 2], [2.8, 0], [2.8, 2]], strings: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [2, 5], [4, 5]] },
  // 세모와 막대(막대 사탕)
  lolly: { knots: [[0, 0], [1.2, 0], [0.6, 1], [0.6, 2]], strings: [[0, 1], [1, 2], [2, 0], [2, 3]] },
  // 네모와 깃대
  flag: { knots: [[0, 0], [1, 0], [1, 1], [0, 1], [0, 2]], strings: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4]] },
  // 큰 네모 안의 작은 네모, 모서리끼리 잇는다
  cube: {
    knots: [[0, 0], [3, 0], [3, 3], [0, 3], [1, 1], [2, 1], [2, 2], [1, 2]],
    strings: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]],
  },
};

export const drawn = (name) => ({ knots: DRAWN[name].knots.map((knot) => knot.slice()), strings: DRAWN[name].strings.map((string) => string.slice()), family: name });

/** 바탕 그림의 이름 → 그물 */
const BASES = {
  house: () => drawn('house'),
  bowtie: () => drawn('bowtie'),
  fish: () => drawn('fish'),
  flag: () => drawn('flag'),
  lolly: () => drawn('lolly'),
  cube: () => drawn('cube'),
  square: () => grid(2, 2),
  'grid3x2': () => grid(3, 2),
  'grid4x2': () => grid(4, 2, 'ladder'),
  'ladder2x4': () => grid(2, 4, 'ladder'),
  'grid6x2': () => grid(6, 2, 'ladder'),
  'grid3x3': () => grid(3, 3),
  'grid4x3': () => grid(4, 3),
  'grid5x3': () => grid(5, 3),
  'grid4x4': () => grid(4, 4),
  wheel4: () => wheel(4),
  wheel5: () => wheel(5),
  wheel6: () => wheel(6),
  wheel7: () => wheel(7),
  wheel8: () => wheel(8),
  ring5: () => ring(5),
};
export const base = (name) => BASES[name]();

/**
 * 테두리와 섬: 가로 c개, 세로 r개 매듭의 테두리(고리 하나)와 그 안의 작은 모눈(섬).
 * links는 섬과 테두리를 잇는 줄의 수(0이면 처음부터 두 조각이다).
 */
export function island(c, r, links) {
  const knots = [];
  const strings = [];
  const index = new Map();
  const add = (x, y) => {
    index.set(`${x},${y}`, knots.length);
    knots.push([x, y]);
  };
  const at = (x, y) => index.get(`${x},${y}`);
  for (let x = 0; x < c; x++) add(x, 0);
  for (let y = 1; y < r; y++) add(c - 1, y);
  for (let x = c - 2; x >= 0; x--) add(x, r - 1);
  for (let y = r - 2; y >= 1; y--) add(0, y);
  const rim = knots.length;
  for (let k = 0; k < rim; k++) strings.push([k, (k + 1) % rim]);
  for (let y = 1; y < r - 1; y++) for (let x = 1; x < c - 1; x++) add(x, y);
  for (let y = 1; y < r - 1; y++) for (let x = 1; x + 1 < c - 1; x++) strings.push([at(x, y), at(x + 1, y)]);
  for (let y = 1; y + 1 < r - 1; y++) for (let x = 1; x < c - 1; x++) strings.push([at(x, y), at(x, y + 1)]);
  // 섬의 왼쪽 위 매듭에서 위로, 오른쪽 아래 매듭에서 아래로 잇는다
  const ties = [
    [at(1, 1), at(1, 0)],
    [at(c - 2, r - 2), at(c - 2, r - 1)],
  ];
  for (const tie of ties.slice(0, links)) strings.push(tie);
  return { knots, strings, family: 'island' };
}

/** 두 그물을 나란히 놓는다(오른쪽 그물은 왼쪽 그물 옆으로 1칸 띄우고, 세로 가운데를 맞춘다) */
export function sideBySide(left, right) {
  const width = (net) => Math.max(...net.knots.map((knot) => knot[0]));
  const height = (net) => Math.max(...net.knots.map((knot) => knot[1]));
  const a = tidy(left);
  const b = tidy(right);
  const lift = (height(a) - height(b)) / 2;
  const dropA = Math.max(0, -lift);
  const dropB = Math.max(0, lift);
  const shift = width(a) + 1;
  return {
    knots: [...a.knots.map(([x, y]) => [x, round2(y + dropA)]), ...b.knots.map(([x, y]) => [round2(x + shift), round2(y + dropB)])],
    strings: [...a.strings.map((string) => string.slice()), ...b.strings.map(([p, q]) => [p + a.knots.length, q + a.knots.length])],
    family: 'twins',
  };
}

// ---- 줄 빼기 ----

/**
 * 고리에 든 줄을 count개 뺀다(빼도 조각이 늘지 않는 줄만). 같은 rng에서 늘 같은 줄을 뺀다.
 * keep(board)가 거짓이 되는 빼기는 하지 않는다.
 */
export function dropStrings(board, count, rng, keep = () => true) {
  let now = { ...board, strings: board.strings.map((string) => string.slice()) };
  const pieces = piecesOf(now.knots.length, now.strings).count;
  for (let step = 0; step < count; step++) {
    const options = now.strings
      .map((_, index) => index)
      .filter((index) => {
        if (piecesOf(now.knots.length, now.strings, (other) => other !== index).count !== pieces) return false;
        return keep({ ...now, strings: now.strings.filter((_, other) => other !== index) });
      });
    if (options.length === 0) break;
    const drop = options[randInt(rng, 0, options.length - 1)];
    now = { ...now, strings: now.strings.filter((_, index) => index !== drop) };
  }
  return now;
}

// ---- 단계마다의 판 ----

/** 끊어 보기(매듭 5~8개), 짐작하고 끊기(매듭 6~9개), 큰 그물 세어 보기(매듭 8~16개)의 바탕 그림 */
const POOLS = {
  cut: ['house', 'bowtie', 'fish', 'grid3x2', 'wheel4', 'wheel5', 'wheel6', 'grid4x2'],
  guess: ['fish', 'grid3x2', 'wheel5', 'wheel6', 'wheel7', 'grid4x2', 'cube', 'grid3x3'],
  predict: ['grid3x3', 'grid4x3', 'grid4x4', 'grid5x3', 'grid6x2', 'wheel8', 'cube'],
};
/** 뺄 수 있는 줄의 수(가장 많이)와, 빼고 나서도 끊을 수 있어야 하는 줄의 수(가장 적게) */
const DROPS = { cut: [1, 1], guess: [2, 2], predict: [3, 3] };
/** 두 그물 견주기: 매듭 수가 같고 모양이 다른 두 바탕 그림(나란히 놓아도 판에 크게 들어가는 짝만) */
const TWIN_PAIRS = [
  ['fish', 'grid3x2'],
  ['ladder2x4', 'cube'],
  ['ladder2x4', 'wheel7'],
  ['house', 'bowtie'],
  ['house', 'flag'],
  ['bowtie', 'flag'],
  ['house', 'ring5'],
  ['bowtie', 'ring5'],
];
/** 두 조각 그물: 테두리의 크기 */
const ISLANDS = [
  [4, 4],
  [5, 4],
  [6, 4],
  [5, 5],
];

/** 단계마다의 첫 판(판 번호 1) */
function firstBoard(mode) {
  if (mode === 'cut') return base('house');
  if (mode === 'guess') return base('grid3x2');
  if (mode === 'twins') return sideBySide(base('fish'), base('grid3x2'));
  if (mode === 'predict') return base('grid4x4');
  return island(4, 4, 0);
}

/** 그물에 엇갈리는 줄이 없는가 */
export function untangled(board) {
  for (let i = 0; i < board.strings.length; i++) for (let j = i + 1; j < board.strings.length; j++) if (crosses(board, i, j)) return false;
  return true;
}

/** 두 그물 견주기: 판 번호가 3의 배수면 두 그물의 줄 수가 다르고, 아니면 매듭 수와 줄 수가 같다 */
export const sameAt = (seed) => seed % 3 !== 0;
/** 두 조각 그물: 판 번호가 홀수면 처음부터 두 조각, 짝수면 한 조각 */
export const twoAt = (seed) => seed % 2 === 1;

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed) {
  if (seed === 1) return firstBoard(rung.mode);
  const rng = createRng(seedFrom('net', rung.level, seed));
  const pick = (list) => list[randInt(rng, 0, list.length - 1)];
  const enough = (floor) => (board) => maxCut(board) >= floor;
  if (rung.mode === 'twins') {
    const pair = pick(TWIN_PAIRS);
    const first = randInt(rng, 0, 1);
    // 같은 판은 한쪽에서 줄 하나를 먼저 빼 보기도 한다(그다음 다른 쪽을 맞춘다)
    let a = sameAt(seed) ? dropStrings(base(pair[first]), randInt(rng, 0, 1), rng, enough(1)) : base(pair[first]);
    let b = base(pair[1 - first]);
    // 줄 수를 맞춘다(더 많은 쪽에서 뺀다)
    const low = Math.min(a.strings.length, b.strings.length);
    a = dropStrings(a, a.strings.length - low, rng, enough(1));
    b = dropStrings(b, b.strings.length - low, rng, enough(1));
    if (!sameAt(seed)) {
      // 다른 판: 한쪽에서 한두 줄을 더 뺀다. 둘 다 더 뺄 수 없으면(고리가 하나뿐) 바탕 그림 그대로 둔다(바탕의 줄 수가 다르다)
      const gap = randInt(rng, 1, 2);
      const fewerB = dropStrings(b, gap, rng, enough(1));
      const fewerA = dropStrings(a, gap, rng, enough(1));
      if (fewerB.strings.length < b.strings.length) b = fewerB;
      else if (fewerA.strings.length < a.strings.length) a = fewerA;
      else {
        a = base(pair[first]);
        b = base(pair[1 - first]);
      }
    }
    return randInt(rng, 0, 1) === 0 ? sideBySide(a, b) : sideBySide(b, a);
  }
  if (rung.mode === 'pieces') {
    const [c, r] = pick(ISLANDS);
    const links = twoAt(seed) ? 0 : randInt(rng, 1, 2);
    return dropStrings(island(c, r, links), randInt(rng, 0, 1), rng, enough(2));
  }
  const [most, floor] = DROPS[rung.mode];
  return dropStrings(base(pick(POOLS[rung.mode])), randInt(rng, 0, most), rng, enough(floor));
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(첫 판)을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  const board = boardAt(rung, shrink ? 1 : seed);
  if (checkBoard(board) !== null) throw new Error(`규격에 맞지 않는 판이에요: ${checkBoard(board)}`);
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

/** 한 그물 판의 작은 판에 쓰는 바탕 그림(매듭이 적은 것부터) */
const SMALL_ONE = ['square', 'house', 'bowtie', 'wheel4', 'fish', 'grid3x2', 'wheel5', 'wheel6', 'grid4x2', 'cube', 'grid3x3', 'wheel7', 'grid4x3'];
/** 두 그물 견주기의 작은 판: 매듭 수와 줄 수가 같은 두 그물(매듭이 많은 것부터) */
const SMALL_TWINS = [
  ['house', 'bowtie'],
  ['ring5', 'flag'],
  ['square', 'lolly'],
];
/** 두 조각 그물의 작은 판: 한 조각인 것과 두 조각인 것 */
const smallPieces = () => [
  { ...drawn('cube'), family: 'island' },
  { ...grid(3, 3), family: 'island' },
  sideBySide(grid(2, 2), grid(2, 2)),
  island(4, 3, 0),
];

/** 조각마다 매듭이 몇 개인가(가장 적은 것) */
function fewestPerPiece(board) {
  const { count, label } = piecesOf(board.knots.length, board.strings);
  const sizes = Array(count).fill(0);
  for (const piece of label) sizes[piece] += 1;
  return Math.min(...sizes);
}

/**
 * 더 작은 판들(많아야 둘). 같은 판에는 늘 같은 판들이 나온다. 모두 끊을 줄이 하나 이상 있다.
 *   한 그물 판(끊어 보기, 짐작하고 끊기, 큰 그물 세어 보기, 직접 만든 판): 매듭이 더 적은 그물. 같은 종류의 그림이 먼저이고, 그다음 매듭이 많은 것부터
 *   두 그물 견주기: 그물마다 매듭이 더 적은 두 그물(매듭 수와 줄 수가 같다)
 *   두 조각 그물: 매듭이 더 적고, 처음 조각 수가 같은 판(테두리와 섬, 또는 나란한 두 네모)
 * @param {object} origin { mode, board }
 * @returns {object[]}
 */
export function smallBoards(origin) {
  const { board, mode } = origin;
  if (checkBoard(board) !== null) return [];
  const n = board.knots.length;
  const pieces = piecesOf(n, board.strings).count;
  if (mode === 'twins') {
    const per = fewestPerPiece(board);
    return SMALL_TWINS.filter(([a]) => base(a).knots.length < per)
      .slice(0, 2)
      .map(([a, b]) => sideBySide(base(a), base(b)));
  }
  if (mode === 'pieces' || (mode === 'made' && pieces > 1)) {
    return smallPieces()
      .filter((small) => small.knots.length < n && piecesOf(small.knots.length, small.strings).count === pieces && maxCut(small) >= 1)
      .slice(0, 2);
  }
  const family = board.family;
  const found = SMALL_ONE.map((name, order) => ({ order, small: base(name) })).filter(({ small }) => small.knots.length < n && maxCut(small) >= 1);
  found.sort((p, q) => Number(q.small.family === family) - Number(p.small.family === family) || q.small.knots.length - p.small.knots.length || p.order - q.order);
  return found.slice(0, 2).map(({ small }) => small);
}
