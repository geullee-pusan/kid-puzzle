// 똑같이 섞이게 자르기의 판과 풀이. 순수 함수만 둔다.
// 판: 회색 칸과 흰 칸이 섞인 네모 판(가로 w, 세로 h, 회색 칸의 번호들 grey, 만들 조각 수 parts).
// 판을 칸 사이의 선을 따라 곧게 잘라 네모 조각 parts개를 만든다. 선은 한 조각을 끝에서 끝까지 가로지른다(판 끝이나 먼저 자른 선에 닿을 때까지).
// 조각마다 회색 칸과 흰 칸이 판 전체와 같은 꼴로 섞여야 한다: (조각의 회색 수) × (판의 흰 칸 수) = (조각의 흰 칸 수) × (판의 회색 수).
// 자르는 방법은 적어서(8×8 판의 네 조각도 수천 가지) 풀이 프로그램이 모든 방법을 따진다.
//
// 자른 선은 "씨앗" 하나로 적는다: { d: 'v'(세로 선) | 'h'(가로 선), at: 선의 자리(왼쪽이나 위에서 몇째 금), i: 그 선 위의 칸 하나(세로 선이면 줄, 가로 선이면 칸) }.
// 씨앗들을 차례로 놓으면, 씨앗마다 그 칸 사이를 지나는 조각 하나를 그 선으로 끝에서 끝까지 자른다. 이미 잘린 금 위의 씨앗은 아무 일도 하지 않는다.
// 그래서 선 k개는 늘 조각 k + 1개를 만든다. 선 하나를 지우면 나머지 씨앗을 처음부터 다시 놓는다(먼저 자른 선에 닿아 멈췄던 선은 더 길어진다).

export const MIN_SIZE = 2;
export const MAX_SIZE = 8;
/** 만들 수 있는 조각 수 */
export const PARTS = [3, 4];

const DIRS = ['v', 'h'];

const isInt = (value) => Number.isInteger(value);

/** 두 수의 가장 큰 공약수 */
export function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

/**
 * 판이 쓸 수 있는 값인가. 쓸 수 있으면 null, 아니면 까닭(개발용 글).
 * open이 참이면 회색 칸이 하나도 없거나 모든 칸이 회색이어도 된다(직접 만들기에서 칠하는 중인 판).
 */
export function checkBoard(board, { open = false } = {}) {
  if (!board || typeof board !== 'object') return '판이 없어요';
  const { w, h, grey, parts } = board;
  if (!isInt(w) || !isInt(h) || w < MIN_SIZE || h < MIN_SIZE || w > MAX_SIZE || h > MAX_SIZE) return '크기가 맞지 않아요';
  if (!PARTS.includes(parts)) return '조각 수가 맞지 않아요';
  if (!Array.isArray(grey) || !grey.every((cell) => isInt(cell) && cell >= 0 && cell < w * h)) return '회색 칸이 맞지 않아요';
  for (let at = 1; at < grey.length; at++) if (grey[at] <= grey[at - 1]) return '회색 칸은 작은 번호부터 한 번씩 적어요';
  if (!open && (grey.length === 0 || grey.length === w * h)) return '회색 칸과 흰 칸이 모두 있어야 해요';
  if (w * h < parts) return '칸이 조각 수보다 적어요';
  return null;
}

/** 판을 베낀다(기록과 저장에 쓰는 꼴) */
export function copyBoard(board) {
  return { w: board.w, h: board.h, grey: board.grey.slice(), parts: board.parts };
}

/** 판 전체의 섞인 꼴: 회색 수, 흰 칸 수, 묶음 수(두 수의 가장 큰 공약수), 한 묶음의 회색과 흰 칸 */
export function mixOf(board) {
  const grey = board.grey.length;
  const white = board.w * board.h - grey;
  const groups = gcd(grey, white);
  return { grey, white, groups, unitGrey: grey / groups, unitWhite: white / groups };
}

