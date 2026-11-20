// 공정한 게임일까: 판 화면에서 이 형식이 맡는 부분(규칙의 칸, 짐작하기, 열 번 던지기, 컴퓨터가 많이 던지기, 모든 경우의 표,
// 답 고르기, 규칙 고치기, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/fair.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)
//   judge  공정한지 고르기(1~4단계와 직접 만든 판). 먼저 짐작을 고른다(맞다 틀리다 하지 않는다). 그다음 던지기로 열 번까지 해 보고,
//          컴퓨터에게 1,000번씩 던져 보게 하고, 모든 경우의 표를 볼 수 있다. 답(공정해요, 다람쥐가 유리해요, 고슴도치가 유리해요)이
//          모든 경우를 센 판정과 같으면 끝난다. 다르면 짐작 하나와 사실(컴퓨터가 던진 수)과 할 수 있는 일을 말하고, 다시 고를 수 있다.
//   fix    규칙 고치기(5단계). 규칙의 칸 하나를 누르면 그 값을 다른 쪽이 가져간다(한 번에 한 군데만. 다른 칸을 누르면 앞의 칸은 돌아온다).
//          "이렇게 바꿀래요"를 눌러 바꾼 규칙이 모든 경우를 세어 공정하면 끝난다. 끝난 뒤 까닭을 적어 남길 수 있다(안 써도 된다).
// 아이가 던지는 열 번과 컴퓨터의 1,000번은 판에 적힌 시드로 정해진다(같은 판은 늘 같다). 누가 유리한지는 늘 모든 경우를 세어 정한다.
// 왼쪽 칸의 "모든 경우 세어 보기"를 켜면 판에 모든 경우의 표(칸마다 누가 가져가는지)와 몇 가지씩인지가 나온다.
// 표는 이 형식의 중심 도구라서 힌트로 세지 않는다(기록에는 남긴다).
import T from '../content/fair.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/fair-ladder.js';
import {
  CHOICES,
  DEVICE_IDS,
  MAX_MANY,
  MEASURES,
  MODES,
  PLAYS,
  checkBoard,
  checkRule,
  copyBoard,
  countCases,
  lookOf,
  measureOf,
  ownerOf,
  manyTally,
  pickSeeds,
  ruleKey,
  solve,
  sumBars,
  tallyOf,
  throwsFor,
  tidyRule,
  toggled,
  unorderedCount,
  valuesOf,
} from '../core/fair.js';
import { smallerFair } from '../core/smaller.js';
import { fill } from '../core/text.js';
import { card, drawBoard, drawMini, sumBarsNode, tableNode } from '../ui/fair-board.js';
import { whyUnlocked } from '../core/level.js';

const FORMAT = 'fair';
/** 기록에 남기는 답의 수의 위 끝 */
const MAX_TRIES = 60;
/** 까닭 글의 길이 위 끝 */
const MAX_REASON = 200;
/** 직접 만들기의 처음 규칙 */
const FIRST_DRAFT = { device: 'die2', measure: 'sum', a: [6, 7, 8] };
/** 처음 화면에 그려 둘 면이나 눈 */
const SAMPLE_FACES = { coin2: [1, 0], coin3: [1, 0, 1], die1: [5], die2: [3, 4] };

