// 강 건너기: 판과 동물들, 배를 보내는 규칙, 풀이 프로그램(너비 우선 탐색), 왜 못 떠나는지 가리기, 오답 짐작.
// 순수 함수만 둔다. 화면에 손대지 않고, 무작위 수와 지금 시각을 쓰지 않는다. 같은 입력은 늘 같은 출력을 낸다.
//
// 곳(place): 왼쪽 강가 0, (섬이 있으면) 가운데 섬 1, 오른쪽 강가는 맨 끝 번호다. 모두 왼쪽 강가에서 시작해 오른쪽 강가로 건너면 끝이다.
// 배는 지금 있는 곳에서 다른 어느 곳으로든 간다(섬이 있으면 섬에 들르지 않고 건너편으로 바로 가도 된다). 탄 동물은 닿은 곳에 모두 내린다.
// (이웃한 곳으로만 가게 하면 네 쌍과 섬의 판이 26번이 된다. 바로 가도 되게 하면 16번이다. 테스트가 둘 다 확인한다.)
//
// 판은 세 가지다. 이야기는 모두 이 앱에서 새로 지었다.
// 가. 코끼리와 생쥐: { kind: 'weight', heavy, light }
//   코끼리(무게 2) heavy마리, 생쥐(무게 1) light마리. 배에는 둘까지 타고, 무게가 2를 넘으면 떠나지 않는다(생쥐 둘이나 코끼리 하나).
//   누구나 노를 젓는다.
// 나. 할머니와 동물들: { kind: 'pets', pets, seats }
//   할머니와 동물 몇(강아지, 고양이, 병아리, 생선 가운데). 할머니만 노를 젓는다. 배에는 할머니를 넣어 seats까지 탄다.
//   할머니가 없는 곳에 싸우거나 잡아먹는 짝(FIGHTS)이 함께 있으면 안 된다.
// 다. 엄마와 아기: { kind: 'pairs', pairs, seats, island }
//   동물 엄마와 아기가 pairs쌍(곰, 토끼, 오리, 돼지, 양의 차례). 누구나 노를 젓는다. 배에는 seats까지 탄다.
//   아기는 낯을 가린다: 자기 엄마가 없는 곳(배 위도 같다)에 다른 엄마가 있으면 안 된다. island면 가운데에 섬이 있다.
//
// 모습(state): { at, boat }. at[번호]는 그 동물이 있는 곳, boat는 배가 있는 곳이다.
// 움직임(move): { who, to }. who는 배에 탄 동물의 번호들(작은 것부터), to는 배가 가는 곳이다.
// 지나온 길(trail)은 움직임의 목록이다.

export const KINDS = ['weight', 'pets', 'pairs'];
/** 할머니와 함께 건너는 동물의 차례 */
export const PETS = ['dog', 'cat', 'chick', 'fish'];
/** 할머니가 없는 곳에 함께 두면 안 되는 짝: 강아지와 고양이는 싸우고, 고양이는 생선을 먹고 병아리를 쫓고, 강아지도 병아리를 쫓는다 */
export const FIGHTS = [
  ['dog', 'cat'],
  ['cat', 'fish'],
  ['cat', 'chick'],
  ['dog', 'chick'],
];
/** 엄마와 아기 쌍의 동물(쌍의 차례) */
export const ANIMALS = ['bear', 'rabbit', 'duck', 'pig', 'sheep'];
/** 코끼리와 생쥐의 무게와 배 */
export const WEIGHTS = { heavy: 2, light: 1 };
export const WEIGHT_LIMIT = 2;
export const WEIGHT_SEATS = 2;
/** 판에 놓을 수 있는 수의 범위 */
export const RANGES = {
  heavy: [1, 3],
  light: [1, 4],
  petSeats: [2, 3],
  pairs: [2, 5],
  pairSeats: [2, 4],
  /** 섬이 있는 판: 배는 둘이 탄다(셋이 타면 섬이 없어도 다섯 쌍까지 건넌다) */
  islandSeats: 2,
};

const within = (value, [low, high]) => Number.isInteger(value) && value >= low && value <= high;

