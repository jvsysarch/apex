import * as THREE from 'three/webgpu';
import {
  createApexGpuTireDeformationBinding,
  type ApexGpuTireDeformationBinding,
} from './ApexGpuTireDeformationMaterial';

export type ApexTireDeformationBackend = 'cpu' | 'gpu';

export interface ApexTireDeformationSample {
  readonly grounded: boolean;
  readonly verticalLoadN: number;
  readonly longitudinalSlip: number;
  readonly lateralSlipRadians: number;
  readonly pressurePsi: number;
  readonly angularSpeedRadiansPerSecond: number;
  readonly vehicleSpeedMps: number;
  /** Normal del contacto expresada en el espacio local de la rueda. */
  readonly contactNormalLocal?: THREE.Vector3;
  /** Fuerzas reales del contacto, expresadas en el espacio local de la rueda. */
  readonly longitudinalForceLocal?: THREE.Vector3;
  readonly lateralForceLocal?: THREE.Vector3;
}

export interface ApexTireDeformationSnapshot {
  readonly maximumCompression: number;
  readonly maximumCompressionM: number;
  readonly maximumWidthExpansion: number;
  readonly maximumLongitudinalShearM: number;
  readonly maximumLateralShearM: number;
  readonly maximumContactPatchLengthM: number;
  readonly longitudinalShearMByWheel: readonly number[];
  readonly lateralShearMByWheel: readonly number[];
}

interface TireGeometryState {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry>;
  readonly position: THREE.BufferAttribute;
  readonly basePositions: Float32Array;
  readonly contactUp: THREE.Vector3;
  readonly contactTangent: THREE.Vector3;
  readonly gpu?: ApexGpuTireDeformationBinding;
}

const smoothstep01 = (value: number) => {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
};

/**
 * Cubierta visual deformable.
 *
 * La física conserva el cilindro rígido de Jolt. Esta malla sólo representa:
 * - aplastamiento localizado en el parche de contacto;
 * - expansión lateral de la carcasa;
 * - retraso longitudinal y lateral del parche por fuerzas reales Fx/Fy.
 *
 * La normal se transforma al espacio local de la rueda antes de entrar aquí.
 * Por eso el parche permanece contra el suelo mientras la geometría rota.
 */
export class ApexTireDeformationVisual {
  private readonly tires: TireGeometryState[];
  private readonly compressionM: number[];
  private readonly compressionVelocityMps: number[];
  private readonly contactPatchLengthM: number[];
  private readonly widthExpansion: number[];
  private readonly longitudinalShearM: number[];
  private readonly lateralShearM: number[];

  constructor(
    meshes: readonly THREE.Mesh<THREE.BufferGeometry>[],
    private readonly physicalRadiusM: number,
    private readonly outerRadiusM: number,
    private readonly nominalWidthM: number,
    private readonly nominalVerticalLoadN = 3_900,
    private readonly profileDeformationScale = 1,
    private readonly globalDeformationScale = 1,
    private readonly backend: ApexTireDeformationBackend = 'cpu',
  ) {
    this.tires = meshes.map(mesh => {
      const position = mesh.geometry.getAttribute('position');
      if (!(position instanceof THREE.BufferAttribute)) {
        throw new Error('A deformable tire requires a position buffer attribute');
      }
      const tire: TireGeometryState = {
        mesh,
        position,
        basePositions: new Float32Array(position.array),
        contactUp: new THREE.Vector3(1, 0, 0),
        contactTangent: new THREE.Vector3(0, 0, -1),
      };
      return backend === 'gpu'
        ? {
          ...tire,
          gpu: createApexGpuTireDeformationBinding(
            mesh,
            outerRadiusM,
            physicalRadiusM,
            nominalWidthM,
          ),
        }
        : tire;
    });
    this.compressionM = meshes.map(() => 0);
    this.compressionVelocityMps = meshes.map(() => 0);
    this.contactPatchLengthM = meshes.map(() => 0);
    this.widthExpansion = meshes.map(() => 0);
    this.longitudinalShearM = meshes.map(() => 0);
    this.lateralShearM = meshes.map(() => 0);
  }

