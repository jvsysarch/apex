import * as THREE from 'three/webgpu';
import {
  APEX_PARKING_LAYOUT_VERSION,
  APEX_PARKING_LOT,
  APEX_PARKING_PREVIEW,
  APEX_PIT_LANE,
  resolveApexParkingBayPosition,
  type ApexParkingSurface,
} from '../world/ApexParkingLot';

export interface ApexParkingLotVisual {
  readonly group: THREE.Group;
  readonly bayCount: number;
  setSelectedIndex(index: number): void;
}

export interface ApexParkingLotVisualConfiguration {
  readonly roadMaterial: THREE.Material;
  readonly roadTextureSizeM: number;
  readonly bayCount: number;
}

type MarkingLayer = 'white' | 'yellow' | 'cyan';

interface MarkingBuffers {
  readonly vertices: number[];
  readonly indices: number[];
}

const appendRectangle = (
  buffers: MarkingBuffers,
  centerX: number,
  centerZ: number,
  widthM: number,
  lengthM: number,
  y = 0.044,
): void => {
  const halfWidthM = widthM * 0.5;
  const halfLengthM = lengthM * 0.5;
  const base = buffers.vertices.length / 3;
  buffers.vertices.push(
    centerX - halfWidthM, y, centerZ - halfLengthM,
    centerX + halfWidthM, y, centerZ - halfLengthM,
    centerX - halfWidthM, y, centerZ + halfLengthM,
    centerX + halfWidthM, y, centerZ + halfLengthM,
  );
  buffers.indices.push(
    base, base + 2, base + 1,
    base + 1, base + 2, base + 3,
  );
};

const appendChevron = (
  buffers: MarkingBuffers,
  centerX: number,
  centerZ: number,
): void => {
  // Flecha hacia la salida occidental. Dos trazos forman un chevron abierto.
  const lengthM = 2.6;
  const widthM = 2.4;
  const thicknessM = 0.22;
  const appendArm = (
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
  ) => {
    const deltaX = endX - startX;
    const deltaZ = endZ - startZ;
    const magnitude = Math.hypot(deltaX, deltaZ) || 1;
    const perpendicularX = -deltaZ / magnitude * thicknessM * 0.5;
    const perpendicularZ = deltaX / magnitude * thicknessM * 0.5;
    const base = buffers.vertices.length / 3;
    buffers.vertices.push(
      startX + perpendicularX, 0.047, startZ + perpendicularZ,
      startX - perpendicularX, 0.047, startZ - perpendicularZ,
      endX + perpendicularX, 0.047, endZ + perpendicularZ,
      endX - perpendicularX, 0.047, endZ - perpendicularZ,
    );
    buffers.indices.push(
      base, base + 1, base + 2,
      base + 1, base + 3, base + 2,
    );
  };
  appendArm(
    centerX + lengthM * 0.5,
    centerZ - widthM * 0.5,
    centerX - lengthM * 0.5,
    centerZ,
  );
  appendArm(
    centerX + lengthM * 0.5,
    centerZ + widthM * 0.5,
    centerX - lengthM * 0.5,
    centerZ,
  );
};

const createSurfaceMesh = (
  surface: ApexParkingSurface,
  material: THREE.Material,
  textureSizeM: number,
): THREE.Mesh => {
  const geometry = new THREE.PlaneGeometry(surface.widthM, surface.lengthM);
  geometry.rotateX(-Math.PI / 2);
  const uvs = geometry.getAttribute('uv');
  for (let index = 0; index < uvs.count; index += 1) {
    uvs.setXY(
      index,
      uvs.getX(index) * surface.widthM / textureSizeM,
      uvs.getY(index) * surface.lengthM / textureSizeM,
    );
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(surface.centerX, 0.024, surface.centerZ);
  mesh.rotation.y = THREE.MathUtils.degToRad(surface.yawDegrees);
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  mesh.userData.surface = 'asphalt';
  return mesh;
};

const createMarkingMesh = (
  buffers: MarkingBuffers,
  color: number,
  opacity: number,
): THREE.Mesh => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(buffers.vertices, 3),
  );
  geometry.setIndex(buffers.indices);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -5,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 4;
  return mesh;
};

const createBayNumber = (index: number): THREE.Mesh => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#071218cc';
  context.fillRect(16, 16, 224, 96);
  context.strokeStyle = '#79e8f5';
  context.lineWidth = 5;
  context.strokeRect(16, 16, 224, 96);
  context.fillStyle = '#dffcff';
  context.font = '700 62px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(index + 1).padStart(2, '0'), 128, 67);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.72), material);
  mesh.rotation.x = -Math.PI * 0.5;
  mesh.renderOrder = 5;
  return mesh;
};

