// 탑 옮기기: 판 화면에서 이 형식이 맡는 부분(판, 기둥 누르기와 끌기, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/tower.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 기둥을 누르면 맨 위 원판을 들어 올리고, 다른 기둥을 누르면 내려놓는다(같은 기둥을 다시 누르면 제자리에 내려놓는다).
// 한 기둥에서 다른 기둥까지 끌어도 옮겨진다(src/ui/tower-board.js). 큰 원판을 작은 원판 위에 놓으려 하면 옮기지 않고 그 사실을 말한다.
// 옮긴 횟수는 늘 판 아래에 적는다.
// 판의 종류(mode)
//   move     탑 옮겨 보기(1단계). 탑을 모두 깃발 기둥으로 옮기면 끝난다
//   fewest   가장 적게 옮기기(2단계, 기록 깨기). 가장 적은 횟수로 다 쌓으면 끝난다. 더 많이 옮겨 쌓으면 틀렸다고 하지 않고
//            횟수를 말한 뒤 "더 적게 옮길 수 있을까요?"라고 묻는다. 가장 적은 횟수는 판이 끝나기 전에 말하지 않는다.
//            "처음 모습으로 다시 해 볼래요"와 "여기까지 할래요"를 고를 수 있다
//   table    표 만들기(3단계). 원판 1개부터 board.n개까지 아이가 스스로 다 쌓은 횟수를 표에 적는다(선생님이 미리 채우지 않는다).
//            가장 적은 횟수로 쌓은 칸은 굳고, 더 많이 옮긴 칸은 점선 칸으로 남아 더 적게 해 볼지 묻는다.
//            표가 다 차면 원판 board.n + 1개와 + 2개가 몇 번일지 짐작을 적는다(맞다 틀리다 하지 않는다). 그다음 선생님이 따진 수를 보여 주고 끝난다
//   which    몇 번째에 어느 원판?(4단계). 가장 적게 옮길 때 board.ask번째에 움직이는 원판을 고른다. 판에서 옮겨 보아도 되고(옮긴 원판의 줄이 남는다),
//            바로 골라도 된다. 고른 원판이 아니면 그 원판은 그때 움직이지 않는다는 사실만 말한다. 맞는 원판을 고르면 끝난다
//   spread   흩어진 탑(5단계, 기록 깨기). 가장 적게 옮기기와 같다
//   made     직접 만든 판. 가장 적게 옮기기와 같다
// 모든 판은 다 쌓을 수 있다. 그래서 "불가능해요" 단추가 없다.
// "한 번 무르기"는 옮기기 하나를, "처음으로 되돌리기"는 처음 모습으로 돌아간다. 둘 다 횟수를 화면에 적지 않는다.
import T from '../content/tower.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, guessSizes, nextSeed, recordMode, rungOf, tableSizes } from '../core/tower-ladder.js';
import { MAKE_MAX, MIN_DISCS, checkBoard, copyBoard, fewestFrom, fewestRows, isDone, isTower, moveOf, moveProblem, movedDiscs, onPath, replay, solve, stacksOf, standardBoard, topOf, worstOf } from '../core/tower.js';
import { smallerTower } from '../core/smaller.js';
import { fill } from '../core/text.js';
import { drawTower, moveStrip, recordGrid, stageStrip, towerTable } from '../ui/tower-board.js';

const FORMAT = 'tower';
const MODES = ['move', 'fewest', 'table', 'which', 'spread', 'made'];
/** 기록에 남기는 무르기 차례의 위 끝 */
const MAX_HISTORY = 300;
/** 풀이 한 장에 그리는 옮기기의 수 */
const PER_PAGE = 8;
/** 짐작으로 적을 수 있는 수의 자릿수 */
const GUESS_DIGITS = 3;
/** 직접 만들기의 처음 판: 원판 4개가 왼쪽 기둥에 */
const firstDraft = () => standardBoard(4, 2);

