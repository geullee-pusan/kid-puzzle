// 돼지 주사위 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 따진 것과 맞는지 본다.
// 한 일과 사실만 말한다(먼저 모은 것을 상으로 삼지 않고, 짐작을 맞다 틀리다 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안,
// 색만으로 알리지 않는다, 이름(평균, 기댓값)과 식은 "왜 그럴까?"의 끝 장에서만. 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, generateBoard } from '../src/core/pig-ladder.js';
import { checkBoard } from '../src/core/pig.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteEdge, bruteMatchTally, bruteStopTally, forwardTurnValue, sameFrac } from './helpers/brute-pig.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/pig.json'));
const html = read('index.html');
const code = read('src/formats/pig.js');
const board = read('src/ui/pig-board.js');
const css = read('src/app.css');

const VALUES = { k: 3, f: 2, n: 15, no: '첫 ', total: 30, face: '12, 8, 15' };
const MODES = ['play', 'stop', 'edge', 'match', 'two'];
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'level', 'stops', 'pots', 'pot', 'dice', 'goal', 'n', 'kind'];

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
const pad = part('id="pig-pad"', 'id="seqgrid-pad"');
const own = [part('id="pig-title"', 'id="seqgrid-title"'), part('id="pig-faces"', 'id="why"'), part('id="pig-count"', 'id="seqgrid-count"'), pad, part('id="pig-more"', '</section>'), part('id="make-pig"', 'id="make-seqgrid"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');
const lastWhy = `why[${T.why.length - 1}]`;
const big = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '돼지 주사위');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['선생님과 겨루기', '몇 개에서 멈출까?', '한 번만 더 굴릴까?', '누가 먼저 모을까?', '주사위 둘이면?', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  assert.deepEqual(Object.keys(T.home.ask).sort(), [...MODES].sort());
  assert.deepEqual(Object.keys(T.hints).sort(), [...MODES].sort());
  assert.deepEqual(Object.keys(T.rules).sort(), [...MODES].sort());
  assert.equal(T.home.ask.play, '도토리를 먼저 30개 모아 볼까요?');
  assert.ok(visibleText(part('id="pig-title"', '</section>')).includes(T.home.ask.play));
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말, 이기고 지는 말이 없다. 짐작은 맞다 틀리다 하지 않는다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔|못 맞|졌어요|이겼|이긴|진 판|상을/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋|이겼|졌어요/);
  assert.doesNotMatch(code + board, /Math\.random/);
  // 끝나는 곳은 셋뿐이다: 겨루기에서 한쪽이 먼저 다 모을 때, 실험에서 컴퓨터에게 해 보게 할 때, 한 번 더 굴릴까의 답이 셈과 같을 때
  assert.equal([...code.matchAll(/frame\.finish\(/g)].length, 3);
  assert.match(code, /if \(after\.over\) \{\s*frame\.finish\('solved'\);/);
  assert.match(code, /const correct = solution\.verdict === choice;/);
  // 짐작을 고른 것은 적어 두기만 한다(맞았는지는 기록에만 남는다)
  assert.equal(T.play.picked, '짐작을 적어 두었어요. 컴퓨터에게 해 보게 할 수 있어요.');
  // 판 아래와 오른쪽 칸에는 할 일이나 사실 한 줄만 적는다. 누른 수, 고른 답의 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /wrongCount|moveCount|moreCount|facesCount|tries/, line.trim());
  // 겨루기에서 먼저 다 모은 것은 사실로만 말한다
  assert.equal(fill(T.right.kid, { total: 30, n: 12 }), '바구니와 항아리를 합쳐 먼저 30개가 되었어요. 선생님 항아리에는 12개가 있어요.');
  assert.equal(fill(T.right.teacher, { total: 30, n: 12 }), '선생님이 먼저 30개가 되었어요. 내 항아리에는 12개가 있어요.');
});

