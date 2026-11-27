// 돼지 주사위: 판과 풀이. 순수 함수만 둔다.
// 놀이: 주사위를 굴린 눈만큼 도토리를 바구니에 담는다. 1이 나오면 돼지가 바구니의 도토리를 다 먹고 차례가 넘어간다.
// 멈추면 바구니의 도토리를 항아리에 옮긴다. 바구니와 항아리를 합쳐 먼저 목표 수에 닿으면 그 자리에서 끝난다.
// "○개에서 멈추기"는 바구니가 ○개 이상이 되면 멈추는 규칙이다(목표에 먼저 닿으면 그 자리에서 끝난다).
//
// 판의 종류(kind)
//   play   선생님과 겨루기. { goal, teacher(선생님이 멈추는 수), seed }. 아이가 먼저 한다. 선생님은 말한 규칙대로만 한다
//   stop   몇 개에서 멈출까. { stops(견줄 멈추는 수들), seed }. 컴퓨터가 멈추는 수마다 1,000 차례씩 해 본다
//   match  누가 먼저 모을까. { stops([작은 수, 큰 수]), goal, seed }. 두 규칙이 1,000판 겨룬다(먼저 하는 쪽을 판마다 번갈아 바꾼다)
//   edge   한 번만 더 굴릴까. { dice(1 | 2), pot(바구니의 도토리), seed }. 한 번 더 굴리면 여러 번 했을 때 늘어날지, 줄어들지, 똑같을지
// 주사위는 시드 난수(rng.js)만 쓴다. 겨루기는 (시드, 몇 번째 굴림)마다 눈을 정해서 같은 판, 같은 고르기는 늘 같은 판이 된다.
// 실험(stop, match, edge)은 판의 시드로 1,000번씩 해 본다. 결과는 보여 주기만 하고 답을 정하지 않는다.
// 선생님이 말하는 사실은 늘 정확히 셈한 것이다: 한 차례에 모으는 도토리의 기댓값(분수, BigInt), 한 번 더 굴릴 때의 모든 경우,
// 두 규칙이 겨룰 때 먼저 모을 확률(차례가 돌아오는 것까지 연립해서 푼 값. 테스트가 다른 방법으로 다시 구한다).
import { createRng, randInt, seedFrom } from './rng.js';

export const KINDS = ['play', 'stop', 'match', 'edge'];
/** 돼지가 먹는 눈 */
export const PIG = 1;
/** 컴퓨터가 한 번에 해 보는 수(차례, 판, 번) */
export const MANY = 1000;
/** "더 많이 해 보기"까지 합쳐 컴퓨터에게 시키는 수의 위 끝(누를 때마다 1,000번) */
export const MAX_MANY = 20;
/** 판의 값의 범위(직접 만들기와 판 점검) */
export const LIMITS = { minGoal: 10, maxGoal: 100, goalStep: 10, minStop: 2, maxStop: 40, minPot: 2, maxPot: 60, minStops: 3, maxStops: 6 };
/** 한 번 더 굴리기의 답: 늘어나요 | 줄어들어요 | 똑같아요 */
export const VERDICTS = ['more', 'less', 'same'];

const int = (value) => Number.isInteger(value);
const between = (value, low, high) => int(value) && value >= low && value <= high;

// ---- 주사위 ----

/** 겨루기의 n번째 굴림(0부터)의 눈. 같은 시드, 같은 번째는 늘 같은 눈이다 */
export const dieAt = (seed, index) => randInt(createRng(seedFrom('pig-die', seed, index)), 1, 6);

// ---- 겨루기 ----

/**
 * 선생님 차례를 끝까지 둔다(멈추는 수가 되거나, 1이 나오거나, 목표에 닿을 때까지).
 * state를 고친다.
 */
function teacherTurn(board, state) {
  const faces = [];
  let basket = 0;
  for (;;) {
    const face = dieAt(board.seed, state.rolls);
    state.rolls += 1;
    faces.push(face);
    if (face === PIG) {
      state.turns.push({ who: 'teacher', faces, got: 0, end: 'pig', lost: basket });
      break;
    }
    basket += face;
    if (state.jars.teacher + basket >= board.goal) {
      state.jars.teacher += basket;
      state.turns.push({ who: 'teacher', faces, got: basket, end: 'goal', lost: 0 });
      state.over = true;
      state.winner = 'teacher';
      break;
    }
    if (basket >= board.teacher) {
      state.jars.teacher += basket;
      state.turns.push({ who: 'teacher', faces, got: basket, end: 'stop', lost: 0 });
      break;
    }
  }
}

