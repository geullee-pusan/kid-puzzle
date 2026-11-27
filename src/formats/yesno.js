// 질문으로 맞히기: 판 화면에서 이 형식이 맡는 부분(수 칸들, 수 고르기와 묻기, 질문 수 정하기, 미리 정하기, "불가능해요", 반씩 나눠 보기,
// 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기(숨길 수의 끝과 질문 수를 정하면 선생님이 언제나 맞힐 수 있는지 따진다).
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/yesno.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 숨은 수는 1부터 n까지 가운데 하나다. 컴퓨터는 수를 미리 정해 두지 않고, 앞의 대답과 맞으면서 후보가 많이 남는 쪽으로 답한다(src/core/yesno.js).
// 하나씩 묻는 판: 수 칸을 누르거나 끌어서 고르고 "숨은 수가 이 안에 있나요?"를 누른다. 빠진 수는 회색과 빗금으로 남고 누를 수 없다.
//   후보가 하나 남으면 판이 끝난다. 정한 질문 수를 다 쓰고도 후보가 둘 이상이면 남은 후보의 수만 말하고 "다시 해 보기"를 낸다(틀렸다고 하지 않는다).
//   1단계는 질문 수를 정하지 않는다. 3단계("몇 번이면 될까요?")는 아이가 질문 수(1~6)를 먼저 정한다.
//   4단계와 직접 만든 판에는 "불가능해요" 단추와 왼쪽 칸의 "반씩 나눠 보기"가 있다. 도구를 켜면 지금 후보에서 질문마다 가장 고르게 갈라도 남을 수 있는
//   많은 쪽의 수를 판 아래에 띠로 적는다(사실 하나. 처음 켤 때 힌트 하나로 센다).
// 미리 정하는 판(5단계): 오른쪽 칸에서 질문을 고르고 수 칸을 눌러 그 질문에 넣거나 뺀다. 수 칸 아래에 질문마다 모양이 다른 표시 칸이 있다.
//   "한꺼번에 물어보기"를 누르면 컴퓨터가 표시 줄이 같은 수가 가장 많은 묶음의 대답을 고른다. 하나 남으면 끝나고, 아니면 대답과 남은 후보를 말한다.
// 무르기는 묻기(미리 정하는 판은 넣고 빼기)를 하나 되돌리고, 처음으로는 물은 것(넣은 수)을 모두 지운다. 고른 수는 무르기와 상관없다.
import T from '../content/yesno.json';
import { LADDER, MAKE_FIRST, MAKE_LEVEL, MAKE_N, MAKE_Q, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/yesno-ladder.js';
import {
  MAX_ASKS,
  MAX_HISTORY,
  MAX_Q,
  MIN_Q,
  aheadSets,
  answerAhead,
  ask,
  canPin,
  checkBoard,
  copyBoard,
  fewestAhead,
  fewestFor,
  halving,
  halvingAsks,
  numbersOf,
  replay,
  setOk,
  setsOk,
  solve,
} from '../core/yesno.js';
import { smallerYesno } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { drawChain, drawDoubling, drawTiles, figureCard, shapeOf } from '../ui/yesno-board.js';

const FORMAT = 'yesno';
const MODES = ['free', 'limit', 'pick', 'maybe', 'ahead', 'made'];
const LIMITS = Array.from({ length: MAX_Q - MIN_Q + 1 }, (_, at) => MIN_Q + at);

const count = (value) => Number.isInteger(value) && value >= 0;
const isAhead = (round) => round.board.kind === 'ahead';
/** "불가능해요"와 반씩 나눠 보기가 있는 판 */
const hasMaybe = (round) => round.mode === 'maybe' || round.mode === 'made';
const ruleKey = (round) => round.mode;
const copySets = (sets) => sets.map((set) => set.slice());

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createYesno(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 정하는 판 { n, q }
  let made = null; // 직접 만들기에서 선생님이 따진 것 { line, chain, k }

  // ---- 말 ----
  const faceOf = (answer) => (answer === 'yes' ? T.words.yes : T.words.no);
  /** 수들의 글: 셋 이상 이어지면 "1~4"처럼 */
  function numbersText(list) {
    if (list.length === 0) return T.words.none;
    const parts = [];
    let at = 0;
    while (at < list.length) {
      let end = at;
      while (end + 1 < list.length && list[end + 1] === list[end] + 1) end += 1;
      if (end - at >= 2) parts.push(fill(T.words.range, { k: list[at], n: list[end] }));
      else for (let item = at; item <= end; item++) parts.push(String(list[item]));
      at = end + 1;
    }
    return parts.join(T.words.join);
  }

  // ---- 판의 지금 모습 ----
  /** 지금 남은 후보 */
  function aliveOf(round) {
    if (isAhead(round)) return round.told ? round.told.alive.slice() : numbersOf(round.board.n);
    return replay(round.board, round.asked).alive;
  }
  /** 남은 질문 수(정하지 않았으면 null) */
  const restOf = (round) => (round.limit === null ? null : Math.max(0, round.limit - round.asked.length));
  /** 질문을 다 쓰고도 후보가 둘 이상 남았는가(미리 정하는 판은 대답을 들었는데 둘 이상 남았는가) */
  function isOut(round) {
    if (isAhead(round)) return round.told !== null && round.told.alive.length > 1;
    return round.limit !== null && !round.choosing && round.asked.length >= round.limit && aliveOf(round).length > 1;
  }
  /** 무르기에 쓰는 지금 모습 */
  const snapOf = (round) => ({ asked: round.asked.map((entry) => ({ ...entry, set: entry.set.slice() })), limit: round.limit, choosing: round.choosing, sets: copySets(round.sets), told: round.told ? { ...round.told, answers: round.told.answers.slice(), alive: round.told.alive.slice() } : null });
  function pushSnap(round) {
    round.history = [...round.history, snapOf(round)].slice(-MAX_HISTORY);
  }

  /** 칸의 읽어 주는 이름 */
  const labelOf = (round, alive) => (x) => {
    if (isAhead(round)) {
      const inside = round.sets.map((set, at) => (set.includes(x) ? at + 1 : 0)).filter(Boolean);
      return inside.length === 0 ? fill(T.labels['row-none'], { n: x }) : fill(T.labels.row, { n: x, f: inside.join(T.words.join) });
    }
    if (!alive.includes(x)) return fill(T.labels.out, { n: x });
    if (alive.length === 1) return fill(T.labels.found, { n: x });
    return fill(T.labels[round.picked.includes(x) ? 'picked' : 'alive'], { n: x });
  };

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    const ahead = isAhead(round);
    const alive = aliveOf(round);
    const out = isOut(round);
    const canTap = playing && !out && !round.choosing && (ahead ? round.told === null : alive.length > 1);
    drawTiles($('yesno-tiles'), {
      n: board.n,
      alive: ahead && round.told === null ? null : alive,
      picked: ahead ? [] : round.picked,
      found: alive.length === 1 ? alive[0] : null,
      sets: ahead ? round.sets : null,
      active: ahead && playing ? round.active : null,
      on: (x) => (ahead ? round.sets[round.active].includes(x) : round.picked.includes(x)),
      label: labelOf(round, alive),
      onPick: canTap ? tapTiles : undefined,
    });
    // 반씩 나눠 보기: 지금 후보와 남은 질문 수로 그린다
    const showChain = hasMaybe(round) && round.toolOn && playing;
    $('yesno-chain-box').hidden = !showChain;
    if (showChain) drawChain($('yesno-chain'), chainView(alive.length, restOf(round)));

    // 판 아래: 할 일이나 사실 한 줄, 남은 후보, 물은 질문, 남은 질문
    $('yesno-status').textContent = flash ?? statusOf(round, alive, out);
    $('yesno-left').textContent = String(alive.length);
    $('yesno-used-line').hidden = ahead;
    $('yesno-used').textContent = String(round.asked.length);
    const rest = restOf(round);
    $('yesno-rest-line').hidden = ahead || rest === null || round.choosing;
    $('yesno-rest').textContent = String(rest ?? 0);
    $('undo').disabled = !playing || round.history.length === 0;
    $('reset').disabled = !playing || !resettable(round);

    // 오른쪽 칸
    $('yesno-how-ask').hidden = ahead;
    $('yesno-how-ahead').hidden = !ahead;
    const picking = round.mode === 'pick' && round.choosing && playing;
    $('yesno-pick-box').hidden = !picking;
    if (picking) drawLimits();
    $('yesno-limit-line').hidden = !(round.mode === 'pick' && !round.choosing);
    $('yesno-limit').textContent = String(round.limit ?? 0);
    $('yesno-ask-box').hidden = ahead || !playing || round.choosing || out;
    $('yesno-picked').textContent = String(round.picked.length);
    $('yesno-ask').disabled = !canTap || round.picked.length === 0;
    $('yesno-clear').disabled = !canTap || round.picked.length === 0;
    $('yesno-ahead-box').hidden = !ahead || !playing;
    if (ahead) drawTabs(round, canTap);
    $('yesno-ask-all').disabled = !canTap;
    $('yesno-out-box').hidden = !(playing && out);
    $('yesno-out-line').textContent = out ? fill(T.status.told, { n: alive.length }) : '';
    $('yesno-list-title').hidden = ahead || round.asked.length === 0;
    drawList(round);
    $('yesno-maybe').hidden = !hasMaybe(round);
    $('yesno-impossible').disabled = !playing;

    // 왼쪽 칸: 반씩 나눠 보기(4단계와 직접 만든 판)
    $('yesno-halves').hidden = !hasMaybe(round);
    $('yesno-halves').textContent = T.tool[round.toolOn && playing ? 'on' : 'off'];
    $('yesno-halves').setAttribute('aria-pressed', String(round.toolOn && playing));
    $('yesno-halves').disabled = round.done;
    frame.showWhy();
  }

  function statusOf(round, alive, out) {
    if (round.done) {
      if (alive.length === 1) return T.status.done;
      // 그만두고 풀이를 본 되는 판에는 아무것도 적지 않는다(안 되는 판일 때만 그 사실을 적는다)
      return frame.solution && !frame.solution.possible ? T.status['maybe-done'] : '';
    }
    if (round.choosing) return T.status.choose;
    if (out) return isAhead(round) ? fill(T.status.told, { n: alive.length }) : T.status.out;
    if (isAhead(round)) return fill(T.status.edit, { k: round.active + 1 });
    if (round.picked.length > 0) return fill(T.status.picked, { n: round.picked.length });
    return T.status.pick;
  }

  /** 처음으로 되돌릴 것이 있는가 */
  function resettable(round) {
    if (isAhead(round)) return round.told !== null || round.sets.some((set) => set.length > 0);
    return round.asked.length > 0 || (round.mode === 'pick' && !round.choosing);
  }

  /** 반씩 나눠 보기의 띠 값: 지금 후보 수에서 남은 질문마다(정하지 않았으면 하나가 될 때까지) */
  function chainView(m, rest) {
    const chain = halving(m, rest ?? fewestFor(m));
    return { chain, name: T.tool.name, labels: chain.map((_, at) => (at === 0 ? T.labels.now : fill(T.labels.after, { k: at }))) };
  }

  /** 몇 번이면 될까요: 질문 수 단추들 */
  function drawLimits() {
    const { round } = frame;
    const items = LIMITS.map((q) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn yn-limit';
      button.dataset.q = String(q);
      button.textContent = String(q);
      button.setAttribute('aria-label', fill(T.labels.limit, { k: q }));
      button.setAttribute('aria-pressed', String(round.choice === q));
      return button;
    });
    $('yesno-limits').replaceChildren(...items);
    $('yesno-start').disabled = round.choice === null;
  }

  /** 미리 정하기: 질문마다 단추 하나(모양, 차례, 넣은 수) */
  function drawTabs(round, live) {
    const items = round.sets.map((set, at) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn wide yn-tab';
      button.dataset.at = String(at);
      button.disabled = !live;
      button.setAttribute('aria-pressed', String(round.active === at));
      const text = document.createElement('span');
      // 대답을 들었으면 질문마다의 대답도 적는다
      const told = round.told ? faceOf(round.told.answers[at]) : null;
      text.textContent = told ? fill(T.labels['tab-told'], { k: at + 1, f: numbersText(set), face: told }) : fill(T.labels.tab, { k: at + 1, f: numbersText(set) });
      button.append(shapeOf(at), text);
      return button;
    });
    $('yesno-tabs').replaceChildren(...items);
  }

  /** 물은 것의 목록(하나씩 묻는 판) */
  function drawList(round) {
    const items = isAhead(round)
      ? []
      : round.asked.map((entry, at) => {
          const item = document.createElement('li');
          item.className = 'yn-row';
          item.textContent = fill(T.labels.list, { no: ordinal(at + 1), f: numbersText(entry.set), face: faceOf(entry.answer), n: entry.left });
          return item;
        });
    $('yesno-list').replaceChildren(...items);
  }

  // ---- 고르기와 묻기 ----
  /** 수 칸을 눌렀거나 끌었다: 하나씩 묻는 판은 고르거나 빼고, 미리 정하는 판은 고르고 있는 질문에 넣거나 뺀다 */
  function tapTiles(xs, add) {
    const { round } = frame;
    if (!round || round.done || round.choosing || isOut(round)) return;
    flash = null;
    if (isAhead(round)) {
      const before = round.sets[round.active];
      const next = add ? [...new Set([...before, ...xs])].sort((a, b) => a - b) : before.filter((x) => !xs.includes(x));
      if (next.join() === before.join()) return;
      pushSnap(round);
      round.sets = round.sets.map((set, at) => (at === round.active ? next : set));
      round.pickCount += 1;
      round.moveCount += 1;
      frame.note('mark', { at: round.active, xs, add });
      draw();
      frame.persist();
      return;
    }
    const alive = aliveOf(round);
    const usable = xs.filter((x) => alive.includes(x));
    const next = add ? [...new Set([...round.picked, ...usable])].sort((a, b) => a - b) : round.picked.filter((x) => !usable.includes(x));
    if (next.join() === round.picked.join()) return;
    round.picked = next;
    round.pickCount += 1;
    frame.note('pick', { xs: usable, add });
    draw();
    frame.keep();
  }

  function clearPicked() {
    const { round } = frame;
    if (!round || round.done || round.picked.length === 0) return;
    round.picked = [];
    flash = null;
    frame.note('clear');
    draw();
    frame.keep();
  }

  /** "숨은 수가 이 안에 있나요?" */
  function askPicked() {
    const { round } = frame;
    if (!round || round.done || isAhead(round) || round.choosing || isOut(round) || round.asked.length >= MAX_ASKS) return;
    const alive = aliveOf(round);
    const set = round.picked.filter((x) => alive.includes(x));
    if (!setOk(alive, set) || alive.length < 2) return;
    const result = ask(round.board, alive, set, round.asked.length);
    pushSnap(round);
    round.asked = [...round.asked, { set, answer: result.answer, left: result.alive.length, t: frame.stamp() }];
    round.picked = [];
    round.askCount += 1;
    round.moveCount += 1;
    flash = T.status[result.answer];
    frame.note('ask', { set, answer: result.answer, left: result.alive.length });
    if (result.alive.length === 1) {
      complete();
      return;
    }
    const lines = [T.play[result.answer]];
    if (result.alive.length === alive.length) lines.push(T.play.same);
    if (isOut(round)) {
      flash = null;
      lines.splice(0, lines.length, ...outLines(round, result.alive.length));
      round.tries = [...round.tries, { asked: round.asked.length, left: result.alive.length, limit: round.limit }];
      round.wrongCount += 1;
    }
    draw();
    // 방금 물은 것이 목록 아래로 밀려 있으면 보이게 굴린다
    $('yesno-list').lastElementChild?.scrollIntoView?.({ block: 'nearest' });
    frame.persist();
    frame.say(lines.join(' '));
  }

  /** 질문을 다 썼을 때 하는 말: 남은 후보의 수, 그리고 풀이 프로그램이 구한 사실(정한 질문 수 안에 판과 몇 번이면 될까요만), 할 수 있는 일 */
  function outLines(round, left) {
    const lines = [fill(T.play.out, { n: left })];
    const { n } = round.board;
    if (round.mode === 'limit' || round.mode === 'pick') {
      lines.push(canPin(n, round.limit) ? fill(T.play['out-can'], { k: round.limit }) : fill(T.play['out-hide'], { n, k: round.limit }));
    }
    lines.push(T.play['out-next']);
    return lines;
  }

  /** 후보가 하나 남았다: 판이 끝난다. 몇 번이면 될까요에서 가장 적은 질문 수보다 많이 정했으면 수준 맞추기에서 "한 번에"로 보지 않는다 */
  function complete() {
    const { round } = frame;
    const k = isAhead(round) ? round.board.q : round.asked.length;
    const fewest = isAhead(round) ? fewestAhead(round.board.n) : fewestFor(round.board.n);
    const limit = isAhead(round) ? round.board.q : round.limit;
    const least = (limit ?? k) === fewest;
    round.answers.push({ t: frame.stamp(), answer: `found:${aliveOf(round)[0]}`, correct: true, guess: least ? null : 'more-than-fewest' });
    if (round.mode === 'pick' && !least) round.wrongCount += 1;
    flash = null;
    frame.note('found', { x: aliveOf(round)[0], k });
    frame.finish('solved');
  }

  // ---- 몇 번이면 될까요: 질문 수 정하기 ----
  function setChoice(q) {
    const { round } = frame;
    if (!round || round.done || !round.choosing || !LIMITS.includes(q)) return;
    round.choice = q;
    flash = null;
    draw();
    frame.keep();
  }

  function startLimit() {
    const { round } = frame;
    if (!round || round.done || !round.choosing || round.choice === null) return;
    pushSnap(round);
    round.limit = round.choice;
    round.choosing = false;
    round.chosen = [...round.chosen, round.limit];
    round.moveCount += 1;
    flash = null;
    frame.note('limit', { q: round.limit });
    draw();
    frame.persist();
    frame.say(fill(T.play.chosen, { k: round.limit }));
  }

  // ---- 미리 정하기 ----
  function setActive(at) {
    const { round } = frame;
    if (!round || round.done || !isAhead(round) || !(at in round.sets) || round.active === at) return;
    round.active = at;
    flash = null;
    draw();
    frame.keep();
  }

  /** "한꺼번에 물어보기" */
  function askAll() {
    const { round } = frame;
    if (!round || round.done || !isAhead(round) || round.told !== null || round.asked.length >= MAX_ASKS) return;
    pushSnap(round);
    const told = answerAhead(round.board, round.sets);
    round.told = told;
    round.asked = [...round.asked, { set: [], answer: told.key, left: told.alive.length, t: frame.stamp(), sets: copySets(round.sets) }].slice(-MAX_ASKS);
    round.askCount += 1;
    round.moveCount += 1;
    flash = null;
    frame.note('ask-all', { sets: copySets(round.sets), answers: told.answers, left: told.alive.length });
    if (told.alive.length === 1) {
      complete();
      return;
    }
    round.tries = [...round.tries, { left: told.alive.length, sets: copySets(round.sets) }];
    round.wrongCount += 1;
    draw();
    frame.persist();
    const said = told.answers.map(faceOf).join(T.words.join);
    frame.say([fill(T.play.told, { f: said, n: told.alive.length }), fill(T.play['told-same'], { f: told.alive.join(T.words.join) }), T.play['out-next-ahead']].join(' '));
  }

  // ---- 다시 해 보기, 무르기, 처음으로 ----
  /** 질문을 다 쓴 뒤의 "다시 해 보기": 처음부터(몇 번이면 될까요는 질문 수를 다시 정하기부터, 미리 정하는 판은 정한 질문을 그대로 두고 대답만 지운다) */
  function again() {
    const { round } = frame;
    if (!round || round.done || !isOut(round)) return;
    pushSnap(round);
    round.retryCount += 1;
    round.picked = [];
    flash = null;
    frame.note('again');
    if (isAhead(round)) {
      round.told = null;
      draw();
      frame.persist();
      frame.say(T.play['again-ahead']);
      return;
    }
    round.asked = [];
    if (round.mode === 'pick') {
      round.choosing = true;
      round.choice = round.limit;
    }
    draw();
    frame.persist();
    frame.say(round.mode === 'pick' ? T.play['again-pick'] : fill(T.play.again, { n: round.board.n }));
  }

  /** 한 번 무르기(처음으로와 다시 해 보기도 무를 수 있다) */
  function undo() {
    const { round } = frame;
    if (!round || round.done || round.history.length === 0) return;
    const snap = round.history[round.history.length - 1];
    round.history = round.history.slice(0, -1);
    round.asked = snap.asked;
    round.limit = snap.limit;
    round.choosing = snap.choosing;
    round.sets = snap.sets;
    round.told = snap.told;
    round.picked = [];
    round.undoCount += 1;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 모습에 한 말(대답, 다 썼다는 말)은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  /** 처음으로: 물은 것(미리 정하는 판은 넣은 수와 대답)을 모두 지운다. 몇 번이면 될까요는 질문 수 정하기로 돌아간다. 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (!round || round.done || !resettable(round)) return;
    pushSnap(round);
    round.asked = [];
    round.picked = [];
    if (isAhead(round)) {
      round.sets = round.sets.map(() => []);
      round.told = null;
      round.active = 0;
    }
    if (round.mode === 'pick') {
      round.choosing = true;
      round.choice = round.limit;
    }
    round.resetCount += 1;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  // ---- "불가능해요"와 반씩 나눠 보기 ----
  /** 되는 판이면 틀렸다고 하지 않고 되는 판이라는 사실만 말한다. 판은 그대로 이어진다 */
  function sayImpossible() {
    const { round, solution } = frame;
    if (!round || round.done || !hasMaybe(round)) return;
    const correct = solution.possible === false;
    const guess = correct ? null : 'impossible-on-possible';
    round.answers.push({ t: frame.stamp(), answer: 'impossible', correct, guess });
    frame.note('answer', { answer: 'impossible', correct, guess });
    if (correct) {
      flash = null;
      frame.finish('solved');
      return;
    }
    round.impossibleCount += 1;
    round.wrongCount += 1;
    flash = null;
    draw();
    frame.persist();
    frame.say(fill(T.play['possible-press'], { k: round.limit }));
  }

  function toggleTool() {
    const { round } = frame;
    if (!round || round.done || !hasMaybe(round)) return;
    round.toolOn = !round.toolOn;
    if (round.toolOn) {
      round.toolShown = true;
      round.toolCount += 1;
    }
    flash = null;
    frame.note('tool', { on: round.toolOn, chain: round.toolOn ? halving(aliveOf(round).length, restOf(round) ?? 0) : null });
    draw();
    frame.keep();
  }

  // ---- 끝났을 때 하는 말: 한 일과 사실만 말한다 ----
  function rightLine(round, solution) {
    const { n } = round.board;
    if (round.answers.at(-1)?.answer === 'impossible') {
      const k = round.asked.length;
      return [k > 0 ? fill(T.right['impossible-tried'], { k }) : T.right['impossible-untried'], fill(T.right.reason, { n, k: round.limit, f: solution.chain[solution.chain.length - 1] })];
    }
    const parts = [];
    if (isAhead(round)) {
      const q = round.board.q;
      parts.push(fill(T.right['done-ahead'], { k: q }));
      if (q === solution.fewest) parts.push(fill(T.right['least-ahead'], { n, k: q }));
    } else {
      const k = round.asked.length;
      if (round.mode === 'free') parts.push(fill(T.right['done-free'], { k }));
      else if (round.mode === 'pick') parts.push(fill(T.right['done-pick'], { k: round.limit }));
      else parts.push(fill(T.right['done-limit'], { total: round.limit, k }));
      if (round.impossibleCount > 0) parts.push(T.right['after-press']);
      const used = round.mode === 'pick' ? round.limit : k;
      if (used > solution.fewest) parts.push(T.right[round.mode === 'pick' ? 'fewer-pick' : 'fewer']);
      else parts.push(fill(T.right.least, { n, k: used }));
    }
    if (round.tries.length > 0) parts.push(fill(T.right.tries, { n: round.tries.length }));
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 풀이: 하나씩 묻는 판은 앞쪽 절반을 묻는 차례, 미리 정하는 판은 표시 줄이 모두 다른 질문들, 안 되는 판은 반씩 나눠 보기의 띠 */
  function solutionPages(round, solution) {
    const { board } = round;
    const { n } = board;
    if (!solution.possible) {
      const view = chainView(n, board.q);
      const last = view.chain[view.chain.length - 1];
      return [{ say: fill(T.solution.impossible, { n, k: board.q }), nodes: [rowOf([figureCard((root) => drawChain(root, view), fill(T.solution['chain-note'], { k: board.q, n: last }), { wide: true })])] }];
    }
    if (board.kind === 'ahead') {
      const sets = aheadSets(n, board.q);
      return [{ say: fill(T.solution.ahead, { k: board.q }), nodes: [rowOf([figureCard((root) => drawTiles(root, { n, sets, mid: true }), T.solution['ahead-note'], { wide: true })])] }];
    }
    const steps = halvingAsks(board);
    const cards = [figureCard((root) => drawTiles(root, { n, mid: true }), fill(T.solution.start, { n }))];
    let alive = numbersOf(n);
    for (const step of steps) {
      const before = alive;
      alive = step.alive;
      const shown = alive;
      cards.push(figureCard((root) => drawTiles(root, { n, alive: shown, picked: step.set.filter((x) => before.includes(x)), mid: true }), fill(T.solution.step, { f: numbersText(step.set), face: faceOf(step.answer), n: shown.length })));
    }
    return [{ say: fill(T.solution.halves, { k: steps.length }), nodes: [rowOf(cards)] }];
  }

  /** "왜 그럴까?"의 그림 하나 */
  function figureNode(item) {
    if (item.tiles) {
      const board = { kind: 'ask', n: item.tiles.n, q: null, tie: T.figureTie };
      const asked = [];
      let alive = numbersOf(board.n);
      for (const set of item.tiles.asks) {
        const result = ask(board, alive, set, asked.length);
        asked.push(set);
        alive = result.alive;
      }
      const last = item.tiles.asks[item.tiles.asks.length - 1] ?? [];
      return figureCard((root) => drawTiles(root, { n: board.n, alive, picked: last, found: alive.length === 1 ? alive[0] : null, mid: true }), item.note);
    }
    if (item.chain) return figureCard((root) => drawChain(root, { chain: item.chain, labels: item.chain.map((_, at) => (at === 0 ? T.labels.now : fill(T.labels.after, { k: at }))) }), item.note, { wide: true });
    if (item.double) return figureCard((root) => drawDoubling(root, { rows: item.double, head: T.labels['double-head'] }), item.note, { wide: true });
    return figureCard((root) => drawTiles(root, { n: item.rows.n, sets: item.rows.sets, bits: item.bits === true, mid: true }), item.note, { wide: true });
  }

  /** "왜 그럴까?": 하나씩 묻기 → 반씩 묻기 → 많은 쪽이 남는다(1부터 9까지) → 두 배씩(이름) → 미리 정한 질문의 줄(이진법) */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다
      get nodes() {
        return [rowOf(slide.figures.map(figureNode))];
      },
    }));
  }

  // ---- 직접 만들기: 숨길 수의 끝(2~32)과 질문 수(1~6)를 정하면 선생님이 따진다 ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const ok = saved && Number.isInteger(saved.n) && Number.isInteger(saved.q) && saved.n >= MAKE_N[0] && saved.n <= MAKE_N[1] && saved.q >= MAKE_Q[0] && saved.q <= MAKE_Q[1];
    return ok ? { n: saved.n, q: saved.q } : { ...MAKE_FIRST };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    $('yesno-make-n').textContent = fill(T.make.size, { n: draft.n });
    $('yesno-make-q').textContent = fill(T.make.questions, { k: draft.q });
    $('yesno-make-fewer').disabled = draft.n <= MAKE_N[0];
    $('yesno-make-more').disabled = draft.n >= MAKE_N[1];
    $('yesno-make-fewer-q').disabled = draft.q <= MAKE_Q[0];
    $('yesno-make-more-q').disabled = draft.q >= MAKE_Q[1];
    drawTiles($('yesno-make-board'), { n: draft.n });
    $('yesno-make-result').textContent = made ? made.line : '';
    const picture = $('yesno-make-picture');
    if (made) picture.replaceChildren(figureCard((root) => drawChain(root, chainView(draft.n, draft.q)), fill(T.make.picture, { k: draft.q, n: made.last }), { wide: true }));
    else picture.replaceChildren();
  }

  function changeDraft(next) {
    if (next.n < MAKE_N[0] || next.n > MAKE_N[1] || next.q < MAKE_Q[0] || next.q > MAKE_Q[1]) return;
    const said = made !== null;
    draft = next;
    made = null;
    log.saveDraft({ ...draft }, FORMAT);
    drawMake();
    if (said) frame.talkers.make.say(T.make.changed);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판). 시드는 끝과 질문 수로 정한다(같은 판은 늘 같은 대답) */
  const madeBoard = () => (draft ? { kind: 'ask', n: draft.n, q: draft.q, tie: draft.n * 10 + draft.q } : null);

  /** "선생님, 풀어 보세요": 언제나 맞힐 수 있는지, 가장 적은 질문 수, 그 질문 수로 맞힐 수 있는 가장 큰 판(맞힐 수 없는 가장 작은 판)인지 */
  function solveDraft() {
    const board = madeBoard();
    const { n, q } = board;
    const result = solve(board);
    const lines = [];
    if (result.possible) {
      lines.push(fill(T.make.can, { n, k: q }));
      if (q > result.fewest) lines.push(fill(T.make['can-more'], { f: result.fewest }));
      if (!canPin(n + 1, q)) lines.push(fill(T.make['edge-can'], { k: q }));
    } else {
      lines.push(fill(T.make.hide, { n, k: q, f: result.fewest }));
      if (canPin(n - 1, q)) lines.push(fill(T.make['edge-hide'], { k: q }));
    }
    const line = lines.join(' ');
    made = { line, last: result.chain[result.chain.length - 1] };
    drawMake();
    const now = new Date().toISOString();
    log.saveRecord({ kind: 'made', v: 1, id: log.newId('m'), format: FORMAT, startedAt: now, endedAt: now, board, solution: { possible: result.possible, fewest: result.fewest, chain: result.chain } });
    log.flush();
    frame.talkers.make.say(line);
  }

  function playDraft() {
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board: madeBoard() });
  }

  // ---- 단추 잇기 ----
  $('yesno-ask').addEventListener('click', askPicked);
  $('yesno-clear').addEventListener('click', clearPicked);
  $('yesno-limits').addEventListener('click', (event) => {
    const q = event.target.closest('button')?.dataset.q;
    if (q !== undefined) setChoice(Number(q));
  });
  $('yesno-start').addEventListener('click', startLimit);
  $('yesno-tabs').addEventListener('click', (event) => {
    const at = event.target.closest('button')?.dataset.at;
    if (at !== undefined) setActive(Number(at));
  });
  $('yesno-ask-all').addEventListener('click', askAll);
  $('yesno-again').addEventListener('click', again);
  $('yesno-impossible').addEventListener('click', sayImpossible);
  $('yesno-halves').addEventListener('click', toggleTool);
  $('yesno-make-fewer').addEventListener('click', () => changeDraft({ ...draft, n: draft.n - 1 }));
  $('yesno-make-more').addEventListener('click', () => changeDraft({ ...draft, n: draft.n + 1 }));
  $('yesno-make-fewer-q').addEventListener('click', () => changeDraft({ ...draft, q: draft.q - 1 }));
  $('yesno-make-more-q').addEventListener('click', () => changeDraft({ ...draft, q: draft.q + 1 }));
  $('yesno-make-solve').addEventListener('click', solveDraft);
  $('yesno-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    const start = copyBoard(board);
    const mode = custom ? 'made' : rungOf(level).mode;
    return {
      mode,
      board: start, // 판: 종류, 숨길 수의 끝, 질문 수, 시드
      limit: mode === 'pick' ? null : start.q, // 정한 질문 수(정하지 않았으면 null)
      choosing: mode === 'pick', // 몇 번이면 될까요에서 질문 수를 정하는 중인가
      choice: null, // 그때 고른 질문 수
      chosen: [], // 정한 질문 수들(차례대로)
      asked: [], // 이번에 물은 것 { set, answer, left, t }(미리 정하는 판은 한꺼번에 물은 것 { set: [], answer: 대답의 줄, left, t, sets })
      picked: [], // 고른 수
      sets: start.kind === 'ahead' ? Array.from({ length: start.q }, () => []) : [], // 미리 정한 질문마다 넣은 수
      active: 0, // 미리 정하기에서 고르고 있는 질문
      told: null, // 미리 정한 질문의 대답 { key, answers, alive }
      history: [], // 무르기를 위한 앞의 모습들
      tries: [], // 질문을 다 쓰고도 후보가 둘 이상 남은 해 보기들
      askCount: 0, // 물은 수(미리 정하는 판은 한꺼번에 물은 수)
      pickCount: 0, // 수를 고르거나 넣고 뺀 수
      retryCount: 0, // 다시 해 보기를 누른 수
      undoCount: 0,
      resetCount: 0,
      impossibleCount: 0, // 되는 판에 "불가능해요"를 누른 수
      wrongCount: 0, // 질문을 다 쓰고 둘 이상 남은 수, 되는 판의 "불가능해요", 몇 번이면 될까요에서 가장 적은 수보다 많이 정해 끝낸 판
      moveCount: 0, // 이 판에서 한 일의 수(묻기, 넣고 빼기, 질문 수 정하기)
      toolOn: false, // 지금 반씩 나눠 보기를 켜 두었는가
      toolShown: false, // 한 번이라도 켰는가
      toolCount: 0, // 켠 수
    };
  }

  /** 적어 둔 판의 단계가 판의 종류와 맞는가 */
  const levelOk = (saved) => {
    if (saved.custom === true) return saved.level === MAKE_LEVEL && saved.mode === 'made' && saved.board.kind === 'ask' && saved.board.q !== null;
    if (!Number.isInteger(saved.level) || saved.level < LADDER[0].level || saved.level > TOP_LEVEL) return false;
    const mode = rungOf(saved.level).mode;
    if (mode !== saved.mode) return false;
    if (mode === 'ahead') return saved.board.kind === 'ahead';
    return saved.board.kind === 'ask' && (mode === 'free' || mode === 'pick' ? saved.board.q === null : saved.board.q !== null);
  };

  /** 적어 둔 모습 하나(지금 모습이나 무르기의 모습)가 맞는 값인가 */
  function stateOk(saved, state) {
    const { board } = saved;
    if (!Array.isArray(state.asked) || typeof state.choosing !== 'boolean') return false;
    if (saved.mode === 'pick') {
      if (!(state.limit === null || LIMITS.includes(state.limit))) return false;
      if (!state.choosing && state.limit === null) return false;
      if (state.choosing && state.asked.length > 0) return false;
    } else if (state.limit !== board.q || state.choosing) return false;
    if (board.kind === 'ahead') {
      if (!setsOk(board, state.sets)) return false;
      if (state.told === null) return true;
      const told = answerAhead(board, state.sets);
      return Boolean(state.told) && state.told.key === told.key && Array.isArray(state.told.alive) && state.told.alive.join() === told.alive.join();
    }
    if (!Array.isArray(state.sets) || state.sets.length !== 0 || state.told !== null) return false;
    const replayed = replay(board, state.asked);
    if (!replayed.ok || !state.asked.every((entry, at) => entry.left === replayed.lefts[at])) return false;
    return state.limit === null || state.asked.length <= state.limit;
  }

  /** 판에 그리는 것: 하던 판과 공책의 그림 */
  function resumeView(saved) {
    const { board } = saved;
    if (board.kind === 'ahead') return { n: board.n, sets: saved.sets, alive: saved.told ? saved.told.alive : null, small: true };
    const alive = replay(board, saved.asked).alive;
    return { n: board.n, alive, picked: saved.picked, found: alive.length === 1 ? alive[0] : null, small: true };
  }

  return {
    id: FORMAT,
    T,
    padId: 'yesno-pad',
    makeId: 'make-yesno',
    // 오른쪽 칸에 물은 것의 목록이 쌓인다. 규칙 글은 왼쪽 칸 맨 위에 두고 수 칸을 크게 그린다
    ruleAside: true,
    homeIds: { sample: 'home-yesno-sample', blank: 'home-yesno-blank', ask: 'home-yesno-ask', play: 'home-yesno-play', pick: 'home-yesno-pick', make: 'home-yesno-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solve(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null || !levelOk(saved)) return false;
      if (!stateOk(saved, saved)) return false;
      if (!Array.isArray(saved.history) || !saved.history.every((state) => state && stateOk(saved, state))) return false;
      if (!(saved.choice === null || LIMITS.includes(saved.choice)) || !Array.isArray(saved.chosen) || !Array.isArray(saved.tries)) return false;
      if (!Array.isArray(saved.picked) || !saved.picked.every((x, at) => Number.isInteger(x) && x >= 1 && x <= saved.board.n && (at === 0 || saved.picked[at - 1] < x))) return false;
      if (!(Number.isInteger(saved.active) && saved.active >= 0 && (saved.board.kind !== 'ahead' || saved.active < saved.board.q))) return false;
      if (![saved.askCount, saved.pickCount, saved.retryCount, saved.undoCount, saved.resetCount, saved.impossibleCount, saved.wrongCount, saved.moveCount, saved.toolCount].every(count)) return false;
      return [saved.toolOn, saved.toolShown].every((value) => typeof value === 'boolean');
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('yesno-board').hidden = !on;
      $('yesno-count').hidden = !on;
      if (!on) $('yesno-halves').hidden = true;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다(묻기를 무른다).
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
    ruleLine: (round) => fill(T.rules[ruleKey(round)], { n: round.board.n, k: round.board.q ?? 0 }),
    hints: (round) => T.hints[ruleKey(round)],
    touched: (round) => round.askCount > 0 || round.pickCount > 0 || round.toolCount > 0 || round.chosen.length > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      return { alive: aliveOf(round).length, asked: round.asked.length, limit: round.limit, picked: round.picked.length, sets: isAhead(round) ? copySets(round.sets) : null, toolOn: round.toolOn };
    },
    /** 이 판보다 작은 판: 숨길 수의 끝이 더 작은 판 */
    smaller: (round, turn) => smallerYesno({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, fewest: solution.fewest, chain: solution.chain },
        // 질문 힌트와 반씩 나눠 보기를 함께 센다.
        hintsOpened: round.hintsOpened + (round.toolShown ? 1 : 0),
        toolShown: round.toolShown,
        toolCount: round.toolCount,
        // 판을 떠날 때 물은 것과 남은 후보, 정한 질문 수, 미리 정한 질문, 질문을 다 쓴 해 보기들
        asked: round.asked,
        left: aliveOf(round).length,
        limit: round.limit,
        chosen: round.chosen,
        sets: round.sets,
        tries: round.tries,
        fewest: round.done && round.outcome === 'solved' && (isAhead(round) ? round.board.q : round.mode === 'pick' ? round.limit : round.asked.length) === solution.fewest,
        askCount: round.askCount,
        pickCount: round.pickCount,
        retryCount: round.retryCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        impossibleCount: round.impossibleCount,
        moveCount: round.moveCount,
        // 수준 맞추기가 보는 "틀린 답"의 수
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    /** 글자판: 수 칸은 저마다 Enter와 빈칸 글쇠로 누른다(판이 맡는다) */
    onKey() {},

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawTiles(root, { n: board.n, sets: board.kind === 'ahead' ? Array.from({ length: board.q }, () => []) : null, small: true });
    },
    drawBlank(root) {
      drawTiles(root, { n: MAKE_FIRST.n, small: true });
    },
    /** 하던 판과 공책의 그림: 지금 남은 후보와 고른 수(미리 정하는 판은 넣은 수의 표시 줄) */
    drawResume(root, saved) {
      drawTiles(root, resumeView(saved));
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 첫 판 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawTiles(root, { n: MAKE_FIRST.n, small: true });
        return;
      }
      const { board } = generateBoard(entry.level, entry.picture.seed);
      drawTiles(root, { n: board.n, sets: board.kind === 'ahead' ? Array.from({ length: board.q }, () => []) : null, small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
