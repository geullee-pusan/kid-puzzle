// 곱 단서 퍼즐 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 따진 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다.
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, generateBoard } from '../src/core/product-ladder.js';
import { checkBoard, oneWay } from '../src/core/product.js';
import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { endsClosed, fill, sentenceCount } from '../src/core/text.js';
import { bruteFactorPairs, matchingPairings, pairingCount } from './helpers/brute-product.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/product.json'));
const html = read('index.html');
const code = read('src/formats/product.js');
const board = read('src/ui/product-board.js');
const css = read('src/app.css');

const VALUES = { k: 7, f: 15, n: 2, no: '첫 ', face: '위에서 첫 번째 가로줄', total: 12 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'board', 'cells', 'mark', 'table', 'level'];

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
const own = [part('id="product-title"', 'id="sim-title"'), part('id="product-pairs"', 'id="why"'), part('id="product-count"', 'id="sim-count"'), part('id="product-pad"', 'id="sim-pad"'), part('id="make-product"', 'id="make-sim"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '곱 단서 퍼즐');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['3×3 판', '4×4 판', '두 가지로 갈리는 단서', '숨은 단서', '5×5 판', '직접 만들기']);
  for (const entry of T.levels) assert.ok(entry.picture.blank === true || Number.isInteger(entry.picture.seed), entry.name);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  // 처음 화면의 물음은 판의 종류마다 있다
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['few', 'five', 'four', 'hidden', 'small']);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말이 없다. 줄의 곱이 다르면 두 수의 곱과 단서를 그대로 말한다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  // 곱이 다른 줄: "3 × 4는 12인데, 단서는 15예요." 수 뒤에 붙는 말은 받침을 보고 고른다
  const off = (a, b, clue, face = '위에서 2번째 가로줄') => fill(T.play[`off-${endsClosed(b) ? 'c' : 'o'}${endsClosed(clue) ? 'c' : 'o'}`], { face, k: a, n: b, total: a * b, f: clue });
  assert.equal(off(3, 4, 15), '위에서 2번째 가로줄의 3 × 4는 12인데, 단서는 15예요.');
  assert.equal(off(2, 6, 18), '위에서 2번째 가로줄의 2 × 6은 12인데, 단서는 18이에요.');
  assert.equal(off(5, 7, 30), '위에서 2번째 가로줄의 5 × 7은 35인데, 단서는 30이에요.');
  assert.equal(off(1, 9, 12), '위에서 2번째 가로줄의 1 × 9는 9인데, 단서는 12예요.');
  assert.match(code, /fill\(T\.play\[`off-\$\{end\(b\)\}\$\{end\(line\.clue\)\}`\], \{ face: lineName\(line\.kind, line\.index\), k: a, n: b, total: line\.product, f: line\.clue \}\)/);
  assert.equal(fill(T.status['move-c'], { k: 6 }), '6을 이 칸으로 옮겼어요');
  assert.equal(fill(T.status['move-o'], { k: 4 }), '4를 이 칸으로 옮겼어요');
  // 수를 모두 놓았는데 맞지 않으면 어느 줄인지 말한다(사실 하나)
  assert.match(T.play['full-off'], /^수를 모두 놓았어요\. \{face\}의 두 수의 곱이 단서와 달라요\.$/);
  assert.match(T.play['full-count'], /^수를 모두 놓았어요\. \{face\}에는 수가 \{n\}개 있어요\.$/);
  assert.match(T.play['same-again'], /다른 단서부터 볼 수도 있어요\.$/);
  assert.doesNotMatch(code, /Math\.random/);
  assert.doesNotMatch(board, /Math\.random/);
  // 판 아래에는 놓은 수와 남은 수만 적는다. 지우거나 무른 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|eraseCount|shiftCount|offCount|fullCount|wrongCount|moveCount/, line.trim());
});

test('무르기, 처음으로, 지우기 뒤에는 앞의 말을 덮는 한마디를 한다. 선생님이 말한 줄이 바뀌면 지금 모습을 말한다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '놓은 수를 모두 지웠어요.');
  assert.equal(T.play.erase, '고른 칸을 비웠어요.');
  assert.match(code, /frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.say\(T\.play\.reset\);/);
  assert.match(code, /return how === 'erase' \? T\.play\.erase : null;/);
  assert.match(code, /if \(line\.state === 'ok' && line\.clue !== null\) return fill\(T\.play\['now-ok'\], \{ face \}\);/);
  assert.equal(fill(T.play.now, { face: '왼쪽에서 3번째 세로줄', n: 1 }), '왼쪽에서 3번째 세로줄에는 이제 수가 1개 있어요.');
});

