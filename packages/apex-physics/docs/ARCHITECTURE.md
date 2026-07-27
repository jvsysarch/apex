# Apex Physics architecture

## Responsibility boundary

```text
Host application (Apex Drive)
  ├─ loads apex-physics.js and apex-physics.wasm
  ├─ owns input, rendering, UI, track and session
  └─ passes the initialized Jolt module
             │
             ▼
ApexPhysicsWorld
  ├─ fixed-step orchestration and static world
  ├─ creates a vehicle from an external definition
  └─ owns temporal authority
             │
             ├────────────── ApexVehicle
             │                 ├─ controls
             │                 └─ numeric snapshots
             │
             ▼
ApexVehicleSimulation (internal)
  ├─ surfaces and static-world descriptors
  ├─ aerodynamics, assists and torque distribution
  └─ tire-force model selection
             │
             ▼
ApexTireForceBridge (modified JoltPhysics.js binding)
  ├─ Apex Brush
  ├─ simplified Apex TMeasy-inspired model
  └─ numerical subcontact evaluation
             │
             ▼
Jolt Physics
  ├─ rigid bodies and shapes
  ├─ collision and geometric contact
  ├─ vehicle constraints and suspension
  └─ solver and integration
```

## Authority

Jolt is the rigid-body and contact authority. Apex does not replace the Jolt
solver. Apex calculates the tire-force limits/impulses supplied through the
vehicle-controller callback and coordinates the surrounding vehicle systems.

## Fixed step

The normal runtime advances at 360 Hz. Hosts may render at another frequency,
but must not tie physics behavior to the render frame rate.

## Tire contacts

The production four-wheel configuration uses Jolt's geometric wheel contacts.
The default count of eight refers to numerical tire-force subcontact
evaluations distributed across those wheel contacts. It is telemetry about
force-model evaluation, not a claim of eight wheels or eight collision rays.

## Native and TypeScript paths

The production tire models have compiled implementations in
`native/JoltJS.h`. TypeScript implementations remain available for model
development, comparison and controlled fallback paths. The execution backend
is included in runtime snapshots so telemetry can distinguish compiled, JS and
Jolt-default behavior.

## Package boundary

Allowed:

- headless vehicle dynamics;
- numerical contracts and state snapshots;
- surfaces and generic vehicle-definition contracts;
- native physics bridge and its loader-facing artifacts.

Excluded:

- Three.js or other rendering code;
- React or UI code;
- tracks and editors;
- audio and visual assets;
- races, menus, game modes or session state;
- Apex Void.

Concrete vehicle definitions are intentionally excluded. `@jvsysarch/apex-car`
owns `APEX_ROAD_CAR` and `APEX_MOTORCYCLE` and depends on the contracts from
this package. Apex Physics never imports Apex Car.
