// 가로세로 수열 퍼즐 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 따진 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다,
// 수학의 이름(등차수열, 공차)은 "왜 그럴까?"의 마지막 장에서만. 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, generateBoard } from '../src/core/seqgrid-ladder.js';
import { checkBoard, stepSolve } from '../src/core/seqgrid.js';
import { endsClosed, fill, sentenceCount } from '../src/core/text.js';
import { bruteOptions, bruteSearch } from './helpers/brute-seqgrid.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/seqgrid.json'));
const html = read('index.html');
const code = read('src/formats/seqgrid.js');
const board = read('src/ui/seqgrid-board.js');
const css = read('src/app.css');

const VALUES = { k: 7, f: 15, n: 2, no: '첫 ', face: '위에서 첫 번째 가로줄', total: 12 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'board', 'cells', 'mark', 'ring', 'order', 'table', 'level'];

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
const pad = part('id="seqgrid-pad"', 'id="domino-pad"');
const own = [part('id="seqgrid-title"', 'id="make-title"'), part('id="seqgrid-count"', 'id="fold-count"'), pad, part('id="make-seqgrid"', '<script')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');
const lastWhy = `why[${T.why.length - 1}]`;
const end = (number) => (endsClosed(number) ? 'c' : 'o');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '가로세로 수열 퍼즐');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(
    T.levels.map((item) => item.level),
    LADDER.map((rung) => rung.level),
  );
  assert.deepEqual(
    T.levels.map((item) => item.name),
    ['3×3 판', '가장 작거나 큰 수', '검은 칸', '4×4 판', '5×5 판', '직접 만들기'],
  );
  for (const entry of T.levels) assert.ok(entry.picture.blank === true || Number.isInteger(entry.picture.seed), entry.name);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['black', 'cross', 'ends', 'five', 'three']);
});

test('한 일과 사실만 말한다. 다 찬 줄이 맞지 않으면 그 줄의 수를 크기순으로, 간격과 함께 그대로 말한다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  const gaps = (sorted, face = '위에서 2번째 가로줄') => {
    const steps = sorted.slice(1).map((value, index) => value - sorted[index]);
    return fill(T.play[`gaps-${end(sorted.at(-1))}${end(steps.at(-1))}`], { face, k: sorted.join(', '), n: steps.join(', ') });
  };
  assert.equal(gaps([7, 10, 17]), '위에서 2번째 가로줄의 수를 크기순으로 놓으면 7, 10, 17이에요. 간격은 3, 7이에요.');
  assert.equal(gaps([2, 4, 9]), '위에서 2번째 가로줄의 수를 크기순으로 놓으면 2, 4, 9예요. 간격은 2, 5예요.');
  assert.equal(gaps([3, 5, 9, 12]), '위에서 2번째 가로줄의 수를 크기순으로 놓으면 3, 5, 9, 12예요. 간격은 2, 4, 3이에요.');
  assert.equal(gaps([1, 6, 10]), '위에서 2번째 가로줄의 수를 크기순으로 놓으면 1, 6, 10이에요. 간격은 5, 4예요.');
  assert.equal(fill(T.play[`twice-${end(5)}`], { face: '왼쪽에서 3번째 세로줄', k: 5 }), '왼쪽에서 3번째 세로줄에 5가 두 번 있어요.');
  assert.equal(fill(T.play[`twice-${end(7)}`], { face: '왼쪽에서 3번째 세로줄', k: 7 }), '왼쪽에서 3번째 세로줄에 7이 두 번 있어요.');
  assert.match(code, /return fill\(T\.play\[`gaps-\$\{end\(sorted\.at\(-1\)\)\}\$\{end\(gaps\.at\(-1\)\)\}`\], \{ face, k: sorted\.join\(', '\), n: gaps\.join\(', '\) \}\);/);
  assert.match(code, /frame\.say\(`\$\{T\.play\.full\} \$\{lineFact\(line\)\}`\);/);
  assert.equal(T.play.full, '빈칸을 모두 채웠어요.');
  assert.match(T.play['same-again'], /다른 빈칸부터 볼 수도 있어요\.$/);
  assert.equal(fill(T.status['typing-c'], { k: 11 }), '11을 넣으려면 넣기를 눌러요');
  assert.equal(fill(T.status['typing-o'], { k: 15 }), '15를 넣으려면 넣기를 눌러요');
  assert.doesNotMatch(code, /Math\.random/);
  assert.doesNotMatch(board, /Math\.random/);
  // 판 아래에는 채운 칸과 남은 빈칸만 적는다. 지우거나 무른 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|eraseCount|lineCount|fullCount|wrongCount|moveCount/, line.trim());
});