export const createApexParkingLotVisual = (
  configuration: ApexParkingLotVisualConfiguration,
): ApexParkingLotVisual => {
  const bayCount = Math.max(1, Math.round(configuration.bayCount));
  const group = new THREE.Group();
  group.name = 'apex-parking-paddock';
  group.userData.apexDriveRole = 'parking-paddock';
  group.userData.layoutVersion = APEX_PARKING_LAYOUT_VERSION;

  group.add(
    createSurfaceMesh(
      APEX_PARKING_LOT,
      configuration.roadMaterial,
      configuration.roadTextureSizeM,
    ),
    ...APEX_PIT_LANE.map(surface => createSurfaceMesh(
      surface,
      configuration.roadMaterial,
      configuration.roadTextureSizeM,
    )),
  );

  const layers: Record<MarkingLayer, MarkingBuffers> = {
    white: { vertices: [], indices: [] },
    yellow: { vertices: [], indices: [] },
    cyan: { vertices: [], indices: [] },
  };
  const bayHalfWidthM = APEX_PARKING_PREVIEW.bayWidthM * 0.5;
  const bayHalfLengthM = APEX_PARKING_PREVIEW.bayLengthM * 0.5;
  for (let index = 0; index < bayCount; index += 1) {
    const bay = resolveApexParkingBayPosition(index);
    const centerX = bay.x;
    const centerZ = bay.z;
    appendRectangle(
      layers.white,
      centerX - bayHalfWidthM,
      centerZ,
      0.13,
      APEX_PARKING_PREVIEW.bayLengthM,
    );
    appendRectangle(
      layers.white,
      centerX + bayHalfWidthM,
      centerZ,
      0.13,
      APEX_PARKING_PREVIEW.bayLengthM,
    );
    appendRectangle(
      layers.white,
      centerX,
      centerZ + bayHalfLengthM,
      APEX_PARKING_PREVIEW.bayWidthM,
      0.13,
    );
    const bayNumber = createBayNumber(index);
    bayNumber.position.set(centerX, 0.052, centerZ + bayHalfLengthM - 0.52);
    group.add(bayNumber);
  }

  const lotMinimumX = APEX_PARKING_LOT.centerX - APEX_PARKING_LOT.widthM * 0.5;
  const lotMaximumX = APEX_PARKING_LOT.centerX + APEX_PARKING_LOT.widthM * 0.5;
  const lotMinimumZ = APEX_PARKING_LOT.centerZ - APEX_PARKING_LOT.lengthM * 0.5;
  const lotMaximumZ = APEX_PARKING_LOT.centerZ + APEX_PARKING_LOT.lengthM * 0.5;
  appendRectangle(
    layers.white,
    APEX_PARKING_LOT.centerX,
    lotMaximumZ - 0.22,
    APEX_PARKING_LOT.widthM - 0.5,
    0.18,
  );
  appendRectangle(
    layers.white,
    APEX_PARKING_LOT.centerX,
    lotMinimumZ + 0.22,
    APEX_PARKING_LOT.widthM - 0.5,
    0.18,
  );
  appendRectangle(
    layers.white,
    lotMaximumX - 0.22,
    APEX_PARKING_LOT.centerZ,
    0.18,
    APEX_PARKING_LOT.lengthM - 0.5,
  );

  for (
    let centerX = APEX_PARKING_PREVIEW.exitX + 3;
    centerX < lotMaximumX - 2;
    centerX += 6
  ) {
    appendRectangle(
      layers.yellow,
      centerX,
      APEX_PARKING_PREVIEW.aisleCenterZ,
      3.2,
      0.16,
    );
  }
  appendRectangle(
    layers.cyan,
    2,
    APEX_PARKING_PREVIEW.aisleCenterZ - 3.75,
    12,
    0.12,
  );
  appendRectangle(
    layers.cyan,
    2,
    APEX_PARKING_PREVIEW.aisleCenterZ + 3.75,
    12,
    0.12,
  );
  appendChevron(layers.yellow, 24, APEX_PARKING_PREVIEW.aisleCenterZ);
  appendChevron(layers.yellow, 48, APEX_PARKING_PREVIEW.aisleCenterZ);

  group.add(
    createMarkingMesh(layers.white, 0xe9eee8, 0.82),
    createMarkingMesh(layers.yellow, 0xf2c84b, 0.9),
    createMarkingMesh(layers.cyan, 0x61dce9, 0.82),
  );

  const selectedMaterial = new THREE.MeshBasicMaterial({
    color: 0x59d9e7,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const selectedBay = new THREE.Mesh(
    new THREE.PlaneGeometry(
      APEX_PARKING_PREVIEW.bayWidthM - 0.3,
      APEX_PARKING_PREVIEW.bayLengthM - 0.3,
    ),
    selectedMaterial,
  );
  selectedBay.name = 'parking-selected-bay';
  selectedBay.rotation.x = -Math.PI * 0.5;
  const firstBay = resolveApexParkingBayPosition(0);
  selectedBay.position.set(
    firstBay.x,
    0.041,
    firstBay.z,
  );
  selectedBay.renderOrder = 3;
  group.add(selectedBay);

  return Object.freeze({
    group,
    bayCount,
    setSelectedIndex(index: number) {
      const safeIndex = THREE.MathUtils.clamp(
        Math.round(index),
        0,
        bayCount - 1,
      );
      const bay = resolveApexParkingBayPosition(safeIndex);
      selectedBay.position.x = bay.x;
      selectedBay.position.z = bay.z;
      group.userData.selectedBay = safeIndex;
    },
  });
};
