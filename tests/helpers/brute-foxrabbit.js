// 여우와 토끼를 풀이 프로그램과 다른 방법으로 다시 따진다(테스트에서만 쓴다).
// 칸을 [가로, 세로]의 짝으로 들고, 남은 횟수를 하나씩 줄이며 앞으로 따진다: "여우가 남은 횟수 안에 반드시 잡는가".
// 풀이 프로그램(src/core/foxrabbit.js)은 끝에서부터 한 겹씩 넓혀 가는 표를 쓴다. 여기서는 그 표도, 칸의 색도 쓰지 않는다.
// stay를 주면 그 동물은 제자리에 있어도 된다(규칙을 바꾼 게임. "반드시 한 칸 움직인다"가 왜 필요한지 보는 데 쓴다).

const STEPS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const same = (a, b) => a[0] === b[0] && a[1] === b[1];

/** 판 안에서 그 칸의 이웃 칸들(stay면 제자리도 넣는다) */
function nextCells(w, h, [x, y], stay) {
  const list = STEPS.map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < w && ny < h);
  if (stay) list.push([x, y]);
  return list;
}

/**
 * 한 크기의 판에서 "여우가 left번 움직이기 전에(left번째 움직임까지) 반드시 잡는가"를 따지는 함수를 만든다.
 * @param {{foxStay?: boolean, rabbitStay?: boolean}} rules
 */
export function makeBrute(w, h, { foxStay = false, rabbitStay = false } = {}) {
  const memo = new Map();
  function catches(fox, rabbit, turn, left) {
    if (left <= 0) return false;
    const key = `${fox}|${rabbit}|${turn}|${left}`;
    if (memo.has(key)) return memo.get(key);
    let result;
    if (turn === 'fox') {
      result = nextCells(w, h, fox, foxStay).some((cell) => same(cell, rabbit) || catches(cell, rabbit, 'rabbit', left - 1));
    } else {
      const escapes = nextCells(w, h, rabbit, rabbitStay).filter((cell) => !same(cell, fox));
      // 토끼가 갈 곳이 없으면(이 판들에서는 생기지 않는다) 토끼는 그대로 있는 것으로 본다.
      result = escapes.length === 0 ? catches(fox, rabbit, 'fox', left) : escapes.every((cell) => catches(fox, cell, 'fox', left));
    }
    memo.set(key, result);
    return result;
  }
  /** 둘 다 잘 하면 여우가 몇 번 만에 잡는가. limit번 안에 못 잡으면 null */
  function steps(fox, rabbit, turn, limit) {
    for (let left = 1; left <= limit; left++) if (catches(fox, rabbit, turn, left)) return left;
    return null;
  }
  return { catches, steps };
}

/** 칸 번호를 [가로, 세로]로 */
export const pairOf = (w, cell) => [cell % w, Math.floor(cell / w)];

/**
 * 둔 수들을 규칙대로 하나씩 따라가 본다(풀이 프로그램의 replay와 따로 쓴다).
 * @returns {{ok: boolean, fox: number[], rabbit: number[], foxMoves: number, winner: string|null}}
 */
export function bruteReplay(board, trail, first, { rabbitStay = false } = {}) {
  const { w, h } = board;
  let fox = pairOf(w, board.fox);
  let rabbit = pairOf(w, board.rabbit);
  let side = first;
  let foxMoves = 0;
  let winner = null;
  const limit = w + h - 3;
  for (const cell of trail) {
    if (winner) return { ok: false, fox, rabbit, foxMoves, winner };
    const to = pairOf(w, cell);
    const from = side === 'fox' ? fox : rabbit;
    const legal = nextCells(w, h, from, side === 'rabbit' && rabbitStay).some((item) => same(item, to)) && !(side === 'rabbit' && same(to, fox));
    if (!legal) return { ok: false, fox, rabbit, foxMoves, winner };
    if (side === 'fox') {
      fox = to;
      foxMoves += 1;
      if (same(fox, rabbit)) winner = 'fox';
      else if (foxMoves >= limit) winner = 'rabbit';
    } else rabbit = to;
    side = side === 'fox' ? 'rabbit' : 'fox';
  }
  return { ok: true, fox, rabbit, foxMoves, winner };
}
