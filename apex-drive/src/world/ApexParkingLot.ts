export interface ApexParkingSurface {
  readonly centerX: number;
  readonly centerZ: number;
  readonly widthM: number;
  readonly lengthM: number;
  readonly yawDegrees: number;
}

export const APEX_PARKING_LAYOUT_VERSION = 'paddock-staggered-grid-v4';

const APEX_PARKING_TRACK_ANCHOR = Object.freeze({
  x: 0,
  z: -70,
});

export const APEX_PARKING_LOT: ApexParkingSurface = Object.freeze({
  centerX: APEX_PARKING_TRACK_ANCHOR.x + 38,
  centerZ: APEX_PARKING_TRACK_ANCHOR.z + 30,
  widthM: 64,
  lengthM: 24,
  yawDegrees: 0,
});

export const APEX_PIT_LANE: readonly ApexParkingSurface[] = Object.freeze([
  Object.freeze({
    centerX: APEX_PARKING_TRACK_ANCHOR.x + 2,
    centerZ: APEX_PARKING_TRACK_ANCHOR.z + 25.5,
    widthM: 12,
    lengthM: 9,
    yawDegrees: 0,
  }),
  Object.freeze({
    centerX: APEX_PARKING_TRACK_ANCHOR.x,
    centerZ: APEX_PARKING_TRACK_ANCHOR.z + 12.5,
    widthM: 8,
    lengthM: 21,
    yawDegrees: 0,
  }),
]);

export const APEX_PARKING_PREVIEW = Object.freeze({
  firstX: APEX_PARKING_TRACK_ANCHOR.x + 12,
  rowSpacingM: 7.2,
  laneSpacingM: 6.5,
  staggerM: 3.6,
  laneCount: 2,
  z: APEX_PARKING_TRACK_ANCHOR.z + 34,
  groundY: 0.035,
  bayWidthM: 5.4,
  bayLengthM: 7,
  aisleCenterZ: APEX_PARKING_TRACK_ANCHOR.z + 25.5,
  exitX: APEX_PARKING_TRACK_ANCHOR.x + 6,
});

export const resolveApexParkingBayPosition = (bayIndex: number) => {
  const index = Math.max(0, Math.round(bayIndex));
  const lane = index % APEX_PARKING_PREVIEW.laneCount;
  const row = Math.floor(index / APEX_PARKING_PREVIEW.laneCount);
  return Object.freeze({
    x: APEX_PARKING_PREVIEW.firstX
      + row * APEX_PARKING_PREVIEW.rowSpacingM
      + lane * APEX_PARKING_PREVIEW.staggerM,
    z: APEX_PARKING_PREVIEW.z
      + (lane === 0 ? 0.5 : -0.5) * APEX_PARKING_PREVIEW.laneSpacingM,
    lane,
    row,
  });
};

export const createApexParkingSpawn = (bayIndex: number) => {
  const bay = resolveApexParkingBayPosition(bayIndex);
  return Object.freeze({
    x: bay.x,
    y: 0.81,
    z: bay.z,
    yawDegrees: 180,
  });
};

export const APEX_PARKING_SPAWN = createApexParkingSpawn(0);
