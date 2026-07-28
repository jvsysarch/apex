import * as THREE from 'three/webgpu';
import {
  APEX_PARKING_LAYOUT_VERSION,
  APEX_PARKING_PREVIEW,
  resolveApexParkingBayPosition,
} from '../world/ApexParkingLot';

export interface ApexParkingLotVisual {
  readonly group: THREE.Group;
  readonly bayCount: number;
  setSelectedIndex(index: number): void;
}

export interface ApexParkingLotVisualConfiguration {
  readonly bayCount: number;
  readonly bayLabels: readonly string[];
}

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
  y = 0.057,
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

const createMarkingMesh = (buffers: MarkingBuffers): THREE.Mesh => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(buffers.vertices, 3),
  );
  geometry.setIndex(buffers.indices);
  const material = new THREE.MeshBasicMaterial({
    color: 0xe9eee8,
    transparent: true,
    opacity: 0.82,
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

const createBayLabel = (index: number, name: string): THREE.Mesh => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#06141bcc';
  context.fillRect(10, 14, 492, 164);
  context.strokeStyle = '#79e8f5';
  context.lineWidth = 5;
  context.strokeRect(10, 14, 492, 164);

  context.fillStyle = '#dffcff';
  context.font = '800 82px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText(String(index + 1), 34, 96);

  const label = name.trim().toUpperCase();
  const fontSize = label.length > 18 ? 34 : label.length > 12 ? 42 : 50;
  context.fillStyle = '#9eeaf3';
  context.font = `800 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  context.textAlign = 'center';
  context.fillText(label, 310, 96, 350);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 1.6), material);
  mesh.rotation.x = -Math.PI * 0.5;
  mesh.renderOrder = 5;
  return mesh;
};

export const createApexParkingLotVisual = (
  configuration: ApexParkingLotVisualConfiguration,
): ApexParkingLotVisual => {
  const bayCount = Math.max(1, Math.round(configuration.bayCount));
  const group = new THREE.Group();
  group.name = 'apex-track-start-grid';
  group.userData.apexDriveRole = 'track-start-grid';
  group.userData.layoutVersion = APEX_PARKING_LAYOUT_VERSION;

  const markings: MarkingBuffers = { vertices: [], indices: [] };
  const bayHalfWidthM = APEX_PARKING_PREVIEW.bayWidthM * 0.5;
  const bayHalfLengthM = APEX_PARKING_PREVIEW.bayLengthM * 0.5;
  for (let index = 0; index < bayCount; index += 1) {
    const bay = resolveApexParkingBayPosition(index);
    appendRectangle(
      markings,
      bay.x - bayHalfWidthM,
      bay.z,
      0.12,
      APEX_PARKING_PREVIEW.bayLengthM,
    );
    appendRectangle(
      markings,
      bay.x + bayHalfWidthM,
      bay.z,
      0.12,
      APEX_PARKING_PREVIEW.bayLengthM,
    );
    appendRectangle(
      markings,
      bay.x,
      bay.z - bayHalfLengthM,
      APEX_PARKING_PREVIEW.bayWidthM,
      0.12,
    );
    appendRectangle(
      markings,
      bay.x,
      bay.z + bayHalfLengthM,
      APEX_PARKING_PREVIEW.bayWidthM,
      0.12,
    );
    const label = createBayLabel(
      index,
      configuration.bayLabels[index] ?? `CAR ${index + 1}`,
    );
    label.position.set(
      bay.x,
      0.061,
      bay.z + bayHalfLengthM - 0.9,
    );
    group.add(label);
  }
  group.add(createMarkingMesh(markings));

  const selectedMaterial = new THREE.MeshBasicMaterial({
    color: 0x59d9e7,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const selectedBay = new THREE.Mesh(
    new THREE.PlaneGeometry(
      APEX_PARKING_PREVIEW.bayWidthM - 0.24,
      APEX_PARKING_PREVIEW.bayLengthM - 0.24,
    ),
    selectedMaterial,
  );
  selectedBay.name = 'track-grid-selected-bay';
  selectedBay.rotation.x = -Math.PI * 0.5;
  const firstBay = resolveApexParkingBayPosition(0);
  selectedBay.position.set(firstBay.x, 0.058, firstBay.z);
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
