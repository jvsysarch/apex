import {
  type ApexCarPhysicsDefinition,
} from '@jvsysarch/apex-physics';
import { APEX_VEHICLE_DEFINITIONS } from '@jvsysarch/apex-car';
import type { ApexCarDefinition } from './ApexCarCatalog';

/**
 * Adapts an authored vehicle manifest to the physics contract used by Drive.
 * Physics defaults remain authoritative when the visual catalog has no
 * authored specification.
 */
export const createApexCarPhysicsDefinition = (
  definition: ApexCarDefinition,
): ApexCarPhysicsDefinition => {
  const physicsDefinition = APEX_VEHICLE_DEFINITIONS.get(
    definition.physicsDefinitionId,
  );
  if (!physicsDefinition || physicsDefinition.kind !== 'car') {
    throw new Error(
      `No existe la definición física de automóvil ${definition.physicsDefinitionId}`,
    );
  }
  const specification = definition.vehicleSpecification;
  if (!specification) return physicsDefinition;

  const frontLeft = specification.wheels['front-left'];
  const frontRight = specification.wheels['front-right'];
  const rearLeft = specification.wheels['rear-left'];
  const rearRight = specification.wheels['rear-right'];
  const frontAxleZ = (frontLeft.positionM[2] + frontRight.positionM[2]) * 0.5;
  const rearAxleZ = (rearLeft.positionM[2] + rearRight.positionM[2]) * 0.5;
  const physicalWheels = [frontLeft, frontRight, rearLeft, rearRight];
  const collision = specification.collision.chassisBox;

  return Object.freeze({
    ...physicsDefinition,
    id: `${physicsDefinition.id}:${specification.id}@${specification.version}`,
    dimensions: Object.freeze({
      ...physicsDefinition.dimensions,
      lengthM: specification.dimensions.lengthM,
      widthM: specification.dimensions.widthM,
      chassisHeightM: collision.heightM,
      wheelbaseM: frontAxleZ - rearAxleZ,
      frontTrackM: Math.abs(
        frontRight.positionM[0] - frontLeft.positionM[0],
      ),
      rearTrackM: Math.abs(
        rearRight.positionM[0] - rearLeft.positionM[0],
      ),
      axleCenterOffsetM: (frontAxleZ + rearAxleZ) * 0.5,
      wheelRadiusM: physicalWheels.reduce(
        (total, wheel) => total + wheel.radiusM,
        0,
      ) / physicalWheels.length,
      wheelWidthM: physicalWheels.reduce(
        (total, wheel) => total + wheel.widthM,
        0,
      ) / physicalWheels.length,
      centerOfMassOffsetM: specification.dynamics.centerOfMassM[1],
    }),
    chassisBox: Object.freeze({
      lengthM: collision.lengthM,
      widthM: collision.widthM,
      frontWidthM: collision.frontWidthM,
      rearWidthM: collision.rearWidthM,
      heightM: collision.heightM,
      centerOffsetYM:
        collision.centerM[1] - specification.dynamics.centerOfMassM[1],
    }),
    massKg: specification.dynamics.massKg,
  });
};
