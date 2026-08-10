export interface LapGate {
  readonly x: number;
  readonly y?: number;
  readonly z: number;
  readonly radiusM: number;
  readonly label: string;
}

export type LapTimerPhase = 'arming' | 'countdown' | 'running' | 'abandoned';

export type LapTimingHudVisibility = 'visible' | 'fading' | 'hidden';

export type LapCheckpointStatus = 'pending' | 'passed' | 'missed';

export interface LapRecord {
  readonly lapMs: number;
  readonly completedAtIso: string;
}

export interface LapTimingState {
  readonly phase: LapTimerPhase;
  readonly hudVisibility: LapTimingHudVisibility;
  readonly elapsedMs: number;
  readonly lapNumber: number;
  readonly completedLapCount: number;
  readonly laps: readonly number[];
  readonly lapRecords: readonly LapRecord[];
  readonly bestLapMs?: number;
  readonly bestLapRecordedAtIso?: string;
  readonly lastLapMs?: number;
  readonly lastLapCompletedAtIso?: string;
  readonly lapDeltaMs?: number;
  readonly checkpointIndex: number;
  readonly checkpointCount: number;
  readonly checkpointStatuses: readonly LapCheckpointStatus[];
  readonly sectorIndex: number;
  readonly sectorCount: number;
  readonly lastSectorMs?: number;
  readonly sectorDeltaMs?: number;
  readonly countdownLights: number;
  readonly countdownSeconds?: number;
  readonly startLights: 'off' | 'red' | 'green';
  readonly startZoneInside: boolean;
  readonly startProximity: number;
  readonly startReady: boolean;
  readonly message: string;
}

// A slightly deliberate start sequence: three clear beats before green.
const countdownBeatMs = 1_200;
const countdownDurationMs = countdownBeatMs * 3;
const greenLightDurationMs = 900;
const stationarySpeedKmh = 0.5;
const stationaryAbandonMs = 1_200;
const abandonedFadeDelayMs = 1_200;
const abandonedFadeDurationMs = 1_000;

interface StoredTiming {
  readonly bestLapMs?: number;
  readonly bestLapRecordedAtIso?: string;
  readonly bestSectorCumulativeMs?: readonly number[];
  readonly recentLaps?: readonly LapRecord[];
}

const readStoredTiming = (storageKey: string): StoredTiming => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as StoredTiming;
    const recentLaps = Array.isArray(parsed.recentLaps)
      ? parsed.recentLaps
        .filter((record): record is LapRecord => (
          typeof record === 'object'
          && record !== null
          && Number.isFinite(record.lapMs)
          && record.lapMs > 0
          && typeof record.completedAtIso === 'string'
          && Number.isFinite(Date.parse(record.completedAtIso))
        ))
        .slice(0, 20)
      : undefined;
    return {
      bestLapMs: Number.isFinite(parsed.bestLapMs) && parsed.bestLapMs! > 0
        ? parsed.bestLapMs
        : undefined,
      bestLapRecordedAtIso: (
        typeof parsed.bestLapRecordedAtIso === 'string'
        && Number.isFinite(Date.parse(parsed.bestLapRecordedAtIso))
      )
        ? parsed.bestLapRecordedAtIso
        : undefined,
      bestSectorCumulativeMs: Array.isArray(parsed.bestSectorCumulativeMs)
        ? parsed.bestSectorCumulativeMs.filter(value => Number.isFinite(value))
        : undefined,
      recentLaps,
    };
  } catch {
    return {};
  }
};

