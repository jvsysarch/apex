import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createApexFlatRoadCorridorGeometry,
  sampleApexFlatRoadCorridorHeight,
} from '../src/track/landscape/ApexProceduralLandscape.ts';
import {
  createTrackShoulderProfile,
  resolveTrackAdaptiveRoadHalfWidthsM,
  solveTrackShoulderConfluences,
  type TrackShoulderConfluenceFrame,
} from '../src/track/TrackShoulderSystem.ts';

const hairpinCenters = [
  { x: -22, y: 0, z: 0 },
  { x: -7, y: 2, z: 0 },
  { x: 0, y: 8, z: 7 },
  { x: 0, y: 12, z: 22 },
  { x: 0, y: 12, z: 38 },
] as const;

const makeFrames = (): readonly TrackShoulderConfluenceFrame[] => (
  hairpinCenters.map((center, index) => {
    const previous = hairpinCenters[Math.max(0, index - 1)];
    const next = hairpinCenters[Math.min(hairpinCenters.length - 1, index + 1)];
    const tangentX = next.x - previous.x;
    const tangentZ = next.z - previous.z;
    const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
    const lateralX = -tangentZ / tangentLength;
    const lateralZ = tangentX / tangentLength;
    const edge = (side: -1 | 1) => ({
      x: center.x + lateralX * side * 6,
      y: center.y,
      z: center.z + lateralZ * side * 6,
    });
    return {
      center,
      innerLeft: edge(1),
      innerRight: edge(-1),
      profile: createTrackShoulderProfile({
        center,
        innerLeft: edge(1),
        innerRight: edge(-1),
        horizontalLeftX: lateralX,
        horizontalLeftZ: lateralZ,
        roadWidthM: 12,
        shoulderWidthM: 7,
        groundHeightM: 0,
        progress: index / (hairpinCenters.length - 1),
      }),
      distanceM: index * 15,
    };
  })
);

const makeInteriorArcFrames = (): readonly TrackShoulderConfluenceFrame[] => {
  const centers = Array.from({ length: 11 }, (_, index) => {
    const angle = -1 + index * 0.2;
    return { x: Math.cos(angle) * 24, y: index * 0.8, z: Math.sin(angle) * 24 };
  });
  return centers.map((center, index) => {
    const previous = centers[Math.max(0, index - 1)];
    const next = centers[Math.min(centers.length - 1, index + 1)];
    const tangentX = next.x - previous.x;
    const tangentZ = next.z - previous.z;
    const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
    const lateralX = -tangentZ / tangentLength;
    const lateralZ = tangentX / tangentLength;
    const edge = (side: -1 | 1) => ({
      x: center.x + lateralX * side * 6,
      y: center.y,
      z: center.z + lateralZ * side * 6,
    });
    return {
      center,
      innerLeft: edge(1),
      innerRight: edge(-1),
      profile: createTrackShoulderProfile({
        center,
        innerLeft: edge(1),
        innerRight: edge(-1),
        horizontalLeftX: lateralX,
        horizontalLeftZ: lateralZ,
        roadWidthM: 12,
        shoulderWidthM: 7,
        groundHeightM: 0,
        progress: index / (centers.length - 1),
        adaptiveTerrain: true,
      }),
      distanceM: index * 4.8,
    };
  });
};

test('adaptive terrain clamps the inside of a steep, tight hairpin', () => {
  const solution = solveTrackShoulderConfluences(makeFrames(), 12, {
    closed: false,
    localOffsetMarginM: 1,
  });
  assert.ok(solution.localOffsetClampCount > 0);
  const apex = solution.profiles[1];
  const rawApex = makeFrames()[1];
  const largestSolvedOffsetM = Math.max(...apex.left.map(point => (
    Math.hypot(point.x - rawApex.center.x, point.z - rawApex.center.z)
  )));
  const largestRawOffsetM = Math.max(...rawApex.profile.left.map(point => (
    Math.hypot(point.x - rawApex.center.x, point.z - rawApex.center.z)
  )));
  assert.ok(largestSolvedOffsetM < largestRawOffsetM);
  const halfWidths = resolveTrackAdaptiveRoadHalfWidthsM(
    [
      { x: 0, y: 0, z: 0 },
      { x: 6, y: 2, z: 0 },
      { x: 7, y: 8, z: 2 },
      { x: 7, y: 10, z: 10 },
    ],
    12,
    false,
  );
  assert.ok(Math.min(...halfWidths) < 6);
});

