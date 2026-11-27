// 돼지 주사위: 판 화면에서 이 형식이 맡는 부분(겨루기의 굴리기와 멈추기, 실험의 짐작과 컴퓨터에게 해 보게 하기,
// 한 번 더 굴릴까의 답과 주사위 눈 펼쳐 보기, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/pig.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)는 판이 정한다(src/core/pig.js).
//   play   선생님과 겨루기. 아이가 먼저 굴리기와 멈추기를 누른다. 아이의 차례가 끝나면(멈추거나 1이 나오면) 선생님 차례를 바로 끝까지 둔다
//          (선생님은 말한 규칙대로만 한다). 먼저 목표에 닿은 쪽이 생기면 끝난다. 누가 먼저 닿았는지는 사실로만 말한다
//   stop   몇 개에서 멈출까. 가장 많이 모을 것 같은 멈추는 수를 먼저 고르고(맞다 틀리다 하지 않는다), 컴퓨터가 1,000 차례씩 해 보면 끝난다
//   match  누가 먼저 모을까. 더 자주 먼저 모을 것 같은 쪽을 먼저 고르고(맞다 틀리다 하지 않는다), 컴퓨터가 1,000판 겨루게 하면 끝난다
//   edge   한 번만 더 굴릴까(주사위 하나는 3단계, 둘은 5단계). 답(늘어나요, 줄어들어요, 똑같아요)이 모든 경우를 센 것과 같으면 끝난다.
//          다르면 짐작 하나와 사실(컴퓨터가 해 본 수)과 할 수 있는 일을 말하고, 다시 고를 수 있다
// 실험은 끝난 뒤 "더 많이 해 보기"로 1,000번씩 더한다. 결과가 셈과 달라도 그대로 보여 준다.
// 왼쪽 칸의 "눈 모두 펼쳐 보기"(한 번 더 굴릴까에만)는 처음 켤 때 힌트 하나로 센다. 무르기와 처음으로는 쓰지 않는다(굴린 눈은 무를 수 없다).
import T from '../content/pig.json';
import { LADDER, MAKE_FIRST, MAKE_LEVEL, TOP_LEVEL, generateBoard, madeBoard, nextSeed, rungOf } from '../core/pig-ladder.js';
import { KINDS, LIMITS, MANY, MAX_MANY, PIG, VERDICTS, checkBoard, compareFrac, copyBoard, edgeCases, manyOf, matchTally, replay, solve, stopTally, topStops, turnValue } from '../core/pig.js';
import { seedFrom } from '../core/rng.js';
import { smallerPig } from '../core/smaller.js';
import { fill } from '../core/text.js';
import { whyUnlocked } from '../core/level.js';
import { barsNode, card, detached, drawBars, drawEdge, drawMini, drawPlay, facesNode, tableCard } from '../ui/pig-board.js';

const FORMAT = 'pig';
/** 기록에 남기는 답의 수의 위 끝 */
const MAX_TRIES = 60;
/** 실험 결과를 기억해 두는 수(같은 판, 같은 누른 수는 다시 세지 않는다) */
const MEMO = 24;

