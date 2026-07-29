import type { LapTimingState } from '../race/ApexLapTimer';

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

/** HUD persistente: no reconstruye DOM durante la vuelta. */
export class LapTimingHud {
  private readonly time: HTMLElement;
  private readonly lap: HTMLElement;
  private readonly delta: HTMLElement;
  private readonly status: HTMLElement;
  private readonly best: HTMLElement;
  private readonly bestDate: HTMLTimeElement;
  private readonly last: HTMLElement;
  private readonly sector: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly countdown: HTMLElement;
  private readonly countdownValue: HTMLElement;
  private readonly lights: HTMLElement[];

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <div class="lap-timing-card">
        <header><span>APEX CIRCUIT</span><strong>VUELTA CRONOMETRADA</strong></header>
        <div class="lap-start-lights" aria-label="Semáforo de salida">
          ${Array.from({ length: 5 }, (_, index) => `<i data-light="${index}"></i>`).join('')}
        </div>
        <div class="lap-timing-main">
          <span id="lap-timing-lap">VUELTA 1</span>
          <strong id="lap-timing-value">0:00.000</strong>
          <output id="lap-timing-delta">± —.———</output>
        </div>
        <div class="lap-progress"><i id="lap-timing-progress"></i></div>
        <p id="lap-timing-status" role="status" aria-live="polite">Detenete sobre la línea para armar la salida</p>
        <footer>
          <span>MEJOR
            <strong id="lap-timing-best">—:——.———</strong>
            <time id="lap-timing-best-date">SIN REGISTRO</time>
          </span>
          <span>ÚLTIMA <strong id="lap-timing-last">—:——.———</strong></span>
          <span>SECTOR <strong id="lap-timing-sector">1 / 3</strong></span>
        </footer>
      </div>
      <div id="lap-countdown" class="lap-countdown" hidden>
        <small>PREPARATE</small><strong id="lap-countdown-value">3</strong>
      </div>`;
    this.time = this.required('#lap-timing-value');
    this.lap = this.required('#lap-timing-lap');
    this.delta = this.required('#lap-timing-delta');
    this.status = this.required('#lap-timing-status');
    this.best = this.required('#lap-timing-best');
    this.bestDate = this.required<HTMLTimeElement>('#lap-timing-best-date');
    this.last = this.required('#lap-timing-last');
    this.sector = this.required('#lap-timing-sector');
    this.progress = this.required('#lap-timing-progress');
    this.countdown = this.required('#lap-countdown');
    this.countdownValue = this.required('#lap-countdown-value');
    this.lights = Array.from(root.querySelectorAll<HTMLElement>('[data-light]'));
  }

  update(state: LapTimingState): void {
    this.root.dataset.phase = state.phase;
    this.root.dataset.visibility = state.hudVisibility;
    this.time.textContent = formatTime(state.elapsedMs);
    this.lap.textContent = `VUELTA ${state.lapNumber}`;
    this.delta.textContent = formatDelta(state.lapDeltaMs);
    this.delta.dataset.sign = state.lapDeltaMs === undefined
      ? 'neutral'
      : state.lapDeltaMs <= 0 ? 'gain' : 'loss';
    this.status.textContent = state.message;
    this.best.textContent = formatTime(state.bestLapMs);
    this.bestDate.textContent = formatRecordDate(state.bestLapRecordedAtIso);
    this.bestDate.dateTime = state.bestLapRecordedAtIso ?? '';
    this.last.textContent = formatTime(state.lastLapMs);
    this.sector.textContent = `${state.sectorIndex + 1} / ${state.sectorCount}`;
    const progress = state.checkpointCount > 0
      ? state.checkpointIndex / state.checkpointCount
      : 0;
    this.progress.style.transform = `scaleX(${progress.toFixed(4)})`;
    this.lights.forEach((light, index) => {
      light.dataset.state = state.startLights === 'green'
        ? 'green'
        : state.startLights === 'red' && index < state.countdownLights
          ? 'red'
          : 'off';
    });
    this.countdown.hidden = state.phase !== 'countdown';
    this.countdownValue.textContent = String(state.countdownSeconds ?? '');
  }

  private required<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Falta ${selector} en LapTimingHud`);
    return element;
  }
}
