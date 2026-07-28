import * as THREE from 'three/webgpu';
import { CIRCUITO_VECTOR_TRACK } from './catalog/CircuitoVectorDefinition';

export interface CircuitoVectorPoint {
  readonly x: number;
  readonly z: number;
}

export const CIRCUITO_VECTOR_ID = CIRCUITO_VECTOR_TRACK.track.id;
export const CIRCUITO_VECTOR_WORLD_SIZE_M = 900;
export const CIRCUITO_VECTOR_SAMPLE_SPACING_M = 4;

const CONTROL_POINTS = [
  [0, -70],
  [0, -145],
  [12, -195],
  [58, -228],
  [118, -232],
  [174, -222],
  [208, -180],
  [214, -112],
  [210, -45],
  [196, 18],
  [160, 64],
  [105, 88],
  [48, 82],
  [5, 48],
  [-18, 12],
  [0, 0],
] as const;

const curve = new THREE.CatmullRomCurve3(
  CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  true,
  'centripetal',
  0.5,
);
const sampleCount = Math.max(
  CONTROL_POINTS.length * 8,
  Math.round(curve.getLength() / CIRCUITO_VECTOR_SAMPLE_SPACING_M),
);

export const CIRCUITO_VECTOR_POINTS: readonly CircuitoVectorPoint[] = (
  Object.freeze(curve.getSpacedPoints(sampleCount).map(point => Object.freeze({
    x: point.x,
    z: point.z,
  })))
);

export const CIRCUITO_VECTOR_DESIGN = Object.freeze({
  purpose: 'tire-and-suspension-development-loop',
  approximateLengthM: curve.getLength(),
  roadWidthM: CIRCUITO_VECTOR_TRACK.configuration.geometry.roadWidthM,
  obstacleStraightLengthM: 180,
  elevationRangeM: 11.5,
});
