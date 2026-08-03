export interface TrackSafetyPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly bankRadians: number;
}

export interface TrackSafetyPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type TrackSafetySide = -1 | 1;

export interface TrackSafetySegment {
  readonly sectionId: number;
  readonly sourceIndex: number;
  readonly distanceM: number;
  readonly start: TrackSafetyPosition;
  readonly end: TrackSafetyPosition;
  readonly centerStart: TrackSafetyPosition;
  readonly centerEnd: TrackSafetyPosition;
  readonly side: TrackSafetySide;
  readonly risk: number;
  readonly curveRadiusM: number;
  readonly arrows: boolean;
}

export interface TrackSafetySection {
  readonly id: number;
  readonly side: TrackSafetySide;
  readonly points: readonly TrackSafetyPosition[];
  readonly centerPoints: readonly TrackSafetyPosition[];
  readonly segments: readonly TrackSafetySegment[];
  readonly risk: number;
  readonly arrows: boolean;
  readonly lengthM: number;
}

export interface TrackSafetySystem {
  readonly segments: readonly TrackSafetySegment[];
  readonly sections: readonly TrackSafetySection[];
  readonly protectedLengthM: number;
  readonly arrowLengthM: number;
  readonly orientationErrorCount: number;
  readonly maximumJoinGapM: number;
}

export interface TrackSafetyConfiguration {
  readonly points: readonly TrackSafetyPoint[];
  readonly roadWidthM: number;
  readonly groundHeightM: number;
  readonly closed?: boolean;
  readonly railOffsetFromRoadM?: number;
  readonly leadDistanceM?: number;
  readonly curvatureSmoothingDistanceM?: number;
  readonly maximumProtectedCurveRadiusM?: number;
  readonly elevatedGuardrailThresholdM?: number;
  /** Sólo el terreno adaptativo estrecha el rail interior de horquillas. */
  readonly adaptiveTerrain?: boolean;
}

export const TRACK_GUARDRAIL_HEIGHT_M = 1.35;
export const TRACK_GUARDRAIL_VISUAL_HEIGHT_M = 0.92;
export const TRACK_GUARDRAIL_COLLIDER_HEIGHT_M = 1.7;
export const TRACK_GUARDRAIL_COLLIDER_DEPTH_M = 1.5;
export const TRACK_GUARDRAIL_THICKNESS_M = 0.24;
export const TRACK_GUARDRAIL_BEAM_HEIGHT_M = 0.36;
export const TRACK_GUARDRAIL_POST_HEIGHT_M = 0.82;
export const TRACK_GUARDRAIL_POST_WIDTH_M = 0.13;
export const TRACK_GUARDRAIL_POST_SPACING_M = 5;
export const TRACK_GUARDRAIL_ARROW_SPACING_M = 18;
export const TRACK_GUARDRAIL_TERMINAL_LENGTH_M = 4;
export const TRACK_GUARDRAIL_TERMINAL_FLARE_M = 0.55;

const clamp = (value: number, minimum = 0, maximum = 1): number => (
  Math.max(minimum, Math.min(maximum, value))
);

const smoothStep = (minimum: number, maximum: number, value: number): number => {
  const phase = clamp((value - minimum) / Math.max(0.0001, maximum - minimum));
  return phase * phase * (3 - 2 * phase);
};

const samePosition = (
  left: TrackSafetyPosition,
  right: TrackSafetyPosition,
): boolean => (
  Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z) < 0.001
);

const freezePosition = (
  point: Pick<TrackSafetyPoint, 'x' | 'y' | 'z'>,
): TrackSafetyPosition => Object.freeze({
  x: point.x,
  y: point.y,
  z: point.z,
});

