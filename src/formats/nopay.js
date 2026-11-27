// 낼 수 없는 금액: 판 화면에서 이 형식이 맡는 부분(동전과 담은 동전, 금액 띠, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/nopay.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 동전을 누르면 하나 담기고, 담은 동전을 누르면 하나 빠진다. 담은 동전의 합은 "○원 낼 수 있어요" 단추에 늘 적혀 있다.
// 그 단추를 누르면 그 합이 띠에 칠해진다(동전으로 만든 금액이라 늘 낼 수 있는 금액이다. 컴퓨터가 대신 칠하지 않는다).
//   못 낸다고 골라 둔 금액을 칠하면 고른 것이 풀린다. 칠한 금액을 누르면 그때 담았던 동전이 다시 담긴다.
// 띠의 칠하지 않은 금액을 누르면 "못 내요"로 고른다(다시 누르면 그만둔다). 고른 것이 맞는지는 아이가 답할 때만 따진다.
// 모두 찾기(1·2단계): "다 골랐어요"를 누르면 고른 금액이 낼 수 없는 금액과 꼭 같을 때 끝난다. 다르면 사실 하나만 말한다
//   (고른 금액 가운데 낼 수 있는 금액 하나, 없으면 빠뜨린 금액의 수).
// 어디부터(3단계)와 끝이 있을까(4·5단계, 직접 만든 판): 몇 원부터 모두 낼 수 있는지 자물쇠에 넣는다. 다르면 넣은 금액에 대한 사실만 말한다.
//   4·5단계와 직접 만든 판에는 "끝이 없어요" 단추가 있다. 끝이 있는 판에 누르면 틀렸다고 하지 않고 끝이 있다는 사실만 말한다.
// 왼쪽 칸의 "○줄로 나눠 놓기"(도구)를 켜면 띠를 가장 작은 동전의 값만큼의 가로줄로 다시 놓는다(1, 2, 3이 첫 세로줄, 4, 5, 6이 둘째 세로줄). 무엇이 보이는지는 말하지 않는다.
//   처음 켤 때 힌트 하나로 센다.
import T from '../content/nopay.json';
import { LADDER, MAKE_COINS, MAKE_FIRST, MAKE_LEVEL, TOP_LEVEL, generateBoard, kindOf, madeBoard as boardOfCoins, nextSeed, rungOf, solveOnce } from '../core/nopay-ladder.js';
import { MAX_SUM, canPay, checkBoard, copyBoard, endOf, nextUnpayable, replay, unpayableIn } from '../core/nopay.js';
import { smallerNopay } from '../core/smaller.js';
import { fill } from '../core/text.js';
import { drawCoins, drawSample as drawSmall, drawStrip, drawTray, stripCard, tableCard } from '../ui/nopay-board.js';

const FORMAT = 'nopay';
const MODES = ['first', 'more', 'from', 'end', 'three', 'made'];
/** 자물쇠에 넣을 수 있는 자릿수 */
const TYPE_LIMIT = 2;

