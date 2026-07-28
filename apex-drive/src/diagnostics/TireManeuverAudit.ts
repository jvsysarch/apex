import type {
  ApexVehicleState,
} from '@jvsysarch/apex-physics';
import type { DriverInput } from '@jvsysarch/apex-physics';

export type TireManeuverId =
  | 'straight-acceleration'
  | 'steering-tap'
  | 'constant-radius'
  | 'countersteer';

export const TIRE_MANEUVER_DURATION_SECONDS = 8;
export const STEERING_TAP_DURATION_SECONDS = 16;
export const SUSTAINED_SLIP_RATIO_LIMIT = 0.6;
export const SUSTAINED_SLIP_MINIMUM_SECONDS = 0.25;
export const COUNTERSTEER_RECOVERY_LIMIT_SECONDS = 0.5;

const percentile = (values: readonly number[], fraction: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
};

const input = (
  forward: boolean,
  left = false,
  right = false,
  handbrake = false,
): DriverInput => Object.freeze({
  forward,
  backward: false,
  left,
  right,
  handbrake,
});

export interface TireManeuverResult {
  readonly maneuver: TireManeuverId;
  readonly traceHash: string;
  readonly distanceTravelledM: number;
  readonly straightLineDistanceM: number;
  readonly extraDistanceM: number;
  readonly maximumSpeedKmh: number;
  readonly slipRatioP95: number;
  readonly slipAngleP95Deg: number;
  readonly lateralAccelerationP95G: number;
  readonly maximumAbsYawRate: number;
  readonly sustainedSlipRatioSeconds: number;
  readonly maximumSustainedSlipRatioSeconds: number;
  readonly reachedTwentyFiveDegreeDrift: boolean;
  readonly recoveryTimeSeconds: number | null;
  readonly configuredTireContactCount: number;
  readonly maximumEvaluatedTireContactCount: number;
  readonly physicsHz: number;
  readonly tireExecutionBackend: ApexVehicleState['tireExecutionBackend'];
  readonly tireExecutionPreference: ApexVehicleState['tireExecutionPreference'];
  readonly finalPosition: readonly [number, number, number];
}

export class TireManeuverAudit {
  private stepIndex = 0;
  private hash = 0x811c9dc5;
  private readonly hashScratch = new DataView(new ArrayBuffer(8));
  private initialPosition?: readonly [number, number, number];
  private previousPosition?: readonly [number, number, number];
  private previousVelocity?: readonly [number, number];
  private finalState?: ApexVehicleState;
  private distanceTravelled = 0;
  private maximumSpeed = 0;
  private maximumYawRate = 0;
  private recoveryStableSamples = 0;
  private recoveryStep?: number;
  private reachedTwentyFiveDegreeDrift = false;
  private driftStep?: number;
  private sustainedSlipRatioSamples = 0;
  private readonly currentSustainedSlipRatioSamples = [0, 0, 0, 0];
  private maximumSustainedSlipRatioSamples = 0;
  private maximumEvaluatedTireContactCount = 0;
  private readonly slipRatios: number[] = [];
  private readonly slipAngles: number[] = [];
  private readonly lateralAccelerations: number[] = [];

  constructor(
    readonly maneuver: TireManeuverId,
    readonly physicsHz = 60,
  ) {}

  get complete(): boolean {
    const durationSeconds = this.maneuver === 'steering-tap'
      ? STEERING_TAP_DURATION_SECONDS
      : TIRE_MANEUVER_DURATION_SECONDS;
    return this.stepIndex >= this.physicsHz * durationSeconds;
  }

  input(): DriverInput {
    const seconds = this.stepIndex / this.physicsHz;
    if (this.maneuver === 'straight-acceleration') return input(true);
    if (this.maneuver === 'steering-tap') {
      return seconds >= 12 && seconds < 12.15
        ? input(true, true)
        : input(true);
    }
    if (this.maneuver === 'constant-radius') {
      return seconds < 2.5 ? input(true) : input(true, true);
    }
    if (seconds < 3) return input(true);
    if (!this.reachedTwentyFiveDegreeDrift) return input(true, true);
    if (this.driftStep !== undefined
      && (this.stepIndex - this.driftStep) / this.physicsHz < 0.35) {
      return input(true, false, true);
    }
    return input(true);
  }

