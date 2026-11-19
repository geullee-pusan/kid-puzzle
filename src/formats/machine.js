// 규칙 기계와 규칙이 깨지는 판: 판 화면에서 이 형식이 맡는 부분(기계 그림과 칸의 줄, 넣은 수와 나온 수의 표, 원 위의 점과 조각,
// 차림표의 표와 컴퓨터가 넣어 본 칸들, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기(블록으로 기계를 만들면 선생님이 돌려 보고 어디서 되풀이되는지 알려 준다).
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/machine.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)는 판이 정한다(src/core/machine.js).
//   fill    지금 칸에 들어갈 수를 넣는다. 다르면 칸은 빈 채로 남고 다시 계산해 보자고만 한다. "기계 속을 볼래요"를 누르면 기계가 칸을 채운다.
//   back    넣어 볼 수를 넣으면 기계가 나온 수를 보여 준다. 나와야 할 수가 나오면 찾은 수에 들어간다. "다 찾았어요"로 끝낸다(없는 판은 그대로 누른다).
//   box     규칙이 숨은 기계에 수를 넣어 본다. 물음표 칸을 누르고 나올 수를 넣어 맞힌다. 물음표 칸을 모두 맞히면 끝난다.
//   far     기계를 한 칸씩 돌려 앞의 칸들을 본다(정해진 칸까지만). 먼 칸의 수를 넣어 맞히면 끝난다. 칸을 누르면 표시가 생긴다(도구).
//   record  처음 칸을 넣고 줄을 돌린다. 처음부터 계속 작아진 칸이 가장 긴 줄이 되면 끝난다. 아니면 더 길게 만들 수 있을지 묻는다.
//   circle  조각을 눌러 점을 찍는다. 모든 조각에 점을 찍으면 표에 적힌다. 짐작을 적은 뒤 점이 하나 많은 그림을 세면 끝난다.
//   prime   수를 넣으면 차림표대로 계산해 약수가 둘뿐인지 알려 준다. 늘 그럴지 고른 뒤 컴퓨터가 넣어 본 칸들에서 깨지는 칸을 누르면 끝난다.
// 몇 번 넣었는지, 몇 번 돌렸는지는 판에 적지 않는다(기록에만 남긴다).
import T from '../content/machine.json';
import { FAR_CAP, LADDER, MACHINES, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, solutionOf } from '../core/machine-ladder.js';
import {
  K_RANGE,
  MAX_STEPS,
  SEARCH_CELLS,
  START_MAX,
  applyMachine,
  checkBoard,
  checkMachine,
  chordsOf,
  circlePoints,
  circleRegions,
  copyBoard,
  crossingsOn,
  cycleOf,
  factorPair,
  fallingLength,
  familyOf,
  recipeOf,
  runRow,
  traceOf,
  whyOpen,
} from '../core/machine.js';
import { smallerMachine } from '../core/smaller.js';
import { endsClosed, fill, ordinal } from '../core/text.js';
import { cellRow, chips, circleFigure, countBox, figureCard, figureRow, machinePicture, runGrid, stack, table, targetCard, tryList } from '../ui/machine-board.js';

