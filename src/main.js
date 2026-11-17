// 퍼즐 연구소: 처음 만남, 처음 화면(연구소), 판 화면, 직접 만들기 화면.
// 화면에 나오는 글은 모두 대본(src/content/coins.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
// 지키는 것: 보상과 성적 표시를 두지 않는다. 시간은 기록만 하고 보여 주지 않는다. 아이가 누를 때까지 기다린다.
import './app.css';
import T from './content/coins.json';
import look from './content/teacher-look.json';
import teacherData from './content/teacher.json';
import { MAX_COINS, RULES, applyMove, checkBoard, diagnose, headCount, isMove, selectable, solve } from './core/coins.js';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from './core/ladder.js';
import { recommend, whyUnlocked } from './core/level.js';
import { fill } from './core/text.js';
import { drawCoins, drawStrip } from './ui/coin-board.js';
import * as log from './ui/log.js';
import { reloadIfWaiting, setupOffline } from './ui/offline.js';
import { setMuted, stopSpeaking, voicesReady } from './ui/speech.js';
import { createTalker } from './ui/talker.js';
import { createTeacher } from './ui/teacher-view.js';

const FORMAT = 'coins';
const MIN_MAKE_COINS = 3;
const MAX_ANSWER_DIGITS = 2;
const $ = (id) => document.getElementById(id);

// ---- 선생님 ----
const voice = teacherData.voice;
const talkers = {
  meet: createTalker({ teacher: createTeacher($('meet-teacher'), look, { unit: 2.5 }), caption: $('meet-caption'), voice }),
  home: createTalker({ teacher: createTeacher($('home-teacher'), look, { unit: 2.5 }), caption: $('home-caption'), voice }),
  play: createTalker({ teacher: createTeacher($('teacher'), look, { unit: 2.5 }), caption: $('caption'), voice }),
  make: createTalker({ teacher: createTeacher($('make-teacher'), look, { unit: 2.5 }), caption: $('make-caption'), voice }),
};

// ---- 상태 ----
let screen = 'home';
let round = null; // 지금 하는 판
let solution = null; // 그 판을 풀이 프로그램으로 푼 결과(저장하지 않고 늘 다시 푼다)
let selected = []; // 고른 동전
let typed = ''; // 숫자판에 넣은 글자
let clockSince = null; // 시계가 가는 중이면 시작한 때
let sheet = null; // 판 위에 겹쳐 보여 주는 풀이나 설명
let draft = null; // 직접 만들기에서 만들던 판
let meet = null; // 처음 만남에서 하는 중인 것
let homeNext = null; // 처음 화면에 그려 둔 판. "해 보기"를 누르면 이 판이 열린다

const ruleKey = (board) => (board.rule === 'adj3' ? `adj3-${board.shape}` : board.rule);
const coinLabel = (index, heads) => fill(T.coinLabel, { no: index + 1, face: heads ? T.faces.heads : T.faces.tails });
const toCoins = (text) => [...text].map((ch) => (ch === '1' ? 1 : 0));
const blankFaces = { heads: T.blank, tails: T.blank };

function setScreen(name) {
  screen = name;
  stopSpeaking();
  for (const talker of Object.values(talkers)) talker.hush();
  for (const id of ['meet', 'home', 'play', 'make']) $(id).hidden = id !== name;
}

// ---- 시계: 판 화면이 보이는 동안만 간다. 기록만 하고 화면에는 보여 주지 않는다. ----
function startClock() {
  if (round && !round.done && clockSince === null) clockSince = performance.now();
}
function stopClock() {
  if (round && clockSince !== null) round.elapsed += (performance.now() - clockSince) / 1000;
  clockSince = null;
}
const elapsed = () => (round ? round.elapsed + (clockSince === null ? 0 : (performance.now() - clockSince) / 1000) : 0);
const stamp = () => Math.round(elapsed() * 10) / 10;

function note(type, data = {}) {
  round.events.push({ t: stamp(), type, ...data });
}

