export const APEX_PARKING_LAYOUT_VERSION = 'track-garage-line-v6';

const APEX_PARKING_TRACK_ANCHOR = Object.freeze({
  x: 0,
  z: -70,
});

export const APEX_PARKING_PREVIEW = Object.freeze({
  firstZ: APEX_PARKING_TRACK_ANCHOR.z + 18,
  rowSpacingM: 8.5,
  laneSpacingM: 4.25,
  staggerM: 0,
  laneCount: 3,
  groundY: 0.1,
  bayWidthM: 3.9,
  bayLengthM: 7,
});

export const resolveApexParkingBayPosition = (bayIndex: number) => {
  const index = Math.max(0, Math.round(bayIndex));
  const lane = index % APEX_PARKING_PREVIEW.laneCount;
  const row = Math.floor(index / APEX_PARKING_PREVIEW.laneCount);
  return Object.freeze({
    x: APEX_PARKING_TRACK_ANCHOR.x
      + (
        lane - (APEX_PARKING_PREVIEW.laneCount - 1) * 0.5
      ) * APEX_PARKING_PREVIEW.laneSpacingM,
    z: APEX_PARKING_PREVIEW.firstZ
      + row * APEX_PARKING_PREVIEW.rowSpacingM,
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
