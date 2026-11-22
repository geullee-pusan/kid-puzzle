// 손가락 더하기: 판의 규칙과 풀이 프로그램. 순수 함수만 둔다.
//
// 판(board)은 { limit, wrap, kid, teacher, first }다.
//   limit    손가락이 이만큼 되면 그 손이 빠진다(3~6. 보통 판은 5). 한 손에 펼 수 있는 손가락은 limit - 1개까지다
//   wrap     false면 기본 규칙(limit개가 되거나 넘으면 빠진다), true면 다시 도는 규칙(꼭 limit개가 되면 빠지고, 넘으면 넘은 만큼만 남는다)
//   kid      아이(나)의 두 손의 손가락 수 [화면 왼쪽 손, 화면 오른쪽 손]. 0은 빠진 손(주먹)이다
//   teacher  선생님의 두 손(같은 꼴. 화면 위쪽에서 아이와 마주 본다)
//   first    먼저 치는 쪽('kid' | 'teacher'). 아이가 두기 전에 고르는 판은 null이다
//
// 게임의 규칙
//   - 차례가 오면 내 손(빠지지 않은 손) 하나로 상대 손(빠지지 않은 손) 하나를 친다. 맞은 손에 친 손의 손가락 수만큼 손가락이 늘어난다.
//   - 기본 규칙: 맞은 손의 손가락이 limit개가 되거나 넘으면 그 손은 빠진다(0).
//     다시 도는 규칙: 꼭 limit개가 되면 빠지고, 넘으면 넘은 만큼만 남는다(limit이 5면 3 + 4 = 7 → 2). 곧 "limit으로 나눈 나머지"이고, 나머지가 0이면 빠진다.
//   - 두 손이 다 빠진 쪽이 진다.
//   - 같은 모습(네 손의 손가락 수와 누구 차례인지)이 다시 나오면 그 판은 비긴다.
//     기본 규칙에서는 칠 때마다 손가락이 늘거나 손이 빠지므로 같은 모습이 다시 나오는 일이 없다. 다시 도는 규칙에서만 생긴다.
//   - 나누기(내 두 손의 손가락을 나눠 다시 펴는 것)는 넣지 않았다.
// 친 수들(trail)은 [친 손, 맞은 손]의 차례다(0은 화면 왼쪽 손, 1은 화면 오른쪽 손). 먼저 치는 쪽부터 번갈아 적는다.
//
// 풀이 프로그램: limit과 규칙마다, 모든 자리(칠 차례인 쪽의 두 손, 상대의 두 손)에서 둘 다 잘 치면 어떻게 끝나는지를
// 끝에서부터 거꾸로 칠해 구한다(두 손이 다 빠진 자리 → 거기로 보낼 수 있는 자리는 이기는 자리 → 어디로 쳐도 이기는 자리로만 가는 자리는 지는 자리 → …).
// 끝내 칠해지지 않는 자리는 둘 다 잘 치면 끝나지 않는 자리(비기는 자리)다. 손의 왼쪽 오른쪽은 승패에 상관이 없어서 작은 수부터 적어 둔다.
// 같은 모습이 다시 나오면 비긴다는 약속을 넣어도 이 값은 그대로다:
//   이기는 쪽은 "끝까지 남은 칠 수"가 하나씩 줄어드는 수만 치면 되니 같은 모습을 다시 만나지 않고, 비기는 자리에서는 두 사람 모두 비기는 자리로만 칠 수 있다.
// 테스트에서 손의 왼쪽 오른쪽을 그대로 두고, 남은 칠 수를 하나씩 늘려 가며 앞으로 따지는 다른 방법으로 다시 구해 견준다.
import { latestById } from './level.js';
import { createRng, randInt, seedFrom } from './rng.js';

export const SIDES = ['kid', 'teacher'];

/** 손이 빠지는 손가락 수(임시). 3부터 6까지(6이면 한 손에 다섯 손가락을 다 편다) */
export const LIMITS = { min: 3, max: 6 };

/** 보통 판: 다섯이 되면 빠진다 */
export const BASE_LIMIT = 5;

/** 처음 모습: 두 사람 모두 두 손에 손가락 하나씩 */
export const START = [1, 1];

/** 끝까지 둔 게임이 이만큼 쌓이면 "왜 그럴까?"가 열린다(임시) */
export const WHY_AFTER = 2;

const whole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

/** 다른 쪽 */
export const otherSide = (side) => (side === 'kid' ? 'teacher' : 'kid');

