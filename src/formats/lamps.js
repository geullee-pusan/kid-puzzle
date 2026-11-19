// 켜고 끄기와 숫자 마술: 판 화면에서 이 형식이 맡는 부분(불의 줄과 합, 수의 줄, 마음 읽기 카드, 숫자 마술의 세로셈과 쪽지,
// 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기(불을 골라 달면 선생님이 어디까지 만들 수 있는지 알려 준다. 숫자 마술을 아무 수로 해 보기).
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/lamps.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)는 판이 정한다(src/core/lamps.js).
//   targets  불을 눌러 켜고 끈다. 켠 불의 합이 적힌 수와 같아지면 그 수를 만든 것이다. 적힌 수를 모두 만들면 끝난다.
//   reach    불로 만든 수는 줄에 동그라미가 생긴다. 줄에서 수를 고르고 "못 만들어요"를 누른다. 처음으로 만들 수 없는 수면 끝난다.
//            만들 수 있는 수나 더 작은 빈 곳이 있는 수면 그 사실만 말하고 판은 이어진다(틀렸다고 하지 않는다).
//   next     새 불의 수를 넣고 "달아 보기"를 누르면 줄에 그 불까지 달았을 때 만들 수 있는 수가 보인다. 가장 멀리 가는 불을 달면 끝난다.
//   cards    선생님이 먼저 맞힌다(아이가 마음속의 수가 적힌 카드를 누른다). 그다음 아이가 선생님의 수를 맞힌다.
//   magic    수를 고르면 뒤집은 수가 적힌다. 아이가 뺀 수와 더한 수를 넣는다. 다르면 다시 볼 자리 하나만 짚는다. 쪽지를 펴면 끝난다.
// 몇 번 눌렀는지, 몇 번 달아 보았는지는 판에 적지 않는다(기록에만 남긴다).
import T from '../content/lamps.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, solutionOf } from '../core/lamps-ladder.js';
import {
  MAKE_COUNT,
  MAKE_VALUES,
  PREDICTION,
  STRIP_CAP,
  cardNumbers,
  cardsWith,
  checkBoard,
  copyBoard,
  familyOf,
  gapOf,
  litFor,
  litSum,
  magicOk,
  magicSteps,
  magicTable,
  maskOf,
  missingOf,
  readCards,
  reachOf,
  resultForGap,
  stripTop,
  sumOf,
  waysOf,
  whyOpen,
  withLamp,
  wrongColumn,
} from '../core/lamps.js';
import { smallerLamps } from '../core/smaller.js';
import { endsClosed, fill } from '../core/text.js';
import { cardGrid, columnSum, figureCard, figureRow, lampRow, noteCard, numberStrip, pickedBox, stack, sumBox, targetRow } from '../ui/lamps-board.js';

