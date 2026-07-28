import type {
  ApexVehicleSpawn,
} from '@jvsysarch/apex-physics';
import {
  TEST_TRACK_IS_CLOSED,
  TEST_TRACK_POINTS,
} from '../track/ApexTestTrack';

export interface ApexRaceGridEntry {
  readonly id: string;
  readonly carId: string;
  readonly player: boolean;
}

export interface ApexRaceGridSlot extends ApexRaceGridEntry {
  readonly gridPosition: number;
  readonly row: number;
  readonly side: 'left' | 'right';
  readonly spawn: ApexVehicleSpawn;
}

const shuffled = <T>(
  values: readonly T[],
  random: () => number,
): T[] => {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

/**
 * Construye una parrilla escalonada detrás de la línea. El orden incluye al
 * piloto y se vuelve a sortear para cada carrera mediante la fuente aleatoria.
 */
export const createApexRaceGrid = (
  entries: readonly ApexRaceGridEntry[],
  random: () => number = Math.random,
): readonly ApexRaceGridSlot[] => {
  const start = TEST_TRACK_POINTS[0];
  const next = TEST_TRACK_POINTS[1];
  const forwardLength = Math.hypot(
    next.x - start.x,
    next.z - start.z,
  ) || 1;
  const forwardX = (next.x - start.x) / forwardLength;
  const forwardZ = (next.z - start.z) / forwardLength;
  const rightX = forwardZ;
  const rightZ = -forwardX;
  const yawDegrees = Math.atan2(forwardX, forwardZ) * 180 / Math.PI;
  const ordered = shuffled(entries, random);

  return Object.freeze(ordered.map((entry, index) => {
    const row = Math.floor(index / 2);
    const sideSign = index % 2 === 0 ? -1 : 1;
    const distanceBehindM = TEST_TRACK_IS_CLOSED
      ? 5.8 + row * 7.2
      : -2 + row * 7.2;
    const lateralOffsetM = !TEST_TRACK_IS_CLOSED && ordered.length === 1
      ? 0
      : sideSign * 3.1;
    return Object.freeze({
      ...entry,
      gridPosition: index + 1,
      row: row + 1,
      side: sideSign < 0 ? 'left' as const : 'right' as const,
      spawn: Object.freeze({
        x: start.x
          - forwardX * distanceBehindM
          + rightX * lateralOffsetM,
        y: start.y + 0.78,
        z: start.z
          - forwardZ * distanceBehindM
          + rightZ * lateralOffsetM,
        yawDegrees,
      }),
    });
  }));
};
