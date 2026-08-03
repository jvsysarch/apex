import * as THREE from 'three/webgpu';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ApexTrackDerivedState } from '../track/editor/ApexTrackDerivedState';
import {
  TRACK_GUARDRAIL_POST_HEIGHT_M,
  TRACK_GUARDRAIL_POST_WIDTH_M,
} from '../track/TrackSafetySystem';
import {
  createTrackShoulderProfile,
  solveTrackShoulderConfluences,
  type TrackShoulderPoint,
} from '../track/TrackShoulderSystem';
import {
  createApexCorrugatedGuardrailGeometry,
  createApexGalvanizedGuardrailMaterial,
  createApexGuardrailPostMaterial,
  selectApexGuardrailPostSegments,
} from './ApexTrackGuardrailVisual';

export interface ApexTrackEditDerivedVisual {
  readonly group: THREE.Group;
  setProceduralSurfaceVisible(visible: boolean): void;
  updateRoadSurface(state: ApexTrackDerivedState): void;
  update(state: ApexTrackDerivedState): void;
}

export interface ApexTrackEditDerivedVisualOptions {
  readonly roadMaterial: THREE.Material;
  readonly roadsideMaterial: THREE.Material;
  readonly roadsideTextureSizeM?: number;
  readonly showProceduralSurface: boolean;
}

interface AdaptiveTerrainCompressionPreview {
  readonly positions: readonly number[];
  readonly colors: readonly number[];
  readonly indices: readonly number[];
}

