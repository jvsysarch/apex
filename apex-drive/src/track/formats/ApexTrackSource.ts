import {
  APEX_DRIVE_TRACK_FORMAT,
  APEX_DRIVE_TRACK_FORMAT_VERSION,
  parseApexDriveTrack,
  type ApexDriveTrackDefinition,
} from './ApexDriveTrack';
import {
  primaryApexTrackSegment,
  type ApexTrackJunction,
  type ApexTrackJunctionKind,
  type ApexTrackNetwork,
  type ApexTrackNetworkPoint,
  type ApexTrackRoute,
  type ApexTrackRouteDirection,
  type ApexTrackSourceSegment,
  type ApexTrackSegmentKind,
  type ApexTrackSegmentVisualMode,
} from './ApexTrackNetwork';
import { isApexTrackBoundaryMode } from '../TrackBoundaryMode';
import { isApexTrackRoadsideMode } from '../TrackRoadsideMode';
import {
  APEX_VOID_ENABLED,
  apexVoidClient,
} from '../../runtime/ApexVoidRuntime';

export const APEX_TRACK_SOURCE_FORMAT = 'apex-track-source';
export const APEX_TRACK_SOURCE_FORMAT_VERSION = 2;
export const APEX_TRACK_SOURCE_LEGACY_FORMAT_VERSION = 1;
const bundledTrackSources = import.meta.glob(
  '../generated/*-track-source.json',
  {
    eager: true,
    import: 'default',
  },
) as Record<string, unknown>;

export type ApexTrackSourcePoint = ApexTrackNetworkPoint;

/**
 * Fuente normalizada. Incluso una fuente serializada como V1 sale del parser
 * con segmentos/routes V2. Los aliases editor/controlPoints/evaluatedPoints
 * apuntan al segmento primario mientras el runtime y el editor V5 completan la
 * migración multisegmento.
 */
export interface ApexTrackSource extends ApexTrackNetwork {
  readonly format: typeof APEX_TRACK_SOURCE_FORMAT;
  readonly formatVersion: typeof APEX_TRACK_SOURCE_FORMAT_VERSION;
  readonly serializedFormatVersion:
    | typeof APEX_TRACK_SOURCE_LEGACY_FORMAT_VERSION
    | typeof APEX_TRACK_SOURCE_FORMAT_VERSION;
  readonly savedAtIso: string;
  readonly definition: ApexDriveTrackDefinition;
  readonly primarySegmentId: string;
  readonly primarySegment: ApexTrackSourceSegment;
  readonly editor: ApexTrackSourceSegment['editor'];
  readonly controlPoints: readonly ApexTrackSourcePoint[];
  readonly evaluatedPoints: readonly ApexTrackSourcePoint[];
}

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
const ENDPOINTS = Object.freeze(['start', 'end'] as const);
const LOCAL_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const finiteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const parseLocalId = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || !LOCAL_ID_PATTERN.test(value)) {
    throw new Error(`${path} debe ser un ID local válido`);
  }
  return value;
};

const parseText = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${path} debe ser un texto no vacío`);
  }
  return value;
};

const parseEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T => {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${path} debe ser ${allowed.join(', ')}`);
  }
  return value as T;
};

const parsePoints = (
  value: unknown,
  path: string,
): readonly ApexTrackSourcePoint[] => {
  if (!Array.isArray(value) || value.length < 2 || value.length > 100_000) {
    throw new Error(`${path} debe contener entre 2 y 100000 puntos`);
  }
  return Object.freeze(value.map((entry, index) => {
    if (
      !isRecord(entry)
      || !finiteNumber(entry.x)
      || !finiteNumber(entry.y)
      || !finiteNumber(entry.z)
      || !finiteNumber(entry.bankRadians)
    ) {
      throw new Error(`${path}[${index}] no es válido`);
    }
    return Object.freeze({
      x: entry.x,
      y: entry.y,
      z: entry.z,
      bankRadians: entry.bankRadians,
      ...(typeof entry.surface === 'string'
        ? { surface: entry.surface }
        : {}),
    });
  }));
};

