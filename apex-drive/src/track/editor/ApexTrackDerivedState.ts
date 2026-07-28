import * as THREE from 'three/webgpu';
import type {
  ApexVehicleSpawn,
} from '@jvsysarch/apex-physics';
import type { LapGate } from '../../race/ApexLapTimer';
import {
  createApexRacingLinePlan,
  type ApexRacingLinePlan,
} from '../../race/ApexRacingLinePlanner';
import type {
  RacingLineFrame,
  RacingLinePoint,
} from '../../race/ApexRacingLineLearner';
import type { TrackPoint } from '../ApexTestTrack';
import type { ApexTrackBoundaryMode } from '../TrackBoundaryMode';
import type { ApexTrackRoadsideMode } from '../TrackRoadsideMode';
import {
  createTrackSafetySystem,
  type TrackSafetySystem,
} from '../TrackSafetySystem';

export interface ApexTrackDerivedTiming {
  readonly startRadiusM: number;
  readonly checkpointRadiusM: number;
  readonly checkpointSpacingM: number;
  readonly ignoredTailDistanceM: number;
}

export interface ApexTrackDerivedConfiguration {
  readonly points: readonly TrackPoint[];
  readonly roadWidthM: number;
  readonly boundaryMode: ApexTrackBoundaryMode;
  readonly roadsideMode: ApexTrackRoadsideMode;
  readonly closed: boolean;
  readonly groundHeightM: number;
  readonly shoulderWidthM: number;
  readonly laneCount: number;
  readonly timing: ApexTrackDerivedTiming;
}

export interface ApexTrackDerivedState {
  readonly points: readonly TrackPoint[];
  readonly roadWidthM: number;
  readonly boundaryMode: ApexTrackBoundaryMode;
  readonly roadsideMode: ApexTrackRoadsideMode;
  readonly closed: boolean;
  readonly groundHeightM: number;
  readonly shoulderWidthM: number;
  readonly distancesM: readonly number[];
  readonly lengthM: number;
  readonly frames: readonly RacingLineFrame[];
  readonly centerLine: readonly RacingLinePoint[];
  readonly racingPlan?: ApexRacingLinePlan;
  readonly safety: TrackSafetySystem;
  readonly spawn: ApexVehicleSpawn;
  readonly startGate: LapGate;
  readonly finishGate: LapGate;
  readonly checkpoints: readonly LapGate[];
}

const freezeVector = (vector: THREE.Vector3) => Object.freeze({
  x: vector.x,
  y: vector.y,
  z: vector.z,
});