  update(
    samples: readonly ApexTireDeformationSample[],
    deltaSeconds: number,
  ): ApexTireDeformationSnapshot {
    let maximumCompressionM = 0;
    let maximumWidthExpansion = 0;
    let maximumLongitudinalShearM = 0;
    let maximumLateralShearM = 0;
    let maximumContactPatchLengthM = 0;
    const stableDeltaSeconds = THREE.MathUtils.clamp(deltaSeconds, 0, 0.05);
    const slipResponse = 1 - Math.exp(-Math.max(0, deltaSeconds) * 22);
    const inspectionScale = this.outerRadiusM / 0.34;
    const carcassDeformationScale = (
      this.profileDeformationScale * this.globalDeformationScale
    );
    const shearDeformationScale = (
      this.profileDeformationScale
      * this.profileDeformationScale
      * this.globalDeformationScale
    );

    this.tires.forEach((tire, index) => {
      const sample = samples[index];
      const grounded = sample?.grounded === true;
      this.resolveContactFrame(tire, sample?.contactNormalLocal);
      const loadRatio = grounded
        ? THREE.MathUtils.clamp(
          sample.verticalLoadN / this.nominalVerticalLoadN,
          0,
          2.8,
        )
        : 0;
      const pressurePsi = THREE.MathUtils.clamp(
        sample?.pressurePsi ?? 30,
        8,
        60,
      );
      // Ring model visual: la presión eleva la rigidez de la carcasa y además
      // aporta soporte directo. El resultado alimenta un spring-damper, no un
      // lerp cuadro a cuadro.
      const pressureStiffnessScale = THREE.MathUtils.lerp(
        0.9,
        1.08,
        THREE.MathUtils.clamp((pressurePsi - 18) / 27, 0, 1),
      );
      const ringStiffnessNPerM = 36_000 * pressureStiffnessScale;
      const pressureSupportM = pressurePsi * 0.0008;
      const compressionLimitM = (
        this.outerRadiusM * 0.32 * carcassDeformationScale
      );
      const equilibriumCompressionM = grounded
        ? THREE.MathUtils.clamp(
          (
            sample.verticalLoadN / ringStiffnessNPerM
            - pressureSupportM
          ) * carcassDeformationScale,
          0,
          compressionLimitM,
        )
        : 0;
      const rollingSpeedMps = Math.abs(
        (sample?.angularSpeedRadiansPerSecond ?? 0) * this.physicalRadiusM,
      );
      const naturalFrequencyHz = THREE.MathUtils.lerp(
        4.4,
        6.2,
        THREE.MathUtils.clamp(rollingSpeedMps / 35, 0, 1),
      );
      const angularFrequency = Math.PI * 2 * naturalFrequencyHz;
      const dampingRatio = THREE.MathUtils.lerp(
        0.3,
        0.42,
        THREE.MathUtils.clamp(pressurePsi / 45, 0, 1),
      );
      const substepCount = Math.max(
        1,
        Math.ceil(stableDeltaSeconds / (1 / 120)),
      );
      const substepSeconds = stableDeltaSeconds / substepCount;
      for (let substep = 0; substep < substepCount; substep += 1) {
        const accelerationMps2 = (
          angularFrequency * angularFrequency
            * (equilibriumCompressionM - this.compressionM[index])
          - 2 * dampingRatio * angularFrequency
            * this.compressionVelocityMps[index]
        );
        this.compressionVelocityMps[index] += (
          accelerationMps2 * substepSeconds
        );
        this.compressionM[index] += (
          this.compressionVelocityMps[index] * substepSeconds
        );
        if (this.compressionM[index] <= 0) {
          this.compressionM[index] = 0;
          this.compressionVelocityMps[index] = Math.max(
            0,
            this.compressionVelocityMps[index],
          );
        } else if (this.compressionM[index] >= compressionLimitM) {
          this.compressionM[index] = compressionLimitM;
          this.compressionVelocityMps[index] = Math.min(
            0,
            this.compressionVelocityMps[index],
          );
        }
      }
      this.contactPatchLengthM[index] = 2 * Math.sqrt(Math.max(
        0,
        2 * this.outerRadiusM * this.compressionM[index]
          - this.compressionM[index] * this.compressionM[index],
      ));
      const targetWidthExpansion = grounded
        ? THREE.MathUtils.clamp(
          this.compressionM[index] / this.outerRadiusM * 0.72
            + loadRatio * 0.018 * carcassDeformationScale,
          0,
          0.38,
        )
        : 0;
      // Los ratios de slip de Jolt son indeterminados cerca de velocidad cero.
      // El shear usa fuerzas reales y una compuerta cinemática, de modo que una
      // rueda quieta sólo puede comprimirse: nunca "arrastra" la malla.
      const motionActivation = smoothstep01(
        ((sample?.vehicleSpeedMps ?? 0) - 0.55) / 2.45,
      );
      const longitudinalForceAlongTreadN = (
        sample?.longitudinalForceLocal?.dot(tire.contactTangent) ?? 0
      );
      const lateralForceAlongAxleN = sample?.lateralForceLocal?.y ?? 0;
      const longitudinalForceN = Math.abs(longitudinalForceAlongTreadN) < 160
        ? 0
        : longitudinalForceAlongTreadN;
      const lateralForceN = Math.abs(lateralForceAlongAxleN) < 160
        ? 0
        : lateralForceAlongAxleN;
      const targetLongitudinalShearM = grounded
        ? THREE.MathUtils.clamp(
          -longitudinalForceN / 52_000
            * inspectionScale
            * motionActivation
            * shearDeformationScale,
          -0.14 * inspectionScale * carcassDeformationScale,
          0.14 * inspectionScale * carcassDeformationScale,
        )
        : 0;
      const targetLateralShearM = grounded
        ? THREE.MathUtils.clamp(
          lateralForceN / 46_000
            * inspectionScale
            * motionActivation
            * shearDeformationScale,
          -0.16 * inspectionScale * carcassDeformationScale,
          0.16 * inspectionScale * carcassDeformationScale,
        )
        : 0;

      this.widthExpansion[index] = THREE.MathUtils.lerp(
        this.widthExpansion[index],
        targetWidthExpansion,
        1 - Math.exp(-stableDeltaSeconds * 12),
      );
      this.longitudinalShearM[index] = THREE.MathUtils.lerp(
        this.longitudinalShearM[index],
        targetLongitudinalShearM,
        slipResponse,
      );
      this.lateralShearM[index] = THREE.MathUtils.lerp(
        this.lateralShearM[index],
        targetLateralShearM,
        slipResponse,
      );

      if (this.backend === 'gpu') {
        tire.gpu!.update({
          compressionM: this.compressionM[index],
          widthExpansion: this.widthExpansion[index],
          longitudinalShearM: this.longitudinalShearM[index],
          lateralShearM: this.lateralShearM[index],
          contactPatchLengthM: this.contactPatchLengthM[index],
          contactUp: tire.contactUp,
          contactTangent: tire.contactTangent,
        });
      } else {
        this.deformGeometry(tire, index);
      }

      maximumCompressionM = Math.max(
        maximumCompressionM,
        this.compressionM[index],
      );
      maximumWidthExpansion = Math.max(
        maximumWidthExpansion,
        this.widthExpansion[index],
      );
      maximumLongitudinalShearM = Math.max(
        maximumLongitudinalShearM,
        Math.abs(this.longitudinalShearM[index]),
      );
      maximumLateralShearM = Math.max(
        maximumLateralShearM,
        Math.abs(this.lateralShearM[index]),
      );
      maximumContactPatchLengthM = Math.max(
        maximumContactPatchLengthM,
        this.contactPatchLengthM[index],
      );
    });

    return Object.freeze({
      maximumCompression: maximumCompressionM / this.outerRadiusM,
      maximumCompressionM,
      maximumWidthExpansion,
      maximumLongitudinalShearM,
      maximumLateralShearM,
      maximumContactPatchLengthM,
      longitudinalShearMByWheel: Object.freeze([...this.longitudinalShearM]),
      lateralShearMByWheel: Object.freeze([...this.lateralShearM]),
    });
  }

