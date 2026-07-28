import * as THREE from 'three/webgpu';
import type {
  ApexRacingLinePlan,
  ApexRacingLinePlanPoint,
  RacingLineGuidanceAction,
} from '../race/ApexRacingLinePlanner';

export interface TrackGuidanceChevronSystem {
  readonly group: THREE.Group;
  readonly counts: Readonly<Record<Exclude<RacingLineGuidanceAction, 'none'>, number>>;
  update(
    position: Readonly<Pick<THREE.Vector3, 'x' | 'z'>>,
    speedKmh: number,
    deltaSeconds: number,
    enabled?: boolean,
  ): void;
  dispose(): void;
}

export interface TrackGuidanceChevronConfiguration {
  readonly plan: ApexRacingLinePlan;
  readonly spacingM?: number;
  readonly lengthM?: number;
  readonly widthM?: number;
  readonly strokeWidthM?: number;
  readonly surfaceOffsetM?: number;
}

type VisibleAction = Exclude<RacingLineGuidanceAction, 'none'>;

interface GeometryBuffers {
  readonly vertices: number[];
  readonly normals: number[];
  readonly indices: number[];
}

interface GuidanceMarker {
  readonly distanceM: number;
  readonly targetSpeedKmh: number;
  readonly intensity: number;
  readonly group: THREE.Group;
  readonly glowMaterial: THREE.MeshBasicMaterial;
  readonly baseMaterial: THREE.MeshStandardMaterial;
  readonly bodyMaterial: THREE.MeshStandardMaterial;
  reveal: number;
}

const SPEED_SAFE_COLOR = new THREE.Color(0x39f28b);
const SPEED_LIMIT_COLOR = new THREE.Color(0xffd126);
const SPEED_EXCESS_COLOR = new THREE.Color(0xff382e);
const REVEAL_START_DISTANCE_M = 118;
const REVEAL_FULL_DISTANCE_M = 72;

const colorForRelativeSpeed = (
  speedKmh: number,
  targetSpeedKmh: number,
): THREE.Color => {
  const ratio = speedKmh / Math.max(20, targetSpeedKmh);
  if (ratio <= 0.9) return SPEED_SAFE_COLOR;
  if (ratio <= 1) {
    return SPEED_SAFE_COLOR.clone().lerp(
      SPEED_LIMIT_COLOR,
      THREE.MathUtils.smoothstep(ratio, 0.9, 1),
    );
  }
  return SPEED_LIMIT_COLOR.clone().lerp(
    SPEED_EXCESS_COLOR,
    THREE.MathUtils.smoothstep(ratio, 1, 1.14),
  );
};

const worldVertex = (
  point: ApexRacingLinePlanPoint,
  lateralM: number,
  forwardM: number,
  heightM: number,
): readonly [number, number, number] => [
  point.x
    + point.lateral.x * lateralM
    + point.tangent.x * forwardM
    + point.surfaceUp.x * heightM,
  point.y
    + point.lateral.y * lateralM
    + point.tangent.y * forwardM
    + point.surfaceUp.y * heightM,
  point.z
    + point.lateral.z * lateralM
    + point.tangent.z * forwardM
    + point.surfaceUp.z * heightM,
];

const chevronPolygon = (
  centerForwardM: number,
  lengthM: number,
  widthM: number,
  strokeWidthM: number,
): readonly THREE.Vector2[] => {
  const rearM = centerForwardM - lengthM * 0.5;
  const tipM = centerForwardM + lengthM * 0.5;
  const notchM = tipM - strokeWidthM * 1.55;
  return Object.freeze([
    new THREE.Vector2(-widthM * 0.5, rearM),
    new THREE.Vector2(0, tipM),
    new THREE.Vector2(widthM * 0.5, rearM),
    new THREE.Vector2(widthM * 0.5 - strokeWidthM, rearM),
    new THREE.Vector2(0, notchM),
    new THREE.Vector2(-widthM * 0.5 + strokeWidthM, rearM),
  ]);
};

