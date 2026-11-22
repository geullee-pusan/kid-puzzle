// 퍼즐 연구소의 틀: 처음 화면(연구소)과, 판 화면에서 모든 형식이 함께 쓰는 부분.
// 형식마다 다른 부분은 src/formats/ 에 있다(동전 뒤집기 coins.js, 한붓그리기 trace.js, 숫자 추리 code.js, 자리 바꾸기 swap.js, 조각 덮기 tile.js, 누가 이길까 duel.js, 약수 세금 tax.js, 참말 섬 logic.js, 조각 못 들어가게 막기 block.js, 강 건너기 river.js, 컵 뒤집기와 세 색 무리 cups.js, 민들레와 바람 dandelion.js, 주사위 미로와 길 세기 maze.js, 숨은 규칙 찾기 rulehunt.js, 엉킨 그림 풀기 untangle.js, 켜고 끄기와 숫자 마술 lamps.js, 방 한 번씩 돌기 rooms.js, 규칙 기계와 규칙이 깨지는 판 machine.js, 똑같이 섞이게 자르기 split.js, 눈대중 eyeball.js, 자르고 붙이기 cutpaste.js, 접히는 모양 가리기 fold.js, 도미노 가로세로 domino.js, 조각 가짓수 찾기 pieces.js, 마법 네모와 겹친 칸 magic.js, 닿지 않게 놓기와 구역 긋기 apart.js, 열쇠 미로 keymaze.js, 암호 놀이 cipher.js, 수열 길 퍼즐 seqpath.js, 팬케이크 뒤집기 pancake.js, 곱 단서 퍼즐 product.js, 세모 피하기 sim.js, 성냥개비 matches.js, 공정한 게임일까 fair.js, 줄 뒤집기 판 rowflip.js, 여우와 토끼 foxrabbit.js, 핀에 실 감기 pins.js, 그물 끊기 net.js, 구역 지도 맞히기 regionmap.js, 블랙홀 blackhole.js, 탑 옮기기 tower.js, 모눈 자동차 경주 racetrack.js, 원판 둘씩 옮기기 discpair.js, 도미노 깔기 모두 찾기 tilings.js, 손가락 더하기 fingers.js, 부호 넣어 수 만들기 signs.js, 세 방향에서 본 그림 views.js, 번호 말 제자리 찾기 slide.js).
// 처음 만남은 src/meet.js 에, 내 공책은 src/notebook.js 에 있다.
// 화면에 나오는 글은 모두 대본(src/content/)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
// 틀이 쓰는 글(처음 화면의 말, 단계 표시, "막혔어요"의 세 고르기, 작은 판의 말, 나가기, 끝난 뒤의 말)은 coins.json에 있는 것을 모든 형식이 함께 쓴다.
// 지키는 것: 보상과 성적 표시를 두지 않는다. 시간은 기록만 하고 보여 주지 않는다. 아이가 누를 때까지 기다린다.
//   "막혔어요"는 아이가 스스로 누른다. 틀이 먼저 묻지 않고, 몇 번 눌렀는지 보여 주지 않는다.
//
// 형식(format)이 틀에 내놓는 것:
//   id, T(대본), padId(답하는 칸), makeId(직접 만들기 칸), homeIds(처음 화면의 자리들), ladder(사다리와 판 만들어 내기)
//   begin(판의 처음 값. 단계, 판 번호, 직접 만든 판인지, 판을 받는다) solve(판) valid(적어 둔 판) showParts(보이기) enter() draw() ended()
//   ruleLine(판) hints(판. 힌트 1과 힌트 2) touched(판) record(판, 풀이) rightLine(판, 풀이)
//   view(판. 지금 판의 모습을 짧게 적은 것) smaller(판, 차례. 이 판보다 작은 판. 없으면 null)
//   whyPages(판) solutionPages(판, 풀이) undo() reset() onKey(글자판)
//   homeAsk(단계) pickLine() drawSample() drawBlank() drawResume() drawLevelPicture() showMake()
import './app.css';
import C from './content/coins.json';
import look from './content/teacher-look.json';
import teacherData from './content/teacher.json';
import { recommend, whyUnlocked, withoutSide } from './core/level.js';
import { fill } from './core/text.js';
import { createApart } from './formats/apart.js';
import { createBlock } from './formats/block.js';
import { createCipher } from './formats/cipher.js';
import { createCode } from './formats/code.js';
import { createCoins } from './formats/coins.js';
import { createCups } from './formats/cups.js';
import { createCutpaste } from './formats/cutpaste.js';
import { createDandelion } from './formats/dandelion.js';
import { createDomino } from './formats/domino.js';
import { createDuel } from './formats/duel.js';
import { createEyeball } from './formats/eyeball.js';
import { createFair } from './formats/fair.js';
import { createRowflip } from './formats/rowflip.js';
import { createFoxrabbit } from './formats/foxrabbit.js';
import { createPins } from './formats/pins.js';
import { createNet } from './formats/net.js';
import { createRegionmap } from './formats/regionmap.js';
import { createBlackhole } from './formats/blackhole.js';
import { createTower } from './formats/tower.js';
import { createRacetrack } from './formats/racetrack.js';
import { createDiscpair } from './formats/discpair.js';
import { createTilings } from './formats/tilings.js';
import { createFingers } from './formats/fingers.js';
import { createSigns } from './formats/signs.js';
import { createViews } from './formats/views.js';
import { createSlide } from './formats/slide.js';
import { createKeymaze } from './formats/keymaze.js';
import { createFold } from './formats/fold.js';
import { createLamps } from './formats/lamps.js';
import { createLogic } from './formats/logic.js';
import { createMagic } from './formats/magic.js';
import { createMachine } from './formats/machine.js';
import { createMatches } from './formats/matches.js';
import { createMaze } from './formats/maze.js';
import { createPancake } from './formats/pancake.js';
import { createPieces } from './formats/pieces.js';
import { createProduct } from './formats/product.js';
import { createRiver } from './formats/river.js';
import { createRooms } from './formats/rooms.js';
import { createSeqpath } from './formats/seqpath.js';
import { createSim } from './formats/sim.js';
import { createRulehunt } from './formats/rulehunt.js';
import { createSplit } from './formats/split.js';
import { createSwap } from './formats/swap.js';
import { createTax } from './formats/tax.js';
import { createTile } from './formats/tile.js';
import { createTrace } from './formats/trace.js';
import { createUntangle } from './formats/untangle.js';
import { createMeet } from './meet.js';
import { createNotebook } from './notebook.js';
import * as log from './ui/log.js';
import { reloadIfWaiting, setupOffline } from './ui/offline.js';
import { setMuted, stopSpeaking, voicesReady } from './ui/speech.js';
import { createTalker } from './ui/talker.js';
import { createTeacher } from './ui/teacher-view.js';

