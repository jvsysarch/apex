import assert from 'node:assert/strict';
import test from 'node:test';
import type { LapTimingState } from '../src/race/ApexLapTimer.ts';
import { resolveApexHudRaceTiming } from '../src/ui/ether/ApexHudRaceAuthority.ts';

const state = Object.freeze<LapTimingState>({
  phase: 'running',
  hudVisibility: 'visible',
  elapsedMs: 10_000,
  lapNumber: 2,
  completedLapCount: 1,
  laps: Object.freeze([81_000]),
  lapRecords: Object.freeze([]),
  bestLapMs: 80_000,
  lastLapMs: 81_000,
  lapDeltaMs: 1_000,
  checkpointIndex: 1,
  checkpointCount: 3,
  checkpointStatuses: Object.freeze(['passed', 'pending', 'pending']),
  sectorIndex: 0,
  sectorCount: 3,
  countdownLights: 0,
  startLights: 'green',
  startZoneInside: false,
  startProximity: 0,
  startReady: false,
  message: 'Vuelta en curso',
});

test('Ether keeps the anonymous local best before authentication', () => {
  const timing = resolveApexHudRaceTiming(state);
  assert.equal(timing.bestLapMs, 80_000);
  assert.equal(timing.lapDeltaMs, 1_000);
});

test('Ether uses the Void best even when the anonymous local best is faster', () => {
  const timing = resolveApexHudRaceTiming(state, { bestLapMs: 90_000 });
  assert.equal(timing.bestLapMs, 90_000);
  assert.equal(timing.lapDeltaMs, -9_000);
});

test('Ether does not leak a local best into an authenticated profile without records', () => {
  const timing = resolveApexHudRaceTiming(state, { bestLapMs: undefined });
  assert.equal(timing.bestLapMs, undefined);
  assert.equal(timing.lapDeltaMs, undefined);
});