test('규칙 설명은 세 문장 안이다. 숨은 단서가 있는 판은 물음표를 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['full', 'hidden']);
  for (const [key, rule] of Object.entries(T.rules)) {
    assert.ok(sentenceCount(rule) <= 3, key);
    assert.match(rule, /^1부터 \{n\}까지의 수를 한 번씩 넣어요\. 가로줄과 세로줄마다 딱 두 수가 들어가요\./, key);
  }
  assert.match(T.rules.hidden, /물음표는 숨은 단서예요\.$/);
  assert.equal(fill(T.rules.full, { n: 8 }), '1부터 8까지의 수를 한 번씩 넣어요. 가로줄과 세로줄마다 딱 두 수가 들어가요. 판 밖의 수는 그 줄 두 수의 곱이에요.');
  assert.match(code, /const ruleKey = \(round\) => \(hiddenCount\(round\.board\) > 0 \? 'hidden' : 'full'\);/);
  assert.match(code, /ruleLine: \(round\) => fill\(T\.rules\[ruleKey\(round\)\], \{ n: numbersOf\(round\.board\.n\) \}\),/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 54);
  assert.ok(sentenceCount(guides[30]) <= 3, guides[30]);
  assert.match(guides[30], /곱을 몇 개 숨겨도 답이 한 가지뿐인 판을 만들 수 있을까요\?$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 방법을 말해 버리지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['full', 'hidden']);
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    // 힌트 1은 모든 형식이 함께 쓰는 짧은 목록에서, 힌트 2는 어디를 볼지
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d|한 가지로 갈리는 단서부터/, hint);
    }
  }
  assert.match(code, /hints: \(round\) => T\.hints\[ruleKey\(round\)\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  const cell = fill(T.labels.cell, { no: '첫 ', k: 2, face: fill(T.labels.number, { k: 6 }) });
  assert.equal(cell, '위에서 첫 번째 줄, 왼쪽에서 2번째 칸, 수 6');
  assert.equal(fill(T.labels.row, { no: '3' }), '위에서 3번째 가로줄');
  assert.equal(fill(T.pairs.title, { k: 12 }), '곱이 12인 두 수');
  assert.equal(fill(T.pairs.pair, { k: 3, n: 4 }), '3 × 4');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속/);
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.rules), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), ...Object.values(T.solution), T.pairs.note, T.pairs.hidden, ...Object.entries(T.make).filter(([key]) => !['size', 'other'].includes(key)).map(([, text]) => text), ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  assert.match(T.make.other, /요$/);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('"왜 그럴까?": 칸 대신 단서 보기 → 한 가지로 갈리는 두 줄이 만나는 칸 → 한 가지로 갈리는 단서부터 보기(이름) → 가로줄만으로는 두 가지가 남는 판', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [one, two, three, four] = T.why.map((slide) => slide.figures[0]);
  const story = one.board;
  // 이야기의 판은 답이 하나뿐이다(짝 지어 보기로 다시 센다)
  const answer = pairingCount(story);
  assert.equal(answer.count, 1);
  const [cells] = answer.answers;
  assert.equal(story.n, 4);
  // 첫 장: 단서마다 곱이 되는 두 수의 표. 두 가지로 갈리는 단서는 12뿐이다
  assert.equal(one.table, true);
  const clues = [...story.rows, ...story.cols];
  assert.deepEqual([...new Set(clues.filter((clue) => bruteFactorPairs(clue, 8).length === 2))], [12]);
  assert.ok(clues.every((clue) => bruteFactorPairs(clue, 8).length >= 1));
  assert.equal(one.note, '두 가지로 갈리는 단서는 12뿐이에요');
  assert.match(code, /pairsOf\(clue, board\.n\)/);
  // 둘째 장: 맨 위 가로줄의 7은 1 × 7뿐, 맨 왼쪽 세로줄의 14는 2 × 7뿐이고, 두 줄이 만나는 칸(맨 왼쪽 위)에 7이 들어간다
  for (const item of [two, three]) assert.deepEqual(item.board, story);
  assert.deepEqual(bruteFactorPairs(story.rows[0], 8), [[1, 7]]);
  assert.deepEqual(bruteFactorPairs(story.cols[0], 8), [[2, 7]]);
  assert.equal(cells[0], 7);
  assert.deepEqual(two.cells, [7, ...new Array(15).fill(null)]);
  assert.deepEqual(two.mark, { rows: [0], cols: [0] });
  assert.match(T.why[1].say, /맨 위 가로줄의 7은 1 × 7로만 갈려요\. 맨 왼쪽 세로줄의 14도 2 × 7뿐이에요\./);
  assert.doesNotMatch(T.why[1].say, /한 가지로 갈리는 단서부터 보기/);
  // 셋째 장: 둘째 가로줄의 12는 두 가지, 셋째 가로줄의 15는 3 × 5뿐이라 12는 2 × 6이다. 이름은 여기서 처음 말한다
  assert.equal(story.rows[1], 12);
  assert.equal(story.rows[2], 15);
  assert.deepEqual(bruteFactorPairs(12, 8), [
    [2, 6],
    [3, 4],
  ]);
  assert.deepEqual(bruteFactorPairs(15, 8), [[3, 5]]);
  assert.deepEqual(
    cells
      .slice(4, 8)
      .filter((value) => value !== null)
      .sort((a, b) => a - b),
    [2, 6],
  );
  assert.deepEqual(three.mark, { rows: [1, 2], cols: [] });
  assert.equal(three.note, '둘째 가로줄의 12는 2 × 6이에요');
  assert.match(T.why[2].say, /한 가지로 갈리는 단서부터 보기라고 불러요\.$/);
  // 넷째 장: 가로줄의 단서만으로는 두 가지로 나뉘지만(짝 지어 보기로 센다), 세로줄의 단서만으로는 한 가지다.
  // 세로줄의 14는 2 × 7, 12는 3 × 4, 6은 1 × 6으로 정해지고, 1과 6이 같은 가로줄에 있을 수 없어서 가로줄의 6은 2 × 3이다
  const other = four.board;
  const second = pairingCount(other);
  assert.equal(second.count, 1);
  assert.equal(matchingPairings(other.rows, 4).length, 2);
  assert.equal(matchingPairings(other.cols, 4).length, 1);
  const [colSplit] = matchingPairings(other.cols, 4);
  assert.deepEqual(colSplit[other.cols.indexOf(14)], [2, 7]);
  assert.deepEqual(colSplit[other.cols.indexOf(6)], [1, 6]);
  assert.equal(other.rows[1], 6);
  assert.deepEqual(
    second.answers[0]
      .slice(4, 8)
      .filter((value) => value !== null)
      .sort((a, b) => a - b),
    [2, 3],
  );
  assert.deepEqual(four.mark, { rows: [1], cols: [other.cols.indexOf(6)] });
  assert.match(T.why[3].say, /가로줄의 6은 2 × 3이에요\.$/);
  // 이름은 "왜 그럴까?"의 셋째 장부터만 말한다
  for (const [path, text] of strings) if (!path.startsWith('why[2]') && !path.startsWith('why[3]')) assert.doesNotMatch(text, /한 가지로 갈리는 단서부터 보기/, path);
  assert.equal(oneWay(7, 4), true);
});

