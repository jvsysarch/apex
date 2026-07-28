import rawDefinition from './003-circuito-vector-v1.0.0.track.json';
import { parseApexDriveTrack } from '../formats/ApexDriveTrack';

export const CIRCUITO_VECTOR_TRACK = parseApexDriveTrack(rawDefinition);
