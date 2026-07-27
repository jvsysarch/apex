# Native runtime provenance

Apex Physics is an independent vehicle-dynamics runtime that uses
[Jolt Physics](https://github.com/jrouwe/JoltPhysics) for rigid-body
simulation and collision. Apex neither vendors nor modifies Jolt's C++ source:
the build fetches the exact upstream commit below. The `native/` directory
contains a small Apex integration layer derived from
[JoltPhysics.js](https://github.com/jrouwe/JoltPhysics.js) so the browser
runtime can expose `ApexTireForceBridge`.

This integration does not rename, replace or fork Jolt Physics. Jolt and
JoltPhysics.js retain their own copyright, licenses and upstream identity.

## Audited upstream baseline

- JoltPhysics.js version: `1.1.0`
- JoltPhysics.js commit:
  `5d6b7e1d51bb156b6d1879c34a0068d3440e607f`
- Jolt Physics release: `v5.6.0`
- Jolt Physics commit:
  `e77f175595e64cb44218cc9d9d56fc365ad0e36a`
- Audit date: 2026-07-26

The upstream JoltPhysics.js files were compared against that commit before the
first public Apex Physics preparation.

## Apex modifications

### Binding

- `JoltJS.h` adds `ApexTireForceBridge` and the compiled Apex Brush and
  simplified Apex TMeasy-inspired force calculations.
- `JoltJS.idl` exposes that bridge to the generated JavaScript/WASM API.

### Distribution

- `CMakeLists.txt` emits `apex-physics.*` artifact names.
- `build.sh` adapts declaration and artifact naming.
- `build-apex.sh` builds the single-threaded external-WASM runtime used by
  Apex Drive.
- `apex-physics.d.ts.in` provides the runtime module entry declaration.
- `Dockerfile.build` fixes the native toolchain image.
- per-target `package.json` files describe the renamed local build artifacts.

### Unmodified upstream material

Files that remain unmodified retain their upstream copyright and MIT license.
The JoltPhysics.js MIT license is preserved in [`LICENSE`](LICENSE). Jolt's MIT
license is preserved in [`JOLT_LICENSE`](JOLT_LICENSE). Distribution
requirements are summarized in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

Only the external-WASM, single-threaded integration needed by Apex is retained.
Upstream examples, local servers, CI/publish scripts, asm.js, embedded-WASM,
debug and multithread packaging scaffolding are deliberately excluded.

## Updating upstream

An upstream update must:

1. record the new JoltPhysics.js and Jolt commits;
2. compare every vendored binding/build file;
3. reapply or revise the Apex bridge intentionally;
4. rebuild the JS/WASM artifacts;
5. run the package and Apex Drive validation checklist;
6. update `THIRD_PARTY_NOTICES.md` and this document.