// ---- 기록 ----
function toRecord(outcome) {
  return {
    kind: 'round',
    v: 1,
    id: round.id,
    format: FORMAT,
    level: round.level,
    seed: round.seed,
    small: round.small,
    custom: round.custom,
    startedAt: round.startedAt,
    endedAt: round.endedAt ?? new Date().toISOString(),
    board: { n: round.board.n, shape: round.board.shape, rule: round.board.rule, coins: round.board.coins.join('') },
    solution: { possible: solution.possible, min: solution.min },
    events: round.events,
    flipCount: round.flipCount,
    undoCount: round.undoCount,
    resetCount: round.resetCount,
    hintsOpened: round.hintsOpened,
    answers: round.answers,
    seconds: stamp(),
    outcome,
    quit: outcome !== 'solved',
    viewedSolution: round.viewedSolution,
    viewedWhy: round.viewedWhy,
    after: round.after,
    feeling: round.feeling,
    offeredHarder: round.offeredHarder,
    resumes: round.resumes,
  };
}

/** 하던 판을 기기에 적어 둔다. 껐다 켜도 그대로 이어서 할 수 있다. */
function persist() {
  if (!round) return;
  if (round.done) log.clearCurrent();
  else log.saveCurrent({ ...round, elapsed: elapsed() });
}

/** 기기에 적어 둔 하던 판을 읽는다. 없거나 깨졌으면 null. */
function readCurrent() {
  const saved = log.loadCurrent();
  if (!saved) return null;
  try {
    const ok =
      saved.done !== true &&
      checkBoard(saved.board) === null &&
      checkBoard({ ...saved.board, coins: saved.coins }) === null &&
      Array.isArray(saved.trail) &&
      saved.trail.every((move) => Array.isArray(move) && isMove(saved.board, move)) &&
      Array.isArray(saved.events) &&
      Array.isArray(saved.answers) &&
      typeof saved.id === 'string' &&
      Number.isFinite(saved.elapsed);
    if (ok) return saved;
  } catch {
    // 깨진 값은 없는 것으로 본다.
  }
  log.clearCurrent();
  return null;
}

// ---- 처음 만남: 앱을 처음 열 때 한 번. 네 개는 되고 다섯 개는 안 되는 것을 직접 겪는다. 까닭은 말해 주지 않는다. ----
const MEET = { rule: 'any2', shape: 'line', first: 4, second: 5, cannotAfter: 2, oddAfter: 3 };

const meetPlaying = () => meet.step === 'first' || meet.step === 'second';
const meetStamp = () => Math.round((performance.now() - meet.since) / 100) / 10;

function meetNote(type, data = {}) {
  meet.events.push({ t: meetStamp(), type, ...data });
}

function showMeet(replay = false) {
  setScreen('meet');
  round = null;
  solution = null;
  meet = {
    id: log.newId('i'),
    startedAt: new Date().toISOString(),
    since: performance.now(),
    replay,
    step: 'first', // 'first'(네 개) → 'first-done' → 'second'(다섯 개) → 'reveal'
    coins: Array(MEET.first).fill(1),
    selected: [],
    sinceReset: 0,
    counts: { first: 0, second: 0, resets: 0 },
    events: [],
  };
  drawMeet();
  talkers.meet.say(T.meet.start);
}

function drawMeet(flipped = []) {
  drawCoins($('meet-board'), {
    coins: meet.coins,
    shape: MEET.shape,
    faces: T.faces,
    label: coinLabel,
    onTap: meetPlaying() ? tapMeet : undefined,
    selected: meet.selected,
    flipped,
  });
  $('meet-reset').disabled = !meetPlaying() || meet.sinceReset === 0;
  $('meet-more').hidden = meet.step !== 'first-done';
  // 몇 번 해 본 뒤에야 "안 되는 것 같아요"가 나온다. 해 보지 않고 누르지 않게 한다.
  $('meet-cannot').hidden = !(meet.step === 'second' && meet.counts.second >= MEET.cannotAfter);
  $('meet-enter').hidden = meet.step !== 'reveal';
}

function tapMeet(index) {
  if (!meetPlaying()) return;
  if (meet.selected.includes(index)) meet.selected = meet.selected.filter((item) => item !== index);
  else meet.selected = [...meet.selected, index];
  if (meet.selected.length < RULES[MEET.rule].count) {
    drawMeet();
    return;
  }
  const move = meet.selected.slice().sort((x, y) => x - y);
  meet.selected = [];
  meet.coins = applyMove(meet.coins, move);
  meet.sinceReset += 1;
  meet.counts[meet.step] += 1;
  meetNote('flip', { coins: move });
  if (meet.step === 'first') {
    if (headCount(meet.coins) === 0) {
      meet.step = 'first-done';
      meetNote('first-done');
      talkers.meet.say(T.meet.fourDone);
    } else if (meet.counts.first === 1) talkers.meet.say(T.meet.flipped);
  } else if (meet.counts.second === MEET.oddAfter) talkers.meet.say(T.meet.odd);
  drawMeet(move);
}

