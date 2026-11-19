// 자리 바꾸기의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 풀이 프로그램으로 확인한 판만 내보낸다.
//
// 이 형식의 판은 수 몇 개로 정해져서 가짓수가 적다(개구리는 양쪽 마릿수, 짝 짓기는 돌의 수).
// 그래서 무작위로 뽑지 않고, 단계마다 정해 둔 차례로 돌린다. 다 돌면 다시 처음부터 돈다.
// 차례 안에서 이웃한 두 판은 늘 다르다(맨 끝과 맨 처음도 다르다). 그래서 "새 판"은 늘 다른 판이다.
import { solve } from './swap.js';

/**
 * 사다리.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'frogs'(개구리: 맞바꾸기만 하면 된다) | 'fewest'(개구리: 가장 적은 횟수로)
 *           | 'pairs'(건너뛰어 짝 짓기. 되는 판과 안 되는 판이 섞인다)
 *           | 'carry'(둘씩 묶어 옮기기. 모두 되는 판이다. 가장 적은 횟수보다 많이 옮겼으면 "더 적게 할 수 있을까요?"라고 묻는다)
 *           | 'threes'(셋씩 쌓기. 셋을 건너뛴다. 되는 판과 안 되는 판이 섞인다) | 'make'(아이가 직접 정한다)
 *   boards  판의 차례. 개구리는 [왼쪽 수, 오른쪽 수], 짝 짓기와 셋씩 쌓기와 묶어 옮기기는 돌의 수
 *
 * 1단계는 실패할 수 없는 판(1마리와 1마리. 아무렇게나 움직여도 끝난다)에서 시작한다.
 * 좌우를 뒤집은 판([1, 2], [2, 3], [3, 4])은 차례의 뒤쪽에 섞었다.
 * 4단계는 건너뛰는 수가 2다. 되는 판(8, 10, 12개)과 안 되는 판(4, 6개)이 섞이고, 안 되는 판은 셋에 하나다(임시).
 * 처음 만나는 판은 되는 판(8개)이고, 처음 만나는 안 되는 판은 가장 작은 판(4개)이다.
 * 5단계(둘씩 묶어 옮기기)와 6단계(셋씩 쌓기)는 2026-11-20에 직접 만들기 앞에 더했다. 직접 만들기는 5단계에서 7단계로 옮겼다.
 * 5단계: 돌 6~14개. 풀이 프로그램으로 따지면 돌 8개부터는 돌 둘씩의 짝 수만큼 옮기면 되지만(4, 5, 6, 7번),
 *   이 판처럼 빈칸 둘 말고는 칸이 없으면 6개는 4번이 걸린다(4개는 안 된다). 6개 판은 셋째에 둔다(짝 수와 횟수가 맞는 판을 먼저 만난다).
 * 6단계: 셋을 건너뛰어 셋씩 쌓기. 셋씩은 셋을 건너뛸 때만 되는 판이 있고(12개, 15개), 6개와 9개는 안 된다.
 *   하나나 둘이나 넷을 건너뛰면 18개까지 되는 판이 없다. 안 되는 판은 셋에 하나이고, 처음 만나는 안 되는 판은 6개다.
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'frogs', boards: [[1, 1], [2, 1], [2, 2], [1, 2]] },
  { level: 2, tag: 'applied', mode: 'frogs', boards: [[3, 2], [3, 3], [4, 3], [2, 3], [3, 4]] },
  { level: 3, tag: 'applied', mode: 'fewest', boards: [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4], [2, 3], [3, 4]] },
  { level: 4, tag: 'challenge', mode: 'pairs', boards: [8, 4, 10, 12, 6, 10] },
  { level: 5, tag: 'applied', mode: 'carry', boards: [8, 10, 6, 12, 14] },
  { level: 6, tag: 'challenge', mode: 'threes', boards: [12, 6, 15, 12, 9, 15] },
  { level: 7, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 6;
export const MAKE_LEVEL = 7;
/** 예전(2026-11-20 전)의 직접 만들기 단계. 기기에 적어 둔 하던 판과 공책의 직접 만든 판은 이 번호를 가질 수 있다 */
export const OLD_MAKE_LEVEL = 5;

/** 4단계에서 건너뛰는 수 */
export const PAIR_SKIP = 2;
/** 6단계(셋씩 쌓기)에서 건너뛰는 수 */
export const PILE_SKIP = 3;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

function boardOf(rung, entry) {
  if (rung.mode === 'pairs') return { kind: 'pairs', n: entry, skip: PAIR_SKIP };
  if (rung.mode === 'threes') return { kind: 'pairs', n: entry, skip: PILE_SKIP, group: 3 };
  if (rung.mode === 'carry') return { kind: 'carry', n: entry };
  return { kind: 'frogs', left: entry[0], right: entry[1] };
}

/** 한 번 푼 판은 적어 둔다(셋씩 쌓기의 돌 15개 판은 모습이 40만 가지쯤이라 다시 풀지 않게). 같은 판은 늘 같은 결과다 */
const solved = new Map();
export function solveOnce(board) {
  const key = JSON.stringify(board);
  if (!solved.has(key)) solved.set(key, solve(board));
  return solved.get(key);
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~6
 * @param {number} seed 판 번호(1부터). 차례의 몇 번째 판인지를 정한다
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 가장 작은 판을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object, solution: {possible: boolean, min: number|null, moves: number[][]}}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  const shrink = small && level === LADDER[0].level;
  const count = rung.boards.length;
  const at = shrink ? 0 : (((seed - 1) % count) + count) % count;
  const board = boardOf(rung, rung.boards[at]);
  const { possible, min, moves } = solveOnce(board);
  return { level, seed, small, board, solution: { possible, min, moves } };
}

/** 다음 판 번호. 차례에서 이웃한 판은 늘 다르므로 그냥 다음 번호다. */
export function nextSeed(level, seed) {
  rungOf(level);
  return seed + 1;
}