/**
 * 겨루기 판을 아이의 고르기대로 다시 둔다. 선생님 차례는 저절로 둔다.
 * @param {object} board { kind: 'play', goal, teacher, seed }
 * @param {string[]} moves 아이가 누른 것('roll' | 'stop')의 줄
 * @returns {{jars: {kid: number, teacher: number}, basket: number, faces: number[], turns: object[], rolls: number, over: boolean, winner: string|null, ok: boolean}}
 *   faces: 아이의 이번 차례에 굴린 눈. turns: 끝난 차례들 { who, faces, got(옮긴 수), end('stop' | 'pig' | 'goal'), lost(돼지가 먹은 수) }.
 *   ok: 모든 고르기가 둘 수 있는 것이었는가(끝난 뒤의 고르기, 빈 바구니로 멈추기는 둘 수 없다)
 */
export function replay(board, moves) {
  const state = { jars: { kid: 0, teacher: 0 }, basket: 0, faces: [], turns: [], rolls: 0, over: false, winner: null, ok: true };
  for (const move of moves) {
    if (state.over || !['roll', 'stop'].includes(move) || (move === 'stop' && state.basket === 0)) {
      state.ok = false;
      break;
    }
    if (move === 'stop') {
      state.jars.kid += state.basket;
      state.turns.push({ who: 'kid', faces: state.faces, got: state.basket, end: 'stop', lost: 0 });
      state.basket = 0;
      state.faces = [];
      teacherTurn(board, state);
      continue;
    }
    const face = dieAt(board.seed, state.rolls);
    state.rolls += 1;
    state.faces = [...state.faces, face];
    if (face === PIG) {
      state.turns.push({ who: 'kid', faces: state.faces, got: 0, end: 'pig', lost: state.basket });
      state.basket = 0;
      state.faces = [];
      teacherTurn(board, state);
      continue;
    }
    state.basket += face;
    if (state.jars.kid + state.basket >= board.goal) {
      state.jars.kid += state.basket;
      state.turns.push({ who: 'kid', faces: state.faces, got: state.basket, end: 'goal', lost: 0 });
      state.basket = 0;
      state.faces = [];
      state.over = true;
      state.winner = 'kid';
    }
  }
  return state;
}

// ---- 한 차례(실험) ----

/** "stop개에서 멈추기"로 한 차례를 한다(주사위 하나). 옮긴 도토리와 돼지가 먹었는지 */
export function turnOnce(stop, rng) {
  let basket = 0;
  for (;;) {
    const face = randInt(rng, 1, 6);
    if (face === PIG) return { got: 0, pig: true };
    basket += face;
    if (basket >= stop) return { got: basket, pig: false };
  }
}

/** 멈추는 수마다 n 차례씩 해 본다. 멈추는 수마다 따로 된 난수를 써서, 견줄 수를 더하거나 빼도 다른 수의 결과는 그대로다 */
export function stopTally(stops, n, seed) {
  return stops.map((stop) => {
    const rng = createRng(seedFrom('pig-stop', seed, stop));
    let total = 0;
    let pigs = 0;
    for (let at = 0; at < n; at++) {
      const turn = turnOnce(stop, rng);
      total += turn.got;
      if (turn.pig) pigs += 1;
    }
    return { stop, total, pigs, turns: n };
  });
}

/** 컴퓨터에게 시킨 시드: 첫 1,000번은 판에 적힌 시드, 그다음부터는 그 시드에서 만든다 */
export const manySeed = (board, press) => (press === 0 ? board.seed : seedFrom('pig-many', board.seed, press));

/** 두 규칙이 목표까지 한 판 겨룬다. first: 먼저 하는 쪽(0 | 1). 먼저 모은 쪽(0 | 1)을 낸다 */
export function gameOnce(stops, goal, rng, first) {
  const jars = [0, 0];
  let who = first;
  for (;;) {
    let basket = 0;
    for (;;) {
      const face = randInt(rng, 1, 6);
      if (face === PIG) {
        basket = 0;
        break;
      }
      basket += face;
      if (jars[who] + basket >= goal) return who;
      if (basket >= stops[who]) break;
    }
    jars[who] += basket;
    who = 1 - who;
  }
}

/** 두 규칙이 n판 겨룬다(먼저 하는 쪽을 판마다 번갈아 바꾼다. 첫 판은 작은 수가 먼저). 쪽마다 먼저 모은 판의 수 */
export function matchTally(stops, goal, n, seed) {
  const rng = createRng(seedFrom('pig-match', seed));
  const wins = [0, 0];
  for (let at = 0; at < n; at++) wins[gameOnce(stops, goal, rng, at % 2)] += 1;
  return wins;
}