/** 빠지지 않은 손이 있는가 */
export const alive = (hands) => hands[0] > 0 || hands[1] > 0;

/** 판으로 쓸 수 있는 값인가. 쓸 수 있으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'board';
  if (!whole(board.limit, LIMITS.min, LIMITS.max)) return 'limit';
  if (typeof board.wrap !== 'boolean') return 'wrap';
  for (const side of SIDES) {
    const hands = board[side];
    if (!Array.isArray(hands) || hands.length !== 2 || !hands.every((value) => whole(value, 0, board.limit - 1))) return 'hands';
  }
  // 두 손이 다 빠진 쪽이 있으면 이미 끝난 판이다
  if (!alive(board.kid) || !alive(board.teacher)) return 'out';
  if (board.first !== null && !SIDES.includes(board.first)) return 'first';
  return null;
}

export const copyBoard = (board) => ({ limit: board.limit, wrap: board.wrap, kid: [...board.kid], teacher: [...board.teacher], first: board.first ?? null });

/** 판을 글자로 적는다(시드와 풀이 기록의 이름에 쓴다) */
export const boardKey = (board) => `${board.limit}${board.wrap ? 'w' : 'b'}-${board.kid.join('.')}-${board.teacher.join('.')}-${board.first ?? 'choose'}`;

/** 두 사람 모두 손가락 하나씩으로 시작하는 판인가 */
export const isStart = (board) => board.kid.every((value) => value === 1) && board.teacher.every((value) => value === 1);

/**
 * 맞은 손의 손가락 수(0은 빠짐).
 * @param {number} limit 빠지는 손가락 수
 * @param {boolean} wrap 다시 도는 규칙인가
 * @param {number} target 맞은 손의 손가락 수
 * @param {number} power 친 손의 손가락 수
 */
export function addTo(limit, wrap, target, power) {
  const sum = target + power;
  if (sum < limit) return sum;
  return wrap ? sum % limit : 0;
}

/** 칠 수 있는 수들: [내 손, 상대 손](둘 다 빠지지 않은 손) */
export function movesOf(mine, theirs) {
  const list = [];
  for (let from = 0; from < 2; from++) {
    for (let to = 0; to < 2; to++) if (mine[from] > 0 && theirs[to] > 0) list.push([from, to]);
  }
  return list;
}

const isMove = (move) => Array.isArray(move) && move.length === 2 && move.every((index) => index === 0 || index === 1);

/** 같은 모습인지 가리는 이름: 칠 차례인 쪽과 네 손(왼쪽 오른쪽 그대로) */
export const positionKey = (next, kid, teacher) => `${next}:${kid.join(',')}:${teacher.join(',')}`;

// ---- 두기 ----

/**
 * 처음 모습에서 친 수들을 처음부터 다시 둔다.
 * @param {object} board
 * @param {number[][]} trail 친 수들([친 손, 맞은 손]. 먼저 치는 쪽부터 번갈아)
 * @param {'kid'|'teacher'} first 먼저 치는 쪽
 * @returns {{ok, kid, teacher, next, over, winner, repeat, moves}}
 *   ok        모두 칠 수 있는 수였는가(칠 수 없는 수를 만나면 그 앞까지의 모습이다)
 *   kid, teacher 지금 두 손의 손가락 수. next 칠 차례인 쪽(끝났으면 null)
 *   over      끝났는가. winner 'kid' | 'teacher' | 'draw'(끝나지 않았으면 null)
 *   repeat    같은 모습이 다시 나와 비겼으면, 그 모습이 처음 나온 때(친 횟수. 0은 처음 모습). 아니면 null
 *   moves     친 수들 { side, from, to, power, before, after }(power는 친 손의 손가락 수, before와 after는 맞은 손의 손가락 수)
 */
export function replay(board, trail, first = board.first) {
  const kid = [...board.kid];
  const teacher = [...board.teacher];
  const hands = { kid, teacher };
  const moves = [];
  let side = first;
  let ok = Array.isArray(trail) && SIDES.includes(side);
  let over = false;
  let winner = null;
  let repeat = null;
  const seen = new Map();
  if (ok) seen.set(positionKey(side, kid, teacher), 0);
  if (ok) {
    for (const move of trail) {
      if (over || !isMove(move)) {
        ok = false;
        break;
      }
      const [from, to] = move;
      const mine = hands[side];
      const theirs = hands[otherSide(side)];
      if (mine[from] === 0 || theirs[to] === 0) {
        ok = false;
        break;
      }
      const before = theirs[to];
      theirs[to] = addTo(board.limit, board.wrap, before, mine[from]);
      moves.push({ side, from, to, power: mine[from], before, after: theirs[to] });
      if (!alive(theirs)) {
        over = true;
        winner = side;
        side = otherSide(side);
        continue;
      }
      side = otherSide(side);
      const key = positionKey(side, kid, teacher);
      if (seen.has(key)) {
        over = true;
        winner = 'draw';
        repeat = seen.get(key);
        continue;
      }
      seen.set(key, moves.length);
    }
  }
  return { ok, kid, teacher, next: over ? null : side, over, winner, repeat, moves };
}

