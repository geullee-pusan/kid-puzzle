// 세 방향에서 본 그림: 쌓기나무(한 칸짜리 정육면체를 모눈 위에 쌓은 것)와, 앞·오른쪽 옆·위에서 본 그림. 순수 함수만 둔다.
//
// 쌓기: { w, d, heights }. w는 가로 칸 수(왼쪽에서 오른쪽), d는 앞뒤 칸 수(앞에서 뒤), heights는 칸마다 쌓은 수(0~MAX_H).
//   칸 (x, y)의 자리는 y * w + x이고, y가 0인 줄이 맨 앞 줄이다.
// 그림:
//   앞(front)   가로 칸마다(왼쪽부터) 앞에서 보이는 높이 = 그 세로줄에서 가장 높은 것. 길이 w
//   옆(side)    앞뒤 칸마다(앞부터) 오른쪽 옆에서 보이는 높이 = 그 가로줄에서 가장 높은 것. 길이 d.
//               오른쪽 옆에서 보면 앞 줄이 왼쪽에 온다. 그래서 그림도 왼쪽부터 앞 줄이다
//   위(plan)    칸마다 쌓기나무가 있으면 1, 없으면 0. 길이 w * d(쌓기와 같은 자리)
//
// 판의 종류(kind):
//   see    쌓기 하나를 보여 주고, 앞(옆, 위)에서 본 그림을 보기 몇 개 가운데서 고른다. { w, d, heights, ask, options }
//   build  앞과 옆에서 본 그림만 준다. 두 그림과 똑같이 보이게 쌓는다. { w, d, front, side }
//   top    앞과 옆에서 본 그림을 주고, 위에서 본 그림이 될 수 있는 것을 보기 가운데서 고른다(될 수 있는 것은 하나). { w, d, front, side, options }
//   range  앞과 옆에서 본 그림을 주고, 똑같이 보이게 쌓되 쌓기나무를 가장 적게, 가장 많이 쓴다. { w, d, front, side }
//   three  세 방향 그림을 모두 준다. 똑같이 보이게 쌓는다. { w, d, front, side, plan }
//
// 풀이 프로그램: 앞뒤 줄을 하나씩 정해 가며(줄마다 칸의 높이를 모두 넣어 보고) 앞에서 본 높이에 닿은 세로줄을 적어 간다.
//   그래서 그림이 같은 쌓기가 몇 가지인지, 그 가운데 쌓기나무가 가장 적은 것과 가장 많은 것을 빠짐없이 센다.

/** 한 칸에 쌓을 수 있는 수의 위 끝, 판의 가로와 앞뒤 칸 수 */
export const MAX_H = 4;
export const MIN_SIDE = 2;
export const MAX_SIDE = 4;
export const KINDS = ['see', 'build', 'top', 'range', 'three'];
export const ASKS = ['front', 'side', 'top'];

const isInt = Number.isInteger;
const range = (n) => Array.from({ length: n }, (_, index) => index);
export const sum = (list) => list.reduce((total, value) => total + value, 0);

// ---- 그림 ----

/** 앞에서 본 높이(왼쪽부터) */
export function frontOf(w, d, heights) {
  return range(w).map((x) => Math.max(0, ...range(d).map((y) => heights[y * w + x])));
}

/** 오른쪽 옆에서 본 높이(앞 줄부터) */
export function sideOf(w, d, heights) {
  return range(d).map((y) => Math.max(0, ...range(w).map((x) => heights[y * w + x])));
}

/** 위에서 본 그림(칸마다 1이나 0) */
export const planOf = (heights) => heights.map((value) => (value > 0 ? 1 : 0));

/** 세 방향 그림 */
export function viewsOf(w, d, heights) {
  return { front: frontOf(w, d, heights), side: sideOf(w, d, heights), plan: planOf(heights) };
}

export const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]);

/** 이 쌓기를 그 방향에서 본 그림 */
export function viewFrom(w, d, heights, ask) {
  if (ask === 'front') return frontOf(w, d, heights);
  if (ask === 'side') return sideOf(w, d, heights);
  return planOf(heights);
}

// ---- 셈: 그림이 같은 쌓기 ----

/**
 * 칸마다 쌓을 수 있는 높이의 아래 끝과 위 끝. 위에서 본 그림(plan)이 있으면 그것도 지킨다.
 * 한 칸은 그 세로줄의 앞 높이와 그 가로줄의 옆 높이를 넘을 수 없다.
 */
export function boundsOf(w, d, front, side, plan = null) {
  return range(w * d).map((at) => {
    const x = at % w;
    const y = Math.floor(at / w);
    let hi = Math.min(front[x], side[y], MAX_H);
    let lo = 0;
    if (plan) {
      if (plan[at]) lo = 1;
      else hi = 0;
    }
    return [lo, hi];
  });
}

