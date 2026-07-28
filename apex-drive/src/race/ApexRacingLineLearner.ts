export interface RacingLineVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RacingLineFrame {
  readonly center: RacingLineVector;
  readonly horizontalLateral: RacingLineVector;
  readonly surfaceLateral: RacingLineVector;
  readonly surfaceUp: RacingLineVector;
}

export interface RacingLinePoint extends RacingLineVector {
  readonly distanceM: number;
}

interface StoredRacingLine {
  readonly format: 'apex-drive-racing-line-offsets';
  readonly formatVersion: 1;
  readonly learnedLapCount: number;
  readonly offsetsM: readonly number[];
}

const STORAGE_FORMAT = 'apex-drive-racing-line-offsets';
const STORAGE_FORMAT_VERSION = 1;
const RECORDING_SPACING_M = 20;
const MINIMUM_LAP_COVERAGE = 0.55;
const SMOOTHING_PASSES = 4;
const SMOOTHING_RADIUS_M = 18;

export class ApexRacingLineLearner {
  private offsetsM: number[];
  private readonly offsetSums: Float64Array;
  private readonly offsetCounts: Uint16Array;
  private learnedLapCount = 0;
  private source: 'approximation' | 'learned' = 'approximation';
  private readonly trackLengthM: number;
  private lastRecordedDistanceM?: number;

  constructor(
    private readonly frames: readonly RacingLineFrame[],
    private readonly distancesM: readonly number[],
    private readonly maximumOffsetM: number,
    private readonly storageKey: string,
    initialOffsetsM?: readonly number[],
  ) {
    if (frames.length < 3 || frames.length !== distancesM.length) {
      throw new Error('La trazada necesita al menos tres frames con sus distancias');
    }
    this.offsetsM = initialOffsetsM?.length === frames.length
      ? initialOffsetsM.map(offsetM => Math.max(
        -maximumOffsetM,
        Math.min(maximumOffsetM, offsetM),
      ))
      : Array.from({ length: frames.length }, () => 0);
    this.offsetSums = new Float64Array(frames.length);
    this.offsetCounts = new Uint16Array(frames.length);
    const first = frames[0].center;
    const last = frames[frames.length - 1].center;
    this.trackLengthM = distancesM[distancesM.length - 1] + Math.hypot(
      first.x - last.x,
      first.y - last.y,
      first.z - last.z,
    );
    this.restore();
  }

  get lapCount(): number {
    return this.learnedLapCount;
  }

  get isApproximation(): boolean {
    return this.source === 'approximation';
  }

  beginLap(): void {
    this.offsetSums.fill(0);
    this.offsetCounts.fill(0);
    this.lastRecordedDistanceM = undefined;
  }

  record(position: RacingLineVector): void {
    let nearestIndex = 0;
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;
    for (let index = 0; index < this.frames.length; index += 1) {
      const center = this.frames[index].center;
      const deltaX = position.x - center.x;
      const deltaZ = position.z - center.z;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceSquared;
        nearestIndex = index;
      }
    }

    const distanceM = this.distancesM[nearestIndex];
    if (this.lastRecordedDistanceM !== undefined) {
      const rawDeltaM = distanceM - this.lastRecordedDistanceM;
      const forwardDeltaM = rawDeltaM >= 0
        ? rawDeltaM
        : -rawDeltaM > this.trackLengthM * 0.5
          ? distanceM + this.trackLengthM - this.lastRecordedDistanceM
          : -1;
      if (forwardDeltaM < RECORDING_SPACING_M) return;
    }
    this.lastRecordedDistanceM = distanceM;

