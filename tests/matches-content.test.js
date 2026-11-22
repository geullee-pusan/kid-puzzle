// 성냥개비 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 센 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다.
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, generateBoard } from '../src/core/matches-ladder.js';
import { MAX_SIDE, checkBoard, fullGrid, vEdge } from '../src/core/matches.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { PAD } from '../src/ui/matches-board.js';
import { bruteSquares, edgeName } from './helpers/brute-matches.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/matches.json'));
const html = read('index.html');
const code = read('src/formats/matches.js');
const board = read('src/ui/matches-board.js');
const css = read('src/app.css');

const VALUES = { k: 2, f: 3, n: 5, no: '첫 ', face: '위에서 첫 번째 줄의 가로 자리, 왼쪽에서 2번째', total: 276 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'w', 'h', 'outline', 'gone', 'side', 'r', 'c', 'level'];

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
const own = [part('id="matches-title"', 'id="fair-title"'), part('id="matches-outline"', 'id="fair-table"'), part('id="matches-count"', 'id="fair-count"'), part('id="matches-pad"', 'id="fair-pad"'), part('id="make-matches"', 'id="make-fair"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '성냥개비');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['작은 판에서 빼기', '3×3 판에서 빼기', '옮겨서 맞추기', '모두 변이 되게 빼기', '모두 변이 되게 옮기기', '직접 만들기']);
  for (const entry of T.levels) assert.ok(entry.picture.blank === true || Number.isInteger(entry.picture.seed), entry.name);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  // 처음 화면의 물음은 판의 종류마다 있다
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['grid', 'little', 'move', 'shift', 'tidy']);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말이 없다. k개를 빼거나 옮겼는데 할 일과 다르면 정사각형의 수를 그대로 말한다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.equal(fill(T.play['count-remove'], { k: 2, n: 4 }), '성냥을 2개 뺐어요. 지금 정사각형은 4개예요.');
  assert.equal(fill(T.play['count-move'], { k: 3, n: 6 }), '성냥을 3개 옮겼어요. 지금 정사각형은 6개예요.');
  assert.equal(fill(T.play.loose, { n: 5, k: 1 }), '정사각형은 5개인데, 어느 정사각형의 변도 아닌 성냥이 1개 있어요.');
  assert.match(code, /if \(squares !== board\.n\) frame\.say\(fill\(T\.play\[`count-\$\{board\.kind\}`\], \{ k: board\.k, n: squares \}\)\);/);
  assert.match(code, /else frame\.say\(fill\(T\.play\.loose, \{ n: squares, k: looseMatches\(board\.w, board\.h, round\.on\)\.length \}\)\);/);
  assert.match(T.play['same-again'], /^아까 해 본 모습과 같아요\./);
  // 이미 k개를 뺐거나 옮겼으면 더 하지 않고 그 사실을 판 아래에 적는다(어떻게 되돌리는지 함께)
  assert.equal(fill(T.status['limit-remove'], { k: 2 }), '벌써 2개를 뺐어요. 뺀 자리를 누르면 돌아와요');
  assert.equal(fill(T.status['limit-move'], { k: 2 }), '벌써 2개를 옮겼어요. 옮겨 온 성냥은 다시 옮길 수 있어요');
  assert.doesNotMatch(code, /Math\.random/);
  assert.doesNotMatch(board, /Math\.random/);
  // 판 아래에는 지금 정사각형과 뺀(옮긴) 성냥의 수만 적는다. 무른 수나 해 본 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|limitCount|fullCount|wrongCount|moveCount|takeCount|backCount|shiftCount/, line.trim());
  assert.equal([...part('id="matches-count"', 'id="fair-count"').matchAll(/<strong/g)].length, 3);
  assert.match(visibleText(part('id="matches-count"', 'id="fair-count"')), /지금 정사각형\s+0\s+개/);
});

