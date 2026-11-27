// 주사위 미로와 길 세기 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 판과 수와 주장이 풀이 프로그램과 맞는지 본다.
// 실험에서 고른 출구를 맞다 틀리다 하지 않는다, 결과는 사실로만 말하고 "더 많이 해 보기"만 권한다, 자물쇠의 짐작하는 말,
// 힌트는 두 높이, "왜 그럴까?"는 알아챈 이야기, 화면을 그리는 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, rungOf } from '../src/core/maze-ladder.js';
import { checkBoard, countPaths, exitCell, exitTally, parentsOf, pathsTo, replaySends, topExits } from '../src/core/maze.js';
import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { smallerMaze } from '../src/core/smaller.js';
import { fill, ordinal, sentenceCount } from '../src/core/text.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/maze.json'));
const html = read('index.html');
const code = read('src/formats/maze.js');

const VALUES = { k: 3, n: 2, no: '첫 ', face: '다', total: 100 };

/** 대본의 모든 글(값)을 길과 함께 모은다. 설명(_로 시작하는 것)과 그림의 값(판, 길, 시드)은 뺀다. */
function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_') && !['board', 'paths', 'path', 'sends'].includes(key))
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
const own = [
  part('id="maze-title"', 'id="make-title"'),
  part('id="maze-count"', 'id="cups-count"'),
  part('id="maze-paths"', 'id="why"'),
  part('id="maze-pad"', 'id="dandelion-pad"'),
  part('id="maze-more"', '</section>'),
  part('id="make-maze"', '<script'),
]
  .map(visibleText)
  .join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const figures = T.why.flatMap((slide) => slide.figures);

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '주사위 미로와 길 세기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['붐비는 출구 고르기', '출구까지 가는 길', '칸마다 오는 길', '막힌 갈림길', '짝수 칸 칠하기', '직접 만들기']);
  // 출구의 이름은 가장 큰 판(8줄, 출구 아홉)까지 있고, 수와 헷갈리지 않게 글자로 붙인다.
  assert.equal(T.exits.length, 9);
  for (const name of T.exits) assert.match(name, /^[가-힣]$/);
});

test('규칙 설명은 세 문장 안이고, 주사위 눈과 가는 쪽, 묻는 것을 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  for (const rung of LADDER) assert.ok(T.rules[rung.hint], rung.level);
  for (const rule of Object.values(T.rules)) assert.ok(sentenceCount(rule) <= 3, rule);
  assert.match(T.rules.busy, /1, 2, 3이 나오면 왼쪽 아래로, 4, 5, 6이 나오면 오른쪽 아래로 가요\./);
  assert.match(T.rules.busy, /어느 출구로 가장 많이 갈지 고르고/);
  assert.match(T.rules.exit, /맞는 수를 넣으면 자물쇠가 열려요\.$/);
  assert.match(T.rules.blocked, /돌이 놓인 갈림길은 막혀서 지나갈 수 없어요\./);
  assert.match(T.rules.even, /짝수인 칸을 모두 칠해 보세요\./);
  // 형식이 단계(직접 만든 판은 exits)로 규칙 글을 고른다.
  assert.match(code, /ruleLine: \(round\) => T\.rules\[round\.custom \? 'exits' : rungOf\(round\.level\)\.hint\],/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 54);
  assert.ok(sentenceCount(guides[12]) <= 3, guides[12]);
  assert.match(guides[12], /길이 많은 출구에 손님도 많이 갈까요\?$/);
  // 판 위의 주사위 안내도 같은 말이다.
  assert.match(visibleText(part('id="maze-send"', 'id="dandelion-pad"')), /주사위 눈이 1, 2, 3이면 왼쪽, 4, 5, 6이면 오른쪽으로 가요\./);
});

