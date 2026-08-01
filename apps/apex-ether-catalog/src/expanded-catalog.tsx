import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ApexEtherMetric,
  ApexEtherMetricGrid,
  ApexEtherPanelList,
  ApexEtherPanelRow,
  ApexEtherProgress,
  ApexEtherSurface,
  type ApexEtherSurfaceMode,
  type ApexEtherTone,
} from '@jvsysarch/apex-ether';

type CatalogBackground = 'mountain' | 'night';

const backgroundImage = (background: CatalogBackground) => (
  `url(/backgrounds/ether-${background === 'mountain' ? 'mountain-route' : 'riverside-night'}-v1.png)`
);

function ConceptFrame({
  title,
  subtitle,
  mode,
  background,
  children,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly mode: ApexEtherSurfaceMode;
  readonly background: CatalogBackground;
  readonly children: ReactNode;
}) {
  return <article
    className="catalog-frame expanded-frame"
    data-mode={mode}
    style={{ '--catalog-image': backgroundImage(background) } as CSSProperties}
  >
    <header>
      <div><span>{subtitle}</span><h2>{title}</h2></div>
      <b>{mode === 'glass' ? 'VIDRIO CLARO' : 'BLANCO OPACO'}</b>
    </header>
    <div className="catalog-frame__scene expanded-frame__scene" data-mode={mode}>{children}</div>
  </article>;
}

function SemanticBadge({ children, tone }: { readonly children: ReactNode; readonly tone: ApexEtherTone }) {
  return <span className="expanded-badge" data-tone={tone}>{children}</span>;
}

interface TrendLine {
  readonly label: string;
  readonly tone: Extract<ApexEtherTone, 'positive' | 'info' | 'warning' | 'danger' | 'emphasis'>;
  readonly values: readonly number[];
}

function TrendChart({ title, lines }: { readonly title: string; readonly lines: readonly TrendLine[] }) {
  const points = (values: readonly number[]) => values.map((value, index) => (
    `${(index / Math.max(1, values.length - 1)) * 300},${104 - value * 82}`
  )).join(' ');
  return <figure className="expanded-trend">
    <figcaption>{title}</figcaption>
    <svg viewBox="0 0 300 112" role="img" aria-label={title}>
      <path d="M0 22H300 M0 63H300 M0 104H300" />
      {lines.map(line => <polyline key={line.label} points={points(line.values)} data-tone={line.tone} />)}
    </svg>
    <div>{lines.map(line => <span key={line.label} data-tone={line.tone}>{line.label}</span>)}</div>
  </figure>;
}

function TimingView({ mode }: { readonly mode: ApexEtherSurfaceMode }) {
  const splits = [
    ['S1', '24.812', '24.930', '−0.118', 'positive'],
    ['S2', '27.440', '27.824', '−0.384', 'positive'],
    ['S3', '26.901', '26.744', '+0.157', 'danger'],
  ] as const;
  return <div className="expanded-layout expanded-layout--timing">
    <ApexEtherSurface title="Vuelta activa" eyebrow="Cronometraje" mode={mode} className="expanded-timing-now">
      <ApexEtherMetric label="Tiempo" value="01:24.560" tone="emphasis" />
      <ApexEtherMetric label="Delta acumulado" value="−0.345" unit="s" tone="positive" detail="Respecto de tu mejor vuelta" />
      <ApexEtherProgress label="Puntos de control" value={0.7} valueLabel="7 / 10" detail="Sector 3 · entrada" tone="emphasis" />
    </ApexEtherSurface>
    <ApexEtherSurface title="Parciales" eyebrow="Actual / referencia" mode={mode} className="expanded-splits">
      <ApexEtherPanelList label="Parciales de la vuelta">
        {splits.map(([sector, current, best, delta, tone], index) => <ApexEtherPanelRow
          key={sector}
          leading={sector}
          label={`${current} · ref. ${best}`}
          value={delta}
          active={index === 2}
          tone={tone}
        />)}
      </ApexEtherPanelList>
    </ApexEtherSurface>
    <ApexEtherSurface title="Historial de sesión" eyebrow="Persistencia local" mode={mode} className="expanded-records">
      <ApexEtherMetricGrid columns={2}>
        <ApexEtherMetric label="Mejor" value="01:18.732" tone="info" />
        <ApexEtherMetric label="Última" value="01:19.077" />
      </ApexEtherMetricGrid>
      <ApexEtherPanelList label="Datos del récord">
        <ApexEtherPanelRow label="Registro" value="01 AGO · 18:42" tone="info" />
        <ApexEtherPanelRow label="Vuelta" value="2 / 8" />
        <ApexEtherPanelRow label="Estado" value="Válida" tone="positive" />
      </ApexEtherPanelList>
    </ApexEtherSurface>
  </div>;
}