const createRoadGeometry = (
  state: ApexTrackDerivedState,
): THREE.BufferGeometry => {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  state.points.forEach((point, index) => {
    const frame = state.frames[index];
    const halfWidthM = state.roadHalfWidthsM[index];
    const left = {
      x: point.x + frame.surfaceLateral.x * halfWidthM,
      y: point.y + frame.surfaceLateral.y * halfWidthM,
      z: point.z + frame.surfaceLateral.z * halfWidthM,
    };
    const right = {
      x: point.x - frame.surfaceLateral.x * halfWidthM,
      y: point.y - frame.surfaceLateral.y * halfWidthM,
      z: point.z - frame.surfaceLateral.z * halfWidthM,
    };
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    normals.push(
      frame.surfaceUp.x,
      frame.surfaceUp.y,
      frame.surfaceUp.z,
      frame.surfaceUp.x,
      frame.surfaceUp.y,
      frame.surfaceUp.z,
    );
    const textureV = state.distancesM[index] / 40;
    uvs.push(0, textureV, 1, textureV);
  });
  const segmentCount = state.closed
    ? state.points.length
    : state.points.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const next = (index + 1) % state.points.length;
    const currentBase = index * 2;
    const nextBase = next * 2;
    indices.push(
      currentBase,
      nextBase,
      currentBase + 1,
      currentBase + 1,
      nextBase,
      nextBase + 1,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(normals, 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
};

const createRoadsideGeometry = (
  state: ApexTrackDerivedState,
  textureSizeM: number,
): THREE.BufferGeometry => {
  // Preserve the historical shoulder mapping. Only adaptive terrain shares
  // the generated floor's world-space UV scale.
  const roadsideUvSizeM = state.roadsideMode === 'adaptive-terrain'
    ? textureSizeM
    : 18;
  const baseProfiles = state.points.map((point, index) => {
    const frame = state.frames[index];
    const center = new THREE.Vector3(point.x, point.y, point.z);
    const surfaceLateral = new THREE.Vector3(
      frame.surfaceLateral.x,
      frame.surfaceLateral.y,
      frame.surfaceLateral.z,
    );
    const innerLeft = center.clone().addScaledVector(
      surfaceLateral,
      state.roadHalfWidthsM[index],
    );
    const innerRight = center.clone().addScaledVector(
      surfaceLateral,
      state.roadHalfWidthsM[index] * -1,
    );
    return createTrackShoulderProfile({
      center,
      innerLeft,
      innerRight,
      horizontalLeftX: frame.horizontalLateral.x,
      horizontalLeftZ: frame.horizontalLateral.z,
      roadWidthM: state.roadHalfWidthsM[index] * 2,
      shoulderWidthM: state.shoulderWidthM,
      groundHeightM: state.groundHeightM,
      progress: index / Math.max(1, state.points.length - 1),
      adaptiveTerrain: state.roadsideMode === 'adaptive-terrain',
    });
  });
  const confluence = state.roadsideMode === 'adaptive-terrain'
    ? solveTrackShoulderConfluences(
      state.points.map((point, index) => ({
        center: point,
        innerLeft: baseProfiles[index].left[0],
        innerRight: baseProfiles[index].right[0],
        profile: baseProfiles[index],
        distanceM: state.distancesM[index],
      })),
      state.roadWidthM,
      { closed: state.closed },
    )
    : {
      profiles: baseProfiles,
      masks: baseProfiles.map(() => ({
        left: [true, true, true, true, true],
        right: [true, true, true, true, true],
      })),
      adaptivePatches: [],
      interiorFills: [],
      rejectedStripCount: 0,
    };
  const profiles = confluence.profiles;
  const positions: number[] = [];
  const uvs: number[] = [];
  profiles.forEach(profile => {
    const ring = [
      profile.left[5],
      profile.left[4],
      profile.left[3],
      profile.left[2],
      profile.left[1],
      profile.left[0],
      profile.right[0],
      profile.right[1],
      profile.right[2],
      profile.right[3],
      profile.right[4],
      profile.right[5],
    ];
    ring.forEach(point => {
      positions.push(point.x, point.y, point.z);
      uvs.push(point.x / roadsideUvSizeM, -point.z / roadsideUvSizeM);
    });
  });
  const indices: number[] = [];
  const replacedSegments = {
    left: new Set<number>(),
    right: new Set<number>(),
  };
  for (const patch of confluence.adaptivePatches) {
    patch.replacedSegmentIndices.forEach(index => replacedSegments[patch.side].add(index));
  }
  const segmentCount = state.closed ? profiles.length : profiles.length - 1;
  for (let sample = 0; sample < segmentCount; sample += 1) {
    const next = (sample + 1) % profiles.length;
    for (let offset = 0; offset < 11; offset += 1) {
      // El strip 5 une ambos bordes del asfalto: no forma parte del lateral.
      if (offset === 5) continue;
      const side = offset < 5 ? 'left' : offset >= 6 ? 'right' : undefined;
      const stage = offset < 5 ? 4 - offset : offset >= 6 ? offset - 6 : 0;
      if (state.roadsideMode === 'shoulder' && stage !== 0) continue;
      if (side && replacedSegments[side].has(sample)) continue;
      if (
        side
        && (
          !confluence.masks[sample][side][stage]
          || !confluence.masks[next][side][stage]
        )
      ) continue;
      const currentBase = sample * 12 + offset;
      const nextBase = next * 12 + offset;
      indices.push(
        currentBase,
        nextBase,
        currentBase + 1,
        currentBase + 1,
        nextBase,
        nextBase + 1,
      );
    }
  }
  // El mapa térmico no puede depender de que se abra un relleno interior:
  // en una curva que todavía no requiere cierre ese relleno es vacío, pero la
  // presión de compresión ya existe y debe ser visible para poder depurarla.
  const baseRoadsideIndices = [...indices];
  const regularRoadsideVertexCount = profiles.length * 12;
  let interiorTriangleCount = 0;
  for (const patch of confluence.adaptivePatches) {
    const vertexByPoint = new Map<TrackShoulderPoint, number>();
    const vertexIndexFor = (point: TrackShoulderPoint): number => {
      const existing = vertexByPoint.get(point);
      if (existing !== undefined) return existing;
      const vertexIndex = positions.length / 3;
      positions.push(point.x, point.y, point.z);
      uvs.push(point.x / roadsideUvSizeM, -point.z / roadsideUvSizeM);
      vertexByPoint.set(point, vertexIndex);
      return vertexIndex;
    };
    for (const triangle of patch.triangles) {
      indices.push(
        vertexIndexFor(triangle.points[0]),
        vertexIndexFor(triangle.points[1]),
        vertexIndexFor(triangle.points[2]),
      );
      interiorTriangleCount += 1;
    }
  }
  const compressionPreviewPositions: number[] = [];
  const compressionPreviewColors: number[] = [];
  const compressionPreviewIndices: number[] = [];
  const compressionColor = (compression: number): readonly [number, number, number] => {
    const value = THREE.MathUtils.clamp(compression, 0, 1);
    if (value <= 0.5) {
      const mix = value * 2;
      return [0.14 + mix * 0.86, 0.84 + mix * 0.01, 1 - mix * 0.68];
    }
    const mix = (value - 0.5) * 2;
    return [1, 0.85 - mix * 0.61, 0.32 - mix * 0.1];
  };
  // Base visible: cada franja regular también reporta su presión. Así el
  // heatmap existe en todas las curvas y no desaparece cuando no hay patch.
  for (let vertexIndex = 0; vertexIndex < regularRoadsideVertexCount; vertexIndex += 1) {
    // La retícula que no fue reemplazada no redujo muestras: siempre es fría.
    const color = compressionColor(0);
    const positionOffset = vertexIndex * 3;
    compressionPreviewPositions.push(
      positions[positionOffset],
      positions[positionOffset + 1] + 0.075,
      positions[positionOffset + 2],
    );
    compressionPreviewColors.push(...color);
  }
  compressionPreviewIndices.push(...baseRoadsideIndices);
  for (const patch of confluence.adaptivePatches) {
    for (const triangle of patch.triangles) {
      const color = compressionColor(triangle.compression);
      const vertexBase = compressionPreviewPositions.length / 3;
      for (const point of triangle.points) {
        compressionPreviewPositions.push(point.x, point.y + 0.085, point.z);
        compressionPreviewColors.push(...color);
      }
      compressionPreviewIndices.push(vertexBase, vertexBase + 1, vertexBase + 2);
    }
  }
  const rawGeometry = new THREE.BufferGeometry();
  rawGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  rawGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  rawGeometry.setIndex(indices);
  const geometry = mergeVertices(rawGeometry, 1e-4);
  rawGeometry.dispose();
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.adaptiveTerrainInteriorFillCount = confluence.adaptivePatches.length;
  geometry.userData.adaptiveTerrainInteriorTriangleCount = interiorTriangleCount;
  geometry.userData.adaptiveTerrainPatchRowCardinalities = (
    confluence.adaptivePatches.map(patch => patch.rows.map(row => row.sourceIndices.length))
  );
  geometry.userData.adaptiveTerrainHeatmapTriangleCount = (
    compressionPreviewIndices.length / 3
  );
  geometry.userData.adaptiveTerrainCurvatureBoundaries = confluence.adaptivePatches.map(
    patch => patch.curvatureBoundary,
  );
  geometry.userData.adaptiveTerrainCompressionPreview = Object.freeze({
    positions: Object.freeze(compressionPreviewPositions),
    colors: Object.freeze(compressionPreviewColors),
    indices: Object.freeze(compressionPreviewIndices),
  } satisfies AdaptiveTerrainCompressionPreview);
  geometry.userData.adaptiveTerrainRejectedStripCount = (
    confluence.rejectedStripCount
  );
  return geometry;
};

export const createApexTrackEditDerivedVisual = (
  options: ApexTrackEditDerivedVisualOptions,
): ApexTrackEditDerivedVisual => {
  const group = new THREE.Group();
  group.name = 'track-editor-derived-visuals';
  group.userData.authority = 'track-edit-derived-state';

  const road = new THREE.Mesh(new THREE.BufferGeometry(), options.roadMaterial);
  road.name = 'track-editor-derived-road-surface';
  road.visible = options.showProceduralSurface;
  road.receiveShadow = true;
  road.renderOrder = 12;
  road.frustumCulled = false;
  group.add(road);
  const roadside = new THREE.Mesh(
    new THREE.BufferGeometry(),
    options.roadsideMaterial,
  );
  roadside.name = 'track-editor-derived-roadside';
  roadside.receiveShadow = true;
  group.add(roadside);
  const roadsideDebug = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0x68ffd0,
      transparent: true,
      opacity: 0.86,
      depthTest: false,
    }),
  );
  roadsideDebug.name = 'track-editor-adaptive-terrain-topology-debug';
  roadsideDebug.visible = false;
  roadsideDebug.renderOrder = 28;
  group.add(roadsideDebug);
  const curvatureBoundaryDebug = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0xffb347,
      transparent: true,
      opacity: 0.96,
      depthTest: false,
    }),
  );
  curvatureBoundaryDebug.name = 'track-editor-adaptive-terrain-curvature-boundary-debug';
  curvatureBoundaryDebug.visible = false;
  curvatureBoundaryDebug.renderOrder = 29;
  group.add(curvatureBoundaryDebug);
  const compressionPreview = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: false,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
      toneMapped: false,
    }),
  );
  compressionPreview.name = 'track-editor-adaptive-terrain-compression-heatmap';
  compressionPreview.visible = false;
  compressionPreview.renderOrder = 100;
  compressionPreview.frustumCulled = false;
  group.add(compressionPreview);

  const guardrailMaterial = createApexGalvanizedGuardrailMaterial();
  const postMaterial = createApexGuardrailPostMaterial();
  const guardrails = new THREE.Group();
  guardrails.name = 'track-editor-derived-guardrails';
  group.add(guardrails);

  const updateRoadSurface = (state: ApexTrackDerivedState): void => {
    road.geometry.dispose();
    road.geometry = createRoadGeometry(state);
    group.userData.trackLengthM = state.lengthM;
    group.userData.roadWidthM = state.roadWidthM;
    group.userData.closed = state.closed;
  };

  const update = (state: ApexTrackDerivedState): void => {
    updateRoadSurface(state);
    roadside.geometry.dispose();
    roadside.geometry = state.roadsideMode === 'none'
      || state.shoulderWidthM <= 0
      ? new THREE.BufferGeometry()
      : createRoadsideGeometry(state, options.roadsideTextureSizeM ?? 14);
    roadside.visible = state.roadsideMode !== 'none';
    roadsideDebug.geometry.dispose();
    roadsideDebug.geometry = state.roadsideMode === 'adaptive-terrain'
      ? new THREE.WireframeGeometry(roadside.geometry)
      : new THREE.BufferGeometry();
    curvatureBoundaryDebug.geometry.dispose();
    const curvatureBoundaryVertices: number[] = [];
    const curvatureBoundaries = roadside.geometry.userData
      .adaptiveTerrainCurvatureBoundaries as readonly (readonly TrackShoulderPoint[])[]
      | undefined;
    for (const boundary of curvatureBoundaries ?? []) {
      for (let index = 0; index < boundary.length - 1; index += 1) {
        const first = boundary[index];
        const second = boundary[index + 1];
        curvatureBoundaryVertices.push(
          first.x, first.y + 0.035, first.z,
          second.x, second.y + 0.035, second.z,
        );
      }
    }
    curvatureBoundaryDebug.geometry = new THREE.BufferGeometry();
    curvatureBoundaryDebug.geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(curvatureBoundaryVertices, 3),
    );
    compressionPreview.geometry.dispose();
    const compressionData = roadside.geometry.userData
      .adaptiveTerrainCompressionPreview as AdaptiveTerrainCompressionPreview
      | undefined;
    const compressionGeometry = new THREE.BufferGeometry();
    if (compressionData && compressionData.indices.length > 0) {
      compressionGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(compressionData.positions, 3),
      );
      compressionGeometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(compressionData.colors, 3),
      );
      compressionGeometry.setIndex([...compressionData.indices]);
    }
    compressionPreview.geometry = compressionGeometry;
    // El diagnóstico es autoridad del editor y no depende de que el material
    // procedural principal esté visible (por ejemplo, sobre un asset importado).
    roadsideDebug.visible = state.roadsideMode === 'adaptive-terrain';
    curvatureBoundaryDebug.visible = roadsideDebug.visible;
    compressionPreview.visible = roadsideDebug.visible;
    guardrails.children.forEach(child => {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
    });
    guardrails.clear();

    if (state.boundaryMode === 'guardrails') {
      const ribbon = new THREE.Mesh(
        createApexCorrugatedGuardrailGeometry(state.safety),
        guardrailMaterial,
      );
      ribbon.name = 'track-editor-derived-guardrail-corrugated-ribbon';
      ribbon.castShadow = true;
      ribbon.receiveShadow = true;
      guardrails.add(ribbon);
    }

    const postSegments = selectApexGuardrailPostSegments(state.safety);
    if (state.boundaryMode === 'guardrails' && postSegments.length > 0) {
      const posts = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        postMaterial,
        postSegments.length,
      );
      posts.name = 'track-editor-derived-guardrail-posts';
      const transform = new THREE.Object3D();
      postSegments.forEach((segment, index) => {
        transform.position.set(
          segment.start.x,
          segment.start.y + TRACK_GUARDRAIL_POST_HEIGHT_M * 0.5 - 0.18,
          segment.start.z,
        );
        transform.scale.set(
          TRACK_GUARDRAIL_POST_WIDTH_M,
          TRACK_GUARDRAIL_POST_HEIGHT_M,
          TRACK_GUARDRAIL_POST_WIDTH_M,
        );
        transform.updateMatrix();
        posts.setMatrixAt(index, transform.matrix);
      });
      posts.instanceMatrix.needsUpdate = true;
      posts.castShadow = true;
      posts.receiveShadow = true;
      guardrails.add(posts);
    }

    group.userData.trackLengthM = state.lengthM;
    group.userData.roadWidthM = state.roadWidthM;
    group.userData.closed = state.closed;
    group.userData.boundaryMode = state.boundaryMode;
    group.userData.roadsideMode = state.roadsideMode;
    group.userData.shoulderWidthM = state.shoulderWidthM;
    group.userData.adaptiveTerrainInteriorFillCount = roadside.geometry.userData
      .adaptiveTerrainInteriorFillCount ?? 0;
    group.userData.adaptiveTerrainInteriorTriangleCount = roadside.geometry.userData
      .adaptiveTerrainInteriorTriangleCount ?? 0;
    group.userData.adaptiveTerrainPatchRowCardinalities = roadside.geometry.userData
      .adaptiveTerrainPatchRowCardinalities ?? [];
    group.userData.adaptiveTerrainHeatmapTriangleCount = roadside.geometry.userData
      .adaptiveTerrainHeatmapTriangleCount ?? 0;
    group.userData.adaptiveTerrainRejectedStripCount = roadside.geometry.userData
      .adaptiveTerrainRejectedStripCount ?? 0;
    group.userData.guardrailStyle = 'galvanized-corrugated-w-profile';
    group.userData.guardrailSectionCount = state.safety.sections.length;
    group.userData.guardrailSegmentCount = state.safety.segments.length;
    group.userData.racingPlanPointCount = state.racingPlan?.points.length ?? 0;
  };

  return Object.freeze({
    group,
    setProceduralSurfaceVisible: (visible: boolean) => {
      road.visible = visible;
    },
    updateRoadSurface,
    update,
  });
};
