// 구역 지도 맞히기: 판 화면에서 이 형식이 맡는 부분(판, 네모 고르기와 묻기, 지도 칠하기, "이 지도예요", 끝났을 때 하는 말,
// 풀이와 설명)과 직접 만들기(아이가 지도를 칠해 숨기면 선생님이 물어서 알아낸다).
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/regionmap.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 컴퓨터가 판을 이어진 구역 몇 개로 나눈 지도를 숨긴다. 구역마다 모두 몇 칸인지는 처음부터 오른쪽 칸에 적혀 있다.
// "네모로 묻기": 판에서 손가락으로 끌거나 두 모서리 칸을 차례로 눌러 네모를 고르고 "물어보기"를 누른다.
//   선생님은 그 네모 안에 구역마다 몇 칸이 있는지만 말한다. 물은 네모는 판에 옅은 테두리와 번호로 남고, 오른쪽 목록에 대답과 함께 적힌다.
//   같은 네모를 또 고르면 몇 번째에 물었는지와 그때의 대답만 말한다(새로 세지 않는다).
// "지도 칠하기": 구역을 고르고 칸을 누르거나 끌어서 칠한다. 같은 구역으로 칠한 칸을 다시 누르면 지워진다. 무르기와 처음으로(칠한 것 모두 지우기)가 있다.
// "이 지도예요"(칸을 모두 칠했을 때): 숨은 지도와 같으면 판이 끝난다. 아니면 처음 걸리는 사실 하나를 말한다:
//   처음 알려 준 칸 수와 맞지 않는 구역, 대답과 맞지 않는 물음(판에 굵은 테두리), 여러 덩이로 떨어진 구역,
//   또는 "지금까지 물은 것과 모두 맞는 지도지만 숨은 지도와는 다르다". 틀렸다고 하지 않는다.
// 칸이 16개 이하인 판에는 왼쪽 칸의 "맞는 지도 세어 보기"가 있다. 켜면 지금까지의 대답과 맞는 지도가 몇 가지인지 판 아래에 적는다.
//   처음 켤 때 힌트 하나로 센다. 가장 적게 묻기(4단계)는 끝난 뒤에 "네모 몇 개만 물어도 하나로 정해지는지"를 사실로 말한다.
import T from '../content/regionmap.json';
import { LADDER, MAKE_LABELS, MAKE_LEVEL, MAKE_SIDE, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/regionmap-ladder.js';
import {
  MAX_ASKS,
  MAX_HISTORY,
  answerOf,
  areaOf,
  checkBoard,
  copyBoard,
  countable,
  diagnose,
  fitting,
  minQuestions,
  paintOk,
  piecesOf,
  rectOf,
  rectOk,
  sameRect,
  sidesOf,
  sizesOf,
  teacherAsks,
} from '../core/regionmap.js';
import { smallerRegionmap } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { drawRegionmap, regionCard, swatch } from '../ui/regionmap-board.js';

const FORMAT = 'regionmap';
const MODES = ['ask', 'shape', 'three', 'fewest', 'four', 'made'];
const TOOLS = ['ask', 'paint'];
/** "왜 그럴까?"의 그림에 쓰는 지도(src/content/regionmap.json의 map 이름) */
const drawnMap = (rows) => {
  const cells = rows.join('').split('').map(Number);
  return { w: rows[0].length, h: rows.length, regions: [...new Set(cells)].sort((a, b) => a - b), cells };
};
const FIGURES = {
  stairs: () => drawnMap(['0001', '0011', '0111', '0011']),
  pairA: () => drawnMap(['0000', '0001', '0111', '1111']),
  pairB: () => drawnMap(['0000', '0010', '0111', '1111']),
};

const count = (value) => Number.isInteger(value) && value >= 0;
const blankPaint = (board) => Array(board.w * board.h).fill(-1);

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createRegionmap(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let pick = null; // 고르는 중인 네모
  let anchor = null; // 두 번 눌러 고를 때 먼저 누른 모서리 칸
  let focus = null; // 목록에서 눌러 눈에 띄게 한 물음의 차례
  let draft = null; // 직접 만들기에서 칠하던 지도(칸마다의 이름표)
  let makeBrush = 0; // 직접 만들기에서 고른 구역(null은 지우개)
  let found = null; // 직접 만들기에서 선생님이 물은 것 { asks, line }

  function forget() {
    flash = null;
    pick = null;
    anchor = null;
    focus = null;
  }

  // ---- 말 ----
  const nameOf = (label) => T.names[label].name;
  const topicOf = (label) => T.names[label].topic;
  /** "숲 3칸, 바다 1칸" */
  const partsOf = (regions, counts) => regions.map((label, at) => fill(T.part, { face: nameOf(label), n: counts[at] })).join(T.join);
  const totalsLine = (board) => fill(T.totals, { f: partsOf(board.regions, sizesOf(board)) });
  const blankCount = (round) => round.paint.filter((label) => label === -1).length;

  /** 칸의 읽어 주는 이름 */
  const labelOf = (board, paint) => (cell) => {
    const spot = { k: (cell % board.w) + 1, n: Math.floor(cell / board.w) + 1 };
    return paint[cell] >= 0 ? fill(T.labels.cell, { ...spot, face: nameOf(paint[cell]) }) : fill(T.labels.blank, spot);
  };

  /** 지금까지의 대답과 맞는 지도의 수(칸이 16개 이하인 판만) */
  const fitCount = (round) => (countable(round.board) ? fitting(round.board, round.asked).length : null);

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    const strong = [round.lastWrong, focus].filter((at) => at !== null && at !== undefined);
    drawRegionmap($('regionmap-board'), {
      w: board.w,
      h: board.h,
      paint: round.paint,
      asks: round.asked.map((entry, at) => ({ rect: entry.rect, no: at + 1 })),
      strong,
      pick: playing && round.tool === 'ask' ? pick : null,
      anchor: playing && round.tool === 'ask' ? anchor : null,
      pen: round.tool,
      label: labelOf(board, round.paint),
      onPick: playing ? tapPick : undefined,
      onPaint: playing ? tapPaint : undefined,
    });
    const blank = blankCount(round);
    $('regionmap-status').textContent = flash ?? statusOf(round, blank);
    $('regionmap-asked').textContent = String(round.asked.length);
    $('regionmap-painted').textContent = String(round.paint.length - blank);
    $('regionmap-cells').textContent = String(round.paint.length);
    const fits = round.fitOn ? fitCount(round) : null;
    $('regionmap-fit').hidden = fits === null;
    if (fits !== null) $('regionmap-fit').textContent = fits === 1 ? T.fit.one : fill(T.fit.many, { n: fits });
    $('undo').disabled = !playing || round.history.length === 0;
    $('reset').disabled = !playing || blank === round.paint.length;

    // 오른쪽 칸: 처음 알려 준 칸 수, 할 일 고르기, 묻기 또는 칠하기, 물은 것의 목록
    $('regionmap-totals').textContent = totalsLine(board);
    for (const tool of TOOLS) {
      $(`regionmap-${tool}-mode`).setAttribute('aria-pressed', String(round.tool === tool));
      $(`regionmap-${tool}-mode`).disabled = !playing;
    }
    $('regionmap-ask-box').hidden = !playing || round.tool !== 'ask';
    $('regionmap-paint-box').hidden = !playing || round.tool !== 'paint';
    $('regionmap-ask').disabled = !playing || pick === null;
    $('regionmap-clear-pick').disabled = !playing || (pick === null && anchor === null);
    drawPalette($('regionmap-palette'), board.regions, round.brush);
    $('regionmap-submit').disabled = !playing || blank > 0;
    drawList($('regionmap-list'), board, round.asked, focus);

    // 왼쪽 칸: 맞는 지도 세어 보기(칸이 16개 이하인 판만)
    $('regionmap-left').hidden = !countable(board);
    $('regionmap-left').textContent = T.tool[round.fitOn ? 'on' : 'off'];
    $('regionmap-left').setAttribute('aria-pressed', String(round.fitOn));
    frame.showWhy();
  }

  function statusOf(round, blank) {
    if (round.done) return T.status.done;
    if (round.tool === 'ask') {
      if (anchor !== null) return T.status.anchor;
      if (pick !== null) {
        const [k, n] = sidesOf(pick);
        return fill(T.status.picked, { k, n });
      }
      return T.status.ask;
    }
    if (blank === 0) return T.status.ready;
    return round.brush === null ? T.status.eraser : T.status.paint;
  }

  /** 구역 고르기 단추들(구역마다 견본과 이름, 맨 뒤에 지우개) */
  function drawPalette(root, regions, brush) {
    const items = [...regions, null].map((label) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn rm-brush';
      button.dataset.brush = label === null ? 'erase' : String(label);
      button.setAttribute('aria-pressed', String(brush === label));
      const name = document.createElement('span');
      name.textContent = label === null ? T.eraser : nameOf(label);
      button.append(swatch(label), name);
      return button;
    });
    root.replaceChildren(...items);
  }

  /** 물은 것의 목록. 누르면 그 네모를 판에 눈에 띄게 한다 */
  function drawList(root, board, asked, focused) {
    const items = asked.map((entry, at) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rm-row';
      button.dataset.at = String(at);
      button.setAttribute('aria-pressed', String(focused === at));
      const [k, n] = sidesOf(entry.rect);
      button.textContent = fill(T.listRow, { no: ordinal(at + 1), k, n, f: partsOf(board.regions, entry.counts) });
      item.append(button);
      return item;
    });
    root.replaceChildren(...items);
  }

  // ---- 네모 고르기와 묻기 ----
  /** 판을 눌렀다: 끌었으면 그 네모, 눌렀으면 한 모서리(두 번째로 누르면 네모가 된다) */
  function tapPick(from, to, { tap }) {
    const { round } = frame;
    if (!round || round.done || round.tool !== 'ask') return;
    const { w } = round.board;
    if (tap) {
      if (anchor === null) {
        anchor = from;
        pick = rectOf(from, from, w);
      } else {
        pick = rectOf(anchor, from, w);
        anchor = null;
      }
    } else {
      pick = rectOf(from, to, w);
      anchor = null;
    }
    flash = null;
    focus = null;
    draw();
  }

  function clearPick() {
    pick = null;
    anchor = null;
    flash = null;
    draw();
  }

  function ask() {
    const { round } = frame;
    if (!round || round.done || round.tool !== 'ask' || pick === null || !rectOk(round.board, pick)) return;
    const rect = pick.slice();
    pick = null;
    anchor = null;
    round.lastWrong = null;
    const before = round.asked.findIndex((entry) => sameRect(entry.rect, rect));
    if (before >= 0) {
      round.againCount += 1;
      focus = before;
      flash = fill(T.status.again, { no: ordinal(before + 1) });
      frame.note('again', { rect });
      draw();
      frame.persist();
      frame.say(fill(T.play.again, { no: ordinal(before + 1), f: partsOf(round.board.regions, round.asked[before].counts) }));
      return;
    }
    if (round.asked.length >= MAX_ASKS) return;
    const counts = answerOf(round.board, rect);
    const asked = [...round.asked, { rect, counts, t: frame.stamp(), left: null }];
    // 물은 뒤에도 맞는 지도의 수(칸이 16개 이하인 판). 화면에는 도구를 켰을 때만 보인다(기록에 남긴다)
    asked[asked.length - 1].left = countable(round.board) ? fitting(round.board, asked).length : null;
    round.asked = asked;
    round.askCount += 1;
    round.moveCount += 1;
    focus = null;
    const parts = partsOf(round.board.regions, counts);
    flash = fill(T.status.asked, { no: ordinal(asked.length), f: parts });
    frame.note('ask', { rect, counts, area: areaOf(rect), left: asked[asked.length - 1].left });
    draw();
    // 방금 물은 것이 목록 아래로 밀려 있으면 보이게 굴린다
    $('regionmap-list').lastElementChild?.scrollIntoView?.({ block: 'nearest' });
    frame.persist();
    frame.say(fill(T.play.answer, { f: parts }));
  }

  function setTool(tool) {
    const { round } = frame;
    if (!round || round.done || !TOOLS.includes(tool) || round.tool === tool) return;
    round.tool = tool;
    anchor = null;
    flash = null;
    frame.note('tool', { tool });
    draw();
    frame.persist();
  }

  function toggleFocus(at) {
    const { round } = frame;
    if (!round || !(at in round.asked)) return;
    focus = focus === at ? null : at;
    flash = null;
    draw();
  }

  // ---- 칠하기 ----
  function setBrush(value) {
    const { round } = frame;
    if (!round || round.done) return;
    const brush = value === 'erase' ? null : Number(value);
    if (brush !== null && !round.board.regions.includes(brush)) return;
    round.brush = brush;
    flash = null;
    draw();
    frame.persist();
  }

  /** 칸을 눌렀거나 끌고 지나갔다: 고른 구역으로 칠한다. 같은 구역으로 칠한 칸 하나를 누르면 지운다 */
  function tapPaint(cells, { tap }) {
    const { round } = frame;
    if (!round || round.done || round.tool !== 'paint') return;
    const next = round.paint.slice();
    if (tap && round.brush !== null && next[cells[0]] === round.brush) next[cells[0]] = -1;
    else for (const cell of cells) next[cell] = round.brush ?? -1;
    if (next.every((label, cell) => label === round.paint[cell])) return;
    round.history = [...round.history, round.paint].slice(-MAX_HISTORY);
    round.paint = next;
    round.paintCount += 1;
    round.moveCount += 1;
    round.lastWrong = null;
    flash = null;
    frame.note('paint', { cells, brush: round.brush });
    draw();
    frame.persist();
  }

  function undo() {
    const { round } = frame;
    if (!round || round.done || round.history.length === 0) return;
    round.paint = round.history[round.history.length - 1];
    round.history = round.history.slice(0, -1);
    round.undoCount += 1;
    round.lastWrong = null;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 모습에 한 말은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  function reset() {
    const { round } = frame;
    if (!round || round.done || round.paint.every((label) => label === -1)) return;
    round.history = [...round.history, round.paint].slice(-MAX_HISTORY);
    round.paint = blankPaint(round.board);
    round.resetCount += 1;
    round.lastWrong = null;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  // ---- "이 지도예요" ----
  function submit() {
    const { round } = frame;
    if (!round || round.done || blankCount(round) > 0) return;
    const result = diagnose(round.board, round.paint, round.asked);
    const left = fitCount(round);
    round.checks = [...round.checks, { t: frame.stamp(), kind: result.kind, at: result.at ?? null, label: result.label ?? null, left }];
    round.answers.push({ t: frame.stamp(), answer: round.paint.join(''), correct: result.kind === 'same', guess: null });
    frame.note('check', { kind: result.kind, at: result.at ?? null, left });
    round.moveCount += 1;
    if (result.kind === 'same') {
      round.leftAtEnd = left;
      frame.finish('solved');
      return;
    }
    round.wrongCount += 1;
    round.lastWrong = result.kind === 'question' ? result.at : null;
    focus = null;
    flash = null;
    draw();
    frame.persist();
    frame.say(checkLine(result));
  }

  function checkLine(result) {
    if (result.kind === 'totals') return fill(T.play.totals, { face: topicOf(result.label), n: result.painted, k: result.total });
    if (result.kind === 'question') return fill(T.play.question, { no: ordinal(result.at + 1), face: topicOf(result.label), n: result.painted, k: result.answer });
    if (result.kind === 'split') return fill(T.play.split, { face: topicOf(result.label), n: result.pieces });
    return frame.round.asked.length === 0 ? T.play['fits-none'] : T.play.fits;
  }

  // ---- 맞는 지도 세어 보기 ----
  function toggleFit() {
    const { round } = frame;
    if (!round || !countable(round.board)) return;
    round.fitOn = !round.fitOn;
    if (round.fitOn) {
      round.fitShown = true;
      round.fitCount += 1;
    }
    flash = null;
    frame.note('fit', { on: round.fitOn, left: fitCount(round) });
    draw();
    frame.keep();
  }

  // ---- 끝났을 때 하는 말: 한 일과 사실만 말한다 ----
  function rightLine(round, solution) {
    const asked = round.askCount;
    const parts = [asked === 0 ? T.right['done-none'] : fill(T.right.done, { n: asked })];
    const left = round.leftAtEnd ?? null;
    if (left !== null && left > 1) parts.push(fill(T.right['left-many'], { n: left }));
    if (round.mode === 'fewest' && solution.min) {
      const least = solution.min.size;
      parts.push(fill(T.right['fewest-min'], { k: least }));
      if (asked > least) parts.push(T.right['fewest-more']);
      else if (asked === least && left === 1) parts.push(fill(T.right['fewest-same'], { k: least }));
    }
    // 이 형식의 판을 처음 끝까지 했으면 "왜 그럴까?"가 열렸다는 것을 알려 준다
    const finished = new Set(frame.records().filter((record) => record.kind === 'round' && record.format === FORMAT && record.outcome === 'solved').map((record) => record.id));
    if (!round.side && finished.size === 1 && finished.has(round.id)) parts.push(T.right['why-open']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 풀이: 숨은 지도, 그리고 (칸이 16개 이하인 판) 이 지도 하나로 정해지는 가장 적은 네모들 */
  function solutionPages(round, solution) {
    const { board } = round;
    const shown = { w: board.w, h: board.h, paint: board.cells };
    const pages = [{ say: T.solution.map, nodes: [rowOf([regionCard(shown, T.solution.note, { big: true })])] }];
    if (solution.min && solution.min.size > 0) {
      const asks = solution.min.rects.map((rect, at) => ({ rect, no: at + 1 }));
      pages.push({ say: fill(T.solution.min, { k: solution.min.size }), nodes: [rowOf([regionCard({ ...shown, asks }, T.solution['min-note'], { big: true })])] });
    }
    return pages;
  }

  /** "왜 그럴까?"의 그림 하나: 물은 네모와 번호, 칸 하나만 물은 곳은 그 구역으로 칠한다(show면 지도를 다 칠한다) */
  function figureView(item) {
    const map = FIGURES[item.map]();
    const paint = item.show ? map.cells.slice() : blankPaint(map);
    for (const rect of item.asks) if (areaOf(rect) === 1) paint[rect[1] * map.w + rect[0]] = map.cells[rect[1] * map.w + rect[0]];
    return { w: map.w, h: map.h, paint, asks: item.asks.map((rect, at) => ({ rect, no: at + 1 })) };
  }

  /** "왜 그럴까?": 칸 하나씩 묻기 → 큰 네모 하나 → 반쪽 둘 → 셋으로 하나만 남는다(이름) → 반쪽으로는 못 가르는 두 지도 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다. 한 장뿐인 그림은 크게, 두 장은 조금 크게 그린다
      get nodes() {
        return [rowOf(slide.figures.map((item) => regionCard(figureView(item), item.note, { big: slide.figures.length === 1, mid: slide.figures.length === 2 })))];
      },
    }));
  }

  // ---- 직접 만들기: 4×4 판에 숲, 바다, 모래밭을 칠해 숨기면 선생님이 물어서 알아낸다 ----
  const makeShape = { w: MAKE_SIDE, h: MAKE_SIDE };

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const ok = Array.isArray(saved?.paint) && saved.paint.length === MAKE_SIDE * MAKE_SIDE && saved.paint.every((label) => label === -1 || MAKE_LABELS.includes(label));
    return ok ? saved.paint.slice() : Array(MAKE_SIDE * MAKE_SIDE).fill(-1);
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    makeBrush = MAKE_LABELS[0];
    found = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    drawRegionmap($('regionmap-make-board'), {
      ...makeShape,
      paint: draft,
      asks: found ? found.asks.map((entry, at) => ({ rect: entry.rect, no: at + 1 })) : [],
      pen: 'paint',
      label: labelOf(makeShape, draft),
      onPaint: paintDraft,
    });
    drawPalette($('regionmap-make-palette'), MAKE_LABELS, makeBrush);
    $('regionmap-make-clear').disabled = draft.every((label) => label === -1);
    $('regionmap-make-result').textContent = found ? found.line : '';
    const regions = madeRegions();
    drawList($('regionmap-make-list'), { regions }, found ? found.asks : [], null);
  }

  /** 칠한 구역들(작은 것부터) */
  const madeRegions = () => MAKE_LABELS.filter((label) => draft.includes(label));

  function changeDraft(next) {
    const said = found !== null;
    draft = next;
    found = null;
    log.saveDraft({ paint: draft }, FORMAT);
    drawMake();
    // 앞의 대답은 바뀐 지도에 맞지 않는다
    if (said) frame.talkers.make.say(T.make.changed);
  }

  function paintDraft(cells, { tap }) {
    const next = draft.slice();
    if (tap && makeBrush !== null && next[cells[0]] === makeBrush) next[cells[0]] = -1;
    else for (const cell of cells) next[cell] = makeBrush ?? -1;
    if (next.every((label, cell) => label === draft[cell])) return;
    changeDraft(next);
  }

  /** 다 만든 지도(공책에 남기거나 선생님이 물어볼 판). 칸을 모두 칠했고, 구역이 둘 이상이고, 구역마다 한 덩이여야 한다 */
  function madeBoard() {
    if (!draft) return null;
    const board = { ...makeShape, regions: madeRegions(), cells: draft.slice() };
    return checkBoard(board) === null ? copyBoard(board) : null;
  }

  /** 아직 숨길 지도가 아닌 까닭 하나 */
  function notYetLine() {
    const blank = draft.filter((label) => label === -1).length;
    if (blank > 0) return fill(T.make.blank, { n: blank });
    const regions = madeRegions();
    if (regions.length < 2) return T.make.one;
    const apart = regions.find((label) => piecesOf(draft, MAKE_SIDE, MAKE_SIDE, label) > 1);
    return fill(T.make.split, { face: topicOf(apart), n: piecesOf(draft, MAKE_SIDE, MAKE_SIDE, apart) });
  }

  /** "선생님, 물어 보세요": 선생님이 대답과 맞는 지도를 가장 고르게 나누는 네모부터 물어 하나가 남을 때까지 묻는다 */
  function solveDraft() {
    const board = madeBoard();
    if (!board) {
      frame.talkers.make.say(notYetLine());
      return;
    }
    const asks = teacherAsks(board).map((rect) => ({ rect, counts: answerOf(board, rect) }));
    const least = minQuestions(board);
    const lines = [fill(T.make.found, { n: asks.length })];
    if (least) lines.push(fill(T.make.min, { k: least.size }));
    const line = lines.join(' ');
    found = { asks, line };
    drawMake();
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { possible: true, sizes: sizesOf(board), asks: asks.map((entry) => entry.rect), min: least ? least.size : null },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  // ---- 단추 잇기 ----
  $('regionmap-ask-mode').addEventListener('click', () => setTool('ask'));
  $('regionmap-paint-mode').addEventListener('click', () => setTool('paint'));
  $('regionmap-ask').addEventListener('click', ask);
  $('regionmap-clear-pick').addEventListener('click', clearPick);
  $('regionmap-palette').addEventListener('click', (event) => {
    const value = event.target.closest('button')?.dataset.brush;
    if (value !== undefined) setBrush(value);
  });
  $('regionmap-submit').addEventListener('click', submit);
  $('regionmap-list').addEventListener('click', (event) => {
    const at = event.target.closest('button')?.dataset.at;
    if (at !== undefined) toggleFocus(Number(at));
  });
  $('regionmap-left').addEventListener('click', toggleFit);
  $('regionmap-make-palette').addEventListener('click', (event) => {
    const value = event.target.closest('button')?.dataset.brush;
    if (value === undefined) return;
    makeBrush = value === 'erase' ? null : Number(value);
    drawMake();
  });
  $('regionmap-make-clear').addEventListener('click', () => changeDraft(Array(MAKE_SIDE * MAKE_SIDE).fill(-1)));
  $('regionmap-make-solve').addEventListener('click', solveDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    const start = copyBoard(board);
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: start, // 숨은 지도
      asked: [], // 물은 것 { rect, counts, t, left }. left는 물은 뒤 대답과 맞는 지도의 수(칸이 16개 이하인 판. 아니면 null)
      paint: blankPaint(start), // 칸마다 칠한 구역의 이름표(-1은 칠하지 않은 칸)
      history: [], // 무르기를 위한 앞의 칠한 모습들
      tool: 'ask', // 지금 하는 일: 'ask'(네모로 묻기) | 'paint'(지도 칠하기)
      brush: start.regions[0], // 칠할 구역(null은 지우개)
      checks: [], // "이 지도예요"를 누른 것들 { t, kind, at, label, left }
      lastWrong: null, // 바로 앞 "이 지도예요"에서 맞지 않은 물음의 차례(굵은 테두리)
      leftAtEnd: null, // 끝났을 때 대답과 맞는 지도의 수
      askCount: 0, // 물은 수(같은 네모를 또 고른 것은 세지 않는다)
      againCount: 0, // 이미 물은 네모를 또 고른 수
      paintCount: 0, // 칠한 수(누르기나 끌기 한 번이 하나)
      undoCount: 0,
      resetCount: 0,
      wrongCount: 0, // 숨은 지도와 다른 지도로 "이 지도예요"를 누른 수
      moveCount: 0, // 이 판에서 한 일의 수(묻기, 칠하기, "이 지도예요")
      fitOn: false, // 지금 "맞는 지도 세어 보기"를 켜 두었는가
      fitShown: false, // 한 번이라도 켰는가
      fitCount: 0, // 켠 수
    };
  }

  /** 적어 둔 단계가 판의 종류와 맞는가 */
  const levelOk = (saved) => {
    if (saved.custom === true) return saved.level === MAKE_LEVEL && saved.mode === 'made';
    if (!Number.isInteger(saved.level) || saved.level < LADDER[0].level || saved.level > TOP_LEVEL) return false;
    return rungOf(saved.level).mode === saved.mode;
  };

  /** 적어 둔 물음 하나가 쓸 수 있는 값인가(대답이 숨은 지도와 맞는가) */
  const entryOk = (board, entry) => entry && rectOk(board, entry.rect) && Array.isArray(entry.counts) && entry.counts.join() === answerOf(board, entry.rect).join();

  /** 판에 그리는 것: 하던 판과 공책의 그림(직접 만든 판을 아직 손대지 않았으면 만든 지도를 다 칠해 보인다) */
  function resumeView(saved) {
    const { board } = saved;
    const fresh = saved.custom === true && saved.asked.length === 0 && saved.paint.every((label) => label === -1);
    return { w: board.w, h: board.h, paint: fresh ? board.cells : saved.paint, asks: saved.asked.map((entry, at) => ({ rect: entry.rect, no: at + 1 })), small: true };
  }

  return {
    id: FORMAT,
    T,
    padId: 'regionmap-pad',
    makeId: 'make-regionmap',
    // 오른쪽 칸에 물은 것의 목록이 길게 쌓인다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다
    ruleAside: true,
    homeIds: { sample: 'home-regionmap-sample', blank: 'home-regionmap-blank', ask: 'home-regionmap-ask', play: 'home-regionmap-play', pick: 'home-regionmap-pick', make: 'home-regionmap-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve(round) {
      const { board } = round;
      const can = countable(board);
      return { possible: true, sizes: sizesOf(board), countable: can, maps: can ? fitting(board, []).length : null, min: can ? minQuestions(board) : null };
    },
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null || !levelOk(saved)) return false;
      const { board } = saved;
      if (!Array.isArray(saved.asked) || !saved.asked.every((entry) => entryOk(board, entry))) return false;
      if (!paintOk(board, saved.paint) || !Array.isArray(saved.history) || !saved.history.every((paint) => paintOk(board, paint))) return false;
      if (!TOOLS.includes(saved.tool) || !(saved.brush === null || board.regions.includes(saved.brush))) return false;
      if (!Array.isArray(saved.checks) || !(saved.lastWrong === null || (Number.isInteger(saved.lastWrong) && saved.lastWrong in saved.asked))) return false;
      if (![saved.askCount, saved.againCount, saved.paintCount, saved.undoCount, saved.resetCount, saved.wrongCount, saved.moveCount, saved.fitCount].every(count)) return false;
      return [saved.fitOn, saved.fitShown].every((value) => typeof value === 'boolean');
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('regionmap-board').hidden = !on;
      $('regionmap-count').hidden = !on;
      if (!on) $('regionmap-left').hidden = true;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다(칠한 것을 무른다).
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter: forget,
    draw,
    ended: forget,
    ruleLine: (round) => `${fill(T.rules, { n: round.board.regions.length })} ${T.asks[round.mode]}`,
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.askCount > 0 || round.paintCount > 0 || round.checks.length > 0 || round.fitCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      return { asked: round.asked.map((entry) => entry.rect), painted: round.paint.filter((label) => label !== -1).length, left: fitCount(round), tool: round.tool };
    },
    /** 이 판보다 작은 판: 구역의 수가 같고 가로세로가 더 작은 판 */
    smaller: (round, turn) => smallerRegionmap({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        // 구역마다의 칸 수, 칸이 16개 이하인 판이면 처음 맞는 지도의 수와 이 지도 하나로 정해지는 가장 적은 네모의 수
        solution: { possible: true, sizes: solution.sizes, maps: solution.maps, min: solution.min ? solution.min.size : null },
        // 질문 힌트와 "맞는 지도 세어 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.fitShown ? 1 : 0),
        fitShown: round.fitShown,
        fitCount: round.fitCount,
        // 물은 것(차례대로, 네모와 대답과 물은 뒤 맞는 지도의 수)과 판을 떠날 때 칠한 모습
        asked: round.asked,
        askCount: round.askCount,
        againCount: round.againCount,
        paint: round.paint,
        checks: round.checks,
        leftAtEnd: round.leftAtEnd,
        paintCount: round.paintCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        moveCount: round.moveCount,
        // 수준 맞추기가 보는 "틀린 답"의 수(숨은 지도와 다른 지도로 "이 지도예요"를 누른 수)
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    /** 글자판: 칸은 저마다 Enter와 빈칸 글쇠로 누른다(판이 맡는다) */
    onKey() {},

    // ---- 처음 화면에 그리는 그림(숨은 지도는 그리지 않는다. 판의 크기만 보인다) ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawRegionmap(root, { w: board.w, h: board.h, paint: blankPaint(board), small: true });
    },
    drawBlank(root) {
      drawRegionmap(root, { w: MAKE_SIDE, h: MAKE_SIDE, paint: Array(MAKE_SIDE * MAKE_SIDE).fill(-1), small: true });
    },
    /** 하던 판과 공책의 그림: 칠한 모습과 물은 네모 */
    drawResume(root, saved) {
      drawRegionmap(root, resumeView(saved));
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 첫 판 크기의 빈 판과 물은 네모 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawRegionmap(root, { w: MAKE_SIDE, h: MAKE_SIDE, paint: Array(MAKE_SIDE * MAKE_SIDE).fill(-1), small: true });
        return;
      }
      const { board } = generateBoard(entry.level, entry.picture.seed);
      drawRegionmap(root, { w: board.w, h: board.h, paint: blankPaint(board), asks: [{ rect: [0, 0, Math.floor((board.w - 1) / 2), board.h - 1] }], small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