/** 바구니에 pot개가 있을 때 한 번 더 굴리기를 n번 해 본다. 1이 나온 번(주사위 둘이면 하나라도 1), 얻은 수, 잃은 수 */
export function edgeTally(dice, pot, n, seed) {
  const rng = createRng(seedFrom('pig-edge', seed));
  let pigs = 0;
  let gained = 0;
  for (let at = 0; at < n; at++) {
    let pig = false;
    let sum = 0;
    for (let die = 0; die < dice; die++) {
      const face = randInt(rng, 1, 6);
      if (face === PIG) pig = true;
      sum += face;
    }
    if (pig) pigs += 1;
    else gained += sum;
  }
  return { n, pigs, gained, lost: pigs * pot };
}

/** 컴퓨터에게 presses번 시킨 결과를 모두 더한 것(판의 종류마다) */
export function manyOf(board, presses) {
  if (board.kind === 'stop') {
    const sums = board.stops.map((stop) => ({ stop, total: 0, pigs: 0, turns: 0 }));
    for (let press = 0; press < presses; press++) {
      stopTally(board.stops, MANY, manySeed(board, press)).forEach((item, index) => {
        sums[index].total += item.total;
        sums[index].pigs += item.pigs;
        sums[index].turns += item.turns;
      });
    }
    return sums;
  }
  if (board.kind === 'match') {
    const wins = [0, 0];
    for (let press = 0; press < presses; press++) {
      const result = matchTally(board.stops, board.goal, MANY, manySeed(board, press));
      wins[0] += result[0];
      wins[1] += result[1];
    }
    return { wins, games: wins[0] + wins[1] };
  }
  if (board.kind === 'edge') {
    const sum = { n: 0, pigs: 0, gained: 0, lost: 0 };
    for (let press = 0; press < presses; press++) {
      const result = edgeTally(board.dice, board.pot, MANY, manySeed(board, press));
      for (const key of Object.keys(sum)) sum[key] += result[key];
    }
    return sum;
  }
  throw new Error(`실험이 없는 판이에요: ${board.kind}`);
}

/** 실험 결과에서 가장 많이 모은 멈추는 수들(같으면 여럿) */
export function topStops(tally) {
  const max = Math.max(...tally.map((item) => item.total));
  return tally.filter((item) => item.total === max).map((item) => item.stop);
}

// ---- 정확한 셈: 분수(BigInt) ----

const gcdBig = (x, y) => {
  let a = x < 0n ? -x : x;
  let b = y < 0n ? -y : y;
  while (b) [a, b] = [b, a % b];
  return a;
};
/** 약분한 분수 { num, den } */
export function frac(num, den = 1n) {
  const g = gcdBig(num, den) || 1n;
  const sign = den < 0n ? -1n : 1n;
  return { num: (sign * num) / g, den: (sign * den) / g };
}
const plus = (x, y) => frac(x.num * y.den + y.num * x.den, x.den * y.den);
/** 두 분수를 견준다: 앞이 크면 1, 같으면 0, 작으면 -1 */
export function compareFrac(x, y) {
  const left = x.num * y.den;
  const right = y.num * x.den;
  return left > right ? 1 : left < right ? -1 : 0;
}

/**
 * "stop개에서 멈추기"로 한 차례에 모으는 도토리의 기댓값(정확한 분수).
 * 바구니가 p개일 때 앞으로 모을 값 f(p): stop개 이상이면 p, 아니면 여섯 눈 가운데 1은 0, 2~6은 f(p+눈)의 평균.
 */
export function turnValue(stop) {
  const memo = new Map();
  const valueAt = (pot) => {
    if (pot >= stop) return frac(BigInt(pot));
    if (memo.has(pot)) return memo.get(pot);
    let sum = frac(0n);
    for (let face = 2; face <= 6; face++) sum = plus(sum, valueAt(pot + face));
    const value = frac(sum.num, sum.den * 6n);
    memo.set(pot, value);
    return value;
  };
  return valueAt(0);
}

/** 견줄 멈추는 수 가운데 기댓값이 가장 큰 것들(같으면 여럿) */
export function bestStops(stops) {
  const values = stops.map((stop) => turnValue(stop));
  let best = values[0];
  for (const value of values) if (compareFrac(value, best) > 0) best = value;
  return stops.filter((_, index) => compareFrac(values[index], best) === 0);
}

