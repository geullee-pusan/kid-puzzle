// 엉킨 그림 풀기: 판 화면에서 이 형식이 맡는 부분(그림, 끌어 옮기기, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/untangle.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
// 한붓그리기(점과 선)의 틀을 다시 쓴다: 같은 그림 모양(점, 선, 고리)과 같은 말("점", "선")을 쓰고, 점을 손가락으로 끌어 옮기는 것만 새로 더했다.
//
// 판의 종류(mode)는 단계가 정한다.
//   untangle  점을 끌어 옮겨 겹친 곳을 없애면 판이 저절로 끝난다(1, 2단계)
//   mix       풀 수 없는 그림이 섞인다. 풀 수 없는 그림은 "불가능해요"로 답한다(3단계, 직접 만든 그림)
//   story     집과 우물, 마을과 길. mix와 같고, 다리가 있는 판은 다리 수만큼 엇갈려도 끝난다(4단계)
//   record    풀 수 없는 그림에서 선을 눌러 빼고 풀기. 겹친 곳이 없어질 때마다 한 번이 끝나고, 가장 적게 뺐으면 판이 끝난다(5단계)
// 풀 수 있는 그림에 "불가능해요"를 누르면 틀렸다고 하지 않는다. 풀 수 있다는 사실만 말하고 판은 그대로 이어진다.
// 몇 번 옮겼는지는 화면에 적지 않는다(끝났을 때 한 일을 말할 때만 말한다). 겹친 곳의 수만 판 아래에 적는다.
// "고리 하나 보기"는 도구다. 가장 긴 고리 하나를 굵게 그린다. 처음 누를 때 힌트 하나를 연 것으로 적는다.
import T from '../content/untangle.json';
import { smallerUntangle } from '../core/smaller.js';
import { fill } from '../core/text.js';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, tangleMade } from '../core/untangle-ladder.js';
import { MAX_POINTS, bridgeLayoutOf, canPlace, checkBoard, copyBoard, coreOf, edgeKey, fewestRemovals, isPlanar, layoutOf, longestCycle, pointsOk, problemsOf, solveBoard, sortEdges, untangled } from '../core/untangle.js';
import { drawTangle, tangleCard } from '../ui/untangle-board.js';

