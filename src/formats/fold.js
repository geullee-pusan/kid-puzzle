// 접히는 모양 가리기: 판 화면에서 이 형식이 맡는 부분(판, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/fold.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)는 판이 정한다.
//   fold      모양 하나: 돼요나 안 돼요를 고르면 선생님이 접어 보여 주고 판이 끝난다(고른 것과 접어 본 것만 말한다).
//             다섯 칸 모양은 뚜껑 없는 상자가 되는지 묻는다. 겹치는 칸은 빗금이다
//   many      여럿 고르기: 정육면체가 될 모양을 눌러 고르고 "접어 보기"를 누르면 모두 접히고 판이 끝난다
//   opposite  접고 나면 어디로: 표시한 칸의 맞은편 칸을 누른다. 다른 칸이면 접어서 보여 주고 그 칸이 바로 옆에 온다는 사실만 말한다
//   dice      주사위의 숨은 면: 안 보이는 면의 눈을 모두 더한 수를 넣는다. 다른 수면 주사위를 떼어 안 보이던 면에 고리를 두른다
//   all       열한 가지 모두 찾기: 모눈에 여섯 칸을 놓고 "접어 보기". 정육면체가 되면 찾은 모양의 줄에 놓인다.
//             돌리거나 뒤집어 같은 모양이면 몇 번째 모양과 같은지 말한다. 다 찾으면 끝나고, "여기까지 할래요"로 끝내도 된다
// 접은 모양과 주사위는 판을 끌면 돌아간다(입체 틀 src/ui/solid.js).
import T from '../content/fold.json';
import { smallerFold } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/fold-ladder.js';
import { KINDS, cellKey, checkBoard, connected, copyBoard, cubeNets, foldResult, freeKey, normalize, readyToFold, sameShape, solve } from '../core/fold.js';
import { drawCards, drawDice, drawFlat, drawFlatDice, drawFlatGrid, drawFlatMany, drawGrid, drawNet, foldCard } from '../ui/fold-board.js';

