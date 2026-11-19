// 주사위 미로와 길 세기: 판 화면에서 이 형식이 맡는 부분(판, 출구 고르기와 손님 보내기, 자물쇠에 수 넣기, 짝수 칸 칠하기,
// 길 그려 보기, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/maze.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)는 판이 정한다(src/core/maze.js).
//   busy   실험. 어느 출구로 손님이 가장 많이 갈지 먼저 고르고(이것이 답이다. 맞다 틀리다 하지 않는다), 손님을 보낸다.
//          "손님 1명 보내기"는 갈림길마다 주사위를 굴리며 내려가는 것을 보여 준다. "손님 100명 보내기"는 막대만 쌓인다.
//          고른 뒤 손님을 모두 100명 넘게 보내면 판이 끝난다. 몇 명이 어디로 갔는지를 사실로만 말하고, "더 많이 해 보기"만 권한다.
//   count  칸을 고르고 수를 넣는다. 그 칸까지 오는 길의 수가 맞으면 자물쇠가 열리고, 틀리면 잠긴 채로 있을 뿐이다(몇 번이든 다시 넣는다).
//          열어야 할 칸(표시한 출구, 모든 칸, 모든 출구)이 다 열리면 끝난다. 다른 칸의 자물쇠도 열어 볼 수 있다(적어 두기).
//          막힌 갈림길이 있는 판(4단계)에서는 손님도 보내 볼 수 있다.
//   even   길의 수가 짝수인 칸을 모두 칠하고 "다 칠했어요"를 누른다. 수를 넣어 자물쇠를 열어 보는 것은 해도 되고 안 해도 된다.
// "길 그려 보기"는 도구다. 맨 위에서부터 칸을 차례로 누르면 길이 그려지고 왼쪽 칸에 차례대로 적힌다. 같은 길은 두 번 적지 않는다.
// 손님 보내기의 주사위는 시드 난수다. 시드는 (판의 번호, 몇 번째로 보낸 것인지)로 정해서 판에 적어 둔다. 그래서 다시 보내 보면 같은 결과다.
import T from '../content/maze.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, solutionOf } from '../core/maze-ladder.js';
import {
  FINISH_GUESTS,
  LIMITS,
  KINDS,
  blockableCells,
  cellCount,
  checkBoard,
  checkLock,
  checkPaint,
  copyBoard,
  exitCell,
  exitTally,
  lockCells,
  pathCell,
  pathsTo,
  replaySends,
  rowCol,
  sendGuests,
  solve,
  sortPaths,
  stepPath,
  topExits,
  whyOpen,
} from '../core/maze.js';
import { seedFrom } from '../core/rng.js';
import { smallerMaze } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { drawMaze, mazeCard, pathList } from '../ui/maze-board.js';

