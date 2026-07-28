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
    const crestY = Math.max(
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
    const crestDistanceM = configuration.shoulderWidthM;
    const upperDistanceM = crestDistanceM + upperRunM;
    const middleDistanceM = upperDistanceM + middleRunM;
    const softDistanceM = middleDistanceM + softRunM;
    const toeDistanceM = softDistanceM + toeRunM;
    const naturalOffsetM = (
      Math.sin(
        (configuration.progress * 5 + side * 0.21) * Math.PI * 2,
      )
      * Math.min(0.28, elevationM * 0.025)
    );

    return Object.freeze([
      Object.freeze({ x: edge.x, y: edge.y, z: edge.z }),
      pointAt(side, crestDistanceM, crestY),
      pointAt(
        side,
        upperDistanceM,
        configuration.groundHeightM
          + elevationM * 0.72
          + naturalOffsetM,
      ),
      pointAt(
        side,
        middleDistanceM,
        configuration.groundHeightM
          + elevationM * 0.42
          - naturalOffsetM * 0.35,
      ),
      pointAt(
        side,
        softDistanceM,
        configuration.groundHeightM + elevationM * 0.16,
      ),
      pointAt(side, toeDistanceM, configuration.groundHeightM + 0.006),
    ]);
  };

  return Object.freeze({
    left: profileForSide(1, configuration.innerLeft),
    right: profileForSide(-1, configuration.innerRight),
  });
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
  const resolvedProfiles = frames.map(frame => ({
    left: [...frame.profile.left],
    right: [...frame.profile.right],
  }));
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

  return Object.freeze({
    masks: Object.freeze(masks),
    profiles: Object.freeze(resolvedProfiles.map(profile => Object.freeze({
      left: Object.freeze(profile.left),
      right: Object.freeze(profile.right),
    }))),
    tunnels: Object.freeze(tunnels),
    conflictCount,
    compatibleHeightCount,
  });
};
