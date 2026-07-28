import type {
  ApexStaticColliderDescriptor,
  ApexStaticColliderGroup,
} from '@jvsysarch/apex-physics';
import {
  APEX_PARKING_LOT,
  APEX_PIT_LANE,
} from '../ApexParkingLot';

export const APEX_GLOBAL_FLOOR_COLLISION_OWNER_ID = 'world:global-floor';
export const APEX_PARKING_COLLISION_OWNER_ID = 'world:parking-and-pit-lane';

export interface ApexWorldStaticCollisionOptions {
  readonly floorSizeM: number;
  readonly grassFriction: number;
  readonly asphaltFriction: number;
}

export const createApexGlobalFloorCollisionGroup = (
  floorSizeM: number,
  grassFriction: number,
): ApexStaticColliderGroup => Object.freeze({
  ownerId: APEX_GLOBAL_FLOOR_COLLISION_OWNER_ID,
  colliders: Object.freeze([Object.freeze({
    id: 'global-floor',
    kind: 'box' as const,
    center: [0, -0.1, 0] as const,
    halfExtents: [floorSizeM / 2, 0.1, floorSizeM / 2] as const,
    rotation: [0, 0, 0, 1] as const,
    convexRadiusM: 0.05,
    surface: 'grass' as const,
    friction: grassFriction,
    restitution: 0,
  })]),
});

export const createApexParkingCollisionGroup = (
  asphaltFriction: number,
): ApexStaticColliderGroup => {
  const surfaces = [APEX_PARKING_LOT, ...APEX_PIT_LANE];
  const colliders: ApexStaticColliderDescriptor[] = surfaces.map(
    (surface, index) => {
      const yawRadians = surface.yawDegrees * Math.PI / 180;
      const halfYaw = yawRadians * 0.5;
      return Object.freeze({
        id: index === 0 ? 'parking-lot' : `pit-lane-${index}`,
        kind: 'box' as const,
        center: [surface.centerX, -0.04, surface.centerZ] as const,
        halfExtents: [
          surface.widthM / 2,
          0.06,
          surface.lengthM / 2,
        ] as const,
        rotation: [
          0,
          Math.sin(halfYaw),
          0,
          Math.cos(halfYaw),
        ] as const,
        convexRadiusM: 0.02,
        surface: 'asphalt' as const,
        friction: asphaltFriction,
        restitution: 0,
      });
    },
  );
  return Object.freeze({
    ownerId: APEX_PARKING_COLLISION_OWNER_ID,
    colliders: Object.freeze(colliders),
  });
};

export const createApexWorldStaticCollisionGroups = (
  options: ApexWorldStaticCollisionOptions,
): readonly ApexStaticColliderGroup[] => Object.freeze([
  createApexGlobalFloorCollisionGroup(
    options.floorSizeM,
    options.grassFriction,
  ),
  createApexParkingCollisionGroup(options.asphaltFriction),
]);
