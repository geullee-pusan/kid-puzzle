// 조건 맞춰 잇기의 규칙과 풀이 프로그램. 순수 함수만 둔다(화면, 저장, 무작위 수를 쓰지 않는다).
//
// 판: 점 n개(3~8개)가 동그라미 위에 놓이고, 점마다 그 점에서 나가야 할 선의 수(0~9)가 적혀 있다.
//   { need: [3, 3, 1, 1] }  점의 차례는 동그라미 위의 차례다(0번이 맨 위 왼쪽, 시계 방향).
// 선: 두 점을 잇는다. 두 점 사이에는 선을 하나만 긋고, 한 점에서 제자리로 돌아오는 선은 없다. [a, b](a < b)로 적는다.
// 끝: 모든 점에서 나가는 선의 수가 그 점의 수와 같으면 끝난다. 그렇게 이을 수 없는 판은 "불가능해요"로 답한다.
//
// 안 되는 까닭은 셋이다(풀이 프로그램이 가린다).
//   odd     점의 수를 모두 더하면 홀수다. 선 하나에는 끝이 둘이라 선의 끝을 모두 세면 늘 짝수다.
//   big     어떤 점의 수가 그 점과 이을 수 있는 다른 점(수가 0이 아닌 점)의 수보다 크다.
//   search  둘 다 아닌데도 이을 수 없다. 모든 경우를 해 봐야 안다(경우의 나무 caseTree).
// 되는지는 하벨-하키미 방법(가장 큰 수의 점을 그다음으로 큰 점들과 잇기를 되풀이한다)으로 실제로 이어 보아 가린다.
// 테스트는 모든 선 묶음을 해 보는 방법(작은 판), 에르되시-갈라이 조건, 경우의 나무로 따로 따져 견준다.

/** 점의 수와 점마다의 수의 범위 */
export const MIN_POINTS = 3;
export const MAX_POINTS = 8;
export const MAX_NEED = 9;
/** 기록에 남기는 무르기 차례의 위 끝 */
export const MAX_HISTORY = 300;
/** 경우의 나무를 끝까지 펼치는 잎의 위 끝(이보다 많으면 센 데까지만 낸다) */
export const MAX_LEAVES = 4000;

const isCount = (value, top) => Number.isInteger(value) && value >= 0 && value <= top;

/** 판이 규격에 맞는가. 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object' || !Array.isArray(board.need)) return '판이 없어요';
  const { need } = board;
  if (need.length < MIN_POINTS || need.length > MAX_POINTS) return `점이 ${need.length}개예요`;
  if (!need.every((value) => isCount(value, MAX_NEED))) return '점의 수가 범위 밖이에요';
  if (need.every((value) => value === 0)) return '선이 하나도 없는 판이에요';
  return null;
}

export const copyBoard = (board) => ({ need: board.need.slice() });
export const boardKey = (board) => board.need.join(',');
export const sameBoard = (a, b) => boardKey(a) === boardKey(b);
export const sumOf = (need) => need.reduce((sum, value) => sum + value, 0);
/** 수가 홀수인 점들 */
export const oddPoints = (need) => need.flatMap((value, at) => (value % 2 === 1 ? [at] : []));

/** 선 하나를 [작은 번호, 큰 번호]로 */
export const lineOf = (a, b) => (a < b ? [a, b] : [b, a]);
const keyOfLine = ([a, b]) => `${a}-${b}`;

