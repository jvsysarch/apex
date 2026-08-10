import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VERTEX_ARCADE,
  VERTEX_HYPER,
} from '../../packages/apex-car/src/ApexVehicleDefinitions.ts';
import {
  applyApexVertexTuning,
  DEFAULT_APEX_VERTEX_HYPER_TUNING,
  DEFAULT_APEX_VERTEX_TUNING,
  normalizeApexVertexTuning,
} from '../src/vehicle/ApexVertexTuning.ts';

const approximately = (actual: number, expected: number): void => {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
};

test('VERTEX tuning applies every player-facing physics control', () => {
  const definition = applyApexVertexTuning(
    VERTEX_ARCADE,
    DEFAULT_APEX_VERTEX_TUNING,
  );

  assert.equal(definition.engine.maximumTorqueNm, 2100);
  assert.equal(definition.massKg, 1325);
  approximately(definition.wheels.frontBrakeTorqueNm, 11_880);
  approximately(definition.wheels.rearBrakeTorqueNm, 9240);
  assert.equal(definition.wheels.maximumSteerAngleDegrees, 40);
  assert.equal(definition.suspension.tuned.front.antiRollStiffness, 3800);
  assert.equal(definition.suspension.tuned.rear.antiRollStiffness, 3300);
  assert.equal(definition.suspension.tuned.front.damping, 0.78);
  assert.equal(definition.suspension.tuned.rear.damping, 0.76);
  assert.equal(definition.pulseBoost?.maximumBoostRatio, 0.42);
  assert.equal(definition.pulseBoost?.durationSeconds, 1.1);
  assert.equal(definition.pulseBoost?.rechargeSeconds, 4.5);
  assert.equal(definition.arcadeDriveForceN, 14_000);
  approximately(definition.rollStabilityDampingPerSecond ?? 0, 1.76);
  assert.equal(definition.aerodynamics.dynamicsLateralGripCalibration, 1.35);
});

test('VERTEX-HYPER has its own aggressive arcade defaults', () => {
  const definition = applyApexVertexTuning(
    VERTEX_HYPER,
    DEFAULT_APEX_VERTEX_HYPER_TUNING,
  );

  assert.equal(definition.engine.maximumTorqueNm, 4200);
  assert.equal(definition.massKg, 1100);
  assert.equal(definition.wheels.frontBrakeTorqueNm, 22_750);
  assert.equal(definition.wheels.rearBrakeTorqueNm, 18_200);
  assert.equal(definition.arcadeDriveForceN, 35_000);
  assert.equal(definition.pulseBoost?.maximumBoostRatio, 0.8);
  approximately(
    definition.aerodynamics.dynamicsLateralGripCalibration,
    1.8,
  );
});

test('rollover stability lowers the center of mass and pitch-roll limit', () => {
  const unstable = applyApexVertexTuning(VERTEX_ARCADE, normalizeApexVertexTuning({
    rolloverStability: 0,
  }));
  const stable = applyApexVertexTuning(VERTEX_ARCADE, normalizeApexVertexTuning({
    rolloverStability: 1,
  }));

  assert.ok(
    stable.dimensions.centerOfMassOffsetM
      < unstable.dimensions.centerOfMassOffsetM,
  );
  assert.ok(stable.maximumPitchRollDegrees < unstable.maximumPitchRollDegrees);
  approximately(stable.dimensions.centerOfMassOffsetM, 0.11);
  assert.equal(stable.maximumPitchRollDegrees, 25);
  assert.equal(stable.rollStabilityDampingPerSecond, 2.2);
});

test('VERTEX tuning rejects values outside safe slider limits', () => {
  const tuning = normalizeApexVertexTuning({
    torqueNm: 100_000,
    massKg: 1,
    brakeMultiplier: 100,
    gripMultiplier: 5,
    continuousBoostForceN: 1_000_000,
    rolloverStability: -4,
  });

  assert.equal(tuning.torqueNm, 50_000);
  assert.equal(tuning.massKg, 100);
  assert.equal(tuning.brakeMultiplier, 25);
  assert.equal(tuning.gripMultiplier, 4);
  assert.equal(tuning.continuousBoostForceN, 500_000);
  assert.equal(tuning.rolloverStability, 0);
});
