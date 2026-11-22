// 성냥개비: 판 화면에서 이 형식이 맡는 부분(판, 성냥 빼기와 옮기기, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/matches.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 빼기 판: 성냥을 누르면 빠지고, 뺀 자리를 누르면 돌아온다. 이미 k개를 뺐으면 더 빼지 않고 그 사실을 판 아래에 적는다.
// 옮기기 판: 성냥을 누르고(고른다) 빈 자리를 누르면 그리로 옮겨진다. 옮긴 성냥의 수는 처음 자리에 없는 성냥의 수다.
//   옮긴 성냥이 k개를 넘게 되는 옮기기는 하지 않고 그 사실을 판 아래에 적는다(옮겨 온 성냥은 다시 옮길 수 있다).
// 판 아래에는 지금 정사각형의 수와 뺀(옮긴) 성냥의 수를 늘 적는다. 선생님은 판정하지 않는다.
// 빼거나 옮긴 성냥이 k개가 되었는데 할 일과 다르면 지금 정사각형의 수(또는 변이 아닌 성냥의 수)를 그대로 말한다. 같은 모습을 다시 만들면 그렇다고 말한다.
// 할 일대로 되면 끝난다. 답은 여럿일 수 있고 어느 것이든 된다.
// 1단계(little)에는 할 일대로 되는 방법이 없는 판이 섞인다(모두 성냥 하나만 빼는 판). 이 단계의 판에는 "불가능해요" 단추가 있다.
//   되는 판에 누르면 틀렸다고 하지 않고 되는 방법이 있다는 사실만 말한다. 판은 그대로 이어진다.
//   안 되는 판을 "불가능해요"로 끝내면 성냥 자리마다 그 성냥 하나만 뺐을 때 남는 정사각형 수를 판에 적고, 남는 수가 어떤 수뿐인지 판 아래에 적는다.
// 판의 종류(mode)
//   little 작은 판에서 빼기(1단계)   grid 3×3 판에서 빼기(2단계)   shift 옮겨서 맞추기(3단계)
//   tidy   모두 변이 되게 빼기(4단계)  move 모두 변이 되게 옮기기(5단계)  made 직접 만든 판
// 왼쪽 칸의 "정사각형 모두 보기"를 켜면 판에서 찾은 정사각형마다 테두리를 그리고(크기마다 선의 모양이 다르다), 크기마다의 수를 오른쪽에 적는다.
// 처음 켤 때 힌트 하나로 센다.
// 1단계의 성냥 하나만 빼는 판에는 "모든 경우 펼쳐 보기"도 있다. 켜면 성냥 자리마다 동그라미를 그리고, 해 본 경우(그 성냥 하나만 뺀 모습)에는
//   남은 정사각형 수를 적는다. 해 보지 않은 경우의 수는 보이지 않는다(답을 알려 주지 않는다). 몇 가지를 해 보았는지와 남은 수마다 몇 가지인지는 오른쪽에 적는다.
//   처음 켤 때 힌트 하나로 센다.
import T from '../content/matches.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/matches-ladder.js';
import { MAX_K, boardKey, changedCount, checkBoard, copyBoard, countSquares, edgeCount, edgeEnds, edgesFit, edgesOk, fullGrid, isDone, looseMatches, oneOutCases, oneOutCounts, sizeCounts, solve, squaresIn, squaresOf, tally, triedOneOut, vEdge } from '../core/matches.js';
import { smallerMatches } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { boardCard, drawBoard, drawMini, sizeSample } from '../ui/matches-board.js';

const FORMAT = 'matches';
const MODES = ['little', 'grid', 'shift', 'tidy', 'move', 'made'];
/** 기록에 남기는 무르기 차례와 끝까지 해 본 모습의 수의 위 끝 */
const MAX_MOVES = 300;
const MAX_TRIES = 200;
/** 직접 만들기의 모눈 크기(가로세로 같은 칸 수)와 처음 크기 */
const MAKE_MIN = 2;
const MAKE_MAX = 4;
const MAKE_FIRST = 3;

