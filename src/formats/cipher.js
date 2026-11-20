// 암호 놀이: 판 화면에서 이 형식이 맡는 부분(판, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기(암호 편지).
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/cipher.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 글자 바퀴가 이 형식의 도구다. 안쪽 고리(암호 글자)를 끌거나 ＋, − 단추로 돌리는 것이 아이가 하는 일이다.
// 판의 종류(mode)
//   decode   미는 암호 풀기(1단계). 열쇠를 알려 준다. 풀 글자를 고르고 바퀴 바깥쪽의 원래 글자를 누른다. 숫자 판(자물쇠 번호)도 섞인다
//   findkey  열쇠 찾기(2단계). 바퀴를 돌리면 그만큼 거꾸로 밀어 읽은 글이 보인다. 읽히면 "이 열쇠예요"를 누른다
//   table    글자를 수로(3단계). 암호가 글자표의 수로 적혀 있다(자음의 수에 열쇠만큼 더한 표도 있다). 풀기는 decode와 같다
//   sum      달아난 숫자(4단계). 세로셈의 가린 자리(네모)를 누르고 숫자판으로 채운다. 다 채우면 셈이 맞는지 본다
//   freq     자주 나오는 글자(5단계). 자음과 모음을 함께 민 긴 편지. 두 바퀴를 돌려 읽히면 "이 열쇠예요"를 누른다. "글자 세어 보기"가 도구다
//   made     직접 만든 암호 편지. 풀기는 decode와 같다
// 틀렸다고 하지 않는다. 다른 글자를 누르면 그 글자를 열쇠만큼 밀면 무엇이 되는지, 다른 열쇠에서 "이 열쇠예요"를 누르면 바퀴를 놓는 방법이 몇 가지이고
// 지금까지 몇 가지를 읽어 봤는지, 다 채운 셈이 맞지 않으면 채운 대로 계산한 값만 말한다.
import T from '../content/cipher.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, makeLadder, rungOf } from '../core/cipher-ladder.js';
import {
  LETTERS,
  MAX_TEXT,
  RING_SIZE,
  checkBoard,
  checkText,
  cipherOf,
  composeTokens,
  copyBoard,
  fillRows,
  frequencyGuess,
  keyCount,
  keysOf,
  letterCounts,
  parseSymbol,
  plainOf,
  pushed,
  readWith,
  ringsToSolve,
  solve,
  sumHolds,
  sumOf,
  symbolsOf,
  tableNumber,
  turnRings,
  turnsMatch,
} from '../core/cipher.js';
import { smallerCipher } from '../core/smaller.js';
import { endsClosed, fill } from '../core/text.js';
import { cipherCard, countBars, drawCipher, messageNode, sumNode, wheelNode } from '../ui/cipher-board.js';

const FORMAT = 'cipher';
const MODES = ['decode', 'findkey', 'table', 'sum', 'freq', 'made'];
const TAP_MODES = ['decode', 'table', 'made'];
const FIND_MODES = ['findkey', 'freq'];
/** 기록에 남기는 무르기 차례와 읽어 본 모습의 수의 위 끝 */
const MAX_HISTORY = 200;
const MAX_TRIED = 140;
/** 직접 만들기의 글자판으로 누를 수 있는 것의 수의 위 끝 */
const MAX_TOKENS = 60;
/** 작은 그림에 쓰는 글자 수의 위 끝 */
const SMALL_LETTERS = 8;
const ladder = makeLadder(T.messages);
const mod = (value, n) => ((value % n) + n) % n;