test('선생님의 규칙은 말한 그대로다: 판에 늘 적혀 있고, 숨은 수가 없다', () => {
  assert.equal(fill(T.teacherRule, { n: 10 }), '선생님은 바구니가 10개 이상이면 멈춰요.');
  assert.match(code, /teacherRule: fill\(T\.teacherRule, \{ n: board\.teacher \}\),/);
  // 선생님 차례는 핵심 코드(src/core/pig.js)의 규칙대로만 둔다: 멈추는 수 이상이 되면 멈춘다
  assert.match(read('src/core/pig.js'), /if \(basket >= board\.teacher\) \{/);
});

test('규칙 설명은 세 문장 안이고, 1이 나오면 돼지가 바구니를 먹는 것과 멈추면 옮기는 것을 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  for (const [key, rule] of Object.entries(T.rules)) assert.ok(sentenceCount(fill(rule, VALUES)) <= 3, key);
  assert.equal(fill(T.rules.play, { total: 30 }), '주사위를 굴린 눈만큼 도토리를 바구니에 담고, 멈추면 항아리로 옮겨요. 1이 나오면 돼지가 바구니의 도토리를 다 먹고 차례가 넘어가요. 바구니와 항아리를 합쳐 먼저 30개가 되면 끝나요.');
  assert.match(T.rules.stop, /^‘○개에서 멈추기’는 바구니가 ○개 이상이 되면 멈추는 규칙이에요\./);
  assert.match(T.rules.two, /하나라도 1이면 돼지가 다 먹어요\./);
  assert.match(T.rules.match, /먼저 하는 쪽은 판마다 바꿔요\./);
  assert.match(code, /if \(board\.kind === 'play'\) return fill\(T\.rules\.play, \{ total: board\.goal \}\);/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 56);
  const mine = guides[52];
  assert.ok(sentenceCount(mine) <= 3, mine);
  assert.match(mine, /^선생님이 바구니가 몇 개 이상이면 멈출지와 먼저 몇 개를 모을지 정해요\./);
  assert.match(mine, /선생님이 가장 많이 모으게 하려면 몇 개에서 멈추게 할까요\?$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 힌트 1은 함께 쓰는 목록에서 고른다. 까닭과 이름은 힌트에 없다', () => {
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '전에 해 본 판 가운데 닮은 판이 있었나요?', '규칙 하나가 없다면 어디까지 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /평균|기댓값|20개|200|25가지|11가지/, hint);
    }
  }
  assert.match(code, /hints: \(round\) => T\.hints\[hintKey\(round\)\],/);
  assert.match(code, /const hintKey = \(round\) => \(round\.mode === 'edge' && round\.board\.dice === 2 \? 'two' : round\.mode\);/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다. 수 뒤에는 받침과 상관없는 말만 붙인다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
    assert.doesNotMatch(text, /\{(k|n|f|total|no)\}(이|가(?!지)|은|는|을|를|과|와|으로|로|예요|이에요)/, path);
  }
  // 판 아래의 한 줄은 한 줄에 들어간다(스무 자 안쪽)
  for (const [key, text] of Object.entries(T.status)) assert.ok([...text].length <= 20, key);
  assert.ok([...fill(T.labels.basket, { n: 40 })].length <= 20);
  // 겨룬 결과는 두 쪽을 한 문장에 적는다
  const face = [fill(T.right['match-part'], { k: 10, n: 321 }), fill(T.right['match-part'], { k: 20, n: 679 })].join(', ');
  assert.equal(fill(T.right.match, { total: '1,000', face }), '1,000판 가운데 10개에서 멈추는 쪽이 321판, 20개에서 멈추는 쪽이 679판을 먼저 모았어요.');
});

test('화면 글에 영어 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속|시간|초 /);
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.rules), T.teacherRule, ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.entries(T.right).filter(([key]) => key !== 'match-part').map(([, text]) => text), ...['play', 'stop', 'match'].map((key) => T.solution[key]), ...['intro', 'result', 'best', 'not-best', 'changed'].map((key) => T.make[key]), ...T.why.map((slide) => slide.say), T.side.open, T.labels['faces-one'], T.labels['faces-two']];
  for (const text of spoken) for (const sentence of sentences(fill(text, VALUES))) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('이름(평균, 기댓값)과 식은 "왜 그럴까?"의 끝 장에서만 말한다. 규칙 글, 힌트, 판, 앞의 장에는 없다', () => {
  for (const [path, text] of strings) {
    if (path.startsWith(lastWhy)) continue;
    assert.doesNotMatch(text, /평균|기댓값|확률|공식|[×÷]|20 −/, `${path}: ${text}`);
  }
  assert.doesNotMatch(own, /평균|기댓값|확률|[×÷]/);
  assert.doesNotMatch(code + board, /평균|기댓값/);
  assert.match(T.why.at(-1).say, /평균이라고 해요\./);
  assert.match(T.why.at(-1).say, /기댓값이라고 불러요\./);
  assert.match(T.why.at(-1).say, /20 − 바구니예요\.$/);
  assert.deepEqual(T.why.at(-1).heads, ['바구니', '더하는 수', '잃는 수', '20 − 바구니']);
});

