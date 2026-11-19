// 컵 뒤집기와 세 색 무리: 판 화면에서 이 형식이 맡는 부분(판, 답하는 칸, 맞혔을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/cups.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 동전 뒤집기의 틀을 다시 쓴다. 한 형식 안에 판이 두 가지다(판의 종류는 판이 정한다. src/core/cups.js).
//   컵 뒤집기: 컵을 눌러 고르고(다시 누르면 빠진다), 꼭 k개를 고르면 함께 뒤집힌다(동전 뒤집기와 같다). 모두 바로 서면 끝이다.
//   세 색 무리: 방울이 하나를 누르고 색이 다른 방울이를 누르면 둘이 만나 둘 다 나머지 한 색이 된다. 모두 한 색이 되면 끝이다.
//     같은 색을 누르면 만나지 않고 고른 것이 그 방울이로 옮겨 간다. 판 아래에 짧은 사실을 적고, 선생님은 판마다 한 번만 말한다.
// 판의 종류(mode)는 단계가 정한다(src/core/cups-ladder.js).
//   maybe   끝내면 끝난다. 안 되는 판은 "불가능해요"로 답한다(되는 판은 실제로 끝내야 통과한다. 바뀌지 않는 값은 안 되는 판만 가려 준다)
//   fewest  끝내면 뒤집은 횟수를 견준다. 가장 적은 횟수보다 많으면 "더 줄일 수 있을까요?"라고 묻고 판을 그대로 둔다(2단계)
// 뒤집은 횟수(만난 횟수)는 지금 길의 길이다(무른 것은 빠진다). 처음으로 되돌리면 0이 된다.
// "세어서 적어 보기"는 도구다. 처음 모습과 움직일 때마다의 엎어진 컵 수(또는 색마다의 마릿수)를 표로 줄 세운다. 처음 켤 때 힌트 하나를 연 것으로 적는다.
import T from '../content/cups.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, solveOnce } from '../core/cups-ladder.js';
import { RANGES, applyMove, checkBoard, checkMove, copyBoard, countsOf, diagnoseImpossible, downCount, invariantRulesOut, isDone, remainders, replay, startItems, whyOpen } from '../core/cups.js';
import { smallerCups } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { drawItems, itemsStrip } from '../ui/cups-board.js';
import { countTable } from '../ui/swap-board.js';

