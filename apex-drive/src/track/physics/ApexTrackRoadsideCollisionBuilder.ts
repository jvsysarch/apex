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
  resolveTrackAdaptiveRoadHalfWidthsM,
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

const appendUpwardTriangle = (
  vertices: ApexVector3Tuple[],
  indices: number[],
  first: TrianglePoint,
  second: TrianglePoint,
  third: TrianglePoint,
): void => {
  const edgeOneX = second[0] - first[0];
  const edgeOneY = second[1] - first[1];
  const edgeOneZ = second[2] - first[2];
  const edgeTwoX = third[0] - first[0];
  const edgeTwoY = third[1] - first[1];
  const edgeTwoZ = third[2] - first[2];
  const normalX = edgeOneY * edgeTwoZ - edgeOneZ * edgeTwoY;
  const normalY = edgeOneZ * edgeTwoX - edgeOneX * edgeTwoZ;
  const normalZ = edgeOneX * edgeTwoY - edgeOneY * edgeTwoX;
  if (normalX * normalX + normalY * normalY + normalZ * normalZ <= 1e-8) return;
  const projectedNormalY = (
    (second[2] - first[2]) * (third[0] - first[0])
    - (second[0] - first[0]) * (third[2] - first[2])
  );
  const triangle = projectedNormalY >= 0 ? [first, second, third] : [first, third, second];
  const baseIndex = vertices.length;
  vertices.push(...triangle);
  indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
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
  const roadHalfWidthsM = options.roadsideMode === 'adaptive-terrain'
    ? resolveTrackAdaptiveRoadHalfWidthsM(
      points,
      options.roadWidthM,
      options.closed,
    )
    : points.map(() => options.roadWidthM * 0.5);
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
    const innerOffset = roadHalfWidthsM[index];
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
      roadWidthM: innerOffset * 2,
      shoulderWidthM: options.shoulderWidthM,
      groundHeightM: options.groundHeightM,
      progress: index / Math.max(1, lastUniqueIndex),
      adaptiveTerrain: options.roadsideMode === 'adaptive-terrain',
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
      adaptivePatches: [],
      interiorFills: [],
    };
  const confluenceRings = options.closed
    ? [...shoulderConfluence.profiles, shoulderConfluence.profiles[0]]
    : [...shoulderConfluence.profiles];
  const vertices: ApexVector3Tuple[] = [];
  const indices: number[] = [];
  const segmentCount = options.closed ? points.length : points.length - 1;
  const replacedSegments = {
    left: new Set<number>(),
    right: new Set<number>(),
  };
  for (const patch of shoulderConfluence.adaptivePatches) {
    patch.replacedSegmentIndices.forEach(index => replacedSegments[patch.side].add(index));
  }

  for (let index = 0; index < segmentCount; index += 1) {
    const current = confluenceRings[index];
    const next = confluenceRings[index + 1];
    for (const side of ['left', 'right'] as const) {
      if (replacedSegments[side].has(index)) continue;
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
  for (const patch of shoulderConfluence.adaptivePatches) {
    for (const triangle of patch.triangles) {
      appendUpwardTriangle(
        vertices,
        indices,
        asTuple(triangle.points[0]),
        asTuple(triangle.points[1]),
        asTuple(triangle.points[2]),
      );
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
