// 수준 맞추기. 기록 목록을 받아 "다음에 권할 것"을 돌려주는 순수 함수다.
// 형식(동전 뒤집기, 한붓그리기, 숫자 추리, 자리 바꾸기)마다 따로 본다. 한 형식의 기록은 다른 형식의 수준에 영향을 주지 않는다.
// 기록이 원본이다. 여기서 낸 값은 어디에도 저장하지 않고, 필요할 때마다 기록에서 다시 계산한다.
//
// 규칙(기획 문서의 표):
// - 같은 단계의 판을 연달아, 힌트 없이 한 번에, 예상 시간보다 빠르게 맞히면 → 더 어려운 판을 권한다. 고르는 것은 아이다.
// - 힌트를 다 열고도 못 풀었거나 연달아 그만두면 → 다음에는 한 단계 아래의 판(맨 아래 단계면 작은 판)을 먼저 보여 준다.
//   화면에는 내려갔다는 말이나 표시를 하지 않는다.
// - 그 밖에는 그대로 둔다.
// - 게임 판(추측을 내고 답을 듣는 숫자 추리의 판)은 "빠르게 한 번에"의 기준이 다르다. 걸린 시간이 아니라 추측 횟수가 적은 것을 본다.

/**
 * 아래 숫자는 모두 임시값이다. 재 본 값이 아니다. 기록을 보고 고친다.
 * 형식마다 값을 따로 둔다(formats). 맨 위에 적힌 값은 동전 뒤집기의 값이고,
 * 형식에 따로 적지 않은 값은 맨 위의 값을 쓴다.
 */
export const TUNING = {
  /** 처음 보여 줄 단계(임시) */
  startLevel: 2,
  /** 판을 만들어 내는 단계의 아래 끝과 위 끝 */
  bottomLevel: 1,
  topLevel: 5,
  /** 연달아 몇 판을 빠르게 한 번에 맞히면 더 어려운 판을 권하는가(임시) */
  fastStreak: 2,
  /** 연달아 몇 판을 그만두면 더 쉬운 판을 먼저 보여 주는가(임시) */
  quitStreak: 2,
  /** 한 판에 있는 힌트의 수. "힌트를 다 열었다"를 가리는 데 쓴다 */
  hintCount: 2,
  /** 단계별 예상 시간(초, 임시). 이보다 빨리 맞히면 "빠르게"로 본다. 화면에는 보여 주지 않는다 */
  expectedSeconds: { 1: 45, 2: 75, 3: 120, 4: 180, 5: 180 },
  /** 형식마다 따로 두는 값(모두 임시) */
  formats: {
    /** 동전 뒤집기: 맨 위의 값을 그대로 쓴다 */
    coins: {},
    /**
     * 한붓그리기(모두 임시). 처음 보여 줄 단계는 1단계다(규칙을 스스로 찾는 재미가 거기에 있다).
     * 그림을 만들어 내는 단계는 1~4단계다. 힌트는 질문 두 개이고, "점마다 선의 수 보기"도 힌트 하나로 센다.
     */
    trace: {
      startLevel: 1,
      bottomLevel: 1,
      topLevel: 4,
      hintCount: 2,
      expectedSeconds: { 1: 60, 2: 40, 3: 60, 4: 120 },
    },
    /**
     * 숫자 추리(모두 임시). 처음 보여 줄 단계는 2단계다. 판을 만들어 내는 단계는 1~5단계다.
     * 힌트는 질문 두 개이고, "남은 후보 수 보기"도 힌트 하나로 센다.
     * fastGuesses: 추측을 내서 알아내는 판(1~3단계)에서 "빠르게"로 보는 추측 횟수의 위 끝.
     *   남은 후보 가운데 아무것이나 내는 컴퓨터의 평균(3.7번, 5.2번, 5.5번)쯤으로 잡았다. 이 단계들은 시간을 보지 않는다.
     * expectedSeconds: 4단계(표만 보고 알아내기)와 5단계(역할 바꾸기)에서만 쓴다. 1~3단계의 값은 쓰이지 않는 자리 채움이다.
     * whyAfter: 'finished'면 이 형식의 판을 한 번 끝까지 한 뒤에 "왜 그럴까?"가 열린다(안 되는 판이 없는 형식이다).
     */
    code: {
      startLevel: 2,
      bottomLevel: 1,
      topLevel: 5,
      hintCount: 2,
      expectedSeconds: { 1: 180, 2: 240, 3: 360, 4: 240, 5: 240 },
      fastGuesses: { 1: 4, 2: 5, 3: 6 },
      whyAfter: 'finished',
    },
    /**
     * 자리 바꾸기(모두 임시). 처음 보여 줄 단계는 1단계다(실패할 수 없는 작은 판에서 시작한다).
     * 판을 내는 단계는 1~4단계다. 힌트는 질문 두 개다.
     * 개구리 판(1~3단계)은 기록의 wrongCount에 무르기와 되돌리기를 더한 수를 적는다.
     *   그래서 무르기 없이 끝낸 판이 "한 번에"다. 4단계(짝 짓기)는 첫 답으로 맞혔는지를 본다.
     * expectedSeconds: 재 본 값이 아니다. 가장 적은 횟수(3~24번)를 보고 넉넉하게 잡았다.
     * whyAfter: 'fewest'면 가장 적은 횟수로 한 판을 끝낸 뒤에(기록의 fewest가 true) "왜 그럴까?"가 열린다.
     */
    swap: {
      startLevel: 1,
      bottomLevel: 1,
      topLevel: 4,
      hintCount: 2,
      expectedSeconds: { 1: 60, 2: 180, 3: 240, 4: 240 },
      whyAfter: 'fewest',
    },
  },
};

