import WebSocket from 'ws';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const debugPort = process.argv[2] ?? '9232';
const appPort = process.argv[3] ?? '5175';
const targets = await fetch(`http://127.0.0.1:${debugPort}/json`).then(response => response.json());
const target = targets.find(candidate => candidate.type === 'page');
if (!target) throw new Error('No page target found');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
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

function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression, awaitPromise = false) {
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

async function run(model, stage = 'legacy', parameters = {}) {
  const query = new URLSearchParams({
    ui: 'off',
    audit: 'race',
    auditModel: model,
    auditStage: stage,
  });
  for (const [key, value] of Object.entries(parameters)) query.set(key, String(value));
  await send('Page.navigate', {
    url: `http://127.0.0.1:${appPort}/?${query}`,
  });
  await evaluate(`new Promise((resolve, reject) => {
    const started = performance.now();
    const poll = () => {
      if (window.__apexRaceAuditResult) resolve(true);
      else if (performance.now() - started > 45000) reject(new Error(
        'Race audit timeout: ' + (document.querySelector('#render-canvas')?.dataset.runtimeStatus ?? '')
      ));
      else setTimeout(poll, 20);
    };
    poll();
  })`, true);
  return evaluate('window.__apexRaceAuditResult');
}

await send('Runtime.enable');
await send('Page.enable');

const normalize = result => ({
  completedLap: result.completedLap,
  traceHash: result.traceHash,
  elapsedSeconds: result.elapsedSeconds,
  lapProgressPercent: result.lapProgressPercent,
  distanceTravelledM: result.distanceTravelledM,
  averageSpeedKmh: result.averageSpeedKmh,
  maximumSpeedKmh: result.maximumSpeedKmh,
  maximumLateralAccelerationG: result.maximumLateralAccelerationG,
  lateralAccelerationP95G: result.lateralAccelerationP95G,
  maximumAbsYawRate: result.maximumAbsYawRate,
  maximumSlipRatio: result.maximumSlipRatio,
  slipRatioP95: result.slipRatioP95,
  maximumSlipAngleDeg: result.maximumSlipAngleDeg,
  slipAngleP95Deg: result.slipAngleP95Deg,
  secondsWithAnyWheelOnGrass: result.wheelSamplesOnGrass / (4 * 60),
  secondsAllWheelsOffTrack: result.allWheelsOffTrackSamples / 60,
  secondsOnGravelPerWheel: result.wheelSamplesOnGravel / (4 * 60),
  contactLossSecondsPerWheel: result.contactLossSamples / (4 * 60),
  maximumWheelLoadN: result.maximumWheelLoadN,
  wheelLoadP95N: result.wheelLoadP95N,
  averageRequestedEngineTorqueNm: result.averageRequestedEngineTorqueNm,
  averageDeliveredEngineTorqueNm: result.averageDeliveredEngineTorqueNm,
  averageDeliveredAxleTorqueNm: result.averageDeliveredAxleTorqueNm,
  averageDeliveredWheelTorqueNm: result.averageDeliveredWheelTorqueNm,
  averageAerodynamicDragN: result.averageAerodynamicDragN,
  averageAerodynamicDownforceN: result.averageAerodynamicDownforceN,
  crossTrackErrorRmsM: result.crossTrackErrorRmsM,
  maximumCrossTrackErrorM: result.maximumCrossTrackErrorM,
  offTrackSecondsBySegment: result.offTrackSecondsBySegment,
  segmentsPassed: result.segmentPasses.length,
  segmentPasses: result.segmentPasses,
});

const scenarios = [
  { key: 'joltDefault', model: 'jolt-default', stage: 'legacy' },
  { key: 'apexV11', model: 'apex-v1.1', stage: 'legacy' },
  { key: 'A_mechanicalTc', model: 'apex-v1.1', stage: 'mechanical-tc' },
  { key: 'B_differentials', model: 'apex-v1.1', stage: 'differentials' },
  { key: 'C_apexTireV12', model: 'apex-v1.2', stage: 'tire-v1.2' },
  { key: 'D_steering', model: 'apex-v1.1', stage: 'steering' },
  { key: 'E_suspension', model: 'apex-v1.1', stage: 'suspension' },
  { key: 'F_aero', model: 'apex-v1.1', stage: 'aero' },
  { key: 'tireOnlyV11', model: 'apex-v1.1', stage: 'tire-only' },
  { key: 'apexBrush', model: 'apex-brush-v1', stage: 'legacy' },
  { key: 'apexTMeasy', model: 'apex-tmeasy-v1', stage: 'legacy' },
];

const parameters = Object.freeze({
  common: {
    physicsHz: 60,
    massKg: 1550,
    awdBaselineFrontRear: [0.45, 0.55],
    suspensionFrequencyHz: [1.5, 1.5],
    suspensionDamping: [0.5, 0.5],
    antiRollStiffness: [1000, 1000],
    baselineAero: {
      airDensity: 1.225,
      dragArea: 0.72,
      downforceArea: 1.55,
      frontBalance: 0.46,
      maximumDownforceN: 6500,
    },
  },
  mechanicalTc: {
    enterSlip: 0.14,
    exitSlip: 0.08,
    fullInterventionSlip: 0.55,
    maximumWheelReduction: 0.88,
    minimumDeliveredTorqueScale: 0.28,
    attackPerSecond: 18,
    releasePerSecond: 6,
  },
  differentials: {
    frontLsdRatio: 1.18,
    rearLsdRatio: 1.22,
    centralLsdRatio: 1.2,
    frontTorqueRatioBounds: [0.25, 0.7],
    axleRatioRatePerSecond: 0.8,
    wheelSplitRatePerSecond: 2.8,
  },
  tireV12: {
    referenceLoadN: 3800,
    loadSensitivityExponent: 0.86,
    lateralRiseExponent: 0.54,
    minimumLateralRetention: 0.88,
    combinedGripExponent: 3.8,
    lateralMidSlipBoost: 0.045,
  },
  surfaces: {
    asphalt: {
      longitudinalMu: 1.16,
      lateralMu: 1.12,
      peakSlipRatio: 0.11,
      peakSlipAngleDegrees: 7,
      slidingGripRetention: 0.76,
      breakawayFalloff: 1.35,
    },
    grass: {
      longitudinalMu: 0.48,
      lateralMu: 0.42,
      peakSlipRatio: 0.2,
      peakSlipAngleDegrees: 14,
      slidingGripRetention: 0.58,
      breakawayFalloff: 0.72,
    },
    gravel: {
      longitudinalMu: 0.7,
      lateralMu: 0.62,
      peakSlipRatio: 0.17,
      peakSlipAngleDegrees: 11,
      slidingGripRetention: 0.66,
      breakawayFalloff: 0.85,
    },
    wetAsphalt: {
      longitudinalMu: 0.82,
      lateralMu: 0.76,
      peakSlipRatio: 0.14,
      peakSlipAngleDegrees: 9,
      slidingGripRetention: 0.68,
      breakawayFalloff: 1.05,
    },
  },
  steering: {
    maximumAngleDegreesLowHighSpeed: [32, 14],
    speedRangeKmh: [20, 120],
    turnInRatePerSecondLowHighSpeed: [2.6, 1.5],
    releaseRatePerSecond: 4.2,
    ackermann: true,
  },
  suspension: {
    frequencyHzFrontRear: [1.8, 1.65],
    dampingFrontRear: [0.65, 0.6],
    antiRollStiffnessFrontRear: [1500, 1150],
  },
  aero: {
    airDensity: 1.225,
    dragArea: 0.66,
    downforceArea: 1.82,
    frontBalance: 0.47,
    maximumDownforceN: 6500,
  },
});
const scenarioArgument = process.argv.slice(4).find(argument => !argument.startsWith('--')) ?? '';
const requestedKeys = new Set(scenarioArgument.split(',').filter(Boolean));
const selectedScenarios = requestedKeys.size === 0
  ? scenarios
  : scenarios.filter(scenario => requestedKeys.has(scenario.key));
const results = {};
for (const scenario of selectedScenarios) {
  results[scenario.key] = {
    model: scenario.model,
    stage: scenario.stage,
    parameters: scenario.parameters ?? {},
    metrics: normalize(await run(scenario.model, scenario.stage, scenario.parameters)),
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  benchmark: 'RaceCircuitAudit',
  parameters,
  results,
};
const serialized = JSON.stringify(report, null, 2);
const compactResults = Object.fromEntries(Object.entries(results).map(([key, value]) => {
  const metrics = value.metrics;
  return [key, {
    model: value.model,
    parameters: value.parameters,
    completedLap: metrics.completedLap,
    traceHash: metrics.traceHash,
    elapsedSeconds: metrics.elapsedSeconds,
    averageSpeedKmh: metrics.averageSpeedKmh,
    maximumSpeedKmh: metrics.maximumSpeedKmh,
    secondsAllWheelsOffTrack: metrics.secondsAllWheelsOffTrack,
    crossTrackErrorRmsM: metrics.crossTrackErrorRmsM,
    slipRatioP95: metrics.slipRatioP95,
    slipAngleP95Deg: metrics.slipAngleP95Deg,
    lateralAccelerationP95G: metrics.lateralAccelerationP95G,
    maximumAbsYawRate: metrics.maximumAbsYawRate,
  }];
}));
console.log(process.argv.includes('--summary')
  ? JSON.stringify(compactResults, null, 2)
  : serialized);
const namedSave = process.argv.find(argument => argument.startsWith('--save='));
if (process.argv.includes('--save') || namedSave) {
  const outputDirectory = resolve('artifacts');
  mkdirSync(outputDirectory, { recursive: true });
  const outputName = namedSave
    ? namedSave.slice('--save='.length).replace(/[^a-zA-Z0-9._-]/g, '-')
    : 'race-circuit-audit.json';
  writeFileSync(resolve(outputDirectory, outputName), `${serialized}\n`);
}
socket.close();