function meetReset() {
  if (!meetPlaying() || meet.sinceReset === 0) return;
  meet.coins = Array(meet.step === 'first' ? MEET.first : MEET.second).fill(1);
  meet.selected = [];
  meet.sinceReset = 0;
  meet.counts.resets += 1;
  meetNote('reset');
  drawMeet();
}

function meetMore() {
  if (meet.step !== 'first-done') return;
  meet.step = 'second';
  meet.coins = Array(MEET.second).fill(1);
  meet.selected = [];
  meet.sinceReset = 0;
  meetNote('second');
  drawMeet([MEET.second - 1]);
  talkers.meet.say(T.meet.five);
}

function meetCannot() {
  if (meet.step !== 'second') return;
  meet.step = 'reveal';
  meet.selected = [];
  meetNote('cannot');
  drawMeet();
  talkers.meet.say(T.meet.reveal);
}

/** 처음 만남을 끝낸다. outcome: 'entered'(끝까지 보고 들어감) | 'skipped'(건너뜀) */
function leaveMeet(outcome) {
  meetNote(outcome);
  log.saveRecord({
    kind: 'meet',
    v: 1,
    id: meet.id,
    format: FORMAT,
    startedAt: meet.startedAt,
    endedAt: new Date().toISOString(),
    replay: meet.replay,
    reached: meet.step,
    events: meet.events,
    flipsFirst: meet.counts.first,
    flipsSecond: meet.counts.second,
    resetCount: meet.counts.resets,
    seconds: meetStamp(),
    outcome,
  });
  log.savePrefs({ ...log.loadPrefs(), met: true });
  log.flush();
  meet = null;
  showHome();
}

// ---- 처음 화면(연구소): 두 문(퍼즐 풀기, 퍼즐 만들기)과 하던 판. 단계 목록은 "판 고르기" 뒤에 있다. ----
function showHome() {
  setScreen('home');
  if (reloadIfWaiting()) return;
  round = null;
  solution = null;
  const prefs = log.loadPrefs();
  if (!prefs.met) {
    showMeet();
    return;
  }

  // "해 보기"로 열릴 판을 미리 만들어 그대로 보여 준다. 수준 맞추기가 권하는 단계의 다음 판이다.
  const advice = recommend(log.allRecords(), FORMAT);
  const made = generateBoard(advice.level, pickSeed(advice.level, advice.small), { small: advice.small });
  homeNext = { level: advice.level, seed: made.seed, small: advice.small, custom: false, board: made.board };
  drawCoins($('home-sample'), { coins: made.board.coins, shape: made.board.shape, faces: T.faces });
  const blank = T.levels.find((entry) => entry.picture.blank).picture;
  drawCoins($('home-blank'), { coins: toCoins(blank.coins), faces: blankFaces });

  const current = showDoors();
  talkers.home.say(!prefs.visited ? T.home.first : current ? T.home.resume : T.home.again);
  if (!prefs.visited) log.savePrefs({ ...prefs, visited: true });
}

/** 두 문과 하던 판을 보여 준다. 하던 판이 있으면 그 판을 돌려준다. */
function showDoors() {
  const current = readCurrent();
  $('doors').hidden = false;
  $('picker').hidden = true;
  $('resume').hidden = !current;
  if (current) drawCoins($('resume-board'), { coins: current.coins, shape: current.board.shape, faces: T.faces, small: true });
  return current;
}

/** 판 고르기: 단계마다 그림 한 장. 테두리가 있는 동전들이 한 번에 함께 뒤집히는 동전이다. */
function showPicker() {
  const advice = recommend(log.allRecords(), FORMAT);
  const items = LADDER.map((rung) => {
    const entry = T.levels.find((item) => item.level === rung.level);
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'level';
    const add = (className, text) => {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      button.append(span);
    };
    add('level-no', fill(T.levelNo, { level: rung.level }));
    const picture = document.createElement('span');
    picture.className = 'level-picture';
    const coins = document.createElement('span');
    picture.append(coins);
    button.append(picture);
    drawCoins(coins, {
      coins: toCoins(entry.picture.coins),
      shape: entry.picture.shape ?? 'line',
      faces: entry.picture.blank ? blankFaces : T.faces,
      mark: entry.picture.mark ?? [],
      small: true,
    });
    add('level-name', entry.name);
    add(`level-tag tag-${rung.tag}`, T.tags[rung.tag]);
    if (rung.level === advice.level) {
      button.classList.add('recommended');
      add('level-mark', T.recommendMark);
    }
    button.addEventListener('click', () => startLevel(rung.level));
    item.append(button);
    return item;
  });
  $('levels').replaceChildren(...items);
  $('doors').hidden = true;
  $('resume').hidden = true;
  $('picker').hidden = false;
  talkers.home.say(T.home.pick);
}

