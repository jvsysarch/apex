import type {
  ApexVehicleState,
} from '@jvsysarch/apex-physics';

const FORMAT = 'apex-drive-autonomous-track-memory';
const FORMAT_VERSION = 7;
const BIN_LENGTH_M = 10;
const MACRO_SEGMENT_COUNT = 10;
const MINIMUM_SEGMENT_IMPROVEMENT_MS = 12;
const LOCAL_SEGMENT_IMPROVEMENT_MS = 2;
const MAXIMUM_LOCAL_RETRIES = 6;

interface StoredBin {
  speedLimitKmh: number;
  minimumCleanSpeedKmh: number;
  bestCleanSpeedKmh: number;
  driverValidatedSpeedKmh: number;
  driverValidationCount: number;
  cleanPasses: number;
  incidentCount: number;
  lineOffsetM: number;
  cautionLevel: number;
  stagnantPasses: number;
  optimizationLocked: boolean;
  probeDirection: -1 | 1;
  probeAmplitudeM: number;
  baselineTimeMs: number;
  bestTimeMs: number;
  baselineEntrySpeedKmh: number;
  baselineExitSpeedKmh: number;
  localAttempts: number;
  localImprovements: number;
}

interface StoredMemory {
  format: typeof FORMAT;
  formatVersion: typeof FORMAT_VERSION;
  binLengthM: typeof BIN_LENGTH_M;
  completedLaps: number;
  bestLapMs?: number;
  lastLapMs?: number;
  lastLapImproved: boolean;
  baselineReady: boolean;
  baselineLapMs?: number;
  bestSegmentTimesMs: number[];
  bins: StoredBin[];
}

interface LapBin {
  visited: boolean;
  incident: boolean;
  speedRestricted: boolean;
  driverDemonstration: boolean;
  incidentSeverity: number;
  minimumCleanSpeedKmh: number;
  maximumCleanSpeedKmh: number;
  maximumDriverSpeedKmh: number;
  incidentSpeedLimitKmh: number;
  lineOffsetAdjustmentM: number;
  elapsedS: number;
  entrySpeedKmh: number;
  exitSpeedKmh: number;
}

export interface ApexAutonomousSegmentRetry {
  readonly binIndex: number;
  readonly attempt: number;
  readonly actualTimeMs: number;
  readonly targetTimeMs: number;
}

export type ApexAutonomousZoneClassification =
  | 'learning'
  | 'recovery'
  | 'probing'
  | 'validated'
  | 'optimal'
  | 'fast';

export interface ApexAutonomousLearningGuidance {
  readonly recognitionLap: boolean;
  readonly completedLaps: number;
  readonly powerLimit: number;
  readonly nextLapPowerLimit: number;
  readonly steeringLimit: number;
  readonly speedLimitKmh: number;
  readonly cleanPasses: number;
  readonly incidentCount: number;
  readonly totalIncidentCount: number;
  readonly minimumCleanSpeedKmh: number;
  readonly bestCleanSpeedKmh: number;
  readonly driverValidatedSpeedKmh: number;
  readonly driverValidationCount: number;
  readonly nextTrialSpeedKmh: number;
  readonly improvementPotentialKmh: number;
  readonly estimatedZoneGainMs: number;
  readonly optimizationLocked: boolean;
  readonly stagnantPasses: number;
  readonly zoneClassification: ApexAutonomousZoneClassification;
  readonly lineOffsetM: number;
  readonly zoneIndex: number;
  readonly zoneCount: number;
  readonly trackDistanceM: number;
  readonly trackProgress: number;
  readonly lapCoverage: number;
  readonly fastZoneCount: number;
  readonly brakingZoneCount: number;
  readonly cautionLevel: number;
  readonly upcomingCautionDistanceM?: number;
  readonly bestLapMs?: number;
  readonly baselineReady: boolean;
  readonly baselineLapMs?: number;
  readonly baselineCaptureActive: boolean;
  readonly segmentBestTimeMs?: number;
  readonly segmentBaselineTimeMs?: number;
  readonly segmentRetryAttempt: number;
}

export interface ApexAutonomousIncident {
  readonly type:
    | 'off-track'
    | 'rough-surface'
    | 'far-from-line'
    | 'drift'
    | 'airborne'
    | 'impact';
  readonly binIndex: number;
  readonly side: -1 | 0 | 1;
  readonly severity: number;
}

const emptyStoredBin = (): StoredBin => ({
  speedLimitKmh: 0,
  minimumCleanSpeedKmh: 0,
  bestCleanSpeedKmh: 0,
  driverValidatedSpeedKmh: 0,
  driverValidationCount: 0,
  cleanPasses: 0,
  incidentCount: 0,
  lineOffsetM: 0,
  cautionLevel: 0,
  stagnantPasses: 0,
  optimizationLocked: false,
  probeDirection: 1,
  probeAmplitudeM: 0.08,
  baselineTimeMs: 0,
  bestTimeMs: 0,
  baselineEntrySpeedKmh: 0,
  baselineExitSpeedKmh: 0,
  localAttempts: 0,
  localImprovements: 0,
});