test('풀이와 직접 만들기: 답이 하나뿐인지 여럿인지 말하고, 여럿이면 아이가 놓은 것과 다른 답 하나를 그려 보인다', () => {
  assert.equal(T.solution.one, '이 단서에 맞는 답은 한 가지뿐이에요. 이렇게 놓아요.');
  assert.match(code, /const result = countSolutions\(board, \{ limit: MAKE_LIMIT \+ 1, budget: MAKE_BUDGET \}\);/);
  assert.match(code, /const other = result\.examples\.find\(\(cells\) => !sameCells\(cells, draft\.cells\)\) \?\? null;/);
  assert.equal(fill(T.make.over, { n: 20 }), '이 단서에 맞는 답이 20가지가 넘어요. 다른 답 하나를 그려 볼게요.');
  assert.equal(fill(T.make.veiled, { n: 2 }), '단서를 2개 숨겼어요.');
  const make = part('id="make-product"', 'id="make-sim"');
  for (const id of ['product-make-fewer', 'product-make-n', 'product-make-more', 'product-make-clear', 'product-make-show', 'product-make-keys', 'product-make-board', 'product-make-solve', 'product-make-result', 'product-make-play', 'product-make-picture']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="product-make-solve"[^>]*>선생님, 답이 몇 가지예요\?</);
  assert.match(make, /id="product-make-play"[^>]*>내가 해 볼래요</);
  assert.deepEqual([...part('id="product-make-keys"', '</section>').matchAll(/data-n="(\w+)"/g)].map((match) => match[1]), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'erase']);
  // 직접 만든 판: 줄마다 두 수씩 다 놓아야 해 보거나 남긴다. 단서에 맞는 답이면 어느 것이든 끝난다
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.doesNotMatch(code, /bestOf/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 숫자판, 도구, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-product-sample', 'home-product-ask', 'home-product-play', 'home-product-pick', 'home-product-make', 'home-product-blank', 'product-board', 'product-count', 'product-status', 'product-placed', 'product-left', 'product-pad', 'product-keys', 'product-pair-box', 'product-pair-list', 'product-pairs', 'make-product']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="product-title"', '</section>'), /<h2 id="product-title">곱 단서 퍼즐<\/h2>/);
  assert.ok(visibleText(part('id="product-title"', '</section>')).includes(T.home.ask.small));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-product-make" class="menu-item"/);
  const pad = part('id="product-pad"', 'id="sim-pad"');
  assert.match(visibleText(pad), /판에 놓은 수를 고르면 그 수가 고른 칸으로 옮겨 와요\./);
  assert.deepEqual([...pad.matchAll(/data-n="(\w+)"/g)].map((match) => match[1]), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'erase']);
  assert.doesNotMatch(pad, /불가능해요/);
  assert.match(part('id="product-pairs"', 'id="why"'), /aria-pressed="false" hidden>곱이 되는 두 수 보기</);
  // 카드는 팬케이크 뒤집기 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="pancake-title"') < html.indexOf('id="product-title"'));
  assert.ok(html.indexOf('id="product-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(팬케이크 뒤집기 다음)
  assert.match(read('src/main.js'), /pancake: createPancake\(frame\), product: createProduct\(frame\), /);
  assert.match(read('src/check-main.js'), /\['product', '곱 단서 퍼즐'\]/);
  assert.match(read('src/core/smaller.js'), /pancake: smallerPancake, product: smallerProduct, /);
  assert.match(code, /smaller: \(round, turn\) => smallerProduct\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기가 있다. 5×5 판은 위아래로 커서 규칙 글은 왼쪽 칸에 둔다
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /ruleAside: true,/);
  // 판을 그리는 조각은 글을 적지 않는다. 타이머가 없다
  assert.doesNotMatch(board + code, /setInterval|setTimeout|requestAnimationFrame/);
  // 도구를 처음 켜면 힌트 하나로 센다
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.pairsShown \? 1 : 0\),/);
});

