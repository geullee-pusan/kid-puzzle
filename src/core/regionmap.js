// 구역 지도 맞히기의 판과 풀이. 순수 함수만 둔다.
// 판: 가로 w칸, 세로 h칸의 네모 판을 이어진 구역 몇 개로 나눈 지도. 구역마다 이름(숲, 바다, 모래밭, 들판)이 있다.
// 컴퓨터가 지도를 숨기고, 아이는 네모(직사각형)를 골라 묻는다. 대답은 그 네모 안에 구역마다 몇 칸이 있는지뿐이다.
// 처음부터 구역마다 모두 몇 칸인지(판 전체를 물은 대답)는 알려 준다.
// 아이는 판에 지도를 칠해 "이 지도예요"를 누른다. 숨은 지도와 같으면 판이 끝난다.
//
// 판의 꼴: { w, h, regions, cells }
//   regions  쓰는 구역의 이름표(0 숲, 1 바다, 2 모래밭, 3 들판) 가운데 둘 이상. 작은 것부터
//   cells    칸마다 구역의 이름표(가로로 한 줄씩, 왼쪽 위부터)
// 구역은 저마다 한 덩이로 이어져 있다(가로세로로 맞닿은 칸끼리 이어진다).
// 네모의 꼴: [x0, y0, x1, y1](왼쪽 위 칸과 오른쪽 아래 칸, 둘 다 넣는다).
//
// 칸이 16개 이하인 판은 숨은 지도와 함께 지금까지의 대답에 맞는 지도를 모두 센다(mapsOf, fitting).
// 그 판에서는 "네모 몇 개만 물으면 이 지도 하나로 정해지는가"(minQuestions)도 남김없이 찾아 구한다.
// 테스트가 칸마다 구역을 모두 골라 보는 다른 방법(tests/helpers/brute-regionmap.js)으로 다시 센다.

/** 구역의 이름표: 0 숲, 1 바다, 2 모래밭, 3 들판 */
export const LABELS = 4;
/** 판 크기의 범위 */
export const MIN_SIDE = 2;
export const MAX_SIDE = 6;
/** 지도를 모두 세는 판의 칸 수의 위 끝 */
export const COUNT_CELLS = 16;
/** 가장 적게 묻기를 찾을 때 따져 보는 갈래의 위 끝(넘으면 구하지 않는다) */
export const SEARCH_BUDGET = 400000;
/** 칠하기 기록(무르기)을 간직하는 수의 위 끝 */
export const MAX_HISTORY = 60;
/** 물음 수의 위 끝(같은 네모는 다시 묻지 않으므로 이만큼이면 넉넉하다) */
export const MAX_ASKS = 500;

const isInt = (value) => Number.isInteger(value);

