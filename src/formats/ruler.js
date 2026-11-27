// 눈금이 가장 적은 자: 판 화면에서 이 형식이 맡는 부분(자와 길이 칸, 이어지는 자의 이름표, 내 기록, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/ruler.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 자의 자리를 누르면 눈금이 찍히고, 다시 누르면 빠진다. 처음부터 있는 눈금(0과 자의 끝, 같은 길이를 두 번 재지 않는 자는 0)은 빠지지 않는다.
// 길이 칸(1부터 자의 길이까지)은 두 눈금 사이로 잴 수 있으면 채워진다. 잴 수 있는 길이 칸을 누르면 그 길이를 재는 두 눈금을 점선 고리로 짚는다
// (한 번 더 누르면 같은 길이를 재는 다른 두 눈금, 더 없으면 짚기를 끈다).
// 판의 종류(mode)
//   first             모든 길이 재기(1단계). 1부터 자의 길이까지 모두 잴 수 있으면 끝난다
//   fewest, long, made 가장 적은 눈금(2·3단계, 직접 만든 판). 기록 깨기: 모두 잴 수 있게 될 때마다 찍은 눈금의 수를 말하고,
//                     풀이 프로그램이 아는 가장 적은 수면 끝난다. 아니면 틀렸다고 하지 않고 "더 적은 눈금으로도 될까요?"라고 묻는다(더 적은 자가 있을 때만)
//   chain             하나씩 길어지는 자(4단계). 자 다섯 개 가운데 늘 아직 풀지 않은 자 둘이 열려 있다(열린 판 둘). 이름표를 눌러 오간다.
//                     한 자를 가장 적은 눈금으로 만들면 그 자는 다 된 것이고 다음 자가 열린다. 모두 만들면 끝난다
//   golomb            같은 길이를 두 번 재지 않는 자(5단계). 눈금 k개를 찍는다. 같은 길이를 두 번 재지 않으면 자의 길이(가장 오른쪽 눈금)를 말하고,
//                     가장 짧은 길이면 끝난다. 길이 칸에서 두 번 재는 길이는 늘 겹 테두리와 "2번"이다
// 기록 깨기 판은 모두 잰 적이 있으면(이어지는 자는 어느 자든) "여기까지 할래요"로 끝낼 수 있다. 가장 좋은 기록은 공책에 저절로 남는다.
// 왼쪽 칸의 "재는 횟수 보기"를 켜면 길이 칸마다 몇 번 재는지와, 두 눈금의 짝이 모두 몇 개인지 판 아래에 적는다. 처음 켤 때 힌트 하나로 센다.
// 무르기는 지금 자에서 한 일(눈금 찍기, 빼기, 처음으로) 하나를 무른다. 다 만든 자는 무를 수 없다.
import T from '../content/ruler.json';
import { FIRST_MAKE, LADDER, MAKE_LEVEL, MAKE_MAX, MAKE_MIN, TOP_LEVEL, generateBoard, nextSeed, recordMode, rungOf } from '../core/ruler-ladder.js';
import { bestScore, checkBoard, copyBoard, fixedOf, isDone, itemCount, marksOk, pairCount, pairsByLength, recordOf, shortestGolomb, solve, solveLength, sortMarks, spanOf } from '../core/ruler.js';
import { smallerRuler } from '../core/smaller.js';
import { endsClosed, fill } from '../core/text.js';
import { drawLengths, drawMini, drawRuler, drawTabs, lengthsCard, rulerCard, tableCard } from '../ui/ruler-board.js';

const FORMAT = 'ruler';
const MODES = ['first', 'fewest', 'long', 'chain', 'golomb', 'made'];
/** 무르기 차례를 적어 두는 위 끝 */
const MAX_HISTORY = 300;
/** 풀이에서 보여 주는 가장 좋은 자의 수 */
const SHOW_SHAPES = 3;

/** 수 뒤에 붙는 말: 받침이 있으면 c, 없으면 o */
const byEnd = (group, key, number) => group[`${key}-${endsClosed(number) ? 'c' : 'o'}`];
const count = (value) => Number.isInteger(value) && value >= 0;
const sameMarks = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