const count = (value) => Number.isInteger(value) && value >= 0;
const isMove = (move) => Array.isArray(move) && move.length === 2 && move.every((peg) => Number.isInteger(peg) && peg >= 0 && peg <= 2);

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createTower(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let held = null; // 원판을 들어 올린 기둥(판에만 있다. 기록하지 않는다)
  let landed = 0; // 방금 내려놓은 원판(판을 한 번 그릴 때 그 움직임을 보이고 지운다)
  let typed = ''; // 짐작 칸에 넣고 있는 수
  let draft = null; // 직접 만들기에서 만들던 판
  let made = null; // 직접 만들기에서 선생님이 따진 것(판을 고치면 지운다)
  let shown = null; // 직접 만들기에서 선생님이 옮겨 보이는 중이면 { moves }

  const isRecord = (round) => recordMode(round.mode);
  /** 규칙 글과 힌트의 이름. 직접 만든 판은 탑이면 가장 적게 옮기기, 흩어져 있으면 흩어진 탑과 같다 */
  const ruleKey = (round) => (round.mode === 'made' ? (isTower(round.board) ? 'fewest' : 'spread') : round.mode);

  /** 한 번 푼 판은 적어 둔다 */
  const memo = new Map();
  function solutionOf(board) {
    const key = JSON.stringify(copyBoard(board));
    if (!memo.has(key)) memo.set(key, solve(board));
    return memo.get(key);
  }

  /** 지금 해 보는 판: 표 만들기는 지금 원판 수의 탑, 나머지는 판 그대로 */
  const playBoard = (round) => (round.mode === 'table' ? standardBoard(round.size, round.board.target) : round.board);
  /** 지금 모습 */
  const stateOf = (round) => replay(playBoard(round), round.moves) ?? playBoard(round).start.slice();
  const fewestOfSize = (round, n) => fewestFrom(new Array(n).fill(0), round.board.target);
  /** 표 만들기: 표가 다 찼는가(모든 칸이 가장 적은 횟수로 굳었다) */
  const tableFull = (round) => round.mode === 'table' && round.rows.every((row) => row.settled);
  /** 표 만들기: 짐작을 적는 중인가 */
  const guessing = (round) => tableFull(round) && round.guesses.length < guessSizes(round.board).length;

  // ---- 이름표 ----
  const pegName = (round, peg) => fill(peg === round.board.target ? T.labels.flag : T.labels.name, { face: T.labels.pegs[peg] });
  function labelOf(round, pos) {
    return (peg) => {
      const face = pegName(round, peg);
      const stack = stacksOf(pos)[peg];
      if (peg === held) return fill(T.labels.holding, { face, k: topOf(pos, peg) });
      if (stack.length === 0) return fill(T.labels.peg, { face, n: 0 });
      return fill(T.labels.top, { face, n: stack.length, k: stack.at(-1) });
    };
  }

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const playing = !round.done;
    const pos = stateOf(round);
    const done = isDone(pos, round.board.target);
    const record = isRecord(round);
    const asking = guessing(round);
    const live = playing && !asking && !(done && round.mode !== 'table');
    if (!live) held = null;
    drawTower($('tower-board'), {
      pos,
      target: round.board.target,
      held,
      landed,
      names: T.labels.pegs,
      label: labelOf(round, pos),
      onPeg: live ? tapPeg : undefined,
      onDrag: live ? dragDisc : undefined,
      extra: round.mode === 'table' ? tableNode(round) : null,
    });
    landed = 0;
    $('tower-moves').textContent = String(round.moves.length);
    $('tower-best-line').hidden = !(record && round.best !== null);
    $('tower-best').textContent = round.best === null ? '' : String(round.best);
    $('tower-status').textContent = flash ?? statusOf(round, pos, playing);
    $('undo').disabled = !playing || asking || round.history.length === 0;
    $('reset').disabled = !playing || asking || round.moves.length === 0;
    $('tower-again').hidden = !(playing && record && done);
    $('tower-stop').hidden = !(playing && record && round.best !== null);
    // 오른쪽 칸: 옮기는 법 → (표 만들기) 원판 수, 짐작 → (몇 번째) 물음, 고르기, 옮긴 원판의 줄
    $('tower-help').hidden = asking || (round.mode === 'which' && round.moveCount > 0);
    $('tower-size-box').hidden = !(round.mode === 'table' && !asking && playing);
    if (round.mode === 'table') drawSizes(round);
    $('tower-guess-box').hidden = !(playing && asking);
    if (asking) drawGuess(round);
    $('tower-which-box').hidden = round.mode !== 'which';
    if (round.mode === 'which') drawWhich(round, playing);
    frame.showWhy();
  }

  function statusOf(round, pos, playing) {
    if (!playing) return '';
    if (guessing(round)) return T.status.guess;
    if (held !== null) return fill(T.status.held, { k: topOf(pos, held) });
    if (isDone(pos, round.board.target)) return T.status.done;
    if (round.mode === 'which' && round.moves.length === 0) return T.status.which;
    if (round.moves.length === 0) return T.status.begin;
    return '';
  }

  /** 표 만들기의 원판 수 단추 */
  function drawSizes(round) {
    for (const button of $('tower-sizes').querySelectorAll('button')) {
      const n = Number(button.dataset.n);
      button.hidden = n > round.board.n;
      button.setAttribute('aria-pressed', String(n === round.size));
    }
  }

  /** 표: 원판 수마다 아이가 가장 적게 옮긴 횟수(굳은 칸과 점선 칸), 그 아래 두 줄은 짐작과(끝나면) 선생님이 따진 수 */
  function tableNode(round) {
    const times = (k) => fill(T.table.times, { k });
    const rows = round.rows.map((row, index) => {
      const n = index + 1;
      const cell = row.best === null ? '' : row.settled ? times(row.best) : { text: fill(T.table.open, { k: row.best }), open: true };
      return [fill(T.table.count, { n }), cell, ''];
    });
    guessSizes(round.board).forEach((n, index) => {
      const guess = round.guesses[index];
      const mine = guess === undefined ? '' : guess === null ? T.table.unknown : times(guess);
      const shownCount = round.done && round.guesses.length === guessSizes(round.board).length ? times(fewestOfSize(round, n)) : '';
      rows.push([fill(T.table.count, { n }), shownCount, mine]);
    });
    const now = guessing(round) ? round.board.n + round.guesses.length : round.size - 1;
    return towerTable(T.table.head, rows, round.done ? -1 : now);
  }

  function drawGuess(round) {
    const n = guessSizes(round.board)[round.guesses.length];
    $('tower-guess-ask').textContent = fill(T.table.ask, { n });
    $('tower-typed').textContent = typed;
    $('tower-guess-note').disabled = typed.length === 0;
  }

  /** 몇 번째에 어느 원판?: 물음, 원판 고르기(골랐던 원판은 다시 누를 수 없다), 옮긴 원판의 줄 */
  function drawWhich(round, playing) {
    $('tower-which-ask').textContent = fill(T.which.ask, { k: round.board.ask });
    const buttons = Array.from({ length: round.board.n }, (_, index) => {
      const disc = index + 1;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn tw-pick';
      button.textContent = fill(T.labels.disc, { n: disc });
      button.disabled = !playing || round.picks.includes(disc);
      if (round.picks.includes(disc)) button.classList.add('tried');
      button.addEventListener('click', () => pickDisc(disc));
      return button;
    });
    $('tower-which-choices').replaceChildren(...buttons);
    const discs = movedDiscs(round.board, round.moves) ?? [];
    $('tower-record-box').replaceChildren(recordGrid(discs, { label: (step, disc) => fill(T.labels.chip, { k: step, n: disc }) }));
  }

  // ---- 옮기기 ----
  /** 기둥을 눌렀다: 들어 올린 원판이 없으면 맨 위 원판을 들고, 있으면 그 기둥에 내려놓는다 */
  function tapPeg(peg) {
    const { round } = frame;
    if (!round || round.done || guessing(round)) return;
    const pos = stateOf(round);
    flash = null;
    if (held === null) {
      if (topOf(pos, peg) === 0) {
        flash = T.status.empty;
        draw();
        return;
      }
      held = peg;
      frame.note('lift', { peg });
      draw();
      return;
    }
    if (peg === held) {
      // 같은 기둥: 제자리에 내려놓는다
      flash = fill(T.status.down, { k: topOf(pos, peg) });
      held = null;
      draw();
      return;
    }
    const from = held;
    held = null;
    tryMove(from, peg);
  }

  /** 한 기둥에서 다른 기둥까지 끌었다 */
  function dragDisc(from, to) {
    const { round } = frame;
    if (!round || round.done || guessing(round)) return;
    held = null;
    flash = null;
    if (topOf(stateOf(round), from) === 0) return;
    tryMove(from, to);
  }

  function tryMove(from, to) {
    const { round } = frame;
    const pos = stateOf(round);
    const problem = moveProblem(pos, from, to);
    if (problem !== null) {
      if (problem.why === 'bigger') {
        // 옮기지 않는다. 원판은 제자리로 돌아가고, 사실 하나와 할 수 있는 일 하나를 말한다
        round.refuseCount += 1;
        frame.note('refuse', { from, to, disc: problem.disc, onto: problem.onto });
        flash = fill(T.status.bigger, { k: problem.disc, n: problem.onto });
        draw();
        frame.persist();
        frame.say(fill(T.play.bigger, { k: problem.disc, n: problem.onto }));
        return;
      }
      draw();
      return;
    }
    const board = playBoard(round);
    const wasOn = round.mode === 'which' && onPath(board, round.moves, solutionOf(board).path);
    const last = round.moves.at(-1);
    const disc = topOf(pos, from);
    round.history = [...round.history, round.moves.slice()].slice(-MAX_HISTORY);
    round.moves = [...round.moves, [from, to]];
    round.moveCount += 1;
    landed = disc;
    frame.note('move', { from, to, disc });
    const next = moveOf(pos, from, to);
    if (isDone(next, round.board.target) && round.mode !== 'which') {
      complete();
      return;
    }
    let said = null;
    if (last && last[0] === to && last[1] === from) {
      round.backCount += 1;
      said = T.play.back;
    } else if (wasOn && !onPath(board, round.moves, solutionOf(board).path)) said = T.play.off;
    draw();
    frame.persist();
    if (said) frame.say(said);
  }

  /** 다 쌓았다 */
  function complete() {
    const { round, solution } = frame;
    const k = round.moves.length;
    if (round.mode === 'table') {
      settleRow(round, k);
      return;
    }
    const before = round.best;
    round.completions.push(k);
    if (before === null || k < before) {
      round.best = k;
      round.bestMoves = round.moves.slice();
    }
    const fewest = !isRecord(round) || k === solution.fewest;
    const guess = fewest ? null : 'more-than-fewest';
    round.answers.push({ t: frame.stamp(), answer: `done:${k}`, correct: fewest, guess });
    frame.note('answer', { answer: `done:${k}`, correct: fewest, guess });
    if (fewest) {
      frame.finish('solved');
      return;
    }
    // 틀렸다고 하지 않는다. 횟수를 말하고 더 적게 옮길 수 있을지 묻는다. 가장 적은 횟수는 말하지 않는다.
    round.wrongCount += 1;
    draw();
    frame.persist();
    if (before !== null && k === before) frame.say(fill(T.play.same, { k }));
    else frame.say(fill(before !== null && k < before ? T.play['fewer-up'] : T.play.fewer, { k }));
  }

  /** 표 만들기에서 한 탑을 다 쌓았다: 표에 적고, 가장 적은 횟수면 칸이 굳는다. 다음 탑은 처음 모습에서 시작한다 */
  function settleRow(round, k) {
    const n = round.size;
    const row = round.rows[n - 1];
    const before = row.best;
    row.completions.push(k);
    if (before === null || k < before) row.best = k;
    const fewest = fewestOfSize(round, n);
    row.settled = row.best === fewest;
    const settledNow = k === fewest;
    const guess = settledNow ? null : 'more-than-fewest';
    round.answers.push({ t: frame.stamp(), answer: `done:${n}:${k}`, correct: settledNow, guess });
    frame.note('answer', { answer: `done:${n}:${k}`, correct: settledNow, guess });
    if (!settledNow) round.wrongCount += 1;
    round.moves = [];
    round.history = [];
    let line;
    if (settledNow) line = fill(T.table.settled, { n, k });
    else if (before !== null && k === before) line = fill(T.table.same, { n, k });
    else line = fill(T.table.more, { n, k });
    if (row.settled) {
      const open = round.rows.findIndex((item) => !item.settled);
      if (open === -1) {
        line = `${line} ${fill(T.table.full, { n: round.board.n, k: round.board.n + 1 })}`;
        typed = '';
      } else {
        round.size = open + 1;
        flash = fill(T.status.next, { n: round.size });
      }
    }
    draw();
    frame.persist();
    frame.say(line);
  }

  /** 표 만들기: 원판 수를 바꾼다(그 수의 탑을 처음 모습부터) */
  function setSize(n) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'table' || guessing(round)) return;
    if (!Number.isInteger(n) || n < 1 || n > round.board.n || n === round.size) return;
    round.size = n;
    round.moves = [];
    round.history = [];
    held = null;
    flash = null;
    frame.note('size', { n });
    draw();
    frame.persist();
    frame.say(fill(T.play.size, { n }));
  }

  /** 짐작 칸에 수를 넣는다 */
  function typeKey(key) {
    const { round } = frame;
    if (!round || round.done || !guessing(round)) return;
    if (key === 'erase') typed = typed.slice(0, -1);
    else if (/^\d$/.test(key) && typed.length < GUESS_DIGITS && !(typed === '' && key === '0')) typed += key;
    draw();
  }

  /** 짐작을 적는다(모르겠어요는 null). 둘 다 적으면 선생님이 따진 수를 보여 주고 끝난다. 맞다 틀리다 하지 않는다 */
  function noteGuess(value) {
    const { round } = frame;
    if (!round || round.done || !guessing(round)) return;
    const sizes = guessSizes(round.board);
    const n = sizes[round.guesses.length];
    round.guesses = [...round.guesses, value];
    typed = '';
    round.answers.push({ t: frame.stamp(), answer: `guess:${n}:${value ?? 'unknown'}`, correct: null, guess: 'guess' });
    frame.note('guess', { n, value });
    if (round.guesses.length < sizes.length) {
      draw();
      frame.persist();
      frame.say(fill(T.table.noted, { n: sizes[round.guesses.length] }));
      return;
    }
    frame.finish('solved');
  }

  /** 몇 번째에 어느 원판?: 원판을 골랐다 */
  function pickDisc(disc) {
    const { round, solution } = frame;
    if (!round || round.done || round.mode !== 'which' || round.picks.includes(disc)) return;
    round.picks = [...round.picks, disc];
    const correct = disc === solution.answer;
    round.answers.push({ t: frame.stamp(), answer: `disc:${disc}`, correct, guess: correct ? null : 'other-disc' });
    frame.note('answer', { answer: `disc:${disc}`, correct });
    if (correct) {
      frame.finish('solved');
      return;
    }
    round.wrongCount += 1;
    draw();
    frame.persist();
    frame.say(fill(T.which.not, { k: round.board.ask, n: disc }));
  }

  /** 가장 적게 옮기는 판에서 "처음 모습으로 다시 해 볼래요" */
  function again() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    round.history = [...round.history, round.moves.slice()].slice(-MAX_HISTORY);
    round.moves = [];
    round.retryCount += 1;
    held = null;
    flash = null;
    frame.note('again');
    draw();
    frame.persist();
    frame.say(T.play.again);
  }

  /** 가장 적게 옮기는 판에서 "여기까지 할래요": 지금까지 가장 적게 옮긴 것으로 판을 끝낸다. 이것도 끝까지 한 판이다 */
  function stop() {
    const { round } = frame;
    if (round.done || round.best === null) return;
    round.stopped = true;
    frame.note('stop', { best: round.best });
    frame.finish('solved');
  }

  /** 한 번 무르기(처음으로 되돌린 것도 무를 수 있다) */
  function undo() {
    const { round } = frame;
    if (round.done || round.history.length === 0 || guessing(round)) return;
    round.moves = round.history.at(-1).slice();
    round.history = round.history.slice(0, -1);
    round.undoCount += 1;
    held = null;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 옮기기에 한 말(되돌렸어요, 몇 번에 쌓았어요, 차례가 달라졌어요)은 이제 맞지 않으니 덮는다
    frame.say(T.play.undo);
  }

  /** 처음으로: 처음 모습으로 돌아간다. 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (round.done || round.moves.length === 0 || guessing(round)) return;
    round.history = [...round.history, round.moves.slice()].slice(-MAX_HISTORY);
    round.moves = [];
    round.resetCount += 1;
    held = null;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    if (round.mode === 'table') {
      const [first, second] = guessSizes(round.board);
      return [
        fill(T.right.table, { n: round.board.n }),
        fill(T.table.reveal, { n: first, k: fewestOfSize(round, first) }),
        fill(T.table['reveal-next'], { n: second, k: fewestOfSize(round, second) }),
        T.right['table-guess'],
      ];
    }
    if (round.mode === 'which') {
      const parts = [fill(T.right.which, { k: round.board.ask, n: solution.answer })];
      if (round.picks.length > 1) parts.push(fill(T.right['which-first'], { n: round.picks[0] }));
      return parts;
    }
    if (isRecord(round)) {
      if (round.stopped) return [fill(T.right.stopped, { k: round.best })];
      const parts = [fill(T.right.fewest, { k: solution.fewest })];
      if (round.completions.length > 1) parts.push(fill(T.right['fewest-after'], { n: round.completions[0] }));
      return parts;
    }
    const back = round.undoCount + round.resetCount;
    return [fill(T.right.done, { k: round.moves.length }), back === 0 ? T.right.clean : fill(T.right.back, { n: back })];
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  const caption = (step, disc) => fill(T.solution.caption, { k: step, n: disc });

  /** 옮기는 차례를 여러 장에 나눠 그린다(한 장에 여덟 번씩. 한 장씩 넘겨 본다) */
  function pathPages(board, path, firstSay) {
    const pages = [];
    for (let at = 0; at < Math.max(path.length, 1); at += PER_PAGE) {
      const before = replay(board, path.slice(0, at));
      pages.push({
        say: at === 0 ? firstSay : fill(T.solution.more, { k: at + 1 }),
        nodes: [moveStrip(before, board.target, path.slice(at, at + PER_PAGE), { caption, first: at + 1, showStart: true, startCaption: at === 0 ? T.solution.start : '' })],
      });
    }
    return pages;
  }

  /**
   * 원판 수마다 가장 적게 옮기는 횟수의 표(풀이 프로그램이 그 자리에서 따진다).
   * ways가 있으면(마지막 장) 원판 수 다음 칸에 대본에 적어 둔 짧은 식을 넣는다. 식이 맞는지는 테스트가 따진다
   */
  function fewestNode(sizes, ways = null) {
    const rows = fewestRows(sizes).map((row, index) => [fill(T.table.count, { n: row.n }), ...(ways ? [ways.cells[index]] : []), fill(T.table.times, { k: row.fewest })]);
    return towerTable([...T.table.head.slice(0, 1), ...(ways ? [ways.head] : []), T.solution['table-head']], rows);
  }

  function solutionPages(round, solution) {
    if (round.mode === 'table') {
      const sizes = [...tableSizes(round.board), ...guessSizes(round.board)];
      return [{ say: T.solution.table, nodes: [fewestNode(sizes)] }];
    }
    if (round.mode === 'which') {
      const say = fill(T.solution.which, { k: round.board.ask, n: solution.answer });
      return [{ say, nodes: [recordGrid(solution.discs, { mark: round.board.ask, label: (step, disc) => fill(T.labels.chip, { k: step, n: disc }) })] }];
    }
    return pathPages(round.board, solution.path, fill(T.solution.path, { k: solution.fewest }));
  }

  /** 그림 아래의 한 줄 */
  function withNote(node, note) {
    const box = document.createElement('div');
    box.className = 'tw-figure';
    const text = document.createElement('p');
    text.className = 'strip-note';
    text.textContent = note;
    box.append(node, text);
    return box;
  }

  /**
   * "왜 그럴까?": 가장 큰 원판이 움직이는 순간 → 두 배 하고 1 더하기(이름) → 원판 수마다의 표 → 옮긴 원판의 차례 → 흩어진 탑에서는 그대로 나오지 않는다
   * → 짧게 적기(2를 원판 수만큼 곱하고 1 빼기, 2의 n제곱. 수학의 이름은 이 마지막 장에만)
   */
  function whyPages(round) {
    // 표 만들기에서 짐작을 적기 전에는 열지 않는다(셋째 장의 표에 짐작할 수가 적혀 있다)
    if (round?.mode === 'table' && !round.done) return null;
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return slide.figures.map((item) => {
          if (item.sizes) return withNote(fewestNode(item.sizes, item.ways ? { head: item.head, cells: item.ways } : null), item.note);
          if (item.record) {
            const { discs } = solve(standardBoard(item.record, 2));
            return withNote(recordGrid(discs, { width: item.width, mark: item.mark, label: (step, disc) => fill(T.labels.chip, { k: step, n: disc }) }), item.note);
          }
          if (item.stages) return stageStrip(item.stages, item.target, item.steps.map((k) => fill(T.table.times, { k })), item.note);
          if (item.board) return moveStrip(item.board.start, item.board.target, solve(item.board).path, { caption, note: item.note, startCaption: T.solution.start });
          const picture = document.createElement('div');
          drawTower(picture, { pos: item.pos, target: item.target, small: true, numbers: true });
          picture.className += ' tw-why-picture';
          return withNote(picture, item.note);
        });
      },
    }));
  }

  // ---- 직접 만들기: 원판 수와 깃발 기둥을 정하고, 원판마다 꽂을 기둥을 고른다 ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    if (saved && checkBoard(saved) === null && saved.n <= MAKE_MAX && saved.ask === undefined) return copyBoard(saved);
    return firstDraft();
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    shown = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const { n, target } = draft;
    $('tower-make-n').textContent = fill(T.make.size, { n });
    $('tower-make-fewer').disabled = n <= MIN_DISCS;
    $('tower-make-more').disabled = n >= MAKE_MAX;
    for (const button of $('tower-make-target').querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.peg) === target));
    // 원판마다 기둥 고르기(작은 원판이 위에)
    const rows = draft.start.map((peg, index) => {
      const disc = index + 1;
      const row = document.createElement('div');
      row.className = 'tw-make-row';
      const name = document.createElement('span');
      name.className = 'tw-make-name';
      name.textContent = String(disc);
      name.setAttribute('aria-label', fill(T.labels.disc, { n: disc }));
      row.append(name);
      for (let choice = 0; choice < 3; choice++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn';
        button.textContent = T.labels.pegs[choice];
        button.setAttribute('aria-label', `${fill(T.labels.disc, { n: disc })}, ${fill(T.labels.name, { face: T.labels.pegs[choice] })}`);
        button.setAttribute('aria-pressed', String(peg === choice));
        button.addEventListener('click', () => placeDisc(disc, choice));
        row.append(button);
      }
      return row;
    });
    $('tower-make-discs').replaceChildren(...rows);
    const pos = shown ? replay(draft, shown.moves) : draft.start;
    drawTower($('tower-make-board'), { pos, target, landed: shown?.landed ?? 0, names: T.labels.pegs, label: (peg) => pegName({ board: draft }, peg) });
    if (shown) shown.landed = 0;
    $('tower-make-result').textContent = made ? made.line : '';
    $('tower-make-step').disabled = !made || !shown || shown.moves.length >= made.path.length;
    $('tower-make-back').disabled = !shown || shown.moves.length === 0;
  }

  function changeDraft(next) {
    if (checkBoard(next) !== null || next.n > MAKE_MAX) return;
    draft = copyBoard(next);
    made = null;
    shown = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 원판 하나를 다른 기둥에 꽂는다(한 기둥의 원판은 늘 큰 것이 아래로 놓인다) */
  function placeDisc(disc, peg) {
    const start = draft.start.slice();
    start[disc - 1] = peg;
    changeDraft({ n: draft.n, start, target: draft.target });
  }

  /** 원판 수를 바꾼다. 늘리면 가장 큰 새 원판을 왼쪽 기둥 맨 아래에 꽂고, 줄이면 가장 큰 원판을 뺀다 */
  function resize(n) {
    if (n < MIN_DISCS || n > MAKE_MAX) return;
    const start = n > draft.n ? [...draft.start, ...new Array(n - draft.n).fill(0)] : draft.start.slice(0, n);
    changeDraft({ n, start, target: draft.target });
  }

  function setTarget(peg) {
    if (peg === draft.target) return;
    changeDraft({ n: draft.n, start: draft.start.slice(), target: peg });
  }

  /** "모두 왼쪽에 쌓기": 탑을 왼쪽 기둥에(깃발이 왼쪽이면 오른쪽으로 옮긴다) */
  function clearAll() {
    changeDraft(standardBoard(draft.n, draft.target === 0 ? 2 : draft.target));
  }

  /** 아이가 만든 판을 풀이 프로그램으로 따져서 알려 준다. 가장 적은 횟수를 말하고, 한 번씩 옮겨 보일 수 있게 한다 */
  function solveDraft() {
    const board = copyBoard(draft);
    if (isDone(board.start, board.target)) {
      made = null;
      shown = null;
      drawMake();
      frame.talkers.make.say(T.make.already);
      return;
    }
    const result = solve(board);
    const worst = result.fewest === worstOf(board.n, board.target).worst;
    const line = worst ? `${fill(T.make.fewest, { k: result.fewest })} ${fill(T.make.worst, { n: board.n })}` : fill(T.make.fewest, { k: result.fewest });
    made = { line, path: result.path };
    shown = { moves: [], landed: 0 };
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
      solution: { possible: true, fewest: result.fewest, path: result.path, worst },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 선생님이 가장 적게 옮기는 길을 한 번 옮겨 보인다(누를 때마다 한 번. 스스로 넘어가지 않는다) */
  function stepShown() {
    if (!made || !shown || shown.moves.length >= made.path.length) {
      if (!made) frame.talkers.make.say(T.make['ask-first']);
      return;
    }
    const move = made.path[shown.moves.length];
    const pos = replay(draft, shown.moves);
    const disc = topOf(pos, move[0]);
    shown.moves = [...shown.moves, move];
    shown.landed = disc;
    drawMake();
    const step = shown.moves.length;
    frame.talkers.make.say(step === made.path.length ? `${fill(T.make.step, { k: step, n: disc })} ${fill(T.make.finished, { k: step })}` : fill(T.make.step, { k: step, n: disc }));
  }

  function backShown() {
    if (!shown || shown.moves.length === 0) return;
    shown = { moves: [], landed: 0 };
    drawMake();
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판): 아직 다 쌓이지 않은 판 */
  const madeBoard = () => (draft && checkBoard(draft) === null && !isDone(draft.start, draft.target) ? copyBoard(draft) : null);

  function playDraft() {
    const board = madeBoard();
    if (!board) {
      frame.talkers.make.say(T.make['keep-not-yet']);
      return;
    }
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('tower-again').addEventListener('click', again);
  $('tower-stop').addEventListener('click', stop);
  $('tower-sizes').addEventListener('click', (event) => {
    const value = event.target.closest('button')?.dataset.n;
    if (value) setSize(Number(value));
  });
  $('tower-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.n;
    if (key) typeKey(key);
  });
  $('tower-guess-note').addEventListener('click', () => {
    if (typed.length > 0) noteGuess(Number(typed));
  });
  $('tower-guess-skip').addEventListener('click', () => noteGuess(null));
  $('tower-make-fewer').addEventListener('click', () => resize(draft.n - 1));
  $('tower-make-more').addEventListener('click', () => resize(draft.n + 1));
  $('tower-make-target').addEventListener('click', (event) => {
    const value = event.target.closest('button')?.dataset.peg;
    if (value !== undefined) setTarget(Number(value));
  });
  $('tower-make-clear').addEventListener('click', clearAll);
  $('tower-make-solve').addEventListener('click', solveDraft);
  $('tower-make-step').addEventListener('click', stepShown);
  $('tower-make-back').addEventListener('click', backShown);
  $('tower-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    const mode = custom ? 'made' : rungOf(level).mode;
    return {
      mode,
      board: copyBoard(board), // 판: 원판 수, 처음 모습(원판마다 기둥), 깃발 기둥, (몇 번째 판이면) 묻는 차례
      size: mode === 'table' ? 1 : board.n, // 지금 해 보는 원판 수(표 만들기만 바뀐다)
      moves: [], // 지금 탑의 처음 모습에서 옮겨 온 차례([from, to])
      history: [], // 무르기에 쓰는 차례: 그 전의 옮겨 온 차례
      moveCount: 0, // 옮긴 수(무른 것도 센다)
      refuseCount: 0, // 큰 원판을 작은 원판 위에 놓으려 한 수
      backCount: 0, // 방금 옮긴 원판을 바로 되돌린 수
      undoCount: 0,
      resetCount: 0, // 처음 모습으로 되돌린 수
      retryCount: 0, // 다 쌓은 뒤에 처음 모습으로 다시 해 본 수(가장 적게 옮기는 판)
      wrongCount: 0, // 사실과 다른 답의 수(가장 적은 횟수가 아니었던 다 쌓기, 몇 번째 판에서 그때 움직이지 않는 원판 고르기)
      completions: [], // 다 쌓을 때마다의 옮긴 횟수(가장 적게 옮기는 판)
      best: null, // 이 판에서 지금까지 가장 적게 옮긴 횟수(가장 적게 옮기는 판)
      bestMoves: [], // 그때의 옮기기 차례
      stopped: false, // "여기까지 할래요"로 끝냈는가
      rows: mode === 'table' ? tableSizes(board).map(() => ({ best: null, settled: false, completions: [] })) : [], // 표 만들기: 원판 수마다 아이가 다 쌓은 횟수
      guesses: [], // 표 만들기: 짐작(원판 board.n + 1개, + 2개). 모르겠어요는 null
      picks: [], // 몇 번째에 어느 원판?: 고른 원판의 차례
    };
  }

  /** 기기에 적어 둔 하던 판의 표 만들기 칸이 맞는 값인가 */
  const validRows = (saved) =>
    Array.isArray(saved.rows) &&
    saved.rows.every((row) => row && typeof row.settled === 'boolean' && (row.best === null || count(row.best)) && Array.isArray(row.completions)) &&
    (saved.mode !== 'table' || saved.rows.length === saved.board.n);

  return {
    id: FORMAT,
    T,
    padId: 'tower-pad',
    makeId: 'make-tower',
    // 원판 일곱 개 탑은 위아래로 크다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다
    ruleAside: true,
    homeIds: { sample: 'home-tower-sample', blank: 'home-tower-blank', ask: 'home-tower-ask', play: 'home-tower-play', pick: 'home-tower-pick', make: 'home-tower-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      if (saved.mode === 'which' && saved.board.ask === undefined) return false;
      if (!Number.isInteger(saved.size) || saved.size < 1 || saved.size > saved.board.n) return false;
      if (saved.mode !== 'table' && saved.size !== saved.board.n) return false;
      const base = saved.mode === 'table' ? standardBoard(saved.size, saved.board.target) : saved.board;
      if (!Array.isArray(saved.moves) || !saved.moves.every(isMove) || replay(base, saved.moves) === null) return false;
      if (!Array.isArray(saved.history) || !saved.history.every((moves) => Array.isArray(moves) && moves.every(isMove) && replay(base, moves) !== null)) return false;
      if (![saved.completions, saved.bestMoves, saved.guesses, saved.picks].every(Array.isArray)) return false;
      if (!validRows(saved)) return false;
      if (typeof saved.stopped !== 'boolean') return false;
      if (![saved.moveCount, saved.refuseCount, saved.backCount, saved.undoCount, saved.resetCount, saved.retryCount, saved.wrongCount].every(count)) return false;
      return saved.best === null || count(saved.best);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글)을 보이거나 감춘다 */
    showParts(on) {
      $('tower-board').hidden = !on;
      $('tower-count').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      flash = null;
      held = null;
      landed = 0;
      typed = '';
    },
    draw,
    ended() {
      flash = null;
      held = null;
    },
    ruleLine: (round) => T.rules[ruleKey(round)],
    hints: (round) => T.hints[ruleKey(round)],
    touched: (round) => round.moveCount > 0 || round.refuseCount > 0 || round.picks.length > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      return { size: round.size, moves: round.moves.slice(), pos: stateOf(round), best: round.best };
    },
    /** 이 판보다 작은 판: 종류가 같고 원판이 하나 적은 판 */
    smaller: (round, turn) => smallerTower({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: true, fewest: solution.fewest, path: solution.path, ...(solution.answer === undefined ? {} : { answer: solution.answer }) },
        // 판을 떠날 때의 옮기기 차례, 다 쌓을 때마다의 횟수, 가장 적게 옮긴 횟수와 그 차례
        size: round.size,
        moves: round.moves,
        completions: round.completions,
        best: round.best,
        bestMoves: round.bestMoves,
        fewest: isRecord(round) && round.stopped !== true && round.best !== null && round.best === solution.fewest,
        stopped: round.stopped === true,
        // 표 만들기의 칸과 짐작, 몇 번째 판에서 고른 원판
        rows: round.rows,
        guesses: round.guesses,
        picks: round.picks,
        // 수준 맞추기가 보는 손댄 수와 "틀린 답"의 수
        moveCount: round.moveCount,
        refuseCount: round.refuseCount,
        backCount: round.backCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        retryCount: round.retryCount,
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
      drawTower(root, { pos: board.start, target: board.target, small: true });
    },
    drawBlank(root) {
      const board = firstDraft();
      drawTower(root, { pos: board.start, target: board.target, small: true });
    },
    /** 하던 판과 공책의 그림: 지금 모습 */
    drawResume(root, saved) {
      const base = saved.mode === 'table' && Number.isInteger(saved.size) ? standardBoard(saved.size, saved.board.target) : saved.board;
      const pos = replay(base, saved.moves ?? []) ?? base.start;
      drawTower(root, { pos, target: saved.board.target, small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      const board = picture.blank ? firstDraft() : generateBoard(entry.level, picture.seed).board;
      drawTower(root, { pos: board.start, target: board.target, small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
    /** 가장 좋은 기록(공책에 저절로 남는다). 가장 적게 옮기는 판에서 한 번도 다 쌓지 않았으면 null. 적을수록 좋은 기록이다 */
    bestOf: (round) => (!isRecord(round) || round.best === null ? null : { value: -round.best, name: fill(T.notebook.best, { k: round.best }) }),
  };
}