test('"왜 그럴까?": 그림의 수가 말과 맞고, 다른 방법으로 따져도 같다', () => {
  assert.equal(T.why.length, 6);
  for (const slide of T.why) {
    assert.ok(sentenceCount(slide.say) <= 3, slide.say);
    assert.equal(slide.figures.length, 1);
  }
  // 첫 장: 1,000 차례씩 해 본 결과(같은 시드 난수로 다른 코드가 다시 굴린다). 20개가 가장 많고, 30개는 20개보다 적다
  const [stops] = T.why[0].figures;
  const tally = bruteStopTally(stops.stops, stops.n, stops.seed);
  const at = (stop) => tally.find((item) => item.stop === stop).total;
  assert.match(T.why[0].say, new RegExp(`30개에서 멈추면 ${big(at(30))}개, 20개에서 멈추면 ${big(at(20))}개였어요\\.$`));
  assert.equal(Math.max(...tally.map((item) => item.total)), at(20));
  assert.ok(at(30) < at(20));
  assert.equal(stops.note, '멈추는 수마다 1,000 차례 모은 도토리예요');
  // 둘째~넷째 장: 바구니 10, 30, 20개. 다섯 눈이 20개를 더하고, 1은 바구니를 잃는다
  assert.deepEqual(T.why.slice(1, 4).map((slide) => slide.figures[0].pot), [10, 30, 20]);
  for (const slide of T.why.slice(1, 4)) {
    const { pot, dice } = slide.figures[0];
    const counted = bruteEdge(dice, pot);
    assert.equal(slide.figures[0].note, `${counted.gain}개를 더하고 ${counted.lose}개를 잃어요`);
  }
  assert.deepEqual(T.why.slice(1, 4).map((slide) => bruteEdge(1, slide.figures[0].pot).verdict), ['more', 'less', 'same']);
  // 넷째 장의 "20개에서 멈추면 가장 많이 모아요"는 셈으로 맞다(1~60개 가운데 20개보다 많이 모으는 수가 없다)
  assert.match(T.why[3].say, /20개에서 멈추면 여러 번 했을 때 가장 많이 모아요\./);
  const twenty = forwardTurnValue(20);
  for (let stop = 1; stop <= 60; stop++) {
    const value = forwardTurnValue(stop);
    assert.ok(value.num * twenty.den <= twenty.num * value.den, String(stop));
  }
  assert.ok(sameFrac(forwardTurnValue(21), twenty));
  // 다섯째 장: 먼저 30개 모으기 1,000판(같은 시드 난수로 다른 코드가 다시 겨룬다)
  const [match] = T.why[4].figures;
  const wins = bruteMatchTally(match.stops, match.goal, match.n, match.seed);
  assert.match(T.why[4].say, new RegExp(`30개에서 멈추는 쪽이 ${wins[1]}판, 20개에서 멈추는 쪽이 ${wins[0]}판 먼저 모았어요\\.`));
  assert.ok(wins[1] > wins[0]);
  // 끝 장의 표: 바구니마다 더하는 수 20, 잃는 수는 바구니, 20 − 바구니만큼 늘거나 준다
  const [table] = T.why[5].figures;
  assert.deepEqual(table.pots, [10, 20, 30]);
  for (const pot of table.pots) assert.deepEqual([bruteEdge(1, pot).gain, bruteEdge(1, pot).lose], [20, pot]);
  assert.equal(fill(T.why[5].cells.more, { n: 10 }), '10개 늘어요');
  assert.equal(fill(T.why[5].cells.less, { n: 10 }), '10개 줄어요');
  assert.match(code, /fill\(slide\.cells\[verdict\], \{ n: Math\.abs\(gain - lose\) \}\)/);
  // "왜 그럴까?"는 이 형식의 판을 한 번 끝까지 한 뒤에 열린다
  assert.equal(tuningFor('pig').whyAfter, 'finished');
});

