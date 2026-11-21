// 구역 지도 맞히기 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 센 것과 맞는지 본다.
// 한 일과 사실만 말한다(칠한 지도를 맞다 틀리다 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다.
// 화면 코드와 틀에 이 형식이 이어져 있는지, 누르는 자리가 44픽셀보다 큰지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, MAKE_LABELS, MAKE_SIDE, generateBoard, rungOf, smallBoards } from '../src/core/regionmap-ladder.js';
import { MAX_SIDE, checkBoard, minQuestions } from '../src/core/regionmap.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteFitting, bruteMaps, bruteMin } from './helpers/brute-regionmap.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/regionmap.json'));
const html = read('index.html');
const code = read('src/formats/regionmap.js');
const board = read('src/ui/regionmap-board.js');
const css = read('src/app.css').replace(/\/\*[\s\S]*?\*\//g, '');

const VALUES = { k: 12, f: '숲 3칸, 바다 1칸', n: 16, no: '첫 ', face: '숲은', total: 9 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'level', 'map', 'asks', 'show'];

function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_') && !DATA_KEYS.includes(key))
      .flatMap(([key, item]) => allStrings(item, path ? `${path}.${key}` : key));
  }
  return [];
}
const strings = allStrings(T);

function visibleText(source) {
  const labels = [...source.matchAll(/aria-label="([^"]*)"/g)].map((match) => match[1]);
  const body = source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return [...labels, body].join(' ');
}
const part = (from, to) => {
  const at = html.lastIndexOf('<', html.indexOf(from));
  return html.slice(at, html.lastIndexOf('<', html.indexOf(to, html.indexOf(from))));
};
const own = [part('id="regionmap-title"', 'id="make-title"'), part('id="regionmap-left"', 'id="why"'), part('id="regionmap-count"', 'id="domino-count"'), part('id="regionmap-pad"', 'id="domino-pad"'), part('id="make-regionmap"', '<script')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

/** "왜 그럴까?"의 그림이 그리는 지도(src/formats/regionmap.js의 FIGURES와 같다) */
const drawn = (rows) => {
  const cells = rows.join('').split('').map(Number);
  return { w: rows[0].length, h: rows.length, regions: [...new Set(cells)].sort((a, b) => a - b), cells };
};
const FIGURES = { stairs: drawn(['0001', '0011', '0111', '0011']), pairA: drawn(['0000', '0001', '0111', '1111']), pairB: drawn(['0000', '0010', '0111', '1111']) };

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '구역 지도 맞히기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['물어서 맞히기', '구불구불한 바닷가', '세 구역', '가장 적게 묻기', '네 구역', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['ask', 'fewest', 'four', 'shape', 'three']);
  assert.deepEqual(Object.keys(T.hints).sort(), ['ask', 'fewest', 'four', 'made', 'shape', 'three']);
  assert.deepEqual(Object.keys(T.asks).sort(), ['ask', 'fewest', 'four', 'made', 'shape', 'three']);
  // 구역의 이름은 넷이고, 은/는을 붙인 꼴이 받침에 맞다
  assert.deepEqual(T.names.map((item) => item.name), ['숲', '바다', '모래밭', '들판']);
  assert.deepEqual(T.names.map((item) => item.topic), ['숲은', '바다는', '모래밭은', '들판은']);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말이 없다. 칠한 지도는 어느 물음과 맞지 않는지 사실로 말한다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞혔|맞았|빗나/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.equal(fill(T.play.question, { no: '첫 ', face: '숲은', n: 3, k: 4 }), '첫 번째 물음과 맞지 않아요. 그 네모 안에 칠한 숲은 3칸인데, 대답은 4칸이었어요.');
  assert.equal(fill(T.play.totals, { face: '바다는', n: 9, k: 8 }), '칠한 바다는 9칸인데, 처음에 알려 준 수는 8칸이에요.');
  assert.equal(fill(T.play.split, { face: '모래밭은', n: 2 }), '칠한 모래밭은 2덩이로 떨어져 있어요. 구역은 저마다 한 덩이로 이어져 있어요.');
  assert.match(T.play.fits, /^지금까지 물은 것과 모두 맞는 지도예요\. 그런데 숨은 지도와는 달라요\. 더 물어볼까요\?$/);
  assert.equal(fill(T.play.answer, { f: '숲 3칸, 바다 1칸' }), '숲 3칸, 바다 1칸이에요.');
  // 끝나는 곳은 하나다: 칠한 지도가 숨은 지도와 같을 때
  assert.equal([...code.matchAll(/frame\.finish\(/g)].length, 1);
  assert.match(code, /if \(result\.kind === 'same'\) \{\s*round\.leftAtEnd = left;\s*frame\.finish\('solved'\);/);
  assert.match(code, /round\.wrongCount \+= 1;\s*round\.lastWrong = result\.kind === 'question' \? result\.at : null;/);
  assert.doesNotMatch(code + board, /Math\.random|setInterval|setTimeout|requestAnimationFrame/);
  // 판 아래에는 물은 네모, 칠한 칸, (도구를 켜면) 맞는 지도의 수만 적는다. 누른 수나 무른 수, 틀린 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /askCount|againCount|paintCount|undoCount|resetCount|wrongCount|fitCount|moveCount/, line.trim());
  const foot = part('id="regionmap-count"', 'id="domino-count"');
  assert.equal([...foot.matchAll(/<strong/g)].length, 3);
  assert.match(visibleText(foot), /물은 네모\s+0\s+개\s+칠한 칸\s+0\s+개 \/\s+16\s+개/);
});

test('물음의 수는 끝난 뒤에 사실로만 말한다. 가장 적게 묻기는 풀이 프로그램이 구한 가장 적은 수를 말하고, 더 많이 물었으면 "더 줄일 수 있을까요?"', () => {
  assert.equal(fill(T.right.done, { n: 3 }), '숨은 지도와 같아요. 물음 3번으로 알아냈어요.');
  assert.equal(fill(T.right['fewest-min'], { k: 2 }), '이 지도는 네모 2개만 물어도 하나로 정해져요.');
  assert.equal(T.right['fewest-more'], '더 줄일 수 있을까요?');
  assert.match(code, /if \(round\.mode === 'fewest' && solution\.min\) \{/);
  assert.match(code, /if \(asked > least\) parts\.push\(T\.right\['fewest-more'\]\);\s*else if \(asked === least && left === 1\) parts\.push\(fill\(T\.right\['fewest-same'\], \{ k: least \}\)\);/);
  // 묻는 동안에는 몇 번 물었는지 말하지 않는다(판 아래의 "물은 네모"는 판에 남은 테두리의 수다)
  for (const [path, text] of strings) if (path.startsWith('play.') || path.startsWith('status.')) assert.doesNotMatch(text, /물음 \{n\}번|번 물었/, path);
});

test('무르기와 처음으로 뒤에는 앞의 말을 덮는 한마디를 한다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '칠한 것을 모두 지웠어요. 물은 것은 그대로 있어요.');
  assert.match(code, /frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.say\(T\.play\.reset\);/);
});

test('규칙 설명은 세 문장 안이다. 판의 종류마다 있다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  for (const [mode, ask] of Object.entries(T.asks)) for (const n of [2, 3, 4]) assert.ok(sentenceCount(`${fill(T.rules, { n })} ${ask}`) <= 3, mode);
  assert.equal(fill(T.rules, { n: 2 }), '숨은 지도는 이어진 구역 2개로 나뉘어 있어요. 네모를 골라 물으면 그 안에 구역마다 몇 칸이 있는지 알려 줘요.');
  assert.match(code, /ruleLine: \(round\) => `\$\{fill\(T\.rules, \{ n: round\.board\.regions\.length \}\)\} \$\{T\.asks\[round\.mode\]\}`,/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 39);
  assert.ok(sentenceCount(guides[38]) <= 3, guides[38]);
  assert.match(guides[38], /^칸을 모두 칠해 숨길 지도를 만들어요\./);
  assert.match(guides[38], /선생님이 네모를 많이 물어야 하는 지도도 만들 수 있을까요\?$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 힌트 1은 함께 쓰는 목록에서 고른다', () => {
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '전에 해 본 판 가운데 닮은 판이 있었나요?', '규칙 하나가 없다면 어디까지 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|\d|반 나누기/, hint);
    }
  }
  // "더 작은 판"을 힌트 1로 쓰는 판에는 늘 작은 판이 있다
  for (const level of [2, 3, 5]) {
    const mode = rungOf(level).mode;
    assert.match(T.hints[mode][0], /더 작은 판/);
    for (let seed = 1; seed <= 20; seed++) assert.ok(smallBoards({ mode, board: generateBoard(level, seed).board }).length >= 1, `${level}단계 ${seed}번`);
  }
  assert.match(code, /hints: \(round\) => T\.hints\[round\.mode\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.labels.cell, { k: 2, n: 3, face: '바다' }), '왼쪽에서 2번째, 위에서 3번째 칸, 바다');
  assert.equal(fill(T.listRow, { no: '첫 ', k: 2, n: 3, f: '숲 4칸, 바다 2칸' }), '첫 번째 · 가로 2칸 세로 3칸 · 숲 4칸, 바다 2칸');
  assert.equal(fill(T.totals, { f: '숲 8칸, 바다 8칸' }), '판 전체에는 숲 8칸, 바다 8칸이 있어요.');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /점수|순위|레벨|연속/);
  const short = ['title', 'levels', 'names', 'eraser', 'part', 'join', 'labels', 'listRow', 'tool'];
  const spoken = strings.filter(([path]) => !short.some((key) => path === key || path.startsWith(`${key}.`) || path.startsWith(`${key}[`)) && !path.startsWith('status') && !path.startsWith('fit') && !path.endsWith('note'));
  for (const [path, text] of spoken) for (const sentence of sentences(fill(text, VALUES))) assert.match(sentence, /요[.?!]$/, `${path}: ${sentence}`);
  for (const text of [...Object.values(T.status), ...Object.values(T.fit)]) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('"왜 그럴까?": 칸 하나씩 여섯 번은 10가지 → 왼쪽 반쪽 하나로 140가지에서 12가지 → 반쪽 둘로 4가지 → 셋으로 하나(이름) → 반쪽으로 못 가르는 두 지도(칸마다 골라 본 지도로 다시 센다)', () => {
  assert.equal(T.why.length, 5);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const stairs = FIGURES.stairs;
  const all = bruteMaps(4, 4, [0, 1], [8, 8]);
  assert.equal(all.length, 140);
  const left = (item) => bruteFitting(FIGURES[item.map], all, item.asks).length;
  const [first, second, third, fourth, fifth] = T.why;
  // 첫 장: 칸 하나씩 여섯 번 물으면 아직 10가지
  assert.equal(first.figures[0].asks.length, 6);
  assert.ok(first.figures[0].asks.every(([x0, y0, x1, y1]) => x0 === x1 && y0 === y1));
  assert.equal(left(first.figures[0]), 10);
  assert.match(first.say, /여섯 번 물었는데 맞는 지도가 아직 10가지나 남았어요\./);
  assert.equal(first.figures[0].note, '맞는 지도 10가지예요');
  // 둘째 장: 아무것도 묻지 않으면 140가지, 왼쪽 반쪽 하나로 12가지
  assert.deepEqual(second.figures.map(left), [140, 12]);
  assert.deepEqual(second.figures[1].asks, [[0, 0, 1, 3]]);
  assert.match(second.say, /140가지에서 12가지로 줄었어요\.$/);
  // 셋째 장: 위쪽 반쪽까지 물으면 4가지
  assert.deepEqual(third.figures[0].asks, [[0, 0, 1, 3], [0, 0, 3, 1]]);
  assert.equal(left(third.figures[0]), 4);
  assert.match(third.say, /4가지로 줄었어요\.$/);
  // 넷째 장: 가운데 두 줄을 더 물으면 하나. 이름은 여기서 처음 말한다. 이 지도는 네모 셋보다 적게는 정해지지 않는다
  assert.deepEqual(fourth.figures[0].asks[2], [0, 1, 3, 2]);
  assert.equal(left(fourth.figures[0]), 1);
  assert.equal(fourth.figures[1].show, true);
  assert.equal(minQuestions(stairs).size, 3);
  assert.equal(bruteMin(stairs, all, 3), 3);
  assert.match(fourth.say, /반 나누기라고 불러요\.$/);
  for (const [path, text] of strings) if (!path.startsWith('why[3]')) assert.doesNotMatch(text, /반 나누기/, path);
  // 다섯째 장: 두 칸만 다른 두 지도는 왼쪽·오른쪽·위쪽·아래쪽 반쪽의 대답이 모두 같다(까닭이 그대로는 통하지 않는 판)
  const [a, b] = [FIGURES.pairA, FIGURES.pairB];
  assert.equal(a.cells.filter((cell, at) => cell !== b.cells[at]).length, 2);
  for (const rect of [[0, 0, 1, 3], [2, 0, 3, 3], [0, 0, 3, 1], [0, 2, 3, 3]]) assert.equal(bruteFitting(a, [b.cells], [rect]).length, 1, String(rect));
  assert.deepEqual(fifth.figures.map((item) => item.map), ['pairA', 'pairB']);
  assert.match(fifth.say, /어디를 물어야 가를 수 있을까요\?$/);
  assert.match(code, /stairs: \(\) => drawnMap\(\['0001', '0011', '0111', '0011'\]\),/);
  assert.match(code, /pairA: \(\) => drawnMap\(\['0000', '0001', '0111', '1111'\]\),/);
  assert.match(code, /pairB: \(\) => drawnMap\(\['0000', '0010', '0111', '1111'\]\),/);
});

