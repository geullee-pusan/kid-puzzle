// 참말 섬의 판을 그린다: 주민들(모습, 이름, 쳐 보기 단추)과 그들이 한 말, 갈림길, 상자와 글.
// (5단계 질문 고르기의 질문 카드와 대답 표는 2026-11 화면 글 점검에서 5단계를 빼면서 지웠다.)
// 누를 수 있는 판과 보기만 하는 그림(풀이, "왜 그럴까?")을 같은 모양으로 그린다.
// 색만으로 알리지 않는다.
//   쳐 본 종류: 참말쟁이라고 친 주민은 굵은 실선 테두리, 거짓말쟁이라고 친 주민은 굵은 겹선 테두리, 모름은 가는 점선 테두리이고, 글자 표시가 함께 붙는다.
//   말: 참인지 거짓인지를 글자로 적는다. 쳐 본 종류와 어긋나는 말은 굵은 점선 테두리와 글 한 줄로 눈에 띄게 한다.
//   틀린 답에서 짚은 말은 굵은 바깥 테두리를 두른다.
// 글자는 모두 형식(src/formats/logic.js)이 대본에서 채워 건넨다. 이 파일에는 글을 적지 않는다.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function button(className, text, onTap, label) {
  const node = el('button', `btn ${className}`, text);
  node.type = 'button';
  if (label) node.setAttribute('aria-label', label);
  node.addEventListener('click', onTap);
  return node;
}

/** 주민 하나: 모습, 이름, 쳐 본 종류의 표시, 쳐 보기 단추 */
function person(item, live) {
  const card = el('div', `logic-person mark-${item.mark ?? 'none'}`);
  const face = el('span', 'logic-face', item.face);
  face.setAttribute('aria-hidden', 'true');
  card.append(face, el('strong', 'logic-name', item.name));
  if (item.sign) card.append(el('span', 'logic-sign', item.sign));
  if (live && item.onTap) {
    const press = button('logic-guess', item.button, item.onTap, item.label);
    press.dataset.focus = item.focus;
    card.append(press);
  }
  return card;
}

/** 갈림길: 두 길과, 쳐 본 길의 표시, 길 쳐 보기 단추 */
function fork(item, live) {
  const card = el('div', `logic-fork mark-${item.mark ?? 'none'}`);
  const picture = el('div', 'logic-roads');
  picture.setAttribute('aria-hidden', 'true');
  for (const side of ['left', 'right']) {
    const road = el('span', `logic-road road-${side}${item.mark === side ? ' on' : ''}`);
    road.append(el('span', 'logic-road-name', item.names[side]));
    picture.append(road);
  }
  card.append(picture, el('strong', 'logic-name', item.title));
  if (item.sign) card.append(el('span', 'logic-sign', item.sign));
  if (live && item.onTap) {
    const press = button('logic-guess', item.button, item.onTap, item.label);
    press.dataset.focus = item.focus;
    card.append(press);
  }
  return card;
}

/** 말 하나: 말한 주민, 말, 이 가정에서 참인지, 맞지 않으면 그 사실 */
function sayRow(item) {
  const row = el('li', `logic-say${item.clash ? ' clash' : ''}${item.flagged ? ' flagged' : ''}${item.truth === null || item.truth === undefined ? '' : item.truth ? ' is-true' : ' is-false'}`);
  const who = el('span', 'logic-who');
  const face = el('span', 'logic-face small', item.face);
  face.setAttribute('aria-hidden', 'true');
  who.append(face, el('span', 'logic-who-name', item.name));
  const bubble = el('span', 'logic-bubble', item.text);
  row.append(who, bubble);
  if (item.tag) row.append(el('span', 'logic-tag', item.tag));
  if (item.clash && item.clashText) row.append(el('span', 'logic-clash', item.clashText));
  return row;
}

