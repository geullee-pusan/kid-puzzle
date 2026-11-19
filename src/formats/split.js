// 똑같이 섞이게 자르기: 판 화면에서 이 형식이 맡는 부분(판, 자르기, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/split.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)는 단계가 정한다.
//   cut    되는 판만. 조각마다 판 전체와 똑같이 섞이면 판이 저절로 끝난다(1, 2단계)
//   mix    안 되는 판이 섞인다. 안 되는 판은 "불가능해요"로 답한다(3단계, 직접 만든 세 조각 판)
//   count  되는 자르기를 모두 찾는다. 찾을 때마다 판 옆에 모으고, 모두 찾으면 끝난다(4단계)
//   four   선 세 개로 네 조각. 안 되는 판이 섞인다(5단계, 직접 만든 네 조각 판)
// 칸 사이의 선을 누르거나 따라 그으면 그 선이 판 끝이나 먼저 자른 선에 닿을 때까지 잘린다. 자른 선을 누르면 지워진다.
// 조각마다 회색 수와 흰 칸 수를 적어 준다(세기를 돕는다). 조각이 다 되었는데 다르게 섞인 조각이 있으면 그 조각에 점선을 두르고 수만 말한다.
// 되는 판에 "불가능해요"를 누르면 틀렸다고 하지 않는다. 방법이 있다는 사실만 말하고 판은 그대로 이어진다.
import T from '../content/split.json';
import { smallerSplit } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/split-ladder.js';
import { MAX_SIZE, MIN_SIZE, applyCuts, checkBoard, copyBoard, cutDone, layoutKey, mixOf, onCut, pieceCounts, seedOk, seedsFor, solve } from '../core/split.js';
import { drawSplit, splitCard } from '../ui/split-board.js';

