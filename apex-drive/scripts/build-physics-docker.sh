#!/bin/sh
set -eu

docker build -f apex-physics/Dockerfile.build -t apex-physics-builder:6.0.2 apex-physics
docker run --rm \
  -v "$PWD/apex-physics:/src" \
  -w /src \
  apex-physics-builder:6.0.2 \
  bash -lc 'npm install && sh build-apex.sh'
