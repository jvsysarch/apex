import type {
  ApexVehicleState,
} from '@jvsysarch/apex-physics';
import type { DriverInput } from '@jvsysarch/apex-physics';
import type { RacingLinePoint } from '../race/ApexRacingLineLearner';
import {
  ApexAutonomousMemory,
  type ApexAutonomousIncident,
  type ApexAutonomousSegmentRetry,
  type ApexAutonomousZoneClassification,
} from './ApexAutonomousMemory';

export interface ApexAutonomousObstacle {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly radiusM?: number;
}

export type ApexAutonomousMode =
  | 'racing-line'
  | 'edge-recovery'
  | 'surface-recovery'
  | 'obstacle-avoidance'
  | 'stuck-recovery';

export type ApexAutonomousCornerPhase =
  | 'straight'
  | 'braking'
  | 'turn-in'
  | 'apex'
  | 'exit';

export interface ApexAutonomousTelemetry {
  readonly mode: ApexAutonomousMode;
  readonly targetSpeedKmh: number;
  readonly learnedSpeedLimitKmh: number;
  readonly lookAheadM: number;
  readonly crossTrackErrorM: number;
  readonly racingLineErrorM: number;
  readonly headingErrorRadians: number;
  readonly obstacleDistanceM?: number;
  readonly recognitionLap: boolean;
  readonly completedLearningLaps: number;
  readonly powerLimit: number;
  readonly nextLapPowerLimit: number;
  readonly steeringLimit: number;
  readonly cleanPasses: number;
  readonly incidentCount: number;
  readonly totalIncidentCount: number;
  readonly minimumCleanSpeedKmh: number;
  readonly bestCleanSpeedKmh: number;
  readonly driverValidatedSpeedKmh: number;
  readonly driverValidationCount: number;
  readonly driverLearningActive: boolean;
  readonly nextTrialSpeedKmh: number;
  readonly improvementPotentialKmh: number;
  readonly estimatedZoneGainMs: number;
  readonly optimizationLocked: boolean;
  readonly stagnantPasses: number;
  readonly zoneClassification: ApexAutonomousZoneClassification;
  readonly desiredLineOffsetM: number;
  readonly attackLineOffsetM: number;
  readonly cornerPhase: ApexAutonomousCornerPhase;
  readonly previewBrakeDistanceM?: number;
  readonly zoneIndex: number;
  readonly zoneCount: number;
  readonly trackDistanceM: number;
  readonly trackProgress: number;
  readonly lapCoverage: number;
  readonly fastZoneCount: number;
  readonly brakingZoneCount: number;
  readonly cautionLevel: number;
  readonly upcomingCautionDistanceM?: number;
  readonly throttleCommand: number;
  readonly brakeCommand: number;
  readonly steeringCommand: number;
  readonly bestLapMs?: number;
  readonly baselineReady: boolean;
  readonly baselineLapMs?: number;
  readonly baselineCaptureActive: boolean;
  readonly segmentBestTimeMs?: number;
  readonly segmentBaselineTimeMs?: number;
  readonly segmentRetryAttempt: number;
  readonly incident?: ApexAutonomousIncident['type'];
  readonly incidentSide?: ApexAutonomousIncident['side'];
  readonly incidentSeverity?: number;
}

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.max(minimum, Math.min(maximum, value))
);

const wrapAngle = (angle: number) => {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
};

const horizontalDirection = (
  start: Pick<RacingLinePoint, 'x' | 'z'>,
  end: Pick<RacingLinePoint, 'x' | 'z'>,
) => {
  const x = end.x - start.x;
  const z = end.z - start.z;
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
};

const forwardFromRotation = (
  rotation: readonly [number, number, number, number],
) => {
  const [x, y, z, w] = rotation;
  const forwardX = 2 * (x * z + w * y);
  const forwardZ = 1 - 2 * (x * x + y * y);
  const length = Math.hypot(forwardX, forwardZ) || 1;
  return { x: forwardX / length, z: forwardZ / length };
};

const IDLE_INPUT: DriverInput = Object.freeze({
  forward: false,
  backward: false,
  left: false,
  right: false,
  handbrake: false,
  throttle: 0,
  brake: 0,
  steering: 0,
});