const count = (value) => Number.isInteger(value) && value >= 0;
/** 큰 수는 세 자리마다 쉼표를 찍는다(1,000번) */
const big = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createFair(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let rolling = false; // 방금 던졌는가(그때만 동전과 주사위가 흔들린다)
  let told = false; // 선생님이 방금 지금 모습에 기대는 말을 했는가(모습이 바뀌면 짧은 사실로 덮는다)
  let draft = null; // 직접 만들기에서 만들던 규칙
  let asked = null; // 직접 만들기에서 선생님이 센 것(규칙을 고치면 지운다)

  // ---- 읽는 법 ----
  const valueText = (value) => (typeof value === 'number' ? String(value) : T.values[value]);
  const currentRule = (round) => (round.change === null ? round.board.rule : toggled(round.board.rule, round.change));
  const hintKey = (round) => (round.mode === 'fix' ? 'fix' : round.board.rule.device.startsWith('coin') ? 'coins' : round.board.rule.device === 'die1' ? 'die' : 'dice');

  function ruleLine(round) {
    const { board } = round;
    const game = board.name && T.games[board.name] ? T.games[board.name] : `${T.devices[board.rule.device]} ${T.rules.custom}`;
    return `${game} ${T.rules[round.mode === 'fix' ? 'fix' : 'judge']}`;
  }

  function facesText(device, faces) {
    if (device.startsWith('coin')) return faces.map((face) => T.faceNames[face]).join(', ');
    return faces.map((face) => fill(T.labels.die, { k: face })).join(', ');
  }

  /** 표의 칸을 읽어 주는 글: 면이나 눈, 보는 값, 가져가는 쪽 */
  const cellLabel = (rule) => (faces, value, owner) => {
    const sides = rule.device === 'coin2' || rule.device === 'die2';
    const what = sides
      ? `${fill(T.labels.left, { face: facesText(rule.device, [faces[0]]) })}, ${fill(T.labels.right, { face: facesText(rule.device, [faces[1]]) })}`
      : facesText(rule.device, faces);
    const shown = rule.device === 'die2' ? `${what}, ${T.measures[rule.measure]} ${valueText(value)}` : what;
    return fill(T.labels.cell, { face: shown, f: T.names[owner] });
  };

  /** 규칙의 칸들 */
  function chipsView(rule, { onChip = null, changed = null } = {}) {
    const values = valuesOf(rule.device, rule.measure);
    return {
      head: T.measures[rule.measure],
      onChip,
      chips: values.map((value) => {
        const owner = rule.a.includes(value) ? 'a' : 'b';
        const face = `${T.measures[rule.measure]} ${valueText(value)}`;
        return { value, text: valueText(value), owner, changed: value === changed, label: fill(T.labels[onChip ? 'chip-fix' : 'chip'], { face, f: T.names[owner] }) };
      }),
    };
  }

  /** 표의 값 */
  function tableView(rule, { changed = null, counted = true } = {}) {
    const result = countCases(rule);
    return {
      rule,
      valueText,
      faceText: T.faces,
      names: T.names,
      labels: { cell: cellLabel(rule), table: T.labels.table },
      caption: T.table[rule.device],
      count: counted ? fill(T.table.count, { total: result.total, k: result.a, n: result.b }) : '',
      changed,
    };
  }

  const playedThrows = (round) => throwsFor(round.board, round.played);
  const playTally = (round) => tallyOf(round.board.rule, playedThrows(round));

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    const rule = currentRule(round);
    const judge = round.mode === 'judge';
    const throws = playedThrows(round);
    const owners = throws.map((faces) => ownerOf(rule, faces));
    const last = throws.at(-1) ?? null;
    const lastOwner = last ? owners.at(-1) : null;
    const many = round.presses > 0 ? manyTally(board, rule, round.presses) : null;
    drawBoard($('fair-board'), {
      rule,
      label: T.labels.board,
      page: round.tableOn ? 'table' : 'game',
      chipsView: chipsView(rule, { onChip: round.mode === 'fix' && playing ? tapChip : null, changed: round.change }),
      table: tableView(rule, { changed: round.change }),
      game: {
        last,
        lastOwner,
        lastLabel: last ? fill(T.labels.throw, { face: facesText(rule.device, last), f: T.names[lastOwner] }) : '',
        lastValue: last && rule.device === 'die2' ? `${T.measures[rule.measure]} ${valueText(measureOf(rule.measure, last))}` : '',
        rolling,
        plays: owners,
        playsMax: judge ? PLAYS : 0,
        playsLabel: fill(T.labels.plays, { k: round.played }),
        many,
        manyLine: many ? fill(T.many, { total: big(many.total) }) : '',
        names: T.names,
        faceText: T.faces,
      },
    });
    rolling = false;

    // 판 아래: 할 일이나 사실 한 줄, 던진 수와 가져간 수
    const tally = tallyOf(rule, throws);
    $('fair-status').textContent = flash ?? statusOf(round, playing, lastOwner);
    $('fair-numbers').hidden = !judge;
    $('fair-played').textContent = String(round.played);
    $('fair-a').textContent = String(tally.a);
    $('fair-b').textContent = String(tally.b);

    // 오른쪽 칸
    const guessed = round.guess !== null;
    $('fair-guess-box').hidden = !(judge && !guessed);
    $('fair-guessed').hidden = !(judge && guessed);
    if (guessed) $('fair-guessed').textContent = fill(T.guessed, { face: T.choices[round.guess] });
    $('fair-throw-box').hidden = !(judge && guessed);
    $('fair-throw').disabled = !playing || round.played >= PLAYS;
    $('fair-many-box').hidden = judge && !guessed;
    $('fair-many').textContent = T.buttons[round.presses === 0 ? 'many-first' : 'many-more'];
    $('fair-many').disabled = !playing || round.presses >= MAX_MANY;
    $('fair-answer-box').hidden = !(judge && guessed);
    for (const button of $('fair-answers').querySelectorAll('button')) button.disabled = !playing;
    $('fair-fix-box').hidden = judge;
    $('fair-submit').disabled = !playing;
    $('fair-note').hidden = !T.notes[rule.measure];
    $('fair-note').textContent = T.notes[rule.measure] ?? '';

    // 왼쪽 칸의 표 도구: 짐작을 고른 뒤에(고치기 판은 처음부터) 쓸 수 있다
    $('fair-table').setAttribute('aria-pressed', String(round.tableOn));
    $('fair-table').disabled = judge && !guessed;

    // 끝난 뒤: 도전 판은 까닭을 적는 칸을 "같은 단계 새 판" 앞에 둔다
    const reason = round.done && round.outcome === 'solved' && !round.side && rungOf(round.level)?.tag === 'challenge' && !round.custom;
    $('fair-reason-box').hidden = !reason;
    if (reason) {
      $('after-same').before($('fair-reason-box'));
      if ($('fair-reason').value !== round.reason) $('fair-reason').value = round.reason;
    }
    frame.showWhy();
  }

  function statusOf(round, playing, lastOwner) {
    if (!playing) return '';
    if (round.tableOn) return T.status.table;
    if (round.mode === 'fix') return round.change === null ? T.status.fix : T.status.changed;
    if (round.guess === null) return T.status.guess;
    if (round.played >= PLAYS) return T.status.played;
    if (lastOwner) return T.status[`went-${lastOwner}`];
    return T.status.play;
  }

  // ---- 짐작, 던지기, 컴퓨터가 많이 던지기, 표 ----
  /** 처음 짐작: 적어 두기만 한다(맞다 틀리다 하지 않는다) */
  function guess(choice) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'judge' || round.guess !== null || !CHOICES.includes(choice)) return;
    round.guess = choice;
    round.guessAt = frame.stamp();
    flash = null;
    frame.note('guess', { choice });
    draw();
    frame.persist();
    frame.say(T.play.guessed);
    $('fair-throw').focus();
  }

  function throwOne() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'judge' || round.guess === null || round.played >= PLAYS) return;
    round.played += 1;
    round.moveCount += 1;
    flash = null;
    rolling = true;
    const faces = throwsFor(round.board, round.played).at(-1);
    frame.note('throw', { faces, owner: ownerOf(round.board.rule, faces) });
    draw();
    frame.persist();
    const tally = playTally(round);
    if (round.played === PLAYS) {
      told = false;
      frame.say(fill(T.play.played, { k: tally.a, n: tally.b }));
    } else if (told) {
      // 앞의 말(고른 답에 대한 말)은 이제 맞지 않을 수 있으니 덮는다
      told = false;
      frame.say(fill(T.play.now, { k: tally.a, n: tally.b }));
    }
  }

  function throwMany() {
    const { round } = frame;
    if (!round || round.done || round.presses >= MAX_MANY) return;
    if (round.mode === 'judge' && round.guess === null) return;
    round.presses += 1;
    round.manyCount += 1;
    round.moveCount += 1;
    flash = null;
    told = false;
    frame.note('many', { presses: round.presses, change: round.change });
    draw();
    frame.persist();
    const many = manyTally(round.board, currentRule(round), round.presses);
    frame.say(fill(T.play.many, { total: big(many.total), k: big(many.a), n: big(many.b) }));
  }

  function toggleTable() {
    const { round } = frame;
    if (!round || (round.mode === 'judge' && round.guess === null)) return;
    round.tableOn = !round.tableOn;
    if (round.tableOn) round.tableCount += 1;
    const first = round.tableOn && !round.tableShown;
    if (round.tableOn) round.tableShown = true;
    flash = null;
    frame.note('table', { on: round.tableOn });
    draw();
    frame.keep();
    if (first && !round.done) frame.say(T.play.table);
  }

  // ---- 답 ----
  function answer(choice) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'judge' || round.guess === null || !CHOICES.includes(choice)) return;
    const result = countCases(round.board.rule);
    const correct = result.verdict === choice;
    const again = round.tries.includes(choice);
    round.answers.push({ t: frame.stamp(), answer: choice, correct, guess: correct ? null : guessOf(round, choice) });
    frame.note('answer', { answer: choice, correct });
    flash = null;
    if (correct) {
      frame.finish('solved');
      return;
    }
    round.wrongCount += 1;
    if (!again) round.tries = [...round.tries, choice].slice(-MAX_TRIES);
    const line = nextLine(round, 'judge');
    draw();
    frame.persist();
    told = true;
    const parts = [];
    if (again) parts.push(T.play['same-again']);
    else {
      const why = guessOf(round, choice);
      if (why) parts.push(T.play[`guess-${why}`]);
    }
    parts.push(line);
    frame.say(parts.join(' '));
  }

  /**
   * 고른 답이 판정과 다를 때의 짐작:
   *   unordered  순서만 바뀐 경우를 한 가지로 세면 그 답이 된다(둘 이상 던지는 판)
   *   few-a, few-b, few-even  아이가 던진 번(다섯 번 이상)이 그 답처럼 보인다
   */
  function guessOf(round, choice) {
    const { rule } = round.board;
    if (rule.device !== 'die1' && unorderedCount(rule).verdict === choice) return 'unordered';
    if (round.played < 5) return null;
    const tally = playTally(round);
    if (choice === 'fair' && Math.abs(tally.a - tally.b) <= 1) return 'few-even';
    if (choice === 'a' && tally.a > tally.b) return 'few-a';
    if (choice === 'b' && tally.b > tally.a) return 'few-b';
    return null;
  }

  /**
   * 답이 판정과 다를 때의 사실 하나와 할 수 있는 일: 표를 켜 두었으면 표에서 세어 볼 수 있다는 말,
   * 아니면 컴퓨터가 던진 수(아직 안 던졌으면 컴퓨터가 지금 1,000번 던진다. 판에 막대가 나온다)와 모든 경우를 세어 볼 수 있다는 말
   */
  function nextLine(round, kind) {
    if (round.tableOn) return T.play['wrong-table'];
    if (round.presses === 0) {
      round.presses = 1;
      round.manyCount += 1;
      frame.note('many', { presses: round.presses, change: round.change, auto: true });
    }
    const many = manyTally(round.board, currentRule(round), round.presses);
    return fill(T.play[kind === 'fix' ? 'fix-wrong-many' : 'wrong-many'], { total: big(many.total), k: big(many.a), n: big(many.b) });
  }

  // ---- 규칙 고치기 ----
  function tapChip(value) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'fix') return;
    const before = round.change;
    if (before === value) {
      round.change = null;
      flash = T.status.back;
    } else {
      round.change = value;
      flash = before === null ? null : T.status.moved;
    }
    // 컴퓨터가 던진 수는 그 규칙의 것이라 규칙이 바뀌면 다시 센다
    round.presses = 0;
    round.changeCount += 1;
    round.moveCount += 1;
    frame.note('change', { value, on: round.change !== null });
    draw();
    frame.persist();
    if (told) {
      told = false;
      frame.say(T.play.changed);
    }
  }

  function submit() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'fix') return;
    if (round.change === null) {
      flash = T.status['no-change'];
      draw();
      return;
    }
    const rule = currentRule(round);
    const result = countCases(rule);
    const correct = result.verdict === 'fair';
    const key = String(round.change);
    const again = round.tries.includes(key);
    round.submitCount += 1;
    round.answers.push({ t: frame.stamp(), answer: `fix:${key}`, correct, guess: null });
    frame.note('answer', { answer: `fix:${key}`, correct });
    flash = null;
    if (correct) {
      frame.finish('solved');
      return;
    }
    round.wrongCount += 1;
    if (!again) round.tries = [...round.tries, key].slice(-MAX_TRIES);
    const line = nextLine(round, 'fix');
    draw();
    frame.persist();
    told = true;
    frame.say([...(again ? [T.play['fix-same-again']] : []), line].join(' '));
  }

  // ---- 끝났을 때 하는 말: 모든 경우를 센 수 ----
  function whyJustOpened(round) {
    const records = frame.records();
    return whyUnlocked(records, FORMAT) && !whyUnlocked(records.filter((record) => record.id !== round.id), FORMAT);
  }

  function rightLine(round) {
    const parts = [];
    if (round.mode === 'fix') {
      const rule = currentRule(round);
      const result = countCases(rule);
      parts.push(fill(T.right.fix, { total: result.total, k: result.a }));
      const fixes = solve(round.board).fixes;
      parts.push(fixes.length === 1 ? T.right['fix-one'] : fill(T.right['fix-more'], { n: fixes.length }));
      if (!round.side && !round.custom && rungOf(round.level).tag === 'challenge') parts.push(T.right.reason);
    } else {
      const result = countCases(round.board.rule);
      parts.push(fill(T.right[result.verdict], { total: result.total, k: result.a, n: result.b }));
      const tally = playTally(round);
      if (round.played === PLAYS && lookOf(tally, result.verdict) === 'mislead') parts.push(fill(T.right.misled, { k: tally.a, n: tally.b }));
      if (round.guess !== null && round.guess !== result.verdict) parts.push(fill(T.right['guess-was'], { face: T.choices[round.guess] }));
    }
    if (!round.side && whyJustOpened(round)) parts.push(T.right['why-invite']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  function solutionPages(round, solution) {
    const { board } = round;
    if (round.mode === 'fix') {
      const value = solution.fixes[0];
      const rule = toggled(board.rule, value);
      const result = countCases(rule);
      const node = tableNode(tableView(rule, { changed: value }));
      const say = [fill(T.solution.fix, { k: result.a }), solution.fixes.length === 1 ? T.right['fix-one'] : fill(T.right['fix-more'], { n: solution.fixes.length })].join(' ');
      return [{ say, nodes: [rowOf([card(node, T.solution['note-fix'], { big: true })])] }];
    }
    const node = tableNode(tableView(board.rule));
    return [{ say: fill(T.solution.judge, { k: solution.a, n: solution.b }), nodes: [rowOf([card(node, T.solution.note, { big: true })])] }];
  }

  /** "왜 그럴까?"의 그림 하나: 합마다의 막대, 또는 모든 경우의 표 */
  function figureNode(item, big) {
    if (item.kind === 'bars') return card(sumBarsNode(sumBars(item.n, item.seed)), item.note, { big });
    const rule = { device: item.device, measure: item.measure, a: item.a };
    return card(tableNode({ ...tableView(rule, { counted: false }), caption: '' }), item.note, { big });
  }

  /** "왜 그럴까?": 합이 고르게 나오지 않는다 → 36칸의 표 → 고르게 나오는 칸으로 세기(이름) → 가장 잘 나오는 합이라도 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다
      get nodes() {
        return [rowOf(slide.figures.map((item) => figureNode(item, slide.figures.length === 1)))];
      },
    }));
  }

  // ---- 직접 만들기: 던질 것과 볼 것을 고르고, 칸을 눌러 누가 가져갈지 정한다. 선생님이 모든 경우를 센다 ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    return saved && checkRule(saved) === null ? tidyRule(saved) : { ...FIRST_DRAFT, a: FIRST_DRAFT.a.slice() };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    asked = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    for (const button of $('fair-make-devices').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.device === draft.device));
    const measures = MEASURES[draft.device];
    const box = $('fair-make-measures');
    box.replaceChildren(
      ...measures.map((measure) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn';
        button.dataset.measure = measure;
        button.textContent = T.make.measures[measure];
        button.setAttribute('aria-pressed', String(measure === draft.measure));
        return button;
      }),
    );
    drawBoard($('fair-make-board'), {
      rule: draft,
      label: T.labels.board,
      page: 'table',
      chipsView: chipsView(draft, { onChip: tapMadeChip }),
      table: { ...tableView(draft, { counted: false }), caption: '' },
    });
    $('fair-make-result').textContent = asked ?? '';
  }

  function changeDraft(next) {
    draft = tidyRule(next);
    asked = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  function tapMadeChip(value) {
    changeDraft(toggled(draft, value));
  }

  function setDevice(device) {
    if (!DEVICE_IDS.includes(device) || device === draft.device) return;
    const measure = MEASURES[device][0];
    const values = valuesOf(device, measure);
    changeDraft({ device, measure, a: [values[0]] });
  }

  function setMeasure(measure) {
    if (!MEASURES[draft.device].includes(measure) || measure === draft.measure) return;
    const values = valuesOf(draft.device, measure);
    changeDraft({ device: draft.device, measure, a: [values[0]] });
  }

  /** 두 쪽 모두 가져가는 경우가 있는가 */
  const bothSides = (rule) => {
    const result = countCases(rule);
    return result.a > 0 && result.b > 0;
  };

  /** 다 만든 판(해 보기와 공책에 남기기에 쓴다). 한쪽만 가져가는 규칙이면 null */
  function madeBoard() {
    if (!draft || checkRule(draft) !== null || !bothSides(draft)) return null;
    const rule = tidyRule(draft);
    const seeds = pickSeeds(rule, `made|${ruleKey(rule)}`, 'any');
    return { mode: 'judge', rule, name: null, throws: seeds.throws, many: seeds.many };
  }

  function solveDraft() {
    const result = countCases(draft);
    const line = fill(T.make[result.verdict], { total: result.total, k: result.a, n: result.b });
    asked = line;
    drawMake();
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board: { mode: 'judge', rule: tidyRule(draft), name: null },
      solution: { possible: true, total: result.total, a: result.a, b: result.b, verdict: result.verdict },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  function playDraft() {
    const board = madeBoard();
    if (!board) {
      frame.talkers.make.say(T.make['one-side']);
      return;
    }
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('fair-guesses').addEventListener('click', (event) => {
    const choice = event.target.closest('button')?.dataset.choice;
    if (choice) guess(choice);
  });
  $('fair-answers').addEventListener('click', (event) => {
    const choice = event.target.closest('button')?.dataset.choice;
    if (choice) answer(choice);
  });
  $('fair-throw').addEventListener('click', throwOne);
  $('fair-many').addEventListener('click', throwMany);
  $('fair-submit').addEventListener('click', submit);
  $('fair-table').addEventListener('click', toggleTable);
  $('fair-reason').addEventListener('change', () => {
    const { round } = frame;
    if (!round || round.format !== FORMAT || !round.done) return;
    round.reason = $('fair-reason').value.trim().slice(0, MAX_REASON);
    frame.note('reason', { length: round.reason.length });
    frame.keep();
  });
  $('fair-make-devices').addEventListener('click', (event) => {
    const device = event.target.closest('button')?.dataset.device;
    if (device) setDevice(device);
  });
  $('fair-make-measures').addEventListener('click', (event) => {
    const measure = event.target.closest('button')?.dataset.measure;
    if (measure) setMeasure(measure);
  });
  $('fair-make-solve').addEventListener('click', solveDraft);
  $('fair-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ board }) {
    const start = copyBoard(board);
    return {
      mode: start.mode,
      board: start, // 판: 규칙(던지는 것, 보는 것, 다람쥐가 가져가는 값), 규칙 이름, 아이가 던질 열 번과 컴퓨터의 1,000번의 시드
      guess: null, // 처음 짐작(공정한지 고르기 판). 맞다 틀리다 하지 않는다
      guessAt: null, // 짐작을 고른 때(초)
      played: 0, // 아이가 던진 수(열 번까지)
      presses: 0, // 지금 규칙으로 컴퓨터에게 1,000번씩 던지게 한 수(규칙 고치기에서 규칙을 바꾸면 0으로)
      manyCount: 0, // 컴퓨터에게 던지게 한 모든 수
      tableOn: false, // 지금 모든 경우의 표를 보고 있는가
      tableShown: false, // 한 번이라도 켰는가
      tableCount: 0, // 켠 수
      change: null, // 규칙 고치기에서 다른 쪽으로 옮긴 값(한 군데만)
      changeCount: 0, // 칸을 누른 수
      submitCount: 0, // "이렇게 바꿀래요"를 누른 수
      tries: [], // 판정과 다르던 답(같은 답은 한 번)
      wrongCount: 0, // 판정과 다르던 답의 수. 수준 맞추기가 "한 번에"를 본다
      moveCount: 0, // 던지기, 컴퓨터에게 던지게 하기, 칸 바꾸기의 수
      reason: '', // 끝난 뒤 적은 까닭(도전 판. 안 써도 된다)
    };
  }

  const sampleView = (board, plays = []) => ({
    device: board.rule.device,
    owners: valuesOf(board.rule.device, board.rule.measure).map((value) => (board.rule.a.includes(value) ? 'a' : 'b')),
    faces: SAMPLE_FACES[board.rule.device],
    faceText: T.faces,
    plays,
  });

  return {
    id: FORMAT,
    T,
    padId: 'fair-pad',
    makeId: 'make-fair',
    // 판이 위아래로 길다(규칙의 칸, 던진 것, 열 번, 막대 또는 표). 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다
    ruleAside: true,
    homeIds: { sample: 'home-fair-sample', blank: 'home-fair-blank', ask: 'home-fair-ask', play: 'home-fair-play', pick: 'home-fair-pick', make: 'home-fair-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solve(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null || saved.board.mode !== saved.mode) return false;
      if (saved.guess !== null && !CHOICES.includes(saved.guess)) return false;
      if (saved.mode === 'fix' && saved.guess !== null) return false;
      if (!(count(saved.played) && saved.played <= PLAYS) || !(count(saved.presses) && saved.presses <= MAX_MANY)) return false;
      if (saved.change !== null && !(saved.mode === 'fix' && valuesOf(saved.board.rule.device, saved.board.rule.measure).includes(saved.change))) return false;
      if (!Array.isArray(saved.tries) || !saved.tries.every((item) => typeof item === 'string')) return false;
      if (typeof saved.tableOn !== 'boolean' || typeof saved.tableShown !== 'boolean' || typeof saved.reason !== 'string') return false;
      return [saved.manyCount, saved.tableCount, saved.changeCount, saved.submitCount, saved.wrongCount, saved.moveCount].every(count);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 표 도구, 끝난 뒤의 까닭 칸)을 보이거나 감춘다. 무르기와 되돌리기는 쓰지 않는다 */
    showParts(on) {
      $('fair-board').hidden = !on;
      $('fair-count').hidden = !on;
      $('fair-table').hidden = !on;
      if (on) {
        $('undo').hidden = true;
        $('reset').hidden = true;
      } else $('fair-reason-box').hidden = true;
    },
    enter() {
      flash = null;
      rolling = false;
      told = false;
      $('fair-reason').value = '';
    },
    draw,
    ended() {
      flash = null;
      rolling = false;
      told = false;
    },
    ruleLine,
    hints: (round) => T.hints[hintKey(round)],
    touched: (round) => round.guess !== null || round.moveCount > 0 || round.tableShown,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view: (round) => ({ guess: round.guess, played: round.played, tally: playTally(round), presses: round.presses, table: round.tableOn, change: round.change, tries: round.tries.length }),
    /** 이 판보다 작은 판: 경우가 더 적은 던지는 것의 판 */
    smaller: (round, turn) => smallerFair({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const rule = currentRule(round);
      const now = countCases(rule);
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        // 모든 경우를 센 수와 판정, 순서 없이 센 판정, 고칠 수 있는 곳
        solution: { possible: true, total: solution.total, a: solution.a, b: solution.b, verdict: solution.verdict, unordered: solution.unordered, fixes: solution.fixes },
        // 처음 짐작과, 그것이 판정과 같았는가(화면에는 알리지 않는다)
        guess: round.guess,
        guessAt: round.guessAt,
        guessMatched: round.guess === null ? null : round.guess === solution.verdict,
        // 아이가 던진 번과 그 결과, 그것이 헷갈리게 나왔는가
        played: round.played,
        playTally: playTally(round),
        playLook: round.played === PLAYS ? lookOf(playTally(round), solution.verdict) : null,
        // 컴퓨터에게 던지게 한 것(지금 규칙의 결과)
        presses: round.presses,
        manyCount: round.manyCount,
        manyTally: round.presses > 0 ? manyTally(round.board, rule, round.presses) : null,
        tableShown: round.tableShown,
        tableCount: round.tableCount,
        // 규칙 고치기: 옮긴 값과 그 규칙을 센 수
        change: round.change,
        changed: round.mode === 'fix' ? { a: now.a, b: now.b, verdict: now.verdict } : null,
        changeCount: round.changeCount,
        submitCount: round.submitCount,
        tries: round.tries,
        // 수준 맞추기가 보는 "틀린 답"의 수
        wrongCount: round.wrongCount,
        moveCount: round.moveCount,
        // 끝난 뒤 적은 까닭(도전 판)
        reason: round.reason,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo() {},
    reset() {},
    /** 글자판: 단추는 저마다 Enter와 빈칸 글쇠로 누른다. 까닭 칸에 쓰는 글자는 받지 않는다 */
    onKey() {},

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).hint],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawMini(root, sampleView(board));
    },
    drawBlank(root) {
      drawMini(root, { device: 'die2', owners: null, faces: SAMPLE_FACES.die2, faceText: T.faces });
    },
    /** 하던 판과 공책의 그림: 규칙의 칸과 던진 번 */
    drawResume(root, saved) {
      const plays = Number.isInteger(saved.played) && saved.played <= PLAYS ? throwsFor(saved.board, saved.played).map((faces) => ownerOf(saved.board.rule, faces)) : [];
      const rule = saved.mode === 'fix' && saved.change !== null && saved.change !== undefined ? toggled(saved.board.rule, saved.change) : saved.board.rule;
      drawMini(root, sampleView({ ...saved.board, rule }, plays));
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawMini(root, { device: 'die2', owners: null, faces: SAMPLE_FACES.die2, faceText: T.faces });
        return;
      }
      drawMini(root, sampleView(generateBoard(entry.level, entry.picture.seed).board));
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
  };
}