/** 한 줄(앞뒤로 y번째)에 놓을 수 있는 높이들을 모두 늘어놓는다. 줄에서 가장 높은 것이 옆 높이와 같아야 한다 */
function rowChoices(w, y, front, side, bounds) {
  const out = [];
  const heights = new Array(w).fill(0);
  const walk = (x) => {
    if (x === w) {
      if (Math.max(0, ...heights) !== side[y]) return;
      let mask = 0;
      heights.forEach((value, at) => {
        if (front[at] > 0 && value === front[at]) mask |= 1 << at;
      });
      out.push({ heights: heights.slice(), mask, cubes: sum(heights) });
      return;
    }
    const [lo, hi] = bounds[y * w + x];
    for (let value = lo; value <= hi; value++) {
      heights[x] = value;
      walk(x + 1);
    }
    heights[x] = 0;
  };
  walk(0);
  return out;
}

/**
 * 앞과 옆(과 위)에서 본 그림이 이렇게 되는 쌓기를 센다.
 * @returns {{count: number, fewest: number|null, most: number|null, fewestStack: number[]|null, mostStack: number[]|null}}
 *   count        그런 쌓기의 가짓수
 *   fewest, most 쌓기나무가 가장 적은 수와 가장 많은 수(없으면 null)
 *   fewestStack, mostStack  그 수가 되는 쌓기 하나씩
 */
export function countStacks(w, d, front, side, plan = null) {
  const none = { count: 0, fewest: null, most: null, fewestStack: null, mostStack: null };
  if (front.length !== w || side.length !== d) return none;
  const bounds = boundsOf(w, d, front, side, plan);
  if (bounds.some(([lo, hi]) => lo > hi)) return none;
  const full = front.reduce((mask, value, x) => (value > 0 ? mask | (1 << x) : mask), 0);
  // 상태: 지금까지 앞 높이에 닿은 세로줄들(비트). 상태마다 가짓수, 가장 적은 수와 그 쌓기, 가장 많은 수와 그 쌓기
  let states = new Map([[0, { ways: 1, low: 0, lowRows: [], high: 0, highRows: [] }]]);
  for (let y = 0; y < d; y++) {
    const choices = rowChoices(w, y, front, side, bounds);
    const next = new Map();
    for (const [mask, state] of states) {
      for (const choice of choices) {
        const key = mask | choice.mask;
        const low = state.low + choice.cubes;
        const high = state.high + choice.cubes;
        const item = next.get(key);
        if (!item) {
          next.set(key, { ways: state.ways, low, lowRows: [...state.lowRows, choice.heights], high, highRows: [...state.highRows, choice.heights] });
          continue;
        }
        item.ways += state.ways;
        if (low < item.low) {
          item.low = low;
          item.lowRows = [...state.lowRows, choice.heights];
        }
        if (high > item.high) {
          item.high = high;
          item.highRows = [...state.highRows, choice.heights];
        }
      }
    }
    states = next;
    if (states.size === 0) return none;
  }
  const end = states.get(full);
  if (!end) return none;
  return { count: end.ways, fewest: end.low, most: end.high, fewestStack: end.lowRows.flat(), mostStack: end.highRows.flat() };
}

/**
 * 가장 많이 쌓은 쌓기: 칸마다 앞 높이와 옆 높이 가운데 낮은 쪽만큼 쌓는다(위에서 본 그림이 있으면 빈칸은 비운다).
 * 그림과 맞는 쌓기가 있을 때만 그 그림이 된다. 그림이 맞는지는 viewsOf로 다시 본다.
 */
export function tallest(w, d, front, side, plan = null) {
  return boundsOf(w, d, front, side, plan).map(([, hi]) => hi);
}

/**
 * 위에서 본 그림이 앞과 옆의 그림과 함께 될 수 있는가. 안 되면 판에서 보이는 까닭 하나를 낸다(되면 null).
 *   { kind: 'seen', axis, at }   그 줄(앞이면 세로줄, 옆이면 가로줄)에 칸이 있는데, 그 방향에서 보면 그 줄에 아무것도 보이지 않는다
 *   { kind: 'empty', axis, at }  그 방향에서 보면 그 줄에 쌓기나무가 보이는데, 위에서 본 그림의 그 줄에 칸이 하나도 없다
 *   { kind: 'short', axis, at, need, reach }  그 줄은 need층으로 보이는데, 그 줄에 놓인 칸은 다른 방향의 그림 때문에 가장 높아도 reach층이다
 * 셋 가운데 아무것도 아니면 칸마다 앞 높이와 옆 높이 가운데 낮은 쪽만큼 쌓아서 그림이 맞는 쌓기가 늘 하나 있다.
 */
