import * as THREE from 'three/webgpu';
import type { SurfaceId } from '@jvsysarch/apex-physics';
import {
  ACTIVE_TRACK,
  ACTIVE_TRACK_PRIMARY_SEGMENT,
  ACTIVE_TRACK_IS_CLOSED,
  ACTIVE_TRACK_LANE_COUNT,
  ACTIVE_TRACK_POINTS,
  ACTIVE_TRACK_WORLD_SIZE_M,
} from './ActiveTrack';
import { CIRCUITO_CHALLHUACO_ID } from './ChallhuacoTrack';
import { createTrackSafetySystem } from './TrackSafetySystem';

export interface TrackPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly bankRadians: number;
  readonly surface?: SurfaceId;
}

export interface TrackSegment {
  readonly start: TrackPoint;
  readonly end: TrackPoint;
  readonly bankRadians: number;
  readonly surface: SurfaceId;
}

export const TEST_TRACK_WIDTH_M = (
  ACTIVE_TRACK_PRIMARY_SEGMENT?.geometry.roadWidthM
  ?? ACTIVE_TRACK.configuration.geometry.roadWidthM
);
export const TEST_TRACK_THICKNESS_M = (
  ACTIVE_TRACK.configuration.geometry.roadThicknessM
);
export const TEST_TRACK_BASE_HEIGHT_M = (
  ACTIVE_TRACK.configuration.start.position.y
);
export const TEST_TRACK_MAX_BANK_DEGREES = (
  ACTIVE_TRACK.track.id === 'autopista-cumbre'
    ? 5.5
    : ACTIVE_TRACK.track.id === CIRCUITO_CHALLHUACO_ID ? 0
    : 7
);
export const TEST_TRACK_SHOULDER_WIDTH_M = (
  ACTIVE_TRACK.configuration.geometry.shoulderWidthM
);
export const TEST_TRACK_SHOULDER_CROSSFALL = 0.035;
export const TEST_TRACK_GROUND_HEIGHT_M = (
  ACTIVE_TRACK.configuration.geometry.groundHeightM
);
export const TEST_TRACK_WORLD_SIZE_M = ACTIVE_TRACK_WORLD_SIZE_M;
export const TEST_TRACK_LANE_COUNT = ACTIVE_TRACK_LANE_COUNT;
export const TEST_TRACK_IS_CLOSED = ACTIVE_TRACK_IS_CLOSED;

const MAX_BANK_RADIANS = THREE_DEGREES_TO_RADIANS(TEST_TRACK_MAX_BANK_DEGREES);
const BANK_REFERENCE_SPEED_MPS = 25;
const BANK_STRENGTH = 0.32;
const GRAVITY_MPS2 = 9.81;
const UNIQUE_TRACK_POINTS = ACTIVE_TRACK_IS_CLOSED
  ? ACTIVE_TRACK_POINTS.slice(0, -1)
  : ACTIVE_TRACK_POINTS;

function THREE_DEGREES_TO_RADIANS(degrees: number): number {
  return degrees * Math.PI / 180;
}

const segmentLengths = UNIQUE_TRACK_POINTS
  .slice(0, ACTIVE_TRACK_IS_CLOSED ? undefined : -1)
  .map((point, index) => {
    const next = UNIQUE_TRACK_POINTS[
      ACTIVE_TRACK_IS_CLOSED
        ? (index + 1) % UNIQUE_TRACK_POINTS.length
        : index + 1
    ];
    return Math.hypot(next.x - point.x, next.z - point.z);
  });
const totalTrackLengthM = segmentLengths.reduce((sum, length) => sum + length, 0);
const trackProgress: number[] = [];
let accumulatedDistanceM = 0;
for (let index = 0; index < UNIQUE_TRACK_POINTS.length; index += 1) {
  trackProgress.push(accumulatedDistanceM / totalTrackLengthM);
  accumulatedDistanceM += segmentLengths[index] ?? 0;
}

const smoothHill = (
  progress: number,
  startProgress: number,
  endProgress: number,
  heightM: number,
): number => {
  if (progress <= startProgress || progress >= endProgress) return 0;
  const phase = (progress - startProgress) / (endProgress - startProgress);
  return heightM * Math.sin(Math.PI * phase) ** 2;
};

const smoothStep = (start: number, end: number, value: number): number => {
  const phase = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return phase * phase * (3 - 2 * phase);
};

