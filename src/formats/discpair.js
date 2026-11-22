// 원판 둘씩 옮기기: 판 화면에서 이 형식이 맡는 부분(판, 원판 옮기기, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/discpair.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 원판이 있는 칸을 누르면 원판 하나를 들고, 옆 칸 하나를 누르면 그리로 옮긴다(한 걸음). 둘째 원판까지 옮기면 한 번이다.
// 둘째 원판은 같은 칸에서 골라도 되지만, 첫째 걸음으로 막 옮긴 원판은 고를 수 없다. 든 칸을 다시 누르면 내려놓는다.
// 한 번을 끝냈을 때 원판이 모두 한 칸에 있으면 끝난다.
// 안 되는 판은 "불가능해요"로 답한다. 되는 판에 누르면 틀렸다고 하지 않고 되는 판이라는 사실만 말하고 판은 그대로 이어진다
// (바뀌지 않는 값은 안 되는 판만 가려 준다. 되는 판은 실제로 모아야 끝난다). 1단계(모두 되는 판)에는 그 단추가 없다.
// 안 되는 판을 "불가능해요"로 끝내면 판에 색을 켜고 동그라미 칸의 원판 수를 적는다.
// 옮긴 횟수는 지금 길의 끝난 옮기기 수다(무른 것은 빠진다). 판 아래에는 옮긴 횟수를 늘 적는다.
// 왼쪽 칸의 "색 켜기"를 켜면 칸에 동그라미와 네모를 번갈아 그리고 모양마다의 원판 수를 판 아래에 적는다.
// 무엇이 그대로인지는 말하지 않는다. 처음 켤 때 힌트 하나로 센다.
import T from '../content/discpair.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, solveOnce } from '../core/discpair-ladder.js';
import { MAX_CELLS, MAX_TOTAL, MIN_CELLS, MIN_TOTAL, canStep, checkBoard, copyBoard, isGathered, isSide, replay, shapeCounts, sidesOf, totalOf } from '../core/discpair.js';
import { smallerDiscpair } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { drawRing, ringCard } from '../ui/discpair-board.js';

const FORMAT = 'discpair';
const MODES = ['gather', 'four', 'six', 'odd', 'big', 'made'];
/** 처음 화면과 판 고르기에 그리는 빈 판(여섯 칸 고리) */
const BLANK = { n: 6, piles: Array(6).fill(0) };
/** 직접 만들기의 처음 판: 여섯 칸에 하나씩(책의 판) */
const FIRST_DRAFT = { n: 6, piles: [1, 1, 1, 1, 1, 1] };

const count = (value) => Number.isInteger(value) && value >= 0;

/** 직접 만들기에서 만들던 판으로 쓸 수 있는 값인가(원판이 둘보다 적어도 된다) */
function draftOk(draft) {
  if (!draft || !Number.isInteger(draft.n) || draft.n < MIN_CELLS || draft.n > MAX_CELLS) return false;
  return Array.isArray(draft.piles) && draft.piles.length === draft.n && draft.piles.every(count) && totalOf(draft.piles) <= MAX_TOTAL;
}

/** 걸음들 가운데 한 번 옮기기(걸음 둘)씩 묶는다 */
const pairsOf = (steps) => Array.from({ length: Math.floor(steps.length / 2) }, (_, index) => [steps[2 * index], steps[2 * index + 1]]);

