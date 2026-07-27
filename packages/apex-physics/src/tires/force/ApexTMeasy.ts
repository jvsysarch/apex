import {
  clamp,
  DEFAULT_TIRE_OPERATING_PARAMETERS,
  loadSensitiveCapacity,
  normalizeTireOperatingParameters,
  tireOperatingScales,
  type ContactPatchSample,
  type TireForceModel,
  type TireForces,
  type TireOperatingParameters,
} from './TireForceModel.ts';

export interface ApexTMeasySettings {
  readonly referenceLoadN: number;
  readonly loadSensitivityExponent: number;
  readonly initialSlope: number;
  readonly postPeakRetention: number;
  readonly postPeakFalloff: number;
  readonly pneumaticTrailM: number;
}

export const APEX_TMEASY_SETTINGS: ApexTMeasySettings = Object.freeze({
  referenceLoadN: 3800,
  loadSensitivityExponent: 0.96,
  // Más cornering/traction stiffness antes del pico: el neumático corrige
  // antes de acumular grandes ángulos o ratios de slip, sin elevar μ máximo.
  initialSlope: 5.4,
  postPeakRetention: 0.86,
  postPeakFalloff: 0.64,
  pneumaticTrailM: 0.082,
});

/**
 * TMeasy simplificado: slip normalizado combinado, saturación continua y
 * dirección de fuerza determinada por las dos componentes del slip.
 */
export class ApexTMeasy implements TireForceModel {
  readonly id = 'apex-tmeasy-v1' as const;
  private readonly settings: ApexTMeasySettings;
  private operatingParameters = DEFAULT_TIRE_OPERATING_PARAMETERS;

  constructor(settings: ApexTMeasySettings = APEX_TMEASY_SETTINGS) {
    this.settings = settings;
  }

  getOperatingParameters(): TireOperatingParameters {
    return this.operatingParameters;
  }

  configureOperatingParameters(parameters: Partial<TireOperatingParameters>): void {
    this.operatingParameters = normalizeTireOperatingParameters(
      this.operatingParameters,
      parameters,
    );
  }

  reset(): void {}

  evaluate(sample: ContactPatchSample): TireForces {
    const loadN = Math.max(0, sample.verticalLoadN);
    if (loadN < 1) return this.zero();
    const operatingScales = tireOperatingScales(this.operatingParameters);
    const longitudinalCapacityN = loadSensitiveCapacity(
      loadN,
      this.settings.referenceLoadN,
      this.settings.loadSensitivityExponent,
      sample.surface.longitudinalMu * operatingScales.grip,
    );
    const lateralCapacityN = loadSensitiveCapacity(
      loadN,
      this.settings.referenceLoadN,
      this.settings.loadSensitivityExponent,
      sample.surface.lateralMu * operatingScales.grip,
    );
    const normalizedLongitudinal = sample.slipRatio
      / Math.max(1e-4, sample.surface.peakSlipRatio);
    const normalizedLateral = Math.tan(sample.slipAngleRadians)
      / Math.max(1e-4, Math.tan(sample.surface.peakSlipAngleRadians));
    const combinedSlip = Math.hypot(normalizedLongitudinal, normalizedLateral);
    const adhesion = this.adhesion(combinedSlip, operatingScales.stiffness);
    const directionScale = combinedSlip > 1e-5 ? adhesion / combinedSlip : 0;
    const longitudinalForceN = longitudinalCapacityN
      * normalizedLongitudinal
      * directionScale;
    const lateralForceN = -lateralCapacityN
      * normalizedLateral
      * directionScale;
    const trail = this.settings.pneumaticTrailM
      * (1 - 0.84 * this.smoothstep(0.55, 2.25, Math.abs(normalizedLateral)));

    return Object.freeze({
      longitudinalForceN,
      lateralForceN,
      aligningMomentNm: -lateralForceN * trail,
      longitudinalCapacityN,
      lateralCapacityN,
      state: Object.freeze({
        normalizedLongitudinalSlip: normalizedLongitudinal,
        normalizedLateralSlip: normalizedLateral,
        combinedSlip,
        adhesion,
        pneumaticTrailM: trail,
        operatingGripScale: operatingScales.grip,
        pressureStiffnessScale: operatingScales.stiffness,
      }),
    });
  }

  private adhesion(combinedSlip: number, stiffnessScale: number): number {
    if (combinedSlip <= 1) {
      const slope = this.settings.initialSlope * stiffnessScale;
      const denominator = 1 + (slope - 1) * combinedSlip;
      return clamp(slope * combinedSlip / denominator, 0, 1);
    }
    const distance = combinedSlip - 1;
    return this.settings.postPeakRetention
      + (1 - this.settings.postPeakRetention)
      * Math.exp(-this.settings.postPeakFalloff * distance * distance);
  }

  private smoothstep(edge0: number, edge1: number, value: number): number {
    const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return normalized * normalized * (3 - 2 * normalized);
  }

  private zero(): TireForces {
    return Object.freeze({
      longitudinalForceN: 0,
      lateralForceN: 0,
      aligningMomentNm: 0,
      longitudinalCapacityN: 0,
      lateralCapacityN: 0,
      state: Object.freeze({
        normalizedLongitudinalSlip: 0,
        normalizedLateralSlip: 0,
        combinedSlip: 0,
        adhesion: 0,
        pneumaticTrailM: 0,
        operatingGripScale: 0,
        pressureStiffnessScale: 0,
      }),
    });
  }
}
