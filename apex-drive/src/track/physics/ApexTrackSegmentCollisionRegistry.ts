import type {
  ApexStaticColliderGroup,
  ApexStaticWorldPort,
} from '@jvsysarch/apex-physics';
import type { TrackPoint } from '../ApexTestTrack';
import type { ApexTrackBoundaryMode } from '../TrackBoundaryMode';
import type { ApexTrackRoadsideMode } from '../TrackRoadsideMode';
import type { TrackSafetySystem } from '../TrackSafetySystem';
import type {
  ApexTrackSegmentCollisionRegistry as ApexTrackSegmentCollisionRegistryPort,
} from '../runtime/ApexTrackRuntimeCoordinator';
import {
  apexTrackGuardrailCollisionOwnerId,
  createApexTrackGuardrailCollisionGroup,
} from './ApexTrackGuardrailCollisionBuilder';
import {
  apexTrackRoadsideCollisionOwnerId,
  createApexTrackRoadsideCollisionGroup,
} from './ApexTrackRoadsideCollisionBuilder';
import {
  apexTrackSurfaceCollisionOwnerId,
  createApexTrackSurfaceCollisionGroup,
} from './ApexTrackSurfaceCollisionBuilder';

export interface ApexTrackCollisionMaterialProfile {
  readonly wallFriction: number;
  readonly roadsideFriction: number;
  readonly guardrailFriction: number;
}

export interface ApexTrackSegmentCollisionRegistryOptions {
  readonly staticWorld: ApexStaticWorldPort;
  readonly roadThicknessM: number;
  readonly materials: ApexTrackCollisionMaterialProfile;
}

interface ApexTrackCollisionComplexity {
  readonly colliderCount: number;
  readonly boxCount: number;
  readonly convexHullCount: number;
  readonly triangleMeshCount: number;
  readonly inputVertexCount: number;
  readonly triangleMeshTriangleCount: number;
}

const summarizeCollisionGroup = (
  group: ApexStaticColliderGroup,
): ApexTrackCollisionComplexity => {
  let boxCount = 0;
  let convexHullCount = 0;
  let triangleMeshCount = 0;
  let inputVertexCount = 0;
  let triangleMeshTriangleCount = 0;
  for (const collider of group.colliders) {
    if (collider.kind === 'box') {
      boxCount += 1;
      continue;
    }
    if (collider.kind === 'convex-hull') {
      convexHullCount += 1;
      inputVertexCount += collider.points.length;
      continue;
    }
    triangleMeshCount += 1;
    inputVertexCount += collider.vertices.length;
    triangleMeshTriangleCount += collider.indices.length / 3;
  }
  return Object.freeze({
    colliderCount: group.colliders.length,
    boxCount,
    convexHullCount,
    triangleMeshCount,
    inputVertexCount,
    triangleMeshTriangleCount,
  });
};

/**
 * Adapta el pipeline derivado de track al puerto estático de APEX Physics.
 *
 * Track conserva geometría, safety y ownership por segmento. El runtime físico
 * recibe únicamente grupos de colliders numéricos.
 */
