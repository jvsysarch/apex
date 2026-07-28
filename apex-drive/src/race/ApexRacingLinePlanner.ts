import type {
  RacingLineFrame,
  RacingLinePoint,
  RacingLineVector,
} from './ApexRacingLineLearner';

export type RacingLineGuidanceAction =
  | 'none'
  | 'accelerate'
  | 'lift'
  | 'brake';

export interface ApexRacingLinePlanPoint extends RacingLinePoint {
  readonly offsetM: number;
  readonly tangent: RacingLineVector;
  readonly lateral: RacingLineVector;
  readonly surfaceUp: RacingLineVector;
  readonly curvaturePerM: number;
  readonly radiusM: number;
  readonly targetSpeedKmh: number;
  readonly throttle: number;
  readonly brake: number;
  readonly gear: number;
  readonly steeringAngleDegrees: number;
  readonly guidance: RacingLineGuidanceAction;
  readonly guidancePhase: number;
  readonly guidanceIntensity: number;
}

export interface ApexRacingLinePlan {
  readonly algorithm: 'projected-minimum-curvature-v1';
  readonly closed: boolean;
  readonly points: readonly ApexRacingLinePlanPoint[];
  readonly offsetsM: readonly number[];
  readonly trackLengthM: number;
  readonly maximumTargetSpeedKmh: number;
  readonly minimumTargetSpeedKmh: number;
  readonly maximumAbsoluteOffsetM: number;
  readonly guidanceCounts: Readonly<Record<RacingLineGuidanceAction, number>>;
}

export interface ApexRacingLineTrackIdentity {
  readonly number: number;
  readonly id: string;
  readonly version: string;
}

export interface ApexRacingLinePlannerConfiguration {
  readonly frames: readonly RacingLineFrame[];
  readonly distancesM: readonly number[];
  readonly trackHalfWidthM: number;
  readonly closed?: boolean;
  readonly safetyMarginM?: number;
  readonly iterations?: number;
  readonly relaxation?: number;
  readonly curvatureWindowM?: number;
  readonly maximumSpeedKmh?: number;
  readonly maximumLateralAccelerationMps2?: number;
  readonly maximumAccelerationMps2?: number;
  readonly maximumBrakingMps2?: number;
  readonly wheelbaseM?: number;
  readonly guidanceCurveRadiusM?: number;
}

const GRAVITY_MPS2 = 9.81;

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.max(minimum, Math.min(maximum, value))
);

const length = (vector: RacingLineVector): number => (
  Math.hypot(vector.x, vector.y, vector.z)
);

const normalized = (vector: RacingLineVector): RacingLineVector => {
  const magnitude = length(vector) || 1;
  return Object.freeze({
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude,
  });
};

const subtract = (
  end: RacingLineVector,
  start: RacingLineVector,
): RacingLineVector => ({
  x: end.x - start.x,
  y: end.y - start.y,
  z: end.z - start.z,
});

const dot = (a: RacingLineVector, b: RacingLineVector): number => (
  a.x * b.x + a.y * b.y + a.z * b.z
);

const pointAtOffset = (
  frame: RacingLineFrame,
  offsetM: number,
): RacingLineVector => Object.freeze({
  x: frame.center.x + frame.surfaceLateral.x * offsetM
    + frame.surfaceUp.x * 0.036,
  y: frame.center.y + frame.surfaceLateral.y * offsetM
    + frame.surfaceUp.y * 0.036,
  z: frame.center.z + frame.surfaceLateral.z * offsetM
    + frame.surfaceUp.z * 0.036,
});

const gearForSpeed = (speedKmh: number): number => {
  if (speedKmh < 52) return 1;
  if (speedKmh < 88) return 2;
  if (speedKmh < 128) return 3;
  if (speedKmh < 174) return 4;
  if (speedKmh < 226) return 5;
  return 6;
};

/**
 * Aproximación determinista de minimum curvature.
 *
 * Cada muestra es una puerta transversal. En cada iteración se proyecta el
 * punto medio de los vecinos sobre esa puerta y se limita al corredor seguro.
 * La relajación simultánea minimiza la segunda diferencia de la trayectoria
 * sin permitir que ningún punto abandone la pista.
 */