const emptyLapBin = (): LapBin => ({
  visited: false,
  incident: false,
  speedRestricted: false,
  driverDemonstration: false,
  incidentSeverity: 0,
  minimumCleanSpeedKmh: Number.POSITIVE_INFINITY,
  maximumCleanSpeedKmh: 0,
  maximumDriverSpeedKmh: 0,
  incidentSpeedLimitKmh: Number.POSITIVE_INFINITY,
  lineOffsetAdjustmentM: 0,
  elapsedS: 0,
  entrySpeedKmh: 0,
  exitSpeedKmh: 0,
});

const finitePositive = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
);

export class ApexAutonomousMemory {
  private bins: StoredBin[];
  private lapBins: LapBin[];
  private lapActive = false;
  private baselineDriverObserved = false;
  private previousRecordedBinIndex?: number;
  private pendingSegmentRetry?: ApexAutonomousSegmentRetry;
  private readonly localRetryCounts: number[];
  private memory: StoredMemory;

  constructor(
    private readonly storageKey: string,
    private readonly trackLengthM: number,
    private readonly maximumLineOffsetM: number,
  ) {
    const binCount = Math.max(8, Math.ceil(trackLengthM / BIN_LENGTH_M));
    this.memory = this.restore(binCount);
    this.bins = this.memory.bins;
    this.lapBins = Array.from({ length: binCount }, emptyLapBin);
    this.localRetryCounts = Array.from({ length: binCount }, () => 0);
  }

  get completedLaps(): number {
    return this.memory.completedLaps;
  }

  get bestLapMs(): number | undefined {
    return this.memory.bestLapMs;
  }

  get baselineReady(): boolean {
    return this.memory.baselineReady;
  }

  get baselineLapMs(): number | undefined {
    return this.memory.baselineLapMs;
  }

  beginLap(): void {
    this.lapBins = Array.from({ length: this.bins.length }, emptyLapBin);
    this.localRetryCounts.fill(0);
    this.baselineDriverObserved = false;
    this.previousRecordedBinIndex = undefined;
    this.pendingSegmentRetry = undefined;
    this.lapActive = true;
  }

  cancelLap(): void {
    this.lapActive = false;
    this.lapBins = Array.from({ length: this.bins.length }, emptyLapBin);
    this.localRetryCounts.fill(0);
    this.baselineDriverObserved = false;
    this.previousRecordedBinIndex = undefined;
    this.pendingSegmentRetry = undefined;
  }

  consumeSegmentRetry(): ApexAutonomousSegmentRetry | undefined {
    const retry = this.pendingSegmentRetry;
    this.pendingSegmentRetry = undefined;
    return retry;
  }

  acknowledgeSegmentRetry(binIndex: number): void {
    if (binIndex < 0 || binIndex >= this.lapBins.length) return;
    this.lapBins[binIndex] = emptyLapBin();
    this.previousRecordedBinIndex = binIndex;
  }