// ---- 풀이 프로그램 ----

const tables = new Map();

/** 작은 수부터 적은 두 손의 이름 */
const pairKey = (hands) => (hands[0] <= hands[1] ? `${hands[0]}${hands[1]}` : `${hands[1]}${hands[0]}`);
/** 자리의 이름: 칠 차례인 쪽의 두 손 | 상대의 두 손 */
const stateKey = (mine, theirs) => `${pairKey(mine)}|${pairKey(theirs)}`;

/**
 * limit과 규칙 하나의 표: 모든 자리(칠 차례인 쪽의 두 손, 상대의 두 손)에서 칠 차례인 쪽이 둘 다 잘 치면 이기는지('win'),
 * 지는지('lose'), 끝나지 않는지('draw')와, 이기거나 지는 자리면 끝까지 남은 칠 수(이기는 쪽은 가장 빨리, 지는 쪽은 가장 오래 버틴다).
 */
export function tableOf(limit, wrap) {
  const name = `${limit}${wrap ? 'w' : 'b'}`;
  if (tables.has(name)) return tables.get(name);
  const pairs = [];
  for (let a = 0; a < limit; a++) for (let b = a; b < limit; b++) pairs.push([a, b]);
  const outcome = new Map();
  const plies = new Map();
  const parents = new Map();
  const left = new Map();
  const queue = [];
  for (const mine of pairs) {
    for (const theirs of pairs) {
      const key = stateKey(mine, theirs);
      if (!alive(theirs)) continue;
      parents.set(key, parents.get(key) ?? []);
      if (!alive(mine)) {
        // 내 두 손이 다 빠졌다: 진 자리
        outcome.set(key, 'lose');
        plies.set(key, 0);
        queue.push(key);
      }
    }
  }
  for (const mine of pairs) {
    for (const theirs of pairs) {
      if (!alive(mine) || !alive(theirs)) continue;
      const key = stateKey(mine, theirs);
      const next = new Set();
      for (const [from, to] of movesOf(mine, theirs)) {
        const hit = [...theirs];
        hit[to] = addTo(limit, wrap, theirs[to], mine[from]);
        next.add(stateKey(hit, mine));
      }
      left.set(key, next.size);
      for (const child of next) parents.get(child).push(key);
    }
  }
  for (let at = 0; at < queue.length; at++) {
    const key = queue[at];
    for (const parent of parents.get(key)) {
      if (outcome.has(parent)) continue;
      if (outcome.get(key) === 'lose') {
        outcome.set(parent, 'win');
        plies.set(parent, plies.get(key) + 1);
        queue.push(parent);
      } else {
        left.set(parent, left.get(parent) - 1);
        if (left.get(parent) === 0) {
          outcome.set(parent, 'lose');
          plies.set(parent, plies.get(key) + 1);
          queue.push(parent);
        }
      }
    }
  }
  const table = { limit, wrap, outcome, plies };
  tables.set(name, table);
  return table;
}

/**
 * 한 자리의 값: 칠 차례인 쪽(mine)이 둘 다 잘 치면 어떻게 끝나는지.
 * @returns {{outcome: 'win'|'lose'|'draw', plies: number|null}} plies 끝까지 남은 칠 수(비기는 자리는 null)
 */
export function stateValue(limit, wrap, mine, theirs) {
  const table = tableOf(limit, wrap);
  const key = stateKey(mine, theirs);
  const outcome = table.outcome.get(key) ?? 'draw';
  return { outcome, plies: outcome === 'draw' ? null : table.plies.get(key) };
}

/** 이 자리에서 칠 차례인 쪽이 둘 다 잘 치면 어떻게 끝나는지(끝난 자리는 null) */
export function valueAt(board, trail, first = board.first) {
  const now = replay(board, trail, first);
  if (!now.ok || now.over) return null;
  const mine = now.next === 'kid' ? now.kid : now.teacher;
  const theirs = now.next === 'kid' ? now.teacher : now.kid;
  return { side: now.next, ...stateValue(board.limit, board.wrap, mine, theirs) };
}

