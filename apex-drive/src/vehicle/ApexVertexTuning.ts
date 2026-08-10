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
  readonly continuousBoostForceN: number;
  readonly pulseBoostRatio: number;
  readonly pulseDurationSeconds: number;
  readonly pulseRechargeSeconds: number;
  readonly rolloverStability: number;
}

export const APEX_VERTEX_TUNING_STORAGE_KEY = 'apex-drive.vertex-arcade.tuning.v1';
export const APEX_VERTEX_HYPER_TUNING_STORAGE_KEY = 'apex-drive.vertex-hyper.tuning.v1';
export type ApexTunableArcadeVehicleId = 'vertex-arcade' | 'vertex-hyper';

export const DEFAULT_APEX_VERTEX_TUNING: ApexVertexTuning = Object.freeze({
  torqueNm: 2100,
  massKg: 1325,
  brakeMultiplier: 2.2,
  steeringAngleDegrees: 40,
  frontAntiRollStiffness: 3800,
  rearAntiRollStiffness: 3300,
  frontDamping: 0.78,
  rearDamping: 0.76,
  gripMultiplier: 1,
  continuousBoostForceN: 14_000,
  pulseBoostRatio: 0.42,
  pulseDurationSeconds: 1.1,
  pulseRechargeSeconds: 4.5,
  rolloverStability: 0.8,
});

export const DEFAULT_APEX_VERTEX_HYPER_TUNING: ApexVertexTuning = Object.freeze({
  torqueNm: 4200,
  massKg: 1100,
  brakeMultiplier: 3.5,
  steeringAngleDegrees: 45,
  frontAntiRollStiffness: 5200,
  rearAntiRollStiffness: 4600,
  frontDamping: 0.88,
  rearDamping: 0.84,
  gripMultiplier: 1.2,
  continuousBoostForceN: 35_000,
  pulseBoostRatio: 0.8,
  pulseDurationSeconds: 1.3,
  pulseRechargeSeconds: 2,
  rolloverStability: 0.95,
});

const clamp = (value: unknown, minimum: number, maximum: number): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Math.min(maximum, Math.max(minimum, Number.isFinite(numeric) ? numeric : minimum));
};

export const normalizeApexVertexTuning = (
  value: Partial<ApexVertexTuning> | undefined,
  defaults: ApexVertexTuning = DEFAULT_APEX_VERTEX_TUNING,
): ApexVertexTuning => Object.freeze({
  torqueNm: clamp(value?.torqueNm ?? defaults.torqueNm, 0, 50_000),
  massKg: clamp(value?.massKg ?? defaults.massKg, 100, 10_000),
  brakeMultiplier: clamp(value?.brakeMultiplier ?? defaults.brakeMultiplier, 0, 25),
  steeringAngleDegrees: clamp(value?.steeringAngleDegrees ?? defaults.steeringAngleDegrees, 5, 80),
  frontAntiRollStiffness: clamp(value?.frontAntiRollStiffness ?? defaults.frontAntiRollStiffness, 0, 100_000),
  rearAntiRollStiffness: clamp(value?.rearAntiRollStiffness ?? defaults.rearAntiRollStiffness, 0, 100_000),
  frontDamping: clamp(value?.frontDamping ?? defaults.frontDamping, 0, 5),
  rearDamping: clamp(value?.rearDamping ?? defaults.rearDamping, 0, 5),
  gripMultiplier: clamp(value?.gripMultiplier ?? defaults.gripMultiplier, 0.1, 4),
  continuousBoostForceN: clamp(value?.continuousBoostForceN ?? defaults.continuousBoostForceN, 0, 500_000),
  pulseBoostRatio: clamp(value?.pulseBoostRatio ?? defaults.pulseBoostRatio, 0, 10),
  pulseDurationSeconds: clamp(value?.pulseDurationSeconds ?? defaults.pulseDurationSeconds, 0.05, 10),
  pulseRechargeSeconds: clamp(value?.pulseRechargeSeconds ?? defaults.pulseRechargeSeconds, 0, 30),
  rolloverStability: clamp(value?.rolloverStability ?? defaults.rolloverStability, 0, 1),
});

const defaultsFor = (vehicleId: ApexTunableArcadeVehicleId): ApexVertexTuning => (
  vehicleId === 'vertex-hyper'
    ? DEFAULT_APEX_VERTEX_HYPER_TUNING
    : DEFAULT_APEX_VERTEX_TUNING
);

const storageKeyFor = (vehicleId: ApexTunableArcadeVehicleId): string => (
  vehicleId === 'vertex-hyper'
    ? APEX_VERTEX_HYPER_TUNING_STORAGE_KEY
    : APEX_VERTEX_TUNING_STORAGE_KEY
);

export const readApexArcadeTuning = (
  vehicleId: ApexTunableArcadeVehicleId,
): ApexVertexTuning => {
  try {
    const stored = localStorage.getItem(storageKeyFor(vehicleId));
    return normalizeApexVertexTuning(
      stored ? JSON.parse(stored) as Partial<ApexVertexTuning> : undefined,
      defaultsFor(vehicleId),
    );
  } catch {
    return defaultsFor(vehicleId);
  }
};

export const writeApexArcadeTuning = (
  vehicleId: ApexTunableArcadeVehicleId,
  value: ApexVertexTuning,
): void => {
  localStorage.setItem(
    storageKeyFor(vehicleId),
    JSON.stringify(normalizeApexVertexTuning(value, defaultsFor(vehicleId))),
  );
};

export const readApexVertexTuning = (): ApexVertexTuning => {
  return readApexArcadeTuning('vertex-arcade');
};

export const writeApexVertexTuning = (value: ApexVertexTuning): void => {
  writeApexArcadeTuning('vertex-arcade', value);
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
    arcadeDriveForceN: tuning.continuousBoostForceN,
    rollStabilityDampingPerSecond: stability * 2.2,
    aerodynamics: Object.freeze({
      ...definition.aerodynamics,
      dynamicsLateralGripCalibration:
        definition.aerodynamics.dynamicsLateralGripCalibration
        * tuning.gripMultiplier,
    }),
  });
};
