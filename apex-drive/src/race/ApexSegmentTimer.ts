const FORMAT = 'apex-drive-rally-segment-times';
const FORMAT_VERSION = 1;

export const APEX_RALLY_SEGMENT_COUNT = 10;

interface StoredSegmentTimes {
  readonly format: typeof FORMAT;
  readonly formatVersion: typeof FORMAT_VERSION;
  readonly segmentCount: typeof APEX_RALLY_SEGMENT_COUNT;
  readonly bestTimesMs: readonly number[];
}

export interface ApexSegmentTimingSnapshot {
  readonly activeSegmentIndex: number;
  readonly activeElapsedMs: number;
  readonly currentLapTimesMs: readonly (number | undefined)[];
  readonly previousLapTimesMs: readonly (number | undefined)[];
  readonly bestTimesMs: readonly (number | undefined)[];
  readonly lastCompletedSegmentIndex?: number;
  readonly lastCompletedTimeMs?: number;
  readonly lastDeltaToBestMs?: number;
}

const emptyTimes = (): (number | undefined)[] => (
  Array.from({ length: APEX_RALLY_SEGMENT_COUNT }, () => undefined)
);

const validTime = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined
);

export class ApexSegmentTimer {
  private storageKey: string;
  private bestTimesMs: (number | undefined)[] = emptyTimes();
  private currentLapTimesMs: (number | undefined)[] = emptyTimes();
  private previousLapTimesMs: (number | undefined)[] = emptyTimes();
  private activeSegmentIndex?: number;
  private segmentStartedAtMs = 0;
  private segmentHasStartBoundary = false;
  private lastCompletedSegmentIndex?: number;
  private lastCompletedTimeMs?: number;
  private lastDeltaToBestMs?: number;

  constructor(storageKey: string) {
    this.storageKey = storageKey;
    this.restore();
  }

  configure(storageKey: string): void {
    this.storageKey = storageKey;
    this.bestTimesMs = emptyTimes();
    this.restore();
    this.resetTracking();
  }

  update(
    progress: number,
    nowMs: number,
    enabled: boolean,
  ): ApexSegmentTimingSnapshot {
    if (!enabled) {
      this.resetTracking();
      return this.snapshot(0);
    }
    const wrappedProgress = ((progress % 1) + 1) % 1;
    const nextSegmentIndex = Math.min(
      APEX_RALLY_SEGMENT_COUNT - 1,
      Math.floor(wrappedProgress * APEX_RALLY_SEGMENT_COUNT),
    );
    if (this.activeSegmentIndex === undefined) {
      this.activeSegmentIndex = nextSegmentIndex;
      this.segmentStartedAtMs = nowMs;
      return this.snapshot(0);
    }
    if (nextSegmentIndex !== this.activeSegmentIndex) {
      const forwardSteps = (
        nextSegmentIndex
        - this.activeSegmentIndex
        + APEX_RALLY_SEGMENT_COUNT
      ) % APEX_RALLY_SEGMENT_COUNT;
      if (forwardSteps === 1) {
        this.completeActiveSegment(nowMs);
        if (nextSegmentIndex === 0) {
          this.previousLapTimesMs = [...this.currentLapTimesMs];
          this.currentLapTimesMs = emptyTimes();
        }
        this.activeSegmentIndex = nextSegmentIndex;
        this.segmentStartedAtMs = nowMs;
        this.segmentHasStartBoundary = true;
      }
    }
    return this.snapshot(Math.max(0, nowMs - this.segmentStartedAtMs));
  }

  private completeActiveSegment(nowMs: number): void {
    if (
      this.activeSegmentIndex === undefined
      || !this.segmentHasStartBoundary
    ) return;
    const elapsedMs = Math.max(1, nowMs - this.segmentStartedAtMs);
    const segmentIndex = this.activeSegmentIndex;
    const previousBestMs = this.bestTimesMs[segmentIndex];
    this.currentLapTimesMs[segmentIndex] = elapsedMs;
    this.lastCompletedSegmentIndex = segmentIndex;
    this.lastCompletedTimeMs = elapsedMs;
    this.lastDeltaToBestMs = previousBestMs === undefined
      ? 0
      : elapsedMs - previousBestMs;
    if (previousBestMs === undefined || elapsedMs < previousBestMs) {
      this.bestTimesMs[segmentIndex] = elapsedMs;
      this.persist();
    }
  }

  private snapshot(activeElapsedMs: number): ApexSegmentTimingSnapshot {
    return Object.freeze({
      activeSegmentIndex: this.activeSegmentIndex ?? 0,
      activeElapsedMs,
      currentLapTimesMs: Object.freeze([...this.currentLapTimesMs]),
      previousLapTimesMs: Object.freeze([...this.previousLapTimesMs]),
      bestTimesMs: Object.freeze([...this.bestTimesMs]),
      lastCompletedSegmentIndex: this.lastCompletedSegmentIndex,
      lastCompletedTimeMs: this.lastCompletedTimeMs,
      lastDeltaToBestMs: this.lastDeltaToBestMs,
    });
  }

  private resetTracking(): void {
    this.currentLapTimesMs = emptyTimes();
    this.previousLapTimesMs = emptyTimes();
    this.activeSegmentIndex = undefined;
    this.segmentStartedAtMs = 0;
    this.segmentHasStartBoundary = false;
    this.lastCompletedSegmentIndex = undefined;
    this.lastCompletedTimeMs = undefined;
    this.lastDeltaToBestMs = undefined;
  }

  private restore(): void {
    try {
      const stored = JSON.parse(
        localStorage.getItem(this.storageKey) ?? 'null',
      ) as Partial<StoredSegmentTimes> | null;
      if (
        stored?.format !== FORMAT
        || stored.formatVersion !== FORMAT_VERSION
        || stored.segmentCount !== APEX_RALLY_SEGMENT_COUNT
        || !Array.isArray(stored.bestTimesMs)
      ) return;
      this.bestTimesMs = Array.from(
        { length: APEX_RALLY_SEGMENT_COUNT },
        (_, index) => validTime(stored.bestTimesMs?.[index]),
      );
    } catch {
      this.bestTimesMs = emptyTimes();
    }
  }

  private persist(): void {
    try {
      const stored: StoredSegmentTimes = {
        format: FORMAT,
        formatVersion: FORMAT_VERSION,
        segmentCount: APEX_RALLY_SEGMENT_COUNT,
        bestTimesMs: this.bestTimesMs.map(value => value ?? 0),
      };
      localStorage.setItem(this.storageKey, JSON.stringify(stored));
    } catch {
      // Los parciales de la sesión siguen disponibles sin localStorage.
    }
  }
}
