import assert from 'node:assert/strict';
import test from 'node:test';
import * as ApexPhysics from '../src/index.ts';

test('exports the separated physics world and vehicle API', () => {
  assert.equal(typeof ApexPhysics.ApexPhysicsWorld, 'function');
  assert.equal(typeof ApexPhysics.ApexVehicle, 'function');
});

test('does not export concrete vehicle presets or the legacy world', () => {
  const publicApi = ApexPhysics as unknown as Record<string, unknown>;
  assert.equal('ApexVehicleWorld' in publicApi, false);
  assert.equal('APEX_ROAD_CAR_PHYSICS_PROFILE' in publicApi, false);
  assert.equal('APEX_ROAD_CAR' in publicApi, false);
  assert.equal('APEX_MOTORCYCLE' in publicApi, false);
});
