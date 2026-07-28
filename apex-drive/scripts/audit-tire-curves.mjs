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
const evaluate = async expression => {
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  }
  return response.result.value;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: `http://127.0.0.1:${appPort}/?ui=off` });
await new Promise(resolveDelay => setTimeout(resolveDelay, 500));

const report = await evaluate(`(async () => {
  const [{ ApexBrush }, { ApexTMeasy }, surfaceModule] = await Promise.all([
    import('/src/physics/tires/force/ApexBrush.ts'),
    import('/src/physics/tires/force/ApexTMeasy.ts'),
    import('/src/physics/surfaces/SurfaceRegistry.ts'),
  ]);
  const models = [new ApexBrush(), new ApexTMeasy()];
  const loads = [2000, 3800, 6000];
  const slipRatios = Array.from({ length: 4001 }, (_, index) => -1 + index / 2000);
  const slipAnglesDegrees = Array.from(
    { length: 4001 },
    (_, index) => -60 + index * 120 / 4000,
  );
  const combinedSlipRatios = [-0.6, -0.3, 0, 0.3, 0.6];
  const combinedSlipAngles = [-30, -15, 0, 15, 30];
  const makeSample = overrides => ({
    wheelIndex: 0,
    verticalLoadN: 3800,
    slipRatio: 0,
    slipAngleRadians: 0,
    forwardSpeedMps: 20,
    angularVelocityRadPerSecond: 20 / 0.34,
    wheelRadiusM: 0.34,
    surface: surfaceModule.SURFACE_CATALOG[0],
    deltaTimeSeconds: 1 / 360,
    ...overrides,
  });
  const maximumJump = values => values.slice(1).reduce(
    (maximum, value, index) => Math.max(maximum, Math.abs(value - values[index])),
    0,
  );
  const maximumSymmetryError = values => {
    let maximum = 0;
    for (let index = 0; index < Math.floor(values.length / 2); index += 1) {
      maximum = Math.max(maximum, Math.abs(values[index] + values.at(-index - 1)));
    }
    return maximum;
  };
  const results = {};
  for (const model of models) {
    results[model.id] = {};
    for (const surface of surfaceModule.SURFACE_CATALOG) {
      results[model.id][surface.id] = {};
      for (const load of loads) {
        const fx = slipRatios.map(slipRatio => ({
          slipRatio,
          forceN: model.evaluate(makeSample({
            verticalLoadN: load,
            surface,
            slipRatio,
          })).longitudinalForceN,
        }));
        const fy = slipAnglesDegrees.map(slipAngleDegrees => ({
          slipAngleDegrees,
          forceN: model.evaluate(makeSample({
            verticalLoadN: load,
            surface,
            slipAngleRadians: slipAngleDegrees * Math.PI / 180,
          })).lateralForceN,
        }));
        const combined = combinedSlipRatios.flatMap(slipRatio => (
          combinedSlipAngles.map(slipAngleDegrees => {
            const forces = model.evaluate(makeSample({
              verticalLoadN: load,
              surface,
              slipRatio,
              slipAngleRadians: slipAngleDegrees * Math.PI / 180,
            }));
            return {
              slipRatio,
              slipAngleDegrees,
              fxN: forces.longitudinalForceN,
              fyN: forces.lateralForceN,
              mzNm: forces.aligningMomentNm,
            };
          })
        ));
        const absoluteFx = fx.map(sample => Math.abs(sample.forceN));
        const absoluteFy = fy.map(sample => Math.abs(sample.forceN));
        const peakFxN = Math.max(...absoluteFx);
        const peakFyN = Math.max(...absoluteFy);
        const combinedEnvelopeDemand = combined.map(sample => Math.hypot(
          sample.fxN / Math.max(1, peakFxN),
          sample.fyN / Math.max(1, peakFyN),
        ));
        results[model.id][surface.id][load] = {
          fx,
          fy,
          combined,
          checks: {
            finite: [...fx, ...fy].every(sample => Number.isFinite(sample.forceN)),
            maximumFxJumpN: maximumJump(fx.map(sample => sample.forceN)),
            maximumFyJumpN: maximumJump(fy.map(sample => sample.forceN)),
            maximumNormalizedFxJump: maximumJump(fx.map(sample => sample.forceN))
              / Math.max(1, peakFxN),
            maximumNormalizedFyJump: maximumJump(fy.map(sample => sample.forceN))
              / Math.max(1, peakFyN),
            maximumFxSymmetryErrorN: maximumSymmetryError(
              fx.map(sample => sample.forceN),
            ),
            maximumFySymmetryErrorN: maximumSymmetryError(
              fy.map(sample => sample.forceN),
            ),
            maximumCombinedEnvelopeDemand: Math.max(...combinedEnvelopeDemand),
            peakFxN,
            peakFyN,
            residualFxRatio: absoluteFx.at(-1) / Math.max(1, peakFxN),
            residualFyRatio: absoluteFy.at(-1) / Math.max(1, peakFyN),
            zeroFxN: fx[Math.floor(fx.length / 2)].forceN,
            zeroFyN: fy[Math.floor(fy.length / 2)].forceN,
          },
        };
      }
    }
  }
  return { generatedAt: new Date().toISOString(), loads, results };
})()`);

const outputDirectory = resolve('artifacts');
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  resolve(outputDirectory, 'multicontact-force-model-offline.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
const summary = {};
const thresholds = {
  maximumNormalizedAdjacentJump: 0.025,
  maximumZeroForceErrorN: 1e-6,
  maximumSymmetryErrorN: 1e-6,
  maximumCombinedEnvelopeDemand: 1.000001,
};
for (const [model, surfaces] of Object.entries(report.results)) {
  const checks = Object.values(surfaces).flatMap(loads => (
    Object.values(loads).map(value => value.checks)
  ));
  const metrics = {
    curveSets: checks.length,
    finite: checks.every(check => check.finite),
    maximumFxJumpN: Math.max(...checks.map(check => check.maximumFxJumpN)),
    maximumFyJumpN: Math.max(...checks.map(check => check.maximumFyJumpN)),
    minimumResidualFxRatio: Math.min(...checks.map(check => check.residualFxRatio)),
    minimumResidualFyRatio: Math.min(...checks.map(check => check.residualFyRatio)),
    maximumNormalizedAdjacentJump: Math.max(...checks.flatMap(check => [
      check.maximumNormalizedFxJump,
      check.maximumNormalizedFyJump,
    ])),
    maximumSymmetryErrorN: Math.max(...checks.flatMap(check => [
      check.maximumFxSymmetryErrorN,
      check.maximumFySymmetryErrorN,
    ])),
    maximumCombinedEnvelopeDemand: Math.max(
      ...checks.map(check => check.maximumCombinedEnvelopeDemand),
    ),
    maximumZeroForceErrorN: Math.max(
      ...checks.flatMap(check => [Math.abs(check.zeroFxN), Math.abs(check.zeroFyN)]),
    ),
  };
  summary[model] = {
    ...metrics,
    eligible: metrics.finite
      && metrics.maximumNormalizedAdjacentJump
        <= thresholds.maximumNormalizedAdjacentJump
      && metrics.maximumZeroForceErrorN <= thresholds.maximumZeroForceErrorN
      && metrics.maximumSymmetryErrorN <= thresholds.maximumSymmetryErrorN
      && metrics.maximumCombinedEnvelopeDemand
        <= thresholds.maximumCombinedEnvelopeDemand,
  };
}
report.thresholds = thresholds;
report.summary = summary;
writeFileSync(
  resolve(outputDirectory, 'multicontact-force-model-offline.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify({ thresholds, summary }, null, 2));
socket.close();