const parseEditor = (
  value: unknown,
  path: string,
): ApexTrackSourceSegment['editor'] => {
  if (!isRecord(value)) throw new Error(`${path} debe ser un objeto`);
  if (
    typeof value.closed !== 'boolean'
    || !finiteNumber(value.controlSpacingM)
    || !finiteNumber(value.collisionSpacingM)
    || !finiteNumber(value.simplificationToleranceM)
    || value.controlSpacingM <= 0
    || value.collisionSpacingM <= 0
    || value.simplificationToleranceM < 0
    || value.simplificationToleranceM > 2
  ) {
    throw new Error(`${path} no es una configuración de edición válida`);
  }
  return Object.freeze({
    closed: value.closed,
    controlSpacingM: value.controlSpacingM,
    collisionSpacingM: value.collisionSpacingM,
    simplificationToleranceM: value.simplificationToleranceM,
  });
};

const parseSegment = (
  value: unknown,
  index: number,
  definition: ApexDriveTrackDefinition,
): ApexTrackSourceSegment => {
  const path = `segments[${index}]`;
  if (!isRecord(value) || !isRecord(value.geometry)) {
    throw new Error(`${path} debe ser un segmento válido`);
  }
  const geometry = value.geometry;
  if (
    (value.enabled !== undefined && typeof value.enabled !== 'boolean')
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
  ) {
    throw new Error(`${path}.geometry no es válida`);
  }
  return Object.freeze({
    id: parseLocalId(value.id, `${path}.id`),
    name: parseText(value.name, `${path}.name`),
    kind: parseEnum(value.kind, SEGMENT_KINDS, `${path}.kind`),
    enabled: value.enabled !== false,
    editor: parseEditor(value.editor, `${path}.editor`),
    geometry: Object.freeze({
      roadWidthM: geometry.roadWidthM,
      laneCount: geometry.laneCount as number,
      surface: geometry.surface,
      boundaryMode: geometry.boundaryMode,
      roadsideMode: geometry.roadsideMode,
      visualMode: parseEnum(
        geometry.visualMode,
        VISUAL_MODES,
        `${path}.geometry.visualMode`,
      ),
    }),
    controlPoints: parsePoints(value.controlPoints, `${path}.controlPoints`),
    evaluatedPoints: parsePoints(
      value.evaluatedPoints,
      `${path}.evaluatedPoints`,
    ),
  });
};

const parseRoutes = (
  value: unknown,
  segmentIds: ReadonlySet<string>,
): readonly ApexTrackRoute[] => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10_000) {
    throw new Error('routes debe contener entre 1 y 10000 recorridos');
  }
  const routeIds = new Set<string>();
  return Object.freeze(value.map((entry, index) => {
    const path = `routes[${index}]`;
    if (
      !isRecord(entry)
      || typeof entry.closed !== 'boolean'
      || !Array.isArray(entry.segments)
      || entry.segments.length < 1
    ) {
      throw new Error(`${path} no es un recorrido válido`);
    }
    const id = parseLocalId(entry.id, `${path}.id`);
    if (routeIds.has(id)) throw new Error(`ID de route duplicado: ${id}`);
    routeIds.add(id);
    const segments = Object.freeze(entry.segments.map((reference, refIndex) => {
      if (!isRecord(reference)) {
        throw new Error(`${path}.segments[${refIndex}] no es válido`);
      }
      const segmentId = parseLocalId(
        reference.segmentId,
        `${path}.segments[${refIndex}].segmentId`,
      );
      if (!segmentIds.has(segmentId)) {
        throw new Error(`${path} referencia el segmento inexistente ${segmentId}`);
      }
      return Object.freeze({
        segmentId,
        direction: parseEnum(
          reference.direction,
          ROUTE_DIRECTIONS,
          `${path}.segments[${refIndex}].direction`,
        ),
      });
    }));
    return Object.freeze({
      id,
      name: parseText(entry.name, `${path}.name`),
      closed: entry.closed,
      segments,
    });
  }));
};

