(() => {
  'use strict';

  const CURRENT_FLOOR = 12;
  const floorDisplay = document.getElementById('floorDisplay');
  const directionDisplay = document.getElementById('directionDisplay');
  const callButton = document.getElementById('callButton');
  const doorFrame = document.getElementById('doorFrame');
  const soundHint = document.getElementById('soundHint');

  let floor = randomFloor();
  let state = 'idle';
  let audioContext = null;
  let runToken = 0;

  function randomFloor() {
    const options = Array.from({ length: 19 }, (_, index) => index + 1)
      .filter(value => value !== CURRENT_FLOOR);
    return options[Math.floor(Math.random() * options.length)];
  }

  function delay(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  function renderFloor(value) {
    floorDisplay.textContent = value === 0 ? 'B1' : String(value);
    floorDisplay.classList.remove('changing');
    void floorDisplay.offsetWidth;
    floorDisplay.classList.add('changing');
  }

  function setDirection(targetFloor, active = true) {
    directionDisplay.textContent = targetFloor > floor ? '▲' : '▼';
    directionDisplay.classList.toggle('idle', !active);
  }

  function unlockAudio() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioContext = new AudioCtx();
    }
    if (audioContext?.state === 'suspended') audioContext.resume();
  }

  function playChime() {
    if (!audioContext || audioContext.state !== 'running') {
      soundHint.classList.add('show');
      window.setTimeout(() => soundHint.classList.remove('show'), 2200);
      return;
    }

    const now = audioContext.currentTime;
    const master = audioContext.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.16, now + 0.018);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.65);
    master.connect(audioContext.destination);

    [659.25, 987.77].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(index === 0 ? 0.75 : 0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (index === 0 ? 1.5 : 1.0));
      oscillator.connect(gain).connect(master);
      oscillator.start(now);
      oscillator.stop(now + 1.7);
    });
  }

  async function travel(token) {
    state = 'moving';
    callButton.classList.add('lit');
    callButton.setAttribute('aria-pressed', 'true');
    callButton.disabled = true;
    setDirection(CURRENT_FLOOR, true);

    while (floor !== CURRENT_FLOOR && token === runToken) {
      const distance = Math.abs(CURRENT_FLOOR - floor);
      const pauseChance = distance > 2 ? 0.18 : 0;
      await delay(850 + Math.random() * 620);

      if (Math.random() < pauseChance) {
        directionDisplay.classList.add('idle');
        await delay(1400 + Math.random() * 2400);
        directionDisplay.classList.remove('idle');
      }

      floor += floor < CURRENT_FLOOR ? 1 : -1;
      renderFloor(floor);
    }

    if (token !== runToken) return;
    state = 'arrived';
    directionDisplay.classList.add('idle');
    await delay(620);
    playChime();
    await delay(760);
    doorFrame.classList.add('open');
    await delay(4300 + Math.random() * 1400);
    doorFrame.classList.remove('open');
    await delay(1850);

    if (token !== runToken) return;
    callButton.classList.remove('lit');
    callButton.setAttribute('aria-pressed', 'false');
    callButton.disabled = false;
    state = 'idle';

    await delay(900 + Math.random() * 1800);
    if (state === 'idle' && token === runToken) depart(token);
  }

  async function depart(token) {
    const target = randomFloor();
    setDirection(target, true);
    await delay(850);
    while (floor !== target && state === 'idle' && token === runToken) {
      await delay(700 + Math.random() * 650);
      floor += floor < target ? 1 : -1;
      renderFloor(floor);
    }
    if (state === 'idle' && token === runToken) directionDisplay.classList.add('idle');
  }

  callButton.addEventListener('click', () => {
    unlockAudio();
    if (state !== 'idle') return;
    runToken += 1;
    travel(runToken);
  });

  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });
  renderFloor(floor);
  setDirection(CURRENT_FLOOR, false);
})();
