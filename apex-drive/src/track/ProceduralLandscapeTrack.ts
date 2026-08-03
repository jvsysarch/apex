import * as THREE from 'three/webgpu';
import type {
  ApexLandscapePreset,
  ApexProceduralRouteAlgorithm,
} from './landscape/ApexLandscapePresets';
import { sampleApexLandscapeNaturalHeight } from './landscape/ApexProceduralLandscape';

export interface ProceduralLandscapeTrackPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface GeneratedProceduralLandscapeTrack {
  readonly instanceId: string;
  readonly terrainSeed: number;
  readonly seed: number;
  readonly algorithm: ApexProceduralRouteAlgorithm;
  readonly points: readonly ProceduralLandscapeTrackPoint[];
  readonly controlPoints: readonly ProceduralLandscapeTrackPoint[];
  readonly worldSizeM: number;
  readonly approximateLengthM: number;
  readonly elevationRangeM: number;
  readonly maximumGrade: number;
  readonly dataReference: ApexLandscapePreset['route']['reference'];
}

const TAU = Math.PI * 2;
const MINIMUM_SEED = 1;
const MAXIMUM_SEED = 0x7ffffffe;

const normalizeSeed = (value: number): number => {
  if (!Number.isFinite(value)) return MINIMUM_SEED;
  const integer = Math.abs(Math.trunc(value));
  return Math.max(MINIMUM_SEED, integer % MAXIMUM_SEED);
};

const mulberry32 = (initialSeed: number): (() => number) => {
  let seed = normalizeSeed(initialSeed) >>> 0;
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296;
  };
};

interface Harmonic {
  readonly frequency: number;
  readonly amplitude: number;
  readonly phase: number;
}

const createHarmonics = (
  random: () => number,
  count: number,
  amplitude: number,
): readonly Harmonic[] => Object.freeze(Array.from(
  { length: count },
  (_, index) => Object.freeze({
    frequency: index + 2,
    amplitude: amplitude * (0.46 ** index) * (0.65 + random() * 0.7),
    phase: random() * TAU,
  }),
));

const harmonicValue = (
  angle: number,
  harmonics: readonly Harmonic[],
): number => harmonics.reduce(
  (value, harmonic) => value + Math.sin(
    angle * harmonic.frequency + harmonic.phase,
  ) * harmonic.amplitude,
  0,
);

const horizontalLength = (
  points: readonly ProceduralLandscapeTrackPoint[],
): number => points.reduce((length, point, index) => {
  const next = points[(index + 1) % points.length];
  return length + Math.hypot(next.x - point.x, next.z - point.z);
}, 0);

const scaleHorizontalLength = (
  points: readonly ProceduralLandscapeTrackPoint[],
  targetLengthM: number,
): ProceduralLandscapeTrackPoint[] => {
  const currentLengthM = Math.max(1, horizontalLength(points));
  const scale = targetLengthM / currentLengthM;
  return points.map(point => ({
    x: point.x * scale,
    y: point.y,
    z: point.z * scale,
  }));
};

const constrainGrades = (
  source: readonly ProceduralLandscapeTrackPoint[],
  maximumGrade: number,
): ProceduralLandscapeTrackPoint[] => {
  const points = source.map(point => ({ ...point }));
  for (let pass = 0; pass < 12; pass += 1) {
    for (let index = 0; index < points.length; index += 1) {
      const nextIndex = (index + 1) % points.length;
      const point = points[index];
      const next = points[nextIndex];
      const maximumDeltaM = Math.hypot(
        next.x - point.x,
        next.z - point.z,
      ) * maximumGrade;
      const deltaM = next.y - point.y;
      if (Math.abs(deltaM) <= maximumDeltaM) continue;
      const correctionM = (
        Math.abs(deltaM) - maximumDeltaM
      ) * Math.sign(deltaM) * 0.5;
      point.y += correctionM;
      next.y -= correctionM;
    }
  }
  return points;
};

const terrainSlopeAt = (
  preset: ApexLandscapePreset,
  x: number,
  z: number,
): number => {
  const radiusM = Math.max(8, preset.topology.detailScaleM * 0.09);
  const west = sampleApexLandscapeNaturalHeight(preset, x - radiusM, z);
  const east = sampleApexLandscapeNaturalHeight(preset, x + radiusM, z);
  const north = sampleApexLandscapeNaturalHeight(preset, x, z - radiusM);
  const south = sampleApexLandscapeNaturalHeight(preset, x, z + radiusM);
  return Math.hypot(
    (east - west) / (radiusM * 2),
    (south - north) / (radiusM * 2),
  );
};

/**
 * Desplaza el esquema 2D de la ruta hacia valles, collados y laderas suaves.
 * El terreno existe primero; estos controles sólo lo consultan y conservan una
 * penalización por alejarse del recorrido macroscópico de cada perfil.
 */