/**
 * 판이 규격에 맞는가. 맞으면 null, 아니면 까닭(개발자용 글).
 * 크기가 범위 안이고, 구역이 둘 이상이고, 칸마다 쓰는 구역의 이름표가 있고, 구역마다 한 칸 이상이고 한 덩이로 이어져 있다.
 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return '판이 없어요';
  const { w, h, regions, cells } = board;
  if (!isInt(w) || !isInt(h) || w < MIN_SIDE || h < MIN_SIDE || w > MAX_SIDE || h > MAX_SIDE) return `판 크기가 범위 밖이에요: ${w}×${h}`;
  if (!Array.isArray(regions) || regions.length < 2 || regions.length > LABELS) return '구역의 수가 범위 밖이에요';
  if (!regions.every((label, at) => isInt(label) && label >= 0 && label < LABELS && (at === 0 || regions[at - 1] < label))) return '구역의 이름표가 맞지 않아요';
  if (!Array.isArray(cells) || cells.length !== w * h) return '칸 수가 맞지 않아요';
  if (!cells.every((label) => regions.includes(label))) return '쓰지 않는 구역이 칠해져 있어요';
  for (const label of regions) {
    if (!cells.includes(label)) return `빈 구역이 있어요: ${label}`;
    if (piecesOf(cells, w, h, label) !== 1) return `구역이 떨어져 있어요: ${label}`;
  }
  return null;
}

export const copyBoard = (board) => ({ w: board.w, h: board.h, regions: board.regions.slice(), cells: board.cells.slice() });
export const boardKey = (board) => `${board.w}x${board.h}:${board.cells.join('')}`;
export const sameBoard = (a, b) => boardKey(a) === boardKey(b);

/** 칸들이 이 구역으로 몇 덩이인가(칠하지 않은 칸 -1은 어느 구역도 아니다) */
export function piecesOf(cells, w, h, label) {
  const seen = new Uint8Array(w * h);
  let pieces = 0;
  for (let start = 0; start < w * h; start++) {
    if (cells[start] !== label || seen[start]) continue;
    pieces += 1;
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const cell = stack.pop();
      const x = cell % w;
      for (const next of [cell - w, cell + w, x > 0 ? cell - 1 : -1, x < w - 1 ? cell + 1 : -1]) {
        if (next < 0 || next >= w * h || seen[next] || cells[next] !== label) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
  }
  return pieces;
}

/** 구역마다 모두 몇 칸인가(regions의 차례대로) */
export const sizesOf = (board) => board.regions.map((label) => board.cells.filter((cell) => cell === label).length);

// ---- 네모 ----

/** 두 칸을 마주 보는 모서리로 하는 네모 */
export function rectOf(a, b, w) {
  const [ax, ay, bx, by] = [a % w, Math.floor(a / w), b % w, Math.floor(b / w)];
  return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)];
}

export const rectOk = (board, rect) =>
  Array.isArray(rect) && rect.length === 4 && rect.every(isInt) && rect[0] >= 0 && rect[1] >= 0 && rect[0] <= rect[2] && rect[1] <= rect[3] && rect[2] < board.w && rect[3] < board.h;

export const sameRect = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
export const areaOf = (rect) => (rect[2] - rect[0] + 1) * (rect[3] - rect[1] + 1);
/** 가로 칸 수와 세로 칸 수 */
export const sidesOf = (rect) => [rect[2] - rect[0] + 1, rect[3] - rect[1] + 1];
export const isWhole = (board, rect) => rect[0] === 0 && rect[1] === 0 && rect[2] === board.w - 1 && rect[3] === board.h - 1;

/** 네모 안의 칸들 */
export function cellsIn(rect, w) {
  const list = [];
  for (let y = rect[1]; y <= rect[3]; y++) for (let x = rect[0]; x <= rect[2]; x++) list.push(y * w + x);
  return list;
}

/** 칠한 칸들(또는 지도)에서 네모 안의 구역마다의 칸 수(regions의 차례대로) */
export function countsIn(cells, regions, w, rect) {
  const counts = regions.map(() => 0);
  for (const cell of cellsIn(rect, w)) {
    const at = regions.indexOf(cells[cell]);
    if (at >= 0) counts[at] += 1;
  }
  return counts;
}

/** 숨은 지도에 네모를 물은 대답 */
export const answerOf = (board, rect) => countsIn(board.cells, board.regions, board.w, rect);

/** 판의 모든 네모. 넓은 것부터, 같은 넓이는 위쪽, 왼쪽, 가로가 넓은 것부터(늘 같은 차례) */
export function allRects(w, h) {
  const list = [];
  for (let y0 = 0; y0 < h; y0++) for (let x0 = 0; x0 < w; x0++) for (let y1 = y0; y1 < h; y1++) for (let x1 = x0; x1 < w; x1++) list.push([x0, y0, x1, y1]);
  list.sort((a, b) => areaOf(b) - areaOf(a) || a[1] - b[1] || a[0] - b[0] || b[2] - a[2] || b[3] - a[3]);
  return list;
}

// ---- 칠한 지도 견주기 ----

