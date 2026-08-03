const DEGREES_TO_RADIANS = Math.PI / 180;

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.max(minimum, Math.min(maximum, value))
);
const lerp = (start: number, end: number, amount: number): number => (
  start + (end - start) * amount
);
const smoothStep = (value: number): number => value * value * (3 - 2 * value);

export interface ApexSteeringGeometryInput {
  readonly steering: number;
  readonly speedKmh: number;
  readonly yawRateRadiansPerSecond: number;
  readonly wheelbaseM: number;
  readonly averageTrackM: number;
  readonly blendStartKmh: number;
  readonly blendEndKmh: number;
  readonly lowSpeedDegrees: number;
  readonly highSpeedDegrees: number;
  readonly mechanicalLimitDegrees: number;
}

export interface ApexSteeringGeometryResult {
  readonly frontLeftMaximumRadians: number;
  readonly frontRightMaximumRadians: number;
  readonly innerMaximumDegrees: number;
  readonly counterSteerUnlock: number;
}

/**
 * Resolves speed-sensitive Ackermann geometry without removing the driver's
 * mechanical counter-steer authority. Opposing a developed yaw progressively
 * unlocks the complete rack angle; ordinary high-speed steering remains calm.
 */
export const resolveApexSteeringGeometry = (
  input: ApexSteeringGeometryInput,
): ApexSteeringGeometryResult => {
  const speedBlend = clamp(
    (Math.abs(input.speedKmh) - input.blendStartKmh)
      / Math.max(input.blendEndKmh - input.blendStartKmh, 1),
    0,
    1,
  );
  const speedSensitiveDegrees = lerp(
    input.lowSpeedDegrees,
    input.highSpeedDegrees,
    speedBlend,
  );
  const opposingDevelopedYaw = (
    Math.abs(input.steering) > 0.08
    && input.steering * input.yawRateRadiansPerSecond < 0
  );
  const counterSteerUnlock = opposingDevelopedYaw
    ? smoothStep(clamp(
      (Math.abs(input.yawRateRadiansPerSecond) - 0.18) / (0.9 - 0.18),
      0,
      1,
    ))
    : 0;
  const innerMaximumDegrees = lerp(
    speedSensitiveDegrees,
    input.mechanicalLimitDegrees,
    counterSteerUnlock,
  );
  const innerAngle = innerMaximumDegrees * DEGREES_TO_RADIANS;
  const turnRadius = input.wheelbaseM / Math.max(Math.tan(innerAngle), 1e-4);
  const outerAngle = Math.atan(
    input.wheelbaseM / (turnRadius + input.averageTrackM),
  );

  if (input.steering > 0.001) {
    return Object.freeze({
      frontLeftMaximumRadians: outerAngle,
      frontRightMaximumRadians: innerAngle,
      innerMaximumDegrees,
      counterSteerUnlock,
    });
  }
  if (input.steering < -0.001) {
    return Object.freeze({
      frontLeftMaximumRadians: innerAngle,
      frontRightMaximumRadians: outerAngle,
      innerMaximumDegrees,
      counterSteerUnlock,
    });
  }
  return Object.freeze({
    frontLeftMaximumRadians: innerAngle,
    frontRightMaximumRadians: innerAngle,
    innerMaximumDegrees,
    counterSteerUnlock,
  });
};
