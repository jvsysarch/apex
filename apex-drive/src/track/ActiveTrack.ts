import type { ApexDriveTrackDefinition } from './formats/ApexDriveTrack';
import { APEX_DRIVE_PUBLIC_DEMO } from '../runtime/ApexDriveRuntimeProfile';
import {
  loadGeneratedApexTrackSource,
  type ApexTrackSource,
} from './formats/ApexTrackSource';
import {
  AUTOPISTA_CUMBRE_POINTS,
  AUTOPISTA_CUMBRE_WORLD_SIZE_M,
} from './AutopistaCumbreTrack';
import {
  CIRCUIT_BRAVO_POINTS,
} from './CircuitBravoTrack';
import {
  CIRCUITO_VECTOR_ID,
  CIRCUITO_VECTOR_POINTS,
  CIRCUITO_VECTOR_WORLD_SIZE_M,
} from './CircuitoVectorTrack';
import {
  CIRCUITO_VECTOR_EVOLUCION_ID,
  CIRCUITO_VECTOR_EVOLUCION_POINTS,
  CIRCUITO_VECTOR_EVOLUCION_WORLD_SIZE_M,
  createCircuitoVectorEvolucionSource,
} from './CircuitoVectorEvolucionTrack';
import {
  CIRCUITO_CHALLHUACO_ID,
  CIRCUITO_CHALLHUACO_POINTS,
  CIRCUITO_CHALLHUACO_WORLD_SIZE_M,
} from './ChallhuacoTrack';
import {
  generateApexProceduralLandscapeTrack,
  resolveApexProceduralRouteSeed,
} from './ProceduralLandscapeTrack';
import {
  readActiveApexLandscapePreset,
} from './landscape/ApexLandscapePresets';
import {
  APEX_DRIVE_TRACKS,
  findApexDriveTrack,
} from './catalog/ApexDriveTrackCatalog';
import {
  isApexProceduralLandscapeDefinition,
} from './catalog/ApexTrackStudioLocalCatalog';
import { CIRCUITO_BRAVO_TRACK } from './catalog/CircuitoBravoDefinition';
import {
  loadApexMapDraftFromVoid,
} from './editor/ApexVoidMapDraftRepository';

export interface ActiveTrackPoint {
  readonly x: number;
  readonly y?: number;
  readonly z: number;
  readonly bankRadians?: number;
  readonly surface?: string;
}

const requestedTrackIdentifier = (): number | string | undefined => {
  // La distribución pública es una experiencia cerrada de Circuito Vector.
  // Ignorar también ?track= evita saltar el bloqueo desde una URL manual.
  if (APEX_DRIVE_PUBLIC_DEMO) return CIRCUITO_VECTOR_ID;
  if (typeof window === 'undefined') return undefined;
  const value = new URLSearchParams(window.location.search).get('track')?.trim();
  if (!value) return undefined;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : value;
};

const selectedCatalogTrack = findApexDriveTrack(
  requestedTrackIdentifier()
    ?? CIRCUITO_VECTOR_ID,
);

const fallbackTrack = selectedCatalogTrack
  ?? findApexDriveTrack(CIRCUITO_VECTOR_ID)
  ?? CIRCUITO_BRAVO_TRACK;
const bundledOrStoredTrackSource = await loadGeneratedApexTrackSource(
  fallbackTrack.track.id,
  fallbackTrack.track.version,
);
export const ACTIVE_TRACK_SOURCE: ApexTrackSource | undefined = (
  bundledOrStoredTrackSource
  ?? (fallbackTrack.track.id === CIRCUITO_VECTOR_EVOLUCION_ID
    ? createCircuitoVectorEvolucionSource(fallbackTrack)
    : undefined)
);
export const ACTIVE_TRACK: ApexDriveTrackDefinition = (
  ACTIVE_TRACK_SOURCE?.definition ?? fallbackTrack
);
const proceduralLandscapePreset = readActiveApexLandscapePreset(
  ACTIVE_TRACK.track.id,
  isApexProceduralLandscapeDefinition(ACTIVE_TRACK),
);
export const ACTIVE_PROCEDURAL_TRACK = proceduralLandscapePreset
  ? generateApexProceduralLandscapeTrack(
    proceduralLandscapePreset,
    resolveApexProceduralRouteSeed(proceduralLandscapePreset),
  )
  : undefined;
