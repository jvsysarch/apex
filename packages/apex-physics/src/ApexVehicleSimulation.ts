import {
  SurfaceRegistry,
  type SurfaceId,
  type SurfaceMode,
} from './surfaces/SurfaceRegistry.ts';
import type { DriverInput } from './contracts/DriverInput.ts';
export type { DriverInput } from './contracts/DriverInput.ts';
import type {
  ApexStaticColliderGroup,
  ApexStaticWorldPort,
} from './contracts/ApexStaticWorldContracts.ts';
import type {
  ApexCarDimensions,
  ApexCarPhysicsDefinition,
  ApexHandlingStage,
  ApexMotorcyclePhysicsDefinition,
  ApexVehicleDefinition,
  ApexVehicleDynamicsProfile,
  ApexVehicleKind,
  ApexVehiclePoseSnapshot,
  ApexVehicleSpawn,
  ApexVehicleState,
  ApexVehicleTrainingSnapshot,
  ApexQuaternionTuple,
  ApexVector3Tuple,
  ApexWheelState,
} from './contracts/ApexVehicleContracts.ts';
export type {
  ApexCarDimensions,
  ApexCarPhysicsDefinition,
  ApexHandlingStage,
  ApexMotorcyclePhysicsDefinition,
  ApexVehicleDefinition,
  ApexVehicleDynamicsProfile,
  ApexVehicleKind,
  ApexVehiclePoseSnapshot,
  ApexVehicleSpawn,
  ApexVehicleState,
  ApexVehicleTrainingSnapshot,
  ApexQuaternionTuple,
  ApexVector3Tuple,
  ApexWheelState,
} from './contracts/ApexVehicleContracts.ts';
import {
  ApexTireModel,
  APEX_TIRE_V1_1_SETTINGS,
  APEX_TIRE_V1_2_SETTINGS,
  type TireModelId,
} from './tires/ApexTireModel.ts';
import { ApexBrush } from './tires/force/ApexBrush.ts';
import {
  ApexCompiledTireRuntime,
  type ApexTireExecutionBackend,
  type ApexTireExecutionPreference,
} from './tires/force/ApexCompiledTireRuntime.ts';
import {
  ApexTMeasy,
  APEX_TMEASY_SETTINGS,
} from './tires/force/ApexTMeasy.ts';
import type {
  TireForceModel,
  TireForces,
  TireOperatingParameters,
} from './tires/force/TireForceModel.ts';
import {
  DEFAULT_TIRE_OPERATING_PARAMETERS,
  evaluateContactPatches,
  normalizeTireOperatingParameters,
  tireOperatingScales,
} from './tires/force/TireForceModel.ts';
import { ApexAerodynamics } from './dynamics/ApexAerodynamics.ts';
import {
  ApexAssists,
  type ApexHandlingSample,
} from './dynamics/ApexAssists.ts';
import { resolveApexSteeringGeometry } from './dynamics/ApexSteeringGeometry.ts';
import { ApexTorqueDistributor } from './dynamics/ApexTorqueDistributor.ts';
import { ApexInputFilter } from './input/ApexInputFilter.ts';
import {
  ApexJoltStaticWorldAdapter,
} from './static/ApexJoltStaticWorldAdapter.ts';

const STATIC_LAYER = 0;
const MOVING_LAYER = 1;
export const PHYSICS_HZ = 360;
export const DEFAULT_TIRE_CONTACT_COUNT = 8;
const TMEASY_NINE_POINT_MODEL = 'apex-tmeasy-9p-v2' as const;
const PHYSICAL_CONTACTS_PER_WHEEL = 9;
const PHYSICAL_CONTACT_COUNT = 4 * PHYSICAL_CONTACTS_PER_WHEEL;
const STANDARD_GRAVITY_MPS2 = 9.80665;
const DEGREES_TO_RADIANS = Math.PI / 180;
const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.max(minimum, Math.min(maximum, value))
);
const vector3Tuple = (
  x: number,
  y: number,
  z: number,
): ApexVector3Tuple => [x, y, z];
const quaternionTuple = (
  x: number,
  y: number,
  z: number,
  w: number,
): ApexQuaternionTuple => [x, y, z, w];
const normalizedVector3Tuple = (
  x: number,
  y: number,
  z: number,
  fallback: ApexVector3Tuple,
): ApexVector3Tuple => {
  const length = Math.hypot(x, y, z);
  return length > 1e-9
    ? [x / length, y / length, z / length]
    : fallback;
};
const rotateVectorByQuaternion = (
  vector: ApexVector3Tuple,
  quaternion: ApexQuaternionTuple,
): ApexVector3Tuple => {
  const [x, y, z] = vector;
  const [qx, qy, qz, qw] = quaternion;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
};
const inverseRotateVectorByQuaternion = (
  vector: ApexVector3Tuple,
  quaternion: ApexQuaternionTuple,
): ApexVector3Tuple => rotateVectorByQuaternion(
  vector,
  [-quaternion[0], -quaternion[1], -quaternion[2], quaternion[3]],
);
const NINE_POINT_LATERAL_FACTORS = Object.freeze([-0.38, 0, 0.38]);
const NINE_POINT_LONGITUDINAL_OFFSETS_M = Object.freeze([-0.1, 0, 0.1]);
const NINE_POINT_AXIS_WEIGHTS = Object.freeze([1, 2, 1]);
interface ApexNinePointHit {
  hit: boolean;
  weight: number;
  x: number;
  y: number;
  z: number;
  forwardX: number;
  forwardY: number;
  forwardZ: number;
  lateralX: number;
  lateralY: number;
  lateralZ: number;
  longitudinalVelocityMps: number;
  lateralVelocityMps: number;
  surface: SurfaceId;
}

/** @internal Implementación Jolt para una instancia de vehículo. */
export class ApexVehicleSimulation implements ApexStaticWorldPort {
  private readonly vehicleKind: ApexVehicleKind;
  private readonly carPhysicsDefinition?: ApexCarPhysicsDefinition;
  private readonly motorcyclePhysicsDefinition?: ApexMotorcyclePhysicsDefinition;
  private readonly initialSpawn: ApexVehicleSpawn | undefined;
  private readonly wheelCount: number;
  private readonly wheelRadiusM: number;
  private readonly J: any;
  private readonly jolt: any;
  private readonly bodyInterface: any;
  private readonly physicsSystem: any;
  private readonly carBody: any;
  private readonly constraint: any;
  private readonly controller: any;
  private readonly frontDifferential: any | undefined;
  private readonly rearDifferential: any | undefined;
  private readonly wheelSettings: readonly any[];
  private readonly frontAntiRollBar: any | undefined;
  private readonly rearAntiRollBar: any | undefined;
  private readonly stepListener: any;
  private readonly wheelRight: any;
  private readonly wheelUp: any;
  private readonly previousSuspensionLengths = [0, 0, 0, 0];
  private readonly suspensionVelocities = [0, 0, 0, 0];
  private readonly surfaceRegistry = new SurfaceRegistry();
  private readonly apexTireModelV1 = new ApexTireModel();
  private readonly apexTireModelV11 = new ApexTireModel(APEX_TIRE_V1_1_SETTINGS);
  private readonly apexTireModelV12 = new ApexTireModel(APEX_TIRE_V1_2_SETTINGS);
  private readonly apexBrush = new ApexBrush();
  private readonly apexTMeasy = new ApexTMeasy();
  private tireForceModel?: TireForceModel;
  private compiledTireRuntime?: ApexCompiledTireRuntime;
  private readonly inputFilter = new ApexInputFilter();
  private readonly assists = new ApexAssists();
  private readonly torqueDistributor?: ApexTorqueDistributor;
  private readonly baselineAerodynamics?: ApexAerodynamics;
  private readonly fastAerodynamics?: ApexAerodynamics;
  private readonly surfaceByBodyId = new Map<number, SurfaceId>();
  private readonly staticWorldPort: ApexJoltStaticWorldAdapter;
  private readonly wheelSurfaces: SurfaceId[] = ['asphalt', 'asphalt', 'asphalt', 'asphalt'];
  private readonly tireLongitudinalCapacityN = [0, 0, 0, 0];
  private readonly tireLateralCapacityN = [0, 0, 0, 0];
  private readonly tireAligningMomentNm = [0, 0, 0, 0];
  private readonly tireLongitudinalForceN = [0, 0, 0, 0];
  private readonly tireLateralForceN = [0, 0, 0, 0];
  private readonly tireLongitudinalSlipVelocityMps = [0, 0, 0, 0];
  private readonly tireLateralSlipVelocityMps = [0, 0, 0, 0];
  private readonly tireLongitudinalPowerLossW = [0, 0, 0, 0];
  private readonly tireLateralPowerLossW = [0, 0, 0, 0];
  private readonly tireLongitudinalEnergyLossJ = [0, 0, 0, 0];
  private readonly tireLateralEnergyLossJ = [0, 0, 0, 0];
  private physicsHz = PHYSICS_HZ;
  private configuredTireContactCount = DEFAULT_TIRE_CONTACT_COUNT;
  private evaluatedTireContactCount = 0;
  private currentStepTireContactCount = 0;
  private currentStepTireContactWheelMask = 0;
  private tireForwardSpeedMps = 0;
  private readonly aeroForce: any;
  private readonly frontAeroPoint: any;
  private readonly rearAeroPoint: any;
  private ninePointRay?: any;
  private ninePointRaySettings?: any;
  private ninePointRayCollector?: any;
  private ninePointBroadPhaseFilter?: any;
  private ninePointObjectLayerFilter?: any;
  private ninePointBodyFilter?: any;
  private ninePointShapeFilter?: any;
  private readonly ninePointImpulse: any;
  private readonly ninePointImpulsePosition: any;
  private readonly ninePointHits: ApexNinePointHit[][] = Array.from(
    { length: 4 },
    () => Array.from({ length: PHYSICAL_CONTACTS_PER_WHEEL }, () => ({
      hit: false,
      weight: 0,
      x: 0,
      y: 0,
      z: 0,
      forwardX: 0,
      forwardY: 0,
      forwardZ: 1,
      lateralX: 1,
      lateralY: 0,
      lateralZ: 0,
      longitudinalVelocityMps: 0,
      lateralVelocityMps: 0,
      surface: 'asphalt' as SurfaceId,
    })),
  );
  private tireCallback?: any;
  private requestedEngineTorqueNm = 0;
  private deliveredEngineTorqueNm = 0;
  private deliveredAxleTorqueNm: readonly [number, number] = Object.freeze([0, 0]);
  private deliveredWheelTorqueNm: readonly [number, number, number, number] = Object.freeze([
    0,
    0,
    0,
    0,
  ]);
  private aerodynamicDragN = 0;
  private aerodynamicDownforceN: readonly [number, number] = Object.freeze([0, 0]);
  private previousAeroThrottle = 0;
  private liftOffFrontAeroBlend = 0;
  private liftOffFrontDownforceN = 0;
  private lateralGripMultiplier = 1;
  private aerodynamicDownforceMultiplier = 1;
  private launchBoostElapsedS = 0;
  private launchBoostArmed = true;
  private currentSteeringInput = 0;
  private tireModel: TireModelId = 'apex-tmeasy-v1';
  private tireExecutionPreference: ApexTireExecutionPreference = 'auto';
  private tireOperatingParameters: TireOperatingParameters;
  private surfaceMode: SurfaceMode = 'track';
  private handlingStage: ApexHandlingStage = 'legacy';

