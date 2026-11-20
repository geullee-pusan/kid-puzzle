// 조각 가짓수 찾기: 판 화면에서 이 형식이 맡는 부분(모눈, 찾은 조각의 줄, 짐작한 수, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/pieces.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판은 한 가지다: 모눈의 칸을 눌러 n칸 조각을 만들고 "올려놓기"를 누른다.
//   - 칸이 모자라거나 떨어져 있으면(가장 긴 줄이 정해진 판에서는 줄이 다르면) 그 사실만 말하고 선반에 놓지 않는다.
//   - 찾은 조각과 같으면(판의 약속으로) 새 조각을 그 조각 위에 돌리거나 뒤집어 겹쳐 보이고, 어떻게 겹치는지 말한다.
//   - 처음 찾은 조각이면 찾은 조각의 줄(선반)에 놓는다. 돌리거나 뒤집으면 겹치지만 이 판의 약속으로는 다른 조각이면,
//     겹쳐 보이고 다른 조각으로 친다고 말한 뒤 선반에 놓는다.
//   - 다 찾으면 끝난다. 찾은 것이 있으면 "여기까지 할래요"로 끝내도 된다(이것도 끝까지 한 판이다).
// 짐작하는 판(tell이 거짓)에서는 먼저 모두 몇 가지일지 수를 넣는다. 끝날 때까지 몇 가지가 남았는지 말하지 않는다.
// 왼쪽 칸의 "가장 긴 줄로 묶어 보기"는 선반을 가장 긴 줄의 칸 수로 묶어 늘어놓는 도구다. 무엇이 빠졌는지는 말하지 않는다.
import T from '../content/pieces.json';
import { smallerPieces } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/pieces-ladder.js';
import { MAX_SIZE, MIN_SIZE, RULES, cellKey, checkBoard, checkPiece, compareWith, connected, copyBoard, gridOf, keyOf, longestRow, normalize, solve, targetsOf } from '../core/pieces.js';
import { drawCompare, drawFamily, drawFigure, drawGrid, drawMini, drawMiniGrid, drawStrip, pieceCard, replayCompare } from '../ui/pieces-board.js';

const FORMAT = 'pieces';
/** 기록에 남기는 올려놓아 본 조각의 수의 위 끝 */
const MAX_TRIES = 300;
/** 넣을 수 있는 짐작한 수의 자릿수 */
const TYPE_LIMIT = 2;