/** 형식이 적혀 있지 않은 예전 값은 동전 뒤집기의 것이다. */
const OLD_FORMAT = 'coins';
/** "막혔어요"에서 고르는 셋: 규칙 다시 보기, 힌트 1(무엇을 해 볼지), 힌트 2(어디를 볼지) */
const HELP = { rule: null, next: 0, why: 1 };
/** 눈에 띄게 한 것(규칙 글, "왜 그럴까?" 단추)이 다시 가라앉기까지의 시간(밀리초) */
const FLASH_MS = 3600;
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
let origin = null; // 작은 판을 하는 동안 간직해 둔 원래 판 { round, finished(끝까지 한 작은 판의 수) }
let stuckOpen = false; // "막혔어요"의 세 고르기가 펼쳐져 있는가
let asking = false; // 원래 판으로 돌아와 선생님이 한 번 묻는 중인가. 아이가 무엇이든 누를 때까지 형식이 스스로 하는 말(선생님이 둔 수)로 덮지 않는다
const smallerMemo = new Map(); // 이미 구해 둔 작은 판(판 번호와 차례마다)
const flashing = new Map(); // 눈에 띄게 해 둔 것들과, 다시 가라앉힐 타이머
const homeNext = {}; // 처음 화면에 그려 둔 판(형식마다 하나). "해 보기"를 누르면 이 판이 열린다
let makeFormat = null; // 직접 만들기 화면에서 만드는 형식
let madeId = null; // 직접 만들기에서 방금 공책에 남긴 쪽(이름 칸이 이 쪽의 이름을 고친다)
let notebookFromPlay = false; // 공책을 판을 하던 중에 열었는가(그러면 공책의 나가기가 하던 판으로 돌아간다)

function setScreen(name) {
  screen = name;
  stopSpeaking();
  for (const talker of Object.values(talkers)) talker.hush();
  for (const id of ['meet', 'home', 'notebook', 'play', 'make']) $(id).hidden = id !== name;
}

function clearRound() {
  round = null;
  solution = null;
  F = null;
  origin = null;
  stuckOpen = false;
  asking = false;
  smallerMemo.clear();
}

/** 수준 맞추기와 "왜 그럴까?"가 보는 기록. 작은 판의 기록은 세지 않는다. */
const records = () => withoutSide(log.allRecords());

// ---- 시계: 판 화면이 보이는 동안만 간다. 기록만 하고 화면에는 보여 주지 않는다. ----
function startClock() {
  if (round && !round.done && clockSince === null) clockSince = performance.now();
}
function stopClock() {
  if (round && clockSince !== null) round.elapsed += (performance.now() - clockSince) / 1000;
  clockSince = null;
}
const elapsed = () => (round ? round.elapsed + (clockSince === null ? 0 : (performance.now() - clockSince) / 1000) : 0);
const tenth = (seconds) => Math.round(seconds * 10) / 10;
const stamp = () => tenth(elapsed());

function note(type, data = {}) {
  round.events.push({ t: stamp(), type, ...data });
}