/** 판이 규격에 맞는지 본다. 맞으면 null, 아니면 무엇이 틀렸는지 알리는 열쇠 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  if (board.kind === 'weight') {
    if (!within(board.heavy, RANGES.heavy) || !within(board.light, RANGES.light)) return 'bad-count';
    return null;
  }
  if (board.kind === 'pets') {
    const { pets } = board;
    if (!Array.isArray(pets) || pets.length === 0) return 'bad-pets';
    // 정해진 차례대로, 겹치지 않게 적는다(같은 판은 늘 같은 글자로 적힌다).
    const order = pets.map((pet) => PETS.indexOf(pet));
    if (order.some((at) => at < 0) || order.some((at, index) => index > 0 && at <= order[index - 1])) return 'bad-pets';
    if (!within(board.seats, RANGES.petSeats)) return 'bad-seats';
    return null;
  }
  if (board.kind === 'pairs') {
    if (typeof board.island !== 'boolean') return 'bad-island';
    if (!within(board.pairs, RANGES.pairs)) return 'bad-count';
    if (!within(board.seats, RANGES.pairSeats)) return 'bad-seats';
    if (board.island && board.seats > RANGES.islandSeats) return 'bad-seats';
    return null;
  }
  return 'bad-kind';
}

/** 판을 같은 꼴로 베낀다(기록과 저장에 쓴다) */
export function copyBoard(board) {
  if (board.kind === 'weight') return { kind: 'weight', heavy: board.heavy, light: board.light };
  if (board.kind === 'pets') return { kind: 'pets', pets: board.pets.slice(), seats: board.seats };
  return { kind: 'pairs', pairs: board.pairs, seats: board.seats, island: board.island };
}

/**
 * 판의 동물들. 번호는 이 목록의 차례다.
 *   kind   그림의 이름: 'elephant' | 'mouse' | 'grandma' | 강아지 따위(PETS) | 곰 따위(ANIMALS)
 *   role   'heavy' | 'light' | 'grandma' | 'pet' | 'mother' | 'baby'
 *   weight 무게(코끼리와 생쥐 판에서만 쓴다), rower 노를 저을 수 있는가, pair 쌍의 번호(엄마와 아기 판)
 * 엄마와 아기 판은 쌍마다 엄마, 아기의 차례다(쌍 i의 엄마는 2i번, 아기는 2i + 1번).
 */
export function castOf(board) {
  // 풀이 프로그램이 모습마다 부르므로 한 번 만든 목록은 적어 둔다(같은 판은 늘 같은 목록이다).
  const key = JSON.stringify(board);
  if (!castMemo.has(key)) castMemo.set(key, Object.freeze(makeCast(board).map((item) => Object.freeze(item))));
  return castMemo.get(key);
}
const castMemo = new Map();

function makeCast(board) {
  if (board.kind === 'weight') {
    return [
      ...Array.from({ length: board.heavy }, () => ({ kind: 'elephant', role: 'heavy', weight: WEIGHTS.heavy, rower: true, pair: null })),
      ...Array.from({ length: board.light }, () => ({ kind: 'mouse', role: 'light', weight: WEIGHTS.light, rower: true, pair: null })),
    ];
  }
  if (board.kind === 'pets') {
    return [{ kind: 'grandma', role: 'grandma', weight: 1, rower: true, pair: null }, ...board.pets.map((pet) => ({ kind: pet, role: 'pet', weight: 1, rower: false, pair: null }))];
  }
  const cast = [];
  for (let pair = 0; pair < board.pairs; pair++) {
    cast.push({ kind: ANIMALS[pair], role: 'mother', weight: 1, rower: true, pair });
    cast.push({ kind: ANIMALS[pair], role: 'baby', weight: 1, rower: true, pair });
  }
  return cast;
}

/** 곳의 수: 섬이 있으면 셋, 없으면 둘 */
export const placesOf = (board) => (board.kind === 'pairs' && board.island ? 3 : 2);
/** 오른쪽 강가(건너갈 곳)의 번호 */
export const farOf = (board) => placesOf(board) - 1;

/** 배: 탈 수 있는 수와 무게의 위 끝(없으면 null) */
export function boatOf(board) {
  if (board.kind === 'weight') return { seats: WEIGHT_SEATS, limit: WEIGHT_LIMIT };
  return { seats: board.seats, limit: null };
}

export function startState(board) {
  return { at: Array(castOf(board).length).fill(0), boat: 0 };
}

export const stateKey = (state) => `${state.at.join('')}:${state.boat}`;

/** 모두 오른쪽 강가에 닿았는가 */
export function isDone(board, state) {
  const far = farOf(board);
  return state.at.every((place) => place === far);
}