/** 그 단계에서 다음에 낼 판 번호. 기록에 남은 가장 큰 번호의 다음이다(방금 한 판과 같은 판은 건너뛴다). */
function pickSeed(level, small) {
  const seeds = log
    .allRecords()
    .filter((record) => record.kind === 'round' && record.format === FORMAT && record.level === level && !record.custom && Number.isInteger(record.seed))
    .map((record) => record.seed);
  if (seeds.length === 0) return 1;
  return nextSeed(level, Math.max(...seeds), { small });
}

function startLevel(level) {
  if (level === MAKE_LEVEL) {
    showMake();
    return;
  }
  // 수준 맞추기가 "작은 판부터"라고 하면 조용히 따른다. 화면에는 알리지 않는다.
  const advice = recommend(log.allRecords(), FORMAT);
  const small = advice.small && advice.level === level;
  const made = generateBoard(level, pickSeed(level, small), { small });
  startRound({ level, seed: made.seed, small, custom: false, board: made.board });
}

function startRound({ level, seed, small, custom, board }) {
  round = {
    id: log.newId('r'),
    startedAt: new Date().toISOString(),
    endedAt: null,
    level,
    seed,
    small,
    custom,
    board: { n: board.n, shape: board.shape, rule: board.rule, coins: board.coins.slice() }, // 처음 모습
    coins: board.coins.slice(), // 지금 모습
    trail: [], // 처음 모습에서 지금까지의 뒤집기. 길이가 "뒤집은 횟수"다
    events: [],
    flipCount: 0,
    undoCount: 0,
    resetCount: 0,
    hintsOpened: 0,
    answers: [],
    elapsed: 0,
    done: false,
    outcome: null,
    viewedSolution: false,
    viewedWhy: false,
    after: null,
    feeling: null,
    offeredHarder: false,
    resumes: 0,
  };
  solution = solve(round.board);
  persist();
  showPlay(T.rules[ruleKey(round.board)]);
}

function resumeRound() {
  const saved = readCurrent();
  if (!saved) {
    showHome();
    return;
  }
  round = saved;
  solution = solve(round.board);
  round.resumes = (round.resumes ?? 0) + 1;
  showPlay(T.play.resume);
  note('resume');
  persist();
}

// ---- 판 화면 ----
function showPlay(line) {
  setScreen('play');
  selected = [];
  typed = '';
  closeSheet();
  $('where-title').textContent = round.custom ? T.customTitle : fill(T.levelTitle, { level: round.level, tag: T.tags[rungOf(round.level).tag] });
  $('rule').textContent = T.rules[ruleKey(round.board)];
  showPanel('pad');
  drawHints();
  drawBoard();
  drawPad();
  startClock();
  talkers.play.say(line);
}

/** 오른쪽 칸에 보여 줄 것: 'pad'(답 넣기), 'leave-ask'(나갈 때), 'after'(끝난 뒤) */
function showPanel(name) {
  for (const id of ['pad', 'leave-ask', 'after']) $(id).hidden = id !== name;
}

function whyAvailable() {
  if (!round || !T.why[ruleKey(round.board)]) return false;
  if (!whyUnlocked(log.allRecords(), FORMAT)) return false;
  // 해 본 뒤에만 연다: 이 판에서 한 번이라도 뒤집었거나, 답했거나, 판이 끝났을 때
  return round.done || round.flipCount > 0 || round.answers.length > 0;
}

