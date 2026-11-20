// 마법 네모와 겹친 칸의 판과 풀이. 순수 함수만 둔다.
// 판은 칸과 줄로 된 그림이다. 수 카드(서로 다른 수)를 칸마다 한 장씩 놓아, 정한 줄들의 합을 모두 같게(합이 정해진 판은 그 합으로) 한다.
//
// 판에는 두 모양이 있다.
//   { shape: 'grid', w, h, lines, cards, target: null }  네모 칸. 칸 번호는 y * w + x
//     lines  'rows'(가로 줄만) | 'rowscols'(가로와 세로) | 'all'(가로, 세로, 대각선 둘. 마법 네모) | 'center'(가운데 칸을 지나는 네 줄)
//            'rows'는 3×3, 2×3(가로 두 칸짜리 줄 셋), 2×2에서 쓰고, 나머지는 3×3에서만 쓴다
//   { shape: 'hub', arms, cards, target }  가운데 칸 하나에서 만나는 세 칸짜리 줄 arms개(2~4). 칸 0이 가운데이고 줄 i는 [1 + 2i, 0, 2 + 2i]다
//     target  줄마다 맞출 합. null이면 줄의 합이 모두 같기만 하면 된다
// 카드는 1~40의 서로 다른 정수이고 칸 수와 같은 장수다. 판에 적을 때는 작은 수부터 늘어놓는다.
//
// 두 번 세기: 가운데 칸 하나에서 줄 k개가 만나면, 줄의 합을 모두 더한 것은 (카드를 모두 더한 수) + (k − 1) × (가운데 카드)다.
// 그래서 줄마다 합이 S이려면 k × S − (카드의 합)이 (k − 1)로 똑같이 나뉘어 가운데 카드가 되어야 하고,
// 남은 카드가 합이 S − (가운데 카드)인 짝으로 모두 나뉘어야 한다. 3×3 마법 네모의 가운데를 지나는 네 줄도 같다(가운데 = 카드의 합 ÷ 9).

export const SHAPES = ['grid', 'hub'];
export const LINE_SETS = ['rows', 'rowscols', 'all', 'center'];
/** 네모 판의 크기 [가로, 세로] */
export const GRID_SIZES = [
  [3, 3],
  [2, 3],
  [2, 2],
];
export const ARMS = [2, 3, 4];
export const MIN_CARD = 1;
export const MAX_CARD = 40;
/** 합을 정한 판에 적을 수 있는 합의 위 끝 */
export const MAX_TARGET = 120;

const sum = (list) => list.reduce((total, value) => total + value, 0);

/** 판의 칸 수 */
export function sizeOf(board) {
  return board.shape === 'grid' ? board.w * board.h : 1 + 2 * board.arms;
}

/** 가운데 칸(여러 줄이 만나는 칸). 3×3 네모는 4, 겹친 칸 판은 0, 나머지는 null */
export function centerOf(board) {
  if (board.shape === 'hub') return 0;
  return board.w === 3 && board.h === 3 ? 4 : null;
}

/**
 * 판이 판의 규격에 맞는지 본다. 맞으면 null, 아니면 무엇이 문제인지.
 * @returns {null|'bad-board'|'bad-shape'|'bad-size'|'bad-lines'|'bad-cards'|'bad-target'}
 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'bad-board';
  if (!SHAPES.includes(board.shape)) return 'bad-shape';
  if (board.shape === 'grid') {
    if (!GRID_SIZES.some(([w, h]) => w === board.w && h === board.h)) return 'bad-size';
    if (!LINE_SETS.includes(board.lines)) return 'bad-lines';
    if (board.lines !== 'rows' && !(board.w === 3 && board.h === 3)) return 'bad-lines';
    if (board.target !== null) return 'bad-target';
  } else {
    if (!ARMS.includes(board.arms)) return 'bad-size';
    if (!(board.target === null || (Number.isInteger(board.target) && board.target >= 1 && board.target <= MAX_TARGET))) return 'bad-target';
  }
  const { cards } = board;
  if (!Array.isArray(cards) || cards.length !== sizeOf(board)) return 'bad-cards';
  if (!cards.every((card) => Number.isInteger(card) && card >= MIN_CARD && card <= MAX_CARD)) return 'bad-cards';
  if (new Set(cards).size !== cards.length) return 'bad-cards';
  return null;
}

/** 판을 베낀다. 카드는 작은 수부터 늘어놓는다 */
export function copyBoard(board) {
  const cards = board.cards.slice().sort((a, b) => a - b);
  if (board.shape === 'grid') return { shape: 'grid', w: board.w, h: board.h, lines: board.lines, cards, target: null };
  return { shape: 'hub', arms: board.arms, cards, target: board.target };
}

