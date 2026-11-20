// 곱 단서 퍼즐: 판 화면에서 이 형식이 맡는 부분(판, 수 넣기, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/product.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 칸을 누르고 오른쪽 숫자판에서 수를 고르면 그 칸에 들어간다. 1부터 2n까지의 수는 한 번씩만 쓴다.
// 이미 판에 놓은 수를 고르면 그 수가 원래 칸에서 고른 칸으로 옮겨 온다(판 아래에 그 사실만 적는다).
// 선생님은 판정하지 않는다. 줄에 수가 둘이 되었는데 곱이 단서와 다르면 두 수의 곱과 단서를 그대로 말하고,
// 줄에 수가 셋 이상이면 그 수를 말한다. 수를 모두 놓았는데 맞지 않으면 어느 줄인지 말한다. 같은 모습을 다시 놓으면 그렇다고 말한다.
// 수를 모두 놓고 줄마다 두 수의 곱이 보이는 단서와 모두 같으면 끝난다.
// 판의 종류(mode)
//   small  3×3 판(1단계)      four  4×4 판(2단계)      few  두 가지로 갈리는 단서가 많은 4×4 판(3단계)
//   hidden 숨은 단서(4단계)   five  5×5 판(5단계)      made 직접 만든 판(답이 여럿일 수 있다. 단서에 맞는 답이면 어느 것이든 끝난다)
// 왼쪽 칸의 "곱이 되는 두 수 보기"를 켜면 단서를 누를 수 있고, 누른 단서의 곱이 되는 두 수(1부터 2n까지)를 오른쪽에 늘어놓는다.
// 어느 두 수가 이미 쓰였는지는 따지지 않는다(처음 켤 때 힌트 하나로 센다).
import T from '../content/product.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/product-ladder.js';
import { MAX_SIZE, MIN_SIZE, cellsOk, checkBoard, cluesOf, copyBoard, countSolutions, emptyCells, hiddenCount, isDone, lineStates, numbersOf, pairsOf, placedCount, solve } from '../core/product.js';
import { smallerProduct } from '../core/smaller.js';
import { endsClosed, fill, ordinal } from '../core/text.js';
import { drawGrid, drawMini, gridCard, pairTable } from '../ui/product-board.js';

const FORMAT = 'product';
const MODES = ['small', 'four', 'few', 'hidden', 'five', 'made'];
/** 기록에 남기는 무르기 차례와 모두 놓아 본 모습의 수의 위 끝 */
const MAX_MOVES = 300;
const MAX_TRIES = 200;
/** 직접 만들기: 세는 답의 수의 위 끝과 걸음 수의 위 끝 */
const MAKE_LIMIT = 20;
const MAKE_BUDGET = 3_000_000;
/** 직접 만들기의 처음 판의 크기 */
const MAKE_FIRST = 4;

