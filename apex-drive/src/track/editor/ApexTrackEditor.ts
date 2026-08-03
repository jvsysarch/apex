import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { TrackPoint } from '../ApexTestTrack';
import type { ApexTrackBoundaryMode } from '../TrackBoundaryMode';
import type { ApexTrackRoadsideMode } from '../TrackRoadsideMode';

export const APEX_TRACK_EDITOR_CONTROL_SPACING_M = 10;
export const APEX_TRACK_EDITOR_COLLISION_SPACING_M = 2;
export const APEX_TRACK_EDITOR_SIMPLIFICATION_TOLERANCE_M = 0.12;
export const APEX_TRACK_EDITOR_SIMPLIFICATION_MAX_SEGMENT_M = 8;
export const APEX_TRACK_EDITOR_MIN_ROAD_WIDTH_M = 2;
export const APEX_TRACK_EDITOR_MAX_ROAD_WIDTH_M = 60;
const APEX_TRACK_EDITOR_MIN_OPEN_CONTROLS = 2;
const APEX_TRACK_EDITOR_MIN_CLOSED_CONTROLS = 4;
const APEX_TRACK_EDITOR_CONTROL_CAPACITY = 4096;

export interface ApexTrackEditorOptions {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly domElement: HTMLCanvasElement;
  readonly points: readonly TrackPoint[];
  readonly closed: boolean;
  readonly controlSpacingM?: number;
  readonly collisionSpacingM?: number;
  readonly roadWidthM: number;
  readonly boundaryMode: ApexTrackBoundaryMode;
  readonly roadsideMode: ApexTrackRoadsideMode;
  readonly initialRoadWidthM?: number;
  readonly initialBoundaryMode?: ApexTrackBoundaryMode;
  readonly initialRoadsideMode?: ApexTrackRoadsideMode;
  readonly initialSimplificationToleranceM?: number;
  readonly baseControlPoints?: readonly TrackPoint[];
  readonly initialControlPoints?: readonly TrackPoint[];
  readonly initialEvaluatedPoints?: readonly TrackPoint[];
  readonly initialCameraState?: ApexTrackEditorCameraState;
  readonly onCameraStateChange?: (
    state: ApexTrackEditorCameraState,
  ) => void;
  readonly snapToRoad?: (
    position: THREE.Vector3,
  ) => Promise<ApexTrackRoadSnap | undefined>;
  readonly onPreview?: (
    evaluatedPoints: readonly TrackPoint[],
    roadWidthM: number,
    boundaryMode: ApexTrackBoundaryMode,
    roadsideMode: ApexTrackRoadsideMode,
  ) => void;
  readonly onCommit: (
    evaluatedPoints: readonly TrackPoint[],
    controlPoints: readonly TrackPoint[],
    roadWidthM: number,
    boundaryMode: ApexTrackBoundaryMode,
    roadsideMode: ApexTrackRoadsideMode,
    simplificationToleranceM: number,
  ) => void;
  readonly onDraftSave?: (
    controlPoints: readonly TrackPoint[],
    evaluatedPoints: readonly TrackPoint[],
    roadWidthM: number,
    boundaryMode: ApexTrackBoundaryMode,
    roadsideMode: ApexTrackRoadsideMode,
    simplificationToleranceM: number,
  ) => boolean;
  readonly onSaveFile?: (
    controlPoints: readonly TrackPoint[],
    evaluatedPoints: readonly TrackPoint[],
    roadWidthM: number,
    boundaryMode: ApexTrackBoundaryMode,
    roadsideMode: ApexTrackRoadsideMode,
    simplificationToleranceM: number,
  ) => Promise<{
    readonly relativePath: string;
    readonly revision?: string;
  }>;
}

export interface ApexTrackRoadSnap {
  readonly position: THREE.Vector3;
  readonly normal: THREE.Vector3;
  readonly sourceName?: string;
  readonly horizontalDistanceM?: number;
}

export interface ApexTrackEditorCameraState {
  readonly position: readonly [number, number, number];
  readonly quaternion: readonly [number, number, number, number];
  readonly target: readonly [number, number, number];
  readonly fov: number;
  readonly near: number;
  readonly far: number;
}

export interface ApexTrackEditor {
  readonly root: THREE.Group;
  readonly nodeCount: number;
  readonly evaluatedPointCount: number;
  readonly selectedIndex: number | null;
  readonly controlPoints: readonly TrackPoint[];
  readonly evaluatedPoints: readonly TrackPoint[];
  readonly roadWidthM: number;
  readonly boundaryMode: ApexTrackBoundaryMode;
  readonly roadsideMode: ApexTrackRoadsideMode;
  readonly simplificationToleranceM: number;
  readonly cameraState: ApexTrackEditorCameraState;
  loadSession(session: ApexTrackEditorSession): void;
  update(deltaSeconds: number): void;
}

export interface ApexTrackEditorSession {
  readonly points: readonly TrackPoint[];
  readonly closed: boolean;
  readonly controlSpacingM: number;
  readonly collisionSpacingM: number;
  readonly roadWidthM: number;
  readonly boundaryMode: ApexTrackBoundaryMode;
  readonly roadsideMode: ApexTrackRoadsideMode;
  readonly simplificationToleranceM: number;
  readonly baseControlPoints?: readonly TrackPoint[];
  readonly controlPoints?: readonly TrackPoint[];
  readonly evaluatedPoints?: readonly TrackPoint[];
}

interface MutableTrackPoint {
  x: number;
  y: number;
  z: number;
  bankRadians: number;
  surface?: TrackPoint['surface'];
}

const clonePoint = (point: TrackPoint): MutableTrackPoint => ({
  x: point.x,
  y: point.y,
  z: point.z,
  bankRadians: point.bankRadians,
  surface: point.surface,
});

const readonlySnapshot = (
  points: readonly MutableTrackPoint[],
): readonly TrackPoint[] => Object.freeze(points.map(point => Object.freeze({
  x: point.x,
  y: point.y,
  z: point.z,
  bankRadians: point.bankRadians,
  surface: point.surface,
})));

const interpolatePoint = (
  start: TrackPoint,
  end: TrackPoint,
  mix: number,
): MutableTrackPoint => ({
  x: THREE.MathUtils.lerp(start.x, end.x, mix),
  y: THREE.MathUtils.lerp(start.y, end.y, mix),
  z: THREE.MathUtils.lerp(start.z, end.z, mix),
  bankRadians: THREE.MathUtils.lerp(
    start.bankRadians,
    end.bankRadians,
    mix,
  ),
  surface: mix < 0.5 ? start.surface : end.surface,
});

const createControlPoints = (
  sourcePoints: readonly TrackPoint[],
  spacingM: number,
  closed: boolean,
): MutableTrackPoint[] => {
  if (sourcePoints.length < 2) return sourcePoints.map(clonePoint);
  const segmentCount = closed ? sourcePoints.length : sourcePoints.length - 1;
  const segmentLengths: number[] = [];
  let totalLengthM = 0;
  for (let index = 0; index < segmentCount; index += 1) {
    const start = sourcePoints[index];
    const end = sourcePoints[(index + 1) % sourcePoints.length];
    const lengthM = Math.hypot(
      end.x - start.x,
      end.y - start.y,
      end.z - start.z,
    );
    segmentLengths.push(lengthM);
    totalLengthM += lengthM;
  }

  const controls: MutableTrackPoint[] = [];
  const finalDistanceM = closed
    ? totalLengthM - Math.min(0.001, totalLengthM * 0.000001)
    : totalLengthM;
  let segmentIndex = 0;
  let segmentStartDistanceM = 0;
  for (
    let distanceM = 0;
    distanceM <= finalDistanceM;
    distanceM += spacingM
  ) {
    while (
      segmentIndex < segmentLengths.length - 1
      && distanceM > segmentStartDistanceM + segmentLengths[segmentIndex]
    ) {
      segmentStartDistanceM += segmentLengths[segmentIndex];
      segmentIndex += 1;
    }
    const segmentLengthM = Math.max(0.000001, segmentLengths[segmentIndex]);
    const mix = THREE.MathUtils.clamp(
      (distanceM - segmentStartDistanceM) / segmentLengthM,
      0,
      1,
    );
    controls.push(interpolatePoint(
      sourcePoints[segmentIndex],
      sourcePoints[(segmentIndex + 1) % sourcePoints.length],
      mix,
    ));
  }
  if (!closed) {
    const last = sourcePoints[sourcePoints.length - 1];
    const currentLast = controls[controls.length - 1];
    if (
      !currentLast
      || Math.hypot(
        last.x - currentLast.x,
        last.y - currentLast.y,
        last.z - currentLast.z,
      ) > 0.01
    ) {
      controls.push(clonePoint(last));
    }
  }
  return controls;
};

