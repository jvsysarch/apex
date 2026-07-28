import type { ApexDriveTrackDefinition } from '../formats/ApexDriveTrack';
import { AUTOPISTA_CUMBRE_TRACK } from './AutopistaCumbreDefinition';
import { CIRCUITO_BRAVO_TRACK } from './CircuitoBravoDefinition';
import { CIRCUITO_CHALLHUACO_TRACK } from './ChallhuacoDefinition';
import { CIRCUITO_VECTOR_TRACK } from './CircuitoVectorDefinition';

export const APEX_DRIVE_TRACKS: readonly ApexDriveTrackDefinition[] = Object.freeze([
  CIRCUITO_BRAVO_TRACK,
  AUTOPISTA_CUMBRE_TRACK,
  CIRCUITO_VECTOR_TRACK,
  CIRCUITO_CHALLHUACO_TRACK,
]);

const tracksByNumber = new Map<number, ApexDriveTrackDefinition>();
const tracksById = new Map<string, ApexDriveTrackDefinition>();

for (const track of APEX_DRIVE_TRACKS) {
  if (tracksByNumber.has(track.track.number)) {
    throw new Error(`Número de pista duplicado: ${track.track.number}`);
  }
  if (tracksById.has(track.track.id)) {
    throw new Error(`ID de pista duplicado: ${track.track.id}`);
  }
  tracksByNumber.set(track.track.number, track);
  tracksById.set(track.track.id, track);
}

export const formatApexDriveTrackNumber = (number: number): string => (
  String(number).padStart(3, '0')
);

export const findApexDriveTrack = (
  identifier: number | string,
): ApexDriveTrackDefinition | undefined => (
  typeof identifier === 'number'
    ? tracksByNumber.get(identifier)
    : tracksById.get(identifier)
);