  guidance(distanceM: number, curvatureSpeedKmh: number): ApexAutonomousLearningGuidance {
    const index = this.binIndex(distanceM);
    const bin = this.bins[index];
    const nextBin = this.bins[(index + 1) % this.bins.length];
    const binProgress = (
      ((distanceM % BIN_LENGTH_M) + BIN_LENGTH_M) % BIN_LENGTH_M
    ) / BIN_LENGTH_M;
    const trackDistanceM = (
      (distanceM % this.trackLengthM) + this.trackLengthM
    ) % this.trackLengthM;
    const macroSegmentIndex = Math.min(
      MACRO_SEGMENT_COUNT - 1,
      Math.floor(
        trackDistanceM / this.trackLengthM * MACRO_SEGMENT_COUNT,
      ),
    );
    const recognitionLap = !this.memory.baselineReady;
    const probingThisSegment = !recognitionLap;
    const powerLimit = recognitionLap
      ? 1
      : this.powerLimitForCompletedLaps(this.completedLaps);
    const nextLapPowerLimit = this.powerLimitForCompletedLaps(
      this.completedLaps + 1,
    );
    const trialIncrementKmh = this.trialIncrementKmh(bin);
    const lapAttackFactor = recognitionLap ? 1 : 1.2;
    const demonstratedCeilingKmh = bin.driverValidatedSpeedKmh > 0
      ? bin.driverValidatedSpeedKmh + trialIncrementKmh
      : 0;
    const physicalSpeedCeilingKmh = Math.max(
      curvatureSpeedKmh * lapAttackFactor,
      demonstratedCeilingKmh,
    );
    const learnedLimit = bin.speedLimitKmh > 0
      ? bin.speedLimitKmh
      : Math.min(112, Math.max(42, curvatureSpeedKmh * 0.86));
    const validatedSpeedLimitKmh = recognitionLap
      ? curvatureSpeedKmh
      : Math.min(physicalSpeedCeilingKmh, learnedLimit);
    const nextTrialSpeedKmh = !probingThisSegment
      ? validatedSpeedLimitKmh
      : Math.min(
          physicalSpeedCeilingKmh,
          validatedSpeedLimitKmh + trialIncrementKmh,
        );
    const speedLimitKmh = probingThisSegment
      ? nextTrialSpeedKmh
      : validatedSpeedLimitKmh;
    const zoneClassification: ApexAutonomousZoneClassification = (
      bin.cautionLevel > 0
        ? bin.cleanPasses === 0 ? 'recovery' : 'probing'
        : bin.bestCleanSpeedKmh >= 112
          ? 'fast'
          : probingThisSegment
            ? 'probing'
            : bin.incidentCount > 0 || bin.driverValidationCount > 0
              ? 'validated'
              : bin.bestCleanSpeedKmh >= 100 ? 'fast' : 'learning'
    );
    const estimatedZoneGainMs = nextTrialSpeedKmh > validatedSpeedLimitKmh
      ? Math.max(
          0,
          (
            BIN_LENGTH_M / Math.max(5, validatedSpeedLimitKmh / 3.6)
            - BIN_LENGTH_M / Math.max(5, nextTrialSpeedKmh / 3.6)
          ) * 1000,
        )
      : 0;
    let upcomingCautionDistanceM: number | undefined;
    for (
      let offset = 0;
      offset <= Math.min(8, this.bins.length - 1);
      offset += 1
    ) {
      const candidate = this.bins[(index + offset) % this.bins.length];
      if (candidate.cautionLevel <= 0) continue;
      upcomingCautionDistanceM = Math.max(
        0,
        offset * BIN_LENGTH_M - binProgress * BIN_LENGTH_M,
      );
      break;
    }
    return Object.freeze({
      recognitionLap,
      completedLaps: this.completedLaps,
      powerLimit,
      nextLapPowerLimit,
      steeringLimit: recognitionLap ? 0.82 : Math.min(1, 0.78 + this.completedLaps * 0.04),
      speedLimitKmh: Math.max(18, speedLimitKmh),
      cleanPasses: bin.cleanPasses,
      incidentCount: bin.incidentCount,
      totalIncidentCount: this.bins.reduce(
        (total, candidate) => total + candidate.incidentCount,
        0,
      ),
      minimumCleanSpeedKmh: bin.minimumCleanSpeedKmh,
      bestCleanSpeedKmh: bin.bestCleanSpeedKmh,
      driverValidatedSpeedKmh: bin.driverValidatedSpeedKmh,
      driverValidationCount: bin.driverValidationCount,
      nextTrialSpeedKmh,
      improvementPotentialKmh: Math.max(
        0,
        nextTrialSpeedKmh - validatedSpeedLimitKmh,
      ),
      estimatedZoneGainMs,
      optimizationLocked: false,
      stagnantPasses: bin.stagnantPasses,
      zoneClassification,
      lineOffsetM: recognitionLap
        ? 0
        : Math.max(
            -this.maximumLineOffsetM,
            Math.min(
              this.maximumLineOffsetM,
              (
                bin.lineOffsetM + this.lineProbeOffsetM(bin)
              ) * (1 - binProgress)
                + (
                  nextBin.lineOffsetM + this.lineProbeOffsetM(nextBin)
                ) * binProgress,
            ),
          ),
      zoneIndex: macroSegmentIndex,
      zoneCount: MACRO_SEGMENT_COUNT,
      trackDistanceM,
      trackProgress: trackDistanceM / this.trackLengthM,
      lapCoverage: this.lapBins.filter(candidate => candidate.visited).length
        / this.lapBins.length,
      fastZoneCount: this.bins.filter(
        candidate => candidate.bestCleanSpeedKmh >= 100,
      ).length,
      brakingZoneCount: this.bins.filter(
        candidate => candidate.incidentCount > 0
          || candidate.cautionLevel > 0
          || (
            candidate.speedLimitKmh > 0
            && candidate.speedLimitKmh < 78
          ),
      ).length,
      cautionLevel: bin.cautionLevel,
      upcomingCautionDistanceM,
      bestLapMs: this.bestLapMs,
      baselineReady: this.memory.baselineReady,
      baselineLapMs: this.memory.baselineLapMs,
      baselineCaptureActive: (
        !this.memory.baselineReady && this.baselineDriverObserved
      ),
      segmentBestTimeMs: bin.bestTimeMs || undefined,
      segmentBaselineTimeMs: bin.baselineTimeMs || undefined,
      segmentRetryAttempt: this.localRetryCounts[index],
    });
  }

