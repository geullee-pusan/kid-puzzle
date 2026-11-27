// 도미노 가로세로 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 판과 수와 주장이 풀이 프로그램과 맞는지 본다.
// 이기고 진 횟수를 세어 보여 주지 않는다, 끝났을 때는 누가 이겼는지를 사실로만 말한다, 힌트는 두 높이,
// "왜 그럴까?"는 알아챈 이야기, 화면을 그리는 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, rungOf } from '../src/core/domino-ladder.js';
import { replay, safeOf, solve } from '../src/core/domino.js';
import { TUNING, recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { smallerDomino } from '../src/core/smaller.js';
import { fill, ordinal, sentenceCount } from '../src/core/text.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/domino.json'));
const html = read('index.html');
const code = read('src/formats/domino.js');

const VALUES = { k: 3, n: 2, no: '첫 ', face: '세로' };

/** 대본의 모든 글(값)을 길과 함께 모은다. 설명(_로 시작하는 것)과 그림의 값(판, 둔 수, 먼저 두는 쪽, 꼴)은 뺀다. */
function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_') && !['board', 'trail', 'first', 'winner', 'kind', 'kept', 'counts', 'safe'].includes(key))
      .flatMap(([key, item]) => allStrings(item, path ? `${path}.${key}` : key));
  }
  return [];
}
const strings = allStrings(T);

/** index.html에서 화면에 보이는 글만 뽑는다(꼬리표, 주석, 스크립트를 뺀다). aria-label도 읽어 주는 글이라 넣는다. */
function visibleText(source) {
  const labels = [...source.matchAll(/aria-label="([^"]*)"/g)].map((match) => match[1]);
  const body = source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return [...labels, body].join(' ');
}
/** from이 든 꼬리표의 처음(<)부터 to가 든 꼬리표의 앞까지 */
const part = (from, to) => {
  const at = html.lastIndexOf('<', html.indexOf(from));
  return html.slice(at, html.lastIndexOf('<', html.indexOf(to, html.indexOf(from))));
};
const own = [part('id="domino-title"', 'id="pieces-title"'), part('id="domino-safe"', 'id="pieces-sort"'), part('id="domino-count"', 'id="fold-count"'), part('id="domino-pad"', 'id="fold-pad"'), part('id="domino-swap"', '</section>'), part('id="make-domino"', 'id="make-pieces"')]
  .map(visibleText)
  .join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const figures = T.why.flatMap((slide) => slide.figures);
const trailOf = (item) => item.trail.map((cells) => ({ cells }));

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '도미노 가로세로');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['세로가 되어 두기', '나만 놓을 수 있는 자리', '고르고 두기', '방이 나뉜 판', '큰 판', '직접 만들기']);
  assert.deepEqual(T.sides, { vert: '세로', horz: '가로' });
});

test('규칙 설명은 세 문장 안이고, 두 방향·겹치지 않기·지는 때를 다 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules), ['game']);
  assert.equal(sentenceCount(T.rules.game), 3);
  assert.match(T.rules.game, /^세로 쪽은 도미노를 세로로만, 가로 쪽은 가로로만 놓아요\./);
  assert.match(T.rules.game, /겹칠 수 없어요\./);
  assert.match(T.rules.game, /자기 차례에 놓을 곳이 없는 쪽이 져요\.$/);
  assert.match(code, /ruleLine: \(\) => T\.rules\.game,/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 53);
  assert.ok(sentenceCount(guides[22]) <= 3, guides[22]);
  assert.match(guides[22], /^가로와 세로의 칸 수를 정하고, 칸을 누르면 구멍이 뚫리거나 메워져요\./);
  assert.match(guides[22], /나중에 두는 쪽이 이기는 판도 만들 수 있을까요\?$/);
});

