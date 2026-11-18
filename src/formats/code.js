// 숫자 추리: 판 화면에서 이 형식이 맡는 부분(추측과 답의 표, 숫자판, 메모판, 맞혔을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/code.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)는 단계가 정한다.
//   guess    컴퓨터가 숨긴 암호를 추측해서 알아낸다. 추측마다 두 수를 듣는다(1~3단계)
//   table    추측과 답이 적힌 표만 보고 암호를 넣는다(4단계, 직접 만든 표)
//   referee  역할 바꾸기. 아이가 암호를 정하고 컴퓨터가 추측한다. 아이가 두 수를 넣어 준다(5단계)
// 추측은 틀린 답이 아니다. 두 수만 알려 주고 아무 말도 덧붙이지 않는다.
// 암호일 수 없는 추측(지금까지의 답과 맞지 않는 추측)을 냈는지는 기록에만 남긴다.
import T from '../content/code.json';
import { LADDER, MAKE_DIGITS, MAKE_LENGTH, MAKE_LEVEL, MAKE_MAX_ROWS, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/code-ladder.js';
import { allCodes, checkBoard, checkCode, checkRows, diagnoseReply, diagnoseTable, filterCodes, fitsAll, judge, nextGuess, solveTable, trailOf } from '../core/code.js';
import { smallerCode } from '../core/smaller.js';
import { fill } from '../core/text.js';
import { codeCard, drawMemo, drawMini, drawPicker, drawSlots, drawTable } from '../ui/code-board.js';

const FORMAT = 'code';
const NO_REPLY = { hit: null, place: null };
/** 처음 화면의 카드에 보여 주는 표의 줄 수의 위 끝(더 있으면 표시만 한다) */
const MINI_ROWS = 3;

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createCode(frame) {
  const { $, log } = frame;
  let typed = ''; // 숫자판으로 넣는 중인 추측이나 암호
  let reply = { ...NO_REPLY }; // 역할 바꾸기에서 고르는 중인 두 수
  let draft = null; // 직접 만들기에서 만들던 표 { digits, rows }
  let draftTyped = ''; // 직접 만들기에서 넣는 중인 추측
  let draftReply = { ...NO_REPLY }; // 직접 만들기에서 고르는 중인 두 수
  let draftUnique = false; // 풀이 프로그램이 "하나뿐"이라고 알려 준 뒤인가(표를 바꾸면 지운다)

  const countText = (n) => fill(T.count, { n });
  const rangeOf = (board) => ({ low: board.digits[0], high: board.digits.at(-1), n: board.length });
  const slotsOf = (text, length, blank = '') => Array.from({ length }, (_, index) => text[index] ?? blank);
  const copyRows = (rows) => rows.map((row) => ({ guess: row.guess, hit: row.hit, place: row.place }));
  const copyBoard = (board) => {
    const copy = { mode: board.mode, length: board.length, digits: board.digits };
    if (board.mode === 'guess') copy.secret = board.secret;
    if (board.mode === 'table') copy.rows = copyRows(board.rows);
    return copy;
  };
  /** 지금까지의 답과 모두 맞는 후보 */
  const candidatesOf = (round) => filterCodes(allCodes(round.board.length, round.board.digits), round.rows);
  /** 지금 숫자판으로 넣는 것: 'guess'(추측) | 'table'(암호) | 'secret'(내 암호 정하기) | 'reply'(두 수 알려 주기) */
  function phaseOf(round) {
    if (round.mode !== 'referee') return round.mode;
    return round.secret === null ? 'secret' : 'reply';
  }
  /** 이 판의 암호. 역할 바꾸기에서는 아이가 정한 암호다(아직 안 정했으면 null). */
  function secretOf(round, solution) {
    if (round.mode === 'referee') return round.secret;
    return round.mode === 'table' ? solution.secret : round.board.secret;
  }

  // ---- 표 ----
  const plainRow = (row, index, left) => ({
    no: String(index + 1),
    guess: row.guess,
    hit: countText(row.hit),
    place: countText(row.place),
    left: left === undefined ? '' : countText(left),
  });
  const labelRow = (label, code) => ({ kind: 'label', no: label, guess: code });

  /** 판에 그릴 줄들 */
  function boardRows(round, solution, showLeft) {
    const rows = [];
    if (showLeft) rows.push({ kind: 'start', no: T.startRow, left: countText(solution.start) });
    if (round.mode === 'table') {
      round.board.rows.forEach((row, index) => {
        const line = plainRow(row, index, solution.trail[index]);
        const flagged = !round.done && round.flag?.row === index;
        rows.push(flagged ? { ...line, kind: 'flagged', flag: T.flag } : line);
        if (flagged) rows.push(labelRow(T.attemptRow, round.flag.code));
      });
      if (round.done) rows.push(labelRow(T.answerRow, solution.secret));
      return rows;
    }
    if (round.mode === 'referee' && round.secret !== null) rows.push(labelRow(T.secretRow, round.secret));
    round.rows.forEach((row, index) => rows.push(plainRow(row, index, row.left)));
    if (round.mode === 'referee' && round.pending !== null) {
      // 답이 어긋났을 때는 암호를 추측 바로 위에 한 번 더 적어, 위아래로 나란히 견줘 볼 수 있게 한다.
      if (round.compare && round.rows.length > 0) rows.push(labelRow(T.secretRow, round.secret));
      const line = { no: String(round.rows.length + 1), guess: round.pending, hit: T.hidden, place: T.hidden, left: '' };
      rows.push(round.compare ? { ...line, kind: 'flagged', flag: T.flag } : { ...line, kind: 'pending' });
    }
    // 그만두고 풀이를 본 판에는 암호를 적어 둔다(맞힌 판은 마지막 추측이 암호다).
    if (round.mode === 'guess' && round.done && round.rows.at(-1)?.guess !== round.board.secret) rows.push(labelRow(T.answerRow, round.board.secret));
    return rows;
  }

  function drawBoard() {
    const { round, solution } = frame;
    const referee = round.mode === 'referee';
    // 역할 바꾸기에서는 남은 후보 수가 줄어드는 것을 늘 보여 준다.
    const showLeft = referee || round.leftOn;
    $('code-left').hidden = referee;
    $('code-left').setAttribute('aria-pressed', String(round.leftOn));
    $('code-memo-open').hidden = referee;
    $('code-memo-open').setAttribute('aria-pressed', String(round.memoOn));
    const memoOn = round.memoOn && !referee;
    $('code-memo').hidden = !memoOn;
    // 메모판이 열려 있으면 표의 줄을 낮게 그려 자리를 나눈다. 표는 메모판의 자리를 정한 뒤에 그려야 맨 아래 줄이 보인다.
    $('code-board').classList.toggle('with-memo', memoOn);
    drawTable($('code-table'), { heads: T.heads, rows: boardRows(round, solution, showLeft), showLeft, follow: true });
    if (memoOn) {
      drawMemo($('code-memo-rows'), {
        positions: T.positions.slice(0, round.board.length),
        digits: round.board.digits,
        struck: round.memo,
        label: (at, digit) => fill(T.memoChip, { pos: T.positions[at], digit }),
        onTap: round.done ? undefined : tapMemo,
      });
    }
    $('code-memo-clear').disabled = round.done || round.memo.every((item) => item === '');
    frame.showWhy();
  }

  // ---- 숫자판과 답 넣기 ----
  function drawKeys(root, digits, used, full) {
    for (const button of root.querySelectorAll('button')) {
      const key = button.dataset.digit;
      if (key === 'erase') button.disabled = used === '';
      else {
        button.hidden = !digits.includes(key);
        button.disabled = full || used.includes(key);
      }
    }
  }

  function drawPad() {
    const { round } = frame;
    const { length, digits } = round.board;
    const phase = phaseOf(round);
    $('code-enter').hidden = phase === 'reply';
    $('code-reply').hidden = phase !== 'reply';
    if (phase === 'reply') {
      drawPicker($('code-reply-hit'), { most: length, value: reply.hit, label: (n) => fill(T.replyLabel.hit, { n }), disabled: round.done });
      drawPicker($('code-reply-place'), { most: length, value: reply.place, label: (n) => fill(T.replyLabel.place, { n }), disabled: round.done });
      $('code-reply-submit').disabled = round.done || reply.hit === null || reply.place === null;
      return;
    }
    $('code-enter-title').textContent = T.pad[`${phase}Title`];
    $('code-submit').textContent = T.pad[`${phase}Submit`];
    drawSlots($('code-slots'), { chars: slotsOf(typed, length), next: typed.length, label: fill(T.slotsLabel, { n: typed.length }) });
    drawKeys($('code-keys'), digits, typed, round.done || typed.length >= length);
    $('code-submit').disabled = round.done || typed.length !== length;
  }

  function draw() {
    drawBoard();
    drawPad();
  }

  function pressKey(key) {
    const { round } = frame;
    if (round.done || $('code-pad').hidden || phaseOf(round) === 'reply') return;
    const { length, digits } = round.board;
    if (key === 'erase') typed = typed.slice(0, -1);
    else if (digits.includes(key) && !typed.includes(key) && typed.length < length) typed += key;
    drawPad();
  }

  function submitTyped() {
    const { round } = frame;
    if (round.done || checkCode(typed, round.board.length, round.board.digits) !== null) return;
    const code = typed;
    typed = '';
    const phase = phaseOf(round);
    if (phase === 'guess') makeGuess(code);
    else if (phase === 'table') tryCode(code);
    else if (phase === 'secret') setSecret(code);
  }

  /** 1~3단계: 추측을 내고 두 수를 듣는다. 틀린 답이 아니므로 두 수만 알려 준다. */
  function makeGuess(code) {
    const { round } = frame;
    const before = candidatesOf(round);
    const result = judge(code, round.board.secret);
    const row = { guess: code, hit: result.hit, place: result.place };
    const consistent = before.includes(code);
    const left = filterCodes(before, [row]).length;
    round.rows.push({ ...row, left, consistent });
    if (!consistent) round.inconsistentCount += 1;
    frame.note('guess', { code, hit: row.hit, place: row.place, left, consistent });
    if (row.place === round.board.length) {
      // 암호를 알아낸 추측이 이 판의 답이다.
      round.answers.push({ t: frame.stamp(), answer: code, correct: true, guess: null });
      frame.finish('solved');
      return;
    }
    frame.persist();
    draw();
    frame.say(fill(T.play.reply, { hit: row.hit, place: row.place }));
  }

  /** 4단계: 표와 모두 맞는 암호를 넣는다. 어긋나면 어긋나는 첫 줄을 가리킨다. */
  function tryCode(code) {
    const { round } = frame;
    const result = diagnoseTable(code, round.board.rows);
    const row = result.row === null ? null : result.row + 1;
    round.tries.push(code);
    round.answers.push({ t: frame.stamp(), answer: code, correct: result.correct, guess: result.guess, row });
    frame.note('answer', { answer: code, correct: result.correct, guess: result.guess, row });
    if (result.correct) {
      round.flag = null;
      frame.finish('solved');
      return;
    }
    // 틀린 답: 깎이는 것도, 채점 표시도 없다. 어긋나는 줄 아래에 넣은 암호를 적어 직접 견줘 보게 한다.
    round.wrongCount += 1;
    round.flag = { row: result.row, code };
    frame.persist();
    draw();
    frame.say(fill(T.guess['table-row'], { no: row }));
  }

  /** 5단계: 아이가 암호를 정하면 컴퓨터가 첫 추측을 낸다. */
  function setSecret(code) {
    const { round } = frame;
    round.secret = code;
    frame.note('secret', { code });
    offerGuess(allCodes(round.board.length, round.board.digits));
    frame.persist();
    draw();
    frame.say(T.play.secretSet);
  }

  /** 컴퓨터의 다음 추측. 지금까지의 답과 모두 맞는 후보 가운데서만 고른다. */
  function offerGuess(candidates) {
    const { round } = frame;
    round.pending = nextGuess(candidates, round.seed, round.rows.length);
    round.pendingWrong = 0;
    round.compare = false;
    frame.note('offer', { code: round.pending, turn: round.rows.length + 1 });
  }

  /** 5단계: 아이가 심판이 되어 넣은 두 수. 실제와 다르면 고칠 때까지 다음으로 넘어가지 않는다. */
  function submitReply() {
    const { round } = frame;
    if (round.done || round.pending === null || reply.hit === null || reply.place === null) return;
    const { hit, place } = reply;
    reply = { ...NO_REPLY };
    const result = diagnoseReply(round.pending, round.secret, { hit, place }, round.pendingWrong);
    const answer = `${hit}-${place}`;
    round.answers.push({ t: frame.stamp(), answer, about: round.pending, correct: result.correct, guess: result.guess });
    frame.note('answer', { answer, about: round.pending, correct: result.correct, guess: result.guess });
    if (!result.correct) {
      // 틀린 횟수를 세어 보여 주지 않는다. 암호와 추측을 위아래로 나란히 놓아 직접 견줘 보게 한다.
      round.wrongCount += 1;
      round.pendingWrong += 1;
      round.compare = true;
      round.wrongReplies.push({ guess: round.pending, hit, place });
      frame.persist();
      draw();
      frame.say(T.guess[result.guess]);
      return;
    }
    const row = { guess: round.pending, hit, place };
    const candidates = filterCodes(candidatesOf(round), [row]);
    round.rows.push({ ...row, left: candidates.length });
    round.pending = null;
    round.compare = false;
    if (place === round.board.length) {
      frame.finish('solved');
      return;
    }
    offerGuess(candidates);
    frame.persist();
    draw();
    frame.say(fill(T.play.next, { left: candidates.length }));
  }

  function pickReply(kind, value) {
    const { round } = frame;
    if (round.done || !Number.isInteger(value)) return;
    reply = { ...reply, [kind]: value };
    drawPad();
  }

  // ---- 메모판: 맞는지 판정하지 않는다. 쓴 것은 기록에 남긴다. ----
  function tapMemo(at, digit) {
    const { round } = frame;
    if (round.done) return;
    const off = !round.memo[at].includes(digit);
    round.memo[at] = off ? round.memo[at] + digit : round.memo[at].replace(digit, '');
    round.memoUsed = true;
    round.memoCount += 1;
    frame.note('memo', { at, digit, off });
    drawBoard();
    frame.persist();
  }

  function toggleMemo() {
    const { round } = frame;
    if (!round) return;
    round.memoOn = !round.memoOn;
    if (!round.done) frame.note('memo-open', { on: round.memoOn });
    drawBoard();
    frame.persist();
  }

  function clearMemo() {
    const { round } = frame;
    if (round.done) return;
    round.memo = round.memo.map(() => '');
    frame.note('memo-clear');
    drawBoard();
    frame.persist();
  }

  // ---- "남은 후보 수 보기": 처음 누를 때 힌트 하나를 연 것으로 적는다. ----
  function toggleLeft() {
    const { round, solution } = frame;
    if (!round) return;
    round.leftOn = !round.leftOn;
    if (!round.done && !round.leftShown) {
      round.leftShown = true;
      frame.note('left', { left: round.mode === 'table' ? solution.trail.at(-1) : (round.rows.at(-1)?.left ?? solution.start) });
    }
    drawBoard();
    frame.persist();
    if (round.leftOn) frame.say(T.play.leftShown, 'point');
  }

  /** 맞혔을 때 하는 말: 무엇을 했는지 그대로 말한다. */
  function rightLine(round, solution) {
    const parts = [];
    if (round.mode === 'guess') parts.push(fill(T.right['guess-found'], { n: round.rows.length }));
    else if (round.mode === 'table') parts.push(round.tries.length === 1 ? T.right['table-first'] : fill(T.right['table-tries'], { n: round.tries.length }));
    else {
      parts.push(fill(T.right['referee-found'], { n: round.rows.length }));
      // 후보가 하나 남은 뒤에 그 하나를 낸 마지막 추측은 수가 그대로라서 한 번만 말한다.
      const counts = [solution.start, ...round.rows.map((row) => row.left)].filter((count, index, list) => index === 0 || count !== list[index - 1]);
      const trail = counts.map(countText).join(T.trailJoin);
      parts.push(fill(T.right['referee-trail'], { trail }));
    }
    // 이 형식의 판을 처음으로 끝까지 했으면 "왜 그럴까?"가 생겼다고 알려 준다.
    const finished = frame.records().filter((record) => record.kind === 'round' && record.format === FORMAT && (record.outcome === 'solved' || record.outcome === 'solution'));
    if (!round.side && finished.length === 1) parts.push(T.right['why-invite']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 줄들과 줄마다 남은 후보 수를 표로 만든다. */
  function trailTable(rows, start, counts) {
    return {
      heads: T.heads,
      showLeft: true,
      rows: [{ kind: 'start', no: T.startRow, left: countText(start) }, ...rows.map((row, index) => plainRow(row, index, counts[index]))],
    };
  }

  /** 풀이: 암호와, 추측마다 남은 후보 수가 어떻게 줄었는지를 표로 보여 준다. */
  function solutionPages(round, solution) {
    const secret = secretOf(round, solution);
    if (secret === null) return [{ say: T.solution['referee-none'], nodes: [] }];
    const rows = round.mode === 'table' ? round.board.rows : round.rows;
    const counts = round.mode === 'table' ? solution.trail : round.rows.map((row) => row.left);
    const view = { answer: { label: round.mode === 'referee' ? T.secretRow : T.answerRow, code: secret } };
    if (rows.length > 0) view.table = trailTable(rows, solution.start, counts);
    const say = round.mode === 'guess' && rows.length === 0 ? T.solution['guess-none'] : T.solution[round.mode];
    return [{ say, nodes: [rowOf([codeCard(view)])] }];
  }

  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      nodes: [
        rowOf(
          slide.figures.map((item) => {
            const view = { note: item.note };
            if (item.list) view.list = { codes: item.list, more: T.more };
            if (item.rows.length > 0) {
              // 그림 속의 남은 후보 수는 풀이 프로그램이 센다.
              const { start, counts } = trailOf(item.length, item.digits, item.rows);
              view.table = trailTable(item.rows, start, counts);
            }
            return codeCard(view);
          }),
        ),
      ],
    }));
  }

  // ---- 직접 만들기: 추측 줄과 답을 넣어 표를 만든다. ----
  const rowsFit = (rows, digits) => checkRows(rows, MAKE_LENGTH, digits) === null;

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    if (saved && MAKE_DIGITS.includes(saved.digits) && rowsFit(saved.rows, saved.digits) && saved.rows.length <= MAKE_MAX_ROWS) {
      return { digits: saved.digits, rows: copyRows(saved.rows) };
    }
    return { digits: MAKE_DIGITS[0], rows: [] };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    draftTyped = '';
    draftReply = { ...NO_REPLY };
    draftUnique = false;
    $('code-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const full = draft.rows.length >= MAKE_MAX_ROWS;
    drawTable($('code-make-board'), { heads: T.heads, rows: draft.rows.map((row, index) => plainRow(row, index)), follow: true });
    $('code-make-count').textContent = fill(T.make.count, { n: draft.rows.length });
    for (const button of $('code-make-digits').querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.digits === draft.digits));
      // 적어 둔 줄에 없는 숫자가 생기는 쪽으로는 바꿀 수 없다(줄을 지우면 바꿀 수 있다).
      button.disabled = !rowsFit(draft.rows, button.dataset.digits);
    }
    $('code-make-undo').disabled = draft.rows.length === 0;
    $('code-make-clear').disabled = draft.rows.length === 0;
    drawSlots($('code-make-slots'), { chars: slotsOf(draftTyped, MAKE_LENGTH), next: draftTyped.length, label: fill(T.slotsLabel, { n: draftTyped.length }) });
    drawKeys($('code-make-keys'), draft.digits, draftTyped, full || draftTyped.length >= MAKE_LENGTH);
    drawPicker($('code-make-hit'), { most: MAKE_LENGTH, value: draftReply.hit, label: (n) => fill(T.replyLabel.hit, { n }), disabled: full });
    drawPicker($('code-make-place'), { most: MAKE_LENGTH, value: draftReply.place, label: (n) => fill(T.replyLabel.place, { n }), disabled: full });
    $('code-make-add').disabled = full || draftTyped.length !== MAKE_LENGTH || draftReply.hit === null || draftReply.place === null;
    $('code-make-solve').disabled = draft.rows.length === 0;
    $('code-make-play').disabled = !draftUnique;
  }

  function pressMakeKey(key) {
    if (key === 'erase') draftTyped = draftTyped.slice(0, -1);
    else if (draft.digits.includes(key) && !draftTyped.includes(key) && draftTyped.length < MAKE_LENGTH) draftTyped += key;
    drawMake();
  }

  function changeDraft(change) {
    draft = { ...draft, ...change };
    draftUnique = false;
    $('code-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  function addRow() {
    if (draft.rows.length >= MAKE_MAX_ROWS || checkCode(draftTyped, MAKE_LENGTH, draft.digits) !== null) return;
    if (draftReply.hit === null || draftReply.place === null) return;
    const row = { guess: draftTyped, hit: draftReply.hit, place: draftReply.place };
    draftTyped = '';
    draftReply = { ...NO_REPLY };
    changeDraft({ rows: [...draft.rows, row] });
  }

  /** 아이가 만든 표를 풀이 프로그램으로 풀어서, 표와 맞는 암호가 몇 개인지 알려 준다(암호는 알려 주지 않는다). */
  function solveDraft() {
    if (draft.rows.length === 0) return;
    const result = solveTable(MAKE_LENGTH, draft.digits, draft.rows);
    const line = result.count === 0 ? T.make.none : result.count === 1 ? T.make.one : fill(T.make.many, { k: result.count });
    draftUnique = result.count === 1;
    $('code-make-result').textContent = line;
    drawMake();
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board: { mode: 'table', length: MAKE_LENGTH, digits: draft.digits, rows: copyRows(draft.rows) },
      solution: { count: result.count, secret: result.secret, start: result.start, trail: result.trail },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 답이 하나뿐인 표는 4단계처럼 직접 풀어 볼 수 있다. */
  function playDraft() {
    if (!draftUnique) return;
    const board = { mode: 'table', length: MAKE_LENGTH, digits: draft.digits, rows: copyRows(draft.rows) };
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  const numberOf = (event) => {
    const text = event.target.closest('button')?.dataset.n;
    return text === undefined ? null : Number(text);
  };
  $('code-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.digit;
    if (key) pressKey(key);
  });
  $('code-submit').addEventListener('click', submitTyped);
  $('code-reply-hit').addEventListener('click', (event) => pickReply('hit', numberOf(event)));
  $('code-reply-place').addEventListener('click', (event) => pickReply('place', numberOf(event)));
  $('code-reply-submit').addEventListener('click', submitReply);
  $('code-left').addEventListener('click', toggleLeft);
  $('code-memo-open').addEventListener('click', toggleMemo);
  $('code-memo-clear').addEventListener('click', clearMemo);
  $('code-make-digits').addEventListener('click', (event) => {
    const digits = event.target.closest('button')?.dataset.digits;
    if (digits && digits !== draft.digits && rowsFit(draft.rows, digits)) {
      draftTyped = '';
      changeDraft({ digits });
    }
  });
  $('code-make-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.digit;
    if (key) pressMakeKey(key);
  });
  $('code-make-hit').addEventListener('click', (event) => {
    const value = numberOf(event);
    if (value !== null) {
      draftReply = { ...draftReply, hit: value };
      drawMake();
    }
  });
  $('code-make-place').addEventListener('click', (event) => {
    const value = numberOf(event);
    if (value !== null) {
      draftReply = { ...draftReply, place: value };
      drawMake();
    }
  });
  $('code-make-add').addEventListener('click', addRow);
  $('code-make-undo').addEventListener('click', () => changeDraft({ rows: draft.rows.slice(0, -1) }));
  $('code-make-clear').addEventListener('click', () => changeDraft({ rows: [] }));
  $('code-make-solve').addEventListener('click', solveDraft);
  $('code-make-play').addEventListener('click', playDraft);

  return {
    id: FORMAT,
    T,
    padId: 'code-pad',
    makeId: 'make-code',
    homeIds: { sample: 'home-code-sample', blank: 'home-code-blank', ask: 'home-code-ask', play: 'home-code-play', pick: 'home-code-pick', make: 'home-code-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    /** 새 판에서 이 형식이 맡는 값 */
    begin({ board }) {
      return {
        mode: board.mode,
        board: copyBoard(board), // 판: 숨긴 암호(guess) 또는 표(table). 역할 바꾸기에는 자릿수와 숫자만 있다
        secret: null, // 역할 바꾸기에서 아이가 정한 암호
        rows: [], // 지금까지의 추측과 답, 그 뒤에 남은 후보 수. 역할 바꾸기에서는 컴퓨터의 추측과 아이가 바르게 넣은 답
        pending: null, // 역할 바꾸기에서 답을 기다리는 컴퓨터의 추측
        pendingWrong: 0, // 그 추측에 어긋난 답을 넣은 횟수
        compare: false, // 암호와 추측을 나란히 보여 주는 중인가
        tries: [], // 표만 보고 알아내기에서 넣어 본 암호들
        flag: null, // 그때 어긋난 줄과 넣은 암호 { row, code }
        memo: Array.from({ length: board.length }, () => ''), // 메모판에서 자리마다 지운 숫자들
        memoOn: false, // 메모판이 보이는 중인가
        memoUsed: false,
        memoCount: 0,
        leftShown: false, // 남은 후보 수를 한 번이라도 보았는가
        leftOn: false, // 지금 남은 후보 수가 보이는 중인가
        inconsistentCount: 0, // 지금까지의 답과 맞지 않는 추측을 낸 횟수(말하지 않고 기록만 한다)
        wrongCount: 0, // 표에 넣은 틀린 암호의 수, 역할 바꾸기에서 어긋난 답의 수
        wrongReplies: [], // 역할 바꾸기에서 어긋난 답들
      };
    },
    solve(round) {
      const { board } = round;
      if (board.mode === 'table') return { possible: true, ...solveTable(board.length, board.digits, board.rows) };
      return { possible: true, secret: board.secret ?? null, start: allCodes(board.length, board.digits).length };
    },
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (checkBoard(saved.board) !== null || saved.mode !== saved.board.mode) return false;
      const { length, digits } = saved.board;
      if (checkRows(saved.rows, length, digits) !== null || !Array.isArray(saved.tries) || !Array.isArray(saved.wrongReplies)) return false;
      if (!Array.isArray(saved.memo) || saved.memo.length !== length || !saved.memo.every((item) => typeof item === 'string')) return false;
      if (saved.mode === 'table') {
        if (solveTable(length, digits, saved.board.rows).count !== 1) return false;
        const flag = saved.flag;
        if (flag !== null && (!flag || !Number.isInteger(flag.row) || !saved.board.rows[flag.row] || checkCode(flag.code, length, digits) !== null)) return false;
        return true;
      }
      if (saved.mode === 'guess') return fitsAll(saved.board.secret, saved.rows);
      // 역할 바꾸기: 암호를 정했으면 늘 추측 하나가 답을 기다리고, 적힌 답은 모두 암호와 맞는다.
      if (saved.secret === null) return saved.pending === null && saved.rows.length === 0;
      return checkCode(saved.secret, length, digits) === null && checkCode(saved.pending, length, digits) === null && fitsAll(saved.secret, saved.rows);
    },
    /** 판 화면에서 이 형식의 것(표, 메모판, 남은 후보 수 단추)을 보이거나 감춘다. 이 형식에는 무르기와 되돌리기가 없다. */
    showParts(on) {
      $('code-board').hidden = !on;
      $('code-left').hidden = !on;
      $('code-memo-open').hidden = !on;
      $('undo').hidden = on;
      $('reset').hidden = on;
    },
    enter() {
      typed = '';
      reply = { ...NO_REPLY };
    },
    draw,
    ended() {
      typed = '';
      reply = { ...NO_REPLY };
    },
    ruleLine: (round) => fill(T.rules[round.mode], rangeOf(round.board)),
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.rows.length > 0 || round.tries.length > 0 || round.secret !== null || round.memoUsed,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view: (round) => ({ rows: round.rows.map((row) => ({ guess: row.guess, hit: row.hit, place: row.place })), tries: round.tries.length, pending: round.pending }),
    /** 이 판보다 작은 판: 숫자 1~4로 만든 두 자리 암호(표, 역할 바꾸기도 두 자리) */
    smaller: (round, turn) => smallerCode({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const table = round.mode === 'table';
      const counts = table ? solution.trail : round.rows.map((row) => row.left);
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: true, secret: secretOf(round, solution), start: solution.start },
        // 추측과 두 수의 차례. 표만 보고 알아내기에서는 주어진 표의 줄들이다.
        guesses: table ? copyRows(round.board.rows) : round.rows,
        // 추측마다 남은 후보 수(맨 앞은 처음 후보 수)
        leftTrail: [solution.start, ...counts],
        // 낸 추측의 수. 표만 보고 알아내기에서는 넣어 본 암호의 수, 역할 바꾸기에서는 컴퓨터가 낸 추측의 수다.
        guessCount: table ? round.tries.length : round.rows.length + (round.pending === null ? 0 : 1),
        inconsistentCount: round.inconsistentCount,
        wrongCount: round.mode === 'guess' ? null : round.wrongCount,
        tries: round.tries,
        wrongReplies: round.wrongReplies,
        memoUsed: round.memoUsed,
        memoCount: round.memoCount,
        memo: round.memo,
        // 질문 힌트와 "남은 후보 수 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.leftShown ? 1 : 0),
        leftShown: round.leftShown,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo() {},
    reset() {},
    /** 글자판이 있는 기기에서는 숫자, 지우기, 엔터로 넣을 수도 있다. */
    onKey(event) {
      const { round } = frame;
      if ($('code-pad').hidden) return;
      const digit = /^[0-9]$/.test(event.key);
      if (phaseOf(round) === 'reply') {
        // 두 수를 차례로 친다: 먼저 들어 있는 숫자의 수, 다음에 자리도 맞는 것의 수
        if (digit && Number(event.key) <= round.board.length) pickReply(reply.hit === null ? 'hit' : 'place', Number(event.key));
        else if (event.key === 'Backspace') {
          reply = reply.place !== null ? { ...reply, place: null } : { ...NO_REPLY };
          drawPad();
        } else if (event.key === 'Enter') {
          event.preventDefault();
          submitReply();
        }
        return;
      }
      if (digit) pressKey(event.key);
      else if (event.key === 'Backspace') pressKey('erase');
      else if (event.key === 'Enter') {
        // 눌러 둔 단추가 엔터로 한 번 더 눌리지 않게 한다.
        event.preventDefault();
        submitTyped();
      }
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    /** 다음 판: 숨은 암호의 칸과 쓸 수 있는 숫자, 또는 표의 앞쪽 줄들 */
    drawSample(root, board) {
      if (board.mode === 'table') {
        const rows = board.rows.slice(0, MINI_ROWS).map((row) => ({ chars: [...row.guess], line: fill(T.shortLine, { hit: row.hit, place: row.place }) }));
        drawMini(root, { rows, more: board.rows.length > MINI_ROWS ? T.more : '' });
      } else if (board.mode === 'referee') drawMini(root, { rows: [{ label: T.secretRow, chars: slotsOf('', board.length) }], strip: board.digits });
      else drawMini(root, { rows: [{ chars: slotsOf('', board.length, T.hidden) }], strip: board.digits });
    },
    drawBlank(root) {
      drawMini(root, { rows: [{ chars: slotsOf('', MAKE_LENGTH), line: fill(T.shortLine, { hit: T.hidden, place: T.hidden }) }] });
    },
    /** 하던 판: 표의 마지막 줄을 작게 보여 준다. */
    drawResume(root, saved) {
      const { length } = saved.board;
      const last = saved.mode === 'table' ? saved.board.rows.at(-1) : saved.rows.at(-1);
      if (last) drawMini(root, { rows: [{ chars: [...last.guess], line: fill(T.rowLine, { hit: last.hit, place: last.place }) }] });
      else if (saved.mode === 'referee') drawMini(root, { rows: [{ label: T.secretRow, chars: slotsOf(saved.secret ?? '', length) }] });
      else drawMini(root, { rows: [{ chars: slotsOf('', length, T.hidden) }] });
    },
    /** 판 고르기의 그림: 단계마다 하는 일을 작은 그림으로 보여 준다. */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.row) drawMini(root, { rows: [{ chars: [...picture.row.guess], line: fill(T.shortLine, { hit: picture.row.hit, place: picture.row.place }) }] });
      else if (picture.shown) drawMini(root, { rows: [{ label: T.secretRow, chars: [...picture.shown] }] });
      else if (picture.blank) drawMini(root, { rows: [{ chars: slotsOf('', picture.blank), line: fill(T.shortLine, { hit: T.hidden, place: T.hidden }) }] });
      else drawMini(root, { rows: [{ chars: slotsOf('', picture.hidden, T.hidden) }] });
    },
    showMake,
  };
}
