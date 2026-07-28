export interface LapGate {
  readonly x: number;
  readonly z: number;
  readonly radiusM: number;
  readonly label: string;
}

export type LapTimerPhase = 'arming' | 'countdown' | 'running';

export interface LapTimingState {
  readonly phase: LapTimerPhase;
  readonly elapsedMs: number;
  readonly lapNumber: number;
  readonly completedLapCount: number;
  readonly laps: readonly number[];
  readonly bestLapMs?: number;
  readonly lastLapMs?: number;
  readonly lapDeltaMs?: number;
  readonly checkpointIndex: number;
  readonly checkpointCount: number;
  readonly sectorIndex: number;
  readonly sectorCount: number;
  readonly lastSectorMs?: number;
  readonly sectorDeltaMs?: number;
  readonly countdownLights: number;
  readonly countdownSeconds?: number;
  readonly startLights: 'off' | 'red' | 'green';
  readonly message: string;
}

const armingHoldMs = 900;
const lightIntervalMs = 430;
const greenDelayMs = 520;

interface StoredTiming {
  readonly bestLapMs?: number;
  readonly bestSectorCumulativeMs?: readonly number[];
}

const readStoredTiming = (storageKey: string): StoredTiming => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as StoredTiming;
    return {
      bestLapMs: Number.isFinite(parsed.bestLapMs) && parsed.bestLapMs! > 0
        ? parsed.bestLapMs
        : undefined,
      bestSectorCumulativeMs: Array.isArray(parsed.bestSectorCumulativeMs)
        ? parsed.bestSectorCumulativeMs.filter(value => Number.isFinite(value))
        : undefined,
    };
  } catch {
    return {};
  }
};

export class ApexLapTimer {
  private phase: LapTimerPhase = 'arming';
  private armedAt?: number;
  private countdownStartedAt?: number;
  private startedAt = 0;
  private elapsedMs = 0;
  private checkpointIndex = 0;
  private checkpointInside = false;
  private startInside = true;
  private laps: number[] = [];
  private completedLapCount = 0;
  private lastLapMs?: number;
  private lapDeltaMs?: number;
  private sectorIndex = 0;
  private sectorStartedAtMs = 0;
  private lastSectorMs?: number;
  private sectorDeltaMs?: number;
  private currentSectorCumulativeMs: number[] = [];
  private message = 'Detenete sobre la línea para armar la salida';
  private messageExpiresAt = 0;
  private sectorEndGateCounts: readonly number[];
  private start: LapGate;
  private finish: LapGate;
  private checkpoints: readonly LapGate[];
  private closed = true;
  private finishInside = false;
  private bestLapMs?: number;
  private bestSectorCumulativeMs?: readonly number[];

  constructor(
    start: LapGate,
    checkpoints: readonly LapGate[],
    sectorCount = 3,
    private readonly storageKey = 'apex-run.v3.lap-timing.v1',
  ) {
    this.start = start;
    this.finish = start;
    this.checkpoints = checkpoints;
    const stored = readStoredTiming(this.storageKey);
    this.bestLapMs = stored.bestLapMs;
    this.bestSectorCumulativeMs = stored.bestSectorCumulativeMs;
    this.sectorEndGateCounts = Object.freeze(
      Array.from({ length: sectorCount - 1 }, (_, index) => (
        Math.max(1, Math.round(this.checkpoints.length * (index + 1) / sectorCount))
      )),
    );
  }

  configureTrack(
    start: LapGate,
    checkpoints: readonly LapGate[],
    sectorCount = 3,
    closed = true,
    finish: LapGate = start,
  ): void {
    this.start = start;
    this.finish = finish;
    this.checkpoints = checkpoints;
    this.closed = closed;
    this.sectorEndGateCounts = Object.freeze(
      Array.from({ length: Math.max(0, sectorCount - 1) }, (_, index) => (
        Math.max(
          1,
          Math.round(checkpoints.length * (index + 1) / sectorCount),
        )
      )),
    );
    this.resetForStart();
  }

