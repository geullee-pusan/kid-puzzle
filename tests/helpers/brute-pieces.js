// 조각 가짓수 찾기를 다른 방법으로 다시 센다(테스트 전용).
// - 조각 만들기: n×n 네모 안의 칸 n개 묶음을 모두 골라 보고(칸 번호를 차례로 고르는 조합), 변으로 이어진 것만 남긴다.
//   한 칸씩 붙여 가는 풀이 프로그램과 달리 이어지지 않은 묶음까지 모두 만들어 본다
// - 같은 조각 가리기: 조각을 글자 판(줄마다 #과 .)으로 그리고, 글자 판을 돌리고(가로세로를 바꾸고 줄을 뒤집는다) 뒤집어(줄마다 글자를 거꾸로)
//   나온 글자 판 가운데 가장 앞선 것을 이름으로 삼는다. 좌표에 행렬을 곱하는 풀이 프로그램과 다르게 적었다

/** 칸들을 글자 판으로: 감싸는 네모의 줄마다 칸이면 #, 아니면 . */
export function toRows(cells) {
  const xs = cells.map((cell) => cell[0]);
  const ys = cells.map((cell) => cell[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0 + 1;
  const h = Math.max(...ys) - y0 + 1;
  const rows = Array.from({ length: h }, () => Array(w).fill('.'));
  for (const [x, y] of cells) rows[y - y0][x - x0] = '#';
  return rows.map((row) => row.join(''));
}

/** 글자 판을 시계 방향으로 90도 돌린다: 새 줄 r은 옛 판의 r번째 글자들을 아래에서 위로 읽은 것 */
export function turnRows(rows) {
  const w = rows[0].length;
  return Array.from({ length: w }, (_, col) =>
    rows
      .map((row) => row[col])
      .reverse()
      .join(''),
  );
}

/** 글자 판을 좌우로 뒤집는다 */
export const mirrorRows = (rows) => rows.map((row) => [...row].reverse().join(''));

/** 약속에 따라 같다고 치는 글자 판들 */
export function variants(rows, rule) {
  const out = [rows];
  if (rule === 'fixed') return out;
  for (let step = 0; step < 3; step++) out.push(turnRows(out.at(-1)));
  if (rule === 'turn') return out;
  const flipped = mirrorRows(rows);
  out.push(flipped);
  for (let step = 0; step < 3; step++) out.push(turnRows(out.at(-1)));
  return out;
}

/** 이름: 같다고 치는 글자 판들을 '/'로 이은 글 가운데 가장 앞선 것 */
export const nameOf = (cells, rule = 'free') =>
  variants(toRows(cells), rule)
    .map((rows) => rows.join('/'))
    .sort()[0];

/** 이어져 있는가(칸 번호와 이웃 목록으로 따로 센다) */
export function linked(cells) {
  const set = new Set(cells.map(([x, y]) => `${x} ${y}`));
  const seen = new Set();
  const stack = [cells[0]];
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const id = `${x} ${y}`;
    if (seen.has(id) || !set.has(id)) continue;
    seen.add(id);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen.size === set.size;
}

const fixedMemo = new Map();
/** n×n 네모 안에서 왼쪽 위에 붙은(맨 위 줄과 맨 왼쪽 줄에 칸이 있는) 이어진 n칸 묶음을 모두 만든다. 옮겨서 같은 것은 한 번씩만 나온다 */
export function bruteFixed(n) {
  if (fixedMemo.has(n)) return fixedMemo.get(n);
  const all = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) all.push([x, y]);
  const out = [];
  const pick = [];
  const choose = (from) => {
    if (pick.length === n) {
      if (pick.some((cell) => cell[0] === 0) && pick.some((cell) => cell[1] === 0) && linked(pick)) out.push(pick.map((cell) => cell.slice()));
      return;
    }
    for (let at = from; at <= all.length - (n - pick.length); at++) {
      pick.push(all[at]);
      choose(at + 1);
      pick.pop();
    }
  };
  choose(0);
  fixedMemo.set(n, out);
  return out;
}

/** 약속에 따라 같은 것을 하나로 친 묶음들. { 이름: 그 이름의 묶음 하나 } */
export function bruteShapes(n, rule = 'free') {
  const found = new Map();
  for (const cells of bruteFixed(n)) {
    const name = nameOf(cells, rule);
    if (!found.has(name)) found.set(name, cells);
  }
  return found;
}

/** 가장 긴 줄: 글자 판의 가로줄과 세로줄에서 #이 이어진 가장 긴 수 */
export function longestRun(cells) {
  const rows = toRows(cells);
  const lines = [...rows, ...turnRows(rows)];
  return Math.max(...lines.flatMap((line) => line.split('.').map((part) => part.length)));
}

/** a를 b에 겹치는 움직임의 종류(글자 판으로): 'same' | 'turn' | 'flip' | null */
export function bruteHow(a, b) {
  const target = toRows(b).join('/');
  const rows = toRows(a);
  const turns = variants(rows, 'turn').map((item) => item.join('/'));
  if (turns[0] === target) return 'same';
  if (turns.includes(target)) return 'turn';
  if (variants(rows, 'free').some((item) => item.join('/') === target)) return 'flip';
  return null;
}
