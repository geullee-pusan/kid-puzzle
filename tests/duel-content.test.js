// 누가 이길까 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 판과 수와 주장이 풀이 프로그램과 맞는지 본다.
// 첫 판은 실패할 수 없다, 이기고 진 횟수를 세어 보여 주지 않는다, 끝났을 때는 누가 마지막 수를 두었는지를 사실로만 말한다,
// 힌트는 두 높이, "왜 그럴까?"는 알아챈 이야기, 세 더미에는 까닭을 붙이지 않는다는 것도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, MAKE_LEVEL, OLD_MAKE_LEVEL, TOP_LEVEL, generateBoard, opensFixed, rungOf } from '../src/core/duel-ladder.js';
import { GAMES, LIMITS, NO_WHY, WHY_AFTER, applyMove, checkBoard, gameOf, isHeap, isOver, isWin, movesOf, moveKey, replay, solve, startState, takesOf, whyOpen, winningMoves } from '../src/core/duel.js';
import { TUNING, recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { fill, ordinal, sentenceCount } from '../src/core/text.js';
import { bruteLengths, bruteWin, fromBoard, fromState } from './helpers/brute-duel.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/duel.json'));
const C = JSON.parse(read('src/content/coins.json'));
const html = read('index.html');
const code = read('src/formats/duel.js');

const WHY_GAMES = ['choco', 'one', 'two', 'divisor'];
const RULE_KEYS = ['choco-first', 'choco', 'one', 'one-1', 'two', 'three', 'divisor', 'half', 'both'];
const RIGHT_KEYS = ['kid-choco', 'teacher-choco', 'kid-stones', 'teacher-stones', 'kid-rest', 'teacher-rest', 'first-board', 'swap-invite', 'why-invite'];
const STATUS_KEYS = [
  'kid-turn',
  'teacher-turn',
  'teacher-choco',
  'teacher-one',
  'teacher-piles',
  'teacher-both',
  'over-kid-choco',
  'over-teacher-choco',
  'over-kid-stones',
  'over-teacher-stones',
  'over-kid-rest',
  'over-teacher-rest',
  'over-max',
  'over-both',
  'not-take',
];
const VALUES = { k: 3, n: 2, no: 4, at: 1, pile: '둘째', w: 3, h: 2, a: 3, b: 5, c: 2, list: '1, 2, 3, 6' };

/** 대본의 모든 글(값)을 길과 함께 모은다. 설명(_로 시작하는 것)과 그림의 값(판의 꼴, 금의 방향, 이기는 쪽의 이름표, 더미 번호)은 뺀다. */
function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_') && key !== 'kind' && key !== 'dir' && key !== 'winner' && key !== 'game' && key !== 'pile')
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
const screenText = visibleText(html);
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const part = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));
const slides = WHY_GAMES.flatMap((game) => T.why[game]);
const figures = slides.flatMap((slide) => slide.figures);
/** 그림의 자리: 판에서 적어 둔 수들을 차례로 둔 다음 */
const stateOf = (item) => {
  const played = replay(item.board, item.trail);
  assert.equal(played.ok, true, `${item.note}: 둘 수 없는 수`);
  return played.state;
};

test('대본을 읽을 수 있고, 글이 비어 있지 않다', () => {
  assert.ok(strings.length > 110);
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.equal(T.title, '누가 이길까');
  assert.deepEqual(Object.keys(T.games), GAMES);
  assert.deepEqual(Object.values(T.games), ['초콜릿 쪼개기', '한 더미', '두 더미', '세 더미', '약수 빼기', '절반까지', '두 더미에서 같은 수도']);
  assert.deepEqual(T.piles, ['첫째', '둘째', '셋째']);
  assert.equal(T.piles.length, LIMITS.piles.max);
  assert.deepEqual(T.sides, { first: '먼저 두는 쪽', second: '나중에 두는 쪽' });
});

test('단계 목록이 사다리와 같고, 표시는 기본·응용·응용·도전·응용·응용·도전·도전이다', () => {
  assert.deepEqual(T.levels.map((entry) => entry.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(LADDER.map((rung) => C.tags[rung.tag]), ['기본', '응용', '응용', '도전', '응용', '응용', '도전', '도전']);
  assert.equal(T.levels.at(-1).level, MAKE_LEVEL);
  assert.equal(T.levels.at(-1).name, '직접 만들기');
  assert.match(T.levels[0].name, /초콜릿/);
  assert.match(T.levels[1].name, /한 더미/);
  assert.match(T.levels[2].name, /두 더미/);
  assert.match(T.levels[3].name, /세 더미/);
  assert.match(T.levels[4].name, /약수/);
  assert.match(T.levels[5].name, /절반/);
  assert.match(T.levels[6].name, /두 더미에서 같은 수/);
  // 단계의 이름은 이름표라서 무엇이 이기는지는 말하지 않는다.
  for (const entry of T.levels) assert.doesNotMatch(entry.name, /홀수|짝수|지는|이기는/, entry.name);
});

test('규칙 설명은 세 문장을 넘지 않고, 마지막 수를 둔 쪽이 이긴다고 말한다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), [...RULE_KEYS].sort());
  for (const key of RULE_KEYS) {
    assert.ok(sentenceCount(T.rules[key]) <= 3, `${key}: ${T.rules[key]}`);
    // 어느 게임이든 마지막 수를 둔 쪽이 이긴다. 돌이 1개 남는 게임은 마지막으로 가져간 쪽이다.
    assert.match(T.rules[key], /마지막(에 쪼갠| 돌을 가져간|으로 가져간) 쪽이 이겨요\.$/, key);
    assert.match(T.rules[key], /번갈아/, key);
  }
  // 약수 빼기: 약수만큼, 다 가져갈 수는 없다(그래서 1개가 남으면 끝난다). 절반까지: 1개부터 절반까지.
  assert.match(T.rules.divisor, /약수만큼/);
  assert.match(T.rules.divisor, /남은 돌을 다 가져갈 수는 없어요\./);
  assert.match(T.rules.half, /한 번에 1개부터 남은 돌의 절반까지 가져갈 수 있어요\./);
  for (const key of ['divisor', 'half']) assert.match(T.rules[key], /마지막으로 가져간 쪽이 이겨요\.$/, key);
  // 두 더미에서 같은 수도: 한 더미에서 원하는 만큼, 또는 두 더미에서 같은 수만큼. 마지막 돌을 가져간 쪽이 이긴다.
  assert.match(T.rules.both, /번갈아 한 더미에서 원하는 만큼, 또는 두 더미에서 같은 수만큼 가져가요\./);
  assert.match(T.rules.both, /마지막 돌을 가져간 쪽이 이겨요\.$/);
  // 차례마다 가져갈 수 있는 수를 답하는 칸에 적는다(약수 빼기, 절반까지). 둘 다에서 단추가 있다(두 더미에서 같은 수도).
  assert.equal(fill(T.allow.divisor, { list: takesOf({ kind: 'divisor' }, 12).join(', ') }), '지금 가져갈 수 있는 수는 1, 2, 3, 4, 6개예요');
  assert.equal(fill(T.allow.half, { k: 3 }), '지금은 1개부터 3개까지 가져갈 수 있어요');
  // 1개만 가져갈 수 있을 때(2개나 3개가 남았을 때)는 "1개부터 1개까지"라고 하지 않는다.
  assert.equal(T.allow['half-one'], '지금은 1개만 가져갈 수 있어요');
  assert.match(code, /return takes\.length === 1 \? T\.allow\['half-one'\] : fill\(T\.allow\.half, \{ k: takes\.at\(-1\) \}\);/);
  // 둘 다에서를 눌러 두었을 때 돌을 읽어 주는 글
  assert.equal(fill(T.labels['stone-both'], { n: 2 }), '두 더미에서 2개씩 가져가기');
  const padPart = part('id="duel-pad"', 'id="leave-ask"');
  assert.match(padPart, /id="duel-allow-line" class="pad-note" aria-live="polite" hidden><\/p>/);
  assert.match(padPart, /id="duel-both" class="btn" type="button" aria-pressed="false" hidden>둘 다에서</);
  assert.match(visibleText(padPart), /둘 다에서를 누르고 돌을 고르면 두 더미에서 같은 수만큼 골라져요\./);
  assert.match(code, /\$\('duel-allow-line'\)\.hidden = !keepsLast\(board\);/);
  assert.match(code, /\$\('duel-both'\)\.hidden = board\.kind !== 'both';/);
  assert.match(T.rules.choco, /금을 따라 곧게 둘로 쪼개요/);
  assert.equal(fill(T.rules.one, { k: 3 }), '번갈아 돌을 가져가요. 한 번에 1개부터 3개까지 가져갈 수 있어요. 마지막 돌을 가져간 쪽이 이겨요.');
  // 여러 더미: 한 개 이상을, 한 더미에서만 가져간다(하나도 안 가져가는 수는 없다).
  for (const key of ['two', 'three']) assert.match(T.rules[key], /번갈아 한 개 이상, 한 더미에서만 원하는 만큼 가져가요\./, key);
  // 어떻게 두는지는 답하는 칸에 늘 적혀 있다.
  const pad = visibleText(part('id="duel-pad"', 'id="leave-ask"'));
  assert.match(pad, /조각 안의 금을 누르면 그 금을 따라 쪼개져요\./);
  assert.match(pad, /돌을 누르면 그 돌부터 맨 위의 돌까지 골라져요\./);
  assert.match(part('id="duel-pad"', 'id="leave-ask"'), /id="duel-take"[^>]*>가져가기</);
  // 직접 만들기 화면의 안내 글도 세 문장 안이다. 나중에 두는 쪽이 이기는 판을 만들어 보라고 권한다.
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 27, '직접 만들기 안내 글은 형식마다 하나');
  assert.ok(sentenceCount(guides[5]) <= 3, guides[5]);
  assert.match(guides[5], /나중에 두는 쪽이 이기는 판도 만들 수 있을까요\?/);
});

