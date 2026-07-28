import rawDefinition from './004-circuito-challhuaco-v1.0.0.track.json';
import { parseApexDriveTrack } from '../formats/ApexDriveTrack';

export const CIRCUITO_CHALLHUACO_TRACK = parseApexDriveTrack(rawDefinition);
