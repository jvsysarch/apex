import { AUTOPISTA_CUMBRE_TRACK } from './catalog/AutopistaCumbreDefinition';

export interface AutopistaCumbrePoint {
  readonly x: number;
  readonly z: number;
}

export const AUTOPISTA_CUMBRE_NUMBER = AUTOPISTA_CUMBRE_TRACK.track.number;
export const AUTOPISTA_CUMBRE_ID = AUTOPISTA_CUMBRE_TRACK.track.id;
export const AUTOPISTA_CUMBRE_NAME = AUTOPISTA_CUMBRE_TRACK.track.name;
export const AUTOPISTA_CUMBRE_VERSION = AUTOPISTA_CUMBRE_TRACK.track.version;
export const AUTOPISTA_CUMBRE_WIDTH_M = (
  AUTOPISTA_CUMBRE_TRACK.configuration.geometry.roadWidthM
);
export const AUTOPISTA_CUMBRE_LANE_COUNT = 3;
export const AUTOPISTA_CUMBRE_SAMPLE_SPACING_M = 30;
export const AUTOPISTA_CUMBRE_WORLD_SIZE_M = 4400;

// Trazado original inspirado en el ritmo de una prueba Horizon tipo Goliath:
// una vuelta de gran escala, no una reproducción de carreteras o curvas del
// juego. La línea empieza en (0, 0), orientada hacia -Z, para conservar la
// parrilla y los contratos de spawn de Apex Run.
const CONTROL_POINTS = [
  [0, 0],
  [0, -450],
  [0, -950],
  [30, -1400],
  [180, -1720],
  [500, -1900],
  [900, -1940],
  [1320, -1860],
  [1660, -1640],
  [1880, -1320],
  [1980, -930],
  [1990, -520],
  [1930, -120],
  [1760, 250],
  [1490, 540],
  [1150, 720],
  [780, 790],
  [420, 760],
  [130, 620],
  [-80, 380],
  [-170, 100],
  [-210, -210],
  [-320, -500],
  [-520, -720],
  [-800, -840],
  [-1110, -820],
  [-1410, -670],
  [-1660, -410],
  [-1810, -80],
  [-1840, 290],
  [-1750, 650],
  [-1520, 960],
  [-1200, 1190],
  [-820, 1330],
  [-420, 1340],
  [-70, 1240],
  [210, 1030],
  [350, 780],
  [300, 550],
  [150, 400],
  [0, 330],
] as const;

const catmullRomPoint = (
  previous: readonly [number, number],
  start: readonly [number, number],
  end: readonly [number, number],
  following: readonly [number, number],
  alpha: number,
): AutopistaCumbrePoint => {
  const alphaSquared = alpha * alpha;
  const alphaCubed = alphaSquared * alpha;
  const component = (index: 0 | 1) => 0.5 * (
    2 * start[index]
    + (-previous[index] + end[index]) * alpha
    + (
      2 * previous[index]
      - 5 * start[index]
      + 4 * end[index]
      - following[index]
    ) * alphaSquared
    + (
      -previous[index]
      + 3 * start[index]
      - 3 * end[index]
      + following[index]
    ) * alphaCubed
  );

  return { x: component(0), z: component(1) };
};

const interpolateControls = (): readonly AutopistaCumbrePoint[] => {
  const interpolated: AutopistaCumbrePoint[] = [];
  for (let index = 0; index < CONTROL_POINTS.length; index += 1) {
    const previous = CONTROL_POINTS[
      (index - 1 + CONTROL_POINTS.length) % CONTROL_POINTS.length
    ];
    const start = CONTROL_POINTS[index];
    const end = CONTROL_POINTS[(index + 1) % CONTROL_POINTS.length];
    const following = CONTROL_POINTS[(index + 2) % CONTROL_POINTS.length];
    const chordLengthM = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const subdivisions = Math.max(8, Math.ceil(chordLengthM / 8));
    for (let step = 0; step < subdivisions; step += 1) {
      interpolated.push(catmullRomPoint(
        previous,
        start,
        end,
        following,
        step / subdivisions,
      ));
    }
  }
  return interpolated;
};

const resampleClosedLine = (
  source: readonly AutopistaCumbrePoint[],
  targetSpacingM: number,
): readonly AutopistaCumbrePoint[] => {
  const segmentLengths = source.map((point, index) => {
    const next = source[(index + 1) % source.length];
    return Math.hypot(next.x - point.x, next.z - point.z);
  });
  const totalLengthM = segmentLengths.reduce((sum, length) => sum + length, 0);
  const sampleCount = Math.round(totalLengthM / targetSpacingM);
  const spacingM = totalLengthM / sampleCount;
  const result: AutopistaCumbrePoint[] = [];
  let segmentIndex = 0;
  let segmentStartDistanceM = 0;

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const targetDistanceM = sampleIndex * spacingM;
    while (
      segmentIndex < source.length - 1
      && segmentStartDistanceM + segmentLengths[segmentIndex] < targetDistanceM
    ) {
      segmentStartDistanceM += segmentLengths[segmentIndex];
      segmentIndex += 1;
    }
    const point = source[segmentIndex];
    const next = source[(segmentIndex + 1) % source.length];
    const segmentLengthM = Math.max(0.0001, segmentLengths[segmentIndex]);
    const mix = Math.max(
      0,
      Math.min(1, (targetDistanceM - segmentStartDistanceM) / segmentLengthM),
    );
    result.push(Object.freeze({
      x: point.x + (next.x - point.x) * mix,
      z: point.z + (next.z - point.z) * mix,
    }));
  }
  return result;
};

const uniquePoints = resampleClosedLine(
  interpolateControls(),
  AUTOPISTA_CUMBRE_SAMPLE_SPACING_M,
);

export const AUTOPISTA_CUMBRE_POINTS: readonly AutopistaCumbrePoint[] = (
  Object.freeze([
    ...uniquePoints,
    uniquePoints[0],
  ])
);

export const AUTOPISTA_CUMBRE_LENGTH_M = uniquePoints.reduce((length, point, index) => {
  const next = uniquePoints[(index + 1) % uniquePoints.length];
  return length + Math.hypot(next.x - point.x, next.z - point.z);
}, 0);

export const AUTOPISTA_CUMBRE_DESIGN = Object.freeze({
  inspiration: 'long-distance open-road festival circuit',
  laneCount: AUTOPISTA_CUMBRE_LANE_COUNT,
  roadWidthM: AUTOPISTA_CUMBRE_WIDTH_M,
  mainStraightM: 1400,
  typicalFastCurveRadiusM: 170,
  elevationVariationM: 34,
});