const parseJunctions = (
  value: unknown,
  segmentIds: ReadonlySet<string>,
): readonly ApexTrackJunction[] => {
  if (!Array.isArray(value) || value.length > 100_000) {
    throw new Error('junctions debe ser un array válido');
  }
  const junctionIds = new Set<string>();
  return Object.freeze(value.map((entry, index) => {
    const path = `junctions[${index}]`;
    if (
      !isRecord(entry)
      || !Array.isArray(entry.connections)
      || entry.connections.length < 2
    ) {
      throw new Error(`${path} debe conectar al menos dos extremos`);
    }
    const id = parseLocalId(entry.id, `${path}.id`);
    if (junctionIds.has(id)) throw new Error(`ID de junction duplicado: ${id}`);
    junctionIds.add(id);
    const connectionKeys = new Set<string>();
    const connections = Object.freeze(entry.connections.map(
      (connection, connectionIndex) => {
        if (!isRecord(connection)) {
          throw new Error(`${path}.connections[${connectionIndex}] no es válido`);
        }
        const segmentId = parseLocalId(
          connection.segmentId,
          `${path}.connections[${connectionIndex}].segmentId`,
        );
        if (!segmentIds.has(segmentId)) {
          throw new Error(`${path} referencia el segmento inexistente ${segmentId}`);
        }
        const endpoint = parseEnum(
          connection.endpoint,
          ENDPOINTS,
          `${path}.connections[${connectionIndex}].endpoint`,
        );
        const key = `${segmentId}:${endpoint}`;
        if (connectionKeys.has(key)) {
          throw new Error(`${path} repite la conexión ${key}`);
        }
        connectionKeys.add(key);
        return Object.freeze({ segmentId, endpoint });
      },
    ));
    return Object.freeze({
      id,
      kind: parseEnum(entry.kind, JUNCTION_KINDS, `${path}.kind`),
      connections,
    });
  }));
};

const parseDefinition = (input: Record<string, unknown>) => parseApexDriveTrack({
  format: APEX_DRIVE_TRACK_FORMAT,
  formatVersion: APEX_DRIVE_TRACK_FORMAT_VERSION,
  track: input.track,
  assets: input.assets,
  configuration: input.configuration,
});

const normalizeSource = (
  serializedFormatVersion: 1 | 2,
  savedAtIso: string,
  definition: ApexDriveTrackDefinition,
  network: ApexTrackNetwork,
): ApexTrackSource => {
  const primaryRoute = network.routes.find(
    route => route.id === network.primaryRouteId,
  );
  if (!primaryRoute) {
    throw new Error(`No existe el route primario ${network.primaryRouteId}`);
  }
  const primarySegment = primaryApexTrackSegment(network);
  return Object.freeze({
    format: APEX_TRACK_SOURCE_FORMAT,
    formatVersion: APEX_TRACK_SOURCE_FORMAT_VERSION,
    serializedFormatVersion,
    savedAtIso,
    definition,
    primaryRouteId: network.primaryRouteId,
    segments: network.segments,
    junctions: network.junctions,
    routes: network.routes,
    primarySegmentId: primarySegment.id,
    primarySegment,
    editor: primarySegment.editor,
    controlPoints: primarySegment.controlPoints,
    evaluatedPoints: primarySegment.evaluatedPoints,
  });
};

