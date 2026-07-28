export const APEX_TRACK_BOUNDARY_MODES = [
  'guardrails',
  'walls',
] as const;

export type ApexTrackBoundaryMode = (
  typeof APEX_TRACK_BOUNDARY_MODES[number]
);

export const isApexTrackBoundaryMode = (
  value: unknown,
): value is ApexTrackBoundaryMode => (
  typeof value === 'string'
  && APEX_TRACK_BOUNDARY_MODES.includes(value as ApexTrackBoundaryMode)
);