const wheelStates = [
  { id: 'FL', load: '4,2 kN', slip: '2,8% · 1,4°', tone: 'positive', position: 'front-left' },
  { id: 'FR', load: '4,5 kN', slip: '3,1% · 1,8°', tone: 'positive', position: 'front-right' },
  { id: 'RL', load: '3,8 kN', slip: '11,2% · 5,7°', tone: 'warning', position: 'rear-left' },
  { id: 'RR', load: '3,7 kN', slip: '4,8% · 2,3°', tone: 'info', position: 'rear-right' },
] as const;

function ContactMap() {
  return <div className="expanded-contact-map" aria-label="Contacto de las cuatro ruedas">
    <div className="expanded-contact-map__vehicle"><i /><i /><i /></div>
    {wheelStates.map(wheel => <article key={wheel.id} data-position={wheel.position} data-tone={wheel.tone}>
      <strong>{wheel.id}</strong><span>{wheel.load}</span><small>{wheel.slip}</small>
    </article>)}
  </div>;
}

function DynamicsView({ mode }: { readonly mode: ApexEtherSurfaceMode }) {
  return <div className="expanded-layout expanded-layout--dynamics">
    <ApexEtherSurface title="Contacto y carga" eyebrow="Vista del vehículo" mode={mode} className="expanded-contact">
      <ContactMap />
    </ApexEtherSurface>
    <ApexEtherSurface title="Dinámica instantánea" eyebrow="Valores de decisión" mode={mode} className="expanded-dynamics-summary">
      <ApexEtherMetricGrid columns={2}>
        <ApexEtherMetric label="Dirección" value="+7,0" unit="°" tone="info" />
        <ApexEtherMetric label="Carga total" value="16,2" unit="kN" />
        <ApexEtherMetric label="Slip máximo" value="11,2" unit="%" tone="warning" />
        <ApexEtherMetric label="Apoyo" value="4 / 4" tone="positive" />
      </ApexEtherMetricGrid>
    </ApexEtherSurface>
    <ApexEtherSurface title="Evolución del contacto" eyebrow="Ventana corta" mode={mode} className="expanded-slip-trend">
      <TrendChart title="Slip por rueda" lines={[
        { label: 'FL', tone: 'positive', values: [.21, .26, .31, .29, .34, .30, .28] },
        { label: 'FR', tone: 'info', values: [.18, .22, .25, .28, .33, .36, .31] },
        { label: 'RL', tone: 'warning', values: [.28, .35, .48, .61, .73, .65, .58] },
        { label: 'RR', tone: 'danger', values: [.14, .20, .28, .24, .35, .41, .37] },
      ]} />
    </ApexEtherSurface>
  </div>;
}