  static create(
    J: any,
    definition: ApexVehicleDefinition,
    initialSpawn?: ApexVehicleSpawn,
  ): ApexVehicleSimulation {
    return new ApexVehicleSimulation(J, definition, initialSpawn);
  }

  private constructor(
    J: any,
    definition: ApexVehicleDefinition,
    initialSpawn: ApexVehicleSpawn | undefined,
  ) {
    this.J = J;
    this.initialSpawn = initialSpawn;
    this.vehicleKind = definition.kind;
    this.carPhysicsDefinition = definition.kind === 'car' ? definition : undefined;
    this.motorcyclePhysicsDefinition = definition.kind === 'motorcycle'
      ? definition
      : undefined;
    this.wheelCount = definition.kind === 'motorcycle' ? 2 : 4;
    this.wheelRadiusM = definition.dimensions.wheelRadiusM;
    this.tireOperatingParameters = definition.kind === 'car'
      ? Object.freeze({
        ...DEFAULT_TIRE_OPERATING_PARAMETERS,
        pressurePsi: definition.defaultTirePressurePsi,
      })
      : DEFAULT_TIRE_OPERATING_PARAMETERS;
    if (definition.kind === 'car') {
      this.torqueDistributor = new ApexTorqueDistributor(
        definition.drivetrain.torqueControl,
      );
      this.baselineAerodynamics = new ApexAerodynamics(
        definition.aerodynamics.baseline,
      );
      this.fastAerodynamics = new ApexAerodynamics(
        definition.aerodynamics.fast,
      );
    }

    const settings = new J.JoltSettings();
    settings.mMaxWorkerThreads = 0;

    const objectFilter = new J.ObjectLayerPairFilterTable(2);
    objectFilter.EnableCollision(STATIC_LAYER, MOVING_LAYER);
    objectFilter.EnableCollision(MOVING_LAYER, MOVING_LAYER);

    const staticBroadPhase = new J.BroadPhaseLayer(0);
    const movingBroadPhase = new J.BroadPhaseLayer(1);
    const broadPhaseInterface = new J.BroadPhaseLayerInterfaceTable(2, 2);
    broadPhaseInterface.MapObjectToBroadPhaseLayer(STATIC_LAYER, staticBroadPhase);
    broadPhaseInterface.MapObjectToBroadPhaseLayer(MOVING_LAYER, movingBroadPhase);

    settings.mObjectLayerPairFilter = objectFilter;
    settings.mBroadPhaseLayerInterface = broadPhaseInterface;
    settings.mObjectVsBroadPhaseLayerFilter = new J.ObjectVsBroadPhaseLayerFilterTable(
      broadPhaseInterface,
      2,
      objectFilter,
      2,
    );

    this.jolt = new J.JoltInterface(settings);
    J.destroy(settings);
    const physicsSystem = this.jolt.GetPhysicsSystem();
    this.physicsSystem = physicsSystem;
    this.bodyInterface = physicsSystem.GetBodyInterface();
    this.staticWorldPort = new ApexJoltStaticWorldAdapter(
      J,
      this.bodyInterface,
      this.surfaceRegistry,
      this.surfaceByBodyId,
      STATIC_LAYER,
    );

    const vehicle = definition.kind === 'motorcycle'
      ? this.createMotorcycle(physicsSystem)
      : this.createVehicle(physicsSystem);
    this.carBody = vehicle.body;
    this.constraint = vehicle.constraint;
    this.controller = vehicle.controller;
    const differentials = this.controller.GetDifferentials();
    this.frontDifferential = definition.kind === 'car' ? differentials.at(0) : undefined;
    this.rearDifferential = definition.kind === 'car' ? differentials.at(1) : undefined;
    this.wheelSettings = Object.freeze(Array.from({ length: this.wheelCount }, (_, index) => (
      this.J.castObject(this.constraint.GetWheel(index), this.J.WheelWV).GetSettings()
    )));
    const antiRollBars = this.constraint.GetAntiRollBars();
    this.frontAntiRollBar = definition.kind === 'car' ? antiRollBars.at(0) : undefined;
    this.rearAntiRollBar = definition.kind === 'car' ? antiRollBars.at(1) : undefined;
    this.stepListener = vehicle.stepListener;
    this.wheelRight = new J.Vec3(0, 1, 0);
    this.wheelUp = new J.Vec3(1, 0, 0);
    this.aeroForce = new J.Vec3();
    this.frontAeroPoint = new J.RVec3();
    this.rearAeroPoint = new J.RVec3();
    this.ninePointImpulse = new J.Vec3();
    this.ninePointImpulsePosition = new J.RVec3();
    for (let index = 0; index < this.wheelCount; index += 1) {
      this.previousSuspensionLengths[index] = this.constraint.GetWheel(index).GetSuspensionLength();
    }
    this.installTireModelCallback();
    if (definition.kind === 'car') {
      this.initializeNinePointTireContact();
      this.setTireModel(definition.defaultTireModel);
    }
    else this.setTireModel(definition.defaultTireModel);
  }

  setTireModel(model: TireModelId): void {
    if (
      this.vehicleKind === 'motorcycle'
      && model === TMEASY_NINE_POINT_MODEL
    ) {
      throw new Error(
        'El contacto TMeasy de nueve puntos todavía es exclusivo del automóvil',
      );
    }
    this.tireModel = model;
    // V1.2 es un setup completo: neumático + TC selectivo + AWD/LSD.
    // Los modelos anteriores conservan exactamente el stage legacy.
    const forceModel = model === 'apex-brush-v1'
      ? this.apexBrush
      : model === 'apex-tmeasy-v1' || model === TMEASY_NINE_POINT_MODEL
        ? this.apexTMeasy
        : undefined;
    this.tireForceModel = forceModel;
    this.tireForceModel?.configureOperatingParameters(this.tireOperatingParameters);
    this.tireForceModel?.reset();
    this.applyTireExecutionBackend();
    this.handlingStage = forceModel
      ? 'legacy'
      : model === 'apex-v1.2' ? 'tire-v1.2' : 'legacy';
    this.applyDifferentialSetup();
    this.applySuspensionSetup();
  }

  setTireExecutionPreference(preference: ApexTireExecutionPreference): void {
    this.tireExecutionPreference = preference;
    this.applyTireExecutionBackend();
  }

  private applyTireExecutionBackend(): void {
    if (
      this.tireExecutionPreference === 'auto'
      && this.tireForceModel
      && this.compiledTireRuntime?.supports(this.tireModel)
    ) {
      this.compiledTireRuntime.activate(this.tireModel);
      return;
    }
    this.compiledTireRuntime?.deactivate();
    this.tireCallback?.SetWheeledVehicleController(this.controller);
  }

  setHandlingStage(stage: ApexHandlingStage): void {
    if (this.vehicleKind === 'motorcycle') return;
    this.handlingStage = stage;
    this.applyDifferentialSetup();
    this.applySuspensionSetup();
  }

  setTireOperatingParameters(parameters: Partial<TireOperatingParameters>): void {
    this.tireOperatingParameters = normalizeTireOperatingParameters(
      this.tireOperatingParameters,
      parameters,
    );
    this.apexBrush.configureOperatingParameters(this.tireOperatingParameters);
    this.apexTMeasy.configureOperatingParameters(this.tireOperatingParameters);
    this.tireForceModel?.reset();
    this.configureCompiledTireRuntime();
  }

  configureDynamicsProfile(profile: ApexVehicleDynamicsProfile): void {
    const aerodynamics = this.carPhysicsDefinition?.aerodynamics;
    this.lateralGripMultiplier = clamp(
      profile.lateralGripMultiplier
        * (aerodynamics?.dynamicsLateralGripCalibration ?? 1),
      0.85,
      1.35,
    );
    this.aerodynamicDownforceMultiplier = clamp(
      profile.aerodynamicDownforceMultiplier
        * (aerodynamics?.dynamicsDownforceCalibration ?? 1),
      0.9,
      1.75,
    );
    this.tireForceModel?.reset();
    this.configureCompiledTireRuntime();
  }

  resetTireEnergyDissipation(): void {
    this.tireLongitudinalEnergyLossJ.fill(0);
    this.tireLateralEnergyLossJ.fill(0);
  }

  private applyDifferentialSetup(): void {
    if (!this.frontDifferential || !this.rearDifferential) return;
    const drivetrain = this.carPhysicsDefinition!.drivetrain;
    const lowSlipTMeasy = (
      this.tireModel === 'apex-tmeasy-v1'
      || this.tireModel === TMEASY_NINE_POINT_MODEL
    )
      && this.handlingStage === 'legacy';
    const tuned = lowSlipTMeasy
      || this.handlingStage === 'differentials'
      || this.handlingStage === 'tire-v1.2'
      || this.handlingStage === 'steering'
      || this.handlingStage === 'suspension'
      || this.handlingStage === 'aero';
    this.frontDifferential.mLimitedSlipRatio = tuned
      ? drivetrain.tunedFrontLimitedSlipRatio
      : drivetrain.baselineFrontLimitedSlipRatio;
    this.rearDifferential.mLimitedSlipRatio = tuned
      ? drivetrain.tunedRearLimitedSlipRatio
      : drivetrain.baselineRearLimitedSlipRatio;
    this.controller.SetDifferentialLimitedSlipRatio(
      tuned
        ? drivetrain.tunedCenterLimitedSlipRatio
        : drivetrain.baselineCenterLimitedSlipRatio,
    );
  }

  private applySuspensionSetup(): void {
    if (this.vehicleKind === 'motorcycle') return;
    const tuned = (
      this.handlingStage === 'suspension'
      || this.handlingStage === 'steering'
      || this.tireModel === 'apex-tmeasy-v1'
    );
    const suspension = this.carPhysicsDefinition!.suspension;
    const setup = tuned ? suspension.tuned : suspension.baseline;
    for (let index = 0; index < this.wheelCount; index += 1) {
      const spring = this.wheelSettings[index].mSuspensionSpring;
      const axle = index < 2 ? setup.front : setup.rear;
      spring.mFrequency = axle.springFrequencyHz;
      spring.mDamping = axle.damping;
    }
    if (this.frontAntiRollBar) {
      this.frontAntiRollBar.mStiffness = setup.front.antiRollStiffness;
    }
    if (this.rearAntiRollBar) {
      this.rearAntiRollBar.mStiffness = setup.rear.antiRollStiffness;
    }
  }

  setActiveSurface(surface: SurfaceMode): void {
    if (surface !== 'track') this.surfaceRegistry.get(surface);
    this.surfaceMode = surface;
  }

  placeAtSpawn(spawn: ApexVehicleSpawn): void {
    const up = new this.J.Vec3(0, 1, 0);
    const position = new this.J.RVec3(
      spawn.x,
      spawn.y,
      spawn.z,
    );
    const rotation = this.J.Quat.prototype.sRotation(
      up,
      spawn.yawDegrees * DEGREES_TO_RADIANS,
    );
    const zeroVelocity = new this.J.Vec3(0, 0, 0);
    this.bodyInterface.SetPositionAndRotation(
      this.carBody.GetID(),
      position,
      rotation,
      this.J.EActivation_Activate,
    );
    this.bodyInterface.SetLinearVelocity(
      this.carBody.GetID(),
      zeroVelocity,
    );
    this.bodyInterface.SetAngularVelocity(
      this.carBody.GetID(),
      zeroVelocity,
    );
    this.controller.SetDriverInput(0, 0, 1, 0);
    this.currentSteeringInput = 0;
    this.previousAeroThrottle = 0;
    this.launchBoostElapsedS = 0;
    this.launchBoostArmed = true;
    this.resetTireEnergyDissipation();
    this.tireForceModel?.reset();
    for (let index = 0; index < this.wheelCount; index += 1) {
      this.previousSuspensionLengths[index] = (
        this.constraint.GetWheel(index).GetSuspensionLength()
      );
      this.suspensionVelocities[index] = 0;
    }
    this.J.destroy(zeroVelocity);
    this.J.destroy(rotation);
    this.J.destroy(position);
    this.J.destroy(up);
  }

