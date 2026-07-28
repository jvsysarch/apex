import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const debugPort = process.argv[2] ?? '9232';
const appPort = process.argv[3] ?? '5175';
const reportOnly = process.argv.includes('--report-only');
const artifactDirectory = resolve('artifacts');
const artifact = name => resolve(artifactDirectory, name);
const readJson = name => JSON.parse(readFileSync(artifact(name), 'utf8'));
const run = (script, ...arguments_) => execFileSync(
  process.execPath,
  [resolve(script), ...arguments_],
  { cwd: resolve('.'), stdio: 'inherit' },
);

if (!reportOnly) {
  // El orden es parte del contrato: ningún stage posterior se anticipa.
  run('scripts/audit-tire-curves.mjs', debugPort, appPort);
}
const offline = readJson('multicontact-force-model-offline.json');
const offlineCandidates = Object.entries(offline.summary)
  .filter(([, result]) => result.eligible)
  .map(([model]) => model);
if (offlineCandidates.length === 0) {
  throw new Error('No tire model passed the offline mathematical gates');
}

if (!reportOnly) {
  run('scripts/audit-tire-maneuvers.mjs', debugPort, appPort, '60', '4',
    offlineCandidates.join(','));
}
const maneuvers = readJson('multicontact-force-model-maneuvers.json');
const winner = maneuvers.selection?.winner;
if (!winner || !maneuvers.eligibility?.[winner]?.eligible) {
  throw new Error('No tire model passed the three maneuver gates');
}

const raceScenarioByModel = {
  'apex-brush-v1': 'apexBrush',
  'apex-tmeasy-v1': 'apexTMeasy',
};
const raceScenario = raceScenarioByModel[winner];
if (!raceScenario) throw new Error(`No race scenario for selected model ${winner}`);
if (!reportOnly) {
  run(
    'scripts/audit-race-circuit.mjs',
    debugPort,
    appPort,
    raceScenario,
    '--save=multicontact-force-model-winner-lap.json',
  );
}
const lap = readJson('multicontact-force-model-winner-lap.json');
const lapEntry = lap.results?.[raceScenario];
if (Object.keys(lap.results ?? {}).length !== 1 || lapEntry?.model !== winner) {
  throw new Error('Winner lap artifact contains an unselected model');
}
if (!lapEntry.metrics.completedLap) {
  throw new Error('The selected model did not complete the lap; 8x360 remains blocked');
}

if (!reportOnly) {
  run('scripts/audit-tire-maneuvers.mjs', debugPort, appPort, '360', '8', winner);
}
const stress = readJson('multicontact-force-model-8x360.json');
if (Object.keys(stress.results ?? {}).length !== 1
  || !stress.eligibility?.[winner]?.eligible
  || stress.physicsHz !== 360
  || stress.contactCount !== 8) {
  throw new Error('Post-selection 8-contact / 360 Hz gate failed');
}

const stageTimes = [
  offline.generatedAt,
  maneuvers.generatedAt,
  lap.generatedAt,
  stress.generatedAt,
].map(value => Date.parse(value));
if (stageTimes.some(value => !Number.isFinite(value))
  || stageTimes.some((value, index) => index > 0 && value < stageTimes[index - 1])) {
  throw new Error('Artifact timestamps do not preserve the required stage order');
}

const winnerManeuvers = maneuvers.results[winner];
const stressManeuvers = stress.results[winner];
const summary = {
  generatedAt: new Date().toISOString(),
  stageOrderVerified: true,
  winner,
  selectionRanking: maneuvers.selection.ranking,
  thresholds: maneuvers.thresholds,
  offline: Object.fromEntries(Object.entries(offline.summary).map(([model, result]) => [
    model,
    {
      eligible: result.eligible,
      maximumNormalizedAdjacentJump: result.maximumNormalizedAdjacentJump,
      maximumCombinedEnvelopeDemand: result.maximumCombinedEnvelopeDemand,
    },
  ])),
  maneuvers60Hz4Contacts: {
    recoveryTimeSeconds: winnerManeuvers.countersteer.recoveryTimeSeconds,
    maximumSustainedSlipRatioSeconds: Math.max(
      ...Object.values(winnerManeuvers).map(
        result => result.maximumSustainedSlipRatioSeconds,
      ),
    ),
    straightMaximumSpeedKmh:
      winnerManeuvers['straight-acceleration'].maximumSpeedKmh,
    constantRadiusMaximumSpeedKmh:
      winnerManeuvers['constant-radius'].maximumSpeedKmh,
  },
  winnerLap: {
    model: lapEntry.model,
    completedLap: lapEntry.metrics.completedLap,
    elapsedSeconds: lapEntry.metrics.elapsedSeconds,
    traceHash: lapEntry.metrics.traceHash,
    secondsAllWheelsOffTrack: lapEntry.metrics.secondsAllWheelsOffTrack,
  },
  postSelection8Contacts360Hz: {
    eligible: stress.eligibility[winner].eligible,
    configuredContactCount: stress.contactCount,
    physicsHz: stress.physicsHz,
    recoveryTimeSeconds: stressManeuvers.countersteer.recoveryTimeSeconds,
    maximumSustainedSlipRatioSeconds: Math.max(
      ...Object.values(stressManeuvers).map(
        result => result.maximumSustainedSlipRatioSeconds,
      ),
    ),
    traceHashes: Object.fromEntries(Object.entries(stressManeuvers).map(
      ([maneuver, result]) => [maneuver, result.traceHash],
    )),
  },
};

mkdirSync(artifactDirectory, { recursive: true });
writeFileSync(
  artifact('tire-model-selection-summary.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
);
console.log(JSON.stringify(summary, null, 2));
