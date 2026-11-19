// 테스트에서 강 건너기의 풀이 프로그램과 견줄 때 쓰는 다른 방법.
// 풀이 프로그램(src/core/river.js)은 동물 목록과 모습 객체로 따진다. 여기서는 판의 규칙을 처음부터 다시 적고,
// 모습을 수 하나(곳마다의 자리를 3진법으로 적고 배의 곳을 붙인 것)로 적어 너비 우선으로 모두 따진다.
// 묶음은 비트로 고른다. 함께 있어도 되는지는 풀이 프로그램과 다른 꼴의 조건으로 적는다.

const FIGHT_NAMES = [
  ['dog', 'cat'],
  ['cat', 'fish'],
  ['cat', 'chick'],
  ['dog', 'chick'],
];

/** 판 → 사람들의 목록과 배의 조건, 함께 있어도 되는지를 가리는 함수 */
function rulesOf(board) {
  if (board.kind === 'weight') {
    const weights = [...Array(board.heavy).fill(2), ...Array(board.light).fill(1)];
    return { n: weights.length, places: 2, seats: 2, rows: () => true, heavy: (group) => group.reduce((sum, id) => sum + weights[id], 0) > 2, safe: () => true };
  }
  if (board.kind === 'pets') {
    const names = ['grandma', ...board.pets];
    // 할머니(0번)가 있거나, 짝을 이루는 두 동물이 함께 있지 않으면 괜찮다.
    const safe = (group) => group.includes(0) || !FIGHT_NAMES.some(([a, b]) => group.some((id) => names[id] === a) && group.some((id) => names[id] === b));
    return { n: names.length, places: 2, seats: board.seats, rows: (group) => group.includes(0), heavy: () => false, safe };
  }
  const n = 2 * board.pairs;
  // 엄마는 짝수 번, 아기는 그다음 홀수 번이다. 엄마가 하나도 없거나, 있는 아기마다 자기 엄마가 함께 있으면 괜찮다.
  const safe = (group) => {
    const mothers = group.filter((id) => id % 2 === 0);
    if (mothers.length === 0) return true;
    return group.filter((id) => id % 2 === 1).every((baby) => group.includes(baby - 1));
  };
  return { n, places: board.island ? 3 : 2, seats: board.seats, rows: () => true, heavy: () => false, safe };
}

/**
 * 판을 따로 풀어 본다.
 * @param {object} board 판
 * @param {{adjacent?: boolean}} options adjacent: 배가 이웃한 곳으로만 간다(섬에 꼭 들른다)
 * @returns {{possible: boolean, min: number|null, reachable: number}}
 */
export function bruteRiver(board, { adjacent = false } = {}) {
  const rules = rulesOf(board);
  const { n, places } = rules;
  const far = places - 1;
  const pow = Array.from({ length: n + 1 }, (_, index) => places ** index);
  const placeOf = (code, id) => Math.floor(code / pow[id]) % places;
  const encode = (where, boat) => where.reduce((sum, place, id) => sum + place * pow[id], 0) * places + boat;
  const goal = encode(Array(n).fill(far), far);
  const start = encode(Array(n).fill(0), 0);
  const seen = new Map([[start, 0]]);
  let layer = [start];
  let depth = 0;
  let found = start === goal ? 0 : null;
  while (layer.length > 0) {
    const next = [];
    for (const key of layer) {
      const boat = key % places;
      const code = Math.floor(key / places);
      const where = Array.from({ length: n }, (_, id) => placeOf(code, id));
      const here = where.flatMap((place, id) => (place === boat ? [id] : []));
      for (let mask = 1; mask < 1 << here.length; mask++) {
        const group = here.filter((_, index) => mask & (1 << index));
        if (group.length > rules.seats || !rules.rows(group) || rules.heavy(group) || !rules.safe(group)) continue;
        for (let to = 0; to < places; to++) {
          if (to === boat || (adjacent && Math.abs(to - boat) !== 1)) continue;
          const after = where.map((place, id) => (group.includes(id) ? to : place));
          const stay = after.flatMap((place, id) => (place === boat ? [id] : []));
          const land = after.flatMap((place, id) => (place === to ? [id] : []));
          if (!rules.safe(stay) || !rules.safe(land)) continue;
          const key2 = encode(after, to);
          if (seen.has(key2)) continue;
          seen.set(key2, depth + 1);
          if (key2 === goal && found === null) found = depth + 1;
          next.push(key2);
        }
      }
    }
    layer = next;
    depth += 1;
  }
  return { possible: found !== null, min: found, reachable: seen.size };
}
