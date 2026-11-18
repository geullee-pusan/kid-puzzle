// 한붓그리기: 판 화면에서 이 형식이 맡는 부분(그림, 답하는 단추, 맞혔을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/trace.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)는 단계가 정한다.
//   draw   끝까지 그으면 통과. 안 되는 그림은 "불가능해요"로 답한다(1단계, 직접 만든 그림)
//   judge  긋기 전에 "돼요"/"안 돼요"를 고른다. 고른 뒤에는 그어서 확인해 볼 수 있다(2단계)
//   start  시작할 점을 고른다. 고른 뒤에는 그 점에서 그어 본다(3단계)
//   fix    선 하나를 더하거나 빼서 고친다. 고친 뒤에는 고친 그림을 그어 볼 수 있다(4단계)
// 판이 끝난 뒤에도 그림은 그어 볼 수 있다(확인용). 끝난 뒤에 그은 것은 횟수에 넣지 않는다.
import T from '../content/trace.json';
import { smallerTrace } from '../core/smaller.js';
import { fill } from '../core/text.js';
import { LADDER, MAKE_LEVEL, MAKE_POINTS, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/trace-ladder.js';
import { applyEdit, canAddEdge, checkFigure, diagnose, edgeIndex, fixesOf, solve, walk } from '../core/trace.js';
import { drawFigure, figureCard } from '../ui/trace-board.js';

const FORMAT = 'trace';
const MODES = ['draw', 'judge', 'start', 'fix'];

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
  const edgeLabelOf = (figure) => (index) => fill(T.edgeLabel, { a: figure.edges[index][0] + 1, b: figure.edges[index][1] + 1 });
  const copyFigure = (figure) => ({ points: figure.points.map((point) => point.slice()), edges: figure.edges.map((edge) => edge.slice()) });
  /** 지금 그림: 4단계에서 고쳤으면 고친 그림 */
  const figureNow = (round) => (round.edit ? applyEdit(round.board, round.edit) : round.board);
  const editText = (edit) => `${edit.type}:${edit.edge[0]}-${edit.edge[1]}`;

  /** 지금 선을 그을 수 있는가 */
  function canDraw(round) {
    if (round.done || round.mode === 'draw') return true;
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
    const state = walk(figure, round.path);
    const view = {
      points: figure.points,
      edges: figure.edges,
      used: state.used,
      degrees: round.degreesOn,
      label: pointLabel,
      edgeLabel: edgeLabelOf(figure),
      signs: T.marks,
      onPoint: tapPoint,
    };
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
      // 시작하기 전에는 어느 점이든 누를 수 있으므로 고리를 그리지 않는다.
      view.open = state.at === null ? [] : state.open;
      view.drag = true;
    }
    drawFigure($('trace-board'), view);

    $('trace-left').textContent = String(state.left);
    $('trace-status').textContent = state.stuck ? T.status.stuck : state.complete ? T.status.complete : '';
    const back = canDraw(round) && !editing(round) && round.path.length > 0;
    $('undo').disabled = !back;
    $('reset').disabled = !back;
    $('trace-degrees').setAttribute('aria-pressed', String(round.degreesOn));

    for (const mode of MODES) $(`trace-${mode}`).hidden = mode !== round.mode;
    $('trace-impossible').disabled = round.done;
    $('trace-start-note').textContent = picking(round) ? T.pad.startPick : T.pad.startDraw;
    $('trace-start-submit').disabled = !(picking(round) && pick !== null);
    $('trace-fix-note').textContent = round.edit === null ? T.pad.fixEdit : T.pad.fixDraw;
    $('trace-fix-submit').disabled = round.done || round.edit === null;
    $('trace-unfix').disabled = round.done || round.edit === null;
    frame.showWhy();
  }

  function tapPoint(point, dragged) {
    const { round } = frame;
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
    stepTo(point);
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
      frame.say(T.stuck);
    }
    draw();
    frame.persist();
  }

  /** 모든 선을 그었다. 판이 끝나기 전이면 그것이 답이다(되는 그림임을 직접 보였다). */
  function complete() {
    const { round } = frame;
    if (round.done) {
      draw();
      frame.say(T.play.checked);
      return;
    }
    submit({ kind: 'traced' });
  }

  function undo() {
    const { round } = frame;
    if (!canDraw(round) || round.path.length === 0) return;
    round.path = round.path.slice(0, -1);
    if (!round.done) round.undoCount += 1;
    note('undo');
    backToPick(round);
    draw();
    frame.persist();
  }

  function reset() {
    const { round } = frame;
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
    frame.say(T.guess[result.guess]);
  }

  /** 맞혔을 때 하는 말: 무엇을 했는지 그대로 말한다. */
  function rightLine(round) {
    const parts = [];
    const last = round.answers.at(-1);
    const back = round.undoCount + round.resetCount;
    const traced = () => (back === 0 ? fill(T.right['traced-clean'], { m: figureNow(round).edges.length }) : fill(T.right['traced-back'], { u: back, m: figureNow(round).edges.length }));
    // "맞아요."는 답 단추를 눌러 맞혔을 때만 한다. 끝까지 그어서 끝난 판에서는 그은 것을 말한다.
    if (round.mode === 'fix') {
      const kind = round.edit.type === 'add' ? 'fix-add' : 'fix-remove';
      parts.push(T.right[last.answer === 'traced' ? `${kind}-traced` : kind]);
    } else if (last.answer === 'traced') parts.push(traced());
    else if (last.answer === 'impossible') {
      if (round.stuckCount > 0) parts.push(fill(T.right['impossible-tried'], { s: round.stuckCount }));
      else parts.push(T.right[round.strokeCount > 0 ? 'impossible-some' : 'impossible-untried']);
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
  /** 그리는 차례를 선마다 붙일 숫자로 바꾼다 */
  function orderOf(figure, path) {
    const numbers = figure.edges.map(() => null);
    for (let step = 1; step < path.length; step++) numbers[edgeIndex(figure, path[step - 1], path[step])] = step;
    return numbers;
  }

  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      nodes: [
        rowOf(
          slide.figures.map((item) =>
            figureCard(
              {
                points: item.points,
                edges: item.edges,
                degrees: Boolean(item.degrees),
                marks: item.path ? [item.path[0]] : (item.odd ?? []),
                numbers: item.path ? orderOf(item, item.path) : null,
              },
              item.note,
            ),
          ),
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
    if (!solution.possible) return [{ say: T.solution.impossible, nodes: [rowOf([figureCard({ points: board.points, edges: board.edges }, '', true)])] }];
    const view = { points: board.points, edges: board.edges, numbers: orderOf(board, solution.path) };
    if (round.mode === 'start') return [{ say: T.solution.start, nodes: [rowOf([figureCard({ ...view, marks: solution.starts }, '', true)])] }];
    return [{ say: T.solution.possible, nodes: [rowOf([figureCard({ ...view, marks: [solution.path[0]] }, '', true)])] }];
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

  // ---- 단추 잇기 ----
  $('trace-degrees').addEventListener('click', toggleDegrees);
  $('trace-impossible').addEventListener('click', () => submit({ kind: 'impossible' }));
  $('trace-yes').addEventListener('click', () => submit({ kind: 'judge', value: true }));
  $('trace-no').addEventListener('click', () => submit({ kind: 'judge', value: false }));
  $('trace-start-submit').addEventListener('click', () => {
    if (pick !== null && picking(frame.round)) submit({ kind: 'start', point: pick });
  });
  $('trace-fix-submit').addEventListener('click', () => {
    if (frame.round.edit) submit({ kind: 'fix', edit: frame.round.edit });
  });
  $('trace-unfix').addEventListener('click', unfix);
  $('trace-make-clear').addEventListener('click', () => changeDraft([]));
  $('trace-make-degrees').addEventListener('click', () => {
    draftDegrees = !draftDegrees;
    drawMake();
  });
  $('trace-make-solve').addEventListener('click', solveDraft);
  $('trace-make-play').addEventListener('click', playDraft);

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
        strokeCount: 0,
        undoCount: 0,
        resetCount: 0,
        stuckCount: 0,
        editCount: 0,
        degreesShown: false, // 선의 수를 한 번이라도 보았는가
        degreesOn: false, // 지금 선의 수가 보이는 중인가
      };
    },
    solve(round) {
      const solution = solve(round.board);
      return round.mode === 'fix' ? { ...solution, fixes: fixesOf(round.board) } : solution;
    },
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkFigure(saved.board) !== null) return false;
      const edit = saved.edit;
      if (edit !== null) {
        if (saved.mode !== 'fix' || !edit || !Array.isArray(edit.edge)) return false;
        const [a, b] = edit.edge;
        if (edit.type === 'add' ? canAddEdge(saved.board, a, b) !== null : edit.type !== 'remove' || edgeIndex(saved.board, a, b) < 0) return false;
      }
      if (saved.chosen !== null && !Number.isInteger(saved.chosen)) return false;
      if (!Array.isArray(saved.startsTried)) return false;
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
    touched: (round) => round.strokeCount > 0 || round.editCount > 0 || round.path.length > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view: (round) => ({ path: round.path.slice(), edit: round.edit ? editText(round.edit) : null, chosen: round.chosen }),
    /** 이 판보다 작은 판: 점이 넷이나 다섯인 그림. 판의 종류(긋기, 긋기 전에 알아맞히기, 시작점 고르기, 고치기)는 그대로다 */
    smaller: (round, turn) => smallerTrace({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const answer = { possible: solution.possible, starts: solution.starts, path: solution.path };
      if (solution.fixes) answer.fixes = solution.fixes.map(editText);
      return {
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
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    onKey() {},

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      // 처음 화면의 그림은 칸이 좁아서 선과 점을 굵게 그린다.
      drawFigure(root, { points: board.points, edges: board.edges, small: true });
    },
    drawBlank(root) {
      drawFigure(root, { points: MAKE_POINTS, edges: [], small: true });
    },
    drawResume(root, saved) {
      const figure = figureNow(saved);
      const state = walk(figure, saved.path);
      drawFigure(root, { points: figure.points, edges: figure.edges, used: state.used, at: state.at, small: true });
    },
    /** 판 고르기의 그림: 단계마다 하는 일을 작은 그림으로 보여 준다. */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) {
        drawFigure(root, { points: MAKE_POINTS, edges: [], small: true });
        return;
      }
      const view = { points: picture.points, edges: picture.edges, picked: picture.picked ?? [], signs: T.marks, small: true };
      if (picture.path) {
        const state = walk(picture, picture.path);
        view.used = state.used;
        view.at = state.at;
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
