import type { TrackPoint } from '../ApexTestTrack';
import {
  isApexTrackBoundaryMode,
  type ApexTrackBoundaryMode,
} from '../TrackBoundaryMode';
import {
  isApexTrackRoadsideMode,
  type ApexTrackRoadsideMode,
} from '../TrackRoadsideMode';
import type {
  ApexTrackJunction,
  ApexTrackJunctionKind,
  ApexTrackNetworkPoint,
  ApexTrackRoute,
  ApexTrackRouteDirection,
  ApexTrackSourceSegment,
  ApexTrackSegmentKind,
  ApexTrackSegmentVisualMode,
} from '../formats/ApexTrackNetwork';

export const APEX_TRACK_DRAFT_FORMAT = 'apex-track-draft';
export const APEX_TRACK_DRAFT_FORMAT_VERSION = 6;
const LOCAL_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const SEGMENT_KINDS = Object.freeze([
  'road',
  'connector',
  'branch',
] as const satisfies readonly ApexTrackSegmentKind[]);
const VISUAL_MODES = Object.freeze([
  'inherit',
  'procedural',
  'collision-only',
  'asset-reference',
] as const satisfies readonly ApexTrackSegmentVisualMode[]);
const ROUTE_DIRECTIONS = Object.freeze([
  'forward',
  'reverse',
] as const satisfies readonly ApexTrackRouteDirection[]);
const JUNCTION_KINDS = Object.freeze([
  'hard',
  'smooth',
  'merge',
  'crossing',
  'underpass',
  'overpass',
] as const satisfies readonly ApexTrackJunctionKind[]);

/**
 * V6 ya persiste N segmentos. Los campos planos son aliases del segmento
 * activo para que el editor V5 siga funcionando durante la Fase 1.
 */
export interface ApexTrackDraft {
  readonly format: typeof APEX_TRACK_DRAFT_FORMAT;
  readonly formatVersion: typeof APEX_TRACK_DRAFT_FORMAT_VERSION;
  readonly trackId: string;
  readonly trackVersion: string;
  readonly savedAtIso: string;
  readonly activeSegmentId: string;
  readonly primaryRouteId: string;
  readonly segments: readonly ApexTrackSourceSegment[];
  readonly junctions: readonly ApexTrackJunction[];
  readonly routes: readonly ApexTrackRoute[];
  readonly closed: boolean;
  readonly controlSpacingM: number;
  readonly collisionSpacingM: number;
  readonly roadWidthM: number;
  readonly boundaryMode: ApexTrackBoundaryMode;
  readonly roadsideMode: ApexTrackRoadsideMode;
  readonly simplificationToleranceM: number;
  readonly controlPoints: readonly TrackPoint[];
  readonly evaluatedPoints: readonly TrackPoint[];
}

export interface ApexTrackDraftIdentity {
  readonly trackId: string;
  readonly trackVersion: string;
  readonly defaultBoundaryMode?: ApexTrackBoundaryMode;
  readonly defaultRoadsideMode?: ApexTrackRoadsideMode;
  readonly defaultRoadWidthM?: number;
  readonly defaultLaneCount?: number;
  readonly defaultSurface?: string;
  readonly defaultVisualMode?: ApexTrackSegmentVisualMode;
}

const finiteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const parsePoint = (value: unknown): TrackPoint | undefined => {
  if (!isRecord(value)) return undefined;
  if (
    !finiteNumber(value.x)
    || !finiteNumber(value.y)
    || !finiteNumber(value.z)
    || !finiteNumber(value.bankRadians)
  ) return undefined;
  return Object.freeze({
    x: value.x,
    y: value.y,
    z: value.z,
    bankRadians: value.bankRadians,
    surface: typeof value.surface === 'string'
      ? value.surface as TrackPoint['surface']
      : undefined,
  });
};

const parsePoints = (value: unknown): readonly TrackPoint[] | undefined => {
  if (
    !Array.isArray(value)
    || value.length < 2
    || value.length > 100_000
  ) return undefined;
  const points = value.map(parsePoint);
  if (points.some(point => point === undefined)) return undefined;
  return Object.freeze(points as TrackPoint[]);
};

