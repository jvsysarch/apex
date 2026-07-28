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
    wheelMountHeightM: 0.08,
    minimumLengthM: 0.2,
    maximumLengthM: 0.4,
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
        damping: 0.65,
        antiRollStiffness: 1500,
      }),
      rear: Object.freeze({
        springFrequencyHz: 1.65,
        damping: 0.6,
        antiRollStiffness: 1150,
      }),
    }),
  }),
  wheels: Object.freeze({
    inertiaKgM2: 0.9,
    angularDamping: 0.2,
    maximumSteerAngleDegrees: 32,
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
    baselineLowSpeedDegrees: 32,
    baselineHighSpeedDegrees: 14,
    lowSlipLowSpeedDegrees: 30,
    lowSlipHighSpeedDegrees: 10,
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
  [APEX_JOLT_ROAD_CAR.id, APEX_JOLT_ROAD_CAR],
  [APEX_MOTORCYCLE.id, APEX_MOTORCYCLE],
  [APEX_TMEASY_MOTORCYCLE.id, APEX_TMEASY_MOTORCYCLE],
]);
