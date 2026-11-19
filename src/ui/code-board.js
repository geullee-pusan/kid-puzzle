// 숫자 추리의 판을 그린다: 숫자 칸, 추측과 답의 표, 메모판, 작은 그림.
// 색만으로 알리지 않는다. 답은 글과 수로 적고, 견줘 볼 줄에는 글자 표시를 붙이고, 메모판에서 지운 숫자에는 줄을 긋는다.
// 화면에 나오는 글은 모두 받아서 쓴다(대본에 있다). 이 파일에는 글을 적지 않는다.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * 숫자 칸들. 한 칸에 숫자 하나다.
 * @param {string[]} chars 칸마다 적을 글자(빈 칸은 '')
 * @param {{small?: boolean, next?: number}} options next: 다음에 채울 칸(테두리를 굵게 한다)
 */
export function digitBoxes(chars, { small = false, next = -1 } = {}) {
  const box = el('span', `code-digits${small ? ' small' : ''}`);
  chars.forEach((ch, index) => {
    const cell = el('span', 'code-digit', ch);
    if (ch === '') cell.classList.add('empty');
    if (index === next) cell.classList.add('next');
    box.append(cell);
  });
  return box;
}

/**
 * 숫자판 위의 칸: 지금 넣는 중인 추측이나 암호.
 * @param {HTMLElement} root
 * @param {{chars: string[], next: number, label: string}} view label: 읽어 줄 글
 */
export function drawSlots(root, view) {
  root.className = 'code-slots';
  root.setAttribute('aria-label', view.label);
  root.replaceChildren(digitBoxes(view.chars, { next: view.next }));
}

/**
 * 추측과 답의 표.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   heads     { no, guess, hit, place, left } 머리글
 *   rows      줄들. 줄 하나는 { kind, no, guess, hit, place, left, flag }
 *               kind  ''(보통 줄) | 'pending'(답을 기다리는 줄) | 'flagged'(견줘 볼 줄) | 'label'(번호 자리에 이름을 적는 줄)
 *                     | 'start'(처음 후보 수만 적는 줄)
 *               flag  견줘 볼 줄에 붙이는 글자 표시
 *   cols      답의 칸들(['hit', 'place']가 기본. 한쪽만 알려 주는 판은 그 칸만)
 *   showLeft  남은 후보 수의 칸을 보이는가
 *   follow    그린 뒤 맨 아래 줄(또는 견줘 볼 줄)이 보이게 한다
 */
export function drawTable(root, view) {
  const { heads, rows, cols = ['hit', 'place'], showLeft = false, follow = false } = view;
  const table = el('table', 'code-table');
  const head = el('tr');
  for (const key of ['no', 'guess', ...cols]) {
    const cell = el('th', `col-${key}`, heads[key]);
    cell.scope = 'col';
    head.append(cell);
  }
  if (showLeft) {
    const cell = el('th', 'col-left', heads.left);
    cell.scope = 'col';
    head.append(cell);
  }
  const top = el('thead');
  top.append(head);
  const body = el('tbody');
  let focus = null;
  for (const row of rows) {
    const line = el('tr', row.kind ? `row-${row.kind}` : '');
    const first = el('th', 'col-no', row.no);
    first.scope = 'row';
    if (row.flag) first.append(el('span', 'code-flag', row.flag));
    line.append(first);
    const guess = el('td', 'col-guess');
    if (row.guess) guess.append(digitBoxes([...row.guess]));
    line.append(guess, ...cols.map((key) => el('td', `col-${key}`, row[key] ?? '')));
    if (showLeft) line.append(el('td', 'col-left', row.left ?? ''));
    if (row.kind === 'flagged') focus = line;
    body.append(line);
  }
  table.append(top, body);
  root.replaceChildren(table);
  if (follow) {
    if (focus) focus.scrollIntoView({ block: 'nearest' });
    else root.scrollTop = root.scrollHeight;
  }
}

/**
 * 메모판: 자리마다 숫자 칩이 늘어선 판. 누르면 "아닌 것"으로 줄이 그어지고 다시 누르면 돌아온다.
 * 맞는지 판정하지 않는다. 아이가 스스로 후보를 지워 가는 종이다.
 * @param {HTMLElement} root
 * @param {object} view
 *   positions  자리의 이름들(자릿수만큼)
 *   digits     쓸 수 있는 숫자들
 *   struck     자리마다 지운 숫자들(글자열의 배열)
 *   label      (자리 번호, 숫자) → 읽어 줄 이름
 *   onTap      (자리 번호, 숫자) → 눌렀을 때. 없으면 누를 수 없다
 */