/** 칸마다 회색이면 1인 누적 합(네모 하나의 회색 수를 바로 세려고) */
function sumsOf(board) {
  const { w, h } = board;
  const greySet = new Set(board.grey);
  const sums = Array.from({ length: h + 1 }, () => new Array(w + 1).fill(0));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) sums[y + 1][x + 1] = sums[y][x + 1] + sums[y + 1][x] - sums[y][x] + (greySet.has(y * w + x) ? 1 : 0);
  }
  return sums;
}

/** 조각(네모) 하나의 [회색 수, 흰 칸 수]. sums를 주면 그것으로 센다 */
export function countIn(board, rect, sums = sumsOf(board)) {
  const { x, y, w, h } = rect;
  const grey = sums[y + h][x + w] - sums[y][x + w] - sums[y + h][x] + sums[y][x];
  return [grey, w * h - grey];
}

/** 센 수 [회색, 흰]이 판 전체와 같은 꼴로 섞였는가(엇갈려 곱해 견준다) */
export function sameMix(mix, [grey, white]) {
  return grey + white > 0 && grey * mix.white === white * mix.grey;
}

/** 씨앗 하나가 올바른 꼴인가(판 안의 금과 칸) */
export function seedOk(board, seed) {
  if (!seed || !DIRS.includes(seed.d) || !isInt(seed.at) || !isInt(seed.i)) return false;
  if (seed.d === 'v') return seed.at >= 1 && seed.at <= board.w - 1 && seed.i >= 0 && seed.i < board.h;
  return seed.at >= 1 && seed.at <= board.h - 1 && seed.i >= 0 && seed.i < board.w;
}

/** 씨앗이 조각의 안쪽을 지나는가(그 조각을 자를 수 있는가) */
function crosses(rect, seed) {
  if (seed.d === 'v') return rect.x < seed.at && seed.at < rect.x + rect.w && rect.y <= seed.i && seed.i < rect.y + rect.h;
  return rect.y < seed.at && seed.at < rect.y + rect.h && rect.x <= seed.i && seed.i < rect.x + rect.w;
}

/** 조각 하나를 씨앗의 선으로 둘로 자른다 */
function cutRect(rect, seed) {
  if (seed.d === 'v') {
    const left = seed.at - rect.x;
    return [
      { x: rect.x, y: rect.y, w: left, h: rect.h },
      { x: seed.at, y: rect.y, w: rect.w - left, h: rect.h },
    ];
  }
  const top = seed.at - rect.y;
  return [
    { x: rect.x, y: rect.y, w: rect.w, h: top },
    { x: rect.x, y: seed.at, w: rect.w, h: rect.h - top },
  ];
}

/**
 * 씨앗들을 차례로 놓아 판을 자른다.
 * @returns {{pieces: object[], cuts: object[], seeds: object[]}}
 *   pieces  조각들(네모 { x, y, w, h }. 칸 단위)
 *   cuts    자른 선마다 { seed, x1, y1, x2, y2 }(금 위의 두 끝. 칸 단위)
 *   seeds   실제로 자른 씨앗들(잘린 금 위에 놓였거나 판 밖인 씨앗은 빠진다)
 */
export function applyCuts(board, seeds) {
  let pieces = [{ x: 0, y: 0, w: board.w, h: board.h }];
  const cuts = [];
  const used = [];
  for (const seed of seeds ?? []) {
    if (!seedOk(board, seed)) continue;
    const at = pieces.findIndex((rect) => crosses(rect, seed));
    if (at < 0) continue;
    const rect = pieces[at];
    pieces = [...pieces.slice(0, at), ...cutRect(rect, seed), ...pieces.slice(at + 1)];
    const line = seed.d === 'v' ? { x1: seed.at, y1: rect.y, x2: seed.at, y2: rect.y + rect.h } : { x1: rect.x, y1: seed.at, x2: rect.x + rect.w, y2: seed.at };
    const clean = { d: seed.d, at: seed.at, i: seed.i };
    cuts.push({ seed: clean, ...line });
    used.push(clean);
  }
  return { pieces, cuts, seeds: used };
}