export class ApexAutonomousDriver {
  private centerLine: readonly RacingLinePoint[];
  private trackWidthM: number;
  private line: readonly RacingLinePoint[];
  private learnedLine: readonly RacingLinePoint[];
  private memory?: ApexAutonomousMemory;
  private nearestIndex = 0;
  private stoppedDurationS = 0;
  private reverseRemainingS = 0;
  private previousSpeedKmh?: number;
  private previousDriverOverrideActive = false;
  private speedErrorIntegral = 0;
  private avoidanceSide: -1 | 1 = 1;

  lastTelemetry: ApexAutonomousTelemetry = Object.freeze({
    mode: 'racing-line',
    targetSpeedKmh: 0,
    learnedSpeedLimitKmh: 0,
    lookAheadM: 0,
    crossTrackErrorM: 0,
    racingLineErrorM: 0,
    headingErrorRadians: 0,
    recognitionLap: true,
    completedLearningLaps: 0,
    powerLimit: 1,
    nextLapPowerLimit: 1,
    steeringLimit: 0.82,
    cleanPasses: 0,
    incidentCount: 0,
    totalIncidentCount: 0,
    minimumCleanSpeedKmh: 0,
    bestCleanSpeedKmh: 0,
    driverValidatedSpeedKmh: 0,
    driverValidationCount: 0,
    driverLearningActive: false,
    nextTrialSpeedKmh: 0,
    improvementPotentialKmh: 0,
    estimatedZoneGainMs: 0,
    optimizationLocked: false,
    stagnantPasses: 0,
    zoneClassification: 'learning',
    desiredLineOffsetM: 0,
    attackLineOffsetM: 0,
    cornerPhase: 'straight',
    zoneIndex: 0,
    zoneCount: 1,
    trackDistanceM: 0,
    trackProgress: 0,
    lapCoverage: 0,
    fastZoneCount: 0,
    brakingZoneCount: 0,
    cautionLevel: 0,
    throttleCommand: 0,
    brakeCommand: 0,
    steeringCommand: 0,
    baselineReady: false,
    baselineCaptureActive: false,
    segmentRetryAttempt: 0,
  });

  constructor(
    centerLine: readonly RacingLinePoint[],
    trackWidthM: number,
  ) {
    this.centerLine = centerLine;
    this.trackWidthM = trackWidthM;
    this.line = centerLine;
    this.learnedLine = centerLine;
  }

  configureTrack(
    centerLine: readonly RacingLinePoint[],
    trackWidthM: number,
  ): void {
    if (centerLine.length < 3) return;
    this.centerLine = centerLine;
    this.trackWidthM = trackWidthM;
    this.line = centerLine;
    this.learnedLine = centerLine;
    this.nearestIndex = 0;
    this.reset();
  }

  setLine(line: readonly RacingLinePoint[]): void {
    if (line.length < 3) return;
    this.learnedLine = line;
    this.nearestIndex %= line.length;
  }

  configureMemory(storageKey: string): void {
    const first = this.centerLine[0];
    const last = this.centerLine[this.centerLine.length - 1];
    const trackLengthM = last.distanceM + Math.hypot(
      first.x - last.x,
      first.z - last.z,
    );
    this.memory = new ApexAutonomousMemory(
      storageKey,
      trackLengthM,
      this.trackWidthM * 0.28,
    );
    this.line = this.memory.baselineReady
      ? this.learnedLine
      : this.centerLine;
    this.nearestIndex = 0;
    this.reset();
  }

  beginLap(): void {
    this.memory?.beginLap();
  }

  cancelLap(): void {
    this.memory?.cancelLap();
  }

  completeLap(lapTimeMs?: number): void {
    this.memory?.completeLap(lapTimeMs);
    this.line = this.memory?.baselineReady === false
      ? this.centerLine
      : this.learnedLine;
  }

  consumeSegmentRetry(): ApexAutonomousSegmentRetry | undefined {
    return this.memory?.consumeSegmentRetry();
  }

  acknowledgeSegmentRetry(binIndex: number): void {
    this.memory?.acknowledgeSegmentRetry(binIndex);
    this.nearestIndex = 0;
    this.previousSpeedKmh = undefined;
    this.speedErrorIntegral = 0;
  }

  reset(): void {
    this.stoppedDurationS = 0;
    this.reverseRemainingS = 0;
    this.previousSpeedKmh = undefined;
    this.previousDriverOverrideActive = false;
    this.speedErrorIntegral = 0;
  }

