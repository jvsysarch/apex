import * as THREE from 'three/webgpu';
import type { TrackPoint } from '../track/ApexTestTrack';
import {
  createApexTrackDerivedState,
  type ApexTrackDerivedState,
  type ApexTrackDerivedTiming,
} from '../track/editor/ApexTrackDerivedState';
import type {
  ApexTrackSourceSegment,
} from '../track/formats/ApexTrackNetwork';
import { createApexTrackEditDerivedVisual } from './ApexTrackEditDerivedVisual';
import { resolveTrackRoadsideWidthM } from '../track/TrackRoadsideWidth';

export interface ApexTrackNetworkDerivedVisualOptions {
  readonly segments: readonly ApexTrackSourceSegment[];
  readonly excludedSegmentIds: ReadonlySet<string>;
  readonly groundHeightM: number;
  readonly shoulderWidthM: number;
  readonly timing: ApexTrackDerivedTiming;
  readonly roadMaterial: THREE.Material;
  readonly roadsideMaterial: THREE.Material;
  readonly derivedStatesBySegmentId?: ReadonlyMap<
    string,
    ApexTrackDerivedState
  >;
}

export interface ApexTrackNetworkDerivedVisual {
  readonly group: THREE.Group;
  readonly segmentCount: number;
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

/**
 * Coordina N instancias del pipeline visual derivado que ya usa una pista
 * individual. No concatena splines y no crea cuerpos físicos.
 */
export const createApexTrackNetworkDerivedVisual = (
  options: ApexTrackNetworkDerivedVisualOptions,
): ApexTrackNetworkDerivedVisual => {
  const group = new THREE.Group();
  group.name = 'apex-track-network-derived-visual';
  group.userData.authority = 'multi-segment-derived-visual-only';
  group.userData.physics = 'none';
  let segmentCount = 0;

  options.segments.forEach(segment => {
    if (
      segment.enabled === false
      || options.excludedSegmentIds.has(segment.id)
      || segment.evaluatedPoints.length < 2
    ) return;
    const state = (
      options.derivedStatesBySegmentId?.get(segment.id)
      ?? createApexTrackDerivedState({
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
    const visual = createApexTrackEditDerivedVisual({
      roadMaterial: options.roadMaterial,
      roadsideMaterial: options.roadsideMaterial,
      // Los segmentos adicionales son presentación procedural completa. Un
      // asset de fondo sólo reemplaza al segmento primario que se excluye aquí.
      showProceduralSurface: true,
    });
    visual.update(state);
    visual.group.name = `track-segment-derived-${segment.id}`;
    visual.group.userData.segmentId = segment.id;
    visual.group.userData.segmentName = segment.name;
    visual.group.userData.visualMode = segment.geometry.visualMode;
    visual.group.userData.physics = 'none';
    group.add(visual.group);
    segmentCount += 1;
  });

  group.userData.segmentCount = segmentCount;
  return Object.freeze({ group, segmentCount });
};
