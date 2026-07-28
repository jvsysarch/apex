import type { ApexTrackRoadsideMode } from './TrackRoadsideMode';

/**
 * Los circuitos importados pueden declarar lateral global cero porque su tramo
 * primario pertenece al asset. Si un tramo procedural activa banquina o
 * terreno, necesita un ancho efectivo propio aunque ese baseline sea cero.
 */
export const resolveTrackRoadsideWidthM = (
  roadsideMode: ApexTrackRoadsideMode,
  configuredShoulderWidthM: number,
  roadWidthM: number,
): number => {
  if (roadsideMode === 'none') return 0;
  if (configuredShoulderWidthM > 0.05) return configuredShoulderWidthM;
  return Math.max(6, Math.min(12, roadWidthM * 0.8));
};
