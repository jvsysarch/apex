import type { LapTimerPhase, LapTimingState } from '../race/ApexLapTimer';

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
  private expanded = false;
  private manuallyOpened = false;
  private raceActive = false;
  private phase: LapTimerPhase = 'arming';

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
            <strong>SESIÓN LOCAL</strong>
          </header>
          <div class="lap-progress"><i id="lap-timing-progress"></i></div>
          <p id="lap-timing-status">HISTORIAL LOCAL</p>
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

    this.launcher.addEventListener('click', () => {
      this.manuallyOpened = true;
      this.expanded = true;
      this.applyVisibility();
    });
    this.toggle.addEventListener('click', () => {
      if (!this.raceActive) {
        this.manuallyOpened = false;
        this.expanded = false;
      } else {
        this.expanded = !this.expanded;
      }
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
      this.manuallyOpened = false;
      this.expanded = false;
    } else if (state.phase === 'countdown') {
      this.manuallyOpened = false;
      this.expanded = false;
    }
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
    this.status.textContent = state.phase === 'running'
      ? 'VUELTA EN CURSO'
      : state.phase === 'abandoned'
        ? 'SESIÓN FINALIZADA'
        : 'HISTORIAL LOCAL';
    this.best.textContent = formatTime(state.bestLapMs);
    this.bestDate.textContent = formatRecordDate(state.bestLapRecordedAtIso);
    this.bestDate.dateTime = state.bestLapRecordedAtIso ?? '';
    this.last.textContent = formatTime(state.lastLapMs);
    this.sector.textContent = `${state.sectorIndex + 1} / ${state.sectorCount}`;
    const progress = state.checkpointCount > 0
      ? state.checkpointIndex / state.checkpointCount
      : 0;
    this.progress.style.transform = `scaleX(${progress.toFixed(4)})`;
    this.applyVisibility();
  }

  private applyVisibility(): void {
    const showCard = this.raceActive || this.manuallyOpened;
    this.card.hidden = !showCard;
    this.launcher.hidden = (
      showCard
      || this.phase === 'countdown'
    );
    this.details.hidden = !this.expanded;
    this.root.dataset.mode = this.expanded ? 'expanded' : 'compact';
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
