#!/bin/sh
set -eu

# Distribución single-threaded con WASM externo. Compila Jolt v5.6.0 mediante
# los bindings JoltPhysics.js modificados que exponen ApexTireForceBridge.
cmake -E remove_directory dist
cmake -E make_directory dist
cmake -B Build/Distribution/ST -DCMAKE_BUILD_TYPE=Distribution
cmake --build Build/Distribution/ST --target apex-wasm -j "$(nproc)"
cmake -E copy apex-physics.d.ts.in dist/apex-physics.d.ts
