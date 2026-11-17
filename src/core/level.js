// 수준 맞추기. 기록 목록을 받아 "다음에 권할 것"을 돌려주는 순수 함수다.
// 형식(동전 뒤집기, 한붓그리기)마다 따로 본다. 한 형식의 기록은 다른 형식의 수준에 영향을 주지 않는다.
// 기록이 원본이다. 여기서 낸 값은 어디에도 저장하지 않고, 필요할 때마다 기록에서 다시 계산한다.
//
// 규칙(기획 문서의 표):
// - 같은 단계의 판을 연달아, 힌트 없이 한 번에, 예상 시간보다 빠르게 맞히면 → 더 어려운 판을 권한다. 고르는 것은 아이다.
// - 힌트를 다 열고도 못 풀었거나 연달아 그만두면 → 다음에는 한 단계 아래의 판(맨 아래 단계면 작은 판)을 먼저 보여 준다.
//   화면에는 내려갔다는 말이나 표시를 하지 않는다.
// - 그 밖에는 그대로 둔다.

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
    // 손댄 판: 동전을 뒤집었거나(flipCount), 선을 긋거나 그림을 고쳤거나(strokeCount, editCount), 답했거나, 힌트를 열었다
    const moves = (record.flipCount ?? 0) + (record.strokeCount ?? 0) + (record.editCount ?? 0);
    const touched = moves > 0 || (record.answers?.length ?? 0) > 0 || (record.hintsOpened ?? 0) > 0;
    return record.outcome === 'solved' || record.outcome === 'solution' || touched;
  });
}

const solved = (record) => record.outcome === 'solved';

/** 힌트 없이, 첫 답으로, 예상 시간보다 빠르게 맞혔는가 */
function fastClean(record, tuning) {
  if (!solved(record)) return false;
  if ((record.hintsOpened ?? 0) > 0) return false;
  if ((record.answers?.length ?? 0) !== 1) return false;
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
 */
export function whyUnlocked(records, format = 'coins') {
  return latestById(Array.isArray(records) ? records : []).some(
    (record) =>
      record.kind === 'round' &&
      record.format === format &&
      record.solution?.possible === false &&
      (record.outcome === 'solved' || record.outcome === 'solution'),
  );
}