/**
 * 아이가 칠한 지도를 숨은 지도와 지금까지의 대답에 견준다. 차례대로 처음 걸리는 것 하나만 돌려준다.
 *   { kind: 'blank', n }                         칠하지 않은 칸이 n개
 *   { kind: 'totals', label, painted, total }    구역마다 모두 몇 칸인지(처음 알려 준 것)와 맞지 않는다
 *   { kind: 'question', at, label, painted, answer }  at번째(0부터) 물음의 대답과 맞지 않는다
 *   { kind: 'split', label, pieces }             칠한 구역 하나가 여러 덩이로 떨어져 있다
 *   { kind: 'fits' }                             모든 대답과 맞지만 숨은 지도와 다르다
 *   { kind: 'same' }                             숨은 지도와 같다
 * @param {object} board 숨은 지도
 * @param {number[]} paint 칸마다 칠한 이름표(칠하지 않은 칸은 -1)
 * @param {{rect: number[]}[]} asked 지금까지 물은 것(차례대로)
 */
export function diagnose(board, paint, asked) {
  const { w, h, regions } = board;
  const blank = paint.filter((label) => !regions.includes(label)).length;
  if (blank > 0) return { kind: 'blank', n: blank };
  const totals = sizesOf(board);
  const painted = countsIn(paint, regions, w, [0, 0, w - 1, h - 1]);
  for (let at = 0; at < regions.length; at++) if (painted[at] !== totals[at]) return { kind: 'totals', label: regions[at], painted: painted[at], total: totals[at] };
  for (let at = 0; at < asked.length; at++) {
    const answer = answerOf(board, asked[at].rect);
    const mine = countsIn(paint, regions, w, asked[at].rect);
    const off = regions.findIndex((_, index) => mine[index] !== answer[index]);
    if (off >= 0) return { kind: 'question', at, label: regions[off], painted: mine[off], answer: answer[off] };
  }
  for (const label of regions) {
    const pieces = piecesOf(paint, w, h, label);
    if (pieces > 1) return { kind: 'split', label, pieces };
  }
  return paint.every((label, cell) => label === board.cells[cell]) ? { kind: 'same' } : { kind: 'fits' };
}

/** 칠한 것이 이 판에 맞는 꼴인가(칸마다 쓰는 구역의 이름표나 -1) */
export const paintOk = (board, paint) => Array.isArray(paint) && paint.length === board.w * board.h && paint.every((label) => label === -1 || board.regions.includes(label));

// ---- 지도 모두 세기(칸이 16개 이하인 판) ----

export const countable = (board) => board.w * board.h <= COUNT_CELLS;

const tables = new Map();

function popcount(mask) {
  let count = 0;
  for (let m = mask; m !== 0; m &= m - 1) count += 1;
  return count;
}

/** 칸 묶음(비트)마다 한 덩이로 이어져 있는지, 그리고 칸 수마다 이어진 묶음들 */
function tableOf(w, h) {
  const key = `${w}x${h}`;
  if (tables.has(key)) return tables.get(key);
  const n = w * h;
  const size = 1 << n;
  const joined = new Uint8Array(size);
  const near = Array.from({ length: n }, (_, cell) => {
    const x = cell % w;
    let mask = 0;
    for (const next of [cell - w, cell + w, x > 0 ? cell - 1 : -1, x < w - 1 ? cell + 1 : -1]) if (next >= 0 && next < n) mask |= 1 << next;
    return mask;
  });
  const bySize = Array.from({ length: n + 1 }, () => []);
  for (let mask = 1; mask < size; mask++) {
    const low = mask & -mask;
    let reach = low;
    let grown = true;
    while (grown) {
      grown = false;
      let edge = 0;
      for (let m = reach; m !== 0; m &= m - 1) edge |= near[31 - Math.clz32(m & -m)];
      const next = (reach | edge) & mask;
      if (next !== reach) {
        reach = next;
        grown = true;
      }
    }
    if (reach === mask) {
      joined[mask] = 1;
      bySize[popcount(mask)].push(mask);
    }
  }
  const table = { n, joined, bySize };
  tables.set(key, table);
  return table;
}