  update(
    state: ApexVehicleState,
    deltaS: number,
    obstacles: readonly ApexAutonomousObstacle[] = [],
    driverOverrideActive = false,
  ): DriverInput {
    if (this.line.length < 3) return IDLE_INPUT;
    const appliedDriverOverride = this.previousDriverOverrideActive;
    this.previousDriverOverrideActive = driverOverrideActive;
    this.line = this.memory?.baselineReady === false
      ? this.centerLine
      : this.learnedLine;
    const position = { x: state.position[0], z: state.position[2] };
    this.nearestIndex = this.findNearestIndex(position);
    const nearest = this.line[this.nearestIndex];
    const previous = this.line[
      (this.nearestIndex - 1 + this.line.length) % this.line.length
    ];
    const next = this.line[(this.nearestIndex + 1) % this.line.length];
    const lineDirection = horizontalDirection(previous, next);
    const lineRight = {
      x: lineDirection.z,
      z: -lineDirection.x,
    };
    const racingLineErrorM = (
      (position.x - nearest.x) * lineRight.x
      + (position.z - nearest.z) * lineRight.z
    );
    const centerNearest = this.centerLine[
      this.nearestIndex % this.centerLine.length
    ];
    const centerPrevious = this.centerLine[
      (
        this.nearestIndex - 1 + this.centerLine.length
      ) % this.centerLine.length
    ];
    const centerNext = this.centerLine[
      (this.nearestIndex + 1) % this.centerLine.length
    ];
    const centerDirection = horizontalDirection(centerPrevious, centerNext);
    const centerRight = {
      x: centerDirection.z,
      z: -centerDirection.x,
    };
    const crossTrackErrorM = (
      (position.x - centerNearest.x) * centerRight.x
      + (position.z - centerNearest.z) * centerRight.z
    );
    const safeHalfWidthM = Math.max(2, this.trackWidthM * 0.5 - 1.15);
    const edgeRatio = Math.abs(crossTrackErrorM) / safeHalfWidthM;
    const baseLookAheadM = clamp(8 + state.speedKmh * 0.13, 8, 29);
    const lookAheadM = baseLookAheadM * (
      edgeRatio > 0.78 ? clamp(1.15 - edgeRatio, 0.42, 0.8) : 1
    );
    const targetIndex = this.indexAhead(this.nearestIndex, lookAheadM);
    const target = this.line[targetIndex];
    const futureIndex = this.indexAhead(targetIndex, 24);
    const future = this.line[futureIndex];

    const forward = forwardFromRotation(state.rotation);
    const currentHeading = Math.atan2(forward.x, forward.z);
    const targetDirection = horizontalDirection(nearest, target);
    const futureDirection = horizontalDirection(target, future);
    const curvatureAngle = Math.acos(clamp(
      targetDirection.x * futureDirection.x
        + targetDirection.z * futureDirection.z,
      -1,
      1,
    ));
    let targetSpeedKmh = this.speedForCurvature(curvatureAngle);
    const learning = this.memory?.guidance(
      nearest.distanceM,
      targetSpeedKmh,
    ) ?? {
      recognitionLap: true,
      completedLaps: 0,
      powerLimit: 1,
      nextLapPowerLimit: 1,
      steeringLimit: 0.82,
      speedLimitKmh: targetSpeedKmh,
      cleanPasses: 0,
      incidentCount: 0,
      totalIncidentCount: 0,
      minimumCleanSpeedKmh: 0,
      bestCleanSpeedKmh: 0,
      driverValidatedSpeedKmh: 0,
      driverValidationCount: 0,
      nextTrialSpeedKmh: targetSpeedKmh,
      improvementPotentialKmh: 0,
      estimatedZoneGainMs: 0,
      optimizationLocked: false,
      stagnantPasses: 0,
      zoneClassification: 'learning' as const,
      lineOffsetM: 0,
      zoneIndex: 0,
      zoneCount: 1,
      trackDistanceM: nearest.distanceM,
      trackProgress: 0,
      lapCoverage: 0,
      fastZoneCount: 0,
      brakingZoneCount: 0,
      cautionLevel: 0,
      upcomingCautionDistanceM: undefined,
      bestLapMs: undefined,
      baselineReady: false,
      baselineLapMs: undefined,
      baselineCaptureActive: false,
      segmentBestTimeMs: undefined,
      segmentBaselineTimeMs: undefined,
      segmentRetryAttempt: 0,
    };
    targetSpeedKmh = learning.speedLimitKmh;
    const cornerPlan = this.cornerPlan(
      targetIndex,
      learning.completedLaps,
    );
    const attackLineOffsetM = learning.recognitionLap
      ? 0
      : cornerPlan.attackLineOffsetM;
    const targetLineOffsetM = learning.recognitionLap
      ? 0
      : clamp(
          learning.lineOffsetM + attackLineOffsetM,
          -safeHalfWidthM * 0.72,
          safeHalfWidthM * 0.72,
        );
    const brakingPreview = this.previewBrakingSpeed(
      this.nearestIndex,
      targetSpeedKmh,
      learning.completedLaps,
      state.speedKmh,
    );
    targetSpeedKmh = brakingPreview.targetSpeedKmh;
    const cornerPhase: ApexAutonomousCornerPhase = (
      brakingPreview.brakeDistanceM !== undefined
        && targetSpeedKmh < learning.speedLimitKmh - 1
    )
      ? 'braking'
      : cornerPlan.phase;
    const targetRight = {
      x: targetDirection.z,
      z: -targetDirection.x,
    };
    const targetHeading = Math.atan2(
      target.x + targetRight.x * targetLineOffsetM - position.x,
      target.z + targetRight.z * targetLineOffsetM - position.z,
    );
    const headingError = wrapAngle(targetHeading - currentHeading);
    let mode: ApexAutonomousMode = 'racing-line';

    if (edgeRatio > 0.82) {
      targetSpeedKmh = Math.min(
        targetSpeedKmh,
        edgeRatio > 1 ? 34 : 64,
      );
      mode = 'edge-recovery';
    }
    const wheelsOnGrass = state.wheels.filter(
      wheel => wheel.surface === 'grass',
    ).length;
    const wheelsOnGravel = state.wheels.filter(
      wheel => wheel.surface === 'gravel',
    ).length;
    if (wheelsOnGrass > 0 || wheelsOnGravel > 1) {
      targetSpeedKmh = Math.min(targetSpeedKmh, wheelsOnGrass > 1 ? 22 : 38);
      mode = 'surface-recovery';
    }
    if (Math.abs(headingError) > Math.PI * 0.42) {
      targetSpeedKmh = Math.min(targetSpeedKmh, 18);
    }

    let steering = clamp(
      -headingError * 1.72
        - (
          racingLineErrorM - targetLineOffsetM
        ) / safeHalfWidthM * 0.46,
      -learning.steeringLimit,
      learning.steeringLimit,
    );
    steering = clamp(
      steering + cornerPlan.turnRadians * (
        Math.min(1.25, 0.72 + learning.completedLaps * 0.055)
      ),
      -learning.steeringLimit,
      learning.steeringLimit,
    );
    const unexpectedDecelerationKmhPerS = (
      this.previousSpeedKmh !== undefined
      && deltaS > 0
      && state.brake < 0.25
    )
      ? Math.max(0, (this.previousSpeedKmh - state.speedKmh) / deltaS)
      : 0;
    this.previousSpeedKmh = state.speedKmh;
    const incident = this.memory?.record(
      nearest.distanceM,
      state,
      crossTrackErrorM,
      safeHalfWidthM,
      unexpectedDecelerationKmhPerS,
      appliedDriverOverride,
      deltaS,
    );
    const obstacle = this.closestObstacleAhead(
      position,
      forward,
      state.speedKmh,
      obstacles,
    );
    if (obstacle) {
      const risk = 1 - obstacle.distanceM / obstacle.detectionRangeM;
      targetSpeedKmh = Math.min(
        targetSpeedKmh,
        clamp((obstacle.distanceM - 3.8) * 4.5, 0, 46),
      );
      if (Math.abs(obstacle.lateralM) > 0.15) {
        this.avoidanceSide = obstacle.lateralM > 0 ? -1 : 1;
      }
      const edgeSafeAvoidance = (
        edgeRatio < 0.72
        || Math.sign(this.avoidanceSide) !== Math.sign(crossTrackErrorM)
      );
      if (edgeSafeAvoidance) {
        steering = clamp(
          steering + this.avoidanceSide * risk * 0.62,
          -1,
          1,
        );
      }
      mode = 'obstacle-avoidance';
    }

    const speedErrorKmh = targetSpeedKmh - state.speedKmh;
    if (speedErrorKmh < -4) {
      this.speedErrorIntegral = Math.max(
        -18,
        this.speedErrorIntegral + speedErrorKmh * deltaS,
      );
    } else {
      this.speedErrorIntegral = clamp(
        this.speedErrorIntegral + speedErrorKmh * deltaS,
        -6,
        28,
      );
    }
    const brakingDemand = (
      -speedErrorKmh / 12
      + Math.max(0, -this.speedErrorIntegral) * 0.012
    );
    const brake = speedErrorKmh < -4
      ? clamp(brakingDemand, 0, 1)
      : 0;
    const exitBoost = cornerPhase === 'exit'
      ? Math.min(0.2, 0.08 + learning.completedLaps * 0.022)
      : 0;
    const throttleDemand = (
      0.12
      + speedErrorKmh / 16
      + Math.max(0, this.speedErrorIntegral) * 0.006
      + exitBoost
    );
    const stableForLimitProbe = (
      edgeRatio < 0.78
      && wheelsOnGrass === 0
      && wheelsOnGravel <= 1
      && Math.abs(headingError) < Math.PI * 0.28
      && obstacle === undefined
    );
    const forcedThrottleFloor = learning.recognitionLap || !stableForLimitProbe
      ? 0
      : learning.powerLimit * (
          cornerPhase === 'straight' || cornerPhase === 'exit'
            ? 0.88
            : cornerPhase === 'apex' ? 0.68 : 0.74
        );
    const throttle = brake > 0.02
      ? 0
      : clamp(
          Math.max(throttleDemand, forcedThrottleFloor),
          0,
          learning.powerLimit,
        );

    if (state.speedKmh < 1.6 && throttle > 0.4) {
      this.stoppedDurationS += deltaS;
    } else {
      this.stoppedDurationS = Math.max(0, this.stoppedDurationS - deltaS * 2);
    }
    if (this.stoppedDurationS > 2.4) {
      this.reverseRemainingS = 1.15;
      this.stoppedDurationS = 0;
    }
    this.reverseRemainingS = Math.max(0, this.reverseRemainingS - deltaS);
    if (this.reverseRemainingS > 0) {
      mode = 'stuck-recovery';
      steering = clamp(-steering * 0.8, -0.8, 0.8);
    }

    this.lastTelemetry = Object.freeze({
      mode,
      targetSpeedKmh,
      learnedSpeedLimitKmh: learning.speedLimitKmh,
      lookAheadM,
      crossTrackErrorM,
      racingLineErrorM,
      headingErrorRadians: headingError,
      obstacleDistanceM: obstacle?.distanceM,
      recognitionLap: learning.recognitionLap,
      completedLearningLaps: learning.completedLaps,
      powerLimit: learning.powerLimit,
      nextLapPowerLimit: learning.nextLapPowerLimit,
      steeringLimit: learning.steeringLimit,
      cleanPasses: learning.cleanPasses,
      incidentCount: learning.incidentCount,
      totalIncidentCount: learning.totalIncidentCount,
      minimumCleanSpeedKmh: learning.minimumCleanSpeedKmh,
      bestCleanSpeedKmh: learning.bestCleanSpeedKmh,
      driverValidatedSpeedKmh: learning.driverValidatedSpeedKmh,
      driverValidationCount: learning.driverValidationCount,
      driverLearningActive: appliedDriverOverride,
      nextTrialSpeedKmh: learning.nextTrialSpeedKmh,
      improvementPotentialKmh: learning.improvementPotentialKmh,
      estimatedZoneGainMs: learning.estimatedZoneGainMs,
      optimizationLocked: learning.optimizationLocked,
      stagnantPasses: learning.stagnantPasses,
      zoneClassification: learning.zoneClassification,
      desiredLineOffsetM: targetLineOffsetM,
      attackLineOffsetM,
      cornerPhase,
      previewBrakeDistanceM: brakingPreview.brakeDistanceM,
      zoneIndex: learning.zoneIndex,
      zoneCount: learning.zoneCount,
      trackDistanceM: learning.trackDistanceM,
      trackProgress: learning.trackProgress,
      lapCoverage: learning.lapCoverage,
      fastZoneCount: learning.fastZoneCount,
      brakingZoneCount: learning.brakingZoneCount,
      cautionLevel: learning.cautionLevel,
      upcomingCautionDistanceM: learning.upcomingCautionDistanceM,
      throttleCommand: throttle,
      brakeCommand: brake,
      steeringCommand: steering,
      bestLapMs: learning.bestLapMs,
      baselineReady: learning.baselineReady,
      baselineLapMs: learning.baselineLapMs,
      baselineCaptureActive: learning.baselineCaptureActive,
      segmentBestTimeMs: learning.segmentBestTimeMs,
      segmentBaselineTimeMs: learning.segmentBaselineTimeMs,
      segmentRetryAttempt: learning.segmentRetryAttempt,
      incident: incident?.type,
      incidentSide: incident?.side,
      incidentSeverity: incident?.severity,
    });

    if (this.reverseRemainingS > 0) {
      return {
        forward: false,
        backward: true,
        left: false,
        right: false,
        handbrake: false,
        throttle: 0.42,
        brake: 0,
        steering,
      };
    }
    return {
      forward: throttle > 0.01,
      backward: false,
      left: false,
      right: false,
      handbrake: false,
      throttle,
      brake,
      steering,
    };
  }

