// 공정한 게임일까: 판과 풀이. 순수 함수만 둔다.
// 판은 두 동물(다람쥐 a, 고슴도치 b)이 동전이나 주사위를 던져 한 번마다 누가 가져갈지 정한 규칙이다.
// 규칙(rule)은 { device, measure, a }다.
//   device   던지는 것: 'coin2'(동전 둘) | 'coin3'(동전 셋) | 'die1'(주사위 하나) | 'die2'(주사위 둘)
//   measure  나온 것에서 보는 것(device마다 고를 수 있는 것이 다르다. MEASURES)
//   a        그 값이 나오면 다람쥐가 가져가는 값들. 나머지 값은 모두 고슴도치가 가져간다(비기는 경우가 없다)
// 동전의 면은 1이 앞면, 0이 뒷면이다. 주사위 눈은 1~6이다. 두 개를 던지면 왼쪽과 오른쪽을 가른다(순서가 있다).
// 누가 유리한지는 늘 모든 경우를 세어서 정한다(풀이). 컴퓨터가 많이 던져 보는 것(simulate)은 보여 주기만 하고 답을 정하지 않는다.
// 던지기는 시드 난수(rng.js)만 쓰고, 주사위는 주사위 미로의 rollDie를 그대로 쓴다.
import { rollDie } from './maze.js';
import { createRng, randInt, seedFrom } from './rng.js';

/** 던지는 것마다: 무엇을(coin|die) 몇 개 */
export const DEVICES = {
  coin2: { kind: 'coin', count: 2 },
  coin3: { kind: 'coin', count: 3 },
  die1: { kind: 'die', count: 1 },
  die2: { kind: 'die', count: 2 },
};
export const DEVICE_IDS = Object.keys(DEVICES);

/** 던지는 것마다 볼 수 있는 것 */
export const MEASURES = {
  coin2: ['same', 'heads'],
  coin3: ['same', 'heads'],
  die1: ['face'],
  die2: ['sum', 'sumParity', 'prodParity', 'diff', 'max'],
};

/** 판의 종류: judge(공정한지 고르기) | fix(규칙 한 군데를 바꿔서 공정하게) */
export const MODES = ['judge', 'fix'];
/** 고르는 답: 공정해요 | 다람쥐가 유리해요 | 고슴도치가 유리해요 */
export const CHOICES = ['fair', 'a', 'b'];
/** 아이가 던져 보는 수 */
export const PLAYS = 10;
/** 컴퓨터가 한 번에 던지는 수 */
export const MANY = 1000;
/** 컴퓨터에게 더 던지게 하는 수의 위 끝(누를 때마다 1,000번) */
export const MAX_MANY = 20;
/** 1,000번 던진 결과가 "모든 경우를 센 것과 맞는다"고 보는 차이(공정하면 두 수의 차가 이 이하, 아니면 유리한 쪽이 이만큼 넘게 많다) */
export const AGREE = 40;

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

/** 던지는 것과 보는 것에 따라 나올 수 있는 값(칩의 차례) */
export function valuesOf(device, measure) {
  const { count } = DEVICES[device];
  if (measure === 'same') return ['same', 'differ'];
  if (measure === 'heads') return range(0, count);
  if (measure === 'face') return range(1, 6);
  if (measure === 'sum') return range(2, 12);
  if (measure === 'sumParity' || measure === 'prodParity') return ['even', 'odd'];
  if (measure === 'diff') return range(0, 5);
  if (measure === 'max') return range(1, 6);
  throw new Error(`없는 보는 것이에요: ${measure}`);
}

/** 한 번 던진 결과(면이나 눈의 줄)에서 보는 값 */
export function measureOf(measure, faces) {
  if (measure === 'same') return faces.every((face) => face === faces[0]) ? 'same' : 'differ';
  if (measure === 'heads') return faces.filter((face) => face === 1).length;
  if (measure === 'face') return faces[0];
  if (measure === 'sum') return faces[0] + faces[1];
  if (measure === 'sumParity') return (faces[0] + faces[1]) % 2 === 0 ? 'even' : 'odd';
  if (measure === 'prodParity') return (faces[0] * faces[1]) % 2 === 0 ? 'even' : 'odd';
  if (measure === 'diff') return Math.abs(faces[0] - faces[1]);
  if (measure === 'max') return Math.max(faces[0], faces[1]);
  throw new Error(`없는 보는 것이에요: ${measure}`);
}

/** 한 번 던진 결과를 누가 가져가는가: 'a'(다람쥐) | 'b'(고슴도치) */
export const ownerOf = (rule, faces) => (rule.a.includes(measureOf(rule.measure, faces)) ? 'a' : 'b');

/** 나올 수 있는 모든 경우(순서가 있다). 동전은 [1, 0], 주사위는 1~6을 왼쪽부터 차례로 */
export function outcomesOf(device) {
  const { kind, count } = DEVICES[device];
  const sides = kind === 'coin' ? [1, 0] : range(1, 6);
  let list = [[]];
  for (let at = 0; at < count; at++) list = list.flatMap((faces) => sides.map((side) => [...faces, side]));
  return list;
}

