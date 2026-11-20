// 참말 섬 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?" 그림 속 판의 답과 주장이 풀이 프로그램과 맞는지 본다.
// 이 형식에서 새로 지키는 것도 여기서 본다: 거짓말쟁이는 놀이 규칙일 뿐 나쁜 주민이 아니다, 주민은 동물이다,
// "적어도 한 명"과 "이거나"와 "우리"는 판에서 뜻을 정해 준다, 말의 틀도 대본에 있다, 문장의 뜻은 풀이 프로그램의 뜻과 같다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, LIE_RUNS, MAKE_LEVEL, OLD_MAKE_LEVEL, QUESTIONS, SAY_TYPES, TOP_LEVEL, boxBoards, generateBoard, sayPool } from '../src/core/logic-ladder.js';
import { ANIMALS, allWorlds, blankGuess, dayWorld, follow, judgeQuestion, labelTemplate, labelTruth, noteKeys, questionTemplate, questionWorlds, replyOf, sayTemplate, sayTruth, solve } from '../src/core/logic.js';
import { fill, sentenceCount } from '../src/core/text.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/logic.json'));
const C = JSON.parse(read('src/content/coins.json'));
const html = read('index.html');
const code = read('src/formats/logic.js');

function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_'))
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
const screenText = visibleText(html);
const part = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));
const own = [part('id="logic-title"', 'id="make-title"'), part('id="logic-follow"', 'id="why"'), part('id="logic-pad"', 'id="pad"'), part('id="make-logic"', '<script')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
/** 받침이 없는 낱말인가(뒤에 "는", "와"가 맞게 붙는다) */
const open = (word) => (word.charCodeAt(word.length - 1) - 0xac00) % 28 === 0;

/** 말 하나의 틀의 열쇠(화면이 쓰는 src/core/logic.js의 sayTemplate) */
const sayKey = (say) => sayTemplate(say)[0];
const rungOfMode = (mode) => LADDER.find((rung) => rung.mode === mode);
const values = { text: '우리는 모두 거짓말쟁이예요', a: '토끼', b: '다람쥐', n: '두', ak: '참말쟁이', bk: '거짓말쟁이', side: '왼쪽', name: '토끼', k: 3, kind: '참말쟁이', list: '토끼는 참말쟁이', what: '모름', day: '목요일', reply: '아니요', no: '첫째' };

/** 화면과 같은 방법으로 말 하나의 글을 만든다(src/formats/logic.js의 sayText와 같다). people은 동물 번호들 */
function sayText(people, say) {
  const [key, parts] = sayTemplate(say);
  const nameOf = (index) => (index === undefined ? '' : T.animals[people[index]].name);
  const kindOf = (kind) => (kind === undefined ? '' : T.kinds[kind ? 'knight' : 'liar']);
  return fill(T.says[key], { a: nameOf(parts.a), b: nameOf(parts.b), n: parts.n === undefined ? '' : T.counts[parts.n], ak: kindOf(parts.ak), bk: kindOf(parts.bk), day: parts.day === undefined ? '' : T.days[parts.day] });
}

/** 질문 하나의 글(src/formats/logic.js의 questionText와 같다). animal은 묻는 주민의 동물 번호 */
function questionText(animal, question) {
  const [key, parts] = questionTemplate(question);
  const a = T.animals[animal].name;
  if (key === 'would') return fill(T.questions.would, { text: questionText(animal, question.inner), a });
  return fill(T.questions[key], { side: parts.side === undefined ? '' : T.sides[parts.side], a });
}
/** 상자의 글(src/formats/logic.js의 labelText와 같다) */
function labelText(label, at) {
  const [key, parts] = labelTemplate(label, at);
  return fill(T.labels[key], { a: parts.a === undefined ? '' : T.boxes[parts.a], b: parts.b === undefined ? '' : T.boxes[parts.b] });
}

/**
 * 문장을 글자 그대로 읽어 뜻을 구한다(풀이 프로그램과 따로 적었다). 배정 하나에서 그 문장이 참인지 돌려주는 함수.
 * people은 동물 번호들, by는 말한 주민. 읽을 수 없는 문장이면 null.
 */
function readSay(text, people, by) {
  const names = people.map((animal) => T.animals[animal].name);
  const who = (word) => (word === '나' || word === '내' ? by : names.indexOf(word));
  const kindOf = (word) => ({ 참말쟁이: true, 거짓말쟁이: false })[word];
  const countOf = (word) => Number(Object.entries(T.counts).find(([, value]) => value === word)?.[0]);
  const liars = (kinds) => kinds.filter((kind) => !kind).length;
  let m;
  if ((m = text.match(/^(나|\S+)는 (참말쟁이|거짓말쟁이)예요\.$/))) return ({ kinds }) => kinds[who(m[1])] === kindOf(m[2]);
  if ((m = text.match(/^(\S+)와 (나|\S+)는 (같은|다른) 종류예요\.$/))) return ({ kinds }) => (kinds[who(m[1])] === kinds[who(m[2])]) === (m[3] === '같은');
  if ((m = text.match(/^우리는 모두 (참말쟁이|거짓말쟁이)예요\.$/))) return ({ kinds }) => kinds.every((kind) => kind === kindOf(m[1]));
  if ((m = text.match(/^우리 가운데 거짓말쟁이는 딱 (\S+) 명이에요\.$/))) return ({ kinds }) => liars(kinds) === countOf(m[1]);
  if (text === '우리 가운데 적어도 한 명은 거짓말쟁이예요.') return ({ kinds }) => liars(kinds) >= 1;
  if ((m = text.match(/^(나|\S+)와 (\S+) 가운데 적어도 한 명은 (참말쟁이|거짓말쟁이)예요\.$/))) return ({ kinds }) => kinds[who(m[1])] === kindOf(m[3]) || kinds[who(m[2])] === kindOf(m[3]);
  if ((m = text.match(/^(내|\S+)가 (참말쟁이|거짓말쟁이)이거나, (\S+)가 (참말쟁이|거짓말쟁이)예요\.$/))) return ({ kinds }) => kinds[who(m[1])] === kindOf(m[2]) || kinds[who(m[3])] === kindOf(m[4]);
  if ((m = text.match(/^마을로 가는 길은 (왼쪽|오른쪽)이에요\.$/))) return ({ road }) => road === (m[1] === '왼쪽' ? 'left' : 'right');
  // 요일 섬: "어제는 내가 거짓말하는 날이었어요", "내일은 여우가 참말하는 날이에요", "오늘은 목요일이에요"
  const dayAt = (word, day) => (word === '어제는' ? (day + 6) % 7 : word === '내일은' ? (day + 1) % 7 : day);
  if ((m = text.match(/^(어제는|내일은) (내|\S+)가 (거짓말|참말)하는 날이(었어요|에요)\.$/)) && (m[1] === '어제는') === (m[4] === '었어요')) {
    return ({ day, lies }) => lies[who(m[2])].includes(dayAt(m[1], day)) === (m[3] === '거짓말');
  }
  if ((m = text.match(/^(어제는|오늘은|내일은) (\S+요일)이(었어요|에요)\.$/)) && (m[1] === '어제는') === (m[3] === '었어요') && T.days.includes(m[2])) {
    return ({ day }) => dayAt(m[1], day) === T.days.indexOf(m[2]);
  }
  return null;
}

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 이름은 "참말 섬"이다', () => {
  assert.ok(strings.length > 100);
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.equal(T.title, '참말 섬');
  assert.match(html, /<h2 id="logic-title">참말 섬<\/h2>/);
});

