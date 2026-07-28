import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { apexDrivePublicUrl } from '../runtime/ApexDrivePublicUrl';

export const APEX_DIRT_ROAD_FOREST_ASSET_URI = (
  apexDrivePublicUrl('assets/tracks/dirt-road-through-forest/scene.gltf')
);
export const APEX_DIRT_ROAD_FOREST_CENTER_X_M = 0;
export const APEX_DIRT_ROAD_FOREST_CENTER_Z_M = 0;
export const APEX_DIRT_ROAD_FOREST_GROUND_Y_M = 0;

const CUTOUT_MATERIALS = new Set([
  'Background_Tree_Atlas',
  'Metal_Fence',
  'Fallen_Generic_Leaves',
  'Forest_Bush',
  'Grass_Vegetation_Dry',
  'Grass_Vegetation_Green',
  'Fallen_Maple_Leaves',
]);

const OVERLAY_MATERIALS = new Set([
  'Rock_Decal',
  'Dirt_Road_Trails',
  'Road_Edge_Gravel_Dusty',
  'Puddle_Streaks',
  'Dirt_Road',
]);

const GROUND_MESH_PATTERN = (
  /Dirt_Road|Ground_Dirt|Terrain_Far|Aerial_Grass|Grass_Close|Mud_Pile|Cobblestone/
);
const ROAD_SNAP_MESH_PATTERN = (
  /(?:Dirt_Road_Bare|Dirt_Road_Trails|Dirt_Road)_0$/
);
const ROAD_SNAP_SEARCH_RADII_M = [0, 0.75, 1.5, 3, 5] as const;
const ROAD_SNAP_DIRECTIONS = 12;
const ROAD_SNAP_RAY_HEIGHT_M = 180;
const ROAD_SNAP_RAY_DEPTH_M = 420;

export interface ApexDirtRoadForestVisualSummary {
  readonly meshCount: number;
  readonly materialCount: number;
  readonly triangleCount: number;
  readonly sizeM: readonly [number, number, number];
  readonly centerM: readonly [number, number, number];
}

export interface ApexDirtRoadForestVisual {
  readonly group: THREE.Group;
  readonly ready: Promise<ApexDirtRoadForestVisualSummary>;
  readonly snapToRoad: (
    position: THREE.Vector3,
  ) => Promise<ApexDirtRoadForestRoadSnap | undefined>;
}

export interface ApexDirtRoadForestRoadSnap {
  readonly position: THREE.Vector3;
  readonly normal: THREE.Vector3;
  readonly sourceName: string;
  readonly horizontalDistanceM: number;
}

const configureMaterial = (material: THREE.Material): void => {
  if (
    !(
      material instanceof THREE.MeshStandardMaterial
      || material instanceof THREE.MeshPhysicalMaterial
    )
  ) return;

  if (CUTOUT_MATERIALS.has(material.name)) {
    material.transparent = false;
    material.opacity = 1;
    material.alphaTest = 0.34;
    material.depthWrite = true;
  } else if (OVERLAY_MATERIALS.has(material.name)) {
    material.transparent = true;
    material.depthWrite = false;
    material.polygonOffset = true;
    material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -2;
  }
  material.needsUpdate = true;
};