/** 모두 모인 칸 */
const gatheredCell = (piles) => piles.findIndex((value) => value > 0);

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createDiscpair(frame) {
  const { $, log } = frame;
  let lifted = null; // 원판을 들어 올린 칸(아직 옮기지 않았다)
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 만들던 판
  let tool = 'add'; // 직접 만들기에서 칸을 누르면 원판을 놓는지('add') 빼는지('remove')
  let made = null; // 직접 만들기에서 선생님이 따진 것(판을 고치면 지운다)

  const now = (round) => replay(round.board, round.trail);
  const hasImpossible = (round) => round.mode !== 'gather';
  /** 끝난 안 되는 판은 까닭을 보이려고 색을 켠다 */
  const colorShowing = (round, solution) => (round.done ? Boolean(solution && !solution.possible) : round.colorOn);

  /** 읽어 주는 이름 */
  const labelsFor = (n) => ({
    board: fill(T.labels.board, { n }),
    cell: (cell, discs) => fill(T.labels.cell, { no: ordinal(cell + 1), n: discs }),
  });

  // ---- 판 ----
  function draw() {
    const { round, solution } = frame;
    const { board } = round;
    const playing = !round.done;
    const state = now(round);
    const colorOn = colorShowing(round, solution);
    if (!playing) lifted = null;
    drawRing($('discpair-board'), {
      n: board.n,
      piles: state.piles,
      colorOn,
      lifted,
      targets: lifted === null ? [] : sidesOf(board.n, lifted),
      fresh: state.pending ? state.pending[1] : null,
      ring: round.done && isGathered(state.piles) ? gatheredCell(state.piles) : null,
      labels: labelsFor(board.n),
      onCell: playing ? tapCell : undefined,
    });
    const shapes = shapeCounts(state.piles);
    $('discpair-moves').textContent = String(state.moves);
    // 판 아래의 높이가 늘 같게(판이 줄었다 늘었다 하지 않게) 자리는 두고 글만 감춘다
    $('discpair-shapes-line').classList.toggle('dp-off', !colorOn);
    $('discpair-circle').textContent = String(shapes.circle);
    $('discpair-square').textContent = String(shapes.square);
    $('discpair-status').textContent = flash ?? statusOf(round, solution, state);
    $('undo').disabled = !playing || round.trail.length === 0;
    $('reset').disabled = !playing || round.trail.length === 0;
    $('discpair-maybe').hidden = !hasImpossible(round);
    $('discpair-impossible').disabled = !playing;
    // 도구: 칸에 두 모양(색)을 그린다. 끝난 판에서는 누를 수 없다.
    $('discpair-color').textContent = T.tool[round.colorOn && playing ? 'on' : 'off'];
    $('discpair-color').setAttribute('aria-pressed', String(round.colorOn && playing));
    $('discpair-color').disabled = round.done;
    frame.showWhy();
  }

  function statusOf(round, solution, state) {
    if (round.done) {
      if (isGathered(state.piles)) return T.status.done;
      return solution && !solution.possible ? fill(T.status.reason, { n: shapeCounts(state.piles).circle }) : '';
    }
    if (lifted !== null) return T.status.lift;
    if (state.pending) return T.status.half;
    return round.trail.length === 0 ? T.status.start : '';
  }

  // ---- 원판 옮기기 ----
  /** 칸을 눌렀다: 원판을 들고, 옆 칸에 놓고, 다른 칸의 원판으로 바꿔 든다 */
  function tapCell(cell) {
    const { round } = frame;
    if (!round || round.done) return;
    const { n } = round.board;
    const { piles, pending } = now(round);
    flash = null;
    if (lifted !== null && isSide(n, lifted, cell)) {
      step(lifted, cell);
      return;
    }
    if (lifted === cell) lifted = null;
    else if (canStep(n, piles, pending, cell)) lifted = cell;
    else if (piles[cell] === 0) flash = T.status[lifted === null ? 'empty' : 'far'];
    else flash = T.status.fresh;
    draw();
  }

  /** 원판 하나를 옆 칸으로 옮긴다. 둘째 원판이면 한 번이 끝난다 */
  function step(from, to) {
    const { round } = frame;
    const before = now(round);
    if (!canStep(round.board.n, before.piles, before.pending, from) || !isSide(round.board.n, from, to)) return;
    lifted = null;
    round.trail = [...round.trail, [from, to]];
    const after = now(round);
    frame.note('step', { from, to });
    if (after.pending) {
      draw();
      frame.persist();
      return;
    }
    round.moveCount += 1;
    if (isGathered(after.piles)) {
      round.answers.push({ t: frame.stamp(), answer: 'done', correct: true, guess: null });
      frame.note('answer', { answer: 'done', correct: true });
      frame.finish('solved');
      return;
    }
    // 지나온 모습으로 되돌아왔으면 그 사실을 알려 준다. 말은 한 판에 한 번만 한다.
    const again = seenBefore(round, after.piles);
    if (again) {
      round.loopCount += 1;
      frame.note('loop');
    }
    draw();
    frame.persist();
    if (again && !round.loopSaid) {
      round.loopSaid = true;
      frame.say(T.play.loop);
    }
  }

  /** 이 모습이 지금 길에서 앞서 한 번을 끝냈을 때(또는 처음) 있었던 모습인가 */
  function seenBefore(round, piles) {
    const key = piles.join(',');
    for (let length = 0; length < round.trail.length; length += 2) {
      if (replay(round.board, round.trail.slice(0, length)).piles.join(',') === key) return true;
    }
    return false;
  }

  /** 무르기: 한 번의 첫째 걸음만 했으면 그 걸음을, 아니면 마지막 한 번(걸음 둘)을 무른다 */
  function undo() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    const back = round.trail.length % 2 === 1 ? 1 : 2;
    round.trail = round.trail.slice(0, -back);
    round.undoCount += 1;
    lifted = null;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 모습에 한 말(아까도 있던 모습, 되는 판이라는 말)은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  function reset() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    round.trail = [];
    round.resetCount += 1;
    lifted = null;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  /** "불가능해요". 되는 판이면 틀렸다고 하지 않고 되는 판이라는 사실만 말한다. 판은 그대로 이어진다. */
  function sayImpossible() {
    const { round, solution } = frame;
    if (!round || round.done || !hasImpossible(round)) return;
    lifted = null;
    const correct = solution.possible === false;
    const guess = correct ? null : 'impossible-on-possible';
    round.answers.push({ t: frame.stamp(), answer: 'impossible', correct, guess });
    frame.note('answer', { answer: 'impossible', correct, guess });
    if (correct) {
      frame.finish('solved');
      return;
    }
    round.impossibleCount += 1;
    round.wrongCount += 1;
    flash = null;
    frame.persist();
    draw();
    frame.say(round.moveCount === 0 ? T.play['possible-press-untried'] : T.play['possible-press']);
  }

  // ---- 색 켜기 ----
  function toggleColor() {
    const { round } = frame;
    if (!round || round.done) return;
    round.colorOn = !round.colorOn;
    if (round.colorOn) {
      round.colorShown = true;
      round.colorCount += 1;
    }
    flash = null;
    frame.note('color-tool', { on: round.colorOn });
    draw();
    frame.keep();
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    const parts = [];
    if (round.answers.at(-1)?.answer === 'impossible') {
      parts.push(round.moveCount > 0 ? fill(T.right['impossible-tried'], { k: round.moveCount }) : T.right['impossible-untried']);
      parts.push(fill(T.right.reason, { n: solution.circle }));
      return parts;
    }
    const back = round.undoCount + round.resetCount;
    const { moves } = now(round);
    parts.push(fill(T.right[back === 0 ? 'done-clean' : 'done-back'], { k: moves, n: back }));
    if (round.impossibleCount > 0) parts.push(T.right['after-press']);
    if (moves > solution.min) parts.push(T.right.fewer);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 풀이: 되는 판은 가장 적게 옮기는 차례를 한 장씩(그 장에서 다음에 옮길 두 원판은 화살표), 안 되는 판은 색을 켠 판 */
  function solutionPages(round, solution) {
    const { board } = round;
    if (!solution.possible) {
      const n = solution.circle;
      return [{ say: fill(T.solution.impossible, { n }), nodes: [rowOf([ringCard({ ...board, colorOn: true }, fill(T.solution['reason-note'], { n }), { big: true })])] }];
    }
    const moves = pairsOf(solution.steps);
    const cards = [];
    let piles = board.piles.slice();
    moves.forEach((pair, index) => {
      cards.push(ringCard({ n: board.n, piles, arrows: pair }, index === 0 ? T.solution.start : fill(T.solution.step, { no: index })));
      piles = replay({ n: board.n, piles }, pair).piles;
    });
    cards.push(ringCard({ n: board.n, piles, ring: gatheredCell(piles) }, fill(T.solution.step, { no: moves.length })));
    return [{ say: fill(T.solution.possible, { k: solution.min }), nodes: [rowOf(cards)] }];
  }

  /** "왜 그럴까?": 동그라미 칸의 원판을 세어 가다 홀수가 그대로인 것을 알아챈다 → 한 원판은 늘 다른 모양의 칸으로(이름) → 모은 모습은 짝수 → 다섯 칸 고리 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다
      get nodes() {
        // 원판의 수가 읽히게 한 줄에 두 장씩 크게 그린다
        return [rowOf(slide.figures.map((item) => ringCard({ n: item.n, piles: item.piles, colorOn: item.colorOn === true, arrows: item.arrows ?? [] }, item.note, { mid: true })))];
      },
    }));
  }

  // ---- 직접 만들기: 칸 수를 정하고 칸을 눌러 원판을 놓거나 뺀다 ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    return draftOk(saved) ? copyBoard(saved) : copyBoard(FIRST_DRAFT);
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const { n, piles } = draft;
    const total = totalOf(piles);
    $('discpair-make-n').textContent = fill(T.make.size, { n });
    $('discpair-make-fewer').disabled = n <= MIN_CELLS;
    $('discpair-make-more').disabled = n >= MAX_CELLS;
    $('discpair-make-clear').disabled = total === 0;
    for (const button of $('discpair-make-tool').querySelectorAll('[data-tool]')) button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
    drawRing($('discpair-make-board'), { n, piles, colorOn: made?.colorOn ?? false, ring: made?.ring ?? null, labels: labelsFor(n), onCell: tapDraft });
    $('discpair-make-result').textContent = made ? made.line : '';
    $('discpair-make-picture').replaceChildren(...(made?.node ? [made.node] : []));
    $('discpair-make-play').disabled = madeBoard() === null;
  }

  function changeDraft(next) {
    // 선생님이 따져 준 뒤에 판을 고치면, 앞의 판에 한 말이 남지 않게 판이 바뀌었다는 사실만 말한다
    const said = made !== null;
    draft = next;
    made = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
    if (said) frame.talkers.make.say(T.make.changed);
  }

  function tapDraft(cell) {
    const piles = draft.piles.slice();
    if (tool === 'remove') {
      if (piles[cell] === 0) return;
      piles[cell] -= 1;
    } else {
      if (totalOf(piles) >= MAX_TOTAL) {
        frame.talkers.make.say(fill(T.make.full, { n: MAX_TOTAL }));
        return;
      }
      piles[cell] += 1;
    }
    changeDraft({ n: draft.n, piles });
  }

  /** 칸 수를 바꾼다. 남는 칸의 원판은 그대로 두고, 없어지는 칸의 원판은 뺀다. 새 칸은 비어 있다 */
  function resize(n) {
    if (n < MIN_CELLS || n > MAX_CELLS) return;
    changeDraft({ n, piles: Array.from({ length: n }, (_, cell) => draft.piles[cell] ?? 0) });
  }

  function pickTool(next) {
    tool = next;
    drawMake();
  }

  /** 아이가 만든 판을 풀이 프로그램으로 풀어서 알려 준다. 되면 모을 칸에 굵은 테두리를, 안 되면 색을 켠 판을 그린다 */
  function solveDraft() {
    const board = copyBoard(draft);
    if (totalOf(board.piles) < MIN_TOTAL) {
      made = { line: T.make.few, node: null };
      drawMake();
      frame.talkers.make.say(T.make.few);
      return;
    }
    if (isGathered(board.piles)) {
      made = { line: T.make.done, node: null };
      drawMake();
      frame.talkers.make.say(T.make.done);
      return;
    }
    const result = solveOnce(board);
    if (result.possible) {
      const ring = gatheredCell(replay(board, result.steps).piles);
      made = { line: fill(T.make.possible, { k: result.min }), node: ringCard({ ...board, ring }, T.make['picture-possible']), ring };
    } else {
      const n = result.circle;
      made = { line: fill(T.make.impossible, { n }), node: ringCard({ ...board, colorOn: true }, fill(T.make['picture-impossible'], { n })), colorOn: true };
    }
    drawMake();
    const stamp = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: stamp,
      endedAt: stamp,
      board,
      solution: { possible: result.possible, min: result.min, circle: result.circle, square: result.square },
    });
    log.flush();
    frame.talkers.make.say(made.line);
  }

  /** 다 만든 판(공책에 남기거나 풀어 볼 판). 원판이 둘보다 적거나 이미 모두 한 칸에 있으면 null */
  function madeBoard() {
    if (!draft || checkBoard(draft) !== null || isGathered(draft.piles)) return null;
    return copyBoard(draft);
  }

  function playDraft() {
    const board = madeBoard();
    if (!board) {
      frame.talkers.make.say(T.make['keep-not-yet']);
      return;
    }
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('discpair-impossible').addEventListener('click', sayImpossible);
  $('discpair-color').addEventListener('click', toggleColor);
  $('discpair-make-fewer').addEventListener('click', () => resize(draft.n - 1));
  $('discpair-make-more').addEventListener('click', () => resize(draft.n + 1));
  for (const button of $('discpair-make-tool').querySelectorAll('[data-tool]')) button.addEventListener('click', () => pickTool(button.dataset.tool));
  $('discpair-make-clear').addEventListener('click', () => changeDraft({ n: draft.n, piles: draft.piles.map(() => 0) }));
  $('discpair-make-solve').addEventListener('click', solveDraft);
  $('discpair-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: copyBoard(board), // 판: 칸 수, 칸마다 원판의 수
      trail: [], // 처음 모습에서 지금까지 옮긴 걸음([나간 칸, 들어간 칸]). 걸음 둘이 한 번이다
      moveCount: 0, // 이 판에서 끝낸 옮기기의 수(무르고 되돌리기 전의 것까지 모두)
      undoCount: 0,
      resetCount: 0,
      loopCount: 0, // 지나온 모습으로 돌아온 수
      loopSaid: false,
      impossibleCount: 0, // 되는 판에 "불가능해요"를 누른 수
      wrongCount: 0, // 사실과 다른 답의 수(되는 판의 "불가능해요")
      colorOn: false, // 지금 "색 켜기"를 켜 두었는가
      colorShown: false, // 한 번이라도 켰는가
      colorCount: 0, // 켠 수
    };
  }

  /** 적어 둔 판의 단계가 판의 종류와 맞는가 */
  const levelOk = (saved) => {
    if (saved.custom === true) return saved.level === MAKE_LEVEL && saved.mode === 'made';
    if (!Number.isInteger(saved.level) || saved.level < LADDER[0].level || saved.level > TOP_LEVEL) return false;
    return rungOf(saved.level).mode === saved.mode;
  };

  return {
    id: FORMAT,
    T,
    padId: 'discpair-pad',
    makeId: 'make-discpair',
    // 판이 둥글고 정사각형이다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다
    ruleAside: true,
    homeIds: { sample: 'home-discpair-sample', blank: 'home-discpair-blank', ask: 'home-discpair-ask', play: 'home-discpair-play', pick: 'home-discpair-pick', make: 'home-discpair-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solveOnce(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null || !levelOk(saved)) return false;
      if (!replay(saved.board, saved.trail).ok) return false;
      if (![saved.moveCount, saved.undoCount, saved.resetCount, saved.loopCount, saved.impossibleCount, saved.wrongCount, saved.colorCount].every(count)) return false;
      return [saved.loopSaid, saved.colorOn, saved.colorShown].every((value) => typeof value === 'boolean');
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('discpair-board').hidden = !on;
      $('discpair-count').hidden = !on;
      $('discpair-color').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      lifted = null;
      flash = null;
    },
    draw,
    ended() {
      lifted = null;
      flash = null;
    },
    ruleLine: (round) => `${T.rules.move} ${T.asks[hasImpossible(round) ? 'maybe' : 'gather']}`,
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.trail.length > 0 || round.moveCount > 0 || round.colorCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const state = now(round);
      return { piles: state.piles.join(','), moves: state.moves, pending: state.pending, lifted, colorOn: round.colorOn };
    },
    /** 이 판보다 작은 판: 칸이 적거나 원판이 적은 같은 종류의 판(안 되는 판에서는 안 되는 작은 판도) */
    smaller: (round, turn) => smallerDiscpair({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const state = now(round);
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, min: solution.min, circle: solution.circle, square: solution.square },
        // 질문 힌트와 "색 켜기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.colorShown ? 1 : 0),
        colorShown: round.colorShown,
        colorCount: round.colorCount,
        // 판을 떠날 때의 길과 모습
        trail: round.trail,
        piles: state.piles.join(','),
        count: state.moves,
        moveCount: round.moveCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        loopCount: round.loopCount,
        impossibleCount: round.impossibleCount,
        // 수준 맞추기가 보는 "틀린 답"의 수
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    /** 글자판: 칸은 저마다 Enter와 빈칸 글쇠로 누른다(판이 맡는다). Escape는 든 원판을 내려놓는다 */
    onKey(event) {
      if ($('discpair-pad').hidden || event.key !== 'Escape' || lifted === null) return;
      lifted = null;
      draw();
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawRing(root, { n: board.n, piles: board.piles, small: true });
    },
    drawBlank(root) {
      drawRing(root, { ...BLANK, small: true });
    },
    /** 하던 판과 공책의 그림: 지금 모습 */
    drawResume(root, saved) {
      drawRing(root, { n: saved.board.n, piles: replay(saved.board, saved.trail).piles, small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawRing(root, { ...BLANK, small: true });
        return;
      }
      const { board } = generateBoard(entry.level, entry.picture.seed);
      drawRing(root, { n: board.n, piles: board.piles, small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