  record(state: ApexVehicleState): void {
    if (!this.initialPosition) this.initialPosition = state.position;
    this.finalState = state;
    this.maximumSpeed = Math.max(this.maximumSpeed, state.speedKmh);
    this.maximumYawRate = Math.max(this.maximumYawRate, Math.abs(state.yawRate));
    this.maximumEvaluatedTireContactCount = Math.max(
      this.maximumEvaluatedTireContactCount,
      state.evaluatedTireContactCount,
    );
    for (const wheel of state.wheels) {
      if (!wheel.grounded || state.speedKmh < 10) continue;
      this.slipRatios.push(Math.abs(wheel.longitudinalSlip));
      this.slipAngles.push(Math.abs(wheel.lateralSlipRadians));
    }
    const grounded = state.wheels.filter(wheel => wheel.grounded);
    const averageSlipRatio = grounded.length === 0
      ? 0
      : grounded.reduce((sum, wheel) => sum + Math.abs(wheel.longitudinalSlip), 0)
        / grounded.length;
    const maximumSlipAngle = grounded.length === 0
      ? 0
      : Math.max(...grounded.map(wheel => Math.abs(wheel.lateralSlipRadians)));
    const averageSlipAngle = grounded.length === 0
      ? 0
      : grounded.reduce((sum, wheel) => sum + Math.abs(wheel.lateralSlipRadians), 0)
        / grounded.length;
    if (averageSlipRatio > SUSTAINED_SLIP_RATIO_LIMIT) {
      this.sustainedSlipRatioSamples += 1;
    }
    for (let index = 0; index < state.wheels.length; index += 1) {
      const wheel = state.wheels[index];
      if (wheel.grounded
        && state.speedKmh >= 10
        && Math.abs(wheel.longitudinalSlip) > SUSTAINED_SLIP_RATIO_LIMIT) {
        this.currentSustainedSlipRatioSamples[index] += 1;
        this.maximumSustainedSlipRatioSamples = Math.max(
          this.maximumSustainedSlipRatioSamples,
          this.currentSustainedSlipRatioSamples[index],
        );
      } else {
        this.currentSustainedSlipRatioSamples[index] = 0;
      }
    }
    if (maximumSlipAngle >= 25 * Math.PI / 180) {
      this.reachedTwentyFiveDegreeDrift = true;
      this.driftStep ??= this.stepIndex;
    }

    if (this.previousPosition) {
      const dx = state.position[0] - this.previousPosition[0];
      const dz = state.position[2] - this.previousPosition[2];
      this.distanceTravelled += Math.hypot(dx, dz);
      const fixedStep = 1 / this.physicsHz;
      const velocity: readonly [number, number] = [dx / fixedStep, dz / fixedStep];
      if (this.previousVelocity) {
        const accelerationX = (velocity[0] - this.previousVelocity[0]) / fixedStep;
        const accelerationZ = (velocity[1] - this.previousVelocity[1]) / fixedStep;
        const [qx, qy, qz, qw] = state.rotation;
        const forwardX = 2 * (qx * qz + qw * qy);
        const forwardZ = 1 - 2 * (qx * qx + qy * qy);
        this.lateralAccelerations.push(Math.abs(
          accelerationX * forwardZ - accelerationZ * forwardX,
        ));
      }
      this.previousVelocity = velocity;
    }
    this.previousPosition = state.position;

    if (this.maneuver === 'countersteer'
      && this.reachedTwentyFiveDegreeDrift
      && this.driftStep !== undefined
      && !this.recoveryStep) {
      const stable = averageSlipAngle < 5 * Math.PI / 180
        && Math.abs(state.yawRate) < 0.35;
      this.recoveryStableSamples = stable ? this.recoveryStableSamples + 1 : 0;
      const stableSamples = Math.ceil(0.2 * this.physicsHz);
      if (this.recoveryStableSamples >= stableSamples) {
        this.recoveryStep = this.stepIndex - stableSamples + 1;
      }
    }
    this.hashState(state);
    this.stepIndex += 1;
  }

  result(): TireManeuverResult {
    if (!this.complete || !this.finalState || !this.initialPosition) {
      throw new Error('Tire maneuver is not complete');
    }
    const straightLineDistanceM = Math.hypot(
      this.finalState.position[0] - this.initialPosition[0],
      this.finalState.position[2] - this.initialPosition[2],
    );
    return Object.freeze({
      maneuver: this.maneuver,
      traceHash: this.hash.toString(16).padStart(8, '0'),
      distanceTravelledM: this.distanceTravelled,
      straightLineDistanceM,
      extraDistanceM: this.distanceTravelled - straightLineDistanceM,
      maximumSpeedKmh: this.maximumSpeed,
      slipRatioP95: percentile(this.slipRatios, 0.95),
      slipAngleP95Deg: percentile(this.slipAngles, 0.95) * 180 / Math.PI,
      lateralAccelerationP95G: percentile(this.lateralAccelerations, 0.95) / 9.81,
      maximumAbsYawRate: this.maximumYawRate,
      sustainedSlipRatioSeconds: this.sustainedSlipRatioSamples / this.physicsHz,
      maximumSustainedSlipRatioSeconds: this.maximumSustainedSlipRatioSamples
        / this.physicsHz,
      reachedTwentyFiveDegreeDrift: this.reachedTwentyFiveDegreeDrift,
      recoveryTimeSeconds: this.recoveryStep === undefined
        ? null
        : (this.recoveryStep - (this.driftStep ?? this.recoveryStep)) / this.physicsHz,
      configuredTireContactCount: this.finalState.configuredTireContactCount,
      maximumEvaluatedTireContactCount: this.maximumEvaluatedTireContactCount,
      physicsHz: this.physicsHz,
      tireExecutionBackend: this.finalState.tireExecutionBackend,
      tireExecutionPreference: this.finalState.tireExecutionPreference,
      finalPosition: this.finalState.position,
    });
  }

  private hashState(state: ApexVehicleState): void {
    for (const value of [
      ...state.position,
      ...state.rotation,
      state.speedKmh,
      state.yawRate,
      ...state.wheels.flatMap(wheel => [
        wheel.longitudinalSlip,
        wheel.lateralSlipRadians,
        wheel.effectiveLongitudinalSlip,
        wheel.effectiveLateralSlipRadians,
      ]),
    ]) {
      this.hashScratch.setFloat64(0, value, true);
      for (let index = 0; index < 8; index += 1) {
        this.hash ^= this.hashScratch.getUint8(index);
        this.hash = Math.imul(this.hash, 0x01000193) >>> 0;
      }
    }
  }
}
