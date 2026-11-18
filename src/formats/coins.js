// 동전 뒤집기: 판 화면에서 이 형식이 맡는 부분(동전 판, 숫자판, 맞혔을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/coins.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
import T from '../content/coins.json';
import { MAX_COINS, RULES, applyMove, checkBoard, diagnose, headCount, isMove, selectable, solve } from '../core/coins.js';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/ladder.js';
import { smallerCoins } from '../core/smaller.js';
import { fill } from '../core/text.js';
import { drawCoins, drawStrip } from '../ui/coin-board.js';

const FORMAT = 'coins';
const MIN_MAKE_COINS = 3;
const MAX_ANSWER_DIGITS = 2;

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createCoins(frame) {
  const { $, log } = frame;
  let selected = []; // 고른 동전
  let typed = ''; // 숫자판에 넣은 글자
  let draft = null; // 직접 만들기에서 만들던 판

  const ruleKey = (board) => (board.rule === 'adj3' ? `adj3-${board.shape}` : board.rule);
  const coinLabel = (index, heads) => fill(T.coinLabel, { no: index + 1, face: heads ? T.faces.heads : T.faces.tails });
  const toCoins = (text) => [...text].map((ch) => (ch === '1' ? 1 : 0));
  const blankFaces = { heads: T.blank, tails: T.blank };

  // ---- 판 ----
  function drawBoard(flipped = []) {
    const { round } = frame;
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
    frame.showWhy();
  }

  function tapCoin(index) {
    const { round } = frame;
    if (round.done) return;
    if (selected.includes(index)) selected = selected.filter((item) => item !== index);
    else if (selectable(round.board, selected).includes(index)) selected = [...selected, index];
    if (selected.length === RULES[round.board.rule].count && isMove(round.board, selected)) {
      const move = selected.slice().sort((a, b) => a - b);
      selected = [];
      round.coins = applyMove(round.coins, move);
      round.trail.push(move);
      round.flipCount += 1;
      frame.note('flip', { coins: move });
      drawBoard(move);
      frame.persist();
      return;
    }
    drawBoard();
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    const move = round.trail.pop();
    round.coins = applyMove(round.coins, move);
    round.undoCount += 1;
    selected = [];
    frame.note('undo');
    drawBoard(move);
    frame.persist();
  }

  function reset() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    round.coins = round.board.coins.slice();
    round.trail = [];
    round.resetCount += 1;
    selected = [];
    frame.note('reset');
    drawBoard();
    frame.persist();
  }

  // ---- 답 넣기 ----
  function drawPad() {
    $('answer-box').textContent = typed;
    $('submit').disabled = typed === '';
  }

  function pressKey(key) {
    if (frame.round.done || $('pad').hidden) return;
    if (key === 'erase') typed = typed.slice(0, -1);
    else if (typed.length < MAX_ANSWER_DIGITS) typed = typed === '0' ? key : typed + key;
    drawPad();
  }

  function submit(answer) {
    const { round } = frame;
    if (round.done) return;
    const result = diagnose(frame.solution, answer);
    const entry = { t: frame.stamp(), answer: answer.kind === 'number' ? answer.value : 'impossible', correct: result.correct, guess: result.guess };
    round.answers.push(entry);
    frame.note('answer', { answer: entry.answer, correct: entry.correct, guess: entry.guess });
    typed = '';
    drawPad();
    if (result.correct) {
      frame.finish('solved');
      return;
    }
    // 틀린 답: 무엇을 놓쳤을지 짐작해서 말한다. 깎이는 것도, 채점 표시도 없다. 다시 해 볼 수 있다.
    frame.persist();
    drawBoard();
    frame.say(fill(T.guess[result.guess], { k: entry.answer }));
  }

  /** 맞혔을 때 하는 말: 무엇을 했는지 그대로 말한다. */
  function rightLine(round, solution) {
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

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function whyPages(round) {
    const slides = T.why[ruleKey(round.board)];
    if (!slides) return null;
    return slides.map((slide) => ({
      say: slide.say,
      nodes: slide.strips.map((strip) => drawStrip({ ...strip, steps: strip.steps.map(toCoins) }, T.faces)),
    }));
  }

  function solutionPages(round, solution) {
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
    return [{ say, nodes: [drawStrip(strip, T.faces)] }];
  }

  // ---- 직접 만들기 ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    if (saved && checkBoard(saved) === null && saved.n >= MIN_MAKE_COINS) return { n: saved.n, shape: saved.shape, rule: saved.rule, coins: saved.coins.slice() };
    return { n: 6, shape: 'line', rule: 'any2', coins: [1, 1, 1, 1, 1, 1] };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    drawMake();
    frame.talkers.make.say(T.make.intro);
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
    log.saveDraft(draft, FORMAT);
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
    frame.talkers.make.say(line);
  }

  function playDraft() {
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board: draft });
  }

  // ---- 단추 잇기 ----
  $('keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.key;
    if (key) pressKey(key);
  });
  $('submit').addEventListener('click', () => {
    if (typed !== '') submit({ kind: 'number', value: Number(typed) });
  });
  $('impossible').addEventListener('click', () => submit({ kind: 'impossible' }));
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

  return {
    id: FORMAT,
    T,
    padId: 'pad',
    makeId: 'make-coins',
    homeIds: { sample: 'home-sample', blank: 'home-blank', ask: null, play: 'home-play', pick: 'home-pick', make: 'home-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    /** 새 판에서 이 형식이 맡는 값 */
    begin({ board }) {
      return {
        board: { n: board.n, shape: board.shape, rule: board.rule, coins: board.coins.slice() }, // 처음 모습
        coins: board.coins.slice(), // 지금 모습
        trail: [], // 처음 모습에서 지금까지의 뒤집기. 길이가 "뒤집은 횟수"다
        flipCount: 0,
        undoCount: 0,
        resetCount: 0,
      };
    },
    solve: (round) => solve(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      return (
        checkBoard(saved.board) === null &&
        checkBoard({ ...saved.board, coins: saved.coins }) === null &&
        Array.isArray(saved.trail) &&
        saved.trail.every((move) => Array.isArray(move) && isMove(saved.board, move))
      );
    },
    /** 판 화면에서 이 형식의 것(동전 판, 뒤집은 횟수)을 보이거나 감춘다 */
    showParts(on) {
      $('board').hidden = !on;
      $('coins-count').hidden = !on;
    },
    enter() {
      selected = [];
      typed = '';
    },
    draw() {
      drawBoard();
      drawPad();
    },
    ended() {
      selected = [];
    },
    ruleLine: (round) => T.rules[ruleKey(round.board)],
    hints: (round) => T.hints[ruleKey(round.board)],
    touched: (round) => round.flipCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view: (round) => ({ coins: round.coins.join(''), flips: round.trail.length }),
    /** 이 판보다 작은 판: 같은 뒤집는 규칙과 모양, 동전을 둘 줄인 판 */
    smaller: (round, turn) => smallerCoins({ board: round.board }, turn),
    record(round, solution) {
      return {
        board: { n: round.board.n, shape: round.board.shape, rule: round.board.rule, coins: round.board.coins.join('') },
        solution: { possible: solution.possible, min: solution.min },
        flipCount: round.flipCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    /** 글자판이 있는 기기에서는 숫자를 쳐서 답할 수도 있다. */
    onKey(event) {
      if ($('pad').hidden) return;
      if (/^[0-9]$/.test(event.key)) pressKey(event.key);
      else if (event.key === 'Backspace') pressKey('erase');
      else if (event.key === 'Enter' && typed !== '') submit({ kind: 'number', value: Number(typed) });
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: () => null,
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawCoins(root, { coins: board.coins, shape: board.shape, faces: T.faces });
    },
    drawBlank(root) {
      const blank = T.levels.find((entry) => entry.picture.blank).picture;
      drawCoins(root, { coins: toCoins(blank.coins), faces: blankFaces });
    },
    drawResume(root, saved) {
      drawCoins(root, { coins: saved.coins, shape: saved.board.shape, faces: T.faces, small: true });
    },
    /** 판 고르기의 그림: 테두리가 있는 동전들이 한 번에 함께 뒤집히는 동전이다. */
    drawLevelPicture(root, entry) {
      drawCoins(root, {
        coins: toCoins(entry.picture.coins),
        shape: entry.picture.shape ?? 'line',
        faces: entry.picture.blank ? blankFaces : T.faces,
        mark: entry.picture.mark ?? [],
        small: true,
      });
    },
    showMake,
  };
}
