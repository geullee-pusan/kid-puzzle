// 모눈 자동차 경주: 판 화면에서 이 형식이 맡는 부분(판, 아홉 점 고르기, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/racetrack.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 혼자 하는 퍼즐이다. 시계를 보이지 않고, 경주는 이름뿐이다(기록은 움직인 횟수다).
// 차는 칸의 가운데 점에 선다. 지난번 움직임만큼 또 간 자리(가운데 동그라미)와 그 둘레의 여덟 점, 모두 아홉 점 가운데 하나를 누르면 차가 그 점으로 간다.
// 지금 점과 다음 점을 잇는 선이 벽에 닿으면(닿기만 해도) 가지 않고 그 사실을 말한다. 선은 점선으로 남기고 다음에 무엇을 누르면 지운다.
// 아홉 점 모두 벽에 닿는 자리에 서면 그 사실과 무르기를 말한다. 깃발 칸이 있는 판은 선이 깃발 칸에 닿은 뒤에만 결승선을 넘을 수 있다.
// 판의 종류(mode)
//   straight, corner  곧은 길, 모퉁이 하나(1·2단계). 결승선을 넘으면 끝난다
//   fewest, big       가장 적게 가기, 구불구불한 길(3·5단계, 기록 깨기). 가장 적은 수로 결승선을 넘으면 끝난다.
//                     더 많이 움직여 넘으면 틀렸다고 하지 않고 횟수를 말한 뒤 "더 적은 수로 갈 수 있을까요?"라고 묻는다.
//                     가장 적은 수는 판이 끝나기 전에 말하지 않는다. "출발 칸에서 다시 해 볼래요"와 "여기까지 할래요"를 고를 수 있다
//   flag              깃발 들르기(4단계, 기록 깨기). 가장 적게 가기와 같고, 깃발 칸에 닿아야 결승선을 넘을 수 있다
//   made              직접 만든 판. 가장 적게 가기(깃발이 있으면 깃발 들르기)와 같다
// 사다리의 모든 판은 결승선까지 갈 수 있다. 그래서 "불가능해요" 단추가 없다.
// "한 번 무르기"는 움직임 하나를, "처음으로 되돌리기"는 출발 칸으로 돌아간다. 둘 다 횟수를 화면에 적지 않는다.
import T from '../content/racetrack.json';
import { LADDER, MAKE_H, MAKE_LEVEL, MAKE_W, TOP_LEVEL, fitsView, generateBoard, nextSeed, recordMode, rungOf } from '../core/racetrack-ladder.js';
import { checkBoard, copyBoard, isAccel, isStuck, replay, solve, startState, targetOf, tryMove } from '../core/racetrack.js';
import { smallerRacetrack } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { drawMakeGrid, drawTrack, trackFigure } from '../ui/racetrack-board.js';

const FORMAT = 'racetrack';
const MODES = ['straight', 'corner', 'fewest', 'flag', 'big', 'made'];
/** 기록에 남기는 무르기 차례의 위 끝 */
const MAX_HISTORY = 300;
/** 직접 만들기의 누르기 도구 */
const TOOLS = ['road', 'start', 'finish', 'flag'];

/** 직접 만들기의 처음 판: ㄱ자 길(아래 가로 길의 왼쪽에서 출발, 오른쪽 세로 길의 위 변이 결승선) */
function firstDraft() {
  const w = MAKE_W.first;
  const h = MAKE_H.first;
  const rows = Array.from({ length: h }, (_, r) => Array.from({ length: w }, (_, c) => (r >= h - 3 || c >= w - 3 ? '.' : '#')).join(''));
  return { rows, start: [0, h - 3], finish: { side: 'top', anchor: [w - 1, 0] }, flags: [] };
}