  private resolveContactFrame(
    tire: TireGeometryState,
    contactNormalLocal: THREE.Vector3 | undefined,
  ): void {
    if (contactNormalLocal && contactNormalLocal.lengthSq() > 1e-6) {
      tire.contactUp.copy(contactNormalLocal);
      // El eje de la cubierta es Y local. Una normal no debe contener ninguna
      // componente axial antes de usarse como dirección radial.
      tire.contactUp.y = 0;
      if (tire.contactUp.lengthSq() > 1e-6) tire.contactUp.normalize();
      else tire.contactUp.set(1, 0, 0);
    } else {
      tire.contactUp.set(1, 0, 0);
    }
    tire.contactTangent.set(
      tire.contactUp.z,
      0,
      -tire.contactUp.x,
    ).normalize();
  }

  private deformGeometry(tire: TireGeometryState, index: number): void {
    const compressionM = this.compressionM[index];
    const widthExpansion = this.widthExpansion[index];
    const longitudinalShearM = this.longitudinalShearM[index];
    const lateralShearM = this.lateralShearM[index];
    const contactPatchLengthM = this.contactPatchLengthM[index];
    const { contactUp, contactTangent, basePositions, position } = tire;
    const halfWidthM = Math.max(0.01, this.nominalWidthM * 0.5);

    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const offset = vertex * 3;
      const baseX = basePositions[offset];
      const baseY = basePositions[offset + 1];
      const baseZ = basePositions[offset + 2];
      const heightAlongNormal = (
        baseX * contactUp.x + baseZ * contactUp.z
      );
      const normalizedBottom = -heightAlongNormal / this.outerRadiusM;
      // La carcasa transmite la carga bastante más arriba que el parche.
      // -0.68 equivale a ~84 % de la altura desde el suelo. La potencia 0.60
      // vuelve perceptible el comienzo sin crear un escalón en el contorno.
      const contactEnvelope = smoothstep01(
        (normalizedBottom + 0.68) / 1.68,
      );
      const contactWeight = contactEnvelope ** 0.60;
      const tangentDistanceM = Math.abs(
        baseX * contactTangent.x + baseZ * contactTangent.z
      );
      const halfPatchLengthM = Math.max(
        this.outerRadiusM * 0.08,
        contactPatchLengthM * 0.5,
      );
      const longitudinalPatchWeight = 1 - smoothstep01(
        (tangentDistanceM - halfPatchLengthM)
          / Math.max(this.outerRadiusM * 0.5, 0.01),
      );
      // Compresión y bulge se propagan por la carcasa; el arrastre Fx/Fy
      // permanece localizado. El pico espacial baja sólo 10 % (1 → 0.90):
      // menos intensidad abajo, pero mejor lectura en media rueda.
      const carcassWeight = contactWeight * (
        0.30 + longitudinalPatchWeight * 0.60
      );
      const shearWeight = (
        contactEnvelope * contactEnvelope * longitudinalPatchWeight
      );
      const sidewallWeight = THREE.MathUtils.clamp(
        Math.abs(baseY) / halfWidthM,
        0,
        1,
      );
      const carcassCompressionM = compressionM * carcassWeight;
      // La deflexión radial ya proviene de Fz, presión y del ring
      // spring-damper. Esta segunda etapa construye el plano de apoyo: dentro
      // de la cuerda de contacto, ningún vértice puede quedar por debajo del
      // asfalto. Un hombro corto suaviza la transición hacia la carcasa curva.
      const contactPlaneHeightM = -this.outerRadiusM + compressionM;
      const planeProjectionM = Math.max(
        0,
        contactPlaneHeightM - heightAlongNormal,
      );
      const flatPatchShoulderM = Math.max(
        this.outerRadiusM * 0.025,
        compressionM * 0.35,
      );
      const flatPatchWeight = 1 - smoothstep01(
        (tangentDistanceM - halfPatchLengthM)
          / flatPatchShoulderM,
      );
      const radialCompression = Math.max(
        carcassCompressionM,
        planeProjectionM * flatPatchWeight,
      );
      const longitudinalShear = longitudinalShearM * shearWeight;
      const lateralShear = lateralShearM * shearWeight;
      const widthScale = 1 + widthExpansion
        * carcassWeight
        * (0.42 + sidewallWeight * 0.58);

      position.setXYZ(
        vertex,
        baseX
          + contactUp.x * radialCompression
          + contactTangent.x * longitudinalShear,
        baseY * widthScale + lateralShear,
        baseZ
          + contactUp.z * radialCompression
          + contactTangent.z * longitudinalShear,
      );
    }

    // La fórmula también admite una cubierta de inspección mayor, pero en el
    // runtime normal ambos radios son iguales. La malla baja lo mismo que se
    // comprime el parche y conserva el borde inferior sobre el contacto físico.
    tire.mesh.position.copy(contactUp).multiplyScalar(
      this.outerRadiusM - this.physicalRadiusM - compressionM,
    );
    position.needsUpdate = true;
    tire.mesh.geometry.computeVertexNormals();
    const normal = tire.mesh.geometry.getAttribute('normal');
    if (normal) normal.needsUpdate = true;
  }
}