test('실험: 고른 출구를 맞다 틀리다 하지 않는다. 몇 명이 어디로 갔는지를 사실로 말하고, 더 많이 해 보기만 권한다', () => {
  const said = [T.right['busy-top'], T.right['busy-tie'], T.right['busy-mine-top'], T.right['busy-mine'], T.right['busy-more'], T.play.picked, T.play['one-arrived'], T.play.many].join(' ');
  assert.doesNotMatch(said, /틀렸|맞았|맞혔|아쉽|잘했|훌륭|대단|정답|예상대로|예상과/);
  assert.equal(fill(T.right['busy-top'], { total: 100, face: '다', k: 36 }), '손님 100명 가운데 다 출구로 가장 많이 갔어요. 36명이에요.');
  assert.equal(fill(T.right['busy-mine'], { face: '가', k: 4 }), '고른 가 출구에는 4명이 갔어요.');
  assert.match(T.right['busy-more'], /더 많이 해 보기/);
  assert.match(part('id="maze-more"', '</section>'), /id="maze-more"[^>]*hidden>더 많이 해 보기</);
  // 고르기의 맞고 틀림은 기록에만 남는다.
  assert.match(code, /const correct = solution\.busiest\.includes\(exit\);/);
  assert.match(code, /pickBusiest: round\.pick !== null && solution\.busiest\.includes\(round\.pick\),/);
  // 판이 끝나는 때: 고른 뒤 손님을 모두 100명 넘게 보냈을 때
  assert.match(code, /if \(round\.mode !== 'busy' \|\| round\.pick === null \|\| sumOf\(round\.ends\) < FINISH_GUESTS\) return false;/);
  // 퍼센트나 분수로 말하지 않는다. 몇 명 가운데 몇 명으로 말한다.
  for (const [path, text] of strings) assert.doesNotMatch(text, /%|퍼센트|분의|확률/, path);
});

test('주사위는 시드 난수다: 시드는 판 번호와 몇 번째로 보낸 것인지로 정하고 판에 적어 둔다. 화면 코드에는 Math.random이 없다', () => {
  assert.match(code, /const seed = seedFrom\(FORMAT, round\.id, round\.sends\.length\);/);
  assert.match(code, /round\.sends\.push\(\{ n, seed \}\);/);
  assert.doesNotMatch(code, /Math\.random/);
  assert.doesNotMatch(read('src/ui/maze-board.js'), /Math\.random/);
  // 적어 둔 판을 다시 열 때 보낸 손님을 다시 보내 보아 맞는지 본다.
  assert.match(code, /JSON\.stringify\(replaySends\(board, saved\.sends\)\) !== JSON\.stringify\(saved\.ends\)/);
});

test('자물쇠: 맞는 수에서 열리고 틀리면 잠긴 채로 있다. 짐작은 "빠뜨린 길"과 "두 번 센 길"이다. 같은 수를 또 넣으면 그 사실을 말한다', () => {
  assert.equal(T.guess['too-few'], '빠뜨린 길이 있는 것 같아요.');
  assert.equal(T.guess['too-many'], '두 번 센 길이 있는 것 같아요.');
  assert.match(T.guess.none, /판에서 확인해 볼까요\?$/);
  for (const text of Object.values(T.guess)) assert.doesNotMatch(text, /틀렸|아니에요|땡/);
  assert.equal(T.status.still, '자물쇠가 그대로예요');
  assert.equal(fill(T.play['same-again'], { k: 5 }), '5가지는 아까도 넣어 봤어요.');
  assert.equal(fill(T.play.opened, { k: 6 }), '6가지예요. 자물쇠가 열렸어요.');
  assert.match(part('id="maze-lock"', 'id="maze-send"'), /id="maze-open"[^>]*>열어 보기</);
  // 0도 낼 수 있다(막혀서 길이 없는 출구).
  assert.match(part('id="maze-keys"', 'id="maze-open"'), /data-n="0">0</);
  // "전부 보여 줘"는 답한 뒤(판이 끝난 뒤)에만 보인다.
  assert.match(code, /\$\('maze-all'\)\.hidden = !\(done && board\.ask === 'target'\);/);
  assert.match(part('id="maze-more"', '</section>'), /id="maze-all"[^>]*hidden>전부 보여 줘</);
  assert.equal(T.allTitle, '전부 보여 줘');
});