/** 판의 종류: 가장 긴 줄이 정해진 판, 약속을 바꾼 판, 가짓수를 알려 주는 판, 짐작하는 판 */
const kindOf = (board) => (board.row !== null ? 'row' : board.rule !== 'free' ? board.rule : board.tell ? 'told' : 'guess');
/** 조각의 크기를 말로("다섯 칸") */
const sizeWord = (n) => T.sizes[String(n)];

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createPieces(frame) {
  const { $, log } = frame;
  let draft = null; // 직접 만들기에서 정한 것 { n, rule }
  let made = null; // 직접 만들기에서 선생님이 센 것(정한 것이 바뀌면 지운다)

  const count = (value) => Number.isInteger(value) && value >= 0;

  /** 한 번 푼 판은 적어 둔다 */
  const memo = new Map();
  function solutionOf(board) {
    const key = JSON.stringify(copyBoard(board));
    if (!memo.has(key)) memo.set(key, solve(board));
    return memo.get(key);
  }

  const needGuess = (round) => !round.board.tell && round.guess === null;
  const cellName = (x, y, on) => fill(T.cellLabel, { no: ordinal(y + 1), n: ordinal(x + 1), face: T.cells[on ? 'on' : 'off'] });

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    const grid = gridOf(board.n);
    if (round.compare) {
      const { compare } = round;
      drawCompare($('pieces-board'), {
        cells: compare.cells,
        target: round.found[compare.at].cells,
        turn: compare.turn,
        label: fill(T.boardLabel.compare, { no: ordinal(compare.at + 1) }),
        onTap: replayed,
      });
    } else {
      drawGrid($('pieces-board'), {
        ...grid,
        cells: round.cells,
        onCell: playing ? tapCell : null,
        cellLabel: cellName,
        label: fill(T.boardLabel.grid, { n: grid.w, no: grid.h }),
      });
    }
    $('pieces-status').textContent = statusOf(round, playing);
    $('pieces-again').hidden = !round.compare;
    $('pieces-back').hidden = !round.compare || !playing;
    drawPad(round, playing);
    drawShelf(round);
    $('pieces-sort').setAttribute('aria-pressed', String(round.sorted));
    frame.showWhy();
  }

  function statusOf(round, playing) {
    if (round.compare) return playing ? T.status.compare : '';
    if (!playing) return '';
    if (needGuess(round)) return T.status.guess;
    const { n } = round.board;
    if (round.cells.length === 0) return fill(T.status.empty, { face: sizeWord(n) });
    if (round.cells.length < n) return fill(T.status.more, { n: n - round.cells.length });
    return connected(round.cells) ? T.status.ready : T.status.apart;
  }

  /** 오른쪽 칸: 짐작하는 판은 먼저 숫자판, 그다음 올려놓기와 찾은 조각의 줄 */
  function drawPad(round, playing) {
    const asking = playing && needGuess(round);
    $('pieces-guess-box').hidden = !asking;
    $('pieces-find-box').hidden = asking;
    $('pieces-guess-ask').textContent = fill(T.guess.ask, { face: sizeWord(round.board.n) });
    $('pieces-typed').textContent = round.typed;
    for (const key of $('pieces-keys').querySelectorAll('button')) {
      key.disabled = !asking || (key.dataset.n === 'erase' ? round.typed === '' : round.typed.length >= TYPE_LIMIT);
    }
    $('pieces-guess-go').disabled = !asking || round.typed === '';
    $('pieces-guess-line').hidden = round.guess === null;
    $('pieces-guess-line').textContent = round.guess === null ? '' : fill(T.guess.line, { k: round.guess });
    $('pieces-put').disabled = !playing || Boolean(round.compare) || round.cells.length === 0;
    $('pieces-clear').disabled = !playing || Boolean(round.compare) || round.cells.length === 0;
    $('pieces-stop').hidden = !(playing && round.found.length > 0);
  }

  /** 찾은 조각의 줄: 찾은 차례대로 작은 그림과 차례 수. 묶어 보기를 켜면 가장 긴 줄의 칸 수로 묶는다 */
  function drawShelf(round) {
    const solution = solutionOf(round.board);
    const k = round.found.length;
    $('pieces-shelf-title').textContent = k === 0 ? '' : round.board.tell ? fill(T.shelf.told, { k, n: solution.total }) : fill(T.shelf.title, { k });
    const item = (piece, at) => {
      const box = document.createElement('div');
      box.className = round.compare && round.compare.at === at ? 'pc-shelf-item same' : 'pc-shelf-item';
      box.setAttribute('role', 'img');
      box.setAttribute('aria-label', fill(T.pieceLabel, { no: ordinal(at + 1) }));
      const inner = document.createElement('div');
      box.append(inner);
      drawMini(inner, piece.cells, { label: at + 1, row: round.sorted });
      return box;
    };
    if (!round.sorted) {
      $('pieces-shelf').replaceChildren(...round.found.map(item));
      return;
    }
    // 가장 긴 줄이 긴 묶음부터. 묶음 안에서는 찾은 차례대로
    const rows = [...new Set(round.found.map((piece) => longestRow(piece.cells)))].sort((a, b) => b - a);
    const nodes = rows.flatMap((row) => {
      const head = document.createElement('h3');
      head.className = 'pc-group';
      head.textContent = fill(T.shelf.group, { face: sizeWord(row) });
      return [head, ...round.found.map((piece, at) => (longestRow(piece.cells) === row ? item(piece, at) : null)).filter(Boolean)];
    });
    $('pieces-shelf').replaceChildren(...nodes);
  }

  // ---- 짐작한 수 ----
  function press(key) {
    const { round } = frame;
    if (!round || round.done || !needGuess(round)) return;
    if (key === 'erase') round.typed = round.typed.slice(0, -1);
    else if (/^\d$/.test(key) && round.typed.length < TYPE_LIMIT && !(key === '0' && round.typed === '')) round.typed += key;
    else return;
    round.moveCount += 1;
    draw();
    frame.persist();
  }

  function guessGo() {
    const { round } = frame;
    if (!round || round.done || !needGuess(round) || round.typed === '') return;
    round.guess = Number(round.typed);
    round.typed = '';
    frame.note('guess', { guess: round.guess });
    draw();
    frame.persist();
    frame.say(fill(T.play.guessed, { k: round.guess }));
  }

  // ---- 모눈 ----
  function tapCell(x, y) {
    const { round } = frame;
    if (!round || round.done || round.compare) return;
    if (needGuess(round)) {
      frame.say(T.play['guess-first']);
      return;
    }
    const key = cellKey([x, y]);
    const on = round.cells.some((cell) => cellKey(cell) === key);
    if (!on && round.cells.length >= round.board.n) {
      frame.say(fill(T.play.full, { k: round.board.n }));
      return;
    }
    round.cells = on ? round.cells.filter((cell) => cellKey(cell) !== key) : [...round.cells, [x, y]];
    round.moveCount += 1;
    frame.note('cell', { x, y, on: !on });
    draw();
    frame.persist();
  }

  function clearCells() {
    const { round } = frame;
    if (!round || round.done || round.compare || round.cells.length === 0) return;
    round.cells = [];
    round.moveCount += 1;
    frame.note('clear');
    draw();
    frame.persist();
  }

  /** "올려놓기": 놓은 칸을 살피고, 찾은 조각과 견준다 */
  function put() {
    const { round, solution } = frame;
    if (!round || round.done || round.compare || needGuess(round) || round.cells.length === 0) return;
    const { board } = round;
    const cells = round.cells.map((cell) => cell.slice());
    const check = checkPiece(cells, board);
    round.putCount += 1;
    frame.note('put', { cells, check });
    if (check === 'short') {
      round.shortCount += 1;
      frame.persist();
      frame.say(fill(T.play.short, { face: sizeWord(board.n), k: cells.length }));
      return;
    }
    if (check === 'apart') {
      round.apartCount += 1;
      frame.persist();
      frame.say(T.play.apart);
      return;
    }
    const free = keyOf(cells, 'free');
    if (!round.tries.includes(free)) round.tries = [...round.tries, free].slice(-MAX_TRIES);
    if (check === 'row') {
      round.rowCount += 1;
      frame.persist();
      frame.say(fill(T.play.row, { no: sizeWord(longestRow(cells)), face: sizeWord(board.row) }));
      return;
    }
    const match = compareWith(cells, round.found.map((piece) => piece.cells), board.rule);
    if (match && match.counted) {
      // 찾은 조각과 같다: 겹쳐 보이고 어떻게 겹치는지 말한다. 놓은 칸은 그대로 둔다(모눈으로 돌아가 고칠 수 있다)
      round.sameCount += 1;
      round.compare = { cells, at: match.at, turn: match.turn, how: match.how, counted: true };
      frame.note('same', { at: match.at, how: match.how });
      draw();
      frame.persist();
      frame.say(fill(T.play[match.how], { no: ordinal(match.at + 1) }));
      return;
    }
    // 처음 찾은 조각이다
    round.found = [...round.found, { key: keyOf(cells, board.rule), cells: normalize(cells) }];
    round.cells = [];
    round.answers.push({ t: frame.stamp(), answer: `piece:${round.found.length}`, correct: true, guess: null });
    frame.note('answer', { found: round.found.length, other: match ? match.how : null });
    if (match) round.compare = { cells, at: match.at, turn: match.turn, how: match.how, counted: false };
    if (round.found.length >= solution.total) {
      frame.finish('solved');
      return;
    }
    draw();
    frame.persist();
    const k = round.found.length;
    frame.say(match ? fill(T.play[`${match.how}-new`], { no: ordinal(match.at + 1), k }) : fill(T.play.found, { k }));
  }

  /** "모눈으로": 겹쳐 보는 그림을 닫고 모눈으로 돌아간다 */
  function back() {
    const { round } = frame;
    if (!round || round.done || !round.compare) return;
    round.compare = null;
    frame.note('back');
    draw();
    frame.persist();
  }

  /** 겹쳐 보는 그림을 한 번 더 움직였다(그림을 누르거나 "한 번 더 보기") */
  function replayed() {
    const { round } = frame;
    if (!round || !round.compare) return;
    round.replayCount += 1;
    frame.keep();
  }

  function again() {
    replayed();
    replayCompare($('pieces-board'));
  }

  /** "여기까지 할래요": 찾은 만큼으로 판을 끝낸다. 이것도 끝까지 한 판이다 */
  function stop() {
    const { round } = frame;
    if (!round || round.done || round.found.length === 0) return;
    round.stopped = true;
    frame.note('stop', { found: round.found.length });
    frame.finish('solved');
  }

  /** 왼쪽 칸의 도구: 찾은 조각을 가장 긴 줄로 묶어 늘어놓는다. 끝난 판에서도 된다 */
  function toggleSort() {
    const { round } = frame;
    if (!round) return;
    round.sorted = !round.sorted;
    if (round.sorted) round.sortCount += 1;
    frame.note('sort', { on: round.sorted });
    draw();
    frame.keep();
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    const { board } = round;
    const face = sizeWord(board.n);
    const parts = [];
    if (round.stopped) parts.push(fill(T.right.stopped, { face, k: round.found.length }));
    else if (board.row !== null) parts.push(fill(T.right.row, { no: sizeWord(board.row), face, k: solution.total }));
    else if (board.tell) parts.push(fill(T.right.told, { face, k: solution.total }));
    else parts.push(fill(T.right.guess, { face, k: solution.total }));
    if (round.guess !== null) parts.push(fill(T.right.guessed, { n: round.guess }));
    // 약속을 바꾼 판: 돌리고 뒤집어 같은 것을 하나로 치면 몇 가지인지 견주어 말한다(다 찾았을 때만)
    if (!round.stopped && board.rule !== 'free') parts.push(fill(T.right.free, { n: solution.free }));
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** "왜 그럴까?": 한 칸 작은 조각에 한 칸씩 빠짐없이 붙여 보는 이야기 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다
      get nodes() {
        return [rowOf(slide.figures.map((item) => pieceCard((root) => drawFigure(root, item.rows), item.note, { big: slide.figures.length === 1 })))];
      },
    }));
  }

  /** 풀이: 찾을 조각을 모두 그린다. 찾지 못한 조각에는 점선 테두리를 두른다 */
  function solutionPages(round, solution) {
    const { board } = round;
    const found = new Set(round.found.map((piece) => piece.key));
    const missed = solution.keys.map((key, at) => (found.has(key) ? -1 : at)).filter((at) => at >= 0);
    const face = sizeWord(board.n);
    const head = board.row !== null ? fill(T.solution.row, { no: sizeWord(board.row), face, n: solution.total }) : fill(T.solution.all, { face, n: solution.total });
    const say = missed.length > 0 ? `${head} ${T.solution.missed}` : head;
    const box = document.createElement('div');
    drawFamily(box, solution.pieces, { missed });
    return [{ say, nodes: [box.firstElementChild] }];
  }

  // ---- 직접 만들기: 칸 수와 같은 조각의 약속을 정한다 ----
  const draftOk = (saved) => saved && RULES.includes(saved.rule) && Number.isInteger(saved.n) && saved.n >= MIN_SIZE && saved.n <= MAX_SIZE[saved.rule];

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    if (draftOk(saved)) return { n: saved.n, rule: saved.rule };
    return { n: 4, rule: 'free' };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const board = madeBoard();
    const grid = gridOf(draft.n);
    $('pieces-make-n').textContent = fill(T.make.size, { face: sizeWord(draft.n) });
    $('pieces-make-fewer').disabled = draft.n <= MIN_SIZE;
    $('pieces-make-more').disabled = draft.n >= MAX_SIZE[draft.rule];
    $('pieces-make-limit').textContent = fill(T.make.limit, { face: sizeWord(MAX_SIZE[draft.rule]) });
    for (const button of $('pieces-make-rules').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.rule === draft.rule));
    $('pieces-make-result').textContent = made ? made.line : '';
    if (made) drawFamily($('pieces-make-board'), made.pieces);
    else {
      // 아직 세지 않았으면 그 크기의 모눈에 조각 하나를 놓아 보인다(누를 수는 없다)
      const sample = targetsOf(board);
      drawGrid($('pieces-make-board'), { ...grid, cells: placed(sample[Math.floor(sample.length / 2)], grid), onCell: null, label: fill(T.boardLabel.grid, { n: grid.w, no: grid.h }) });
    }
  }

  function changeDraft(next) {
    draft = { ...draft, ...next };
    draft.n = Math.min(Math.max(draft.n, MIN_SIZE), MAX_SIZE[draft.rule]);
    made = null;
    log.saveDraft({ n: draft.n, rule: draft.rule }, FORMAT);
    drawMake();
  }

  /** 선생님이 센다: 모두 몇 가지인지 말하고 모두 그린다 */
  function solveDraft() {
    const board = madeBoard();
    const solution = solve(board);
    const face = sizeWord(board.n);
    const parts = [fill(T.make.count, { face, k: solution.total })];
    if (board.rule !== 'free') parts.push(fill(T.make.free, { n: solution.free }));
    made = { line: parts.join(' '), pieces: solution.pieces };
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
      solution: { total: solution.total, free: solution.free },
    });
    log.flush();
    frame.talkers.make.say(made.line);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판). 정한 크기와 약속으로 늘 만들 수 있다. 먼저 짐작하는 판이다 */
  const madeBoard = () => (draft ? { n: draft.n, rule: draft.rule, row: null, tell: false } : null);

  function playDraft() {
    const board = madeBoard();
    if (board && checkBoard(board) === null) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
    else frame.talkers.make.say(T.make['keep-not-yet']);
  }

  // ---- 단추 잇기 ----
  $('pieces-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.n;
    if (key) press(key);
  });
  $('pieces-guess-go').addEventListener('click', guessGo);
  $('pieces-put').addEventListener('click', put);
  $('pieces-clear').addEventListener('click', clearCells);
  $('pieces-stop').addEventListener('click', stop);
  $('pieces-back').addEventListener('click', back);
  $('pieces-again').addEventListener('click', again);
  $('pieces-sort').addEventListener('click', toggleSort);
  $('pieces-make-fewer').addEventListener('click', () => changeDraft({ n: draft.n - 1 }));
  $('pieces-make-more').addEventListener('click', () => changeDraft({ n: draft.n + 1 }));
  $('pieces-make-rules').addEventListener('click', (event) => {
    const rule = event.target.closest('button')?.dataset.rule;
    if (rule && RULES.includes(rule)) changeDraft({ rule });
  });
  $('pieces-make-solve').addEventListener('click', solveDraft);
  $('pieces-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ board }) {
    return {
      mode: 'find', // 판의 종류는 하나다
      board: copyBoard(board),
      guess: null, // 짐작한 수(짐작하는 판)
      typed: '', // 숫자판으로 넣는 중인 수
      cells: [], // 지금 모눈에 놓은 칸
      found: [], // 찾은 조각 { key(판의 약속으로 같은 조각의 이름), cells }
      tries: [], // 올려놓아 본 조각의 이름(돌리고 뒤집어 같은 것은 한 번)
      compare: null, // 겹쳐 보는 중이면 { cells, at(겹치는 찾은 조각), turn(움직임), how, counted(같은 조각으로 치는가) }
      stopped: false, // "여기까지 할래요"로 끝냈는가
      sorted: false, // "가장 긴 줄로 묶어 보기"를 켰는가
      moveCount: 0, // 판에 손댄 수(칸 놓기, 지우기, 숫자)
      putCount: 0, // 올려놓기를 누른 수
      sameCount: 0, // 찾은 조각과 같은 조각을 올려놓은 수
      apartCount: 0, // 떨어진 칸으로 올려놓은 수
      shortCount: 0, // 칸이 모자란 채로 올려놓은 수
      rowCount: 0, // 가장 긴 줄이 다른 조각을 올려놓은 수
      sortCount: 0, // 묶어 보기를 켠 수
      replayCount: 0, // 겹쳐 보는 그림을 한 번 더 본 수
    };
  }

  const cellListOk = (cells) => Array.isArray(cells) && cells.every((cell) => Array.isArray(cell) && cell.length === 2 && cell.every(Number.isInteger));

  /** 놓을 칸들을 모눈 한가운데쯤에 옮긴다 */
  function placed(cells, grid) {
    const shape = normalize(cells);
    const w = Math.max(...shape.map((cell) => cell[0])) + 1;
    const h = Math.max(...shape.map((cell) => cell[1])) + 1;
    const ox = Math.floor((grid.w - w) / 2);
    const oy = Math.floor((grid.h - h) / 2);
    return shape.map(([x, y]) => [x + ox, y + oy]);
  }

  /** 작은 그림 하나: 판의 모눈에 조각 하나(가장 긴 줄이 정해진 판은 그 줄을 긋는다) */
  function drawSample(root, board) {
    const pieces = targetsOf(board);
    const grid = gridOf(board.n);
    drawMiniGrid(root, { ...grid, cells: placed(pieces[Math.floor(pieces.length / 2)], grid), row: board.row !== null });
  }

  return {
    id: FORMAT,
    T,
    padId: 'pieces-pad',
    makeId: 'make-pieces',
    homeIds: { sample: 'home-pieces-sample', blank: 'home-pieces-blank', ask: 'home-pieces-ask', play: 'home-pieces-play', pick: 'home-pieces-pick', make: 'home-pieces-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (saved.mode !== 'find' || checkBoard(saved.board) !== null) return false;
      const { board } = saved;
      const grid = gridOf(board.n);
      if (!(saved.guess === null || count(saved.guess)) || typeof saved.typed !== 'string' || !/^\d{0,2}$/.test(saved.typed)) return false;
      if (!cellListOk(saved.cells) || saved.cells.length > board.n || !saved.cells.every(([x, y]) => x >= 0 && y >= 0 && x < grid.w && y < grid.h)) return false;
      if (!Array.isArray(saved.found) || !saved.found.every((item) => item && typeof item.key === 'string' && cellListOk(item.cells) && item.cells.length === board.n)) return false;
      if (!Array.isArray(saved.tries) || !saved.tries.every((item) => typeof item === 'string')) return false;
      if (saved.compare !== null) {
        const { compare } = saved;
        if (!compare || !cellListOk(compare.cells) || !Number.isInteger(compare.at) || compare.at < 0 || compare.at >= saved.found.length || !Number.isInteger(compare.turn) || compare.turn < 0 || compare.turn > 7) return false;
      }
      if (typeof saved.stopped !== 'boolean' || typeof saved.sorted !== 'boolean') return false;
      return [saved.moveCount, saved.putCount, saved.sameCount, saved.apartCount, saved.shortCount, saved.rowCount, saved.sortCount, saved.replayCount].every(count);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글과 단추, 왼쪽 칸의 도구)을 보이거나 감춘다. 무르기와 되돌리기는 없다 */
    showParts(on) {
      $('pieces-board').hidden = !on;
      $('pieces-count').hidden = !on;
      $('pieces-sort').hidden = !on;
      if (!on) {
        $('pieces-again').hidden = true;
        $('pieces-back').hidden = true;
      }
      if (on) {
        $('undo').hidden = true;
        $('reset').hidden = true;
      }
    },
    enter() {},
    draw,
    ended() {},
    ruleLine(round) {
      const { board } = round;
      const face = sizeWord(board.n);
      const kind = kindOf(board);
      if (kind === 'row') return fill(T.rules.row, { no: sizeWord(board.row), face, total: solutionOf(board).total });
      if (kind === 'told') return fill(T.rules.told, { face, total: solutionOf(board).total });
      return fill(T.rules[kind], { face });
    },
    hints: (round) => T.hints[kindOf(round.board)],
    touched: (round) => round.moveCount > 0 || round.putCount > 0 || round.answers.length > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      return { guess: round.guess, cells: round.cells.length, found: round.found.length, compare: round.compare !== null, sorted: round.sorted };
    },
    /** 이 판보다 작은 판: 같은 약속(같은 줄)으로 칸이 하나, 둘 적은 조각 */
    smaller: (round, turn) => smallerPieces({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const missing = solution.total - round.found.length;
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: true, total: solution.total, free: solution.free },
        // 짐작한 수(짐작하는 판), 찾은 조각(차례대로), 판을 떠날 때 놓은 칸, 올려놓아 본 조각의 수(돌리고 뒤집어 같은 것은 한 번)
        guess: round.guess,
        found: round.found.map((item) => item.cells),
        cells: round.cells,
        tries: round.tries.length,
        reachedBest: missing === 0,
        stopped: round.stopped === true,
        sorted: round.sorted,
        moveCount: round.moveCount,
        putCount: round.putCount,
        sameCount: round.sameCount,
        apartCount: round.apartCount,
        shortCount: round.shortCount,
        rowCount: round.rowCount,
        sortCount: round.sortCount,
        replayCount: round.replayCount,
        // 수준 맞추기가 보는 "틀린 답"의 수: "여기까지 할래요"로 끝냈을 때 찾지 못한 조각의 수(다 찾았으면 0)
        wrongCount: round.stopped ? missing : 0,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo() {},
    reset() {},
    /** 글자판이 있는 기기: 짐작한 수의 숫자와 지우기, 들이기 */
    onKey(event) {
      const { round } = frame;
      if (!round || $('pieces-pad').hidden || !needGuess(round)) return;
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') press('erase');
      else if (event.key === 'Enter' && !event.target.closest?.('button')) guessGo();
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[String(level)],
    pickLine: () => T.home.pick,
    drawSample,
    drawBlank(root) {
      drawMiniGrid(root, { ...T.blank });
    },
    /** 하던 판과 공책의 그림: 찾은 조각이 있으면 마지막에 찾은 넷까지, 없으면 놓은 칸이 있는 모눈, 그것도 없으면 판의 그림 */
    drawResume(root, saved) {
      if (saved.found?.length > 0) drawStrip(root, saved.found.slice(-4).map((item) => item.cells));
      else if (saved.cells?.length > 0) drawMiniGrid(root, { ...gridOf(saved.board.n), cells: saved.cells });
      else drawSample(root, saved.board);
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawMiniGrid(root, { ...T.blank });
        return;
      }
      drawSample(root, generateBoard(entry.level, entry.picture.seed).board);
    },
    showMake,
    /** 직접 만들기에서 정한 판(칸 수와 약속). 공책에 남기기가 쓴다 */
    madeBoard,
    /** 가장 좋은 기록: 찾은 조각의 수. 많을수록 좋다 */
    bestOf: (round) => (round.found.length === 0 ? null : { value: round.found.length, name: fill(T.notebook.best, { face: sizeWord(round.board.n), k: round.found.length }) }),
  };
}