function TireEnergyView({ mode }: { readonly mode: ApexEtherSurfaceMode }) {
  const energy = [
    ['FL', '1,18 kW', '42,6 kJ', .42, 'positive'],
    ['FR', '1,34 kW', '46,1 kJ', .48, 'info'],
    ['RL', '3,86 kW', '92,8 kJ', .82, 'warning'],
    ['RR', '1,72 kW', '55,4 kJ', .55, 'positive'],
  ] as const;
  return <div className="expanded-layout expanded-layout--tires">
    <ApexEtherSurface title="Energía de neumáticos" eyebrow="Disipación instantánea" mode={mode} className="expanded-energy">
      <div className="expanded-energy-grid">{energy.map(([id, power, total, level, tone]) => <article key={id} data-tone={tone}>
        <strong>{id}</strong><span>{power}</span><small>Acumulada · {total}</small>
        <ApexEtherProgress label="Intensidad" value={level} tone={tone} />
      </article>)}</div>
    </ApexEtherSurface>
    <ApexEtherSurface title="Recorrido de suspensión" eyebrow="Compresión / extensión" mode={mode} className="expanded-suspension">
      <ApexEtherProgress label="Delantera izquierda" value={.58} valueLabel="58%" tone="info" />
      <ApexEtherProgress label="Delantera derecha" value={.64} valueLabel="64%" tone="info" />
      <ApexEtherProgress label="Trasera izquierda" value={.83} valueLabel="83%" tone="warning" detail="Cerca del límite operativo" />
      <ApexEtherProgress label="Trasera derecha" value={.61} valueLabel="61%" tone="positive" />
    </ApexEtherSurface>
    <ApexEtherSurface title="Ventana operativa" eyebrow="Configuración activa" mode={mode} className="expanded-tire-operating">
      <ApexEtherMetricGrid columns={2}>
        <ApexEtherMetric label="Compuesto" value="Semi-slick" variant="hero" />
        <ApexEtherMetric label="Modelo" value="TMeasy V1" variant="hero" />
        <ApexEtherMetric label="Presión" value="30,0" unit="psi" tone="positive" />
        <ApexEtherMetric label="Temperatura" value="85" unit="°C" tone="positive" />
        <ApexEtherMetric label="Escala de grip" value="1,06" unit="×" tone="info" />
        <ApexEtherMetric label="Contactos" value="8 / rueda" />
      </ApexEtherMetricGrid>
    </ApexEtherSurface>
  </div>;
}

function PowertrainView({ mode }: { readonly mode: ApexEtherSurfaceMode }) {
  return <div className="expanded-layout expanded-layout--powertrain">
    <ApexEtherSurface title="Transmisión" eyebrow="Acoplamiento" mode={mode} className="expanded-transmission">
      <div className="expanded-state-heading"><SemanticBadge tone="positive">Acoplado</SemanticBadge><strong>Marcha 4</strong></div>
      <ApexEtherProgress label="Embrague" value={.94} valueLabel="94%" tone="positive" detail="Entrega estable" />
      <ApexEtherMetricGrid columns={2}>
        <ApexEtherMetric label="RPM" value="6.840" tone="emphasis" />
        <ApexEtherMetric label="Cambio" value="Listo" tone="positive" />
      </ApexEtherMetricGrid>
    </ApexEtherSurface>
    <ApexEtherSurface title="Entrega de par" eyebrow="Solicitado / aplicado" mode={mode} className="expanded-torque">
      <ApexEtherMetricGrid columns={2}>
        <ApexEtherMetric label="Motor solicitado" value="742" unit="Nm" />
        <ApexEtherMetric label="Motor entregado" value="718" unit="Nm" tone="positive" />
      </ApexEtherMetricGrid>
      <ApexEtherProgress label="Eje delantero" value={.45} valueLabel="45%" tone="info" />
      <ApexEtherProgress label="Eje trasero" value={.55} valueLabel="55%" tone="emphasis" />
    </ApexEtherSurface>
    <ApexEtherSurface title="Carga aerodinámica" eyebrow="Alta velocidad" mode={mode} className="expanded-aero">
      <ApexEtherMetricGrid columns={2}>
        <ApexEtherMetric label="Arrastre" value="1,42" unit="kN" />
        <ApexEtherMetric label="Carga total" value="3,86" unit="kN" />
        <ApexEtherMetric label="Balance delantero" value="42" unit="%" tone="info" />
        <ApexEtherMetric label="Balance trasero" value="58" unit="%" tone="emphasis" />
      </ApexEtherMetricGrid>
    </ApexEtherSurface>
  </div>;
}

