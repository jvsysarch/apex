export interface ApexDriveFramePerformanceSample {
  readonly timestampMs: number;
  readonly intervalMs: number;
  readonly frameWorkMs: number;
  readonly physicsMs: number;
  readonly tireMs: number;
  readonly renderMs: number;
  readonly physicsSteps: number;
  readonly accumulatorMs: number;
  readonly renderCalls?: number;
  readonly triangles?: number;
}

interface ApexDrivePerformanceEvent {
  readonly capturedAtMs: number;
  readonly severity: 'warning' | 'critical';
  readonly cause: string;
  readonly detail: string;
}

interface ApexDrivePerformanceElements {
  readonly p95: HTMLOutputElement;
  readonly maximum: HTMLOutputElement;
  readonly spikes: HTMLOutputElement;
  readonly diagnosis: HTMLElement;
  readonly events: HTMLElement;
  readonly copyButton: HTMLButtonElement;
  readonly clearButton: HTMLButtonElement;
  readonly copyStatus: HTMLElement;
}

const FRAME_HISTORY_LIMIT = 900;
const EVENT_HISTORY_LIMIT = 80;
const UI_UPDATE_INTERVAL_MS = 400;

const percentile = (values: readonly number[], ratio: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  )] ?? 0;
};

const average = (values: readonly number[]): number => (
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length
);

const formatMs = (value: number): string => `${value.toFixed(1)} ms`;

const queryPerformanceElements = (): ApexDrivePerformanceElements => ({
  p95: document.querySelector<HTMLOutputElement>(
    '#render-performance-p95',
  )!,
  maximum: document.querySelector<HTMLOutputElement>(
    '#render-performance-maximum',
  )!,
  spikes: document.querySelector<HTMLOutputElement>(
    '#render-performance-spikes',
  )!,
  diagnosis: document.querySelector<HTMLElement>(
    '#render-performance-diagnosis',
  )!,
  events: document.querySelector<HTMLElement>(
    '#render-performance-events',
  )!,
  copyButton: document.querySelector<HTMLButtonElement>(
    '#render-performance-copy',
  )!,
  clearButton: document.querySelector<HTMLButtonElement>(
    '#render-performance-clear',
  )!,
  copyStatus: document.querySelector<HTMLElement>(
    '#render-performance-copy-status',
  )!,
});

export class ApexDrivePerformanceMonitor {
  private readonly elements = queryPerformanceElements();
  private readonly frames: ApexDriveFramePerformanceSample[] = [];
  private readonly events: ApexDrivePerformanceEvent[] = [];
  private readonly lastEventByCause = new Map<string, number>();
  private captureStartedAt = Date.now();
  private readonly observers: PerformanceObserver[] = [];
  private previousFrame?: ApexDriveFramePerformanceSample;
  private lastUiUpdateMs = 0;
  private longTaskCount = 0;
  private longestTaskMs = 0;
  private maximumInputDelayMs = 0;
  private renderCalls = 0;
  private triangles = 0;

  constructor(
    private readonly renderProfile: string,
    private readonly canvas: HTMLCanvasElement,
    private readonly tireDeformationMode: string,
  ) {
    this.elements.copyButton.addEventListener('click', () => {
      void this.copyReport();
    });
    this.elements.clearButton.addEventListener('click', () => {
      this.clear();
    });
    this.observeBrowserPauses();
    document.addEventListener('visibilitychange', () => {
      this.recordExternalEvent(
        document.hidden ? 'Pestaña oculta' : 'Pestaña visible nuevamente',
        document.hidden
          ? 'El navegador puede suspender frames y temporizadores.'
          : 'Se reanudó la medición después de estar en segundo plano.',
      );
    });
    window.addEventListener('resize', () => {
      this.recordExternalEvent(
        'Cambio de tamaño',
        `${window.innerWidth}×${window.innerHeight} · DPR ${window.devicePixelRatio}`,
      );
    });
    canvas.addEventListener('webglcontextlost', () => {
      this.recordEvent(
        'critical',
        'Contexto gráfico perdido',
        'El dispositivo o el navegador reinició el contexto de render.',
      );
    });
  }

  sample(sample: ApexDriveFramePerformanceSample): void {
    this.frames.push(sample);
    if (this.frames.length > FRAME_HISTORY_LIMIT) this.frames.shift();
    this.renderCalls = sample.renderCalls ?? this.renderCalls;
    this.triangles = sample.triangles ?? this.triangles;

    const previous = this.previousFrame;
    const missedFrame = sample.intervalMs >= 30;
    const expensiveWork = sample.frameWorkMs >= 20;
    if (missedFrame || expensiveWork) {
      const driver = (
        missedFrame
        && previous
        && previous.frameWorkMs >= sample.frameWorkMs
      ) ? previous : sample;
      this.recordFrameSpike(sample, driver);
    }
    this.previousFrame = sample;

    if (sample.timestampMs - this.lastUiUpdateMs >= UI_UPDATE_INTERVAL_MS) {
      this.lastUiUpdateMs = sample.timestampMs;
      this.updateUi();
    }
  }