test('단계 목록이 사다리와 같고, 표시는 기본·기본·응용·도전·응용·도전·도전·도전이다. 직접 만들기는 8단계다', () => {
  assert.deepEqual(T.levels.map((entry) => entry.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(LADDER.map((rung) => C.tags[rung.tag]), ['기본', '기본', '응용', '도전', '응용', '도전', '도전', '도전']);
  assert.equal(T.levels.at(-1).name, '직접 만들기');
  assert.equal(T.levels.at(-1).level, MAKE_LEVEL);
  assert.equal(T.levels.at(-1).picture.blank, true);
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) assert.ok(T.home.ask[rung.mode], `${rung.level}단계의 물음`);
  // 판 고르기의 그림: 단계마다 다르다(1단계와 5단계는 주민 둘이지만 5단계는 한 주민에게 거짓말쟁이의 겹선 테두리를 둘러 "적어도 한 명은 거짓말쟁이"를 보인다).
  const pictures = T.levels.map((entry) => JSON.stringify(entry.picture));
  assert.equal(new Set(pictures).size, pictures.length);
  assert.deepEqual(T.levels.slice(4, 7).map((entry) => entry.picture), [{ faces: 2, liar: 1 }, { faces: 2, week: true }, { faces: 1, ask: true, fork: true }]);
  // 화면: 판 고르기 그림에 쳐 본 종류의 테두리, 한 주, 물음표를 그린다.
  assert.match(code, /marks: Number\.isInteger\(picture\.liar\)/);
  assert.match(code, /week: picture\.week \? DAYS : undefined,/);
  assert.match(code, /ask: picture\.ask \? T\.home\.blank : undefined,/);
});

test('하던 판 되살리기: 1~4단계의 번호는 그대로이고, 5~7단계를 더하기 전에 적어 둔 직접 만든 판(5단계)도 받는다', () => {
  assert.equal(OLD_MAKE_LEVEL, 5);
  assert.match(code, /if \(saved\.custom === true\) return \[MAKE_LEVEL, OLD_MAKE_LEVEL\]\.includes\(saved\.level\) && saved\.mode === 'folk' && saved\.board\.kind === 'folk';/);
  assert.match(code, /saved\.mode === modeOf\(saved\.board, saved\.level, false\)/);
  assert.match(code, /!levelOk\(saved\)/);
  // 공책에서 여는 직접 만든 판(옛 5단계)도 단계 번호를 보지 않고 주민 판으로 연다.
  assert.match(code, /const rung = custom \? null : rungOf\(level\);/);
});

test('주민은 동물이다. 이름은 받침이 없는 낱말이고 서로 다르다. 사람 이름이 없다', () => {
  assert.equal(T.animals.length, ANIMALS);
  const names = T.animals.map((animal) => animal.name);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) assert.ok(open(name), `${name}: 받침이 있어요`);
  for (const animal of T.animals) assert.ok(animal.face.length > 0, animal.name);
  // 사람을 가리키는 말이 없다(동물뿐이다).
  for (const [path, text] of strings) assert.doesNotMatch(text, /사람|아저씨|아줌마|왕자|공주|씨는/, `${path}: ${text}`);
});

test('거짓말쟁이는 놀이 규칙일 뿐이다: 첫 규칙 글에서 풀어 주고, 나쁘게 그리는 말이 없다', () => {
  assert.match(T.rules.pair, /거짓말쟁이가 늘 반대로 말하는 것은 이 섬의 놀이 규칙이에요/);
  for (const key of ['folk', 'count', 'road', 'day']) assert.match(T.rules[key], /놀이 규칙/, key);
  const bad = /나쁜|나빠|못된|속이|속여|사기|도둑|벌을|혼나|미워|싫어|거짓말은 나쁜/;
  for (const [path, text] of strings) assert.doesNotMatch(text, bad, `${path}: ${text}`);
  assert.doesNotMatch(own, bad);
});

