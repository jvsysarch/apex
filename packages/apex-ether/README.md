# @jvsysarch/apex-ether

Biblioteca React reutilizable de Apex Ether: contratos de telemetría, store segmentado, primitivas visuales y paneles automotrices.

El paquete no depende de Apex Drive ni de Apex Ether Studio. Los consumidores proporcionan telemetría mediante propiedades o mediante `ApexEtherTelemetryStore`.

## Estado

Versión `0.2.0`, privada dentro del workspace. La API puede evolucionar antes de la primera versión estable.

## Uso en el workspace

```json
{
  "dependencies": {
    "@jvsysarch/apex-ether": "workspace:*"
  }
}
```

Importá la hoja de estilos una vez:

```tsx
import '@jvsysarch/apex-ether/styles.css';
```

La hoja incluye WOFF2 locales para las veinte familias disponibles en el Studio. El HUD descarga sus fuentes desde el mismo despliegue de Apex Ether: no depende de Google Fonts ni de fuentes instaladas en el sistema. Los fallbacks tipográficos apuntan exclusivamente a otras familias incluidas en el paquete.

## Idioma

Los paneles propios del paquete incluyen español e inglés. Envolvé la composición con `ApexEtherLocaleProvider`; el idioma predeterminado es español.

```tsx
import {
  ApexEtherLocaleProvider,
  type ApexEtherLocale,
} from '@jvsysarch/apex-ether';

export function Hud({ locale }: { locale: ApexEtherLocale }) {
  return (
    <ApexEtherLocaleProvider locale={locale}>
      {/* Paneles o ApexEtherHud */}
    </ApexEtherLocaleProvider>
  );
}
```

Las etiquetas de datos suministradas por el host siguen perteneciendo al host y deben entregarse en el idioma elegido. Ether traduce sus títulos, estados, unidades editoriales y textos de accesibilidad internos.

## Composición básica

La cabecera es opcional. Un panel sólo debe declarar `title` o `eyebrow` cuando agregan contexto; componentes autosuficientes como el velocímetro pueden omitirlos sin reservar espacio vacío.

```tsx
import {
  ApexEtherMetric,
  ApexEtherMetricGrid,
  ApexEtherPanel,
} from '@jvsysarch/apex-ether';

export function SessionSummary() {
  return (
    <ApexEtherPanel eyebrow="Sesión" title="Altas Cumbres" mode="glass">
      <ApexEtherMetricGrid columns={2}>
        <ApexEtherMetric label="Vehículo" value="Apex GT" variant="hero" />
        <ApexEtherMetric label="Condición" value="Asfalto seco" variant="hero" />
      </ApexEtherMetricGrid>
    </ApexEtherPanel>
  );
}
```

## API inicial

### Infraestructura

- `ApexEtherTelemetryStore`
- `ApexEtherProvider`
- `ApexEtherLocaleProvider`
- `useApexEtherLocale`
- `etherText`
- `useApexEtherSlice`
- `ApexEtherHud`

### Primitivas

- `ApexEtherPanel`
- `ApexEtherPanelHeader`
- `ApexEtherPanelBody`
- `ApexEtherPanelList`
- `ApexEtherPanelRow`
- `ApexEtherMetricGrid`
- `ApexEtherMetric`
- `ApexEtherProgress`
- `ApexEtherTachometer`

### Paneles de dominio

- `ApexEtherSpeed`
- `ApexEtherRaceClock`
- `ApexEtherReferenceDelta`
- `ApexEtherPosition`
- `ApexEtherLeaderboard`
- `ApexEtherObjectives`
- `ApexEtherWheelHealth`
- `ApexEtherVehicleContact`
- `ApexEtherRoute`
- `ApexEtherInput`

### Contratos principales

- `ApexEtherTelemetry`
- `ApexEtherMotion`
- `ApexEtherRace`
- `ApexEtherWheel`
- `ApexEtherSession`
- `ApexEtherRoutePoint`
- `ApexEtherSurfaceMode`
- `ApexEtherLocale`
- `ApexEtherTone`
- `ApexEtherPanelId`

## Rendimiento

El store notifica por segmento. Para aprovechar esa frontera, el host debe publicar objetos inmutables sólo cuando sus valores cambian y cada componente conectado debe leer únicamente el segmento necesario.

La guía completa, con ejemplos de propiedades, store y HUD declarativo, está en [`docs/integration.md`](../../docs/integration.md).

## Autoría y licencia

© Jonathan Villaverde 2026. Código bajo PolyForm Noncommercial 1.0.0; sistema visual y documentación bajo CC BY-NC-SA 4.0.
