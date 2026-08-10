import type { ApexCarPhysicsDefinition } from '@jvsysarch/apex-physics';

export interface ApexVertexTuning {
  readonly torqueNm: number;
  readonly massKg: number;
  readonly brakeMultiplier: number;
  readonly steeringAngleDegrees: number;
  readonly frontAntiRollStiffness: number;
  readonly rearAntiRollStiffness: number;
  readonly frontDamping: number;
  readonly rearDamping: number;
  readonly gripMultiplier: number;
  readonly pulseBoostRatio: number;
  readonly pulseDurationSeconds: number;
  readonly pulseRechargeSeconds: number;
  readonly rolloverStability: number;
}

export const APEX_VERTEX_TUNING_STORAGE_KEY = 'apex-drive.vertex-arcade.tuning.v1';

export const DEFAULT_APEX_VERTEX_TUNING: ApexVertexTuning = Object.freeze({
  torqueNm: 2100,
  massKg: 1325,
  brakeMultiplier: 1.35,
  steeringAngleDegrees: 40,
  frontAntiRollStiffness: 3800,
  rearAntiRollStiffness: 3300,
  frontDamping: 0.78,
  rearDamping: 0.76,
  gripMultiplier: 1,
  pulseBoostRatio: 0.42,
  pulseDurationSeconds: 1.1,
  pulseRechargeSeconds: 4.5,
  rolloverStability: 0.8,
});

const clamp = (value: unknown, minimum: number, maximum: number): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Math.min(maximum, Math.max(minimum, Number.isFinite(numeric) ? numeric : minimum));
};

export const normalizeApexVertexTuning = (
  value: Partial<ApexVertexTuning> | undefined,
): ApexVertexTuning => Object.freeze({
  torqueNm: clamp(value?.torqueNm ?? DEFAULT_APEX_VERTEX_TUNING.torqueNm, 900, 3200),
  massKg: clamp(value?.massKg ?? DEFAULT_APEX_VERTEX_TUNING.massKg, 950, 1800),
  brakeMultiplier: clamp(value?.brakeMultiplier ?? DEFAULT_APEX_VERTEX_TUNING.brakeMultiplier, 0.8, 2),
  steeringAngleDegrees: clamp(value?.steeringAngleDegrees ?? DEFAULT_APEX_VERTEX_TUNING.steeringAngleDegrees, 24, 45),
  frontAntiRollStiffness: clamp(value?.frontAntiRollStiffness ?? DEFAULT_APEX_VERTEX_TUNING.frontAntiRollStiffness, 1200, 7000),
  rearAntiRollStiffness: clamp(value?.rearAntiRollStiffness ?? DEFAULT_APEX_VERTEX_TUNING.rearAntiRollStiffness, 1200, 7000),
  frontDamping: clamp(value?.frontDamping ?? DEFAULT_APEX_VERTEX_TUNING.frontDamping, 0.45, 0.95),
  rearDamping: clamp(value?.rearDamping ?? DEFAULT_APEX_VERTEX_TUNING.rearDamping, 0.45, 0.95),
  gripMultiplier: clamp(value?.gripMultiplier ?? DEFAULT_APEX_VERTEX_TUNING.gripMultiplier, 0.75, 1.2),
  pulseBoostRatio: clamp(value?.pulseBoostRatio ?? DEFAULT_APEX_VERTEX_TUNING.pulseBoostRatio, 0.15, 0.85),
  pulseDurationSeconds: clamp(value?.pulseDurationSeconds ?? DEFAULT_APEX_VERTEX_TUNING.pulseDurationSeconds, 0.5, 2),
  pulseRechargeSeconds: clamp(value?.pulseRechargeSeconds ?? DEFAULT_APEX_VERTEX_TUNING.pulseRechargeSeconds, 1.5, 8),
  rolloverStability: clamp(value?.rolloverStability ?? DEFAULT_APEX_VERTEX_TUNING.rolloverStability, 0, 1),
});

export const readApexVertexTuning = (): ApexVertexTuning => {
  try {
    const stored = localStorage.getItem(APEX_VERTEX_TUNING_STORAGE_KEY);
    return normalizeApexVertexTuning(
      stored ? JSON.parse(stored) as Partial<ApexVertexTuning> : undefined,
    );
  } catch {
    return DEFAULT_APEX_VERTEX_TUNING;
  }
};

