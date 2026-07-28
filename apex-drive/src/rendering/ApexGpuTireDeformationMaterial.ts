import * as THREE from 'three/webgpu';
import {
  abs,
  clamp,
  dot,
  max,
  positionLocal,
  pow,
  smoothstep,
  uniform,
  vec3,
} from 'three/tsl';

export interface ApexGpuTireDeformationState {
  readonly compressionM: number;
  readonly widthExpansion: number;
  readonly longitudinalShearM: number;
  readonly lateralShearM: number;
  readonly contactPatchLengthM: number;
  readonly contactUp: THREE.Vector3;
  readonly contactTangent: THREE.Vector3;
}

export interface ApexGpuTireDeformationBinding {
  update(state: ApexGpuTireDeformationState): void;
}

export const createApexGpuTireDeformationBinding = (
  mesh: THREE.Mesh<THREE.BufferGeometry>,
  outerRadiusM: number,
  physicalRadiusM: number,
  nominalWidthM: number,
): ApexGpuTireDeformationBinding => {
  if (!(mesh.material instanceof THREE.MeshStandardMaterial)) {
    throw new Error('GPU tire deformation requires a standard tire material');
  }

  const source = mesh.material;
  const material = new THREE.MeshStandardNodeMaterial({
    color: source.color.clone(),
    map: source.map,
    bumpMap: source.bumpMap,
    bumpScale: source.bumpScale,
    roughness: source.roughness,
    metalness: source.metalness,
    transparent: source.transparent,
    opacity: source.opacity,
    alphaTest: source.alphaTest,
    side: source.side,
    depthTest: source.depthTest,
    depthWrite: source.depthWrite,
  });
  material.name = `${source.name || 'apex-tire'}-gpu-deformation`;

  const compressionM = uniform(0);
  const widthExpansion = uniform(0);
  const longitudinalShearM = uniform(0);
  const lateralShearM = uniform(0);
  const contactPatchLengthM = uniform(0);
  const contactUp = uniform(new THREE.Vector3(1, 0, 0));
  const contactTangent = uniform(new THREE.Vector3(0, 0, -1));

  const halfWidthM = Math.max(0.01, nominalWidthM * 0.5);
  const heightAlongNormal = dot(positionLocal, contactUp);
  const normalizedBottom = heightAlongNormal.negate().div(outerRadiusM);
  const contactEnvelope = smoothstep(
    0,
    1,
    normalizedBottom.add(0.68).div(1.68),
  );
  const contactWeight = pow(contactEnvelope, 0.60);
  const tangentDistanceM = abs(dot(positionLocal, contactTangent));
  const halfPatchLengthM = max(
    outerRadiusM * 0.08,
    contactPatchLengthM.mul(0.5),
  );
  const longitudinalPatchWeight = smoothstep(
    0,
    1,
    tangentDistanceM.sub(halfPatchLengthM)
      .div(Math.max(outerRadiusM * 0.5, 0.01)),
  ).oneMinus();
  const carcassWeight = contactWeight.mul(
    longitudinalPatchWeight.mul(0.60).add(0.30),
  );
  const shearWeight = contactEnvelope.mul(contactEnvelope)
    .mul(longitudinalPatchWeight);
  const sidewallWeight = clamp(
    abs(positionLocal.y).div(halfWidthM),
    0,
    1,
  );
  const carcassCompressionM = compressionM.mul(carcassWeight);
  const contactPlaneHeightM = compressionM.sub(outerRadiusM);
  const planeProjectionM = max(
    0,
    contactPlaneHeightM.sub(heightAlongNormal),
  );
  const flatPatchShoulderM = max(
    outerRadiusM * 0.025,
    compressionM.mul(0.35),
  );
  const flatPatchWeight = smoothstep(
    0,
    1,
    tangentDistanceM.sub(halfPatchLengthM).div(flatPatchShoulderM),
  ).oneMinus();
  const radialCompressionM = max(
    carcassCompressionM,
    planeProjectionM.mul(flatPatchWeight),
  );
  const longitudinalShear = longitudinalShearM.mul(shearWeight);
  const lateralShear = lateralShearM.mul(shearWeight);
  const widthScale = widthExpansion.mul(carcassWeight)
    .mul(sidewallWeight.mul(0.58).add(0.42))
    .add(1);

  material.positionNode = vec3(
    positionLocal.x
      .add(contactUp.x.mul(radialCompressionM))
      .add(contactTangent.x.mul(longitudinalShear)),
    positionLocal.y.mul(widthScale).add(lateralShear),
    positionLocal.z
      .add(contactUp.z.mul(radialCompressionM))
      .add(contactTangent.z.mul(longitudinalShear)),
  );
  mesh.material = material;

  return {
    update(state): void {
      compressionM.value = state.compressionM;
      widthExpansion.value = state.widthExpansion;
      longitudinalShearM.value = state.longitudinalShearM;
      lateralShearM.value = state.lateralShearM;
      contactPatchLengthM.value = state.contactPatchLengthM;
      contactUp.value.copy(state.contactUp);
      contactTangent.value.copy(state.contactTangent);
      mesh.position.copy(state.contactUp).multiplyScalar(
        outerRadiusM - physicalRadiusM - state.compressionM,
      );
    },
  };
};
