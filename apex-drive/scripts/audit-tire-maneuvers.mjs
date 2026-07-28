import WebSocket from 'ws';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const debugPort = process.argv[2] ?? '9232';
const appPort = process.argv[3] ?? '5175';
const targets = await fetch(`http://127.0.0.1:${debugPort}/json`).then(response => response.json());
const target = targets.find(candidate => candidate.type === 'page');
if (!target) throw new Error('No page target found');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolveOpen, reject) => {
  socket.addEventListener('open', resolveOpen, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const operation = pending.get(message.id);
  if (!operation) return;
  pending.delete(message.id);
  if (message.error) operation.reject(new Error(message.error.message));
  else operation.resolve(message.result);
});
const send = (method, params = {}) => {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveSend, reject) => pending.set(id, {
    resolve: resolveSend,
    reject,
  }));
};
const evaluate = async (expression, awaitPromise = false) => {
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  }
  return response.result.value;
};

const models = [
  { key: 'apex-brush-v1', model: 'apex-brush-v1' },
  { key: 'apex-tmeasy-v1', model: 'apex-tmeasy-v1' },
];
const maneuvers = ['straight-acceleration', 'constant-radius', 'countersteer'];
const physicsHzArgument = Number(process.argv[4] ?? 60);
const physicsHz = physicsHzArgument === 360 ? 360 : 60;
const contactCountArgument = Number(process.argv[5] ?? 4);
const contactCount = contactCountArgument === 8 ? 8 : 4;
const requestedModels = new Set(
  (process.argv[6] ?? '').split(',').filter(Boolean),
);
const requestedAuditStage = process.argv[7] ?? 'tire-benchmark';
const auditStage = [
  'legacy',
  'tire-only',
  'tire-benchmark',
  'mechanical-tc',
  'differentials',
  'tire-v1.2',
  'steering',
  'suspension',
  'aero',
].includes(requestedAuditStage)
  ? requestedAuditStage
  : 'tire-benchmark';
const requestedOutputFilename = process.argv[8];
const requestedTireBackend = process.argv[9] === 'typescript'
  ? 'typescript'
  : 'auto';
const selectedModels = requestedModels.size === 0
  ? models
  : models.filter(candidate => requestedModels.has(candidate.key));

