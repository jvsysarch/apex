import * as THREE from 'three/webgpu';
import type { ApexLandscapePreset } from './ApexLandscapePresets';
import {
  createTrackShoulderProfile,
  resolveTrackAdaptiveRoadHalfWidthsM,
  solveTrackShoulderConfluences,
  type TrackShoulderPoint,
} from '../TrackShoulderSystem';

export interface ApexLandscapeRoadPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly bankRadians?: number;
}

interface ApexTrackFloorBoundaries {
  readonly left: readonly TrackShoulderPoint[];
  readonly right: readonly TrackShoulderPoint[];
}

interface ApexRoadProjection {
  readonly distanceM: number;
  readonly heightM: number;
  readonly lowestNearbyHeightM: number;
  readonly segmentIndex: number;
  readonly segmentMix: number;
  readonly closestX: number;
  readonly closestZ: number;
}

const fract = (value: number): number => value - Math.floor(value);

const hash2 = (x: number, z: number, seed: number): number => (
  fract(Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123)
);

const smooth = (value: number): number => value * value * (3 - 2 * value);

const valueNoise = (x: number, z: number, seed: number): number => {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(fract(x));
  const fz = smooth(fract(z));
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const north = a + (b - a) * fx;
  const south = c + (d - c) * fx;
  return (north + (south - north) * fz) * 2 - 1;
};

const fbm = (x: number, z: number, seed: number): number => {
  let value = 0;
  let amplitude = 0.58;
  let frequency = 1;
  for (let octave = 0; octave < 4; octave += 1) {
    value += valueNoise(x * frequency, z * frequency, seed + octave * 19)
      * amplitude;
    frequency *= 2.03;
    amplitude *= 0.48;
  }
  return value;
};

