import * as THREE from 'three/webgpu';
import type {
  LapCheckpointStatus,
  LapGate,
  LapTimingState,
} from './ApexLapTimer';

export interface ApexRaceTrackMarkersOptions {
  readonly scene: THREE.Scene;
  readonly start: LapGate;
  readonly checkpoints: readonly LapGate[];
}

export interface ApexRaceTrackMarkers {
  readonly group: THREE.Group;
  update(state: LapTimingState): void;
  dispose(): void;
}

const checkpointColors: Readonly<Record<LapCheckpointStatus, number>> = {
  pending: 0xffd45e,
  passed: 0x55e88b,
  missed: 0xff625d,
};

const createNumberTexture = (label: string): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 192;
  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#ffffff';
  context.font = '800 102px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, canvas.width * 0.5, canvas.height * 0.52);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

const createStartPromptTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 144;
  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = 'rgba(93, 226, 244, 0.38)';
  context.shadowBlur = 18;
  context.fillStyle = 'rgba(226, 251, 255, 0.9)';
  context.font = '600 36px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('START  ·  DETENETE  ·  ENTER', canvas.width * 0.5, canvas.height * 0.5);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

const drawCountdown = (
  canvas: HTMLCanvasElement,
  texture: THREE.CanvasTexture,
  value: number,
): void => {
  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = 'rgba(131, 231, 244, 0.48)';
  context.shadowBlur = 24;
  context.fillStyle = 'rgba(238, 253, 255, 0.86)';
  context.font = '300 172px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(value), canvas.width * 0.5, canvas.height * 0.52);
  texture.needsUpdate = true;
};

