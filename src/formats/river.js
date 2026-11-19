// 강 건너기: 판 화면에서 이 형식이 맡는 부분(판, 답하는 칸, 배가 못 떠날 때와 맞혔을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/river.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 아이는 동물을 눌러 배에 태우고(다시 누르면 내린다), 갈 곳의 단추를 눌러 배를 보낸다. 닿으면 탄 동물은 모두 내린다.
// 보낼 수 없으면 배가 떠나지 않고, 왜 그런지를 판에 그림으로 보인다(함께 있으면 안 되는 동물에 고리, 그 일이 생기는 곳에 테두리).
// 선생님은 사실 하나와 할 수 있는 일 하나를 말한다. 막는 것은 규칙뿐이고, 아이를 판정하지 않는다.
//
// 판의 종류(mode)는 단계가 정한다(src/core/river-ladder.js).
//   maybe   모두 건너면 끝난다. 안 되는 판은 "불가능해요"로 답한다(1, 2, 4단계와 직접 만든 판)
//   fewest  모두 건너면 배를 보낸 횟수를 견준다. 가장 적은 횟수보다 많으면 "더 줄일 수 있을까요?"라고 묻고 판을 그대로 둔다(3단계)
//   cross   모두 건너면 끝난다. 모두 되는 판이라 "불가능해요" 단추가 없다(5단계)
// 배를 보낸 횟수는 지금 길의 길이다(무른 것은 빠진다). 처음으로 되돌리면 0이 된다.
import T from '../content/river.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, solveOnce } from '../core/river-ladder.js';
import { FIGHTS, PETS, RANGES, applyMove, boatOf, castOf, checkBoard, checkMove, copyBoard, diagnoseImpossible, farOf, isDone, placesOf, replay, startState, stateKey } from '../core/river.js';
import { smallerRiver } from '../core/smaller.js';
import { fill } from '../core/text.js';
import { drawFights, drawRiver, riverCard, riverSteps } from '../ui/river-board.js';
import { countTable } from '../ui/swap-board.js';

const FORMAT = 'river';
const MODES = ['maybe', 'fewest', 'cross'];
/** 기록에 남기는 "배가 못 떠난 까닭"의 수의 위 끝 */
const MAX_REFUSALS = 40;
/** 처음 화면과 판 고르기에 그리는 빈 판(동물 없이 강과 배만) */
const BLANK = { kind: 'weight', heavy: 1, light: 1 };
const FIRST_DRAFT = { kind: 'weight', heavy: 1, light: 2, pets: ['dog', 'cat', 'fish'], petSeats: 2, pairs: 3, pairSeats: 2, island: false };
/** 곳의 이름표(단추 id의 끝과 대본의 이름) */
const PLACE_KEYS = ['left', 'island', 'right'];

