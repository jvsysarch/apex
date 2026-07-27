import type {
  ApexQuaternionTuple,
  ApexStaticBoxCollider,
  ApexStaticColliderDescriptor,
  ApexStaticColliderGroup,
  ApexStaticConvexHullCollider,
  ApexStaticTriangleMeshCollider,
  ApexStaticWorldPort,
} from '../contracts/ApexStaticWorldContracts.ts';
import {
  SurfaceRegistry,
  type SurfaceId,
} from '../surfaces/SurfaceRegistry.ts';

const IDENTITY_ROTATION: ApexQuaternionTuple = [0, 0, 0, 1];

/**
 * Traduce descriptores estáticos numéricos a bodies Jolt.
 *
 * El adapter conserva ownership por grupo y mantiene actualizado el mapa de
 * superficies que consume el contacto de neumáticos.
 */
export class ApexJoltStaticWorldAdapter implements ApexStaticWorldPort {
  private readonly J: any;
  private readonly bodyInterface: any;
  private readonly surfaceRegistry: SurfaceRegistry;
  private readonly surfaceByBodyId: Map<number, SurfaceId>;
  private readonly staticLayer: number;
  private readonly bodiesByOwnerId = new Map<string, any[]>();

  constructor(
    J: any,
    bodyInterface: any,
    surfaceRegistry: SurfaceRegistry,
    surfaceByBodyId: Map<number, SurfaceId>,
    staticLayer: number,
  ) {
    this.J = J;
    this.bodyInterface = bodyInterface;
    this.surfaceRegistry = surfaceRegistry;
    this.surfaceByBodyId = surfaceByBodyId;
    this.staticLayer = staticLayer;
  }

  replaceStaticColliderGroup(group: ApexStaticColliderGroup): void {
    const ownerId = group.ownerId.trim();
    if (!ownerId) {
      throw new Error('Un grupo de colisión estática requiere ownerId');
    }

    const stagedBodies: Array<{
      readonly body: any;
      readonly surface: SurfaceId;
    }> = [];
    try {
      for (const descriptor of group.colliders) {
        stagedBodies.push({
          body: this.createBody(descriptor),
          surface: descriptor.surface,
        });
      }
    } catch (error) {
      stagedBodies.forEach(({ body }) => {
        this.bodyInterface.DestroyBody(body.GetID());
      });
      throw error;
    }

    this.removeStaticColliderGroup(ownerId);
    for (const { body, surface } of stagedBodies) {
      const bodyId = body.GetID();
      this.bodyInterface.AddBody(
        bodyId,
        this.J.EActivation_DontActivate,
      );
      this.surfaceByBodyId.set(
        bodyId.GetIndexAndSequenceNumber(),
        surface,
      );
    }
    this.bodiesByOwnerId.set(
      ownerId,
      stagedBodies.map(({ body }) => body),
    );
  }

  removeStaticColliderGroup(ownerId: string): void {
    const bodies = this.bodiesByOwnerId.get(ownerId);
    if (!bodies) return;

    for (const body of bodies) {
      const bodyId = body.GetID();
      this.surfaceByBodyId.delete(bodyId.GetIndexAndSequenceNumber());
      this.bodyInterface.RemoveBody(bodyId);
      this.bodyInterface.DestroyBody(bodyId);
    }
    this.bodiesByOwnerId.delete(ownerId);
  }

  retainStaticColliderGroups(ownerIds: ReadonlySet<string>): void {
    for (const ownerId of [...this.bodiesByOwnerId.keys()]) {
      if (!ownerIds.has(ownerId)) {
        this.removeStaticColliderGroup(ownerId);
      }
    }
  }

  private createBody(descriptor: ApexStaticColliderDescriptor): any {
    const body = descriptor.kind === 'box'
      ? this.createBoxBody(descriptor)
      : descriptor.kind === 'convex-hull'
        ? this.createConvexHullBody(descriptor)
        : this.createTriangleMeshBody(descriptor);
    const surface = this.surfaceRegistry.get(descriptor.surface);
    body.SetFriction(
      descriptor.friction
        ?? (surface.longitudinalMu + surface.lateralMu) * 0.5,
    );
    body.SetRestitution(descriptor.restitution ?? 0);
    return body;
  }

