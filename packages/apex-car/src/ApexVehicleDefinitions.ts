import type {
  ApexCarPhysicsDefinition,
  ApexMotorcyclePhysicsDefinition,
  ApexVehicleDefinition,
} from '@jvsysarch/apex-physics';
import {
  DEFAULT_TIRE_OPERATING_PARAMETERS,
} from '@jvsysarch/apex-physics';

const torqueCurve = Object.freeze([
  Object.freeze([0.00, 0.62]),
  Object.freeze([0.30, 0.74]),
  Object.freeze([0.55, 0.78]),
  Object.freeze([0.68, 0.82]),
  Object.freeze([0.82, 0.91]),
  Object.freeze([0.94, 1.00]),
  Object.freeze([1.00, 0.96]),
]) as readonly (readonly [number, number])[];

const vertexTorqueCurve = Object.freeze([
  Object.freeze([0.00, 0.82]),
  Object.freeze([0.22, 0.92]),
  Object.freeze([0.45, 1.00]),
  Object.freeze([0.72, 1.00]),
  Object.freeze([0.90, 0.96]),
  Object.freeze([1.00, 0.88]),
]) as readonly (readonly [number, number])[];

export const APEX_ROAD_CAR: ApexCarPhysicsDefinition = Object.freeze({
  id: 'apex-road-car',
  kind: 'car',
  defaultTireModel: 'apex-tmeasy-v1',
  dimensions: Object.freeze({
    lengthM: 4.7,
    widthM: 1.86,
    chassisHeightM: 0.64,
    wheelbaseM: 3.379,
    frontTrackM: 1.638,
    rearTrackM: 1.712,
    axleCenterOffsetM: -0.085,
    wheelRadiusM: 0.426,
    wheelWidthM: 0.289,
    centerOfMassOffsetM: 0.36,
  }),
  chassisBox: Object.freeze({
    lengthM: 4.7,
    widthM: 1.32,
    frontWidthM: 0.72,
    rearWidthM: 1.32,
    heightM: 0.64,
    centerOffsetYM: 0.2,
  }),
  massKg: 1550,
  defaultSpawnHeightM: 0.78,
  chassisFriction: 0.7,
  maximumPitchRollDegrees: 60,
  collisionTesterRadiusM: 0.05,
  suspension: Object.freeze({
    // More bump and, especially, droop travel lets the wheels follow crests
    // without introducing an artificial force that glues the chassis down.
    // Raising the mount by the added droop preserves the previous ride height.
    wheelMountHeightM: 0.16,
    minimumLengthM: 0.18,
    maximumLengthM: 0.48,
    baseline: Object.freeze({
      front: Object.freeze({
        springFrequencyHz: 1.5,
        damping: 0.5,
        antiRollStiffness: 1000,
      }),
      rear: Object.freeze({
        springFrequencyHz: 1.5,
        damping: 0.5,
        antiRollStiffness: 1000,
      }),
    }),
    tuned: Object.freeze({
      front: Object.freeze({
        springFrequencyHz: 1.8,
        damping: 0.56,
        antiRollStiffness: 1500,
      }),
      rear: Object.freeze({
        springFrequencyHz: 1.65,
        damping: 0.54,
        antiRollStiffness: 1150,
      }),
    }),
  }),
  wheels: Object.freeze({
    inertiaKgM2: 0.9,
    angularDamping: 0.2,
    maximumSteerAngleDegrees: 38,
    frontBrakeTorqueNm: 3600,
    rearBrakeTorqueNm: 2800,
    handBrakeTorqueNm: 5000,
  }),
  engine: Object.freeze({
    maximumTorqueNm: 1350,
    minimumRpm: 900,
    maximumRpm: 8500,
    normalizedTorqueCurve: torqueCurve,
  }),
  transmission: Object.freeze({
    shiftDownRpm: 3500,
    shiftUpRpm: 8200,
    clutchStrength: 10,
  }),
  drivetrain: Object.freeze({
    frontTorqueRatio: 0.45,
    rearTorqueRatio: 0.55,
    baselineFrontLimitedSlipRatio: 1.4,
    baselineRearLimitedSlipRatio: 1.4,
    baselineCenterLimitedSlipRatio: 1.4,
    tunedFrontLimitedSlipRatio: 1.18,
    tunedRearLimitedSlipRatio: 1.22,
    tunedCenterLimitedSlipRatio: 1.2,
    torqueControl: Object.freeze({
      baseWheelTorqueFractions: Object.freeze([
        0.225,
        0.225,
        0.275,
        0.275,
      ]) as readonly [number, number, number, number],
      defaultFrontTorqueRatio: 0.45,
      defaultRightSplit: 0.5,
      minimumRightSplit: 0.08,
      maximumRightSplit: 0.92,
      enterSlip: 0.05,
      exitSlip: 0.03,
      fullInterventionSlip: 0.11,
      maximumWheelReduction: 0.97,
      minimumDeliveredTorqueScale: 0.1,
      interventionAttack: 55,
      interventionRelease: 8,
      axleRatioRatePerSecond: 0.8,
      leftRightSplitRatePerSecond: 2.8,
      minimumFrontTorqueRatio: 0.25,
      maximumFrontTorqueRatio: 0.7,
    }),
  }),
  steering: Object.freeze({
    blendStartKmh: 20,
    blendEndKmh: 120,
    baselineLowSpeedDegrees: 36,
    baselineHighSpeedDegrees: 16,
    lowSlipLowSpeedDegrees: 36,
    lowSlipHighSpeedDegrees: 14,
  }),
  launch: Object.freeze({
    boostDurationSeconds: 0.9,
    maximumBoostRatio: 0.1,
  }),
  aerodynamics: Object.freeze({
    baseline: Object.freeze({
      airDensity: 1.225,
      dragArea: 0.72,
      downforceArea: 2.05,
      frontBalance: 0.49,
      maximumDownforce: 7000,
      liftOffFrontArea: 0.32,
      maximumLiftOffFrontDownforce: 750,
    }),
    fast: Object.freeze({
      airDensity: 1.225,
      dragArea: 0.66,
      downforceArea: 1.97,
      frontBalance: 0.5,
      maximumDownforce: 7000,
      liftOffFrontArea: 0.32,
      maximumLiftOffFrontDownforce: 750,
    }),
    dynamicsLateralGripCalibration: 1.08,
    dynamicsDownforceCalibration: 1.3,
  }),
  defaultTirePressurePsi: DEFAULT_TIRE_OPERATING_PARAMETERS.pressurePsi,
});

