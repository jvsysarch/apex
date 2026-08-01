# Apex Drive → Apex Ether

Esta carpeta es la única frontera entre la simulación de Apex Drive y la presentación React de Apex Ether.

```text
Apex Physics / carrera
        ↓ snapshots bajo demanda
ApexHudAdapter
        ↓ modelos inmutables normalizados
ApexHudStore (segmentado)
        ↓ suscripciones por slice
ApexEtherHudRuntime
        ↓ props públicas
@jvsysarch/apex-ether
```

## Responsabilidades

- `ApexHudContract.ts` define el modelo que Drive entrega al HUD. No contiene componentes ni decisiones visuales.
- `ApexHudAdapter.ts` convierte unidades, limita frecuencias y evita publicar snapshots equivalentes.
- `ApexHudStore.ts` notifica por segmento; un cambio de ruedas no vuelve a renderizar cronometraje o velocidad.
- `ApexHudPreferences.ts` convierte paneles visibles en demanda de datos. Si un grupo no se usa, Drive deja de prepararlo.
- `ApexEtherHudRuntime.tsx` es el único lugar que conoce simultáneamente el contrato de Drive y la API pública de Ether.

Ether no importa Apex Physics, Apex Drive ni sus estados internos.

## Uso local

Desde la raíz del repositorio:

```sh
corepack pnpm dev:drive
```

Abrir:

```text
http://127.0.0.1:5175/?ether=true
```

`ether=true` activa Ether y desconecta la UI técnica anterior. `ether=false` lo desactiva explícitamente en perfiles donde pueda venir habilitado.

El HUD puede abrirse directamente en español o inglés con `?ether=true&lang=es` y `?ether=true&lang=en`. El selector ES/EN también está dentro del menú `HUD` y conserva la elección localmente.

La primera ejecución usa el preset completo. El botón `HUD`, centrado arriba, permite activar o desactivar segmentos; la selección queda guardada localmente.

## Cadencias iniciales

- Conducción: 30 Hz para velocidad, RPM, marcha y controles.
- Estado: 10 Hz para navegación, ruedas y carrera.
- Física: solo se solicita un snapshot cuando algún segmento visible llegó a su siguiente ventana de publicación.
- React: cada componente se suscribe únicamente al slice que consume y el store no emite si la firma del snapshot no cambió.

Estas cadencias son parte del adaptador de Drive, no del paquete visual, y pueden ajustarse con mediciones de frame time sin modificar Ether.