const FORMAT = 'cups';
const MODES = ['maybe', 'fewest'];
/** 처음 화면과 판 고르기에 그리는 빈 판(모두 바로 선 컵 넷) */
const BLANK = [0, 0, 0, 0];
const FIRST_DRAFT = { kind: 'cups', n: 5, k: 2, cups: [1, 1, 1, 0, 0], counts: [2, 1, 0] };

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createCups(frame) {
  const { $, log } = frame;
  let selected = []; // 고른 컵이나 방울이
  let changed = []; // 방금 뒤집히거나 색이 바뀐 것
  let flash = null; // 판 아래에 잠깐 적는 사실(같은 색을 눌렀을 때). 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 만들던 판(컵 판과 방울이 판의 값을 함께 간직한다)

  const itemsOf = (round) => replay(round.board, round.trail).items;
  const labelOf = (kind) => (index, value) =>
    kind === 'cups' ? fill(T.cupLabel, { no: ordinal(index + 1), face: T.faces[value ? 'down' : 'up'] }) : fill(T.folkLabel, { no: ordinal(index + 1), face: T.colors[value] });
  const toCups = (text) => [...text].map(Number);
  /** 판의 종류에 맞는 힌트와 규칙의 이름 */
  const hintKey = (round) => (round.mode === 'fewest' ? 'fewest' : round.board.kind);

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const items = itemsOf(round);
    const playing = !round.done;
    const done = isDone(board, items);
    const cups = board.kind === 'cups';
    drawItems($('cups-board'), { kind: board.kind, items, label: labelOf(board.kind), onTap: playing ? tap : undefined, selected, changed });
    $('cups-flips-line').hidden = !cups;
    $('cups-meets-line').hidden = cups;
    $(cups ? 'cups-flips' : 'cups-meets').textContent = String(round.trail.length);
    $('cups-status').textContent = flash ?? (done ? T.status[board.kind] : '');
    $('undo').disabled = !playing || round.trail.length === 0;
    $('reset').disabled = !playing || round.trail.length === 0;

    $('cups-howto').textContent = fill(T.howto[board.kind], { k: cups ? board.k : 2 });
    $('cups-picked-line').hidden = !cups || !playing;
    $('cups-picked').textContent = String(selected.length);
    $('cups-fewest').hidden = round.mode !== 'fewest';
    $('cups-maybe').hidden = round.mode !== 'maybe';
    $('cups-best-line').hidden = round.best === null;
    $('cups-best').textContent = round.best === null ? '' : String(round.best);
    $('cups-again').hidden = !(playing && done && round.mode === 'fewest' && round.trail.length > 0);
    $('cups-stop').hidden = !(playing && round.mode === 'fewest' && round.best !== null);
    $('cups-impossible').disabled = round.done;

    // 도구: 처음 모습과 움직일 때마다 센 것을 표로 줄 세운다. 끝난 판에서는 꺼져 있다.
    const looking = playing && round.notesOn;
    $('cups-notes').textContent = T.tool[looking ? 'on' : 'off'];
    $('cups-notes').setAttribute('aria-pressed', String(looking));
    $('cups-notes').disabled = round.done;
    $('cups-notes-table').hidden = !looking;
    if (looking) $('cups-notes-table').replaceChildren(notesTable(round));
    frame.showWhy();
  }

  /** 지금 길을 따라가며 센 것의 표: 컵은 엎어진 컵 수, 방울이는 색마다의 마릿수 */
  function notesTable(round) {
    const { board } = round;
    const rows = [];
    let items = startItems(board);
    const line = (name) => (board.kind === 'cups' ? [name, fill(T.notes.cell, { n: downCount(items) })] : [name, ...countsOf(items).map(String)]);
    rows.push(line(T.notes.start));
    round.trail.forEach((move, index) => {
      items = applyMove(board, items, move);
      rows.push(line(fill(T.notes.step, { no: index + 1 })));
    });
    const heads = board.kind === 'cups' ? ['', T.notes.down] : ['', ...T.colors];
    const table = countTable(heads, rows);
    table.classList.add('cups-notes-list');
    return table;
  }

  /** 컵이나 방울이를 눌렀다 */
  function tap(index) {
    const { round } = frame;
    if (round.done) return;
    const items = itemsOf(round);
    flash = null;
    changed = [];
    if (selected.includes(index)) {
      selected = selected.filter((item) => item !== index);
      frame.note('pick', { at: index, on: false });
      draw();
      return;
    }
    if (round.board.kind === 'colors' && selected.length === 1 && items[selected[0]] === items[index]) {
      // 같은 색: 만나지 않는다. 고른 것이 이 방울이로 옮겨 간다.
      selected = [index];
      round.sameCount += 1;
      frame.note('same', { at: index });
      flash = T.status.same;
      draw();
      if (!round.sameSaid) {
        round.sameSaid = true;
        frame.say(T.refuse.same);
      }
      frame.persist();
      return;
    }
    selected = [...selected, index];
    frame.note('pick', { at: index, on: true });
    const size = round.board.kind === 'cups' ? round.board.k : 2;
    if (selected.length < size) {
      draw();
      return;
    }
    const move = selected.slice().sort((a, b) => a - b);
    selected = [];
    if (checkMove(round.board, items, move) !== null) {
      draw();
      return;
    }
    play(move, items);
  }

  /** 움직임 하나: 컵 k개를 뒤집거나 방울이 둘을 만나게 한다 */
  function play(move, items) {
    const { round, solution } = frame;
    const { board } = round;
    if (board.kind === 'cups' && move.some((index) => items[index] === 0)) round.upPicked = true;
    if (board.kind === 'colors') {
      const pair = [items[move[0]], items[move[1]]].sort((a, b) => a - b).join('-');
      if (!round.pairs.includes(pair)) round.pairs.push(pair);
    }
    round.trail = [...round.trail, move];
    round.moveCount += 1;
    changed = move;
    frame.note(board.kind === 'cups' ? 'flip' : 'meet', { at: move });
    const after = applyMove(board, items, move);
    if (isDone(board, after)) {
      complete(solution);
      return;
    }
    // 지나온 모습으로 되돌아왔으면 그 사실을 알려 준다. 말은 한 판에 한 번만 한다.
    if (seenBefore(round, after)) {
      round.loopCount += 1;
      frame.note('loop');
      if (!round.loopSaid) {
        round.loopSaid = true;
        frame.say(T.stuck.loop);
      }
    }
    draw();
    frame.persist();
  }

  /** 이 모습이 지금 길에서 앞서 있었던 모습인가 */
  function seenBefore(round, items) {
    const key = items.join('');
    let now = startItems(round.board);
    if (now.join('') === key) return true;
    for (const move of round.trail.slice(0, -1)) {
      now = applyMove(round.board, now, move);
      if (now.join('') === key) return true;
    }
    return false;
  }

  /** 끝냈다. 가장 적게 뒤집는 판에서는 횟수를 견준다. */
  function complete(solution) {
    const { round } = frame;
    const answer = (text, correct, guess = null) => {
      round.answers.push({ t: frame.stamp(), answer: text, correct, guess });
      frame.note('answer', { answer: text, correct, guess });
    };
    if (round.mode !== 'fewest') {
      answer('done', true);
      frame.finish('solved');
      return;
    }
    const moves = round.trail.length;
    round.completions.push(moves);
    round.best = round.best === null ? moves : Math.min(round.best, moves);
    if (moves === solution.min) {
      answer(`done:${moves}`, true);
      frame.finish('solved');
      return;
    }
    // 틀렸다고 하지 않는다. 몇 번이었는지 말하고 더 줄일 수 있을지 묻는다. 판은 그대로 둔다.
    answer(`done:${moves}`, false, 'more-than-min');
    frame.persist();
    draw();
    frame.say(fill(T.play.more, { k: moves }));
  }

  /** 가장 적게 뒤집는 판에서 "여기까지 할래요": 끝낸 것으로 판을 끝낸다. */
  function stop() {
    const { round } = frame;
    if (round.done || round.mode !== 'fewest' || round.best === null) return;
    round.stopped = true;
    frame.note('stop', { best: round.best });
    frame.finish('solved');
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    changed = round.trail.at(-1);
    round.trail = round.trail.slice(0, -1);
    round.undoCount += 1;
    selected = [];
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
  }

  function reset() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    round.trail = [];
    round.resetCount += 1;
    selected = [];
    changed = [];
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
  }

  /** "불가능해요". 되는 판이면 무엇을 놓쳤을지 짐작해서 말한다. */
  function sayImpossible() {
    const { round, solution } = frame;
    if (round.done || round.mode !== 'maybe') return;
    const result = diagnoseImpossible(solution, round.board, { moves: round.moveCount, upPicked: round.upPicked, pairs: round.pairs });
    round.answers.push({ t: frame.stamp(), answer: 'impossible', correct: result.correct, guess: result.guess });
    frame.note('answer', { answer: 'impossible', correct: result.correct, guess: result.guess });
    if (result.correct) {
      frame.finish('solved');
      return;
    }
    flash = null;
    frame.persist();
    draw();
    frame.say(T.guess[result.guess]);
  }

  /** "세어서 적어 보기": 센 것을 표로 줄 세운다. */
  function toggleNotes() {
    const { round } = frame;
    if (!round || round.done) return;
    round.notesOn = !round.notesOn;
    if (round.notesOn) {
      round.notesShown = true;
      round.notesCount += 1;
    }
    frame.note('notes', { on: round.notesOn });
    draw();
    frame.persist();
  }

  /** 맞혔을 때 하는 말: 무엇을 했는지 그대로 말한다. */
  function rightLine(round, solution) {
    const { kind } = round.board;
    const parts = [];
    if (round.mode === 'fewest') {
      if (round.stopped) return [fill(T.right.stopped, { k: round.best })];
      parts.push(fill(T.right.fewest, { k: solution.min }));
      if (round.completions.length > 1) parts.push(fill(T.right['fewest-after'], { n: round.completions[0] }));
      return parts;
    }
    if (round.answers.at(-1)?.answer === 'impossible') {
      parts.push(round.moveCount > 0 ? fill(T.right[`impossible-${kind}-tried`], { k: round.moveCount }) : T.right[`impossible-${kind}-untried`]);
    } else {
      const back = round.undoCount + round.resetCount;
      const values = { k: round.trail.length, n: back, face: kind === 'colors' ? T.colors[itemsOf(round)[0]] : '' };
      parts.push(fill(T.right[`${kind}-${back === 0 ? 'clean' : 'back'}`], values));
    }
    if (round.answers.length > 1) parts.push(T.right['after-retry']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(nodes) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...nodes);
    return row;
  }

  /**
   * "왜 그럴까?": 선생님이 어떻게 알아챘는지의 이야기. 컵과 방울이는 까닭이 달라서 이야기도 둘이다.
   * 그 종류의 안 되는 판을 한 번 끝까지 만난 뒤에 열린다. 안 되는 판인데 까닭(바뀌지 않는 값)이 그 판을 가려 주지 못하면 열지 않는다.
   * 컵 이야기는 짝수 개씩 뒤집는 판의 이야기라서, 홀수 개씩 뒤집는 판(2단계의 세 개씩)에서는 열지 않는다.
   */
  function whyPages(round) {
    const { kind } = round.board;
    if (!whyOpen(frame.records(), kind)) return null;
    if (kind === 'cups' && round.board.k % 2 === 1) return null;
    if (!solveOnce(round.board).possible && !invariantRulesOut(round.board)) return null;
    return T.why[kind].map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        const nodes = slide.strips.map((strip) => itemsStrip({ kind, steps: strip.steps.map(toCups), note: strip.note }));
        if (slide.table) {
          const heads = ['', ...T.colors, T.table.head];
          const rows = slide.table.map((counts, index) => {
            const [n, k, f] = remainders(counts);
            return [index === 0 ? T.notes.start : fill(T.notes.step, { no: index }), ...counts.map(String), fill(T.table.rest, { n, k, f })];
          });
          nodes.push(rowOf([countTable(heads, rows)]));
        }
        return nodes;
      },
    }));
  }

  /** 풀이: 가장 적게 끝내는 차례 하나를 그려서 보여 준다. 움직인 것에 테두리를 두른다. */
  function solutionPages(round, solution) {
    const { board } = round;
    const { kind } = board;
    const start = startItems(board);
    if (!solution.possible) return [{ say: T.solution[`${kind}-impossible`], nodes: [itemsStrip({ kind, steps: [start] })] }];
    const steps = [start];
    for (const move of solution.moves) steps.push(applyMove(board, steps.at(-1), move));
    const strip = {
      kind,
      steps,
      marks: [[], ...solution.moves],
      captions: [T.solution.startLabel, ...solution.moves.map((_, index) => fill(T.solution.stepLabel, { no: index + 1 }))],
    };
    return [{ say: fill(T.solution[`${kind}-possible`], { k: solution.min }), nodes: [itemsStrip(strip)] }];
  }

  // ---- 직접 만들기: 컵 판(컵 수, 한 번에 뒤집는 수, 엎어진 컵)이나 방울이 판(색마다의 마릿수)을 정한다. ----
  function draftBoard() {
    if (draft.kind === 'cups') return { kind: 'cups', n: draft.n, k: draft.k, cups: draft.cups.slice() };
    return { kind: 'colors', counts: draft.counts.slice() };
  }

  /** 정하던 값이 두 종류 모두 규격에 맞는가 */
  function draftOk(value) {
    if (!value || !['cups', 'colors'].includes(value.kind)) return false;
    return checkBoard({ kind: 'cups', n: value.n, k: value.k, cups: value.cups }) === null && checkBoard({ kind: 'colors', counts: value.counts }) === null;
  }

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const base = draftOk(saved) ? saved : FIRST_DRAFT;
    return { kind: base.kind, n: base.n, k: base.k, cups: base.cups.slice(), counts: base.counts.slice() };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    $('cups-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const board = draftBoard();
    for (const button of $('cups-make-kinds').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.kind === draft.kind));
    $('cups-make-cups').hidden = draft.kind !== 'cups';
    $('cups-make-colors').hidden = draft.kind !== 'colors';
    $('cups-make-n').textContent = fill(T.make.count, { n: draft.n });
    $('cups-make-n-fewer').disabled = draft.n <= RANGES.n[0];
    $('cups-make-n-more').disabled = draft.n >= RANGES.n[1];
    $('cups-make-k').textContent = fill(T.make.each, { n: draft.k });
    $('cups-make-k-fewer').disabled = draft.k <= 1;
    $('cups-make-k-more').disabled = draft.k >= draft.n;
    draft.counts.forEach((count, color) => {
      $(`cups-make-c${color}`).textContent = fill(T.make.folk, { n: count });
      $(`cups-make-c${color}-fewer`).disabled = !draftOk({ ...draft, counts: draft.counts.map((value, at) => (at === color ? value - 1 : value)) });
      $(`cups-make-c${color}-more`).disabled = !draftOk({ ...draft, counts: draft.counts.map((value, at) => (at === color ? value + 1 : value)) });
    });
    const items = startItems(board);
    drawItems($('cups-make-board'), {
      kind: board.kind,
      items,
      label: labelOf(board.kind),
      onTap: board.kind === 'cups' ? (index) => changeDraft({ cups: draft.cups.map((cup, at) => (at === index ? 1 - cup : cup)) }) : undefined,
    });
    // 이미 끝난 판(컵이 모두 바로 섰거나 방울이가 한 색뿐)은 해 볼 것이 없다. 그렇다고 알려 주고 해 보는 단추를 끈다.
    const done = isDone(board, items);
    $('cups-make-play').disabled = done;
    if (done) $('cups-make-result').textContent = T.make[`${board.kind}-done`];
  }

  function changeDraft(change) {
    const next = { ...draft, ...change };
    if (!draftOk(next)) return;
    draft = next;
    $('cups-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 컵 수를 바꾼다. 늘리면 바로 선 컵을 하나 더 놓고, 줄이면 맨 끝 컵을 뺀다. 한 번에 뒤집는 수는 컵 수를 넘지 않게 맞춘다. */
  function resizeCups(step) {
    const n = Math.max(RANGES.n[0], Math.min(RANGES.n[1], draft.n + step));
    if (n === draft.n) return;
    const cups = n > draft.n ? [...draft.cups, 0] : draft.cups.slice(0, n);
    changeDraft({ n, cups, k: Math.min(draft.k, n) });
  }

  /** 아이가 만든 판을 풀이 프로그램으로 풀어서 알려 준다. */
  function solveDraft() {
    const board = draftBoard();
    const result = solveOnce(board);
    let line = T.make[`${board.kind}-impossible`];
    if (isDone(board, startItems(board))) line = T.make[`${board.kind}-done`];
    else if (result.possible) line = fill(T.make[`${board.kind}-possible`], { k: result.min });
    $('cups-make-result').textContent = line;
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { possible: result.possible, min: result.min, states: result.states },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 풀어 볼 판). 이미 끝난 판이면 null */
  function madeBoard() {
    const board = draftBoard();
    return isDone(board, startItems(board)) ? null : board;
  }

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('cups-again').addEventListener('click', reset);
  $('cups-stop').addEventListener('click', stop);
  $('cups-impossible').addEventListener('click', sayImpossible);
  $('cups-notes').addEventListener('click', toggleNotes);
  $('cups-make-kinds').addEventListener('click', (event) => {
    const kind = event.target.closest('button')?.dataset.kind;
    if (kind) changeDraft({ kind });
  });
  $('cups-make-n-fewer').addEventListener('click', () => resizeCups(-1));
  $('cups-make-n-more').addEventListener('click', () => resizeCups(1));
  $('cups-make-k-fewer').addEventListener('click', () => changeDraft({ k: draft.k - 1 }));
  $('cups-make-k-more').addEventListener('click', () => changeDraft({ k: draft.k + 1 }));
  $('cups-make-all-down').addEventListener('click', () => changeDraft({ cups: draft.cups.map(() => 1) }));
  $('cups-make-all-up').addEventListener('click', () => changeDraft({ cups: draft.cups.map(() => 0) }));
  for (let color = 0; color < 3; color++) {
    const step = (by) => changeDraft({ counts: draft.counts.map((value, at) => (at === color ? value + by : value)) });
    $(`cups-make-c${color}-fewer`).addEventListener('click', () => step(-1));
    $(`cups-make-c${color}-more`).addEventListener('click', () => step(1));
  }
  $('cups-make-solve').addEventListener('click', solveDraft);
  $('cups-make-play').addEventListener('click', playDraft);

  const count = (value) => Number.isInteger(value) && value >= 0;

  return {
    id: FORMAT,
    T,
    padId: 'cups-pad',
    makeId: 'make-cups',
    homeIds: { sample: 'home-cups-sample', blank: 'home-cups-blank', ask: 'home-cups-ask', play: 'home-cups-play', pick: 'home-cups-pick', make: 'home-cups-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    /** 새 판에서 이 형식이 맡는 값 */
    begin({ level, custom, board }) {
      return {
        mode: custom ? 'maybe' : rungOf(level).mode,
        board: copyBoard(board), // 판: 컵(수, 한 번에 뒤집는 수, 엎어진 컵) 또는 방울이(색마다의 마릿수)
        trail: [], // 처음 모습에서 지금까지의 움직임. 고른 번호들(컵 k개, 방울이 둘)
        moveCount: 0, // 이 판에서 움직인 수(무르고 되돌리기 전의 것까지 모두)
        undoCount: 0,
        resetCount: 0,
        upPicked: false, // 바로 선 컵을 함께 뒤집은 적이 있는가(컵)
        pairs: [], // 만나게 해 본 색의 짝들('0-1' 따위. 방울이)
        sameCount: 0, // 같은 색 방울이를 눌러 만나지 않은 수
        sameSaid: false, // 그 사실을 선생님이 말했는가(한 판에 한 번만 말한다)
        loopCount: 0, // 지나온 모습으로 돌아온 수
        loopSaid: false,
        best: null, // 가장 적게 뒤집는 판에서, 지금까지 끝낸 횟수 가운데 가장 적은 것
        completions: [], // 그 판에서 끝낼 때마다의 횟수
        stopped: false, // "여기까지 할래요"로 끝냈는가
        notesOn: false, // 지금 센 것의 표를 보고 있는가
        notesShown: false, // 한 번이라도 보았는가
        notesCount: 0, // 켠 수
      };
    },
    solve(round) {
      const { possible, min, moves } = solveOnce(round.board);
      return { possible, min, moves };
    },
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      if (!replay(saved.board, saved.trail).ok) return false;
      if (![saved.moveCount, saved.undoCount, saved.resetCount, saved.sameCount, saved.loopCount, saved.notesCount].every(count)) return false;
      if (![saved.pairs, saved.completions].every(Array.isArray)) return false;
      if (![saved.upPicked, saved.notesOn, saved.notesShown].every((value) => typeof value === 'boolean')) return false;
      return saved.best === null || count(saved.best);
    },
    /** 판 화면에서 이 형식의 것(판, 횟수, 도구 단추)을 보이거나 감춘다 */
    showParts(on) {
      $('cups-board').hidden = !on;
      $('cups-count').hidden = !on;
      $('cups-notes').hidden = !on;
      if (!on) $('cups-notes-table').hidden = true;
    },
    enter() {
      selected = [];
      changed = [];
      flash = null;
    },
    draw,
    ended() {
      selected = [];
      changed = [];
      flash = null;
    },
    ruleLine(round) {
      const { board } = round;
      const ask = round.mode === 'fewest' ? T.asks.fewest : T.asks[board.kind];
      return [fill(T.rules[board.kind], { k: board.kind === 'cups' ? board.k : 2 }), ask].join(' ');
    },
    hints: (round) => T.hints[hintKey(round)],
    touched: (round) => round.moveCount > 0 || round.sameCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const items = itemsOf(round);
      return { items: items.join(''), count: round.trail.length };
    },
    /** 이 판보다 작은 판: 같은 종류에서 컵이나 방울이를 줄인 판(컵은 한 번에 뒤집는 수가 같다) */
    smaller: (round, turn) => smallerCups({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const items = itemsOf(round);
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, min: solution.min },
        // 질문 힌트와 "세어서 적어 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.notesShown ? 1 : 0),
        notesShown: round.notesShown,
        notesCount: round.notesCount,
        // 판을 떠날 때의 길과 모습
        trail: round.trail,
        items: items.join(''),
        count: round.trail.length,
        moveCount: round.moveCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        upPicked: round.upPicked,
        pairs: round.pairs,
        sameCount: round.sameCount,
        loopCount: round.loopCount,
        // 가장 적게 뒤집는 판: 끝낼 때마다의 횟수, 그 가운데 가장 적은 것, 가장 적은 횟수로 끝냈는가
        completions: round.completions,
        best: round.best,
        fewest: round.mode === 'fewest' && round.best !== null && round.best === solution.min,
        stopped: round.stopped === true,
        // 수준 맞추기는 첫 답으로 맞혔는지를 본다(가장 적게 뒤집는 판은 처음 끝낸 것이 가장 적은 횟수였는지).
        wrongCount: null,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    onKey() {},

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).ask],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawItems(root, { kind: board.kind, items: startItems(board), small: true });
    },
    drawBlank(root) {
      drawItems(root, { kind: 'cups', items: BLANK, small: true });
    },
    drawResume(root, saved) {
      drawItems(root, { kind: saved.board.kind, items: replay(saved.board, saved.trail).items, small: true });
    },
    /** 판 고르기의 그림: 테두리가 있는 것들이 한 번에 함께 움직인다(컵 k개, 만나는 방울이 둘) */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) {
        drawItems(root, { kind: 'cups', items: BLANK, small: true });
        return;
      }
      const board = picture.kind === 'cups' ? { kind: 'cups', n: picture.n, k: picture.k, cups: toCups(picture.cups) } : { kind: 'colors', counts: picture.counts };
      drawItems(root, { kind: board.kind, items: startItems(board), mark: picture.mark, small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판. 아직 풀 수 있는 판이 아니면 null(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
