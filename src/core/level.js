// 수준 맞추기. 기록 목록을 받아 "다음에 권할 것"을 돌려주는 순수 함수다.
// 형식(동전 뒤집기, 한붓그리기, 숫자 추리, 자리 바꾸기, 조각 덮기, 누가 이길까, 약수 세금, 참말 섬, 조각 못 들어가게 막기, 강 건너기, 컵 뒤집기와 세 색 무리, 민들레와 바람, 주사위 미로와 길 세기, 숨은 규칙 찾기)마다 따로 본다. 한 형식의 기록은 다른 형식의 수준에 영향을 주지 않는다.
// 기록이 원본이다. 여기서 낸 값은 어디에도 저장하지 않고, 필요할 때마다 기록에서 다시 계산한다.
//
// 규칙(기획 문서의 표):
// - 같은 단계의 판을 연달아, 힌트 없이 한 번에, 예상 시간보다 빠르게 맞히면 → 더 어려운 판을 권한다. 고르는 것은 아이다.
// - 힌트를 다 열고도 못 풀었거나 연달아 그만두면 → 다음에는 한 단계 아래의 판(맨 아래 단계면 작은 판)을 먼저 보여 준다.
//   화면에는 내려갔다는 말이나 표시를 하지 않는다.
// - 그 밖에는 그대로 둔다.
// - 게임 판(추측을 내고 답을 듣는 숫자 추리의 판)은 "빠르게 한 번에"의 기준이 다르다. 걸린 시간이 아니라 추측 횟수가 적은 것을 본다.
// - 선생님과 번갈아 두는 판(누가 이길까)도 기준이 다르다. 이기는 쪽을 스스로 고르고 그 판을 이긴 것을 본다.
//   끝까지 두고 진 판은 그만둔 판이 아니다. 연달아 져도 내려가지 않는다(지는 것은 발견의 재료다).
// - 더 좋은 답을 찾는 판(약수 세금, 조각 못 들어가게 막기)도 기준이 다르다. 다시 해 보기 몇 번 안에 가장 좋은 답에 닿은 것을 본다.
//   "여기까지 할래요"로 끝낸 판은 그만둔 판이 아니다(끝까지 한 판이다). 하다가 나간 판만 그만둔 판이다.
// - 작은 판("더 작은 판으로"로 연 곁판. 기록의 side가 true)은 세지 않는다. 원래 판을 돕는 판이라서 수준도, "왜 그럴까?"가 열리는 때도 바꾸지 않는다.

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
  /**
   * 한 판에 있는 힌트의 수. "힌트를 다 열었다"를 가리는 데 쓴다.
   * 기록의 hintsOpened는 연 질문 힌트의 수에, 형식의 도구 단추를 쓴 것과 "더 작은 판으로"를 연 것을 하나씩 더한 수다.
   * "막혔어요"에서 규칙을 다시 본 것은 세지 않는다.
   */
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
    /**
     * 조각 덮기(모두 임시). 처음 보여 줄 단계는 1단계다(늘 되는 작은 판을 덮기만 하면 된다).
     * 판을 내는 단계는 1~4단계다. 힌트는 질문 두 개이고, "판에 무늬 입히기"도 힌트 하나로 센다.
     * 첫 답으로 맞혔는지를 본다(되는 판은 다 덮은 것이, 안 되는 판은 "불가능해요"가 답이다).
     * expectedSeconds: 재 본 값이 아니다. 놓는 조각의 수(7~21개)를 보고 넉넉하게 잡았다.
     * "왜 그럴까?"는 이 형식의 안 되는 판을 한 번 끝까지 만난 뒤에 열리고, 조각마다 따로 연다(src/core/tile.js의 whyOpen).
     */
    tile: {
      startLevel: 1,
      bottomLevel: 1,
      topLevel: 4,
      hintCount: 2,
      expectedSeconds: { 1: 90, 2: 180, 3: 300, 4: 240 },
    },
    /**
     * 누가 이길까(모두 임시). 처음 보여 줄 단계는 1단계다(맨 첫 판은 어떻게 두어도 아이가 마지막 수를 둔다).
     * 판을 내는 단계는 1~4단계다. 힌트는 질문 두 개다.
     * fastWin: true면 "한 번에 빠르게"를 걸린 시간으로 보지 않는다.
     *   먼저 둘지 나중에 둘지를 스스로 골랐고(chose), 그것이 잘 두면 이기는 쪽이었고(choseWinner), 그 판을 이겼으면(winner가 kid) 그렇게 본다.
     *   고르기가 없는 맨 첫 판과 자리를 바꿔서 다시 둔 판은 넣지 않는다.
     * 끝까지 둔 판은 이겼든 졌든 outcome이 solved다. 그래서 연달아 진 것만으로는 내려가지 않고, 연달아 그만두면 내려간다.
     * expectedSeconds: 쓰이지 않는 자리 채움이다.
     * whyAfter: 'finished'면 이 형식의 판을 한 번 끝까지 둔 뒤에 틀이 "왜 그럴까?"를 막지 않는다.
     *   게임마다의 문은 이 형식이 따로 본다(그 게임을 세 판 끝까지 둔 뒤. src/core/duel.js의 whyOpen).
     */
    duel: {
      startLevel: 1,
      bottomLevel: 1,
      topLevel: 4,
      hintCount: 2,
      expectedSeconds: { 1: 120, 2: 180, 3: 180, 4: 240 },
      fastWin: true,
      whyAfter: 'finished',
    },
    /**
     * 약수 세금(모두 임시). 처음 보여 줄 단계는 1단계다(어떻게 가져도 끝이 나고 합이 나온다. 실패할 수 없다).
     * 판을 내는 단계는 1~4단계다. 힌트는 질문 두 개이고, "카드마다 낼 세금 보기"도 힌트 하나로 센다.
     * fastRetries: 이 수가 적혀 있으면 "한 번에 빠르게"를 걸린 시간으로 보지 않는다.
     *   힌트 없이, 다시 해 보기 이만큼 안에(기록의 retries) 가장 큰 합에 닿았으면(reachedBest) 그렇게 본다.
     * "여기까지 할래요"로 끝낸 판은 outcome이 solved다. 그래서 그만둔 판으로 세지 않는다. 하다가 나간 판만 그만둔 판이다.
     * expectedSeconds: 쓰이지 않는 자리 채움이다.
     * whyAfter: 'best'면 이 형식의 만들어 낸 판을 가장 큰 합으로 한 번 끝낸 뒤에(기록의 reachedBest가 true) "왜 그럴까?"가 열린다.
     */
    tax: {
      startLevel: 1,
      bottomLevel: 1,
      topLevel: 4,
      hintCount: 2,
      expectedSeconds: { 1: 120, 2: 240, 3: 300, 4: 360 },
      fastRetries: 2,
      whyAfter: 'best',
    },
    /**
     * 참말 섬(모두 임시). 처음 보여 줄 단계는 1단계다(주민 둘, "따라가 보기"가 처음부터 켜져 있어 실패할 수 없다).
     * 판을 만들어 내는 단계는 1~4단계다(5단계 질문 고르기는 2026-11 화면 글 점검에서 뺐다). 힌트는 질문 두 개이고, "따라가 보기 켜기"도 힌트 하나로 센다(1단계처럼 처음부터 켜진 판은 세지 않는다).
     * 첫 답으로(wrongCount가 0), 예상 시간보다 빠르게 맞히면 "한 번에 빠르게"로 본다.
     * expectedSeconds: 재 본 값이 아니다. 말의 수(1~5개)를 보고 넉넉하게 잡았다.
     * whyAfter: 'rounds'면 이 형식의 판을 whyRounds판 끝까지 한 뒤에(맞혔거나 풀이를 보았거나) "왜 그럴까?"가 열린다.
     */
    logic: {
      startLevel: 1,
      bottomLevel: 1,
      topLevel: 4,
      hintCount: 2,
      expectedSeconds: { 1: 60, 2: 120, 3: 180, 4: 240 },
      whyAfter: 'rounds',
      whyRounds: 3,
    },
    /**
     * 조각 못 들어가게 막기(모두 임시). 처음 보여 줄 단계는 1단계다(어떻게 막아도 조각이 들어갈 자리는 언젠가 없어진다. 실패할 수 없다).
     * 판을 내는 단계는 1~4단계다. 힌트는 질문 두 개이고, "들어갈 자리 보기"도 힌트 하나로 센다.
     * fastRetries: 약수 세금과 같다. 힌트 없이, 다시 해 보기 이만큼 안에(기록의 retries) 가장 적게 막는 수에 닿았으면(reachedBest) "한 번에 빠르게"로 본다.
     * "여기까지 할래요"로 끝낸 판은 outcome이 solved다. 그래서 그만둔 판으로 세지 않는다.
     * expectedSeconds: 쓰이지 않는 자리 채움이다.
     * whyAfter: 'best'면 이 형식의 만들어 낸 판을 가장 적게 막아 한 번 끝낸 뒤에(기록의 reachedBest가 true) "왜 그럴까?"가 열린다.
     */
    block: {
      startLevel: 1,
      bottomLevel: 1,
      topLevel: 4,
      hintCount: 2,
      expectedSeconds: { 1: 120, 2: 180, 3: 240, 4: 300 },
      fastRetries: 2,
      whyAfter: 'best',
    },
    /**
     * 강 건너기(모두 임시). 처음 보여 줄 단계는 1단계다(첫 판은 코끼리 하나와 생쥐 둘. 배는 언제든 되돌아올 수 있어서 막히지 않는다).
     * 판을 내는 단계는 1~5단계다. 힌트는 질문 두 개다.
     * 첫 답으로 맞혔는지를 본다(되는 판은 모두 건넌 것이, 안 되는 판은 "불가능해요"가 답이다. 가장 적은 횟수를 묻는 3단계는 처음 건넌 횟수가 가장 적은 횟수였는가).
     * expectedSeconds: 재 본 값이 아니다. 배를 가장 적게 보내는 횟수(5~21번)를 보고 넉넉하게 잡았다.
     * whyAfter를 적지 않았다: 동전 뒤집기처럼 이 형식의 안 되는 판을 한 번 끝까지 만난 뒤에 "왜 그럴까?"가 열린다.
     */
    river: {
      startLevel: 1,
      bottomLevel: 1,
      topLevel: 5,
      hintCount: 2,
      expectedSeconds: { 1: 120, 2: 180, 3: 300, 4: 300, 5: 420 },
    },
    /**
     * 컵 뒤집기와 세 색 무리(모두 임시). 처음 보여 줄 단계는 1단계다(첫 판은 컵 넷이 모두 엎어진 판, 두 개씩. 어떻게 뒤집어도 늘 끝낼 수 있다).
     * 판을 내는 단계는 1~5단계다. 힌트는 질문 두 개이고, "세어서 적어 보기"도 힌트 하나로 센다.
     * 첫 답으로 맞혔는지를 본다(되는 판은 끝낸 것이, 안 되는 판은 "불가능해요"가 답이다. 가장 적게 뒤집는 2단계는 처음 끝낸 횟수가 가장 적은 횟수였는가).
     * expectedSeconds: 재 본 값이 아니다. 가장 적은 횟수(1~5번)와 컵, 방울이의 수를 보고 넉넉하게 잡았다.
     * whyAfter를 적지 않았다: 이 형식의 안 되는 판을 한 번 끝까지 만난 뒤에 "왜 그럴까?"가 열린다.
     *   컵과 방울이는 까닭이 달라서 판의 종류마다 따로 연다(src/core/cups.js의 whyOpen).
     */
    cups: {
      startLevel: 1,
      bottomLevel: 1,
      topLevel: 5,
      hintCount: 2,
      expectedSeconds: { 1: 90, 2: 150, 3: 150, 4: 240, 5: 240 },
    },
    /**
     * 민들레와 바람(모두 임시). 처음 보여 줄 단계는 1단계다(맨 첫 판은 2×2라 어떻게 심어도 꽃이 이긴다).
     * 판을 내는 단계는 1~5단계다. 1~4단계는 선생님과 두는 게임이고, 5단계는 혼자 덮기(더 좋은 답을 찾는 판)다. 힌트는 질문 두 개다.
     * fastWin: 게임 판은 누가 이길까와 같다. 이기는 쪽을 스스로 고르고(chose) 또는 단계가 정해 준 쪽에 서서(assigned),
     *   그쪽이 잘 두면 이기는 쪽이었고(choseWinner) 그 판을 이겼으면(winner가 kid) "한 번에 빠르게"로 본다.
     * fastRetries: 혼자 덮기 판(기록에 winner가 없다)은 약수 세금과 같다. 다시 해 보기 이만큼 안에 가장 적은 꽃의 수에 닿았는가(reachedBest).
     * 끝까지 둔 게임은 이겼든 졌든 outcome이 solved다. 그래서 연달아 진 것만으로는 내려가지 않는다.
     * expectedSeconds: 쓰이지 않는 자리 채움이다.
     * whyAfter: 'finished'면 이 형식의 판을 한 번 끝까지 한 뒤에 틀이 "왜 그럴까?"를 막지 않는다.
     *   이 형식은 따로 게임을 두 판 끝까지 둔 뒤에 연다(src/core/dandelion.js의 whyOpen).
     */
    dandelion: {
      startLevel: 1,
      bottomLevel: 1,
      topLevel: 5,
      hintCount: 2,
      expectedSeconds: { 1: 120, 2: 180, 3: 180, 4: 240, 5: 300 },
      fastWin: true,
      fastRetries: 2,
      whyAfter: 'finished',
    },
    /**
     * 주사위 미로와 길 세기(모두 임시). 처음 보여 줄 단계는 1단계다(실험. 출구를 고르는 데 틀린 답이 없고, 맨 첫 판은 출구 셋이다).
     * 판을 내는 단계는 1~5단계다. 1단계는 실험, 2~4단계는 길 세기(자물쇠), 5단계는 짝수 칸 칠하기다. 힌트는 질문 두 개다.
     * "길 그려 보기"는 아이가 스스로 적는 도구라서 힌트로 세지 않는다.
     * 기록의 wrongCount: 자물쇠에 틀린 수를 넣은 수와 "다 칠했어요"가 맞지 않은 수. 실험은 늘 0이다.
     *   그래서 "한 번에 빠르게"는 다른 형식처럼 wrongCount가 0이고 예상 시간보다 빨리 끝낸 판이다.
     *   실험 판에서는 "고르고 손님 100명을 보내 끝까지 해 본 판을 연달아 빠르게"가 된다(고른 출구가 붐볐는지는 보지 않는다).
     * expectedSeconds: 재 본 값이 아니다. 실험은 고르고 보내는 데, 세는 판은 열어야 할 자물쇠의 수(1~14개)를 보고 넉넉하게 잡았다.
     * whyAfter: 'finished'면 이 형식의 판을 한 번 끝까지 한 뒤에 틀이 "왜 그럴까?"를 막지 않는다.
     *   이 형식은 따로 실험 판과 세는 판을 한 번씩 끝까지 한 뒤에 연다(src/core/maze.js의 whyOpen). 해 보기와 까닭이 다른 날로 갈리기 쉽다.
     */
    maze: {
      startLevel: 1,
      bottomLevel: 1,
      topLevel: 5,
      hintCount: 2,
      expectedSeconds: { 1: 180, 2: 180, 3: 360, 4: 300, 5: 420 },
      whyAfter: 'finished',
    },
    /**
     * 숨은 규칙 찾기(모두 임시). 처음 보여 줄 단계는 1단계다(성질 하나, 첫 판은 2, 4, 6을 받는 짝수. 갈라 본 것이 어긋나도 더 물어볼 수 있어서 막히지 않는다).
     * 판을 내는 단계는 1~4단계다. 1~3단계는 수 판, 4단계는 세 수 판이다. 힌트는 질문 두 개다.
     * 기록의 wrongCount: 어긋난 갈라 보기의 수. 그래서 "한 번에 빠르게"는 처음 "알 것 같아요"에서 모두 맞게 가르고 예상 시간보다 빨리 끝낸 판이다.
     *   몇 번 물었는지는 보지 않는다(적게 묻는 것이 목표가 되지 않게).
     * expectedSeconds: 재 본 값이 아니다. 묻고 가르는 데 드는 시간을 넉넉하게 잡았다.
     * whyAfter: 'finished'면 이 형식의 판을 한 번 끝까지 한 뒤에 틀이 "왜 그럴까?"를 막지 않는다.
     *   이 형식은 따로 갈라 본 것이 한 번 어긋났거나 판을 둘 끝까지 한 뒤에 연다(src/core/rulehunt.js의 whyOpen).
     */
    rulehunt: {
      startLevel: 1,
      bottomLevel: 1,
      topLevel: 4,
      hintCount: 2,
      expectedSeconds: { 1: 180, 2: 240, 3: 300, 4: 360 },
      whyAfter: 'finished',
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

/** 작은 판(곁판)의 기록을 뺀 목록. 작은 판의 기록에는 side: true가 붙어 있다. */
export function withoutSide(records) {
  return (Array.isArray(records) ? records : []).filter((record) => !(record && typeof record === 'object' && record.side === true));
}

/** 수준을 따질 때 보는 판: 이 형식의, 만들어 낸 판. 들여다보기만 하고 나간 판과 작은 판(곁판)은 뺀다. */
function playedRounds(records, format, tuning) {
  return latestById(withoutSide(records)).filter((record) => {
    if (record.kind !== 'round' || record.format !== format || record.custom) return false;
    if (!Number.isInteger(record.level) || record.level < tuning.bottomLevel || record.level > tuning.topLevel) return false;
    // 손댄 판: 동전을 뒤집었거나(flipCount), 선을 긋거나 그림을 고쳤거나(strokeCount, editCount),
    // 추측을 냈거나 들었거나(guessCount), 말을 움직였거나 수를 두었거나 카드를 가졌거나(moveCount), 조각을 놓았거나(placeCount), 답했거나(먼저 둘지 고른 것도 답이다), 힌트를 열었다
    const moves =
      (record.flipCount ?? 0) + (record.strokeCount ?? 0) + (record.editCount ?? 0) + (record.guessCount ?? 0) + (record.moveCount ?? 0) + (record.placeCount ?? 0);
    const touched = moves > 0 || (record.answers?.length ?? 0) > 0 || (record.hintsOpened ?? 0) > 0;
    return record.outcome === 'solved' || record.outcome === 'solution' || touched;
  });
}

const solved = (record) => record.outcome === 'solved';

/**
 * 힌트 없이, 첫 답으로, 예상 시간보다 빠르게 맞혔는가.
 * 게임 판(그 단계에 fastGuesses가 적혀 있다)은 힌트 없이, 적은 추측으로 알아냈는가를 본다.
 * 선생님과 번갈아 두는 판(fastWin)은 힌트 없이, 이기는 쪽을 골라 이겼는가를 본다.
 * 더 좋은 답을 찾는 판(fastRetries)은 힌트 없이, 다시 해 보기 몇 번 안에 가장 큰 합에 닿았는가를 본다.
 */
function fastClean(record, tuning) {
  if (!solved(record)) return false;
  if ((record.hintsOpened ?? 0) > 0) return false;
  // 선생님과 번갈아 두는 판: 이기는 쪽을 스스로 고르고(또는 단계가 정해 준 쪽에 서서) 그 판을 이겼는가. 걸린 시간은 보지 않는다.
  // 게임과 혼자 하는 판이 섞인 형식(민들레와 바람)은 기록에 winner가 있는 판만 이렇게 본다.
  if (tuning.fastWin && (!Number.isInteger(tuning.fastRetries) || record.winner !== undefined)) {
    return (record.chose === true || record.assigned === true) && record.choseWinner === true && record.winner === 'kid' && record.rematch !== true;
  }
  // 더 좋은 답을 찾는 판: 다시 해 보기 몇 번 안에 가장 큰 합에 닿았는가. 걸린 시간은 보지 않는다.
  if (Number.isInteger(tuning.fastRetries)) return record.reachedBest === true && Number.isInteger(record.retries) && record.retries <= tuning.fastRetries;
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
 * 약수 세금과 조각 못 들어가게 막기(whyAfter가 'best')는 만들어 낸 판을 가장 좋은 답으로 한 번 끝낸 뒤에 열린다(직접 만든 판은 세지 않는다).
 * 작은 판(곁판)은 어느 형식에서도 세지 않는다.
 */
export function whyUnlocked(records, format = 'coins', allTuning = TUNING) {
  const tuning = tuningFor(format, allTuning);
  const after = tuning.whyAfter;
  // 참말 섬(whyAfter가 'rounds'): 이 형식의 판을 정해 둔 수만큼 끝까지 한 뒤에 열린다(맞혔거나 풀이를 보았거나).
  if (after === 'rounds') {
    const finished = latestById(withoutSide(records)).filter((record) => record.kind === 'round' && record.format === format && (record.outcome === 'solved' || record.outcome === 'solution'));
    return finished.length >= tuning.whyRounds;
  }
  const opens = (record) => {
    if (after === 'fewest') return record.fewest === true && record.outcome === 'solved';
    if (after === 'best') return record.reachedBest === true && record.custom !== true && record.outcome === 'solved';
    return (after === 'finished' || record.solution?.possible === false) && (record.outcome === 'solved' || record.outcome === 'solution');
  };
  return latestById(withoutSide(records)).some((record) => record.kind === 'round' && record.format === format && opens(record));
}
