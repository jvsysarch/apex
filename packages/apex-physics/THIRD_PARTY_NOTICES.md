# Third-party notices

Apex Physics is original vehicle-dynamics software that uses independent
third-party open-source components. The components below are not authored by,
affiliated with or endorsed by the Apex project.

## Jolt Physics

- Project: Jolt Physics
- Author: Jorrit Rouwe and contributors
- Source: <https://github.com/jrouwe/JoltPhysics>
- Version used by the native build: `v5.6.0`
- Resolved commit: `e77f175595e64cb44218cc9d9d56fc365ad0e36a`
- License: MIT

Jolt provides rigid-body dynamics, collision detection, contact generation,
vehicle constraints and integration. Apex does not vendor or modify Jolt's C++
source: the native build fetches this exact upstream commit. Generated runtime
artifacts contain Jolt code, so its full MIT notice is distributed as
[`native/JOLT_LICENSE`](native/JOLT_LICENSE).

## JoltPhysics.js

- Project: JoltPhysics.js
- Author: Jorrit Rouwe and contributors
- Source: <https://github.com/jrouwe/JoltPhysics.js>
- Upstream version: `1.1.0`
- Audited base commit: `5d6b7e1d51bb156b6d1879c34a0068d3440e607f`
- License: MIT
- Preserved license: [`native/LICENSE`](native/LICENSE)

The binding source is vendored and modified only as an Apex integration layer.
It is not a fork of Jolt Physics. Apex changes include:

- `JoltJS.h`: adds the compiled `ApexTireForceBridge` implementation;
- `JoltJS.idl`: exposes the bridge through the generated JavaScript API;
- `CMakeLists.txt`: names the Apex runtime artifacts and their external WASM;
- `build.sh`: adapts generated artifact and declaration names;
- native and per-target `package.json` files: local build metadata and artifact
  names;
- Apex-specific build files, type entry points and container tooling.

Unmodified upstream files retain their original copyright and SPDX notices.
Modified upstream files remain available under the upstream MIT license, with
Apex modifications also released under MIT.

## TMeasy reference

`ApexTMeasy` is an original, simplified force model inspired by the published
TMeasy approach. It is not the official TMeasy implementation and does not
claim numerical equivalence.

Reference:

W. Hirschberg, G. Rill and H. Weinfurter, “Tire model TMeasy,” *Vehicle
System Dynamics*, vol. 45, supplement 1, pp. 101–119, 2007.
<https://doi.org/10.1080/00423110701776284>

All product names and project names remain the property of their respective
owners.
