// 그물 끊기 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 센 것과 맞는지 본다.
// 한 일과 사실만 말한다(짐작을 맞다 틀리다 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다, 셈을 외우게 하지 않는다.
// 화면 코드와 틀에 이 형식이 이어져 있는지, 줄을 누르는 자리가 44픽셀보다 큰지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, base, generateBoard, grid, island, rungOf, smallBoards } from '../src/core/net-ladder.js';
import { REACH, boardKey, boundsOf, checkBoard, stringAt } from '../src/core/net.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteMaxCut, countPieces, endCounts, hasLoop } from './helpers/brute-net.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/net.json'));
const html = read('index.html');
const code = read('src/formats/net.js');
const board = read('src/ui/net-board.js');
const css = read('src/app.css');

const VALUES = { k: 12, f: 3, n: 16, no: '첫 ', face: '', total: 9 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'level', 'board', 'cut', 'keep', 'loop'];

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
const own = [part('id="net-title"', 'id="regionmap-title"'), part('id="net-loop"', 'id="regionmap-left"'), part('id="net-count"', 'id="regionmap-count"'), part('id="net-pad"', 'id="regionmap-pad"'), part('id="net-again"', 'id="fair-reason-box"'), part('id="make-net"', 'id="make-regionmap"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

/** "왜 그럴까?"의 그림이 그리는 그물(src/formats/net.js의 FIGURES와 같다) */
const FIGURES = { grid3x3: () => base('grid3x3'), island44: () => island(4, 4, 0) };

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '그물 끊기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['끊어 보기', '짐작하고 끊기', '두 그물 견주기', '큰 그물 세어 보기', '두 조각 그물', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['cut', 'guess', 'pieces', 'predict', 'twins']);
  assert.deepEqual(Object.keys(T.hints).sort(), ['cut', 'guess', 'made', 'pieces', 'predict', 'twins']);
  assert.deepEqual(Object.keys(T.asks).sort(), ['cut', 'guess', 'made', 'pieces', 'predict', 'twins']);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말이 없다. 짐작은 기록만 하고 맞다 틀리다 하지 않는다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔|맞았|빗나/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  // 짐작은 "처음에는 …라고 짐작했어요"로 사실만 말한다
  assert.equal(fill(T.right['guess-was'], { n: 3 }), '처음에는 3줄이라고 짐작했어요.');
  for (const key of ['left', 'same', 'right']) assert.match(T.right[`twins-guess-${key}`], /^처음에는 .*짐작했어요\.$/);
  assert.match(code, /guessMatched:/);
  for (const line of code.split('\n')) if (/textContent|frame\.say|parts\.push/.test(line)) assert.doesNotMatch(line, /guessMatched|sameAsBefore/, line.trim());
  // 끝나는 곳은 하나다: 더 끊을 줄이 없을 때(조각 수가 처음과 같고 고리가 없을 때) 저절로 끝난다. 답하는 단추가 없어 틀린 답이 없다
  assert.equal([...code.matchAll(/frame\.finish\(/g)].length, 1);
  assert.match(code, /if \(state\.done\) \{\s*round\.answers\.push\(\{ t: frame\.stamp\(\), answer: String\(state\.cut\), correct: true, guess: null \}\);\s*frame\.finish\('solved'\);/);
  assert.doesNotMatch(code, /wrongCount \+= 1/);
  assert.doesNotMatch(code + board, /Math\.random|setInterval|setTimeout|requestAnimationFrame/);
  // 갈라지게 끊어도 막지 않는다. 사실(몇 조각이 되었는지)과 할 수 있는 일(다시 누르면 이어진다)을 판 아래에 적는다
  assert.equal(fill(T.status.split, { n: 2 }), '그물이 갈라져 2조각이 되었어요. 끊은 줄을 다시 누르면 이어져요');
  assert.equal(fill(T.status.done, { k: 4 }), '더 끊을 줄이 없어요. 끊은 줄은 4개예요');
  // 판 아래에는 끊은 줄, 남은 줄, 조각의 수만 적는다. 누른 수나 무른 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /moveCount|splitCount|restoreCount|undoCount|resetCount|wrongCount|loopCount/, line.trim());
  const foot = part('id="net-count"', 'id="regionmap-count"');
  assert.equal([...foot.matchAll(/<strong/g)].length, 3);
  assert.match(visibleText(foot), /끊은 줄\s+0\s+개\s+남은 줄\s+0\s+개\s+조각\s+1\s+개/);
});

test('같은 그물을 다르게 끊어 보면 지난번과 견주어 사실만 말한다. 끝난 뒤 고르기에 "같은 그물 다르게 끊기"가 있다', () => {
  assert.equal(T.right['again-other'], '지난번과 다른 줄을 끊었는데, 끊은 줄의 수는 지난번과 같아요.');
  assert.equal(fill(T.right['cut-next'], { k: 3 }), '다른 줄부터 끊어도 3줄일까요?');
  assert.match(code, /if \(round\.before\) parts\.push\(sameSet\(round\.before\.cut, cut\) \? T\.right\['again-same'\] : T\.right\['again-other'\]\);/);
  assert.match(part('id="net-again"', 'id="fair-reason-box"'), /id="net-again" class="btn wide after-extra" type="button" hidden>같은 그물 다르게 끊기</);
  assert.match(code, /frame\.chooseAfter\('again', \(\) => \{/);
  // 다시 하는 판은 다시 짐작하지 않는다
  assert.match(code, /const needGuess = \(round\) => !round\.again && round\.guess === null/);
});

test('셈과 어려운 낱말을 쓰지 않는다. 생각의 이름(나무 모양)은 "왜 그럴까?"에서 처음 말한다', () => {
  const banned = /공식|원리|법칙|그래프|변|꼭짓점|트리|사이클|신장|별|빼기 1|더하기 1|[-+=×÷]/;
  for (const [path, text] of strings) assert.doesNotMatch(text, banned, `${path}: ${text}`);
  assert.doesNotMatch(own, banned);
  for (const [path, text] of strings) if (!['why[2]', 'why[3]', 'why[4]'].some((slide) => path.startsWith(slide))) assert.doesNotMatch(text, /나무 모양/, path);
  assert.match(T.why[2].say, /나무 모양이라고 불러요\.$/);
});

test('무르기와 처음으로 뒤에는 앞의 말을 덮는 한마디를 한다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '처음 모습으로 돌아왔어요.');
  assert.match(code, /frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.say\(T\.play\.reset\);/);
});

test('규칙 설명은 세 문장 안이다. 판의 종류마다 있다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  for (const [mode, ask] of Object.entries(T.asks)) for (const rule of Object.values(T.rules)) assert.ok(sentenceCount(`${rule} ${ask}`) <= 3, mode);
  assert.equal(T.rules.one, '줄을 누르면 끊어지고, 끊은 줄을 다시 누르면 이어져요. 그물이 두 조각으로 갈라지지 않게 끊어요.');
  assert.match(code, /ruleLine: \(round\) => `\$\{T\.rules\[startPieces\(round\.board\) > 1 \? 'many' : 'one'\]\} \$\{T\.asks\[round\.mode\]\}`,/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 40);
  assert.ok(sentenceCount(guides[37]) <= 3, guides[37]);
  assert.match(guides[37], /^매듭을 놓고 이웃한 두 매듭을 차례로 누르면 줄이 이어져요\./);
  assert.match(guides[37], /매듭 6개로는 몇 줄까지 끊을 수 있는 그물을 만들 수 있을까요\?$/);
});

test('직접 만들기의 물음: 모눈(6×4)의 점 6개로 만드는 그물은 2줄까지 끊을 수 있다(2×3 네모뿐이다). 모든 6점 묶음을 따져 본다', () => {
  const lattice = grid(6, 4);
  const points = lattice.knots;
  let best = 0;
  let bestShapes = [];
  const choose = (from, picked) => {
    if (picked.length === 6) {
      const index = new Map(picked.map((at, order) => [at, order]));
      const strings = lattice.strings.filter(([a, b]) => index.has(a) && index.has(b)).map(([a, b]) => [index.get(a), index.get(b)]);
      const net = { knots: picked.map((at) => points[at]), strings };
      if (countPieces(net) !== 1) return;
      const most = strings.length - 6 + 1;
      if (most > best) {
        best = most;
        bestShapes = [];
      }
      if (most === best) bestShapes.push(boundsOf(net));
      return;
    }
    for (let at = from; at < points.length; at++) choose(at + 1, [...picked, at]);
  };
  choose(0, []);
  assert.equal(best, 2);
  // 가장 많이 끊는 그물은 2×3이나 3×2 네모뿐이다. 6×4 모눈에 놓을 수 있는 3×2 네모(가로 4·세로 3 자리 = 12가지)와 2×3 네모(가로 5·세로 2 자리 = 10가지)
  for (const box of bestShapes) assert.equal((box.maxX - box.minX + 1) * (box.maxY - box.minY + 1), 6);
  assert.equal(bestShapes.length, 22);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 힌트 1은 함께 쓰는 목록에서 고른다. 까닭은 힌트에 없다', () => {
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '전에 해 본 판 가운데 닮은 판이 있었나요?', '규칙 하나가 없다면 어디까지 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d|하나 적|하나 많|빼면/, hint);
    }
  }
  // 첫 판에 더 작은 판이 없는 판의 힌트 1은 "더 작은 판"이 아니다(짐작하고 끊기, 두 조각 그물, 직접 만든 판은 작은 판이 없을 수 있다)
  for (const key of ['cut', 'guess', 'pieces', 'made']) assert.doesNotMatch(T.hints[key][0], /더 작은 판/);
  // "더 작은 판"을 힌트 1로 쓰는 판에는 늘 작은 판이 있다
  for (const level of [3, 4]) {
    const mode = rungOf(level).mode;
    assert.match(T.hints[mode][0], /더 작은 판/);
    for (let seed = 1; seed <= 60; seed++) {
      const { board: net } = generateBoard(level, seed);
      // 두 그물 견주기는 그물마다 매듭이 다섯이면 작은 판이 없을 수 있다. 그런 판에서도 "더 작은 판으로" 단추가 보이지 않을 뿐이다
      if (mode === 'twins' && net.knots.length <= 10) continue;
      assert.ok(smallBoards({ mode, board: net }).length >= 1, `${level}단계 ${seed}번`);
    }
  }
  assert.match(code, /hints: \(round\) => T\.hints\[round\.mode\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.labels.off, { no: '첫 ' }), '첫 번째 줄, 끊겼어요');
  assert.equal(fill(T.right.twins, { k: 2, n: 3 }), '왼쪽 그물에서 2줄, 오른쪽 그물에서 3줄을 끊었어요.');
  assert.equal(fill(T.make.many, { n: 2, k: 3 }), '그물이 처음부터 2조각이에요. 조각 수가 늘지 않게 3줄까지 끊을 수 있어요.');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /점수|순위|레벨|연속/);
  const short = ['lines', 'labels', 'title', 'levels', 'tool'];
  const spoken = strings.filter(([path]) => !short.some((key) => path === key || path.startsWith(`${key}.`) || path.startsWith(`${key}[`)) && !path.startsWith('status') && !path.endsWith('note'));
  for (const [path, text] of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, `${path}: ${sentence}`);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('"왜 그럴까?": 두 번 끊어도 4줄 → 끝에는 고리가 없다 → 나무 모양 기르기(이름) → 12줄에서 8줄을 빼기 → 두 조각 그물은 하나 더(다른 방법으로 다시 센다)', () => {
  assert.equal(T.why.length, 5);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const net = FIGURES.grid3x3();
  assert.deepEqual([net.knots.length, net.strings.length], [9, 12]);
  const cutSet = (item) => new Set(item.cut ?? []);
  const done = (item) => countPieces(FIGURES[item.board](), cutSet(item)) === countPieces(FIGURES[item.board]()) && !hasLoop(FIGURES[item.board](), cutSet(item));
  const [first, second, third, fourth, fifth] = T.why;
  // 첫 장: 위쪽부터, 아래쪽부터 끊은 두 모습. 둘 다 4줄이고 더 끊을 줄이 없다. 어떤 차례로 끊어도 4줄이다
  assert.ok(first.figures.every(done));
  assert.deepEqual(first.figures.map((item) => item.cut.length), [4, 4]);
  assert.notDeepEqual(first.figures[0].cut, first.figures[1].cut);
  assert.deepEqual(endCounts(net), [4]);
  assert.equal(bruteMaxCut(net), 4);
  // 위쪽부터 끊은 그림은 위의 두 가로줄을, 아래쪽부터 끊은 그림은 아래의 두 가로줄을 끊었다
  const rowOf = (index) => net.knots[net.strings[index][0]][1];
  assert.ok(first.figures[0].cut.every((index) => rowOf(index) <= 1 && net.strings[index][1] - net.strings[index][0] === 1));
  assert.ok(first.figures[1].cut.every((index) => rowOf(index) >= 1 && net.strings[index][1] - net.strings[index][0] === 1));
  assert.match(first.say, /두 번 다 4줄에서 더 끊을 줄이 없었어요\./);
  assert.match(first.say, /어, 왜 늘 같을까요\?$/);
  // 둘째 장: 3줄을 끊은 그림에는 고리가 남아 있고(갈라지지 않았다), 하나 더 끊으면 끝난다
  assert.equal(second.figures[0].loop, true);
  assert.ok(hasLoop(net, cutSet(second.figures[0])));
  assert.equal(countPieces(net, cutSet(second.figures[0])), 1);
  assert.ok(done(second.figures[1]));
  assert.equal(second.figures[1].cut.length, second.figures[0].cut.length + 1);
  // 셋째 장: 기르는 그림은 고리 없이 이어지고, 매듭이 줄보다 하나 많다. 그림의 글과 같다
  for (const item of third.figures) {
    const kept = item.keep ?? net.strings.map((_, index) => index).filter((index) => !cutSet(item).has(index));
    const knots = new Set(kept.flatMap((index) => net.strings[index]));
    const sub = { knots: [...knots].map((knot) => net.knots[knot]), strings: kept.map((index) => net.strings[index].map((knot) => [...knots].indexOf(knot))) };
    assert.equal(countPieces(sub), 1, item.note);
    assert.ok(!hasLoop(sub), item.note);
    assert.equal(knots.size, kept.length + 1, item.note);
    assert.equal(item.note, `매듭 ${knots.size}개, 줄 ${kept.length}개예요`);
  }
  // 넷째 장: 줄 12개, 나무 모양으로 남는 줄 8개, 끊는 줄 4개
  assert.deepEqual(fourth.figures.map((item) => net.strings.length - (item.cut ?? []).length), [12, 8]);
  assert.ok(done(fourth.figures[1]));
  assert.match(fourth.say, /12줄에서 8줄을 뺀 4줄을 끊게 돼요\.$/);
  // 다섯째 장: 처음부터 두 조각인 그물(매듭 16개, 줄 16개)은 1줄이 아니라 2줄. 그림의 모습은 더 끊을 줄이 없는 모습이다
  const two = FIGURES.island44();
  assert.deepEqual([two.knots.length, two.strings.length, countPieces(two)], [16, 16, 2]);
  assert.equal(bruteMaxCut(two), 2);
  assert.deepEqual(endCounts(two), [2]);
  assert.ok(done(fifth.figures[0]));
  assert.equal(fifth.figures[0].cut.length, 2);
  assert.match(fifth.say, /1줄이 아니라 2줄을 끊을 수 있었어요\./);
  assert.match(code, /const FIGURES = \{ grid3x3: \(\) => base\('grid3x3'\), island44: \(\) => island\(4, 4, 0\) \};/);
});

test('풀이와 직접 만들기: 끊는 방법(둘이면 둘 다)을 그리고, 만든 그물은 몇 줄까지 끊을 수 있는지 말한다', () => {
  assert.equal(fill(T.solution.two, { k: 4 }), '이 그물은 4줄까지 끊을 수 있어요. 끊는 방법 두 가지를 그렸어요.');
  assert.equal(fill(T.make.one, { k: 2, n: 5 }), '2줄까지 끊을 수 있어요. 남은 줄은 5개예요.');
  assert.match(code, /const line = result\.max === 0 \? T\.make\.none : result\.pieces > 1 \? fill\(T\.make\.many, \{ n: result\.pieces, k: result\.max \}\) : fill\(T\.make\.one, \{ k: result\.max, n: left \}\);/);
  // 그물을 바꾸면 앞의 대답이 맞지 않으니 말로 덮는다
  assert.match(code, /if \(said\) frame\.talkers\.make\.say\(T\.make\.changed\);/);
  const make = part('id="make-net"', 'id="make-regionmap"');
  for (const id of ['net-make-drop', 'net-make-clear', 'net-make-board', 'net-make-solve', 'net-make-result', 'net-make-play']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="net-make-solve"[^>]*>선생님, 끊어 보세요</);
  assert.match(make, /id="net-make-play"[^>]*>내가 해 볼래요</);
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.doesNotMatch(code, /bestOf/);
  // 끊을 줄이 없는 그물은 해 보지 않는다(처음부터 끝난 판이 된다)
  assert.match(code, /if \(maxCut\(board\) === 0\) \{\s*frame\.talkers\.make\.say\(T\.make\['play-none'\]\);/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 도구, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-net-sample', 'home-net-ask', 'home-net-play', 'home-net-pick', 'home-net-make', 'home-net-blank', 'net-board', 'net-count', 'net-status', 'net-cut', 'net-left', 'net-pieces', 'net-pad', 'net-guess-line', 'net-guess-box', 'net-guess-fewer', 'net-guess-now', 'net-guess-more', 'net-guess-go', 'net-twins-box', 'net-howto', 'net-loop', 'net-again', 'make-net']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="net-title"', '</section>'), /<h2 id="net-title">그물 끊기<\/h2>/);
  assert.ok(visibleText(part('id="net-title"', '</section>')).includes(T.home.ask.cut));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-net-make" class="menu-item"/);
  const pad = part('id="net-pad"', 'id="regionmap-pad"');
  assert.deepEqual([...pad.matchAll(/data-twin="(\w+)">([^<]+)</g)].map((match) => [match[1], match[2]]), [['left', '왼쪽 그물'], ['same', '똑같아요'], ['right', '오른쪽 그물']]);
  assert.match(pad, /id="net-guess-go"[^>]*>이만큼 끊을 것 같아요</);
  assert.match(part('id="net-loop"', 'id="regionmap-left"'), /aria-pressed="false" hidden>고리 찾기</);
  assert.equal(T.tool.off, '고리 찾기');
  // 카드는 핀에 실 감기 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="pins-title"') < html.indexOf('id="net-title"'));
  assert.ok(html.indexOf('id="net-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(핀에 실 감기 다음)
  assert.match(read('src/main.js'), /pins: createPins\(frame\), net: createNet\(frame\), /);
  assert.match(read('src/check-main.js'), /\['net', '그물 끊기'\]/);
  assert.match(read('src/core/smaller.js'), /pins: smallerPins, net: smallerNet, /);
  assert.match(code, /smaller: \(round, turn\) => smallerNet\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기가 있다. 규칙 글은 왼쪽 칸에 둔다
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /ruleAside: true,/);
  // 도구를 처음 켜면 힌트 하나로 센다
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.loopShown \? 1 : 0\),/);
});

/** 줄 둘레에 지름 44픽셀의 동그라미가 들어가는 자리가 있는가: 그 동그라미 안 어디를 눌러도 이 줄이 눌리고, 그림 밖으로 나가지 않는다 */
function roomFor(net, index, unit) {
  const radius = 22 / unit;
  const box = boundsOf(net);
  const pad = 0.5;
  const inside = ([x, y]) => x >= box.minX - pad && x <= box.maxX + pad && y >= box.minY - pad && y <= box.maxY + pad;
  const [a, b] = net.strings[index].map((knot) => net.knots[knot]);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const normal = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
  for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
    for (const off of [0, 0.06, -0.06, 0.12, -0.12, 0.18, -0.18, 0.24, -0.24]) {
      const center = [a[0] + t * (b[0] - a[0]) + off * normal[0], a[1] + t * (b[1] - a[1]) + off * normal[1]];
      const spots = [center, ...Array.from({ length: 24 }, (_, k) => [center[0] + radius * Math.cos((Math.PI * k) / 12), center[1] + radius * Math.sin((Math.PI * k) / 12)])];
      if (spots.every((spot) => inside(spot) && stringAt(net, spot) === index)) return true;
    }
  }
  return false;
}

