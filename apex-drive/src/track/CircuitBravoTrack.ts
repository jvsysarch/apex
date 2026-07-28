import { CIRCUITO_BRAVO_TRACK } from './catalog/CircuitoBravoDefinition';

export interface CircuitBravoPoint {
  readonly x: number;
  readonly z: number;
}

export const CIRCUIT_BRAVO_NUMBER = CIRCUITO_BRAVO_TRACK.track.number;
export const CIRCUIT_BRAVO_ID = CIRCUITO_BRAVO_TRACK.track.id;
export const CIRCUIT_BRAVO_NAME = CIRCUITO_BRAVO_TRACK.track.name;
export const CIRCUIT_BRAVO_VERSION = CIRCUITO_BRAVO_TRACK.track.version;
export const CIRCUIT_BRAVO_WIDTH_M = (
  CIRCUITO_BRAVO_TRACK.configuration.geometry.roadWidthM
);
export const CIRCUIT_BRAVO_CHECKPOINT_INTERVAL = (
  CIRCUITO_BRAVO_TRACK.configuration.timing.checkpointIntervalPoints
);
const CIRCUIT_BRAVO_CAPTURE_CLOSURE_RADIUS_M = 9;
const CIRCUIT_BRAVO_SMOOTHING_PASSES = 2;
const CIRCUIT_BRAVO_SMOOTHING_STRENGTH = 0.09;
const CIRCUIT_BRAVO_MAX_SMOOTHING_DISPLACEMENT_M = 1.25;
const CIRCUIT_BRAVO_SAMPLE_SPACING_M = 6;

// Copia exacta de timedCircuit.centerLine en v2. No incluye cronómetro, HUD,
// assets, vehículos, físicas ni elementos de exploración de ese proyecto.
const SOURCE_POINTS = [
  [43.66,24.24],[44.8,24.95],[46.48,26.15],[48.91,27.87],[52.13,30.26],[55.94,33.57],[60.54,37.56],[65.81,42.2],[71.64,47.4],[78.15,53.31],[85.45,60.11],[93.59,67.86],[102.47,76.32],[111.96,85.4],[122.08,95.15],[132.98,105.75],[144.64,117.23],[157.01,129.52],[170.01,142.56],[183.55,156.25],[197.56,170.52],[211.92,185.24],[226.78,200.65],[242.67,217.31],[258.14,233.27],[274.73,250.01],[292.43,267.6],[310.12,284.85],[328.16,301.28],[347.69,317.77],[368.33,333.79],[390.07,349.35],[412.87,364.41],[436.37,379.33],[460.15,394.37],[480.01,407.69],[496.67,420.4],[511.48,433.92],[522.75,447.71],[531.83,463.58],[539.01,481.3],[545.65,501.34],[550.86,521.14],[555.07,542.41],[558.13,564.54],[560.09,588.26],[560.72,611.69],[560.97,620.82],[560.79,623.27],[560.3,626.46],[559.67,630.83],[558.44,636.39],[556.42,642.43],[553.2,649.18],[548.51,654.74],[543.28,657.98],[536.93,660.6],[531.03,660.77],[526.05,659.65],[522.66,657.41],[520.92,654.7],[519.04,651.81],[516.86,648.27],[514.65,643.44],[512.5,637.46],[510.26,630.29],[508.5,622.76],[506.86,613.49],[506.03,603.86],[505.47,593.91],[505.06,583.31],[504.52,571.51],[503.12,560.08],[501.26,550.16],[498.73,541.9],[495.45,533.96],[491.77,525.8],[487.61,517.11],[483.12,507.77],[478.16,497.89],[472.07,486.47],[466.24,476.31],[460.41,467.71],[454.47,459.75],[446.66,449.86],[446.5,449.62],[445.7,448.44],[444.25,446.34],[442.06,443.22],[439.18,439.55],[435.21,435.17],[430.01,430.63],[423.9,425.96],[416.61,421.3],[407.99,416.48],[397.67,412.38],[386.7,409.3],[375.01,407],[362.37,405.42],[348.93,404.52],[334.62,403.98],[319.29,403.96],[302.8,404.53],[285.89,405.73],[270.53,407.07],[257.02,408.03],[245.52,408.25],[236.49,408.44],[218.81,405.15],[195.56,400.17],[171.25,393.85],[146.85,386.36],[122.88,377.85],[100.09,368.29],[81.28,358.79],[63.86,348.2],[50.09,338.03],[37.66,326.72],[27.22,314.25],[20.34,301.84],[16.21,288.86],[15.2,275.28],[17.3,262.78],[21.78,249.28],[26.09,233.46],[28.5,218.81],[29.06,203.26],[27.18,189.38],[22.9,177.59],[16.1,167.1],[8.14,159.62],[-1.1,154.84],[-12.05,151.64],[-22.21,147.91],[-33.49,143.31],[-45.71,137.35],[-57.73,130.51],[-69.68,122.99],[-81.39,114],[-90,104.53],[-95.4,94.54],[-97.68,84.61],[-97.16,76.31],[-94.24,69.86],[-88.78,65.27],[-81.68,63.3],[-73.2,60.93],[-62.39,57.61],[-51.96,53.45],[-43.06,47.54],[-36.57,40.53],[-30.72,34.74],[-25.24,29.81],[-20.65,26.31],[-16.48,23.56],[-12.93,21.29],[-9.92,19.4],[-6.33,17.26],[-1.85,15.8],[2.55,14.6],[7.44,14.08],[12.93,13.37],[17.7,13.91],[21.09,14.34],[23.4,14.69],[24.72,14.89],[26.41,15.28],[29,16.08],[31.5,17.9],[34.04,19.72],[36.31,20.67],[37.77,21.19],[38.67,21.54],[39.84,22.02],[40.91,22.47],[41.89,22.88],[42.9,23.32],[43.94,23.77],[44.93,24.22],[45.9,24.67],[46.88,25.13],[47.87,25.6],
] as const;