/** 칸 묶음(비트)의 모든 부분 묶음 가운데 칸 수가 size이고 이어진 것 */
function joinedSubsets(table, free, size) {
  const list = table.bySize[size];
  const room = popcount(free);
  if (room < size) return [];
  // 남은 칸이 적으면 부분 묶음을 하나하나 보는 편이 빠르다
  if (2 ** room < list.length) {
    const found = [];
    for (let sub = free; sub !== 0; sub = (sub - 1) & free) if (table.joined[sub] && popcount(sub) === size) found.push(sub);
    return found;
  }
  return list.filter((mask) => (mask & ~free) === 0);
}

const maps = new Map();

/**
 * 크기가 w×h이고, 구역(regions)마다 칸 수가 sizes인 지도를 모두 찾는다(칸이 16개 이하인 판만).
 * 지도마다 구역별 칸 묶음(비트, regions의 차례대로)을 돌려준다. 같은 물음에는 같은 차례로 낸다.
 */
export function mapsOf(w, h, regions, sizes) {
  if (w * h > COUNT_CELLS) throw new Error('칸이 너무 많아서 지도를 모두 셀 수 없어요');
  const key = `${w}x${h}:${regions.join(',')}:${sizes.join(',')}`;
  if (maps.has(key)) return maps.get(key);
  const table = tableOf(w, h);
  const full = (1 << table.n) - 1;
  const found = [];
  const masks = [];
  const place = (at, free) => {
    if (at === regions.length - 1) {
      if (popcount(free) === sizes[at] && table.joined[free]) found.push([...masks, free]);
      return;
    }
    for (const mask of joinedSubsets(table, free, sizes[at])) {
      masks.push(mask);
      place(at + 1, free & ~mask);
      masks.pop();
    }
  };
  if (sizes.reduce((sum, size) => sum + size, 0) === table.n && sizes.every((size) => size >= 1)) place(0, full);
  maps.set(key, found);
  return found;
}

/** 지도(구역별 칸 묶음)를 칸마다의 이름표로 */
export function cellsOfMasks(masks, regions, n) {
  const cells = Array(n).fill(-1);
  masks.forEach((mask, at) => {
    for (let cell = 0; cell < n; cell++) if ((mask >> cell) & 1) cells[cell] = regions[at];
  });
  return cells;
}

/** 칸마다의 이름표를 구역별 칸 묶음으로 */
export const masksOfCells = (cells, regions) => regions.map((label) => cells.reduce((mask, cell, at) => (cell === label ? mask | (1 << at) : mask), 0));

const rectMask = (rect, w) => cellsIn(rect, w).reduce((mask, cell) => mask | (1 << cell), 0);

/** 대답 하나를 수 하나로(구역마다의 칸 수를 이어 붙인다) */
const codeOf = (masks, area) => masks.reduce((code, mask) => code * 37 + popcount(mask & area), 0);

/** 숨은 지도와 지금까지의 대답에 모두 맞는 지도들(숨은 지도도 들어 있다). 칸이 16개 이하인 판만 */
export function fitting(board, asked) {
  const all = mapsOf(board.w, board.h, board.regions, sizesOf(board));
  const hidden = masksOfCells(board.cells, board.regions);
  const areas = asked.map((entry) => rectMask(entry.rect, board.w));
  const wants = areas.map((area) => codeOf(hidden, area));
  return all.filter((masks) => areas.every((area, at) => codeOf(masks, area) === wants[at]));
}

// ---- 가장 적게 묻기(칸이 16개 이하인 판) ----

/**
 * 네모 몇 개를 물으면 숨은 지도 하나만 남는가: 가장 적은 수와 그 네모들(하나).
 * 구역마다 모두 몇 칸인지는 처음부터 안다(그 수가 같은 지도만 견준다).
 * 다른 지도마다 "그 지도와 대답이 달라지는 네모"를 모으고, 모든 다른 지도를 가르는 가장 적은 네모 묶음을
 * 하나씩 늘려 가며 남김없이 찾는다. 따져 본 갈래가 budget을 넘으면 null(구하지 못했다)을 돌려준다.
 * @returns {{size: number, rects: number[][]} | null}
 */
