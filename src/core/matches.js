// 성냥개비: 판과 풀이 프로그램. 순수 함수만 둔다.
//
// 판(격자): 가로 w칸, 세로 h칸의 모눈. 모눈의 변(길이 1)마다 성냥이 하나 놓이거나 비어 있다.
// 정사각형: 한 변이 성냥 s개(s ≥ 1)인 정사각형 가운데 테두리의 변 4s개에 모두 성냥이 있는 것. 안쪽의 성냥은 따지지 않는다
//   (테두리가 다 있으면 안에 성냥이 있어도 센다. 3×3 모눈을 다 채우면 9 + 4 + 1 = 14개).
// 할 일
//   remove  성냥을 딱 k개 빼서 정사각형이 딱 n개 남게 한다
//   move    성냥을 딱 k개 옮겨서 정사각형이 딱 n개가 되게 한다. 성냥의 수는 그대로다.
//           옮긴 성냥의 수는 "처음 자리에 없는 성냥의 수"로 센다(옮긴 성냥을 처음 자리로 돌려놓으면 줄어든다)
//   tidy    (덧붙는 약속) 남은 성냥은 모두 어떤 정사각형의 변이어야 한다
// 판의 값: { w, h, matches: 변 번호(작은 것부터), kind: 'remove' | 'move', k, n, tidy }
//
// 변 번호: 가로 변이 먼저다. 위에서 r번째 줄(0..h), 왼쪽에서 c번째(0..w-1)의 가로 변은 r*w + c,
//   그다음 세로 변: 위에서 r번째 줄(0..h-1), 왼쪽에서 c번째(0..w)의 세로 변은 (h+1)*w + r*(w+1) + c.
// 풀이 프로그램은 빼거나 옮기는 모든 방법(remove는 성냥 k개를 고르는 모든 방법, move는 거기에 빈 변 k개를 고르는 모든 방법)을
// 하나도 빼지 않고 해 보고 정사각형을 센다. 변은 비트 둘(앞 30개와 뒤 30개)로 적어 빠르게 센다.

/** 모눈의 크기(가로, 세로 칸 수)의 범위 */
export const MIN_SIDE = 1;
export const MAX_SIDE = 4;
/** 빼거나 옮기는 성냥의 수의 위 끝 */
export const MAX_K = { remove: 4, move: 3 };
export const KINDS = ['remove', 'move'];

const SPLIT = 30;

/** 변의 수 */
export const edgeCount = (w, h) => (h + 1) * w + h * (w + 1);
export const hEdge = (w, h, r, c) => r * w + c;
export const vEdge = (w, h, r, c) => (h + 1) * w + r * (w + 1) + c;

/** 변의 두 끝(모눈의 점. x는 왼쪽에서, y는 위에서) */
export function edgeEnds(w, h, edge) {
  const across = (h + 1) * w;
  if (edge < across) {
    const r = Math.floor(edge / w);
    const c = edge % w;
    return { horizontal: true, r, c, x1: c, y1: r, x2: c + 1, y2: r };
  }
  const rest = edge - across;
  const r = Math.floor(rest / (w + 1));
  const c = rest % (w + 1);
  return { horizontal: false, r, c, x1: c, y1: r, x2: c, y2: r + 1 };
}

/** 변 번호 목록을 비트 둘로 */
export function maskOf(edges) {
  let lo = 0;
  let hi = 0;
  for (const edge of edges) {
    if (edge < SPLIT) lo |= 1 << edge;
    else hi |= 1 << (edge - SPLIT);
  }
  return { lo, hi };
}

const squareMemo = new Map();
/**
 * 모눈 안의 모든 정사각형(테두리가 다 있는지는 따지지 않는다). 작은 것부터, 위에서부터, 왼쪽부터.
 * @returns {{r: number, c: number, size: number, edges: number[], lo: number, hi: number}[]}
 */
export function squaresOf(w, h) {
  const key = `${w}x${h}`;
  if (squareMemo.has(key)) return squareMemo.get(key);
  const list = [];
  for (let size = 1; size <= Math.min(w, h); size++) {
    for (let r = 0; r + size <= h; r++) {
      for (let c = 0; c + size <= w; c++) {
        const edges = [];
        for (let i = 0; i < size; i++) {
          edges.push(hEdge(w, h, r, c + i), hEdge(w, h, r + size, c + i), vEdge(w, h, r + i, c), vEdge(w, h, r + i, c + size));
        }
        edges.sort((a, b) => a - b);
        list.push({ r, c, size, edges, ...maskOf(edges) });
      }
    }
  }
  squareMemo.set(key, list);
  return list;
}

const has = (lo, hi, square) => (lo & square.lo) === square.lo && (hi & square.hi) === square.hi;

/** 놓인 성냥(변 번호 목록)으로 테두리가 다 있는 정사각형들 */
export function squaresIn(w, h, edges) {
  const { lo, hi } = maskOf(edges);
  return squaresOf(w, h).filter((square) => has(lo, hi, square));
}

