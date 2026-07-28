# Apex Drive

Aplicación jugable y banco de integración del ecosistema APEX.

## Autoridad

Esta carpeta contiene la composición ejecutable del producto. Consume los
componentes locales del workspace; no importa código desde `apps/apex-run`.

Componentes conectados en el primer corte:

- `@jvsysarch/apex-physics`: Jolt/WASM, vehículo, neumáticos, superficies,
  dinámica y snapshots numéricos.
- `@jvsysarch/apex-contracts`: Command Bus tipado.
- `@jvsysarch/apex-assets`: activos locales y sus avisos de licencia.

Los subsistemas todavía integrados bajo `src` se extraerán progresivamente a
`packages/apex-*` manteniendo esta aplicación como prueba de equivalencia.

## Ejecución local

Desde la raíz de `/apex`:

```text
corepack pnpm dev:drive
```

URL:

```text
http://127.0.0.1:5175/
```

El flujo histórico `apps/apex-run` permanece como alias temporal.

## Inspección del vehículo

El selector de cámaras incluye `Rueda delantera`. La cámara sigue desde el
exterior la rueda delantera derecha y apunta hacia su parche de contacto para
observar suspensión, dirección, giro y deformación sin rotar con la cubierta.

La opción `Modelo físico` superpone sobre el GLTF:

- caja de colisión en amarillo;
- ruedas virtuales de Jolt en celeste;
- centro de masa en rosa;
- masa y dimensiones principales en la interfaz.

El GLTF del EV es la autoridad visual. Radio, ancho, batalla y trochas de la
definición física se calibran contra la posición de sus neumáticos.

## Deformación visual del neumático

La deformación de la malla pertenece a la capa de renderizado de Apex Drive:

```text
src/rendering/ApexTireDeformationVisual.ts
```

`@jvsysarch/apex-physics` conserva la autoridad sobre carga vertical, presión,
contacto, fuerzas y pose de cada rueda. Apex Drive consume esos valores para
representar compresión radial, expansión lateral, shear y el parche plano
contra el suelo. La longitud visual del parche se obtiene con:

```text
L = 2 * sqrt(2 * R * delta - delta²)
```

donde `R` es el radio exterior y `delta` la deflexión radial filtrada por el
resorte-amortiguador visual. La proyección geométrica no modifica las fuerzas,
el agarre ni el estado de Jolt/TMeasy.
