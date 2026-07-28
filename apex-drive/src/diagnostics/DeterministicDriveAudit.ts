import type {
  ApexVehicleState,
} from '@jvsysarch/apex-physics';
import type { DriverInput } from '@jvsysarch/apex-physics';

export interface DriveAuditMilestone {
  readonly step: number;
  readonly speedKmh: number;
  readonly position: readonly [number, number, number];
  readonly yawRate: number;
  readonly tireModel: string;
}

export interface DriveAuditResult {
  readonly steps: number;
  readonly traceHash: string;
  readonly finalState: ApexVehicleState;
  readonly maximumSpeedKmh: number;
  readonly maximumAbsYawRate: number;
  readonly verticalRangeM: number;
  readonly maximumVerticalStepM: number;
  readonly milestones: readonly DriveAuditMilestone[];
  readonly samples: readonly DriveAuditSample[];
}

export interface DriveAuditWheelSample {
  readonly grounded: boolean;
  readonly slipRatio: number;
  readonly slipAngleRadians: number;
  readonly loadN: number;
  readonly suspensionLength: number;
  readonly suspensionVelocity: number;
  readonly surface: string;
}

export interface DriveAuditSample {
  readonly step: number;
  readonly tireModel: string;
  readonly speedKmh: number;
  readonly positionY: number;
  readonly rotation: readonly [number, number, number, number];
  readonly yawRate: number;
  readonly rpm: number;
  readonly throttle: number;
  readonly brake: number;
  readonly wheels: readonly DriveAuditWheelSample[];
}

const REST_END = 120;
const ACCELERATION_END = 360;
const TURN_END = 432;
const COUNTERSTEER_END = 480;
const STRAIGHTEN_END = 552;
export const DRIVE_AUDIT_STEPS = 672;
const MILESTONE_STEPS = new Set([
  REST_END,
  ACCELERATION_END,
  TURN_END,
  COUNTERSTEER_END,
  STRAIGHTEN_END,
  DRIVE_AUDIT_STEPS,
]);

const IDLE_INPUT: DriverInput = Object.freeze({
  forward: false,
  backward: false,
  left: false,
  right: false,
  handbrake: false,
});

/** Escenario fijo: ninguna decisión depende del reloj, React o eventos DOM. */
export class DeterministicDriveAudit {
  private hash = 0x811c9dc5;
  private readonly scratch = new DataView(new ArrayBuffer(8));
  private minimumY = Number.POSITIVE_INFINITY;
  private maximumY = Number.NEGATIVE_INFINITY;
  private previousY?: number;
  private maximumVerticalStep = 0;
  private maximumSpeed = 0;
  private maximumYaw = 0;
  private finalState?: ApexVehicleState;
  private readonly milestones: DriveAuditMilestone[] = [];
  private readonly samples: DriveAuditSample[] = [];

  inputForStep(step: number): DriverInput {
    if (step < REST_END) return IDLE_INPUT;
    if (step < ACCELERATION_END) return { ...IDLE_INPUT, forward: true };
    if (step < TURN_END) return { ...IDLE_INPUT, forward: true, left: true };
    if (step < COUNTERSTEER_END) return { ...IDLE_INPUT, forward: true, right: true };
    if (step < STRAIGHTEN_END) return { ...IDLE_INPUT, forward: true };
    return IDLE_INPUT;
  }

  record(completedSteps: number, state: ApexVehicleState): void {
    const [x, y, z] = state.position;
    this.minimumY = Math.min(this.minimumY, y);
    this.maximumY = Math.max(this.maximumY, y);
    if (this.previousY !== undefined) {
      this.maximumVerticalStep = Math.max(this.maximumVerticalStep, Math.abs(y - this.previousY));
    }
    this.previousY = y;
    this.maximumSpeed = Math.max(this.maximumSpeed, state.speedKmh);
    this.maximumYaw = Math.max(this.maximumYaw, Math.abs(state.yawRate));
    this.finalState = state;
    this.samples.push(Object.freeze({
      step: completedSteps,
      tireModel: state.tireModel,
      speedKmh: state.speedKmh,
      positionY: y,
      rotation: state.rotation,
      yawRate: state.yawRate,
      rpm: state.rpm,
      throttle: state.throttle,
      brake: state.brake,
      wheels: Object.freeze(state.wheels.map(wheel => Object.freeze({
        grounded: wheel.grounded,
        slipRatio: wheel.longitudinalSlip,
        slipAngleRadians: wheel.lateralSlipRadians,
        loadN: wheel.suspensionImpulse * state.physicsHz,
        suspensionLength: wheel.suspensionLength,
        suspensionVelocity: wheel.suspensionVelocity,
        surface: wheel.surface,
      }))),
    }));

    this.hashNumber(x);
    this.hashNumber(y);
    this.hashNumber(z);
    this.hashNumber(state.speedKmh);
    this.hashNumber(state.yawRate);
    this.hashNumber(state.rpm);
    this.hashNumber(state.gear);
    for (const wheel of state.wheels) {
      this.hashNumber(wheel.longitudinalSlip);
      this.hashNumber(wheel.lateralSlipRadians);
      this.hashNumber(wheel.suspensionLength);
      this.hashNumber(wheel.suspensionImpulse);
    }

    if (MILESTONE_STEPS.has(completedSteps)) {
      this.milestones.push(Object.freeze({
        step: completedSteps,
        speedKmh: state.speedKmh,
        position: state.position,
        yawRate: state.yawRate,
        tireModel: state.tireModel,
      }));
    }
  }

  get complete(): boolean {
    return this.finalState !== undefined && this.milestones.at(-1)?.step === DRIVE_AUDIT_STEPS;
  }

  result(): DriveAuditResult {
    if (!this.complete || !this.finalState) throw new Error('Drive audit is not complete');
    return Object.freeze({
      steps: DRIVE_AUDIT_STEPS,
      traceHash: this.hash.toString(16).padStart(8, '0'),
      finalState: this.finalState,
      maximumSpeedKmh: this.maximumSpeed,
      maximumAbsYawRate: this.maximumYaw,
      verticalRangeM: this.maximumY - this.minimumY,
      maximumVerticalStepM: this.maximumVerticalStep,
      milestones: Object.freeze(this.milestones),
      samples: Object.freeze(this.samples),
    });
  }

  private hashNumber(value: number): void {
    this.scratch.setFloat64(0, value, true);
    for (let index = 0; index < 8; index += 1) {
      this.hash ^= this.scratch.getUint8(index);
      this.hash = Math.imul(this.hash, 0x01000193) >>> 0;
    }
  }
}