export const createApexDirtRoadForestVisual = (): ApexDirtRoadForestVisual => {
  const group = new THREE.Group();
  group.name = 'apex-dirt-road-through-forest';
  group.userData.version = 'visual-import-v2-road-snap';
  group.userData.assetUri = APEX_DIRT_ROAD_FOREST_ASSET_URI;
  group.userData.collision = 'visual-only';
  const roadSnapMeshes: THREE.Mesh[] = [];

  const ready = new Promise<ApexDirtRoadForestVisualSummary>((resolve, reject) => {
    new GLTFLoader().load(
      APEX_DIRT_ROAD_FOREST_ASSET_URI,
      gltf => {
        const model = gltf.scene;
        const materials = new Set<THREE.Material>();
        let meshCount = 0;
        let triangleCount = 0;

        model.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          meshCount += 1;
          const index = object.geometry.getIndex();
          const positions = object.geometry.getAttribute('position');
          triangleCount += index
            ? Math.floor(index.count / 3)
            : Math.floor(positions.count / 3);
          object.castShadow = false;
          object.receiveShadow = GROUND_MESH_PATTERN.test(object.name);
          object.frustumCulled = true;
          if (ROAD_SNAP_MESH_PATTERN.test(object.name)) {
            roadSnapMeshes.push(object);
          }
          const objectMaterials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          object.renderOrder = objectMaterials.some(material => (
            OVERLAY_MATERIALS.has(material.name)
          )) ? 2 : 0;
          objectMaterials.forEach(material => {
            materials.add(material);
            configureMaterial(material);
          });
        });

        model.updateMatrixWorld(true);
        const sourceBounds = new THREE.Box3().setFromObject(model);
        const sourceCenter = sourceBounds.getCenter(new THREE.Vector3());
        model.position.add(new THREE.Vector3(
          APEX_DIRT_ROAD_FOREST_CENTER_X_M - sourceCenter.x,
          APEX_DIRT_ROAD_FOREST_GROUND_Y_M - sourceBounds.min.y,
          APEX_DIRT_ROAD_FOREST_CENTER_Z_M - sourceCenter.z,
        ));
        model.updateMatrixWorld(true);
        const positionedBounds = new THREE.Box3().setFromObject(model);
        const positionedCenter = positionedBounds.getCenter(new THREE.Vector3());
        const positionedSize = positionedBounds.getSize(new THREE.Vector3());
        const sizeM = Object.freeze([
          positionedSize.x,
          positionedSize.y,
          positionedSize.z,
        ] as const);
        const centerM = Object.freeze([
          positionedCenter.x,
          positionedCenter.y,
          positionedCenter.z,
        ] as const);
        group.add(model);
        group.userData.meshCount = meshCount;
        group.userData.materialCount = materials.size;
        group.userData.triangleCount = triangleCount;
        group.userData.sizeM = sizeM;
        group.userData.roadSnapMeshCount = roadSnapMeshes.length;
        resolve(Object.freeze({
          meshCount,
          materialCount: materials.size,
          triangleCount,
          sizeM,
          centerM,
        }));
      },
      undefined,
      reject,
    );
  });

  const snapRaycaster = new THREE.Raycaster();
  const snapOrigin = new THREE.Vector3();
  const snapDirection = new THREE.Vector3(0, -1, 0);
  const snapNormalMatrix = new THREE.Matrix3();
  const snapCandidatePosition = new THREE.Vector3();
  const snapToRoad = async (
    position: THREE.Vector3,
  ): Promise<ApexDirtRoadForestRoadSnap | undefined> => {
    await ready;
    group.updateMatrixWorld(true);
    let best:
      | {
        readonly position: THREE.Vector3;
        readonly normal: THREE.Vector3;
        readonly sourceName: string;
        readonly horizontalDistanceM: number;
        readonly score: number;
      }
      | undefined;

    for (const radiusM of ROAD_SNAP_SEARCH_RADII_M) {
      const sampleCount = radiusM === 0 ? 1 : ROAD_SNAP_DIRECTIONS;
      for (let sample = 0; sample < sampleCount; sample += 1) {
        const angle = sample / sampleCount * Math.PI * 2;
        snapCandidatePosition.set(
          position.x + Math.cos(angle) * radiusM,
          position.y,
          position.z + Math.sin(angle) * radiusM,
        );
        snapOrigin.set(
          snapCandidatePosition.x,
          Math.max(
            position.y + ROAD_SNAP_RAY_HEIGHT_M,
            ROAD_SNAP_RAY_HEIGHT_M,
          ),
          snapCandidatePosition.z,
        );
        snapRaycaster.set(snapOrigin, snapDirection);
        snapRaycaster.far = ROAD_SNAP_RAY_DEPTH_M;
        const hits = snapRaycaster.intersectObjects(roadSnapMeshes, false);
        for (const hit of hits) {
          if (!(hit.object instanceof THREE.Mesh) || !hit.face) continue;
          // La normal interpolada evita copiar el ruido de una sola cara del
          // camino triangulado. Si no existe, usamos la normal plana.
          const normal = (hit.normal ?? hit.face.normal).clone().applyMatrix3(
            snapNormalMatrix.getNormalMatrix(hit.object.matrixWorld),
          ).normalize();
          if (normal.y < 0) normal.negate();
          if (normal.y < 0.2) continue;
          const horizontalDistanceM = Math.hypot(
            hit.point.x - position.x,
            hit.point.z - position.z,
          );
          const score = (
            horizontalDistanceM * 3
            + Math.abs(hit.point.y - position.y)
          );
          if (best && best.score <= score) continue;
          best = {
            position: hit.point.clone(),
            normal,
            sourceName: hit.object.name,
            horizontalDistanceM,
            score,
          };
        }
      }
      // Un impacto exactamente debajo del nodo siempre tiene prioridad.
      if (
        radiusM === 0
        && best
        && best.horizontalDistanceM <= 0.0001
      ) break;
    }
    if (!best) return undefined;
    return Object.freeze({
      position: best.position,
      normal: best.normal,
      sourceName: best.sourceName,
      horizontalDistanceM: best.horizontalDistanceM,
    });
  };

  return Object.freeze({ group, ready, snapToRoad });
};
