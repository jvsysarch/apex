import type { SurfaceId } from '../surfaces/SurfaceRegistry.ts';
import type {
  ApexQuaternionTuple,
  ApexVector3Tuple,
} from './ApexVehicleContracts.ts';

export type {
  ApexQuaternionTuple,
  ApexVector3Tuple,
} from './ApexVehicleContracts.ts';

interface ApexStaticColliderBase {
  readonly id: string;
  readonly surface: SurfaceId;
  readonly friction?: number;
  readonly restitution?: number;
}

export interface ApexStaticBoxCollider extends ApexStaticColliderBase {
  readonly kind: 'box';
  readonly center: ApexVector3Tuple;
  readonly halfExtents: ApexVector3Tuple;
  readonly rotation: ApexQuaternionTuple;
  readonly convexRadiusM?: number;
}

export interface ApexStaticConvexHullCollider extends ApexStaticColliderBase {
  readonly kind: 'convex-hull';
  readonly points: readonly ApexVector3Tuple[];
  readonly convexRadiusM?: number;
}

export interface ApexStaticTriangleMeshCollider extends ApexStaticColliderBase {
  readonly kind: 'triangle-mesh';
  readonly vertices: readonly ApexVector3Tuple[];
  readonly indices: readonly number[];
  readonly activeEdgeCosThresholdAngle?: number;
}

export type ApexStaticColliderDescriptor =
  | ApexStaticBoxCollider
  | ApexStaticConvexHullCollider
  | ApexStaticTriangleMeshCollider;

export interface ApexStaticColliderGroup {
  /**
   * Identidad estable del owner. Track, world o una facility deciden el ID;
   * física sólo garantiza reemplazo y retiro atómicos para ese owner.
   */
  readonly ownerId: string;
  readonly colliders: readonly ApexStaticColliderDescriptor[];
}

/**
 * Puerto de entrada para contenido estático.
 *
 * No expone objetos Jolt ni conoce pistas. Sus descriptores son datos
 * numéricos que el runtime físico convierte en bodies estáticos.
 */
export interface ApexStaticWorldPort {
  replaceStaticColliderGroup(group: ApexStaticColliderGroup): void;
  removeStaticColliderGroup(ownerId: string): void;
  retainStaticColliderGroups(ownerIds: ReadonlySet<string>): void;
}
