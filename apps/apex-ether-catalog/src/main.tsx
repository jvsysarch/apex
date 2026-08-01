import { createRoot } from 'react-dom/client';
import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  ApexEtherInput,
  ApexEtherLeaderboard,
  ApexEtherMetric,
  ApexEtherObjectives,
  ApexEtherPosition,
  ApexEtherRaceClock,
  ApexEtherRoute,
  ApexEtherSpeed,
  ApexEtherSurface,
  ApexEtherWheelHealth,
  type ApexEtherSurfaceMode,
  type ApexEtherTelemetry,
} from '@jvsysarch/apex-ether';
import '@jvsysarch/apex-ether/styles.css';
import { ExpandedCatalog } from './expanded-catalog';
import './catalog.css';
import './expanded-catalog.css';

const fontOptions = Object.freeze([
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Source Sans 3',
  'IBM Plex Sans',
  'Manrope',
  'Noto Sans',
  'Work Sans',
  'Figtree',
  'Public Sans',
  'DM Sans',
  'Plus Jakarta Sans',
  'Atkinson Hyperlegible',
  'Lexend',
  'Nunito Sans',
  'Barlow',
  'Archivo',
  'Rubik',
  'Space Grotesk',
]);

const fontWeights = Object.freeze([400, 500, 600, 700, 800]);
const figureFontOptions = Object.freeze(['Manrope', 'Plus Jakarta Sans']);
type TypographyLevel = 'title' | 'hero' | 'figures' | 'subtitle' | 'small';
interface TypographyValue {
  readonly family: string;
  readonly weight: number;
  readonly size: number;
}
type TypographySettings = Readonly<Record<TypographyLevel, TypographyValue>>;

type PaletteRole = 'highlight' | 'positive' | 'info' | 'warning' | 'danger' | 'neutral';
type PaletteSettings = Readonly<Record<PaletteRole, string>>;

interface BoxShadowValue {
  readonly x: number;
  readonly y: number;
  readonly blur: number;
  readonly spread: number;
  readonly opacity: number;
}

interface TextShadowValue {
  readonly x: number;
  readonly y: number;
  readonly blur: number;
  readonly opacity: number;
}

interface ShadowSettings {
  readonly solid: BoxShadowValue;
  readonly glass: BoxShadowValue;
  readonly text: TextShadowValue;
}

interface GlassSettings {
  readonly colorStart: string;
  readonly opacityStart: number;
  readonly colorEnd: string;
  readonly opacityEnd: number;
  readonly gradientAngle: number;
  readonly backdropBlur: number;
  readonly borderColor: string;
  readonly borderOpacity: number;
  readonly borderWidth: number;
  readonly textStrokeColor: string;
  readonly textStrokeOpacity: number;
  readonly textStrokeWidth: number;
}

const defaultShadows: ShadowSettings = Object.freeze({
  solid: Object.freeze({ x: 0, y: 18, blur: 44, spread: 0, opacity: 16 }),
  glass: Object.freeze({ x: 8, y: 13, blur: 24, spread: -7, opacity: 23 }),
  text: Object.freeze({ x: 0, y: 1, blur: 14, opacity: 20 }),
});

const defaultGlass: GlassSettings = Object.freeze({
  colorStart: '#ffffff',
  opacityStart: 13,
  colorEnd: '#000000',
  opacityEnd: 23,
  gradientAngle: 167,
  backdropBlur: 3,
  borderColor: '#ffffff',
  borderOpacity: 18,
  borderWidth: 2,
  textStrokeColor: '#000000',
  textStrokeOpacity: 28,
  textStrokeWidth: 0.35,
});

const defaultPalette: PaletteSettings = Object.freeze({
  highlight: '#ff941a',
  positive: '#31a300',
  info: '#0778cf',
  warning: '#ffc800',
  danger: '#ff0033',
  neutral: '#707070',
});

const paletteLabels = {
  highlight: ['Highlight', 'Selección, foco y dato actual'],
  positive: ['Positivo', 'Mejora, listo y completado'],
  info: ['Información', 'Contexto, navegación y ayuda'],
  warning: ['Warning', 'Atención y límite próximo'],
  danger: ['Peligro', 'Falla, crítico y acción inmediata'],
  neutral: ['Neutral', 'Datos secundarios e inactivos'],
} as const satisfies Readonly<Record<PaletteRole, readonly [string, string]>>;

