import * as THREE from 'three/webgpu';
import type {
  ApexStaticColliderDescriptor,
  ApexStaticColliderGroup,
  ApexVector3Tuple,
} from '@jvsysarch/apex-physics';
import type { TrackPoint } from '../ApexTestTrack';
import type { ApexTrackRoadsideMode } from '../TrackRoadsideMode';
import {
  createTrackShoulderProfile,
  solveTrackShoulderConfluences,
  type TrackShoulderPoint,
} from '../TrackShoulderSystem';

export interface ApexTrackRoadsideCollisionOptions {
  readonly segmentId: string;
  readonly sourcePoints: readonly TrackPoint[];
  readonly sourcePointsAreUnique: boolean;
  readonly roadWidthM: number;
  readonly roadsideMode: ApexTrackRoadsideMode;
  readonly closed: boolean;
  readonly shoulderWidthM: number;
  readonly groundHeightM: number;
  readonly friction: number;
}

const roadsideOwnerId = (segmentId: string): string => (
  `track:${segmentId}:roadside`
);

export const apexTrackRoadsideCollisionOwnerId = (
  segmentId: string,
): string => roadsideOwnerId(segmentId.trim());

type TrianglePoint = ApexVector3Tuple;

const appendUpwardQuad = (
  vertices: ApexVector3Tuple[],
  indices: number[],
  first: TrianglePoint,
  second: TrianglePoint,
  third: TrianglePoint,
  fourth: TrianglePoint,
): void => {
  const edgeOneX = second[0] - first[0];
  const edgeOneZ = second[2] - first[2];
  const edgeTwoX = third[0] - first[0];
  const edgeTwoZ = third[2] - first[2];
  const normalY = edgeOneZ * edgeTwoX - edgeOneX * edgeTwoZ;
  const triangles = normalY >= 0
    ? [[first, second, third], [first, third, fourth]]
    : [[first, third, second], [first, fourth, third]];
  for (const triangle of triangles) {
    const baseIndex = vertices.length;
    vertices.push(...triangle);
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
  }
};

const asTuple = (point: TrackShoulderPoint): TrianglePoint => (
  [point.x, point.y, point.z]
);

const emptyGroup = (segmentId: string): ApexStaticColliderGroup => (
  Object.freeze({
    ownerId: roadsideOwnerId(segmentId),
    colliders: Object.freeze([]),
  })
);

/**
 * Describe la banquina o el terreno adaptativo sin crear objetos Jolt.
 *
 * Usa el mismo perfil y solver que el pipeline visual. Física recibe una única
 * malla estática continua mediante `ApexStaticWorldPort`.
 */
export const createApexTrackRoadsideCollisionGroup = (
  options: ApexTrackRoadsideCollisionOptions,
): ApexStaticColliderGroup => {
  const segmentId = options.segmentId.trim();
  if (!segmentId) {
    throw new Error('La colisión roadside requiere un segmentId');
  }
  if (options.roadsideMode === 'none') return emptyGroup(segmentId);

  const points = options.closed && !options.sourcePointsAreUnique
    ? options.sourcePoints.slice(0, -1)
    : options.sourcePoints;
  if (points.length < 2) return emptyGroup(segmentId);

  const lastUniqueIndex = points.length - 1;
  const rings = points.map((point, index) => {
    const previous = points[
      options.closed
        ? (index - 1 + points.length) % points.length
        : Math.max(0, index - 1)
    ];
    const next = points[
      options.closed
        ? (index + 1) % points.length
        : Math.min(points.length - 1, index + 1)
    ];
    const center = new THREE.Vector3(point.x, point.y, point.z);
    const forward = new THREE.Vector3(
      next.x - previous.x,
      next.y - previous.y,
      next.z - previous.z,
    ).normalize();
    const horizontalLeft = new THREE.Vector3(
      -forward.z,
      0,
      forward.x,
    ).normalize();
    const bankedLeft = horizontalLeft.clone().applyAxisAngle(
      forward,
      point.bankRadians,
    );
    const innerOffset = options.roadWidthM / 2;
    const innerLeft = center.clone().addScaledVector(
      bankedLeft,
      innerOffset,
    );
    const innerRight = center.clone().addScaledVector(
      bankedLeft,
      -innerOffset,
    );
    return createTrackShoulderProfile({
      center,
      innerLeft,
      innerRight,
      horizontalLeftX: horizontalLeft.x,
      horizontalLeftZ: horizontalLeft.z,
      roadWidthM: options.roadWidthM,
      shoulderWidthM: options.shoulderWidthM,
      groundHeightM: options.groundHeightM,
      progress: index / Math.max(1, lastUniqueIndex),
    });
  });

  const shoulderDistancesM: number[] = [];
  let shoulderDistanceM = 0;
  points.forEach((point, index) => {
    if (index > 0) {
      const previous = points[index - 1];
      shoulderDistanceM += Math.hypot(
        point.x - previous.x,
        point.y - previous.y,
        point.z - previous.z,
      );
    }
    shoulderDistancesM.push(shoulderDistanceM);
  });

  const shoulderConfluence = options.roadsideMode === 'adaptive-terrain'
    ? solveTrackShoulderConfluences(
      points.map((point, index) => ({
        center: point,
        innerLeft: rings[index].left[0],
        innerRight: rings[index].right[0],
        profile: rings[index],
        distanceM: shoulderDistancesM[index],
      })),
      options.roadWidthM,
      {
        closed: options.closed,
      },
    )
    : {
      profiles: rings,
      masks: rings.map(() => ({
        left: [true, true, true, true, true],
        right: [true, true, true, true, true],
      })),
    };
  const confluenceRings = options.closed
    ? [...shoulderConfluence.profiles, shoulderConfluence.profiles[0]]
    : [...shoulderConfluence.profiles];
  const vertices: ApexVector3Tuple[] = [];
  const indices: number[] = [];
  const segmentCount = options.closed ? points.length : points.length - 1;

  for (let index = 0; index < segmentCount; index += 1) {
    const current = confluenceRings[index];
    const next = confluenceRings[index + 1];
    for (const side of ['left', 'right'] as const) {
      for (let stage = 0; stage < current[side].length - 1; stage += 1) {
        if (options.roadsideMode === 'shoulder' && stage !== 0) continue;
        const nextIndex = (index + 1) % points.length;
        if (
          !shoulderConfluence.masks[index][side][stage]
          || !shoulderConfluence.masks[nextIndex][side][stage]
        ) continue;
        appendUpwardQuad(
          vertices,
          indices,
          asTuple(current[side][stage]),
          asTuple(next[side][stage]),
          asTuple(next[side][stage + 1]),
          asTuple(current[side][stage + 1]),
        );
      }
    }
  }

  if (indices.length === 0) return emptyGroup(segmentId);
  const collider: ApexStaticColliderDescriptor = Object.freeze({
    kind: 'triangle-mesh',
    id: `${roadsideOwnerId(segmentId)}:mesh`,
    surface: 'grass',
    friction: options.friction,
    restitution: 0,
    vertices: Object.freeze(vertices),
    indices: Object.freeze(indices),
    activeEdgeCosThresholdAngle: Math.cos(THREE.MathUtils.degToRad(20)),
  });
  return Object.freeze({
    ownerId: roadsideOwnerId(segmentId),
    colliders: Object.freeze([collider]),
  });
};
