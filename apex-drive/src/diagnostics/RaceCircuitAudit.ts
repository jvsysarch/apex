import type {
  ApexVehicleState,
} from '@jvsysarch/apex-physics';
import type { DriverInput } from '@jvsysarch/apex-physics';
import { TEST_TRACK_SEGMENTS } from '../track/ApexTestTrack';

const FIXED_STEP = 1 / 60;
export const RACE_AUDIT_MAX_STEPS = 60 * 120;

interface HorizontalPoint {
  readonly x: number;
  readonly z: number;
}

export interface RaceCircuitResult {
  readonly completedLap: boolean;
  readonly steps: number;
  readonly traceHash: string;
  readonly elapsedSeconds: number;
  readonly lapProgressPercent: number;
  readonly distanceTravelledM: number;
  readonly averageSpeedKmh: number;
  readonly maximumSpeedKmh: number;
  readonly maximumLateralAccelerationG: number;
  readonly lateralAccelerationP95G: number;
  readonly maximumAbsYawRate: number;
  readonly maximumSlipRatio: number;
  readonly slipRatioP95: number;
  readonly maximumSlipAngleDeg: number;
  readonly slipAngleP95Deg: number;
  readonly wheelSamplesOnGrass: number;
  readonly wheelSamplesOnGravel: number;
  readonly allWheelsOffTrackSamples: number;
  readonly contactLossSamples: number;
  readonly maximumWheelLoadN: number;
  readonly wheelLoadP95N: number;
  readonly averageRequestedEngineTorqueNm: number;
  readonly averageDeliveredEngineTorqueNm: number;
  readonly averageDeliveredAxleTorqueNm: readonly [number, number];
  readonly averageDeliveredWheelTorqueNm: readonly [number, number, number, number];
  readonly averageAerodynamicDragN: number;
  readonly averageAerodynamicDownforceN: readonly [number, number];
  readonly crossTrackErrorRmsM: number;
  readonly maximumCrossTrackErrorM: number;
  readonly offTrackSecondsBySegment: readonly number[];
  readonly finalPosition: readonly [number, number, number];
  readonly finalTireModel: string;
  readonly segmentPasses: readonly RaceSegmentPass[];
}

export interface RaceSegmentPass {
  readonly segment: number;
  readonly step: number;
  readonly speedKmh: number;
  readonly surface: string;
}

const IDLE_INPUT: DriverInput = Object.freeze({
  forward: false,
  backward: false,
  left: false,
  right: false,
  handbrake: false,
});

const segmentLengths = TEST_TRACK_SEGMENTS.map(segment => Math.hypot(
  segment.end.x - segment.start.x,
  segment.end.z - segment.start.z,
));
const totalTrackLength = segmentLengths.reduce((sum, length) => sum + length, 0);
const percentile = (values: readonly number[], fraction: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
};

const wrapAngle = (angle: number) => {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
};

const horizontalDirection = (start: HorizontalPoint, end: HorizontalPoint) => {
  const x = end.x - start.x;
  const z = end.z - start.z;
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
};

const forwardFromRotation = (rotation: readonly [number, number, number, number]) => {
  const [x, y, z, w] = rotation;
  return {
    x: 2 * (x * z + w * y),
    z: 1 - 2 * (x * x + y * y),
  };
};

/**
 * Piloto de referencia basado en pure pursuit. Sólo produce DriverInput;
 * no escribe pose, velocidad, ruedas ni constraints.
 */
export class RaceCircuitAudit {
  private hash = 0x811c9dc5;
  private readonly hashScratch = new DataView(new ArrayBuffer(8));
  private segmentIndex = 0;
  private completedLap = false;
  private steps = 0;
  private distanceTravelled = 0;
  private accumulatedSpeed = 0;
  private maximumSpeed = 0;
  private maximumLateralAcceleration = 0;
  private maximumYawRate = 0;
  private maximumSlipRatio = 0;
  private maximumSlipAngle = 0;
  private wheelSamplesOnGrass = 0;
  private wheelSamplesOnGravel = 0;
  private allWheelsOffTrackSamples = 0;
  private contactLossSamples = 0;
  private maximumWheelLoad = 0;
  private requestedEngineTorqueSum = 0;
  private deliveredEngineTorqueSum = 0;
  private readonly deliveredAxleTorqueSum = [0, 0];
  private readonly deliveredWheelTorqueSum = [0, 0, 0, 0];
  private aerodynamicDragSum = 0;
  private readonly aerodynamicDownforceSum = [0, 0];
  private crossTrackErrorSquaredSum = 0;
  private maximumCrossTrackError = 0;
  private maximumProgress = 0;
  private previousPosition?: HorizontalPoint;
  private previousVelocity?: HorizontalPoint;
  private finalState?: ApexVehicleState;
  private readonly segmentPasses: RaceSegmentPass[] = [];
  private readonly lateralAccelerationSamples: number[] = [];
  private readonly slipRatioSamples: number[] = [];
  private readonly slipAngleSamples: number[] = [];
  private readonly wheelLoadSamples: number[] = [];
  private readonly offTrackSamplesBySegment = Array.from(
    { length: TEST_TRACK_SEGMENTS.length },
    () => 0,
  );

