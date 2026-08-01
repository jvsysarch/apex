import type { ApexVehicleState } from '@jvsysarch/apex-physics';
import type { LapTimingState } from '../../race/ApexLapTimer';
import type {
  ApexHudDataDemand,
  ApexHudMotionSnapshot,
  ApexHudNavigationSnapshot,
  ApexHudRaceSnapshot,
  ApexHudSessionInput,
  ApexHudSessionSnapshot,
  ApexHudVehicleSnapshot,
  ApexHudWheelId,
} from './ApexHudContract';
import { ApexHudStore } from './ApexHudStore';

const wheelIds: readonly ApexHudWheelId[] = ['FL', 'FR', 'RL', 'RR'];
const radiansToDegrees = 180 / Math.PI;

const roundTo = (value: number, precision: number): number => (
  Math.round(value / precision) * precision
);

const gearLabel = (gear: number): string => (
  gear < 0 ? 'R' : gear === 0 ? 'N' : String(gear)
);

const yawFromQuaternion = (
  rotation: ApexVehicleState['rotation'],
): number => {
  const [x, y, z, w] = rotation;
  return Math.atan2(
    2 * (w * y + x * z),
    1 - 2 * (y * y + z * z),
  );
};

export interface ApexHudAdapterOptions {
  readonly motionHz?: number;
  readonly statusHz?: number;
}

export class ApexHudAdapter {
  private readonly motionIntervalMs: number;
  private readonly statusIntervalMs: number;
  private nextMotionAtMs = 0;
  private nextNavigationAtMs = 0;
  private nextVehicleAtMs = 0;
  private nextRaceAtMs = 0;
  private raceEventSignature = '';
  private maximumSteerAngleDegrees = 0;
  private demand: ApexHudDataDemand = {
    motion: false,
    navigation: false,
    vehicle: false,
    race: false,
  };

  constructor(
    private readonly store: ApexHudStore,
    options: ApexHudAdapterOptions = {},
  ) {
    this.motionIntervalMs = 1000 / (options.motionHz ?? 20);
    this.statusIntervalMs = 1000 / (options.statusHz ?? 5);
  }

  publishSession(input: ApexHudSessionInput): void {
    this.maximumSteerAngleDegrees = input.maximumSteerAngleDegrees;
    const snapshot: ApexHudSessionSnapshot = Object.freeze({
      ...input,
      trackPoints: Object.freeze(input.trackPoints.map(point => Object.freeze({
        x: point.x,
        z: point.z,
      }))),
    });
    this.store.publish(
      'session',
      snapshot,
      [
        input.trackIdentity,
        input.vehicleName,
        input.maximumRpm,
        input.maximumSteerAngleDegrees,
        input.trackPoints.length,
      ].join('|'),
    );
  }

  configure(demand: ApexHudDataDemand): void {
    const previous = this.demand;
    this.demand = Object.freeze({ ...demand });
    if (!demand.motion) this.store.clear('motion');
    else if (!previous.motion) this.nextMotionAtMs = 0;
    if (!demand.navigation) this.store.clear('navigation');
    else if (!previous.navigation) this.nextNavigationAtMs = 0;
    if (!demand.vehicle) this.store.clear('vehicle');
    else if (!previous.vehicle) this.nextVehicleAtMs = 0;
    if (!demand.race) {
      this.store.clear('race');
      this.raceEventSignature = '';
    } else if (!previous.race) {
      this.nextRaceAtMs = 0;
    }
  }

  needsPhysicsSnapshot(timestampMs: number): boolean {
    return (
      (this.demand.motion && timestampMs >= this.nextMotionAtMs)
      || (
        this.demand.navigation && timestampMs >= this.nextNavigationAtMs
      )
      || (this.demand.vehicle && timestampMs >= this.nextVehicleAtMs)
    );
  }

  needsRaceSnapshot(): boolean {
    return this.demand.race;
  }