test('끝났을 때와 풀이, 직접 만들기의 말은 셈으로 구한 사실이다', () => {
  assert.equal(fill(T.right['edge-one'], { n: 10 }), '눈 여섯 가지 가운데 2부터 6까지는 모두 합쳐 20개를 더하고, 1 하나는 10개를 잃어요.');
  assert.equal(fill(T.right['edge-two'], { k: 11 * 19 }), '36가지 가운데 1이 없는 25가지는 모두 합쳐 200개를 더해요. 1이 있는 11가지는 모두 209개를 잃어요.');
  assert.match(code, /fill\(T\.right\['edge-two'\], \{ k: solution\.lose \}\)/);
  assert.match(code, /T\.right\[`\$\{solution\.verdict\}-verdict`\]/);
  // 직접 만들기: 가장 많이 모으는지는 셈으로(20개와 기댓값이 같은가)
  assert.match(code, /const best = compareFrac\(turnValue\(draft\.teacher\), turnValue\(20\)\) === 0;/);
  assert.equal(T.make.best, '따져 보면 이보다 더 많이 모으는 멈추는 수는 없어요.');
  assert.equal(T.make['not-best'], '따져 보면 20개에서 멈추는 쪽이 더 많이 모아요.');
  const make = part('id="make-pig"', 'id="make-seqgrid"');
  for (const id of ['pig-make-teacher-less', 'pig-make-teacher', 'pig-make-teacher-more', 'pig-make-goal-less', 'pig-make-goal', 'pig-make-goal-more', 'pig-make-board', 'pig-make-solve', 'pig-make-result', 'pig-make-play']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="pig-make-solve"[^>]*>선생님, 해 보세요</);
  assert.match(make, /id="pig-make-play"[^>]*>내가 겨뤄 볼래요</);
  assert.match(code, /\n {4}madeBoard: madeNow,\n/);
  // 풀이 종이의 셈: 가장 많이 모으는 수, 더 자주 먼저 모으는 쪽
  assert.match(code, /fill\(T\.solution\.stop, \{ n: solution\.best\[0\] \}\)/);
  assert.match(code, /fill\(T\.solution\.match, \{ n: board\.stops\[side\] \}\)/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 도구, 끝난 뒤의 단추, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-pig-sample', 'home-pig-ask', 'home-pig-play', 'home-pig-pick', 'home-pig-make', 'home-pig-blank', 'pig-board', 'pig-count', 'pig-status', 'pig-pad', 'pig-play-box', 'pig-roll', 'pig-stop', 'pig-pick-box', 'pig-picks', 'pig-picked', 'pig-run-box', 'pig-run', 'pig-edge-box', 'pig-try', 'pig-answers', 'pig-faces', 'pig-more', 'make-pig']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="pig-title"', '</section>'), /<h2 id="pig-title">돼지 주사위<\/h2>/);
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-pig-make" class="menu-item"/);
  assert.match(pad, /id="pig-roll"[^>]*>굴리기</);
  assert.match(pad, /id="pig-stop"[^>]*>멈추기</);
  for (const [choice, text] of Object.entries(T.verdicts)) assert.match(pad, new RegExp(`data-choice="${choice}">${text}<`));
  assert.match(html, /id="pig-more"[^>]*>더 많이 해 보기</);
  // 도구는 왼쪽 칸의 "왜 그럴까?" 바로 위에 있다
  const side = part('<section class="side" aria-label="힌트">', '</section>');
  assert.ok(side.indexOf('id="nopay-rows"') < side.indexOf('id="pig-faces"'));
  assert.ok(side.indexOf('id="pig-faces"') < side.indexOf('id="why"'));
  // 카드는 낼 수 없는 금액 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="nopay-title"') < html.indexOf('id="pig-title"'));
  assert.ok(html.indexOf('id="pig-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(낼 수 없는 금액 다음)
  assert.match(read('src/main.js'), /nopay: createNopay\(frame\), pig: createPig\(frame\), /);
  assert.match(read('src/check-main.js'), /\['pig', '돼지 주사위'\]/);
  assert.match(read('src/core/smaller.js'), /nopay: smallerNopay, pig: smallerPig, /);
  assert.match(code, /smaller: \(round, turn\) => smallerPig\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 처음으로는 쓰지 않는다(굴린 눈은 무를 수 없다)
  assert.match(code, /\$\('undo'\)\.hidden = true;\s*\$\('reset'\)\.hidden = true;/);
  // 시계와 스스로 넘어가는 것이 없다. 선생님 차례는 기다리지 않고 바로 그린다
  assert.doesNotMatch(board + code, /setInterval|setTimeout|requestAnimationFrame/);
  // 도구는 처음 켤 때 힌트 하나로 센다
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.facesShown \? 1 : 0\),/);
  assert.match(code, /ruleAside: true,/);
});

