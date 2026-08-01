import type { ApexHudDataDemand } from './ApexHudContract';

export type ApexSpeedometerMode = 'off' | 'number' | 'tachometer';

export interface ApexHudPreferences {
  readonly trackIdentity: boolean;
  readonly raceTiming: boolean;
  readonly raceStatus: boolean;
  readonly vehicleDiagram: boolean;
  readonly wheelStatus: boolean;
  readonly trackMap: boolean;
  readonly speedometerMode: ApexSpeedometerMode;
}

const STORAGE_KEY = 'apex-drive.ether-hud.v3';
const LEGACY_STORAGE_KEY = 'apex-drive.ether-hud.v2';

export const DEFAULT_APEX_HUD_PREFERENCES: ApexHudPreferences = Object.freeze({
  trackIdentity: true,
  raceTiming: true,
  raceStatus: true,
  vehicleDiagram: true,
  wheelStatus: true,
  trackMap: true,
  speedometerMode: 'tachometer',
});

const booleanValue = (value: unknown): boolean => value === true;

export const readApexHudPreferences = (): ApexHudPreferences => {
  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
      ?? localStorage.getItem(LEGACY_STORAGE_KEY)
      ?? 'null',
    ) as (Partial<ApexHudPreferences> & { readonly vehicleStatus?: boolean }) | null;
    if (!stored) return DEFAULT_APEX_HUD_PREFERENCES;
    const speedometerMode: ApexSpeedometerMode = (
      stored.speedometerMode === 'number'
      || stored.speedometerMode === 'tachometer'
    ) ? stored.speedometerMode : 'off';
    return Object.freeze({
      trackIdentity: booleanValue(stored.trackIdentity),
      raceTiming: booleanValue(stored.raceTiming),
      raceStatus: booleanValue(stored.raceStatus),
      vehicleDiagram: stored.vehicleDiagram === undefined
        ? stored.vehicleStatus !== false
        : booleanValue(stored.vehicleDiagram),
      wheelStatus: stored.wheelStatus === undefined
        ? stored.vehicleStatus !== false
        : booleanValue(stored.wheelStatus),
      trackMap: booleanValue(stored.trackMap),
      speedometerMode,
    });
  } catch {
    return DEFAULT_APEX_HUD_PREFERENCES;
  }
};

export const writeApexHudPreferences = (
  preferences: ApexHudPreferences,
): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // La preferencia sigue activa durante la sesión aunque el navegador
    // rechace almacenamiento local.
  }
};

export const demandForApexHudPreferences = (
  preferences: ApexHudPreferences,
): ApexHudDataDemand => Object.freeze({
  motion: (
    preferences.speedometerMode !== 'off'
  ),
  navigation: preferences.trackMap,
  vehicle: preferences.vehicleDiagram || preferences.wheelStatus,
  race: preferences.raceTiming || preferences.raceStatus,
});
