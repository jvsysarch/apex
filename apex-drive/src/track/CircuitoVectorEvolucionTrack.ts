import * as THREE from 'three/webgpu';
import type { ApexDriveTrackDefinition } from './formats/ApexDriveTrack';
import {
  parseApexTrackSource,
  type ApexTrackSource,
  type ApexTrackSourcePoint,
} from './formats/ApexTrackSource';

export const CIRCUITO_VECTOR_EVOLUCION_ID = 'circuito-vector-evolucion';
export const CIRCUITO_VECTOR_EVOLUCION_WORLD_SIZE_M = 1_100;
export const CIRCUITO_VECTOR_EVOLUCION_SAMPLE_SPACING_M = 3.5;

type ControlTuple = readonly [
  x: number,
  y: number,
  z: number,
  bankRadians: number,
];

/**
 * Evolucion del concepto Vector: recta larga, horquilla compacta y una zona
 * de curva/contracurva. La separacion entre ramas deja espacio suficiente al
 * piso adaptativo para resolver cada talud sin mezclar influencias vecinas.
 */
const CONTROL_TUPLES: readonly ControlTuple[] = Object.freeze([
  [-80, 0.85, -220, 0.012],
  [-80, 1.25, -120, 0.010],
  [-80, 2.15, -20, 0.015],
  [-80, 3.25, 70, 0.030],
  [-60, 4.35, 115, 0.065],
  [-20, 5.15, 140, 0.090],
  [25, 5.50, 135, 0.105],
  [55, 5.30, 105, 0.110],
  [55, 4.90, 65, 0.100],
  [30, 4.35, 35, 0.075],
  [10, 3.75, -10, 0.040],
  [15, 3.15, -65, -0.035],
  [45, 2.90, -105, -0.065],
  [90, 3.35, -120, -0.075],
  [130, 4.20, -100, 0.055],
  [150, 5.05, -60, 0.075],
  [140, 5.80, -20, 0.070],
  [130, 6.30, 10, -0.045],
  [160, 6.55, 45, -0.020],
  [210, 6.25, 55, 0.045],
  [265, 5.50, 25, 0.075],
  [290, 4.55, -30, 0.090],
  [285, 3.45, -95, 0.090],
  [250, 2.45, -155, 0.080],
  [195, 1.65, -195, 0.060],
  [140, 1.05, -220, 0.040],
  [95, 0.65, -255, -0.035],
  [40, 0.40, -285, -0.070],
  [-20, 0.40, -295, -0.075],
  [-65, 0.55, -270, -0.045],
  [-82, 0.70, -250, -0.010],
]);

export const CIRCUITO_VECTOR_EVOLUCION_CONTROL_POINTS: readonly ApexTrackSourcePoint[] = (
  Object.freeze(CONTROL_TUPLES.map(([x, y, z, bankRadians]) => Object.freeze({
    x,
    y,
    z,
    bankRadians,
    surface: 'asphalt',
  })))
);

const curve = new THREE.CatmullRomCurve3(
  CONTROL_TUPLES.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  true,
  'centripetal',
  0.5,
);
const sampleCount = Math.max(
  CONTROL_TUPLES.length * 8,
  Math.round(
    curve.getLength() / CIRCUITO_VECTOR_EVOLUCION_SAMPLE_SPACING_M,
  ),
);
const smoothstep = (value: number): number => value * value * (3 - 2 * value);
const bankAtRouteProgress = (progress: number): number => {
  const controlProgress = progress * CONTROL_TUPLES.length;
  const index = Math.floor(controlProgress) % CONTROL_TUPLES.length;
  const nextIndex = (index + 1) % CONTROL_TUPLES.length;
  const blend = smoothstep(controlProgress - Math.floor(controlProgress));
  return THREE.MathUtils.lerp(
    CONTROL_TUPLES[index][3],
    CONTROL_TUPLES[nextIndex][3],
    blend,
  );
};

export const CIRCUITO_VECTOR_EVOLUCION_POINTS: readonly ApexTrackSourcePoint[] = (
  Object.freeze(curve.getSpacedPoints(sampleCount).slice(0, -1).map(
    (point, index) => Object.freeze({
      x: point.x,
      y: point.y,
      z: point.z,
      bankRadians: bankAtRouteProgress(index / sampleCount),
      surface: 'asphalt',
    }),
  ))
);

/**
 * Fuente editable de respaldo. Track Studio puede guardarla luego como V2,
 * pero la pista siempre dispone de una geometria comun para visual y colision.
 */
export const createCircuitoVectorEvolucionSource = (
  definition: ApexDriveTrackDefinition,
): ApexTrackSource => parseApexTrackSource({
  format: 'apex-track-source',
  formatVersion: 1,
  savedAtIso: '2026-08-02T00:00:00.000Z',
  track: definition.track,
  assets: definition.assets,
  configuration: definition.configuration,
  editor: {
    closed: true,
    controlSpacingM: 10,
    collisionSpacingM: CIRCUITO_VECTOR_EVOLUCION_SAMPLE_SPACING_M,
    simplificationToleranceM: 0.12,
  },
  controlPoints: CIRCUITO_VECTOR_EVOLUCION_CONTROL_POINTS,
  evaluatedPoints: CIRCUITO_VECTOR_EVOLUCION_POINTS,
});

export const CIRCUITO_VECTOR_EVOLUCION_DESIGN = Object.freeze({
  purpose: 'adaptive-floor-road-course',
  approximateLengthM: curve.getLength(),
  controlPointCount: CONTROL_TUPLES.length,
  sampleCount,
  elevationRangeM: 6.15,
});
