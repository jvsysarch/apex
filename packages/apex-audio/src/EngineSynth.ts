import { MathUtils } from 'three/webgpu';

export interface EngineSynthOptions {
  readonly sampleBaseUrl?: string;
}

/** Port directo del sistema de sonido usado por Apex Run v2. */
export class EngineSynth {
  private context?: AudioContext;
  private master?: GainNode;
  private sampleMaster?: GainNode;
  private filter?: BiquadFilterNode;
  private primary?: OscillatorNode;
  private harmonic?: OscillatorNode;
  private sub?: OscillatorNode;
  private primaryGain?: GainNode;
  private harmonicGain?: GainNode;
  private subGain?: GainNode;
  private skidGain?: GainNode;
  private tireScreechGain?: GainNode;
  private readonly sampleBuffers = new Map<string, AudioBuffer>();
  private readonly sampleSources: Array<{ source: AudioBufferSourceNode; gain: GainNode }> = [];
  private readonly sampleLoopGains: GainNode[] = [];
  private samplesLoading?: Promise<void>;
  private samplesReady = false;
  private lastThrottle = 0;
  private lastAccelerationSampleAt = Number.NEGATIVE_INFINITY;
  private radioCutUntil = Number.NEGATIVE_INFINITY;
  private muted = false;
  private volume = 0.18;

  constructor(
    private readonly onStatus: (message: string) => void,
    private readonly options: EngineSynthOptions = {},
  ) {}

