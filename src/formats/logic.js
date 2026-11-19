// 참말 섬: 판 화면에서 이 형식이 맡는 부분(판, 쳐 보기, 따라가 보기, 답하는 칸, 맞혔을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/logic.json)과 index.html에 있다. 말의 틀도 대본에 있다. 이 파일에는 글을 적지 않는다.
//
// 이 앱의 첫 "읽고 따지는" 형식이다. 판의 종류(mode)는 단계가 정한다.
//   pair  주민 둘. 누가 무엇인지 고른다(1단계. "따라가 보기"가 처음부터 켜져 있다)
//   box   상자 셋과 글, 조건 한 줄. 보물이 든 상자를 고른다(2단계)
//   folk  주민 셋(또는 직접 만든 판). 누가 무엇인지, 또는 거짓말쟁이가 몇 명인지. "이렇게 말할 수는 없어요"도 답이다(3단계)
//   road  주민 셋과 갈림길. 마을로 가는 길을 고른다(4단계)
//   some  주민 둘과 "적어도 한 명", "이거나"가 든 말. 누가 무엇인지 고른다(5단계)
//   day   요일 섬. 주민마다 거짓말하는 요일이 정해져 있다. 오늘이 무슨 요일인지 고른다(6단계)
//   ask   질문 고르기. 갈림길의 주민 하나(종류 모름)와 질문 넷. 한 번 물어 길을 알 수 있는 질문을 고른다(7단계)
//         되묻는 질문은 "제가 ‘…’라고 물으면, 하마는 ‘예’라고 대답할 건가요?" 한 꼴뿐이다(2026-11 화면 글 점검).
//
// 쳐 보기: 주민마다(갈림길 판은 길도, 상자 판은 상자마다) 단추가 있어 "모름 → 참말쟁이 → 거짓말쟁이"를 돌려 가며 고른다.
//   요일 판은 한 주의 요일마다 "오늘이라고 쳐 보기"가 있다(주민의 종류는 쳐 본 요일로 정해진다).
//   쳐 보기 단추는 늘 쓸 수 있다(메모 노릇). 답이 아니다.
// 따라가 보기: 쳐 본 대로 두면, 말마다 그 가정에서 참인지 거짓인지를 적고, 말한 주민의 쳐 본 종류와 어긋나는 말을 눈에 띄게 한다.
//   1단계에서는 처음부터 켜져 있고, 2단계부터는 힌트 칸의 단추로 켠다(처음 켤 때 힌트 하나를 연 것으로 적는다).
// 틀린 답에는 판정하지 않는다. 그 답에서 어긋나게 되는 첫 말을 짚어 "~것 같아요"로 말하고, 그 말을 눈에 띄게 한다.
import T from '../content/logic.json';
import { tuningFor } from '../core/level.js';
import { LADDER, MAKE_LEVEL, OLD_MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/logic-ladder.js';
import {
  DAYS,
  MAX_SAYS,
  SIDES,
  blankGuess,
  checkBoard,
  dayWorld,
  diagnose,
  follow,
  guessFull,
  judgeQuestion,
  labelTemplate,
  noteKeys,
  questionTemplate,
  questionWorlds,
  replyOf,
  sayTemplate,
  solve,
  worldsOf,
} from '../core/logic.js';
import { smallerLogic } from '../core/smaller.js';
import { fill } from '../core/text.js';
import { boardCard, drawBoard, drawChoices, drawMini, replyTable } from '../ui/logic-board.js';

const FORMAT = 'logic';
const MODES = ['pair', 'box', 'folk', 'road', 'some', 'day', 'ask'];
/** 직접 만들기: 주민 수, 처음 판 */
const MAKE_PEOPLE = [2, 3];
const FIRST_DRAFT = { people: 2, says: [] };
/** 직접 만들기에서 고를 수 있는 말의 틀(틀의 이름은 대본의 make.templates에 있다) */
const TEMPLATES = ['me', 'is', 'pair-me', 'all', 'liars', 'some'];
/** "왜 그럴까?"가 열리는 판 수(level.js의 임시값) */
const WHY_ROUNDS = tuningFor(FORMAT).whyRounds;
/** 판 고르기에서 6단계(요일 섬)의 그림에 칠할 거짓말 요일(보기일 뿐, 판과는 상관없다) */
const PICTURE_LIES = [
  [0, 1, 2],
  [3, 4],
];

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createLogic(frame) {
  const { $, log } = frame;
  let draft = null; // 직접 만들기에서 만들던 판 { people, says }
  let chosen = { by: 0, tpl: null, who: null, opt: null }; // 직접 만들기에서 고르는 중인 말
  let draftUnique = false; // 풀이 프로그램이 "하나로 정해져요"라고 알려 준 뒤인가(판을 바꾸면 지운다)

  // ---- 판의 글 ----
  const animalOf = (board, index) => T.animals[board.people[index]];
  const nameOf = (board, index) => animalOf(board, index).name;
  const kindWord = (kind) => T.kinds[kind ? 'knight' : 'liar'];
  const markOf = (kind) => (kind === null || kind === undefined ? null : kind ? 'knight' : 'liar');
  const copy = (value) => JSON.parse(JSON.stringify(value));
  /** 작은 그림(처음 화면, 하던 판, 공책)에 그릴 것 */
  const miniOf = (board) => {
    if (board.kind === 'box') return { boxes: board.labels.length };
    const faces = board.people.map((animal) => T.animals[animal].face);
    if (board.kind === 'day') return { faces, week: DAYS, lies: board.lies };
    if (board.kind === 'question') return { faces, ask: T.home.blank, fork: true };
    return { faces, fork: board.kind === 'road' };
  };

  /** 말 하나의 글: 틀의 열쇠와 끼울 값(src/core/logic.js의 sayTemplate)으로 대본의 틀을 채운다. */
  function sayText(board, say) {
    const [key, values] = sayTemplate(say);
    return fill(T.says[key], {
      a: values.a === undefined ? '' : nameOf(board, values.a),
      b: values.b === undefined ? '' : nameOf(board, values.b),
      n: values.n === undefined ? '' : T.counts[values.n],
      ak: values.ak === undefined ? '' : kindWord(values.ak),
      bk: values.bk === undefined ? '' : kindWord(values.bk),
      day: values.day === undefined ? '' : T.days[values.day],
    });
  }

  /** 질문 하나의 글(src/core/logic.js의 questionTemplate). 묻는 상대(판의 주민 하나)는 이름으로 부른다. */
  function questionText(board, question) {
    const [key, values] = questionTemplate(question);
    const a = nameOf(board, 0);
    if (key === 'would') return fill(T.questions.would, { text: questionText(board, question.inner), a });
    return fill(T.questions[key], { side: values.side === undefined ? '' : T.sides[values.side], a });
  }
  const questionNo = (at) => fill(T.questionNo, { no: T.ordinals[at] });
  const replyWord = (reply) => T.reply[reply ? 'yes' : 'no'];
  /** 요일 판에서 쳐 본 요일(없으면 null). 예전에 적어 둔 가정에는 day가 없다. */
  const dayOf = (guess) => (Number.isInteger(guess.day) ? guess.day : null);

  /** 판 위에 적는 약속: 그 판의 말에 들어 있는 낱말("같은 종류", "적어도 한 명", "이거나", "우리")의 뜻 */
  const notesOf = (board) => noteKeys(board).map((key) => T.notes[key]);

  /** 상자의 글(at번째 상자에 붙은 글). 자기 상자를 가리키면 "이 상자"로 적는다. */
  function labelText(label, at) {
    const [key, values] = labelTemplate(label, at);
    return fill(T.labels[key], { a: values.a === undefined ? '' : T.boxes[values.a], b: values.b === undefined ? '' : T.boxes[values.b] });
  }
  const boxName = (at) => fill(T.boxName, { a: T.boxes[at] });
  const ruleText = (rule) => T.boxRules[`${rule.of}-${rule.n}`];
  /** 판 위의 한 줄이 세는 글(참인 글이나 거짓인 글)의 수. 따라가 보기는 참인 글의 수를 준다. */
  const countedOf = (board, trueCount) => (board.rule.of === 'true' ? trueCount : board.labels.length - trueCount);

  /**
   * 판의 그림. 누를 수 있는 판에서는 쳐 보기 단추를 붙인다.
   * @param {object} board
   * @param {object} guess 쳐 본 것
   * @param {{live?: boolean, show?: boolean, flag?: number|null, small?: boolean, sure?: boolean, pick?: number|null}} options show: 따라가 보기를 보여 주는가, sure: 쳐 본 것이 아니라 풀이다(물음표 없이 적는다), pick: 질문 판에서 답으로 고른 질문
   */
  function viewOf(board, guess, { live = false, show = false, flag = null, small = false, sure = false, pick = null } = {}) {
    const followed = follow(board, guess);
    const view = { live, small, notes: notesOf(board) };
    const today = board.kind === 'day' ? dayOf(guess) : null;
    const personView = (index) => {
      const what = guess.kinds[index] === null ? T.guessUi.unknown : kindWord(guess.kinds[index]);
      return {
        name: nameOf(board, index),
        face: animalOf(board, index).face,
        mark: markOf(guess.kinds[index]),
        sign: guess.kinds[index] === null ? (live ? T.guessUi.unknown : null) : sure ? kindWord(guess.kinds[index]) : T.guessUi.sign[markOf(guess.kinds[index])],
        button: T.guessUi.person,
        label: fill(T.guessUi.personLabel, { name: nameOf(board, index), what }),
        focus: `p${index}`,
        onTap: live ? () => press(`p${index}`) : undefined,
      };
    };
    const forkView = () => {
      const what = guess.road === null ? T.guessUi.unknown : T.sides[guess.road];
      return {
        title: T.fork.title,
        names: T.sides,
        mark: guess.road,
        sign: guess.road === null ? (live ? T.guessUi.unknown : null) : sure ? fill(T.guessUi.roadSure, { side: T.sides[guess.road] }) : fill(T.guessUi.roadSign, { side: T.sides[guess.road] }),
        button: T.guessUi.road,
        label: fill(T.guessUi.roadLabel, { what }),
        focus: 'road',
        onTap: live ? () => press('road') : undefined,
      };
    };
    if (board.kind === 'box') {
      view.rule = { text: ruleText(board.rule), tag: null, fits: null };
      if (show && guess.box !== null) {
        // 판 위의 한 줄이 거짓인 글을 세면 거짓인 글을, 참인 글을 세면 참인 글을 센다.
        const key = board.rule.of === 'true' ? 'count' : 'count-false';
        const counted = countedOf(board, followed.count);
        view.rule.tag = counted === 0 ? T.follow[`${key}-zero`] : fill(T.follow[key], { n: counted });
        view.rule.fits = followed.fits;
      }
      view.boxes = board.labels.map((label, at) => {
        const truth = show ? followed.truths[at] : null;
        return {
          name: boxName(at),
          text: labelText(label, at),
          mark: guess.box === at ? T.guessUi.boxMark : '',
          chosen: guess.box === at,
          truth,
          tag: truth === null ? null : T.follow[truth ? 'true' : 'false'],
          flagged: flag === at,
          button: guess.box === at ? T.guessUi.boxOn : T.guessUi.box,
          label: fill(T.guessUi.boxLabel, { name: boxName(at) }),
          focus: `b${at}`,
          onTap: live ? () => press(`b${at}`) : undefined,
        };
      });
      return view;
    }
    if (board.kind === 'day') {
      // 요일 판에는 주민 카드가 없다. 주민마다 한 주의 줄이 있고, 쳐 본 요일에 그 주민이 거짓말하는 날인지는 그 줄의 테두리로 보인다.
      const kinds = today === null ? null : dayWorld(board, today).kinds;
      view.week = {
        title: T.week.title,
        heads: T.dayShort.map((text, day) => ({
          text,
          sign: today === day ? T.guessUi[sure ? 'daySure' : 'daySign'] : '',
          chosen: today === day,
          label: fill(T.guessUi.dayLabel, { day: T.days[day] }),
          focus: `d${day}`,
          onTap: live ? () => press(`d${day}`) : undefined,
        })),
        rows: board.people.map((_, index) => ({
          name: nameOf(board, index),
          face: animalOf(board, index).face,
          mark: kinds === null ? null : markOf(kinds[index]),
          cells: Array.from({ length: DAYS }, (_, day) => (board.lies[index].includes(day) ? T.week.lie : '')),
        })),
      };
    } else view.people = board.people.map((_, index) => personView(index));
    if (board.kind === 'road' || board.kind === 'question') view.fork = forkView();
    if (board.kind === 'question') {
      view.questions = board.questions.map((question, at) => {
        const reply = show ? followed.replies[at] : null;
        return {
          no: questionNo(at),
          text: questionText(board, question),
          tag: !show ? null : reply === null ? T.follow.unknown : fill(T.follow.reply, { reply: replyWord(reply) }),
          chosen: pick === at,
          focus: `q${at}`,
          onTap: live ? () => pickAnswer('question', at) : undefined,
        };
      });
      return view;
    }
    view.says = board.says.map((say, index) => {
      const item = followed.says[index];
      const clash = show && item.clash;
      const kind = board.kind === 'day' ? dayWorld(board, today ?? 0).kinds[say.by] : guess.kinds[say.by];
      return {
        name: nameOf(board, say.by),
        face: animalOf(board, say.by).face,
        text: sayText(board, say),
        truth: show ? item.truth : null,
        tag: !show ? null : item.truth === null ? T.follow.unknown : T.follow[item.truth ? 'true' : 'false'],
        clash,
        clashText: clash ? T.follow[`${board.kind === 'day' ? 'clash-day-' : 'clash-'}${kind ? 'knight' : 'liar'}`] : null,
        flagged: flag === index,
      };
    });
    return view;
  }

  /** 판 아래의 한 줄: 따라가 보기가 켜져 있을 때, 어긋나는 말이 몇 개인지(상자 판은 판 위의 한 줄과 들어맞는지) */
  function statusOf(round) {
    const { board, guess } = round;
    if (!round.follow || board.kind === 'question') return '';
    const followed = follow(board, guess);
    if (board.kind === 'box') return guess.box === null ? '' : T.status[followed.fits ? 'box-fits' : 'box-misfit'];
    const clashes = followed.says.filter((item) => item.clash).length;
    if (clashes > 0) return fill(T.status.clash, { n: clashes });
    if (followed.done) return T.status.fits;
    return guess.kinds.some((kind) => kind !== null) || guess.road !== null || dayOf(guess) !== null ? T.status.open : '';
  }

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const playing = !round.done;
    drawBoard($('logic-board'), viewOf(round.board, round.guess, { live: playing, show: round.follow, flag: round.flag, pick: round.pick.question ?? null }));
    $('logic-status').textContent = statusOf(round);
    $('undo').disabled = !playing || round.trail.length === 0;
    $('reset').disabled = !playing || round.trail.length === 0;
    $('logic-follow').textContent = T.tool[round.follow ? 'on' : 'off'];
    $('logic-follow').setAttribute('aria-pressed', String(round.follow));
    drawPad();
    frame.showWhy();
  }

  /** 쳐 보기 단추를 눌렀다: 주민은 모름 → 참말쟁이 → 거짓말쟁이 → 모름, 길은 모름 → 왼쪽 → 오른쪽 → 모름, 상자와 요일은 고르거나 지운다. */
  function press(key) {
    const { round } = frame;
    if (round.done) return;
    const guess = round.guess;
    let from;
    let to;
    if (key.startsWith('d')) {
      const at = Number(key.slice(1));
      from = dayOf(guess);
      to = from === at ? null : at;
      guess.day = to;
    } else if (key === 'road') {
      from = guess.road;
      to = from === null ? SIDES[0] : from === SIDES[0] ? SIDES[1] : null;
      guess.road = to;
    } else if (key.startsWith('b')) {
      const at = Number(key.slice(1));
      from = guess.box;
      to = from === at ? null : at;
      guess.box = to;
    } else {
      const at = Number(key.slice(1));
      from = guess.kinds[at];
      to = from === null ? true : from === true ? false : null;
      guess.kinds[at] = to;
    }
    round.trail.push({ key, from, to });
    round.moveCount += 1;
    round.flag = null;
    frame.note('guess', { at: key, to });
    draw();
    frame.persist();
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    const last = round.trail.pop();
    if (last.key.startsWith('d')) round.guess.day = last.from;
    else if (last.key === 'road') round.guess.road = last.from;
    else if (last.key.startsWith('b')) round.guess.box = last.from;
    else round.guess.kinds[Number(last.key.slice(1))] = last.from;
    round.undoCount += 1;
    round.flag = null;
    frame.note('undo');
    draw();
    frame.persist();
  }

  function reset() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    round.guess = blankGuess(round.board);
    round.trail = [];
    round.resetCount += 1;
    round.flag = null;
    frame.note('reset');
    draw();
    frame.persist();
  }

  /** "따라가 보기 켜기": 쳐 본 대로 말이 참인지 거짓인지를 보여 준다. 처음부터 꺼져 있던 판에서 처음 켜면 힌트 하나를 연 것으로 적는다. */
  function toggleFollow() {
    const { round } = frame;
    if (!round) return;
    round.follow = !round.follow;
    if (!round.done) {
      round.followCount += 1;
      if (round.follow && !round.followDefault) round.followShown = true;
      frame.note('follow', { on: round.follow });
    }
    draw();
    frame.persist();
    if (round.follow && !round.done) frame.say(T.play[round.board.kind === 'box' ? 'follow-on-box' : round.board.kind === 'question' ? 'follow-on-ask' : 'follow-on'], 'point');
  }

  // ---- 답하는 칸 ----
  // 주민마다의 종류는 주민 판에서만 고른다(요일 판과 질문 판은 요일이나 질문을 고른다).
  const blankPick = (board) => ({ kinds: ['folk', 'road'].includes(board.kind) ? board.people.map(() => null) : [], n: null, side: null, box: null, day: null, question: null });

  function rowOf(cards, className = 'figure-row') {
    const row = document.createElement('div');
    row.className = className;
    row.append(...cards);
    return row;
  }

  function drawPad() {
    const { round } = frame;
    const { board, pick } = round;
    const ask = board.ask;
    const off = round.done;
    $('logic-kinds').hidden = ask !== 'kinds';
    $('logic-many').hidden = ask !== 'count';
    $('logic-roads').hidden = ask !== 'road';
    $('logic-boxes').hidden = ask !== 'box';
    $('logic-days').hidden = ask !== 'day';
    $('logic-asks').hidden = ask !== 'question';
    $('logic-none').hidden = round.mode !== 'folk';
    $('logic-none').disabled = off;
    // 질문 판에는 쳐 본 것을 옮길 답이 없다.
    $('logic-copy').hidden = ask === 'question';
    if (ask === 'kinds') {
      const rows = board.people.map((_, index) => {
        const row = document.createElement('div');
        row.className = 'logic-kind-row';
        const name = document.createElement('strong');
        name.textContent = nameOf(board, index);
        const choices = document.createElement('div');
        choices.className = 'segment';
        drawChoices(choices, {
          items: ['knight', 'liar'].map((kind) => ({ value: kind, text: T.kinds[kind], label: fill(T.pad.kindPick, { name: nameOf(board, index), kind: T.kinds[kind] }) })),
          value: markOf(pick.kinds[index]),
          disabled: off,
          onPick: (value) => pickAnswer('kind', index, value === 'knight'),
        });
        row.append(name, choices);
        return row;
      });
      $('logic-kind-rows').replaceChildren(...rows);
    }
    if (ask === 'count') {
      const picks = $('logic-count-picks');
      picks.style.setProperty('--n', String(board.people.length + 1));
      drawChoices(picks, {
        items: Array.from({ length: board.people.length + 1 }, (_, n) => ({ value: String(n), text: fill(T.pad.countPick, { n }), label: fill(T.pad.countLabel, { n }) })),
        value: pick.n === null ? null : String(pick.n),
        disabled: off,
        onPick: (value) => pickAnswer('count', Number(value)),
      });
    }
    if (ask === 'road') drawChoices($('logic-road-picks'), { items: SIDES.map((side) => ({ value: side, text: T.sides[side] })), value: pick.side, disabled: off, onPick: (value) => pickAnswer('road', value) });
    if (ask === 'box') {
      drawChoices($('logic-box-picks'), {
        items: board.labels.map((_, at) => ({ value: String(at), text: T.boxes[at], label: boxName(at) })),
        value: pick.box === null ? null : String(pick.box),
        disabled: off,
        onPick: (value) => pickAnswer('box', Number(value)),
      });
    }
    if (ask === 'day') {
      drawChoices($('logic-day-picks'), {
        items: T.dayShort.map((text, day) => ({ value: String(day), text, label: T.days[day] })),
        value: pick.day === null || pick.day === undefined ? null : String(pick.day),
        disabled: off,
        onPick: (value) => pickAnswer('day', Number(value)),
      });
    }
    if (ask === 'question') {
      drawChoices($('logic-ask-picks'), {
        items: board.questions.map((_, at) => ({ value: String(at), text: questionNo(at) })),
        value: pick.question === null || pick.question === undefined ? null : String(pick.question),
        disabled: off,
        onPick: (value) => pickAnswer('question', Number(value)),
      });
    }
    $('logic-copy').disabled = off || !canCopy(round);
    $('logic-submit').disabled = off || answerOf(round) === null;
  }

  /** 답을 고른다(아직 내지 않는다). */
  function pickAnswer(kind, at, value) {
    const { round } = frame;
    if (round.done) return;
    if (kind === 'kind') round.pick.kinds[at] = value;
    else if (kind === 'count') round.pick.n = at;
    else if (kind === 'road') round.pick.side = at;
    else if (kind === 'day') round.pick.day = at;
    else if (kind === 'question') round.pick.question = at;
    else round.pick.box = at;
    draw();
    frame.persist();
  }

  /** 쳐 본 것을 답으로 옮길 수 있는가 */
  function canCopy(round) {
    const { board, guess } = round;
    if (board.ask === 'kinds') return guess.kinds.some((kind) => kind !== null);
    if (board.ask === 'count') return guessFull(board, guess);
    if (board.ask === 'road') return guess.road !== null;
    if (board.ask === 'box') return guess.box !== null;
    if (board.ask === 'day') return dayOf(guess) !== null;
    return false;
  }

  /** "쳐 본 대로 고르기": 쳐 본 것을 답하는 칸에 옮긴다. */
  function copyGuess() {
    const { round } = frame;
    if (round.done || !canCopy(round)) return;
    const { board, guess, pick } = round;
    if (board.ask === 'kinds') guess.kinds.forEach((kind, index) => kind !== null && (pick.kinds[index] = kind));
    if (board.ask === 'count') pick.n = guess.kinds.filter((kind) => kind === false).length;
    if (board.ask === 'road') pick.side = guess.road;
    if (board.ask === 'box') pick.box = guess.box;
    if (board.ask === 'day') pick.day = dayOf(guess);
    round.copyCount += 1;
    frame.note('copy');
    draw();
    frame.persist();
  }

  /** 고른 답. 다 고르지 않았으면 null */
  function answerOf(round) {
    const { board, pick } = round;
    if (board.ask === 'kinds') return pick.kinds.every((kind) => kind !== null) ? { type: 'kinds', kinds: pick.kinds.slice() } : null;
    if (board.ask === 'count') return pick.n === null ? null : { type: 'count', n: pick.n };
    if (board.ask === 'road') return pick.side === null ? null : { type: 'road', side: pick.side };
    if (board.ask === 'day') return Number.isInteger(pick.day) ? { type: 'day', day: pick.day } : null;
    if (board.ask === 'question') return Number.isInteger(pick.question) ? { type: 'question', at: pick.question } : null;
    return pick.box === null ? null : { type: 'box', at: pick.box };
  }

  const answerText = (answer) =>
    answer.type === 'kinds' ? `kinds:${answer.kinds.map((kind) => (kind ? 'T' : 'L')).join('')}` : answer.type === 'none' ? 'none' : `${answer.type}:${answer.n ?? answer.side ?? answer.at ?? answer.day}`;

  /** 답을 낸다. 틀렸으면 무엇을 놓쳤을지 짐작해서 말하고, 짚은 말을 눈에 띄게 한다. */
  function submit(answer) {
    const { round } = frame;
    if (round.done || answer === null) return;
    const { board } = round;
    const result = diagnose(board, answer, round.guess);
    const text = answerText(answer);
    round.answers.push({ t: frame.stamp(), answer: text, correct: result.correct, guess: result.guess, say: result.say });
    frame.note('answer', { answer: text, correct: result.correct, guess: result.guess, say: result.say });
    if (result.correct) {
      round.flag = null;
      frame.finish('solved');
      return;
    }
    // 틀린 답: 깎이는 것도, 채점 표시도 없다. 어긋나게 되는 말을 짚어 판에서 직접 확인하게 한다.
    round.wrongCount += 1;
    round.flag = result.say;
    if (result.say !== null) round.flags.push(result.say);
    frame.persist();
    draw();
    frame.say(wrongLine(board, result, answer));
  }

  function wrongLine(board, result, answer) {
    if (result.say !== null) return fill(T.guess['kinds-clash'], { name: nameOf(board, board.says[result.say].by) });
    if (result.guess === 'count-clash') return answer.n === 0 ? T.guess['count-clash-zero'] : fill(T.guess['count-clash'], { n: T.counts[answer.n] });
    if (result.guess === 'road-clash') return fill(T.guess['road-clash'], { side: T.sides[answer.side] });
    if (result.guess === 'question-useless') return fill(T.guess['question-useless'], { reply: replyWord(result.reply) });
    if (result.guess === 'box-count') {
      // 판 위의 한 줄이 세는 글(참인 글이나 거짓인 글)로 센다.
      const counted = countedOf(board, result.count);
      const tail = board.rule.of === 'true' ? '' : '-false';
      return counted === 0 ? T.guess[`box-zero${tail}`] : fill(T.guess[`box-count${tail}`], { n: counted });
    }
    return T.guess['none-on-possible'];
  }

  /** 맞혔을 때 하는 말: 답과, 쳐 보기를 몇 번 바꿔 보고 알아냈는지. 따라가 보기를 켰는지는 말하지 않는다. */
  function rightLine(round, solution) {
    const { board } = round;
    const parts = [];
    if (round.answers.at(-1).answer === 'none') parts.push(T.right.none);
    else if (board.ask === 'kinds') {
      const list = solution.kinds.map((kind, index) => fill(T.right.kind, { name: nameOf(board, index), kind: kindWord(kind) })).join(T.right.join);
      parts.push(fill(T.right.kinds, { list }));
    } else if (board.ask === 'count') parts.push(fill(T.right.count, { n: T.counts[solution.answer] }));
    else if (board.ask === 'road') parts.push(fill(T.right.road, { side: T.sides[solution.answer] }));
    else if (board.ask === 'day') parts.push(fill(T.right.day, { day: T.days[solution.answer] }));
    else if (board.ask === 'question') parts.push(T.right.question);
    else parts.push(fill(T.right.box, { a: T.boxes[solution.answer] }));
    parts.push(round.moveCount > 0 ? fill(T.right.presses, { n: round.moveCount }) : T.right['no-presses']);
    if (round.answers.length > 1) parts.push(T.right['after-retry']);
    // 이 형식의 판을 정해 둔 수만큼 끝까지 했으면 "왜 그럴까?"가 생겼다고 알려 준다(남는 배정이 없는 판에서는 틀이 알린다).
    const finished = frame.records().filter((record) => record.kind === 'round' && record.format === FORMAT && (record.outcome === 'solved' || record.outcome === 'solution'));
    if (!round.side && solution.possible !== false && finished.length === WHY_ROUNDS) parts.push(T.right['why-invite']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  const guessOfWorld = (board, world) => ({ kinds: world.kinds.slice(), road: board.kind === 'road' ? world.road : null, box: null, day: null });

  /** 풀이: 모든 말이 들어맞는 경우(들)를 쳐 본 것처럼 그려서 보여 준다. 질문 고르기는 네 경우의 대답을 표로 보여 준다. */
  function solutionPages(round, solution) {
    const { board } = round;
    if (board.kind === 'question') {
      const worlds = questionWorlds();
      const heads = worlds.map((world) => fill(T.solution.case, { kind: kindWord(world.kinds[0]), side: T.sides[world.road] }));
      const rows = board.questions.map((question, at) => {
        const useful = judgeQuestion(question).useful;
        return { no: questionNo(at), text: questionText(board, question), cells: worlds.map((world) => replyWord(replyOf(question, world))), mark: T.solution[useful ? 'useful' : 'useless'], useful };
      });
      return [{ say: T.solution.ask, nodes: [replyTable({ heads, rows })] }];
    }
    if (board.kind === 'day') {
      const guess = { ...blankGuess(board), day: solution.answer };
      return [{ say: fill(T.solution.day, { day: T.days[solution.answer] }), nodes: [rowOf([boardCard(viewOf(board, guess, { show: true, sure: true }), '')])] }];
    }
    if (board.kind === 'box') {
      const guess = { ...blankGuess(board), box: solution.answer };
      return [{ say: fill(T.solution.box, { a: T.boxes[solution.answer] }), nodes: [rowOf([boardCard(viewOf(board, guess, { show: true }), '')])] }];
    }
    if (solution.possible === false) return [{ say: T.solution.none, nodes: [rowOf([boardCard(viewOf(board, blankGuess(board)), '')])] }];
    const cards = worldsOf(board).map((world) => boardCard(viewOf(board, guessOfWorld(board, world), { show: true, sure: true }), ''));
    const say =
      board.ask === 'kinds'
        ? T.solution.kinds
        : board.ask === 'count'
          ? fill(T.solution.count, { n: T.counts[solution.answer] })
          : fill(T.solution.road, { side: T.sides[solution.answer] });
    return [{ say, nodes: [rowOf(cards)] }];
  }

  /** "왜 그럴까?": 선생님이 어떻게 알아챘는지의 이야기. 그림은 대본에 적은 판을 쳐 본 대로 따라가 본 모습이다. */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [
          rowOf(
            slide.figures.map((item) => {
              const guess = item.box === undefined ? { kinds: item.guess.slice(), road: null, box: null } : { kinds: [], road: null, box: item.box };
              return boardCard(viewOf(item.board, guess, { show: true }), item.note);
            }),
          ),
        ];
      },
    }));
  }

  // ---- 직접 만들기: 주민 수를 정하고, 누가 무슨 말을 할지 골라 붙인다. ----
  const draftBoard = () => ({ kind: 'folk', people: Array.from({ length: draft.people }, (_, index) => index), says: draft.says.map(copy), ask: 'kinds' });
  const draftOk = (value) =>
    Boolean(value) &&
    MAKE_PEOPLE.includes(value.people) &&
    Array.isArray(value.says) &&
    value.says.length <= MAX_SAYS &&
    (value.says.length === 0 || checkBoard({ kind: 'folk', people: Array.from({ length: value.people }, (_, index) => index), says: value.says, ask: 'kinds' }) === null);

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    return draftOk(saved) ? { people: saved.people, says: saved.says.map(copy) } : copy(FIRST_DRAFT);
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    chosen = { by: 0, tpl: null, who: null, opt: null };
    draftUnique = false;
    $('logic-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  /** 고르는 중인 말. 다 고르지 않았으면 null */
  function chosenSay() {
    const { by, tpl, who, opt } = chosen;
    if (tpl === null || by >= draft.people) return null;
    const kind = opt === 'knight' ? true : opt === 'liar' ? false : null;
    if (tpl === 'some') return { by, s: { t: 'some' } };
    if (tpl === 'me') return kind === null ? null : { by, s: { t: 'me', k: kind } };
    if (tpl === 'all') return kind === null ? null : { by, s: { t: 'all', k: kind } };
    if (tpl === 'liars') return Number.isInteger(opt) ? { by, s: { t: 'liars', n: opt } } : null;
    if (who === null || who === by || who >= draft.people) return null;
    if (tpl === 'is') return kind === null ? null : { by, s: { t: 'is', who, k: kind } };
    return opt === 'same' || opt === 'diff' ? { by, s: { t: opt, a: Math.min(by, who), b: Math.max(by, who) } } : null;
  }

  function drawMake() {
    const board = draftBoard();
    const names = board.people.map((_, index) => nameOf(board, index));
    for (const button of $('logic-make-people').querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.people) === draft.people));
    drawChoices($('logic-make-by'), { items: names.map((name, index) => ({ value: String(index), text: name })), value: String(chosen.by), onPick: (value) => choose({ by: Number(value), who: null }) });
    $('logic-make-count').textContent = fill(T.make.count, { n: draft.says.length });
    $('logic-make-undo').disabled = draft.says.length === 0;
    $('logic-make-clear').disabled = draft.says.length === 0;
    drawBoard($('logic-make-board'), { people: board.people.map((_, index) => ({ name: names[index], face: animalOf(board, index).face, mark: null })), says: board.says.map((say) => ({ name: names[say.by], face: animalOf(board, say.by).face, text: sayText(board, say) })), notes: notesOf(board) });
    drawChoices($('logic-make-kinds'), { items: TEMPLATES.map((tpl) => ({ value: tpl, text: T.make.templates[tpl] })), value: chosen.tpl, onPick: (value) => choose({ tpl: value, opt: null }) });
    const needWho = chosen.tpl === 'is' || chosen.tpl === 'pair-me';
    $('logic-make-who-note').hidden = !needWho;
    $('logic-make-who').hidden = !needWho;
    if (needWho) {
      drawChoices($('logic-make-who'), {
        items: names.map((name, index) => ({ value: String(index), text: name })).filter((item) => Number(item.value) !== chosen.by),
        value: chosen.who === null ? null : String(chosen.who),
        onPick: (value) => choose({ who: Number(value) }),
      });
    }
    const options =
      chosen.tpl === 'pair-me' ? ['same', 'diff'].map((value) => ({ value, text: T.make.options[value] })) : chosen.tpl === 'liars' ? board.people.map((_, index) => ({ value: String(index + 1), text: fill(T.pad.countPick, { n: index + 1 }) })) : ['me', 'is', 'all'].includes(chosen.tpl) ? ['knight', 'liar'].map((value) => ({ value, text: T.make.options[value] })) : [];
    $('logic-make-opt').hidden = options.length === 0;
    drawChoices($('logic-make-opt'), { items: options, value: chosen.opt === null ? null : String(chosen.opt), onPick: (value) => choose({ opt: chosen.tpl === 'liars' ? Number(value) : value }) });
    const say = chosenSay();
    const twice = say !== null && draft.says.some((other) => JSON.stringify(other) === JSON.stringify(say));
    $('logic-make-preview').textContent = say === null ? T.make.pick : fill(T.make.preview, { name: names[say.by], text: sayText(board, say) });
    $('logic-make-add').disabled = say === null || twice || draft.says.length >= MAX_SAYS;
    $('logic-make-solve').disabled = draft.says.length === 0;
    $('logic-make-play').disabled = !draftUnique;
  }

  function choose(change) {
    chosen = { ...chosen, ...change };
    drawMake();
  }

  function changeDraft(next) {
    if (!draftOk(next)) return;
    draft = next;
    draftUnique = false;
    $('logic-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    if (chosen.by >= draft.people) chosen = { ...chosen, by: 0 };
    if (chosen.who !== null && chosen.who >= draft.people) chosen = { ...chosen, who: null };
    drawMake();
  }

  /** 주민 수를 바꾼다. 없어진 주민이 하거나 가리키는 말은 뺀다. */
  function setPeople(people) {
    const fits = (say) => checkBoard({ kind: 'folk', people: Array.from({ length: people }, (_, index) => index), says: [say], ask: 'kinds' }) === null;
    changeDraft({ people, says: draft.says.filter(fits) });
  }

  function addSay() {
    const say = chosenSay();
    if (say === null || draft.says.length >= MAX_SAYS || draft.says.some((other) => JSON.stringify(other) === JSON.stringify(say))) return;
    chosen = { ...chosen, tpl: null, who: null, opt: null };
    changeDraft({ ...draft, says: [...draft.says, say] });
  }

  /** 아이가 만든 판을 풀이 프로그램으로 풀어서, 맞는 배정이 없는지, 하나인지, 여럿인지 알려 준다(누가 누구인지는 알려 주지 않는다). */
  function solveDraft() {
    if (draft.says.length === 0) return;
    const board = draftBoard();
    const worlds = worldsOf(board);
    // 말이 꽉 찼으면(MAX_SAYS개) 더 붙여 보자고 하지 않는다.
    const many = draft.says.length >= MAX_SAYS ? T.make['many-full'] : T.make.many;
    const line = worlds.length === 0 ? T.make.none : worlds.length === 1 ? T.make.one : fill(many, { k: worlds.length });
    draftUnique = worlds.length === 1;
    $('logic-make-result').textContent = line;
    drawMake();
    const now = new Date().toISOString();
    const solved = solve(board);
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { possible: solved.possible, worlds: worlds.length, answer: solved.answer },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 누가 누구인지 하나로 정해지는 판은 직접 풀어 볼 수 있다. */
  /** 다 만든 판(공책에 남기거나 풀어 볼 판). 풀이 프로그램이 답이 하나로 정해진다고 알려 준 뒤에만 있다 */
  const madeBoard = () => (draftUnique ? draftBoard() : null);

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('logic-follow').addEventListener('click', toggleFollow);
  $('logic-copy').addEventListener('click', copyGuess);
  $('logic-submit').addEventListener('click', () => submit(answerOf(frame.round)));
  $('logic-none').addEventListener('click', () => submit({ type: 'none' }));
  $('logic-make-people').addEventListener('click', (event) => {
    const people = Number(event.target.closest('button')?.dataset.people);
    if (MAKE_PEOPLE.includes(people) && people !== draft.people) setPeople(people);
  });
  $('logic-make-add').addEventListener('click', addSay);
  $('logic-make-undo').addEventListener('click', () => changeDraft({ ...draft, says: draft.says.slice(0, -1) }));
  $('logic-make-clear').addEventListener('click', () => changeDraft({ ...draft, says: [] }));
  $('logic-make-solve').addEventListener('click', solveDraft);
  $('logic-make-play').addEventListener('click', playDraft);

  const count = (value) => Number.isInteger(value) && value >= 0;
  const guessOk = (board, guess) => {
    if (!guess || typeof guess !== 'object' || !Array.isArray(guess.kinds)) return false;
    const blank = blankGuess(board);
    if (guess.kinds.length !== blank.kinds.length || !guess.kinds.every((kind) => kind === null || kind === true || kind === false)) return false;
    if (!(guess.road === null || SIDES.includes(guess.road))) return false;
    // 요일은 요일 판에서만 쳐 본다(예전에 적어 둔 가정에는 day가 없다).
    if (!(guess.day === undefined || guess.day === null || (board.kind === 'day' && count(guess.day) && guess.day < DAYS))) return false;
    return guess.box === null || (board.kind === 'box' && count(guess.box) && guess.box < board.labels.length);
  };

  /** 판의 종류: 상자, 갈림길, 요일, 질문은 판이 정하고, 주민 판은 단계(1단계 주민 둘, 5단계 "적어도 한 명")로 가른다. */
  const modeOf = (board, level, custom) => {
    const own = { box: 'box', road: 'road', day: 'day', question: 'ask' }[board.kind];
    if (own) return own;
    const rung = custom ? null : rungOf(level);
    return rung && (rung.mode === 'pair' || rung.mode === 'some') ? rung.mode : 'folk';
  };

  /**
   * 적어 둔 하던 판의 단계가 판과 맞는가. 만들어 낸 판은 그 단계의 판이어야 한다.
   * 직접 만든 판은 지금의 직접 만들기 단계(8단계)와, 5~7단계를 더하기 전의 직접 만들기 단계(5단계)를 모두 받는다.
   */
  const levelOk = (saved) => {
    if (saved.custom === true) return [MAKE_LEVEL, OLD_MAKE_LEVEL].includes(saved.level) && saved.mode === 'folk' && saved.board.kind === 'folk';
    return Number.isInteger(saved.level) && saved.level >= LADDER[0].level && saved.level <= TOP_LEVEL && saved.mode === modeOf(saved.board, saved.level, false);
  };

  return {
    id: FORMAT,
    T,
    padId: 'logic-pad',
    makeId: 'make-logic',
    homeIds: { sample: 'home-logic-sample', blank: 'home-logic-blank', ask: 'home-logic-ask', play: 'home-logic-play', pick: 'home-logic-pick', make: 'home-logic-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    /** 새 판에서 이 형식이 맡는 값 */
    begin({ level, custom, board }) {
      const mode = modeOf(board, level, custom);
      // 1단계의 판에서는 따라가 보기가 처음부터 켜져 있다(작은 판과 직접 만든 판은 꺼져 있다).
      const followDefault = mode === 'pair' && rungOf(level).follow === true;
      return {
        mode,
        board: copy(board), // 판: 주민들과 말, 또는 상자들과 글과 판 위의 한 줄
        guess: blankGuess(board), // 쳐 본 것: 주민마다(참말쟁이 true, 거짓말쟁이 false, 모름 null), 길, 상자
        trail: [], // 처음으로 되돌린 뒤 쳐 보기를 바꾼 차례 { key, from, to }
        moveCount: 0, // 이 판에서 쳐 보기를 바꾼 횟수(무르고 되돌린 것까지 모두)
        undoCount: 0,
        resetCount: 0,
        copyCount: 0, // "쳐 본 대로 고르기"를 누른 수
        follow: followDefault, // 지금 따라가 보기가 켜져 있는가
        followDefault, // 처음부터 켜져 있던 판인가
        followShown: false, // 꺼져 있던 판에서 아이가 켜 보았는가
        followCount: 0, // 따라가 보기 단추를 누른 수
        pick: blankPick(board), // 답하는 칸에서 고르는 중인 답
        flag: null, // 틀린 답에서 짚은 말(판에서 눈에 띄게 한다. 쳐 보기를 바꾸면 지운다)
        flags: [], // 짚은 말들
        wrongCount: 0, // 틀린 답의 수
      };
    },
    solve(round) {
      return solve(round.board);
    },
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null || solve(saved.board).possible === null || !levelOk(saved)) return false;
      if (!guessOk(saved.board, saved.guess) || !Array.isArray(saved.trail) || !Array.isArray(saved.flags)) return false;
      if (![saved.moveCount, saved.undoCount, saved.resetCount, saved.copyCount, saved.followCount, saved.wrongCount].every(count)) return false;
      if (typeof saved.follow !== 'boolean' || typeof saved.followDefault !== 'boolean' || typeof saved.followShown !== 'boolean') return false;
      const pick = saved.pick;
      return Boolean(pick) && Array.isArray(pick.kinds) && pick.kinds.length === blankPick(saved.board).kinds.length && (saved.flag === null || count(saved.flag));
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 따라가 보기 단추)을 보이거나 감춘다 */
    showParts(on) {
      $('logic-board').hidden = !on;
      $('logic-foot').hidden = !on;
      $('logic-follow').hidden = !on;
    },
    enter() {},
    draw,
    ended() {},
    // 5단계(주민 둘, "적어도 한 명")의 규칙은 1단계와 같다.
    ruleLine: (round) => T.rules[round.mode === 'folk' && round.board.ask === 'count' ? 'count' : round.mode === 'some' ? 'pair' : round.mode],
    // 상자 판은 판 위의 한 줄이 세는 글(참인 글, 거짓인 글)에 맞춘 힌트를 낸다.
    hints: (round) => T.hints[round.mode === 'folk' && round.board.ask === 'count' ? 'count' : round.mode === 'box' && round.board.rule.of === 'false' ? 'box-false' : round.mode],
    touched: (round) => round.moveCount > 0 || round.copyCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view: (round) => ({ guess: copy(round.guess), pick: copy(round.pick), follow: round.follow, wrong: round.wrongCount }),
    /** 이 판보다 작은 판: 주민 셋은 주민 둘로, 상자 셋은 상자 둘로, 5단계의 말 둘은 말 하나로, 요일 섬의 주민 둘은 하나로, 질문 넷은 둘로. 1단계(주민 둘)의 판에는 없다 */
    smaller: (round, turn) => smallerLogic({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copy(round.board),
        solution: { possible: solution.possible, answer: solution.answer, worlds: solution.worlds },
        // 질문 힌트와 "따라가 보기 켜기"를 함께 센다(처음부터 켜져 있던 판은 세지 않는다).
        hintsOpened: round.hintsOpened + (round.followShown ? 1 : 0),
        follow: round.follow,
        followDefault: round.followDefault,
        followShown: round.followShown,
        followCount: round.followCount,
        // 판을 떠날 때 쳐 본 것과 고른 답, 처음으로 되돌린 뒤 쳐 보기를 바꾼 차례
        guess: copy(round.guess),
        pick: copy(round.pick),
        trail: round.trail,
        moveCount: round.moveCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        copyCount: round.copyCount,
        wrongCount: round.wrongCount,
        flags: round.flags,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    onKey() {},

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    /** 다음 판: 주민들의 모습이나 상자들. 요일 판은 한 주를, 질문 판은 물음표와 갈림길을 함께 그린다 */
    drawSample(root, board) {
      drawMini(root, miniOf(board));
    },
    drawBlank(root) {
      drawMini(root, { blank: T.home.blank });
    },
    /** 하던 판: 주민들의 모습과 쳐 본 종류 */
    drawResume(root, saved) {
      const { board, guess } = saved;
      drawMini(root, board.kind === 'box' || board.kind === 'day' ? miniOf(board) : { ...miniOf(board), marks: guess.kinds.map(markOf) });
    },
    /** 판 고르기의 그림: 단계마다 주민의 수나 상자의 수. 5단계는 한 주민에게 거짓말쟁이의 테두리("적어도 한 명은 거짓말쟁이"), 6단계는 한 주, 7단계는 물음표를 붙인다 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) drawMini(root, { blank: T.home.blank });
      else if (picture.boxes) drawMini(root, { boxes: picture.boxes });
      else {
        drawMini(root, {
          faces: T.animals.slice(0, picture.faces).map((animal) => animal.face),
          fork: picture.fork === true,
          marks: Number.isInteger(picture.liar) ? T.animals.slice(0, picture.faces).map((_, at) => (at === picture.liar ? 'liar' : null)) : undefined,
          ask: picture.ask ? T.home.blank : undefined,
          week: picture.week ? DAYS : undefined,
          lies: picture.week ? PICTURE_LIES : undefined,
        });
      }
    },
    showMake,
    /** 직접 만들기에서 다 만든 판. 아직 풀 수 있는 판이 아니면 null(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