export const VERTEX_ARCADE: ApexCarPhysicsDefinition = Object.freeze({
  ...APEX_ROAD_CAR,
  id: 'vertex-arcade',
  massKg: 1325,
  maximumPitchRollDegrees: 48,
  suspension: Object.freeze({
    ...APEX_ROAD_CAR.suspension,
    baseline: Object.freeze({
      front: Object.freeze({
        springFrequencyHz: 2.35,
        damping: 0.68,
        antiRollStiffness: 2600,
      }),
      rear: Object.freeze({
        springFrequencyHz: 2.15,
        damping: 0.66,
        antiRollStiffness: 2200,
      }),
    }),
    tuned: Object.freeze({
      front: Object.freeze({
        springFrequencyHz: 2.55,
        damping: 0.72,
        antiRollStiffness: 3100,
      }),
      rear: Object.freeze({
        springFrequencyHz: 2.35,
        damping: 0.7,
        antiRollStiffness: 2650,
      }),
    }),
  }),
  wheels: Object.freeze({
    ...APEX_ROAD_CAR.wheels,
    maximumSteerAngleDegrees: 40,
    frontBrakeTorqueNm: 5400,
    rearBrakeTorqueNm: 4200,
    handBrakeTorqueNm: 6200,
  }),
  engine: Object.freeze({
    maximumTorqueNm: 2100,
    minimumRpm: 900,
    maximumRpm: 9500,
    normalizedTorqueCurve: vertexTorqueCurve,
  }),
  transmission: Object.freeze({
    shiftDownRpm: 4300,
    shiftUpRpm: 9200,
    clutchStrength: 18,
  }),
  drivetrain: Object.freeze({
    ...APEX_ROAD_CAR.drivetrain,
    frontTorqueRatio: 0.48,
    rearTorqueRatio: 0.52,
    tunedFrontLimitedSlipRatio: 1.08,
    tunedRearLimitedSlipRatio: 1.1,
    tunedCenterLimitedSlipRatio: 1.08,
    torqueControl: Object.freeze({
      ...APEX_ROAD_CAR.drivetrain.torqueControl,
      baseWheelTorqueFractions: Object.freeze([
        0.24,
        0.24,
        0.26,
        0.26,
      ]) as readonly [number, number, number, number],
      defaultFrontTorqueRatio: 0.48,
      enterSlip: 0.035,
      exitSlip: 0.02,
      fullInterventionSlip: 0.085,
      interventionAttack: 72,
      interventionRelease: 11,
      axleRatioRatePerSecond: 1.7,
      leftRightSplitRatePerSecond: 5.2,
      minimumFrontTorqueRatio: 0.3,
      maximumFrontTorqueRatio: 0.72,
    }),
  }),
  steering: Object.freeze({
    blendStartKmh: 28,
    blendEndKmh: 185,
    baselineLowSpeedDegrees: 38,
    baselineHighSpeedDegrees: 11,
    lowSlipLowSpeedDegrees: 40,
    lowSlipHighSpeedDegrees: 12,
  }),
  launch: Object.freeze({
    boostDurationSeconds: 1.35,
    maximumBoostRatio: 0.48,
  }),
  pulseBoost: Object.freeze({
    durationSeconds: 1.1,
    rechargeSeconds: 4.5,
    maximumBoostRatio: 0.42,
  }),
  aerodynamics: Object.freeze({
    baseline: Object.freeze({
      ...APEX_ROAD_CAR.aerodynamics.baseline,
      dragArea: 0.58,
      downforceArea: 5.2,
      frontBalance: 0.5,
      maximumDownforce: 18_000,
      liftOffFrontArea: 0.58,
      maximumLiftOffFrontDownforce: 1500,
    }),
    fast: Object.freeze({
      ...APEX_ROAD_CAR.aerodynamics.fast,
      dragArea: 0.54,
      downforceArea: 5.45,
      frontBalance: 0.5,
      maximumDownforce: 19_500,
      liftOffFrontArea: 0.62,
      maximumLiftOffFrontDownforce: 1650,
    }),
    dynamicsLateralGripCalibration: 1.35,
    dynamicsDownforceCalibration: 1.75,
  }),
});