export const writeApexVertexTuning = (value: ApexVertexTuning): void => {
  localStorage.setItem(
    APEX_VERTEX_TUNING_STORAGE_KEY,
    JSON.stringify(normalizeApexVertexTuning(value)),
  );
};

export const resetApexVertexTuning = (): void => {
  localStorage.removeItem(APEX_VERTEX_TUNING_STORAGE_KEY);
};

export const applyApexVertexTuning = (
  definition: ApexCarPhysicsDefinition,
  requested: ApexVertexTuning,
): ApexCarPhysicsDefinition => {
  const tuning = normalizeApexVertexTuning(requested);
  const stability = tuning.rolloverStability;
  const centerOfMassOffsetM = 0.3 - stability * 0.19;
  const collisionCenterYM = (
    definition.dimensions.centerOfMassOffsetM
    + definition.chassisBox.centerOffsetYM
  );
  const maximumPitchRollDegrees = 48 - stability * 23;

  const tuneAxle = (
    axle: ApexCarPhysicsDefinition['suspension']['tuned']['front'],
    damping: number,
    antiRollStiffness: number,
  ) => Object.freeze({
    ...axle,
    damping,
    antiRollStiffness,
  });

  return Object.freeze({
    ...definition,
    id: `${definition.id}:tuned`,
    massKg: tuning.massKg,
    maximumPitchRollDegrees,
    dimensions: Object.freeze({
      ...definition.dimensions,
      centerOfMassOffsetM,
    }),
    chassisBox: Object.freeze({
      ...definition.chassisBox,
      centerOffsetYM: collisionCenterYM - centerOfMassOffsetM,
    }),
    suspension: Object.freeze({
      ...definition.suspension,
      baseline: Object.freeze({
        front: tuneAxle(
          definition.suspension.baseline.front,
          tuning.frontDamping,
          tuning.frontAntiRollStiffness,
        ),
        rear: tuneAxle(
          definition.suspension.baseline.rear,
          tuning.rearDamping,
          tuning.rearAntiRollStiffness,
        ),
      }),
      tuned: Object.freeze({
        front: tuneAxle(
          definition.suspension.tuned.front,
          tuning.frontDamping,
          tuning.frontAntiRollStiffness,
        ),
        rear: tuneAxle(
          definition.suspension.tuned.rear,
          tuning.rearDamping,
          tuning.rearAntiRollStiffness,
        ),
      }),
    }),
    wheels: Object.freeze({
      ...definition.wheels,
      maximumSteerAngleDegrees: tuning.steeringAngleDegrees,
      frontBrakeTorqueNm:
        definition.wheels.frontBrakeTorqueNm * tuning.brakeMultiplier,
      rearBrakeTorqueNm:
        definition.wheels.rearBrakeTorqueNm * tuning.brakeMultiplier,
    }),
    engine: Object.freeze({
      ...definition.engine,
      maximumTorqueNm: tuning.torqueNm,
    }),
    steering: Object.freeze({
      ...definition.steering,
      baselineLowSpeedDegrees: tuning.steeringAngleDegrees * 0.95,
      baselineHighSpeedDegrees: Math.max(8, tuning.steeringAngleDegrees * 0.275),
      lowSlipLowSpeedDegrees: tuning.steeringAngleDegrees,
      lowSlipHighSpeedDegrees: Math.max(9, tuning.steeringAngleDegrees * 0.3),
    }),
    pulseBoost: Object.freeze({
      durationSeconds: tuning.pulseDurationSeconds,
      rechargeSeconds: tuning.pulseRechargeSeconds,
      maximumBoostRatio: tuning.pulseBoostRatio,
    }),
    rollStabilityDampingPerSecond: stability * 2.2,
    aerodynamics: Object.freeze({
      ...definition.aerodynamics,
      dynamicsLateralGripCalibration:
        definition.aerodynamics.dynamicsLateralGripCalibration
        * tuning.gripMultiplier,
    }),
  });
};
