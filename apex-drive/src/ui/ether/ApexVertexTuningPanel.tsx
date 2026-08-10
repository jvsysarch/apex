import { memo, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_APEX_VERTEX_TUNING,
  normalizeApexVertexTuning,
  type ApexVertexTuning,
} from '../../vehicle/ApexVertexTuning';

type VertexTuningKey = keyof ApexVertexTuning;

interface SliderDefinition {
  readonly key: VertexTuningKey;
  readonly labelEs: string;
  readonly labelEn: string;
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
  readonly format: (value: number) => string;
}

const integer = (unit: string) => (value: number): string => (
  `${Math.round(value).toLocaleString()}${unit}`
);
const decimal = (unit: string, digits = 2) => (value: number): string => (
  `${value.toFixed(digits)}${unit}`
);
const percent = (value: number): string => `${Math.round(value * 100)}%`;

const groups: readonly {
  readonly titleEs: string;
  readonly titleEn: string;
  readonly descriptionEs: string;
  readonly descriptionEn: string;
  readonly sliders: readonly SliderDefinition[];
}[] = Object.freeze([
  {
    titleEs: 'Potencia e impulso',
    titleEn: 'Power and boost',
    descriptionEs: 'Entrega del motor y pulso manual con Shift o RB.',
    descriptionEn: 'Engine delivery and the Shift or RB manual pulse.',
    sliders: [
      { key: 'torqueNm', labelEs: 'Torque máximo', labelEn: 'Maximum torque', minimum: 900, maximum: 3200, step: 50, format: integer(' Nm') },
      { key: 'pulseBoostRatio', labelEs: 'Fuerza del impulso', labelEn: 'Boost strength', minimum: 0.15, maximum: 0.85, step: 0.05, format: percent },
      { key: 'pulseDurationSeconds', labelEs: 'Duración', labelEn: 'Duration', minimum: 0.5, maximum: 2, step: 0.1, format: decimal(' s', 1) },
      { key: 'pulseRechargeSeconds', labelEs: 'Recarga', labelEn: 'Recharge', minimum: 1.5, maximum: 8, step: 0.25, format: decimal(' s', 2) },
    ],
  },
  {
    titleEs: 'Chasis y control',
    titleEn: 'Chassis and control',
    descriptionEs: 'Frenada, dirección y asistencia física contra vuelcos.',
    descriptionEn: 'Braking, steering and physical rollover assistance.',
    sliders: [
      { key: 'massKg', labelEs: 'Peso', labelEn: 'Weight', minimum: 950, maximum: 1800, step: 25, format: integer(' kg') },
      { key: 'brakeMultiplier', labelEs: 'Potencia de freno', labelEn: 'Brake power', minimum: 0.8, maximum: 2, step: 0.05, format: decimal('×') },
      { key: 'steeringAngleDegrees', labelEs: 'Ángulo de dirección', labelEn: 'Steering angle', minimum: 24, maximum: 45, step: 1, format: integer('°') },
      { key: 'rolloverStability', labelEs: 'Estabilidad antivuelco', labelEn: 'Rollover stability', minimum: 0, maximum: 1, step: 0.05, format: percent },
    ],
  },
  {
    titleEs: 'Suspensión y grip',
    titleEn: 'Suspension and grip',
    descriptionEs: 'Balance delantero/trasero sin ocupar controles permanentes en pantalla.',
    descriptionEn: 'Front/rear balance without permanent on-screen controls.',
    sliders: [
      { key: 'gripMultiplier', labelEs: 'Grip', labelEn: 'Grip', minimum: 0.75, maximum: 1.2, step: 0.01, format: decimal('×') },
      { key: 'frontAntiRollStiffness', labelEs: 'Barra delantera', labelEn: 'Front anti-roll bar', minimum: 1200, maximum: 7000, step: 100, format: integer('') },
      { key: 'rearAntiRollStiffness', labelEs: 'Barra trasera', labelEn: 'Rear anti-roll bar', minimum: 1200, maximum: 7000, step: 100, format: integer('') },
      { key: 'frontDamping', labelEs: 'Amortiguación delantera', labelEn: 'Front damping', minimum: 0.45, maximum: 0.95, step: 0.01, format: decimal('') },
      { key: 'rearDamping', labelEs: 'Amortiguación trasera', labelEn: 'Rear damping', minimum: 0.45, maximum: 0.95, step: 0.01, format: decimal('') },
    ],
  },
]);