export const VERTEX_HYPER: ApexCarPhysicsDefinition = Object.freeze({
  ...VERTEX_ARCADE,
  id: 'vertex-hyper',
  massKg: 1100,
  maximumPitchRollDegrees: 25,
  wheels: Object.freeze({
    ...VERTEX_ARCADE.wheels,
    maximumSteerAngleDegrees: 45,
    frontBrakeTorqueNm: 6500,
    rearBrakeTorqueNm: 5200,
  }),
  engine: Object.freeze({
    ...VERTEX_ARCADE.engine,
    maximumTorqueNm: 4200,
  }),
  steering: Object.freeze({
    ...VERTEX_ARCADE.steering,
    baselineLowSpeedDegrees: 43,
    baselineHighSpeedDegrees: 12,
    lowSlipLowSpeedDegrees: 45,
    lowSlipHighSpeedDegrees: 14,
  }),
  pulseBoost: Object.freeze({
    durationSeconds: 1.3,
    rechargeSeconds: 2,
    maximumBoostRatio: 0.8,
  }),
  arcadeDriveForceN: 35_000,
  rollStabilityDampingPerSecond: 2.5,
  aerodynamics: Object.freeze({
    ...VERTEX_ARCADE.aerodynamics,
    dynamicsLateralGripCalibration: 1.5,
    dynamicsDownforceCalibration: 2,
  }),
});

export const APEX_JOLT_ROAD_CAR: ApexCarPhysicsDefinition = Object.freeze({
  ...APEX_ROAD_CAR,
  id: 'apex-jolt-road-car',
  defaultTireModel: 'jolt-default',
});

