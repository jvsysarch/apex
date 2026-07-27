# Native WebAssembly build

The native build produces the single-threaded external-WASM runtime used by
Apex Drive:

```text
native/dist/apex-physics.js
native/dist/apex-physics.wasm
native/dist/apex-physics.d.ts
native/dist/types.d.ts
```

The build uses the modified JoltPhysics.js bindings in `native/` and fetches
the pinned Jolt Physics v5.6.0 commit recorded in
[`native/UPSTREAM.md`](../native/UPSTREAM.md).

## Toolchain

The reproducible container starts from `emscripten/emsdk:6.0.2` and adds the
Java runtime required by Closure Compiler. Docker is the supported public
build path for the first source release.

From `packages/apex-physics/native` in Windows CMD:

```bat
docker build -f Dockerfile.build -t apex-physics-build .
docker run --rm -v "%cd%:/src" apex-physics-build sh build-apex.sh
```

From the same directory in a POSIX shell:

```sh
docker build -f Dockerfile.build -t apex-physics-build .
docker run --rm -v "$PWD:/src" apex-physics-build sh build-apex.sh
```

The build script removes and recreates `native/dist`. Do not run it with
uncommitted manual changes inside that generated directory.

## Distribution policy

Source control is authoritative for source and build tooling. Generated JS/WASM
must be rebuilt and checksum-recorded before a GitHub release. A release may
attach those artifacts for consumers that do not have the native toolchain.

The root package remains `private: true` until the separate npm distribution
work is completed.