export interface ApexVertexTuningPanelProps {
  readonly locale: 'es' | 'en';
  readonly tuning: ApexVertexTuning;
  readonly onApply: (tuning: ApexVertexTuning) => void;
}

export const ApexVertexTuningPanel = memo(({
  locale,
  tuning,
  onApply,
}: ApexVertexTuningPanelProps) => {
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<readonly number[]>([0]);
  const [draft, setDraft] = useState(tuning);
  const t = (es: string, en: string): string => locale === 'en' ? en : es;
  useEffect(() => setDraft(tuning), [tuning]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  const normalizedDraft = useMemo(
    () => normalizeApexVertexTuning(draft),
    [draft],
  );
  const changed = JSON.stringify(normalizedDraft) !== JSON.stringify(tuning);
  const update = (key: VertexTuningKey, value: number) => {
    setDraft(current => ({ ...current, [key]: value }));
  };
  const toggleGroup = (groupIndex: number) => {
    setOpenGroups(current => current.includes(groupIndex)
      ? current.filter(index => index !== groupIndex)
      : [...current, groupIndex]);
  };

  return <aside className="apex-drive-vertex-tuning" data-open={open || undefined}>
    <button
      className="apex-drive-vertex-tuning__trigger"
      type="button"
      aria-expanded={open}
      aria-label={t('Abrir tuning de VERTEX-ARCADE', 'Open VERTEX-ARCADE tuning')}
      onClick={() => setOpen(true)}
    >
      <span aria-hidden="true">V</span><small>TUNE</small>
    </button>
    {open ? <div
      className="apex-drive-vertex-tuning__layer"
      onPointerDown={event => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <section
        className="apex-drive-vertex-tuning__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apex-vertex-tuning-title"
      >
        <header className="apex-drive-vertex-tuning__header">
          <div><span>VERTEX-ARCADE</span><h2 id="apex-vertex-tuning-title">{t('Tuning', 'Tuning')}</h2></div>
          <button type="button" onClick={() => setOpen(false)} aria-label={t('Cerrar tuning', 'Close tuning')}>×</button>
        </header>
        <p className="apex-drive-vertex-tuning__lead">{t(
          'Los cambios se aplican juntos y reinician la vuelta. La estabilidad baja el centro de gravedad y limita la inclinación del chasis.',
          'Changes apply together and restart the lap. Stability lowers the center of gravity and limits chassis tilt.',
        )}</p>
        <div className="apex-drive-vertex-tuning__groups">
          {groups.map((group, groupIndex) => <section key={group.titleEn} data-open={openGroups.includes(groupIndex) || undefined}>
            <button className="apex-drive-vertex-tuning__group-trigger" type="button" aria-expanded={openGroups.includes(groupIndex)} onClick={() => toggleGroup(groupIndex)}>
              <span>{t(group.titleEs, group.titleEn)}</span><small>{t(group.descriptionEs, group.descriptionEn)}</small>
            </button>
            {openGroups.includes(groupIndex) ? <div className="apex-drive-vertex-tuning__sliders">
              {group.sliders.map(slider => <label key={slider.key}>
                <span>{t(slider.labelEs, slider.labelEn)}</span>
                <output>{slider.format(normalizedDraft[slider.key])}</output>
                <input
                  type="range"
                  min={slider.minimum}
                  max={slider.maximum}
                  step={slider.step}
                  value={normalizedDraft[slider.key]}
                  onChange={event => update(slider.key, Number(event.target.value))}
                />
              </label>)}
            </div> : null}
          </section>)}
        </div>
        <footer>
          <button type="button" onClick={() => setDraft(DEFAULT_APEX_VERTEX_TUNING)}>{t('Restaurar VERTEX', 'Restore VERTEX')}</button>
          <button type="button" disabled={!changed} onClick={() => onApply(normalizedDraft)}>{t('Aplicar y reiniciar vuelta', 'Apply and restart lap')}</button>
        </footer>
      </section>
    </div> : null}
  </aside>;
});