/** 이 판의 규칙 글과 힌트의 이름: 판의 꼴로 정한다(더 작은 판도 같은 꼴이다) */
export function ruleKey(round) {
  if (round.board.kind === 'golomb') return 'golomb';
  if (round.board.lengths.length > 1) return 'chain';
  return round.mode === 'first' ? 'first' : 'fewest';
}

/** 늘 아직 풀지 않은 자 둘이 열려 있다(열린 판 둘): 다 만들지 않은 자 가운데 앞의 둘 */
export function openOf(round) {
  return round.items.map((item, index) => (item.done ? null : index)).filter((index) => index !== null).slice(0, 2);
}

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createRuler(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let shown = null; // 짚은 길이와 몇 번째 두 눈금인지 { d, turn }. 눈금이 바뀌면 지운다
  let draft = FIRST_MAKE; // 직접 만들기에서 고른 길이
  let made = null; // 직접 만들기에서 선생님이 따진 것(길이를 바꾸면 지운다)

  const itemOf = (round) => round.items[round.at];
  const isRecord = (round) => recordMode(round.mode);
  const anyBest = (round) => round.items.some((item) => item.best !== null);

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    const item = itemOf(round);
    const span = spanOf(board, round.at);
    const pairs = pairsByLength(item.marks);
    const tappable = playing && !item.done;
    const golomb = board.kind === 'golomb';
    const ring = ringOf(pairs);

    // 이어지는 자의 이름표
    const tabsRoot = $('ruler-tabs');
    tabsRoot.hidden = itemCount(board) < 2;
    if (itemCount(board) > 1) {
      const open = openOf(round);
      drawTabs(tabsRoot, {
        label: T.labels.tabs,
        onTab: playing ? tapTab : undefined,
        tabs: board.lengths.map((L, index) => {
          const it = round.items[index];
          const state = it.done ? 'done' : open.includes(index) ? 'open' : 'locked';
          const note = state === 'done' ? fill(T.labels['tab-done'], { k: it.marks.length }) : T.labels[`tab-${state}`];
          return { state, current: index === round.at, title: fill(T.labels['tab-title'], { n: L }), note, label: fill(T.labels[`tab-${state}-label`], { n: L, k: it.marks.length }) };
        }),
      });
    }
    drawRuler($('ruler-ruler'), {
      span,
      marks: item.marks,
      fixed: fixedOf(board, round.at),
      ring,
      onTap: tappable ? tapPosition : undefined,
      labels: {
        ruler: fill(T.labels.ruler, { n: span }),
        position: (at, marked, fixed) => fill(T.labels[fixed ? 'position-fixed' : marked ? 'position-marked' : 'position'], { n: at }),
      },
    });
    const counts = new Map([...pairs.entries()].map(([d, list]) => [d, list.length]));
    const showCounts = round.countOn && playing;
    drawLengths($('ruler-lengths'), {
      top: span,
      counts,
      twice: golomb,
      selected: shown?.d ?? null,
      onTap: playing ? tapLength : undefined,
      extra: (d, many) => (many > 0 && (showCounts || (golomb && many > 1)) ? fill(T.labels.times, { k: many }) : ''),
      labels: {
        strip: T.labels.strip,
        length: (d, many) => (many === 0 ? fill(T.labels.length, { n: d }) : many > 1 && (showCounts || golomb) ? fill(T.labels['length-many'], { n: d, k: many }) : fill(T.labels['length-lit'], { n: d })),
      },
    });

    // 판 아래: 할 일이나 사실 한 줄, 찍은 눈금의 수, 잴 수 있는 길이의 수(같은 길이를 두 번 재지 않는 자는 자의 길이), 도구를 켜면 짝의 수
    $('ruler-status').textContent = flash ?? statusOf(round, item, pairs);
    $('ruler-marks').textContent = String(item.marks.length);
    $('ruler-measured-line').hidden = golomb;
    $('ruler-measured').textContent = String([...pairs.keys()].filter((d) => d <= span).length);
    $('ruler-span-line').hidden = !golomb;
    $('ruler-span').textContent = String(Math.max(...item.marks));
    $('ruler-pairs-line').classList.toggle('rl-off', !showCounts);
    $('ruler-pairs').textContent = String(pairCount(item.marks.length));
    $('undo').disabled = !tappable || item.history.length === 0;
    $('reset').disabled = !tappable || sameMarks(item.marks, fixedOf(board, round.at));
    drawPad(round, item, playing);
    // 도구: 재는 횟수. 끝난 판에서는 누를 수 없다
    $('ruler-counts').textContent = T.tool[showCounts ? 'on' : 'off'];
    $('ruler-counts').setAttribute('aria-pressed', String(showCounts));
    $('ruler-counts').disabled = round.done;
    frame.showWhy();
  }

  /** 오른쪽 칸: 내 기록(가장 좋은 기록과 그때의 자), "여기까지 할래요" */
  function drawPad(round, item, playing) {
    const { board } = round;
    const record = isRecord(round) && item.best !== null;
    $('ruler-best-box').hidden = !record;
    if (record) {
      const span = spanOf(board, round.at);
      $('ruler-best').textContent = board.kind === 'golomb' ? fill(T.best.golomb, { n: item.best }) : fill(T.best.marks, { k: item.best });
      drawMini($('ruler-best-picture'), { span, marks: item.bestMarks, numbers: 'marks' });
    }
    $('ruler-stop').hidden = !(playing && isRecord(round) && anyBest(round));
  }

  /** 짚은 길이의 두 눈금(지금 눈금에 그 길이가 없으면 null) */
  function ringOf(pairs) {
    if (!shown) return null;
    const list = pairs.get(shown.d);
    if (!list || shown.turn >= list.length) return null;
    return list[shown.turn];
  }

  function statusOf(round, item, pairs) {
    const { board } = round;
    if (round.done) return T.status.done;
    if (item.done) return T.status.solved;
    const span = spanOf(board, round.at);
    if (board.kind === 'golomb') {
      if (item.marks.length < board.count) return fill(T.status['golomb-few'], { k: board.count, n: item.marks.length });
      return isDone(board, round.at, item.marks) ? T.status['golomb-done'] : T.status['golomb-twice'];
    }
    if (sameMarks(item.marks, fixedOf(board, round.at)) && item.history.length === 0) return T.status.start;
    const missing = span - [...pairs.keys()].filter((d) => d <= span).length;
    return missing === 0 ? fill(T.status.all, { n: span }) : fill(T.status.missing, { k: missing });
  }

  // ---- 눈금 찍기 ----
  function tapPosition(at) {
    const { round } = frame;
    if (!round || round.done) return;
    const { board } = round;
    const item = itemOf(round);
    const span = spanOf(board, round.at);
    if (item.done || !Number.isInteger(at) || at < 0 || at > span) return;
    flash = null;
    if (fixedOf(board, round.at).includes(at)) {
      flash = T.status.fixed;
      draw();
      return;
    }
    const before = item.marks;
    let after;
    if (before.includes(at)) after = before.filter((x) => x !== at);
    else {
      if (board.kind === 'golomb' && before.length >= board.count) {
        // 찍지 않는다. 사실 하나와 할 수 있는 일 하나를 적는다
        round.refuseCount += 1;
        frame.note('full', { at });
        flash = fill(T.status.full, { k: board.count });
        draw();
        frame.keep();
        return;
      }
      after = sortMarks([...before, at]);
    }
    item.history = [...item.history, before].slice(-MAX_HISTORY);
    item.marks = after;
    round.tapCount += 1;
    shown = null;
    frame.note('mark', { at, on: after.includes(at), item: round.at });
    settle(before, after);
  }

  /** 눈금이 바뀐 뒤: 자가 다 되었으면(또는 다 된 채로 기록이 좋아졌으면) 기록을 적고 말한다 */
  function settle(before, after) {
    const { round } = frame;
    const { board } = round;
    const at = round.at;
    const item = round.items[at];
    const now = isDone(board, at, after);
    const was = isDone(board, at, before);
    if (!now || (was && recordOf(board, after) >= recordOf(board, before))) {
      draw();
      frame.persist();
      return;
    }
    const mine = recordOf(board, after);
    const previous = item.best;
    item.completions = [...item.completions, mine];
    if (previous === null || mine < previous) {
      item.best = mine;
      item.bestMarks = after.slice();
    }
    const best = bestScore(board, at);
    const reached = !isRecord(round) || mine === best;
    const answer = `done:${at}:${mine}`;
    round.answers.push({ t: frame.stamp(), answer, correct: reached, guess: reached ? null : 'more-than-best' });
    frame.note('answer', { answer, correct: reached });
    if (!reached) {
      // 틀렸다고 하지 않는다. 지금 기록을 말하고 더 좋은 자가 있을지 묻는다(풀이 프로그램이 더 좋은 자를 안다)
      round.wrongCount += 1;
      draw();
      frame.persist();
      frame.say(recordLine(board, mine, previous));
      return;
    }
    const openBefore = openOf(round);
    item.done = true;
    if (round.items.every((it) => it.done)) {
      flash = null;
      frame.finish('solved');
      return;
    }
    // 이어지는 자: 이 자는 다 되었다. 다음 열린 자로 간다(새로 열린 자가 있으면 그 사실도 말한다)
    const open = openOf(round);
    round.at = open[0];
    const fresh = open.find((index) => !openBefore.includes(index));
    draw();
    frame.persist();
    const lines = [fill(T.play.solved, { n: spanOf(board, at), k: mine })];
    if (fresh !== undefined) lines.push(fill(T.play.opened, { n: spanOf(board, fresh) }));
    frame.say(lines.join(' '));
  }

  /** 다 되었지만 가장 좋은 기록이 아닐 때 하는 말 */
  function recordLine(board, mine, previous) {
    if (board.kind === 'golomb') {
      if (previous === null || mine < previous) return fill(T.play.shorter, { n: mine });
      if (mine === previous) return fill(T.play['shorter-same'], { n: mine });
      return fill(T.play['shorter-more'], { n: mine, k: previous });
    }
    const L = spanOf(board, frame.round.at);
    if (previous === null || mine < previous) return fill(T.play.fewer, { k: mine, n: L });
    if (mine === previous) return fill(T.play.same, { k: mine });
    return fill(T.play.more, { k: mine, n: previous });
  }

  /** 길이 칸을 눌렀다: 그 길이를 재는 두 눈금을 짚는다. 같은 칸을 다시 누르면 다른 두 눈금, 더 없으면 짚기를 끈다 */
  function tapLength(d) {
    const { round } = frame;
    if (!round || round.done) return;
    const list = pairsByLength(itemOf(round).marks).get(d);
    flash = null;
    if (!list) {
      shown = null;
      flash = T.status.unmeasured;
      draw();
      return;
    }
    const turn = shown && shown.d === d ? shown.turn + 1 : 0;
    shown = turn < list.length ? { d, turn } : null;
    if (shown) {
      const [a, b] = list[turn];
      const line = fill(byEnd(T.status, 'pair', d), { k: a, f: b, n: d });
      flash = list.length > 1 ? `${line}. ${T.status['pair-more']}` : line;
    }
    frame.note('length', { d, turn: shown ? turn : null });
    draw();
  }

  /** 이어지는 자의 이름표를 눌렀다: 열린 다른 자로 간다 */
  function tapTab(index) {
    const { round } = frame;
    if (!round || round.done || index === round.at || !openOf(round).includes(index)) return;
    round.at = index;
    round.switchCount += 1;
    shown = null;
    flash = null;
    frame.note('switch', { item: index });
    draw();
    frame.persist();
    frame.say(fill(T.play.switched, { n: spanOf(round.board, index) }));
  }

  /** 무르기: 지금 자에서 한 일 하나를 무른다 */
  function undo() {
    const { round } = frame;
    const item = itemOf(round);
    if (round.done || item.done || item.history.length === 0) return;
    item.marks = item.history.at(-1).slice();
    item.history = item.history.slice(0, -1);
    round.undoCount += 1;
    flash = null;
    shown = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 모습에 한 말(몇 개로 모두 잰다는 말)은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  /** 처음으로: 지금 자를 처음 눈금만 있는 자로 돌린다. 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    const item = itemOf(round);
    const fixed = fixedOf(round.board, round.at);
    if (round.done || item.done || sameMarks(item.marks, fixed)) return;
    item.history = [...item.history, item.marks].slice(-MAX_HISTORY);
    item.marks = fixed.slice();
    round.resetCount += 1;
    flash = null;
    shown = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  /** "여기까지 할래요": 기록 깨기 판을 지금까지의 기록으로 끝낸다. 이것도 끝까지 한 판이다 */
  function stop() {
    const { round } = frame;
    if (!round || round.done || !isRecord(round) || !anyBest(round)) return;
    round.stopped = true;
    flash = null;
    frame.note('stop', { best: round.items.map((item) => item.best) });
    frame.finish('solved');
  }

  // ---- 재는 횟수 보기 ----
  function toggleCounts() {
    const { round } = frame;
    if (!round || round.done) return;
    round.countOn = !round.countOn;
    if (round.countOn) {
      round.countShown = true;
      round.countCount += 1;
    }
    flash = null;
    frame.note('count-tool', { on: round.countOn });
    draw();
    frame.keep();
  }

  // ---- 끝났을 때 하는 말: 한 일과 사실만 말한다 ----
  function rightLine(round, solution) {
    const { board } = round;
    if (board.kind === 'golomb') {
      const [item] = round.items;
      const [info] = solution.items;
      if (round.stopped) return [fill(T.right['stopped-golomb'], { n: item.best })];
      const parts = [fill(T.right.golomb, { k: board.count, n: info.best })];
      if (info.best > info.bound) parts.push(fill(T.right['golomb-tried'], { f: info.best - 1 }));
      if (item.completions.length > 1) parts.push(fill(T.right['golomb-first-try'], { f: item.completions[0] }));
      return parts;
    }
    if (board.lengths.length > 1) {
      const done = round.items.filter((item) => item.done).length;
      if (round.stopped) return [done === 0 ? T.right['stopped-none'] : fill(T.right['stopped-chain'], { k: done })];
      return [fill(T.right.chain, { k: board.lengths.length, f: round.items.map((item) => item.best).join(', ') })];
    }
    const [item] = round.items;
    const [info] = solution.items;
    const L = board.lengths[0];
    // 짝의 수가 길이의 수와 같으면 모든 길이를 꼭 한 번씩 잰다(길이 3인 자의 눈금 3개, 길이 6인 자의 눈금 4개)
    const once = (k) => (pairCount(k) === L ? [fill(T.right.once, { n: L })] : []);
    if (round.mode === 'first') {
      const k = item.marks.length;
      return [fill(T.right.first, { k, n: L }), ...once(k), k === info.best ? T.right.fewest : T.right['first-more']];
    }
    if (round.stopped) return [fill(T.right.stopped, { k: item.best })];
    const parts = [fill(T.right.first, { k: info.best, n: L }), ...once(info.best), T.right.fewest];
    if (info.best > info.bound) parts.push(fill(T.right.tried, { f: info.best - 1 }));
    if (item.completions.length > 1) parts.push(fill(T.right['first-try'], { f: item.completions[0] }));
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 풀이: 가장 좋은 자들(뒤집은 것은 하나로)과 그 수. 이어지는 자는 자마다 하나 */
  function solutionPages(round) {
    const { board } = round;
    if (board.kind === 'golomb') {
      const result = solve(board).items[0];
      const shapes = goldShapes(board.count);
      const say = [fill(T.solution.golomb, { k: board.count, n: result.best }), shapes.length === 1 ? T.solution.one : fill(T.solution.count, { f: shapes.length })].join(' ');
      return [{ say, nodes: [rowOf(shapes.slice(0, SHOW_SHAPES).map((marks) => rulerCard({ span: result.best, marks }, fill(T.solution.note, { k: board.count }), { big: true })))] }];
    }
    if (board.lengths.length > 1) {
      const cards = board.lengths.map((L) => {
        const result = solveLength(L);
        return rulerCard({ span: L, marks: result.shapes[0] }, fill(T.solution['note-chain'], { n: L, k: result.fewest }));
      });
      return [{ say: T.solution.chain, nodes: [rowOf(cards)] }];
    }
    const L = board.lengths[0];
    const result = solveLength(L);
    const say = [fill(T.solution.fewest, { n: L, k: result.fewest }), result.count === 1 ? T.solution.one : fill(T.solution.count, { f: result.count })].join(' ');
    const cards = result.shapes.slice(0, SHOW_SHAPES).map((marks) => rulerCard({ span: L, marks }, fill(T.solution.note, { k: result.fewest }), { big: true }));
    return [{ say, nodes: [rowOf(cards)] }];
  }

  /** 같은 길이를 두 번 재지 않는 가장 짧은 자들(뒤집은 것은 하나로) */
  const goldShapes = (k) => shortestGolomb(k).shapes;

  /** "왜 그럴까?"의 그림 하나 */
  function figureOf(item) {
    const W = T.whyNotes;
    if (item.ruler) return [rulerCard({ span: item.span, marks: item.ruler, numbers: 'all' }, W[item.note], { big: true })];
    if (item.lengths) {
      const counts = new Map([...pairsByLength(item.lengths).entries()].map(([d, list]) => [d, list.length]));
      return [lengthsCard({ top: item.top, counts, extra: (d, many) => (many > 0 ? fill(T.labels.times, { k: many }) : '') }, W[item.note])];
    }
    if (item.pairs) {
      const marks = item.pairs;
      const cards = [];
      for (let i = 0; i < marks.length; i++) {
        for (let j = i + 1; j < marks.length; j++) cards.push(rulerCard({ span: item.span, marks, ring: [marks[i], marks[j]] }, fill(W.pair, { k: marks[i], f: marks[j], n: marks[j] - marks[i] })));
      }
      return cards;
    }
    // 눈금 수와 짝의 수의 표
    const rows = item.table.map((m) => [fill(W.marks, { k: m }), fill(W.pairs, { k: pairCount(m) })]);
    return [tableCard([W['head-marks'], W['head-pairs']], rows)];
  }

  /**
   * "왜 그럴까?": 길이 6인 자를 눈금 4개로(꼭 한 번씩) → 짝을 세면 6개, 짝 하나는 길이 하나 → 눈금 수와 짝의 수의 표
   * → 짝이 모자라지 않는데도 안 되는 길이 10인 자와 이름(골롬 자, 짝의 수의 식). 이 형식의 판을 한 번 끝까지 한 뒤에 열린다.
   */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다
      get nodes() {
        return [rowOf(slide.figures.flatMap(figureOf))];
      },
    }));
  }

  // ---- 직접 만들기: 자의 길이를 고른다 ----
  const draftOk = (value) => Number.isInteger(value) && value >= MAKE_MIN && value <= MAKE_MAX;

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    return saved && saved.kind === 'all' && Array.isArray(saved.lengths) && saved.lengths.length === 1 && draftOk(saved.lengths[0]) ? saved.lengths[0] : FIRST_MAKE;
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    $('ruler-make-n').textContent = fill(T.make.length, { n: draft });
    $('ruler-make-fewer').disabled = draft <= MAKE_MIN;
    $('ruler-make-more').disabled = draft >= MAKE_MAX;
    drawMini($('ruler-make-board'), { span: draft, marks: [0, draft], numbers: 'all' });
    $('ruler-make-result').textContent = made ? made.line : '';
    $('ruler-make-picture').replaceChildren(...(made?.node ? [made.node] : []));
    $('ruler-make-play').disabled = madeBoard() === null;
  }

  function setLength(value) {
    if (!draftOk(value)) return;
    // 선생님이 따진 뒤에 길이를 바꾸면, 앞의 길이에 한 말이 남지 않게 길이가 바뀌었다는 사실만 말한다
    const said = made !== null;
    draft = value;
    made = null;
    log.saveDraft({ kind: 'all', lengths: [draft] }, FORMAT);
    drawMake();
    if (said) frame.talkers.make.say(T.make.changed);
  }

  /** 선생님이 따진다: 가장 적은 눈금 수, 더 적게는 왜 안 되는지(짝이 모자라는지, 모든 경우를 해 보았는지), 그런 자의 수와 하나 */
  function solveDraft() {
    const L = draft;
    const result = solveLength(L);
    const less = result.fewest - 1;
    const lines = [fill(T.make.result, { n: L, k: result.fewest })];
    lines.push(fill(T.make[pairCount(less) < L ? 'reason-pairs' : 'reason-tried'], { f: less, total: pairCount(less) }));
    lines.push(result.count === 1 ? T.make.one : fill(T.make.count, { k: result.count }));
    const line = lines.join(' ');
    made = { line, node: rulerCard({ span: L, marks: result.shapes[0] }, T.make.picture, { big: true }) };
    drawMake();
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board: { kind: 'all', lengths: [L] },
      solution: { possible: true, best: result.fewest, bound: result.bound, count: result.count, example: result.shapes[0] },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판) */
  function madeBoard() {
    const board = { kind: 'all', lengths: [draft] };
    return checkBoard(board) === null ? board : null;
  }

  function playDraft() {
    const board = madeBoard();
    if (!board) return;
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('ruler-counts').addEventListener('click', toggleCounts);
  $('ruler-stop').addEventListener('click', stop);
  $('ruler-make-fewer').addEventListener('click', () => setLength(draft - 1));
  $('ruler-make-more').addEventListener('click', () => setLength(draft + 1));
  $('ruler-make-solve').addEventListener('click', solveDraft);
  $('ruler-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: copyBoard(board), // 판: 1부터 길이까지 재는 자(들), 또는 같은 길이를 두 번 재지 않는 자(src/core/ruler.js)
      // 자마다: 찍은 눈금, 무르기 차례, 가장 좋은 기록과 그때의 눈금, 다 만들었는가, 다 될 때마다의 기록
      items: Array.from({ length: itemCount(board) }, (_, index) => ({ marks: fixedOf(board, index), history: [], best: null, bestMarks: null, done: false, completions: [] })),
      at: 0, // 지금 만드는 자의 차례
      tapCount: 0, // 자리를 누른 수(찍기와 빼기)
      refuseCount: 0, // 눈금을 더 찍을 수 없는데 누른 수(같은 길이를 두 번 재지 않는 자)
      switchCount: 0, // 이어지는 자에서 다른 자로 간 수
      undoCount: 0,
      resetCount: 0,
      stopped: false, // "여기까지 할래요"로 끝냈는가
      wrongCount: 0, // 수준 맞추기가 보는 값: 다 되었지만 가장 좋은 기록이 아니었던 수
      countOn: false, // 지금 "재는 횟수 보기"를 켜 두었는가
      countShown: false, // 한 번이라도 켰는가
      countCount: 0, // 켠 수
    };
  }

  /** 적어 둔 판의 단계가 판의 종류와 맞는가 */
  function levelOk(saved) {
    if (saved.custom === true) return saved.level === MAKE_LEVEL && saved.mode === 'made';
    if (!Number.isInteger(saved.level) || saved.level < LADDER[0].level || saved.level > TOP_LEVEL) return false;
    return rungOf(saved.level).mode === saved.mode;
  }

  function validSaved(saved) {
    const { board } = saved;
    if (!MODES.includes(saved.mode) || checkBoard(board) !== null || !levelOk(saved)) return false;
    if (!Array.isArray(saved.items) || saved.items.length !== itemCount(board)) return false;
    for (const [index, item] of saved.items.entries()) {
      if (!item || !marksOk(board, index, item.marks) || !Array.isArray(item.history) || !item.history.every((marks) => marksOk(board, index, marks))) return false;
      if (!(item.best === null || count(item.best)) || !(item.bestMarks === null || marksOk(board, index, item.bestMarks))) return false;
      if (typeof item.done !== 'boolean' || !Array.isArray(item.completions) || !item.completions.every(count)) return false;
    }
    if (!Number.isInteger(saved.at) || saved.at < 0 || saved.at >= saved.items.length) return false;
    if (typeof saved.stopped !== 'boolean' || typeof saved.countOn !== 'boolean' || typeof saved.countShown !== 'boolean') return false;
    return [saved.tapCount, saved.refuseCount, saved.switchCount, saved.undoCount, saved.resetCount, saved.wrongCount, saved.countCount].every(count);
  }

  /** 작은 그림: 판의 자(이어지는 자는 첫 자, 같은 길이를 두 번 재지 않는 자는 0만 찍힌 자) */
  function drawSample(root, board) {
    drawMini(root, { span: spanOf(board, 0), marks: fixedOf(board, 0) });
  }

  return {
    id: FORMAT,
    T,
    padId: 'ruler-pad',
    makeId: 'make-ruler',
    // 자(긴 자는 두세 줄), 길이 칸, 이어지는 자의 이름표가 위아래로 놓인다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다
    ruleAside: true,
    homeIds: { sample: 'home-ruler-sample', blank: 'home-ruler-blank', ask: 'home-ruler-ask', play: 'home-ruler-play', pick: 'home-ruler-pick', make: 'home-ruler-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solve(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      try {
        return validSaved(saved);
      } catch {
        return false;
      }
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('ruler-board').hidden = !on;
      $('ruler-count').hidden = !on;
      $('ruler-counts').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      flash = null;
      shown = null;
    },
    draw,
    ended() {
      flash = null;
      shown = null;
    },
    ruleLine(round) {
      const key = ruleKey(round);
      if (key === 'golomb') return fill(T.rules.golomb, { k: round.board.count });
      if (key === 'chain') return T.rules.chain;
      return fill(T.rules[key], { n: round.board.lengths[0] });
    },
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.tapCount > 0 || round.countCount > 0 || round.refuseCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      return { at: round.at, marks: round.items.map((item) => item.marks.slice()), done: round.items.map((item) => item.done), best: round.items.map((item) => item.best), countOn: round.countOn };
    },
    /** 이 판보다 작은 판: 짧은 자, 첫 자가 짧은 이어지는 자, 눈금이 하나 적은 자 */
    smaller: (round, turn) => smallerRuler({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, best: solution.items.map((item) => item.best), bound: solution.items.map((item) => item.bound), count: solution.items.map((item) => item.count) },
        // 질문 힌트와 "재는 횟수 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.countShown ? 1 : 0),
        countShown: round.countShown,
        countCount: round.countCount,
        // 판을 떠날 때의 모습: 자마다 찍은 눈금, 가장 좋은 기록과 그때의 눈금, 다 만들었는가, 다 될 때마다의 기록
        items: round.items.map((item) => ({ marks: item.marks, best: item.best, bestMarks: item.bestMarks, done: item.done, completions: item.completions })),
        at: round.at,
        reachedBest: round.items.every((item, index) => item.best !== null && item.best === solution.items[index].best),
        stopped: round.stopped,
        tapCount: round.tapCount,
        refuseCount: round.refuseCount,
        switchCount: round.switchCount,
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
    /** 글자판: 자리와 길이 칸은 단추라서 저마다 Enter와 빈칸 글쇠로 누른다. Escape는 짚은 두 눈금을 놓는다 */
    onKey(event) {
      const { round } = frame;
      if (!round || $('ruler-pad').hidden || event.key !== 'Escape' || shown === null) return;
      shown = null;
      flash = null;
      draw();
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample,
    drawBlank(root) {
      drawMini(root, { span: 6, marks: [0, 1, 4, 6] });
    },
    /** 하던 판과 공책의 그림: 지금 만드는 자의 눈금 */
    drawResume(root, saved) {
      const at = Number.isInteger(saved.at) ? saved.at : 0;
      const marks = saved.items?.[at]?.marks;
      if (!Array.isArray(marks) || !marksOk(saved.board, at, marks)) {
        drawSample(root, saved.board);
        return;
      }
      drawMini(root, { span: spanOf(saved.board, at), marks });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawMini(root, { span: 6, marks: [0, 1, 4, 6] });
        return;
      }
      drawSample(root, generateBoard(entry.level, entry.picture.seed).board);
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
    /** 가장 좋은 기록(공책에 저절로 남는다). 모든 길이 재기(1단계)에는 없다 */
    bestOf(round) {
      if (!isRecord(round)) return null;
      const { board } = round;
      if (board.kind === 'golomb') {
        const [item] = round.items;
        return item.best === null ? null : { value: -item.best, name: fill(T.notebook.golomb, { k: board.count, n: item.best }) };
      }
      if (board.lengths.length > 1) {
        const done = round.items.filter((item) => item.done).length;
        return done === 0 ? null : { value: done, name: fill(T.notebook.chain, { n: board.lengths[0], k: done }) };
      }
      const [item] = round.items;
      return item.best === null ? null : { value: -item.best, name: fill(T.notebook.best, { n: board.lengths[0], k: item.best }) };
    },
  };
}
