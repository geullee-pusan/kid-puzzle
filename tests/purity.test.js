// src/core/에는 순수 함수만 둔다. 금지된 코드가 없는지 글자로 검사한다.
// (주산 앱 JUSAN의 core-purity.test.js 방식을 따랐다.)
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const CORE = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'core');

const FORBIDDEN = [
  [/\bMath\s*\.\s*random\b/, 'Math.random'],
  [/\bDate\b/, 'Date(지금 시각)'],
  [/\bperformance\b/, 'performance(지금 시각)'],
  [/\bcrypto\b/, 'crypto(무작위 값)'],
  [/\b(document|window|navigator|globalThis)\b/, '화면·브라우저 객체'],
  [/\b(localStorage|sessionStorage|indexedDB)\b/, '저장소'],
  [/\b(fetch|XMLHttpRequest)\b/, '네트워크'],
  [/\b(setTimeout|setInterval|requestAnimationFrame)\b/, '타이머'],
  [/\bimport\s*\.\s*meta\b/, 'import.meta'],
];

/** 주석을 지운다. src/core에는 주소 같은 // 글자가 없다고 본다. */
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function findViolations(code) {
  const clean = stripComments(code);
  return FORBIDDEN.filter(([pattern]) => pattern.test(clean)).map(([, name]) => name);
}

test('검사기가 금지된 코드를 찾아낸다', () => {
  assert.deepEqual(findViolations('const x = Math.random();'), ['Math.random']);
  assert.deepEqual(findViolations('const t = Date.now();'), ['Date(지금 시각)']);
  assert.deepEqual(findViolations('const t = new Date();'), ['Date(지금 시각)']);
  assert.deepEqual(findViolations('document.body'), ['화면·브라우저 객체']);
  assert.deepEqual(findViolations('window.open()'), ['화면·브라우저 객체']);
  assert.deepEqual(findViolations('// Math.random은 주석이라 괜찮다\nconst a = 1;'), []);
});

test('src/core/의 모든 파일에 금지된 코드가 없다', () => {
  const files = readdirSync(CORE, { recursive: true }).filter((file) => /\.(js|mjs)$/.test(file));
  assert.ok(files.length >= 5, 'src/core의 파일을 찾지 못했어요');
  for (const file of files) {
    const found = findViolations(readFileSync(join(CORE, file), 'utf8'));
    assert.deepEqual(found, [], `${file}: ${found.join(', ')}`);
  }
});

test('src/core/는 src/core/ 안의 파일만 불러온다', () => {
  const files = readdirSync(CORE, { recursive: true }).filter((file) => /\.(js|mjs)$/.test(file));
  for (const file of files) {
    const code = stripComments(readFileSync(join(CORE, file), 'utf8'));
    for (const [, from] of code.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      assert.match(from, /^\.\/[\w-]+\.js$/, `${file}이 바깥 파일을 불러와요: ${from}`);
    }
  }
});