const evaluateControlSpline = (
  controls: readonly MutableTrackPoint[],
  spacingM: number,
  closed: boolean,
): MutableTrackPoint[] => {
  if (controls.length < 2) return controls.map(point => ({ ...point }));
  const curve = new THREE.CatmullRomCurve3(
    controls.map(point => new THREE.Vector3(point.x, point.y, point.z)),
    closed,
    'centripetal',
    0.5,
  );
  const sampleCount = Math.max(1, Math.ceil(curve.getLength() / spacingM));
  const evaluatedPositions = closed
    ? curve.getSpacedPoints(sampleCount).slice(0, -1)
    : curve.getSpacedPoints(sampleCount);
  return evaluatedPositions.map((position, index) => {
    const progress = closed
      ? index / evaluatedPositions.length
      : index / Math.max(1, evaluatedPositions.length - 1);
    const controlProgress = progress * (
      closed ? controls.length : controls.length - 1
    );
    const lowerIndex = Math.min(
      controls.length - 1,
      Math.floor(controlProgress),
    );
    const upperIndex = closed
      ? (lowerIndex + 1) % controls.length
      : Math.min(controls.length - 1, lowerIndex + 1);
    const mix = controlProgress - Math.floor(controlProgress);
    const lower = controls[lowerIndex];
    const upper = controls[upperIndex];
    return {
      x: position.x,
      y: position.y,
      z: position.z,
      bankRadians: THREE.MathUtils.lerp(
        lower.bankRadians,
        upper.bankRadians,
        mix,
      ),
      surface: mix < 0.5 ? lower.surface : upper.surface,
    };
  });
};

const simplifyEvaluatedTrack = (
  points: readonly MutableTrackPoint[],
  closed: boolean,
  toleranceM: number,
  maximumSegmentM: number,
): MutableTrackPoint[] => {
  if (toleranceM <= 0 || points.length < (closed ? 5 : 3)) {
    return points.map(point => ({ ...point }));
  }
  const source = closed
    ? [...points, { ...points[0] }]
    : points.map(point => ({ ...point }));
  const result: MutableTrackPoint[] = [{ ...source[0] }];
  let anchorIndex = 0;
  const canReplaceRange = (candidateIndex: number): boolean => {
    const anchor = source[anchorIndex];
    const candidate = source[candidateIndex];
    const chordX = candidate.x - anchor.x;
    const chordY = candidate.y - anchor.y;
    const chordZ = candidate.z - anchor.z;
    const chordLengthSquared = (
      chordX * chordX + chordY * chordY + chordZ * chordZ
    );
    const chordLengthM = Math.sqrt(chordLengthSquared);
    if (chordLengthM > maximumSegmentM) return false;
    if (anchor.surface !== candidate.surface) return false;
    for (let index = anchorIndex + 1; index < candidateIndex; index += 1) {
      const point = source[index];
      if (point.surface !== anchor.surface) return false;
      const projection = chordLengthSquared <= 0.000001
        ? 0
        : THREE.MathUtils.clamp(
          (
            (point.x - anchor.x) * chordX
            + (point.y - anchor.y) * chordY
            + (point.z - anchor.z) * chordZ
          ) / chordLengthSquared,
          0,
          1,
        );
      const errorM = Math.hypot(
        point.x - (anchor.x + chordX * projection),
        point.y - (anchor.y + chordY * projection),
        point.z - (anchor.z + chordZ * projection),
      );
      if (errorM > toleranceM) return false;
      const expectedBank = THREE.MathUtils.lerp(
        anchor.bankRadians,
        candidate.bankRadians,
        projection,
      );
      if (
        Math.abs(point.bankRadians - expectedBank)
        > THREE.MathUtils.degToRad(0.75)
      ) return false;
    }
    return true;
  };
  let candidateIndex = 2;
  while (candidateIndex < source.length) {
    if (canReplaceRange(candidateIndex)) {
      candidateIndex += 1;
      continue;
    }
    const keepIndex = candidateIndex - 1;
    result.push({ ...source[keepIndex] });
    anchorIndex = keepIndex;
    candidateIndex = anchorIndex + 2;
  }
  const finalPoint = source[source.length - 1];
  const currentLast = result[result.length - 1];
  if (
    currentLast.x !== finalPoint.x
    || currentLast.y !== finalPoint.y
    || currentLast.z !== finalPoint.z
  ) {
    result.push({ ...finalPoint });
  }
  if (closed) result.pop();
  return result;
};

const createPanel = (
  controlSpacingM: number,
  collisionSpacingM: number,
): {
  readonly root: HTMLElement;
  readonly selection: HTMLOutputElement;
  readonly coordinates: HTMLOutputElement;
  readonly state: HTMLOutputElement;
  readonly spacing: HTMLElement;
  readonly roadWidth: HTMLInputElement;
  readonly boundaryMode: HTMLSelectElement;
  readonly roadsideMode: HTMLSelectElement;
  readonly remove: HTMLButtonElement;
  readonly snapRoad: HTMLButtonElement;
  readonly snapAllRoad: HTMLButtonElement;
  readonly smooth: HTMLButtonElement;
  readonly simplify: HTMLButtonElement;
  readonly reset: HTMLButtonElement;
  readonly copy: HTMLButtonElement;
  readonly saveFile: HTMLButtonElement;
} => {
  const root = document.createElement('aside');
  root.className = 'track-editor-panel';
  root.setAttribute('aria-label', 'Editor de pista');
  root.innerHTML = `
    <header>
      <strong>INSPECTOR DE TRAMO</strong>
      <small>BORRADOR LOCAL</small>
    </header>
    <output data-role="selection">Control · ninguno</output>
    <output data-role="coordinates">X — · Y — · Z —</output>
    <output data-role="state">Spline · lista</output>
    <p class="track-editor-panel__help">
      <span><kbd>LMB</kbd> Órbita</span>
      <span><kbd>MMB</kbd> Paneo</span>
      <span><kbd>RMB</kbd> Vuelo</span>
      <span><kbd>F</kbd> Enfocar</span>
      <span><kbd>DEL</kbd> Eliminar</span>
    </p>
    <small data-role="spacing">
      Controles ${controlSpacingM.toFixed(1)} m · colisión
      ${collisionSpacingM.toFixed(1)} m
    </small>
    <label>
      Ancho de trazada
      <span>
        <input
          type="number"
          data-role="road-width"
          min="${APEX_TRACK_EDITOR_MIN_ROAD_WIDTH_M}"
          max="${APEX_TRACK_EDITOR_MAX_ROAD_WIDTH_M}"
          step="0.25"
        >
        m
      </span>
    </label>
    <label>
      Límite físico
      <select data-role="boundary-mode">
        <option value="guardrails">Guardrails</option>
        <option value="walls">Walls continuas</option>
      </select>
    </label>
    <label>
      Lateral
      <select data-role="roadside-mode">
        <option value="none">Sin banquina</option>
        <option value="shoulder">Banquina</option>
        <option value="adaptive-terrain">Terreno adaptativo</option>
      </select>
    </label>
    <div>
      <button type="button" data-action="remove">Eliminar nodo</button>
      <button
        type="button"
        data-action="snap-road"
        title="Proyectar el nodo sobre el camino visual importado"
      >Ajustar nodo</button>
    </div>
    <div>
      <button
        type="button"
        data-action="snap-all-road"
        title="Proyectar todos los nodos sobre la grilla del camino importado"
      >Ajustar todos</button>
    </div>
    <div>
      <button type="button" data-action="smooth">Suavizar</button>
      <button type="button" data-action="simplify">Simplificar</button>
    </div>
    <div>
      <button type="button" data-action="reset">Restaurar</button>
      <button type="button" data-action="copy">Copiar contrato</button>
      <button type="button" data-action="save-file" data-variant="primary">Guardar fuente</button>
    </div>
  `;
  document.body.append(root);
  return {
    root,
    selection: root.querySelector('[data-role="selection"]')!,
    coordinates: root.querySelector('[data-role="coordinates"]')!,
    state: root.querySelector('[data-role="state"]')!,
    spacing: root.querySelector('[data-role="spacing"]')!,
    roadWidth: root.querySelector('[data-role="road-width"]')!,
    boundaryMode: root.querySelector('[data-role="boundary-mode"]')!,
    roadsideMode: root.querySelector('[data-role="roadside-mode"]')!,
    remove: root.querySelector('[data-action="remove"]')!,
    snapRoad: root.querySelector('[data-action="snap-road"]')!,
    snapAllRoad: root.querySelector('[data-action="snap-all-road"]')!,
    smooth: root.querySelector('[data-action="smooth"]')!,
    simplify: root.querySelector('[data-action="simplify"]')!,
    reset: root.querySelector('[data-action="reset"]')!,
    copy: root.querySelector('[data-action="copy"]')!,
    saveFile: root.querySelector('[data-action="save-file"]')!,
  };
};

