import { ApexVehicleSimulation } from './ApexVehicleSimulation.ts';
import type {
  ApexStaticColliderGroup,
  ApexStaticWorldPort,
} from './contracts/ApexStaticWorldContracts.ts';
import type {
  ApexHandlingStage,
  ApexVehicleDefinition,
  ApexVehicleDynamicsProfile,
  ApexVehiclePoseSnapshot,
  ApexVehicleSpawn,
  ApexVehicleState,
  ApexVehicleTrainingSnapshot,
} from './contracts/ApexVehicleContracts.ts';
import type { DriverInput } from './contracts/DriverInput.ts';
import type { SurfaceMode } from './surfaces/SurfaceRegistry.ts';
import type { TireModelId } from './tires/ApexTireModel.ts';
import type {
  ApexTireExecutionPreference,
} from './tires/force/ApexCompiledTireRuntime.ts';
import type {
  TireOperatingParameters,
} from './tires/force/TireForceModel.ts';

const NEUTRAL_DRIVER_INPUT: DriverInput = Object.freeze({
  forward: false,
  backward: false,
  left: false,
  right: false,
  handbrake: false,
  throttle: 0,
  brake: 0,
  steering: 0,
});

/**
 * Instancia de vehículo creada dentro de un `ApexPhysicsWorld`.
 *
 * Expone únicamente control y snapshots numéricos. El mundo conserva la
 * autoridad sobre el avance temporal y el contenido estático.
 */
export class ApexVehicle {
  readonly definition: ApexVehicleDefinition;
  private readonly simulation: ApexVehicleSimulation;
  private pendingInput: DriverInput = NEUTRAL_DRIVER_INPUT;

  /** @internal Sólo `ApexPhysicsWorld` debe crear instancias. */
  constructor(
    definition: ApexVehicleDefinition,
    simulation: ApexVehicleSimulation,
  ) {
    this.definition = definition;
    this.simulation = simulation;
  }

  applyInput(input: DriverInput): void {
    this.pendingInput = input;
  }

  /** @internal Consumido una vez por cada paso del mundo. */
  consumeInput(): DriverInput {
    return this.pendingInput;
  }

  setTireModel(model: TireModelId): void {
    this.simulation.setTireModel(model);
  }

  setTireExecutionPreference(preference: ApexTireExecutionPreference): void {
    this.simulation.setTireExecutionPreference(preference);
  }

  setHandlingStage(stage: ApexHandlingStage): void {
    this.simulation.setHandlingStage(stage);
  }

  setTireOperatingParameters(
    parameters: Partial<TireOperatingParameters>,
  ): void {
    this.simulation.setTireOperatingParameters(parameters);
  }

  configureDynamicsProfile(profile: ApexVehicleDynamicsProfile): void {
    this.simulation.configureDynamicsProfile(profile);
  }

  resetTireEnergyDissipation(): void {
    this.simulation.resetTireEnergyDissipation();
  }

  setActiveSurface(surface: SurfaceMode): void {
    this.simulation.setActiveSurface(surface);
  }

  placeAtSpawn(spawn: ApexVehicleSpawn): void {
    this.simulation.placeAtSpawn(spawn);
  }

  captureTrainingSnapshot(): ApexVehicleTrainingSnapshot {
    return this.simulation.captureTrainingSnapshot();
  }

  restoreTrainingSnapshot(snapshot: ApexVehicleTrainingSnapshot): void {
    this.simulation.restoreTrainingSnapshot(snapshot);
  }

  configureTireContactEvaluation(
    contactCount: number,
    physicsHz: number,
  ): void {
    this.simulation.configureTireContactEvaluation(contactCount, physicsHz);
  }

  getState(): ApexVehicleState {
    return this.simulation.getState();
  }

  getPose(): ApexVehiclePoseSnapshot {
    return this.simulation.getPose();
  }
}

/**
 * Mundo físico headless respaldado por Jolt.
 *
 * La primera versión conserva la capacidad validada de un vehículo. La
 * restricción se expresa de forma explícita para no simular soporte
 * multivehículo antes de implementarlo y validarlo.
 */
export class ApexPhysicsWorld implements ApexStaticWorldPort {
  private readonly J: any;
  private simulation?: ApexVehicleSimulation;
  private activeVehicle?: ApexVehicle;

  static create(J: any): ApexPhysicsWorld {
    return new ApexPhysicsWorld(J);
  }

  private constructor(J: any) {
    this.J = J;
  }

  addVehicle(
    definition: ApexVehicleDefinition,
    initialSpawn?: ApexVehicleSpawn,
  ): ApexVehicle {
    if (this.activeVehicle) {
      throw new Error(
        'ApexPhysicsWorld currently supports one vehicle per world',
      );
    }
    this.simulation = ApexVehicleSimulation.create(
      this.J,
      definition,
      initialSpawn,
    );
    this.activeVehicle = new ApexVehicle(definition, this.simulation);
    return this.activeVehicle;
  }

  step(): void {
    const simulation = this.requireSimulation();
    simulation.step(this.activeVehicle!.consumeInput());
  }

  replaceStaticColliderGroup(group: ApexStaticColliderGroup): void {
    this.requireSimulation().replaceStaticColliderGroup(group);
  }

  removeStaticColliderGroup(ownerId: string): void {
    this.requireSimulation().removeStaticColliderGroup(ownerId);
  }

  retainStaticColliderGroups(ownerIds: ReadonlySet<string>): void {
    this.requireSimulation().retainStaticColliderGroups(ownerIds);
  }

  private requireSimulation(): ApexVehicleSimulation {
    if (!this.simulation) {
      throw new Error(
        'Create a vehicle before stepping or adding static colliders',
      );
    }
    return this.simulation;
  }
}