function PredictiveRoute() {
  return <figure className="expanded-predictive-route">
    <svg viewBox="0 0 320 260" role="img" aria-label="Ruta predictiva y próxima acción">
      <path d="M54 244 C48 190 94 185 104 143 C116 92 72 64 105 27 C139 -9 220 25 218 83 C216 136 167 142 178 191 C187 230 239 220 270 180" />
      <circle cx="104" cy="143" r="8" data-tone="warning" />
      <circle cx="178" cy="191" r="8" data-tone="info" />
      <polygon points="54,223 43,247 65,247" />
    </svg>
    <div><SemanticBadge tone="warning">Frenada · 86 m</SemanticBadge><SemanticBadge tone="info">Vértice · derecha</SemanticBadge></div>
  </figure>;
}

function CommandBars() {
  return <div className="expanded-commands">
    <ApexEtherProgress label="Acelerador" value={.74} valueLabel="74%" tone="emphasis" />
    <ApexEtherProgress label="Freno" value={.18} valueLabel="18%" tone="danger" />
    <ApexEtherProgress label="Dirección" value={.58} valueLabel="+8,4°" tone="info" />
  </div>;
}

function AutonomousView({ mode }: { readonly mode: ApexEtherSurfaceMode }) {
  return <div className="expanded-layout expanded-layout--autonomous">
    <ApexEtherSurface title="Estrategia autónoma" eyebrow="Próxima decisión" mode={mode} className="expanded-ai-decision">
      <div className="expanded-state-heading"><SemanticBadge tone="positive">Asistencia activa</SemanticBadge><strong>Vuelta aprendida 6</strong></div>
      <ApexEtherMetricGrid columns={2}>
        <ApexEtherMetric label="Velocidad" value="278" unit="km/h" />
        <ApexEtherMetric label="Objetivo" value="264" unit="km/h" tone="warning" />
        <ApexEtherMetric label="Fase" value="Entrada" variant="hero" tone="info" />
        <ApexEtherMetric label="Margen" value="86" unit="m" tone="warning" />
      </ApexEtherMetricGrid>
    </ApexEtherSurface>
    <ApexEtherSurface title="Lectura predictiva" eyebrow="140 m por delante" mode={mode} className="expanded-ai-route">
      <PredictiveRoute />
    </ApexEtherSurface>
    <ApexEtherSurface title="Comandos aplicados" eyebrow="Salida del controlador" mode={mode} className="expanded-ai-commands">
      <CommandBars />
      <ApexEtherPanelList label="Estado de control">
        <ApexEtherPanelRow label="Línea deseada" value="+0,32 m" tone="info" />
        <ApexEtherPanelRow label="Error lateral" value="0,18 m" tone="positive" />
        <ApexEtherPanelRow label="Mirada adelante" value="42,0 m" />
      </ApexEtherPanelList>
    </ApexEtherSurface>
  </div>;
}