const parseSegment = (value: unknown): ApexTrackSourceSegment | undefined => {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || !LOCAL_ID_PATTERN.test(value.id)
    || typeof value.name !== 'string'
    || value.name.trim().length === 0
    || typeof value.kind !== 'string'
    || !SEGMENT_KINDS.includes(value.kind as ApexTrackSegmentKind)
    || !isRecord(value.editor)
    || !isRecord(value.geometry)
  ) return undefined;
  const editor = value.editor;
  const geometry = value.geometry;
  const controlPoints = parsePoints(value.controlPoints);
  const evaluatedPoints = parsePoints(value.evaluatedPoints);
  if (
    typeof editor.closed !== 'boolean'
    || (value.enabled !== undefined && typeof value.enabled !== 'boolean')
    || !finiteNumber(editor.controlSpacingM)
    || editor.controlSpacingM <= 0
    || !finiteNumber(editor.collisionSpacingM)
    || editor.collisionSpacingM <= 0
    || !finiteNumber(editor.simplificationToleranceM)
    || editor.simplificationToleranceM < 0
    || editor.simplificationToleranceM > 2
    || !finiteNumber(geometry.roadWidthM)
    || geometry.roadWidthM < 2
    || geometry.roadWidthM > 60
    || !Number.isInteger(geometry.laneCount)
    || (geometry.laneCount as number) < 1
    || (geometry.laneCount as number) > 8
    || typeof geometry.surface !== 'string'
    || geometry.surface.trim().length === 0
    || !isApexTrackBoundaryMode(geometry.boundaryMode)
    || !isApexTrackRoadsideMode(geometry.roadsideMode)
    || typeof geometry.visualMode !== 'string'
    || !VISUAL_MODES.includes(
      geometry.visualMode as ApexTrackSegmentVisualMode,
    )
    || !controlPoints
    || !evaluatedPoints
  ) return undefined;
  return Object.freeze({
    id: value.id,
    name: value.name,
    kind: value.kind as ApexTrackSegmentKind,
    enabled: value.enabled !== false,
    editor: Object.freeze({
      closed: editor.closed,
      controlSpacingM: editor.controlSpacingM,
      collisionSpacingM: editor.collisionSpacingM,
      simplificationToleranceM: editor.simplificationToleranceM,
    }),
    geometry: Object.freeze({
      roadWidthM: geometry.roadWidthM,
      laneCount: geometry.laneCount as number,
      surface: geometry.surface,
      boundaryMode: geometry.boundaryMode,
      roadsideMode: geometry.roadsideMode,
      visualMode: geometry.visualMode as ApexTrackSegmentVisualMode,
    }),
    controlPoints,
    evaluatedPoints,
  });
};

const parseSegments = (
  value: unknown,
): readonly ApexTrackSourceSegment[] | undefined => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10_000) {
    return undefined;
  }
  const segments = value.map(parseSegment);
  if (segments.some(segment => segment === undefined)) return undefined;
  const typed = segments as ApexTrackSourceSegment[];
  if (new Set(typed.map(segment => segment.id)).size !== typed.length) {
    return undefined;
  }
  return Object.freeze(typed);
};

const parseRoutes = (
  value: unknown,
  segmentIds: ReadonlySet<string>,
): readonly ApexTrackRoute[] | undefined => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10_000) {
    return undefined;
  }
  const routeIds = new Set<string>();
  const routes: ApexTrackRoute[] = [];
  for (const entry of value) {
    if (
      !isRecord(entry)
      || typeof entry.id !== 'string'
      || !LOCAL_ID_PATTERN.test(entry.id)
      || routeIds.has(entry.id)
      || typeof entry.name !== 'string'
      || entry.name.trim().length === 0
      || typeof entry.closed !== 'boolean'
      || !Array.isArray(entry.segments)
      || entry.segments.length < 1
    ) return undefined;
    routeIds.add(entry.id);
    const references = entry.segments.map(reference => {
      if (
        !isRecord(reference)
        || typeof reference.segmentId !== 'string'
        || !segmentIds.has(reference.segmentId)
        || typeof reference.direction !== 'string'
        || !ROUTE_DIRECTIONS.includes(
          reference.direction as ApexTrackRouteDirection,
        )
      ) return undefined;
      return Object.freeze({
        segmentId: reference.segmentId,
        direction: reference.direction as ApexTrackRouteDirection,
      });
    });
    if (references.some(reference => reference === undefined)) return undefined;
    routes.push(Object.freeze({
      id: entry.id,
      name: entry.name,
      closed: entry.closed,
      segments: Object.freeze(
        references as ApexTrackRoute['segments'][number][],
      ),
    }));
  }
  return Object.freeze(routes);
};

