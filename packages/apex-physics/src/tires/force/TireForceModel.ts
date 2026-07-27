import type { SurfaceProperties } from '../../surfaces/SurfaceRegistry.ts';

export type TireForceModelId = 'apex-brush-v1' | 'apex-tmeasy-v1';
export type TireCompoundId = 'sport' | 'semi-slick' | 'slick';

export interface TireCompoundProperties {
  readonly id: TireCompoundId;
  readonly label: string;
  readonly gripMultiplier: number;
  readonly optimalPressurePsi: number;
  readonly optimalTemperatureC: number;
}

export const TIRE_COMPOUNDS: readonly TireCompoundProperties[] = Object.freeze([
  Object.freeze({
    id: 'sport',
    label: 'Sport',
    gripMultiplier: 1,
    optimalPressurePsi: 32,
    optimalTemperatureC: 70,
  }),
  Object.freeze({
    id: 'semi-slick',
    label: 'Semi-slick',
    gripMultiplier: 1.06,
    optimalPressurePsi: 30,
    optimalTemperatureC: 85,
  }),
  Object.freeze({
    id: 'slick',
    label: 'Slick',
    gripMultiplier: 1.12,
    optimalPressurePsi: 28,
    optimalTemperatureC: 100,
  }),
]);

export interface TireOperatingParameters {
  readonly compound: TireCompoundId;
  readonly pressurePsi: number;
  readonly temperatureC: number;
}

export const DEFAULT_TIRE_OPERATING_PARAMETERS: TireOperatingParameters = Object.freeze({
  compound: 'semi-slick',
  pressurePsi: 30,
  temperatureC: 85,
});

export const normalizeTireOperatingParameters = (
  current: TireOperatingParameters,
  next: Partial<TireOperatingParameters>,
): TireOperatingParameters => {
  const compound = TIRE_COMPOUNDS.some(candidate => candidate.id === next.compound)
    ? next.compound!
    : current.compound;
  return Object.freeze({
    compound,
    pressurePsi: clamp(next.pressurePsi ?? current.pressurePsi, 18, 45),
    temperatureC: clamp(next.temperatureC ?? current.temperatureC, 0, 140),
  });
};

export const tireOperatingScales = (parameters: TireOperatingParameters) => {
  const compound = TIRE_COMPOUNDS.find(candidate => candidate.id === parameters.compound)
    ?? TIRE_COMPOUNDS[0];
  const pressureDelta = parameters.pressurePsi - compound.optimalPressurePsi;
  const temperatureDelta = parameters.temperatureC - compound.optimalTemperatureC;
  const pressureGrip = clamp(1 - 0.006 * pressureDelta * pressureDelta, 0.78, 1);
  const temperatureGrip = clamp(
    1 - 0.00008 * temperatureDelta * temperatureDelta,
    0.72,
    1,
  );
  return Object.freeze({
    grip: compound.gripMultiplier * pressureGrip * temperatureGrip,
    stiffness: clamp(
      Math.sqrt(parameters.pressurePsi / compound.optimalPressurePsi),
      0.88,
      1.12,
    ),
    compound,
    pressureGrip,
    temperatureGrip,
  });
};

export interface ContactPatchSample {
  readonly wheelIndex: number;
  readonly verticalLoadN: number;
  readonly slipRatio: number;
  readonly slipAngleRadians: number;
  readonly forwardSpeedMps: number;
  readonly angularVelocityRadPerSecond: number;
  readonly wheelRadiusM: number;
  readonly surface: SurfaceProperties;
  readonly deltaTimeSeconds: number;
}

export interface TireForceState {
  readonly normalizedLongitudinalSlip: number;
  readonly normalizedLateralSlip: number;
  readonly combinedSlip: number;
  readonly adhesion: number;
  readonly pneumaticTrailM: number;
  readonly operatingGripScale: number;
  readonly pressureStiffnessScale: number;
}

export interface TireForces {
  readonly longitudinalForceN: number;
  readonly lateralForceN: number;
  readonly aligningMomentNm: number;
  readonly longitudinalCapacityN: number;
  readonly lateralCapacityN: number;
  readonly state: TireForceState;
}