const parseV1Source = (
  input: Record<string, unknown>,
  definition: ApexDriveTrackDefinition,
): ApexTrackSource => {
  const editor = parseEditor(input.editor, 'editor');
  const segment = Object.freeze({
    id: 'main',
    name: 'Trazado principal',
    kind: 'road' as const,
    enabled: true,
    editor,
    geometry: Object.freeze({
      roadWidthM: definition.configuration.geometry.roadWidthM,
      laneCount: definition.track.id === 'autopista-cumbre' ? 3 : 1,
      surface: definition.configuration.surfaces.road,
      boundaryMode: definition.configuration.geometry.boundaryMode,
      roadsideMode: definition.configuration.geometry.roadsideMode,
      visualMode: (
        definition.assets.visual.format === 'glb'
          ? 'collision-only'
          : 'inherit'
      ) as ApexTrackSegmentVisualMode,
    }),
    controlPoints: parsePoints(input.controlPoints, 'controlPoints'),
    evaluatedPoints: parsePoints(input.evaluatedPoints, 'evaluatedPoints'),
  });
  const route = Object.freeze({
    id: 'main-route',
    name: 'Recorrido principal',
    closed: editor.closed,
    segments: Object.freeze([
      Object.freeze({ segmentId: segment.id, direction: 'forward' as const }),
    ]),
  });
  return normalizeSource(
    APEX_TRACK_SOURCE_LEGACY_FORMAT_VERSION,
    input.savedAtIso as string,
    definition,
    Object.freeze({
      primaryRouteId: route.id,
      segments: Object.freeze([segment]),
      junctions: Object.freeze([]),
      routes: Object.freeze([route]),
    }),
  );
};

const parseV2Source = (
  input: Record<string, unknown>,
  definition: ApexDriveTrackDefinition,
): ApexTrackSource => {
  if (!Array.isArray(input.segments) || input.segments.length < 1) {
    throw new Error('segments debe contener al menos un segmento');
  }
  const segments = Object.freeze(input.segments.map(
    (segment, index) => parseSegment(segment, index, definition),
  ));
  const segmentIds = new Set<string>();
  segments.forEach(segment => {
    if (segmentIds.has(segment.id)) {
      throw new Error(`ID de segmento duplicado: ${segment.id}`);
    }
    segmentIds.add(segment.id);
  });
  const routes = parseRoutes(input.routes, segmentIds);
  const junctions = parseJunctions(input.junctions, segmentIds);
  const primaryRouteId = parseLocalId(
    input.primaryRouteId,
    'primaryRouteId',
  );
  return normalizeSource(
    APEX_TRACK_SOURCE_FORMAT_VERSION,
    input.savedAtIso as string,
    definition,
    Object.freeze({ primaryRouteId, segments, junctions, routes }),
  );
};

export const parseApexTrackSource = (input: unknown): ApexTrackSource => {
  if (!isRecord(input)) throw new Error('La fuente de pista debe ser un objeto');
  if (
    input.format !== APEX_TRACK_SOURCE_FORMAT
    || (
      input.formatVersion !== APEX_TRACK_SOURCE_LEGACY_FORMAT_VERSION
      && input.formatVersion !== APEX_TRACK_SOURCE_FORMAT_VERSION
    )
    || typeof input.savedAtIso !== 'string'
  ) {
    throw new Error('Se esperaba apex-track-source@1 o @2');
  }
  const definition = parseDefinition(input);
  return input.formatVersion === APEX_TRACK_SOURCE_LEGACY_FORMAT_VERSION
    ? parseV1Source(input, definition)
    : parseV2Source(input, definition);
};

export const loadGeneratedApexTrackSource = async (
  trackId: string,
  trackVersion: string,
): Promise<ApexTrackSource | undefined> => {
  if (
    typeof window !== 'undefined'
    && APEX_VOID_ENABLED
  ) {
    try {
      const storedSource = await apexVoidClient.loadMapSource<unknown>({
        trackId,
        trackVersion,
      });
      if (storedSource) {
        const source = parseApexTrackSource(storedSource);
        if (
          source.definition.track.id !== trackId
          || source.definition.track.version !== trackVersion
        ) {
          throw new Error(
            'La identidad de la fuente no coincide con el catálogo',
          );
        }
        return source;
      }
    } catch (error) {
      console.warn(
        `Servidor de fuentes no disponible para ${trackId}@${trackVersion}`,
        error,
      );
    }
  }
  for (const [path, rawSource] of Object.entries(bundledTrackSources)) {
    try {
      const source = parseApexTrackSource(rawSource);
      if (
        source.definition.track.id === trackId
        && source.definition.track.version === trackVersion
      ) return source;
    } catch (error) {
      console.warn(`Fuente empaquetada inválida: ${path}`, error);
    }
  }
  return undefined;
};