test('adaptive terrain rejects a collapsed strip before it reaches a collider', () => {
  const frames = makeFrames().map((frame, index) => index === 2
    ? {
      ...frame,
      profile: {
        left: [frame.profile.left[0], frame.profile.left[0], ...frame.profile.left.slice(2)],
        right: frame.profile.right,
      },
    }
    : frame);
  const solution = solveTrackShoulderConfluences(frames, 12, { closed: false });
  assert.ok(solution.rejectedStripCount > 0);
  assert.equal(solution.masks[2].left[0], false);
});

test('adaptive terrain replaces N-to-N strips with a progressive zipper patch', () => {
  const solution = solveTrackShoulderConfluences(makeInteriorArcFrames(), 12, {
    closed: false,
    interiorFillLeadFactor: 0.7,
    interiorFillMaximumLeadM: 36,
  });
  assert.ok(solution.adaptivePatches.length > 0);
  const patch = solution.adaptivePatches[0];
  assert.equal(patch.outerIndices[0], 0);
  assert.equal(patch.outerIndices[patch.outerIndices.length - 1], 10);
  assert.deepEqual(
    patch.replacedSegmentIndices,
    patch.outerIndices.slice(0, -1),
  );
  assert.equal(patch.curvatureBoundary.length, patch.outerIndices.length);
  patch.curvatureBoundary.forEach((point, index) => {
    const toe = solution.profiles[patch.outerIndices[index]][patch.side][5];
    assert.ok(Math.hypot(point.x - toe.x, point.z - toe.z) <= 4.57);
  });
  assert.equal(patch.rows[0].stage, 0);
  assert.deepEqual(patch.rows[0].sourceIndices, patch.outerIndices);
  let previousCount = patch.outerIndices.length;
  let strictReductionCount = 0;
  for (const row of patch.rows.slice(1)) {
    assert.ok(row.sourceIndices.length <= previousCount);
    if (row.sourceIndices.length < previousCount) strictReductionCount += 1;
    assert.ok(row.sourceIndices.every((sourceIndex, index) => (
      index === 0 || sourceIndex > row.sourceIndices[index - 1]
    )));
    assert.ok(row.compression >= 0 && row.compression <= 1);
    if (row.sourceIndices.length >= 2) {
      assert.equal(row.sourceIndices[0], patch.outerIndices[0]);
      assert.equal(
        row.sourceIndices[row.sourceIndices.length - 1],
        patch.outerIndices[patch.outerIndices.length - 1],
      );
    }
    previousCount = row.sourceIndices.length;
  }
  assert.ok(strictReductionCount >= 2);
  assert.ok(
    patch.rows[1].sourceIndices.length
      <= Math.ceil(patch.outerIndices.length * 0.3),
  );
  assert.equal(patch.rows.at(-1)?.sourceIndices.length, 1);
  assert.ok(patch.triangles.length > 0);
  assert.ok(patch.triangles.some(triangle => triangle.compression >= 0.75));
  for (const triangle of patch.triangles) {
    const [first, second, third] = triangle.points;
    const firstVector = {
      x: second.x - first.x,
      y: second.y - first.y,
      z: second.z - first.z,
    };
    const secondVector = {
      x: third.x - first.x,
      y: third.y - first.y,
      z: third.z - first.z,
    };
    const cross = {
      x: firstVector.y * secondVector.z - firstVector.z * secondVector.y,
      y: firstVector.z * secondVector.x - firstVector.x * secondVector.z,
      z: firstVector.x * secondVector.y - firstVector.y * secondVector.x,
    };
    assert.ok(cross.x ** 2 + cross.y ** 2 + cross.z ** 2 > 1e-8);
    assert.ok(cross.y >= -1e-8);
  }
});

test('adaptive terrain keeps its lateral profile near the asphalt', () => {
  const center = { x: 0, y: 1, z: 0 };
  const compact = createTrackShoulderProfile({
    center,
    innerLeft: { x: 0, y: 1, z: 8 },
    innerRight: { x: 0, y: 1, z: -8 },
    horizontalLeftX: 0,
    horizontalLeftZ: 1,
    roadWidthM: 16,
    shoulderWidthM: 8,
    groundHeightM: 0,
    progress: 0.5,
    adaptiveTerrain: true,
  });
  const toeOffsetFromEdgeM = Math.hypot(
    compact.left[5].x - compact.left[0].x,
    compact.left[5].z - compact.left[0].z,
  );
  assert.ok(toeOffsetFromEdgeM <= 13.61);
});