  record(
    distanceM: number,
    state: ApexVehicleState,
    crossTrackErrorM: number,
    safeHalfWidthM: number,
    unexpectedDecelerationKmhPerS = 0,
    driverOverrideActive = false,
    sampleDurationS = 0,
  ): ApexAutonomousIncident | undefined {
    if (!this.lapActive) return undefined;
    const index = this.binIndex(distanceM);
    const bin = this.lapBins[index];
    if (this.previousRecordedBinIndex !== index) {
      this.evaluateCompletedLocalSegment(
        this.previousRecordedBinIndex,
        index,
      );
      this.previousRecordedBinIndex = index;
    }
    bin.visited = true;
    if (bin.entrySpeedKmh <= 0) bin.entrySpeedKmh = state.speedKmh;
    bin.exitSpeedKmh = state.speedKmh;
    bin.elapsedS += Math.max(0, Math.min(0.25, sampleDurationS));
    if (driverOverrideActive) this.baselineDriverObserved = true;
    const grassWheels = state.wheels.filter(
      wheel => wheel.surface === 'grass',
    ).length;
    const gravelWheels = state.wheels.filter(
      wheel => wheel.surface === 'gravel',
    ).length;
    const groundedWheels = state.wheels.filter(wheel => wheel.grounded).length;
    const maximumSuspensionLoadN = Math.max(
      0,
      ...state.wheels.map(
        wheel => Math.max(0, wheel.suspensionImpulse * state.physicsHz),
      ),
    );
    const maximumSlipAngle = Math.max(
      ...state.wheels.map(wheel => Math.abs(wheel.lateralSlipRadians)),
    );
    const maximumSlipRatio = Math.max(
      ...state.wheels.map(wheel => Math.abs(wheel.longitudinalSlip)),
    );
    const edgeRatio = Math.abs(crossTrackErrorM) / safeHalfWidthM;
    const farFromLine = edgeRatio > 0.96;
    const drifting = (
      state.speedKmh > 22
      && (
        maximumSlipAngle > 18 * Math.PI / 180
        || maximumSlipRatio > 0.58
      )
    );
    const airborne = state.speedKmh > 24 && groundedWheels <= 1;
    const hardImpact = (
      state.speedKmh > 18
      && (
        maximumSuspensionLoadN > 28_000
        || unexpectedDecelerationKmhPerS > 58
      )
    );
    let incidentType: ApexAutonomousIncident['type'] | undefined;
    if (grassWheels > 0) incidentType = 'off-track';
    else if (gravelWheels > 0) incidentType = 'rough-surface';
    else if (airborne) incidentType = 'airborne';
    else if (hardImpact) incidentType = 'impact';
    else if (farFromLine) incidentType = 'far-from-line';
    else if (drifting) incidentType = 'drift';

    if (!incidentType) {
      if (state.speedKmh > 5) {
        bin.minimumCleanSpeedKmh = Math.min(
          bin.minimumCleanSpeedKmh,
          state.speedKmh,
        );
      }
      bin.maximumCleanSpeedKmh = Math.max(
        bin.maximumCleanSpeedKmh,
        state.speedKmh,
      );
      if (driverOverrideActive && state.speedKmh > 5) {
        bin.driverDemonstration = true;
        bin.maximumDriverSpeedKmh = Math.max(
          bin.maximumDriverSpeedKmh,
          state.speedKmh,
        );
      }
      return undefined;
    }

    const surfaceSeverity = Math.max(grassWheels, gravelWheels)
      / Math.max(1, state.wheels.length);
    const slipSeverity = Math.max(
      maximumSlipAngle / (24 * Math.PI / 180),
      maximumSlipRatio / 0.75,
    );
    const severity = Math.max(0.25, Math.min(
      1,
      Math.max(
        surfaceSeverity,
        (edgeRatio - 0.72) / 0.5,
        slipSeverity,
        airborne ? 0.78 : 0,
        hardImpact ? 0.86 : 0,
        unexpectedDecelerationKmhPerS / 80,
      ),
    ));
    const speedRetention = incidentType === 'drift'
      ? 0.91
      : incidentType === 'far-from-line'
        ? 0.87
        : incidentType === 'rough-surface'
          ? 0.83
          : incidentType === 'airborne'
            ? 0.8
            : 0.75;
    const baseIncidentLimit = Math.max(
      16,
      state.speedKmh * Math.max(0.64, speedRetention - severity * 0.08),
    );
    let incidentSide: -1 | 0 | 1 = Math.abs(crossTrackErrorM) > 0.15
      ? Math.sign(crossTrackErrorM) as -1 | 1
      : 0;
    if (
      incidentSide === 0
      && (
        incidentType === 'impact'
        || incidentType === 'rough-surface'
        || incidentType === 'airborne'
      )
    ) {
      incidentSide = index % 2 === 0 ? 1 : -1;
    }
    const speedMps = state.speedKmh / 3.6;
    const anticipationDistanceM = Math.max(
      42,
      speedMps * 1.15 + speedMps * speedMps / 13,
    ) * (0.85 + severity * 0.35);
    const anticipationBins = Math.max(
      4,
      Math.min(10, Math.ceil(anticipationDistanceM / BIN_LENGTH_M)),
    );
    for (let offset = 0; offset <= anticipationBins; offset += 1) {
      const anticipationIndex = (
        index - offset + this.lapBins.length
      ) % this.lapBins.length;
      const anticipation = this.lapBins[anticipationIndex];
      anticipation.visited = true;
      anticipation.speedRestricted = true;
      anticipation.incidentSeverity = Math.max(
        anticipation.incidentSeverity,
        severity * (1 - offset / (anticipationBins + 1) * 0.55),
      );
      if (offset === 0) anticipation.incident = true;
      const progressiveLimit = Math.min(
        state.speedKmh * 0.97,
        baseIncidentLimit + offset * (
          6.5 + state.speedKmh * 0.018
        ),
      );
      anticipation.incidentSpeedLimitKmh = Math.min(
        anticipation.incidentSpeedLimitKmh,
        progressiveLimit,
      );
    }
    if (incidentSide !== 0) {
      for (let offset = -6; offset <= 4; offset += 1) {
        const correctionIndex = (
          index + offset + this.lapBins.length
        ) % this.lapBins.length;
        const correction = this.lapBins[correctionIndex];
        correction.visited = true;
        const distanceWeight = offset <= 0
          ? Math.max(0.22, 1 - Math.abs(offset) * 0.13)
          : Math.max(0.3, 0.72 - offset * 0.11);
        const strength = (0.3 + severity * 0.42) * distanceWeight;
        const adjustmentM = -incidentSide * strength;
        if (
          Math.abs(adjustmentM) > Math.abs(correction.lineOffsetAdjustmentM)
        ) {
          correction.lineOffsetAdjustmentM = adjustmentM;
        }
      }
    }
    return Object.freeze({
      type: incidentType,
      binIndex: index,
      side: incidentSide,
      severity,
    });
  }