const parseJunctions = (
  value: unknown,
  segmentIds: ReadonlySet<string>,
): readonly ApexTrackJunction[] | undefined => {
  if (!Array.isArray(value) || value.length > 100_000) return undefined;
  const junctionIds = new Set<string>();
  const junctions: ApexTrackJunction[] = [];
  for (const entry of value) {
    if (
      !isRecord(entry)
      || typeof entry.id !== 'string'
      || !LOCAL_ID_PATTERN.test(entry.id)
      || junctionIds.has(entry.id)
      || typeof entry.kind !== 'string'
      || !JUNCTION_KINDS.includes(entry.kind as ApexTrackJunctionKind)
      || !Array.isArray(entry.connections)
      || entry.connections.length < 2
    ) return undefined;
    junctionIds.add(entry.id);
    const connectionKeys = new Set<string>();
    const connections = entry.connections.map(connection => {
      if (
        !isRecord(connection)
        || typeof connection.segmentId !== 'string'
        || !segmentIds.has(connection.segmentId)
        || (
          connection.endpoint !== 'start'
          && connection.endpoint !== 'end'
        )
      ) return undefined;
      const key = `${connection.segmentId}:${connection.endpoint}`;
      if (connectionKeys.has(key)) return undefined;
      connectionKeys.add(key);
      return Object.freeze({
        segmentId: connection.segmentId,
        endpoint: connection.endpoint,
      });
    });
    if (connections.some(connection => connection === undefined)) {
      return undefined;
    }
    junctions.push(Object.freeze({
      id: entry.id,
      kind: entry.kind as ApexTrackJunctionKind,
      connections: Object.freeze(
        connections as ApexTrackJunction['connections'][number][],
      ),
    }));
  }
  return Object.freeze(junctions);
};

export const apexTrackDraftStorageKey = (
  identity: ApexTrackDraftIdentity,
): string => [
  'apex-run.v3.track-editor-draft',
  identity.trackId,
  identity.trackVersion,
].join('.');

const normalizeDraft = (
  identity: ApexTrackDraftIdentity,
  value: Record<string, unknown>,
  segments: readonly ApexTrackSourceSegment[],
  activeSegmentId: string,
  primaryRouteId: string,
  junctions: readonly ApexTrackJunction[],
  routes: readonly ApexTrackRoute[],
): ApexTrackDraft | undefined => {
  const activeSegment = segments.find(segment => segment.id === activeSegmentId);
  if (
    !activeSegment
    || !routes.some(route => route.id === primaryRouteId)
  ) return undefined;
  const asTrackPoints = (
    points: readonly ApexTrackNetworkPoint[],
  ): readonly TrackPoint[] => Object.freeze(points.map(point => Object.freeze({
    x: point.x,
    y: point.y,
    z: point.z,
    bankRadians: point.bankRadians,
    surface: point.surface as TrackPoint['surface'],
  })));
  return Object.freeze({
    format: APEX_TRACK_DRAFT_FORMAT,
    formatVersion: APEX_TRACK_DRAFT_FORMAT_VERSION,
    trackId: identity.trackId,
    trackVersion: identity.trackVersion,
    savedAtIso: value.savedAtIso as string,
    activeSegmentId,
    primaryRouteId,
    segments,
    junctions,
    routes,
    closed: activeSegment.editor.closed,
    controlSpacingM: activeSegment.editor.controlSpacingM,
    collisionSpacingM: activeSegment.editor.collisionSpacingM,
    roadWidthM: activeSegment.geometry.roadWidthM,
    boundaryMode: activeSegment.geometry.boundaryMode,
    roadsideMode: activeSegment.geometry.roadsideMode,
    simplificationToleranceM: (
      activeSegment.editor.simplificationToleranceM
    ),
    controlPoints: asTrackPoints(activeSegment.controlPoints),
    evaluatedPoints: asTrackPoints(activeSegment.evaluatedPoints),
  });
};

