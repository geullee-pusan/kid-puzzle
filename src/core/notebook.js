// 내 공책: 아이가 남겨 둔 판을 모아 두는 목록. 순수 함수만 둔다(저장과 화면은 src/notebook.js와 src/main.js가 한다).
// 공책에 들어가는 것(전략 6.1절 나):
//   made     내가 만든 판. 직접 만들기에서 "공책에 남기기"를 눌렀을 때. 이름을 붙일 수 있다
//   found    알아낸 판. 판 화면에서 "알았다!"를 눌렀을 때. 그 순간의 판 모습이 찍힌다
//   shelved  묵혀 둔 판. "막혔어요"를 누른 판을 끝내지 않고 나갔을 때. 이어서 할 수 있다
//   best     가장 좋은 기록. 더 좋은 답을 찾는 형식에서 지난번보다 좋은 기록이 나면 저절로
// 지키는 것: 몇 개인지, 채울 빈칸, 며칠째인지를 셀 값을 두지 않는다. 목록은 최근 것이 앞에 온다.

export const KINDS = ['made', 'found', 'shelved', 'best'];
/** 공책에 두는 쪽 수의 위 끝. 넘으면 오래된 것부터 빠진다(아이에게 알리지 않는다). */
export const MAX_PAGES = 120;
/** 이름의 글자 수 위 끝 */
export const MAX_NAME = 20;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * 같은 쪽인지 가리는 열쇠. 같은 열쇠의 쪽은 하나만 둔다.
 *   made, best  형식과 판이 같으면 같은 쪽
 *   found, shelved  같은 판(판 번호)이면 같은 쪽
 */
export function pageKey(kind, { format, roundId = null, board = null }) {
  if (kind === 'found' || kind === 'shelved') return `${kind}:${roundId}`;
  return `${kind}:${format}:${JSON.stringify(board)}`;
}

/** 이름을 다듬는다: 앞뒤 빈칸을 지우고, 줄바꿈을 빈칸으로 바꾸고, 길면 자른다. */
export function cleanName(name) {
  if (typeof name !== 'string') return '';
  return [...name.replace(/\s+/g, ' ').trim()].slice(0, MAX_NAME).join('');
}

/** 판을 다시 열 때 쓰는 값. 작은 판(곁판)은 판 번호가 없고, 다시 열면 보통 판으로 열린다. */
export function startOf(round) {
  return {
    level: round.level,
    seed: round.side ? null : (round.seed ?? null),
    small: round.side ? false : round.small === true,
    custom: round.custom === true,
    board: round.board,
  };
}

/** "막혔어요"에서 무엇이든 골랐거나 작은 판으로 가 본 판인가 */
export function wasStuck(round) {
  const help = isObject(round.help) ? round.help : {};
  const picked = ['rule', 'next', 'why'].some((key) => Number.isFinite(help[key]) && help[key] > 0);
  return picked || (Number.isFinite(round.sideOpened) && round.sideOpened > 0);
}

/** 쪽 하나가 쓸 수 있는 값인가(기기에 적어 둔 것이 깨졌을 수 있다) */
export function validPage(page) {
  if (!isObject(page)) return false;
  if (!KINDS.includes(page.kind)) return false;
  if (typeof page.id !== 'string' || typeof page.key !== 'string' || typeof page.format !== 'string' || typeof page.at !== 'string') return false;
  if (typeof page.name !== 'string') return false;
  if (!isObject(page.start) || !isObject(page.snap) || !('board' in page.start)) return false;
  if (page.kind === 'best' && !Number.isFinite(page.value)) return false;
  return true;
}

/** 기기에서 읽은 공책을 다듬는다. 깨진 쪽과 겹치는 쪽(앞의 것을 남긴다)은 뺀다. */
export function cleanBook(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const pages = [];
  for (const page of raw) {
    if (!validPage(page) || seen.has(page.key)) continue;
    seen.add(page.key);
    pages.push(page);
  }
  return pages.slice(0, MAX_PAGES);
}

/**
 * 쪽 하나를 넣는다. 같은 열쇠의 쪽이 있으면 그 쪽을 빼고 맨 앞에 새로 넣는다(붙여 둔 이름은 이어받는다).
 * 가장 좋은 기록은 지난 기록보다 좋을 때만 바꾼다.
 * @returns {{ book: object[], changed: boolean, existed: boolean, page: object|null }} page는 넣은 쪽(바뀌지 않았으면 원래 쪽)
 */
export function putPage(book, page) {
  const before = book.find((item) => item.key === page.key) ?? null;
  if (before && page.kind === 'best' && !(page.value > before.value)) return { book, changed: false, existed: true, page: before };
  const name = cleanName(page.name) || (before && page.kind !== 'best' ? before.name : '');
  const next = { ...page, id: before ? before.id : page.id, name };
  const rest = book.filter((item) => item.key !== page.key);
  return { book: [next, ...rest].slice(0, MAX_PAGES), changed: true, existed: before !== null, page: next };
}

/** 같은 열쇠의 쪽을 뺀다. */
export function dropPage(book, key) {
  return book.filter((item) => item.key !== key);
}

/** 쪽의 이름을 바꾼다. 자리는 그대로다. */
export function renamePage(book, id, name) {
  return book.map((item) => (item.id === id ? { ...item, name: cleanName(name) } : item));
}