const smoothstep = (start: number, end: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

const smootherstep = (start: number, end: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

const rotateTerrainPoint = (
  x: number,
  z: number,
  seed: number,
): { cross: number; along: number } => {
  const angle = ((seed % 97) / 97 - 0.5) * 0.72;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    cross: x * cosine - z * sine,
    along: x * sine + z * cosine,
  };
};

/**
 * Campo geográfico puro. No conoce la ruta y puede ser consultado tanto por el
 * planificador como por el mesh. Esa frontera evita que la carretera termine
 * convirtiéndose en la cresta artificial de toda la topografía.
 */
export const sampleApexLandscapeNaturalHeight = (
  preset: ApexLandscapePreset,
  x: number,
  z: number,
  terrainSeed = 0,
): number => {
  const { topology } = preset;
  const effectiveSeed = topology.seed ^ Math.trunc(terrainSeed);
  const { cross, along } = rotateTerrainPoint(x, z, effectiveSeed);
  const macro = fbm(
    x / topology.macroScaleM,
    z / topology.macroScaleM,
    effectiveSeed,
  );
  const detail = fbm(
    x / topology.detailScaleM,
    z / topology.detailScaleM,
    effectiveSeed + 101,
  );
  const ridges = 1 - Math.abs(fbm(
    x / (topology.macroScaleM * 0.72),
    z / (topology.macroScaleM * 0.72),
    effectiveSeed + 211,
  ));

  if (preset.id === 'quebrada-andina') {
    const valleyCenterM = valueNoise(
      along / (topology.macroScaleM * 0.72),
      effectiveSeed * 0.013,
      effectiveSeed + 307,
    ) * topology.macroScaleM * 0.16;
    const valleyDistanceM = Math.abs(cross - valleyCenterM);
    const wall = smoothstep(
      topology.macroScaleM * 0.16,
      topology.macroScaleM * 0.92,
      valleyDistanceM,
    );
    return Math.max(-3, (
      0.05
      + wall * (0.58 + ridges ** 2.1 * topology.ridgeStrength * 0.52)
      + macro * 0.12
      + detail * (0.035 + wall * 0.075)
    ) * topology.elevationM);
  }

  if (preset.id === 'sierras-de-altura') {
    const warpM = macro * topology.macroScaleM * 0.23;
    const cordonWave = 0.5 + 0.5 * Math.cos(
      (cross + warpM) / topology.macroScaleM * Math.PI * 1.85,
    );
    const cordons = cordonWave ** 2.25;
    const drainage = 0.5 + 0.5 * valueNoise(
      along / (topology.macroScaleM * 0.58),
      cross / (topology.macroScaleM * 1.4),
      effectiveSeed + 401,
    );
    return Math.max(-2, (
      0.08
      + cordons * (0.44 + ridges ** 1.8 * topology.ridgeStrength * 0.42)
      + macro * 0.17
      + detail * 0.07
      - drainage * 0.08
    ) * topology.elevationM);
  }

  const distantMassif = smoothstep(
    topology.macroScaleM * 0.12,
    topology.macroScaleM * 1.35,
    along,
  );
  return Math.max(-2, (
    0.08
    + macro * 0.18
    + detail * 0.055
    + ridges ** 2.2 * topology.ridgeStrength * (0.12 + distantMassif * 0.58)
    + distantMassif * 0.18
  ) * topology.elevationM);
};

const nearestRoad = (
  x: number,
  z: number,
  roadPoints: readonly ApexLandscapeRoadPoint[],
  closed = true,
): ApexRoadProjection => {
  let distanceSquared = Number.POSITIVE_INFINITY;
  let heightM = 0;
  let segmentIndex = 0;
  let segmentMix = 0;
  let closestX = roadPoints[0]?.x ?? 0;
  let closestZ = roadPoints[0]?.z ?? 0;
  // La distancia a puntos salteados deja triángulos del terreno cruzando una
  // curva o un paso bajo. Proyectar contra cada segmento conserva la franja de
  // excavación aunque la grilla sea más gruesa que el muestreo de la pista.
  const segmentCount = closed ? roadPoints.length : roadPoints.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const start = roadPoints[index];
    const end = roadPoints[(index + 1) % roadPoints.length];
    const segmentX = end.x - start.x;
    const segmentZ = end.z - start.z;
    const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
    if (lengthSquared < 0.0001) continue;
    const mix = Math.max(0, Math.min(1, (
      (x - start.x) * segmentX + (z - start.z) * segmentZ
    ) / lengthSquared));
    const candidateClosestX = start.x + segmentX * mix;
    const candidateClosestZ = start.z + segmentZ * mix;
    const candidate = (x - candidateClosestX) ** 2
      + (z - candidateClosestZ) ** 2;
    const candidateHeightM = start.y + (end.y - start.y) * mix;
    if (candidate < distanceSquared) {
      distanceSquared = candidate;
      heightM = candidateHeightM;
      segmentIndex = index;
      segmentMix = mix;
      closestX = candidateClosestX;
      closestZ = candidateClosestZ;
    }
  }
  // Una segunda pasada resuelve cruces realmente coincidentes. Antes se usaba
  // cualquier tramo dentro de 42 m: una horquilla profunda excavaba también
  // la recta vecina y producía los grandes cañones rectangulares de Drive.
  const nearestDistanceM = Math.sqrt(distanceSquared);
  const overlapToleranceM = 1.25;
  let lowestNearbyHeightM = heightM;
  let selectedDistanceM = nearestDistanceM;
  for (let index = 0; index < segmentCount; index += 1) {
    const start = roadPoints[index];
    const end = roadPoints[(index + 1) % roadPoints.length];
    const segmentX = end.x - start.x;
    const segmentZ = end.z - start.z;
    const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
    if (lengthSquared < 0.0001) continue;
    const mix = Math.max(0, Math.min(1, (
      (x - start.x) * segmentX + (z - start.z) * segmentZ
    ) / lengthSquared));
    const candidateClosestX = start.x + segmentX * mix;
    const candidateClosestZ = start.z + segmentZ * mix;
    const candidateDistanceM = Math.hypot(
      x - candidateClosestX,
      z - candidateClosestZ,
    );
    if (candidateDistanceM > nearestDistanceM + overlapToleranceM) continue;
    const candidateHeightM = start.y + (end.y - start.y) * mix;
    if (candidateHeightM < lowestNearbyHeightM) {
      lowestNearbyHeightM = candidateHeightM;
      heightM = candidateHeightM;
      segmentIndex = index;
      segmentMix = mix;
      closestX = candidateClosestX;
      closestZ = candidateClosestZ;
      selectedDistanceM = candidateDistanceM;
    }
  }
  return {
    distanceM: selectedDistanceM,
    heightM,
    lowestNearbyHeightM,
    segmentIndex,
    segmentMix,
    closestX,
    closestZ,
  };
};

const pointAtRoadProjection = <Point extends ApexLandscapeRoadPoint>(
  points: readonly Point[],
  projection: ApexRoadProjection,
): ApexLandscapeRoadPoint => {
  const start = points[Math.min(projection.segmentIndex, points.length - 1)];
  const end = points[(projection.segmentIndex + 1) % points.length] ?? start;
  return {
    x: start.x + (end.x - start.x) * projection.segmentMix,
    y: start.y + (end.y - start.y) * projection.segmentMix,
    z: start.z + (end.z - start.z) * projection.segmentMix,
  };
};

/**
 * Perfil transversal del corte plano. La profundidad regula el ancho de la
 * transición para que una pista enterrada no genere una pared casi vertical,
 * pero el alcance queda limitado a una franja local.
 */