const [sourceStartX, sourceStartZ] = SOURCE_POINTS[0];
const [sourceNextX, sourceNextZ] = SOURCE_POINTS[1];
const sourceHeading = Math.atan2(sourceNextZ - sourceStartZ, sourceNextX - sourceStartX);
const rotation = -Math.PI / 2 - sourceHeading;
const rotationCos = Math.cos(rotation);
const rotationSin = Math.sin(rotation);

const placeAtV3Start = ([sourceX, sourceZ]: readonly [number, number]): CircuitBravoPoint => {
  const x = sourceX - sourceStartX;
  const z = sourceZ - sourceStartZ;
  return Object.freeze({
    x: x * rotationCos - z * rotationSin,
    z: x * rotationSin + z * rotationCos,
  });
};

const alignedPoints = SOURCE_POINTS.map(placeAtV3Start);
const lapFinishIndex = alignedPoints.findIndex((point, index) => (
  index > alignedPoints.length / 2
  && Math.hypot(point.x, point.z) <= CIRCUIT_BRAVO_CAPTURE_CLOSURE_RADIUS_M
));
const timedLapPoints = alignedPoints.slice(
  0,
  lapFinishIndex >= 0 ? lapFinishIndex + 1 : alignedPoints.length,
);

const smoothClosedLine = (
  source: readonly CircuitBravoPoint[],
): readonly CircuitBravoPoint[] => {
  let smoothed = source.map(point => ({ ...point }));

  for (let pass = 0; pass < CIRCUIT_BRAVO_SMOOTHING_PASSES; pass += 1) {
    smoothed = smoothed.map((point, index, points) => {
      const previous = points[(index - 1 + points.length) % points.length];
      const next = points[(index + 1) % points.length];
      const candidateX = (
        point.x * (1 - CIRCUIT_BRAVO_SMOOTHING_STRENGTH * 2)
        + (previous.x + next.x) * CIRCUIT_BRAVO_SMOOTHING_STRENGTH
      );
      const candidateZ = (
        point.z * (1 - CIRCUIT_BRAVO_SMOOTHING_STRENGTH * 2)
        + (previous.z + next.z) * CIRCUIT_BRAVO_SMOOTHING_STRENGTH
      );
      const sourcePoint = source[index];
      const displacementX = candidateX - sourcePoint.x;
      const displacementZ = candidateZ - sourcePoint.z;
      const displacement = Math.hypot(displacementX, displacementZ);
      const limitScale = displacement > CIRCUIT_BRAVO_MAX_SMOOTHING_DISPLACEMENT_M
        ? CIRCUIT_BRAVO_MAX_SMOOTHING_DISPLACEMENT_M / displacement
        : 1;

      return {
        x: sourcePoint.x + displacementX * limitScale,
        z: sourcePoint.z + displacementZ * limitScale,
      };
    });
  }

  // Conserva exactamente la posición y orientación de salida de la versión
  // anterior. Así el suavizado no altera la grilla, cámaras ni cronómetro.
  const desiredHeading = Math.atan2(
    source[1].z - source[0].z,
    source[1].x - source[0].x,
  );
  const smoothedHeading = Math.atan2(
    smoothed[1].z - smoothed[0].z,
    smoothed[1].x - smoothed[0].x,
  );
  const headingCorrection = desiredHeading - smoothedHeading;
  const headingCos = Math.cos(headingCorrection);
  const headingSin = Math.sin(headingCorrection);
  const origin = smoothed[0];

  return smoothed.map(point => {
    const x = point.x - origin.x;
    const z = point.z - origin.z;
    return {
      x: x * headingCos - z * headingSin,
      z: x * headingSin + z * headingCos,
    };
  });
};

