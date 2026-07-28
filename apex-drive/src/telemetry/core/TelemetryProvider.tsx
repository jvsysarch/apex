import { createContext, type ReactNode, useContext, useSyncExternalStore } from 'react';
import type { TelemetryFrame } from './TelemetryFrame';
import type { TelemetryReader } from './TelemetryStore';

const TelemetryContext = createContext<TelemetryReader | null>(null);

export interface TelemetryProviderProps {
  readonly source: TelemetryReader;
  readonly children: ReactNode;
}

/** Entrega a React únicamente la capacidad de observar snapshots. */
export function TelemetryProvider({ source, children }: TelemetryProviderProps) {
  return <TelemetryContext.Provider value={source}>{children}</TelemetryContext.Provider>;
}

/** Los componentes obtienen datos; nunca reciben store, publisher ni física. */
export function useTelemetryFrame(): Readonly<TelemetryFrame> | undefined {
  const source = useContext(TelemetryContext);
  if (!source) throw new Error('useTelemetryFrame must be used inside TelemetryProvider');

  return useSyncExternalStore(
    listener => source.subscribe(listener),
    () => source.getSnapshot(),
    () => source.getSnapshot(),
  );
}