test('직접 만들기: 4×4 판에 숲, 바다, 모래밭을 칠하고, 선생님이 물어서 알아낸 네모 수와 가장 적은 네모 수를 말한다', () => {
  assert.equal(MAKE_SIDE, 4);
  assert.deepEqual(MAKE_LABELS, [0, 1, 2]);
  assert.equal(fill(T.make.found, { n: 3 }), '선생님은 네모 3개를 물어서 알아냈어요.');
  assert.match(code, /const asks = teacherAsks\(board\)\.map\(\(rect\) => \(\{ rect, counts: answerOf\(board, rect\) \}\)\);/);
  assert.match(code, /if \(least\) lines\.push\(fill\(T\.make\.min, \{ k: least\.size \}\)\);/);
  // 지도를 바꾸면 앞의 대답이 맞지 않으니 말로 덮는다
  assert.match(code, /if \(said\) frame\.talkers\.make\.say\(T\.make\.changed\);/);
  const make = part('id="make-regionmap"', '<script');
  for (const id of ['regionmap-make-palette', 'regionmap-make-clear', 'regionmap-make-board', 'regionmap-make-solve', 'regionmap-make-result', 'regionmap-make-list']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="regionmap-make-solve"[^>]*>선생님, 물어 보세요</);
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.doesNotMatch(code, /bestOf/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 도구, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-regionmap-sample', 'home-regionmap-ask', 'home-regionmap-play', 'home-regionmap-pick', 'home-regionmap-make', 'home-regionmap-blank', 'regionmap-board', 'regionmap-count', 'regionmap-status', 'regionmap-asked', 'regionmap-painted', 'regionmap-cells', 'regionmap-fit', 'regionmap-pad', 'regionmap-totals', 'regionmap-ask-mode', 'regionmap-paint-mode', 'regionmap-ask-box', 'regionmap-ask', 'regionmap-clear-pick', 'regionmap-paint-box', 'regionmap-palette', 'regionmap-submit', 'regionmap-list', 'regionmap-left', 'make-regionmap']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="regionmap-title"', '</section>'), /<h2 id="regionmap-title">구역 지도 맞히기<\/h2>/);
  assert.ok(visibleText(part('id="regionmap-title"', '</section>')).includes(T.home.ask.ask));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-regionmap-make" class="menu-item"/);
  const pad = part('id="regionmap-pad"', 'id="domino-pad"');
  assert.match(pad, /id="regionmap-ask-mode"[^>]*>네모로 묻기</);
  assert.match(pad, /id="regionmap-paint-mode"[^>]*>지도 칠하기</);
  assert.match(pad, /id="regionmap-ask"[^>]*>물어보기</);
  assert.match(pad, /id="regionmap-submit"[^>]*>이 지도예요</);
  assert.match(part('id="regionmap-left"', 'id="why"'), /aria-pressed="false" hidden>맞는 지도 세어 보기</);
  assert.equal(T.tool.off, '맞는 지도 세어 보기');
  // 카드는 그물 끊기 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="net-title"') < html.indexOf('id="regionmap-title"'));
  assert.ok(html.indexOf('id="regionmap-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(형식 목록의 맨 뒤, 그물 끊기 다음)
  assert.match(read('src/main.js'), /net: createNet\(frame\), regionmap: createRegionmap\(frame\) \};/);
  assert.match(read('src/check-main.js'), /\['regionmap', '구역 지도 맞히기'\]/);
  assert.match(read('src/core/smaller.js'), /net: smallerNet, regionmap: smallerRegionmap \};/);
  assert.match(code, /smaller: \(round, turn\) => smallerRegionmap\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기가 있다(칠한 것을 무른다). 규칙 글은 왼쪽 칸에 둔다
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /ruleAside: true,/);
  // 도구를 처음 켜면 힌트 하나로 센다
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.fitShown \? 1 : 0\),/);
  // 처음 화면과 판 고르기의 그림에는 숨은 지도를 그리지 않는다
  assert.match(code, /drawSample\(root, board\) \{\s*drawRegionmap\(root, \{ w: board\.w, h: board\.h, paint: blankPaint\(board\), small: true \}\);/);
});

