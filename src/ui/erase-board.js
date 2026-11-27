// 지우고 쓰기 예언의 판을 그린다: 쪽지 두 장(선생님 쪽지, 내 쪽지)과 칠판, 칠판에 붙은 수 카드들.
// 누를 수 있는 판은 수 카드마다 단추 하나다. 보기만 하는 그림(처음 화면, 공책, 판 고르기, 풀이, "왜 그럴까?", 직접 만들기의 그림)은 SVG로 작게 그린다.
// 색만으로 알리지 않는다. 고른 수는 아주 굵은 테두리와 위로 들린 모양, 방금 쓴 수는 점선 고리, 그림에서 다음에 지울 두 수는 점선 테두리와 꼭짓점의 작은 세모다.
// 접힌 쪽지는 모서리가 접힌 모양과 빗금, 연 쪽지는 흰 종이에 굵은 글자다.
// 글자는 형식(src/formats/erase.js)이 대본에서 채워 건넨다. 이 파일에는 글을 적지 않는다.

const NS = 'http://www.w3.org/2000/svg';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function make(tag, attrs = {}, className = '') {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (className) node.setAttribute('class', className);
  return node;
}

/** 칠판의 칸 수: 수가 많을수록 한 줄에 많이 놓는다(스무 개면 다섯 줄에 넷씩) */
export function columnsOf(count) {
  if (count <= 4) return Math.max(count, 1);
  if (count <= 9) return 3;
  if (count <= 12) return 4;
  return 5;
}

/**
 * 쪽지 한 장.
 *   who   'teacher' | 'kid'
 *   title 쪽지의 이름
 *   text  적힌 것(접힌 쪽지는 접힌 모양의 글)
 *   shut  접혀 있는가
 *   label 읽어 줄 이름
 */
