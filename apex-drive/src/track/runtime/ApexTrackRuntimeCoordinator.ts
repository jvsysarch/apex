import * as THREE from 'three/webgpu';
import type { TrackPoint } from '../ApexTestTrack';
import {
  createApexTrackDerivedState,
  type ApexTrackDerivedState,
  type ApexTrackDerivedTiming,
} from '../editor/ApexTrackDerivedState';
import type { ApexTrackSourceSegment } from '../formats/ApexTrackNetwork';
import type { ApexTrackBoundaryMode } from '../TrackBoundaryMode';
import type { ApexTrackRoadsideMode } from '../TrackRoadsideMode';
import type { TrackSafetySystem } from '../TrackSafetySystem';
import { resolveTrackRoadsideWidthM } from '../TrackRoadsideWidth';
import {
  createApexTrackNetworkDerivedVisual,
} from '../../rendering/ApexTrackNetworkDerivedVisual';

export interface ApexTrackSegmentCollisionRegistry {
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
  ): void;
  removeTrackSegmentCollision(segmentId: string): void;
  retainTrackSegmentCollisions(segmentIds: ReadonlySet<string>): void;
}

export interface ApexTrackRuntimeCoordinatorOptions {
  readonly segments: readonly ApexTrackSourceSegment[];
  readonly visualExcludedSegmentIds: ReadonlySet<string>;
  readonly groundHeightM: number;
  readonly shoulderWidthM: number;
  readonly timing: ApexTrackDerivedTiming;
  readonly roadMaterial: THREE.Material;
  readonly roadsideMaterial: THREE.Material;
  readonly collisionRegistry: ApexTrackSegmentCollisionRegistry;
}

export interface ApexTrackRuntimeCoordinator {
  readonly group: THREE.Group;
  readonly segmentCount: number;
  readonly collisionSegmentCount: number;
  readonly derivedStatesBySegmentId: ReadonlyMap<
    string,
    ApexTrackDerivedState
  >;
  replaceSegmentDerivedState(
    segmentId: string,
    state: ApexTrackDerivedState,
  ): void;
  upsertSegment(segment: ApexTrackSourceSegment): ApexTrackDerivedState;
  setSegmentEnabled(segmentId: string, enabled: boolean): void;
  setVisualExcludedSegmentIds(segmentIds: ReadonlySet<string>): void;
}

const asTrackPoints = (
  segment: ApexTrackSourceSegment,
): readonly TrackPoint[] => Object.freeze(
  segment.evaluatedPoints.map(point => Object.freeze({
    x: point.x,
    y: point.y,
    z: point.z,
    bankRadians: point.bankRadians,
    surface: point.surface as TrackPoint['surface'],
  })),
);

const replaceCollision = (
  registry: ApexTrackSegmentCollisionRegistry,
  segmentId: string,
  state: ApexTrackDerivedState,
): void => {
  registry.replaceTrackSegmentCollision(
    segmentId,
    state.points,
    state.roadWidthM,
    state.boundaryMode,
    state.safety,
    state.roadsideMode,
    state.closed,
    state.shoulderWidthM,
    state.groundHeightM,
  );
};

/**
 * Ejecuta el pipeline de una pista tradicional una vez por segmento.
 * El track coordina ownership; nunca concatena splines ni fusiona colliders.
 */