export function drawMemo(root, view) {
  const { positions, digits, struck, label, onTap } = view;
  root.className = 'memo-rows';
  root.style.setProperty('--n', String(digits.length));
  const rows = positions.map((name, at) => {
    const row = el('div', 'memo-row');
    row.append(el('span', 'memo-pos', name));
    const chips = el('div', 'memo-chips');
    for (const digit of digits) {
      const off = struck[at].includes(digit);
      const chip = el('button', `memo-chip${off ? ' struck' : ''}`, digit);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(off));
      chip.setAttribute('aria-label', label(at, digit));
      if (onTap) chip.addEventListener('click', () => onTap(at, digit));
      else chip.disabled = true;
      chips.append(chip);
    }
    row.append(chips);
    return row;
  });
  root.replaceChildren(...rows);
}

/**
 * 풀이와 "왜 그럴까?"에 넣는 그림 한 장: 암호(있으면), 표(있으면), 암호 몇 개의 목록(있으면), 아래 글.
 * @param {object} view
 *   answer  { label, code } 맨 위에 적을 암호
 *   table   drawTable에 넘길 값
 *   list    { codes, more } 암호 몇 개를 늘어놓고 더 있다는 표시를 붙인다
 *   note    아래에 적을 글
 */
export function codeCard(view) {
  const card = el('div', 'code-card');
  if (view.answer) {
    const line = el('div', 'code-answer');
    line.append(el('strong', '', view.answer.label), digitBoxes([...view.answer.code]));
    card.append(line);
  }
  if (view.list) {
    const list = el('div', 'code-list');
    for (const code of view.list.codes) list.append(digitBoxes([...code], { small: true }));
    list.append(el('span', 'code-more', view.list.more));
    card.append(list);
  }
  if (view.table) {
    const holder = el('div', 'code-card-table');
    drawTable(holder, view.table);
    card.append(holder);
  }
  if (view.note) card.append(el('p', 'strip-note', view.note));
  return card;
}

/**
 * 작은 그림(처음 화면의 카드, 판 고르기, 하던 판). 줄 하나는 숫자 칸과 그 앞뒤의 글이다.
 * @param {HTMLElement} root
 * @param {object} view
 *   rows    줄들. 줄 하나는 { label, chars, line }: 앞에 붙일 이름, 숫자 칸에 적을 글자들, 칸 뒤에 적을 글(답 두 수)
 *   more    줄이 더 있다는 표시(있으면 줄들 아래에 적는다)
 *   strip   아래에 늘어놓을 숫자들(쓸 수 있는 숫자)
 */
export function drawMini(root, view) {
  root.className = view.rows.length === 1 ? 'code-mini single' : 'code-mini';
  const nodes = view.rows.map((item) => {
    const row = el('div', 'code-mini-row');
    if (item.label) row.append(el('span', 'code-mini-label', item.label));
    row.append(digitBoxes(item.chars, { small: true }));
    if (item.line) row.append(el('span', 'code-mini-line', item.line));
    return row;
  });
  if (view.more) nodes.push(el('div', 'code-more', view.more));
  if (view.strip) nodes.push(el('div', 'code-strip', [...view.strip].join(' ')));
  root.replaceChildren(...nodes);
}

/**
 * 수 고르기: 0부터 most까지의 단추가 한 줄로 늘어선다(역할 바꾸기와 직접 만들기에서 답 두 수를 넣는다).
 * 누르는 것은 바깥에서 받는다(단추마다 data-n에 수가 적혀 있다).
 * @param {HTMLElement} root
 * @param {{most: number, value: number|null, label: (n: number) => string, disabled?: boolean}} view
 */
export function drawPicker(root, view) {
  const buttons = [];
  for (let n = 0; n <= view.most; n++) {
    const button = el('button', 'btn pick', String(n));
    button.type = 'button';
    button.dataset.n = String(n);
    button.setAttribute('aria-pressed', String(view.value === n));
    button.setAttribute('aria-label', view.label(n));
    button.disabled = Boolean(view.disabled);
    buttons.push(button);
  }
  root.style.setProperty('--n', String(view.most + 1));
  root.replaceChildren(...buttons);
}
