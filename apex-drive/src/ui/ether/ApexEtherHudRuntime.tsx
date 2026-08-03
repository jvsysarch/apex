import type { ApexVehicleState } from '@jvsysarch/apex-physics';
import {
  ApexEtherLocaleProvider,
  ApexEtherMovable,
  ApexEtherPosition,
  ApexEtherRaceClock,
  ApexEtherRoute,
  ApexEtherSpeed,
  ApexEtherSurface,
  ApexEtherVehicleDiagram,
  ApexEtherWheelContactGrid,
  type ApexEtherContactWheel,
  type ApexEtherLocale,
  type ApexEtherRace,
  type ApexEtherRoutePoint,
  type ApexEtherSurfaceMode,
  type ApexEtherTone,
} from '@jvsysarch/apex-ether';
import { createRoot, type Root } from 'react-dom/client';
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { LapTimingState } from '../../race/ApexLapTimer';
import { ApexHudAdapter } from './ApexHudAdapter';
import type {
  ApexHudRaceSnapshot,
  ApexHudSessionInput,
  ApexHudSlice,
  ApexHudState,
  ApexHudTrackPoint,
} from './ApexHudContract';
import {
  demandForApexHudPreferences,
  type ApexHudPreferences,
  readApexHudPreferences,
  writeApexHudPreferences,
} from './ApexHudPreferences';
import { ApexHudStore } from './ApexHudStore';
import '@jvsysarch/apex-ether/styles.css';
import './apex-ether-drive.css';

/**
 * Apex Drive's only Ether-specific code is this bridge. Physics snapshots stay
 * in the Drive adapter; presentation uses the public React components from
 * @jvsysarch/apex-ether and contains no simulation knowledge.
 */
const StoreContext = createContext<ApexHudStore | null>(null);

const readEtherLocale = (): ApexEtherLocale => {
  const requested = new URLSearchParams(window.location.search).get('lang');
  if (requested === 'es' || requested === 'en') return requested;
  return localStorage.getItem('apex-ether.locale') === 'en' ? 'en' : 'es';
};

const etherText = (locale: ApexEtherLocale, es: string, en: string): string => locale === 'en' ? en : es;

