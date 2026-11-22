// 핀에 실 감기: 판 화면에서 이 형식이 맡는 부분(판, 핀 누르기와 감기, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/pins.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 원 위의 핀에 실을 감는다. 실은 늘 지금 핀에서 시계 방향으로 칸 수만큼 앞의 핀으로 가고, 아이가 그 핀을 눌러 감는다(손이 센다).
// k칸 앞이 아닌 핀을 누르면 감지 않고 그 핀이 몇 칸 앞인지를 판 아래에 적는다. 처음 핀으로 돌아오면 한 가닥이 끝나고,
// 실이 없는 핀을 눌러 새 실을 맨다. "감기"를 누르면 선생님이 한 마디씩(0.3초마다, 움직임을 줄이는 설정이면 한 번에) 끝까지 감는다.
// 판 아래에는 칸 수, 실 가닥 수, 실이 지나간 핀 수를 늘 적는다.
// 판의 종류: 감아 보기(모두 감으면 끝), 짐작하고 감기(먼저 가닥 수를 짐작한다. 맞다 틀리다 하지 않는다),
// 표 만들기(칸 수를 바꿔 가며 끝까지 감으면 표에 적힌다. 표가 다 차면 끝), 한 가닥으로 다 감기(한 가닥인 칸 수를 모두 골라 "다 골랐어요"),
// 핀 12개와 13개(먼저 여러 가닥인 칸 수가 있을지 짐작하고, 여러 가닥인 칸 수를 하나 감거나 표를 다 채우면 끝).
// 표의 칸은 아이가 끝까지 감은 것으로만 채운다. 선생님이 미리 채우지 않는다.
import T from '../content/pins.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/pins-ladder.js';
import { MAX_PINS, MAX_THREADS, MIN_PINS, checkBoard, choicesOf, copyBoard, countOf, halfOf, nextPin, offsetOf, oneThreadKs, solve, threadsOf, windState } from '../core/pins.js';
import { smallerPins } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { drawPins, pinsCard } from '../ui/pins-board.js';

const FORMAT = 'pins';
const MODES = ['wind', 'guess', 'table', 'one', 'predict', 'made'];
/** 칸 수를 아이가 바꾸는 판 */
const FREE = ['table', 'one', 'predict'];
/** 처음 화면과 판 고르기에 그리는 빈 판(핀 12개) */
const BLANK = { n: 12, k: null };
/** 직접 만들기의 처음 판: 핀 10개, 4칸씩(실 2가닥) */
const FIRST_DRAFT = { n: 10, k: 4 };
/** 감기 단추로 한 마디를 감는 데 걸리는 시간(밀리초). 0.4초를 넘지 않는다 */
const STEP_MS = 300;

