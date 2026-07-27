import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
);
const runtimePath = resolve(
  packageDirectory,
  'native',
  'dist',
  'apex-physics.js',
);
const wasmPath = resolve(
  packageDirectory,
  'native',
  'dist',
  'apex-physics.wasm',
);

test('the built WASM runtime exposes the compiled Apex tire bridge', async () => {
  assert.ok(
    existsSync(runtimePath),
    'Missing native/dist/apex-physics.js; rebuild the native runtime first.',
  );
  assert.ok(
    existsSync(wasmPath),
    'Missing native/dist/apex-physics.wasm; rebuild the native runtime first.',
  );

  const runtimeModule = await import(pathToFileURL(runtimePath).href);
  assert.equal(typeof runtimeModule.default, 'function');

  const Jolt = await runtimeModule.default({
    locateFile: (file: string) => (
      file.endsWith('.wasm') ? wasmPath : file
    ),
  });

  assert.equal(typeof Jolt.ApexTireForceBridge, 'function');

  const bridge = new Jolt.ApexTireForceBridge();
  assert.ok(bridge);
  Jolt.destroy(bridge);
});