const count = (value) => Number.isInteger(value) && value >= 0;

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createNopay(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let pointed = null; // 선생님이 띠에서 짚은 금액(점선 고리). 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 만들던 동전 { coins }(정한 차례대로)
  let made = null; // 직접 만들기에서 선생님이 따진 것(동전을 고치면 지운다)

  const isAll = (round) => round.board.kind === 'all';
  const hasEnd = (round) => round.board.kind === 'end';
  const stateOf = (round) => replay(round.board, round.trail);
  const coinName = (value) => fill(T.words.coin, { n: value });
  const faceOf = (coins) => coins.map(coinName).join(T.words.join);
  const paidOf = (state) => state.paid.map(([amount]) => amount);

  const labels = {
    coin: (value) => fill(T.labels.coin, { n: value }),
    chip: (value, many) => fill(T.labels.chip, { n: value, k: many }),
    cell: (no, paid, marked) => fill(T.labels.cell, { n: no, face: paid ? T.labels.paid : marked ? T.labels.marked : T.labels.plain }),
  };

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const { coins, top } = board;
    const playing = !round.done;
    const state = stateOf(round);
    const paid = paidOf(state);
    drawCoins($('nopay-coins'), {
      coins,
      won: T.words.won,
      label: labels.coin,
      onCoin: playing ? addCoin : undefined,
      disabled: (at) => state.sum + coins[at] > MAX_SUM,
    });
    drawTray($('nopay-tray'), { coins, tray: state.tray, label: labels.chip, onTake: playing ? takeCoin : undefined });
    // 단추에 담은 동전의 합을 적는다. 띠 밖의 금액이나 벌써 칠한 금액은 누를 수 없다(판 아래에 그 사실을 적는다)
    $('nopay-pay').textContent = state.sum > 0 ? fill(T.words.pay, { n: state.sum }) : T.words['pay-empty'];
    $('nopay-pay').disabled = !playing || state.sum < 1 || state.sum > top || paid.includes(state.sum);
    drawStrip($('nopay-strip'), {
      top,
      rows: round.rowsOn ? coins[0] : null,
      paid,
      marked: state.marks,
      pointed,
      label: labels.cell,
      stripLabel: fill(T.labels.strip, { n: top }),
      onCell: playing ? tapCell : undefined,
    });

    // 판 아래: 할 일이나 사실 한 줄. 고른 금액의 수는 오른쪽 칸에
    $('nopay-marked').textContent = String(state.marks.length);
    $('nopay-status').textContent = flash ?? statusOf(round, state, paid);
    $('undo').disabled = !playing || round.trail.length === 0;
    $('reset').disabled = !playing || round.trail.length === 0;

    drawPad(round, state, playing);
    // 도구: 작은 동전의 값만큼의 줄로 나눠 놓기
    $('nopay-rows').textContent = round.rowsOn ? T.tool.on : fill(T.tool.off, { n: coins[0] });
    $('nopay-rows').setAttribute('aria-pressed', String(round.rowsOn));
    frame.showWhy();
  }

  /** 오른쪽 칸: 모두 찾기의 "다 골랐어요", 자물쇠와 숫자판, "끝이 없어요" */
  function drawPad(round, state, playing) {
    $('nopay-all-box').hidden = !isAll(round);
    $('nopay-submit').disabled = !playing || state.marks.length === 0;
    $('nopay-lock-box').hidden = isAll(round);
    if (!isAll(round)) {
      $('nopay-lock').classList.toggle('open', round.done && round.answers.at(-1)?.answer !== 'endless');
      $('nopay-ask').textContent = $('nopay-lock').classList.contains('open') ? T.lock.opened : T.lock.ask;
      $('nopay-typed').textContent = round.typed;
      for (const key of $('nopay-keys').querySelectorAll('button')) {
        if (key.dataset.n === 'erase') key.disabled = !playing || round.typed === '';
        else key.disabled = !playing || round.typed.length >= TYPE_LIMIT || (key.dataset.n === '0' && round.typed === '');
      }
      $('nopay-open').disabled = !playing || round.typed === '';
    }
    $('nopay-maybe').hidden = !hasEnd(round);
    $('nopay-endless').disabled = !playing;
  }

  function statusOf(round, state, paid) {
    if (round.done) {
      const last = round.answers.at(-1)?.answer;
      if (last === 'endless') return T.status['end-done'];
      return T.status[isAll(round) ? 'all-done' : 'lock-done'];
    }
    if (state.sum === 0) return T.status.start;
    if (state.sum > round.board.top) return fill(T.status.over, { n: round.board.top });
    if (paid.includes(state.sum)) return fill(T.status.already, { n: state.sum });
    return fill(T.status.tray, { n: state.sum });
  }

  /** 한 일을 적고 다시 그린다 */
  function step(round, move, line = null) {
    round.trail = [...round.trail, move];
    flash = line;
    pointed = null;
    draw();
    frame.persist();
  }

  // ---- 동전 담기 ----
  function addCoin(at) {
    const { round } = frame;
    if (!round || round.done) return;
    const { coins } = round.board;
    if (!Number.isInteger(at) || at < 0 || at >= coins.length || stateOf(round).sum + coins[at] > MAX_SUM) return;
    round.moveCount += 1;
    frame.note('coin', { coin: coins[at], sum: stateOf(round).sum + coins[at] });
    step(round, `c${at}`);
  }

  function takeCoin(at) {
    const { round } = frame;
    if (!round || round.done) return;
    const { coins } = round.board;
    if (!Number.isInteger(at) || at < 0 || at >= coins.length || stateOf(round).tray[at] === 0) return;
    round.moveCount += 1;
    frame.note('take', { coin: coins[at], sum: stateOf(round).sum - coins[at] });
    step(round, `x${at}`);
  }

  /** "이 금액 낼 수 있어요": 담은 동전의 합을 띠에 칠한다. 못 낸다고 골라 둔 금액이면 고른 것이 풀린다 */
  function pay() {
    const { round } = frame;
    if (!round || round.done) return;
    const state = stateOf(round);
    const { sum } = state;
    if (sum < 1 || sum > round.board.top || paidOf(state).includes(sum)) return;
    const wasMarked = state.marks.includes(sum);
    round.payCount += 1;
    if (wasMarked) round.unmarkCount += 1;
    frame.note('pay', { amount: sum, tray: state.tray.slice(), marked: wasMarked });
    step(round, 'p', fill(T.status[wasMarked ? 'paid-marked' : 'paid'], { n: sum }));
  }

  /** 띠의 칸: 칠한 금액이면 그때 담았던 동전을 다시 담고, 아니면 "못 내요"로 고르거나 그만둔다 */
  function tapCell(no) {
    const { round } = frame;
    if (!round || round.done || !Number.isInteger(no) || no < 1 || no > round.board.top) return;
    const state = stateOf(round);
    if (paidOf(state).includes(no)) {
      round.moveCount += 1;
      frame.note('load', { amount: no });
      step(round, `w${no}`, fill(T.status.loaded, { n: no }));
      return;
    }
    const on = !state.marks.includes(no);
    round.markCount += 1;
    frame.note('mark', { amount: no, on });
    step(round, `m${no}`, fill(T.status[on ? 'marked' : 'unmarked'], { n: no }));
  }

  // ---- 답하기 ----
  /** "다 골랐어요": 고른 금액이 낼 수 없는 금액과 꼭 같으면 끝난다. 다르면 사실 하나만 말한다 */
  function submit() {
    const { round, solution } = frame;
    if (!round || round.done || !isAll(round)) return;
    const { marks } = stateOf(round);
    if (marks.length === 0) return;
    const truth = new Set(solution.unpayable);
    const extra = marks.filter((no) => !truth.has(no));
    const missed = solution.unpayable.filter((no) => !marks.includes(no));
    const correct = extra.length === 0 && missed.length === 0;
    const guess = correct ? null : extra.length > 0 ? 'extra' : 'missed';
    round.submitCount += 1;
    round.answers.push({ t: frame.stamp(), answer: `marks:${marks.join(',')}`, correct, guess });
    frame.note('answer', { answer: marks.join(','), correct, guess });
    if (correct) {
      flash = null;
      frame.finish('solved');
      return;
    }
    round.wrongCount += 1;
    flash = null;
    let line;
    if (extra.length > 0) {
      // 고른 금액 가운데 낼 수 있는 금액 하나를 짚는다. 동전으로 만들어 보면 알 수 있다
      pointed = extra[0];
      line = fill(T.play.extra, { n: pointed });
    } else {
      // 빠뜨린 금액은 짚지 않고 수만 말한다
      pointed = null;
      line = fill(T.play.missed, { n: missed.length });
    }
    draw();
    frame.persist();
    frame.say(line);
  }

  function press(key) {
    const { round } = frame;
    if (!round || round.done || isAll(round)) return;
    if (key === 'erase') round.typed = round.typed.slice(0, -1);
    else if (/^\d$/.test(key) && round.typed.length < TYPE_LIMIT && !(key === '0' && round.typed === '')) round.typed += key;
    else return;
    draw();
    frame.persist();
  }

  /** "열어 보기": 넣은 금액부터 모두 낼 수 있고 그 앞은 아니면 열린다. 다르면 넣은 금액에 대한 사실만 말하고 그대로 잠겨 있다 */
  function openLock() {
    const { round, solution } = frame;
    if (!round || round.done || isAll(round) || round.typed === '') return;
    const value = Number(round.typed);
    const { coins } = round.board;
    const correct = solution.possible && value === solution.from;
    let guess = null;
    let line = null;
    if (!solution.possible) {
      guess = 'endless-lock';
      line = fill(T.play['endless-lock'], { n: value, k: nextUnpayable(coins, value) });
    } else if (value > solution.from) {
      guess = 'earlier';
      line = T.play.earlier;
    } else if (value < solution.from) {
      guess = canPay(coins, value) ? 'later' : 'unpayable';
      line = fill(T.play[guess], { n: value });
    }
    round.typed = '';
    round.tryCount += 1;
    round.answers.push({ t: frame.stamp(), answer: `lock:${value}`, correct, guess });
    frame.note('answer', { answer: value, correct, guess });
    flash = null;
    pointed = null;
    if (correct) {
      frame.finish('solved');
      return;
    }
    round.wrongCount += 1;
    draw();
    frame.persist();
    frame.say(line);
  }

  /** "끝이 없어요". 끝이 있는 판이면 틀렸다고 하지 않고 끝이 있다는 사실만 말한다. 판은 그대로 이어진다 */
  function sayEndless() {
    const { round, solution } = frame;
    if (!round || round.done || !hasEnd(round)) return;
    const correct = solution.possible === false;
    const guess = correct ? null : 'endless-on-end';
    round.answers.push({ t: frame.stamp(), answer: 'endless', correct, guess });
    frame.note('answer', { answer: 'endless', correct, guess });
    flash = null;
    pointed = null;
    if (correct) {
      frame.finish('solved');
      return;
    }
    round.endCount += 1;
    round.wrongCount += 1;
    draw();
    frame.persist();
    frame.say(T.play['has-end']);
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    round.trail = round.trail.slice(0, -1);
    round.undoCount += 1;
    flash = null;
    pointed = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 모습에 한 말(칠한 금액, 고른 금액, 짚은 금액)은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  /** 처음으로: 담은 동전, 칠한 금액, 고른 금액을 모두 지운다. 무르기로는 돌아오지 않는다 */
  function reset() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    round.trail = [];
    round.resetCount += 1;
    flash = null;
    pointed = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  /** 도구: 작은 동전의 값만큼의 줄로 나눠 놓기. 처음 켤 때 힌트 하나로 센다 */
  function toggleRows() {
    const { round } = frame;
    if (!round) return;
    round.rowsOn = !round.rowsOn;
    if (round.rowsOn) {
      round.rowsShown = true;
      round.rowsCount += 1;
    }
    frame.note('rows', { on: round.rowsOn });
    draw();
    frame.keep();
  }

  // ---- 끝났을 때 하는 말: 한 일과 사실만 말한다 ----
  function rightLine(round, solution) {
    const parts = [];
    if (round.answers.at(-1)?.answer === 'endless') {
      parts.push(round.moveCount > 0 ? T.right['endless-tried'] : T.right['endless-untried']);
      parts.push(fill(T.right['endless-reason'], { f: solution.gcd }));
      return parts;
    }
    if (isAll(round)) {
      parts.push(fill(T.right.all, { k: solution.unpayable.length }));
      if (round.submitCount > 1) parts.push(fill(T.right['all-tries'], { f: round.submitCount }));
      parts.push(fill(T.right['all-from'], { n: solution.from }));
      return parts;
    }
    parts.push(fill(T.right.lock, { n: solution.from }));
    parts.push(solution.largest > 0 ? fill(T.right['lock-largest'], { k: solution.largest }) : T.right['lock-none']);
    if (round.tryCount > 1) parts.push(fill(T.right['lock-tries'], { f: round.tryCount }));
    if (round.endCount > 0) parts.push(T.right['after-end']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 끝이 있는 동전에서 잇달아 낸 금액(낼 수 없는 가장 큰 금액 바로 뒤로 작은 동전의 값만큼) */
  function runOf(coins, top) {
    const end = endOf(coins);
    if (end.gcd !== 1) return [];
    return Array.from({ length: coins[0] }, (_, index) => end.from + index).filter((amount) => amount <= top);
  }

  /** 풀이: 모두 찾기는 띠, 어디부터는 줄로 나눠 놓은 띠와 잇달아 낸 금액, 끝이 없는 판은 줄로 나눠 놓은 띠 */
  function solutionPages(round, solution) {
    const { coins, top } = round.board;
    const view = { coins, won: T.words.won, top, paid: solution.payable, marked: solution.unpayable };
    if (isAll(round)) {
      return [{ say: fill(T.solution.all, { k: solution.unpayable.length, n: solution.from }), nodes: [rowOf([stripCard(view, T.solution.strip, { big: true })])] }];
    }
    const rows = { ...view, rows: coins[0] };
    if (!solution.possible) {
      return [{ say: fill(T.solution.endless, { f: solution.gcd }), nodes: [rowOf([stripCard(rows, fill(T.solution.rows, { n: coins[0] }), { big: true })])] }];
    }
    if (solution.largest === 0) return [{ say: T.solution.none, nodes: [rowOf([stripCard(rows, fill(T.solution.rows, { n: coins[0] }), { big: true })])] }];
    const run = runOf(coins, top);
    return [{ say: fill(T.solution.from, { k: solution.largest, n: coins[0] }), nodes: [rowOf([stripCard({ ...rows, run }, T.solution.run, { big: true })])] }];
  }

  /** 표의 한 줄: 동전, 낼 수 없는 가장 큰 금액, 그 수(식의 칸을 붙이면 그 수 대신 큰 동전 × 작은 동전 − 큰 동전 − 작은 동전) */
  function tableRow([a, b], formula) {
    const end = endOf([a, b]);
    const cells = [faceOf([a, b]), String(end.largest)];
    cells.push(formula ? `${b}×${a}−${b}−${a}` : String(end.count));
    return cells;
  }

  /** "왜 그럴까?"의 그림 하나. 한 장뿐인 그림은 크게 그린다 */
  function figureOf(item, big) {
    if (item.table) {
      const heads = [T.table.coins, T.table.largest, item.formula ? T.table.formula : T.table.count];
      return tableCard(heads, item.table.map((pair) => tableRow(pair, item.formula === true)), item.note);
    }
    const { coins, top } = item;
    const unpayable = unpayableIn(coins, top);
    const paid = Array.from({ length: top }, (_, index) => index + 1).filter((amount) => !unpayable.includes(amount));
    return stripCard({ coins, won: T.words.won, top, rows: item.rows ? coins[0] : null, paid, marked: item.marks ? unpayable : [], run: item.run ?? [] }, item.note, { big });
  }

  /**
   * "왜 그럴까?": 3원과 5원으로 하나씩 해 보니 1, 2, 4, 7원만 안 된다 → 작은 동전의 값만큼 잇달아 되면 그 뒤는 모두 된다(줄로 나눠 놓기)
   * → 4원과 6원은 2원씩 묶여서 끝이 없다 → 6, 10, 15원은 둘씩은 모두 묶이는데 셋이면 끝이 있다 → 표 → 이름과 식(마지막 장에만).
   * 끝이 없는 판을 한 번 끝까지 만난 뒤에 열린다(틀의 기본 문).
   */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다
      get nodes() {
        return [rowOf(slide.figures.map((item) => figureOf(item, slide.figures.length === 1)))];
      },
    }));
  }

  // ---- 직접 만들기: 동전 가짓수(2~3)와 동전마다의 값(1~9원)을 정한다 ----
  const [LOW, HIGH] = MAKE_COINS;
  const sorted = (coins) => coins.slice().sort((a, b) => a - b);
  const draftOk = (coins) => Array.isArray(coins) && coins.length >= 2 && coins.length <= 3 && coins.every((value) => Number.isInteger(value) && value >= LOW && value <= HIGH) && new Set(coins).size === coins.length;

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    return { coins: saved && draftOk(saved.coins) ? saved.coins.slice() : MAKE_FIRST.slice() };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const { coins } = draft;
    $('nopay-make-n').textContent = fill(T.make.count, { n: coins.length });
    $('nopay-make-fewer').disabled = coins.length <= 2;
    $('nopay-make-more').disabled = coins.length >= 3;
    for (let at = 0; at < 3; at++) {
      const here = at < coins.length;
      $(`nopay-make-row${at}`).hidden = !here;
      if (!here) continue;
      $(`nopay-make-c${at}`).textContent = fill(T.make.coin, { n: coins[at] });
      $(`nopay-make-c${at}-less`).disabled = freeValue(coins, at, -1) === null;
      $(`nopay-make-c${at}-more`).disabled = freeValue(coins, at, 1) === null;
    }
    drawCoins($('nopay-make-board'), { coins: sorted(coins), won: T.words.won });
    $('nopay-make-result').textContent = made ? made.line : '';
    $('nopay-make-picture').replaceChildren(...(made?.node ? [made.node] : []));
  }

  /** at번 동전을 step쪽으로 바꿀 때 다른 동전과 겹치지 않는 가장 가까운 값. 없으면 null */
  function freeValue(coins, at, step) {
    for (let value = coins[at] + step; value >= LOW && value <= HIGH; value += step) if (!coins.includes(value)) return value;
    return null;
  }

  function changeDraft(coins) {
    // 선생님이 따진 뒤에 동전을 고치면, 앞의 동전에 한 말이 남지 않게 동전이 바뀌었다는 사실만 말한다
    const said = made !== null;
    draft = { coins };
    made = null;
    log.saveDraft({ coins: coins.slice() }, FORMAT);
    drawMake();
    if (said) frame.talkers.make.say(T.make.changed);
  }

  /** 동전 가짓수: 늘리면 겹치지 않는 가장 작은 값을 끝에 더하고, 줄이면 끝의 동전을 뺀다 */
  function resize(step) {
    const { coins } = draft;
    if (step > 0 && coins.length < 3) {
      let value = LOW + 1;
      while (coins.includes(value) && value < HIGH) value += 1;
      if (!coins.includes(value)) changeDraft([...coins, value]);
    } else if (step < 0 && coins.length > 2) changeDraft(coins.slice(0, -1));
  }

  function nudge(at, step) {
    const value = freeValue(draft.coins, at, step);
    if (value === null) return;
    changeDraft(draft.coins.map((item, index) => (index === at ? value : item)));
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판): 끝이 있을까와 같은 판 */
  function madeBoard() {
    if (!draft || !draftOk(draft.coins)) return null;
    return boardOfCoins(sorted(draft.coins));
  }

  /** "선생님, 풀어 보세요": 낼 수 없는 가장 큰 금액과 그 수, 또는 없다, 또는 끝이 없다 */
  function solveDraft() {
    const board = madeBoard();
    if (!board) {
      frame.talkers.make.say(T.make['keep-not-yet']);
      return;
    }
    const { coins, top } = board;
    const end = endOf(coins);
    let line;
    if (end.gcd > 1) line = fill(T.make.endless, { f: end.gcd });
    else if (end.largest === 0) line = T.make.none;
    else line = fill(T.make.largest, { k: end.largest, n: end.count });
    const unpayable = unpayableIn(coins, top);
    const paid = Array.from({ length: top }, (_, index) => index + 1).filter((amount) => !unpayable.includes(amount));
    made = { line, node: stripCard({ coins, won: T.words.won, top, paid, marked: unpayable }, T.make.picture) };
    drawMake();
    const now = new Date().toISOString();
    log.saveRecord({ kind: 'made', v: 1, id: log.newId('m'), format: FORMAT, startedAt: now, endedAt: now, board, solution: { possible: end.gcd === 1, gcd: end.gcd, largest: end.largest, from: end.from, count: end.count } });
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
  $('nopay-pay').addEventListener('click', pay);
  $('nopay-submit').addEventListener('click', submit);
  $('nopay-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.n;
    if (key) press(key);
  });
  $('nopay-open').addEventListener('click', openLock);
  $('nopay-endless').addEventListener('click', sayEndless);
  $('nopay-rows').addEventListener('click', toggleRows);
  $('nopay-make-fewer').addEventListener('click', () => resize(-1));
  $('nopay-make-more').addEventListener('click', () => resize(1));
  for (let at = 0; at < 3; at++) {
    $(`nopay-make-c${at}-less`).addEventListener('click', () => nudge(at, -1));
    $(`nopay-make-c${at}-more`).addEventListener('click', () => nudge(at, 1));
  }
  $('nopay-make-solve').addEventListener('click', solveDraft);
  $('nopay-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    flash = null;
    pointed = null;
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: copyBoard(board), // 판: 종류, 동전, 띠 끝(src/core/nopay.js)
      trail: [], // 처음 모습에서 지금까지 한 일: 'c0'(동전 담기), 'x0'(빼기), 'p'(칠하기), 'm12'(고르기), 'w12'(칠한 금액의 동전 다시 담기)
      typed: '', // 자물쇠에 넣는 중인 수
      moveCount: 0, // 동전을 담고 빼고 다시 담은 수
      payCount: 0, // 띠에 칠한 수
      unmarkCount: 0, // 그 가운데 못 낸다고 골라 둔 금액을 칠한 수
      markCount: 0, // 띠에서 고르거나 그만둔 수
      undoCount: 0,
      resetCount: 0,
      submitCount: 0, // "다 골랐어요"를 누른 수
      tryCount: 0, // 자물쇠에 수를 넣어 본 수
      endCount: 0, // 끝이 있는 판에 "끝이 없어요"를 누른 수
      wrongCount: 0, // 사실과 다른 답의 수(맞지 않게 고른 띠, 열리지 않은 자물쇠, 끝이 있는 판의 "끝이 없어요")
      rowsOn: false, // 지금 "줄 맞추기"를 켜 두었는가
      rowsShown: false, // 한 번이라도 켰는가
      rowsCount: 0, // 켠 수
    };
  }

  /** 적어 둔 판의 단계가 판의 종류와 맞는가 */
  function levelOk(saved) {
    const { board } = saved;
    if (saved.custom === true) return saved.level === MAKE_LEVEL && saved.mode === 'made' && board.kind === 'end';
    if (!Number.isInteger(saved.level) || saved.level < LADDER[0].level || saved.level > TOP_LEVEL) return false;
    const mode = rungOf(saved.level).mode;
    return mode === saved.mode && board.kind === kindOf(mode);
  }

  function validSaved(saved) {
    if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null || !levelOk(saved)) return false;
    if (!replay(saved.board, saved.trail).ok) return false;
    if (typeof saved.typed !== 'string' || !/^([1-9]\d?)?$/.test(saved.typed)) return false;
    if (![saved.rowsOn, saved.rowsShown].every((value) => typeof value === 'boolean')) return false;
    return [saved.moveCount, saved.payCount, saved.unmarkCount, saved.markCount, saved.undoCount, saved.resetCount, saved.submitCount, saved.tryCount, saved.endCount, saved.wrongCount, saved.rowsCount].every(count);
  }

  /** 작은 그림: 동전과 띠(칠한 금액, 고른 금액) */
  function drawPicture(root, board, state = null) {
    drawSmall(root, { coins: board.coins, top: board.top, paid: state ? paidOf(state) : [], marked: state ? state.marks : [] });
  }

  return {
    id: FORMAT,
    T,
    padId: 'nopay-pad',
    makeId: 'make-nopay',
    // 동전, 담은 동전, 띠가 위아래로 놓여 판이 길다. 규칙 글은 왼쪽 칸 맨 위에 둔다
    ruleAside: true,
    homeIds: { sample: 'home-nopay-sample', blank: 'home-nopay-blank', ask: 'home-nopay-ask', play: 'home-nopay-play', pick: 'home-nopay-pick', make: 'home-nopay-make' },
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
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('nopay-board').hidden = !on;
      $('nopay-count').hidden = !on;
      $('nopay-rows').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      flash = null;
      pointed = null;
    },
    draw,
    ended() {
      flash = null;
      pointed = null;
    },
    ruleLine: (round) => fill(T.rules[isAll(round) ? 'all' : 'from'], { face: faceOf(round.board.coins) }),
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.trail.length > 0 || round.moveCount > 0 || round.markCount > 0 || round.tryCount > 0 || round.rowsCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const state = stateOf(round);
      return { tray: state.tray.slice(), sum: state.sum, paid: paidOf(state), marks: state.marks, typed: round.typed, rowsOn: round.rowsOn };
    },
    /** 이 판보다 작은 판: 동전 값이 더 작은 같은 종류의 판(끝이 없는 판은 끝이 있는 판과 번갈아) */
    smaller: (round, turn) => smallerNopay({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const state = stateOf(round);
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, gcd: solution.gcd, largest: solution.largest, from: solution.from, count: solution.count, unpayable: solution.unpayable },
        // 질문 힌트와 "줄 맞추기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.rowsShown ? 1 : 0),
        rowsShown: round.rowsShown,
        rowsCount: round.rowsCount,
        // 판을 떠날 때의 모습: 한 일, 담은 동전, 칠한 금액, 고른 금액
        trail: round.trail,
        tray: state.tray,
        paid: paidOf(state),
        marks: state.marks,
        moveCount: round.moveCount,
        payCount: round.payCount,
        unmarkCount: round.unmarkCount,
        markCount: round.markCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        submitCount: round.submitCount,
        tryCount: round.tryCount,
        endCount: round.endCount,
        // 수준 맞추기가 보는 "틀린 답"의 수
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    /** 글자판이 있는 기기: 자물쇠의 숫자와 지우기, 들이기. 동전과 띠의 칸은 단추라서 저마다 Enter와 빈칸 글쇠로 누른다 */
    onKey(event) {
      const { round } = frame;
      if (!round || $('nopay-pad').hidden || round.done || isAll(round)) return;
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') press('erase');
      else if (event.key === 'Enter' && !event.target.closest?.('button')) openLock();
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawPicture(root, board);
    },
    drawBlank(root) {
      drawSmall(root, { coins: MAKE_FIRST, top: 12, paid: [], marked: [] });
    },
    /** 하던 판과 공책의 그림: 칠한 금액과 고른 금액 */
    drawResume(root, saved) {
      const state = replay(saved.board, saved.trail ?? []);
      drawPicture(root, saved.board, state.ok ? state : null);
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawSmall(root, { coins: MAKE_FIRST, top: 12, paid: [], marked: [] });
        return;
      }
      drawPicture(root, generateBoard(entry.level, entry.picture.seed).board);
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
