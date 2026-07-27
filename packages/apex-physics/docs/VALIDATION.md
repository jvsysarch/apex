# Public release validation

This document separates checks already observed from checks required before a
public release or tag.

## Observed baseline

- [x] Apex Drive imports `@jvsysarch/apex-physics` from the pnpm workspace.
- [x] Apex Drive compiled and ran successfully on 2026-07-26.
- [x] The browser host initialized the local Apex JS/WASM runtime.
- [x] The package has an isolated TypeScript check.
- [x] Initial surface-registry tests exist.
- [x] Jolt and JoltPhysics.js provenance and MIT notices are recorded.

## Required before the first public tag

- [ ] Rebuild `apex-physics.js` and `apex-physics.wasm` from the documented
      native toolchain.
- [ ] Run the package TypeScript check from a clean checkout.
- [ ] Run all package tests, including the real WASM bridge smoke test, from a
      clean checkout.
- [ ] Confirm the rebuilt artifacts initialize in a browser host.
- [ ] Run the Apex Drive integration baseline.
- [ ] Confirm default runtime telemetry reports 360 Hz,
      `apex-tmeasy-v1`, compiled execution and eight numerical subcontacts.
- [ ] Exercise dry asphalt, wet asphalt, grass and gravel.
- [ ] Check vehicle reset and native object cleanup.
- [ ] Review the public diff for secrets, private assets and unrelated modules.
- [ ] Record the commit hashes and artifact checksums in the GitHub release.

## Not yet claimed

- scientific validation against measured tire data;
- bit-identical determinism across every browser and CPU;
- suitability for safety-critical or engineering-certification use;
- a stable npm API.
