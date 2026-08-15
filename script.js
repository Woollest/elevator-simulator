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
  const [noticeLevel, setNoticeLevel] = useState('');
  const [displayTick, setDisplayTick] = useState(0);
  const callsRef = useRef(calls), floorRef = useRef(floor), directionRef = useRef(direction);
  const runningRef = useRef(false), aliveRef = useRef(true), npcLoopRef = useRef(false), pressesRef = useRef([]), audioRef = useRef(null), audioGraphRef = useRef(null), noticeTimerRef = useRef(null);
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
    const motorNoise = context.createBufferSource(), motorFilter = context.createBiquadFilter(), motorGain = context.createGain();
    motorNoise.buffer = noiseBuffer(context); motorNoise.loop = true; motorFilter.type = 'lowpass'; motorFilter.frequency.value = 150; motorFilter.Q.value = 1.2; motorGain.gain.value = .0001;
    motorNoise.connect(motorFilter).connect(motorGain).connect(master); motorNoise.start();
    audioGraphRef.current = { motorFilter, motorGain };
    updateMotorSound(floorRef.current, true);
    startNpcPresence();
  }
  function updateMotorSound(currentFloor, isMoving) {
    const context = audioRef.current, graph = audioGraphRef.current; if (!context || !graph) return;
    const proximity = Math.max(0, 1 - Math.abs(currentFloor - HALL_FLOOR) / 10);
    graph.motorGain.gain.cancelScheduledValues(context.currentTime);
    graph.motorGain.gain.linearRampToValueAtTime(isMoving ? .0015 + proximity * .012 : .0001, context.currentTime + .65);
    graph.motorFilter.frequency.linearRampToValueAtTime(115 + proximity * 105, context.currentTime + .65);
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
  function noiseEvent({ at = 0, duration = .18, frequency = 700, gainValue = .025, pan = 0, type = 'bandpass' } = {}) {
    const context = audioRef.current; if (!context || context.state !== 'running') return;
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain(), panner = context.createStereoPanner(), now = context.currentTime + at;
    source.buffer = noiseBuffer(context, Math.max(duration, .25)); filter.type = type; filter.frequency.value = frequency; filter.Q.value = 1.1; panner.pan.value = pan;
    gain.gain.setValueAtTime(.0001, now); gain.gain.linearRampToValueAtTime(gainValue, now + Math.min(.035, duration / 4)); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(filter).connect(gain).connect(panner).connect(context.destination); source.start(now); source.stop(now + duration + .02);
  }
  function footsteps(pan = Math.random() > .5 ? .72 : -.72, count = 5) {
    for (let i = 0; i < count; i += 1) noiseEvent({ at: i * .48, duration: .13, frequency: 190 + i * 18, gainValue: .012 + i * .003, pan: pan * (1 - i / (count + 2)) });
  }
  function cough(pan = Math.random() * 1.4 - .7) {
    noiseEvent({ duration: .28, frequency: 520, gainValue: .03, pan });
    noiseEvent({ at: .31, duration: .21, frequency: 430, gainValue: .021, pan });
  }
  function clothRustle(pan = Math.random() * 1.2 - .6) {
    noiseEvent({ duration: .65, frequency: 1250, gainValue: .012, pan, type: 'highpass' });
  }
  function sensorBeep() {
    const context = audioRef.current; if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator(), gain = context.createGain(), now = context.currentTime;
    oscillator.type = 'sine'; oscillator.frequency.value = 1760; gain.gain.setValueAtTime(.035, now); gain.gain.exponentialRampToValueAtTime(.0001, now + .11);
    oscillator.connect(gain).connect(context.destination); oscillator.start(now); oscillator.stop(now + .12);
  }
  function mechanicalClunk() {
    noiseEvent({ duration: .1, frequency: 115, gainValue: .04, pan: 0 });
    noiseEvent({ at: .09, duration: .07, frequency: 260, gainValue: .018, pan: .08 });
  }
  function registerCall(name) {
    if (callsRef.current[name]) return;
    const nextCalls = { ...callsRef.current, [name]: true }; callsRef.current = nextCalls; setCalls(nextCalls);
  }
  async function startNpcPresence() {
    if (npcLoopRef.current) return; npcLoopRef.current = true;
    while (aliveRef.current) {
      await sleep(9000 + Math.random() * 15000);
      if (!aliveRef.current) break;
      const event = Math.random();
      if (event < .46) {
        const side = Math.random() > .5 ? .75 : -.75; footsteps(side, 5 + Math.floor(Math.random() * 3));
        await sleep(2100 + Math.random() * 900); clothRustle(side * .35);
        registerCall(Math.random() > .5 ? 'up' : 'down');
      } else if (event < .72) cough();
      else clothRustle();
    }
  }
  function warningBeep() {
    const context = audioRef.current; if (!context || context.state !== 'running') return;
    [0, .24].forEach(offset => { const oscillator = context.createOscillator(), gain = context.createGain(), at = context.currentTime + offset; oscillator.type = 'square'; oscillator.frequency.value = 740; gain.gain.setValueAtTime(.055, at); gain.gain.exponentialRampToValueAtTime(.0001, at + .13); oscillator.connect(gain).connect(context.destination); oscillator.start(at); oscillator.stop(at + .14); });
  }
  function showNotice(text, level = 'notice') {
    clearTimeout(noticeTimerRef.current); setNotice(text); setNoticeLevel(level);
    noticeTimerRef.current = setTimeout(() => { setNotice(''); setNoticeLevel(''); }, level === 'alarm' ? 4600 : 3200);
  }
  function press(name) {
    unlockAudio();
    const now = Date.now(); pressesRef.current = [...pressesRef.current.filter(time => now - time < 2200), now];
    if (pressesRef.current.length >= 12) {
      showNotice('設備保護のため、操作を中止してください。', 'alarm'); warningBeep();
    } else if (pressesRef.current.length >= 8) {
      showNotice('呼出ボタンを連打しないでください。', 'alarm'); warningBeep();
    } else if (pressesRef.current.length >= 5) {
      showNotice('呼び出しは、すでに登録されています。', 'warning');
    }
    if (!callsRef.current[name]) {
      registerCall(name);
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
          await sleep(3200);
          if (Math.random() < .32) { footsteps(Math.random() > .5 ? .55 : -.55, 4); await sleep(1800 + Math.random() * 1800); }
          setDoorsOpen(false);
          if (Math.random() < .3) {
            await sleep(780 + Math.random() * 260); sensorBeep(); setDoorsOpen(true);
            await sleep(1800); clothRustle(); await sleep(1800 + Math.random() * 2200); setDoorsOpen(false);
          }
          await sleep(1800); mechanicalClunk();
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
        const crowded = Math.random() < .28;
        if (crowded) { clothRustle(side); await sleep(1700); distantDoorSound(distance, -side); }
        await sleep(crowded ? 6500 + Math.random() * 4500 : 2700 + Math.random() * 3000);
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
    <div className=${`building-notice ${notice ? 'show' : ''} ${noticeLevel}`} role="alert"><small>${noticeLevel === 'alarm' ? 'WARNING' : 'BUILDING INFORMATION'}</small><strong>${notice}</strong></div><div className="wall wall--right"></div><div className="baseboard"></div><div className="floor"><div className="reflection"></div></div>
  </main>`;
}
createRoot(document.getElementById('root')).render(html`<${App} />`);
