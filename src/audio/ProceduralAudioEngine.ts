type NoiseOptions = { at?: number; duration?: number; frequency?: number; gain?: number; pan?: number; type?: BiquadFilterType };

export class ProceduralAudioEngine {
  #context: AudioContext | null = null;
  #motorFilter: BiquadFilterNode | null = null;
  #motorGain: GainNode | null = null;
  #started = false;

  async unlock(): Promise<void> {
    const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    this.#context ??= new AudioCtor();
    await this.#context.resume();
    if (!this.#started) this.#startAmbience();
  }

  updateMotor(floor: number, hallFloor: number, moving: boolean): void {
    const context = this.#context;
    if (!context || !this.#motorFilter || !this.#motorGain) return;
    const proximity = Math.max(0, 1 - Math.abs(floor - hallFloor) / 10);
    this.#motorGain.gain.cancelScheduledValues(context.currentTime);
    this.#motorGain.gain.linearRampToValueAtTime(moving ? .0015 + proximity * .012 : .0001, context.currentTime + .65);
    this.#motorFilter.frequency.linearRampToValueAtTime(115 + proximity * 105, context.currentTime + .65);
  }

  chime(volume = .14, pan = 0, muffled = false): void {
    const context = this.#context; if (!context || context.state !== 'running') return;
    const now = context.currentTime, master = context.createGain(), filter = context.createBiquadFilter(), panner = context.createStereoPanner();
    panner.pan.value = pan; filter.type = 'lowpass'; filter.frequency.value = muffled ? 720 : 4200;
    master.gain.setValueAtTime(.0001, now); master.gain.exponentialRampToValueAtTime(volume, now + .02); master.gain.exponentialRampToValueAtTime(.0001, now + 1.55);
    master.connect(filter).connect(panner).connect(context.destination);
    [659.25, 987.77].forEach((frequency, index) => {
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.frequency.value = frequency; gain.gain.setValueAtTime(index ? .22 : .72, now); gain.gain.exponentialRampToValueAtTime(.001, now + (index ? .9 : 1.45));
      oscillator.connect(gain).connect(master); oscillator.start(now); oscillator.stop(now + 1.6);
    });
  }

  distantDoor(distance: number, pan: number): void {
    this.#noise({ duration: 1.3, frequency: 280, gain: Math.max(.006, .024 - distance * .0015), pan });
  }

  footsteps(pan = Math.random() > .5 ? .72 : -.72, count = 5): void {
    for (let i = 0; i < count; i += 1) this.#noise({ at: i * .48, duration: .13, frequency: 190 + i * 18, gain: .012 + i * .003, pan: pan * (1 - i / (count + 2)) });
  }

  cough(pan = Math.random() * 1.4 - .7): void {
    this.#noise({ duration: .28, frequency: 520, gain: .03, pan });
    this.#noise({ at: .31, duration: .21, frequency: 430, gain: .021, pan });
  }

  rustle(pan = Math.random() * 1.2 - .6): void {
    this.#noise({ duration: .65, frequency: 1250, gain: .012, pan, type: 'highpass' });
  }

  sensorBeep(): void { this.#tone(1760, .035, .11, 'sine'); }
  warningBeep(): void { this.#tone(740, .055, .13, 'square'); window.setTimeout(() => this.#tone(740, .055, .13, 'square'), 240); }
  mechanicalClunk(): void { this.#noise({ duration: .1, frequency: 115, gain: .04 }); this.#noise({ at: .09, duration: .07, frequency: 260, gain: .018, pan: .08 }); }

  #startAmbience(): void {
    const context = this.#context; if (!context) return; this.#started = true;
    const master = context.createGain(); master.gain.value = .7; master.connect(context.destination);
    const air = context.createBufferSource(), airFilter = context.createBiquadFilter(), airGain = context.createGain();
    air.buffer = this.#noiseBuffer(2); air.loop = true; airFilter.type = 'lowpass'; airFilter.frequency.value = 360; airGain.gain.value = .022;
    air.connect(airFilter).connect(airGain).connect(master); air.start();
    const hum = context.createOscillator(), humGain = context.createGain(); hum.type = 'sine'; hum.frequency.value = 100; humGain.gain.value = .0022; hum.connect(humGain).connect(master); hum.start();
    const motor = context.createBufferSource(); this.#motorFilter = context.createBiquadFilter(); this.#motorGain = context.createGain();
    motor.buffer = this.#noiseBuffer(2); motor.loop = true; this.#motorFilter.type = 'lowpass'; this.#motorFilter.frequency.value = 150; this.#motorGain.gain.value = .0001;
    motor.connect(this.#motorFilter).connect(this.#motorGain).connect(master); motor.start();
  }

  #noiseBuffer(seconds: number): AudioBuffer {
    const context = this.#context!; const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  #noise({ at = 0, duration = .18, frequency = 700, gain: level = .025, pan = 0, type = 'bandpass' }: NoiseOptions): void {
    const context = this.#context; if (!context || context.state !== 'running') return;
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain(), panner = context.createStereoPanner(), now = context.currentTime + at;
    source.buffer = this.#noiseBuffer(Math.max(duration, .25)); filter.type = type; filter.frequency.value = frequency; filter.Q.value = 1.1; panner.pan.value = pan;
    gain.gain.setValueAtTime(.0001, now); gain.gain.linearRampToValueAtTime(level, now + Math.min(.035, duration / 4)); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(filter).connect(gain).connect(panner).connect(context.destination); source.start(now); source.stop(now + duration + .02);
  }

  #tone(frequency: number, level: number, duration: number, type: OscillatorType): void {
    const context = this.#context; if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator(), gain = context.createGain(), now = context.currentTime;
    oscillator.type = type; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(level, now); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(context.destination); oscillator.start(now); oscillator.stop(now + duration + .01);
  }
}