function drawBoard(flipped = []) {
  const playing = !round.done;
  drawCoins($('board'), {
    coins: round.coins,
    shape: round.board.shape,
    faces: T.faces,
    label: coinLabel,
    onTap: playing ? tapCoin : undefined,
    selected,
    open: playing ? selectable(round.board, selected) : null,
    flipped,
  });
  $('count').textContent = String(round.trail.length);
  $('undo').disabled = !playing || round.trail.length === 0;
  $('reset').disabled = !playing || round.trail.length === 0;
  $('why').hidden = !whyAvailable();
}

function tapCoin(index) {
  if (round.done) return;
  if (selected.includes(index)) selected = selected.filter((item) => item !== index);
  else if (selectable(round.board, selected).includes(index)) selected = [...selected, index];
  if (selected.length === RULES[round.board.rule].count && isMove(round.board, selected)) {
    const move = selected.slice().sort((a, b) => a - b);
    selected = [];
    round.coins = applyMove(round.coins, move);
    round.trail.push(move);
    round.flipCount += 1;
    note('flip', { coins: move });
    drawBoard(move);
    persist();
    return;
  }
  drawBoard();
}

function undo() {
  if (round.done || round.trail.length === 0) return;
  const move = round.trail.pop();
  round.coins = applyMove(round.coins, move);
  round.undoCount += 1;
  selected = [];
  note('undo');
  drawBoard(move);
  persist();
}

function reset() {
  if (round.done || round.trail.length === 0) return;
  round.coins = round.board.coins.slice();
  round.trail = [];
  round.resetCount += 1;
  selected = [];
  note('reset');
  drawBoard();
  persist();
}

// ---- 힌트: 질문 한 문장씩. 다 열어도 풀이는 보이지 않는다. ----
function drawHints() {
  const list = T.hints[ruleKey(round.board)];
  const cards = list.slice(0, round.hintsOpened).map((text, index) => {
    const card = document.createElement('div');
    card.className = 'hint-card';
    const title = document.createElement('strong');
    title.textContent = fill(T.hintTitle, { no: index + 1 });
    const body = document.createElement('p');
    body.textContent = text;
    card.append(title, body);
    return card;
  });
  $('hints').replaceChildren(...cards);
  const left = list.length - round.hintsOpened;
  $('hint').textContent = left > 0 ? T.hintButton.more : T.hintButton.none;
  $('hint').disabled = left <= 0 || round.done;
}

function openHint() {
  const list = T.hints[ruleKey(round.board)];
  if (round.done || round.hintsOpened >= list.length) return;
  round.hintsOpened += 1;
  note('hint', { no: round.hintsOpened });
  drawHints();
  persist();
  talkers.play.say(list[round.hintsOpened - 1], 'point');
}

// ---- 답 넣기 ----
function drawPad() {
  $('answer-box').textContent = typed;
  $('submit').disabled = typed === '';
}

function pressKey(key) {
  if (round.done || $('pad').hidden) return;
  if (key === 'erase') typed = typed.slice(0, -1);
  else if (typed.length < MAX_ANSWER_DIGITS) typed = typed === '0' ? key : typed + key;
  drawPad();
}

function submit(answer) {
  if (round.done) return;
  const result = diagnose(solution, answer);
  const entry = { t: stamp(), answer: answer.kind === 'number' ? answer.value : 'impossible', correct: result.correct, guess: result.guess };
  round.answers.push(entry);
  note('answer', { answer: entry.answer, correct: entry.correct, guess: entry.guess });
  typed = '';
  drawPad();
  if (result.correct) {
    finish('solved');
    return;
  }
  // 틀린 답: 무엇을 놓쳤을지 짐작해서 말한다. 깎이는 것도, 채점 표시도 없다. 다시 해 볼 수 있다.
  persist();
  drawBoard();
  talkers.play.say(fill(T.guess[result.guess], { k: entry.answer }));
}

/** 맞혔을 때 하는 말: 무엇을 했는지 그대로 말한다. */
function rightLine() {
  const parts = [];
  if (!solution.possible) {
    parts.push(round.flipCount > 0 ? fill(T.right['impossible-tried'], { f: round.flipCount }) : T.right['impossible-untried']);
  } else {
    const played = solution.min > 0 && headCount(round.coins) === 0 && round.trail.length === solution.min;
    parts.push(fill(T.right[played ? 'min-played' : 'min-known'], { k: solution.min }));
  }
  if (round.answers.length > 1) parts.push(T.right['after-retry']);
  return parts;
}