  captureTrainingSnapshot(): ApexVehicleTrainingSnapshot {
    const position = this.carBody.GetPosition();
    const rotation = this.carBody.GetRotation();
    const linearVelocity = this.carBody.GetLinearVelocity();
    const angularVelocity = this.carBody.GetAngularVelocity();
    return Object.freeze({
      position: Object.freeze([
        position.GetX(),
        position.GetY(),
        position.GetZ(),
      ]) as readonly [number, number, number],
      rotation: Object.freeze([
        rotation.GetX(),
        rotation.GetY(),
        rotation.GetZ(),
        rotation.GetW(),
      ]) as readonly [number, number, number, number],
      linearVelocity: Object.freeze([
        linearVelocity.GetX(),
        linearVelocity.GetY(),
        linearVelocity.GetZ(),
      ]) as readonly [number, number, number],
      angularVelocity: Object.freeze([
        angularVelocity.GetX(),
        angularVelocity.GetY(),
        angularVelocity.GetZ(),
      ]) as readonly [number, number, number],
    });
  }

  restoreTrainingSnapshot(snapshot: ApexVehicleTrainingSnapshot): void {
    const position = new this.J.RVec3(...snapshot.position);
    const rotation = new this.J.Quat(...snapshot.rotation);
    const linearVelocity = new this.J.Vec3(...snapshot.linearVelocity);
    const angularVelocity = new this.J.Vec3(...snapshot.angularVelocity);
    this.bodyInterface.SetPositionAndRotation(
      this.carBody.GetID(),
      position,
      rotation,
      this.J.EActivation_Activate,
    );
    this.bodyInterface.SetLinearVelocity(
      this.carBody.GetID(),
      linearVelocity,
    );
    this.bodyInterface.SetAngularVelocity(
      this.carBody.GetID(),
      angularVelocity,
    );
    this.controller.SetDriverInput(0, 0, 0, 0);
    this.currentSteeringInput = 0;
    this.previousAeroThrottle = 0;
    this.tireForceModel?.reset();
    for (let index = 0; index < this.wheelCount; index += 1) {
      this.previousSuspensionLengths[index] = (
        this.constraint.GetWheel(index).GetSuspensionLength()
      );
      this.suspensionVelocities[index] = 0;
    }
    this.J.destroy(angularVelocity);
    this.J.destroy(linearVelocity);
    this.J.destroy(rotation);
    this.J.destroy(position);
  }

  configureTireContactEvaluation(contactCount: number, physicsHz: number): void {
    if (
      !Number.isInteger(contactCount)
      || contactCount < this.wheelCount
      || contactCount % this.wheelCount !== 0
    ) {
      throw new Error(
        `Tire contact count must be a multiple of ${this.wheelCount}`,
      );
    }
    if (!Number.isFinite(physicsHz) || physicsHz < 30 || physicsHz > 1000) {
      throw new Error('Physics frequency must be between 30 Hz and 1000 Hz');
    }
    this.configuredTireContactCount = contactCount;
    this.physicsHz = physicsHz;
    this.configureCompiledTireRuntime();
  }

  private resolveWheelSurface(wheelIndex: number): SurfaceId {
    return this.surfaceMode === 'track' ? this.wheelSurfaces[wheelIndex] : this.surfaceMode;
  }

  private configureCompiledTireRuntime(): void {
    if (!this.compiledTireRuntime) return;
    const operatingScales = tireOperatingScales(this.tireOperatingParameters);
    this.compiledTireRuntime.configure(
      this.configuredTireContactCount / this.wheelCount,
      operatingScales.grip,
      operatingScales.stiffness,
      this.lateralGripMultiplier,
    );
  }

  private beginCompiledTireStep(): void {
    if (this.compiledTireRuntime?.backend !== 'wasm') return;
    this.configureCompiledTireRuntime();
    for (let wheelIndex = 0; wheelIndex < this.wheelCount; wheelIndex += 1) {
      this.compiledTireRuntime.setWheelSurface(
        wheelIndex,
        this.surfaceRegistry.get(this.resolveWheelSurface(wheelIndex)),
      );
    }
    this.compiledTireRuntime.beginStep();
  }

  private readCompiledTireTelemetry(): void {
    const evaluatedContactCount = this.compiledTireRuntime?.copyTelemetry(
      this.tireLongitudinalCapacityN,
      this.tireLateralCapacityN,
      this.tireAligningMomentNm,
    );
    if (evaluatedContactCount === undefined) return;
    this.currentStepTireContactCount = evaluatedContactCount;
  }

  private initializeNinePointTireContact(): void {
    if (this.vehicleKind !== 'car') return;
    const J = this.J;
    this.ninePointRay = new J.RRayCast();
    this.ninePointRaySettings = new J.RayCastSettings();
    this.ninePointRayCollector = new J.CastRayClosestHitCollisionCollector();
    this.ninePointBroadPhaseFilter = new J.DefaultBroadPhaseLayerFilter(
      this.jolt.GetObjectVsBroadPhaseLayerFilter(),
      MOVING_LAYER,
    );
    this.ninePointObjectLayerFilter = new J.DefaultObjectLayerFilter(
      this.jolt.GetObjectLayerPairFilter(),
      MOVING_LAYER,
    );
    this.ninePointBodyFilter = new J.IgnoreSingleBodyFilter(
      this.carBody.GetID(),
    );
    this.ninePointShapeFilter = new J.ShapeFilter();
  }