/** 판의 열쇠(같은 판이면 같은 글자) */
export const boardKey = (board) => JSON.stringify(copyBoard(board));

/**
 * 판의 줄들. 줄마다 { kind, at, cells }
 *   kind  'row'(가로, at은 몇째 줄) | 'col'(세로) | 'diag'(왼쪽 위에서 오른쪽 아래) | 'anti'(오른쪽 위에서 왼쪽 아래) | 'arm'(겹친 칸 판의 줄 at)
 */
export function linesOf(board) {
  if (board.shape === 'hub') return Array.from({ length: board.arms }, (_, at) => ({ kind: 'arm', at, cells: [1 + 2 * at, 0, 2 + 2 * at] }));
  const { w, h, lines } = board;
  const row = (y) => ({ kind: 'row', at: y, cells: Array.from({ length: w }, (_, x) => y * w + x) });
  const col = (x) => ({ kind: 'col', at: x, cells: Array.from({ length: h }, (_, y) => y * w + x) });
  const diag = { kind: 'diag', at: 0, cells: [0, 4, 8] };
  const anti = { kind: 'anti', at: 0, cells: [2, 4, 6] };
  const rows = Array.from({ length: h }, (_, y) => row(y));
  const cols = Array.from({ length: w }, (_, x) => col(x));
  if (lines === 'rows') return rows;
  if (lines === 'rowscols') return [...rows, ...cols];
  if (lines === 'all') return [...rows, ...cols, diag, anti];
  return [row(1), col(1), diag, anti];
}

/** 칸마다 그 칸을 지나는 줄의 수(가운데 칸이 몇 번 세어지는지) */
export function passCounts(board) {
  const counts = Array(sizeOf(board)).fill(0);
  for (const line of linesOf(board)) for (const cell of line.cells) counts[cell] += 1;
  return counts;
}

/** 놓은 카드가 판에 맞는 모습인가(칸마다 판의 카드 하나 또는 빈칸(null), 같은 카드는 한 번) */
export function placedOk(board, placed) {
  if (!Array.isArray(placed) || placed.length !== sizeOf(board)) return false;
  const used = placed.filter((card) => card !== null);
  if (!used.every((card) => board.cards.includes(card))) return false;
  return new Set(used).size === used.length;
}

/** 아직 놓지 않은 카드(작은 수부터) */
export function trayOf(board, placed) {
  return board.cards.filter((card) => !placed.includes(card)).sort((a, b) => a - b);
}

/** 줄마다 지금 놓인 카드의 합. { kind, at, cells, sum, filled(놓인 칸 수), full } */
export function lineSums(board, placed) {
  return linesOf(board).map((line) => {
    const cards = line.cells.map((cell) => placed[cell]).filter((card) => card !== null);
    return { ...line, sum: sum(cards), filled: cards.length, full: cards.length === line.cells.length };
  });
}

/**
 * 합이 같은 줄 표시(판정이 아니라 사실). 줄마다 참·거짓.
 * 합을 정한 판은 다 찬 줄 가운데 합이 그 합인 줄, 아니면 다 찬 줄 가운데 가장 많은 줄이 함께 가진 합(둘 이상, 하나뿐일 때)의 줄이다.
 */
export function sameLines(board, sums) {
  if (board.target !== null) return sums.map((line) => line.full && line.sum === board.target);
  const tally = new Map();
  for (const line of sums) if (line.full) tally.set(line.sum, (tally.get(line.sum) ?? 0) + 1);
  const most = Math.max(0, ...tally.values());
  const tops = [...tally].filter(([, count]) => count === most);
  if (most < 2 || tops.length !== 1) return sums.map(() => false);
  return sums.map((line) => line.full && line.sum === tops[0][0]);
}

/** 판이 다 되었는가: 칸이 모두 찼고, 줄의 합이 모두 같다(합을 정한 판은 그 합이다) */
export function isDone(board, placed) {
  if (!placedOk(board, placed) || placed.some((card) => card === null)) return false;
  const sums = lineSums(board, placed).map((line) => line.sum);
  const goal = board.target ?? sums[0];
  return sums.every((value) => value === goal);
}

