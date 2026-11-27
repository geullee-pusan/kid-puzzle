// 가로세로 수열 퍼즐: 판 화면에서 이 형식이 맡는 부분(판, 수 넣기, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/seqgrid.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 빈칸을 누르고 오른쪽 숫자판에서 숫자(두 자리까지)를 누른 뒤 "넣기"를 누르면 그 칸에 들어간다. 넣은 수는 언제든 바꾸거나 지울 수 있다.
// 선생님은 판정하지 않는다. 수를 넣어 한 줄이 다 찼는데 약속에 맞지 않으면 그 줄의 수를 크기순으로, 간격과 함께 그대로 말한다
// (같은 수가 두 번 있으면 그 수를 말한다). 빈칸을 모두 채웠는데 맞지 않으면 맞지 않는 첫 줄을 그렇게 말한다. 같은 모습을 다시 채우면 그렇다고 말한다.
// 빈칸을 모두 채우고 가로줄과 세로줄이 모두 약속에 맞으면 끝난다.
// 판의 종류(mode)
//   three 3×3 판(1단계)   ends 가장 작거나 큰 수(2단계)   black 검은 칸(3단계)   cross 4×4 판(4단계)   five 5×5 판(5단계)
//   made  직접 만든 판(답이 여럿일 수 있다. 약속에 맞게 채우면 어느 것이든 끝난다)
import T from '../content/seqgrid.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/seqgrid-ladder.js';
import { MAX_SIZE, MAX_VALUE, MIN_SIZE, blanksOf, cellsOk, checkBoard, copyBoard, countSolutions, filledCount, isDone, isFull, lineStates, solve, startCells, stepSolve } from '../core/seqgrid.js';
import { smallerSeqgrid } from '../core/smaller.js';
import { endsClosed, fill, ordinal } from '../core/text.js';
import { drawGrid, drawMini, gridCard, optionTable } from '../ui/seqgrid-board.js';

const FORMAT = 'seqgrid';
const MODES = ['three', 'ends', 'black', 'cross', 'five', 'made'];
/** 기록에 남기는 무르기 차례와 모두 채워 본 모습의 수의 위 끝 */
const MAX_MOVES = 300;
const MAX_TRIES = 200;
/** 직접 만들기: 걸음 수의 위 끝 */
const MAKE_BUDGET = 400_000;
/** 직접 만들기의 처음 판의 크기 */
const MAKE_FIRST = 3;