const fitControlsToLandscape = (
  preset: ApexLandscapePreset,
  anchors: readonly ProceduralLandscapeTrackPoint[],
): ProceduralLandscapeTrackPoint[] => {
  const searchRadiusM = preset.topology.macroScaleM * (
    preset.route.algorithm === 'mountain-switchbacks'
      ? 0.42
      : preset.route.algorithm === 'valley-pass'
        ? 0.34
        : 0.24
  );
  const elevationWeight = preset.route.algorithm === 'valley-pass'
    ? 1.15
    : preset.route.algorithm === 'mountain-switchbacks'
      ? 0.72
      : 0.18;
  const selected: ProceduralLandscapeTrackPoint[] = [];

  anchors.forEach((anchor, index) => {
    const previousAnchor = anchors[(index - 1 + anchors.length) % anchors.length];
    const expectedSegmentM = Math.max(
      1,
      Math.hypot(anchor.x - previousAnchor.x, anchor.z - previousAnchor.z),
    );
    let best: ProceduralLandscapeTrackPoint | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let row = -3; row <= 3; row += 1) {
      for (let column = -3; column <= 3; column += 1) {
        const x = anchor.x + column / 3 * searchRadiusM;
        const z = anchor.z + row / 3 * searchRadiusM;
        const y = sampleApexLandscapeNaturalHeight(preset, x, z) + 1.1;
        const displacement = Math.hypot(x - anchor.x, z - anchor.z)
          / searchRadiusM;
        const slope = terrainSlopeAt(preset, x, z);
        const normalizedHeight = Math.max(0, y)
          / Math.max(1, preset.topology.elevationM);
        let continuityCost = 0;
        const previous = selected[index - 1];
        if (previous) {
          const distanceM = Math.max(1, Math.hypot(
            x - previous.x,
            z - previous.z,
          ));
          const grade = Math.abs(y - previous.y) / distanceM;
          continuityCost += Math.abs(distanceM - expectedSegmentM)
            / expectedSegmentM * 0.42;
          continuityCost += Math.max(
            0,
            grade / preset.route.maximumGrade - 0.72,
          ) * 2.8;
        }
        const score = (
          slope / preset.route.maximumGrade * 2.6
          + normalizedHeight * elevationWeight
          + displacement ** 1.6 * 0.9
          + continuityCost
        );
        if (score >= bestScore) continue;
        bestScore = score;
        best = { x, y, z };
      }
    }
    selected.push(best ?? {
      x: anchor.x,
      y: sampleApexLandscapeNaturalHeight(preset, anchor.x, anchor.z) + 1.1,
      z: anchor.z,
    });
  });

  const horizontallySmoothed = selected.map((point, index) => {
    const previous = selected[(index - 1 + selected.length) % selected.length];
    const next = selected[(index + 1) % selected.length];
    return {
      x: point.x * 0.72 + (previous.x + next.x) * 0.14,
      y: point.y,
      z: point.z * 0.72 + (previous.z + next.z) * 0.14,
    };
  });
  return horizontallySmoothed.map(point => ({
    x: point.x,
    y: sampleApexLandscapeNaturalHeight(preset, point.x, point.z) + 1.1,
    z: point.z,
  }));
};

const createValleyPassControls = (
  preset: ApexLandscapePreset,
  random: () => number,
): ProceduralLandscapeTrackPoint[] => {
  const count = preset.route.controlPointCount;
  const lateralNoise = createHarmonics(random, 4, 46);
  const widthNoise = createHarmonics(random, 3, 0.15);
  const longitudinalNoise = createHarmonics(random, 3, 24);
  const elevationNoise = createHarmonics(random, 3, 0.12);
  return Array.from({ length: count }, (_, index) => {
    const angle = index / count * TAU;
    const valleyProgress = (1 - Math.cos(angle)) * 0.5;
    const halfWidthM = 145 * (
      1 + harmonicValue(angle, widthNoise) * preset.route.turnVariation
    );
    return {
      x: Math.sin(angle) * halfWidthM
        + harmonicValue(angle, lateralNoise) * preset.route.turnVariation,
      z: Math.cos(angle) * 570
        + harmonicValue(angle, longitudinalNoise),
      y: valleyProgress + harmonicValue(angle, elevationNoise),
    };
  });
};

const createMountainSwitchbackControls = (
  preset: ApexLandscapePreset,
  random: () => number,
): ProceduralLandscapeTrackPoint[] => {
  const count = preset.route.controlPointCount;
  const radialNoise = createHarmonics(random, 6, 0.2);
  const tangentNoise = createHarmonics(random, 5, 55);
  const elevationNoise = createHarmonics(random, 5, 0.3);
  const phase = random() * TAU;
  return Array.from({ length: count }, (_, index) => {
    const angle = index / count * TAU;
    const radiusM = 430 * (
      1 + harmonicValue(angle, radialNoise) * preset.route.turnVariation
    );
    const tangentOffsetM = harmonicValue(angle, tangentNoise)
      * preset.route.turnVariation;
    return {
      x: Math.cos(angle) * radiusM - Math.sin(angle) * tangentOffsetM,
      z: Math.sin(angle) * radiusM * 0.78
        + Math.cos(angle) * tangentOffsetM,
      y: Math.sin(angle + phase) * 0.54
        + Math.sin(angle * 2 - phase * 0.7) * 0.26
        + harmonicValue(angle, elevationNoise),
    };
  });
};