  resetCapture(): void {
    this.clear();
  }

  createReport(): string {
    return this.buildReport();
  }

  private recordFrameSpike(
    observed: ApexDriveFramePerformanceSample,
    driver: ApexDriveFramePerformanceSample,
  ): void {
    const otherMs = Math.max(
      0,
      driver.frameWorkMs
        - driver.physicsMs
        - driver.tireMs
        - driver.renderMs,
    );
    const causes: string[] = [];
    if (driver.physicsMs >= 8) causes.push('simulación CPU');
    if (driver.tireMs >= 5) causes.push('deformación visual de ruedas');
    if (driver.renderMs >= 12) causes.push('render / backend gráfico');
    if (otherMs >= 10) causes.push('escena / UI / CPU');
    if (causes.length === 0 && driver.frameWorkMs >= 16.67) {
      causes.push('costo combinado sobre el presupuesto');
    }
    if (
      causes.length === 0
      && observed.intervalMs >= 30
      && driver.frameWorkMs < 16.67
    ) {
      causes.push('pausa externa o planificación del navegador');
    }
    if (causes.length === 0) causes.push('costo combinado');

    const severity = (
      observed.intervalMs >= 50
      || driver.frameWorkMs >= 50
    ) ? 'critical' : 'warning';
    this.recordEvent(
      severity,
      causes.join(' + '),
      [
        `intervalo ${formatMs(observed.intervalMs)}`,
        `trabajo ${formatMs(driver.frameWorkMs)}`,
        `física ${formatMs(driver.physicsMs)} (${driver.physicsSteps} pasos)`,
        `rueda ${formatMs(driver.tireMs)}`,
        `render ${formatMs(driver.renderMs)}`,
        `otro ${formatMs(otherMs)}`,
        `remanente ${(driver.accumulatorMs).toFixed(1)} ms`,
      ].join(' · '),
    );
  }

  private observeBrowserPauses(): void {
    if (typeof PerformanceObserver === 'undefined') return;
    this.tryObserve('longtask', entries => {
      entries.forEach(entry => {
        this.longTaskCount += 1;
        this.longestTaskMs = Math.max(this.longestTaskMs, entry.duration);
        this.recordEvent(
          entry.duration >= 100 ? 'critical' : 'warning',
          'Hilo principal bloqueado',
          `Long task ${formatMs(entry.duration)}.`,
        );
      });
    });
    this.tryObserve('event', entries => {
      entries.forEach(entry => {
        if (entry.duration < 40) return;
        this.maximumInputDelayMs = Math.max(
          this.maximumInputDelayMs,
          entry.duration,
        );
        this.recordEvent(
          entry.duration >= 100 ? 'critical' : 'warning',
          'Entrada demorada',
          `${entry.name || 'evento'} · ${formatMs(entry.duration)}.`,
        );
      });
    }, 40);
    this.tryObserve('gc', entries => {
      entries.forEach(entry => {
        this.recordEvent(
          entry.duration >= 20 ? 'critical' : 'warning',
          'Garbage collection',
          `Pausa observada ${formatMs(entry.duration)}.`,
        );
      });
    });
  }

  private tryObserve(
    entryType: string,
    onEntries: (entries: readonly PerformanceEntry[]) => void,
    durationThreshold?: number,
  ): void {
    try {
      const observer = new PerformanceObserver(list => {
        onEntries(list.getEntries());
      });
      observer.observe({
        type: entryType,
        buffered: true,
        ...(durationThreshold === undefined ? {} : { durationThreshold }),
      } as PerformanceObserverInit);
      this.observers.push(observer);
    } catch {
      // Cada API es opcional y depende del navegador.
    }
  }

  private recordExternalEvent(cause: string, detail: string): void {
    this.recordEvent('warning', cause, detail);
  }

  private recordEvent(
    severity: ApexDrivePerformanceEvent['severity'],
    cause: string,
    detail: string,
  ): void {
    const capturedAtMs = performance.now();
    const previousCauseAtMs = this.lastEventByCause.get(cause);
    if (
      previousCauseAtMs !== undefined
      && capturedAtMs - previousCauseAtMs < 500
    ) return;
    const last = this.events.at(-1);
    if (
      last
      && last.cause === cause
      && last.detail === detail
      && capturedAtMs - last.capturedAtMs < 1000
    ) return;
    this.lastEventByCause.set(cause, capturedAtMs);
    this.events.push({
      capturedAtMs,
      severity,
      cause,
      detail,
    });
    if (this.events.length > EVENT_HISTORY_LIMIT) this.events.shift();
  }