test('규칙 설명은 세 문장을 넘지 않고, 묻는 것으로 끝난다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['ask', 'box', 'count', 'day', 'folk', 'pair', 'road']);
  // 5단계(주민 둘, "적어도 한 명")는 1단계의 규칙 글을 쓴다.
  assert.match(code, /round\.mode === 'some' \? 'pair'/);
  for (const [key, text] of Object.entries(T.rules)) {
    assert.ok(sentenceCount(text) <= 3, `${key}: ${text}`);
    assert.match(text, /까요\?$/, key);
  }
  for (const key of ['pair', 'folk']) assert.match(T.rules[key], /각각 참말쟁이일까요, 거짓말쟁이일까요\?$/, key);
  // 상자: 글은 참일 수도 거짓일 수도 있고, 판 위의 한 줄은 늘 참이다.
  assert.equal(T.rules.box, '보물은 상자 하나에만 있어요. 상자의 글은 참일 수도 거짓일 수도 있지만, 판 위의 한 줄은 늘 참이에요. 보물은 어느 상자에 있을까요?');
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 27, '직접 만들기 안내 글은 형식마다 하나');
  assert.ok(sentenceCount(guides[7]) <= 3, guides[7]);
  assert.match(guides[7], /누가 참말쟁이이고 누가 거짓말쟁이인지 하나로 정해지는 판을 만들 수 있을까요\?/);
  assert.match(guides[7], /이 주민들이 모두 할 수는 없는 말도 만들어 볼 수 있어요\./);
});

test('말의 틀은 대본에 있다: 판에 나올 수 있는 말마다 틀이 있고, 끼울 값만 바꾼다', () => {
  const keys = new Set();
  for (const types of Object.values(SAY_TYPES)) for (const n of [2, 3]) for (const say of sayPool(n, types)) keys.add(sayKey(say));
  for (const k of [true, false]) keys.add(sayKey({ by: 0, s: { t: 'me', k } }));
  for (const key of keys) assert.ok(T.says[key], `틀이 없어요: ${key}`);
  assert.deepEqual([...keys].sort(), Object.keys(T.says).sort());
  assert.equal(fill(T.says['is-false'], values), '토끼는 거짓말쟁이예요.');
  assert.equal(fill(T.says['same-me'], values), '토끼와 나는 같은 종류예요.');
  assert.equal(fill(T.says.diff, values), '토끼와 다람쥐는 다른 종류예요.');
  assert.equal(fill(T.says.liars, values), '우리 가운데 거짓말쟁이는 딱 두 명이에요.');
  // "이거나": 두 쪽의 종류가 같으면 "가운데 적어도 한 명은", 다르면 "~가 …이거나, ~가 …예요"
  assert.equal(fill(T.says['or-true'], values), '토끼와 다람쥐 가운데 적어도 한 명은 참말쟁이예요.');
  assert.equal(fill(T.says['or-false-me'], values), '나와 토끼 가운데 적어도 한 명은 거짓말쟁이예요.');
  assert.equal(fill(T.says.or, values), '토끼가 참말쟁이이거나, 다람쥐가 거짓말쟁이예요.');
  assert.equal(fill(T.says['or-me'], { ...values, ak: '거짓말쟁이', b: '하마', bk: '참말쟁이' }), '내가 거짓말쟁이이거나, 하마가 참말쟁이예요.');
  for (const text of Object.values(T.says)) assert.doesNotMatch(text, /라면|나는 거짓말쟁이이거나/, text);
  assert.equal(T.says['me-true'], '나는 참말쟁이예요.');
  assert.equal(T.says['me-false'], '나는 거짓말쟁이예요.');
  assert.deepEqual(T.counts, { 1: '한', 2: '두', 3: '세' });
  // 상자의 글과 조건
  for (const key of ['here', 'not-here', 'in', 'not-in', 'in-or', 'in-or-here']) assert.ok(T.labels[key], key);
  assert.equal(fill(T.labels['in-or'], values), '보물은 토끼 상자나 다람쥐 상자에 있어요.');
  assert.equal(labelText({ t: 'in-or', a: 0, b: 2 }, 0), '보물은 이 상자나 셋째 상자에 있어요.');
  assert.equal(labelText({ t: 'in-or', a: 0, b: 2 }, 2), '보물은 이 상자나 첫째 상자에 있어요.');
  assert.equal(labelText({ t: 'in-or', a: 0, b: 2 }, 1), '보물은 첫째 상자나 셋째 상자에 있어요.');
  assert.deepEqual(Object.keys(T.boxRules).sort(), ['false-1', 'false-2', 'true-1', 'true-2']);
});

test('말의 뜻은 풀이 프로그램의 뜻과 같다: 나올 수 있는 말마다, 배정마다 문장을 글자 그대로 읽은 뜻이 sayTruth와 같다', () => {
  // 주민 둘과 셋, 말한 주민과 가리키는 주민의 모든 조합. "이거나"는 네 가지 참·거짓 조합(ak, bk)이 모두 들어 있다.
  // (요일 섬의 말은 아래 테스트에서 요일 판의 배정으로 따로 본다)
  const types = [...new Set([...Object.values(SAY_TYPES).flat(), 'or'])].filter((type) => !SAY_TYPES.day.includes(type));
  const orKeys = new Set();
  let checked = 0;
  for (const n of [2, 3]) {
    for (const people of [[0, 1, 2].slice(0, n), [6, 7, 8].slice(0, n)]) {
      const pool = [...sayPool(n, types), ...[true, false].flatMap((k) => Array.from({ length: n }, (_, by) => ({ by, s: { t: 'me', k } })))];
      for (const say of pool) {
        const text = sayText(people, say);
        const meaning = readSay(text, people, say.by);
        assert.ok(meaning, `읽을 수 없는 문장: ${text}`);
        if (say.s.t === 'or') orKeys.add(`${say.s.ak}-${say.s.bk}:${sayKey(say)}`);
        for (const world of allWorlds(n, true)) {
          assert.equal(meaning(world), sayTruth(say, world), `${text} ${JSON.stringify(say)} ${JSON.stringify(world)}`);
          checked += 1;
        }
      }
    }
  }
  assert.ok(checked > 1000);
  // "이거나"의 새 열쇠가 모두 쓰였고, 참·참은 "적어도 한 명은 참말쟁이", 거짓·거짓은 "적어도 한 명은 거짓말쟁이", 섞이면 "이거나"다.
  assert.deepEqual(
    [...orKeys].sort(),
    ['false-false:or-false', 'false-false:or-false-me', 'false-true:or', 'false-true:or-me', 'true-false:or', 'true-false:or-me', 'true-true:or-true', 'true-true:or-true-me'],
  );
});