test('이 형식의 답은 "먼저 둘래요 / 나중에 둘래요"라는 고르기다', () => {
  const choose = part('id="duel-choose"', 'id="duel-turn-box"');
  assert.match(choose, /<h2>누가 먼저 둘까요\?<\/h2>/);
  assert.match(choose, /id="duel-first"[^>]*>먼저 둘래요</);
  assert.match(choose, /id="duel-second"[^>]*>나중에 둘래요</);
  // 두 단추는 똑같이 생겼다. 어느 쪽도 권하지 않는다.
  assert.equal(choose.match(/id="duel-first" class="([^"]*)"/)[1], choose.match(/id="duel-second" class="([^"]*)"/)[1]);
  // 고른 것은 답으로 적는다. 이기는 쪽을 골랐는지는 기록에만 남기고 화면에서는 알리지 않는다.
  assert.match(code, /round\.answers\.push\(\{ t: frame\.stamp\(\), answer, correct, guess: null \}\)/);
  assert.match(code, /const correct = \(first === 'kid'\) === solution\.first;/);
  assert.match(T.play['picked-first'], /^먼저 두기로 했어요\./);
  assert.match(T.play['picked-second'], /^나중에 두기로 했어요\. 선생님이 먼저 둘게요\.$/);
  for (const key of ['picked-first', 'picked-second']) assert.doesNotMatch(T.play[key], /이기|지는|좋은|맞/, key);
  // 처음 화면의 물음도 이 고르기다.
  assert.equal(T.home.ask, '먼저 둘까요, 나중에 둘까요?');
  assert.ok(screenText.includes(T.home.ask));
});

test('형식의 첫 판은 실패할 수 없다: 고르기 없이 아이가 먼저 두는 2×2이고, 어떻게 두어도 아이가 마지막 조각을 쪼갠다', () => {
  assert.equal(tuningFor('duel').startLevel, 1);
  assert.equal(rungOf(1).game, 'choco');
  const first = generateBoard(recommend([], 'duel').level, 1);
  assert.deepEqual(first.board, { kind: 'choco', w: 2, h: 2 });
  assert.equal(opensFixed(1, 1), true);
  // 어떻게 쪼개도 3번에 끝난다. 아이가 첫째와 셋째 수를 둔다.
  assert.deepEqual([...bruteLengths('choco', Infinity, [[2, 2]])], [3]);
  // 첫 판의 규칙 설명은 고르기를 말하지 않는다. 둘째 판부터 고른다고 끝난 뒤에 알려 준다.
  assert.doesNotMatch(T.rules['choco-first'], /고르|먼저|나중/);
  assert.equal(T.right['first-board'], '다음 판부터는 먼저 둘지 나중에 둘지 고를 수 있어요.');
  // 화면 코드: 그 판에서는 먼저 두는 쪽이 아이로 정해져 있고, 고르는 판이 아니라고 적는다.
  assert.match(code, /const fixed = !custom && opensFixed\(level, seed\);/);
  assert.match(code, /chose: start === null && !fixed,/);
  assert.match(code, /first: start !== null \? start\.first : fixed \? 'kid' : null,/);
  // 틀은 판 번호를 형식에 건넨다.
  assert.match(read('src/main.js'), /F\.begin\(\{ level, seed, custom, board \}\)/);
});

