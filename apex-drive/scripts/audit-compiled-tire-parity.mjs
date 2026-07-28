import WebSocket from 'ws';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const debugPort = process.argv[2] ?? '9232';
const appPort = process.argv[3] ?? '5173';
const targets = await fetch(`http://127.0.0.1:${debugPort}/json`)
  .then(response => response.json());
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
    throw new Error(
      response.exceptionDetails.exception?.description
      ?? response.exceptionDetails.text,
    );
  }
  return response.result.value;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', {
  url: `http://localhost:${appPort}/?ui=off&nativeTireParity=${Date.now()}`,
});
await evaluate(`new Promise((resolveResult, reject) => {
  const started = performance.now();
  const poll = () => {
    const status = document.querySelector('#render-canvas')?.dataset.runtimeStatus ?? '';
    if (status.includes('ApexPhysics activo')) resolveResult(true);
    else if (status.includes('No se pudo')) reject(new Error(status));
    else if (performance.now() - started > 15000) reject(new Error(
      'ApexPhysics startup timeout: ' + status
    ));
    else setTimeout(poll, 20);
  };
  poll();
})`);

const report = await evaluate(`(async () => {
  const [{ ApexTMeasy }, { ApexBrush }, runtimeModule] = await Promise.all([
    import('/src/physics/tires/force/ApexTMeasy.ts'),
    import('/src/physics/tires/force/ApexBrush.ts'),
    import('/apex-physics.js'),
  ]);
  const J = await runtimeModule.default({
    locateFile: file => file.endsWith('.wasm') ? '/apex-physics.wasm' : file,
  });
  const bridge = new J.ApexTireForceBridge();
  bridge.SetPatchesPerContact(2);
  bridge.SetOperatingScales(1.06, 1);
  bridge.SetLateralGripMultiplier(1);
  const surface = {
    id: 'asphalt',
    label: 'Asphalt',
    longitudinalMu: 1.32,
    lateralMu: 1.32,
    peakSlipRatio: 0.105,
    peakSlipAngleRadians: 6.3 * Math.PI / 180,
    slidingGripRetention: 0.84,
    breakawayFalloff: 1.28,
  };
  bridge.SetWheelSurface(
    0,
    surface.longitudinalMu,
    surface.lateralMu,
    surface.peakSlipRatio,
    surface.peakSlipAngleRadians,
  );
  const loads = [800, 1800, 3800, 6500, 9000];
  const slipRatios = [-0.3, -0.105, -0.03, 0, 0.03, 0.105, 0.3];
  const slipAngles = [-15, -6.3, -2, 0, 2, 6.3, 15]
    .map(value => value * Math.PI / 180);
  const fields = [
    'longitudinalForceN',
    'lateralForceN',
    'aligningMomentNm',
    'longitudinalCapacityN',
    'lateralCapacityN',
  ];
  const runModel = (modelName, nativeModel, model) => {
    bridge.SetModel(nativeModel);
    const maxima = Object.fromEntries(fields.map(field => [
      field,
      { absolute: 0, relative: 0 },
    ]));
    let sampleCount = 0;
    for (const verticalLoadN of loads) {
      for (const slipRatio of slipRatios) {
        for (const slipAngleRadians of slipAngles) {
          const patch = model.evaluate({
            wheelIndex: 0,
            verticalLoadN: verticalLoadN / 2,
            slipRatio,
            slipAngleRadians,
            forwardSpeedMps: 30,
            angularVelocityRadPerSecond: 90,
            wheelRadiusM: 0.34,
            surface,
            deltaTimeSeconds: 1 / 360,
          });
          const expected = {
            longitudinalForceN: patch.longitudinalForceN * 2,
            lateralForceN: patch.lateralForceN * 2,
            aligningMomentNm: patch.aligningMomentNm * 2,
            longitudinalCapacityN: patch.longitudinalCapacityN * 2,
            lateralCapacityN: patch.lateralCapacityN * 2,
          };
          bridge.EvaluateSample(0, verticalLoadN, slipRatio, slipAngleRadians);
          const actual = {
            longitudinalForceN: bridge.GetSampleLongitudinalForce(),
            lateralForceN: bridge.GetSampleLateralForce(),
            aligningMomentNm: bridge.GetAligningMoment(0),
            longitudinalCapacityN: bridge.GetLongitudinalCapacity(0),
            lateralCapacityN: bridge.GetLateralCapacity(0),
          };
          for (const field of fields) {
            const absolute = Math.abs(actual[field] - expected[field]);
            const relative = absolute / Math.max(1, Math.abs(expected[field]));
            maxima[field].absolute = Math.max(maxima[field].absolute, absolute);
            maxima[field].relative = Math.max(maxima[field].relative, relative);
          }
          sampleCount += 1;
        }
      }
    }
    return { model: modelName, sampleCount, maxima };
  };
  const results = {
    'apex-tmeasy-v1': runModel('apex-tmeasy-v1', 2, new ApexTMeasy()),
    'apex-brush-v1': runModel('apex-brush-v1', 1, new ApexBrush()),
  };
  J.destroy(bridge);
  const maximumRelativeError = Math.max(
    ...Object.values(results).flatMap(result => (
      Object.values(result.maxima).map(error => error.relative)
    )),
  );
  return {
    generatedAt: new Date().toISOString(),
    patchCount: 2,
    operatingGripScale: 1.06,
    sampleCount: Object.values(results)
      .reduce((sum, result) => sum + result.sampleCount, 0),
    maximumRelativeError,
    tolerance: 1e-5,
    passed: maximumRelativeError <= 1e-5,
    results,
  };
})()`);

const artifactDirectory = resolve('artifacts');
mkdirSync(artifactDirectory, { recursive: true });
writeFileSync(
  resolve(artifactDirectory, 'compiled-tire-math-parity.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
socket.close();
if (!report.passed) process.exitCode = 1;
