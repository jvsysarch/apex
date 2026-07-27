import type { ApexHandlingSample } from './ApexAssists.ts';

/** Distribución física de torque sin autoridad visual. */
export interface ApexTorqueDistribution {
  readonly throttleScale: number;
  readonly frontTorqueRatio: number;
  readonly rearTorqueRatio: number;
  readonly frontRightSplit: number;
  readonly rearRightSplit: number;
  readonly intervention: readonly [number, number, number, number];
  readonly requestedEngineTorqueNm: number;
  readonly deliveredEngineTorqueNm: number;
  readonly deliveredAxleTorqueNm: readonly [number, number];
  readonly deliveredWheelTorqueNm: readonly [number, number, number, number];
}

export interface ApexTorqueControlMode {
  readonly selectiveWheelControl: boolean;
  readonly dynamicAxleSplit: boolean;
}

export interface ApexTorqueControlSettings {
  readonly baseWheelTorqueFractions: readonly [number, number, number, number];
  readonly defaultFrontTorqueRatio: number;
  readonly defaultRightSplit: number;
  readonly minimumRightSplit: number;
  readonly maximumRightSplit: number;
  readonly enterSlip: number;
  readonly exitSlip: number;
  readonly fullInterventionSlip: number;
  readonly maximumWheelReduction: number;
  readonly minimumDeliveredTorqueScale: number;
  readonly interventionAttack: number;
  readonly interventionRelease: number;
  readonly axleRatioRatePerSecond: number;
  readonly leftRightSplitRatePerSecond: number;
  readonly minimumFrontTorqueRatio: number;
  readonly maximumFrontTorqueRatio: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const approach = (current: number, target: number, rate: number, dt: number) => (
  current + (target - current) * (1 - Math.exp(-rate * dt))
);
const moveToward = (current: number, target: number, maximumDelta: number) => (
  current < target
    ? Math.min(target, current + maximumDelta)
    : Math.max(target, current - maximumDelta)
);

/**
 * Distribuye el torque solicitado usando únicamente los diferenciales reales
 * de Jolt. No aplica fuerzas/torques al chasis ni escribe transforms.
 */
export class ApexTorqueDistributor {
  private readonly settings: ApexTorqueControlSettings;
  private readonly active = [false, false, false, false];
  private readonly intervention = [0, 0, 0, 0];
  private frontTorqueRatio: number;
  private frontRightSplit: number;
  private rearRightSplit: number;

  constructor(settings: ApexTorqueControlSettings) {
    this.settings = settings;
    this.frontTorqueRatio = settings.defaultFrontTorqueRatio;
    this.frontRightSplit = settings.defaultRightSplit;
    this.rearRightSplit = settings.defaultRightSplit;
  }

  update(
    sample: ApexHandlingSample,
    requestedEngineTorqueNm: number,
    mode: ApexTorqueControlMode,
    dt: number,
  ): ApexTorqueDistribution {
    this.updateInterventions(sample, mode.selectiveWheelControl, dt);

    const base = this.settings.baseWheelTorqueFractions;
    const weighted = base.map((fraction, index) => (
      fraction * (1 - this.intervention[index] * this.settings.maximumWheelReduction)
    ));
    const frontWeight = weighted[0] + weighted[1];
    const rearWeight = weighted[2] + weighted[3];
    const totalWeight = Math.max(1e-5, frontWeight + rearWeight);

    const desiredFrontRatio = mode.dynamicAxleSplit
      ? clamp(
        frontWeight / totalWeight,
        this.settings.minimumFrontTorqueRatio,
        this.settings.maximumFrontTorqueRatio,
      )
      : this.settings.defaultFrontTorqueRatio;
    this.frontTorqueRatio = moveToward(
      this.frontTorqueRatio,
      desiredFrontRatio,
      this.settings.axleRatioRatePerSecond * dt,
    );

    const desiredFrontRightSplit = mode.selectiveWheelControl && frontWeight > 1e-5
      ? clamp(
        weighted[1] / frontWeight,
        this.settings.minimumRightSplit,
        this.settings.maximumRightSplit,
      )
      : this.settings.defaultRightSplit;
    const desiredRearRightSplit = mode.selectiveWheelControl && rearWeight > 1e-5
      ? clamp(
        weighted[3] / rearWeight,
        this.settings.minimumRightSplit,
        this.settings.maximumRightSplit,
      )
      : this.settings.defaultRightSplit;
    this.frontRightSplit = moveToward(
      this.frontRightSplit,
      desiredFrontRightSplit,
      this.settings.leftRightSplitRatePerSecond * dt,
    );
    this.rearRightSplit = moveToward(
      this.rearRightSplit,
      desiredRearRightSplit,
      this.settings.leftRightSplitRatePerSecond * dt,
    );

    const throttleScale = mode.selectiveWheelControl
      ? clamp(totalWeight, this.settings.minimumDeliveredTorqueScale, 1)
      : 1;
    const deliveredEngineTorqueNm = requestedEngineTorqueNm * throttleScale;
    const frontTorqueNm = deliveredEngineTorqueNm * this.frontTorqueRatio;
    const rearTorqueNm = deliveredEngineTorqueNm - frontTorqueNm;
    const wheelTorque = Object.freeze([
      frontTorqueNm * (1 - this.frontRightSplit),
      frontTorqueNm * this.frontRightSplit,
      rearTorqueNm * (1 - this.rearRightSplit),
      rearTorqueNm * this.rearRightSplit,
    ]) as readonly [number, number, number, number];

    return Object.freeze({
      throttleScale,
      frontTorqueRatio: this.frontTorqueRatio,
      rearTorqueRatio: 1 - this.frontTorqueRatio,
      frontRightSplit: this.frontRightSplit,
      rearRightSplit: this.rearRightSplit,
      intervention: Object.freeze([...this.intervention]) as readonly [number, number, number, number],
      requestedEngineTorqueNm,
      deliveredEngineTorqueNm,
      deliveredAxleTorqueNm: Object.freeze([
        frontTorqueNm,
        rearTorqueNm,
      ]) as readonly [number, number],
      deliveredWheelTorqueNm: wheelTorque,
    });
  }

  private updateInterventions(
    sample: ApexHandlingSample,
    enabled: boolean,
    dt: number,
  ): void {
    for (let index = 0; index < 4; index += 1) {
      const wheel = sample.wheels[index];
      const slip = sample.speedMps < 2.5
        ? 0
        : wheel.grounded ? Math.max(0, wheel.longitudinalSlip) : 1;

      if (!enabled) {
        this.active[index] = false;
      } else if (this.active[index]) {
        if (wheel.grounded && slip < this.settings.exitSlip) this.active[index] = false;
      } else if (slip > this.settings.enterSlip) {
        this.active[index] = true;
      }

      const target = this.active[index]
        ? clamp(
          (slip - this.settings.exitSlip)
            / (this.settings.fullInterventionSlip - this.settings.exitSlip),
          0.08,
          1,
        )
        : 0;
      this.intervention[index] = approach(
        this.intervention[index],
        target,
        target > this.intervention[index]
          ? this.settings.interventionAttack
          : this.settings.interventionRelease,
        dt,
      );
    }
  }
}