test('무르기, 처음으로, 지우기 뒤에는 앞의 말을 덮는 한마디를 한다. 선생님이 말한 줄이 맞게 바뀌면 그렇다고 말한다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '넣은 수를 모두 지웠어요.');
  assert.equal(T.play.erase, '고른 칸을 비웠어요.');
  assert.match(code, /frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.say\(T\.play\.reset\);/);
  assert.match(code, /return how === 'erase' \? T\.play\.erase : null;/);
  assert.equal(fill(T.play['now-ok'], { face: '왼쪽에서 3번째 세로줄' }), '왼쪽에서 3번째 세로줄의 간격이 이제 모두 같아요.');
});

test('규칙 설명은 세 문장 안이다. 검은 칸이 있는 판은 검은 칸을 빼고 본다고 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['black', 'plain']);
  for (const [key, rule] of Object.entries(T.rules)) {
    assert.ok(sentenceCount(rule) <= 3, key);
    assert.match(rule, /^빈칸에 수를 넣어요\. 가로줄과 세로줄마다 /, key);
    assert.match(rule, /크기순으로 놓으면 간격이 모두 같아요\. 한 줄에 같은 수는 두 번 들어가지 않아요\.$/, key);
  }
  assert.match(T.rules.black, /검은 칸을 빼고/);
  assert.doesNotMatch(T.rules.plain, /검은 칸/);
  assert.match(code, /const hintKey = \(round\) => \(round\.board\.black\.length > 0 \? 'black' : 'plain'\);/);
  assert.match(code, /ruleLine: \(round\) => T\.rules\[hintKey\(round\)\],/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 54);
  const mine = guides[53];
  assert.ok(sentenceCount(mine) <= 3, mine);
  assert.match(mine, /1부터 99까지의 수로 채우는 방법을 세어 봐요\./);
  assert.match(mine, /적힌 수를 몇 개까지 줄여도 답이 한 가지뿐일까요\?$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 방법이나 이름을 말해 버리지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['black', 'plain']);
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '전에 해 본 판 가운데 닮은 판이 있었나요?', '규칙 하나가 없다면 어디까지 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    // 힌트 1은 모든 형식이 함께 쓰는 짧은 목록에서, 힌트 2는 어디를 볼지
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d|가운데|작은 쪽|큰 쪽|등차|공차/, hint);
    }
  }
  assert.match(code, /hints: \(round\) => T\.hints\[hintKey\(round\)\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.labels.cell, { no: '첫 ', k: 2, face: fill(T.labels.given, { k: 6 }) }), '위에서 첫 번째 줄, 왼쪽에서 2번째 칸, 적힌 수 6');
  assert.equal(fill(T.labels.row, { no: '3' }), '위에서 3번째 가로줄');
  assert.equal(fill(T.labels.col, { no: '첫 ' }), '왼쪽에서 첫 번째 세로줄');
  // 적힌 수와 넣은 수는 다른 이름으로 읽는다
  assert.notEqual(T.labels.given.replace('{k}', ''), T.labels.number.replace('{k}', ''));
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속|빨리/);
  assert.doesNotMatch(said, /점수|순위|레벨|연속|빨리|서둘/);
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.rules), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), ...Object.values(T.solution), ...Object.entries(T.make).filter(([key]) => !['size', 'other'].includes(key)).map(([, text]) => text), ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  assert.match(T.make.other, /요$/);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('수학의 이름(등차수열, 공차)은 "왜 그럴까?"의 마지막 장에서만 말한다. 식, n번째 항, 공식은 어디에도 없다', () => {
  const before = strings.filter(([path]) => !path.startsWith(lastWhy)).map(([, text]) => text).join(' ');
  assert.doesNotMatch(before.replace(T.title, ''), /수열|등차|공차|항|n번째|공식/);
  assert.doesNotMatch(own.replaceAll(T.title, ''), /수열|등차|공차|공식/);
  const named = strings.filter(([, text]) => /등차|공차/.test(text)).map(([path]) => path);
  assert.ok(named.length > 0 && named.every((path) => path.startsWith(lastWhy)), named.join(', '));
  for (const [path, text] of strings) if (path.startsWith(lastWhy)) assert.doesNotMatch(text, /항|n번째|공식|[=+×÷]/, path);
  assert.match(T.why.at(-1).say, /수학에서는 등차수열이라고 불러요\. 그 간격은 공차라고 불러요\. 수열 길 퍼즐에서도 만난 이름이에요\.$/);
  assert.doesNotMatch(visibleText(html), /등차|공차/);
});

