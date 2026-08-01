import type { SurfaceId } from '@jvsysarch/apex-physics';
import type { LapTimerPhase, LapTimingHudVisibility } from '../../race/ApexLapTimer';

export type ApexHudWheelId = 'FL' | 'FR' | 'RL' | 'RR';

export interface ApexHudTrackPoint {
  readonly x: number;
  readonly z: number;
}

export interface ApexHudSessionSnapshot {
  readonly trackName: string;
  readonly trackIdentity: string;
  readonly vehicleName: string;
  readonly maximumRpm: number;
  readonly maximumSteerAngleDegrees: number;
  readonly closedTrack: boolean;
  readonly trackPoints: readonly ApexHudTrackPoint[];
}

export interface ApexHudMotionSnapshot {
  readonly sampledAtMs: number;
  readonly speedKmh: number;
  readonly rpm: number;
  readonly gear: string;
  readonly throttle: number;
  readonly brake: number;
  readonly steering: number;
}

export interface ApexHudNavigationSnapshot {
  readonly sampledAtMs: number;
  readonly positionX: number;
  readonly positionZ: number;
  readonly headingRadians: number;
}

export interface ApexHudWheelSnapshot {
  readonly id: ApexHudWheelId;
  readonly grounded: boolean;
  readonly slipRatioPercent: number;
  readonly slipAngleDegrees: number;
  readonly loadKn: number;
  readonly compression: number;
  readonly steeringAngleDegrees: number;
  readonly surface: SurfaceId;
}

export interface ApexHudVehicleSnapshot {
  readonly sampledAtMs: number;
  readonly wheels: readonly ApexHudWheelSnapshot[];
}

export interface ApexHudRaceSnapshot {
  readonly sampledAtMs: number;
  readonly phase: LapTimerPhase;
  readonly hudVisibility: LapTimingHudVisibility;
  readonly elapsedMs: number;
  readonly lapNumber: number;
  readonly completedLapCount: number;
  readonly bestLapMs?: number;
  readonly lastLapMs?: number;
  readonly lapDeltaMs?: number;
  readonly checkpointIndex: number;
  readonly checkpointCount: number;
  readonly checkpointStatuses: readonly ('pending' | 'passed' | 'missed')[];
  readonly sectorIndex: number;
  readonly sectorCount: number;
  readonly countdownSeconds?: number;
  readonly startLights: 'off' | 'red' | 'green';
  readonly startProximity: number;
  readonly startReady: boolean;
  readonly message: string;
}

export interface ApexHudState {
  readonly session: ApexHudSessionSnapshot;
  readonly motion: ApexHudMotionSnapshot;
  readonly navigation: ApexHudNavigationSnapshot;
  readonly vehicle: ApexHudVehicleSnapshot;
  readonly race: ApexHudRaceSnapshot;
}

export type ApexHudSlice = keyof ApexHudState;

export interface ApexHudDataDemand {
  readonly motion: boolean;
  readonly navigation: boolean;
  readonly vehicle: boolean;
  readonly race: boolean;
}

export interface ApexHudSessionInput {
  readonly trackName: string;
  readonly trackIdentity: string;
  readonly vehicleName: string;
  readonly maximumRpm: number;
  readonly maximumSteerAngleDegrees: number;
  readonly closedTrack: boolean;
  readonly trackPoints: readonly ApexHudTrackPoint[];
}