// ---- 기록 ----
/** 판 하나의 기록. 작은 판을 하는 동안에는 간직해 둔 원래 판(r)의 기록도 이것으로 만든다(그 판의 시계는 멈춰 있다). */
function toRecord(outcome, r = round) {
  const mine = r === round;
  const format = formats[r.format];
  const record = {
    kind: 'round',
    v: 1,
    id: r.id,
    format: r.format,
    level: r.level,
    seed: r.seed,
    small: r.small,
    custom: r.custom,
    // 작은 판(곁판)인가. 그렇다면 원래 판의 번호와, 그 판에서 몇 번째로 연 작은 판인지(0부터)
    side: r.side === true,
    sideOf: r.sideOf ?? null,
    sideTurn: r.sideTurn ?? null,
    startedAt: r.startedAt,
    endedAt: r.endedAt ?? new Date().toISOString(),
    events: r.events,
    hintsOpened: r.hintsOpened,
    // "막혔어요"에서 고른 것마다의 수, 이 판에서 작은 판을 연 수와 끝까지 한 수. 화면에는 보여 주지 않는다
    help: helpOf(r),
    sideOpened: r.sideOpened ?? 0,
    sideDone: r.sideDone ?? 0,
    answers: r.answers,
    seconds: mine ? stamp() : tenth(r.elapsed),
    outcome,
    quit: outcome !== 'solved',
    viewedSolution: r.viewedSolution,
    viewedWhy: r.viewedWhy,
    after: r.after,
    feeling: r.feeling,
    offeredHarder: r.offeredHarder,
    resumes: r.resumes,
    // 공책에서 "다시 해 보기"로 연 판이면 'notebook'과 그 쪽의 번호
    from: r.from ?? null,
    fromPage: r.fromPage ?? null,
    // 형식마다 남기는 것: 판의 처음 모습, 풀이 프로그램의 결과, 누른 횟수들
    ...format.record(r, mine ? solution : format.solve(r)),
  };
  // 작은 판으로 가 본 판은 힌트 하나를 연 것으로 센다(형식의 도구 단추와 같게).
  if (record.sideOpened > 0) record.hintsOpened += 1;
  return record;
}

