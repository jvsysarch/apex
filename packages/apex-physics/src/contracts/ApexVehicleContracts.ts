import type {
  SurfaceId,
  SurfaceMode,
} from '../surfaces/SurfaceRegistry.ts';
import type { TireModelId } from '../tires/ApexTireModel.ts';
import type { AerodynamicSettings } from '../dynamics/ApexAerodynamics.ts';
import type { ApexTorqueControlSettings } from '../dynamics/ApexTorqueDistributor.ts';
import type {
  ApexTireExecutionBackend,
  ApexTireExecutionPreference,
} from '../tires/force/ApexCompiledTireRuntime.ts';
import type {
  TireOperatingParameters,
} from '../tires/force/TireForceModel.ts';

export type ApexHandlingStage =
  | 'legacy'
  | 'tire-only'
  | 'tire-benchmark'
  | 'mechanical-tc'
  | 'differentials'
  | 'tire-v1.2'
  | 'steering'
  | 'suspension'
  | 'aero';

export type ApexVehicleKind = 'car' | 'motorcycle';
export type ApexVector3Tuple = readonly [number, number, number];
export type ApexQuaternionTuple = readonly [number, number, number, number];

export interface ApexVehicleSpawn {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yawDegrees: number;
}

export interface ApexVehicleTrainingSnapshot {
  readonly position: ApexVector3Tuple;
  readonly rotation: ApexQuaternionTuple;
  readonly linearVelocity: ApexVector3Tuple;
  readonly angularVelocity: ApexVector3Tuple;
}

export interface ApexVehiclePoseSnapshot {
  readonly vehicleKind: ApexVehicleKind;
  readonly position: ApexVector3Tuple;
  readonly rotation: ApexQuaternionTuple;
  readonly wheelPositions: readonly ApexVector3Tuple[];
  readonly wheelRotations: readonly ApexQuaternionTuple[];
  readonly wheelContactErrorsM: readonly number[];
  readonly wheelGrounded: readonly boolean[];
  readonly wheelContactPositions: readonly ApexVector3Tuple[];
  readonly wheelContactNormals: readonly ApexVector3Tuple[];
  readonly wheelContactLongitudinals: readonly ApexVector3Tuple[];
  readonly wheelContactLaterals: readonly ApexVector3Tuple[];
  readonly wheelVerticalLoadsN: readonly number[];
  readonly wheelSuspensionLengthsM: readonly number[];
  readonly wheelAngularVelocitiesRadiansPerSecond: readonly number[];
  readonly wheelLongitudinalSlips: readonly number[];
  readonly wheelLateralSlipRadians: readonly number[];
  readonly wheelLongitudinalForcesN: readonly number[];
  readonly wheelLateralForcesN: readonly number[];
  readonly wheelSurfaces: readonly SurfaceId[];
  readonly tirePressurePsi: number;
  readonly speedKmh: number;
  readonly rpm: number;
  readonly gear: number;
  readonly clutchFriction: number;
  readonly clutchEngagement: number;
  readonly transmissionSwitchingGear: boolean;
  readonly throttle: number;
  readonly brake: number;
  readonly steering: number;
  readonly liftOffFrontAeroBlend: number;
  readonly liftOffFrontDownforceN: number;
}

export interface ApexCarDimensions {
  readonly lengthM: number;
  readonly widthM: number;
  readonly chassisHeightM: number;
  readonly wheelbaseM: number;
  readonly frontTrackM: number;
  readonly rearTrackM: number;
  readonly axleCenterOffsetM: number;
  readonly wheelRadiusM: number;
  readonly wheelWidthM: number;
  readonly centerOfMassOffsetM: number;
}

export interface ApexSuspensionAxleDefinition {
  readonly springFrequencyHz: number;
  readonly damping: number;
  readonly antiRollStiffness: number;
}

