# Apex Physics

Headless vehicle dynamics and tire-force runtime for the Apex ecosystem. It
uses [Jolt Physics](https://github.com/jrouwe/JoltPhysics) as its rigid-body
and collision dependency.

> Status: `0.1.0`, experimental public API. Apex Drive consumes this workspace
> package directly. It is intentionally protected from accidental npm
> publication while the API and distribution format are stabilized.

[Documentación en español](README.es.md)

## What Apex Physics is

Apex Physics is not a replacement, rename or fork of Jolt Physics. Jolt is an
independent upstream dependency and remains the authority for rigid bodies,
collision detection, contact generation, vehicle constraints and time
integration. Apex adds the vehicle-specific layer:

- `ApexPhysicsWorld`, `ApexVehicle` and numeric state snapshots;
- generic contracts for externally supplied vehicle definitions;
- surface definitions and runtime surface selection;
- Apex Brush and simplified Apex TMeasy-inspired tire-force models;
- a compiled tire-force bridge inside the WebAssembly runtime;
- aerodynamics, assists and torque distribution;
- deterministic input filtering;
- a host-neutral port for static-world collision data.

The browser runtime fetches the pinned, unmodified Jolt C++ source directly
from its upstream repository. Apex carries a small integration layer derived
from JoltPhysics.js solely to expose `ApexTireForceBridge`, allowing the
production tire models to execute inside WebAssembly without a per-wheel
JavaScript callback. Jolt and JoltPhysics.js retain their own identities,
copyrights and MIT notices.

See [Architecture](docs/ARCHITECTURE.md), [native provenance](native/UPSTREAM.md),
[native build](docs/NATIVE_BUILD.md) and
[third-party notices](THIRD_PARTY_NOTICES.md).

## Runtime invariants

- normal fixed physics step: **360 Hz**;
- default tire model: **`apex-tmeasy-v1`**;
- default numerical evaluation: **8 subcontacts** across the four wheel
  contacts;
- Jolt remains responsible for bodies, integration and geometric contact;
- track, rendering, React, UI, audio and game-session logic remain outside this
  package.

The contact count describes numerical tire-force samples. It does not mean
eight wheels or eight independent collision rays.

## Workspace use

The package currently exposes TypeScript source to other applications in the
Apex pnpm workspace:

```ts
import {
  ApexPhysicsWorld,
  SurfaceRegistry,
} from '@jvsysarch/apex-physics';
import { APEX_ROAD_CAR } from '@jvsysarch/apex-car';

const Jolt = await loadApexPhysicsRuntime();
const world = ApexPhysicsWorld.create(Jolt);
const vehicle = world.addVehicle(APEX_ROAD_CAR);
const surfaces = new SurfaceRegistry();

vehicle.applyInput(driverInput);
world.step();
```

The host owns WebAssembly loading and passes the initialized Jolt module to
`ApexPhysicsWorld`. Concrete presets such as `APEX_ROAD_CAR` live in
`@jvsysarch/apex-car`, so this package does not contain an implicit demo car.
Apex Drive is the reference host and integration bench.

## Validation

The package has an isolated TypeScript check and initial surface-registry
tests. On 2026-07-26 Apex Drive was compiled and manually validated while
consuming this package directly from the workspace.

Before a public release or tag, complete the checks recorded in
[VALIDATION.md](docs/VALIDATION.md). The current public-readiness work does not
claim scientific validation or production safety.

## Scope

This package must remain headless. Track authoring, rendering, UI, audio,
assets, race/session logic and Apex Void belong to other ecosystem components.

## License

Original Apex Physics code is available under the [MIT License](LICENSE).
Jolt Physics and the vendored/modified JoltPhysics.js integration retain their
original MIT notices. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md),
[the Jolt notice](native/JOLT_LICENSE) and
[the JoltPhysics.js notice](native/LICENSE).
