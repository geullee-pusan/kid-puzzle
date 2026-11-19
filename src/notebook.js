// 내 공책: 아이가 남겨 둔 판을 모아 다시 볼 수 있는 곳(전략 6.1절 나).
// 공책에 넣는 일(알았다!, 공책에 남기기, 묵혀 둔 판, 가장 좋은 기록), 공책에서 빼는 일(한 번 묻고 뺀다), 공책 화면을 그리는 일을 맡는다.
// 같은 쪽 가리기와 다듬기는 src/core/notebook.js의 순수 함수가 한다. 화면에 나오는 글은 대본(coins.json의 notebook)에 있다.
// 지키는 것: 몇 개인지, 채울 빈칸, 며칠째인지, 형식별로 얼마나 했는지를 보여 주지 않는다(모으는 것이 목표가 되지 않게).
import C from './content/coins.json';
import { addGone, cleanBook, dropPage, pageKey, putPage, renamePage, startOf, wasStuck } from './core/notebook.js';

/** 저장할 때 판의 값이 뒤에 바뀌지 않게 통째로 베낀다. */
const copy = (value) => JSON.parse(JSON.stringify(value));

/**
 * @param {object} frame 틀이 건네주는 것: $, log, formats(형식들을 돌려주는 함수), setScreen, startRound, resumeSaved(적어 둔 판 이어서 하기)
 */