export const createApexTrackEditor = (
  options: ApexTrackEditorOptions,
): ApexTrackEditor => {
  let controlSpacingM = options.controlSpacingM
    ?? APEX_TRACK_EDITOR_CONTROL_SPACING_M;
  let collisionSpacingM = options.collisionSpacingM
    ?? APEX_TRACK_EDITOR_COLLISION_SPACING_M;
  let closed = options.closed;
  let baseRoadWidthM = THREE.MathUtils.clamp(
    options.roadWidthM,
    APEX_TRACK_EDITOR_MIN_ROAD_WIDTH_M,
    APEX_TRACK_EDITOR_MAX_ROAD_WIDTH_M,
  );
  let roadWidthM = THREE.MathUtils.clamp(
    options.initialRoadWidthM ?? baseRoadWidthM,
    APEX_TRACK_EDITOR_MIN_ROAD_WIDTH_M,
    APEX_TRACK_EDITOR_MAX_ROAD_WIDTH_M,
  );
  let baseBoundaryMode = options.boundaryMode;
  let boundaryMode = options.initialBoundaryMode ?? baseBoundaryMode;
  let baseRoadsideMode = options.roadsideMode;
  let roadsideMode = options.initialRoadsideMode ?? baseRoadsideMode;
  let baseSimplificationToleranceM = 0;
  let simplificationToleranceM = THREE.MathUtils.clamp(
    options.initialSimplificationToleranceM ?? baseSimplificationToleranceM,
    0,
    2,
  );
  const firstSourcePoint = options.points[0];
  const lastSourcePoint = options.points[options.points.length - 1];
  const hasDuplicatedClosurePoint = (
    closed
    && firstSourcePoint !== undefined
    && lastSourcePoint !== undefined
    && Math.hypot(
      firstSourcePoint.x - lastSourcePoint.x,
      firstSourcePoint.y - lastSourcePoint.y,
      firstSourcePoint.z - lastSourcePoint.z,
    ) < 0.001
  );
  const sourcePoints = hasDuplicatedClosurePoint
    ? options.points.slice(0, -1)
    : options.points;
  let baseControls = options.baseControlPoints?.length
    ? options.baseControlPoints.map(clonePoint)
    : createControlPoints(
      sourcePoints,
      controlSpacingM,
      closed,
    );
  let baseEvaluated = sourcePoints.map(clonePoint);
  const controls = (
    options.initialControlPoints?.length
      ? options.initialControlPoints.map(clonePoint)
      : baseControls
  ).map(point => ({ ...point }));
  let evaluated = (
    options.initialEvaluatedPoints?.length
      ? options.initialEvaluatedPoints.map(clonePoint)
      : baseEvaluated
  ).map(point => ({ ...point }));
  const root = new THREE.Group();
  root.name = 'apex-track-editor';
  root.userData.authority = 'track-edit-session';
  root.userData.controlSpacingM = controlSpacingM;
  root.userData.collisionSpacingM = collisionSpacingM;
  root.userData.closed = closed;
  root.userData.roadWidthM = roadWidthM;
  root.userData.boundaryMode = boundaryMode;
  root.userData.roadsideMode = roadsideMode;
  root.userData.simplificationToleranceM = simplificationToleranceM;
  options.scene.add(root);

  const controlCapacity = Math.max(
    APEX_TRACK_EDITOR_CONTROL_CAPACITY,
    controls.length + 1,
  );
  const controlPositions = new Float32Array(controlCapacity * 3);
  const normalColor = new THREE.Color(0xdc1836);
  const selectedColor = new THREE.Color(0xff8066);
  const controlMatrixHelper = new THREE.Object3D();
  let selectedIndex: number | null = null;
  const controlSpheres = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.58, 14, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.96,
    }),
    controlCapacity,
  );
  controlSpheres.count = controls.length;
  controlSpheres.name = 'track-editor-control-spheres';
  controlSpheres.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  controlSpheres.frustumCulled = false;
  controlSpheres.renderOrder = 82;
  root.add(controlSpheres);

  const controlLineGeometry = new THREE.BufferGeometry();
  controlLineGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(controlPositions, 3),
  );
  const controlLine = new THREE.Line(
    controlLineGeometry,
    new THREE.LineBasicMaterial({
      color: 0x55b5c9,
      transparent: true,
      opacity: 0.42,
      depthTest: false,
      depthWrite: false,
    }),
  );
  controlLine.name = 'track-editor-control-polygon';
  controlLine.renderOrder = 79;
  root.add(controlLine);

  const evaluatedLineGeometry = new THREE.BufferGeometry();
  const evaluatedLine = new THREE.Line(
    evaluatedLineGeometry,
    new THREE.LineBasicMaterial({
      color: 0x8ff2ff,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
    }),
  );
  evaluatedLine.name = 'track-editor-evaluated-spline';
  evaluatedLine.renderOrder = 80;
  root.add(evaluatedLine);

  const influenceGeometry = new THREE.BufferGeometry();
  const influencePoints = new THREE.Points(
    influenceGeometry,
    new THREE.PointsMaterial({
      size: 7,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.94,
      depthTest: false,
      depthWrite: false,
    }),
  );
  influencePoints.name = 'track-editor-control-influence-gradient';
  influencePoints.renderOrder = 83;
  root.add(influencePoints);

  const selectedAnchor = new THREE.Object3D();
  selectedAnchor.name = 'track-editor-selected-control-anchor';
  root.add(selectedAnchor);

  const transform = new TransformControls(
    options.camera,
    options.domElement,
  );
  transform.setMode('translate');
  transform.setSpace('world');
  transform.setSize(0.82);
  const transformHelper = transform.getHelper();
  transformHelper.name = 'track-editor-translate-gizmo';
  transformHelper.renderOrder = 90;
  root.add(transformHelper);

  const orbit = new OrbitControls(options.camera, options.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.12;
  orbit.screenSpacePanning = true;
  orbit.zoomToCursor = true;
  orbit.minDistance = 1;
  orbit.maxDistance = 1200;
  orbit.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  orbit.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
  orbit.mouseButtons.RIGHT = null;

  if (options.initialCameraState) {
    const restored = options.initialCameraState;
    options.camera.position.fromArray(restored.position);
    options.camera.quaternion.fromArray(restored.quaternion);
    orbit.target.fromArray(restored.target);
    options.camera.fov = restored.fov;
    options.camera.near = restored.near;
    options.camera.far = restored.far;
    options.camera.updateProjectionMatrix();
    orbit.update();
  } else {
    const bounds = new THREE.Box3().setFromPoints(
      controls.map(point => new THREE.Vector3(point.x, point.y, point.z)),
    );
    const boundsCenter = bounds.getCenter(new THREE.Vector3());
    const boundsSize = bounds.getSize(new THREE.Vector3());
    const viewDistance = Math.max(boundsSize.x, boundsSize.z, 30);
    orbit.target.copy(boundsCenter);
    options.camera.position.copy(boundsCenter).add(new THREE.Vector3(
      viewDistance * 0.56,
      viewDistance * 0.48,
      viewDistance * 0.62,
    ));
    options.camera.near = 0.1;
    options.camera.far = Math.max(options.camera.far, viewDistance * 8);
    options.camera.updateProjectionMatrix();
    options.camera.lookAt(boundsCenter);
    orbit.update();
  }

  const panel = createPanel(controlSpacingM, collisionSpacingM);
  panel.roadWidth.value = roadWidthM.toFixed(2);
  panel.boundaryMode.value = boundaryMode;
  panel.roadsideMode.value = roadsideMode;
  panel.snapRoad.hidden = !options.snapToRoad;
  panel.snapRoad.disabled = true;
  panel.snapAllRoad.hidden = !options.snapToRoad;
  panel.snapAllRoad.disabled = !options.snapToRoad;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDownX = 0;
  let pointerDownY = 0;
  let pointerDownForSelection = false;
  let draftAutosaveTimer: number | undefined;
  let previewAnimationFrame: number | undefined;
  let lastPreviewRenderedAt = 0;
  let flyPointerId: number | null = null;
  let flyYawRadians = 0;
  let flyPitchRadians = 0;
  const flyEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const flyKeys = new Set<string>();
  const flyDirection = new THREE.Vector3();
  const flyRight = new THREE.Vector3();
  const flyMovement = new THREE.Vector3();
  const flyUp = new THREE.Vector3(0, 1, 0);
  const snapTangent = new THREE.Vector3();
  const snapHorizontalLateral = new THREE.Vector3();
  const snapBaseUp = new THREE.Vector3();
  const snapProjectedNormal = new THREE.Vector3();
  const snapCross = new THREE.Vector3();
  let roadSnapPending = false;
  const flyControlCodes = new Set([
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'KeyQ',
    'KeyE',
    'ShiftLeft',
    'ShiftRight',
  ]);
  const cameraStateSnapshot = (): ApexTrackEditorCameraState => {
    const storedTarget = flyPointerId === null
      ? orbit.target
      : options.camera.position.clone().addScaledVector(
        options.camera.getWorldDirection(new THREE.Vector3()),
        24,
      );
    return Object.freeze({
      position: Object.freeze([
        options.camera.position.x,
        options.camera.position.y,
        options.camera.position.z,
      ] as const),
      quaternion: Object.freeze([
        options.camera.quaternion.x,
        options.camera.quaternion.y,
        options.camera.quaternion.z,
        options.camera.quaternion.w,
      ] as const),
      target: Object.freeze([
        storedTarget.x,
        storedTarget.y,
        storedTarget.z,
      ] as const),
      fov: options.camera.fov,
      near: options.camera.near,
      far: options.camera.far,
    });
  };
  let lastCameraStateReportMs = 0;
  const reportCameraState = (force = false): void => {
    if (!options.onCameraStateChange) return;
    const now = performance.now();
    if (!force && now - lastCameraStateReportMs < 240) return;
    lastCameraStateReportMs = now;
    options.onCameraStateChange(cameraStateSnapshot());
  };
  window.addEventListener('pagehide', () => {
    reportCameraState(true);
  });

  const updateReadout = (): void => {
    panel.remove.disabled = (
      roadSnapPending
      || selectedIndex === null
      || controls.length <= (
        closed
          ? APEX_TRACK_EDITOR_MIN_CLOSED_CONTROLS
          : APEX_TRACK_EDITOR_MIN_OPEN_CONTROLS
      )
    );
    panel.snapRoad.disabled = (
      !options.snapToRoad
      || selectedIndex === null
      || roadSnapPending
    );
    panel.snapAllRoad.disabled = (
      !options.snapToRoad
      || controls.length === 0
      || roadSnapPending
    );
    if (selectedIndex === null) {
      panel.selection.value = [
        `Controles · ${controls.length}`,
        `tramos · ${evaluated.length}`,
        'ninguno seleccionado',
      ].join(' · ');
      panel.coordinates.value = 'X — · Y — · Z —';
      return;
    }
    const point = controls[selectedIndex];
    panel.selection.value = `Control ${selectedIndex + 1} / ${controls.length}`;
    panel.coordinates.value = [
      `X ${point.x.toFixed(3)}`,
      `Y ${point.y.toFixed(3)}`,
      `Z ${point.z.toFixed(3)}`,
      `BANK ${THREE.MathUtils.radToDeg(point.bankRadians).toFixed(2)}°`,
    ].join(' · ');
  };

  const updateControlVisuals = (): void => {
    controlSpheres.count = controls.length;
    controlLineGeometry.setDrawRange(
      0,
      controls.length + (closed && controls.length > 0 ? 1 : 0),
    );
    controls.forEach((point, index) => {
      controlPositions[index * 3] = point.x;
      controlPositions[index * 3 + 1] = point.y;
      controlPositions[index * 3 + 2] = point.z;
      const selected = index === selectedIndex;
      controlMatrixHelper.position.set(point.x, point.y, point.z);
      controlMatrixHelper.scale.setScalar(selected ? 1.32 : 1);
      controlMatrixHelper.updateMatrix();
      controlSpheres.setMatrixAt(index, controlMatrixHelper.matrix);
      controlSpheres.setColorAt(
        index,
        selected ? selectedColor : normalColor,
      );
    });
    if (closed && controls.length > 0) {
      const first = controls[0];
      const closingIndex = controls.length;
      controlPositions[closingIndex * 3] = first.x;
      controlPositions[closingIndex * 3 + 1] = first.y;
      controlPositions[closingIndex * 3 + 2] = first.z;
    }
    controlSpheres.instanceMatrix.needsUpdate = true;
    if (controlSpheres.instanceColor) {
      controlSpheres.instanceColor.needsUpdate = true;
    }
    controlLineGeometry.getAttribute('position').needsUpdate = true;
    controlLineGeometry.computeBoundingSphere();
  };

  const updateInfluenceGradient = (): void => {
    const influencePositions: number[] = [];
    const influenceColors: number[] = [];
    const activeSelectedIndex = selectedIndex;
    if (activeSelectedIndex !== null) {
      const edgeColor = new THREE.Color(0xc60f32);
      const centerColor = new THREE.Color(0xffe075);
      const influenceColor = new THREE.Color();
      evaluated.forEach((point, index) => {
        const progress = closed
          ? index / Math.max(1, evaluated.length)
          : index / Math.max(1, evaluated.length - 1);
        const controlCoordinate = progress * (
          closed ? controls.length : controls.length - 1
        );
        const rawDistance = Math.abs(controlCoordinate - activeSelectedIndex);
        const controlDistance = closed
          ? Math.min(rawDistance, controls.length - rawDistance)
          : rawDistance;
        const influence = 1 - THREE.MathUtils.smoothstep(
          controlDistance,
          0.35,
          2.15,
        );
        if (influence <= 0.01) return;
        influencePositions.push(point.x, point.y + 0.04, point.z);
        influenceColor.lerpColors(edgeColor, centerColor, influence);
        influenceColors.push(
          influenceColor.r,
          influenceColor.g,
          influenceColor.b,
        );
      });
    }
    influenceGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(influencePositions, 3),
    );
    influenceGeometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(influenceColors, 3),
    );
    influenceGeometry.computeBoundingSphere();
  };

  const updateEvaluatedLine = (): void => {
    const linePoints = evaluated.map(
      point => new THREE.Vector3(point.x, point.y, point.z),
    );
    if (closed && linePoints.length > 0) {
      linePoints.push(linePoints[0].clone());
    }
    evaluatedLineGeometry.setFromPoints(
      linePoints,
    );
    evaluatedLineGeometry.computeBoundingSphere();
  };

  const saveTransientDraft = (): void => {
    draftAutosaveTimer = undefined;
    const transientEvaluated = simplifyEvaluatedTrack(
      evaluateControlSpline(controls, collisionSpacingM, closed),
      closed,
      simplificationToleranceM,
      APEX_TRACK_EDITOR_SIMPLIFICATION_MAX_SEGMENT_M,
    );
    const draftSaved = options.onDraftSave?.(
      readonlySnapshot(controls),
      readonlySnapshot(transientEvaluated),
      roadWidthM,
      boundaryMode,
      roadsideMode,
      simplificationToleranceM,
    );
    panel.state.value = draftSaved === false
      ? 'Edición pendiente · error guardando draft temporal'
      : 'Edición pendiente · draft temporal guardado · soltar para aplicar';
  };

  const renderTransientRoadPreview = (timestamp: number): void => {
    if (timestamp - lastPreviewRenderedAt < 42) {
      previewAnimationFrame = window.requestAnimationFrame(
        renderTransientRoadPreview,
      );
      return;
    }
    previewAnimationFrame = undefined;
    lastPreviewRenderedAt = timestamp;
    if (!options.onPreview) return;
    const transientEvaluated = simplifyEvaluatedTrack(
      evaluateControlSpline(controls, collisionSpacingM, closed),
      closed,
      simplificationToleranceM,
      APEX_TRACK_EDITOR_SIMPLIFICATION_MAX_SEGMENT_M,
    );
    options.onPreview(
      readonlySnapshot(transientEvaluated),
      roadWidthM,
      boundaryMode,
      roadsideMode,
    );
  };

  const scheduleTransientRoadPreview = (): void => {
    if (!options.onPreview || previewAnimationFrame !== undefined) return;
    previewAnimationFrame = window.requestAnimationFrame(
      renderTransientRoadPreview,
    );
  };

  const scheduleTransientDraftSave = (): void => {
    if (!options.onDraftSave) return;
    if (draftAutosaveTimer !== undefined) {
      window.clearTimeout(draftAutosaveTimer);
    }
    draftAutosaveTimer = window.setTimeout(saveTransientDraft, 240);
  };

  const selectNode = (index: number | null): void => {
    selectedIndex = index;
    if (index === null) {
      transform.detach();
    } else {
      const point = controls[index];
      selectedAnchor.position.set(point.x, point.y, point.z);
      transform.attach(selectedAnchor);
    }
    updateControlVisuals();
    updateInfluenceGradient();
    updateReadout();
    if (index !== null) {
      panel.state.value = [
        'Influencia',
        `control ${index + 1}`,
        `gradiente ≈ ${(controlSpacingM * 2.15).toFixed(1)} m por lado`,
      ].join(' · ');
    }
  };

  const moveSelectedControl = (): void => {
    if (selectedIndex === null) return;
    const point = controls[selectedIndex];
    point.x = selectedAnchor.position.x;
    point.y = selectedAnchor.position.y;
    point.z = selectedAnchor.position.z;
    updateControlVisuals();
    updateInfluenceGradient();
    updateReadout();
    panel.state.value = 'Spline · cambio pendiente · soltar para recalcular';
    panel.state.dataset.dirty = 'true';
    scheduleTransientRoadPreview();
    scheduleTransientDraftSave();
  };

  const recalculateAndCommit = (): void => {
    if (previewAnimationFrame !== undefined) {
      window.cancelAnimationFrame(previewAnimationFrame);
      previewAnimationFrame = undefined;
    }
    if (draftAutosaveTimer !== undefined) {
      window.clearTimeout(draftAutosaveTimer);
      draftAutosaveTimer = undefined;
    }
    evaluated = simplifyEvaluatedTrack(
      evaluateControlSpline(controls, collisionSpacingM, closed),
      closed,
      simplificationToleranceM,
      APEX_TRACK_EDITOR_SIMPLIFICATION_MAX_SEGMENT_M,
    );
    updateEvaluatedLine();
    updateInfluenceGradient();
    updateReadout();
    panel.state.dataset.dirty = 'false';
    const evaluatedSnapshot = readonlySnapshot(evaluated);
    const controlSnapshot = readonlySnapshot(controls);
    const draftSaved = options.onDraftSave?.(
      controlSnapshot,
      evaluatedSnapshot,
      roadWidthM,
      boundaryMode,
      roadsideMode,
      simplificationToleranceM,
    );
    options.onCommit(
      evaluatedSnapshot,
      controlSnapshot,
      roadWidthM,
      boundaryMode,
      roadsideMode,
      simplificationToleranceM,
    );
    panel.state.value = draftSaved === false
      ? 'Spline · recalculada · error guardando draft'
      : draftSaved === true
        ? `Spline · ${evaluated.length} puntos · draft local guardado`
        : `Spline · recalculada · ${evaluated.length} puntos`;
  };

  const tangentAtControl = (index: number): THREE.Vector3 => {
    const current = controls[index];
    const previous = controls[
      closed
        ? (index - 1 + controls.length) % controls.length
        : Math.max(0, index - 1)
    ];
    const next = controls[
      closed
        ? (index + 1) % controls.length
        : Math.min(controls.length - 1, index + 1)
    ];
    if (!closed && index === 0) {
      snapTangent.set(
        next.x - current.x,
        next.y - current.y,
        next.z - current.z,
      );
    } else if (!closed && index === controls.length - 1) {
      snapTangent.set(
        current.x - previous.x,
        current.y - previous.y,
        current.z - previous.z,
      );
    } else {
      snapTangent.set(
        next.x - previous.x,
        next.y - previous.y,
        next.z - previous.z,
      );
    }
    return snapTangent.normalize();
  };

  const bankFromSurfaceNormal = (
    index: number,
    surfaceNormal: THREE.Vector3,
  ): number => {
    const tangent = tangentAtControl(index);
    if (tangent.lengthSq() < 0.000001) return controls[index].bankRadians;
    snapHorizontalLateral.set(-tangent.z, 0, tangent.x);
    if (snapHorizontalLateral.lengthSq() < 0.000001) {
      return controls[index].bankRadians;
    }
    snapHorizontalLateral.normalize();
    snapBaseUp.copy(snapHorizontalLateral).cross(tangent).normalize();
    snapProjectedNormal.copy(surfaceNormal).normalize();
    if (snapProjectedNormal.y < 0) snapProjectedNormal.negate();
    snapProjectedNormal.addScaledVector(
      tangent,
      -snapProjectedNormal.dot(tangent),
    );
    if (snapProjectedNormal.lengthSq() < 0.000001) {
      return controls[index].bankRadians;
    }
    snapProjectedNormal.normalize();
    const bankRadians = Math.atan2(
      tangent.dot(
        snapCross.copy(snapBaseUp).cross(snapProjectedNormal),
      ),
      THREE.MathUtils.clamp(
        snapBaseUp.dot(snapProjectedNormal),
        -1,
        1,
      ),
    );
    return THREE.MathUtils.clamp(
      bankRadians,
      -THREE.MathUtils.degToRad(60),
      THREE.MathUtils.degToRad(60),
    );
  };

  const snapSelectedControlToRoad = async (): Promise<void> => {
    const snapToRoad = options.snapToRoad;
    if (
      !snapToRoad
      || selectedIndex === null
      || roadSnapPending
    ) return;
    const requestedIndex = selectedIndex;
    const requestedPoint = controls[requestedIndex];
    roadSnapPending = true;
    updateReadout();
    panel.state.value = (
      `Snap to road · buscando superficie para control ${requestedIndex + 1}…`
    );
    try {
      const result = await snapToRoad(new THREE.Vector3(
        requestedPoint.x,
        requestedPoint.y,
        requestedPoint.z,
      ));
      if (
        controls[requestedIndex] !== requestedPoint
        || selectedIndex !== requestedIndex
      ) return;
      if (!result) {
        panel.state.value = 'Snap to road · no se encontró camino adyacente';
        return;
      }
      requestedPoint.x = result.position.x;
      requestedPoint.y = result.position.y;
      requestedPoint.z = result.position.z;
      requestedPoint.bankRadians = bankFromSurfaceNormal(
        requestedIndex,
        result.normal,
      );
      if (selectedIndex === requestedIndex) {
        selectedAnchor.position.copy(result.position);
      }
      updateControlVisuals();
      updateInfluenceGradient();
      recalculateAndCommit();
      const horizontalDistanceM = result.horizontalDistanceM ?? 0;
      panel.state.value = [
        'Snap to road aplicado',
        `Y ${requestedPoint.y.toFixed(3)} m`,
        `bank ${THREE.MathUtils.radToDeg(
          requestedPoint.bankRadians,
        ).toFixed(2)}°`,
        horizontalDistanceM > 0.001
          ? `ajuste lateral ${horizontalDistanceM.toFixed(2)} m`
          : 'proyección vertical',
      ].join(' · ');
    } catch (error) {
      panel.state.value = (
        `Snap to road · ${
          error instanceof Error ? error.message : 'error desconocido'
        }`
      );
    } finally {
      roadSnapPending = false;
      updateReadout();
    }
  };

  const snapAllControlsToRoad = async (): Promise<void> => {
    const snapToRoad = options.snapToRoad;
    if (!snapToRoad || controls.length === 0 || roadSnapPending) return;
    const controlReferences = [...controls];
    const results: (ApexTrackRoadSnap | undefined)[] = [];
    roadSnapPending = true;
    transform.enabled = false;
    updateReadout();
    try {
      for (let index = 0; index < controlReferences.length; index += 1) {
        const point = controlReferences[index];
        panel.state.value = (
          `Snap all to grid · ${index + 1} / ${controlReferences.length}`
        );
        results.push(await snapToRoad(new THREE.Vector3(
          point.x,
          point.y,
          point.z,
        )));
      }
      if (
        controls.length !== controlReferences.length
        || controls.some((point, index) => (
          point !== controlReferences[index]
        ))
      ) {
        panel.state.value = (
          'Snap all to grid · cancelado porque cambió la lista de controles'
        );
        return;
      }

      let snappedCount = 0;
      let lateralAdjustmentCount = 0;
      results.forEach((result, index) => {
        if (!result) return;
        const point = controls[index];
        point.x = result.position.x;
        point.y = result.position.y;
        point.z = result.position.z;
        snappedCount += 1;
        if ((result.horizontalDistanceM ?? 0) > 0.001) {
          lateralAdjustmentCount += 1;
        }
      });
      results.forEach((result, index) => {
        if (!result) return;
        controls[index].bankRadians = bankFromSurfaceNormal(
          index,
          result.normal,
        );
      });
      if (snappedCount === 0) {
        panel.state.value = (
          'Snap all to grid · no se encontraron superficies adyacentes'
        );
        return;
      }
      if (selectedIndex !== null) {
        const selectedPoint = controls[selectedIndex];
        selectedAnchor.position.set(
          selectedPoint.x,
          selectedPoint.y,
          selectedPoint.z,
        );
      }
      updateControlVisuals();
      updateInfluenceGradient();
      recalculateAndCommit();
      panel.state.value = [
        'Snap all to grid aplicado',
        `${snappedCount} / ${controls.length} controles`,
        `${lateralAdjustmentCount} ajustes laterales`,
        'draft guardado',
      ].join(' · ');
    } catch (error) {
      panel.state.value = (
        `Snap all to grid · ${
          error instanceof Error ? error.message : 'error desconocido'
        }`
      );
    } finally {
      roadSnapPending = false;
      transform.enabled = true;
      updateReadout();
    }
  };

  transform.addEventListener('objectChange', moveSelectedControl);
  transform.addEventListener('dragging-changed', event => {
    orbit.enabled = !Boolean(event.value);
  });
  transform.addEventListener('mouseUp', recalculateAndCommit);

  const commitRoadWidth = (): void => {
    const nextRoadWidthM = THREE.MathUtils.clamp(
      Number(panel.roadWidth.value) || roadWidthM,
      APEX_TRACK_EDITOR_MIN_ROAD_WIDTH_M,
      APEX_TRACK_EDITOR_MAX_ROAD_WIDTH_M,
    );
    roadWidthM = nextRoadWidthM;
    panel.roadWidth.value = roadWidthM.toFixed(2);
    root.userData.roadWidthM = roadWidthM;
    const evaluatedSnapshot = readonlySnapshot(evaluated);
    const controlSnapshot = readonlySnapshot(controls);
    const draftSaved = options.onDraftSave?.(
      controlSnapshot,
      evaluatedSnapshot,
      roadWidthM,
      boundaryMode,
      roadsideMode,
      simplificationToleranceM,
    );
    options.onCommit(
      evaluatedSnapshot,
      controlSnapshot,
      roadWidthM,
      boundaryMode,
      roadsideMode,
      simplificationToleranceM,
    );
    panel.state.value = draftSaved === false
      ? `Ancho · ${roadWidthM.toFixed(2)} m · error guardando draft`
      : `Ancho · ${roadWidthM.toFixed(2)} m · límite regenerado`;
  };
  panel.roadWidth.addEventListener('change', commitRoadWidth);
  panel.boundaryMode.addEventListener('change', () => {
    boundaryMode = panel.boundaryMode.value as ApexTrackBoundaryMode;
    root.userData.boundaryMode = boundaryMode;
    const evaluatedSnapshot = readonlySnapshot(evaluated);
    const controlSnapshot = readonlySnapshot(controls);
    const draftSaved = options.onDraftSave?.(
      controlSnapshot,
      evaluatedSnapshot,
      roadWidthM,
      boundaryMode,
      roadsideMode,
      simplificationToleranceM,
    );
    options.onCommit(
      evaluatedSnapshot,
      controlSnapshot,
      roadWidthM,
      boundaryMode,
      roadsideMode,
      simplificationToleranceM,
    );
    panel.state.value = draftSaved === false
      ? `Límite · ${boundaryMode} · error guardando draft`
      : `Límite · ${boundaryMode} · regenerado`;
  });
  panel.roadsideMode.addEventListener('change', () => {
    roadsideMode = panel.roadsideMode.value as ApexTrackRoadsideMode;
    root.userData.roadsideMode = roadsideMode;
    const evaluatedSnapshot = readonlySnapshot(evaluated);
    const controlSnapshot = readonlySnapshot(controls);
    const draftSaved = options.onDraftSave?.(
      controlSnapshot,
      evaluatedSnapshot,
      roadWidthM,
      boundaryMode,
      roadsideMode,
      simplificationToleranceM,
    );
    options.onCommit(
      evaluatedSnapshot,
      controlSnapshot,
      roadWidthM,
      boundaryMode,
      roadsideMode,
      simplificationToleranceM,
    );
    panel.state.value = draftSaved === false
      ? `Lateral · ${roadsideMode} · error guardando draft`
      : `Lateral · ${roadsideMode} · regenerado`;
  });

  const removeSelectedControl = (): void => {
    if (selectedIndex === null) return;
    const minimumControlCount = closed
      ? APEX_TRACK_EDITOR_MIN_CLOSED_CONTROLS
      : APEX_TRACK_EDITOR_MIN_OPEN_CONTROLS;
    if (controls.length <= minimumControlCount) return;
    const removedIndex = selectedIndex;
    transform.detach();
    selectedIndex = null;
    controls.splice(removedIndex, 1);
    updateControlVisuals();
    updateInfluenceGradient();
    recalculateAndCommit();
    panel.state.value = (
      `Nodo ${removedIndex + 1} eliminado · ${controls.length} controles`
    );
  };

  const smoothControls = (): void => {
    if (controls.length < 3) return;
    const source = controls.map(point => ({ ...point }));
    controls.forEach((point, index) => {
      if (!closed && (index === 0 || index === controls.length - 1)) {
        return;
      }
      const previous = source[
        (index - 1 + source.length) % source.length
      ];
      const next = source[(index + 1) % source.length];
      point.x = previous.x * 0.2 + point.x * 0.6 + next.x * 0.2;
      point.y = previous.y * 0.2 + point.y * 0.6 + next.y * 0.2;
      point.z = previous.z * 0.2 + point.z * 0.6 + next.z * 0.2;
    });
    if (selectedIndex !== null) {
      const point = controls[selectedIndex];
      selectedAnchor.position.set(point.x, point.y, point.z);
    }
    updateControlVisuals();
    updateInfluenceGradient();
    recalculateAndCommit();
    panel.state.value = `Suavizado aplicado · ${controls.length} controles`;
  };

  const distanceToNeighbourChordM = (
    previous: MutableTrackPoint,
    point: MutableTrackPoint,
    next: MutableTrackPoint,
  ): number => {
    const chordX = next.x - previous.x;
    const chordY = next.y - previous.y;
    const chordZ = next.z - previous.z;
    const chordLengthSquared = (
      chordX * chordX + chordY * chordY + chordZ * chordZ
    );
    if (chordLengthSquared <= 0.000001) {
      return Math.hypot(
        point.x - previous.x,
        point.y - previous.y,
        point.z - previous.z,
      );
    }
    const projection = THREE.MathUtils.clamp(
      (
        (point.x - previous.x) * chordX
        + (point.y - previous.y) * chordY
        + (point.z - previous.z) * chordZ
      ) / chordLengthSquared,
      0,
      1,
    );
    return Math.hypot(
      point.x - (previous.x + chordX * projection),
      point.y - (previous.y + chordY * projection),
      point.z - (previous.z + chordZ * projection),
    );
  };

  const simplifyControls = (): void => {
    const minimumControlCount = closed
      ? APEX_TRACK_EDITOR_MIN_CLOSED_CONTROLS
      : APEX_TRACK_EDITOR_MIN_OPEN_CONTROLS;
    const toleranceM = Math.max(0.2, controlSpacingM * 0.04);
    const source = controls.map(point => ({ ...point }));
    const previousEvaluatedCount = evaluated.length;
    const simplified = source.filter((point, index) => {
      if (!closed && (index === 0 || index === source.length - 1)) {
        return true;
      }
      const previous = source[(index - 1 + source.length) % source.length];
      const next = source[(index + 1) % source.length];
      return distanceToNeighbourChordM(previous, point, next) > toleranceM;
    });
    if (
      simplified.length >= minimumControlCount
      && simplified.length < controls.length
    ) {
      controls.splice(0, controls.length, ...simplified);
    }
    simplificationToleranceM = Math.max(
      simplificationToleranceM,
      APEX_TRACK_EDITOR_SIMPLIFICATION_TOLERANCE_M,
    );
    root.userData.simplificationToleranceM = simplificationToleranceM;
    selectNode(null);
    updateControlVisuals();
    updateInfluenceGradient();
    recalculateAndCommit();
    panel.state.value = (
      `Simplificada · controles ${source.length} → ${controls.length}`
      + ` · pista ${previousEvaluatedCount} → ${evaluated.length} puntos`
    );
  };

  panel.remove.addEventListener('click', removeSelectedControl);
  panel.snapRoad.addEventListener('click', () => {
    void snapSelectedControlToRoad();
  });
  panel.snapAllRoad.addEventListener('click', () => {
    void snapAllControlsToRoad();
  });
  panel.smooth.addEventListener('click', smoothControls);
  panel.simplify.addEventListener('click', simplifyControls);

  options.domElement.addEventListener('pointerdown', event => {
    if (event.button === 2) {
      event.preventDefault();
      flyPointerId = event.pointerId;
      options.domElement.setPointerCapture(event.pointerId);
      flyEuler.setFromQuaternion(options.camera.quaternion, 'YXZ');
      flyPitchRadians = flyEuler.x;
      flyYawRadians = flyEuler.y;
      orbit.enabled = false;
      panel.state.value = 'Cámara · vuelo libre noclip';
      return;
    }
    if (event.button !== 0 || transform.dragging) return;
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
    pointerDownForSelection = true;
  });
  options.domElement.addEventListener('pointerup', event => {
    if (event.button === 2 && flyPointerId === event.pointerId) {
      flyPointerId = null;
      if (options.domElement.hasPointerCapture(event.pointerId)) {
        options.domElement.releasePointerCapture(event.pointerId);
      }
      options.camera.getWorldDirection(flyDirection);
      orbit.target.copy(options.camera.position).addScaledVector(
        flyDirection,
        24,
      );
      orbit.enabled = true;
      orbit.update();
      panel.state.value = panel.state.dataset.dirty === 'true'
        ? 'Spline · cambio pendiente · soltar gizmo para recalcular'
        : 'Spline · lista';
      return;
    }
    if (
      event.button !== 0
      || !pointerDownForSelection
      || transform.dragging
      || Math.hypot(
        event.clientX - pointerDownX,
        event.clientY - pointerDownY,
      ) > 4
    ) {
      pointerDownForSelection = false;
      return;
    }
    pointerDownForSelection = false;
    const bounds = options.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, options.camera);
    const hit = raycaster.intersectObject(controlSpheres, false)[0];
    selectNode(hit?.instanceId ?? null);
  });
  options.domElement.addEventListener('contextmenu', event => {
    event.preventDefault();
  });
  options.domElement.addEventListener('pointermove', event => {
    if (flyPointerId !== event.pointerId) return;
    flyYawRadians -= event.movementX * 0.0022;
    flyPitchRadians = THREE.MathUtils.clamp(
      flyPitchRadians - event.movementY * 0.0022,
      -Math.PI * 0.495,
      Math.PI * 0.495,
    );
    options.camera.quaternion.setFromEuler(
      flyEuler.set(flyPitchRadians, flyYawRadians, 0, 'YXZ'),
    );
  });

  const focusSelection = (): void => {
    if (selectedIndex === null) return;
    const target = selectedAnchor.position;
    const direction = options.camera.position.clone()
      .sub(orbit.target)
      .normalize();
    orbit.target.copy(target);
    options.camera.position.copy(target).addScaledVector(direction, 18);
    orbit.update();
  };
  window.addEventListener('keydown', event => {
    const target = event.target;
    const typing = target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement;
    if (flyControlCodes.has(event.code)) {
      flyKeys.add(event.code);
      if (flyPointerId !== null) event.preventDefault();
    }
    if (
      !typing
      && (event.code === 'Delete' || event.code === 'Backspace')
      && selectedIndex !== null
    ) {
      event.preventDefault();
      removeSelectedControl();
    } else if (event.code === 'Escape') {
      selectNode(null);
    } else if (event.code === 'KeyF' && !event.repeat) {
      event.preventDefault();
      focusSelection();
    }
  });
  window.addEventListener('keyup', event => {
    flyKeys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    if (
      panel.state.dataset.dirty === 'true'
      && draftAutosaveTimer !== undefined
    ) {
      window.clearTimeout(draftAutosaveTimer);
      saveTransientDraft();
    }
    flyKeys.clear();
    flyPointerId = null;
    orbit.enabled = !transform.dragging;
  });

  panel.reset.addEventListener('click', () => {
    controls.splice(
      0,
      controls.length,
      ...baseControls.map(point => ({ ...point })),
    );
    evaluated = baseEvaluated.map(point => ({ ...point }));
    roadWidthM = baseRoadWidthM;
    boundaryMode = baseBoundaryMode;
    roadsideMode = baseRoadsideMode;
    simplificationToleranceM = baseSimplificationToleranceM;
    panel.roadWidth.value = roadWidthM.toFixed(2);
    panel.boundaryMode.value = boundaryMode;
    panel.roadsideMode.value = roadsideMode;
    panel.spacing.textContent = (
      `Controles ${controlSpacingM.toFixed(1)} m`
      + ` · colisión ${collisionSpacingM.toFixed(1)} m`
    );
    root.userData.roadWidthM = roadWidthM;
    root.userData.boundaryMode = boundaryMode;
    root.userData.roadsideMode = roadsideMode;
    root.userData.simplificationToleranceM = simplificationToleranceM;
    selectNode(null);
    updateControlVisuals();
    updateEvaluatedLine();
    updateReadout();
    panel.state.dataset.dirty = 'false';
    const evaluatedSnapshot = readonlySnapshot(evaluated);
    const controlSnapshot = readonlySnapshot(controls);
    const draftSaved = options.onDraftSave?.(
      controlSnapshot,
      evaluatedSnapshot,
      roadWidthM,
      boundaryMode,
      roadsideMode,
      simplificationToleranceM,
    );
    options.onCommit(
      evaluatedSnapshot,
      controlSnapshot,
      roadWidthM,
      boundaryMode,
      roadsideMode,
      simplificationToleranceM,
    );
    panel.state.value = draftSaved === false
      ? 'Spline · restaurada · error guardando draft'
      : draftSaved === true
        ? 'Spline · base restaurada · draft local guardado'
        : `Spline · restaurada · ${evaluated.length} puntos`;
  });
  panel.copy.addEventListener('click', () => {
    const payload = JSON.stringify({
      format: 'apex-track-edit',
      formatVersion: 5,
      controlSpacingM,
      collisionSpacingM,
      roadWidthM,
      boundaryMode,
      roadsideMode,
      simplificationToleranceM,
      closed,
      controlPoints: readonlySnapshot(controls),
      evaluatedPoints: readonlySnapshot(evaluated),
    }, null, 2);
    void navigator.clipboard.writeText(payload).then(() => {
      panel.copy.textContent = 'Copiado';
      window.setTimeout(() => {
        panel.copy.textContent = 'Copiar contrato';
      }, 1200);
    });
  });
  panel.saveFile.disabled = !options.onSaveFile;
  panel.saveFile.addEventListener('click', () => {
    if (!options.onSaveFile) return;
    panel.saveFile.disabled = true;
    panel.state.value = 'Publicando una revisión en APEX Void…';
    void options.onSaveFile(
      readonlySnapshot(controls),
      readonlySnapshot(evaluated),
      roadWidthM,
      boundaryMode,
      roadsideMode,
      simplificationToleranceM,
    ).then(result => {
      panel.state.value = result.revision
        ? `Publicado en APEX Void · ${result.revision}`
        : `Publicado · ${result.relativePath}`;
      panel.saveFile.textContent = 'Guardado';
      window.setTimeout(() => {
        panel.saveFile.textContent = 'Guardar fuente';
      }, 1400);
    }).catch(error => {
      panel.state.value = (
        `Archivo · ${error instanceof Error ? error.message : 'error al guardar'}`
      );
    }).finally(() => {
      panel.saveFile.disabled = false;
    });
  });

  const loadSession = (session: ApexTrackEditorSession): void => {
    if (session.points.length < 2) {
      throw new Error('El tramo debe contener al menos dos puntos');
    }
    const nextBaseControls = session.baseControlPoints?.length
      ? session.baseControlPoints.map(clonePoint)
      : createControlPoints(
        session.points,
        session.controlSpacingM,
        session.closed,
      );
    const nextControls = (
      session.controlPoints?.length
        ? session.controlPoints
        : nextBaseControls
    ).map(clonePoint);
    if (nextControls.length + 1 > controlCapacity) {
      throw new Error(
        `El tramo supera la capacidad de ${controlCapacity - 1} controles`,
      );
    }
    const nextEvaluated = (
      session.evaluatedPoints?.length
        ? session.evaluatedPoints
        : session.points
    ).map(clonePoint);

    if (draftAutosaveTimer !== undefined) {
      window.clearTimeout(draftAutosaveTimer);
      draftAutosaveTimer = undefined;
    }
    if (previewAnimationFrame !== undefined) {
      window.cancelAnimationFrame(previewAnimationFrame);
      previewAnimationFrame = undefined;
    }
    transform.detach();
    transform.enabled = true;
    selectedIndex = null;
    roadSnapPending = false;
    pointerDownForSelection = false;
    flyKeys.clear();
    flyPointerId = null;
    orbit.enabled = true;

    closed = session.closed;
    controlSpacingM = session.controlSpacingM;
    collisionSpacingM = session.collisionSpacingM;
    baseRoadWidthM = THREE.MathUtils.clamp(
      session.roadWidthM,
      APEX_TRACK_EDITOR_MIN_ROAD_WIDTH_M,
      APEX_TRACK_EDITOR_MAX_ROAD_WIDTH_M,
    );
    roadWidthM = baseRoadWidthM;
    baseBoundaryMode = session.boundaryMode;
    boundaryMode = session.boundaryMode;
    baseRoadsideMode = session.roadsideMode;
    roadsideMode = session.roadsideMode;
    baseSimplificationToleranceM = THREE.MathUtils.clamp(
      session.simplificationToleranceM,
      0,
      2,
    );
    simplificationToleranceM = baseSimplificationToleranceM;
    baseControls = nextBaseControls.map(point => ({ ...point }));
    baseEvaluated = session.points.map(clonePoint);
    controls.splice(0, controls.length, ...nextControls);
    evaluated = nextEvaluated;

    panel.roadWidth.value = roadWidthM.toFixed(2);
    panel.boundaryMode.value = boundaryMode;
    panel.roadsideMode.value = roadsideMode;
    panel.spacing.textContent = (
      `Controles ${controlSpacingM.toFixed(1)} m`
      + ` · colisión ${collisionSpacingM.toFixed(1)} m`
    );
    panel.state.dataset.dirty = 'false';
    root.userData.controlSpacingM = controlSpacingM;
    root.userData.collisionSpacingM = collisionSpacingM;
    root.userData.closed = closed;
    root.userData.roadWidthM = roadWidthM;
    root.userData.boundaryMode = boundaryMode;
    root.userData.roadsideMode = roadsideMode;
    root.userData.simplificationToleranceM = simplificationToleranceM;
    updateControlVisuals();
    updateEvaluatedLine();
    updateInfluenceGradient();
    updateReadout();
    panel.state.value = (
      `Tramo activo · ${controls.length} controles`
      + ` · ${evaluated.length} puntos físicos`
    );
    // Deliberadamente no modificar camera, quaternion ni orbit.target.
  };

  updateControlVisuals();
  updateEvaluatedLine();
  updateInfluenceGradient();
  updateReadout();
  if (
    options.initialControlPoints?.length
    && options.initialEvaluatedPoints?.length
  ) {
    panel.state.value = (
      `Spline · draft local restaurado · ${evaluated.length} puntos`
    );
  }

  return {
    root,
    get nodeCount() {
      return controls.length;
    },
    get evaluatedPointCount() {
      return evaluated.length;
    },
    get selectedIndex() {
      return selectedIndex;
    },
    get controlPoints() {
      return readonlySnapshot(controls);
    },
    get evaluatedPoints() {
      return readonlySnapshot(evaluated);
    },
    get roadWidthM() {
      return roadWidthM;
    },
    get boundaryMode() {
      return boundaryMode;
    },
    get roadsideMode() {
      return roadsideMode;
    },
    get simplificationToleranceM() {
      return simplificationToleranceM;
    },
    get cameraState() {
      return cameraStateSnapshot();
    },
    loadSession,
    update: (deltaSeconds: number) => {
      if (flyPointerId !== null) {
        options.camera.getWorldDirection(flyDirection).normalize();
        flyRight.set(1, 0, 0)
          .applyQuaternion(options.camera.quaternion)
          .normalize();
        flyMovement.set(0, 0, 0)
          .addScaledVector(
            flyDirection,
            (flyKeys.has('KeyW') ? 1 : 0)
              - (flyKeys.has('KeyS') ? 1 : 0),
          )
          .addScaledVector(
            flyRight,
            (flyKeys.has('KeyD') ? 1 : 0)
              - (flyKeys.has('KeyA') ? 1 : 0),
          )
          .addScaledVector(
            flyUp,
            (flyKeys.has('KeyE') ? 1 : 0)
              - (flyKeys.has('KeyQ') ? 1 : 0),
          );
        if (flyMovement.lengthSq() > 1) flyMovement.normalize();
        const boosted = flyKeys.has('ShiftLeft')
          || flyKeys.has('ShiftRight');
        options.camera.position.addScaledVector(
          flyMovement,
          deltaSeconds * (boosted ? 90 : 28),
        );
        reportCameraState();
        return;
      }
      orbit.update();
      reportCameraState();
    },
  };
};