  private applyNinePointTMeasyForces(fixedStep: number): void {
    if (
      this.tireModel !== TMEASY_NINE_POINT_MODEL
      || !this.ninePointRay
      || !this.ninePointRaySettings
      || !this.ninePointRayCollector
    ) return;
    const query = this.physicsSystem.GetNarrowPhaseQuery();
    const carBodyId = this.carBody.GetID();
    const rayLengthM = this.wheelRadiusM + 0.24;
    let evaluatedContactCount = 0;

    for (let wheelIndex = 0; wheelIndex < this.wheelCount; wheelIndex += 1) {
      const wheel = this.J.castObject(
        this.constraint.GetWheel(wheelIndex),
        this.J.WheelWV,
      );
      const transform = this.constraint.GetWheelWorldTransform(
        wheelIndex,
        this.wheelRight,
        this.wheelUp,
      );
      const center = transform.GetTranslation();
      // El transform visual incluye el giro de la llanta. Para que la matriz
      // 3×3 no rote alrededor del eje al avanzar, usamos la base estable que
      // el contacto cilíndrico de Jolt ya resolvió para esa rueda.
      const rawRight = wheel.HasContact()
        ? wheel.GetContactLateral()
        : transform.GetAxisX();
      const rawUp = wheel.HasContact()
        ? wheel.GetContactNormal()
        : this.constraint.GetWorldUp();
      const rawForward = wheel.HasContact()
        ? wheel.GetContactLongitudinal()
        : transform.GetAxisZ();
      const hits = this.ninePointHits[wheelIndex];
      let totalHitWeight = 0;
      let pointIndex = 0;

      for (let longitudinalIndex = 0; longitudinalIndex < 3; longitudinalIndex += 1) {
        for (let lateralIndex = 0; lateralIndex < 3; lateralIndex += 1) {
          const hit = hits[pointIndex];
          const lateralOffsetM = (
            NINE_POINT_LATERAL_FACTORS[lateralIndex]
            * this.carPhysicsDefinition!.dimensions.wheelWidthM
          );
          const longitudinalOffsetM = (
            NINE_POINT_LONGITUDINAL_OFFSETS_M[longitudinalIndex]
          );
          const baseWeight = (
            NINE_POINT_AXIS_WEIGHTS[longitudinalIndex]
            * NINE_POINT_AXIS_WEIGHTS[lateralIndex]
          );
          const originX = center.GetX()
            + rawRight.GetX() * lateralOffsetM
            + rawForward.GetX() * longitudinalOffsetM
            + rawUp.GetX() * 0.08;
          const originY = center.GetY()
            + rawRight.GetY() * lateralOffsetM
            + rawForward.GetY() * longitudinalOffsetM
            + rawUp.GetY() * 0.08;
          const originZ = center.GetZ()
            + rawRight.GetZ() * lateralOffsetM
            + rawForward.GetZ() * longitudinalOffsetM
            + rawUp.GetZ() * 0.08;
          this.ninePointRay.mOrigin.Set(originX, originY, originZ);
          this.ninePointRay.mDirection.Set(
            -rawUp.GetX() * rayLengthM,
            -rawUp.GetY() * rayLengthM,
            -rawUp.GetZ() * rayLengthM,
          );
          this.ninePointRayCollector.Reset();
          query.CastRay(
            this.ninePointRay,
            this.ninePointRaySettings,
            this.ninePointRayCollector,
            this.ninePointBroadPhaseFilter,
            this.ninePointObjectLayerFilter,
            this.ninePointBodyFilter,
            this.ninePointShapeFilter,
          );
          hit.hit = this.ninePointRayCollector.HadHit();
          hit.weight = baseWeight;
          if (!hit.hit) {
            pointIndex += 1;
            continue;
          }
          const result = this.ninePointRayCollector.mHit;
          const body = this.physicsSystem
            .GetBodyLockInterfaceNoLock()
            .TryGetBody(result.mBodyID);
          if (!body) {
            hit.hit = false;
            pointIndex += 1;
            continue;
          }
          const position = this.ninePointRay.GetPointOnRay(result.mFraction);
          const normal = body.GetWorldSpaceSurfaceNormal(
            result.mSubShapeID2,
            position,
          );
          const forwardDotNormal = rawForward.GetX() * normal.GetX()
            + rawForward.GetY() * normal.GetY()
            + rawForward.GetZ() * normal.GetZ();
          let forwardX = rawForward.GetX() - normal.GetX() * forwardDotNormal;
          let forwardY = rawForward.GetY() - normal.GetY() * forwardDotNormal;
          let forwardZ = rawForward.GetZ() - normal.GetZ() * forwardDotNormal;
          const forwardLength = Math.hypot(forwardX, forwardY, forwardZ) || 1;
          forwardX /= forwardLength;
          forwardY /= forwardLength;
          forwardZ /= forwardLength;
          let lateralX = normal.GetY() * forwardZ - normal.GetZ() * forwardY;
          let lateralY = normal.GetZ() * forwardX - normal.GetX() * forwardZ;
          let lateralZ = normal.GetX() * forwardY - normal.GetY() * forwardX;
          const lateralLength = Math.hypot(lateralX, lateralY, lateralZ) || 1;
          lateralX /= lateralLength;
          lateralY /= lateralLength;
          lateralZ /= lateralLength;
          const vehicleVelocity = this.bodyInterface.GetPointVelocity(
            carBodyId,
            position,
          );
          const groundVelocity = this.bodyInterface.GetPointVelocity(
            result.mBodyID,
            position,
          );
          const relativeX = vehicleVelocity.GetX() - groundVelocity.GetX();
          const relativeY = vehicleVelocity.GetY() - groundVelocity.GetY();
          const relativeZ = vehicleVelocity.GetZ() - groundVelocity.GetZ();
          hit.x = position.GetX();
          hit.y = position.GetY();
          hit.z = position.GetZ();
          hit.forwardX = forwardX;
          hit.forwardY = forwardY;
          hit.forwardZ = forwardZ;
          hit.lateralX = lateralX;
          hit.lateralY = lateralY;
          hit.lateralZ = lateralZ;
          hit.longitudinalVelocityMps = (
            relativeX * forwardX + relativeY * forwardY + relativeZ * forwardZ
          );
          hit.lateralVelocityMps = (
            relativeX * lateralX + relativeY * lateralY + relativeZ * lateralZ
          );
          hit.surface = this.surfaceMode === 'track'
            ? this.surfaceByBodyId.get(
                result.mBodyID.GetIndexAndSequenceNumber(),
              ) ?? 'grass'
            : this.surfaceMode;
          totalHitWeight += baseWeight;
          evaluatedContactCount += 1;
          pointIndex += 1;
        }
      }

      const suspensionLoadN = Math.max(
        0,
        wheel.GetSuspensionLambda() / Math.max(1 / 1000, fixedStep),
      );
      let longitudinalForceN = 0;
      let lateralForceN = 0;
      let longitudinalCapacityN = 0;
      let lateralCapacityN = 0;
      let dominantWeight = -1;
      const angularVelocity = wheel.GetAngularVelocity();
      const splitLoadCapacityScale = 1 / Math.max(
        1,
        hits.reduce((sum, hit) => {
          if (!hit.hit || totalHitWeight <= 0) return sum;
          return sum + Math.pow(
            hit.weight / totalHitWeight,
            APEX_TMEASY_SETTINGS.loadSensitivityExponent,
          );
        }, 0),
      );
      for (const hit of hits) {
        if (!hit.hit || totalHitWeight <= 0 || suspensionLoadN <= 1) continue;
        const normalizedWeight = hit.weight / totalHitWeight;
        const verticalLoadN = suspensionLoadN * normalizedWeight;
        const slipRatio = clamp(
          (
            angularVelocity * this.wheelRadiusM
            - hit.longitudinalVelocityMps
          ) / Math.max(2, Math.abs(hit.longitudinalVelocityMps)),
          -3,
          3,
        );
        const slipAngleRadians = clamp(
          Math.atan2(
            hit.lateralVelocityMps,
            Math.max(2, Math.abs(hit.longitudinalVelocityMps)),
          ),
          -Math.PI * 0.45,
          Math.PI * 0.45,
        );
        const forces = this.apexTMeasy.evaluate({
          wheelIndex,
          verticalLoadN,
          slipRatio,
          slipAngleRadians,
          forwardSpeedMps: hit.longitudinalVelocityMps,
          angularVelocityRadPerSecond: angularVelocity,
          wheelRadiusM: this.wheelRadiusM,
          surface: this.surfaceRegistry.get(hit.surface),
          deltaTimeSeconds: fixedStep,
        });
        const pointLongitudinalForceN = (
          forces.longitudinalForceN * splitLoadCapacityScale
        );
        const pointLateralForceN = (
          forces.lateralForceN
          * splitLoadCapacityScale
          * this.lateralGripMultiplier
        );
        // Cada punto aplica su propio impulso. El límite por masa soportada
        // impide que un paso atraviese velocidad relativa cero y convierta
        // la corrección de grip en una oscilación lateral.
        const supportedMassKg = verticalLoadN / STANDARD_GRAVITY_MPS2;
        const longitudinalSlipVelocityMps = (
          angularVelocity * this.wheelRadiusM
          - hit.longitudinalVelocityMps
        );
        const longitudinalImpulseNs = Math.sign(pointLongitudinalForceN) * Math.min(
          Math.abs(pointLongitudinalForceN) * fixedStep,
          supportedMassKg * Math.abs(longitudinalSlipVelocityMps),
        );
        const lateralImpulseNs = Math.sign(pointLateralForceN) * Math.min(
          Math.abs(pointLateralForceN) * fixedStep,
          supportedMassKg * Math.abs(hit.lateralVelocityMps),
        );
        this.ninePointImpulse.Set(
          hit.forwardX * longitudinalImpulseNs
            + hit.lateralX * lateralImpulseNs,
          hit.forwardY * longitudinalImpulseNs
            + hit.lateralY * lateralImpulseNs,
          hit.forwardZ * longitudinalImpulseNs
            + hit.lateralZ * lateralImpulseNs,
        );
        this.ninePointImpulsePosition.Set(hit.x, hit.y, hit.z);
        this.carBody.AddImpulse(
          this.ninePointImpulse,
          this.ninePointImpulsePosition,
        );
        longitudinalForceN += longitudinalImpulseNs / fixedStep;
        lateralForceN += lateralImpulseNs / fixedStep;
        longitudinalCapacityN += (
          forces.longitudinalCapacityN * splitLoadCapacityScale
        );
        lateralCapacityN += (
          forces.lateralCapacityN
          * splitLoadCapacityScale
          * this.lateralGripMultiplier
        );
        if (hit.weight > dominantWeight) {
          dominantWeight = hit.weight;
          this.wheelSurfaces[wheelIndex] = hit.surface;
        }
      }
      const inertia = Math.max(0.1, wheel.GetSettings().mInertia);
      wheel.SetAngularVelocity(clamp(
        angularVelocity
          - longitudinalForceN * this.wheelRadiusM / inertia * fixedStep,
        -450,
        450,
      ));
      this.tireLongitudinalCapacityN[wheelIndex] = longitudinalCapacityN;
      this.tireLateralCapacityN[wheelIndex] = lateralCapacityN;
      this.tireLongitudinalForceN[wheelIndex] = longitudinalForceN;
      this.tireLateralForceN[wheelIndex] = lateralForceN;
      this.tireLongitudinalSlipVelocityMps[wheelIndex] = (
        angularVelocity * this.wheelRadiusM
        - (
          hits.reduce(
            (sum, hit) => sum + (
              hit.hit ? hit.longitudinalVelocityMps * hit.weight : 0
            ),
            0,
          ) / Math.max(1, totalHitWeight)
        )
      );
      this.tireLateralSlipVelocityMps[wheelIndex] = (
        hits.reduce(
          (sum, hit) => sum + (
            hit.hit ? hit.lateralVelocityMps * hit.weight : 0
          ),
          0,
        ) / Math.max(1, totalHitWeight)
      );
      this.tireLongitudinalPowerLossW[wheelIndex] = Math.abs(
        longitudinalForceN * this.tireLongitudinalSlipVelocityMps[wheelIndex],
      );
      this.tireLateralPowerLossW[wheelIndex] = Math.abs(
        lateralForceN * this.tireLateralSlipVelocityMps[wheelIndex],
      );
      this.tireLongitudinalEnergyLossJ[wheelIndex] += (
        this.tireLongitudinalPowerLossW[wheelIndex] * fixedStep
      );
      this.tireLateralEnergyLossJ[wheelIndex] += (
        this.tireLateralPowerLossW[wheelIndex] * fixedStep
      );
    }
    this.currentStepTireContactCount = evaluatedContactCount;
  }

  private installTireModelCallback(): void {
    const J = this.J;
    if (!J.WheeledVehicleControllerCallbacksJS) {
      throw new Error('ApexPhysics build does not expose WheeledVehicleControllerCallbacksJS');
    }
    const callback = new J.WheeledVehicleControllerCallbacksJS();
    callback.OnTireMaxImpulseCallback = (
      wheelIndex: number,
      resultPointer: number,
      suspensionImpulse: number,
      _longitudinalFriction: number,
      _lateralFriction: number,
      longitudinalSlip: number,
      lateralSlip: number,
      deltaTime: number,
    ) => {
      if (!this.tireModel.startsWith('apex-')) return;
      const result = J.wrapPointer(resultPointer, J.TireMaxImpulseCallbackResult);
      if (!result) return;
      const safeDelta = Math.max(deltaTime, 1 / 1000);
      if (this.tireModel === TMEASY_NINE_POINT_MODEL) {
        // La suspensión y las colisiones siguen siendo de Jolt, pero el
        // neumático central no aporta grip: el 100% sale de los 9 puntos.
        result.mLongitudinalImpulse = 0;
        result.mLateralImpulse = 0;
        return;
      }
      if (this.tireForceModel) {
        const wheel = J.castObject(this.constraint.GetWheel(wheelIndex), J.WheelWV);
        const patchesPerJoltContact = (
          this.configuredTireContactCount / this.wheelCount
        );
        const forces: TireForces = evaluateContactPatches(this.tireForceModel, {
          wheelIndex,
          verticalLoadN: Math.max(0, suspensionImpulse / safeDelta),
          slipRatio: longitudinalSlip,
          slipAngleRadians: lateralSlip,
          forwardSpeedMps: this.tireForwardSpeedMps,
          angularVelocityRadPerSecond: wheel.GetAngularVelocity(),
          wheelRadiusM: this.wheelRadiusM,
          surface: this.surfaceRegistry.get(this.resolveWheelSurface(wheelIndex)),
          deltaTimeSeconds: safeDelta,
        }, patchesPerJoltContact);
        const wheelMask = 1 << wheelIndex;
        if ((this.currentStepTireContactWheelMask & wheelMask) === 0) {
          this.currentStepTireContactWheelMask |= wheelMask;
          this.currentStepTireContactCount += patchesPerJoltContact;
        }
        this.tireLongitudinalCapacityN[wheelIndex] = forces.longitudinalCapacityN;
        this.tireLateralCapacityN[wheelIndex] = (
          forces.lateralCapacityN * this.lateralGripMultiplier
        );
        this.tireAligningMomentNm[wheelIndex] = (
          forces.aligningMomentNm * this.lateralGripMultiplier
        );
        result.mLongitudinalImpulse = Math.abs(forces.longitudinalForceN) * safeDelta;
        result.mLateralImpulse = (
          Math.abs(forces.lateralForceN)
          * this.lateralGripMultiplier
          * safeDelta
        );
        return;
      }
      const tireModel = this.tireModel === 'apex-v1.2'
        ? this.apexTireModelV12
        : this.tireModel === 'apex-v1.1' ? this.apexTireModelV11 : this.apexTireModelV1;
      const forces = tireModel.calculate({
        verticalLoad: Math.max(0, suspensionImpulse / safeDelta),
        slipRatio: longitudinalSlip,
        slipAngleRadians: lateralSlip,
        surface: this.surfaceRegistry.get(this.resolveWheelSurface(wheelIndex)),
      });
      result.mLongitudinalImpulse = Math.max(0, forces.longitudinalForceLimit * safeDelta);
      result.mLateralImpulse = Math.max(
        0,
        forces.lateralForceLimit * this.lateralGripMultiplier * safeDelta,
      );
    };
    this.tireCallback = callback;
    this.compiledTireRuntime = ApexCompiledTireRuntime.create(
      J,
      this.controller,
      this.wheelCount,
    );
    callback.SetWheeledVehicleController(this.controller);
  }

  replaceStaticColliderGroup(group: ApexStaticColliderGroup): void {
    this.staticWorldPort.replaceStaticColliderGroup(group);
  }

  removeStaticColliderGroup(ownerId: string): void {
    this.staticWorldPort.removeStaticColliderGroup(ownerId);
  }

  retainStaticColliderGroups(ownerIds: ReadonlySet<string>): void {
    this.staticWorldPort.retainStaticColliderGroups(ownerIds);
  }

