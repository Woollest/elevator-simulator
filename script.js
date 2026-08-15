import React, { useEffect, useRef, useState } from 'https://esm.sh/react@19.1.1';
import { createRoot } from 'https://esm.sh/react-dom@19.1.1/client';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(React.createElement);
const HALL_FLOOR = 12, MIN_FLOOR = 1, MAX_FLOOR = 20;
let rustCore = null;
WebAssembly.instantiateStreaming(fetch('./elevator_core.wasm')).then(({ instance }) => { rustCore = instance.exports; }).catch(() => {});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const randomFloor = () => {
  const choices = Array.from({ length: MAX_FLOOR }, (_, i) => i + 1).filter(value => value !== HALL_FLOOR);
  return choices[Math.floor(Math.random() * choices.length)];
};
const shouldStop = (direction, up, down) => rustCore
  ? rustCore.should_stop(direction, Number(up), Number(down)) === 1
  : (direction > 0 ? up : down);

function App() {
  const [floor, setFloor] = useState(randomFloor);
  const [direction, setDirection] = useState(Math.random() > .5 ? 1 : -1);
  const [moving, setMoving] = useState(false);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [calls, setCalls] = useState({ up: false, down: false });
  const [notice, setNotice] = useState('');
  const [displayTick, setDisplayTick] = useState(0);
  const callsRef = useRef(calls), floorRef = useRef(floor), directionRef = useRef(direction);
  const runningRef = useRef(false), pressesRef = useRef([]), audioRef = useRef(null), noticeTimerRef = useRef(null);
  useEffect(() => { callsRef.current = calls; }, [calls]);
  useEffect(() => { floorRef.current = floor; }, [floor]);
  useEffect(() => { directionRef.current = direction; }, [direction]);

  function unlockAudio() {
    if (!audioRef.current) { const Ctx = window.AudioContext || window.webkitAudioContext; if (Ctx) audioRef.current = new Ctx(); }
    audioRef.current?.resume();
  }
  function chime() {
    const context = audioRef.current; if (!context || context.state !== 'running') return;
    const now = context.currentTime, master = context.createGain();
    master.gain.setValueAtTime(.0001, now); master.gain.exponentialRampToValueAtTime(.14, now + .02); master.gain.exponentialRampToValueAtTime(.0001, now + 1.55); master.connect(context.destination);
    [659.25, 987.77].forEach((frequency, index) => { const oscillator = context.createOscillator(), gain = context.createGain(); oscillator.frequency.value = frequency; gain.gain.setValueAtTime(index ? .22 : .72, now); gain.gain.exponentialRampToValueAtTime(.001, now + (index ? .9 : 1.45)); oscillator.connect(gain).connect(master); oscillator.start(now); oscillator.stop(now + 1.6); });
  }
  function showNotice(text) { clearTimeout(noticeTimerRef.current); setNotice(text); noticeTimerRef.current = setTimeout(() => setNotice(''), 3200); }
  function press(name) {
    unlockAudio();
    const now = Date.now(); pressesRef.current = [...pressesRef.current.filter(time => now - time < 2200), now];
    if (pressesRef.current.length >= 5) showNotice(pressesRef.current.length >= 8 ? '連打しても、到着時刻は変わりません。' : '呼び出しは、すでに登録されています。');
    if (!callsRef.current[name]) {
      const nextCalls = { ...callsRef.current, [name]: true };
      callsRef.current = nextCalls;
      setCalls(nextCalls);
    }
    if (!runningRef.current) runController();
  }
  async function runController() {
    runningRef.current = true; setMoving(true);
    let target = directionRef.current > 0 ? MAX_FLOOR : MIN_FLOOR;
    while (callsRef.current.up || callsRef.current.down) {
      await sleep(1350 + Math.random() * 750);
      const next = floorRef.current + directionRef.current;
      if (next > MAX_FLOOR || next < MIN_FLOOR) { directionRef.current *= -1; setDirection(directionRef.current); target = directionRef.current > 0 ? MAX_FLOOR : MIN_FLOOR; await sleep(1100); continue; }
      floorRef.current = next; setFloor(next); setDisplayTick(value => value + 1);
      if (next === HALL_FLOOR) {
        if (shouldStop(directionRef.current, callsRef.current.up, callsRef.current.down)) {
          setMoving(false); await sleep(600); chime(); await sleep(720); setDoorsOpen(true);
          const served = directionRef.current > 0 ? 'up' : 'down';
          const remaining = { ...callsRef.current, [served]: false }; callsRef.current = remaining; setCalls(remaining);
          await sleep(4200); setDoorsOpen(false); await sleep(1750);
          if (!(remaining.up || remaining.down)) break; setMoving(true);
        } else {
          await sleep(650);
        }
      }
      if (next === target) { await sleep(1300 + Math.random() * 1200); directionRef.current *= -1; setDirection(directionRef.current); target = directionRef.current > 0 ? MAX_FLOOR : MIN_FLOOR; }
      else if (Math.random() < .38 && Math.abs(next - HALL_FLOOR) > 1) {
        // The car has stopped at another floor for passengers. From the hall,
        // only the stationary floor display and the natural dwell time are seen.
        setMoving(false);
        await sleep(2700 + Math.random() * 3000);
        setMoving(true);
      }
    }
    setMoving(false); runningRef.current = false;
  }
  return html`<main className="hall" aria-label="12階のエレベーターホール">
    <div className="ceiling" aria-hidden="true"><span className="light light--left"></span><span className="light light--right"></span></div><div className="wall wall--left" aria-hidden="true"></div>
    <div className="floor-plaque" aria-label="現在の階は12階"><span>12</span><small>F</small></div>
    <section className="elevator" aria-label="エレベーター"><div className="indicator-housing"><div className="indicator" aria-live="polite"><span className="indicator-glass"></span><span key=${displayTick} className="floor-number changing">${floor}</span><span className=${`direction ${moving ? '' : 'idle'}`} aria-label=${direction > 0 ? '上昇中' : '下降中'}>${direction > 0 ? '▲' : '▼'}</span></div></div><div className="lintel"></div><div className=${`door-frame ${doorsOpen ? 'open' : ''}`}><div className="cab"><div className="cab-ceiling"><i></i><i></i></div><div className="cab-back"><span className="cab-seam"></span></div><div className="cab-floor"></div></div><div className="door door--left"><span></span></div><div className="door door--right"><span></span></div><div className="door-shadow"></div></div><div className="sill"></div></section>
    <aside className="call-panel" aria-label="エレベーター呼び出しパネル"><button className=${`call-button ${calls.up ? 'lit' : ''}`} onClick=${() => press('up')} aria-label="上りエレベーターを呼ぶ" aria-pressed=${calls.up}><span className="button-rim"><span className="button-face"><span className="button-arrow">▲</span></span></span></button><button className=${`call-button ${calls.down ? 'lit' : ''}`} onClick=${() => press('down')} aria-label="下りエレベーターを呼ぶ" aria-pressed=${calls.down}><span className="button-rim"><span className="button-face"><span className="button-arrow">▼</span></span></span></button></aside>
    <div className=${`building-notice ${notice ? 'show' : ''}`} role="status">${notice}</div><div className="wall wall--right"></div><div className="baseboard"></div><div className="floor"><div className="reflection"></div></div>
  </main>`;
}
createRoot(document.getElementById('root')).render(html`<${App} />`);
