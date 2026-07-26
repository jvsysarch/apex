# APEX

Initial commit

Date: 2026-07-26

Author: Jonathan Villaverde <jv.sys.arch@gmail.com>

This commit reserves the structure of a modular monorepo. It contains no
implementation.

| Path | Intended responsibility |
| --- | --- |
| `apps/apex-run` | Integrated browser simulator and composition root. |
| `packages/apex-contracts` | Versioned schemas and interoperability contracts. |
| `packages/apex-physics` | Headless vehicle dynamics and physical state. |
| `packages/apex-wheel` | Tire, wheel, contact and deformation models. |
| `packages/apex-car` | Vehicle definitions and physical/visual rigs. |
| `packages/apex-track` | Track formats, geometry, collision and editing. |
| `packages/apex-drive` | Driving-session orchestration. |
| `packages/apex-ui` | HUD, telemetry and user controls. |
| `packages/apex-render` | Scene, camera and visual presentation. |
| `packages/apex-audio` | Audio derived from simulation state. |
| `packages/apex-assets` | Audited asset import and normalization. |
| `packages/apex-void` | Future persistence and world continuity. |

Repository language: English.

English documents are canonical. Spanish translations use the `README.es.md`
suffix and are synchronized manually until an automated workflow is introduced.