  /** Configuración mínima tomada del demo vehicle_motorcycle de Jolt. */
  private createMotorcycle(
    physicsSystem: any,
  ): { body: any; constraint: any; controller: any; stepListener: any } {
    const J = this.J;
    const definition = this.motorcyclePhysicsDefinition!;
    const dimensions = definition.dimensions;
    const halfWidth = definition.chassisBox.widthM / 2;
    const halfHeight = definition.chassisBox.heightM / 2;
    const halfLength = definition.chassisBox.lengthM / 2;
    const shapeSettings = new J.OffsetCenterOfMassShapeSettings(
      new J.Vec3(0, -definition.chassisBox.centerOffsetYM, 0),
      new J.BoxShapeSettings(new J.Vec3(halfWidth, halfHeight, halfLength)),
    );
    const shape = shapeSettings.Create().Get();
    const initialRotation = J.Quat.prototype.sRotation(
      new J.Vec3(0, 1, 0),
      this.initialSpawn
        ? this.initialSpawn.yawDegrees * DEGREES_TO_RADIANS
        : Math.PI,
    );
    const bodySettings = new J.BodyCreationSettings(
      shape,
      new J.RVec3(
        this.initialSpawn?.x ?? 0,
        this.initialSpawn?.y ?? definition.defaultSpawnHeightM,
        this.initialSpawn?.z ?? 0,
      ),
      initialRotation,
      J.EMotionType_Dynamic,
      MOVING_LAYER,
    );
    bodySettings.mMotionQuality = J.EMotionQuality_LinearCast;
    bodySettings.mOverrideMassProperties = J.EOverrideMassProperties_CalculateInertia;
    bodySettings.mMassPropertiesOverride.mMass = definition.massKg;
    const body = this.bodyInterface.CreateBody(bodySettings);
    body.SetFriction(definition.chassisFriction);
    this.bodyInterface.AddBody(body.GetID(), J.EActivation_Activate);
    J.destroy(bodySettings);

    const vehicleSettings = new J.VehicleConstraintSettings();
    vehicleSettings.mMaxPitchRollAngle = (
      definition.maximumPitchRollDegrees * DEGREES_TO_RADIANS
    );
    vehicleSettings.mWheels.clear();

    const casterTangent = Math.tan(
      definition.casterAngleDegrees * DEGREES_TO_RADIANS,
    );
    const front = new J.WheelSettingsWV();
    front.mPosition = new J.Vec3(
      0,
      definition.wheelMountHeightM,
      dimensions.wheelbaseM / 2,
    );
    front.mMaxSteerAngle = (
      definition.maximumSteerAngleDegrees * DEGREES_TO_RADIANS
    );
    front.mSuspensionDirection = new J.Vec3(0, -1, casterTangent).Normalized();
    front.mSteeringAxis = new J.Vec3(0, 1, -casterTangent).Normalized();
    front.mRadius = dimensions.wheelRadiusM;
    front.mWidth = dimensions.wheelWidthM;
    front.mSuspensionMinLength = definition.suspensionMinLengthM;
    front.mSuspensionMaxLength = definition.suspensionMaxLengthM;
    front.mSuspensionSpring.mFrequency = (
      definition.frontSuspensionSpringFrequencyHz
    );
    front.mMaxBrakeTorque = definition.frontBrakeTorqueNm;
    vehicleSettings.mWheels.push_back(front);

    const rear = new J.WheelSettingsWV();
    rear.mPosition = new J.Vec3(
      0,
      definition.wheelMountHeightM,
      -dimensions.wheelbaseM / 2,
    );
    rear.mMaxSteerAngle = 0;
    rear.mRadius = dimensions.wheelRadiusM;
    rear.mWidth = dimensions.wheelWidthM;
    rear.mSuspensionMinLength = definition.suspensionMinLengthM;
    rear.mSuspensionMaxLength = definition.suspensionMaxLengthM;
    rear.mSuspensionSpring.mFrequency = (
      definition.rearSuspensionSpringFrequencyHz
    );
    rear.mMaxBrakeTorque = definition.rearBrakeTorqueNm;
    rear.mMaxHandBrakeTorque = definition.handBrakeTorqueNm;
    vehicleSettings.mWheels.push_back(rear);

    const controllerSettings = new J.MotorcycleControllerSettings();
    controllerSettings.mEngine.mMaxTorque = definition.engine.maximumTorqueNm;
    controllerSettings.mEngine.mMinRPM = definition.engine.minimumRpm;
    controllerSettings.mEngine.mMaxRPM = definition.engine.maximumRpm;
    if (definition.engine.normalizedTorqueCurve.length > 0) {
      controllerSettings.mEngine.mNormalizedTorque.Clear();
      for (const [rpmFraction, torqueFraction] of (
        definition.engine.normalizedTorqueCurve
      )) {
        controllerSettings.mEngine.mNormalizedTorque.AddPoint(
          rpmFraction,
          torqueFraction,
        );
      }
      controllerSettings.mEngine.mNormalizedTorque.Sort();
    }
    controllerSettings.mTransmission.mShiftDownRPM = (
      definition.transmission.shiftDownRpm
    );
    controllerSettings.mTransmission.mShiftUpRPM = (
      definition.transmission.shiftUpRpm
    );
    controllerSettings.mTransmission.mClutchStrength = (
      definition.transmission.clutchStrength
    );
    controllerSettings.mDifferentials.clear();
    const differential = new J.VehicleDifferentialSettings();
    differential.mLeftWheel = -1;
    differential.mRightWheel = 1;
    differential.mDifferentialRatio = definition.rearDifferentialRatio;
    controllerSettings.mDifferentials.push_back(differential);
    vehicleSettings.mController = controllerSettings;

    const constraint = new J.VehicleConstraint(body, vehicleSettings);
    constraint.SetVehicleCollisionTester(
      new J.VehicleCollisionTesterCastCylinder(
        MOVING_LAYER,
        definition.collisionTesterRadiusM,
      ),
    );
    physicsSystem.AddConstraint(constraint);
    const controller = J.castObject(
      constraint.GetController(),
      J.MotorcycleController,
    );
    const stepListener = new J.VehicleConstraintStepListener(constraint);
    physicsSystem.AddStepListener(stepListener);
    return { body, constraint, controller, stepListener };
  }

  private createVehicle(physicsSystem: any): { body: any; constraint: any; controller: any; stepListener: any } {
    const J = this.J;
    const definition = this.carPhysicsDefinition!;
    const dimensions = definition.dimensions;
    const frontChassisWidthM = (
      definition.chassisBox.frontWidthM ?? definition.chassisBox.widthM
    );
    const rearChassisWidthM = (
      definition.chassisBox.rearWidthM ?? definition.chassisBox.widthM
    );
    let innerChassisShapeSettings: any;
    if (Math.abs(frontChassisWidthM - rearChassisWidthM) > 1e-6) {
      const halfFrontWidth = frontChassisWidthM / 2;
      const halfRearWidth = rearChassisWidthM / 2;
      const halfHeight = definition.chassisBox.heightM / 2;
      const halfLength = definition.chassisBox.lengthM / 2;
      const hullSettings = new J.ConvexHullShapeSettings();
      const hullPoint = new J.Vec3();
      const hullPoints = [
        [-halfFrontWidth, -halfHeight, halfLength],
        [halfFrontWidth, -halfHeight, halfLength],
        [-halfFrontWidth, halfHeight, halfLength],
        [halfFrontWidth, halfHeight, halfLength],
        [-halfRearWidth, -halfHeight, -halfLength],
        [halfRearWidth, -halfHeight, -halfLength],
        [-halfRearWidth, halfHeight, -halfLength],
        [halfRearWidth, halfHeight, -halfLength],
      ] as const;
      for (const point of hullPoints) {
        hullPoint.Set(...point);
        hullSettings.mPoints.push_back(hullPoint);
      }
      hullSettings.mMaxConvexRadius = 0.015;
      J.destroy(hullPoint);
      innerChassisShapeSettings = hullSettings;
    } else {
      innerChassisShapeSettings = new J.BoxShapeSettings(
        new J.Vec3(
          definition.chassisBox.widthM / 2,
          definition.chassisBox.heightM / 2,
          definition.chassisBox.lengthM / 2,
        ),
      );
    }
    const chassisShapeSettings = new J.OffsetCenterOfMassShapeSettings(
      new J.Vec3(0, -definition.chassisBox.centerOffsetYM, 0),
      innerChassisShapeSettings,
    );
    const chassisShape = chassisShapeSettings.Create().Get();
    const initialRotation = J.Quat.prototype.sRotation(
      new J.Vec3(0, 1, 0),
      this.initialSpawn
        ? this.initialSpawn.yawDegrees * DEGREES_TO_RADIANS
        : Math.PI,
    );
    const bodySettings = new J.BodyCreationSettings(
      chassisShape,
      new J.RVec3(
        this.initialSpawn?.x ?? 0,
        this.initialSpawn?.y ?? definition.defaultSpawnHeightM,
        this.initialSpawn?.z ?? 0,
      ),
      initialRotation,
      J.EMotionType_Dynamic,
      MOVING_LAYER,
    );
    bodySettings.mMotionQuality = J.EMotionQuality_LinearCast;
    bodySettings.mOverrideMassProperties = J.EOverrideMassProperties_CalculateInertia;
    bodySettings.mMassPropertiesOverride.mMass = definition.massKg;

    const body = this.bodyInterface.CreateBody(bodySettings);
    body.SetFriction(definition.chassisFriction);
    this.bodyInterface.AddBody(body.GetID(), J.EActivation_Activate);
    J.destroy(bodySettings);

    const vehicleSettings = new J.VehicleConstraintSettings();
    // Límite amplio de seguridad para impedir que el chasis acumule vuelcos
    // extremos fuera de pista.
    vehicleSettings.mMaxPitchRollAngle = (
      definition.maximumPitchRollDegrees * DEGREES_TO_RADIANS
    );
    vehicleSettings.mWheels.clear();

    const halfWheelbase = dimensions.wheelbaseM / 2;
    const halfFrontTrack = dimensions.frontTrackM / 2;
    const halfRearTrack = dimensions.rearTrackM / 2;
    const frontAxleZ = dimensions.axleCenterOffsetM + halfWheelbase;
    const rearAxleZ = dimensions.axleCenterOffsetM - halfWheelbase;
    const addWheel = (
      x: number,
      z: number,
      steerable: boolean,
      handbrake: boolean,
    ) => {
      const wheel = new J.WheelSettingsWV();
      wheel.mPosition = new J.Vec3(
        x,
        definition.suspension.wheelMountHeightM,
        z,
      );
      wheel.mRadius = dimensions.wheelRadiusM;
      wheel.mWidth = dimensions.wheelWidthM;
      wheel.mInertia = definition.wheels.inertiaKgM2;
      wheel.mAngularDamping = definition.wheels.angularDamping;
      wheel.mSuspensionMinLength = definition.suspension.minimumLengthM;
      wheel.mSuspensionMaxLength = definition.suspension.maximumLengthM;
      wheel.mMaxSteerAngle = steerable
        ? definition.wheels.maximumSteerAngleDegrees * DEGREES_TO_RADIANS
        : 0;
      // Menos mordida inicial para evitar bloquear y disparar slip ratio.
      // Se conserva el bias delantero necesario para estabilidad en frenada.
      wheel.mMaxBrakeTorque = steerable
        ? definition.wheels.frontBrakeTorqueNm
        : definition.wheels.rearBrakeTorqueNm;
      wheel.mMaxHandBrakeTorque = handbrake
        ? definition.wheels.handBrakeTorqueNm
        : 0;
      vehicleSettings.mWheels.push_back(wheel);
    };

    addWheel(halfFrontTrack, frontAxleZ, true, false);
    addWheel(-halfFrontTrack, frontAxleZ, true, false);
    addWheel(halfRearTrack, rearAxleZ, false, true);
    addWheel(-halfRearTrack, rearAxleZ, false, true);

    const controllerSettings = new J.WheeledVehicleControllerSettings();
    // La curva normalizada forma parte de la definición concreta del vehículo.
    controllerSettings.mEngine.mMaxTorque = definition.engine.maximumTorqueNm;
    controllerSettings.mEngine.mMinRPM = definition.engine.minimumRpm;
    controllerSettings.mEngine.mMaxRPM = definition.engine.maximumRpm;
    controllerSettings.mEngine.mNormalizedTorque.Clear();
    for (const [rpmFraction, torqueFraction] of (
      definition.engine.normalizedTorqueCurve
    )) {
      controllerSettings.mEngine.mNormalizedTorque.AddPoint(
        rpmFraction,
        torqueFraction,
      );
    }
    controllerSettings.mEngine.mNormalizedTorque.Sort();
    controllerSettings.mTransmission.mShiftDownRPM = (
      definition.transmission.shiftDownRpm
    );
    controllerSettings.mTransmission.mShiftUpRPM = (
      definition.transmission.shiftUpRpm
    );
    controllerSettings.mTransmission.mClutchStrength = (
      definition.transmission.clutchStrength
    );
    controllerSettings.mDifferentials.clear();

    const frontDifferential = new J.VehicleDifferentialSettings();
    frontDifferential.mLeftWheel = 0;
    frontDifferential.mRightWheel = 1;
    frontDifferential.mEngineTorqueRatio = definition.drivetrain.frontTorqueRatio;
    frontDifferential.mLimitedSlipRatio = (
      definition.drivetrain.baselineFrontLimitedSlipRatio
    );
    controllerSettings.mDifferentials.push_back(frontDifferential);

    const rearDifferential = new J.VehicleDifferentialSettings();
    rearDifferential.mLeftWheel = 2;
    rearDifferential.mRightWheel = 3;
    rearDifferential.mEngineTorqueRatio = definition.drivetrain.rearTorqueRatio;
    rearDifferential.mLimitedSlipRatio = (
      definition.drivetrain.baselineRearLimitedSlipRatio
    );
    controllerSettings.mDifferentials.push_back(rearDifferential);
    controllerSettings.mDifferentialLimitedSlipRatio = (
      definition.drivetrain.baselineCenterLimitedSlipRatio
    );
    vehicleSettings.mController = controllerSettings;

    vehicleSettings.mAntiRollBars.clear();
    for (const [left, right] of [[0, 1], [2, 3]]) {
      const antiRollBar = new J.VehicleAntiRollBar();
      antiRollBar.mLeftWheel = left;
      antiRollBar.mRightWheel = right;
      vehicleSettings.mAntiRollBars.push_back(antiRollBar);
    }

    const constraint = new J.VehicleConstraint(body, vehicleSettings);
    constraint.SetVehicleCollisionTester(
      new J.VehicleCollisionTesterCastCylinder(
        MOVING_LAYER,
        definition.collisionTesterRadiusM,
      ),
    );
    physicsSystem.AddConstraint(constraint);
    const controller = J.castObject(constraint.GetController(), J.WheeledVehicleController);
    const stepListener = new J.VehicleConstraintStepListener(constraint);
    physicsSystem.AddStepListener(stepListener);
    return { body, constraint, controller, stepListener };
  }

