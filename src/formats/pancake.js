// 팬케이크 뒤집기: 판 화면에서 이 형식이 맡는 부분(판, 뒤집기, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/pancake.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 팬케이크를 누르면 그 팬케이크부터 맨 위까지 한꺼번에 뒤집힌다(src/ui/pancake-board.js). 뒤집은 횟수는 늘 판 아래에 적는다.
// 탄 면이 없는 판에서 맨 위 한 장만 누르면 더미가 그대로라서 뒤집지 않고 그 사실만 적는다(횟수에 넣지 않는다).
// 같은 자리를 잇달아 두 번 뒤집으면 뒤집기 전 모습으로 돌아왔다는 사실을 말한다.
// 판의 종류(mode)
//   small, five  서너 장, 다섯 장(1·2단계). 크기 차례대로 쌓으면 끝난다
//   fewest, big  가장 적게 뒤집기(3·4단계, 기록 깨기). 가장 적은 횟수로 쌓으면 끝난다. 더 많이 뒤집어 쌓으면 틀렸다고 하지 않고
//                횟수를 말한 뒤 "더 적게 뒤집을 수 있을까요?"라고 묻는다. 가장 적은 횟수는 판이 끝나기 전에 말하지 않는다.
//                "처음 더미로 다시 해 볼래요"와 "여기까지 할래요"를 고를 수 있다. 판 아래에 이 판에서 가장 적게 뒤집은 횟수를 적는다
//   burnt        탄 면 팬케이크(5단계). 크기 차례대로이고 탄 면이 모두 아래를 보면 끝난다
//   made         직접 만든 판. 가장 적게 뒤집기와 같다(탄 면 판도 된다)
// 모든 더미는 다 쌓을 수 있다. 그래서 "불가능해요" 단추가 없다.
// "한 번 무르기"는 뒤집기 하나를, "처음으로 되돌리기"는 처음 더미로 돌아간다. 둘 다 횟수를 화면에 적지 않는다.
import T from '../content/pancake.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, recordMode, rungOf } from '../core/pancake-ladder.js';
import { MAX_BURNT, MAX_SIZE, checkBoard, copyBoard, doneBoard, flip, inOrder, isBurnt, isDone, replay, solve, upCount, worstOf, worstTable } from '../core/pancake.js';
import { smallerPancake } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { drawStack, flipStrip, numberTable } from '../ui/pancake-board.js';

