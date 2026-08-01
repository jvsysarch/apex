import type { ApexHudSlice, ApexHudState } from './ApexHudContract';

type ApexHudListener = () => void;

/**
 * Store externo por slices. React sólo puede observar; el publisher permanece
 * encapsulado en el runtime del HUD.
 */
export class ApexHudStore {
  private readonly snapshots: Partial<ApexHudState> = {};
  private readonly signatures: Partial<Record<ApexHudSlice, string>> = {};
  private readonly listeners: Record<ApexHudSlice, Set<ApexHudListener>> = {
    session: new Set(),
    motion: new Set(),
    navigation: new Set(),
    vehicle: new Set(),
    race: new Set(),
  };

  getSnapshot<K extends ApexHudSlice>(slice: K): ApexHudState[K] | undefined {
    return this.snapshots[slice];
  }

  subscribe(slice: ApexHudSlice, listener: ApexHudListener): () => void {
    this.listeners[slice].add(listener);
    return () => this.listeners[slice].delete(listener);
  }

  publish<K extends ApexHudSlice>(
    slice: K,
    snapshot: ApexHudState[K],
    signature: string,
  ): void {
    if (this.signatures[slice] === signature) return;
    this.signatures[slice] = signature;
    this.snapshots[slice] = snapshot;
    for (const listener of this.listeners[slice]) listener();
  }

  clear(slice: ApexHudSlice): void {
    delete this.signatures[slice];
    if (!(slice in this.snapshots)) return;
    delete this.snapshots[slice];
    for (const listener of this.listeners[slice]) listener();
  }
}