/** 조각들을 차례와 상관없이 하나로 부르는 이름(같은 자르기는 같은 이름) */
export function layoutKey(pieces) {
  return pieces
    .map((rect) => `${rect.x},${rect.y},${rect.w},${rect.h}`)
    .sort()
    .join(';');
}

/** 조각들을 정해진 차례(위에서 아래로, 왼쪽에서 오른쪽으로)로 줄 세운다 */
export function sortPieces(pieces) {
  return pieces.map((rect) => ({ ...rect })).sort((a, b) => a.y - b.y || a.x - b.x);
}

const layoutMemo = new Map();

/**
 * 가로 w, 세로 h인 판을 곧은 선으로 잘라 조각 parts개를 만드는 모든 방법(조각들의 묶음). 같은 묶음은 한 번만 센다.
 * 선마다 조각 하나를 끝에서 끝까지 자른다. 네모 조각 넷까지는 어떻게 나눠도 이렇게 자를 수 있다(테스트가 다른 방법으로 센 것과 견준다).
 */
export function allLayouts(w, h, parts) {
  const key = `${w}x${h}x${parts}`;
  if (layoutMemo.has(key)) return layoutMemo.get(key);
  let level = new Map([[layoutKey([{ x: 0, y: 0, w, h }]), [{ x: 0, y: 0, w, h }]]]);
  for (let count = 1; count < parts; count++) {
    const next = new Map();
    for (const pieces of level.values()) {
      pieces.forEach((rect, index) => {
        const lines = [];
        for (let at = rect.x + 1; at < rect.x + rect.w; at++) lines.push({ d: 'v', at, i: rect.y });
        for (let at = rect.y + 1; at < rect.y + rect.h; at++) lines.push({ d: 'h', at, i: rect.x });
        for (const seed of lines) {
          const made = [...pieces.slice(0, index), ...cutRect(rect, seed), ...pieces.slice(index + 1)];
          const name = layoutKey(made);
          if (!next.has(name)) next.set(name, sortPieces(made));
        }
      });
    }
    level = next;
  }
  const list = [...level.values()];
  layoutMemo.set(key, list);
  return list;
}

/**
 * 조각들을 만드는 씨앗들(풀이와 선생님이 자른 그림에 쓴다). 판 끝에서 끝까지 가로지르는 선부터 찾아 자르고, 나뉜 쪽마다 다시 찾는다.
 * 그렇게 자를 수 없는 조각들이면 null.
 */
export function seedsFor(pieces, region = null) {
  const area = region ?? pieces.reduce((box, rect) => ({ x: Math.min(box.x, rect.x), y: Math.min(box.y, rect.y), r: Math.max(box.r, rect.x + rect.w), b: Math.max(box.b, rect.y + rect.h) }), { x: Infinity, y: Infinity, r: -Infinity, b: -Infinity });
  if (pieces.length <= 1) return [];
  const inside = (rect) => rect.x >= area.x && rect.y >= area.y && rect.x + rect.w <= area.r && rect.y + rect.h <= area.b;
  if (!pieces.every(inside)) return null;
  for (const d of DIRS) {
    const [from, to] = d === 'v' ? [area.x, area.r] : [area.y, area.b];
    for (let at = from + 1; at < to; at++) {
      const before = pieces.filter((rect) => (d === 'v' ? rect.x + rect.w <= at : rect.y + rect.h <= at));
      const after = pieces.filter((rect) => (d === 'v' ? rect.x >= at : rect.y >= at));
      if (before.length === 0 || before.length + after.length !== pieces.length) continue;
      const one = seedsFor(before, d === 'v' ? { ...area, r: at } : { ...area, b: at });
      const two = seedsFor(after, d === 'v' ? { ...area, x: at } : { ...area, y: at });
      if (!one || !two) return null;
      return [{ d, at, i: d === 'v' ? area.y : area.x }, ...one, ...two];
    }
  }
  return null;
}

