// 자르고 붙이기: 판 화면에서 이 형식이 맡는 부분(판, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/cutpaste.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)는 판이 정한다(5단계는 판 번호마다 바뀐다).
//   move    잘라 옮겨 네모: 가위로 조각 위의 칸 사이 선을 누르면 그 줄을 따라 조각이 끝까지 잘린다(cuts번까지).
//           손으로 조각을 끌면 옮겨지고, 누르면 4분의 1 바퀴 돈다. 조각들이 겹치지 않고 빈틈없는 네모가 되면 저절로 끝난다.
//           두 번 자르는 판에는 "불가능해요"가 있다(안 되는 판이 섞인다)
//   shadow  가짜 그림자: 왼쪽의 일곱 조각을 끌어 그림자에 놓는다. 그림자를 꼭 채우면 끝나고, 채울 수 없으면 "불가능해요"
//   share   가장 적게 잘라 나누기: 막대 위의 세모를 눌러 자르고, 사람을 골라 조각을 눌러 나눠 준다. 모두 똑같이 받으면
//           조각 수를 말하고, 가장 적으면 저절로 끝나고 아니면 더 줄일 수 있을지 묻는다. "여기까지 할래요"로 끝내도 된다
// 넓이를 구하는 식은 말하지 않는다. 칸 수가 그대로라는 사실만 말한다(처음 도형도 네모도 몇 칸, 조각도 그림자도 몇 칸).
// 되는 판에 "불가능해요"를 누르면 틀렸다고 하지 않는다. 방법이 있다는 사실만 말하고 판은 그대로 이어진다.
import T from '../content/cutpaste.json';
import { smallerCutpaste } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, moveBoard, nextSeed, rows, rungOf, shadowBoard } from '../core/cutpaste-ladder.js';
import {
  KINDS,
  MAX_BARS,
  MAX_PEOPLE,
  MIN_BARS,
  MIN_PEOPLE,
  PIECES,
  SEVEN,
  boxOf,
  checkBoard,
  copyBoard,
  cutPiece,
  fillRegion,
  keepOwners,
  movePiece,
  noCuts,
  overlapOf,
  rectDone,
  setArea,
  shadowDone,
  sharePieces,
  shareDone,
  solve,
  solveMove,
  startPieces,
  toggleCut,
  trayOf,
  turnPiece,
} from '../core/cutpaste.js';
import { cutCard, drawPieces, drawShare } from '../ui/cutpaste-board.js';