  inputForState(state: ApexVehicleState): DriverInput {
    if (this.complete) return IDLE_INPUT;
    const position = { x: state.position[0], z: state.position[2] };
    this.advanceProgress(position, state);
    if (this.completedLap) return IDLE_INPUT;

    const segment = TEST_TRACK_SEGMENTS[this.segmentIndex];
    const projection = this.projectOnSegment(position, this.segmentIndex);
    const lookAheadM = Math.max(10, Math.min(24, 10 + state.speedKmh * 0.11));
    const target = this.pointAhead(this.segmentIndex, projection * segmentLengths[this.segmentIndex] + lookAheadM);
    const forward = forwardFromRotation(state.rotation);
    const currentHeading = Math.atan2(forward.x, forward.z);
    const targetHeading = Math.atan2(target.x - position.x, target.z - position.z);
    const headingError = wrapAngle(targetHeading - currentHeading);
    const targetSpeed = this.targetSpeedKmh();
    const braking = state.speedKmh > targetSpeed + 3;
    const accelerating = state.speedKmh < targetSpeed - 1.5;

    return {
      forward: accelerating,
      backward: braking,
      // Con el auto inicialmente orientado hacia -Z, error positivo corresponde
      // a una curva hacia la izquierda del conductor.
      left: headingError > 0.018,
      right: headingError < -0.018,
      handbrake: false,
    };
  }

  record(state: ApexVehicleState): void {
    this.steps += 1;
    this.finalState = state;
    this.accumulatedSpeed += state.speedKmh;
    this.maximumSpeed = Math.max(this.maximumSpeed, state.speedKmh);
    this.maximumYawRate = Math.max(this.maximumYawRate, Math.abs(state.yawRate));
    this.requestedEngineTorqueSum += state.requestedEngineTorqueNm;
    this.deliveredEngineTorqueSum += state.deliveredEngineTorqueNm;
    this.aerodynamicDragSum += state.aerodynamicDragN;
    this.aerodynamicDownforceSum[0] += state.aerodynamicDownforceN[0];
    this.aerodynamicDownforceSum[1] += state.aerodynamicDownforceN[1];
    for (let index = 0; index < 2; index += 1) {
      this.deliveredAxleTorqueSum[index] += state.deliveredAxleTorqueNm[index];
    }
    for (let index = 0; index < 4; index += 1) {
      this.deliveredWheelTorqueSum[index] += state.deliveredWheelTorqueNm[index];
    }

    const position = { x: state.position[0], z: state.position[2] };
    if (this.previousPosition) {
      const velocity = {
        x: (position.x - this.previousPosition.x) / FIXED_STEP,
        z: (position.z - this.previousPosition.z) / FIXED_STEP,
      };
      this.distanceTravelled += Math.hypot(
        position.x - this.previousPosition.x,
        position.z - this.previousPosition.z,
      );
      if (this.previousVelocity) {
        const acceleration = {
          x: (velocity.x - this.previousVelocity.x) / FIXED_STEP,
          z: (velocity.z - this.previousVelocity.z) / FIXED_STEP,
        };
        const forward = forwardFromRotation(state.rotation);
        const lateralAcceleration = acceleration.x * forward.z - acceleration.z * forward.x;
        this.maximumLateralAcceleration = Math.max(
          this.maximumLateralAcceleration,
          Math.abs(lateralAcceleration),
        );
        if (state.speedKmh > 15) this.lateralAccelerationSamples.push(Math.abs(lateralAcceleration));
      }
      this.previousVelocity = velocity;
    }
    this.previousPosition = position;

