import rawDefinition from './002-autopista-cumbre-v1.0.0.track.json';
import { parseApexDriveTrack } from '../formats/ApexDriveTrack';

export const AUTOPISTA_CUMBRE_TRACK = parseApexDriveTrack(rawDefinition);
