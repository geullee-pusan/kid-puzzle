// 숨은 규칙 찾기: 판 화면에서 이 형식이 맡는 부분(수 판과 세 수 판, 묻기, "알 것 같아요"와 갈라 보기, 끝났을 때 하는 말,
// 풀이와 설명)과 직접 만들기(규칙을 골라 숨기면 선생님이 물어서 찾는다).
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/rulehunt.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)는 판이 정한다(src/core/rulehunt.js).
//   number  수 판의 수를 누르면 바로 묻는 것이다. 선생님은 돼요인지 안 돼요인지만 말한다.
//   triple  세 수를 차례로 눌러 넣고 "물어보기"를 누른다.
// "알 것 같아요"를 누르면 선생님이 아직 묻지 않은 것 몇 개를 낸다(숨은 규칙과 함께 지금까지의 답에 맞는 다른 후보 규칙을
// 모두 가를 수 있는 것으로 고른다. src/core/rulehunt.js의 pickCheck). 아이가 하나하나 돼요나 안 돼요로 가르고 "다 골랐어요"를 누른다.
// 모두 맞으면 판이 끝난다. 아니면 숨은 규칙이 다르게 가르는 것이 몇 개인지만 말하고 판에 두 겹 테두리로 표시한다.
// 갈라 본 것은 모두 물어본 것이 되고, 아이는 더 물어볼 수 있다. 틀렸다고 하지 않고, 몇 번 물었는지는 화면에 보여 주지 않는다.
import T from '../content/rulehunt.json';
import { GIVEN_COUNT, LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, solutionOf } from '../core/rulehunt-ladder.js';
import {
  MULTS,
  checkBoard,
  copyBoard,
  findRule,
  fitting,
  holds,
  indexOf,
  joinRule,
  judgeCheck,
  parseAtom,
  parseRule,
  pickCheck,
  sameItem,
  thresholds,
  universeOf,
  whyOpen,
} from '../core/rulehunt.js';
import { seedFrom } from '../core/rng.js';
import { smallerRulehunt } from '../core/smaller.js';
import { endsClosed, fill } from '../core/text.js';
import { drawNumbers, drawSlots, drawTriples, nameChip, ruleCard } from '../ui/rulehunt-board.js';

