// 도미노 깔기 모두 찾기: 판 화면에서 이 형식이 맡는 부분(띠와 계단, 적어 둔 것의 목록, 자물쇠, 끝났을 때 하는 말, 전부 보여 줘와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/tilings.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 답은 자물쇠의 수다. 덮는(오르는) 방법이 모두 몇 가지인지 숫자판으로 넣고 "열어 보기"를 누른다. 맞으면 열리고 판이 끝난다.
// 다르면 잠겨 있을 뿐이고 몇 번이든 다시 넣는다. 작게 넣으면 빠뜨린 것이, 크게 넣으면 두 번 센 것이 있는 것 같다고 짐작만 말한다.
// 띠: 붙어 있는 두 칸을 차례로 누르거나 따라 그으면 도미노가 놓인다(조각 덮기의 판). 놓인 도미노를 누르면 들어낸다.
// 계단: 한 칸 위나 두 칸 위의 계단을 눌러 오른다. 무르기는 한 걸음 내려온다.
// "이 깔기 적어 두기"(계단은 "이 오르기 적어 두기")는 다 덮은(맨 위까지 오른) 것을 판 아래의 목록에 넣는다. 목록은 늘 같은 차례로 놓이고
//   (src/core/tilings.js의 이름 차례), 같은 것을 또 적으면 몇 번째와 같은지 말하고 그 그림에 점선 테두리를 두른다. 쓰라고 시키지 않는다.
// 판의 종류: 모두 세어 보기, 짐작하고 세기(먼저 짐작을 적는다. 맞다 다르다 하지 않는다), 표 만들기(2×1부터 2×6까지 자물쇠를 열 때마다
//   표에 그 수가 적힌다. 표가 다 차면 2×7과 2×8을 짐작하고 끝난다. 선생님이 따진 수는 끝난 뒤에 보인다), 계단 오르기, 세 줄 판, 직접 만든 판.
// "전부 보여 줘"는 판이 끝난 뒤에만 열린다(끝난 뒤 고르기의 단추). 덮는 방법을 모두 그리고, 아이가 적어 둔 것은 실선, 적지 않은 것은 점선 테두리다.
// "왜 그럴까?"는 표 만들기 판을 한 번 끝까지 한 뒤에 열린다(표의 수가 이어지는 것을 아이가 먼저 본다). 수학의 이름은 그 마지막 장에서만 말한다.
import T from '../content/tilings.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, solveOnce } from '../core/tilings-ladder.js';
import {
  MAX_W,
  ROWS,
  adjacent,
  checkBoard,
  climbKey,
  compareKeys,
  copyBoard,
  coverKey,
  coverOfKey,
  emptyCells,
  guessSizes,
  hopsOf,
  isStuck,
  keysOf,
  landedOf,
  openCount,
  placeProblem,
  replay,
  strip,
  tableSizes,
  tableStrip,
} from '../core/tilings.js';
import { smallerTilings } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { drawLock, drawStairs, drawStrip, figureCard, itemCard, itemGrid, numberRow } from '../ui/tilings-board.js';

const FORMAT = 'tilings';
const MODES = ['count', 'guess', 'table', 'stairs', 'three', 'made'];
/** 처음 화면과 판 고르기에 그리는 빈 판 */
const BLANK = strip(2, 4);
/** 직접 만들기의 처음 판: 2×4 띠 */
const FIRST_DRAFT = { h: 2, w: 4, holes: [] };
/** 숫자판으로 넣을 수 있는 자릿수 */
const TYPE_LIMIT = 3;
/** 한 번에 그리는 깔기의 위 끝(직접 만든 판이 이보다 많으면 앞의 것만 그린다) */
const MAX_SHOWN = 60;

const count = (value) => Number.isInteger(value) && value >= 0;
const sortPair = (cells) => cells.slice().sort((a, b) => a - b);