/** 선들이 이 판에 맞는가: 두 점이 다르고, 판 안에 있고, 같은 선이 두 번 없다 */
export function linesOk(n, lines) {
  if (!Array.isArray(lines)) return false;
  const seen = new Set();
  for (const line of lines) {
    if (!Array.isArray(line) || line.length !== 2) return false;
    const [a, b] = line;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b >= n || a >= b) return false;
    const key = keyOfLine(line);
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

/** 두 점 사이의 선이 몇 번째에 있는가(없으면 -1) */
export const lineIndex = (lines, a, b) => {
  const [p, q] = lineOf(a, b);
  return lines.findIndex(([x, y]) => x === p && y === q);
};

/** 점마다 지금 나가는 선의 수 */
export function degreesOf(n, lines) {
  const degrees = new Array(n).fill(0);
  for (const [a, b] of lines) {
    degrees[a] += 1;
    degrees[b] += 1;
  }
  return degrees;
}

/** 모든 점이 수만큼 이어졌는가 */
export function isDone(board, lines) {
  const degrees = degreesOf(board.need.length, lines);
  return degrees.every((value, at) => value === board.need[at]);
}

/** 판의 모습: 점마다 선의 수, 수만큼 이은 점, 수보다 많은 점, 선의 끝의 수 */
export function stateOf(board, lines) {
  const degrees = degreesOf(board.need.length, lines);
  const full = degrees.flatMap((value, at) => (value === board.need[at] ? [at] : []));
  const over = degrees.flatMap((value, at) => (value > board.need[at] ? [at] : []));
  return { degrees, full, over, ends: 2 * lines.length, lines: lines.length, done: full.length === degrees.length };
}

/**
 * 하벨-하키미 방법으로 실제로 이어 본다. 되면 선들을, 안 되면 null을 낸다.
 * 남은 수가 가장 큰 점(같으면 앞 번호)을 남은 수가 큰 차례로 다른 점들과 잇는다. 이렇게 해서 막히면 어떻게 해도 안 된다.
 */
export function realize(need) {
  const left = need.slice();
  const lines = [];
  const n = need.length;
  for (;;) {
    let top = -1;
    for (let at = 0; at < n; at++) if (left[at] > 0 && (top < 0 || left[at] > left[top])) top = at;
    if (top < 0) return lines.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const others = [];
    for (let at = 0; at < n; at++) if (at !== top && left[at] > 0) others.push(at);
    others.sort((x, y) => left[y] - left[x] || x - y);
    const want = left[top];
    if (want > others.length) return null;
    for (const other of others.slice(0, want)) {
      left[other] -= 1;
      lines.push(lineOf(top, other));
    }
    left[top] = 0;
  }
}

/** 그 점과 이을 수 있는 다른 점(수가 0이 아닌 점)의 수 */
export const partnersOf = (need, at) => need.filter((value, other) => other !== at && value > 0).length;

/** 이을 수 있는 다른 점의 수보다 큰 수를 가진 점들 */
export const bigPoints = (need) => need.flatMap((value, at) => (value > partnersOf(need, at) ? [at] : []));

/** 안 되는 까닭 가운데 판만 보고 알 수 있는 것: 모두 더하면 홀수(odd), 이을 수 있는 점보다 큰 수(big) */
export function plainReasons(need) {
  const reasons = [];
  if (sumOf(need) % 2 === 1) reasons.push('odd');
  if (bigPoints(need).length > 0) reasons.push('big');
  return reasons;
}

/** 고를 수 있는 것: 목록에서 k개를 고르는 모든 묶음(앞에서부터 차례로) */
export function choose(list, k) {
  if (k === 0) return [[]];
  if (k > list.length) return [];
  const out = [];
  const walk = (start, picked) => {
    if (picked.length === k) {
      out.push(picked.slice());
      return;
    }
    for (let at = start; at <= list.length - (k - picked.length); at++) {
      picked.push(list[at]);
      walk(at + 1, picked);
      picked.pop();
    }
  };
  walk(0, []);
  return out;
}

/** 아직 따지지 않은 점 가운데 남은 수가 가장 큰 점(같으면 앞 번호). 남은 수가 0인 점은 따질 것이 없다 */
function nextPoint(left, open) {
  let top = -1;
  for (const at of open) if (left[at] > 0 && (top < 0 || left[at] > left[top])) top = at;
  return top;
}

/**
 * 경우의 나무: 남은 수가 가장 큰 점부터, 그 점과 이을 점을 아직 따지지 않은 점 가운데 남은 수가 있는 점에서 모두 골라 본다.
 * 어떤 이음이든 그 점이 나중의 점들과 잇는 선은 그렇게 고른 묶음 하나라서, 이 나무의 잎을 모두 보면 모든 경우를 본 것이다.
 * 잎마다 { lines, stuck }을 낸다. stuck은 막힌 점 { point, left, open }(이을 점이 모자람)이고, 다 이었으면 null이다.
 * @param {number[]} need
 * @param {{limit?: number, stopAtFirst?: boolean}} options limit: 잎을 이만큼 모으면 그만둔다(cut이 true)
 * @returns {{leaves: object[], cut: boolean, possible: boolean}}
 */
export function caseTree(need, { limit = MAX_LEAVES, stopAtFirst = false } = {}) {
  const n = need.length;
  const leaves = [];
  let cut = false;
  let possible = false;
  // steps: 따진 점마다 { point, lines(그 점에서 새로 그은 선) }
  const walk = (left, open, lines, steps) => {
    if (cut || (stopAtFirst && possible)) return;
    if (leaves.length >= limit) {
      cut = true;
      return;
    }
    const point = nextPoint(left, open);
    if (point < 0) {
      possible = true;
      leaves.push({ lines: lines.slice(), steps, stuck: null });
      return;
    }
    const rest = open.filter((at) => at !== point);
    const partners = rest.filter((at) => left[at] > 0);
    if (partners.length < left[point]) {
      leaves.push({ lines: lines.slice(), steps, stuck: { point, left: left[point], open: partners.length } });
      return;
    }
    for (const group of choose(partners, left[point])) {
      const next = left.slice();
      next[point] = 0;
      for (const at of group) next[at] -= 1;
      const added = group.map((at) => lineOf(point, at));
      walk(next, rest, [...lines, ...added], [...steps, { point, lines: added }]);
    }
  };
  walk(need.slice(), Array.from({ length: n }, (_, at) => at), [], []);
  return { leaves, cut, possible };
}

/**
 * 모든 경우 펼쳐 보기: 지금 판에서 더 이어야 할 선이 가장 많은 점(같으면 앞 번호)이 그 선들을 마저 잇는 모든 방법.
 * 그 점과 이을 수 있는 점은 아직 이어지지 않았고 더 이어야 할 선이 남은 다른 점이다. 방법마다 새로 그을 선들을 낸다.
 * 답이 아니라 지금 갈래의 모든 경우다. 방법이 하나도 없으면(이을 점이 모자라면) ways가 빈 목록이다.
 * 모든 점이 다 찼으면 point가 -1이다.
 * @returns {{point: number, left: number, open: number, ways: number[][][]}}
 */
export function casesNow(need, lines) {
  const n = need.length;
  const degrees = degreesOf(n, lines);
  const left = need.map((value, at) => Math.max(0, value - degrees[at]));
  const all = Array.from({ length: n }, (_, at) => at);
  const point = nextPoint(left, all);
  if (point < 0) return { point: -1, left: 0, open: 0, ways: [] };
  const partners = all.filter((at) => at !== point && left[at] > 0 && lineIndex(lines, point, at) < 0);
  return { point, left: left[point], open: partners.length, ways: choose(partners, left[point]).map((group) => group.map((at) => lineOf(point, at))) };
}

/**
 * 판을 푼다.
 * @returns {{possible: boolean, reason: string|null, reasons: string[], lines: number[][]|null, sum: number, odd: number[], big: number[], leaves: number|null}}
 *   reason   안 되는 판의 까닭 하나('odd' | 'big' | 'search'). 되는 판은 null
 *   reasons  판만 보고 알 수 있는 까닭들('odd', 'big'). search 판은 빈 목록
 *   lines    되는 판의 한 가지 이음
 *   leaves   search 판에서 모든 경우의 수(경우의 나무의 잎). 너무 많으면 null
 */
export function solve(board) {
  const { need } = board;
  const lines = realize(need);
  const reasons = plainReasons(need);
  const possible = lines !== null;
  let leaves = null;
  if (!possible && reasons.length === 0) {
    const tree = caseTree(need);
    leaves = tree.cut ? null : tree.leaves.length;
  }
  return {
    possible,
    reason: possible ? null : (reasons[0] ?? 'search'),
    reasons,
    lines,
    sum: sumOf(need),
    odd: oddPoints(need),
    big: bigPoints(need),
    leaves,
  };
}

// ---- 판 위의 자리: 점은 동그라미 위에 고르게 놓인다(그림 안의 길이) ----

/** 동그라미의 반지름과 점의 반지름 */
export const RING = 200;
export const DOT = 32;
/** 누른 자리에서 이만큼 안이면 점을 누른 것으로 본다. 선은 이만큼 안이면 누른 것으로 본다 */
export const DOT_HIT = 52;
export const LINE_HIT = 30;

/** 점 n개의 자리. 맨 위의 변이 반듯하게 놓이도록 돌린다 */
export function spotsOf(n, radius = RING) {
  const start = -Math.PI / 2 - Math.PI / n;
  return Array.from({ length: n }, (_, at) => {
    const angle = start + (2 * Math.PI * at) / n;
    return [Math.round(radius * Math.cos(angle) * 100) / 100, Math.round(radius * Math.sin(angle) * 100) / 100];
  });
}

/** 점에서 선분까지의 거리 */
function distanceToSegment([x, y], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/**
 * 누른 자리에서 무엇을 눌렀는가. 점이 먼저다(가장 가까운 점이 DOT_HIT 안이면 그 점). 아니면 가장 가까운 선(LINE_HIT 안).
 * @returns {{point: number} | {line: number} | null}
 */
export function hitAt(n, lines, spot) {
  const spots = spotsOf(n);
  let best = -1;
  let bestDistance = Infinity;
  spots.forEach((at, index) => {
    const distance = Math.hypot(spot[0] - at[0], spot[1] - at[1]);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  if (best >= 0 && bestDistance <= DOT_HIT) return { point: best };
  let line = -1;
  let lineDistance = Infinity;
  lines.forEach(([a, b], index) => {
    const distance = distanceToSegment(spot, spots[a], spots[b]);
    if (distance < lineDistance) {
      line = index;
      lineDistance = distance;
    }
  });
  if (line >= 0 && lineDistance <= LINE_HIT) return { line };
  return null;
}
