import type {
  SurfaceMode,
  TireModelId,
  TireOperatingParameters,
} from '@jvsysarch/apex-physics';

export type ApexPhysicsCommand =
  | { readonly type: 'SET_TIRE_MODEL'; readonly model: TireModelId }
  | {
    readonly type: 'SET_TIRE_OPERATING_PARAMETERS';
    readonly parameters: Partial<TireOperatingParameters>;
  }
  | { readonly type: 'SET_ACTIVE_SURFACE'; readonly surface: SurfaceMode };

export interface ApexCommandSender {
  send(command: ApexPhysicsCommand): void;
}

export interface ApexPhysicsCommandTarget {
  setTireModel(model: TireModelId): void;
  setTireOperatingParameters(
    parameters: Partial<TireOperatingParameters>,
  ): void;
  setActiveSurface(surface: SurfaceMode): void;
}

/** Canal explícito de comandos. Nunca se entrega a telemetría de solo lectura. */
export class ApexCommandBus {
  readonly sender: ApexCommandSender;

  constructor(private readonly vehicle: ApexPhysicsCommandTarget) {
    this.sender = Object.freeze({
      send: (command: ApexPhysicsCommand) => this.send(command),
    });
  }

  send(command: ApexPhysicsCommand): void {
    switch (command.type) {
      case 'SET_TIRE_MODEL':
        this.vehicle.setTireModel(command.model);
        break;
      case 'SET_TIRE_OPERATING_PARAMETERS':
        this.vehicle.setTireOperatingParameters(command.parameters);
        break;
      case 'SET_ACTIVE_SURFACE':
        this.vehicle.setActiveSurface(command.surface);
        break;
    }
  }
}