  completeLap(lapTimeMs: number | undefined): void {
    if (!this.lapActive) return;
    const visitedCoverage = this.lapBins.filter(bin => bin.visited).length
      / this.lapBins.length;
    const captureDriverBaseline = (
      !this.memory.baselineReady
      && this.baselineDriverObserved
      && visitedCoverage >= 0.78
    );
    const baselineLap = captureDriverBaseline;
    const segmentTimesMs = Array.from(
      { length: MACRO_SEGMENT_COUNT },
      (_, segmentIndex) => this.lapBins.reduce((totalS, lapBin, binIndex) => {
        const binSegmentIndex = Math.min(
          MACRO_SEGMENT_COUNT - 1,
          Math.floor(binIndex / this.lapBins.length * MACRO_SEGMENT_COUNT),
        );
        return binSegmentIndex === segmentIndex
          ? totalS + lapBin.elapsedS
          : totalS;
      }, 0) * 1000,
    );
    const segmentHasIncident = Array.from(
      { length: MACRO_SEGMENT_COUNT },
      (_, segmentIndex) => this.lapBins.some((lapBin, binIndex) => {
        const binSegmentIndex = Math.min(
          MACRO_SEGMENT_COUNT - 1,
          Math.floor(binIndex / this.lapBins.length * MACRO_SEGMENT_COUNT),
        );
        return binSegmentIndex === segmentIndex && lapBin.speedRestricted;
      }),
    );
    const segmentImproved = segmentTimesMs.map((timeMs, segmentIndex) => {
      const previousBestMs = this.memory.bestSegmentTimesMs[segmentIndex];
      return (
        timeMs > 0
        && !segmentHasIncident[segmentIndex]
        && (
          previousBestMs <= 0
          || timeMs < previousBestMs - MINIMUM_SEGMENT_IMPROVEMENT_MS
        )
      );
    });

    this.lapBins.forEach((lapBin, index) => {
      if (!lapBin.visited) return;
      const stored = this.bins[index];
      if (captureDriverBaseline && lapBin.elapsedS > 0) {
        const segmentTimeMs = lapBin.elapsedS * 1000;
        stored.baselineTimeMs = segmentTimeMs;
        stored.bestTimeMs = segmentTimeMs;
        stored.baselineEntrySpeedKmh = lapBin.entrySpeedKmh;
        stored.baselineExitSpeedKmh = lapBin.exitSpeedKmh;
        stored.localAttempts = 0;
        stored.localImprovements = 0;
      }
      const segmentIndex = Math.min(
        MACRO_SEGMENT_COUNT - 1,
        Math.floor(index / this.lapBins.length * MACRO_SEGMENT_COUNT),
      );
      const acceptedChallenge = (
        baselineLap
        || segmentImproved[segmentIndex]
        || lapBin.driverDemonstration
      );
      stored.lineOffsetM = Math.max(
        -this.maximumLineOffsetM,
        Math.min(
          this.maximumLineOffsetM,
          stored.lineOffsetM + lapBin.lineOffsetAdjustmentM,
        ),
      );
      if (lapBin.speedRestricted) {
        if (lapBin.incident) stored.incidentCount += 1;
        stored.cleanPasses = 0;
        stored.stagnantPasses = 0;
        stored.optimizationLocked = false;
        if (Math.abs(lapBin.lineOffsetAdjustmentM) > 0.01) {
          stored.probeDirection = Math.sign(
            lapBin.lineOffsetAdjustmentM,
          ) as -1 | 1;
        } else {
          stored.probeDirection = stored.probeDirection === 1 ? -1 : 1;
        }
        stored.probeAmplitudeM = Math.min(
          0.7,
          Math.max(0.16, stored.probeAmplitudeM + 0.08),
        );
        stored.cautionLevel = Math.min(
          8,
          stored.cautionLevel + 0.35 + lapBin.incidentSeverity,
        );
        if (Number.isFinite(lapBin.incidentSpeedLimitKmh)) {
          // Una prueba fallida no borra la velocidad campeona que ya había
          // completado el sector. Se corrige la línea y se vuelve a intentar
          // con un incremento menor. Sólo la vuelta base necesita crear el
          // primer límite seguro de ese punto.
          if (baselineLap || stored.speedLimitKmh <= 0) {
            stored.speedLimitKmh = lapBin.incidentSpeedLimitKmh;
          }
        }
        return;
      }
      stored.cleanPasses = Math.min(255, stored.cleanPasses + 1);
      const previousDriverValidatedSpeedKmh = stored.driverValidatedSpeedKmh;
      if (Number.isFinite(lapBin.minimumCleanSpeedKmh)) {
        stored.minimumCleanSpeedKmh = stored.minimumCleanSpeedKmh > 0
          ? Math.min(
              stored.minimumCleanSpeedKmh,
              lapBin.minimumCleanSpeedKmh,
            )
          : lapBin.minimumCleanSpeedKmh;
      }
      stored.bestCleanSpeedKmh = Math.max(
        stored.bestCleanSpeedKmh,
        lapBin.maximumCleanSpeedKmh,
      );
      if (lapBin.driverDemonstration) {
        stored.driverValidationCount = Math.min(
          65_535,
          stored.driverValidationCount + 1,
        );
        stored.driverValidatedSpeedKmh = Math.max(
          stored.driverValidatedSpeedKmh,
          lapBin.maximumDriverSpeedKmh,
        );
        if (
          lapBin.maximumDriverSpeedKmh
          > Math.max(
            previousDriverValidatedSpeedKmh,
            stored.speedLimitKmh,
          ) + 0.8
        ) {
          stored.optimizationLocked = false;
          stored.stagnantPasses = 0;
        }
        stored.speedLimitKmh = Math.max(
          stored.speedLimitKmh,
          lapBin.maximumDriverSpeedKmh,
        );
      }
      if (stored.speedLimitKmh <= 0) {
        stored.speedLimitKmh = lapBin.maximumCleanSpeedKmh;
      } else if (acceptedChallenge) {
        stored.speedLimitKmh = Math.max(
          stored.speedLimitKmh,
          lapBin.maximumCleanSpeedKmh,
        );
      }
      if (stored.cautionLevel > 0) {
        stored.cautionLevel = Math.max(
          0,
          stored.cautionLevel - (stored.cleanPasses === 1 ? 0.8 : 1.2),
        );
      }
      if (
        !baselineLap
        && !lapBin.driverDemonstration
      ) {
        if (segmentImproved[segmentIndex]) {
          stored.stagnantPasses = 0;
          stored.optimizationLocked = false;
          stored.lineOffsetM = Math.max(
            -this.maximumLineOffsetM,
            Math.min(
              this.maximumLineOffsetM,
              stored.lineOffsetM + this.lineProbeOffsetM(stored),
            ),
          );
          stored.probeAmplitudeM = Math.max(
            0.06,
            stored.probeAmplitudeM * 0.72,
          );
        } else {
          stored.stagnantPasses = Math.min(255, stored.stagnantPasses + 1);
          stored.probeDirection = stored.probeDirection === 1 ? -1 : 1;
          stored.probeAmplitudeM = Math.min(
            0.72,
            stored.probeAmplitudeM + (
              stored.bestCleanSpeedKmh >= 112 ? 0.025 : 0.07
            ),
          );
        }
      }
      stored.optimizationLocked = false;
    });
    const validLapMs = finitePositive(lapTimeMs);
    const lapHasIncident = segmentHasIncident.some(Boolean);
    const previousBestLapMs = this.memory.bestLapMs;
    const lapImproved = (
      validLapMs > 0
      && !lapHasIncident
      && (
        previousBestLapMs === undefined
        || validLapMs < previousBestLapMs
      )
    );
    segmentImproved.forEach((improved, segmentIndex) => {
      if (!improved) return;
      this.memory.bestSegmentTimesMs[segmentIndex] = (
        segmentTimesMs[segmentIndex]
      );
    });
    if (
      lapImproved
    ) {
      this.memory.bestLapMs = validLapMs;
    }
    if (captureDriverBaseline) {
      this.memory.baselineReady = true;
      this.memory.baselineLapMs = validLapMs || undefined;
      if (validLapMs > 0) {
        this.memory.bestLapMs = this.memory.bestLapMs === undefined
          ? validLapMs
          : Math.min(this.memory.bestLapMs, validLapMs);
      }
    }
    this.memory.lastLapMs = validLapMs || undefined;
    this.memory.lastLapImproved = lapImproved;
    this.memory.completedLaps += 1;
    this.lapActive = false;
    this.persist();
  }

