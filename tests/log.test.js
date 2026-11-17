// 기록과 전송. 브라우저의 저장소와 네트워크를 가짜로 바꿔 끼우고 확인한다(진짜 네트워크는 쓰지 않는다).
// - 저장된 값이 없거나 깨져도 오류 없이 빈 기록으로 시작한다.
// - 같은 판을 다시 남기면 뒤의 것이 앞의 것을 바꾼다.
// - 설정이 없으면 조용히 건너뛴다. 실패하면 기기에 남겨 두었다가 다음에 다시 보낸다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

/** 가짜 기기 저장소 */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => void map.set(key, String(value)),
    removeItem: (key) => void map.delete(key),
  };
}

let serial = 0;
/** 가짜 저장소를 끼운 뒤 기록 모듈을 새로 불러온다(모듈은 불러올 때 저장소를 읽는다). */
async function freshLog(storage) {
  globalThis.localStorage = storage;
  serial += 1;
  return import(`../src/ui/log.js?case=${serial}`);
}

/** 가짜 네트워크. 받은 요청을 모아 두고, 정해 준 대로 답한다. */
function fakeFetch(answer) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return answer(calls.length);
  };
  return calls;
}
const ok = () => ({ ok: true, status: 201, json: async () => ({}) });
const refused = (status, message) => ({ ok: false, status, json: async () => ({ message }) });

const round = (id, extra = {}) => ({ kind: 'round', id, format: 'coins', level: 2, outcome: 'solved', endedAt: '2026-11-18T10:15:00.000Z', ...extra });
const settings = JSON.stringify({ repo: 'owner/records', token: 'test-key' });
const decode = (base64) => Buffer.from(base64, 'base64').toString('utf8');

test('저장된 값이 없으면 빈 기록으로 시작한다', async () => {
  const log = await freshLog(fakeStorage());
  assert.deepEqual(log.allRecords(), []);
  assert.equal(log.recordCount(), 0);
  assert.equal(log.pendingCount(), 0);
  assert.equal(log.loadCurrent(), null);
  assert.equal(log.loadDraft(), null);
  assert.deepEqual(log.loadPrefs(), { sound: true, visited: false, met: false });
});

test('저장된 값이 깨져 있어도 오류 없이 빈 기록으로 시작한다', async () => {
  const log = await freshLog(
    fakeStorage({
      'kidpuzzle.records': '{깨진 값',
      'kidpuzzle.pending': '"목록이 아님"',
      'kidpuzzle.current': '[1, 2',
      'kidpuzzle.draft': '12',
      'kidpuzzle.prefs': 'null',
      'kidpuzzle.sync': '{"repo": 3}',
    }),
  );
  assert.deepEqual(log.allRecords(), []);
  assert.equal(log.pendingCount(), 0);
  assert.equal(log.loadCurrent(), null);
  assert.equal(log.loadDraft(), null);
  assert.deepEqual(log.loadPrefs(), { sound: true, visited: false, met: false });
  assert.deepEqual(await log.flush(), { ok: false, sent: 0, skipped: true });
});

test('저장소를 아예 쓸 수 없어도(막혀 있어도) 기록하고 계속 쓸 수 있다', async () => {
  const blocked = {
    getItem() {
      throw new Error('막힘');
    },
    setItem() {
      throw new Error('막힘');
    },
    removeItem() {
      throw new Error('막힘');
    },
  };
  const log = await freshLog(blocked);
  assert.deepEqual(log.allRecords(), []);
  log.saveRecord(round('a'));
  assert.equal(log.recordCount(), 1);
  assert.equal(log.saveCurrent({ id: 'x' }), false);
  assert.equal(log.loadCurrent(), null);
  log.clearCurrent();
});

test('목록 안의 깨진 칸은 버리고 나머지는 살린다', async () => {
  const log = await freshLog(fakeStorage({ 'kidpuzzle.records': JSON.stringify([round('a'), null, 'x', 7, round('b')]) }));
  assert.deepEqual(log.allRecords().map((record) => record.id), ['a', 'b']);
});

test('기록을 남기면 기기에 쌓이고, 다시 켜도 남아 있다', async () => {
  const storage = fakeStorage();
  const log = await freshLog(storage);
  log.setBuild('test-build');
  const saved = log.saveRecord(round('a'));
  assert.equal(saved.app, 'test-build');
  assert.equal(saved.rev, 1);
  assert.equal(typeof saved.session, 'string');
  log.saveRecord(round('b'));
  const again = await freshLog(storage);
  assert.deepEqual(again.allRecords().map((record) => record.id), ['a', 'b']);
  assert.equal(again.pendingCount(), 2);
});

test('같은 판을 다시 남기면 뒤의 것이 앞의 것을 바꾼다(기록도, 못 보낸 것도 하나)', async () => {
  const log = await freshLog(fakeStorage());
  log.saveRecord(round('a', { outcome: 'left' }));
  log.saveRecord(round('b'));
  const saved = log.saveRecord(round('a', { outcome: 'solved', after: 'same' }));
  assert.equal(saved.rev, 2);
  assert.deepEqual(log.allRecords().map((record) => [record.id, record.outcome]), [['a', 'solved'], ['b', 'solved']]);
  assert.equal(log.pendingCount(), 2);
});

test('하던 판을 적어 두고 다시 읽는다. 지우면 없다', async () => {
  const storage = fakeStorage();
  const log = await freshLog(storage);
  assert.equal(log.saveCurrent({ id: 'r1', coins: [1, 0, 1] }), true);
  const again = await freshLog(storage);
  assert.deepEqual(again.loadCurrent(), { id: 'r1', coins: [1, 0, 1] });
  again.clearCurrent();
  assert.equal(again.loadCurrent(), null);
});