/**
 * 한 곳(강가, 섬, 배 위)에 함께 있는 동물들이 괜찮은가. 괜찮으면 null.
 * @returns {null | {kind: string, who: number[]}}
 *   kind  할머니와 동물들: 짝의 이름('dog-cat' 따위). 엄마와 아기: 'baby'
 *   who   함께 있으면 안 되는 둘(판에서 보여 준다). 아기는 자기 엄마 없이 함께 있게 되는 다른 엄마와 함께 적는다
 */
export function clashOf(board, ids) {
  if (board.kind === 'weight') return null;
  const cast = castOf(board);
  if (board.kind === 'pets') {
    if (ids.some((id) => cast[id].role === 'grandma')) return null;
    for (const [a, b] of FIGHTS) {
      const first = ids.find((id) => cast[id].kind === a);
      const second = ids.find((id) => cast[id].kind === b);
      if (first !== undefined && second !== undefined) return { kind: `${a}-${b}`, who: [first, second].sort((x, y) => x - y) };
    }
    return null;
  }
  const mothers = ids.filter((id) => cast[id].role === 'mother');
  if (mothers.length === 0) return null;
  for (const id of ids) {
    if (cast[id].role !== 'baby') continue;
    if (mothers.some((mother) => cast[mother].pair === cast[id].pair)) continue;
    return { kind: 'baby', who: [id, mothers[0]].sort((x, y) => x - y) };
  }
  return null;
}

const idsAt = (state, place) => state.at.flatMap((at, id) => (at === place ? [id] : []));

/**
 * 배를 보낼 수 있는지 본다. 보낼 수 있으면 null.
 * @returns {null | {reason: string, where?: string, place?: number, kind?: string, who: number[]}}
 *   reason  'empty'(아무도 안 탔다) | 'far'(배가 없는 곳의 동물이다) | 'way'(없는 곳이거나 배가 지금 있는 곳이다) | 'seats'(자리보다 많다)
 *           | 'rower'(노를 저을 동물이 없다) | 'heavy'(너무 무겁다) | 'clash'(함께 있으면 안 되는 동물이 함께 있게 된다)
 *   where   'boat'(배 위) | 'stay'(떠나는 곳에 남는 동물들) | 'land'(닿는 곳에 내린 뒤)
 *   place   그 일이 생기는 곳, kind 짝의 이름(clashOf와 같다), who 판에서 보여 줄 동물들
 */
export function checkMove(board, state, who, to) {
  const cast = castOf(board);
  const group = [...new Set(who)].sort((a, b) => a - b);
  if (group.length === 0) return { reason: 'empty', who: [] };
  if (group.some((id) => !Number.isInteger(id) || id < 0 || id >= cast.length)) return { reason: 'far', who: [] };
  const away = group.filter((id) => state.at[id] !== state.boat);
  if (away.length > 0) return { reason: 'far', who: away };
  if (!Number.isInteger(to) || to < 0 || to >= placesOf(board) || to === state.boat) return { reason: 'way', who: [] };
  const boat = boatOf(board);
  if (group.length > boat.seats) return { reason: 'seats', who: group };
  if (!group.some((id) => cast[id].rower)) return { reason: 'rower', who: group };
  if (boat.limit !== null && group.reduce((sum, id) => sum + cast[id].weight, 0) > boat.limit) return { reason: 'heavy', who: group };
  const onBoat = clashOf(board, group);
  if (onBoat) return { reason: 'clash', where: 'boat', place: state.boat, ...onBoat };
  const stay = clashOf(
    board,
    idsAt(state, state.boat).filter((id) => !group.includes(id)),
  );
  if (stay) return { reason: 'clash', where: 'stay', place: state.boat, ...stay };
  const land = clashOf(board, [...idsAt(state, to), ...group].sort((a, b) => a - b));
  if (land) return { reason: 'clash', where: 'land', place: to, ...land };
  return null;
}

/** 움직임 하나를 한 뒤의 모습 */
export function applyMove(state, move) {
  const at = state.at.slice();
  for (const id of move.who) at[id] = move.to;
  return { at, boat: move.to };
}