test('"왜 그럴까?": 가운데 수를 넣었다가 세로줄이 어긋난 이야기 → 두 수가 허락하는 세 곳과 두 줄의 겹침 → 한 칸이 다음 칸을 정한다 → 이름', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [one, two, three, four] = T.why.map((slide) => slide.figures[0]);
  const story = one.board;
  for (const item of [two, four]) assert.deepEqual(item.board, story);
  // 이야기의 판은 답이 하나뿐이다(1부터 60까지 다른 방법으로 센다)
  const answer = bruteSearch(story, 60, 2);
  assert.equal(answer.count, 1);
  assert.deepEqual(answer.answers[0], [3, 15, 9, 7, 13, 10, 11, 14, 8]);
  // 첫 장: 3과 9 사이에 6을 넣으면 세로줄은 6, 13, 14(간격 7과 1)
  assert.deepEqual(story.givens.slice(0, 3), [3, null, 9]);
  assert.deepEqual(one.cells, [3, 6, 9, 7, 13, null, 11, 14, 8]);
  assert.deepEqual([one.cells[1], one.cells[4], one.cells[7]].sort((a, b) => a - b), [6, 13, 14]);
  assert.deepEqual(one.mark, { rows: [], cols: [1] });
  assert.match(T.why[0].say, /6, 13, 14가 되었어요\. 간격이 7과 1이라서 같지 않아요\.$/);
  // 둘째 장: 가로줄의 3과 9로는 6이나 15, 세로줄의 13과 14로는 12나 15, 둘 다에 있는 수는 15뿐
  assert.equal(two.table, 1);
  assert.deepEqual(bruteOptions([3, 9], 3, 60), [6, 15]);
  assert.deepEqual(bruteOptions([13, 14], 3, 60), [12, 15]);
  assert.deepEqual(answer.answers[0][1], 15);
  assert.match(T.why[1].say, /가로줄의 3과 9로는 6이나 15이고, 세로줄의 13과 14로는 12나 15예요\. 둘 다에 있는 수는 15뿐이에요\.$/);
  assert.deepEqual(T.table.head, ['두 수', '작은 쪽', '가운데', '큰 쪽']);
  // 표의 세 곳은 화면 코드가 계산한다(작은 쪽, 가운데, 큰 쪽. 1보다 작거나 자연수가 아니면 없어요)
  assert.match(code, /const low = 2 \* a - b;\s*const mid = \(a \+ b\) \/ 2;\s*const high = 2 \* b - a;/);
  assert.match(code, /Number\.isInteger\(value\) && value >= 1 \? String\(value\) : T\.table\.none/);
  // 셋째 장: 둘째 가로줄의 7과 2로는 12만, 그러면 오른쪽 세로줄에 4와 12가 생겨 그 아래 빈칸이 8로 정해진다
  const chainBoard = three.board;
  const chainAnswer = bruteSearch(chainBoard, 60, 2);
  assert.equal(chainAnswer.count, 1);
  assert.deepEqual(chainAnswer.answers[0], three.cells);
  assert.deepEqual(bruteOptions([7, 2], 3, 99), [12]);
  assert.deepEqual(bruteOptions([4, 12], 3, 99), [8, 20]);
  assert.deepEqual(bruteOptions([12, 10], 3, 99), [8, 11, 14]);
  const chain = stepSolve(chainBoard);
  assert.deepEqual(
    chain.steps.map((step) => [step.cell, step.value, step.by]),
    [
      [5, 12, 'row'],
      [8, 8, 'both'],
    ],
  );
  assert.deepEqual(three.order, { 5: 1, 8: 2 });
  assert.deepEqual(three.mark, { rows: [], cols: [2] });
  // 넷째 장: 맨 위 가로줄은 3, 9, 15로 간격이 6
  assert.deepEqual(four.cells, answer.answers[0]);
  assert.deepEqual([four.cells[0], four.cells[1], four.cells[2]].sort((a, b) => a - b), [3, 9, 15]);
  assert.equal(four.note, '맨 위 가로줄은 3, 9, 15로 공차가 6이에요');
});