test('길 그려 보기: 같은 길은 두 번 적지 않고, 적은 길은 차례대로 줄을 맞춘다. 쓰라고 권하지 않고, 힌트로 세지 않는다', () => {
  assert.deepEqual(T.tool, { off: '길 그려 보기', on: '길 그리기 끄기', count: '적은 길 {n}가지' });
  assert.match(part('id="maze-paths"', 'id="why"'), /id="maze-paths"[^>]*hidden>길 그려 보기</);
  assert.equal(T.status['path-dup'], '이 길은 앞에서 적었어요');
  assert.match(code, /sortPaths\(round\.paths\)/);
  assert.match(code, /if \(round\.paths\.includes\(path\)\) \{/);
  assert.doesNotMatch(code, /hintsOpened/);
  assert.equal(T.arrows.L, '↙');
  assert.equal(T.arrows.R, '↘');
});

test('힌트는 판마다 두 개이고, 하나하나가 질문 한 문장이다. 까닭(위 두 칸의 합)은 힌트에서 말하지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['blocked', 'busy', 'even', 'exit', 'exits', 'fill']);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /요\?$/, hint);
      assert.doesNotMatch(hint, /더하|더한|합/, hint);
    }
  }
  for (const rung of LADDER) assert.ok(T.hints[rung.hint], rung.level);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.cellLabel, { no: ordinal(1), n: ordinal(3) }), '위에서 첫 번째 줄, 왼쪽에서 3번째 갈림길');
  assert.equal(fill(T.names.exit, { face: '마' }), '마 출구');
  assert.equal(fill(T.guests, { n: 37 }), '37명');
});

test('화면 글에 영어 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  const spoken = [
    ...Object.values(T.home.ask),
    T.home.pick,
    ...Object.values(T.rules),
    ...Object.values(T.play),
    ...Object.values(T.guess),
    ...Object.values(T.hints).flat(),
    ...Object.values(T.right),
    T.solution.busy,
    T.solution.paths,
    T.solution.numbers,
    T.solution.evens,
    ...Object.values(T.make).filter((text) => !/^\{n\}줄$/.test(text)),
    ...T.why.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of [...Object.values(T.status), ...Object.values(T.cellState).filter((text) => !text.includes('{k}')), T.evenTitle]) assert.match(text, /요$/, text);
  for (const item of figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('생각의 이름("위 두 칸의 합")은 "왜 그럴까?"의 셋째 장에서 처음 말한다', () => {
  const name = /위 두 칸의 합/;
  for (const [path, text] of strings.filter(([path]) => !path.startsWith('why'))) assert.doesNotMatch(text, name, path);
  assert.doesNotMatch(visibleText(html), name);
  assert.doesNotMatch(T.why[0].say + T.why[1].say, name);
  assert.match(T.why[2].say, /선생님은 이것을 위 두 칸의 합이라고 불러요\.$/);
});

test('"왜 그럴까?"는 그림 서너 장의 알아챈 이야기다. 그림 속의 손님 수, 길, 칸의 수는 풀이 프로그램과 시드 난수로 다시 구한 것과 같다', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) {
    assert.ok(sentenceCount(slide.say) <= 3, slide.say);
    assert.ok(slide.figures.length >= 1 && slide.figures.length <= 2);
  }
  // 첫 장: 선생님도 처음에는 끝 출구를 골랐다(뜻밖의 결과). 손님 100명은 가운데로 몰렸다.
  assert.match(T.why[0].say, /^선생님도 처음에는 가 출구를 골랐어요\./);
  for (const item of figures) {
    assert.equal(checkBoard(item.board), null, item.note);
    if (item.sends) {
      const ends = replaySends(item.board, item.sends);
      const tally = exitTally(item.board, ends);
      const top = topExits(tally);
      assert.deepEqual(top.exits, [item.top], item.note);
      assert.equal(top.max, item.count, item.note);
      // 그림 아래 글의 "가 4명, 다 36명" 같은 수가 실제로 보낸 결과와 같다.
      for (const [, name, many] of item.note.matchAll(/([가-힣]) (\d+)명/g)) assert.equal(tally[T.exits.indexOf(name)], Number(many), item.note);
    }
    if (item.paths) {
      const cell = exitCell(item.board.rows, item.board.target);
      assert.deepEqual(item.paths, pathsTo(item.board, cell), item.note);
    }
    if (item.mark !== undefined) {
      const counts = countPaths(item.board);
      const [a, b] = parentsOf(item.mark).map((cell) => counts[cell]);
      assert.equal(item.note, `${a}과 ${b}를 더하면 ${counts[item.mark]}이에요`);
      assert.equal(a + b, counts[item.mark]);
    }
  }
  assert.match(T.why[0].say, /가 출구에는 4명뿐이었어요\. 다 출구에 36명이 가서 가장 많았어요\./);
  assert.match(T.why[1].say, /가 출구로 가는 길은 한 가지, 다 출구로 가는 길은 여섯 가지였어요\./);
  assert.equal(T.why[1].figures[1].paths.length, 6);
  // 넷째 장: 까닭이 그대로는 통하지 않는 판. 손님이 적으면 가운데가 가장 많지 않을 수 있다.
  const few = T.why[3].figures[0];
  assert.equal(few.sends[0].n, 10);
  assert.notEqual(few.top, 2);
  assert.match(T.why[3].say, /많이 보내야 잘 보여요\./);
  // 실험 판과 세는 판을 한 번씩 끝까지 한 뒤에 열린다(src/core/maze.js의 whyOpen).
  assert.match(code, /if \(!whyOpen\(frame\.records\(\)\)\) return null;/);
});

