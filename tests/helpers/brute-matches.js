// 성냥개비의 다른 풀이(테스트용). 풀이 프로그램(src/core/matches.js)과 다른 방법으로 센다.
//   - 성냥은 변 번호 대신 "가로 x,y"(점 (x,y)에서 오른쪽으로), "세로 x,y"(점 (x,y)에서 아래로) 글자로 적는다
//   - 정사각형은 모든 왼쪽 위 점과 크기마다 테두리의 짧은 변을 하나씩 글자로 찾아본다(비트를 쓰지 않는다)
//   - 작은 판(변이 20개 이하)은 변의 모든 부분 집합(2^변의 수)을 하나씩 만들어 할 일에 맞는지 본다
//   - 큰 판은 다음 고르기(사전 차례로 다음 조합을 만드는 방법)로 뺄 성냥과 놓을 빈 변을 고른다(되부름을 쓰지 않는다)

/** 변 번호를 글자로. 번호를 매기는 약속(가로 변 먼저, 줄마다 왼쪽부터)은 대본과 코드의 설명대로 다시 적었다 */
export function edgeName(w, h, edge) {
  const across = (h + 1) * w;
  if (edge < across) return `가로 ${edge % w},${Math.floor(edge / w)}`;
  const rest = edge - across;
  return `세로 ${rest % (w + 1)},${Math.floor(rest / (w + 1))}`;
}

export const allEdges = (w, h) => Array.from({ length: (h + 1) * w + h * (w + 1) }, (_, edge) => edge);

/** 테두리가 다 있는 정사각형을 하나씩 찾는다: [{x, y, size}] */
export function bruteSquares(w, h, edges) {
  const have = new Set(edges.map((edge) => edgeName(w, h, edge)));
  const found = [];
  for (let size = 1; size <= Math.min(w, h); size++) {
    for (let y = 0; y + size <= h; y++) {
      for (let x = 0; x + size <= w; x++) {
        let whole = true;
        for (let i = 0; i < size && whole; i++) {
          whole =
            have.has(`가로 ${x + i},${y}`) && have.has(`가로 ${x + i},${y + size}`) && have.has(`세로 ${x},${y + i}`) && have.has(`세로 ${x + size},${y + i}`);
        }
        if (whole) found.push({ x, y, size });
      }
    }
  }
  return found;
}

/** 어느 정사각형의 변도 아닌 성냥의 수 */
export function bruteLoose(w, h, edges) {
  const used = new Set();
  for (const { x, y, size } of bruteSquares(w, h, edges)) {
    for (let i = 0; i < size; i++) {
      for (const name of [`가로 ${x + i},${y}`, `가로 ${x + i},${y + size}`, `세로 ${x},${y + i}`, `세로 ${x + size},${y + i}`]) used.add(name);
    }
  }
  return edges.filter((edge) => !used.has(edgeName(w, h, edge))).length;
}

/** 끝난 모습 하나가 할 일에 맞는가(빼거나 옮긴 수는 따로 본다) */
function fits(board, edges) {
  if (bruteSquares(board.w, board.h, edges).length !== board.n) return false;
  return !board.tidy || bruteLoose(board.w, board.h, edges) === 0;
}

/** 변의 모든 부분 집합을 만들어 본다(변이 20개 이하인 판). 할 일에 맞는 끝난 모습의 수 */
export function subsetCount(board) {
  const edges = allEdges(board.w, board.h);
  if (edges.length > 20) throw new Error('부분 집합으로 세기에는 판이 커요');
  let startBits = 0;
  for (const edge of board.matches) startBits |= 1 << edge;
  const ones = (value) => {
    let count = 0;
    for (let rest = value; rest; rest &= rest - 1) count += 1;
    return count;
  };
  let total = 0;
  for (let bits = 0; bits < 2 ** edges.length; bits++) {
    // 남긴 처음 성냥과 새로 놓은 변의 수를 먼저 세어, 할 일의 수에 맞는 모습만 정사각형을 찾아본다
    const kept = ones(bits & startBits);
    const added = ones(bits & ~startBits);
    if (board.matches.length - kept !== board.k) continue;
    if (added !== (board.kind === 'move' ? board.k : 0)) continue;
    if (fits(board, edges.filter((edge) => (bits >> edge) & 1))) total += 1;
  }
  return total;
}

/** 사전 차례의 다음 조합(0..n-1에서 k개). 마지막이면 null */
function nextCombo(combo, n) {
  const next = combo.slice();
  let at = next.length - 1;
  while (at >= 0 && next[at] === n - next.length + at) at -= 1;
  if (at < 0) return null;
  next[at] += 1;
  for (let i = at + 1; i < next.length; i++) next[i] = next[i - 1] + 1;
  return next;
}

function* combos(n, k) {
  if (k > n) return;
  let combo = Array.from({ length: k }, (_, index) => index);
  while (combo) {
    yield combo;
    combo = k === 0 ? null : nextCombo(combo, n);
  }
}

/** 뺄 성냥과 놓을 빈 변을 다음 고르기로 골라 센다. { count: 할 일에 맞는 수, ways: 해 본 수 } */
export function comboCount(board) {
  const empty = allEdges(board.w, board.h).filter((edge) => !board.matches.includes(edge));
  let count = 0;
  let ways = 0;
  for (const out of combos(board.matches.length, board.k)) {
    const gone = new Set(out.map((index) => board.matches[index]));
    const kept = board.matches.filter((edge) => !gone.has(edge));
    const adds = board.kind === 'move' ? combos(empty.length, board.k) : [[]];
    for (const into of adds) {
      ways += 1;
      if (fits(board, [...kept, ...into.map((index) => empty[index])])) count += 1;
    }
  }
  return { count, ways };
}