test('무르기와 처음으로 뒤에는 앞의 말을 덮는 한마디를 한다. 선생님이 모습에 기댄 말을 한 뒤 모습이 바뀌면 지금 정사각형의 수로 덮는다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '처음 모습으로 돌아왔어요.');
  assert.match(code, /frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.say\(T\.play\.reset\);/);
  assert.equal(fill(T.play.now, { n: 3 }), '이제 정사각형은 3개예요.');
  assert.match(code, /if \(told\) \{\s*told = false;\s*frame\.say\(fill\(T\.play\.now, \{ n: countSquares\(board\.w, board\.h, next\) \}\)\);/);
  // 무르기와 처음으로는 앞의 말을 이미 덮었으므로 told를 지운다
  assert.equal([...code.matchAll(/told = false;/g)].length >= 4, true);
});

test('규칙 설명은 세 문장 안이다. 큰 정사각형도 센다고, 약속이 있는 판은 약속을 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['move', 'move-tidy', 'remove', 'remove-tidy']);
  for (const [key, rule] of Object.entries(T.rules)) {
    assert.ok(sentenceCount(rule) <= 3, key);
    assert.match(rule, /^성냥 \{k\}개를 (빼서 정사각형이 딱 \{n\}개 남게|옮겨서 정사각형이 딱 \{n\}개가 되게) 해요\./, key);
    assert.match(rule, /큰 정사각형도 세요\./, key);
  }
  assert.match(T.rules.remove, /테두리가 다 성냥이면 안에 성냥이 있어도 정사각형이에요\.$/);
  assert.match(T.rules['remove-tidy'], /남은 성냥은 모두 어떤 정사각형의 변이어야 해요\./);
  assert.match(T.rules['move-tidy'], /성냥은 모두 어떤 정사각형의 변이어야 해요\./);
  assert.equal(fill(T.rules.remove, { k: 1, n: 3 }), '성냥 1개를 빼서 정사각형이 딱 3개 남게 해요. 큰 정사각형도 세요. 테두리가 다 성냥이면 안에 성냥이 있어도 정사각형이에요.');
  assert.match(code, /const ruleKey = \(board\) => \(board\.tidy \? `\$\{board\.kind\}-tidy` : board\.kind\);/);
  assert.match(code, /ruleLine: \(round\) => fill\(T\.rules\[ruleKey\(round\.board\)\], \{ k: round\.board\.k, n: round\.board\.n \}\),/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 49);
  assert.ok(sentenceCount(guides[32]) <= 3, guides[32]);
  assert.match(guides[32], /^빈 자리를 누르면 성냥이 놓이고, 성냥을 누르면 없어져요\./);
  assert.match(guides[32], /할 일대로 되는 방법이 딱 하나뿐인 판도 만들 수 있을까요\?$/);
  // 누르는 법은 오른쪽 칸에 적는다
  assert.match(visibleText(part('id="matches-remove-box"', 'id="matches-move-box"')), /성냥을 누르면 빠지고, 뺀 자리를 누르면 돌아와요\./);
  assert.match(visibleText(part('id="matches-move-box"', 'id="matches-size-box"')), /성냥을 누르고 빈 자리를 누르면 옮겨져요\./);
  assert.match(visibleText(part('id="matches-move-box"', 'id="matches-size-box"')), /점선 테두리는 성냥이 처음 있던 자리예요\./);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 힌트 1은 함께 쓰는 목록에서 고른다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['grow', 'remove', 'shrink', 'tidy']);
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d|크기마다 나누어 세기/, hint);
    }
  }
  assert.match(code, /hints: \(round\) => T\.hints\[hintKey\(round\.board\)\],/);
  assert.match(code, /return board\.n >= countSquares\(board\.w, board\.h, board\.matches\) \? 'grow' : 'shrink';/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.labels.h, { no: '첫 ', k: 2 }), '위에서 첫 번째 줄의 가로 자리, 왼쪽에서 2번째');
  assert.equal(fill(T.labels.board, { n: 3, k: 2 }), '가로 3칸, 세로 2칸의 성냥 판');
  assert.equal(fill(T.sizes.line, { k: 2, n: 4 }), '한 변이 성냥 2개인 것이 4개예요.');
  assert.equal(fill(T.make.many, { total: 276, n: 4 }), '모든 방법 276가지를 해 보았어요. 그 가운데 4가지가 할 일대로 돼요. 한 가지를 그려 볼게요.');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속/);
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.rules), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), T.solution.one, T.solution.more, T.solution.none, ...Object.values(T.sizes), ...Object.entries(T.make).filter(([key]) => !['size', 'count', 'other'].includes(key)).map(([, text]) => text), ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const text of [T.make.other, T.solution['note-remove'], T.solution['note-move']]) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

