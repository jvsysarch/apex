import type { TelemetryFrame } from './TelemetryFrame';

export type TelemetryListener = (frame: Readonly<TelemetryFrame>) => void;

/** Capacidad entregada a React: no contiene publish ni ningún comando. */
export interface TelemetryReader {
  getSnapshot(): Readonly<TelemetryFrame> | undefined;
  subscribe(listener: TelemetryListener): () => void;
}

/** Canal de distribución de sólo lectura. No conoce comandos ni tuning. */
export class TelemetryStore {
  private current?: Readonly<TelemetryFrame>;
  private readonly listeners = new Set<TelemetryListener>();

  /** Fachada runtime sin publish; es la única referencia que recibe React. */
  readonly reader: TelemetryReader = Object.freeze({
    getSnapshot: () => this.getSnapshot(),
    subscribe: (listener: TelemetryListener) => this.subscribe(listener),
  });

  publish(frame: Readonly<TelemetryFrame>): void {
    this.current = frame;
    for (const listener of this.listeners) listener(frame);
  }

  getSnapshot(): Readonly<TelemetryFrame> | undefined {
    return this.current;
  }

  subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
