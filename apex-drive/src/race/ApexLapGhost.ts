import * as THREE from 'three/webgpu';
import type { VehiclePose } from '../rendering/ApexVehiclePoseAdapter';

interface GhostFrame {
  readonly elapsedMs: number;
  readonly position: THREE.Vector3;
  readonly rotation: THREE.Quaternion;
}

const SAMPLE_INTERVAL_MS = 70;

export class ApexLapGhost {
  readonly object = new THREE.Group();
  private readonly body = new THREE.Group();
  private ghostMaterial?: THREE.MeshBasicMaterial;
  private hasVehicleVisual = false;
  private recording: GhostFrame[] = [];
  private previousLap: readonly GhostFrame[] = [];
  private lastRecordedAtMs = Number.NEGATIVE_INFINITY;

  constructor(scene: THREE.Scene) {
    this.object.name = 'apex-lap-ghost';
    this.object.visible = false;
    this.object.renderOrder = 12;
    this.object.add(this.body);
    scene.add(this.object);
  }

  setVehicleVisual(source: THREE.Object3D): void {
    this.object.visible = false;
    this.body.clear();
    this.ghostMaterial?.dispose();
    this.ghostMaterial = new THREE.MeshBasicMaterial({
      color: 0x269dff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const presentation = source.clone(true);
    presentation.name = 'apex-lap-ghost-vehicle';
    presentation.traverse(object => {
      if (object instanceof THREE.Light) {
        object.visible = false;
        return;
      }
      if (!(object instanceof THREE.Mesh)) return;
      object.material = this.ghostMaterial!;
      object.castShadow = false;
      object.receiveShadow = false;
      object.frustumCulled = false;
      object.renderOrder = 12;
    });
    this.body.add(presentation);
    this.hasVehicleVisual = true;
  }

  get hasPreviousLap(): boolean {
    return this.previousLap.length >= 2;
  }

  beginLap(): void {
    this.recording = [];
    this.lastRecordedAtMs = Number.NEGATIVE_INFINITY;
  }

  clear(): void {
    this.beginLap();
    this.previousLap = [];
    this.object.visible = false;
  }

  record(pose: VehiclePose, elapsedMs: number): void {
    if (
      pose.vehicleKind !== 'car'
      || pose.wheelPositions.length < 4
      || pose.wheelRotations.length < 4
    ) {
      return;
    }
    if (elapsedMs - this.lastRecordedAtMs < SAMPLE_INTERVAL_MS) return;
    this.lastRecordedAtMs = elapsedMs;
    this.recording.push(Object.freeze({
      elapsedMs,
      position: pose.position.clone(),
      rotation: pose.rotation.clone(),
    }));
  }

  completeLap(): boolean {
    if (this.recording.length < 12) {
      this.beginLap();
      return false;
    }
    this.previousLap = Object.freeze([...this.recording]);
    this.beginLap();
    return true;
  }

  update(elapsedMs: number): void {
    if (!this.hasVehicleVisual || this.previousLap.length < 2) {
      this.object.visible = false;
      return;
    }
    const finalFrame = this.previousLap[this.previousLap.length - 1];
    if (elapsedMs > finalFrame.elapsedMs + 1200) {
      this.object.visible = false;
      return;
    }
    this.object.visible = true;
    let lowerSearchIndex = 0;
    let upperSearchIndex = this.previousLap.length - 1;
    while (lowerSearchIndex < upperSearchIndex) {
      const middleIndex = Math.floor(
        (lowerSearchIndex + upperSearchIndex) * 0.5,
      );
      if (this.previousLap[middleIndex].elapsedMs < elapsedMs) {
        lowerSearchIndex = middleIndex + 1;
      } else {
        upperSearchIndex = middleIndex;
      }
    }
    const upperIndex = lowerSearchIndex;
    const lowerIndex = Math.max(0, upperIndex - 1);
    const lower = this.previousLap[lowerIndex];
    const upper = this.previousLap[upperIndex];
    const intervalMs = Math.max(1, upper.elapsedMs - lower.elapsedMs);
    const blend = THREE.MathUtils.clamp(
      (elapsedMs - lower.elapsedMs) / intervalMs,
      0,
      1,
    );
    this.body.position.lerpVectors(lower.position, upper.position, blend);
    this.body.quaternion.slerpQuaternions(
      lower.rotation,
      upper.rotation,
      blend,
    );
  }
}
