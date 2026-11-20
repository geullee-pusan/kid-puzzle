// 열쇠 미로를 풀이 프로그램과 다른 방법으로 다시 푼다(테스트 전용).
// 판을 "문 자리 → 문" 표로 다시 읽고, 모습을 글자(방|주운 열쇠|연 문)로 적어 따진다. src/core/keymaze.js의 함수는 하나도 쓰지 않는다.
//   bruteSolve      모든 모습을 차례로 넓혀 가며(너비 우선) 가장 적은 걸음을 센다
//   bruteWalks      걸음의 차례를 모두 걸어 본다(깊이 우선, 걸음 수의 위 끝까지). 작은 판에서 가장 적은 걸음을 따로 확인한다
//   bruteAlive      나갈 수 있는 모습을, 더 늘지 않을 때까지 되풀이해서 모은다(거꾸로 따라가지 않는다)
//   bruteBack       잠긴 문을 열 수 있다고 칠 때 나가는 문까지 갈 수 있는 방을, 더 늘지 않을 때까지 되풀이해서 모은다

const OUT = 'out';

/** 문 자리의 이름: 작은 방 번호-큰 방 번호. 나가는 문은 'out' */
const spotName = (a, b) => (a === OUT || b === OUT ? OUT : `${Math.min(a, b)}-${Math.max(a, b)}`);

/** 판을 다시 읽는다: 방마다 이웃(이웃 방 또는 out)과 그 사이의 문 */
export function readMaze(board) {
  const { w, h } = board;
  const doors = new Map();
  for (const door of board.doors) doors.set(spotName(door.a, door.b), { kind: door.kind, to: door.to, color: door.color });
  doors.set(OUT, board.exit.color === null ? { kind: 'open' } : { kind: 'lock', color: board.exit.color });
  const near = (room) => {
    const x = room % w;
    const y = Math.floor(room / w);
    const list = [];
    if (x > 0) list.push(room - 1);
    if (x < w - 1) list.push(room + 1);
    if (y > 0) list.push(room - w);
    if (y < h - 1) list.push(room + w);
    if (room === board.exit.room) list.push(OUT);
    return list.filter((other) => doors.has(spotName(room, other)));
  };
  return { board, doors, near };
}

/** 모습: { room, keys: 주운 열쇠 번호들(Set), open: 연 문 자리들(Set) } → 글자 */
const nameOf = (state) => `${state.room}|${[...state.keys].sort((a, b) => a - b).join(',')}|${[...state.open].sort().join(',')}`;

function startOf(maze) {
  const { board } = maze;
  const keys = new Set();
  board.keys.forEach((key, index) => {
    if (key.room === board.start) keys.add(index);
  });
  return { room: board.start, keys, open: new Set() };
}

/** 그 색 열쇠를 지금 몇 개 쓸 수 있는가 */
function usable(maze, state, color) {
  const { board, doors } = maze;
  let have = 0;
  for (const index of state.keys) if (board.keys[index].color === color) have += 1;
  if (board.keep === 'kept') return have;
  let spent = 0;
  for (const spot of state.open) if (doors.get(spot).color === color) spent += 1;
  return have - spent;
}

/** 지금 모습에서 갈 수 있는 다음 모습들 */
export function nextStates(maze, state) {
  if (state.room === OUT) return [];
  const { board, doors } = maze;
  const result = [];
  for (const other of maze.near(state.room)) {
    const spot = spotName(state.room, other);
    const door = doors.get(spot);
    const open = new Set(state.open);
    if (door.kind === 'one' && door.to !== other) continue;
    if (door.kind === 'lock') {
      if (board.keep === 'kept') {
        if (usable(maze, state, door.color) < 1) continue;
      } else if (!open.has(spot)) {
        if (usable(maze, state, door.color) < 1) continue;
        open.add(spot);
      }
    }
    const keys = new Set(state.keys);
    if (other !== OUT) board.keys.forEach((key, index) => {
      if (key.room === other) keys.add(index);
    });
    result.push({ room: other, keys, open });
  }
  return result;
}

/** 너비 우선: 가장 적은 걸음(나갈 수 없으면 null)과 갈 수 있는 모습의 수 */
export function bruteSolve(board) {
  const maze = readMaze(board);
  const first = startOf(maze);
  let layer = [first];
  const seen = new Set([nameOf(first)]);
  let found = null;
  for (let steps = 0; layer.length > 0; steps++) {
    const next = [];
    for (const state of layer) {
      // 판 밖에 처음 닿은 걸음 수를 적고, 갈 수 있는 모습은 끝까지 센다
      if (state.room === OUT && found === null) found = steps;
      for (const after of nextStates(maze, state)) {
        const name = nameOf(after);
        if (seen.has(name)) continue;
        seen.add(name);
        next.push(after);
      }
    }
    layer = next;
  }
  return { possible: found !== null, steps: found, states: seen.size };
}

/** 깊이 우선: 걸음 수가 limit 이하인 모든 걸음의 차례를 걸어 본다. 가장 적은 걸음(없으면 null) */
export function bruteWalks(board, limit) {
  const maze = readMaze(board);
  let best = null;
  const walk = (state, steps) => {
    if (state.room === OUT) {
      if (best === null || steps < best) best = steps;
      return;
    }
    if (steps >= limit || (best !== null && steps + 1 >= best)) return;
    for (const after of nextStates(maze, state)) walk(after, steps + 1);
  };
  walk(startOf(maze), 0);
  return best;
}

