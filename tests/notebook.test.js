// 내 공책의 순수 함수: 같은 쪽 가리기, 넣기, 가장 좋은 기록, 이름 다듬기, 깨진 값 걸러 내기.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_GONE, MAX_NAME, MAX_PAGES, addGone, cleanBook, cleanName, dropPage, pageKey, putPage, renamePage, startOf, validPage, wasStuck } from '../src/core/notebook.js';

const page = (over = {}) => {
  const kind = over.kind ?? 'found';
  const format = over.format ?? 'coins';
  const board = over.board ?? { n: 4, coins: [1, 1, 1, 1] };
  return {
    id: over.id ?? 'n-1',
    key: over.key ?? pageKey(kind, { format, roundId: over.roundId ?? 'r-1', board }),
    kind,
    format,
    at: '2026-11-19T00:00:00.000Z',
    name: over.name ?? '',
    start: { level: 1, seed: 1, small: false, custom: false, board },
    snap: { board },
    ...(kind === 'best' ? { value: over.value ?? 10 } : {}),
  };
};

test('같은 쪽: 만든 판과 기록은 형식과 판으로, 알아낸 판과 묵혀 둔 판은 판 번호로 가린다', () => {
  const board = { n: 3, coins: [1, 0, 1] };
  assert.equal(pageKey('made', { format: 'coins', board }), pageKey('made', { format: 'coins', board: { n: 3, coins: [1, 0, 1] } }));
  assert.notEqual(pageKey('made', { format: 'coins', board }), pageKey('made', { format: 'tile', board }));
  assert.notEqual(pageKey('made', { format: 'coins', board }), pageKey('best', { format: 'coins', board }));
  assert.equal(pageKey('found', { format: 'coins', roundId: 'r-a', board }), 'found:r-a');
  assert.notEqual(pageKey('found', { roundId: 'r-a' }), pageKey('shelved', { roundId: 'r-a' }));
});

test('넣은 쪽은 맨 앞에 온다. 같은 쪽을 다시 넣으면 하나만 남고 이름과 번호를 이어받는다', () => {
  let book = [];
  book = putPage(book, page({ id: 'n-1', roundId: 'r-1', name: '첫 판' })).book;
  book = putPage(book, page({ id: 'n-2', roundId: 'r-2' })).book;
  assert.deepEqual(book.map((item) => item.id), ['n-2', 'n-1']);
  const again = putPage(book, page({ id: 'n-3', roundId: 'r-1' }));
  assert.equal(again.existed, true);
  assert.equal(again.changed, true);
  assert.deepEqual(again.book.map((item) => item.id), ['n-1', 'n-2']);
  assert.equal(again.book[0].name, '첫 판');
});

test('가장 좋은 기록은 지난 기록보다 좋을 때만 바뀐다', () => {
  const board = { cards: [1, 2, 3, 4, 5, 6] };
  let { book } = putPage([], page({ kind: 'best', id: 'n-1', board, value: 10 }));
  const same = putPage(book, page({ kind: 'best', id: 'n-2', board, value: 10 }));
  assert.equal(same.changed, false);
  assert.equal(same.book, book);
  const lower = putPage(book, page({ kind: 'best', id: 'n-3', board, value: 7 }));
  assert.equal(lower.changed, false);
  const higher = putPage(book, page({ kind: 'best', id: 'n-4', board, value: 15 }));
  assert.equal(higher.changed, true);
  book = higher.book;
  assert.equal(book.length, 1);
  assert.equal(book[0].value, 15);
  assert.equal(book[0].id, 'n-1');
});

test('공책은 정해진 쪽 수를 넘지 않는다(오래된 것부터 빠진다)', () => {
  let book = [];
  for (let at = 0; at < MAX_PAGES + 5; at += 1) book = putPage(book, page({ id: `n-${at}`, roundId: `r-${at}` })).book;
  assert.equal(book.length, MAX_PAGES);
  assert.equal(book[0].id, `n-${MAX_PAGES + 4}`);
  assert.ok(!book.some((item) => item.id === 'n-0'));
});