test('이 형식의 답: 고르는 판은 쪽을 고른 뒤 먼저 둘지 고른다. 1, 2단계는 단계가 자리를 정한다', () => {
  const choose = part('id="domino-choose"', 'id="domino-role"');
  assert.match(choose, /<h2>어느 쪽이 될까요\?<\/h2>/);
  assert.match(choose, /id="domino-vert"[^>]*>세로가 될래요</);
  assert.match(choose, /id="domino-horz"[^>]*>가로가 될래요</);
  const order = part('id="domino-order"', 'id="domino-order-line"');
  assert.match(order, /<h2>먼저 둘까요\?<\/h2>/);
  assert.match(order, /id="domino-first"[^>]*>먼저 둘래요</);
  assert.match(order, /id="domino-second"[^>]*>나중에 둘래요</);
  assert.equal(T.roles.vert, '나는 세로, 선생님은 가로예요');
  assert.equal(T.orders.second, '선생님이 먼저 둬요');
  // 고른 것이 이기는 자리였는지는 기록에만 남고 화면에 알리지 않는다.
  assert.match(code, /const correct = seatWins\(solution, round\.role, order\);/);
  assert.match(code, /answer: `\$\{round\.role\}-\$\{order\}`/);
  // 자리를 바꾸면 쪽도 차례도 바꾼다(선생님이 서 있던 자리).
  assert.match(code, /const next = \{ role: otherSide\(round\.role\), order: round\.order === 'first' \? 'second' : 'first', rematchOf: round\.id \};/);
  assert.equal(fill(T.play['rematch-first'], { face: T.sides.horz }), '아까와 같은 판이에요. 이번에는 가로가 되어 먼저 두어 보세요.');
});

test('판이 끝나면 누가 놓을 곳이 없었고 누가 이겼는지를 사실로 말한다. 축하하거나 깎아내리지 않고, 몇 번 이기고 졌는지 세지 않는다', () => {
  for (const key of ['vert-kid', 'vert-teacher', 'horz-kid', 'horz-teacher']) {
    const text = T.right[key];
    assert.match(text, key.startsWith('vert') ? /^가로가 놓을 곳이 없어요\./ : /^세로가 놓을 곳이 없어요\./, key);
    assert.doesNotMatch(text, /잘했|훌륭|대단|멋져|아쉽|틀렸|실패/, key);
  }
  const all = [...strings.map(([, text]) => text), own].join(' ');
  assert.doesNotMatch(all, /\d+번 이겼|\d+번 졌|이긴 횟수|진 횟수|몇 번째 판/);
  assert.match(code, /else if \(round\.winner === 'teacher' && lostStreak\(records\) >= SWAP_INVITE_AFTER\) parts\.push\(T\.right\['swap-invite'\]\);/);
  assert.equal(fill(T.right.spare, { face: '세로', n: 2 }), '끝날 때 세로만 놓을 수 있는 자리가 2곳 남아 있었어요.');
  // 판 아래의 수는 놓은 도미노와 남은 빈칸뿐이다.
  assert.equal([...part('id="domino-count"', 'id="fold-count"').matchAll(/<strong/g)].length, 2);
});

test('도미노를 놓는 법: 이어진 두 칸을 끌거나 차례로 누른다. 아이의 방향이 아니면 놓이지 않고 그 사실을 적는다', () => {
  assert.match(T.howto.vert, /위아래로 이어진 빈칸 두 개를 끌거나 차례로 누르면/);
  assert.match(T.howto.horz, /옆으로 이어진 빈칸 두 개를/);
  assert.equal(T.status['wrong-vert'], '위아래로 이어진 두 칸에만 놓아요');
  assert.match(code, /flash = T\.status\[`wrong-\$\{round\.role\}`\];/);
  assert.equal(fill(T.cellLabel, { no: ordinal(1), n: ordinal(3) }), '위에서 첫 번째 줄, 왼쪽에서 3번째 칸');
  // 판은 pointer 이벤트로 끌기와 누르기를 받는다.
  const board = read('src/ui/domino-board.js');
  assert.match(board, /addEventListener\('pointerdown'/);
  assert.match(board, /addEventListener\('pointermove'/);
  assert.match(board, /view\.onPair\?\.\(press\.path\.slice\(\)\)/);
});

test('힌트는 단계마다 두 개이고, 하나하나가 질문 한 문장이다. 아껴 둔다는 말은 힌트에 없다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['choose', 'rooms', 'safe', 'vert']);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /요\?$/, hint);
      assert.doesNotMatch(hint, /아껴|아끼|나중에 놓/);
    }
  }
  const shared = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '더 작은 판이라면 누가 이길까요?'];
  for (const [key, list] of Object.entries(T.hints)) assert.ok(shared.includes(list[0]), `${key}: ${list[0]}`);
  for (const rung of LADDER) assert.ok(T.hints[rung.hint], rung.level);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.names.board, { k: 5, n: 3 }), '가로 5칸, 세로 3칸');
  assert.equal(fill(T.safe.count, { face: '가로', n: 2 }), '가로만 2곳');
  assert.equal(fill(T.replay.teacher, { no: ordinal(2) }), '2번째 수예요. 선생님이 도미노를 놓았어요.');
});