  private cornerPlan(
    targetIndex: number,
    completedLaps: number,
  ): {
    readonly phase: Exclude<ApexAutonomousCornerPhase, 'braking'>;
    readonly attackLineOffsetM: number;
    readonly turnRadians: number;
  } {
    const currentTurn = this.signedCurvatureAt(targetIndex, 12);
    const beforeTurn = this.signedCurvatureAt(
      this.indexBehind(targetIndex, 20),
      12,
    );
    const afterTurn = this.signedCurvatureAt(
      this.indexAhead(targetIndex, 20),
      12,
    );
    const currentMagnitude = Math.abs(currentTurn);
    const beforeMagnitude = Math.abs(beforeTurn);
    const afterMagnitude = Math.abs(afterTurn);
    const minimumCornerRadians = 2.2 * Math.PI / 180;
    if (
      currentMagnitude < minimumCornerRadians
      && afterMagnitude < minimumCornerRadians
    ) {
      return {
        phase: 'straight',
        attackLineOffsetM: 0,
        turnRadians: 0,
      };
    }
    const phase: Exclude<ApexAutonomousCornerPhase, 'braking' | 'straight'> = (
      afterMagnitude > currentMagnitude * 1.14
      && afterMagnitude > beforeMagnitude
    )
      ? 'turn-in'
      : beforeMagnitude > currentMagnitude * 1.14
        ? 'exit'
        : 'apex';
    const planningTurn = currentMagnitude >= minimumCornerRadians
      ? currentTurn
      : Math.abs(afterTurn) >= Math.abs(beforeTurn) ? afterTurn : beforeTurn;
    const direction = Math.sign(planningTurn);
    const attackProgress = clamp(0.24 + completedLaps * 0.15, 0, 1);
    const curvatureWeight = clamp(
      Math.abs(planningTurn) / (11 * Math.PI / 180),
      0.25,
      1,
    );
    const attackWidthM = Math.min(1.15, this.trackWidthM * 0.12)
      * attackProgress
      * curvatureWeight;
    const phaseOffset = phase === 'apex'
      ? -direction * attackWidthM
      : direction * attackWidthM * (phase === 'exit' ? 0.72 : 1);
    return {
      phase,
      attackLineOffsetM: phaseOffset,
      turnRadians: planningTurn,
    };
  }