/** 규칙이 쓸 수 있는 값인가. 쓸 수 없으면 까닭, 쓸 수 있으면 null */
export function checkRule(rule) {
  if (!rule || typeof rule !== 'object') return 'no-rule';
  if (!DEVICE_IDS.includes(rule.device)) return 'device';
  if (!MEASURES[rule.device].includes(rule.measure)) return 'measure';
  if (!Array.isArray(rule.a)) return 'values';
  const values = valuesOf(rule.device, rule.measure);
  if (!rule.a.every((value) => values.includes(value))) return 'values';
  if (new Set(rule.a).size !== rule.a.length) return 'values';
  return null;
}

/** 값의 차례대로 정리한 규칙(같은 규칙은 늘 같은 꼴) */
export function tidyRule(rule) {
  const values = valuesOf(rule.device, rule.measure);
  return { device: rule.device, measure: rule.measure, a: values.filter((value) => rule.a.includes(value)) };
}

export const ruleKey = (rule) => `${rule.device}:${rule.measure}:${tidyRule(rule).a.join(',')}`;

/** 값 하나를 다른 쪽으로 옮긴 규칙(규칙 고치기) */
export function toggled(rule, value) {
  const a = rule.a.includes(value) ? rule.a.filter((item) => item !== value) : [...rule.a, value];
  return tidyRule({ ...rule, a });
}

/** 세어 본 수에서 누가 유리한가 */
export const verdictOf = (a, b) => (a === b ? 'fair' : a > b ? 'a' : 'b');

/**
 * 모든 경우를 센다.
 * @returns {{total: number, a: number, b: number, verdict: string, byValue: Array<[value, number]>}} byValue: 값마다 그 값이 나오는 경우의 수(칩의 차례대로)
 */
export function countCases(rule) {
  const values = valuesOf(rule.device, rule.measure);
  const counts = new Map(values.map((value) => [value, 0]));
  let a = 0;
  let b = 0;
  for (const faces of outcomesOf(rule.device)) {
    const value = measureOf(rule.measure, faces);
    counts.set(value, counts.get(value) + 1);
    if (rule.a.includes(value)) a += 1;
    else b += 1;
  }
  return { total: a + b, a, b, verdict: verdictOf(a, b), byValue: values.map((value) => [value, counts.get(value)]) };
}

/**
 * 순서만 바뀐 경우를 한 가지로 셌을 때(왼쪽 3·오른쪽 4와 왼쪽 4·오른쪽 3을 하나로)의 판정.
 * 아이가 이렇게 세어서 고른 것 같으면 선생님이 그 짐작을 말한다. 이렇게 세는 것은 틀린 셈이다(경우마다 잘 나오는 정도가 달라진다).
 */
export function unorderedCount(rule) {
  const seen = new Map();
  for (const faces of outcomesOf(rule.device)) {
    const key = faces.slice().sort((x, y) => x - y).join(',');
    if (!seen.has(key)) seen.set(key, ownerOf(rule, faces));
  }
  const owners = [...seen.values()];
  const a = owners.filter((owner) => owner === 'a').length;
  const b = owners.length - a;
  return { total: owners.length, a, b, verdict: verdictOf(a, b) };
}

/** 규칙 고치기: 값 하나만 다른 쪽으로 옮겨서 공정해지는 값들(칩의 차례대로) */
export function fixesOf(rule) {
  return valuesOf(rule.device, rule.measure).filter((value) => countCases(toggled(rule, value)).verdict === 'fair');
}

// ---- 던지기 ----

/** 한 번 던진다: 면이나 눈의 줄 */
export function throwOnce(device, rng) {
  const { kind, count } = DEVICES[device];
  return Array.from({ length: count }, () => (kind === 'coin' ? randInt(rng, 0, 1) : rollDie(rng)));
}

/** 판의 시드로 아이가 던질 처음 n번(같은 판은 늘 같다) */
export function throwsFor(board, n) {
  const rng = createRng(board.throws);
  return Array.from({ length: n }, () => throwOnce(board.rule.device, rng));
}

/** 던진 것들을 누가 몇 번 가져갔는지 */
export function tallyOf(rule, throws) {
  const a = throws.filter((faces) => ownerOf(rule, faces) === 'a').length;
  return { a, b: throws.length - a };
}

/** 컴퓨터가 n번 던진다. 같은 (규칙, n, 시드)는 늘 같은 결과다 */
export function simulate(rule, n, seed) {
  const rng = createRng(seed);
  let a = 0;
  for (let at = 0; at < n; at++) if (ownerOf(rule, throwOnce(rule.device, rng)) === 'a') a += 1;
  return { a, b: n - a, total: n };
}

/** 컴퓨터에게 던지게 한 시드: 첫 1,000번은 판에 적힌 시드, 그다음부터는 그 시드에서 만든다 */
export const manySeed = (board, press) => (press === 0 ? board.many : seedFrom('fair-many', board.many, press));

