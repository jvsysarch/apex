import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseApexDriveCarSpecification } from '../../packages/apex-car/src/ApexDriveCarSpecification.ts';

const manifest = parseApexDriveCarSpecification(JSON.parse(readFileSync(
  new URL(
    '../../packages/apex-assets/public/assets/vehicles/vertex-arcade/vehicle.json',
    import.meta.url,
  ),
  'utf8',
)));

test('VERTEX-ARCADE reuses the Shelby asset with a distinct identity', () => {
  assert.equal(manifest.id, 'vertex-arcade');
  assert.equal(manifest.name, 'VERTEX-ARCADE');
  assert.equal(manifest.asset.objectId, 'ford-mustang-shelby-gt500');
  assert.equal(manifest.visual.defaultPaintColor, '#020304');
  assert.equal(manifest.dynamics.physicsDefinitionId, 'vertex-arcade');
  assert.equal(manifest.dynamics.massKg, 1325);
});