export const createApexTrackDerivedState = (
  configuration: ApexTrackDerivedConfiguration,
): ApexTrackDerivedState => {
  const points = Object.freeze(configuration.points.map(point => (
    Object.freeze({ ...point })
  )));
  if (points.length < 2) {
    throw new Error('La regeneración de pista necesita al menos dos puntos');
  }

  const distancesM: number[] = [];
  let lengthM = 0;
  points.forEach((point, index) => {
    if (index > 0) {
      const previous = points[index - 1];
      lengthM += Math.hypot(
        point.x - previous.x,
        point.y - previous.y,
        point.z - previous.z,
      );
    }
    distancesM.push(lengthM);
  });
  if (configuration.closed) {
    const first = points[0];
    const last = points[points.length - 1];
    lengthM += Math.hypot(
      first.x - last.x,
      first.y - last.y,
      first.z - last.z,
    );
  }

  const frames = Object.freeze(points.map((point, index) => {
    const previous = points[
      configuration.closed
        ? (index - 1 + points.length) % points.length
        : Math.max(0, index - 1)
    ];
    const next = points[
      configuration.closed
        ? (index + 1) % points.length
        : Math.min(points.length - 1, index + 1)
    ];
    const tangent = new THREE.Vector3(
      next.x - previous.x,
      next.y - previous.y,
      next.z - previous.z,
    ).normalize();
    const horizontalLateral = new THREE.Vector3(
      -tangent.z,
      0,
      tangent.x,
    ).normalize();
    const surfaceLateral = horizontalLateral.clone().applyAxisAngle(
      tangent,
      point.bankRadians,
    );
    const surfaceUp = surfaceLateral.clone().cross(tangent).normalize();
    return Object.freeze({
      center: Object.freeze({ x: point.x, y: point.y, z: point.z }),
      horizontalLateral: freezeVector(horizontalLateral),
      surfaceLateral: freezeVector(surfaceLateral),
      surfaceUp: freezeVector(surfaceUp),
    });
  }));
  const frozenDistancesM = Object.freeze(distancesM);
  const centerLine = Object.freeze(points.map((point, index) => Object.freeze({
    x: point.x,
    y: point.y,
    z: point.z,
    distanceM: frozenDistancesM[index],
  })));
  const racingPlan = points.length >= 3
    ? createApexRacingLinePlan({
      frames,
      distancesM: frozenDistancesM,
      trackHalfWidthM: configuration.roadWidthM * 0.5,
      closed: configuration.closed,
      safetyMarginM: configuration.laneCount === 3 ? 1.35 : 1.05,
      maximumSpeedKmh: configuration.laneCount === 3 ? 310 : 245,
      maximumLateralAccelerationMps2: 11.95,
      maximumAccelerationMps2: 5.8,
      maximumBrakingMps2: 10.2,
      guidanceCurveRadiusM: configuration.laneCount === 3 ? 620 : 420,
    })
    : undefined;

  const safety = createTrackSafetySystem({
    points,
    roadWidthM: configuration.roadWidthM,
    groundHeightM: configuration.groundHeightM,
    closed: configuration.closed,
    leadDistanceM: configuration.laneCount === 3 ? 120 : 45,
    maximumProtectedCurveRadiusM: configuration.laneCount === 3 ? 520 : 260,
    elevatedGuardrailThresholdM: configuration.laneCount === 3 ? 3 : undefined,
  });

  const start = points[0];
  const next = points[1];
  const forwardX = next.x - start.x;
  const forwardZ = next.z - start.z;
  const forwardLength = Math.hypot(forwardX, forwardZ) || 1;
  const yawDegrees = Math.atan2(
    forwardX / forwardLength,
    forwardZ / forwardLength,
  ) * 180 / Math.PI;
  const spawn = Object.freeze({
    x: start.x,
    y: start.y + 0.78,
    z: start.z,
    yawDegrees,
  });
  const startGate = Object.freeze({
    x: start.x,
    z: start.z,
    radiusM: configuration.timing.startRadiusM,
    label: configuration.closed ? 'Salida / meta' : 'Salida',
  });
  const finishPoint = configuration.closed
    ? start
    : points[points.length - 1];
  const finishGate = Object.freeze({
    x: finishPoint.x,
    z: finishPoint.z,
    radiusM: configuration.timing.startRadiusM,
    label: configuration.closed ? 'Salida / meta' : 'Llegada',
  });
  const checkpoints: LapGate[] = [];
  const finalCheckpointDistanceM = Math.max(
    0,
    lengthM - configuration.timing.ignoredTailDistanceM,
  );
  let nextCheckpointDistanceM = configuration.timing.checkpointSpacingM;
  points.forEach((point, index) => {
    const distanceM = frozenDistancesM[index];
    if (
      index === 0
      || distanceM + 0.001 < nextCheckpointDistanceM
      || distanceM >= finalCheckpointDistanceM
    ) return;
    checkpoints.push(Object.freeze({
      x: point.x,
      z: point.z,
      radiusM: configuration.timing.checkpointRadiusM,
      label: `Control ${checkpoints.length + 1}`,
    }));
    nextCheckpointDistanceM += configuration.timing.checkpointSpacingM;
  });

  return Object.freeze({
    points,
    roadWidthM: configuration.roadWidthM,
    boundaryMode: configuration.boundaryMode,
    roadsideMode: configuration.roadsideMode,
    closed: configuration.closed,
    groundHeightM: configuration.groundHeightM,
    shoulderWidthM: configuration.shoulderWidthM,
    distancesM: frozenDistancesM,
    lengthM,
    frames,
    centerLine,
    racingPlan,
    safety,
    spawn,
    startGate,
    finishGate,
    checkpoints: Object.freeze(checkpoints),
  });
};