export const countSquares = (w, h, edges) => squaresIn(w, h, edges).length;

/** 어느 정사각형의 변도 아닌 성냥들 */
export function looseMatches(w, h, edges) {
  const used = new Set(squaresIn(w, h, edges).flatMap((square) => square.edges));
  return edges.filter((edge) => !used.has(edge));
}

/** 크기마다의 정사각형 수 [한 변이 1개인 것, 2개인 것, …] */
export function sizeCounts(w, h, edges) {
  const counts = new Array(Math.min(w, h)).fill(0);
  for (const square of squaresIn(w, h, edges)) counts[square.size - 1] += 1;
  return counts;
}

/** 모두 채운 모눈의 성냥 */
export const fullGrid = (w, h) => Array.from({ length: edgeCount(w, h) }, (_, edge) => edge);

/** 정사각형들의 테두리를 합친 성냥(처음 모습을 만들 때 쓴다) */
export function outlineOf(w, h, squares) {
  return [...new Set(squares.flatMap((square) => square.edges))].sort((a, b) => a - b);
}

/**
 * 성냥이 놓인 곳만 남기게 모눈을 줄인다(성냥들을 둘러싼 가장 작은 모눈으로 옮긴다). 빼기 판은 빈 변을 쓰지 않으니 판이 가운데에 크게 보이게 한다.
 * @returns {{w: number, h: number, matches: number[]}}
 */
export function cropEdges(w, h, edges) {
  if (edges.length === 0) return { w, h, matches: [] };
  const ends = edges.map((edge) => edgeEnds(w, h, edge));
  const left = Math.min(...ends.map((end) => end.x1));
  const top = Math.min(...ends.map((end) => end.y1));
  const width = Math.max(1, Math.max(...ends.map((end) => end.x2)) - left);
  const height = Math.max(1, Math.max(...ends.map((end) => end.y2)) - top);
  const matches = ends.map((end) => (end.horizontal ? hEdge(width, height, end.y1 - top, end.x1 - left) : vEdge(width, height, end.y1 - top, end.x1 - left)));
  return { w: width, h: height, matches: matches.sort((a, b) => a - b) };
}

// ---- 판 ----

export const copyBoard = (board) => ({ w: board.w, h: board.h, matches: board.matches.slice(), kind: board.kind, k: board.k, n: board.n, tidy: board.tidy === true });
export const boardKey = (board) => `${board.w}x${board.h}:${board.kind}:${board.k}:${board.n}:${board.tidy ? 1 : 0}:${board.matches.join(',')}`;
export const sameBoard = (a, b) => boardKey(a) === boardKey(b);

const isSide = (value) => Number.isInteger(value) && value >= MIN_SIDE && value <= MAX_SIDE;

/** 성냥 목록이 그 모눈에 맞는가(변 번호가 겹치지 않고 작은 것부터) */
export function edgesOk(w, h, edges) {
  if (!Array.isArray(edges)) return false;
  const total = edgeCount(w, h);
  return edges.every((edge, index) => Number.isInteger(edge) && edge >= 0 && edge < total && (index === 0 || edges[index - 1] < edge));
}

/** 판이 쓸 수 있는 값인가. 쓸 수 있으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'not-object';
  if (!isSide(board.w) || !isSide(board.h)) return 'size';
  if (!edgesOk(board.w, board.h, board.matches)) return 'matches';
  if (!KINDS.includes(board.kind)) return 'kind';
  if (!Number.isInteger(board.k) || board.k < 1 || board.k > MAX_K[board.kind]) return 'k';
  if (board.k > board.matches.length) return 'k';
  if (board.kind === 'move' && board.k > edgeCount(board.w, board.h) - board.matches.length) return 'k';
  if (!Number.isInteger(board.n) || board.n < 0 || board.n > squaresOf(board.w, board.h).length) return 'n';
  if (typeof board.tidy !== 'boolean') return 'tidy';
  return null;
}

/** 지금 성냥이 처음과 얼마나 달라졌는가: remove는 뺀 수, move는 처음 자리에 없는 성냥의 수 */
export function changedCount(board, edges) {
  const now = new Set(edges);
  return board.matches.filter((edge) => !now.has(edge)).length;
}

/** 지금 모습이 할 일에 맞는가(빼거나 옮긴 수가 딱 k, 정사각형이 딱 n, 약속이 있으면 모든 성냥이 정사각형의 변) */
export function isDone(board, edges) {
  if (board.kind === 'remove' && edges.length !== board.matches.length - board.k) return false;
  if (board.kind === 'move' && edges.length !== board.matches.length) return false;
  if (changedCount(board, edges) !== board.k) return false;
  if (countSquares(board.w, board.h, edges) !== board.n) return false;
  return !board.tidy || looseMatches(board.w, board.h, edges).length === 0;
}

