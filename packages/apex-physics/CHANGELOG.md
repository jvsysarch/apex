# Changelog

All notable changes to Apex Physics will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the public package will follow semantic versioning once its API is stable.

## [0.1.0] - Unreleased

### Added

- `ApexPhysicsWorld` and `ApexVehicle` headless runtime API.
- Generic `ApexVehicleDefinition` contracts with no implicit concrete car.
- Apex Brush and simplified Apex TMeasy-inspired tire-force models.
- Compiled `ApexTireForceBridge` for the modified JoltPhysics.js WASM binding.
- Surface registry, configurable aerodynamics, assists, torque
  distribution and deterministic input filtering.
- Static-world port and Jolt adapter.
- Initial surface-registry and public-boundary tests.
- Direct workspace integration with Apex Drive.
- Explicit `.ts` module specifiers for Node 24 strip-types test execution.

### Changed

- Concrete road-car and motorcycle definitions moved to
  `@jvsysarch/apex-car`.
- Fixed stepping and static collision authority now belong to
  `ApexPhysicsWorld`; vehicle input and snapshots belong to `ApexVehicle`.

### Validated

- Apex Drive compiled and ran successfully while consuming
  `@jvsysarch/apex-physics` directly from the monorepo workspace.

### Remaining before tag

- Stabilize the public TypeScript API and browser runtime loader.
- Expand native-runtime and physics-world smoke coverage.
- Complete the public validation checklist.
- Define the npm distribution format after the GitHub source release.
