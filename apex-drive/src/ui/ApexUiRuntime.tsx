import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ApexVehicle } from '@jvsysarch/apex-physics';
import type {
  ApexVehicleState,
} from '@jvsysarch/apex-physics';
import {
  ApexTelemetryAdapter,
  TelemetryHistory,
  TelemetryProvider,
  TelemetryStore,
} from '../telemetry';
import {
  ApexCommandBus,
  type ApexCommandSender,
  type ApexPhysicsCommand,
} from '@jvsysarch/apex-contracts';
import { ApexWorkspace } from '../workspaces/ApexWorkspace';

export interface ApexUiRuntime {
  setStatus(message: string): void;
  publish(timestamp: number, state: ApexVehicleState): void;
  connectTuning?(vehicle: ApexVehicle): void;
  sendCommand?(command: ApexPhysicsCommand): void;
}

class BaseUiRuntime implements ApexUiRuntime {
  protected readonly root: Root;
  protected readonly store = new TelemetryStore();
  protected readonly history = new TelemetryHistory(this.store.reader);
  protected readonly adapter = new ApexTelemetryAdapter();
  protected status = 'Cargando apex-physics.js…';
  protected commands?: ApexCommandSender;

  constructor(container: HTMLElement) {
    this.root = createRoot(container);
    this.render();
  }

  setStatus(message: string): void {
    this.status = message;
    this.render();
  }

  publish(timestamp: number, state: ApexVehicleState): void {
    this.store.publish(this.adapter.readFrame(timestamp, state));
  }

  protected render(): void {
    this.root.render(createElement(
      TelemetryProvider,
      {
        source: this.store.reader,
        children: createElement(ApexWorkspace, {
          history: this.history,
          runtimeStatus: this.status,
          commands: this.commands,
        }),
      },
    ));
  }
}

class TuningUiRuntime extends BaseUiRuntime {
  private commandBus?: ApexCommandBus;

  connectTuning(vehicle: ApexVehicle): void {
    this.commandBus = new ApexCommandBus(vehicle);
    this.commands = this.commandBus.sender;
    this.render();
  }

  sendCommand(command: ApexPhysicsCommand): void {
    if (!this.commandBus) throw new Error('Tuning command bus is not connected');
    this.commandBus.send(command);
  }
}

export function createReadOnlyUi(container: HTMLElement): ApexUiRuntime {
  return new BaseUiRuntime(container);
}

export function createTuningUi(container: HTMLElement): ApexUiRuntime {
  return new TuningUiRuntime(container);
}