const useDriveSlice = <K extends ApexHudSlice>(slice: K): ApexHudState[K] | undefined => {
  const store = useContext(StoreContext);
  if (!store) throw new Error('Apex Ether Drive bridge requires a store.');
  const subscribe = useCallback((listener: () => void) => store.subscribe(slice, listener), [slice, store]);
  const snapshot = useCallback(() => store.getSnapshot(slice), [slice, store]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
};

const formatTime = (milliseconds?: number): string => {
  if (milliseconds === undefined || !Number.isFinite(milliseconds)) return '—:——.———';
  const safe = Math.max(0, milliseconds);
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor(safe % 60_000 / 1_000);
  const millis = Math.floor(safe % 1_000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
};

const mapRace = (race: ApexHudRaceSnapshot): ApexEtherRace => Object.freeze({
  position: 1,
  entrants: 1,
  lap: race.lapNumber,
  lapCount: Math.max(race.lapNumber, race.completedLapCount + 1),
  elapsed: formatTime(race.elapsedMs),
  bestLap: formatTime(race.bestLapMs),
  delta: race.lapDeltaMs === undefined ? undefined : `${race.lapDeltaMs <= 0 ? '−' : '+'}${(Math.abs(race.lapDeltaMs) / 1_000).toFixed(3)}`,
  deltaTone: race.lapDeltaMs === undefined ? 'neutral' : race.lapDeltaMs <= 0 ? 'positive' : 'danger',
  sector: Math.max(1, race.sectorIndex + 1),
  sectorCount: Math.max(1, race.sectorCount),
});

const normalizedRoute = (
  points: readonly ApexHudTrackPoint[] | undefined,
): readonly ApexEtherRoutePoint[] => {
  if (!points || points.length < 2) return [];
  const xs = points.map(point => point.x);
  const zs = points.map(point => point.z);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minZ = Math.min(...zs); const maxZ = Math.max(...zs);
  const width = Math.max(1, maxX - minX); const height = Math.max(1, maxZ - minZ);
  return Object.freeze(points.map(point => Object.freeze({
    x: 18 + ((point.x - minX) / width) * 144,
    y: 162 - ((point.z - minZ) / height) * 144,
  })));
};

const MotionPanel = memo(({ mode }: { readonly mode: ApexEtherSurfaceMode }) => {
  const motion = useDriveSlice('motion');
  const session = useDriveSlice('session');
  if (!motion || !session) return null;
  return <ApexEtherSpeed mode={mode} motion={{ ...motion, maximumRpm: session.maximumRpm }} />;
});

const RacePanels = memo(({ mode, showTiming, showStatus }: { readonly mode: ApexEtherSurfaceMode; readonly showTiming: boolean; readonly showStatus: boolean }) => {
  const race = useDriveSlice('race');
  if (!race || race.hudVisibility === 'hidden') return null;
  const view = mapRace(race);
  return <>
    {showTiming ? <ApexEtherMovable storageKey="apex-drive.ether.race-timing.position" className="apex-drive-ether__timing-panel"><ApexEtherRaceClock mode={mode} race={view} /></ApexEtherMovable> : null}
    {showStatus ? <ApexEtherMovable storageKey="apex-drive.ether.race-status.position" className="apex-drive-ether__status-panel"><ApexEtherPosition mode={mode} race={view} /></ApexEtherMovable> : null}
  </>;
});

const DriveRoute = memo(({ mode }: { readonly mode: ApexEtherSurfaceMode }) => {
  const session = useDriveSlice('session');
  const points = useMemo(() => normalizedRoute(session?.trackPoints), [session]);
  if (!session) return null;
  return <ApexEtherRoute mode={mode} points={points} />;
});

const VehiclePanel = memo(({
  mode,
  showDiagram,
  showWheelStatus,
}: {
  readonly mode: ApexEtherSurfaceMode;
  readonly showDiagram: boolean;
  readonly showWheelStatus: boolean;
}) => {
  const vehicle = useDriveSlice('vehicle');
  if (!vehicle) return null;
  const wheels: readonly ApexEtherContactWheel[] = vehicle.wheels.map(wheel => {
    const slipSeverity = Math.max(
      wheel.slipRatioPercent,
      wheel.slipAngleDegrees * 4,
    );
    const tone: ApexEtherTone = !wheel.grounded || slipSeverity >= 18
      ? 'danger'
      : slipSeverity >= 10
        ? 'warning'
        : slipSeverity >= 5
          ? 'info'
          : 'positive';
    return Object.freeze({
      id: wheel.id,
      loadKn: wheel.loadKn,
      gripPercent: Math.max(0, Math.min(100, 100 - slipSeverity)),
      slipPercent: wheel.slipRatioPercent,
      steeringAngleDeg: wheel.steeringAngleDegrees,
      compression: wheel.compression,
      tone,
    });
  });
  return <>
    {showDiagram ? <ApexEtherMovable
      storageKey="apex-drive.ether.vehicle-diagram.position"
      className="apex-drive-ether__vehicle-diagram"
    >
      <ApexEtherVehicleDiagram mode={mode} wheels={wheels} />
    </ApexEtherMovable> : null}
    {showWheelStatus ? <ApexEtherMovable
      storageKey="apex-drive.ether.wheel-status.position"
      className="apex-drive-ether__contact"
    >
      <ApexEtherWheelContactGrid mode={mode} wheels={wheels} />
    </ApexEtherMovable> : null}
  </>;
});

const Identity = memo(() => {
  const session = useDriveSlice('session');
  if (!session) return null;
  return <header className="apex-drive-ether-identity__content"><span>{session.vehicleName}</span><strong>{session.trackName}</strong><em>{session.trackIdentity}</em></header>;
});

const apexPhysicsUrl = (repositoryUrl: string): string => `${repositoryUrl.replace(/\/$/, '')}/tree/main/packages/apex-physics`;

const Authorship = memo(({ controls, locale }: { readonly controls: ApexEtherHudControls; readonly locale: ApexEtherLocale }) => (
  <footer className="apex-drive-ether-authorship" aria-label={etherText(locale, 'Autoría y enlaces del proyecto', 'Project authorship and links')}>
    <span>© <strong>Jonathan Villaverde</strong> 2026</span>
    <a href={controls.linkedinUrl} target="_blank" rel="author noopener noreferrer">LinkedIn ↗</a>
    <a href={apexPhysicsUrl(controls.repositoryUrl)} target="_blank" rel="noopener noreferrer">Apex Physics ↗</a>
  </footer>
));

const About = memo(({ controls, locale }: { readonly controls: ApexEtherHudControls; readonly locale: ApexEtherLocale }) => {
  const t = (es: string, en: string) => etherText(locale, es, en);
  const supportingComponents = [
    { name: 'Apex Ether', status: t('HUD ESPECIALIZADO', 'SPECIALIZED HUD'), description: t('Sistema visual React para HUD y telemetría. Consume estados normalizados de Drive, actualiza paneles de forma selectiva y permanece fuera del loop físico y del render de la escena.', 'React visual system for HUD and telemetry. It consumes normalized Drive state, updates panels selectively and remains outside both the physics loop and scene rendering.') },
    { name: 'Apex Car', status: t('PAQUETE ACTIVO', 'ACTIVE PACKAGE'), description: t('Define vehículos concretos, dimensiones, tren motriz, ruedas y perfiles físicos sin introducir esas decisiones dentro del núcleo genérico.', 'Defines concrete vehicles, dimensions, powertrain, wheels and physical profiles without moving those decisions into the generic core.') },
    { name: 'Apex Contracts', status: t('PAQUETE ACTIVO', 'ACTIVE PACKAGE'), description: t('Contratos compartidos y Command Bus tipado para mutaciones explícitas. La telemetría permanece en un canal separado y de solo lectura.', 'Shared contracts and a typed Command Bus for explicit mutations. Telemetry remains on a separate read-only channel.') },
    { name: 'Apex Track', status: t('EN EXTRACCIÓN', 'BEING EXTRACTED'), description: t('Formatos, superficies, generación, importación y edición de pistas. Su implementación principal todavía está integrada en Drive.', 'Track formats, surfaces, generation, import and editing. Its main implementation is still integrated into Drive.') },
    { name: 'Apex Render', status: t('EN EXTRACCIÓN', 'BEING EXTRACTED'), description: t('Escena, cámaras, iluminación, perfiles visuales y diagnóstico de frame pacing sobre WebGPU.', 'Scene, cameras, lighting, visual profiles and frame-pacing diagnostics on WebGPU.') },
    { name: 'Apex Audio', status: t('PAQUETE ACTIVO', 'ACTIVE PACKAGE'), description: t('Síntesis y presentación sonora derivadas del estado de la simulación, sin adquirir autoridad sobre la física.', 'Sound synthesis and presentation derived from simulation state without acquiring authority over physics.') },
    { name: 'Apex Assets', status: t('PAQUETE ACTIVO', 'ACTIVE PACKAGE'), description: t('Activos auditados, convenciones y recursos compartidos consumidos por las aplicaciones del ecosistema.', 'Audited assets, conventions and shared resources consumed by ecosystem applications.') },
    { name: 'Apex Mesh', status: t('EXPERIMENTAL', 'EXPERIMENTAL'), description: t('Herramientas para importar, inspeccionar y preparar assets 3D y especificaciones de vehículos.', 'Tools for importing, inspecting and preparing 3D assets and vehicle specifications.') },
    { name: 'Apex Void', status: t('INICIAL', 'INITIAL'), description: t('Frontera de persistencia configurable por dominio. No es la simulación, el mundo físico ni una base de datos de negocio.', 'Configurable domain-oriented persistence boundary. It is not the simulation, physical world or a business database.') },
    { name: 'Apex Wheel', status: t('FRONTERA FUTURA', 'FUTURE BOUNDARY'), description: t('Separación prevista para rueda, neumático y contacto; hoy esos modelos permanecen bajo la autoridad de Apex Physics.', 'Planned boundary for wheel, tire and contact; those models currently remain under Apex Physics authority.') },
    { name: 'Apex Showcase', status: t('PRESENTACIÓN', 'PRESENTATION'), description: t('Sitio editorial y documentación pública del ecosistema. No ejecuta ni define el runtime de Drive.', 'Editorial site and public ecosystem documentation. It neither runs nor defines the Drive runtime.') },
  ] as const;

  return <div className="apex-drive-ether-about">
    <header><span>APEX ECOSYSTEM</span><h3>{t('Qué es Apex Drive', 'What Apex Drive is')}</h3></header>
    <p className="apex-drive-ether-about__lead">{t(
      'Apex Physics es el centro de gravedad técnico del ecosistema y conserva la autoridad absoluta sobre la simulación. Apex Drive es su expresión funcional: el producto jugable que compone Physics con vehículos, pistas, render, audio, HUD y herramientas. Ether es una pieza importante de esa composición, pero su responsabilidad específica es representar telemetría; no es el motor del sistema.',
      'Apex Physics is the technical center of gravity of the ecosystem and retains absolute authority over simulation. Apex Drive is its functional expression: the playable product composing Physics with vehicles, tracks, rendering, audio, HUD and tools. Ether is an important part of that composition, but its specific responsibility is presenting telemetry; it is not the system engine.',
    )}</p>

    <section className="apex-drive-ether-about__core" aria-label={t('Componentes principales', 'Core components')}>
      <article>
        <small>{t('NÚCLEO DEL SISTEMA · AUTORIDAD FÍSICA', 'SYSTEM CORE · PHYSICS AUTHORITY')}</small>
        <h4>Apex Physics</h4>
        <p>{t('Núcleo headless reutilizable. Jolt resuelve cuerpos rígidos, contactos, colisiones, constraints e integración; Apex agrega la orquestación del vehículo a 360 Hz, neumáticos, superficies, aerodinámica, asistencias y snapshots numéricos.', 'Reusable headless core. Jolt resolves rigid bodies, contacts, collisions, constraints and integration; Apex adds 360 Hz vehicle orchestration, tires, surfaces, aerodynamics, assists and numeric snapshots.')}</p>
        <a href={apexPhysicsUrl(controls.repositoryUrl)} target="_blank" rel="noopener noreferrer">GitHub · Apex Physics ↗</a>
      </article>
      <article>
        <small>{t('PRODUCTO FUNCIONAL · COMPOSITION ROOT', 'FUNCTIONAL PRODUCT · COMPOSITION ROOT')}</small>
        <h4>Apex Drive</h4>
        <p>{t('Selecciona el vehículo y la pista, crea el mundo, coordina sesión y carrera, aplica comandos, alimenta audio y render, y adapta estados físicos hacia consumidores como Ether. Drive integra; no absorbe la autoridad interna de cada módulo.', 'Selects vehicle and track, creates the world, coordinates session and race, applies commands, feeds audio and rendering, and adapts physical state for consumers such as Ether. Drive integrates; it does not absorb each module’s internal authority.')}</p>
        <a href={controls.repositoryUrl} target="_blank" rel="noopener noreferrer">GitHub · Apex ↗</a>
      </article>
    </section>

    <section className="apex-drive-ether-about__technology" aria-labelledby="apex-ether-about-technology">
      <header><span>{t('INFRAESTRUCTURA DE EJECUCIÓN', 'EXECUTION INFRASTRUCTURE')}</span><h4 id="apex-ether-about-technology">{t('Cómo se ejecutan Physics y Render', 'How Physics and Render execute')}</h4></header>
      <div className="apex-drive-ether-about__technology-cards">
        <article><strong>WebAssembly · Apex Physics</strong><p>{t('El binding mantenido por Apex ejecuta Jolt y el bridge compilado de fuerzas de neumático dentro del navegador. Aquí viven el solver, los contactos y la integración física; no en React ni en WebGPU.', 'The Apex-maintained binding runs Jolt and the compiled tire-force bridge inside the browser. The solver, contacts and physical integration live here—not in React or WebGPU.')}</p></article>
        <article><strong>WebGPU · Apex Render / Drive</strong><p>{t('THREE.WebGPURenderer dibuja la escena, materiales, iluminación y la deformación visual opcional de cubiertas. Esta capa representa el estado; no calcula la dinámica vehicular ni decide el contacto físico.', 'THREE.WebGPURenderer draws the scene, materials, lighting and optional visual tire deformation. This layer represents state; it does not calculate vehicle dynamics or decide physical contact.')}</p></article>
      </div>
      <div className="apex-drive-ether-about__execution-map" aria-label={t('Jerarquía de ejecución', 'Execution hierarchy')}>
        <strong>Apex Physics<small>Jolt · WASM · 360 Hz</small></strong>
        <b aria-hidden="true">→</b>
        <strong>Apex Drive<small>{t('Producto · sesión · composición', 'Product · session · composition')}</small></strong>
        <b aria-hidden="true">→</b>
        <div>
          <span>Apex Render <small>WebGPU</small></span>
          <span>Apex Audio</span>
          <span>Apex Ether <small>HUD · React</small></span>
        </div>
      </div>
    </section>

    <section className="apex-drive-ether-about__inventory" aria-labelledby="apex-ether-about-inventory">
      <header><span>{t('MAPA COMPLETO', 'COMPLETE MAP')}</span><h4 id="apex-ether-about-inventory">{t('Otras partes del ecosistema', 'Other ecosystem parts')}</h4></header>
      <div>{supportingComponents.map(component => <article key={component.name}><div><strong>{component.name}</strong><small>{component.status}</small></div><p>{component.description}</p></article>)}</div>
    </section>

    <footer className="apex-drive-ether-about__credits">
      <span>© <strong>Jonathan Villaverde</strong> 2026</span>
      <a href={controls.linkedinUrl} target="_blank" rel="author noopener noreferrer">LinkedIn ↗</a>
      <a href={apexPhysicsUrl(controls.repositoryUrl)} target="_blank" rel="noopener noreferrer">Apex Physics ↗</a>
    </footer>
  </div>;
});

export type ApexEtherGrassMaterialLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ApexEtherSurfaceMaterialSettings {
  readonly floorMaterialId: string;
  readonly roadsideMaterialId: string;
  readonly floorRoughness: number;
  readonly roadsideRoughness: number;
  readonly floorNormalStrength: number;
  readonly roadsideNormalStrength: number;
  readonly floorColor: string;
  readonly roadsideColor: string;
  readonly diagnosticFlatColor: boolean;
  readonly wireframe: boolean;
}

const SurfaceMaterialPanel = memo(({
  controls,
  locale,
  onClose,
}: {
  readonly controls: ApexEtherHudControls;
  readonly locale: ApexEtherLocale;
  readonly onClose: () => void;
}) => {
  const [settings, setSettings] = useState(controls.surfaceMaterialSettings);
  const surfacePanelPositionKey = 'apex-drive.ether.surface-material.position';
  const [panelPosition, setPanelPosition] = useState(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(surfacePanelPositionKey) ?? '{}',
      ) as { x?: unknown; y?: unknown };
      return {
        x: typeof stored.x === 'number' ? stored.x : 0,
        y: typeof stored.y === 'number' ? stored.y : 0,
      };
    } catch {
      return { x: 0, y: 0 };
    }
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    x: number;
    y: number;
  } | null>(null);
  const [loadStatuses, setLoadStatuses] = useState<Record<
    string,
    ApexEtherGrassMaterialLoadStatus
  >>({});
  const t = (es: string, en: string) => etherText(locale, es, en);
  useEffect(() => controls.subscribeGrassMaterialStatus((id, status) => {
    setLoadStatuses(current => ({ ...current, [id]: status }));
  }), [controls]);
  const update = (patch: Partial<ApexEtherSurfaceMaterialSettings>) => {
    const next = Object.freeze({ ...settings, ...patch });
    setSettings(next);
    controls.requestSurfaceMaterialSettings(next);
  };
  const statusFor = (id: string) => (
    loadStatuses[id] ?? controls.readGrassMaterialStatus(id)
  );
  const selectedStatuses = [
    statusFor(settings.floorMaterialId),
    statusFor(settings.roadsideMaterialId),
  ];
  const statusText = selectedStatuses.includes('error')
    ? t('Error al cargar uno de los mapas', 'A texture map failed to load')
    : selectedStatuses.includes('loading')
      ? t('Cargando mapas PBR…', 'Loading PBR maps…')
      : t(
        'Color, normal y roughness cargados',
        'Color, normal and roughness loaded',
      );
  const materialOptions = controls.grassMaterialOptions.map(option => (
    <option key={option.id} value={option.id}>{option.name}</option>
  ));
  const beginPanelDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: panelPosition.x,
      y: panelPosition.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    panelRef.current?.setAttribute('data-dragging', 'true');
    event.preventDefault();
  };
  const movePanel = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = {
      x: drag.x + event.clientX - drag.clientX,
      y: drag.y + event.clientY - drag.clientY,
    };
    setPanelPosition(next);
  };
  const finishPanelDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    panelRef.current?.removeAttribute('data-dragging');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    try {
      localStorage.setItem(surfacePanelPositionKey, JSON.stringify(panelPosition));
    } catch { /* Position persistence is optional. */ }
  };
  return <div
    ref={panelRef}
    className="apex-drive-ether-surface-material"
    style={{ transform: `translate3d(${panelPosition.x}px, ${panelPosition.y}px, 0)` }}
  >
    <ApexEtherSurface
      mode="solid"
      className="apex-drive-ether-surface-material__panel"
      ariaLabel={t('Materiales de terreno', 'Terrain materials')}
    >
      <header
        className="apex-drive-ether-surface-material__drag-handle"
        onPointerDown={beginPanelDrag}
        onPointerMove={movePanel}
        onPointerUp={finishPanelDrag}
        onPointerCancel={finishPanelDrag}
        onDoubleClick={() => {
          const origin = { x: 0, y: 0 };
          setPanelPosition(origin);
          try {
            localStorage.setItem(surfacePanelPositionKey, JSON.stringify(origin));
          } catch { /* Position persistence is optional. */ }
        }}
      >
        <div><span>APEX SURFACE</span><strong>{t('Piso y banquina', 'Floor and roadside')}</strong></div>
        <button type="button" onClick={onClose} aria-label={t('Cerrar panel', 'Close panel')}>×</button>
      </header>
      <div className="apex-drive-ether-surface-material__grid">
        <details open>
          <summary>{t('Piso', 'Floor')}</summary>
          <div>
          <label><span>{t('Pasto', 'Grass')}</span><select
            value={settings.floorMaterialId}
            onChange={event => update({ floorMaterialId: event.target.value })}
          >{materialOptions}</select></label>
          <label><span>Roughness</span><div className="apex-drive-ether-surface-material__range"><input
            type="range" min="0" max="1" step="0.02"
            value={settings.floorRoughness}
            onChange={event => update({ floorRoughness: Number(event.target.value) })}
          /><output>{settings.floorRoughness.toFixed(2)}</output></div></label>
          <label><span>{t('Color diagnóstico', 'Diagnostic color')}</span><input
            type="color" value={settings.floorColor}
            onChange={event => update({ floorColor: event.target.value })}
          /></label>
          <label><span>{t('Relieve normal', 'Normal detail')}</span><div className="apex-drive-ether-surface-material__range"><input
            type="range" min="0" max="1" step="0.02"
            value={settings.floorNormalStrength}
            disabled={settings.diagnosticFlatColor}
            onChange={event => update({ floorNormalStrength: Number(event.target.value) })}
          /><output>{settings.floorNormalStrength.toFixed(2)}</output></div></label>
          </div>
        </details>
        <details open>
          <summary>{t('Banquina / talud', 'Roadside / slope')}</summary>
          <div>
          <label><span>{t('Pasto', 'Grass')}</span><select
            value={settings.roadsideMaterialId}
            onChange={event => update({ roadsideMaterialId: event.target.value })}
          >{materialOptions}</select></label>
          <label><span>Roughness</span><div className="apex-drive-ether-surface-material__range"><input
            type="range" min="0" max="1" step="0.02"
            value={settings.roadsideRoughness}
            onChange={event => update({ roadsideRoughness: Number(event.target.value) })}
          /><output>{settings.roadsideRoughness.toFixed(2)}</output></div></label>
          <label><span>{t('Color diagnóstico', 'Diagnostic color')}</span><input
            type="color" value={settings.roadsideColor}
            onChange={event => update({ roadsideColor: event.target.value })}
          /></label>
          <label><span>{t('Relieve normal', 'Normal detail')}</span><div className="apex-drive-ether-surface-material__range"><input
            type="range" min="0" max="1" step="0.02"
            value={settings.roadsideNormalStrength}
            disabled={settings.diagnosticFlatColor}
            onChange={event => update({ roadsideNormalStrength: Number(event.target.value) })}
          /><output>{settings.roadsideNormalStrength.toFixed(2)}</output></div></label>
          </div>
        </details>
      </div>
      <div className="apex-drive-ether-surface-material__diagnostics">
        <label><input type="checkbox" checked={settings.diagnosticFlatColor} onChange={() => update({ diagnosticFlatColor: !settings.diagnosticFlatColor })} /> {t('Color plano + mapa de roughness', 'Flat color + roughness map')}</label>
        <label><input type="checkbox" checked={settings.wireframe} onChange={() => update({ wireframe: !settings.wireframe })} /> Wireframe</label>
        <button type="button" onClick={controls.reloadGrassMaterials}>{t('Recargar mapas', 'Reload maps')}</button>
      </div>
      <footer data-status={selectedStatuses.includes('error') ? 'error' : selectedStatuses.includes('loading') ? 'loading' : 'ready'}>
        <span>{statusText}</span>
        {controls.adaptiveTerrain ? <small>{t(
          'Normal map activo en piso, talud y toe',
          'Normal map active on floor, slope and toe',
        )}</small> : null}
      </footer>
    </ApexEtherSurface>
  </div>;
});