test('요일 섬의 말의 뜻은 풀이 프로그램의 뜻과 같다: 말마다, 거짓말 요일마다, 오늘마다 문장을 글자 그대로 읽은 뜻이 sayTruth와 같다', () => {
  let checked = 0;
  const keys = new Set();
  for (const n of [1, 2]) {
    const people = [2, 4].slice(0, n);
    for (const say of sayPool(n, SAY_TYPES.day)) {
      const text = sayText(people, say);
      keys.add(sayKey(say));
      const meaning = readSay(text, people, say.by);
      assert.ok(meaning, `읽을 수 없는 문장: ${text}`);
      for (const first of LIE_RUNS) {
        for (const second of n === 2 ? LIE_RUNS : [null]) {
          const board = { kind: 'day', people, lies: second ? [first, second] : [first], says: [say], ask: 'day' };
          for (let day = 0; day < 7; day++) {
            const world = dayWorld(board, day);
            assert.equal(meaning(world), sayTruth(say, world), `${text} ${JSON.stringify(board.lies)} ${day}`);
            checked += 1;
          }
        }
      }
    }
  }
  assert.ok(checked > 10000, String(checked));
  assert.equal(keys.size, 11);
  assert.equal(sayText([2, 4], { by: 0, s: { t: 'lieday', who: 0, off: -1, lie: true } }), '어제는 내가 거짓말하는 날이었어요.');
  assert.equal(sayText([2, 4], { by: 0, s: { t: 'lieday', who: 1, off: 1, lie: false } }), '내일은 여우가 참말하는 날이에요.');
  assert.equal(sayText([2, 4], { by: 1, s: { t: 'dayname', off: -1, day: 6 } }), '어제는 일요일이었어요.');
  assert.equal(sayText([2, 4], { by: 1, s: { t: 'dayname', off: 0, day: 3 } }), '오늘은 목요일이에요.');
  assert.deepEqual(T.days, ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일']);
  assert.deepEqual(T.dayShort, T.days.map((day) => day[0]));
});

test('상자의 글의 뜻은 풀이 프로그램의 뜻과 같고, 상자는 자기를 이름으로 부르지 않는다("이 상자")', () => {
  for (const n of [2, 3]) {
    for (const { labels } of boxBoards(n)) {
      labels.forEach((label, box) => {
        const text = labelText(label, box);
        assert.doesNotMatch(text, new RegExp(`${T.boxes[box]} 상자`), text);
        // 글자 그대로 읽기: "이 상자"는 그 상자, "○째 상자"는 그 상자
        const named = [...text.matchAll(/(이|첫째|둘째|셋째) 상자/g)].map((match) => (match[1] === '이' ? box : T.boxes.indexOf(match[1])));
        for (let at = 0; at < n; at++) {
          const inside = named.includes(at);
          assert.equal(text.endsWith('없어요.') ? !inside : inside, labelTruth(label, box, at), `${text} 보물 ${at}`);
        }
      });
    }
  }
});

test('뜻을 약속으로 정한다: "같은 종류", "다른 종류", "적어도 한 명", "이거나", "우리"', () => {
  assert.equal(T.notes.same, '‘같은 종류’는 둘 다 참말쟁이이거나, 둘 다 거짓말쟁이라는 뜻이에요.');
  assert.equal(T.notes.diff, '‘다른 종류’는 둘 가운데 하나는 참말쟁이이고, 하나는 거짓말쟁이라는 뜻이에요.');
  assert.equal(T.notes.some, '‘적어도 한 명’은 한 명일 수도 있고, 그보다 많을 수도 있다는 뜻이에요.');
  assert.equal(T.notes.or, '‘이거나’는 둘 가운데 하나만 맞아도 되고, 둘 다 맞아도 된다는 뜻이에요.');
  assert.equal(T.notes.we, '‘우리’는 이 판의 주민 모두예요.');
  assert.equal(T.notes.week, '월요일의 어제는 일요일이고, 일요일의 내일은 월요일이에요.');
  // 화면은 noteKeys로 고른 약속을 적는다.
  assert.match(code, /const notesOf = \(board\) => noteKeys\(board\)\.map\(\(key\) => T\.notes\[key\]\);/);
  // 판에 그 낱말이 나올 때만, 나오면 늘 약속을 적는다(단계마다 판 1~40번, 주민 둘의 말 두 개 모두).
  const boards = [];
  for (let level = 1; level <= TOP_LEVEL; level++) for (let seed = 1; seed <= 40; seed++) boards.push(generateBoard(level, seed).board);
  const pairs = sayPool(2, [...SAY_TYPES.small, 'or']);
  for (let i = 0; i < pairs.length; i++) for (let j = i + 1; j < pairs.length; j++) boards.push({ kind: 'folk', people: [0, 1], says: [pairs[i], pairs[j]], ask: 'kinds' });
  const seen = new Set();
  for (const board of boards) {
    if (!board.says) continue;
    const texts = board.says.map((say) => sayText(board.people, say)).join(' ');
    const silent = board.people.some((_, index) => !board.says.some((say) => say.by === index));
    const want = [
      /같은 종류/.test(texts) && 'same',
      /다른 종류/.test(texts) && 'diff',
      /적어도 한 명/.test(texts) && 'some',
      /이거나/.test(texts) && 'or',
      silent && /우리/.test(texts) && 'we',
      /어제|내일/.test(texts) && 'week',
    ].filter(Boolean);
    assert.deepEqual(noteKeys(board), want, texts);
    for (const key of want) seen.add(key);
  }
  assert.deepEqual([...seen].sort(), ['diff', 'or', 'same', 'some', 'we', 'week']);
});

test('질문 고르기(7단계): 2026-11 화면 글 점검에서 허락한 꼴만 쓴다. 되묻는 질문은 "제가 ‘…’라고 물으면, 하마는 ‘예’라고 대답할 건가요?" 하나이고, "당신"이라고 부르지 않는다', () => {
  assert.equal(rungOfMode('ask').level, 7);
  assert.deepEqual(Object.keys(T.questions).sort(), ['fact-no', 'fact-yes', 'me', 'road', 'would']);
  assert.equal(T.questions.would, '제가 ‘{text}’라고 물으면, {a}는 ‘예’라고 대답할 건가요?');
  assert.equal(questionText(6, { q: 'would', inner: { q: 'road', side: 'left' } }), '제가 ‘왼쪽 길이 마을로 가나요?’라고 물으면, 하마는 ‘예’라고 대답할 건가요?');
  assert.equal(questionText(6, { q: 'me' }), '하마는 참말쟁이인가요?');
  // 판에 나오는 질문은 모두 이 꼴이고, 한 문장이며, 너무 길지 않다.
  const texts = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const { board } = generateBoard(7, seed);
    for (const question of board.questions) texts.add(questionText(board.people[0], question));
  }
  for (const text of texts) {
    assert.equal(sentenceCount(text.replace(/‘[^’]*’/g, '‘’')), 1, text);
    assert.ok([...text].length <= 60, text);
    assert.match(text, /요\?$/, text);
    assert.doesNotMatch(text, /당신|같은 주민에게|그 주민은/, text);
    if (text.startsWith('제가')) assert.match(text, /^제가 ‘[^’]+\?’라고 물으면, \S+는 ‘예’라고 대답할 건가요\?$/, text);
  }
  for (const [path, text] of strings) assert.doesNotMatch(text, /당신/, `${path}: ${text}`);
  // 풀이의 표: 네 경우의 대답. 쓸모 있는 질문만 대답이 길과 함께 바뀌고 주민의 종류와는 상관없다.
  for (const question of [...QUESTIONS.useful, ...QUESTIONS.plainRoad, ...QUESTIONS.wouldOther, ...QUESTIONS.other]) {
    const replies = questionWorlds().map((world) => replyOf(question, world));
    const byRoad = questionWorlds().every((world, at) => replies[at] === replyOf(question, { kinds: [!world.kinds[0]], road: world.road }));
    assert.equal(judgeQuestion(question).useful, byRoad && new Set(replies).size === 2, JSON.stringify(question));
  }
  assert.equal(fill(T.solution.case, { kind: '거짓말쟁이', side: '왼쪽' }), '거짓말쟁이, 왼쪽 길');
  assert.deepEqual(T.reply, { yes: '예', no: '아니요' });
  // 화면은 질문 판을 받고, 질문 판에서는 "쳐 본 대로 고르기"를 감춘다.
  assert.match(code, /const MODES = \['pair', 'box', 'folk', 'road', 'some', 'day', 'ask'\];/);
  assert.match(code, /\$\('logic-copy'\)\.hidden = ask === 'question';/);
  assert.match(html, /id="logic-asks"[\s\S]*?어느 질문을 할까요\?/);
});