const fontSizes: Readonly<Record<TypographyLevel, readonly number[]>> = Object.freeze({
  title: Object.freeze([16, 18, 20, 22, 24, 26, 28, 30]),
  hero: Object.freeze([24, 28, 32, 36, 40, 44, 48, 52]),
  figures: Object.freeze([28, 32, 36, 40, 44, 48, 52, 56]),
  subtitle: Object.freeze([14, 15, 16, 17, 18, 19, 20, 22]),
  small: Object.freeze([10, 11, 12, 13, 14, 15, 16, 17]),
});

const defaultTypography: TypographySettings = Object.freeze({
  title: Object.freeze({ family: 'Manrope', weight: 700, size: 28 }),
  hero: Object.freeze({ family: 'Space Grotesk', weight: 500, size: 40 }),
  figures: Object.freeze({ family: 'Manrope', weight: 500, size: 40 }),
  subtitle: Object.freeze({ family: 'Nunito Sans', weight: 500, size: 19 }),
  small: Object.freeze({ family: 'Inter', weight: 500, size: 16 }),
});

const typographyLabels: Readonly<Record<TypographyLevel, string>> = Object.freeze({
  title: 'Títulos',
  hero: 'Panel hero',
  figures: 'Cifras y telemetría',
  subtitle: 'Subtítulos y filas',
  small: 'Etiquetas y unidades',
});

function TypographyPreview({
  level,
  value,
}: {
  readonly level: TypographyLevel;
  readonly value: TypographyValue;
}) {
  const selectedStyle = {
    fontFamily: `"${value.family}", sans-serif`,
    fontSize: `${value.size}px`,
    fontWeight: value.weight,
  } as CSSProperties;
  const samples: Readonly<Record<TypographyLevel, ReactNode>> = {
    title: <><span>DIAGNÓSTICO</span><strong style={selectedStyle}>Estado del vehículo</strong></>,
    hero: <><span>VEHÍCULO</span><strong style={selectedStyle}>Apex GT</strong><small>Tracción trasera · Sport+</small></>,
    figures: <><span>VELOCIDAD</span><div><strong style={selectedStyle}>278</strong><small>km/h</small></div></>,
    subtitle: <><span>CONFIGURACIÓN ACTIVA</span><strong style={selectedStyle}>Tracción trasera · Sport+</strong></>,
    small: <><span style={selectedStyle}>TEMPERATURA</span><div><strong>85</strong><small style={selectedStyle}>°C</small></div></>,
  };
  return <div className="typography-lab__preview" data-level={level}>{samples[level]}</div>;
}

