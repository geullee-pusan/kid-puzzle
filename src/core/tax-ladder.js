// 약수 세금의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 판마다 풀이 프로그램의 결과(가장 많이 가질 수 있는 합)를 붙여 내보낸다.
//
// 이 형식의 판은 수 하나(1부터 n까지의 n)로 정해져서 가짓수가 적다.
// 그래서 무작위로 뽑지 않고, 단계마다 정해 둔 차례로 돌린다. 다 돌면 다시 처음부터 돈다.
// 차례 안에서 이웃한 두 판은 늘 다르다(맨 끝과 맨 처음도 다르다). 그래서 "새 판"은 늘 다른 판이다.
import { cardsUpTo, solve } from './tax.js';

/**
 * 사다리.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'play'(카드를 가져서 합을 크게 만든다) | 'make'(아이가 직접 정한다)
 *   hint    그 단계에서 쓰는 힌트 묶음의 이름
 *   boards  판의 차례. 1부터 몇까지의 카드를 놓는지
 *
 * 1단계는 실패할 수 없다. 어떻게 가져도 끝이 나고 합이 나온다.
 * 사다리의 n은 모두 "가장 큰 카드부터 가지기"로는 가장 큰 합이 나오지 않는 판이다(테스트가 확인한다).
 * 그렇게 해서 가장 큰 합이 나오는 판은 n이 2, 3, 5일 때뿐이다(1부터 30까지 가운데).
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'play', hint: 'start', boards: [6, 8, 10] },
  { level: 2, tag: 'applied', mode: 'play', hint: 'more', boards: [12, 14, 15, 16] },
  { level: 3, tag: 'applied', mode: 'play', hint: 'more', boards: [18, 20, 21, 24] },
  { level: 4, tag: 'challenge', mode: 'play', hint: 'more', boards: [25, 26, 27, 28, 29, 30] },
  { level: 5, tag: 'challenge', mode: 'make', hint: 'more' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 4;
export const MAKE_LEVEL = 5;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~4
 * @param {number} seed 판 번호(1부터). 차례의 몇 번째 판인지를 정한다
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 가장 작은 판을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: {cards: number[]}, solution: {best: number, order: number[], total: number}}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  const shrink = small && level === LADDER[0].level;
  const count = rung.boards.length;
  const at = shrink ? 0 : (((seed - 1) % count) + count) % count;
  const board = { cards: cardsUpTo(rung.boards[at]) };
  const { best, order, total } = solve(board);
  return { level, seed, small, board, solution: { best, order, total } };
}

/** 다음 판 번호. 차례에서 이웃한 판은 늘 다르므로 그냥 다음 번호다. */
export function nextSeed(level, seed) {
  rungOf(level);
  return seed + 1;
}