const FORMAT = 'cutpaste';
/** 기록에 남기는 무르기 차례와 나눠 본 나누기의 수의 위 끝 */
const MAX_MOVES = 300;
const MAX_TRIES = 200;
const FIRST_DRAFT = { m: 2, n: 3 };

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createCutpaste(frame) {
  const { $, log } = frame;
  let flash = null; // 방금 누른 것에 대한 한 줄(판 아래). 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 만들던 판 { m, n }
  let made = null; // 직접 만들기에서 선생님이 나눈 결과(판이 바뀌면 지운다)

  const count = (value) => Number.isInteger(value) && value >= 0;
  const isPieces = (round) => round.mode === 'move' || round.mode === 'shadow';
  /** "불가능해요"가 있는 판: 가짜 그림자와 두 번 이상 자르는 판 */
  const hasImpossible = (round) => round.mode === 'shadow' || (round.mode === 'move' && round.board.cuts >= 2);

  /** 한 번 푼 판은 적어 둔다 */
  const memo = new Map();
  function solutionOf(board) {
    const key = JSON.stringify(copyBoard(board));
    if (!memo.has(key)) memo.set(key, solve(board));
    return memo.get(key);
  }

  const pieceLabel = (pieces) => (index) => fill(T.pieceLabel, { n: pieces[index].cells.length });
  /** 나누기 판의 조각들(받은 사람까지) */
  const loaves = (board, cuts, owners) => sharePieces(board, cuts).map((piece) => ({ ...piece, who: Number.isInteger(owners[piece.key]) ? owners[piece.key] : -1 }));
  const shareView = (board, cuts, owners, more = {}) => ({ m: board.m, n: board.n, cuts, pieces: loaves(board, cuts, owners), names: T.people, ...more });

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const playing = !round.done;
    $('cutpaste-move-box').hidden = round.mode !== 'move';
    $('cutpaste-shadow-box').hidden = round.mode !== 'shadow';
    $('cutpaste-share-box').hidden = round.mode !== 'share';
    $('cutpaste-maybe').hidden = !hasImpossible(round);
    $('cutpaste-impossible').disabled = !playing;
    $('cutpaste-numbers').hidden = round.mode !== 'share';
    $('cutpaste-tally').hidden = !isPieces(round);
    $('cutpaste-tally').setAttribute('aria-pressed', String(round.numbers));
    $('cutpaste-tally').disabled = !playing;
    let status = '';
    if (isPieces(round)) status = drawPieceBoard(round, playing);
    else status = drawShareBoard(round, playing);
    $('cutpaste-status').textContent = flash ?? status;
    $('undo').disabled = !playing || round.moves.length === 0;
    $('reset').disabled = !playing || round.moves.length === 0;
    frame.showWhy();
  }

  function drawPieceBoard(round, playing) {
    const { board } = round;
    const move = round.mode === 'move';
    for (const button of $('cutpaste-tools').querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.tool === round.tool));
      button.disabled = !playing;
    }
    drawPieces($('cutpaste-board'), {
      w: board.w,
      h: board.h,
      shadow: move ? null : board.shadow,
      pieces: round.pieces,
      numbers: round.numbers,
      mode: playing ? (move ? round.tool : 'move') : null,
      onCut: tapCut,
      onMove: movePieceBy,
      onTurn: turnPieceAt,
      onMiss: miss,
      pieceLabel: pieceLabel(round.pieces),
      boardLabel: T.boardLabel,
    });
    if (!playing) return '';
    if (overlapOf(round.pieces).length > 0) return T.status.overlap;
    if (move) {
      if (round.tool === 'move') return T.status.hand;
      const left = board.cuts - round.used;
      return left > 0 ? fill(T.status.cut, { n: left }) : T.status['cut-none'];
    }
    const shadow = new Set(board.shadow.map(String));
    const inside = round.pieces.every((piece) => piece.cells.every((cell) => shadow.has(String(cell))));
    if (inside) return fill(T.status['shadow-left'], { n: board.shadow.length - setArea(board.set) });
    return T.status.shadow;
  }

  function drawShareBoard(round, playing) {
    const { board } = round;
    drawShare($('cutpaste-board'), {
      ...shareView(board, round.cuts, round.owners),
      selected: playing ? round.selected : -1,
      onTick: playing ? tapTick : undefined,
      onPiece: tapLoaf,
      onPlate: takeBack,
      onMiss: miss,
      tickLabel: (bar, at, cut) => fill(T.tickLabel, { no: ordinal(bar + 1), n: ordinal(at), face: T.ticks[cut ? 'on' : 'off'] }),
      pieceLabel: (piece) => fill(T.loafLabel, { no: ordinal(piece.bar + 1), n: piece.len, face: piece.who >= 0 ? T.people[piece.who] : T.nobody }),
    });
    drawPeople(round, playing);
    const pieces = sharePieces(board, round.cuts);
    $('cutpaste-pieces').textContent = String(pieces.length);
    $('cutpaste-best-line').hidden = round.best === null;
    $('cutpaste-best').textContent = round.best === null ? '' : String(round.best);
    $('cutpaste-stop').hidden = !(playing && round.best !== null);
    if (!playing) return '';
    const left = pieces.filter((piece) => !Number.isInteger(round.owners[piece.key])).length;
    if (round.cuts.every((spots) => spots.length === 0) && Object.keys(round.owners).length === 0) return T.status['share-start'];
    if (left > 0) return fill(T.status['share-left'], { n: left });
    return shareDone(board, round.cuts, round.owners) ? T.status['share-done'] : T.status['share-uneven'];
  }

  /** 나눠 줄 사람 단추(이름은 대본에서) */
  function drawPeople(round, playing) {
    const box = $('cutpaste-people');
    const buttons = T.people.slice(0, round.board.n).map((name, who) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `btn cp-person-pick cp-p${who}`;
      button.dataset.who = String(who);
      button.textContent = name;
      button.setAttribute('aria-pressed', String(who === round.selected));
      button.disabled = !playing;
      return button;
    });
    box.replaceChildren(...buttons);
  }

  // ---- 조각 판: 자르기, 옮기기, 돌리기 ----
  /** 판이 바뀌었다. 무르기에 남기고, 다 되었는지 본다 */
  function changePieces(next, used, kind, data = {}) {
    const { round } = frame;
    round.moves = [...round.moves, { pieces: round.pieces, used: round.used }].slice(-MAX_MOVES);
    round.pieces = next;
    round.used = used;
    flash = null;
    frame.note(kind, data);
    const done = round.mode === 'move' ? rectDone(next) : shadowDone(round.board, next);
    if (done) {
      round.answers.push({ t: frame.stamp(), answer: round.mode === 'move' ? `rect:${round.used}` : 'filled', correct: true, guess: null });
      frame.note('answer', { answer: round.mode === 'move' ? 'rect' : 'filled', correct: true });
      frame.finish('solved');
      return;
    }
    draw();
    frame.persist();
  }

  function tapCut(index, line) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'move') return;
    if (round.used >= round.board.cuts) {
      flash = fill(T.status.full, { n: round.board.cuts });
      draw();
      frame.say(fill(T.play.full, { n: round.board.cuts }));
      return;
    }
    const next = cutPiece(round.pieces, index, line);
    if (!next) return miss();
    round.cutCount += 1;
    const used = round.used + 1;
    // 다 잘랐으면 손으로 바꾼다(옮길 차례다)
    if (used >= round.board.cuts) round.tool = 'move';
    changePieces(next, used, 'cut', { d: line.d, at: line.at, pieces: next.length });
  }

  function movePieceBy(index, dx, dy) {
    const { round } = frame;
    if (!round || round.done || !isPieces(round)) return;
    const next = movePiece(round.board, round.pieces, index, dx, dy);
    if (JSON.stringify(next.at(-1).cells) === JSON.stringify(round.pieces[index].cells)) {
      // 제자리에 놓았다: 맨 위로 올린 것만 남긴다
      round.pieces = next;
      draw();
      return;
    }
    round.moveCount += 1;
    changePieces(next, round.used, 'move', { dx, dy });
  }

  function turnPieceAt(index) {
    const { round } = frame;
    if (!round || round.done || !isPieces(round)) return;
    const next = turnPiece(round.board, round.pieces, index);
    // 돌려도 같은 자리를 덮는 조각(한 칸, 네모 네 칸)은 맨 위로 올린 것만 남긴다
    if (JSON.stringify(next.at(-1).cells) === JSON.stringify(round.pieces[index].cells)) {
      round.pieces = next;
      draw();
      return;
    }
    round.turnCount += 1;
    changePieces(next, round.used, 'turn');
  }

  /** 조각이 아닌 곳이나 선에서 먼 곳을 눌렀다 */
  function miss() {
    const { round } = frame;
    if (!round || round.done) return;
    round.missCount += 1;
    if (round.mode === 'move' && round.tool === 'cut' && round.used < round.board.cuts) {
      flash = T.status.miss;
      draw();
    }
  }

  function setTool(tool) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'move' || !['cut', 'move'].includes(tool) || round.tool === tool) return;
    round.tool = tool;
    flash = null;
    frame.note('tool', { tool });
    draw();
    frame.persist();
  }

  /** "칸 수 적어 보기": 조각마다(그림자도) 칸 수를 적었다 지운다. 무엇을 알려 주는지는 말하지 않는다 */
  function toggleNumbers() {
    const { round } = frame;
    if (!round || round.done || !isPieces(round)) return;
    round.numbers = !round.numbers;
    if (round.numbers) round.numbersCount += 1;
    frame.note('numbers', { on: round.numbers });
    draw();
    frame.persist();
  }

  // ---- 나누기: 자르기와 나눠 주기 ----
  function changeShare(cuts, owners, kind, data = {}) {
    const { round } = frame;
    round.moves = [...round.moves, { cuts: round.cuts, owners: round.owners }].slice(-MAX_MOVES);
    round.cuts = cuts;
    round.owners = keepOwners(round.board, cuts, owners);
    flash = null;
    frame.note(kind, { ...data, pieces: sharePieces(round.board, cuts).length });
    if (shareDone(round.board, round.cuts, round.owners)) {
      complete();
      return;
    }
    draw();
    frame.persist();
  }

  function tapTick(bar, at) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'share') return;
    const cuts = toggleCut(round.board, round.cuts, bar, at);
    if (JSON.stringify(cuts) === JSON.stringify(round.cuts)) return;
    round.tickCount += 1;
    changeShare(cuts, round.owners, 'tick', { bar, at });
  }

  /** 막대의 조각을 눌렀다: 고른 사람에게 준다. 이미 그 사람의 조각이면 돌려받는다 */
  function tapLoaf(bar, unit) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'share') return;
    const piece = sharePieces(round.board, round.cuts).find((item) => item.bar === bar && unit >= item.start && unit < item.end);
    if (!piece) return;
    const owners = { ...round.owners };
    if (owners[piece.key] === round.selected) delete owners[piece.key];
    else owners[piece.key] = round.selected;
    round.giveCount += 1;
    changeShare(round.cuts, owners, 'give', { piece: piece.key, who: owners[piece.key] ?? null });
  }

  /** 접시의 조각을 눌렀다: 돌려받는다 */
  function takeBack(who, key) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'share' || round.owners[key] !== who) return;
    const owners = { ...round.owners };
    delete owners[key];
    round.giveCount += 1;
    changeShare(round.cuts, owners, 'give', { piece: key, who: null });
  }

  function choosePerson(who) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'share' || !Number.isInteger(who) || who < 0 || who >= round.board.n) return;
    round.selected = who;
    flash = null;
    draw();
    frame.persist();
  }

  /** 모두 똑같이 받았다: 조각 수를 말하고, 가장 적은 것이 아니면 더 줄일 수 있을지 묻는다 */
  function complete() {
    const { round, solution } = frame;
    const pieces = sharePieces(round.board, round.cuts).length;
    const key = JSON.stringify(round.cuts);
    const fresh = !round.tries.includes(key);
    const before = round.best;
    if (fresh) {
      round.tries = [...round.tries, key].slice(-MAX_TRIES);
      round.completions.push(pieces);
    }
    if (before === null || pieces < before) round.best = pieces;
    const reached = pieces === solution.best;
    if (fresh) {
      const guess = reached ? null : 'more-than-best';
      round.answers.push({ t: frame.stamp(), answer: `share:${pieces}`, correct: reached, guess });
      frame.note('answer', { answer: pieces, correct: reached, guess });
      if (!reached) round.wrongCount += 1;
    }
    if (reached) {
      frame.finish('solved');
      return;
    }
    draw();
    frame.persist();
    if (!fresh) {
      frame.say(T.play['share-again']);
      return;
    }
    frame.say(fill(before !== null && pieces < before ? T.play['share-down'] : T.play['share-all'], { k: pieces }));
  }

  /** "여기까지 할래요": 지금까지 가장 적은 조각으로 판을 끝낸다. 이것도 끝까지 한 판이다 */
  function stop() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'share' || round.best === null) return;
    round.stopped = true;
    frame.note('stop', { best: round.best });
    frame.finish('solved');
  }

  // ---- "불가능해요" ----
  function pressImpossible() {
    const { round, solution } = frame;
    if (!round || round.done || !hasImpossible(round)) return;
    flash = null;
    const correct = solution.possible === false;
    const guess = correct ? null : 'impossible-on-possible';
    round.answers.push({ t: frame.stamp(), answer: 'impossible', correct, guess });
    frame.note('answer', { answer: 'impossible', correct, guess });
    if (correct) {
      frame.finish('solved');
      return;
    }
    // 되는 판이다. 틀렸다고 하지 않고 사실만 말한다. 판은 그대로 이어진다.
    round.impossibleCount += 1;
    round.wrongCount += 1;
    frame.persist();
    draw();
    if (round.mode === 'move') frame.say(fill(T.play['possible-move'], { n: round.board.cuts }));
    else frame.say(round.board.set.length === SEVEN.length ? T.play['possible-shadow'] : T.play['possible-shadow-few']);
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    const last = round.moves.at(-1);
    round.moves = round.moves.slice(0, -1);
    if (round.mode === 'share') {
      round.cuts = last.cuts;
      round.owners = last.owners;
    } else {
      round.pieces = last.pieces;
      round.used = last.used;
      if (round.mode === 'move' && round.used < round.board.cuts && round.tool === 'move' && round.pieces.length === 1) round.tool = 'cut';
    }
    round.undoCount += 1;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
  }

  /** 처음으로: 판을 처음 모습으로 되돌린다. 되돌린 것도 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    if (round.mode === 'share') {
      round.moves = [...round.moves, { cuts: round.cuts, owners: round.owners }].slice(-MAX_MOVES);
      round.cuts = noCuts(round.board);
      round.owners = {};
    } else {
      round.moves = [...round.moves, { pieces: round.pieces, used: round.used }].slice(-MAX_MOVES);
      round.pieces = startPieces(round.board);
      round.used = 0;
      if (round.mode === 'move') round.tool = 'cut';
    }
    round.resetCount += 1;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    const { board } = round;
    const last = round.answers.at(-1);
    if (round.mode === 'share') {
      if (round.stopped) return [fill(T.right['share-stopped'], { k: round.best })];
      const tries = round.completions.length;
      return [fill(T.right['share-best'], { k: solution.best, n: board.m, no: board.n }), tries <= 1 ? T.right['share-first'] : fill(T.right['share-tries'], { f: tries })];
    }
    if (last?.answer === 'impossible') {
      if (round.mode === 'shadow') return [fill(T.right['impossible-area'], { k: solution.area, n: solution.shadowArea })];
      if (solution.reason === 'line') return [fill(T.right['impossible-line'], { k: solution.area, n: board.cuts })];
      return [fill(T.right['impossible-search'], { k: solution.tried, n: board.cuts })];
    }
    const parts = [round.mode === 'move' ? fill(T.right.move, { n: board.cells.length }) : fill(T.right.shadow, { n: board.shadow.length })];
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

  /** 칸들만 담을 만한 작은 판(둘레에 한 칸씩) */
  const tightView = (cells, more) => {
    const box = boxOf(cells);
    const shift = (list) => list.map(([x, y]) => [x - box.x + 1, y - box.y + 1]);
    return { w: box.w + 2, h: box.h + 2, shift, ...more };
  };

  /** 잘라 옮겨 네모의 두 그림: 자른 모습(조각마다 색)과 네모로 옮긴 모습 */
  function moveCards(board, solution, numbers = false, notes = ['', '']) {
    const before = tightView(board.cells);
    const cut = cutCard((root) => drawPieces(root, { w: before.w, h: before.h, pieces: solution.pieces.map((cells, index) => ({ cells: before.shift(cells), color: index })), numbers, small: true }), notes[0]);
    const [rw, rh] = solution.size;
    const rect = cutCard(
      (root) => drawPieces(root, { w: rw + 2, h: rh + 2, pieces: solution.fill.map((item) => ({ cells: item.cells.map(([x, y]) => [x + 1, y + 1]), color: item.index })), numbers, frame: { x: 1, y: 1, w: rw, h: rh }, small: true }),
      notes[1],
    );
    return [cut, rect];
  }

  /** 그림자의 그림: 채운 모습(fill), 또는 왼쪽 자리의 조각들(tray)과 함께 */
  function shadowPicture(board, { fillCells = null, tray = false, numbers = false } = {}) {
    if (tray) return (root) => drawPieces(root, { w: board.w, h: board.h, shadow: board.shadow, pieces: trayOf(board.set), numbers, small: true });
    const view = tightView(board.shadow);
    const pieces = fillCells ? fillCells.map((item) => ({ cells: view.shift(item.cells), color: item.index })) : [];
    return (root) => drawPieces(root, { w: view.w, h: view.h, shadow: view.shift(board.shadow), pieces, numbers, small: true });
  }

  /** "왜 그럴까?"의 그림 하나 */
  function figureCard(item, big) {
    if (item.kind === 'move') {
      const board = moveBoard(rows(item.rows), item.cuts);
      const cards = moveCards(board, solveMove(board), item.numbers);
      const card = item.show === 'cut' ? cards[0] : cards[1];
      if (item.note) {
        const line = document.createElement('p');
        line.className = 'strip-note';
        line.textContent = item.note;
        card.append(line);
      }
      return card;
    }
    const board = shadowBoard(SEVEN, rows(item.rows));
    const fillCells = item.fill ? fillRegion(shadowBoard(SEVEN, rows(item.fill)).shadow, SEVEN.map((type) => PIECES[type])).fill : null;
    return cutCard(shadowPicture(board, { fillCells, tray: item.tray, numbers: item.numbers }), item.note, { big });
  }

  /** "왜 그럴까?": 칸 수 이야기. 나누기 판에는 없다 */
  function whyPages(round) {
    if (round.mode === 'share') return null;
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [rowOf(slide.figures.map((item) => figureCard(item, slide.figures.length === 1)))];
      },
    }));
  }

  /** 풀이: 네모는 자른 모습과 옮긴 모습(안 되면 까닭), 그림자는 채운 모습(안 되면 칸 수), 나누기는 가장 적은 나누기 */
  function solutionPages(round, solution) {
    const { board } = round;
    if (round.mode === 'move') {
      if (solution.possible) return [{ say: fill(T.solution.move, { n: solution.min }), nodes: [rowOf(moveCards(board, solution, false, [T.solution['cut-note'], T.solution['rect-note']]))] }];
      const view = tightView(board.cells);
      const say = solution.reason === 'line' ? fill(T.solution['move-line'], { k: solution.area, n: board.cuts }) : fill(T.solution['move-search'], { k: solution.tried, n: board.cuts });
      return [{ say, nodes: [rowOf([cutCard((root) => drawPieces(root, { w: view.w, h: view.h, pieces: [{ cells: view.shift(board.cells), color: 0 }], numbers: true, small: true }), '', { big: true })])] }];
    }
    if (round.mode === 'shadow') {
      if (solution.possible) return [{ say: T.solution.shadow, nodes: [rowOf([cutCard(shadowPicture(board, { fillCells: solution.fill }), '', { big: true })])] }];
      const say = solution.reason === 'area' ? fill(T.solution['shadow-area'], { k: solution.area, n: solution.shadowArea }) : fill(T.solution['shadow-search'], { k: solution.area });
      return [{ say, nodes: [rowOf([cutCard(shadowPicture(board, { tray: true, numbers: true }), '', { big: true })])] }];
    }
    const { cuts, owners } = solution.line;
    return [{ say: fill(T.solution.share, { k: solution.best, n: board.m }), nodes: [rowOf([cutCard((root) => drawShare(root, { ...shareView(board, cuts, owners), small: true }), '', { big: true })])] }];
  }

  // ---- 직접 만들기: 빵의 수와 사람의 수를 정한다 ----
  const draftBoard = () => ({ kind: 'share', m: draft.m, n: draft.n });
  const draftReady = () => draft && checkBoard(draftBoard()) === null;

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    if (saved && checkBoard({ kind: 'share', m: saved.m, n: saved.n }) === null) return { m: saved.m, n: saved.n };
    return { ...FIRST_DRAFT };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    $('cutpaste-make-m').textContent = fill(T.make.loaves, { n: draft.m });
    $('cutpaste-make-n').textContent = fill(T.make.people, { n: draft.n });
    $('cutpaste-make-m-fewer').disabled = draft.m <= MIN_BARS;
    $('cutpaste-make-m-more').disabled = draft.m >= MAX_BARS;
    $('cutpaste-make-n-fewer').disabled = draft.n <= MIN_PEOPLE;
    $('cutpaste-make-n-more').disabled = draft.n >= MAX_PEOPLE;
    const board = draftBoard();
    const shown = made ? made.plan : { cuts: noCuts(board), owners: {} };
    drawShare($('cutpaste-make-board'), { ...shareView(board, shown.cuts, shown.owners) });
    $('cutpaste-make-solve').disabled = !draftReady();
    $('cutpaste-make-play').disabled = !draftReady();
    $('cutpaste-make-result').textContent = made ? made.line : '';
  }

  function changeDraft(next) {
    draft = next;
    made = null;
    log.saveDraft({ m: draft.m, n: draft.n }, FORMAT);
    drawMake();
  }

  /** 선생님이 나눈다: 가장 적은 조각 수(모두 따져서 구한 것)와, 빵을 한 줄로 이어 놓고 끊는 나누기 */
  function solveDraft() {
    if (!draftReady()) {
      frame.talkers.make.say(T.make['keep-not-yet']);
      return;
    }
    const board = draftBoard();
    const result = solve(board);
    const cutsNeeded = result.best - board.m;
    const line = cutsNeeded === 0 ? fill(T.make['result-whole'], { n: board.m, no: board.n }) : fill(T.make.result, { n: board.m, no: board.n, k: result.best, f: cutsNeeded });
    made = { line, plan: result.line };
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
      solution: { best: result.best },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판). 빵과 사람의 수가 맞으면 늘 있다 */
  const madeBoard = () => (draftReady() ? draftBoard() : null);

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
    else frame.talkers.make.say(T.make['keep-not-yet']);
  }

  // ---- 단추 잇기 ----
  $('cutpaste-impossible').addEventListener('click', pressImpossible);
  $('cutpaste-stop').addEventListener('click', stop);
  $('cutpaste-tally').addEventListener('click', toggleNumbers);
  $('cutpaste-tools').addEventListener('click', (event) => {
    const tool = event.target.closest('button')?.dataset.tool;
    if (tool) setTool(tool);
  });
  $('cutpaste-people').addEventListener('click', (event) => {
    const who = event.target.closest('button')?.dataset.who;
    if (who !== undefined) choosePerson(Number(who));
  });
  $('cutpaste-make-m-fewer').addEventListener('click', () => draft.m > MIN_BARS && changeDraft({ ...draft, m: draft.m - 1 }));
  $('cutpaste-make-m-more').addEventListener('click', () => draft.m < MAX_BARS && changeDraft({ ...draft, m: draft.m + 1 }));
  $('cutpaste-make-n-fewer').addEventListener('click', () => draft.n > MIN_PEOPLE && changeDraft({ ...draft, n: draft.n - 1 }));
  $('cutpaste-make-n-more').addEventListener('click', () => draft.n < MAX_PEOPLE && changeDraft({ ...draft, n: draft.n + 1 }));
  $('cutpaste-make-solve').addEventListener('click', solveDraft);
  $('cutpaste-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ board }) {
    const start = copyBoard(board);
    return {
      mode: start.kind, // 판의 종류: move | shadow | share
      board: start,
      pieces: startPieces(start), // 네모·그림자: 조각들 { cells(판 위의 자리), type(그림자의 조각 종류), color }. 뒤의 것이 위에 놓인다
      used: 0, // 네모: 지금 모습까지 자른 수
      tool: start.kind === 'move' ? 'cut' : 'move', // 네모: 가위(cut)인가 손(move)인가
      numbers: false, // 네모·그림자: 칸 수를 적어 보이는가
      cuts: start.kind === 'share' ? noCuts(start) : [], // 나누기: 빵마다 자른 자리들
      owners: {}, // 나누기: 조각 이름 → 받은 사람 번호
      selected: 0, // 나누기: 지금 고른 사람
      moves: [], // 무르기에 쓰는 차례: 네모·그림자 { pieces, used }, 나누기 { cuts, owners }
      tries: [], // 나누기: 똑같이 나눴던 자르기들(같은 자르기는 한 번)
      completions: [], // 나누기: 똑같이 나눌 때마다의 조각 수
      best: null, // 나누기: 이 판에서 지금까지 가장 적은 조각 수
      stopped: false, // 나누기: "여기까지 할래요"로 끝냈는가
      cutCount: 0, // 네모: 자른 수(무른 것까지)
      moveCount: 0, // 조각을 옮긴 수
      turnCount: 0, // 조각을 돌린 수
      tickCount: 0, // 나누기: 세모를 누른 수
      giveCount: 0, // 나누기: 조각을 주거나 돌려받은 수
      missCount: 0, // 조각이 아닌 곳이나 선에서 먼 곳을 누른 수
      numbersCount: 0, // "칸 수 적어 보기"를 켠 수
      undoCount: 0,
      resetCount: 0,
      impossibleCount: 0, // 되는 판에 "불가능해요"를 누른 수
      wrongCount: 0, // 사실과 다른 답의 수(되는 판의 "불가능해요", 가장 적지 않은 나누기를 처음 해 본 것)
    };
  }

  const cellsOk = (cells, board) => Array.isArray(cells) && cells.length > 0 && cells.every((cell) => Array.isArray(cell) && cell.length === 2 && cell.every(Number.isInteger) && cell[0] >= 0 && cell[1] >= 0 && cell[0] < board.w && cell[1] < board.h);
  function piecesOk(pieces, board) {
    if (!Array.isArray(pieces) || !pieces.every((piece) => piece && cellsOk(piece.cells, board) && count(piece.color))) return false;
    const total = pieces.reduce((sum, piece) => sum + piece.cells.length, 0);
    return board.kind === 'move' ? total === board.cells.length : total === setArea(board.set) && pieces.length === board.set.length;
  }
  function shareOk(cuts, owners, board) {
    if (!Array.isArray(cuts) || cuts.length !== board.m || !cuts.every((spots) => Array.isArray(spots) && spots.every((at) => Number.isInteger(at) && at >= 1 && at < board.n) && new Set(spots).size === spots.length)) return false;
    return Boolean(owners) && typeof owners === 'object' && Object.values(owners).every((who) => Number.isInteger(who) && who >= 0 && who < board.n);
  }

  return {
    id: FORMAT,
    T,
    padId: 'cutpaste-pad',
    makeId: 'make-cutpaste',
    homeIds: { sample: 'home-cutpaste-sample', blank: 'home-cutpaste-blank', ask: 'home-cutpaste-ask', play: 'home-cutpaste-play', pick: 'home-cutpaste-pick', make: 'home-cutpaste-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!KINDS.includes(saved.mode) || checkBoard(saved.board) !== null || saved.board.kind !== saved.mode) return false;
      const { board } = saved;
      if (board.kind === 'share') {
        if (!shareOk(saved.cuts, saved.owners, board) || !Number.isInteger(saved.selected) || saved.selected < 0 || saved.selected >= board.n) return false;
        if (!Array.isArray(saved.moves) || !saved.moves.every((move) => shareOk(move?.cuts, move?.owners, board))) return false;
      } else {
        if (!piecesOk(saved.pieces, board) || !count(saved.used) || saved.used > (board.cuts ?? 0) || !['cut', 'move'].includes(saved.tool)) return false;
        if (!Array.isArray(saved.moves) || !saved.moves.every((move) => piecesOk(move?.pieces, board) && count(move?.used))) return false;
      }
      if (!Array.isArray(saved.tries) || !saved.tries.every((item) => typeof item === 'string') || !Array.isArray(saved.completions) || !saved.completions.every(count)) return false;
      if (!(saved.best === null || count(saved.best)) || typeof saved.numbers !== 'boolean') return false;
      return [saved.cutCount, saved.moveCount, saved.turnCount, saved.tickCount, saved.giveCount, saved.missCount, saved.numbersCount, saved.undoCount, saved.resetCount, saved.impossibleCount, saved.wrongCount].every(count);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('cutpaste-board').hidden = !on;
      $('cutpaste-count').hidden = !on;
      if (!on) $('cutpaste-tally').hidden = true;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      flash = null;
    },
    draw,
    ended() {
      flash = null;
    },
    ruleLine(round) {
      const { board } = round;
      if (round.mode === 'move') return fill(T.rules[hasImpossible(round) ? 'move-maybe' : 'move'], { n: board.cuts });
      if (round.mode === 'shadow') return T.rules.shadow;
      return fill(T.rules[round.custom ? 'made' : 'share'], { n: board.m, no: board.n });
    },
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.moves.length > 0 || round.answers.length > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      if (round.mode === 'share') return { mode: round.mode, cuts: round.cuts.map((spots) => spots.slice()), given: Object.keys(round.owners).length, best: round.best };
      return { mode: round.mode, pieces: round.pieces.length, used: round.used, tool: round.tool, overlap: overlapOf(round.pieces).length };
    },
    /** 이 판보다 작은 판: 칸이 적은 도형, 조각 넷의 그림자, 빵이나 사람이 적은 나누기 */
    smaller: (round, turn) => smallerCutpaste({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const { board } = round;
      const summary = { possible: solution.possible };
      if (round.mode === 'move') Object.assign(summary, { min: solution.min, area: solution.area, tried: solution.tried, reason: solution.reason });
      if (round.mode === 'shadow') Object.assign(summary, { area: solution.area, shadowArea: solution.shadowArea, reason: solution.reason });
      if (round.mode === 'share') summary.best = solution.best;
      return {
        mode: round.mode,
        board: copyBoard(board),
        solution: summary,
        // 네모·그림자: 판을 떠날 때의 조각들(칸)과 자른 수
        pieces: isPieces(round) ? round.pieces.map((piece) => piece.cells) : [],
        used: round.used,
        // 나누기: 판을 떠날 때의 자른 자리와 나눠 준 것, 똑같이 나눌 때마다의 조각 수, 가장 적은 조각 수
        cuts: round.cuts,
        owners: round.owners,
        completions: round.completions,
        best: round.best,
        reachedBest: round.mode === 'share' && round.best !== null && round.best === solution.best,
        stopped: round.stopped === true,
        numbersCount: round.numbersCount,
        cutCount: round.cutCount,
        moveCount: round.moveCount,
        turnCount: round.turnCount,
        tickCount: round.tickCount,
        giveCount: round.giveCount,
        missCount: round.missCount,
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
    onKey() {},

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawPicture(root, board, null);
    },
    drawBlank(root) {
      drawShare(root, { ...shareView(T.blank, noCuts(T.blank), {}), small: true });
    },
    drawResume(root, saved) {
      drawPicture(root, saved.board, saved);
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 첫 판 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawShare(root, { ...shareView(T.blank, noCuts(T.blank), {}), small: true });
        return;
      }
      drawPicture(root, generateBoard(entry.level, entry.picture.seed).board, null);
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(빵과 사람의 수). 공책에 남기기가 쓴다 */
    madeBoard,
    /** 가장 좋은 기록(나누기): 가장 적은 조각 수. 적을수록 좋으므로 값은 그 수에 마이너스를 붙인다 */
    bestOf: (round) => (round.mode !== 'share' || round.best === null ? null : { value: -round.best, name: fill(T.notebook.best, { k: round.best }) }),
  };

  /** 작은 그림 하나: 판의 종류마다(하던 판이면 그때의 모습까지) */
  function drawPicture(root, board, state) {
    if (board.kind === 'share') {
      const cuts = state?.cuts ?? noCuts(board);
      drawShare(root, { ...shareView(board, cuts, state?.owners ?? {}), small: true });
      return;
    }
    // 손대지 않은 네모 판은 도형만 꼭 맞게 크게 그린다(판 전체를 그리면 도형이 너무 작다)
    if (board.kind === 'move' && !state) {
      const view = tightView(board.cells);
      drawPieces(root, { w: view.w, h: view.h, pieces: [{ cells: view.shift(board.cells), color: 0 }], small: true });
      return;
    }
    drawPieces(root, { w: board.w, h: board.h, shadow: board.kind === 'shadow' ? board.shadow : null, pieces: state?.pieces ?? startPieces(board), small: true });
  }
}