    let grassWheels = 0;
    for (const wheel of state.wheels) {
      this.maximumSlipRatio = Math.max(this.maximumSlipRatio, Math.abs(wheel.longitudinalSlip));
      this.maximumSlipAngle = Math.max(this.maximumSlipAngle, Math.abs(wheel.lateralSlipRadians));
      this.maximumWheelLoad = Math.max(
        this.maximumWheelLoad,
        wheel.suspensionImpulse * state.physicsHz,
      );
      if (wheel.grounded) {
        this.wheelLoadSamples.push(Math.max(0, wheel.suspensionImpulse * state.physicsHz));
        if (state.speedKmh > 10) {
          this.slipRatioSamples.push(Math.abs(wheel.longitudinalSlip));
          this.slipAngleSamples.push(Math.abs(wheel.lateralSlipRadians));
        }
      }
      if (!wheel.grounded) this.contactLossSamples += 1;
      if (wheel.surface === 'grass') {
        grassWheels += 1;
        this.wheelSamplesOnGrass += 1;
      }
      if (wheel.surface === 'gravel') this.wheelSamplesOnGravel += 1;
    }
    if (grassWheels === state.wheels.length) {
      this.allWheelsOffTrackSamples += 1;
      this.offTrackSamplesBySegment[this.segmentIndex] += 1;
    }
    const crossTrackError = this.crossTrackError(position, this.segmentIndex);
    this.crossTrackErrorSquaredSum += crossTrackError * crossTrackError;
    this.maximumCrossTrackError = Math.max(this.maximumCrossTrackError, crossTrackError);
    this.hashState(state);
  }

  get complete(): boolean {
    return this.completedLap || this.steps >= RACE_AUDIT_MAX_STEPS;
  }

  result(): RaceCircuitResult {
    if (!this.complete || !this.finalState) throw new Error('Race circuit audit is not complete');
    return Object.freeze({
      completedLap: this.completedLap,
      steps: this.steps,
      traceHash: this.hash.toString(16).padStart(8, '0'),
      elapsedSeconds: this.steps * FIXED_STEP,
      lapProgressPercent: this.completedLap ? 100 : this.maximumProgress * 100,
      distanceTravelledM: this.distanceTravelled,
      averageSpeedKmh: this.accumulatedSpeed / Math.max(1, this.steps),
      maximumSpeedKmh: this.maximumSpeed,
      maximumLateralAccelerationG: this.maximumLateralAcceleration / 9.81,
      lateralAccelerationP95G: percentile(this.lateralAccelerationSamples, 0.95) / 9.81,
      maximumAbsYawRate: this.maximumYawRate,
      maximumSlipRatio: this.maximumSlipRatio,
      slipRatioP95: percentile(this.slipRatioSamples, 0.95),
      maximumSlipAngleDeg: this.maximumSlipAngle * 180 / Math.PI,
      slipAngleP95Deg: percentile(this.slipAngleSamples, 0.95) * 180 / Math.PI,
      wheelSamplesOnGrass: this.wheelSamplesOnGrass,
      wheelSamplesOnGravel: this.wheelSamplesOnGravel,
      allWheelsOffTrackSamples: this.allWheelsOffTrackSamples,
      contactLossSamples: this.contactLossSamples,
      maximumWheelLoadN: this.maximumWheelLoad,
      wheelLoadP95N: percentile(this.wheelLoadSamples, 0.95),
      averageRequestedEngineTorqueNm: this.requestedEngineTorqueSum / Math.max(1, this.steps),
      averageDeliveredEngineTorqueNm: this.deliveredEngineTorqueSum / Math.max(1, this.steps),
      averageDeliveredAxleTorqueNm: Object.freeze(
        this.deliveredAxleTorqueSum.map(value => value / Math.max(1, this.steps)),
      ) as readonly [number, number],
      averageDeliveredWheelTorqueNm: Object.freeze(
        this.deliveredWheelTorqueSum.map(value => value / Math.max(1, this.steps)),
      ) as readonly [number, number, number, number],
      averageAerodynamicDragN: this.aerodynamicDragSum / Math.max(1, this.steps),
      averageAerodynamicDownforceN: Object.freeze(
        this.aerodynamicDownforceSum.map(value => value / Math.max(1, this.steps)),
      ) as readonly [number, number],
      crossTrackErrorRmsM: Math.sqrt(this.crossTrackErrorSquaredSum / Math.max(1, this.steps)),
      maximumCrossTrackErrorM: this.maximumCrossTrackError,
      offTrackSecondsBySegment: Object.freeze(
        this.offTrackSamplesBySegment.map(samples => samples * FIXED_STEP),
      ),
      finalPosition: this.finalState.position,
      finalTireModel: this.finalState.tireModel,
      segmentPasses: Object.freeze(this.segmentPasses),
    });
  }