/** 카드를 놓는 차례: 줄이 빨리 다 차도록, 줄을 가장 많이 채우는 칸부터 */
function cellOrder(board, lines) {
  const size = sizeOf(board);
  const order = [];
  const taken = new Set();
  const left = lines.map((line) => line.cells.length);
  while (order.length < size) {
    let best = -1;
    let bestScore = -Infinity;
    for (let cell = 0; cell < size; cell++) {
      if (taken.has(cell)) continue;
      const mine = lines.filter((line) => line.cells.includes(cell));
      const closes = mine.filter((line) => left[lines.indexOf(line)] === 1).length;
      const near = mine.reduce((total, line) => total + (line.cells.length - left[lines.indexOf(line)]), 0);
      const score = closes * 100 + near * 10 + mine.length;
      if (score > bestScore) {
        bestScore = score;
        best = cell;
      }
    }
    order.push(best);
    taken.add(best);
    lines.forEach((line, index) => {
      if (line.cells.includes(best)) left[index] -= 1;
    });
  }
  return order;
}

/**
 * 되짚어 가며 모든 놓는 방법을 따진다. 줄이 다 찰 때마다 합을 견주고, 합이 넘친 줄은 더 가지 않는다.
 * @returns {{count: number, bySum: Map<number, {count: number, centers: Set<number>, example: number[]}>}}
 */
function search(board) {
  const lines = linesOf(board);
  const size = sizeOf(board);
  const cards = board.cards.slice().sort((a, b) => a - b);
  const low = cards[0];
  const order = cellOrder(board, lines);
  const through = Array.from({ length: size }, (_, cell) => lines.map((line, index) => (line.cells.includes(cell) ? index : -1)).filter((index) => index >= 0));
  const partial = lines.map(() => 0);
  const filled = lines.map(() => 0);
  const placed = Array(size).fill(null);
  const used = cards.map(() => false);
  const center = centerOf(board);
  const bySum = new Map();
  let goal = board.target;
  let count = 0;

  const visit = (depth) => {
    if (depth === size) {
      count += 1;
      const value = partial[0];
      if (!bySum.has(value)) bySum.set(value, { count: 0, centers: new Set(), example: placed.slice() });
      const entry = bySum.get(value);
      entry.count += 1;
      if (center !== null) entry.centers.add(placed[center]);
      return;
    }
    const cell = order[depth];
    for (let index = 0; index < cards.length; index++) {
      if (used[index]) continue;
      const card = cards[index];
      for (const line of through[cell]) {
        partial[line] += card;
        filled[line] += 1;
      }
      let ok = true;
      let setHere = false;
      for (const line of through[cell]) {
        const length = lines[line].cells.length;
        if (filled[line] === length) {
          if (goal === null) {
            goal = partial[line];
            setHere = true;
          } else if (partial[line] !== goal) {
            ok = false;
            break;
          }
        } else if (goal !== null && partial[line] + (length - filled[line]) * low > goal) {
          ok = false;
          break;
        }
      }
      if (ok) {
        placed[cell] = card;
        used[index] = true;
        visit(depth + 1);
        used[index] = false;
        placed[cell] = null;
      }
      if (setHere) goal = null;
      for (const line of through[cell]) {
        partial[line] -= card;
        filled[line] -= 1;
      }
    }
  };
  visit(0);
  return { count, bySum };
}

/** 남은 카드를 합이 pair인 짝으로 모두 나눌 수 없으면, 짝이 없는 카드 하나(가장 작은 것). 다 나뉘면 null */
function lonelyCard(cards, pair) {
  return cards.find((card) => card * 2 === pair || !cards.includes(pair - card)) ?? null;
}