export const sampleApexFlatRoadCorridorHeight = (
  x: number,
  z: number,
  groundHeightM: number,
  roadPoints: readonly ApexLandscapeRoadPoint[],
  roadWidthM: number,
  closed: boolean,
  cellSizeM: number,
  progressiveRoadPoints: readonly ApexLandscapeRoadPoint[] = roadPoints,
  floorBoundaries?: ApexTrackFloorBoundaries,
): number => {
  const road = nearestRoad(x, z, roadPoints, closed);
  const progressiveRoadHeightM = progressiveRoadPoints === roadPoints
    ? road.lowestNearbyHeightM
    : pointAtRoadProjection(progressiveRoadPoints, road).y;
  const roadHalfWidthM = roadWidthM * 0.5;
  const shoulderReachM = Math.max(
    10,
    Math.min(16, roadWidthM * 0.85),
  );
  const banquinaWidthM = shoulderReachM * 0.24;
  const maximumShoulderChangeM = (
    shoulderReachM - banquinaWidthM
  ) * 0.42;
  const roadHeightM = road.lowestNearbyHeightM;
  const projectedLeft = floorBoundaries
    ? pointAtRoadProjection(floorBoundaries.left, road)
    : undefined;
  const projectedRight = floorBoundaries
    ? pointAtRoadProjection(floorBoundaries.right, road)
    : undefined;
  const boundaryProjection = projectedLeft && projectedRight
    ? (() => {
      const leftX = projectedLeft.x - road.closestX;
      const leftZ = projectedLeft.z - road.closestZ;
      const rightX = projectedRight.x - road.closestX;
      const rightZ = projectedRight.z - road.closestZ;
      const leftLengthM = Math.hypot(leftX, leftZ) || 1;
      const rightLengthM = Math.hypot(rightX, rightZ) || 1;
      const sampleX = x - road.closestX;
      const sampleZ = z - road.closestZ;
      const leftDistanceAlongM = (
        sampleX * leftX + sampleZ * leftZ
      ) / leftLengthM;
      const rightDistanceAlongM = (
        sampleX * rightX + sampleZ * rightZ
      ) / rightLengthM;
      return leftDistanceAlongM >= rightDistanceAlongM
        ? {
          point: projectedLeft,
          radiusM: leftLengthM,
          distanceAlongM: leftDistanceAlongM,
        }
        : {
          point: projectedRight,
          radiusM: rightLengthM,
          distanceAlongM: rightDistanceAlongM,
        };
    })()
    : undefined;
  const toeHeightM = boundaryProjection?.point.y ?? (
    roadHeightM + Math.max(
      -maximumShoulderChangeM,
      Math.min(
        maximumShoulderChangeM,
        groundHeightM - roadHeightM,
      ),
    )
  );
  const toeDistanceM = roadHalfWidthM + shoulderReachM;
  const clearanceM = 0.9;
  const roadFloorHeightM = Math.min(
    roadHeightM,
    progressiveRoadHeightM,
  ) - clearanceM;
  // El piso ya se recorta geometricamente y no necesita ocultarse debajo del
  // talud. Toe y piso comparten exactamente la misma altura de costura.
  const seamHeightM = toeHeightM;
  // The toe chosen by the shoulder solver is authoritative. A single stable
  // projection keeps floor and slope on the same branch of a tight curve.
  if (boundaryProjection) {
    const signedDistanceFromJoinM = (
      boundaryProjection.distanceAlongM - boundaryProjection.radiusM
    );
    if (signedDistanceFromJoinM <= 0) {
      const desiredClearanceEndM = roadHalfWidthM + Math.max(
        1.25,
        banquinaWidthM * 0.85,
        cellSizeM * 0.5,
      );
      const supportClearanceEndM = Math.min(
        desiredClearanceEndM,
        boundaryProjection.radiusM * 0.82,
      );
      const shoulderMix = smootherstep(
        supportClearanceEndM,
        boundaryProjection.radiusM,
        boundaryProjection.distanceAlongM,
      );
      return roadFloorHeightM
        + (seamHeightM - roadFloorHeightM) * shoulderMix;
    }
    const remainingHeightM = groundHeightM - seamHeightM;
    if (Math.abs(remainingHeightM) <= 0.001) return groundHeightM;
    const transitionWidthM = Math.min(
      30,
      Math.max(
        8,
        roadWidthM * 0.65,
        cellSizeM * 2,
        Math.abs(remainingHeightM) * 2.1,
      ),
    );
    const corridorMix = smootherstep(
      0,
      transitionWidthM,
      signedDistanceFromJoinM,
    );
    return seamHeightM + (groundHeightM - seamHeightM) * corridorMix;
  }
  if (road.distanceM <= toeDistanceM) {
    const supportClearanceEndM = roadHalfWidthM + Math.max(
      1.25,
      banquinaWidthM * 0.85,
      cellSizeM * 0.5,
    );
    const shoulderMix = smootherstep(
      supportClearanceEndM,
      toeDistanceM,
      road.distanceM,
    );
    return roadFloorHeightM
      + (seamHeightM - roadFloorHeightM) * shoulderMix;
  }
  const remainingHeightM = groundHeightM - seamHeightM;
  if (Math.abs(remainingHeightM) <= 0.001) return groundHeightM;
  const transitionWidthM = Math.min(
    30,
    Math.max(
      8,
      roadWidthM * 0.65,
      cellSizeM * 2,
      Math.abs(remainingHeightM) * 2.1,
    ),
  );
  const distanceFromJoinM = Math.max(0, road.distanceM - toeDistanceM);
  const corridorMix = smootherstep(0, transitionWidthM, distanceFromJoinM);
  return seamHeightM + (groundHeightM - seamHeightM) * corridorMix;
};

