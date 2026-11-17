// 퍼즐 연구소의 틀: 처음 화면(연구소)과, 판 화면에서 모든 형식이 함께 쓰는 부분.
// 형식마다 다른 부분은 src/formats/ 에 있다(동전 뒤집기 coins.js, 한붓그리기 trace.js, 숫자 추리 code.js, 자리 바꾸기 swap.js, 조각 덮기 tile.js).
// 처음 만남은 src/meet.js 에 있다.
// 화면에 나오는 글은 모두 대본(src/content/)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
// 틀이 쓰는 글(처음 화면의 말, 단계 표시, 힌트 단추, 나가기, 끝난 뒤의 말)은 coins.json에 있는 것을 모든 형식이 함께 쓴다.
// 지키는 것: 보상과 성적 표시를 두지 않는다. 시간은 기록만 하고 보여 주지 않는다. 아이가 누를 때까지 기다린다.
//
// 형식(format)이 틀에 내놓는 것:
//   id, T(대본), padId(답하는 칸), makeId(직접 만들기 칸), homeIds(처음 화면의 자리들), ladder(사다리와 판 만들어 내기)
//   begin(판의 처음 값) solve(판) valid(적어 둔 판) showParts(보이기) enter() draw() ended()
//   ruleLine(판) hints(판) hintsShown(판) touched(판) record(판, 풀이) rightLine(판, 풀이)
//   whyPages(판) solutionPages(판, 풀이) undo() reset() onKey(글자판)
//   homeAsk(단계) pickLine() drawSample() drawBlank() drawResume() drawLevelPicture() showMake()
import './app.css';
import C from './content/coins.json';
import look from './content/teacher-look.json';
import teacherData from './content/teacher.json';
import { recommend, whyUnlocked } from './core/level.js';
import { fill } from './core/text.js';
import { createCode } from './formats/code.js';
import { createCoins } from './formats/coins.js';
import { createSwap } from './formats/swap.js';
import { createTile } from './formats/tile.js';
import { createTrace } from './formats/trace.js';
import { createMeet } from './meet.js';
import * as log from './ui/log.js';
import { reloadIfWaiting, setupOffline } from './ui/offline.js';
import { setMuted, stopSpeaking, voicesReady } from './ui/speech.js';
import { createTalker } from './ui/talker.js';
import { createTeacher } from './ui/teacher-view.js';

/** 형식이 적혀 있지 않은 예전 값은 동전 뒤집기의 것이다. */
const OLD_FORMAT = 'coins';
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
let round = null; // 지금 하는 판. 하던 판은 모든 형식을 통틀어 하나다
let solution = null; // 그 판을 풀이 프로그램으로 푼 결과(저장하지 않고 늘 다시 푼다)
let F = null; // 지금 하는 판의 형식
let clockSince = null; // 시계가 가는 중이면 시작한 때
let sheet = null; // 판 위에 겹쳐 보여 주는 풀이나 설명
const homeNext = {}; // 처음 화면에 그려 둔 판(형식마다 하나). "해 보기"를 누르면 이 판이 열린다

function setScreen(name) {
  screen = name;
  stopSpeaking();
  for (const talker of Object.values(talkers)) talker.hush();
  for (const id of ['meet', 'home', 'play', 'make']) $(id).hidden = id !== name;
}

function clearRound() {
  round = null;
  solution = null;
  F = null;
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
    format: round.format,
    level: round.level,
    seed: round.seed,
    small: round.small,
    custom: round.custom,
    startedAt: round.startedAt,
    endedAt: round.endedAt ?? new Date().toISOString(),
    events: round.events,
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
    // 형식마다 남기는 것: 판의 처음 모습, 풀이 프로그램의 결과, 누른 횟수들
    ...F.record(round, solution),
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
    const format = formats[saved.format ?? OLD_FORMAT];
    const ok =
      Boolean(format) &&
      saved.done !== true &&
      format.valid(saved) &&
      Array.isArray(saved.events) &&
      Array.isArray(saved.answers) &&
      typeof saved.id === 'string' &&
      Number.isFinite(saved.elapsed);
    if (ok) return saved.format ? saved : { ...saved, format: OLD_FORMAT };
  } catch {
    // 깨진 값은 없는 것으로 본다.
  }
  log.clearCurrent();
  return null;
}

