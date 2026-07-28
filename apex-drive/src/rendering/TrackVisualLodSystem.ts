import * as THREE from 'three/webgpu';

export type TrackLodStripVisibility = (
  currentSample: number,
  nextSample: number,
  firstOffset: number,
  secondOffset: number,
) => boolean;

export interface TrackLodLayer {
  readonly name: string;
  readonly geometry: THREE.BufferGeometry;
  readonly materials: readonly THREE.Material[];
  readonly ringVertexCount: number;
  readonly strips: readonly (readonly [number, number])[];
  readonly stripsByLevel?: readonly (
    readonly (readonly [number, number])[]
  )[];
  readonly stripVisible?: TrackLodStripVisibility;
  readonly stripVisibleByLevel?: readonly (
    TrackLodStripVisibility | null
  )[];
  readonly maximumLevel?: number;
  readonly receiveShadow?: boolean;
  readonly renderOrder?: number;
  readonly surface?: string;
}

export interface TrackVisualLodConfiguration {
  readonly samplePoints: readonly THREE.Vector3[];
  readonly chunkSampleSpan: number;
  readonly boundsPaddingM: number;
  readonly maximumVisibleDistanceM?: number;
  readonly levels: readonly {
    readonly distanceM: number;
    readonly sampleStep: number;
  }[];
  readonly layers: readonly TrackLodLayer[];
}

export interface TrackVisualLodSnapshot {
  readonly visibleChunkCount: number;
  readonly activeMeshCount: number;
  readonly activeTriangleCount: number;
  readonly chunksByLevel: readonly number[];
}

export interface TrackVisualLodResult {
  readonly root: THREE.Group;
  readonly chunkCount: number;
  readonly levelCount: number;
  readonly meshCount: number;
  readonly fullResolutionTriangleCount: number;
  update(camera: THREE.Camera): TrackVisualLodSnapshot;
  snapshot(): TrackVisualLodSnapshot;
}

const chunkSampleIndices = (
  start: number,
  end: number,
  step: number,
): number[] => {
  const indices: number[] = [];
  for (let sample = start; sample < end; sample += step) {
    indices.push(sample);
  }
  if (indices[indices.length - 1] !== end) indices.push(end);
  return indices;
};

const layerIndices = (
  samples: readonly number[],
  sampleCount: number,
  ringVertexCount: number,
  strips: readonly (readonly [number, number])[],
  stripVisible?: TrackLodLayer['stripVisible'],
): number[] => {
  const indices: number[] = [];
  for (let sampleIndex = 0; sampleIndex < samples.length - 1; sampleIndex += 1) {
    const current = (samples[sampleIndex] % sampleCount) * ringVertexCount;
    const next = (samples[sampleIndex + 1] % sampleCount) * ringVertexCount;
    const currentSample = samples[sampleIndex] % sampleCount;
    const nextSample = samples[sampleIndex + 1] % sampleCount;
    for (const [firstOffset, secondOffset] of strips) {
      if (
        stripVisible
        && !stripVisible(
          currentSample,
          nextSample,
          firstOffset,
          secondOffset,
        )
      ) continue;
      const first = current + firstOffset;
      const second = current + secondOffset;
      const nextFirst = next + firstOffset;
      const nextSecond = next + secondOffset;
      indices.push(
        first, nextFirst, second,
        second, nextFirst, nextSecond,
      );
    }
  }
  return indices;
};

const indexedView = (
  source: THREE.BufferGeometry,
  indices: readonly number[],
  bounds: THREE.Box3,
  sphere: THREE.Sphere,
): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  for (const attributeName of Object.keys(source.attributes)) {
    geometry.setAttribute(
      attributeName,
      source.getAttribute(attributeName),
    );
  }
  geometry.setIndex(new THREE.Uint32BufferAttribute(indices, 1));
  geometry.boundingBox = bounds.clone();
  geometry.boundingSphere = sphere.clone();
  return geometry;
};

/**
 * Divide una pista cerrada en sectores con LOD independiente. Los atributos
 * GPU se comparten entre chunks; cada nivel sólo agrega su índice reducido.
 */
