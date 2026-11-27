// 돼지 주사위를 풀이 프로그램과 다른 방법으로 다시 따진다(테스트에서만 쓴다).
// 풀이 프로그램은 바구니마다 앞으로 모을 값을 뒤에서부터 구하고(기댓값), 모은 수의 짝마다 두 식을 함께 풀어 먼저 모을 확률을 구한다.
// 여기서는
//   - 굴린 눈의 줄을 하나하나 모두 늘어놓아 확률을 곱해 더하고(작은 멈추는 수), 큰 멈추는 수는 바구니의 확률을 앞에서부터 밀어 나간다
//   - 먼저 모을 확률은 (두 쪽의 모은 수, 바구니, 차례)의 모든 자리를 값이 더 바뀌지 않을 때까지 되풀이해 고친다
//   - 컴퓨터가 해 보는 것은 같은 시드 난수로 다른 코드가 다시 굴린다
// 분수는 BigInt로 셈한다.
import { createRng, randInt, seedFrom } from '../../src/core/rng.js';

const gcd = (x, y) => {
  let a = x < 0n ? -x : x;
  let b = y < 0n ? -y : y;
  while (b) [a, b] = [b, a % b];
  return a;
};
const make = (num, den) => {
  const g = gcd(num, den) || 1n;
  return { num: num / g, den: den / g };
};
const add = (x, y) => make(x.num * y.den + y.num * x.den, x.den * y.den);

/** 굴린 눈의 줄을 모두 늘어놓아 "stop개에서 멈추기"의 한 차례 기댓값을 구한다(줄 하나의 확률은 6의 거듭제곱 분의 1) */
export function bruteTurnValue(stop) {
  let total = { num: 0n, den: 1n };
  const walk = (basket, depth) => {
    if (basket >= stop) {
      total = add(total, make(BigInt(basket), 6n ** BigInt(depth)));
      return;
    }
    // 1이 나오면 0개라 더할 것이 없다
    for (let face = 2; face <= 6; face++) walk(basket + face, depth + 1);
  };
  walk(0, 0);
  return total;
}

/** 바구니마다 머무를 확률을 앞에서부터 밀어 나가 한 차례 기댓값을 구한다(큰 멈추는 수에도 쓴다) */
export function forwardTurnValue(stop) {
  let reach = new Map([[0, { num: 1n, den: 1n }]]);
  let total = { num: 0n, den: 1n };
  while (reach.size > 0) {
    const next = new Map();
    for (const [basket, chance] of reach) {
      for (let face = 2; face <= 6; face++) {
        const value = basket + face;
        const step = make(chance.num, chance.den * 6n);
        if (value >= stop) total = add(total, make(step.num * BigInt(value), step.den));
        else next.set(value, next.has(value) ? add(next.get(value), step) : step);
      }
    }
    reach = next;
  }
  return total;
}

/** 두 분수가 같은가 */
export const sameFrac = (x, y) => x.num * y.den === y.num * x.den;

/** 한 번 더 굴리기의 모든 경우를 겹친 반복으로 센다 */
export function bruteEdge(dice, pot) {
  let gain = 0;
  let pigs = 0;
  let cases = 0;
  const faces = [1, 2, 3, 4, 5, 6];
  for (const a of faces) {
    for (const b of dice === 2 ? faces : [0]) {
      cases += 1;
      if (a === 1 || b === 1) pigs += 1;
      else gain += a + b;
    }
  }
  const lose = pigs * pot;
  return { cases, pigs, gain, lose, verdict: gain > lose ? 'more' : gain < lose ? 'less' : 'same' };
}

/**
 * 두 규칙이 goal개 먼저 모으기를 할 때 앞 규칙이 먼저 모을 확률(먼저 하는 쪽을 번갈아 바꾼 가운데 값).
 * (앞 규칙의 모은 수, 뒤 규칙의 모은 수, 바구니, 차례)의 모든 자리에서 앞 규칙이 이길 확률을 0에서 시작해 바뀌지 않을 때까지 되풀이해 고친다.
 */
