export interface TrackShoulderPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface TrackShoulderProfile {
  /** Del borde del asfalto hacia el terreno. */
  readonly left: readonly TrackShoulderPoint[];
  readonly right: readonly TrackShoulderPoint[];
}

export interface TrackShoulderConfluenceFrame {
  readonly center: TrackShoulderPoint;
  readonly innerLeft: TrackShoulderPoint;
  readonly innerRight: TrackShoulderPoint;
  readonly profile: TrackShoulderProfile;
  readonly distanceM: number;
}

export interface TrackShoulderConfluenceMask {
  /** Cinco strips: inner→crest→upper→middle→soft→toe. */
  readonly left: readonly boolean[];
  readonly right: readonly boolean[];
}

export interface TrackShoulderConfluenceSolution {
  readonly masks: readonly TrackShoulderConfluenceMask[];
  readonly profiles: readonly TrackShoulderProfile[];
  readonly tunnels: readonly TrackShoulderTunnel[];
  readonly conflictCount: number;
  readonly compatibleHeightCount: number;
  /** Perfiles acortados en el interior de una curva para no invertir el offset. */
  readonly localOffsetClampCount: number;
  /** Strips descartados porque su quad sería degenerado o se cruzaría en XZ. */
  readonly rejectedStripCount: number;
  /** Parches que reemplazan la retícula N→N en el lado interior de una curva. */
  readonly adaptivePatches: readonly TrackShoulderAdaptivePatch[];
  /** Alias temporal para consumidores anteriores. */
  readonly interiorFills: readonly TrackShoulderAdaptivePatch[];
}

export interface TrackShoulderAdaptivePatch {
  readonly side: 'left' | 'right';
  /** Muestras del borde de asfalto, incluida la anticipación de entrada/salida. */
  readonly outerIndices: readonly number[];
  /** Segmentos longitudinales de la retícula regular sustituidos por el patch. */
  readonly replacedSegmentIndices: readonly number[];
  /** Curva interior resuelta antes de crear las filas del patch. */
  readonly curvatureBoundary: readonly TrackShoulderPoint[];
  /** Filas reales desde el asfalto al interior, con cardinalidad decreciente. */
  readonly rows: readonly TrackShoulderInteriorRing[];
  /** Alias de las filas posteriores al borde para diagnóstico histórico. */
  readonly rings: readonly TrackShoulderInteriorRing[];
  /** Triángulos ya validados; render y colisión consumen exactamente éstos. */
  readonly triangles: readonly TrackShoulderAdaptiveTriangle[];
}

export interface TrackShoulderInteriorRing {
  /** 0=borde de asfalto, 1..5=perfil; 6=cap opcional de una curva extrema. */
  readonly stage: number;
  readonly sourceIndices: readonly number[];
  readonly points: readonly TrackShoulderPoint[];
  /** Reducción real respecto de la cardinalidad del borde, 0..1. */
  readonly compression: number;
}

export interface TrackShoulderAdaptiveTriangle {
  readonly points: readonly [
    TrackShoulderPoint,
    TrackShoulderPoint,
    TrackShoulderPoint,
  ];
  readonly compression: number;
}

export interface TrackShoulderTunnel {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly tangentX: number;
  readonly tangentZ: number;
  readonly lengthM: number;
  readonly halfWidthM: number;
  readonly heightM: number;
  readonly upperDistanceM: number;
}

export interface TrackShoulderConfiguration {
  readonly center: TrackShoulderPoint;
  readonly innerLeft: TrackShoulderPoint;
  readonly innerRight: TrackShoulderPoint;
  readonly horizontalLeftX: number;
  readonly horizontalLeftZ: number;
  readonly roadWidthM: number;
  readonly shoulderWidthM: number;
  readonly groundHeightM: number;
  readonly progress: number;
  /** Amplitud máxima del relieve local, en metros. */
  readonly organicVariationM?: number;
  /** Conserva banquina histórica o usa el corredor lateral compacto. */
  readonly adaptiveTerrain?: boolean;
  /** Alcance máximo desde el borde del asfalto para el perfil adaptativo. */
  readonly adaptiveTerrainReachM?: number;
}

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.max(minimum, Math.min(maximum, value))
);

const crossfallAt = (progress: number, side: -1 | 1): number => clamp(
  0.02
    + Math.sin((progress * 3 + side * 0.13) * Math.PI * 2) * 0.025
    + Math.sin((progress * 7 - side * 0.19) * Math.PI * 2) * 0.01,
  -0.012,
  0.06,
);

/**
 * Perfil transversal determinista:
 * borde → banquina → talud alto → terraza intermedia → talud suave → terreno.
 */
