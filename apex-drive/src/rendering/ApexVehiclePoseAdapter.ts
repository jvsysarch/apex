import * as THREE from 'three/webgpu';
import type {
  ApexVehiclePoseSnapshot,
} from '@jvsysarch/apex-physics';
import type { SurfaceId } from '@jvsysarch/apex-physics';

export interface VehiclePose {
  readonly vehicleKind: ApexVehiclePoseSnapshot['vehicleKind'];
  readonly position: THREE.Vector3;
  readonly rotation: THREE.Quaternion;
  readonly wheelPositions: readonly THREE.Vector3[];
  readonly wheelRotations: readonly THREE.Quaternion[];
  readonly wheelContactErrorsM: readonly number[];
  readonly wheelGrounded: readonly boolean[];
  readonly wheelContactPositions: readonly THREE.Vector3[];
  readonly wheelContactNormals: readonly THREE.Vector3[];
  readonly wheelContactLongitudinals: readonly THREE.Vector3[];
  readonly wheelContactLaterals: readonly THREE.Vector3[];
  readonly wheelVerticalLoadsN: readonly number[];
  readonly wheelSuspensionLengthsM: readonly number[];
  readonly wheelAngularVelocitiesRadiansPerSecond: readonly number[];
  readonly wheelLongitudinalSlips: readonly number[];
  readonly wheelLateralSlipRadians: readonly number[];
  readonly wheelLongitudinalForcesN: readonly number[];
  readonly wheelLateralForcesN: readonly number[];
  readonly wheelSurfaces: readonly SurfaceId[];
  readonly tirePressurePsi: number;
  readonly speedKmh: number;
  readonly rpm: number;
  readonly gear: number;
  readonly throttle: number;
  readonly brake: number;
  readonly steering: number;
  readonly liftOffFrontAeroBlend: number;
  readonly liftOffFrontDownforceN: number;
}

/**
 * Convierte el snapshot numérico de APEX Physics al modelo matemático de Three
 * que consumen render, cámara, ghost y herramientas visuales.
 */
export const adaptApexVehiclePose = (
  snapshot: ApexVehiclePoseSnapshot,
): VehiclePose => Object.freeze({
  ...snapshot,
  position: new THREE.Vector3(...snapshot.position),
  rotation: new THREE.Quaternion(...snapshot.rotation),
  wheelPositions: Object.freeze(
    snapshot.wheelPositions.map(position => new THREE.Vector3(...position)),
  ),
  wheelRotations: Object.freeze(
    snapshot.wheelRotations.map(rotation => new THREE.Quaternion(...rotation)),
  ),
  wheelContactPositions: Object.freeze(
    snapshot.wheelContactPositions.map(
      position => new THREE.Vector3(...position),
    ),
  ),
  wheelContactNormals: Object.freeze(
    snapshot.wheelContactNormals.map(normal => new THREE.Vector3(...normal)),
  ),
  wheelContactLongitudinals: Object.freeze(
    snapshot.wheelContactLongitudinals.map(
      direction => new THREE.Vector3(...direction),
    ),
  ),
  wheelContactLaterals: Object.freeze(
    snapshot.wheelContactLaterals.map(
      direction => new THREE.Vector3(...direction),
    ),
  ),
});
