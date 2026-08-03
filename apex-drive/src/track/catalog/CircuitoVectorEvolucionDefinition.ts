import rawDefinition from './006-circuito-vector-evolucion-v1.0.0.track.json';
import { parseApexDriveTrack } from '../formats/ApexDriveTrack';

export const CIRCUITO_VECTOR_EVOLUCION_TRACK = parseApexDriveTrack(rawDefinition);