// La primera horquilla termina cerca del 48 % de la vuelta. Rebajar de forma
// progresiva esa salida evita que coincidan la subida y el máximo peralte.
const firstHairpinExitRelief = (progress: number): number => (
  smoothStep(0.42, 0.46, progress)
  * (1 - smoothStep(0.51, 0.56, progress))
);
const activeHairpinExitRelief = (progress: number): number => (
  ACTIVE_TRACK.track.id === 'circuit-bravo'
    ? firstHairpinExitRelief(progress)
    : 0
);

const elevationAtProgress = (progress: number): number => {
  if (ACTIVE_TRACK.track.id === 'autopista-cumbre') {
    return (
      TEST_TRACK_BASE_HEIGHT_M
      + smoothHill(progress, 0.04, 0.30, 18)
      + smoothHill(progress, 0.27, 0.60, 34)
      + smoothHill(progress, 0.58, 0.84, 24)
      + smoothHill(progress, 0.82, 0.98, 8)
    );
  }
  return (
    TEST_TRACK_BASE_HEIGHT_M
    + smoothHill(progress, 0.08, 0.30, 4.2)
    + smoothHill(progress, 0.39, 0.70, 6.8)
      * (1 - firstHairpinExitRelief(progress) * 0.28)
    + smoothHill(progress, 0.74, 0.93, 3.6)
  );
};

const unclampedBankRadians = UNIQUE_TRACK_POINTS.map((point, index) => {
  if (
    !ACTIVE_TRACK_IS_CLOSED
    && (index === 0 || index === UNIQUE_TRACK_POINTS.length - 1)
  ) return 0;
  const previous = UNIQUE_TRACK_POINTS[
    ACTIVE_TRACK_IS_CLOSED
      ? (index - 1 + UNIQUE_TRACK_POINTS.length) % UNIQUE_TRACK_POINTS.length
      : index - 1
  ];
  const next = UNIQUE_TRACK_POINTS[
    ACTIVE_TRACK_IS_CLOSED
      ? (index + 1) % UNIQUE_TRACK_POINTS.length
      : index + 1
  ];
  const incomingLength = Math.hypot(point.x - previous.x, point.z - previous.z);
  const outgoingLength = Math.hypot(next.x - point.x, next.z - point.z);
  if (incomingLength <= 0 || outgoingLength <= 0) return 0;
  const incomingX = (point.x - previous.x) / incomingLength;
  const incomingZ = (point.z - previous.z) / incomingLength;
  const outgoingX = (next.x - point.x) / outgoingLength;
  const outgoingZ = (next.z - point.z) / outgoingLength;
  const signedTurn = Math.atan2(
    incomingZ * outgoingX - incomingX * outgoingZ,
    incomingX * outgoingX + incomingZ * outgoingZ,
  );
  const curvature = signedTurn / ((incomingLength + outgoingLength) * 0.5);
  const idealBank = -Math.atan(
    BANK_REFERENCE_SPEED_MPS ** 2 * curvature / GRAVITY_MPS2,
  ) * BANK_STRENGTH;
  return Math.max(-MAX_BANK_RADIANS, Math.min(MAX_BANK_RADIANS, idealBank));
});

// La captura original tiene separaciones irregulares entre puntos. Filtrar la
// curvatura evita cambios bruscos de peralte entre cajas contiguas de Jolt.
let smoothedBankRadians = unclampedBankRadians;
for (let pass = 0; pass < 6; pass += 1) {
  smoothedBankRadians = smoothedBankRadians.map((bank, index, banks) => {
    const previous = index === 0
      ? (ACTIVE_TRACK_IS_CLOSED ? banks[banks.length - 1] : bank)
      : banks[index - 1];
    const next = index === banks.length - 1
      ? (ACTIVE_TRACK_IS_CLOSED ? banks[0] : bank)
      : banks[index + 1];
    return previous * 0.25 + bank * 0.5 + next * 0.25;
  });
}