export interface TireForceModel {
  readonly id: TireForceModelId;
  getOperatingParameters(): TireOperatingParameters;
  configureOperatingParameters(parameters: Partial<TireOperatingParameters>): void;
  evaluate(sample: ContactPatchSample): TireForces;
  reset(): void;
}

/**
 * Evalúa varios subparches derivados del único contacto geométrico que Jolt
 * entrega por rueda. La suma vuelve al callback como un solo límite de impulso,
 * de modo que Jolt sigue siendo el único responsable del contacto y del solver.
 */
export const evaluateContactPatches = (
  model: TireForceModel,
  sample: ContactPatchSample,
  patchesPerJoltContact: number,
): TireForces => {
  const patchCount = Math.max(1, Math.floor(patchesPerJoltContact));
  if (patchCount === 1) return model.evaluate(sample);

  const patchLoadN = sample.verticalLoadN / patchCount;
  const patchResults = Array.from({ length: patchCount }, () => model.evaluate({
    ...sample,
    verticalLoadN: patchLoadN,
  }));
  const longitudinalCapacityN = patchResults.reduce(
    (sum, result) => sum + result.longitudinalCapacityN,
    0,
  );
  const lateralCapacityN = patchResults.reduce(
    (sum, result) => sum + result.lateralCapacityN,
    0,
  );
  const weight = 1 / patchCount;

  return Object.freeze({
    longitudinalForceN: patchResults.reduce(
      (sum, result) => sum + result.longitudinalForceN,
      0,
    ),
    lateralForceN: patchResults.reduce(
      (sum, result) => sum + result.lateralForceN,
      0,
    ),
    aligningMomentNm: patchResults.reduce(
      (sum, result) => sum + result.aligningMomentNm,
      0,
    ),
    longitudinalCapacityN,
    lateralCapacityN,
    state: Object.freeze({
      normalizedLongitudinalSlip: patchResults.reduce(
        (sum, result) => sum + result.state.normalizedLongitudinalSlip * weight,
        0,
      ),
      normalizedLateralSlip: patchResults.reduce(
        (sum, result) => sum + result.state.normalizedLateralSlip * weight,
        0,
      ),
      combinedSlip: patchResults.reduce(
        (sum, result) => sum + result.state.combinedSlip * weight,
        0,
      ),
      adhesion: patchResults.reduce(
        (sum, result) => sum + result.state.adhesion * weight,
        0,
      ),
      pneumaticTrailM: patchResults.reduce(
        (sum, result) => sum + result.state.pneumaticTrailM * weight,
        0,
      ),
      operatingGripScale: patchResults.reduce(
        (sum, result) => sum + result.state.operatingGripScale * weight,
        0,
      ),
      pressureStiffnessScale: patchResults.reduce(
        (sum, result) => sum + result.state.pressureStiffnessScale * weight,
        0,
      ),
    }),
  });
};

export const clamp = (value: number, minimum: number, maximum: number) => (
  Math.max(minimum, Math.min(maximum, value))
);

export const loadSensitiveCapacity = (
  loadN: number,
  referenceLoadN: number,
  exponent: number,
  frictionCoefficient: number,
) => {
  const loadRatio = Math.max(0.02, loadN / referenceLoadN);
  return referenceLoadN * Math.pow(loadRatio, exponent) * frictionCoefficient;
};

export const combinedEnvelope = (
  longitudinalForceN: number,
  lateralForceN: number,
  longitudinalCapacityN: number,
  lateralCapacityN: number,
) => {
  const normalizedLongitudinal = longitudinalForceN
    / Math.max(1, longitudinalCapacityN);
  const normalizedLateral = lateralForceN / Math.max(1, lateralCapacityN);
  const demand = Math.hypot(normalizedLongitudinal, normalizedLateral);
  const scale = demand > 1 ? 1 / demand : 1;
  return {
    longitudinalForceN: longitudinalForceN * scale,
    lateralForceN: lateralForceN * scale,
    scale,
  };
};