  private readHandlingSample(): ApexHandlingSample {
    const velocity = this.carBody.GetLinearVelocity();
    const angularVelocity = this.carBody.GetAngularVelocity();
    const rotation = this.carBody.GetRotation();
    const worldVelocity: ApexVector3Tuple = [
      velocity.GetX(),
      velocity.GetY(),
      velocity.GetZ(),
    ];
    const bodyRotation: ApexQuaternionTuple = [
      rotation.GetX(),
      rotation.GetY(),
      rotation.GetZ(),
      rotation.GetW(),
    ];
    const localVelocity = inverseRotateVectorByQuaternion(
      worldVelocity,
      bodyRotation,
    );

    return {
      speedMps: Math.hypot(...worldVelocity),
      localForwardSpeedMps: localVelocity[2],
      yawRate: angularVelocity.GetY(),
      wheels: Object.freeze(Array.from({ length: this.wheelCount }, (_, index) => {
        const wheel = this.J.castObject(this.constraint.GetWheel(index), this.J.WheelWV);
        return Object.freeze({
          grounded: wheel.HasContact(),
          longitudinalSlip: wheel.get_mLongitudinalSlip(),
          lateralSlipRadians: wheel.get_mLateralSlip(),
        });
      })),
    };
  }

  private updateLiftOffFrontAerodynamics(
    throttle: number,
    speedMps: number,
    fixedStep: number,
  ): number {
    const throttleDropRate = Math.max(
      0,
      (this.previousAeroThrottle - throttle) / Math.max(fixedStep, 1e-6),
    );
    this.previousAeroThrottle = throttle;
    const speedActivation = clamp((Math.abs(speedMps) - 6) / 8, 0, 1);
    const target = clamp(throttleDropRate / 4, 0, 1)
      * speedActivation;
    // Aproximadamente 0,22 s de entrada y 0,55 s de liberación completa.
    const responseRate = target > this.liftOffFrontAeroBlend
      ? 1 / 0.22
      : 1 / 0.55;
    this.liftOffFrontAeroBlend += clamp(
      target - this.liftOffFrontAeroBlend,
      -responseRate * fixedStep,
      responseRate * fixedStep,
    );
    return this.liftOffFrontAeroBlend;
  }

  private updateLaunchTorqueBoost(
    throttle: number,
    speedMps: number,
    fixedStep: number,
  ): void {
    const definition = this.carPhysicsDefinition!;
    if (throttle < 0.05) {
      this.launchBoostArmed = true;
      this.launchBoostElapsedS = 0;
    } else if (
      this.launchBoostArmed
      && throttle > 0.35
      && Math.abs(speedMps) < 2.5
    ) {
      this.launchBoostArmed = false;
      this.launchBoostElapsedS = fixedStep;
    } else if (this.launchBoostElapsedS > 0) {
      this.launchBoostElapsedS += fixedStep;
    }

    const progress = clamp(
      this.launchBoostElapsedS / definition.launch.boostDurationSeconds,
      0,
      1,
    );
    const smoothPulse = progress > 0 && progress < 1
      ? Math.sin(Math.PI * progress)
      : 0;
    // El pulso se desvanece antes de 45 km/h: ayuda a despegar, pero no
    // reaparece en curvas lentas ni altera la entrega del motor en alta.
    const speedFade = clamp(
      (12.5 - Math.abs(speedMps)) / 5.5,
      0,
      1,
    );
    this.controller.GetEngine().mMaxTorque = definition.engine.maximumTorqueNm
      * (1 + definition.launch.maximumBoostRatio * smoothPulse * speedFade);

    if (progress >= 1) this.launchBoostElapsedS = 0;
  }

  private applyAerodynamics(liftOffFrontBlend: number): void {
    const velocity = this.carBody.GetLinearVelocity();
    const aerodynamics = this.handlingStage === 'aero'
      ? this.fastAerodynamics
      : this.baselineAerodynamics;
    const forces = aerodynamics!.calculate(
      velocity.GetX(),
      velocity.GetY(),
      velocity.GetZ(),
      liftOffFrontBlend,
    );
    this.aerodynamicDragN = Math.hypot(forces.dragX, forces.dragY, forces.dragZ);
    const frontDownforce = (
      forces.frontDownforce * this.aerodynamicDownforceMultiplier
    );
    const rearDownforce = (
      forces.rearDownforce * this.aerodynamicDownforceMultiplier
    );
    const liftOffFrontDownforce = (
      forces.liftOffFrontDownforce * this.aerodynamicDownforceMultiplier
    );
    this.liftOffFrontDownforceN = liftOffFrontDownforce;
    this.aerodynamicDownforceN = Object.freeze([
      frontDownforce,
      rearDownforce,
    ]);
    this.aeroForce.Set(forces.dragX, forces.dragY, forces.dragZ);
    this.carBody.AddForce(this.aeroForce);

    const position = this.carBody.GetPosition();
    const rotation = this.carBody.GetRotation();
    const bodyRotation: ApexQuaternionTuple = [
      rotation.GetX(),
      rotation.GetY(),
      rotation.GetZ(),
      rotation.GetW(),
    ];
    const forward = rotateVectorByQuaternion([0, 0, 1], bodyRotation);
    // La carga aerodinámica sigue el eje vertical del auto. En peraltes y en
    // el loop debe empujar hacia la superficie, no siempre hacia -Y global.
    const vehicleDown = rotateVectorByQuaternion([0, -1, 0], bodyRotation);
    const axleOffset = this.carPhysicsDefinition!.dimensions.wheelbaseM / 2;
    this.frontAeroPoint.Set(
      position.GetX() + forward[0] * axleOffset,
      position.GetY(),
      position.GetZ() + forward[2] * axleOffset,
    );
    this.rearAeroPoint.Set(
      position.GetX() - forward[0] * axleOffset,
      position.GetY(),
      position.GetZ() - forward[2] * axleOffset,
    );
    this.aeroForce.Set(
      vehicleDown[0] * frontDownforce,
      vehicleDown[1] * frontDownforce,
      vehicleDown[2] * frontDownforce,
    );
    this.carBody.AddForce(this.aeroForce, this.frontAeroPoint);
    this.aeroForce.Set(
      vehicleDown[0] * rearDownforce,
      vehicleDown[1] * rearDownforce,
      vehicleDown[2] * rearDownforce,
    );
    this.carBody.AddForce(this.aeroForce, this.rearAeroPoint);
  }

  private applySteeringGeometry(
    steering: number,
    speedKmh: number,
    yawRateRadiansPerSecond: number,
    directSteering = false,
  ): void {
    const definition = this.carPhysicsDefinition!;
    const steeringDefinition = definition.steering;
    if (directSteering) {
      const directMaximumAngle = 45 * DEGREES_TO_RADIANS;
      this.wheelSettings[0].mMaxSteerAngle = directMaximumAngle;
      this.wheelSettings[1].mMaxSteerAngle = directMaximumAngle;
      return;
    }
    const lowSlipTMeasy = (
      this.tireModel === 'apex-tmeasy-v1'
      || this.tireModel === TMEASY_NINE_POINT_MODEL
    )
      && this.handlingStage === 'legacy';
    const physicalSteering = lowSlipTMeasy || this.handlingStage === 'steering';
    if (!physicalSteering) {
      const maximumAngle = (
        definition.wheels.maximumSteerAngleDegrees * DEGREES_TO_RADIANS
      );
      this.wheelSettings[0].mMaxSteerAngle = maximumAngle;
      this.wheelSettings[1].mMaxSteerAngle = maximumAngle;
      return;
    }

    const geometry = resolveApexSteeringGeometry({
      steering,
      speedKmh,
      yawRateRadiansPerSecond,
      wheelbaseM: definition.dimensions.wheelbaseM,
      averageTrackM: (
        definition.dimensions.frontTrackM
        + definition.dimensions.rearTrackM
      ) * 0.5,
      blendStartKmh: steeringDefinition.blendStartKmh,
      blendEndKmh: steeringDefinition.blendEndKmh,
      lowSpeedDegrees: lowSlipTMeasy
        ? steeringDefinition.lowSlipLowSpeedDegrees
        : steeringDefinition.baselineLowSpeedDegrees,
      highSpeedDegrees: lowSlipTMeasy
        ? steeringDefinition.lowSlipHighSpeedDegrees
        : steeringDefinition.baselineHighSpeedDegrees,
      mechanicalLimitDegrees: definition.wheels.maximumSteerAngleDegrees,
    });
    this.wheelSettings[0].mMaxSteerAngle = geometry.frontLeftMaximumRadians;
    this.wheelSettings[1].mMaxSteerAngle = geometry.frontRightMaximumRadians;
  }