export const createApexTrackRuntimeCoordinator = (
  options: ApexTrackRuntimeCoordinatorOptions,
): ApexTrackRuntimeCoordinator => {
  const derivedStatesBySegmentId = new Map<
    string,
    ApexTrackDerivedState
  >();
  const latestStatesBySegmentId = new Map<
    string,
    ApexTrackDerivedState
  >();
  const segmentsById = new Map<string, ApexTrackSourceSegment>(
    options.segments.map(segment => [segment.id, segment] as const),
  );
  const collisionSegmentIds = new Set<string>();

  const deriveSegment = (
    segment: ApexTrackSourceSegment,
  ): ApexTrackDerivedState => (
    createApexTrackDerivedState({
      points: asTrackPoints(segment),
      roadWidthM: segment.geometry.roadWidthM,
      boundaryMode: segment.geometry.boundaryMode,
      roadsideMode: segment.geometry.roadsideMode,
      closed: segment.editor.closed,
      groundHeightM: options.groundHeightM,
      shoulderWidthM: resolveTrackRoadsideWidthM(
        segment.geometry.roadsideMode,
        options.shoulderWidthM,
        segment.geometry.roadWidthM,
      ),
      laneCount: segment.geometry.laneCount,
      timing: options.timing,
    })
  );

  segmentsById.forEach(segment => {
    if (segment.enabled === false || segment.evaluatedPoints.length < 2) return;
    const state = deriveSegment(segment);
    latestStatesBySegmentId.set(segment.id, state);
    derivedStatesBySegmentId.set(segment.id, state);
    collisionSegmentIds.add(segment.id);
    replaceCollision(options.collisionRegistry, segment.id, state);
  });

  // Un track legacy sin fuente V2 conserva el collider creado por el runtime
  // original. Cuando hay segmentos normalizados, el registro refleja sólo
  // esos owners y elimina cuerpos pertenecientes a segmentos ya borrados.
  if (segmentsById.size > 0) {
    options.collisionRegistry.retainTrackSegmentCollisions(
      collisionSegmentIds,
    );
  }

  const group = new THREE.Group();
  group.name = 'apex-track-runtime-segment-visuals';
  group.userData.runtimeAuthority = 'segment-coordinator';
  group.userData.collisionSegmentCount = collisionSegmentIds.size;
  let visualExcludedSegmentIds = new Set(
    options.visualExcludedSegmentIds,
  );
  let visualSegmentCount = 0;

  const disposeVisualGroup = (visualGroup: THREE.Group): void => {
    visualGroup.traverse(object => {
      const renderable = object as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };
      renderable.geometry?.dispose();
      const materials = Array.isArray(renderable.material)
        ? renderable.material
        : renderable.material ? [renderable.material] : [];
      materials.forEach(material => {
        if (
          material !== options.roadMaterial
          && material !== options.roadsideMaterial
        ) {
          material.dispose();
        }
      });
    });
  };

  const rebuildVisuals = (): void => {
    group.children.forEach(child => {
      if (child instanceof THREE.Group) disposeVisualGroup(child);
    });
    group.clear();
    const visual = createApexTrackNetworkDerivedVisual({
      segments: [...segmentsById.values()].filter(
        segment => segment.enabled !== false,
      ),
      excludedSegmentIds: visualExcludedSegmentIds,
      groundHeightM: options.groundHeightM,
      shoulderWidthM: options.shoulderWidthM,
      timing: options.timing,
      roadMaterial: options.roadMaterial,
      roadsideMaterial: options.roadsideMaterial,
      derivedStatesBySegmentId,
    });
    visualSegmentCount = visual.segmentCount;
    group.add(visual.group);
    group.userData.visualSegmentCount = visualSegmentCount;
  };
  rebuildVisuals();

  return Object.freeze({
    group,
    get segmentCount() {
      return derivedStatesBySegmentId.size;
    },
    get collisionSegmentCount() {
      return collisionSegmentIds.size;
    },
    derivedStatesBySegmentId,
    replaceSegmentDerivedState: (
      segmentId: string,
      state: ApexTrackDerivedState,
    ) => {
      latestStatesBySegmentId.set(segmentId, state);
      if (segmentsById.get(segmentId)?.enabled === false) {
        derivedStatesBySegmentId.delete(segmentId);
        options.collisionRegistry.removeTrackSegmentCollision(segmentId);
        collisionSegmentIds.delete(segmentId);
        group.userData.collisionSegmentCount = collisionSegmentIds.size;
        return;
      }
      derivedStatesBySegmentId.set(segmentId, state);
      replaceCollision(options.collisionRegistry, segmentId, state);
      collisionSegmentIds.add(segmentId);
      group.userData.collisionSegmentCount = collisionSegmentIds.size;
    },
    upsertSegment: (segment: ApexTrackSourceSegment) => {
      const state = deriveSegment(segment);
      segmentsById.set(segment.id, segment);
      latestStatesBySegmentId.set(segment.id, state);
      if (segment.enabled === false) {
        derivedStatesBySegmentId.delete(segment.id);
        options.collisionRegistry.removeTrackSegmentCollision(segment.id);
        collisionSegmentIds.delete(segment.id);
        group.userData.collisionSegmentCount = collisionSegmentIds.size;
        rebuildVisuals();
        return state;
      }
      derivedStatesBySegmentId.set(segment.id, state);
      replaceCollision(options.collisionRegistry, segment.id, state);
      collisionSegmentIds.add(segment.id);
      group.userData.collisionSegmentCount = collisionSegmentIds.size;
      rebuildVisuals();
      return state;
    },
    setSegmentEnabled: (segmentId: string, enabled: boolean) => {
      const segment = segmentsById.get(segmentId);
      if (!segment || (segment.enabled !== false) === enabled) return;
      const updatedSegment = Object.freeze({
        ...segment,
        enabled,
      });
      segmentsById.set(segmentId, updatedSegment);
      if (enabled) {
        const state = (
          latestStatesBySegmentId.get(segmentId)
          ?? deriveSegment(updatedSegment)
        );
        latestStatesBySegmentId.set(segmentId, state);
        derivedStatesBySegmentId.set(segmentId, state);
        replaceCollision(options.collisionRegistry, segmentId, state);
        collisionSegmentIds.add(segmentId);
      } else {
        derivedStatesBySegmentId.delete(segmentId);
        options.collisionRegistry.removeTrackSegmentCollision(segmentId);
        collisionSegmentIds.delete(segmentId);
      }
      group.userData.collisionSegmentCount = collisionSegmentIds.size;
      rebuildVisuals();
    },
    setVisualExcludedSegmentIds: (segmentIds: ReadonlySet<string>) => {
      visualExcludedSegmentIds = new Set(segmentIds);
      rebuildVisuals();
    },
  });
};