/**
 * 판 끝에서 끝까지 곧게 자르는 선 가운데, 나뉜 두 쪽이 판 전체와 같은 꼴로 섞이는 선들.
 * 한쪽이 같은 꼴이면 다른 쪽도 같은 꼴이다(판 전체에서 빼고 남은 것이라서).
 */
export function evenLines(board, sums = sumsOf(board)) {
  const mix = mixOf(board);
  const lines = [];
  for (let at = 1; at < board.w; at++) if (sameMix(mix, countIn(board, { x: 0, y: 0, w: at, h: board.h }, sums))) lines.push({ d: 'v', at });
  for (let at = 1; at < board.h; at++) if (sameMix(mix, countIn(board, { x: 0, y: 0, w: board.w, h: at }, sums))) lines.push({ d: 'h', at });
  return lines;
}

/**
 * 판을 푼다: 조각마다 같은 꼴로 섞이게 자르는 모든 방법을 찾는다.
 * @returns {{possible: boolean, layouts: object[][], count: number, total: number, mix: object, reason: string|null, lines: object[]}}
 *   layouts  되는 자르기들(조각들. 위에서 아래로, 왼쪽에서 오른쪽으로)
 *   count    되는 자르기의 수, total 조각 parts개로 자르는 모든 방법의 수
 *   reason   안 되는 까닭. 'groups'(묶음이 조각 수보다 적다) | 'edge'(끝에서 끝까지 자르는 어느 선도 두 쪽을 같은 꼴로 나누지 못한다) | 'search'(그래도 모든 방법을 따져야 안다). 되는 판은 null
 *   lines    두 쪽을 같은 꼴로 나누는, 끝에서 끝까지 자르는 선들
 */
export function solve(board) {
  const sums = sumsOf(board);
  const mix = mixOf(board);
  const every = allLayouts(board.w, board.h, board.parts);
  // 나란한 선으로만 자른 것(조각마다 판의 한 변을 끝에서 끝까지 쓴다)을 앞에 둔다. 풀이에서 먼저 보여 줄 만큼 알아보기 쉽다.
  const strips = (pieces) => (pieces.every((rect) => rect.h === board.h) || pieces.every((rect) => rect.w === board.w) ? 0 : 1);
  const layouts = every.filter((pieces) => pieces.every((rect) => sameMix(mix, countIn(board, rect, sums)))).sort((a, b) => strips(a) - strips(b));
  const lines = evenLines(board, sums);
  let reason = null;
  if (layouts.length === 0) reason = mix.groups < board.parts ? 'groups' : lines.length === 0 ? 'edge' : 'search';
  return { possible: layouts.length > 0, layouts, count: layouts.length, total: every.length, mix, reason, lines };
}

/** 지금 자른 조각들이 모두 같은 꼴로 섞였는가(조각 수까지 맞아야 한다) */
export function cutDone(board, pieces) {
  if (pieces.length !== board.parts) return false;
  const sums = sumsOf(board);
  const mix = mixOf(board);
  return pieces.every((rect) => sameMix(mix, countIn(board, rect, sums)));
}

/** 조각마다 [회색 수, 흰 칸 수]와 같은 꼴인지 */
export function pieceCounts(board, pieces) {
  const sums = sumsOf(board);
  const mix = mixOf(board);
  return pieces.map((rect) => {
    const counts = countIn(board, rect, sums);
    return { counts, even: sameMix(mix, counts) };
  });
}

/** 칸 사이의 금(두 칸 사이의 짧은 변) 하나가 이미 자른 선 위에 있는가 */
export function onCut(cuts, seed) {
  return cuts.some((cut) => {
    if (cut.seed.d !== seed.d || cut.seed.at !== seed.at) return false;
    const [from, to] = seed.d === 'v' ? [cut.y1, cut.y2] : [cut.x1, cut.x2];
    return seed.i >= from && seed.i < to;
  });
}