/** 수 뒤에 붙는 말: 받침이 있으면 c, 없으면 o */
const end = (number) => (endsClosed(number) ? 'c' : 'o');
const cellsKey = (cells) => cells.map((value) => value ?? 0).join(',');
const sameCells = (a, b) => cellsKey(a) === cellsKey(b);

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createProduct(frame) {
  const { $, log } = frame;
  let choice = null; // 고른 칸의 번호
  let focus = null; // "곱이 되는 두 수 보기"에서 누른 단서 { kind, index }
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let told = null; // 선생님이 방금 말한 줄 { kind, index, state, count }(그 줄이 바뀌면 지금 모습을 다시 말한다)
  let draft = null; // 직접 만들기에서 만들던 판 { n, cells, veil: { row, col } }
  let pickMade = null; // 직접 만들기에서 고른 칸
  let made = null; // 직접 만들기에서 선생님이 따진 것(판을 고치면 지운다)

  const count = (value) => Number.isInteger(value) && value >= 0;
  const ruleKey = (round) => (hiddenCount(round.board) > 0 ? 'hidden' : 'full');
  const lineName = (kind, index) => fill(T.labels[kind], { no: ordinal(index + 1) });

  /** 한 번 푼 판은 적어 둔다(판을 열 때마다, 기록을 남길 때마다 다시 풀지 않게) */
  const memo = new Map();
  function solutionOf(board) {
    const key = JSON.stringify(copyBoard(board));
    if (!memo.has(key)) memo.set(key, solve(board));
    return memo.get(key);
  }

  /** 줄마다의 모습을 가로줄과 세로줄로 나눈다 */
  function statesOf(board, cells) {
    const lines = lineStates(board, cells);
    return {
      lines,
      row: lines.filter((line) => line.kind === 'row').map((line) => line.state),
      col: lines.filter((line) => line.kind === 'col').map((line) => line.state),
    };
  }

  // ---- 읽어 주는 이름 ----
  function cellLabel(n) {
    return (index, value, picked) => {
      const face = value === null ? T.labels.empty : fill(T.labels.number, { k: value });
      const name = fill(T.labels.cell, { no: ordinal(Math.floor(index / n) + 1), k: (index % n) + 1, face });
      return picked ? fill(T.labels.picked, { face: name }) : name;
    };
  }

  function labelsFor(board, cells) {
    const { lines } = statesOf(board, cells);
    return {
      board: fill(T.labels.board, { n: board.n }),
      cell: cellLabel(board.n),
      clue: (kind, index) => {
        const line = lines.find((item) => item.kind === kind && item.index === index);
        const face = lineName(kind, index);
        if (line.clue === null) return fill(T.labels['clue-hidden'], { face });
        if (line.state === 'ok') return fill(T.labels['clue-ok'], { face, k: line.clue });
        if (line.state === 'off') return fill(T.labels['clue-off'], { face, k: line.clue, n: line.product });
        if (line.state === 'many') return fill(T.labels['clue-many'], { face, k: line.clue, n: line.numbers.length });
        return fill(T.labels.clue, { face, k: line.clue });
      },
    };
  }

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    const states = statesOf(board, round.cells);
    drawGrid($('product-board'), {
      n: board.n,
      cells: round.cells,
      rows: board.rows,
      cols: board.cols,
      states,
      selected: playing ? choice : null,
      focus: round.pairsOn ? focus : null,
      onCell: playing ? tapCell : undefined,
      onClue: playing && round.pairsOn ? tapClue : undefined,
      labels: labelsFor(board, round.cells),
    });
    const placed = placedCount(round.cells);
    $('product-placed').textContent = String(placed);
    $('product-left').textContent = String(numbersOf(board.n) - placed);
    $('product-status').textContent = flash ?? statusOf(round, playing);
    drawKeys($('product-keys'), board.n, round.cells, !playing);
    $('product-pairs').setAttribute('aria-pressed', String(round.pairsOn));
    $('product-pair-box').hidden = !round.pairsOn;
    drawPairs(round);
    $('undo').disabled = !playing || round.moves.length === 0;
    $('reset').disabled = !playing || placedCount(round.cells) === 0;
    frame.showWhy();
  }

  function statusOf(round, playing) {
    if (!playing) return isDone(round.board, round.cells) ? T.status.done : '';
    if (choice !== null) return round.cells[choice] === null ? T.status.picked : T.status['picked-full'];
    if (placedCount(round.cells) === numbersOf(round.board.n)) return T.status.full;
    return T.status.begin;
  }

  /** 숫자판: 판에 쓰는 수만 보이고, 판에 놓은 수는 표시한다(밑줄 무늬와 읽어 주는 이름. 색만으로 알리지 않는다) */
  function drawKeys(root, n, cells, off) {
    for (const key of root.querySelectorAll('button')) {
      key.disabled = off;
      if (key.dataset.n === 'erase') continue;
      const k = Number(key.dataset.n);
      key.hidden = k > numbersOf(n);
      const used = cells.includes(k);
      key.classList.toggle('used', used);
      key.setAttribute('aria-label', fill(T.labels[used ? 'key-used' : 'key'], { k }));
    }
  }

  /** "곱이 되는 두 수 보기": 누른 단서의 곱이 되는 두 수를 늘어놓는다(쓰인 수는 따지지 않는다) */
  function drawPairs(round) {
    const list = $('product-pair-list');
    if (!round.pairsOn || focus === null) {
      list.replaceChildren(paragraph(T.pairs.note));
      return;
    }
    const clue = focus.kind === 'row' ? round.board.rows[focus.index] : round.board.cols[focus.index];
    if (clue === null) {
      list.replaceChildren(paragraph(T.pairs.hidden));
      return;
    }
    const title = document.createElement('strong');
    title.className = 'pd-pair-title';
    title.textContent = fill(T.pairs.title, { k: clue });
    const chips = document.createElement('ul');
    chips.className = 'pd-pairs';
    for (const [a, b] of pairsOf(clue, round.board.n)) {
      const item = document.createElement('li');
      item.textContent = fill(T.pairs.pair, { k: a, n: b });
      chips.append(item);
    }
    list.replaceChildren(title, chips);
  }

  function paragraph(text) {
    const node = document.createElement('p');
    node.className = 'pad-note';
    node.textContent = text;
    return node;
  }

  // ---- 수 넣기 ----
  function tapCell(index) {
    const { round } = frame;
    if (!round || round.done) return;
    flash = null;
    choice = choice === index ? null : index;
    draw();
  }

  /** 숫자판을 눌렀다: 고른 칸에 수를 넣거나(판의 다른 칸에 있던 수면 옮겨 온다) 지운다 */
  function pressKey(key) {
    const { round } = frame;
    if (!round || round.done) return;
    if (choice === null) {
      flash = T.status['pick-first'];
      draw();
      return;
    }
    flash = null;
    const next = round.cells.slice();
    if (key === 'erase') {
      if (next[choice] === null) {
        draw();
        return;
      }
      next[choice] = null;
      change(next, 'erase');
      return;
    }
    const k = Number(key);
    if (!Number.isInteger(k) || k < 1 || k > numbersOf(round.board.n)) return;
    if (next[choice] === k) {
      draw();
      return;
    }
    const from = next.indexOf(k);
    if (from >= 0) next[from] = null;
    next[choice] = k;
    if (from >= 0) flash = fill(T.status[`move-${end(k)}`], { k });
    change(next, from >= 0 ? 'move' : 'place');
  }

  /** 놓인 모습을 바꾼다. 다 됐으면 끝내고, 다 찼으면 견주어 보고, 아니면 바뀐 줄의 사실을 말한다 */
  function change(next, how) {
    const { round } = frame;
    const before = statesOf(round.board, round.cells).lines;
    round.moves = [...round.moves, round.cells.slice()].slice(-MAX_MOVES);
    round.cells = next;
    round.moveCount += 1;
    if (how === 'place') round.placeCount += 1;
    else if (how === 'move') round.shiftCount += 1;
    else round.eraseCount += 1;
    frame.note(how, { cell: choice, cells: next.slice() });
    if (isDone(round.board, next)) {
      round.answers.push({ t: frame.stamp(), answer: `place:${cellsKey(next)}`, correct: true, guess: null });
      frame.note('answer', { answer: 'done', correct: true });
      frame.finish('solved');
      return;
    }
    if (placedCount(next) === numbersOf(round.board.n)) {
      judgeFull();
      return;
    }
    const said = lineFact(before, statesOf(round.board, next).lines, how);
    draw();
    frame.persist();
    if (said) frame.say(said);
  }

  /** 고른 칸의 가로줄과 세로줄 가운데 새로 곱이 단서와 달라졌거나 수가 셋 이상이 된 줄을 말한다. 없으면 선생님이 방금 말한 줄이 바뀐 것을 말한다 */
  function lineFact(before, after, how) {
    const { round } = frame;
    const n = round.board.n;
    const row = Math.floor(choice / n);
    const col = choice % n;
    const near = after.filter((line) => (line.kind === 'row' && line.index === row) || (line.kind === 'col' && line.index === col));
    for (const line of near) {
      const old = before.find((item) => item.kind === line.kind && item.index === line.index);
      const fresh = old.state !== line.state || old.numbers.join() !== line.numbers.join();
      if (!fresh) continue;
      if (line.state === 'off') {
        round.offCount += 1;
        told = { kind: line.kind, index: line.index, state: line.state, count: line.numbers.length };
        const [a, b] = line.numbers;
        return fill(T.play[`off-${end(b)}${end(line.clue)}`], { face: lineName(line.kind, line.index), k: a, n: b, total: line.product, f: line.clue });
      }
      if (line.state === 'many') {
        told = { kind: line.kind, index: line.index, state: line.state, count: line.numbers.length };
        return fill(T.play.many, { face: lineName(line.kind, line.index), n: line.numbers.length });
      }
    }
    // 방금 말한 줄의 모습이 바뀌었으면 앞의 말은 이제 맞지 않는다. 지금 모습을 말한다
    if (told) {
      const line = after.find((item) => item.kind === told.kind && item.index === told.index);
      if (line.state !== told.state || line.numbers.length !== told.count) {
        told = null;
        const face = lineName(line.kind, line.index);
        if (line.state === 'ok' && line.clue !== null) return fill(T.play['now-ok'], { face });
        return fill(T.play.now, { face, n: line.numbers.length });
      }
    }
    return how === 'erase' ? T.play.erase : null;
  }

  /** 수를 모두 놓았는데 맞지 않는다: 같은 모습을 다시 놓았는지, 아니면 맞지 않는 첫 줄을 말한다 */
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
    const { lines } = statesOf(round.board, round.cells);
    const line = lines.find((item) => item.state === 'off') ?? lines.find((item) => item.state !== 'ok');
    told = { kind: line.kind, index: line.index, state: line.state, count: line.numbers.length };
    if (again) {
      frame.say(T.play['same-again']);
      return;
    }
    const face = lineName(line.kind, line.index);
    frame.say(line.state === 'off' ? fill(T.play['full-off'], { face }) : fill(T.play['full-count'], { face, n: line.numbers.length }));
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    round.cells = round.moves.at(-1).slice();
    round.moves = round.moves.slice(0, -1);
    round.undoCount += 1;
    flash = null;
    told = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 수 넣기에 한 말(곱이 단서와 달라요, 수가 셋이에요)은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  /** 처음으로: 놓은 수를 모두 지운다. 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (round.done || placedCount(round.cells) === 0) return;
    round.moves = [...round.moves, round.cells.slice()].slice(-MAX_MOVES);
    round.cells = emptyCells(round.board.n);
    round.resetCount += 1;
    choice = null;
    flash = null;
    told = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  /** 왼쪽 칸의 도구: 켜면 단서를 누를 수 있고, 누른 단서의 곱이 되는 두 수가 보인다. 처음 켤 때 힌트 하나로 센다 */
  function togglePairs() {
    const { round } = frame;
    if (!round) return;
    round.pairsOn = !round.pairsOn;
    focus = null;
    if (round.pairsOn) {
      round.pairsShown = true;
      round.pairsCount += 1;
    }
    frame.note('pairs', { on: round.pairsOn });
    draw();
    frame.keep();
  }

  function tapClue(kind, index) {
    const { round } = frame;
    if (!round || round.done || !round.pairsOn) return;
    focus = focus && focus.kind === kind && focus.index === index ? null : { kind, index };
    if (focus) {
      round.clueLooks += 1;
      frame.note('clue', { kind, index });
    }
    draw();
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    return [fill(T.right.done, { n: numbersOf(round.board.n) }), solution.count === 1 ? T.right.one : T.right.more];
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  function solutionPages(round, solution) {
    const { board } = round;
    const say = solution.count === 1 ? T.solution.one : T.solution.more;
    return [{ say, nodes: [rowOf([gridCard({ n: board.n, cells: solution.example, rows: board.rows, cols: board.cols }, '', { big: true })])] }];
  }

  /** 단서마다 곱이 되는 두 수의 표(같은 단서는 한 번만, 작은 단서부터) */
  function pairNode(board) {
    const clues = [...new Set([...board.rows, ...board.cols].filter((clue) => clue !== null))].sort((a, b) => a - b);
    const lines = clues.map((clue) => [
      String(clue),
      pairsOf(clue, board.n)
        .map(([a, b]) => fill(T.pairs.pair, { k: a, n: b }))
        .join(T.table.join),
    ]);
    return pairTable([T.table.clue, T.table.pairs], lines);
  }

  /** "왜 그럴까?": 칸 대신 단서 보기 → 한 가지로 갈리는 단서가 만나는 칸 → 한 가지로 갈리는 단서부터 보기(이름) → 가로줄만으로는 안 되는 판 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다
      get nodes() {
        return [
          rowOf(
            slide.figures.flatMap((item) => {
              const view = { ...item.board, cells: item.cells ?? null, mark: item.mark ?? { rows: [], cols: [] } };
              if (!item.table) return [gridCard(view, item.note)];
              const box = document.createElement('div');
              box.className = 'pd-why-table';
              box.append(pairNode(item.board));
              // 표가 있는 장은 판을 조금 작게 그려 표와 나란히 놓는다
              const card = gridCard(view, item.note);
              card.classList.add('with-table');
              return [card, box];
            }),
          ),
        ];
      },
    }));
  }

  // ---- 직접 만들기: 크기를 정하고 칸에 수를 넣는다. 줄마다 두 수가 되면 판 밖에 곱이 생기고, 곱을 누르면 숨긴다 ----
  const freshDraft = (n) => ({ n, cells: emptyCells(n), veil: { row: new Array(n).fill(false), col: new Array(n).fill(false) } });

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const ok =
      saved &&
      Number.isInteger(saved.n) &&
      saved.n >= MIN_SIZE &&
      saved.n <= MAX_SIZE &&
      cellsOk(saved.n, saved.cells) &&
      ['row', 'col'].every((kind) => Array.isArray(saved.veil?.[kind]) && saved.veil[kind].length === saved.n && saved.veil[kind].every((value) => typeof value === 'boolean'));
    return ok ? { n: saved.n, cells: saved.cells.slice(), veil: { row: saved.veil.row.slice(), col: saved.veil.col.slice() } } : freshDraft(MAKE_FIRST);
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    pickMade = null;
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  /** 만들던 판의 줄마다의 곱(수가 딱 둘인 줄만. 아니면 undefined) */
  function draftClues() {
    const empty = { n: draft.n, rows: new Array(draft.n).fill(null), cols: new Array(draft.n).fill(null) };
    const lines = lineStates(empty, draft.cells);
    const of = (kind) => lines.filter((line) => line.kind === kind).map((line) => (line.numbers.length === 2 ? line.product : undefined));
    return { rows: of('row'), cols: of('col') };
  }

  function drawMake() {
    const { n } = draft;
    const clues = draftClues();
    $('product-make-n').textContent = fill(T.make.size, { n });
    $('product-make-fewer').disabled = n <= MIN_SIZE;
    $('product-make-more').disabled = n >= MAX_SIZE;
    $('product-make-show').disabled = !draft.veil.row.some(Boolean) && !draft.veil.col.some(Boolean);
    $('product-make-clear').disabled = placedCount(draft.cells) === 0;
    drawGrid($('product-make-board'), {
      n,
      cells: draft.cells,
      rows: clues.rows,
      cols: clues.cols,
      selected: pickMade,
      veiled: draft.veil,
      onCell: tapMadeCell,
      onClue: toggleVeil,
      labels: {
        board: fill(T.labels.board, { n }),
        cell: cellLabel(n),
        clue: (kind, index) => {
          const face = lineName(kind, index);
          const clue = clues[kind === 'row' ? 'rows' : 'cols'][index];
          if (clue === undefined) return fill(T.labels['clue-none'], { face });
          return fill(T.labels[draft.veil[kind][index] ? 'made-hidden' : 'clue'], { face, k: clue });
        },
      },
    });
    drawKeys($('product-make-keys'), n, draft.cells, false);
    $('product-make-result').textContent = made ? made.line : '';
    $('product-make-picture').replaceChildren(...(made?.node ? [made.node] : []));
  }

  function changeDraft(next) {
    draft = next;
    made = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  function tapMadeCell(index) {
    pickMade = pickMade === index ? null : index;
    drawMake();
  }

  /** 직접 만들기의 숫자판: 놀이 판과 같다(판에 놓은 수를 고르면 옮겨 온다) */
  function pressMadeKey(key) {
    if (pickMade === null) {
      frame.talkers.make.say(T.make['pick-first']);
      return;
    }
    const cells = draft.cells.slice();
    if (key === 'erase') cells[pickMade] = null;
    else {
      const k = Number(key);
      if (!Number.isInteger(k) || k < 1 || k > numbersOf(draft.n)) return;
      const from = cells.indexOf(k);
      if (from >= 0) cells[from] = null;
      cells[pickMade] = k;
    }
    if (sameCells(cells, draft.cells)) return;
    changeDraft({ ...draft, cells });
  }

  /** 곱을 누르면 숨기고, 다시 누르면 보인다(수가 둘인 줄만) */
  function toggleVeil(kind, index) {
    const clues = draftClues();
    if (clues[kind === 'row' ? 'rows' : 'cols'][index] === undefined) return;
    const veil = { row: draft.veil.row.slice(), col: draft.veil.col.slice() };
    veil[kind][index] = !veil[kind][index];
    changeDraft({ ...draft, veil });
  }

  function resize(n) {
    if (n < MIN_SIZE || n > MAX_SIZE) return;
    pickMade = null;
    changeDraft(freshDraft(n));
  }

  /** 다 만든 판: 줄마다 두 수씩 1부터 2n까지 모두 놓였을 때 계산한 단서(숨긴 단서는 null). 아니면 null */
  function madeBoard() {
    if (!draft) return null;
    const full = cluesOf(draft.n, draft.cells);
    if (!full) return null;
    const board = { n: draft.n, rows: full.rows.map((clue, index) => (draft.veil.row[index] ? null : clue)), cols: full.cols.map((clue, index) => (draft.veil.col[index] ? null : clue)) };
    return checkBoard(board) === null ? board : null;
  }

  /** 아이가 만든 판의 답을 풀이 프로그램으로 세어 알려 준다. 답이 여럿이면 아이의 것과 다른 답 하나를 그려 보인다 */
  function solveDraft() {
    const board = madeBoard();
    if (!board) {
      const line = fill(T.make['not-yet'], { n: numbersOf(draft.n) });
      made = { line, node: null };
      drawMake();
      frame.talkers.make.say(line);
      return;
    }
    const result = countSolutions(board, { limit: MAKE_LIMIT + 1, budget: MAKE_BUDGET });
    const other = result.examples.find((cells) => !sameCells(cells, draft.cells)) ?? null;
    const parts = [];
    const veiled = hiddenCount(board);
    if (veiled > 0) parts.push(fill(T.make.veiled, { n: veiled }));
    if (!result.complete) parts.push(fill(T.make.far, { n: result.count }));
    else if (result.count === 1) parts.push(T.make.one);
    else if (result.count > MAKE_LIMIT) parts.push(fill(T.make.over, { n: MAKE_LIMIT }));
    else parts.push(fill(T.make.many, { n: result.count }));
    const line = parts.join(' ');
    made = { line, node: other ? gridCard({ n: board.n, cells: other, rows: board.rows, cols: board.cols }, T.make.other) : null };
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
      cells: draft.cells.slice(),
      solution: { possible: true, count: result.count, complete: result.complete, limit: MAKE_LIMIT },
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
  $('product-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.n;
    if (key) pressKey(key);
  });
  $('product-pairs').addEventListener('click', togglePairs);
  $('product-make-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.n;
    if (key) pressMadeKey(key);
  });
  $('product-make-fewer').addEventListener('click', () => resize(draft.n - 1));
  $('product-make-more').addEventListener('click', () => resize(draft.n + 1));
  $('product-make-show').addEventListener('click', () => changeDraft({ ...draft, veil: { row: new Array(draft.n).fill(false), col: new Array(draft.n).fill(false) } }));
  $('product-make-clear').addEventListener('click', () => {
    pickMade = null;
    changeDraft(freshDraft(draft.n));
  });
  $('product-make-solve').addEventListener('click', solveDraft);
  $('product-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    const start = copyBoard(board);
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: start, // 판: 크기와 줄마다의 단서(숨은 단서는 null)
      cells: emptyCells(start.n), // 칸마다 놓인 수(빈칸은 null)
      moves: [], // 무르기에 쓰는 차례: 그 전의 놓인 모습
      tries: [], // 수를 모두 놓아 본 모습(같은 모습은 한 번)
      pairsOn: false, // 지금 "곱이 되는 두 수 보기"를 켜 두었는가
      pairsShown: false, // 한 번이라도 켰는가
      pairsCount: 0, // 켠 수
      clueLooks: 0, // 켠 동안 단서를 눌러 두 수를 본 수
      moveCount: 0, // 수를 넣거나 옮기거나 지운 수
      placeCount: 0, // 그 가운데 빈 수를 넣은 것
      shiftCount: 0, // 그 가운데 판의 다른 칸에 있던 수를 옮겨 온 것
      eraseCount: 0, // 그 가운데 지운 것
      offCount: 0, // 줄에 두 수가 되었는데 곱이 단서와 달랐던 수
      fullCount: 0, // 수를 모두 놓았는데 맞지 않은 줄이 있던 수
      undoCount: 0,
      resetCount: 0,
      wrongCount: 0, // 사실과 다른 답의 수(수를 모두 놓았는데 맞지 않던 것)
    };
  }

  return {
    id: FORMAT,
    T,
    padId: 'product-pad',
    makeId: 'make-product',
    // 5×5 판은 단서까지 여섯 줄이라 위아래로 크다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다(칸 하나가 44픽셀보다 작아지지 않게).
    ruleAside: true,
    homeIds: { sample: 'home-product-sample', blank: 'home-product-blank', ask: 'home-product-ask', play: 'home-product-play', pick: 'home-product-pick', make: 'home-product-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      const { n } = saved.board;
      if (!cellsOk(n, saved.cells) || !Array.isArray(saved.moves) || !saved.moves.every((cells) => cellsOk(n, cells))) return false;
      if (!Array.isArray(saved.tries) || !saved.tries.every((item) => typeof item === 'string')) return false;
      if (typeof saved.pairsOn !== 'boolean' || typeof saved.pairsShown !== 'boolean') return false;
      return [saved.pairsCount, saved.clueLooks, saved.moveCount, saved.placeCount, saved.shiftCount, saved.eraseCount, saved.offCount, saved.fullCount, saved.undoCount, saved.resetCount, saved.wrongCount].every(count);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('product-board').hidden = !on;
      $('product-count').hidden = !on;
      $('product-pairs').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      choice = null;
      focus = null;
      flash = null;
      told = null;
    },
    draw,
    ended() {
      choice = null;
      focus = null;
      flash = null;
      told = null;
    },
    ruleLine: (round) => fill(T.rules[ruleKey(round)], { n: numbersOf(round.board.n) }),
    hints: (round) => T.hints[ruleKey(round)],
    touched: (round) => round.moveCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view: (round) => ({ cells: round.cells.slice(), left: numbersOf(round.board.n) - placedCount(round.cells), tries: round.tries.length, pairs: round.pairsOn }),
    /** 이 판보다 작은 판: 한 줄이 적은 판(답이 하나뿐인 판) */
    smaller: (round, turn) => smallerProduct({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, count: solution.count },
        // 질문 힌트와 "곱이 되는 두 수 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.pairsShown ? 1 : 0),
        pairsShown: round.pairsShown,
        pairsCount: round.pairsCount,
        clueLooks: round.clueLooks,
        // 판을 떠날 때 놓인 수, 수를 모두 놓아 본 모습들
        cells: round.cells,
        tries: round.tries,
        moveCount: round.moveCount,
        placeCount: round.placeCount,
        shiftCount: round.shiftCount,
        eraseCount: round.eraseCount,
        offCount: round.offCount,
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
    /** 글자판: 숫자는 고른 칸에 넣고(0은 10), 지우기 글쇠는 고른 칸을 비운다 */
    onKey(event) {
      if ($('product-pad').hidden || choice === null) return;
      if (/^[0-9]$/.test(event.key)) pressKey(event.key === '0' ? '10' : event.key);
      else if (event.key === 'Backspace' || event.key === 'Delete') pressKey('erase');
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawMini(root, { n: board.n, rows: board.rows, cols: board.cols });
    },
    drawBlank(root) {
      drawMini(root, { n: 3, rows: [undefined, undefined, undefined], cols: [undefined, undefined, undefined] });
    },
    /** 하던 판과 공책의 그림: 놓인 수와 단서 */
    drawResume(root, saved) {
      const cells = cellsOk(saved.board.n, saved.cells) ? saved.cells : null;
      drawMini(root, { n: saved.board.n, cells, rows: saved.board.rows, cols: saved.board.cols });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawMini(root, { n: 3, rows: [undefined, undefined, undefined], cols: [undefined, undefined, undefined] });
        return;
      }
      const { board } = generateBoard(entry.level, entry.picture.seed);
      drawMini(root, { n: board.n, rows: board.rows, cols: board.cols });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