export function minQuestions(board, budget = SEARCH_BUDGET) {
  if (!countable(board)) return null;
  const { w, h } = board;
  const all = mapsOf(w, h, board.regions, sizesOf(board));
  const hidden = masksOfCells(board.cells, board.regions);
  const same = (masks) => masks.every((mask, at) => mask === hidden[at]);
  const rivals = all.filter((masks) => !same(masks));
  if (rivals.length === 0) return { size: 0, rects: [] };
  const rects = allRects(w, h);
  const areas = rects.map((rect) => rectMask(rect, w));
  const words = Math.ceil(rivals.length / 32);
  // kill[r]: 네모 r이 가르는 다른 지도들(비트)
  const kill = areas.map((area) => {
    const bits = new Uint32Array(words);
    const want = codeOf(hidden, area);
    rivals.forEach((masks, at) => {
      if (codeOf(masks, area) !== want) bits[at >> 5] |= 1 << (at & 31);
    });
    return bits;
  });
  const killers = rivals.map((_, at) => rects.map((_, r) => r).filter((r) => (kill[r][at >> 5] >> (at & 31)) & 1));
  // 가르는 네모가 적은 지도부터 본다(갈래가 적다)
  const order = rivals.map((_, at) => at).sort((a, b) => killers[a].length - killers[b].length || a - b);
  const most = Math.max(...kill.map((bits) => bits.reduce((sum, word) => sum + popcount(word), 0)));
  let spent = 0;
  const picked = [];
  const search = (alive, left) => {
    const count = alive.reduce((sum, word) => sum + popcount(word), 0);
    if (count === 0) return true;
    if (left === 0 || most * left < count) return false;
    spent += 1;
    if (spent > budget) return false;
    const target = order.find((at) => (alive[at >> 5] >> (at & 31)) & 1);
    for (const r of killers[target]) {
      const next = alive.map((word, at) => word & ~kill[r][at]);
      picked.push(r);
      if (search(next, left - 1)) return true;
      picked.pop();
      if (spent > budget) return false;
    }
    return false;
  };
  const start = new Uint32Array(words);
  rivals.forEach((_, at) => {
    start[at >> 5] |= 1 << (at & 31);
  });
  for (let size = 1; size <= rects.length; size++) {
    if (search(start, size)) return { size, rects: picked.map((r) => rects[r]) };
    if (spent > budget) return null;
  }
  return null;
}

/**
 * 선생님이 묻는 차례(직접 만들기): 지금까지의 대답에 맞는 지도들을 가장 고르게 나누는 네모를 묻는다
 * (대답이 같은 지도끼리 묶었을 때 가장 큰 묶음이 가장 작은 네모. 같으면 allRects의 차례로 앞의 것).
 * 맞는 지도가 하나 남을 때까지 묻는다. 칸이 16개 이하인 판만.
 * @returns {number[][]} 물은 네모들
 */
export function teacherAsks(board) {
  const { w, h } = board;
  let left = mapsOf(w, h, board.regions, sizesOf(board));
  const hidden = masksOfCells(board.cells, board.regions);
  const rects = allRects(w, h);
  const areas = rects.map((rect) => rectMask(rect, w));
  const asked = [];
  while (left.length > 1) {
    let best = -1;
    let bestSize = Infinity;
    areas.forEach((area, r) => {
      const groups = new Map();
      for (const masks of left) {
        const code = codeOf(masks, area);
        groups.set(code, (groups.get(code) ?? 0) + 1);
      }
      const largest = Math.max(...groups.values());
      if (largest < bestSize) {
        bestSize = largest;
        best = r;
      }
    });
    const want = codeOf(hidden, areas[best]);
    left = left.filter((masks) => codeOf(masks, areas[best]) === want);
    asked.push(rects[best]);
  }
  return asked;
}