  private createBoxBody(descriptor: ApexStaticBoxCollider): any {
    const J = this.J;
    const halfExtents = new J.Vec3(...descriptor.halfExtents);
    const shape = new J.BoxShape(
      halfExtents,
      descriptor.convexRadiusM ?? 0.02,
      null,
    );
    J.destroy(halfExtents);
    return this.createBodyFromShape(
      shape,
      descriptor.center,
      descriptor.rotation,
    );
  }

  private createConvexHullBody(
    descriptor: ApexStaticConvexHullCollider,
  ): any {
    if (descriptor.points.length < 4) {
      throw new Error(
        `Convex hull ${descriptor.id} requiere al menos cuatro puntos`,
      );
    }
    const J = this.J;
    const hullSettings = new J.ConvexHullShapeSettings();
    const hullPoint = new J.Vec3();
    for (const point of descriptor.points) {
      hullPoint.Set(...point);
      hullSettings.mPoints.push_back(hullPoint);
    }
    hullSettings.mMaxConvexRadius = descriptor.convexRadiusM ?? 0.015;
    J.destroy(hullPoint);

    const result = hullSettings.Create();
    if (result.HasError()) {
      const message = result.GetError();
      J.destroy(result);
      J.destroy(hullSettings);
      throw new Error(
        `No se pudo crear convex hull ${descriptor.id}: ${message}`,
      );
    }
    const body = this.createBodyFromShape(
      result.Get(),
      [0, 0, 0],
      IDENTITY_ROTATION,
    );
    J.destroy(result);
    J.destroy(hullSettings);
    return body;
  }

  private createTriangleMeshBody(
    descriptor: ApexStaticTriangleMeshCollider,
  ): any {
    if (descriptor.indices.length === 0 || descriptor.indices.length % 3 !== 0) {
      throw new Error(
        `Triangle mesh ${descriptor.id} requiere índices en grupos de tres`,
      );
    }
    const J = this.J;
    const triangleCount = descriptor.indices.length / 3;
    const triangles = new J.TriangleList();
    triangles.resize(triangleCount);

    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
      const triangle = triangles.at(triangleIndex);
      for (let vertexIndex = 0; vertexIndex < 3; vertexIndex += 1) {
        const sourceIndex = descriptor.indices[triangleIndex * 3 + vertexIndex];
        const source = descriptor.vertices[sourceIndex];
        if (!source) {
          J.destroy(triangles);
          throw new Error(
            `Triangle mesh ${descriptor.id} referencia el vértice ${sourceIndex}`,
          );
        }
        const vertex = triangle.get_mV(vertexIndex);
        vertex.x = source[0];
        vertex.y = source[1];
        vertex.z = source[2];
      }
    }

    const materials = new J.PhysicsMaterialList();
    const meshSettings = new J.MeshShapeSettings(triangles, materials);
    if (Number.isFinite(descriptor.activeEdgeCosThresholdAngle)) {
      meshSettings.mActiveEdgeCosThresholdAngle = (
        descriptor.activeEdgeCosThresholdAngle!
      );
    }
    const result = meshSettings.Create();
    if (result.HasError()) {
      const message = result.GetError();
      J.destroy(result);
      J.destroy(meshSettings);
      J.destroy(materials);
      J.destroy(triangles);
      throw new Error(
        `No se pudo crear triangle mesh ${descriptor.id}: ${message}`,
      );
    }
    const body = this.createBodyFromShape(
      result.Get(),
      [0, 0, 0],
      IDENTITY_ROTATION,
    );
    J.destroy(result);
    J.destroy(meshSettings);
    J.destroy(materials);
    J.destroy(triangles);
    return body;
  }

  private createBodyFromShape(
    shape: any,
    center: readonly [number, number, number],
    rotation: ApexQuaternionTuple,
  ): any {
    const J = this.J;
    const position = new J.RVec3(...center);
    const orientation = new J.Quat(...rotation);
    const settings = new J.BodyCreationSettings(
      shape,
      position,
      orientation,
      J.EMotionType_Static,
      this.staticLayer,
    );
    const body = this.bodyInterface.CreateBody(settings);
    J.destroy(settings);
    J.destroy(orientation);
    J.destroy(position);
    return body;
  }
}