const resampleClosedLine = (
  source: readonly CircuitBravoPoint[],
  targetSpacingM: number,
): readonly CircuitBravoPoint[] => {
  const segmentLengths = source.map((point, index) => {
    const next = source[(index + 1) % source.length];
    return Math.hypot(next.x - point.x, next.z - point.z);
  });
  const totalLengthM = segmentLengths.reduce((sum, length) => sum + length, 0);
  const sampleCount = Math.max(
    source.length,
    Math.round(totalLengthM / targetSpacingM),
  );
  const spacingM = totalLengthM / sampleCount;
  const result: CircuitBravoPoint[] = [];
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
    const segmentLength = Math.max(segmentLengths[segmentIndex], 0.0001);
    const alpha = Math.min(
      1,
      Math.max(0, (targetDistanceM - segmentStartDistanceM) / segmentLength),
    );
    result.push(Object.freeze({
      x: point.x + (next.x - point.x) * alpha,
      z: point.z + (next.z - point.z) * alpha,
    }));
  }

  return result;
};

const smoothedTimedLapPoints = resampleClosedLine(
  smoothClosedLine(timedLapPoints),
  CIRCUIT_BRAVO_SAMPLE_SPACING_M,
);

// El grabador de v2 siguió tomando muestras unos metros después de volver a
// entrar en la zona de meta. El cronómetro termina en ese primer cruce: cerrar
// allí evita superponer la llegada con el comienzo de la recta inicial.
export const CIRCUIT_BRAVO_POINTS: readonly CircuitBravoPoint[] = Object.freeze([
  ...smoothedTimedLapPoints,
  smoothedTimedLapPoints[0],
]);

export const CIRCUIT_BRAVO_SOURCE_POINT_COUNT = SOURCE_POINTS.length;
export const CIRCUIT_BRAVO_TIMED_POINT_COUNT = smoothedTimedLapPoints.length;
export const CIRCUIT_BRAVO_SMOOTHING = Object.freeze({
  algorithm: 'constrained-cyclic-laplacian',
  passes: CIRCUIT_BRAVO_SMOOTHING_PASSES,
  strength: CIRCUIT_BRAVO_SMOOTHING_STRENGTH,
  maximumDisplacementM: CIRCUIT_BRAVO_MAX_SMOOTHING_DISPLACEMENT_M,
  sampleSpacingM: CIRCUIT_BRAVO_SAMPLE_SPACING_M,
});
