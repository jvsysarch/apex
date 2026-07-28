import {
  APEX_ROAD_CAR,
  type ApexDriveCarSpecification,
} from '@jvsysarch/apex-car';

export interface ApexCarVisualConfiguration {
  readonly targetWidthM: number;
  readonly targetHeightM: number;
  readonly yawDegrees: number;
  readonly defaultPaintColor: string;
  readonly bodyLiftM: number;
  readonly inspectionBodyOpacity: number;
  readonly detectEmbeddedWheelGeometry: boolean;
  readonly tireDeformationScale: number;
}

export interface ApexCarMaterialHints {
  readonly paintPattern: string;
  readonly brakeLightPattern: string;
  readonly hiddenWheelPattern?: string;
}

export interface ApexCarDynamicsConfiguration {
  readonly lateralGripMultiplier: number;
  readonly aerodynamicDownforceMultiplier: number;
}

export interface ApexCarDefinition {
  readonly id: string;
  readonly name: string;
  readonly assetUri: string;
  readonly visual: ApexCarVisualConfiguration;
  readonly materials: ApexCarMaterialHints;
  readonly dynamics: ApexCarDynamicsConfiguration;
  readonly physicsDefinitionId: string;
  readonly vehicleSpecification?: ApexDriveCarSpecification;
}

const DEFAULT_VISUAL_CONFIGURATION: ApexCarVisualConfiguration = Object.freeze({
  targetWidthM: 2,
  targetHeightM: 1.22,
  yawDegrees: 0,
  defaultPaintColor: '#c81422',
  bodyLiftM: 0,
  inspectionBodyOpacity: 1,
  detectEmbeddedWheelGeometry: false,
  tireDeformationScale: 1,
});

const cloneDefaultVisualConfiguration = (): ApexCarVisualConfiguration => (
  Object.freeze({ ...DEFAULT_VISUAL_CONFIGURATION })
);

const BASE_DYNAMICS_CONFIGURATION: ApexCarDynamicsConfiguration = Object.freeze({
  lateralGripMultiplier: 1,
  aerodynamicDownforceMultiplier: 1,
});

const apexCarCatalog: ApexCarDefinition[] = [];

export const APEX_CAR_CATALOG: readonly ApexCarDefinition[] = apexCarCatalog;

export const replaceApexCarCatalog = (
  definitions: readonly ApexCarDefinition[],
): void => {
  apexCarCatalog.splice(0, apexCarCatalog.length, ...definitions);
};

export const findApexCar = (
  id: string | null | undefined,
): ApexCarDefinition | undefined => (
  APEX_CAR_CATALOG.find(candidate => candidate.id === id)
);

export const carFromVehicleSpecification = (
  specification: ApexDriveCarSpecification,
): ApexCarDefinition => {
  if (!specification.asset.modelUrl) {
    throw new Error(
      `El vehículo ${specification.id} no contiene la URL de su revisión visual`,
    );
  }
  return Object.freeze({
    id: specification.id,
    name: specification.name,
    assetUri: specification.asset.modelUrl,
    visual: Object.freeze({
      ...cloneDefaultVisualConfiguration(),
      targetWidthM: specification.dimensions.widthM,
      targetHeightM: specification.dimensions.heightM,
      detectEmbeddedWheelGeometry: true,
    }),
    materials: Object.freeze({
      paintPattern: specification.visual.paintMaterialPattern,
      brakeLightPattern:
        specification.visual.brakeLightMaterialPattern
        ?? 'Brake|Tail|PlasticRed|LightsIllum',
    }),
    dynamics: BASE_DYNAMICS_CONFIGURATION,
    physicsDefinitionId: specification.dynamics.physicsDefinitionId,
    vehicleSpecification: specification,
  });
};