  publishPhysics(timestampMs: number, state: ApexVehicleState): void {
    if (this.demand.motion && timestampMs >= this.nextMotionAtMs) {
      this.nextMotionAtMs = timestampMs + this.motionIntervalMs;
      const motion: ApexHudMotionSnapshot = Object.freeze({
        sampledAtMs: timestampMs,
        speedKmh: roundTo(Math.abs(state.speedKmh), 0.5),
        rpm: roundTo(state.rpm, 25),
        gear: gearLabel(state.gear),
        throttle: roundTo(state.throttle, 0.01),
        brake: roundTo(state.brake, 0.01),
        steering: roundTo(
          state.steering * this.maximumSteerAngleDegrees,
          0.1,
        ),
      });
      this.store.publish(
        'motion',
        motion,
        [
          motion.speedKmh,
          motion.rpm,
          motion.gear,
          motion.throttle,
          motion.brake,
          motion.steering,
        ].join('|'),
      );
    }

    if (
      this.demand.navigation
      && timestampMs >= this.nextNavigationAtMs
    ) {
      this.nextNavigationAtMs = timestampMs + this.statusIntervalMs;
      const navigation: ApexHudNavigationSnapshot = Object.freeze({
        sampledAtMs: timestampMs,
        positionX: roundTo(state.position[0], 0.05),
        positionZ: roundTo(state.position[2], 0.05),
        headingRadians: roundTo(yawFromQuaternion(state.rotation), 0.005),
      });
      this.store.publish(
        'navigation',
        navigation,
        [
          navigation.positionX,
          navigation.positionZ,
          navigation.headingRadians,
        ].join('|'),
      );
    }

    if (!this.demand.vehicle || timestampMs < this.nextVehicleAtMs) return;
    this.nextVehicleAtMs = timestampMs + this.statusIntervalMs;
    const vehicle: ApexHudVehicleSnapshot = Object.freeze({
      sampledAtMs: timestampMs,
      wheels: Object.freeze(state.wheels.map((wheel, index) => Object.freeze({
        id: wheelIds[index] ?? 'FL',
        grounded: wheel.grounded,
        slipRatioPercent: roundTo(Math.abs(wheel.longitudinalSlip) * 100, 0.1),
        slipAngleDegrees: roundTo(
          Math.abs(wheel.lateralSlipRadians) * radiansToDegrees,
          0.1,
        ),
        loadKn: roundTo(
          Math.max(0, wheel.suspensionImpulse * state.physicsHz) / 1000,
          0.1,
        ),
        compression: roundTo(Math.min(1, Math.max(
          0,
          1 - wheel.suspensionLength / Math.max(
            0.001,
            wheel.suspensionMaxLength,
          ),
        )), 0.01),
        steeringAngleDegrees: index < 2
          ? roundTo(state.steering * this.maximumSteerAngleDegrees, 0.1)
          : 0,
        surface: wheel.surface,
      }))),
    });
    this.store.publish(
      'vehicle',
      vehicle,
      vehicle.wheels.map(wheel => [
        wheel.id,
        wheel.grounded ? 1 : 0,
        wheel.slipRatioPercent,
        wheel.slipAngleDegrees,
        wheel.loadKn,
        wheel.compression,
        wheel.steeringAngleDegrees,
        wheel.surface,
      ].join(':')).join('|'),
    );
  }

  publishRace(timestampMs: number, state: LapTimingState): void {
    if (!this.demand.race) return;
    const eventSignature = [
      state.phase,
      state.hudVisibility,
      state.completedLapCount,
      state.checkpointIndex,
      state.sectorIndex,
      state.countdownSeconds ?? '',
      state.startLights,
      state.startReady ? 1 : 0,
    ].join('|');
    const eventChanged = eventSignature !== this.raceEventSignature;
    if (!eventChanged && timestampMs < this.nextRaceAtMs) return;
    this.raceEventSignature = eventSignature;
    this.nextRaceAtMs = timestampMs + this.statusIntervalMs;

    const race: ApexHudRaceSnapshot = Object.freeze({
      sampledAtMs: timestampMs,
      phase: state.phase,
      hudVisibility: state.hudVisibility,
      elapsedMs: Math.max(0, state.elapsedMs),
      lapNumber: state.lapNumber,
      completedLapCount: state.completedLapCount,
      bestLapMs: state.bestLapMs,
      lastLapMs: state.lastLapMs,
      lapDeltaMs: state.lapDeltaMs,
      checkpointIndex: state.checkpointIndex,
      checkpointCount: state.checkpointCount,
      checkpointStatuses: Object.freeze([...state.checkpointStatuses]),
      sectorIndex: state.sectorIndex,
      sectorCount: state.sectorCount,
      countdownSeconds: state.countdownSeconds,
      startLights: state.startLights,
      startProximity: roundTo(state.startProximity, 0.02),
      startReady: state.startReady,
      message: state.message,
    });
    this.store.publish(
      'race',
      race,
      [
        eventSignature,
        Math.floor(race.elapsedMs / this.statusIntervalMs),
        race.bestLapMs ?? '',
        race.lastLapMs ?? '',
        race.lapDeltaMs === undefined ? '' : roundTo(race.lapDeltaMs, 10),
        race.startProximity,
        race.message,
      ].join('|'),
    );
  }
}
