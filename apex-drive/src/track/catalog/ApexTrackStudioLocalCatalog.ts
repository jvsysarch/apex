import {
  parseApexDriveTrack,
  type ApexDriveTrackDefinition,
} from '../formats/ApexDriveTrack';
import { PROCEDURAL_LANDSCAPE_TRACK } from './ProceduralLandscapeDefinition';

const LOCAL_TRACK_CATALOG_KEY = 'apex-track-studio.local-catalog.v1';

const readCatalogValue = (): unknown => {
  if (typeof window === 'undefined') return [];
  try {
    const serialized = window.localStorage.getItem(LOCAL_TRACK_CATALOG_KEY);
    return serialized ? JSON.parse(serialized) : [];
  } catch {
    return [];
  }
};

export const readApexTrackStudioLocalTracks = (
): readonly ApexDriveTrackDefinition[] => {
  const value = readCatalogValue();
  if (!Array.isArray(value)) return Object.freeze([]);
  const definitions: ApexDriveTrackDefinition[] = [];
  const ids = new Set<string>();
  for (const candidate of value) {
    try {
      const definition = parseApexDriveTrack(candidate);
      if (ids.has(definition.track.id)) continue;
      ids.add(definition.track.id);
      definitions.push(definition);
    } catch {
      // Una entrada local corrupta no debe impedir que el editor arranque.
    }
  }
  return Object.freeze(definitions);
};

const slugify = (value: string): string => (
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  || 'pista'
);

const uniqueTrackId = (
  name: string,
  definitions: readonly ApexDriveTrackDefinition[],
): string => {
  const base = `local-${slugify(name)}`;
  const ids = new Set(definitions.map(definition => definition.track.id));
  if (!ids.has(base)) return base;
  let suffix = 2;
  while (ids.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};

export const createApexTrackStudioLocalTrack = (
  name: string,
  existingDefinitions: readonly ApexDriveTrackDefinition[],
): ApexDriveTrackDefinition => {
  const normalizedName = name.trim().replace(/\s+/g, ' ');
  if (normalizedName.length < 3 || normalizedName.length > 80) {
    throw new Error('El nombre debe contener entre 3 y 80 caracteres');
  }
  const localDefinitions = readApexTrackStudioLocalTracks();
  const allDefinitions = [...existingDefinitions, ...localDefinitions];
  const id = uniqueTrackId(normalizedName, allDefinitions);
  const number = Math.max(
    100,
    ...allDefinitions.map(definition => definition.track.number),
  ) + 1;
  const definition = parseApexDriveTrack({
    ...PROCEDURAL_LANDSCAPE_TRACK,
    track: {
      ...PROCEDURAL_LANDSCAPE_TRACK.track,
      number,
      id,
      name: normalizedName,
      version: '0.1.0',
    },
    configuration: {
      ...PROCEDURAL_LANDSCAPE_TRACK.configuration,
      presentation: {
        garage: false,
        startLine: false,
      },
      timing: {
        ...PROCEDURAL_LANDSCAPE_TRACK.configuration.timing,
        storageKey: `apex-track-studio.${id}.lap-timing.v1`,
      },
    },
  });
  try {
    window.localStorage.setItem(
      LOCAL_TRACK_CATALOG_KEY,
      JSON.stringify([...localDefinitions, definition]),
    );
  } catch {
    throw new Error('El navegador no permitió guardar la pista local');
  }
  return definition;
};

export const isApexProceduralLandscapeDefinition = (
  definition: ApexDriveTrackDefinition | undefined,
): boolean => (
  definition?.assets.visual.format === 'procedural'
  && definition.assets.visual.generator
    ?.startsWith('apex-landscape-') === true
);
