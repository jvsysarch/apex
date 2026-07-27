import type { SurfaceProperties } from '../surfaces/SurfaceRegistry.ts';

import type { TireForceModelId } from './force/TireForceModel.ts';

export type TireModelId =
  | 'jolt-default'
  | 'apex-v1'
  | 'apex-v1.1'
  | 'apex-v1.2'
  | TireForceModelId
  | 'apex-tmeasy-9p-v2'
  | 'apex-multicontact-v1';

export interface ApexTireInput {
  readonly verticalLoad: number;
  readonly slipRatio: number;
  readonly slipAngleRadians: number;
  readonly surface: SurfaceProperties;
}

export interface ApexTireForces {
  readonly longitudinalForceLimit: number;
  readonly lateralForceLimit: number;
  readonly longitudinalResponse: number;
  readonly lateralResponse: number;
  readonly combinedScale: number;
}

export interface ApexTireModelSettings {
  readonly referenceLoad: number;
  readonly loadSensitivityExponent: number;
  readonly lateralRiseExponent: number;
  readonly minimumLateralRetention: number;
  readonly combinedGripExponent: number;
  readonly lateralMidSlipBoost: number;
}

export const APEX_TIRE_V1_SETTINGS: ApexTireModelSettings = Object.freeze({
  referenceLoad: 3800,
  loadSensitivityExponent: 0.86,
  lateralRiseExponent: 1,
  minimumLateralRetention: 0,
  combinedGripExponent: 2,
  lateralMidSlipBoost: 0,
});

export const APEX_TIRE_V1_1_SETTINGS: ApexTireModelSettings = Object.freeze({
  referenceLoad: 3800,
  loadSensitivityExponent: 0.86,
  // Mayor pendiente inicial: el neumático construye fuerza antes de cruzarse.
  lateralRiseExponent: 0.62,
  // Conserva capacidad direccional durante derrapes de 30–60 grados.
  minimumLateralRetention: 0.88,
  // Superelipse más cuadrada: tracción y giro coexisten mejor.
  combinedGripExponent: 3.2,
  lateralMidSlipBoost: 0,
});

export const APEX_TIRE_V1_2_SETTINGS: ApexTireModelSettings = Object.freeze({
  referenceLoad: 3800,
  loadSensitivityExponent: 0.86,
  // Un poco más de autoridad lateral antes y alrededor del pico.
  lateralRiseExponent: 0.54,
  // V1.2 conserva exactamente la recuperación post-pico de V1.1.
  minimumLateralRetention: 0.88,
  // Menor penalización longitudinal al coexistir aceleración y giro.
  combinedGripExponent: 3.8,
  // Refuerzo localizado entre 4 y 12 grados, sin elevar el grip del derrape profundo.
  lateralMidSlipBoost: 0.045,
});

/** Primer modelo Apex: curvas progresivas, carga no lineal y elipse combinada. */
export class ApexTireModel {
  private readonly settings: ApexTireModelSettings;

  constructor(settings: ApexTireModelSettings = APEX_TIRE_V1_SETTINGS) {
    this.settings = settings;
  }

  calculate(input: ApexTireInput): ApexTireForces {
    const load = Math.max(0, input.verticalLoad);
    if (load < 1) {
      return Object.freeze({
        longitudinalForceLimit: 0,
        lateralForceLimit: 0,
        longitudinalResponse: 0,
        lateralResponse: 0,
        combinedScale: 1,
      });
    }

    const loadRatio = Math.max(0.02, load / this.settings.referenceLoad);
    const loadSensitiveBase = this.settings.referenceLoad
      * Math.pow(loadRatio, this.settings.loadSensitivityExponent);
    const longitudinalCapacity = loadSensitiveBase * input.surface.longitudinalMu;
    const lateralSlipDegrees = Math.abs(input.slipAngleRadians) * 180 / Math.PI;
    const lateralBandRise = this.smoothstep(4, 7, lateralSlipDegrees);
    const lateralBandFall = 1 - this.smoothstep(12, 18, lateralSlipDegrees);
    const lateralCapacity = loadSensitiveBase
      * input.surface.lateralMu
      * (1 + this.settings.lateralMidSlipBoost * lateralBandRise * lateralBandFall);
    const longitudinalResponse = this.progressiveCurve(
      Math.abs(input.slipRatio),
      input.surface.peakSlipRatio,
      input.surface.slidingGripRetention,
      input.surface.breakawayFalloff,
    );
    const lateralResponse = this.progressiveCurve(
      Math.abs(input.slipAngleRadians),
      input.surface.peakSlipAngleRadians,
      Math.max(input.surface.slidingGripRetention, this.settings.minimumLateralRetention),
      input.surface.breakawayFalloff,
      this.settings.lateralRiseExponent,
    );

    // V1 usa una elipse (p=2). V1.1 aumenta p para permitir más coexistencia
    // entre fuerza longitudinal y lateral sin superar la envolvente.
    const combinedExponent = this.settings.combinedGripExponent;
    const combinedDemand = (
      Math.pow(longitudinalResponse, combinedExponent)
      + Math.pow(lateralResponse, combinedExponent)
    ) ** (1 / combinedExponent);
    const combinedScale = combinedDemand > 1 ? 1 / combinedDemand : 1;

    return Object.freeze({
      longitudinalForceLimit: longitudinalCapacity * longitudinalResponse * combinedScale,
      lateralForceLimit: lateralCapacity * lateralResponse * combinedScale,
      longitudinalResponse,
      lateralResponse,
      combinedScale,
    });
  }

  private progressiveCurve(
    value: number,
    peak: number,
    retention: number,
    falloff: number,
    riseExponent = 1,
  ): number {
    const normalized = value / Math.max(peak, 1e-4);
    if (normalized <= 1) {
      return Math.sin(Math.pow(normalized, riseExponent) * Math.PI * 0.5);
    }
    return retention + (1 - retention) * Math.exp(-(normalized - 1) * falloff);
  }

  private smoothstep(edge0: number, edge1: number, value: number): number {
    const normalized = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return normalized * normalized * (3 - 2 * normalized);
  }
}