test('판의 말은 "들어맞다/어긋나다", "같은 종류/다른 종류"로 한다("맞다", "같은 쪽"을 쓰지 않는다)', () => {
  for (const [path, text] of strings) {
    assert.doesNotMatch(text, /(?<!들어)맞(지 않|아요|는 |았|게 |지)/, `${path}: ${text}`);
    assert.doesNotMatch(text, /같은 쪽|다른 쪽|꼭 /, `${path}: ${text}`);
    assert.doesNotMatch(text, /조건/, `${path}: ${text}`);
  }
  assert.deepEqual(T.status, { clash: '어긋나는 말이 {n}개 있어요', open: '어긋나는 말은 아직 없어요', fits: '모든 말이 들어맞아요', 'box-fits': '판 위의 한 줄과 들어맞아요', 'box-misfit': '판 위의 한 줄과 어긋나요' });
  assert.equal(T.make.options.same, '같은 종류');
  assert.equal(T.make.options.diff, '다른 종류');
  assert.equal(T.make.templates.liars, '거짓말쟁이는 딱 …');
  assert.doesNotMatch(T.make.templates.some, /…/);
});

test('상자: 판 위의 한 줄이 거짓인 글을 세면, 따라가 보기와 짐작 말과 힌트도 거짓인 글을 센다', () => {
  assert.equal(fill(T.follow['count-false'], { n: 1 }), '지금 거짓인 글은 1개예요.');
  assert.equal(T.follow['count-false-zero'], '지금 거짓인 글은 하나도 없어요.');
  assert.equal(fill(T.guess['box-count-false'], { n: 2 }), '보물이 그 상자에 있으면 거짓인 글이 2개가 되는 것 같아요.');
  assert.match(T.hints['box-false'][0], /거짓인 글은 몇 개/);
  assert.match(T.hints['box-false'][1], /거짓인 글의 수/);
  assert.match(code, /const key = board\.rule\.of === 'true' \? 'count' : 'count-false';/);
  assert.match(code, /round\.mode === 'box' && round\.board\.rule\.of === 'false' \? 'box-false'/);
  assert.match(code, /const tail = board\.rule\.of === 'true' \? '' : '-false';/);
  // 판 위의 한 줄이 세는 글의 수(거짓인 글 = 상자 수 - 참인 글)
  assert.match(code, /board\.rule\.of === 'true' \? trueCount : board\.labels\.length - trueCount/);
  const board = boxBoards(3).find((item) => item.rule.of === 'false');
  const truths = follow({ kind: 'box', ...board, ask: 'box' }, { kinds: [], road: null, box: board.answer });
  assert.equal(board.labels.length - truths.count, board.rule.n, '답인 상자에서 거짓인 글의 수가 판 위의 한 줄과 같다');
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 까닭을 말해 버리지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['ask', 'box', 'box-false', 'count', 'day', 'folk', 'pair', 'road', 'some']);
  // 질문 고르기의 둘째 힌트는 거꾸로 되지 않았다(2026-11 화면 글 점검 1-#13): 길이 바뀌면 대답도 바뀌는 질문을 보게 한다.
  assert.equal(T.hints.ask[1], '길을 바꿔 쳐 봤을 때 대답이 바뀌는 질문은 어느 것인가요?');
  assert.doesNotMatch(T.hints.ask.join(' '), /그대로인/);
  for (const [key, hints] of Object.entries(T.hints)) {
    assert.equal(hints.length, tuningFor('logic').hintCount, key);
    assert.equal(new Set(hints).size, 2, key);
    for (const hint of hints) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /할 수 없|못 해|못 하|때문|쳐 보고 따라가기|그러니|반대로 말하니|두 번 뒤집/, hint);
    }
  }
  assert.match(T.hints.pair[0], /한 주민을 참말쟁이라고 쳐 보면/);
  assert.match(T.hints.box[0], /보물이 첫째 상자에 있다고 쳐 보면 참인 글은 몇 개/);
  // 서로 반대되는 말을 한 짝은 판에 드물다. 쳐 봤을 때 어긋나는 말이 생긴 주민을 보게 한다.
  assert.equal(T.hints.folk[1], '참말쟁이라고 쳐 봤을 때 어긋나는 말이 생긴 주민은 누구였나요?');
});