const createOpenSteppeControls = (
  preset: ApexLandscapePreset,
  random: () => number,
): ProceduralLandscapeTrackPoint[] => {
  const count = preset.route.controlPointCount;
  const sweepNoise = createHarmonics(random, 3, 0.11);
  const crosswindNoise = createHarmonics(random, 3, 28);
  const elevationNoise = createHarmonics(random, 3, 0.18);
  const phase = random() * TAU;
  return Array.from({ length: count }, (_, index) => {
    const angle = index / count * TAU;
    const radialScale = 1 + harmonicValue(angle, sweepNoise)
      * preset.route.turnVariation;
    return {
      x: Math.cos(angle) * 545 * radialScale
        + harmonicValue(angle, crosswindNoise),
      z: Math.sin(angle) * 340 * radialScale,
      y: Math.sin(angle + phase) * 0.48
        + Math.sin(angle * 2 - phase) * 0.14
        + harmonicValue(angle, elevationNoise),
    };
  });
};

const createControls = (
  preset: ApexLandscapePreset,
  random: () => number,
): ProceduralLandscapeTrackPoint[] => {
  switch (preset.route.algorithm) {
    case 'valley-pass': return createValleyPassControls(preset, random);
    case 'mountain-switchbacks': return createMountainSwitchbackControls(
      preset,
      random,
    );
    case 'open-steppe': return createOpenSteppeControls(preset, random);
  }
};

const actualMaximumGrade = (
  points: readonly ProceduralLandscapeTrackPoint[],
): number => points.reduce((maximum, point, index) => {
  const next = points[(index + 1) % points.length];
  const distanceM = Math.hypot(next.x - point.x, next.z - point.z);
  return Math.max(
    maximum,
    distanceM > 0 ? Math.abs(next.y - point.y) / distanceM : 0,
  );
}, 0);

export const resolveApexProceduralRouteSeed = (
  preset: ApexLandscapePreset,
): number => {
  if (typeof window === 'undefined') return preset.route.defaultSeed;
  const requested = Number(
    new URLSearchParams(window.location.search).get('routeSeed'),
  );
  return Number.isInteger(requested) && requested > 0
    ? normalizeSeed(requested)
    : preset.route.defaultSeed;
};

export const createApexProceduralRouteSeed = (): number => {
  const values = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
    return normalizeSeed(values[0]);
  }
  return normalizeSeed(Date.now());
};

export const createApexProceduralTrackInstanceId = (
  preset: ApexLandscapePreset,
  seed: number,
): string => [
  'paisaje',
  preset.id,
  `t${normalizeSeed(preset.topology.seed).toString(36)}`,
  `r${normalizeSeed(seed).toString(36)}`,
].join('-');

export const generateApexProceduralLandscapeTrack = (
  preset: ApexLandscapePreset,
  requestedSeed: number,
): GeneratedProceduralLandscapeTrack => {
  const seed = normalizeSeed(requestedSeed);
  const random = mulberry32(seed + preset.route.defaultSeed);
  const unscaled = createControls(preset, random);
  const scaled = scaleHorizontalLength(unscaled, preset.route.targetLengthM);
  const terrainAware = fitControlsToLandscape(preset, scaled);
  const controls = constrainGrades(terrainAware, preset.route.maximumGrade);
  const curve = new THREE.CatmullRomCurve3(
    controls.map(point => new THREE.Vector3(point.x, point.y, point.z)),
    true,
    'centripetal',
    0.5,
  );
  const sampleCount = Math.max(
    controls.length * 8,
    Math.round(curve.getLength() / preset.route.sampleSpacingM),
  );
  const sampledUnique = curve.getSpacedPoints(sampleCount).slice(0, -1).map(
    point => ({ x: point.x, y: point.y, z: point.z }),
  );
  const constrainedSamples = constrainGrades(
    sampledUnique,
    preset.route.maximumGrade,
  );
  const points = Object.freeze([
    ...constrainedSamples.map(point => Object.freeze(point)),
    Object.freeze({ ...constrainedSamples[0] }),
  ]);
  const maximumExtentM = Math.max(
    ...points.map(point => Math.abs(point.x)),
    ...points.map(point => Math.abs(point.z)),
  );
  const elevationRangeM = Math.max(...points.map(point => point.y))
    - Math.min(...points.map(point => point.y));

  return Object.freeze({
    instanceId: createApexProceduralTrackInstanceId(preset, seed),
    terrainSeed: normalizeSeed(preset.topology.seed),
    seed,
    algorithm: preset.route.algorithm,
    points,
    controlPoints: Object.freeze(controls.map(point => Object.freeze(point))),
    worldSizeM: Math.ceil((maximumExtentM * 2 + 520) / 100) * 100,
    approximateLengthM: horizontalLength(constrainedSamples),
    elevationRangeM,
    maximumGrade: actualMaximumGrade(constrainedSamples),
    dataReference: preset.route.reference,
  });
};