/** 판의 종류 이름: 규칙 글과 힌트를 고르는 데 쓴다 */
export const storyOf = (board) => (board.kind === 'pairs' ? (board.island ? 'island' : 'pairs') : board.kind);

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createRiver(frame) {
  const { $, log } = frame;
  let flash = null; // 방금 왜 배가 못 떠났는지: { text, mark }. 다음에 무엇을 누르면 지운다
  let last = null; // 방금 한 움직임: { from, who }
  let draft = null; // 직접 만들기에서 정하던 판

  const stateOf = (round) => replay(round.board, round.trail).state;
  const placeKey = (board, place) => (place === 0 ? 'left' : place === farOf(board) ? 'right' : 'island');
  const nameOf = (member) => (member.role === 'mother' || member.role === 'baby' ? T.names[member.role][member.kind] : T.names[member.kind]);
  const labelOf = (board, state, aboard) => (id) => {
    const where = aboard.includes(id) ? T.places.boat : T.places[placeKey(board, state.at[id])];
    return [nameOf(castOf(board)[id]), where].join(', ');
  };

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const state = stateOf(round);
    const playing = !round.done;
    const done = isDone(board, state);
    drawRiver($('river-board'), {
      board,
      state,
      aboard: round.aboard,
      mark: flash?.mark ?? null,
      sailed: last?.from ?? null,
      landed: last?.who ?? [],
      label: labelOf(board, state, round.aboard),
      onTap: playing ? tap : undefined,
    });
    $('river-moves').textContent = String(round.trail.length);
    $('river-status').textContent = flash?.text ?? (done ? T.status.crossed : '');
    $('undo').disabled = !playing || round.trail.length === 0;
    $('reset').disabled = !playing || (round.trail.length === 0 && round.aboard.length === 0);

    // 갈 곳의 단추: 배가 있는 곳이 아닌 곳마다 하나씩
    const places = placesOf(board);
    for (const key of PLACE_KEYS) {
      const place = key === 'left' ? 0 : key === 'right' ? places - 1 : places === 3 ? 1 : -1;
      $(`river-go-${key}`).hidden = !playing || place < 0 || place === state.boat;
    }
    // 할머니와 동물들: 함께 두면 안 되는 짝을 그림으로 보인다.
    const fights = fightsOf(board);
    $('river-legend').hidden = fights.length === 0;
    if (fights.length > 0) drawFights($('river-fights'), fights);

    $('river-fewest').hidden = round.mode !== 'fewest';
    $('river-maybe').hidden = round.mode !== 'maybe';
    $('river-best-line').hidden = round.best === null;
    $('river-best').textContent = round.best === null ? '' : String(round.best);
    $('river-again').hidden = !(playing && done && round.mode === 'fewest');
    $('river-stop').hidden = !(playing && round.mode === 'fewest' && round.best !== null);
    $('river-impossible').disabled = round.done;
    frame.showWhy();
  }

  /** 판에 있는 할머니와 동물들의 함께 두면 안 되는 짝(그림으로 그릴 동물 둘씩) */
  function fightsOf(board) {
    if (board.kind !== 'pets') return [];
    const cast = castOf(board);
    const find = (kind) => cast.find((member) => member.kind === kind);
    return FIGHTS.filter(([a, b]) => find(a) && find(b)).map(([a, b]) => [find(a), find(b)]);
  }

  function refuse(text, mark) {
    flash = { text, mark };
    draw();
  }

  /** 동물을 눌렀다: 배에 탄 동물이면 내리고, 배가 있는 곳의 동물이면 태운다. */
  function tap(id) {
    const { round } = frame;
    if (round.done) return;
    const state = stateOf(round);
    flash = null;
    last = null;
    if (round.aboard.includes(id)) {
      round.aboard = round.aboard.filter((item) => item !== id);
      frame.note('board', { who: id, on: false });
    } else if (state.at[id] !== state.boat) {
      refused({ reason: 'far', who: [id] });
      return;
    } else if (round.aboard.length >= boatOf(round.board).seats) {
      refused({ reason: 'seats', who: [] });
      return;
    } else {
      round.aboard = [...round.aboard, id];
      frame.note('board', { who: id, on: true });
    }
    draw();
    frame.persist();
  }

  /** 배가 떠나지 못했다: 판에 그림으로 보이고, 선생님은 사실 하나와 할 수 있는 일 하나를 말한다. */
  function refused(check, to = null) {
    const { round } = frame;
    round.refusedCount += 1;
    round.refusals = [...round.refusals, { reason: check.reason, where: check.where ?? null, kind: check.kind ?? null, who: check.who, to }].slice(-MAX_REFUSALS);
    frame.note('refused', { reason: check.reason, where: check.where ?? null, kind: check.kind ?? null, who: check.who, to });
    let mark;
    let line;
    if (check.reason === 'clash') {
      mark = { who: check.who, place: check.where === 'boat' ? null : check.place, boat: check.where === 'boat' };
      line = round.board.kind === 'pets' ? T.clash.pets[check.kind] : T.clash.baby[check.where];
    } else {
      mark = { who: check.reason === 'far' ? check.who : check.reason === 'heavy' ? round.aboard : [], place: null, boat: true };
      line = T.refuse[check.reason];
    }
    refuse(T.status[check.reason], mark);
    frame.say(line);
    frame.persist();
  }

  /** 갈 곳의 단추를 눌렀다: 배를 보낸다. 보낼 수 없으면 왜 그런지 보인다. */
  function go(to) {
    const { round, solution } = frame;
    if (round.done) return;
    const { board } = round;
    const state = stateOf(round);
    flash = null;
    const check = checkMove(board, state, round.aboard, to);
    if (check) {
      // 이 단추로는 생기지 않는 까닭(없는 곳, 배가 다른 곳)은 그대로 둔다.
      if (check.reason === 'way') return;
      last = null;
      refused(check, to);
      return;
    }
    const move = { who: round.aboard.slice().sort((a, b) => a - b), to };
    round.trail = [...round.trail, move];
    round.aboard = [];
    round.moveCount += 1;
    if (round.trail.length === 1) {
      const first = `${move.who.join('+')}>${to}`;
      if (!round.firsts.includes(first)) round.firsts.push(first);
    }
    last = { from: state.boat, who: move.who };
    frame.note('cross', { who: move.who, to });
    const after = applyMove(state, move);
    if (isDone(board, after)) {
      complete(solution);
      return;
    }
    // 지나온 모습으로 되돌아왔으면 그 사실을 알려 준다. 말은 한 판에 한 번만 한다(볼 때마다 되풀이하지 않는다).
    if (seenBefore(round, after)) {
      round.loopCount += 1;
      frame.note('loop', { at: after.at, boat: after.boat });
      if (!round.loopSaid) {
        round.loopSaid = true;
        frame.say(T.stuck.loop);
      }
    }
    draw();
    frame.persist();
  }

  /** 이 모습이 지금 길에서 앞서 있었던 모습인가 */
  function seenBefore(round, state) {
    const key = stateKey(state);
    let now = startState(round.board);
    if (stateKey(now) === key) return true;
    for (const move of round.trail.slice(0, -1)) {
      now = applyMove(now, move);
      if (stateKey(now) === key) return true;
    }
    return false;
  }

  /** 모두 건넜다. 가장 적은 횟수를 묻는 판에서는 횟수를 견준다. */
  function complete(solution) {
    const { round } = frame;
    const answer = (text, correct, guess = null) => {
      round.answers.push({ t: frame.stamp(), answer: text, correct, guess });
      frame.note('answer', { answer: text, correct, guess });
    };
    if (round.mode !== 'fewest') {
      answer('crossed', true);
      frame.finish('solved');
      return;
    }
    const moves = round.trail.length;
    round.completions.push(moves);
    round.best = round.best === null ? moves : Math.min(round.best, moves);
    if (moves === solution.min) {
      answer(`crossed:${moves}`, true);
      frame.finish('solved');
      return;
    }
    // 틀렸다고 하지 않는다. 몇 번이었는지 말하고 더 줄일 수 있을지 묻는다. 판은 그대로 둔다.
    answer(`crossed:${moves}`, false, 'more-than-min');
    frame.persist();
    draw();
    frame.say(fill(T.play.more, { k: moves }));
  }

  /** 가장 적은 횟수를 묻는 판에서 "여기까지 할래요": 건넌 것으로 판을 끝낸다. */
  function stop() {
    const { round } = frame;
    if (round.done || round.mode !== 'fewest' || round.best === null) return;
    round.stopped = true;
    frame.note('stop', { best: round.best });
    frame.finish('solved');
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    round.trail = round.trail.slice(0, -1);
    round.aboard = [];
    round.undoCount += 1;
    flash = null;
    last = null;
    frame.note('undo');
    draw();
    frame.persist();
  }

  function reset() {
    const { round } = frame;
    if (round.done || (round.trail.length === 0 && round.aboard.length === 0)) return;
    round.trail = [];
    round.aboard = [];
    round.resetCount += 1;
    flash = null;
    last = null;
    frame.note('reset');
    draw();
    frame.persist();
  }

  /** "불가능해요". 되는 판이면 무엇을 놓쳤을지 짐작해서 말한다. */
  function sayImpossible() {
    const { round, solution } = frame;
    if (round.done || round.mode !== 'maybe') return;
    const result = diagnoseImpossible(solution, { moves: round.moveCount, firsts: round.firsts });
    round.answers.push({ t: frame.stamp(), answer: 'impossible', correct: result.correct, guess: result.guess });
    frame.note('answer', { answer: 'impossible', correct: result.correct, guess: result.guess });
    if (result.correct) {
      frame.finish('solved');
      return;
    }
    flash = null;
    frame.persist();
    draw();
    frame.say(T.guess[result.guess]);
  }

  /** 맞혔을 때 하는 말: 무엇을 했는지 그대로 말한다. */
  function rightLine(round, solution) {
    const parts = [];
    if (round.mode === 'fewest') {
      if (round.stopped) return [fill(T.right.stopped, { k: round.best })];
      parts.push(fill(T.right.fewest, { k: solution.min }));
      if (round.completions.length > 1) parts.push(fill(T.right['fewest-after'], { n: round.completions[0] }));
      return parts;
    }
    if (round.answers.at(-1)?.answer === 'impossible') {
      if (round.moveCount > 0) parts.push(fill(T.right['impossible-tried'], { k: round.moveCount }));
      else parts.push(T.right[round.refusedCount > 0 ? 'impossible-refused' : 'impossible-untried']);
    } else {
      const back = round.undoCount + round.resetCount;
      parts.push(back === 0 ? fill(T.right['crossed-clean'], { k: round.trail.length }) : fill(T.right['crossed-back'], { k: round.trail.length, n: back }));
    }
    if (round.answers.length > 1) parts.push(T.right['after-retry']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 그림 하나: 처음 모습에서 길을 따라간 뒤의 판 */
  function pictureOf(board, trail = [], who = []) {
    return { board, state: replay(board, trail).state, aboard: [], mark: who.length > 0 ? { who, place: null, boat: false } : null };
  }

  /** "왜 그럴까?": 선생님이 어떻게 알아챘는지의 이야기. 어느 판에서나 같다. */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        const nodes = [];
        if (slide.figures.length > 0) {
          nodes.push(rowOf(slide.figures.map((item) => riverCard(pictureOf(item.board, item.trail, [item.alone, item.waiting, item.back].filter((id) => id !== undefined)), item.note))));
        }
        if (slide.table) {
          const heads = [T.table.heads.board, T.table.heads.moves];
          const rows = slide.table.map((row) => [fill(T.table.row, { n: row.heavy, k: row.light }), fill(T.table.times, { k: row.moves })]);
          nodes.push(rowOf([countTable(heads, rows)]));
        }
        return nodes;
      },
    }));
  }

  /** 풀이: 배를 가장 적게 보내는 차례 하나를 판마다 그려서 보여 준다. 방금 건넌 동물에 고리를 두른다. */
  function solutionPages(round, solution) {
    const { board } = round;
    if (!solution.possible) return [{ say: T.solution.impossible, nodes: [rowOf([riverCard(pictureOf(board))])] }];
    const steps = [{ caption: T.solution.startLabel, view: pictureOf(board) }];
    solution.moves.forEach((move, index) => {
      steps.push({ caption: fill(T.solution.stepLabel, { no: index + 1 }), view: pictureOf(board, solution.moves.slice(0, index + 1), move.who) });
    });
    return [{ say: fill(T.solution.possible, { k: solution.min }), nodes: [riverSteps(steps)] }];
  }

  // ---- 직접 만들기: 판의 종류를 고르고, 동물의 수와 배에 타는 수(엄마와 아기는 섬도)를 정한다. ----
  function draftBoard() {
    if (draft.kind === 'weight') return { kind: 'weight', heavy: draft.heavy, light: draft.light };
    if (draft.kind === 'pets') return { kind: 'pets', pets: draft.pets.slice(), seats: draft.petSeats };
    return { kind: 'pairs', pairs: draft.pairs, seats: draft.island ? RANGES.islandSeats : draft.pairSeats, island: draft.island };
  }

  /** 정하던 값이 세 종류 모두 규격에 맞는가 */
  function draftOk(value) {
    if (!value || !['weight', 'pets', 'pairs'].includes(value.kind)) return false;
    return (
      checkBoard({ kind: 'weight', heavy: value.heavy, light: value.light }) === null &&
      checkBoard({ kind: 'pets', pets: value.pets, seats: value.petSeats }) === null &&
      checkBoard({ kind: 'pairs', pairs: value.pairs, seats: value.pairSeats, island: false }) === null &&
      typeof value.island === 'boolean'
    );
  }

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    if (!draftOk(saved)) return { ...FIRST_DRAFT, pets: FIRST_DRAFT.pets.slice() };
    return { kind: saved.kind, heavy: saved.heavy, light: saved.light, pets: saved.pets.slice(), petSeats: saved.petSeats, pairs: saved.pairs, pairSeats: saved.pairSeats, island: saved.island };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    $('river-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const board = draftBoard();
    for (const button of $('river-make-kinds').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.kind === draft.kind));
    $('river-make-weight').hidden = draft.kind !== 'weight';
    $('river-make-pets').hidden = draft.kind !== 'pets';
    $('river-make-pairs').hidden = draft.kind !== 'pairs';
    $('river-make-boat').hidden = draft.kind === 'weight';
    $('river-make-heavy').textContent = fill(T.make.count, { n: draft.heavy });
    $('river-make-light').textContent = fill(T.make.count, { n: draft.light });
    $('river-make-heavy-fewer').disabled = draft.heavy <= RANGES.heavy[0];
    $('river-make-heavy-more').disabled = draft.heavy >= RANGES.heavy[1];
    $('river-make-light-fewer').disabled = draft.light <= RANGES.light[0];
    $('river-make-light-more').disabled = draft.light >= RANGES.light[1];
    for (const button of $('river-make-pet-list').querySelectorAll('button')) button.setAttribute('aria-pressed', String(draft.pets.includes(button.dataset.pet)));
    $('river-make-pairs-count').textContent = fill(T.make.pairs, { n: draft.pairs });
    $('river-make-pairs-fewer').disabled = draft.pairs <= RANGES.pairs[0];
    $('river-make-pairs-more').disabled = draft.pairs >= RANGES.pairs[1];
    for (const button of $('river-make-island').querySelectorAll('button')) button.setAttribute('aria-pressed', String((button.dataset.island === 'yes') === draft.island));
    const seats = board.kind === 'weight' ? 0 : board.seats;
    const [low, high] = draft.kind === 'pets' ? RANGES.petSeats : draft.island ? [RANGES.islandSeats, RANGES.islandSeats] : RANGES.pairSeats;
    $('river-make-seats').textContent = fill(T.make.seats, { n: seats });
    $('river-make-seats-fewer').disabled = seats <= low;
    $('river-make-seats-more').disabled = seats >= high;
    drawRiver($('river-make-board'), { board, state: startState(board) });
    const fights = fightsOf(board);
    $('river-make-legend').hidden = fights.length === 0;
    if (fights.length > 0) drawFights($('river-make-fights'), fights);
  }

  function changeDraft(change) {
    const next = { ...draft, ...change };
    if (!draftOk(next)) return;
    draft = next;
    $('river-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 배에 타는 수를 바꾼다(지금 고른 종류의 배) */
  function changeSeats(step) {
    if (draft.kind === 'pets') changeDraft({ petSeats: draft.petSeats + step });
    else if (draft.kind === 'pairs' && !draft.island) changeDraft({ pairSeats: draft.pairSeats + step });
  }

  /** 함께 건널 동물을 넣거나 뺀다. 하나도 남지 않게는 못 뺀다. */
  function togglePet(pet) {
    const pets = draft.pets.includes(pet) ? draft.pets.filter((item) => item !== pet) : PETS.filter((item) => item === pet || draft.pets.includes(item));
    changeDraft({ pets });
  }

  /** 아이가 정한 판을 풀이 프로그램으로 풀어서, 건널 수 있는지와 배를 가장 적게 보내는 횟수를 알려 준다. */
  function solveDraft() {
    const board = draftBoard();
    const result = solveOnce(board);
    const line = result.possible ? fill(T.make.possible, { k: result.min }) : T.make.impossible;
    $('river-make-result').textContent = line;
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { possible: result.possible, min: result.min, states: result.states },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 풀어 볼 판). 이 형식의 판은 늘 풀어 볼 수 있다 */
  const madeBoard = () => draftBoard();

  function playDraft() {
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board: madeBoard() });
  }

  // ---- 단추 잇기 ----
  for (const key of PLACE_KEYS) {
    $(`river-go-${key}`).addEventListener('click', () => {
      const { round } = frame;
      if (!round) return;
      const places = placesOf(round.board);
      go(key === 'left' ? 0 : key === 'right' ? places - 1 : 1);
    });
  }
  $('river-again').addEventListener('click', reset);
  $('river-stop').addEventListener('click', stop);
  $('river-impossible').addEventListener('click', sayImpossible);
  $('river-make-kinds').addEventListener('click', (event) => {
    const kind = event.target.closest('button')?.dataset.kind;
    if (kind) changeDraft({ kind });
  });
  $('river-make-heavy-fewer').addEventListener('click', () => changeDraft({ heavy: draft.heavy - 1 }));
  $('river-make-heavy-more').addEventListener('click', () => changeDraft({ heavy: draft.heavy + 1 }));
  $('river-make-light-fewer').addEventListener('click', () => changeDraft({ light: draft.light - 1 }));
  $('river-make-light-more').addEventListener('click', () => changeDraft({ light: draft.light + 1 }));
  $('river-make-pet-list').addEventListener('click', (event) => {
    const pet = event.target.closest('button')?.dataset.pet;
    if (PETS.includes(pet)) togglePet(pet);
  });
  $('river-make-pairs-fewer').addEventListener('click', () => changeDraft({ pairs: draft.pairs - 1 }));
  $('river-make-pairs-more').addEventListener('click', () => changeDraft({ pairs: draft.pairs + 1 }));
  $('river-make-island').addEventListener('click', (event) => {
    const value = event.target.closest('button')?.dataset.island;
    if (value) changeDraft({ island: value === 'yes' });
  });
  $('river-make-seats-fewer').addEventListener('click', () => changeSeats(-1));
  $('river-make-seats-more').addEventListener('click', () => changeSeats(1));
  $('river-make-solve').addEventListener('click', solveDraft);
  $('river-make-play').addEventListener('click', playDraft);

  const count = (value) => Number.isInteger(value) && value >= 0;

  return {
    id: FORMAT,
    T,
    padId: 'river-pad',
    makeId: 'make-river',
    homeIds: { sample: 'home-river-sample', blank: 'home-river-blank', ask: 'home-river-ask', play: 'home-river-play', pick: 'home-river-pick', make: 'home-river-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    /** 새 판에서 이 형식이 맡는 값 */
    begin({ level, custom, board }) {
      return {
        mode: custom ? 'maybe' : rungOf(level).mode,
        board: copyBoard(board), // 판: 종류와 동물의 수, 배에 타는 수, 섬
        trail: [], // 처음 모습에서 지금까지 배를 보낸 차례. { who: 탄 동물들, to: 간 곳 }
        aboard: [], // 지금 배에 탄 동물들(아직 떠나지 않았다)
        moveCount: 0, // 이 판에서 배를 보낸 수(무르고 되돌리기 전의 것까지 모두)
        undoCount: 0,
        resetCount: 0,
        refusedCount: 0, // 배가 떠나지 못한 수
        refusals: [], // 그때마다의 까닭
        loopCount: 0, // 지나온 모습으로 되돌아온 수
        loopSaid: false, // 그 사실을 말했는가(한 판에 한 번만 말한다)
        firsts: [], // 처음 모습에서 맨 먼저 보내 본 묶음들
        best: null, // 가장 적은 횟수를 묻는 판에서, 지금까지 건넌 횟수 가운데 가장 적은 것
        completions: [], // 그 판에서 모두 건널 때마다의 횟수
        stopped: false, // "여기까지 할래요"로 끝냈는가
      };
    },
    solve(round) {
      const { possible, min, moves } = solveOnce(round.board);
      return { possible, min, moves };
    },
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      const played = replay(saved.board, saved.trail);
      if (!played.ok) return false;
      const { aboard } = saved;
      if (!Array.isArray(aboard) || aboard.length > boatOf(saved.board).seats || new Set(aboard).size !== aboard.length) return false;
      if (!aboard.every((id) => Number.isInteger(id) && played.state.at[id] === played.state.boat)) return false;
      if (![saved.moveCount, saved.undoCount, saved.resetCount, saved.refusedCount, saved.loopCount].every(count)) return false;
      if (![saved.refusals, saved.firsts, saved.completions].every(Array.isArray)) return false;
      return saved.best === null || count(saved.best);
    },
    /** 판 화면에서 이 형식의 것(판, 배를 보낸 횟수, 판 아래의 글)을 보이거나 감춘다 */
    showParts(on) {
      $('river-board').hidden = !on;
      $('river-count').hidden = !on;
    },
    enter() {
      flash = null;
      last = null;
    },
    draw,
    ended() {
      flash = null;
      last = null;
    },
    ruleLine(round) {
      const { board } = round;
      const k = board.kind === 'pets' ? board.seats - 1 : board.kind === 'pairs' ? board.seats : 0;
      return [fill(T.rules[storyOf(board)], { k }), T.asks[round.mode]].join(' ');
    },
    hints: (round) => T.hints[round.mode === 'fewest' ? 'fewest' : storyOf(round.board)],
    touched: (round) => round.moveCount > 0 || round.refusedCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const state = stateOf(round);
      return { at: state.at, boat: state.boat, aboard: round.aboard, count: round.trail.length };
    },
    /** 이 판보다 작은 판: 같은 종류에서 동물을 줄인 판(엄마와 아기는 한 쌍씩) */
    smaller: (round, turn) => smallerRiver({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const state = stateOf(round);
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, min: solution.min },
        // 판을 떠날 때의 길과 모습
        trail: round.trail,
        at: state.at,
        boat: state.boat,
        aboard: round.aboard,
        count: round.trail.length,
        moveCount: round.moveCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        refusedCount: round.refusedCount,
        refusals: round.refusals,
        loopCount: round.loopCount,
        firsts: round.firsts,
        // 가장 적은 횟수를 묻는 판: 건널 때마다의 횟수, 그 가운데 가장 적은 것, 가장 적은 횟수로 끝냈는가
        completions: round.completions,
        best: round.best,
        fewest: round.mode === 'fewest' && round.best !== null && round.best === solution.min,
        stopped: round.stopped === true,
        // 수준 맞추기는 첫 답으로 맞혔는지를 본다(가장 적은 횟수를 묻는 판은 처음 건넌 것이 가장 적은 횟수였는지).
        wrongCount: null,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    onKey() {},

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk(level) {
      const rung = rungOf(level);
      return T.home.ask[rung.mode === 'fewest' ? 'fewest' : rung.story];
    },
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawRiver(root, { board, state: startState(board), small: true });
    },
    drawBlank(root) {
      drawRiver(root, { board: BLANK, state: startState(BLANK), bare: true, small: true });
    },
    drawResume(root, saved) {
      drawRiver(root, { board: saved.board, state: replay(saved.board, saved.trail).state, aboard: saved.aboard ?? [], small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) {
        drawRiver(root, { board: BLANK, state: startState(BLANK), bare: true, small: true });
        return;
      }
      const board = copyBoard(picture);
      drawRiver(root, { board, state: startState(board), small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판. 아직 풀 수 있는 판이 아니면 null(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