/** 판을 끝낸다. outcome: 'solved'(맞힘) | 'solution'(그만두고 풀이를 봄) */
function finish(outcome) {
  stopClock();
  round.done = true;
  round.outcome = outcome;
  round.endedAt = new Date().toISOString();
  selected = [];
  log.saveRecord(toRecord(outcome));
  log.clearCurrent();

  // 끝난 뒤 고를 것. 느낌 표시는 안 눌러도 된다.
  const advice = recommend(log.allRecords(), FORMAT);
  round.offeredHarder = outcome === 'solved' && !round.custom && advice.offerHarder && advice.level === round.level;
  $('after-same').hidden = round.custom;
  $('after-harder').hidden = round.custom || round.level >= TOP_LEVEL;
  $('after-harder').classList.toggle('primary', round.offeredHarder && round.level < TOP_LEVEL);
  $('after-make').classList.toggle('primary', round.offeredHarder && round.level >= TOP_LEVEL);
  $('after-solution').hidden = outcome !== 'solved';
  for (const button of $('feelings').querySelectorAll('button')) button.setAttribute('aria-pressed', 'false');
  showPanel('after');
  drawHints();
  drawBoard();

  if (outcome === 'solved') {
    const parts = rightLine();
    if (!solution.possible && whyAvailable()) parts.push(T.right['why-invite']);
    if (round.offeredHarder) parts.push(T.after.harder);
    log.saveRecord(toRecord(outcome));
    talkers.play.say(parts.join(' '), 'talk');
  }
}

function setFeeling(value) {
  round.feeling = round.feeling === value ? null : value;
  for (const button of $('feelings').querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.feeling === round.feeling));
  }
  log.saveRecord(toRecord(round.outcome));
}

/** 끝난 뒤 고른 것을 적고 기록을 보낸 다음, 고른 곳으로 간다. */
function chooseAfter(choice) {
  const { level, custom } = round;
  round.after = choice;
  log.saveRecord(toRecord(round.outcome));
  log.flush();
  if (choice === 'same' && !custom) startLevel(level);
  else if (choice === 'harder' && !custom) startLevel(Math.min(level + 1, MAKE_LEVEL));
  else if (choice === 'make') showMake();
  else showHome();
}

// ---- 나가기: 풀이를 볼지 묻는다. 안 보고 나가도 되고, 나가도 판은 그대로 남는다. ----
function askLeave() {
  if (round.done) {
    chooseAfter('stop');
    return;
  }
  closeSheet();
  note('leave-ask');
  showPanel('leave-ask');
  talkers.play.say(T.leave.ask, 'listen');
}

function leaveWithSolution() {
  round.viewedSolution = true;
  note('solution');
  finish('solution');
  openSolution();
}

function leaveQuietly() {
  note('leave');
  stopClock();
  persist();
  log.saveRecord({ ...toRecord('left'), endedAt: new Date().toISOString() });
  log.flush();
  showHome();
}

function stay() {
  note('stay');
  showPanel('pad');
  persist();
}

// ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
function openSheet(next) {
  sheet = { ...next, at: 0 };
  $('sheet').hidden = false;
  drawSheet();
}

function drawSheet() {
  const page = sheet.pages[sheet.at];
  const many = sheet.pages.length > 1;
  $('sheet-title').textContent = sheet.title;
  $('sheet-page').textContent = many ? fill(T.why.page, { no: sheet.at + 1, total: sheet.pages.length }) : '';
  $('sheet-body').replaceChildren(...page.nodes);
  $('sheet-prev').hidden = !many;
  $('sheet-next').hidden = !many;
  $('sheet-prev').disabled = sheet.at === 0;
  $('sheet-next').disabled = sheet.at === sheet.pages.length - 1;
  talkers.play.say(page.say, 'point');
}

function turnSheet(step) {
  if (!sheet) return;
  const at = sheet.at + step;
  if (at < 0 || at >= sheet.pages.length) return;
  sheet.at = at;
  drawSheet();
}

function closeSheet() {
  sheet = null;
  $('sheet').hidden = true;
}

function openWhy() {
  const slides = T.why[ruleKey(round.board)];
  if (!slides || !whyAvailable()) return;
  round.viewedWhy = true;
  note('why');
  if (round.done) log.saveRecord(toRecord(round.outcome));
  else persist();
  openSheet({
    title: T.why.title,
    pages: slides.map((slide) => ({
      say: slide.say,
      nodes: slide.strips.map((strip) => drawStrip({ ...strip, steps: strip.steps.map(toCoins) }, T.faces)),
    })),
  });
}