function LearningView({ mode }: { readonly mode: ApexEtherSurfaceMode }) {
  const rows = Array.from({ length: 10 }, (_, index) => {
    const current = 6.82 + index * .17;
    const delta = index === 6 ? .21 : index % 3 === 0 ? -.12 : -.04;
    return {
      id: `S${index + 1}`,
      current: current.toFixed(3),
      best: (current - delta).toFixed(3),
      delta: `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(3)}`,
      tone: delta > 0 ? 'danger' : 'positive',
      active: index === 6,
    } as const;
  });
  return <div className="expanded-layout expanded-layout--learning">
    <ApexEtherSurface title="Aprendizaje por zona" eyebrow="Memoria de conducción" mode={mode} className="expanded-learning-zone">
      <div className="expanded-state-heading"><SemanticBadge tone="info">Zona 7 / 10</SemanticBadge><strong>Validada</strong></div>
      <ApexEtherMetricGrid columns={2}>
        <ApexEtherMetric label="Mínima validada" value="214" unit="km/h" tone="positive" />
        <ApexEtherMetric label="Máxima validada" value="238" unit="km/h" tone="info" />
        <ApexEtherMetric label="Próximo objetivo" value="242" unit="km/h" tone="emphasis" />
        <ApexEtherMetric label="Potencial" value="0,18" unit="s" tone="positive" />
      </ApexEtherMetricGrid>
      <ApexEtherProgress label="Cobertura aprendida" value={.84} valueLabel="84%" tone="info" detail="6 vueltas limpias" />
    </ApexEtherSurface>
    <ApexEtherSurface title="Parciales de aprendizaje" eyebrow="10 segmentos" mode={mode} className="expanded-learning-splits">
      <ApexEtherPanelList label="Tiempos por segmento">
        {rows.map(row => <ApexEtherPanelRow key={row.id} leading={row.id} label={`${row.current} · ref. ${row.best}`} value={row.delta} tone={row.tone} active={row.active} />)}
      </ApexEtherPanelList>
    </ApexEtherSurface>
    <ApexEtherSurface title="Calidad de aprendizaje" eyebrow="Sesión actual" mode={mode} className="expanded-learning-quality">
      <ApexEtherMetricGrid columns={2}>
        <ApexEtherMetric label="Pasadas limpias" value="18" tone="positive" />
        <ApexEtherMetric label="Incidentes" value="2" tone="warning" />
        <ApexEtherMetric label="Vuelta actual" value="01:19.077" />
        <ApexEtherMetric label="Mejor" value="01:18.732" tone="info" />
      </ApexEtherMetricGrid>
      <ApexEtherPanelList label="Estado de memoria">
        <ApexEtherPanelRow label="Ghost" value="Disponible" tone="positive" />
        <ApexEtherPanelRow label="Base" value="Confirmada" tone="info" />
        <ApexEtherPanelRow label="Optimización" value="En progreso" tone="emphasis" />
      </ApexEtherPanelList>
    </ApexEtherSurface>
  </div>;
}

function RuntimeView({ mode }: { readonly mode: ApexEtherSurfaceMode }) {
  return <div className="expanded-layout expanded-layout--runtime">
    <ApexEtherSurface title="Rendimiento del runtime" eyebrow="Presupuesto de frame" mode={mode} className="expanded-runtime-primary">
      <ApexEtherMetricGrid columns={4}>
        <ApexEtherMetric label="FPS" value="118" tone="positive" />
        <ApexEtherMetric label="Frame" value="8,47" unit="ms" tone="positive" />
        <ApexEtherMetric label="P95" value="11,80" unit="ms" tone="info" />
        <ApexEtherMetric label="Máximo" value="19,24" unit="ms" tone="warning" />
      </ApexEtherMetricGrid>
      <div className="expanded-budget-grid">
        <ApexEtherProgress label="Simulación" value={2.1 / 16.67} valueLabel="2,10 ms" tone="positive" />
        <ApexEtherProgress label="Neumático visual" value={1.2 / 16.67} valueLabel="1,20 ms" tone="info" />
        <ApexEtherProgress label="Preparación de render" value={3.8 / 16.67} valueLabel="3,80 ms" tone="emphasis" />
        <ApexEtherProgress label="Escena e interfaz" value={1.37 / 16.67} valueLabel="1,37 ms" tone="positive" />
      </div>
    </ApexEtherSurface>
    <ApexEtherSurface title="Salud de ejecución" eyebrow="Diagnóstico" mode={mode} className="expanded-runtime-health">
      <div className="expanded-runtime-badges"><SemanticBadge tone="positive">360 Hz</SemanticBadge><SemanticBadge tone="info">WASM</SemanticBadge><SemanticBadge tone="emphasis">WebGPU</SemanticBadge></div>
      <ApexEtherPanelList label="Estado del runtime">
        <ApexEtherPanelRow label="Backend de neumáticos" value="Compilado" tone="positive" />
        <ApexEtherPanelRow label="Contactos evaluados" value="32 / 32" tone="positive" />
        <ApexEtherPanelRow label="Saltos recientes" value="1" tone="warning" />
        <ApexEtherPanelRow label="Diagnóstico" value="Estable" tone="positive" />
      </ApexEtherPanelList>
    </ApexEtherSurface>
    <ApexEtherSurface title="Contexto de conducción" eyebrow="Sistemas disponibles" mode={mode} className="expanded-context">
      <ApexEtherPanelList label="Contexto de ejecución">
        <ApexEtherPanelRow label="Entorno" value="Altas Cumbres" tone="info" />
        <ApexEtherPanelRow label="Cámara" value="Exterior dinámica" />
        <ApexEtherPanelRow label="Audio de motor" value="18%" />
        <ApexEtherPanelRow label="Control" value="Conectado" tone="positive" />
        <ApexEtherPanelRow label="Asistencia" value="Disponible" tone="info" />
      </ApexEtherPanelList>
    </ApexEtherSurface>
  </div>;
}