const Settings = memo(({
  preferences,
  locale,
  controls,
  onChange,
  onLocaleChange,
  surfacePanelOpen,
  onToggleSurfacePanel,
}: {
  readonly preferences: ApexHudPreferences;
  readonly locale: ApexEtherLocale;
  readonly controls: ApexEtherHudControls;
  readonly onChange: (value: ApexHudPreferences) => void;
  readonly onLocaleChange: (value: ApexEtherLocale) => void;
  readonly surfacePanelOpen: boolean;
  readonly onToggleSurfacePanel: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<
    'general' | 'visual' | 'hud' | 'about'
  >('visual');
  const t = (es: string, en: string) => etherText(locale, es, en);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  const toggle = (key: Exclude<keyof ApexHudPreferences, 'speedometerMode'>) => onChange(Object.freeze({ ...preferences, [key]: !preferences[key] }));
  return <aside className="apex-drive-ether-settings" data-open={open || undefined}>
    <button className="apex-drive-ether-settings__trigger" type="button" aria-label={t('Abrir administración de Apex Ether', 'Open Apex Ether administration')} aria-expanded={open} onClick={() => setOpen(true)}>
      <svg viewBox="0 0 256 256" aria-hidden="true">
        <path d="M237.94,107.21a8,8,0,0,0-3.89-5.4l-29.83-17-.12-33.62a8,8,0,0,0-2.83-6.08,111.91,111.91,0,0,0-36.72-20.67,8,8,0,0,0-6.46.59L128,41.85,97.88,25a8,8,0,0,0-6.47-.6A111.92,111.92,0,0,0,54.73,45.15a8,8,0,0,0-2.83,6.07l-.15,33.65-29.83,17a8,8,0,0,0-3.89,5.4,106.47,106.47,0,0,0,0,41.56,8,8,0,0,0,3.89,5.4l29.83,17,.12,33.63a8,8,0,0,0,2.83,6.08,111.91,111.91,0,0,0,36.72,20.67,8,8,0,0,0,6.46-.59L128,214.15,158.12,231a7.91,7.91,0,0,0,3.9,1,8.09,8.09,0,0,0,2.57-.42,112.1,112.1,0,0,0,36.68-20.73,8,8,0,0,0,2.83-6.07l.15-33.65,29.83-17a8,8,0,0,0,3.89-5.4A106.47,106.47,0,0,0,237.94,107.21ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z" />
      </svg>
    </button>
    {open ? <div
      className="apex-drive-ether-admin-layer"
      onPointerDown={event => { if (event.target === event.currentTarget) setOpen(false); }}
    >
      <ApexEtherSurface mode="solid" className="apex-drive-ether-admin" ariaLabel={t('Administración de Apex Ether', 'Apex Ether administration')}>
        <header className="apex-drive-ether-admin__header">
          <div>
            <div className="apex-drive-ether-admin__brand">
              <span>APEX ETHER</span>
              <a href="https://jvsysarch.github.io/apex-ether/" target="_blank" rel="noopener noreferrer">About ↗</a>
            </div>
            <h2>{t('Administración', 'Administration')}</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label={t('Cerrar administración', 'Close administration')}>×</button>
        </header>
        <div className="apex-drive-ether-admin__layout">
          <nav aria-label={t('Categorías de configuración', 'Configuration categories')}>
            <button type="button" aria-pressed={activeCategory === 'general'} onClick={() => setActiveCategory('general')}>{t('General', 'General')}</button>
            <button type="button" aria-pressed={activeCategory === 'visual'} onClick={() => setActiveCategory('visual')}>{t('Visual', 'Visual')}</button>
            <button type="button" aria-pressed={activeCategory === 'hud'} onClick={() => setActiveCategory('hud')}>HUD</button>
            <button type="button" aria-pressed={activeCategory === 'about'} onClick={() => setActiveCategory('about')}>About</button>
          </nav>
          <section className="apex-drive-ether-admin__content" aria-live="polite">
            {activeCategory === 'general' ? <>
              <header><span>{t('INTERFAZ', 'INTERFACE')}</span><h3>{t('Idioma', 'Language')}</h3></header>
              <p>{t('Elegí el idioma de todos los paneles y controles de Apex Ether.', 'Choose the language for every Apex Ether panel and control.')}</p>
              <div className="apex-drive-ether-settings__language" role="group" aria-label={t('Idioma', 'Language')}>
                <button type="button" aria-pressed={locale === 'es'} onClick={() => onLocaleChange('es')}>Español</button>
                <button type="button" aria-pressed={locale === 'en'} onClick={() => onLocaleChange('en')}>English</button>
              </div>
            </> : null}
            {activeCategory === 'visual' ? <>
              <header><span>{t('TERRENO', 'TERRAIN')}</span><h3>{t('Inspector de superficies', 'Surface inspector')}</h3></header>
              <p>{t(
                'Abrí un panel flotante para configurar por separado el piso y la banquina o talud.',
                'Open a floating panel to configure the floor and roadside or slope independently.',
              )}</p>
              <button className="apex-drive-ether-settings__surface-toggle" type="button" aria-pressed={surfacePanelOpen} onClick={() => {
                onToggleSurfacePanel();
                setOpen(false);
              }}>{surfacePanelOpen ? t('Ocultar panel de superficies', 'Hide surface panel') : t('Abrir panel de superficies', 'Open surface panel')}</button>
              <button className="apex-drive-ether-settings__surface-toggle" type="button" onClick={() => {
                controls.openScenePanel();
                setOpen(false);
              }}>{t('Abrir iluminación y escena', 'Open lighting and scene')}</button>
            </> : null}
            {activeCategory === 'hud' ? <>
              <header><span>HUD</span><h3>{t('Composición en pantalla', 'On-screen composition')}</h3></header>
              <p>{t('Mostrá únicamente la información necesaria para conducir.', 'Show only the information needed while driving.')}</p>
              <div className="apex-drive-ether-admin__options">
                <label><input type="checkbox" checked={preferences.trackIdentity} onChange={() => toggle('trackIdentity')} /> {t('Contexto de pista', 'Track context')}</label>
                <label><input type="checkbox" checked={preferences.raceTiming} onChange={() => toggle('raceTiming')} /> {t('Tiempo y sectores', 'Timing and sectors')}</label>
                <label><input type="checkbox" checked={preferences.raceStatus} onChange={() => toggle('raceStatus')} /> {t('Estado de vuelta', 'Lap status')}</label>
                <label><input type="checkbox" checked={preferences.trackMap} onChange={() => toggle('trackMap')} /> {t('Ruta', 'Route')}</label>
                <label><input type="checkbox" checked={preferences.vehicleDiagram} onChange={() => toggle('vehicleDiagram')} /> {t('Vista superior del auto', 'Top vehicle view')}</label>
                <label><input type="checkbox" checked={preferences.wheelStatus} onChange={() => toggle('wheelStatus')} /> {t('Estado de las ruedas', 'Wheel status')}</label>
                <label><input type="checkbox" checked={preferences.speedometerMode !== 'off'} onChange={() => onChange(Object.freeze({ ...preferences, speedometerMode: preferences.speedometerMode === 'off' ? 'tachometer' : 'off' }))} /> {t('Velocidad y controles', 'Speed and controls')}</label>
              </div>
            </> : null}
            {activeCategory === 'about' ? <About controls={controls} locale={locale} /> : null}
          </section>
        </div>
      </ApexEtherSurface>
    </div> : null}
  </aside>;
});

const TrackLauncher = memo(({
  locale,
  controls,
}: {
  readonly locale: ApexEtherLocale;
  readonly controls: ApexEtherHudControls;
}) => {
  const [open, setOpen] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState(controls.activeTrackId);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(
    controls.activeEnvironmentProfileId,
  );
  const t = (es: string, en: string) => etherText(locale, es, en);
  const trackToolsLocked = controls.trackToolsLocked;
  useEffect(() => {
    if (!open) return undefined;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  const openTrack = (edit: boolean) => {
    if (trackToolsLocked) return;
    controls.openTrackStudio({
      trackId: selectedTrackId,
      edit,
      environmentProfileId: selectedEnvironmentId,
    });
  };

  return <aside className="apex-drive-ether-tracks" data-open={open || undefined}>
    <button
      className="apex-drive-ether-tracks__trigger"
      type="button"
      aria-label={t('Abrir pistas y paisaje', 'Open tracks and landscapes')}
      aria-expanded={open}
      onClick={() => setOpen(true)}
    >
      <svg viewBox="0 0 256 256" aria-hidden="true">
        <path fillRule="evenodd" d="M128 16c-49.6 0-88 24.7-88 61.8 0 21.8 13.7 40.2 38.5 51.9L51 218.5A16 16 0 0 0 66.3 240h123.4a16 16 0 0 0 15.3-21.5l-27.5-88.8c24.8-11.7 38.5-30.1 38.5-51.9C216 40.7 177.6 16 128 16Zm0 28c34.8 0 60 14.2 60 33.8 0 13-12.5 24.4-34.2 30.6l-12.5 3.6 8.7 28h-44l8.7-28-12.5-3.6C80.5 102.2 68 90.8 68 77.8 68 58.2 93.2 44 128 44Zm-30.7 124h61.4l13.6 44H83.7l13.6-44Z" />
      </svg>
    </button>
    {open ? <div
      className="apex-drive-ether-admin-layer apex-drive-ether-track-layer"
      onPointerDown={event => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <ApexEtherSurface
        mode="solid"
        className="apex-drive-ether-track-admin"
        ariaLabel={t('Pistas y generación de paisaje', 'Tracks and landscape generation')}
      >
        <header className="apex-drive-ether-admin__header">
          <div>
            <span>APEX TRACK STUDIO</span>
            <h2>{t('Pistas y paisaje', 'Tracks and landscapes')}</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label={t('Cerrar', 'Close')}>×</button>
        </header>

        <section className="apex-drive-ether-track-admin__existing">
          <header>
            <span>{t('PISTA ACTIVA', 'ACTIVE TRACK')}</span>
            <h3>{trackToolsLocked
              ? t('Circuito Vector · versión pública', 'Circuito Vector · public version')
              : t('Seleccionar o editar', 'Select or edit')}</h3>
          </header>
          {trackToolsLocked ? <p className="apex-drive-ether-track-admin__lock-note">{t(
            'Selector y editor visibles como anticipo. No están habilitados en esta publicación.',
            'Selector and editor are shown as a preview. They are disabled in this release.',
          )}</p> : null}
          <div>
            <label>
              <span>{t('Pista', 'Track')}</span>
              <select disabled={trackToolsLocked} value={selectedTrackId} onChange={event => setSelectedTrackId(event.target.value)}>
                {controls.trackOptions.map(track => <option key={track.id} value={track.id}>
                  {String(track.number).padStart(3, '0')} · {track.name}
                </option>)}
              </select>
            </label>
            <label>
              <span>{t('Iluminación / HDRI', 'Lighting / HDRI')}</span>
              <select disabled={trackToolsLocked} value={selectedEnvironmentId} onChange={event => setSelectedEnvironmentId(event.target.value)}>
                {controls.environmentOptions.map(environment => <option key={environment.id} value={environment.id}>
                  {environment.name}
                </option>)}
              </select>
            </label>
            <button disabled={trackToolsLocked} type="button" onClick={() => openTrack(false)}>{trackToolsLocked ? t('Vector activo', 'Vector active') : t('Abrir pista', 'Open track')}</button>
            <button disabled={trackToolsLocked} type="button" onClick={() => openTrack(true)}>{t('Editar', 'Edit')}</button>
          </div>
        </section>

        <section className="apex-drive-ether-track-admin__generator">
          <header>
            <span>{t('NUEVA PISTA', 'NEW TRACK')}</span>
            <h3>{t('Generación procedural inicial', 'Initial procedural generation')}</h3>
            <p>{t(
              'Elegí una topología. Cada preset define relieve, material y un HDRI predeterminado; todo queda listo para editarse.',
              'Choose a topology. Each preset defines terrain, material and a default HDRI, ready for editing.',
            )}</p>
          </header>
          <div className="apex-drive-ether-track-admin__presets">
            {controls.landscapeOptions.map(landscape => <article data-disabled={trackToolsLocked || undefined} key={landscape.id}>
              <small>{landscape.region}</small>
              <h4>{landscape.name}</h4>
              <p>{landscape.description}</p>
              <dl>
                <div><dt>{t('Referencia', 'Reference')}</dt><dd>{landscape.routeDataSummary}</dd></div>
                <div><dt>{t('Material', 'Material')}</dt><dd>{landscape.materialName}</dd></div>
                <div><dt>HDRI</dt><dd>{landscape.environmentName}</dd></div>
              </dl>
              <a href={landscape.routeSourceUrl} target="_blank" rel="noopener noreferrer">
                {t('Fuente de calibración ↗', 'Calibration source ↗')}
              </a>
              <button disabled={trackToolsLocked} type="button" onClick={() => controls.openTrackStudio({
                trackId: controls.proceduralTrackId,
                landscapeId: landscape.id,
                environmentProfileId: landscape.environmentProfileId,
                edit: true,
              })}>{trackToolsLocked
                ? t('No disponible en esta versión', 'Not available in this release')
                : t('Crear y editar', 'Create and edit')}</button>
            </article>)}
          </div>
        </section>
      </ApexEtherSurface>
    </div> : null}
  </aside>;
});

const DriveEtherHud = memo(({ initialPreferences, controls, onPreferencesChange }: { readonly initialPreferences: ApexHudPreferences; readonly controls: ApexEtherHudControls; readonly onPreferencesChange: (value: ApexHudPreferences) => void }) => {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [locale, setLocale] = useState<ApexEtherLocale>(readEtherLocale);
  const [surfacePanelOpen, setSurfacePanelOpen] = useState(false);
  const update = useCallback((next: ApexHudPreferences) => { writeApexHudPreferences(next); setPreferences(next); onPreferencesChange(next); }, [onPreferencesChange]);
  const updateLocale = useCallback((next: ApexEtherLocale) => {
    setLocale(next);
    localStorage.setItem('apex-ether.locale', next);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    window.history.replaceState(null, '', url);
  }, []);
  const mode: ApexEtherSurfaceMode = 'glass';
  return <ApexEtherLocaleProvider locale={locale}>
    <main className="apex-drive-ether" data-mode={mode} lang={locale}>
      <TrackLauncher locale={locale} controls={controls} />
      <Settings preferences={preferences} locale={locale} controls={controls} onChange={update} onLocaleChange={updateLocale} surfacePanelOpen={surfacePanelOpen} onToggleSurfacePanel={() => setSurfacePanelOpen(current => !current)} />
      {surfacePanelOpen ? <SurfaceMaterialPanel controls={controls} locale={locale} onClose={() => setSurfacePanelOpen(false)} /> : null}
      <Authorship controls={controls} locale={locale} />
      {preferences.trackIdentity ? <ApexEtherMovable storageKey="apex-drive.ether.track-identity.position" className="apex-drive-ether-identity"><Identity /></ApexEtherMovable> : null}
      <div className="apex-drive-ether__top"><RacePanels mode={mode} showTiming={preferences.raceTiming} showStatus={preferences.raceStatus} /></div>
      {preferences.trackMap ? <ApexEtherMovable storageKey="apex-drive.ether.route.position" className="apex-drive-ether__route"><DriveRoute mode={mode} /></ApexEtherMovable> : null}
      {preferences.vehicleDiagram || preferences.wheelStatus ? <VehiclePanel
        mode={mode}
        showDiagram={preferences.vehicleDiagram}
        showWheelStatus={preferences.wheelStatus}
      /> : null}
      {preferences.speedometerMode !== 'off' ? <ApexEtherMovable storageKey="apex-drive.ether.motion.position" className="apex-drive-ether__motion"><MotionPanel mode={mode} /></ApexEtherMovable> : null}
    </main>
  </ApexEtherLocaleProvider>;
});

export interface ApexEtherHudControls {
  readonly environmentName: string;
  readonly tireDeformationEnabled: boolean;
  readonly requestTireDeformation: (enabled: boolean) => void;
  readonly adaptiveTerrain: boolean;
  readonly surfaceMaterialSettings: ApexEtherSurfaceMaterialSettings;
  readonly grassMaterialOptions: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly requestSurfaceMaterialSettings: (
    settings: ApexEtherSurfaceMaterialSettings,
  ) => void;
  readonly readGrassMaterialStatus: (
    id: string,
  ) => ApexEtherGrassMaterialLoadStatus;
  readonly subscribeGrassMaterialStatus: (listener: (
    id: string,
    status: ApexEtherGrassMaterialLoadStatus,
  ) => void) => () => void;
  readonly reloadGrassMaterials: () => void;
  readonly openScenePanel: () => void;
  readonly repositoryUrl: string;
  readonly linkedinUrl: string;
  readonly documentationUrl: string;
  readonly showcaseUrl: string;
  readonly activeTrackId: string;
  readonly trackToolsLocked: boolean;
  readonly proceduralTrackId: string;
  readonly activeEnvironmentProfileId: string;
  readonly trackOptions: readonly {
    readonly id: string;
    readonly number: number;
    readonly name: string;
  }[];
  readonly environmentOptions: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly landscapeOptions: readonly {
    readonly id: string;
    readonly name: string;
    readonly region: string;
    readonly description: string;
    readonly materialName: string;
    readonly routeDataSummary: string;
    readonly routeSourceUrl: string;
    readonly environmentProfileId: string;
    readonly environmentName: string;
  }[];
  readonly openTrackStudio: (request: {
    readonly trackId: string;
    readonly landscapeId?: string;
    readonly environmentProfileId?: string;
    readonly edit: boolean;
  }) => void;
}

export interface ApexEtherHudRuntime {
  needsPhysicsSnapshot(timestampMs: number): boolean;
  needsRaceSnapshot(): boolean;
  publishPhysics(timestampMs: number, state: ApexVehicleState): void;
  publishRace(timestampMs: number, state: LapTimingState): void;
  dispose(): void;
}

class ApexEtherHudRuntimeImplementation implements ApexEtherHudRuntime {
  private readonly element: HTMLDivElement;
  private readonly root: Root;
  private readonly store = new ApexHudStore();
  private readonly adapter = new ApexHudAdapter(this.store, {
    motionHz: 30,
    statusHz: 10,
  });
  private readonly updatePreferences = (preferences: ApexHudPreferences) => this.adapter.configure(demandForApexHudPreferences(preferences));

  constructor(container: HTMLElement, session: ApexHudSessionInput, controls: ApexEtherHudControls) {
    const preferences = readApexHudPreferences();
    this.updatePreferences(preferences);
    this.element = document.createElement('div');
    this.element.id = 'apex-ether-ui-root';
    container.append(this.element);
    this.adapter.publishSession(session);
    this.root = createRoot(this.element);
    this.root.render(<StoreContext.Provider value={this.store}><DriveEtherHud initialPreferences={preferences} controls={controls} onPreferencesChange={this.updatePreferences} /></StoreContext.Provider>);
  }
  needsPhysicsSnapshot(timestampMs: number): boolean { return this.adapter.needsPhysicsSnapshot(timestampMs); }
  needsRaceSnapshot(): boolean { return this.adapter.needsRaceSnapshot(); }
  publishPhysics(timestampMs: number, state: ApexVehicleState): void { this.adapter.publishPhysics(timestampMs, state); }
  publishRace(timestampMs: number, state: LapTimingState): void { this.adapter.publishRace(timestampMs, state); }
  dispose(): void { this.root.unmount(); this.element.remove(); }
}

export const createApexEtherHud = (container: HTMLElement, session: ApexHudSessionInput, controls: ApexEtherHudControls): ApexEtherHudRuntime => new ApexEtherHudRuntimeImplementation(container, session, controls);
