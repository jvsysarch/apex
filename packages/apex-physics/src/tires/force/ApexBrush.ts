import {
  clamp,
  combinedEnvelope,
  DEFAULT_TIRE_OPERATING_PARAMETERS,
  loadSensitiveCapacity,
  normalizeTireOperatingParameters,
  tireOperatingScales,
  type ContactPatchSample,
  type TireForceModel,
  type TireForces,
  type TireOperatingParameters,
} from './TireForceModel.ts';

export interface ApexBrushSettings {
  readonly referenceLoadN: number;
  readonly loadSensitivityExponent: number;
  readonly longitudinalStiffnessPerLoad: number;
  readonly corneringStiffnessPerLoad: number;
  readonly pneumaticTrailM: number;
}

export const APEX_BRUSH_SETTINGS: ApexBrushSettings = Object.freeze({
  referenceLoadN: 3800,
  loadSensitivityExponent: 0.94,
  longitudinalStiffnessPerLoad: 11.5,
  corneringStiffnessPerLoad: 10.2,
  pneumaticTrailM: 0.075,
});

/** Brush/Fiala pragmático con saturación física y círculo combinado. */
export class ApexBrush implements TireForceModel {
  readonly id = 'apex-brush-v1' as const;
  private readonly settings: ApexBrushSettings;
  private operatingParameters = DEFAULT_TIRE_OPERATING_PARAMETERS;

  constructor(settings: ApexBrushSettings = APEX_BRUSH_SETTINGS) {
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
    const longitudinalStiffness = loadN
      * this.settings.longitudinalStiffnessPerLoad
      * operatingScales.stiffness;
    const corneringStiffness = loadN
      * this.settings.corneringStiffnessPerLoad
      * operatingScales.stiffness;
    const longitudinalForceN = this.brushAxisForce(
      sample.slipRatio,
      longitudinalStiffness,
      longitudinalCapacityN,
    );
    const lateralForceN = -this.fialaLateralForce(
      sample.slipAngleRadians,
      corneringStiffness,
      lateralCapacityN,
    );
    const combined = combinedEnvelope(
      longitudinalForceN,
      lateralForceN,
      longitudinalCapacityN,
      lateralCapacityN,
    );
    const normalizedLateral = Math.abs(sample.slipAngleRadians)
      / Math.max(1e-4, sample.surface.peakSlipAngleRadians);
    const trail = this.settings.pneumaticTrailM
      * (1 - 0.82 * this.smoothstep(0.65, 2.1, normalizedLateral));

    return Object.freeze({
      longitudinalForceN: combined.longitudinalForceN,
      lateralForceN: combined.lateralForceN,
      aligningMomentNm: -combined.lateralForceN * trail,
      longitudinalCapacityN,
      lateralCapacityN,
      state: Object.freeze({
        normalizedLongitudinalSlip: sample.slipRatio
          / Math.max(1e-4, sample.surface.peakSlipRatio),
        normalizedLateralSlip: sample.slipAngleRadians
          / Math.max(1e-4, sample.surface.peakSlipAngleRadians),
        combinedSlip: Math.hypot(
          sample.slipRatio / Math.max(1e-4, sample.surface.peakSlipRatio),
          sample.slipAngleRadians / Math.max(1e-4, sample.surface.peakSlipAngleRadians),
        ),
        adhesion: combined.scale,
        pneumaticTrailM: trail,
        operatingGripScale: operatingScales.grip,
        pressureStiffnessScale: operatingScales.stiffness,
      }),
    });
  }

  private brushAxisForce(slip: number, stiffness: number, capacityN: number): number {
    const elasticForce = stiffness * slip;
    return capacityN * Math.tanh(elasticForce / Math.max(1, capacityN));
  }

  private fialaLateralForce(angle: number, stiffness: number, capacityN: number): number {
    const tangent = Math.tan(clamp(angle, -Math.PI * 0.48, Math.PI * 0.48));
    const absoluteTangent = Math.abs(tangent);
    const criticalTangent = 3 * capacityN / Math.max(1, stiffness);
    if (absoluteTangent >= criticalTangent) return capacityN * Math.sign(tangent);
    const first = stiffness * tangent;
    const second = stiffness * stiffness / (3 * capacityN)
      * absoluteTangent * tangent;
    const third = stiffness ** 3 / (27 * capacityN * capacityN) * tangent ** 3;
    return first - second + third;
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