    const frame = this.frames[nearestIndex];
    const deltaX = position.x - frame.center.x;
    const deltaZ = position.z - frame.center.z;
    const offsetM = (
      deltaX * frame.horizontalLateral.x
      + deltaZ * frame.horizontalLateral.z
    );
    this.offsetSums[nearestIndex] += Math.max(
      -this.maximumOffsetM,
      Math.min(this.maximumOffsetM, offsetM),
    );
    this.offsetCounts[nearestIndex] = Math.min(
      65_535,
      this.offsetCounts[nearestIndex] + 1,
    );
  }

  completeLap(): boolean {
    const coveredSamples = this.offsetCounts.reduce(
      (count, samples) => count + (samples > 0 ? 1 : 0),
      0,
    );
    const expectedSamples = Math.ceil(this.trackLengthM / RECORDING_SPACING_M);
    if (coveredSamples / expectedSamples < MINIMUM_LAP_COVERAGE) {
      this.beginLap();
      return false;
    }

    const recordedOffsets = Array.from(
      this.offsetCounts,
      (count, index) => count > 0 ? this.offsetSums[index] / count : Number.NaN,
    );
    this.fillMissingOffsets(recordedOffsets);
    this.offsetsM = this.smoothOffsets(recordedOffsets);
    this.learnedLapCount += 1;
    this.source = 'learned';
    this.persist();
    this.beginLap();
    return true;
  }

  points(): readonly RacingLinePoint[] {
    return Object.freeze(this.frames.map((frame, index) => {
      const offsetM = this.offsetsM[index];
      return Object.freeze({
        x: frame.center.x + frame.surfaceLateral.x * offsetM
          + frame.surfaceUp.x * 0.032,
        y: frame.center.y + frame.surfaceLateral.y * offsetM
          + frame.surfaceUp.y * 0.032,
        z: frame.center.z + frame.surfaceLateral.z * offsetM
          + frame.surfaceUp.z * 0.032,
        distanceM: this.distancesM[index],
      });
    }));
  }

  copyPayload(track: {
    readonly number: number;
    readonly id: string;
    readonly version: string;
  }): Readonly<Record<string, unknown>> {
    const allPoints = this.points();
    let lastDistanceM = Number.NEGATIVE_INFINITY;
    const controlPoints = allPoints.filter(point => {
      if (point.distanceM - lastDistanceM < RECORDING_SPACING_M) return false;
      lastDistanceM = point.distanceM;
      return true;
    });
    return Object.freeze({
      format: 'apex-drive-racing-line-points',
      formatVersion: 1,
      track: Object.freeze({ ...track }),
      source: this.source,
      learnedLapCount: this.learnedLapCount,
      sampleSpacingM: RECORDING_SPACING_M,
      interpolation: 'closed-catmull-rom',
      points: Object.freeze(controlPoints.map(point => Object.freeze({
        distanceM: Number(point.distanceM.toFixed(3)),
        x: Number(point.x.toFixed(3)),
        y: Number(point.y.toFixed(3)),
        z: Number(point.z.toFixed(3)),
      }))),
    });
  }

  private fillMissingOffsets(offsets: number[]): void {
    const available = offsets
      .map((offset, index) => Number.isFinite(offset) ? index : -1)
      .filter(index => index >= 0);
    if (available.length === 0) return;

    for (let controlIndex = 0; controlIndex < available.length; controlIndex += 1) {
      const start = available[controlIndex];
      const end = available[(controlIndex + 1) % available.length];
      const span = (end - start + offsets.length) % offsets.length;
      if (span <= 1) continue;

      const p0 = offsets[available[
        (controlIndex - 1 + available.length) % available.length
      ]];
      const p1 = offsets[start];
      const p2 = offsets[end];
      const p3 = offsets[available[(controlIndex + 2) % available.length]];

      for (let step = 1; step < span; step += 1) {
        const index = (start + step) % offsets.length;
        const t = step / span;
        if (available.length < 4) {
          offsets[index] = p1 * (1 - t) + p2 * t;
          continue;
        }
        const t2 = t * t;
        const t3 = t2 * t;
        offsets[index] = Math.max(
          -this.maximumOffsetM,
          Math.min(
            this.maximumOffsetM,
            0.5 * (
              2 * p1
              + (-p0 + p2) * t
              + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
            ),
          ),
        );
      }
    }
  }

  private smoothOffsets(source: readonly number[]): number[] {
    let smoothed = [...source];
    const averageFrameSpacingM = this.trackLengthM / this.frames.length;
    const radius = Math.max(
      2,
      Math.ceil(SMOOTHING_RADIUS_M / averageFrameSpacingM),
    );
    for (let pass = 0; pass < SMOOTHING_PASSES; pass += 1) {
      smoothed = smoothed.map((_, index, values) => {
        let weightedOffset = 0;
        let totalWeight = 0;
        for (let delta = -radius; delta <= radius; delta += 1) {
          const wrapped = (index + delta + values.length) % values.length;
          const weight = radius + 1 - Math.abs(delta);
          weightedOffset += values[wrapped] * weight;
          totalWeight += weight;
        }
        return Math.max(
          -this.maximumOffsetM,
          Math.min(this.maximumOffsetM, weightedOffset / totalWeight),
        );
      });
    }
    return smoothed;
  }

  private restore(): void {
    try {
      const stored = JSON.parse(
        localStorage.getItem(this.storageKey) ?? 'null',
      ) as Partial<StoredRacingLine> | null;
      if (
        stored?.format !== STORAGE_FORMAT
        || stored.formatVersion !== STORAGE_FORMAT_VERSION
        || !Array.isArray(stored.offsetsM)
        || stored.offsetsM.length !== this.frames.length
        || !stored.offsetsM.every(Number.isFinite)
      ) {
        return;
      }
      this.offsetsM = this.smoothOffsets(stored.offsetsM.map(offset => Math.max(
        -this.maximumOffsetM,
        Math.min(this.maximumOffsetM, offset),
      )));
      this.learnedLapCount = Number.isInteger(stored.learnedLapCount)
        ? Math.max(0, stored.learnedLapCount ?? 0)
        : 0;
      this.source = 'learned';
    } catch {
      // Una captura incompatible no impide usar la aproximación central.
    }
  }

  private persist(): void {
    const stored: StoredRacingLine = Object.freeze({
      format: STORAGE_FORMAT,
      formatVersion: STORAGE_FORMAT_VERSION,
      learnedLapCount: this.learnedLapCount,
      offsetsM: Object.freeze(this.offsetsM.map(offset => Number(offset.toFixed(4)))),
    });
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(stored));
    } catch {
      // La guía actual sigue disponible aunque el navegador bloquee storage.
    }
  }
}