/** 지금 모습이 그 판에서 놓일 수 있는 모습인가(remove는 처음 성냥의 일부, move는 수가 같고 모눈 안) */
export function edgesFit(board, edges) {
  if (!edgesOk(board.w, board.h, edges)) return false;
  if (board.kind === 'remove') {
    const start = new Set(board.matches);
    return edges.every((edge) => start.has(edge)) && board.matches.length - edges.length <= board.k;
  }
  return edges.length === board.matches.length && changedCount(board, edges) <= board.k;
}

// ---- 풀이 프로그램 ----

/** n개에서 k개를 고르는 가짓수 */
export function choose(n, k) {
  if (k < 0 || k > n) return 0;
  let value = 1;
  for (let i = 0; i < k; i++) value = (value * (n - i)) / (i + 1);
  return Math.round(value);
}

/** 해 보는 방법의 수: remove는 성냥 k개를 고르는 가짓수, move는 거기에 빈 변 k개를 고르는 가짓수를 곱한 것 */
export function waysOf(w, h, matches, kind, k) {
  const ways = choose(matches.length, k);
  return kind === 'remove' ? ways : ways * choose(edgeCount(w, h) - matches.length, k);
}

/**
 * 빼거나 옮기는 모든 방법을 해 보고, 끝난 모습마다 정사각형의 수와 약속에 맞는지를 알린다.
 * visit(lo, hi, count, tidy, removed, added): removed·added는 그 방법에서 뺀 성냥과 더한 변(배열은 다시 쓰이니 필요하면 베낀다)
 */
function eachEnd(w, h, matches, kind, k, visit) {
  const squares = squaresOf(w, h);
  const total = edgeCount(w, h);
  const start = maskOf(matches);
  const on = new Set(matches);
  const empty = [];
  for (let edge = 0; edge < total; edge++) if (!on.has(edge)) empty.push(edge);
  const removed = [];
  const added = [];

  function judge(lo, hi) {
    let count = 0;
    let coverLo = 0;
    let coverHi = 0;
    for (const square of squares) {
      if ((lo & square.lo) === square.lo && (hi & square.hi) === square.hi) {
        count += 1;
        coverLo |= square.lo;
        coverHi |= square.hi;
      }
    }
    visit(lo, hi, count, coverLo === lo && coverHi === hi, removed, added);
  }

  function add(from, left, lo, hi) {
    if (left === 0) {
      judge(lo, hi);
      return;
    }
    for (let index = from; index <= empty.length - left; index++) {
      const edge = empty[index];
      added.push(edge);
      if (edge < SPLIT) add(index + 1, left - 1, lo | (1 << edge), hi);
      else add(index + 1, left - 1, lo, hi | (1 << (edge - SPLIT)));
      added.pop();
    }
  }

  function take(from, left, lo, hi) {
    if (left === 0) {
      if (kind === 'remove') judge(lo, hi);
      else add(0, k, lo, hi);
      return;
    }
    for (let index = from; index <= matches.length - left; index++) {
      const edge = matches[index];
      removed.push(edge);
      if (edge < SPLIT) take(index + 1, left - 1, lo & ~(1 << edge), hi);
      else take(index + 1, left - 1, lo, hi & ~(1 << (edge - SPLIT)));
      removed.pop();
    }
  }

  take(0, k, start.lo, start.hi);
}

/**
 * 같은 처음 모습과 같은 k에서, 끝난 모습의 정사각형 수마다 방법의 수를 센다(사다리가 n을 고를 때 쓴다).
 * @returns {{ways: number, all: Map<number, number>, tidy: Map<number, number>}} all: 정사각형 수 → 방법의 수, tidy: 그 가운데 약속에도 맞는 것
 */
export function tally(w, h, matches, kind, k) {
  const all = new Map();
  const tidy = new Map();
  let ways = 0;
  eachEnd(w, h, matches, kind, k, (lo, hi, count, neat) => {
    ways += 1;
    all.set(count, (all.get(count) ?? 0) + 1);
    if (neat) tidy.set(count, (tidy.get(count) ?? 0) + 1);
  });
  return { ways, all, tidy };
}

/**
 * 판을 푼다: 모든 방법을 해 보고 할 일에 맞는 방법을 센다. 방법마다 끝난 모습이 다르다(뺀 성냥과 더한 변이 다르면 모습도 다르다).
 * @param {object} board
 * @param {{keep?: number}} options keep: 적어 둘 답의 수
 * @returns {{possible: boolean, count: number, ways: number, examples: {matches: number[], removed: number[], added: number[]}[]}}
 */
export function solve(board, { keep = 3 } = {}) {
  const { w, h, matches, kind, k, n, tidy } = board;
  const examples = [];
  let count = 0;
  let ways = 0;
  eachEnd(w, h, matches, kind, k, (lo, hi, squares, neat, removed, added) => {
    ways += 1;
    if (squares !== n || (tidy && !neat)) return;
    count += 1;
    if (examples.length < keep) {
      const gone = new Set(removed);
      const end = [...matches.filter((edge) => !gone.has(edge)), ...added].sort((a, b) => a - b);
      examples.push({ matches: end, removed: removed.slice(), added: added.slice() });
    }
  });
  return { possible: count > 0, count, ways, examples };
}
