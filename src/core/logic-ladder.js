// 참말 섬의 사다리(단계)와 판 만들어 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 풀이 프로그램으로 확인한 판만 내보낸다.
//
// 좋은 판(전략 문서 9.1절)으로 거르는 것:
//   - 답이 꼭 하나다(또는 남는 배정이 없는 것이 확실하다).
//   - 군더더기 말이 없다: 말을 하나 빼면 답이 여럿이 된다(남는 배정이 없는 판은, 하나를 빼면 배정이 생긴다).
//     누구나 할 수 있는 쓸모없는 말("나는 참말쟁이예요")만은 따로 셈하고, 판마다 많아야 하나 넣는다(1단계에는 넣지 않는다).
//   - 첫 가정에서 바로 맞는 판을 내지 않는다: 남는 배정이 "모두 참말쟁이"인 판은 버린다(말을 다 믿으면 끝나는 판).
//     쳐 보기 단추를 아무렇게나 누를 때 맞는 배정에 닿기까지의 횟수(expectedPresses)도 판마다 구해 둔다.
//   - 동물과 말의 차례는 판 번호로 섞는다.
import { ANIMALS, SIDES, blankGuess, boxAnswers, checkBoard, expectedPresses, isLean, labelTruths, solve, uselessCount } from './logic.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'pair'(주민 둘) | 'box'(상자) | 'folk'(주민 셋) | 'road'(주민 셋과 갈림길) | 'make'(직접 만들기)
 *   follow  true면 "따라가 보기"가 처음부터 켜져 있다(1단계. 실패할 수 없는 첫 판)
 *
 * 5단계(질문 고르기)는 2026-11 화면 글 점검에서 뺐다. 다시 넣을 때는 '제가 ‘…’라고 물으면, 하마는 ‘예’라고 대답할 건가요?' 한 종류로.
 * (질문의 풀이는 src/core/logic.js에 남아 있다. 질문 판을 만들어 내는 코드와 화면, 대본은 지웠다.)
 *
 * 임시로 정한 것: 3단계의 "이렇게 말할 수는 없어요" 판의 비율(다섯에 하나)과 "몇 명" 판의 비율(나머지의 열에 셋),
 * 쓸모없는 말을 넣는 비율(3단계 다섯에 하나, 4단계 여섯에 하나), 말의 수(2~4개).
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'pair', people: 2, follow: true },
  { level: 2, tag: 'basic', mode: 'box', boxes: 3 },
  { level: 3, tag: 'applied', mode: 'folk', people: 3 },
  { level: 4, tag: 'challenge', mode: 'road', people: 3 },
  { level: 5, tag: 'challenge', mode: 'make' },
];

export const TOP_LEVEL = 4;
export const MAKE_LEVEL = 5;

/** 3단계에서 "이렇게 말할 수는 없어요" 판과 "몇 명" 판이 나오는 비율(임시) */
export const NONE_SHARE = 0.2;
export const COUNT_SHARE = 0.3;
/** 쓸모없는 말을 넣는 비율(임시) */
const USELESS_SHARE = { folk: 0.2, road: 1 / 6 };
/** 판 하나를 고르려고 다시 뽑아 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다). */
const MAX_TRIES = 20000;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

const pick = (rng, list) => list[randInt(rng, 0, list.length - 1)];