const FORMAT = 'rulehunt';
/** 처음 화면과 판 고르기에 그리는 빈 판 */
const BLANK = { kind: 'number', top: 30 };
/** 풀이 보기에 이름을 적어 보이는 다른 규칙의 수의 위 끝 */
const SHOWN_RIVALS = 8;
/** 세 수 판의 풀이에 적는 돼요와 안 돼요의 수 */
const SAMPLE_TRIPLES = 4;
/** 직접 만들기에서 고를 수 있는 범위와 성질 */
const MAKE_TOPS = [30, 50, 100];
const KINDS = ['even', 'odd', 'mult', 'ones', 'gt', 'lt'];
const FIRST_DRAFT = { top: 30, a: { kind: 'even', k: null }, join: 'one', b: { kind: 'lt', k: 20 } };

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createRulehunt(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 사실. 다음에 무엇을 누르면 지운다
  let fresh = null; // 방금 물어본 것(수, 또는 세 수의 글자)
  let slots = []; // 세 수 판에서 넣는 중인 수들
  let draft = null; // 직접 만들기에서 고르던 규칙 { top, a, join, b }
  let found = null; // 선생님이 찾은 결과(직접 만들기) { asks, rule }

  const count = (value) => Number.isInteger(value) && value >= 0;
  const textOf = (item) => (Array.isArray(item) ? item.join(T.tripleJoin) : String(item));
  const lastOf = (item) => (Array.isArray(item) ? item[item.length - 1] : item);
  const items = (round) => round.asked.map((entry) => entry.x);
  const asksOf = (round) => round.asked.filter((entry) => entry.from === 'ask');
  /** 방금 물어본 것을 판에서 찾는 열쇠: 수는 그대로, 세 수는 글자로 */
  const textOrValue = (x) => (Array.isArray(x) ? textOf(x) : x);

  function forget() {
    flash = null;
    fresh = null;
    slots = [];
  }

  // ---- 규칙의 이름 ----
  function atomName(id, form) {
    const { kind, k } = parseAtom(id);
    return fill(T.names[kind][form], { k: k ?? 0 });
  }

  /** 규칙의 이름표 → 화면에서 부르는 이름(늘 "수"로 끝난다) */
  function nameOf(rule) {
    const parsed = parseRule(rule);
    if (parsed.op === 'triple') return T.triples[rule];
    if (parsed.op === 'one') return atomName(rule, 'noun');
    return fill(T.joined, { f: atomName(parsed.a, parsed.op), face: atomName(parsed.b, 'noun') });
  }

  /** "12는 돼요"처럼 수 뒤에 붙는 말을 골라 채운다 */
  function answerLine(group, item, yes) {
    const key = `${yes ? 'yes' : 'no'}-${endsClosed(lastOf(item)) ? 'closed' : 'open'}`;
    return fill(group[key], { k: textOf(item) });
  }

  // ---- 판 ----
  const hintKey = (round) => (round.custom ? (round.board.lib === 'two' ? 'both' : 'one') : rungOf(round.level).hint);

  /** 수 판에 그릴 것 */
  function numberView(board, asked, { check = null, strong = [], live = false } = {}) {
    const view = {
      top: board.top,
      marks: new Map(asked.map((entry) => [entry.x, entry.yes ? 'yes' : 'no'])),
      checks: new Map(check ? check.items.map((x, at) => [x, check.picks[at]]) : []),
      strong: new Set(strong),
      fresh: live ? fresh : null,
    };
    if (live) {
      view.label = (x) => {
        const mark = view.marks.get(x);
        const key = view.checks.has(x) ? 'check' : mark ?? 'open';
        return fill(T.cellState[key], { k: x });
      };
      view.onTap = tapNumber;
    }
    return view;
  }

  /** 세 수 판에 그릴 것 */
  function tripleView(asked, { strong = [], live = false } = {}) {
    return {
      asked: asked.map((entry) => ({ item: entry.x, yes: entry.yes })),
      strong: new Set(strong.map(textOf)),
      fresh: live ? fresh : null,
      heads: T.heads,
      join: T.tripleJoin,
    };
  }

  function drawBoardOf(root, board, asked, options = {}, small = false) {
    if (board.kind === 'number') drawNumbers(root, { ...numberView(board, asked, options), small });
    else drawTriples(root, { ...tripleView(asked, options), small });
  }

  function statusOf(round) {
    if (round.check) return T.status.checking;
    return round.mode === 'number' ? T.status.ask : T.status['ask-triple'];
  }

  function draw() {
    const { round } = frame;
    const playing = !round.done;
    const checking = playing && round.check !== null;
    drawBoardOf($('rulehunt-board'), round.board, round.asked, { check: checking ? round.check : null, strong: round.lastWrong, live: playing });
    $('rulehunt-status').textContent = round.done ? '' : (flash ?? statusOf(round));
    $('rulehunt-ask-box').hidden = round.mode !== 'number' || checking;
    $('rulehunt-triple').hidden = round.mode !== 'triple' || checking;
    if (round.mode === 'triple') drawTripleEntry(round);
    $('rulehunt-know-box').hidden = checking;
    $('rulehunt-know').disabled = !playing;
    $('rulehunt-check').hidden = !checking;
    if (checking) drawCheck(round);
    frame.showWhy();
  }

  /** 세 수 넣기: 세 칸, 수 단추(범위까지만), 지우기, 물어보기 */
  function drawTripleEntry(round) {
    drawSlots($('rulehunt-slots'), { values: slots, label: fill(T.slotsLabel, { k: slots.join(T.tripleJoin) }) });
    for (const key of $('rulehunt-keys').querySelectorAll('button')) {
      key.hidden = Number(key.dataset.n) > round.board.top;
      key.disabled = round.done || slots.length >= 3;
    }
    $('rulehunt-erase').disabled = round.done || slots.length === 0;
    $('rulehunt-ask').disabled = round.done || slots.length !== 3;
  }

  /** 갈라 보기: 낸 것마다 돼요와 안 돼요 단추 */
  function drawCheck(round) {
    const { check } = round;
    $('rulehunt-check-list').replaceChildren(
      ...check.items.map((item, at) => {
        const row = document.createElement('li');
        row.className = 'rh-check-row';
        const name = document.createElement('span');
        name.className = 'rh-check-item';
        name.textContent = textOf(item);
        row.append(name);
        for (const side of ['yes', 'no']) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `btn rh-pick ${side}`;
          button.dataset.at = String(at);
          button.dataset.pick = side;
          button.textContent = T.heads[side];
          button.setAttribute('aria-label', fill(T.cellState[side], { k: textOf(item) }));
          button.setAttribute('aria-pressed', String(check.picks[at] === side));
          row.append(button);
        }
        return row;
      }),
    );
    $('rulehunt-check-done').disabled = check.picks.some((pick) => pick === null);
  }

  // ---- 묻기 ----
  /** 수 판의 수를 눌렀다: 묻는다. 갈라 보는 중이면 그 수의 고르기를 바꾼다 */
  function tapNumber(x) {
    const { round } = frame;
    if (!round || round.done) return;
    if (round.check) {
      const at = round.check.items.indexOf(x);
      if (at < 0) {
        flash = T.status.checking;
        draw();
        return;
      }
      choose(at, round.check.picks[at] === 'yes' ? 'no' : 'yes');
      return;
    }
    ask(x);
  }

  function ask(x) {
    const { round } = frame;
    if (!round || round.done || round.check || indexOf(round.board, x) < 0) return;
    round.lastWrong = [];
    if (round.asked.some((entry) => sameItem(entry.x, x))) {
      round.againCount += 1;
      fresh = textOrValue(x);
      flash = T.status[round.mode === 'number' ? 'again' : 'again-triple'];
      frame.note('again', { x });
      draw();
      frame.persist();
      return;
    }
    const yes = holds(round.board.rule, x);
    // 물은 뒤에도 숨은 규칙과 함께 맞는 다른 후보(가름)의 수. 화면에는 보여 주지 않는다(기록에만 남긴다)
    const left = fitting(round.board, [...items(round), x]).rivals.length;
    round.asked = [...round.asked, { x, yes, from: 'ask', left }];
    round.askCount += 1;
    round.moveCount += 1;
    fresh = textOrValue(x);
    flash = answerLine(T.status, x, yes);
    frame.note('ask', { x, yes, left });
    draw();
    frame.persist();
    frame.say(answerLine(T.play, x, yes));
  }

  /** 세 수 판: 수 단추를 누르면 다음 칸에 들어간다 */
  function pressKey(key) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'triple' || round.check) return;
    if (key === 'erase') slots = slots.slice(0, -1);
    else if (slots.length < 3) {
      const n = Number(key);
      if (Number.isInteger(n) && n >= 1 && n <= round.board.top) slots = [...slots, n];
    }
    flash = null;
    draw();
  }

  function askTriple() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'triple' || slots.length !== 3) return;
    const item = slots.slice();
    slots = [];
    ask(item);
  }

  // ---- 갈라 보기 ----
  function startCheck() {
    const { round } = frame;
    if (!round || round.done || round.check) return;
    round.lastWrong = [];
    const picked = pickCheck(round.board, items(round), seedFrom(FORMAT, round.id, round.checks.length));
    flash = null;
    fresh = null;
    if (picked.items.length === 0) {
      // 범위의 것을 모두 물어봐서 더 갈라 볼 것이 없다. 다 알아낸 판이다.
      round.allAsked = true;
      round.answers.push({ t: frame.stamp(), answer: 'check:', correct: true, guess: null });
      frame.note('check', { items: [], correct: true });
      frame.finish('solved');
      return;
    }
    round.check = { items: picked.items, picks: picked.items.map(() => null), covered: picked.covered };
    round.moveCount += 1;
    frame.note('check-start', { items: picked.items, asked: asksOf(round).length, covered: picked.covered });
    draw();
    frame.persist();
    frame.say(fill(T.play['check-start'], { n: picked.items.length }));
  }

  function choose(at, pick) {
    const { round } = frame;
    if (!round || round.done || !round.check || !(at in round.check.picks)) return;
    round.check.picks = round.check.picks.map((value, index) => (index === at ? pick : value));
    flash = null;
    draw();
    frame.persist();
  }

  function submitCheck() {
    const { round } = frame;
    if (!round || round.done || !round.check || round.check.picks.some((pick) => pick === null)) return;
    const { items: list, picks, covered } = round.check;
    const result = judgeCheck(round.board, list, picks);
    const wrong = result.wrong.map((at) => list[at]);
    // 그때까지 아이가 물어본 것(처음 받은 것과 갈라 본 것은 빼고)이 모두 돼요였는가
    const own = asksOf(round);
    const allYes = own.length >= 2 && own.every((entry) => entry.yes);
    round.checks = [...round.checks, { items: list, picks, wrong, covered, asked: own.length, allYes, t: frame.stamp() }];
    round.answers.push({ t: frame.stamp(), answer: `check:${list.map(textOf).join('/')}=${picks.join('/')}`, correct: result.correct, guess: null });
    frame.note('check', { items: list, picks, wrong, correct: result.correct });
    // 갈라 본 것은 모두 물어본 것이 된다(숨은 규칙의 답을 알게 되었다).
    round.asked = [...round.asked, ...list.map((x) => ({ x, yes: holds(round.board.rule, x), from: 'check', left: null }))];
    round.check = null;
    round.moveCount += 1;
    if (result.correct) {
      frame.finish('solved');
      return;
    }
    round.failedChecks += 1;
    round.wrongCount += 1;
    round.lastWrong = wrong;
    flash = T.status['check-miss'];
    draw();
    frame.persist();
    const parts = [fill(T.play['check-miss'], { n: wrong.length })];
    if (allYes && !round.allYesSaid) {
      round.allYesSaid = true;
      parts.push(T.play['check-all-yes']);
    }
    parts.push(T.play['check-more']);
    frame.say(parts.join(' '));
  }

  // ---- 끝났을 때 하는 말 ----
  /** "왜 그럴까?"가 이 판으로 막 열렸는가 */
  function whyJustOpened(round) {
    const records = frame.records();
    return whyOpen(records) && !whyOpen(records.filter((record) => record.id !== round.id));
  }

  function rightLine(round) {
    const face = nameOf(round.board.rule);
    const parts = [];
    if (round.allAsked) parts.push(fill(T.right['all-asked'], { face }));
    else {
      parts.push(fill(T.right.solved, { face }));
      if (round.failedChecks > 0) parts.push(fill(T.right['after-miss'], { n: round.checks.length }));
    }
    if (!round.side && whyJustOpened(round)) parts.push(T.right['why-invite']);
    return parts;
  }

  // ---- 풀이와 "왜 그럴까?" ----
  function rowOf(cards, more = '') {
    const row = document.createElement('div');
    row.className = more ? `figure-row ${more}` : 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 세 수 판의 풀이에 적을 보기: 물어본 것과, 작은 수로 된 세 수 가운데 돼요와 안 돼요를 몇 개씩 */
  function sampleTriples(board, asked) {
    const list = asked.map((entry) => ({ x: entry.x, yes: entry.yes }));
    const want = { yes: SAMPLE_TRIPLES, no: SAMPLE_TRIPLES };
    for (const x of universeOf(board)) {
      if (want.yes === 0 && want.no === 0) break;
      if (list.some((entry) => sameItem(entry.x, x))) continue;
      const yes = holds(board.rule, x);
      const side = yes ? 'yes' : 'no';
      // 같은 수만 되풀이되는 보기가 몰리지 않게 띄엄띄엄 고른다
      if (want[side] > 0 && (x[0] + x[1] * 3 + x[2] * 7) % 11 === 0) {
        list.push({ x, yes });
        want[side] -= 1;
      }
    }
    return list;
  }

  function solutionPages(round, solution) {
    const { board } = round;
    const face = nameOf(board.rule);
    const pages = [];
    if (board.kind === 'number') {
      const all = universeOf(board).map((x) => ({ x, yes: holds(board.rule, x) }));
      const card = ruleCard((root) => drawBoardOf(root, board, all, {}, true), fill(T.solution.note, { n: solution.yes }), { big: true });
      pages.push({ say: fill(T.solution.rule, { face }), nodes: [rowOf([card])] });
    } else {
      const card = ruleCard((root) => drawBoardOf(root, board, sampleTriples(board, round.asked), {}, true), null, { big: true });
      pages.push({ say: fill(T.solution['rule-triple'], { face }), nodes: [rowOf([card])] });
    }
    const rivals = solution.rivals;
    if (rivals.length === 0) pages.push({ say: T.solution['no-rivals'], nodes: [] });
    else {
      const chips = rivals.slice(0, SHOWN_RIVALS).map((rule) => nameChip(nameOf(rule)));
      const nodes = [rowOf(chips, 'rh-chips')];
      if (rivals.length > SHOWN_RIVALS) {
        const more = document.createElement('p');
        more.className = 'strip-note';
        more.textContent = fill(T.solution['rivals-more'], { n: rivals.length - SHOWN_RIVALS });
        nodes.push(more);
      }
      pages.push({ say: fill(T.solution.rivals, { n: rivals.length }), nodes });
    }
    return pages;
  }

  /** 그림 한 장: 처음 받은 것과 물어본 것(답은 규칙으로 구한다), 두 겹 테두리를 친 것 */
  function figureCard(item) {
    const { board } = item;
    const asked = [...board.given, ...item.asked].map((x) => ({ x, yes: holds(board.rule, x) }));
    return ruleCard((root) => drawBoardOf(root, board, asked, { strong: item.marks ?? [] }, true), item.note);
  }

  /** "왜 그럴까?": 선생님이 어떻게 알아챘는지의 이야기. 판을 끝까지 하고 갈라 본 것이 한 번 어긋났거나, 판을 둘 끝까지 한 뒤에 열린다(임시) */
  function whyPages() {
    if (!whyOpen(frame.records())) return null;
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [rowOf(slide.figures.map(figureCard))];
      },
    }));
  }

  // ---- 직접 만들기: 규칙을 골라 숨기면 선생님이 물어서 찾는다 ----
  /** 성질마다 고를 수 있는 수(짝수와 홀수는 없다) */
  function choicesOf(kind, top) {
    if (kind === 'mult') return MULTS;
    if (kind === 'ones') return Array.from({ length: 10 }, (_, d) => d);
    if (kind === 'gt' || kind === 'lt') return thresholds(top);
    return [];
  }

  /** 고른 성질을 범위에 맞춘다(그 범위에 없는 수면 가장 가까운 것으로) */
  function fitPart(part, top) {
    const options = choicesOf(part.kind, top);
    if (options.length === 0) return { kind: part.kind, k: null };
    if (options.includes(part.k)) return part;
    const near = options.reduce((best, value) => (Math.abs(value - (part.k ?? 0)) < Math.abs(best - (part.k ?? 0)) ? value : best), options[0]);
    return { kind: part.kind, k: near };
  }

  const atomOf = (part) => ({ even: 'even', odd: 'odd' })[part.kind] ?? `${{ mult: 'm', ones: 'd', gt: 'gt', lt: 'lt' }[part.kind]}${part.k}`;
  const draftRule = () => joinRule(atomOf(draft.a), draft.join, atomOf(draft.b), draft.top);
  const draftLib = (rule) => (parseRule(rule).op === 'one' ? 'one' : 'two');

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const okPart = (part) => part && KINDS.includes(part.kind);
    const ok = saved && MAKE_TOPS.includes(saved.top) && okPart(saved.a) && okPart(saved.b) && ['one', 'and', 'or'].includes(saved.join);
    const from = ok ? saved : FIRST_DRAFT;
    return { top: from.top, a: fitPart(from.a, from.top), join: from.join, b: fitPart(from.b, from.top) };
  }

  /** 범위에서 내 규칙으로 돼요인 수 */
  const yesOf = (rule, top) => universeOf({ kind: 'number', top }).filter((x) => holds(rule, x));

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    found = null;
    $('rulehunt-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawPart(which) {
    const part = draft[which];
    for (const button of $(`rulehunt-make-kind-${which}`).querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.kind === part.kind));
    const options = choicesOf(part.kind, draft.top);
    $(`rulehunt-make-param-${which}`).hidden = options.length === 0;
    if (options.length > 0) {
      const at = options.indexOf(part.k);
      $(`rulehunt-make-value-${which}`).textContent = atomName(atomOf(part), 'noun');
      $(`rulehunt-make-fewer-${which}`).disabled = at <= 0;
      $(`rulehunt-make-more-${which}`).disabled = at >= options.length - 1;
    }
  }

  function drawMake() {
    for (const button of $('rulehunt-make-range').querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.top) === draft.top));
    for (const button of $('rulehunt-make-join').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.join === draft.join));
    drawPart('a');
    $('rulehunt-make-second').hidden = draft.join === 'one';
    drawPart('b');
    const rule = draftRule();
    const yes = yesOf(rule, draft.top);
    $('rulehunt-make-name').textContent = fill(T.make.chosen, { face: nameOf(rule) });
    const view = {
      top: draft.top,
      ruleYes: new Set(yes),
      marks: new Map(found ? found.asks.map((entry) => [entry.x, entry.yes ? 'yes' : 'no']) : []),
      order: new Map(found ? found.asks.map((entry, at) => [entry.x, at + 1]) : []),
    };
    drawNumbers($('rulehunt-make-board'), view);
    const usable = madeBoard() !== null;
    $('rulehunt-make-solve').disabled = !usable;
    if (!usable && !found) $('rulehunt-make-result').textContent = yes.length === 0 ? T.make.empty : T.make.full;
  }

  function changeDraft(change) {
    draft = { ...draft, ...change };
    draft.a = fitPart(draft.a, draft.top);
    draft.b = fitPart(draft.b, draft.top);
    found = null;
    $('rulehunt-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  function setKind(which, kind) {
    if (!KINDS.includes(kind)) return;
    const options = choicesOf(kind, draft.top);
    changeDraft({ [which]: { kind, k: options.length > 0 ? options[Math.floor(options.length / 2)] : null } });
  }

  function stepParam(which, step) {
    const part = draft[which];
    const options = choicesOf(part.kind, draft.top);
    const at = options.indexOf(part.k) + step;
    if (at < 0 || at >= options.length) return;
    changeDraft({ [which]: { kind: part.kind, k: options[at] } });
  }

  /** 다 만든 판(공책에 남기거나 다시 열 판). 돼요인 수와 안 돼요인 수가 모두 있어야 한다. 아니면 null */
  function madeBoard() {
    if (!draft) return null;
    const rule = draftRule();
    const yes = yesOf(rule, draft.top);
    if (yes.length === 0 || yes.length === draft.top) return null;
    // 처음 받는 돼요는 가장 작은 수 셋(돼요인 수가 그보다 적으면 모두)
    const board = { kind: 'number', top: draft.top, rule, given: yes.slice(0, GIVEN_COUNT), lib: draftLib(rule) };
    return checkBoard(board) === null ? board : null;
  }

  /** "선생님, 찾아 보세요": 선생님이 아무것도 모르는 데서부터 물어서 찾는다. 물어본 수와 차례를 판에 적는다 */
  function solveDraft() {
    const made = madeBoard();
    if (!made) return;
    // 선생님은 아이가 하나를 골랐는지 둘을 이었는지 모르므로, 둘을 이은 규칙까지 모두 견주어 본다.
    const result = findRule({ ...made, lib: 'two' });
    found = result;
    const same = result.rule === made.rule;
    const lines = [fill(T.make.found, { n: result.asks.length, face: nameOf(result.rule) })];
    if (!same) lines.push(T.make['found-same']);
    const line = lines.join(' ');
    drawMake();
    $('rulehunt-make-result').textContent = line;
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board: copyBoard(made),
      solution: { possible: true, asks: result.asks, found: result.rule, same },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  // ---- 단추 잇기 ----
  $('rulehunt-know').addEventListener('click', startCheck);
  $('rulehunt-check-done').addEventListener('click', submitCheck);
  $('rulehunt-check-list').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button?.dataset.pick) choose(Number(button.dataset.at), button.dataset.pick);
  });
  $('rulehunt-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.n;
    if (key) pressKey(key);
  });
  $('rulehunt-erase').addEventListener('click', () => pressKey('erase'));
  $('rulehunt-ask').addEventListener('click', askTriple);
  $('rulehunt-make-range').addEventListener('click', (event) => {
    const top = Number(event.target.closest('button')?.dataset.top);
    if (MAKE_TOPS.includes(top)) changeDraft({ top });
  });
  $('rulehunt-make-join').addEventListener('click', (event) => {
    const join = event.target.closest('button')?.dataset.join;
    if (['one', 'and', 'or'].includes(join)) changeDraft({ join });
  });
  for (const which of ['a', 'b']) {
    // 성질 단추의 글은 대본에 있다(짝수와 홀수는 다른 형식에서 까닭의 말이라 첫 화면 파일에 적지 않는다).
    for (const button of $(`rulehunt-make-kind-${which}`).querySelectorAll('button')) button.textContent = T.make.kinds[button.dataset.kind];
    $(`rulehunt-make-kind-${which}`).addEventListener('click', (event) => {
      const kind = event.target.closest('button')?.dataset.kind;
      if (kind) setKind(which, kind);
    });
    $(`rulehunt-make-fewer-${which}`).addEventListener('click', () => stepParam(which, -1));
    $(`rulehunt-make-more-${which}`).addEventListener('click', () => stepParam(which, 1));
  }
  $('rulehunt-make-solve').addEventListener('click', solveDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ board }) {
    const start = copyBoard(board);
    return {
      mode: start.kind,
      board: start, // 판: 범위, 숨은 규칙, 처음 받은 돼요, 견주어 보는 후보 규칙의 목록
      // 답을 아는 것들: 처음 받은 것(given), 물어본 것(ask), 갈라 본 것(check). left는 물은 뒤 숨은 규칙과 함께 맞는 다른 후보의 수
      asked: start.given.map((x) => ({ x, yes: true, from: 'given', left: null })),
      check: null, // 갈라 보는 중이면 { items, picks, covered }
      checks: [], // 갈라 본 것들 { items, picks, wrong, covered, asked, allYes, t }
      lastWrong: [], // 바로 앞 갈라 보기에서 숨은 규칙이 다르게 가른 것(두 겹 테두리)
      askCount: 0, // 아이가 물어본 수
      againCount: 0, // 이미 물어본 것을 또 누른 수
      failedChecks: 0,
      wrongCount: 0, // 어긋난 갈라 보기의 수. 수준 맞추기가 "한 번에"를 본다
      allYesSaid: false, // "물어본 것이 모두 돼요였어요"를 말했는가(한 판에 한 번)
      allAsked: false, // 범위의 것을 다 물어봐서 갈라 볼 것 없이 끝났는가
      moveCount: 0, // 이 판에서 한 일의 수(묻기, 갈라 보기 시작과 다 골랐어요)
    };
  }

  /** 적어 둔 물어본 것 하나가 쓸 수 있는 값인가 */
  function validEntry(board, entry) {
    return entry && indexOf(board, entry.x) >= 0 && typeof entry.yes === 'boolean' && entry.yes === holds(board.rule, entry.x) && ['given', 'ask', 'check'].includes(entry.from);
  }

  return {
    id: FORMAT,
    T,
    padId: 'rulehunt-pad',
    makeId: 'make-rulehunt',
    homeIds: { sample: 'home-rulehunt-sample', blank: 'home-rulehunt-blank', ask: 'home-rulehunt-ask', play: 'home-rulehunt-play', pick: 'home-rulehunt-pick', make: 'home-rulehunt-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (checkBoard(saved.board) !== null || saved.mode !== saved.board.kind) return false;
      const { board } = saved;
      if (!Array.isArray(saved.asked) || !saved.asked.every((entry) => validEntry(board, entry))) return false;
      if (saved.asked.some((entry, at) => saved.asked.slice(0, at).some((other) => sameItem(other.x, entry.x)))) return false;
      if (saved.check !== null) {
        const { check } = saved;
        if (!check || !Array.isArray(check.items) || !Array.isArray(check.picks) || check.items.length !== check.picks.length || check.items.length === 0) return false;
        if (!check.items.every((x) => indexOf(board, x) >= 0 && !saved.asked.some((entry) => sameItem(entry.x, x)))) return false;
        if (!check.picks.every((pick) => pick === null || pick === 'yes' || pick === 'no')) return false;
      }
      if (!Array.isArray(saved.checks) || !Array.isArray(saved.lastWrong)) return false;
      if (![saved.allYesSaid, saved.allAsked].every((value) => typeof value === 'boolean')) return false;
      return [saved.askCount, saved.againCount, saved.failedChecks, saved.wrongCount, saved.moveCount].every(count);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글)을 보이거나 감춘다. 무르기와 되돌리기는 쓰지 않는다 */
    showParts(on) {
      $('rulehunt-board').hidden = !on;
      $('rulehunt-count').hidden = !on;
      if (on) {
        // 앞의 형식이 정해 둔 무르기와 되돌리기를 여기서 다시 감춘다(뒤의 엉킨 그림 풀기는 꺼질 때 이 둘에 손대지 않는다).
        $('undo').hidden = true;
        $('reset').hidden = true;
      }
    },
    enter: forget,
    draw,
    ended: forget,
    ruleLine: (round) => T.rules[hintKey(round)],
    hints: (round) => T.hints[hintKey(round)],
    touched: (round) => round.askCount > 0 || round.checks.length > 0 || round.check !== null,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view: (round) => ({ mode: round.mode, asked: asksOf(round).map((entry) => entry.x), checking: round.check !== null, failedChecks: round.failedChecks }),
    /** 이 판보다 작은 판: 같은 규칙을 더 좁은 범위에서 */
    smaller: (round, turn) => smallerRulehunt({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const own = asksOf(round);
      const firstCheck = round.asked.findIndex((entry) => entry.from === 'check');
      const before = (firstCheck < 0 ? round.asked : round.asked.slice(0, firstCheck)).filter((entry) => entry.from === 'ask');
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        // 숨은 규칙, 돼요인 것의 수, 처음 받은 것만으로는 가를 수 없는 다른 후보(가름)의 수
        solution: { possible: true, rule: solution.rule, yes: solution.yes, rivals: solution.rivals.length },
        // 답을 아는 것들의 차례(처음 받은 것, 물어본 것, 갈라 본 것)와 물은 뒤 남은 다른 후보의 수
        asked: round.asked,
        askCount: round.askCount,
        // 처음 "알 것 같아요"를 누르기 전에 물어본 것과 그 가운데 돼요와 안 돼요의 수
        askedBeforeCheck: before.map((entry) => entry.x),
        askedYes: own.filter((entry) => entry.yes).length,
        askedNo: own.filter((entry) => !entry.yes).length,
        checks: round.checks,
        failedChecks: round.failedChecks,
        againCount: round.againCount,
        allAsked: round.allAsked,
        moveCount: round.moveCount,
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo() {},
    reset() {},
    /** 글자판이 있는 기기: 세 수 판에서 지우기와 물어보기만 받는다(두 자리 수는 단추로 넣는다) */
    onKey(event) {
      const { round } = frame;
      if (!round || round.mode !== 'triple' || round.check || $('rulehunt-pad').hidden) return;
      if (event.key === 'Backspace') pressKey('erase');
      else if (event.key === 'Enter' && slots.length === 3) askTriple();
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).hint],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawBoardOf(root, board, begin({ board }).asked, {}, true);
    },
    drawBlank(root) {
      drawNumbers(root, { top: BLANK.top, small: true });
    },
    drawResume(root, saved) {
      drawBoardOf(root, saved.board, saved.asked, { check: saved.check, strong: saved.lastWrong }, true);
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나와 물어본 것 몇 개 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) drawNumbers(root, { top: BLANK.top, small: true });
      else {
        const asked = [...picture.board.given, ...picture.asked].map((x) => ({ x, yes: holds(picture.board.rule, x) }));
        drawBoardOf(root, picture.board, asked, {}, true);
      }
    },
    showMake,
    /** 직접 만들기에서 다 만든 판. 돼요인 수와 안 돼요인 수가 모두 있어야 한다. 아니면 null(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
