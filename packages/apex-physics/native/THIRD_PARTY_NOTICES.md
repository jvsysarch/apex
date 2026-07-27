# Native runtime third-party notices

This native runtime uses two independent upstream projects.

## Jolt Physics

Jolt Physics provides the rigid-body, collision, contact, vehicle-constraint
and integration systems used by this runtime. Apex does not vendor or modify
Jolt's C++ source. The build fetches Jolt Physics `v5.6.0` at commit
`e77f175595e64cb44218cc9d9d56fc365ad0e36a` directly from
<https://github.com/jrouwe/JoltPhysics>.

The generated JS/WASM artifacts contain code compiled from Jolt. Its full MIT
notice is included in [JOLT_LICENSE](JOLT_LICENSE).

## JoltPhysics.js

The local browser binding integration is derived from JoltPhysics.js `1.1.0`,
audited at commit `5d6b7e1d51bb156b6d1879c34a0068d3440e607f` from
<https://github.com/jrouwe/JoltPhysics.js>. It includes only the Apex-specific
bridge and artifact-naming changes needed to expose `ApexTireForceBridge`.

JoltPhysics.js remains an independent upstream project. Its original MIT
notice is included in [LICENSE](LICENSE). Apex additions are MIT-licensed under
the repository's Apex Physics license.