const count = (value) => Number.isInteger(value) && value >= 0;

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createRacetrack(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let blocked = null; // 벽에 닿아 가지 못한 선(점선으로 그린다). 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 만들던 판
  let tool = 'road'; // 직접 만들기에서 칸을 누르면 하는 일
  let made = null; // 직접 만들기에서 선생님이 따진 것(판을 고치면 지운다)
  let refused = false; // 선생님이 방금 한 말이 가지 못한 까닭(벽, 깃발, 막힌 자리)인가. 다음에 차가 움직이면 그 말을 덮는다

  const isRecord = (round) => recordMode(round.mode);
  /** 규칙 글과 힌트의 이름. 직접 만든 판은 깃발이 있으면 깃발 들르기, 없으면 가장 적게 가기와 같다 */
  const ruleKey = (round) => (round.mode === 'made' ? (round.board.flags.length > 0 ? 'flag' : 'fewest') : round.mode);

  /** 한 번 푼 판은 적어 둔다(판을 그릴 때마다 다시 풀지 않게) */
  const memo = new Map();
  function solutionOf(board) {
    const key = JSON.stringify(copyBoard(board));
    if (!memo.has(key)) memo.set(key, solve(board));
    return memo.get(key);
  }

  /** 움직여 온 차례에서 지금까지의 차들 */
  const runOf = (round) => replay(round.board, round.moves) ?? { states: [startState(round.board)], finished: false };
  const pointsOf = (states) => states.map((state) => [state.x, state.y]);

  // ---- 이름표 ----
  /** 움직임(가로 vx, 세로 vy)을 말로: "오른쪽 2칸, 위 1칸" */
  function moveName(vx, vy) {
    const parts = [];
    if (vx > 0) parts.push(fill(T.labels.right, { k: vx }));
    if (vx < 0) parts.push(fill(T.labels.left, { k: -vx }));
    if (vy < 0) parts.push(fill(T.labels.up, { k: -vy }));
    if (vy > 0) parts.push(fill(T.labels.down, { k: vy }));
    return parts.length > 0 ? parts.join(', ') : T.labels.still;
  }
  const pickLabel = (state) => (ax, ay) => fill(T.labels.pick, { face: moveName(state.vx + ax, state.vy + ay) });

  // ---- 판 ----
  function draw() {
    const { round, solution } = frame;
    const playing = !round.done;
    const { states, finished } = runOf(round);
    const state = states.at(-1);
    const record = isRecord(round);
    drawTrack($('racetrack-board'), {
      board: round.board,
      extent: solution.extent,
      points: pointsOf(states),
      // 결승선을 넘은 뒤에는 차만 그린다(아홉 점과 화살표 없이)
      state: finished ? { ...state, vx: 0, vy: 0 } : state,
      flagged: round.board.flags.length > 0 && state.flag,
      onPick: playing && !finished ? pickAt : undefined,
      label: pickLabel(state),
      blocked,
    });
    $('racetrack-moves').textContent = String(round.moves.length);
    $('racetrack-speed').textContent = moveName(state.vx, state.vy);
    $('racetrack-best-line').hidden = !(record && round.best !== null);
    $('racetrack-best').textContent = round.best === null ? '' : String(round.best);
    $('racetrack-status').textContent = flash ?? statusOf(round, state, finished, playing);
    $('undo').disabled = !playing || round.history.length === 0;
    $('reset').disabled = !playing || round.moves.length === 0;
    $('racetrack-flag-note').hidden = round.board.flags.length === 0;
    $('racetrack-again').hidden = !(playing && record && finished);
    $('racetrack-stop').hidden = !(playing && record && round.best !== null);
    frame.showWhy();
  }

  function statusOf(round, state, finished, playing) {
    if (!playing) return '';
    if (finished) return T.status.done;
    if (round.moves.length === 0) return T.status.begin;
    if (isStuck(round.board, state)) return T.status.stuck;
    return '';
  }

  /** 아홉 점 가운데 하나를 눌렀다: 지난 움직임에 (ax, ay)를 더한 만큼 간다 */
  function pickAt(ax, ay) {
    const { round } = frame;
    if (!round || round.done) return;
    const { states, finished } = runOf(round);
    const state = states.at(-1);
    flash = null;
    blocked = null;
    if (finished) {
      // 가장 적게 가는 판에서 결승선을 넘은 뒤: 더 움직이지 않는다(출발 칸에서 다시 하거나 여기까지 한다)
      flash = T.status.done;
      draw();
      return;
    }
    const result = tryMove(round.board, state, ax, ay);
    if (result.kind === 'wall' || result.kind === 'flag') {
      // 가지 않는다. 사실 하나와 할 수 있는 일 하나를 말한다
      const stuck = result.kind === 'wall' && isStuck(round.board, state);
      if (result.kind === 'wall') {
        round.refuseCount += 1;
        blocked = [
          [state.x, state.y],
          targetOf(state, ax, ay),
        ];
      } else round.flagRefuseCount += 1;
      frame.note(result.kind, { ax, ay });
      flash = stuck ? T.status.stuck : T.status[result.kind];
      draw();
      frame.persist();
      frame.say(stuck ? T.play.stuck : T.play[result.kind]);
      refused = true;
      return;
    }
    round.history = [...round.history, round.moves.slice()].slice(-MAX_HISTORY);
    round.moves = [...round.moves, [ax, ay]];
    round.moveCount += 1;
    frame.note('move', { ax, ay });
    const wasRefused = refused;
    refused = false;
    if (result.kind === 'finish') {
      complete();
      return;
    }
    // 앞의 가지 못한 까닭은 이제 맞지 않으니 덮는다(이 움직임에 할 말이 없으면 차가 갔다는 사실만)
    let said = wasRefused ? T.play.moved : null;
    if (isStuck(round.board, result.next)) {
      round.stuckCount += 1;
      said = T.play.stuck;
      refused = true;
    } else if (result.flagged && !state.flag) said = T.play.flagged;
    draw();
    frame.persist();
    if (said) frame.say(said);
  }

  /** 결승선을 넘었다. 가장 적게 가는 판이 아니면 끝난다. 그 판은 가장 적은 수면 끝나고, 아니면 더 적게 가 볼지 묻는다 */
  function complete() {
    const { round, solution } = frame;
    const k = round.moves.length;
    const before = round.best;
    round.completions.push(k);
    if (before === null || k < before) {
      round.best = k;
      round.bestMoves = round.moves.map((move) => move.slice());
    }
    const fewest = !isRecord(round) || k === solution.fewest;
    const guess = fewest ? null : 'more-than-fewest';
    round.answers.push({ t: frame.stamp(), answer: `done:${k}`, correct: fewest, guess });
    frame.note('answer', { answer: `done:${k}`, correct: fewest, guess });
    if (fewest) {
      frame.finish('solved');
      return;
    }
    // 틀렸다고 하지 않는다. 횟수를 말하고 더 적은 수로 갈 수 있을지 묻는다. 가장 적은 수는 말하지 않는다.
    round.wrongCount += 1;
    frame.persist();
    draw();
    if (before !== null && k === before) frame.say(fill(T.play.same, { k }));
    else frame.say(fill(before !== null && k < before ? T.play['fewer-up'] : T.play.fewer, { k }));
  }

  /** 가장 적게 가는 판에서 "출발 칸에서 다시 해 볼래요" */
  function again() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    round.history = [...round.history, round.moves.slice()].slice(-MAX_HISTORY);
    round.moves = [];
    round.retryCount += 1;
    flash = null;
    blocked = null;
    refused = false;
    frame.note('again');
    draw();
    frame.persist();
    frame.say(T.play.again);
  }

  /** 가장 적게 가는 판에서 "여기까지 할래요": 지금까지 가장 적게 움직인 것으로 판을 끝낸다. 이것도 끝까지 한 판이다 */
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
    if (round.done || round.history.length === 0) return;
    round.moves = round.history.at(-1).map((move) => move.slice());
    round.history = round.history.slice(0, -1);
    round.undoCount += 1;
    flash = null;
    blocked = null;
    refused = false;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 움직임에 한 말(벽, 몇 번에 넘었는지)은 이제 맞지 않으니 덮는다
    frame.say(T.play.undo);
  }

  /** 처음으로: 출발 칸으로 돌아간다. 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    round.history = [...round.history, round.moves.slice()].slice(-MAX_HISTORY);
    round.moves = [];
    round.resetCount += 1;
    flash = null;
    blocked = null;
    refused = false;
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
    return [fill(T.right.done, { k: round.moves.length }), back === 0 ? T.right.clean : fill(T.right.back, { n: back })];
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  /** 움직임 차례 하나를 그림 카드로. 끝에 결승선을 넘지 못했으면 그 자리의 차와 지난 움직임을 그린다 */
  function pathCard(board, moves, note, big) {
    const run = replay(board, moves);
    const states = run ? run.states : [startState(board)];
    const last = states.at(-1);
    const points = pointsOf(states);
    // 그림의 둘레: 판과 지나온 점(결승선 너머의 마지막 점까지)
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const extent = { x0: Math.min(0, ...xs), x1: Math.max(board.rows[0].length - 1, ...xs), y0: Math.min(0, ...ys), y1: Math.max(board.rows.length - 1, ...ys) };
    return trackFigure(board, { points, extent, flagged: board.flags.length > 0 && last.flag, state: run?.finished ? null : last }, note, big);
  }

  function solutionPages(round, solution) {
    return [{ say: fill(T.solution.path, { k: solution.fewest }), nodes: [pathCard(round.board, solution.path, '', true)] }];
  }

  /** "왜 그럴까?": 계속 빨라지다 막힌 자리 → 속도는 조금씩만 바뀐다(이름) → 모퉁이 안쪽에 붙어 가는 길과 넓게 도는 길 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        const row = document.createElement('div');
        row.className = 'figure-row';
        row.append(...slide.figures.map((item) => pathCard(item.board, item.moves, item.note, slide.figures.length === 1)));
        return [row];
      },
    }));
  }

  // ---- 직접 만들기: 칸을 눌러 길을 그리고, 출발 칸과 결승선(과 깃발 칸)을 정한다 ----
  const W = () => draft.rows[0].length;
  const H = () => draft.rows.length;
  const openIn = (rows, c, r) => c >= 0 && r >= 0 && c < rows[0].length && r < rows.length && rows[r][c] === '.';
  const openAt = (c, r) => openIn(draft.rows, c, r);
  /** 칸이 놓인 판 가장자리(위, 아래, 왼쪽, 오른쪽의 차례) */
  const edgesIn = (rows, c, r) => [r === 0 && 'top', r === rows.length - 1 && 'bottom', c === 0 && 'left', c === rows[0].length - 1 && 'right'].filter(Boolean);

  /** 결승선: 정한 가장자리 칸(anchor)에서 그 변을 따라 이어진 길 칸들 */
  function finishIn(rows, value) {
    if (!value) return null;
    const { side, anchor } = value;
    const [c, r] = anchor;
    if (!openIn(rows, c, r) || !edgesIn(rows, c, r).includes(side)) return null;
    const across = side === 'top' || side === 'bottom';
    const at = across ? c : r;
    const cell = (i) => (across ? [i, r] : [c, i]);
    let from = at;
    let to = at;
    while (openIn(rows, ...cell(from - 1))) from -= 1;
    while (openIn(rows, ...cell(to + 1))) to += 1;
    return { side, from, to };
  }
  const finishOf = (value) => finishIn(draft.rows, value);

  /** 만들던 판에서 판 값으로(출발 칸이나 결승선이 없으면 null) */
  function boardOf(value) {
    const finish = finishIn(value.rows, value.finish);
    if (!value.start || !finish) return null;
    const board = { rows: value.rows.slice(), start: value.start.slice(), finish, flags: value.flags.map((cell) => cell.slice()) };
    return checkBoard(board) === null ? board : null;
  }

  function validDraft(saved) {
    if (!saved || !Array.isArray(saved.rows) || !Array.isArray(saved.flags)) return false;
    const h = saved.rows.length;
    const w = typeof saved.rows[0] === 'string' ? saved.rows[0].length : 0;
    if (w < MAKE_W.low || w > MAKE_W.high || h < MAKE_H.low || h > MAKE_H.high) return false;
    if (!saved.rows.every((row) => typeof row === 'string' && row.length === w && /^[.#]+$/.test(row))) return false;
    const cell = (value) => Array.isArray(value) && value.length === 2 && value.every(Number.isInteger);
    if (saved.start !== null && !cell(saved.start)) return false;
    if (saved.finish !== null && !(saved.finish && ['top', 'bottom', 'left', 'right'].includes(saved.finish.side) && cell(saved.finish.anchor))) return false;
    return saved.flags.length <= 1 && saved.flags.every(cell);
  }

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    return validDraft(saved) ? { rows: saved.rows.slice(), start: saved.start, finish: saved.finish, flags: saved.flags } : firstDraft();
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function cellLabel(c, r) {
    const board = { rows: draft.rows, start: draft.start ?? [-1, -1], finish: finishOf(draft.finish), flags: draft.flags };
    let face = openAt(c, r) ? T.labels.road : T.labels.wall;
    if (board.finish && edgesIn(draft.rows, c, r).includes(board.finish.side)) {
      const along = board.finish.side === 'top' || board.finish.side === 'bottom' ? c : r;
      if (along >= board.finish.from && along <= board.finish.to) face = T.labels.finish;
    }
    if (draft.flags.some(([x, y]) => x === c && y === r)) face = T.labels.flag;
    if (draft.start && draft.start[0] === c && draft.start[1] === r) face = T.labels.start;
    return fill(T.labels.cell, { no: ordinal(r + 1), n: ordinal(c + 1), face });
  }

  function drawMake() {
    for (const button of $('racetrack-make-tool').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
    $('racetrack-make-w').textContent = fill(T.make.size, { n: W() });
    $('racetrack-make-h').textContent = fill(T.make.size, { n: H() });
    $('racetrack-make-w-fewer').disabled = W() <= MAKE_W.low;
    $('racetrack-make-w-more').disabled = W() >= MAKE_W.high;
    $('racetrack-make-h-fewer').disabled = H() <= MAKE_H.low;
    $('racetrack-make-h-more').disabled = H() >= MAKE_H.high;
    drawMakeGrid($('racetrack-make-board'), {
      rows: draft.rows,
      start: draft.start,
      finish: finishOf(draft.finish),
      flags: draft.flags,
      onCell: tapCell,
      label: cellLabel,
      points: made?.points ?? [],
    });
    $('racetrack-make-result').textContent = made ? made.line : '';
  }

  function changeDraft(next) {
    draft = next;
    made = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 칸을 눌렀다: 고른 도구에 따라 길 칸과 벽 칸을 바꾸거나 출발 칸, 결승선, 깃발 칸을 정한다 */
  function tapCell(c, r) {
    const next = { rows: draft.rows.slice(), start: draft.start, finish: draft.finish, flags: draft.flags };
    if (tool === 'road') {
      const row = [...next.rows[r]];
      row[c] = row[c] === '.' ? '#' : '.';
      next.rows[r] = row.join('');
      if (row[c] === '#') {
        // 벽이 된 칸에 있던 출발 칸과 깃발 칸은 없앤다. 결승선은 다른 칸이 남아 있으면 그 칸으로 옮긴다
        if (next.start && next.start[0] === c && next.start[1] === r) next.start = null;
        next.flags = next.flags.filter(([x, y]) => x !== c || y !== r);
        if (next.finish && next.finish.anchor[0] === c && next.finish.anchor[1] === r) next.finish = movedFinish(next, c, r);
      }
      changeDraft(next);
      return;
    }
    if (!openAt(c, r)) {
      frame.talkers.make.say(tool === 'finish' ? T.make.edge : T.make.road);
      return;
    }
    if (tool === 'start') next.start = [c, r];
    else if (tool === 'flag') next.flags = draft.flags.some(([x, y]) => x === c && y === r) ? [] : [[c, r]];
    else {
      const sides = edgesIn(draft.rows, c, r);
      if (sides.length === 0) {
        frame.talkers.make.say(T.make.edge);
        return;
      }
      // 모서리 칸은 두 변에 붙어 있다. 같은 칸을 다시 누르면 다른 변으로 바꾼다
      const same = draft.finish && draft.finish.anchor[0] === c && draft.finish.anchor[1] === r;
      const side = same && sides.length > 1 ? sides[(sides.indexOf(draft.finish.side) + 1) % sides.length] : sides[0];
      next.finish = { side, anchor: [c, r] };
    }
    changeDraft(next);
  }

  /** 결승선의 칸이 벽이 되었을 때: 같은 변을 따라 바로 옆의 길 칸으로 옮긴다(없으면 null) */
  function movedFinish(next, c, r) {
    const { side } = next.finish;
    const across = side === 'top' || side === 'bottom';
    for (const step of [-1, 1]) {
      const cell = across ? [c + step, r] : [c, r + step];
      if (openIn(next.rows, ...cell)) return { side, anchor: cell };
    }
    return null;
  }

  /** 가로나 세로를 바꾼다. 늘리면 새 칸은 벽 칸이고, 줄이면 오른쪽이나 아래쪽 칸을 뺀다 */
  function resize(w, h) {
    if (w < MAKE_W.low || w > MAKE_W.high || h < MAKE_H.low || h > MAKE_H.high) return;
    const rows = Array.from({ length: h }, (_, r) => Array.from({ length: w }, (_, c) => (r < H() && c < W() ? draft.rows[r][c] : '#')).join(''));
    const inside = (cell) => cell && cell[0] < w && cell[1] < h;
    const finish = draft.finish && inside(draft.finish.anchor) && finishIn(rows, draft.finish) ? draft.finish : null;
    changeDraft({ rows, start: inside(draft.start) ? draft.start : null, finish, flags: draft.flags.filter(inside) });
  }

  /** "모두 길 칸으로": 판 전체를 길 칸으로 바꾼다(출발 칸과 결승선은 그대로) */
  function clearAll() {
    changeDraft({ rows: draft.rows.map((row) => '.'.repeat(row.length)), start: draft.start, finish: draft.finish, flags: draft.flags });
  }

  /** 아이가 만든 판을 풀이 프로그램으로 따져서 알려 준다. 가장 적은 수와 한 가지 길을 모눈 위에 그린다 */
  function solveDraft() {
    if (!draft.start) {
      frame.talkers.make.say(T.make['need-start']);
      return;
    }
    const board = boardOf(draft);
    if (!board) {
      frame.talkers.make.say(T.make['need-finish']);
      return;
    }
    const result = solve(board);
    let line;
    let points = [];
    if (!result.possible) line = T.make.none;
    else {
      const run = replay(board, result.path);
      points = pointsOf(run.states);
      line = fitsView(result.extent) ? fill(T.make.fewest, { k: result.fewest }) : `${fill(T.make.fewest, { k: result.fewest })} ${T.make.wide}`;
    }
    made = { line, points };
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
      solution: { possible: result.possible, fewest: result.fewest, path: result.path },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판): 결승선까지 갈 수 있고 화면에 다 그릴 수 있는 판 */
  function madeBoard() {
    if (!draft) return null;
    const board = boardOf(draft);
    if (!board) return null;
    const result = solutionOf(board);
    return result.possible && fitsView(result.extent) ? copyBoard(board) : null;
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
  $('racetrack-again').addEventListener('click', again);
  $('racetrack-stop').addEventListener('click', stop);
  $('racetrack-make-w-fewer').addEventListener('click', () => resize(W() - 1, H()));
  $('racetrack-make-w-more').addEventListener('click', () => resize(W() + 1, H()));
  $('racetrack-make-h-fewer').addEventListener('click', () => resize(W(), H() - 1));
  $('racetrack-make-h-more').addEventListener('click', () => resize(W(), H() + 1));
  $('racetrack-make-tool').addEventListener('click', (event) => {
    const value = event.target.closest('button')?.dataset.tool;
    if (!TOOLS.includes(value)) return;
    tool = value;
    drawMake();
  });
  $('racetrack-make-clear').addEventListener('click', clearAll);
  $('racetrack-make-solve').addEventListener('click', solveDraft);
  $('racetrack-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: copyBoard(board), // 판: 길 칸과 벽 칸, 출발 칸, 결승선, 깃발 칸
      moves: [], // 출발 칸에서 움직여 온 차례(움직임 [ax, ay]: 지난 움직임에서 바꾼 만큼)
      history: [], // 무르기에 쓰는 차례: 그 전의 움직여 온 차례
      moveCount: 0, // 움직인 수(무른 것도 센다)
      refuseCount: 0, // 선이 벽에 닿아 가지 못한 수
      flagRefuseCount: 0, // 깃발 칸에 닿기 전에 결승선을 넘으려 한 수
      stuckCount: 0, // 아홉 점 모두 벽에 닿는 자리에 선 수
      undoCount: 0,
      resetCount: 0, // 출발 칸으로 되돌린 수
      retryCount: 0, // 결승선을 넘은 뒤에 출발 칸에서 다시 해 본 수(가장 적게 가는 판)
      wrongCount: 0, // 사실과 다른 답의 수(가장 적게 가는 판에서 가장 적은 수가 아니었던 결승선 넘기)
      completions: [], // 결승선을 넘을 때마다의 움직인 수
      best: null, // 이 판에서 지금까지 가장 적게 움직인 수
      bestMoves: [], // 그때의 움직임 차례
      stopped: false, // "여기까지 할래요"로 끝냈는가
    };
  }

  return {
    id: FORMAT,
    T,
    padId: 'racetrack-pad',
    makeId: 'make-racetrack',
    // 판이 위아래로도 크다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다(점 사이가 44픽셀보다 좁아지지 않게).
    ruleAside: true,
    homeIds: { sample: 'home-racetrack-sample', blank: 'home-racetrack-blank', ask: 'home-racetrack-ask', play: 'home-racetrack-play', pick: 'home-racetrack-pick', make: 'home-racetrack-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      if (!Array.isArray(saved.moves) || !saved.moves.every(isAccel) || replay(saved.board, saved.moves) === null) return false;
      if (!Array.isArray(saved.history) || !saved.history.every((moves) => Array.isArray(moves) && moves.every(isAccel) && replay(saved.board, moves) !== null)) return false;
      if (![saved.completions, saved.bestMoves].every(Array.isArray)) return false;
      if (typeof saved.stopped !== 'boolean') return false;
      if (![saved.moveCount, saved.refuseCount, saved.flagRefuseCount, saved.stuckCount, saved.undoCount, saved.resetCount, saved.retryCount, saved.wrongCount].every(count)) return false;
      return saved.best === null || count(saved.best);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글)을 보이거나 감춘다 */
    showParts(on) {
      $('racetrack-board').hidden = !on;
      $('racetrack-count').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      flash = null;
      blocked = null;
      refused = false;
    },
    draw,
    ended() {
      flash = null;
      blocked = null;
    },
    ruleLine: (round) => T.rules[ruleKey(round)],
    hints: (round) => T.hints[ruleKey(round)],
    touched: (round) => round.moveCount > 0 || round.refuseCount > 0 || round.flagRefuseCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const state = runOf(round).states.at(-1);
      return { moves: round.moves.map((move) => move.slice()), x: state.x, y: state.y, vx: state.vx, vy: state.vy, best: round.best };
    },
    /** 이 판보다 작은 판: 같은 종류(곧은 길, ㄱ자 길, 깃발 판…)로 크기가 작고 가장 적은 수가 적은 판 */
    smaller: (round, turn) => smallerRacetrack({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: true, fewest: solution.fewest, path: solution.path },
        // 판을 떠날 때의 움직임 차례, 결승선을 넘을 때마다의 수, 가장 적게 움직인 수와 그 차례
        moves: round.moves,
        completions: round.completions,
        best: round.best,
        bestMoves: round.bestMoves,
        fewest: isRecord(round) && round.stopped !== true && round.best !== null && round.best === solution.fewest,
        stopped: round.stopped === true,
        // 수준 맞추기가 보는 손댄 수와 "틀린 답"의 수
        moveCount: round.moveCount,
        refuseCount: round.refuseCount,
        flagRefuseCount: round.flagRefuseCount,
        stuckCount: round.stuckCount,
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
      drawTrack(root, { board, state: startState(board), small: true });
    },
    drawBlank(root) {
      drawTrack(root, { board: firstDraftBoard(), small: true });
    },
    /** 하던 판과 공책의 그림: 지금까지 지나온 길 */
    drawResume(root, saved) {
      const run = replay(saved.board, saved.moves ?? []) ?? { states: [startState(saved.board)], finished: false };
      drawTrack(root, { board: saved.board, extent: solutionOf(saved.board).extent, points: pointsOf(run.states), state: run.finished ? null : run.states.at(-1), small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) {
        drawTrack(root, { board: firstDraftBoard(), small: true });
        return;
      }
      const { board } = generateBoard(entry.level, picture.seed);
      drawTrack(root, { board, state: startState(board), small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
    /** 가장 좋은 기록(공책에 저절로 남는다). 가장 적게 가는 판에서 한 번도 결승선을 넘지 않았으면 null. 적을수록 좋은 기록이다 */
    bestOf: (round) => (!isRecord(round) || round.best === null ? null : { value: -round.best, name: fill(T.notebook.best, { k: round.best }) }),
  };

  /** 처음 판(판 값으로) */
  function firstDraftBoard() {
    const first = firstDraft();
    return { rows: first.rows, start: first.start, finish: finishIn(first.rows, first.finish), flags: [] };
  }
}
