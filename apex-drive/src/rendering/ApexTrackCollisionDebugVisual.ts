import * as THREE from 'three/webgpu';
import type { TrackPoint } from '../track/ApexTestTrack';
import type { ApexTrackBoundaryMode } from '../track/TrackBoundaryMode';
import {
  TRACK_GUARDRAIL_COLLIDER_DEPTH_M,
  TRACK_GUARDRAIL_COLLIDER_HEIGHT_M,
  TRACK_GUARDRAIL_THICKNESS_M,
  type TrackSafetySystem,
} from '../track/TrackSafetySystem';

export interface ApexTrackCollisionDebugVisualOptions {
  readonly points: readonly TrackPoint[];
  readonly roadWidthM: number;
  readonly roadThicknessM: number;
  readonly closed: boolean;
  readonly boundaryMode: ApexTrackBoundaryMode;
  readonly safety?: TrackSafetySystem;
}

export interface ApexTrackCollisionDebugVisual {
  readonly group: THREE.Group;
  update(
    points: readonly TrackPoint[],
    roadWidthM?: number,
    boundaryMode?: ApexTrackBoundaryMode,
    safety?: TrackSafetySystem,
    closed?: boolean,
  ): void;
}

interface TrackCollisionRing {
  readonly left: THREE.Vector3;
  readonly right: THREE.Vector3;
}

const createCollisionRings = (
  points: readonly TrackPoint[],
  roadWidthM: number,
  closed: boolean,
): readonly TrackCollisionRing[] => points.map((point, index) => {
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
  return Object.freeze({
    left: center.clone().addScaledVector(left, roadWidthM * 0.5),
    right: center.clone().addScaledVector(left, roadWidthM * -0.5),
  });
});