test('화면 글에 영어 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속|잘했|틀렸/);
  const spoken = [
    ...Object.values(T.home.ask),
    T.home.pick,
    T.rules.game,
    ...Object.values(T.howto),
    ...Object.values(T.play),
    ...Object.values(T.hints).flat(),
    ...Object.values(T.right),
    T.solution.first,
    T.solution.second,
    T.solution.vert,
    T.solution.horz,
    T.solution.opening,
    T.make.intro,
    ...Object.values(T.make.starts),
    T.make.nomove,
    T.make['keep-not-yet'],
    ...Object.entries(T.replay)
      .filter(([key]) => key !== 'title' && !key.startsWith('note-'))
      .map(([, text]) => text),
    ...T.why.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of [...Object.values(T.status), ...Object.values(T.turn), ...Object.values(T.roles), ...Object.values(T.orders)]) assert.match(text, /요$/, text);
  for (const item of figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('생각의 이름("아껴 둔 수")은 "왜 그럴까?"에서만, 그림을 두 장 본 뒤에 처음 말한다', () => {
  const name = /아껴 둔 수/;
  const outside = strings.filter(([path]) => !path.startsWith('why')).map(([, text]) => text);
  for (const text of outside) assert.doesNotMatch(text, name);
  assert.doesNotMatch(visibleText(html), name);
  assert.doesNotMatch(T.why[0].say + T.why[1].say, name);
  assert.match(T.why[2].say, name);
});

test('"왜 그럴까?"는 그림 네 장의 알아챈 이야기다. 그림 속의 판과 수와 주장은 풀이 프로그램이 따진 것과 같다', () => {
  assert.equal(T.why.length, 4);
  assert.match(T.why[0].say, /^선생님이 세로가 되어 이 판에서 먼저 두다가 졌어요\./);
  for (const item of figures) {
    const now = replay(item.board, trailOf(item), item.first);
    assert.equal(now.ok, true, item.note);
    if (item.winner) assert.equal(now.winner, item.winner, item.note);
    if (item.counts) {
      const spots = safeOf(item.board, trailOf(item), item.first);
      assert.deepEqual({ vert: spots.vert.length, horz: spots.horz.length }, item.counts, item.note);
    }
    if (item.kind) assert.equal(solve(item.board).kind, item.kind, item.note);
  }
  // 첫 장: 첫 도미노는 세로만 놓을 수 있는 자리였고, 가로가 방에 놓자 세로는 놓을 곳이 없다.
  const [saved, lost] = T.why[0].figures;
  assert.deepEqual(safeOf(saved.board, [], 'vert').vert, [saved.trail[0]]);
  assert.equal(replay(lost.board, trailOf(lost), 'vert').loser, 'vert');
  // 그 판은 세로가 먼저 두면 세로가 이기는 판이다(첫 수가 문제였다).
  assert.equal(solve(saved.board).vert, 'vert');
  // 둘째 장: 방에 먼저 놓으면 가로는 바로 놓을 곳이 없고, 세로만 놓을 수 있는 자리는 그대로 남아 있다.
  const won = T.why[1].figures[0];
  const after = replay(won.board, trailOf(won), 'vert');
  assert.equal(after.loser, 'horz');
  assert.ok(won.kept.every((cell) => ((after.filled >>> cell) & 1) === 0));
  assert.ok(safeOf(won.board, trailOf(won), 'vert').vert.some((spot) => spot.join() === won.kept.join()));
  // 넷째 장: 남은 것이 한쪽만 놓을 수 있는 자리뿐인 판에서는 그 수를 세면 이기는 쪽이 보인다(셋 대 둘이면 누가 먼저 두어도 세로).
  const count = T.why[3].figures[0];
  const spots = safeOf(count.board, [], 'vert');
  const used = new Set([...spots.vert.flat(), ...spots.horz.flat()]);
  const free = Array.from({ length: count.board.w * count.board.h }, (_, cell) => cell).filter((cell) => !count.board.holes.includes(cell));
  assert.deepEqual(free.filter((cell) => !used.has(cell)), [], '빈칸은 모두 한쪽만 놓을 수 있는 자리다');
  assert.deepEqual([solve(count.board).vert, solve(count.board).horz], ['vert', 'vert']);
  // 게임을 두 판 끝까지 둔 뒤에 열린다(src/core/domino.js의 whyOpen).
  assert.match(code, /if \(!whyOpen\(frame\.records\(\)\)\) return null;/);
});

test('판 고르기의 그림: 단계마다 그 단계에 나오는 판이고, 그림 속의 수는 둘 수 있는 수다', () => {
  for (const entry of T.levels) {
    const rung = rungOf(entry.level);
    if (rung.mode === 'make') {
      assert.equal(entry.picture.blank, true);
      continue;
    }
    const now = replay(entry.picture.board, trailOf(entry.picture), entry.picture.first);
    assert.equal(now.ok, true, entry.name);
    const listed = [...rung.boards, rung.small, rung.first].filter(Boolean).some(([w, h, holes]) => w === entry.picture.board.w && h === entry.picture.board.h && holes.join() === entry.picture.board.holes.join());
    assert.ok(listed, entry.name);
  }
});

test('"더 작은 판으로": 사다리의 판마다 잘 두면 이기는 꼴이 같은 작은 판을 낸다(없으면 내지 않는다)', () => {
  let none = 0;
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (let seed = 1; seed <= 12; seed++) {
      const { board } = generateBoard(level, seed);
      const small = smallerDomino({ mode: 'game', board }, 0);
      if (!small) {
        none += 1;
        continue;
      }
      assert.ok(small.board.w * small.board.h - small.board.holes.length < board.w * board.h - board.holes.length);
      assert.equal(solve(small.board).kind, solve(board).kind);
      assert.deepEqual(smallerDomino({ board }, 0), small, '같은 판, 같은 차례에는 같은 작은 판');
    }
  }
  assert.ok(none < 20, `작은 판이 없는 판 ${none}개`);
  assert.ok(smallerDomino({ board: { w: 5, h: 5, holes: [] } }, 0));
  assert.equal(smallerDomino({ board: null }), null);
  assert.equal(smallerDomino({ board: { w: 2, h: 2, holes: [] } }, 0), null);
});

test('직접 만들기: 가로·세로를 정하고 칸을 눌러 구멍을 뚫으면, 누가 먼저 두면 누가 이기는지 알려 준다', () => {
  const make = part('id="make-domino"', 'id="make-pieces"');
  for (const id of ['domino-make-w-fewer', 'domino-make-w-more', 'domino-make-h-fewer', 'domino-make-h-more', 'domino-make-holes', 'domino-make-clear', 'domino-make-board', 'domino-make-solve', 'domino-make-result', 'domino-make-play']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="domino-make-solve"[^>]*>선생님, 누가 이길까요\?</);
  assert.match(make, /id="domino-make-clear"[^>]*>구멍 모두 메우기</);
  assert.deepEqual(Object.keys(T.make.starts).sort(), ['horz-horz', 'horz-vert', 'vert-horz', 'vert-vert']);
  assert.match(code, /const result = solve\(board\);/);
  assert.match(code, /\n {4}madeBoard,\n/);
  // 두 쪽 모두 처음에 놓을 곳이 있어야 두어 보고 공책에 남길 수 있다.
  assert.match(code, /return playable\(board\) \? board : null;/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 도구, 답하는 칸, 끝난 뒤의 단추, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-domino-sample', 'home-domino-ask', 'home-domino-play', 'home-domino-pick', 'home-domino-make', 'home-domino-blank', 'domino-board', 'domino-count', 'domino-status', 'domino-placed', 'domino-empty', 'domino-safe', 'domino-safe-counts', 'domino-pad', 'domino-turn-box', 'domino-turn', 'domino-howto', 'domino-swap', 'domino-replay', 'make-domino']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="domino-title"', '</section>'), /<h2 id="domino-title">도미노 가로세로<\/h2>/);
  assert.ok(visibleText(part('id="domino-title"', '</section>')).includes(T.home.ask.vert));
  // 카드는 접히는 모양 가리기 다음, 퍼즐 만들기 앞이다.
  assert.ok(html.indexOf('id="fold-title"') < html.indexOf('id="domino-title"'));
  assert.ok(html.indexOf('id="domino-title"') < html.indexOf('id="make-title"'));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-domino-make" class="menu-item"/);
  assert.match(part('id="after"', '</section>'), /id="domino-swap"[^>]*hidden>자리를 바꿔서 다시 두기</);
  assert.match(part('id="after"', '</section>'), /id="domino-replay"[^>]*hidden>방금 판 다시 보기</);
  assert.match(code, /\$\(lost \? 'after-same' : 'after-make'\)\.before\(\$\('domino-swap'\), \$\('domino-replay'\)\);/);
  assert.match(html, /id="domino-safe"[^>]*aria-pressed="false" hidden>한쪽만 놓을 수 있는 자리 보기</);
  // 도구를 켜 본 판은 힌트 하나를 연 것으로 센다.
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.safeShown \? 1 : 0\),/);
  assert.match(read('src/main.js'), /fold: createFold\(frame\), domino: createDomino\(frame\), /);
  assert.match(read('src/check-main.js'), /\['domino', '도미노 가로세로'\]/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 게임이라 가장 좋은 기록은 없다.
  assert.doesNotMatch(code, /bestOf/);
});