test('틀린 답에 하는 말은 짐작이라고 밝힌다("~것 같아요"). 짚은 말을 판에서 따라가 보게 한다', () => {
  assert.deepEqual(Object.keys(T.guess).sort(), ['box-count', 'box-count-false', 'box-zero', 'box-zero-false', 'count-clash', 'count-clash-zero', 'kinds-clash', 'none-on-possible', 'question-useless', 'road-clash']);
  assert.equal(fill(T.guess['question-useless'], values), '그 질문은 길이 어느 쪽이든 ‘아니요’라는 대답이 나올 수 있는 것 같아요. 쳐 보기로 대답을 따라가 볼까요?');
  for (const [key, text] of Object.entries(T.guess)) {
    assert.match(text, /것 같아요/, key);
    assert.doesNotMatch(text, /틀렸|틀린|아니에요|땡|잘못/, key);
  }
  assert.equal(fill(T.guess['kinds-clash'], values), '고른 답대로라면 토끼의 말이 어긋나는 것 같아요. 그 말을 따라가 볼까요?');
  assert.equal(T.guess['none-on-possible'], '모든 말이 들어맞는 경우가 남아 있는 것 같아요. 한 주민씩 쳐 볼까요?');
  assert.equal(fill(T.guess['box-count'], { n: 2 }), '보물이 그 상자에 있으면 참인 글이 2개가 되는 것 같아요.');
  // 화면 코드: 틀린 답은 세지만 보여 주지 않고, 짚은 말을 판에서 눈에 띄게 한다.
  assert.match(code, /round\.flag = result\.say;/);
  assert.match(code, /flagged: flag === index,/);
});

test('맞혔을 때 하는 말은 한 일을 그대로 말한다(쳐 보기를 몇 번 바꿨는지). 따라가 보기를 켰는지는 말하지 않고, 칭찬 낱말이 없다', () => {
  const praise = /최고|잘했|대단|훌륭|멋져|멋진|천재|똑똑|완벽|짱|굉장|축하|성공/;
  for (const text of Object.values(T.right)) assert.doesNotMatch(text, /^맞아요|정답/, text);
  for (const [path, text] of strings) assert.doesNotMatch(text, praise, `${path}: ${text}`);
  assert.doesNotMatch(own, praise);
  assert.equal(fill(T.right.presses, { n: 5 }), '쳐 보기를 5번 바꿔 보고 알아냈어요.');
  assert.equal(T.right['no-presses'], '쳐 보기 없이 알아냈어요.');
  for (const text of Object.values(T.right)) assert.doesNotMatch(text, /켜|힌트/, text);
  // 두 번째 답부터 맞혔을 때: 첫 답을 틀렸다고 판정하지 않고, 따라가 보기를 썼다고도 하지 않는다.
  assert.equal(T.right['after-retry'], '처음 답을 바꿔서 찾아냈어요.');
  assert.equal(T.right.none, '이 주민들이 이 말들을 모두 할 수는 없어요.');
  assert.equal(fill(T.right.kinds, { list: [fill(T.right.kind, { name: '하마', kind: '거짓말쟁이' }), fill(T.right.kind, { name: '코알라', kind: '참말쟁이' })].join(T.right.join) }), '하마는 거짓말쟁이, 코알라는 참말쟁이예요.');
  assert.doesNotMatch(code, /followShown[^\n]*T\.right/);
});