const createProgressiveCorridorRoadPoints = (
  roadPoints: readonly ApexLandscapeRoadPoint[],
  closed: boolean,
  maximumLongitudinalGrade = 0.22,
): readonly ApexLandscapeRoadPoint[] => {
  if (roadPoints.length < 3) return roadPoints;
  const heights = roadPoints.map(point => point.y);
  const segmentCount = closed ? roadPoints.length : roadPoints.length - 1;
  // Calcula la envolvente inferior con pendiente limitada. Nunca levanta el
  // fondo sobre la pista: extiende el descenso antes del tramo enterrado y la
  // recuperación después, evitando un canal de profundidad constante con tapas.
  for (let pass = 0; pass < roadPoints.length; pass += 1) {
    let changed = false;
    for (let index = 0; index < segmentCount; index += 1) {
      const next = (index + 1) % roadPoints.length;
      const distanceM = Math.hypot(
        roadPoints[next].x - roadPoints[index].x,
        roadPoints[next].z - roadPoints[index].z,
      );
      const maximumChangeM = Math.max(0.01, distanceM)
        * maximumLongitudinalGrade;
      const nextLimitM = heights[index] + maximumChangeM;
      if (heights[next] > nextLimitM + 1e-6) {
        heights[next] = nextLimitM;
        changed = true;
      }
      const currentLimitM = heights[next] + maximumChangeM;
      if (heights[index] > currentLimitM + 1e-6) {
        heights[index] = currentLimitM;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return Object.freeze(roadPoints.map((point, index) => Object.freeze({
    ...point,
    y: heights[index],
  })));
};

const createTrackFloorBoundaries = (
  roadPoints: readonly ApexLandscapeRoadPoint[],
  roadWidthM: number,
  shoulderWidthM: number,
  groundHeightM: number,
  closed: boolean,
): ApexTrackFloorBoundaries => {
  const roadHalfWidthsM = resolveTrackAdaptiveRoadHalfWidthsM(
    roadPoints,
    roadWidthM,
    closed,
  );
  let distanceM = 0;
  const frames = roadPoints.map((point, index) => {
    const previous = roadPoints[
      closed
        ? (index - 1 + roadPoints.length) % roadPoints.length
        : Math.max(0, index - 1)
    ];
    const next = roadPoints[
      closed
        ? (index + 1) % roadPoints.length
        : Math.min(roadPoints.length - 1, index + 1)
    ];
    if (index > 0) {
      const prior = roadPoints[index - 1];
      distanceM += Math.hypot(
        point.x - prior.x,
        point.y - prior.y,
        point.z - prior.z,
      );
    }
    const center = new THREE.Vector3(point.x, point.y, point.z);
    const forward = new THREE.Vector3(
      next.x - previous.x,
      next.y - previous.y,
      next.z - previous.z,
    ).normalize();
    const horizontalLeft = new THREE.Vector3(
      -forward.z,
      0,
      forward.x,
    ).normalize();
    const surfaceLeft = horizontalLeft.clone().applyAxisAngle(
      forward,
      point.bankRadians ?? 0,
    );
    const halfWidthM = roadHalfWidthsM[index];
    const innerLeft = center.clone().addScaledVector(surfaceLeft, halfWidthM);
    const innerRight = center.clone().addScaledVector(surfaceLeft, -halfWidthM);
    const profile = createTrackShoulderProfile({
      center,
      innerLeft,
      innerRight,
      horizontalLeftX: horizontalLeft.x,
      horizontalLeftZ: horizontalLeft.z,
      roadWidthM: halfWidthM * 2,
      shoulderWidthM,
      groundHeightM,
      progress: index / Math.max(1, roadPoints.length - 1),
      adaptiveTerrain: true,
    });
    return {
      center: point,
      innerLeft: profile.left[0],
      innerRight: profile.right[0],
      profile,
      distanceM,
    };
  });
  const solution = solveTrackShoulderConfluences(
    frames,
    roadWidthM,
    { closed },
  );
  const left = solution.profiles.map(profile => profile.left[5]);
  const right = solution.profiles.map(profile => profile.right[5]);
  // En un patch interior la curva calculada es la frontera real, no el toe
  // regular. El piso debe soldarse exactamente a esa misma curva.
  for (const patch of solution.adaptivePatches) {
    patch.outerIndices.forEach((sourceIndex, boundaryIndex) => {
      if (patch.side === 'left') left[sourceIndex] = patch.curvatureBoundary[boundaryIndex];
      else right[sourceIndex] = patch.curvatureBoundary[boundaryIndex];
    });
  }
  return Object.freeze({
    left: Object.freeze(left),
    right: Object.freeze(right),
  });
};

/**
 * Piso plano con una zanja suave bajo la calzada. Se usa sólo en terreno
 * adaptativo: evita que el piso global atraviese una pista que baja de Y=0 sin
 * convertir el resto del mundo en una malla de terreno de gran alcance.
 */
export const createApexAdaptiveTrackFloorGeometry = (
  worldSizeM: number,
  groundHeightM: number,
  roadPoints: readonly ApexLandscapeRoadPoint[],
  roadWidthM: number,
  shoulderWidthM: number,
  closed: boolean,
  targetCellSizeM = 8,
  textureSizeM = 14,
): THREE.BufferGeometry => {
  const segments = Math.max(
    48,
    Math.min(192, Math.ceil(worldSizeM / Math.max(6, targetCellSizeM))),
  );
  const halfSizeM = worldSizeM * 0.5;
  const stepM = worldSizeM / segments;
  const progressiveRoadPoints = createProgressiveCorridorRoadPoints(
    roadPoints,
    closed,
  );
  const floorBoundaries = createTrackFloorBoundaries(
    roadPoints,
    roadWidthM,
    shoulderWidthM,
    groundHeightM,
    closed,
  );
  // La grilla lejana permanece liviana. Cerca del corredor cada celda se
  // divide 4x y la corona vecina 2x; los bordes usan el máximo nivel de ambos
  // vecinos, por lo que no aparecen T-junctions ni grietas entre resoluciones.
  const refinementLevels = new Uint8Array(segments * segments);
  for (let row = 0; row < segments; row += 1) {
    const z = -halfSizeM + (row + 0.5) * stepM;
    for (let column = 0; column < segments; column += 1) {
      const x = -halfSizeM + (column + 0.5) * stepM;
      const distanceFromJoinM = Math.min(
        nearestRoad(x, z, floorBoundaries.left, closed).distanceM,
        nearestRoad(x, z, floorBoundaries.right, closed).distanceM,
      );
      refinementLevels[row * segments + column] = distanceFromJoinM <= 14
        ? 4
        : distanceFromJoinM <= 42 ? 2 : 1;
    }
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const vertexByCoordinate = new Map<string, number>();
  const localHeightCellSizeM = Math.min(3.5, stepM * 0.5);
  const vertexAt = (x: number, z: number, heightOverrideM?: number): number => {
    const key = `${x.toFixed(6)}:${z.toFixed(6)}`;
    const existing = vertexByCoordinate.get(key);
    if (existing !== undefined) {
      if (heightOverrideM !== undefined) {
        positions[existing * 3 + 1] = heightOverrideM;
      }
      return existing;
    }
    const index = positions.length / 3;
    positions.push(
      x,
      heightOverrideM ?? sampleApexFlatRoadCorridorHeight(
          x,
          z,
          groundHeightM,
          roadPoints,
          roadWidthM,
          closed,
          localHeightCellSizeM,
          progressiveRoadPoints,
          floorBoundaries,
        ),
      z,
    );
    // Same world-space projection as the shoulder mesh. Keeping the sign and
    // scale identical removes the visible texture seam at the shared toe.
    uvs.push(x / textureSizeM, -z / textureSizeM);
    vertexByCoordinate.set(key, index);
    return index;
  };
  const levelAt = (row: number, column: number): number => {
    if (row < 0 || row >= segments || column < 0 || column >= segments) return 1;
    return refinementLevels[row * segments + column];
  };
  interface DelaunayPoint {
    readonly x: number;
    readonly z: number;
    readonly vertex: number;
  }
  interface DelaunayTriangle {
    readonly a: number;
    readonly b: number;
    readonly c: number;
  }
  interface FloorClipPoint {
    readonly vertex: number;
    readonly x: number;
    readonly z: number;
    readonly signedDistanceM: number;
  }
  const nearestFloorBoundaryProjection = (
    x: number,
    z: number,
    boundary: readonly TrackShoulderPoint[],
  ): ApexRoadProjection => {
    let distanceSquared = Number.POSITIVE_INFINITY;
    let segmentIndex = 0;
    let segmentMix = 0;
    let closestX = boundary[0]?.x ?? 0;
    let closestZ = boundary[0]?.z ?? 0;
    let heightM = boundary[0]?.y ?? groundHeightM;
    const segmentCount = closed ? boundary.length : boundary.length - 1;
    for (let index = 0; index < segmentCount; index += 1) {
      const start = boundary[index];
      const end = boundary[(index + 1) % boundary.length];
      const segmentX = end.x - start.x;
      const segmentZ = end.z - start.z;
      const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
      if (lengthSquared < 1e-8) continue;
      const mix = Math.max(0, Math.min(1, (
        (x - start.x) * segmentX + (z - start.z) * segmentZ
      ) / lengthSquared));
      const projectedX = start.x + segmentX * mix;
      const projectedZ = start.z + segmentZ * mix;
      const candidateDistanceSquared = (x - projectedX) ** 2
        + (z - projectedZ) ** 2;
      if (candidateDistanceSquared >= distanceSquared) continue;
      distanceSquared = candidateDistanceSquared;
      segmentIndex = index;
      segmentMix = mix;
      closestX = projectedX;
      closestZ = projectedZ;
      heightM = start.y + (end.y - start.y) * mix;
    }
    return {
      distanceM: Math.sqrt(distanceSquared),
      heightM,
      lowestNearbyHeightM: heightM,
      segmentIndex,
      segmentMix,
      closestX,
      closestZ,
    };
  };
  const signedDistanceFromBoundary = (
    x: number,
    z: number,
    boundary: readonly TrackShoulderPoint[],
  ): number => {
    const projectedBoundary = nearestFloorBoundaryProjection(x, z, boundary);
    const roadCenter = pointAtRoadProjection(roadPoints, projectedBoundary);
    const outwardX = projectedBoundary.closestX - roadCenter.x;
    const outwardZ = projectedBoundary.closestZ - roadCenter.z;
    const outwardLengthM = Math.hypot(outwardX, outwardZ);
    if (outwardLengthM < 1e-4) return -projectedBoundary.distanceM;
    return (
      (x - projectedBoundary.closestX) * outwardX
      + (z - projectedBoundary.closestZ) * outwardZ
    ) / outwardLengthM;
  };
  const boundaryHeightAt = (x: number, z: number): number => {
    const left = nearestFloorBoundaryProjection(x, z, floorBoundaries.left);
    const right = nearestFloorBoundaryProjection(x, z, floorBoundaries.right);
    return left.distanceM <= right.distanceM ? left.heightM : right.heightM;
  };
  // Distancia firmada directamente a las dos polilineas del toe. A diferencia
  // del offset medido desde el eje, su isocurva cero coincide exactamente con
  // los segmentos que dibuja el talud, tambien dentro de curvas cerradas.
  const signedDistanceFromShoulderCorridor = (x: number, z: number): number => {
    const beyondLeftM = signedDistanceFromBoundary(
      x,
      z,
      floorBoundaries.left,
    );
    const beyondRightM = signedDistanceFromBoundary(
      x,
      z,
      floorBoundaries.right,
    );
    return Math.max(beyondLeftM, beyondRightM);
  };
  let removedFloorTriangleCount = 0;
  let clippedFloorTriangleCount = 0;
  let emittedFloorTriangleCount = 0;
  const signedDistanceByVertex: number[] = [];
  const clipPointAtVertex = (vertex: number): FloorClipPoint => {
    const x = positions[vertex * 3];
    const z = positions[vertex * 3 + 2];
    const cachedDistanceM = signedDistanceByVertex[vertex];
    const signedDistanceM = cachedDistanceM ?? signedDistanceFromShoulderCorridor(x, z);
    signedDistanceByVertex[vertex] = signedDistanceM;
    return {
      vertex,
      x,
      z,
      signedDistanceM,
    };
  };
  const boundaryIntersection = (
    from: FloorClipPoint,
    to: FloorClipPoint,
  ): FloorClipPoint => {
    let kept = from.signedDistanceM >= 0 ? from : to;
    let removed = from.signedDistanceM >= 0 ? to : from;
    for (let iteration = 0; iteration < 12; iteration += 1) {
      const x = (kept.x + removed.x) * 0.5;
      const z = (kept.z + removed.z) * 0.5;
      const signedDistanceM = signedDistanceFromShoulderCorridor(x, z);
      const midpoint: FloorClipPoint = {
        vertex: -1,
        x,
        z,
        signedDistanceM,
      };
      if (signedDistanceM >= 0) kept = midpoint;
      else removed = midpoint;
    }
    const x = (kept.x + removed.x) * 0.5;
    const z = (kept.z + removed.z) * 0.5;
    return {
      vertex: vertexAt(x, z, boundaryHeightAt(x, z)),
      x,
      z,
      signedDistanceM: 0,
    };
  };
  const appendClippedFloorTriangle = (
    sourceVertices: readonly [number, number, number],
  ): void => {
    const source = sourceVertices.map(clipPointAtVertex);
    const polygon: FloorClipPoint[] = [];
    const keepEpsilonM = 0;
    let previous = source[source.length - 1];
    let previousKept = previous.signedDistanceM >= -keepEpsilonM;
    for (const current of source) {
      const currentKept = current.signedDistanceM >= -keepEpsilonM;
      if (currentKept !== previousKept) {
        polygon.push(boundaryIntersection(previous, current));
      }
      if (currentKept) polygon.push(current);
      previous = current;
      previousKept = currentKept;
    }
    // Intersecciones que coinciden con un vertice de origen pueden duplicarlo.
    // Quitarlas evita caras de area cero en la costura.
    const uniquePolygon = polygon.filter((point, index) => (
      index === 0 || point.vertex !== polygon[index - 1].vertex
    ));
    if (
      uniquePolygon.length > 1
      && uniquePolygon[0].vertex === uniquePolygon[uniquePolygon.length - 1].vertex
    ) uniquePolygon.pop();
    if (uniquePolygon.length < 3) {
      removedFloorTriangleCount += 1;
      return;
    }
    if (uniquePolygon.length !== 3) clippedFloorTriangleCount += 1;
    else if (source.some(point => point.signedDistanceM < -keepEpsilonM)) {
      clippedFloorTriangleCount += 1;
    }
    for (let index = 1; index < uniquePolygon.length - 1; index += 1) {
      const first = uniquePolygon[0];
      const second = uniquePolygon[index];
      const third = uniquePolygon[index + 1];
      const normalY = (second.z - first.z) * (third.x - first.x)
        - (second.x - first.x) * (third.z - first.z);
      if (Math.abs(normalY) < 1e-10) continue;
      indices.push(
        first.vertex,
        normalY >= 0 ? second.vertex : third.vertex,
        normalY >= 0 ? third.vertex : second.vertex,
      );
      emittedFloorTriangleCount += 1;
    }
  };
  const triangulateCell = (points: readonly DelaunayPoint[]): void => {
    const workingPoints: DelaunayPoint[] = [
      ...points,
      { x: -8, z: -8, vertex: -1 },
      { x: 9, z: -8, vertex: -1 },
      { x: 0.5, z: 9, vertex: -1 },
    ];
    const pointCount = points.length;
    let triangles: DelaunayTriangle[] = [{
      a: pointCount,
      b: pointCount + 1,
      c: pointCount + 2,
    }];
    const circumcircleContains = (
      triangle: DelaunayTriangle,
      point: DelaunayPoint,
    ): boolean => {
      const first = workingPoints[triangle.a];
      const second = workingPoints[triangle.b];
      const third = workingPoints[triangle.c];
      const denominator = 2 * (
        first.x * (second.z - third.z)
        + second.x * (third.z - first.z)
        + third.x * (first.z - second.z)
      );
      if (Math.abs(denominator) < 1e-10) return false;
      const firstLength = first.x * first.x + first.z * first.z;
      const secondLength = second.x * second.x + second.z * second.z;
      const thirdLength = third.x * third.x + third.z * third.z;
      const centerX = (
        firstLength * (second.z - third.z)
        + secondLength * (third.z - first.z)
        + thirdLength * (first.z - second.z)
      ) / denominator;
      const centerZ = (
        firstLength * (third.x - second.x)
        + secondLength * (first.x - third.x)
        + thirdLength * (second.x - first.x)
      ) / denominator;
      const radiusSquared = (first.x - centerX) ** 2
        + (first.z - centerZ) ** 2;
      const distanceSquared = (point.x - centerX) ** 2
        + (point.z - centerZ) ** 2;
      return distanceSquared <= radiusSquared + 1e-9;
    };
    for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
      const badTriangleIndices: number[] = [];
      triangles.forEach((triangle, triangleIndex) => {
        if (circumcircleContains(triangle, workingPoints[pointIndex])) {
          badTriangleIndices.push(triangleIndex);
        }
      });
      const edgeCounts = new Map<string, { a: number; b: number; count: number }>();
      for (const triangleIndex of badTriangleIndices) {
        const triangle = triangles[triangleIndex];
        for (const [a, b] of [
          [triangle.a, triangle.b],
          [triangle.b, triangle.c],
          [triangle.c, triangle.a],
        ] as const) {
          const key = a < b ? `${a}:${b}` : `${b}:${a}`;
          const edge = edgeCounts.get(key);
          if (edge) edge.count += 1;
          else edgeCounts.set(key, { a, b, count: 1 });
        }
      }
      const rejected = new Set(badTriangleIndices);
      triangles = triangles.filter((_, index) => !rejected.has(index));
      for (const edge of edgeCounts.values()) {
        if (edge.count !== 1) continue;
        triangles.push({ a: edge.a, b: edge.b, c: pointIndex });
      }
    }
    for (const triangle of triangles) {
      if (
        triangle.a >= pointCount
        || triangle.b >= pointCount
        || triangle.c >= pointCount
      ) continue;
      const first = points[triangle.a];
      const second = points[triangle.b];
      const third = points[triangle.c];
      appendClippedFloorTriangle([
        first.vertex,
        second.vertex,
        third.vertex,
      ]);
    }
  };
  for (let row = 0; row < segments; row += 1) {
    for (let column = 0; column < segments; column += 1) {
      const x0 = -halfSizeM + column * stepM;
      const x1 = x0 + stepM;
      const z0 = -halfSizeM + row * stepM;
      const z1 = z0 + stepM;
      const level = levelAt(row, column);
      const localPoints: DelaunayPoint[] = [];
      const localPointKeys = new Set<string>();
      const appendPoint = (localX: number, localZ: number): void => {
        const key = `${localX.toFixed(6)}:${localZ.toFixed(6)}`;
        if (localPointKeys.has(key)) return;
        localPointKeys.add(key);
        localPoints.push({
          x: localX,
          z: localZ,
          vertex: vertexAt(
            x0 + (x1 - x0) * localX,
            z0 + (z1 - z0) * localZ,
          ),
        });
      };
      const leftLevel = Math.max(level, levelAt(row, column - 1));
      const topLevel = Math.max(level, levelAt(row + 1, column));
      const rightLevel = Math.max(level, levelAt(row, column + 1));
      const bottomLevel = Math.max(level, levelAt(row - 1, column));
      for (let index = 0; index < leftLevel; index += 1) {
        appendPoint(0, index / leftLevel);
      }
      for (let index = 0; index < topLevel; index += 1) {
        appendPoint(index / topLevel, 1);
      }
      for (let index = 0; index < rightLevel; index += 1) {
        appendPoint(1, 1 - index / rightLevel);
      }
      for (let index = 0; index < bottomLevel; index += 1) {
        appendPoint(1 - index / bottomLevel, 0);
      }
      // Unlike the previous center fan, refinement adds a true interior grid.
      for (let localRow = 1; localRow < level; localRow += 1) {
        for (let localColumn = 1; localColumn < level; localColumn += 1) {
          appendPoint(localColumn / level, localRow / level);
        }
      }
      triangulateCell(localPoints);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.adaptiveTerrainRefinement = 'delaunay-grid-4x-transition-2x';
  geometry.userData.adaptiveTerrainBoundary = 'resolved-shoulder-toe-clipped';
  geometry.userData.adaptiveTerrainFloorCutout = 'toe-constrained-triangle-clipping';
  geometry.userData.adaptiveTerrainVertexCount = positions.length / 3;
  geometry.userData.adaptiveTerrainRemovedTriangleCount = removedFloorTriangleCount;
  geometry.userData.adaptiveTerrainClippedTriangleCount = clippedFloorTriangleCount;
  geometry.userData.adaptiveTerrainTriangleCount = emittedFloorTriangleCount;
  return geometry;
};

/** Compatibilidad para consumidores anteriores; el runtime nuevo usa generarPiso. */
export const createApexFlatRoadCorridorGeometry = (
  worldSizeM: number,
  groundHeightM: number,
  roadPoints: readonly ApexLandscapeRoadPoint[],
  roadWidthM: number,
  closed: boolean,
  targetCellSizeM = 8,
): THREE.BufferGeometry => createApexAdaptiveTrackFloorGeometry(
  worldSizeM,
  groundHeightM,
  roadPoints,
  roadWidthM,
  Math.max(6, roadWidthM * 0.55),
  closed,
  targetCellSizeM,
);

export const createApexProceduralLandscapeGeometry = (
  preset: ApexLandscapePreset,
  worldSizeM: number,
  roadPoints: readonly ApexLandscapeRoadPoint[],
  generationSeed = 0,
): THREE.BufferGeometry => {
  const { topology, material } = preset;
  const segments = topology.gridSegments;
  const verticesPerSide = segments + 1;
  const vertexCount = verticesPerSide * verticesPerSide;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const halfSizeM = worldSizeM * 0.5;
  const stepM = worldSizeM / segments;
  // El corredor debe superar el tamaño de una celda. Si es más estrecho,
  // un triángulo del terreno puede unir ambas laderas por encima del asfalto.
  const corridorWidthM = Math.max(
    topology.corridorWidthM,
    stepM * 2.1,
  );

  for (let row = 0; row <= segments; row += 1) {
    const z = -halfSizeM + row * stepM;
    for (let column = 0; column <= segments; column += 1) {
      const x = -halfSizeM + column * stepM;
      const index = row * verticesPerSide + column;
      const naturalHeightM = sampleApexLandscapeNaturalHeight(
        preset,
        x,
        z,
        generationSeed,
      );
      const road = nearestRoad(x, z, roadPoints);
      const corridorMix = smoothstep(
        corridorWidthM,
        corridorWidthM + topology.corridorBlendM,
        road.distanceM,
      );
      const corridorHeightM = road.lowestNearbyHeightM - 0.65;
      const heightM = corridorHeightM
        + (naturalHeightM - corridorHeightM) * corridorMix;

      positions[index * 3] = x;
      positions[index * 3 + 1] = heightM;
      positions[index * 3 + 2] = z;
      uvs[index * 2] = x / material.textureSizeM;
      uvs[index * 2 + 1] = z / material.textureSizeM;
    }
  }

  const indices = new Uint32Array(segments * segments * 6);
  let cursor = 0;
  for (let row = 0; row < segments; row += 1) {
    for (let column = 0; column < segments; column += 1) {
      const northWest = row * verticesPerSide + column;
      const northEast = northWest + 1;
      const southWest = northWest + verticesPerSide;
      const southEast = southWest + 1;
      indices[cursor++] = northWest;
      indices[cursor++] = southWest;
      indices[cursor++] = northEast;
      indices[cursor++] = northEast;
      indices[cursor++] = southWest;
      indices[cursor++] = southEast;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('uv1', new THREE.BufferAttribute(uvs.slice(), 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
};
