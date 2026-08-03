import rawDefinition from './005-laboratorio-paisaje-v0.1.0.track.json';
import { parseApexDriveTrack } from '../formats/ApexDriveTrack';

export const PROCEDURAL_LANDSCAPE_TRACK = parseApexDriveTrack(rawDefinition);