  private updateWheelStateAfterStep(): void {
    const fixedStep = 1 / this.physicsHz;
    for (let index = 0; index < this.wheelCount; index += 1) {
      const wheel = this.J.castObject(this.constraint.GetWheel(index), this.J.WheelWV);
      const length = wheel.GetSuspensionLength();
      this.suspensionVelocities[index] = (
        length - this.previousSuspensionLengths[index]
      ) / fixedStep;
      this.previousSuspensionLengths[index] = length;
      if (this.tireModel === TMEASY_NINE_POINT_MODEL) {
        continue;
      }
      if (!wheel.HasContact()) {
        this.tireLongitudinalForceN[index] = 0;
        this.tireLateralForceN[index] = 0;
        this.tireLongitudinalSlipVelocityMps[index] = 0;
        this.tireLateralSlipVelocityMps[index] = 0;
        this.tireLongitudinalPowerLossW[index] = 0;
        this.tireLateralPowerLossW[index] = 0;
        continue;
      }
      const contactPosition = wheel.GetContactPosition();
      const groundVelocity = wheel.GetContactPointVelocity();
      const vehicleVelocity = this.bodyInterface.GetPointVelocity(
        this.carBody.GetID(),
        contactPosition,
      );
      const longitudinal = wheel.GetContactLongitudinal();
      const lateral = wheel.GetContactLateral();
      const relativeVelocityX = vehicleVelocity.GetX() - groundVelocity.GetX();
      const relativeVelocityY = vehicleVelocity.GetY() - groundVelocity.GetY();
      const relativeVelocityZ = vehicleVelocity.GetZ() - groundVelocity.GetZ();
      const longitudinalVelocity = relativeVelocityX * longitudinal.GetX()
        + relativeVelocityY * longitudinal.GetY()
        + relativeVelocityZ * longitudinal.GetZ();
      const lateralVelocity = relativeVelocityX * lateral.GetX()
        + relativeVelocityY * lateral.GetY()
        + relativeVelocityZ * lateral.GetZ();
      const longitudinalSlipVelocity = wheel.GetAngularVelocity()
        * this.wheelRadiusM
        - longitudinalVelocity;
      const longitudinalForceN = wheel.GetLongitudinalLambda() / fixedStep;
      const lateralForceN = wheel.GetLateralLambda() / fixedStep;
      const longitudinalPowerLossW = Math.abs(
        longitudinalForceN * longitudinalSlipVelocity,
      );
      const lateralPowerLossW = Math.abs(lateralForceN * lateralVelocity);
      this.tireLongitudinalForceN[index] = longitudinalForceN;
      this.tireLateralForceN[index] = lateralForceN;
      this.tireLongitudinalSlipVelocityMps[index] = longitudinalSlipVelocity;
      this.tireLateralSlipVelocityMps[index] = lateralVelocity;
      this.tireLongitudinalPowerLossW[index] = longitudinalPowerLossW;
      this.tireLateralPowerLossW[index] = lateralPowerLossW;
      this.tireLongitudinalEnergyLossJ[index] += longitudinalPowerLossW * fixedStep;
      this.tireLateralEnergyLossJ[index] += lateralPowerLossW * fixedStep;
      const bodyId = wheel.GetContactBodyID();
      const surface = this.surfaceByBodyId.get(bodyId.GetIndexAndSequenceNumber());
      if (surface) this.wheelSurfaces[index] = surface;
    }
  }

  private stepMotorcycle(input: DriverInput): void {
    const fixedStep = 1 / this.physicsHz;
    const sample = this.readHandlingSample();
    this.tireForwardSpeedMps = sample.localForwardSpeedMps;
    const filtered = this.inputFilter.update(
      input,
      sample.speedMps * 3.6,
      fixedStep,
      'baseline',
    );
    let direction = filtered.requestedDirection;
    let throttle = filtered.pedal;
    let brake = clamp(input.brake ?? 0, 0, 1);
    if (direction !== 0 && direction * sample.localForwardSpeedMps < -0.1) {
      direction = 0;
      brake = filtered.pedal;
      throttle = 0;
    }
    const forwardInput = filtered.handbrake > 0.05
      ? 0
      : direction * throttle;
    this.controller.SetDriverInput(
      forwardInput,
      filtered.steering,
      brake,
      filtered.handbrake,
    );
    this.currentSteeringInput = filtered.steering;
    const requestedTorque = this.controller.GetEngine().GetTorque(Math.abs(throttle));
    this.requestedEngineTorqueNm = requestedTorque;
    this.deliveredEngineTorqueNm = requestedTorque;
    this.deliveredAxleTorqueNm = Object.freeze([0, requestedTorque]);
    this.deliveredWheelTorqueNm = Object.freeze([0, requestedTorque, 0, 0]);
    this.aerodynamicDragN = 0;
    this.aerodynamicDownforceN = Object.freeze([0, 0]);
    this.liftOffFrontAeroBlend = 0;
    this.liftOffFrontDownforceN = 0;
    if (forwardInput || filtered.steering || brake || filtered.handbrake) {
      this.bodyInterface.ActivateBody(this.carBody.GetID());
    }
    this.currentStepTireContactCount = 0;
    this.currentStepTireContactWheelMask = 0;
    this.beginCompiledTireStep();
    this.jolt.Step(fixedStep, 1);
    this.readCompiledTireTelemetry();
    this.evaluatedTireContactCount = this.currentStepTireContactCount;
    this.updateWheelStateAfterStep();
  }

  step(input: DriverInput): void {
    if (this.vehicleKind === 'motorcycle') {
      this.stepMotorcycle(input);
      return;
    }
    const fixedStep = 1 / this.physicsHz;
    const sample = this.readHandlingSample();
    this.tireForwardSpeedMps = sample.localForwardSpeedMps;
    const lowSlipTMeasy = (
      this.tireModel === 'apex-tmeasy-v1'
      || this.tireModel === TMEASY_NINE_POINT_MODEL
    )
      && this.handlingStage === 'legacy';
    const physicalSteering = this.handlingStage === 'steering';
    const filtered = this.inputFilter.update(
      input,
      sample.speedMps * 3.6,
      fixedStep,
      lowSlipTMeasy
        ? 'low-slip'
        : physicalSteering ? 'physical-steering' : 'baseline',
    );
    let direction = filtered.requestedDirection;
    let throttle = filtered.pedal;
    let brake = Math.max(0, Math.min(1, input.brake ?? 0));

    // El pedal opuesto primero frena; sólo selecciona reversa cuando casi se detuvo.
    if (direction !== 0 && direction * sample.localForwardSpeedMps < -0.5) {
      direction = 0;
      brake = filtered.pedal;
      throttle = 0;
    }

    const selectiveTorqueControl = lowSlipTMeasy
      || this.handlingStage === 'mechanical-tc'
      || this.handlingStage === 'differentials'
      || this.handlingStage === 'tire-v1.2'
      || this.handlingStage === 'steering'
      || this.handlingStage === 'suspension'
      || this.handlingStage === 'aero';
    const tireOnly = this.handlingStage === 'tire-only';
    const assisted = tireOnly
      ? Object.freeze({
        throttle,
        brake,
        steering: filtered.steering,
        handbrake: filtered.handbrake,
        tractionControl: 0,
        abs: 0,
        stabilityControl: 0,
      })
      : this.assists.update({
        throttle,
        brake,
        steering: filtered.steering,
        handbrake: filtered.handbrake,
      }, sample, fixedStep, this.handlingStage === 'tire-benchmark'
        ? 'tire-benchmark'
        : lowSlipTMeasy ? 'low-slip'
        : selectiveTorqueControl ? 'fast-recovery'
        : this.tireModel === 'apex-v1.1' ? 'circuit-recovery' : 'baseline');
    const commandedSteering = input.directSteering === true
      ? filtered.steering
      : assisted.steering;
    this.updateLaunchTorqueBoost(
      Math.abs(assisted.throttle),
      sample.speedMps,
      fixedStep,
    );
    const requestedEngineTorqueNm = this.controller.GetEngine().GetTorque(
      Math.abs(assisted.throttle),
    );
    const torqueDistribution = this.torqueDistributor!.update(
      sample,
      requestedEngineTorqueNm,
      {
        selectiveWheelControl: selectiveTorqueControl,
        dynamicAxleSplit: lowSlipTMeasy || this.handlingStage !== 'legacy'
          && this.handlingStage !== 'tire-only'
          && this.handlingStage !== 'tire-benchmark',
      },
      fixedStep,
    );
    this.frontDifferential!.mLeftRightSplit = torqueDistribution.frontRightSplit;
    this.rearDifferential!.mLeftRightSplit = torqueDistribution.rearRightSplit;
    this.frontDifferential!.mEngineTorqueRatio = torqueDistribution.frontTorqueRatio;
    this.rearDifferential!.mEngineTorqueRatio = torqueDistribution.rearTorqueRatio;
    this.requestedEngineTorqueNm = torqueDistribution.requestedEngineTorqueNm;
    this.deliveredEngineTorqueNm = torqueDistribution.deliveredEngineTorqueNm;
    this.deliveredAxleTorqueNm = torqueDistribution.deliveredAxleTorqueNm;
    this.deliveredWheelTorqueNm = torqueDistribution.deliveredWheelTorqueNm;
    this.applySteeringGeometry(
      commandedSteering,
      sample.speedMps * 3.6,
      sample.yawRate,
      input.directSteering === true,
    );
    const liftOffFrontBlend = this.updateLiftOffFrontAerodynamics(
      Math.abs(assisted.throttle),
      sample.speedMps,
      fixedStep,
    );

    const forwardInput = filtered.handbrake > 0.05
      ? 0
      : direction * assisted.throttle * torqueDistribution.throttleScale;
    this.controller.SetDriverInput(
      forwardInput,
      commandedSteering,
      assisted.brake,
      assisted.handbrake,
    );
    this.currentSteeringInput = commandedSteering;
    this.applyAerodynamics(liftOffFrontBlend);
    if (forwardInput || commandedSteering || assisted.brake || assisted.handbrake) {
      this.bodyInterface.ActivateBody(this.carBody.GetID());
    }
    this.currentStepTireContactCount = 0;
    this.currentStepTireContactWheelMask = 0;
    this.applyNinePointTMeasyForces(fixedStep);
    this.beginCompiledTireStep();
    this.jolt.Step(fixedStep, 1);
    this.readCompiledTireTelemetry();
    this.evaluatedTireContactCount = this.currentStepTireContactCount;
    this.updateWheelStateAfterStep();
  }