const createCollisionGeometry = (
  options: ApexTrackCollisionDebugVisualOptions,
): {
  readonly geometry: THREE.BufferGeometry;
  readonly segmentCount: number;
  readonly boundaryWallSegmentCount: number;
} => {
  const rings = createCollisionRings(
    options.points,
    options.roadWidthM,
    options.closed,
  );
  const segmentCount = options.closed ? rings.length : rings.length - 1;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let index = 0; index < segmentCount; index += 1) {
    const current = rings[index];
    const next = rings[(index + 1) % rings.length];
    const topCorners = [
      current.left,
      current.right,
      next.left,
      next.right,
    ];
    const base = positions.length / 3;

    for (const corner of topCorners) {
      positions.push(corner.x, corner.y, corner.z);
    }
    for (const corner of topCorners) {
      positions.push(
        corner.x,
        corner.y - options.roadThicknessM,
        corner.z,
      );
    }

    indices.push(
      base, base + 2, base + 1,
      base + 1, base + 2, base + 3,
      base + 4, base + 5, base + 6,
      base + 5, base + 7, base + 6,
      base, base + 1, base + 4,
      base + 1, base + 5, base + 4,
      base + 2, base + 6, base + 3,
      base + 3, base + 6, base + 7,
      base, base + 4, base + 2,
      base + 2, base + 4, base + 6,
      base + 1, base + 3, base + 5,
      base + 3, base + 7, base + 5,
    );
  }

  const appendBoundaryWallSegment = (
    currentInner: THREE.Vector3,
    nextInner: THREE.Vector3,
    currentOutward: THREE.Vector3,
    nextOutward: THREE.Vector3,
  ): void => {
    const currentOuter = currentInner.clone().addScaledVector(
      currentOutward,
      TRACK_GUARDRAIL_THICKNESS_M,
    );
    const nextOuter = nextInner.clone().addScaledVector(
      nextOutward,
      TRACK_GUARDRAIL_THICKNESS_M,
    );
    const vertices = [
      [currentInner.x, currentInner.y - TRACK_GUARDRAIL_COLLIDER_DEPTH_M, currentInner.z],
      [currentInner.x, currentInner.y + TRACK_GUARDRAIL_COLLIDER_HEIGHT_M, currentInner.z],
      [currentOuter.x, currentOuter.y - TRACK_GUARDRAIL_COLLIDER_DEPTH_M, currentOuter.z],
      [currentOuter.x, currentOuter.y + TRACK_GUARDRAIL_COLLIDER_HEIGHT_M, currentOuter.z],
      [nextInner.x, nextInner.y - TRACK_GUARDRAIL_COLLIDER_DEPTH_M, nextInner.z],
      [nextInner.x, nextInner.y + TRACK_GUARDRAIL_COLLIDER_HEIGHT_M, nextInner.z],
      [nextOuter.x, nextOuter.y - TRACK_GUARDRAIL_COLLIDER_DEPTH_M, nextOuter.z],
      [nextOuter.x, nextOuter.y + TRACK_GUARDRAIL_COLLIDER_HEIGHT_M, nextOuter.z],
    ] as const;
    const base = positions.length / 3;
    vertices.forEach(vertex => positions.push(...vertex));
    indices.push(
      base, base + 4, base + 1,
      base + 1, base + 4, base + 5,
      base + 2, base + 3, base + 6,
      base + 3, base + 7, base + 6,
      base + 1, base + 5, base + 3,
      base + 3, base + 5, base + 7,
      base, base + 2, base + 4,
      base + 2, base + 6, base + 4,
      base, base + 1, base + 2,
      base + 1, base + 3, base + 2,
      base + 4, base + 6, base + 5,
      base + 5, base + 6, base + 7,
    );
  };

  let boundaryWallSegmentCount = 0;
  if (options.boundaryMode === 'walls') {
    for (let index = 0; index < segmentCount; index += 1) {
      const current = rings[index];
      const next = rings[(index + 1) % rings.length];
      const currentLeftOutward = current.left.clone()
        .sub(current.right)
        .normalize();
      const nextLeftOutward = next.left.clone()
        .sub(next.right)
        .normalize();
      appendBoundaryWallSegment(
        current.left,
        next.left,
        currentLeftOutward,
        nextLeftOutward,
      );
      appendBoundaryWallSegment(
        current.right,
        next.right,
        currentLeftOutward.negate(),
        nextLeftOutward.negate(),
      );
      boundaryWallSegmentCount += 2;
    }
  } else {
    options.safety?.sections.forEach(section => {
      for (let index = 0; index < section.points.length - 1; index += 1) {
        const current = section.points[index];
        const next = section.points[index + 1];
        const currentCenter = section.centerPoints[index];
        const nextCenter = section.centerPoints[index + 1];
        const currentOutward = new THREE.Vector3(
          current.x - currentCenter.x,
          0,
          current.z - currentCenter.z,
        ).normalize();
        const nextOutward = new THREE.Vector3(
          next.x - nextCenter.x,
          0,
          next.z - nextCenter.z,
        ).normalize();
        const currentInner = new THREE.Vector3(
          current.x,
          current.y,
          current.z,
        ).addScaledVector(
          currentOutward,
          TRACK_GUARDRAIL_THICKNESS_M * -0.5,
        );
        const nextInner = new THREE.Vector3(
          next.x,
          next.y,
          next.z,
        ).addScaledVector(
          nextOutward,
          TRACK_GUARDRAIL_THICKNESS_M * -0.5,
        );
        appendBoundaryWallSegment(
          currentInner,
          nextInner,
          currentOutward,
          nextOutward,
        );
        boundaryWallSegmentCount += 1;
      }
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return Object.freeze({
    geometry,
    segmentCount,
    boundaryWallSegmentCount,
  });
};

export const createApexTrackCollisionDebugVisual = (
  initialOptions: ApexTrackCollisionDebugVisualOptions,
): ApexTrackCollisionDebugVisual => {
  const group = new THREE.Group();
  group.name = 'track-collision-debug-visual';
  group.userData.authority = 'debug-only';
  group.userData.geometry = 'jolt-road-hulls-and-boundary-mesh-envelope';
  let collisionGeometry = createCollisionGeometry(initialOptions);
  const fill = new THREE.Mesh(
    collisionGeometry.geometry,
    new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }),
  );
  fill.name = 'track-collision-debug-fill';
  fill.renderOrder = 30;
  group.add(fill);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(collisionGeometry.geometry, 1),
    new THREE.LineBasicMaterial({
      color: 0xb8f8ff,
      transparent: true,
      opacity: 0.78,
      depthTest: false,
      depthWrite: false,
    }),
  );
  edges.name = 'track-collision-debug-edges';
  edges.renderOrder = 31;
  group.add(edges);

  group.userData.segmentCount = collisionGeometry.segmentCount;
  group.userData.boundaryWallSegmentCount = (
    collisionGeometry.boundaryWallSegmentCount
  );
  group.userData.roadWidthM = initialOptions.roadWidthM;
  group.userData.roadThicknessM = initialOptions.roadThicknessM;
  group.userData.boundaryMode = initialOptions.boundaryMode;

  let roadWidthM = initialOptions.roadWidthM;
  let boundaryMode = initialOptions.boundaryMode;
  let safety = initialOptions.safety;
  let closed = initialOptions.closed;
  const update = (
    points: readonly TrackPoint[],
    nextRoadWidthM = roadWidthM,
    nextBoundaryMode = boundaryMode,
    nextSafety = safety,
    nextClosed = closed,
  ): void => {
    roadWidthM = nextRoadWidthM;
    boundaryMode = nextBoundaryMode;
    safety = nextSafety;
    closed = nextClosed;
    const nextGeometry = createCollisionGeometry({
      ...initialOptions,
      points,
      roadWidthM,
      boundaryMode,
      safety,
      closed,
    });
    fill.geometry.dispose();
    edges.geometry.dispose();
    fill.geometry = nextGeometry.geometry;
    edges.geometry = new THREE.EdgesGeometry(nextGeometry.geometry, 1);
    collisionGeometry = nextGeometry;
    group.userData.segmentCount = collisionGeometry.segmentCount;
    group.userData.boundaryWallSegmentCount = (
      collisionGeometry.boundaryWallSegmentCount
    );
    group.userData.roadWidthM = roadWidthM;
    group.userData.boundaryMode = boundaryMode;
    group.userData.closed = closed;
  };

  return Object.freeze({ group, update });
};