test('따라가 보기: 1단계에서만 처음부터 켜져 있고, 그 밖의 판에서 처음 켜면 힌트 하나를 연 것으로 적는다', () => {
  assert.deepEqual(T.tool, { off: '따라가 보기 켜기', on: '따라가 보기 끄기' });
  assert.match(html, /<button id="logic-follow" class="btn wide" type="button" aria-pressed="false" hidden>따라가 보기 켜기<\/button>/);
  assert.match(code, /const followDefault = mode === 'pair' && rungOf\(level\)\.follow === true;/);
  assert.match(code, /if \(round\.follow && !round\.followDefault\) round\.followShown = true;/);
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.followShown \? 1 : 0\),/);
  assert.equal(T.follow['clash-liar'], '거짓말쟁이라고 쳤는데 참인 말을 했어요');
  assert.equal(T.follow['clash-knight'], '참말쟁이라고 쳤는데 거짓인 말을 했어요');
});

test('글의 빈칸({이름})은 정해진 이름만 쓴다', () => {
  const allowed = new Set(Object.keys(values));
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
  }
});

test('화면 글에 영어 낱말이 없다', () => {
  // 그림 속 판의 자료(board, claim)는 화면에 나오는 글이 아니다.
  for (const [path, text] of strings) if (!/\.(board|claim)\./.test(path)) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(screenText, /[A-Za-z]/);
});

