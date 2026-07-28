export type ApexDriveRuntimeProfile = 'standard' | 'public-demo';

const configuredProfile = import.meta.env.VITE_APEX_DRIVE_PROFILE;

export const APEX_DRIVE_RUNTIME_PROFILE: ApexDriveRuntimeProfile = (
  configuredProfile === 'public-demo' ? 'public-demo' : 'standard'
);
export const APEX_DRIVE_PUBLIC_DEMO = (
  APEX_DRIVE_RUNTIME_PROFILE === 'public-demo'
);