const FORMAT = 'pancake';
const MODES = ['small', 'five', 'fewest', 'big', 'burnt', 'made'];
/** 기록에 남기는 무르기 차례의 위 끝 */
const MAX_MOVES = 400;
/** 직접 만들기의 장 수의 아래 끝 */
const MAKE_MIN = 3;
/** 직접 만들기의 처음 판: 다섯 장이 크기 차례대로 */
const firstDraft = () => doneBoard(5, false);

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createPancake(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let turned = 0; // 방금 뒤집힌 맨 위의 장 수(판을 한 번 그릴 때 그 움직임을 보이고 지운다)
  let draft = null; // 직접 만들기에서 만들던 더미
  let picked = null; // 직접 만들기에서 고른 팬케이크
  let made = null; // 직접 만들기에서 선생님이 따진 것(더미를 고치면 지운다)

  const count = (value) => Number.isInteger(value) && value >= 0;
  const isRecord = (round) => recordMode(round.mode);
  /** 규칙 글과 힌트의 이름 */
  const ruleKey = (round) => (isBurnt(round.board) ? (isRecord(round) ? 'burnt-fewest' : 'burnt') : isRecord(round) ? 'fewest' : 'sort');

  /** 한 번 푼 더미는 적어 둔다(판을 열 때마다, 기록을 남길 때마다 다시 풀지 않게) */
  const memo = new Map();
  function solutionOf(board) {
    const key = JSON.stringify(copyBoard(board));
    if (!memo.has(key)) memo.set(key, solve(board));
    return memo.get(key);
  }

  /** 뒤집어 온 차례에서 지금 더미 */
  const stateOf = (round) => replay(round.board, round.flips) ?? copyBoard(round.board);

  // ---- 이름표 ----
  function cakeName(board, index) {
    const side = board.up === null ? '' : board.up[index] === 1 ? T.labels.up : T.labels.down;
    return fill(T.labels.cake, { no: ordinal(index + 1), n: board.stack[index], face: side });
  }
  function labelOf(board) {
    return (index) => {
      const face = cakeName(board, index);
      if (index === 0) return fill(isBurnt(board) ? T.labels.turn : T.labels.top, { face });
      return fill(T.labels.flip, { face, k: index + 1 });
    };
  }

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const playing = !round.done;
    const state = stateOf(round);
    const done = isDone(state);
    const record = isRecord(round);
    drawStack($('pancake-board'), {
      ...state,
      onTap: playing ? flipAt : undefined,
      label: labelOf(state),
      flipped: turned,
    });
    turned = 0;
    $('pancake-flips').textContent = String(round.flips.length);
    $('pancake-best-line').hidden = !(record && round.best !== null);
    $('pancake-best').textContent = round.best === null ? '' : String(round.best);
    $('pancake-status').textContent = flash ?? statusOf(round, state, playing);
    $('undo').disabled = !playing || round.moves.length === 0;
    $('reset').disabled = !playing || round.flips.length === 0;
    $('pancake-burnt-note').hidden = !isBurnt(round.board);
    $('pancake-again').hidden = !(playing && record && done);
    $('pancake-stop').hidden = !(playing && record && round.best !== null);
    frame.showWhy();
  }

  function statusOf(round, state, playing) {
    if (!playing) return '';
    if (isDone(state)) return T.status.done;
    if (round.flips.length === 0) return T.status.begin;
    if (isBurnt(state) && inOrder(state)) return fill(T.status.order, { n: upCount(state) });
    return '';
  }

  /** 팬케이크를 눌렀다: 그 팬케이크부터 맨 위까지(index + 1장) 뒤집는다 */
  function flipAt(index) {
    const { round } = frame;
    if (!round || round.done) return;
    const state = stateOf(round);
    const k = index + 1;
    flash = null;
    if (isDone(state)) {
      // 가장 적게 뒤집는 판에서 다 쌓은 뒤: 더 뒤집지 않는다(처음 더미로 다시 하거나 여기까지 한다)
      flash = T.status.done;
      draw();
      return;
    }
    if (k < 1 || k > state.stack.length) return;
    if (k === 1 && !isBurnt(state)) {
      // 맨 위 한 장만 뒤집으면 더미가 그대로다. 뒤집지 않고 그 사실만 말한다
      round.topCount += 1;
      frame.note('top');
      flash = T.status.top;
      draw();
      frame.keep();
      frame.say(T.play.top);
      return;
    }
    const last = round.flips.at(-1);
    round.moves = [...round.moves, round.flips.slice()].slice(-MAX_MOVES);
    round.flips = [...round.flips, k];
    round.flipCount += 1;
    turned = k;
    frame.note('flip', { k });
    const next = flip(state, k);
    if (isDone(next)) {
      complete();
      return;
    }
    let said = null;
    if (last === k) {
      round.backCount += 1;
      said = T.play.back;
    } else if (isBurnt(next) && inOrder(next)) said = fill(T.play.order, { n: upCount(next) });
    draw();
    frame.persist();
    if (said) frame.say(said);
  }

  /** 다 쌓았다. 가장 적게 뒤집는 판이 아니면 끝난다. 그 판은 가장 적은 횟수면 끝나고, 아니면 더 적게 뒤집어 볼지 묻는다 */
  function complete() {
    const { round, solution } = frame;
    const k = round.flips.length;
    const before = round.best;
    round.completions.push(k);
    if (before === null || k < before) {
      round.best = k;
      round.bestFlips = round.flips.slice();
    }
    const fewest = !isRecord(round) || k === solution.fewest;
    const guess = fewest ? null : 'more-than-fewest';
    round.answers.push({ t: frame.stamp(), answer: `done:${k}`, correct: fewest, guess });
    frame.note('answer', { answer: `done:${k}`, correct: fewest, guess });
    if (fewest) {
      frame.finish('solved');
      return;
    }
    // 틀렸다고 하지 않는다. 횟수를 말하고 더 적게 뒤집을 수 있을지 묻는다. 가장 적은 횟수는 말하지 않는다.
    round.wrongCount += 1;
    frame.persist();
    draw();
    if (before !== null && k === before) frame.say(fill(T.play.same, { k }));
    else frame.say(fill(before !== null && k < before ? T.play['fewer-up'] : T.play.fewer, { k }));
  }

  /** 가장 적게 뒤집는 판에서 "처음 더미로 다시 해 볼래요" */
  function again() {
    const { round } = frame;
    if (round.done || round.flips.length === 0) return;
    round.moves = [...round.moves, round.flips.slice()].slice(-MAX_MOVES);
    round.flips = [];
    round.retryCount += 1;
    flash = null;
    frame.note('again');
    draw();
    frame.persist();
    frame.say(T.play.again);
  }

  /** 가장 적게 뒤집는 판에서 "여기까지 할래요": 지금까지 가장 적게 뒤집은 것으로 판을 끝낸다. 이것도 끝까지 한 판이다 */
  function stop() {
    const { round } = frame;
    if (round.done || round.best === null) return;
    round.stopped = true;
    frame.note('stop', { best: round.best });
    frame.finish('solved');
  }

  /** 한 번 무르기(처음으로 되돌린 것도 무를 수 있다). 뒤집기 하나를 무르면 그 자리를 다시 뒤집는 움직임을 보인다 */
  function undo() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    const before = round.moves.at(-1);
    if (before.length === round.flips.length - 1) turned = round.flips.at(-1);
    round.flips = before.slice();
    round.moves = round.moves.slice(0, -1);
    round.undoCount += 1;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 뒤집기에 한 말(돌아왔어요, 몇 번에 쌓았어요)은 이제 맞지 않으니 덮는다
    frame.say(T.play.undo);
  }

  /** 처음으로: 처음 더미로 돌아간다. 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (round.done || round.flips.length === 0) return;
    round.moves = [...round.moves, round.flips.slice()].slice(-MAX_MOVES);
    round.flips = [];
    round.resetCount += 1;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    if (isRecord(round)) {
      if (round.stopped) return [fill(T.right.stopped, { k: round.best })];
      const parts = [fill(T.right.fewest, { k: solution.fewest })];
      if (round.completions.length > 1) parts.push(fill(T.right['fewest-after'], { n: round.completions[0] }));
      return parts;
    }
    const back = round.undoCount + round.resetCount;
    return [fill(T.right.done, { k: round.flips.length }), back === 0 ? T.right.clean : fill(T.right.back, { n: back })];
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  const caption = (k) => fill(T.solution.caption, { k });
  const strip = (board, flips, note = '') => flipStrip(board, flips, caption, flip, note);

  function solutionPages(round, solution) {
    return [{ say: fill(T.solution.path, { k: solution.fewest }), nodes: [strip(round.board, solution.path)] }];
  }

  /** 장 수마다 가장 많이 뒤집어야 하는 횟수의 표(풀이 프로그램이 모든 더미를 따져 그 자리에서 채운다) */
  function worstNode(sizes) {
    const rows = worstTable(sizes);
    const times = (k) => fill(T.table.times, { k });
    return numberTable(
      [T.table.size, ...rows.map((row) => fill(T.table.count, { n: row.n }))],
      [
        [T.table.method, ...rows.map((row) => times(row.method))],
        [T.table.fewest, ...rows.map((row) => times(row.fewest))],
      ],
    );
  }

  /** "왜 그럴까?": 큰 것부터 보내기(늘 되는 방법) → 가장 적은 것은 아니다 → 장 수마다의 표 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return slide.figures.map((item) => {
          if (item.sizes) {
            const box = document.createElement('div');
            box.className = 'cake-table-box';
            const note = document.createElement('p');
            note.className = 'strip-note';
            note.textContent = item.note;
            box.append(worstNode(item.sizes), note);
            return box;
          }
          return strip(item.board, item.flips, item.note);
        });
      },
    }));
  }

  // ---- 직접 만들기: 장 수와 탄 면을 정하고, 두 팬케이크를 차례로 눌러 자리를 바꾼다 ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    if (saved && checkBoard(saved) === null && saved.stack.length >= MAKE_MIN) return copyBoard(saved);
    return firstDraft();
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    picked = null;
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function makeLabel(board) {
    return (index) => fill(T.labels.pick, { face: cakeName(board, index) });
  }

  function drawMake() {
    const n = draft.stack.length;
    const burnt = isBurnt(draft);
    for (const button of $('pancake-make-burnt').querySelectorAll('button')) button.setAttribute('aria-pressed', String((button.dataset.burnt === 'yes') === burnt));
    $('pancake-make-n').textContent = fill(T.make.size, { n });
    $('pancake-make-fewer').disabled = n <= MAKE_MIN;
    $('pancake-make-more').disabled = n >= (burnt ? MAX_BURNT : MAX_SIZE);
    $('pancake-make-turn').hidden = !burnt;
    $('pancake-make-turn').disabled = picked === null;
    drawStack($('pancake-make-board'), { ...draft, onTap: pick, picking: true, selected: picked === null ? [] : [picked], label: makeLabel(draft) });
    $('pancake-make-result').textContent = made ? made.line : '';
    $('pancake-make-picture').replaceChildren(...(made?.node ? [made.node] : []));
  }

  function changeDraft(next) {
    if (checkBoard(next) !== null) return;
    draft = copyBoard(next);
    made = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 팬케이크를 눌렀다: 처음 누르면 고르고, 고른 것을 다시 누르면 그만 고르고, 다른 것을 누르면 두 팬케이크의 자리를 바꾼다 */
  function pick(index) {
    if (picked === null) picked = index;
    else if (picked === index) picked = null;
    else {
      const stack = draft.stack.slice();
      const up = draft.up === null ? null : draft.up.slice();
      [stack[picked], stack[index]] = [stack[index], stack[picked]];
      if (up) [up[picked], up[index]] = [up[index], up[picked]];
      picked = null;
      changeDraft({ stack, up });
      return;
    }
    drawMake();
  }

  /** 탄 면 판: 고른 팬케이크를 뒤집어 놓는다(자리는 그대로, 탄 면의 위아래만 바뀐다) */
  function turnPicked() {
    if (!isBurnt(draft) || picked === null) return;
    const up = draft.up.slice();
    up[picked] = 1 - up[picked];
    changeDraft({ stack: draft.stack.slice(), up });
  }

  /** 장 수를 바꾼다. 늘리면 가장 큰 새 팬케이크를 맨 아래에 놓고, 줄이면 가장 큰 팬케이크를 뺀다 */
  function resize(n) {
    const burnt = isBurnt(draft);
    if (n < MAKE_MIN || n > (burnt ? MAX_BURNT : MAX_SIZE)) return;
    picked = null;
    changeDraft(sized(draft, n));
  }

  function sized(board, n) {
    let stack = board.stack.slice();
    let up = board.up === null ? null : board.up.slice();
    while (stack.length > n) {
      const at = stack.indexOf(stack.length);
      stack.splice(at, 1);
      if (up) up.splice(at, 1);
    }
    while (stack.length < n) {
      stack = [...stack, stack.length + 1];
      if (up) up = [...up, 0];
    }
    return { stack, up };
  }

  /** 탄 면을 켜고 끈다. 탄 면 판은 여섯 장까지라서, 더 많으면 큰 것부터 뺀다 */
  function setBurnt(on) {
    if (on === isBurnt(draft)) return;
    picked = null;
    if (!on) {
      changeDraft({ stack: draft.stack.slice(), up: null });
      return;
    }
    const many = draft.stack.length > MAX_BURNT;
    const base = many ? sized(draft, MAX_BURNT) : draft;
    changeDraft({ stack: base.stack.slice(), up: base.stack.map(() => 0) });
    if (many) frame.talkers.make.say(T.make['burnt-many']);
  }

  /** "차례대로 놓기": 크기 차례대로, 탄 면은 모두 아래로 */
  function clearAll() {
    picked = null;
    changeDraft(doneBoard(draft.stack.length, isBurnt(draft)));
  }

  /** 아이가 만든 더미를 풀이 프로그램으로 따져서 알려 준다. 가장 적은 횟수와 한 가지 방법을 보여 준다 */
  function solveDraft() {
    const board = copyBoard(draft);
    if (isDone(board)) {
      made = { line: T.make.already, node: null };
      drawMake();
      frame.talkers.make.say(T.make.already);
      return;
    }
    const result = solve(board);
    const worst = result.fewest === worstOf(board.stack.length, isBurnt(board)).worst;
    const line = worst ? `${fill(T.make.fewest, { k: result.fewest })} ${fill(T.make.worst, { n: board.stack.length })}` : fill(T.make.fewest, { k: result.fewest });
    made = { line, node: strip(board, result.path) };
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

  /** 다 만든 더미(공책에 남기거나 해 볼 판): 아직 다 쌓이지 않은 더미 */
  const madeBoard = () => (draft && checkBoard(draft) === null && !isDone(draft) ? copyBoard(draft) : null);

  function playDraft() {
    const board = madeBoard();
    if (!board) {
      frame.talkers.make.say(T.make['keep-not-yet']);
      return;
    }
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('pancake-again').addEventListener('click', again);
  $('pancake-stop').addEventListener('click', stop);
  $('pancake-make-fewer').addEventListener('click', () => resize(draft.stack.length - 1));
  $('pancake-make-more').addEventListener('click', () => resize(draft.stack.length + 1));
  $('pancake-make-burnt').addEventListener('click', (event) => {
    const value = event.target.closest('button')?.dataset.burnt;
    if (value === 'yes' || value === 'no') setBurnt(value === 'yes');
  });
  $('pancake-make-turn').addEventListener('click', turnPicked);
  $('pancake-make-clear').addEventListener('click', clearAll);
  $('pancake-make-solve').addEventListener('click', solveDraft);
  $('pancake-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: copyBoard(board), // 판: 처음 더미(위에서부터의 크기, 탄 면)
      flips: [], // 처음 더미에서 뒤집어 온 차례(뒤집개를 넣은 자리 k)
      moves: [], // 무르기에 쓰는 차례: 그 전의 뒤집어 온 차례
      flipCount: 0, // 뒤집은 수(무른 것도 센다)
      topCount: 0, // 탄 면이 없는 판에서 맨 위 한 장만 누른 수
      backCount: 0, // 같은 자리를 잇달아 두 번 뒤집은 수
      undoCount: 0,
      resetCount: 0, // 처음 더미로 되돌린 수
      retryCount: 0, // 다 쌓은 뒤에 처음 더미로 다시 해 본 수(가장 적게 뒤집는 판)
      wrongCount: 0, // 사실과 다른 답의 수(가장 적게 뒤집는 판에서 가장 적은 횟수가 아니었던 다 쌓기)
      completions: [], // 다 쌓을 때마다의 뒤집은 횟수
      best: null, // 이 판에서 지금까지 가장 적게 뒤집은 횟수
      bestFlips: [], // 그때의 뒤집기 차례
      stopped: false, // "여기까지 할래요"로 끝냈는가
    };
  }

  return {
    id: FORMAT,
    T,
    padId: 'pancake-pad',
    makeId: 'make-pancake',
    // 여덟 장 더미는 위아래로 크다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다(팬케이크 한 줄이 44픽셀보다 낮아지지 않게).
    ruleAside: true,
    homeIds: { sample: 'home-pancake-sample', blank: 'home-pancake-blank', ask: 'home-pancake-ask', play: 'home-pancake-play', pick: 'home-pancake-pick', make: 'home-pancake-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      if (replay(saved.board, saved.flips) === null) return false;
      if (!Array.isArray(saved.moves) || !saved.moves.every((flips) => replay(saved.board, flips) !== null)) return false;
      if (![saved.completions, saved.bestFlips].every(Array.isArray)) return false;
      if (typeof saved.stopped !== 'boolean') return false;
      if (![saved.flipCount, saved.topCount, saved.backCount, saved.undoCount, saved.resetCount, saved.retryCount, saved.wrongCount].every(count)) return false;
      return saved.best === null || count(saved.best);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글)을 보이거나 감춘다 */
    showParts(on) {
      $('pancake-board').hidden = !on;
      $('pancake-count').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      flash = null;
      turned = 0;
    },
    draw,
    ended() {
      flash = null;
    },
    ruleLine: (round) => T.rules[ruleKey(round)],
    hints: (round) => T.hints[ruleKey(round)],
    touched: (round) => round.flipCount > 0 || round.topCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const state = stateOf(round);
      return { flips: round.flips.slice(), stack: state.stack, up: state.up, best: round.best };
    },
    /** 이 판보다 작은 판: 탄 면이 있는지가 같고 장 수가 적은 더미 */
    smaller: (round, turn) => smallerPancake({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: true, fewest: solution.fewest, path: solution.path },
        // 판을 떠날 때의 뒤집기 차례, 다 쌓을 때마다의 횟수, 가장 적게 뒤집은 횟수와 그 차례
        flips: round.flips,
        completions: round.completions,
        best: round.best,
        bestFlips: round.bestFlips,
        fewest: isRecord(round) && round.stopped !== true && round.best !== null && round.best === solution.fewest,
        stopped: round.stopped === true,
        // 수준 맞추기가 보는 손댄 수와 "틀린 답"의 수
        moveCount: round.flipCount,
        flipCount: round.flipCount,
        topCount: round.topCount,
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
      drawStack(root, { ...board, small: true });
    },
    drawBlank(root) {
      drawStack(root, { ...firstDraft(), small: true });
    },
    /** 하던 판과 공책의 그림: 지금 더미 */
    drawResume(root, saved) {
      const state = replay(saved.board, saved.flips) ?? saved.board;
      drawStack(root, { ...state, small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) {
        drawStack(root, { ...firstDraft(), small: true });
        return;
      }
      drawStack(root, { ...generateBoard(entry.level, picture.seed).board, small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
    /** 가장 좋은 기록(공책에 저절로 남는다). 가장 적게 뒤집는 판에서 한 번도 다 쌓지 않았으면 null. 적을수록 좋은 기록이다 */
    bestOf: (round) => (!isRecord(round) || round.best === null ? null : { value: -round.best, name: fill(T.notebook.best, { k: round.best }) }),
  };
}