/** 컴퓨터에게 presses번 던지게 한 결과를 모두 더한 것(규칙은 지금 규칙) */
export function manyTally(board, rule, presses) {
  let a = 0;
  let b = 0;
  for (let press = 0; press < presses; press++) {
    const result = simulate(rule, MANY, manySeed(board, press));
    a += result.a;
    b += result.b;
  }
  return { a, b, total: a + b };
}

/** 던진 결과가 모든 경우를 센 판정과 맞는가(공정하면 차가 slack 이하, 아니면 유리한 쪽이 slack보다 많다) */
export function agrees(tally, verdict, slack = AGREE) {
  if (verdict === 'fair') return Math.abs(tally.a - tally.b) <= slack;
  const [win, lose] = verdict === 'a' ? [tally.a, tally.b] : [tally.b, tally.a];
  return win - lose > slack;
}

/**
 * 아이의 열 번이 어떻게 보이는가.
 *   honest   공정하면 두 수의 차가 2 이하, 아니면 유리한 쪽이 더 많다
 *   mislead  공정하면 차가 4 이상, 아니면 유리한 쪽이 많지 않다(같거나 적다)
 */
export function lookOf(tally, verdict) {
  if (verdict === 'fair') {
    const gap = Math.abs(tally.a - tally.b);
    return gap <= 2 ? 'honest' : gap >= 4 ? 'mislead' : 'plain';
  }
  const [win, lose] = verdict === 'a' ? [tally.a, tally.b] : [tally.b, tally.a];
  return win > lose ? 'honest' : 'mislead';
}

// ---- 판 ----

/** 판이 쓸 수 있는 값인가. 쓸 수 없으면 까닭, 쓸 수 있으면 null */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  if (!MODES.includes(board.mode)) return 'mode';
  const problem = checkRule(board.rule);
  if (problem) return problem;
  if (!Number.isInteger(board.throws) || !Number.isInteger(board.many)) return 'seed';
  if (board.name !== null && typeof board.name !== 'string') return 'name';
  if (board.mode === 'fix') {
    // 고칠 판은 처음 규칙이 공정하지 않고, 한 군데만 바꿔서 공정해지는 곳이 있어야 한다
    if (countCases(board.rule).verdict === 'fair') return 'already-fair';
    if (fixesOf(board.rule).length === 0) return 'no-fix';
  }
  return null;
}

export const copyBoard = (board) => ({ mode: board.mode, rule: tidyRule(board.rule), name: board.name ?? null, throws: board.throws, many: board.many });

/** 판의 풀이: 모든 경우를 센 수와 판정, 순서 없이 센 판정, 고칠 수 있는 곳 */
export function solve(board) {
  const counted = countCases(board.rule);
  return {
    possible: true,
    ...counted,
    unordered: unorderedCount(board.rule).verdict,
    fixes: board.mode === 'fix' ? fixesOf(board.rule) : [],
  };
}

/** 고른 답이 모든 경우를 센 판정과 같은가 */
export const isRight = (rule, choice) => countCases(rule).verdict === choice;

/** 같은 판인가(규칙과 시드) */
export const sameBoard = (x, y) => x.mode === y.mode && ruleKey(x.rule) === ruleKey(y.rule) && x.throws === y.throws && x.many === y.many;

/**
 * 시드를 고른다: 아이의 열 번이 바라는 모습(look)이고, 컴퓨터의 첫 1,000번이 모든 경우를 센 것과 맞는 시드.
 * look이 'any'면 열 번은 아무렇게나 둔다. 바라는 시드를 못 찾으면 처음 것을 쓴다(사다리에서는 테스트가 찾았는지 본다).
 */
export function pickSeeds(rule, key, look = 'any', tries = 5000) {
  const { verdict } = countCases(rule);
  let throws = seedFrom('fair-throws', key, 0);
  if (look !== 'any') {
    for (let at = 0; at < tries; at++) {
      const seed = seedFrom('fair-throws', key, at);
      const tally = tallyOf(rule, throwsFor({ rule, throws: seed }, PLAYS));
      if (lookOf(tally, verdict) === look) {
        throws = seed;
        break;
      }
    }
  }
  let many = seedFrom('fair-many-first', key, 0);
  for (let at = 0; at < tries; at++) {
    const seed = seedFrom('fair-many-first', key, at);
    if (agrees(simulate(rule, MANY, seed), verdict)) {
      many = seed;
      break;
    }
  }
  return { throws, many };
}

/** 두 주사위의 합마다 n번 가운데 몇 번 나왔는지("왜 그럴까?"의 막대) */
export function sumBars(n, seed) {
  const rng = createRng(seed);
  const bars = new Array(13).fill(0);
  for (let at = 0; at < n; at++) {
    const [x, y] = throwOnce('die2', rng);
    bars[x + y] += 1;
  }
  return range(2, 12).map((sum) => [sum, bars[sum]]);
}