export class ApexTrackSegmentCollisionRegistry
implements ApexTrackSegmentCollisionRegistryPort {
  private readonly segmentIds = new Set<string>();
  private readonly colliderCounts = new Map<string, {
    readonly surface: ApexTrackCollisionComplexity;
    readonly roadside: ApexTrackCollisionComplexity;
    readonly guardrail: ApexTrackCollisionComplexity;
  }>();

  constructor(
    private readonly options: ApexTrackSegmentCollisionRegistryOptions,
  ) {}

  replaceTrackSegmentCollision(
    segmentId: string,
    points: readonly TrackPoint[],
    roadWidthM: number,
    boundaryMode: ApexTrackBoundaryMode,
    safety: TrackSafetySystem,
    roadsideMode: ApexTrackRoadsideMode,
    closed: boolean,
    shoulderWidthM: number,
    groundHeightM: number,
  ): void {
    const normalizedSegmentId = segmentId.trim();
    if (!normalizedSegmentId) {
      throw new Error('La colisión de pista requiere un segmentId');
    }

    this.clearSegment(normalizedSegmentId);
    if (points.length < 2) return;

    const surfaceGroup = createApexTrackSurfaceCollisionGroup({
      segmentId: normalizedSegmentId,
      sourcePoints: points,
      sourcePointsAreUnique: true,
      roadWidthM,
      roadThicknessM: this.options.roadThicknessM,
      closed,
      withBoundaryWalls: boundaryMode === 'walls',
      wallFriction: this.options.materials.wallFriction,
    });
    this.options.staticWorld.replaceStaticColliderGroup(surfaceGroup);
    let guardrailComplexity: ApexTrackCollisionComplexity = Object.freeze({
      colliderCount: 0,
      boxCount: 0,
      convexHullCount: 0,
      triangleMeshCount: 0,
      inputVertexCount: 0,
      triangleMeshTriangleCount: 0,
    });
    let roadsideComplexity: ApexTrackCollisionComplexity = guardrailComplexity;
    if (boundaryMode === 'guardrails') {
      const guardrailGroup = createApexTrackGuardrailCollisionGroup({
        segmentId: normalizedSegmentId,
        safety,
        friction: this.options.materials.guardrailFriction,
      });
      this.options.staticWorld.replaceStaticColliderGroup(guardrailGroup);
      guardrailComplexity = summarizeCollisionGroup(guardrailGroup);
    }
    if (roadsideMode !== 'none') {
      const roadsideGroup = createApexTrackRoadsideCollisionGroup({
        segmentId: normalizedSegmentId,
        sourcePoints: points,
        sourcePointsAreUnique: true,
        roadWidthM,
        roadsideMode,
        closed,
        shoulderWidthM,
        groundHeightM,
        friction: this.options.materials.roadsideFriction,
      });
      this.options.staticWorld.replaceStaticColliderGroup(roadsideGroup);
      roadsideComplexity = summarizeCollisionGroup(roadsideGroup);
    }
    this.segmentIds.add(normalizedSegmentId);
    this.colliderCounts.set(normalizedSegmentId, {
      surface: summarizeCollisionGroup(surfaceGroup),
      roadside: roadsideComplexity,
      guardrail: guardrailComplexity,
    });
  }

  getSummary(): {
    readonly segmentCount: number;
    readonly surfaceColliderCount: number;
    readonly roadsideColliderCount: number;
    readonly guardrailColliderCount: number;
    readonly totalColliderCount: number;
    readonly boxColliderCount: number;
    readonly convexHullColliderCount: number;
    readonly triangleMeshColliderCount: number;
    readonly collisionInputVertexCount: number;
    readonly triangleMeshTriangleCount: number;
  } {
    let surfaceColliderCount = 0;
    let roadsideColliderCount = 0;
    let guardrailColliderCount = 0;
    let boxColliderCount = 0;
    let convexHullColliderCount = 0;
    let triangleMeshColliderCount = 0;
    let collisionInputVertexCount = 0;
    let triangleMeshTriangleCount = 0;
    for (const counts of this.colliderCounts.values()) {
      surfaceColliderCount += counts.surface.colliderCount;
      roadsideColliderCount += counts.roadside.colliderCount;
      guardrailColliderCount += counts.guardrail.colliderCount;
      for (const complexity of [
        counts.surface,
        counts.roadside,
        counts.guardrail,
      ]) {
        boxColliderCount += complexity.boxCount;
        convexHullColliderCount += complexity.convexHullCount;
        triangleMeshColliderCount += complexity.triangleMeshCount;
        collisionInputVertexCount += complexity.inputVertexCount;
        triangleMeshTriangleCount += complexity.triangleMeshTriangleCount;
      }
    }
    return Object.freeze({
      segmentCount: this.segmentIds.size,
      surfaceColliderCount,
      roadsideColliderCount,
      guardrailColliderCount,
      totalColliderCount:
        surfaceColliderCount + roadsideColliderCount + guardrailColliderCount,
      boxColliderCount,
      convexHullColliderCount,
      triangleMeshColliderCount,
      collisionInputVertexCount,
      triangleMeshTriangleCount,
    });
  }

  removeTrackSegmentCollision(segmentId: string): void {
    this.clearSegment(segmentId.trim());
  }

  retainTrackSegmentCollisions(segmentIds: ReadonlySet<string>): void {
    for (const segmentId of [...this.segmentIds]) {
      if (!segmentIds.has(segmentId)) this.clearSegment(segmentId);
    }
  }

  private clearSegment(segmentId: string): void {
    if (!segmentId) return;
    this.options.staticWorld.removeStaticColliderGroup(
      apexTrackSurfaceCollisionOwnerId(segmentId),
    );
    this.options.staticWorld.removeStaticColliderGroup(
      apexTrackRoadsideCollisionOwnerId(segmentId),
    );
    this.options.staticWorld.removeStaticColliderGroup(
      apexTrackGuardrailCollisionOwnerId(segmentId),
    );
    this.segmentIds.delete(segmentId);
    this.colliderCounts.delete(segmentId);
  }
}
