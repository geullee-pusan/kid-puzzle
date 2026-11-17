// 처음 만남: 앱을 처음 열 때 한 번. 네 개는 되고 다섯 개는 안 되는 것을 직접 겪는다. 까닭은 말해 주지 않는다.
// 화면에 나오는 글은 대본(src/content/coins.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
import T from './content/coins.json';
import { RULES, applyMove, headCount } from './core/coins.js';
import { fill } from './core/text.js';
import { drawCoins } from './ui/coin-board.js';

const FORMAT = 'coins';
const MEET = { rule: 'any2', shape: 'line', first: 4, second: 5, cannotAfter: 2, oddAfter: 3 };

/**
 * @param {object} frame 틀(src/main.js)이 건네주는 것: $, log, talkers, setScreen, clearRound, showHome
 * @returns {{show: (replay?: boolean) => void}}
 */
export function createMeet(frame) {
  const { $, log } = frame;
  const talker = frame.talkers.meet;
  let meet = null; // 처음 만남에서 하는 중인 것

  const coinLabel = (index, heads) => fill(T.coinLabel, { no: index + 1, face: heads ? T.faces.heads : T.faces.tails });
  const meetPlaying = () => meet.step === 'first' || meet.step === 'second';
  const meetStamp = () => Math.round((performance.now() - meet.since) / 100) / 10;

  function meetNote(type, data = {}) {
    meet.events.push({ t: meetStamp(), type, ...data });
  }

  function showMeet(replay = false) {
    frame.setScreen('meet');
    frame.clearRound();
    meet = {
      id: log.newId('i'),
      startedAt: new Date().toISOString(),
      since: performance.now(),
      replay,
      step: 'first', // 'first'(네 개) → 'first-done' → 'second'(다섯 개) → 'reveal'
      coins: Array(MEET.first).fill(1),
      selected: [],
      sinceReset: 0,
      counts: { first: 0, second: 0, resets: 0 },
      events: [],
    };
    drawMeet();
    talker.say(T.meet.start);
  }

  function drawMeet(flipped = []) {
    drawCoins($('meet-board'), {
      coins: meet.coins,
      shape: MEET.shape,
      faces: T.faces,
      label: coinLabel,
      onTap: meetPlaying() ? tapMeet : undefined,
      selected: meet.selected,
      flipped,
    });
    $('meet-reset').disabled = !meetPlaying() || meet.sinceReset === 0;
    $('meet-more').hidden = meet.step !== 'first-done';
    // 몇 번 해 본 뒤에야 "안 되는 것 같아요"가 나온다. 해 보지 않고 누르지 않게 한다.
    $('meet-cannot').hidden = !(meet.step === 'second' && meet.counts.second >= MEET.cannotAfter);
    $('meet-enter').hidden = meet.step !== 'reveal';
  }

  function tapMeet(index) {
    if (!meetPlaying()) return;
    if (meet.selected.includes(index)) meet.selected = meet.selected.filter((item) => item !== index);
    else meet.selected = [...meet.selected, index];
    if (meet.selected.length < RULES[MEET.rule].count) {
      drawMeet();
      return;
    }
    const move = meet.selected.slice().sort((x, y) => x - y);
    meet.selected = [];
    meet.coins = applyMove(meet.coins, move);
    meet.sinceReset += 1;
    meet.counts[meet.step] += 1;
    meetNote('flip', { coins: move });
    if (meet.step === 'first') {
      if (headCount(meet.coins) === 0) {
        meet.step = 'first-done';
        meetNote('first-done');
        talker.say(T.meet.fourDone);
      } else if (meet.counts.first === 1) talker.say(T.meet.flipped);
    } else if (meet.counts.second === MEET.oddAfter) talker.say(T.meet.odd);
    drawMeet(move);
  }

  function meetReset() {
    if (!meetPlaying() || meet.sinceReset === 0) return;
    meet.coins = Array(meet.step === 'first' ? MEET.first : MEET.second).fill(1);
    meet.selected = [];
    meet.sinceReset = 0;
    meet.counts.resets += 1;
    meetNote('reset');
    drawMeet();
  }

  function meetMore() {
    if (meet.step !== 'first-done') return;
    meet.step = 'second';
    meet.coins = Array(MEET.second).fill(1);
    meet.selected = [];
    meet.sinceReset = 0;
    meetNote('second');
    drawMeet([MEET.second - 1]);
    talker.say(T.meet.five);
  }

  function meetCannot() {
    if (meet.step !== 'second') return;
    meet.step = 'reveal';
    meet.selected = [];
    meetNote('cannot');
    drawMeet();
    talker.say(T.meet.reveal);
  }

  /** 처음 만남을 끝낸다. outcome: 'entered'(끝까지 보고 들어감) | 'skipped'(건너뜀) */
  function leaveMeet(outcome) {
    meetNote(outcome);
    log.saveRecord({
      kind: 'meet',
      v: 1,
      id: meet.id,
      format: FORMAT,
      startedAt: meet.startedAt,
      endedAt: new Date().toISOString(),
      replay: meet.replay,
      reached: meet.step,
      events: meet.events,
      flipsFirst: meet.counts.first,
      flipsSecond: meet.counts.second,
      resetCount: meet.counts.resets,
      seconds: meetStamp(),
      outcome,
    });
    log.savePrefs({ ...log.loadPrefs(), met: true });
    log.flush();
    meet = null;
    frame.showHome();
  }

  $('meet-skip').addEventListener('click', () => leaveMeet('skipped'));
  $('meet-reset').addEventListener('click', meetReset);
  $('meet-more').addEventListener('click', meetMore);
  $('meet-cannot').addEventListener('click', meetCannot);
  $('meet-enter').addEventListener('click', () => leaveMeet('entered'));

  return { show: showMeet };
}
