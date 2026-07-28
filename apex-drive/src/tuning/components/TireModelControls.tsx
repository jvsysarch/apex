import type { ApexCommandSender } from '@jvsysarch/apex-contracts';
import { SURFACE_CATALOG, type SurfaceMode } from '@jvsysarch/apex-physics';
import type { TireModelId } from '@jvsysarch/apex-physics';
import {
  TIRE_COMPOUNDS,
  type TireOperatingParameters,
} from '@jvsysarch/apex-physics';

export interface TireModelControlsProps {
  readonly commands?: ApexCommandSender;
  readonly model?: TireModelId;
  readonly surface?: SurfaceMode;
  readonly operatingParameters?: TireOperatingParameters;
}

export function TireModelControls({
  commands,
  model,
  surface,
  operatingParameters,
}: TireModelControlsProps) {
  const pressurePsi = operatingParameters?.pressurePsi ?? 30;
  const temperatureC = operatingParameters?.temperatureC ?? 85;
  const compound = operatingParameters?.compound ?? 'semi-slick';

  return (
    <section className="tire-model-controls" aria-label="Tire model commands">
      <div className="tire-model-switch">
        <span>MODEL</span>
        <button
          type="button"
          data-model="jolt-default"
          data-active={model === 'jolt-default' || undefined}
          disabled={!commands}
          onClick={() => commands?.send({ type: 'SET_TIRE_MODEL', model: 'jolt-default' })}
        >
          JOLT DEFAULT
        </button>
        <button
          type="button"
          data-model="apex-v1"
          data-active={model === 'apex-v1' || undefined}
          disabled={!commands}
          onClick={() => commands?.send({ type: 'SET_TIRE_MODEL', model: 'apex-v1' })}
        >
          APEX V1
        </button>
        <button
          type="button"
          data-model="apex-v1.1"
          data-active={model === 'apex-v1.1' || undefined}
          disabled={!commands}
          onClick={() => commands?.send({ type: 'SET_TIRE_MODEL', model: 'apex-v1.1' })}
        >
          APEX V1.1
        </button>
        <button
          type="button"
          data-model="apex-v1.2"
          data-active={model === 'apex-v1.2' || undefined}
          disabled={!commands}
          onClick={() => commands?.send({ type: 'SET_TIRE_MODEL', model: 'apex-v1.2' })}
        >
          APEX V1.2
        </button>
        <button
          type="button"
          data-model="apex-brush-v1"
          data-active={model === 'apex-brush-v1' || undefined}
          disabled={!commands}
          onClick={() => commands?.send({ type: 'SET_TIRE_MODEL', model: 'apex-brush-v1' })}
        >
          BRUSH / FIALA
        </button>
        <button
          type="button"
          data-model="apex-tmeasy-v1"
          data-active={model === 'apex-tmeasy-v1' || undefined}
          disabled={!commands}
          onClick={() => commands?.send({ type: 'SET_TIRE_MODEL', model: 'apex-tmeasy-v1' })}
        >
          TMEASY V1
        </button>
        <button
          type="button"
          data-model="apex-tmeasy-9p-v2"
          data-active={model === 'apex-tmeasy-9p-v2' || undefined}
          disabled={!commands}
          onClick={() => commands?.send({
            type: 'SET_TIRE_MODEL',
            model: 'apex-tmeasy-9p-v2',
          })}
        >
          TMEASY 9P V2
        </button>
      </div>
      <label>
        <span>SURFACE</span>
        <select
          value={surface ?? 'track'}
          disabled={!commands}
          onChange={event => commands?.send({
            type: 'SET_ACTIVE_SURFACE',
            surface: event.currentTarget.value as SurfaceMode,
          })}
        >
          <option value="track">Track surfaces</option>
          {SURFACE_CATALOG.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
      </label>
      <div className="tire-operating-controls">
        <span>OPERATING POINT</span>
        <label>
          <small>Compound</small>
          <select
            value={compound}
            disabled={!commands}
            onChange={event => commands?.send({
              type: 'SET_TIRE_OPERATING_PARAMETERS',
              parameters: {
                compound: event.currentTarget.value as TireOperatingParameters['compound'],
              },
            })}
          >
            {TIRE_COMPOUNDS.map(entry => (
              <option key={entry.id} value={entry.id}>{entry.label}</option>
            ))}
          </select>
        </label>
        <label>
          <small>Pressure</small>
          <input
            type="range"
            min="18"
            max="45"
            step="0.5"
            value={pressurePsi}
            disabled={!commands}
            onChange={event => commands?.send({
              type: 'SET_TIRE_OPERATING_PARAMETERS',
              parameters: { pressurePsi: event.currentTarget.valueAsNumber },
            })}
          />
          <output>{pressurePsi.toFixed(1)} psi</output>
        </label>
        <button
          type="button"
          disabled={!commands}
          data-active={pressurePsi === 22 || undefined}
          onClick={() => commands?.send({
            type: 'SET_TIRE_OPERATING_PARAMETERS',
            parameters: { pressurePsi: 22 },
          })}
        >
          UNDERINFLATED · 22 PSI
        </button>
        <label>
          <small>Temperature</small>
          <input
            type="range"
            min="0"
            max="140"
            step="1"
            value={temperatureC}
            disabled={!commands}
            onChange={event => commands?.send({
              type: 'SET_TIRE_OPERATING_PARAMETERS',
              parameters: { temperatureC: event.currentTarget.valueAsNumber },
            })}
          />
          <output>{temperatureC.toFixed(0)} °C</output>
        </label>
      </div>
    </section>
  );
}