const FORMAT = 'fold';
/** 기록에 남기는 접어 본 모양의 수의 위 끝 */
const MAX_TRIES = 200;
/** 넣을 수 있는 수의 자릿수 */
const TYPE_LIMIT = 2;
/** 직접 만들기의 모눈 */
const MAKE_GRID = { w: 6, h: 5 };

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createFold(frame) {
  const { $, log } = frame;
  let flash = null; // 방금 누른 것에 대한 한 줄(판 아래). 다음에 무엇을 누르면 지운다
  let shelfSame = -1; // 모두 찾기: 방금 접은 모양과 같은 찾은 모양(줄에서 눈에 띄게 한다)
  let draft = null; // 직접 만들기에서 놓은 칸들
  let made = null; // 직접 만들기에서 선생님이 접어 본 결과(칸이 바뀌면 지운다)

  const count = (value) => Number.isInteger(value) && value >= 0;
  const name = (picture) => T.pictures[picture];

  /** 한 번 푼 판은 적어 둔다 */
  const memo = new Map();
  function solutionOf(board) {
    const key = JSON.stringify(copyBoard(board));
    if (!memo.has(key)) memo.set(key, solve(board));
    return memo.get(key);
  }

  /** 접은 모양에서 겹치는 칸은 빗금, 나머지는 민 칸 */
  const clashClass = (cells, folded) => {
    const clash = new Set(foldResult(cells).clashes.flat());
    return (at) => (folded && clash.has(at) ? 'fd-clash' : 'fd-plain');
  };
  const spun = () => {
    const { round } = frame;
    if (!round) return;
    round.spinCount += 1;
    if (!round.done) frame.persist();
  };
  const cellName = (x, y, on, fixed) => fill(T.cellLabel, { no: ordinal(y + 1), n: ordinal(x + 1), face: T.cells[fixed ? 'fixed' : on ? 'on' : 'off'] });

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const playing = !round.done;
    for (const kind of KINDS) $(`fold-${kind}-box`).hidden = round.mode !== kind;
    let status = '';
    if (round.mode === 'fold') status = drawFoldBoard(round, playing);
    else if (round.mode === 'many') status = drawManyBoard(round, playing);
    else if (round.mode === 'opposite') status = drawOppositeBoard(round, playing);
    else if (round.mode === 'dice') status = drawDiceBoard(round, playing);
    else status = drawAllBoard(round, playing);
    $('fold-status').textContent = flash ?? status;
    drawFlip(round);
    frame.showWhy();
  }

  /** 판 아래의 "펼치기"(또는 "다시 접기", 주사위는 "떼어 보기"와 "다시 쌓기") */
  function drawFlip(round) {
    const button = $('fold-flip');
    let shown = false;
    let label = T.buttons.unfold;
    if (round.mode === 'dice') {
      shown = round.guesses.length > 0 || round.done;
      label = T.buttons[round.apart ? 'together' : 'apart'];
    } else if (round.mode === 'all') {
      shown = round.folded;
    } else {
      shown = round.foldCount > 0;
      label = T.buttons[round.folded ? 'unfold' : 'fold'];
    }
    button.hidden = !shown;
    button.textContent = label;
  }

  function drawFoldBoard(round, playing) {
    const { board } = round;
    drawNet($('fold-board'), {
      cells: board.cells,
      folded: round.folded,
      live: round.folded,
      classes: clashClass(board.cells, round.folded),
      onSpin: spun,
      label: T.boardLabel[round.folded ? 'cube' : 'net'],
    });
    $('fold-ask').textContent = T.ask[board.cells.length === 5 ? 'box' : 'cube'];
    $('fold-yes').disabled = !playing;
    $('fold-no').disabled = !playing;
    return round.choice === null ? T.status.fold : T.status.turn;
  }

  function drawManyBoard(round, playing) {
    const { board } = round;
    const solution = solutionOf(board);
    drawCards($('fold-board'), {
      shapes: board.shapes,
      marks: round.marks,
      folded: round.folded,
      nets: solution.nets,
      clashes: board.shapes.map((cells) => foldResult(cells).clashes),
      onCard: playing ? toggleCard : null,
      cardLabel: (at) => fill(T[round.marks.includes(at) ? 'cardPicked' : 'cardLabel'], { n: ordinal(at + 1) }),
      notes: (at) => (round.done ? T.cardNotes[solution.nets[at] ? 'yes' : 'no'] : ''),
      onSpin: spun,
    });
    $('fold-many-go').disabled = !playing;
    if (!playing) return T.status.turn;
    return round.marks.length === 0 ? T.status.many : fill(T.status['many-picked'], { n: round.marks.length });
  }

  function drawOppositeBoard(round, playing) {
    const { board } = round;
    const solution = solutionOf(board);
    const last = round.picks.at(-1);
    drawNet($('fold-board'), {
      cells: board.cells,
      pictures: board.pictures,
      folded: round.folded,
      live: round.folded,
      classes: (at) => ['fd-picface', at === board.mark ? 'fd-mark' : '', at === last ? 'fd-picked' : '', round.done && at === solution.answer ? 'fd-answer' : ''].join(' '),
      labels: (at) => fill(T[at === board.mark ? 'faceMark' : 'faceLabel'], { face: name(board.pictures[at]) }),
      onFace: playing ? pickFace : null,
      onSpin: spun,
      label: T.boardLabel[round.folded ? 'cube' : 'net'],
    });
    if (!playing) return T.status.turn;
    return round.folded ? T.status['opposite-folded'] : T.status.opposite;
  }

  function drawDiceBoard(round, playing) {
    const { board } = round;
    const solution = solutionOf(board);
    drawDice($('fold-board'), { dice: board.dice, apart: round.apart, hidden: solution.hidden, live: true, onSpin: spun, label: T.boardLabel.dice });
    $('fold-typed').textContent = round.typed;
    for (const key of $('fold-keys').querySelectorAll('button')) {
      key.disabled = !playing || (key.dataset.n === 'erase' ? round.typed === '' : round.typed.length >= TYPE_LIMIT);
    }
    $('fold-dice-go').disabled = !playing || round.typed === '';
    return round.apart ? T.status['dice-apart'] : T.status.dice;
  }

  function drawAllBoard(round, playing) {
    const { board } = round;
    const solution = solutionOf(board);
    if (round.folded) {
      drawNet($('fold-board'), { cells: round.cells, folded: true, foldIn: true, live: true, classes: clashClass(round.cells, true), onSpin: spun, label: T.boardLabel.cube });
    } else {
      drawGrid($('fold-board'), {
        w: board.w,
        h: board.h,
        cells: round.cells,
        fixed: board.fixed,
        onCell: playing ? tapCell : null,
        cellLabel: cellName,
        label: fill(T.boardLabel.grid, { n: board.w, no: board.h }),
      });
    }
    drawShelf(round, solution);
    $('fold-all-go').disabled = !playing || round.folded || !readyToFold(round.cells);
    $('fold-clear').disabled = !playing || round.cells.length === board.fixed.length;
    $('fold-stop').hidden = !(playing && round.found.length > 0);
    if (round.folded) return T.status['all-folded'];
    if (!playing) return '';
    const left = 6 - round.cells.length;
    if (round.cells.length === 0) return T.status['all-empty'];
    if (left > 0) return fill(T.status['all-more'], { n: left });
    return connected(round.cells) ? T.status['all-ready'] : T.status['all-apart'];
  }

  /** 찾은 모양의 줄: 찾은 차례대로 작은 그림과 차례 수 */
  function drawShelf(round, solution) {
    $('fold-shelf-title').textContent = round.found.length > 0 ? fill(T.shelf, { k: round.found.length, n: solution.total }) : '';
    const items = round.found.map((item, at) => {
      const box = document.createElement('div');
      box.className = at === shelfSame ? 'fd-shelf-item same' : 'fd-shelf-item';
      const inner = document.createElement('div');
      box.append(inner);
      drawFlat(inner, item.cells, { label: at + 1 });
      return box;
    });
    $('fold-shelf').replaceChildren(...items);
  }

  // ---- 모양 하나: 돼요, 안 돼요 ----
  function choose(answer) {
    const { round, solution } = frame;
    if (!round || round.done || round.mode !== 'fold' || round.choice !== null || !['yes', 'no'].includes(answer)) return;
    const correct = (answer === 'yes') === solution.possible;
    round.choice = answer;
    round.moveCount += 1;
    round.answers.push({ t: frame.stamp(), answer, correct, guess: correct ? null : `${answer}-on-${solution.possible ? 'yes' : 'no'}` });
    frame.note('answer', { answer, correct });
    if (!correct) round.wrongCount += 1;
    round.folded = true;
    round.foldCount += 1;
    frame.finish('solved');
  }

  // ---- 여럿 고르기 ----
  function toggleCard(at) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'many' || !Number.isInteger(at) || at < 0 || at >= round.board.shapes.length) return;
    round.marks = round.marks.includes(at) ? round.marks.filter((item) => item !== at) : [...round.marks, at].sort((a, b) => a - b);
    round.moveCount += 1;
    flash = null;
    frame.note('pick', { at, on: round.marks.includes(at) });
    draw();
    frame.persist();
  }

  /** "접어 보기": 모든 모양을 접는다. 고른 것과 되는 것이 몇 개씩인지 말하고 판이 끝난다 */
  function foldMany() {
    const { round, solution } = frame;
    if (!round || round.done || round.mode !== 'many') return;
    const missed = solution.nets.filter((net, at) => net && !round.marks.includes(at)).length;
    const extra = round.marks.filter((at) => !solution.nets[at]).length;
    const correct = missed === 0 && extra === 0;
    round.answers.push({ t: frame.stamp(), answer: `many:${round.marks.join(',')}`, correct, guess: correct ? null : `missed-${missed}-extra-${extra}` });
    frame.note('answer', { marks: round.marks.slice(), correct });
    round.wrongCount += missed + extra;
    round.folded = true;
    round.foldCount += 1;
    frame.finish('solved');
  }

  // ---- 접고 나면 어디로 ----
  function pickFace(at) {
    const { round, solution } = frame;
    if (!round || round.done || round.mode !== 'opposite' || !Number.isInteger(at) || at < 0 || at >= 6) return;
    flash = null;
    if (at === round.board.mark) {
      frame.say(T.play['opposite-mark']);
      return;
    }
    const same = round.picks.includes(at);
    const correct = at === solution.answer;
    round.picks = [...round.picks, at];
    round.moveCount += 1;
    round.answers.push({ t: frame.stamp(), answer: `face:${at}`, correct, guess: correct ? null : 'touching' });
    frame.note('answer', { at, correct });
    if (!round.folded) round.foldCount += 1;
    round.folded = true;
    if (correct) {
      frame.finish('solved');
      return;
    }
    // 틀렸다고 하지 않는다. 접어서 보여 주고, 고른 칸이 바로 옆에 온다는 사실만 말한다.
    if (!same) round.wrongCount += 1;
    draw();
    frame.persist();
    frame.say(same ? T.play['opposite-same'] : fill(T.play['opposite-near'], { face: name(round.board.pictures[at]) }));
  }

  // ---- 주사위 ----
  function press(key) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'dice') return;
    if (key === 'erase') round.typed = round.typed.slice(0, -1);
    else if (/^\d$/.test(key) && round.typed.length < TYPE_LIMIT && !(key === '0' && round.typed === '')) round.typed += key;
    round.moveCount += 1;
    flash = null;
    draw();
    frame.persist();
  }

  /** "이 수예요": 맞으면 주사위를 떼어 보이고 끝난다. 다르면 떼어 놓고 안 보이던 면에 고리를 두른다 */
  function answerDice() {
    const { round, solution } = frame;
    if (!round || round.done || round.mode !== 'dice' || round.typed === '') return;
    const value = Number(round.typed);
    const same = round.guesses.includes(value);
    const correct = value === solution.sum;
    round.guesses = [...round.guesses, value];
    round.typed = '';
    round.answers.push({ t: frame.stamp(), answer: `sum:${value}`, correct, guess: correct ? null : value < solution.sum ? 'less' : 'more' });
    frame.note('answer', { answer: value, correct });
    if (!round.apart) round.apartCount += 1;
    round.apart = true;
    if (correct) {
      frame.finish('solved');
      return;
    }
    if (!same) round.wrongCount += 1;
    draw();
    frame.persist();
    frame.say(same ? T.play['dice-same'] : fill(T.play['dice-apart'], { no: solution.count }));
  }

  // ---- 열한 가지 모두 찾기 ----
  function tapCell(x, y) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'all' || round.folded) return;
    const key = cellKey([x, y]);
    if (round.board.fixed.some((cell) => cellKey(cell) === key)) {
      frame.say(T.play.fixed);
      return;
    }
    const on = round.cells.some((cell) => cellKey(cell) === key);
    if (!on && round.cells.length >= 6) {
      frame.say(T.play['all-full']);
      return;
    }
    round.cells = on ? round.cells.filter((cell) => cellKey(cell) !== key) : [...round.cells, [x, y]];
    round.moveCount += 1;
    flash = null;
    shelfSame = -1;
    frame.note('cell', { x, y, on: !on });
    draw();
    frame.persist();
  }

  /** "접어 보기": 놓은 여섯 칸을 접는다. 정육면체가 되고 처음 찾은 모양이면 줄에 놓는다 */
  function foldAll() {
    const { round, solution } = frame;
    if (!round || round.done || round.mode !== 'all' || round.folded || !readyToFold(round.cells)) return;
    const cells = round.cells.map((cell) => cell.slice());
    const result = foldResult(cells);
    const key = freeKey(cells);
    if (!round.tries.includes(key)) round.tries = [...round.tries, key].slice(-MAX_TRIES);
    round.folded = true;
    round.foldCount += 1;
    flash = null;
    shelfSame = -1;
    frame.note('fold', { cells, ok: result.ok });
    let line;
    if (!result.ok) line = T.play[result.clashes.length > 1 ? 'all-clash-two' : 'all-clash'];
    else {
      const before = round.found.findIndex((item) => item.key === key);
      if (before >= 0) {
        shelfSame = before;
        line = fill(T.play[`all-${sameShape(cells, round.found[before].cells)}`], { no: ordinal(before + 1) });
      } else if (solution.targets.includes(key)) {
        round.found = [...round.found, { key, cells: normalize(cells) }];
        round.answers.push({ t: frame.stamp(), answer: `net:${round.found.length}`, correct: true, guess: null });
        frame.note('answer', { found: round.found.length });
        if (round.found.length >= solution.total) {
          frame.finish('solved');
          return;
        }
        line = fill(T.play['all-found'], { k: round.found.length });
      }
    }
    draw();
    frame.persist();
    if (line) frame.say(line);
  }

  function clearAll() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'all' || round.cells.length === round.board.fixed.length) return;
    round.cells = round.board.fixed.map((cell) => cell.slice());
    round.folded = false;
    round.moveCount += 1;
    flash = null;
    shelfSame = -1;
    frame.note('clear');
    draw();
    frame.persist();
  }

  /** "여기까지 할래요": 찾은 만큼으로 판을 끝낸다. 이것도 끝까지 한 판이다 */
  function stop() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'all' || round.found.length === 0) return;
    round.stopped = true;
    frame.note('stop', { found: round.found.length });
    frame.finish('solved');
  }

  /** 판 아래의 단추: 펴거나 다시 접는다(주사위는 떼거나 다시 쌓는다). 끝난 판에서도 된다 */
  function flip() {
    const { round } = frame;
    if (!round) return;
    if (round.mode === 'dice') {
      round.apart = !round.apart;
      if (round.apart) round.apartCount += 1;
    } else if (round.mode === 'all') {
      if (!round.folded) return;
      round.folded = false;
      shelfSame = -1;
    } else {
      if (round.foldCount === 0) return;
      round.folded = !round.folded;
      round.foldCount += 1;
    }
    flash = null;
    frame.note('flip', { folded: round.folded, apart: round.apart });
    draw();
    frame.keep();
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function clashLine(table, solution) {
    if (solution.possible) return T[table][solution.box ? 'box' : 'cube'];
    return fill(T[table][solution.clashes.length > 1 ? 'clash-two' : 'clash'], { n: solution.empty });
  }

  function rightLine(round, solution) {
    const { board } = round;
    if (round.mode === 'fold') return [T.right[`said-${round.choice}`], clashLine('right', solution), T.right.spin];
    if (round.mode === 'many') {
      const picked = round.marks.length;
      const parts = [picked === 0 ? fill(T.right['many-none'], { k: solution.count }) : fill(T.right.many, { n: picked, k: solution.count })];
      const missed = solution.nets.filter((net, at) => net && !round.marks.includes(at)).length;
      const extra = round.marks.filter((at) => !solution.nets[at]).length;
      if (missed === 0 && extra === 0) parts.push(T.right['many-same']);
      if (missed > 0 && picked > 0) parts.push(fill(T.right['many-missed'], { k: missed }));
      if (extra > 0) parts.push(fill(T.right['many-extra'], { k: extra }));
      return parts;
    }
    if (round.mode === 'opposite') {
      const parts = [fill(T.right.opposite, { face: name(board.pictures[solution.answer]) })];
      if (round.wrongCount > 0) parts.push(T.right['after-wrong']);
      return parts;
    }
    if (round.mode === 'dice') {
      const parts = [fill(T.right.dice, { no: solution.count, k: solution.sum })];
      if (round.wrongCount > 0) parts.push(T.right['dice-after']);
      return parts;
    }
    if (round.stopped) return [fill(T.right['all-stopped'], { k: round.found.length })];
    return [fill(T.right.all, { k: solution.total }), fill(T.right['all-tries'], { n: round.tries.length })];
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 그림의 모양(rows: 줄마다 #이 칸)을 칸들로 */
  const cellsOf = (rows) => rows.flatMap((row, y) => [...row].flatMap((mark, x) => (mark === '#' ? [[x, y]] : [])));

  /** 접어 보이는 그림 카드 하나(펼쳐 있다가 접힌다. 끌면 돌아간다) */
  const foldedCard = (cells, note, big) => foldCard((root) => drawNet(root, { cells, folded: true, foldIn: true, live: true, small: true, classes: clashClass(cells, true) }), note, { big });

  /** "왜 그럴까?": 네 칸 한 줄이 한 바퀴 감싸는 이야기. 모양 하나와 여럿 고르기 판에만 있다 */
  function whyPages(round) {
    if (round.mode !== 'fold' && round.mode !== 'many') return null;
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [rowOf(slide.figures.map((item) => foldedCard(cellsOf(item.rows), item.note, slide.figures.length === 1)))];
      },
    }));
  }

  /** 풀이: 모양은 접은 모습, 여럿은 모두 접은 모습, 맞은편은 두 칸을 굵게 그린 펼친 모양, 주사위는 떼어 놓은 모습, 모두 찾기는 열한 가지 */
  function solutionPages(round, solution) {
    const { board } = round;
    if (round.mode === 'fold') return [{ say: clashLine('solution', solution), nodes: [rowOf([foldedCard(board.cells, '', true)])] }];
    if (round.mode === 'many') {
      const cards = board.shapes.map((cells, at) => foldedCard(cells, T.cardNotes[solution.nets[at] ? 'yes' : 'no'], false));
      return [{ say: fill(T.solution.many, { k: solution.count }), nodes: [rowOf(cards)] }];
    }
    if (round.mode === 'opposite') {
      const card = foldCard((root) => drawFlat(root, board.cells, { pictures: board.pictures, mark: board.mark, picked: solution.answer }), '', { big: true });
      return [{ say: fill(T.solution.opposite, { face: name(board.pictures[solution.answer]) }), nodes: [rowOf([card])] }];
    }
    if (round.mode === 'dice') {
      const card = foldCard((root) => drawDice(root, { dice: board.dice, apart: true, hidden: solution.hidden, live: true, small: true }), '', { big: true });
      const say = board.dice.length === 1 ? fill(T.solution['dice-one'], { k: solution.sum, f: solution.top }) : fill(T.solution.dice, { no: solution.count, k: solution.sum, n: board.dice.length, f: solution.top });
      return [{ say, nodes: [rowOf([card])] }];
    }
    const cards = cubeNets()
      .filter((cells) => solution.targets.includes(freeKey(cells)))
      .map((cells) => foldCard((root) => drawFlat(root, cells), ''));
    return [{ say: fill(T.solution.all, { n: solution.total }), nodes: [rowOf(cards)] }];
  }

  // ---- 직접 만들기: 모눈을 눌러 여섯 칸을 놓는다 ----
  const draftOk = (cells) => Array.isArray(cells) && cells.length <= 6 && cells.every((cell) => Array.isArray(cell) && cell.length === 2 && cell.every(Number.isInteger) && cell[0] >= 0 && cell[1] >= 0 && cell[0] < MAKE_GRID.w && cell[1] < MAKE_GRID.h) && new Set(cells.map(cellKey)).size === cells.length;

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    if (saved && draftOk(saved.cells)) return { cells: saved.cells.map((cell) => cell.slice()) };
    return { cells: [] };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const ready = readyToFold(draft.cells);
    drawGrid($('fold-make-board'), { ...MAKE_GRID, cells: draft.cells, fixed: [], onCell: placeCell, cellLabel: cellName, label: fill(T.boardLabel.grid, { n: MAKE_GRID.w, no: MAKE_GRID.h }) });
    $('fold-make-count').textContent = fill(T.make.count, { k: draft.cells.length });
    $('fold-make-clear').disabled = draft.cells.length === 0;
    $('fold-make-solve').disabled = !ready;
    $('fold-make-play').disabled = !ready;
    $('fold-make-result').textContent = made ? made.line : '';
    if (made) drawNet($('fold-make-picture'), { cells: made.cells, folded: true, foldIn: true, live: true, classes: clashClass(made.cells, true), label: T.boardLabel.cube });
    else $('fold-make-picture').replaceChildren();
  }

  function changeDraft(cells) {
    draft = { cells };
    made = null;
    log.saveDraft({ cells }, FORMAT);
    drawMake();
  }

  /** 모눈을 눌렀다: 빈칸이면 놓고, 놓은 칸이면 뺀다 */
  function placeCell(x, y) {
    const key = cellKey([x, y]);
    const on = draft.cells.some((cell) => cellKey(cell) === key);
    if (!on && draft.cells.length >= 6) {
      frame.talkers.make.say(T.make.full);
      return;
    }
    changeDraft(on ? draft.cells.filter((cell) => cellKey(cell) !== key) : [...draft.cells, [x, y]]);
  }

  /** 선생님이 접어 본다: 정육면체가 되는지, 안 되면 겹치는 칸 */
  function solveDraft() {
    if (!readyToFold(draft.cells)) {
      frame.talkers.make.say(T.make.need);
      return;
    }
    const cells = normalize(draft.cells);
    const result = foldResult(cells);
    const line = result.ok ? T.make.cube : T.make[result.clashes.length > 1 ? 'clash-two' : 'clash'];
    made = { cells, line };
    drawMake();
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board: { kind: 'fold', cells },
      solution: { possible: result.ok, clashes: result.clashes, empty: result.empty },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판). 여섯 칸이 이어져 있어야 한다. 아니면 null */
  const madeBoard = () => (draft && readyToFold(draft.cells) ? { kind: 'fold', cells: normalize(draft.cells) } : null);

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
    else frame.talkers.make.say(T.make['keep-not-yet']);
  }

  // ---- 단추 잇기 ----
  $('fold-yes').addEventListener('click', () => choose('yes'));
  $('fold-no').addEventListener('click', () => choose('no'));
  $('fold-many-go').addEventListener('click', foldMany);
  $('fold-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.n;
    if (key) press(key);
  });
  $('fold-dice-go').addEventListener('click', answerDice);
  $('fold-all-go').addEventListener('click', foldAll);
  $('fold-clear').addEventListener('click', clearAll);
  $('fold-stop').addEventListener('click', stop);
  $('fold-flip').addEventListener('click', flip);
  $('fold-make-clear').addEventListener('click', () => changeDraft([]));
  $('fold-make-solve').addEventListener('click', solveDraft);
  $('fold-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ board }) {
    const start = copyBoard(board);
    return {
      mode: start.kind, // 판의 종류: fold | many | opposite | dice | all
      board: start,
      choice: null, // 모양 하나: 고른 것('yes' | 'no')
      folded: false, // 접혀 있는가(주사위에는 쓰지 않는다)
      marks: [], // 여럿 고르기: 고른 모양의 차례들
      picks: [], // 맞은편: 고른 칸의 차례(고른 순서대로)
      typed: '', // 주사위: 숫자판으로 넣는 중인 수
      guesses: [], // 주사위: 넣은 수들
      apart: false, // 주사위: 떼어 놓았는가
      cells: start.kind === 'all' ? start.fixed.map((cell) => cell.slice()) : [], // 모두 찾기: 지금 모눈에 놓은 칸
      found: [], // 모두 찾기: 찾은 모양 { key(돌리고 뒤집어 같은 모양의 이름), cells }
      tries: [], // 모두 찾기: 접어 본 모양의 이름(같은 모양은 한 번)
      stopped: false, // 모두 찾기: "여기까지 할래요"로 끝냈는가
      moveCount: 0, // 판에 손댄 수(고르기, 칸 놓기, 숫자)
      foldCount: 0, // 접거나 편 수
      spinCount: 0, // 끌어 돌린 수
      apartCount: 0, // 주사위를 떼어 본 수
      wrongCount: 0, // 사실과 다른 답의 수
    };
  }

  const cellListOk = (cells) => Array.isArray(cells) && cells.every((cell) => Array.isArray(cell) && cell.length === 2 && cell.every(Number.isInteger));

  return {
    id: FORMAT,
    T,
    padId: 'fold-pad',
    makeId: 'make-fold',
    homeIds: { sample: 'home-fold-sample', blank: 'home-fold-blank', ask: 'home-fold-ask', play: 'home-fold-play', pick: 'home-fold-pick', make: 'home-fold-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!KINDS.includes(saved.mode) || checkBoard(saved.board) !== null || saved.board.kind !== saved.mode) return false;
      const { board } = saved;
      if (!(saved.choice === null || ['yes', 'no'].includes(saved.choice)) || typeof saved.folded !== 'boolean' || typeof saved.apart !== 'boolean') return false;
      if (!Array.isArray(saved.marks) || !saved.marks.every((at) => Number.isInteger(at) && at >= 0 && at < (board.shapes?.length ?? 0))) return false;
      if (!Array.isArray(saved.picks) || !saved.picks.every((at) => Number.isInteger(at) && at >= 0 && at < 6)) return false;
      if (typeof saved.typed !== 'string' || !/^\d{0,2}$/.test(saved.typed) || !Array.isArray(saved.guesses) || !saved.guesses.every(count)) return false;
      if (!cellListOk(saved.cells) || saved.cells.length > 6 || !Array.isArray(saved.found) || !saved.found.every((item) => item && typeof item.key === 'string' && cellListOk(item.cells))) return false;
      if (board.kind === 'all' && (!board.fixed.every((cell) => saved.cells.some((other) => cellKey(other) === cellKey(cell))) || !saved.cells.every(([x, y]) => x >= 0 && y >= 0 && x < board.w && y < board.h))) return false;
      if (!Array.isArray(saved.tries) || !saved.tries.every((item) => typeof item === 'string')) return false;
      return [saved.moveCount, saved.foldCount, saved.spinCount, saved.apartCount, saved.wrongCount].every(count);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글과 단추)을 보이거나 감춘다. 무르기와 되돌리기는 없다 */
    showParts(on) {
      $('fold-board').hidden = !on;
      $('fold-count').hidden = !on;
      if (!on) $('fold-flip').hidden = true;
      if (on) {
        $('undo').hidden = true;
        $('reset').hidden = true;
      }
    },
    enter() {
      flash = null;
      shelfSame = -1;
    },
    draw,
    ended() {
      flash = null;
      shelfSame = -1;
    },
    ruleLine(round) {
      const { board } = round;
      if (round.mode === 'fold') return T.rules[round.custom ? 'made' : board.cells.length === 5 ? 'box' : 'fold'];
      if (round.mode === 'many') return fill(T.rules.many, { n: board.shapes.length });
      if (round.mode === 'opposite') return fill(T.rules.opposite, { face: name(board.pictures[board.mark]) });
      if (round.mode === 'dice') return board.dice.length === 1 ? T.rules['dice-one'] : fill(T.rules.dice, { n: board.dice.length });
      return fill(T.rules[board.fixed.length > 0 ? 'all-fixed' : 'all'], { n: solutionOf(board).total });
    },
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.moveCount > 0 || round.answers.length > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      return { mode: round.mode, choice: round.choice, folded: round.folded, marks: round.marks.slice(), picks: round.picks.slice(), typed: round.typed, guesses: round.guesses.slice(), cells: round.cells.length, found: round.found.length };
    },
    /** 이 판보다 작은 판: 다섯 칸 모양, 모양 셋, 네 칸 한 줄의 맞은편, 주사위 하나 적게, 네 칸이 놓인 모눈 */
    smaller: (round, turn) => smallerFold({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const { board } = round;
      const summary = { possible: solution.possible };
      if (round.mode === 'fold') Object.assign(summary, { box: solution.box, clashes: solution.clashes, empty: solution.empty });
      if (round.mode === 'many') Object.assign(summary, { nets: solution.nets, count: solution.count });
      if (round.mode === 'opposite') summary.answer = solution.answer;
      if (round.mode === 'dice') Object.assign(summary, { sum: solution.sum, count: solution.count, top: solution.top });
      if (round.mode === 'all') summary.total = solution.total;
      return {
        mode: round.mode,
        board: copyBoard(board),
        solution: summary,
        // 모양 하나: 고른 것. 여럿 고르기: 고른 모양들. 맞은편: 고른 칸들. 주사위: 넣은 수들
        choice: round.choice,
        marks: round.marks,
        picks: round.picks,
        guesses: round.guesses,
        // 모두 찾기: 판을 떠날 때 놓은 칸, 찾은 모양(차례대로), 접어 본 모양의 수
        cells: round.cells,
        found: round.found.map((item) => item.cells),
        tries: round.tries.length,
        reachedBest: round.mode === 'all' && round.found.length === solution.total,
        stopped: round.stopped === true,
        moveCount: round.moveCount,
        foldCount: round.foldCount,
        spinCount: round.spinCount,
        apartCount: round.apartCount,
        // 수준 맞추기가 보는 "틀린 답"의 수
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo() {},
    reset() {},
    /** 글자판이 있는 기기: 주사위에서 숫자와 지우기, 들이기 */
    onKey(event) {
      const { round } = frame;
      if (!round || $('fold-pad').hidden || round.mode !== 'dice') return;
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') press('erase');
      else if (event.key === 'Enter' && !event.target.closest?.('button')) answerDice();
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawPicture(root, board, null);
    },
    drawBlank(root) {
      drawFlatGrid(root, { ...T.blank });
    },
    drawResume(root, saved) {
      drawPicture(root, saved.board, saved);
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 첫 판 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawFlatGrid(root, { ...T.blank });
        return;
      }
      drawPicture(root, generateBoard(entry.level, entry.picture.seed).board, null);
    },
    showMake,
    /** 직접 만들기에서 다 만든 모양(여섯 칸이 이어져 있다). 공책에 남기기가 쓴다 */
    madeBoard,
    /** 가장 좋은 기록(모두 찾기): 찾은 정육면체 모양의 수. 많을수록 좋다 */
    bestOf: (round) => (round.mode !== 'all' || round.found.length === 0 ? null : { value: round.found.length, name: fill(T.notebook.best, { k: round.found.length }) }),
  };

  /** 작은 그림 하나: 판의 종류마다(하던 판이면 그때의 모습까지) */
  function drawPicture(root, board, state) {
    if (board.kind === 'fold') drawFlat(root, board.cells);
    else if (board.kind === 'many') drawFlatMany(root, board.shapes, { marks: state?.marks ?? [] });
    else if (board.kind === 'opposite') drawFlat(root, board.cells, { pictures: board.pictures, mark: board.mark, picked: state?.picks?.at(-1) ?? null });
    else if (board.kind === 'dice') drawFlatDice(root, board.dice);
    else drawFlatGrid(root, { w: board.w, h: board.h, fixed: board.fixed, cells: state?.cells ?? [] });
  }
}