test('판 고르기의 그림: 단계마다 그 단계의 판이다', () => {
  for (const entry of T.levels) {
    const rung = rungOf(entry.level);
    if (rung.mode === 'make') {
      assert.equal(entry.picture.blank, true);
      continue;
    }
    assert.equal(checkBoard(entry.picture.board), null, entry.name);
    assert.equal(entry.picture.board.kind, rung.mode);
    assert.equal(entry.picture.board.blocked.length > 0, rung.hint === 'blocked', entry.name);
  }
});

test('"더 작은 판으로": 사다리의 판마다 같은 종류의 작은 판을 낸다(없으면 내지 않는다)', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (let seed = 1; seed <= 12; seed++) {
      const { board } = generateBoard(level, seed);
      const small = smallerMaze({ mode: board.kind, board }, 0);
      if (!small) continue;
      assert.ok(small.board.rows < board.rows);
      assert.equal(small.board.kind, board.kind);
      assert.equal(small.board.ask, board.ask);
      assert.equal(checkBoard(small.board), null);
      assert.deepEqual(smallerMaze({ board }, 0), small, '같은 판, 같은 차례에는 같은 작은 판');
    }
  }
  assert.equal(smallerMaze({ board: generateBoard(1, 1).board }, 0), null, '2줄 실험 판보다 작은 판은 없다');
  assert.equal(smallerMaze({ board: null }), null);
});

