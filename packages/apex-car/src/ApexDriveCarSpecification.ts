export const APEX_DRIVE_CAR_FORMAT = 'apex-drive-car@1' as const;

export type ApexVector3Tuple = readonly [number, number, number];
export type ApexDriveWheelId =
  | 'front-left'
  | 'front-right'
  | 'rear-left'
  | 'rear-right';

export interface ApexVoidAssetRevisionReference {
  readonly domain: 'assets';
  readonly objectId: string;
  readonly revision: string;
  /**
   * Resolved URL for this exact immutable revision. The domain/object/revision
   * tuple remains authoritative; this URL is a runtime hint for web clients.
   */
  readonly modelUrl?: string;
}

export interface ApexDriveWheelAnchor {
  readonly positionM: ApexVector3Tuple;
  readonly radiusM: number;
  readonly widthM: number;
  readonly visualNode?: string;
  readonly visualNodeId?: string;
}

export interface ApexDriveCarSpecification {
  readonly format: typeof APEX_DRIVE_CAR_FORMAT;
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly asset: ApexVoidAssetRevisionReference;
  readonly coordinateSystem: {
    readonly units: 'meters';
    readonly upAxis: 'Y';
    readonly forwardAxis: 'Z';
  };
  readonly visual: {
    readonly bodyRootNode: string;
    readonly bodyRootNodeId?: string;
    readonly paintMaterialPattern: string;
    readonly brakeLightMaterialPattern?: string;
    readonly defaultPaintColor?: string;
  };
  readonly dimensions: {
    readonly lengthM: number;
    readonly widthM: number;
    readonly heightM: number;
  };
  readonly wheels: Readonly<Record<ApexDriveWheelId, ApexDriveWheelAnchor>>;
  readonly collision: {
    readonly chassisBox: {
      readonly lengthM: number;
      readonly widthM: number;
      readonly frontWidthM: number;
      readonly rearWidthM: number;
      readonly heightM: number;
      readonly centerM: ApexVector3Tuple;
    };
  };
  readonly dynamics: {
    readonly physicsDefinitionId: string;
    readonly massKg: number;
    readonly centerOfMassM: ApexVector3Tuple;
  };
  readonly cameras?: {
    readonly interior?: ApexVector3Tuple;
    readonly chaseTarget?: ApexVector3Tuple;
  };
}

export interface ApexDriveCarValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

const CAR_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,79}$/;
const REVISION_PATTERN = /^[a-z0-9][a-z0-9.-]{7,79}$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/;
const WHEEL_IDS: readonly ApexDriveWheelId[] = Object.freeze([
  'front-left',
  'front-right',
  'rear-left',
  'rear-right',
]);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const finite = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const vector3 = (value: unknown): value is ApexVector3Tuple => (
  Array.isArray(value)
  && value.length === 3
  && value.every(finite)
);

