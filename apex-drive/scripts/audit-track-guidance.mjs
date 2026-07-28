import WebSocket from 'ws';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const debugPort = process.argv[2] ?? '9232';
const appPort = process.argv[3] ?? '5173';
const trackIds = ['circuit-bravo', 'autopista-cumbre'];
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
const runtimeExceptions = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') {
    runtimeExceptions.push(message.params.exceptionDetails.text);
  }
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
const artifactDirectory = resolve('artifacts');
mkdirSync(artifactDirectory, { recursive: true });
const tracks = [];

for (const trackId of trackIds) {
  await send('Page.navigate', {
    url: `http://127.0.0.1:${appPort}/?track=${trackId}&vehicle=car&ui=off`,
  });
  await evaluate(`new Promise((resolveAudit, reject) => {
    const started = performance.now();
    const poll = () => {
      const canvas = document.querySelector('#render-canvas');
      if (
        canvas?.dataset.trackId === ${JSON.stringify(trackId)}
        && canvas.dataset.racingPlanAlgorithm
        && canvas.dataset.runtimeStatus?.includes('ApexPhysics activo')
      ) resolveAudit(true);
      else if (performance.now() - started > 20000) reject(new Error(
        'Track guidance timeout: ' + (canvas?.dataset.runtimeStatus ?? '')
      ));
      else setTimeout(poll, 20);
    };
    poll();
  })`);
  const result = await evaluate(`(() => {
    const data = document.querySelector('#render-canvas').dataset;
    return {
      trackId: data.trackId,
      algorithm: data.racingPlanAlgorithm,
      minimumSpeedKmh: Number(data.racingPlanMinimumSpeedKmh),
      maximumSpeedKmh: Number(data.racingPlanMaximumSpeedKmh),
      maximumOffsetM: Number(data.racingPlanMaximumOffsetM),
      chevrons: {
        accelerate: Number(data.trackGuidanceAccelerateCount),
        lift: Number(data.trackGuidanceLiftCount),
        brake: Number(data.trackGuidanceBrakeCount),
      },
      runtimeStatus: data.runtimeStatus,
    };
  })()`);
  tracks.push(result);
  const screenshot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  writeFileSync(
    resolve(artifactDirectory, `track-guidance-${trackId}.png`),
    Buffer.from(screenshot.data, 'base64'),
  );
}

const report = {
  generatedAt: new Date().toISOString(),
  tracks,
  runtimeExceptions,
};
writeFileSync(
  resolve(artifactDirectory, 'track-guidance-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
socket.close();

if (
  runtimeExceptions.length > 0
  || tracks.some(track => (
    track.algorithm !== 'projected-minimum-curvature-v1'
    || !Number.isFinite(track.minimumSpeedKmh)
    || !Number.isFinite(track.maximumSpeedKmh)
    || track.maximumSpeedKmh <= track.minimumSpeedKmh
    || track.maximumOffsetM <= 0
    || track.chevrons.accelerate <= 0
    || track.chevrons.lift <= 0
    || track.chevrons.brake <= 0
  ))
) {
  process.exitCode = 1;
}
