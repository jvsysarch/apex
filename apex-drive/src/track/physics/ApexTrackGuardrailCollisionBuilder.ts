import type {
  ApexStaticColliderDescriptor,
  ApexStaticColliderGroup,
  ApexVector3Tuple,
} from '@jvsysarch/apex-physics';
import {
  TRACK_GUARDRAIL_COLLIDER_DEPTH_M,
  TRACK_GUARDRAIL_COLLIDER_HEIGHT_M,
  TRACK_GUARDRAIL_THICKNESS_M,
  type TrackSafetyPosition,
  type TrackSafetySystem,
} from '../TrackSafetySystem';

export interface ApexTrackGuardrailCollisionOptions {
  readonly segmentId: string;
  readonly safety: TrackSafetySystem;
  readonly friction: number;
}

const guardrailOwnerId = (segmentId: string): string => (
  `track:${segmentId}:guardrails`
);

export const apexTrackGuardrailCollisionOwnerId = (
  segmentId: string,
): string => guardrailOwnerId(segmentId.trim());

type TrianglePoint = ApexVector3Tuple;

interface GuardrailFrame {
  readonly outward: TrianglePoint;
  readonly innerBase: TrianglePoint;
  readonly innerTop: TrianglePoint;
  readonly outerBase: TrianglePoint;
  readonly outerTop: TrianglePoint;
}

const frameAt = (
  point: TrackSafetyPosition,
  center: TrackSafetyPosition,
): GuardrailFrame => {
  const outwardX = point.x - center.x;
  const outwardZ = point.z - center.z;
  const outwardLength = Math.hypot(outwardX, outwardZ) || 1;
  const unitOutwardX = outwardX / outwardLength;
  const unitOutwardZ = outwardZ / outwardLength;
  const halfThicknessM = TRACK_GUARDRAIL_THICKNESS_M * 0.5;
  const baseY = point.y - TRACK_GUARDRAIL_COLLIDER_DEPTH_M;
  const topY = point.y + TRACK_GUARDRAIL_COLLIDER_HEIGHT_M;
  return {
    outward: [unitOutwardX, 0, unitOutwardZ],
    innerBase: [
      point.x - unitOutwardX * halfThicknessM,
      baseY,
      point.z - unitOutwardZ * halfThicknessM,
    ],
    innerTop: [
      point.x - unitOutwardX * halfThicknessM,
      topY,
      point.z - unitOutwardZ * halfThicknessM,
    ],
    outerBase: [
      point.x + unitOutwardX * halfThicknessM,
      baseY,
      point.z + unitOutwardZ * halfThicknessM,
    ],
    outerTop: [
      point.x + unitOutwardX * halfThicknessM,
      topY,
      point.z + unitOutwardZ * halfThicknessM,
    ],
  };
};

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

const emptyGroup = (segmentId: string): ApexStaticColliderGroup => (
  Object.freeze({
    ownerId: guardrailOwnerId(segmentId),
    colliders: Object.freeze([]),
  })
);

/**
 * Describe la cinta física continua del guardrail sin crear objetos Jolt.
 *
 * El visual galvanizado sigue siendo responsabilidad de render. Este builder
 * conserva únicamente la pared invisible alta y suave que contiene el auto.
 */
export const createApexTrackGuardrailCollisionGroup = (
  options: ApexTrackGuardrailCollisionOptions,
): ApexStaticColliderGroup => {
  const segmentId = options.segmentId.trim();
  if (!segmentId) {
    throw new Error('La colisión de guardrail requiere un segmentId');
  }
  const vertices: ApexVector3Tuple[] = [];
  const indices: number[] = [];

  for (const section of options.safety.sections) {
    const frames = section.points.map((point, index) => (
      frameAt(point, section.centerPoints[index])
    ));
    if (frames.length < 2) continue;

    for (let index = 0; index < frames.length - 1; index += 1) {
      const current = frames[index];
      const next = frames[index + 1];
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

  if (indices.length === 0) return emptyGroup(segmentId);
  const collider: ApexStaticColliderDescriptor = Object.freeze({
    kind: 'triangle-mesh',
    id: `${guardrailOwnerId(segmentId)}:mesh`,
    surface: 'asphalt',
    friction: options.friction,
    restitution: 0,
    vertices: Object.freeze(vertices),
    indices: Object.freeze(indices),
    activeEdgeCosThresholdAngle: Math.cos(12 * Math.PI / 180),
  });
  return Object.freeze({
    ownerId: guardrailOwnerId(segmentId),
    colliders: Object.freeze([collider]),
  });
};