  private previewBrakingSpeed(
    startIndex: number,
    localTargetSpeedKmh: number,
    completedLaps: number,
    currentSpeedKmh: number,
  ): {
    readonly targetSpeedKmh: number;
    readonly brakeDistanceM?: number;
  } {
    const previewDistanceM = clamp(
      50 + Math.max(currentSpeedKmh, localTargetSpeedKmh) * 0.52,
      58,
      150,
    );
    const brakingDecelerationMps2 = Math.min(
      11.5,
      8.6 + completedLaps * 0.48,
    );
    const curveAttackFactor = Math.min(
      1.44,
      1.1 + completedLaps * 0.05,
    );
    let targetSpeedKmh = localTargetSpeedKmh;
    let brakeDistanceM: number | undefined;
    for (
      let distanceM = 10;
      distanceM <= previewDistanceM;
      distanceM += 10
    ) {
      const futureIndex = this.indexAhead(startIndex, distanceM);
      const futureCurvature = Math.abs(
        this.signedCurvatureAt(futureIndex, 12),
      );
      const futureCurveSpeedKmh = this.speedForCurvature(futureCurvature)
        * curveAttackFactor;
      const futureCurveSpeedMps = futureCurveSpeedKmh / 3.6;
      const allowedCurrentSpeedKmh = Math.sqrt(
        futureCurveSpeedMps * futureCurveSpeedMps
        + 2 * brakingDecelerationMps2 * distanceM,
      ) * 3.6;
      if (allowedCurrentSpeedKmh >= targetSpeedKmh) continue;
      targetSpeedKmh = allowedCurrentSpeedKmh;
      brakeDistanceM = distanceM;
    }
    return { targetSpeedKmh, brakeDistanceM };
  }