  resetForStart(): void {
    this.phase = 'arming';
    this.armedAt = undefined;
    this.countdownStartedAt = undefined;
    this.startedAt = 0;
    this.elapsedMs = 0;
    this.checkpointIndex = 0;
    this.checkpointInside = false;
    this.startInside = true;
    this.finishInside = false;
    this.sectorIndex = 0;
    this.sectorStartedAtMs = 0;
    this.lastSectorMs = undefined;
    this.sectorDeltaMs = undefined;
    this.currentSectorCumulativeMs = [];
    this.message = 'Auto en grilla · armando salida';
    this.messageExpiresAt = 0;
  }

  update(
    position: Readonly<{ x: number; z: number }>,
    speedKmh: number,
    now: number,
  ): LapTimingState {
    const inStart = this.isInside(position, this.start);
    const inFinish = this.isInside(position, this.finish);
    const nextGate = this.checkpoints[this.checkpointIndex];
    const inCheckpoint = nextGate ? this.isInside(position, nextGate) : false;

    if (this.phase === 'arming') {
      if (inStart && speedKmh <= 1.5) {
        this.armedAt ??= now;
        const heldMs = now - this.armedAt;
        this.message = heldMs >= armingHoldMs * 0.55
          ? 'Salida armada · preparate'
          : 'Mantené el auto detenido sobre la línea';
        if (heldMs >= armingHoldMs) {
          this.phase = 'countdown';
          this.countdownStartedAt = now;
          this.message = 'Secuencia de largada';
        }
      } else {
        this.armedAt = undefined;
        this.message = inStart
          ? 'Detenete para iniciar la cuenta regresiva'
          : 'Volvé a la línea de salida';
      }
    } else if (this.phase === 'countdown') {
      if (!inStart || speedKmh > 3) {
        this.phase = 'arming';
        this.armedAt = undefined;
        this.countdownStartedAt = undefined;
        this.message = 'Salida anulada · movimiento anticipado';
        this.messageExpiresAt = now + 1800;
      } else if (now >= this.countdownEndsAt()) {
        this.startRace(now);
      }
    } else {
      this.elapsedMs = now - this.startedAt;
      if (nextGate && !this.checkpointInside && inCheckpoint) {
        this.checkpointIndex += 1;
        this.captureSectorIfNeeded();
        this.message = this.checkpointIndex === this.checkpoints.length
          ? this.closed
            ? 'Sectores validados · cerrá la vuelta'
            : 'Sectores validados · cruzá la llegada'
          : `Siguiente control · ${this.checkpoints[this.checkpointIndex].label}`;
      }
      if (
        (this.closed ? !this.startInside && inStart : !this.finishInside && inFinish)
        && this.checkpointIndex === this.checkpoints.length
      ) {
        this.finishLap(now);
      } else if (now >= this.messageExpiresAt && this.messageExpiresAt > 0) {
        this.messageExpiresAt = 0;
      }
    }

    this.startInside = inStart;
    this.finishInside = inFinish;
    this.checkpointInside = inCheckpoint;
    return this.snapshot(now);
  }

  private isInside(
    position: Readonly<{ x: number; z: number }>,
    gate: LapGate,
  ): boolean {
    return Math.hypot(position.x - gate.x, position.z - gate.z) <= gate.radiusM;
  }

  private countdownEndsAt(): number {
    return (this.countdownStartedAt ?? 0)
      + lightIntervalMs * 5
      + greenDelayMs;
  }

  private startRace(now: number): void {
    this.phase = 'running';
    this.startedAt = now;
    this.elapsedMs = 0;
    this.checkpointIndex = 0;
    this.checkpointInside = false;
    this.sectorIndex = 0;
    this.sectorStartedAtMs = 0;
    this.lastSectorMs = undefined;
    this.sectorDeltaMs = undefined;
    this.currentSectorCumulativeMs = [];
    this.message = this.closed
      ? `Vuelta 1 · ${this.checkpoints[0]?.label ?? 'pista libre'}`
      : `Etapa · ${this.checkpoints[0]?.label ?? 'hacia la llegada'}`;
    this.messageExpiresAt = 0;
  }

