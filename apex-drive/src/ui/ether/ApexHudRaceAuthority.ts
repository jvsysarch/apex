import type { LapTimingState } from '../../race/ApexLapTimer';

export interface ApexHudRaceAuthority {
  readonly bestLapMs: number | undefined;
}

export interface ApexHudResolvedRaceTiming {
  readonly bestLapMs: number | undefined;
  readonly lapDeltaMs: number | undefined;
}

export const resolveApexHudRaceTiming = (
  state: LapTimingState,
  authority?: ApexHudRaceAuthority,
): ApexHudResolvedRaceTiming => {
  if (authority === undefined) {
    return {
      bestLapMs: state.bestLapMs,
      lapDeltaMs: state.lapDeltaMs,
    };
  }
  const bestLapMs = authority.bestLapMs;
  return {
    bestLapMs,
    lapDeltaMs: bestLapMs === undefined || state.lastLapMs === undefined
      ? undefined
      : state.lastLapMs - bestLapMs,
  };
};