export function ExpandedCatalog() {
  const query = new URLSearchParams(window.location.search);
  const [mode, setMode] = useState<ApexEtherSurfaceMode>(query.get('mode') === 'solid' ? 'solid' : 'glass');
  const requestedPanel = query.get('panel');
  const concepts = [
    { id: 'timing', title: 'Cronometraje profundo', subtitle: 'Vuelta · checkpoints · récords', background: 'night', content: <TimingView mode={mode} /> },
    { id: 'dynamics', title: 'Dinámica y contacto', subtitle: 'Carga · slip · apoyo', background: 'mountain', content: <DynamicsView mode={mode} /> },
    { id: 'tires', title: 'Neumáticos y suspensión', subtitle: 'Energía · recorrido · ventana operativa', background: 'night', content: <TireEnergyView mode={mode} /> },
    { id: 'powertrain', title: 'Transmisión y aerodinámica', subtitle: 'Acoplamiento · par · carga', background: 'mountain', content: <PowertrainView mode={mode} /> },
    { id: 'autonomous', title: 'Estrategia autónoma', subtitle: 'Decisión · anticipación · comandos', background: 'night', content: <AutonomousView mode={mode} /> },
    { id: 'learning', title: 'Aprendizaje y parciales', subtitle: 'Zonas · memoria · calidad', background: 'mountain', content: <LearningView mode={mode} /> },
    { id: 'runtime', title: 'Runtime y contexto', subtitle: 'Frame-time · backend · sistemas', background: 'night', content: <RuntimeView mode={mode} /> },
  ] as const;
  const visibleConcepts = requestedPanel
    ? concepts.filter(concept => concept.id === requestedPanel)
    : concepts;
  useEffect(() => {
    if (window.location.hash !== '#expanded-catalog') return;
    window.requestAnimationFrame(() => document.getElementById('expanded-catalog')?.scrollIntoView());
  }, []);
  return <section id="expanded-catalog" className="expanded-catalog">
    <header className="expanded-catalog__header">
      <div><span>Biblioteca de telemetría</span><h2>Una vista clara para cada decisión</h2><p>Cronometraje, dinámica, neumáticos, potencia, asistencia y rendimiento organizados en composiciones especializadas.</p></div>
      <div className="expanded-mode-switch" role="group" aria-label="Apariencia de los paneles recuperados">
        <button type="button" data-active={mode === 'glass' || undefined} onClick={() => setMode('glass')}>Glass</button>
        <button type="button" data-active={mode === 'solid' || undefined} onClick={() => setMode('solid')}>Opaco</button>
      </div>
    </header>
    <div className="catalog-frames expanded-catalog__frames">
      {visibleConcepts.map(concept => <ConceptFrame
        key={concept.id}
        title={concept.title}
        subtitle={concept.subtitle}
        mode={mode}
        background={concept.background}
      >{concept.content}</ConceptFrame>)}
    </div>
  </section>;
}