  /**
   * Copia numérica e inmutable del estado actual. No expone cuerpos, controller,
   * ruedas Jolt, punteros ni callbacks hacia la simulación.
   */
  getState(): ApexVehicleState {
    const position = this.carBody.GetPosition();
    const rotation = this.carBody.GetRotation();
    const linearVelocity = this.carBody.GetLinearVelocity();
    const angularVelocity = this.carBody.GetAngularVelocity();
    const engine = this.controller.GetEngine();
    const transmission = this.controller.GetTransmission();
    const clutchFriction = transmission.GetClutchFriction();
    const wheels: ApexWheelState[] = [];

    for (let index = 0; index < this.wheelCount; index += 1) {
      const wheel = this.J.castObject(this.constraint.GetWheel(index), this.J.WheelWV);
      const settings = wheel.GetSettings();
      wheels.push(Object.freeze({
        grounded: wheel.HasContact(),
        longitudinalSlip: wheel.get_mLongitudinalSlip(),
        lateralSlipRadians: wheel.get_mLateralSlip(),
        suspensionImpulse: wheel.GetSuspensionLambda(),
        angularVelocity: wheel.GetAngularVelocity(),
        suspensionLength: wheel.GetSuspensionLength(),
        suspensionMaxLength: settings.get_mSuspensionMaxLength(),
        suspensionVelocity: this.suspensionVelocities[index],
        surface: this.resolveWheelSurface(index),
        effectiveLongitudinalSlip: wheel.get_mLongitudinalSlip(),
        effectiveLateralSlipRadians: wheel.get_mLateralSlip(),
        longitudinalCapacityN: this.tireLongitudinalCapacityN[index],
        lateralCapacityN: this.tireLateralCapacityN[index],
        aligningMomentNm: this.tireAligningMomentNm[index],
        longitudinalForceN: this.tireLongitudinalForceN[index],
        lateralForceN: this.tireLateralForceN[index],
        longitudinalSlipVelocityMps: this.tireLongitudinalSlipVelocityMps[index],
        lateralSlipVelocityMps: this.tireLateralSlipVelocityMps[index],
        longitudinalPowerLossW: this.tireLongitudinalPowerLossW[index],
        lateralPowerLossW: this.tireLateralPowerLossW[index],
        longitudinalEnergyLossJ: this.tireLongitudinalEnergyLossJ[index],
        lateralEnergyLossJ: this.tireLateralEnergyLossJ[index],
      }));
    }

    return Object.freeze({
      vehicleKind: this.vehicleKind,
      speedKmh: Math.hypot(linearVelocity.GetX(), linearVelocity.GetY(), linearVelocity.GetZ()) * 3.6,
      position: Object.freeze([position.GetX(), position.GetY(), position.GetZ()]) as readonly [number, number, number],
      rotation: Object.freeze([
        rotation.GetX(),
        rotation.GetY(),
        rotation.GetZ(),
        rotation.GetW(),
      ]) as readonly [number, number, number, number],
      yawRate: angularVelocity.GetY(),
      physicsHz: this.physicsHz,
      configuredTireContactCount: this.tireModel === TMEASY_NINE_POINT_MODEL
        ? PHYSICAL_CONTACT_COUNT
        : this.configuredTireContactCount,
      evaluatedTireContactCount: this.evaluatedTireContactCount,
      rpm: engine.GetCurrentRPM(),
      gear: transmission.GetCurrentGear(),
      clutchFriction,
      clutchEngagement: clamp(clutchFriction, 0, 1),
      transmissionSwitchingGear: transmission.IsSwitchingGear(),
      throttle: Math.abs(this.controller.GetForwardInput()),
      brake: this.controller.GetBrakeInput(),
      steering: this.currentSteeringInput,
      requestedEngineTorqueNm: this.requestedEngineTorqueNm,
      deliveredEngineTorqueNm: this.deliveredEngineTorqueNm,
      deliveredAxleTorqueNm: this.deliveredAxleTorqueNm,
      deliveredWheelTorqueNm: this.deliveredWheelTorqueNm,
      aerodynamicDragN: this.aerodynamicDragN,
      aerodynamicDownforceN: this.aerodynamicDownforceN,
      liftOffFrontAeroBlend: this.liftOffFrontAeroBlend,
      liftOffFrontDownforceN: this.liftOffFrontDownforceN,
      tireModel: this.tireModel,
      tireExecutionBackend: this.tireModel === 'jolt-default'
        ? 'jolt'
        : this.compiledTireRuntime?.backend ?? 'typescript',
      tireExecutionPreference: this.tireExecutionPreference,
      tireOperatingParameters: this.tireOperatingParameters,
      tireOperatingGripScale: tireOperatingScales(this.tireOperatingParameters).grip,
      surfaceMode: this.surfaceMode,
      handlingStage: this.handlingStage,
      wheels: Object.freeze(wheels),
    });
  }

  getPose(): ApexVehiclePoseSnapshot {
    const position = this.carBody.GetPosition();
    const rotation = this.carBody.GetRotation();
    const linearVelocity = this.carBody.GetLinearVelocity();
    const engine = this.controller.GetEngine();
    const transmission = this.controller.GetTransmission();
    const clutchFriction = transmission.GetClutchFriction();
    const wheelPositions: ApexVector3Tuple[] = [];
    const wheelRotations: ApexQuaternionTuple[] = [];
    const wheelContactErrorsM: number[] = [];
    const wheelGrounded: boolean[] = [];
    const wheelContactPositions: ApexVector3Tuple[] = [];
    const wheelContactNormals: ApexVector3Tuple[] = [];
    const wheelContactLongitudinals: ApexVector3Tuple[] = [];
    const wheelContactLaterals: ApexVector3Tuple[] = [];
    const wheelVerticalLoadsN: number[] = [];
    const wheelSuspensionLengthsM: number[] = [];
    const wheelAngularVelocitiesRadiansPerSecond: number[] = [];
    const wheelLongitudinalSlips: number[] = [];
    const wheelLateralSlipRadians: number[] = [];
    const wheelLongitudinalForcesN: number[] = [];
    const wheelLateralForcesN: number[] = [];
    const wheelSurfaces: SurfaceId[] = [];

    for (let index = 0; index < this.wheelCount; index += 1) {
      const wheel = this.J.castObject(this.constraint.GetWheel(index), this.J.WheelWV);
      const transform = this.constraint.GetWheelLocalTransform(index, this.wheelRight, this.wheelUp);
      const translation = transform.GetTranslation();
      const quaternion = transform.GetRotation().GetQuaternion();
      wheelPositions.push(vector3Tuple(
        translation.GetX(),
        translation.GetY(),
        translation.GetZ(),
      ));
      wheelRotations.push(quaternionTuple(
        quaternion.GetX(),
        quaternion.GetY(),
        quaternion.GetZ(),
        quaternion.GetW(),
      ));
      const grounded = wheel.HasContact();
      wheelGrounded.push(grounded);
      wheelVerticalLoadsN.push(
        grounded
          ? Math.max(0, wheel.GetSuspensionLambda() * this.physicsHz)
          : 0,
      );
      wheelSuspensionLengthsM.push(wheel.GetSuspensionLength());
      wheelAngularVelocitiesRadiansPerSecond.push(wheel.GetAngularVelocity());
      wheelLongitudinalSlips.push(wheel.get_mLongitudinalSlip());
      wheelLateralSlipRadians.push(wheel.get_mLateralSlip());
      wheelLongitudinalForcesN.push(this.tireLongitudinalForceN[index]);
      wheelLateralForcesN.push(this.tireLateralForceN[index]);
      if (grounded) {
        const worldTransform = this.constraint.GetWheelWorldTransform(
          index,
          this.wheelRight,
          this.wheelUp,
        );
        const wheelCenter = worldTransform.GetTranslation();
        const contact = wheel.GetContactPosition();
        const normal = wheel.GetContactNormal();
        const normalDistanceM = (
          (wheelCenter.GetX() - contact.GetX()) * normal.GetX()
          + (wheelCenter.GetY() - contact.GetY()) * normal.GetY()
          + (wheelCenter.GetZ() - contact.GetZ()) * normal.GetZ()
        );
        wheelContactErrorsM.push(
          normalDistanceM - this.wheelRadiusM,
        );
        wheelContactPositions.push(vector3Tuple(
          contact.GetX(),
          contact.GetY(),
          contact.GetZ(),
        ));
        wheelContactNormals.push(normalizedVector3Tuple(
          normal.GetX(),
          normal.GetY(),
          normal.GetZ(),
          [0, 1, 0],
        ));
        const longitudinal = wheel.GetContactLongitudinal();
        const lateral = wheel.GetContactLateral();
        wheelContactLongitudinals.push(normalizedVector3Tuple(
          longitudinal.GetX(),
          longitudinal.GetY(),
          longitudinal.GetZ(),
          [0, 0, 1],
        ));
        wheelContactLaterals.push(normalizedVector3Tuple(
          lateral.GetX(),
          lateral.GetY(),
          lateral.GetZ(),
          [1, 0, 0],
        ));
      } else {
        wheelContactErrorsM.push(Number.NaN);
        wheelContactPositions.push(vector3Tuple(
          Number.NaN,
          Number.NaN,
          Number.NaN,
        ));
        wheelContactNormals.push(vector3Tuple(0, 1, 0));
        wheelContactLongitudinals.push(vector3Tuple(0, 0, 1));
        wheelContactLaterals.push(vector3Tuple(1, 0, 0));
      }
      wheelSurfaces.push(this.resolveWheelSurface(index));
    }

    return Object.freeze({
      vehicleKind: this.vehicleKind,
      position: vector3Tuple(position.GetX(), position.GetY(), position.GetZ()),
      rotation: quaternionTuple(
        rotation.GetX(),
        rotation.GetY(),
        rotation.GetZ(),
        rotation.GetW(),
      ),
      wheelPositions: Object.freeze(wheelPositions),
      wheelRotations: Object.freeze(wheelRotations),
      wheelContactErrorsM: Object.freeze(wheelContactErrorsM),
      wheelGrounded: Object.freeze(wheelGrounded),
      wheelContactPositions: Object.freeze(wheelContactPositions),
      wheelContactNormals: Object.freeze(wheelContactNormals),
      wheelContactLongitudinals: Object.freeze(wheelContactLongitudinals),
      wheelContactLaterals: Object.freeze(wheelContactLaterals),
      wheelVerticalLoadsN: Object.freeze(wheelVerticalLoadsN),
      wheelSuspensionLengthsM: Object.freeze(wheelSuspensionLengthsM),
      wheelAngularVelocitiesRadiansPerSecond: Object.freeze(
        wheelAngularVelocitiesRadiansPerSecond,
      ),
      wheelLongitudinalSlips: Object.freeze(wheelLongitudinalSlips),
      wheelLateralSlipRadians: Object.freeze(wheelLateralSlipRadians),
      wheelLongitudinalForcesN: Object.freeze(wheelLongitudinalForcesN),
      wheelLateralForcesN: Object.freeze(wheelLateralForcesN),
      wheelSurfaces: Object.freeze(wheelSurfaces),
      tirePressurePsi: this.tireOperatingParameters.pressurePsi,
      speedKmh: Math.hypot(linearVelocity.GetX(), linearVelocity.GetY(), linearVelocity.GetZ()) * 3.6,
      rpm: engine.GetCurrentRPM(),
      gear: transmission.GetCurrentGear(),
      clutchFriction,
      clutchEngagement: clamp(clutchFriction, 0, 1),
      transmissionSwitchingGear: transmission.IsSwitchingGear(),
      throttle: Math.abs(this.controller.GetForwardInput()),
      brake: this.controller.GetBrakeInput(),
      steering: this.currentSteeringInput,
      liftOffFrontAeroBlend: this.liftOffFrontAeroBlend,
      liftOffFrontDownforceN: this.liftOffFrontDownforceN,
    });
  }
}