  start(): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.sampleMaster = this.context.createGain();
      this.filter = this.context.createBiquadFilter();
      this.primary = this.context.createOscillator();
      this.harmonic = this.context.createOscillator();
      this.sub = this.context.createOscillator();
      this.primaryGain = this.context.createGain();
      this.harmonicGain = this.context.createGain();
      this.subGain = this.context.createGain();
      this.skidGain = this.context.createGain();
      this.primary.type = 'sawtooth';
      this.harmonic.type = 'triangle';
      this.sub.type = 'sine';
      this.master.gain.value = 0;
      this.sampleMaster.gain.value = this.muted ? 0.0001 : 1;
      this.filter.type = 'lowpass';
      this.filter.Q.value = 0.8;
      this.primaryGain.gain.value = 0.28;
      this.harmonicGain.gain.value = 0.11;
      this.subGain.gain.value = 0.34;
      this.primary.connect(this.primaryGain);
      this.primaryGain.connect(this.filter);
      this.harmonic.connect(this.harmonicGain);
      this.harmonicGain.connect(this.filter);
      this.sub.connect(this.subGain);
      this.subGain.connect(this.filter);
      this.filter.connect(this.master);
      this.master.connect(this.context.destination);
      this.sampleMaster.connect(this.context.destination);
      this.skidGain.gain.value = 0.0001;
      this.primary.start();
      this.harmonic.start();
      this.sub.start();
      if (this.options.sampleBaseUrl) {
        this.samplesLoading = this.loadSamples();
      }
    }
    void this.context.resume().then(() => {
      this.onStatus(
        this.muted
          ? 'Audio: en espera.'
          : this.samplesReady
            ? 'Audio: muestras de motor cargadas.'
            : 'Audio: activo · motor sintetizado.',
      );
    }).catch(() => {
      this.onStatus('Audio bloqueado por el navegador: hacé clic dentro de la escena.');
    });
  }

  setVolume(value: number): void {
    this.volume = value;
  }

  silence(): void {
    this.muted = true;
    this.onStatus('Audio: en espera.');
    if (!this.context) return;
    const now = this.context.currentTime;
    [this.master, this.sampleMaster, this.skidGain, this.tireScreechGain].forEach(node => {
      if (!node) return;
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(0.0001, now);
    });
  }

  resume(): void {
    this.muted = false;
    this.onStatus(
      this.samplesReady
        ? 'Audio: muestras de motor cargadas.'
        : 'Audio: activo · motor sintetizado.',
    );
  }

  updateTireSkid(_rearSlip: number, _speedMps: number, _drivetrainStable: boolean): void {
    // v2 conserva la telemetría de slip, pero mantiene este canal silenciado.
    if (!this.context || !this.skidGain) return;
    const now = this.context.currentTime;
    this.skidGain.gain.setValueAtTime(0.0001, now);
    this.tireScreechGain?.gain.setValueAtTime(0.0001, now);
  }

  update(rpm: number, throttle: number, shifting: boolean, maxRpm: number): void {
    if (
      !this.context
      || !this.master
      || !this.filter
      || !this.primary
      || !this.harmonic
      || !this.sub
    ) return;
    const now = this.context.currentTime;
    if (this.muted) {
      this.master.gain.setValueAtTime(0.0001, now);
      this.sampleMaster?.gain.setValueAtTime(0.0001, now);
      this.skidGain?.gain.setValueAtTime(0.0001, now);
      return;
    }
    if (this.samplesReady && this.sampleMaster) {
      const rpmFraction = MathUtils.clamp(rpm / Math.max(1, maxRpm), 0, 1);
      const playbackRate = MathUtils.clamp(0.72 + rpmFraction * 1.25, 0.65, 2.05);
      this.sampleSources.forEach(({ source }) => {
        source.playbackRate.setTargetAtTime(playbackRate, now, 0.045);
      });
      this.sampleLoopGains[0]?.gain.setTargetAtTime(
        (0.16 + throttle * 0.34 + rpmFraction * 0.16) * this.volume,
        now,
        0.045,
      );
      this.sampleLoopGains[1]?.gain.setTargetAtTime(
        (0.045 + throttle * 0.13 + rpmFraction * 0.1) * this.volume,
        now,
        0.06,
      );
      this.sampleMaster.gain.setTargetAtTime(
        now < this.radioCutUntil ? 0.0001 : shifting ? 0.72 : 0.82,
        now,
        0.025,
      );
      if (
        throttle > 0.58
        && this.lastThrottle < 0.28
        && now - this.lastAccelerationSampleAt > 0.65
      ) {
        const acceleration = this.sampleBuffers.get(
          rpmFraction > 0.55 ? 'Car_Acceleration_2.ogg' : 'Car_Acceleration.ogg',
        );
        if (acceleration) {
          this.playSample(acceleration, 0.22, playbackRate);
          this.lastAccelerationSampleAt = now;
        }
      }
      this.lastThrottle = throttle;
      this.master.gain.setTargetAtTime(0.0001, now, 0.08);
      return;
    }

    const firingHz = MathUtils.clamp(rpm / 60, 22, 120);
    this.primary.frequency.setTargetAtTime(firingHz, now, 0.025);
    this.harmonic.frequency.setTargetAtTime(firingHz * 2.01, now, 0.03);
    this.sub.frequency.setTargetAtTime(Math.max(22, firingHz * 0.5), now, 0.04);
    this.filter.frequency.setTargetAtTime(
      150 + throttle * 900 + rpm / 7000 * 780,
      now,
      0.045,
    );
    const shiftCut = shifting ? 0.55 : 1;
    const level = (
      0.075 + throttle * 0.32 + rpm / 7000 * 0.08
    ) * this.volume * shiftCut;
    this.master.gain.setTargetAtTime(level, now, shifting ? 0.012 : 0.035);
  }

  private async loadSamples(): Promise<void> {
    if (!this.context || this.samplesLoading && this.samplesLoading !== Promise.resolve()) return;
    const sampleBaseUrl = this.options.sampleBaseUrl;
    if (!sampleBaseUrl) return;
    const normalizedBaseUrl = `${sampleBaseUrl.replace(/\/+$/, '')}/`;
    const files = [
      'Car_Engine_Loop.ogg',
      'Car_Engine_Loop_2.ogg',
      'Car_Acceleration.ogg',
      'Car_Acceleration_2.ogg',
      'Car_Engine_Start_Up.ogg',
    ];
    try {
      await Promise.all(files.map(async file => {
        const response = await fetch(`${normalizedBaseUrl}${file}`);
        if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
        const data = await response.arrayBuffer();
        this.sampleBuffers.set(file, await this.context!.decodeAudioData(data));
      }));
      this.startEngineLoops();
      this.samplesReady = true;
      this.onStatus(
        this.muted
          ? 'Audio: en espera.'
          : 'Audio: muestras de motor cargadas.',
      );
    } catch (error) {
      console.warn(
        'No se pudieron cargar las muestras del motor; se mantiene el sintetizador.',
        error,
      );
      this.onStatus(
        this.muted
          ? 'Audio: en espera.'
          : 'Audio: motor sintetizado · muestras no disponibles.',
      );
    }
  }

  private startEngineLoops(): void {
    if (!this.context || !this.sampleMaster || this.sampleSources.length) return;
    ['Car_Engine_Loop.ogg', 'Car_Engine_Loop_2.ogg'].forEach((file, index) => {
      const buffer = this.sampleBuffers.get(file);
      if (!buffer) return;
      const source = this.context!.createBufferSource();
      const gain = this.context!.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      gain.connect(this.sampleMaster!);
      gain.gain.value = 0.0001;
      source.start();
      this.sampleSources.push({ source, gain });
      this.sampleLoopGains[index] = gain;
    });
    const startup = this.sampleBuffers.get('Car_Engine_Start_Up.ogg');
    if (startup && !this.muted) this.playSample(startup, 0.32, 1);
  }

  private playSample(buffer: AudioBuffer, level: number, playbackRate: number): void {
    if (!this.context || !this.sampleMaster) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    gain.gain.value = Math.max(0.0001, level * this.volume);
    source.connect(gain);
    gain.connect(this.sampleMaster);
    source.addEventListener('ended', () => {
      source.disconnect();
      gain.disconnect();
    });
    source.start();
  }
}