/** 하던 판을 기기에 적어 둔다. 껐다 켜도 그대로 이어서 할 수 있다. 작은 판은 적어 두지 않는다(하던 판은 원래 판이다). */
function persist() {
  if (!round || round.side) return;
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
      saved.side !== true &&
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
    const advice = recommend(records(), format.id);
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
  const advice = recommend(records(), format.id);
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

/** 그 단계에서 다음에 낼 판 번호. 기록에 남은 가장 큰 번호의 다음이다(방금 한 판과 같은 판은 건너뛴다). 작은 판의 기록은 보지 않는다. */
function pickSeed(format, level, small) {
  const seeds = records()
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
  const advice = recommend(records(), format.id);
  const small = advice.small && advice.level === level;
  const made = format.ladder.generateBoard(level, pickSeed(format, level, small), { small });
  startRound(format.id, { level, seed: made.seed, small, custom: false, board: made.board });
}

/** 새 판의 처음 값. more에는 작은 판(곁판)일 때의 표시가 들어온다. */
function newRound(formatId, { level, seed, small, custom, board }, more = {}) {
  F = formats[formatId];
  return {
    id: log.newId('r'),
    startedAt: new Date().toISOString(),
    endedAt: null,
    format: formatId,
    level,
    seed,
    small,
    custom,
    ...F.begin({ level, seed, custom, board }),
    events: [],
    hintsOpened: 0, // 연 힌트의 수
    hintsSeen: [], // 연 힌트의 번호(0은 힌트 1, 1은 힌트 2)
    help: { rule: 0, next: 0, why: 0 }, // "막혔어요"에서 고른 것마다의 수
    side: false, // 작은 판(곁판)인가
    sideOf: null, // 그렇다면 원래 판의 번호
    sideTurn: null, // 원래 판에서 몇 번째로 연 작은 판인가(0부터)
    sideOffered: false, // "더 작은 판으로" 단추를 내보였는가
    sideOpened: 0, // 이 판에서 작은 판을 연 수
    sideDone: 0, // 그 가운데 끝까지 한 수
    sideNext: 0, // 다음에 열 작은 판의 차례
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
    from: null, // 공책에서 연 판이면 'notebook'
    fromPage: null, // 그렇다면 그 쪽의 번호
    ...more,
  };
}

/** 새 판을 연다. 하던 판이 막혔던 판이면 공책에 묵혀 둔다(새 판이 하던 판 자리를 차지하기 때문이다). */
function startRound(formatId, start, more = {}) {
  notebookFromPlay = false;
  notebook.keepShelved(readCurrent());
  origin = null;
  round = newRound(formatId, start, more);
  solution = F.solve(round);
  persist();
  showPlay(F.ruleLine(round));
}

function resumeRound() {
  notebookFromPlay = false;
  const saved = readCurrent();
  if (!saved) {
    showHome();
    return;
  }
  origin = null;
  round = saved;
  F = formats[round.format];
  solution = F.solve(round);
  round.resumes = (round.resumes ?? 0) + 1;
  showPlay(C.play.resume);
  note('resume');
  persist();
}

/** 공책의 묵혀 둔 판을 이어서 한다. 그 판이 지금 하던 판이면 하던 판을 그대로 잇는다(그쪽이 더 나중 모습이다). */
function resumeSaved(saved) {
  const current = readCurrent();
  if (!current || current.id !== saved.id) {
    notebook.keepShelved(current);
    log.saveCurrent(saved);
  }
  resumeRound();
}

// ---- 판 화면 ----
function showPlay(line) {
  setScreen('play');
  for (const format of Object.values(formats)) format.showParts(format === F);
  F.enter();
  closeSheet();
  stuckOpen = false;
  calm();
  // 작은 판에서는 "나가기" 자리에 "원래 판으로"가 있고, 제목에 작은 판임이 보인다.
  $('leave').hidden = round.side;
  $('side-back').hidden = !round.side;
  $('play-notebook').hidden = round.side || round.done;
  $('where-format').textContent = F.T.title;
  $('where-title').textContent = round.side
    ? C.side.title
    : round.custom
      ? C.customTitle
      : fill(C.levelTitle, { level: round.level, tag: C.tags[F.ladder.rungOf(round.level).tag] });
  placeRule(Boolean(F.ruleAside));
  $('rule').textContent = F.ruleLine(round);
  showPanel('pad');
  drawHints();
  F.draw();
  startClock();
  talkers.play.say(line);
}

/** 규칙 글의 자리: 보통은 판 바로 위, 판이 위아래로 긴 형식(ruleAside)은 왼쪽 칸 맨 위 */
function placeRule(aside) {
  const rule = $('rule');
  const home = aside ? document.querySelector('#play .side') : document.querySelector('#play .table');
  if (rule.parentElement !== home) home.prepend(rule);
  rule.classList.toggle('aside', aside);
}

/** 오른쪽 칸에 보여 줄 것: 'pad'(답 넣기), 'leave-ask'(나갈 때), 'after'(끝난 뒤) */
function showPanel(name) {
  for (const format of Object.values(formats)) $(format.padId).hidden = !(name === 'pad' && format === F);
  $('leave-ask').hidden = name !== 'leave-ask';
  $('after').hidden = name !== 'after';
}

function whyAvailable() {
  if (!round || !F.whyPages(round)) return false;
  if (!whyUnlocked(records(), round.format)) return false;
  // 해 본 뒤에만 연다: 이 판에서 한 번이라도 손댔거나, 답했거나, 작은 판으로 가 봤거나, 판이 끝났을 때
  return round.done || F.touched(round) || round.answers.length > 0 || (round.sideOpened ?? 0) > 0;
}

function showWhy() {
  $('why').hidden = !whyAvailable();
}

// ---- 눈에 띄게 하기: 규칙 글과 "왜 그럴까?" 단추를 잠깐 도드라지게 한다. 스스로 넘어가는 것은 없다. ----
function flash(element) {
  clearTimeout(flashing.get(element));
  element.classList.remove('flash');
  // 같은 것을 다시 눈에 띄게 할 때도 처음부터 다시 도드라지게 한다.
  void element.offsetWidth;
  element.classList.add('flash');
  flashing.set(
    element,
    setTimeout(() => {
      element.classList.remove('flash');
      flashing.delete(element);
    }, FLASH_MS),
  );
}

function calm() {
  for (const [element, timer] of flashing) {
    clearTimeout(timer);
    element.classList.remove('flash');
  }
  flashing.clear();
}

// ---- "막혔어요": 아이가 누르면 셋 가운데 고른다. 고르지 않고 닫아도 된다. ----
// 힌트는 질문 한 문장씩 둘이다(힌트 1은 무엇을 해 볼지, 힌트 2는 어디를 볼지). 다 열어도 풀이는 보이지 않는다.
/** 연 힌트의 번호들. 예전에 적어 둔 판에는 연 수(hintsOpened)만 있다. 그때는 앞에서부터 연 것이다. */
const seenHints = (r = round) => (Array.isArray(r.hintsSeen) ? r.hintsSeen : Array.from({ length: r.hintsOpened ?? 0 }, (_, index) => index));
const helpOf = (r) => ({ rule: r.help?.rule ?? 0, next: r.help?.next ?? 0, why: r.help?.why ?? 0 });

/** 이 판보다 작은 판. 없으면 null. 같은 판, 같은 차례에는 늘 같은 판이 나온다. */
function smallerOf(r, turn = r.sideNext ?? 0) {
  const key = `${r.id}:${turn}`;
  if (!smallerMemo.has(key)) smallerMemo.set(key, formats[r.format].smaller(r, turn));
  return smallerMemo.get(key);
}

/** 왼쪽 칸: "막혔어요" 단추와 세 고르기, "더 작은 판으로" 단추, 열린 힌트 카드 */
function drawHints() {
  const list = F.hints(round);
  const cards = seenHints()
    .slice()
    .sort((a, b) => a - b)
    .map((index) => {
      const card = document.createElement('div');
      card.className = 'hint-card';
      const title = document.createElement('strong');
      title.textContent = fill(C.hintTitle, { no: index + 1 });
      const body = document.createElement('p');
      body.textContent = list[index];
      card.append(title, body);
      return card;
    });
  $('hints').replaceChildren(...cards);
  if (round.done) stuckOpen = false;
  $('stuck').disabled = round.done;
  $('stuck').setAttribute('aria-expanded', String(stuckOpen));
  $('stuck-menu').hidden = !stuckOpen;
  // "더 작은 판으로"는 첫째나 둘째를 고른 뒤에 보인다. 작은 판에서는 다시 내지 않고, 더 작은 판이 없으면 보이지 않는다.
  $('smaller').hidden = !(round.sideOffered && !round.done && !round.side && smallerOf(round) !== null);
}

/** "막혔어요"를 눌렀다: 세 고르기를 펼치거나 접는다. */
function toggleStuck(open = !stuckOpen) {
  if (!round || round.done || open === stuckOpen) return;
  stuckOpen = open;
  note(open ? 'help-open' : 'help-close');
  drawHints();
  persist();
  if (!open) $('stuck').focus();
  // 왼쪽 칸 위에 규칙 글이 있는 형식에서는 펼친 고르기가 칸 아래로 밀릴 수 있다. 다 보이게 굴린다
  else showInSide($('stuck-menu'));
}

/** 왼쪽 칸 안의 것이 칸 밖으로 밀려 있으면 보이게 왼쪽 칸을 굴린다 */
function showInSide(element) {
  element?.scrollIntoView?.({ block: 'nearest' });
}

/**
 * 셋 가운데 하나를 골랐다. 선생님은 고른 것에 맞는 말 하나만 한다.
 *   rule  규칙을 다시 말하고 규칙 글을 눈에 띄게 한다. "더 작은 판으로"를 내보인다
 *   next  힌트 1을 연다. "더 작은 판으로"를 내보인다
 *   why   힌트 2를 연다. 이 판에 "왜 그럴까?"가 열려 있으면 그 단추를 눈에 띄게 한다
 * 이미 연 힌트를 다시 고르면 다시 말해 줄 뿐 새로 세지 않는다. 규칙 다시 보기는 힌트로 세지 않는다.
 */
function pickHelp(choice) {
  if (!round || round.done || !(choice in HELP)) return;
  const list = F.hints(round);
  const index = HELP[choice];
  const seen = seenHints();
  const fresh = index !== null && !seen.includes(index);
  if (fresh) {
    round.hintsSeen = [...seen, index];
    round.hintsOpened = round.hintsSeen.length;
  }
  round.help = { ...helpOf(round), [choice]: helpOf(round)[choice] + 1 };
  // 무엇을 골랐는지와 그때의 판 모습을 남긴다.
  note('help', { choice, fresh, view: F.view(round) });
  if (fresh) note('hint', { no: index + 1 });
  if (choice !== 'why') round.sideOffered = true;
  stuckOpen = false;
  drawHints();
  showWhy();
  persist();
  $('stuck').focus();
  if (fresh) showInSide($('hints').children[seenHints().slice().sort((a, b) => a - b).indexOf(index)]);
  if (choice === 'rule') {
    showInSide($('rule'));
    flash($('rule'));
    talkers.play.say(F.ruleLine(round), 'point');
    return;
  }
  if (choice === 'why' && !$('why').hidden) flash($('why'));
  talkers.play.say(list[index], 'point');
}

// ---- "더 작은 판으로": 같은 규칙의 더 작은 판을 연다. 하던 판은 그대로 간직한다(끝난 것도, 나간 것도 아니다). ----
function openSide() {
  if (!round || round.done || round.side) return;
  const turn = round.sideNext ?? 0;
  const small = smallerOf(round, turn);
  if (!small) return;
  round.sideOpened = (round.sideOpened ?? 0) + 1;
  note('side', { on: true, turn, board: small.board });
  // 원래 판의 시계를 멈춘다. 작은 판에 쓴 시간은 원래 판의 걸린 시간에 넣지 않는다.
  stopClock();
  persist();
  origin = { round, finished: 0 };
  startSide(turn, small.board, F.T.side?.open ?? C.side.open);
}

/** 작은 판 하나를 시작한다. 단계와 판의 종류는 원래 판을 따른다. 판 번호는 없다. */
function startSide(turn, board, line) {
  const parent = origin.round;
  round = newRound(parent.format, { level: parent.level, seed: null, small: false, custom: parent.custom, board }, { side: true, sideOf: parent.id, sideTurn: turn });
  solution = F.solve(round);
  showPlay(line);
}

/** 작은 판을 끝낸 뒤 "작은 판 하나 더": 다음 차례의 작은 판을 연다. */
function moreSide() {
  if (!origin || !round.side || !round.done) return;
  const parent = origin.round;
  const turn = round.sideTurn + 1;
  const small = smallerOf(parent, turn);
  if (!small) return;
  round.after = 'more';
  log.saveRecord(toRecord(round.outcome));
  parent.sideOpened = (parent.sideOpened ?? 0) + 1;
  parent.events.push({ t: tenth(parent.elapsed), type: 'side', on: true, turn, board: small.board });
  log.saveCurrent(parent);
  startSide(turn, small.board, C.side.more);
}

/**
 * 원래 판으로 돌아간다. 판은 떠날 때 모습 그대로다.
 * 작은 판을 끝까지 했으면 선생님이 한 번 묻는다("작은 판에서 본 것을 여기에 쓸 수 있나요?"). 하다가 돌아왔으면 돌아왔다는 사실만 말한다.
 */
function backToOrigin() {
  if (!origin || !round.side) return;
  if (round.done) {
    round.after = 'back';
    log.saveRecord(toRecord(round.outcome));
  } else {
    note('leave');
    stopClock();
    log.saveRecord({ ...toRecord('left'), endedAt: new Date().toISOString() });
  }
  log.flush();
  const finished = origin.finished > 0;
  round = origin.round;
  origin = null;
  F = formats[round.format];
  solution = F.solve(round);
  showPlay(finished ? C.side.back : C.side.early);
  asking = finished;
  note('side', { on: false, finished });
  persist();
}

/** 판을 끝낸다. outcome: 'solved'(맞힘) | 'solution'(그만두고 풀이를 봄) */
function finish(outcome) {
  stopClock();
  round.done = true;
  round.outcome = outcome;
  round.endedAt = new Date().toISOString();
  F.ended();
  log.saveRecord(toRecord(outcome));
  $('play-notebook').hidden = true;
  const side = round.side;
  if (side) {
    // 작은 판을 끝까지 했다. 원래 판에 적어 둔다(다음에 여는 작은 판은 그다음 차례다). 하던 판은 여전히 원래 판이다.
    const parent = origin.round;
    origin.finished += 1;
    parent.sideDone = (parent.sideDone ?? 0) + 1;
    parent.sideNext = round.sideTurn + 1;
    log.saveCurrent(parent);
  } else {
    log.clearCurrent();
    // 끝까지 한 판은 묵혀 둔 판이 아니다. 더 좋은 답을 찾는 형식이면 가장 좋은 기록을 공책에 남긴다(저절로, 말하지 않는다).
    notebook.dropShelved(round.id);
    notebook.keepBest(round);
  }

  // 끝난 뒤 고를 것. 느낌 표시는 안 눌러도 된다.
  // 작은 판을 끝낸 뒤에는 "원래 판으로 돌아가기"와 "작은 판 하나 더"만 낸다.
  const top = F.ladder.TOP_LEVEL;
  const advice = recommend(records(), round.format);
  round.offeredHarder = !side && outcome === 'solved' && !round.custom && advice.offerHarder && advice.level === round.level;
  $('after-feel').hidden = side;
  $('feelings').hidden = side;
  $('after-back').hidden = !side;
  $('after-more').hidden = !side || smallerOf(origin.round, round.sideTurn + 1) === null;
  $('after-same').hidden = side || round.custom;
  $('after-harder').hidden = side || round.custom || round.level >= top;
  $('after-make').hidden = side;
  $('after-stop').hidden = side;
  $('after-harder').classList.toggle('primary', round.offeredHarder && round.level < top);
  $('after-make').classList.toggle('primary', round.offeredHarder && round.level >= top);
  $('after-solution').hidden = side || outcome !== 'solved';
  for (const button of $('feelings').querySelectorAll('button')) button.setAttribute('aria-pressed', 'false');
  showPanel('after');
  drawHints();
  F.draw();

  if (outcome === 'solved') {
    const parts = F.rightLine(round, solution);
    if (!solution.possible && whyAvailable()) parts.push(F.T.right['why-invite']);
    // 맨 위 단계에서는 "더 어려운 판" 단추가 없으니 직접 만들기를 권한다
    if (round.offeredHarder) parts.push(round.level >= top ? C.after['harder-make'] : C.after.harder);
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

/**
 * 끝난 뒤 고른 것을 적고 기록을 보낸 다음, 고른 곳으로 간다.
 * 형식만의 고르기(누가 이길까의 "자리를 바꿔서 다시 두기")는 갈 곳을 go로 건넨다.
 */
function chooseAfter(choice, go = null) {
  if (round.side) {
    backToOrigin();
    return;
  }
  const format = F;
  const { level, custom } = round;
  round.after = choice;
  log.saveRecord(toRecord(round.outcome));
  log.flush();
  if (go) go();
  else if (choice === 'same' && !custom) startLevel(format, level);
  else if (choice === 'harder' && !custom) startLevel(format, Math.min(level + 1, format.ladder.MAKE_LEVEL));
  else if (choice === 'make') format.showMake();
  else showHome();
}

// ---- 나가기: 풀이를 볼지 묻는다. 안 보고 나가도 되고, 나가도 판은 그대로 남는다. ----
function askLeave() {
  if (round.side) {
    backToOrigin();
    return;
  }
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
  // "막혔어요"를 누른 판이면 공책에 묵혀 둔다. 한 번이라도 끝까지 간 기록이 있으면 가장 좋은 기록도 남긴다.
  notebook.keepShelved(round);
  notebook.keepBest(round);
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

/** 판에 적은 것을 남긴다: 끝난 판이면 기록을 고쳐 적고, 하던 판이면 기기에 적어 둔다. */
function keep() {
  if (!round) return;
  if (round.done) log.saveRecord(toRecord(round.outcome));
  else persist();
}

function openSolution() {
  round.viewedSolution = true;
  log.saveRecord(toRecord(round.outcome));
  openSheet({ title: C.solution.title, pages: F.solutionPages(round, solution) });
}

// ---- "알았다!": 그 순간의 판을 공책에 남긴다. 무엇을 알았는지는 묻지 않는다. ----
function pressFound() {
  if (!round) return;
  note('found', { view: F.view(round) });
  const result = notebook.keepFound(round);
  keep();
  talkers.play.say(result.existed ? C.notebook['found-again'] : C.notebook.found);
}

// ---- 판을 하던 중에 공책 보기: 판은 멈춰 두고 적어 둔다. 공책에서 다른 판을 열면 그 판이 하던 판 자리를 차지한다. ----
function openNotebookFromPlay() {
  if (!round || round.side || round.done) return;
  closeSheet();
  note('notebook', { on: true });
  stopClock();
  persist();
  log.saveRecord({ ...toRecord('left'), endedAt: new Date().toISOString() });
  log.flush();
  notebookFromPlay = true;
  notebook.show({ fromPlay: true });
}

function openNotebookFromHome() {
  notebookFromPlay = false;
  notebook.show();
}

/** 공책의 나가기: 판을 하던 중에 열었으면 하던 판으로, 아니면 처음 화면으로 */
function leaveNotebook() {
  const back = notebookFromPlay && round && !round.done && !round.side;
  notebookFromPlay = false;
  if (!back) {
    showHome();
    return;
  }
  showPlay(C.notebook['back-line']);
  note('notebook', { on: false });
  persist();
}

// ---- 직접 만들기 화면: 형식마다 만드는 칸이 따로 있다. ----
function openMake(formatId) {
  setScreen('make');
  clearRound();
  makeFormat = formatId;
  madeId = null;
  $('make-name').hidden = true;
  $('make-name-input').value = '';
  for (const format of Object.values(formats)) $(format.makeId).hidden = format.id !== formatId;
  $('make-format').textContent = formats[formatId].T.title;
}

/** "공책에 남기기": 다 만든 판을 공책에 넣고 이름 칸을 보인다. 아직 풀 수 있는 판이 아니면 그렇다고 말한다. */
function keepMade() {
  const format = formats[makeFormat];
  const board = format?.madeBoard();
  if (!board) {
    talkers.make.say(format?.T.make?.['keep-not-yet'] ?? C.notebook['not-yet']);
    return;
  }
  const result = notebook.keepMade(makeFormat, board);
  madeId = result.page.id;
  $('make-name').hidden = false;
  $('make-name-input').value = result.page.name;
  talkers.make.say(result.existed ? C.notebook['made-again'] : C.notebook.made);
}

// ---- 형식들과 처음 만남. 틀이 건네주는 것은 아래가 전부다. ----
const frame = {
  $,
  log,
  // 수준 맞추기와 "왜 그럴까?"가 보는 기록(작은 판의 기록은 빠져 있다). 형식도 지난 기록을 볼 때는 이것을 쓴다
  records,
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
  // 아래 셋은 누가 이길까와 민들레와 바람, 주사위 미로가 쓴다: 판 위에 종이를 겹쳐 보이기(방금 판 다시 보기, 전부 보여 줘), 끝난 뒤의 형식만의 고르기, 끝난 판에 적은 것 남기기(더 많이 해 보기)
  openSheet,
  chooseAfter,
  keep,
  // 형식이 하는 말. 돌아와서 묻는 말("작은 판에서 본 것을 여기에 쓸 수 있나요?")은 아이가 무엇이든 누르기 전에는 덮지 않는다
  say(line, pose) {
    if (!asking) talkers.play.say(line, pose);
  },
};
// 처음 화면의 카드와 "만들기" 목록은 이 차례대로 놓여 있다(index.html).
const formats = { coins: createCoins(frame), trace: createTrace(frame), code: createCode(frame), swap: createSwap(frame), tile: createTile(frame), duel: createDuel(frame), tax: createTax(frame), logic: createLogic(frame), block: createBlock(frame), river: createRiver(frame), cups: createCups(frame), dandelion: createDandelion(frame), maze: createMaze(frame), rulehunt: createRulehunt(frame), untangle: createUntangle(frame), lamps: createLamps(frame), rooms: createRooms(frame), machine: createMachine(frame), split: createSplit(frame), eyeball: createEyeball(frame), cutpaste: createCutpaste(frame), fold: createFold(frame), domino: createDomino(frame), pieces: createPieces(frame), magic: createMagic(frame), apart: createApart(frame), keymaze: createKeymaze(frame), cipher: createCipher(frame), seqpath: createSeqpath(frame), pancake: createPancake(frame), product: createProduct(frame), sim: createSim(frame), matches: createMatches(frame), fair: createFair(frame), rowflip: createRowflip(frame), foxrabbit: createFoxrabbit(frame), pins: createPins(frame), net: createNet(frame), regionmap: createRegionmap(frame), blackhole: createBlackhole(frame), tower: createTower(frame), racetrack: createRacetrack(frame), discpair: createDiscpair(frame), tilings: createTilings(frame), fingers: createFingers(frame), signs: createSigns(frame), views: createViews(frame), slide: createSlide(frame) };
const meet = createMeet(frame);
const notebook = createNotebook({ $, log, formats: () => formats, setScreen, startRound, resumeSaved });

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
$('notebook-open').addEventListener('click', openNotebookFromHome);
$('play-notebook').addEventListener('click', openNotebookFromPlay);
$('notebook-leave').addEventListener('click', leaveNotebook);
$('found').addEventListener('click', pressFound);
$('make-keep').addEventListener('click', keepMade);
// 이름은 다 쓰고 나면(칸을 떠나거나 글자판의 들이기를 누르면) 고친다.
$('make-name-input').addEventListener('change', () => {
  if (madeId) notebook.rename(madeId, $('make-name-input').value);
});
$('leave').addEventListener('click', askLeave);
$('side-back').addEventListener('click', backToOrigin);
$('undo').addEventListener('click', () => F.undo());
$('reset').addEventListener('click', () => F.reset());
// "막혔어요"의 세 고르기의 글은 대본에 있다.
for (const choice of Object.keys(HELP)) {
  $(`stuck-${choice}`).textContent = C.stuck.choices[choice];
  $(`stuck-${choice}`).addEventListener('click', () => pickHelp(choice));
}
$('stuck').addEventListener('click', () => toggleStuck());
$('stuck-close').addEventListener('click', () => toggleStuck(false));
$('smaller').addEventListener('click', openSide);
$('why').addEventListener('click', openWhy);
$('leave-solution').addEventListener('click', leaveWithSolution);
$('leave-go').addEventListener('click', leaveQuietly);
$('leave-stay').addEventListener('click', stay);
$('feelings').addEventListener('click', (event) => {
  const value = event.target.closest('button')?.dataset.feeling;
  if (value) setFeeling(value);
});
$('after-back').addEventListener('click', backToOrigin);
$('after-more').addEventListener('click', moreSide);
$('after-same').addEventListener('click', () => chooseAfter('same'));
$('after-harder').addEventListener('click', () => chooseAfter('harder'));
$('after-make').addEventListener('click', () => chooseAfter('make'));
$('after-stop').addEventListener('click', () => chooseAfter('stop'));
$('after-solution').addEventListener('click', openSolution);
$('sheet-prev').addEventListener('click', () => turnSheet(-1));
$('sheet-next').addEventListener('click', () => turnSheet(1));
$('sheet-close').addEventListener('click', closeSheet);
$('make-leave').addEventListener('click', showHome);

// 아이가 무엇이든 누르면 돌아와서 묻던 말은 끝난 것이다(그 누름에 형식이 하는 말부터 다시 들린다).
for (const type of ['pointerdown', 'keydown', 'click']) {
  addEventListener(
    type,
    () => {
      asking = false;
    },
    true,
  );
}

// 글자판이 있는 기기에서는 글자판으로 답할 수도 있다(형식이 맡는다).
addEventListener('keydown', (event) => {
  if (screen === 'home' && event.key === 'Escape' && !$('make-menu').hidden) showMakeMenu(false);
  if (screen !== 'play' || !round) return;
  if (event.key === 'Escape' && stuckOpen) {
    toggleStuck(false);
    return;
  }
  if (round.done || sheet) return;
  // 왼쪽 칸의 단추("막혔어요"와 세 고르기, 도구)를 글자판으로 누르는 것은 그 단추의 일이다. 답으로 받지 않는다.
  if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof Element && event.target.closest('.side button')) return;
  F.onKey(event);
});

// 화면을 가리거나 닫을 때: 시계를 멈추고 하던 판을 적어 둔다. 돌아오면 그대로 이어진다.
function goAway() {
  if (screen !== 'play' || !round || round.done || clockSince === null) return;
  const now = new Date().toISOString();
  note('away');
  stopClock();
  persist();
  log.saveRecord({ ...toRecord('left'), endedAt: now });
  // 작은 판을 하던 중이면 간직해 둔 원래 판의 기록도 남긴다(이대로 앱이 닫혀도 원래 판이 하던 판이다).
  if (origin) log.saveRecord({ ...toRecord('left', origin.round), endedAt: now });
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