export const createTrackVisualLodSystem = (
  configuration: TrackVisualLodConfiguration,
): TrackVisualLodResult => {
  const root = new THREE.Group();
  root.name = 'track-visual-lod-root';
  const sampleCount = configuration.samplePoints.length;
  const chunkCount = Math.ceil(sampleCount / configuration.chunkSampleSpan);
  const runtimeChunks: Array<{
    readonly lod: THREE.LOD;
    readonly bounds: THREE.Box3;
    readonly center: THREE.Vector3;
    readonly levelDistancesM: readonly number[];
    readonly levelTriangleCounts: readonly number[];
    readonly levelMeshCounts: readonly number[];
  }> = [];
  let meshCount = 0;
  let fullResolutionTriangleCount = 0;

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const start = chunkIndex * configuration.chunkSampleSpan;
    const end = Math.min(
      sampleCount,
      start + configuration.chunkSampleSpan,
    );
    const boundsPoints = chunkSampleIndices(start, end, 1).map(
      sample => configuration.samplePoints[sample % sampleCount],
    );
    const bounds = new THREE.Box3()
      .setFromPoints(boundsPoints)
      .expandByScalar(configuration.boundsPaddingM);
    const center = bounds.getCenter(new THREE.Vector3());
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const lod = new THREE.LOD();
    lod.name = `track-lod-chunk-${String(chunkIndex).padStart(3, '0')}`;
    lod.position.copy(center);
    lod.autoUpdate = false;
    const levelTriangleCounts = configuration.levels.map(() => 0);
    const levelMeshCounts = configuration.levels.map(() => 0);

    configuration.levels.forEach((level, levelIndex) => {
      const levelGroup = new THREE.Group();
      levelGroup.name = `${lod.name}-level-${levelIndex}`;
      const samples = chunkSampleIndices(
        start,
        end,
        Math.max(1, level.sampleStep),
      );
      for (const layer of configuration.layers) {
        if (
          layer.maximumLevel !== undefined
          && levelIndex > layer.maximumLevel
        ) {
          continue;
        }
        const strips = layer.stripsByLevel?.[levelIndex] ?? layer.strips;
        const levelStripVisibility = (
          layer.stripVisibleByLevel?.[levelIndex]
        );
        const stripVisibility = levelStripVisibility === null
          ? undefined
          : levelStripVisibility ?? layer.stripVisible;
        const indices = layerIndices(
          samples,
          sampleCount,
          layer.ringVertexCount,
          strips,
          stripVisibility,
        );
        if (indices.length === 0) continue;
        const geometry = indexedView(
          layer.geometry,
          indices,
          bounds,
          sphere,
        );
        const material = (
          layer.materials[levelIndex]
          ?? layer.materials[layer.materials.length - 1]
        );
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `${layer.name}-chunk-${chunkIndex}-level-${levelIndex}`;
        mesh.position.copy(center).multiplyScalar(-1);
        mesh.receiveShadow = (
          (layer.receiveShadow ?? true) && levelIndex === 0
        );
        mesh.renderOrder = layer.renderOrder ?? 0;
        if (layer.surface) mesh.userData.surface = layer.surface;
        levelGroup.add(mesh);
        meshCount += 1;
        levelMeshCounts[levelIndex] = (
          (levelMeshCounts[levelIndex] ?? 0) + 1
        );
        levelTriangleCounts[levelIndex] = (
          (levelTriangleCounts[levelIndex] ?? 0) + indices.length / 3
        );
      }
      lod.addLevel(levelGroup, level.distanceM, 0.12);
    });
    fullResolutionTriangleCount += levelTriangleCounts[0] ?? 0;
    root.add(lod);
    runtimeChunks.push({
      lod,
      bounds,
      center,
      levelDistancesM: configuration.levels.map(level => level.distanceM),
      levelTriangleCounts,
      levelMeshCounts,
    });
  }

  const cameraForward = new THREE.Vector3();
  const cameraToChunk = new THREE.Vector3();
  const projectionView = new THREE.Matrix4();
  const frustum = new THREE.Frustum();
  let latestSnapshot: TrackVisualLodSnapshot = Object.freeze({
    visibleChunkCount: 0,
    activeMeshCount: 0,
    activeTriangleCount: 0,
    chunksByLevel: Object.freeze(configuration.levels.map(() => 0)),
  });
  const update = (camera: THREE.Camera) => {
    camera.updateMatrixWorld();
    root.updateMatrixWorld(true);
    projectionView.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    frustum.setFromProjectionMatrix(
      projectionView,
      camera.coordinateSystem,
    );
    camera.getWorldDirection(cameraForward);
    let visibleChunkCount = 0;
    let activeMeshCount = 0;
    let activeTriangleCount = 0;
    const chunksByLevel = configuration.levels.map(() => 0);
    runtimeChunks.forEach(chunk => {
      cameraToChunk.subVectors(chunk.center, camera.position);
      const distanceM = cameraToChunk.length();
      const viewAlignment = distanceM > 0.001
        ? cameraToChunk.dot(cameraForward) / distanceM
        : 1;
      const behindCamera = viewAlignment < -0.18 && distanceM > 135;
      const beyondMaximumDistance = (
        configuration.maximumVisibleDistanceM !== undefined
        && distanceM > configuration.maximumVisibleDistanceM
      );
      chunk.lod.visible = (
        !behindCamera
        && !beyondMaximumDistance
        && frustum.intersectsBox(chunk.bounds)
      );
      if (!chunk.lod.visible) return;
      const visibleQualityScale = viewAlignment > 0.15
        ? 1.15
        : 0.9;
      chunk.lod.levels.forEach((level, levelIndex) => {
        level.distance = (
          chunk.levelDistancesM[levelIndex] * visibleQualityScale
        );
      });
      chunk.lod.update(camera);
      const levelIndex = THREE.MathUtils.clamp(
        chunk.lod.getCurrentLevel(),
        0,
        chunk.levelTriangleCounts.length - 1,
      );
      visibleChunkCount += 1;
      activeMeshCount += chunk.levelMeshCounts[levelIndex] ?? 0;
      activeTriangleCount += chunk.levelTriangleCounts[levelIndex] ?? 0;
      chunksByLevel[levelIndex] = (chunksByLevel[levelIndex] ?? 0) + 1;
    });
    latestSnapshot = Object.freeze({
      visibleChunkCount,
      activeMeshCount,
      activeTriangleCount,
      chunksByLevel: Object.freeze(chunksByLevel),
    });
    return latestSnapshot;
  };

  return Object.freeze({
    root,
    chunkCount,
    levelCount: configuration.levels.length,
    meshCount,
    fullResolutionTriangleCount,
    update,
    snapshot: () => latestSnapshot,
  });
};