test('화면: 칸과 단서는 44픽셀보다 작아지지 않는다. 고른 칸, 단서의 맞음과 다름, 숨은 단서, 놓은 수는 색만이 아니라 테두리와 무늬로도 보인다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(plain, /\n\.pd-cell \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
  assert.match(plain, /\n\.pd-clue \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
  // 칸 하나의 크기: 판 칸에 맞추되 92픽셀을 넘지 않는다. 1180×820 화면의 판 칸(가로세로 500픽셀 남짓)에서 5×5 판이어도 44픽셀보다 크다
  const [, top, share] = plain.match(/--s: min\((\d+)px, calc\(\(100cqh - 24px\) \/ \(var\(--n\) \+ ([\d.]+)\)\)/);
  assert.equal(Number(top), 92);
  assert.ok((480 - 24) / (5 + Number(share)) >= 44);
  assert.match(plain, /\.pd-cell\.picked \{[^}]*border: 5px solid/);
  assert.match(plain, /\.pd-cell\.picked::after \{[^}]*border: 3px dashed/);
  assert.match(plain, /\.pd-clue\.is-ok \{\s*border: 5px solid/);
  assert.match(plain, /\.pd-clue\.is-off,\s*\.pd-clue\.is-many \{\s*border: 4px dashed/);
  assert.match(plain, /\.pd-clue\.hidden-clue \{\s*border-style: dashed;/);
  assert.match(plain, /\.pd-keys \.key\.used,\s*\.pd-make-keys \.key\.used \{[^}]*text-decoration: underline/);
  for (const name of ["'pd-cell'", "'pd-clue'", 'is-${state}', 'hidden-clue', 'picked', 'cross']) assert.ok(board.includes(name), name);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'product', level: 1, seed: 1, custom: false, mode: 'small', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'place:1', correct: true, guess: null }], wrongCount: 0, moveCount: 6, seconds: 40, solution: { possible: true, count: 1 }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 판을 한 번 끝까지 한 뒤에 열린다', () => {
  const tuning = tuningFor('product');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.match(read('src/core/level.js'), /곱 단서 퍼즐\(모두 임시\)/);
  assert.deepEqual(recommend([], 'product'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'product'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 수를 모두 놓은 첫 모습이 답이 아니면 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'product').offerHarder, false);
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, seconds: 200 })], 'product').offerHarder, false);
  assert.equal(whyUnlocked([], 'product'), false);
  assert.equal(whyUnlocked([finished()], 'product'), true);
  assert.equal(whyUnlocked([finished({ side: true })], 'product'), false);
  assert.match(code, /round\.wrongCount \+= 1;/);
  assert.match(code, /solution: \{ possible: solution\.possible, count: solution\.count \},/);
});
