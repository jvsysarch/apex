# APEX Drive · Ignition

`apps/apex-demo` is the public build profile of the real APEX Drive runtime.
It contains no alternative driving implementation.

The current pre-alpha profile fixes:

- Circuito Vector.
- Ford Mustang Shelby GT500 demo asset and its APEX TMeasy `vehicle.json`.
- Original vehicle-model attribution and CC BY 4.0 license in the public build.
- `apex-tmeasy-v1` through the published vehicle physics definition.
- A reduced public UI.

During monorepo development it consumes the workspace sources directly. Once
the runtime packages are stable and published, this thin host can move to an
independent repository without copying APEX Drive.
