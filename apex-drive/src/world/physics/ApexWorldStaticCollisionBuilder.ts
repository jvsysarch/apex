import type {
  ApexStaticColliderGroup,
  ApexVector3Tuple,
} from '@jvsysarch/apex-physics';

export const APEX_GLOBAL_FLOOR_COLLISION_OWNER_ID = 'world:global-floor';

export interface ApexWorldStaticCollisionOptions {
  readonly floorSizeM: number;
  readonly grassFriction: number;
  readonly terrainMesh?: {
    readonly vertices: readonly ApexVector3Tuple[];
    readonly indices: readonly number[];
  };
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

export const createApexWorldStaticCollisionGroups = (
  options: ApexWorldStaticCollisionOptions,
): readonly ApexStaticColliderGroup[] => {
  if (!options.terrainMesh) {
    return Object.freeze([
      createApexGlobalFloorCollisionGroup(
        options.floorSizeM,
        options.grassFriction,
      ),
    ]);
  }
  return Object.freeze([Object.freeze({
    ownerId: APEX_GLOBAL_FLOOR_COLLISION_OWNER_ID,
    colliders: Object.freeze([Object.freeze({
      id: 'global-floor-carved-terrain',
      kind: 'triangle-mesh' as const,
      vertices: options.terrainMesh.vertices,
      indices: options.terrainMesh.indices,
      activeEdgeCosThresholdAngle: Math.cos(20 * Math.PI / 180),
      surface: 'grass' as const,
      friction: options.grassFriction,
      restitution: 0,
    })]),
  })]);
};