/** 상자 하나: 상자 그림과 이름, 붙은 글, 이 가정에서 참인지, "보물이 여기 있다고 쳐 보기" 단추 */
function box(item, live) {
  const card = el('div', `logic-box${item.chosen ? ' chosen' : ''}${item.flagged ? ' flagged' : ''}`);
  const chest = el('div', 'logic-chest');
  chest.setAttribute('aria-hidden', 'true');
  chest.append(el('span', 'logic-lid'), el('span', 'logic-chest-body', item.mark ?? ''));
  card.append(chest, el('strong', 'logic-name', item.name), el('p', 'logic-label', item.text));
  if (item.tag) card.append(el('span', `logic-tag${item.truth === null ? '' : item.truth ? ' is-true' : ' is-false'}`, item.tag));
  if (live && item.onTap) {
    const press = button('logic-guess', item.button, item.onTap, item.label);
    press.setAttribute('aria-pressed', String(Boolean(item.chosen)));
    press.dataset.focus = item.focus;
    card.append(press);
  }
  return card;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   notes      판 위에 적는 약속(뜻을 정해 두는 말)들
 *   rule       상자 판 위의 한 줄 { text, tag, fits(들어맞으면 true, 어긋나면 false, 모르면 null) }
 *   people     주민들 [{ name, face, mark: 'knight'|'liar'|null, sign, button, label, onTap }]
 *   fork       갈림길 { title, names: {left, right}, mark: 'left'|'right'|null, sign, button, label, onTap }
 *   says       말들 [{ name, face, text, truth, tag, clash, clashText, flagged }]
 *   boxes      상자들 [{ name, text, mark, truth, tag, chosen, flagged, button, label, onTap }]
 *   live       누를 수 있는 판인가
 *   small      작은 그림으로 그린다(풀이, "왜 그럴까?")
 */
export function drawBoard(root, view) {
  const live = Boolean(view.live);
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.focus : undefined;
  root.className = `logic-board${view.small ? ' small' : ''}${live ? ' live' : ''}`;
  const nodes = [];
  if (view.notes?.length) {
    const notes = el('ul', 'logic-notes');
    for (const note of view.notes) notes.append(el('li', '', note));
    nodes.push(notes);
  }
  if (view.rule) nodes.push(el('p', `logic-rule${view.rule.fits === false ? ' misfit' : view.rule.fits ? ' fits' : ''}`, view.rule.tag ? `${view.rule.text} ${view.rule.tag}` : view.rule.text));
  // 갈림길은 주민들 위에 낮은 띠 하나로 그린다(주민 셋과 한 줄에 놓으면 넘쳐서 말이 아래로 밀린다).
  if (view.fork) nodes.push(fork(view.fork, live));
  if (view.people?.length) {
    const row = el('div', 'logic-people');
    for (const item of view.people) row.append(person(item, live));
    nodes.push(row);
  }
  if (view.says?.length) {
    const list = el('ol', 'logic-says');
    for (const item of view.says) list.append(sayRow(item));
    nodes.push(list);
  }
  if (view.boxes?.length) {
    const row = el('div', 'logic-boxes');
    row.style.setProperty('--n', String(view.boxes.length));
    for (const item of view.boxes) row.append(box(item, live));
    nodes.push(row);
  }
  root.replaceChildren(...nodes);
  if (focused !== undefined) root.querySelector(`[data-focus="${focused}"]`)?.focus?.();
}

/**
 * 작은 그림(처음 화면, 하던 판, 판 고르기, "만들기" 목록): 주민들의 모습이나 상자들.
 * @param {HTMLElement} root
 * @param {{faces?: string[], marks?: (string|null)[], boxes?: number, fork?: boolean, blank?: string}} view
 *   faces 주민들의 모습, marks 쳐 본 종류('knight'|'liar'|null), boxes 상자 수, fork 갈림길을 그리는가, blank 아직 정하지 않은 주민의 글자
 */
export function drawMini(root, view) {
  root.className = 'logic-mini';
  const nodes = [];
  if (view.boxes) {
    for (let at = 0; at < view.boxes; at++) {
      const chest = el('span', 'logic-chest mini');
      chest.append(el('span', 'logic-lid'), el('span', 'logic-chest-body'));
      nodes.push(chest);
    }
  }
  for (const [index, face] of (view.faces ?? []).entries()) {
    const mark = view.marks?.[index] ?? 'none';
    nodes.push(el('span', `logic-face mini mark-${mark}`, face));
  }
  if (view.blank) for (let at = 0; at < 2; at++) nodes.push(el('span', 'logic-face mini blank', view.blank));
  if (view.fork) {
    const roads = el('span', 'logic-roads mini');
    roads.append(el('span', 'logic-road road-left'), el('span', 'logic-road road-right'));
    nodes.push(roads);
  }
  root.setAttribute('aria-hidden', 'true');
  root.replaceChildren(...nodes);
}

/** 판 하나를 담은 새 조각("왜 그럴까?"와 풀이의 그림). 아래에 한 줄 글을 붙일 수 있다. */
export function boardCard(view, note) {
  const card = el('div', 'logic-figure');
  const picture = el('div');
  card.append(picture);
  drawBoard(picture, { ...view, live: false, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/**
 * 직접 만들기에서 쓰는 고르기 단추들(누가, 어떤 말, 누구에 대해, 몇 명).
 * @param {HTMLElement} root
 * @param {{items: {value: string, text: string, label?: string}[], value: string|null, onPick: (value: string) => void, disabled?: boolean}} view
 */
export function drawChoices(root, view) {
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.value : undefined;
  root.replaceChildren(
    ...view.items.map((item) => {
      const node = button('', item.text, () => view.onPick(item.value), item.label);
      node.dataset.value = item.value;
      node.setAttribute('aria-pressed', String(item.value === view.value));
      node.disabled = Boolean(view.disabled);
      return node;
    }),
  );
  if (focused !== undefined) root.querySelector(`[data-value="${focused}"]`)?.focus?.();
}