const migrateLegacyDraft = (
  identity: ApexTrackDraftIdentity,
  value: Record<string, unknown>,
): ApexTrackDraft | undefined => {
  const controlPoints = parsePoints(value.controlPoints);
  const evaluatedPoints = parsePoints(value.evaluatedPoints);
  const legacyV2 = value.formatVersion === 2;
  const legacyV3 = value.formatVersion === 3;
  const legacyV4 = value.formatVersion === 4;
  const legacyV5 = value.formatVersion === 5;
  const boundaryMode = isApexTrackBoundaryMode(value.boundaryMode)
    ? value.boundaryMode
    : legacyV2 ? identity.defaultBoundaryMode : undefined;
  const roadsideMode = isApexTrackRoadsideMode(value.roadsideMode)
    ? value.roadsideMode
    : (legacyV2 || legacyV3) ? identity.defaultRoadsideMode : undefined;
  const simplificationToleranceM = finiteNumber(
    value.simplificationToleranceM,
  )
    ? value.simplificationToleranceM
    : (legacyV2 || legacyV3 || legacyV4) ? 0 : undefined;
  if (
    (!legacyV2 && !legacyV3 && !legacyV4 && !legacyV5)
    || typeof value.closed !== 'boolean'
    || !finiteNumber(value.controlSpacingM)
    || !finiteNumber(value.collisionSpacingM)
    || !finiteNumber(value.roadWidthM)
    || value.roadWidthM < 2
    || value.roadWidthM > 60
    || !boundaryMode
    || !roadsideMode
    || simplificationToleranceM === undefined
    || simplificationToleranceM < 0
    || simplificationToleranceM > 2
    || !controlPoints
    || !evaluatedPoints
  ) return undefined;
  const segment = Object.freeze({
    id: 'main',
    name: 'Trazado principal',
    kind: 'road' as const,
    enabled: true,
    editor: Object.freeze({
      closed: value.closed,
      controlSpacingM: value.controlSpacingM,
      collisionSpacingM: value.collisionSpacingM,
      simplificationToleranceM,
    }),
    geometry: Object.freeze({
      roadWidthM: value.roadWidthM,
      laneCount: identity.defaultLaneCount ?? 1,
      surface: identity.defaultSurface ?? 'asphalt',
      boundaryMode,
      roadsideMode,
      visualMode: identity.defaultVisualMode ?? 'inherit',
    }),
    controlPoints,
    evaluatedPoints,
  });
  const route = Object.freeze({
    id: 'main-route',
    name: 'Recorrido principal',
    closed: segment.editor.closed,
    segments: Object.freeze([
      Object.freeze({ segmentId: segment.id, direction: 'forward' as const }),
    ]),
  });
  return normalizeDraft(
    identity,
    value,
    Object.freeze([segment]),
    segment.id,
    route.id,
    Object.freeze([]),
    Object.freeze([route]),
  );
};

export const parseApexTrackDraft = (
  identity: ApexTrackDraftIdentity,
  input: unknown,
): ApexTrackDraft | undefined => {
  if (!isRecord(input)) return undefined;
  const value = input;
  try {
    if (
      value.format !== APEX_TRACK_DRAFT_FORMAT
      || value.trackId !== identity.trackId
      || value.trackVersion !== identity.trackVersion
      || typeof value.savedAtIso !== 'string'
    ) return undefined;
    if (value.formatVersion !== APEX_TRACK_DRAFT_FORMAT_VERSION) {
      return migrateLegacyDraft(identity, value);
    }
    if (
      typeof value.activeSegmentId !== 'string'
      || !LOCAL_ID_PATTERN.test(value.activeSegmentId)
    ) return undefined;
    const segments = parseSegments(value.segments);
    if (!segments) return undefined;
    const segmentIds = new Set(segments.map(segment => segment.id));
    const routes = parseRoutes(value.routes, segmentIds);
    const junctions = parseJunctions(value.junctions, segmentIds);
    if (
      typeof value.primaryRouteId !== 'string'
      || !LOCAL_ID_PATTERN.test(value.primaryRouteId)
      || !routes
      || !junctions
    ) return undefined;
    return normalizeDraft(
      identity,
      value,
      segments,
      value.activeSegmentId,
      value.primaryRouteId,
      junctions,
      routes,
    );
  } catch {
    return undefined;
  }
};

export const loadApexTrackDraft = (
  identity: ApexTrackDraftIdentity,
): ApexTrackDraft | undefined => {
  let raw: string | null;
  try {
    raw = localStorage.getItem(apexTrackDraftStorageKey(identity));
  } catch {
    return undefined;
  }
  if (!raw) return undefined;
  try {
    return parseApexTrackDraft(identity, JSON.parse(raw));
  } catch {
    return undefined;
  }
};

export const saveApexTrackDraft = (
  draft: ApexTrackDraft,
): boolean => {
  try {
    localStorage.setItem(
      apexTrackDraftStorageKey(draft),
      JSON.stringify(draft),
    );
    return true;
  } catch {
    return false;
  }
};
