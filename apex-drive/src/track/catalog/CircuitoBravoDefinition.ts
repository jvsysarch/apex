import rawDefinition from './001-circuit-bravo-v1.1.1.track.json';
import { parseApexDriveTrack } from '../formats/ApexDriveTrack';

export const CIRCUITO_BRAVO_TRACK = parseApexDriveTrack(rawDefinition);