function shuffled(rng, list) {
  const items = list.slice();
  for (let index = items.length - 1; index > 0; index--) {
    const other = randInt(rng, 0, index);
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- 말의 후보 ----

/**
 * 주민 n명의 판에서 할 수 있는 말 모두.
 * @param {number} n 주민 수
 * @param {string[]} types 쓸 말의 틀
 */
export function sayPool(n, types) {
  const pool = [];
  for (let by = 0; by < n; by++) {
    for (const type of types) {
      if (type === 'is') for (let who = 0; who < n; who++) if (who !== by) for (const k of [true, false]) pool.push({ by, s: { t: 'is', who, k } });
      if (type === 'same' || type === 'diff') for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pool.push({ by, s: { t: type, a, b } });
      if (type === 'all') for (const k of [true, false]) pool.push({ by, s: { t: 'all', k } });
      if (type === 'liars') for (let count = 1; count < n; count++) pool.push({ by, s: { t: 'liars', n: count } });
      if (type === 'some') pool.push({ by, s: { t: 'some' } });
      if (type === 'road') for (const side of SIDES) pool.push({ by, s: { t: 'road', side } });
      if (type === 'or') {
        for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (const ak of [true, false]) for (const bk of [true, false]) pool.push({ by, s: { t: 'or', a, ak, b, bk } });
      }
    }
  }
  return pool;
}

/** 단계마다 쓰는 말의 틀 */
export const SAY_TYPES = {
  pair: ['is', 'all', 'same', 'diff'],
  folk: ['is', 'same', 'diff', 'all', 'liars', 'some'],
  road: ['is', 'same', 'diff', 'all', 'liars', 'some', 'road', 'or'],
  small: ['is', 'same', 'diff', 'all', 'liars', 'some'],
};

const sayKey = (say) => JSON.stringify(say);
const speakers = (says) => new Set(says.map((say) => say.by)).size;
const allTrue = (kinds) => kinds.every(Boolean);

/** 말들의 모든 묶음(크기 1~most). 차례는 정해져 있다. */
function* combos(pool, most, from = 0, chosen = []) {
  if (chosen.length > 0) yield chosen;
  if (chosen.length === most) return;
  for (let at = from; at < pool.length; at++) yield* combos(pool, most, at + 1, [...chosen, pool[at]]);
}

// ---- 1단계: 주민 둘. 판이 적어서 모두 만들어 두고 고른다 ----

/**
 * 주민 둘, 말 한두 개로 누가 무엇인지 하나로 정해지는 판 모두. 군더더기 말이 없고, 남는 배정이 "모두 참말쟁이"가 아니다.
 * 말이 적은 판부터, 말의 수가 같으면 쳐 보기를 아무렇게나 누를 때의 횟수가 적은 판부터 놓는다.
 */
let pairMemo = null;
export function pairBoards() {
  if (pairMemo) return pairMemo;
  const found = [];
  for (const says of combos(sayPool(2, SAY_TYPES.pair), 2)) {
    const board = { kind: 'folk', people: [0, 1], says, ask: 'kinds' };
    const solved = solve(board);
    if (solved.possible !== true || allTrue(solved.kinds) || !isLean(board)) continue;
    found.push({ says, presses: expectedPresses(board) });
  }
  found.sort((a, b) => a.says.length - b.says.length || a.presses - b.presses);
  pairMemo = found;
  return found;
}

/** 작은 판(주민 둘)의 후보: 하나로 정해지는 판(yes)과 남는 배정이 없는 판(no). 군더더기 말이 없다. */
const smallMemo = new Map();
export function smallFolkBoards(withRoad = false) {
  const key = withRoad ? 'road' : 'folk';
  if (smallMemo.has(key)) return smallMemo.get(key);
  const lists = { yes: [], no: [] };
  const types = withRoad ? [...SAY_TYPES.small, 'road'] : SAY_TYPES.small;
  for (const says of combos(sayPool(2, types), 2)) {
    const board = withRoad ? { kind: 'road', people: [0, 1], says, ask: 'road' } : { kind: 'folk', people: [0, 1], says, ask: 'kinds' };
    if (checkBoard(board) !== null) continue;
    const solved = solve(board);
    if (!isLean(board)) continue;
    if (solved.possible === true && !(solved.kinds && allTrue(solved.kinds))) lists.yes.push(says);
    // 남는 배정이 없는 판은 말 둘로 된 것만(말 하나로 그런 판은 "나는 거짓말쟁이예요"뿐인데, 이 틀에는 없다)
    else if (solved.possible === false && !withRoad) lists.no.push(says);
  }
  smallMemo.set(key, lists);
  return lists;
}

// ---- 2단계: 상자. 판이 적어서 모두 만들어 두고 고른다 ----

/** 상자 n개에 붙일 수 있는 글 모두(box번째 상자의 글) */
export function labelPool(n, box) {
  const pool = [{ t: 'here' }, { t: 'not-here' }];
  for (let other = 0; other < n; other++) if (other !== box) pool.push({ t: 'in', box: other }, { t: 'not-in', box: other });
  if (n >= 3) for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pool.push({ t: 'in-or', a, b });
  return pool;
}

/** 상자 판의 조건 후보. 상자 셋은 "참인 글은 하나뿐", "거짓인 글은 하나뿐", 상자 둘은 "참인 글은 둘", "거짓인 글은 둘" */
export const BOX_RULES = { 3: [{ of: 'true', n: 1 }, { of: 'false', n: 1 }], 2: [{ of: 'true', n: 2 }, { of: 'false', n: 2 }] };

/**
 * 상자 n개의 판 모두: 보물이 든 상자가 하나로 정해지고, 어느 글도 보물이 어디 있든 늘 참이거나 늘 거짓이지 않다(군더더기 글이 없다).
 * 상자 셋에서는 글마다 참·거짓의 꼴이 서로 다르고, 세 글이 모두 같은 틀이 아니다.
 */
const boxMemo = new Map();
export function boxBoards(n) {
  if (boxMemo.has(n)) return boxMemo.get(n);
  const pools = Array.from({ length: n }, (_, box) => labelPool(n, box));
  const found = [];
  const visit = (labels) => {
    if (labels.length < n) {
      for (const label of pools[labels.length]) visit([...labels, label]);
      return;
    }
    const vectors = Array.from({ length: n }, (_, at) => labelTruths({ labels }, at));
    const byLabel = labels.map((_, box) => vectors.map((truths) => truths[box]).join());
    if (byLabel.some((vector) => !vector.includes('true') || !vector.includes('false'))) return;
    if (n >= 3 && (new Set(byLabel).size < n || new Set(labels.map((label) => label.t)).size === 1)) return;
    for (const rule of BOX_RULES[n]) {
      const board = { kind: 'box', labels, rule, ask: 'box' };
      const answers = boxAnswers(board);
      if (answers.length === 1) found.push({ labels, rule, answer: answers[0] });
    }
  };
  visit([]);
  boxMemo.set(n, found);
  return found;
}

// ---- 3·4단계: 주민 셋. 말을 뽑아 보고 고른다 ----

/** 말 하나를 뽑는다. 틀을 먼저 고르고, 그다음 끼울 주민과 수를 고른다. */
function drawSay(rng, n, types) {
  const type = pick(rng, types);
  return pick(rng, sayPool(n, [type]).filter((say) => say.s.t === type));
}

/**
 * 주민 셋의 판 하나를 뽑는다.
 * @param {'kinds'|'count'|'none'|'road'} want 무엇이 정해지는 판인가
 */
function drawFolk(rng, want) {
  const n = 3;
  const road = want === 'road';
  const types = road ? SAY_TYPES.road : SAY_TYPES.folk;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const size = randInt(rng, 2, 4);
    const says = [];
    for (let guard = 0; says.length < size && guard < 40; guard++) {
      const say = drawSay(rng, n, road && says.length === 0 ? ['road'] : types);
      if (!says.some((other) => sayKey(other) === sayKey(say))) says.push(say);
    }
    if (says.length < 2 || speakers(says) < n - 1) continue;
    const board = { kind: road ? 'road' : 'folk', people: [0, 1, 2], says, ask: road ? 'road' : want === 'count' ? 'count' : 'kinds' };
    const solved = solve(board);
    if (want === 'none' ? solved.possible !== false : solved.possible !== true) continue;
    if (want === 'kinds' && allTrue(solved.kinds)) continue;
    // "몇 명" 판과 갈림길 판은 묻는 것만 정해지고 누가 무엇인지는 다 정해지지 않는 판이다(몰라도 정해진다).
    if ((want === 'count' || want === 'road') && solved.worlds < 2) continue;
    if (!isLean(board)) continue;
    return board;
  }
  throw new Error(`판을 만들지 못했어요: ${want}`);
}

/** 쓸모없는 말("나는 참말쟁이예요")을 하나 더한다. 아무 말도 안 한 주민이 있으면 그 주민이 한다. */
function withUseless(rng, board) {
  const silent = board.people.map((_, index) => index).filter((index) => !board.says.some((say) => say.by === index));
  const by = silent.length > 0 ? silent[0] : randInt(rng, 0, board.people.length - 1);
  return { ...board, says: [...board.says, { by, s: { t: 'me', k: true } }] };
}

// ---- 판 내기 ----

/** 동물을 섞어 주민 n명에게 붙이고, 말의 차례를 섞는다. */
function dress(rng, board) {
  const animals = shuffled(
    rng,
    Array.from({ length: ANIMALS }, (_, index) => index),
  );
  if (board.kind === 'box') return board;
  return { ...board, people: animals.slice(0, board.people.length), says: shuffled(rng, board.says) };
}

/**
 * 판 하나를 만든다.
 * @param {number} level 1~4
 * @param {number} seed 판 번호
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 말 하나뿐인 판을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object, solution: object}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 만들어 내지 않아요');
  const shrink = small && level === LADDER[0].level;
  const rng = createRng(seedFrom('logic', level, seed, shrink ? 'small' : 'any'));
  let board;
  if (rung.mode === 'pair') {
    const pool = shrink ? pairBoards().filter((item) => item.says.length === 1) : pairBoards();
    // 맨 첫 판은 가장 쉬운 판(쳐 보기를 아무렇게나 누를 때의 횟수가 가장 적은 판)이다.
    const chosen = seed === 1 ? pool[0] : pick(rng, pool);
    board = dress(rng, { kind: 'folk', people: [0, 1], says: chosen.says, ask: 'kinds' });
  } else if (rung.mode === 'box') {
    const pool = boxBoards(rung.boxes);
    // 보물이 첫째 상자에 있는 판(첫 가정에서 바로 맞는 판)은 다섯에 하나쯤만 낸다.
    const first = rng() < 0.2;
    const chosen = pick(
      rng,
      pool.filter((item) => (item.answer === 0) === first),
    );
    board = { kind: 'box', labels: chosen.labels, rule: chosen.rule, ask: 'box' };
  } else if (rung.mode === 'folk') {
    const roll = rng();
    const want = roll < NONE_SHARE ? 'none' : roll < NONE_SHARE + (1 - NONE_SHARE) * COUNT_SHARE ? 'count' : 'kinds';
    let made = drawFolk(rng, want);
    if (want !== 'none' && rng() < USELESS_SHARE.folk) made = withUseless(rng, made);
    board = dress(rng, made);
  } else {
    let made = drawFolk(rng, 'road');
    if (rng() < USELESS_SHARE.road) made = withUseless(rng, made);
    board = dress(rng, made);
  }
  return { level, seed, small, board, solution: solve(board) };
}

/** 다음 판 번호. 방금 한 판과 똑같은 판이 나오는 번호는 건너뛴다. */
export function nextSeed(level, seed, options = {}) {
  const now = generateBoard(level, seed, options).board;
  for (let next = seed + 1; next < seed + 40; next++) {
    if (!same(generateBoard(level, next, options).board, now)) return next;
  }
  return seed + 1;
}

/** 판의 좋은 정도를 재는 값들(보고와 테스트용) */
export function measure(board) {
  return {
    presses: expectedPresses(board),
    says: board.says?.length ?? null,
    useless: board.says ? uselessCount(board.says) : 0,
    blank: blankGuess(board),
  };
}
