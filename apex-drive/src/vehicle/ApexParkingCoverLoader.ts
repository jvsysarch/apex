import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { apexDrivePublicUrl } from '../runtime/ApexDrivePublicUrl';

const COVER_ASSET_URI = apexDrivePublicUrl(
  'assets/vehicles/car-covers/scene.gltf',
);
const COVER_WIDTH_M = 2.18;
const COVER_HEIGHT_M = 1.38;
const COVER_LENGTH_M = 4.72;

const cloneCoverMaterial = (material: THREE.Material): THREE.Material => {
  const clone = material.clone();
  if (
    clone instanceof THREE.MeshStandardMaterial
    || clone instanceof THREE.MeshPhysicalMaterial
  ) {
    clone.color.set(0x26323a);
    clone.metalness = 0;
    clone.roughness = 0.92;
    clone.envMapIntensity = 0.72;
    clone.side = THREE.DoubleSide;
    clone.needsUpdate = true;
  }
  return clone;
};

const normalizedCoverVariant = (source: THREE.Mesh): THREE.Group => {
  const material = Array.isArray(source.material)
    ? source.material.map(cloneCoverMaterial)
    : cloneCoverMaterial(source.material);
  const mesh = new THREE.Mesh(source.geometry, material);
  mesh.name = source.name;
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(source.matrixWorld);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const content = new THREE.Group();
  content.add(mesh);
  content.updateMatrixWorld(true);
  const sourceBounds = new THREE.Box3().setFromObject(content);
  const sourceCenter = sourceBounds.getCenter(new THREE.Vector3());
  const sourceSize = sourceBounds.getSize(new THREE.Vector3());
  content.position.set(
    -sourceCenter.x,
    -sourceBounds.min.y,
    -sourceCenter.z,
  );

  const orientation = new THREE.Group();
  orientation.add(content);
  if (sourceSize.x > sourceSize.z) orientation.rotation.y = Math.PI * 0.5;
  orientation.updateMatrixWorld(true);
  const orientedSize = new THREE.Box3()
    .setFromObject(orientation)
    .getSize(new THREE.Vector3());

  const fitted = new THREE.Group();
  fitted.scale.set(
    COVER_WIDTH_M / Math.max(orientedSize.x, 0.001),
    COVER_HEIGHT_M / Math.max(orientedSize.y, 0.001),
    COVER_LENGTH_M / Math.max(orientedSize.z, 0.001),
  );
  fitted.add(orientation);
  return fitted;
};

export class ApexParkingCoverLoader {
  private variantsPromise?: Promise<readonly THREE.Group[]>;

  private loadVariants(): Promise<readonly THREE.Group[]> {
    if (this.variantsPromise) return this.variantsPromise;
    this.variantsPromise = new Promise((resolve, reject) => {
      new GLTFLoader().load(
        COVER_ASSET_URI,
        gltf => {
          gltf.scene.updateMatrixWorld(true);
          const variants: THREE.Group[] = [];
          gltf.scene.traverse(object => {
            if (
              object instanceof THREE.Mesh
              && /^Plane00[1-4]_/.test(object.name)
            ) {
              variants.push(normalizedCoverVariant(object));
            }
          });
          if (variants.length === 0) {
            reject(new Error('El asset no contiene cubiertas utilizables.'));
            return;
          }
          resolve(variants);
        },
        undefined,
        reject,
      );
    });
    return this.variantsPromise;
  }

  async create(
    index: number,
    carId: string,
    x: number,
    y: number,
    z: number,
  ): Promise<THREE.Group> {
    const variants = await this.loadVariants();
    const cover = variants[index % variants.length].clone(true);
    cover.name = `parking-cover-${carId}`;
    cover.position.set(x, y, z);
    cover.userData.apexParkingCover = true;
    cover.userData.apexCarId = carId;
    return cover;
  }
}