export const createApexRacingLinePlan = (
  configuration: ApexRacingLinePlannerConfiguration,
): ApexRacingLinePlan => {
  const { frames, distancesM } = configuration;
  if (frames.length < 3 || frames.length !== distancesM.length) {
    throw new Error('El planificador necesita al menos tres gates alineados');
  }

  const count = frames.length;
  const closed = configuration.closed ?? true;
  const neighbourIndex = (index: number): number => (
    closed
      ? (index + count) % count
      : Math.max(0, Math.min(count - 1, index))
  );
  const first = frames[0].center;
  const last = frames[count - 1].center;
  const closingDistanceM = length(subtract(first, last));
  const trackLengthM = distancesM[count - 1] + (
    closed ? closingDistanceM : 0
  );
  const averageSpacingM = trackLengthM / Math.max(1, count - (closed ? 0 : 1));
  const maximumOffsetM = Math.max(
    0,
    configuration.trackHalfWidthM - (configuration.safetyMarginM ?? 1.05),
  );
  const iterations = Math.max(1, Math.round(configuration.iterations ?? 84));
  const relaxation = clamp(configuration.relaxation ?? 0.44, 0.05, 0.9);
  let offsetsM = Array.from({ length: count }, () => 0);
  let points = frames.map(frame => pointAtOffset(frame, 0));

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const nextOffsets = offsetsM.map((offsetM, index) => {
      if (!closed && (index === 0 || index === count - 1)) return 0;
      const previous = points[neighbourIndex(index - 1)];
      const following = points[neighbourIndex(index + 1)];
      const midpoint = {
        x: (previous.x + following.x) * 0.5,
        y: (previous.y + following.y) * 0.5,
        z: (previous.z + following.z) * 0.5,
      };
      const projectedOffsetM = dot(
        subtract(midpoint, frames[index].center),
        frames[index].surfaceLateral,
      );
      return clamp(
        offsetM + (projectedOffsetM - offsetM) * relaxation,
        -maximumOffsetM,
        maximumOffsetM,
      );
    });
    offsetsM = nextOffsets;
    points = frames.map((frame, index) => pointAtOffset(frame, offsetsM[index]));
  }

  const curvatureWindowSamples = Math.max(
    1,
    Math.round((configuration.curvatureWindowM ?? 12) / averageSpacingM),
  );
  const curvatures = points.map((point, index) => {
    const before = points[neighbourIndex(index - curvatureWindowSamples)];
    const after = points[neighbourIndex(index + curvatureWindowSamples)];
    const aX = point.x - before.x;
    const aZ = point.z - before.z;
    const bX = after.x - before.x;
    const bZ = after.z - before.z;
    const cX = after.x - point.x;
    const cZ = after.z - point.z;
    const a = Math.hypot(aX, aZ);
    const b = Math.hypot(bX, bZ);
    const c = Math.hypot(cX, cZ);
    const denominator = a * b * c;
    return denominator > 0.0001
      ? 2 * (aX * bZ - aZ * bX) / denominator
      : 0;
  });

  const maximumSpeedMps = (configuration.maximumSpeedKmh ?? 280) / 3.6;
  const maximumLateralAccelerationMps2 = (
    configuration.maximumLateralAccelerationMps2 ?? GRAVITY_MPS2 * 1.22
  );
  const maximumAccelerationMps2 = configuration.maximumAccelerationMps2 ?? 5.8;
  const maximumBrakingMps2 = configuration.maximumBrakingMps2 ?? 10.2;
  const curveLimitedSpeedsMps = curvatures.map(curvature => (
    Math.min(
      maximumSpeedMps,
      Math.sqrt(
        maximumLateralAccelerationMps2 / Math.max(Math.abs(curvature), 0.000001),
      ),
    )
  ));
  const targetSpeedsMps = [...curveLimitedSpeedsMps];
  const segmentDistanceM = (index: number): number => {
    if (index === count - 1) {
      return closed
        ? closingDistanceM
        : Math.max(0.05, distancesM[index] - distancesM[index - 1]);
    }
    return Math.max(0.05, distancesM[index + 1] - distancesM[index]);
  };

  // Varias pasadas hacen converger las restricciones; sólo una pista cerrada
  // propaga la solución a través de salida/meta.
  for (let pass = 0; pass < 4; pass += 1) {
    for (let step = closed ? 0 : 1; step < count; step += 1) {
      const index = step;
      const previousIndex = neighbourIndex(index - 1);
      const previousDistanceM = segmentDistanceM(previousIndex);
      const reachableMps = Math.sqrt(
        targetSpeedsMps[previousIndex] ** 2
        + 2 * maximumAccelerationMps2 * previousDistanceM,
      );
      targetSpeedsMps[index] = Math.min(targetSpeedsMps[index], reachableMps);
    }
    for (
      let step = closed ? count - 1 : count - 2;
      step >= 0;
      step -= 1
    ) {
      const nextIndex = neighbourIndex(step + 1);
      const stoppableMps = Math.sqrt(
        targetSpeedsMps[nextIndex] ** 2
        + 2 * maximumBrakingMps2 * segmentDistanceM(step),
      );
      targetSpeedsMps[step] = Math.min(targetSpeedsMps[step], stoppableMps);
    }
  }

  const curveRadiusThresholdM = configuration.guidanceCurveRadiusM ?? 720;
  const dangerousCurveMask = curvatures.map(curvature => (
    Math.abs(curvature) > 1 / curveRadiusThresholdM
  ));
  const approachSamples = Math.max(1, Math.round(70 / averageSpacingM));
  const exitSamples = Math.max(1, Math.round(38 / averageSpacingM));
  const guidanceZoneMask = dangerousCurveMask.map((dangerous, index) => {
    if (dangerous) return true;
    for (let delta = 1; delta <= approachSamples; delta += 1) {
      const candidate = index + delta;
      if (closed || candidate < count) {
        if (dangerousCurveMask[neighbourIndex(candidate)]) return true;
      }
    }
    for (let delta = 1; delta <= exitSamples; delta += 1) {
      const candidate = index - delta;
      if (closed || candidate >= 0) {
        if (dangerousCurveMask[neighbourIndex(candidate)]) return true;
      }
    }
    return false;
  });
  const guidancePhases = Array.from({ length: count }, () => 0);
  const firstGapIndex = guidanceZoneMask.findIndex(active => !active);
  if (firstGapIndex < 0) {
    guidanceZoneMask.fill(false);
  } else if (!closed) {
    let run: number[] = [];
    const flushRun = () => {
      const denominator = Math.max(1, run.length - 1);
      run.forEach((index, position) => {
        guidancePhases[index] = position / denominator;
      });
      run = [];
    };
    guidanceZoneMask.forEach((active, index) => {
      if (active) run.push(index);
      else if (run.length > 0) flushRun();
    });
    if (run.length > 0) flushRun();
  } else {
    let run: number[] = [];
    const flushRun = () => {
      const denominator = Math.max(1, run.length - 1);
      run.forEach((index, position) => {
        guidancePhases[index] = position / denominator;
      });
      run = [];
    };
    for (let step = 1; step <= count; step += 1) {
      const index = (firstGapIndex + step) % count;
      if (guidanceZoneMask[index]) run.push(index);
      else if (run.length > 0) flushRun();
    }
    if (run.length > 0) flushRun();
  }

  const guidanceCounts: Record<RacingLineGuidanceAction, number> = {
    none: 0,
    accelerate: 0,
    lift: 0,
    brake: 0,
  };
  const wheelbaseM = configuration.wheelbaseM ?? 2.78;
  const planPoints = points.map((point, index): ApexRacingLinePlanPoint => {
    const nextIndex = neighbourIndex(index + 1);
    const previousIndex = neighbourIndex(index - 1);
    const distanceM = segmentDistanceM(index);
    const speedMps = targetSpeedsMps[index];
    const nextSpeedMps = targetSpeedsMps[nextIndex];
    const requiredAccelerationMps2 = (
      nextSpeedMps ** 2 - speedMps ** 2
    ) / (2 * distanceM);
    const throttle = requiredAccelerationMps2 > 0.08
      ? clamp(requiredAccelerationMps2 / maximumAccelerationMps2, 0, 1)
      : Math.abs(curvatures[index]) > 1 / curveRadiusThresholdM ? 0.16 : 0;
    const brake = requiredAccelerationMps2 < -0.08
      ? clamp(-requiredAccelerationMps2 / maximumBrakingMps2, 0, 1)
      : 0;
    const guidancePhase = guidancePhases[index];
    const fadeFraction = 0.28;
    const fadeIn = clamp(guidancePhase / fadeFraction, 0, 1);
    const fadeOut = clamp((1 - guidancePhase) / fadeFraction, 0, 1);
    const smoothFadeIn = fadeIn * fadeIn * (3 - 2 * fadeIn);
    const smoothFadeOut = fadeOut * fadeOut * (3 - 2 * fadeOut);
    const guidanceIntensity = guidanceZoneMask[index]
      ? smoothFadeIn * smoothFadeOut
      : 0;
    const guidance: RacingLineGuidanceAction = !guidanceZoneMask[index]
      ? 'none'
      : guidancePhase < 0.38
        ? 'brake'
        : guidancePhase < 0.7 ? 'lift' : 'accelerate';
    guidanceCounts[guidance] += 1;
    const tangent = normalized(subtract(points[nextIndex], points[previousIndex]));
    const curvature = curvatures[index];
    const targetSpeedKmh = speedMps * 3.6;
    return Object.freeze({
      x: point.x,
      y: point.y,
      z: point.z,
      distanceM: distancesM[index],
      offsetM: offsetsM[index],
      tangent,
      lateral: Object.freeze({ ...frames[index].surfaceLateral }),
      surfaceUp: Object.freeze({ ...frames[index].surfaceUp }),
      curvaturePerM: curvature,
      radiusM: Math.abs(curvature) > 0.000001
        ? 1 / Math.abs(curvature)
        : Number.POSITIVE_INFINITY,
      targetSpeedKmh,
      throttle,
      brake,
      gear: gearForSpeed(targetSpeedKmh),
      steeringAngleDegrees: Math.atan(wheelbaseM * curvature) * 180 / Math.PI,
      guidance,
      guidancePhase,
      guidanceIntensity,
    });
  });

  return Object.freeze({
    algorithm: 'projected-minimum-curvature-v1',
    closed,
    points: Object.freeze(planPoints),
    offsetsM: Object.freeze([...offsetsM]),
    trackLengthM,
    maximumTargetSpeedKmh: Math.max(...targetSpeedsMps) * 3.6,
    minimumTargetSpeedKmh: Math.min(...targetSpeedsMps) * 3.6,
    maximumAbsoluteOffsetM: Math.max(...offsetsM.map(Math.abs)),
    guidanceCounts: Object.freeze({ ...guidanceCounts }),
  });
};