export const createApexRaceTrackMarkers = (
  options: ApexRaceTrackMarkersOptions,
): ApexRaceTrackMarkers => {
  const group = new THREE.Group();
  group.name = 'apex-race-track-markers';
  group.userData.authority = 'lap-timing-state';
  options.scene.add(group);

  const startRadiusM = Math.max(1.5, options.start.radiusM);
  const startRingMaterial = new THREE.MeshBasicMaterial({
    color: 0x58d8ea,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -5,
  });
  const startRing = new THREE.Mesh(
    new THREE.RingGeometry(startRadiusM * 0.76, startRadiusM, 72),
    startRingMaterial,
  );
  startRing.name = 'lap-start-zone-ring';
  startRing.position.set(
    options.start.x,
    (options.start.y ?? 0) + 0.035,
    options.start.z,
  );
  startRing.rotation.x = -Math.PI / 2;
  startRing.renderOrder = 20;
  group.add(startRing);

  const startPromptTexture = createStartPromptTexture();
  const startPromptMaterial = new THREE.SpriteMaterial({
    map: startPromptTexture,
    color: 0xdffbff,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const startPrompt = new THREE.Sprite(startPromptMaterial);
  startPrompt.name = 'lap-start-prompt';
  startPrompt.position.set(
    options.start.x,
    (options.start.y ?? 0) + 1.35,
    options.start.z,
  );
  startPrompt.scale.set(startRadiusM * 1.8, startRadiusM * 0.34, 1);
  startPrompt.visible = false;
  startPrompt.renderOrder = 21;
  group.add(startPrompt);

  const countdownCanvas = document.createElement('canvas');
  countdownCanvas.width = 320;
  countdownCanvas.height = 320;
  const countdownTexture = new THREE.CanvasTexture(countdownCanvas);
  countdownTexture.colorSpace = THREE.SRGBColorSpace;
  const countdownMaterial = new THREE.MeshBasicMaterial({
    map: countdownTexture,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -7,
    polygonOffsetUnits: -7,
  });
  const countdownPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(startRadiusM * 1.35, startRadiusM * 1.35),
    countdownMaterial,
  );
  countdownPlane.name = 'lap-start-ground-countdown';
  countdownPlane.position.set(
    options.start.x,
    (options.start.y ?? 0) + 0.045,
    options.start.z,
  );
  countdownPlane.rotation.x = -Math.PI / 2;
  countdownPlane.renderOrder = 22;
  countdownPlane.visible = false;
  group.add(countdownPlane);

  const checkpointMarkers = options.checkpoints.map((gate, index) => {
    const root = new THREE.Group();
    root.name = `lap-checkpoint-${index + 1}`;
    root.position.set(gate.x, (gate.y ?? 0) + 0.04, gate.z);
    const radiusM = Math.max(1.2, gate.radiusM);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: checkpointColors.pending,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5,
    });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radiusM * 0.72, radiusM * 0.92, 64),
      ringMaterial,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 18;
    const numberTexture = createNumberTexture(String(index + 1));
    const numberMaterial = new THREE.MeshBasicMaterial({
      map: numberTexture,
      color: checkpointColors.pending,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -7,
      polygonOffsetUnits: -7,
    });
    const number = new THREE.Mesh(
      new THREE.PlaneGeometry(radiusM * 0.9, radiusM * 0.9),
      numberMaterial,
    );
    number.rotation.x = -Math.PI / 2;
    number.renderOrder = 19;
    root.add(ring, number);
    group.add(root);
    return {
      root,
      ringMaterial,
      numberMaterial,
      numberTexture,
      status: 'pending' as LapCheckpointStatus,
    };
  });

  let countdownValue: number | undefined;

  const update = (state: LapTimingState): void => {
    const approaching = state.phase === 'arming' || state.phase === 'abandoned';
    const justStarted = state.phase === 'running' && state.elapsedMs < 900;
    startRing.visible = (
      state.phase === 'countdown'
      || justStarted
      || (approaching && state.startProximity > 0.01)
    );
    startPrompt.visible = state.startReady;
    startRingMaterial.color.setHex(
      state.phase === 'countdown'
        ? 0xdffbff
        : justStarted ? 0x55e88b : state.startZoneInside ? 0xffd45e : 0x58d8ea,
    );
    startRingMaterial.opacity = state.phase === 'countdown'
      ? 0.2
      : justStarted
        ? 0.16
        : state.startReady
          ? 0.16
          : 0.02 + state.startProximity * 0.09;

    const nextCountdownValue = state.phase === 'countdown'
      ? state.countdownSeconds
      : undefined;
    countdownPlane.visible = nextCountdownValue !== undefined;
    if (
      nextCountdownValue !== undefined
      && nextCountdownValue !== countdownValue
    ) {
      countdownValue = nextCountdownValue;
      drawCountdown(countdownCanvas, countdownTexture, nextCountdownValue);
    } else if (nextCountdownValue === undefined) {
      countdownValue = undefined;
    }

    const checkpointsVisible = state.phase === 'running';
    checkpointMarkers.forEach((marker, index) => {
      marker.root.visible = checkpointsVisible;
      const status = state.checkpointStatuses[index] ?? 'pending';
      if (marker.status === status) return;
      marker.status = status;
      const color = checkpointColors[status];
      marker.ringMaterial.color.setHex(color);
      marker.numberMaterial.color.setHex(color);
      marker.ringMaterial.opacity = status === 'pending' ? 0.13 : 0.24;
      marker.numberMaterial.opacity = status === 'pending' ? 0.2 : 0.36;
    });
  };

  return Object.freeze({
    group,
    update,
    dispose: () => {
      options.scene.remove(group);
      startRing.geometry.dispose();
      startRingMaterial.dispose();
      startPromptTexture.dispose();
      startPromptMaterial.dispose();
      countdownPlane.geometry.dispose();
      countdownTexture.dispose();
      countdownMaterial.dispose();
      checkpointMarkers.forEach(marker => {
        marker.root.traverse(object => {
          if (object instanceof THREE.Mesh) object.geometry.dispose();
        });
        marker.ringMaterial.dispose();
        marker.numberMaterial.dispose();
        marker.numberTexture.dispose();
      });
    },
  });
};