// ---- 처음 화면(연구소): 하던 판 띠, 형식마다 카드 하나, 퍼즐 만들기. 단계 목록은 "판 고르기" 뒤에, 만들 형식은 "만들기" 뒤에 있다. ----
function showHome() {
  setScreen('home');
  if (reloadIfWaiting()) return;
  clearRound();
  const prefs = log.loadPrefs();
  if (!prefs.met) {
    meet.show();
    return;
  }

  // "해 보기"로 열릴 판을 미리 만들어 그대로 보여 준다. 수준 맞추기가 권하는 단계의 다음 판이다.
  for (const format of Object.values(formats)) {
    const advice = recommend(log.allRecords(), format.id);
    const made = format.ladder.generateBoard(advice.level, pickSeed(format, advice.level, advice.small), { small: advice.small });
    homeNext[format.id] = { level: advice.level, seed: made.seed, small: advice.small, custom: false, board: made.board };
    format.drawSample($(format.homeIds.sample), made.board);
    format.drawBlank($(format.homeIds.blank));
    const ask = format.homeAsk(advice.level);
    if (ask) $(format.homeIds.ask).textContent = ask;
  }

  const current = showDoors();
  talkers.home.say(!prefs.visited ? C.home.first : current ? C.home.resume : C.home.again);
  if (!prefs.visited) log.savePrefs({ ...prefs, visited: true });
}

/** 문들과 하던 판을 보여 준다. 하던 판이 있으면 그 판을 돌려준다. */
function showDoors() {
  const current = readCurrent();
  $('doors').hidden = false;
  $('picker').hidden = true;
  $('make-menu').hidden = true;
  $('resume').hidden = !current;
  if (current) formats[current.format].drawResume($('resume-board'), current);
  return current;
}

/** 판 고르기: 형식마다, 단계마다 그림 한 장. */
function showPicker(format) {
  const advice = recommend(log.allRecords(), format.id);
  const items = format.ladder.LADDER.map((rung) => {
    const entry = format.T.levels.find((item) => item.level === rung.level);
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
    add('level-no', fill(C.levelNo, { level: rung.level }));
    const picture = document.createElement('span');
    picture.className = 'level-picture';
    const inner = document.createElement('span');
    picture.append(inner);
    button.append(picture);
    format.drawLevelPicture(inner, entry);
    add('level-name', entry.name);
    add(`level-tag tag-${rung.tag}`, C.tags[rung.tag]);
    if (rung.level === advice.level) {
      button.classList.add('recommended');
      add('level-mark', C.recommendMark);
    }
    button.addEventListener('click', () => startLevel(format, rung.level));
    item.append(button);
    return item;
  });
  $('picker-format').textContent = format.T.title;
  $('levels').replaceChildren(...items);
  $('doors').hidden = true;
  $('resume').hidden = true;
  $('make-menu').hidden = true;
  $('picker').hidden = false;
  talkers.home.say(format.pickLine());
}

/** "만들기"를 누르면 나오는 목록: 어느 형식으로 만들지 고른다. 형식마다 빈 판 하나와 이름이 있다. */
function showMakeMenu(on) {
  $('make-menu').hidden = !on;
  if (on) $('make-menu-close').focus();
  else if (screen === 'home' && !$('doors').hidden) $('home-make-open').focus();
}

/** 그 단계에서 다음에 낼 판 번호. 기록에 남은 가장 큰 번호의 다음이다(방금 한 판과 같은 판은 건너뛴다). */
function pickSeed(format, level, small) {
  const seeds = log
    .allRecords()
    .filter((record) => record.kind === 'round' && record.format === format.id && record.level === level && !record.custom && Number.isInteger(record.seed))
    .map((record) => record.seed);
  if (seeds.length === 0) return 1;
  return format.ladder.nextSeed(level, Math.max(...seeds), { small });
}

function startLevel(format, level) {
  if (level === format.ladder.MAKE_LEVEL) {
    format.showMake();
    return;
  }
  // 수준 맞추기가 "작은 판부터"라고 하면 조용히 따른다. 화면에는 알리지 않는다.
  const advice = recommend(log.allRecords(), format.id);
  const small = advice.small && advice.level === level;
  const made = format.ladder.generateBoard(level, pickSeed(format, level, small), { small });
  startRound(format.id, { level, seed: made.seed, small, custom: false, board: made.board });
}