const appendPrism = (
  buffers: GeometryBuffers,
  point: ApexRacingLinePlanPoint,
  polygon: readonly THREE.Vector2[],
  bottomHeightM: number,
  topHeightM: number,
): void => {
  const base = buffers.vertices.length / 3;
  for (const heightM of [bottomHeightM, topHeightM]) {
    for (const vertex of polygon) {
      buffers.vertices.push(...worldVertex(point, vertex.x, vertex.y, heightM));
      const normalScale = heightM === topHeightM ? 1 : -1;
      buffers.normals.push(
        point.surfaceUp.x * normalScale,
        point.surfaceUp.y * normalScale,
        point.surfaceUp.z * normalScale,
      );
    }
  }
  const faceTriangles = THREE.ShapeUtils.triangulateShape(
    [...polygon],
    [],
  );
  for (const [a, b, c] of faceTriangles) {
    buffers.indices.push(base + c, base + b, base + a);
    buffers.indices.push(
      base + polygon.length + a,
      base + polygon.length + b,
      base + polygon.length + c,
    );
  }
  for (let index = 0; index < polygon.length; index += 1) {
    const next = (index + 1) % polygon.length;
    const edgeX = polygon[next].x - polygon[index].x;
    const edgeForward = polygon[next].y - polygon[index].y;
    const edgeLength = Math.hypot(edgeX, edgeForward) || 1;
    const sideLateral = edgeForward / edgeLength;
    const sideForward = -edgeX / edgeLength;
    const sideNormal = {
      x: point.lateral.x * sideLateral + point.tangent.x * sideForward,
      y: point.lateral.y * sideLateral + point.tangent.y * sideForward,
      z: point.lateral.z * sideLateral + point.tangent.z * sideForward,
    };
    const sideBase = buffers.vertices.length / 3;
    buffers.vertices.push(
      ...worldVertex(
        point,
        polygon[index].x,
        polygon[index].y,
        bottomHeightM,
      ),
      ...worldVertex(
        point,
        polygon[next].x,
        polygon[next].y,
        bottomHeightM,
      ),
      ...worldVertex(
        point,
        polygon[index].x,
        polygon[index].y,
        topHeightM,
      ),
      ...worldVertex(
        point,
        polygon[next].x,
        polygon[next].y,
        topHeightM,
      ),
    );
    for (let vertex = 0; vertex < 4; vertex += 1) {
      buffers.normals.push(sideNormal.x, sideNormal.y, sideNormal.z);
    }
    buffers.indices.push(
      sideBase, sideBase + 1, sideBase + 2,
      sideBase + 1, sideBase + 3, sideBase + 2,
    );
  }
};

const appendDoubleChevronPrism = (
  buffers: GeometryBuffers,
  point: ApexRacingLinePlanPoint,
  totalLengthM: number,
  widthM: number,
  strokeWidthM: number,
  bottomHeightM: number,
  topHeightM: number,
): void => {
  const individualLengthM = totalLengthM * 0.43;
  for (const centerForwardM of [-totalLengthM * 0.26, totalLengthM * 0.26]) {
    appendPrism(
      buffers,
      point,
      chevronPolygon(
        centerForwardM,
        individualLengthM,
        widthM,
        strokeWidthM,
      ),
      bottomHeightM,
      topHeightM,
    );
  }
};

const createGeometry = (buffers: GeometryBuffers): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(buffers.vertices, 3),
  );
  geometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(buffers.normals, 3),
  );
  geometry.setIndex(buffers.indices);
  geometry.computeBoundingSphere();
  return geometry;
};

const emptyBuffers = (): GeometryBuffers => ({
  vertices: [],
  normals: [],
  indices: [],
});

