# Apex

Apex es un ecosistema modular de simulación vehicular construido alrededor de
componentes físicos explicables y verificables.

El repositorio se abrirá progresivamente. La primera implementación publicada
es **Apex Physics**, el runtime headless de dinámica vehicular y fuerzas de
neumáticos utilizado por Apex Drive.

[English overview](README.md)

## Componente público

### [Apex Physics](packages/apex-physics/README.es.md)

Apex Physics está construido sobre
[Jolt Physics](https://github.com/jrouwe/JoltPhysics). Jolt continúa siendo
responsable de cuerpos rígidos, colisiones, contactos, constraints vehiculares
e integración. Apex agrega:

- orquestación del vehículo con paso físico fijo de 360 Hz;
- perfiles, superficies y snapshots del estado físico;
- modelos Apex Brush y Apex inspirado de forma simplificada en TMeasy;
- bridge de fuerzas de neumático compilado dentro del binding WebAssembly;
- aerodinámica, asistencias, distribución de torque y filtrado determinista de
  input.

Las modificaciones a JoltPhysics.js, los commits upstream exactos y las
licencias están documentados dentro del componente.

## Publicación progresiva

Las demás carpetas reservan las fronteras previstas de los módulos del
ecosistema. Mientras un componente no contenga una implementación pública y
una licencia explícita, su README es solamente una marca de roadmap y no un
paquete publicado.

Apex Drive es el producto de referencia y banco de integración. Su
implementación se publicará cuando sus fronteras, activos y distribución estén
preparados.

## Mapa del repositorio

| Ruta | Responsabilidad | Estado público |
| --- | --- | --- |
| `packages/apex-physics` | Dinámica, neumáticos y bridge Jolt/WASM | Código disponible, experimental |
| `packages/apex-contracts` | Esquemas y contratos de interoperabilidad | Reservado |
| `packages/apex-wheel` | Frontera de neumático, rueda y contacto | Reservado |
| `packages/apex-car` | Definiciones y rigs de vehículos | Reservado |
| `packages/apex-track` | Geometría, colisión y edición de pistas | Reservado |
| `packages/apex-drive` | Orquestación de sesiones | Reservado |
| `packages/apex-ui` | HUD, telemetría y controles | Reservado |
| `packages/apex-render` | Escena, cámaras y presentación | Reservado |
| `packages/apex-audio` | Audio derivado de la simulación | Reservado |
| `packages/apex-assets` | Activos auditados y normalización | Reservado |
| `packages/apex-void` | Continuidad futura del mundo | Reservado |

## Licencias

Cada componente declara su propia licencia. El código original de Apex Physics
se publica bajo MIT y conserva los avisos MIT y copyrights de Jolt Physics y
JoltPhysics.js. Ver
[`packages/apex-physics/THIRD_PARTY_NOTICES.md`](packages/apex-physics/THIRD_PARTY_NOTICES.md).

No se presupone ninguna licencia para componentes reservados o todavía no
publicados.

La documentación en inglés es canónica. Las traducciones al español usan el
sufijo `README.es.md`.