/** "왜 그럴까?"의 그림 하나가 보여 주는 성냥(모두 채운 모눈에서 빠진 것을 뺀다) */
function figureEdges(item) {
  const gone = new Set((item.gone ?? []).map((spot) => (spot.side === 'v' ? `세로 ${spot.c},${spot.r}` : `가로 ${spot.c},${spot.r}`)));
  return fullGrid(item.w, item.h).filter((edge) => !gone.has(edgeName(item.w, item.h, edge)));
}

test('"왜 그럴까?": 크기를 정해 놓고 세기 → 한 변이 2개, 3개인 것 → 크기마다 나누어 세기(이름) → 성냥 하나가 빠진 판(글자로 찾아 다시 센다)', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const bySize = (item) => {
    const found = bruteSquares(item.w, item.h, figureEdges(item));
    return [1, 2, 3].map((size) => found.filter((square) => square.size === size).length);
  };
  const [first, second, third, fourth] = T.why;
  // 첫 장: 3×3 판은 성냥 24개, 한 변이 1개인 것 9개
  assert.equal(figureEdges(first.figures[0]).length, 24);
  assert.match(first.figures[0].note, /성냥 24개로 만든 3×3 판이에요/);
  assert.deepEqual(first.figures[1].outline, [1]);
  assert.equal(bySize(first.figures[1])[0], 9);
  assert.match(first.figures[1].note, /한 변이 성냥 1개인 것은 9개예요/);
  // 둘째 장: 한 변이 2개인 것 4개(왼쪽 위 모서리가 가로 2곳, 세로 2곳), 3개인 것 1개
  assert.deepEqual(second.figures.map((item) => item.outline), [[2], [3]]);
  assert.equal(bySize(second.figures[0])[1], 4);
  assert.equal((3 - 2 + 1) * (3 - 2 + 1), 4);
  assert.equal(bySize(second.figures[1])[2], 1);
  assert.match(second.say, /가로로 2곳, 세로로 2곳에 둘 수 있어서 4개예요\./);
  // 셋째 장: 9 + 4 + 1 = 14. 이름은 여기서 처음 말한다
  assert.deepEqual(bySize(third.figures[0]), [9, 4, 1]);
  assert.match(third.say, /9 \+ 4 \+ 1로 모두 14개예요\./);
  assert.match(third.say, /크기마다 나누어 세기라고 불러요\./);
  assert.match(third.figures[0].note, /모두 14개예요/);
  // 넷째 장: 맨 위 줄의 가운데 왼쪽 세로 성냥이 빠지면 작은 것 둘과 한 변이 2개인 것 하나가 없어져 7 + 3 + 1 = 11
  const gone = fourth.figures[0];
  assert.deepEqual(gone.gone, [{ side: 'v', r: 0, c: 1 }]);
  assert.equal(figureEdges(gone).length, 23);
  assert.deepEqual(bySize(gone), [7, 3, 1]);
  assert.match(fourth.say, /작은 것 둘과 한 변이 2개인 것 하나가 함께 없어져요\./);
  assert.match(fourth.say, /7 \+ 3 \+ 1로 11개예요\.$/);
  assert.match(gone.figures?.note ?? gone.note, /모두 11개예요/);
  assert.match(code, /spot\.side === 'v' \? vEdge\(item\.w, item\.h, spot\.r, spot\.c\)/);
  assert.equal(edgeName(3, 3, vEdge(3, 3, 0, 1)), '세로 1,0');
  // 이름은 "왜 그럴까?"의 셋째 장부터만 말한다
  for (const [path, text] of strings) if (!path.startsWith('why[2]') && !path.startsWith('why[3]')) assert.doesNotMatch(text, /크기마다 나누어 세기/, path);
});