export const createTrackGuidanceChevronSystem = (
  configuration: TrackGuidanceChevronConfiguration,
): TrackGuidanceChevronSystem => {
  const spacingM = configuration.spacingM ?? 14;
  const lengthM = configuration.lengthM ?? 4.2;
  const widthM = configuration.widthM ?? 3.5;
  const strokeWidthM = configuration.strokeWidthM ?? 0.48;
  const surfaceOffsetM = configuration.surfaceOffsetM ?? 0.055;
  const group = new THREE.Group();
  group.name = 'track-guidance-chevrons';
  group.userData.apexDriveRole = 'track-guidance-chevrons';
  group.userData.algorithm = configuration.plan.algorithm;
  group.userData.geometry = 'local-floating-double-chevron-assist-v4';
  const counts: Record<VisibleAction, number> = {
    accelerate: 0,
    lift: 0,
    brake: 0,
  };

  const selectedPoints: ApexRacingLinePlanPoint[] = [];
  let lastPlacedDistanceM = Number.NEGATIVE_INFINITY;
  for (const point of configuration.plan.points) {
    if (point.guidance === 'none' || point.guidanceIntensity <= 0.001) continue;
    if (point.distanceM - lastPlacedDistanceM < spacingM) continue;
    selectedPoints.push(point);
    lastPlacedDistanceM = point.distanceM;
  }
  if (
    configuration.plan.closed
    &&
    selectedPoints.length > 1
    && (
      selectedPoints[0].distanceM
      + configuration.plan.trackLengthM
      - selectedPoints[selectedPoints.length - 1].distanceM
    ) < spacingM
  ) {
    if (
      selectedPoints[0].guidanceIntensity
      <= selectedPoints[selectedPoints.length - 1].guidanceIntensity
    ) selectedPoints.shift();
    else selectedPoints.pop();
  }

  const markers: GuidanceMarker[] = [];
  for (const point of selectedPoints) {
    const glowBuffers = emptyBuffers();
    const baseBuffers = emptyBuffers();
    const bodyBuffers = emptyBuffers();
    appendDoubleChevronPrism(
      glowBuffers,
      point,
      lengthM + 0.28,
      widthM + 0.32,
      strokeWidthM + 0.28,
      surfaceOffsetM - 0.018,
      surfaceOffsetM - 0.012,
    );
    appendDoubleChevronPrism(
      baseBuffers,
      point,
      lengthM + 0.14,
      widthM + 0.16,
      strokeWidthM + 0.15,
      surfaceOffsetM,
      surfaceOffsetM + 0.055,
    );
    appendDoubleChevronPrism(
      bodyBuffers,
      point,
      lengthM,
      widthM,
      strokeWidthM,
      surfaceOffsetM + 0.052,
      surfaceOffsetM + 0.105,
    );
    const color = SPEED_SAFE_COLOR.clone();
    const markerGroup = new THREE.Group();
    markerGroup.name = `track-guidance-marker-${markers.length}`;
    markerGroup.visible = false;
    const glowMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const glow = new THREE.Mesh(
      createGeometry(glowBuffers),
      glowMaterial,
    );
    glow.name = `track-guidance-marker-${markers.length}-glow`;
    glow.renderOrder = 5;

    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x101619,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      roughness: 0.58,
      metalness: 0.12,
      side: THREE.DoubleSide,
    });
    const base = new THREE.Mesh(
      createGeometry(baseBuffers),
      baseMaterial,
    );
    base.name = `track-guidance-marker-${markers.length}-base`;
    base.renderOrder = 6;

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.52,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      roughness: 0.34,
      metalness: 0.08,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const body = new THREE.Mesh(
      createGeometry(bodyBuffers),
      bodyMaterial,
    );
    body.name = `track-guidance-marker-${markers.length}-body`;
    body.renderOrder = 7;
    body.userData.apexDriveRole = 'track-guidance-curve-gradient';
    markerGroup.add(glow, base, body);
    group.add(markerGroup);
    markers.push({
      distanceM: point.distanceM,
      targetSpeedKmh: point.targetSpeedKmh,
      intensity: point.guidanceIntensity,
      group: markerGroup,
      glowMaterial,
      baseMaterial,
      bodyMaterial,
      reveal: 0,
    });
    if (point.guidance !== 'none') counts[point.guidance] += 1;
  }

  let nearestPlanIndex = 0;
  const update = (
    position: Readonly<Pick<THREE.Vector3, 'x' | 'z'>>,
    speedKmh: number,
    deltaSeconds: number,
    enabled = true,
  ) => {
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;
    configuration.plan.points.forEach((point, index) => {
      const deltaX = position.x - point.x;
      const deltaZ = position.z - point.z;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSquared >= nearestDistanceSquared) return;
      nearestDistanceSquared = distanceSquared;
      nearestPlanIndex = index;
    });
    const trackDistanceM = configuration.plan.points[nearestPlanIndex]?.distanceM ?? 0;
    const response = 1 - Math.exp(-Math.max(0, deltaSeconds) * 8);
    markers.forEach(marker => {
      const forwardDistanceM = configuration.plan.closed
        ? (
          marker.distanceM
          - trackDistanceM
          + configuration.plan.trackLengthM
        ) % configuration.plan.trackLengthM
        : marker.distanceM - trackDistanceM;
      const proximity = enabled && forwardDistanceM <= REVEAL_START_DISTANCE_M
        ? 1 - THREE.MathUtils.smoothstep(
            forwardDistanceM,
            REVEAL_FULL_DISTANCE_M,
            REVEAL_START_DISTANCE_M,
          )
        : 0;
      marker.reveal = THREE.MathUtils.lerp(
        marker.reveal,
        proximity,
        response,
      );
      const speedColor = colorForRelativeSpeed(
        speedKmh,
        marker.targetSpeedKmh,
      );
      marker.glowMaterial.color.lerp(speedColor, response);
      marker.bodyMaterial.color.lerp(speedColor, response);
      marker.bodyMaterial.emissive.lerp(speedColor, response);
      const visibility = marker.intensity * marker.reveal;
      marker.glowMaterial.opacity = 0.08 * visibility;
      marker.baseMaterial.opacity = 0.12 * visibility;
      marker.bodyMaterial.opacity = 0.34 * visibility;
      marker.group.visible = visibility > 0.002;
    });
  };

  group.userData.counts = Object.freeze({ ...counts });
  group.userData.markerCount = selectedPoints.length;
  group.userData.minimumSpacingM = spacingM;
  group.userData.revealStartDistanceM = REVEAL_START_DISTANCE_M;
  group.userData.revealFullDistanceM = REVEAL_FULL_DISTANCE_M;
  const dispose = (): void => {
    group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach(material => material.dispose());
    });
    group.clear();
  };
  return Object.freeze({
    group,
    counts: Object.freeze({ ...counts }),
    update,
    dispose,
  });
};