const sorted = (set) => [...set].sort((a, b) => a - b);
const count = (value) => Number.isInteger(value) && value >= 0;

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createMatches(frame) {
  const { $, log } = frame;
  let pick = null; // 옮기기 판에서 고른 성냥의 변
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let told = false; // 선생님이 방금 지금 모습에 기대는 말을 했는가(모습이 바뀌면 지금 정사각형의 수로 덮는다)
  let draft = null; // 직접 만들기에서 만들던 판 { size, on, kind, k, n, tidy }
  let made = null; // 직접 만들기에서 선생님이 따진 것(판을 고치면 지운다)

  const ruleKey = (board) => (board.tidy ? `${board.kind}-tidy` : board.kind);
  /** "불가능해요" 단추가 있는 판: 안 되는 판이 섞이는 1단계의 판(작은 판도) */
  const hasImpossible = (round) => round.mode === 'little';
  /** "모든 경우 펼쳐 보기"가 있는 판: 1단계의 성냥 하나만 빼는 판 */
  const hasCases = (round) => hasImpossible(round) && round.board.kind === 'remove' && round.board.k === 1 && !round.board.tidy;
  /** 해 본 경우(그 성냥 하나만 뺀 모습을 만들어 본 성냥) */
  const triedOf = (round) => triedOneOut(round.board, round.tries.map((key) => (key === '' ? [] : key.split(',').map(Number))));
  /**
   * 경우 표시: 성냥마다 그 성냥 하나만 뺐을 때 남는 정사각형 수. all이 아니면 해 본 경우만 수를 적는다
   * @returns {{edge: number, squares: number | null}[]}
   */
  function casesOf(round, all) {
    const tried = all ? null : triedOf(round);
    return oneOutCases(round.board.w, round.board.h, round.board.matches).map((item) => ({ edge: item.edge, squares: all || tried.has(item.edge) ? item.squares : null }));
  }
  /** 안 되는 판의 까닭 글: 성냥을 하나씩 빼 보면 남는 수가 한 가지인지 두 가지인지 */
  function reasonLine(group, board, prefix = 'reason') {
    const [n, k] = oneOutCounts(board.w, board.h, board.matches);
    return fill(group[`${prefix}-${k === undefined ? 'one' : 'two'}`], { total: board.matches.length, n, k });
  }
  /** 힌트의 종류: 약속이 있는 판, 빼기, 옮겨서 정사각형을 늘리거나 그대로 두는 판(새 정사각형을 닫아야 한다), 줄이는 판 */
  function hintKey(board) {
    if (board.tidy) return 'tidy';
    if (board.kind === 'remove') return 'remove';
    return board.n >= countSquares(board.w, board.h, board.matches) ? 'grow' : 'shrink';
  }

  /** 한 번 푼 판은 적어 둔다(판을 열 때마다, 기록을 남길 때마다 다시 풀지 않게) */
  const memo = new Map();
  function solutionOf(board) {
    const key = boardKey(board);
    if (!memo.has(key)) memo.set(key, solve(board));
    return memo.get(key);
  }

  // ---- 읽어 주는 이름 ----
  function edgeName(w, h, edge) {
    const end = edgeEnds(w, h, edge);
    return fill(T.labels[end.horizontal ? 'h' : 'v'], { no: ordinal(end.r + 1), k: end.c + 1 });
  }

  const labelsFor = (w, h) => ({
    board: fill(T.labels.board, { n: w, k: h }),
    edge: (edge, state) => fill(T.labels[state], { face: edgeName(w, h, edge) }),
  });

  // ---- 판 ----
  function draw() {
    const { round, solution } = frame;
    const { board } = round;
    const playing = !round.done;
    const squares = squaresIn(board.w, board.h, round.on);
    // 경우 표시: 하는 동안은 도구를 켰을 때 해 본 경우만, 안 되는 판을 끝냈으면 모든 경우(까닭)
    const reason = !playing && solution?.possible === false && hasCases(round);
    const looking = playing && round.casesOn && hasCases(round);
    const cases = reason ? casesOf(round, true) : looking ? casesOf(round, false) : null;
    drawBoard($('matches-board'), {
      w: board.w,
      h: board.h,
      on: round.on,
      origin: board.matches,
      kind: board.kind,
      pick: playing ? pick : null,
      outline: round.outlineOn ? squares : null,
      cases,
      onEdge: playing ? tapEdge : undefined,
      // 빼기 판은 성냥과 뺀 자리만 누를 수 있다
      tappable: board.kind === 'remove' ? (edge, state) => state !== 'empty' : undefined,
      labels: labelsFor(board.w, board.h),
    });
    const changed = changedCount(board, round.on);
    $('matches-squares').textContent = String(squares.length);
    $('matches-removed').textContent = String(changed);
    $('matches-moved').textContent = String(changed);
    $('matches-removed-line').hidden = board.kind !== 'remove';
    $('matches-moved-line').hidden = board.kind !== 'move';
    $('matches-status').textContent = flash ?? statusOf(round, playing);
    $('matches-remove-box').hidden = board.kind !== 'remove';
    $('matches-move-box').hidden = board.kind !== 'move';
    $('matches-outline').setAttribute('aria-pressed', String(round.outlineOn));
    $('matches-size-box').hidden = !round.outlineOn;
    drawSizes(board, round.on);
    $('matches-cases').hidden = !hasCases(round);
    $('matches-cases').disabled = !playing;
    $('matches-cases').setAttribute('aria-pressed', String(looking));
    $('matches-cases-box').hidden = !looking;
    if (looking) drawCases(round);
    $('matches-maybe').hidden = !hasImpossible(round);
    $('matches-impossible').disabled = !playing;
    $('undo').disabled = !playing || round.moves.length === 0;
    $('reset').disabled = !playing || round.on.join() === board.matches.join();
    frame.showWhy();
  }

  function statusOf(round, playing) {
    const { board } = round;
    if (!playing) {
      if (isDone(board, round.on)) return fill(T.status.done, { n: board.n });
      return frame.solution?.possible === false && hasCases(round) ? reasonLine(T.status, board) : '';
    }
    if (pick !== null) return T.status.picked;
    if (changedCount(board, round.on) === board.k) return fill(T.status[`full-${board.kind}`], { k: board.k });
    return T.status[board.kind];
  }

  /** "정사각형 모두 보기": 크기마다의 수(선 모양 보기와 함께)와 모두의 수 */
  function drawSizes(board, on) {
    const list = $('matches-size-list');
    const counts = sizeCounts(board.w, board.h, on);
    const total = counts.reduce((sum, value) => sum + value, 0);
    if (total === 0) {
      list.replaceChildren(paragraph(T.sizes.none));
      return;
    }
    const items = document.createElement('ul');
    items.className = 'mt-sizes';
    counts.forEach((value, index) => {
      if (value === 0) return;
      const item = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = fill(T.sizes.line, { k: index + 1, n: value });
      item.append(sizeSample(index + 1), text);
      items.append(item);
    });
    list.replaceChildren(items, paragraph(fill(T.sizes.total, { n: total })));
  }

  /** "모든 경우 펼쳐 보기"의 오른쪽 글: 해 본 경우의 수, 남은 정사각형 수마다 몇 가지인지 */
  function drawCases(round) {
    const cases = casesOf(round, false);
    const tried = cases.filter((item) => item.squares !== null);
    const total = cases.length;
    const key = tried.length === 0 ? 'none' : tried.length === total ? 'all' : 'tried';
    const lines = [paragraph(fill(T.cases[key], { total, n: tried.length }))];
    const byCount = new Map();
    for (const item of tried) byCount.set(item.squares, (byCount.get(item.squares) ?? 0) + 1);
    for (const [n, k] of [...byCount].sort((a, b) => a[0] - b[0])) lines.push(paragraph(fill(T.cases.count, { n, k })));
    $('matches-cases-list').replaceChildren(...lines);
  }

  function paragraph(text) {
    const node = document.createElement('p');
    node.className = 'pad-note';
    node.textContent = text;
    return node;
  }

  // ---- 성냥 빼기와 옮기기 ----
  function tapEdge(edge) {
    const { round } = frame;
    if (!round || round.done) return;
    flash = null;
    const { board } = round;
    const now = new Set(round.on);
    if (board.kind === 'remove') {
      if (now.has(edge)) {
        // 이미 k개를 뺐으면 더 빼지 않는다
        if (changedCount(board, round.on) >= board.k) {
          round.limitCount += 1;
          flash = fill(T.status['limit-remove'], { k: board.k });
          frame.note('limit', { edge });
          draw();
          return;
        }
        now.delete(edge);
        change(sorted(now), 'take', { edge });
      } else if (board.matches.includes(edge)) {
        now.add(edge);
        change(sorted(now), 'back', { edge });
      }
      return;
    }
    // 옮기기: 성냥을 누르면 고르고(다시 누르면 놓는다), 빈 자리를 누르면 고른 성냥을 그리로 옮긴다
    if (now.has(edge)) {
      pick = pick === edge ? null : edge;
      draw();
      return;
    }
    if (pick === null) {
      flash = T.status['pick-first'];
      draw();
      return;
    }
    now.delete(pick);
    now.add(edge);
    const next = sorted(now);
    if (changedCount(board, next) > board.k) {
      round.limitCount += 1;
      flash = fill(T.status['limit-move'], { k: board.k });
      frame.note('limit', { from: pick, to: edge });
      draw();
      return;
    }
    const from = pick;
    pick = null;
    change(next, 'shift', { from, to: edge });
  }

  /** 놓인 모습을 바꾼다. 다 됐으면 끝내고, 빼거나 옮긴 성냥이 k개면 견주어 보고, 아니면 앞의 말을 덮는다 */
  function change(next, how, data) {
    const { round } = frame;
    const { board } = round;
    round.moves = [...round.moves, round.on.slice()].slice(-MAX_MOVES);
    round.on = next;
    round.moveCount += 1;
    if (how === 'take') round.takeCount += 1;
    else if (how === 'back') round.backCount += 1;
    else round.shiftCount += 1;
    frame.note(how, { ...data, on: next.slice() });
    if (isDone(board, next)) {
      round.answers.push({ t: frame.stamp(), answer: `edges:${next.join(',')}`, correct: true, guess: null });
      frame.note('answer', { answer: 'done', correct: true });
      frame.finish('solved');
      return;
    }
    if (changedCount(board, next) === board.k) {
      judgeFull();
      return;
    }
    draw();
    frame.persist();
    // 선생님이 방금 한 말은 앞의 모습에 대한 것이다. 지금 정사각형의 수로 덮는다
    if (told) {
      told = false;
      frame.say(fill(T.play.now, { n: countSquares(board.w, board.h, next) }));
    }
  }

  /** 빼거나 옮긴 성냥이 k개인데 할 일과 다르다: 같은 모습을 다시 만들었는지, 아니면 정사각형의 수나 변이 아닌 성냥의 수를 말한다 */
  function judgeFull() {
    const { round } = frame;
    const { board } = round;
    const key = round.on.join(',');
    const again = round.tries.includes(key);
    round.fullCount += 1;
    // 안 되는 판에서 빼 보는 것은 경우를 하나씩 해 보는 일이라 틀린 답으로 세지 않는다
    if (frame.solution?.possible !== false) round.wrongCount += 1;
    if (!again) round.tries = [...round.tries, key].slice(-MAX_TRIES);
    frame.note('full', { again });
    draw();
    frame.persist();
    told = true;
    if (again) {
      frame.say(T.play['same-again']);
      return;
    }
    const squares = countSquares(board.w, board.h, round.on);
    if (squares !== board.n) frame.say(fill(T.play[`count-${board.kind}`], { k: board.k, n: squares }));
    else frame.say(fill(T.play.loose, { n: squares, k: looseMatches(board.w, board.h, round.on).length }));
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    round.on = round.moves.at(-1).slice();
    round.moves = round.moves.slice(0, -1);
    round.undoCount += 1;
    pick = null;
    flash = null;
    told = false;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 말(정사각형의 수, 변이 아닌 성냥)은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  /** 처음으로: 처음 모습으로 돌린다. 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (round.done || round.on.join() === round.board.matches.join()) return;
    round.moves = [...round.moves, round.on.slice()].slice(-MAX_MOVES);
    round.on = round.board.matches.slice();
    round.resetCount += 1;
    pick = null;
    flash = null;
    told = false;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  /** 왼쪽 칸의 도구: 찾은 정사각형마다 테두리를 그린다. 처음 켤 때 힌트 하나로 센다 */
  function toggleOutline() {
    const { round } = frame;
    if (!round) return;
    round.outlineOn = !round.outlineOn;
    if (round.outlineOn) {
      round.outlineShown = true;
      round.outlineCount += 1;
    }
    frame.note('outline', { on: round.outlineOn });
    draw();
    frame.keep();
  }

  /** 왼쪽 칸의 "모든 경우 펼쳐 보기": 해 본 경우마다 남은 정사각형 수를 성냥 자리에 적는다. 처음 켤 때 힌트 하나로 센다 */
  function toggleCases() {
    const { round } = frame;
    if (!round || round.done || !hasCases(round)) return;
    round.casesOn = !round.casesOn;
    if (round.casesOn) {
      round.casesShown = true;
      round.casesCount += 1;
    }
    frame.note('cases', { on: round.casesOn });
    draw();
    frame.keep();
  }

  /** "불가능해요". 되는 판이면 틀렸다고 하지 않고 되는 방법이 있다는 사실만 말한다. 판은 그대로 이어진다 */
  function sayImpossible() {
    const { round, solution } = frame;
    if (!round || round.done || !hasImpossible(round)) return;
    const correct = solution.possible === false;
    const guess = correct ? null : 'impossible-on-possible';
    round.answers.push({ t: frame.stamp(), answer: 'impossible', correct, guess });
    frame.note('answer', { answer: 'impossible', correct, guess });
    if (correct) {
      pick = null;
      frame.finish('solved');
      return;
    }
    round.impossibleCount += 1;
    round.wrongCount += 1;
    flash = null;
    // 되는 방법이 있다는 말은 지금 모습에 기대지 않지만, 모습이 바뀌면 지금 정사각형의 수로 덮는다
    told = true;
    frame.persist();
    draw();
    frame.say(round.moveCount === 0 ? T.play['possible-press-untried'] : T.play['possible-press']);
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    const { board } = round;
    if (round.answers.at(-1)?.answer === 'impossible') {
      const tried = triedOf(round).size;
      return [tried > 0 ? fill(T.right['impossible-tried'], { k: tried }) : T.right['impossible-untried'], reasonLine(T.right, board)];
    }
    const parts = [fill(T.right[`done-${board.kind}`], { k: board.k, n: board.n })];
    if (board.tidy) parts.push(T.right.tidy);
    parts.push(solution.count === 1 ? T.right.one : fill(T.right.more, { n: solution.count }));
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
    if (!solution.possible) {
      // 성냥 하나만 빼는 판은 모든 경우의 남는 수를 판에 적어 보인다
      if (hasCases(round)) return [{ say: reasonLine(T.solution, board, 'none'), nodes: [rowOf([boardCard({ w: board.w, h: board.h, on: board.matches, kind: board.kind, cases: casesOf(round, true) }, T.solution['note-cases'], { big: true })])] }];
      return [{ say: T.solution.none, nodes: [rowOf([boardCard({ w: board.w, h: board.h, on: board.matches, kind: board.kind }, '', { big: true })])] }];
    }
    const [example] = solution.examples;
    const say = solution.count === 1 ? T.solution.one : fill(T.solution.more, { n: solution.count });
    const view = { w: board.w, h: board.h, on: example.matches, origin: board.matches, kind: board.kind };
    return [{ say, nodes: [rowOf([boardCard(view, T.solution[`note-${board.kind}`], { big: true })])] }];
  }

  /** "왜 그럴까?"의 그림 하나: 모두 채운 모눈에서 빠진 성냥을 빼고, 고른 크기의 정사각형에 테두리를 그린다 */
  function figureView(item) {
    const gone = new Set((item.gone ?? []).map((spot) => (spot.side === 'v' ? vEdge(item.w, item.h, spot.r, spot.c) : spot.r * item.w + spot.c)));
    const on = fullGrid(item.w, item.h).filter((edge) => !gone.has(edge));
    const outline = squaresIn(item.w, item.h, on).filter((square) => item.outline.includes(square.size));
    // 경우 표시: 성냥마다 그 성냥 하나만 뺐을 때 남는 정사각형 수
    const cases = item.cases === true ? oneOutCases(item.w, item.h, on) : null;
    return { w: item.w, h: item.h, on, origin: fullGrid(item.w, item.h), kind: 'remove', outline, cases };
  }

  /** "왜 그럴까?": 크기를 정해 놓고 세기 → 한 변이 2개, 3개인 것 → 크기마다 나누어 세기(이름) → 성냥 하나가 빠진 판
   *  → 2×2 판에서 하나만 빼는 12가지 → 3×2 판의 17가지와 모든 경우 따지기(이름) */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다
      get nodes() {
        // 그림이 하나뿐인 장은 크게 그린다
        return [rowOf(slide.figures.map((item) => boardCard(figureView(item), item.note, { big: slide.figures.length === 1 })))];
      },
    }));
  }

  // ---- 직접 만들기: 모눈의 변을 눌러 성냥을 놓거나 없애고, 할 일(빼기·옮기기, 몇 개, 정사각형 몇 개, 약속)을 정한다 ----
  // 처음 판: 다 채운 모눈에서 성냥 2개를 빼는 할 일. 정사각형의 수는 되는 방법이 있는 가장 큰 수로 둔다(3×3은 11개, 방법 4가지)
  const freshDraft = (size) => ({ size, on: fullGrid(size, size), kind: 'remove', k: 2, n: Math.max(...tally(size, size, fullGrid(size, size), 'remove', 2).all.keys()), tidy: false });

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const ok =
      saved &&
      Number.isInteger(saved.size) &&
      saved.size >= MAKE_MIN &&
      saved.size <= MAKE_MAX &&
      edgesOk(saved.size, saved.size, saved.on) &&
      ['remove', 'move'].includes(saved.kind) &&
      Number.isInteger(saved.k) &&
      saved.k >= 1 &&
      saved.k <= MAX_K[saved.kind] &&
      Number.isInteger(saved.n) &&
      saved.n >= 0 &&
      saved.n <= squaresOf(saved.size, saved.size).length &&
      typeof saved.tidy === 'boolean';
    return ok ? { size: saved.size, on: saved.on.slice(), kind: saved.kind, k: saved.k, n: saved.n, tidy: saved.tidy } : freshDraft(MAKE_FIRST);
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  /** 만들던 판을 판의 값으로 */
  const draftBoard = () => ({ w: draft.size, h: draft.size, matches: draft.on.slice(), kind: draft.kind, k: draft.k, n: draft.n, tidy: draft.tidy });

  function drawMake() {
    const { size } = draft;
    const most = squaresOf(size, size).length;
    $('matches-make-n').textContent = fill(T.make.size, { n: size });
    $('matches-make-fewer').disabled = size <= MAKE_MIN;
    $('matches-make-more').disabled = size >= MAKE_MAX;
    $('matches-make-full').disabled = draft.on.length === edgeCount(size, size);
    $('matches-make-clear').disabled = draft.on.length === 0;
    $('matches-make-remove').setAttribute('aria-pressed', String(draft.kind === 'remove'));
    $('matches-make-move').setAttribute('aria-pressed', String(draft.kind === 'move'));
    $('matches-make-k').textContent = fill(T.make.count, { k: draft.k });
    $('matches-make-k-less').disabled = draft.k <= 1;
    $('matches-make-k-more').disabled = draft.k >= MAX_K[draft.kind];
    $('matches-make-target').textContent = fill(T.make.count, { k: draft.n });
    $('matches-make-n-less').disabled = draft.n <= 0;
    $('matches-make-n-more').disabled = draft.n >= most;
    $('matches-make-tidy').setAttribute('aria-pressed', String(draft.tidy));
    $('matches-make-now').textContent = fill(T.make.now, { n: countSquares(size, size, draft.on), k: draft.on.length });
    drawBoard($('matches-make-board'), { w: size, h: size, on: draft.on, kind: 'make', onEdge: tapMadeEdge, labels: labelsFor(size, size) });
    $('matches-make-result').textContent = made ? made.line : '';
    $('matches-make-picture').replaceChildren(...(made?.node ? [made.node] : []));
  }

  function changeDraft(next) {
    draft = next;
    made = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  function tapMadeEdge(edge) {
    const on = new Set(draft.on);
    if (on.has(edge)) on.delete(edge);
    else on.add(edge);
    changeDraft({ ...draft, on: sorted(on) });
  }

  function resize(size) {
    if (size < MAKE_MIN || size > MAKE_MAX) return;
    changeDraft({ ...freshDraft(size), kind: draft.kind, k: draft.k, tidy: draft.tidy });
  }

  /** 할 일을 정할 수 없는 까닭(성냥이 없음, 뺄 성냥이나 빈 자리가 모자람). 없으면 null */
  function draftProblem() {
    const board = draftBoard();
    if (board.matches.length === 0) return T.make.empty;
    if (board.k > board.matches.length) return fill(T.make['few-matches'], { n: board.matches.length, k: board.k });
    const slots = edgeCount(board.w, board.h) - board.matches.length;
    if (board.kind === 'move' && board.k > slots) return fill(T.make['few-slots'], { n: slots, k: board.k });
    return checkBoard(board) === null ? null : T.make.empty;
  }

  /** 다 만든 판: 할 일대로 되는 방법이 하나라도 있는 판(해 보기와 공책에 남기기에 쓴다). 아니면 null */
  function madeBoard() {
    if (!draft || draftProblem() !== null) return null;
    const board = draftBoard();
    return solutionOf(board).possible ? board : null;
  }

  /** 아이가 만든 판을 풀이 프로그램으로 모두 해 보고 알려 준다. 되는 방법이 있으면 한 가지를 그려 보인다 */
  function solveDraft() {
    const problem = draftProblem();
    if (problem !== null) {
      made = { line: problem, node: null };
      drawMake();
      frame.talkers.make.say(problem);
      return;
    }
    const board = draftBoard();
    const result = solutionOf(board);
    let line;
    if (result.count === 0) line = fill(T.make.none, { total: result.ways });
    else if (result.count === 1) line = fill(T.make.one, { total: result.ways });
    else line = fill(T.make.many, { total: result.ways, n: result.count });
    const example = result.examples[0];
    made = { line, node: example ? boardCard({ w: board.w, h: board.h, on: example.matches, origin: board.matches, kind: board.kind }, T.make.other) : null };
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
      solution: { possible: result.possible, count: result.count, ways: result.ways },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  function playDraft() {
    const board = madeBoard();
    if (!board) {
      frame.talkers.make.say(draftProblem() ?? T.make['keep-not-yet']);
      return;
    }
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  /** 할 일을 바꾼다(빼기와 옮기기는 k의 위 끝이 다르다) */
  function setKind(kind) {
    changeDraft({ ...draft, kind, k: Math.min(draft.k, MAX_K[kind]) });
  }

  // ---- 단추 잇기 ----
  $('matches-outline').addEventListener('click', toggleOutline);
  $('matches-cases').addEventListener('click', toggleCases);
  $('matches-impossible').addEventListener('click', sayImpossible);
  $('matches-make-fewer').addEventListener('click', () => resize(draft.size - 1));
  $('matches-make-more').addEventListener('click', () => resize(draft.size + 1));
  $('matches-make-full').addEventListener('click', () => changeDraft({ ...draft, on: fullGrid(draft.size, draft.size) }));
  $('matches-make-clear').addEventListener('click', () => changeDraft({ ...draft, on: [] }));
  $('matches-make-remove').addEventListener('click', () => setKind('remove'));
  $('matches-make-move').addEventListener('click', () => setKind('move'));
  $('matches-make-k-less').addEventListener('click', () => changeDraft({ ...draft, k: Math.max(1, draft.k - 1) }));
  $('matches-make-k-more').addEventListener('click', () => changeDraft({ ...draft, k: Math.min(MAX_K[draft.kind], draft.k + 1) }));
  $('matches-make-n-less').addEventListener('click', () => changeDraft({ ...draft, n: Math.max(0, draft.n - 1) }));
  $('matches-make-n-more').addEventListener('click', () => changeDraft({ ...draft, n: Math.min(squaresOf(draft.size, draft.size).length, draft.n + 1) }));
  $('matches-make-tidy').addEventListener('click', () => changeDraft({ ...draft, tidy: !draft.tidy }));
  $('matches-make-solve').addEventListener('click', solveDraft);
  $('matches-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    const start = copyBoard(board);
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: start, // 판: 모눈, 처음 성냥, 할 일
      on: start.matches.slice(), // 지금 놓인 성냥(변 번호)
      moves: [], // 무르기에 쓰는 차례: 그 전의 놓인 모습
      tries: [], // 빼거나 옮긴 성냥이 k개가 된 모습 가운데 할 일과 다른 것(같은 모습은 한 번)
      outlineOn: false, // 지금 "정사각형 모두 보기"를 켜 두었는가
      outlineShown: false, // 한 번이라도 켰는가
      outlineCount: 0, // 켠 수
      casesOn: false, // 지금 "모든 경우 펼쳐 보기"를 켜 두었는가
      casesShown: false, // 한 번이라도 켰는가
      casesCount: 0, // 켠 수
      impossibleCount: 0, // 되는 판에 "불가능해요"를 누른 수
      moveCount: 0, // 성냥을 빼거나 돌려놓거나 옮긴 수
      takeCount: 0, // 그 가운데 뺀 것
      backCount: 0, // 그 가운데 뺀 자리에 돌려놓은 것
      shiftCount: 0, // 그 가운데 옮긴 것
      limitCount: 0, // 이미 k개를 빼거나 옮겨서 하지 않은 누름의 수
      fullCount: 0, // 빼거나 옮긴 성냥이 k개인데 할 일과 다르던 수
      undoCount: 0,
      resetCount: 0,
      wrongCount: 0, // 사실과 다른 답의 수(k개를 빼거나 옮겼는데 할 일과 다르던 것, 되는 판에 누른 "불가능해요")
    };
  }

  return {
    id: FORMAT,
    T,
    padId: 'matches-pad',
    makeId: 'make-matches',
    // 판이 정사각형에 가까워 위아래로 크다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다
    ruleAside: true,
    homeIds: { sample: 'home-matches-sample', blank: 'home-matches-blank', ask: 'home-matches-ask', play: 'home-matches-play', pick: 'home-matches-pick', make: 'home-matches-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      if (!edgesFit(saved.board, saved.on) || !Array.isArray(saved.moves) || !saved.moves.every((on) => edgesFit(saved.board, on))) return false;
      if (!Array.isArray(saved.tries) || !saved.tries.every((item) => typeof item === 'string')) return false;
      if (typeof saved.outlineOn !== 'boolean' || typeof saved.outlineShown !== 'boolean') return false;
      if (typeof saved.casesOn !== 'boolean' || typeof saved.casesShown !== 'boolean') return false;
      return [saved.casesCount, saved.impossibleCount, saved.outlineCount, saved.moveCount, saved.takeCount, saved.backCount, saved.shiftCount, saved.limitCount, saved.fullCount, saved.undoCount, saved.resetCount, saved.wrongCount].every(count);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('matches-board').hidden = !on;
      $('matches-count').hidden = !on;
      $('matches-outline').hidden = !on;
      // "모든 경우 펼쳐 보기"는 그 도구가 있는 판에서만 draw가 보인다
      if (!on) $('matches-cases').hidden = true;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      pick = null;
      flash = null;
      told = false;
    },
    draw,
    ended() {
      pick = null;
      flash = null;
      told = false;
    },
    ruleLine: (round) => fill(T.rules[ruleKey(round.board)], { k: round.board.k, n: round.board.n }),
    hints: (round) => T.hints[hintKey(round.board)],
    touched: (round) => round.moveCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view: (round) => ({ on: round.on.slice(), changed: changedCount(round.board, round.on), squares: countSquares(round.board.w, round.board.h, round.on), tries: round.tries.length, outline: round.outlineOn, cases: round.casesOn }),
    /** 이 판보다 작은 판: 같은 할 일의 더 작은 모눈 */
    smaller: (round, turn) => smallerMatches({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, count: solution.count, ways: solution.ways },
        // 질문 힌트와 "정사각형 모두 보기", "모든 경우 펼쳐 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.outlineShown ? 1 : 0) + (round.casesShown ? 1 : 0),
        outlineShown: round.outlineShown,
        outlineCount: round.outlineCount,
        casesShown: round.casesShown,
        casesCount: round.casesCount,
        impossibleCount: round.impossibleCount,
        // 판을 떠날 때 놓인 성냥, 할 일과 달랐던 모습들
        on: round.on,
        tries: round.tries,
        moveCount: round.moveCount,
        takeCount: round.takeCount,
        backCount: round.backCount,
        shiftCount: round.shiftCount,
        limitCount: round.limitCount,
        fullCount: round.fullCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        // 수준 맞추기가 보는 "틀린 답"의 수
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    /** 글자판: 판의 변은 저마다 Enter와 빈칸 글쇠로 누른다(판이 맡는다). Escape는 고른 성냥을 놓는다 */
    onKey(event) {
      if ($('matches-pad').hidden || pick === null || event.key !== 'Escape') return;
      pick = null;
      draw();
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawMini(root, { w: board.w, h: board.h, on: board.matches, kind: board.kind });
    },
    drawBlank(root) {
      drawMini(root, { w: 2, h: 2, on: [], kind: 'make' });
    },
    /** 하던 판과 공책의 그림: 지금 놓인 성냥과 처음 자리 */
    drawResume(root, saved) {
      const on = edgesFit(saved.board, saved.on) ? saved.on : saved.board.matches;
      drawMini(root, { w: saved.board.w, h: saved.board.h, on, origin: saved.board.matches, kind: saved.board.kind });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawMini(root, { w: 2, h: 2, on: [], kind: 'make' });
        return;
      }
      const { board } = generateBoard(entry.level, entry.picture.seed);
      drawMini(root, { w: board.w, h: board.h, on: board.matches, kind: board.kind });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
