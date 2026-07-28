import * as THREE from 'three/webgpu';
import type {
  ApexStaticColliderDescriptor,
  ApexStaticColliderGroup,
  ApexVector3Tuple,
} from '@jvsysarch/apex-physics';
import type { TrackPoint } from '../ApexTestTrack';
import {
  TRACK_GUARDRAIL_COLLIDER_DEPTH_M,
  TRACK_GUARDRAIL_COLLIDER_HEIGHT_M,
  TRACK_GUARDRAIL_THICKNESS_M,
} from '../TrackSafetySystem';

interface ApexTrackCollisionRing {
  readonly left: THREE.Vector3;
  readonly right: THREE.Vector3;
}

export interface ApexTrackSurfaceCollisionOptions {
  readonly segmentId: string;
  readonly sourcePoints: readonly TrackPoint[];
  readonly sourcePointsAreUnique: boolean;
  readonly roadWidthM: number;
  readonly roadThicknessM: number;
  readonly closed: boolean;
  readonly withBoundaryWalls: boolean;
  readonly wallFriction: number;
}

const surfaceOwnerId = (segmentId: string): string => (
  `track:${segmentId}:surface-and-walls`
);

export const apexTrackSurfaceCollisionOwnerId = (
  segmentId: string,
): string => surfaceOwnerId(segmentId.trim());

const createRings = (
  points: readonly TrackPoint[],
  roadWidthM: number,
  closed: boolean,
): readonly ApexTrackCollisionRing[] => points.map((point, index) => {
  const previous = points[
    closed
      ? (index - 1 + points.length) % points.length
      : Math.max(0, index - 1)
  ];
  const next = points[
    closed
      ? (index + 1) % points.length
      : Math.min(points.length - 1, index + 1)
  ];
  const center = new THREE.Vector3(point.x, point.y, point.z);
  const forward = new THREE.Vector3(
    next.x - previous.x,
    next.y - previous.y,
    next.z - previous.z,
  ).normalize();
  const left = new THREE.Vector3(-forward.z, 0, forward.x)
    .normalize()
    .applyAxisAngle(forward, point.bankRadians);
  return {
    left: center.clone().addScaledVector(left, roadWidthM / 2),
    right: center.clone().addScaledVector(left, -roadWidthM / 2),
  };
});

const createRoadColliders = (
  segmentId: string,
  points: readonly TrackPoint[],
  rings: readonly ApexTrackCollisionRing[],
  roadThicknessM: number,
  closed: boolean,
): readonly ApexStaticColliderDescriptor[] => {
  const segmentCount = closed ? points.length : points.length - 1;
  return Object.freeze(
    Array.from({ length: segmentCount }, (_, index) => {
      const current = rings[index];
      const next = rings[(index + 1) % rings.length];
      const topCorners = [
        current.left,
        current.right,
        next.left,
        next.right,
      ];
      const points3d: ApexVector3Tuple[] = [];
      for (const corner of topCorners) {
        points3d.push([corner.x, corner.y, corner.z]);
      }
      for (const corner of topCorners) {
        points3d.push([
          corner.x,
          corner.y - roadThicknessM,
          corner.z,
        ]);
      }
      return Object.freeze({
        kind: 'convex-hull' as const,
        id: `${surfaceOwnerId(segmentId)}:road:${index}`,
        surface: points[index].surface ?? 'asphalt',
        restitution: 0,
        points: Object.freeze(points3d),
        convexRadiusM: 0.015,
      });
    }),
  );
};

type TrianglePoint = ApexVector3Tuple;

const appendOrientedQuad = (
  vertices: ApexVector3Tuple[],
  indices: number[],
  first: TrianglePoint,
  second: TrianglePoint,
  third: TrianglePoint,
  fourth: TrianglePoint,
  desiredNormal: TrianglePoint,
): void => {
  const edgeOne = [
    second[0] - first[0],
    second[1] - first[1],
    second[2] - first[2],
  ] as const;
  const edgeTwo = [
    third[0] - first[0],
    third[1] - first[1],
    third[2] - first[2],
  ] as const;
  const normal = [
    edgeOne[1] * edgeTwo[2] - edgeOne[2] * edgeTwo[1],
    edgeOne[2] * edgeTwo[0] - edgeOne[0] * edgeTwo[2],
    edgeOne[0] * edgeTwo[1] - edgeOne[1] * edgeTwo[0],
  ] as const;
  const alignment = (
    normal[0] * desiredNormal[0]
    + normal[1] * desiredNormal[1]
    + normal[2] * desiredNormal[2]
  );
  const triangles = alignment >= 0
    ? [[first, second, third], [first, third, fourth]]
    : [[first, third, second], [first, fourth, third]];
  for (const triangle of triangles) {
    const baseIndex = vertices.length;
    vertices.push(...triangle);
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
  }
};