/**
 * 한 번 더 굴리기의 모든 경우(주사위 하나는 6가지, 둘은 왼쪽과 오른쪽을 가른 36가지).
 * @returns {{cases: number, pigCases: number, gain: number, lose: number, verdict: string, list: Array<{faces: number[], pig: boolean, add: number}>}}
 *   gain: 1이 없는 경우에 더해지는 수를 모두 더한 것, lose: 1이 있는 경우마다 바구니(pot개)를 잃은 것을 모두 더한 것
 */
export function edgeCases(dice, pot) {
  let list = [[]];
  for (let die = 0; die < dice; die++) list = list.flatMap((faces) => [1, 2, 3, 4, 5, 6].map((face) => [...faces, face]));
  const cases = list.map((faces) => {
    const pig = faces.includes(PIG);
    return { faces, pig, add: pig ? 0 : faces.reduce((sum, face) => sum + face, 0) };
  });
  const pigCases = cases.filter((item) => item.pig).length;
  const gain = cases.reduce((sum, item) => sum + item.add, 0);
  const lose = pigCases * pot;
  return { cases: cases.length, pigCases, gain, lose, verdict: gain > lose ? 'more' : gain < lose ? 'less' : 'same', list: cases };
}

// ---- 겨룰 때 먼저 모을 확률 ----

/** 모은 수 score에서 한 차례의 결과: 옮긴 수 → 확률(0은 돼지가 먹은 것). 목표에 닿으면 그 자리에서 끝난다 */
export function turnOutcomes(score, goal, stop) {
  const limit = Math.min(stop, goal - score);
  const reach = new Array(limit).fill(0);
  reach[0] = 1;
  const out = new Map();
  const add = (key, value) => out.set(key, (out.get(key) ?? 0) + value);
  for (let pot = 0; pot < limit; pot++) {
    const chance = reach[pot];
    if (chance === 0) continue;
    add(0, chance / 6);
    for (let face = 2; face <= 6; face++) {
      if (pot + face >= limit) add(pot + face, chance / 6);
      else reach[pot + face] += chance / 6;
    }
  }
  return out;
}

/**
 * 두 규칙(stops[0]개, stops[1]개에서 멈추기)이 goal개 먼저 모으기를 할 때, 앞 규칙이 먼저 모을 확률.
 * 먼저 하는 쪽을 번갈아 바꾸므로 두 경우의 가운데 값이다.
 * 모은 수 (a, b)마다 차례인 쪽이 이길 확률을 둘 다 돼지에게 먹히면 같은 자리로 돌아오는 것까지 두 식을 함께 풀어 구한다(합이 큰 자리부터).
 */
export function winChance(stops, goal) {
  const [ka, kb] = stops;
  const key = (x, y) => x * 1024 + y;
  const moveA = new Map(); // 앞 규칙의 차례이고 앞 규칙이 a, 뒤 규칙이 b일 때 앞 규칙이 이길 확률
  const moveB = new Map(); // 뒤 규칙의 차례이고 뒤 규칙이 b, 앞 규칙이 a일 때 뒤 규칙이 이길 확률
  const outcomesA = Array.from({ length: goal }, (_, score) => turnOutcomes(score, goal, ka));
  const outcomesB = Array.from({ length: goal }, (_, score) => turnOutcomes(score, goal, kb));
  for (let sum = 2 * goal - 2; sum >= 0; sum--) {
    for (let a = Math.max(0, sum - goal + 1); a <= Math.min(goal - 1, sum); a++) {
      const b = sum - a;
      const fromA = outcomesA[a];
      const fromB = outcomesB[b];
      const pigA = fromA.get(0) ?? 0;
      const pigB = fromB.get(0) ?? 0;
      let restA = 0;
      for (const [got, chance] of fromA) if (got > 0) restA += a + got >= goal ? chance : chance * (1 - moveB.get(key(b, a + got)));
      let restB = 0;
      for (const [got, chance] of fromB) if (got > 0) restB += b + got >= goal ? chance : chance * (1 - moveA.get(key(a, b + got)));
      // A = restA + pigA(1 − B), B = restB + pigB(1 − A)
      const valueA = (restA + pigA - pigA * restB - pigA * pigB) / (1 - pigA * pigB);
      moveA.set(key(a, b), valueA);
      moveB.set(key(b, a), restB + pigB * (1 - valueA));
    }
  }
  return (moveA.get(key(0, 0)) + (1 - moveB.get(key(0, 0)))) / 2;
}

// ---- 판 ----