test('직접 만들기: 줄 수를 정하고 갈림길을 막는다. 선생님이 길을 세어 주고 손님 100명을 보내 준다. 길이 없는 판은 남기지 않는다', () => {
  const make = part('id="make-maze"', '<script');
  for (const id of ['maze-make-rows-fewer', 'maze-make-rows-more', 'maze-make-rows', 'maze-make-open-all', 'maze-make-board', 'maze-make-solve', 'maze-make-send', 'maze-make-result', 'maze-make-play']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="maze-make-solve"[^>]*>선생님, 길을 세어 주세요</);
  assert.match(make, /id="maze-make-send"[^>]*>손님 100명 보내기</);
  assert.equal(fill(T.make.counted, { k: 12 }), '칸마다 오는 길의 수를 적었어요. 출구로 가는 길은 모두 12가지예요.');
  assert.match(T.make['keep-not-yet'], /하나 열어 볼까요\?$/);
  assert.match(code, /const result = solve\(board\);/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.match(code, /return checkBoard\(board\) === null \? board : null;/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 도구, 답하는 칸, 끝난 뒤의 단추, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of [
    'home-maze-sample',
    'home-maze-ask',
    'home-maze-play',
    'home-maze-pick',
    'home-maze-make',
    'home-maze-blank',
    'maze-board',
    'maze-count',
    'maze-status',
    'maze-sent',
    'maze-locks',
    'maze-painted',
    'maze-paths',
    'maze-path-box',
    'maze-path-list',
    'maze-path-clear',
    'maze-pad',
    'maze-picks',
    'maze-picked',
    'maze-even-title',
    'maze-tools',
    'maze-check',
    'maze-ask',
    'maze-typed',
    'maze-keys',
    'maze-open',
    'maze-send-one',
    'maze-send-many',
    'maze-more',
    'maze-all',
    'make-maze',
  ]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="maze-title"', '</section>'), /<h2 id="maze-title">주사위 미로와 길 세기<\/h2>/);
  assert.ok(visibleText(part('id="maze-title"', '</section>')).includes(T.home.ask.busy));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-maze-make" class="menu-item"/);
  assert.match(part('id="maze-check-box"', 'id="maze-send"'), /id="maze-check"[^>]*>다 칠했어요</);
  // 판 아래의 수는 보낸 손님, 남은 자물쇠, 칠한 칸뿐이다(몇 판째, 몇 번 맞혔는지는 없다).
  assert.equal([...part('id="maze-count"', 'id="cups-count"').matchAll(/<strong/g)].length, 3);
  // 틀이 형식을 안다.
  assert.match(read('src/main.js'), /dandelion: createDandelion\(frame\), maze: createMaze\(frame\), /);
  assert.match(read('src/check-main.js'), /\['maze', '주사위 미로와 길 세기'\]/);
  // 지난 기록은 틀이 건네주는 것(작은 판을 뺀 기록)으로 본다.
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${Math.random()}`, format: 'maze', level: 1, seed: 2, custom: false, mode: 'busy', outcome: 'solved', hintsOpened: 0, answers: [{ t: 3, answer: 'exit:2', correct: true, guess: null }], wrongCount: 0, moveCount: 1, seconds: 60, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계(실험)다', () => {
  const tuning = tuningFor('maze');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.match(read('src/core/level.js'), /주사위 미로와 길 세기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'maze'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
});

test('"한 번에 빠르게": 실험은 고른 출구와 상관없이 끝까지 해 본 판, 세는 판은 틀린 수 없이 예상 시간 안에 연 판이다', () => {
  // 실험: 고른 출구가 붐볐는지는 보지 않는다(고르기에 틀린 답이 없다).
  assert.equal(recommend([finished(), finished({ answers: [{ t: 3, answer: 'exit:0', correct: false, guess: null }] })], 'maze').offerHarder, true);
  assert.equal(recommend([finished(), finished({ seconds: 400 })], 'maze').offerHarder, false);
  assert.equal(recommend([finished(), finished({ hintsOpened: 1 })], 'maze').offerHarder, false);
  // 세는 판: 틀린 수를 넣었으면 "한 번에"가 아니다.
  const count = (more = {}) => finished({ level: 2, mode: 'count', answers: [{ t: 3, answer: '7:3', correct: true, guess: null }], ...more });
  assert.deepEqual(recommend([count(), count()], 'maze'), { level: 2, small: false, offerHarder: true, harderLevel: 3, reason: 'fast' });
  assert.equal(recommend([count(), count({ wrongCount: 1 })], 'maze').offerHarder, false);
  // 연달아 그만두면 한 단계 아래부터 보여 준다.
  assert.equal(recommend([count({ outcome: 'left' }), count({ outcome: 'left' })], 'maze').level, 1);
});

test('틀의 "왜 그럴까?" 문: 이 형식의 판을 한 번 끝까지 하면 막지 않는다(실험과 세기를 한 번씩 한 뒤에 여는 것은 이 형식이 본다)', () => {
  assert.equal(whyUnlocked([], 'maze'), false);
  assert.equal(whyUnlocked([finished({ outcome: 'left' })], 'maze'), false);
  assert.equal(whyUnlocked([finished()], 'maze'), true);
  assert.equal(MAKE_LEVEL, 6);
});
