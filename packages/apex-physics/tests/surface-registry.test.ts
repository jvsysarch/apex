import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SURFACE_CATALOG,
  SurfaceRegistry,
} from '../src/surfaces/SurfaceRegistry.ts';

test('the migrated surface catalog preserves the current runtime baseline', () => {
  const registry = new SurfaceRegistry();

  assert.equal(registry.list().length, 6);
  assert.equal(registry.get('asphalt').longitudinalMu, 1.32);
  assert.equal(registry.get('asphalt').lateralMu, 1.32);
  assert.equal(registry.get('wet-asphalt').longitudinalMu, 0.82);
  assert.equal(registry.get('grass').lateralMu, 0.56);
  assert.ok(Object.isFrozen(SURFACE_CATALOG));
  assert.ok(Object.isFrozen(registry.get('asphalt')));
});

test('unknown surfaces fail explicitly', () => {
  const registry = new SurfaceRegistry();

  assert.throws(
    () => registry.get('snow' as never),
    /Unknown surface: snow/,
  );
});