test('adaptive ground carves a smooth exclusion corridor under a buried road', () => {
  const geometry = createApexFlatRoadCorridorGeometry(
    120,
    0,
    [
      { x: -30, y: -5, z: 0 },
      { x: 30, y: -5, z: 0 },
    ],
    12,
    false,
    4,
  );
  const positions = geometry.getAttribute('position');
  let nearestRoadHeightM = Number.POSITIVE_INFINITY;
  let farGroundHeightM = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    if (Math.hypot(x, z) < 0.1) nearestRoadHeightM = Math.min(nearestRoadHeightM, y);
    if (x > 55 && z > 55) farGroundHeightM = Math.max(farGroundHeightM, y);
  }
  assert.ok(nearestRoadHeightM <= -5.64);
  assert.ok(Math.abs(farGroundHeightM) < 1e-6);
  assert.ok((geometry.getIndex()?.count ?? 0) > 0);
  geometry.dispose();
});

test('adaptive ground does not inherit the height of a distant parallel road', () => {
  const roadPoints = [
    { x: -20, y: -1, z: 0 },
    { x: 20, y: -1, z: 0 },
    { x: 20, y: -12, z: 30 },
    { x: -20, y: -12, z: 30 },
  ] as const;
  const heightM = sampleApexFlatRoadCorridorHeight(
    0,
    0,
    0,
    roadPoints,
    12,
    false,
    4,
  );
  assert.ok(heightM <= -1.64);
  assert.ok(heightM >= -1.66);
});

test('adaptive ground widens a deep cut progressively without a vertical wall', () => {
  const roadPoints = [
    { x: -30, y: -12, z: 0 },
    { x: 30, y: -12, z: 0 },
  ] as const;
  const heights = Array.from({ length: 13 }, (_, index) => (
    sampleApexFlatRoadCorridorHeight(
      0,
      index * 4,
      0,
      roadPoints,
      12,
      false,
      4,
    )
  ));
  heights.slice(1).forEach((heightM, index) => {
    assert.ok(heightM + 1e-8 >= heights[index]);
    assert.ok(heightM - heights[index] < 3.6);
  });
  assert.ok(Math.abs(heights.at(-1) ?? 1) < 1e-6);
});

test('adaptive terrain opens at least one interior patch on Circuito Vector', () => {
  const source = JSON.parse(readFileSync(
    new URL('../src/track/generated/003-circuito-vector-v1.0.0-track-source.json', import.meta.url),
    'utf8',
  )) as {
    readonly segments: readonly {
      readonly evaluatedPoints: readonly {
        readonly x: number;
        readonly y: number;
        readonly z: number;
      }[];
    }[];
  };
  const centers = source.segments[0].evaluatedPoints;
  let distanceM = 0;
  const frames = centers.map((center, index) => {
    const previous = centers[(index - 1 + centers.length) % centers.length];
    const next = centers[(index + 1) % centers.length];
    if (index > 0) {
      distanceM += Math.hypot(
        center.x - previous.x,
        center.y - previous.y,
        center.z - previous.z,
      );
    }
    const tangentX = next.x - previous.x;
    const tangentZ = next.z - previous.z;
    const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
    const lateralX = -tangentZ / tangentLength;
    const lateralZ = tangentX / tangentLength;
    const edge = (side: -1 | 1) => ({
      x: center.x + lateralX * side * 7,
      y: center.y,
      z: center.z + lateralZ * side * 7,
    });
    return {
      center,
      innerLeft: edge(1),
      innerRight: edge(-1),
      profile: createTrackShoulderProfile({
        center,
        innerLeft: edge(1),
        innerRight: edge(-1),
        horizontalLeftX: lateralX,
        horizontalLeftZ: lateralZ,
        roadWidthM: 14,
        shoulderWidthM: 8,
        groundHeightM: 0,
        progress: index / centers.length,
        adaptiveTerrain: true,
      }),
      distanceM,
    };
  });
  const solution = solveTrackShoulderConfluences(frames, 14, { closed: true });
  assert.ok(solution.adaptivePatches.length > 0);
  solution.adaptivePatches.forEach((patch, index) => {
    assert.ok(patch.rows.some((row, rowIndex) => (
      rowIndex > 0
      && row.sourceIndices.length < patch.rows[rowIndex - 1].sourceIndices.length
    )));
    solution.adaptivePatches.slice(index + 1).forEach(other => {
      if (patch.side !== other.side) return;
      assert.ok(
        patch.outerIndices[patch.outerIndices.length - 1] < other.outerIndices[0]
        || other.outerIndices[other.outerIndices.length - 1] < patch.outerIndices[0],
      );
    });
  });
});