export interface ApexChassisBoxDefinition {
  readonly lengthM: number;
  /** Ancho máximo usado cuando la forma no define extremos diferentes. */
  readonly widthM: number;
  /** Ancho del extremo delantero; permite liberar el barrido de dirección. */
  readonly frontWidthM?: number;
  /** Ancho del extremo trasero; por defecto usa widthM. */
  readonly rearWidthM?: number;
  readonly heightM: number;
  /** Centro vertical de la caja respecto del centro de masa del cuerpo. */
  readonly centerOffsetYM: number;
}

export interface ApexCarSuspensionDefinition {
  readonly wheelMountHeightM: number;
  readonly minimumLengthM: number;
  readonly maximumLengthM: number;
  readonly baseline: {
    readonly front: ApexSuspensionAxleDefinition;
    readonly rear: ApexSuspensionAxleDefinition;
  };
  readonly tuned: {
    readonly front: ApexSuspensionAxleDefinition;
    readonly rear: ApexSuspensionAxleDefinition;
  };
}

export interface ApexEngineDefinition {
  readonly maximumTorqueNm: number;
  readonly minimumRpm: number;
  readonly maximumRpm: number;
  readonly normalizedTorqueCurve: readonly (readonly [number, number])[];
}

export interface ApexTransmissionDefinition {
  readonly shiftDownRpm: number;
  readonly shiftUpRpm: number;
  readonly clutchStrength: number;
}

export interface ApexCarWheelDefinition {
  readonly inertiaKgM2: number;
  readonly angularDamping: number;
  readonly maximumSteerAngleDegrees: number;
  readonly frontBrakeTorqueNm: number;
  readonly rearBrakeTorqueNm: number;
  readonly handBrakeTorqueNm: number;
}

export interface ApexCarDrivetrainDefinition {
  readonly frontTorqueRatio: number;
  readonly rearTorqueRatio: number;
  readonly baselineFrontLimitedSlipRatio: number;
  readonly baselineRearLimitedSlipRatio: number;
  readonly baselineCenterLimitedSlipRatio: number;
  readonly tunedFrontLimitedSlipRatio: number;
  readonly tunedRearLimitedSlipRatio: number;
  readonly tunedCenterLimitedSlipRatio: number;
  readonly torqueControl: ApexTorqueControlSettings;
}

export interface ApexSteeringDefinition {
  readonly blendStartKmh: number;
  readonly blendEndKmh: number;
  readonly baselineLowSpeedDegrees: number;
  readonly baselineHighSpeedDegrees: number;
  readonly lowSlipLowSpeedDegrees: number;
  readonly lowSlipHighSpeedDegrees: number;
}

export interface ApexLaunchDefinition {
  readonly boostDurationSeconds: number;
  readonly maximumBoostRatio: number;
}

export interface ApexVehicleAerodynamicsDefinition {
  readonly baseline: AerodynamicSettings;
  readonly fast: AerodynamicSettings;
  readonly dynamicsLateralGripCalibration: number;
  readonly dynamicsDownforceCalibration: number;
}

export interface ApexCarPhysicsDefinition {
  readonly id: string;
  readonly kind: 'car';
  readonly defaultTireModel: TireModelId;
  readonly dimensions: ApexCarDimensions;
  readonly chassisBox: ApexChassisBoxDefinition;
  readonly massKg: number;
  readonly defaultSpawnHeightM: number;
  readonly chassisFriction: number;
  readonly maximumPitchRollDegrees: number;
  readonly collisionTesterRadiusM: number;
  readonly suspension: ApexCarSuspensionDefinition;
  readonly wheels: ApexCarWheelDefinition;
  readonly engine: ApexEngineDefinition;
  readonly transmission: ApexTransmissionDefinition;
  readonly drivetrain: ApexCarDrivetrainDefinition;
  readonly steering: ApexSteeringDefinition;
  readonly launch: ApexLaunchDefinition;
  readonly aerodynamics: ApexVehicleAerodynamicsDefinition;
  readonly defaultTirePressurePsi: number;
}

export interface ApexMotorcycleDimensions {
  readonly lengthM: number;
  readonly widthM: number;
  readonly chassisHeightM: number;
  readonly wheelbaseM: number;
  readonly wheelRadiusM: number;
  readonly wheelWidthM: number;
  readonly centerOfMassOffsetM: number;
}