function noteCard(note) {
  const card = el('div', `er-note ${note.who}${note.shut ? ' shut' : ''}${note.empty ? ' empty' : ''}`);
  card.append(el('span', 'er-note-title', note.title), el('strong', 'er-note-body', note.text));
  if (note.label) {
    card.setAttribute('role', 'img');
    card.setAttribute('aria-label', note.label);
  }
  return card;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   chips    칠판의 수 카드들 [{ id, value, slot }](놓인 차례대로). slot이 있으면 그 자리에 놓는다(지운 자리는 빈 채로 둔다)
 *   notes    쪽지들(위의 noteCard)
 *   selected 고른 수의 이름(없으면 null)
 *   fresh    방금 새로 쓴 수의 이름(없으면 null)
 *   onChip   (수의 이름) → 눌렀을 때. 없으면 누를 수 없다
 *   cols     한 줄의 카드 수(없으면 수의 개수로 정한다)
 *   slots    칠판의 자리 수(없으면 수의 개수). 판에서는 처음 칠판의 수의 개수라서, 지워도 칠판의 크기와 남은 카드의 자리가 그대로다
 *   labels   { board, chip(카드, 차례) } 읽어 줄 이름
 */
export function drawChalk(root, view) {
  const { chips, notes = [], selected = null, fresh = null, onChip, labels } = view;
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.id : undefined;
  root.className = `er-board live${onChip ? '' : ' still'}`;
  const slots = view.slots ?? chips.length;
  const cols = columnsOf(slots);
  const box = el('div', 'er-notes');
  for (const note of notes) box.append(noteCard(note));
  const chalk = el('div', 'er-chalk');
  chalk.style.setProperty('--cols', String(cols));
  chalk.style.setProperty('--rows', String(Math.ceil(slots / cols)));
  chalk.setAttribute('role', 'group');
  if (labels?.board) chalk.setAttribute('aria-label', labels.board);
  chips.forEach((chip, index) => {
    const card = el(onChip ? 'button' : 'span', 'er-chip', String(chip.value));
    if (chip.id === selected) card.classList.add('picked');
    if (chip.id === fresh) card.classList.add('fresh');
    card.dataset.id = String(chip.id);
    const slot = chip.slot ?? index;
    card.style.gridColumn = String((slot % cols) + 1);
    card.style.gridRow = String(Math.floor(slot / cols) + 1);
    if (labels?.chip) card.setAttribute('aria-label', labels.chip(chip, index));
    if (onChip) {
      card.type = 'button';
      card.addEventListener('click', () => onChip(chip.id));
    }
    chalk.append(card);
  });
  root.replaceChildren(...(notes.length > 0 ? [box] : []), chalk);
  if (focused !== undefined) root.querySelector(`[data-id="${focused}"]`)?.focus?.();
}

// ---- 작은 그림(SVG) ----

const CHIP = 100; // 수 카드 한 변
const GAP = 16; // 카드 사이
const PAD = 26; // 칠판 안쪽 여백
const FRAME = 14; // 칠판 테두리

/**
 * 칠판 그림. 수 카드는 놓인 차례대로 왼쪽 위부터 채운다.
 *   nums   칠판의 수들
 *   marks  점선 테두리로 짚을 카드의 차례들(다음에 지울 두 수)
 *   ring   점선 고리로 짚을 카드의 차례(방금 쓴 수)
 *   cols   한 줄의 카드 수(없으면 자리 수로 정한다)
 *   places 수마다 칠판의 자리(없으면 차례대로). slots 칠판의 자리 수(없으면 수의 개수). 지운 자리는 빈 채로 그린다
 */
export function chalkSvg({ nums, marks = [], ring = null, cols = null, places = null, slots = null }) {
  const count = Math.max(slots ?? nums.length, 1);
  const across = cols ?? columnsOf(count);
  const rows = Math.ceil(count / across);
  const width = 2 * (FRAME + PAD) + across * CHIP + (across - 1) * GAP;
  const height = 2 * (FRAME + PAD) + rows * CHIP + (rows - 1) * GAP;
  const svg = make('svg', { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'xMidYMid meet' }, 'er-svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.append(make('rect', { x: 0, y: 0, width, height, rx: 18 }, 'er-art-frame'));
  svg.append(make('rect', { x: FRAME, y: FRAME, width: width - 2 * FRAME, height: height - 2 * FRAME, rx: 8 }, 'er-art-chalk'));
  const marked = new Set(marks);
  nums.forEach((value, index) => {
    const place = places ? places[index] : index;
    const x = FRAME + PAD + (place % across) * (CHIP + GAP);
    const y = FRAME + PAD + Math.floor(place / across) * (CHIP + GAP);
    svg.append(make('rect', { x, y, width: CHIP, height: CHIP, rx: 14 }, 'er-art-chip'));
    if (marked.has(index)) {
      svg.append(make('rect', { x: x - 7, y: y - 7, width: CHIP + 14, height: CHIP + 14, rx: 18 }, 'er-art-mark'));
      svg.append(make('path', { d: `M${x - 7},${y + 22}L${x - 7},${y - 7}L${x + 22},${y - 7}Z` }, 'er-art-corner'));
    }
    if (ring === index) svg.append(make('circle', { cx: x + CHIP / 2, cy: y + CHIP / 2, r: CHIP / 2 + 6 }, 'er-art-ring'));
    const text = make('text', { x: x + CHIP / 2, y: y + CHIP / 2 + 15, 'text-anchor': 'middle', 'font-size': String(value).length >= 3 ? 38 : 46 }, 'er-art-number');
    text.textContent = String(value);
    svg.append(text);
  });
  return svg;
}

/** 작은 칠판(처음 화면, 공책, 판 고르기, 만들기 목록): 자리가 낮고 넓어서 한 줄로(열 개가 넘으면 두 줄로) 놓는다 */
export function drawMini(root, view) {
  const count = Math.max(view.nums.length, 1);
  root.className = 'er-board small';
  root.replaceChildren(chalkSvg({ ...view, cols: count <= 10 ? count : Math.ceil(count / 2) }));
}

/**
 * 그림 하나를 담은 새 조각(풀이, "왜 그럴까?", 직접 만들기의 그림). 아래에 한 줄 글을 붙일 수 있다.
 * 크기: 보통은 판 위의 종이에 한 줄에 서너 장, big은 한 장이 들어간다.
 */
export function chalkCard(view, note, { big = false } = {}) {
  const card = el('div', big ? 'er-card big' : 'er-card');
  card.append(chalkSvg(view));
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