test('판이 끝나면 누가 마지막 수를 두었는지를 사실로 말한다. 축하하거나 깎아내리지 않는다', () => {
  assert.deepEqual(Object.keys(T.right).sort(), [...RIGHT_KEYS].sort());
  assert.equal(T.right['teacher-choco'], '마지막 조각을 선생님이 쪼갰어요. 이번 판은 선생님이 이겼어요.');
  assert.equal(T.right['kid-stones'], '마지막 돌을 가져갔어요. 이번 판은 이겼어요.');
  assert.equal(T.right['kid-choco'], '마지막 조각을 쪼갰어요. 이번 판은 이겼어요.');
  assert.equal(T.right['teacher-stones'], '마지막 돌을 선생님이 가져갔어요. 이번 판은 선생님이 이겼어요.');
  for (const key of ['kid-choco', 'teacher-choco', 'kid-stones', 'teacher-stones', 'kid-rest', 'teacher-rest']) {
    const [fact, result, ...rest] = sentences(T.right[key]);
    assert.equal(rest.length, 0, `${key}: 두 문장이어야 해요`);
    // 돌이 1개 남는 게임은 누구 차례에 1개가 남았는지(더 가져갈 수 없는 쪽)를 말한다.
    if (key.endsWith('-rest')) assert.match(fact, /^(선생님|내) 차례에 돌이 1개만 남았어요\.$/, key);
    else assert.match(fact, /^마지막 (조각|돌)을/, key);
    assert.match(result, /^이번 판은 (선생님이 )?이겼어요\.$/, key);
  }
  // 이긴 쪽의 상대 차례에 1개가 남는다.
  assert.match(T.right['kid-rest'], /^선생님 차례에/);
  assert.match(T.right['teacher-rest'], /^내 차례에/);
  assert.equal(T.status['over-kid-rest'], '선생님 차례에 돌이 1개만 남았어요');
  assert.equal(T.status['over-teacher-rest'], '내 차례에 돌이 1개만 남았어요');
  assert.match(code, /const kindOf = \(board\) => \(board\.kind === 'choco' \? 'choco' : keepsLast\(board\) \? 'rest' : 'stones'\);/);
  // 칭찬 낱말, 축하하는 말, 진 것을 깎아내리는 말이 어디에도 없다.
  const praise = /최고|잘했|대단|훌륭|멋져|멋진|천재|똑똑|완벽|짱|굉장/;
  const cheer = /축하|만세|야호|와!|우와|신난|기뻐|폭죽|성공/;
  const blame = /졌어요|졌네|아쉽|아깝|안타깝|틀렸|못했|실수|실패|바보|조심/;
  for (const [path, text] of strings) {
    assert.doesNotMatch(text, praise, `${path}: ${text}`);
    assert.doesNotMatch(text, cheer, `${path}: ${text}`);
    if (!path.startsWith('why')) assert.doesNotMatch(text, blame, `${path}: ${text}`);
  }
  for (const pattern of [praise, cheer]) assert.doesNotMatch(screenText, pattern);
  // 화면 코드: 이긴 판도 진 판도 "끝까지 둔 판"으로 똑같이 끝낸다. 꾸밈을 더하지 않는다.
  assert.equal([...code.matchAll(/frame\.finish\(/g)].length, 1);
  assert.match(code, /round\.winner = who;\s*frame\.note\('over', \{ winner: who \}\);\s*frame\.finish\('solved'\);/);
  assert.doesNotMatch(code, /confetti|firework|celebrat|animate\(/i);
});

test('몇 번 이기고 졌는지, 몇 판째인지를 세어 보여 주지 않는다', () => {
  const counting = /\{[a-z]+\}번 (이겼|졌|이기|지)|몇 번 (이겼|졌)|판째|연달아|이긴 판|진 판|이긴 횟수|진 횟수|승|패/;
  for (const [path, text] of strings) assert.doesNotMatch(text, counting, `${path}: ${text}`);
  const duelParts = [part('id="duel-pad"', 'id="leave-ask"'), part('id="duel-count"', 'id="undo"'), part('id="make-duel"', '<script')].map(visibleText).join(' ');
  assert.doesNotMatch(duelParts, counting);
  // 판 아래에는 차례와 방금 둔 수만 적는다. 수를 세는 자리가 없다.
  assert.doesNotMatch(part('id="duel-count"', 'id="undo"'), /<strong/);
  // 화면 코드: 기록의 이기고 진 것을 화면 글자로 쓰는 곳은 "자리를 바꿔 볼 수 있어요"와 "왜 그럴까?"를 알리는 곳뿐이고, 수를 채워 넣지 않는다.
  assert.match(code, /lostStreak\(records\) >= SWAP_INVITE_AFTER\) parts\.push\(T\.right\['swap-invite'\]\)/);
  assert.match(code, /finishedCount\(records, round\.mode\) === WHY_AFTER\) parts\.push\(T\.right\['why-invite'\]\)/);
  // 덧붙이는 말은 하나만 한다: 첫 판의 안내, "왜 그럴까?"가 열렸다는 말, 자리를 바꿔 볼 수 있다는 말 가운데 하나다.
  assert.match(code, /parts\.push\(T\.right\['first-board'\]\);[\s\S]*?else if \(T\.why\[round\.mode\][\s\S]*?else if \(round\.winner === 'teacher'/);
  for (const key of ['swap-invite', 'why-invite', 'first-board']) assert.doesNotMatch(T.right[key], /\{/, key);
  assert.equal(T.right['swap-invite'], '자리를 바꿔서 다시 두어 볼 수도 있어요.');
});

test('선생님이 둔 수는 판 아래의 글과 말로 알린다', () => {
  assert.deepEqual(Object.keys(T.status).sort(), [...STATUS_KEYS].sort());
  for (const key of STATUS_KEYS) {
    const line = fill(T.status[key], VALUES);
    assert.match(line, /요$/, key);
    assert.ok([...line].length <= 24, `${key}: ${line}`);
  }
  assert.equal(fill(T.status['teacher-piles'], { pile: '둘째', n: 2 }), '선생님이 둘째 더미에서 2개를 가져갔어요');
  assert.equal(fill(T.play['teacher-piles'], { pile: '둘째', n: 2 }), '선생님은 둘째 더미에서 2개를 가져갔어요.');
  assert.equal(fill(T.play['teacher-one'], { n: 3 }), '선생님은 3개를 가져갔어요.');
  assert.equal(fill(T.play['teacher-both'], { n: 2 }), '선생님은 두 더미에서 2개씩 가져갔어요.');
  assert.equal(fill(T.status['teacher-both'], { n: 2 }), '선생님이 두 더미에서 2개씩 가져갔어요');
  assert.equal(fill(T.status['not-take'], { n: 5 }), '지금은 5개를 가져갈 수 없어요');
  assert.equal(fill(T.status['over-both'], { k: 3 }), '둘 다에서는 3개까지만 가져갈 수 있어요');
  assert.match(T.play['teacher-choco'], /조각 하나를 둘로 쪼갰어요\.$/);
  assert.deepEqual(T.turn, { kid: '내 차례예요', teacher: '선생님 차례예요' });
  // 오른쪽 칸의 차례와 판 아래의 차례는 같은 때 함께 보이므로 같은 말이다.
  assert.equal(T.status['kid-turn'], T.turn.kid);
  assert.equal(T.status['teacher-turn'], T.turn.teacher);
  // 쪼개기가 끝났을 때: 마지막으로 쪼갠 쪽을 말한다("마지막 조각"이 어느 조각인지 헷갈리지 않게).
  assert.equal(T.status['over-kid-choco'], '마지막으로 쪼갠 것은 나예요');
  assert.equal(T.status['over-teacher-choco'], '마지막으로 쪼갠 것은 선생님이에요');
  // 판 화면: 판 아래에 글자로 알리는 자리가 있고, 읽어 주는 기기에도 알린다.
  assert.match(html, /id="duel-status" class="tile-status" aria-live="polite"/);
  // 화면 코드: 선생님은 잠깐 뜸을 들이고 두며, 둔 뒤에 무엇을 두었는지 말한다. 스스로 되풀이하는 타이머는 없다.
  assert.match(code, /timer = setTimeout\(/);
  assert.match(code, /if \(who === 'teacher'\) frame\.say\(moveText\(T\.play, 'teacher', game\.board, move\)\);/);
  assert.doesNotMatch(code, /setInterval|Math\.random/);
});

test('힌트는 게임마다 두 개이고, 하나하나가 질문 한 문장이다', () => {
  assert.deepEqual(Object.keys(T.hints), GAMES);
  for (const game of GAMES) {
    const hints = T.hints[game];
    assert.equal(hints.length, tuningFor('duel').hintCount, game);
    assert.equal(hints.length, 2, game);
    for (const hint of hints) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
    }
    assert.equal(new Set(hints).size, hints.length, `${game}: 같은 힌트가 두 번 있어요`);
  }
});

test('힌트는 두 높이다: 첫째는 무엇을 해 볼지만, 둘째는 어디를 볼지까지만 묻는다. 까닭을 말해 버리지 않는다', () => {
  for (const game of GAMES) {
    const [first, second] = T.hints[game];
    // 첫째: 어느 판에서나 쓸 수 있는 일반 질문이다. 판의 어느 것도 가리키지 않는다.
    assert.doesNotMatch(first, /조각|금|돌|더미|칸/, first);
    // 둘째: 볼 곳(조각, 돌, 더미)을 가리킨다.
    assert.match(second, /조각|돌|더미/, second);
    // 답을 말해 버리지 않는다: 홀짝, 나머지, 따라 하기, 같게 만들기, 이진법, 요령이 들어 있지 않다.
    for (const hint of [first, second]) {
      assert.doesNotMatch(hint, /홀수|짝수|나머지|따라|같게|같은 수|이진|늘어|하나씩|배수|때문이에요|해야 해요|하면 돼요/, hint);
    }
  }
  assert.equal(T.hints.choco[0], '더 작은 판이라면 누가 이길까요?');
  assert.equal(T.hints.choco[1], '끝났을 때 조각은 모두 몇 개였나요?');
  assert.equal(T.hints.one[0], '끝나기 바로 전에는 어떤 모양이었나요?');
  assert.equal(T.hints.one[1], '돌이 몇 개 남았을 때 차례가 오면 질까요?');
  assert.equal(T.hints.two[0], '자리를 바꿔서 두면 어떻게 될까요?');
  // 따라 두기를 말해 버리지 않게, 선생님이 둔 뒤의 모양만 보게 한다.
  assert.equal(T.hints.two[1], '선생님이 가져간 뒤에 두 더미는 어떤 모양이었나요?');
});

test('작은 판으로 두어 보는 일은 틀의 "더 작은 판으로"가 맡는다. 같은 일을 하는 단추가 둘 있지 않다. 끝내면 원래 판으로 돌아와 묻는다', () => {
  // 힌트 칸(왼쪽)에는 틀의 단추 하나뿐이다. 이 형식만의 "작은 판으로 두어 보기" 단추는 없다.
  const side = part('<section class="side" aria-label="힌트">', '</section>');
  assert.match(side, /id="smaller"[^>]*hidden>더 작은 판으로</);
  assert.doesNotMatch(html, /duel-small|작은 판으로 두어 보기/);
  assert.doesNotMatch(code, /duel-small|practice|smallBoards\(/);
  // 작은 판도 판 하나다. 먼저 둘지 고르고, 끝나면 틀의 두 단추(원래 판으로 돌아가기, 작은 판 하나 더)가 나온다.
  const after = part('id="after"', '</section>');
  assert.match(after, /id="after-back"[^>]*hidden>원래 판으로 돌아가기</);
  assert.match(after, /id="after-more"[^>]*hidden>작은 판 하나 더</);
  // 작은 판은 같은 게임의 가장 작은 판들을 작은 것부터 차례로 낸다(src/core/duel.js의 smallBoards).
  assert.match(code, /smaller: \(round, turn\) => smallerDuel\(\{ mode: round\.mode, board: round\.board \}, turn\)/);
  // 작은 판을 끝낸 뒤에는 이 형식만의 끝난 뒤 단추(자리를 바꿔서 다시 두기, 방금 판 다시 보기)와 덧붙이는 말을 내지 않는다.
  assert.match(code, /const done = round\.done && !round\.side;/);
  assert.match(code, /if \(round\.side\) return parts;/);
  // 돌아오면 작은 판에서 알아낸 것이 원래 판에도 맞는지 묻는다. 무엇을 보았어야 하는지는 말하지 않는다. 이 말은 틀의 대본에 있다.
  assert.equal(C.side.back, '작은 판에서 알아낸 것이 이 판에도 맞을까요?');
  for (const key of ['open', 'more', 'back', 'early']) assert.doesNotMatch(C.side[key], /홀수|짝수|나머지|따라|같게|때문/, key);
  assert.ok(!Object.keys(T.play).some((key) => key.startsWith('small')), '작은 판의 말은 틀의 대본으로 옮겼다');
  // 기록: 작은 판을 연 것은 틀이 원래 판의 사건(side)으로 남기고, 작은 판에서 둔 것은 작은 판의 기록(side: true)에 남는다.
  // 작은 판으로 가 본 판은 예전처럼 힌트 하나를 연 것으로 센다(이제는 틀이 모든 형식에서 그렇게 센다).
  const frame = read('src/main.js');
  assert.match(frame, /note\('side', \{ on: true, turn, board: small\.board \}\)/);
  assert.match(frame, /if \(record\.sideOpened > 0\) record\.hintsOpened \+= 1;/);
  assert.doesNotMatch(code, /hintsOpened:/);
});

test('끝난 뒤 고르기에 "자리를 바꿔서 다시 두기"와 "방금 판 다시 보기"가 있다. 진 판 뒤에는 자리 바꾸기가 맨 위에 온다', () => {
  const after = part('id="after"', '</section>');
  assert.match(after, /id="duel-swap"[^>]*hidden>자리를 바꿔서 다시 두기</);
  assert.match(after, /id="duel-replay"[^>]*hidden>방금 판 다시 보기</);
  // 다른 형식에서는 보이지 않는다(처음부터 감춰 두고, 이 형식의 끝난 판에서만 보인다).
  assert.match(code, /\$\('duel-swap'\)\.hidden = !\(done && round\.first !== null\);/);
  assert.match(code, /\$\('duel-replay'\)\.hidden = !\(done && round\.trail\.length > 0\);/);
  assert.match(code, /\$\('duel-swap'\)\.hidden = true;\s*\$\('duel-replay'\)\.hidden = true;/);
  // 진 판 뒤에는 "같은 단계 새 판"보다 위에 놓고 눈에 띄게 한다.
  assert.match(code, /\$\(lost \? 'after-same' : 'after-make'\)\.before\(\$\('duel-swap'\), \$\('duel-replay'\)\);/);
  assert.match(code, /\$\('duel-swap'\)\.classList\.toggle\('primary', lost\);/);
  // 자리를 바꾸면 같은 판을 먼저 두는 쪽만 바꿔서 다시 둔다.
  assert.match(code, /const next = \{ first: otherOf\(round\.first\), rematchOf: round\.id \};/);
  assert.match(code, /frame\.chooseAfter\('swap', \(\) => \{/);
  assert.match(T.play['rematch-kid'], /^아까와 같은 판이에요\./);
  assert.match(T.play['rematch-teacher'], /선생님이 먼저 둘게요\.$/);
  // 다시 보기: 한 수씩 넘겨 보며 누가 무엇을 두었는지를 말한다.
  assert.equal(T.replay.title, '방금 판 다시 보기');
  // 차례는 "첫 번째", "2번째"로 읽는다('1번째'라고 하지 않는다).
  assert.equal(fill(T.replay['teacher-piles'], { no: ordinal(2), pile: '첫째', n: 3 }), '2번째 수예요. 선생님이 첫째 더미에서 3개를 가져갔어요.');
  assert.equal(fill(T.replay['kid-one'], { no: ordinal(1), n: 2 }), '첫 번째 수예요. 2개를 가져갔어요.');
  assert.match(code, /moveText\(T\.replay, who, round\.board, trail\.at\(-1\), \{ no: ordinal\(turns\) \}\)/);
  // 금을 읽어 주는 글도 같다.
  assert.equal(fill(T.labels['line-v'], { no: ordinal(1), at: ordinal(2) }), '첫 번째 조각, 왼쪽에서 2번째 세로 금');
  assert.equal(fill(T.labels['line-h'], { no: ordinal(3), at: ordinal(1) }), '3번째 조각, 위에서 첫 번째 가로 금');
  assert.match(code, /fill\(T\.labels\[`line-\$\{dir\}`\], \{ no: ordinal\(index \+ 1\), at: ordinal\(at\) \}\)/);
  for (const who of ['kid', 'teacher']) {
    for (const kind of ['choco', 'one', 'piles']) assert.match(T.replay[`${who}-${kind}`], /^\{no\}번째 수예요\./, `${who}-${kind}`);
    assert.ok(T.replay[`start-${who}`], who);
    assert.ok(T.replay[`note-${who}`], who);
  }
  assert.match(code, /frame\.openSheet\(\{ title: T\.replay\.title, pages: replayPages\(round\) \}\)/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(Object.keys(VALUES));
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.names.choco, { w: 3, h: 2 }), '가로 3칸, 세로 2칸');
  assert.equal(fill(T.names.one, { n: 7 }), '돌 7개');
  assert.equal(fill(T.names.two, { a: 3, b: 5 }), '3개와 5개');
  assert.equal(fill(T.names.three, { a: 3, b: 5, c: 2 }), '3개, 5개, 2개');
  assert.equal(fill(T.labels['stone-piles'], { pile: '셋째', n: 4 }), '셋째 더미에서 4개 가져가기');
  assert.equal(fill(T.pick.piles, { pile: '첫째', n: 2 }), '첫째 더미에서 2개를 골랐어요');
  assert.equal(fill(T.status['over-max'], { k: 3 }), '한 번에 3개까지만 가져갈 수 있어요');
});

test('화면 글에 영어 낱말이 없다', () => {
  for (const [path, text] of strings) {
    const plain = text.replace(/\{[^{}]*\}/g, '');
    assert.doesNotMatch(plain, /[A-Za-z]/, `${path}: ${text}`);
  }
  assert.doesNotMatch(screenText, /[A-Za-z]/);
});

test('화면 글은 "~요"로 끝나는 말투다(대본의 문장)', () => {
  const spoken = [
    T.home.ask,
    T.home.pick,
    ...Object.values(T.rules),
    ...Object.values(T.play),
    ...GAMES.flatMap((game) => T.hints[game]),
    ...Object.values(T.right),
    ...Object.entries(T.solution)
      .filter(([key]) => key !== 'marks-note')
      .map(([, text]) => text),
    T.make.intro,
    T.make.first,
    T.make.second,
    T.make.nomove,
    ...Object.entries(T.replay)
      .filter(([key]) => key !== 'title' && !key.startsWith('note-'))
      .map(([, text]) => text),
    ...slides.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  // 마침표 없이 쓰는 짧은 글도 "~요"로 끝난다(이름표처럼 쓰는 글은 뺀다).
  for (const text of [...Object.values(T.status), ...Object.values(T.pick), ...Object.values(T.allow), ...Object.values(T.turn), ...Object.values(T.marks), T.solution['marks-note']]) assert.match(text, /요$/, text);
  for (const item of figures) assert.match(item.note, /(요|도)$/, item.note);
  for (const slide of slides) if (slide.marks) assert.match(slide.marks.note, /요$/, slide.marks.note);
});

test('한 문장에 한 가지 뜻: 문장이 너무 길지 않다(60자 이하)', () => {
  for (const [path, text] of strings) {
    for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
  }
});

test('까닭과 생각의 이름은 "왜 그럴까?"에서만 말한다', () => {
  const name = /횟수 미리 세기|끝에서부터 따지기|따라 두기|홀짝 넘겨주기/;
  const reason = /홀수|짝수|나머지|따라 하|따라 가져|같게 만들|같아져|하나씩 늘|칸의 수보다|건너뛰|이진법|이미 정해져/;
  for (const [path, text] of strings) {
    if (path.startsWith('why')) continue;
    assert.doesNotMatch(text, name, `${path}: ${text}`);
    assert.doesNotMatch(text, reason, `${path}: ${text}`);
  }
  assert.doesNotMatch(screenText, name);
  // index.html에서는 이 형식의 자리만 본다(다른 형식에는 "건너뛰어 짝 짓기" 같은 말이 있다).
  const own = [part('id="duel-title"', 'id="make-title"'), part('id="duel-pad"', 'id="leave-ask"'), part('id="duel-swap"', 'id="after-make"'), part('id="make-duel"', '<script')].map(visibleText).join(' ');
  assert.ok(own.includes('누가 먼저 둘까요?') && own.includes('자리를 바꿔서 다시 두기') && own.includes('선생님, 누가 이길까요?'));
  assert.doesNotMatch(own, reason);
  // 이름은 까닭을 다 본 뒤에, 이야기의 맨 끝에서 처음 꺼낸다(뜻밖의 결과 → 그림 → 이름).
  const names = { choco: /횟수 미리 세기/, one: /끝에서부터 따지기/, two: /따라 두기/, divisor: /홀짝 넘겨주기/ };
  for (const game of WHY_GAMES) {
    const story = T.why[game];
    for (const slide of story.slice(0, -1)) assert.doesNotMatch(slide.say, name, slide.say);
    assert.match(story.at(-1).say, names[game], game);
    assert.match(story.at(-1).say, /선생님은 이것을 .+(이)?라고 불러요\.$/, game);
  }
  // 풀이와 직접 만들기에서는 어느 쪽이 이기는지만 알려 주고 까닭은 말하지 않는다.
  for (const key of ['first', 'second']) {
    assert.equal(T.solution[key], T.make[key]);
    assert.match(T.solution[key], /^이 판은 둘 다 잘 두면 (먼저|나중에) 두는 쪽이 이겨요\.$/);
  }
  // 5~7단계의 풀이에 붙는 표의 말도 까닭은 말하지 않는다(어느 수에서 지는지만 보인다).
  for (const key of ['marks', 'marks-note', 'pairs']) assert.doesNotMatch(T.solution[key], reason, key);
});

test('"왜 그럴까?"는 게임마다 따로 있고, 그림 서너 장이고, 설명이 아니라 어떻게 알아챘는지의 이야기다', () => {
  assert.deepEqual(Object.keys(T.why), WHY_GAMES);
  for (const game of WHY_GAMES) {
    const story = T.why[game];
    assert.ok(story.length >= 3 && story.length <= 4, `${game}: ${story.length}장`);
    for (const slide of story) {
      assert.ok(slide.say.length > 0);
      assert.ok(sentenceCount(slide.say) <= 3, slide.say);
      assert.ok(slide.figures.length <= 2, '그림은 두 개까지');
      // 장마다 그림이 있다: 판 그림이거나 표다.
      assert.ok(slide.figures.length > 0 || slide.table || slide.marks, slide.say);
      for (const item of slide.figures) assert.equal(gameOf(item.board) === 'one' ? 'one' : gameOf(item.board), game, item.note);
    }
    // 이야기 속 선생님이 먼저 해 보고 뜻밖의 일을 겪는다. 겪은 일로 말한다("~봤어요").
    assert.match(story[0].say, /^(선생님도|두 더미가 같은 판에서 선생님이)/, game);
    assert.match(story[0].say, /봤어요/, game);
  }
  // 쪼개기: 이기려고 이리저리 쪼개 봤다 → 그런데 끝날 때까지 쪼갠 횟수가 같았다 → 한 번 쪼개면 조각이 하나 늘어난다
  //        → 처음엔 한 조각, 끝에는 칸의 수만큼 → 횟수가 홀수면 먼저 두는 쪽이 마지막에 쪼갠다. 두기 전에 판만 보고도 안다
  assert.match(T.why.choco[0].say, /^선생님도 이기려고 이리저리 쪼개 봤어요\./);
  assert.match(T.why.choco[0].say, /그런데 어떻게 쪼개도 끝날 때까지 쪼갠 횟수가 같았어요\.$/);
  assert.match(T.why.choco[1].say, /한 번 쪼갤 때마다 조각이 꼭 하나씩 늘어났어요/);
  assert.match(T.why.choco[2].say, /처음에는 한 조각이에요\. 끝에는 칸의 수만큼 조각이 돼요\./);
  assert.match(T.why.choco[2].say, /쪼개는 횟수는 늘 칸의 수보다 하나 적어요/);
  assert.match(T.why.choco[3].say, /홀수면 먼저 두는 쪽이 마지막에 쪼개요/);
  assert.match(T.why.choco[3].say, /그래서 누가 이길지는 두기 전에 판만 보고도 알 수 있어요\./);
  // 한 더미: 여러 번 졌다 → 끝에서부터 거꾸로 따져 봤다 → 3개가 남았을 때 차례가 오면 무엇을 가져가도 진다
  //         → 그 수를 상대에게 넘기면 된다 → 넘겨야 하는 수가 줄줄이 있다(표)
  assert.match(T.why.one[0].say, /^선생님도 여러 번 졌어요\./);
  assert.match(T.why.one[0].say, /끝에서부터 따져 봤어요/);
  assert.match(T.why.one[1].say, /^그런데 3개가 남았을 때 차례가 오면 달랐어요\./);
  assert.match(T.why.one[1].say, /1개를 가져가도 2개를 가져가도 상대가 나머지를 다 가져갔어요/);
  // 이 형식에서 '수'는 둔 수다. 돌의 수를 '지는 수'라고 부르지 않는다.
  assert.match(T.why.one[1].say, /그러니 3개가 남았을 때 차례가 오면 져요\.$/);
  for (const slide of T.why.one) assert.doesNotMatch(slide.say, /지는 수|건너뛰/, slide.say);
  assert.match(T.why.one[2].say, /^상대에게 3개를 넘기면 이겨요\./);
  assert.match(T.why.one[2].say, /작은 수부터 표로 적어 봤어요\.$/);
  assert.match(T.why.one[3].say, /^차례가 오면 지는 돌의 수는 3, 6, 9처럼 3씩 커져요\./);
  // 두 더미: 같은 두 더미에서 상대가 따라 했더니 늘 졌다 → 따라 하면 다시 같아진다
  //         → 다르면 먼저 같게 만들고 따라 한다
  assert.match(T.why.two[0].say, /^두 더미가 같은 판에서 선생님이 먼저 두어 봤어요\. 몇 개를 가져가도/);
  assert.match(T.why.two[0].say, /상대가 다른 더미에서 똑같이 따라 했어요\. 그랬더니 선생님이 늘 졌어요\.$/);
  assert.match(T.why.two[1].say, /^따라 하면 두 더미가 다시 같아져요\./);
  assert.match(T.why.two[2].say, /^그러면 두 더미가 다른 판은 어떨까요\?/);
  assert.match(T.why.two[2].say, /두 더미를 같게 만들어요\. 그다음부터는 따라 하면 돼요\.$/);
  assert.match(T.why.two[3].say, /같으면 나중에 두는 쪽이 이겨요\. 두 더미가 다르면 먼저 두는 쪽이 이겨요/);
});

test('"왜 그럴까?" 그림 속의 판과 수는 풀이 프로그램이 따진 것과 같다', () => {
  let checked = 0;
  for (const item of figures) {
    const where = item.note;
    assert.equal(checkBoard(item.board), null, where);
    const state = stateOf(item);
    // 적어 둔 조각의 수, 칸의 수, 쪼갠 횟수, 남은 돌의 수
    if ('pieces' in item) {
      assert.equal(state.length, item.pieces, where);
      assert.ok(item.note.includes(`${item.pieces}조각`), where);
    }
    if ('cells' in item) {
      assert.equal(item.board.w * item.board.h, item.cells, where);
      assert.ok(item.note.includes(`${item.cells}개`), where);
    }
    if ('moves' in item) {
      assert.equal(item.trail.length, item.moves, where);
      assert.ok(item.note.includes(`${item.moves}번`), where);
    }
    if ('left' in item) {
      assert.deepEqual(state, [item.left], where);
      assert.ok(item.note.includes(`${item.left}개`), where);
    }
    if (item.over) assert.equal(isOver(item.board, state), true, where);
    else assert.equal(isOver(item.board, state), false, where);
    // "모두 몇 번에 끝났어요": 그 자리에서 어떻게 더 두어도 처음부터 센 횟수가 적어 둔 수다.
    if ('total' in item) {
      const lengths = bruteLengths('choco', Infinity, fromState(item.board, state));
      assert.deepEqual([...lengths], [item.total - item.trail.length], where);
      assert.equal(item.total, item.board.w * item.board.h - 1, where);
      assert.ok(item.note.includes(`${item.total}번`), where);
    }
    // 두 더미가 같아진 그림
    if (item.same) assert.equal(state[0], state[1], where);
    // "이렇게 두면 된다"는 그림: 마지막 수가 풀이 프로그램이 낸 이기는 수다.
    if (item.winning) {
      const before = replay(item.board, item.trail.slice(0, -1)).state;
      assert.ok(winningMoves(item.board, before).some((move) => moveKey(move) === moveKey(item.trail.at(-1))), where);
    }
    checked += 1;
  }
  assert.equal(checked, 20);
});

test('"왜 그럴까?"의 주장(약수 빼기): 차례가 오면 지는 돌의 수는 홀수뿐이고, 홀수에서는 짝수만, 짝수에서는 1개를 가져가 홀수를 넘길 수 있다', () => {
  const story = T.why.divisor;
  assert.equal(story.length, 4);
  // 1장과 4장의 표: 차례가 오면 지는 수는 풀이 프로그램과 다른 탐색이 따진 것과 같고, 모두 홀수다. 말로 적은 수도 그 수들이다.
  for (const marks of [story[0].marks, story[3].marks]) {
    assert.equal(marks.game, 'divisor');
    const losing = [];
    for (let n = 1; n <= marks.upto; n++) {
      const board = { kind: 'divisor', n };
      const win = isWin(board, [n]);
      const { kind, max, state } = fromBoard(board);
      assert.equal(win, bruteWin(kind, max, state), `${n}개(다른 탐색)`);
      if (!win) losing.push(n);
    }
    assert.deepEqual(marks.lose, losing);
    assert.deepEqual(losing, losing.filter((n) => n % 2 === 1));
    assert.equal(losing.length, Math.ceil(marks.upto / 2), '홀수가 모두 들어 있다');
    assert.ok(marks.upto <= LIMITS.one.max);
  }
  assert.ok(story[0].say.includes(`차례가 오면 지는 돌의 수가 ${story[0].marks.lose.join(', ')}였어요.`));
  // 2장: 15개에서 가져갈 수 있는 수는 1, 3, 5뿐이고 모두 홀수다. 그림 둘은 그 가운데 두 수이고, 남는 수는 짝수다.
  assert.deepEqual(takesOf({ kind: 'divisor' }, 15), [1, 3, 5]);
  assert.match(story[1].say, /15개에서 가져갈 수 있는 수 1, 3, 5도 모두 홀수였어요\./);
  for (const item of story[1].figures) {
    assert.deepEqual(item.board, { kind: 'divisor', n: 15 });
    assert.equal(item.left % 2, 0, item.note);
  }
  // 1~25개 모두: 홀수에서 둘 수 있는 수는 모두 짝수를 남긴다(그래서 홀수를 받으면 짝수를 넘겨줄 수밖에 없다).
  for (let n = 3; n <= LIMITS.one.max; n += 2) for (const take of takesOf({ kind: 'divisor' }, n)) assert.equal((n - take) % 2, 0, `${n}개에서 ${take}개`);
  // 3장: 짝수에서는 1개를 가져가 홀수를 넘길 수 있고, 그 수는 이기는 수다. 끝은 상대 차례에 1개가 남는 것이다.
  for (let n = 2; n <= LIMITS.one.max; n += 2) {
    assert.ok(takesOf({ kind: 'divisor' }, n).includes(1), `${n}개`);
    assert.ok(winningMoves({ kind: 'divisor', n }, [n]).some((move) => move.take === 1), `${n}개`);
  }
  const [give, last] = story[2].figures;
  assert.equal(give.trail[0].take, 1);
  assert.equal(give.board.n % 2, 0);
  assert.equal(last.left, 1);
  assert.equal(last.over, true);
  // 4장: 짝수 개일 때 차례가 오면 이기고 홀수 개일 때 차례가 오면 진다. 이름은 맨 끝에서 처음 꺼낸다.
  assert.match(story[3].say, /^그래서 짝수 개일 때 차례가 오면 이기고, 홀수 개일 때 차례가 오면 져요\./);
  // 글자(문자)를 쓰지 않는다: 수와 그림으로만 말한다.
  for (const slide of story) assert.doesNotMatch(slide.say, /[A-Za-z]|n개|2n/, slide.say);
});

test('"왜 그럴까?"의 주장(쪼개기): 어떻게 쪼개도 횟수는 칸의 수보다 하나 적고, 그 수가 홀수면 먼저 두는 쪽이 이긴다', () => {
  // 1장: 세로 금부터 쪼갠 판과 가로 금부터 쪼갠 판. 시작은 다르지만 끝나는 횟수는 같다.
  const [upright, across] = T.why.choco[0].figures;
  assert.equal(upright.trail[0].dir, 'v');
  assert.equal(across.trail[0].dir, 'h');
  assert.match(upright.note, /^세로 금부터 쪼갰어요/);
  assert.match(across.note, /^가로 금부터 쪼갰어요/);
  assert.equal(upright.total, across.total);
  // 2장: 한 번 쪼갤 때마다 조각이 하나씩 늘어난다(그림의 조각 수가 쪼갠 횟수보다 하나 많다).
  for (const item of T.why.choco[1].figures) assert.equal(item.pieces, item.trail.length + 1, item.note);
  // 어느 판, 어느 자리, 어느 수에서나 그렇다(4×4까지 아무렇게나 두어 보며 확인한다).
  for (let w = 1; w <= 4; w++) {
    for (let h = 1; h <= 4; h++) {
      const board = { kind: 'choco', w, h };
      let state = startState(board);
      while (!isOver(board, state)) {
        for (const move of movesOf(board, state)) assert.equal(applyMove(board, state, move).length, state.length + 1);
        state = applyMove(board, state, movesOf(board, state)[state.length % movesOf(board, state).length]);
      }
      assert.equal(state.length, w * h);
    }
  }
  // 3장: 처음에는 한 조각, 끝에는 칸의 수만큼.
  const [whole, crumbs] = T.why.choco[2].figures;
  assert.equal(whole.pieces, 1);
  assert.equal(crumbs.pieces, whole.cells);
  assert.equal(crumbs.moves, whole.cells - 1);
  // 4장의 표: 칸의 수, 쪼개는 횟수, 마지막에 쪼개는 쪽을 풀이 프로그램으로 다시 구한다.
  const table = T.why.choco[3].table;
  assert.equal(table.length, 4);
  for (const row of table) {
    const board = { kind: 'choco', w: row.w, h: row.h };
    assert.equal(checkBoard(board), null);
    assert.equal(row.cells, row.w * row.h);
    assert.deepEqual([...bruteLengths('choco', Infinity, [[row.w, row.h]])], [row.moves], `${row.w}×${row.h}`);
    assert.equal(row.winner, solve(board).winner, `${row.w}×${row.h}`);
    assert.equal(row.winner === 'first', row.moves % 2 === 1, `${row.w}×${row.h}`);
  }
  // 표에는 두 가지 판이 모두 있다. 표의 판은 모두 1단계에 나오는 판이다.
  assert.deepEqual([...new Set(table.map((row) => row.winner))].sort(), ['first', 'second']);
  for (const row of table) assert.ok(rungOf(1).boards.some(([w, h]) => w === row.w && h === row.h), `${row.w}×${row.h}`);
  assert.deepEqual(T.table.choco, ['판', '칸의 수', '쪼개는 횟수', '마지막에 쪼개는 쪽']);
});

test('"왜 그럴까?"의 주장(한 더미): 3개가 남았을 때 차례가 오면 지고, 지는 수는 줄줄이 있다', () => {
  // 1장: 1개나 2개가 남았을 때 차례가 오면 다 가져가서 이긴다.
  for (const item of T.why.one[0].figures) {
    assert.equal(item.board.max, 2);
    assert.ok(item.board.n <= item.board.max);
    assert.deepEqual(applyMove(item.board, [item.board.n], { pile: 0, take: item.board.n }), [0]);
    assert.equal(isWin(item.board, [item.board.n]), true, item.note);
  }
  // 2장: 3개에서는 1개를 가져가도 2개를 가져가도 상대가 나머지를 다 가져간다. 그림 둘이 둘 수 있는 수 모두다.
  const three = T.why.one[1].figures;
  const start = three[0].board;
  assert.deepEqual(start, { kind: 'one', n: 3, max: 2 });
  assert.equal(isWin(start, [3]), false);
  assert.deepEqual(three.map((item) => item.trail[0]), movesOf(start, [3]));
  for (const item of three) {
    assert.ok(item.left <= start.max, '상대가 나머지를 한 번에 다 가져갈 수 있다');
    assert.equal(isWin(start, [item.left]), true, item.note);
    assert.match(item.note, new RegExp(`^${item.trail[0].take}개를 가져가면 ${item.left}개가 남아요$`));
  }
  // 3장과 4장의 표: 차례가 오면 지는 수는 풀이 프로그램이 따진 것과 같다. 말로 적은 수도 그 수들이다.
  const marks = [T.why.one[2].marks, T.why.one[3].marks];
  assert.deepEqual(marks.map((item) => item.max), [2, 3]);
  for (const item of marks) {
    const losing = [];
    for (let n = 1; n <= item.upto; n++) if (!isWin({ kind: 'one', n, max: item.max }, [n])) losing.push(n);
    assert.deepEqual(item.lose, losing, `한 번에 ${item.max}개까지`);
    assert.ok(item.upto <= LIMITS.one.max);
    // 지는 수는 (한 번에 가져갈 수 있는 수 + 1)씩 건너뛴다.
    assert.deepEqual(losing, losing.map((_, index) => (index + 1) * (item.max + 1)));
  }
  assert.match(T.why.one[2].say, /3개를 넘기면 이겨요\. 같은 식으로 따져 보니 6개와 9개를 넘겨도 이겼어요/);
  // 말로 적은 지는 돌의 수와 커지는 폭은 두 표의 수 그대로다.
  const [byTwo, byThree] = marks;
  assert.ok(T.why.one[3].say.includes(`차례가 오면 지는 돌의 수는 ${byTwo.lose.join(', ')}처럼 ${byTwo.max + 1}씩 커져요.`));
  assert.ok(T.why.one[3].say.includes(`한 번에 ${byThree.max}개까지 가져가는 판에서는 ${byThree.lose.join(', ')}처럼 ${byThree.max + 1}씩 커졌어요.`));
  // "넘기면 이긴다": 그 수를 넘겨받은 쪽은 지는 자리에 선다. 넘길 수 있는 자리에서는 풀이 프로그램도 그 수를 넘긴다.
  for (let n = 4; n <= 11; n++) {
    const board = { kind: 'one', n, max: 2 };
    for (const move of winningMoves(board, [n])) assert.equal((n - move.take) % 3, 0);
  }
  assert.deepEqual(Object.keys(T.marks), ['win', 'lose']);
});

test('"왜 그럴까?"의 주장(두 더미): 같은 두 더미에서는 따라 하는 쪽이 마지막 돌을 가져가고, 다른 두 더미는 같게 만들 수 있다', () => {
  // 1·2장의 그림은 한 판을 이어서 둔 것이다: 3개와 3개에서, 먼저 둔 쪽이 가져간 만큼 상대가 다른 더미에서 가져간다.
  const game = [...T.why.two[0].figures, ...T.why.two[1].figures];
  const full = game.at(-1).trail;
  game.forEach((item, index) => {
    assert.deepEqual(item.board, { kind: 'piles', piles: [3, 3] });
    assert.deepEqual(item.trail, full.slice(0, index + 1), item.note);
  });
  for (let index = 1; index < full.length; index += 2) {
    assert.equal(full[index].take, full[index - 1].take, '따라 한 수는 가져간 수가 같다');
    assert.notEqual(full[index].pile, full[index - 1].pile, '따라 한 수는 다른 더미에서 가져간다');
    // 따라 한 수는 풀이 프로그램이 낸 이기는 수이기도 하다.
    const before = replay(game[0].board, full.slice(0, index)).state;
    assert.deepEqual(winningMoves(game[0].board, before), [full[index]]);
  }
  // 마지막 돌은 따라 한 쪽(나중에 둔 쪽)이 가져갔다.
  assert.equal(replay(game[0].board, full).over, true);
  assert.equal(full.length % 2, 0);
  assert.match(game.at(-1).note, /마지막 돌을 따라 가져가요$/);
  // 같은 두 더미에서는 무엇을 가져가도 상대가 따라 할 수 있고, 따라 하면 다시 같아진다(9개까지 모두 따진다).
  for (let count = 1; count <= LIMITS.pile.max; count++) {
    const board = { kind: 'piles', piles: [count, count] };
    for (const move of movesOf(board, [count, count])) {
      const after = applyMove(board, [count, count], move);
      const copy = applyMove(board, after, { pile: 1 - move.pile, take: move.take });
      assert.notEqual(copy, null);
      assert.equal(copy[0], copy[1]);
    }
  }
  // 3장: 5개와 3개에서 많은 더미의 2개를 가져가면 3개와 3개가 된다.
  const [before, after] = T.why.two[2].figures;
  assert.deepEqual(before.board.piles, [5, 3]);
  assert.match(before.note, /^5개와 3개예요$/);
  assert.deepEqual(stateOf(after), [3, 3]);
  assert.match(after.note, /2개를 가져가서 3개와 3개로 만들어요/);
  // 4장의 표: 이기는 쪽을 풀이 프로그램으로 다시 구한다. 같은 두 더미와 다른 두 더미가 모두 있다.
  const table = T.why.two[3].table;
  for (const row of table) {
    const board = { kind: 'piles', piles: row.piles };
    assert.equal(checkBoard(board), null);
    assert.equal(row.winner, solve(board).winner, row.piles.join(','));
    assert.equal(row.winner === 'second', row.piles[0] === row.piles[1], row.piles.join(','));
  }
  assert.deepEqual([...new Set(table.map((row) => row.winner))].sort(), ['first', 'second']);
  assert.deepEqual(T.table.two, ['판', '이기는 쪽']);
});

test('세 더미에는 "왜 그럴까?"를 붙이지 않는다(일부러 까닭을 남겨 둔 판). 절반까지와 두 더미에서 같은 수도도 그렇다', () => {
  assert.match(T._설명, /세 더미는 일부러 까닭을 남겨 둔 판이다\. 그래서 '왜 그럴까\?'를 붙이지 않았다\./);
  assert.match(T._설명, /절반까지와 두 더미에서 같은 수도도 일부러 까닭을 남겨 두었다\./);
  assert.equal(T.why.three, undefined);
  for (const game of NO_WHY) assert.equal(T.why[game], undefined, game);
  assert.deepEqual(Object.keys(T.why).sort(), GAMES.filter((game) => !NO_WHY.includes(game)).sort());
  for (const item of figures) assert.notEqual(gameOf(item.board), 'three');
  for (const slide of slides) assert.doesNotMatch(slide.say, /세 더미|셋째/);
  // 이진법이라는 말은 대본 어디에도 없다.
  for (const [path, text] of strings) assert.doesNotMatch(text, /이진/, path);
  // 화면 코드: 대본에 이야기가 없는 게임에서는 "왜 그럴까?"를 열지 않고, 알리는 말도 하지 않는다.
  assert.match(code, /const slides = T\.why\[round\.mode\];\s*if \(!slides \|\| !whyOpen\(log\.allRecords\(\), round\.mode\)\) return null;/);
  assert.match(code, /else if \(T\.why\[round\.mode\] && finishedCount/);
  // "왜 그럴까?"를 권하는 말은 하나뿐이다.
  assert.equal(T.right['why-invite'], '왜 그런지 궁금하면 왜 그럴까 단추를 눌러 보세요.');
  for (const key of RIGHT_KEYS.filter((item) => item !== 'why-invite')) assert.doesNotMatch(T.right[key], /왜 그럴까/, key);
});

test('판 고르기의 그림: 단계마다 그 단계의 게임이고, 그림 속의 수는 둘 수 있는 수다', () => {
  for (const rung of LADDER) {
    const picture = T.levels.find((entry) => entry.level === rung.level).picture;
    if (rung.game === 'make') {
      assert.equal(picture.blank, true);
      continue;
    }
    assert.equal(checkBoard(picture.board), null, `${rung.level}단계`);
    assert.equal(gameOf(picture.board), rung.game, `${rung.level}단계`);
    assert.equal(replay(picture.board, picture.trail).ok, true, `${rung.level}단계의 그림`);
    if (rung.game === 'choco') assert.ok(rung.boards.some(([w, h]) => w === picture.board.w && h === picture.board.h), `${rung.level}단계`);
    else {
      const counts = isHeap(picture.board) ? [picture.board.n] : picture.board.piles;
      for (const count of counts) assert.ok(count >= rung.stones[0] && count <= rung.stones[1], `${rung.level}단계`);
    }
  }
  // 5~7단계의 그림은 그 게임만의 수 하나를 보인다: 12개에서 4개(약수), 10개에서 5개(절반), 두 더미에서 2개씩.
  const shown = (level) => T.levels.find((entry) => entry.level === level).picture.trail;
  assert.ok(takesOf({ kind: 'divisor' }, 12).includes(shown(5)[0].take));
  assert.equal(shown(6)[0].take, 10 / 2);
  assert.equal(shown(7)[0].pile, 'both');
});

test('5~7단계의 풀이: 판 그림 뒤에 표를 한 장 더 붙인다. 표의 승패는 풀이 프로그램이 따진다', () => {
  assert.match(code, /if \(keepsLast\(board\)\) \{\s*pages\.push\(\{ say: T\.solution\.marks, nodes: \[marksOf\(\{ game: board\.kind, upto: board\.n, per: SOLUTION_PER, note: T\.solution\['marks-note'\] \}\)\] \}\);/);
  assert.match(code, /const board = \{ kind: 'both', piles: \[a, b\] \};\s*if \(!isWin\(board, startState\(board\)\)\) pairs\.push\(\[a, b\]\);/);
  assert.equal(fill(T.solution.pairs, { k: LIMITS.pile.max }), '더미마다 9개까지에서, 차례가 오면 지는 두 더미는 이것뿐이에요. 두 더미의 차례를 바꾼 판도 같아요.');
  assert.deepEqual(T.table.both, ['두 더미', '차례가 오면']);
  // 더미마다 9개까지에서 지는 두 더미는 셋뿐이다(차례를 바꾼 것은 같은 판으로 친다).
  const pairs = [];
  for (let a = 1; a <= LIMITS.pile.max; a++) {
    for (let b = a; b <= LIMITS.pile.max; b++) {
      const { kind, max, state } = fromBoard({ kind: 'both', piles: [a, b] });
      if (!bruteWin(kind, max, state)) pairs.push([a, b]);
    }
  }
  assert.deepEqual(pairs, [[1, 2], [3, 5], [4, 7]]);
});

test('하던 판: 5~7단계의 판은 그 단계의 게임이어야 하고, 직접 만든 판은 지금의 8단계와 예전의 5단계를 모두 받는다', () => {
  assert.match(code, /if \(saved\.custom === true\) return \[MAKE_LEVEL, OLD_MAKE_LEVEL\]\.includes\(saved\.level\) && DRAFT_KINDS\.includes\(saved\.board\.kind\);/);
  assert.match(code, /saved\.level <= TOP_LEVEL && rungOf\(saved\.level\)\.game === saved\.mode;/);
  assert.match(code, /if \(!levelOk\(saved\)\) return false;/);
  assert.deepEqual([TOP_LEVEL, MAKE_LEVEL, OLD_MAKE_LEVEL], [7, 8, 5]);
  // 예전의 직접 만들기(5단계)에서 만든 판은 지금의 5단계(약수 빼기)의 판과 꼴이 달라서 섞이지 않는다.
  assert.equal(rungOf(OLD_MAKE_LEVEL).game, 'divisor');
  assert.equal(generateBoard(OLD_MAKE_LEVEL, 1).board.kind, 'divisor');
});

test('직접 만들기: 게임을 고르고 수를 정하면, 잘 두었을 때 어느 쪽이 이기는지 알려 준다', () => {
  const make = part('id="make-duel"', '<script');
  for (const game of ['choco', 'one', 'piles']) {
    assert.ok(make.includes(`data-game="${game}"`), game);
    assert.ok(make.includes(`id="duel-make-${game}"`), game);
  }
  for (const id of ['w', 'h', 'n', 'p0', 'p1', 'p2']) for (const way of ['fewer', 'more']) assert.ok(make.includes(`id="duel-make-${id}-${way}"`), `${id}-${way}`);
  // 한 번에 가져갈 수 있는 수(1~4)와 더미의 수(2~3)
  for (let take = LIMITS.take.min; take <= LIMITS.take.max; take++) assert.ok(make.includes(`data-take="${take}"`), `한 번에 ${take}개`);
  for (let count = LIMITS.piles.min; count <= LIMITS.piles.max; count++) assert.ok(make.includes(`data-count="${count}"`), `더미 ${count}개`);
  assert.equal([...make.matchAll(/data-take="/g)].length, 4);
  assert.equal([...make.matchAll(/data-count="/g)].length, 2);
  assert.match(make, /id="duel-make-solve"[^>]*>선생님, 누가 이길까요\?</);
  // 선생님은 판을 풀어 주지 않고 누가 이기는지 알려 준다. 그래서 안내의 끝은 "물어볼 수도 있어요"다.
  assert.match(T.make.intro, /다 정하면 누가 이기는지 선생님에게 물어볼 수도 있어요\.$/);
  assert.match(make, /id="duel-make-play"[^>]*>내가 해 볼래요</);
  assert.equal(fill(T.make.cells, { n: 5 }), '5칸');
  assert.equal(fill(T.make.stones, { n: 25 }), '25개');
  // 한 칸짜리 초콜릿은 처음부터 둘 수가 없다. 그렇다고 사실대로 말하고, 두어 보는 단추를 끈다.
  assert.equal(solve({ kind: 'choco', w: 1, h: 1 }).first, false);
  assert.match(T.make.nomove, /쪼갤 금이 없어요/);
  assert.match(code, /\$\('duel-make-play'\)\.disabled = movesOf\(board, startState\(board\)\)\.length === 0;/);
  // 만든 판은 풀이 프로그램이 풀고, 그 결과를 기록에 남긴다.
  assert.match(code, /kind: 'made',/);
  assert.match(code, /solution: \{ winner: result\.winner, positions: result\.positions \},/);
});

test('index.html: 누가 이길까의 카드, 판, 답하는 칸, 도구가 있다', () => {
  for (const id of [
    'home-duel-sample',
    'home-duel-ask',
    'home-duel-play',
    'home-duel-pick',
    'home-duel-make',
    'home-duel-blank',
    'duel-board',
    'duel-count',
    'duel-status',
    'duel-pad',
    'duel-choose',
    'duel-first',
    'duel-second',
    'duel-turn-box',
    'duel-turn',
    'duel-choco-note',
    'duel-stones-box',
    'duel-pick-line',
    'duel-take',
    'duel-swap',
    'duel-replay',
    'make-duel',
    'duel-make-games',
    'duel-make-takes',
    'duel-make-counts',
    'duel-make-third',
    'duel-make-board',
    'duel-make-result',
  ]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  for (const label of ['누가 이길까', '누가 먼저 둘까요?', '먼저 둘래요', '나중에 둘래요', '가져가기', '초콜릿 쪼개기', '한 더미', '여러 더미', '돌의 수', '한 번에 가져가는 수', '더미의 수', '더미마다 돌의 수']) {
    assert.ok(screenText.includes(label), label);
  }
  // 카드는 "퍼즐 만들기" 앞, 조각 덮기 뒤에 있고, "만들기" 목록에도 있다.
  assert.ok(html.indexOf('id="tile-title"') < html.indexOf('id="duel-title"'));
  assert.ok(html.indexOf('id="duel-title"') < html.indexOf('id="make-title"'));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-duel-make" class="menu-item"/);
  // 이 형식에는 무르기와 되돌리기가 없다(선생님과 번갈아 두는 판이다).
  assert.match(code, /\$\('undo'\)\.hidden = true;\s*\$\('reset'\)\.hidden = true;/);
});

test('처음 화면: 카드가 가로 1280px에서 한 줄에 넉 장씩 놓이고, 앞의 두 줄(여덟 장)은 굴리지 않고 보인다', () => {
  const cards = part('id="doors"', 'id="make-menu"');
  assert.equal([...cards.matchAll(/class="panel door[ "]/g)].length, 28);
  const css = read('src/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const doors = css.match(/\n\.doors \{([^}]*)\}/)[1];
  const [, width] = doors.match(/grid-template-columns:\s*repeat\(auto-fill,\s*minmax\((\d+)px,\s*1fr\)\)/);
  const [, gap] = doors.match(/gap:\s*(\d+)px/);
  const [, low] = doors.match(/grid-auto-rows:\s*minmax\((\d+)px,\s*\d+px\)/);
  // 가로 1280px(안쪽 1256px)에서 한 줄에 넉 장이라, 여덟 장까지 두 줄이다.
  const perRow = Math.floor((1256 + Number(gap)) / (Number(width) + Number(gap)));
  assert.equal(perRow, 4);
  // 스물여덟 장이라 일곱 줄이다(셋째 줄은 조각 못 들어가게 막기, 강 건너기, 컵 뒤집기와 세 색 무리, 민들레와 바람, 넷째 줄은 주사위 미로와 길 세기, 숨은 규칙 찾기, 엉킨 그림 풀기, 켜고 끄기와 숫자 마술, 다섯째 줄은 방 한 번씩 돌기, 규칙 기계와 규칙이 깨지는 판, 똑같이 섞이게 자르기, 눈대중, 여섯째 줄은 자르고 붙이기, 접히는 모양 가리기, 도미노 가로세로, 조각 가짓수 찾기, 일곱째 줄은 마법 네모와 겹친 칸, 닿지 않게 놓기와 구역 긋기, 열쇠 미로, 퍼즐 만들기).
  assert.ok(Math.ceil(28 / perRow) === 7);
  // 높이 800px에서 하던 판 띠가 있어도(카드 칸의 높이 426px) 두 줄이 굴리지 않고 들어간다.
  assert.ok(2 * Number(low) + Number(gap) <= 426);
  // 그리고 셋째 줄의 윗부분(제목 한 줄, 40px)이 보여서 카드가 더 있다는 것을 알 수 있다.
  assert.ok(2 * Number(low) + 2 * Number(gap) + 40 <= 426, `셋째 줄이 ${426 - 2 * Number(low) - 2 * Number(gap)}px만 보여요`);
});

// ---- 수준 맞추기 ----
let nextId = 0;
function duel(overrides = {}) {
  nextId += 1;
  return {
    kind: 'round',
    id: `u${nextId}`,
    format: 'duel',
    level: 2,
    seed: nextId + 1,
    custom: false,
    mode: 'one',
    board: { kind: 'one', n: 7, max: 2 },
    solution: { possible: true, winner: 'first', positions: 8 },
    outcome: 'solved',
    hintsOpened: 0,
    answers: [{ t: 3, answer: 'first', correct: true, guess: null }],
    chose: true,
    first: 'kid',
    choseWinner: true,
    winner: 'kid',
    rematch: false,
    moveCount: 3,
    turnCount: 5,
    seconds: 40,
    ...overrides,
  };
}
const lost = (overrides = {}) => duel({ answers: [{ t: 3, answer: 'second', correct: false, guess: null }], first: 'teacher', choseWinner: false, winner: 'teacher', ...overrides });

test('누가 이길까의 수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다', () => {
  const tuning = tuningFor('duel');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, TOP_LEVEL);
  assert.equal(tuning.topLevel, 7);
  for (let level = 1; level <= TOP_LEVEL; level++) assert.equal(typeof tuning.expectedSeconds[level], 'number', `${level}단계`);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.fastWin, true);
  assert.equal(tuning.whyAfter, 'finished');
  assert.deepEqual(recommend([], 'duel'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  // 임시값이라고 적어 두었다.
  assert.match(read('src/core/level.js'), /누가 이길까\(모두 임시\)/);
  // 다른 형식의 값은 그대로다.
  assert.equal(tuningFor('coins').startLevel, TUNING.startLevel);
  assert.equal(tuningFor('trace').startLevel, 1);
  assert.equal(tuningFor('code').startLevel, 2);
  assert.equal(tuningFor('swap').whyAfter, 'fewest');
  assert.equal(tuningFor('tile').whyAfter, undefined);
  for (const format of ['coins', 'trace', 'code', 'swap', 'tile']) assert.equal(tuningFor(format).fastWin, undefined, format);
});

test('"한 번에 빠르게"는 이기는 쪽을 스스로 고르고 그 판을 이긴 것이다. 연달아 그러면 더 어려운 판을 권한다', () => {
  assert.deepEqual(recommend([duel(), duel()], 'duel'), { level: 2, small: false, offerHarder: true, harderLevel: 3, reason: 'fast' });
  assert.equal(recommend([duel()], 'duel').offerHarder, false, '한 판으로는 권하지 않는다');
  // 걸린 시간은 보지 않는다(오래 생각하고 이긴 판도 같다).
  assert.equal(recommend([duel({ seconds: 900 }), duel({ seconds: 900 })], 'duel').offerHarder, true);
  // 나중에 두는 쪽이 이기는 판에서 나중을 골라 이긴 것도 같다.
  const second = () => duel({ answers: [{ t: 3, answer: 'second', correct: true, guess: null }], first: 'teacher', solution: { possible: true, winner: 'second', positions: 10 } });
  assert.equal(recommend([second(), duel()], 'duel').offerHarder, true);
  // 이기는 쪽을 골랐지만 잘못 두어 진 판, 지는 쪽을 골라 진 판은 아니다.
  assert.equal(recommend([duel(), duel({ winner: 'teacher' })], 'duel').offerHarder, false);
  assert.equal(recommend([duel(), lost()], 'duel').offerHarder, false);
  // 힌트를 열었거나 작은 판으로 두어 본 판은 아니다.
  assert.equal(recommend([duel(), duel({ hintsOpened: 1 })], 'duel').offerHarder, false);
  // 고르기가 없는 맨 첫 판과 자리를 바꿔서 다시 둔 판은 스스로 고른 판이 아니다.
  assert.equal(recommend([duel(), duel({ level: 1, seed: 1, chose: false })], 'duel').offerHarder, false);
  assert.equal(recommend([duel(), duel({ chose: false, rematch: true })], 'duel').offerHarder, false);
  // 단계가 다른 판이 섞이면 권하지 않는다. 맨 위 단계에서는 직접 만들기를 가리킨다.
  assert.equal(recommend([duel({ level: 1 }), duel()], 'duel').offerHarder, false);
  assert.deepEqual(recommend([duel({ level: 4 }), duel({ level: 4 })], 'duel'), { level: 4, small: false, offerHarder: true, harderLevel: 5, reason: 'fast' });
  assert.deepEqual(recommend([duel({ level: 7 }), duel({ level: 7 })], 'duel'), { level: 7, small: false, offerHarder: true, harderLevel: MAKE_LEVEL, reason: 'fast' });
});

test('연달아 진 것만으로는 내려가지 않는다. 연달아 그만두면 조용히 한 단계 아래를 먼저 보여 준다', () => {
  // 끝까지 두고 진 판은 그만둔 판이 아니다(지는 것은 발견의 재료다).
  assert.deepEqual(recommend([lost(), lost(), lost(), lost()], 'duel'), { level: 2, small: false, offerHarder: false, harderLevel: null, reason: 'steady' });
  assert.equal(recommend([lost({ level: 4 }), lost({ level: 4 })], 'duel').level, 4);
  // 힌트를 다 열고 진 판도 끝까지 둔 판이다.
  assert.equal(recommend([lost({ hintsOpened: 3 })], 'duel').level, 2);
  // 두다가 그만둔 판이 이어지면 한 단계 아래다. 맨 아래에서는 가장 작은 판이다.
  const quit = (level) => duel({ level, outcome: 'left', winner: null, moveCount: 2 });
  assert.deepEqual(recommend([quit(3), quit(3)], 'duel'), { level: 2, small: false, offerHarder: false, harderLevel: null, reason: 'quit' });
  assert.deepEqual(recommend([quit(1), quit(1)], 'duel'), { level: 1, small: true, offerHarder: false, harderLevel: null, reason: 'quit' });
  assert.equal(recommend([quit(3)], 'duel').reason, 'steady');
  assert.equal(recommend([quit(3), lost({ level: 3 })], 'duel').reason, 'steady', '그만둔 판 뒤에 끝까지 둔 판');
  // 들여다보기만 한 판(고르지도, 두지도, 힌트를 열지도 않았다)은 세지 않는다. 직접 만든 판도 세지 않는다.
  const peek = () => duel({ level: 3, outcome: 'left', winner: null, answers: [], first: null, choseWinner: null, moveCount: 0, turnCount: 0 });
  assert.equal(recommend([peek(), peek()], 'duel').reason, 'start');
  // 예전의 직접 만들기 단계(5단계)에서 둔 판도 지금의 5단계(약수 빼기)로 세지 않는다.
  const custom = (level) => duel({ level, custom: true, outcome: 'left', winner: null });
  assert.equal(recommend([custom(OLD_MAKE_LEVEL), custom(OLD_MAKE_LEVEL)], 'duel').reason, 'start');
  assert.equal(recommend([custom(MAKE_LEVEL), custom(MAKE_LEVEL)], 'duel').reason, 'start');
  // 다른 형식의 기록은 영향을 주지 않고, 이 형식의 기록도 다른 형식에 영향을 주지 않는다.
  for (const format of ['coins', 'trace', 'code', 'swap', 'tile']) {
    assert.equal(recommend([quit(3), quit(3)], format).reason, 'start', format);
    assert.equal(recommend([duel(), duel()], format).reason, 'start', format);
  }
});

test('"왜 그럴까?"는 게임마다 세 판을 끝까지 둔 뒤에 열린다(임시)', () => {
  assert.equal(WHY_AFTER, 3);
  // 틀의 문: 이 형식의 판을 한 번 끝까지 두면 막지 않는다. 게임마다의 문은 이 형식이 따로 본다.
  assert.equal(whyUnlocked([], 'duel'), false);
  assert.equal(whyUnlocked([duel({ outcome: 'left', winner: null })], 'duel'), false);
  assert.equal(whyUnlocked([lost()], 'duel'), true);
  assert.equal(whyOpen([duel(), lost()], 'one'), false);
  assert.equal(whyOpen([duel(), lost(), duel()], 'one'), true);
  assert.equal(whyOpen([duel(), lost(), duel()], 'two'), false);
  // 다른 형식은 그대로다.
  assert.equal(whyUnlocked([duel(), duel(), duel()], 'coins'), false);
  assert.equal(whyUnlocked([duel(), duel(), duel()], 'tile'), false);
});