const createBoundaryWallsCollider = (
  segmentId: string,
  rings: readonly ApexTrackCollisionRing[],
  closed: boolean,
  wallFriction: number,
): ApexStaticColliderDescriptor | undefined => {
  if (rings.length < 2) return undefined;
  const vertices: ApexVector3Tuple[] = [];
  const indices: number[] = [];
  const segmentCount = closed ? rings.length : rings.length - 1;

  for (const side of ['left', 'right'] as const) {
    const frames = rings.map(ring => {
      const inner = ring[side];
      const opposite = side === 'left' ? ring.right : ring.left;
      const outwardX = inner.x - opposite.x;
      const outwardZ = inner.z - opposite.z;
      const outwardLength = Math.hypot(outwardX, outwardZ) || 1;
      const unitOutwardX = outwardX / outwardLength;
      const unitOutwardZ = outwardZ / outwardLength;
      const outerX = (
        inner.x + unitOutwardX * TRACK_GUARDRAIL_THICKNESS_M
      );
      const outerZ = (
        inner.z + unitOutwardZ * TRACK_GUARDRAIL_THICKNESS_M
      );
      const baseY = inner.y - TRACK_GUARDRAIL_COLLIDER_DEPTH_M;
      const topY = inner.y + TRACK_GUARDRAIL_COLLIDER_HEIGHT_M;
      return {
        outward: [unitOutwardX, 0, unitOutwardZ] as TrianglePoint,
        innerBase: [inner.x, baseY, inner.z] as TrianglePoint,
        innerTop: [inner.x, topY, inner.z] as TrianglePoint,
        outerBase: [outerX, baseY, outerZ] as TrianglePoint,
        outerTop: [outerX, topY, outerZ] as TrianglePoint,
      };
    });
    for (let index = 0; index < segmentCount; index += 1) {
      const current = frames[index];
      const next = frames[(index + 1) % frames.length];
      const outward = [
        current.outward[0] + next.outward[0],
        0,
        current.outward[2] + next.outward[2],
      ] as TrianglePoint;
      appendOrientedQuad(
        vertices,
        indices,
        current.innerBase,
        current.innerTop,
        next.innerTop,
        next.innerBase,
        [-outward[0], 0, -outward[2]],
      );
      appendOrientedQuad(
        vertices,
        indices,
        current.outerBase,
        next.outerBase,
        next.outerTop,
        current.outerTop,
        outward,
      );
      appendOrientedQuad(
        vertices,
        indices,
        current.innerTop,
        current.outerTop,
        next.outerTop,
        next.innerTop,
        [0, 1, 0],
      );
      appendOrientedQuad(
        vertices,
        indices,
        current.innerBase,
        next.innerBase,
        next.outerBase,
        current.outerBase,
        [0, -1, 0],
      );
    }
    if (!closed) {
      const first = frames[0];
      const second = frames[1];
      const last = frames[frames.length - 1];
      const beforeLast = frames[frames.length - 2];
      appendOrientedQuad(
        vertices,
        indices,
        first.innerBase,
        first.outerBase,
        first.outerTop,
        first.innerTop,
        [
          first.innerBase[0] - second.innerBase[0],
          0,
          first.innerBase[2] - second.innerBase[2],
        ],
      );
      appendOrientedQuad(
        vertices,
        indices,
        last.innerBase,
        last.innerTop,
        last.outerTop,
        last.outerBase,
        [
          last.innerBase[0] - beforeLast.innerBase[0],
          0,
          last.innerBase[2] - beforeLast.innerBase[2],
        ],
      );
    }
  }

  return Object.freeze({
    kind: 'triangle-mesh',
    id: `${surfaceOwnerId(segmentId)}:walls`,
    surface: 'asphalt',
    friction: wallFriction,
    restitution: 0,
    vertices: Object.freeze(vertices),
    indices: Object.freeze(indices),
    activeEdgeCosThresholdAngle: Math.cos(THREE.MathUtils.degToRad(12)),
  });
};

/**
 * Describe la calzada y sus walls sin crear objetos Jolt.
 *
 * Track conserva autoridad sobre geometría y ownership; el runtime físico sólo
 * materializa estos datos mediante `ApexStaticWorldPort`.
 */
export const createApexTrackSurfaceCollisionGroup = (
  options: ApexTrackSurfaceCollisionOptions,
): ApexStaticColliderGroup => {
  const segmentId = options.segmentId.trim();
  if (!segmentId) {
    throw new Error('La superficie de pista requiere un segmentId');
  }
  const points = options.closed && !options.sourcePointsAreUnique
    ? options.sourcePoints.slice(0, -1)
    : options.sourcePoints;
  if (points.length < 2) {
    return Object.freeze({
      ownerId: surfaceOwnerId(segmentId),
      colliders: Object.freeze([]),
    });
  }
  const rings = createRings(points, options.roadWidthM, options.closed);
  const colliders = [
    ...createRoadColliders(
      segmentId,
      points,
      rings,
      options.roadThicknessM,
      options.closed,
    ),
  ];
  if (options.withBoundaryWalls) {
    const walls = createBoundaryWallsCollider(
      segmentId,
      rings,
      options.closed,
      options.wallFriction,
    );
    if (walls) colliders.push(walls);
  }
  return Object.freeze({
    ownerId: surfaceOwnerId(segmentId),
    colliders: Object.freeze(colliders),
  });
};