export function validateApexDriveCarSpecification(
  value: unknown,
): readonly ApexDriveCarValidationIssue[] {
  const issues: ApexDriveCarValidationIssue[] = [];
  const issue = (path: string, code: string, message: string) => {
    issues.push(Object.freeze({ path, code, message }));
  };
  const boundedNumber = (
    candidate: unknown,
    path: string,
    minimum: number,
    maximum: number,
  ): candidate is number => {
    if (!finite(candidate) || candidate < minimum || candidate > maximum) {
      issue(
        path,
        'out-of-range',
        `Debe ser un número entre ${minimum} y ${maximum}`,
      );
      return false;
    }
    return true;
  };
  const requiredText = (
    candidate: unknown,
    path: string,
    maximumLength = 160,
  ): candidate is string => {
    if (
      typeof candidate !== 'string'
      || !candidate.trim()
      || candidate.length > maximumLength
    ) {
      issue(path, 'invalid-text', 'Debe contener texto válido');
      return false;
    }
    return true;
  };

  if (!isRecord(value)) {
    return Object.freeze([Object.freeze({
      path: '$',
      code: 'invalid-document',
      message: 'La especificación debe ser un objeto',
    })]);
  }
  if (value.format !== APEX_DRIVE_CAR_FORMAT) {
    issue('format', 'unsupported-format', `Se esperaba ${APEX_DRIVE_CAR_FORMAT}`);
  }
  if (typeof value.id !== 'string' || !CAR_ID_PATTERN.test(value.id)) {
    issue('id', 'invalid-id', 'Debe ser un ID normalizado');
  }
  if (typeof value.version !== 'string' || !SEMVER_PATTERN.test(value.version)) {
    issue('version', 'invalid-version', 'Debe usar una versión semántica');
  }
  requiredText(value.name, 'name', 120);

  if (!isRecord(value.asset)) {
    issue('asset', 'missing-asset', 'Debe referenciar una revisión de asset');
  } else {
    if (value.asset.domain !== 'assets') {
      issue('asset.domain', 'invalid-domain', 'El dominio debe ser assets');
    }
    if (
      typeof value.asset.objectId !== 'string'
      || !CAR_ID_PATTERN.test(value.asset.objectId)
    ) {
      issue('asset.objectId', 'invalid-object-id', 'objectId inválido');
    }
    if (
      typeof value.asset.revision !== 'string'
      || !REVISION_PATTERN.test(value.asset.revision)
    ) {
      issue('asset.revision', 'invalid-revision', 'Revisión de asset inválida');
    }
    if (
      value.asset.modelUrl !== undefined
      && typeof value.asset.modelUrl !== 'string'
    ) {
      issue('asset.modelUrl', 'invalid-url', 'modelUrl debe ser texto');
    }
  }

  if (
    !isRecord(value.coordinateSystem)
    || value.coordinateSystem.units !== 'meters'
    || value.coordinateSystem.upAxis !== 'Y'
    || value.coordinateSystem.forwardAxis !== 'Z'
  ) {
    issue(
      'coordinateSystem',
      'invalid-coordinate-system',
      'Debe usar metros, Y arriba y Z hacia adelante',
    );
  }

  if (!isRecord(value.visual)) {
    issue('visual', 'missing-visual', 'Falta la configuración visual');
  } else {
    requiredText(value.visual.bodyRootNode, 'visual.bodyRootNode');
    if (
      value.visual.bodyRootNodeId !== undefined
      && typeof value.visual.bodyRootNodeId !== 'string'
    ) {
      issue(
        'visual.bodyRootNodeId',
        'invalid-node-id',
        'El ID del nodo debe ser texto',
      );
    }
    requiredText(
      value.visual.paintMaterialPattern,
      'visual.paintMaterialPattern',
    );
    if (
      value.visual.brakeLightMaterialPattern !== undefined
      && typeof value.visual.brakeLightMaterialPattern !== 'string'
    ) {
      issue(
        'visual.brakeLightMaterialPattern',
        'invalid-pattern',
        'El patrón debe ser texto',
      );
    }
    if (
      value.visual.defaultPaintColor !== undefined
      && (
        typeof value.visual.defaultPaintColor !== 'string'
        || !/^#[0-9a-f]{6}$/i.test(value.visual.defaultPaintColor)
      )
    ) {
      issue(
        'visual.defaultPaintColor',
        'invalid-color',
        'El color debe usar el formato hexadecimal #RRGGBB',
      );
    }
  }

  if (!isRecord(value.dimensions)) {
    issue('dimensions', 'missing-dimensions', 'Faltan dimensiones exteriores');
  } else {
    boundedNumber(value.dimensions.lengthM, 'dimensions.lengthM', 1.5, 8);
    boundedNumber(value.dimensions.widthM, 'dimensions.widthM', 0.8, 3);
    boundedNumber(value.dimensions.heightM, 'dimensions.heightM', 0.5, 3);
  }

  const validatedWheelPositions = new Map<ApexDriveWheelId, ApexVector3Tuple>();
  if (!isRecord(value.wheels)) {
    issue('wheels', 'missing-wheels', 'Deben definirse cuatro ruedas');
  } else {
    for (const wheelId of WHEEL_IDS) {
      const wheel = value.wheels[wheelId];
      const path = `wheels.${wheelId}`;
      if (!isRecord(wheel)) {
        issue(path, 'missing-wheel', `Falta ${wheelId}`);
        continue;
      }
      if (!vector3(wheel.positionM)) {
        issue(`${path}.positionM`, 'invalid-vector', 'Debe ser un vector XYZ');
      } else {
        validatedWheelPositions.set(wheelId, wheel.positionM);
      }
      boundedNumber(wheel.radiusM, `${path}.radiusM`, 0.1, 1);
      boundedNumber(wheel.widthM, `${path}.widthM`, 0.05, 0.8);
      if (
        wheel.visualNode !== undefined
        && typeof wheel.visualNode !== 'string'
      ) {
        issue(`${path}.visualNode`, 'invalid-node', 'Debe ser un nombre de nodo');
      }
      if (
        wheel.visualNodeId !== undefined
        && typeof wheel.visualNodeId !== 'string'
      ) {
        issue(
          `${path}.visualNodeId`,
          'invalid-node-id',
          'El ID del nodo debe ser texto',
        );
      }
    }
  }
  const frontLeft = validatedWheelPositions.get('front-left');
  const frontRight = validatedWheelPositions.get('front-right');
  const rearLeft = validatedWheelPositions.get('rear-left');
  const rearRight = validatedWheelPositions.get('rear-right');
  if (frontLeft && frontRight && frontLeft[0] <= frontRight[0]) {
    issue(
      'wheels.front',
      'invalid-left-right',
      'Eje delantero invertido: izquierda debe estar en +X y derecha en −X',
    );
  }
  if (rearLeft && rearRight && rearLeft[0] <= rearRight[0]) {
    issue(
      'wheels.rear',
      'invalid-left-right',
      'Eje trasero invertido: izquierda debe estar en +X y derecha en −X',
    );
  }
  if (
    frontLeft
    && frontRight
    && rearLeft
    && rearRight
    && (frontLeft[2] + frontRight[2]) <= (rearLeft[2] + rearRight[2])
  ) {
    issue('wheels', 'invalid-axles', 'El eje delantero debe estar hacia +Z');
  }

  if (!isRecord(value.collision) || !isRecord(value.collision.chassisBox)) {
    issue('collision.chassisBox', 'missing-collision', 'Falta la caja de colisión');
  } else {
    const box = value.collision.chassisBox;
    boundedNumber(box.lengthM, 'collision.chassisBox.lengthM', 0.5, 8);
    boundedNumber(box.widthM, 'collision.chassisBox.widthM', 0.3, 3);
    boundedNumber(box.frontWidthM, 'collision.chassisBox.frontWidthM', 0.2, 3);
    boundedNumber(box.rearWidthM, 'collision.chassisBox.rearWidthM', 0.2, 3);
    boundedNumber(box.heightM, 'collision.chassisBox.heightM', 0.2, 3);
    if (!vector3(box.centerM)) {
      issue(
        'collision.chassisBox.centerM',
        'invalid-vector',
        'Debe ser un vector XYZ',
      );
    }
  }

  if (!isRecord(value.dynamics)) {
    issue('dynamics', 'missing-dynamics', 'Falta la configuración dinámica');
  } else {
    requiredText(
      value.dynamics.physicsDefinitionId,
      'dynamics.physicsDefinitionId',
      80,
    );
    boundedNumber(value.dynamics.massKg, 'dynamics.massKg', 100, 5_000);
    if (!vector3(value.dynamics.centerOfMassM)) {
      issue(
        'dynamics.centerOfMassM',
        'invalid-vector',
        'Debe ser un vector XYZ',
      );
    }
  }

  if (value.cameras !== undefined) {
    if (!isRecord(value.cameras)) {
      issue('cameras', 'invalid-cameras', 'Debe ser un objeto');
    } else {
      if (
        value.cameras.interior !== undefined
        && !vector3(value.cameras.interior)
      ) {
        issue('cameras.interior', 'invalid-vector', 'Debe ser un vector XYZ');
      }
      if (
        value.cameras.chaseTarget !== undefined
        && !vector3(value.cameras.chaseTarget)
      ) {
        issue('cameras.chaseTarget', 'invalid-vector', 'Debe ser un vector XYZ');
      }
    }
  }
  return Object.freeze(issues);
}

export function parseApexDriveCarSpecification(
  value: unknown,
): ApexDriveCarSpecification {
  const issues = validateApexDriveCarSpecification(value);
  if (issues.length > 0) {
    throw new Error(
      `Auto APEX Drive inválido: ${issues.map(issue => (
        `${issue.path}: ${issue.message}`
      )).join('; ')}`,
    );
  }
  return value as unknown as ApexDriveCarSpecification;
}
