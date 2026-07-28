import type {
  ApexVehicleState,
} from '@jvsysarch/apex-physics';
import type { TelemetryFrame, WheelId } from './TelemetryFrame';

const WHEEL_IDS: readonly WheelId[] = ['FL', 'FR', 'RL', 'RR'];
const radiansToDegrees = 180 / Math.PI;

/** Transformación pura: recibe valores copiados y no conserva acceso a la física. */
export class ApexTelemetryAdapter {
  readFrame(timestamp: number, state: ApexVehicleState): Readonly<TelemetryFrame> {
    const wheelIds = WHEEL_IDS;
    const wheels = state.wheels.map((wheel, index) => Object.freeze({
      id: wheelIds[index],
      grounded: wheel.grounded,
      slipRatio: wheel.longitudinalSlip,
      slipAngle: wheel.lateralSlipRadians * radiansToDegrees,
      load: Math.max(0, wheel.suspensionImpulse * state.physicsHz),
      angularVelocity: wheel.angularVelocity,
      surface: wheel.surface,
      effectiveSlipRatio: wheel.effectiveLongitudinalSlip,
      effectiveSlipAngle: wheel.effectiveLateralSlipRadians * radiansToDegrees,
      longitudinalCapacityN: wheel.longitudinalCapacityN,
      lateralCapacityN: wheel.lateralCapacityN,
      aligningMomentNm: wheel.aligningMomentNm,
      longitudinalForceN: wheel.longitudinalForceN,
      lateralForceN: wheel.lateralForceN,
      longitudinalSlipVelocityMps: wheel.longitudinalSlipVelocityMps,
      lateralSlipVelocityMps: wheel.lateralSlipVelocityMps,
      longitudinalPowerLossW: wheel.longitudinalPowerLossW,
      lateralPowerLossW: wheel.lateralPowerLossW,
      longitudinalEnergyLossJ: wheel.longitudinalEnergyLossJ,
      lateralEnergyLossJ: wheel.lateralEnergyLossJ,
    }));
    const suspension = state.wheels.map((wheel, index) => Object.freeze({
      wheelId: wheelIds[index],
      length: wheel.suspensionLength,
      compression: wheel.suspensionMaxLength - wheel.suspensionLength,
      velocity: wheel.suspensionVelocity,
    }));

    return Object.freeze({
      timestamp,
      vehicle: Object.freeze({
        speedKmh: state.speedKmh,
        position: state.position,
        rotation: state.rotation,
        yawRate: state.yawRate,
        physicsHz: state.physicsHz,
        configuredTireContactCount: state.configuredTireContactCount,
        evaluatedTireContactCount: state.evaluatedTireContactCount,
        tireModel: state.tireModel,
        tireOperatingParameters: state.tireOperatingParameters,
        tireOperatingGripScale: state.tireOperatingGripScale,
        surfaceMode: state.surfaceMode,
        aerodynamicDragN: state.aerodynamicDragN,
        aerodynamicDownforceN: state.aerodynamicDownforceN,
      }),
      drivetrain: Object.freeze({
        rpm: state.rpm,
        gear: state.gear,
        throttle: state.throttle,
        brake: state.brake,
        requestedEngineTorqueNm: state.requestedEngineTorqueNm,
        deliveredEngineTorqueNm: state.deliveredEngineTorqueNm,
        deliveredAxleTorqueNm: state.deliveredAxleTorqueNm,
        deliveredWheelTorqueNm: state.deliveredWheelTorqueNm,
      }),
      wheels: Object.freeze(wheels),
      suspension: Object.freeze(suspension),
    });
  }
}