const addGuardrailTerminalFlares = (
  points: readonly TrackSafetyPosition[],
  centerPoints: readonly TrackSafetyPosition[],
): {
  readonly points: readonly TrackSafetyPosition[];
  readonly centerPoints: readonly TrackSafetyPosition[];
} => {
  if (
    points.length < 2
    || centerPoints.length !== points.length
    || samePosition(points[0], points[points.length - 1])
  ) {
    return { points, centerPoints };
  }

  const terminalPoint = (
    point: TrackSafetyPosition,
    neighbor: TrackSafetyPosition,
    center: TrackSafetyPosition,
    direction: -1 | 1,
  ): {
    readonly point: TrackSafetyPosition;
    readonly center: TrackSafetyPosition;
  } => {
    const tangentX = neighbor.x - point.x;
    const tangentZ = neighbor.z - point.z;
    const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
    const unitTangentX = tangentX / tangentLength;
    const unitTangentZ = tangentZ / tangentLength;
    const outwardX = point.x - center.x;
    const outwardZ = point.z - center.z;
    const outwardLength = Math.hypot(outwardX, outwardZ) || 1;
    const unitOutwardX = outwardX / outwardLength;
    const unitOutwardZ = outwardZ / outwardLength;
    const extensionX = unitTangentX * direction
      * TRACK_GUARDRAIL_TERMINAL_LENGTH_M;
    const extensionZ = unitTangentZ * direction
      * TRACK_GUARDRAIL_TERMINAL_LENGTH_M;
    return {
      point: Object.freeze({
        x: point.x + extensionX
          + unitOutwardX * TRACK_GUARDRAIL_TERMINAL_FLARE_M,
        y: point.y,
        z: point.z + extensionZ
          + unitOutwardZ * TRACK_GUARDRAIL_TERMINAL_FLARE_M,
      }),
      center: Object.freeze({
        x: center.x + extensionX,
        y: center.y,
        z: center.z + extensionZ,
      }),
    };
  };

  const firstTerminal = terminalPoint(
    points[0],
    points[1],
    centerPoints[0],
    -1,
  );
  const lastIndex = points.length - 1;
  const lastTerminal = terminalPoint(
    points[lastIndex],
    points[lastIndex - 1],
    centerPoints[lastIndex],
    -1,
  );
  return {
    points: Object.freeze([
      firstTerminal.point,
      ...points,
      lastTerminal.point,
    ]),
    centerPoints: Object.freeze([
      firstTerminal.center,
      ...centerPoints,
      lastTerminal.center,
    ]),
  };
};

/**
 * Construye la línea exterior de protección de una pista abierta o cerrada.
 *
 * La curvatura firmada se filtra antes de elegir el lado. Así una pequeña
 * oscilación entre muestras no puede mandar el guardrail de un lado al otro.
 * Los tramos consecutivos se agrupan además en secciones continuas que pueden
 * convertirse directamente en una única cinta visual o malla física.
 */