test('이름: 앞뒤 빈칸과 줄바꿈을 다듬고, 길면 자른다. 글이 아니면 빈 이름이다', () => {
  assert.equal(cleanName('  안 되는\n판  '), '안 되는 판');
  assert.equal([...cleanName('가'.repeat(MAX_NAME + 5))].length, MAX_NAME);
  assert.equal(cleanName(null), '');
  assert.equal(cleanName(3), '');
  const book = renamePage([page({ id: 'n-1' }), page({ id: 'n-2', roundId: 'r-2' })], 'n-2', '  새 이름 ');
  assert.deepEqual(book.map((item) => item.name), ['', '새 이름']);
});

test('빼기: 같은 열쇠의 쪽만 빠진다', () => {
  const book = [page({ id: 'n-1', roundId: 'r-1' }), page({ id: 'n-2', roundId: 'r-2' })];
  assert.deepEqual(dropPage(book, 'found:r-1').map((item) => item.id), ['n-2']);
  assert.equal(dropPage(book, 'found:r-9').length, 2);
});

test('깨진 공책: 쓸 수 없는 쪽과 겹치는 쪽은 빼고 읽는다', () => {
  assert.deepEqual(cleanBook(null), []);
  assert.deepEqual(cleanBook({}), []);
  const good = page({ id: 'n-1' });
  const twin = page({ id: 'n-2' });
  const broken = [null, 3, { ...good, kind: 'star' }, { ...good, start: null }, { ...page({ kind: 'best', roundId: 'x' }), value: 'many' }];
  assert.deepEqual(cleanBook([good, ...broken, twin]).map((item) => item.id), ['n-1']);
  assert.equal(validPage(good), true);
  assert.equal(validPage(page({ kind: 'best', value: 3 })), true);
});

test('막혔던 판: "막혔어요"에서 무엇이든 골랐거나 작은 판으로 가 본 판', () => {
  assert.equal(wasStuck({ help: { rule: 0, next: 0, why: 0 }, sideOpened: 0 }), false);
  assert.equal(wasStuck({}), false);
  assert.equal(wasStuck({ help: { rule: 1, next: 0, why: 0 } }), true);
  assert.equal(wasStuck({ help: { rule: 0, next: 0, why: 2 } }), true);
  assert.equal(wasStuck({ help: { rule: 0, next: 0, why: 0 }, sideOpened: 1 }), true);
});

test('다시 열 값: 작은 판은 판 번호 없이 보통 판으로 연다', () => {
  const board = { n: 2 };
  assert.deepEqual(startOf({ level: 3, seed: 7, small: true, custom: false, board }), { level: 3, seed: 7, small: true, custom: false, board });
  assert.deepEqual(startOf({ level: 3, seed: null, small: false, custom: false, side: true, board }), { level: 3, seed: null, small: false, custom: false, board });
  assert.deepEqual(startOf({ level: 6, seed: null, custom: true, board }), { level: 6, seed: null, small: false, custom: true, board });
});

test('뺀 묵혀 둔 판: 최근 것이 앞, 겹치지 않게, 위 끝을 넘으면 오래된 것부터 잊는다', () => {
  assert.deepEqual(addGone([], 'r1'), ['r1']);
  assert.deepEqual(addGone(['r1', 'r2'], 'r2'), ['r2', 'r1']);
  assert.deepEqual(addGone(null, 'r1'), ['r1']);
  assert.deepEqual(addGone([3, 'r1'], 'r2'), ['r2', 'r1']);
  const many = Array.from({ length: MAX_GONE }, (_, i) => `r${i}`);
  const next = addGone(many, 'new');
  assert.equal(next.length, MAX_GONE);
  assert.equal(next[0], 'new');
  assert.ok(!next.includes(`r${MAX_GONE - 1}`));
});