test('화면: 판에는 누르는 것이 없고(단추는 모두 오른쪽 칸과 왼쪽 칸의 넓은 단추), 흔들림은 짧고 줄일 수 있다. 1과 돼지가 먹은 것은 색만이 아니라 모양으로도 보인다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = (selector) => plain.match(new RegExp(`\\n${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))[1];
  assert.doesNotMatch(board, /createElement\('button'\)|el\('button'/);
  // 짐작 단추와 답은 큰 단추(64픽셀 넘게), 굴리기와 멈추기는 아주 큰 단추
  assert.match(code, /button\.className = 'btn big';/);
  assert.match(pad, /id="pig-roll" class="btn primary huge"/);
  assert.match(pad, /id="pig-stop" class="btn good huge"/);
  // 굴릴 때의 흔들림은 0.35초이고, 움직임을 줄이는 설정이면 없다
  assert.match(block('.pg-die.rolling'), /animation: pg-roll 0\.35s/);
  assert.match(plain, /@media \(prefers-reduced-motion: reduce\) \{\s*\.pg-die\.rolling \{\s*animation: none;/);
  // 1은 돼지 코(콧구멍 둘), 돼지가 먹은 바구니와 눈은 빗금과 점선 테두리
  assert.match(board, /'pg-snout'/);
  assert.equal([...board.matchAll(/'pg-nostril'/g)].length, 2);
  assert.match(block('.pg-basket.eaten'), /dashed/);
  assert.match(block('.pg-face-cell.lose'), /repeating-linear-gradient/);
  assert.match(block('.pg-face-cell.lose'), /dashed/);
  // 짐작으로 고른 막대는 점선 테두리와 글
  assert.match(block('.pg-bar-line.mine'), /dashed/);
  assert.match(board, /el\('span', 'pg-mine', row\.mineLabel\)/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'pig', level: 1, seed: 1, custom: false, mode: 'play', outcome: 'solved', hintsOpened: 0, answers: [], wrongCount: 0, moveCount: 14, seconds: 120, winner: 'teacher', solution: { possible: true, kind: 'play' }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. 겨루기에서 먼저 모았는지는 보지 않는다', () => {
  const tuning = tuningFor('pig');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.fastWin, undefined);
  assert.equal(tuning.fastSolo, undefined);
  assert.match(read('src/core/level.js'), /돼지 주사위\(모두 임시\)/);
  assert.deepEqual(recommend([], 'pig'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  // 먼저 모은 쪽이 선생님이어도 끝까지 한 판은 끝까지 한 판이다
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'pig'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, winner: 'kid', seconds: 400 })], 'pig').offerHarder, false);
  // 한 번 더 굴릴까에서 셈과 다른 답을 고른 판은 "한 번에"가 아니다
  const edge = (id, wrongCount) => finished({ id, level: 3, mode: 'edge', winner: undefined, wrongCount, seconds: 60 });
  assert.equal(recommend([edge(3, 0), edge(4, 1)], 'pig').offerHarder, false);
  assert.equal(recommend([edge(3, 0), edge(4, 0)], 'pig').offerHarder, true);
  assert.equal(whyUnlocked([], 'pig'), false);
  assert.equal(whyUnlocked([finished()], 'pig'), true);
  assert.equal(whyUnlocked([{ ...finished(), side: true }], 'pig'), false);
  assert.match(code, /winner: state\.winner,/);
});