export const createTrackShoulderProfile = (
  configuration: TrackShoulderConfiguration,
): TrackShoulderProfile => {
  const pointAt = (
    side: -1 | 1,
    distanceFromRoadEdgeM: number,
    y: number,
  ): TrackShoulderPoint => {
    const totalOffsetM = (
      configuration.roadWidthM * 0.5 + distanceFromRoadEdgeM
    );
    return Object.freeze({
      x: (
        configuration.center.x
        + configuration.horizontalLeftX * side * totalOffsetM
      ),
      y,
      z: (
        configuration.center.z
        + configuration.horizontalLeftZ * side * totalOffsetM
      ),
    });
  };

  const profileForSide = (
    side: -1 | 1,
    edge: TrackShoulderPoint,
  ): readonly TrackShoulderPoint[] => {
    const crossfall = crossfallAt(configuration.progress, side);
    const adaptiveReachM = clamp(
      configuration.adaptiveTerrainReachM
        ?? clamp(configuration.roadWidthM * 0.85, 10, 16),
      6,
      22,
    );
    const compactTerrain = configuration.adaptiveTerrain === true;
    const compactCrestDistanceM = Math.min(
      configuration.shoulderWidthM,
      adaptiveReachM * 0.24,
    );
    // En terreno enterrado la banquina no puede saltar directamente a la cota
    // global. Primero conserva una franja transitable y luego sube o baja con
    // una pendiente limitada hasta el punto donde continuará el suelo global.
    const crestY = compactTerrain
      ? edge.y - compactCrestDistanceM * crossfall
      : Math.max(
        configuration.groundHeightM + 0.025,
        edge.y - configuration.shoulderWidthM * crossfall,
      );
    const elevationM = Math.max(
      0,
      crestY - configuration.groundHeightM,
    );
    const upperRunM = clamp(3 + elevationM * 0.22, 4, 13);
    const middleRunM = clamp(4 + elevationM * 0.3, 6, 18);
    const softRunM = clamp(6 + elevationM * 0.42, 8, 24);
    const toeRunM = clamp(8 + elevationM * 0.5, 10, 26);
    const crestDistanceM = compactTerrain
      ? compactCrestDistanceM
      : configuration.shoulderWidthM;
    const upperDistanceM = compactTerrain
      ? adaptiveReachM * 0.48
      : crestDistanceM + upperRunM;
    const middleDistanceM = compactTerrain
      ? adaptiveReachM * 0.67
      : upperDistanceM + middleRunM;
    const softDistanceM = compactTerrain
      ? adaptiveReachM * 0.84
      : middleDistanceM + softRunM;
    const toeDistanceM = compactTerrain
      ? adaptiveReachM
      : softDistanceM + toeRunM;
    const organicVariationM = configuration.organicVariationM ?? 0.42;
    const naturalOffsetM = (
      Math.sin(
        (configuration.progress * 5 + side * 0.21) * Math.PI * 2,
      )
      * Math.min(organicVariationM, elevationM * 0.04)
    );
    const terrainWaveM = (
      Math.sin((configuration.progress * 11 + side * 0.37) * Math.PI * 2)
      + Math.sin((configuration.progress * 23 - side * 0.11) * Math.PI * 2)
        * 0.43
    ) * Math.min(organicVariationM, 0.16 + elevationM * 0.045);

    if (compactTerrain) {
      const maximumTerrainChangeM = Math.max(
        0,
        toeDistanceM - crestDistanceM,
      ) * 0.42;
      const toeY = edge.y + clamp(
        configuration.groundHeightM - edge.y,
        -maximumTerrainChangeM,
        maximumTerrainChangeM,
      );
      const slopeYAt = (distanceM: number, waveFactor: number): number => {
        const mix = clamp(
          (distanceM - crestDistanceM)
            / Math.max(0.001, toeDistanceM - crestDistanceM),
          0,
          1,
        );
        // Quintic smootherstep: el talud llega al toe con pendiente y
        // curvatura nulas. El piso adaptativo usa la misma envolvente, por lo
        // que ambas superficies comparten tangente en la curva de uniÃ³n.
        const smoothMix = mix * mix * mix * (mix * (mix * 6 - 15) + 10);
        const waveEnvelope = Math.sin(Math.PI * mix) ** 2;
        return crestY + (toeY - crestY) * smoothMix
          + terrainWaveM * waveFactor * waveEnvelope;
      };
      return Object.freeze([
        Object.freeze({ x: edge.x, y: edge.y, z: edge.z }),
        pointAt(side, crestDistanceM, crestY),
        pointAt(side, upperDistanceM, slopeYAt(upperDistanceM, 0.35)),
        pointAt(side, middleDistanceM, slopeYAt(middleDistanceM, -0.18)),
        pointAt(side, softDistanceM, slopeYAt(softDistanceM, 0.08)),
        pointAt(side, toeDistanceM, toeY),
      ]);
    }

    return Object.freeze([
      Object.freeze({ x: edge.x, y: edge.y, z: edge.z }),
      pointAt(side, crestDistanceM, crestY),
      pointAt(
        side,
        upperDistanceM,
        configuration.groundHeightM
          + elevationM * 0.72
          + naturalOffsetM + terrainWaveM * 0.6,
      ),
      pointAt(
        side,
        middleDistanceM,
        configuration.groundHeightM
          + elevationM * 0.42
          - naturalOffsetM * 0.35 - terrainWaveM * 0.25,
      ),
      pointAt(
        side,
        softDistanceM,
        configuration.groundHeightM + elevationM * 0.16 + terrainWaveM * 0.1,
      ),
      pointAt(side, toeDistanceM, configuration.groundHeightM + 0.006),
    ]);
  };

  return Object.freeze({
    left: profileForSide(1, configuration.innerLeft),
    right: profileForSide(-1, configuration.innerRight),
  });
};

/**
 * En una curva cuyo radio se aproxima al ancho de la calzada, un offset fijo
 * invierte el borde interior. El modo adaptativo reduce la sección de forma
 * simétrica y continua; los otros modos conservan el ancho autoral exacto.
 */
export const resolveTrackAdaptiveRoadHalfWidthsM = (
  points: readonly TrackShoulderPoint[],
  roadWidthM: number,
  closed: boolean,
  localOffsetMarginM = Math.max(0.75, roadWidthM * 0.08),
): readonly number[] => {
  const nominalHalfWidthM = roadWidthM * 0.5;
  if (points.length < 3) return Object.freeze(points.map(() => nominalHalfWidthM));
  return Object.freeze(points.map((point, index) => {
    if (!closed && (index === 0 || index === points.length - 1)) {
      return nominalHalfWidthM;
    }
    const previous = points[closed ? (index - 1 + points.length) % points.length : index - 1];
    const next = points[closed ? (index + 1) % points.length : index + 1];
    const incomingX = point.x - previous.x;
    const incomingZ = point.z - previous.z;
    const outgoingX = next.x - point.x;
    const outgoingZ = next.z - point.z;
    const incomingLengthM = Math.hypot(incomingX, incomingZ);
    const outgoingLengthM = Math.hypot(outgoingX, outgoingZ);
    if (incomingLengthM < 0.001 || outgoingLengthM < 0.001) {
      return nominalHalfWidthM;
    }
    const turnRadians = Math.abs(Math.atan2(
      incomingX * outgoingZ - incomingZ * outgoingX,
      incomingX * outgoingX + incomingZ * outgoingZ,
    ));
    if (turnRadians < 0.0005) return nominalHalfWidthM;
    const radiusM = (incomingLengthM + outgoingLengthM) * 0.5 / turnRadians;
    const safeHalfWidthM = Math.max(
      nominalHalfWidthM * 0.45,
      radiusM - localOffsetMarginM,
    );
    return Math.min(nominalHalfWidthM, safeHalfWidthM);
  }));
};

const pointOnSegment = (
  start: TrackShoulderPoint,
  end: TrackShoulderPoint,
  mix: number,
): TrackShoulderPoint => ({
  x: start.x + (end.x - start.x) * mix,
  y: start.y + (end.y - start.y) * mix,
  z: start.z + (end.z - start.z) * mix,
});