export function topReason(w, d, front, side, plan) {
  for (let at = 0; at < w * d; at++) {
    if (!plan[at]) continue;
    const x = at % w;
    const y = Math.floor(at / w);
    if (front[x] === 0) return { kind: 'seen', axis: 'front', at: x };
    if (side[y] === 0) return { kind: 'seen', axis: 'side', at: y };
  }
  for (let x = 0; x < w; x++) {
    if (front[x] === 0) continue;
    const cells = range(d).filter((y) => plan[y * w + x]);
    if (cells.length === 0) return { kind: 'empty', axis: 'front', at: x };
    const reach = Math.max(...cells.map((y) => side[y]));
    if (reach < front[x]) return { kind: 'short', axis: 'front', at: x, need: front[x], reach };
  }
  for (let y = 0; y < d; y++) {
    if (side[y] === 0) continue;
    const cells = range(w).filter((x) => plan[y * w + x]);
    if (cells.length === 0) return { kind: 'empty', axis: 'side', at: y };
    const reach = Math.max(...cells.map((x) => front[x]));
    if (reach < side[y]) return { kind: 'short', axis: 'side', at: y, need: side[y], reach };
  }
  return null;
}

// ---- 보기(see) 판의 고른 그림이 무엇인가 ----

/**
 * 보기 하나가 무엇인지: 맞는 그림, 다른 방향에서 본 그림, 한 줄(한 칸)만 다른 그림.
 *   { kind: 'right' }
 *   { kind: 'back' }   앞을 물었는데 뒤에서 본 그림(앞 그림을 좌우로 뒤집은 것)
 *   { kind: 'left' }   옆을 물었는데 왼쪽 옆에서 본 그림(옆 그림을 좌우로 뒤집은 것)
 *   { kind: 'side' }   앞이나 위를 물었는데 오른쪽 옆에서 본 그림
 *   { kind: 'front' }  옆이나 위를 물었는데 앞에서 본 그림
 *   { kind: 'near', at, value }        앞이나 옆의 그림인데 왼쪽에서 at번째 줄(0부터)만 높이가 value로 다르다(처음 다른 줄)
 *   { kind: 'cell', x, y, filled }     위의 그림인데 그 칸이 다르다(처음 다른 칸. filled면 고른 그림에서 차 있다)
 *   { kind: 'other' }  그 밖의 그림
 */
export function optionFact(board, option) {
  const { w, d, heights, ask } = board;
  const truth = viewFrom(w, d, heights, ask);
  if (sameList(option, truth)) return { kind: 'right' };
  const front = frontOf(w, d, heights);
  const side = sideOf(w, d, heights);
  if (ask === 'front' && sameList(option, front.slice().reverse())) return { kind: 'back' };
  if (ask === 'side' && sameList(option, side.slice().reverse())) return { kind: 'left' };
  if (ask !== 'side' && sameList(option, side)) return { kind: 'side' };
  if (ask !== 'front' && sameList(option, front)) return { kind: 'front' };
  if (option.length !== truth.length) return { kind: 'other' };
  const at = option.findIndex((value, index) => value !== truth[index]);
  if (ask === 'top') return { kind: 'cell', x: at % w, y: Math.floor(at / w), filled: option[at] > 0 };
  return { kind: 'near', at, value: option[at] };
}

// ---- 판 ----

const intList = (list, length, low, high) => Array.isArray(list) && list.length === length && list.every((value) => isInt(value) && value >= low && value <= high);
const sizeOk = (board) => isInt(board.w) && isInt(board.d) && board.w >= MIN_SIDE && board.w <= MAX_SIDE && board.d >= MIN_SIDE && board.d <= MAX_SIDE;

