import type { LapTimerPhase, LapTimingState } from '../race/ApexLapTimer';
import {
  APEX_HUD_PREFERENCES_EVENT,
  readApexHudPreferences,
} from './ether/ApexHudPreferences';

export interface LapTimingPersistentStats {
  readonly attempts: number;
  readonly best?: { readonly durationMs: number; readonly completedAt: string };
  readonly last?: { readonly durationMs: number; readonly completedAt: string };
  readonly history?: readonly {
    readonly durationMs: number;
    readonly completedAt: string;
  }[];
}

const formatTime = (milliseconds?: number) => {
  if (milliseconds === undefined || !Number.isFinite(milliseconds)) return '—:——.———';
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor(milliseconds % 60000 / 1000);
  const millis = Math.floor(milliseconds % 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
};

const formatDelta = (milliseconds?: number) => {
  if (milliseconds === undefined || !Number.isFinite(milliseconds)) return '± —.———';
  const sign = milliseconds > 0 ? '+' : milliseconds < 0 ? '−' : '±';
  return `${sign} ${(Math.abs(milliseconds) / 1000).toFixed(3)}`;
};

const formatRecordDate = (iso?: string) => {
  if (!iso) return 'SIN REGISTRO';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'SIN REGISTRO';
  const parts = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => (
    parts.find(candidate => candidate.type === type)?.value ?? ''
  );
  return `${part('day')} ${part('month').toUpperCase()} · ${part('hour')}:${part('minute')}`;
};

/** HUD compacto durante carrera y panel de registros bajo demanda. */
export class LapTimingHud {
  private readonly launcher: HTMLButtonElement;
  private readonly card: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly details: HTMLElement;
  private readonly time: HTMLElement;
  private readonly lap: HTMLElement;
  private readonly delta: HTMLElement;
  private readonly checkpoint: HTMLElement;
  private readonly status: HTMLElement;
  private readonly best: HTMLElement;
  private readonly bestDate: HTMLTimeElement;
  private readonly last: HTMLElement;
  private readonly sector: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly history: HTMLOListElement;
  private readonly identity: HTMLElement;
  private readonly identityStatus: HTMLElement;
  private readonly identityProvider: HTMLElement;
  private expanded = false;
  private raceActive = false;
  private phase: LapTimerPhase = 'arming';
  private completedLapCount = 0;
  private timingEnabled = readApexHudPreferences().raceTiming;
  private persistentStats?: LapTimingPersistentStats;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <button
        class="lap-timing-launcher"
        type="button"
        aria-label="Abrir tiempos de vuelta"
        title="Tiempos de vuelta"
      >
        <i aria-hidden="true"></i>
      </button>
      <section class="lap-timing-card" aria-label="Cronómetro de vuelta" hidden>
        <div class="lap-timing-compact">
          <span class="lap-timing-lap">
            <small>VUELTA</small>
            <strong id="lap-timing-lap">01</strong>
          </span>
          <strong id="lap-timing-value">0:00.000</strong>
          <output id="lap-timing-delta">± —.———</output>
          <span class="lap-timing-checkpoint">
            <small>CP</small>
            <strong id="lap-timing-checkpoint">0 / 0</strong>
          </span>
          <button
            class="lap-timing-toggle"
            type="button"
            aria-label="Expandir cronómetro"
            aria-expanded="false"
          >⌄</button>
        </div>
        <div class="lap-timing-details" hidden>
          <header>
            <span>APEX TIMING</span>
            <strong>REGISTRO</strong>
          </header>
          <div class="lap-progress"><i id="lap-timing-progress"></i></div>
          <p id="lap-timing-status">HISTORIAL LOCAL</p>
          <section class="lap-timing-identity" hidden>
            <p id="lap-timing-identity-status">CONECTÁ TU PERFIL PARA GUARDAR TIEMPOS</p>
            <div id="lap-timing-identity-provider"></div>
          </section>
          <ol class="lap-timing-history" id="lap-timing-history" aria-label="Vueltas registradas"></ol>
          <footer>
            <span>MEJOR
              <strong id="lap-timing-best">—:——.———</strong>
              <time id="lap-timing-best-date">SIN REGISTRO</time>
            </span>
            <span>ÚLTIMA <strong id="lap-timing-last">—:——.———</strong></span>
            <span>SECTOR <strong id="lap-timing-sector">1 / 3</strong></span>
          </footer>
        </div>
      </section>`;
    this.launcher = this.required<HTMLButtonElement>('.lap-timing-launcher');
    this.card = this.required('.lap-timing-card');
    this.toggle = this.required<HTMLButtonElement>('.lap-timing-toggle');
    this.details = this.required('.lap-timing-details');
    this.time = this.required('#lap-timing-value');
    this.lap = this.required('#lap-timing-lap');
    this.delta = this.required('#lap-timing-delta');
    this.checkpoint = this.required('#lap-timing-checkpoint');
    this.status = this.required('#lap-timing-status');
    this.best = this.required('#lap-timing-best');
    this.bestDate = this.required<HTMLTimeElement>('#lap-timing-best-date');
    this.last = this.required('#lap-timing-last');
    this.sector = this.required('#lap-timing-sector');
    this.progress = this.required('#lap-timing-progress');
    this.history = this.required<HTMLOListElement>('#lap-timing-history');
    this.identity = this.required('.lap-timing-identity');
    this.identityStatus = this.required('#lap-timing-identity-status');
    this.identityProvider = this.required('#lap-timing-identity-provider');

    window.addEventListener(APEX_HUD_PREFERENCES_EVENT, () => {
      this.timingEnabled = readApexHudPreferences().raceTiming;
      this.applyVisibility();
    });

    this.launcher.addEventListener('click', () => {
      this.expanded = true;
      this.applyVisibility();
    });
    this.toggle.addEventListener('click', () => {
      this.expanded = !this.expanded;
      this.applyVisibility();
    });
    this.applyVisibility();
  }

  update(state: LapTimingState): void {
    const enteredRace = this.phase !== 'running' && state.phase === 'running';
    this.phase = state.phase;
    this.raceActive = state.phase === 'running'
      || (
        state.phase === 'abandoned'
        && state.hudVisibility !== 'hidden'
      );
    if (enteredRace) {
      this.expanded = false;
    } else if (state.phase === 'countdown') {
      this.expanded = false;
    }
    if (state.completedLapCount > this.completedLapCount) {
      this.expanded = true;
    }
    this.completedLapCount = state.completedLapCount;
    this.root.dataset.phase = state.phase;
    this.card.dataset.visibility = state.hudVisibility;
    this.time.textContent = formatTime(state.elapsedMs);
    this.lap.textContent = String(state.lapNumber).padStart(2, '0');
    this.delta.textContent = formatDelta(state.lapDeltaMs);
    this.delta.dataset.sign = state.lapDeltaMs === undefined
      ? 'neutral'
      : state.lapDeltaMs <= 0 ? 'gain' : 'loss';
    this.checkpoint.textContent = (
      `${state.checkpointIndex} / ${state.checkpointCount}`
    );
    const best = this.persistentStats?.best;
    const last = this.persistentStats?.last;
    this.status.textContent = state.phase === 'running'
      ? 'VUELTA EN CURSO'
      : state.phase === 'abandoned'
        ? 'SESIÓN FINALIZADA'
        : this.persistentStats
          ? `PERFIL LOCAL · ${this.persistentStats.attempts} VUELTAS`
          : 'HISTORIAL LOCAL';
    this.best.textContent = formatTime(best?.durationMs ?? state.bestLapMs);
    this.bestDate.textContent = formatRecordDate(best?.completedAt ?? state.bestLapRecordedAtIso);
    this.bestDate.dateTime = best?.completedAt ?? state.bestLapRecordedAtIso ?? '';
    this.last.textContent = formatTime(last?.durationMs ?? state.lastLapMs);
    this.sector.textContent = `${state.sectorIndex + 1} / ${state.sectorCount}`;
    this.renderHistory(
      this.persistentStats?.history
      ?? state.lapRecords.map(record => ({
        durationMs: record.lapMs,
        completedAt: record.completedAtIso,
      })),
    );
    const progress = state.checkpointCount > 0
      ? state.checkpointIndex / state.checkpointCount
      : 0;
    this.progress.style.transform = `scaleX(${progress.toFixed(4)})`;
    this.applyVisibility();
  }

  setPersistentStats(stats?: LapTimingPersistentStats): void {
    this.persistentStats = stats;
  }

  identityHost(): HTMLElement {
    this.identity.hidden = false;
    return this.identityProvider;
  }

  setIdentityStatus(message: string): void {
    this.identity.hidden = false;
    this.identityStatus.textContent = message;
  }

  private renderHistory(records: readonly {
    readonly durationMs: number;
    readonly completedAt: string;
  }[]): void {
    const recent = records.slice(0, 5);
    this.history.hidden = recent.length === 0;
    this.history.replaceChildren(...recent.map((record, index) => {
      const row = document.createElement('li');
      const label = document.createElement('span');
      const time = document.createElement('time');
      label.textContent = `V${String(index + 1).padStart(2, '0')}`;
      time.dateTime = record.completedAt;
      time.textContent = `${formatTime(record.durationMs)} · ${formatRecordDate(record.completedAt)}`;
      row.append(label, time);
      return row;
    }));
  }

  private applyVisibility(): void {
    // The timer is a permanent part of the time-trial experience while Drive
    // is active. The parent runtime hides the whole surface in the garage.
    this.card.hidden = !this.timingEnabled;
    this.launcher.hidden = true;
    this.toggle.hidden = true;
    this.details.hidden = !this.timingEnabled;
    this.root.dataset.mode = 'expanded';
    this.toggle.textContent = this.expanded
      ? this.raceActive ? '⌃' : '×'
      : '⌄';
    this.toggle.setAttribute('aria-expanded', String(this.expanded));
    this.toggle.setAttribute(
      'aria-label',
      this.raceActive
        ? this.expanded ? 'Contraer cronómetro' : 'Expandir cronómetro'
        : 'Cerrar tiempos de vuelta',
    );
  }

  private required<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Falta ${selector} en LapTimingHud`);
    return element;
  }
}
