# APEX

Commit inicial

Fecha: 2026-07-26

Autor: Jonathan Villaverde <jv.sys.arch@gmail.com>

Este commit reserva la estructura de un monorepo modular. No contiene
implementación.

| Ruta | Responsabilidad prevista |
| --- | --- |
| `apps/apex-run` | Simulador integrado para navegador y raíz de composición. |
| `packages/apex-contracts` | Esquemas versionados y contratos de interoperabilidad. |
| `packages/apex-physics` | Dinámica vehicular headless y estado físico. |
| `packages/apex-wheel` | Modelos de neumático, rueda, contacto y deformación. |
| `packages/apex-car` | Definiciones de vehículos y rigs físicos/visuales. |
| `packages/apex-track` | Formatos, geometría, colisión y edición de pistas. |
| `packages/apex-drive` | Orquestación de sesiones de conducción. |
| `packages/apex-ui` | HUD, telemetría y controles de usuario. |
| `packages/apex-render` | Escena, cámara y presentación visual. |
| `packages/apex-audio` | Audio derivado del estado de simulación. |
| `packages/apex-assets` | Importación y normalización auditada de assets. |
| `packages/apex-void` | Persistencia futura y continuidad del mundo. |

Los documentos en inglés son canónicos. Las traducciones al español usan el
sufijo `README.es.md` y se sincronizan manualmente hasta incorporar un flujo
automatizado.