/** 고를 수 있는 묶음(크기 1~size)을 모두 낸다. 작은 번호부터 */
function groupsOf(ids, size) {
  const found = [];
  const pick = (start, chosen) => {
    if (chosen.length > 0) found.push(chosen.slice());
    if (chosen.length === size) return;
    for (let index = start; index < ids.length; index++) {
      chosen.push(ids[index]);
      pick(index + 1, chosen);
      chosen.pop();
    }
  };
  pick(0, []);
  return found;
}

/** 지금 모습에서 할 수 있는 움직임 모두 */
export function movesOf(board, state) {
  const { seats } = boatOf(board);
  const here = idsAt(state, state.boat);
  const moves = [];
  for (let to = 0; to < placesOf(board); to++) {
    if (to === state.boat) continue;
    for (const who of groupsOf(here, seats)) if (checkMove(board, state, who, to) === null) moves.push({ who, to });
  }
  return moves;
}

/**
 * 지나온 길을 처음부터 따라가 본다.
 * @returns {{ok: boolean, state: {at: number[], boat: number}}} ok는 길의 모든 움직임이 규칙에 맞는가
 */
export function replay(board, trail) {
  let state = startState(board);
  if (!Array.isArray(trail)) return { ok: false, state };
  for (const move of trail) {
    if (!move || !Array.isArray(move.who) || checkMove(board, state, move.who, move.to) !== null) return { ok: false, state };
    if (move.who.some((id, index) => index > 0 && id <= move.who[index - 1])) return { ok: false, state };
    state = applyMove(state, move);
  }
  return { ok: true, state };
}

/**
 * 풀이 프로그램. 처음 모습에서 갈 수 있는 모든 모습을 너비 우선으로 따져, 모두 건널 수 있는지와 배를 가장 적게 보내는 횟수를 구한다.
 * @returns {{possible: boolean, min: number|null, moves: {who: number[], to: number}[], states: number}}
 *   moves   가장 짧은 풀이 하나. 안 되는 판이면 빈 목록
 *   states  처음 모습에서 갈 수 있는 모습의 수(안 되는 판이면 모두, 되는 판이면 끝에 닿을 때까지 본 것)
 */
export function solve(board) {
  const start = startState(board);
  const came = new Map([[stateKey(start), null]]);
  let layer = [start];
  let found = isDone(board, start) ? start : null;
  while (found === null && layer.length > 0) {
    const next = [];
    for (const state of layer) {
      for (const move of movesOf(board, state)) {
        const after = applyMove(state, move);
        const key = stateKey(after);
        if (came.has(key)) continue;
        came.set(key, { before: state, move });
        if (found === null && isDone(board, after)) found = after;
        next.push(after);
      }
    }
    layer = next;
  }
  if (found === null) return { possible: false, min: null, moves: [], states: came.size };
  const moves = [];
  for (let step = came.get(stateKey(found)); step; step = came.get(stateKey(step.before))) moves.unshift(step.move);
  return { possible: true, min: moves.length, moves, states: came.size };
}

/** 처음 모습에서 갈 수 있는 모습을 모두 센다(안 되는 판이 얼마나 넓은지 본다) */
export function reachable(board) {
  const start = startState(board);
  const seen = new Set([stateKey(start)]);
  const stack = [start];
  while (stack.length > 0) {
    const state = stack.pop();
    for (const move of movesOf(board, state)) {
      const after = applyMove(state, move);
      const key = stateKey(after);
      if (seen.has(key)) continue;
      seen.add(key);
      stack.push(after);
    }
  }
  return seen.size;
}

/**
 * "불가능해요"라고 답했을 때의 판정과 짐작.
 * @param {{possible: boolean}} solution 풀이 프로그램의 결과
 * @param {{moves?: number, firsts?: string[]}} tried 해 본 것: 배를 보낸 횟수, 처음 모습에서 맨 먼저 보내 본 묶음들
 * @returns {{correct: boolean, guess: string|null}}
 *   guess  'impossible-no-try'      배를 보내 보지 않고 답했다
 *          'impossible-same-first'  처음에 늘 같은 동물들을 보냈다
 *          'impossible-other-way'   해 보지 않은 길이 남아 있다
 */
export function diagnoseImpossible(solution, tried = {}) {
  if (!solution.possible) return { correct: true, guess: null };
  if ((tried.moves ?? 0) === 0) return { correct: false, guess: 'impossible-no-try' };
  if ((tried.firsts?.length ?? 0) <= 1) return { correct: false, guess: 'impossible-same-first' };
  return { correct: false, guess: 'impossible-other-way' };
}