/** 그 형식에 쓸 값. 형식에 따로 적은 값이 맨 위의 값을 덮는다. */
export function tuningFor(format, tuning = TUNING) {
  return { ...tuning, ...(tuning.formats?.[format] ?? {}) };
}

/** 같은 판(id)의 기록이 여러 번 남았으면 맨 뒤의 것만 남긴다. 순서는 처음 나온 자리를 따른다. */
export function latestById(records) {
  const byId = new Map();
  const order = [];
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const id = record.id ?? `no-id-${order.length}`;
    if (!byId.has(id)) order.push(id);
    byId.set(id, record);
  }
  return order.map((id) => byId.get(id));
}

/** 수준을 따질 때 보는 판: 이 형식의, 만들어 낸 판. 들여다보기만 하고 나간 판은 뺀다. */
function playedRounds(records, format, tuning) {
  return latestById(records).filter((record) => {
    if (record.kind !== 'round' || record.format !== format || record.custom) return false;
    if (!Number.isInteger(record.level) || record.level < tuning.bottomLevel || record.level > tuning.topLevel) return false;
    // 손댄 판: 동전을 뒤집었거나(flipCount), 선을 긋거나 그림을 고쳤거나(strokeCount, editCount),
    // 추측을 냈거나 들었거나(guessCount), 말을 움직였거나(moveCount), 답했거나, 힌트를 열었다
    const moves = (record.flipCount ?? 0) + (record.strokeCount ?? 0) + (record.editCount ?? 0) + (record.guessCount ?? 0) + (record.moveCount ?? 0);
    const touched = moves > 0 || (record.answers?.length ?? 0) > 0 || (record.hintsOpened ?? 0) > 0;
    return record.outcome === 'solved' || record.outcome === 'solution' || touched;
  });
}

const solved = (record) => record.outcome === 'solved';

/**
 * 힌트 없이, 첫 답으로, 예상 시간보다 빠르게 맞혔는가.
 * 게임 판(그 단계에 fastGuesses가 적혀 있다)은 힌트 없이, 적은 추측으로 알아냈는가를 본다.
 */
