import { useCallback, useEffect, useRef, useState } from 'react';
import { ProceduralAudioEngine } from '../audio/ProceduralAudioEngine';
import { callForDirection, SIMULATION, type Calls, type Direction, type HallCall } from '../domain/elevator';
import { ControlCore } from '../infrastructure/controlCore';

const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));
const randomFloor = () => {
  const choices = Array.from({ length: SIMULATION.maxFloor }, (_, i) => i + 1).filter(value => value !== SIMULATION.hallFloor);
  return choices[Math.floor(Math.random() * choices.length)]!;
};

export function useElevatorSimulation() {
  const [floor, setFloor] = useState(randomFloor);
  const [direction, setDirection] = useState<Direction>(Math.random() > .5 ? 1 : -1);
  const [moving, setMoving] = useState(false), [doorsOpen, setDoorsOpen] = useState(false);
  const [calls, setCalls] = useState<Calls>({ up: false, down: false });
  const [notice, setNotice] = useState(''), [noticeLevel, setNoticeLevel] = useState('');
  const [displayTick, setDisplayTick] = useState(0);
  const callsRef = useRef(calls), floorRef = useRef(floor), directionRef = useRef(direction), alive = useRef(true), running = useRef(false), npcRunning = useRef(false), presses = useRef<number[]>([]);
  const audio = useRef(new ProceduralAudioEngine()), control = useRef(new ControlCore()), noticeTimer = useRef(0);

  useEffect(() => { callsRef.current = calls; }, [calls]);
  useEffect(() => { floorRef.current = floor; audio.current.updateMotor(floor, SIMULATION.hallFloor, moving); }, [floor, moving]);
  useEffect(() => { directionRef.current = direction; }, [direction]);

  const registerCall = useCallback((name: HallCall) => {
    if (callsRef.current[name]) return;
    const next = { ...callsRef.current, [name]: true }; callsRef.current = next; setCalls(next);
  }, []);

  const showNotice = useCallback((text: string, level = 'notice') => {
    window.clearTimeout(noticeTimer.current); setNotice(text); setNoticeLevel(level);
    noticeTimer.current = window.setTimeout(() => { setNotice(''); setNoticeLevel(''); }, level === 'alarm' ? 4600 : 3200);
  }, []);

  const npcLoop = useCallback(async () => {
    if (npcRunning.current) return; npcRunning.current = true;
    while (alive.current) {
      await sleep(9000 + Math.random() * 15000); if (!alive.current) break;
      const event = Math.random();
      if (event < .46) { const side = Math.random() > .5 ? .75 : -.75; audio.current.footsteps(side, 5 + Math.floor(Math.random() * 3)); await sleep(2100 + Math.random() * 900); audio.current.rustle(side * .35); registerCall(Math.random() > .5 ? 'up' : 'down'); }
      else if (event < .72) audio.current.cough(); else audio.current.rustle();
    }
  }, [registerCall]);

  const press = useCallback(async (name: HallCall) => {
    await audio.current.unlock(); void npcLoop();
    const now = Date.now(); presses.current = [...presses.current.filter(time => now - time < 2200), now];
    if (presses.current.length >= 12) { showNotice('設備保護のため、操作を中止してください。', 'alarm'); audio.current.warningBeep(); }
    else if (presses.current.length >= 8) { showNotice('呼出ボタンを連打しないでください。', 'alarm'); audio.current.warningBeep(); }
    else if (presses.current.length >= 5) showNotice('呼び出しは、すでに登録されています。', 'warning');
    registerCall(name);
  }, [npcLoop, registerCall, showNotice]);

  useEffect(() => {
    void control.current.initialize(new URL(`${import.meta.env.BASE_URL}elevator_core.wasm`, window.location.origin));
    const run = async () => {
      if (running.current) return; running.current = true; setMoving(true);
      let target = directionRef.current > 0 ? SIMULATION.maxFloor : SIMULATION.minFloor;
      while (alive.current) {
        await sleep(SIMULATION.travelMs.minimum + Math.random() * SIMULATION.travelMs.variance);
        const next = floorRef.current + directionRef.current;
        if (next > SIMULATION.maxFloor || next < SIMULATION.minFloor) { directionRef.current = (directionRef.current * -1) as Direction; setDirection(directionRef.current); target = directionRef.current > 0 ? SIMULATION.maxFloor : SIMULATION.minFloor; await sleep(1100); continue; }
        floorRef.current = next; setFloor(next); setDisplayTick(value => value + 1);
        if (next === SIMULATION.hallFloor && control.current.shouldStop(directionRef.current, callsRef.current)) {
          setMoving(false); await sleep(600); audio.current.chime(); await sleep(720); setDoorsOpen(true);
          const served = callForDirection(directionRef.current), remaining = { ...callsRef.current, [served]: false }; callsRef.current = remaining; setCalls(remaining);
          await sleep(3200); if (Math.random() < .32) { audio.current.footsteps(Math.random() > .5 ? .55 : -.55, 4); await sleep(1800 + Math.random() * 1800); }
          setDoorsOpen(false); if (Math.random() < .3) { await sleep(780 + Math.random() * 260); audio.current.sensorBeep(); setDoorsOpen(true); await sleep(1800); audio.current.rustle(); await sleep(1800 + Math.random() * 2200); setDoorsOpen(false); }
          await sleep(1800); audio.current.mechanicalClunk(); setMoving(true);
        } else if (next === SIMULATION.hallFloor) await sleep(650);
        if (next === target) { await sleep(1300 + Math.random() * 1200); directionRef.current = (directionRef.current * -1) as Direction; setDirection(directionRef.current); target = directionRef.current > 0 ? SIMULATION.maxFloor : SIMULATION.minFloor; }
        else if (Math.random() < SIMULATION.intermediateStopProbability && Math.abs(next - SIMULATION.hallFloor) > 1) {
          setMoving(false); const distance = Math.abs(next - SIMULATION.hallFloor), side = directionRef.current > 0 ? .48 : -.48; audio.current.chime(Math.max(.012, .052 - distance * .003), side, true); await sleep(520); audio.current.distantDoor(distance, side);
          const crowded = Math.random() < SIMULATION.crowdedStopProbability; if (crowded) { audio.current.rustle(side); await sleep(1700); audio.current.distantDoor(distance, -side); }
          await sleep(crowded ? 6500 + Math.random() * 4500 : 2700 + Math.random() * 3000); setMoving(true);
        }
      }
    };
    void run(); return () => { alive.current = false; window.clearTimeout(noticeTimer.current); };
  }, []);

  return { floor, direction, moving, doorsOpen, calls, notice, noticeLevel, displayTick, press };
}
