import * as THREE from 'three/webgpu';
import type { TrackShoulderTunnel } from '../track/TrackShoulderSystem';

export interface TrackTunnelSystem {
  readonly group: THREE.Group;
  readonly count: number;
}

/**
 * Tubo abierto de sección semi-elíptica. La calzada inferior funciona como
 * piso; la malla agrega únicamente paredes y techo visibles desde ambos lados.
 */
export const createTrackTunnelSystem = (
  tunnels: readonly TrackShoulderTunnel[],
): TrackTunnelSystem => {
  const group = new THREE.Group();
  group.name = 'track-simple-tunnels';
  if (tunnels.length === 0) {
    return Object.freeze({ group, count: 0 });
  }

  const positions: number[] = [];
  const indices: number[] = [];
  const crossSegments = 20;
  tunnels.forEach(tunnel => {
    const base = positions.length / 3;
    const rightX = -tunnel.tangentZ;
    const rightZ = tunnel.tangentX;
    for (const alongM of [-tunnel.lengthM * 0.5, tunnel.lengthM * 0.5]) {
      for (let segment = 0; segment <= crossSegments; segment += 1) {
        const phase = segment / crossSegments * Math.PI;
        const lateralM = Math.cos(phase) * tunnel.halfWidthM;
        const heightM = Math.sin(phase) * tunnel.heightM;
        positions.push(
          tunnel.x + tunnel.tangentX * alongM + rightX * lateralM,
          tunnel.y + heightM,
          tunnel.z + tunnel.tangentZ * alongM + rightZ * lateralM,
        );
      }
    }
    const ringSize = crossSegments + 1;
    for (let segment = 0; segment < crossSegments; segment += 1) {
      const nearCurrent = base + segment;
      const nearNext = nearCurrent + 1;
      const farCurrent = base + ringSize + segment;
      const farNext = farCurrent + 1;
      indices.push(
        nearCurrent,
        farCurrent,
        nearNext,
        nearNext,
        farCurrent,
        farNext,
      );
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new THREE.MeshStandardMaterial({
    color: 0x74797a,
    roughness: 0.94,
    metalness: 0.03,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'track-simple-semicircular-tunnel-shells';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.surface = 'concrete';
  group.add(mesh);
  group.userData.count = tunnels.length;
  group.userData.geometry = 'semi-elliptic-open-shell-v1';
  return Object.freeze({
    group,
    count: tunnels.length,
  });
};