export const ACTIVE_TRACK_INSTANCE_ID = (
  ACTIVE_TRACK.track.id.startsWith('local-')
    ? ACTIVE_TRACK.track.id
    : ACTIVE_PROCEDURAL_TRACK?.instanceId ?? ACTIVE_TRACK.track.id
);
const requestedDraftPreview = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('play') === 'draft';
const activeTrackDraft = requestedDraftPreview
  ? await loadApexMapDraftFromVoid({
    trackId: ACTIVE_TRACK_INSTANCE_ID,
    trackVersion: ACTIVE_TRACK.track.version,
    defaultBoundaryMode: ACTIVE_TRACK.configuration.geometry.boundaryMode,
    defaultRoadsideMode: ACTIVE_TRACK.configuration.geometry.roadsideMode,
    defaultRoadWidthM: ACTIVE_TRACK.configuration.geometry.roadWidthM,
    defaultLaneCount: 1,
    defaultSurface: ACTIVE_TRACK.configuration.surfaces.road,
    defaultVisualMode: 'inherit',
  })
  : undefined;
const draftPrimarySegmentId = activeTrackDraft?.routes.find(
  route => route.id === activeTrackDraft.primaryRouteId,
)?.segments[0]?.segmentId;
const draftPrimarySegment = activeTrackDraft?.segments.find(
  segment => segment.id === draftPrimarySegmentId,
);
export const ACTIVE_TRACK_PRIMARY_SEGMENT = (
  draftPrimarySegment ?? ACTIVE_TRACK_SOURCE?.primarySegment
);

const fallbackTrackPoints: readonly ActiveTrackPoint[] = (
  fallbackTrack.track.id === 'autopista-cumbre'
    ? AUTOPISTA_CUMBRE_POINTS
    : fallbackTrack.track.id === CIRCUITO_CHALLHUACO_ID
      ? CIRCUITO_CHALLHUACO_POINTS
    : fallbackTrack.track.id === CIRCUITO_VECTOR_ID
      ? CIRCUITO_VECTOR_POINTS
    : fallbackTrack.track.id === CIRCUITO_VECTOR_EVOLUCION_ID
      ? CIRCUITO_VECTOR_EVOLUCION_POINTS
    : ACTIVE_PROCEDURAL_TRACK
      ? ACTIVE_PROCEDURAL_TRACK?.points ?? CIRCUIT_BRAVO_POINTS
    : CIRCUIT_BRAVO_POINTS
);

export const ACTIVE_TRACK_IS_CLOSED = (
  ACTIVE_TRACK_PRIMARY_SEGMENT?.editor.closed
  ?? (ACTIVE_TRACK.track.id !== CIRCUITO_CHALLHUACO_ID)
);

const generatedUniquePoints = ACTIVE_TRACK_PRIMARY_SEGMENT?.evaluatedPoints.map(
  point => Object.freeze({ ...point }),
);
export const ACTIVE_TRACK_POINTS: readonly ActiveTrackPoint[] = Object.freeze(
  generatedUniquePoints
    ? [
      ...generatedUniquePoints,
      ...(ACTIVE_TRACK_IS_CLOSED
        ? [Object.freeze({ ...generatedUniquePoints[0] })]
        : []),
    ]
    : [...fallbackTrackPoints],
);

const fallbackWorldSizeM = (
  ACTIVE_TRACK.track.id === 'autopista-cumbre'
    ? AUTOPISTA_CUMBRE_WORLD_SIZE_M
    : ACTIVE_TRACK.track.id === CIRCUITO_CHALLHUACO_ID
      ? CIRCUITO_CHALLHUACO_WORLD_SIZE_M
    : ACTIVE_TRACK.track.id === CIRCUITO_VECTOR_ID
      ? CIRCUITO_VECTOR_WORLD_SIZE_M
    : ACTIVE_TRACK.track.id === CIRCUITO_VECTOR_EVOLUCION_ID
      ? CIRCUITO_VECTOR_EVOLUCION_WORLD_SIZE_M
    : ACTIVE_PROCEDURAL_TRACK
      ? ACTIVE_PROCEDURAL_TRACK?.worldSizeM ?? 1_600
    : 2000
);
const generatedWorldSizeM = generatedUniquePoints
  ? Math.ceil(
    Math.max(
      ...generatedUniquePoints.map(point => Math.abs(point.x)),
      ...generatedUniquePoints.map(point => Math.abs(point.z)),
    ) * 2 + 400,
  )
  : 0;
export const ACTIVE_TRACK_WORLD_SIZE_M = Math.max(
  fallbackWorldSizeM,
  generatedWorldSizeM,
);

export const ACTIVE_TRACK_LANE_COUNT = (
  ACTIVE_TRACK_PRIMARY_SEGMENT?.geometry.laneCount
  ?? (ACTIVE_TRACK.track.id === 'autopista-cumbre' ? 3 : 1)
);

export const ACTIVE_TRACK_OPTIONS = APEX_DRIVE_PUBLIC_DEMO
  ? Object.freeze(APEX_DRIVE_TRACKS.filter(
    track => track.track.id === CIRCUITO_VECTOR_ID,
  ))
  : APEX_DRIVE_TRACKS;
