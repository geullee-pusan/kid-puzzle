// 주사위 미로와 길 세기의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 판마다 풀이 프로그램(칸마다 오는 길의 수)으로 푼 결과가 붙는다.
// 표시할 출구와 막힌 갈림길은 시드 난수로 고르고, 풀이 프로그램으로 확인한 판만 낸다.
import { checkBoard, blockableCells, exitCounts, solve } from './maze.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   'busy'(실험) | 'count'(길 세기) | 'even'(짝수 칸 칠하기) | 'make'(직접 만들기)
 *   ask    세는 판에서 열어야 하는 칸: 'target'(표시한 출구 하나) | 'all'(맨 위를 뺀 모든 칸)
 *   hint   힌트와 처음 화면의 물음, 규칙 글을 고르는 이름
 *   rows   판의 줄 수(갈림길의 줄)의 차례. 판 번호가 달라지면 차례로 돈다
 *   first  판 번호 1에 내는 판의 줄 수(없으면 차례의 첫 판)
 *   small  수준 맞추기가 "작은 판부터"라고 할 때 내는 판의 줄 수
 *
 * 1단계: 실험. 어느 출구로 손님이 가장 많이 갈지 고르고 손님을 보낸다. 고르기는 틀리는 답이 없다. 맨 처음 판은 2줄(출구 셋)이다.
 * 2단계: 표시한 출구 하나까지 가는 길의 수. 맨 처음 판은 2줄의 가운데 출구(두 가지)다.
 * 3단계: 맨 위를 뺀 모든 칸에 그 칸까지 오는 길의 수를 넣는다(3, 4줄).
 * 4단계: 막힌 갈림길이 하나나 둘 있는 판에서 표시한 출구까지 가는 길의 수. 손님도 보내 볼 수 있다.
 * 5단계: 길의 수가 짝수인 칸을 모두 칠한다(4~8줄). 수는 넣어 보지 않아도 된다.
 * 6단계: 직접 만들기. 줄 수를 정하고 갈림길을 막으면, 선생님이 길을 세어 주고 손님 100명을 보내 준다.
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'busy', ask: null, hint: 'busy', first: 2, small: 2, rows: [4, 3, 5, 4, 6] },
  { level: 2, tag: 'basic', mode: 'count', ask: 'target', hint: 'exit', first: 2, small: 2, rows: [3, 4, 3, 4, 5] },
  { level: 3, tag: 'applied', mode: 'count', ask: 'all', hint: 'fill', small: 2, rows: [3, 4] },
  { level: 4, tag: 'applied', mode: 'count', ask: 'target', blocks: true, hint: 'blocked', small: 3, rows: [4, 5, 4, 5] },
  { level: 5, tag: 'challenge', mode: 'even', ask: null, hint: 'even', first: 4, small: 3, rows: [5, 6, 7, 8, 5, 6] },
  { level: 6, tag: 'challenge', mode: 'make', ask: 'exits', hint: 'exits' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;
/** 막힌 갈림길이 있는 판을 고르려고 다시 뽑아 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 200;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 판의 풀이: 칸마다 오는 길의 수와, 거기서 나오는 것들 */
export const solutionOf = (board) => solve(board);

/** 표시할 출구: 양 끝(길이 한 가지뿐)을 뺀 출구 가운데 하나 */
function plainTarget(rng, rows) {
  return randInt(rng, 1, rows - 1);
}

/**
 * 막힌 갈림길이 있는 판: 하나나 둘을 막고, 막아서 길의 수가 바뀌었고 길이 둘 이상인 출구 하나를 표시한다.
 * 막은 갈림길이 모두 그 출구의 길의 수에 손대지 않으면 다시 뽑는다.
 */
function blockedBoard(rng, rows) {
  const plain = exitCounts({ kind: 'count', rows, blocked: [], target: null, ask: 'all' });
  const cells = blockableCells(rows);
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const many = randInt(rng, 1, 2);
    const blocked = [];
    while (blocked.length < many) {
      const cell = cells[randInt(rng, 0, cells.length - 1)];
      if (!blocked.includes(cell)) blocked.push(cell);
    }
    blocked.sort((a, b) => a - b);
    const now = exitCounts({ kind: 'count', rows, blocked, target: null, ask: 'all' });
    const targets = now.map((count, k) => (count >= 2 && count !== plain[k] ? k : -1)).filter((k) => k >= 0);
    if (targets.length === 0) continue;
    // 막은 갈림길마다 그 하나만 열어도 표시한 출구의 길의 수가 바뀌어야 한다(쓸데없는 돌이 없다).
    const target = targets[randInt(rng, 0, targets.length - 1)];
    const matters = blocked.every((cell) => {
      const without = exitCounts({ kind: 'count', rows, blocked: blocked.filter((item) => item !== cell), target: null, ask: 'all' });
      return without[target] !== now[target];
    });
    if (matters) return { kind: 'count', rows, blocked, target, ask: 'target' };
  }
  throw new Error(`막힌 갈림길이 있는 판을 고르지 못했어요: ${rows}줄`);
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 그 단계의 작은 판을 낸다(수준 맞추기에서 쓴다)
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  let rows;
  if (small) rows = rung.small;
  else if (seed === 1 && rung.first) rows = rung.first;
  else {
    const count = rung.rows.length;
    // 판 번호 1에 정해 둔 판이 있으면 2부터 차례의 처음이다.
    const at = seed - (rung.first ? 2 : 1);
    rows = rung.rows[((at % count) + count) % count];
  }
  const rng = createRng(seedFrom('maze', level, seed, small ? 'small' : ''));
  let board;
  if (rung.mode === 'busy' || rung.mode === 'even') board = { kind: rung.mode, rows, blocked: [], target: null, ask: null };
  else if (rung.blocks) board = blockedBoard(rng, rows);
  else if (rung.ask === 'target') board = { kind: 'count', rows, blocked: [], target: rows === 2 ? 1 : plainTarget(rng, rows), ask: 'target' };
  else board = { kind: 'count', rows, blocked: [], target: null, ask: rung.ask };
  if (checkBoard(board) !== null) throw new Error(`쓸 수 없는 판이에요: ${JSON.stringify(board)}`);
  return { level, seed, small, board, solution: solutionOf(board) };
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