const count = (value) => Number.isInteger(value) && value >= 0;
/** 큰 수는 세 자리마다 쉼표를 찍는다(1,000번) */
const big = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** 실험 판인가(끝난 뒤 "더 많이 해 보기"가 있다) */
const isTrial = (mode) => mode === 'stop' || mode === 'match';

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createPig(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let rolling = false; // 방금 굴렸는가(그때만 방금 나온 주사위가 흔들린다)
  let told = false; // 선생님이 방금 지금 모습에 기대는 말을 했는가
  let draft = null; // 직접 만들기에서 만들던 값 { teacher, goal }
  let asked = null; // 직접 만들기에서 선생님이 해 본 결과(값을 고치면 지운다)
  const memo = new Map(); // 실험 결과

  // ---- 읽는 법 ----
  const hintKey = (round) => (round.mode === 'edge' && round.board.dice === 2 ? 'two' : round.mode);
  const stopName = (stop) => fill(T.stopName, { n: stop });
  const dieLabel = (face) => (face === PIG ? T.labels.pig : fill(T.labels.die, { n: face }));

  function ruleLine(round) {
    const { board } = round;
    if (board.kind === 'play') return fill(T.rules.play, { total: board.goal });
    if (board.kind === 'stop') return T.rules.stop;
    if (board.kind === 'match') return fill(T.rules.match, { k: board.stops[0], n: board.stops[1], total: board.goal });
    return fill(T.rules[board.dice === 2 ? 'two' : 'edge'], { n: board.pot });
  }

  /** 컴퓨터에게 presses번 시킨 결과(기억해 둔다) */
  function many(board, presses) {
    const key = `${JSON.stringify(board)}|${presses}`;
    if (!memo.has(key)) {
      if (memo.size >= MEMO) memo.delete(memo.keys().next().value);
      memo.set(key, manyOf(board, presses));
    }
    return memo.get(key);
  }

  // ---- 판의 값 ----
  /** 겨루기 판의 그림 값 */
  function playView(board, state, { small = false } = {}) {
    const kidTurns = state.turns.filter((turn) => turn.who === 'kid');
    const teacherTurns = state.turns.filter((turn) => turn.who === 'teacher');
    const lastKid = kidTurns.at(-1) ?? null;
    const lastTeacher = teacherTurns.at(-1) ?? null;
    const endOf = (turn) => {
      if (!turn) return { end: '', endKind: '' };
      if (turn.end === 'pig') return { end: turn.lost > 0 ? fill(T.labels.eaten, { n: turn.lost }) : T.labels['eaten-empty'], endKind: 'pig' };
      if (turn.end === 'goal') return { end: fill(T.labels.reached, { n: turn.got }), endKind: 'goal' };
      return { end: fill(T.labels.moved, { n: turn.got }), endKind: 'stop' };
    };
    const kidRow = state.faces.length > 0 || !lastKid
      ? { title: T.labels.now, faces: state.faces, end: '', endKind: '' }
      : { title: T.labels['kid-last'], faces: lastKid.faces, ...endOf(lastKid) };
    const rows = [{ ...kidRow, labels: kidRow.faces.map(dieLabel) }];
    if (lastTeacher) rows.push({ title: T.labels['teacher-last'], faces: lastTeacher.faces, labels: lastTeacher.faces.map(dieLabel), ...endOf(lastTeacher) });
    const face = state.faces.at(-1) ?? lastKid?.faces.at(-1) ?? null;
    return {
      label: T.labels.board,
      small,
      goal: board.goal,
      goalLabel: fill(T.labels.goal, { n: board.goal }),
      jars: [
        { who: 'kid', name: T.labels['jar-kid'], count: state.jars.kid, countLabel: fill(T.labels.count, { n: state.jars.kid }), basket: state.basket },
        { who: 'teacher', name: T.labels['jar-teacher'], count: state.jars.teacher, countLabel: fill(T.labels.count, { n: state.jars.teacher }), basket: 0 },
      ],
      teacherRule: fill(T.teacherRule, { n: board.teacher }),
      die: face === null ? null : { face, label: dieLabel(face) },
      basketLabel: fill(T.labels.basket, { n: state.basket }),
      // 아이의 지난 차례를 돼지가 먹었고 아직 다시 굴리지 않았다
      basketPig: state.faces.length === 0 && lastKid?.end === 'pig',
      rows,
    };
  }

  /** 몇 개에서 멈출까의 막대 값 */
  function stopBars(board, presses, pick) {
    const tally = presses > 0 ? many(board, presses) : null;
    const top = tally ? topStops(tally) : [];
    return {
      caption: tally ? fill(T.labels['stop-caption'], { total: big(tally[0].turns) }) : '',
      wait: tally ? '' : T.labels['stop-wait'],
      rows: board.stops.map((stop, index) => ({
        label: stopName(stop),
        value: tally ? tally[index].total : null,
        valueLabel: tally ? fill(T.labels.count, { n: big(tally[index].total) }) : '',
        sub: tally ? fill(T.labels.pigs, { n: big(tally[index].pigs) }) : '',
        kind: top.includes(stop) ? 'top' : 'plain',
        mine: pick === stop,
        mineLabel: T.labels.mine,
      })),
    };
  }

  /** 누가 먼저 모을까의 막대 값 */
  function matchBars(board, presses, pick) {
    const result = presses > 0 ? many(board, presses) : null;
    return {
      caption: result ? fill(T.labels['match-caption'], { total: big(result.games) }) : '',
      wait: result ? '' : T.labels['stop-wait'],
      note: result ? T.labels['match-note'] : '',
      wide: true,
      rows: board.stops.map((stop, index) => ({
        label: fill(T.sideName, { n: stop }),
        value: result ? result.wins[index] : null,
        valueLabel: result ? fill(T.labels.games, { n: big(result.wins[index]) }) : '',
        kind: index === 0 ? 'first' : 'second',
        mine: pick === index,
        mineLabel: T.labels.mine,
      })),
    };
  }

  /** 주사위 눈 펼쳐 보기의 값 */
  function facesView(dice, pot) {
    return {
      dice,
      list: edgeCases(dice, pot).list,
      addText: (n) => fill(T.labels.add, { n }),
      loseText: fill(T.labels.lose, { n: pot }),
      caption: T.labels[dice === 2 ? 'faces-two' : 'faces-one'],
      dieLabel,
      cellLabel: (faces, text) => fill(T.labels.cell, { k: faces[0], n: faces[1], face: text }),
      rowSum: (n) => fill(T.labels['row-sum'], { n }),
      tableLabel: T.labels.table,
    };
  }

  /** 한 번 더 굴리기를 컴퓨터가 해 본 막대 값 */
  function edgeBars(board, presses) {
    const tally = many(board, presses);
    return {
      bars: {
        wide: true,
        rows: [
          { label: T.labels.gained, value: tally.gained, valueLabel: fill(T.labels.count, { n: big(tally.gained) }), kind: 'gain' },
          { label: T.labels.lost, value: tally.lost, valueLabel: fill(T.labels.count, { n: big(tally.lost) }), kind: 'lose' },
        ],
      },
      line: fill(T.labels[board.dice === 2 ? 'edge-two' : 'edge-one'], { total: big(tally.n), n: big(tally.pigs) }),
      tally,
    };
  }

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    const root = $('pig-board');
    if (round.mode === 'play') {
      const state = replay(board, round.moves);
      drawPlay(root, { ...playView(board, state), rolling });
      $('pig-roll').disabled = !playing || state.over;
      $('pig-stop').disabled = !playing || state.over || state.basket === 0;
    } else if (round.mode === 'stop') {
      drawBars(root, { kind: 'stop', label: T.labels.board, bars: stopBars(board, round.presses, round.pick) });
    } else if (round.mode === 'match') {
      drawBars(root, { kind: 'match', label: T.labels.board, bars: matchBars(board, round.presses, round.pick) });
    } else {
      const shown = round.facesOn ? { faces: facesView(board.dice, board.pot) } : round.presses > 0 ? edgeBars(board, round.presses) : {};
      drawEdge(root, { label: T.labels.board, basketLabel: fill(T.labels.basket, { n: board.pot }), dice: board.dice, faces: shown.faces ?? null, bars: shown.bars ?? null, line: shown.line ?? '' });
    }
    rolling = false;

    // 판 아래: 할 일이나 사실 한 줄
    $('pig-status').textContent = playing ? (flash ?? statusOf(round)) : '';

    // 오른쪽 칸
    const trial = isTrial(round.mode);
    $('pig-play-box').hidden = round.mode !== 'play';
    $('pig-pick-box').hidden = !(trial && round.pick === null);
    if (trial && round.pick === null) drawPicks(round);
    $('pig-picked').hidden = !(trial && round.pick !== null);
    if (trial && round.pick !== null) $('pig-picked').textContent = fill(T.guessed, { face: pickText(round, round.pick) });
    $('pig-run-box').hidden = !(trial && round.pick !== null);
    $('pig-run').textContent = T.buttons[round.mode === 'match' ? 'match-run' : 'stop-run'];
    $('pig-run').disabled = !playing;
    $('pig-edge-box').hidden = round.mode !== 'edge';
    $('pig-try').textContent = T.buttons[round.presses === 0 ? 'edge-first' : 'edge-more'];
    $('pig-try').disabled = !playing || round.presses >= MAX_MANY;
    for (const button of $('pig-answers').querySelectorAll('button')) button.disabled = !playing;

    // 왼쪽 칸의 도구: 한 번 더 굴릴까에만 있다
    $('pig-faces').hidden = round.mode !== 'edge';
    $('pig-faces').setAttribute('aria-pressed', String(round.facesOn));

    // 끝난 뒤: 실험 판은 "더 많이 해 보기"를 "같은 단계 새 판" 앞에 둔다
    const more = round.done && trial && !round.side;
    $('pig-more').hidden = !more;
    $('pig-more').disabled = round.presses >= MAX_MANY;
    if (more) $('after-same').before($('pig-more'));
    frame.showWhy();
  }

  function statusOf(round) {
    if (round.mode === 'play') {
      const state = replay(round.board, round.moves);
      if (state.basket > 0) return fill(T.labels.basket, { n: state.basket });
      const last = state.turns.filter((turn) => turn.who === 'kid').at(-1);
      if (last && last.end === 'pig') return T.status.pig;
      return state.turns.length === 0 ? T.status.first : T.status.roll;
    }
    if (isTrial(round.mode)) return round.pick === null ? T.status.pick : T.status.run;
    return round.facesOn ? T.status.faces : T.status.edge;
  }

  /** 짐작 단추: 몇 개에서 멈출까는 멈추는 수마다, 누가 먼저 모을까는 두 쪽과 "비슷해요" */
  function drawPicks(round) {
    const values = round.mode === 'stop' ? round.board.stops : [0, 1, 'same'];
    const root = $('pig-picks');
    root.className = `choices pg-picks${values.length > 3 ? ' grid' : ''}`;
    root.replaceChildren(
      ...values.map((value) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn big';
        button.dataset.pick = String(value);
        button.textContent = round.mode === 'stop' ? fill(T.labels.pick, { n: value }) : pickText(round, value);
        if (round.mode === 'stop') button.setAttribute('aria-label', stopName(value));
        return button;
      }),
    );
  }

  const pickText = (round, value) => (round.mode === 'stop' ? stopName(value) : value === 'same' ? T.same : fill(T.sideName, { n: round.board.stops[value] }));

  // ---- 겨루기 ----
  /** 아이가 굴리거나 멈춘다. 아이의 차례가 끝나면 선생님 차례가 바로 끝까지 간다 */
  function act(move) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'play') return;
    const before = replay(round.board, round.moves);
    if (before.over || (move === 'stop' && before.basket === 0)) return;
    round.moves = [...round.moves, move];
    round.moveCount += 1;
    flash = null;
    rolling = move === 'roll';
    const after = replay(round.board, round.moves);
    const fresh = after.turns.slice(before.turns.length);
    frame.note(move, { face: move === 'roll' ? after.faces.at(-1) ?? fresh[0]?.faces.at(-1) ?? null : null, turns: fresh.map((turn) => ({ who: turn.who, end: turn.end, got: turn.got })) });
    if (after.over) {
      frame.finish('solved');
      return;
    }
    draw();
    frame.persist();
    if (fresh.length === 0) {
      if (told) told = false;
      return;
    }
    const parts = [];
    for (const turn of fresh) {
      if (turn.who === 'kid') {
        if (turn.end === 'stop') parts.push(fill(T.play['kid-stop'], { n: turn.got }));
        else parts.push(turn.lost > 0 ? fill(T.play['kid-pig'], { n: turn.lost }) : T.play['kid-pig-empty']);
      } else if (turn.end === 'stop') parts.push(fill(T.play['teacher-stop'], { k: turn.faces.length, n: turn.got }));
      else parts.push(turn.lost > 0 ? fill(T.play['teacher-pig'], { k: turn.faces.length, n: turn.lost }) : T.play['teacher-pig-empty']);
    }
    told = true;
    frame.say(parts.join(' '));
  }

  // ---- 실험 ----
  /** 처음 짐작: 적어 두기만 한다(맞다 틀리다 하지 않는다) */
  function pick(raw) {
    const { round, solution } = frame;
    if (!round || round.done || !isTrial(round.mode) || round.pick !== null) return;
    const value = round.mode === 'stop' ? Number(raw) : raw === 'same' ? 'same' : Number(raw);
    const allowed = round.mode === 'stop' ? round.board.stops : [0, 1, 'same'];
    if (!allowed.includes(value)) return;
    round.pick = value;
    round.pickAt = frame.stamp();
    // correct: 셈으로 가장 많이 모으는 수(또는 더 자주 먼저 모으는 쪽)를 골랐는가. 화면에서는 알리지 않는다
    const correct = round.mode === 'stop' ? solution.best.includes(value) : value === solution.favorite;
    round.answers.push({ t: frame.stamp(), answer: `pick:${value}`, correct, guess: null });
    frame.note('pick', { value, correct });
    flash = null;
    draw();
    frame.persist();
    frame.say(T.play.picked);
    $('pig-run').focus();
  }

  /** 짐작을 고른 뒤 컴퓨터에게 1,000번씩 해 보게 하면 판이 끝난다 */
  function run() {
    const { round } = frame;
    if (!round || round.done || !isTrial(round.mode) || round.pick === null) return;
    round.presses = 1;
    round.moveCount += 1;
    frame.note('many', { presses: round.presses });
    frame.finish('solved');
  }

  /** 끝난 실험 판의 "더 많이 해 보기": 1,000번씩 더하고 사실을 다시 말한다 */
  function more() {
    const { round } = frame;
    if (!round || !round.done || !isTrial(round.mode) || round.presses >= MAX_MANY) return;
    round.presses += 1;
    round.moreCount += 1;
    frame.note('more', { presses: round.presses });
    frame.keep();
    draw();
    frame.say(trialFacts(round).join(' '));
  }

  /** 한 번 더 굴릴까: 컴퓨터가 1,000번 해 본다 */
  function tryMany() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'edge' || round.presses >= MAX_MANY) return;
    round.presses += 1;
    round.moveCount += 1;
    round.facesOn = false;
    flash = null;
    told = false;
    frame.note('many', { presses: round.presses });
    draw();
    frame.persist();
    const { tally } = edgeBars(round.board, round.presses);
    frame.say(fill(T.play['edge-many'], { total: big(tally.n), k: big(tally.gained), n: big(tally.lost) }));
  }

  /** 주사위 눈 모두 펼쳐 보기(처음 켜면 힌트 하나로 센다) */
  function toggleFaces() {
    const { round } = frame;
    if (!round || round.mode !== 'edge') return;
    round.facesOn = !round.facesOn;
    const first = round.facesOn && !round.facesShown;
    if (round.facesOn) {
      round.facesShown = true;
      round.facesCount += 1;
    }
    flash = null;
    frame.note('faces', { on: round.facesOn });
    draw();
    frame.keep();
    if (first && !round.done) frame.say(T.play.faces);
  }

  // ---- 답(한 번 더 굴릴까) ----
  function answer(choice) {
    const { round, solution } = frame;
    if (!round || round.done || round.mode !== 'edge' || !VERDICTS.includes(choice)) return;
    const correct = solution.verdict === choice;
    const again = round.tries.includes(choice);
    const guess = correct ? null : guessOf(round, choice);
    round.answers.push({ t: frame.stamp(), answer: choice, correct, guess });
    frame.note('answer', { answer: choice, correct });
    flash = null;
    if (correct) {
      frame.finish('solved');
      return;
    }
    round.wrongCount += 1;
    if (!again) round.tries = [...round.tries, choice].slice(-MAX_TRIES);
    const line = nextLine(round);
    draw();
    frame.persist();
    told = true;
    const parts = [];
    if (again) parts.push(T.play['same-again']);
    else if (guess) parts.push(T.play[`guess-${guess}`]);
    parts.push(line);
    frame.say(parts.join(' '));
  }

  /**
   * 고른 답이 셈과 다를 때의 짐작:
   *   twenty  주사위 둘인데, 주사위 하나일 때의 답(20개를 기준으로 본 답)과 같다
   *   many    컴퓨터가 해 본 결과가 그 답처럼 보인다(얻은 수와 잃은 수)
   */
  function guessOf(round, choice) {
    const { board } = round;
    if (board.dice === 2 && edgeCases(1, board.pot).verdict === choice) return 'twenty';
    if (round.presses > 0) {
      const { tally } = edgeBars(board, round.presses);
      const seen = tally.gained > tally.lost ? 'more' : tally.gained < tally.lost ? 'less' : 'same';
      if (seen === choice) return 'many';
    }
    return null;
  }

  /** 답이 셈과 다를 때의 사실 하나와 할 수 있는 일: 펼쳐 두었으면 더해 볼 수 있다는 말, 아니면 컴퓨터가 해 본 수(아직이면 지금 1,000번) */
  function nextLine(round) {
    if (round.facesOn) return T.play['wrong-faces'];
    if (round.presses === 0) {
      round.presses = 1;
      frame.note('many', { presses: round.presses, auto: true });
    }
    const { tally } = edgeBars(round.board, round.presses);
    return fill(T.play['wrong-many'], { total: big(tally.n), k: big(tally.gained), n: big(tally.lost) });
  }

  // ---- 끝났을 때 하는 말 ----
  function whyJustOpened(round) {
    const records = frame.records();
    return whyUnlocked(records, FORMAT) && !whyUnlocked(records.filter((record) => record.id !== round.id), FORMAT);
  }

  /** 실험의 사실: 가장 많이 모은 것(먼저 모은 판), 고른 것의 결과 */
  function trialFacts(round) {
    const { board } = round;
    if (round.mode === 'stop') {
      const tally = many(board, round.presses);
      const top = topStops(tally);
      const best = tally.find((item) => item.stop === top[0]);
      const parts = [fill(T.right[top.length === 1 ? 'stop-top' : 'stop-tie'], { total: big(best.turns), n: top.length === 1 ? top[0] : top.length, k: big(best.total) })];
      if (round.pick !== null) {
        const mine = tally.find((item) => item.stop === round.pick);
        parts.push(top.includes(round.pick) && top.length === 1 ? T.right['stop-mine-top'] : fill(T.right['stop-mine'], { n: round.pick, k: big(mine.total) }));
      }
      return parts;
    }
    const result = many(board, round.presses);
    const face = board.stops.map((stop, index) => fill(T.right['match-part'], { k: stop, n: big(result.wins[index]) })).join(', ');
    const parts = [fill(T.right.match, { total: big(result.games), face })];
    if (round.pick === 'same') parts.push(fill(T.right['match-mine-same'], { n: big(Math.abs(result.wins[0] - result.wins[1])) }));
    else if (round.pick !== null) parts.push(fill(T.right['match-mine'], { n: big(result.wins[round.pick]) }));
    return parts;
  }

  function rightLine(round, solution) {
    const { board } = round;
    let parts;
    if (round.mode === 'play') {
      const state = replay(board, round.moves);
      parts = [state.winner === 'kid' ? fill(T.right.kid, { total: board.goal, n: state.jars.teacher }) : fill(T.right.teacher, { total: board.goal, n: state.jars.kid })];
      const stops = state.turns.filter((turn) => turn.who === 'kid' && turn.end === 'stop').map((turn) => turn.got);
      parts.push(stops.length > 0 ? fill(T.right.stops, { face: stops.join(', ') }) : T.right['no-stop']);
    } else if (isTrial(round.mode)) {
      parts = trialFacts(round);
      if (!round.side && !whyJustOpened(round)) parts.push(T.right.more);
    } else {
      parts = [board.dice === 2 ? fill(T.right['edge-two'], { k: solution.lose }) : fill(T.right['edge-one'], { n: board.pot }), T.right[`${solution.verdict}-verdict`]];
      if (round.presses > 0) {
        const { tally } = edgeBars(board, round.presses);
        const seen = tally.gained > tally.lost ? 'more' : tally.gained < tally.lost ? 'less' : 'same';
        if (seen !== solution.verdict) parts.push(fill(T.right.misled, { total: big(tally.n), k: big(tally.gained), n: big(tally.lost) }));
      }
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
    if (board.kind === 'play') {
      const node = detached(drawPlay, playView(board, replay(board, round.moves), { small: true }));
      return [{ say: fill(T.solution.play, { n: board.teacher }), nodes: [rowOf([card(node, '', { big: true })])] }];
    }
    const presses = Math.max(1, round.presses);
    if (board.kind === 'stop') {
      return [{ say: fill(T.solution.stop, { n: solution.best[0] }), nodes: [rowOf([card(barsNode(stopBars(board, presses, round.pick)), T.solution['note-stop'], { big: true })])] }];
    }
    if (board.kind === 'match') {
      const side = solution.favorite ?? 0;
      return [{ say: fill(T.solution.match, { n: board.stops[side] }), nodes: [rowOf([card(barsNode(matchBars(board, presses, round.pick)), T.solution['note-match'], { big: true })])] }];
    }
    const say = [board.dice === 2 ? fill(T.right['edge-two'], { k: solution.lose }) : fill(T.right['edge-one'], { n: board.pot }), T.right[`${solution.verdict}-verdict`]].join(' ');
    return [{ say, nodes: [rowOf([card(facesNode(facesView(board.dice, board.pot)), T.solution['note-faces'], { big: true })])] }];
  }

  /** "왜 그럴까?"의 그림 하나 */
  function figureNode(item, slide) {
    if (item.kind === 'stops') {
      const tally = stopTally(item.stops, item.n, item.seed);
      const top = topStops(tally);
      const view = {
        rows: tally.map((entry) => ({ label: stopName(entry.stop), value: entry.total, valueLabel: fill(T.labels.count, { n: big(entry.total) }), kind: top.includes(entry.stop) ? 'top' : 'plain' })),
      };
      return card(barsNode(view), item.note, { big: true });
    }
    if (item.kind === 'match') {
      const wins = matchTally(item.stops, item.goal, item.n, item.seed);
      const view = { wide: true, rows: item.stops.map((stop, index) => ({ label: fill(T.sideName, { n: stop }), value: wins[index], valueLabel: fill(T.labels.games, { n: big(wins[index]) }), kind: index === 0 ? 'first' : 'second' })) };
      return card(barsNode(view), item.note, { big: true });
    }
    if (item.kind === 'faces') return card(facesNode({ ...facesView(item.dice, item.pot), caption: '' }), item.note, { big: true });
    // 끝 장의 표: 바구니마다 여섯 눈을 한 번씩 셈한 것
    const rows = item.pots.map((pot) => {
      const { gain, lose, verdict } = edgeCases(1, pot);
      return [fill(T.labels.count, { n: pot }), fill(T.labels.count, { n: gain }), fill(T.labels.count, { n: lose }), fill(slide.cells[verdict], { n: Math.abs(gain - lose) })];
    });
    return tableCard(slide.heads, rows, item.note);
  }

  /** "왜 그럴까?": 오래 굴릴수록 많이 모을 줄 알았다 → 바구니 10개 → 30개 → 20개는 똑같다 → 먼저 모으기는 다른 물음 → 이름(끝 장) */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다
      get nodes() {
        return [rowOf(slide.figures.map((item) => figureNode(item, slide)))];
      },
    }));
  }

  // ---- 직접 만들기: 선생님이 멈추는 수와 먼저 모을 수를 정한다. 선생님이 1,000 차례 해 보거나, 아이가 겨룬다 ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    if (saved && madeBoard(saved.teacher, saved.goal)) return { teacher: saved.teacher, goal: saved.goal };
    return { ...MAKE_FIRST };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    asked = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    $('pig-make-teacher').textContent = fill(T.make.teacher, { n: draft.teacher });
    $('pig-make-goal').textContent = fill(T.make.goal, { n: draft.goal });
    $('pig-make-teacher-less').disabled = draft.teacher <= LIMITS.minStop;
    $('pig-make-teacher-more').disabled = draft.teacher >= LIMITS.maxStop;
    $('pig-make-goal-less').disabled = draft.goal <= LIMITS.minGoal;
    $('pig-make-goal-more').disabled = draft.goal >= LIMITS.maxGoal;
    const board = madeBoard(draft.teacher, draft.goal);
    drawPlay($('pig-make-board'), playView(board, replay(board, []), { small: true }));
    $('pig-make-result').textContent = asked ?? '';
  }

  function changeDraft(next) {
    if (!madeBoard(next.teacher, next.goal)) return;
    const had = asked !== null;
    draft = next;
    asked = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
    if (had) frame.talkers.make.say(T.make.changed);
  }

  /** 다 만든 판(해 보기와 공책에 남기기에 쓴다) */
  function madeNow() {
    return draft ? madeBoard(draft.teacher, draft.goal) : null;
  }

  /** 선생님이 그 규칙으로 1,000 차례 해 본다. 가장 많이 모으는 수인지는 모든 경우를 따진 셈으로 말한다 */
  function solveDraft() {
    const [result] = stopTally([draft.teacher], MANY, seedFrom('pig-make', draft.teacher));
    const best = compareFrac(turnValue(draft.teacher), turnValue(20)) === 0;
    const line = [fill(T.make.result, { n: big(result.total), k: big(result.pigs) }), T.make[best ? 'best' : 'not-best']].join(' ');
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
      board: madeNow(),
      solution: { possible: true, total: result.total, pigs: result.pigs, best },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  function playDraft() {
    const board = madeNow();
    if (!board) return;
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('pig-roll').addEventListener('click', () => act('roll'));
  $('pig-stop').addEventListener('click', () => act('stop'));
  $('pig-picks').addEventListener('click', (event) => {
    const value = event.target.closest('button')?.dataset.pick;
    if (value !== undefined) pick(value);
  });
  $('pig-run').addEventListener('click', run);
  $('pig-more').addEventListener('click', more);
  $('pig-try').addEventListener('click', tryMany);
  $('pig-answers').addEventListener('click', (event) => {
    const choice = event.target.closest('button')?.dataset.choice;
    if (choice) answer(choice);
  });
  $('pig-faces').addEventListener('click', toggleFaces);
  $('pig-make-teacher-less').addEventListener('click', () => changeDraft({ ...draft, teacher: draft.teacher - 1 }));
  $('pig-make-teacher-more').addEventListener('click', () => changeDraft({ ...draft, teacher: draft.teacher + 1 }));
  $('pig-make-goal-less').addEventListener('click', () => changeDraft({ ...draft, goal: draft.goal - LIMITS.goalStep }));
  $('pig-make-goal-more').addEventListener('click', () => changeDraft({ ...draft, goal: draft.goal + LIMITS.goalStep }));
  $('pig-make-solve').addEventListener('click', solveDraft);
  $('pig-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ board }) {
    const start = copyBoard(board);
    return {
      mode: start.kind,
      board: start, // 판: 종류와 값(목표, 선생님이 멈추는 수, 견줄 멈추는 수, 바구니, 주사위 수)과 시드
      moves: [], // 겨루기에서 아이가 누른 것('roll' | 'stop'). 선생님 차례는 이것으로 다시 둔다
      pick: null, // 실험의 처음 짐작(멈추는 수, 또는 0 | 1 | 'same'). 맞다 틀리다 하지 않는다
      pickAt: null, // 짐작을 고른 때(초)
      presses: 0, // 컴퓨터에게 1,000번씩 해 보게 한 수(끝난 뒤 "더 많이 해 보기"까지)
      moreCount: 0, // 끝난 뒤 "더 많이 해 보기"를 누른 수
      facesOn: false, // 지금 주사위 눈을 펼쳐 보고 있는가
      facesShown: false, // 한 번이라도 펼쳤는가(처음 펼치면 힌트 하나로 센다)
      facesCount: 0, // 펼친 수
      tries: [], // 셈과 다르던 답(같은 답은 한 번)
      wrongCount: 0, // 셈과 다르던 답의 수. 수준 맞추기가 "한 번에"를 본다
      moveCount: 0, // 굴리기, 멈추기, 컴퓨터에게 해 보게 하기의 수
    };
  }

  /** 기기에 적어 둔 하던 판이 쓸 수 있는 값인가 */
  function valid(saved) {
    if (!KINDS.includes(saved.mode) || checkBoard(saved.board) !== null || saved.board.kind !== saved.mode) return false;
    if (!Array.isArray(saved.moves) || (saved.mode !== 'play' && saved.moves.length > 0)) return false;
    if (saved.mode === 'play') {
      const state = replay(saved.board, saved.moves);
      if (!state.ok || state.over) return false;
    }
    if (saved.pick !== null) {
      const allowed = saved.mode === 'stop' ? saved.board.stops : saved.mode === 'match' ? [0, 1, 'same'] : [];
      if (!allowed.includes(saved.pick)) return false;
    }
    // 실험 판은 컴퓨터가 해 보면 끝나므로 하던 판에는 해 본 수가 없다
    if (!(count(saved.presses) && saved.presses <= MAX_MANY) || (isTrial(saved.mode) && saved.presses > 0)) return false;
    if (typeof saved.facesOn !== 'boolean' || typeof saved.facesShown !== 'boolean') return false;
    if (!Array.isArray(saved.tries) || !saved.tries.every((item) => VERDICTS.includes(item))) return false;
    return [saved.moreCount, saved.facesCount, saved.wrongCount, saved.moveCount].every(count);
  }

  /** 작은 그림의 값 */
  function miniOf(board, moves = []) {
    if (board.kind === 'play') {
      const state = replay(board, moves);
      return { kind: 'play', jars: [state.jars.kid / board.goal, state.jars.teacher / board.goal], face: state.faces.at(-1) ?? 5 };
    }
    // 막대는 모두 같은 높이다(어느 수가 가장 많이 모으는지 미리 보이지 않게)
    if (board.kind === 'stop') return { kind: 'stop', bars: board.stops.map(() => 0.6) };
    if (board.kind === 'match') return { kind: 'match', jars: [0.4, 0.55], face: 6 };
    return { kind: 'edge', dice: board.dice };
  }

  return {
    id: FORMAT,
    T,
    padId: 'pig-pad',
    makeId: 'make-pig',
    // 판이 위아래로 길다(두 항아리, 주사위와 바구니, 굴린 눈의 두 줄, 막대들). 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다
    ruleAside: true,
    homeIds: { sample: 'home-pig-sample', blank: 'home-pig-blank', ask: 'home-pig-ask', play: 'home-pig-play', pick: 'home-pig-pick', make: 'home-pig-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solve(round.board),
    valid,
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 눈 펼쳐 보기, 끝난 뒤의 "더 많이 해 보기")을 보이거나 감춘다. 무르기와 처음으로는 쓰지 않는다 */
    showParts(on) {
      $('pig-board').hidden = !on;
      $('pig-count').hidden = !on;
      if (on) {
        $('undo').hidden = true;
        $('reset').hidden = true;
      } else {
        $('pig-faces').hidden = true;
        $('pig-more').hidden = true;
      }
    },
    enter() {
      flash = null;
      rolling = false;
      told = false;
    },
    draw,
    ended() {
      flash = null;
      rolling = false;
      told = false;
    },
    ruleLine,
    hints: (round) => T.hints[hintKey(round)],
    touched: (round) => round.moveCount > 0 || round.pick !== null || round.facesShown || round.answers.length > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      if (round.mode === 'play') {
        const state = replay(round.board, round.moves);
        return { mode: round.mode, jars: state.jars, basket: state.basket, turns: state.turns.length };
      }
      return { mode: round.mode, pick: round.pick, presses: round.presses, faces: round.facesOn, tries: round.tries.length };
    },
    /** 이 판보다 작은 판: 목표나 견줄 수를 줄인 판, 셈이 크게 갈리는 바구니 */
    smaller: (round, turn) => smallerPig({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const base = {
        mode: round.mode,
        board: copyBoard(round.board),
        solution,
        moveCount: round.moveCount,
        wrongCount: round.wrongCount,
        // 눈 모두 펼쳐 보기는 처음 켤 때 힌트 하나로 센다
        hintsOpened: round.hintsOpened + (round.facesShown ? 1 : 0),
      };
      if (round.mode === 'play') {
        const state = replay(round.board, round.moves);
        return {
          ...base,
          moves: round.moves,
          // 차례마다 누가, 몇 번 굴려, 어떻게 끝났는지(옮김, 돼지, 다 모음)
          turns: state.turns.map((turn) => ({ who: turn.who, rolls: turn.faces.length, end: turn.end, got: turn.got, lost: turn.lost })),
          kidStops: state.turns.filter((turn) => turn.who === 'kid' && turn.end === 'stop').map((turn) => turn.got),
          jars: state.jars,
          // 먼저 목표에 닿은 쪽(끝나지 않았으면 null). 운이 정하는 놀이라 수준 맞추기의 "이긴 판"으로 보지 않는다(fastWin이 없다)
          winner: state.winner,
        };
      }
      const trial = {
        pick: round.pick,
        pickAt: round.pickAt,
        presses: round.presses,
        moreCount: round.moreCount,
      };
      if (round.mode === 'stop') {
        const tally = round.presses > 0 ? many(round.board, round.presses) : null;
        return { ...base, ...trial, pickBest: round.pick === null ? null : solution.best.includes(round.pick), tally, top: tally ? topStops(tally) : null };
      }
      if (round.mode === 'match') {
        const result = round.presses > 0 ? many(round.board, round.presses) : null;
        return { ...base, ...trial, pickFavorite: round.pick === null ? null : round.pick === solution.favorite, wins: result ? result.wins : null };
      }
      return {
        ...base,
        presses: round.presses,
        tally: round.presses > 0 ? many(round.board, round.presses) : null,
        tries: round.tries,
        facesShown: round.facesShown,
        facesCount: round.facesCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo() {},
    reset() {},
    /** 글자판: 단추는 저마다 Enter와 빈칸 글쇠로 누른다 */
    onKey() {},

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawMini(root, miniOf(board));
    },
    drawBlank(root) {
      drawMini(root, { kind: 'blank' });
    },
    /** 하던 판과 공책의 그림 */
    drawResume(root, saved) {
      const moves = saved.board?.kind === 'play' && Array.isArray(saved.moves) ? saved.moves : [];
      drawMini(root, miniOf(saved.board, moves));
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawMini(root, { kind: 'blank' });
        return;
      }
      drawMini(root, miniOf(generateBoard(entry.level, entry.picture.seed).board));
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard: madeNow,
  };
}