await send('Runtime.enable');
await send('Page.enable');
const results = {};
for (const candidate of selectedModels) {
  results[candidate.key] = {};
  for (const maneuver of maneuvers) {
    const query = new URLSearchParams({
      ui: 'off',
      audit: 'tire-maneuver',
      auditModel: candidate.model,
      auditStage,
      maneuver,
      physicsHz: String(physicsHz),
      contactCount: String(contactCount),
      tireBackend: requestedTireBackend,
    });
    await send('Page.navigate', { url: `http://localhost:${appPort}/?${query}` });
    await evaluate(`new Promise((resolveResult, reject) => {
      const started = performance.now();
      const poll = () => {
        if (window.__apexTireManeuverResult) resolveResult(true);
        else if (performance.now() - started > 15000) reject(new Error(
          'Tire maneuver timeout: '
            + (document.querySelector('#render-canvas')?.dataset.runtimeStatus ?? '')
        ));
        else setTimeout(poll, 20);
      };
      poll();
    })`, true);
    results[candidate.key][maneuver] = await evaluate(
      'window.__apexTireManeuverResult',
    );
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  physicsHz,
  contactCount,
  durationSeconds: 8,
  assists: auditStage,
  requestedTireBackend,
  results,
};
const outputDirectory = resolve('artifacts');
mkdirSync(outputDirectory, { recursive: true });
const outputFilename = requestedOutputFilename ?? (
  physicsHz === 360
    ? 'multicontact-force-model-8x360.json'
    : 'multicontact-force-model-maneuvers.json'
);
writeFileSync(
  resolve(outputDirectory, outputFilename),
  `${JSON.stringify(report, null, 2)}\n`,
);
const compact = Object.fromEntries(Object.entries(results).map(([model, modelResults]) => [
  model,
  Object.fromEntries(Object.entries(modelResults).map(([maneuver, result]) => [
    maneuver,
    {
      hash: result.traceHash,
      maximumSpeedKmh: result.maximumSpeedKmh,
      slipRatioP95: result.slipRatioP95,
      slipAngleP95Deg: result.slipAngleP95Deg,
      lateralAccelerationP95G: result.lateralAccelerationP95G,
      maximumAbsYawRate: result.maximumAbsYawRate,
      sustainedSlipRatioSeconds: result.sustainedSlipRatioSeconds,
      maximumSustainedSlipRatioSeconds: result.maximumSustainedSlipRatioSeconds,
      reachedTwentyFiveDegreeDrift: result.reachedTwentyFiveDegreeDrift,
      recoveryTimeSeconds: result.recoveryTimeSeconds,
      extraDistanceM: result.extraDistanceM,
      configuredTireContactCount: result.configuredTireContactCount,
      maximumEvaluatedTireContactCount: result.maximumEvaluatedTireContactCount,
      physicsHz: result.physicsHz,
      tireExecutionBackend: result.tireExecutionBackend,
      tireExecutionPreference: result.tireExecutionPreference,
    },
  ])),
]));
const thresholds = {
  longitudinalSlipRatio: 0.6,
  sustainedMinimumSeconds: 0.25,
  countersteerFromDegrees: 25,
  countersteerToDegrees: 5,
  maximumRecoverySeconds: 0.5,
};
const eligibility = Object.fromEntries(Object.entries(results).map(([model, modelResults]) => {
  const values = Object.values(modelResults);
  const finite = values.every(result => Object.values(result).every(value => (
    typeof value !== 'number' || Number.isFinite(value)
  )));
  const sustainedSlipPass = values.every(result => (
    result.maximumSustainedSlipRatioSeconds < thresholds.sustainedMinimumSeconds
  ));
  const recovery = modelResults.countersteer;
  const recoveryPass = recovery.reachedTwentyFiveDegreeDrift
    && recovery.recoveryTimeSeconds !== null
    && recovery.recoveryTimeSeconds <= thresholds.maximumRecoverySeconds;
  const contactConfigurationPass = values.every(result => (
    result.physicsHz === physicsHz
    && result.configuredTireContactCount === contactCount
    && result.maximumEvaluatedTireContactCount === contactCount
  ));
  const expectedBackend = requestedTireBackend === 'typescript'
    ? 'typescript'
    : 'wasm';
  const executionBackendPass = values.every(result => (
    result.tireExecutionBackend === expectedBackend
    && result.tireExecutionPreference === requestedTireBackend
  ));
  return [model, {
    eligible: finite
      && sustainedSlipPass
      && recoveryPass
      && contactConfigurationPass
      && executionBackendPass,
    finite,
    sustainedSlipPass,
    recoveryPass,
    contactConfigurationPass,
    executionBackendPass,
  }];
}));
const eligibleModels = Object.keys(eligibility).filter(model => eligibility[model].eligible);
const rankedModels = eligibleModels.sort((left, right) => {
  const leftResults = results[left];
  const rightResults = results[right];
  return leftResults.countersteer.recoveryTimeSeconds
      - rightResults.countersteer.recoveryTimeSeconds
    || rightResults['straight-acceleration'].maximumSpeedKmh
      - leftResults['straight-acceleration'].maximumSpeedKmh
    || rightResults['constant-radius'].maximumSpeedKmh
      - leftResults['constant-radius'].maximumSpeedKmh
    || left.localeCompare(right);
});
const winner = rankedModels[0] ?? null;
report.selection = {
  winner,
  ranking: rankedModels,
  order: [
    'lowest countersteer recovery time',
    'highest straight-line maximum speed',
    'highest constant-radius maximum speed',
    'stable model id',
  ],
};
report.thresholds = thresholds;
report.eligibility = eligibility;
writeFileSync(
  resolve(outputDirectory, outputFilename),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify({
  thresholds,
  eligibility,
  selection: report.selection,
  results: compact,
}, null, 2));
socket.close();
