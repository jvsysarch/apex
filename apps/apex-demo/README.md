# Apex Physics Demo

Public, static and intentionally focused demonstration of the Apex Physics
tire-force API. It is separate from `apex-drive`, which remains the internal
integration and test bench for vehicle, track, rendering, editor and services.

## Local development

```text
corepack pnpm dev:demo
```

## Public deployment

The GitHub Pages workflow publishes this application at:

```text
https://jvsysarch.github.io/apex/
```

It deploys only the built files from `apps/apex-demo/dist`.