export class ApexLapTimer {
  private phase: LapTimerPhase = 'arming';
  private countdownStartedAt?: number;
  private startRequested = false;
  private startProximity = 0;
  private startReady = false;
  private startedAt = 0;
  private elapsedMs = 0;
  private checkpointIndex = 0;
  private checkpointInside = false;
  private missedCheckpoints = new Set<number>();
  private startInside = true;
  private laps: number[] = [];
  private lapRecords: LapRecord[] = [];
  private completedLapCount = 0;
  private lastLapMs?: number;
  private lastLapCompletedAtIso?: string;
  private lapDeltaMs?: number;
  private sectorIndex = 0;
  private sectorStartedAtMs = 0;
  private lastSectorMs?: number;
  private sectorDeltaMs?: number;
  private currentSectorCumulativeMs: number[] = [];
  private message = 'Fuera de carrera';
  private messageExpiresAt = 0;
  private sectorEndGateCounts: readonly number[];
  private start: LapGate;
  private finish: LapGate;
  private checkpoints: readonly LapGate[];
  private closed = true;
  private finishInside = false;
  private bestLapMs?: number;
  private bestLapRecordedAtIso?: string;
  private bestSectorCumulativeMs?: readonly number[];
  private stationaryStartedAt?: number;
  private abandonedAt?: number;
  private abandonedRestartArmed = false;

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
    this.bestLapRecordedAtIso = stored.bestLapRecordedAtIso;
    this.bestSectorCumulativeMs = stored.bestSectorCumulativeMs;
    this.lapRecords = stored.recentLaps ? [...stored.recentLaps] : [];
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
    this.countdownStartedAt = undefined;
    this.startRequested = false;
    this.startReady = false;
    this.startedAt = 0;
    this.elapsedMs = 0;
    this.checkpointIndex = 0;
    this.checkpointInside = false;
    this.missedCheckpoints.clear();
    this.startInside = true;
    this.finishInside = false;
    this.sectorIndex = 0;
    this.sectorStartedAtMs = 0;
    this.lastSectorMs = undefined;
    this.sectorDeltaMs = undefined;
    this.currentSectorCumulativeMs = [];
    this.stationaryStartedAt = undefined;
    this.abandonedAt = undefined;
    this.abandonedRestartArmed = false;
    this.message = '';
    this.messageExpiresAt = 0;
  }

  requestStart(): boolean {
    if (this.phase !== 'arming' || !this.startReady) return false;
    this.startRequested = true;
    return true;
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
    const checkpointInsides = this.checkpoints.map(gate => (
      this.isInside(position, gate)
    ));
    const startDistanceM = Math.hypot(
      position.x - this.start.x,
      position.z - this.start.z,
    );
    const startRevealRadiusM = Math.max(
      this.start.radiusM * 3,
      this.start.radiusM + 16,
    );
    this.startProximity = Math.max(
      0,
      Math.min(
        1,
        (startRevealRadiusM - startDistanceM)
          / (startRevealRadiusM - this.start.radiusM),
      ),
    );
    this.startReady = inStart && speedKmh <= stationarySpeedKmh;

    if (this.phase === 'arming') {
      if (this.startReady && this.startRequested) {
        this.phase = 'countdown';
        this.countdownStartedAt = now;
        this.message = '';
      } else {
        this.message = this.startReady ? 'ENTER · INICIAR VUELTA' : '';
      }
      this.startRequested = false;
    } else if (this.phase === 'countdown') {
      if (!inStart || speedKmh > 3) {
        this.phase = 'arming';
        this.countdownStartedAt = undefined;
        this.message = '';
      } else if (now >= this.countdownEndsAt()) {
        this.startRace(now);
      }
    } else if (this.phase === 'running') {
      this.elapsedMs = now - this.startedAt;
      this.updateStationaryState(speedKmh, now);
      this.markSkippedCheckpoints(checkpointInsides);
      if (
        this.phase === 'running'
        && nextGate
        && !this.checkpointInside
        && inCheckpoint
      ) {
        this.missedCheckpoints.delete(this.checkpointIndex);
        this.checkpointIndex += 1;
        this.captureSectorIfNeeded();
        this.message = 'Vuelta en curso';
      }
      if (
        this.phase === 'running'
        && this.closed
        && !this.startInside
        && inStart
        && this.checkpointIndex < this.checkpoints.length
      ) {
        for (
          let index = this.checkpointIndex;
          index < this.checkpoints.length;
          index += 1
        ) {
          this.missedCheckpoints.add(index);
        }
        this.message = 'Vuelta en curso';
      }
      if (
        this.phase === 'running'
        &&
        (this.closed ? !this.startInside && inStart : !this.finishInside && inFinish)
        && this.checkpointIndex === this.checkpoints.length
      ) {
        this.finishLap(now);
      } else if (
        this.phase === 'running'
        && now >= this.messageExpiresAt
        && this.messageExpiresAt > 0
      ) {
        this.messageExpiresAt = 0;
      }
    } else {
      if (!inStart) this.abandonedRestartArmed = true;
      if (
        this.abandonedRestartArmed
        && inStart
        && speedKmh <= 1.5
      ) {
        this.resetForStart();
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
    return (this.countdownStartedAt ?? 0) + countdownDurationMs;
  }

  private startRace(now: number): void {
    this.phase = 'running';
    this.startedAt = now;
    this.elapsedMs = 0;
    this.checkpointIndex = 0;
    this.checkpointInside = false;
    this.missedCheckpoints.clear();
    this.sectorIndex = 0;
    this.sectorStartedAtMs = 0;
    this.lastSectorMs = undefined;
    this.sectorDeltaMs = undefined;
    this.currentSectorCumulativeMs = [];
    this.stationaryStartedAt = undefined;
    this.abandonedAt = undefined;
    this.abandonedRestartArmed = false;
    this.message = this.closed ? 'Vuelta en curso' : 'Etapa en curso';
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
    const completedAtIso = new Date().toISOString();
    const previousBest = this.bestLapMs;
    this.currentSectorCumulativeMs.push(lapMs);
    this.lastSectorMs = lapMs - this.sectorStartedAtMs;
    const finalReference = this.bestSectorCumulativeMs?.[this.sectorIndex];
    this.sectorDeltaMs = finalReference === undefined ? undefined : lapMs - finalReference;
    this.lastLapMs = lapMs;
    this.lastLapCompletedAtIso = completedAtIso;
    this.lapDeltaMs = previousBest === undefined ? undefined : lapMs - previousBest;
    this.laps = [lapMs, ...this.laps].slice(0, 20);
    this.lapRecords = [
      Object.freeze({ lapMs, completedAtIso }),
      ...this.lapRecords,
    ].slice(0, 20);
    this.completedLapCount += 1;
    const isBest = previousBest === undefined || lapMs < previousBest;
    if (isBest) {
      this.bestLapMs = lapMs;
      this.bestLapRecordedAtIso = completedAtIso;
      this.bestSectorCumulativeMs = Object.freeze([...this.currentSectorCumulativeMs]);
    }
    this.persistTiming();
    this.startedAt = now;
    this.elapsedMs = 0;
    this.checkpointIndex = 0;
    this.checkpointInside = false;
    this.missedCheckpoints.clear();
    this.sectorIndex = 0;
    this.sectorStartedAtMs = 0;
    this.currentSectorCumulativeMs = [];
    this.stationaryStartedAt = undefined;
    this.abandonedAt = undefined;
    this.abandonedRestartArmed = false;
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
      ? countdownElapsed < countdownBeatMs
        ? 1
        : countdownElapsed < countdownBeatMs * 2 ? 3 : 5
      : 0;
    const countdownSeconds = this.phase === 'countdown'
      ? Math.max(1, Math.ceil((this.countdownEndsAt() - now) / countdownBeatMs))
      : undefined;
    const abandonedElapsedMs = this.phase === 'abandoned'
      ? now - (this.abandonedAt ?? now)
      : 0;
    const hudVisibility: LapTimingHudVisibility = this.phase !== 'abandoned'
      ? this.phase === 'running' ? 'visible' : 'hidden'
      : abandonedElapsedMs < abandonedFadeDelayMs
        ? 'visible'
        : abandonedElapsedMs < abandonedFadeDelayMs + abandonedFadeDurationMs
          ? 'fading'
          : 'hidden';
    return Object.freeze({
      phase: this.phase,
      hudVisibility,
      elapsedMs: this.elapsedMs,
      lapNumber: this.completedLapCount + 1,
      completedLapCount: this.completedLapCount,
      laps: Object.freeze([...this.laps]),
      lapRecords: Object.freeze([...this.lapRecords]),
      bestLapMs: this.bestLapMs,
      bestLapRecordedAtIso: this.bestLapRecordedAtIso,
      lastLapMs: this.lastLapMs,
      lastLapCompletedAtIso: this.lastLapCompletedAtIso,
      lapDeltaMs: this.lapDeltaMs,
      checkpointIndex: this.checkpointIndex,
      checkpointCount: this.checkpoints.length,
      checkpointStatuses: Object.freeze(this.checkpoints.map((_, index) => (
        index < this.checkpointIndex
          ? 'passed'
          : this.missedCheckpoints.has(index) ? 'missed' : 'pending'
      ))),
      sectorIndex: Math.min(this.sectorIndex, this.sectorEndGateCounts.length),
      sectorCount: this.sectorEndGateCounts.length + 1,
      lastSectorMs: this.lastSectorMs,
      sectorDeltaMs: this.sectorDeltaMs,
      countdownLights,
      countdownSeconds,
      startLights: this.phase === 'countdown'
        ? 'red'
        : (
          this.phase === 'running'
          && now - this.startedAt < greenLightDurationMs
        ) ? 'green' : 'off',
      startZoneInside: this.startInside,
      startProximity: this.startProximity,
      startReady: this.phase === 'arming' && this.startReady,
      message: this.message,
    });
  }

  private markSkippedCheckpoints(
    checkpointInsides: readonly boolean[],
  ): void {
    if (this.checkpointIndex >= this.checkpoints.length) return;
    const laterCheckpointIndex = checkpointInsides.findIndex(
      (inside, index) => inside && index > this.checkpointIndex,
    );
    if (laterCheckpointIndex < 0) return;
    for (
      let index = this.checkpointIndex;
      index < laterCheckpointIndex;
      index += 1
    ) {
      this.missedCheckpoints.add(index);
    }
    this.message = 'Vuelta en curso';
  }

  private updateStationaryState(speedKmh: number, now: number): void {
    if (speedKmh > stationarySpeedKmh) {
      this.stationaryStartedAt = undefined;
      return;
    }
    this.stationaryStartedAt ??= now;
    const stationaryElapsedMs = now - this.stationaryStartedAt;
    if (stationaryElapsedMs >= stationaryAbandonMs) {
      this.phase = 'abandoned';
      this.abandonedAt = now;
      this.abandonedRestartArmed = false;
      this.stationaryStartedAt = undefined;
      this.message = 'Carrera abandonada';
      this.messageExpiresAt = 0;
    }
  }

  private persistTiming(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        bestLapMs: this.bestLapMs,
        bestLapRecordedAtIso: this.bestLapRecordedAtIso,
        bestSectorCumulativeMs: this.bestSectorCumulativeMs,
        recentLaps: this.lapRecords,
      }));
    } catch {
      // El cronómetro sigue funcionando aunque el navegador bloquee storage.
    }
  }

  private format(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor(milliseconds % 60000 / 1000);
    const millis = Math.floor(milliseconds % 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }
}
