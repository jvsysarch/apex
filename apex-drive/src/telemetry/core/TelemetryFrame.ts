import type { SurfaceId, SurfaceMode } from '@jvsysarch/apex-physics';
import type { TireModelId } from '@jvsysarch/apex-physics';
import type { TireOperatingParameters } from '@jvsysarch/apex-physics';

export type WheelId = 'FL' | 'FR' | 'RL' | 'RR';

export interface TelemetryFrame {
  readonly timestamp: number;
  readonly vehicle: VehicleTelemetry;
  readonly drivetrain: DrivetrainTelemetry;
  readonly wheels: readonly WheelTelemetry[];
  readonly suspension: readonly SuspensionTelemetry[];
}

export interface VehicleTelemetry {
  readonly speedKmh: number;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number, number];
  readonly yawRate: number;
  readonly physicsHz: number;
  readonly configuredTireContactCount: number;
  readonly evaluatedTireContactCount: number;
  readonly tireModel: TireModelId;
  readonly tireOperatingParameters: TireOperatingParameters;
  readonly tireOperatingGripScale: number;
  readonly surfaceMode: SurfaceMode;
  readonly aerodynamicDragN: number;
  readonly aerodynamicDownforceN: readonly [number, number];
}

export interface DrivetrainTelemetry {
  readonly rpm: number;
  readonly gear: number;
  readonly clutchFriction: number;
  readonly clutchEngagement: number;
  readonly transmissionSwitchingGear: boolean;
  readonly throttle: number;
  readonly brake: number;
  readonly requestedEngineTorqueNm: number;
  readonly deliveredEngineTorqueNm: number;
  readonly deliveredAxleTorqueNm: readonly [number, number];
  readonly deliveredWheelTorqueNm: readonly [number, number, number, number];
}

export interface WheelTelemetry {
  readonly id: WheelId;
  readonly grounded: boolean;
  readonly slipRatio: number;
  readonly slipAngle: number;
  readonly load: number;
  readonly angularVelocity: number;
  readonly surface: SurfaceId;
  readonly effectiveSlipRatio: number;
  readonly effectiveSlipAngle: number;
  readonly longitudinalCapacityN: number;
  readonly lateralCapacityN: number;
  readonly aligningMomentNm: number;
  readonly longitudinalForceN: number;
  readonly lateralForceN: number;
  readonly longitudinalSlipVelocityMps: number;
  readonly lateralSlipVelocityMps: number;
  readonly longitudinalPowerLossW: number;
  readonly lateralPowerLossW: number;
  readonly longitudinalEnergyLossJ: number;
  readonly lateralEnergyLossJ: number;
}

export interface SuspensionTelemetry {
  readonly wheelId: WheelId;
  readonly length: number;
  readonly compression: number;
  readonly velocity: number;
}