test('풀이와 직접 만들기: 방법의 수와 한 가지 방법을 보이고, 안 되는 판은 모든 방법을 해 보고 없다고 말한다', () => {
  assert.equal(fill(T.solution.more, { n: 4 }), '이렇게 하면 돼요. 이렇게 되는 방법은 모두 4가지예요.');
  assert.equal(fill(T.make.none, { total: 10626 }), '모든 방법 10626가지를 다 해 보았는데, 할 일대로 되는 방법은 없어요.');
  assert.match(code, /if \(result\.count === 0\) line = fill\(T\.make\.none, \{ total: result\.ways \}\);/);
  // 할 일대로 되는 방법이 있는 판만 해 보거나 공책에 남긴다
  assert.match(code, /return solutionOf\(board\)\.possible \? board : null;/);
  const make = part('id="make-matches"', 'id="make-fair"');
  for (const id of ['matches-make-fewer', 'matches-make-n', 'matches-make-more', 'matches-make-full', 'matches-make-clear', 'matches-make-now', 'matches-make-remove', 'matches-make-move', 'matches-make-k-less', 'matches-make-k', 'matches-make-k-more', 'matches-make-n-less', 'matches-make-target', 'matches-make-n-more', 'matches-make-tidy', 'matches-make-board', 'matches-make-solve', 'matches-make-result', 'matches-make-play', 'matches-make-picture']) {
    assert.ok(make.includes(`id="${id}"`), id);
  }
  assert.match(make, /id="matches-make-solve"[^>]*>선생님, 몇 가지예요\?</);
  assert.match(make, /id="matches-make-play"[^>]*>내가 해 볼래요</);
  assert.match(make, /id="matches-make-tidy"[^>]*aria-pressed="false">남는 성냥 없이</);
  // 직접 만든 판: 할 일대로 되면 어느 방법이든 끝난다
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.doesNotMatch(code, /bestOf/);
  assert.equal(MAX_SIDE, 4);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 도구, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-matches-sample', 'home-matches-ask', 'home-matches-play', 'home-matches-pick', 'home-matches-make', 'home-matches-blank', 'matches-board', 'matches-count', 'matches-status', 'matches-squares', 'matches-removed', 'matches-moved', 'matches-pad', 'matches-remove-box', 'matches-move-box', 'matches-size-box', 'matches-size-list', 'matches-outline', 'make-matches']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="matches-title"', '</section>'), /<h2 id="matches-title">성냥개비<\/h2>/);
  assert.ok(visibleText(part('id="matches-title"', '</section>')).includes(T.home.ask.little));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-matches-make" class="menu-item"/);
  assert.doesNotMatch(visibleText(part('id="matches-pad"', 'id="fair-pad"')), /불가능해요|안 돼요/);
  assert.match(part('id="matches-outline"', 'id="fair-table"'), /aria-pressed="false" hidden>정사각형 모두 보기</);
  // 카드는 세모 피하기 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="sim-title"') < html.indexOf('id="matches-title"'));
  assert.ok(html.indexOf('id="matches-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(세모 피하기 다음)
  assert.match(read('src/main.js'), /sim: createSim\(frame\), matches: createMatches\(frame\), /);
  assert.match(read('src/check-main.js'), /\['matches', '성냥개비'\]/);
  assert.match(read('src/core/smaller.js'), /sim: smallerSim, matches: smallerMatches, /);
  assert.match(code, /smaller: \(round, turn\) => smallerMatches\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기가 있다. 판이 정사각형에 가까워 규칙 글은 왼쪽 칸에 둔다
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /ruleAside: true,/);
  // 판을 그리는 조각은 글을 적지 않는다. 타이머가 없다
  assert.doesNotMatch(board + code, /setInterval|setTimeout|requestAnimationFrame/);
  // 도구를 처음 켜면 힌트 하나로 센다
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.outlineShown \? 1 : 0\),/);
});