const FORMAT = 'machine';
const MODES = ['fill', 'back', 'box', 'far', 'record', 'circle', 'prime'];
/** 기계 그림의 보기에 넣는 수(두 수 기계는 두 수) */
const EXAMPLE = { one: 23, other: 47, pair: [13, 5] };
/** 먼 칸 맞히기에서 처음부터 보여 주는 칸(처음 칸 뒤로 몇 칸) */
const FAR_SHOWN = 2;
/** 차림표에서 몇 개를 넣어 본 뒤에 "늘 그럴까요?"를 묻는가 */
const PRIME_ASK_AFTER = 3;
/** 차림표에 넣을 수 있는 수 */
const PRIME_RANGE = [0, 99];
/** 직접 만들기: 더하거나 곱할 수의 범위, 줄에 그려 보일 칸 수의 위 끝 */
const MAKE_K = [1, 20];
const MAKE_ROW = 40;
const FIRST_DRAFT = { tab: 'one', steps: [{ op: 'rev' }, { op: 'add', k: 1 }], k: 1, typed: '13', typedB: '', focus: 0 };

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createMachine(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 사실. 다음에 무엇을 누르면 지운다
  let peeked = false; // 채우기: 방금 기계 속을 보았는가(기계 그림에 블록마다의 수를 적는다)
  let fresh = null; // 원: 방금 누른 조각
  let draft = null; // 직접 만들기에서 고르던 것 { tab, steps, k, typed, typedB, focus }
  let shown = null; // 직접 만들기에서 선생님이 돌려 본 것 { cells, cycle }
  const regionMemo = new Map();

  /** 받침에 따라 -closed, -open 가운데 고른다 */
  const pick = (group, key, number) => group[`${key}-${endsClosed(number) ? 'closed' : 'open'}`];
  const say = (line) => frame.say(line);
  const regionsOf = (count) => {
    if (!regionMemo.has(count)) regionMemo.set(count, circleRegions(count));
    return regionMemo.get(count);
  };

  function forget() {
    flash = null;
    peeked = false;
    fresh = null;
  }

  // ---- 기계의 말 ----
  function stepWord(step, form) {
    const key = K_RANGE[step.op] ? `${step.op}-${endsClosed(step.k) ? 'closed' : 'open'}` : step.op;
    return fill(T.blocks[key][form], { k: step.k ?? 0 });
  }
  const machineWords = (machine) => machine.steps.map((step, at) => stepWord(step, at === machine.steps.length - 1 ? 'end' : 'and')).join(' ');
  const chipLabels = (machine) => (machine.kind === 'pair' ? [T.pairLabel] : machine.steps.map((step) => stepWord(step, 'label')));
  const isPair = (round) => round.board.machine?.kind === 'pair';
  const hintKey = (round) => (round.mode === 'record' && isPair(round) ? 'record-pair' : round.mode);
  const digitsOf = (n) => String(n).length;

  function ruleLine(round) {
    const { board } = round;
    const words = board.machine?.kind === 'one' ? machineWords(board.machine) : '';
    if (round.mode === 'fill') return isPair(round) ? T.rules['fill-pair'] : fill(T.rules.fill, { f: words });
    if (round.mode === 'back') return fill(pick(T.rules, 'back', board.target), { f: words, n: board.limit, k: board.target });
    if (round.mode === 'box') return T.rules.box;
    if (round.mode === 'far') return isPair(round) ? fill(T.rules['far-pair'], { n: board.cap, no: board.target }) : fill(T.rules.far, { f: words, n: board.cap, no: board.target });
    if (round.mode === 'record') return isPair(round) ? fill(T.rules['record-pair'], { n: board.limit }) : fill(T.rules.record, { f: words, n: board.limit });
    if (round.mode === 'circle') return T.rules.circle;
    return fill(pick(T.rules, 'prime', board.add), { k: board.add });
  }

  // ---- 판의 모습 ----
  /** 원: 지금 세는 점의 수 */
  const circleNow = (round) => (round.phase === 'check' || round.phase === 'done' ? round.board.guess : round.board.counts[Math.min(round.countAt, round.board.counts.length - 1)]);

  /** 채우기: 지금까지의 칸(처음 칸, 채운 칸) */
  const fillCells = (round) => [...round.board.start, ...round.filled];

  /** 기계 그림의 보기(넣은 수와 나온 수) */
  function examplePicture(machine, { small = false, avoid = [] } = {}) {
    const inputs = machine.kind === 'pair' ? EXAMPLE.pair : [avoid.includes(EXAMPLE.one) ? EXAMPLE.other : EXAMPLE.one];
    const output = machine.kind === 'pair' ? Math.abs(inputs[0] - inputs[1]) : applyMachine(machine, inputs[0]);
    return stack('mc-example', machinePicture({ inputs, chips: chipLabels(machine), output, label: T.slot, small, caption: T.example }));
  }

  function fillNodes(round, { live, small }) {
    const { board } = round;
    const cells = fillCells(round);
    const total = board.start.length + board.count;
    const playing = live && !round.done;
    let picture;
    if (playing && peeked && round.filled.length > 0) {
      // 방금 기계 속을 본 칸: 넣은 수와 블록마다 한 뒤의 수
      const at = cells.length - 1;
      const before = isPair(round) ? cells.slice(at - 2, at) : [cells[at - 1]];
      const values = isPair(round) ? null : traceOf(board.machine, before[0]).slice(1);
      picture = machinePicture({ inputs: before, chips: chipLabels(board.machine), values, output: cells[at], label: T.slot, small });
    } else picture = examplePicture(board.machine, { small, avoid: cells });
    const row = Array.from({ length: total }, (_, at) => {
      const no = at + 1;
      if (at < board.start.length) return { value: cells[at], no, state: 'given', label: fill(T.cellState.given, { no, k: cells[at] }) };
      if (at < cells.length) return { value: cells[at], no, state: 'done', label: fill(T.cellState.given, { no, k: cells[at] }) };
      if (at === cells.length && playing) return { value: round.typed, no, state: 'active', label: fill(T.cellState.active, { no }) };
      return { value: '', no, state: 'blank', label: fill(T.cellState.blank, { no }) };
    });
    return [picture, cellRow({ cells: row, numbers: true, small })];
  }

  function backNodes(round, { small }) {
    const { board } = round;
    const last = round.tried.at(-1);
    const nodes = [
      stack('mc-head', targetCard({ title: T.targetNumber, value: board.target, small }), small ? null : chips({ title: T.foundTitle, values: round.found })),
      machinePicture({ inputs: [last ? last.x : ''], chips: chipLabels(board.machine), output: last ? last.y : '', label: T.slot, small }),
    ];
    if (!small && round.tried.length > 0) nodes.push(tryList({ items: round.tried.map((item) => ({ input: item.x, output: item.y, hit: item.y === board.target })) }));
    return nodes;
  }

  function boxNodes(round, { live, small }) {
    const { board } = round;
    const playing = live && !round.done;
    const last = round.tried.at(-1);
    const rows = [];
    for (const x of board.shown) rows.push({ cells: [x, applyMachine(board.machine, x)], state: 'shown', label: fill(T.rowState.shown, { k: x, n: applyMachine(board.machine, x) }) });
    for (const item of round.tried) rows.push({ cells: [item.x, item.y], state: 'shown', label: fill(T.rowState.shown, { k: item.x, n: item.y }) });
    board.asks.forEach((x, at) => {
      const right = round.answered.includes(at) || round.done;
      const value = right ? applyMachine(board.machine, x) : round.picked === at && playing && round.typed !== '' ? round.typed : '?';
      const state = right ? 'right' : round.picked === at ? 'picked' : 'ask';
      const label = right ? fill(T.rowState.right, { k: x, n: applyMachine(board.machine, x) }) : fill(T.rowState[state], { k: x });
      rows.push({ cells: [x, value], state, label, tappable: playing && !right, ask: at });
    });
    const picture = machinePicture({ inputs: [last ? last.x : ''], chips: null, hidden: T.hiddenLabel, output: last ? last.y : '', label: T.slot, small });
    const view = table({ head: [T.table.in, T.table.out], rows: small ? rows.slice(0, 4) : rows, small, onTap: playing ? (at) => pickAsk(rows[at].ask) : undefined });
    return [picture, view];
  }

  function farNodes(round, { live, small }) {
    const { board } = round;
    const playing = live && !round.done;
    const row = runRow(board.machine, board.start, board.cap);
    const cells = row.map((value, at) => {
      const no = at + 1;
      const open = at < round.shown;
      const marked = round.marks.includes(at);
      return { value: open ? value : '', no, state: open ? 'given' : 'blank', marked, tappable: open, label: open ? fill(T.cellState[marked ? 'marked' : 'given'], { no, k: value }) : fill(T.cellState.blank, { no }) };
    });
    const answer = round.done ? frame.solution?.value ?? solutionOf(board).value : playing ? round.typed : '';
    return [
      small ? null : machinePicture({ inputs: board.start.map(() => ''), chips: chipLabels(board.machine), output: '', label: T.slot }),
      cellRow({ cells, numbers: true, small, onTap: playing ? markCell : undefined }),
      targetCard({ title: fill(T.targetTitle, { no: board.target }), value: answer, live: playing, small }),
    ];
  }

  /** 계속 작아지는 줄 하나: 작아진 칸과 처음으로 작아지지 않은 칸 */
  function fallingCells(machine, start) {
    const length = fallingLength(machine, start);
    const row = runRow(machine, start, length + 1);
    return row.map((value, at) => {
      const no = at + 1;
      const state = at < length ? 'fall' : 'stop';
      return { value, no, state, label: fill(T.cellState[state], { no, k: value }) };
    });
  }

  function recordNodes(round, { live, small }) {
    const { board } = round;
    const last = round.runs.at(-1);
    const playing = live && !round.done;
    const typedStart = isPair(round) ? [round.typed, round.typedB] : [round.typed];
    const inputs = playing && typedStart.some((text) => text !== '') ? typedStart : last ? last.start : board.machine.kind === 'pair' ? ['', ''] : [''];
    const nodes = [machinePicture({ inputs, chips: chipLabels(board.machine), output: '', label: T.slot, small })];
    const start = last ? last.start : round.preview ?? null;
    if (start) nodes.push(cellRow({ cells: fallingCells(board.machine, start), numbers: true, small }));
    return nodes;
  }

  function circleNodes(round, { live, small }) {
    const { board } = round;
    const playing = live && !round.done && round.phase !== 'guess';
    const count = circleNow(round);
    // 표는 옆으로 눕혀 그린다(점의 수마다 한 칸): 점, 조각, 짐작
    const head = [T.table.points];
    const pieces = [T.table.pieces];
    const guesses = [T.table.guess];
    for (let points = 1; points <= board.guess; points++) {
      head.push(points);
      pieces.push(round.table[points] ?? '?');
      guesses.push(points === board.guess && round.guess !== null ? round.guess : '');
    }
    const rows = [{ cells: pieces, state: 'shown' }];
    if (round.guess !== null) rows.push({ cells: guesses, state: 'shown' });
    const regions = regionsOf(count);
    const figure = circleFigure({
      points: circlePoints(count),
      chords: chordsOf(count),
      regions: small ? null : regions,
      marked: round.done ? [] : round.pieces,
      fresh: live ? fresh : null,
      small,
      label: (region) => T.regionState[round.pieces.includes(region.key) ? 'on' : 'off'],
      onTap: playing ? tapRegion : undefined,
    });
    if (small) return [figure];
    const counted = round.phase === 'guess' ? null : countBox(fill(T.countLabel, { n: count }), round.done ? round.table[count] : round.pieces.length);
    return [stack('mc-circle-play', stack('mc-circle-side', table({ head, rows }), counted), figure)];
  }

  function primeNodes(round, { live, small }) {
    const { board } = round;
    const playing = live && !round.done;
    const rows = round.inputs.map((item) => {
      const pair = factorPair(item.value);
      return { cells: [item.n, item.value, pair ? fill(T.splitMark, { k: pair[0], f: pair[1] }) : T.twoMark], state: pair ? 'broken' : 'shown' };
    });
    const nodes = [];
    // 컴퓨터가 넣어 본 뒤에는 그 칸들만 그린다(넣어 본 수는 칸들 안에도 있다)
    if (!(round.ran && !small) && (rows.length > 0 || !small)) nodes.push(table({ head: [T.table.in, T.table.out, T.table.two], rows: small ? rows.slice(-3) : rows, small }));
    if (round.ran && !small) {
      const items = [];
      for (let n = 0; n <= board.upTo; n++) {
        const value = recipeOf(board.add, n);
        const found = round.done && n === board.upTo;
        const checked = round.taps.includes(n);
        // 읽어 주는 이름: 눌러 본 칸만 약수가 둘뿐인지 말한다(누르기 전에 답을 읽어 주지 않게)
        const label = found || checked ? fill(T.gridState[found ? 'found' : 'two'], { k: n, n: value }) : fill(T.rowState.shown, { k: n, n: value });
        items.push({ n, value, found, checked, label });
      }
      nodes.push(runGrid({ items, onTap: playing ? tapGrid : undefined }));
    }
    return nodes;
  }

  /** 판(누를 수 있게, 또는 작은 그림으로) */
  function boardNodes(round, { live = false, small = false } = {}) {
    const make = { fill: fillNodes, back: backNodes, box: boxNodes, far: farNodes, record: recordNodes, circle: circleNodes, prime: primeNodes }[round.mode];
    return make(round, { live, small });
  }

  function statusOf(round) {
    if (round.mode === 'far' && round.shown >= round.board.cap) return fill(T.status['far-full'], { n: round.board.cap });
    if (round.mode === 'record' && round.runs.length > 0) return fill(T.status['record-run'], { n: round.runs.at(-1).length });
    if (round.mode === 'circle') return T.status[round.phase === 'guess' ? 'guess' : 'circle'];
    if (round.mode === 'prime') {
      if (round.ran) return T.status['prime-run'];
      if (round.answer !== null) return T.status['prime-computer'];
      if (round.inputs.length >= PRIME_ASK_AFTER) return T.status['prime-ask'];
      return T.status.prime;
    }
    return T.status[round.mode];
  }

  function draw() {
    const { round } = frame;
    const playing = !round.done;
    $('machine-board').replaceChildren(stack(`mc-play mc-mode-${round.mode}`, ...boardNodes(round, { live: true })));
    $('rule').textContent = ruleLine(round);
    $('machine-status').textContent = round.done ? '' : (flash ?? statusOf(round));
    const best = round.mode === 'record' && round.best !== null;
    $('machine-best-line').hidden = !best;
    if (best) $('machine-best').textContent = String(round.best.length);
    // 답하는 칸
    const entry = entryKind(round);
    $('machine-entry-box').hidden = entry === null || !playing;
    if (entry) drawEntry(round, entry);
    $('machine-peek').hidden = !(round.mode === 'fill' && playing);
    $('machine-found-box').hidden = !(round.mode === 'back' && playing);
    $('machine-box-note').hidden = !(round.mode === 'box' && playing);
    $('machine-step').hidden = !(round.mode === 'far' && playing);
    $('machine-step').disabled = round.mode === 'far' && round.shown >= round.board.cap;
    $('machine-count-box').hidden = !(round.mode === 'circle' && playing && round.phase !== 'guess');
    $('machine-clear').disabled = round.mode !== 'circle' || round.pieces.length === 0;
    const asking = round.mode === 'prime' && playing && round.answer === null && round.inputs.length >= PRIME_ASK_AFTER;
    $('machine-ask-box').hidden = !asking;
    $('machine-computer').hidden = !(round.mode === 'prime' && playing && round.answer !== null && !round.ran);
    if (round.mode === 'prime') $('machine-computer').textContent = fill(T.computer, { n: round.board.upTo });
    frame.showWhy();
  }

  /** 숫자판을 쓰는 때: 판의 종류(원은 짐작할 때, 차림표는 컴퓨터가 넣어 보기 전) 또는 null */
  function entryKind(round) {
    if (round.done) return null;
    if (round.mode === 'circle') return round.phase === 'guess' ? 'guess' : null;
    // 차림표: "늘 그럴까요?"에 고르는 동안과 컴퓨터가 넣어 본 뒤에는 쓰지 않는다
    if (round.mode === 'prime') return round.ran || (round.answer === null && round.inputs.length >= PRIME_ASK_AFTER) ? null : 'prime';
    return round.mode;
  }

  function entryTitle(round, entry) {
    if (entry === 'fill') return fill(T.entry.fill, { no: fillCells(round).length + 1 });
    if (entry === 'box') return round.picked === null ? T.entry['box-try'] : fill(pick(T.entry, 'box-ask', round.board.asks[round.picked]), { k: round.board.asks[round.picked] });
    if (entry === 'far') return fill(T.entry.far, { no: round.board.target });
    if (entry === 'record') return T.entry[isPair(round) ? 'record-pair' : 'record'];
    if (entry === 'guess') return fill(T.entry.guess, { n: round.board.guess });
    return T.entry[entry];
  }

  function drawEntry(round, entry) {
    $('machine-entry-title').textContent = entryTitle(round, entry);
    const pair = entry === 'record' && isPair(round);
    $('machine-typed-line').hidden = pair;
    $('machine-pair-line').hidden = !pair;
    $('machine-typed').textContent = round.typed;
    $('machine-slot-a').textContent = round.typed;
    $('machine-slot-b').textContent = round.typedB;
    $('machine-slot-a').setAttribute('aria-pressed', String(round.focus === 0));
    $('machine-slot-b').setAttribute('aria-pressed', String(round.focus === 1));
    const now = pair && round.focus === 1 ? round.typedB : round.typed;
    const limit = limitOf(round);
    for (const key of $('machine-keys').querySelectorAll('button')) {
      key.disabled = key.dataset.n === 'erase' ? now === '' : now.length >= limit;
    }
    const box = entry === 'box';
    $('machine-put').hidden = entry !== 'fill';
    $('machine-try').hidden = !(entry === 'back' || entry === 'prime' || (box && round.picked === null));
    $('machine-guess').hidden = !(entry === 'far' || (box && round.picked !== null));
    $('machine-run').hidden = entry !== 'record';
    $('machine-note').hidden = entry !== 'guess';
    for (const id of ['machine-put', 'machine-try', 'machine-guess', 'machine-note']) $(id).disabled = round.typed === '';
    $('machine-run').disabled = round.typed === '' && round.typedB === '';
  }

  /** 넣을 수 있는 글자 수 */
  function limitOf(round) {
    const entry = entryKind(round);
    if (entry === 'back' || entry === 'record') return digitsOf(round.board.limit);
    if (entry === 'box') return round.picked === null ? digitsOf(round.board.limit) : 6;
    if (entry === 'prime') return digitsOf(PRIME_RANGE[1]);
    if (entry === 'guess') return 3;
    return 7;
  }

  /** 한 일을 적고 다시 그린다 */
  function moved(type, data = {}) {
    const { round } = frame;
    round.moveCount += 1;
    frame.note(type, data);
    draw();
    frame.persist();
  }

  // ---- 숫자판 ----
  function press(key) {
    const { round } = frame;
    if (!round || round.done || entryKind(round) === null) return;
    const second = entryKind(round) === 'record' && isPair(round) && round.focus === 1;
    let text = second ? round.typedB : round.typed;
    if (key === 'erase') text = text.slice(0, -1);
    else if (/^\d$/.test(key) && text.length < limitOf(round)) text = text === '0' ? key : text + key;
    if (second) round.typedB = text;
    else round.typed = text;
    flash = null;
    peeked = false;
    draw();
    frame.persist();
  }

  function focusSlot(at) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'record') return;
    round.focus = at;
    draw();
    frame.persist();
  }

  // ---- 몇 칸 채우기 ----
  function put() {
    const { round, solution } = frame;
    if (!round || round.done || round.mode !== 'fill' || round.typed === '') return;
    const value = Number(round.typed);
    const cells = fillCells(round);
    const expected = solution.cells[cells.length];
    round.typed = '';
    peeked = false;
    const ok = value === expected;
    round.tries = [...round.tries, { at: cells.length, value, ok, t: frame.stamp() }];
    round.answers.push({ t: frame.stamp(), answer: `cell${cells.length + 1}:${value}`, correct: ok, guess: null });
    if (ok) {
      round.filled = [...round.filled, value];
      flash = fill(pick(T.status, 'put', value), { k: value });
      if (round.filled.length >= round.board.count) {
        frame.note('put', { value, ok });
        frame.finish('solved');
        return;
      }
      moved('put', { value, ok });
      return;
    }
    round.wrongCount += 1;
    flash = null;
    moved('put', { value, ok });
    // 기계가 하는 일의 가운데까지만 한 수면 그 사실을 말한다
    const partial = !isPair(round) && traceOf(round.board.machine, cells.at(-1)).slice(1, -1).includes(value);
    say(fill(pick(T.play, partial ? 'fill-partial' : 'fill-wrong', value), { k: value }));
  }

  /** "기계 속을 볼래요": 기계가 지금 칸을 채운다(블록마다 한 뒤의 수를 기계 그림에 적는다) */
  function peek() {
    const { round, solution } = frame;
    if (!round || round.done || round.mode !== 'fill') return;
    const cells = fillCells(round);
    const value = solution.cells[cells.length];
    round.filled = [...round.filled, value];
    round.helped += 1;
    round.typed = '';
    flash = null;
    peeked = true;
    if (round.filled.length >= round.board.count) {
      frame.note('peek', { value });
      frame.finish('solved');
      return;
    }
    moved('peek', { value });
    say(fill(pick(T.play, 'peek', value), { n: value }));
  }

  // ---- 넣어 보기(거꾸로, 상자, 차림표) ----
  function tryInput() {
    const { round } = frame;
    if (!round || round.done || round.typed === '') return;
    if (round.mode === 'prime') {
      tryRecipe();
      return;
    }
    if (!(round.mode === 'back' || (round.mode === 'box' && round.picked === null))) return;
    const { board } = round;
    const x = Number(round.typed);
    round.typed = '';
    flash = null;
    if (!(x >= 1 && x <= board.limit)) {
      draw();
      frame.persist();
      say(fill(T.play.range, { k: 1, n: board.limit }));
      return;
    }
    if (round.mode === 'box' && board.asks.includes(x)) {
      draw();
      frame.persist();
      say(T.play['box-ask-input']);
      return;
    }
    if (round.tried.some((item) => item.x === x) || (round.mode === 'box' && board.shown.includes(x))) {
      draw();
      frame.persist();
      say(T.play.again);
      return;
    }
    const y = applyMachine(board.machine, x);
    round.tried = [...round.tried, { x, y }];
    flash = fill(T.status.tried, { k: x, n: y });
    const hit = round.mode === 'back' && y === board.target;
    if (hit) round.found = [...round.found, x].sort((a, b) => a - b);
    moved('try', { x, y });
    if (hit) say(fill(T.play['back-hit'], { n: round.found.length }));
  }

  /** "다 찾았어요" */
  function claimAll() {
    const { round, solution } = frame;
    if (!round || round.done || round.mode !== 'back') return;
    const ok = round.found.length === solution.answers.length;
    round.claims += 1;
    round.answers.push({ t: frame.stamp(), answer: `all:${round.found.join('/')}`, correct: ok, guess: null });
    if (ok) {
      frame.note('claim', { found: round.found.length, ok });
      frame.finish('solved');
      return;
    }
    round.wrongCount += 1;
    flash = null;
    moved('claim', { found: round.found.length, ok });
    say(fill(pick(T.play, 'back-more', round.board.target), { k: round.board.target }));
  }

  // ---- 규칙 상자 ----
  function pickAsk(at) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'box' || at === undefined || round.answered.includes(at)) return;
    round.picked = round.picked === at ? null : at;
    round.typed = '';
    flash = null;
    draw();
    frame.persist();
  }

  // ---- 맞혀 보기(상자, 먼 칸) ----
  function guess() {
    const { round, solution } = frame;
    if (!round || round.done || round.typed === '') return;
    const value = Number(round.typed);
    if (round.mode === 'box' && round.picked !== null) {
      const at = round.picked;
      const expected = solution.outputs[at];
      const ok = value === expected;
      round.typed = '';
      round.guesses = [...round.guesses, { at, value, ok, t: frame.stamp() }];
      round.answers.push({ t: frame.stamp(), answer: `ask${round.board.asks[at]}:${value}`, correct: ok, guess: null });
      if (ok) {
        round.answered = [...round.answered, at];
        const left = round.board.asks.map((_, index) => index).filter((index) => !round.answered.includes(index));
        if (left.length === 0) {
          frame.note('guess', { at, value, ok });
          frame.finish('solved');
          return;
        }
        round.picked = left[0];
        flash = null;
        moved('guess', { at, value, ok });
        say(fill(pick(T.play, 'box-right', value), { k: value }));
        return;
      }
      round.wrongCount += 1;
      flash = null;
      moved('guess', { at, value, ok });
      say(fill(pick(T.play, 'box-wrong', value), { k: value }));
      return;
    }
    if (round.mode !== 'far') return;
    const ok = value === solution.value;
    round.typed = '';
    round.guesses = [...round.guesses, { value, ok, shown: round.shown, t: frame.stamp() }];
    round.answers.push({ t: frame.stamp(), answer: `far${round.board.target}:${value}`, correct: ok, guess: null });
    if (ok) {
      frame.note('guess', { value, ok });
      frame.finish('solved');
      return;
    }
    round.wrongCount += 1;
    flash = null;
    moved('guess', { value, ok });
    say(fill(pick(T.play, 'far-wrong', value), { k: value, no: round.board.target }));
  }

  // ---- 먼 칸 맞히기 ----
  function step() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'far') return;
    if (round.shown >= round.board.cap) {
      say(fill(T.play['far-cap'], { n: round.board.cap }));
      return;
    }
    round.shown += 1;
    flash = null;
    moved('step', { shown: round.shown });
  }

  /** 칸에 표시하기(도구): 다시 누르면 지워진다 */
  function markCell(at) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'far' || at >= round.shown) return;
    round.marks = round.marks.includes(at) ? round.marks.filter((other) => other !== at) : [...round.marks, at].sort((a, b) => a - b);
    round.markCount += 1;
    frame.note('mark', { at });
    draw();
    frame.persist();
  }

  // ---- 계속 작아지는 줄 ----
  function runRecord() {
    const { round, solution } = frame;
    if (!round || round.done || round.mode !== 'record') return;
    const { board } = round;
    const pair = isPair(round);
    if (round.typed === '' || (pair && round.typedB === '')) {
      if (pair) round.focus = round.typed === '' ? 0 : 1;
      draw();
      frame.persist();
      say(T.play['record-second']);
      return;
    }
    const start = pair ? [Number(round.typed), Number(round.typedB)] : [Number(round.typed)];
    round.typed = '';
    round.typedB = '';
    round.focus = 0;
    flash = null;
    if (!start.every((n) => n >= 1 && n <= board.limit)) {
      draw();
      frame.persist();
      say(fill(T.play.range, { k: 1, n: board.limit }));
      return;
    }
    const again = round.runs.some((item) => item.start.join() === start.join());
    const length = fallingLength(board.machine, start);
    round.runs = [...round.runs, { start, length, t: frame.stamp() }];
    if (round.best === null || length > round.best.length) round.best = { start, length };
    round.answers.push({ t: frame.stamp(), answer: `run:${start.join('/')}=${length}`, correct: length === solution.best, guess: null });
    if (length === solution.best) {
      frame.note('run', { start, length });
      frame.finish('solved');
      return;
    }
    round.wrongCount += 1;
    moved('run', { start, length });
    say(again ? T.play['record-again'] : fill(T.play['record-run'], { n: length }));
  }

  // ---- 원 위의 점 ----
  function tapRegion(key) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'circle' || round.phase === 'guess') return;
    const count = circleNow(round);
    const regions = regionsOf(count);
    if (!regions.some((region) => region.key === key)) return;
    const on = !round.pieces.includes(key);
    round.pieces = on ? [...round.pieces, key] : round.pieces.filter((other) => other !== key);
    round.taps += 1;
    fresh = on ? key : null;
    flash = null;
    if (round.pieces.length < regions.length) {
      moved('piece', { count, on, marked: round.pieces.length });
      return;
    }
    // 모든 조각에 점을 찍었다: 표에 적는다
    round.table = { ...round.table, [count]: regions.length };
    round.pieces = [];
    fresh = null;
    if (round.phase === 'check') {
      round.answers.push({ t: frame.stamp(), answer: `count${count}:${regions.length}`, correct: true, guess: null });
      round.phase = 'done';
      frame.note('piece', { count, on, marked: regions.length });
      frame.finish('solved');
      return;
    }
    round.countAt += 1;
    const next = round.countAt >= round.board.counts.length;
    if (next) round.phase = 'guess';
    moved('counted', { count, pieces: regions.length });
    const line = fill(T.play['circle-counted'], { n: count, k: regions.length });
    say(next ? `${line} ${fill(T.play['circle-guess'], { n: round.board.guess })}` : line);
  }

  function clearPieces() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'circle' || round.pieces.length === 0) return;
    round.pieces = [];
    fresh = null;
    moved('clear');
  }

  function noteGuess() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'circle' || round.phase !== 'guess' || round.typed === '') return;
    round.guess = Number(round.typed);
    round.typed = '';
    round.phase = 'check';
    round.answers.push({ t: frame.stamp(), answer: `guess${round.board.guess}:${round.guess}`, correct: null, guess: round.guess });
    flash = null;
    moved('guess', { value: round.guess });
    say(fill(T.play['circle-guessed'], { n: round.board.guess }));
  }

  // ---- 차림표 ----
  function tryRecipe() {
    const { round } = frame;
    const { board } = round;
    const n = Number(round.typed);
    round.typed = '';
    flash = null;
    if (!(n >= PRIME_RANGE[0] && n <= PRIME_RANGE[1])) {
      draw();
      frame.persist();
      say(fill(T.play.range, { k: PRIME_RANGE[0], n: PRIME_RANGE[1] }));
      return;
    }
    if (round.inputs.some((item) => item.n === n)) {
      draw();
      frame.persist();
      say(T.play.again);
      return;
    }
    const value = recipeOf(board.add, n);
    const pair = factorPair(value);
    round.inputs = [...round.inputs, { n, value, two: pair === null }];
    flash = fill(T.status.tried, { k: n, n: value });
    if (pair) {
      // 스스로 깨지는 수를 찾았다
      round.selfFound = n;
      round.answers.push({ t: frame.stamp(), answer: `self:${n}`, correct: true, guess: null });
      frame.note('recipe', { n, value, two: false });
      frame.finish('solved');
      return;
    }
    moved('recipe', { n, value, two: true });
    const parts = [T.play['prime-two']];
    if (round.inputs.length === PRIME_ASK_AFTER && round.answer === null) parts.push(T.play['prime-ask']);
    say(parts.join(' '));
  }

  function answerAsk(answer) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'prime' || round.answer !== null) return;
    round.answer = answer;
    round.answers.push({ t: frame.stamp(), answer: `always:${answer}`, correct: null, guess: answer });
    flash = null;
    moved('answer', { answer });
    say(fill(T.play['prime-answered'], { n: round.board.upTo }));
  }

  function runComputer() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'prime' || round.answer === null || round.ran) return;
    round.ran = true;
    round.typed = '';
    flash = null;
    moved('computer');
    say(fill(T.play['prime-ran'], { n: round.board.upTo }));
  }

  function tapGrid(n) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'prime' || !round.ran) return;
    if (!round.taps.includes(n)) round.taps = [...round.taps, n];
    if (n === round.board.upTo) {
      round.answers.push({ t: frame.stamp(), answer: `tap:${n}`, correct: true, guess: null });
      frame.note('tap', { n });
      frame.finish('solved');
      return;
    }
    flash = null;
    moved('tap', { n });
    say(T.play['prime-tap']);
  }

  // ---- 끝났을 때 하는 말 ----
  function whyJustOpened(round) {
    const records = frame.records();
    const family = familyOf(round.mode);
    return whyOpen(records, family) && !whyOpen(records.filter((record) => record.id !== round.id), family);
  }

  function rightLine(round, solution) {
    const { board } = round;
    const parts = [];
    if (round.mode === 'fill') {
      parts.push(fill(T.right.fill, { n: board.count }));
      if (round.helped > 0) parts.push(fill(T.right.helped, { n: round.helped }));
      parts.push(T.right['fill-then']);
    }
    if (round.mode === 'back') {
      const none = solution.answers.length === 0;
      parts.push(fill(pick(T.right, none ? 'back-none' : 'back', board.target), { k: board.target, n: solution.answers.length }));
    }
    if (round.mode === 'box') parts.push(fill(T.right.box, { n: board.asks.length }), T.right['box-then']);
    if (round.mode === 'far') {
      parts.push(fill(pick(T.right, 'far', solution.value), { no: board.target, k: solution.value }));
      parts.push(fill(T.right['far-cycle'], { f: ordinal(solution.mu + 1), n: solution.lambda }));
    }
    if (round.mode === 'record') {
      parts.push(fill(T.right.record, { n: solution.best, k: board.limit }));
      if (round.runs.length > 1) parts.push(fill(T.right['record-tries'], { n: round.runs.length }));
    }
    if (round.mode === 'circle') {
      const count = board.guess;
      const pieces = round.table[count];
      parts.push(fill(T.right.circle, { n: count, k: pieces }));
      if (round.guess !== null) parts.push(fill(T.right['circle-guess'], { k: round.guess }));
      parts.push(pieces === 2 ** (count - 1) ? T.right['circle-held'] : T.right['circle-broke']);
    }
    if (round.mode === 'prime') {
      if (round.selfFound !== null) parts.push(fill(pick(T.right, 'prime-self', round.selfFound), { k: round.selfFound }));
      else parts.push(fill(T.right.prime, { n: board.upTo }));
      const pair = factorPair(recipeOf(board.add, round.selfFound ?? board.upTo));
      parts.push(fill(pick(T.play, 'prime-split', pair[1]), { k: pair[0], f: pair[1] }));
      if (round.answer) parts.push(T.right[`prime-guess-${round.answer}`]);
    }
    if (!round.side && whyJustOpened(round)) parts.push(T.right['why-invite']);
    return parts;
  }

  // ---- 풀이와 "왜 그럴까?"의 그림 ----
  function rowFigure(item) {
    const machine = MACHINES[item.machine];
    const cells = item.fall
      ? fallingCells(machine, item.start).concat(runRow(machine, item.start, item.count).slice(fallingLength(machine, item.start) + 1).map((value, at) => ({ value, no: fallingLength(machine, item.start) + 2 + at, state: 'given' })))
      : runRow(machine, item.start, item.count).map((value, at) => ({ value, no: at + 1, state: 'given', marked: (item.ring ?? []).includes(at) }));
    return figureCard([cellRow({ cells, numbers: true, small: true })], item.note);
  }

  /** 점의 수마다 조각의 수(옆으로 눕힌 표) */
  function circleTable(top) {
    const head = [T.table.points];
    const pieces = [T.table.pieces];
    for (let points = 1; points <= top; points++) {
      head.push(points);
      pieces.push(regionsOf(points).length);
    }
    return stack('mc-circle-side', table({ head, rows: [{ cells: pieces, state: 'shown' }] }));
  }

  function figureOf(item) {
    if (item.type === 'row') return rowFigure(item);
    if (item.type === 'table') return figureCard([circleTable(item.top)], item.note);
    if (item.type === 'grid') {
      const items = [];
      for (let n = item.from; n <= item.to; n++) {
        const value = recipeOf(item.add, n);
        items.push({ n, value, found: factorPair(value) !== null });
      }
      return figureCard([runGrid({ items, small: true })], item.note);
    }
    const chords = chordsOf(item.count);
    const strong = item.chord ? chords.findIndex(([a, b]) => a === item.chord[0] && b === item.chord[1]) : -1;
    return figureCard([circleFigure({ points: circlePoints(item.count), chords, regions: null, strong, dots: item.chord ? crossingsOn(item.count, item.chord) : [], small: true })], item.note);
  }

  /** "왜 그럴까?": 선생님이 어떻게 알아챘는지의 이야기. 되풀이, 작아지는 줄, 깨지는 판마다 따로 있고, 그 묶음의 판을 한 번 끝까지 한 뒤에 열린다 */
  function whyPages(round) {
    const family = familyOf(round.mode);
    if (!whyOpen(frame.records(), family)) return null;
    return T.why[family].map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [figureRow(slide.figures.map(figureOf))];
      },
    }));
  }

  function solutionPages(round, solution) {
    const { board } = round;
    if (board.kind === 'fill') {
      const cells = solution.cells.map((value, at) => ({ value, no: at + 1, state: at < board.start.length ? 'given' : 'done' }));
      return [{ say: T.solution.fill, nodes: [figureRow([figureCard([cellRow({ cells, numbers: true, small: true })], null)])] }];
    }
    if (board.kind === 'back') {
      const none = solution.answers.length === 0;
      const say = fill(pick(T.solution, none ? 'back-none' : 'back', board.target), { k: board.target, n: solution.answers.length });
      const card = figureCard([targetCard({ title: T.targetNumber, value: board.target, small: true }), chips({ title: T.foundTitle, values: solution.answers })], null);
      return [{ say, nodes: [figureRow([card])] }];
    }
    if (board.kind === 'box') {
      const rows = board.asks.map((x, at) => ({ cells: [x, solution.outputs[at]], state: 'right' }));
      const card = figureCard([table({ head: [T.table.in, T.table.out], rows, small: true })], null);
      return [{ say: fill(T.solution.box, { f: machineWords(board.machine) }), nodes: [figureRow([card])] }];
    }
    if (board.kind === 'far') {
      const cells = solution.row.map((value, at) => ({ value, no: at + 1, state: 'given', marked: at === solution.mu || at === solution.mu + solution.lambda }));
      const card = figureCard([cellRow({ cells, numbers: true, small: true }), targetCard({ title: fill(T.targetTitle, { no: board.target }), value: solution.value, small: true })], fill(pick(T.solution, 'far-note', solution.value), { no: board.target, k: solution.value }));
      return [{ say: fill(T.solution.far, { f: ordinal(solution.mu + 1), n: solution.lambda }), nodes: [figureRow([card])] }];
    }
    if (board.kind === 'record') {
      const cards = solution.starts.slice(0, 2).map((start) => figureCard([cellRow({ cells: fallingCells(board.machine, start), numbers: true, small: true })], fill(T.solution['record-note'], { f: start.join(', ') })));
      return [{ say: fill(T.solution.record, { n: solution.best }), nodes: [figureRow(cards)] }];
    }
    if (board.kind === 'circle') {
      const card = figureCard([circleFigure({ points: circlePoints(board.guess), chords: chordsOf(board.guess), regions: regionsOf(board.guess), marked: regionsOf(board.guess).map((region) => region.key), small: true })], null);
      return [{ say: fill(T.solution.circle, { n: board.guess, k: solution.answer }), nodes: [figureRow([figureCard([circleTable(board.guess)], null), card])] }];
    }
    const items = [];
    for (let n = 0; n <= board.upTo; n++) items.push({ n, value: recipeOf(board.add, n), found: n === board.upTo });
    return [{ say: fill(T.solution.prime, { n: board.upTo }), nodes: [figureRow([figureCard([runGrid({ items, small: true })], null)])] }];
  }

  // ---- 직접 만들기: 블록으로 기계를 만들면 선생님이 돌려 보고 어디서 되풀이되는지 알려 준다 ----
  const machineOfDraft = () => (draft.tab === 'pair' ? { kind: 'pair' } : { kind: 'one', steps: draft.steps.map((item) => ({ ...item })) });
  const startOfDraft = () => (draft.tab === 'pair' ? [draft.typed, draft.typedB] : [draft.typed]).map((text) => (text === '' ? null : Number(text)));
  const draftReady = () => (draft.tab === 'pair' || draft.steps.length > 0) && startOfDraft().every((n) => n !== null && n >= 1 && n <= START_MAX);

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const okText = (text) => typeof text === 'string' && /^\d{0,4}$/.test(text);
    const okSteps = (steps) => Array.isArray(steps) && steps.length <= MAX_STEPS && (steps.length === 0 || checkMachine({ kind: 'one', steps }) === null);
    if (!saved || !['one', 'pair'].includes(saved.tab) || !okSteps(saved.steps) || !okText(saved.typed) || !okText(saved.typedB)) return JSON.parse(JSON.stringify(FIRST_DRAFT));
    const k = Number.isInteger(saved.k) && saved.k >= MAKE_K[0] && saved.k <= MAKE_K[1] ? saved.k : FIRST_DRAFT.k;
    return { tab: saved.tab, steps: saved.steps.map((item) => ({ ...item })), k, typed: saved.typed, typedB: saved.typedB, focus: saved.focus === 1 ? 1 : 0 };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    shown = null;
    $('machine-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(draft.tab === 'pair' ? T.make['pair-intro'] : T.make.intro);
  }

  function drawMake() {
    const pair = draft.tab === 'pair';
    for (const button of $('machine-make-tabs').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.tab === draft.tab));
    $('machine-make-blocks-box').hidden = pair;
    $('machine-make-pair-note').hidden = !pair;
    $('machine-make-count').textContent = fill(T.make.count, { n: draft.steps.length });
    $('machine-make-k').textContent = String(draft.k);
    $('machine-make-fewer').disabled = draft.k <= MAKE_K[0];
    $('machine-make-more').disabled = draft.k >= MAKE_K[1];
    for (const button of $('machine-make-ops').querySelectorAll('button')) button.disabled = draft.steps.length >= MAX_STEPS;
    $('machine-make-clear').disabled = draft.steps.length === 0;
    $('machine-make-typed-line').hidden = pair;
    $('machine-make-pair-line').hidden = !pair;
    $('machine-make-typed').textContent = draft.typed;
    $('machine-make-slot-a').textContent = draft.typed;
    $('machine-make-slot-b').textContent = draft.typedB;
    $('machine-make-slot-a').setAttribute('aria-pressed', String(draft.focus === 0));
    $('machine-make-slot-b').setAttribute('aria-pressed', String(draft.focus === 1));
    const now = pair && draft.focus === 1 ? draft.typedB : draft.typed;
    for (const key of $('machine-make-keys').querySelectorAll('button')) key.disabled = key.dataset.n === 'erase' ? now === '' : now.length >= digitsOf(START_MAX);
    $('machine-make-solve').disabled = !draftReady();
    $('machine-make-play').disabled = madeBoard() === null;
    const machine = machineOfDraft();
    const inputs = pair ? [draft.typed, draft.typedB] : [draft.typed];
    const nodes = [
      machinePicture({
        inputs,
        chips: pair ? [T.pairLabel] : draft.steps.length > 0 ? chipLabels(machine) : null,
        hidden: '',
        output: '',
        label: T.slot,
        onChip: pair ? undefined : removeStep,
      }),
    ];
    if (shown) {
      const cells = shown.cells.map((value, at) => ({ value, no: at + 1, state: 'given', marked: shown.cycle !== null && (at === shown.cycle.mu || at === shown.cycle.mu + shown.cycle.lambda) }));
      nodes.push(cellRow({ cells, numbers: true }));
    }
    $('machine-make-board').replaceChildren(stack('mc-play mc-make', ...nodes));
  }

  function changeDraft(change) {
    draft = { ...draft, ...change };
    shown = null;
    $('machine-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  function addStep(op) {
    if (draft.tab !== 'one') return;
    if (draft.steps.length >= MAX_STEPS) {
      frame.talkers.make.say(fill(T.make.full, { n: MAX_STEPS }));
      return;
    }
    const range = K_RANGE[op];
    const item = range ? { op, k: Math.min(Math.max(draft.k, range[0]), range[1]) } : { op };
    changeDraft({ steps: [...draft.steps, item] });
  }

  function removeStep(at) {
    changeDraft({ steps: draft.steps.filter((_, index) => index !== at) });
  }

  function stepK(change) {
    const k = draft.k + change;
    if (k < MAKE_K[0] || k > MAKE_K[1]) return;
    draft = { ...draft, k };
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  function pressMake(key) {
    const second = draft.tab === 'pair' && draft.focus === 1;
    let text = second ? draft.typedB : draft.typed;
    if (key === 'erase') text = text.slice(0, -1);
    else if (/^\d$/.test(key) && text.length < digitsOf(START_MAX) && !(key === '0' && text === '')) text += key;
    changeDraft(second ? { typedB: text } : { typed: text });
  }

  /** "선생님, 돌려 주세요": 줄을 돌려 어디서부터 되풀이되는지(또는 커지기만 하는지) 말하고 줄을 그린다 */
  function solveDraft() {
    if (!draftReady()) {
      frame.talkers.make.say(T.make.need);
      return;
    }
    const machine = machineOfDraft();
    const start = startOfDraft();
    const cycle = cycleOf(machine, start, SEARCH_CELLS);
    const row = runRow(machine, start, SEARCH_CELLS);
    let line;
    if (cycle) line = cycle.lambda === 1 ? fill(T.make.fixed, { f: ordinal(cycle.mu + 1) }) : fill(T.make.repeat, { f: ordinal(cycle.mu + 1), n: cycle.lambda });
    else if (row.length < SEARCH_CELLS) line = fill(T.make.big, { n: row.length + 1 });
    else line = fill(T.make.long, { n: SEARCH_CELLS });
    const length = cycle ? Math.min(cycle.mu + cycle.lambda + 1, MAKE_ROW) : Math.min(row.length, MAKE_ROW);
    shown = { cells: row.slice(0, Math.max(length, start.length)), cycle };
    drawMake();
    $('machine-make-result').textContent = line;
    const now = new Date().toISOString();
    log.saveRecord({ kind: 'made', v: 1, id: log.newId('m'), format: FORMAT, startedAt: now, endedAt: now, board: { machine, start }, solution: { possible: true, cycle, big: !cycle && row.length < SEARCH_CELLS } });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판): 되풀이가 스무 칸 안에 보이면 먼 칸 맞히기, 아니면 다섯 칸 채우기. 수가 너무 커지면 null */
  function madeBoard() {
    if (!draft || !draftReady()) return null;
    const machine = machineOfDraft();
    const start = startOfDraft();
    const cycle = cycleOf(machine, start);
    const board = cycle && cycle.mu + cycle.lambda + 1 <= FAR_CAP ? { kind: 'far', machine, start, target: 75, cap: FAR_CAP } : { kind: 'fill', machine, start, count: 5 };
    return checkBoard(board) === null ? board : null;
  }

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
    else frame.talkers.make.say(T.make['keep-not-yet']);
  }

  // ---- 단추 잇기 ----
  // 직접 만들기의 블록 단추에 이름을 적는다(이름은 대본에 있다)
  for (const button of $('machine-make-ops').querySelectorAll('button')) button.textContent = T.makeOps[button.dataset.op];
  $('machine-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.n;
    if (key) press(key);
  });
  $('machine-slot-a').addEventListener('click', () => focusSlot(0));
  $('machine-slot-b').addEventListener('click', () => focusSlot(1));
  $('machine-put').addEventListener('click', put);
  $('machine-try').addEventListener('click', tryInput);
  $('machine-guess').addEventListener('click', guess);
  $('machine-run').addEventListener('click', runRecord);
  $('machine-note').addEventListener('click', noteGuess);
  $('machine-peek').addEventListener('click', peek);
  $('machine-all').addEventListener('click', claimAll);
  $('machine-step').addEventListener('click', step);
  $('machine-clear').addEventListener('click', clearPieces);
  $('machine-always').addEventListener('click', () => answerAsk('always'));
  $('machine-sometimes').addEventListener('click', () => answerAsk('sometimes'));
  $('machine-computer').addEventListener('click', runComputer);
  $('machine-make-tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('button')?.dataset.tab;
    if (!['one', 'pair'].includes(tab) || tab === draft.tab) return;
    changeDraft({ tab, focus: 0 });
    frame.talkers.make.say(tab === 'pair' ? T.make['pair-intro'] : T.make.intro);
  });
  $('machine-make-ops').addEventListener('click', (event) => {
    const op = event.target.closest('button')?.dataset.op;
    if (op) addStep(op);
  });
  $('machine-make-fewer').addEventListener('click', () => stepK(-1));
  $('machine-make-more').addEventListener('click', () => stepK(1));
  $('machine-make-clear').addEventListener('click', () => changeDraft({ steps: [] }));
  $('machine-make-slot-a').addEventListener('click', () => changeDraft({ focus: 0 }));
  $('machine-make-slot-b').addEventListener('click', () => changeDraft({ focus: 1 }));
  $('machine-make-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.n;
    if (key) pressMake(key);
  });
  $('machine-make-solve').addEventListener('click', solveDraft);
  $('machine-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ board }) {
    const start = copyBoard(board);
    const table = {};
    if (start.kind === 'circle') for (let points = 1; points < start.counts[0]; points++) table[points] = regionsOf(points).length;
    return {
      mode: start.kind,
      board: start, // 판: 기계와 처음 칸, 나와야 할 수, 맞힐 칸, 점의 수, 차림표
      typed: '', // 숫자판으로 넣는 중인 글자
      typedB: '', // 두 수 기계의 둘째 칸에 넣는 중인 글자
      focus: 0, // 두 수 기계에서 지금 넣는 칸(0, 1)
      filled: [], // 채우기: 채운 칸의 수
      tries: [], // 채우기: 넣어 본 수 { at, value, ok }
      helped: 0, // 채우기: "기계 속을 볼래요"를 누른 수
      tried: [], // 거꾸로, 상자: 기계에 넣어 본 수와 나온 수 { x, y }
      found: [], // 거꾸로: 찾은 수(작은 것부터)
      claims: 0, // 거꾸로: "다 찾았어요"를 누른 수
      picked: null, // 상자: 지금 맞히는 물음표 칸의 차례
      answered: [], // 상자: 맞힌 물음표 칸의 차례
      guesses: [], // 상자, 먼 칸: 맞혀 본 수 { at?, value, ok }
      shown: start.kind === 'far' ? start.start.length + FAR_SHOWN : 0, // 먼 칸: 보이는 칸의 수
      marks: [], // 먼 칸: 표시한 칸의 차례(도구)
      markCount: 0, // 먼 칸: 표시하거나 지운 수
      runs: [], // 작아지는 줄: 돌려 본 줄 { start, length }
      best: null, // 작아지는 줄: 지금까지 가장 긴 것 { start, length }
      phase: start.kind === 'circle' ? 'count' : start.kind === 'prime' ? 'try' : null, // 원: 'count' | 'guess' | 'check' | 'done', 차림표: 'try'
      countAt: 0, // 원: 지금 세는 그림의 차례(counts 안에서)
      table, // 원: 점의 수마다 센 조각의 수(처음 몇 줄은 적혀 있다)
      pieces: [], // 원: 점을 찍은 조각(key)
      taps: start.kind === 'prime' ? [] : 0, // 원: 조각을 누른 수, 차림표: 컴퓨터가 넣어 본 칸에서 누른 수들
      guess: null, // 원: 짐작한 조각의 수
      inputs: [], // 차림표: 넣어 본 수 { n, value, two }
      answer: null, // 차림표: 'always' | 'sometimes'
      ran: false, // 차림표: 컴퓨터가 넣어 보았는가
      selfFound: null, // 차림표: 스스로 찾은 깨지는 수
      moveCount: 0, // 이 판에서 한 일의 수
      wrongCount: 0, // 사실과 다른 답의 수(다른 칸의 수, 덜 찾은 "다 찾았어요", 다른 수를 맞힌 것, 가장 길지 않은 줄)
    };
  }

  function drawBlank(root) {
    root.replaceChildren(stack('mc-play small', machinePicture({ inputs: [''], chips: null, hidden: '?', output: '', small: true })));
  }

  const count = (value) => Number.isInteger(value) && value >= 0;
  const intList = (list, ok = count) => Array.isArray(list) && list.every(ok);

  return {
    id: FORMAT,
    T,
    padId: 'machine-pad',
    makeId: 'make-machine',
    // 기계 그림, 칸의 줄, 맞힐 칸이 위아래로 쌓여 세로가 모자라다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다.
    ruleAside: true,
    homeIds: { sample: 'home-machine-sample', blank: 'home-machine-blank', ask: 'home-machine-ask', play: 'home-machine-play', pick: 'home-machine-pick', make: 'home-machine-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (checkBoard(saved.board) !== null || saved.mode !== saved.board.kind || !MODES.includes(saved.mode)) return false;
      if (![saved.typed, saved.typedB].every((text) => typeof text === 'string' && /^\d{0,7}$/.test(text)) || ![0, 1].includes(saved.focus)) return false;
      if (![saved.filled, saved.found, saved.answered, saved.marks].every((list) => intList(list))) return false;
      if (![saved.tries, saved.tried, saved.guesses, saved.runs, saved.pieces, saved.inputs].every(Array.isArray)) return false;
      if (!saved.tried.every((item) => item && count(item.x) && count(item.y))) return false;
      if (!saved.runs.every((item) => item && intList(item.start) && count(item.length))) return false;
      if (saved.best !== null && !(saved.best && intList(saved.best.start) && count(saved.best.length))) return false;
      if (saved.picked !== null && !(Number.isInteger(saved.picked) && saved.mode === 'box' && saved.picked < saved.board.asks.length)) return false;
      if (saved.mode === 'fill' && saved.filled.length >= saved.board.count) return false;
      if (saved.mode === 'far' && !(Number.isInteger(saved.shown) && saved.shown >= saved.board.start.length && saved.shown <= saved.board.cap)) return false;
      if (saved.mode === 'circle') {
        if (!['count', 'guess', 'check'].includes(saved.phase) || !(Number.isInteger(saved.countAt) && saved.countAt >= 0 && saved.countAt <= saved.board.counts.length)) return false;
        if (!saved.table || typeof saved.table !== 'object' || !saved.pieces.every((key) => typeof key === 'string') || !count(saved.taps)) return false;
        if (saved.guess !== null && !count(saved.guess)) return false;
      }
      if (saved.mode === 'prime') {
        if (saved.phase !== 'try' || ![null, 'always', 'sometimes'].includes(saved.answer) || typeof saved.ran !== 'boolean' || !intList(saved.taps)) return false;
        if (!saved.inputs.every((item) => item && count(item.n) && count(item.value))) return false;
      }
      return [saved.helped, saved.claims, saved.markCount, saved.moveCount, saved.wrongCount].every(count);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글)을 보이거나 감춘다. 무르기와 되돌리기는 쓰지 않는다 */
    showParts(on) {
      $('machine-board').hidden = !on;
      $('machine-count').hidden = !on;
      if (on) {
        // 이 형식은 무르기와 되돌리기를 쓰지 않는다. 앞의 형식(방 한 번씩 돌기)이 보이게 해 둔 것을 여기서 감춘다.
        $('undo').hidden = true;
        $('reset').hidden = true;
      }
    },
    enter: forget,
    draw,
    ended: forget,
    ruleLine,
    hints: (round) => T.hints[hintKey(round)],
    touched: (round) => round.moveCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view: (round) => ({ mode: round.mode, typed: round.typed, filled: round.filled.slice(), found: round.found.slice(), answered: round.answered.slice(), shown: round.shown, best: round.best, phase: round.phase, table: { ...round.table }, pieces: round.pieces.length, inputs: round.inputs.length, ran: round.ran }),
    /** 이 판보다 작은 판: 칸이 적거나, 맞힐 칸이 가깝거나, 고를 수가 작거나, 점이 적거나, 더 일찍 깨지는 판 */
    smaller: (round, turn) => smallerMachine({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const answer = { possible: true };
      if (solution.kind === 'back') Object.assign(answer, { answers: solution.answers });
      if (solution.kind === 'far') Object.assign(answer, { value: solution.value, mu: solution.mu, lambda: solution.lambda });
      if (solution.kind === 'record') Object.assign(answer, { best: solution.best });
      if (solution.kind === 'circle') Object.assign(answer, { answer: solution.answer });
      if (solution.kind === 'prime') Object.assign(answer, { first: solution.first });
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: answer,
        filled: round.filled,
        tries: round.tries,
        helped: round.helped,
        tried: round.tried,
        found: round.found,
        claims: round.claims,
        answered: round.answered,
        guesses: round.guesses,
        shown: round.shown,
        marks: round.marks,
        markCount: round.markCount,
        runs: round.runs,
        best: round.best,
        reachedBest: round.mode === 'record' && round.best !== null && round.best.length === solution.best,
        table: round.table,
        guess: round.guess,
        inputs: round.inputs,
        answer: round.answer,
        ran: round.ran,
        selfFound: round.selfFound,
        taps: round.taps,
        moveCount: round.moveCount,
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo() {},
    reset() {},
    /** 글자판이 있는 기기: 숫자판을 쓰는 때에 숫자, 지우기, 들이기(그때의 단추)를 받는다 */
    onKey(event) {
      const { round } = frame;
      if (!round || $('machine-pad').hidden) return;
      const entry = entryKind(round);
      if (entry === null) return;
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') press('erase');
      else if (event.key === 'Enter') {
        // 단추에 눈길이 가 있으면 들이기는 그 단추의 일이다(같은 누름이 두 번 일하지 않게)
        if (event.target instanceof Element && event.target.closest('button')) return;
        if (entry === 'fill') put();
        else if (entry === 'far' || (entry === 'box' && round.picked !== null)) guess();
        else if (entry === 'record') runRecord();
        else if (entry === 'guess') noteGuess();
        else tryInput();
      }
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).hint],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      root.replaceChildren(stack(`mc-play small mc-mode-${board.kind}`, ...boardNodes(begin({ board }), { small: true })));
    },
    drawBlank,
    drawResume(root, saved) {
      root.replaceChildren(stack(`mc-play small mc-mode-${saved.mode}`, ...boardNodes(saved, { small: true })));
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) {
        drawBlank(root);
        return;
      }
      const machine = picture.machine ? copyBoard(MACHINES[picture.machine]) : null;
      let board;
      if (picture.kind === 'fill') board = { kind: 'fill', machine, start: picture.start, count: picture.count };
      else if (picture.kind === 'back') board = { kind: 'back', machine, target: picture.target, limit: picture.limit };
      else if (picture.kind === 'far') board = { kind: 'far', machine, start: picture.start, target: picture.target, cap: picture.cap };
      else if (picture.kind === 'record') board = { kind: 'record', machine, limit: picture.limit };
      else board = { kind: 'circle', counts: [picture.count - 1], guess: picture.count };
      const round = { ...begin({ board }), filled: picture.filled ?? [], found: picture.found ?? [], shown: picture.shown ?? 0, preview: picture.start ?? null };
      if (picture.kind === 'circle') Object.assign(round, { phase: 'check' });
      if (picture.kind === 'back') round.tried = picture.found.map((x) => ({ x, y: applyMachine(machine, x) }));
      root.replaceChildren(stack(`mc-play small mc-mode-${board.kind}`, ...boardNodes(round, { small: true })));
    },
    showMake,
    /** 직접 만들기에서 다 만든 판. 블록과 처음 칸이 있어야 한다. 아니면 null(공책에 남기기가 쓴다) */
    madeBoard,
    /**
     * 가장 좋은 기록(공책에 저절로 남는다): 계속 작아지는 줄에서 가장 긴 줄. 한 번도 돌려 보지 않았으면 null.
     */
    bestOf: (round) => (round.mode !== 'record' || round.best === null ? null : { value: round.best.length, name: fill(T.notebook.best, { f: round.best.start.join(', '), n: round.best.length }) }),
  };
}
