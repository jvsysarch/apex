/** Contratos de asistencia que operan sobre muestras físicas numéricas. */
export interface AssistWheelSample {
  readonly grounded: boolean;
  readonly longitudinalSlip: number;
  readonly lateralSlipRadians: number;
}

export interface ApexHandlingSample {
  readonly speedMps: number;
  readonly localForwardSpeedMps: number;
  readonly yawRate: number;
  readonly wheels: readonly AssistWheelSample[];
}

export interface AssistInput {
  readonly throttle: number;
  readonly brake: number;
  readonly steering: number;
  readonly handbrake: number;
}

export interface AssistedInput extends AssistInput {
  readonly tractionControl: number;
  readonly abs: number;
  readonly stabilityControl: number;
}

export type ApexAssistProfile =
  | 'baseline'
  | 'tire-benchmark'
  | 'circuit-recovery'
  | 'fast-recovery'
  | 'fast-recovery-stability'
  | 'low-slip';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const approach = (current: number, target: number, rate: number, dt: number) => (
  current + (target - current) * (1 - Math.exp(-rate * dt))
);
const average = (values: readonly number[]) => (
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
);

/** Asistencias moderadas: sólo modulan input antes de WheeledVehicleController. */
export class ApexAssists {
  private tractionIntervention = 0;
  private absIntervention = 0;
  private stabilityIntervention = 0;
  private steeringCorrection = 0;

  update(
    input: AssistInput,
    sample: ApexHandlingSample,
    dt: number,
    profile: ApexAssistProfile = 'baseline',
  ): AssistedInput {
    const grounded = sample.wheels.filter(wheel => wheel.grounded);
    const driven = grounded;
    const lowSlip = profile === 'low-slip';
    const worstDriveSlip = driven.length === 0
      ? 0
      : Math.max(...driven.map(wheel => Math.abs(wheel.longitudinalSlip)));
    const usesSelectiveTorqueControl = profile === 'fast-recovery'
      || profile === 'fast-recovery-stability'
      || profile === 'low-slip';
    const tractionOnset = lowSlip
      ? 0.045
      : profile === 'circuit-recovery' ? 0.055 : 0.12;
    const tractionRange = lowSlip
      ? 0.085
      : profile === 'circuit-recovery' ? 0.145 : 0.32;
    const tractionTarget = !usesSelectiveTorqueControl
      && input.handbrake < 0.1 && input.throttle > 0.05 && sample.speedMps > 1.5
      ? clamp((worstDriveSlip - tractionOnset) / tractionRange, 0, 1)
      : 0;
    this.tractionIntervention = approach(
      this.tractionIntervention,
      tractionTarget,
      tractionTarget > this.tractionIntervention
        ? lowSlip ? 40 : profile === 'circuit-recovery' ? 22 : 18
        : lowSlip ? 8 : profile === 'circuit-recovery' ? 6 : 7,
      dt,
    );

    const worstBrakeSlip = grounded.length === 0
      ? 0
      : Math.max(...grounded.map(wheel => Math.abs(wheel.longitudinalSlip)));
    const absTarget = input.brake > 0.05 && sample.speedMps > 2.5
      ? clamp((worstBrakeSlip - 0.16) / 0.3, 0, 1)
      : 0;
    this.absIntervention = approach(
      this.absIntervention,
      absTarget,
      absTarget > this.absIntervention ? 24 : 12,
      dt,
    );

    const frontSlip = average(sample.wheels.slice(0, 2)
      .filter(wheel => wheel.grounded)
      .map(wheel => Math.abs(wheel.lateralSlipRadians)));
    const rearSlip = average(sample.wheels.slice(2, 4)
      .filter(wheel => wheel.grounded)
      .map(wheel => Math.abs(wheel.lateralSlipRadians)));
    const desiredYaw = sample.speedMps < 4
      ? 0
      : clamp(
        sample.localForwardSpeedMps * Math.tan(input.steering * 0.56) / 2.85,
        -2.2,
        2.2,
      );
    const yawError = desiredYaw - sample.yawRate;
    const oversteer = Math.max(0, rearSlip - frontSlip - 0.05);
    const minimalStability = profile === 'fast-recovery-stability';
    const averageLateralSlip = (frontSlip + rearSlip) * 0.5;
    const yawDivergence = Math.max(0, Math.abs(yawError) - 0.45);
    const slipDivergence = Math.max(0, rearSlip - frontSlip - 0.07);
    const stabilityTarget = profile !== 'tire-benchmark'
      && input.handbrake < 0.1 && sample.speedMps > 7
      ? lowSlip
        ? clamp(
          (averageLateralSlip - 3 * Math.PI / 180) / (7 * Math.PI / 180)
            + Math.max(0, Math.abs(yawError) - 0.35) / 1.8,
          0,
          1,
        )
        : minimalStability
        ? yawDivergence > 0 && slipDivergence > 0
          ? clamp(yawDivergence / 1.1 + slipDivergence * 2.2, 0, 1)
          : 0
        : clamp(Math.abs(yawError) / 1.7 + oversteer * 1.8, 0, 1)
      : 0;
    this.stabilityIntervention = approach(
      this.stabilityIntervention,
      stabilityTarget,
      stabilityTarget > this.stabilityIntervention ? lowSlip ? 14 : 8 : 4,
      dt,
    );
    const yawOvershoot = Math.abs(sample.yawRate) > Math.abs(desiredYaw) + 0.15;
    const correctionTarget = input.handbrake < 0.1 && !minimalStability
      && (!lowSlip || yawOvershoot)
      ? clamp(yawError * 0.13, -0.18, 0.18) * this.stabilityIntervention
      : 0;
    this.steeringCorrection = approach(this.steeringCorrection, correctionTarget, 7, dt);

    const maximumTractionCut = profile === 'circuit-recovery'
      || profile === 'tire-benchmark' ? 0.78 : lowSlip ? 0.84 : 0.62;
    const tractionMultiplier = 1 - this.tractionIntervention * maximumTractionCut;
    const stabilityThrottleCut = lowSlip ? 0.58 : minimalStability ? 0.18 : 0.34;
    const stabilityThrottleMultiplier = 1 - this.stabilityIntervention * stabilityThrottleCut;
    const brakePressure = input.brake * (1 - this.absIntervention * 0.62);
    const stabilityBrake = !minimalStability && input.throttle < 0.12
      ? this.stabilityIntervention * 0.07
      : 0;

    return Object.freeze({
      throttle: input.throttle * tractionMultiplier * stabilityThrottleMultiplier,
      brake: clamp(Math.max(brakePressure, stabilityBrake), 0, 1),
      steering: clamp(input.steering + this.steeringCorrection, -1, 1),
      handbrake: input.handbrake,
      tractionControl: this.tractionIntervention,
      abs: this.absIntervention,
      stabilityControl: this.stabilityIntervention,
    });
  }
}
