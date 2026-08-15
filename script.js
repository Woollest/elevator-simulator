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
  const runningRef = useRef(false), aliveRef = useRef(true), pressesRef = useRef([]), audioRef = useRef(null), audioGraphRef = useRef(null), noticeTimerRef = useRef(null);
  useEffect(() => { callsRef.current = calls; }, [calls]);
  useEffect(() => { floorRef.current = floor; }, [floor]);
  useEffect(() => { directionRef.current = direction; }, [direction]);
  useEffect(() => { updateMotorSound(floor, moving); }, [floor, moving]);
  useEffect(() => {
    runController();
    return () => { aliveRef.current = false; };
  }, []);

  function unlockAudio() {
    if (!audioRef.current) { const Ctx = window.AudioContext || window.webkitAudioContext; if (Ctx) audioRef.current = new Ctx(); }
    audioRef.current?.resume().then(startAmbience);
  }
  function noiseBuffer(context, seconds = 2) {
    const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
  function startAmbience() {
    const context = audioRef.current; if (!context || audioGraphRef.current) return;
    const master = context.createGain(); master.gain.value = .7; master.connect(context.destination);
    const air = context.createBufferSource(), airFilter = context.createBiquadFilter(), airGain = context.createGain();
    air.buffer = noiseBuffer(context); air.loop = true; airFilter.type = 'lowpass'; airFilter.frequency.value = 360; airGain.gain.value = .022;
    air.connect(airFilter).connect(airGain).connect(master); air.start();
    const hum = context.createOscillator(), humGain = context.createGain(); hum.type = 'sine'; hum.frequency.value = 100; humGain.gain.value = .0022; hum.connect(humGain).connect(master); hum.start();
    const motor = context.createOscillator(), overtone = context.createOscillator(), motorGain = context.createGain();
    motor.type = 'sine'; motor.frequency.value = 42; overtone.type = 'triangle'; overtone.frequency.value = 84; motorGain.gain.value = .0001;
    motor.connect(motorGain); overtone.connect(motorGain); motorGain.connect(master); motor.start(); overtone.start();
    audioGraphRef.current = { motor, overtone, motorGain };
    updateMotorSound(floorRef.current, true);
  }
  function updateMotorSound(currentFloor, isMoving) {
    const context = audioRef.current, graph = audioGraphRef.current; if (!context || !graph) return;
    const proximity = Math.max(0, 1 - Math.abs(currentFloor - HALL_FLOOR) / 10), frequency = 36 + proximity * 18;
    graph.motorGain.gain.cancelScheduledValues(context.currentTime);
    graph.motorGain.gain.linearRampToValueAtTime(isMoving ? .0025 + proximity * .022 : .0001, context.currentTime + .45);
    graph.motor.frequency.linearRampToValueAtTime(frequency, context.currentTime + .5);
    graph.overtone.frequency.linearRampToValueAtTime(frequency * 2.03, context.currentTime + .5);
  }
  function chime(volume = .14, pan = 0, muffled = false) {
    const context = audioRef.current; if (!context || context.state !== 'running') return;
    const now = context.currentTime, master = context.createGain(), filter = context.createBiquadFilter(), panner = context.createStereoPanner();
    panner.pan.value = pan; filter.type = 'lowpass'; filter.frequency.value = muffled ? 720 : 4200;
    master.gain.setValueAtTime(.0001, now); master.gain.exponentialRampToValueAtTime(volume, now + .02); master.gain.exponentialRampToValueAtTime(.0001, now + 1.55); master.connect(filter).connect(panner).connect(context.destination);
    [659.25, 987.77].forEach((frequency, index) => { const oscillator = context.createOscillator(), gain = context.createGain(); oscillator.frequency.value = frequency; gain.gain.setValueAtTime(index ? .22 : .72, now); gain.gain.exponentialRampToValueAtTime(.001, now + (index ? .9 : 1.45)); oscillator.connect(gain).connect(master); oscillator.start(now); oscillator.stop(now + 1.6); });
  }
  function distantDoorSound(distance, pan) {
    const context = audioRef.current; if (!context || context.state !== 'running') return;
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain(), panner = context.createStereoPanner(), now = context.currentTime;
    source.buffer = noiseBuffer(context, .8); filter.type = 'bandpass'; filter.frequency.value = 280; filter.Q.value = 1.4; panner.pan.value = pan;
    gain.gain.setValueAtTime(.0001, now); gain.gain.linearRampToValueAtTime(Math.max(.006, .024 - distance * .0015), now + .25); gain.gain.exponentialRampToValueAtTime(.0001, now + 1.3);
    source.connect(filter).connect(gain).connect(panner).connect(context.destination); source.start(now); source.stop(now + 1.4);
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
  }
  async function runController() {
    if (runningRef.current) return;
    runningRef.current = true; setMoving(true);
    let target = directionRef.current > 0 ? MAX_FLOOR : MIN_FLOOR;
    while (aliveRef.current) {
      await sleep(1350 + Math.random() * 750);
      const next = floorRef.current + directionRef.current;
      if (next > MAX_FLOOR || next < MIN_FLOOR) { directionRef.current *= -1; setDirection(directionRef.current); target = directionRef.current > 0 ? MAX_FLOOR : MIN_FLOOR; await sleep(1100); continue; }
      floorRef.current = next; setFloor(next); setDisplayTick(value => value + 1);
      if (next === HALL_FLOOR) {
        if (shouldStop(directionRef.current, callsRef.current.up, callsRef.current.down)) {
          setMoving(false); await sleep(600); chime(.14, 0, false); await sleep(720); setDoorsOpen(true);
          const served = directionRef.current > 0 ? 'up' : 'down';
          const remaining = { ...callsRef.current, [served]: false }; callsRef.current = remaining; setCalls(remaining);
          await sleep(4200); setDoorsOpen(false); await sleep(1750);
          setMoving(true);
        } else {
          await sleep(650);
        }
      }
      if (next === target) { await sleep(1300 + Math.random() * 1200); directionRef.current *= -1; setDirection(directionRef.current); target = directionRef.current > 0 ? MAX_FLOOR : MIN_FLOOR; }
      else if (Math.random() < .38 && Math.abs(next - HALL_FLOOR) > 1) {
        // The car has stopped at another floor for passengers. From the hall,
        // only the stationary floor display and the natural dwell time are seen.
        setMoving(false);
        const distance = Math.abs(next - HALL_FLOOR), side = directionRef.current > 0 ? .48 : -.48;
        chime(Math.max(.012, .052 - distance * .003), side, true);
        await sleep(520);
        distantDoorSound(distance, side);
        await sleep(2700 + Math.random() * 3000);
        setMoving(true);
      }
    }
    setMoving(false); runningRef.current = false;
  }
  return html`<main className="hall" aria-label="12階のエレベーターホール">
    <div className="ceiling" aria-hidden="true"><span className="light light--left"></span><span className="light light--right"></span><span className="downlight"></span></div>
    <div className="wall wall--left" aria-hidden="true"></div><div className="wall-joint wall-joint--left" aria-hidden="true"></div><div className="wall-joint wall-joint--right" aria-hidden="true"></div>
    <div className="security-camera" aria-hidden="true"><span className="camera-arm"></span><span className="camera-body"><i></i></span></div>
    <div className="hall-speaker" aria-hidden="true">${Array.from({length: 18}, (_, i) => html`<i key=${i}></i>`)}</div>
    <div className="floor-plaque" aria-label="現在の階は12階"><span>12</span><small>F</small></div>
    <section className="elevator" aria-label="エレベーター"><div className="indicator-housing"><div className="indicator" aria-live="polite"><span className="indicator-glass"></span><span key=${displayTick} className="floor-number changing">${floor}</span><span className=${`direction ${moving ? '' : 'idle'}`} aria-label=${direction > 0 ? '上昇中' : '下降中'}>${direction > 0 ? '▲' : '▼'}</span></div></div><div className="lintel"></div><div className=${`door-frame ${doorsOpen ? 'open' : ''}`}><div className="cab"><div className="cab-ceiling"><i></i><i></i></div><div className="cab-back"><span className="cab-seam"></span></div><div className="cab-floor"></div></div><div className="door door--left"><span></span></div><div className="door door--right"><span></span></div><div className="door-shadow"></div></div><div className="sill"></div></section>
    <aside className="call-panel" aria-label="エレベーター呼び出しパネル"><i className="panel-screw panel-screw--tl"></i><i className="panel-screw panel-screw--tr"></i><button className=${`call-button ${calls.up ? 'lit' : ''}`} onClick=${() => press('up')} aria-label="上りエレベーターを呼ぶ" aria-pressed=${calls.up}><span className="button-rim"><span className="button-face"><span className="button-arrow">▲</span></span></span></button><button className=${`call-button ${calls.down ? 'lit' : ''}`} onClick=${() => press('down')} aria-label="下りエレベーターを呼ぶ" aria-pressed=${calls.down}><span className="button-rim"><span className="button-face"><span className="button-arrow">▼</span></span></span></button><span className="panel-mark">ELEVATOR</span><i className="panel-screw panel-screw--bl"></i><i className="panel-screw panel-screw--br"></i></aside>
    <div className=${`building-notice ${notice ? 'show' : ''}`} role="status">${notice}</div><div className="wall wall--right"></div><div className="baseboard"></div><div className="floor"><div className="reflection"></div></div>
  </main>`;
}
createRoot(document.getElementById('root')).render(html`<${App} />`);
