import * as THREE from 'three/webgpu';
import type { ApexTrackDerivedState } from '../track/editor/ApexTrackDerivedState';
import {
  TRACK_GUARDRAIL_POST_HEIGHT_M,
  TRACK_GUARDRAIL_POST_WIDTH_M,
} from '../track/TrackSafetySystem';
import {
  createTrackShoulderProfile,
  solveTrackShoulderConfluences,
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
  update(state: ApexTrackDerivedState): void;
}

export interface ApexTrackEditDerivedVisualOptions {
  readonly roadMaterial: THREE.Material;
  readonly roadsideMaterial: THREE.Material;
  readonly showProceduralSurface: boolean;
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
    const halfWidthM = state.roadWidthM * 0.5;
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
): THREE.BufferGeometry => {
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
      state.roadWidthM * 0.5,
    );
    const innerRight = center.clone().addScaledVector(
      surfaceLateral,
      state.roadWidthM * -0.5,
    );
    return createTrackShoulderProfile({
      center,
      innerLeft,
      innerRight,
      horizontalLeftX: frame.horizontalLateral.x,
      horizontalLeftZ: frame.horizontalLateral.z,
      roadWidthM: state.roadWidthM,
      shoulderWidthM: state.shoulderWidthM,
      groundHeightM: state.groundHeightM,
      progress: index / Math.max(1, state.points.length - 1),
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
      uvs.push(point.x / 18, -point.z / 18);
    });
  });
  const indices: number[] = [];
  const segmentCount = state.closed ? profiles.length : profiles.length - 1;
  for (let sample = 0; sample < segmentCount; sample += 1) {
    const next = (sample + 1) % profiles.length;
    for (let offset = 0; offset < 11; offset += 1) {
      // El strip 5 une ambos bordes del asfalto: no forma parte del lateral.
      if (offset === 5) continue;
      const side = offset < 5 ? 'left' : offset >= 6 ? 'right' : undefined;
      const stage = offset < 5 ? 4 - offset : offset >= 6 ? offset - 6 : 0;
      if (state.roadsideMode === 'shoulder' && stage !== 0) continue;
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
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
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
  group.add(road);
  const roadside = new THREE.Mesh(
    new THREE.BufferGeometry(),
    options.roadsideMaterial,
  );
  roadside.name = 'track-editor-derived-roadside';
  roadside.receiveShadow = true;
  group.add(roadside);

  const guardrailMaterial = createApexGalvanizedGuardrailMaterial();
  const postMaterial = createApexGuardrailPostMaterial();
  const guardrails = new THREE.Group();
  guardrails.name = 'track-editor-derived-guardrails';
  group.add(guardrails);

  const update = (state: ApexTrackDerivedState): void => {
    road.geometry.dispose();
    road.geometry = createRoadGeometry(state);
    roadside.geometry.dispose();
    roadside.geometry = state.roadsideMode === 'none'
      || state.shoulderWidthM <= 0
      ? new THREE.BufferGeometry()
      : createRoadsideGeometry(state);
    roadside.visible = state.roadsideMode !== 'none';
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
    update,
  });
};
