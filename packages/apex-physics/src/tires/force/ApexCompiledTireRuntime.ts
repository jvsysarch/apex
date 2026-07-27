import type { SurfaceProperties } from '../../surfaces/SurfaceRegistry.ts';

import type { TireForceModelId } from './TireForceModel.ts';

export type ApexTireExecutionBackend = 'typescript' | 'wasm';
export type ApexTireExecutionPreference = 'auto' | 'typescript';

const NATIVE_MODEL_BY_ID: Readonly<Record<TireForceModelId, number>> = Object.freeze({
  'apex-brush-v1': 1,
  'apex-tmeasy-v1': 2,
});

/**
 * Adaptador mínimo del callback de neumático compilado.
 *
 * No contiene física: sólo versiona el contrato entre TypeScript y el módulo
 * ApexPhysics. Si el WASM servido todavía no exporta ApexTireForceBridge,
 * `create` devuelve undefined y el vehículo conserva el callback TypeScript.
 */
export class ApexCompiledTireRuntime {
  static create(J: any, controller: any, wheelCount: number): ApexCompiledTireRuntime | undefined {
    if (typeof J.ApexTireForceBridge !== 'function') return undefined;
    return new ApexCompiledTireRuntime(
      new J.ApexTireForceBridge(),
      controller,
      wheelCount,
    );
  }

  private active = false;
  private readonly bridge: any;
  private readonly controller: any;
  private readonly wheelCount: number;

  private constructor(
    bridge: any,
    controller: any,
    wheelCount: number,
  ) {
    this.bridge = bridge;
    this.controller = controller;
    this.wheelCount = wheelCount;
  }

  supports(model: string): model is TireForceModelId {
    return Object.prototype.hasOwnProperty.call(NATIVE_MODEL_BY_ID, model);
  }

  activate(model: TireForceModelId): void {
    this.bridge.SetModel(NATIVE_MODEL_BY_ID[model]);
    this.bridge.SetWheeledVehicleController(this.controller);
    this.active = true;
  }

  deactivate(): void {
    this.bridge.SetModel(0);
    this.active = false;
  }

  get backend(): ApexTireExecutionBackend {
    return this.active ? 'wasm' : 'typescript';
  }

  configure(
    patchesPerContact: number,
    operatingGripScale: number,
    pressureStiffnessScale: number,
    lateralGripMultiplier: number,
  ): void {
    if (!this.active) return;
    this.bridge.SetPatchesPerContact(Math.max(1, Math.floor(patchesPerContact)));
    this.bridge.SetOperatingScales(operatingGripScale, pressureStiffnessScale);
    this.bridge.SetLateralGripMultiplier(lateralGripMultiplier);
  }

  setWheelSurface(wheelIndex: number, surface: SurfaceProperties): void {
    if (!this.active) return;
    this.bridge.SetWheelSurface(
      wheelIndex,
      surface.longitudinalMu,
      surface.lateralMu,
      surface.peakSlipRatio,
      surface.peakSlipAngleRadians,
    );
  }

  beginStep(): void {
    if (!this.active) return;
    this.bridge.BeginStep();
  }

  copyTelemetry(
    longitudinalCapacityN: number[],
    lateralCapacityN: number[],
    aligningMomentNm: number[],
  ): number | undefined {
    if (!this.active) return undefined;
    for (let wheelIndex = 0; wheelIndex < this.wheelCount; wheelIndex += 1) {
      longitudinalCapacityN[wheelIndex] = (
        this.bridge.GetLongitudinalCapacity(wheelIndex)
      );
      lateralCapacityN[wheelIndex] = this.bridge.GetLateralCapacity(wheelIndex);
      aligningMomentNm[wheelIndex] = this.bridge.GetAligningMoment(wheelIndex);
    }
    return this.bridge.GetEvaluatedContactCount();
  }
}