test('화면 글은 "~요"로 끝나는 말투이고, 문장이 너무 길지 않다', () => {
  const spoken = [
    ...Object.values(T.rules),
    ...Object.values(T.hints).flat(),
    ...Object.values(T.guess),
    T.right.kinds,
    T.right.none,
    T.right.count,
    T.right.road,
    T.right.box,
    T.right.day,
    T.right.question,
    T.solution.day,
    T.solution.ask,
    T.play['follow-on-ask'],
    ...Object.values(T.questions),
    T.right.presses,
    T.right['no-presses'],
    T.right['after-retry'],
    T.right['why-invite'],
    T.solution.kinds,
    T.solution.none,
    T.solution.count,
    T.solution.road,
    T.solution.box,
    T.play['follow-on'],
    T.play['follow-on-box'],
    T.follow.count,
    T.follow['count-zero'],
    T.follow['count-false'],
    T.follow['count-false-zero'],
    T.make.intro,
    T.make.pick,
    T.make.none,
    T.make.one,
    T.make.many,
    T.make['many-full'],
    ...Object.values(T.says),
    ...Object.values(T.labels),
    ...Object.values(T.boxRules),
    ...Object.values(T.notes),
    ...T.why.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(fill(text, values))) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of [...Object.values(T.status), ...T.why.flatMap((slide) => slide.figures.map((item) => item.note)), T.follow['clash-day-knight'], T.follow['clash-day-liar']]) assert.match(fill(text, { n: 2 }), /요$/, text);
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('까닭과 생각의 이름("쳐 보고 따라가기")은 "왜 그럴까?"에서만 말한다. 이름은 이야기의 맨 끝에서 처음 꺼낸다', () => {
  const name = /쳐 보고 따라가기/;
  for (const [path, text] of strings) if (!path.startsWith('why')) assert.doesNotMatch(text, name, `${path}: ${text}`);
  assert.doesNotMatch(screenText, name);
  for (const slide of T.why.slice(0, -1)) assert.doesNotMatch(slide.say, name);
  assert.match(T.why.at(-1).say, name);
  // "누구도 ‘나는 거짓말쟁이예요’라고 못 한다"는 까닭은 "왜 그럴까?"에서만 말한다.
  for (const [path, text] of strings) if (!path.startsWith('why')) assert.doesNotMatch(text, /참말쟁이는 거짓말을 못|거짓말쟁이는 참말을 못/, path);
});

test('"왜 그럴까?"는 그림 서너 장의 이야기다: 믿어 봤다 → 쳐 보고 따라가니 안 맞았다 → 그러니 거짓말쟁이다 → 누구도 "나는 거짓말쟁이예요"를 못 한다 → 상자도 같다', () => {
  assert.ok(T.why.length >= 3 && T.why.length <= 4, `${T.why.length}장`);
  for (const slide of T.why) {
    assert.ok(sentenceCount(slide.say) <= 3, slide.say);
    assert.ok(slide.figures.length >= 1 && slide.figures.length <= 2);
    assert.match(slide.say, /봤어요|았어요|었어요|했어요/, slide.say);
  }
  assert.match(T.why[0].say, /^선생님도 처음엔 말을 하나씩 믿어 봤어요/);
  assert.match(T.why[0].say, /참말쟁이라고 쳐 보고 따라가 봤어요/);
  assert.match(T.why[1].say, /^말이 들어맞지 않았어요\. 그러니 토끼는 거짓말쟁이예요/);
  assert.match(T.why[2].say, /누구도 ‘나는 거짓말쟁이예요’라고 말할 수 없었어요/);
  assert.match(T.why[2].say, /참말쟁이는 거짓말을 못 하고, 거짓말쟁이는 참말을 못 하니까요/);
  assert.match(T.why[3].say, /^상자도/);
  // 열리는 때: 이 형식의 판을 세 판 끝낸 뒤(임시)
  assert.equal(tuningFor('logic').whyAfter, 'rounds');
  assert.equal(tuningFor('logic').whyRounds, 3);
});

test('"왜 그럴까?" 그림 속 판의 답과 주장은 풀이 프로그램이 따진 것과 같다', () => {
  let checked = 0;
  for (const slide of T.why) {
    for (const item of slide.figures) {
      const { board, claim } = item;
      const where = item.note;
      if (board.kind === 'box') {
        const followed = follow(board, { ...blankGuess(board), box: item.box });
        assert.equal(followed.count, claim.count, where);
        assert.equal(followed.fits, claim.fits, where);
        assert.ok(where.includes(`참인 글이 ${claim.count}개`), where);
        if (claim.only) assert.equal(solve(board).answer, item.box, where);
      } else {
        const guess = { kinds: item.guess, road: null, box: null };
        const followed = follow(board, guess);
        const clashes = followed.says.map((entry, index) => (entry.clash ? index : -1)).filter((index) => index >= 0);
        assert.deepEqual(clashes, claim.clash, where);
        if (claim.only) assert.equal(solve(board).answer, item.guess.map((kind) => (kind ? 'T' : 'L')).join(''), where);
        if (claim.none) assert.equal(solve(board).possible, false, where);
      }
      checked += 1;
    }
  }
  assert.equal(checked, 6);
  // 이야기의 첫 판(토끼: "우리는 모두 거짓말쟁이예요")은 1단계의 맨 첫 판과 같은 꼴이다("지난번 그 판").
  assert.deepEqual(generateBoard(1, 1).board.says.map((say) => say.s), T.why[0].figures[0].board.says.map((say) => say.s));
  assert.equal(T.animals[0].name, '토끼');
  assert.equal(T.animals[1].name, '다람쥐');
});

test('수준 맞추기: 1단계에서 시작한다. "왜 그럴까?"는 이 형식의 판을 세 판 끝낸 뒤에 열린다(작은 판과 나간 판은 세지 않는다)', () => {
  assert.deepEqual(recommend([], 'logic'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  const round = (id, more = {}) => ({ kind: 'round', id, format: 'logic', level: 1, custom: false, outcome: 'solved', answers: [{}], moveCount: 3, ...more });
  assert.equal(whyUnlocked([round('a'), round('b')], 'logic'), false);
  assert.equal(whyUnlocked([round('a'), round('b'), round('c')], 'logic'), true);
  assert.equal(whyUnlocked([round('a'), round('b'), round('c', { side: true })], 'logic'), false);
  assert.equal(whyUnlocked([round('a'), round('b'), round('c', { outcome: 'left' })], 'logic'), false);
  assert.equal(whyUnlocked([round('a'), round('b'), round('c', { outcome: 'solution' })], 'logic'), true);
  // 같은 판이 두 번 적혀도 한 판이다.
  assert.equal(whyUnlocked([round('a'), round('a'), round('b')], 'logic'), false);
  // 다른 형식의 판은 세지 않는다.
  assert.equal(whyUnlocked([round('a'), round('b'), round('c', { format: 'tax' })], 'logic'), false);
  // 한 번에 빠르게: 첫 답으로(wrongCount 0), 힌트 없이, 예상 시간보다 빠르게
  const fast = (id) => round(id, { wrongCount: 0, hintsOpened: 0, seconds: 20 });
  assert.equal(recommend([fast('x'), fast('y')], 'logic').offerHarder, true);
  assert.equal(recommend([fast('x'), { ...fast('y'), wrongCount: 1 }], 'logic').offerHarder, false);
  assert.equal(recommend([fast('x'), { ...fast('y'), hintsOpened: 1 }], 'logic').offerHarder, false);
});

test('index.html: 참말 섬의 카드, 판, 답하는 칸, 도구, 직접 만들기가 있다', () => {
  for (const id of ['home-logic-sample', 'home-logic-ask', 'home-logic-play', 'home-logic-pick', 'home-logic-make', 'home-logic-blank', 'logic-board', 'logic-foot', 'logic-status', 'logic-follow', 'logic-pad', 'logic-kinds', 'logic-kind-rows', 'logic-many', 'logic-count-picks', 'logic-roads', 'logic-road-picks', 'logic-boxes', 'logic-box-picks', 'logic-days', 'logic-day-picks', 'logic-asks', 'logic-ask-picks', 'logic-copy', 'logic-submit', 'logic-none', 'make-logic', 'logic-make-people', 'logic-make-by', 'logic-make-count', 'logic-make-undo', 'logic-make-clear', 'logic-make-board', 'logic-make-solve', 'logic-make-play', 'logic-make-result', 'logic-make-kinds', 'logic-make-who', 'logic-make-opt', 'logic-make-preview', 'logic-make-add']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(html, /id="logic-none"[^>]*>이렇게 말할 수는 없어요</);
  assert.match(html, /id="logic-copy"[^>]*>쳐 본 대로 고르기</);
  assert.match(html, /id="logic-make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.match(html, /id="logic-make-play"[^>]*>내가 해 볼래요</);
  // 카드는 약수 세금 뒤, "퍼즐 만들기" 앞에 있고, "만들기" 목록에도 있다.
  assert.ok(html.indexOf('id="tax-title"') < html.indexOf('id="logic-title"'));
  assert.ok(html.indexOf('id="logic-title"') < html.indexOf('id="make-title"'));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-logic-make" class="menu-item"/);
  assert.match(html, new RegExp(`id="home-logic-ask"[^>]*>${T.home.ask.pair.replace('?', '\\?')}<`));
  // 직접 만들기의 판 결과: 없다 / 하나다 / 여럿이다. 말이 꽉 찼으면(6개) 더 붙여 보자고 하지 않는다.
  assert.equal(T.make.none, '이 주민들이 이 말들을 모두 할 수는 없어요.');
  assert.equal(fill(T.make.many, { k: 3 }), '모든 말이 들어맞는 경우가 3가지 남아요. 말을 더 붙여 볼까요?');
  assert.equal(fill(T.make['many-full'], { k: 3 }), '모든 말이 들어맞는 경우가 3가지 남아요.');
  assert.ok(T.make.many.startsWith(T.make['many-full']));
  assert.match(code, /const many = draft\.says\.length >= MAX_SAYS \? T\.make\['many-full'\] : T\.make\.many;/);
  assert.match(code, /const line = worlds\.length === 0 \? T\.make\.none : worlds\.length === 1 \? T\.make\.one : fill\(many, \{ k: worlds\.length \}\);/);
  assert.match(code, /kind: 'made',/);
});