const FORMAT = 'lamps';
const MODES = ['targets', 'reach', 'next', 'cards', 'magic'];
/** 처음 화면과 만들기 목록에 그리는 빈 판 */
const BLANK = [1, 2, 4];
/** 넣을 수 있는 글자 수: 새 불과 카드는 두 자리, 마술의 수는 그 자리 수, 계산한 답은 네 자리 */
const TYPE_LIMIT = { next: 2, cards: 2, pick: 3, calc: 4, make: 3 };
const FIRST_DRAFT = { tab: 'lamps', lamps: [1, 2, 4], value: 8, typed: '' };

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createLamps(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 사실. 다음에 무엇을 누르면 지운다
  let fresh = null; // 방금 만든 수
  let draft = null; // 직접 만들기에서 고르던 것 { tab, lamps, value, typed }
  let shown = null; // 직접 만들기에서 선생님이 알려 준 것 { lamps } 또는 { n }

  const count = (value) => Number.isInteger(value) && value >= 0;
  /** 받침에 따라 -closed, -open 가운데 고른다 */
  const pick = (group, key, number) => group[`${key}-${endsClosed(number) ? 'closed' : 'open'}`];
  const say = (line) => frame.say(line);

  function forget() {
    flash = null;
    fresh = null;
  }

  // ---- 판의 모습 ----
  /** 지금 줄에 놓인 불: 불 하나 더 달기에서는 단 불이 맨 뒤에 붙는다 */
  const lampsNow = (round) => (round.mode === 'next' && round.extra !== null ? [...round.board.lamps, round.extra] : round.board.lamps);
  const sumNow = (round) => litSum(lampsNow(round), round.lit);
  const hintKey = (round) => (round.custom ? 'reach' : round.mode);
  const cardTitle = (at) => fill(T.cardTitle, { f: T.cardNames[at] });
  const secretOf = (round) => round.board.secrets[round.secretAt];

  function ruleLine(round) {
    if (round.custom) return T.rules.reach;
    if (round.mode === 'cards') return round.phase === 'child' ? T.rules['cards-child'] : fill(T.rules['cards-teacher'], { total: sumOf(round.board.lamps) });
    if (round.mode === 'magic') return fill(T.rules.magic, { f: T.digitWords[round.board.digits] });
    return T.rules[round.mode];
  }

  /** 만든 수마다 만든 방법(불 묶음)의 수 */
  function madeWays(round) {
    const ways = new Map();
    for (const key of round.madeMasks) {
      const n = Number(key.split(':')[0]);
      ways.set(n, (ways.get(n) ?? 0) + 1);
    }
    return ways;
  }

  /** 줄에서 만들 수 있는 수와 없는 수(불 하나 더 달기, 그림) */
  function canSets(lamps, top) {
    const ways = waysOf(lamps);
    const made = new Set();
    const cannot = new Set();
    for (let n = 1; n <= top; n++) (ways[n] > 0 ? made : cannot).add(n);
    return { made, cannot, ways };
  }

  function lampLabel(lamps, lit) {
    return (at) => fill(T.lampState[lit.includes(at) ? 'on' : 'off'], { k: lamps[at] });
  }

  /** 판(누를 수 있게, 또는 작은 그림으로) */
  function boardNodes(round, { live = false, small = false } = {}) {
    const { board } = round;
    if (board.kind === 'magic') return magicNodes(round, { live, small });
    if (board.kind === 'cards') return [cardNodes(round, { live, small })];
    const lamps = lampsNow(round);
    const playing = live && !round.done;
    const row = lampRow({
      lamps,
      lit: round.lit,
      fresh: round.mode === 'next' && round.extra !== null ? board.lamps.length : -1,
      slot: round.mode === 'next' && round.extra === null,
      slotLabel: T.lampState.empty,
      small,
      label: playing ? lampLabel(lamps, round.lit) : undefined,
      onTap: playing ? toggle : undefined,
    });
    const nodes = [];
    if (board.kind === 'targets') nodes.push(targetRow({ targets: board.targets, made: new Set(round.made), fresh: live ? fresh : null, small, label: (n) => fill(T.targetState[round.made.includes(n) ? 'made' : 'open'], { k: n }) }));
    nodes.push(row);
    if (!small) nodes.push(sumBox(T.sumLabel, sumNow(round)));
    if (board.kind === 'reach') nodes.push(reachStrip(round, { live: playing, small }));
    if (board.kind === 'next') nodes.push(nextStrip(round, { small }));
    return nodes;
  }

  function reachStrip(round, { live, small }) {
    const top = stripTop(round.board);
    const cannot = new Set(round.claims.filter((claim) => claim.result !== 'can').map((claim) => claim.x));
    const solved = round.done ? solutionOf(round.board) : null;
    return numberStrip({
      top,
      made: new Set(round.made),
      cannot,
      gap: solved ? solved.first : null,
      picked: live ? round.picked : null,
      fresh: live ? fresh : null,
      ways: madeWays(round),
      small,
      label: (n) => fill(T.cellState[round.picked === n ? 'picked' : cannot.has(n) ? 'cannot' : round.made.includes(n) ? 'made' : 'open'], { k: n }),
      onTap: live ? tapStrip : undefined,
    });
  }

  function nextStrip(round, { small }) {
    const top = stripTop(round.board);
    const lamps = lampsNow(round);
    const { made, cannot } = canSets(lamps, top);
    return numberStrip({ top, made, cannot, gap: round.extra === null ? null : reachOf(lamps) + 1, small });
  }

  function cardNodes(round, { live, small }) {
    const { lamps } = round.board;
    const teacher = round.phase !== 'child';
    const secret = !teacher && !round.done ? secretOf(round) : null;
    const marked = secret === null ? [] : cardsWith(lamps, secret);
    const canTap = live && !round.done && teacher && round.asking === null;
    return cardGrid({
      cards: lamps.map((_, at) => ({ title: cardTitle(at), numbers: cardNumbers(lamps, at), picked: teacher && round.chosen.includes(at), marked: marked.includes(at) })),
      small,
      label: (at) => fill(T.cardState[marked.includes(at) ? 'marked' : teacher && round.chosen.includes(at) ? 'picked' : 'open'], { f: T.cardNames[at] }),
      onTap: canTap ? tapCard : undefined,
    });
  }

  /** 숫자 마술: 쪽지, 고른 수, 뺄셈, 덧셈 */
  function magicNodes(round, { live, small }) {
    const note = noteCard({ title: T.noteTitle, sealedText: T.noteSealed, value: PREDICTION[round.board.digits], open: round.opened, small });
    if (small) return [stack('lp-magic small', note)];
    const work = [];
    const typing = live && !round.done;
    work.push(pickedBox({ label: T.picked, value: round.number ?? (typing && round.step === 'pick' ? round.typed : ''), live: typing && round.step === 'pick' }));
    if (round.number !== null) {
      const steps = magicSteps(round.number);
      const inSub = round.step === 'sub';
      work.push(columnSum({ top: steps.big, bottom: steps.small, op: '-', answer: inSub ? round.typed : steps.diff, look: inSub ? round.look : -1, live: typing && inSub }));
      if (round.step !== 'sub') {
        const inAdd = round.step === 'add';
        work.push(columnSum({ top: steps.diff, bottom: steps.back, op: '+', answer: inAdd ? round.typed : steps.sum, look: inAdd ? round.look : -1, live: typing && inAdd }));
      }
    }
    return [stack('lp-magic', note, stack('lp-work', ...work))];
  }

  function statusOf(round) {
    if (round.mode === 'cards') return T.status[round.phase === 'child' ? 'cards-child' : round.asking !== null ? 'cards-confirm' : 'cards-teacher'];
    if (round.mode === 'magic') return T.status.magic[round.step];
    if (round.mode === 'reach' && round.picked !== null) return fill(pick(T.status, 'reach-picked', round.picked), { k: round.picked });
    return T.status[round.mode];
  }

  function draw() {
    const { round } = frame;
    const playing = !round.done;
    $('lamps-board').replaceChildren(stack(`lp-play lp-mode-${round.mode}`, ...boardNodes(round, { live: true })));
    $('rule').textContent = ruleLine(round);
    $('lamps-status').textContent = round.done ? '' : (flash ?? statusOf(round));
    const best = round.mode === 'next' && round.best !== null;
    $('lamps-best-line').hidden = !best;
    if (best) $('lamps-best').textContent = fill(T.notebook.best, { k: round.best.value, n: round.best.reach });
    // 답하는 칸
    // 불 하나 더 달기에서는 숫자판이 오른쪽 칸을 차지한다. 불은 판에서 눌러 켜고 끌 수 있다.
    $('lamps-switch-box').hidden = !['targets', 'reach'].includes(round.mode);
    $('lamps-off').disabled = !playing || round.lit.length === 0;
    $('lamps-claim-box').hidden = round.mode !== 'reach';
    $('lamps-cannot').disabled = !playing || round.picked === null;
    const teacher = round.mode === 'cards' && round.phase !== 'child';
    $('lamps-trick-box').hidden = !teacher || round.asking !== null;
    $('lamps-picked').disabled = !playing || round.chosen.length === 0;
    $('lamps-confirm-box').hidden = !teacher || round.asking === null || !playing;
    const entry = entryKind(round);
    $('lamps-entry-box').hidden = entry === null || !playing;
    if (entry) drawEntry(round, entry);
    $('lamps-open').hidden = !(round.mode === 'magic' && round.step === 'open' && playing);
    frame.showWhy();
  }

  /** 숫자판을 쓰는 때: 'next' | 'cards' | 'pick' | 'sub' | 'add' | null */
  function entryKind(round) {
    if (round.mode === 'next') return 'next';
    if (round.mode === 'cards' && round.phase === 'child') return 'cards';
    if (round.mode === 'magic' && ['pick', 'sub', 'add'].includes(round.step)) return round.step;
    return null;
  }

  function drawEntry(round, entry) {
    $('lamps-entry-title').textContent = T.entry[entry];
    $('lamps-typed-line').hidden = entry === 'sub' || entry === 'add' || entry === 'pick';
    $('lamps-typed').textContent = round.typed;
    const limit = limitOf(round);
    for (const key of $('lamps-keys').querySelectorAll('button')) {
      key.disabled = round.done || (key.dataset.n !== 'erase' && round.typed.length >= limit);
      if (key.dataset.n === 'erase') key.disabled = round.done || round.typed === '';
    }
    $('lamps-try').hidden = entry !== 'next';
    $('lamps-guess').hidden = entry !== 'cards';
    $('lamps-choose').hidden = entry !== 'pick';
    $('lamps-calc').hidden = entry !== 'sub' && entry !== 'add';
    $('lamps-help').hidden = entry !== 'sub' && entry !== 'add';
    for (const id of ['lamps-try', 'lamps-guess', 'lamps-choose', 'lamps-calc']) $(id).disabled = round.typed === '';
  }

  const limitOf = (round) => {
    const entry = entryKind(round);
    if (entry === 'pick') return round.board.digits;
    if (entry === 'sub' || entry === 'add') return TYPE_LIMIT.calc;
    return TYPE_LIMIT[entry] ?? 2;
  };

  /** 한 일을 적고 다시 그린다 */
  function moved(type, data = {}) {
    const { round } = frame;
    round.moveCount += 1;
    frame.note(type, data);
    draw();
    frame.persist();
  }

  // ---- 불 켜고 끄기 ----
  function toggle(at) {
    const { round } = frame;
    if (!round || round.done || !['targets', 'reach', 'next'].includes(round.mode)) return;
    const on = !round.lit.includes(at);
    round.lit = on ? [...round.lit, at].sort((a, b) => a - b) : round.lit.filter((other) => other !== at);
    round.toggles += 1;
    flash = null;
    fresh = null;
    const sum = sumNow(round);
    let line = null;
    if (round.mode === 'targets' && round.board.targets.includes(sum)) {
      if (!round.made.includes(sum)) {
        round.made = [...round.made, sum];
        fresh = sum;
        flash = fill(pick(T.status, 'made', sum), { k: sum });
        line = fill(pick(T.play, 'made', sum), { k: sum });
      } else flash = fill(pick(T.status, 'made-again', sum), { k: sum });
    }
    if (round.mode === 'reach' && sum > 0) {
      const key = `${sum}:${maskOf(round.lit)}`;
      if (!round.made.includes(sum)) {
        round.made = [...round.made, sum];
        round.madeMasks = [...round.madeMasks, key];
        fresh = sum;
        flash = fill(pick(T.status, 'made', sum), { k: sum });
      } else if (!round.madeMasks.includes(key)) {
        round.madeMasks = [...round.madeMasks, key];
        fresh = sum;
        flash = fill(pick(T.status, 'made-other', sum), { k: sum });
        line = fill(pick(T.play, 'made-other', sum), { k: sum });
      } else flash = fill(pick(T.status, 'made-again', sum), { k: sum });
    }
    moved('toggle', { at, on, sum });
    if (round.mode === 'targets' && round.board.targets.every((n) => round.made.includes(n))) {
      round.answers.push({ t: frame.stamp(), answer: `made:${round.made.join('/')}`, correct: true, guess: null });
      frame.finish('solved');
      return;
    }
    if (line) say(line);
  }

  function allOff() {
    const { round } = frame;
    if (!round || round.done || round.lit.length === 0) return;
    round.lit = [];
    flash = null;
    fresh = null;
    moved('off');
  }

  // ---- 어디까지 될까: 줄에서 고르고 "못 만들어요" ----
  function tapStrip(n) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'reach') return;
    round.picked = round.picked === n ? null : n;
    flash = null;
    draw();
    frame.persist();
  }

  function claim() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'reach' || round.picked === null) return;
    const x = round.picked;
    const ways = waysOf(round.board.lamps);
    const first = reachOf(round.board.lamps) + 1;
    const result = ways[x] > 0 ? 'can' : x === first ? 'first' : 'earlier';
    round.claims = [...round.claims, { x, result, t: frame.stamp() }];
    round.answers.push({ t: frame.stamp(), answer: `cannot:${x}`, correct: result === 'first', guess: null });
    round.picked = null;
    if (result === 'first') {
      frame.note('claim', { x, result });
      frame.finish('solved');
      return;
    }
    round.wrongCount += 1;
    flash = null;
    moved('claim', { x, result });
    say(fill(pick(T.play, result === 'can' ? 'can' : 'earlier', x), { k: x }));
  }

  // ---- 숫자판 ----
  function press(key) {
    const { round } = frame;
    if (!round || round.done || entryKind(round) === null) return;
    if (key === 'erase') round.typed = round.typed.slice(0, -1);
    else if (/^\d$/.test(key) && round.typed.length < limitOf(round)) {
      // 맨 앞에 0은 넣지 않는다(0만 있는 답은 넣을 수 있다)
      if (!(key === '0' && round.typed === '' && entryKind(round) !== 'sub')) round.typed += key;
    }
    flash = null;
    draw();
    frame.persist();
  }

  // ---- 불 하나 더 달기 ----
  function tryLamp() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'next' || round.typed === '') return;
    const value = Number(round.typed);
    const top = stripTop(round.board);
    round.typed = '';
    if (!(value >= 1 && value <= top)) {
      flash = null;
      draw();
      frame.persist();
      say(fill(T.play['next-range'], { n: top }));
      return;
    }
    const again = round.tries.some((item) => item.value === value);
    const reach = reachOf(withLamp(round.board.lamps, value));
    round.extra = value;
    round.lit = round.lit.filter((at) => at < round.board.lamps.length);
    round.tries = [...round.tries, { value, reach, t: frame.stamp() }];
    if (round.best === null || reach > round.best.reach) round.best = { value, reach };
    round.answers.push({ t: frame.stamp(), answer: `lamp:${value}=${reach}`, correct: reach === frame.solution.bestReach, guess: null });
    flash = null;
    moved('try', { value, reach });
    if (reach === frame.solution.bestReach) {
      frame.finish('solved');
      return;
    }
    round.wrongCount += 1;
    frame.persist();
    const base = sumOf(round.board.lamps);
    const parts = [];
    if (again) parts.push(T.play['next-again']);
    parts.push(reach > base ? fill(T.play['next-gapless'], { k: value, n: reach }) : fill(pick(T.play, 'next-gap', reach + 1), { k: value, n: reach + 1 }));
    parts.push(T.play['next-more']);
    say(parts.join(' '));
  }

  // ---- 마음 읽기 카드 ----
  function tapCard(at) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'cards' || round.phase === 'child' || round.asking !== null) return;
    round.chosen = round.chosen.includes(at) ? round.chosen.filter((other) => other !== at) : [...round.chosen, at].sort((a, b) => a - b);
    flash = null;
    moved('card', { at });
  }

  /** "다 골랐어요": 선생님이 맞힌다(누른 카드의 맨 앞 수를 더한다) */
  function teacherGuess() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'cards' || round.phase === 'child' || round.chosen.length === 0) return;
    const guess = readCards(round.board.lamps, round.chosen);
    round.asking = guess;
    round.tricks = [...round.tricks, { chosen: round.chosen.slice(), guess, ok: null }];
    moved('trick', { chosen: round.chosen, guess });
    say(fill(pick(T.play, 'trick-guess', guess), { k: guess }));
  }

  function confirmTrick(ok) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'cards' || round.asking === null) return;
    round.tricks = round.tricks.map((item, at) => (at === round.tricks.length - 1 ? { ...item, ok } : item));
    round.asking = null;
    if (ok) {
      round.phase = 'child';
      round.chosen = [];
      round.typed = '';
    }
    moved('trick-answer', { ok });
    say(T.play[ok ? 'trick-yes' : 'trick-no']);
  }

  /** "맞혀 보기": 아이가 선생님의 수를 맞힌다. 다르면 표시한 카드와 어긋나는 카드 하나만 말한다 */
  function childGuess() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'cards' || round.phase !== 'child' || round.typed === '') return;
    const { lamps } = round.board;
    const guess = Number(round.typed);
    const secret = secretOf(round);
    const total = sumOf(lamps);
    round.typed = '';
    if (!(guess >= 1 && guess <= total)) {
      flash = null;
      draw();
      frame.persist();
      say(fill(T.play['guess-range'], { n: total }));
      return;
    }
    const ok = guess === secret;
    round.guesses = [...round.guesses, { secret, guess, ok, t: frame.stamp() }];
    round.answers.push({ t: frame.stamp(), answer: `guess:${secret}=${guess}`, correct: ok, guess: null });
    if (ok) {
      round.secretAt += 1;
      if (round.secretAt >= round.board.secrets.length) {
        frame.note('guess', { secret, guess, ok });
        frame.finish('solved');
        return;
      }
      moved('guess', { secret, guess, ok });
      say([fill(pick(T.play, 'guess-right', secret), { k: secret }), T.play['guess-next']].join(' '));
      return;
    }
    round.wrongCount += 1;
    moved('guess', { secret, guess, ok });
    const marked = cardsWith(lamps, secret);
    const has = cardsWith(lamps, guess);
    const also = has.find((at) => !marked.includes(at));
    if (also !== undefined) say(fill(pick(T.play, 'guess-also', guess), { k: guess, f: T.cardNames[also] }));
    else {
      const missing = marked.find((at) => !has.includes(at));
      say(fill(pick(T.play, 'guess-missing', guess), { k: guess, f: T.cardNames[missing] }));
    }
  }

  // ---- 숫자 마술 ----
  function choose() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'magic' || round.step !== 'pick' || round.typed === '') return;
    const n = Number(round.typed);
    const { digits } = round.board;
    round.answers.push({ t: frame.stamp(), answer: `pick:${round.typed}`, correct: magicOk(n, digits), guess: null });
    if (!magicOk(n, digits)) {
      round.picks = [...round.picks, n];
      flash = null;
      moved('pick', { n, ok: false });
      say(round.typed.length !== digits ? fill(T.play['pick-digits'], { f: T.digitWords[digits] }) : T.play['pick-gap']);
      return;
    }
    round.picks = [...round.picks, n];
    round.number = n;
    round.step = 'sub';
    round.typed = '';
    round.look = -1;
    moved('pick', { n, ok: true });
    say(T.play['pick-ok']);
  }

  /** 지금 칸의 답(뺀 수 또는 더한 수) */
  function expectedOf(round) {
    const steps = magicSteps(round.number);
    return round.step === 'sub' ? steps.diff : steps.sum;
  }

  function calc(helped = false) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'magic' || !['sub', 'add'].includes(round.step)) return;
    if (!helped && round.typed === '') return;
    const expected = expectedOf(round);
    const typed = helped ? String(expected) : round.typed;
    const ok = Number(typed) === expected;
    const step = round.step;
    round.calcs = [...round.calcs, { step, typed, ok, helped, t: frame.stamp() }];
    round.answers.push({ t: frame.stamp(), answer: `${step}:${typed}`, correct: ok, guess: null });
    if (helped) round.helped += 1;
    if (!ok) {
      round.wrongCount += 1;
      round.look = wrongColumn(expected, typed);
      moved('calc', { step, typed, ok });
      say(fill(T.play['calc-wrong'], { f: T.columns[round.look] }));
      return;
    }
    round.look = -1;
    round.typed = '';
    round.step = step === 'sub' ? 'add' : 'open';
    moved('calc', { step, typed, ok, helped });
    const next = step === 'sub' ? T.play['sub-ok'] : T.play['add-ok'];
    say(helped ? `${T.play.helped} ${next}` : next);
  }

  function openNote() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'magic' || round.step !== 'open') return;
    round.opened = true;
    round.answers.push({ t: frame.stamp(), answer: `open:${PREDICTION[round.board.digits]}`, correct: true, guess: null });
    frame.note('open');
    frame.finish('solved');
  }

  // ---- 끝났을 때 하는 말 ----
  function whyJustOpened(round) {
    const records = frame.records();
    const family = familyOf(round.mode);
    return whyOpen(records, family) && !whyOpen(records.filter((record) => record.id !== round.id), family);
  }

  function rightLine(round, solution) {
    const parts = [];
    if (round.mode === 'targets') parts.push(fill(T.right.targets, { n: round.board.targets.length }), T.right['targets-then']);
    if (round.mode === 'reach') {
      if (solution.reach === 0) parts.push(T.right['reach-none']);
      else parts.push(fill(pick(T.right, 'reach', solution.first), { k: solution.reach, n: solution.first }));
      if (solution.reach > 0 && Array.from({ length: solution.reach }, (_, at) => at + 1).every((n) => round.made.includes(n))) parts.push(fill(T.right['reach-all'], { k: solution.reach }));
      const twice = [...madeWays(round)].find(([, ways]) => ways >= 2);
      if (twice) parts.push(fill(pick(T.right, 'reach-twice', twice[0]), { k: twice[0] }));
    }
    if (round.mode === 'next') {
      parts.push(fill(T.right['next-best'], { k: round.best.value, n: round.best.reach }));
      if (round.tries.length > 1) parts.push(fill(T.right['next-tries'], { n: round.tries.length }));
    }
    if (round.mode === 'cards') parts.push(fill(T.right.cards, { n: round.board.secrets.length }), T.right['cards-then']);
    if (round.mode === 'magic') parts.push(fill(T.right.magic, { k: PREDICTION[round.board.digits] }), T.right['magic-then']);
    if (!round.side && whyJustOpened(round)) parts.push(T.right['why-invite']);
    return parts;
  }

  // ---- 풀이와 "왜 그럴까?"의 그림 ----
  function lampsFigure(lamps, lit, note) {
    return figureCard([lampRow({ lamps, lit }), sumBox(T.sumLabel, litSum(lamps, lit), { small: true })], note);
  }

  function stripFigure(lamps, top, note, { gap = null, ways = false } = {}) {
    const { made, cannot, ways: counted } = canSets(lamps, top);
    const shown = ways ? new Map(Array.from({ length: top }, (_, at) => [at + 1, counted[at + 1] ?? 0])) : null;
    return figureCard([numberStrip({ top, made, cannot, gap, ways: shown, allWays: ways })], note);
  }

  function cardsFigure(lamps, picked, mark, note, show = null) {
    const list = show ?? lamps.map((_, at) => at);
    return figureCard([cardGrid({ cards: list.map((at) => ({ title: cardTitle(at), numbers: cardNumbers(lamps, at), picked: picked.includes(at), marked: false })), mark })], note);
  }

  function columnFigure(top, bottom, op, note, sums = null) {
    return figureCard([columnSum({ top, bottom, op, answer: op === '-' ? top - bottom : top + bottom, look: -1, sums })], note);
  }

  function chainFigure(n, note) {
    const steps = magicSteps(n);
    return figureCard(
      [
        stack('lp-chain', columnSum({ top: steps.big, bottom: steps.small, op: '-', answer: steps.diff, look: -1, small: true }), columnSum({ top: steps.diff, bottom: steps.back, op: '+', answer: steps.sum, look: -1, small: true })),
      ],
      note,
    );
  }

  function figureOf(item) {
    if (item.type === 'lamps') return lampsFigure(item.lamps, item.lit, item.note);
    if (item.type === 'strip') return stripFigure(item.lamps, item.top, item.note, { ways: item.ways === true });
    if (item.type === 'cards') return cardsFigure(item.lamps, item.picked, item.mark, item.note, item.show ?? null);
    if (item.type === 'column') return columnFigure(item.rows[0], item.rows[1], item.op, item.note, item.sums ?? null);
    return chainFigure(item.n, item.note);
  }

  /** "왜 그럴까?": 선생님이 어떻게 알아챘는지의 이야기. 불, 카드, 마술마다 따로 있고, 그 묶음의 판을 한 번 끝까지 한 뒤에 열린다 */
  function whyPages(round) {
    const family = familyOf(round.mode);
    if (!whyOpen(frame.records(), family)) return null;
    return T.why[family].map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [figureRow(slide.figures.map(figureOf))];
      },
    }));
  }

  function solutionPages(round, solution) {
    const { board } = round;
    if (board.kind === 'targets') {
      const cards = board.targets.map((n) => lampsFigure(board.lamps, litFor(board.lamps, n), fill(pick(T.solution, 'target-note', n), { k: n })));
      return [{ say: T.solution.targets, nodes: [figureRow(cards)] }];
    }
    if (board.kind === 'reach') {
      const say = solution.reach === 0 ? T.solution['reach-none'] : fill(pick(T.solution, 'reach', solution.first), { k: solution.reach, n: solution.first });
      return [{ say, nodes: [figureRow([stripFigure(board.lamps, stripTop(board), T.solution['reach-note'], { gap: solution.first })])] }];
    }
    if (board.kind === 'next') {
      const lamps = [...board.lamps, solution.best];
      const card = figureCard([lampRow({ lamps, lit: [], fresh: board.lamps.length }), numberStrip({ made: canSets(lamps, solution.top).made, cannot: canSets(lamps, solution.top).cannot, top: solution.top, gap: solution.bestReach + 1 })], null);
      return [{ say: fill(T.solution.next, { k: solution.best, n: solution.bestReach }), nodes: [figureRow([card])] }];
    }
    if (board.kind === 'cards') {
      const cards = board.secrets.map((n) => {
        const has = cardsWith(board.lamps, n);
        return cardsFigure(board.lamps, has, n, fill(T.solution['cards-note'], { f: has.map((at) => T.cardNames[at]).join(', '), k: n }));
      });
      return [{ say: T.solution.cards, nodes: [figureRow(cards)] }];
    }
    const n = round.number ?? T.solution['magic-example'][board.digits];
    return [{ say: fill(T.solution.magic, { k: n }), nodes: [figureRow([chainFigure(n, null)])] }];
  }

  // ---- 직접 만들기: 불을 골라 달면 선생님이 어디까지 만들 수 있는지 알려 준다. 숫자 마술을 아무 수로 해 본다 ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const okLamps = (lamps) => Array.isArray(lamps) && lamps.length <= MAKE_COUNT[1] && lamps.every((value) => Number.isInteger(value) && value >= MAKE_VALUES[0] && value <= MAKE_VALUES[1]);
    if (!saved || !okLamps(saved.lamps) || !['lamps', 'magic'].includes(saved.tab)) return { ...FIRST_DRAFT, lamps: FIRST_DRAFT.lamps.slice() };
    const value = Number.isInteger(saved.value) && saved.value >= MAKE_VALUES[0] && saved.value <= MAKE_VALUES[1] ? saved.value : FIRST_DRAFT.value;
    const typed = typeof saved.typed === 'string' && /^\d{0,3}$/.test(saved.typed) ? saved.typed : '';
    return { tab: saved.tab, lamps: saved.lamps.slice().sort((a, b) => a - b), value, typed };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    shown = null;
    $('lamps-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(draft.tab === 'magic' ? T.make['magic-intro'] : T.make.intro);
  }

  function drawMake() {
    const magic = draft.tab === 'magic';
    for (const button of $('lamps-make-tabs').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.tab === draft.tab));
    $('lamps-make-lamps-box').hidden = magic;
    $('lamps-make-magic-box').hidden = !magic;
    $('lamps-make-play').hidden = magic;
    if (magic) {
      $('lamps-make-typed').textContent = draft.typed;
      for (const key of $('lamps-make-keys').querySelectorAll('button')) {
        key.disabled = key.dataset.n === 'erase' ? draft.typed === '' : draft.typed.length >= TYPE_LIMIT.make;
      }
      $('lamps-make-solve').disabled = draft.typed.length < 2;
      const nodes = [];
      if (shown?.n !== undefined) {
        const steps = magicSteps(shown.n);
        nodes.push(pickedBox({ label: T.picked, value: shown.n }), stack('lp-chain', columnSum({ top: steps.big, bottom: steps.small, op: '-', answer: steps.diff, look: -1 }), columnSum({ top: steps.diff, bottom: steps.back, op: '+', answer: steps.sum, look: -1 })));
      } else nodes.push(pickedBox({ label: T.picked, value: draft.typed, live: true }));
      $('lamps-make-board').replaceChildren(stack('lp-play lp-magic', stack('lp-work', ...nodes)));
      return;
    }
    const lamps = draft.lamps;
    $('lamps-make-count').textContent = fill(T.make.count, { n: lamps.length });
    $('lamps-make-value').textContent = String(draft.value);
    $('lamps-make-fewer').disabled = draft.value <= MAKE_VALUES[0];
    $('lamps-make-more').disabled = draft.value >= MAKE_VALUES[1];
    $('lamps-make-add').disabled = lamps.length >= MAKE_COUNT[1];
    $('lamps-make-clear').disabled = lamps.length === 0;
    $('lamps-make-solve').disabled = lamps.length === 0;
    $('lamps-make-play').disabled = madeBoard() === null;
    const nodes = [
      lampRow({
        lamps,
        lit: [],
        label: (at) => fill(T.lampState.off, { k: lamps[at] }),
        onTap: removeLamp,
      }),
    ];
    if (lamps.length > 0) {
      const top = Math.min(sumOf(lamps) + 1, STRIP_CAP);
      if (shown?.lamps) {
        const { made, cannot, ways } = canSets(lamps, top);
        nodes.push(numberStrip({ top, made, cannot, gap: reachOf(lamps) + 1 <= top ? reachOf(lamps) + 1 : null, ways: new Map(Array.from({ length: top }, (_, at) => [at + 1, ways[at + 1] ?? 0])) }));
      } else nodes.push(numberStrip({ top }));
    }
    $('lamps-make-board').replaceChildren(stack('lp-play lp-make', ...nodes));
  }

  function changeDraft(change) {
    draft = { ...draft, ...change };
    shown = null;
    $('lamps-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  function addLamp() {
    if (draft.lamps.length >= MAKE_COUNT[1]) {
      frame.talkers.make.say(fill(T.make.full, { n: MAKE_COUNT[1] }));
      return;
    }
    changeDraft({ lamps: [...draft.lamps, draft.value].sort((a, b) => a - b) });
  }

  function removeLamp(at) {
    changeDraft({ lamps: draft.lamps.filter((_, index) => index !== at) });
  }

  function stepValue(step) {
    const value = draft.value + step;
    if (value < MAKE_VALUES[0] || value > MAKE_VALUES[1]) return;
    draft = { ...draft, value };
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  function pressMake(key) {
    if (draft.tab !== 'magic') return;
    let typed = draft.typed;
    if (key === 'erase') typed = typed.slice(0, -1);
    else if (/^\d$/.test(key) && typed.length < TYPE_LIMIT.make && !(key === '0' && typed === '')) typed += key;
    changeDraft({ typed });
  }

  /** "선생님, 알려 주세요": 불이면 1부터 어디까지 되는지와 만들 수 없는 수, 마술이면 뒤집어 빼고 더한 것 */
  function solveDraft() {
    const now = new Date().toISOString();
    const save = (board, solution) => {
      log.saveRecord({ kind: 'made', v: 1, id: log.newId('m'), format: FORMAT, startedAt: now, endedAt: now, board, solution });
      log.flush();
    };
    if (draft.tab === 'magic') {
      const n = Number(draft.typed);
      if (!(n >= 10 && n <= 999)) {
        frame.talkers.make.say(T.make['magic-range']);
        return;
      }
      const digits = String(n).length;
      const steps = magicSteps(n);
      const gap = gapOf(n);
      const lines = [fill(pick(T.make, 'magic-result', steps.sum), { k: steps.sum })];
      const result = resultForGap(digits, gap);
      if (gap === 0) lines.push(fill(T.make['magic-same'], { f: T.digitWords[digits] }));
      else lines.push(fill(pick(T.make, 'magic-gap', result), { n: gap, f: T.digitWords[digits], k: result }));
      if (gap >= 2) {
        const table = magicTable(digits);
        const hits = table.byGap.filter((row) => row.gap >= 2).reduce((total, row) => total + row.count, 0);
        lines.push(fill(T.make['magic-count'], { f: T.digitWords[digits], total: table.total, k: PREDICTION[digits], n: hits }));
      }
      shown = { n };
      drawMake();
      const line = lines.join(' ');
      $('lamps-make-result').textContent = line;
      save({ kind: 'magic', n }, { possible: true, steps });
      frame.talkers.make.say(line);
      return;
    }
    const lamps = draft.lamps.slice();
    if (lamps.length === 0) return;
    const reach = reachOf(lamps);
    const top = Math.min(sumOf(lamps) + 1, STRIP_CAP);
    const missing = missingOf(lamps, sumOf(lamps));
    const ways = waysOf(lamps);
    const twice = ways.filter((value, n) => n > 0 && value >= 2).length;
    const lines = [reach === 0 ? T.make['reach-none'] : fill(T.make.reach, { k: reach })];
    // 빈 곳이 없으면 첫 줄과 같은 말이 되므로, 만들 수 없는 수가 있을 때만 그 수를 말한다
    if (missing.length > 0) lines.push(fill(T.make.missing, { total: sumOf(lamps), n: missing.length }));
    lines.push(twice === 0 ? T.make.once : fill(T.make.twice, { n: twice }));
    shown = { lamps };
    drawMake();
    const line = lines.join(' ');
    $('lamps-make-result').textContent = line;
    save({ kind: 'reach', lamps }, { possible: true, reach, missing: missing.length, twice, top });
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판): 불이 둘 이상이면 "어디까지 될까" 판. 아니면 null */
  function madeBoard() {
    if (!draft || draft.tab !== 'lamps' || draft.lamps.length < MAKE_COUNT[0]) return null;
    const board = { kind: 'reach', lamps: draft.lamps.slice().sort((a, b) => a - b) };
    return checkBoard(board) === null ? board : null;
  }

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
    else frame.talkers.make.say(T.make['keep-not-yet']);
  }

  // ---- 단추 잇기 ----
  $('lamps-off').addEventListener('click', allOff);
  $('lamps-cannot').addEventListener('click', claim);
  $('lamps-picked').addEventListener('click', teacherGuess);
  $('lamps-yes').addEventListener('click', () => confirmTrick(true));
  $('lamps-no').addEventListener('click', () => confirmTrick(false));
  $('lamps-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.n;
    if (key) press(key);
  });
  $('lamps-try').addEventListener('click', tryLamp);
  $('lamps-guess').addEventListener('click', childGuess);
  $('lamps-choose').addEventListener('click', choose);
  $('lamps-calc').addEventListener('click', () => calc(false));
  $('lamps-help').addEventListener('click', () => calc(true));
  $('lamps-open').addEventListener('click', openNote);
  $('lamps-make-tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('button')?.dataset.tab;
    if (!['lamps', 'magic'].includes(tab) || tab === draft.tab) return;
    changeDraft({ tab });
    frame.talkers.make.say(tab === 'magic' ? T.make['magic-intro'] : T.make.intro);
  });
  $('lamps-make-fewer').addEventListener('click', () => stepValue(-1));
  $('lamps-make-more').addEventListener('click', () => stepValue(1));
  $('lamps-make-add').addEventListener('click', addLamp);
  $('lamps-make-clear').addEventListener('click', () => changeDraft({ lamps: [] }));
  $('lamps-make-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.n;
    if (key) pressMake(key);
  });
  $('lamps-make-solve').addEventListener('click', solveDraft);
  $('lamps-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ board }) {
    const start = copyBoard(board);
    return {
      mode: start.kind,
      board: start, // 판: 불(또는 자리 수)과 적힌 수, 선생님의 수
      lit: [], // 켠 불의 번호(불 하나 더 달기에서는 단 불이 맨 뒤 번호다)
      made: [], // 만든 수(만든 차례대로, 한 번씩)
      madeMasks: [], // 어디까지 될까: 만든 방법들("수:불 묶음")
      picked: null, // 어디까지 될까: 줄에서 고른 수
      claims: [], // 어디까지 될까: "못 만들어요"를 누른 수와 그때의 사실 { x, result: 'can' | 'earlier' | 'first' }
      extra: null, // 불 하나 더 달기: 지금 달아 둔 불의 수
      tries: [], // 불 하나 더 달기: 달아 본 불과 그때 빈 곳 없이 간 끝 { value, reach }
      best: null, // 불 하나 더 달기: 지금까지 가장 멀리 간 것 { value, reach }
      typed: '', // 숫자판으로 넣는 중인 글자
      phase: start.kind === 'cards' ? 'teacher' : null, // 카드: 선생님이 맞히는 때('teacher')와 아이가 맞히는 때('child')
      chosen: [], // 카드: 아이가 누른 카드
      asking: null, // 카드: 선생님이 말한 수(맞았는지 묻는 중)
      tricks: [], // 카드: 선생님이 맞혀 본 것 { chosen, guess, ok }
      secretAt: 0, // 카드: 지금 맞히는 선생님의 수의 차례
      guesses: [], // 카드: 아이가 넣은 수 { secret, guess, ok }
      step: start.kind === 'magic' ? 'pick' : null, // 마술: 'pick' | 'sub' | 'add' | 'open'
      number: null, // 마술: 고른 수
      picks: [], // 마술: 넣어 본 수
      calcs: [], // 마술: 넣은 답 { step, typed, ok, helped }
      look: -1, // 마술: 다시 볼 자리
      opened: false, // 마술: 쪽지를 폈는가
      helped: 0, // 마술: "선생님이 계산해 주세요"를 누른 수
      toggles: 0, // 불을 켜고 끈 수
      moveCount: 0, // 이 판에서 한 일의 수
      wrongCount: 0, // 사실과 다른 답의 수(못 만드는 수가 아니었던 것, 가장 멀리 가지 않은 불, 다른 수, 다시 볼 자리가 있던 계산)
    };
  }

  function drawBlank(root) {
    root.replaceChildren(stack('lp-play small', lampRow({ lamps: BLANK, lit: [], slot: true, small: true })));
  }

  const intList = (list, ok = count) => Array.isArray(list) && list.every(ok);

  return {
    id: FORMAT,
    T,
    padId: 'lamps-pad',
    makeId: 'make-lamps',
    // 불의 줄, 합, 수의 줄이 위아래로 쌓여 세로가 모자라다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다.
    ruleAside: true,
    homeIds: { sample: 'home-lamps-sample', blank: 'home-lamps-blank', ask: 'home-lamps-ask', play: 'home-lamps-play', pick: 'home-lamps-pick', make: 'home-lamps-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (checkBoard(saved.board) !== null || saved.mode !== saved.board.kind || !MODES.includes(saved.mode)) return false;
      const lamps = saved.mode === 'next' && saved.extra !== null ? [...saved.board.lamps, saved.extra] : saved.board.lamps ?? [];
      if (!intList(saved.lit, (at) => Number.isInteger(at) && at >= 0 && at < lamps.length)) return false;
      if (!intList(saved.made) || !Array.isArray(saved.madeMasks) || !saved.madeMasks.every((key) => typeof key === 'string')) return false;
      if (saved.picked !== null && !count(saved.picked)) return false;
      if (![saved.claims, saved.tries, saved.tricks, saved.guesses, saved.picks, saved.calcs].every(Array.isArray)) return false;
      if (saved.extra !== null && !(saved.mode === 'next' && count(saved.extra))) return false;
      if (saved.best !== null && !(saved.best && count(saved.best.value) && count(saved.best.reach))) return false;
      if (typeof saved.typed !== 'string' || !/^\d{0,4}$/.test(saved.typed)) return false;
      if (saved.mode === 'cards') {
        if (!['teacher', 'child'].includes(saved.phase) || !intList(saved.chosen, (at) => Number.isInteger(at) && at >= 0 && at < lamps.length)) return false;
        if (!(Number.isInteger(saved.secretAt) && saved.secretAt >= 0 && saved.secretAt < saved.board.secrets.length)) return false;
        if (saved.asking !== null && !count(saved.asking)) return false;
      }
      if (saved.mode === 'magic') {
        if (!['pick', 'sub', 'add', 'open'].includes(saved.step)) return false;
        if (saved.step === 'pick' ? saved.number !== null : !magicOk(saved.number, saved.board.digits)) return false;
        if (!Number.isInteger(saved.look) || saved.look < -1 || saved.look > 3) return false;
      }
      if (typeof saved.opened !== 'boolean') return false;
      return [saved.helped, saved.toggles, saved.moveCount, saved.wrongCount].every(count);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글)을 보이거나 감춘다. 무르기와 되돌리기는 쓰지 않는다 */
    showParts(on) {
      $('lamps-board').hidden = !on;
      $('lamps-count').hidden = !on;
      if (on) {
        // 이 형식은 틀의 형식 목록에서 맨 뒤라, 앞의 형식(엉킨 그림 풀기)이 보이게 해 둔 무르기와 되돌리기를 여기서 다시 감춘다.
        $('undo').hidden = true;
        $('reset').hidden = true;
      }
    },
    enter: forget,
    draw,
    ended: forget,
    ruleLine,
    hints: (round) => T.hints[hintKey(round)],
    touched: (round) => round.moveCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view: (round) => ({ mode: round.mode, lit: round.lit.slice(), sum: sumNow(round), made: round.made.slice(), extra: round.extra, phase: round.phase, step: round.step, typed: round.typed }),
    /** 이 판보다 작은 판: 불(카드)이 하나 적은 판, 두 자리 숫자 마술 */
    smaller: (round, turn) => smallerLamps({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const answer = { possible: true };
      if (solution.kind === 'reach') Object.assign(answer, { reach: solution.reach, first: solution.first, twice: solution.twice.length });
      if (solution.kind === 'next') Object.assign(answer, { best: solution.best, bestReach: solution.bestReach });
      if (solution.kind === 'cards') Object.assign(answer, { secrets: solution.secrets });
      if (solution.kind === 'magic') Object.assign(answer, { prediction: solution.prediction });
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: answer,
        lit: round.lit,
        made: round.made,
        madeWays: [...madeWays(round)].filter(([, ways]) => ways >= 2).map(([n]) => n),
        claims: round.claims,
        tries: round.tries,
        best: round.best,
        reachedBest: round.mode === 'next' && round.best !== null && round.best.reach === solution.bestReach,
        tricks: round.tricks,
        guesses: round.guesses,
        number: round.number,
        picks: round.picks,
        calcs: round.calcs,
        helped: round.helped,
        opened: round.opened,
        toggles: round.toggles,
        moveCount: round.moveCount,
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo() {},
    reset() {},
    /** 글자판이 있는 기기: 숫자판을 쓰는 때에 숫자, 지우기, 들이기(그때의 단추)를 받는다 */
    onKey(event) {
      const { round } = frame;
      if (!round || $('lamps-pad').hidden) return;
      const entry = entryKind(round);
      if (entry === null) return;
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') press('erase');
      else if (event.key === 'Enter') ({ next: tryLamp, cards: childGuess, pick: choose, sub: () => calc(false), add: () => calc(false) })[entry]();
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).hint],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      root.replaceChildren(stack('lp-play small', ...boardNodes(begin({ board }), { small: true })));
    },
    drawBlank,
    drawResume(root, saved) {
      root.replaceChildren(stack('lp-play small', ...boardNodes(saved, { small: true })));
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나와 켠 불 몇 개 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) {
        drawBlank(root);
        return;
      }
      const board = picture.kind === 'magic' ? { kind: 'magic', digits: picture.digits } : picture.kind === 'cards' ? { kind: 'cards', lamps: picture.lamps, secrets: [1] } : picture.kind === 'targets' ? { kind: 'targets', lamps: picture.lamps, targets: picture.targets } : { kind: picture.kind, lamps: picture.lamps };
      const round = { ...begin({ board }), lit: picture.lit ?? [], made: picture.made ?? [] };
      root.replaceChildren(stack('lp-play small', ...boardNodes(round, { small: true })));
    },
    showMake,
    /** 직접 만들기에서 다 만든 판. 불이 둘 이상이어야 한다. 아니면 null(공책에 남기기가 쓴다) */
    madeBoard,
    /**
     * 가장 좋은 기록(공책에 저절로 남는다): 불 하나 더 달기에서 빈 곳 없이 가장 멀리 간 것. 한 번도 달아 보지 않았으면 null.
     */
    bestOf: (round) => (round.mode !== 'next' || round.best === null ? null : { value: round.best.reach, name: fill(T.notebook.best, { k: round.best.value, n: round.best.reach }) }),
  };
}