export interface ApexMotorcyclePhysicsDefinition {
  readonly id: string;
  readonly kind: 'motorcycle';
  readonly defaultTireModel: TireModelId;
  readonly dimensions: ApexMotorcycleDimensions;
  readonly chassisBox: ApexChassisBoxDefinition;
  readonly massKg: number;
  readonly defaultSpawnHeightM: number;
  readonly chassisFriction: number;
  readonly maximumPitchRollDegrees: number;
  readonly collisionTesterRadiusM: number;
  readonly suspensionMinLengthM: number;
  readonly suspensionMaxLengthM: number;
  readonly wheelMountHeightM: number;
  readonly casterAngleDegrees: number;
  readonly frontSuspensionSpringFrequencyHz: number;
  readonly rearSuspensionSpringFrequencyHz: number;
  readonly maximumSteerAngleDegrees: number;
  readonly frontBrakeTorqueNm: number;
  readonly rearBrakeTorqueNm: number;
  readonly handBrakeTorqueNm: number;
  readonly rearDifferentialRatio: number;
  readonly engine: ApexEngineDefinition;
  readonly transmission: ApexTransmissionDefinition;
}

export type ApexVehicleDefinition =
  | ApexCarPhysicsDefinition
  | ApexMotorcyclePhysicsDefinition;

export interface ApexVehicleDynamicsProfile {
  readonly lateralGripMultiplier: number;
  readonly aerodynamicDownforceMultiplier: number;
}

export interface ApexWheelState {
  readonly grounded: boolean;
  readonly longitudinalSlip: number;
  readonly lateralSlipRadians: number;
  readonly suspensionImpulse: number;
  readonly angularVelocity: number;
  readonly suspensionLength: number;
  readonly suspensionMaxLength: number;
  readonly suspensionVelocity: number;
  readonly surface: SurfaceId;
  readonly effectiveLongitudinalSlip: number;
  readonly effectiveLateralSlipRadians: number;
  readonly longitudinalCapacityN: number;
  readonly lateralCapacityN: number;
  readonly aligningMomentNm: number;
  readonly longitudinalForceN: number;
  readonly lateralForceN: number;
  readonly longitudinalSlipVelocityMps: number;
  readonly lateralSlipVelocityMps: number;
  readonly longitudinalPowerLossW: number;
  readonly lateralPowerLossW: number;
  readonly longitudinalEnergyLossJ: number;
  readonly lateralEnergyLossJ: number;
}

export interface ApexVehicleState {
  readonly vehicleKind: ApexVehicleKind;
  readonly speedKmh: number;
  readonly position: ApexVector3Tuple;
  readonly rotation: ApexQuaternionTuple;
  readonly yawRate: number;
  readonly physicsHz: number;
  readonly configuredTireContactCount: number;
  readonly evaluatedTireContactCount: number;
  readonly rpm: number;
  readonly gear: number;
  readonly clutchFriction: number;
  readonly clutchEngagement: number;
  readonly transmissionSwitchingGear: boolean;
  readonly throttle: number;
  readonly brake: number;
  /** Normalized steering input after filtering and driving assists, from -1 to 1. */
  readonly steering: number;
  readonly requestedEngineTorqueNm: number;
  readonly deliveredEngineTorqueNm: number;
  readonly deliveredAxleTorqueNm: readonly [number, number];
  readonly deliveredWheelTorqueNm: readonly [number, number, number, number];
  readonly aerodynamicDragN: number;
  readonly aerodynamicDownforceN: readonly [number, number];
  readonly liftOffFrontAeroBlend: number;
  readonly liftOffFrontDownforceN: number;
  readonly tireModel: TireModelId;
  readonly tireExecutionBackend: ApexTireExecutionBackend | 'jolt';
  readonly tireExecutionPreference: ApexTireExecutionPreference;
  readonly tireOperatingParameters: TireOperatingParameters;
  readonly tireOperatingGripScale: number;
  readonly surfaceMode: SurfaceMode;
  readonly handlingStage: ApexHandlingStage;
  readonly wheels: readonly ApexWheelState[];
}