const count = (value) => Number.isInteger(value) && value >= 0;
const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const fullView = (n, k) => threadsOf(n, k).map((pins) => ({ pins, closed: true }));

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createPins(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let fresh = false; // 방금 감은 마디(한 번 그릴 때만 떠오른다)
  let timer = null; // 선생님이 감는 중이면 다음 마디의 타이머
  let draft = null; // 직접 만들기에서 만들던 판
  let made = null; // 직접 만들기에서 선생님이 감아 본 것(판을 고치면 지운다)

  const free = (round) => FREE.includes(round.mode);
  const needGuess = (round) => (round.mode === 'guess' || round.mode === 'predict') && round.guess === null;
  const stateOf = (round) => windState(round.board.n, round.k, round.steps);
  const winding = () => timer !== null;

  function stop() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  /** 읽어 주는 이름: 핀의 자리와 그 핀에 실이 지나갔는지 */
  function labelFor(last) {
    return (pin, index) => {
      const where = pin === 0 ? T.labels.top : fill(T.labels.pin, { k: pin });
      const what = pin === last ? T.labels.last : index !== null ? fill(T.labels.used, { no: ordinal(index + 1) }) : T.labels.open;
      return `${where}, ${what}`;
    };
  }

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const { n } = board;
    const state = stateOf(round);
    const playing = !round.done;
    const asking = needGuess(round);
    const live = playing && !asking && !winding() && !state.complete;
    drawPins($('pins-board'), {
      n,
      threads: state.threads,
      last: state.open ? state.last : null,
      fresh,
      numbers: round.numbersOn,
      label: labelFor(state.open ? state.last : null),
      onPin: live ? tapPin : undefined,
    });
    fresh = false;
    $('pins-skip').textContent = String(round.k);
    $('pins-threads').textContent = String(state.threads.length);
    $('pins-used').textContent = String(state.used);
    $('pins-total').textContent = String(n);
    $('pins-status').textContent = flash ?? statusOf(round, state);
    $('undo').disabled = !playing || round.steps.length === 0;
    $('reset').disabled = !playing || round.steps.length === 0;

    // 오른쪽 칸: 짐작 → 칸 수 → 감기 → 표(또는 고르기)
    $('pins-guess-box').hidden = !(playing && round.mode === 'guess' && round.guess === null);
    $('pins-predict-box').hidden = !(playing && round.mode === 'predict' && round.guess === null);
    const guessed = round.guess !== null;
    $('pins-guess-line').hidden = !guessed;
    if (guessed) $('pins-guess-line').textContent = round.mode === 'predict' ? T.predictLine[round.guess] : fill(T.guessLine, { n: round.guess });
    $('pins-skip-box').hidden = !free(round) || asking;
    $('pins-skip-now').textContent = fill(T.skip, { k: round.k });
    $('pins-skip-fewer').disabled = !playing || round.k <= 1;
    $('pins-skip-more').disabled = !playing || round.k >= halfOf(n);
    $('pins-wind-box').hidden = asking;
    $('pins-wind').disabled = !live;
    // 칸 수를 고르는 판은 표가 길어서 누르는 법 글을 줄인다(판 아래의 글이 다음 핀을 알려 준다)
    $('pins-wind-note').hidden = free(round);
    $('pins-table-box').hidden = !(round.mode === 'table' || round.mode === 'predict');
    if (!$('pins-table-box').hidden) drawTable(round);
    $('pins-one-box').hidden = round.mode !== 'one';
    if (round.mode === 'one') drawChips(round);
    $('pins-one-done').disabled = !playing;

    // 왼쪽 칸: 핀마다 칸 수 적기
    $('pins-numbers').textContent = T.tool[round.numbersOn ? 'on' : 'off'];
    $('pins-numbers').setAttribute('aria-pressed', String(round.numbersOn));
    frame.showWhy();
  }

  function statusOf(round, state) {
    const last = round.wound.at(-1);
    if (round.done) return free(round) && last ? fill(T.status.result, { k: last.k, n: last.count }) : T.status.complete;
    if (needGuess(round)) return T.status[round.mode === 'predict' ? 'predict' : 'guess'];
    if (winding()) return T.status.winding;
    if (state.complete) {
      if (!free(round)) return T.status.complete;
      const { count } = countOf(round.board.n, round.k);
      return fill(T.status[round.mode === 'one' ? 'result' : 'saved'], { k: round.k, n: count });
    }
    if (!state.open) return round.steps.length === 0 ? T.status.start : T.status.closed;
    return fill(T.status.next, { k: round.k });
  }

  /** 표: 칸 수마다 아이가 끝까지 감아 본 가닥 수와 한 가닥의 핀 수. 지금 칸 수의 줄은 굵게 */
  function drawTable(round) {
    const rows = choicesOf(round.board.n).map((k) => {
      const done = round.wound.find((item) => item.k === k);
      const row = document.createElement('tr');
      if (k === round.k) {
        row.className = 'now';
        row.setAttribute('aria-current', 'true');
      }
      for (const text of [fill(T.skip, { k }), done ? fill(T.threads, { n: done.count }) : '', done ? fill(T.pinsOf, { n: done.per }) : '']) {
        const cell = document.createElement('td');
        cell.textContent = text;
        row.append(cell);
      }
      return row;
    });
    $('pins-table-body').replaceChildren(...rows);
  }

  /** 한 가닥으로 다 감기: 칸 수마다 고르는 단추(누르면 골라지고, 다시 누르면 빠진다) */
  function drawChips(round) {
    const chips = choicesOf(round.board.n).map((k) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn pins-chip';
      button.dataset.k = String(k);
      button.textContent = fill(T.skip, { k });
      button.setAttribute('aria-pressed', String(round.picks.includes(k)));
      button.disabled = round.done;
      return button;
    });
    $('pins-one-chips').replaceChildren(...chips);
  }

  // ---- 감기 ----
  /** 아이가 핀을 눌렀다: k칸 앞의 핀(또는 실이 없을 때 실이 없는 핀)이면 감고, 아니면 그 사실을 판 아래에 적는다 */
  function tapPin(pin) {
    const { round } = frame;
    if (!round || round.done || needGuess(round) || winding()) return;
    const { n } = round.board;
    const state = stateOf(round);
    if (state.complete) return;
    flash = null;
    if (!state.open) {
      if (state.threads.some((thread) => thread.pins.includes(pin))) {
        refuse(pin, 'taken', T.status.taken);
        return;
      }
    } else if (pin !== state.next) {
      const ahead = offsetOf(n, state.last, pin);
      refuse(pin, 'off', fill(T.status.off, { n: ahead, k: round.k }));
      return;
    }
    round.moveCount += 1;
    frame.note('pin', { pin, k: round.k });
    step(pin);
  }

  function refuse(pin, why, line) {
    const { round } = frame;
    round.offCount += 1;
    frame.note('refuse', { pin, why });
    flash = line;
    draw();
    frame.persist();
  }

  /** 한 마디를 감는다. 모든 핀을 감았으면 그 칸 수를 끝까지 감은 것이다 */
  function step(pin) {
    const { round } = frame;
    round.steps = [...round.steps, pin];
    fresh = true;
    const state = stateOf(round);
    if (state.complete) {
      woundAll();
      return;
    }
    draw();
    frame.persist();
  }

  /** "감기": 선생님이 지금 모습에서 끝까지 감는다. 움직임을 줄이는 설정이면 한 번에 감는다 */
  function windAll() {
    const { round } = frame;
    if (!round || round.done || needGuess(round) || winding() || stateOf(round).complete) return;
    flash = null;
    round.autoCount += 1;
    frame.note('auto', { k: round.k, from: round.steps.length });
    const { n } = round.board;
    if (still()) {
      let pin = nextPin(n, round.k, round.steps);
      while (pin !== null) {
        round.steps = [...round.steps, pin];
        pin = nextPin(n, round.k, round.steps);
      }
      woundAll();
      return;
    }
    const tick = () => {
      timer = null;
      if (frame.round !== round || round.done) return;
      const pin = nextPin(n, round.k, round.steps);
      if (pin === null) return;
      round.steps = [...round.steps, pin];
      fresh = true;
      if (stateOf(round).complete) {
        woundAll();
        return;
      }
      timer = setTimeout(tick, STEP_MS);
      draw();
      frame.persist();
    };
    timer = setTimeout(tick, 0);
    draw();
  }

  /** 지금 칸 수로 모든 핀을 감았다 */
  function woundAll() {
    const { round } = frame;
    stop();
    const { n } = round.board;
    const { count, per } = countOf(n, round.k);
    frame.note('wound', { k: round.k, count });
    if (!free(round)) {
      round.answers.push({ t: frame.stamp(), answer: 'wound', correct: true, guess: null });
      frame.finish('solved');
      return;
    }
    round.wound = [...round.wound.filter((item) => item.k !== round.k), { k: round.k, count, per }];
    const all = choicesOf(n).every((k) => round.wound.some((item) => item.k === k));
    const over = (round.mode === 'table' && all) || (round.mode === 'predict' && (count > 1 || all));
    if (over) {
      round.answers.push({ t: frame.stamp(), answer: 'wound', correct: true, guess: null });
      frame.finish('solved');
      return;
    }
    draw();
    frame.persist();
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.steps.length === 0) return;
    stop();
    round.steps = round.steps.slice(0, -1);
    round.undoCount += 1;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 모습에 한 말은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  function reset() {
    const { round } = frame;
    if (round.done || round.steps.length === 0) return;
    stop();
    round.steps = [];
    round.resetCount += 1;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  /** 칸 수를 바꾼다(칸 수를 아이가 고르는 판). 감던 실은 풀고 새로 감는다 */
  function changeSkip(k) {
    const { round } = frame;
    if (!round || round.done || !free(round) || needGuess(round)) return;
    if (k < 1 || k > halfOf(round.board.n) || k === round.k) return;
    stop();
    round.k = k;
    round.steps = [];
    round.skipCount += 1;
    flash = null;
    frame.note('skip', { k });
    draw();
    frame.persist();
  }

  // ---- 짐작: 기록에만 남기고 맞다 틀리다 하지 않는다 ----
  function guess(value) {
    const { round } = frame;
    if (!round || round.done || !needGuess(round)) return;
    round.guess = value;
    round.guessAt = frame.stamp();
    frame.note('guess', { guess: value });
    draw();
    frame.persist();
    frame.say(round.mode === 'predict' ? T.play.predicted : T.play.guessed);
  }

  // ---- 한 가닥으로 다 감기: 고르기와 "다 골랐어요" ----
  function togglePick(k) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'one') return;
    round.picks = round.picks.includes(k) ? round.picks.filter((item) => item !== k) : [...round.picks, k].sort((a, b) => a - b);
    frame.note('pick', { k, picks: round.picks.slice() });
    draw();
    frame.persist();
  }

  /** 고른 칸 수가 한 가닥으로 다 감기는 칸 수와 꼭 같으면 끝난다. 아니면 무엇이 다른지 사실 하나만 말한다 */
  function submit() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'one') return;
    if (round.picks.length === 0) {
      frame.say(T.play['one-empty']);
      return;
    }
    const { n } = round.board;
    const truth = oneThreadKs(n);
    const extra = round.picks.filter((k) => !truth.includes(k));
    const missing = truth.filter((k) => !round.picks.includes(k));
    const correct = extra.length === 0 && missing.length === 0;
    const why = correct ? null : extra.length > 0 ? 'extra' : 'missing';
    round.answers.push({ t: frame.stamp(), answer: round.picks.join(','), correct, guess: why });
    frame.note('answer', { picks: round.picks.slice(), correct });
    if (correct) {
      frame.finish('solved');
      return;
    }
    round.wrongCount += 1;
    flash = null;
    draw();
    frame.persist();
    frame.say(why === 'extra' ? fill(T.play['one-extra'], { k: extra[0], n: countOf(n, extra[0]).count }) : fill(T.play['one-missing'], { n: missing.length }));
  }

  // ---- 핀마다 칸 수 적기 ----
  function toggleNumbers() {
    const { round } = frame;
    if (!round) return;
    round.numbersOn = !round.numbersOn;
    if (round.numbersOn) {
      round.numbersShown = true;
      round.numbersCount += 1;
    }
    frame.note('numbers', { on: round.numbersOn });
    draw();
    frame.keep();
  }

  // ---- 끝났을 때 하는 말: 한 일과 사실만 말한다 ----
  function rightLine(round) {
    const { n } = round.board;
    const parts = [];
    if (!free(round)) {
      const { count, per } = countOf(n, round.k);
      parts.push(fill(T.right.wound, { n: count, k: per }));
      if (round.mode === 'guess' && round.guess !== null) parts.push(fill(T.right['guess-was'], { n: round.guess }));
      else if (round.mode === 'wind') parts.push(T.right['wind-next']);
    } else if (round.mode === 'table') {
      parts.push(fill(T.right.table, { k: choicesOf(n).length }), T.right['table-next']);
    } else if (round.mode === 'one') {
      parts.push(fill(T.right.one, { k: oneThreadKs(n).length }));
      if (n !== 13) parts.push(T.right['one-next']);
    } else {
      const last = round.wound.at(-1);
      parts.push(last && last.count > 1 ? fill(T.right['predict-many'], { n, k: last.k, f: last.count }) : fill(T.right['predict-one'], { n }));
      if (round.guess !== null) parts.push(T.right[`predict-guess-${round.guess}`]);
    }
    // 이 형식의 판을 처음 끝까지 했으면 "왜 그럴까?"가 열렸다는 것을 알려 준다
    const finished = new Set(frame.records().filter((record) => record.kind === 'round' && record.format === FORMAT && record.outcome === 'solved').map((record) => record.id));
    if (!round.side && finished.size === 1 && finished.has(round.id)) parts.push(T.right['why-open']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 칸 수마다 끝까지 감은 작은 그림 */
  const allCards = (n) => choicesOf(n).map((k) => pinsCard({ n, threads: fullView(n, k) }, fill(T.solution.note, { k, n: countOf(n, k).count })));

  /** 풀이: 칸 수가 정해진 판은 끝까지 감은 모습, 칸 수를 고르는 판은 칸 수마다 끝까지 감은 모습 */
  function solutionPages(round, solution) {
    const { n, k } = round.board;
    if (k !== null) {
      const node = rowOf([pinsCard({ n, threads: fullView(n, k) }, null, { big: true })]);
      return [{ say: fill(T.solution.wound, { n: solution.count, k: solution.per }), nodes: [node] }];
    }
    let say = T.solution.table;
    if (round.mode === 'one') say = fill(T.solution.one, { k: solution.ones.length });
    if (round.mode === 'predict') {
      say = solution.allOne ? fill(T.solution['predict-one'], { n }) : fill(T.solution['predict-many'], { n, k: solution.firstMany, f: countOf(n, solution.firstMany).count });
    }
    return [{ say, nodes: [rowOf(allCards(n))] }];
  }

  /** "왜 그럴까?"의 그림 하나: 맨 위 핀에서 가까운 가닥부터 show가닥, 또는 path를 따라간 한 가닥 */
  function figureView(item) {
    if (item.path) return { n: item.n, threads: [{ pins: item.path, closed: true }] };
    return { n: item.n, threads: fullView(item.n, item.k).slice(0, item.show) };
  }

  /** "왜 그럴까?": 4칸씩은 핀 3개만 지나 4가닥 → 몇 번 가야 처음 핀에 오는지 → 핀 13개(이름) → 번갈아 감으면 이야기가 맞지 않는다 → 수학의 이름(최대공약수, 마지막 장에만) */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다. 한 장뿐인 그림은 크게, 두 장은 조금 크게 그린다
      get nodes() {
        return [rowOf(slide.figures.map((item) => pinsCard(figureView(item), item.note, { big: slide.figures.length === 1, mid: slide.figures.length === 2 })))];
      },
    }));
  }

  // ---- 직접 만들기: 핀 수와 칸 수를 정한다 ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    return saved && checkBoard(saved) === null && saved.k !== null ? copyBoard(saved) : copyBoard(FIRST_DRAFT);
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const { n, k } = draft;
    $('pins-make-n').textContent = fill(T.pinsOf, { n });
    $('pins-make-k').textContent = fill(T.skip, { k });
    $('pins-make-n-fewer').disabled = n <= MIN_PINS;
    $('pins-make-n-more').disabled = n >= MAX_PINS;
    $('pins-make-k-fewer').disabled = k <= 1;
    $('pins-make-k-more').disabled = k >= n - 1;
    drawPins($('pins-make-board'), { n, threads: made ? fullView(n, k) : [{ pins: [0, k % n], closed: false }] });
    $('pins-make-result').textContent = made ? made.line : '';
  }

  function changeDraft(next) {
    const said = made !== null;
    draft = next;
    made = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
    // 앞의 대답은 바뀐 판에 맞지 않는다
    if (said) frame.talkers.make.say(T.make.changed);
  }

  function resize(n) {
    if (n < MIN_PINS || n > MAX_PINS) return;
    changeDraft({ n, k: Math.min(draft.k, n - 1) });
  }

  function reskip(k) {
    if (k < 1 || k > draft.n - 1) return;
    changeDraft({ ...draft, k });
  }

  /** 아이가 정한 판을 선생님이 끝까지 감아 보고 가닥 수와 한 가닥의 핀 수를 말한다 */
  function solveDraft() {
    const board = copyBoard(draft);
    const result = solve(board);
    made = { line: fill(T.make.result, { n: result.count, k: result.per }) };
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
      solution: { possible: true, count: result.count, per: result.per },
    });
    log.flush();
    frame.talkers.make.say(made.line);
  }

  /** 다 만든 판(공책에 남기거나 감아 볼 판). 핀 수와 칸 수가 있으면 늘 감을 수 있다 */
  function madeBoard() {
    if (!draft || checkBoard(draft) !== null || draft.k === null) return null;
    return copyBoard(draft);
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
  $('pins-wind').addEventListener('click', windAll);
  $('pins-numbers').addEventListener('click', toggleNumbers);
  $('pins-skip-fewer').addEventListener('click', () => frame.round && changeSkip(frame.round.k - 1));
  $('pins-skip-more').addEventListener('click', () => frame.round && changeSkip(frame.round.k + 1));
  $('pins-guesses').addEventListener('click', (event) => {
    const value = Number(event.target.closest('button')?.dataset.guess);
    if (Number.isInteger(value) && value >= 1 && value <= MAX_THREADS) guess(value);
  });
  $('pins-predict-one').addEventListener('click', () => guess('one'));
  $('pins-predict-many').addEventListener('click', () => guess('many'));
  $('pins-one-chips').addEventListener('click', (event) => {
    const value = Number(event.target.closest('button')?.dataset.k);
    if (Number.isInteger(value)) togglePick(value);
  });
  $('pins-one-done').addEventListener('click', submit);
  $('pins-make-n-fewer').addEventListener('click', () => resize(draft.n - 1));
  $('pins-make-n-more').addEventListener('click', () => resize(draft.n + 1));
  $('pins-make-k-fewer').addEventListener('click', () => reskip(draft.k - 1));
  $('pins-make-k-more').addEventListener('click', () => reskip(draft.k + 1));
  $('pins-make-solve').addEventListener('click', solveDraft);
  $('pins-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: copyBoard(board), // 판: 핀 수와 칸 수(칸 수를 아이가 고르는 판은 null)
      k: board.k ?? 1, // 지금 감는 칸 수
      steps: [], // 지금 칸 수로 누른 핀의 차례(맨 위 핀이 0)
      wound: [], // 끝까지 감아 본 칸 수마다의 가닥 수와 한 가닥의 핀 수 { k, count, per }(표의 칸)
      guess: null, // 짐작: 가닥 수(짐작하고 감기) 또는 'one'·'many'(핀 12개와 13개). 맞다 틀리다 하지 않는다
      guessAt: null, // 짐작을 고른 때(초)
      picks: [], // 한 가닥으로 다 감기에서 고른 칸 수
      moveCount: 0, // 아이가 핀을 눌러 감은 수
      autoCount: 0, // "감기"를 누른 수
      offCount: 0, // 감을 수 없는 핀을 누른 수(k칸 앞이 아닌 핀, 실이 지나간 핀)
      skipCount: 0, // 칸 수를 바꾼 수
      undoCount: 0,
      resetCount: 0,
      wrongCount: 0, // 사실과 다른 답의 수("다 골랐어요"를 눌렀는데 고른 것이 다르던 수)
      numbersOn: false, // 지금 "핀마다 칸 수 적기"를 켜 두었는가
      numbersShown: false, // 한 번이라도 켰는가
      numbersCount: 0, // 켠 수
    };
  }

  /** 적어 둔 판의 단계가 판의 종류와 맞는가 */
  const levelOk = (saved) => {
    if (saved.custom === true) return saved.level === MAKE_LEVEL && saved.mode === 'made';
    if (!Number.isInteger(saved.level) || saved.level < LADDER[0].level || saved.level > TOP_LEVEL) return false;
    return rungOf(saved.level).mode === saved.mode;
  };

  return {
    id: FORMAT,
    T,
    padId: 'pins-pad',
    makeId: 'make-pins',
    // 판이 둥글다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다
    ruleAside: true,
    homeIds: { sample: 'home-pins-sample', blank: 'home-pins-blank', ask: 'home-pins-ask', play: 'home-pins-play', pick: 'home-pins-pick', make: 'home-pins-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solve(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null || !levelOk(saved)) return false;
      const { n, k } = saved.board;
      if ((k === null) !== FREE.includes(saved.mode)) return false;
      if (k !== null ? saved.k !== k : !(Number.isInteger(saved.k) && saved.k >= 1 && saved.k <= halfOf(n))) return false;
      if (!windState(n, saved.k, saved.steps).ok) return false;
      if (!Array.isArray(saved.wound) || !saved.wound.every((item) => item && choicesOf(n).includes(item.k) && item.count === countOf(n, item.k).count && item.per === countOf(n, item.k).per)) return false;
      if (saved.guess !== null && !(saved.mode === 'predict' ? ['one', 'many'].includes(saved.guess) : saved.mode === 'guess' && Number.isInteger(saved.guess) && saved.guess >= 1 && saved.guess <= MAX_THREADS)) return false;
      if (!Array.isArray(saved.picks) || !saved.picks.every((item) => choicesOf(n).includes(item))) return false;
      if (![saved.moveCount, saved.autoCount, saved.offCount, saved.skipCount, saved.undoCount, saved.resetCount, saved.wrongCount, saved.numbersCount].every(count)) return false;
      return [saved.numbersOn, saved.numbersShown].every((value) => typeof value === 'boolean');
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('pins-board').hidden = !on;
      $('pins-count').hidden = !on;
      $('pins-numbers').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      stop();
      flash = null;
      fresh = false;
    },
    draw,
    ended() {
      stop();
      flash = null;
    },
    ruleLine: (round) => {
      const ask = round.mode === 'predict' ? fill(T.asks.predict, { n: round.board.n }) : T.asks[round.mode === 'made' ? 'wind' : round.mode];
      return `${free(round) ? T.rules.free : fill(T.rules.wind, { k: round.k })} ${ask}`;
    },
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.moveCount > 0 || round.autoCount > 0 || round.guess !== null || round.picks.length > 0 || round.numbersCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const state = stateOf(round);
      return { k: round.k, steps: round.steps.slice(), threads: state.threads.length, used: state.used, wound: round.wound.map((item) => `${item.k}:${item.count}`), guess: round.guess, picks: round.picks.slice() };
    },
    /** 이 판보다 작은 판: 핀이 더 적고 실 가닥 수가 같은 판(칸 수를 고르는 판은 핀이 더 적은 같은 종류의 판) */
    smaller: (round, turn) => smallerPins({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: round.board.k !== null ? { possible: true, count: solution.count, per: solution.per } : { possible: true, table: solution.table.map((item) => item.count), ones: solution.ones, allOne: solution.allOne, firstMany: solution.firstMany },
        // 질문 힌트와 "핀마다 칸 수 적기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.numbersShown ? 1 : 0),
        numbersShown: round.numbersShown,
        numbersCount: round.numbersCount,
        // 판을 떠날 때의 모습
        k: round.k,
        steps: round.steps,
        wound: round.wound,
        guess: round.guess,
        guessAt: round.guessAt,
        // 짐작이 실제와 같았는가(기록에만 남긴다. 화면에는 알리지 않는다)
        guessMatched: round.guess === null ? null : round.mode === 'predict' ? (round.guess === 'one') === solution.allOne : round.guess === solution.count,
        picks: round.picks,
        moveCount: round.moveCount,
        autoCount: round.autoCount,
        offCount: round.offCount,
        skipCount: round.skipCount,
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
    /** 글자판: 핀은 저마다 Enter와 빈칸 글쇠로 누른다(판이 맡는다). 칸 수를 고르는 판에서는 +와 -로 칸 수를 바꾼다 */
    onKey(event) {
      const { round } = frame;
      if ($('pins-pad').hidden || !round || !free(round)) return;
      if (event.key === '+') changeSkip(round.k + 1);
      if (event.key === '-') changeSkip(round.k - 1);
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    /** 판의 처음 그림: 칸 수가 정해진 판은 맨 위 핀에서 k칸 앞의 핀까지 실 한 마디 */
    drawSample(root, board) {
      drawPins(root, { n: board.n, threads: board.k ? [{ pins: [0, board.k], closed: false }] : [], small: true });
    },
    drawBlank(root) {
      drawPins(root, { n: BLANK.n, small: true });
    },
    /** 하던 판과 공책의 그림: 지금 감긴 모습(아직 감지 않은 칸 수가 정해진 판은 처음 그림처럼 실 한 마디) */
    drawResume(root, saved) {
      const state = windState(saved.board.n, saved.k, saved.steps);
      const threads = state.threads.length === 0 && saved.board.k !== null ? [{ pins: [0, saved.board.k], closed: false }] : state.threads;
      drawPins(root, { n: saved.board.n, threads, small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawPins(root, { n: BLANK.n, small: true });
        return;
      }
      const { board } = generateBoard(entry.level, entry.picture.seed);
      drawPins(root, { n: board.n, threads: board.k ? [{ pins: [0, board.k], closed: false }] : [], small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
