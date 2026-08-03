import type { DriverInput } from '../contracts/DriverInput.ts';

export interface ApexFilteredInput {
  readonly requestedDirection: -1 | 0 | 1;
  readonly pedal: number;
  readonly steering: number;
  readonly handbrake: number;
}

export type ApexInputFilterProfile = 'baseline' | 'physical-steering' | 'low-slip';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const moveToward = (current: number, target: number, delta: number) => (
  current < target ? Math.min(target, current + delta) : Math.max(target, current - delta)
);
const progressiveSteering = (value: number) => (
  Math.sign(value) * Math.pow(Math.abs(value), 1.35)
);

/** Convierte teclado digital en pedales y dirección continuos. */
export class ApexInputFilter {
  private pedal = 0;
  private steering = 0;
  private handbrake = 0;

  update(
    input: DriverInput,
    speedKmh: number,
    dt: number,
    profile: ApexInputFilterProfile = 'baseline',
  ): ApexFilteredInput {
    const analogThrottle = Number.isFinite(input.throttle)
      ? clamp(input.throttle!, 0, 1)
      : undefined;
    const requestedDirection: -1 | 0 | 1 = analogThrottle !== undefined
      ? input.backward && !input.forward
        ? analogThrottle > 0 ? -1 : 0
        : analogThrottle > 0 ? 1 : 0
      : input.forward && !input.backward
      ? 1
      : input.backward && !input.forward ? -1 : 0;
    const pedalTarget = analogThrottle ?? (requestedDirection === 0 ? 0 : 1);
    const pedalRate = pedalTarget > this.pedal ? 3.2 : 6.5;
    this.pedal = moveToward(this.pedal, pedalTarget, pedalRate * dt);

    const analogSteering = Number.isFinite(input.steering)
      ? clamp(input.steering!, -1, 1)
      : undefined;
    const rawSteering = analogSteering
      ?? (input.right && !input.left ? 1 : input.left && !input.right ? -1 : 0);
    const directSteering = input.directSteering === true
      && analogSteering !== undefined;
    const highSpeedBlend = clamp((Math.abs(speedKmh) - 35) / 105, 0, 1);
    const lowSlipBlend = clamp((Math.abs(speedKmh) - 20) / 100, 0, 1);
    const maximumSteering = profile === 'low-slip'
      ? 1
      : analogSteering !== undefined
      ? 1
      : profile === 'physical-steering'
      ? 1
      : 1 - highSpeedBlend * 0.7;
    const steeringTarget = rawSteering * maximumSteering;
    const reversingSteering = (
      rawSteering !== 0
      && this.steering !== 0
      && Math.sign(rawSteering) !== Math.sign(this.steering)
    );
    const steeringRate = reversingSteering
      ? profile === 'low-slip' ? 8.5 : 7
      : profile === 'low-slip'
      ? rawSteering === 0 ? 4.8 : 2.6 - lowSlipBlend * 1.2
      : profile === 'physical-steering'
      ? rawSteering === 0 ? 4.2 : 2.6 - highSpeedBlend * 1.1
      : rawSteering === 0 ? 4.8 : 3.4 - highSpeedBlend * 1.1;
    this.steering = directSteering
      ? rawSteering
      : moveToward(this.steering, steeringTarget, steeringRate * dt);

    const handbrakeTarget = input.handbrake ? 1 : 0;
    this.handbrake = moveToward(this.handbrake, handbrakeTarget, 8 * dt);

    return Object.freeze({
      requestedDirection,
      pedal: this.pedal,
      // Conserva el recorrido completo, pero entrega menos ángulo alrededor
      // del centro para que la fuerza lateral no aparezca como un escalón.
      steering: directSteering
        ? this.steering
        : progressiveSteering(this.steering),
      handbrake: this.handbrake,
    });
  }
}