test('화면: 가장 큰 판(6×6)에서도 칸이 44픽셀보다 크고, 고르는 단추와 목록이 손가락으로 누를 만하다. 구역은 색만이 아니라 무늬로도 갈린다', () => {
  // 판 칸은 1180×820 화면에서 가로 477픽셀, 세로 432픽셀쯤이다(규칙 글이 왼쪽 칸에 있다. 화면에서 재 보았다). 460×420으로 잡는다
  const edge = Number(board.match(/const EDGE = (\d+);/)[1]) / 100;
  const unit = Math.min(460 / (MAX_SIDE + 2 * edge), 420 / (MAX_SIDE + 2 * edge));
  assert.ok(unit >= 44, `${unit}`);
  // 직접 만들기의 판(4×4, 가로 477, 세로 397픽셀쯤)
  assert.ok(Math.min(460 / (MAKE_SIDE + 2 * edge), 380 / (MAKE_SIDE + 2 * edge)) >= 44);
  for (const selector of ['.rm-tools .btn', '.rm-brush', '.rm-row']) {
    const body = css.match(new RegExp(`\\n${selector.replace(/\./g, '\\.')} \\{([^}]*)\\}`))[1];
    assert.ok(Number(body.match(/min-height:\s*(\d+)px/)[1]) >= 48, selector);
  }
  // 구역마다 색과 무늬(세모 나무, 물결, 점 셋, 풀)
  for (const label of [0, 1, 2, 3]) assert.match(css, new RegExp(`\\.rm-fill\\.r${label} \\{`));
  assert.match(board, /if \(label === 0\) \{\s*\/\/ 숲: 세모 나무와 줄기/);
  assert.match(board, /\/\/ 바다: 물결 두 줄/);
  assert.match(board, /\/\/ 모래밭: 점 셋/);
  assert.match(board, /\/\/ 들판: 풀 세 포기/);
  // 끌어서 고르기와 두 번 눌러 고르기
  assert.match(board, /if \(view\.onPick\) view\.onPick\(press\.cell, tap \? press\.cell : end, \{ tap \}\);/);
  assert.match(code, /if \(anchor === null\) \{\s*anchor = from;/);
  assert.match(css, /\.rm-board\.live \.rm-svg \{[^}]*touch-action: none;/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'regionmap', level: 1, seed: 1, custom: false, mode: 'ask', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: '001001111', correct: true, guess: null }], wrongCount: 0, moveCount: 4, seconds: 60, solution: { possible: true, sizes: [4, 5], maps: 16, min: 1 }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 판을 한 번 끝까지 한 뒤에 열린다', () => {
  const tuning = tuningFor('regionmap');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.equal(tuning.fastWin, undefined);
  assert.equal(tuning.fastSolo, undefined);
  assert.match(read('src/core/level.js'), /구역 지도 맞히기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'regionmap'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'regionmap'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 숨은 지도와 다른 지도를 한 번 낸 판은 "한 번에"가 아니다. 세어 보기를 켠 판(힌트 하나)도 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'regionmap').offerHarder, false);
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, hintsOpened: 1 })], 'regionmap').offerHarder, false);
  assert.equal(whyUnlocked([], 'regionmap'), false);
  assert.equal(whyUnlocked([finished()], 'regionmap'), true);
  assert.equal(whyUnlocked([{ ...finished(), side: true }], 'regionmap'), false);
  assert.equal(whyUnlocked([{ ...finished(), outcome: 'left' }], 'regionmap'), false);
});
