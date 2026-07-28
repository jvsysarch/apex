import * as THREE from 'three/webgpu';
import type { TrackPoint } from '../ApexTestTrack';

export interface ApexTrackSegmentDrawToolOptions {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly roadWidthM: number;
  readonly collisionSpacingM: number;
  readonly surface: TrackPoint['surface'];
  readonly onCommit: (
    controlPoints: readonly TrackPoint[],
    evaluatedPoints: readonly TrackPoint[],
  ) => void;
  readonly onCancel?: () => void;
}

export interface ApexTrackSegmentDrawTool {
  readonly active: boolean;
  readonly pointCount: number;
  update(): void;
  dispose(): void;
}

const snapshot = (
  points: readonly THREE.Vector3[],
  surface: TrackPoint['surface'],
): readonly TrackPoint[] => Object.freeze(points.map(point => Object.freeze({
  x: point.x,
  y: point.y,
  z: point.z,
  bankRadians: 0,
  surface,
})));

const evaluate = (
  controls: readonly THREE.Vector3[],
  spacingM: number,
  surface: TrackPoint['surface'],
): readonly TrackPoint[] => {
  if (controls.length < 2) return snapshot(controls, surface);
  const curve = new THREE.CatmullRomCurve3(
    controls.map(point => point.clone()),
    false,
    'centripetal',
    0.5,
  );
  const sampleCount = Math.max(1, Math.ceil(curve.getLength() / spacingM));
  return Object.freeze(curve.getSpacedPoints(sampleCount).map(point => (
    Object.freeze({
      x: point.x,
      y: point.y,
      z: point.z,
      bankRadians: 0,
      surface,
    })
  )));
};

