import WebSocket from 'ws';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const debugPort = process.argv[2] ?? '9232';
const appPort = process.argv[3] ?? '5175';
const scenarioQuery = process.argv[4] ?? '';
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
    throw new Error(response.exceptionDetails.exception?.description
      ?? response.exceptionDetails.text);
  }
  return response.result.value;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', {
  url: `http://127.0.0.1:${appPort}/?ui=off${scenarioQuery ? `&${scenarioQuery}` : ''}`,
});
const result = await evaluate(`new Promise((resolveResult, reject) => {
  const started = performance.now();
  const poll = () => {
    const canvas = document.querySelector('#render-canvas');
    const errors = canvas?.dataset.wheelContactErrorsMm;
    if (errors && !errors.includes('air')) {
      setTimeout(async () => {
        const track = await import('/src/track/ApexTestTrack.ts');
        const segments = track.TEST_TRACK_POINTS.slice(0, -1).map((point, index) => ({
          point,
          next: track.TEST_TRACK_POINTS[index + 1],
        }));
        const maxGradePercent = Math.max(...segments.map(({ point, next }) => (
          Math.abs(next.y - point.y)
          / Math.hypot(next.x - point.x, next.z - point.z)
          * 100
        )));
        const maxBankStepDeg = Math.max(...segments.map(({ point, next }) => (
          Math.abs(next.bankRadians - point.bankRadians) * 180 / Math.PI
        )));
        resolveResult({
          errorsMm: canvas.dataset.wheelContactErrorsMm,
          speedKmh: Number(canvas.dataset.vehicleSpeedKmh),
          position: canvas.dataset.vehiclePosition,
          runtimeStatus: canvas.dataset.runtimeStatus,
          vehicleModel: canvas.dataset.vehicleModel,
          vehicleModelSize: canvas.dataset.vehicleModelSize,
        cameraPreset: canvas.dataset.cameraPreset,
          cameraDistanceM: Number(canvas.dataset.cameraDistanceM),
          cameraFovDeg: Number(canvas.dataset.cameraFovDeg),
          trackMaxElevationM: Number(canvas.dataset.trackMaxElevationM),
          trackMaxBankDeg: Number(canvas.dataset.trackMaxBankDeg),
        trackPhysicsProfile: canvas.dataset.trackPhysicsProfile,
        jumpRamp: canvas.dataset.jumpRamp,
        jumpRampPosition: canvas.dataset.jumpRampPosition,
        vehiclePbrMaterialCount: Number(canvas.dataset.vehiclePbrMaterialCount),
        vehicleEnvironmentLighting: canvas.dataset.vehicleEnvironmentLighting,
        sportHud: canvas.dataset.sportHud,
        sportHudSvgCount: document.querySelector('#sport-hud-svg')?.children.length ?? 0,
        vehiclePaintMaterialCount: Number(canvas.dataset.vehiclePaintMaterialCount),
        vehiclePaintColor: canvas.dataset.vehiclePaintColor,
        trackDirection: canvas.dataset.trackDirection,
        trackCurveRibbonCount: Number(canvas.dataset.trackCurveRibbonCount),
        trackCenterMarkings: canvas.dataset.trackCenterMarkings,
        lapTimingInitialPhase: canvas.dataset.lapTimingPhase,
        lapTimingCheckpointCount: Number(canvas.dataset.lapTimingCheckpointCount),
        lapTimingHudPresent: Boolean(document.querySelector('#lap-timer .lap-timing-card')),
          trackMinEdgeClearanceM: Number(canvas.dataset.trackMinEdgeClearanceM),
          trackShoulderWidthM: Number(canvas.dataset.trackShoulderWidthM),
          maxGradePercent,
          maxBankStepDeg,
        });
      }, 750);
    } else if (performance.now() - started > 10000) {
      reject(new Error(canvas?.dataset.runtimeStatus ?? 'wheel contact timeout'));
    } else {
      setTimeout(poll, 20);
    }
  };
  poll();
})`);

const cameraCycle = [result.cameraPreset];
for (let index = 0; index < 5; index += 1) {
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    code: 'KeyC',
    key: 'c',
    windowsVirtualKeyCode: 67,
  });
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    code: 'KeyC',
    key: 'c',
    windowsVirtualKeyCode: 67,
  });
  await new Promise(resolveDelay => setTimeout(resolveDelay, 40));
  cameraCycle.push(await evaluate(
    `document.querySelector('#render-canvas')?.dataset.cameraPreset`,
  ));
}
result.cameraCycle = cameraCycle;
await new Promise(resolveDelay => setTimeout(resolveDelay, 3000));
result.lapTimingFinalPhase = await evaluate(
  `document.querySelector('#render-canvas')?.dataset.lapTimingPhase`,
);
result.lapTimingElapsedMs = Number(await evaluate(
  `document.querySelector('#render-canvas')?.dataset.lapTimingElapsedMs`,
));

const screenshot = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: false,
});
const artifactDirectory = resolve('artifacts');
mkdirSync(artifactDirectory, { recursive: true });
const screenshotPath = resolve(artifactDirectory, 'wheel-contact-audit.png');
writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));

console.log(JSON.stringify(result, null, 2));
socket.close();