export function bruteWinChance(stops, goal) {
  const room = Math.max(...stops);
  const index = (a, b, basket, mover) => ((a * goal + b) * room + basket) * 2 + mover;
  const value = new Float64Array(goal * goal * room * 2);
  const list = [];
  for (let a = goal - 1; a >= 0; a--) {
    for (let b = goal - 1; b >= 0; b--) {
      for (const mover of [0, 1]) {
        const mine = mover === 0 ? a : b;
        const limit = Math.min(stops[mover], goal - mine);
        for (let basket = limit - 1; basket >= 0; basket--) list.push([a, b, basket, mover]);
      }
    }
  }
  for (let sweep = 0; sweep < 5000; sweep++) {
    let change = 0;
    for (const [a, b, basket, mover] of list) {
      let next = value[index(a, b, 0, 1 - mover)] / 6;
      for (let face = 2; face <= 6; face++) {
        const now = basket + face;
        const mine = (mover === 0 ? a : b) + now;
        if (mine >= goal) next += (mover === 0 ? 1 : 0) / 6;
        else if (now >= stops[mover]) next += (mover === 0 ? value[index(mine, b, 0, 1)] : value[index(a, mine, 0, 0)]) / 6;
        else next += value[index(a, b, now, mover)] / 6;
      }
      const at = index(a, b, basket, mover);
      change = Math.max(change, Math.abs(next - value[at]));
      value[at] = next;
    }
    if (change < 1e-14) break;
  }
  return (value[index(0, 0, 0, 0)] + value[index(0, 0, 0, 1)]) / 2;
}

/** 같은 시드 난수로 다시 굴려 멈추는 수마다 n 차례 모은 수와 돼지가 먹은 차례를 센다 */
export function bruteStopTally(stops, n, seed) {
  return stops.map((stop) => {
    const rng = createRng(seedFrom('pig-stop', seed, stop));
    let total = 0;
    let pigs = 0;
    let turns = 0;
    let basket = 0;
    while (turns < n) {
      const face = randInt(rng, 1, 6);
      if (face === 1) {
        pigs += 1;
        turns += 1;
        basket = 0;
      } else if (basket + face >= stop) {
        total += basket + face;
        turns += 1;
        basket = 0;
      } else basket += face;
    }
    return { stop, total, pigs };
  });
}

/** 같은 시드 난수로 다시 굴려 두 규칙이 n판 겨룬 결과(쪽마다 먼저 모은 판) */
export function bruteMatchTally(stops, goal, n, seed) {
  const rng = createRng(seedFrom('pig-match', seed));
  const wins = [0, 0];
  for (let game = 0; game < n; game++) {
    const jars = [0, 0];
    let who = game % 2;
    let basket = 0;
    let winner = null;
    while (winner === null) {
      const face = randInt(rng, 1, 6);
      if (face === 1) {
        basket = 0;
        who = 1 - who;
        continue;
      }
      basket += face;
      if (jars[who] + basket >= goal) winner = who;
      else if (basket >= stops[who]) {
        jars[who] += basket;
        basket = 0;
        who = 1 - who;
      }
    }
    wins[winner] += 1;
  }
  return wins;
}

/** 같은 시드 난수로 다시 굴려 한 번 더 굴리기를 n번 한 결과 */
export function bruteEdgeTally(dice, pot, n, seed) {
  const rng = createRng(seedFrom('pig-edge', seed));
  let pigs = 0;
  let gained = 0;
  for (let at = 0; at < n; at++) {
    const faces = Array.from({ length: dice }, () => randInt(rng, 1, 6));
    if (faces.includes(1)) pigs += 1;
    else gained += faces.reduce((sum, face) => sum + face, 0);
  }
  return { pigs, gained, lost: pigs * pot };
}

/**
 * 겨루기를 처음부터 다시 둔다(풀이 프로그램의 replay와 다른 코드). 굴림마다 시드와 번째로 눈을 정한다.
 * @returns {{kid: number, teacher: number, winner: string|null, turns: number}}
 */
export function bruteGame(board, moves) {
  let rolls = 0;
  const die = () => randInt(createRng(seedFrom('pig-die', board.seed, rolls++)), 1, 6);
  const jars = { kid: 0, teacher: 0 };
  let basket = 0;
  let turns = 0;
  let winner = null;
  const teacher = () => {
    let pot = 0;
    turns += 1;
    for (;;) {
      const face = die();
      if (face === 1) return;
      pot += face;
      if (jars.teacher + pot >= board.goal) {
        jars.teacher += pot;
        winner = 'teacher';
        return;
      }
      if (pot >= board.teacher) {
        jars.teacher += pot;
        return;
      }
    }
  };
  for (const move of moves) {
    if (winner) break;
    if (move === 'stop') {
      jars.kid += basket;
      basket = 0;
      turns += 1;
      teacher();
      continue;
    }
    const face = die();
    if (face === 1) {
      basket = 0;
      turns += 1;
      teacher();
    } else {
      basket += face;
      if (jars.kid + basket >= board.goal) {
        jars.kid += basket;
        basket = 0;
        turns += 1;
        winner = 'kid';
      }
    }
  }
  return { kid: jars.kid, teacher: jars.teacher, winner, turns, basket };
}