  private updateUi(): void {
    const intervals = this.frames.map(frame => frame.intervalMs);
    const p95Ms = percentile(intervals, 0.95);
    const maximumMs = intervals.length === 0 ? 0 : Math.max(...intervals);
    this.elements.p95.value = formatMs(p95Ms);
    this.elements.maximum.value = formatMs(maximumMs);
    this.elements.spikes.value = String(this.events.length);

    const latest = this.events.at(-1);
    this.elements.diagnosis.dataset.severity = latest?.severity ?? 'stable';
    this.elements.diagnosis.textContent = latest
      ? `Último indicio · ${latest.cause}`
      : 'Sin saltos detectados en esta captura.';
    const visibleEvents = this.events.slice(-6).reverse();
    this.elements.events.replaceChildren(
      ...visibleEvents.map(event => {
        const row = document.createElement('li');
        row.dataset.severity = event.severity;
        const elapsedSeconds = Math.max(
          0,
          (event.capturedAtMs - (this.frames[0]?.timestampMs ?? 0)) / 1000,
        );
        row.textContent = [
          `+${elapsedSeconds.toFixed(1)} s`,
          event.cause,
          event.detail,
        ].join(' · ');
        return row;
      }),
    );
    if (visibleEvents.length === 0) {
      const row = document.createElement('li');
      row.textContent = 'Esperando un salto…';
      this.elements.events.replaceChildren(row);
    }
  }

  private clear(): void {
    this.frames.length = 0;
    this.events.length = 0;
    this.lastEventByCause.clear();
    this.previousFrame = undefined;
    this.longTaskCount = 0;
    this.longestTaskMs = 0;
    this.maximumInputDelayMs = 0;
    this.captureStartedAt = Date.now();
    this.elements.copyStatus.textContent = 'Captura reiniciada.';
    this.updateUi();
  }