/** 한쪽에서 본 끝을 다른 쪽에서 본 끝으로 */
export const flip = (outcome) => (outcome === 'win' ? 'lose' : outcome === 'lose' ? 'win' : 'draw');

/** 칠 차례인 쪽에서 본 끝을 아이 쪽에서 본 끝으로 */
export const kidView = (side, outcome) => (side === 'kid' ? outcome : flip(outcome));

/**
 * 칠 차례인 쪽이 칠 수 있는 수마다, 친 뒤에 둘 다 잘 치면 친 쪽은 어떻게 되는지.
 *   outcome  친 쪽에서 본 끝. plies 친 수까지 넣어 끝까지 남은 칠 수(비기면 null)
 *   repeat   이 수를 치면 같은 모습이 다시 나와 바로 비기는가. ends 이 수로 상대의 두 손이 다 빠지는가
 * @returns {{move: number[], outcome, plies, repeat: boolean, ends: boolean}[] | null} 끝난 판이면 null
 */
export function moveValues(board, trail, first = board.first) {
  const now = replay(board, trail, first);
  if (!now.ok || now.over) return null;
  const side = now.next;
  const mine = side === 'kid' ? now.kid : now.teacher;
  const theirs = side === 'kid' ? now.teacher : now.kid;
  return movesOf(mine, theirs).map((move) => {
    const after = replay(board, [...trail, move], first);
    if (after.over) {
      if (after.winner === 'draw') return { move, outcome: 'draw', plies: null, repeat: true, ends: false };
      return { move, outcome: 'win', plies: 1, repeat: false, ends: true };
    }
    const value = valueAt(board, [...trail, move], first);
    return { move, outcome: flip(value.outcome), plies: value.plies === null ? null : value.plies + 1, repeat: false, ends: false };
  });
}

/**
 * 판을 푼다: 아이가 먼저 칠 때와 선생님이 먼저 칠 때, 둘 다 잘 치면 아이는 어떻게 되는가.
 * @returns {{possible: true, kid, teacher, taps: {kid, teacher}, value}}
 *   kid      아이가 먼저 칠 때 아이에게서 본 끝('win' | 'draw' | 'lose'). teacher 선생님이 먼저 칠 때
 *   taps     그때 끝까지 치는 횟수(비기면 null)
 *   value    판에 먼저 칠 쪽이 정해져 있으면 그때의 끝(고르는 판이면 null)
 */
export function solve(board) {
  const when = (first) => {
    const mine = first === 'kid' ? board.kid : board.teacher;
    const theirs = first === 'kid' ? board.teacher : board.kid;
    const value = stateValue(board.limit, board.wrap, mine, theirs);
    return { outcome: kidView(first, value.outcome), plies: value.plies };
  };
  const kid = when('kid');
  const teacher = when('teacher');
  const first = board.first ?? null;
  return { possible: true, kid: kid.outcome, teacher: teacher.outcome, taps: { kid: kid.plies, teacher: teacher.plies }, value: first === null ? null : first === 'kid' ? kid.outcome : teacher.outcome };
}

/** 아이가 먼저 치면(first가 'kid') 또는 나중에 치면, 둘 다 잘 치면 아이는 어떻게 되는가 */
export const seatOutcome = (solution, first) => solution?.[first] ?? null;

// ---- 선생님(컴퓨터)과 두기 ----

/** 선생님이 치는 법(사다리에서 정한다) */
export const TEACHERS = ['easy', 'fair', 'best'];

/**
 * 컴퓨터가 치는 수([친 손, 맞은 손]). 칠 수 없으면 null.
 *   easy  내 두 손을 한 번에 다 뺄 수 있으면 그렇게 치고, 아니면 아무 수나 시드 난수로 고른다
 *   fair  이길 수 있는 자리면 best처럼 친다. 아니면 바로 다음에 지지 않는 수 가운데 아무 수나 친다
 *   best  이길 수 있으면 가장 빨리 이기는 수, 비기는 자리면 비기는 수(같은 모습이 다시 나오지 않는 수부터),
 *         지는 자리면 같은 모습이 다시 나와 비기는 수가 있으면 그 수, 없으면 가장 오래 버티는 수
 * 그래도 여럿이면 시드 난수로 고른다. 왼쪽 오른쪽만 다르고 같은 모습이 되는 수도 따로 센다.
 */