const bankAtPoint = smoothedBankRadians.map((bank, index) => {
  const progress = trackProgress[index];
  // Meta queda plana para que el cierre de la vuelta no forme un escalón.
  const seamFade = Math.min(1, progress / 0.04, (1 - progress) / 0.04);
  const hairpinExitScale = 1 - activeHairpinExitRelief(progress) * 0.42;
  return (
    bank
    * Math.max(0, seamFade)
    * hairpinExitScale
  );
});
const MAX_BANK_STEP_RADIANS = THREE_DEGREES_TO_RADIANS(0.45);
const MAX_BANK_RATE_RADIANS_PER_M = THREE_DEGREES_TO_RADIANS(0.055);
for (let pass = 0; pass < 5; pass += 1) {
  for (let index = 1; index < bankAtPoint.length; index += 1) {
    const allowedStep = Math.min(
      MAX_BANK_STEP_RADIANS,
      MAX_BANK_RATE_RADIANS_PER_M * segmentLengths[index - 1],
    );
    bankAtPoint[index] = Math.max(
      bankAtPoint[index - 1] - allowedStep,
      Math.min(bankAtPoint[index - 1] + allowedStep, bankAtPoint[index]),
    );
  }
  const seamAllowedStep = Math.min(
    MAX_BANK_STEP_RADIANS,
    MAX_BANK_RATE_RADIANS_PER_M * segmentLengths[segmentLengths.length - 1],
  );
  bankAtPoint[bankAtPoint.length - 1] = Math.max(
    -seamAllowedStep,
    Math.min(seamAllowedStep, bankAtPoint[bankAtPoint.length - 1]),
  );
  for (let index = bankAtPoint.length - 2; index >= 0; index -= 1) {
    const allowedStep = Math.min(
      MAX_BANK_STEP_RADIANS,
      MAX_BANK_RATE_RADIANS_PER_M * segmentLengths[index],
    );
    bankAtPoint[index] = Math.max(
      bankAtPoint[index + 1] - allowedStep,
      Math.min(bankAtPoint[index + 1] + allowedStep, bankAtPoint[index]),
    );
  }
  bankAtPoint[0] = 0;
}
if (ACTIVE_TRACK_PRIMARY_SEGMENT) {
  UNIQUE_TRACK_POINTS.forEach((point, index) => {
    bankAtPoint[index] = point.bankRadians ?? 0;
  });
}

const centerlineHeightAtPoint = (index: number): number => (
  (UNIQUE_TRACK_POINTS[index].y ?? elevationAtProgress(trackProgress[index]))
  + (
    ACTIVE_TRACK_PRIMARY_SEGMENT
      ? 0
      : TEST_TRACK_WIDTH_M * 0.5 * Math.sin(Math.abs(bankAtPoint[index]))
  )
);
const ACTIVE_TRACK_ROAD_SURFACE = (
  ACTIVE_TRACK.configuration.surfaces.road as SurfaceId
);

const testTrackElevations = trackProgress.map(
  (_, index) => centerlineHeightAtPoint(index),
);
export const TEST_TRACK_MAX_ELEVATION_M = ACTIVE_TRACK_IS_CLOSED
  ? Math.max(...testTrackElevations) - TEST_TRACK_BASE_HEIGHT_M
  : Math.max(...testTrackElevations) - Math.min(...testTrackElevations);
export const TEST_TRACK_ACTUAL_MAX_BANK_DEGREES = Math.max(
  ...bankAtPoint.map(bank => Math.abs(bank)),
) * 180 / Math.PI;

export const trackBankRadiansAt = (progress: number): number => {
  const wrappedProgress = ((progress % 1) + 1) % 1;
  let upperIndex = trackProgress.findIndex(value => value > wrappedProgress);
  if (upperIndex < 0) {
    const lowerIndex = trackProgress.length - 1;
    const span = 1 - trackProgress[lowerIndex];
    const mix = span > 0 ? (wrappedProgress - trackProgress[lowerIndex]) / span : 0;
    return bankAtPoint[lowerIndex] * (1 - mix);
  }
  if (upperIndex === 0) return bankAtPoint[0];
  const lowerIndex = upperIndex - 1;
  const span = trackProgress[upperIndex] - trackProgress[lowerIndex];
  const mix = span > 0 ? (wrappedProgress - trackProgress[lowerIndex]) / span : 0;
  return bankAtPoint[lowerIndex]
    + (bankAtPoint[upperIndex] - bankAtPoint[lowerIndex]) * mix;
};