function TypographyLab({
  value,
  onChange,
}: {
  readonly value: TypographySettings;
  readonly onChange: (value: TypographySettings) => void;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [isOpen, setIsOpen] = useState(
    () => new URLSearchParams(window.location.search).get('section') === 'typography',
  );
  const update = (
    level: TypographyLevel,
    patch: Partial<TypographyValue>,
  ) => onChange(Object.freeze({
    ...value,
    [level]: Object.freeze({ ...value[level], ...patch }),
  }));
  const copySettings = async () => {
    const css = [
      ':root {',
      `  --ether-font-title: "${value.title.family}", sans-serif;`,
      `  --ether-weight-title: ${value.title.weight};`,
      `  --ether-size-title: ${value.title.size}px;`,
      `  --ether-font-hero: "${value.hero.family}", sans-serif;`,
      `  --ether-weight-hero: ${value.hero.weight};`,
      `  --ether-size-hero: ${value.hero.size}px;`,
      `  --ether-font-figures: "${value.figures.family}", sans-serif;`,
      `  --ether-weight-figures: ${value.figures.weight};`,
      `  --ether-size-figures: ${value.figures.size}px;`,
      `  --ether-font-subtitle: "${value.subtitle.family}", sans-serif;`,
      `  --ether-weight-subtitle: ${value.subtitle.weight};`,
      `  --ether-size-subtitle: ${value.subtitle.size}px;`,
      `  --ether-font-small: "${value.small.family}", sans-serif;`,
      `  --ether-weight-small: ${value.small.weight};`,
      `  --ether-size-small: ${value.small.size}px;`,
      '}',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(css);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      setCopyState('error');
    }
  };
  return <details className="typography-lab" open={isOpen} onToggle={event => setIsOpen(event.currentTarget.open)}>
    <summary><span>Tipografía</span><b>Cinco niveles · familia, peso y tamaño</b></summary>
    <div className="typography-lab__content">
      <header>
        <div><span>APEX ETHER</span><strong>Jerarquía de lectura</strong></div>
        <p>Cada muestra reproduce el uso real del nivel seleccionado.</p>
        <button type="button" onClick={() => void copySettings()}>
          {copyState === 'copied'
            ? 'Configuración copiada'
            : copyState === 'error'
              ? 'No se pudo copiar'
              : 'Copiar configuración'}
        </button>
        <output aria-live="polite">
          {copyState === 'copied' ? 'Los tokens CSS están en el portapapeles.' : ''}
        </output>
      </header>
      <div className="typography-lab__controls">
        {(Object.keys(typographyLabels) as TypographyLevel[]).map(level => (
          <fieldset key={level}>
            <legend>{typographyLabels[level]}</legend>
            <label>
              <span>Familia</span>
              <select
                value={value[level].family}
                onChange={event => update(level, { family: event.target.value })}
              >
                {(level === 'figures' ? figureFontOptions : fontOptions).map(font => (
                  <option key={font} value={font}>{font}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Peso</span>
              <select
                value={value[level].weight}
                onChange={event => update(level, { weight: Number(event.target.value) })}
              >
                {fontWeights.map(weight => <option key={weight} value={weight}>{weight}</option>)}
              </select>
            </label>
            <label>
              <span>Tamaño</span>
              <select
                value={value[level].size}
                onChange={event => update(level, { size: Number(event.target.value) })}
              >
                {fontSizes[level].map(size => <option key={size} value={size}>{size} px</option>)}
              </select>
            </label>
            <TypographyPreview level={level} value={value[level]} />
          </fieldset>
        ))}
      </div>
    </div>
  </details>;
}

function ShadowRange({
  label,
  value,
  min,
  max,
  unit = 'px',
  step = 1,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly unit?: 'px' | '%' | '°';
  readonly step?: number;
  readonly onChange: (value: number) => void;
}) {
  return <label className="shadow-lab__range">
    <span>{label}<b>{value}{unit}</b></span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={event => onChange(Number(event.target.value))}
    />
  </label>;
}

function ShadowLab({
  value,
  onChange,
}: {
  readonly value: ShadowSettings;
  readonly onChange: (value: ShadowSettings) => void;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const updateBox = (
    kind: 'solid' | 'glass',
    patch: Partial<BoxShadowValue>,
  ) => onChange(Object.freeze({
    ...value,
    [kind]: Object.freeze({ ...value[kind], ...patch }),
  }));
  const updateText = (patch: Partial<TextShadowValue>) => onChange(Object.freeze({
    ...value,
    text: Object.freeze({ ...value.text, ...patch }),
  }));
  const shadowCss = (shadow: BoxShadowValue) => (
    `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px rgb(0 0 0 / ${shadow.opacity}%)`
  );
  const copySettings = async () => {
    const css = [
      ':root {',
      `  --ether-shadow: ${shadowCss(value.solid)};`,
      `  --ether-glass-shadow: ${shadowCss(value.glass)};`,
      `  --ether-glass-text-shadow: ${value.text.x}px ${value.text.y}px ${value.text.blur}px rgb(0 0 0 / ${value.text.opacity}%);`,
      '}',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(css);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      setCopyState('error');
    }
  };
  const boxControls = (kind: 'solid' | 'glass') => <>
    <ShadowRange label="X" value={value[kind].x} min={-24} max={24} onChange={x => updateBox(kind, { x })} />
    <ShadowRange label="Y" value={value[kind].y} min={-12} max={60} onChange={y => updateBox(kind, { y })} />
    <ShadowRange label="Blur" value={value[kind].blur} min={0} max={100} onChange={blur => updateBox(kind, { blur })} />
    <ShadowRange label="Expansión" value={value[kind].spread} min={-24} max={40} onChange={spread => updateBox(kind, { spread })} />
    <ShadowRange label="Opacidad" value={value[kind].opacity} min={0} max={60} unit="%" onChange={opacity => updateBox(kind, { opacity })} />
  </>;
  return <details className="shadow-lab">
    <summary><span>Sombras</span><b>Negro · configuración detallada</b></summary>
    <div className="shadow-lab__content">
      <fieldset><legend>Panel sólido</legend>{boxControls('solid')}</fieldset>
      <fieldset><legend>Panel Glass</legend>{boxControls('glass')}</fieldset>
      <fieldset><legend>Texto sobre Glass</legend>
        <ShadowRange label="X" value={value.text.x} min={-8} max={8} onChange={x => updateText({ x })} />
        <ShadowRange label="Y" value={value.text.y} min={-8} max={12} onChange={y => updateText({ y })} />
        <ShadowRange label="Blur" value={value.text.blur} min={0} max={24} onChange={blur => updateText({ blur })} />
        <ShadowRange label="Opacidad" value={value.text.opacity} min={0} max={100} unit="%" onChange={opacity => updateText({ opacity })} />
      </fieldset>
      <div className="shadow-lab__actions">
        <button type="button" onClick={() => onChange(defaultShadows)}>Restablecer</button>
        <button type="button" onClick={() => void copySettings()}>{copyState === 'copied' ? 'Sombras copiadas' : copyState === 'error' ? 'No se pudo copiar' : 'Copiar sombras'}</button>
      </div>
    </div>
  </details>;
}

const colorWithOpacity = (color: string, opacity: number): string => {
  const normalized = color.replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgb(${red} ${green} ${blue} / ${opacity}%)`;
};

const glassGradientValue = (value: GlassSettings): string => (
  `linear-gradient(${value.gradientAngle}deg, ${colorWithOpacity(value.colorStart, value.opacityStart)}, ${colorWithOpacity(value.colorEnd, value.opacityEnd)})`
);

function GlassColorControl({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return <label className="glass-lab__color">
    <span>{label}</span>
    <input type="color" value={value} onChange={event => onChange(event.target.value)} />
    <b>{value}</b>
  </label>;
}

function GlassLab({
  value,
  onChange,
}: {
  readonly value: GlassSettings;
  readonly onChange: (value: GlassSettings) => void;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const copySettings = async () => {
    const css = [
      ':root {',
      `  --ether-glass-fill-start: ${colorWithOpacity(value.colorStart, value.opacityStart)};`,
      `  --ether-glass-fill-end: ${colorWithOpacity(value.colorEnd, value.opacityEnd)};`,
      `  --ether-glass-gradient-angle: ${value.gradientAngle}deg;`,
      '  --ether-glass-fill: linear-gradient(var(--ether-glass-gradient-angle), var(--ether-glass-fill-start), var(--ether-glass-fill-end));',
      `  --ether-glass-backdrop-blur: ${value.backdropBlur}px;`,
      `  --ether-glass-border: ${colorWithOpacity(value.borderColor, value.borderOpacity)};`,
      `  --ether-glass-border-width: ${value.borderWidth}px;`,
      `  --ether-glass-text-stroke-color: ${colorWithOpacity(value.textStrokeColor, value.textStrokeOpacity)};`,
      `  --ether-glass-text-stroke-width: ${value.textStrokeWidth}px;`,
      '}',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(css);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      setCopyState('error');
    }
  };
  return <details className="glass-lab">
    <summary><span>Superficie Glass</span><b>Gradiente {value.opacityStart}% → {value.opacityEnd}% · blur {value.backdropBlur}px · borde {value.borderWidth}px · texto {value.textStrokeWidth}px</b></summary>
    <div className="glass-lab__content">
      <fieldset>
        <legend>Fondo degradado</legend>
        <GlassColorControl label="Color inicial" value={value.colorStart} onChange={colorStart => onChange(Object.freeze({ ...value, colorStart }))} />
        <ShadowRange label="Opacidad inicial" value={value.opacityStart} min={0} max={100} unit="%" onChange={opacityStart => onChange(Object.freeze({ ...value, opacityStart }))} />
        <GlassColorControl label="Color final" value={value.colorEnd} onChange={colorEnd => onChange(Object.freeze({ ...value, colorEnd }))} />
        <ShadowRange label="Opacidad final" value={value.opacityEnd} min={0} max={100} unit="%" onChange={opacityEnd => onChange(Object.freeze({ ...value, opacityEnd }))} />
        <ShadowRange label="Ángulo" value={value.gradientAngle} min={0} max={360} unit="°" onChange={gradientAngle => onChange(Object.freeze({ ...value, gradientAngle }))} />
        <ShadowRange label="Blur del fondo" value={value.backdropBlur} min={0} max={16} onChange={backdropBlur => onChange(Object.freeze({ ...value, backdropBlur }))} />
      </fieldset>
      <fieldset>
        <legend>Bordes de panel y tipografía</legend>
        <GlassColorControl label="Panel · color" value={value.borderColor} onChange={borderColor => onChange(Object.freeze({ ...value, borderColor }))} />
        <ShadowRange label="Panel · opacidad" value={value.borderOpacity} min={0} max={100} unit="%" onChange={borderOpacity => onChange(Object.freeze({ ...value, borderOpacity }))} />
        <ShadowRange label="Panel · grosor" value={value.borderWidth} min={0} max={6} step={0.25} onChange={borderWidth => onChange(Object.freeze({ ...value, borderWidth }))} />
        <GlassColorControl label="Texto · color" value={value.textStrokeColor} onChange={textStrokeColor => onChange(Object.freeze({ ...value, textStrokeColor }))} />
        <ShadowRange label="Texto · opacidad" value={value.textStrokeOpacity} min={0} max={100} unit="%" onChange={textStrokeOpacity => onChange(Object.freeze({ ...value, textStrokeOpacity }))} />
        <ShadowRange label="Texto · grosor" value={value.textStrokeWidth} min={0} max={2} step={0.05} onChange={textStrokeWidth => onChange(Object.freeze({ ...value, textStrokeWidth }))} />
      </fieldset>
      <div
        className="glass-lab__sample"
        style={{
          background: glassGradientValue(value),
          borderColor: colorWithOpacity(value.borderColor, value.borderOpacity),
          borderWidth: value.borderWidth,
          backdropFilter: `blur(${value.backdropBlur}px)`,
          WebkitTextStroke: `${value.textStrokeWidth}px ${colorWithOpacity(value.textStrokeColor, value.textStrokeOpacity)}`,
        }}
        aria-label="Muestra del relleno Glass"
      ><span>Aa</span><b>278</b></div>
      <div className="glass-lab__actions">
        <button type="button" onClick={() => onChange(defaultGlass)}>Restablecer</button>
        <button type="button" onClick={() => void copySettings()}>{copyState === 'copied' ? 'Token copiado' : copyState === 'error' ? 'No se pudo copiar' : 'Copiar token'}</button>
      </div>
    </div>
  </details>;
}

const relativeLuminance = (hex: string): number => {
  const normalized = hex.replace('#', '');
  const channels = [0, 2, 4].map(offset => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map(channel => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
};

const contrastAgainstWhite = (hex: string): number => 1.05 / (relativeLuminance(hex) + 0.05);
const readableTextColor = (hex: string): string => contrastAgainstWhite(hex) >= 4.5 ? '#ffffff' : '#17221f';

function PaletteLab({
  value,
  onChange,
}: {
  readonly value: PaletteSettings;
  readonly onChange: (value: PaletteSettings) => void;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const update = (role: PaletteRole, color: string) => onChange(Object.freeze({ ...value, [role]: color }));
  const copySettings = async () => {
    const css = [
      ':root {',
      `  --ether-highlight: ${value.highlight};`,
      `  --ether-positive: ${value.positive};`,
      `  --ether-info: ${value.info};`,
      `  --ether-warning: ${value.warning};`,
      `  --ether-danger: ${value.danger};`,
      `  --ether-neutral: ${value.neutral};`,
      '}',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(css);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      setCopyState('error');
    }
  };
  return <details className="palette-lab">
    <summary><span>Paleta semántica</span><b>Automotriz · accesible</b></summary>
    <div className="palette-lab__content">
      {(Object.keys(paletteLabels) as PaletteRole[]).map(role => {
        const contrast = contrastAgainstWhite(value[role]);
        return <label
          className="palette-lab__swatch"
          key={role}
          style={{ background: value[role], color: readableTextColor(value[role]) }}
        >
          <span>{paletteLabels[role][0]}</span>
          <strong>{paletteLabels[role][1]}</strong>
          <input type="color" value={value[role]} onChange={event => update(role, event.target.value)} aria-label={`Color ${paletteLabels[role][0]}`} />
          <b>{value[role]}</b>
          <small>{contrast.toFixed(2)}:1 sobre blanco · {contrast >= 4.5 ? 'AA' : 'contraste bajo'}</small>
        </label>;
      })}
      <div className="palette-lab__actions">
        <button type="button" onClick={() => onChange(defaultPalette)}>Restablecer</button>
        <button type="button" onClick={() => void copySettings()}>{copyState === 'copied' ? 'Paleta copiada' : copyState === 'error' ? 'No se pudo copiar' : 'Copiar paleta'}</button>
      </div>
    </div>
  </details>;
}

const telemetry: ApexEtherTelemetry = Object.freeze({
  motion: Object.freeze({ speedKmh: 278, rpm: 6840, maximumRpm: 8200, gear: '4', throttle: .84, brake: .18, steering: 7 }),
  race: Object.freeze({ position: 1, entrants: 12, lap: 2, lapCount: 3, elapsed: '01:24.560', bestLap: '01:18.732', delta: '−0.384', deltaTone: 'positive', sector: 2, sectorCount: 3 }),
  session: Object.freeze({ trackName: 'Altas Cumbres', vehicleName: 'Apex GT', mode: 'Práctica cronometrada', weather: 'Claro · 18°', condition: 'Asfalto seco' }),
  wheels: Object.freeze([
    { id: 'FL', temperatureC: 87, pressurePsi: 27.6, loadKn: 4.2, gripPercent: 93 },
    { id: 'FR', temperatureC: 90, pressurePsi: 27.8, loadKn: 4.5, gripPercent: 91 },
    { id: 'RL', temperatureC: 94, pressurePsi: 28.1, loadKn: 3.8, gripPercent: 84, tone: 'warning' },
    { id: 'RR', temperatureC: 92, pressurePsi: 28.0, loadKn: 3.7, gripPercent: 88 },
  ] as const),
  route: Object.freeze([{ x: 30, y: 148 }, { x: 56, y: 128 }, { x: 68, y: 78 }, { x: 118, y: 58 }, { x: 152, y: 82 }, { x: 132, y: 128 }, { x: 94, y: 150 }, { x: 48, y: 142 }]),
});

const leaders = Object.freeze([
  { name: 'J. Villaverde', gap: 'Líder', active: true }, { name: 'M. Anderson', gap: '+1.250' }, { name: 'L. Martínez', gap: '+2.463' }, { name: 'A. Wilson', gap: '+3.820' }, { name: 'R. Thompson', gap: '+4.256' },
]);
const objectives = Object.freeze([
  { label: 'Completa el podio', complete: true }, { label: 'Mantén el ritmo objetivo', progress: '02:14' }, { label: 'Recupera energía en frenada', progress: '68%' },
]);

function Frame({ title, subtitle, mode, background, children }: { title: string; subtitle: string; mode: ApexEtherSurfaceMode; background: 'mountain' | 'night'; children: ReactNode }) {
  return <article className="catalog-frame" data-mode={mode} style={{ '--catalog-image': `url(/backgrounds/ether-${background === 'mountain' ? 'mountain-route' : 'riverside-night'}-v1.png)` } as CSSProperties}>
    <header><div><span>{subtitle}</span><h2>{title}</h2></div><b>{mode === 'glass' ? 'VIDRIO CLARO' : 'BLANCO OPACO'}</b></header>
    <div className="catalog-frame__scene" data-mode={mode}>{children}</div>
  </article>;
}

function RaceBroadcast({ mode }: { mode: ApexEtherSurfaceMode }) {
  return <div className="hud-layout hud-layout--broadcast">
    <div className="hud-layout__identity" data-mode={mode}><span>{telemetry.session.mode}</span><strong>{telemetry.session.trackName}</strong><em>{telemetry.session.weather}</em></div>
    <ApexEtherPosition race={telemetry.race} mode={mode} />
    <ApexEtherRaceClock race={telemetry.race} mode={mode} />
    <ApexEtherLeaderboard entries={leaders} mode={mode} />
    <ApexEtherObjectives items={objectives} mode={mode} />
    <ApexEtherRoute points={telemetry.route} mode={mode} />
    <ApexEtherSpeed motion={telemetry.motion} mode={mode} />
  </div>;
}

function TrackAttack({ mode }: { mode: ApexEtherSurfaceMode }) {
  return <div className="hud-layout hud-layout--attack">
    <ApexEtherRaceClock race={telemetry.race} mode={mode} />
    <ApexEtherSurface title="Ritmo de referencia" mode={mode} className="catalog-split"><ApexEtherMetric label="Sector 2" value="−0.384" unit="s" tone="positive" detail="Más rápido que tu mejor vuelta" /><div className="catalog-split__bars"><i /><i /><i /><i /></div></ApexEtherSurface>
    <ApexEtherRoute points={telemetry.route} mode={mode} />
    <ApexEtherSpeed motion={telemetry.motion} mode={mode} />
  </div>;
}

function CarCare({ mode }: { mode: ApexEtherSurfaceMode }) {
  return <div className="hud-layout hud-layout--care">
    <ApexEtherWheelHealth wheels={telemetry.wheels} mode={mode} />
    <ApexEtherInput motion={telemetry.motion} mode={mode} />
    <ApexEtherSurface title="Tren motriz" eyebrow="Estado en vivo" mode={mode} className="catalog-drivetrain"><ApexEtherMetric label="Potencia" value="742" unit="CV" /><ApexEtherMetric label="Par" value="800" unit="Nm" /><ApexEtherMetric label="Aceite" value="94" unit="°C" tone="positive" /><ApexEtherMetric label="Batería" value="68" unit="%" tone="info" detail="Recuperación activa" /></ApexEtherSurface>
    <ApexEtherSurface title="Asistencias" mode={mode} className="catalog-assists"><div data-tone="positive"><b>ABS</b><strong>Activo</strong></div><div data-tone="emphasis"><b>Tracción</b><strong>Sport</strong></div><div data-tone="info"><b>Estabilidad</b><strong>Dinámico</strong></div></ApexEtherSurface>
  </div>;
}

function SessionBrief({ mode }: { mode: ApexEtherSurfaceMode }) {
  return <div className="hud-layout hud-layout--brief">
    <ApexEtherSurface title="Sesión" eyebrow="Antes de conducir" mode={mode} className="catalog-session"><ApexEtherMetric label="Circuito" value={telemetry.session.trackName} detail="5,8 km · 18 curvas" variant="hero" /><ApexEtherMetric label="Vehículo" value={telemetry.session.vehicleName} detail="Tracción trasera · Sport+" variant="hero" /><ApexEtherMetric label="Condición" value={telemetry.session.condition} detail={telemetry.session.weather} variant="hero" /></ApexEtherSurface>
    <ApexEtherObjectives items={objectives} mode={mode} />
    <ApexEtherSurface title="Cámara" mode={mode} className="catalog-camera"><div><b>Exterior dinámica</b><span>FOV 74° · seguimiento suave</span></div><button type="button">Cambiar vista</button></ApexEtherSurface>
  </div>;
}

function Library() {
  const metrics = [
    ['Rendimiento', 'Potencia, par, rpm, velocidad máxima, 0–100, consumo, autonomía'],
    ['Carrera', 'Posición, vueltas, sectores, delta, clasificación, objetivos, sanciones'],
    ['Vehículo', 'Neumáticos, cargas, temperatura, presión, desgaste, daños, fluidos'],
    ['Navegación', 'Ruta, siguiente curva, distancia, punto de frenada, minimapa, brújula'],
    ['Sesión', 'Pista, clima, hora, cámara, modo, dificultad, tráfico, replay'],
    ['Conducción', 'Acelerador, freno, dirección, marcha, asistencias, energía, boost'],
  ];
  return <section className="catalog-library"><header><span>Sistema modular</span><h2>Catálogo de información</h2><p>Las métricas se organizan por decisión del conductor. Cada bloque puede vivir solo, en overlay o dentro de una superficie de vidrio claro u opaca.</p></header><div>{metrics.map(([title, text], index) => <article key={title}><b>{String(index + 1).padStart(2, '0')}</b><h3>{title}</h3><p>{text}</p></article>)}</div></section>;
}

function Performance() {
  return <section className="catalog-performance"><span>Presupuesto de rendimiento</span><h2>Lectura clara y actualización estable</h2><div><article><b>01</b><h3>Datos segmentados</h3><p>Movimiento, carrera, ruta y vehículo se publican por separado. Cada panel recibe únicamente la información que necesita.</p></article><article><b>02</b><h3>Composición por demanda</h3><p>Se montan únicamente los paneles elegidos. Las rutas y los gráficos trabajan cuando están visibles.</p></article><article><b>03</b><h3>Superficie liviana</h3><p>El vidrio utiliza una capa semitransparente y el desenfoque se regula según el presupuesto visual disponible.</p></article><article><b>04</b><h3>Números estables</h3><p>Tipografía tabular, estructura compacta y transformaciones aisladas mantienen fluidos los datos de alta frecuencia.</p></article></div></section>;
}

function Catalog() {
  const [typography, setTypography] = useState(defaultTypography);
  const [palette, setPalette] = useState(defaultPalette);
  const [shadows, setShadows] = useState(defaultShadows);
  const [glass, setGlass] = useState(defaultGlass);
  const boxShadow = (shadow: BoxShadowValue) => (
    `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px rgb(0 0 0 / ${shadow.opacity}%)`
  );
  const typographyStyle = {
    '--ether-font-title': `"${typography.title.family}", sans-serif`,
    '--ether-font-hero': `"${typography.hero.family}", sans-serif`,
    '--ether-font-figures': `"${typography.figures.family}", sans-serif`,
    '--ether-font-subtitle': `"${typography.subtitle.family}", sans-serif`,
    '--ether-font-small': `"${typography.small.family}", sans-serif`,
    '--ether-weight-title': typography.title.weight,
    '--ether-weight-hero': typography.hero.weight,
    '--ether-weight-figures': typography.figures.weight,
    '--ether-weight-subtitle': typography.subtitle.weight,
    '--ether-weight-small': typography.small.weight,
    '--ether-size-title': `${typography.title.size}px`,
    '--ether-size-hero': `${typography.hero.size}px`,
    '--ether-size-figures': `${typography.figures.size}px`,
    '--ether-size-subtitle': `${typography.subtitle.size}px`,
    '--ether-size-small': `${typography.small.size}px`,
    '--ether-highlight': palette.highlight,
    '--ether-accent': palette.highlight,
    '--ether-positive': palette.positive,
    '--ether-info': palette.info,
    '--ether-warning': palette.warning,
    '--ether-danger': palette.danger,
    '--ether-neutral': palette.neutral,
    '--ether-muted': palette.neutral,
    '--ether-shadow': boxShadow(shadows.solid),
    '--ether-glass-shadow': boxShadow(shadows.glass),
    '--ether-glass-text-shadow': `${shadows.text.x}px ${shadows.text.y}px ${shadows.text.blur}px rgb(0 0 0 / ${shadows.text.opacity}%)`,
    '--ether-glass-fill-start': colorWithOpacity(glass.colorStart, glass.opacityStart),
    '--ether-glass-fill-end': colorWithOpacity(glass.colorEnd, glass.opacityEnd),
    '--ether-glass-gradient-angle': `${glass.gradientAngle}deg`,
    '--ether-glass-fill': glassGradientValue(glass),
    '--ether-glass-backdrop-blur': `${glass.backdropBlur}px`,
    '--ether-glass-border': colorWithOpacity(glass.borderColor, glass.borderOpacity),
    '--ether-glass-border-width': `${glass.borderWidth}px`,
    '--ether-glass-text-stroke-color': colorWithOpacity(glass.textStrokeColor, glass.textStrokeOpacity),
    '--ether-glass-text-stroke-width': `${glass.textStrokeWidth}px`,
  } as CSSProperties;
  const query = new URLSearchParams(window.location.search);
  const isLabRoute = window.location.pathname.replace(/\/+$/, '') === '/lab';
  const labEnabled = isLabRoute || query.get('lab') === 'true';
  if (query.get('view') === 'expanded') {
    return <main className="catalog-shell" style={typographyStyle}><ExpandedCatalog /></main>;
  }
  return <main className="catalog-shell" style={typographyStyle}>
    {labEnabled ? <div className="catalog-controls">
      <TypographyLab value={typography} onChange={setTypography} />
      <PaletteLab value={palette} onChange={setPalette} />
      <ShadowLab value={shadows} onChange={setShadows} />
      <GlassLab value={glass} onChange={setGlass} />
    </div> : null}
    <section className="catalog-hero"><p>Apex Ether · sistema de telemetría</p><h1>Información que se lee.<br /><i>Espacio para conducir.</i></h1><div><span>Pantallas amplias · 24”+</span><span>Vidrio transparente · blanco opaco</span><span>Carrera · vehículo · estrategia</span></div></section>
    <section className="catalog-intro"><p>Una familia de interfaces de conducción, carrera y diagnóstico. No es una sola pantalla recargada: cada composición responde a un momento de uso y puede elegir sus propios paneles.</p></section>
    <section className="catalog-frames"><Frame title="Carrera en vivo" subtitle="Composición completa · información periférica" mode="glass" background="mountain"><RaceBroadcast mode="glass" /></Frame><Frame title="Ataque de vuelta" subtitle="Foco absoluto · feedback inmediato" mode="glass" background="night"><TrackAttack mode="glass" /></Frame><Frame title="Estado del vehículo" subtitle="Diagnóstico claro · datos comparables" mode="solid" background="mountain"><CarCare mode="solid" /></Frame><Frame title="Brief de sesión" subtitle="Configuración · objetivos y contexto" mode="solid" background="night"><SessionBrief mode="solid" /></Frame></section>
    <ExpandedCatalog />
    <Library /><Performance />
  </main>;
}

createRoot(document.getElementById('root')!).render(<Catalog />);