/** 판이 규격에 맞는지. 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object' || !KINDS.includes(board.kind)) return 'kind';
  if (!sizeOk(board)) return 'size';
  const { w, d } = board;
  if (board.kind === 'see') {
    if (!intList(board.heights, w * d, 0, MAX_H) || sum(board.heights) === 0) return 'heights';
    if (!ASKS.includes(board.ask)) return 'ask';
    if (!Array.isArray(board.options) || board.options.length < 2 || board.options.length > 4) return 'options';
    const truth = viewFrom(w, d, board.heights, board.ask);
    const top = board.ask === 'top';
    for (const option of board.options) {
      if (!Array.isArray(option) || option.length < MIN_SIDE || option.length > MAX_SIDE * MAX_SIDE) return 'options';
      if (!option.every((value) => isInt(value) && value >= 0 && value <= (top ? 1 : MAX_H))) return 'options';
    }
    const keys = new Set(board.options.map((option) => option.join(',')));
    if (keys.size !== board.options.length) return 'same-options';
    if (board.options.filter((option) => sameList(option, truth)).length !== 1) return 'answer';
    return null;
  }
  if (!intList(board.front, w, 0, MAX_H) || !intList(board.side, d, 0, MAX_H)) return 'views';
  if (sum(board.front) === 0) return 'views';
  if (board.kind === 'three') {
    if (!intList(board.plan, w * d, 0, 1)) return 'plan';
    if (topReason(w, d, board.front, board.side, board.plan) !== null) return 'impossible';
    return null;
  }
  if (Math.max(...board.front) !== Math.max(...board.side)) return 'impossible';
  if (board.kind === 'top') {
    if (!Array.isArray(board.options) || board.options.length < 2 || board.options.length > 4) return 'options';
    if (!board.options.every((option) => intList(option, w * d, 0, 1) && sum(option) > 0)) return 'options';
    if (new Set(board.options.map((option) => option.join(''))).size !== board.options.length) return 'same-options';
    if (board.options.filter((option) => topReason(w, d, board.front, board.side, option) === null).length !== 1) return 'answer';
  }
  return null;
}

export function copyBoard(board) {
  const out = { kind: board.kind, w: board.w, d: board.d };
  if (board.kind === 'see') return { ...out, heights: board.heights.slice(), ask: board.ask, options: board.options.map((option) => option.slice()) };
  out.front = board.front.slice();
  out.side = board.side.slice();
  if (board.kind === 'top') out.options = board.options.map((option) => option.slice());
  if (board.kind === 'three') out.plan = board.plan.slice();
  return out;
}

export const sameBoard = (a, b) => JSON.stringify(copyBoard(a)) === JSON.stringify(copyBoard(b));

/** 판에서 주는 위의 그림(세 방향 판만) */
export const givenPlan = (board) => (board.kind === 'three' ? board.plan : null);

/** 쌓은 것이 판이 준 그림들과 맞는가(쌓는 판만) */
export function matches(board, heights) {
  const { w, d } = board;
  if (!sameList(frontOf(w, d, heights), board.front) || !sameList(sideOf(w, d, heights), board.side)) return false;
  return board.kind !== 'three' || sameList(planOf(heights), board.plan);
}

/**
 * 판을 푼다.
 *   see    { possible, answer(맞는 보기의 차례), truth(맞는 그림) }
 *   top    { possible, answer, reasons(보기마다 안 되는 까닭, 되는 보기는 null), count(그 보기로 쌓는 가짓수), example(그 보기로 가장 많이 쌓은 것) }
 *   build, range, three  { possible, count, fewest, most, fewestStack, mostStack, example(가장 많이 쌓은 것) }
 */
export function solve(board) {
  const { w, d } = board;
  if (board.kind === 'see') {
    const truth = viewFrom(w, d, board.heights, board.ask);
    return { possible: true, answer: board.options.findIndex((option) => sameList(option, truth)), truth };
  }
  if (board.kind === 'top') {
    const reasons = board.options.map((option) => topReason(w, d, board.front, board.side, option));
    const answer = reasons.findIndex((reason) => reason === null);
    const plan = board.options[answer];
    const counted = countStacks(w, d, board.front, board.side, plan);
    return { possible: true, answer, reasons, count: counted.count, example: tallest(w, d, board.front, board.side, plan) };
  }
  const plan = givenPlan(board);
  const counted = countStacks(w, d, board.front, board.side, plan);
  return { possible: counted.count > 0, ...counted, example: tallest(w, d, board.front, board.side, plan) };
}

// ---- 한 일의 차례(쌓기와 빼기) ----

/**
 * 한 일을 처음 모습(빈 판)부터 다시 해서 지금 쌓은 것을 낸다.
 * 한 일: 'a5'(5번 칸에 하나 쌓기), 'r5'(5번 칸에서 하나 빼기). 한 칸에 MAX_H보다 많이 쌓거나 빈칸에서 빼면 ok가 거짓이다.
 */
export function replay(board, trail) {
  const heights = new Array(board.w * board.d).fill(0);
  if (!Array.isArray(trail)) return { ok: false, heights };
  for (const step of trail) {
    const match = typeof step === 'string' ? step.match(/^([ar])(\d+)$/) : null;
    if (!match) return { ok: false, heights };
    const at = Number(match[2]);
    if (at >= heights.length) return { ok: false, heights };
    const next = heights[at] + (match[1] === 'a' ? 1 : -1);
    if (next < 0 || next > MAX_H) return { ok: false, heights };
    heights[at] = next;
  }
  return { ok: true, heights };
}

/** 쌓을 수 있는 판인가(쌓는 칸이 있는 판) */
export const canBuild = (board) => board.kind !== 'see';