function openSolution() {
  round.viewedSolution = true;
  log.saveRecord(toRecord(round.outcome));
  const { board } = round;
  let say = T.solution.impossible;
  let strip = { steps: [board.coins], shape: board.shape };
  if (solution.possible && solution.min === 0) say = T.solution.zero;
  else if (solution.possible) {
    say = fill(T.solution.possible, { k: solution.min });
    const steps = [board.coins];
    for (const move of solution.moves) steps.push(applyMove(steps.at(-1), move));
    strip = {
      steps,
      shape: board.shape,
      marks: [[], ...solution.moves],
      captions: [T.solution.startLabel, ...solution.moves.map((_, index) => fill(T.solution.stepLabel, { no: index + 1 }))],
    };
  }
  openSheet({ title: T.solution.title, pages: [{ say, nodes: [drawStrip(strip, T.faces)] }] });
}

// ---- 직접 만들기 ----
function readDraft() {
  const saved = log.loadDraft();
  if (saved && checkBoard(saved) === null && saved.n >= MIN_MAKE_COINS) return { n: saved.n, shape: saved.shape, rule: saved.rule, coins: saved.coins.slice() };
  return { n: 6, shape: 'line', rule: 'any2', coins: [1, 1, 1, 1, 1, 1] };
}

function showMake() {
  setScreen('make');
  round = null;
  solution = null;
  draft = readDraft();
  drawMake();
  talkers.make.say(T.make.intro);
}

function drawMake() {
  $('make-count').textContent = fill(T.make.count, { n: draft.n });
  $('make-fewer').disabled = draft.n <= MIN_MAKE_COINS;
  $('make-more').disabled = draft.n >= MAX_COINS;
  for (const button of $('make-shapes').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.shape === draft.shape));
  for (const button of $('make-rules').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.rule === draft.rule));
  drawCoins($('make-board'), {
    coins: draft.coins,
    shape: draft.shape,
    faces: T.faces,
    label: coinLabel,
    onTap: (index) => changeDraft({ coins: draft.coins.map((coin, at) => (at === index ? 1 - coin : coin)) }, [index]),
  });
}

function changeDraft(change, flipped = []) {
  draft = { ...draft, ...change };
  $('make-result').textContent = '';
  log.saveDraft(draft);
  drawMake();
  if (flipped.length > 0) for (const index of flipped) $('make-board').children[index]?.classList.add('flipped');
}

function resizeDraft(step) {
  const n = Math.max(MIN_MAKE_COINS, Math.min(MAX_COINS, draft.n + step));
  if (n === draft.n) return;
  const coins = n > draft.n ? [...draft.coins, 1] : draft.coins.slice(0, n);
  changeDraft({ n, coins });
}

/** 아이가 만든 판을 풀이 프로그램으로 풀어서 알려 준다. */
function solveDraft() {
  const result = solve(draft);
  const line = !result.possible ? T.make.impossible : result.min === 0 ? T.make.zero : fill(T.make.possible, { k: result.min });
  $('make-result').textContent = line;
  const now = new Date().toISOString();
  log.saveRecord({
    kind: 'made',
    v: 1,
    id: log.newId('m'),
    format: FORMAT,
    startedAt: now,
    endedAt: now,
    board: { n: draft.n, shape: draft.shape, rule: draft.rule, coins: draft.coins.join('') },
    solution: { possible: result.possible, min: result.min },
  });
  log.flush();
  talkers.make.say(line);
}

function playDraft() {
  startRound({ level: MAKE_LEVEL, seed: null, small: false, custom: true, board: draft });
}