test('풀이와 직접 만들기: 답이 없는지, 하나뿐인지, 여럿인지 말하고(1부터 99까지), 여럿이면 채우는 방법 둘을 그려 보인다', () => {
  assert.equal(T.solution.one, '이 판의 답은 한 가지뿐이에요. 칸 구석의 작은 수는 그 칸이 정해지는 차례예요.');
  assert.match(code, /const result = countSolutions\(board, \{ limit: 2, max: MAX_VALUE, budget: MAKE_BUDGET \}\);/);
  assert.match(code, /nodes = \[rowOf\(result\.examples\.map\(\(cells\) => gridCard\(view\(cells\), T\.make\.other\)\)\)\];/);
  assert.equal(T.make.none, '1부터 99까지의 수로는 이 판을 채울 수 없어요.');
  assert.equal(T.make.one, '1부터 99까지의 수로 채우는 방법은 한 가지뿐이에요.');
  assert.equal(fill(T.make.count, { n: 6 }), '적힌 수는 6개예요.');
  assert.equal(fill(T.make.fewest, { n: 5 }), '이 크기에서 지금까지 가장 적게 적은 것은 5개예요.');
  const make = part('id="make-seqgrid"', '<script');
  for (const id of ['seqgrid-make-fewer', 'seqgrid-make-n', 'seqgrid-make-more', 'seqgrid-make-clear', 'seqgrid-make-black', 'seqgrid-make-shown', 'seqgrid-make-keys', 'seqgrid-make-board', 'seqgrid-make-solve', 'seqgrid-make-result', 'seqgrid-make-play', 'seqgrid-make-picture']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="seqgrid-make-solve"[^>]*>선생님, 답이 몇 가지예요\?</);
  assert.match(make, /id="seqgrid-make-play"[^>]*>내가 해 볼래요</);
  assert.match(make, /id="seqgrid-make-black"[^>]*aria-pressed="false">검은 칸으로 바꾸기</);
  // 직접 만든 판: 빈칸이 있고 채울 수 있어야 해 보거나 남긴다. 약속에 맞게 채우면 어느 것이든 끝난다
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.doesNotMatch(code, /bestOf/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 숫자판, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-seqgrid-sample', 'home-seqgrid-ask', 'home-seqgrid-play', 'home-seqgrid-pick', 'home-seqgrid-make', 'home-seqgrid-blank', 'seqgrid-board', 'seqgrid-count', 'seqgrid-status', 'seqgrid-filled', 'seqgrid-left', 'seqgrid-pad', 'seqgrid-shown', 'seqgrid-keys', 'make-seqgrid']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="seqgrid-title"', '</section>'), /<h2 id="seqgrid-title">가로세로 수열 퍼즐<\/h2>/);
  assert.ok(visibleText(part('id="seqgrid-title"', '</section>')).includes(T.home.ask.three));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-seqgrid-make" class="menu-item"/);
  assert.match(visibleText(pad), /빈칸을 누르고 숫자를 누른 뒤 넣기를 눌러요\./);
  assert.deepEqual(
    [...pad.matchAll(/data-key="(\w+)"/g)].map((match) => match[1]),
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'erase', '0', 'enter'],
  );
  assert.deepEqual(
    [...part('id="seqgrid-make-keys"', '</section>').matchAll(/data-key="(\w+)"/g)].map((match) => match[1]),
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'erase', '0', 'enter'],
  );
  assert.doesNotMatch(pad, /불가능해요/);
  // 카드는 돼지 주사위 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="pig-title"') < html.indexOf('id="seqgrid-title"'));
  assert.ok(html.indexOf('id="seqgrid-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(형식 목록의 맨 뒤, 돼지 주사위 다음)
  assert.match(read('src/main.js'), /pig: createPig\(frame\), seqgrid: createSeqgrid\(frame\) \};/);
  assert.match(read('src/check-main.js'), /\['seqgrid', '가로세로 수열 퍼즐'\]/);
  assert.match(read('src/core/smaller.js'), /pig: smallerPig, seqgrid: smallerSeqgrid \};/);
  assert.match(code, /smaller: \(round, turn\) => smallerSeqgrid\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기가 있다. 5×5 판은 위아래로 커서 규칙 글은 왼쪽 칸에 둔다
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /ruleAside: true,/);
  // 판을 그리는 조각은 글을 적지 않는다. 타이머가 없다
  assert.doesNotMatch(board + code, /setInterval|setTimeout|requestAnimationFrame/);
});