const createRibbonGeometry = (
  points: readonly TrackPoint[],
  roadWidthM: number,
): THREE.BufferGeometry => {
  const positions: number[] = [];
  const indices: number[] = [];
  points.forEach((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const tangent = new THREE.Vector3(
      next.x - previous.x,
      next.y - previous.y,
      next.z - previous.z,
    ).normalize();
    const lateral = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    positions.push(
      point.x + lateral.x * roadWidthM * 0.5,
      point.y + 0.015,
      point.z + lateral.z * roadWidthM * 0.5,
      point.x - lateral.x * roadWidthM * 0.5,
      point.y + 0.015,
      point.z - lateral.z * roadWidthM * 0.5,
    );
    if (index < points.length - 1) {
      const base = index * 2;
      indices.push(
        base,
        base + 2,
        base + 1,
        base + 1,
        base + 2,
        base + 3,
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
  return geometry;
};

export const createApexTrackSegmentDrawTool = (
  options: ApexTrackSegmentDrawToolOptions,
): ApexTrackSegmentDrawTool => {
  const group = new THREE.Group();
  group.name = 'apex-track-segment-draw-tool';
  group.userData.authority = 'track-segment-authoring-preview';
  options.scene.add(group);

  const cursor = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffe071,
      transparent: true,
      opacity: 0.88,
      depthTest: false,
      depthWrite: false,
    }),
  );
  cursor.name = 'track-segment-construction-cursor';
  cursor.renderOrder = 96;
  group.add(cursor);

  const controlGeometry = new THREE.BufferGeometry();
  const controlsVisual = new THREE.Points(
    controlGeometry,
    new THREE.PointsMaterial({
      color: 0xff3558,
      size: 9,
      sizeAttenuation: false,
      depthTest: false,
      depthWrite: false,
    }),
  );
  controlsVisual.renderOrder = 95;
  group.add(controlsVisual);

  const lineGeometry = new THREE.BufferGeometry();
  const line = new THREE.Line(
    lineGeometry,
    new THREE.LineBasicMaterial({
      color: 0x9ff5ff,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      depthWrite: false,
    }),
  );
  line.renderOrder = 94;
  group.add(line);

  let ribbonGeometry = createRibbonGeometry([], options.roadWidthM);
  const ribbon = new THREE.Mesh(
    ribbonGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x21c7ef,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  ribbon.renderOrder = 70;
  group.add(ribbon);

  const panel = document.createElement('aside');
  panel.className = 'track-segment-draw-panel';
  panel.innerHTML = `
    <header>
      <strong>DIBUJAR TRAMO</strong>
      <small>FASE 3</small>
    </header>
    <output data-role="draw-state">Sin puntos</output>
    <p>
      RMB + WASD vuelo · Espacio agrega · Backspace deshace · Enter termina
      · Esc cancela
    </p>
    <label>
      Cursor
      <span>
        <input data-role="cursor-distance" type="number" min="3" max="80"
          step="1" value="12"> m
      </span>
    </label>
    <div>
      <button type="button" data-action="add-point">Agregar punto</button>
      <button type="button" data-action="undo-point">Deshacer</button>
    </div>
    <div>
      <button type="button" data-action="finish-segment">Terminar tramo</button>
      <button type="button" data-action="cancel-segment">Cancelar</button>
    </div>
  `;
  document.body.append(panel);
  const editorPanel = document.querySelector<HTMLElement>(
    '.track-editor-panel',
  );
  if (editorPanel) {
    editorPanel.inert = true;
    editorPanel.dataset.drawing = 'true';
  }
  const state = panel.querySelector<HTMLOutputElement>(
    '[data-role="draw-state"]',
  )!;
  const cursorDistanceInput = panel.querySelector<HTMLInputElement>(
    '[data-role="cursor-distance"]',
  )!;
  const addButton = panel.querySelector<HTMLButtonElement>(
    '[data-action="add-point"]',
  )!;
  const undoButton = panel.querySelector<HTMLButtonElement>(
    '[data-action="undo-point"]',
  )!;
  const finishButton = panel.querySelector<HTMLButtonElement>(
    '[data-action="finish-segment"]',
  )!;
  const cancelButton = panel.querySelector<HTMLButtonElement>(
    '[data-action="cancel-segment"]',
  )!;

  const controls: THREE.Vector3[] = [];
  const cameraDirection = new THREE.Vector3();
  const cursorTarget = new THREE.Vector3();
  let cursorDistanceM = 12;
  let active = true;

  const updatePreview = (): void => {
    const previewControls = controls.length > 0
      ? [...controls, cursor.position.clone()]
      : [cursor.position.clone()];
    controlGeometry.setFromPoints(controls);
    controlGeometry.computeBoundingSphere();
    const evaluated = previewControls.length >= 2
      ? evaluate(
        previewControls,
        Math.max(0.75, options.collisionSpacingM),
        options.surface,
      )
      : snapshot(previewControls, options.surface);
    lineGeometry.setFromPoints(evaluated.map(point => (
      new THREE.Vector3(point.x, point.y + 0.04, point.z)
    )));
    lineGeometry.computeBoundingSphere();
    ribbonGeometry.dispose();
    ribbonGeometry = createRibbonGeometry(evaluated, options.roadWidthM);
    ribbon.geometry = ribbonGeometry;
    finishButton.disabled = controls.length < 2;
    undoButton.disabled = controls.length === 0;
    state.value = controls.length === 0
      ? 'Mové la cámara y colocá el primer punto'
      : `${controls.length} puntos · cursor ${cursorDistanceM.toFixed(0)} m`;
  };

  const updateCursor = (): void => {
    options.camera.getWorldDirection(cameraDirection).normalize();
    cursorTarget.copy(options.camera.position).addScaledVector(
      cameraDirection,
      cursorDistanceM,
    );
    if (cursor.position.distanceToSquared(cursorTarget) < 0.000001) return;
    cursor.position.copy(cursorTarget);
    updatePreview();
  };

  const addPoint = (): void => {
    if (!active) return;
    const point = cursor.position.clone();
    const previous = controls[controls.length - 1];
    if (previous && previous.distanceTo(point) < 1) {
      state.value = 'Separá el cursor al menos 1 m del punto anterior';
      return;
    }
    controls.push(point);
    updatePreview();
  };

  const undoPoint = (): void => {
    if (!active || controls.length === 0) return;
    controls.pop();
    updatePreview();
  };

  const dispose = (): void => {
    if (!active) return;
    active = false;
    window.removeEventListener('keydown', onKeyDown, true);
    panel.remove();
    if (editorPanel) {
      editorPanel.inert = false;
      delete editorPanel.dataset.drawing;
    }
    options.scene.remove(group);
    cursor.geometry.dispose();
    (cursor.material as THREE.Material).dispose();
    controlGeometry.dispose();
    (controlsVisual.material as THREE.Material).dispose();
    lineGeometry.dispose();
    (line.material as THREE.Material).dispose();
    ribbonGeometry.dispose();
    (ribbon.material as THREE.Material).dispose();
  };

  const finish = (): void => {
    if (!active || controls.length < 2) return;
    const controlPoints = snapshot(controls, options.surface);
    const evaluatedPoints = evaluate(
      controls,
      options.collisionSpacingM,
      options.surface,
    );
    options.onCommit(controlPoints, evaluatedPoints);
    dispose();
  };

  const cancel = (): void => {
    if (!active) return;
    dispose();
    options.onCancel?.();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const typing = event.target instanceof HTMLInputElement
      || event.target instanceof HTMLTextAreaElement
      || event.target instanceof HTMLSelectElement;
    if (typing || event.repeat) return;
    if (event.code === 'Space') {
      event.preventDefault();
      event.stopImmediatePropagation();
      addPoint();
    } else if (event.code === 'Backspace') {
      event.preventDefault();
      event.stopImmediatePropagation();
      undoPoint();
    } else if (event.code === 'Enter') {
      event.preventDefault();
      event.stopImmediatePropagation();
      finish();
    } else if (event.code === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      cancel();
    }
  };
  window.addEventListener('keydown', onKeyDown, { capture: true });
  cursorDistanceInput.addEventListener('change', () => {
    cursorDistanceM = THREE.MathUtils.clamp(
      Number(cursorDistanceInput.value) || 12,
      3,
      80,
    );
    cursorDistanceInput.value = cursorDistanceM.toFixed(0);
    updateCursor();
  });
  addButton.addEventListener('click', addPoint);
  undoButton.addEventListener('click', undoPoint);
  finishButton.addEventListener('click', finish);
  cancelButton.addEventListener('click', cancel);
  updateCursor();

  return {
    get active() {
      return active;
    },
    get pointCount() {
      return controls.length;
    },
    update: updateCursor,
    dispose,
  };
};