/** 판의 이름("2×4 판", "계단 5칸") */
const nameOf = (board) => (board.shape === 'stairs' ? fill(T.names.stairs, { n: board.w }) : fill(T.names.strip, { f: board.h, n: board.w }));

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createTilings(frame) {
  const { $, log } = frame;
  let picks = []; // 띠에서 하나씩 눌러 골라 둔 칸들
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let mark = null; // 목록에서 짚는 그림 { at, kind: 'fresh' | 'same' }. 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 만들던 판 { h, w, holes }
  let made = null; // 직접 만들기에서 선생님이 센 것(판을 고치면 지운다)

  const isStairs = (board) => board.shape === 'stairs';
  /** 지금 세는 판: 표 만들기는 지금 고른 길이의 2줄 띠 */
  const playBoard = (round) => (round.board.table ? tableStrip(round.size) : round.board);
  const tableFull = (round) => round.board.table && round.rows.every((value) => value !== null);
  const needGuess = (round) => round.board.guess && !round.guessDone;
  /** 짐작을 적는 차례인가(짐작하고 세기의 처음, 표 만들기의 끝) */
  const guessing = (round) => !round.done && (needGuess(round) || (tableFull(round) && round.guesses.length < guessSizes(round.board).length));
  /** 판에 보여 주는 띠: 표 만들기에서 짐작하는 동안은 짐작하는 띠(빈 띠) */
  const shownBoard = (round) => (round.board.table && tableFull(round) && !round.done && round.guesses.length < guessSizes(round.board).length ? tableStrip(guessSizes(round.board)[round.guesses.length]) : playBoard(round));
  /** 판의 종류(규칙 글과 힌트). 작은 판은 짐작도 표도 없는 판이다 */
  function kindOf(round) {
    const { board } = round;
    if (board.table) return 'table';
    if (isStairs(board)) return 'stairs';
    if (round.mode === 'made') return 'made';
    if (board.h === 3) return 'three';
    return board.guess ? 'guess' : 'count';
  }
  /** 지금 세는 판의 덮는(오르는) 방법의 수 */
  const truthOf = (round, solution) => (round.board.table ? solution.counts[round.size - 1] : solution.count);
  const listOf = (round) => round.lists[String(round.size)] ?? [];
  const placedOf = (round) => (isStairs(round.board) ? [] : replay(playBoard(round), round.trail).placed);

  /** 읽어 주는 이름 */
  function labelOf(board, placed) {
    const used = new Set(placed.flat());
    return (cell) => {
      const face = board.holes.includes(cell) ? T.labels.hole : used.has(cell) ? T.labels.covered : T.labels.empty;
      return fill(T.labels.cell, { no: ordinal(Math.floor(cell / board.w) + 1), n: ordinal((cell % board.w) + 1), face });
    };
  }

  /** 다 덮었으면(맨 위까지 올랐으면) 그 이름, 아니면 null */
  function keyNow(round) {
    const board = playBoard(round);
    if (isStairs(board)) {
      const hops = hopsOf(board.w, round.trail);
      return hops && round.trail.at(-1) === board.w ? climbKey(hops) : null;
    }
    return coverKey(board, placedOf(round));
  }

  /** 이름 하나의 작은 그림에 건넬 것 */
  function viewOfKey(board, key) {
    if (isStairs(board)) return { shape: 'stairs', n: board.w, landed: landedOf([...key].map(Number)) };
    return { shape: 'strip', w: board.w, h: board.h, holes: board.holes, placed: coverOfKey(board, key) };
  }

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const playing = !round.done;
    const asking = guessing(round);
    const live = playing && !asking;
    const board = shownBoard(round);
    const stairs = isStairs(board);
    if (stairs) {
      const at = round.trail.at(-1) ?? 0;
      drawStairs($('tilings-live'), {
        n: board.w,
        landed: round.trail,
        targets: live ? [at + 1, at + 2].filter((step) => step <= board.w) : [],
        label: (step) => fill(T.labels.step, { no: ordinal(step) }),
        onStep: live ? tapStep : undefined,
      });
    } else {
      const placed = asking ? [] : placedOf(round);
      const stuck = live && isStuck(board, placed);
      drawStrip($('tilings-live'), {
        w: board.w,
        h: board.h,
        holes: board.holes,
        placed,
        picks: live ? picks : [],
        dead: stuck ? emptyCells(board, placed) : [],
        label: labelOf(board, placed),
        onStroke: live ? stroke : undefined,
        onTap: live ? tap : undefined,
        onPiece: live ? lift : undefined,
      });
      $('tilings-cells').textContent = String(openCount(board));
      $('tilings-placed').textContent = String(placed.length);
      $('tilings-empty').textContent = String(emptyCells(board, placed).length);
    }
    $('tilings-strip-numbers').hidden = stairs;
    $('tilings-stairs-numbers').hidden = !stairs;
    if (stairs) {
      $('tilings-steps').textContent = String(board.w);
      $('tilings-climbed').textContent = String(round.trail.at(-1) ?? 0);
    }
    $('tilings-status').textContent = flash ?? statusOf(round, board);
    const key = live ? keyNow(round) : null;
    $('tilings-record').textContent = T.record[stairs ? 'stairs' : 'strip'];
    $('tilings-record').disabled = key === null;
    $('undo').disabled = !live || round.trail.length === 0;
    $('reset').disabled = !live || round.trail.length === 0;
    drawList(round, asking);
    drawPad(round, playing, asking);

    // 끝난 뒤 고르기: "풀이 보기" 대신 "전부 보여 줘"
    const done = round.done && !round.side;
    $('tilings-all').hidden = !done;
    if (done) {
      $('after-same').before($('tilings-all'));
      $('after-solution').hidden = true;
    }
    frame.showWhy();
  }

  function statusOf(round, board) {
    if (round.done) return T.status.done;
    if (guessing(round)) return T.status[needGuess(round) ? 'guess' : 'table-guess'];
    if (isStairs(board)) {
      if (round.trail.at(-1) === board.w) return T.status['stairs-top'];
      return round.trail.length === 0 ? T.status['stairs-start'] : '';
    }
    const placed = placedOf(round);
    if (picks.length === 1) return T.status.one;
    if (emptyCells(board, placed).length === 0) return T.status.full;
    if (isStuck(board, placed)) return fill(T.status.stuck, { n: emptyCells(board, placed).length });
    return placed.length === 0 ? T.status.start : '';
  }

  /** 판 아래의 목록: 적어 둔 것을 이름의 차례대로. 방금 적은 것과 같다고 짚은 것에 테두리를 두른다 */
  function drawList(round, asking) {
    const board = playBoard(round);
    const stairs = isStairs(board);
    const list = asking ? [] : listOf(round);
    $('tilings-list-title').textContent = fill(T.list[stairs ? 'stairs' : 'strip'], { k: list.length });
    $('tilings-list-empty').textContent = T.list[stairs ? 'empty-stairs' : 'empty-strip'];
    $('tilings-list-empty').hidden = list.length > 0 || round.done || asking;
    const cards = list.map((key, at) =>
      itemCard(viewOfKey(board, key), at + 1, {
        mark: mark && mark.at === at ? mark.kind : null,
        label: fill(T.labels[stairs ? 'climb' : 'item'], { no: ordinal(at + 1) }),
      }),
    );
    $('tilings-list').replaceChildren(...cards);
    $('tilings-list').querySelector('.tl-item.same, .tl-item.fresh')?.scrollIntoView?.({ block: 'nearest' });
  }

  /** 오른쪽 칸: 표 만들기의 길이 고르기와 표, 자물쇠(또는 짐작) */
  function drawPad(round, playing, asking) {
    const { board } = round;
    const table = board.table;
    $('tilings-size-box').hidden = !(table && playing && !asking);
    if (table) {
      for (const button of $('tilings-sizes').querySelectorAll('[data-size]')) {
        const size = Number(button.dataset.size);
        button.setAttribute('aria-pressed', String(size === round.size));
        button.disabled = !playing || asking;
      }
    }
    $('tilings-table-box').hidden = !table;
    $('tilings-board').classList.toggle('with-table', table);
    if (table) $('tilings-table-box').replaceChildren(tableNode(round));
    const locking = !asking;
    drawLock($('tilings-lock'), round.done);
    $('tilings-lock').hidden = !locking;
    $('tilings-ask').textContent = asking ? fill(T.guess.ask, { face: nameOf(shownBoard(round)) }) : round.done ? T.lock.opened : T.lock.ask;
    $('tilings-lock-note').hidden = !locking || round.done;
    $('tilings-guess-note').hidden = !asking;
    $('tilings-zero-note').hidden = !(locking && !round.done && round.board.h === 3 && !isStairs(round.board));
    $('tilings-typed').textContent = round.typed;
    for (const key of $('tilings-keys').querySelectorAll('button')) {
      key.disabled = !playing || (key.dataset.n === 'erase' ? round.typed === '' : round.typed.length >= TYPE_LIMIT);
    }
    $('tilings-open').hidden = asking;
    $('tilings-open').disabled = !playing || round.typed === '';
    $('tilings-guess-go').hidden = !asking;
    $('tilings-guess-go').disabled = round.typed === '';
    $('tilings-guess-skip').hidden = !asking;
    const guessed = board.guess && round.guessDone;
    $('tilings-guess-line').hidden = !guessed;
    if (guessed) $('tilings-guess-line').textContent = round.guess === null ? T.guess.unknown : fill(T.guess.line, { n: round.guess });
  }

  /** 표: 길이마다 아이가 자물쇠를 연 수, 그 뒤 두 줄은 짐작(끝난 뒤에 선생님이 따진 수) */
  function tableNode(round) {
    const { board } = round;
    const { counts } = frame.solution;
    const times = (k) => fill(T.table.times, { k });
    const head = T.table.head.map((text) => {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = text;
      return cell;
    });
    const table = document.createElement('table');
    table.className = 'tl-table';
    const top = document.createElement('tr');
    top.append(...head);
    table.append(top);
    const line = (name, cells, now) => {
      const row = document.createElement('tr');
      if (now) {
        row.className = 'now';
        row.setAttribute('aria-current', 'true');
      }
      const first = document.createElement('th');
      first.scope = 'row';
      first.textContent = name;
      row.append(first);
      for (const text of cells) {
        const cell = document.createElement('td');
        cell.textContent = text;
        row.append(cell);
      }
      table.append(row);
    };
    const asking = guessing(round);
    tableSizes(board).forEach((size, index) => {
      const value = round.rows[index];
      line(fill(T.names.size, { f: 2, n: size }), [value === null ? '' : times(value), ''], !round.done && !asking && size === round.size);
    });
    guessSizes(board).forEach((size, index) => {
      const guess = round.guesses[index];
      const mine = guess === undefined ? '' : guess === null ? T.table.unknown : times(guess);
      line(fill(T.names.size, { f: 2, n: size }), [round.done ? times(counts[size - 1]) : '', mine], asking && index === round.guesses.length);
    });
    return table;
  }

  // ---- 띠: 도미노 놓기와 들어내기 ----
  /** 칸을 따라 그었다 */
  function stroke(cells) {
    const { round } = frame;
    if (!round || round.done || guessing(round)) return;
    picks = [];
    place(cells);
  }

  /** 빈칸 하나를 눌렀다. 붙어 있는 칸을 하나 더 누르면 도미노가 놓인다 */
  function tap(cell) {
    const { round } = frame;
    if (!round || round.done || guessing(round)) return;
    flash = null;
    mark = null;
    const board = playBoard(round);
    if (picks.includes(cell)) picks = [];
    else if (picks.length === 1 && adjacent(board, picks[0], cell)) {
      const cells = [picks[0], cell];
      picks = [];
      place(cells);
      return;
    } else picks = [cell];
    draw();
  }

  /** 고른 두 칸에 도미노를 놓는다. 놓을 수 없으면 왜 안 되는지 판 아래에 적는다 */
  function place(picked) {
    const { round } = frame;
    const board = playBoard(round);
    const cells = sortPair(picked);
    const problem = placeProblem(board, placedOf(round), cells);
    mark = null;
    if (problem !== null) {
      round.refuseCount += 1;
      frame.note('refuse', { cells, reason: problem });
      flash = T.status[problem === 'taken' ? 'taken' : 'apart'];
      draw();
      frame.persist();
      return;
    }
    flash = null;
    round.trail = [...round.trail, { op: 'place', cells }];
    round.placeCount += 1;
    frame.note('place', { cells });
    draw();
    frame.persist();
  }

  /** 놓인 도미노를 눌렀다: 들어낸다 */
  function lift(index) {
    const { round } = frame;
    if (!round || round.done || guessing(round)) return;
    const cells = placedOf(round)[index];
    if (!cells) return;
    round.trail = [...round.trail, { op: 'remove', cells }];
    round.removeCount += 1;
    picks = [];
    flash = null;
    mark = null;
    frame.note('remove', { cells });
    draw();
    frame.persist();
  }

  // ---- 계단: 오르기 ----
  function tapStep(step) {
    const { round } = frame;
    if (!round || round.done || guessing(round)) return;
    const n = round.board.w;
    const at = round.trail.at(-1) ?? 0;
    mark = null;
    if (step > at && step - at <= 2 && step <= n) {
      flash = null;
      round.trail = [...round.trail, step];
      round.placeCount += 1;
      frame.note('step', { step });
    } else {
      round.refuseCount += 1;
      flash = T.status[step <= at ? 'stairs-below' : 'stairs-far'];
      frame.note('refuse', { step });
    }
    draw();
    frame.persist();
  }

  function undo() {
    const { round } = frame;
    if (round.done || guessing(round) || round.trail.length === 0) return;
    round.trail = round.trail.slice(0, -1);
    round.undoCount += 1;
    picks = [];
    flash = null;
    mark = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 모습에 한 말(적었다는 말, 같다는 말)은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  function reset() {
    const { round } = frame;
    if (round.done || guessing(round) || round.trail.length === 0) return;
    round.trail = [];
    round.resetCount += 1;
    picks = [];
    flash = null;
    mark = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  // ---- 하나씩 적어 보기 ----
  /** 다 덮은 깔기(맨 위까지 오른 오르기)를 목록에 넣는다. 이미 있으면 몇 번째와 같은지 말한다 */
  function record() {
    const { round } = frame;
    if (!round || round.done || guessing(round)) return;
    const key = keyNow(round);
    if (key === null) return;
    const shape = isStairs(round.board) ? 'stairs' : 'strip';
    const list = listOf(round);
    const at = list.indexOf(key);
    picks = [];
    if (at >= 0) {
      round.sameCount += 1;
      mark = { at, kind: 'same' };
      flash = null;
      frame.note('same', { key, at });
      draw();
      frame.persist();
      frame.say(fill(T.play[`same-${shape}`], { no: ordinal(at + 1) }));
      return;
    }
    const next = [...list, key].sort(compareKeys);
    round.lists = { ...round.lists, [String(round.size)]: next };
    round.recordCount += 1;
    const where = next.indexOf(key);
    mark = { at: where, kind: 'fresh' };
    flash = T.status[shape === 'stairs' ? 'stairs-recorded' : 'recorded'];
    frame.note('record', { key, at: where });
    draw();
    frame.persist();
    frame.say(fill(T.play.recorded, { no: ordinal(where + 1), k: next.length }));
  }

  // ---- 숫자판: 자물쇠와 짐작 ----
  function press(key) {
    const { round } = frame;
    if (!round || round.done) return;
    if (key === 'erase') round.typed = round.typed.slice(0, -1);
    else if (/^\d$/.test(key) && round.typed.length < TYPE_LIMIT) round.typed = round.typed === '0' ? key : round.typed + key;
    else return;
    draw();
    frame.persist();
  }

  /** "열어 보기": 넣은 수가 지금 판의 방법의 수와 같으면 자물쇠가 열린다. 다르면 짐작만 말하고 그대로 잠겨 있다 */
  function openLock() {
    const { round, solution } = frame;
    if (!round || round.done || guessing(round) || round.typed === '') return;
    const value = Number(round.typed);
    const truth = truthOf(round, solution);
    const correct = value === truth;
    const why = correct ? null : value < truth ? 'missed' : 'double';
    round.typed = '';
    round.tryCount += 1;
    const answer = round.board.table ? `count:${round.size}:${value}` : `count:${value}`;
    round.answers.push({ t: frame.stamp(), answer, correct, guess: why });
    frame.note('answer', { answer, correct, guess: why });
    picks = [];
    mark = null;
    flash = null;
    if (!correct) {
      round.wrongCount += 1;
      draw();
      frame.persist();
      const listed = listOf(round).length;
      if (truth === 0) frame.say(T.play['over-none']);
      else if (why === 'missed') frame.say(T.play[listed === 0 ? 'missed-empty' : 'missed']);
      else frame.say(T.play[listed === 0 ? 'double' : 'double-list']);
      return;
    }
    if (!round.board.table) {
      frame.finish('solved');
      return;
    }
    // 표 만들기: 이 길이의 줄에 적고, 아직 비어 있는 다음 길이로 간다. 다 찼으면 짐작할 차례다
    const done = nameOf(tableStrip(round.size));
    round.rows = round.rows.map((item, index) => (index === round.size - 1 ? value : item));
    round.trail = [];
    const sizes = tableSizes(round.board);
    const open = sizes.filter((size) => round.rows[size - 1] === null);
    if (open.length === 0) {
      draw();
      frame.persist();
      frame.say(`${fill(T.play.row, { face: done, k: value })} ${fill(T.play['table-full'], { face: nameOf(tableStrip(guessSizes(round.board)[0])) })}`);
      return;
    }
    round.size = open.find((size) => size > round.size) ?? open[0];
    draw();
    frame.persist();
    frame.say(`${fill(T.play.row, { face: done, k: value })} ${fill(T.play['row-next'], { face: nameOf(tableStrip(round.size)) })}`);
  }

  /** 짐작을 적는다(모르겠어요는 null). 맞다 다르다 하지 않는다 */
  function noteGuess(value) {
    const { round } = frame;
    if (!round || round.done || !guessing(round)) return;
    round.typed = '';
    if (needGuess(round)) {
      round.guessDone = true;
      round.guess = value;
      round.guessAt = frame.stamp();
      frame.note('guess', { guess: value });
      draw();
      frame.persist();
      frame.say(T.play.guessed);
      return;
    }
    const sizes = guessSizes(round.board);
    const size = sizes[round.guesses.length];
    round.guesses = [...round.guesses, value];
    round.answers.push({ t: frame.stamp(), answer: `guess:${size}:${value ?? 'unknown'}`, correct: null, guess: 'guess' });
    frame.note('guess', { size, guess: value });
    if (round.guesses.length < sizes.length) {
      draw();
      frame.persist();
      frame.say(fill(T.play['guess-next'], { face: nameOf(tableStrip(sizes[round.guesses.length])) }));
      return;
    }
    frame.finish('solved');
  }

  /** 표 만들기: 셀 판의 길이를 고른다. 놓던 도미노는 치운다(적어 둔 목록은 길이마다 남는다) */
  function changeSize(size) {
    const { round } = frame;
    if (!round || round.done || !round.board.table || guessing(round)) return;
    if (!tableSizes(round.board).includes(size) || size === round.size) return;
    round.size = size;
    round.trail = [];
    round.sizeCount += 1;
    picks = [];
    flash = null;
    mark = null;
    frame.note('size', { size });
    draw();
    frame.persist();
    frame.say(fill(T.play.size, { face: nameOf(tableStrip(size)) }));
  }

  // ---- 끝났을 때 하는 말: 한 일과 사실만 말한다 ----
  function rightLine(round, solution) {
    const { board } = round;
    const parts = [];
    if (board.table) {
      const [first, second] = guessSizes(board);
      parts.push(fill(T.right.table, { face: nameOf(tableStrip(board.w)) }));
      parts.push(fill(T.right['table-reveal'], { face: nameOf(tableStrip(first)), k: solution.counts[first - 1], no: nameOf(tableStrip(second)), n: solution.counts[second - 1] }));
      parts.push(T.right['table-guess']);
      // 표 만들기를 처음 끝까지 했으면 "왜 그럴까?"가 열렸다는 것을 알려 준다
      const finished = new Set(frame.records().filter(isTableDone).map((item) => item.id));
      if (!round.side && finished.size === 1 && finished.has(round.id)) parts.push(T.right['why-open']);
      return parts;
    }
    const face = nameOf(board);
    if (solution.count === 0) parts.push(solution.cells % 2 === 1 ? fill(T.right.none, { face, n: solution.cells }) : T.right['none-even']);
    else {
      parts.push(fill(T.right[isStairs(board) ? 'climb' : 'count'], { face, k: solution.count }));
      const listed = listOf(round).length;
      if (listed === solution.count) parts.push(fill(T.right['listed-all'], { k: listed }));
      else if (listed > 0) parts.push(fill(T.right['listed-some'], { k: listed }));
    }
    if (board.guess && round.guessDone && round.guess !== null) parts.push(fill(T.right['guess-was'], { n: round.guess }));
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 전부 보여 줘, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 한 판의 덮는(오르는) 방법을 모두 그린다. 적어 둔 것은 실선, 적지 않은 것은 점선 테두리 */
  function allNode(board, listed) {
    const keys = keysOf(board);
    const mine = new Set(listed);
    const marked = listed.length > 0;
    const stairs = isStairs(board);
    const cards = keys.slice(0, MAX_SHOWN).map((key, at) =>
      itemCard(viewOfKey(board, key), at + 1, {
        mark: marked ? (mine.has(key) ? 'found' : 'missed') : null,
        label: fill(T.labels[stairs ? 'climb' : 'item'], { no: ordinal(at + 1) }),
      }),
    );
    return { node: itemGrid(cards), count: keys.length, capped: keys.length > MAX_SHOWN };
  }

  /** 한 판의 종이 한 장 */
  function pageOf(board, listed, head) {
    const { node, count: total, capped } = allNode(board, listed);
    if (total === 0) {
      const cells = openCount(board);
      const say = cells % 2 === 1 ? fill(T.solution.none, { face: nameOf(board), n: cells }) : T.solution['none-even'];
      return { say, nodes: [rowOf([figureCard({ shape: 'strip', w: board.w, h: board.h, holes: board.holes }, null, { big: true })])] };
    }
    const parts = [head ?? fill(T.solution[isStairs(board) ? 'climb' : 'all'], { face: nameOf(board), k: total })];
    if (listed.length > 0) parts.push(T.solution.marks);
    if (capped) parts.push(fill(T.solution.more, { k: MAX_SHOWN }));
    return { say: parts.join(' '), nodes: [node] };
  }

  /** 전부 보여 줘(풀이): 표 만들기는 길이마다 한 장 */
  function solutionPages(round) {
    const { board } = round;
    if (!board.table) return [pageOf(board, listOf(round))];
    return tableSizes(board).map((size) => {
      const small = tableStrip(size);
      return pageOf(small, round.lists[String(size)] ?? [], fill(T.solution['table-page'], { face: nameOf(small), k: keysOf(small).length }));
    });
  }

  function openAll() {
    const { round } = frame;
    if (!round || !round.done) return;
    round.allCount += 1;
    round.viewedSolution = true;
    frame.note('all');
    frame.keep();
    frame.openSheet({ title: T.solution['all-title'], pages: solutionPages(round) });
  }

  /** 끝까지 한 표 만들기 판의 기록인가(작은 판과 직접 만든 판은 빼고) */
  const isTableDone = (item) => item.kind === 'round' && item.format === FORMAT && item.mode === 'table' && item.outcome === 'solved' && item.side !== true && item.custom !== true;
  const isStairsDone = (item) => item.kind === 'round' && item.format === FORMAT && item.mode === 'stairs' && item.outcome === 'solved' && item.side !== true && item.board?.shape === 'stairs';

  /** "왜 그럴까?"의 그림 하나 */
  function figureOf(item, one) {
    if (item.numbers) {
      const values = item.numbers.map((w) => ({ name: fill(T.names.size, { f: 2, n: w }), value: solveOnce(strip(2, w)).count }));
      return numberRow(values, item.note);
    }
    if (item.climb) return figureCard({ shape: 'stairs', n: item.climb.n, landed: landedOf(item.climb.hops) }, item.note, { big: one });
    return figureCard({ shape: 'strip', h: item.board.h, w: item.board.w, holes: [], placed: item.placed }, item.note, { big: one });
  }

  /**
   * "왜 그럴까?": 맨 왼쪽 끝은 세운 도미노 하나이거나 눕힌 도미노 둘 → 남은 판의 수를 더한다 → 표의 수가 모두 그렇다
   * → (계단 판을 끝까지 했으면) 계단도 같다 → 세 줄 판에서는 그대로 통하지 않는다 → 이름(피보나치 수).
   * 표 만들기 판을 한 번 끝까지 한 뒤에만 열린다.
   */
  function whyPages() {
    const records = frame.records();
    if (!records.some(isTableDone)) return null;
    const climbed = records.some(isStairsDone);
    return T.why
      .filter((slide) => !slide.stairs || climbed)
      .map((slide) => ({
        say: slide.say,
        // 그림은 종이를 펼칠 때 그린다
        get nodes() {
          return [rowOf(slide.figures.map((item) => figureOf(item, slide.figures.length === 1)))];
        },
      }));
  }

  // ---- 직접 만들기: 줄 수와 칸 수를 정하고, 칸을 눌러 빼거나 되살린다 ----
  const draftOk = (saved) => saved && ROWS.includes(saved.h) && checkBoard(strip(saved.h, saved.w, { holes: saved.holes ?? [] })) === null;

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    return draftOk(saved) ? { h: saved.h, w: saved.w, holes: saved.holes.slice() } : { ...FIRST_DRAFT, holes: [] };
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판). 덮을 칸이 둘보다 적으면 null */
  function madeBoard() {
    if (!draft) return null;
    const board = strip(draft.h, draft.w, { holes: draft.holes });
    return checkBoard(board) === null ? board : null;
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const { h, w, holes } = draft;
    $('tilings-make-rows').textContent = fill(T.make.rows, { n: h });
    $('tilings-make-rows-fewer').disabled = h <= ROWS[0];
    $('tilings-make-rows-more').disabled = h >= ROWS.at(-1);
    $('tilings-make-cols').textContent = fill(T.make.cols, { n: w });
    $('tilings-make-cols-fewer').disabled = w <= 1;
    $('tilings-make-cols-more').disabled = w >= MAX_W[h];
    $('tilings-make-clear').disabled = holes.length === 0;
    const board = strip(h, w, { holes });
    drawStrip($('tilings-make-board'), { w, h, holes, placed: [], label: labelOf(board, []), onCell: tapDraft });
    $('tilings-make-result').textContent = made ? made.line : '';
    $('tilings-make-picture').replaceChildren(...(made?.node ? [made.node] : []));
    $('tilings-make-play').disabled = madeBoard() === null;
  }

  function changeDraft(next) {
    // 선생님이 센 뒤에 판을 고치면, 앞의 판에 한 말이 남지 않게 판이 바뀌었다는 사실만 말한다
    const said = made !== null;
    draft = next;
    made = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
    if (said) frame.talkers.make.say(T.make.changed);
  }

  /** 칸을 눌렀다: 빼거나 되살린다. 덮을 칸이 둘보다 적어지게 빼지는 않는다 */
  function tapDraft(cell) {
    const { h, w, holes } = draft;
    if (holes.includes(cell)) {
      changeDraft({ h, w, holes: holes.filter((item) => item !== cell) });
      return;
    }
    if (w * h - holes.length - 1 < 2) {
      frame.talkers.make.say(T.make.few);
      return;
    }
    changeDraft({ h, w, holes: [...holes, cell].sort((a, b) => a - b) });
  }

  /** 줄 수나 칸 수를 바꾼다. 남는 칸의 빠진 칸은 그대로 두고, 새 칸은 빠지지 않았다 */
  function resize(h, w) {
    if (!ROWS.includes(h) || w < 1 || w > MAX_W[h]) return;
    let holes = draft.holes.filter((cell) => Math.floor(cell / draft.w) < h && cell % draft.w < w).map((cell) => Math.floor(cell / draft.w) * w + (cell % draft.w));
    if (w * h - holes.length < 2) holes = [];
    changeDraft({ h, w, holes: holes.sort((a, b) => a - b) });
  }

  /** 선생님이 센다: 모두 몇 가지인지 말하고 모두 늘어놓는다 */
  function solveDraft() {
    const board = madeBoard();
    if (!board) {
      frame.talkers.make.say(T.make['keep-not-yet']);
      return;
    }
    const { node, count: total, capped } = allNode(board, []);
    const cells = openCount(board);
    let line;
    if (total === 0) line = cells % 2 === 1 ? fill(T.make.odd, { n: cells }) : T.make.none;
    else line = capped ? `${fill(T.make.count, { k: total })} ${fill(T.make.more, { k: MAX_SHOWN })}` : fill(T.make.count, { k: total });
    made = { line, node: total === 0 ? null : node };
    drawMake();
    const stamp = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: stamp,
      endedAt: stamp,
      board,
      solution: { possible: true, count: total, cells },
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
  $('tilings-record').addEventListener('click', record);
  $('tilings-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.n;
    if (key) press(key);
  });
  $('tilings-open').addEventListener('click', openLock);
  $('tilings-guess-go').addEventListener('click', () => {
    const { round } = frame;
    if (round && round.typed !== '') noteGuess(Number(round.typed));
  });
  $('tilings-guess-skip').addEventListener('click', () => noteGuess(null));
  $('tilings-sizes').addEventListener('click', (event) => {
    const size = Number(event.target.closest('button')?.dataset.size);
    if (Number.isInteger(size)) changeSize(size);
  });
  $('tilings-all').addEventListener('click', openAll);
  $('tilings-make-rows-fewer').addEventListener('click', () => resize(draft.h - 1, Math.min(draft.w, MAX_W[draft.h - 1] ?? draft.w)));
  $('tilings-make-rows-more').addEventListener('click', () => resize(draft.h + 1, Math.min(draft.w, MAX_W[draft.h + 1] ?? draft.w)));
  $('tilings-make-cols-fewer').addEventListener('click', () => resize(draft.h, draft.w - 1));
  $('tilings-make-cols-more').addEventListener('click', () => resize(draft.h, draft.w + 1));
  $('tilings-make-clear').addEventListener('click', () => changeDraft({ h: draft.h, w: draft.w, holes: [] }));
  $('tilings-make-solve').addEventListener('click', solveDraft);
  $('tilings-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: copyBoard(board), // 판: 띠나 계단(src/core/tilings.js)
      size: board.table ? 1 : board.w, // 지금 세는 판의 가로 칸 수(표 만들기만 바뀐다)
      trail: [], // 띠: 놓고 들어낸 일의 목록 { op, cells }. 계단: 밟은 계단들(아래에서부터)
      lists: {}, // 적어 둔 것: 가로 칸 수마다 이름의 목록(이름의 차례대로)
      rows: board.table ? tableSizes(board).map(() => null) : [], // 표 만들기: 길이마다 아이가 자물쇠를 연 수
      guessDone: false, // 짐작하고 세기: 짐작을 적었는가
      guess: null, // 그 짐작(모르겠어요는 null). 맞다 다르다 하지 않는다
      guessAt: null, // 짐작을 적은 때(초)
      guesses: [], // 표 만들기: 2×7, 2×8의 짐작(모르겠어요는 null)
      typed: '', // 숫자판으로 넣는 중인 수
      placeCount: 0, // 도미노를 놓은(계단을 오른) 수
      removeCount: 0, // 도미노를 들어낸 수
      refuseCount: 0, // 놓을 수 없는 곳(오를 수 없는 계단)을 누른 수
      recordCount: 0, // 목록에 새로 적은 수
      sameCount: 0, // 이미 적은 것을 또 적으려 한 수
      undoCount: 0,
      resetCount: 0,
      sizeCount: 0, // 표 만들기에서 길이를 바꾼 수
      tryCount: 0, // 자물쇠에 수를 넣어 본 수
      allCount: 0, // 전부 보여 줘를 연 수
      wrongCount: 0, // 자물쇠에 넣은 수가 실제 수와 달랐던 수
    };
  }

  /** 적어 둔 판의 단계가 판의 종류와 맞는가 */
  function levelOk(saved) {
    const { board } = saved;
    if (saved.custom === true) return saved.level === MAKE_LEVEL && saved.mode === 'made' && board.shape === 'strip' && !board.guess && !board.table;
    if (!Number.isInteger(saved.level) || saved.level < LADDER[0].level || saved.level > TOP_LEVEL) return false;
    if (rungOf(saved.level).mode !== saved.mode) return false;
    const kind = board.table ? 'table' : board.shape === 'stairs' ? 'stairs' : board.guess ? 'guess' : board.h === 3 ? 'three' : 'count';
    return kind === saved.mode && board.holes.length === 0;
  }

  /** 적어 둔 목록이 그 길이의 판의 이름들인가 */
  function listsOk(saved) {
    if (!saved.lists || typeof saved.lists !== 'object' || Array.isArray(saved.lists)) return false;
    return Object.entries(saved.lists).every(([size, list]) => {
      const w = Number(size);
      const board = saved.board.table ? (tableSizes(saved.board).includes(w) ? tableStrip(w) : null) : w === saved.board.w ? saved.board : null;
      if (!board || !Array.isArray(list)) return false;
      const keys = new Set(keysOf(board));
      return list.every((key) => typeof key === 'string' && keys.has(key)) && new Set(list).size === list.length;
    });
  }

  function validSaved(saved) {
    if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null || !levelOk(saved)) return false;
    const { board } = saved;
    if (board.table ? !tableSizes(board).includes(saved.size) : saved.size !== board.w) return false;
    if (!Array.isArray(saved.trail)) return false;
    if (board.shape === 'stairs' ? hopsOf(board.w, saved.trail) === null : !replay(board.table ? tableStrip(saved.size) : board, saved.trail).ok) return false;
    if (!listsOk(saved)) return false;
    if (!Array.isArray(saved.rows) || saved.rows.length !== (board.table ? board.w : 0)) return false;
    const counts = board.table ? solveOnce(board).counts : [];
    if (!saved.rows.every((value, index) => value === null || value === counts[index])) return false;
    if (typeof saved.guessDone !== 'boolean' || !(saved.guess === null || count(saved.guess))) return false;
    if (!Array.isArray(saved.guesses) || saved.guesses.length > guessSizes(board).length || !saved.guesses.every((value) => value === null || count(value))) return false;
    if (!board.table && saved.guesses.length > 0) return false;
    if (typeof saved.typed !== 'string' || !/^\d{0,3}$/.test(saved.typed)) return false;
    return [saved.placeCount, saved.removeCount, saved.refuseCount, saved.recordCount, saved.sameCount, saved.undoCount, saved.resetCount, saved.sizeCount, saved.tryCount, saved.allCount, saved.wrongCount].every(count);
  }

  /** 작은 그림: 띠는 첫째 깔기(덮을 수 없으면 빈 띠), 계단은 빈 계단 */
  function drawSample(root, board) {
    if (isStairs(board)) {
      drawStairs(root, { n: board.w, small: true });
      return;
    }
    const shown = board.table ? tableStrip(4) : board;
    const keys = keysOf(shown);
    drawStrip(root, { w: shown.w, h: shown.h, holes: shown.holes, placed: keys.length > 0 ? coverOfKey(shown, keys[0]) : [], small: true });
  }

  return {
    id: FORMAT,
    T,
    padId: 'tilings-pad',
    makeId: 'make-tilings',
    // 규칙 글이 세 문장이라 길다. 왼쪽 칸 맨 위에 두고 판과 목록을 크게 그린다
    ruleAside: true,
    homeIds: { sample: 'home-tilings-sample', blank: 'home-tilings-blank', ask: 'home-tilings-ask', play: 'home-tilings-play', pick: 'home-tilings-pick', make: 'home-tilings-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solveOnce(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      try {
        return validSaved(saved);
      } catch {
        return false;
      }
    },
    /** 판 화면에서 이 형식의 것(판과 목록, 판 아래의 글과 단추, 끝난 뒤의 단추)을 보이거나 감춘다 */
    showParts(on) {
      $('tilings-board').hidden = !on;
      $('tilings-count').hidden = !on;
      $('tilings-record').hidden = !on;
      if (!on) $('tilings-all').hidden = true;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      picks = [];
      flash = null;
      mark = null;
    },
    draw,
    ended() {
      picks = [];
      flash = null;
      mark = null;
    },
    ruleLine(round) {
      const kind = kindOf(round);
      if (kind === 'table') return fill(T.rules.table, { face: nameOf(tableStrip(round.board.w)) });
      return T.rules[kind === 'stairs' ? 'stairs' : 'cover'];
    },
    hints: (round) => T.hints[kindOf(round)],
    touched: (round) => round.placeCount > 0 || round.recordCount > 0 || round.tryCount > 0 || round.guessDone || round.guesses.length > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      return { size: round.size, trail: round.trail.length, placed: placedOf(round).length, listed: listOf(round).length, typed: round.typed, rows: round.rows.slice(), guessDone: round.guessDone };
    },
    /** 이 판보다 작은 판: 오른쪽 열을 뗀 짧은 띠(표 만들기는 지금 세는 띠보다 짧은 띠), 칸이 적은 계단 */
    smaller: (round, turn) => smallerTilings({ mode: round.mode, board: round.board, size: round.size }, turn),
    record(round, solution) {
      const truth = round.board.table ? null : solution.count;
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: true, count: solution.count, cells: solution.cells, counts: solution.counts },
        // 판을 떠날 때의 모습: 지금 세는 길이, 놓은 도미노(밟은 계단), 적어 둔 목록, 표, 짐작
        size: round.size,
        trail: round.trail,
        lists: round.lists,
        listed: Object.values(round.lists).reduce((sum, list) => sum + list.length, 0),
        rows: round.rows,
        guessDone: round.guessDone,
        guess: round.guess,
        guessAt: round.guessAt,
        guesses: round.guesses,
        // 짐작이 실제와 같았는가(기록에만 남긴다. 화면에는 알리지 않는다)
        guessMatched: round.board.table ? round.guesses.map((value, index) => (value === null ? null : value === solution.counts[round.board.w + index])) : round.guess === null ? null : round.guess === truth,
        placeCount: round.placeCount,
        removeCount: round.removeCount,
        refuseCount: round.refuseCount,
        recordCount: round.recordCount,
        sameCount: round.sameCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        sizeCount: round.sizeCount,
        tryCount: round.tryCount,
        allCount: round.allCount,
        // 수준 맞추기가 보는 "틀린 답"의 수
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    /** 글자판이 있는 기기: 숫자와 지우기, 들이기(자물쇠를 열거나 짐작을 적는다). 칸과 계단은 저마다 Enter와 빈칸 글쇠로 누른다(판이 맡는다) */
    onKey(event) {
      const { round } = frame;
      if (!round || $('tilings-pad').hidden || round.done) return;
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') press('erase');
      else if (event.key === 'Enter' && !event.target.closest?.('button, [data-cell], [data-step]')) {
        if (guessing(round)) {
          if (round.typed !== '') noteGuess(Number(round.typed));
        } else openLock();
      } else if (event.key === 'Escape' && picks.length > 0) {
        picks = [];
        draw();
      }
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample,
    drawBlank(root) {
      drawStrip(root, { w: BLANK.w, h: BLANK.h, holes: [], small: true });
    },
    /** 하던 판과 공책의 그림: 지금 놓인 도미노(밟은 계단). 아무것도 없으면 판의 그림 */
    drawResume(root, saved) {
      const { board } = saved;
      if (board.shape === 'stairs') {
        drawStairs(root, { n: board.w, landed: hopsOf(board.w, saved.trail ?? []) ? saved.trail : [], small: true });
        return;
      }
      const shown = board.table ? tableStrip(saved.size ?? 1) : board;
      const placed = replay(shown, saved.trail ?? []).placed;
      if (placed.length === 0) drawSample(root, board);
      else drawStrip(root, { w: shown.w, h: shown.h, holes: shown.holes, placed, small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawStrip(root, { w: BLANK.w, h: BLANK.h, holes: [], small: true });
        return;
      }
      drawSample(root, generateBoard(entry.level, entry.picture.seed).board);
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
  };
}

