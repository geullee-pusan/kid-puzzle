// 핀에 실 감기의 판과 풀이. 순수 함수만 둔다.
// 판: 원 위에 고르게 박힌 핀 n개(맨 위 핀이 0이고 시계 방향으로 1, 2, …)와 칸 수 k.
// 실은 지금 핀에서 시계 방향으로 k칸 앞의 핀으로 간다. 처음 핀으로 돌아오면 한 가닥이 끝나고,
// 실이 지나가지 않은 핀이 남아 있으면 그 핀에서 새 실을 매어 감는다. 모든 핀에 실이 지나가면 끝난다.
// 실이 몇 가닥 필요한지와 한 가닥이 핀 몇 개를 지나는지는 실제로 감아 보아서(따라가 보기) 구한다.
// 두 수를 함께 나누는 가장 큰 수로 셈하지 않는다. 그 수와 맞는지는 테스트가 다른 방법으로 따진다.
//
// 판의 꼴: { n, k }. 표 만들기, 한 가닥으로 다 감기, 핀 12개와 13개 판은 칸 수를 아이가 바꾸므로 k가 null이다.

/** 핀 수의 범위 */
export const MIN_PINS = 4;
export const MAX_PINS = 16;

/** 짐작에 고를 수 있는 가닥 수의 위 끝(핀 16개를 8칸씩 감으면 8가닥이다) */
export const MAX_THREADS = 8;

/** 칸 수를 아이가 고르는 판에서 고를 수 있는 위 끝: 핀 수의 절반(그보다 크면 거꾸로 도는 것과 같은 모양이다) */
export const halfOf = (n) => Math.floor(n / 2);

const isInt = (value) => Number.isInteger(value);

/**
 * 판이 규격에 맞는가. 맞으면 null, 아니면 까닭(개발자용 글).
 * @param {object} board { n, k } (k는 1 이상 n-1 이하, 또는 null)
 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return '판이 없어요';
  const { n, k } = board;
  if (!isInt(n) || n < MIN_PINS || n > MAX_PINS) return `핀 수가 범위 밖이에요: ${n}`;
  if (k !== null && (!isInt(k) || k < 1 || k > n - 1)) return `칸 수가 범위 밖이에요: ${k}`;
  return null;
}

/** 지금 핀에서 k칸 앞의 핀 */
export const aheadOf = (n, k, pin) => (pin + k) % n;

/** 핀 from에서 시계 방향으로 몇 칸 앞이 핀 to인가(0~n-1) */
export const offsetOf = (n, from, to) => (((to - from) % n) + n) % n;

/**
 * 모든 핀을 감아 본다. 실이 없는 핀 가운데 가장 앞 번호의 핀에서 새 실을 맨다.
 * @returns {number[][]} 가닥마다 지나는 핀의 차례(처음 핀은 한 번만 적는다)
 */
export function threadsOf(n, k) {
  const used = Array(n).fill(false);
  const threads = [];
  for (let start = 0; start < n; start++) {
    if (used[start]) continue;
    const pins = [];
    let pin = start;
    do {
      pins.push(pin);
      used[pin] = true;
      pin = aheadOf(n, k, pin);
    } while (pin !== start);
    threads.push(pins);
  }
  return threads;
}

/** 한 번 감아 본 것은 적어 둔다 */
const counted = new Map();

/**
 * 실이 몇 가닥 필요한가(count)와 한 가닥이 핀 몇 개를 지나는가(per).
 * 가닥마다 지나는 핀 수가 모두 같은지도 함께 본다(same).
 */
export function countOf(n, k) {
  const key = `${n}:${k}`;
  if (!counted.has(key)) {
    const threads = threadsOf(n, k);
    const per = threads[0].length;
    counted.set(key, { count: threads.length, per, same: threads.every((pins) => pins.length === per) });
  }
  return counted.get(key);
}