/**
 * 안 되는 판의 까닭. 먼저 걸리는 것 하나를 고른다.
 * 네모 판(가로 줄이 있는 판):
 *   big            가장 큰 카드가 든 가로 줄은 가장 작게 놓아도 합이 low이고, 다른 가로 줄 가운데 하나는 늘 그보다 작다
 *   split          카드의 합이 가로 줄 수로 똑같이 나뉘지 않는다
 *   center-part    (마법 네모) 가운데 카드는 줄의 합을 셋으로 나눈 수인데, 그 수가 정수가 아니다
 *   center-missing (마법 네모, 겹친 칸) 가운데에 와야 할 카드가 없다
 *   pairs          (마법 네모, 겹친 칸) 가운데를 뺀 카드가 합이 pair인 짝으로 나뉘지 않는다(card는 짝이 없는 카드)
 *   search         위의 것에 걸리지 않는데도 모든 방법을 놓아 보면 안 된다
 * 겹친 칸 판(합을 정한 판):
 *   big / small    가장 큰(작은) 카드 세 장을 한 줄에 놓아도 합이 정한 합보다 작다(크다)
 *   center-part    (줄 수 × 합 − 카드의 합)이 (줄 수 − 1)로 똑같이 나뉘지 않는다
 * 합을 정하지 않은 판(가운데 네 줄, 겹친 칸):
 *   pairs-all      가운데에 어느 카드를 놓아도 남은 카드가 합이 같은 짝으로 나뉘지 않는다
 */
export function reasonOf(board) {
  const cards = board.cards.slice().sort((a, b) => a - b);
  const total = sum(cards);
  if (board.shape === 'grid' && board.lines !== 'center') {
    const { w, h, lines } = board;
    const top = cards.at(-1);
    const low = top + sum(cards.slice(0, w - 1));
    if (h * low > total) return { reason: 'big', card: top, low, rows: h };
    if (total % h !== 0) return { reason: 'split', total, rows: h };
    if (lines === 'rowscols' && total % w !== 0) return { reason: 'split', total, rows: w };
    if (lines === 'all') {
      const line = total / 3;
      if (line % 3 !== 0) return { reason: 'center-part', total, line };
      const center = line / 3;
      if (!cards.includes(center)) return { reason: 'center-missing', total, line, center };
      const card = lonelyCard(cards.filter((value) => value !== center), center * 2);
      if (card !== null) return { reason: 'pairs', total, line, center, pair: center * 2, card };
    }
    return { reason: 'search', total };
  }
  if (board.target === null) {
    // 가운데 네 줄(네모)이나 겹친 칸: 가운데마다 남은 카드가 같은 합의 짝으로 나뉘는지
    return { reason: 'pairs-all', total };
  }
  const arms = board.arms;
  const goal = board.target;
  const high = sum(cards.slice(-3));
  const least = sum(cards.slice(0, 3));
  if (goal > high) return { reason: 'big', total, line: goal, high };
  if (goal < least) return { reason: 'small', total, line: goal, least };
  const extra = arms * goal - total;
  if (extra % (arms - 1) !== 0) return { reason: 'center-part', total, line: goal, extra, times: arms - 1 };
  const center = extra / (arms - 1);
  if (!cards.includes(center)) return { reason: 'center-missing', total, line: goal, extra, times: arms - 1, center };
  const card = lonelyCard(
    cards.filter((value) => value !== center),
    goal - center,
  );
  if (card !== null) return { reason: 'pairs', total, line: goal, extra, times: arms - 1, center, pair: goal - center, card };
  return { reason: 'search', total };
}

const memo = new Map();

/**
 * 판을 푼다. 같은 판은 한 번만 따지고 적어 둔다.
 * @returns {{possible: boolean, count: number, total: number, sums: {sum: number, count: number, centers: number[], example: number[]}[], example: number[]|null, why: object|null}}
 *   count    줄의 합이 모두 같아지는 놓는 방법의 수(칸이 다르면 다른 방법이다. 돌리거나 뒤집은 것도 센다)
 *   sums     줄의 합마다 놓는 방법의 수와 그때의 가운데 카드들, 놓는 방법 하나(작은 합부터)
 *   example  놓는 방법 하나(가장 작은 합의 것). 안 되는 판은 null
 *   why      안 되는 판의 까닭(reasonOf). 되는 판은 null
 */
export function solve(board) {
  const key = boardKey(board);
  if (memo.has(key)) return memo.get(key);
  const clean = copyBoard(board);
  const { count, bySum } = search(clean);
  const sums = [...bySum]
    .map(([value, entry]) => ({ sum: value, count: entry.count, centers: [...entry.centers].sort((a, b) => a - b), example: entry.example }))
    .sort((a, b) => a.sum - b.sum);
  const result = {
    possible: count > 0,
    count,
    total: sum(clean.cards),
    sums,
    example: sums.length > 0 ? sums[0].example : null,
    why: count > 0 ? null : reasonOf(clean),
  };
  memo.set(key, result);
  return result;
}