const APEX_MOTORCYCLE_BASE: Omit<
  ApexMotorcyclePhysicsDefinition,
  'id' | 'defaultTireModel'
> = Object.freeze({
  kind: 'motorcycle',
  dimensions: Object.freeze({
    lengthM: 1.5,
    widthM: 0.4,
    chassisHeightM: 0.6,
    wheelbaseM: 1.5,
    wheelRadiusM: 0.31,
    wheelWidthM: 0.12,
    centerOfMassOffsetM: 0.3,
  }),
  chassisBox: Object.freeze({
    lengthM: 0.8,
    widthM: 0.4,
    heightM: 0.6,
    centerOffsetYM: 0.3,
  }),
  massKg: 240,
  defaultSpawnHeightM: 1.05,
  chassisFriction: 0.7,
  maximumPitchRollDegrees: 60,
  collisionTesterRadiusM: 1,
  suspensionMinLengthM: 0.3,
  suspensionMaxLengthM: 0.5,
  wheelMountHeightM: -0.27,
  casterAngleDegrees: 30,
  frontSuspensionSpringFrequencyHz: 1.5,
  rearSuspensionSpringFrequencyHz: 2,
  maximumSteerAngleDegrees: 30,
  frontBrakeTorqueNm: 500,
  rearBrakeTorqueNm: 250,
  handBrakeTorqueNm: 250,
  rearDifferentialRatio: 1.93 * 40 / 16,
  engine: Object.freeze({
    maximumTorqueNm: 150,
    minimumRpm: 1000,
    maximumRpm: 10000,
    normalizedTorqueCurve: Object.freeze([]),
  }),
  transmission: Object.freeze({
    shiftDownRpm: 2000,
    shiftUpRpm: 8000,
    clutchStrength: 2,
  }),
});

export const APEX_MOTORCYCLE: ApexMotorcyclePhysicsDefinition = Object.freeze({
  ...APEX_MOTORCYCLE_BASE,
  id: 'apex-jolt-motorcycle',
  defaultTireModel: 'jolt-default',
});

export const APEX_TMEASY_MOTORCYCLE: ApexMotorcyclePhysicsDefinition = (
  Object.freeze({
    ...APEX_MOTORCYCLE_BASE,
    id: 'apex-tmeasy-motorcycle',
    defaultTireModel: 'apex-tmeasy-v1',
  })
);

export interface ApexMotorcycleCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly experimental: boolean;
  readonly definition: ApexMotorcyclePhysicsDefinition;
}

export const APEX_MOTORCYCLE_CATALOG: readonly ApexMotorcycleCatalogEntry[] = (
  Object.freeze([
    Object.freeze({
      id: 'jolt',
      name: 'Moto Jolt',
      experimental: false,
      definition: APEX_MOTORCYCLE,
    }),
    Object.freeze({
      id: 'apex-tmeasy',
      name: 'Moto Apex TMeasy · experimental',
      experimental: true,
      definition: APEX_TMEASY_MOTORCYCLE,
    }),
  ])
);

export const DEFAULT_APEX_MOTORCYCLE: ApexMotorcycleCatalogEntry = (
  APEX_MOTORCYCLE_CATALOG[0]!
);

export const findApexMotorcycle = (
  id: string | null | undefined,
): ApexMotorcycleCatalogEntry | undefined => (
  APEX_MOTORCYCLE_CATALOG.find(entry => entry.id === id)
);

export const APEX_VEHICLE_DEFINITIONS: ReadonlyMap<
  string,
  ApexVehicleDefinition
> = new Map<string, ApexVehicleDefinition>([
  [APEX_ROAD_CAR.id, APEX_ROAD_CAR],
  [VERTEX_ARCADE.id, VERTEX_ARCADE],
  [VERTEX_HYPER.id, VERTEX_HYPER],
  [APEX_JOLT_ROAD_CAR.id, APEX_JOLT_ROAD_CAR],
  [APEX_MOTORCYCLE.id, APEX_MOTORCYCLE],
  [APEX_TMEASY_MOTORCYCLE.id, APEX_TMEASY_MOTORCYCLE],
]);
