// 세 방향에서 본 그림: 판 화면에서 이 형식이 맡는 부분(쌓기나무와 쌓는 판, 그림과 보기, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/views.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)는 단계가 정한다.
//   see    보이는 그림 고르기: 쌓기 하나(끌면 돌아간다)를 보고 한 방향의 그림을 보기 가운데서 누른다. 맞으면 끝난다.
//          다른 보기면 틀렸다고 하지 않고 그 보기가 무엇인지(뒤에서 본 모습, 한 줄이 몇 층인 그림) 사실만 말한다. 골라 본 보기는 다시 누를 수 없다
//   build  쌓아서 맞추기: 쌓는 판(위에서 본 판)의 칸을 눌러 쌓는다. 앞과 옆에서 본 모습이 주어진 그림과 같아지면 끝난다
//   top    위에서 본 그림 맞히기: 위에서 본 그림이 될 수 있는 보기를 누른다. 안 되는 보기면 그 보기의 어느 줄이 왜 안 되는지 판에서 보이는 사실을 말하고
//          그 줄을 보기와 주어진 그림에 점선 고리로 짚는다. 쌓는 판에서 쌓아 보며 찾아도 된다(쌓은 것으로는 끝나지 않는다)
//   range  가장 적게, 가장 많이: 쌓은 것이 두 그림과 같아질 때마다 쌓기나무 수를 적고, 가장 적은 기록과 가장 많은 기록을 오른쪽 칸에 보인다.
//          틀렸다고 하지 않고 "더 줄일 수 있을까요?"처럼 묻는다. 가장 적은 수와 가장 많은 수에 모두 닿으면 끝난다. "여기까지 할래요"로 끝내도 된다
//   three  세 그림 모두 맞추기(직접 만든 판 made도 같다): 세 방향의 모습이 모두 같아지면 끝난다. 끝나면 같은 세 그림이 되는 쌓기가 몇 가지인지 말한다
// 왼쪽 칸의 단추로 쌓기나무를 앞, 오른쪽 옆, 위에서 보이게 돌린다(비스듬히 보기로 되돌린다). 시계와 스스로 넘어가는 것은 없다.
import T from '../content/views.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, countOnce, generateBoard, madeFrom, nextSeed, rungOf } from '../core/views-ladder.js';
import { MAX_H, MAX_SIDE, MIN_SIDE, checkBoard, copyBoard, frontOf, matches, optionFact, planOf, replay, sideOf, solve, sum, viewFrom } from '../core/views.js';
import { smallerViews } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { STACK_TILT } from '../ui/solid.js';
import { drawBuildGrid, drawFlatStack, drawFlatViews, drawOptions, drawStack, drawView, viewsCard } from '../ui/views-board.js';

const FORMAT = 'views';
const MODES = ['see', 'build', 'top', 'range', 'three', 'made'];
/** 왼쪽 칸의 단추가 돌려 놓는 각(위아래, 옆) */
const ANGLES = { front: [0, 0], side: [0, -90], top: [-90, 0], tilt: STACK_TILT };
/** 직접 만들기의 처음 판: 가로 셋, 앞뒤 둘, 빈 판 */
const FIRST_DRAFT = { w: 3, d: 2 };