export function createNotebook({ $, log, formats, setScreen, startRound, resumeSaved }) {
  let book = cleanBook(log.loadNotebook());
  // 아이가 뺀 묵혀 둔 판의 번호들. 그 판은 다시 그만두어도 공책에 돌아오지 않는다
  let gone = log.loadNotebookGone();
  let asking = null; // "뺄까요?"를 묻고 있는 쪽의 번호

  /** 쪽 하나를 기록으로도 올린다. 그림을 그리는 값(snap)은 빼고, 다시 열 판(start)은 넣는다. 뺀 쪽은 removed가 참이다. */
  function report(page, removed = false) {
    log.saveRecord({
      kind: 'note',
      v: 1,
      id: page.id,
      what: page.kind,
      format: page.format,
      name: page.name,
      roundId: page.roundId ?? null,
      start: page.start,
      value: page.value ?? null,
      removed,
      startedAt: page.at,
      endedAt: new Date().toISOString(),
    });
    log.flush();
  }

  function put(page) {
    const result = putPage(book, page);
    if (result.changed) {
      book = result.book;
      log.saveNotebook(book);
      report(result.page);
    }
    return result;
  }

  function newPage(kind, format, { roundId = null, start, snap, name = '', value }) {
    const page = { id: log.newId('n'), key: pageKey(kind, { format, roundId, board: start.board }), kind, format, at: new Date().toISOString(), name, roundId, start: copy(start), snap: copy(snap) };
    if (value !== undefined) page.value = value;
    return page;
  }

  /** 아직 손대지 않은 판의 모습(그림을 그릴 값). 만든 판과 기록의 그림은 처음 모습으로 그린다. */
  function freshSnap(format, start) {
    return { format: format.id, level: start.level, seed: start.seed, small: start.small, custom: start.custom, ...format.begin(start) };
  }

  /** "알았다!": 그 순간의 판을 찍는다. 같은 판에서 다시 누르면 지금 모습으로 바꾼다. */
  function keepFound(round) {
    const snap = { ...copy(round), events: [] };
    return put(newPage('found', round.format, { roundId: round.id, start: startOf(round), snap }));
  }

  /** "공책에 남기기": 직접 만든 판을 넣는다. 같은 판이 이미 있으면 그대로 둔다. */
  function keepMade(formatId, board) {
    const format = formats()[formatId];
    const key = pageKey('made', { format: formatId, board: copy(board) });
    const before = book.find((page) => page.key === key);
    if (before) return { book, changed: false, existed: true, page: before };
    const start = { level: format.ladder.MAKE_LEVEL, seed: null, small: false, custom: true, board };
    return put(newPage('made', formatId, { start, snap: freshSnap(format, start) }));
  }

  /** 묵혀 둔 판: "막혔어요"를 누른 판을 끝내지 않고 그만두었을 때. 막힌 적이 없는 판, 작은 판, 끝난 판, 아이가 공책에서 뺀 판은 넣지 않는다. */
  function keepShelved(round) {
    if (!round || round.side || round.done || !wasStuck(round) || gone.includes(round.id)) return null;
    // 나갈 때 이미 묵혀 둔 판이 그 뒤로 그대로이면 자리를 옮기지 않는다(새 판을 열 때 다시 들어온다).
    const before = book.find((page) => page.key === pageKey('shelved', { roundId: round.id }));
    if (before && JSON.stringify(before.snap) === JSON.stringify(round)) return { book, changed: false, existed: true, page: before };
    return put(newPage('shelved', round.format, { roundId: round.id, start: startOf(round), snap: round }));
  }

  /** 묵혀 둔 판을 끝까지 했으면 공책에서 뺀다. */
  function dropShelved(roundId) {
    const key = pageKey('shelved', { roundId });
    if (!book.some((page) => page.key === key)) return;
    book = dropPage(book, key);
    log.saveNotebook(book);
  }

  /** 가장 좋은 기록: 더 좋은 답을 찾는 형식에서 지난번보다 좋은 기록이 나면 저절로 넣는다. 아이에게 알리지 않는다. */
  function keepBest(round) {
    const format = formats()[round.format];
    if (round.side || typeof format.bestOf !== 'function') return null;
    const best = format.bestOf(round);
    if (!best) return null;
    const start = startOf(round);
    return put(newPage('best', round.format, { start, snap: freshSnap(format, start), name: best.name, value: best.value }));
  }

  function rename(id, name) {
    const before = book.find((page) => page.id === id);
    if (!before) return;
    book = renamePage(book, id, name);
    const page = book.find((item) => item.id === id);
    if (page.name === before.name) return;
    log.saveNotebook(book);
    report(page);
  }

  // ---- 공책 화면 ----
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function drawPage(page) {
    const format = formats()[page.format];
    const card = element('section', 'panel note-page');
    const head = element('p', 'note-head');
    head.append(element('span', 'note-kind', C.notebook.kinds[page.kind]), element('span', 'note-format', format.T.title));
    const picture = element('div', 'resume note-picture');
    const inner = element('div');
    picture.append(inner);
    try {
      format.drawResume(inner, page.snap);
    } catch {
      // 그림을 못 그려도 쪽은 보인다.
    }
    if (inner.childElementCount === 0) {
      try {
        format.drawSample(inner, page.start.board);
      } catch {
        // 판의 처음 그림도 못 그리면 그림 없이 둔다.
      }
    }
    card.append(head, picture);
    if (page.name) card.append(element('p', 'note-name', page.name));
    card.append(asking === page.id ? dropAsk(page) : actions(page));
    return card;
  }

  function button(text, className, onClick) {
    const node = element('button', className, text);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  }

  /** 쪽 아래의 단추들: 다시 해 보기(또는 이어서 하기)와, 작게 놓인 빼기 */
  function actions(page) {
    const row = element('div', 'note-actions');
    row.append(
      button(page.kind === 'shelved' ? C.notebook.resume : C.notebook.again, 'btn', () => open(page)),
      button(C.notebook.drop, 'btn small note-drop', () => {
        asking = page.id;
        draw();
        document.querySelector('.note-drop-no')?.focus();
      }),
    );
    return row;
  }

  /** 빼기를 누르면 한 번 묻는다. 잘못 누른 것일 수 있다 */
  function dropAsk(page) {
    const box = element('div', 'note-drop-ask');
    const row = element('div', 'note-actions');
    row.append(
      button(C.notebook['drop-no'], 'btn note-drop-no', () => {
        asking = null;
        draw();
      }),
      button(C.notebook['drop-yes'], 'btn small note-drop-yes', () => remove(page)),
    );
    box.append(element('p', 'note-drop-line', C.notebook['drop-ask']), row);
    return box;
  }

  /** 쪽을 공책에서 뺀다. 묵혀 둔 판이면 그 판이 다시 들어오지 않게 번호를 기억한다. */
  function remove(page) {
    const at = book.findIndex((item) => item.id === page.id);
    asking = null;
    if (at < 0) return draw();
    book = dropPage(book, page.key);
    log.saveNotebook(book);
    if (page.kind === 'shelved' && page.roundId) {
      gone = addGone(gone, page.roundId);
      log.saveNotebookGone(gone);
    }
    report(page, true);
    draw();
    // 그 자리의 다음 쪽(없으면 앞 쪽)으로, 쪽이 없으면 나가기 단추로 옮긴다.
    const cards = $('notebook-pages').children;
    const next = cards[Math.min(at, cards.length - 1)];
    (next?.querySelector('button') ?? $('notebook-leave')).focus();
  }

  function draw() {
    const all = formats();
    const pages = book.filter((page) => all[page.format]);
    $('notebook-empty').textContent = C.notebook.empty;
    $('notebook-empty').hidden = pages.length > 0;
    $('notebook-pages').replaceChildren(...pages.map(drawPage));
    fitPictures();
  }

  /** 쪽보다 넓은 그림(동전이 많은 줄 등)은 쪽에 맞게 줄여 그린다. */
  function fitPictures() {
    for (const picture of $('notebook-pages').querySelectorAll('.note-picture')) {
      const inner = picture.firstElementChild;
      inner.style.zoom = '';
      const room = picture.clientWidth;
      const need = inner.scrollWidth;
      if (room > 0 && need > room) inner.style.zoom = String(Math.max(0.4, Math.floor((room / need) * 100) / 100));
    }
  }

  /** 쪽의 판을 연다. 묵혀 둔 판은 멈춘 데서 이어서 하고, 나머지는 처음 모습으로 다시 한다. */
  function open(page) {
    if (page.kind === 'shelved') resumeSaved(copy(page.snap));
    else startRound(page.format, copy(page.start), { from: 'notebook', fromPage: page.id });
  }

  /** 공책 화면을 연다. 판을 하던 중에 열었으면(fromPlay) 나가기 단추가 "하던 판으로"가 된다. */
  function show({ fromPlay = false } = {}) {
    setScreen('notebook');
    asking = null;
    $('notebook-leave').textContent = fromPlay ? C.notebook.back : C.notebook.leave;
    draw();
    $('notebook-leave').focus();
  }

  return { show, keepFound, keepMade, keepShelved, dropShelved, keepBest, rename };
}
