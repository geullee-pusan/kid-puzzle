// 조건 맞춰 잇기: 판 화면에서 이 형식이 맡는 부분(판, 선 긋기와 지우기, "불가능해요", 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/degree.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 점은 동그라미 위에 놓이고 점마다 그 점에서 나가야 할 선의 수가 적혀 있다. 점 둘레의 작은 동그라미가 지금 선의 수만큼 채워진다.
// 점을 누르면 고르고, 다른 점을 누르면 두 점 사이에 선이 생긴다(이미 있으면 없어진다). 고른 점은 다시 누를 때까지 그대로라
//   한 점에서 여러 선을 잇달아 그을 수 있다. 선을 누르면 없어진다. 두 점 사이에는 선이 하나뿐이고 제자리로 돌아오는 선은 없다.
// 모든 점이 수만큼 이어지면 끝난다. 수보다 많이 이어진 점이 있어도 막지 않고 판 아래에 그 사실을 적는다.
// 안 되는 판이 섞이는 단계(모두 셋씩, 될까요 안 될까요, 큰 수가 있는 판, 모든 경우 따져 보기)와 직접 만든 판에는 "불가능해요" 단추가 있다.
//   되는 판에 누르면 틀렸다고 하지 않고 이을 수 있는 판이라는 사실만 말한다. 판은 그대로 이어진다.
//   안 되는 판을 "불가능해요"로 끝내면 풀이 프로그램이 구한 까닭 하나(모두 더하면 홀수, 이을 수 있는 점보다 큰 수, 모든 경우를 따져 봐야 아는 판)를 말한다.
// 왼쪽 칸의 도구(처음 켤 때 힌트 하나로 센다. 무엇을 뜻하는지는 말하지 않는다):
//   선 끝 세기: 판 아래에 지금 선의 끝의 수와 점마다의 수를 모두 더한 수를 적는다(모든 단계와 직접 만든 판).
//   모든 경우 펼쳐 보기: 지금 판에서 더 이어야 할 선이 가장 많은 점이 그 선들을 마저 잇는 모든 방법을 오른쪽 칸에 작은 판으로 그린다
//     (모든 경우 따져 보기와 직접 만든 판). 방법이 없으면 이을 수 있는 점이 몇 개인지 적는다.
import T from '../content/degree.json';
import { LADDER, MAKE_FIRST, MAKE_LEVEL, MAKE_POINTS, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/degree-ladder.js';
import { MAX_HISTORY, MAX_NEED, caseTree, casesNow, checkBoard, copyBoard, isDone, lineIndex, lineOf, linesOk, partnersOf, solve, stateOf, sumOf } from '../core/degree.js';
import { smallerDegree } from '../core/smaller.js';
import { fill } from '../core/text.js';
import { boardCard, drawBoard } from '../ui/degree-board.js';

const FORMAT = 'degree';
const MODES = ['three', 'mixed', 'parity', 'big', 'search', 'made'];
/** 모든 경우 펼쳐 보기에 그리는 방법의 위 끝 */
const SHOW_WAYS = 4;
/** 풀이에 그리는 경우의 위 끝 */
const SHOW_LEAVES = 6;

const count = (value) => Number.isInteger(value) && value >= 0;

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createDegree(frame) {
  const { $, log } = frame;
  let picked = null; // 고른 점
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 만들던 판 { need }
  let chosen = 0; // 직접 만들기에서 고른 점
  let made = null; // 직접 만들기에서 선생님이 따진 것 { line, lines }(판을 고치면 지운다)

  const names = T.names;
  const nameOf = (at) => names[at];
  const namesOf = (list) => list.map(nameOf).join(T.words.join);
  /** "불가능해요" 단추가 있는 판: 안 되는 판이 섞이는 단계와 직접 만든 판 */
  const hasImpossible = (round) => round.mode !== 'mixed';
  /** "모든 경우 펼쳐 보기"가 있는 판 */
  const hasCases = (round) => round.mode === 'search' || round.mode === 'made';
  const ruleKey = (round) => (round.mode === 'three' ? 'three' : 'each');
  const labels = {
    point: (at, need, has) => fill(T.labels.point, { f: nameOf(at), k: need, n: has }),
    line: (a, b) => fill(T.labels.line, { f: fill(T.words.pair, { f: nameOf(a), face: nameOf(b) }) }),
  };

  // ---- 판 ----
  function draw() {
    const { round, solution } = frame;
    const { board } = round;
    const playing = !round.done;
    const state = stateOf(board, round.lines);
    const answered = round.answers.at(-1)?.answer === 'impossible';
    // 안 되는 판을 끝냈으면 까닭을 판에 보인다(홀수인 점의 테두리, 큰 수의 점)
    const reason = !playing && solution?.possible === false ? solution.reason : null;
    drawBoard($('degree-board'), {
      need: board.need,
      lines: round.lines,
      names,
      picked: playing ? picked : null,
      odd: reason === 'odd',
      stuck: reason === 'big' ? solution.big[0] : null,
      label: playing ? labels : undefined,
      onPoint: playing ? tapPoint : undefined,
      onLine: playing ? tapLine : undefined,
    });
    $('degree-lines').textContent = String(state.lines);
    $('degree-full').textContent = String(state.full.length);
    $('degree-points').textContent = String(board.need.length);
    $('degree-ends-line').hidden = !round.endsOn;
    $('degree-ends').textContent = String(state.ends);
    $('degree-sum').textContent = String(sumOf(board.need));
    $('degree-status').textContent = flash ?? statusOf(round, state, answered);
    $('undo').disabled = !playing || round.history.length === 0;
    $('reset').disabled = !playing || round.lines.length === 0;

    // 오른쪽 칸: "불가능해요", 모든 경우 펼쳐 보기
    $('degree-maybe').hidden = !hasImpossible(round);
    $('degree-impossible').disabled = !playing;
    const looking = playing && round.casesOn && hasCases(round);
    $('degree-cases-box').hidden = !looking;
    if (looking) drawCases(round);

    // 왼쪽 칸: 선 끝 세기, 모든 경우 펼쳐 보기
    $('degree-ends-tool').textContent = T.tool[round.endsOn ? 'ends-on' : 'ends-off'];
    $('degree-ends-tool').setAttribute('aria-pressed', String(round.endsOn));
    $('degree-cases-tool').hidden = !hasCases(round);
    $('degree-cases-tool').disabled = !playing;
    $('degree-cases-tool').textContent = T.tool[looking ? 'cases-on' : 'cases-off'];
    $('degree-cases-tool').setAttribute('aria-pressed', String(looking));
    frame.showWhy();
  }

  function statusOf(round, state, answered) {
    if (round.done) {
      if (answered) return T.status.impossible;
      return state.done ? T.status.done : '';
    }
    // 수보다 많이 이어진 점이 있으면 그것부터 적는다(고른 점은 판에 금빛 고리로 보인다)
    if (state.over.length > 0) return fill(T.status.over, { f: nameOf(state.over[0]) });
    if (picked !== null) return fill(T.status.picked, { f: nameOf(picked) });
    return T.status.start;
  }

  /** 모든 경우 펼쳐 보기: 더 이어야 할 선이 가장 많은 점이 그 선들을 마저 잇는 방법들 */
  function drawCases(round) {
    const { need } = round.board;
    const cases = casesNow(need, round.lines);
    const nodes = [];
    if (cases.point < 0) nodes.push(paragraph(T.cases.full));
    else if (cases.ways.length === 0) nodes.push(paragraph(fill(T.cases[cases.open === 0 ? 'none-zero' : 'none'], { f: nameOf(cases.point), k: cases.left, n: cases.open })));
    else {
      nodes.push(paragraph(fill(T.cases.ways, { f: nameOf(cases.point), k: cases.left, n: cases.ways.length })));
      const row = document.createElement('div');
      row.className = 'dg-ways';
      for (const way of cases.ways.slice(0, SHOW_WAYS)) {
        const partners = way.map(([a, b]) => (a === cases.point ? b : a));
        row.append(boardCard({ need, lines: round.lines, fresh: way, names }, fill(T.cases.note, { f: namesOf(partners) }), { mini: true }));
      }
      nodes.push(row);
      if (cases.ways.length > SHOW_WAYS) nodes.push(paragraph(fill(T.cases.more, { n: SHOW_WAYS })));
    }
    $('degree-cases-list').replaceChildren(...nodes);
  }

  function paragraph(text) {
    const node = document.createElement('p');
    node.className = 'pad-note';
    node.textContent = text;
    return node;
  }

  // ---- 선 긋기와 지우기 ----
  /** 점을 눌렀다: 고른 점이 없으면 고르고, 고른 점이면 고르기를 그만두고, 다른 점이면 두 점 사이의 선을 긋거나 지운다 */
  function tapPoint(at) {
    const { round } = frame;
    if (!round || round.done) return;
    flash = null;
    if (picked === null) {
      picked = at;
      frame.note('pick', { point: at });
      draw();
      return;
    }
    if (picked === at) {
      picked = null;
      flash = T.status.unpicked;
      draw();
      return;
    }
    const index = lineIndex(round.lines, picked, at);
    if (index >= 0) change(round.lines.filter((_, other) => other !== index), 'remove', lineOf(picked, at));
    else change([...round.lines, lineOf(picked, at)], 'add', lineOf(picked, at));
  }

  /** 선을 눌렀다: 그 선이 없어진다 */
  function tapLine(index) {
    const { round } = frame;
    if (!round || round.done || index < 0 || index >= round.lines.length) return;
    flash = null;
    change(round.lines.filter((_, other) => other !== index), 'remove', round.lines[index]);
  }

  /** 선들을 바꾼다. 다 이어졌으면 끝낸다 */
  function change(next, how, [a, b]) {
    const { round } = frame;
    const before = stateOf(round.board, round.lines).over.length;
    round.history = [...round.history, round.lines].slice(-MAX_HISTORY);
    round.lines = next;
    round.moveCount += 1;
    if (how === 'add') round.addCount += 1;
    else round.removeCount += 1;
    const state = stateOf(round.board, next);
    if (state.over.length > before) round.overCount += 1;
    frame.note(how, { a, b, lines: next.length });
    if (state.done) {
      picked = null;
      round.answers.push({ t: frame.stamp(), answer: `lines:${next.map((line) => line.join('-')).join(',')}`, correct: true, guess: null });
      frame.note('answer', { answer: 'done', correct: true });
      frame.finish('solved');
      return;
    }
    flash = state.over.length > 0 ? null : T.status[how === 'add' ? 'added' : 'removed'];
    draw();
    frame.persist();
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.history.length === 0) return;
    round.lines = round.history.at(-1);
    round.history = round.history.slice(0, -1);
    round.undoCount += 1;
    picked = null;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 모습에 한 말은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  /** 처음으로: 선을 모두 지운다. 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (round.done || round.lines.length === 0) return;
    round.history = [...round.history, round.lines].slice(-MAX_HISTORY);
    round.lines = [];
    round.resetCount += 1;
    picked = null;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  // ---- "불가능해요"와 도구 ----
  /** 되는 판이면 틀렸다고 하지 않고 이을 수 있는 판이라는 사실만 말한다. 판은 그대로 이어진다 */
  function sayImpossible() {
    const { round, solution } = frame;
    if (!round || round.done || !hasImpossible(round)) return;
    const correct = solution.possible === false;
    const guess = correct ? null : 'impossible-on-possible';
    round.answers.push({ t: frame.stamp(), answer: 'impossible', correct, guess });
    frame.note('answer', { answer: 'impossible', correct, guess });
    picked = null;
    flash = null;
    if (correct) {
      frame.finish('solved');
      return;
    }
    round.impossibleCount += 1;
    round.wrongCount += 1;
    draw();
    frame.persist();
    frame.say(T.play['possible-press']);
  }

  /** 선 끝 세기: 판 아래에 선의 끝의 수와 점마다의 수를 모두 더한 수를 적는다. 처음 켤 때 힌트 하나로 센다 */
  function toggleEnds() {
    const { round } = frame;
    if (!round) return;
    round.endsOn = !round.endsOn;
    if (round.endsOn) {
      round.endsShown = true;
      round.endsCount += 1;
    }
    frame.note('ends', { on: round.endsOn });
    draw();
    frame.keep();
  }

  /** 모든 경우 펼쳐 보기. 처음 켤 때 힌트 하나로 센다 */
  function toggleCases() {
    const { round } = frame;
    if (!round || round.done || !hasCases(round)) return;
    round.casesOn = !round.casesOn;
    if (round.casesOn) {
      round.casesShown = true;
      round.casesCount += 1;
    }
    frame.note('cases', { on: round.casesOn });
    draw();
    frame.keep();
  }

  // ---- 끝났을 때 하는 말: 한 일과 사실만 말한다 ----
  /** 안 되는 까닭 한 줄(풀이 프로그램이 구한 것) */
  function reasonLine(group, solution, need) {
    if (solution.reason === 'odd') return fill(group['reason-odd'], { n: solution.sum });
    if (solution.reason === 'big') {
      const at = solution.big[0];
      return fill(group['reason-big'], { f: nameOf(at), k: need[at], n: partnersOf(need, at) });
    }
    if (solution.leaves === 1) return group['reason-search-one'];
    if (solution.leaves === null) return group['reason-search-many'];
    return fill(group['reason-search'], { n: solution.leaves });
  }

  function rightLine(round, solution) {
    const { need } = round.board;
    if (round.answers.at(-1)?.answer === 'impossible') {
      return [round.moveCount > 0 ? T.right['impossible-tried'] : T.right['impossible-untried'], reasonLine(T.right, solution, need)];
    }
    const parts = [fill(T.right.done, { n: round.lines.length })];
    if (round.impossibleCount > 0) parts.push(T.right['after-press']);
    if (round.endsOn) parts.push(fill(T.right.ends, { n: 2 * round.lines.length }));
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 막힌 점의 글 */
  const stuckNote = (stuck) => fill(T.solution[stuck.open === 0 ? 'stuck-zero' : 'stuck'], { f: nameOf(stuck.point), k: stuck.left, n: stuck.open });

  /** 모든 경우를 따져 봐야 아는 판의 그림: 갈래가 하나면 차례대로, 여럿이면 경우마다 한 장 */
  function searchPage(need) {
    const tree = caseTree(need, { limit: SHOW_LEAVES + 1 });
    if (tree.leaves.length === 1) {
      const [leaf] = tree.leaves;
      // 처음 판, 따진 점마다의 판(마지막 판에 막힌 점). 석 장까지는 조금 크게 그린다
      const pictures = [[{ need, names }, T.solution.start]];
      let lines = [];
      leaf.steps.forEach((step, at) => {
        lines = [...lines, ...step.lines];
        const last = at === leaf.steps.length - 1;
        pictures.push([{ need, lines, names, stuck: last ? leaf.stuck.point : null }, last ? stuckNote(leaf.stuck) : fill(T.solution.step, { f: nameOf(step.point), k: step.lines.length })]);
      });
      if (leaf.steps.length === 0) pictures.push([{ need, names, stuck: leaf.stuck.point }, stuckNote(leaf.stuck)]);
      const mid = pictures.length <= 3;
      return { say: T.solution['search-one'], nodes: [rowOf(pictures.map(([view, note]) => boardCard(view, note, { mid })))] };
    }
    const full = caseTree(need);
    const shown = tree.leaves.slice(0, SHOW_LEAVES);
    const cards = shown.map((leaf) => boardCard({ need, lines: leaf.lines, names, stuck: leaf.stuck.point }, stuckNote(leaf.stuck)));
    const say = full.cut ? T.solution['search-many'] : fill(T.solution.search, { n: full.leaves.length });
    const nodes = [rowOf(cards)];
    if (full.cut || full.leaves.length > SHOW_LEAVES) nodes.push(paragraph(fill(T.solution.more, { n: shown.length })));
    return { say, nodes };
  }

  function solutionPages(round, solution) {
    const { need } = round.board;
    if (solution.possible) {
      return [{ say: fill(T.solution.possible, { n: solution.lines.length }), nodes: [rowOf([boardCard({ need, lines: solution.lines, names }, fill(T.solution['note-possible'], { n: solution.lines.length }), { big: true })])] }];
    }
    if (solution.reason === 'odd') {
      return [{ say: fill(T.solution.odd, { n: solution.sum }), nodes: [rowOf([boardCard({ need, names, odd: true }, fill(T.solution['note-odd'], { n: solution.odd.length }), { big: true })])] }];
    }
    if (solution.reason === 'big') {
      const at = solution.big[0];
      const values = { f: nameOf(at), k: need[at], n: partnersOf(need, at) };
      return [{ say: fill(T.solution.big, values), nodes: [rowOf([boardCard({ need, names, stuck: at }, fill(T.solution['note-big'], values), { big: true })])] }];
    }
    return [searchPage(need)];
  }

  /** "왜 그럴까?": 선의 끝 세기 → 선 하나에 끝 둘 → 점 다섯이 모두 셋씩 → 홀수인 점은 짝수 개 → 홀수도 큰 수도 아닌데 안 되는 판 → 이름(마지막 장에만) */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다. 한 장뿐인 그림은 크게, 두세 장은 조금 크게 그린다
      get nodes() {
        const one = slide.figures.length === 1;
        return [rowOf(slide.figures.map((item) => boardCard({ need: item.need, lines: item.lines, names, ends: item.ends === true, odd: item.odd === true, stuck: item.stuck ?? null }, item.note, { big: one, mid: !one })))];
      },
    }));
  }

  // ---- 직접 만들기: 점의 수(3~8)와 점마다의 수(0~9)를 정하면 선생님이 따진다 ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const ok = saved && Array.isArray(saved.need) && saved.need.length >= MAKE_POINTS[0] && saved.need.length <= MAKE_POINTS[1] && saved.need.every((value) => Number.isInteger(value) && value >= 0 && value <= MAX_NEED);
    return { need: ok ? saved.need.slice() : MAKE_FIRST.slice() };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    chosen = 0;
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const { need } = draft;
    $('degree-make-n').textContent = fill(T.make.size, { n: need.length });
    $('degree-make-fewer').disabled = need.length <= MAKE_POINTS[0];
    $('degree-make-more').disabled = need.length >= MAKE_POINTS[1];
    $('degree-make-which').textContent = fill(T.make.which, { f: nameOf(chosen) });
    $('degree-make-k').textContent = String(need[chosen]);
    $('degree-make-less').disabled = need[chosen] <= 0;
    $('degree-make-plus').disabled = need[chosen] >= MAX_NEED;
    drawBoard($('degree-make-board'), {
      need,
      lines: made?.lines ?? [],
      names,
      picked: chosen,
      label: { point: (at, value) => fill(T.labels['make-point'], { f: nameOf(at), k: value }), line: () => '' },
      onPoint: choosePoint,
    });
    $('degree-make-result').textContent = made ? made.line : '';
  }

  function changeDraft(next) {
    const said = made !== null;
    draft = next;
    chosen = Math.min(chosen, draft.need.length - 1);
    made = null;
    log.saveDraft({ need: draft.need.slice() }, FORMAT);
    drawMake();
    // 앞의 대답은 바뀐 판에 맞지 않는다
    if (said) frame.talkers.make.say(T.make.changed);
  }

  function choosePoint(at) {
    chosen = at;
    drawMake();
  }

  /** 점의 수를 바꾼다: 늘리면 수가 2인 점을 끝에 더하고, 줄이면 끝의 점을 뺀다 */
  function resize(step) {
    const size = draft.need.length + step;
    if (size < MAKE_POINTS[0] || size > MAKE_POINTS[1]) return;
    changeDraft({ need: step > 0 ? [...draft.need, 2] : draft.need.slice(0, -1) });
  }

  function nudge(step) {
    const value = draft.need[chosen] + step;
    if (value < 0 || value > MAX_NEED) return;
    changeDraft({ need: draft.need.map((item, at) => (at === chosen ? value : item)) });
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판). 선이 하나도 없는 판(모든 수가 0)은 아니다 */
  function madeBoard() {
    if (!draft || checkBoard(draft) !== null) return null;
    return copyBoard(draft);
  }

  /** "선생님, 풀어 보세요": 이을 수 있는지, 없으면 까닭 하나. 이을 수 있으면 한 가지 방법을 판에 그린다 */
  function solveDraft() {
    const board = madeBoard();
    if (!board) {
      frame.talkers.make.say(T.make['keep-not-yet']);
      return;
    }
    const { need } = board;
    const result = solve(board);
    let line;
    if (result.possible) line = T.make.can;
    else if (result.reason === 'odd') line = fill(T.make.odd, { n: result.sum });
    else if (result.reason === 'big') line = fill(T.make.big, { f: nameOf(result.big[0]), k: need[result.big[0]], n: partnersOf(need, result.big[0]) });
    else line = result.leaves === null ? T.make.search : `${T.make.search} ${fill(T.make['search-count'], { n: result.leaves })}`;
    made = { line, lines: result.lines ?? [] };
    drawMake();
    const now = new Date().toISOString();
    log.saveRecord({ kind: 'made', v: 1, id: log.newId('m'), format: FORMAT, startedAt: now, endedAt: now, board, solution: { possible: result.possible, reason: result.reason, sum: result.sum, leaves: result.leaves } });
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
  $('degree-impossible').addEventListener('click', sayImpossible);
  $('degree-ends-tool').addEventListener('click', toggleEnds);
  $('degree-cases-tool').addEventListener('click', toggleCases);
  $('degree-make-fewer').addEventListener('click', () => resize(-1));
  $('degree-make-more').addEventListener('click', () => resize(1));
  $('degree-make-less').addEventListener('click', () => nudge(-1));
  $('degree-make-plus').addEventListener('click', () => nudge(1));
  $('degree-make-solve').addEventListener('click', solveDraft);
  $('degree-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    picked = null;
    flash = null;
    const mode = custom ? 'made' : rungOf(level).mode;
    return {
      mode,
      board: copyBoard(board), // 판: 점마다의 수
      lines: [], // 그은 선 [a, b](a < b)
      history: [], // 무르기를 위한 앞의 선들
      moveCount: 0, // 선을 긋거나 지운 수
      addCount: 0, // 그 가운데 그은 것
      removeCount: 0, // 그 가운데 지운 것
      overCount: 0, // 어떤 점이 수보다 많이 이어지게 된 수
      undoCount: 0,
      resetCount: 0,
      impossibleCount: 0, // 되는 판에 "불가능해요"를 누른 수
      wrongCount: 0, // 사실과 다른 답의 수(되는 판에 누른 "불가능해요")
      endsOn: false, // 지금 "선 끝 세기"를 켜 두었는가
      endsShown: false, // 한 번이라도 켰는가
      endsCount: 0, // 켠 수
      casesOn: false, // 지금 "모든 경우 펼쳐 보기"를 켜 두었는가
      casesShown: false,
      casesCount: 0,
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
    padId: 'degree-pad',
    makeId: 'make-degree',
    // 판이 동그라미라 위아래로 크다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다
    ruleAside: true,
    homeIds: { sample: 'home-degree-sample', blank: 'home-degree-blank', ask: 'home-degree-ask', play: 'home-degree-play', pick: 'home-degree-pick', make: 'home-degree-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solve(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null || !levelOk(saved)) return false;
      const n = saved.board.need.length;
      if (!linesOk(n, saved.lines) || !Array.isArray(saved.history) || !saved.history.every((lines) => linesOk(n, lines))) return false;
      if (isDone(saved.board, saved.lines)) return false;
      if (![saved.moveCount, saved.addCount, saved.removeCount, saved.overCount, saved.undoCount, saved.resetCount, saved.impossibleCount, saved.wrongCount, saved.endsCount, saved.casesCount].every(count)) return false;
      return [saved.endsOn, saved.endsShown, saved.casesOn, saved.casesShown].every((value) => typeof value === 'boolean');
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('degree-board').hidden = !on;
      $('degree-count').hidden = !on;
      $('degree-ends-tool').hidden = !on;
      // "모든 경우 펼쳐 보기"는 그 도구가 있는 판에서만 draw가 보인다
      if (!on) $('degree-cases-tool').hidden = true;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      picked = null;
      flash = null;
    },
    draw,
    ended() {
      picked = null;
      flash = null;
    },
    ruleLine: (round) => T.rules[ruleKey(round)],
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.moveCount > 0 || round.endsCount > 0 || round.casesCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const state = stateOf(round.board, round.lines);
      return { lines: round.lines.map((line) => line.slice()), full: state.full.length, over: state.over.length, endsOn: round.endsOn, casesOn: round.casesOn };
    },
    /** 이 판보다 작은 판: 점이 더 적은 같은 종류의 판(안 되는 판은 까닭이 같은 판과 되는 판을 번갈아) */
    smaller: (round, turn) => smallerDegree({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, reason: solution.reason, sum: solution.sum, leaves: solution.leaves },
        // 질문 힌트와 "선 끝 세기", "모든 경우 펼쳐 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.endsShown ? 1 : 0) + (round.casesShown ? 1 : 0),
        endsShown: round.endsShown,
        endsCount: round.endsCount,
        casesShown: round.casesShown,
        casesCount: round.casesCount,
        // 판을 떠날 때 그은 선
        lines: round.lines,
        moveCount: round.moveCount,
        addCount: round.addCount,
        removeCount: round.removeCount,
        overCount: round.overCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
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
    /** 글자판: 점과 선은 저마다 Enter와 빈칸 글쇠로 누른다(판이 맡는다). Escape는 고른 점을 놓는다 */
    onKey(event) {
      if ($('degree-pad').hidden || picked === null || event.key !== 'Escape') return;
      picked = null;
      draw();
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawBoard(root, { need: board.need, small: true });
    },
    drawBlank(root) {
      drawBoard(root, { need: MAKE_FIRST, small: true });
    },
    /** 하던 판과 공책의 그림: 지금 그은 선 */
    drawResume(root, saved) {
      const lines = linesOk(saved.board.need.length, saved.lines) ? saved.lines : [];
      drawBoard(root, { need: saved.board.need, lines, small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      const need = entry.picture.blank ? MAKE_FIRST : generateBoard(entry.level, entry.picture.seed).board.need;
      drawBoard(root, { need, small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