// ---- 단추 잇기 ----
$('meet-skip').addEventListener('click', () => leaveMeet('skipped'));
$('meet-reset').addEventListener('click', meetReset);
$('meet-more').addEventListener('click', meetMore);
$('meet-cannot').addEventListener('click', meetCannot);
$('meet-enter').addEventListener('click', () => leaveMeet('entered'));
$('meet-again').addEventListener('click', () => showMeet(true));
$('home-play').addEventListener('click', () => {
  if (homeNext) startRound(homeNext);
});
$('home-pick').addEventListener('click', showPicker);
$('picker-close').addEventListener('click', showDoors);
$('home-make').addEventListener('click', showMake);
$('continue').addEventListener('click', resumeRound);
$('leave').addEventListener('click', askLeave);
$('undo').addEventListener('click', undo);
$('reset').addEventListener('click', reset);
$('hint').addEventListener('click', openHint);
$('why').addEventListener('click', openWhy);
$('keys').addEventListener('click', (event) => {
  const key = event.target.closest('button')?.dataset.key;
  if (key) pressKey(key);
});
$('submit').addEventListener('click', () => {
  if (typed !== '') submit({ kind: 'number', value: Number(typed) });
});
$('impossible').addEventListener('click', () => submit({ kind: 'impossible' }));
$('leave-solution').addEventListener('click', leaveWithSolution);
$('leave-go').addEventListener('click', leaveQuietly);
$('leave-stay').addEventListener('click', stay);
$('feelings').addEventListener('click', (event) => {
  const value = event.target.closest('button')?.dataset.feeling;
  if (value) setFeeling(value);
});
$('after-same').addEventListener('click', () => chooseAfter('same'));
$('after-harder').addEventListener('click', () => chooseAfter('harder'));
$('after-make').addEventListener('click', () => chooseAfter('make'));
$('after-stop').addEventListener('click', () => chooseAfter('stop'));
$('after-solution').addEventListener('click', openSolution);
$('sheet-prev').addEventListener('click', () => turnSheet(-1));
$('sheet-next').addEventListener('click', () => turnSheet(1));
$('sheet-close').addEventListener('click', closeSheet);

$('make-leave').addEventListener('click', showHome);
$('make-fewer').addEventListener('click', () => resizeDraft(-1));
$('make-more').addEventListener('click', () => resizeDraft(1));
$('make-shapes').addEventListener('click', (event) => {
  const shape = event.target.closest('button')?.dataset.shape;
  if (shape) changeDraft({ shape });
});
$('make-rules').addEventListener('click', (event) => {
  const rule = event.target.closest('button')?.dataset.rule;
  if (rule) changeDraft({ rule });
});
$('make-all-heads').addEventListener('click', () => changeDraft({ coins: draft.coins.map(() => 1) }));
$('make-all-tails').addEventListener('click', () => changeDraft({ coins: draft.coins.map(() => 0) }));
$('make-solve').addEventListener('click', solveDraft);
$('make-play').addEventListener('click', playDraft);

// 글자판이 있는 기기에서는 숫자를 쳐서 답할 수도 있다.
addEventListener('keydown', (event) => {
  if (screen !== 'play' || !round || round.done || $('pad').hidden || sheet) return;
  if (/^[0-9]$/.test(event.key)) pressKey(event.key);
  else if (event.key === 'Backspace') pressKey('erase');
  else if (event.key === 'Enter' && typed !== '') submit({ kind: 'number', value: Number(typed) });
});

// 화면을 가리거나 닫을 때: 시계를 멈추고 하던 판을 적어 둔다. 돌아오면 그대로 이어진다.
function goAway() {
  if (screen !== 'play' || !round || round.done || clockSince === null) return;
  note('away');
  stopClock();
  persist();
  log.saveRecord({ ...toRecord('left'), endedAt: new Date().toISOString() });
}
function comeBack() {
  if (screen !== 'play' || !round || round.done || clockSince !== null) return;
  startClock();
  note('back');
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') goAway();
  else comeBack();
});
addEventListener('pagehide', goAway);
addEventListener('pageshow', comeBack);
// 연결이 돌아오면 밀린 기록을 올린다.
addEventListener('online', () => log.flush());

// 선생님 목소리 켜고 끄기
const prefs = log.loadPrefs();
$('sound').checked = prefs.sound;
setMuted(!prefs.sound);
$('sound').addEventListener('change', () => {
  setMuted(!$('sound').checked);
  log.savePrefs({ ...log.loadPrefs(), sound: $('sound').checked });
});

// ---- 시작 ----
async function main() {
  showHome();
  voicesReady();
  const mode = await setupOffline({ canReload: () => screen === 'home' });
  let build = mode;
  if (mode !== 'dev') {
    try {
      build = (await (await fetch('./build.json', { cache: 'no-store' })).json()).version;
    } catch {
      build = 'unknown';
    }
  }
  log.setBuild(build);
  $('build').textContent = mode === 'dev' ? '' : build;
  // 지난번에 못 보낸 기록이 있으면 올린다. 설정이 없으면 조용히 건너뛴다.
  log.flush();
}

main();