/** 수 뒤에 붙는 말: 받침이 있으면 c, 없으면 o */
const end = (number) => (endsClosed(number) ? 'c' : 'o');
const cellsKey = (cells) => cells.map((value) => value ?? 0).join(',');

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createSeqgrid(frame) {
  const { $, log } = frame;
  let choice = null; // 고른 칸의 번호
  let typing = ''; // 숫자판으로 누르고 있는 숫자들(넣기 전)
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let told = null; // 선생님이 방금 말한 줄 { kind, index }(그 줄이 약속에 맞게 바뀌면 그렇다고 말한다)
  let draft = null; // 직접 만들기에서 만들던 판 { n, black, givens }
  let pickMade = null; // 직접 만들기에서 고른 칸
  let typingMade = ''; // 직접 만들기에서 누르고 있는 숫자들
  let made = null; // 직접 만들기에서 선생님이 따진 것(판을 고치면 지운다)
  const fewest = {}; // 직접 만들기: 크기마다 답이 한 가지뿐이던 판의 가장 적은 적힌 수(이번에 연 동안)

  const count = (value) => Number.isInteger(value) && value >= 0;
  const hintKey = (round) => (round.board.black.length > 0 ? 'black' : 'plain');
  const lineName = (kind, index) => fill(T.labels[kind], { no: ordinal(index + 1) });

  /** 한 번 푼 판은 적어 둔다(판을 열 때마다, 기록을 남길 때마다 다시 풀지 않게) */
  const memo = new Map();
  function solutionOf(board) {
    const key = JSON.stringify(copyBoard(board));
    if (!memo.has(key)) memo.set(key, solve(board));
    return memo.get(key);
  }

  // ---- 읽어 주는 이름 ----
  function cellLabel(board, cells, selected, typed) {
    const dark = new Set(board.black);
    return (index) => {
      let face;
      if (dark.has(index)) face = T.labels.black;
      else if (board.givens[index] !== null) face = fill(T.labels.given, { k: board.givens[index] });
      else if (cells[index] !== null) face = fill(T.labels.number, { k: cells[index] });
      else face = T.labels.empty;
      let name = fill(T.labels.cell, { no: ordinal(Math.floor(index / board.n) + 1), k: (index % board.n) + 1, face });
      if (index === selected && typed) name = fill(T.labels.typing, { face: name, k: typed });
      return index === selected ? fill(T.labels.picked, { face: name }) : name;
    };
  }

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    drawGrid($('seqgrid-board'), {
      n: board.n,
      black: board.black,
      givens: board.givens,
      cells: round.cells,
      selected: playing ? choice : null,
      typing: playing ? typing : '',
      onCell: playing ? tapCell : undefined,
      labels: { board: fill(T.labels.board, { n: board.n }), cell: cellLabel(board, round.cells, playing ? choice : null, typing) },
    });
    const filled = filledCount(board, round.cells);
    $('seqgrid-filled').textContent = String(filled);
    $('seqgrid-left').textContent = String(blanksOf(board).length - filled);
    $('seqgrid-status').textContent = flash ?? statusOf(round, playing);
    drawPad($('seqgrid-keys'), $('seqgrid-shown'), typing, !playing);
    $('undo').disabled = !playing || round.moves.length === 0;
    $('reset').disabled = !playing || filled === 0;
    frame.showWhy();
  }

  function statusOf(round, playing) {
    if (!playing) return isDone(round.board, round.cells) ? T.status.done : '';
    if (choice !== null && typing) return fill(T.status[`typing-${end(Number(typing))}`], { k: typing });
    if (choice !== null) return T.status.picked;
    if (isFull(round.board, round.cells)) return T.status.full;
    return T.status.begin;
  }

  /** 숫자판: 누르고 있는 숫자를 보이는 칸과 단추들 */
  function drawPad(keys, shown, typed, off) {
    for (const key of keys.querySelectorAll('button')) key.disabled = off;
    shown.textContent = typed;
    shown.setAttribute('aria-label', typed ? fill(T.labels.shown, { k: typed }) : T.labels['shown-empty']);
  }

  // ---- 수 넣기 ----
  function tapCell(index) {
    const { round } = frame;
    if (!round || round.done) return;
    flash = null;
    choice = choice === index ? null : index;
    typing = '';
    draw();
  }

  /**
   * 숫자판을 눌렀다.
   *   숫자: 넣을 수에 이어 붙인다(두 자리까지. 0으로 시작하지 않는다)
   *   enter: 넣을 수를 고른 칸에 넣는다
   *   erase: 누르던 숫자가 있으면 그것을 지우고, 없으면 고른 칸을 비운다
   */
  function pressKey(key) {
    const { round } = frame;
    if (!round || round.done) return;
    if (choice === null) {
      flash = T.status['pick-first'];
      draw();
      return;
    }
    flash = null;
    if (key === 'erase') {
      if (typing) {
        typing = '';
        draw();
        return;
      }
      if (round.cells[choice] === null) {
        draw();
        return;
      }
      const next = round.cells.slice();
      next[choice] = null;
      change(next, 'erase');
      return;
    }
    if (key === 'enter') {
      if (!typing) {
        flash = T.status['empty-key'];
        draw();
        return;
      }
      const value = Number(typing);
      typing = '';
      if (round.cells[choice] === value) {
        draw();
        return;
      }
      const next = round.cells.slice();
      next[choice] = value;
      change(next, 'place');
      return;
    }
    if (!/^[0-9]$/.test(key)) return;
    if (typing.length >= 2) flash = T.status['two-digits'];
    else if (!typing && key === '0') flash = T.status['zero-first'];
    else typing += key;
    draw();
  }

  /** 놓인 모습을 바꾼다. 다 됐으면 끝내고, 다 찼으면 견주어 보고, 아니면 바뀐 줄의 사실을 말한다 */
  function change(next, how) {
    const { round } = frame;
    const before = lineStates(round.board, round.cells);
    round.moves = [...round.moves, round.cells.slice()].slice(-MAX_MOVES);
    round.cells = next;
    round.moveCount += 1;
    if (how === 'place') round.placeCount += 1;
    else round.eraseCount += 1;
    frame.note(how, { cell: choice, cells: next.slice() });
    if (isDone(round.board, next)) {
      round.answers.push({ t: frame.stamp(), answer: `fill:${cellsKey(next)}`, correct: true, guess: null });
      frame.note('answer', { answer: 'done', correct: true });
      frame.finish('solved');
      return;
    }
    if (isFull(round.board, next)) {
      judgeFull();
      return;
    }
    const said = lineNews(before, lineStates(round.board, next), how);
    draw();
    frame.persist();
    if (said) frame.say(said);
  }

  /** 다 찬 줄 하나의 사실: 크기순의 수와 간격, 또는 두 번 나오는 수 */
  function lineFact(line) {
    const face = lineName(line.kind, line.index);
    const { sorted, gaps, twice } = line.judged;
    if (twice !== null) return fill(T.play[`twice-${end(twice)}`], { face, k: twice });
    return fill(T.play[`gaps-${end(sorted.at(-1))}${end(gaps.at(-1))}`], { face, k: sorted.join(', '), n: gaps.join(', ') });
  }

  /** 고른 칸의 가로줄과 세로줄 가운데 새로 다 찼는데 약속에 맞지 않는 줄을 말한다. 없으면 선생님이 방금 말한 줄이 맞게 바뀐 것을 말한다 */
  function lineNews(before, after, how) {
    const { round } = frame;
    const n = round.board.n;
    const row = Math.floor(choice / n);
    const col = choice % n;
    const near = after.filter((line) => (line.kind === 'row' && line.index === row) || (line.kind === 'col' && line.index === col));
    for (const line of near) {
      const old = before.find((item) => item.kind === line.kind && item.index === line.index);
      const fresh = old.values.join() !== line.values.join();
      if (!fresh || !line.full || line.judged.ok) continue;
      round.lineCount += 1;
      told = { kind: line.kind, index: line.index };
      return lineFact(line);
    }
    // 방금 말한 줄이 이제 약속에 맞으면 앞의 말은 이제 맞지 않는다. 지금 모습을 말한다
    if (told) {
      const line = after.find((item) => item.kind === told.kind && item.index === told.index);
      if (line.full && line.judged.ok) {
        told = null;
        return fill(T.play['now-ok'], { face: lineName(line.kind, line.index) });
      }
    }
    return how === 'erase' ? T.play.erase : null;
  }

  /** 빈칸을 모두 채웠는데 맞지 않는다: 같은 모습을 다시 채웠는지, 아니면 맞지 않는 첫 줄을 말한다 */
  function judgeFull() {
    const { round } = frame;
    const key = cellsKey(round.cells);
    const again = round.tries.includes(key);
    round.fullCount += 1;
    round.wrongCount += 1;
    if (!again) round.tries = [...round.tries, key].slice(-MAX_TRIES);
    frame.note('full', { again });
    draw();
    frame.persist();
    const line = lineStates(round.board, round.cells).find((item) => !item.judged.ok);
    told = { kind: line.kind, index: line.index };
    if (again) {
      frame.say(T.play['same-again']);
      return;
    }
    frame.say(`${T.play.full} ${lineFact(line)}`);
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    round.cells = round.moves.at(-1).slice();
    round.moves = round.moves.slice(0, -1);
    round.undoCount += 1;
    flash = null;
    typing = '';
    told = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 수 넣기에 한 말(줄의 간격)은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  /** 처음으로: 넣은 수를 모두 지운다. 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (round.done || filledCount(round.board, round.cells) === 0) return;
    round.moves = [...round.moves, round.cells.slice()].slice(-MAX_MOVES);
    round.cells = startCells(round.board);
    round.resetCount += 1;
    choice = null;
    typing = '';
    flash = null;
    told = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    return [T.right.done, solution.count === 1 ? T.right.one : T.right.more];
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 차례 풀이의 차례: { 칸 번호: 차례(1부터) } */
  const orderOf = (steps) => Object.fromEntries(steps.map((step, index) => [step.cell, index + 1]));

  function solutionPages(round, solution) {
    const { board } = round;
    if (!solution.possible) return [{ say: solution.complete ? T.solution.none : T.solution.far, nodes: [] }];
    const view = { n: board.n, black: board.black, givens: board.givens, cells: solution.example };
    if (solution.count === 1 && solution.steps.length > 0) {
      return [{ say: T.solution.one, nodes: [rowOf([gridCard({ ...view, order: orderOf(solution.steps) }, '', { big: true })])] }];
    }
    const say = solution.count === 1 ? T.solution['one-plain'] : T.solution.more;
    return [{ say, nodes: [rowOf([gridCard(view, '', { big: true })])] }];
  }

  /** 빈칸 하나에 대해 가로줄과 세로줄의 두 수가 허락하는 세 곳(작은 쪽, 가운데, 큰 쪽)의 표 */
  function threeTable(board, cell) {
    const { n } = board;
    const lines = lineStates(board, board.givens);
    const pick = (kind, index) => lines.find((line) => line.kind === kind && line.index === index);
    const rows = [
      ['row', pick('row', Math.floor(cell / n))],
      ['col', pick('col', cell % n)],
    ].map(([kind, line]) => {
      const [a, b] = line.values.filter((value) => value !== null).sort((x, y) => x - y);
      const low = 2 * a - b;
      const mid = (a + b) / 2;
      const high = 2 * b - a;
      const say = (value) => (Number.isInteger(value) && value >= 1 ? String(value) : T.table.none);
      return [fill(T.table[kind], { k: `${a}, ${b}` }), say(low), say(mid), say(high)];
    });
    return optionTable(T.table.head, rows);
  }

  /** "왜 그럴까?": 가운데 수를 넣었다가 막힌 이야기 → 두 수가 허락하는 세 곳과 두 줄의 겹침 → 한 칸이 다음 칸을 정한다 → 수학의 이름(마지막 장에만) */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다
      get nodes() {
        return [
          rowOf(
            slide.figures.flatMap((item) => {
              const board = { n: item.board.n, black: item.board.black, givens: item.board.givens };
              const view = { ...board, cells: item.cells ?? null, mark: item.mark ?? { rows: [], cols: [] }, ring: item.ring ?? [], order: item.order ?? {} };
              const card = gridCard(view, item.note);
              if (item.table === undefined) return [card];
              const box = document.createElement('div');
              box.className = 'sg-why-table';
              box.append(threeTable(board, item.table));
              card.classList.add('with-table');
              return [card, box];
            }),
          ),
        ];
      },
    }));
  }

  // ---- 직접 만들기: 크기를 정하고 칸에 수를 적거나 검은 칸으로 바꾼다. 선생님은 1부터 99까지의 수로 채우는 방법을 센다 ----
  const freshDraft = (n) => ({ n, black: [], givens: new Array(n * n).fill(null) });

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const ok = saved && checkBoard(saved) === null;
    return ok ? copyBoard(saved) : freshDraft(MAKE_FIRST);
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    pickMade = null;
    typingMade = '';
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const { n } = draft;
    $('seqgrid-make-n').textContent = fill(T.make.size, { n });
    $('seqgrid-make-fewer').disabled = n <= MIN_SIZE;
    $('seqgrid-make-more').disabled = n >= MAX_SIZE;
    $('seqgrid-make-clear').disabled = draft.black.length === 0 && draft.givens.every((value) => value === null);
    drawGrid($('seqgrid-make-board'), {
      n,
      black: draft.black,
      givens: draft.givens,
      cells: draft.givens,
      selected: pickMade,
      typing: typingMade,
      onCell: tapMadeCell,
      all: true,
      labels: { board: fill(T.labels.board, { n }), cell: cellLabel({ n, black: draft.black, givens: draft.givens }, draft.givens, pickMade, typingMade) },
    });
    drawPad($('seqgrid-make-keys'), $('seqgrid-make-shown'), typingMade, false);
    $('seqgrid-make-black').setAttribute('aria-pressed', String(pickMade !== null && draft.black.includes(pickMade)));
    $('seqgrid-make-result').textContent = made ? made.line : '';
    $('seqgrid-make-picture').replaceChildren(...(made?.nodes ?? []));
  }

  function changeDraft(next) {
    draft = next;
    made = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  function tapMadeCell(index) {
    pickMade = pickMade === index ? null : index;
    typingMade = '';
    drawMake();
  }

  /** 직접 만들기의 숫자판: 놀이 판과 같다. "검은 칸"은 고른 칸을 검은 칸으로 바꾸거나 되돌린다 */
  function pressMadeKey(key) {
    if (pickMade === null) {
      frame.talkers.make.say(T.make['pick-first']);
      return;
    }
    const black = draft.black.slice();
    const givens = draft.givens.slice();
    const at = black.indexOf(pickMade);
    if (key === 'black') {
      typingMade = '';
      if (at >= 0) black.splice(at, 1);
      else {
        black.push(pickMade);
        black.sort((a, b) => a - b);
        givens[pickMade] = null;
      }
      changeDraft({ n: draft.n, black, givens });
      return;
    }
    if (key === 'erase') {
      if (typingMade) {
        typingMade = '';
        drawMake();
        return;
      }
      if (at >= 0) black.splice(at, 1);
      givens[pickMade] = null;
      if (at < 0 && draft.givens[pickMade] === null) return;
      changeDraft({ n: draft.n, black, givens });
      return;
    }
    if (key === 'enter') {
      if (!typingMade) {
        frame.talkers.make.say(T.status['empty-key']);
        return;
      }
      const value = Number(typingMade);
      typingMade = '';
      if (at >= 0) black.splice(at, 1);
      givens[pickMade] = value;
      changeDraft({ n: draft.n, black, givens });
      return;
    }
    if (!/^[0-9]$/.test(key)) return;
    if (typingMade.length >= 2 || (!typingMade && key === '0')) return;
    typingMade += key;
    drawMake();
  }

  function resize(n) {
    if (n < MIN_SIZE || n > MAX_SIZE) return;
    pickMade = null;
    typingMade = '';
    changeDraft(freshDraft(n));
  }

  /** 아이가 만든 판을 따진다: 1부터 99까지의 수로 채우는 방법이 없는지, 하나뿐인지, 여럿인지(둘까지 센다) */
  function judgeDraft(board) {
    const result = countSolutions(board, { limit: 2, max: MAX_VALUE, budget: MAKE_BUDGET });
    return { result, chain: result.count === 1 ? stepSolve(board).solved : false };
  }

  /** 다 만든 판: 빈칸이 하나 이상이고 1부터 99까지의 수로 채울 수 있는 판. 아니면 null */
  function madeBoard() {
    if (!draft || checkBoard(draft) !== null || blanksOf(draft).length === 0) return null;
    const board = copyBoard(draft);
    return judgeDraft(board).result.count > 0 ? board : null;
  }

  /** 아이가 만든 판의 답을 풀이 프로그램으로 세어 알려 준다. 여럿이면 채우는 방법 둘을 그려 보인다 */
  function solveDraft() {
    const board = copyBoard(draft);
    typingMade = '';
    if (blanksOf(board).length === 0) {
      made = { line: T.make['no-blank'], nodes: [] };
      drawMake();
      frame.talkers.make.say(made.line);
      return;
    }
    const { result, chain } = judgeDraft(board);
    const givenCount = board.givens.filter((value) => value !== null).length;
    const parts = [];
    let nodes = [];
    const view = (cells) => ({ n: board.n, black: board.black, givens: board.givens, cells });
    if (!result.complete && result.count === 0) parts.push(T.make.far);
    else if (result.count === 0) parts.push(T.make.none);
    else if (result.count === 1) {
      parts.push(T.make.one, T.make[chain ? 'chain' : 'no-chain'], fill(T.make.count, { n: givenCount }));
      const best = fewest[board.n];
      fewest[board.n] = best === undefined ? givenCount : Math.min(best, givenCount);
      if (best !== undefined) parts.push(fill(T.make.fewest, { n: fewest[board.n] }));
    } else {
      parts.push(T.make.many);
      nodes = [rowOf(result.examples.map((cells) => gridCard(view(cells), T.make.other)))];
    }
    const line = parts.join(' ');
    made = { line, nodes };
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
      solution: { possible: result.count > 0, count: result.count, complete: result.complete, chain },
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
  const keyOf = (event) => event.target.closest('button')?.dataset.key;
  $('seqgrid-keys').addEventListener('click', (event) => {
    const key = keyOf(event);
    if (key) pressKey(key);
  });
  $('seqgrid-make-keys').addEventListener('click', (event) => {
    const key = keyOf(event);
    if (key) pressMadeKey(key);
  });
  $('seqgrid-make-black').addEventListener('click', () => pressMadeKey('black'));
  $('seqgrid-make-fewer').addEventListener('click', () => resize(draft.n - 1));
  $('seqgrid-make-more').addEventListener('click', () => resize(draft.n + 1));
  $('seqgrid-make-clear').addEventListener('click', () => {
    pickMade = null;
    typingMade = '';
    changeDraft(freshDraft(draft.n));
  });
  $('seqgrid-make-solve').addEventListener('click', solveDraft);
  $('seqgrid-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    const start = copyBoard(board);
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: start, // 판: 크기, 검은 칸, 적힌 수
      cells: startCells(start), // 칸마다의 수(적힌 수도 들어 있다. 빈칸은 null)
      moves: [], // 무르기에 쓰는 차례: 그 전의 놓인 모습
      tries: [], // 빈칸을 모두 채워 본 모습(같은 모습은 한 번)
      moveCount: 0, // 수를 넣거나 지운 수
      placeCount: 0, // 그 가운데 수를 넣은 것(바꾼 것도 센다)
      eraseCount: 0, // 그 가운데 지운 것
      lineCount: 0, // 한 줄이 다 찼는데 약속에 맞지 않아 선생님이 그 줄을 말한 수
      fullCount: 0, // 빈칸을 모두 채웠는데 맞지 않은 줄이 있던 수
      undoCount: 0,
      resetCount: 0,
      wrongCount: 0, // 사실과 다른 답의 수(빈칸을 모두 채웠는데 맞지 않던 것)
    };
  }

  return {
    id: FORMAT,
    T,
    padId: 'seqgrid-pad',
    makeId: 'make-seqgrid',
    // 5×5 판은 위아래로 크다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다(칸 하나가 44픽셀보다 작아지지 않게).
    ruleAside: true,
    homeIds: { sample: 'home-seqgrid-sample', blank: 'home-seqgrid-blank', ask: 'home-seqgrid-ask', play: 'home-seqgrid-play', pick: 'home-seqgrid-pick', make: 'home-seqgrid-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      if (!cellsOk(saved.board, saved.cells) || !Array.isArray(saved.moves) || !saved.moves.every((cells) => cellsOk(saved.board, cells))) return false;
      if (!Array.isArray(saved.tries) || !saved.tries.every((item) => typeof item === 'string')) return false;
      return [saved.moveCount, saved.placeCount, saved.eraseCount, saved.lineCount, saved.fullCount, saved.undoCount, saved.resetCount, saved.wrongCount].every(count);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글)을 보이거나 감춘다 */
    showParts(on) {
      $('seqgrid-board').hidden = !on;
      $('seqgrid-count').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      choice = null;
      typing = '';
      flash = null;
      told = null;
    },
    draw,
    ended() {
      choice = null;
      typing = '';
      flash = null;
      told = null;
    },
    ruleLine: (round) => T.rules[hintKey(round)],
    hints: (round) => T.hints[hintKey(round)],
    touched: (round) => round.moveCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view: (round) => ({ cells: round.cells.slice(), left: blanksOf(round.board).length - filledCount(round.board, round.cells), tries: round.tries.length }),
    /** 이 판보다 작은 판: 같은 걸음이 나오는 더 작은 판(답이 하나뿐인 판) */
    smaller: (round, turn) => smallerSeqgrid({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, count: solution.count },
        hintsOpened: round.hintsOpened,
        // 판을 떠날 때 놓인 수, 빈칸을 모두 채워 본 모습들
        cells: round.cells,
        tries: round.tries,
        moveCount: round.moveCount,
        placeCount: round.placeCount,
        eraseCount: round.eraseCount,
        lineCount: round.lineCount,
        fullCount: round.fullCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        // 수준 맞추기가 보는 "틀린 답"의 수
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    /** 글자판: 숫자는 넣을 수에 붙이고, Enter는 넣기, 지우기 글쇠는 지우기 */
    onKey(event) {
      if ($('seqgrid-pad').hidden || choice === null) return;
      if (/^[0-9]$/.test(event.key)) pressKey(event.key);
      else if (event.key === 'Enter') {
        event.preventDefault?.();
        pressKey('enter');
      } else if (event.key === 'Backspace' || event.key === 'Delete') pressKey('erase');
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawMini(root, { n: board.n, black: board.black, givens: board.givens });
    },
    drawBlank(root) {
      drawMini(root, { n: 3, black: [], givens: new Array(9).fill(null) });
    },
    /** 하던 판과 공책의 그림: 적힌 수와 넣은 수 */
    drawResume(root, saved) {
      const cells = cellsOk(saved.board, saved.cells) ? saved.cells : null;
      drawMini(root, { n: saved.board.n, black: saved.board.black, givens: saved.board.givens, cells });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawMini(root, { n: 3, black: [], givens: new Array(9).fill(null) });
        return;
      }
      const { board } = generateBoard(entry.level, entry.picture.seed);
      drawMini(root, { n: board.n, black: board.black, givens: board.givens });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
  };
}