const FORMAT = 'untangle';
const MODES = ['untangle', 'mix', 'story', 'record'];
/** 기록에 남기는 "한 번마다의 뺀 선"의 수의 위 끝 */
const MAX_TRIES = 40;
/** 기록에 남기는 옮긴 차례의 수의 위 끝(무르기에 쓰는 것과 같다) */
const MAX_MOVES = 400;

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createUntangle(frame) {
  const { $, log } = frame;
  let draft = null; // 직접 만들기에서 만들던 그림 { points, edges }
  let draftPick = null; // 직접 만들기에서 먼저 누른 점
  let erasing = false; // 직접 만들기에서 "점 빼기"를 고른 중인가
  let shownCore = null; // 직접 만들기에서 선생님이 풀 수 없다고 한 그림의 뼈대(그림을 바꾸면 지운다)

  const count = (value) => Number.isInteger(value) && value >= 0;
  const sortNumbers = (list) => list.slice().sort((a, b) => a - b);

  /** 한 번 푼 판은 적어 둔다(판을 열 때마다, 기록을 남길 때마다 다시 풀지 않게) */
  const memo = new Map();
  function solutionOf(board, mode) {
    const key = `${mode}:${JSON.stringify(copyBoard(board))}`;
    if (!memo.has(key)) {
      const n = board.points.length;
      const base = solveBoard(board);
      if (mode === 'record') {
        const { best, removed } = fewestRemovals(n, board.edges);
        const rest = board.edges.filter((_, index) => !removed.includes(index));
        memo.set(key, { ...base, possible: true, best, removed, restLayout: layoutOf(n, rest) });
      } else memo.set(key, base);
    }
    return memo.get(key);
  }

  // ---- 이름표 ----
  const pointLabelOf = (roles) => (index) => (roles ? fill(T.roleLabel[roles[index]], { no: index + 1 }) : fill(T.pointLabel, { no: index + 1 }));
  const edgeLabelOf = (edges) => (index, off) => fill(off ? T.edgeOffLabel : T.edgeLabel, { no: edges[index][0] + 1, n: edges[index][1] + 1 });

  const problemsNow = (round) => problemsOf(round.points, round.board.edges, round.off);
  const hasImpossible = (round) => round.mode === 'mix' || round.mode === 'story';
  const ruleKey = (round) => {
    if (round.custom) return 'made';
    if (round.mode !== 'story') return round.mode;
    const kind = round.board.roles?.includes('town') ? 'towns' : 'houses';
    return round.board.bridges > 0 ? `${kind}-bridge` : kind;
  };
  const hintKey = (round) => round.mode;

  /** 고리 하나 보기: 지금 남은 선으로 이루어진 가장 긴 고리의 선 번호 */
  const loopMemo = new Map();
  function loopEdges(round) {
    const key = `${JSON.stringify(round.board.edges)}|${round.off.join(',')}`;
    if (!loopMemo.has(key)) {
      const { edges } = round.board;
      const live = edges.map((edge, index) => ({ edge, index })).filter((item) => !round.off.includes(item.index));
      const cycle = longestCycle(round.board.points.length, live.map((item) => item.edge));
      const keys = new Map(edges.map(([a, b], index) => [edgeKey(a, b), index]));
      loopMemo.set(
        key,
        cycle.map((v, at) => keys.get(edgeKey(v, cycle[(at + 1) % cycle.length]))),
      );
    }
    return loopMemo.get(key);
  }

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    drawTangle($('untangle-board'), {
      points: round.points,
      edges: board.edges,
      roles: board.roles,
      off: round.off,
      bridges: board.bridges,
      loop: playing && round.loopOn ? loopEdges(round) : [],
      live: playing,
      label: pointLabelOf(board.roles),
      edgeLabel: edgeLabelOf(board.edges),
      onMove: playing ? moveDot : undefined,
      onEdge: playing && round.mode === 'record' ? toggleEdge : undefined,
    });
    const problems = problemsNow(round);
    $('untangle-left').textContent = String(problems.count);
    let status = '';
    if (problems.touches.length > 0) status = T.status.touch;
    else if (round.mode === 'record' && problems.count === 0) status = fill(T.status['record-done'], { n: round.off.length });
    else if (problems.count === 0) status = T.status.done;
    else if (board.bridges > 0 && problems.crossings.length <= board.bridges) status = T.status.bridge;
    $('untangle-status').textContent = status;
    const record = round.mode === 'record';
    $('untangle-off-line').hidden = !record;
    $('untangle-off').textContent = String(round.off.length);
    $('untangle-best-line').hidden = !record || round.best === null;
    $('untangle-best').textContent = round.best === null ? '' : String(round.best);
    $('undo').disabled = !playing || round.moves.length === 0;
    $('reset').disabled = !playing || round.moves.length === 0;

    $('untangle-maybe').hidden = !hasImpossible(round);
    $('untangle-impossible').disabled = !playing;
    $('untangle-bridge-note').hidden = !(board.bridges > 0);
    $('untangle-record').hidden = !record;
    $('untangle-again').hidden = !(record && playing && problems.count === 0 && round.moves.length > 0);
    $('untangle-stop').hidden = !(record && playing && round.best !== null);
    const looking = playing && round.loopOn;
    $('untangle-loop').textContent = T.tool[looking ? 'on' : 'off'];
    $('untangle-loop').setAttribute('aria-pressed', String(looking));
    $('untangle-loop').disabled = round.done;
    frame.showWhy();
  }

  /** 점 하나를 끌어 다른 자리에 놓았다 */
  function moveDot(dot, to) {
    const { round } = frame;
    if (!round || round.done) return;
    if (!canPlace(round.points, dot, to)) {
      draw();
      return;
    }
    const from = round.points[dot];
    round.points = round.points.map((point, index) => (index === dot ? to.slice() : point));
    round.moves = [...round.moves, { dot, from: from.slice(), to: to.slice() }].slice(-MAX_MOVES);
    round.moveCount += 1;
    const problems = problemsNow(round);
    frame.note('move', { dot, to, left: problems.count });
    changed(problems);
  }

  /** 가장 적게 빼기: 선을 누르면 빠지고, 빠진 선을 누르면 돌아온다 */
  function toggleEdge(index) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'record') return;
    const off = !round.off.includes(index);
    round.off = off ? sortNumbers([...round.off, index]) : round.off.filter((item) => item !== index);
    round.moves = [...round.moves, { edge: index, off }].slice(-MAX_MOVES);
    round.edgeCount += 1;
    const problems = problemsNow(round);
    frame.note('edge', { edge: index, off, left: problems.count });
    changed(problems);
  }

  /** 판이 바뀐 뒤: 겹친 곳이 가장 적었던 수를 적고, 다 풀렸으면 끝낸다(가장 적게 빼기는 한 번을 끝낸다) */
  function changed(problems) {
    const { round } = frame;
    round.fewest = Math.min(round.fewest, problems.count);
    if (round.mode === 'record') {
      const clean = problems.count === 0;
      if (clean && (round.lastDone === null || round.off.length < round.lastDone)) {
        complete();
        return;
      }
      if (!clean) round.lastDone = null;
    } else if (untangled(round.points, round.board.edges, round.board.bridges)) {
      submit('untangled');
      return;
    }
    draw();
    frame.persist();
  }

  /** 가장 적게 빼기에서 겹친 곳이 없어졌다: 한 번이 끝났다. 뺀 선의 수를 말하고, 가장 적게 뺀 것이 아니면 더 적게 뺄 수 있을지 묻는다 */
  function complete() {
    const { round, solution } = frame;
    const k = round.off.length;
    const before = round.best;
    round.lastDone = k;
    round.completions = [...round.completions, k];
    round.tries = [...round.tries, { off: round.off.slice(), points: round.points.map((point) => point.slice()) }].slice(-MAX_TRIES);
    if (before === null || k < before) {
      round.best = k;
      round.bestOff = round.off.slice();
    }
    const reached = k === solution.best;
    const guess = reached ? null : 'more-than-best';
    round.answers.push({ t: frame.stamp(), answer: `off:${k}`, correct: reached, guess });
    frame.note('answer', { answer: `off:${k}`, correct: reached, guess });
    if (reached) {
      frame.finish('solved');
      return;
    }
    // 틀렸다고 하지 않는다. 뺀 선의 수를 말하고 더 적게 뺄 수 있을지 묻는다. 판은 그대로 둔다.
    frame.persist();
    draw();
    frame.say(fill(before !== null && k < before ? T.play['record-down'] : T.play['record-done'], { k }));
  }

  /** "여기까지 할래요": 지금까지 가장 적게 뺀 것으로 판을 끝낸다. 이것도 끝까지 한 판이다. */
  function stop() {
    const { round } = frame;
    if (round.done || round.best === null) return;
    round.stopped = true;
    frame.note('stop', { best: round.best });
    frame.finish('solved');
  }

  /** 답: 다 풀었다('untangled') 또는 "불가능해요"('impossible') */
  function submit(kind) {
    const { round, solution } = frame;
    if (round.done) return;
    const correct = kind === 'untangled' || !solution.possible;
    const guess = correct ? null : 'impossible-on-possible';
    round.answers.push({ t: frame.stamp(), answer: kind, correct, guess });
    frame.note('answer', { answer: kind, correct, guess });
    if (correct) {
      frame.finish('solved');
      return;
    }
    // 풀 수 있는 그림이다. 틀렸다고 하지 않고 사실만 말한다. 판은 그대로 이어진다.
    round.impossibleCount += 1;
    frame.persist();
    draw();
    frame.say(round.impossibleCount === 1 ? T.play['possible-press'] : fill(T.play['possible-press-fewest'], { n: round.fewest }));
  }

  /** 가장 적게 빼기에서 무르거나 되돌린 뒤: 지금 모습이 다 풀린 모습이면, 거기서 더 적게 뺄 때 다시 센다 */
  function settle() {
    const { round } = frame;
    if (round.mode !== 'record') return;
    const clean = problemsNow(round).count === 0;
    round.lastDone = clean ? Math.min(round.lastDone ?? round.off.length, round.off.length) : null;
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    const last = round.moves[round.moves.length - 1];
    round.moves = round.moves.slice(0, -1);
    if (last.dot !== undefined) {
      if (canPlace(round.points, last.dot, last.from)) round.points = round.points.map((point, index) => (index === last.dot ? last.from.slice() : point));
    } else round.off = last.off ? round.off.filter((item) => item !== last.edge) : sortNumbers([...round.off, last.edge]);
    round.undoCount += 1;
    settle();
    frame.note('undo');
    draw();
    frame.persist();
  }

  /** 처음 모습으로 되돌린다. 가장 적게 빼기에서 다 풀린 모습이었다면 "다시 해 보기"로 적는다 */
  function reset() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    const clean = round.mode === 'record' && problemsNow(round).count === 0;
    round.points = round.board.points.map((point) => point.slice());
    round.off = [];
    round.moves = [];
    if (clean) {
      round.retryCount += 1;
      frame.note('again');
    } else {
      round.resetCount += 1;
      frame.note('reset');
    }
    settle();
    draw();
    frame.persist();
  }

  /** "고리 하나 보기": 가장 긴 고리 하나를 굵게 그린다 */
  function toggleLoop() {
    const { round } = frame;
    if (!round || round.done) return;
    round.loopOn = !round.loopOn;
    if (round.loopOn) {
      round.loopShown = true;
      round.loopCount += 1;
    }
    frame.note('loop', { on: round.loopOn });
    draw();
    frame.persist();
    if (round.loopOn && loopEdges(round).length === 0) frame.say(T.play['loop-none']);
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    const parts = [];
    if (round.mode === 'record') {
      const tries = round.completions.length;
      if (round.stopped) {
        if (tries > 1) parts.push(fill(T.right['record-stopped-tries'], { n: tries }));
        parts.push(fill(T.right['record-stopped'], { k: round.best }));
        return parts;
      }
      parts.push(fill(T.right['record-best'], { k: solution.best }));
      parts.push(tries <= 1 ? T.right['record-first'] : fill(T.right['record-after'], { n: tries }));
      return parts;
    }
    const last = round.answers.at(-1);
    if (last.answer === 'impossible') {
      parts.push(round.moveCount > 0 ? fill(T.right['impossible-tried'], { n: round.moveCount }) : T.right['impossible-untried']);
      return parts;
    }
    const back = round.undoCount + round.resetCount;
    if (round.board.bridges > 0 && problemsNow(round).crossings.length > 0) parts.push(fill(T.right.bridge, { n: round.moveCount }));
    else if (back === 0) parts.push(fill(T.right['untangled-clean'], { n: round.moveCount }));
    else parts.push(fill(T.right['untangled-back'], { k: back, n: round.moveCount }));
    if (round.impossibleCount > 0) parts.push(T.right['after-press']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 뼈대의 선을 원래 그림의 선 번호로 */
  function coreView(edges, core) {
    const keys = new Map(edges.map(([a, b], index) => [edgeKey(a, b), index]));
    return { edges: core.edges.map(([a, b]) => keys.get(edgeKey(a, b))), points: core.branch };
  }

  /** "왜 그럴까?": 선생님이 집 셋과 우물 셋을 여러 번 옮겨 보다가 고리의 안쪽과 바깥쪽을 따진 이야기 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [
          rowOf(
            slide.figures.map((item) =>
              tangleCard({ points: item.points, edges: item.edges, roles: item.roles ?? null, loop: item.loop ?? [], off: item.off ?? [], bends: item.bends ?? {} }, item.note),
            ),
          ),
        ];
      },
    }));
  }

  /** 풀이: 겹친 곳 없이 놓은 모습, 다리 하나로 놓은 모습, 풀 수 없는 그림의 뼈대, 가장 적게 빼는 선 */
  function solutionPages(round, solution) {
    const { board } = round;
    const n = board.points.length;
    const base = { edges: board.edges, roles: board.roles };
    if (round.mode === 'record') {
      const view = { ...base, points: solution.restLayout, off: solution.removed };
      return [{ say: fill(T.solution.record, { k: solution.best }), nodes: [rowOf([tangleCard(view, '', true)])] }];
    }
    if (solution.planar) return [{ say: T.solution.possible, nodes: [rowOf([tangleCard({ ...base, points: solution.layout }, '', true)])] }];
    if (solution.bridgeLayout) return [{ say: T.solution.bridge, nodes: [rowOf([tangleCard({ ...base, points: solution.bridgeLayout, bridges: board.bridges }, '', true)])] }];
    // 풀 수 없는 그림: 가장 적게 뺀 나머지를 겹치지 않게 놓고 뺀 선을 다시 그린 모습에 뼈대를 표시한다.
    // 점이 여섯 이하면 엇갈린 곳이 점에서 떨어지게 펴서 놓은 자리를 찾아 쓴다(못 찾으면 다른 방법으로).
    const { best, removed } = fewestRemovals(n, board.edges);
    const points = (n <= 6 ? bridgeLayoutOf(n, board.edges, best) : null) ?? layoutOf(n, board.edges.filter((_, index) => !removed.includes(index)));
    const view = { ...base, points, core: coreView(board.edges, solution.core) };
    return [{ say: fill(T.solution.impossible, { face: T.solution.faces[solution.core.kind] }), nodes: [rowOf([tangleCard(view, '', true)])] }];
  }

  // ---- 직접 만들기: 빈 곳을 눌러 점을 놓고, 점 둘을 차례로 눌러 선을 잇는다. 점은 끌어 옮긴다. ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    if (saved && Array.isArray(saved.points) && saved.points.length === 0 && Array.isArray(saved.edges) && saved.edges.length === 0) return { points: [], edges: [] };
    if (saved && checkBoard({ points: saved.points, edges: saved.edges }, { allowEmpty: true }) === null) return { points: saved.points.map((point) => point.slice()), edges: sortEdges(saved.edges) };
    return { points: T.blank.points.map((point) => point.slice()), edges: [] };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    draftPick = null;
    erasing = false;
    shownCore = null;
    $('untangle-make-result').textContent = '';
    $('untangle-make-picture').replaceChildren();
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    drawTangle($('untangle-make-board'), {
      points: draft.points,
      edges: draft.edges,
      picked: draftPick === null ? [] : [draftPick],
      core: shownCore,
      live: true,
      label: pointLabelOf(null),
      edgeLabel: edgeLabelOf(draft.edges),
      onMove: moveDraft,
      onPoint: tapDraftPoint,
      onEdge: (index) => changeDraft({ points: draft.points, edges: draft.edges.filter((_, at) => at !== index) }),
      onEmpty: addDraftPoint,
    });
    $('untangle-make-count').textContent = fill(T.make.count, { n: draft.points.length, k: draft.edges.length });
    $('untangle-make-clear').disabled = draft.points.length === 0;
    $('untangle-make-solve').disabled = draft.edges.length === 0;
    $('untangle-make-play').disabled = draft.edges.length === 0;
    for (const button of $('untangle-make-tools').querySelectorAll('button')) button.setAttribute('aria-pressed', String((button.dataset.tool === 'erase') === erasing));
  }

  function changeDraft(next) {
    draft = { points: next.points.map((point) => point.slice()), edges: sortEdges(next.edges) };
    draftPick = null;
    shownCore = null;
    $('untangle-make-result').textContent = '';
    $('untangle-make-picture').replaceChildren();
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  function addDraftPoint(at) {
    if (erasing) return;
    if (draft.points.length >= MAX_POINTS) {
      frame.talkers.make.say(fill(T.make.full, { n: MAX_POINTS }));
      return;
    }
    changeDraft({ points: [...draft.points, at], edges: draft.edges });
  }

  function moveDraft(index, to) {
    if (!canPlace(draft.points, index, to)) {
      drawMake();
      return;
    }
    changeDraft({ points: draft.points.map((point, at) => (at === index ? to : point)), edges: draft.edges });
  }

  /** 점을 눌렀다: 점 빼기 중이면 그 점과 이어진 선을 뺀다. 아니면 먼저 누른 점과 선으로 잇는다(이미 이어져 있으면 선을 뺀다) */
  function tapDraftPoint(index) {
    if (erasing) {
      const shift = (v) => (v > index ? v - 1 : v);
      changeDraft({
        points: draft.points.filter((_, at) => at !== index),
        edges: draft.edges.filter(([a, b]) => a !== index && b !== index).map(([a, b]) => [shift(a), shift(b)]),
      });
      return;
    }
    if (draftPick === null || draftPick === index) {
      draftPick = draftPick === index ? null : index;
      drawMake();
      return;
    }
    const key = edgeKey(draftPick, index);
    const has = draft.edges.some(([a, b]) => edgeKey(a, b) === key);
    const pair = [Math.min(draftPick, index), Math.max(draftPick, index)];
    changeDraft({ points: draft.points, edges: has ? draft.edges.filter(([a, b]) => edgeKey(a, b) !== key) : [...draft.edges, pair] });
  }

  /** 아이가 만든 그림을 풀이 프로그램으로 따져서 알려 준다. 풀 수 있으면 푼 모습을, 없으면 뼈대를 보여 준다. */
  function solveDraft() {
    if (draft.edges.length === 0) return;
    const n = draft.points.length;
    const board = { points: draft.points.map((point) => point.slice()), edges: sortEdges(draft.edges), roles: null, bridges: 0 };
    const planar = isPlanar(n, board.edges);
    let line;
    let layout = null;
    let core = null;
    if (planar) {
      layout = layoutOf(n, board.edges);
      line = problemsOf(board.points, board.edges).count === 0 ? T.make.flat : T.make.planar;
      shownCore = null;
      $('untangle-make-picture').replaceChildren(tangleCard({ points: layout, edges: board.edges, small: true }, ''));
    } else {
      core = coreOf(n, board.edges);
      shownCore = coreView(board.edges, core);
      line = fill(T.make.impossible, { face: T.solution.faces[core.kind] });
      $('untangle-make-picture').replaceChildren();
    }
    drawMake();
    $('untangle-make-result').textContent = line;
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { possible: planar, planar, layout, core: core ? { kind: core.kind, branch: core.branch } : null },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판): 만든 그림을 엉키게 놓은 것. 선이 없거나 엇갈릴 수 없는 그림이면 null */
  const madeBoard = () => (draft && draft.edges.length > 0 ? tangleMade(draft.points, draft.edges) : null);

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
    else frame.talkers.make.say(T.make['keep-not-yet']);
  }

  // ---- 단추 잇기 ----
  $('untangle-impossible').addEventListener('click', () => submit('impossible'));
  $('untangle-again').addEventListener('click', reset);
  $('untangle-stop').addEventListener('click', stop);
  $('untangle-loop').addEventListener('click', toggleLoop);
  $('untangle-make-tools').addEventListener('click', (event) => {
    const tool = event.target.closest('button')?.dataset.tool;
    if (!tool) return;
    erasing = tool === 'erase';
    draftPick = null;
    drawMake();
  });
  $('untangle-make-clear').addEventListener('click', () => changeDraft({ points: [], edges: [] }));
  $('untangle-make-solve').addEventListener('click', solveDraft);
  $('untangle-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    const start = copyBoard(board);
    return {
      mode: custom ? 'mix' : rungOf(level).mode,
      board: start, // 판: 처음 자리, 선, 옷, 다리의 수
      points: start.points.map((point) => point.slice()), // 지금 점의 자리
      off: [], // 가장 적게 빼기에서 빼 둔 선의 번호
      moves: [], // 무르기에 쓰는 차례: { dot, from, to } 또는 { edge, off }
      moveCount: 0, // 점을 옮긴 수(무른 것도 센다)
      edgeCount: 0, // 선을 빼거나 돌려놓은 수
      undoCount: 0,
      resetCount: 0, // 하던 가운데 처음으로 되돌린 수
      retryCount: 0, // 가장 적게 빼기에서 다 푼 뒤 처음부터 다시 해 본 수
      fewest: problemsOf(start.points, start.edges).count, // 지금까지 겹친 곳이 가장 적었던 수
      impossibleCount: 0, // 풀 수 있는 그림에 "불가능해요"를 누른 수
      completions: [], // 가장 적게 빼기에서 한 번이 끝날 때마다의 뺀 선 수
      tries: [], // 그때의 뺀 선과 점의 자리
      best: null, // 이 판에서 지금까지 가장 적게 뺀 수
      bestOff: [],
      lastDone: null, // 다 풀린 모습이 이어지는 동안 마지막으로 센 뺀 선 수
      stopped: false, // "여기까지 할래요"로 끝냈는가
      loopOn: false, // 지금 고리를 보고 있는가
      loopShown: false, // 고리를 한 번이라도 보았는가
      loopCount: 0, // 고리 보기를 켠 수
    };
  }

  /** 적어 둔 무르기 차례 하나가 쓸 수 있는 값인가 */
  function validMove(saved, move) {
    if (!move || typeof move !== 'object') return false;
    if (move.dot !== undefined) return Number.isInteger(move.dot) && move.dot >= 0 && move.dot < saved.points.length && pointsOk([move.from], 1) && pointsOk([move.to], 1);
    return saved.mode === 'record' && Number.isInteger(move.edge) && move.edge >= 0 && move.edge < saved.board.edges.length && typeof move.off === 'boolean';
  }

  return {
    id: FORMAT,
    T,
    padId: 'untangle-pad',
    makeId: 'make-untangle',
    // 그림판이 가로로 넓어서 세로가 모자라다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다.
    ruleAside: true,
    homeIds: { sample: 'home-untangle-sample', blank: 'home-untangle-blank', ask: 'home-untangle-ask', play: 'home-untangle-play', pick: 'home-untangle-pick', make: 'home-untangle-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board, round.mode),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      const { board } = saved;
      if (!pointsOk(saved.points, board.points.length)) return false;
      if (!Array.isArray(saved.off) || !saved.off.every((index) => Number.isInteger(index) && index >= 0 && index < board.edges.length)) return false;
      if (saved.off.length > 0 && saved.mode !== 'record') return false;
      if (!Array.isArray(saved.moves) || !saved.moves.every((move) => validMove(saved, move))) return false;
      if (![saved.completions, saved.tries, saved.bestOff].every(Array.isArray)) return false;
      if (![saved.loopOn, saved.loopShown, saved.stopped].every((value) => typeof value === 'boolean')) return false;
      if (![saved.moveCount, saved.edgeCount, saved.undoCount, saved.resetCount, saved.retryCount, saved.fewest, saved.impossibleCount, saved.loopCount].every(count)) return false;
      return (saved.best === null || count(saved.best)) && (saved.lastDone === null || count(saved.lastDone));
    },
    /** 판 화면에서 이 형식의 것(그림, 판 아래의 글, 고리 보기 단추)을 보이거나 감춘다 */
    showParts(on) {
      $('untangle-board').hidden = !on;
      $('untangle-count').hidden = !on;
      $('untangle-loop').hidden = !on;
      if (on) {
        // 이 형식은 틀의 형식 목록에서 맨 뒤라, 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {},
    draw,
    ended() {},
    ruleLine: (round) => T.rules[ruleKey(round)],
    hints: (round) => T.hints[hintKey(round)],
    touched: (round) => round.moveCount > 0 || round.edgeCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      return { points: round.points.map((point) => point.slice()), off: round.off.slice(), left: problemsNow(round).count, moves: round.moveCount };
    },
    /** 이 판보다 작은 판: 점이 더 적은 같은 종류의 그림. 풀 수 없는 그림이면 뼈대에서 선 하나를 뺀 그림과 뼈대 */
    smaller: (round, turn) => smallerUntangle({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const problems = problemsNow(round);
      const record = round.mode === 'record';
      const answer = { possible: solution.possible, planar: solution.planar, kind: solution.core?.kind ?? null };
      if (record) Object.assign(answer, { best: solution.best, removed: solution.removed });
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: answer,
        // 질문 힌트와 "고리 하나 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.loopShown ? 1 : 0),
        loopShown: round.loopShown,
        loopCount: round.loopCount,
        // 판을 떠날 때의 자리와 겹친 곳의 수, 지금까지 가장 적었던 겹친 곳의 수
        points: round.points,
        off: round.off,
        left: problems.count,
        fewest: round.fewest,
        moveCount: round.moveCount,
        edgeCount: round.edgeCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        impossibleCount: round.impossibleCount,
        // 수준 맞추기가 보는 "틀린 답"의 수: 풀 수 있는 그림에 누른 "불가능해요", 가장 적게 빼기에서는 가장 적지 않았던 한 번들
        wrongCount: record ? round.completions.filter((k) => k !== solution.best).length : round.impossibleCount,
        completions: round.completions,
        tries: round.tries,
        retries: Math.max(0, round.completions.length - 1),
        retryCount: round.retryCount,
        best: round.best,
        bestOff: round.bestOff,
        reachedBest: record && round.best !== null && round.best === solution.best,
        stopped: round.stopped === true,
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
      drawTangle(root, { points: board.points, edges: board.edges, roles: board.roles ?? null, bridges: board.bridges ?? 0, small: true, fit: true });
    },
    drawBlank(root) {
      drawTangle(root, { points: T.blank.points, edges: [], small: true, fit: true });
    },
    drawResume(root, saved) {
      drawTangle(root, { points: saved.points, edges: saved.board.edges, roles: saved.board.roles ?? null, off: saved.off ?? [], bridges: saved.board.bridges ?? 0, small: true, fit: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 그림 하나 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture.blank ? T.blank : entry.picture;
      drawTangle(root, { points: picture.points, edges: picture.edges, roles: picture.roles ?? null, off: picture.off ?? [], small: true, fit: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(엉키게 놓은 것). 아직 해 볼 수 있는 판이 아니면 null(공책에 남기기가 쓴다) */
    madeBoard,
    /**
     * 가장 좋은 기록(공책에 저절로 남는다). 가장 적게 빼기 판에서 한 번도 다 풀지 않았으면 null.
     * 공책은 값이 클수록 좋은 기록으로 보므로, 적게 뺄수록 커지게 뺀 수에 마이너스를 붙여 건넨다.
     */
    bestOf: (round) => (round.mode !== 'record' || round.best === null ? null : { value: -round.best, name: fill(T.notebook.best, { k: round.best }) }),
  };
}
