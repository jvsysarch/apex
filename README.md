# Apex

Apex is a modular vehicle-simulation ecosystem built around explainable,
testable physical components.

The repository is being opened progressively. The first implementation
published here is **Apex Physics**, the headless vehicle-dynamics and
tire-force runtime used by Apex Drive.

[Descripción en español](README.es.md)

## Public component

### [Apex Physics](packages/apex-physics/README.md)

Apex Physics is built on
[Jolt Physics](https://github.com/jrouwe/JoltPhysics). Jolt remains responsible
for rigid bodies, collision, contact, vehicle constraints and integration.
Apex adds:

- vehicle-world orchestration at a fixed 360 Hz step;
- vehicle profiles, surfaces and physical state snapshots;
- Apex Brush and simplified Apex TMeasy-inspired tire-force models;
- a compiled tire-force bridge in the WebAssembly binding;
- aerodynamics, assists, torque distribution and deterministic input filtering.

The JoltPhysics.js binding modifications, exact upstream commits and licenses
are documented inside the component.

## Progressive publication

The remaining directories reserve the intended module boundaries of the Apex
ecosystem. Unless a component contains an explicit public implementation and
license, its current public README is a roadmap marker rather than a released
package.

Apex Drive is the reference product and integration bench. Its implementation
will be published only after its component boundaries, assets and distribution
are ready.

## Repository map

| Path | Responsibility | Public state |
| --- | --- | --- |
| `packages/apex-physics` | Vehicle dynamics, tires, Jolt/WASM bridge | Source available, experimental |
| `packages/apex-contracts` | Schemas and interoperability contracts | Reserved |
| `packages/apex-wheel` | Tire, wheel and contact boundary | Reserved |
| `packages/apex-car` | Vehicle definitions and rigs | Reserved |
| `packages/apex-track` | Track geometry, collision and editing | Reserved |
| `packages/apex-drive` | Driving-session orchestration | Reserved |
| `packages/apex-ui` | HUD, telemetry and controls | Reserved |
| `packages/apex-render` | Scene, cameras and presentation | Reserved |
| `packages/apex-audio` | Audio derived from simulation state | Reserved |
| `packages/apex-assets` | Audited assets and normalization | Reserved |
| `packages/apex-void` | Future world continuity | Reserved |

## Licensing

Licensing is declared per component. Apex Physics original code is released
under MIT and preserves the MIT licenses and copyright notices of Jolt Physics
and JoltPhysics.js. See
[`packages/apex-physics/THIRD_PARTY_NOTICES.md`](packages/apex-physics/THIRD_PARTY_NOTICES.md).

No license is implied for reserved or unpublished components.

English documentation is canonical. Spanish translations use the
`README.es.md` suffix.