  private evaluateCompletedLocalSegment(
    completedIndex: number | undefined,
    enteredIndex: number,
  ): void {
    if (
      completedIndex === undefined
      || !this.memory.baselineReady
      || this.pendingSegmentRetry !== undefined
    ) return;
    const forwardIndex = (completedIndex + 1) % this.lapBins.length;
    if (enteredIndex !== forwardIndex) return;
    const lapBin = this.lapBins[completedIndex];
    const stored = this.bins[completedIndex];
    const targetTimeMs = stored.bestTimeMs || stored.baselineTimeMs;
    const actualTimeMs = lapBin.elapsedS * 1000;
    if (targetTimeMs <= 0 || actualTimeMs <= 0) return;
    stored.localAttempts = Math.min(65_535, stored.localAttempts + 1);
    const clean = !lapBin.speedRestricted && !lapBin.incident;
    const improved = (
      clean
      && actualTimeMs <= targetTimeMs - LOCAL_SEGMENT_IMPROVEMENT_MS
    );
    if (improved) {
      stored.bestTimeMs = actualTimeMs;
      stored.localImprovements = Math.min(
        65_535,
        stored.localImprovements + 1,
      );
      stored.stagnantPasses = 0;
      stored.speedLimitKmh = Math.max(
        stored.speedLimitKmh,
        lapBin.maximumCleanSpeedKmh,
        lapBin.maximumDriverSpeedKmh,
      );
      this.localRetryCounts[completedIndex] = 0;
      this.persist();
      return;
    }
    const attempt = this.localRetryCounts[completedIndex] + 1;
    this.localRetryCounts[completedIndex] = attempt;
    stored.probeDirection = stored.probeDirection === 1 ? -1 : 1;
    stored.probeAmplitudeM = Math.min(
      0.72,
      stored.probeAmplitudeM + (clean ? 0.035 : 0.08),
    );
    if (attempt > MAXIMUM_LOCAL_RETRIES) {
      this.localRetryCounts[completedIndex] = 0;
      stored.stagnantPasses = Math.min(255, stored.stagnantPasses + 1);
      return;
    }
    this.pendingSegmentRetry = Object.freeze({
      binIndex: completedIndex,
      attempt,
      actualTimeMs,
      targetTimeMs,
    });
  }