test('화면: 사다리와 작은 판의 모든 그물에서 줄마다 44픽셀 동그라미가 들어가는 누르는 자리가 있다. 조각은 색만이 아니라 선과 매듭의 모양으로도 갈린다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const pad = Number(board.match(/export const PAD = ([\d.]+);/)[1]);
  assert.equal(pad, 0.5);
  // 판 칸은 1180×820 화면에서 가로 477픽셀, 세로 432픽셀쯤이다(규칙 글이 왼쪽 칸에 있다. 화면에서 재 보았다). 460×420으로 잡는다
  const unitOf = (net) => {
    const box = boundsOf(net);
    return Math.min(460 / (box.maxX - box.minX + 2 * pad), 420 / (box.maxY - box.minY + 2 * pad));
  };
  const seen = new Map();
  for (let level = 1; level <= 5; level++) {
    for (let seed = 1; seed <= 60; seed++) {
      const { board: net } = generateBoard(level, seed);
      seen.set(boardKey(net), net);
      for (const small of smallBoards({ mode: rungOf(level).mode, board: net })) seen.set(boardKey(small), small);
    }
  }
  for (const net of seen.values()) {
    const unit = unitOf(net);
    for (let index = 0; index < net.strings.length; index++) assert.ok(roomFor(net, index, unit), `${net.family} ${JSON.stringify(net.strings[index].map((knot) => net.knots[knot]))} (${unit.toFixed(1)}px)`);
  }
  // 누르는 거리(REACH)는 줄 둘레로 44픽셀 넘게 닿는다(가장 작은 칸에서도)
  const smallest = Math.min(...[...seen.values()].map(unitOf));
  assert.ok(2 * REACH * smallest >= 44, `${2 * REACH * smallest}`);
  // 직접 만들기의 판(가로 477, 세로 397픽셀쯤. 460×380으로 잡는다): 모눈 6×4의 점 사이와 점을 누르는 자리
  const makeUnit = Math.min(460 / (5 + 2 * pad), 380 / (3 + 2 * pad));
  assert.ok(makeUnit >= 44 && 2 * 0.45 * makeUnit >= 44, `${makeUnit}`);
  // 직접 만든 가장 빽빽한 그물(모눈 6×4의 모든 이웃을 이은 것)도 줄마다 누르는 자리가 있다
  const dense = grid(6, 4);
  for (let index = 0; index < dense.strings.length; index++) assert.ok(roomFor(dense, index, unitOf(dense)), `빽빽한 그물 ${index}`);
  // 조각마다의 선 모양: 처음 조각은 실선, 나머지는 저마다 다른 점선. 매듭은 동그라미, 네모, 마름모, 세모
  const dashes = Array.from({ length: 6 }, (_, index) => plain.match(new RegExp(`\\.net-string\\.p${index} \\{([^}]*)\\}`))?.[1].match(/stroke-dasharray:\s*([^;]+);/)?.[1] ?? 'solid');
  assert.equal(dashes[0], 'solid');
  assert.equal(new Set(dashes).size, 6, dashes.join(' | '));
  assert.match(board, /const shape = shade % 4;/);
  assert.match(plain, /\.net-cut line \{[^}]*stroke-dasharray/);
  assert.match(plain, /\.net-loop \{[^}]*stroke-dasharray/);
  assert.match(plain, /\.net-ring \{[^}]*stroke-dasharray/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'net', level: 1, seed: 1, custom: false, mode: 'cut', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: '2', correct: true, guess: null }], wrongCount: 0, moveCount: 2, seconds: 30, solution: { possible: true, max: 2, knots: 5, strings: 6, pieces: 1 }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 판을 한 번 끝까지 한 뒤에 열린다', () => {
  const tuning = tuningFor('net');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.equal(tuning.fastWin, undefined);
  assert.equal(tuning.fastSolo, undefined);
  assert.match(read('src/core/level.js'), /그물 끊기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'net'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'net'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 고리 찾기를 켠 판(힌트 하나)은 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, hintsOpened: 1 })], 'net').offerHarder, false);
  assert.equal(whyUnlocked([], 'net'), false);
  assert.equal(whyUnlocked([finished()], 'net'), true);
  assert.equal(whyUnlocked([{ ...finished(), side: true }], 'net'), false);
  assert.equal(whyUnlocked([{ ...finished(), outcome: 'left' }], 'net'), false);
});
