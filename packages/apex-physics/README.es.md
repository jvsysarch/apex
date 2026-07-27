# APEX Physics

Runtime headless de dinámica vehicular y fuerzas de neumáticos del ecosistema
Apex, construido sobre
[Jolt Physics](https://github.com/jrouwe/JoltPhysics).

> Estado: `0.1.0`, API pública experimental. Apex Drive consume directamente
> este paquete del workspace. Se mantiene protegido contra una publicación
> accidental en npm mientras estabilizamos la API y el formato de distribución.

[English documentation](README.md)

## Qué es Apex Physics

Apex Physics no reemplaza ni renombra Jolt Physics. Jolt conserva la autoridad
sobre cuerpos rígidos, detección de colisiones, generación de contactos,
constraints vehiculares e integración temporal. Apex agrega la capa específica
de dinámica vehicular:

- `ApexPhysicsWorld`, `ApexVehicle` y snapshots numéricos;
- contratos genéricos para definiciones de vehículos externas;
- catálogo y selección de superficies;
- modelos Apex Brush y Apex inspirado de forma simplificada en TMeasy;
- bridge de fuerzas de neumático compilado dentro del runtime WebAssembly;
- aerodinámica, asistencias y distribución de torque;
- filtrado determinista de input;
- un puerto independiente del host para colisión estática.

El runtime de navegador se construye con bindings modificados de
JoltPhysics.js. La modificación expone `ApexTireForceBridge`, lo que permite
ejecutar los modelos de neumático de producción dentro de WebAssembly sin un
callback JavaScript por rueda.

Ver [Arquitectura](docs/ARCHITECTURE.md),
[procedencia nativa](native/UPSTREAM.md),
[compilación nativa](docs/NATIVE_BUILD.md) y
[avisos de terceros](THIRD_PARTY_NOTICES.md).

## Invariantes del runtime

- paso físico fijo normal: **360 Hz**;
- modelo de neumático predeterminado: **`apex-tmeasy-v1`**;
- evaluación numérica predeterminada: **8 subcontactos** distribuidos entre los
  cuatro contactos de rueda;
- Jolt sigue siendo responsable de cuerpos, integración y contacto geométrico;
- pista, render, React, UI, audio y sesión permanecen fuera de este paquete.

El conteo de contactos describe muestras numéricas de fuerza. No significa
ocho ruedas ni ocho rayos de colisión independientes.

## Uso dentro del workspace

Actualmente el paquete expone TypeScript directamente a las aplicaciones del
workspace pnpm de Apex:

```ts
import {
  ApexPhysicsWorld,
  SurfaceRegistry,
} from '@jvsysarch/apex-physics';
import { APEX_ROAD_CAR } from '@jvsysarch/apex-car';

const Jolt = await loadApexPhysicsRuntime();
const world = ApexPhysicsWorld.create(Jolt);
const vehicle = world.addVehicle(APEX_ROAD_CAR);
const surfaces = new SurfaceRegistry();

vehicle.applyInput(driverInput);
world.step();
```

El host carga WebAssembly y entrega el módulo Jolt inicializado a
`ApexPhysicsWorld`. Los presets concretos, como `APEX_ROAD_CAR`, viven en
`@jvsysarch/apex-car`; este paquete no contiene un auto de demo implícito.
Apex Drive es el host de referencia y banco de integración.

## Validación

El paquete dispone de comprobación TypeScript aislada y pruebas iniciales del
registro de superficies. El 26 de julio de 2026 Apex Drive fue compilado y
validado manualmente consumiendo este paquete directamente desde el workspace.

Antes de crear una publicación o tag deben completarse los controles de
[VALIDATION.md](docs/VALIDATION.md). El estado actual no implica validación
científica ni seguridad para aplicaciones críticas.

## Límite

Este paquete debe permanecer headless. Pista, render, UI, audio, assets,
lógica de carrera/sesión y Apex Void pertenecen a otros componentes.

## Licencia

El código original de Apex Physics se publica bajo
[licencia MIT](LICENSE). Jolt Physics y los bindings JoltPhysics.js
preservados/modificados conservan sus avisos MIT originales. Ver
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