const crossXZ = (
  origin: TrackShoulderPoint,
  first: TrackShoulderPoint,
  second: TrackShoulderPoint,
): number => (
  (first.x - origin.x) * (second.z - origin.z)
  - (first.z - origin.z) * (second.x - origin.x)
);

const segmentsIntersectXZ = (
  firstStart: TrackShoulderPoint,
  firstEnd: TrackShoulderPoint,
  secondStart: TrackShoulderPoint,
  secondEnd: TrackShoulderPoint,
): boolean => {
  const firstA = crossXZ(firstStart, firstEnd, secondStart);
  const firstB = crossXZ(firstStart, firstEnd, secondEnd);
  const secondA = crossXZ(secondStart, secondEnd, firstStart);
  const secondB = crossXZ(secondStart, secondEnd, firstEnd);
  return (
    Math.min(firstA, firstB) < -0.0001
    && Math.max(firstA, firstB) > 0.0001
    && Math.min(secondA, secondB) < -0.0001
    && Math.max(secondA, secondB) > 0.0001
  );
};

const triangleAreaSquared = (
  first: TrackShoulderPoint,
  second: TrackShoulderPoint,
  third: TrackShoulderPoint,
): number => {
  const firstX = second.x - first.x;
  const firstY = second.y - first.y;
  const firstZ = second.z - first.z;
  const secondX = third.x - first.x;
  const secondY = third.y - first.y;
  const secondZ = third.z - first.z;
  const crossX = firstY * secondZ - firstZ * secondY;
  const crossY = firstZ * secondX - firstX * secondZ;
  const crossZ = firstX * secondY - firstY * secondX;
  return crossX * crossX + crossY * crossY + crossZ * crossZ;
};

const isValidStrip = (
  currentInner: TrackShoulderPoint,
  nextInner: TrackShoulderPoint,
  nextOuter: TrackShoulderPoint,
  currentOuter: TrackShoulderPoint,
  minimumTriangleAreaSquared: number,
): boolean => {
  if (segmentsIntersectXZ(currentInner, nextInner, currentOuter, nextOuter)) {
    return false;
  }
  // El umbral evita triángulos nulos sin borrar quads pequeños válidos.
  return (
    triangleAreaSquared(currentInner, nextInner, nextOuter)
      > minimumTriangleAreaSquared
    && triangleAreaSquared(currentInner, nextOuter, currentOuter)
      > minimumTriangleAreaSquared
  );
};

/**
 * Resuelve taludes que invaden una calzada no vecina.
 *
 * Conserva la huella XZ del perfil y nunca elimina strips. Cuando una parte de
 * la banquina alcanzaría otra calle, adelanta y aumenta su caída hasta pasar
 * bajo ese asfalto o alcanzar el terreno natural. La transición comienza en
 * muestras anteriores para evitar un escalón longitudinal.
 */