  private binIndex(distanceM: number): number {
    const wrapped = (
      (distanceM % this.trackLengthM) + this.trackLengthM
    ) % this.trackLengthM;
    return Math.min(
      this.bins.length - 1,
      Math.floor(wrapped / BIN_LENGTH_M),
    );
  }

  private powerLimitForCompletedLaps(_completedLaps: number): number {
    return 1;
  }

  private trialIncrementKmh(
    bin: Pick<
      StoredBin,
      | 'cautionLevel'
      | 'cleanPasses'
      | 'stagnantPasses'
      | 'bestCleanSpeedKmh'
    >,
  ): number {
    const baseIncrementKmh = bin.cautionLevel > 0
      ? 1.8
      : bin.bestCleanSpeedKmh >= 145
        ? 1.25
        : bin.bestCleanSpeedKmh >= 112
          ? 2
          : 3.8;
    return Math.max(
      1,
      Math.min(
        5.5,
        baseIncrementKmh
          + Math.min(1.4, bin.cleanPasses * 0.12)
          - Math.min(1.2, bin.stagnantPasses * 0.24),
      ),
    );
  }

  private lineProbeOffsetM(
    bin: Pick<
      StoredBin,
      'probeDirection' | 'probeAmplitudeM' | 'bestCleanSpeedKmh'
    >,
  ): number {
    const fastZoneScale = bin.bestCleanSpeedKmh >= 145
      ? 0.12
      : bin.bestCleanSpeedKmh >= 112 ? 0.3 : 1;
    return bin.probeDirection * bin.probeAmplitudeM * fastZoneScale;
  }

