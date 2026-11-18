// 자리 바꾸기: 판 화면에서 이 형식이 맡는 부분(판, 답하는 칸, 막혔을 때와 맞혔을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/swap.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)는 단계가 정한다.
//   frogs   개구리와 두꺼비의 자리를 맞바꾸면 끝난다. 횟수를 묻지 않는다(1·2단계, 직접 만든 개구리 판)
//   fewest  개구리 판을 가장 적은 횟수로 맞바꾼다. 더 많이 움직였으면 "더 줄일 수 있을까요?"라고 묻고 판을 그대로 둔다(3단계)
//   pairs   건너뛰어 짝 짓기. 모두 짝 지으면 끝나고, 안 되는 판은 "불가능해요"로 답한다(4단계, 직접 만든 짝 짓기 판)
//
// 움직인 횟수(count)는 처음 모습에서 지금까지 말을 움직인 수다. 무른 움직임도 들어 있고, 처음으로 되돌리면 0이 된다.
// 개구리 판은 끝까지 간 길의 길이가 늘 같다(풀이 프로그램으로 확인했다). 그래서 길의 길이로는 "가장 적은 횟수"를 물을 수 없다.
// 무른 움직임까지 세어야 "한 번도 헛걸음하지 않고 끝까지 가기"가 가장 적은 횟수가 된다.
import T from '../content/swap.json';
import { smallerSwap } from '../core/smaller.js';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/swap-ladder.js';
import { MAX_FROGS, MAX_STONES, MIN_STONES, SKIPS, blockOf, checkBoard, diagnoseImpossible, isDone, isStuck, movesFrom, replay, solve, startCells, stuckKind } from '../core/swap.js';
import { fill } from '../core/text.js';
import { countTable, drawRow, rowCard, stepsCard } from '../ui/swap-board.js';

