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
const hyperManifest = parseApexDriveCarSpecification(JSON.parse(readFileSync(
  new URL(
    '../../packages/apex-assets/public/assets/vehicles/vertex-hyper/vehicle.json',
    import.meta.url,
  ),
  'utf8',
)));
const publicDemoViteConfig = readFileSync(
  new URL('../../apps/apex-demo/vite.config.ts', import.meta.url),
  'utf8',
);

test('VERTEX-ARCADE reuses the Shelby asset with a distinct identity', () => {
  assert.equal(manifest.id, 'vertex-arcade');
  assert.equal(manifest.name, 'VERTEX-ARCADE');
  assert.equal(manifest.asset.objectId, 'ford-mustang-shelby-gt500');
  assert.equal(manifest.visual.defaultPaintColor, '#020304');
  assert.equal(manifest.dynamics.physicsDefinitionId, 'vertex-arcade');
  assert.equal(manifest.dynamics.massKg, 1325);
});

test('VERTEX-HYPER is an orange Shelby with an independent identity', () => {
  assert.equal(hyperManifest.id, 'vertex-hyper');
  assert.equal(hyperManifest.name, 'VERTEX-HYPER');
  assert.equal(hyperManifest.asset.objectId, 'ford-mustang-shelby-gt500');
  assert.equal(hyperManifest.asset.modelUri, manifest.asset.modelUri);
  assert.equal(hyperManifest.visual.defaultPaintColor, '#ff8a00');
  assert.equal(hyperManifest.dynamics.physicsDefinitionId, 'vertex-hyper');
  assert.equal(hyperManifest.dynamics.massKg, 1100);
});

test('the public Time Trial runtime loads both VERTEX arcade cars', () => {
  const bareRuntimeManifestList = publicDemoViteConfig.match(
    /PUBLIC_DEMO_BARE_RUNTIME\s*\?\s*\[(?<manifests>[\s\S]*?)\]\s*:\s*\[/,
  )?.groups?.manifests;

  assert.ok(bareRuntimeManifestList, 'public demo manifest list was not found');
  assert.match(
    bareRuntimeManifestList,
    /assets\/vehicles\/vertex-arcade\/vehicle\.json/,
  );
  assert.match(
    bareRuntimeManifestList,
    /assets\/vehicles\/vertex-hyper\/vehicle\.json/,
  );
});
