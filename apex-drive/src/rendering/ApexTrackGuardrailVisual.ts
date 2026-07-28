import * as THREE from 'three/webgpu';
import {
  TRACK_GUARDRAIL_BEAM_HEIGHT_M,
  TRACK_GUARDRAIL_POST_SPACING_M,
  TRACK_GUARDRAIL_THICKNESS_M,
  type TrackSafetySegment,
  type TrackSafetySystem,
} from '../track/TrackSafetySystem';

/**
 * Material común de las defensas de Vector, Cumbre y los tramos creados por el
 * editor. Los pliegues del perfil corrugado son los que hacen legible la chapa
 * galvanizada bajo la iluminación PBR.
 */
export const createApexGalvanizedGuardrailMaterial = (
): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({
  color: 0xaeb5b8,
  metalness: 0.88,
  roughness: 0.28,
  side: THREE.DoubleSide,
});

export const createApexGuardrailPostMaterial = (
): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({
  color: 0x727b80,
  metalness: 0.78,
  roughness: 0.38,
});

/**
 * Perfil W corrugado compartido. La cara con relieve mira hacia la calzada y
 * conserva los terminales abiertos/inclinados producidos por TrackSafetySystem.
 */
export const createApexCorrugatedGuardrailGeometry = (
  safety: TrackSafetySystem,
): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];
  const beamCenterM = 0.62;
  const profile = [
    { y: -0.5, depth: 0 },
    { y: -0.32, depth: 0.48 },
    { y: -0.1, depth: -0.22 },
    { y: 0.1, depth: -0.22 },
    { y: 0.32, depth: 0.48 },
    { y: 0.5, depth: 0 },
  ] as const;
  safety.sections.forEach(section => {
    const sectionVertexStart = vertices.length / 3;
    section.points.forEach((point, pointIndex) => {
      const center = section.centerPoints[pointIndex];
      const outwardX = point.x - center.x;
      const outwardZ = point.z - center.z;
      const outwardLength = Math.hypot(outwardX, outwardZ) || 1;
      profile.forEach(profilePoint => {
        const depthM = (
          -profilePoint.depth * TRACK_GUARDRAIL_THICKNESS_M - 0.07
        );
        vertices.push(
          point.x + outwardX / outwardLength * depthM,
          point.y
            + beamCenterM
            + profilePoint.y * TRACK_GUARDRAIL_BEAM_HEIGHT_M,
          point.z + outwardZ / outwardLength * depthM,
        );
      });
    });
    for (
      let pointIndex = 0;
      pointIndex < section.points.length - 1;
      pointIndex += 1
    ) {
      for (
        let profileIndex = 0;
        profileIndex < profile.length - 1;
        profileIndex += 1
      ) {
        const current = (
          sectionVertexStart + pointIndex * profile.length + profileIndex
        );
        const next = current + profile.length;
        indices.push(
          current,
          next,
          current + 1,
          current + 1,
          next,
          next + 1,
        );
      }
    }
  });

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
};

export const selectApexGuardrailPostSegments = (
  safety: TrackSafetySystem,
): readonly TrackSafetySegment[] => safety.segments.filter(segment => {
  const segmentLengthM = Math.hypot(
    segment.end.x - segment.start.x,
    segment.end.y - segment.start.y,
    segment.end.z - segment.start.z,
  );
  return (
    Math.floor(
      (segment.distanceM + segmentLengthM)
      / TRACK_GUARDRAIL_POST_SPACING_M,
    )
    > Math.floor(segment.distanceM / TRACK_GUARDRAIL_POST_SPACING_M)
  );
});