export const solveTrackShoulderConfluences = (
  frames: readonly TrackShoulderConfluenceFrame[],
  roadWidthM: number,
  options?: {
    readonly nonLocalDistanceM?: number;
    readonly roadClearanceM?: number;
    readonly compatibleHeightM?: number;
    readonly dilationSamples?: number;
    /** Margen radial mínimo entre el perfil interior y el centro de una curva. */
    readonly localOffsetMarginM?: number;
    /** Área² mínima para aceptar cada triángulo de un strip. */
    readonly degenerateTriangleAreaSquared?: number;
    /** Mínimo de muestras consecutivas para abrir un relleno interior. */
    readonly interiorFillMinimumRegionSamples?: number;
    /** Escala de anticipación antes/después de una curva interior. */
    readonly interiorFillLeadFactor?: number;
    /** Longitud máxima, en metros, de anticipación interior. */
    readonly interiorFillMaximumLeadM?: number;
    /** Profundidad máxima que puede añadir el parche interior desde el toe. */
    readonly interiorFillMaximumDepthM?: number;
    /** Radio máximo de curva que activa un patch; radios mayores quedan regulares. */
    readonly interiorFillMaximumCurveRadiusM?: number;
    /** Fracción máxima que sobrevive por anillo en una curva muy cerrada. */
    readonly interiorFillTightCollapseRatio?: number;
    readonly closed?: boolean;
  },
): TrackShoulderConfluenceSolution => {
  if (frames.length < 3) {
    return Object.freeze({
      masks: Object.freeze(frames.map(() => Object.freeze({
        left: Object.freeze([true, true, true, true, true]),
        right: Object.freeze([true, true, true, true, true]),
      }))),
      profiles: Object.freeze(frames.map(frame => frame.profile)),
      tunnels: Object.freeze([]),
      conflictCount: 0,
      compatibleHeightCount: 0,
      localOffsetClampCount: 0,
      rejectedStripCount: 0,
      adaptivePatches: Object.freeze([]),
      interiorFills: Object.freeze([]),
    });
  }
  const count = frames.length;
  const closed = options?.closed ?? true;
  const closingDistanceM = closed
    ? Math.hypot(
      frames[0].center.x - frames[count - 1].center.x,
      frames[0].center.y - frames[count - 1].center.y,
      frames[0].center.z - frames[count - 1].center.z,
    )
    : 0;
  const trackLengthM = frames[count - 1].distanceM + closingDistanceM;
  const roadHalfWidthM = roadWidthM * 0.5;
  const roadClearanceM = options?.roadClearanceM ?? 0.45;
  const nonLocalDistanceM = options?.nonLocalDistanceM
    ?? Math.max(70, roadWidthM * 3.5);
  const compatibleHeightM = options?.compatibleHeightM ?? 1.35;
  const localOffsetMarginM = options?.localOffsetMarginM
    ?? Math.max(0.75, roadWidthM * 0.08);
  const degenerateTriangleAreaSquared = options?.degenerateTriangleAreaSquared
    ?? 1e-8;
  const interiorFillMinimumRegionSamples = Math.max(
    3,
    Math.floor(options?.interiorFillMinimumRegionSamples ?? 3),
  );
  const interiorFillLeadFactor = clamp(options?.interiorFillLeadFactor ?? 0.24, 0.12, 0.6);
  const interiorFillMaximumLeadM = Math.max(
    8,
    options?.interiorFillMaximumLeadM ?? 18,
  );
  const interiorFillMaximumDepthM = clamp(
    options?.interiorFillMaximumDepthM ?? roadWidthM * 0.28,
    2.5,
    5.5,
  );
  const interiorFillTightCollapseRatio = clamp(
    options?.interiorFillTightCollapseRatio ?? 0.18,
    0.1,
    0.3,
  );
  const cellSizeM = Math.max(24, roadWidthM * 1.5);
  const segmentCells = new Map<string, number[]>();
  const cellKey = (x: number, z: number): string => `${x}:${z}`;
  const cellCoordinate = (value: number): number => Math.floor(value / cellSizeM);

  const segmentCount = closed ? count : count - 1;
  for (
    let segmentIndex = 0;
    segmentIndex < segmentCount;
    segmentIndex += 1
  ) {
    const nextIndex = (segmentIndex + 1) % count;
    const start = frames[segmentIndex].center;
    const end = frames[nextIndex].center;
    const paddingM = roadHalfWidthM + roadClearanceM;
    const minimumCellX = cellCoordinate(Math.min(start.x, end.x) - paddingM);
    const maximumCellX = cellCoordinate(Math.max(start.x, end.x) + paddingM);
    const minimumCellZ = cellCoordinate(Math.min(start.z, end.z) - paddingM);
    const maximumCellZ = cellCoordinate(Math.max(start.z, end.z) + paddingM);
    for (let cellX = minimumCellX; cellX <= maximumCellX; cellX += 1) {
      for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ += 1) {
        const key = cellKey(cellX, cellZ);
        const segments = segmentCells.get(key);
        if (segments) segments.push(segmentIndex);
        else segmentCells.set(key, [segmentIndex]);
      }
    }
  }

  const rawMasks = frames.map(() => ({
    left: [true, true, true, true, true],
    right: [true, true, true, true, true],
  }));
  let localOffsetClampCount = 0;
  const resolvedProfiles = frames.map((frame, frameIndex) => {
    const previousIndex = closed
      ? (frameIndex - 1 + count) % count
      : Math.max(0, frameIndex - 1);
    const nextIndex = closed
      ? (frameIndex + 1) % count
      : Math.min(count - 1, frameIndex + 1);
    const previous = frames[previousIndex].center;
    const next = frames[nextIndex].center;
    const incomingX = frame.center.x - previous.x;
    const incomingZ = frame.center.z - previous.z;
    const outgoingX = next.x - frame.center.x;
    const outgoingZ = next.z - frame.center.z;
    const incomingLengthM = Math.hypot(incomingX, incomingZ);
    const outgoingLengthM = Math.hypot(outgoingX, outgoingZ);
    const signedTurn = incomingLengthM > 0.001 && outgoingLengthM > 0.001
      ? Math.atan2(
        incomingX * outgoingZ - incomingZ * outgoingX,
        incomingX * outgoingX + incomingZ * outgoingZ,
      )
      : 0;
    const localRadiusM = Math.abs(signedTurn) > 0.0005
      ? (incomingLengthM + outgoingLengthM) * 0.5
        / Math.max(0.0005, Math.abs(signedTurn))
      : Number.POSITIVE_INFINITY;
    const innerSide: 'left' | 'right' | undefined = signedTurn > 0.0005
      ? 'left'
      : signedTurn < -0.0005 ? 'right' : undefined;
    const limitProfile = (side: 'left' | 'right'): TrackShoulderPoint[] => {
      const profile = frame.profile[side];
      // El margen deja una franja de suelo entre la cresta y el centro de giro.
      // Sólo se limita el lado interior: el exterior puede abrirse libremente.
      const maximumRadiusM = side === innerSide
        ? Math.max(
          roadHalfWidthM + 0.35,
          localRadiusM - localOffsetMarginM,
        )
        : Number.POSITIVE_INFINITY;
      return profile.map(point => {
        const offsetX = point.x - frame.center.x;
        const offsetZ = point.z - frame.center.z;
        const offsetM = Math.hypot(offsetX, offsetZ);
        if (offsetM <= maximumRadiusM + 0.0001) return point;
        localOffsetClampCount += 1;
        const scale = maximumRadiusM / Math.max(0.0001, offsetM);
        return Object.freeze({
          x: frame.center.x + offsetX * scale,
          y: point.y,
          z: frame.center.z + offsetZ * scale,
        });
      });
    };
    return {
      left: limitProfile('left'),
      right: limitProfile('right'),
    };
  });
  let conflictCount = 0;
  let compatibleHeightCount = 0;
  type DropRequest = {
    readonly targetY: number;
    readonly contactStage: number;
    readonly influence: number;
  };
  const dropRequests: Array<Record<'left' | 'right', DropRequest | undefined>> = (
    frames.map(() => ({ left: undefined, right: undefined }))
  );
  const conflictAt = (
    point: TrackShoulderPoint,
    sourceIndex: number,
  ): { readonly roadY: number } | undefined => {
    const candidates = segmentCells.get(cellKey(
      cellCoordinate(point.x),
      cellCoordinate(point.z),
    )) ?? [];
    let lowestRoadY = Number.POSITIVE_INFINITY;
    for (const segmentIndex of new Set(candidates)) {
      const rawDistanceDeltaM = Math.abs(
        frames[sourceIndex].distanceM - frames[segmentIndex].distanceM,
      );
      const routeDistanceDeltaM = closed
        ? Math.min(
          rawDistanceDeltaM,
          Math.max(0, trackLengthM - rawDistanceDeltaM),
        )
        : rawDistanceDeltaM;
      if (routeDistanceDeltaM < nonLocalDistanceM) continue;
      const nextIndex = (segmentIndex + 1) % count;
      const start = frames[segmentIndex].center;
      const end = frames[nextIndex].center;
      const segmentX = end.x - start.x;
      const segmentZ = end.z - start.z;
      const segmentLengthSquared = segmentX * segmentX + segmentZ * segmentZ;
      const alongMix = clamp(
        (
          (point.x - start.x) * segmentX
          + (point.z - start.z) * segmentZ
        ) / Math.max(0.0001, segmentLengthSquared),
        0,
        1,
      );
      const left = pointOnSegment(
        frames[segmentIndex].innerLeft,
        frames[nextIndex].innerLeft,
        alongMix,
      );
      const right = pointOnSegment(
        frames[segmentIndex].innerRight,
        frames[nextIndex].innerRight,
        alongMix,
      );
      const acrossX = left.x - right.x;
      const acrossZ = left.z - right.z;
      const acrossLengthSquared = acrossX * acrossX + acrossZ * acrossZ;
      const acrossMix = (
        (point.x - right.x) * acrossX
        + (point.z - right.z) * acrossZ
      ) / Math.max(0.0001, acrossLengthSquared);
      const clearanceRatio = roadClearanceM / Math.max(roadWidthM, 0.1);
      if (acrossMix < -clearanceRatio || acrossMix > 1 + clearanceRatio) {
        continue;
      }
      const roadY = right.y + (left.y - right.y) * clamp(acrossMix, 0, 1);
      if (point.y < roadY - 0.18) continue;
      lowestRoadY = Math.min(lowestRoadY, roadY);
    }
    return Number.isFinite(lowestRoadY)
      ? { roadY: lowestRoadY }
      : undefined;
  };

  const averageSpacingM = trackLengthM / count;
  const approachSamples = Math.max(
    Math.round(options?.dilationSamples ?? 0),
    Math.ceil(18 / Math.max(0.5, averageSpacingM)),
  );
  const releaseSamples = Math.max(1, Math.ceil(6 / Math.max(0.5, averageSpacingM)));
  const mergeDropRequest = (
    frameIndex: number,
    side: 'left' | 'right',
    request: DropRequest,
  ) => {
    const previous = dropRequests[frameIndex][side];
    if (
      !previous
      || request.targetY < previous.targetY
      || request.influence > previous.influence
    ) {
      dropRequests[frameIndex][side] = {
        targetY: previous
          ? Math.min(previous.targetY, request.targetY)
          : request.targetY,
        contactStage: previous
          ? Math.min(previous.contactStage, request.contactStage)
          : request.contactStage,
        influence: previous
          ? Math.max(previous.influence, request.influence)
          : request.influence,
      };
    }
  };

  frames.forEach((frame, frameIndex) => {
    for (const side of ['left', 'right'] as const) {
      const profile = frame.profile[side];
      let conflict:
        | { readonly roadY: number; readonly contactStage: number }
        | undefined;
      for (let stage = 0; stage < profile.length - 1; stage += 1) {
        const midpoint = pointOnSegment(profile[stage], profile[stage + 1], 0.5);
        const endpointConflict = conflictAt(profile[stage + 1], frameIndex);
        const midpointConflict = conflictAt(midpoint, frameIndex);
        const roadY = Math.min(
          endpointConflict?.roadY ?? Number.POSITIVE_INFINITY,
          midpointConflict?.roadY ?? Number.POSITIVE_INFINITY,
        );
        if (!Number.isFinite(roadY)) continue;
        conflict = { roadY, contactStage: stage + 1 };
        break;
      }
      if (!conflict) continue;
      conflictCount += 1;
      const naturalGroundY = profile[profile.length - 1].y;
      const targetY = Math.min(naturalGroundY, conflict.roadY - 0.32);
      if (Math.abs(profile[0].y - conflict.roadY) <= compatibleHeightM) {
        compatibleHeightCount += 1;
      }
      for (let offset = -approachSamples; offset <= releaseSamples; offset += 1) {
        const rawAffectedIndex = frameIndex + offset;
        if (!closed && (rawAffectedIndex < 0 || rawAffectedIndex >= count)) {
          continue;
        }
        const affectedIndex = closed
          ? (rawAffectedIndex + count) % count
          : rawAffectedIndex;
        const influence = offset <= 0
          ? 1 - Math.abs(offset) / (approachSamples + 1)
          : 1 - offset / (releaseSamples + 1);
        mergeDropRequest(affectedIndex, side, {
          targetY,
          contactStage: conflict.contactStage,
          influence,
        });
      }
    }
  });

  frames.forEach((frame, frameIndex) => {
    for (const side of ['left', 'right'] as const) {
      const request = dropRequests[frameIndex][side];
      if (!request) continue;
      const profile = frame.profile[side];
      const edgeY = profile[0].y;
      const targetY = Math.min(
        profile[profile.length - 1].y,
        request.targetY,
      );
      resolvedProfiles[frameIndex][side] = profile.map((point, stage) => {
        if (stage === 0) return point;
        const dropProgress = clamp(
          stage / Math.max(1, request.contactStage),
          0,
          1,
        );
        const easedDrop = dropProgress * dropProgress * (3 - 2 * dropProgress);
        const clearanceY = edgeY + (targetY - edgeY) * easedDrop;
        return Object.freeze({
          x: point.x,
          y: point.y + (
            Math.min(point.y, clearanceY) - point.y
          ) * request.influence,
          z: point.z,
        });
      });
    }
  });

  // La limitación por radio evita la mayor parte de los cruces; esta pasada es
  // la red de seguridad para datos editados a mano o cambios de altura muy
  // bruscos. Al desactivar el strip en ambos anillos, render y collider reciben
  // exactamente la misma topología, sin triángulos de área cero.
  let rejectedStripCount = 0;
  for (let frameIndex = 0; frameIndex < segmentCount; frameIndex += 1) {
    const nextIndex = (frameIndex + 1) % count;
    for (const side of ['left', 'right'] as const) {
      const current = resolvedProfiles[frameIndex][side];
      const next = resolvedProfiles[nextIndex][side];
      for (let stage = 0; stage < current.length - 1; stage += 1) {
        if (isValidStrip(
          current[stage],
          next[stage],
          next[stage + 1],
          current[stage + 1],
          degenerateTriangleAreaSquared,
        )) continue;
        rawMasks[frameIndex][side][stage] = false;
        rawMasks[nextIndex][side][stage] = false;
        rejectedStripCount += 1;
      }
    }
  }

  const tunnels: TrackShoulderTunnel[] = [];
  const cross2 = (
    firstX: number,
    firstZ: number,
    secondX: number,
    secondZ: number,
  ) => firstX * secondZ - firstZ * secondX;
  for (
    let firstIndex = 0;
    firstIndex < segmentCount;
    firstIndex += 1
  ) {
    const firstNextIndex = (firstIndex + 1) % count;
    const firstStart = frames[firstIndex].center;
    const firstEnd = frames[firstNextIndex].center;
    const firstX = firstEnd.x - firstStart.x;
    const firstZ = firstEnd.z - firstStart.z;
    const minimumCellX = cellCoordinate(
      Math.min(firstStart.x, firstEnd.x) - roadHalfWidthM,
    );
    const maximumCellX = cellCoordinate(
      Math.max(firstStart.x, firstEnd.x) + roadHalfWidthM,
    );
    const minimumCellZ = cellCoordinate(
      Math.min(firstStart.z, firstEnd.z) - roadHalfWidthM,
    );
    const maximumCellZ = cellCoordinate(
      Math.max(firstStart.z, firstEnd.z) + roadHalfWidthM,
    );
    const crossingCandidates = new Set<number>();
    for (let cellX = minimumCellX; cellX <= maximumCellX; cellX += 1) {
      for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ += 1) {
        for (const candidate of segmentCells.get(cellKey(cellX, cellZ)) ?? []) {
          if (candidate > firstIndex) crossingCandidates.add(candidate);
        }
      }
    }
    for (const secondIndex of crossingCandidates) {
      const rawDistanceDeltaM = Math.abs(
        frames[firstIndex].distanceM - frames[secondIndex].distanceM,
      );
      const routeDistanceDeltaM = closed
        ? Math.min(
          rawDistanceDeltaM,
          Math.max(0, trackLengthM - rawDistanceDeltaM),
        )
        : rawDistanceDeltaM;
      if (routeDistanceDeltaM < nonLocalDistanceM) continue;
      const secondNextIndex = (secondIndex + 1) % count;
      const secondStart = frames[secondIndex].center;
      const secondEnd = frames[secondNextIndex].center;
      const secondX = secondEnd.x - secondStart.x;
      const secondZ = secondEnd.z - secondStart.z;
      const denominator = cross2(firstX, firstZ, secondX, secondZ);
      if (Math.abs(denominator) < 0.0001) continue;
      const offsetX = secondStart.x - firstStart.x;
      const offsetZ = secondStart.z - firstStart.z;
      const firstMix = cross2(offsetX, offsetZ, secondX, secondZ) / denominator;
      const secondMix = cross2(offsetX, offsetZ, firstX, firstZ) / denominator;
      if (
        firstMix < 0
        || firstMix > 1
        || secondMix < 0
        || secondMix > 1
      ) continue;
      const firstY = firstStart.y + (firstEnd.y - firstStart.y) * firstMix;
      const secondY = secondStart.y + (secondEnd.y - secondStart.y) * secondMix;
      const verticalGapM = Math.abs(firstY - secondY);
      if (verticalGapM < 4.1) continue;
      const firstIsLower = firstY < secondY;
      const lowerX = firstIsLower ? firstX : secondX;
      const lowerZ = firstIsLower ? firstZ : secondZ;
      const lowerLength = Math.hypot(lowerX, lowerZ) || 1;
      const upperIndex = firstIsLower ? secondIndex : firstIndex;
      const upperMix = firstIsLower ? secondMix : firstMix;
      const upperNextIndex = (upperIndex + 1) % count;
      const upperSegmentLengthM = Math.hypot(
        frames[upperNextIndex].center.x - frames[upperIndex].center.x,
        frames[upperNextIndex].center.y - frames[upperIndex].center.y,
        frames[upperNextIndex].center.z - frames[upperIndex].center.z,
      );
      const tunnel = Object.freeze({
        x: firstStart.x + firstX * firstMix,
        y: Math.min(firstY, secondY) + 0.04,
        z: firstStart.z + firstZ * firstMix,
        tangentX: lowerX / lowerLength,
        tangentZ: lowerZ / lowerLength,
        lengthM: roadWidthM * 2.75,
        halfWidthM: roadHalfWidthM + 1.6,
        heightM: clamp(verticalGapM - 0.85, 3.4, 7.5),
        upperDistanceM: (
          frames[upperIndex].distanceM + upperSegmentLengthM * upperMix
        ),
      });
      const duplicate = tunnels.some(existing => (
        Math.hypot(existing.x - tunnel.x, existing.z - tunnel.z)
        < roadWidthM * 1.25
      ));
      if (!duplicate) tunnels.push(tunnel);
    }
  }

  for (const tunnel of tunnels) {
    frames.forEach((frame, frameIndex) => {
      const rawDistanceDeltaM = Math.abs(
        frame.distanceM - tunnel.upperDistanceM,
      );
      const routeDistanceDeltaM = closed
        ? Math.min(
          rawDistanceDeltaM,
          Math.max(0, trackLengthM - rawDistanceDeltaM),
        )
        : rawDistanceDeltaM;
      if (routeDistanceDeltaM > tunnel.halfWidthM + 2.5) return;
      rawMasks[frameIndex].left.fill(false);
      rawMasks[frameIndex].right.fill(false);
    });
  }
  const masks = rawMasks.map(mask => Object.freeze({
    left: Object.freeze(mask.left),
    right: Object.freeze(mask.right),
  }));

  type InteriorCandidate = {
    readonly index: number;
    readonly side: 'left' | 'right';
    readonly centerX: number;
    readonly centerY: number;
    readonly centerZ: number;
    readonly radiusM: number;
  };
  const interiorCandidates: InteriorCandidate[] = [];
  // Sólo las curvas cuyo interior cabe dentro de una franja local necesitan
  // remallado. Un radio mayor conserva la retícula normal y evita que el
  // terreno adaptativo se extienda sobre parcelas lejanas.
  const maximumFillRadiusM = Math.max(
    roadWidthM * 1.8,
    options?.interiorFillMaximumCurveRadiusM
      ?? Math.max(30, roadWidthM * 3.2),
  );
  for (let index = 1; index < count - 1; index += 1) {
    const previous = frames[index - 1].center;
    const current = frames[index].center;
    const next = frames[index + 1].center;
    const incomingX = current.x - previous.x;
    const incomingZ = current.z - previous.z;
    const outgoingX = next.x - current.x;
    const outgoingZ = next.z - current.z;
    const incomingLengthM = Math.hypot(incomingX, incomingZ);
    const outgoingLengthM = Math.hypot(outgoingX, outgoingZ);
    if (incomingLengthM < 0.001 || outgoingLengthM < 0.001) continue;
    const signedTurn = Math.atan2(
      incomingX * outgoingZ - incomingZ * outgoingX,
      incomingX * outgoingX + incomingZ * outgoingZ,
    );
    if (Math.abs(signedTurn) < 0.025) continue;
    const radiusM = (incomingLengthM + outgoingLengthM) * 0.5 / Math.abs(signedTurn);
    if (radiusM > maximumFillRadiusM) continue;
    const side: 'left' | 'right' = signedTurn > 0 ? 'left' : 'right';
    const edge = resolvedProfiles[index][side][0];
    const edgeX = edge.x - current.x;
    const edgeZ = edge.z - current.z;
    const edgeLengthM = Math.hypot(edgeX, edgeZ) || 1;
    interiorCandidates.push({
      index,
      side,
      centerX: current.x + edgeX / edgeLengthM * radiusM,
      centerY: current.y,
      centerZ: current.z + edgeZ / edgeLengthM * radiusM,
      radiusM,
    });
  }
  const adaptivePatches: TrackShoulderAdaptivePatch[] = [];
  let candidateStart = 0;
  while (candidateStart < interiorCandidates.length) {
    let candidateEnd = candidateStart + 1;
    while (candidateEnd < interiorCandidates.length) {
      const previous = interiorCandidates[candidateEnd - 1];
      const current = interiorCandidates[candidateEnd];
      const centerGapM = Math.hypot(
        current.centerX - previous.centerX,
        current.centerZ - previous.centerZ,
      );
      if (
        current.index !== previous.index + 1
        || current.side !== previous.side
        || centerGapM > Math.max(5, Math.min(current.radiusM, previous.radiusM) * 0.45)
      ) break;
      candidateEnd += 1;
    }
    const region = interiorCandidates.slice(candidateStart, candidateEnd);
    candidateStart = candidateEnd;
    if (region.length < interiorFillMinimumRegionSamples) continue;
    const averageRadiusM = region.reduce((sum, candidate) => sum + candidate.radiusM, 0)
      / region.length;
    const capRadiusM = clamp(averageRadiusM * 0.16, 1.5, 5);
    const side = region[0].side;
    // La corrección entra antes de la curva y sale después de ella. La longitud
    // de anticipación escala con el radio para que no aparezca una costura al
    // llegar al vértice de máxima curvatura.
    const heightRangeM = region.reduce((range, candidate) => ({
      minimum: Math.min(range.minimum, frames[candidate.index].center.y),
      maximum: Math.max(range.maximum, frames[candidate.index].center.y),
    }), { minimum: Number.POSITIVE_INFINITY, maximum: Number.NEGATIVE_INFINITY });
    const leadDistanceM = clamp(
      averageRadiusM * interiorFillLeadFactor
        + (heightRangeM.maximum - heightRangeM.minimum) * 0.85,
      6,
      interiorFillMaximumLeadM,
    );
    let firstIndex = region[0].index;
    let lastIndex = region[region.length - 1].index;
    while (
      firstIndex > 0
      && frames[region[0].index].distanceM - frames[firstIndex - 1].distanceM
        <= leadDistanceM
    ) firstIndex -= 1;
    while (
      lastIndex < count - 1
      && frames[lastIndex + 1].distanceM - frames[region[region.length - 1].index].distanceM
        <= leadDistanceM
    ) lastIndex += 1;
    const outerIndices = Array.from(
      { length: lastIndex - firstIndex + 1 },
      (_, index) => firstIndex + index,
    );
    // No se "salta" un hueco de máscara: un zipper exige correspondencia
    // continua para no proyectar diagonales largas sobre otra rama.
    if (!outerIndices.every(index => masks[index][side][4])) continue;
    if (outerIndices.length < 3) continue;
    // Dos curvas candidatas pueden tener ventanas de anticipación que se
    // solapan. Sin esta exclusión cada una dibuja su propio N→1 sobre la misma
    // parcela, que visualmente vuelve a parecer N-N-N y además duplica caras.
    const overlapsExistingFill = adaptivePatches.some(existing => (
      existing.side === side
      && outerIndices[0] <= existing.outerIndices[existing.outerIndices.length - 1]
      && existing.outerIndices[0] <= outerIndices[outerIndices.length - 1]
    ));
    if (overlapsExistingFill) continue;
    const candidateAt = (index: number): InteriorCandidate => region.reduce(
      (nearest, candidate) => (
        Math.abs(candidate.index - index) < Math.abs(nearest.index - index)
          ? candidate
          : nearest
      ),
      region[0],
    );
    // Esta curva es la primera geometría que se resuelve. Cada punto se
    // proyecta contra su centro de curvatura LOCAL; no existe un foco global
    // que pueda tirar un vértice al patio de otra rama de la horquilla.
    const firstCoreIndex = region[0].index;
    const lastCoreIndex = region[region.length - 1].index;
    const boundaryInfluenceAt = (index: number): number => {
      if (index >= firstCoreIndex && index <= lastCoreIndex) return 1;
      if (index < firstCoreIndex) {
        return clamp(
          (frames[index].distanceM - frames[firstIndex].distanceM)
            / Math.max(
              0.001,
              frames[firstCoreIndex].distanceM - frames[firstIndex].distanceM,
            ),
          0,
          1,
        );
      }
      return clamp(
        (frames[lastIndex].distanceM - frames[index].distanceM)
          / Math.max(
            0.001,
            frames[lastIndex].distanceM - frames[lastCoreIndex].distanceM,
          ),
        0,
        1,
      );
    };
    const rawCurvatureBoundary = outerIndices.map(index => {
      const toe = resolvedProfiles[index][side][5];
      const candidate = candidateAt(index);
      const rayX = toe.x - candidate.centerX;
      const rayZ = toe.z - candidate.centerZ;
      const rayLengthM = Math.hypot(rayX, rayZ);
      if (rayLengthM < capRadiusM + 0.25) return toe;
      const progress = Math.min(
        interiorFillMaximumDepthM,
        Math.max(0, rayLengthM - capRadiusM),
      ) / rayLengthM * boundaryInfluenceAt(index);
      return Object.freeze({
        x: toe.x + (candidate.centerX - toe.x) * progress,
        y: toe.y + (candidate.centerY - toe.y) * progress * 0.2,
        z: toe.z + (candidate.centerZ - toe.z) * progress,
      });
    });
    // Un suavizado corto sólo sobre la curva interior evita que la variación
    // discreta del radio local se traduzca en dientes en la triangulación.
    const curvatureBoundary = rawCurvatureBoundary.map((point, index) => {
      if (index === 0 || index === rawCurvatureBoundary.length - 1) return point;
      const previous = rawCurvatureBoundary[index - 1];
      const next = rawCurvatureBoundary[index + 1];
      return Object.freeze({
        x: previous.x * 0.2 + point.x * 0.6 + next.x * 0.2,
        y: previous.y * 0.2 + point.y * 0.6 + next.y * 0.2,
        z: previous.z * 0.2 + point.z * 0.6 + next.z * 0.2,
      });
    });
    const boundaryAtIndex = new Map(
      outerIndices.map((index, boundaryIndex) => [index, curvatureBoundary[boundaryIndex]]),
    );
    const sampleRow = (targetCount: number): readonly number[] => {
      if (targetCount <= 1) {
        return Object.freeze([outerIndices[Math.floor(outerIndices.length * 0.5)]]);
      }
      if (targetCount >= outerIndices.length) return outerIndices;
      return Object.freeze(Array.from({ length: targetCount }, (_, sampleIndex) => (
        outerIndices[Math.round(sampleIndex * (outerIndices.length - 1) / (targetCount - 1))]
      )));
    };
    const curveTightness = clamp(
      roadWidthM * 1.45 / Math.max(roadWidthM * 0.55, averageRadiusM),
      0,
      1,
    );
    const rows: TrackShoulderInteriorRing[] = [];
    rows.push(Object.freeze({
      stage: 0,
      sourceIndices: Object.freeze(outerIndices),
      points: Object.freeze(outerIndices.map(index => resolvedProfiles[index][side][0])),
      compression: 0,
    }));
    let previousCount = outerIndices.length;
    // La primera fila conserva N muestras: es una banquina angosta y continua
    // que protege el borde del asfalto. La contracción agresiva empieza recién
    // después, evitando que un zipper largo corte la calzada con dientes verdes.
    const collapseExponent = 4.2 + curveTightness * (
      5 * (1 - interiorFillTightCollapseRatio)
    );
    for (let stage = 1; stage <= 5; stage += 1) {
      const compressionProgress = Math.max(0, (stage - 1) / 4);
      const remaining = (1 - compressionProgress) ** collapseExponent;
      const targetCount = stage === 1
        ? outerIndices.length
        : Math.max(
          2,
          Math.min(previousCount, Math.round(
            2 + (outerIndices.length - 2) * remaining,
          )),
        );
      const sourceIndices = sampleRow(targetCount);
      previousCount = sourceIndices.length;
      const points = sourceIndices.map(index => (
        stage === 5
          ? boundaryAtIndex.get(index)!
          : resolvedProfiles[index][side][stage]
      ));
      rows.push(Object.freeze({
        stage,
        sourceIndices: Object.freeze(sourceIndices),
        points: Object.freeze(points),
        compression: outerIndices.length <= 1
          ? 1
          : 1 - (sourceIndices.length - 1) / (outerIndices.length - 1),
      }));
    }
    // En el ápice de una curva extrema se permite el cierre 2 -> 1. Es un solo
    // triángulo controlado, no el abanico N -> 1 que producía la versión vieja.
    if (curveTightness >= 0.62) {
      const capIndex = region.reduce((tightest, candidate) => (
        candidate.radiusM < tightest.radiusM ? candidate : tightest
      ), region[0]).index;
      rows.push(Object.freeze({
        stage: 6,
        sourceIndices: Object.freeze([capIndex]),
        points: Object.freeze([boundaryAtIndex.get(capIndex)!]),
        compression: 1,
      }));
    }
    const triangles: TrackShoulderAdaptiveTriangle[] = [];
    const appendTriangle = (
      first: TrackShoulderPoint,
      second: TrackShoulderPoint,
      third: TrackShoulderPoint,
      compression: number,
    ): void => {
      if (triangleAreaSquared(first, second, third) <= degenerateTriangleAreaSquared) {
        rejectedStripCount += 1;
        return;
      }
      const normalY = (
        (second.z - first.z) * (third.x - first.x)
        - (second.x - first.x) * (third.z - first.z)
      );
      triangles.push(Object.freeze({
        points: Object.freeze(
          normalY >= 0
            ? [first, second, third] as const
            : [first, third, second] as const,
        ),
        compression,
      }));
    };
    for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex += 1) {
      const firstRow = rows[rowIndex];
      const secondRow = rows[rowIndex + 1];
      let firstCursor = 0;
      let secondCursor = 0;
      const compression = Math.max(firstRow.compression, secondRow.compression);
      while (
        firstCursor < firstRow.sourceIndices.length - 1
        || secondCursor < secondRow.sourceIndices.length - 1
      ) {
        const firstNext = firstRow.sourceIndices[firstCursor + 1];
        const secondNext = secondRow.sourceIndices[secondCursor + 1];
        const firstPoint = firstRow.points[firstCursor];
        const secondPoint = secondRow.points[secondCursor];
        if (secondNext === undefined || (
          firstNext !== undefined && firstNext < secondNext
        )) {
          appendTriangle(
            firstPoint,
            firstRow.points[firstCursor + 1],
            secondPoint,
            compression,
          );
          firstCursor += 1;
        } else if (firstNext === undefined || secondNext < firstNext) {
          appendTriangle(
            firstPoint,
            secondRow.points[secondCursor + 1],
            secondPoint,
            compression,
          );
          secondCursor += 1;
        } else {
          appendTriangle(
            firstPoint,
            firstRow.points[firstCursor + 1],
            secondRow.points[secondCursor + 1],
            compression,
          );
          appendTriangle(
            firstPoint,
            secondRow.points[secondCursor + 1],
            secondPoint,
            compression,
          );
          firstCursor += 1;
          secondCursor += 1;
        }
      }
    }
    if (triangles.length === 0) continue;
    const replacedSegmentIndices = outerIndices.slice(0, -1);
    adaptivePatches.push(Object.freeze({
      side,
      outerIndices: Object.freeze(outerIndices),
      replacedSegmentIndices: Object.freeze(replacedSegmentIndices),
      curvatureBoundary: Object.freeze(curvatureBoundary),
      rows: Object.freeze(rows),
      rings: Object.freeze(rows.slice(1)),
      triangles: Object.freeze(triangles),
    }));
  }

  return Object.freeze({
    masks: Object.freeze(masks),
    profiles: Object.freeze(resolvedProfiles.map(profile => Object.freeze({
      left: Object.freeze(profile.left),
      right: Object.freeze(profile.right),
    }))),
    tunnels: Object.freeze(tunnels),
    conflictCount,
    compatibleHeightCount,
    localOffsetClampCount,
    rejectedStripCount,
    adaptivePatches: Object.freeze(adaptivePatches),
    interiorFills: Object.freeze(adaptivePatches),
  });
};
