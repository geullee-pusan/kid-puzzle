// 눈금이 가장 적은 자를 풀이 프로그램과 다른 방법으로 따진다: 갈래를 자르지 않고, 눈금을 찍을 자리의 모든 묶음을 비트로 늘어놓아 하나씩 본다.
// src/core/ruler.js의 함수는 쓰지 않는다.

const bits = (mask) => {
  let count = 0;
  for (let m = mask; m; m &= m - 1) count += 1;
  return count;
};

/** 자리 0, L과 mask의 자리(1부터 L−1)에 찍은 눈금들 */
function marksOf(mask, L) {
  const marks = [0];
  for (let p = 1; p < L; p++) if (mask & (1 << (p - 1))) marks.push(p);
  marks.push(L);
  return marks;
}

/** 길이마다 재는 짝의 수 */
export function bruteCounts(marks) {
  const counts = new Map();
  for (let i = 0; i < marks.length; i++) {
    for (let j = 0; j < marks.length; j++) {
      if (marks[j] > marks[i]) counts.set(marks[j] - marks[i], (counts.get(marks[j] - marks[i]) ?? 0) + 1);
    }
  }
  return counts;
}

const covers = (marks, L) => {
  const counts = bruteCounts(marks);
  for (let d = 1; d <= L; d++) if (!counts.has(d)) return false;
  return true;
};

const mirrorKey = (marks, L) => {
  const a = marks.join(',');
  const b = marks.map((x) => L - x).reverse().join(',');
  return a < b ? a : b;
};

/**
 * 길이 L인 자: 1부터 L까지 모두 재는 가장 적은 눈금 수와, 그 수로 되는 자의 수(all), 뒤집은 것을 하나로 센 수(count), 그 수보다 하나 적은 눈금으로 놓는 경우의 수(tried)
 */
export function bruteFewest(L) {
  const total = 1 << (L - 1);
  for (let inner = 0; inner <= L - 1; inner++) {
    const found = [];
    let tried = 0;
    for (let mask = 0; mask < total; mask++) {
      if (bits(mask) !== inner) continue;
      const marks = marksOf(mask, L);
      if (covers(marks, L)) found.push(marks);
    }
    if (found.length > 0) {
      for (let mask = 0; mask < total; mask++) if (bits(mask) === inner - 1) tried += 1;
      return { fewest: inner + 2, all: found.length, count: new Set(found.map((marks) => mirrorKey(marks, L))).size, rulers: found, tried };
    }
  }
  return null;
}

/** 눈금 m개로 길이 L인 자를 놓는 모든 경우(0과 L은 정해져 있다) */
export function bruteRulers(L, m) {
  const out = [];
  for (let mask = 0; mask < 1 << (L - 1); mask++) if (bits(mask) === m - 2) out.push(marksOf(mask, L));
  return out;
}

/** 같은 길이를 두 번 재지 않는가 */
export function bruteDistinct(marks) {
  return [...bruteCounts(marks).values()].every((count) => count === 1);
}

/** 눈금 k개로 같은 길이를 두 번 재지 않는 가장 짧은 자의 길이와, 그 길이로 되는 자의 수(all), 뒤집은 것을 하나로 센 수(count) */
export function bruteGolomb(k) {
  for (let n = 1; ; n++) {
    const found = bruteRulers(n, k).filter(bruteDistinct);
    if (found.length > 0) return { shortest: n, all: found.length, count: new Set(found.map((marks) => mirrorKey(marks, n))).size, rulers: found };
  }
}