function fastClean(record, tuning) {
  if (!solved(record)) return false;
  if ((record.hintsOpened ?? 0) > 0) return false;
  const fewGuesses = tuning.fastGuesses?.[record.level];
  if (typeof fewGuesses === 'number') return Number.isInteger(record.guessCount) && record.guessCount >= 1 && record.guessCount <= fewGuesses;
  // 답을 여러 번 주고받는 판(역할 바꾸기)은 틀린 답의 수(wrongCount)를 적어 둔다. 적혀 있으면 그것이 0이어야 "한 번에"다.
  if (Number.isInteger(record.wrongCount)) {
    if (record.wrongCount !== 0) return false;
  } else if ((record.answers?.length ?? 0) !== 1) return false;
  const limit = tuning.expectedSeconds[record.level];
  return typeof record.seconds === 'number' && typeof limit === 'number' && record.seconds < limit;
}

/**
 * 다음에 권할 것.
 * @param {object[]} records 기록 목록(오래된 것부터)
 * @param {string} format 퍼즐 형식
 * @returns {{level: number, small: boolean, offerHarder: boolean, harderLevel: number|null, reason: string}}
 *   level        먼저 보여 줄 단계. 잠그지 않는다. 아이는 어느 단계든 고를 수 있다
 *   small        true면 그 단계에서 작은 판(동전이나 점이 적은 판)을 먼저 보여 준다
 *   offerHarder  true면 "더 어려운 판도 있어요"라고 권한다
 *   harderLevel  권할 때 가리킬 단계(맨 위 단계에서는 그 위의 직접 만들기)
 *   reason       'start' | 'steady' | 'fast' | 'stuck' | 'quit'. 기록과 테스트용이다. 화면에 쓰지 않는다
 */
export function recommend(records, format = 'coins', allTuning = TUNING) {
  const tuning = tuningFor(format, allTuning);
  const rounds = playedRounds(Array.isArray(records) ? records : [], format, tuning);
  const steady = (level, reason) => ({ level, small: false, offerHarder: false, harderLevel: null, reason });
  if (rounds.length === 0) return steady(tuning.startLevel, 'start');

  const last = rounds.at(-1);
  const level = last.level;

  // 내려가기: 힌트를 다 열고도 못 풀었거나, 연달아 그만두었다.
  const stuck = !solved(last) && (last.hintsOpened ?? 0) >= tuning.hintCount;
  const lastFew = rounds.slice(-tuning.quitStreak);
  const quit = lastFew.length === tuning.quitStreak && lastFew.every((record) => !solved(record));
  if (stuck || quit) {
    const reason = stuck ? 'stuck' : 'quit';
    if (level > tuning.bottomLevel) return { ...steady(level - 1, reason) };
    return { ...steady(level, reason), small: true };
  }

  // 올라가기 권하기: 같은 단계를 연달아 빠르게, 힌트 없이, 한 번에 맞혔다.
  const streak = rounds.slice(-tuning.fastStreak);
  const fast = streak.length === tuning.fastStreak && streak.every((record) => record.level === level && fastClean(record, tuning));
  if (fast) return { level, small: false, offerHarder: true, harderLevel: level + 1, reason: 'fast' };

  return steady(level, 'steady');
}

/**
 * "왜 그럴까?"를 열어도 되는가. 이 형식에서 안 되는 판을 한 번 이상 만나고,
 * 그 판이 안 되는 판이라는 것을 알게 된 뒤에 열린다(임시 규칙).
 * 안 되는 판이 없는 형식(whyAfter가 'finished')은 판을 한 번 끝까지 한 뒤에 열린다.
 * 더 좋은 답을 찾는 형식(whyAfter가 'fewest')은 가장 적은 횟수로 한 판을 끝낸 뒤에 열린다.
 */
export function whyUnlocked(records, format = 'coins', allTuning = TUNING) {
  const after = tuningFor(format, allTuning).whyAfter;
  const opens = (record) => {
    if (after === 'fewest') return record.fewest === true && record.outcome === 'solved';
    return (after === 'finished' || record.solution?.possible === false) && (record.outcome === 'solved' || record.outcome === 'solution');
  };
  return latestById(Array.isArray(records) ? records : []).some((record) => record.kind === 'round' && record.format === format && opens(record));
}