export function pickMove(board, trail, first, rng, teacher = 'best') {
  const values = moveValues(board, trail, first);
  if (!values || values.length === 0) return null;
  const choose = (list) => list[randInt(rng, 0, list.length - 1)].move;
  const ending = values.filter((item) => item.ends);
  if (teacher === 'easy') return choose(ending.length > 0 ? ending : values);
  const wins = values.filter((item) => item.outcome === 'win');
  const fastest = (list) => {
    const top = Math.min(...list.map((item) => item.plies));
    return list.filter((item) => item.plies === top);
  };
  if (wins.length > 0) return choose(fastest(wins));
  if (teacher === 'fair') {
    // 바로 다음 차례에 상대가 한 번에 끝낼 수 있는 수는 피한다(피할 수 있으면)
    const safe = values.filter((item) => item.plies !== 2 || item.outcome !== 'lose');
    return choose(safe.length > 0 ? safe : values);
  }
  const draws = values.filter((item) => item.outcome === 'draw');
  if (draws.length > 0) {
    const going = draws.filter((item) => !item.repeat);
    return choose(going.length > 0 ? going : draws);
  }
  const longest = Math.max(...values.map((item) => item.plies));
  return choose(values.filter((item) => item.plies === longest));
}

/**
 * 선생님의 다음 수. 같은 (단계, 판 번호, 먼저 치는 쪽, 치는 법, 지금까지 친 수들)이면 늘 같은 수를 친다.
 * 직접 만든 판과 작은 판은 판 번호가 없으므로 판의 모습을 시드로 쓴다.
 */
export function teacherMove(board, trail, { level = null, seed = null, first = 'kid', teacher = 'best' } = {}) {
  const now = replay(board, trail, first);
  if (!now.ok || now.over || now.next !== 'teacher') return null;
  const rng = createRng(seedFrom('fingers-move', level ?? 'make', seed ?? boardKey(board), first, teacher, trail.map((move) => move.join('')).join(',')));
  return pickMove(board, trail, first, rng, teacher);
}

const rank = { win: 2, draw: 1, lose: 0 };

/**
 * 아이가 잘 치면 갈 수 있던 끝보다 나쁜 자리로 보낸 수(이기는 자리에서 비기거나 지는 자리로, 비기는 자리에서 지는 자리로).
 * 몇 번째 수인지(1부터)의 목록이다.
 */
export function slipsOf(board, trail, first) {
  const slips = [];
  for (let index = 0; index < trail.length; index++) {
    const before = trail.slice(0, index);
    const now = replay(board, before, first);
    if (!now.ok || now.over) break;
    if (now.next !== 'kid') continue;
    const after = [...before, trail[index]];
    const then = replay(board, after, first);
    if (!then.ok) break;
    const was = valueAt(board, before, first).outcome;
    const end = then.over ? (then.winner === 'kid' ? 'win' : then.winner === 'draw' ? 'draw' : 'lose') : kidView('teacher', valueAt(board, after, first).outcome);
    if (rank[end] < rank[was]) slips.push(index + 1);
  }
  return slips;
}

// ---- 지난 기록: "왜 그럴까?"가 열리는 때, 연달아 진 판 ----

/** 끝까지 둔 게임들(오래된 것부터). 이긴 판도 진 판도 비긴 판도 들어간다. 작은 판(곁판)은 세지 않는다 */
function finishedGames(records) {
  if (!Array.isArray(records)) return [];
  return latestById(records).filter(
    (record) => record.kind === 'round' && record.format === 'fingers' && record.side !== true && record.outcome === 'solved' && SIDES.concat('draw').includes(record.winner),
  );
}

/** 끝까지 둔 게임의 수 */
export function finishedCount(records) {
  return finishedGames(records).length;
}

/** "왜 그럴까?"를 열어도 되는가: 게임을 WHY_AFTER판 끝까지 둔 뒤에 열린다(임시) */
export function whyOpen(records) {
  return finishedCount(records) >= WHY_AFTER;
}

/** 다시 도는 규칙의 게임을 한 판이라도 끝까지 두었는가("왜 그럴까?"의 뒤쪽 장이 이때만 열린다) */
export function wrapPlayed(records) {
  return finishedGames(records).some((record) => record.board?.wrap === true);
}

/** 맨 뒤에서부터 연달아 진 게임의 수. 화면에 보여 주지 않는다. 자리를 바꿔 보기를 권할 때만 쓴다 */
export function lostStreak(records) {
  const games = finishedGames(records);
  let streak = 0;
  while (streak < games.length && games[games.length - 1 - streak].winner === 'teacher') streak += 1;
  return streak;
}