const FORMAT = 'swap';
const MODES = ['frogs', 'fewest', 'pairs'];
/** 처음 화면과 판 고르기에 그리는 빈 판의 칸 수 */
const BLANK_CELLS = 5;
/** 기록에 남기는 막힌 모양의 수의 위 끝 */
const MAX_STUCKS = 40;
/** 똑같은 모양에서 또 막혔을 때 물러서 보라고 하는 걸음 수(대본의 "두 번 무르고"와 같다) */
const SAME_BACK = 2;
const FIRST_DRAFT = { kind: 'frogs', left: 3, right: 3, n: 8, skip: 2 };

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createSwap(frame) {
  const { $, log } = frame;
  let pick = null; // 짝 짓기에서 집어 든 돌의 칸
  let flash = null; // 방금 누른 말이 왜 못 가는지: { text, block }. 다음에 무엇을 누르면 지운다
  let last = null; // 방금 한 움직임
  let draft = null; // 직접 만들기에서 정하던 판

  const isFrogs = (board) => board.kind === 'frogs';
  const copyBoard = (board) => (isFrogs(board) ? { kind: 'frogs', left: board.left, right: board.right } : { kind: 'pairs', n: board.n, skip: board.skip });
  const cellsOf = (round) => replay(round.board, round.trail).cells;
  const singlesOf = (cells) => [...cells].filter((cell) => cell === '1').length;
  const NAMES = { R: T.pieces.frog, L: T.pieces.toad, _: T.pieces.empty, 1: T.pieces.single, 2: T.pieces.pair, 0: T.pieces.gone };
  const labelOf = (cells) => (index) => fill(T.cellLabel, { no: index + 1, what: NAMES[cells[index]] });

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const frogs = isFrogs(board);
    const cells = cellsOf(round);
    const playing = !round.done;
    const done = isDone(board, cells);
    const stuck = isStuck(board, cells);
    drawRow($('swap-board'), {
      kind: board.kind,
      cells,
      label: labelOf(cells),
      onTap: playing ? tap : undefined,
      onDrop: playing ? drop : undefined,
      picked: pick,
      targets: pick === null ? [] : movesFrom(board, cells, pick).map((move) => move.to),
      block: flash?.block ?? null,
      last,
    });
    $('swap-count').hidden = !frogs;
    $('swap-left-count').hidden = frogs;
    $('swap-moves').textContent = String(round.count);
    $('swap-left').textContent = String(singlesOf(cells));
    const status = done ? T.status[frogs ? 'swapped' : 'paired'] : stuck ? T.status[frogs ? 'stuck' : 'pairs-stuck'] : '';
    $('swap-status').textContent = flash?.text ?? status;
    $('undo').disabled = !playing || round.trail.length === 0;
    $('reset').disabled = !playing || (round.trail.length === 0 && round.count === 0);

    for (const mode of MODES) $(`swap-${mode}`).hidden = mode !== round.mode;
    $('swap-best-line').hidden = round.best === null;
    $('swap-best').textContent = round.best === null ? '' : String(round.best);
    $('swap-again').hidden = !(playing && done);
    $('swap-stop').hidden = !(playing && round.best !== null);
    $('swap-impossible').disabled = round.done;
    frame.showWhy();
  }

  function refuse(text, block = null) {
    flash = { text, block };
    draw();
  }

  /** 말이나 돌을 눌렀다. */
  function tap(index) {
    const { round } = frame;
    if (round.done) return;
    const { board } = round;
    const cells = cellsOf(round);
    flash = null;
    if (isFrogs(board)) {
      if (cells[index] === '_') {
        draw();
        return;
      }
      // 갈 수 있는 곳이 하나뿐이므로 누르면 간다. 못 가는 말은 가지 않고, 무엇이 막았는지 판에서 보인다.
      const [move] = movesFrom(board, cells, index);
      if (move) go(move);
      else blocked(index, cells);
      return;
    }
    if (pick !== null) {
      const move = movesFrom(board, cells, pick).find((item) => item.to === index);
      if (move) {
        go(move);
        return;
      }
      if (index === pick) {
        pick = null;
        draw();
        return;
      }
    }
    if (cells[index] === '1' && movesFrom(board, cells, index).length > 0) {
      pick = index;
      draw();
    } else if (cells[index] === '0') {
      draw();
    } else if (pick !== null) refuse(T.status.far);
    else blocked(index, cells);
  }

  /** 말을 끌어다 놓았다. 갈 수 있는 쪽으로 끌었으면 간다. */
  function drop(from, to) {
    const { round } = frame;
    if (round.done) return;
    const { board } = round;
    const cells = cellsOf(round);
    flash = null;
    if (isFrogs(board)) {
      const forward = cells[from] === 'R' ? to > from : to < from;
      const [move] = movesFrom(board, cells, from);
      if (!forward) refuse(T.status.backward);
      else if (move) go(move);
      else blocked(from, cells);
      return;
    }
    const move = movesFrom(board, cells, from).find((item) => item.to === to);
    if (move) go(move);
    else if (cells[from] === '1' && movesFrom(board, cells, from).length > 0) {
      pick = from;
      refuse(T.status.far);
    } else blocked(from, cells);
  }

  function blocked(index, cells) {
    const { round } = frame;
    const block = blockOf(round.board, cells, index);
    pick = null;
    if (!block || block.reason === 'empty') {
      draw();
      return;
    }
    const key = { edge: 'edge', blocked: 'blocked', paired: 'is-pair', 'no-landing': 'no-landing' }[block.reason];
    frame.note('blocked', { at: index, reason: block.reason });
    refuse(T.status[key], { at: index, cells: block.cells });
  }

  function go(move) {
    const { round } = frame;
    const { board } = round;
    round.trail = [...round.trail, [move.from, move.to]];
    round.count += 1;
    round.moveCount += 1;
    if (round.trail.length === 1) {
      const first = `${move.from}-${move.to}`;
      if (!round.firsts.includes(first)) round.firsts.push(first);
    }
    pick = null;
    flash = null;
    last = { from: move.from, to: move.to };
    frame.note('move', { from: move.from, to: move.to, jump: move.jump });
    const cells = cellsOf(round);
    if (isDone(board, cells)) {
      complete();
      return;
    }
    if (isStuck(board, cells)) sayStuck(cells);
    draw();
    frame.persist();
  }

  /** 막혔다: 본 것 하나와 할 수 있는 일 하나를 말한다. 판은 끝나지 않는다. 같은 꼴로 거듭 막히면 그 사실을 알려 준다. */
  function sayStuck(cells) {
    const { round } = frame;
    const frogs = isFrogs(round.board);
    const same = round.stucks.includes(cells);
    const kind = frogs ? stuckKind(cells) : 'pairs';
    // 같은 꼴로 거듭 막혔다는 말은 한 판에 한 번만 한다. 볼 때마다 되풀이하면 까닭을 대신 말해 주는 셈이 된다.
    const pairsBefore = round.stucks.filter((before) => stuckKind(before) === 'pair').length;
    const again = frogs && kind === 'pair' && pairsBefore === 1;
    round.stuckCount += 1;
    round.stucks.push(cells);
    frame.note('stuck', { cells, kind, same });
    // 똑같은 모양에서 또 막혔으면 더 멀리 물러서 보라고 한다. 두 번 무를 만큼 오지 않았으면 처음으로 되돌리라고 한다.
    const far = round.trail.length > SAME_BACK ? '' : '-start';
    if (frogs) frame.say(same ? T.stuck[`same${far}`] : again ? T.stuck['pair-again'] : T.stuck.plain);
    else frame.say(same ? T.stuck[`pairs-same${far}`] : fill(T.stuck.pairs, { s: singlesOf(cells) }));
  }

  /** 자리를 맞바꿨거나 모두 짝 지었다. 가장 적은 횟수를 묻는 판에서는 횟수를 견준다. */
  function complete() {
    const { round, solution } = frame;
    const answer = (text, correct, guess = null) => {
      round.answers.push({ t: frame.stamp(), answer: text, correct, guess });
      frame.note('answer', { answer: text, correct, guess });
    };
    if (round.mode !== 'fewest') {
      answer(round.mode === 'pairs' ? 'paired' : 'swapped', true);
      frame.finish('solved');
      return;
    }
    const moves = round.count;
    round.completions.push(moves);
    round.best = round.best === null ? moves : Math.min(round.best, moves);
    if (moves === solution.min) {
      answer(`swapped:${moves}`, true);
      frame.finish('solved');
      return;
    }
    // 틀렸다고 하지 않는다. 몇 번이었는지 말하고 더 줄일 수 있을지 묻는다. 판은 그대로 둔다.
    answer(`swapped:${moves}`, false, 'more-than-min');
    frame.persist();
    draw();
    frame.say(fill(T.play.more, { m: moves }));
  }

  /** 가장 적은 횟수를 묻는 판에서 "여기까지 할래요": 맞바꾼 것으로 판을 끝낸다. */
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
    round.trail = round.trail.slice(0, -1);
    round.undoCount += 1;
    pick = null;
    flash = null;
    last = null;
    frame.note('undo');
    draw();
    frame.persist();
  }

  function reset() {
    const { round } = frame;
    if (round.done || (round.trail.length === 0 && round.count === 0)) return;
    round.trail = [];
    round.count = 0;
    round.resetCount += 1;
    pick = null;
    flash = null;
    last = null;
    frame.note('reset');
    draw();
    frame.persist();
  }

  /** 짝 짓기 판에서 "불가능해요". 되는 판이면 무엇을 놓쳤을지 짐작해서 말한다. */
  function sayImpossible() {
    const { round, solution } = frame;
    if (round.done || round.mode !== 'pairs') return;
    const result = diagnoseImpossible(solution, { moves: round.moveCount, firsts: round.firsts });
    round.answers.push({ t: frame.stamp(), answer: 'impossible', correct: result.correct, guess: result.guess });
    frame.note('answer', { answer: 'impossible', correct: result.correct, guess: result.guess });
    if (result.correct) {
      frame.finish('solved');
      return;
    }
    frame.persist();
    draw();
    frame.say(T.guess[result.guess]);
  }

  /** 맞혔을 때 하는 말: 무엇을 했는지 그대로 말한다. */
  function rightLine(round, solution) {
    const parts = [];
    const back = round.undoCount + round.resetCount;
    if (round.mode === 'pairs') {
      if (round.answers.at(-1).answer === 'impossible') {
        if (round.stuckCount > 0) parts.push(fill(T.right['impossible-tried'], { s: round.stuckCount }));
        else parts.push(T.right[round.moveCount > 0 ? 'impossible-some' : 'impossible-untried']);
      } else if (back === 0) parts.push(fill(T.right['paired-clean'], { n: round.board.n, m: round.trail.length }));
      else parts.push(fill(T.right['paired-back'], { n: round.board.n, u: back }));
      if (round.answers.length > 1) parts.push(T.right['after-retry']);
      return parts;
    }
    if (round.mode === 'fewest') {
      if (round.stopped) return [fill(T.right.stopped, { m: round.best })];
      parts.push(fill(T.right.fewest, { m: solution.min }));
      if (round.completions.length > 1) parts.push(fill(T.right['fewest-after'], { first: round.completions[0] }));
      // 가장 적은 횟수로 처음 끝낸 판이면 "왜 그럴까?"가 생겼다고 알려 준다.
      const fewest = frame.records().filter((record) => record.kind === 'round' && record.format === FORMAT && record.fewest === true);
      if (!round.side && fewest.length === 1) parts.push(T.right['why-invite']);
      return parts;
    }
    if (back === 0) parts.push(fill(T.right['swapped-clean'], { m: round.moveCount }));
    else if (round.undoCount === 0) parts.push(fill(T.right['swapped-reset'], { m: round.moveCount }));
    else parts.push(fill(T.right['swapped-back'], { m: round.moveCount, u: round.undoCount }));
    if (round.resetCount > 0) parts.push(fill(T.right.resets, { r: round.resetCount }));
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 그림 하나: 처음 모습에서 길을 따라간 뒤의 판 */
  function pictureOf(board, trail = [], arrow = false) {
    const cells = replay(board, trail).cells;
    const end = trail.at(-1);
    return { kind: board.kind, cells, arrow, last: arrow && end ? { from: end[0], to: end[1] } : null };
  }

  /** "왜 그럴까?"는 개구리 판에만 있다. 짝 짓기는 일부러 까닭을 남겨 둔 판이다. */
  function whyPages(round) {
    if (!isFrogs(round.board)) return null;
    const times = (n) => fill(T.table.times, { n });
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        const nodes = [];
        if (slide.figures.length > 0) {
          nodes.push(rowOf(slide.figures.map((item) => rowCard(pictureOf({ kind: 'frogs', left: item.left, right: item.right }, item.trail, Boolean(item.arrow)), item.note))));
        }
        if (slide.table) {
          const heads = [T.table.heads.board, T.table.heads.jumps, T.table.heads.steps, T.table.heads.moves];
          const rows = slide.table.map((row) => [fill(T.table.row, { a: row.left, b: row.right }), times(row.jumps), times(row.steps), times(row.moves)]);
          nodes.push(rowOf([countTable(heads, rows)]));
        }
        return nodes;
      },
    }));
  }

  /** 풀이: 가장 짧은 차례 하나를 판마다 그려서 보여 준다. */
  function solutionPages(round, solution) {
    const { board } = round;
    if (!solution.possible) return [{ say: T.solution.impossible, nodes: [rowOf([rowCard(pictureOf(board))])] }];
    const steps = [{ caption: T.solution.startLabel, view: pictureOf(board, [], true) }];
    solution.moves.forEach((_, index) => {
      steps.push({ caption: fill(T.solution.stepLabel, { no: index + 1 }), view: pictureOf(board, solution.moves.slice(0, index + 1), true) });
    });
    return [{ say: fill(T.solution[board.kind], { k: solution.min }), nodes: [stepsCard(steps)] }];
  }

  // ---- 직접 만들기: 개구리 판은 양쪽 마릿수를, 짝 짓기 판은 돌의 수와 건너뛰는 수를 정한다. ----
  const draftBoard = () => (draft.kind === 'frogs' ? { kind: 'frogs', left: draft.left, right: draft.right } : { kind: 'pairs', n: draft.n, skip: draft.skip });

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const ok =
      saved &&
      checkBoard({ kind: 'frogs', left: saved.left, right: saved.right }) === null &&
      checkBoard({ kind: 'pairs', n: saved.n, skip: saved.skip }) === null &&
      (saved.kind === 'frogs' || saved.kind === 'pairs');
    return ok ? { kind: saved.kind, left: saved.left, right: saved.right, n: saved.n, skip: saved.skip } : { ...FIRST_DRAFT };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    $('swap-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const frogs = draft.kind === 'frogs';
    for (const button of $('swap-make-kinds').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.kind === draft.kind));
    $('swap-make-frogs').hidden = !frogs;
    $('swap-make-pairs').hidden = frogs;
    $('swap-make-left').textContent = fill(T.make.animals, { n: draft.left });
    $('swap-make-right').textContent = fill(T.make.animals, { n: draft.right });
    $('swap-make-n').textContent = fill(T.make.stones, { n: draft.n });
    $('swap-make-left-fewer').disabled = draft.left <= 1;
    $('swap-make-left-more').disabled = draft.left >= MAX_FROGS;
    $('swap-make-right-fewer').disabled = draft.right <= 1;
    $('swap-make-right-more').disabled = draft.right >= MAX_FROGS;
    $('swap-make-n-fewer').disabled = draft.n <= MIN_STONES;
    $('swap-make-n-more').disabled = draft.n >= MAX_STONES;
    for (const button of $('swap-make-skips').querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.skip) === draft.skip));
    const board = draftBoard();
    drawRow($('swap-make-board'), { kind: board.kind, cells: startCells(board) });
  }

  function changeDraft(change) {
    const next = { ...draft, ...change };
    if (checkBoard({ kind: 'frogs', left: next.left, right: next.right }) !== null || checkBoard({ kind: 'pairs', n: next.n, skip: next.skip }) !== null) return;
    draft = next;
    $('swap-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 아이가 정한 판을 풀이 프로그램으로 풀어서, 되는지와 가장 적은 횟수를 알려 준다. */
  function solveDraft() {
    const board = draftBoard();
    const result = solve(board);
    const line = result.possible ? fill(T.make[board.kind], { k: result.min }) : T.make.impossible;
    $('swap-make-result').textContent = line;
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { possible: result.possible, min: result.min },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  function playDraft() {
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board: draftBoard() });
  }

  // ---- 단추 잇기 ----
  $('swap-again').addEventListener('click', reset);
  $('swap-stop').addEventListener('click', stop);
  $('swap-impossible').addEventListener('click', sayImpossible);
  $('swap-make-kinds').addEventListener('click', (event) => {
    const kind = event.target.closest('button')?.dataset.kind;
    if (kind) changeDraft({ kind });
  });
  $('swap-make-left-fewer').addEventListener('click', () => changeDraft({ left: draft.left - 1 }));
  $('swap-make-left-more').addEventListener('click', () => changeDraft({ left: draft.left + 1 }));
  $('swap-make-right-fewer').addEventListener('click', () => changeDraft({ right: draft.right - 1 }));
  $('swap-make-right-more').addEventListener('click', () => changeDraft({ right: draft.right + 1 }));
  $('swap-make-n-fewer').addEventListener('click', () => changeDraft({ n: draft.n - 1 }));
  $('swap-make-n-more').addEventListener('click', () => changeDraft({ n: draft.n + 1 }));
  $('swap-make-skips').addEventListener('click', (event) => {
    const skip = Number(event.target.closest('button')?.dataset.skip);
    if (SKIPS.includes(skip)) changeDraft({ skip });
  });
  $('swap-make-solve').addEventListener('click', solveDraft);
  $('swap-make-play').addEventListener('click', playDraft);

  const count = (value) => Number.isInteger(value) && value >= 0;

  return {
    id: FORMAT,
    T,
    padId: 'swap-pad',
    makeId: 'make-swap',
    homeIds: { sample: 'home-swap-sample', blank: 'home-swap-blank', ask: 'home-swap-ask', play: 'home-swap-play', pick: 'home-swap-pick', make: 'home-swap-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    /** 새 판에서 이 형식이 맡는 값 */
    begin({ level, custom, board }) {
      return {
        mode: custom ? (isFrogs(board) ? 'frogs' : 'pairs') : rungOf(level).mode,
        board: copyBoard(board), // 판: 개구리는 양쪽 마릿수, 짝 짓기는 돌의 수와 건너뛰는 수
        trail: [], // 처음 모습에서 지금까지의 움직임. [떠난 칸, 닿은 칸]
        count: 0, // 움직인 횟수. 무른 움직임도 들어 있다. 처음으로 되돌리면 0이 된다
        moveCount: 0, // 이 판에서 말을 움직인 수(되돌리기 전의 것까지 모두)
        undoCount: 0,
        resetCount: 0,
        stuckCount: 0,
        stucks: [], // 막혔을 때의 모양들
        firsts: [], // 처음 모습에서 맨 먼저 해 본 움직임들
        best: null, // 가장 적은 횟수를 묻는 판에서, 지금까지 맞바꾼 횟수 가운데 가장 적은 것
        completions: [], // 그 판에서 맞바꿀 때마다의 횟수
        stopped: false, // "여기까지 할래요"로 끝냈는가
      };
    },
    solve(round) {
      const { possible, min, moves } = solve(round.board);
      return { possible, min, moves };
    },
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      if ((saved.mode === 'pairs') !== (saved.board.kind === 'pairs')) return false;
      if (!replay(saved.board, saved.trail).ok) return false;
      if (![saved.count, saved.moveCount, saved.undoCount, saved.resetCount, saved.stuckCount].every(count)) return false;
      if (![saved.stucks, saved.firsts, saved.completions].every(Array.isArray)) return false;
      return saved.best === null || count(saved.best);
    },
    /** 판 화면에서 이 형식의 것(판, 움직인 횟수, 판 아래의 글)을 보이거나 감춘다 */
    showParts(on) {
      $('swap-board').hidden = !on;
      $('swap-status').hidden = !on;
      $('swap-count').hidden = !on;
      $('swap-left-count').hidden = !on;
    },
    enter() {
      pick = null;
      flash = null;
      last = null;
    },
    draw,
    ended() {
      pick = null;
      flash = null;
    },
    ruleLine: (round) => (round.mode === 'pairs' ? fill(T.rules.pairs, { k: round.board.skip }) : T.rules[round.mode]),
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.moveCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view: (round) => ({ cells: cellsOf(round), count: round.count }),
    /** 이 판보다 작은 판: 개구리는 양쪽에서 한 마리씩 줄인 판, 짝 짓기는 돌을 둘 줄인 판 */
    smaller: (round, turn) => smallerSwap({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const frogs = isFrogs(round.board);
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, min: solution.min },
        // 판을 떠날 때의 길과 모양
        trail: round.trail,
        cells: cellsOf(round),
        moveCount: round.moveCount,
        count: round.count,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        stuckCount: round.stuckCount,
        stucks: round.stucks.slice(-MAX_STUCKS),
        firsts: round.firsts,
        // 가장 적은 횟수를 묻는 판: 맞바꿀 때마다의 횟수, 그 가운데 가장 적은 것, 가장 적은 횟수로 끝냈는가
        completions: round.completions,
        best: round.best,
        fewest: round.mode === 'fewest' && round.best !== null && round.best === solution.min,
        stopped: round.stopped === true,
        // 개구리 판은 무르기 없이 끝낸 판이 "한 번에"다(수준 맞추기가 본다). 짝 짓기는 첫 답으로 맞혔는지를 본다.
        wrongCount: frogs ? round.undoCount + round.resetCount : null,
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
      drawRow(root, { ...pictureOf(board), small: true });
    },
    drawBlank(root) {
      drawRow(root, { kind: 'frogs', cells: '_'.repeat(BLANK_CELLS), small: true });
    },
    drawResume(root, saved) {
      drawRow(root, { ...pictureOf(saved.board, saved.trail), small: true });
    },
    /** 판 고르기의 그림: 단계마다 하는 일을 작은 그림으로 보여 준다. */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) {
        drawRow(root, { kind: 'frogs', cells: '_'.repeat(BLANK_CELLS), small: true });
        return;
      }
      const board = picture.n ? { kind: 'pairs', n: picture.n, skip: picture.skip } : { kind: 'frogs', left: picture.left, right: picture.right };
      drawRow(root, { ...pictureOf(board, picture.trail ?? []), small: true });
    },
    showMake,
  };
}