  private signedCurvatureAt(index: number, radiusM: number): number {
    const before = this.line[this.indexBehind(index, radiusM)];
    const current = this.line[index];
    const after = this.line[this.indexAhead(index, radiusM)];
    const incoming = horizontalDirection(before, current);
    const outgoing = horizontalDirection(current, after);
    return Math.atan2(
      incoming.x * outgoing.z - incoming.z * outgoing.x,
      incoming.x * outgoing.x + incoming.z * outgoing.z,
    );
  }

  private findNearestIndex(position: { readonly x: number; readonly z: number }) {
    let nearestIndex = this.nearestIndex;
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;
    for (let index = 0; index < this.line.length; index += 1) {
      const point = this.line[index];
      const deltaX = position.x - point.x;
      const deltaZ = position.z - point.z;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceSquared;
        nearestIndex = index;
      }
    }
    return nearestIndex;
  }

  private indexAhead(startIndex: number, distanceM: number): number {
    let index = startIndex;
    let remainingM = distanceM;
    for (let count = 0; count < this.line.length; count += 1) {
      const nextIndex = (index + 1) % this.line.length;
      const current = this.line[index];
      const next = this.line[nextIndex];
      const segmentLengthM = Math.hypot(
        next.x - current.x,
        next.z - current.z,
      );
      if (remainingM <= segmentLengthM) return nextIndex;
      remainingM -= segmentLengthM;
      index = nextIndex;
    }
    return index;
  }

  private indexBehind(startIndex: number, distanceM: number): number {
    let index = startIndex;
    let remainingM = distanceM;
    for (let count = 0; count < this.line.length; count += 1) {
      const previousIndex = (
        index - 1 + this.line.length
      ) % this.line.length;
      const current = this.line[index];
      const previous = this.line[previousIndex];
      const segmentLengthM = Math.hypot(
        current.x - previous.x,
        current.z - previous.z,
      );
      if (remainingM <= segmentLengthM) return previousIndex;
      remainingM -= segmentLengthM;
      index = previousIndex;
    }
    return index;
  }

  private speedForCurvature(angleRadians: number): number {
    const angleDegrees = angleRadians * 180 / Math.PI;
    if (angleDegrees > 56) return 50;
    if (angleDegrees > 38) return 68;
    if (angleDegrees > 24) return 88;
    if (angleDegrees > 13) return 112;
    if (angleDegrees > 6) return 146;
    return 220;
  }

  private closestObstacleAhead(
    position: { readonly x: number; readonly z: number },
    forward: { readonly x: number; readonly z: number },
    speedKmh: number,
    obstacles: readonly ApexAutonomousObstacle[],
  ): {
    readonly distanceM: number;
    readonly lateralM: number;
    readonly detectionRangeM: number;
  } | undefined {
    const right = { x: forward.z, z: -forward.x };
    const detectionRangeM = clamp(12 + speedKmh * 0.28, 12, 48);
    let closest: {
      distanceM: number;
      lateralM: number;
      detectionRangeM: number;
    } | undefined;
    for (const obstacle of obstacles) {
      const deltaX = obstacle.x - position.x;
      const deltaZ = obstacle.z - position.z;
      const forwardM = deltaX * forward.x + deltaZ * forward.z;
      if (forwardM <= 0 || forwardM > detectionRangeM) continue;
      const lateralM = deltaX * right.x + deltaZ * right.z;
      const avoidanceWidthM = 1.45 + (obstacle.radiusM ?? 1.15);
      if (Math.abs(lateralM) > avoidanceWidthM) continue;
      if (!closest || forwardM < closest.distanceM) {
        closest = {
          distanceM: forwardM,
          lateralM,
          detectionRangeM,
        };
      }
    }
    return closest;
  }
}