export const TEST_TRACK_POINTS: readonly TrackPoint[] = Object.freeze(
  [
    ...UNIQUE_TRACK_POINTS.map((point, index) => Object.freeze({
      x: point.x,
      y: centerlineHeightAtPoint(index),
      z: point.z,
      bankRadians: bankAtPoint[index],
      surface: (
        point.surface as SurfaceId | undefined
        ?? ACTIVE_TRACK_ROAD_SURFACE
      ),
    })),
    ...(ACTIVE_TRACK_IS_CLOSED ? [Object.freeze({
      x: UNIQUE_TRACK_POINTS[0].x,
      y: ACTIVE_TRACK_PRIMARY_SEGMENT
        ? centerlineHeightAtPoint(0)
        : TEST_TRACK_BASE_HEIGHT_M,
      z: UNIQUE_TRACK_POINTS[0].z,
      bankRadians: ACTIVE_TRACK_PRIMARY_SEGMENT ? bankAtPoint[0] : 0,
      surface: (
        UNIQUE_TRACK_POINTS[0].surface as SurfaceId | undefined
        ?? ACTIVE_TRACK_ROAD_SURFACE
      ),
    })] : []),
  ].map(point => Object.freeze({
    x: point.x,
    y: point.y,
    z: point.z,
    bankRadians: point.bankRadians,
    surface: point.surface,
  })),
);

export const TEST_TRACK_SEGMENTS: readonly TrackSegment[] = Object.freeze(
  TEST_TRACK_POINTS.slice(0, -1).map((start, index) => Object.freeze({
    start,
    end: TEST_TRACK_POINTS[index + 1],
    bankRadians: (start.bankRadians + TEST_TRACK_POINTS[index + 1].bankRadians) * 0.5,
    surface: start.surface ?? 'asphalt',
  })),
);

const testTrackSplineControls = (
  ACTIVE_TRACK_IS_CLOSED ? TEST_TRACK_POINTS.slice(0, -1) : TEST_TRACK_POINTS
)
  .map(point => new THREE.Vector3(point.x, point.y, point.z));
export const TEST_TRACK_CURVE = new THREE.CatmullRomCurve3(
  testTrackSplineControls,
  ACTIVE_TRACK_IS_CLOSED,
  'centripetal',
  0.5,
);
export const TEST_TRACK_SPLINE_SPACING_M = TEST_TRACK_LANE_COUNT === 3 ? 3 : 2;
export const TEST_TRACK_SPLINE_SAMPLE_COUNT = ACTIVE_TRACK_PRIMARY_SEGMENT
  ? testTrackSplineControls.length
  : Math.max(
    360,
    Math.ceil(TEST_TRACK_CURVE.getLength() / TEST_TRACK_SPLINE_SPACING_M),
  );
export const TEST_TRACK_SPLINE_POINTS: readonly TrackPoint[] = Object.freeze(
  ACTIVE_TRACK_PRIMARY_SEGMENT
    ? (
      ACTIVE_TRACK_IS_CLOSED
        ? TEST_TRACK_POINTS.slice(0, -1)
        : [...TEST_TRACK_POINTS]
    )
    : (
      ACTIVE_TRACK_IS_CLOSED
        ? TEST_TRACK_CURVE
          .getSpacedPoints(TEST_TRACK_SPLINE_SAMPLE_COUNT)
          .slice(0, -1)
        : TEST_TRACK_CURVE.getSpacedPoints(TEST_TRACK_SPLINE_SAMPLE_COUNT)
    ).map((point, index) => Object.freeze({
      x: point.x,
      y: point.y,
      z: point.z,
      bankRadians: trackBankRadiansAt(
        index / TEST_TRACK_SPLINE_SAMPLE_COUNT,
      ),
      surface: ACTIVE_TRACK_ROAD_SURFACE,
    })),
);

export const TEST_TRACK_SAFETY = ACTIVE_TRACK_IS_CLOSED
  ? createTrackSafetySystem({
    points: TEST_TRACK_SPLINE_POINTS,
    roadWidthM: TEST_TRACK_WIDTH_M,
    groundHeightM: TEST_TRACK_GROUND_HEIGHT_M,
    leadDistanceM: TEST_TRACK_LANE_COUNT === 3 ? 120 : 45,
    maximumProtectedCurveRadiusM: TEST_TRACK_LANE_COUNT === 3 ? 520 : 260,
    elevatedGuardrailThresholdM: TEST_TRACK_LANE_COUNT === 3 ? 3 : undefined,
  })
  : Object.freeze({
    segments: Object.freeze([]),
    sections: Object.freeze([]),
    protectedLengthM: 0,
    arrowLengthM: 0,
    orientationErrorCount: 0,
    maximumJoinGapM: 0,
  });