test('화면: 변마다 누르는 마름모가 44픽셀보다 크다. 성냥, 빈 자리, 처음 자리, 옮겨 온 성냥, 고른 성냥, 정사각형의 크기는 색만이 아니라 모양으로도 보인다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // 판 칸은 1180×820 화면에서 높이 430픽셀쯤(놀이 판), 직접 만들기는 규칙 글 아래라 385픽셀쯤이다(화면에서 재 보았다).
  // 380픽셀로 잡아도 가장 큰 4×4 모눈(직접 만들기와 그 판을 해 볼 때)의 칸 한 변은 380 / (4 + 2 × 여백)
  // 마름모(대각선이 칸 한 변)에 들어가는 가장 큰 원의 지름은 칸 한 변 ÷ √2다
  const unit = 380 / (MAX_SIDE + 2 * PAD);
  assert.ok(unit / Math.SQRT2 >= 44, String(unit / Math.SQRT2));
  assert.match(board, /const points = at\.horizontal/);
  assert.match(board, /'mt-hit'/);
  assert.match(plain, /\.mt-svg \{[^}]*max-width: 640px;[^}]*max-height: 640px;/);
  // 모양: 빈 자리와 처음 자리는 점선, 옮겨 온 성냥은 점선 띠, 고른 성냥은 점선 고리, 정사각형은 크기마다 선의 모양이 다르다
  assert.match(plain, /\.mt-slot \{[^}]*stroke-dasharray/);
  assert.match(plain, /\.mt-ghost \{[^}]*stroke-dasharray/);
  assert.match(plain, /\.mt-moved \{[^}]*stroke-dasharray/);
  assert.match(plain, /\.mt-pick \{[^}]*stroke-dasharray/);
  const dashes = [2, 3, 4].map((size) => plain.match(new RegExp(`\\.mt-square\\.size-${size} \\{[^}]*stroke-dasharray: ([^;]+);`))[1]);
  assert.equal(new Set(dashes).size, 3);
  assert.doesNotMatch(plain.match(/\.mt-square\.size-1 \{[^}]*\}/)[0], /dasharray/);
  for (const name of ["'mt-stick'", "'mt-head'", "'mt-slot'", "'mt-ghost'", "'mt-moved'", "'mt-pick'", 'mt-square size-']) assert.ok(board.includes(name), name);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'matches', level: 1, seed: 1, custom: false, mode: 'little', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'edges:1', correct: true, guess: null }], wrongCount: 0, moveCount: 1, seconds: 30, solution: { possible: true, count: 12, ways: 12 }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 판을 한 번 끝까지 한 뒤에 열린다', () => {
  const tuning = tuningFor('matches');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.equal(tuning.fastWin, undefined);
  assert.match(read('src/core/level.js'), /성냥개비\(모두 임시\)/);
  assert.deepEqual(recommend([], 'matches'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'matches'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // k개를 빼거나 옮긴 첫 모습이 답이 아니면 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'matches').offerHarder, false);
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, seconds: 200 })], 'matches').offerHarder, false);
  assert.equal(whyUnlocked([], 'matches'), false);
  assert.equal(whyUnlocked([finished()], 'matches'), true);
  assert.equal(whyUnlocked([finished({ side: true })], 'matches'), false);
  assert.match(code, /round\.wrongCount \+= 1;/);
  assert.match(code, /solution: \{ possible: solution\.possible, count: solution\.count, ways: solution\.ways \},/);
});
