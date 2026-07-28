export const APEX_TRACK_ROADSIDE_MODES = [
  'none',
  'shoulder',
  'adaptive-terrain',
] as const;

export type ApexTrackRoadsideMode = (
  typeof APEX_TRACK_ROADSIDE_MODES[number]
);

export const isApexTrackRoadsideMode = (
  value: unknown,
): value is ApexTrackRoadsideMode => (
  typeof value === 'string'
  && APEX_TRACK_ROADSIDE_MODES.includes(value as ApexTrackRoadsideMode)
);