  private buildReport(): string {
    const values = <K extends keyof ApexDriveFramePerformanceSample>(
      key: K,
    ): number[] => this.frames.map(frame => Number(frame[key]) || 0);
    const summarize = (key: keyof ApexDriveFramePerformanceSample): string => {
      const samples = values(key);
      return [
        average(samples).toFixed(2),
        percentile(samples, 0.95).toFixed(2),
        percentile(samples, 0.99).toFixed(2),
        (samples.length === 0 ? 0 : Math.max(...samples)).toFixed(2),
      ].join(' / ');
    };
    const intervalSamples = values('intervalMs');
    const otherSamples = this.frames.map(frame => Math.max(
      0,
      frame.frameWorkMs
        - frame.physicsMs
        - frame.tireMs
        - frame.renderMs,
    ));
    const summarizeSamples = (samples: readonly number[]): string => [
      average(samples).toFixed(2),
      percentile(samples, 0.95).toFixed(2),
      percentile(samples, 0.99).toFixed(2),
      (samples.length === 0 ? 0 : Math.max(...samples)).toFixed(2),
    ].join(' / ');
    const eventCounts = new Map<string, number>();
    this.events.forEach(event => {
      eventCounts.set(event.cause, (eventCounts.get(event.cause) ?? 0) + 1);
    });
    const causes = [...eventCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([cause, count]) => `${cause}: ${count}`);
    const memory = performance as Performance & {
      memory?: { usedJSHeapSize?: number };
    };
    const memoryMb = memory.memory?.usedJSHeapSize === undefined
      ? 'no disponible'
      : `${(memory.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB`;
    const recentEvents = this.events.slice(-20).reverse();

    return [
      'APEX DRIVE · REPORTE DE FRAME PACING',
      `Capturado: ${new Date().toISOString()}`,
      `Navegador: ${navigator.userAgent}`,
      `Pantalla: ${window.innerWidth}x${window.innerHeight} · DPR ${window.devicePixelRatio}`,
      `Perfil de render: ${this.renderProfile}`,
      `Deformación visual de cubierta: ${this.tireDeformationMode}`,
      `Benchmark / distancia recorrida: ${this.canvas.dataset.controlledBenchmarkMode ?? 'manual'} / ${this.canvas.dataset.controlledBenchmarkDistanceM ?? 'n/a'} m`,
      `Velocidad benchmark promedio / mínima / máxima: ${this.canvas.dataset.controlledBenchmarkSpeedAverageKmh ?? 'n/a'} / ${this.canvas.dataset.controlledBenchmarkSpeedMinimumKmh ?? 'n/a'} / ${this.canvas.dataset.controlledBenchmarkSpeedMaximumKmh ?? 'n/a'} km/h`,
      `Pista: ${this.canvas.dataset.trackId ?? 'desconocida'}`,
      `Longitud / muestras: ${this.canvas.dataset.trackLengthM ?? '0'} m / ${this.canvas.dataset.trackSampleCount ?? '0'}`,
      `LOD pista: ${this.canvas.dataset.trackLod ?? 'desconocido'}`,
      `LOD chunks visibles / niveles: ${this.canvas.dataset.trackLodVisibleChunks ?? 'n/a'} / ${this.canvas.dataset.trackLodChunksByLevel ?? 'n/a'}`,
      `Mallas / triángulos activos de pista: ${this.canvas.dataset.trackLodActiveMeshes ?? 'n/a'} / ${this.canvas.dataset.trackLodActiveTriangles ?? 'n/a'}`,
      `Triángulos de pista a resolución completa: ${this.canvas.dataset.trackLodFullResolutionTriangles ?? 'n/a'}`,
      `Reducción visual efectiva por LOD: ${this.canvas.dataset.trackLodTriangleReductionPercent ?? 'n/a'} %`,
      `Colliders pista total / superficie / roadside / guardrail: ${this.canvas.dataset.trackCollisionTotalColliders ?? 'n/a'} / ${this.canvas.dataset.trackCollisionSurfaceColliders ?? 'n/a'} / ${this.canvas.dataset.trackCollisionRoadsideColliders ?? 'n/a'} / ${this.canvas.dataset.trackCollisionGuardrailColliders ?? 'n/a'}`,
      `Tipos de collider box / convex hull / triangle mesh: ${this.canvas.dataset.trackCollisionBoxColliders ?? 'n/a'} / ${this.canvas.dataset.trackCollisionConvexHullColliders ?? 'n/a'} / ${this.canvas.dataset.trackCollisionTriangleMeshColliders ?? 'n/a'}`,
      `Geometría de colisión input vertices / triángulos mesh: ${this.canvas.dataset.trackCollisionInputVertices ?? 'n/a'} / ${this.canvas.dataset.trackCollisionTriangleMeshTriangles ?? 'n/a'}`,
      `Tiempo de captura: ${((Date.now() - this.captureStartedAt) / 1000).toFixed(1)} s`,
      '',
      `Frames muestreados: ${this.frames.length}`,
      `FPS promedio: ${average(intervalSamples) > 0 ? (1000 / average(intervalSamples)).toFixed(1) : '0.0'}`,
      'Valores: promedio / p95 / p99 / máximo',
      `Intervalo frame: ${summarize('intervalMs')} ms`,
      `Trabajo frame: ${summarize('frameWorkMs')} ms`,
      `Física: ${summarize('physicsMs')} ms`,
      `Pasos físicos: ${summarize('physicsSteps')}`,
      `Rueda visual: ${summarize('tireMs')} ms`,
      `Render async CPU/backend: ${summarize('renderMs')} ms`,
      `Escena / UI / otro: ${summarizeSamples(otherSamples)} ms`,
      `Acumulador físico: ${summarize('accumulatorMs')} ms`,
      `Draw calls / triángulos: ${this.renderCalls} / ${this.triangles}`,
      `Memoria JS: ${memoryMb}`,
      `Long tasks: ${this.longTaskCount} · máximo ${formatMs(this.longestTaskMs)}`,
      `Mayor demora de entrada: ${formatMs(this.maximumInputDelayMs)}`,
      `Eventos registrados: ${this.events.length}`,
      '',
      'CAUSAS OBSERVADAS',
      ...(causes.length === 0 ? ['Ninguna.'] : causes),
      '',
      'EVENTOS RECIENTES',
      ...(recentEvents.length === 0
        ? ['Sin saltos detectados.']
        : recentEvents.map(event => [
            new Date(
              performance.timeOrigin + event.capturedAtMs,
            ).toISOString().slice(11, 23),
            event.severity.toUpperCase(),
            event.cause,
            event.detail,
          ].join(' · '))),
      '',
      'NOTA',
      'Render mide renderAsync completo: preparación CPU y costo observable del backend gráfico. El tiempo interno exacto de GPU requiere timestamps específicos del dispositivo.',
    ].join('\n');
  }

  private async copyReport(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.buildReport());
      this.elements.copyStatus.textContent = 'Reporte copiado.';
    } catch (error) {
      this.elements.copyStatus.textContent = (
        `No se pudo copiar: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
