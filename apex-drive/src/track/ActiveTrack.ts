import type { ApexDriveTrackDefinition } from './formats/ApexDriveTrack';
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
  CIRCUITO_CHALLHUACO_ID,
  CIRCUITO_CHALLHUACO_POINTS,
  CIRCUITO_CHALLHUACO_WORLD_SIZE_M,
} from './ChallhuacoTrack';
import {
  APEX_DRIVE_TRACKS,
  findApexDriveTrack,
} from './catalog/ApexDriveTrackCatalog';
import { CIRCUITO_BRAVO_TRACK } from './catalog/CircuitoBravoDefinition';
import {
  APEX_DRIVE_PUBLIC_DEMO,
} from '../runtime/ApexDriveRuntimeProfile';

export interface ActiveTrackPoint {
  readonly x: number;
  readonly y?: number;
  readonly z: number;
  readonly bankRadians?: number;
  readonly surface?: string;
}

const requestedTrackIdentifier = (): number | string | undefined => {
  if (typeof window === 'undefined') return undefined;
  const value = new URLSearchParams(window.location.search).get('track')?.trim();
  if (!value) return undefined;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : value;
};

const selectedCatalogTrack = findApexDriveTrack(
  APEX_DRIVE_PUBLIC_DEMO
    ? CIRCUITO_VECTOR_ID
    : requestedTrackIdentifier() ?? CIRCUITO_BRAVO_TRACK.track.id,
);

const fallbackTrack = selectedCatalogTrack ?? CIRCUITO_BRAVO_TRACK;
export const ACTIVE_TRACK_SOURCE: ApexTrackSource | undefined = (
  await loadGeneratedApexTrackSource(
    fallbackTrack.track.id,
    fallbackTrack.track.version,
  )
);
export const ACTIVE_TRACK: ApexDriveTrackDefinition = (
  ACTIVE_TRACK_SOURCE?.definition ?? fallbackTrack
);
export const ACTIVE_TRACK_PRIMARY_SEGMENT = (
  ACTIVE_TRACK_SOURCE?.primarySegment
);

const fallbackTrackPoints: readonly ActiveTrackPoint[] = (
  fallbackTrack.track.id === 'autopista-cumbre'
    ? AUTOPISTA_CUMBRE_POINTS
    : fallbackTrack.track.id === CIRCUITO_CHALLHUACO_ID
      ? CIRCUITO_CHALLHUACO_POINTS
    : fallbackTrack.track.id === CIRCUITO_VECTOR_ID
      ? CIRCUITO_VECTOR_POINTS
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

export const ACTIVE_TRACK_OPTIONS = APEX_DRIVE_TRACKS;