export const createApexRacingLinePlanPayload = (
  plan: ApexRacingLinePlan,
  track: ApexRacingLineTrackIdentity,
  sampleSpacingM = 12,
): Readonly<Record<string, unknown>> => {
  let lastDistanceM = Number.NEGATIVE_INFINITY;
  const sampledPoints = plan.points.filter(point => {
    if (point.distanceM - lastDistanceM < sampleSpacingM) return false;
    lastDistanceM = point.distanceM;
    return true;
  });
  return Object.freeze({
    format: 'apex-drive-racing-plan',
    formatVersion: 1,
    algorithm: plan.algorithm,
    track: Object.freeze({ ...track }),
    sampleSpacingM,
    units: Object.freeze({
      distance: 'm',
      position: 'm',
      radius: 'm',
      speed: 'km/h',
      pedal: 'ratio-0-1',
      steering: 'degree',
    }),
    points: Object.freeze(sampledPoints.map(point => Object.freeze({
      distanceM: Number(point.distanceM.toFixed(3)),
      x: Number(point.x.toFixed(3)),
      y: Number(point.y.toFixed(3)),
      z: Number(point.z.toFixed(3)),
      lateralOffsetM: Number(point.offsetM.toFixed(3)),
      radiusM: Number.isFinite(point.radiusM)
        ? Number(point.radiusM.toFixed(2))
        : null,
      targetSpeedKmh: Number(point.targetSpeedKmh.toFixed(2)),
      throttle: Number(point.throttle.toFixed(3)),
      brake: Number(point.brake.toFixed(3)),
      gear: point.gear,
      steeringAngleDegrees: Number(point.steeringAngleDegrees.toFixed(3)),
      guidance: point.guidance,
      guidancePhase: Number(point.guidancePhase.toFixed(4)),
      guidanceIntensity: Number(point.guidanceIntensity.toFixed(4)),
    }))),
  });
};