/**
 * 겹친 칸 판에서 합마다 되는지를 두 번 세기로 따진다(놓아 보지 않는다). 카드로 만들 수 있는 줄의 합(가장 작은 셋 ~ 가장 큰 셋)마다
 * { line, center(가운데에 와야 할 카드. 정수가 아니면 null), possible }. 테스트가 solve와 견준다.
 */
export function hubSums(arms, cards) {
  const sorted = cards.slice().sort((a, b) => a - b);
  const total = sum(sorted);
  const out = [];
  for (let line = sum(sorted.slice(0, 3)); line <= sum(sorted.slice(-3)); line++) {
    const extra = arms * line - total;
    const center = extra % (arms - 1) === 0 ? extra / (arms - 1) : null;
    const possible = center !== null && sorted.includes(center) && lonelyCard(sorted.filter((card) => card !== center), line - center) === null;
    out.push({ line, center, possible });
  }
  return out;
}

/**
 * 이 판보다 작은 판들(src/core/smaller.js가 차례로 고른다). 되는 판(yes)과 안 되는 판(no)으로 나눈다. 작은 판이 없으면 둘 다 빈 목록이다.
 *   네모 판: 마법 네모 → 가로와 세로, 가운데 네 줄, 가로 줄만(같은 카드). 가로와 세로 → 가로 줄만(같은 카드), 줄이 둘인 판.
 *            가로 줄만 3×3 → 가로 두 칸짜리 줄 셋(작은 카드 여섯 장), 2×2(작은 카드 네 장). 2×3 → 2×2
 *   가운데 네 줄 → 줄 셋, 줄 둘이 만나는 판(합을 정하지 않는다. 작은 카드부터)
 *   겹친 칸: 줄이 하나, 둘 적은 판(작은 카드부터). 합을 정한 판이면 그 판의 카드로 만들 수 있는 합들을 모두 낸다(가운데가 1보다 작은 합은 뺀다)
 * 모두 놓아 봐야 아는 안 되는 판(까닭 search)은 내지 않는다.
 */
export function smallLists(board) {
  if (checkBoard(board) !== null) return { yes: [], no: [] };
  const cards = board.cards.slice().sort((a, b) => a - b);
  const boards = [];
  const grid = (w, h, lines, list) => ({ shape: 'grid', w, h, lines, cards: list, target: null });
  const hub = (arms, list, target) => ({ shape: 'hub', arms, cards: list, target });
  if (board.shape === 'grid') {
    if (board.lines === 'all') boards.push(grid(3, 3, 'rowscols', cards), grid(3, 3, 'center', cards), grid(3, 3, 'rows', cards));
    else if (board.lines === 'rowscols') boards.push(grid(3, 3, 'rows', cards), grid(2, 3, 'rows', cards.slice(0, 6)));
    else if (board.lines === 'center') boards.push(hub(3, cards.slice(0, 7), null), hub(2, cards.slice(0, 5), null));
    else if (board.w === 3) boards.push(grid(2, 3, 'rows', cards.slice(0, 6)), grid(2, 2, 'rows', cards.slice(0, 4)));
    else if (board.h === 3) boards.push(grid(2, 2, 'rows', cards.slice(0, 4)));
  } else {
    for (let arms = board.arms - 1; arms >= 2; arms--) {
      const list = cards.slice(0, 1 + 2 * arms);
      if (board.target === null) {
        boards.push(hub(arms, list, null));
        continue;
      }
      for (const item of hubSums(arms, list)) {
        // 가운데가 1보다 작아야 하는 합은 내지 않는다(까닭이 아이에게 뜻이 없다)
        if (item.center !== null && item.center < 1) continue;
        boards.push(hub(arms, list, item.line));
      }
    }
  }
  const yes = [];
  const no = [];
  // 모두 놓아 봐야 아는 안 되는 판(까닭 search)은 아이가 따져 알 수 없어서 작은 판으로 내지 않는다
  for (const item of boards) {
    const solved = solve(item);
    if (solved.possible) yes.push(item);
    else if (solved.why.reason !== 'search') no.push(item);
  }
  return { yes, no };
}