function startRound(formatId, { level, seed, small, custom, board }) {
  F = formats[formatId];
  round = {
    id: log.newId('r'),
    startedAt: new Date().toISOString(),
    endedAt: null,
    format: formatId,
    level,
    seed,
    small,
    custom,
    ...F.begin({ level, custom, board }),
    events: [],
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
  solution = F.solve(round);
  persist();
  showPlay(F.ruleLine(round));
}

function resumeRound() {
  const saved = readCurrent();
  if (!saved) {
    showHome();
    return;
  }
  round = saved;
  F = formats[round.format];
  solution = F.solve(round);
  round.resumes = (round.resumes ?? 0) + 1;
  showPlay(C.play.resume);
  note('resume');
  persist();
}

// ---- 판 화면 ----
function showPlay(line) {
  setScreen('play');
  for (const format of Object.values(formats)) format.showParts(format === F);
  F.enter();
  closeSheet();
  $('where-format').textContent = F.T.title;
  $('where-title').textContent = round.custom ? C.customTitle : fill(C.levelTitle, { level: round.level, tag: C.tags[F.ladder.rungOf(round.level).tag] });
  $('rule').textContent = F.ruleLine(round);
  showPanel('pad');
  drawHints();
  F.draw();
  startClock();
  talkers.play.say(line);
}

/** 오른쪽 칸에 보여 줄 것: 'pad'(답 넣기), 'leave-ask'(나갈 때), 'after'(끝난 뒤) */
function showPanel(name) {
  for (const format of Object.values(formats)) $(format.padId).hidden = !(name === 'pad' && format === F);
  $('leave-ask').hidden = name !== 'leave-ask';
  $('after').hidden = name !== 'after';
}

function whyAvailable() {
  if (!round || !F.whyPages(round)) return false;
  if (!whyUnlocked(log.allRecords(), round.format)) return false;
  // 해 본 뒤에만 연다: 이 판에서 한 번이라도 손댔거나, 답했거나, 판이 끝났을 때
  return round.done || F.touched(round) || round.answers.length > 0;
}

function showWhy() {
  $('why').hidden = !whyAvailable();
}

// ---- 힌트: 질문 한 문장씩. 다 열어도 풀이는 보이지 않는다. ----
function drawHints() {
  const list = F.hints(round);
  const cards = list.slice(0, F.hintsShown(round)).map((text, index) => {
    const card = document.createElement('div');
    card.className = 'hint-card';
    const title = document.createElement('strong');
    title.textContent = fill(C.hintTitle, { no: index + 1 });
    const body = document.createElement('p');
    body.textContent = text;
    card.append(title, body);
    return card;
  });
  $('hints').replaceChildren(...cards);
  const left = list.length - F.hintsShown(round);
  $('hint').textContent = left > 0 ? C.hintButton.more : C.hintButton.none;
  $('hint').disabled = left <= 0 || round.done;
}

function openHint() {
  const list = F.hints(round);
  if (round.done || round.hintsOpened >= list.length) return;
  round.hintsOpened += 1;
  note('hint', { no: round.hintsOpened });
  drawHints();
  persist();
  talkers.play.say(list[round.hintsOpened - 1], 'point');
}

/** 판을 끝낸다. outcome: 'solved'(맞힘) | 'solution'(그만두고 풀이를 봄) */
function finish(outcome) {
  stopClock();
  round.done = true;
  round.outcome = outcome;
  round.endedAt = new Date().toISOString();
  F.ended();
  log.saveRecord(toRecord(outcome));
  log.clearCurrent();

  // 끝난 뒤 고를 것. 느낌 표시는 안 눌러도 된다.
  const top = F.ladder.TOP_LEVEL;
  const advice = recommend(log.allRecords(), round.format);
  round.offeredHarder = outcome === 'solved' && !round.custom && advice.offerHarder && advice.level === round.level;
  $('after-same').hidden = round.custom;
  $('after-harder').hidden = round.custom || round.level >= top;
  $('after-harder').classList.toggle('primary', round.offeredHarder && round.level < top);
  $('after-make').classList.toggle('primary', round.offeredHarder && round.level >= top);
  $('after-solution').hidden = outcome !== 'solved';
  for (const button of $('feelings').querySelectorAll('button')) button.setAttribute('aria-pressed', 'false');
  showPanel('after');
  drawHints();
  F.draw();

  if (outcome === 'solved') {
    const parts = F.rightLine(round, solution);
    if (!solution.possible && whyAvailable()) parts.push(F.T.right['why-invite']);
    if (round.offeredHarder) parts.push(C.after.harder);
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
  const format = F;
  const { level, custom } = round;
  round.after = choice;
  log.saveRecord(toRecord(round.outcome));
  log.flush();
  if (choice === 'same' && !custom) startLevel(format, level);
  else if (choice === 'harder' && !custom) startLevel(format, Math.min(level + 1, format.ladder.MAKE_LEVEL));
  else if (choice === 'make') format.showMake();
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
  talkers.play.say(C.leave.ask, 'listen');
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
  $('sheet-page').textContent = many ? fill(C.why.page, { no: sheet.at + 1, total: sheet.pages.length }) : '';
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
  if (!whyAvailable()) return;
  const pages = F.whyPages(round);
  round.viewedWhy = true;
  note('why');
  if (round.done) log.saveRecord(toRecord(round.outcome));
  else persist();
  openSheet({ title: C.why.title, pages });
}

function openSolution() {
  round.viewedSolution = true;
  log.saveRecord(toRecord(round.outcome));
  openSheet({ title: C.solution.title, pages: F.solutionPages(round, solution) });
}

// ---- 직접 만들기 화면: 형식마다 만드는 칸이 따로 있다. ----
function openMake(formatId) {
  setScreen('make');
  clearRound();
  for (const format of Object.values(formats)) $(format.makeId).hidden = format.id !== formatId;
  $('make-format').textContent = formats[formatId].T.title;
}

// ---- 형식들과 처음 만남. 틀이 건네주는 것은 아래가 전부다. ----
const frame = {
  $,
  log,
  talkers,
  get round() {
    return round;
  },
  get solution() {
    return solution;
  },
  setScreen,
  clearRound,
  showHome,
  startRound,
  openMake,
  note,
  stamp,
  persist,
  finish,
  showWhy,
  say: (line, pose) => talkers.play.say(line, pose),
};
// 처음 화면의 카드와 "만들기" 목록은 이 차례대로 놓여 있다(index.html).
const formats = { coins: createCoins(frame), trace: createTrace(frame), code: createCode(frame), swap: createSwap(frame), tile: createTile(frame) };
const meet = createMeet(frame);

// ---- 단추 잇기 ----
$('meet-again').addEventListener('click', () => meet.show(true));
for (const format of Object.values(formats)) {
  $(format.homeIds.play).addEventListener('click', () => {
    if (homeNext[format.id]) startRound(format.id, homeNext[format.id]);
  });
  $(format.homeIds.pick).addEventListener('click', () => showPicker(format));
  $(format.homeIds.make).addEventListener('click', () => format.showMake());
}
$('picker-close').addEventListener('click', showDoors);
$('home-make-open').addEventListener('click', () => showMakeMenu(true));
$('make-menu-close').addEventListener('click', () => showMakeMenu(false));
// 목록의 바깥(어두운 곳)을 눌러도 닫힌다.
$('make-menu').addEventListener('click', (event) => {
  if (event.target === $('make-menu')) showMakeMenu(false);
});
$('continue').addEventListener('click', resumeRound);
$('leave').addEventListener('click', askLeave);
$('undo').addEventListener('click', () => F.undo());
$('reset').addEventListener('click', () => F.reset());
$('hint').addEventListener('click', openHint);
$('why').addEventListener('click', openWhy);
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

// 글자판이 있는 기기에서는 글자판으로 답할 수도 있다(형식이 맡는다).
addEventListener('keydown', (event) => {
  if (screen === 'home' && event.key === 'Escape' && !$('make-menu').hidden) showMakeMenu(false);
  if (screen !== 'play' || !round || round.done || sheet) return;
  F.onKey(event);
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