const FORMAT = 'split';
const MODES = ['cut', 'mix', 'count', 'four'];
/** 기록에 남기는 무르기 차례와 잘라 본 자르기의 수의 위 끝 */
const MAX_MOVES = 400;
const MAX_TRIES = 200;
/** 직접 만들기에서 선생님이 그려 보이는 자르기의 수의 위 끝 */
const MAKE_SHOWN = 6;
const FIRST_DRAFT = { w: 6, h: 3, grey: [], parts: 3 };

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createSplit(frame) {
  const { $, log } = frame;
  let flash = null; // 방금 누른 것에 대한 한 줄(판 아래). 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 만들던 판

  const count = (value) => Number.isInteger(value) && value >= 0;
  const hasImpossible = (round) => round.mode === 'mix' || round.mode === 'four';
  const ruleKey = (round) => (round.custom ? 'made' : round.mode);
  const lineCount = (board) => board.parts - 1;

  /** 한 번 푼 판은 적어 둔다(판을 열 때마다, 기록을 남길 때마다 다시 풀지 않게) */
  const memo = new Map();
  function solutionOf(board) {
    const key = JSON.stringify(copyBoard(board));
    if (!memo.has(key)) memo.set(key, solve(board));
    return memo.get(key);
  }

  /** 판 전체의 꼴을 채울 값: k 한 묶음의 회색, n 한 묶음의 흰 칸 */
  const unitValues = (board) => {
    const mix = mixOf(board);
    return { k: mix.unitGrey, n: mix.unitWhite };
  };

  // ---- 이름표 ----
  function edgeLabel(cuts) {
    return (seed) => fill(T.edgeLabel[seed.d], { no: ordinal(seed.at), n: ordinal(seed.i + 1), face: T.edgeState[onCut(cuts, seed) ? 'cut' : 'open'] });
  }
  const pieceLabel = (counts) => (index) => fill(T.pieceLabel, { k: counts[index][0], n: counts[index][1] });

  /** 판과 자른 선을 그릴 값(수까지) */
  function viewOf(board, seeds, more = {}) {
    const { pieces, cuts } = applyCuts(board, seeds);
    const counts = pieceCounts(board, pieces).map((item) => item.counts);
    return { w: board.w, h: board.h, grey: board.grey, cuts, pieces, counts, pieceLabel: pieceLabel(counts), ...more };
  }

  /** 자르기(조각들)를 그릴 값 */
  function layoutView(board, pieces, more = {}) {
    return viewOf(board, seedsFor(pieces) ?? [], more);
  }

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    const { pieces, cuts } = applyCuts(board, round.seeds);
    const info = pieceCounts(board, pieces);
    const complete = pieces.length === board.parts;
    const uneven = playing && complete ? info.map((item, index) => (item.even ? -1 : index)).filter((index) => index >= 0) : [];
    drawSplit($('split-board'), {
      ...viewOf(board, round.seeds),
      uneven,
      edgeLabel: edgeLabel(cuts),
      onSeed: playing ? tapSeed : undefined,
      onMiss: playing ? miss : undefined,
      preview: playing ? (seed) => previewOf(round, seed) : undefined,
    });
    const mix = mixOf(board);
    $('split-grey').textContent = String(mix.grey);
    $('split-white').textContent = String(mix.white);
    let status = fill(T.status.count, { n: Math.max(0, lineCount(board) - round.seeds.length) });
    if (round.done && cutDone(board, pieces)) status = T.status.done;
    else if (round.done) status = '';
    else if (uneven.length > 0) status = T.status.uneven;
    else if (complete && round.mode === 'count') status = round.found.includes(layoutKey(pieces)) ? T.status.found : '';
    $('split-status').textContent = flash ?? status;
    $('split-maybe').hidden = !hasImpossible(round);
    $('split-impossible').disabled = !playing;
    $('split-found-box').hidden = round.mode !== 'count';
    if (round.mode === 'count') drawFound(round);
    $('undo').disabled = !playing || round.moves.length === 0;
    $('reset').disabled = !playing || round.moves.length === 0;
    frame.showWhy();
  }

  /** 모두 찾기: 찾은 자르기를 작은 그림으로 모아 보인다 */
  function drawFound(round) {
    const cards = round.found.map((key) => {
      const pieces = key.split(';').map((item) => {
        const [x, y, w, h] = item.split(',').map(Number);
        return { x, y, w, h };
      });
      const { cuts } = applyCuts(round.board, seedsFor(pieces) ?? []);
      return splitCard({ w: round.board.w, h: round.board.h, grey: round.board.grey, cuts }, '');
    });
    $('split-found').replaceChildren(...cards);
    $('split-found-none').hidden = cards.length > 0;
  }

  /** 긋는 동안 보일 잘릴 선. 지울 선 위나 더 그을 수 없을 때는 없다 */
  function previewOf(round, seed) {
    const { cuts } = applyCuts(round.board, round.seeds);
    if (!seedOk(round.board, seed) || onCut(cuts, seed) || round.seeds.length >= lineCount(round.board)) return null;
    const next = applyCuts(round.board, [...round.seeds, seed]);
    return next.cuts.length > cuts.length ? next.cuts.at(-1) : null;
  }

  /** 칸 사이의 선을 눌렀거나 따라 그었다: 자른 선을 누르면 지우고, 아니면 새로 자른다 */
  function tapSeed(seed, { tap }) {
    const { round } = frame;
    if (!round || round.done) return;
    const { board } = round;
    flash = null;
    if (!seedOk(board, seed)) return draw();
    const { cuts } = applyCuts(board, round.seeds);
    if (onCut(cuts, seed)) {
      // 따라 그은 것이 자른 선 위면 아무 일도 하지 않는다(누르기만 지운다).
      if (!tap) return draw();
      const at = cuts.findIndex((cut) => onCut([cut], seed));
      const rest = round.seeds.filter((_, index) => index !== at);
      round.eraseCount += 1;
      changeSeeds(applyCuts(board, rest).seeds, 'erase');
      return;
    }
    if (round.seeds.length >= lineCount(board)) {
      flash = fill(T.status.full, { n: lineCount(board) });
      draw();
      frame.say(fill(T.play.full, { n: lineCount(board) }));
      return;
    }
    round.cutCount += 1;
    changeSeeds(applyCuts(board, [...round.seeds, seed]).seeds, 'cut');
  }

  /** 선이 아닌 곳을 눌렀다: 판 아래에 한 줄로 알린다 */
  function miss() {
    const { round } = frame;
    if (!round || round.done) return;
    round.missCount += 1;
    flash = T.status.miss;
    draw();
  }

  /** 자른 선이 바뀌었다. 조각이 다 되면 견주어 본다 */
  function changeSeeds(next, kind) {
    const { round } = frame;
    const before = round.seeds;
    if (JSON.stringify(next) === JSON.stringify(before)) return draw();
    round.moves = [...round.moves, { seeds: before.slice() }].slice(-MAX_MOVES);
    round.seeds = next;
    round.strokeCount += 1;
    const { pieces } = applyCuts(round.board, next);
    frame.note(kind, { lines: next.length, pieces: pieces.length });
    if (pieces.length === round.board.parts) {
      judge(pieces);
      return;
    }
    draw();
    frame.persist();
  }

  /** 조각이 다 되었다: 모두 똑같이 섞였으면 끝(모두 찾기는 모은다), 아니면 다르게 섞인 조각의 수를 말한다 */
  function judge(pieces) {
    const { round, solution } = frame;
    const { board } = round;
    const key = layoutKey(pieces);
    const even = cutDone(board, pieces);
    const fresh = !round.tries.includes(key);
    if (fresh) round.tries = [...round.tries, key].slice(-MAX_TRIES);
    if (even && round.mode !== 'count') {
      round.answers.push({ t: frame.stamp(), answer: `cut:${key}`, correct: true, guess: null });
      frame.note('answer', { answer: key, correct: true });
      frame.finish('solved');
      return;
    }
    if (even) {
      // 모두 찾기: 새로 찾은 자르기를 모은다.
      if (round.found.includes(key)) {
        flash = T.status.again;
        draw();
        frame.persist();
        frame.say(T.play['found-again']);
        return;
      }
      round.found = [...round.found, key];
      round.answers.push({ t: frame.stamp(), answer: `cut:${key}`, correct: true, guess: null });
      frame.note('answer', { answer: key, correct: true, found: round.found.length });
      if (round.found.length >= solution.count) {
        frame.finish('solved');
        return;
      }
      draw();
      frame.persist();
      frame.say(fill(T.play.found, { k: round.found.length }));
      return;
    }
    // 다르게 섞인 조각이 있다. 처음 해 본 자르기만 답으로 센다.
    if (fresh) {
      round.answers.push({ t: frame.stamp(), answer: `cut:${key}`, correct: false, guess: 'uneven' });
      round.wrongCount += 1;
      frame.note('answer', { answer: key, correct: false, guess: 'uneven' });
    }
    draw();
    frame.persist();
    if (!fresh) {
      frame.say(T.play['uneven-same']);
      return;
    }
    const first = pieceCounts(board, pieces).find((item) => !item.even);
    const mix = mixOf(board);
    frame.say(fill(T.play.uneven, { k: first.counts[0], n: first.counts[1], f: mix.unitGrey, total: mix.unitWhite }));
  }

  /** "불가능해요" */
  function pressImpossible() {
    const { round, solution } = frame;
    if (!round || round.done || !hasImpossible(round)) return;
    flash = null;
    const correct = solution.possible === false;
    const guess = correct ? null : 'impossible-on-possible';
    round.answers.push({ t: frame.stamp(), answer: 'impossible', correct, guess });
    frame.note('answer', { answer: 'impossible', correct, guess });
    if (correct) {
      frame.finish('solved');
      return;
    }
    // 되는 판이다. 틀렸다고 하지 않고 사실만 말한다. 판은 그대로 이어진다.
    round.impossibleCount += 1;
    round.wrongCount += 1;
    frame.persist();
    draw();
    frame.say(round.tries.length === 0 ? T.play['possible-press'] : fill(T.play['possible-press-tried'], { k: round.tries.length }));
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    const last = round.moves.at(-1);
    round.moves = round.moves.slice(0, -1);
    round.seeds = last.seeds.slice();
    round.undoCount += 1;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
  }

  /** 처음으로: 자른 선을 모두 지운다. 되돌린 것도 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (round.done || round.moves.length === 0 || round.seeds.length === 0) return;
    round.moves = [...round.moves, { seeds: round.seeds.slice() }].slice(-MAX_MOVES);
    round.seeds = [];
    round.resetCount += 1;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    const parts = [];
    const last = round.answers.at(-1);
    if (last.answer === 'impossible') {
      parts.push(round.tries.length > 0 ? fill(T.right['impossible-tried'], { n: round.tries.length }) : T.right['impossible-untried']);
      return parts;
    }
    if (round.mode === 'count') {
      parts.push(fill(T.right.count, { n: solution.count }));
      return parts;
    }
    const { parts: no } = round.board;
    parts.push(round.tries.length <= 1 ? fill(T.right['done-clean'], { n: no - 1, no }) : fill(T.right['done-tries'], { k: round.tries.length, no }));
    if (round.impossibleCount > 0) parts.push(T.right['after-press']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 그림의 판(줄마다 #이 회색)을 판으로 */
  function figureBoard(item) {
    const w = item.rows[0].length;
    const grey = [];
    item.rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && grey.push(y * w + x)));
    return { w, h: item.rows.length, grey, parts: item.parts };
  }

  /** 안 되는 까닭을 말로 */
  function reasonLine(board, solution) {
    const { mix, reason } = solution;
    if (reason === 'groups') return fill(T.solution.reasons.groups, { k: mix.unitGrey, n: mix.unitWhite, no: mix.groups, total: board.parts });
    if (reason === 'edge') return T.solution.reasons.edge;
    return fill(T.solution.reasons.search, { n: solution.total });
  }

  /** "왜 그럴까?": 두 조각을 맞추니 셋째 조각이 저절로 맞은 이야기, 첫 선, 그리고 묶음이 넉넉해도 안 되는 판 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [rowOf(slide.figures.map((item) => splitCard(viewOf(figureBoard(item), item.cuts, { hide: item.hide ?? [], lines: item.lines ?? [] }), item.note, { big: slide.figures.length === 1 })))];
      },
    }));
  }

  /** 풀이: 되는 판은 자르기 하나(모두 찾기는 모두), 안 되는 판은 까닭 */
  function solutionPages(round, solution) {
    const { board } = round;
    if (solution.possible && round.mode === 'count') {
      const cards = solution.layouts.map((pieces) => splitCard(layoutView(board, pieces, { counts: null }), ''));
      return [{ say: fill(T.solution.count, { n: solution.count }), nodes: [rowOf(cards)] }];
    }
    if (solution.possible) {
      const { k, n } = unitValues(board);
      const extra = solution.count > 1 ? ` ${fill(T.solution.more, { n: solution.count - 1 })}` : '';
      return [{ say: `${fill(T.solution.possible, { k, n })}${extra}`, nodes: [rowOf([splitCard(layoutView(board, solution.layouts[0]), '', { big: true })])] }];
    }
    const lines = solution.reason === 'edge' ? [] : solution.lines;
    return [{ say: `${T.solution.impossible} ${reasonLine(board, solution)}`, nodes: [rowOf([splitCard(viewOf(board, [], { lines }), '', { big: true })])] }];
  }

  // ---- 직접 만들기: 크기와 조각 수를 정하고, 칸을 눌러 회색으로 칠한다 ----
  const draftBoard = () => ({ w: draft.w, h: draft.h, grey: draft.grey.slice().sort((a, b) => a - b), parts: draft.parts });
  const draftReady = () => draft && checkBoard(draftBoard()) === null;

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    if (saved && checkBoard(saved, { open: true }) === null) return { w: saved.w, h: saved.h, grey: saved.grey.slice(), parts: saved.parts };
    return { ...FIRST_DRAFT, grey: [] };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    $('split-make-result').textContent = '';
    $('split-make-picture').replaceChildren();
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    $('split-make-w').textContent = fill(T.make.size, { n: draft.w });
    $('split-make-h').textContent = fill(T.make.size, { n: draft.h });
    $('split-make-w-fewer').disabled = draft.w <= MIN_SIZE;
    $('split-make-w-more').disabled = draft.w >= MAX_SIZE;
    $('split-make-h-fewer').disabled = draft.h <= MIN_SIZE;
    $('split-make-h-more').disabled = draft.h >= MAX_SIZE;
    for (const button of $('split-make-parts').querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.parts) === draft.parts));
    $('split-make-clear').disabled = draft.grey.length === 0;
    $('split-make-count').textContent = fill(T.make.count, { k: draft.grey.length, n: draft.w * draft.h - draft.grey.length });
    $('split-make-solve').disabled = !draftReady();
    $('split-make-play').disabled = !draftReady();
    const board = draftBoard();
    drawSplit($('split-make-board'), {
      w: board.w,
      h: board.h,
      grey: board.grey,
      cellLabel: (cell) => fill(T.cellLabel, { no: ordinal(Math.floor(cell / board.w) + 1), n: ordinal((cell % board.w) + 1), face: T.cells[board.grey.includes(cell) ? 'grey' : 'white'] }),
      onPaint: paintDraft,
    });
  }

  function changeDraft(next) {
    draft = next;
    $('split-make-result').textContent = '';
    $('split-make-picture').replaceChildren();
    log.saveDraft({ w: draft.w, h: draft.h, grey: draft.grey, parts: draft.parts }, FORMAT);
    drawMake();
  }

  /** 칸을 누르거나 문질렀다: 그 칸들을 회색(또는 흰 칸)으로 */
  function paintDraft(cells, grey) {
    const set = new Set(draft.grey);
    for (const cell of cells) {
      if (grey) set.add(cell);
      else set.delete(cell);
    }
    changeDraft({ ...draft, grey: [...set].sort((a, b) => a - b) });
  }

  /** 크기를 바꾼다. 회색 칸은 같은 자리(가로, 세로)에 그대로 두고, 판 밖으로 나간 것은 버린다 */
  function resize(w, h) {
    if (w < MIN_SIZE || h < MIN_SIZE || w > MAX_SIZE || h > MAX_SIZE) return;
    const grey = draft.grey
      .map((cell) => [cell % draft.w, Math.floor(cell / draft.w)])
      .filter(([x, y]) => x < w && y < h)
      .map(([x, y]) => y * w + x)
      .sort((a, b) => a - b);
    changeDraft({ ...draft, w, h, grey });
  }

  /** 아이가 만든 판을 풀이 프로그램으로 따져서 알려 준다. 되면 자르는 방법을 모두 세고 몇 가지를 그리고, 안 되면 까닭을 말한다 */
  function solveDraft() {
    if (!draftReady()) {
      frame.talkers.make.say(T.make.need);
      return;
    }
    const board = draftBoard();
    const result = solve(board);
    let line;
    let cards;
    if (result.possible) {
      const shown = result.layouts.slice(0, MAKE_SHOWN);
      line = shown.length < result.count ? fill(T.make['possible-many'], { n: result.count, k: shown.length }) : fill(T.make.possible, { n: result.count });
      cards = shown.map((pieces) => splitCard(layoutView(board, pieces, { counts: null }), ''));
    } else {
      line = `${T.make.impossible} ${reasonLine(board, result)}`;
      cards = [splitCard(viewOf(board, [], { counts: null, lines: result.reason === 'edge' ? [] : result.lines }), '')];
    }
    $('split-make-result').textContent = line;
    $('split-make-picture').replaceChildren(...cards);
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { possible: result.possible, count: result.count, total: result.total, reason: result.reason },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판). 회색 칸과 흰 칸이 모두 있어야 한다. 아니면 null */
  const madeBoard = () => (draftReady() ? draftBoard() : null);

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
    else frame.talkers.make.say(T.make['keep-not-yet']);
  }

  // ---- 단추 잇기 ----
  $('split-impossible').addEventListener('click', pressImpossible);
  $('split-make-w-fewer').addEventListener('click', () => resize(draft.w - 1, draft.h));
  $('split-make-w-more').addEventListener('click', () => resize(draft.w + 1, draft.h));
  $('split-make-h-fewer').addEventListener('click', () => resize(draft.w, draft.h - 1));
  $('split-make-h-more').addEventListener('click', () => resize(draft.w, draft.h + 1));
  $('split-make-parts').addEventListener('click', (event) => {
    const parts = Number(event.target.closest('button')?.dataset.parts);
    if (parts === 3 || parts === 4) changeDraft({ ...draft, parts });
  });
  $('split-make-clear').addEventListener('click', () => changeDraft({ ...draft, grey: [] }));
  $('split-make-solve').addEventListener('click', solveDraft);
  $('split-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    const start = copyBoard(board);
    return {
      mode: custom ? (start.parts === 4 ? 'four' : 'mix') : rungOf(level).mode,
      board: start, // 판: 크기, 회색 칸, 만들 조각 수
      seeds: [], // 자른 선(씨앗)들. 차례대로 놓으면 지금의 조각이 된다
      moves: [], // 무르기에 쓰는 차례: { seeds: 그 전의 선들 }
      tries: [], // 조각이 다 되었던 자르기들(같은 자르기는 한 번)
      found: [], // 모두 찾기: 찾은 자르기들
      strokeCount: 0, // 선을 바꾼 수(자르거나 지운 것)
      cutCount: 0, // 자른 수
      eraseCount: 0, // 자른 선을 지운 수
      missCount: 0, // 선이 아닌 곳을 누른 수
      undoCount: 0,
      resetCount: 0,
      impossibleCount: 0, // 되는 판에 "불가능해요"를 누른 수
      wrongCount: 0, // 사실과 다른 답의 수(다르게 섞인 조각이 있는 자르기를 처음 해 본 것, 되는 판의 "불가능해요")
    };
  }

  const keyOk = (key) => typeof key === 'string' && /^(\d+,\d+,\d+,\d+)(;\d+,\d+,\d+,\d+)*$/.test(key);

  return {
    id: FORMAT,
    T,
    padId: 'split-pad',
    makeId: 'make-split',
    // 규칙 글이 판 전체의 섞인 꼴까지 세 문장이라 판 위에 두면 판이 작아진다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다.
    ruleAside: true,
    homeIds: { sample: 'home-split-sample', blank: 'home-split-blank', ask: 'home-split-ask', play: 'home-split-play', pick: 'home-split-pick', make: 'home-split-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      const seedsOk = (list) => Array.isArray(list) && list.length < saved.board.parts && list.every((seed) => seedOk(saved.board, seed));
      if (!seedsOk(saved.seeds) || !Array.isArray(saved.moves) || !saved.moves.every((move) => seedsOk(move?.seeds))) return false;
      if (![saved.tries, saved.found].every((list) => Array.isArray(list) && list.every(keyOk))) return false;
      return [saved.strokeCount, saved.cutCount, saved.eraseCount, saved.missCount, saved.undoCount, saved.resetCount, saved.impossibleCount, saved.wrongCount].every(count);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글)을 보이거나 감춘다 */
    showParts(on) {
      $('split-board').hidden = !on;
      $('split-count').hidden = !on;
      if (on) {
        // 앞의 형식(규칙 기계 등)이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      flash = null;
    },
    draw,
    ended() {
      flash = null;
    },
    ruleLine(round) {
      const { k, n } = unitValues(round.board);
      const solution = solutionOf(round.board);
      return fill(T.rules[ruleKey(round)], { k, n, total: solution.count, f: lineCount(round.board), no: round.board.parts });
    },
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.strokeCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const { pieces } = applyCuts(round.board, round.seeds);
      return { seeds: round.seeds.slice(), pieces: pieces.length, found: round.found.length, tries: round.tries.length };
    },
    /** 이 판보다 작은 판: 조각 수와 섞인 꼴이 같은 더 작은 판 */
    smaller: (round, turn) => smallerSplit({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const { pieces } = applyCuts(round.board, round.seeds);
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, count: solution.count, total: solution.total, reason: solution.reason },
        // 판을 떠날 때의 선과 조각 수, 잘라 본 자르기, 모두 찾기에서 찾은 자르기
        seeds: round.seeds,
        pieces: pieces.length,
        tries: round.tries,
        found: round.found,
        strokeCount: round.strokeCount,
        cutCount: round.cutCount,
        eraseCount: round.eraseCount,
        missCount: round.missCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        impossibleCount: round.impossibleCount,
        // 수준 맞추기가 보는 "틀린 답"의 수
        wrongCount: round.wrongCount,
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
    drawSample(root, board) {
      drawSplit(root, { w: board.w, h: board.h, grey: board.grey, small: true });
    },
    drawBlank(root) {
      drawSplit(root, { ...T.blank, small: true });
    },
    drawResume(root, saved) {
      const { board } = saved;
      drawSplit(root, { w: board.w, h: board.h, grey: board.grey, cuts: applyCuts(board, saved.seeds ?? []).cuts, small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나와 자른 선 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) {
        drawSplit(root, { ...T.blank, small: true });
        return;
      }
      const board = figureBoard(picture);
      drawSplit(root, { w: board.w, h: board.h, grey: board.grey, cuts: applyCuts(board, picture.cuts).cuts, small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판. 회색 칸과 흰 칸이 모두 있어야 한다(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