  private captureSectorIfNeeded(): void {
    if (!this.sectorEndGateCounts.includes(this.checkpointIndex)) return;
    const cumulativeMs = this.elapsedMs;
    const sectorMs = cumulativeMs - this.sectorStartedAtMs;
    this.currentSectorCumulativeMs.push(cumulativeMs);
    this.lastSectorMs = sectorMs;
    const reference = this.bestSectorCumulativeMs?.[this.sectorIndex];
    this.sectorDeltaMs = reference === undefined ? undefined : cumulativeMs - reference;
    this.sectorStartedAtMs = cumulativeMs;
    this.sectorIndex += 1;
  }

  private finishLap(now: number): void {
    const lapMs = now - this.startedAt;
    const previousBest = this.bestLapMs;
    this.currentSectorCumulativeMs.push(lapMs);
    this.lastSectorMs = lapMs - this.sectorStartedAtMs;
    const finalReference = this.bestSectorCumulativeMs?.[this.sectorIndex];
    this.sectorDeltaMs = finalReference === undefined ? undefined : lapMs - finalReference;
    this.lastLapMs = lapMs;
    this.lapDeltaMs = previousBest === undefined ? undefined : lapMs - previousBest;
    this.laps = [lapMs, ...this.laps].slice(0, 20);
    this.completedLapCount += 1;
    const isBest = previousBest === undefined || lapMs < previousBest;
    if (isBest) {
      this.bestLapMs = lapMs;
      this.bestSectorCumulativeMs = Object.freeze([...this.currentSectorCumulativeMs]);
      try {
        localStorage.setItem(this.storageKey, JSON.stringify({
          bestLapMs: this.bestLapMs,
          bestSectorCumulativeMs: this.bestSectorCumulativeMs,
        }));
      } catch {
        // El cronómetro sigue funcionando aunque el navegador bloquee storage.
      }
    }
    this.startedAt = now;
    this.elapsedMs = 0;
    this.checkpointIndex = 0;
    this.checkpointInside = false;
    this.sectorIndex = 0;
    this.sectorStartedAtMs = 0;
    this.currentSectorCumulativeMs = [];
    this.message = isBest
      ? `${this.closed ? 'MEJOR VUELTA' : 'MEJOR ETAPA'} · ${this.format(lapMs)}`
      : `${this.closed ? 'Vuelta' : 'Etapa'} registrada · ${this.format(lapMs)}`;
    this.messageExpiresAt = now + 3500;
  }

  private snapshot(now: number): LapTimingState {
    const countdownElapsed = this.phase === 'countdown'
      ? now - (this.countdownStartedAt ?? now)
      : 0;
    const countdownLights = this.phase === 'countdown'
      ? Math.min(5, Math.floor(countdownElapsed / lightIntervalMs) + 1)
      : 0;
    const countdownSeconds = this.phase === 'countdown'
      ? Math.max(1, Math.ceil((this.countdownEndsAt() - now) / 1000))
      : undefined;
    return Object.freeze({
      phase: this.phase,
      elapsedMs: this.elapsedMs,
      lapNumber: this.completedLapCount + 1,
      completedLapCount: this.completedLapCount,
      laps: Object.freeze([...this.laps]),
      bestLapMs: this.bestLapMs,
      lastLapMs: this.lastLapMs,
      lapDeltaMs: this.lapDeltaMs,
      checkpointIndex: this.checkpointIndex,
      checkpointCount: this.checkpoints.length,
      sectorIndex: Math.min(this.sectorIndex, this.sectorEndGateCounts.length),
      sectorCount: this.sectorEndGateCounts.length + 1,
      lastSectorMs: this.lastSectorMs,
      sectorDeltaMs: this.sectorDeltaMs,
      countdownLights,
      countdownSeconds,
      startLights: this.phase === 'countdown'
        ? 'red'
        : this.phase === 'running' ? 'green' : 'off',
      message: this.message,
    });
  }

  private format(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor(milliseconds % 60000 / 1000);
    const millis = Math.floor(milliseconds % 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }
}