const count = (value) => Number.isInteger(value) && value >= 0;

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createViews(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄(돌린 방향, 더 쌓을 수 없는 칸). 다음에 무엇을 누르면 지운다
  let marked = null; // 위에서 본 그림 맞히기에서 방금 짚은 줄 { option, axis, at }. 다음 보기를 누르면 바뀐다
  let turnSeq = 0;
  let turn = null; // 쌓기나무를 돌려 놓을 각 { id, angle }
  let draft = null; // 직접 만들기에서 쌓은 것 { w, d, heights }
  let made = null; // 직접 만들기에서 선생님이 그린 것(쌓기를 고치면 지운다)
  let makeRemoving = false; // 직접 만들기에서 빼기를 골랐는가

  const isSee = (round) => round.mode === 'see';
  const heightsOf = (round) => (isSee(round) ? round.board.heights : replay(round.board, round.trail).heights);
  const levelsOf = (board) => (board.kind === 'see' ? Math.max(...board.heights) : MAX_H);
  const freshTurn = (angle) => ({ id: ++turnSeq, angle });
  const lineName = (at) => ordinal(at + 1);
  const isMade = (round) => round.mode === 'made';
  const askOf = (round) => (round.mode === 'three' || isMade(round) ? 'three' : round.mode);

  /** 칸의 읽어 주는 이름 */
  const cellLabel = (w, heights) => (at) => fill(T.labels.cell, { no: lineName(Math.floor(at / w)), n: lineName(at % w), k: heights[at] });

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    const heights = heightsOf(round);
    const see = isSee(round);
    drawStack($('views-stage'), { w: board.w, d: board.d, heights, levels: levelsOf(board), turn, live: true, onSpin: spun, label: T.labels.stage, front: T.labels['front-tag'] });
    $('views-grid').hidden = see;
    if (!see) {
      drawBuildGrid($('views-grid'), {
        w: board.w,
        d: board.d,
        heights,
        onCell: playing ? tapCell : null,
        cellLabel: cellLabel(board.w, heights),
        label: T.labels.grid,
        front: T.labels['front-tag'],
        mode: playing && round.removing ? 'remove' : 'add',
      });
    }
    $('views-cubes-line').hidden = see;
    $('views-cubes').textContent = String(sum(heights));
    $('views-status').textContent = flash ?? statusOf(round);
    $('undo').hidden = see;
    $('reset').hidden = see;
    $('undo').disabled = !playing || round.trail.length === 0;
    $('reset').disabled = !playing || round.trail.length === 0;
    drawPad(round, heights, playing);
    frame.showWhy();
  }

  function statusOf(round) {
    if (round.done) {
      if (round.stopped) return T.status.stopped;
      return T.status[`done-${askOf(round)}`];
    }
    if (isSee(round)) return T.status.see;
    return T.status[round.removing ? 'remove' : 'add'];
  }

  /** 오른쪽 칸: 보기(보이는 그림 고르기, 위에서 본 그림 맞히기), 주어진 그림과 지금 쌓은 것의 그림, 쌓기와 빼기, 기록 */
  function drawPad(round, heights, playing) {
    const { board } = round;
    const { mode } = round;
    const solution = frame.solution;
    $('views-see-box').hidden = mode !== 'see';
    $('views-compare-box').hidden = mode === 'see';
    $('views-tools').hidden = mode === 'see';
    $('views-top-box').hidden = mode !== 'top';
    $('views-range-box').hidden = mode !== 'range';
    if (mode === 'see') {
      $('views-ask').textContent = fill(T.pad.ask, { face: T.faces[board.ask] });
      const rows = Math.max(1, ...board.options.flat(), ...viewFrom(board.w, board.d, board.heights, board.ask));
      drawOptions($('views-options'), {
        pictures: board.options.map((values) => (board.ask === 'top' ? { kind: 'top', values, w: board.w, d: board.d } : { kind: board.ask, values, rows })),
        tried: round.tried,
        answer: round.done ? solution.answer : null,
        onPick: playing ? pick : null,
        labels: (at) => fill(T.labels[round.tried.includes(at) ? 'option-tried' : 'option'], { n: lineName(at) }),
      });
      return;
    }
    // 주어진 그림과 지금 쌓은 것: 앞, 옆(세 그림 판과 위에서 본 그림 맞히기는 위도)
    const withTop = mode === 'three' || mode === 'made' || mode === 'top';
    $('views-compare').classList.toggle('no-top', !withTop);
    const rows = Math.max(1, ...board.front, ...heights);
    const mark = marked && !round.done ? marked : null;
    drawView($('views-want-front'), { kind: 'front', values: board.front, rows, mark: mark?.axis === 'front' ? { at: mark.at } : null });
    drawView($('views-want-side'), { kind: 'side', values: board.side, rows, mark: mark?.axis === 'side' ? { at: mark.at } : null });
    drawView($('views-want-top'), mode === 'top' ? { kind: 'top', values: [], w: board.w, d: board.d, unknown: true } : { kind: 'top', values: board.plan ?? planOf(heights), w: board.w, d: board.d });
    drawView($('views-now-front'), { kind: 'front', values: frontOf(board.w, board.d, heights), rows });
    drawView($('views-now-side'), { kind: 'side', values: sideOf(board.w, board.d, heights), rows });
    drawView($('views-now-top'), { kind: 'top', values: planOf(heights), w: board.w, d: board.d });
    $('views-add').setAttribute('aria-pressed', String(!round.removing));
    $('views-remove').setAttribute('aria-pressed', String(Boolean(round.removing)));
    $('views-add').disabled = !playing;
    $('views-remove').disabled = !playing;
    if (mode === 'top') {
      drawOptions($('views-top-options'), {
        pictures: board.options.map((values, at) => ({ kind: 'top', values, w: board.w, d: board.d, mark: mark && mark.option === at ? { axis: mark.axis, at: mark.at } : null })),
        tried: round.tried,
        answer: round.done ? solution.answer : null,
        onPick: playing ? pick : null,
        labels: (at) => fill(T.labels[round.tried.includes(at) ? 'option-tried' : 'option'], { n: lineName(at) }),
      });
    }
    if (mode === 'range') {
      $('views-few-line').hidden = round.few === null;
      $('views-few-none').hidden = round.few !== null;
      $('views-many-line').hidden = round.many === null;
      $('views-many-none').hidden = round.many !== null;
      if (round.few !== null) $('views-few').textContent = String(round.few);
      if (round.many !== null) $('views-many').textContent = String(round.many);
      $('views-stop').hidden = !(playing && round.found.length > 0);
    }
  }

  /** 끌어 돌렸다: 판 아래에 적어 둔 방향은 이제 맞지 않으니 지운다 */
  function spun() {
    const { round } = frame;
    if (!round) return;
    round.spinCount += 1;
    if (flash) {
      flash = null;
      $('views-status').textContent = statusOf(round);
    }
    if (!round.done) frame.persist();
  }

  /** 왼쪽 칸의 단추: 앞, 오른쪽 옆, 위에서 보이게(비스듬히 보기로) 돌린다. 끝난 판에서도 된다 */
  function turnTo(name) {
    const { round } = frame;
    if (!round || !(name in ANGLES)) return;
    turn = freshTurn(ANGLES[name]);
    round.turnCount += 1;
    flash = T.status[`turn-${name}`];
    frame.note('turn', { name });
    draw();
    frame.keep();
  }

  // ---- 쌓기와 빼기 ----
  function setRemoving(on) {
    const { round } = frame;
    if (!round || round.done || isSee(round) || round.removing === on) return;
    round.removing = on;
    flash = null;
    frame.note('tool', { removing: on });
    draw();
    frame.persist();
  }

  function tapCell(at) {
    const { round } = frame;
    if (!round || round.done || isSee(round)) return;
    const { board } = round;
    if (!Number.isInteger(at) || at < 0 || at >= board.w * board.d) return;
    const now = heightsOf(round)[at];
    if (round.removing && now === 0) {
      flash = T.status.empty;
      draw();
      return;
    }
    if (!round.removing && now >= MAX_H) {
      flash = fill(T.status.full, { k: MAX_H });
      draw();
      return;
    }
    round.trail = [...round.trail, `${round.removing ? 'r' : 'a'}${at}`];
    round.moveCount += 1;
    flash = null;
    const heights = heightsOf(round);
    frame.note('cube', { at, add: !round.removing, h: heights[at] });
    if (round.mode === 'range') {
      if (matches(board, heights) && rangeMatch(round, heights)) return;
    } else if (round.mode !== 'top' && matches(board, heights)) {
      round.answers.push({ t: frame.stamp(), answer: 'done', correct: true, guess: null });
      frame.note('answer', { answer: 'done', cubes: sum(heights) });
      frame.finish('solved');
      return;
    }
    draw();
    frame.persist();
  }

  /**
   * 가장 적게, 가장 많이: 쌓은 것이 두 그림과 같아졌다. 기록을 고치고, 두 끝에 모두 닿았으면 판을 끝낸다(참을 낸다).
   * 아니면 한 일(몇 개로 맞았는지)과 물음 하나를 말한다. 가장 적은(많은) 수에 닿았으면 그 사실을 말한다.
   */
  function rangeMatch(round, heights) {
    const { solution } = frame;
    const cubes = sum(heights);
    const fewer = round.few === null || cubes < round.few;
    const more = round.many === null || cubes > round.many;
    if (!round.found.includes(cubes)) round.found = [...round.found, cubes];
    if (fewer) round.few = cubes;
    if (more) round.many = cubes;
    round.answers.push({ t: frame.stamp(), answer: `match:${cubes}`, correct: true, guess: null });
    frame.note('answer', { answer: 'match', cubes });
    if (round.few === solution.fewest && round.many === solution.most) {
      frame.finish('solved');
      return true;
    }
    const parts = [fill(T.play.match, { k: cubes })];
    if (fewer && cubes === solution.fewest) {
      parts.push(T.play['best-few']);
      if (round.many < solution.most) parts.push(T.play['ask-more']);
    } else if (more && cubes === solution.most) {
      parts.push(T.play['best-many']);
      if (round.few > solution.fewest) parts.push(T.play['ask-fewer']);
    } else if (fewer && more) parts.push(T.play['ask-both']);
    else if (fewer) parts.push(T.play['ask-fewer']);
    else if (more) parts.push(T.play['ask-more']);
    draw();
    frame.persist();
    frame.say(parts.join(' '));
    return true;
  }

  /** "여기까지 할래요"(가장 적게, 가장 많이): 찾은 기록으로 판을 끝낸다. 이것도 끝까지 한 판이다 */
  function stop() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'range' || round.found.length === 0) return;
    round.stopped = true;
    // 두 끝에 모두 닿지 않고 끝낸 판은 "한 번에"로 보지 않는다(수준 맞추기)
    round.wrongCount += 1;
    frame.note('stop', { few: round.few, many: round.many });
    frame.finish('solved');
  }

  function undo() {
    const { round } = frame;
    if (!round || round.done || round.trail.length === 0) return;
    round.trail = round.trail.slice(0, -1);
    round.undoCount += 1;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 모습에 한 말(몇 개로 맞았다는 말)은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  function reset() {
    const { round } = frame;
    if (!round || round.done || round.trail.length === 0) return;
    round.trail = [];
    round.resetCount += 1;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  // ---- 보기 고르기 ----

  /** 보이는 그림 고르기에서 고른 보기가 무엇인지 말하는 한 줄 */
  function seeLine(board, option) {
    const fact = optionFact(board, option);
    if (fact.kind === 'near') return fill(T.play['see-near'], { no: lineName(fact.at), k: fact.value });
    if (fact.kind === 'cell') return fill(T.play[fact.filled ? 'see-cell-full' : 'see-cell-empty'], { no: lineName(fact.y), n: lineName(fact.x) });
    if (fact.kind === 'other') return fill(T.play['see-other'], { face: T.faces[board.ask] });
    return T.play[`see-${fact.kind}`];
  }

  /** 위에서 본 그림 맞히기에서 안 되는 보기의 까닭(판에서 보이는 사실) */
  function topLine(board, reason) {
    const line = T.play[`top-${reason.kind}-${reason.axis}`];
    const views = reason.axis === 'front' ? board.front : board.side;
    if (reason.kind === 'short') return fill(line, { no: lineName(reason.at), k: reason.need, n: reason.reach });
    return fill(line, { no: lineName(reason.at), k: views[reason.at] });
  }

  function pick(at) {
    const { round, solution } = frame;
    if (!round || round.done || (round.mode !== 'see' && round.mode !== 'top')) return;
    const { board } = round;
    if (!Number.isInteger(at) || at < 0 || at >= board.options.length || round.tried.includes(at)) return;
    const correct = at === solution.answer;
    const reason = round.mode === 'top' ? solution.reasons[at] : null;
    const guess = correct ? null : round.mode === 'see' ? optionFact(board, board.options[at]).kind : reason.kind;
    round.answers.push({ t: frame.stamp(), answer: `pick:${at}`, correct, guess });
    frame.note('answer', { at, correct });
    flash = null;
    if (correct) {
      round.picked = at;
      marked = null;
      frame.finish('solved');
      return;
    }
    // 틀렸다고 하지 않는다. 고른 보기가 무엇인지(안 되는 까닭) 사실만 말하고, 그 보기는 다시 누를 수 없게 둔다
    round.tried = [...round.tried, at];
    round.wrongCount += 1;
    marked = reason ? { option: at, axis: reason.axis, at: reason.at } : null;
    const line = round.mode === 'see' ? seeLine(board, board.options[at]) : topLine(board, reason);
    draw();
    frame.persist();
    frame.say(line);
  }

  // ---- 끝났을 때 하는 말: 한 일과 사실만 말한다 ----
  function rightLine(round, solution) {
    const { board } = round;
    const cubes = sum(heightsOf(round));
    const tries = round.tried.length + 1;
    if (round.mode === 'see') {
      const parts = [fill(T.right.see, { face: T.faces[board.ask] })];
      if (round.tried.length > 0) parts.push(fill(T.right.tries, { f: tries }));
      return parts;
    }
    if (round.mode === 'top') {
      const parts = [T.right.top];
      if (round.tried.length > 0) parts.push(fill(T.right.tries, { f: tries }));
      parts.push(solution.count === 1 ? T.right['top-ways-one'] : fill(T.right['top-ways'], { k: solution.count }));
      return parts;
    }
    if (round.mode === 'build') return [fill(T.right.build, { k: cubes }), solution.count === 1 ? T.right['ways-one'] : fill(T.right.ways, { k: solution.count })];
    if (round.mode === 'range') {
      if (round.stopped) return [fill(T.right['range-stopped'], { k: round.few, n: round.many }), fill(T.right['range-truth'], { f: solution.fewest, total: solution.most })];
      return [fill(T.right.range, { k: solution.fewest, n: solution.most }), fill(T.right.ways, { k: solution.count })];
    }
    return [fill(T.right.three, { k: cubes }), solution.count === 1 ? T.right['three-one'] : fill(T.right['three-many'], { k: solution.count })];
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 끌어 돌릴 수 있는 쌓기나무 카드 */
  const stackCard = (w, d, heights, note, big = false) =>
    viewsCard((root) => drawStack(root, { w, d, heights, levels: Math.max(...heights), live: true, small: true, label: T.labels.stage, front: T.labels['front-tag'] }), note, { big });
  const viewCard = (picture, note) => viewsCard((root) => drawView(root, picture), note, { flat: true });

  /** 풀이: 보기 판은 맞는 그림, 위의 그림은 될 수 있는 보기와 그대로 쌓은 것, 쌓는 판은 쌓기 하나(가장 적게·가장 많이는 둘) */
  function solutionPages(round, solution) {
    const { board } = round;
    const { w, d } = board;
    if (board.kind === 'see') {
      const truth = solution.truth;
      const picture = board.ask === 'top' ? { kind: 'top', values: truth, w, d } : { kind: board.ask, values: truth };
      return [{ say: fill(T.solution.see, { face: T.faces[board.ask] }), nodes: [rowOf([viewCard(picture, T.views[board.ask]), stackCard(w, d, board.heights, T.solution.shown)])] }];
    }
    if (board.kind === 'top') {
      const plan = board.options[solution.answer];
      return [{ say: T.solution.top, nodes: [rowOf([viewCard({ kind: 'top', values: plan, w, d }, T.solution.answer), stackCard(w, d, solution.example, fill(T.solution.count, { k: sum(solution.example) }))])] }];
    }
    if (board.kind === 'range') {
      return [{ say: fill(T.solution.range, { k: solution.fewest, n: solution.most }), nodes: [rowOf([stackCard(w, d, solution.fewestStack, fill(T.solution.count, { k: solution.fewest })), stackCard(w, d, solution.mostStack, fill(T.solution.count, { k: solution.most }))])] }];
    }
    const one = solution.count === 1;
    const say = board.kind === 'build' ? (one ? T.solution['build-one'] : fill(T.solution.build, { k: solution.count })) : one ? T.solution['three-one'] : fill(T.solution.three, { k: solution.count });
    return [{ say, nodes: [rowOf([stackCard(w, d, solution.example, fill(T.solution.count, { k: sum(solution.example) }), true)])] }];
  }

  /** "왜 그럴까?"의 그림 하나 */
  function figureOf(item) {
    const { w, d, heights } = item;
    if (item.show === 'stack') return stackCard(w, d, heights, item.note);
    if (item.show === 'front') return viewCard({ kind: 'front', values: frontOf(w, d, heights) }, item.note);
    if (item.show === 'side') return viewCard({ kind: 'side', values: sideOf(w, d, heights) }, item.note);
    return viewCard({ kind: 'top', values: planOf(heights), numbers: heights, w, d }, item.note);
  }

  /** 가장 적게, 가장 많이의 판을 한 번 끝까지 했는가(작은 판과 직접 만든 판은 세지 않는다) */
  const isRangeDone = (item) => item.kind === 'round' && item.format === FORMAT && item.mode === 'range' && item.outcome === 'solved' && item.side !== true && item.custom !== true;

  /**
   * "왜 그럴까?": 같은 두 그림인데 6개와 11개 → 가장 많이는 칸마다 두 줄 높이 가운데 낮은 쪽 → 가장 적게는 한 칸이 두 줄을 함께 맡는다
   * → 세 그림을 다 주어도 하나로 정해지지 않는 쌓기(모두 7가지). 가장 적게, 가장 많이의 판을 한 번 끝까지 한 뒤에 열린다.
   */
  function whyPages() {
    if (!frame.records().some(isRangeDone)) return null;
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다
      get nodes() {
        return [rowOf(slide.figures.map(figureOf))];
      },
    }));
  }

  // ---- 직접 만들기: 판의 크기를 정하고 칸을 눌러 쌓는다 ----
  const draftOk = (saved) =>
    saved && Number.isInteger(saved.w) && Number.isInteger(saved.d) && saved.w >= MIN_SIDE && saved.w <= MAX_SIDE && saved.d >= MIN_SIDE && saved.d <= MAX_SIDE && Array.isArray(saved.heights) && saved.heights.length === saved.w * saved.d && saved.heights.every((value) => Number.isInteger(value) && value >= 0 && value <= MAX_H);

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    if (draftOk(saved)) return { w: saved.w, d: saved.d, heights: saved.heights.slice() };
    return { ...FIRST_DRAFT, heights: new Array(FIRST_DRAFT.w * FIRST_DRAFT.d).fill(0) };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    makeRemoving = false;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const { w, d, heights } = draft;
    $('views-make-w').textContent = fill(T.make.size, { n: w });
    $('views-make-w-fewer').disabled = w <= MIN_SIDE;
    $('views-make-w-more').disabled = w >= MAX_SIDE;
    $('views-make-d').textContent = fill(T.make.size, { n: d });
    $('views-make-d-fewer').disabled = d <= MIN_SIDE;
    $('views-make-d-more').disabled = d >= MAX_SIDE;
    $('views-make-add').setAttribute('aria-pressed', String(!makeRemoving));
    $('views-make-remove').setAttribute('aria-pressed', String(makeRemoving));
    drawStack($('views-make-stage'), { w, d, heights, levels: MAX_H, live: true, label: T.labels.stage, front: T.labels['front-tag'] });
    drawBuildGrid($('views-make-grid'), { w, d, heights, onCell: placeCell, cellLabel: cellLabel(w, heights), label: T.labels.grid, front: T.labels['front-tag'], mode: makeRemoving ? 'remove' : 'add' });
    $('views-make-count').textContent = String(sum(heights));
    $('views-make-result').textContent = made ? made.line : '';
    const picture = $('views-make-picture');
    if (made) {
      const { board } = made;
      const rows = Math.max(...board.front);
      picture.replaceChildren(
        // 오른쪽 칸이 좁아서 그림마다 방향의 이름만 적는다
        viewCard({ kind: 'front', values: board.front, rows }, T.faces.front),
        viewCard({ kind: 'side', values: board.side, rows }, T.faces.side),
        viewCard({ kind: 'top', values: board.plan, w: board.w, d: board.d }, T.faces.top),
      );
    } else picture.replaceChildren();
    const ready = madeBoard() !== null;
    $('views-make-solve').disabled = !ready;
    $('views-make-play').disabled = !ready;
  }

  function changeDraft(next) {
    // 선생님이 그린 뒤에 쌓기를 고치면, 앞의 쌓기에 한 말이 남지 않게 바뀌었다는 사실만 말한다
    const said = made !== null;
    draft = next;
    made = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
    if (said) frame.talkers.make.say(T.make.changed);
  }

  /** 판의 크기를 바꾼다. 남는 칸의 쌓기나무는 그대로 두고, 늘어난 칸은 비어 있다 */
  function resize(w, d) {
    if (w < MIN_SIDE || w > MAX_SIDE || d < MIN_SIDE || d > MAX_SIDE) return;
    const heights = [];
    for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) heights.push(x < draft.w && y < draft.d ? draft.heights[y * draft.w + x] : 0);
    changeDraft({ w, d, heights });
  }

  function placeCell(at) {
    const heights = draft.heights.slice();
    if (makeRemoving) {
      if (heights[at] === 0) return;
      heights[at] -= 1;
    } else {
      if (heights[at] >= MAX_H) {
        frame.talkers.make.say(fill(T.status.full, { k: MAX_H }));
        return;
      }
      heights[at] += 1;
    }
    changeDraft({ ...draft, heights });
  }

  function setMakeRemoving(on) {
    makeRemoving = on;
    drawMake();
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판): 이 쌓기를 세 방향에서 본 그림. 빈 판이면 null */
  function madeBoard() {
    if (!draft) return null;
    const board = madeFrom(draft.w, draft.d, draft.heights);
    return board && checkBoard(board) === null ? board : null;
  }

  /** 선생님이 세 방향에서 본 그림을 그리고, 같은 세 그림이 되는 쌓기가 몇 가지인지 말한다 */
  function solveDraft() {
    const board = madeBoard();
    if (!board) {
      frame.talkers.make.say(T.make.need);
      return;
    }
    const counted = countOnce(board.w, board.d, board.front, board.side, board.plan);
    const line = counted.count === 1 ? T.make.one : fill(T.make.many, { k: counted.count - 1 });
    made = { line, board };
    drawMake();
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      heights: draft.heights.slice(),
      solution: { possible: true, count: counted.count, fewest: counted.fewest, most: counted.most },
    });
    log.flush();
    frame.talkers.make.say(line);
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
  for (const name of Object.keys(ANGLES)) $(`views-turn-${name}`).addEventListener('click', () => turnTo(name));
  $('views-add').addEventListener('click', () => setRemoving(false));
  $('views-remove').addEventListener('click', () => setRemoving(true));
  $('views-stop').addEventListener('click', stop);
  $('views-make-w-fewer').addEventListener('click', () => resize(draft.w - 1, draft.d));
  $('views-make-w-more').addEventListener('click', () => resize(draft.w + 1, draft.d));
  $('views-make-d-fewer').addEventListener('click', () => resize(draft.w, draft.d - 1));
  $('views-make-d-more').addEventListener('click', () => resize(draft.w, draft.d + 1));
  $('views-make-add').addEventListener('click', () => setMakeRemoving(false));
  $('views-make-remove').addEventListener('click', () => setMakeRemoving(true));
  $('views-make-solve').addEventListener('click', solveDraft);
  $('views-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: copyBoard(board), // 판(src/core/views.js)
      trail: [], // 처음(빈 판)부터 한 일: 'a5'(5번 칸에 쌓기), 'r5'(5번 칸에서 빼기)
      removing: false, // 쌓는 판에서 빼기를 골랐는가
      tried: [], // 골라 본 보기(맞지 않았던 것)
      picked: null, // 맞게 고른 보기
      found: [], // 가장 적게, 가장 많이: 두 그림과 같아졌던 쌓기나무 수(같아진 차례대로, 같은 수는 한 번)
      few: null, // 그 가운데 가장 적은 수
      many: null, // 가장 많은 수
      stopped: false, // "여기까지 할래요"로 끝냈는가
      moveCount: 0, // 쌓거나 뺀 수(무르기 전의 것까지 모두)
      undoCount: 0,
      resetCount: 0,
      turnCount: 0, // 판 아래 단추로 돌린 수
      spinCount: 0, // 끌어 돌린 수
      wrongCount: 0, // 사실과 다른 답의 수(맞지 않은 보기, 두 끝에 닿지 않고 그만둔 것)
    };
  }

  /** 적어 둔 판의 단계가 판의 종류와 맞는가 */
  function levelOk(saved) {
    const { board } = saved;
    if (saved.custom === true) return saved.level === MAKE_LEVEL && saved.mode === 'made' && board.kind === 'three';
    if (!Number.isInteger(saved.level) || saved.level < LADDER[0].level || saved.level > TOP_LEVEL) return false;
    const mode = rungOf(saved.level).mode;
    return mode === saved.mode && board.kind === mode;
  }

  function validSaved(saved) {
    if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null || !levelOk(saved)) return false;
    if (!replay(saved.board, saved.trail).ok || typeof saved.removing !== 'boolean' || typeof saved.stopped !== 'boolean') return false;
    const options = saved.board.options?.length ?? 0;
    if (!Array.isArray(saved.tried) || !saved.tried.every((at) => Number.isInteger(at) && at >= 0 && at < options)) return false;
    if (!Array.isArray(saved.found) || !saved.found.every(count)) return false;
    if (!(saved.few === null || count(saved.few)) || !(saved.many === null || count(saved.many))) return false;
    return [saved.moveCount, saved.undoCount, saved.resetCount, saved.turnCount, saved.spinCount, saved.wrongCount].every(count);
  }

  /** 작은 그림: 보기 판은 쌓기, 다른 판은 주어진 그림(답이 될 쌓기는 그리지 않는다) */
  function drawSample(root, board) {
    if (board.kind === 'see') {
      drawFlatStack(root, board);
      return;
    }
    const rows = Math.max(...board.front);
    const pictures = [
      { kind: 'front', values: board.front, rows },
      { kind: 'side', values: board.side, rows },
    ];
    if (board.kind === 'three') pictures.push({ kind: 'top', values: board.plan, w: board.w, d: board.d });
    drawFlatViews(root, pictures);
  }

  /** 하던 판과 공책의 그림: 쌓아 둔 것이 있으면 그 쌓기, 없으면 판의 그림 */
  function drawResume(root, saved) {
    const { board } = saved;
    const state = board.kind === 'see' ? { ok: false } : replay(board, saved.trail ?? []);
    if (state.ok && sum(state.heights) > 0) drawFlatStack(root, { w: board.w, d: board.d, heights: state.heights });
    else drawSample(root, board);
  }

  return {
    id: FORMAT,
    T,
    padId: 'views-pad',
    makeId: 'make-views',
    homeIds: { sample: 'home-views-sample', blank: 'home-views-blank', ask: 'home-views-ask', play: 'home-views-play', pick: 'home-views-pick', make: 'home-views-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solve(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      try {
        return validSaved(saved);
      } catch {
        return false;
      }
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 돌리는 단추)을 보이거나 감춘다 */
    showParts(on) {
      $('views-board').hidden = !on;
      $('views-count').hidden = !on;
      $('views-turns').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다(보기 판은 그리면서 감춘다).
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      flash = null;
      marked = null;
      // 새 판(이어 하는 판)은 늘 비스듬히 본 모습에서 시작한다
      turn = freshTurn(STACK_TILT);
    },
    draw,
    ended() {
      flash = null;
      marked = null;
    },
    ruleLine(round) {
      if (round.mode === 'see') return fill(T.rules.see, { face: T.faces[round.board.ask] });
      return T.rules[round.mode];
    },
    // 규칙 글은 왼쪽 칸 맨 위에 둔다(판에 쌓기나무와 쌓는 판을 위아래로 놓는다)
    ruleAside: true,
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.moveCount > 0 || round.tried.length > 0 || round.turnCount > 0 || round.spinCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      return { mode: round.mode, heights: heightsOf(round).slice(), tried: round.tried.slice(), removing: round.removing, few: round.few, many: round.many };
    },
    /** 이 판보다 작은 판: 가장자리의 세로줄이나 가로줄을 덜어 낸 같은 종류의 판 */
    smaller: (round, turn) => smallerViews({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const heights = heightsOf(round);
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, answer: solution.answer ?? null, count: solution.count ?? null, fewest: solution.fewest ?? null, most: solution.most ?? null },
        hintsOpened: round.hintsOpened,
        // 판을 떠날 때의 모습: 한 일, 쌓은 것, 고른 보기
        trail: round.trail,
        heights: heights.slice(),
        cubes: sum(heights),
        tried: round.tried,
        picked: round.picked,
        // 가장 적게, 가장 많이: 같아졌던 수들과 두 기록, 두 끝에 모두 닿았는가
        found: round.found,
        few: round.few,
        many: round.many,
        reachedBest: round.mode === 'range' && round.few === solution.fewest && round.many === solution.most,
        stopped: round.stopped,
        moveCount: round.moveCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        turnCount: round.turnCount,
        spinCount: round.spinCount,
        // 수준 맞추기가 보는 "틀린 답"의 수
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    /** 글자판이 있는 기기: 보기와 칸과 단추는 저마다 Enter와 빈칸 글쇠로 누른다. 따로 받는 글쇠가 없다 */
    onKey() {},

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample,
    drawBlank(root) {
      drawFlatStack(root, T.blank);
    },
    drawResume,
    /** 판 고르기의 그림: 단계마다 그 단계의 첫 판 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawFlatStack(root, T.blank);
        return;
      }
      drawSample(root, generateBoard(entry.level, entry.picture.seed).board);
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
    /** 가장 좋은 기록(가장 적게, 가장 많이): 가장 많은 기록과 가장 적은 기록의 차. 클수록 좋다 */
    bestOf: (round) => (round.mode !== 'range' || round.few === null || round.many === null ? null : { value: round.many - round.few, name: fill(T.notebook.best, { k: round.few, n: round.many }) }),
  };
}