/** 끝까지 둔 게임의 기록 하나 */
function played(more = {}) {
  return {
    kind: 'round',
    id: `r-${Math.random()}`,
    format: 'domino',
    level: 3,
    seed: 2,
    custom: false,
    mode: 'game',
    outcome: 'solved',
    hintsOpened: 0,
    answers: [{ t: 3, answer: 'vert-first', correct: true, guess: null }],
    role: 'vert',
    order: 'first',
    chose: true,
    assigned: false,
    choseWinner: true,
    winner: 'kid',
    rematch: false,
    moveCount: 4,
    seconds: 80,
    ...more,
  };
}

test('도미노 가로세로의 수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다', () => {
  const tuning = tuningFor('domino');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.fastWin, true);
  assert.equal(tuning.whyAfter, 'finished');
  assert.ok(TUNING.formats.domino);
  assert.match(read('src/core/level.js'), /도미노 가로세로\(모두 임시\)/);
  assert.deepEqual(recommend([], 'domino'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
});

test('"한 번에 빠르게": 이기는 자리에 서서(골랐거나 단계가 정해 준 자리) 이긴 판이다. 진 판, 도구를 쓴 판, 자리를 바꾼 판은 아니다', () => {
  assert.equal(recommend([played(), played()], 'domino').offerHarder, true);
  const assigned = (more = {}) => played({ level: 1, chose: false, assigned: true, ...more });
  assert.deepEqual(recommend([assigned(), assigned()], 'domino'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([played(), played({ winner: 'teacher' })], 'domino').offerHarder, false);
  assert.equal(recommend([played(), played({ choseWinner: false })], 'domino').offerHarder, false);
  assert.equal(recommend([played(), played({ chose: false, rematch: true })], 'domino').offerHarder, false);
  assert.equal(recommend([played(), played({ hintsOpened: 1 })], 'domino').offerHarder, false);
  // 끝까지 두고 진 게임은 그만둔 판이 아니라서 내려가지 않는다.
  assert.equal(recommend([played({ winner: 'teacher' }), played({ winner: 'teacher' })], 'domino').level, 3);
});

test('틀의 "왜 그럴까?" 문: 이 형식의 판을 한 번 끝까지 하면 막지 않는다(게임을 두 판 둔 뒤에 여는 것은 이 형식이 본다)', () => {
  assert.equal(whyUnlocked([], 'domino'), false);
  assert.equal(whyUnlocked([played({ outcome: 'left', winner: null })], 'domino'), false);
  assert.equal(whyUnlocked([played({ winner: 'teacher' })], 'domino'), true);
  assert.equal(MAKE_LEVEL, 6);
});