/** 길(방들)을 걸어 본다. 걸을 수 있으면 마지막 모습, 아니면 null */
export function bruteReplay(board, rooms) {
  const maze = readMaze(board);
  if (rooms[0] !== board.start) return null;
  let state = startOf(maze);
  for (const room of rooms.slice(1)) {
    const target = room === board.w * board.h ? OUT : room;
    const found = nextStates(maze, state).find((after) => after.room === target);
    if (!found) return null;
    state = found;
  }
  return state;
}

/** 모든 모습을 모은 뒤, 나갈 수 있는 모습을 되풀이해서 모은다. 그 모습(글자)들의 Set과 모든 모습의 목록 */
export function bruteAlive(board) {
  const maze = readMaze(board);
  const all = new Map();
  const stack = [startOf(maze)];
  all.set(nameOf(stack[0]), stack[0]);
  while (stack.length > 0) {
    const state = stack.pop();
    for (const after of nextStates(maze, state)) {
      const name = nameOf(after);
      if (all.has(name)) continue;
      all.set(name, after);
      stack.push(after);
    }
  }
  const alive = new Set([...all].filter(([, state]) => state.room === OUT).map(([name]) => name));
  for (let grew = true; grew; ) {
    grew = false;
    for (const [name, state] of all) {
      if (alive.has(name)) continue;
      if (nextStates(maze, state).some((after) => alive.has(nameOf(after)))) {
        alive.add(name);
        grew = true;
      }
    }
  }
  return { alive, all, name: nameOf };
}

/** 잠긴 문을 colors의 색만 열 수 있다고 칠 때(한 번 쓰는 것은 따지지 않는다) 방 from에서 방 to로 지나갈 수 있는가 */
function passes(maze, from, to, colors) {
  const door = maze.doors.get(spotName(from, to));
  if (!door) return false;
  if (door.kind === 'open') return true;
  if (door.kind === 'one') return door.to === to;
  return colors.includes(door.color);
}

/** 나가는 문까지 갈 수 있는 방들(되풀이해서 모은다) */
export function bruteBack(board, colors = [0, 1, 2]) {
  const maze = readMaze(board);
  const good = new Set([OUT]);
  for (let grew = true; grew; ) {
    grew = false;
    for (let room = 0; room < board.w * board.h; room++) {
      if (good.has(room)) continue;
      if (maze.near(room).some((other) => good.has(other) && passes(maze, room, other, colors))) {
        good.add(room);
        grew = true;
      }
    }
  }
  good.delete(OUT);
  return [...good].sort((a, b) => a - b);
}

/** 방 from에서 갈 수 있는 방들(되풀이해서 모은다. 판 밖은 'out') */
export function bruteReach(board, colors = [0, 1, 2], from = board.start) {
  const maze = readMaze(board);
  const seen = new Set([from]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const room of [...seen]) {
      if (room === OUT) continue;
      for (const other of maze.near(room)) {
        if (seen.has(other) || !passes(maze, room, other, colors)) continue;
        seen.add(other);
        grew = true;
      }
    }
  }
  return seen;
}

/**
 * 그 색 문을 몇 개 열어야 나갈 수 있는가(다른 색 문은 colors의 색만 열 수 있다고 친다). 그 색 문 자리의 모든 묶음을 골라
 * 그 문만 열 수 있다고 쳐서 나갈 수 있는지 본다. 잠긴 문은 그 색 열쇠가 있는 방을 먼저 지난 뒤에만 지나간다.
 * 모습은 "방|지난 열쇠 방의 색들"이라는 글자이고, 더 늘지 않을 때까지 되풀이해서 모은다. 없으면 Infinity
 */
export function bruteDoorsNeeded(board, color, colors) {
  const maze = readMaze(board);
  const spots = [...maze.doors].filter(([, door]) => door.kind === 'lock' && door.color === color).map(([spot]) => spot);
  const colorsAt = (room) => [...new Set(board.keys.filter((key) => key.room === room).map((key) => key.color))];
  const nameOf2 = (room, seen) => `${room}|${[...seen].sort().join(',')}`;
  let best = Infinity;
  for (let mask = 0; mask < 1 << spots.length; mask++) {
    const chosen = new Set(spots.filter((_, index) => (mask >> index) & 1));
    const states = new Map([[nameOf2(board.start, colorsAt(board.start)), { room: board.start, seen: new Set(colorsAt(board.start)) }]]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const { room, seen } of [...states.values()]) {
        if (room === OUT) continue;
        for (const other of maze.near(room)) {
          const spot = spotName(room, other);
          const door = maze.doors.get(spot);
          let through = false;
          if (door.kind === 'open') through = true;
          else if (door.kind === 'one') through = door.to === other;
          else if (seen.has(door.color)) through = door.color === color ? chosen.has(spot) : colors.includes(door.color);
          if (!through) continue;
          const after = new Set(seen);
          if (other !== OUT) for (const item of colorsAt(other)) after.add(item);
          const name = nameOf2(other, after);
          if (states.has(name)) continue;
          states.set(name, { room: other, seen: after });
          grew = true;
        }
      }
    }
    if ([...states.values()].some((state) => state.room === OUT)) best = Math.min(best, chosen.size);
  }
  return best;
}

export { OUT };