test('설정이 없으면 보내지 않고 조용히 건너뛴다(네트워크를 부르지 않는다)', async () => {
  const log = await freshLog(fakeStorage());
  const calls = fakeFetch(ok);
  log.saveRecord(round('a'));
  assert.deepEqual(await log.flush(), { ok: false, sent: 0, skipped: true });
  assert.equal(calls.length, 0);
  assert.equal(log.pendingCount(), 1);
});

test('설정이 있으면 기록 하나를 파일 하나로 올리고, 올린 것은 "못 보낸 것"에서 뺀다', async () => {
  const storage = fakeStorage({ 'kidpuzzle.sync': settings });
  const log = await freshLog(storage);
  const calls = fakeFetch(ok);
  log.saveRecord(round('a', { note: '한글도 그대로 간다' }));
  log.saveRecord(round('b', { endedAt: '2026-12-01T00:00:05.000Z' }));
  assert.deepEqual(await log.flush(), { ok: true, sent: 2 });
  assert.equal(log.pendingCount(), 0);
  assert.equal(log.recordCount(), 2, '기기의 기록은 그대로 남는다');
  assert.equal(JSON.parse(storage.map.get('kidpuzzle.pending')).length, 0);

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /^https:\/\/api\.github\.com\/repos\/owner\/records\/contents\/logs\/2026-11\/20261118T101500Z-[a-z0-9]{4}\.json$/);
  assert.match(calls[1].url, /\/logs\/2026-12\/20261201T000005Z-[a-z0-9]{4}\.json$/);
  assert.equal(calls[0].options.method, 'PUT');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key');
  const sent = JSON.parse(decode(JSON.parse(calls[0].options.body).content));
  assert.equal(sent.id, 'a');
  assert.equal(sent.note, '한글도 그대로 간다');
  assert.equal(sent.rev, 1);
});

test('연결이 안 되면 기기에 남겨 두었다가 다음에 다시 보낸다', async () => {
  const log = await freshLog(fakeStorage({ 'kidpuzzle.sync': settings }));
  globalThis.fetch = async () => {
    throw new Error('오프라인');
  };
  log.saveRecord(round('a'));
  const failed = await log.flush();
  assert.equal(failed.ok, false);
  assert.equal(failed.sent, 0);
  assert.equal(failed.status, 0);
  assert.equal(log.pendingCount(), 1);

  const calls = fakeFetch(ok);
  assert.deepEqual(await log.flush(), { ok: true, sent: 1 });
  assert.equal(calls.length, 1);
  assert.equal(log.pendingCount(), 0);
});

test('중간에 실패하면 거기서 멈추고, 못 보낸 것만 남긴다', async () => {
  const log = await freshLog(fakeStorage({ 'kidpuzzle.sync': settings }));
  const calls = fakeFetch((count) => (count === 2 ? refused(401, 'Bad credentials') : ok()));
  log.saveRecord(round('a'));
  log.saveRecord(round('b'));
  log.saveRecord(round('c'));
  const result = await log.flush();
  assert.deepEqual(result, { ok: false, sent: 1, status: 401, detail: 'Bad credentials' });
  assert.equal(calls.length, 2);
  assert.equal(log.pendingCount(), 2);
});

test('올리는 사이에 같은 판이 고쳐지면 고친 것을 다시 올린다', async () => {
  const log = await freshLog(fakeStorage({ 'kidpuzzle.sync': settings }));
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) log.saveRecord(round('a', { after: 'same' })); // 올리는 도중에 끝난 뒤 고른 것이 적혔다
    return ok();
  };
  log.saveRecord(round('a'));
  assert.deepEqual(await log.flush(), { ok: true, sent: 2 });
  assert.equal(calls, 2);
  assert.equal(log.pendingCount(), 0);
});

test('저장소 이름이 "주인/이름" 꼴이 아니면 보내지 않는다', async () => {
  const log = await freshLog(fakeStorage({ 'kidpuzzle.sync': JSON.stringify({ repo: 'https://example.com/x', token: 'k' }) }));
  const calls = fakeFetch(ok);
  log.saveRecord(round('a'));
  const result = await log.flush();
  assert.equal(result.ok, false);
  assert.equal(calls.length, 0);
  assert.equal(log.pendingCount(), 1);
});

test('기록 지우기: 기기의 기록과 못 보낸 것을 비운다. 하던 판은 그대로 둔다', async () => {
  const storage = fakeStorage();
  const log = await freshLog(storage);
  log.saveRecord(round('a'));
  log.saveCurrent({ id: 'r1' });
  log.clearRecords();
  assert.equal(log.recordCount(), 0);
  assert.equal(log.pendingCount(), 0);
  assert.deepEqual(log.loadCurrent(), { id: 'r1' });
  const again = await freshLog(storage);
  assert.equal(again.recordCount(), 0);
});

test('파일 경로: logs/2026-11/20261118T101500Z-ab12.json 꼴이다', async () => {
  const { logPath } = await import('../src/ui/sync.js');
  const path = logPath('logs', new Date('2026-11-18T10:15:00Z'));
  assert.match(path, /^logs\/2026-11\/20261118T101500Z-[a-z0-9]{4}\.json$/);
  assert.notEqual(logPath('logs', new Date('2026-11-18T10:15:00Z')), logPath('logs', new Date('2026-11-18T10:15:01Z')));
});