  private restore(binCount: number): StoredMemory {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(this.storageKey) ?? 'null',
      ) as Partial<StoredMemory> | null;
      if (
        parsed?.format !== FORMAT
        || parsed.formatVersion !== FORMAT_VERSION
        || parsed.binLengthM !== BIN_LENGTH_M
        || !Array.isArray(parsed.bins)
      ) throw new Error('Memoria incompatible');
      return {
        format: FORMAT,
        formatVersion: FORMAT_VERSION,
        binLengthM: BIN_LENGTH_M,
        completedLaps: Math.max(0, Math.floor(parsed.completedLaps ?? 0)),
        bestLapMs: finitePositive(parsed.bestLapMs) || undefined,
        lastLapMs: finitePositive(parsed.lastLapMs) || undefined,
        lastLapImproved: parsed.lastLapImproved === true,
        baselineReady: parsed.baselineReady === true,
        baselineLapMs: finitePositive(parsed.baselineLapMs) || undefined,
        bestSegmentTimesMs: Array.from(
          { length: MACRO_SEGMENT_COUNT },
          (_, index) => finitePositive(parsed.bestSegmentTimesMs?.[index]),
        ),
        bins: Array.from({ length: binCount }, (_, index) => {
          const stored = parsed.bins?.[index] as Partial<StoredBin> | undefined;
          const storedLineOffsetM = typeof stored?.lineOffsetM === 'number'
            && Number.isFinite(stored.lineOffsetM)
            ? stored.lineOffsetM
            : 0;
          return {
            speedLimitKmh: finitePositive(stored?.speedLimitKmh),
            minimumCleanSpeedKmh: finitePositive(
              stored?.minimumCleanSpeedKmh,
            ),
            bestCleanSpeedKmh: finitePositive(stored?.bestCleanSpeedKmh),
            driverValidatedSpeedKmh: finitePositive(
              stored?.driverValidatedSpeedKmh,
            ),
            driverValidationCount: Math.max(
              0,
              Math.min(
                65_535,
                Math.floor(stored?.driverValidationCount ?? 0),
              ),
            ),
            cleanPasses: Math.max(0, Math.floor(stored?.cleanPasses ?? 0)),
            incidentCount: Math.max(0, Math.floor(stored?.incidentCount ?? 0)),
            cautionLevel: typeof stored?.cautionLevel === 'number'
              && Number.isFinite(stored.cautionLevel)
              ? Math.max(0, Math.min(12, stored.cautionLevel))
              : 0,
            stagnantPasses: Math.max(
              0,
              Math.min(255, Math.floor(stored?.stagnantPasses ?? 0)),
            ),
            optimizationLocked: stored?.optimizationLocked === true,
            probeDirection: stored?.probeDirection === -1 ? -1 : 1,
            probeAmplitudeM: typeof stored?.probeAmplitudeM === 'number'
              && Number.isFinite(stored.probeAmplitudeM)
              ? Math.max(0.04, Math.min(0.72, stored.probeAmplitudeM))
              : 0.08,
            baselineTimeMs: finitePositive(stored?.baselineTimeMs),
            bestTimeMs: finitePositive(stored?.bestTimeMs),
            baselineEntrySpeedKmh: finitePositive(
              stored?.baselineEntrySpeedKmh,
            ),
            baselineExitSpeedKmh: finitePositive(
              stored?.baselineExitSpeedKmh,
            ),
            localAttempts: Math.max(
              0,
              Math.min(65_535, Math.floor(stored?.localAttempts ?? 0)),
            ),
            localImprovements: Math.max(
              0,
              Math.min(65_535, Math.floor(stored?.localImprovements ?? 0)),
            ),
            lineOffsetM: Math.max(
              -this.maximumLineOffsetM,
              Math.min(
                this.maximumLineOffsetM,
                storedLineOffsetM,
              ),
            ),
          };
        }),
      };
    } catch {
      return {
        format: FORMAT,
        formatVersion: FORMAT_VERSION,
        binLengthM: BIN_LENGTH_M,
        completedLaps: 0,
        lastLapImproved: false,
        baselineReady: false,
        bestSegmentTimesMs: Array.from(
          { length: MACRO_SEGMENT_COUNT },
          () => 0,
        ),
        bins: Array.from({ length: binCount }, emptyStoredBin),
      };
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.memory));
    } catch {
      // El piloto conserva la memoria de esta sesión aunque storage no esté disponible.
    }
  }
}