/**
 * 아이가 누른 핀의 차례(steps)로 지금 감긴 모습을 따라간다.
 * 실이 없을 때(처음이거나 앞 가닥이 처음 핀으로 돌아왔을 때) 누른 핀은 새 실의 처음 핀이고, 실이 없는 핀이어야 한다.
 * 실이 감기는 중이면 다음 핀은 늘 k칸 앞의 핀이다. 처음 핀으로 돌아오면 그 가닥이 끝난다(처음 핀은 다시 적지 않는다).
 * @returns {{ok: boolean, threads: {pins: number[], closed: boolean}[], used: number, open: boolean, last: number|null, next: number|null, complete: boolean}}
 *   used: 실이 지나간 핀 수, open: 끝나지 않은 가닥이 있는가, last: 그 가닥의 마지막 핀, next: 그 가닥이 갈 다음 핀
 */
export function windState(n, k, steps) {
  const fail = { ok: false, threads: [], used: 0, open: false, last: null, next: null, complete: false };
  if (!Array.isArray(steps)) return fail;
  const used = Array(n).fill(false);
  const threads = [];
  let current = null;
  for (const pin of steps) {
    if (!isInt(pin) || pin < 0 || pin >= n) return fail;
    if (current === null) {
      if (used[pin]) return fail;
      current = { pins: [pin], closed: false };
      threads.push(current);
      used[pin] = true;
      continue;
    }
    if (pin !== aheadOf(n, k, current.pins.at(-1))) return fail;
    if (pin === current.pins[0]) {
      current.closed = true;
      current = null;
      continue;
    }
    if (used[pin]) return fail;
    current.pins.push(pin);
    used[pin] = true;
  }
  const count = used.filter(Boolean).length;
  const open = current !== null;
  const last = open ? current.pins.at(-1) : null;
  return { ok: true, threads, used: count, open, last, next: open ? aheadOf(n, k, last) : null, complete: !open && count === n };
}

/** 감기 단추가 다음에 누를 핀: 감기는 중이면 k칸 앞의 핀, 아니면 실이 없는 핀 가운데 맨 위에서 가장 가까운 핀. 다 감았으면 null */
export function nextPin(n, k, steps) {
  const state = windState(n, k, steps);
  if (!state.ok || state.complete) return null;
  if (state.open) return state.next;
  const used = new Set(state.threads.flatMap((thread) => thread.pins));
  for (let pin = 0; pin < n; pin++) if (!used.has(pin)) return pin;
  return null;
}

/** 처음부터 끝까지 감는 차례(감기 단추를 끝까지 누른 것과 같다) */
export function fullSteps(n, k) {
  return threadsOf(n, k).flatMap((pins) => [...pins, pins[0]]);
}

/** 칸 수를 아이가 고르는 판에서 고를 수 있는 칸 수들: 1부터 핀 수의 절반까지 */
export const choicesOf = (n) => Array.from({ length: halfOf(n) }, (_, index) => index + 1);

/** 그 핀 수에서 실 한 가닥으로 모든 핀을 감는 칸 수들(1부터 핀 수의 절반까지) */
export const oneThreadKs = (n) => choicesOf(n).filter((k) => countOf(n, k).count === 1);

/** 어느 칸 수로 감아도(1부터 절반까지) 실 한 가닥인 핀 수인가 */
export const allOne = (n) => choicesOf(n).every((k) => countOf(n, k).count === 1);

/** 여러 가닥이 필요한 칸 수 가운데 가장 작은 것. 없으면 null */
export const firstMany = (n) => choicesOf(n).find((k) => countOf(n, k).count > 1) ?? null;

/**
 * 풀이: 판의 종류마다 아이가 알아낼 것.
 *   k가 있는 판: 가닥 수와 한 가닥의 핀 수
 *   k가 없는 판: 칸 수마다의 가닥 수(표), 한 가닥으로 되는 칸 수들, 모두 한 가닥인지, 여러 가닥인 가장 작은 칸 수
 * possible은 늘 참이다(끝까지 감으면 늘 끝난다).
 */
export function solve(board) {
  const { n, k } = board;
  if (k !== null) {
    const { count, per } = countOf(n, k);
    return { possible: true, count, per };
  }
  const table = choicesOf(n).map((each) => ({ k: each, count: countOf(n, each).count, per: countOf(n, each).per }));
  return { possible: true, table, ones: oneThreadKs(n), allOne: allOne(n), firstMany: firstMany(n) };
}

export const boardKey = (board) => `${board.n}:${board.k ?? '-'}`;
export const sameBoard = (a, b) => a.n === b.n && a.k === b.k;
export const copyBoard = (board) => ({ n: board.n, k: board.k });