  private hashState(state: ApexVehicleState): void {
    for (const value of [
      ...state.position,
      ...state.rotation,
      state.speedKmh,
      state.yawRate,
      state.rpm,
      state.gear,
      state.requestedEngineTorqueNm,
      state.deliveredEngineTorqueNm,
      ...state.deliveredAxleTorqueNm,
      ...state.deliveredWheelTorqueNm,
      state.aerodynamicDragN,
      ...state.aerodynamicDownforceN,
    ]) {
      this.hashNumber(value);
    }
    for (const wheel of state.wheels) {
      this.hashNumber(wheel.longitudinalSlip);
      this.hashNumber(wheel.lateralSlipRadians);
      this.hashNumber(wheel.suspensionLength);
      this.hashNumber(wheel.suspensionImpulse);
    }
  }

  private hashNumber(value: number): void {
    this.hashScratch.setFloat64(0, value, true);
    for (let index = 0; index < 8; index += 1) {
      this.hash ^= this.hashScratch.getUint8(index);
      this.hash = Math.imul(this.hash, 0x01000193) >>> 0;
    }
  }

  private advanceProgress(position: HorizontalPoint, state: ApexVehicleState): void {
    const projection = this.projectOnSegment(position, this.segmentIndex);
    const segment = TEST_TRACK_SEGMENTS[this.segmentIndex];
    const distanceToEnd = Math.hypot(position.x - segment.end.x, position.z - segment.end.z);
    const completedLength = segmentLengths
      .slice(0, this.segmentIndex)
      .reduce((sum, length) => sum + length, 0);
    this.maximumProgress = Math.max(
      this.maximumProgress,
      (completedLength + projection * segmentLengths[this.segmentIndex]) / totalTrackLength,
    );

    if (projection < 0.82 && distanceToEnd > 14) return;
    this.segmentPasses.push(Object.freeze({
      segment: this.segmentIndex,
      step: this.steps,
      speedKmh: state.speedKmh,
      surface: segment.surface,
    }));
    if (this.segmentIndex === TEST_TRACK_SEGMENTS.length - 1) {
      this.segmentIndex = 0;
      this.completedLap = true;
    } else {
      this.segmentIndex += 1;
    }
  }

  private projectOnSegment(position: HorizontalPoint, index: number): number {
    const segment = TEST_TRACK_SEGMENTS[index];
    const dx = segment.end.x - segment.start.x;
    const dz = segment.end.z - segment.start.z;
    const lengthSquared = dx * dx + dz * dz || 1;
    return Math.max(0, Math.min(1, (
      (position.x - segment.start.x) * dx + (position.z - segment.start.z) * dz
    ) / lengthSquared));
  }

  private crossTrackError(position: HorizontalPoint, index: number): number {
    const segment = TEST_TRACK_SEGMENTS[index];
    const projection = this.projectOnSegment(position, index);
    const closestX = segment.start.x + (segment.end.x - segment.start.x) * projection;
    const closestZ = segment.start.z + (segment.end.z - segment.start.z) * projection;
    return Math.hypot(position.x - closestX, position.z - closestZ);
  }

  private pointAhead(startSegment: number, distanceM: number): HorizontalPoint {
    let index = startSegment;
    let remaining = distanceM;
    for (let count = 0; count < TEST_TRACK_SEGMENTS.length; count += 1) {
      const length = segmentLengths[index];
      if (remaining <= length) {
        const segment = TEST_TRACK_SEGMENTS[index];
        const t = remaining / Math.max(length, 1);
        return {
          x: segment.start.x + (segment.end.x - segment.start.x) * t,
          z: segment.start.z + (segment.end.z - segment.start.z) * t,
        };
      }
      remaining -= length;
      index = (index + 1) % TEST_TRACK_SEGMENTS.length;
    }
    return TEST_TRACK_SEGMENTS[startSegment].end;
  }

  private targetSpeedKmh(): number {
    const current = TEST_TRACK_SEGMENTS[this.segmentIndex];
    const next = TEST_TRACK_SEGMENTS[(this.segmentIndex + 1) % TEST_TRACK_SEGMENTS.length];
    const currentDirection = horizontalDirection(current.start, current.end);
    const nextDirection = horizontalDirection(next.start, next.end);
    const turnAngle = Math.acos(Math.max(-1, Math.min(
      1,
      currentDirection.x * nextDirection.x + currentDirection.z * nextDirection.z,
    ))) * 180 / Math.PI;
    let target = turnAngle > 55 ? 44 : turnAngle > 35 ? 56 : turnAngle > 18 ? 72 : 108;
    if (current.surface === 'gravel' || next.surface === 'gravel') target = Math.min(target, 52);
    const grade = Math.abs(current.end.y - current.start.y) / Math.max(1, segmentLengths[this.segmentIndex]);
    if (grade > 0.025) target = Math.min(target, 68);
    return target;
  }
}