export const createTrackSafetySystem = (
  configuration: TrackSafetyConfiguration,
): TrackSafetySystem => {
  const source = configuration.points;
  const closed = configuration.closed ?? true;
  const points = source.length > 2 && samePosition(source[0], source[source.length - 1])
    ? source.slice(0, -1)
    : source.slice();
  if (points.length < 3) {
    return Object.freeze({
      segments: Object.freeze([]),
      sections: Object.freeze([]),
      protectedLengthM: 0,
      arrowLengthM: 0,
      orientationErrorCount: 0,
      maximumJoinGapM: 0,
    });
  }

  const railOffsetM = (
    configuration.roadWidthM * 0.5
    + (configuration.railOffsetFromRoadM ?? 0.7)
  );
  const segmentCount = closed ? points.length : points.length - 1;
  const segmentLengths = points.slice(0, segmentCount).map((point, index) => {
    const next = points[closed ? (index + 1) % points.length : index + 1];
    return Math.hypot(next.x - point.x, next.y - point.y, next.z - point.z);
  });
  const averageSpacingM = (
    segmentLengths.reduce((sum, length) => sum + length, 0)
    / segmentLengths.length
  );
  const leadPointCount = Math.max(
    1,
    Math.ceil((configuration.leadDistanceM ?? 45) / averageSpacingM),
  );
  const smoothingPointRadius = Math.max(
    1,
    Math.ceil(
      (configuration.curvatureSmoothingDistanceM ?? 18)
      / averageSpacingM,
    ),
  );
  let totalDistanceM = 0;
  const distancesM = points.map((_, index) => {
    const current = totalDistanceM;
    totalDistanceM += segmentLengths[index] ?? 0;
    return current;
  });

  const rawSignedCurvatures = points.map((point, index) => {
    if (!closed && (index === 0 || index === points.length - 1)) return 0;
    const previous = points[
      closed ? (index - 1 + points.length) % points.length : index - 1
    ];
    const next = points[
      closed ? (index + 1) % points.length : index + 1
    ];
    const incomingX = point.x - previous.x;
    const incomingZ = point.z - previous.z;
    const outgoingX = next.x - point.x;
    const outgoingZ = next.z - point.z;
    const incomingLengthM = Math.hypot(incomingX, incomingZ);
    const outgoingLengthM = Math.hypot(outgoingX, outgoingZ);
    if (incomingLengthM < 0.01 || outgoingLengthM < 0.01) return 0;
    const signedTurn = Math.atan2(
      (
        incomingX * outgoingZ
        - incomingZ * outgoingX
      ) / (incomingLengthM * outgoingLengthM),
      (
        incomingX * outgoingX
        + incomingZ * outgoingZ
      ) / (incomingLengthM * outgoingLengthM),
    );
    return signedTurn / Math.max(
      0.01,
      (incomingLengthM + outgoingLengthM) * 0.5,
    );
  });

  const signedCurvatures = rawSignedCurvatures.map((_, index) => {
    let weightedCurvature = 0;
    let totalWeight = 0;
    for (
      let offset = -smoothingPointRadius;
      offset <= smoothingPointRadius;
      offset += 1
    ) {
      const weight = smoothingPointRadius + 1 - Math.abs(offset);
      const candidateIndex = index + offset;
      if (
        !closed
        && (candidateIndex < 0 || candidateIndex >= rawSignedCurvatures.length)
      ) continue;
      const resolvedIndex = closed
        ? (candidateIndex + rawSignedCurvatures.length)
          % rawSignedCurvatures.length
        : candidateIndex;
      weightedCurvature += rawSignedCurvatures[resolvedIndex] * weight;
      totalWeight += weight;
    }
    return weightedCurvature / totalWeight;
  });

  const metrics = points.map((point, index) => {
    const signedCurvature = signedCurvatures[index];
    const curvature = Math.abs(signedCurvature);
    const curveRadiusM = curvature > 0.000001
      ? 1 / curvature
      : Number.POSITIVE_INFINITY;
    const elevationM = Math.max(0, point.y - configuration.groundHeightM);
    const curvatureRisk = smoothStep(1 / 350, 1 / 90, curvature);
    const elevationRisk = smoothStep(1, 8, elevationM);
    const curveQualifies = (
      curveRadiusM <= (configuration.maximumProtectedCurveRadiusM ?? 260)
      && (elevationM >= 1 || curveRadiusM <= 125)
      && Math.abs(signedCurvature) > 0.000001
    );
    const protectsBothSides = (
      configuration.elevatedGuardrailThresholdM !== undefined
      && elevationM >= configuration.elevatedGuardrailThresholdM
    );
    const risk = Math.max(
      curvatureRisk * (0.65 + elevationRisk * 0.35),
      protectsBothSides ? elevationRisk * 0.55 : 0,
    );
    const qualifies = curveQualifies || protectsBothSides;

    return Object.freeze({
      qualifies,
      protectsBothSides,
      arrows: curveQualifies && risk >= 0.58,
      side: (signedCurvature > 0 ? -1 : 1) as TrackSafetySide,
      risk,
      curveRadiusM,
    });
  });

  // Cada lado se extiende por separado. En una transición en S las zonas de
  // salida pueden solaparse y formar un corredor con barreras a ambos lados;
  // una curva nunca desplaza la protección exterior de la curva opuesta.
  const protectionBySide = new Map<
    TrackSafetySide,
    ReadonlyArray<(typeof metrics)[number] | undefined>
  >();
  for (const side of [-1, 1] as const) {
    protectionBySide.set(side, metrics.map((metric, index) => {
      if (
        metric.qualifies
        && (metric.side === side || metric.protectsBothSides)
      ) {
        return metric;
      }
      let nearest: typeof metric | undefined;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (let offset = 1; offset <= leadPointCount; offset += 1) {
        for (const direction of [-1, 1]) {
          const candidateIndex = index + direction * offset;
          if (
            !closed
            && (candidateIndex < 0 || candidateIndex >= metrics.length)
          ) continue;
          const candidate = metrics[
            closed
              ? (candidateIndex + metrics.length) % metrics.length
              : candidateIndex
          ];
          if (
            candidate.qualifies
            && (candidate.side === side || candidate.protectsBothSides)
            && (
              offset < nearestDistance
              || (
                offset === nearestDistance
                && candidate.risk > (nearest?.risk ?? -1)
              )
            )
          ) {
            nearest = candidate;
            nearestDistance = offset;
          }
        }
      }
      if (!nearest) return undefined;
      return Object.freeze({
        ...nearest,
        arrows: false,
        risk: nearest.risk * 0.72,
      });
    }));
  }

  const centerPoint = (index: number): TrackSafetyPosition => (
    freezePosition(points[index])
  );
  const railPoint = (
    index: number,
    side: TrackSafetySide,
  ): TrackSafetyPosition => {
    const point = points[index];
    const previous = points[
      closed
        ? (index - 1 + points.length) % points.length
        : Math.max(0, index - 1)
    ];
    const next = points[
      closed
        ? (index + 1) % points.length
        : Math.min(points.length - 1, index + 1)
    ];
    const tangentX = next.x - previous.x;
    const tangentZ = next.z - previous.z;
    const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
    const lateralX = -tangentZ / tangentLength;
    const lateralZ = tangentX / tangentLength;
    const bankedLateralY = -Math.sin(point.bankRadians);
    const signedCurvature = signedCurvatures[index];
    const isInnerSide = (
      (signedCurvature > 0 && side === 1)
      || (signedCurvature < 0 && side === -1)
    );
    const localRadiusM = Math.abs(signedCurvature) > 0.000001
      ? 1 / Math.abs(signedCurvature)
      : Number.POSITIVE_INFINITY;
    // El rail interior no puede avanzar hasta el centro de curvatura. El
    // límite se aplica solamente en adaptive-terrain para no alterar banquina.
    const effectiveRailOffsetM = configuration.adaptiveTerrain && isInnerSide
      ? Math.min(
        railOffsetM,
        Math.max(0.5, localRadiusM - Math.max(0.75, railOffsetM * 0.12)),
      )
      : railOffsetM;
    return Object.freeze({
      x: point.x + lateralX * side * effectiveRailOffsetM,
      y: point.y + bankedLateralY * side * effectiveRailOffsetM + 0.03,
      z: point.z + lateralZ * side * effectiveRailOffsetM,
    });
  };

  const draftSegments: Array<Omit<TrackSafetySegment, 'sectionId'>> = [];
  for (const side of [-1, 1] as const) {
    const protection = protectionBySide.get(side)!;
    for (let index = 0; index < segmentCount; index += 1) {
      const metric = protection[index];
      const nextIndex = closed ? (index + 1) % points.length : index + 1;
      const nextMetric = protection[nextIndex];
      if (!metric || !nextMetric) continue;
      draftSegments.push(Object.freeze({
        sourceIndex: index,
        distanceM: distancesM[index],
        start: railPoint(index, side),
        end: railPoint(nextIndex, side),
        centerStart: centerPoint(index),
        centerEnd: centerPoint(nextIndex),
        side,
        risk: Math.max(metric.risk, nextMetric.risk),
        curveRadiusM: Math.min(metric.curveRadiusM, nextMetric.curveRadiusM),
        arrows: metric.arrows || nextMetric.arrows,
      }));
    }
  }

  const sectionDrafts: Array<{
    side: TrackSafetySide;
    segments: Array<Omit<TrackSafetySegment, 'sectionId'>>;
  }> = [];
  for (const segment of draftSegments) {
    const previousSection = sectionDrafts[sectionDrafts.length - 1];
    const previousSegment = previousSection?.segments[
      previousSection.segments.length - 1
    ];
    const expectedIndex = previousSegment
      ? closed
        ? (previousSegment.sourceIndex + 1) % points.length
        : previousSegment.sourceIndex + 1
      : -1;
    if (
      !previousSection
      || previousSection.side !== segment.side
      || expectedIndex !== segment.sourceIndex
      || !samePosition(previousSegment.end, segment.start)
    ) {
      sectionDrafts.push({
        side: segment.side,
        segments: [segment],
      });
    } else {
      previousSection.segments.push(segment);
    }
  }
  // Si una protección cruza salida/meta, el recorrido lineal produce dos
  // bloques que en realidad comparten el punto de cierre de la spline.
  if (closed) for (const side of [-1, 1] as const) {
    const sectionIndices = sectionDrafts
      .map((section, index) => section.side === side ? index : -1)
      .filter(index => index >= 0);
    const firstIndex = sectionIndices[0];
    const lastIndex = sectionIndices[sectionIndices.length - 1];
    if (firstIndex === undefined || lastIndex === undefined || firstIndex === lastIndex) {
      continue;
    }
    const firstSection = sectionDrafts[firstIndex];
    const lastSection = sectionDrafts[lastIndex];
    const firstSegment = firstSection.segments[0];
    const lastSegment = lastSection.segments[lastSection.segments.length - 1];
    if (
      firstSegment.sourceIndex === 0
      && lastSegment.sourceIndex === points.length - 1
      && samePosition(lastSegment.end, firstSegment.start)
    ) {
      sectionDrafts[firstIndex] = {
        side,
        segments: [
          ...lastSection.segments,
          ...firstSection.segments,
        ],
      };
      sectionDrafts.splice(lastIndex, 1);
    }
  }

  const sections: TrackSafetySection[] = [];
  const segments: TrackSafetySegment[] = [];
  let maximumJoinGapM = 0;
  let orientationErrorCount = 0;
  sectionDrafts.forEach((draft, sectionId) => {
    const sectionSegments = draft.segments.map(segment => {
      const finalized = Object.freeze({
        ...segment,
        sectionId,
      });
      const centerX = (
        finalized.centerStart.x + finalized.centerEnd.x
      ) * 0.5;
      const centerZ = (
        finalized.centerStart.z + finalized.centerEnd.z
      ) * 0.5;
      const railX = (finalized.start.x + finalized.end.x) * 0.5;
      const railZ = (finalized.start.z + finalized.end.z) * 0.5;
      const tangentX = finalized.centerEnd.x - finalized.centerStart.x;
      const tangentZ = finalized.centerEnd.z - finalized.centerStart.z;
      const expectedOutwardX = -tangentZ * finalized.side;
      const expectedOutwardZ = tangentX * finalized.side;
      if (
        (railX - centerX) * expectedOutwardX
        + (railZ - centerZ) * expectedOutwardZ <= 0
      ) {
        orientationErrorCount += 1;
      }
      segments.push(finalized);
      return finalized;
    });
    for (let index = 1; index < sectionSegments.length; index += 1) {
      const previous = sectionSegments[index - 1];
      const current = sectionSegments[index];
      maximumJoinGapM = Math.max(
        maximumJoinGapM,
        Math.hypot(
          current.start.x - previous.end.x,
          current.start.y - previous.end.y,
          current.start.z - previous.end.z,
        ),
      );
    }
    const sectionPoints = [
      sectionSegments[0].start,
      ...sectionSegments.map(segment => segment.end),
    ];
    const centerPoints = [
      sectionSegments[0].centerStart,
      ...sectionSegments.map(segment => segment.centerEnd),
    ];
    const flaredTerminals = addGuardrailTerminalFlares(
      sectionPoints,
      centerPoints,
    );
    const lengthM = flaredTerminals.points.reduce((sum, point, index) => {
      if (index === 0) return 0;
      const previous = flaredTerminals.points[index - 1];
      return sum + Math.hypot(
        point.x - previous.x,
        point.y - previous.y,
        point.z - previous.z,
      );
    }, 0);
    sections.push(Object.freeze({
      id: sectionId,
      side: draft.side,
      points: flaredTerminals.points,
      centerPoints: flaredTerminals.centerPoints,
      segments: Object.freeze(sectionSegments),
      risk: Math.max(...sectionSegments.map(segment => segment.risk)),
      arrows: sectionSegments.some(segment => segment.arrows),
      lengthM,
    }));
  });

  return Object.freeze({
    segments: Object.freeze(segments),
    sections: Object.freeze(sections),
    protectedLengthM: sections.reduce((sum, section) => sum + section.lengthM, 0),
    arrowLengthM: segments.filter(segment => segment.arrows).reduce(
      (sum, segment) => sum + Math.hypot(
        segment.end.x - segment.start.x,
        segment.end.y - segment.start.y,
        segment.end.z - segment.start.z,
      ),
      0,
    ),
    orientationErrorCount,
    maximumJoinGapM,
  });
};