/** 직접 만들기의 처음 판: 빈 편지, 자음 열쇠 3칸 */
const firstDraft = () => ({ tokens: [], keys: { c: 3, v: 0 } });

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createCipher(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄과 판의 표시({ line, refused }). 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 쓰던 편지
  let made = null; // 직접 만들기에서 선생님이 따진 것(편지를 고치면 지운다)

  const count = (value) => Number.isInteger(value) && value >= 0;
  const keyOf = (round) => {
    if (round.mode === 'decode' && round.board.kind === 'digits') return 'digits';
    if (round.mode === 'table') return keysOf(round.board).c === 0 ? 'table' : 'added';
    if (round.mode === 'sum') return round.board.op === 'add' ? 'sum-add' : 'sum-sub';
    return round.mode;
  };
  const isTap = (round) => TAP_MODES.includes(round.mode);
  const isFind = (round) => FIND_MODES.includes(round.mode);
  const numbersOf = (round) => round.board.show === 'numbers';

  /** 아직 못 푼 풀 글자들 */
  const leftOf = (round) => symbolsOf(round.board).filter((id) => round.found[id] === undefined);
  const selectedOf = (round) => (round.selected && round.found[round.selected] === undefined && symbolsOf(round.board).includes(round.selected) ? round.selected : (leftOf(round)[0] ?? null));

  /** 바퀴들: 판의 종류마다 */
  function wheelRings(round) {
    const { board } = round;
    if (board.kind === 'sum') return [];
    if (board.kind === 'digits') return ['d'];
    if (round.mode === 'table') return ['c', 'v'];
    if (isFind(round)) return round.mode === 'freq' ? ['c', 'v'] : ['c'];
    const rings = ringsToSolve(board);
    return rings.length > 0 ? rings : ['c'];
  }

  /** 지금 바퀴대로 읽은 글 */
  const readingOf = (round) => readWith(cipherOf(round.board), round.turns);
  const settingOf = (round) => `${round.turns.c}:${round.turns.v}:${round.turns.d}`;

  // ---- 판 ----
  function keyLineOf(round) {
    const { board } = round;
    const keys = keysOf(board);
    if (board.kind === 'sum') return '';
    if (board.kind === 'digits') return fill(T.keyLine.digits, { k: keys.d });
    if (round.mode === 'table') return keys.c === 0 ? T.keyLine.table : `${T.keyLine.table} · ${fill(T.keyLine.added, { k: keys.c })}`;
    if (isFind(round)) return fill(T.keyLine[round.mode], { total: keyCount(turnRings(board)) });
    if (keys.c !== 0 && keys.v !== 0) return fill(T.keyLine['decode-both'], { k: keys.c, n: keys.v });
    if (keys.c === 0) return fill(T.keyLine['decode-vowel'], { n: keys.v });
    return fill(T.keyLine.decode, { k: keys.c });
  }

  /** 판의 모습(그리는 값). live면 누를 수 있다 */
  function viewOf(round, live) {
    const { board } = round;
    const view = { words: T.words, labels: T.labels, keyLine: keyLineOf(round) };
    if (board.kind === 'sum') {
      view.sum = { rows: board.rows, op: board.op, hidden: board.hidden, entries: round.entries, selected: live ? round.box : null, onBox: live ? pickBox : undefined };
      return view;
    }
    const cipher = cipherOf(board);
    const selected = live && isTap(round) ? selectedOf(round) : null;
    const solveRings = ringsToSolve(board);
    view.message = {
      cipher,
      numbers: numbersOf(round),
      selected,
      reading: isFind(round) ? readingOf(round) : null,
      plainOf: (ring, index) => {
        const id = `${ring}${index}`;
        if (!solveRings.includes(ring)) return index;
        return round.found[id] ?? null;
      },
    };
    if (isTap(round)) view.chips = { symbols: symbolsOf(board), found: round.found, selected, numbers: numbersOf(round), onSelect: live ? selectSymbol : undefined };
    const counts = round.mode === 'freq' && live && round.countsOn ? letterCounts(cipher) : null;
    view.wheels = wheelRings(round).map((ring) => ({
      ring,
      turn: round.turns[ring] ?? 0,
      numbers: numbersOf(round),
      counts: counts ? counts[ring] : null,
      refused: live && flash?.refused?.ring === ring ? flash.refused.index : null,
      onPick: live && isTap(round) ? pickLetter : undefined,
      onTurn: live ? turnWheel : undefined,
    }));
    return view;
  }

  function draw() {
    const { round } = frame;
    const playing = !round.done;
    drawCipher($('cipher-board'), viewOf(round, playing));
    $('cipher-status').textContent = flash?.line ?? statusOf(round, playing);
    $('cipher-tap-box').hidden = !isTap(round);
    $('cipher-find-box').hidden = !isFind(round);
    $('cipher-sum-box').hidden = round.mode !== 'sum';
    $('cipher-this').disabled = !playing;
    for (const key of $('cipher-keys').querySelectorAll('button')) key.disabled = !playing;
    const edits = isTap(round) || round.mode === 'sum';
    $('undo').hidden = !edits;
    $('reset').hidden = !edits;
    $('undo').disabled = !playing || round.history.length === 0;
    $('reset').disabled = !playing || (round.mode === 'sum' ? round.entries.every((value) => value === null) : Object.keys(round.found).length === 0);
    // 글자 세기는 자주 나오는 글자의 판에서만 쓴다. 끝난 판에서는 꺼져 있다
    const looking = playing && round.countsOn;
    $('cipher-counts').hidden = round.mode !== 'freq';
    $('cipher-counts').textContent = T.tool[looking ? 'on' : 'off'];
    $('cipher-counts').setAttribute('aria-pressed', String(looking));
    $('cipher-counts').disabled = round.done;
    frame.showWhy();
  }

  function statusOf(round, playing) {
    if (!playing) return '';
    if (round.mode === 'sum') {
      const left = round.entries.filter((value) => value === null).length;
      if (left === round.entries.length) return T.status.box;
      return left === 0 ? T.status.filled : fill(T.status.boxes, { n: left });
    }
    if (isFind(round)) return round.tried.length > 1 ? fill(T.status.tried, { total: keyCount(turnRings(round.board)), n: round.tried.length }) : T.status.read;
    const left = leftOf(round).length;
    const digits = round.board.kind === 'digits' ? '-d' : '';
    if (Object.keys(round.found).length === 0) return T.status[`begin${digits}`];
    return fill(T.status[`left${digits}`], { n: left });
  }

  /** 무르기에 쓰는 지금 모습 */
  const snapshot = (round) => ({ found: { ...round.found }, entries: round.entries.slice(), selected: round.selected, box: round.box });
  function remember(round) {
    round.history = [...round.history, snapshot(round)].slice(-MAX_HISTORY);
  }

  /** 풀 글자를 골랐다 */
  function selectSymbol(id) {
    const { round } = frame;
    if (!round || round.done || !isTap(round) || round.found[id] !== undefined) return;
    round.selected = id;
    flash = null;
    frame.note('select', { symbol: id });
    draw();
    frame.persist();
  }

  /** 바퀴 바깥쪽 글자를 눌렀다: 고른 풀 글자의 원래 글자로 넣어 본다 */
  function pickLetter(ring, index) {
    const { round } = frame;
    if (!round || round.done || !isTap(round)) return;
    const id = selectedOf(round);
    if (!id) return;
    const symbol = parseSymbol(id);
    flash = null;
    if (symbol.ring !== ring) {
      // 다른 바퀴를 눌렀다: 고른 글자가 어느 바퀴에 있는지만 말한다
      frame.note('other-wheel', { symbol: id, ring, index });
      flash = { line: fill(T.status['other-wheel'], { f: T.labels.wheel[symbol.ring] }) };
      draw();
      frame.say(fill(T.play['other-wheel'], { f: T.labels.wheel[symbol.ring] }));
      return;
    }
    round.pickCount += 1;
    const { board } = round;
    const n = RING_SIZE[ring];
    const key = keysOf(board)[ring];
    const right = plainOf(board, id) === index;
    frame.note('pick', { symbol: id, index, right });
    if (!right) {
      round.wrongCount += 1;
      flash = { line: wrongLine(round, ring, index, T.status), refused: { ring, index } };
      draw();
      frame.persist();
      frame.say(wrongLine(round, ring, index, T.play));
      return;
    }
    remember(round);
    round.found = { ...round.found, [id]: index };
    round.selected = leftOf(round)[0] ?? null;
    let said = null;
    // ㅎ(9, ㅣ)을 지나 처음으로 돌아가는 글자를 처음 풀었을 때 한 번 그 사실을 말한다
    if (key !== 0 && index + key >= n && !round.wrapSaid.includes(ring) && round.mode !== 'table') {
      round.wrapSaid = [...round.wrapSaid, ring];
      said = fill(T.play[`wrap-${ring}`], { f: LETTERS[ring][index], k: key, face: LETTERS[ring][(index + key) % n] });
    }
    if (leftOf(round).length === 0) {
      round.answers.push({ t: frame.stamp(), answer: 'decoded', correct: true, guess: null });
      frame.finish('solved');
      return;
    }
    draw();
    frame.persist();
    if (said) frame.say(said);
  }

  /** 다른 글자를 눌렀을 때의 말: 그 글자를 열쇠만큼 밀면 무엇이 되는지(글자표 판은 그 글자의 수). lines는 선생님의 말(T.play)이나 판 아래 한 줄(T.status) */
  function wrongLine(round, ring, index, lines) {
    const { board } = round;
    const key = keysOf(board)[ring];
    const n = RING_SIZE[ring];
    if (round.mode === 'table') {
      if (ring === 'v' || key === 0) return fill(lines.table, { f: LETTERS[ring][index], n: tableNumber(ring, index) });
      const wrapped = index + 1 + key > n;
      const name = wrapped && lines['added-wrap'] ? 'added-wrap' : 'added';
      return fill(lines[name], { f: LETTERS[ring][index], n: tableNumber(ring, index), k: key, total: tableNumber(ring, pushed(board, ring, index)) });
    }
    if (ring === 'd') return fill(lines['wrong-d'], { f: LETTERS.d[index], k: key, face: LETTERS.d[pushed(board, 'd', index)] });
    return fill(lines.wrong, { f: LETTERS[ring][index], k: key, face: LETTERS[ring][mod(index + key, n)] });
  }

  /** 바퀴를 돌렸다 */
  function turnWheel(ring, delta) {
    const { round } = frame;
    if (!round || round.done || !Number.isInteger(delta) || delta === 0) return;
    const n = RING_SIZE[ring];
    const before = round.turns[ring] ?? 0;
    const raw = before + delta;
    // 끝 칸을 지나 처음으로 돌아왔다(한 바퀴를 다 돌렸다). 거꾸로 0칸을 지날 때는 말하지 않는다
    const lap = raw >= n;
    round.turns = { ...round.turns, [ring]: mod(raw, n) };
    round.turnCount += 1;
    flash = null;
    frame.note('turn', { ring, turn: round.turns[ring] });
    if (isFind(round)) {
      const setting = settingOf(round);
      if (!round.tried.includes(setting)) round.tried = [...round.tried, setting].slice(-MAX_TRIED);
    }
    let said = null;
    if (lap) {
      flash = { line: T.status.lap };
      if (!round.lapSaid) {
        round.lapSaid = true;
        said = T.play[n === 14 ? 'lap' : 'lap-ten'];
      }
    }
    draw();
    frame.persist();
    if (said) frame.say(said);
  }

  /** "이 열쇠예요" */
  function pressThis() {
    const { round } = frame;
    if (!round || round.done || !isFind(round)) return;
    round.pressCount += 1;
    const correct = turnsMatch(round.board, round.turns);
    const answer = `turn:${settingOf(round)}`;
    const guess = correct ? null : 'other-key';
    round.answers.push({ t: frame.stamp(), answer, correct, guess });
    frame.note('answer', { answer, correct, guess });
    if (correct) {
      frame.finish('solved');
      return;
    }
    // 다른 열쇠다. 틀렸다고 하지 않고 바퀴를 놓는 방법의 수와 읽어 본 수만 말한다
    round.wrongCount += 1;
    flash = null;
    draw();
    frame.persist();
    frame.say(fill(T.play.tried, { total: keyCount(turnRings(round.board)), n: round.tried.length }));
  }

  // ---- 달아난 숫자 ----
  function pickBox(spot) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'sum') return;
    round.box = spot;
    flash = null;
    draw();
    frame.persist();
  }

  /** 숫자판을 눌렀다: 고른 네모에 숫자를 넣거나 지운다 */
  function pressDigit(key) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'sum') return;
    const spot = round.box;
    flash = null;
    remember(round);
    const entries = round.entries.slice();
    if (key === 'erase') {
      if (entries[spot] === null) {
        round.history = round.history.slice(0, -1);
        return;
      }
      entries[spot] = null;
      round.entries = entries;
      frame.note('erase', { box: spot });
      draw();
      frame.persist();
      return;
    }
    entries[spot] = Number(key);
    round.entries = entries;
    round.entryCount += 1;
    frame.note('digit', { box: spot, digit: Number(key) });
    // 다음 빈 네모로 옮긴다(없으면 그대로)
    const next = entries.findIndex((value, index) => value === null && index > spot);
    const first = entries.findIndex((value) => value === null);
    round.box = next >= 0 ? next : first >= 0 ? first : spot;
    if (first < 0) {
      checkSum(round);
      return;
    }
    draw();
    frame.persist();
  }

  /** 네모를 다 채웠다: 셈이 맞으면 끝난다. 맞지 않으면 채운 대로 계산한 값만 말한다 */
  function checkSum(round) {
    const { board } = round;
    const rows = fillRows(board.rows, board.hidden, round.entries).map((row) => row.join(''));
    const correct = sumHolds(board.op, rows);
    const answer = `digits:${round.entries.join('')}`;
    const guess = correct ? null : 'wrong-sum';
    round.answers.push({ t: frame.stamp(), answer, correct, guess });
    frame.note('answer', { answer, correct, guess });
    if (correct) {
      frame.finish('solved');
      return;
    }
    round.checkCount += 1;
    round.wrongCount += 1;
    let name = 'lead';
    let value = 0;
    if (!rows.some((row) => row.length > 1 && row[0] === '0')) {
      value = sumOf(board.op, Number(rows[0]), Number(rows[1]));
      name = `${board.op === 'add' ? 'sum-add' : 'sum-sub'}${endsClosed(value) ? '' : '-open'}`;
    }
    flash = { line: fill(T.status[name], { n: value }) };
    draw();
    frame.persist();
    frame.say(fill(T.play[name], { n: value }));
  }

  /** 한 번 무르기 */
  function undo() {
    const { round } = frame;
    if (round.done || round.history.length === 0) return;
    const last = round.history.at(-1);
    round.history = round.history.slice(0, -1);
    round.found = last.found;
    round.entries = last.entries;
    round.selected = last.selected;
    round.box = last.box;
    round.undoCount += 1;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
  }

  /** 처음으로: 푼 글자(채운 숫자)를 모두 지운다. 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (round.done) return;
    remember(round);
    round.found = {};
    round.entries = round.entries.map(() => null);
    round.selected = null;
    round.box = 0;
    round.resetCount += 1;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
  }

  /** "글자 세어 보기": 바퀴 안쪽 글자마다 암호에 나온 수를 적는다 */
  function toggleCounts() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'freq') return;
    round.countsOn = !round.countsOn;
    if (round.countsOn) {
      round.countsShown = true;
      round.countsCount += 1;
    }
    frame.note('counts', { on: round.countsOn });
    draw();
    frame.keep();
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round) {
    const { board } = round;
    const keys = keysOf(board);
    if (round.mode === 'sum') return [T.right.sum, round.checkCount === 0 ? T.right['sum-clean'] : fill(T.right['sum-tries'], { n: round.checkCount })];
    if (isFind(round)) {
      const tried = fill(T.right.tried, { total: keyCount(turnRings(board)), n: round.tried.length });
      return [round.mode === 'freq' ? fill(T.right.keys, { k: keys.c, n: keys.v }) : fill(T.right.key, { k: keys.c }), tried];
    }
    const first = board.kind === 'digits' ? T.right.digits : round.mode === 'table' ? T.right.table : T.right.decode;
    const digits = board.kind === 'digits' ? '-d' : '';
    return [first, round.wrongCount === 0 ? T.right[`clean${digits}`] : fill(T.right[`tries${digits}`], { n: round.wrongCount })];
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 다 푼 글과 열쇠만큼 돌린 바퀴 */
  function answerCards(round) {
    const { board } = round;
    const keys = keysOf(board);
    const message = messageNode({ cipher: cipherOf(board), numbers: board.show === 'numbers', plainOf: (ring, index) => plainOf(board, `${ring}${index}`), words: T.words });
    const rings = board.kind === 'digits' ? ['d'] : board.show === 'numbers' ? ['c'] : turnRings(board);
    const wheels = rings.map((ring) => cipherCard(wheelNode({ ring, turn: keys[ring], numbers: board.show === 'numbers', words: T.words, labels: T.labels, small: true }), T.solution.note));
    return [rowOf([cipherCard(message, '')]), rowOf(wheels)];
  }

  function solutionPages(round, solution) {
    const { board } = round;
    if (board.kind === 'sum') {
      return [{ say: T.solution.sum, nodes: [rowOf([cipherCard(sumNode({ rows: board.rows, op: board.op, hidden: board.hidden, answer: solution.answer, words: T.words, labels: T.labels }), '')])] }];
    }
    const keys = keysOf(board);
    let say;
    if (board.kind === 'digits') say = fill(T.solution.digits, { k: keys.d });
    else if (board.show === 'numbers') say = keys.c === 0 ? T.solution.table : fill(T.solution.added, { k: keys.c });
    else if (keys.c !== 0 && keys.v !== 0) say = fill(T.solution.both, { k: keys.c, n: keys.v });
    else if (keys.c === 0) say = fill(T.solution.vowel, { n: keys.v });
    else say = fill(T.solution.text, { k: keys.c });
    return [{ say, nodes: answerCards(round) }];
  }

  /** "왜 그럴까?": 바퀴는 끝이 처음과 이어진다 → 14칸 돌리면 처음과 같다(나머지) → 열쇠는 14가지 → 모음도 밀면 140가지, 자주 나오는 글자 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [
          rowOf(
            slide.figures.map((item) => {
              if (item.counts) return cipherCard(countBars(letterCounts(T.messages[item.counts][0]).c), item.note);
              return cipherCard(wheelNode({ ring: item.ring, turn: item.turn, arrow: item.arrow ?? null, words: T.words, labels: T.labels, small: true }), item.note);
            }),
          ),
        ];
      },
    }));
  }

  // ---- 직접 만들기: 암호 편지 ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const ok =
      saved &&
      Array.isArray(saved.tokens) &&
      saved.tokens.length <= MAX_TOKENS &&
      saved.tokens.every((token) => token === ' ' || parseSymbol(token)?.ring === 'c' || parseSymbol(token)?.ring === 'v') &&
      Number.isInteger(saved.keys?.c) &&
      Number.isInteger(saved.keys?.v) &&
      saved.keys.c >= 0 &&
      saved.keys.c < 14 &&
      saved.keys.v >= 0 &&
      saved.keys.v < 10;
    return ok ? { tokens: saved.tokens.slice(), keys: { c: saved.keys.c, v: saved.keys.v } } : firstDraft();
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  /** 쓴 글(혼자 남은 자모가 있을 수 있다) */
  const draftText = () => composeTokens(draft.tokens);

  function drawMake() {
    $('cipher-make-c').textContent = fill(T.make.size, { n: draft.keys.c });
    $('cipher-make-v').textContent = fill(T.make.size, { n: draft.keys.v });
    $('cipher-make-c-fewer').disabled = draft.keys.c <= 0;
    $('cipher-make-c-more').disabled = draft.keys.c >= 13;
    $('cipher-make-v-fewer').disabled = draft.keys.v <= 0;
    $('cipher-make-v-more').disabled = draft.keys.v >= 9;
    const { text } = draftText();
    const root = $('cipher-make-board');
    const lines = document.createElement('div');
    lines.className = 'cp-make-lines';
    const add = (label, node) => {
      const row = document.createElement('div');
      row.className = 'cp-make-line';
      const name = document.createElement('span');
      name.className = 'cp-make-name';
      name.textContent = label;
      row.append(name, node);
      lines.append(row);
    };
    const plainNode = document.createElement('p');
    plainNode.className = 'cp-make-text';
    plainNode.textContent = text;
    add(T.words.plain, plainNode);
    const cipherNode = document.createElement('p');
    cipherNode.className = 'cp-make-text cipher';
    cipherNode.textContent = text ? readWith(text, { c: -draft.keys.c, v: -draft.keys.v }) : '';
    add(T.words.cipher, cipherNode);
    // 글자표의 수: 쓴 글을 수로 바꾼 것(혼자 남은 자모도 수로)
    const numbers = document.createElement('p');
    numbers.className = 'cp-make-text numbers';
    numbers.textContent = draft.tokens.map((token) => (token === ' ' ? '/' : String(tableNumber(token[0], Number(token.slice(1)))))).join(' ');
    add(T.words.numbers, numbers);
    root.replaceChildren(lines);
    $('cipher-make-result').textContent = made ? made.line : '';
    $('cipher-make-picture').replaceChildren(...(made?.card ? [made.card] : []));
    for (const key of $('cipher-make-keys').querySelectorAll('button')) {
      if (key.dataset.token === 'erase') key.disabled = draft.tokens.length === 0;
    }
  }

  function changeDraft(next) {
    draft = next;
    made = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 글자판을 눌렀다 */
  function pressToken(token) {
    if (!draft) return;
    const tokens = draft.tokens.slice();
    if (token === 'erase') tokens.pop();
    else if (token === ' ') {
      // 맨 앞이나 띄어쓰기 바로 뒤에는 띄어 쓰지 않는다
      if (tokens.length === 0 || tokens.at(-1) === ' ') return;
      tokens.push(' ');
    } else {
      if (!parseSymbol(token)) return;
      const longer = composeTokens([...tokens, token]).text;
      if (tokens.length >= MAX_TOKENS || [...longer].length > MAX_TEXT) {
        frame.talkers.make.say(fill(T.make.long, { n: MAX_TEXT }));
        return;
      }
      tokens.push(token);
    }
    changeDraft({ ...draft, tokens });
  }

  function changeKey(ring, delta) {
    const n = ring === 'c' ? 14 : 10;
    const value = draft.keys[ring] + delta;
    if (value < 0 || value >= n) return;
    changeDraft({ ...draft, keys: { ...draft.keys, [ring]: value } });
  }

  /** 다 쓴 편지(공책에 남기거나 풀어 볼 판). 아직 아니면 null */
  function madeBoard() {
    if (!draft) return null;
    const { text, whole } = draftText();
    const plain = text.trim();
    if (!whole || plain.length === 0 || checkText(plain) !== null) return null;
    const board = { kind: 'text', plain, keys: { c: draft.keys.c, v: draft.keys.v } };
    return checkBoard(board) === null ? copyBoard(board) : null;
  }

  /** 아직 편지가 아닌 까닭(쓴 글이 없다, 혼자 남은 자모가 있다, 열쇠가 모두 0칸이다) */
  function notYetLine() {
    const { text, whole } = draftText();
    if (text.trim().length === 0) return T.make.empty;
    if (!whole) return T.make.lone;
    if (draft.keys.c === 0 && draft.keys.v === 0) return T.make.nokey;
    return T.make['keep-not-yet'];
  }

  /** 선생님이 아이의 암호 편지를 따진다: 바퀴를 놓는 방법의 수, 가장 많이 나온 자음과 그것으로 열쇠를 찾을 수 있는지 */
  function solveDraft() {
    const board = madeBoard();
    if (!board) {
      made = null;
      drawMake();
      frame.talkers.make.say(notYetLine());
      return;
    }
    const cipher = cipherOf(board);
    const rings = turnRings(board);
    const name = rings.length === 2 ? 'count-cv' : rings[0] === 'c' ? 'count-c' : 'count-v';
    const parts = [fill(T.make[name], { total: keyCount(rings) })];
    const guess = frequencyGuess(cipher);
    if (board.keys.c === 0) parts.push(T.make['top-none']);
    else if (guess.key === null) parts.push(T.make['top-tie']);
    else {
      parts.push(fill(T.make.top, { f: LETTERS.c[guess.top[0]], n: guess.count }));
      parts.push(guess.key === board.keys.c ? T.make['top-right'] : T.make['top-wrong']);
    }
    const line = parts.join(' ');
    made = { line, card: cipherCard(countBars(letterCounts(cipher).c), '') };
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
      solution: { keyCount: keyCount(rings), top: guess.top, frequencyKey: guess.key },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  function playDraft() {
    const board = madeBoard();
    if (!board) {
      frame.talkers.make.say(notYetLine());
      return;
    }
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('cipher-this').addEventListener('click', pressThis);
  $('cipher-counts').addEventListener('click', toggleCounts);
  $('cipher-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.n;
    if (key !== undefined) pressDigit(key);
  });
  $('cipher-make-keys').addEventListener('click', (event) => {
    const token = event.target.closest('button')?.dataset.token;
    if (token === undefined) return;
    pressToken(token === 'space' ? ' ' : token);
  });
  $('cipher-make-c-fewer').addEventListener('click', () => changeKey('c', -1));
  $('cipher-make-c-more').addEventListener('click', () => changeKey('c', 1));
  $('cipher-make-v-fewer').addEventListener('click', () => changeKey('v', -1));
  $('cipher-make-v-more').addEventListener('click', () => changeKey('v', 1));
  $('cipher-make-clear').addEventListener('click', () => changeDraft({ ...draft, tokens: [] }));
  $('cipher-make-solve').addEventListener('click', solveDraft);
  $('cipher-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    const start = copyBoard(board);
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: start, // 판: 종류, 원래 글(또는 세로셈), 열쇠
      turns: { c: 0, v: 0, d: 0 }, // 바퀴마다 돌린 칸 수
      found: {}, // 푼 글자: 암호 글자의 이름 → 원래 글자(바퀴의 칸)
      selected: null, // 고른 풀 글자(없으면 아직 못 푼 첫 글자)
      entries: start.kind === 'sum' ? start.hidden.map(() => null) : [], // 달아난 숫자: 네모마다 넣은 숫자
      box: 0, // 고른 네모
      history: [], // 무르기에 쓰는 그 전 모습들
      tried: ['0:0:0'], // 바퀴를 놓아 본 모습들(처음 모습을 넣는다)
      pickCount: 0, // 바깥 글자를 누른 수
      turnCount: 0, // 바퀴를 돌린 수
      entryCount: 0, // 네모에 숫자를 넣은 수
      pressCount: 0, // "이 열쇠예요"를 누른 수
      checkCount: 0, // 다 채웠는데 셈이 맞지 않았던 수
      wrongCount: 0, // 사실과 다른 답의 수(다른 바깥 글자, 다른 열쇠의 "이 열쇠예요", 맞지 않는 셈)
      undoCount: 0,
      resetCount: 0,
      wrapSaid: [], // 끝 칸을 지나 처음으로 돌아간다고 말한 바퀴들
      lapSaid: false, // 한 바퀴를 다 돌렸다고 말했는가
      countsOn: false, // 지금 글자 세기를 보고 있는가
      countsShown: false, // 한 번이라도 보았는가
      countsCount: 0, // 켠 수
    };
  }

  /** 작은 그림에는 글의 앞부분만(글자 SMALL_LETTERS개 안쪽에서 낱말이 끝나는 곳까지) */
  function cut(text, most = SMALL_LETTERS) {
    const cells = [...text];
    let letters = 0;
    let end = cells.length;
    for (let at = 0; at < cells.length; at++) {
      if (cells[at] !== ' ') letters += 1;
      if (letters > most) {
        end = cells.lastIndexOf(' ', at);
        if (end <= 0) end = at;
        break;
      }
    }
    return cells.slice(0, end).join('');
  }

  /** 판의 첫 모습을 작게(처음 화면, 판 고르기, 하던 판, 공책) */
  function drawSmall(root, round) {
    const { board } = round;
    const view = { words: T.words, labels: T.labels, small: true };
    if (board.kind === 'sum') view.sum = { rows: board.rows, op: board.op, hidden: board.hidden, entries: round.entries ?? board.hidden.map(() => null) };
    else {
      // 글자표의 수는 글자보다 넓어서 두 글자만 쓴다
      const cipher = cut(cipherOf(board), board.show === 'numbers' ? SMALL_LETTERS / 4 : SMALL_LETTERS);
      const solveRings = ringsToSolve(board);
      const reading = FIND_MODES.includes(round.mode) && round.tried?.length > 1 ? readWith(cipher, round.turns) : null;
      view.message = { cipher, numbers: board.show === 'numbers', reading, hideBottom: !reading && Object.keys(round.found ?? {}).length === 0, plainOf: (ring, index) => (solveRings.includes(ring) ? (round.found?.[`${ring}${index}`] ?? null) : index) };
      const ring = board.kind === 'digits' ? 'd' : 'c';
      view.wheels = [{ ring, turn: round.turns?.[ring] ?? 0, numbers: board.show === 'numbers' }];
    }
    drawCipher(root, view);
  }

  return {
    id: FORMAT,
    T,
    padId: 'cipher-pad',
    makeId: 'make-cipher',
    // 바퀴가 판 칸의 남은 높이를 다 쓴다. 규칙 글은 왼쪽 칸 맨 위에 두고 바퀴를 크게 그린다(바깥 글자 한 칸이 44픽셀보다 작아지지 않게).
    ruleAside: true,
    homeIds: { sample: 'home-cipher-sample', blank: 'home-cipher-blank', ask: 'home-cipher-ask', play: 'home-cipher-play', pick: 'home-cipher-pick', make: 'home-cipher-make' },
    ladder: { ...ladder, LADDER, TOP_LEVEL, MAKE_LEVEL },

    begin,
    solve: (round) => solve(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      const turns = saved.turns;
      if (!turns || !['c', 'v', 'd'].every((ring) => Number.isInteger(turns[ring]) && turns[ring] >= 0 && turns[ring] < RING_SIZE[ring])) return false;
      if (!saved.found || typeof saved.found !== 'object' || !Object.entries(saved.found).every(([id, value]) => parseSymbol(id) && Number.isInteger(value))) return false;
      if (!Array.isArray(saved.entries) || !Array.isArray(saved.history) || !Array.isArray(saved.tried) || !Array.isArray(saved.wrapSaid)) return false;
      if (saved.board.kind === 'sum' && (saved.entries.length !== saved.board.hidden.length || !Number.isInteger(saved.box))) return false;
      if (![saved.lapSaid, saved.countsOn, saved.countsShown].every((value) => typeof value === 'boolean')) return false;
      return [saved.pickCount, saved.turnCount, saved.entryCount, saved.pressCount, saved.checkCount, saved.wrongCount, saved.undoCount, saved.resetCount, saved.countsCount].every(count);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('cipher-board').hidden = !on;
      $('cipher-count').hidden = !on;
      if (!on) $('cipher-counts').hidden = true;
    },
    enter() {
      flash = null;
    },
    draw,
    ended() {
      flash = null;
    },
    ruleLine: (round) => T.rules[keyOf(round)],
    hints: (round) => T.hints[keyOf(round)],
    touched: (round) => round.pickCount > 0 || round.turnCount > 0 || round.entryCount > 0 || round.pressCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      return { turns: { ...round.turns }, found: Object.keys(round.found).length, left: round.board.kind === 'sum' ? round.entries.filter((value) => value === null).length : leftOf(round).length, tried: round.tried.length };
    },
    /** 이 판보다 작은 판: 같은 종류의 더 짧은 글(같은 열쇠)이나 두 자리 세로셈 */
    smaller: (round, turn) => smallerCipher({ mode: round.mode, board: round.board, book: T.messages }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: round.board.kind === 'sum' ? { kind: 'sum', count: solution.count, answer: solution.answer } : { kind: solution.kind, keys: solution.keys, keyCount: solution.keyCount },
        // 질문 힌트와 "글자 세어 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.countsShown ? 1 : 0),
        countsShown: round.countsShown,
        countsCount: round.countsCount,
        // 판을 떠날 때의 모습
        turns: { ...round.turns },
        found: { ...round.found },
        entries: round.entries.slice(),
        tried: round.tried.length,
        // 수준 맞추기가 보는 손댄 수와 "틀린 답"의 수
        moveCount: round.pickCount + round.turnCount + round.entryCount + round.pressCount,
        pickCount: round.pickCount,
        turnCount: round.turnCount,
        entryCount: round.entryCount,
        pressCount: round.pressCount,
        checkCount: round.checkCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    onKey(event) {
      const { round } = frame;
      if (!round || round.done) return;
      if (round.mode === 'sum') {
        if (/^[0-9]$/.test(event.key)) pressDigit(event.key);
        else if (event.key === 'Backspace') pressDigit('erase');
        return;
      }
      const ring = wheelRings(round)[0];
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') turnWheel(ring, 1);
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') turnWheel(ring, -1);
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawSmall(root, { mode: 'decode', board, turns: { c: 0, v: 0, d: 0 }, found: {} });
    },
    drawBlank(root) {
      drawCipher(root, { words: T.words, labels: T.labels, small: true, wheels: [{ ring: 'c', turn: 3 }] });
    },
    /** 하던 판과 공책의 그림: 푼 글자, 바퀴대로 읽은 글, 채운 숫자 */
    drawResume(root, saved) {
      drawSmall(root, saved);
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) {
        drawCipher(root, { words: T.words, labels: T.labels, small: true, wheels: [{ ring: 'c', turn: 3 }] });
        return;
      }
      drawSmall(root, { mode: rungOf(entry.level).mode, board: ladder.generateBoard(entry.level, picture.seed).board, turns: { c: 0, v: 0, d: 0 }, found: {} });
    },
    showMake,
    /** 직접 만들기에서 다 쓴 암호 편지(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