test('화면: 칸과 숫자판 단추는 44픽셀보다 작아지지 않는다. 적힌 수, 검은 칸, 고른 칸, 누르고 있는 수는 색만이 아니라 무늬와 테두리로도 보인다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(plain, /\n\.sg-cell \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
  // 칸 하나의 크기: 판 칸에 맞추되 96픽셀을 넘지 않는다. 1180×820 화면의 판 칸(가로세로 480픽셀 남짓)에서 5×5 판이어도 44픽셀보다 크다
  const [, top, share] = plain.match(/\.sg-board\.live \{[^}]*--s: min\((\d+)px, calc\(\(100cqh - 24px\) \/ \(var\(--n\) \+ ([\d.]+)\)\)/);
  assert.equal(Number(top), 96);
  assert.ok((480 - 24) / (5 + Number(share)) >= 44);
  assert.match(plain, /\.sg-keys \.key \{\s*min-height: 56px;/);
  assert.match(plain, /\.sg-cell\.picked \{[^}]*border: 5px solid/);
  assert.match(plain, /\.sg-cell\.picked::after \{[^}]*border: 3px dashed/);
  assert.match(plain, /\.sg-cell\.given::before \{[^}]*border-radius: 50%;/);
  assert.match(plain, /\.sg-cell\.black \{\s*background: repeating-linear-gradient/);
  assert.match(plain, /\.sg-typing \{[^}]*border-bottom: 3px dashed/);
  for (const name of ["'sg-cell'", "'black'", "'given'", "'picked'", "'cross'", "'sg-typing'", "'sg-art-hatch'"]) assert.ok(board.includes(name), name);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'seqgrid', level: 1, seed: 1, custom: false, mode: 'three', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'fill:1', correct: true, guess: null }], wrongCount: 0, moveCount: 3, seconds: 40, solution: { possible: true, count: 1 }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 판을 한 번 끝까지 한 뒤에 열린다', () => {
  const tuning = tuningFor('seqgrid');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.equal(tuning.fastWin, undefined);
  assert.equal(tuning.fastSolo, undefined);
  assert.match(read('src/core/level.js'), /가로세로 수열 퍼즐\(모두 임시\)/);
  assert.deepEqual(recommend([], 'seqgrid'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'seqgrid'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 빈칸을 모두 채운 첫 모습이 답이 아니면 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'seqgrid').offerHarder, false);
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, seconds: 200 })], 'seqgrid').offerHarder, false);
  assert.equal(whyUnlocked([], 'seqgrid'), false);
  assert.equal(whyUnlocked([finished()], 'seqgrid'), true);
  assert.equal(whyUnlocked([finished({ side: true })], 'seqgrid'), false);
  assert.match(code, /round\.wrongCount \+= 1;/);
  assert.match(code, /solution: \{ possible: solution\.possible, count: solution\.count \},/);
});