/** 판이 쓸 수 있는 값인가. 쓸 수 없으면 까닭, 쓸 수 있으면 null */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  if (!KINDS.includes(board.kind)) return 'kind';
  if (!int(board.seed)) return 'seed';
  const goalOk = (goal) => between(goal, LIMITS.minGoal, LIMITS.maxGoal) && goal % LIMITS.goalStep === 0;
  const stopOk = (stop) => between(stop, LIMITS.minStop, LIMITS.maxStop);
  if (board.kind === 'play') {
    if (!goalOk(board.goal)) return 'goal';
    if (!stopOk(board.teacher)) return 'teacher';
    return null;
  }
  if (board.kind === 'stop') {
    const { stops } = board;
    if (!Array.isArray(stops) || stops.length < LIMITS.minStops || stops.length > LIMITS.maxStops || !stops.every(stopOk)) return 'stops';
    if (!stops.every((stop, index) => index === 0 || stops[index - 1] < stop)) return 'order';
    return null;
  }
  if (board.kind === 'match') {
    const { stops } = board;
    if (!Array.isArray(stops) || stops.length !== 2 || !stops.every(stopOk) || stops[0] >= stops[1]) return 'stops';
    if (!goalOk(board.goal)) return 'goal';
    return null;
  }
  if (![1, 2].includes(board.dice)) return 'dice';
  if (!between(board.pot, LIMITS.minPot, LIMITS.maxPot)) return 'pot';
  return null;
}

export function copyBoard(board) {
  if (board.kind === 'play') return { kind: 'play', goal: board.goal, teacher: board.teacher, seed: board.seed };
  if (board.kind === 'stop') return { kind: 'stop', stops: board.stops.slice(), seed: board.seed };
  if (board.kind === 'match') return { kind: 'match', stops: board.stops.slice(), goal: board.goal, seed: board.seed };
  return { kind: 'edge', dice: board.dice, pot: board.pot, seed: board.seed };
}

/** 같은 판인가(시드까지) */
export const sameBoard = (x, y) => JSON.stringify(copyBoard(x)) === JSON.stringify(copyBoard(y));

/** 기댓값을 기록에 남기는 꼴("분자/분모") */
const fracText = (value) => `${value.num}/${value.den}`;

/**
 * 판의 풀이.
 *   play   겨루기라 정해진 답이 없다
 *   stop   멈추는 수마다 한 차례의 기댓값과 가장 큰 것
 *   match  앞 규칙이 먼저 모을 확률과 더 자주 먼저 모으는 쪽(0 | 1)
 *   edge   모든 경우와 답(늘어나요, 줄어들어요, 똑같아요)
 */
export function solve(board) {
  if (board.kind === 'play') return { possible: true, kind: 'play' };
  if (board.kind === 'stop') return { possible: true, kind: 'stop', values: board.stops.map((stop) => fracText(turnValue(stop))), best: bestStops(board.stops) };
  if (board.kind === 'match') {
    const chance = winChance(board.stops, board.goal);
    return { possible: true, kind: 'match', chance, favorite: chance > 0.5 ? 0 : chance < 0.5 ? 1 : null };
  }
  const { cases, pigCases, gain, lose, verdict } = edgeCases(board.dice, board.pot);
  return { possible: true, kind: 'edge', cases, pigCases, gain, lose, verdict };
}

/** 실험의 첫 1,000번이 정확한 셈과 같은 쪽인가(판을 낼 때 시드를 고르는 데 쓴다) */
export function agrees(board, solution = solve(board)) {
  if (board.kind === 'stop') {
    const top = topStops(manyOf(board, 1));
    return top.length === 1 && solution.best.includes(top[0]);
  }
  if (board.kind === 'match') {
    const { wins } = manyOf(board, 1);
    return solution.favorite !== null && wins[solution.favorite] > wins[1 - solution.favorite];
  }
  if (board.kind === 'edge') {
    if (solution.verdict === 'same') return true;
    const tally = manyOf(board, 1);
    return solution.verdict === 'more' ? tally.gained > tally.lost : tally.gained < tally.lost;
  }
  return true;
}

/** 판의 시드를 고른다: 실험의 첫 1,000번이 정확한 셈과 같은 쪽인 시드. 못 찾으면 처음 것(사다리에서는 테스트가 찾았는지 본다) */
export function pickSeed(board, key, tries = 200) {
  const first = seedFrom('pig-seed', key, 0);
  if (board.kind === 'play') return first;
  const solution = solve({ ...board, seed: first });
  for (let at = 0; at < tries; at++) {
    const seed = seedFrom('pig-seed', key, at);
    if (agrees({ ...board, seed }, solution)) return seed;
  }
  return first;
}