const FORMAT = 'maze';
/** 손님 한 명이 갈림길 하나를 내려가는 데 걸리는 시간(밀리초, 임시) */
const STEP_MS = 650;
/** 숫자판에 넣을 수 있는 자리 수(길의 수는 가장 커도 70이다) */
const MAX_DIGITS = 3;
/** 풀이에서 컴퓨터가 보내 보는 손님 수 */
const SOLUTION_GUESTS = 1000;
/** 기록에 남기는 "넣어 본 수"의 수의 위 끝 */
const MAX_TRIES = 80;
/** 처음 화면과 판 고르기에 그리는 빈 판 */
const BLANK = { kind: 'busy', rows: 3, blocked: [], target: null, ask: null };
const FIRST_DRAFT = { rows: 4, blocked: [4] };

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createMaze(frame) {
  const { $, log } = frame;
  let typed = ''; // 숫자판에 넣은 글자
  let flash = null; // 판 아래에 잠깐 적는 사실. 다음에 무엇을 누르면 지운다
  let walking = null; // 내려가는 손님 { round, walk, step }
  let timer = null; // 손님이 다음 갈림길로 가는 타이머
  let fresh = null; // 방금 적은 길
  let draft = null; // 직접 만들기에서 만들던 판 { rows, blocked }
  let draftCounted = false; // 선생님이 길을 세어 주었는가
  let draftEnds = null; // 직접 만든 판에 보낸 손님(칸마다 끝난 수)

  const count = (value) => Number.isInteger(value) && value >= 0;
  const sumOf = (list) => list.reduce((sum, value) => sum + value, 0);
  const exitName = (k) => fill(T.names.exit, { face: T.exits[k] });
  const guestText = (n) => fill(T.guests, { n });

  function cellName(board, cell) {
    const { r, i } = rowCol(cell);
    return r === board.rows ? exitName(i) : T.names.fork;
  }

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    walking = null;
  }

  function forget() {
    flash = null;
    typed = '';
    fresh = null;
    clearTimer();
  }

  // ---- 판 ----
  const numberMode = (round) => round.mode === 'count' || (round.mode === 'even' && round.tool === 'number');
  const asked = (round) => (round.mode === 'count' ? solutionOf(round.board).asked : []);
  const leftLocks = (round) => asked(round).filter((cell) => !round.opened.includes(cell)).length;
  const guestsOn = (round) => round.mode === 'busy' || (round.mode === 'count' && round.board.blocked.length > 0 && round.board.ask === 'target');

  /** 열어야 할 칸 가운데 아직 안 열린 첫 칸(없으면 null) */
  function nextAsked(round) {
    return asked(round).find((cell) => !round.opened.includes(cell)) ?? null;
  }

  /** 칸마다 보여 줄 수: 맨 위 칸(1)과 열린 자물쇠 */
  function shownOf(round, counts) {
    const shown = new Array(cellCount(round.board.rows)).fill(null);
    if (round.mode !== 'busy') shown[0] = counts[0];
    for (const cell of round.opened) shown[cell] = counts[cell];
    return shown;
  }

  /** 지금 보여 줄 손님: 내려가는 중인 손님은 아직 막대에 넣지 않는다 */
  function endsShown(round) {
    if (!walking || walking.round !== round) return round.ends;
    const ends = round.ends.slice();
    ends[walking.walk.end] -= 1;
    return ends;
  }

  function labelOf(round, counts) {
    return (cell) => {
      const { r, i } = rowCol(cell);
      const name = r === round.board.rows ? exitName(i) : fill(T.cellLabel, { no: ordinal(r + 1), n: ordinal(i + 1) });
      const states = [];
      if (round.board.blocked.includes(cell)) states.push(T.cellState.blocked);
      else if (round.mode !== 'busy' && (cell === 0 || round.opened.includes(cell))) states.push(fill(T.cellState.open, { k: counts[cell] }));
      else if (round.mode !== 'busy') states.push(T.cellState.locked);
      if (round.painted.includes(cell)) states.push(T.cellState.painted);
      if (r === round.board.rows && round.board.target === i) states.push(T.cellState.target);
      if (r === round.board.rows && round.pick === i) states.push(T.cellState.picked);
      return [name, ...states].join(', ');
    };
  }

  /** 판(또는 공책과 처음 화면의 작은 그림)에 그릴 것 */
  function viewOf(round, { live = false } = {}) {
    const { board } = round;
    const counts = solutionOf(board).counts;
    const sent = sumOf(round.ends);
    const walker = walking && walking.round === round ? walking : null;
    const view = {
      board,
      exitNames: T.exits,
      shown: shownOf(round, counts),
      locked: new Set(round.mode === 'busy' ? [] : lockCells(board).filter((cell) => !round.opened.includes(cell))),
      painted: new Set(round.painted),
      selected: round.mode !== 'busy' && numberMode(round) && !round.pathsOn && !round.done ? round.selected : null,
      picked: round.pick,
      path: round.pathsOn && !round.done ? round.drawing : null,
      ends: round.mode === 'busy' || sent > 0 ? endsShown(round) : null,
      guestText,
      guest: walker ? { cell: walker.walk.cells[walker.step], roll: walker.walk.rolls[walker.step] } : null,
    };
    if (live) {
      view.label = labelOf(round, counts);
      view.onCell = tapCell;
    }
    return view;
  }

  function statusOf(round) {
    if (walking && walking.round === round) return T.status.walking;
    if (round.mode === 'busy') return round.pick === null ? T.status['busy-pick'] : T.status['busy-ready'];
    if (round.mode === 'even' && round.tool === 'paint') return T.status['even-paint'];
    if (round.pathsOn) return round.drawing === '' ? T.status['path-start'] : T.status['path-going'];
    if (round.selected === null) return T.status['count-pick'];
    const { r } = rowCol(round.selected);
    return r === round.board.rows ? fill(T.status['picked-exit'], { face: T.exits[rowCol(round.selected).i] }) : T.status['picked-fork'];
  }

  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    const busy = round.mode === 'busy';
    const walkingNow = Boolean(walking && walking.round === round);
    drawMaze($('maze-board'), viewOf(round, { live: playing && !walkingNow }));
    $('maze-status').textContent = round.done ? '' : (flash ?? statusOf(round));
    $('maze-sent-line').hidden = !guestsOn(round);
    $('maze-sent').textContent = String(sumOf(round.ends));
    $('maze-locks-line').hidden = round.mode !== 'count';
    $('maze-locks').textContent = String(leftLocks(round));
    $('maze-painted-line').hidden = round.mode !== 'even';
    $('maze-painted').textContent = String(round.painted.length);

    // 오른쪽 칸: 실험은 출구 고르기와 손님 보내기, 세는 판은 자물쇠, 짝수 판은 칠하기와 "다 칠했어요"
    $('maze-busy').hidden = !busy;
    if (busy) drawPicks(round);
    $('maze-even').hidden = round.mode !== 'even';
    $('maze-even-title').textContent = T.evenTitle;
    for (const button of $('maze-tools').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.tool === round.tool));
    $('maze-check-box').hidden = round.mode !== 'even';
    $('maze-check').disabled = !playing;
    $('maze-lock').hidden = !numberMode(round);
    if (numberMode(round)) drawLock(round);
    $('maze-send').hidden = !guestsOn(round);
    const canSend = playing && !walkingNow && (!busy || round.pick !== null);
    $('maze-send-one').disabled = !canSend;
    $('maze-send-many').disabled = !canSend;

    // 왼쪽 칸의 도구: 길 그려 보기(세는 판). 끝난 판에서는 꺼져 있다
    const tool = round.mode === 'count';
    $('maze-paths').hidden = !tool;
    $('maze-path-box').hidden = !(tool && round.pathsOn && playing);
    if (tool) {
      $('maze-paths').textContent = T.tool[round.pathsOn && playing ? 'on' : 'off'];
      $('maze-paths').setAttribute('aria-pressed', String(round.pathsOn && playing));
      $('maze-paths').disabled = !playing;
      $('maze-path-count').textContent = fill(T.tool.count, { n: round.paths.length });
      pathList(
        $('maze-path-list'),
        sortPaths(round.paths).map((path) => ({ arrows: [...path].map((step) => T.arrows[step]).join(''), end: cellName(board, pathCell(board, path)), fresh: path === fresh })),
      );
      $('maze-path-clear').disabled = round.paths.length === 0;
    }

    // 끝난 뒤 고르기에 이 형식만의 것: 실험은 "더 많이 해 보기", 표시한 출구가 있는 판은 "전부 보여 줘"
    const done = round.done && !round.side;
    $('maze-more').hidden = !(done && busy);
    $('maze-all').hidden = !(done && board.ask === 'target');
    if (done && busy) $('after-same').before($('maze-more'));
    if (done && board.ask === 'target') {
      $('after-same').before($('maze-all'));
      $('after-solution').hidden = true;
    }
    frame.showWhy();
  }

  /** 출구 고르기 단추: 출구마다 하나. 고른 뒤에는 고른 출구만 적는다 */
  function drawPicks(round) {
    const exits = round.board.rows + 1;
    const root = $('maze-picks');
    root.hidden = round.pick !== null;
    $('maze-picked').hidden = round.pick === null;
    if (round.pick !== null) $('maze-picked').textContent = fill(T.pickedLine, { face: T.exits[round.pick] });
    if (root.children.length !== exits) {
      root.style.setProperty('--n', String(Math.min(exits, 5)));
      root.replaceChildren(
        ...Array.from({ length: exits }, (_, k) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn';
          button.dataset.exit = String(k);
          button.textContent = T.exits[k];
          button.setAttribute('aria-label', exitName(k));
          return button;
        }),
      );
    }
  }

  /** 자물쇠 칸: 고른 칸의 물음, 넣은 수, 숫자판, "열어 보기" */
  function drawLock(round) {
    const cell = round.selected;
    let ask = T.ask.none;
    if (cell !== null) {
      const { r, i } = rowCol(cell);
      if (r === round.board.rows) ask = fill(T.ask[round.board.target === i ? 'target' : 'exit'], { face: T.exits[i] });
      else ask = T.ask.fork;
    }
    $('maze-ask').textContent = ask;
    $('maze-typed').textContent = typed;
    $('maze-open').disabled = round.done || typed === '' || cell === null || round.opened.includes(cell);
    for (const key of $('maze-keys').querySelectorAll('button')) key.disabled = round.done;
  }

  // ---- 칸을 눌렀다 ----
  function tapCell(cell) {
    const { round } = frame;
    if (round.done || (walking && walking.round === round)) return;
    const { r, i } = rowCol(cell);
    flash = null;
    fresh = null;
    if (round.mode === 'busy') {
      if (r === round.board.rows && round.pick === null) choose(i);
      else draw();
      return;
    }
    if (round.board.blocked.includes(cell)) {
      round.blockedTaps += 1;
      flash = T.status[round.pathsOn ? 'path-blocked' : 'blocked'];
      frame.note('blocked', { cell });
      draw();
      if (!round.blockedSaid) {
        round.blockedSaid = true;
        frame.say(T.play['path-blocked']);
      }
      frame.persist();
      return;
    }
    if (round.pathsOn && round.mode === 'count') {
      drawStep(cell);
      return;
    }
    if (round.mode === 'even' && round.tool === 'paint') {
      round.painted = round.painted.includes(cell) ? round.painted.filter((item) => item !== cell) : [...round.painted, cell].sort((a, b) => a - b);
      round.moveCount += 1;
      frame.note('paint', { cell, on: round.painted.includes(cell) });
      draw();
      frame.persist();
      return;
    }
    // 수를 넣을 칸을 고른다. 맨 위 칸과 이미 열린 칸은 고르지 않는다.
    if (cell === 0 || round.opened.includes(cell)) {
      flash = T.status.already;
      draw();
      return;
    }
    if (round.selected !== cell) typed = '';
    round.selected = cell;
    frame.note('select', { cell });
    draw();
    frame.persist();
  }

  /** 실험: 출구 하나를 고른다. 이 고르기가 판의 답이다. 맞다 틀리다 하지 않는다 */
  function choose(exit) {
    const { round, solution } = frame;
    if (!round || round.done || round.mode !== 'busy' || round.pick !== null) return;
    round.pick = exit;
    // correct: 길이 가장 많은 출구를 골랐는가. 화면에서는 알리지 않는다(보내 보면 보인다).
    const correct = solution.busiest.includes(exit);
    round.answers.push({ t: frame.stamp(), answer: `exit:${exit}`, correct, guess: null });
    frame.note('pick', { exit, correct });
    draw();
    frame.persist();
    frame.say(fill(T.play.picked, { face: T.exits[exit] }));
  }

  // ---- 손님 보내기 ----
  /** 손님 n명을 보낸다. 결과는 바로 판에 적어 두고(나갔다 와도 그대로), 한 명이면 내려가는 모습을 보여 준다 */
  function send(n) {
    const { round } = frame;
    if (!round || round.done || !guestsOn(round) || (walking && walking.round === round)) return;
    if (round.mode === 'busy' && round.pick === null) return;
    const seed = seedFrom(FORMAT, round.id, round.sends.length);
    const result = sendGuests(round.board, n, seed);
    round.sends.push({ n, seed });
    round.ends = round.ends.map((value, cell) => value + result.ends[cell]);
    round.moveCount += 1;
    if (n === 1) round.oneCount += 1;
    else round.manyCount += 1;
    flash = null;
    frame.note('send', { n, seed });
    frame.persist();
    if (n === 1) {
      walk(result.walks[0]);
      return;
    }
    const halted = round.board.blocked.reduce((sum, cell) => sum + result.ends[cell], 0);
    flash = fill(T.status.many, { n });
    if (finishIfDone()) return;
    draw();
    frame.say(halted > 0 ? fill(T.play['many-halted'], { n, k: halted }) : fill(T.play.many, { n }));
  }

  /** 손님 한 명이 갈림길마다 주사위를 굴리며 내려간다 */
  function walk(path) {
    const { round } = frame;
    walking = { round, walk: path, step: 0 };
    if (!round.firstOneSaid) {
      round.firstOneSaid = true;
      frame.say(T.play['first-one']);
    }
    draw();
    const tick = () => {
      if (!walking || walking.round !== frame.round) {
        clearTimer();
        return;
      }
      walking.step += 1;
      if (walking.step < walking.walk.cells.length) {
        draw();
        timer = setTimeout(tick, STEP_MS);
        return;
      }
      // 다 내려왔다.
      const { exit } = walking.walk;
      clearTimer();
      flash = exit === null ? T.status.halted : fill(T.status.arrived, { face: T.exits[exit] });
      if (finishIfDone()) return;
      draw();
      frame.say(exit === null ? T.play['one-halted'] : fill(T.play['one-arrived'], { face: T.exits[exit] }));
    };
    timer = setTimeout(tick, STEP_MS);
  }

  /** 실험 판: 출구를 고른 뒤 손님을 모두 100명 넘게 보냈으면 끝낸다 */
  function finishIfDone() {
    const { round } = frame;
    if (round.mode !== 'busy' || round.pick === null || sumOf(round.ends) < FINISH_GUESTS) return false;
    frame.finish('solved');
    return true;
  }

  /** 끝난 실험 판의 "더 많이 해 보기": 손님 100명을 더 보내고, 몇 명이 어디로 갔는지를 다시 말한다 */
  function sendMore() {
    const { round } = frame;
    if (!round || !round.done || round.mode !== 'busy') return;
    const seed = seedFrom(FORMAT, round.id, round.sends.length);
    const result = sendGuests(round.board, FINISH_GUESTS, seed);
    round.sends.push({ n: FINISH_GUESTS, seed });
    round.ends = round.ends.map((value, cell) => value + result.ends[cell]);
    round.moreCount += 1;
    frame.note('more', { n: FINISH_GUESTS, seed });
    frame.keep();
    draw();
    frame.say(busyFacts(round).join(' '));
  }

  // ---- 자물쇠에 수 넣기 ----
  function pressKey(key) {
    const { round } = frame;
    if (!round || round.done || !numberMode(round)) return;
    if (key === 'erase') typed = typed.slice(0, -1);
    else if (typed.length < MAX_DIGITS) typed = typed === '0' ? key : typed + key;
    draw();
  }

  function openLock() {
    const { round, solution } = frame;
    if (!round || round.done || !numberMode(round) || typed === '') return;
    const cell = round.selected;
    if (cell === null || cell === 0 || round.opened.includes(cell) || round.board.blocked.includes(cell)) return;
    const value = Number(typed);
    const result = checkLock(solution.counts, cell, value);
    const again = round.tries.some((item) => item.cell === cell && item.n === value && !item.correct);
    round.tries = [...round.tries, { cell, n: value, correct: result.correct, guess: result.guess }].slice(-MAX_TRIES);
    round.tryCount += 1;
    round.moveCount += 1;
    round.answers.push({ t: frame.stamp(), answer: `${cell}:${value}`, correct: result.correct, guess: result.guess });
    frame.note('answer', { cell, answer: value, correct: result.correct, guess: result.guess });
    typed = '';
    if (!result.correct) {
      // 틀렸다고 하지 않는다. 자물쇠가 그대로라는 사실과 짐작 하나를 말한다. 같은 수를 또 넣었으면 그 사실을 말한다.
      round.wrongCount += 1;
      flash = T.status.still;
      draw();
      frame.persist();
      frame.say(again ? fill(T.play['same-again'], { k: value }) : T.guess[result.guess]);
      return;
    }
    round.opened = [...round.opened, cell].sort((a, b) => a - b);
    flash = T.status.opened;
    if (round.mode === 'count' && leftLocks(round) === 0) {
      frame.finish('solved');
      return;
    }
    round.selected = round.mode === 'count' ? nextAsked(round) : null;
    draw();
    frame.persist();
    frame.say(value === 0 ? T.play['opened-zero'] : fill(T.play.opened, { k: value }));
  }

  // ---- 짝수 칸 칠하기 ----
  function setTool(tool) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'even' || round.tool === tool) return;
    round.tool = tool;
    typed = '';
    flash = null;
    frame.note('tool', { tool });
    draw();
    frame.persist();
    frame.say(T.play[`tool-${tool}`]);
  }

  function checkEven() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'even') return;
    const result = checkPaint(round.board, round.painted);
    round.checks += 1;
    round.moveCount += 1;
    round.answers.push({ t: frame.stamp(), answer: `paint:${round.painted.join('.')}`, correct: result.correct, guess: result.guess });
    frame.note('check', { painted: round.painted.length, correct: result.correct, guess: result.guess });
    if (result.correct) {
      frame.finish('solved');
      return;
    }
    round.failedChecks += 1;
    round.wrongCount += 1;
    flash = T.status['even-again'];
    draw();
    frame.persist();
    frame.say(T.play[result.guess === 'odd' ? 'even-odd' : 'even-miss']);
  }

  // ---- 길 그려 보기 ----
  function togglePaths() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'count') return;
    round.pathsOn = !round.pathsOn;
    if (round.pathsOn) {
      round.pathsShown = true;
      round.pathsCount += 1;
    }
    flash = null;
    frame.note('paths', { on: round.pathsOn });
    draw();
    frame.persist();
  }

  /** 길 위에서 칸을 눌렀다: 바로 아래 칸이면 길이 늘고, 길 위의 칸이면 거기까지로 줄고, 끝 칸을 또 누르면 거기까지 적는다 */
  function drawStep(cell) {
    const { round } = frame;
    const step = stepPath(round.board, round.drawing, cell);
    round.pathTaps += 1;
    if (!step.ok) {
      flash = T.status[step.why === 'blocked' ? 'path-blocked' : 'path-far'];
      draw();
      return;
    }
    if (step.same && round.drawing !== '') {
      addPath(round, round.drawing);
      return;
    }
    round.drawing = step.path;
    const end = pathCell(round.board, step.path);
    if (rowCol(end).r === round.board.rows) {
      addPath(round, step.path);
      return;
    }
    draw();
    frame.persist();
  }

  function addPath(round, path) {
    round.drawing = '';
    if (round.paths.includes(path)) {
      round.dupCount += 1;
      flash = T.status['path-dup'];
      fresh = path;
      frame.note('path', { path, dup: true });
      draw();
      frame.persist();
      if (!round.dupSaid) {
        round.dupSaid = true;
        frame.say(T.play['path-dup']);
      }
      return;
    }
    round.paths = [...round.paths, path];
    round.moveCount += 1;
    fresh = path;
    flash = T.status['path-new'];
    frame.note('path', { path, dup: false });
    draw();
    frame.persist();
  }

  function clearPaths() {
    const { round } = frame;
    if (!round || round.done || round.paths.length === 0) return;
    round.paths = [];
    round.drawing = '';
    fresh = null;
    frame.note('paths-clear');
    draw();
    frame.persist();
  }

  // ---- 끝났을 때 하는 말 ----
  /** 실험의 사실: 손님 몇 명 가운데 어느 출구로 가장 많이 갔는지, 고른 출구에는 몇 명이 갔는지 */
  function busyFacts(round) {
    const tally = exitTally(round.board, round.ends);
    const total = sumOf(round.ends);
    const top = topExits(tally);
    const parts = [
      top.exits.length === 1 ? fill(T.right['busy-top'], { total, face: T.exits[top.exits[0]], k: top.max }) : fill(T.right['busy-tie'], { total, n: top.exits.length, k: top.max }),
    ];
    if (round.pick !== null) parts.push(top.exits.includes(round.pick) ? T.right['busy-mine-top'] : fill(T.right['busy-mine'], { face: T.exits[round.pick], k: tally[round.pick] }));
    return parts;
  }

  /** "왜 그럴까?"가 이 판으로 막 열렸는가 */
  function whyJustOpened(round) {
    const records = frame.records();
    return whyOpen(records) && !whyOpen(records.filter((record) => record.id !== round.id));
  }

  function rightLine(round, solution) {
    let parts;
    if (round.mode === 'busy') {
      parts = busyFacts(round);
      if (!round.side) parts.push(whyJustOpened(round) ? T.right['why-invite'] : T.right['busy-more']);
      return parts;
    }
    if (round.mode === 'even') {
      parts = [fill(T.right.even, { k: solution.evens.length })];
      if (round.failedChecks > 0) parts.push(fill(T.right['even-after'], { n: round.failedChecks }));
    } else {
      const { board } = round;
      if (board.ask === 'target') parts = [fill(T.right.target, { face: T.exits[board.target], k: solution.answer })];
      else if (board.ask === 'exits') parts = [fill(T.right.exits, { k: solution.total })];
      else parts = [T.right.all];
      const askedWrong = round.tries.some((item) => !item.correct && solution.asked.includes(item.cell));
      if (askedWrong) parts.push(T.right['after-retry']);
    }
    if (!round.side && whyJustOpened(round)) parts.push(T.right['why-invite']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, 전부 보여 줘, "왜 그럴까?" ----
  function rowOf(cards, more = '') {
    const row = document.createElement('div');
    row.className = more ? `figure-row ${more}` : 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 그림 한 장의 값(설명과 판 고르기의 그림) */
  function figureView(item) {
    const { board } = item;
    const counts = solutionOf(board).counts;
    const view = { board, exitNames: T.exits, guestText, paths: item.paths ?? [], mark: item.mark ?? null };
    if (item.sends) view.ends = replaySends(board, item.sends);
    if (item.numbers) view.shown = counts.slice();
    else if (board.kind !== 'busy' && item.open) {
      // 판 고르기의 그림: 몇 칸만 열려 있고 나머지는 자물쇠다(길을 그린 그림에는 자물쇠를 그리지 않는다).
      const open = new Set([0, ...item.open]);
      view.shown = counts.map((value, cell) => (open.has(cell) ? value : null));
      view.locked = new Set(lockCells(board).filter((cell) => !open.has(cell)));
    }
    if (item.paint) view.painted = new Set(solutionOf(board).evens);
    if (item.path) view.path = item.path;
    return view;
  }

  /** 표시한 출구까지 가는 모든 길을 한 장씩 그린다("전부 보여 줘") */
  function allPathPages(round, solution) {
    const { board } = round;
    const cell = exitCell(board.rows, board.target);
    const paths = pathsTo(board, cell);
    const cards = paths.map((path, index) => mazeCard({ board, exitNames: T.exits, paths: [path] }, fill(T.solution['path-note'], { no: ordinal(index + 1) })));
    return [{ say: fill(T.solution.paths, { face: T.exits[board.target], k: solution.answer }), nodes: [rowOf(cards, 'mz-strip')] }];
  }

  function solutionPages(round, solution) {
    const { board } = round;
    if (round.mode === 'busy') {
      const ends = sendGuests(board, SOLUTION_GUESTS, seedFrom(FORMAT, round.id, 'solution')).ends;
      const card = mazeCard({ board, exitNames: T.exits, ends, guestText, picked: round.pick }, fill(T.solution['busy-note'], { total: SOLUTION_GUESTS }), { big: true });
      return [{ say: fill(T.solution.busy, { total: SOLUTION_GUESTS }), nodes: [rowOf([card])] }];
    }
    if (board.ask === 'target') return allPathPages(round, solution);
    const shown = solution.counts.slice();
    if (round.mode === 'even') {
      const card = mazeCard({ board, exitNames: T.exits, shown, painted: new Set(solution.evens) }, null, { big: true });
      return [{ say: fill(T.solution.evens, { k: solution.evens.length }), nodes: [rowOf([card])] }];
    }
    return [{ say: T.solution.numbers, nodes: [rowOf([mazeCard({ board, exitNames: T.exits, shown }, null, { big: true })])] }];
  }

  function openAll() {
    const { round, solution } = frame;
    if (!round || !round.done || round.board.ask !== 'target') return;
    round.allCount += 1;
    round.viewedSolution = true;
    frame.note('all');
    frame.keep();
    frame.openSheet({ title: T.allTitle, pages: allPathPages(round, solution) });
  }

  /** "왜 그럴까?": 선생님이 어떻게 알아챘는지의 이야기. 실험 판과 세는 판을 한 번씩 끝까지 한 뒤에 열린다(임시) */
  function whyPages() {
    if (!whyOpen(frame.records())) return null;
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [rowOf(slide.figures.map((item) => mazeCard(figureView(item), item.note)))];
      },
    }));
  }

  // ---- 직접 만들기: 줄 수를 정하고 갈림길을 막는다. 선생님이 길을 세어 주고 손님 100명을 보내 준다. ----
  const draftBoard = () => ({ kind: 'count', rows: draft.rows, blocked: draft.blocked.slice().sort((a, b) => a - b), target: null, ask: 'exits' });

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const ok = saved && Number.isInteger(saved.rows) && saved.rows >= LIMITS.minRows && saved.rows <= LIMITS.maxRows && Array.isArray(saved.blocked) && saved.blocked.every((cell) => blockableCells(saved.rows).includes(cell));
    const from = ok ? saved : FIRST_DRAFT;
    return { rows: from.rows, blocked: from.blocked.slice() };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    draftCounted = false;
    draftEnds = null;
    $('maze-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const board = draftBoard();
    const closed = checkBoard(board) !== null;
    $('maze-make-rows').textContent = fill(T.make.rows, { n: draft.rows });
    $('maze-make-rows-fewer').disabled = draft.rows <= LIMITS.minRows;
    $('maze-make-rows-more').disabled = draft.rows >= LIMITS.maxRows;
    $('maze-make-open-all').disabled = draft.blocked.length === 0;
    const counts = solutionOf(board).counts;
    const blockable = new Set(blockableCells(draft.rows));
    drawMaze($('maze-make-board'), {
      board,
      exitNames: T.exits,
      shown: draftCounted ? counts.map((value, cell) => (board.blocked.includes(cell) ? null : value)) : [],
      ends: draftEnds,
      guestText,
      label: (cell) => (board.blocked.includes(cell) ? T.cellState.blocked : rowCol(cell).r === board.rows ? exitName(rowCol(cell).i) : fill(T.cellLabel, { no: ordinal(rowCol(cell).r + 1), n: ordinal(rowCol(cell).i + 1) })),
      onCell: (cell) => {
        if (!blockable.has(cell)) return;
        changeDraft({ blocked: draft.blocked.includes(cell) ? draft.blocked.filter((item) => item !== cell) : [...draft.blocked, cell] });
      },
    });
    $('maze-make-solve').disabled = closed;
    $('maze-make-send').disabled = closed;
    $('maze-make-play').disabled = closed;
    if (closed) $('maze-make-result').textContent = T.make.closed;
  }

  function changeDraft(change) {
    draft = { ...draft, ...change };
    draft.blocked = draft.blocked.filter((cell) => rowCol(cell).r >= 1 && rowCol(cell).r < draft.rows).sort((a, b) => a - b);
    draftCounted = false;
    draftEnds = null;
    $('maze-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** "선생님, 길을 세어 주세요": 풀이 프로그램으로 칸마다 오는 길을 세어 판에 적는다 */
  function countDraft() {
    const board = draftBoard();
    if (checkBoard(board) !== null) return;
    const result = solve(board);
    draftCounted = true;
    const line = fill(T.make.counted, { k: result.total });
    drawMake();
    $('maze-make-result').textContent = line;
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board: copyBoard(board),
      solution: { possible: true, exits: result.exits, total: result.total },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** "손님 100명 보내기": 만든 판에 손님 100명을 보내 막대를 그린다(누를 때마다 새 손님 100명) */
  function sendDraft() {
    const board = draftBoard();
    if (checkBoard(board) !== null) return;
    draftEnds = sendGuests(board, FINISH_GUESTS, seedFrom(FORMAT, log.newId('g'))).ends;
    const line = fill(T.make.sent, { n: FINISH_GUESTS });
    drawMake();
    $('maze-make-result').textContent = line;
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 풀어 볼 판). 출구로 가는 길이 하나도 없으면 null */
  function madeBoard() {
    const board = draftBoard();
    return checkBoard(board) === null ? board : null;
  }

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('maze-picks').addEventListener('click', (event) => {
    const exit = event.target.closest('button')?.dataset.exit;
    if (exit !== undefined) choose(Number(exit));
  });
  $('maze-send-one').addEventListener('click', () => send(1));
  $('maze-send-many').addEventListener('click', () => send(FINISH_GUESTS));
  $('maze-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.n;
    if (key) pressKey(key);
  });
  $('maze-open').addEventListener('click', openLock);
  $('maze-tools').addEventListener('click', (event) => {
    const tool = event.target.closest('button')?.dataset.tool;
    if (tool) setTool(tool);
  });
  $('maze-check').addEventListener('click', checkEven);
  $('maze-paths').addEventListener('click', togglePaths);
  $('maze-path-clear').addEventListener('click', clearPaths);
  $('maze-more').addEventListener('click', sendMore);
  $('maze-all').addEventListener('click', openAll);
  $('maze-make-rows-fewer').addEventListener('click', () => changeDraft({ rows: draft.rows - 1 }));
  $('maze-make-rows-more').addEventListener('click', () => changeDraft({ rows: draft.rows + 1 }));
  $('maze-make-open-all').addEventListener('click', () => changeDraft({ blocked: [] }));
  $('maze-make-solve').addEventListener('click', countDraft);
  $('maze-make-send').addEventListener('click', sendDraft);
  $('maze-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ board }) {
    const mode = board.kind;
    const start = copyBoard(board);
    const first = mode === 'count' ? (solutionOf(start).asked[0] ?? null) : null;
    return {
      mode,
      board: start, // 판: 줄 수, 막힌 갈림길, 표시한 출구, 열어야 할 칸
      pick: null, // 실험에서 고른 출구. 고르기 전에는 null
      sends: [], // 보낸 손님들 { n, seed }. 같은 시드로 다시 보내면 같은 결과다
      ends: new Array(cellCount(start.rows)).fill(0), // 칸마다 거기서 끝난 손님 수(출구와 막힌 갈림길)
      oneCount: 0, // "손님 1명 보내기"를 누른 수
      manyCount: 0, // "손님 100명 보내기"를 누른 수
      moreCount: 0, // 끝난 뒤 "더 많이 해 보기"를 누른 수
      firstOneSaid: false, // 주사위 눈과 가는 쪽을 선생님이 말했는가(한 판에 한 번)
      selected: first, // 수를 넣을 칸. 세는 판은 열어야 할 첫 칸부터 고른 채로 시작한다
      opened: [], // 열린 자물쇠(맨 위 칸은 처음부터 열려 있어 넣지 않는다)
      tries: [], // 넣어 본 수 { cell, n, correct, guess }
      tryCount: 0,
      wrongCount: 0, // 틀린 수를 넣은 수와 "다 칠했어요"가 맞지 않은 수. 수준 맞추기가 "한 번에"를 본다
      painted: [], // 칠한 칸
      tool: mode === 'even' ? 'paint' : 'number', // 짝수 판에서 칸을 누르면 칠할지, 수를 넣을 칸을 고를지
      checks: 0, // "다 칠했어요"를 누른 수
      failedChecks: 0,
      pathsOn: false, // 길 그려 보기를 켜 두었는가
      pathsShown: false, // 한 번이라도 켰는가
      pathsCount: 0, // 켠 수
      paths: [], // 적은 길들('L'과 'R'의 글자 줄)
      drawing: '', // 그리던 길
      pathTaps: 0,
      dupCount: 0, // 앞에서 적은 길을 또 그린 수
      dupSaid: false,
      blockedTaps: 0, // 막힌 갈림길을 누른 수
      blockedSaid: false,
      allCount: 0, // "전부 보여 줘"를 연 수
      moveCount: 0, // 이 판에서 한 일의 수(손님 보내기, 수 넣기, 칠하기, 길 적기, 다 칠했어요)
    };
  }

  return {
    id: FORMAT,
    T,
    padId: 'maze-pad',
    makeId: 'make-maze',
    /** 판이 위아래로 길어서, 규칙 글을 판 위가 아니라 왼쪽 칸 맨 위에 둔다(판이 놓일 자리를 넓힌다) */
    ruleAside: true,
    homeIds: { sample: 'home-maze-sample', blank: 'home-maze-blank', ask: 'home-maze-ask', play: 'home-maze-play', pick: 'home-maze-pick', make: 'home-maze-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!KINDS.includes(saved.mode) || checkBoard(saved.board) !== null || saved.board.kind !== saved.mode) return false;
      const { board } = saved;
      const cells = cellCount(board.rows);
      if (!Array.isArray(saved.sends) || !saved.sends.every((item) => item && [1, FINISH_GUESTS].includes(item.n) && Number.isInteger(item.seed))) return false;
      if (!Array.isArray(saved.ends) || saved.ends.length !== cells || JSON.stringify(replaySends(board, saved.sends)) !== JSON.stringify(saved.ends)) return false;
      if (saved.pick !== null && !(Number.isInteger(saved.pick) && saved.pick >= 0 && saved.pick <= board.rows)) return false;
      const locks = new Set(lockCells(board));
      if (!Array.isArray(saved.opened) || !saved.opened.every((cell) => locks.has(cell))) return false;
      if (!Array.isArray(saved.painted) || !saved.painted.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < cells)) return false;
      if (saved.selected !== null && !locks.has(saved.selected)) return false;
      if (!Array.isArray(saved.paths) || !saved.paths.every((path) => pathCell(board, path) !== null)) return false;
      if (pathCell(board, saved.drawing) === null || !['paint', 'number'].includes(saved.tool) || !Array.isArray(saved.tries)) return false;
      if (![saved.firstOneSaid, saved.pathsOn, saved.pathsShown, saved.dupSaid, saved.blockedSaid].every((value) => typeof value === 'boolean')) return false;
      const counters = [saved.oneCount, saved.manyCount, saved.moreCount, saved.tryCount, saved.wrongCount, saved.checks, saved.failedChecks, saved.pathsCount, saved.pathTaps, saved.dupCount, saved.blockedTaps, saved.allCount, saved.moveCount];
      if (!counters.every(count)) return false;
      // 열어야 할 칸이 다 열렸거나, 실험에서 고른 뒤 손님을 다 보낸 판은 끝난 판이다.
      if (saved.mode === 'count' && askedCellsLeft(saved) === 0) return false;
      return !(saved.mode === 'busy' && saved.pick !== null && sumOf(saved.ends) >= FINISH_GUESTS);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 길 그려 보기, 끝난 뒤의 단추 둘)을 보이거나 감춘다. 무르기와 되돌리기는 쓰지 않는다 */
    showParts(on) {
      $('maze-board').hidden = !on;
      $('maze-count').hidden = !on;
      if (on) {
        // 이 형식은 틀의 형식 목록에서 맨 뒤라, 앞의 형식이 정해 둔 무르기와 되돌리기를 여기서 다시 감춘다.
        $('undo').hidden = true;
        $('reset').hidden = true;
      } else {
        $('maze-paths').hidden = true;
        $('maze-path-box').hidden = true;
        $('maze-more').hidden = true;
        $('maze-all').hidden = true;
      }
    },
    enter: forget,
    draw,
    ended: forget,
    ruleLine: (round) => T.rules[round.custom ? 'exits' : rungOf(round.level).hint],
    hints: (round) => T.hints[round.custom ? 'exits' : rungOf(round.level).hint],
    touched: (round) => round.moveCount > 0 || round.pick !== null || round.tries.length > 0 || round.paths.length > 0 || round.painted.length > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view: (round) => ({ mode: round.mode, pick: round.pick, sent: sumOf(round.ends), opened: round.opened.slice(), painted: round.painted.slice(), paths: round.paths.length, selected: round.selected }),
    /** 이 판보다 작은 판: 같은 종류에서 갈림길의 줄을 줄인 판 */
    smaller: (round, turn) => smallerMaze({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const base = {
        mode: round.mode,
        board: copyBoard(round.board),
        // 출구마다 오는 길의 수, 출구로 가는 길의 모두, 길이 가장 많은 출구, 표시한 출구의 답, 짝수 칸의 수
        solution: { possible: true, exits: solution.exits, total: solution.total, busiest: solution.busiest, answer: solution.answer, evens: solution.evens.length },
        moveCount: round.moveCount,
        wrongCount: round.wrongCount,
      };
      const guests = {
        sends: round.sends,
        sent: sumOf(round.ends),
        tally: exitTally(round.board, round.ends),
        halted: round.board.blocked.map((cell) => round.ends[cell]),
        oneCount: round.oneCount,
        manyCount: round.manyCount,
      };
      if (round.mode === 'busy') {
        return {
          ...base,
          ...guests,
          // 고른 출구와, 그것이 길이 가장 많은 출구였는가(화면에는 알리지 않는다)
          pick: round.pick,
          pickBusiest: round.pick !== null && solution.busiest.includes(round.pick),
          top: topExits(exitTally(round.board, round.ends)).exits,
          moreCount: round.moreCount,
          // 실험은 고르기에 틀린 답이 없다. 수준 맞추기는 걸린 시간만 본다
          wrongCount: 0,
        };
      }
      const work = {
        opened: round.opened,
        tries: round.tries,
        tryCount: round.tryCount,
        pathsShown: round.pathsShown,
        pathsCount: round.pathsCount,
        paths: round.paths,
        dupCount: round.dupCount,
        blockedTaps: round.blockedTaps,
        allCount: round.allCount,
      };
      if (round.mode === 'even') return { ...base, ...work, painted: round.painted, checks: round.checks, failedChecks: round.failedChecks, tool: round.tool };
      return { ...base, ...work, ...(guestsOn(round) ? guests : {}) };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo() {},
    reset() {},
    /** 글자판이 있는 기기에서는 숫자를 쳐서 넣을 수도 있다. */
    onKey(event) {
      const { round } = frame;
      if (!round || !numberMode(round) || $('maze-pad').hidden) return;
      if (/^[0-9]$/.test(event.key)) pressKey(event.key);
      else if (event.key === 'Backspace') pressKey('erase');
      else if (event.key === 'Enter' && typed !== '') openLock();
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).hint],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      // 작은 그림에는 손님 막대를 그리지 않는다(세모가 작아지지 않게).
      drawMaze(root, { ...viewOf({ ...begin({ board }), done: true }), ends: null, small: true });
    },
    drawBlank(root) {
      drawMaze(root, { board: BLANK, exitNames: T.exits, small: true });
    },
    drawResume(root, saved) {
      drawMaze(root, { ...viewOf({ ...saved, done: true }), small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) drawMaze(root, { board: BLANK, exitNames: T.exits, small: true });
      else drawMaze(root, { ...figureView(picture), small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판. 출구로 가는 길이 하나도 없으면 null(공책에 남기기가 쓴다) */
    madeBoard,
  };

  /** 적어 둔 판에서 아직 안 열린, 열어야 할 칸의 수 */
  function askedCellsLeft(saved) {
    return solutionOf(saved.board).asked.filter((cell) => !saved.opened.includes(cell)).length;
  }
}

