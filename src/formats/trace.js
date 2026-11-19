// 한붓그리기: 판 화면에서 이 형식이 맡는 부분(그림, 답하는 단추, 맞혔을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/trace.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)는 단계가 정한다.
//   draw   끝까지 그으면 통과. 안 되는 그림은 "불가능해요"로 답한다(1단계, 직접 만든 그림)
//   judge  긋기 전에 "돼요"/"안 돼요"를 고른다. 고른 뒤에는 그어서 확인해 볼 수 있다(2단계)
//   start  시작할 점을 고른다. 고른 뒤에는 그 점에서 그어 본다(3단계)
//   fix    선 하나를 더하거나 빼서 고친다. 고친 뒤에는 고친 그림을 그어 볼 수 있다(4단계)
//   pen    한 번에 그을 수 없는 그림을 펜을 떼며 여러 번에 나눠 긋는다. 모두 그을 때마다 펜을 뗀 횟수를 말하고,
//          가장 적은 횟수가 아니면 더 적게 뗄 수 있을지 묻는다. 가장 적게 떼거나 "여기까지 할래요"를 누르면 끝난다(5단계)
//   bridge 섬과 다리. 같은 두 섬 사이에 다리가 여럿일 수 있다. 긋기와 같이 모두 건너거나 "불가능해요"로 답한다(6단계)
//   twin   선 하나만 다른 닮은 두 그림에서 끝까지 그을 수 있는 쪽을 긋지 않고 고른다(7단계)
// 판이 끝난 뒤에도 그림은 그어 볼 수 있다(확인용. 닮은 두 그림은 빼고). 끝난 뒤에 그은 것은 횟수에 넣지 않는다.
import T from '../content/trace.json';
import { smallerTrace } from '../core/smaller.js';
import { fill } from '../core/text.js';
import { LADDER, MAKE_LEVEL, MAKE_POINTS, OLD_MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/trace-ladder.js';
import { applyEdit, canAddEdge, checkFigure, diagnose, edgeIndex, fixesOf, sideOf, solve, strokePlan, walk, walkStrokes } from '../core/trace.js';
import { drawFigure, figureCard } from '../ui/trace-board.js';

const FORMAT = 'trace';
const MODES = ['draw', 'judge', 'start', 'fix', 'pen', 'bridge', 'twin'];
const SIDES = ['left', 'right'];

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createTrace(frame) {
  const { $, log } = frame;
  let pick = null; // 3단계에서 골라 둔 시작점, 4단계에서 선을 더하려고 먼저 누른 점
  let draft = null; // 직접 만들기에서 만들던 그림
  let draftPick = null; // 직접 만들기에서 먼저 누른 점
  let draftDegrees = false; // 직접 만들기에서 선의 수를 보이는 중인가
  let draftStarts = []; // 풀이 프로그램이 알려 준 시작점(그림을 바꾸면 지운다)

  const pointLabel = (index) => fill(T.pointLabel, { no: index + 1 });
  const islandLabel = (index) => fill(T.islandLabel, { no: index + 1 });
  const edgeLabelOf = (figure) => (index) => fill(T.edgeLabel, { a: figure.edges[index][0] + 1, b: figure.edges[index][1] + 1 });
  /** 그림을 그대로 베낀다(다리 판과 닮은 두 그림의 표시도 함께) */
  const copyFigure = (figure) => {
    const copy = { points: figure.points.map((point) => point.slice()), edges: figure.edges.map((edge) => edge.slice()) };
    if (figure.multi === true) copy.multi = true;
    if (figure.split !== undefined) copy.split = figure.split;
    return copy;
  };
  /** 지금 그림: 4단계에서 고쳤으면 고친 그림 */
  const figureNow = (round) => (round.edit ? applyEdit(round.board, round.edit) : round.board);
  const editText = (edit) => `${edit.type}:${edit.edge[0]}-${edit.edge[1]}`;
  const isPen = (round) => round.mode === 'pen';
  /** 다리로 그리는 그림인가(다리 건너기의 판, 그 판의 작은 판) */
  const isBridge = (figure) => figure.multi === true;
  /** 닮은 두 그림 사이의 세로 점선의 자리 */
  const dividerOf = (figure) => (figure.split === undefined ? undefined : (Math.max(...figure.points.slice(0, figure.split).map(([x]) => x)) + Math.min(...figure.points.slice(figure.split).map(([x]) => x))) / 2);
  /** 펜 몇 번 떼기의 지금 모습 */
  const penState = (round) => walkStrokes(round.board, round.strokes);

  /** 지금 선을 그을 수 있는가 */
  function canDraw(round) {
    if (round.mode === 'twin') return false;
    if (round.done || round.mode === 'draw' || round.mode === 'bridge' || round.mode === 'pen') return true;
    if (round.mode === 'judge') return round.answers.length > 0;
    if (round.mode === 'start') return round.chosen !== null;
    return round.edit !== null;
  }
  const picking = (round) => !round.done && round.mode === 'start' && round.chosen === null;
  const editing = (round) => !round.done && round.mode === 'fix' && round.edit === null;

  /** 끝난 뒤에 한 것은 따로 표시해 둔다(걸린 시간과 횟수에 넣지 않는다). */
  function note(type, data = {}) {
    frame.note(type, frame.round.done ? { ...data, after: true } : data);
  }

  /** 지금 누를 수 있는 점에 두 점을 잇는 선을 새로 그을 수 있는가를 따져, 그을 수 있는 짝들을 낸다 */
  const partners = (figure, from) => figure.points.map((_, index) => index).filter((index) => canAddEdge(figure, from, index) === null);

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const figure = figureNow(round);
    const pen = isPen(round);
    const bridge = isBridge(figure);
    const state = pen ? penState(round) : walk(figure, round.path);
    const view = {
      points: figure.points,
      edges: figure.edges,
      used: state.used,
      degrees: round.degreesOn,
      label: bridge ? islandLabel : pointLabel,
      edgeLabel: edgeLabelOf(figure),
      signs: T.marks,
      islands: bridge,
      divider: dividerOf(figure),
      onPoint: tapPoint,
    };
    if (pen) view.strokeOf = state.strokeOf;
    if (round.edit) {
      if (round.edit.type === 'remove') view.gone = [round.edit.edge];
      else view.added = [edgeIndex(figure, round.edit.edge[0], round.edit.edge[1])];
    }
    if (picking(round)) view.picked = pick === null ? [] : [pick];
    else if (editing(round)) {
      view.picked = pick === null ? [] : [pick];
      view.open = pick === null ? [] : partners(figure, pick);
      view.onEdge = tapEdge;
    } else if (canDraw(round)) {
      view.at = state.at;
      // 시작하기 전(펜을 뗀 때)에는 어느 점이든 누를 수 있으므로 고리를 그리지 않는다.
      view.open = state.at === null ? [] : state.open;
      view.drag = true;
    }
    drawFigure($('trace-board'), view);

    $('trace-left').textContent = String(state.left);
    $('trace-left-name').textContent = bridge ? T.count.bridge : T.count.line;
    $('trace-left-line').hidden = round.mode === 'twin';
    $('trace-lifts-line').hidden = !pen;
    $('trace-lifts').textContent = String(state.lifts ?? 0);
    $('trace-best-line').hidden = !pen || round.best === null;
    $('trace-best').textContent = round.best == null ? '' : String(round.best);
    $('trace-status').textContent = statusOf(round, state, bridge);
    const back = canDraw(round) && !editing(round) && (pen ? round.strokes.length > 0 : round.path.length > 0);
    $('undo').disabled = !back;
    $('reset').disabled = !back;
    $('trace-degrees').setAttribute('aria-pressed', String(round.degreesOn));
    $('trace-degrees').textContent = bridge ? T.tools.bridge : T.tools.point;

    for (const mode of MODES) $(`trace-${mode}`).hidden = mode !== round.mode;
    $('trace-impossible').disabled = round.done;
    $('trace-bridge-impossible').disabled = round.done;
    $('trace-start-note').textContent = picking(round) ? T.pad.startPick : T.pad.startDraw;
    $('trace-start-submit').disabled = !(picking(round) && pick !== null);
    $('trace-fix-note').textContent = round.edit === null ? T.pad.fixEdit : T.pad.fixDraw;
    $('trace-fix-submit').disabled = round.done || round.edit === null;
    $('trace-unfix').disabled = round.done || round.edit === null;
    if (pen) {
      const last = round.strokes.at(-1);
      $('trace-lift').disabled = state.complete || !last || last.length < 2;
      $('trace-pen-again').hidden = round.done || !state.complete;
      $('trace-pen-stop').hidden = round.done || round.best === null;
    }
    for (const side of SIDES) $(`trace-twin-${side}`).disabled = round.done;
    frame.showWhy();
  }

  /** 그림 아래에 띄우는 짧은 글: 막혔는지, 끝까지 그었는지 */
  function statusOf(round, state, bridge) {
    if (isPen(round)) return state.complete ? T.status.drawn : state.stuck ? T.status.lift : '';
    if (state.stuck) return T.status.stuck;
    if (state.complete) return bridge ? T.status.crossed : T.status.complete;
    return '';
  }

  function tapPoint(point, dragged) {
    const { round } = frame;
    if (round.mode === 'twin') {
      if (!dragged && !round.done) frame.say(T.twin.tap);
      return;
    }
    if (picking(round)) {
      // 시작할 점을 골라 둔다. 답은 아래 단추를 눌러야 들어간다.
      if (dragged || pick === point) return;
      pick = point;
      note('pick', { point });
      draw();
      return;
    }
    if (editing(round)) {
      if (!dragged) tapPair(point);
      return;
    }
    if (!canDraw(round)) {
      if (!dragged) frame.say(T.play.judgeFirst);
      return;
    }
    if (isPen(round)) penStep(point, dragged);
    else stepTo(point);
  }

  /** 점을 눌러 시작하거나, 이어진 다음 점으로 선을 긋는다. */
  function stepTo(point) {
    const { round } = frame;
    const figure = figureNow(round);
    const before = walk(figure, round.path);
    if (before.complete || !before.open.includes(point)) return;
    if (before.at === null) {
      round.path = [point];
      if (!round.done && !round.startsTried.includes(point)) round.startsTried.push(point);
      note('start', { point });
    } else {
      round.path = [...round.path, point];
      if (!round.done) round.strokeCount += 1;
      note('stroke', { from: before.at, to: point });
    }
    const state = walk(figure, round.path);
    if (state.complete) {
      complete();
      return;
    }
    if (state.stuck) {
      // 막혔다는 사실만 말한다. 판은 끝나지 않는다. 무르거나 되돌릴 수 있다.
      if (!round.done) round.stuckCount += 1;
      note('stuck', { at: point, left: state.left });
      frame.say(isBridge(figure) ? T.bridge.stuck : T.stuck);
    }
    draw();
    frame.persist();
  }

  /** 모든 선을 그었다. 판이 끝나기 전이면 그것이 답이다(되는 그림임을 직접 보였다). */
  function complete() {
    const { round } = frame;
    if (round.done) {
      draw();
      frame.say(isBridge(round.board) ? T.bridge.checked : T.play.checked);
      return;
    }
    submit({ kind: 'traced' });
  }

  // ---- 5단계: 펜 몇 번 떼기 ----
  /**
   * 펜이 있는 점에서 이어진 점을 누르면 선을 긋는다. 이어지지 않은 점(아직 긋지 않은 선이 있는 점)을 누르면
   * 펜을 떼고 그 점에 다시 댄다. 펜을 뗀 채이면 누른 점에 댄다. 끌다가 닿은 점으로는 펜을 떼지 않는다.
   */
  function penStep(point, dragged) {
    const { round } = frame;
    const before = penState(round);
    if (before.complete) {
      if (!dragged && !round.done) frame.say(T.pen.again);
      return;
    }
    const strokes = round.strokes.map((stroke) => stroke.slice());
    const last = strokes.at(-1);
    if (before.at !== null && before.open.includes(point)) {
      last.push(point);
      if (!round.done) round.strokeCount += 1;
      note('stroke', { from: before.at, to: point });
    } else {
      if (dragged || point === before.at) return;
      const free = round.board.edges.some(([a, b], index) => (a === point || b === point) && !before.used.includes(index));
      if (!free) return;
      // 선을 하나도 긋지 않은 획(막 댄 점, 뗀 펜)은 새 점으로 바꾼다. 선을 그은 획 뒤라면 펜을 떼고 새 획을 연다.
      if (last && last.length < 2) last.splice(0, last.length, point);
      else {
        strokes.push([point]);
        if (last) note('lift', { from: before.at });
      }
      note('start', { point });
    }
    round.strokes = strokes;
    const state = penState(round);
    if (state.complete) {
      penComplete(state);
      return;
    }
    if (state.stuck) {
      // 더 갈 선이 없다는 사실과 할 수 있는 일(펜을 떼기)을 말한다.
      if (!round.done) round.stuckCount += 1;
      note('stuck', { at: point, left: state.left });
      frame.say(T.pen.stuck);
    }
    draw();
    frame.persist();
  }

  /** "펜 떼기" 단추: 선을 그은 획 뒤에서 펜을 뗀다. 다음에 누르는 점에서 새 획이 시작된다. */
  function lift() {
    const { round } = frame;
    if (!isPen(round)) return;
    const state = penState(round);
    const last = round.strokes.at(-1);
    if (state.complete || !last || last.length < 2) return;
    round.strokes = [...round.strokes.map((stroke) => stroke.slice()), []];
    note('lift', { from: state.at });
    draw();
    frame.persist();
  }

  /** 모든 선을 그었다: 한 번이 끝났다. 펜을 뗀 횟수를 말하고, 가장 적은 횟수가 아니면 더 적게 뗄 수 있을지 묻는다. */
  function penComplete(state) {
    const { round, solution } = frame;
    const lifts = state.lifts;
    if (round.done) {
      draw();
      frame.say(fill(T.pen.checked, { k: lifts }));
      return;
    }
    const before = round.best;
    round.completions.push(lifts);
    if (before === null || lifts < before) {
      round.best = lifts;
      round.bestStrokes = round.strokes.map((stroke) => stroke.slice());
    }
    const reached = lifts === solution.plan.lifts;
    const guess = reached ? null : 'more-lifts';
    const entry = { t: frame.stamp(), answer: `lifts:${lifts}`, correct: reached, guess };
    round.answers.push(entry);
    frame.note('answer', { answer: entry.answer, correct: reached, guess });
    if (reached) {
      frame.finish('solved');
      return;
    }
    // 틀렸다고 하지 않는다. 펜을 뗀 횟수를 말하고 더 적게 뗄 수 있을지 묻는다. 판은 그대로 둔다.
    frame.persist();
    draw();
    frame.say(fill(before !== null && lifts < before ? T.pen['more-down'] : T.pen.more, { k: lifts }));
  }

  /** "여기까지 할래요": 지금까지 가장 적게 뗀 것으로 판을 끝낸다. 이것도 끝까지 한 판이다. */
  function stopPen() {
    const { round } = frame;
    if (round.done || !isPen(round) || round.best === null) return;
    round.stopped = true;
    frame.note('stop', { best: round.best });
    frame.finish('solved');
  }

  function undo() {
    const { round } = frame;
    if (isPen(round)) {
      if (round.strokes.length === 0) return;
      const strokes = round.strokes.map((stroke) => stroke.slice());
      // 선을 그은 획이면 마지막 선 하나를 거둔다. 선이 없는 획(막 댄 점, 뗀 펜)은 없앤다.
      if (strokes.at(-1).length >= 2) strokes.at(-1).pop();
      else strokes.pop();
      round.strokes = strokes;
      if (!round.done) round.undoCount += 1;
      note('undo');
      draw();
      frame.persist();
      return;
    }
    if (!canDraw(round) || round.path.length === 0) return;
    round.path = round.path.slice(0, -1);
    if (!round.done) round.undoCount += 1;
    note('undo');
    backToPick(round);
    draw();
    frame.persist();
  }

  /** 처음으로 되돌린다. 펜 몇 번 떼기에서 모두 그은 뒤였다면 "다시 해 보기"로 적는다. */
  function reset() {
    const { round } = frame;
    if (isPen(round)) {
      if (round.strokes.length === 0) return;
      const again = penState(round).complete;
      round.strokes = [];
      if (!round.done) {
        if (again) round.retryCount += 1;
        else round.resetCount += 1;
      }
      note(again ? 'again' : 'reset');
      draw();
      frame.persist();
      return;
    }
    if (!canDraw(round) || round.path.length === 0) return;
    round.path = [];
    if (!round.done) round.resetCount += 1;
    note('reset');
    backToPick(round);
    draw();
    frame.persist();
  }

  /** 3단계: 처음까지 되돌아가면 시작점을 다시 고른다. */
  function backToPick(round) {
    if (round.done || round.mode !== 'start' || round.path.length > 0) return;
    round.chosen = null;
    pick = null;
  }

  // ---- 4단계: 그림 고치기. 한 번만 고칠 수 있고 되돌릴 수 있다. ----
  function tapPair(point) {
    const { round } = frame;
    if (pick === null) pick = point;
    else if (pick === point) pick = null;
    else {
      const problem = canAddEdge(round.board, pick, point);
      if (problem === null) {
        applyFix({ type: 'add', edge: [Math.min(pick, point), Math.max(pick, point)] });
        return;
      }
      frame.say(T.blocked[problem]);
      pick = null;
    }
    draw();
  }

  function tapEdge(index) {
    const { round } = frame;
    if (!editing(round)) return;
    const [a, b] = round.board.edges[index];
    applyFix({ type: 'remove', edge: [Math.min(a, b), Math.max(a, b)] });
  }

  function applyFix(edit) {
    const { round } = frame;
    round.edit = edit;
    round.editCount += 1;
    round.path = [];
    pick = null;
    note('edit', { change: edit.type, edge: edit.edge });
    draw();
    frame.persist();
    frame.say(T.play.edited);
  }

  function unfix() {
    const { round } = frame;
    if (round.done || round.edit === null) return;
    round.edit = null;
    round.path = [];
    pick = null;
    note('unedit');
    draw();
    frame.persist();
  }

  // ---- 답 ----
  function answerText(answer) {
    if (answer.kind === 'judge') return answer.value ? 'yes' : 'no';
    if (answer.kind === 'start') return `start:${answer.point}`;
    if (answer.kind === 'fix') return editText(answer.edit);
    if (answer.kind === 'twin') return `twin:${answer.side}`;
    return answer.kind; // 'traced' | 'impossible'
  }

  function submit(answer) {
    const { round } = frame;
    if (round.done) return;
    const result = diagnose(round.mode, round.board, answer, { startsTried: round.startsTried, strokes: round.strokeCount });
    const entry = { t: frame.stamp(), answer: answerText(answer), correct: result.correct, guess: result.guess };
    round.answers.push(entry);
    frame.note('answer', { answer: entry.answer, correct: entry.correct, guess: entry.guess });
    if (answer.kind === 'start') {
      // 맞든 틀리든 고른 점에서 직접 그어 볼 수 있게 그 점에 세워 둔다.
      round.chosen = answer.point;
      round.path = [answer.point];
      if (!round.startsTried.includes(answer.point)) round.startsTried.push(answer.point);
      pick = null;
    }
    if (result.correct) {
      frame.finish('solved');
      return;
    }
    // 틀린 답: 무엇을 놓쳤을지 짐작해서 말한다. 깎이는 것도, 채점 표시도 없다. 다시 해 볼 수 있다.
    frame.persist();
    draw();
    // 다리 건너기에서는 섬과 다리로 말한다.
    const bridgeLine = round.mode === 'bridge' ? T.guess[`bridge-${result.guess}`] : null;
    frame.say(bridgeLine ?? T.guess[result.guess]);
  }

  /** 맞혔을 때 하는 말: 무엇을 했는지 그대로 말한다. */
  function rightLine(round) {
    if (isPen(round)) return penLine(round);
    const parts = [];
    const last = round.answers.at(-1);
    const back = round.undoCount + round.resetCount;
    const bridge = round.mode === 'bridge';
    const lines = figureNow(round).edges.length;
    const traced = () => {
      if (bridge) return back === 0 ? fill(T.right['bridge-clean'], { m: lines }) : fill(T.right['bridge-back'], { u: back, m: lines });
      return back === 0 ? fill(T.right['traced-clean'], { m: lines }) : fill(T.right['traced-back'], { u: back, m: lines });
    };
    // "맞아요."는 답 단추를 눌러 맞혔을 때만 한다. 끝까지 그어서 끝난 판에서는 그은 것을 말한다.
    if (round.mode === 'fix') {
      const kind = round.edit.type === 'add' ? 'fix-add' : 'fix-remove';
      parts.push(T.right[last.answer === 'traced' ? `${kind}-traced` : kind]);
    } else if (round.mode === 'twin') parts.push(T.right[last.answer === 'twin:left' ? 'twin-left' : 'twin-right']);
    else if (last.answer === 'traced') parts.push(traced());
    else if (last.answer === 'impossible') {
      const prefix = bridge ? 'bridge-' : '';
      if (round.stuckCount > 0) parts.push(fill(T.right[`${prefix}impossible-tried`], { s: round.stuckCount }));
      else parts.push(T.right[`${prefix}${round.strokeCount > 0 ? 'impossible-some' : 'impossible-untried'}`]);
    } else if (round.mode === 'judge') {
      parts.push(T.right[last.answer === 'yes' ? 'judge-yes' : 'judge-no']);
      if (round.answers.length === 1) parts.push(T.right['no-stroke']);
    } else if (round.mode === 'start') parts.push(T.right['start-right']);
    if (round.answers.length > 1) parts.push(T.right['after-retry']);
    // 긋지 않고 답한 판에서는 그어서 확인해 볼 수 있다고 알려 준다.
    const unchecked = (round.mode === 'judge' && round.strokeCount === 0) || round.mode === 'start';
    if (last.answer !== 'traced' && unchecked) parts.push(T.right['check-invite']);
    return parts;
  }

  /** 펜 몇 번 떼기가 끝났을 때: 펜을 뗀 횟수와 몇 번 다시 해 봤는지를 말한다. */
  function penLine(round) {
    const retries = Math.max(0, round.completions.length - 1);
    if (round.stopped) {
      const parts = [];
      if (retries > 0) parts.push(fill(T.right['pen-stopped-tries'], { r: retries }));
      parts.push(fill(T.right['pen-stopped'], { k: round.best }));
      return parts;
    }
    return [fill(T.right['pen-best'], { k: round.best, m: round.board.edges.length }), retries === 0 ? T.right['pen-first'] : fill(T.right['pen-after'], { r: retries })];
  }

  // ---- "점마다 선의 수 보기": 처음 누를 때 힌트 하나를 연 것으로 적는다. ----
  function toggleDegrees() {
    const { round } = frame;
    if (!round) return;
    round.degreesOn = !round.degreesOn;
    if (!round.done && !round.degreesShown) {
      round.degreesShown = true;
      frame.note('degrees');
    }
    draw();
    frame.persist();
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  /** 그리는 차례를 선마다 붙일 숫자로 바꾼다(같은 두 점 사이의 다리는 지난 차례대로 하나씩) */
  function orderOf(figure, path) {
    const numbers = figure.edges.map(() => null);
    walk(figure, path).used.forEach((edge, step) => {
      numbers[edge] = step + 1;
    });
    return numbers;
  }

  function whyPages(round) {
    const slides = round && isPen(round) ? [...T.why, ...T.whyPen] : T.why;
    return slides.map((slide) => ({
      say: slide.say,
      nodes: [
        rowOf(
          slide.figures.map((item) => {
            if (item.strokes) {
              const state = walkStrokes(item, item.strokes);
              const numbers = state.strokeOf.map((stroke) => (stroke === null ? null : stroke + 1));
              return figureCard({ points: item.points, edges: item.edges, used: state.used, strokeOf: state.strokeOf, numbers, marks: item.odd ?? [] }, item.note);
            }
            return figureCard(
              {
                points: item.points,
                edges: item.edges,
                degrees: Boolean(item.degrees),
                marks: item.path ? [item.path[0]] : (item.odd ?? []),
                numbers: item.path ? orderOf(item, item.path) : null,
              },
              item.note,
            );
          }),
        ),
      ],
    }));
  }

  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  function solutionPages(round, solution) {
    const { board } = round;
    const bridge = isBridge(board);
    if (round.mode === 'fix' && solution.fixes.length > 0) {
      // 고치는 방법 하나와, 고친 그림을 긋는 차례 하나를 보여 준다.
      const edit = solution.fixes[0];
      const fixed = applyEdit(board, edit);
      const way = solve(fixed);
      const view = { points: fixed.points, edges: fixed.edges, numbers: orderOf(fixed, way.path), marks: [way.path[0]], signs: T.marks };
      if (edit.type === 'remove') view.gone = [edit.edge];
      else view.added = [edgeIndex(fixed, edit.edge[0], edit.edge[1])];
      return [{ say: T.solution.fix, nodes: [rowOf([figureCard(view, '', true)])] }];
    }
    if (round.mode === 'pen') {
      // 가장 적게 떼는 방법 하나: 획마다 번호와 무늬, 획마다 펜을 대는 점에 테두리
      const { plan, lifts } = solution.plan;
      const state = walkStrokes(board, plan);
      const numbers = state.strokeOf.map((stroke) => stroke + 1);
      const view = { points: board.points, edges: board.edges, used: state.used, strokeOf: state.strokeOf, numbers, marks: plan.map((stroke) => stroke[0]) };
      return [{ say: fill(T.solution.pen, { k: lifts }), nodes: [rowOf([figureCard(view, '', true)])] }];
    }
    if (round.mode === 'twin') {
      // 끝까지 그을 수 있는 쪽을 긋는 차례 하나. 번호는 나란히 놓은 그림의 선 번호로 옮긴다.
      const side = solution.answer;
      const from = side === 'left' ? 0 : board.split;
      const way = solve(sideOf(board, side));
      const path = way.path.map((point) => point + from);
      const view = { points: board.points, edges: board.edges, numbers: orderOf(board, path), marks: [path[0]], divider: dividerOf(board) };
      return [{ say: T.solution[`twin-${side}`], nodes: [rowOf([figureCard(view, '', true)])] }];
    }
    if (!solution.possible) {
      const say = bridge ? T.solution['bridge-impossible'] : T.solution.impossible;
      return [{ say, nodes: [rowOf([figureCard({ points: board.points, edges: board.edges, islands: bridge }, '', true)])] }];
    }
    const view = { points: board.points, edges: board.edges, numbers: orderOf(board, solution.path), islands: bridge };
    if (round.mode === 'start') return [{ say: T.solution.start, nodes: [rowOf([figureCard({ ...view, marks: solution.starts }, '', true)])] }];
    return [{ say: bridge ? T.solution.bridge : T.solution.possible, nodes: [rowOf([figureCard({ ...view, marks: [solution.path[0]] }, '', true)])] }];
  }

  // ---- 직접 만들기: 점 여섯 개에 선을 그어 그림을 만든다. ----
  const draftFigure = () => ({ points: MAKE_POINTS, edges: draft.edges });

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const figure = { points: MAKE_POINTS, edges: saved?.edges };
    if (saved && checkFigure(figure, { allowEmpty: true }) === null) return { edges: saved.edges.map((edge) => edge.slice()) };
    return { edges: [] };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    draftPick = null;
    draftDegrees = false;
    draftStarts = [];
    $('trace-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const figure = draftFigure();
    drawFigure($('trace-make-board'), {
      points: figure.points,
      edges: figure.edges,
      picked: draftPick === null ? [] : [draftPick],
      open: draftPick === null ? [] : partners(figure, draftPick),
      marks: draftStarts,
      degrees: draftDegrees,
      label: pointLabel,
      edgeLabel: edgeLabelOf(figure),
      onPoint: (point, dragged) => {
        if (!dragged) tapDraftPoint(point);
      },
      onEdge: (index) => changeDraft(figure.edges.filter((_, at) => at !== index)),
    });
    const empty = figure.edges.length === 0;
    $('trace-make-count').textContent = fill(T.make.count, { n: figure.edges.length });
    $('trace-make-clear').disabled = empty;
    $('trace-make-solve').disabled = empty;
    $('trace-make-play').disabled = empty;
    $('trace-make-degrees').setAttribute('aria-pressed', String(draftDegrees));
  }

  function tapDraftPoint(point) {
    if (draftPick === null) draftPick = point;
    else if (draftPick === point) draftPick = null;
    else {
      const figure = draftFigure();
      const problem = canAddEdge(figure, draftPick, point);
      if (problem === null) {
        const from = draftPick;
        draftPick = null;
        changeDraft(applyEdit(figure, { type: 'add', edge: [from, point] }).edges);
        return;
      }
      frame.talkers.make.say(T.blocked[problem]);
      draftPick = null;
    }
    drawMake();
  }

  function changeDraft(edges) {
    draft = { edges };
    draftPick = null;
    draftStarts = [];
    $('trace-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 아이가 만든 그림을 풀이 프로그램으로 풀어서 알려 준다. */
  function solveDraft() {
    if (draft.edges.length === 0) return;
    const figure = copyFigure(draftFigure());
    const result = solve(figure);
    const key = result.possible ? (result.starts.length === 2 ? 'possible-two' : 'possible-any') : result.pieces > 1 ? 'split' : 'impossible';
    const line = T.make[key];
    $('trace-make-result').textContent = line;
    draftStarts = key === 'possible-two' ? result.starts : [];
    drawMake();
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board: figure,
      solution: { possible: result.possible, starts: result.starts, pieces: result.pieces },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 풀어 볼 판). 선이 하나도 없으면 null */
  const madeBoard = () => (draft.edges.length === 0 ? null : draftFigure());

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  /**
   * 적어 둔 하던 판의 단계가 판과 맞는가. 만들어 낸 판은 그 단계의 판의 종류여야 한다.
   * 직접 만든 판(긋기)은 지금의 직접 만들기 단계(8단계)와, 5~7단계를 더하기 전의 직접 만들기 단계(5단계)를 모두 받는다.
   */
  const levelOk = (saved) => {
    if (saved.custom === true) return [MAKE_LEVEL, OLD_MAKE_LEVEL].includes(saved.level) && saved.mode === 'draw';
    return Number.isInteger(saved.level) && saved.level >= LADDER[0].level && saved.level <= TOP_LEVEL && rungOf(saved.level).mode === saved.mode;
  };

  // ---- 단추 잇기 ----
  $('trace-degrees').addEventListener('click', toggleDegrees);
  $('trace-impossible').addEventListener('click', () => submit({ kind: 'impossible' }));
  $('trace-bridge-impossible').addEventListener('click', () => submit({ kind: 'impossible' }));
  $('trace-yes').addEventListener('click', () => submit({ kind: 'judge', value: true }));
  $('trace-no').addEventListener('click', () => submit({ kind: 'judge', value: false }));
  $('trace-start-submit').addEventListener('click', () => {
    if (pick !== null && picking(frame.round)) submit({ kind: 'start', point: pick });
  });
  $('trace-fix-submit').addEventListener('click', () => {
    if (frame.round.edit) submit({ kind: 'fix', edit: frame.round.edit });
  });
  $('trace-unfix').addEventListener('click', unfix);
  $('trace-lift').addEventListener('click', lift);
  $('trace-pen-again').addEventListener('click', reset);
  $('trace-pen-stop').addEventListener('click', stopPen);
  for (const side of SIDES) $(`trace-twin-${side}`).addEventListener('click', () => submit({ kind: 'twin', side }));
  $('trace-make-clear').addEventListener('click', () => changeDraft([]));
  $('trace-make-degrees').addEventListener('click', () => {
    draftDegrees = !draftDegrees;
    drawMake();
  });
  $('trace-make-solve').addEventListener('click', solveDraft);
  $('trace-make-play').addEventListener('click', playDraft);

  /** 작은 그림(처음 화면, 판 고르기, 하던 판 띠, 공책)에서 그림의 종류에 따라 더 그릴 것 */
  const smallExtras = (figure) => ({ islands: isBridge(figure), divider: dividerOf(figure) });

  return {
    id: FORMAT,
    T,
    padId: 'trace-pad',
    makeId: 'make-trace',
    homeIds: { sample: 'home-trace-sample', blank: 'home-trace-blank', ask: 'home-trace-ask', play: 'home-trace-play', pick: 'home-trace-pick', make: 'home-trace-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    /** 새 판에서 이 형식이 맡는 값 */
    begin({ level, custom, board }) {
      return {
        mode: custom ? 'draw' : rungOf(level).mode,
        board: copyFigure(board), // 처음 그림
        edit: null, // 4단계에서 고친 것. { type: 'add'|'remove', edge }
        path: [], // 지금까지 그은 길. 지나온 점의 번호
        chosen: null, // 3단계에서 답으로 낸 시작점
        startsTried: [], // 시작해 본 점들
        strokeCount: 0, // 그은 선의 수(무른 것도 센다)
        undoCount: 0,
        resetCount: 0,
        stuckCount: 0,
        editCount: 0,
        degreesShown: false, // 선의 수를 한 번이라도 보았는가
        degreesOn: false, // 지금 선의 수가 보이는 중인가
        strokes: [], // 5단계: 획마다 지나온 점의 번호. 맨 뒤의 획만 비었거나 점 하나일 수 있다
        completions: [], // 5단계: 모두 그을 때마다 펜을 뗀 횟수
        best: null, // 5단계: 이 판에서 가장 적게 뗀 횟수
        bestStrokes: [], // 5단계: 그때의 획들
        retryCount: 0, // 5단계: 모두 그은 뒤 처음부터 다시 해 본 수
        stopped: false, // 5단계: "여기까지 할래요"로 끝냈는가
      };
    },
    solve(round) {
      const solution = solve(round.board);
      if (round.mode === 'fix') return { ...solution, fixes: fixesOf(round.board) };
      if (round.mode === 'pen') return { ...solution, plan: strokePlan(round.board) };
      if (round.mode === 'twin') return { ...solution, answer: solve(sideOf(round.board, 'left')).possible ? 'left' : 'right' };
      return solution;
    },
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkFigure(saved.board) !== null) return false;
      if (!levelOk(saved)) return false;
      // 다리 판은 다리 건너기에서만, 나란히 놓은 두 그림은 닮은 두 그림에서만 쓴다.
      if ((saved.mode === 'bridge') !== (saved.board.multi === true)) return false;
      if ((saved.mode === 'twin') !== (saved.board.split !== undefined)) return false;
      const edit = saved.edit;
      if (edit !== null) {
        if (saved.mode !== 'fix' || !edit || !Array.isArray(edit.edge)) return false;
        const [a, b] = edit.edge;
        if (edit.type === 'add' ? canAddEdge(saved.board, a, b) !== null : edit.type !== 'remove' || edgeIndex(saved.board, a, b) < 0) return false;
      }
      if (saved.chosen !== null && !Number.isInteger(saved.chosen)) return false;
      if (!Array.isArray(saved.startsTried)) return false;
      if (saved.mode === 'pen') {
        if (!Array.isArray(saved.completions) || !Array.isArray(saved.bestStrokes)) return false;
        if (saved.best !== null && !Number.isInteger(saved.best)) return false;
        if (!walkStrokes(saved.board, saved.strokes).ok) return false;
      }
      const figure = figureNow(saved);
      return figure.edges.length > 0 && walk(figure, saved.path).ok;
    },
    /** 판 화면에서 이 형식의 것(그림, 남은 선의 수, 선의 수 보기 단추)을 보이거나 감춘다 */
    showParts(on) {
      $('trace-board').hidden = !on;
      $('trace-count').hidden = !on;
      $('trace-status').hidden = !on;
      $('trace-degrees').hidden = !on;
    },
    enter() {
      pick = null;
    },
    draw,
    ended() {
      pick = null;
    },
    ruleLine: (round) => T.rules[round.mode],
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.strokeCount > 0 || round.editCount > 0 || round.path.length > 0 || (round.strokes?.length ?? 0) > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view: (round) => ({ path: round.path.slice(), edit: round.edit ? editText(round.edit) : null, chosen: round.chosen, strokes: (round.strokes ?? []).map((stroke) => stroke.slice()) }),
    /** 이 판보다 작은 판: 점(섬)이 더 적은 그림. 판의 종류(긋기, 알아맞히기, 시작점 고르기, 고치기, 펜 떼기, 다리, 닮은 두 그림)는 그대로다 */
    smaller: (round, turn) => smallerTrace({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const answer = { possible: solution.possible, starts: solution.starts, path: solution.path };
      if (solution.fixes) answer.fixes = solution.fixes.map(editText);
      if (solution.plan) answer.lifts = solution.plan.lifts;
      if (solution.answer) answer.answer = solution.answer;
      const record = {
        mode: round.mode,
        board: copyFigure(round.board),
        solution: answer,
        // 질문 힌트와 "점마다 선의 수 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.degreesShown ? 1 : 0),
        degreesShown: round.degreesShown,
        strokeCount: round.strokeCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        stuckCount: round.stuckCount,
        editCount: round.editCount,
        startsTried: round.startsTried,
        edit: round.edit ? editText(round.edit) : null,
        path: round.path,
      };
      if (isPen(round)) {
        // 펜 몇 번 떼기: 모두 그을 때마다의 뗀 횟수, 가장 적게 뗀 횟수와 풀이 프로그램의 가장 적은 횟수
        const completions = round.completions ?? [];
        Object.assign(record, {
          strokes: round.strokes,
          completions,
          best: round.best,
          bestStrokes: round.bestStrokes,
          retries: Math.max(0, completions.length - 1),
          retryCount: round.retryCount,
          stopped: round.stopped,
          reachedBest: round.best !== null && round.best === solution.plan.lifts,
          // 가장 적은 횟수가 아니었던 번의 수. 0이면 처음 모두 그은 것이 가장 적게 뗀 것이다("한 번에").
          wrongCount: completions.filter((lifts) => lifts !== solution.plan.lifts).length,
        });
      }
      return record;
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    onKey() {},
    /** 가장 좋은 기록(펜 몇 번 떼기에서 가장 적게 뗀 횟수). 공책이 저절로 남긴다 */
    bestOf: (round) => (round.mode !== 'pen' || round.best === null ? null : { value: -round.best, name: fill(T.notebook.best, { k: round.best }) }),

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      // 처음 화면의 그림은 칸이 좁아서 선과 점을 굵게 그린다.
      drawFigure(root, { points: board.points, edges: board.edges, small: true, ...smallExtras(board) });
    },
    drawBlank(root) {
      drawFigure(root, { points: MAKE_POINTS, edges: [], small: true });
    },
    drawResume(root, saved) {
      const figure = figureNow(saved);
      const extras = smallExtras(figure);
      if (saved.mode === 'pen') {
        const state = walkStrokes(figure, saved.strokes ?? []);
        drawFigure(root, { points: figure.points, edges: figure.edges, used: state.used, strokeOf: state.strokeOf, at: state.at, small: true, ...extras });
        return;
      }
      const state = walk(figure, saved.path);
      drawFigure(root, { points: figure.points, edges: figure.edges, used: state.used, at: state.at, small: true, ...extras });
    },
    /** 판 고르기의 그림: 단계마다 하는 일을 작은 그림으로 보여 준다. */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) {
        drawFigure(root, { points: MAKE_POINTS, edges: [], small: true });
        return;
      }
      const view = { points: picture.points, edges: picture.edges, picked: picture.picked ?? [], signs: T.marks, small: true, ...smallExtras(picture) };
      if (picture.path) {
        const state = walk(picture, picture.path);
        view.used = state.used;
        view.at = state.at;
      }
      if (picture.strokes) {
        const state = walkStrokes(picture, picture.strokes);
        view.used = state.used;
        view.strokeOf = state.strokeOf;
      }
      if (picture.gone) {
        view.edges = applyEdit(picture, { type: 'remove', edge: picture.gone }).edges;
        view.gone = [picture.gone];
      }
      drawFigure(root, view);
    },
    showMake,
    /** 직접 만들기에서 다 만든 판. 아직 풀 수 있는 판이 아니면 null(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
