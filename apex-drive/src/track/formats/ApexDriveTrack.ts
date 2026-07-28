import type { ApexTrackBoundaryMode } from '../TrackBoundaryMode';
import { isApexTrackBoundaryMode } from '../TrackBoundaryMode';
import type { ApexTrackRoadsideMode } from '../TrackRoadsideMode';
import { isApexTrackRoadsideMode } from '../TrackRoadsideMode';

export const APEX_DRIVE_TRACK_FORMAT = 'apex-drive-track';
export const APEX_DRIVE_TRACK_FORMAT_VERSION = 1;
export const APEX_DRIVE_PROFILE = 'apex-drive';
export const APEX_DRIVE_PROFILE_VERSION = 1;

export interface ApexDriveTrackAsset {
  readonly format: 'procedural' | 'glb';
  readonly generator?: string;
  readonly uri: string | null;
}

export interface ApexDriveCollisionAsset {
  readonly format: 'generated' | 'glb';
  readonly uri: string | null;
}

export interface ApexDriveTrackDefinition {
  readonly format: typeof APEX_DRIVE_TRACK_FORMAT;
  readonly formatVersion: typeof APEX_DRIVE_TRACK_FORMAT_VERSION;
  readonly track: {
    readonly number: number;
    readonly id: string;
    readonly name: string;
    readonly version: string;
  };
  readonly assets: {
    readonly visual: ApexDriveTrackAsset;
    readonly collision: ApexDriveCollisionAsset;
  };
  readonly configuration: {
    readonly profile: typeof APEX_DRIVE_PROFILE;
    readonly profileVersion: typeof APEX_DRIVE_PROFILE_VERSION;
    readonly coordinateSystem: {
      readonly unit: 'meter';
      readonly upAxis: 'Y';
      readonly handedness: 'right';
    };
    readonly start: {
      readonly position: {
        readonly x: number;
        readonly y: number;
        readonly z: number;
      };
      readonly yawRadians: number;
    };
    readonly geometry: {
      readonly roadWidthM: number;
      readonly shoulderWidthM: number;
      readonly groundHeightM: number;
      readonly roadThicknessM: number;
      readonly boundaryMode: ApexTrackBoundaryMode;
      readonly roadsideMode: ApexTrackRoadsideMode;
    };
    readonly timing: {
      readonly startRadiusM: number;
      readonly checkpointRadiusM: number;
      readonly checkpointIntervalPoints: number;
      readonly ignoredTailPoints: number;
      readonly sectorCount: number;
      readonly storageKey: string;
    };
    readonly surfaces: {
      readonly road: string;
      readonly shoulder: string;
      readonly ground: string;
    };
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const recordAt = (value: unknown, path: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error(`${path} debe ser un objeto`);
  return value;
};

const stringAt = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${path} debe ser un texto no vacío`);
  }
  return value;
};

const numberAt = (value: unknown, path: string, minimum?: number): number => {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || (minimum !== undefined && value < minimum)
  ) {
    throw new Error(`${path} debe ser un número válido`);
  }
  return value;
};

const integerAt = (value: unknown, path: string, minimum: number): number => {
  const parsed = numberAt(value, path, minimum);
  if (!Number.isInteger(parsed)) throw new Error(`${path} debe ser un entero`);
  return parsed;
};

const nullableStringAt = (value: unknown, path: string): string | null => (
  value === null ? null : stringAt(value, path)
);

const literalAt = <T extends string | number>(
  value: unknown,
  expected: T,
  path: string,
): T => {
  if (value !== expected) throw new Error(`${path} debe ser ${String(expected)}`);
  return expected;
};

const oneOfAt = <T extends string>(
  value: unknown,
  options: readonly T[],
  path: string,
): T => {
  if (typeof value !== 'string' || !options.includes(value as T)) {
    throw new Error(`${path} debe ser ${options.join(' o ')}`);
  }
  return value as T;
};

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(child => deepFreeze(child));
    Object.freeze(value);
  }
  return value;
};

/**
 * Valida el límite entre archivos editables y el runtime. Así un futuro
 * editor puede producir JSON sin convertir errores de contenido en NaN o
 * geometría inválida dentro de Three/Jolt.
 */
export const parseApexDriveTrack = (input: unknown): ApexDriveTrackDefinition => {
  const root = recordAt(input, 'track');
  literalAt(root.format, APEX_DRIVE_TRACK_FORMAT, 'format');
  literalAt(root.formatVersion, APEX_DRIVE_TRACK_FORMAT_VERSION, 'formatVersion');

  const track = recordAt(root.track, 'track');
  integerAt(track.number, 'track.number', 1);
  const id = stringAt(track.id, 'track.id');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error('track.id debe usar minúsculas, números y guiones');
  }
  stringAt(track.name, 'track.name');
  const version = stringAt(track.version, 'track.version');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('track.version debe usar versionado semántico');
  }

  const assets = recordAt(root.assets, 'assets');
  const visual = recordAt(assets.visual, 'assets.visual');
  const visualFormat = oneOfAt(
    visual.format,
    ['procedural', 'glb'] as const,
    'assets.visual.format',
  );
  const visualUri = nullableStringAt(visual.uri, 'assets.visual.uri');
  if (visualFormat === 'procedural') {
    stringAt(visual.generator, 'assets.visual.generator');
  } else if (!visualUri?.toLowerCase().endsWith('.glb')) {
    throw new Error('assets.visual.uri debe apuntar a un archivo .glb');
  }

  const collision = recordAt(assets.collision, 'assets.collision');
  const collisionFormat = oneOfAt(
    collision.format,
    ['generated', 'glb'] as const,
    'assets.collision.format',
  );
  const collisionUri = nullableStringAt(collision.uri, 'assets.collision.uri');
  if (collisionFormat === 'glb' && !collisionUri?.toLowerCase().endsWith('.glb')) {
    throw new Error('assets.collision.uri debe apuntar a un archivo .glb');
  }

  const configuration = recordAt(root.configuration, 'configuration');
  literalAt(configuration.profile, APEX_DRIVE_PROFILE, 'configuration.profile');
  literalAt(
    configuration.profileVersion,
    APEX_DRIVE_PROFILE_VERSION,
    'configuration.profileVersion',
  );

  const coordinates = recordAt(
    configuration.coordinateSystem,
    'configuration.coordinateSystem',
  );
  literalAt(coordinates.unit, 'meter', 'configuration.coordinateSystem.unit');
  literalAt(coordinates.upAxis, 'Y', 'configuration.coordinateSystem.upAxis');
  literalAt(
    coordinates.handedness,
    'right',
    'configuration.coordinateSystem.handedness',
  );

  const start = recordAt(configuration.start, 'configuration.start');
  const position = recordAt(start.position, 'configuration.start.position');
  numberAt(position.x, 'configuration.start.position.x');
  numberAt(position.y, 'configuration.start.position.y');
  numberAt(position.z, 'configuration.start.position.z');
  numberAt(start.yawRadians, 'configuration.start.yawRadians');

  const geometry = recordAt(configuration.geometry, 'configuration.geometry');
  numberAt(geometry.roadWidthM, 'configuration.geometry.roadWidthM', 0.1);
  numberAt(geometry.shoulderWidthM, 'configuration.geometry.shoulderWidthM', 0);
  numberAt(geometry.groundHeightM, 'configuration.geometry.groundHeightM');
  numberAt(geometry.roadThicknessM, 'configuration.geometry.roadThicknessM', 0.001);
  if (!isApexTrackBoundaryMode(geometry.boundaryMode)) {
    throw new Error(
      'configuration.geometry.boundaryMode debe ser guardrails o walls',
    );
  }
  if (!isApexTrackRoadsideMode(geometry.roadsideMode)) {
    throw new Error(
      'configuration.geometry.roadsideMode debe ser none, shoulder '
      + 'o adaptive-terrain',
    );
  }

  const timing = recordAt(configuration.timing, 'configuration.timing');
  numberAt(timing.startRadiusM, 'configuration.timing.startRadiusM', 0.1);
  numberAt(timing.checkpointRadiusM, 'configuration.timing.checkpointRadiusM', 0.1);
  integerAt(
    timing.checkpointIntervalPoints,
    'configuration.timing.checkpointIntervalPoints',
    1,
  );
  integerAt(timing.ignoredTailPoints, 'configuration.timing.ignoredTailPoints', 0);
  integerAt(timing.sectorCount, 'configuration.timing.sectorCount', 1);
  stringAt(timing.storageKey, 'configuration.timing.storageKey');

  const surfaces = recordAt(configuration.surfaces, 'configuration.surfaces');
  stringAt(surfaces.road, 'configuration.surfaces.road');
  stringAt(surfaces.shoulder, 'configuration.surfaces.shoulder');
  stringAt(surfaces.ground, 'configuration.surfaces.ground');

  return deepFreeze(root) as unknown as ApexDriveTrackDefinition;
};
