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
const runtimeErrors = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') {
    runtimeErrors.push(message.params.exceptionDetails.text);
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
    throw new Error(response.exceptionDetails.exception?.description
      ?? response.exceptionDetails.text);
  }
  return response.result.value;
};
const key = async (type, code, keyValue, keyCode) => send('Input.dispatchKeyEvent', {
  type,
  code,
  key: keyValue,
  windowsVirtualKeyCode: keyCode,
});
const delay = milliseconds => new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', {
  url: `http://127.0.0.1:${appPort}/?ui=off&vehicle=car`,
});
await evaluate(`new Promise((resolveResult, reject) => {
  const started = performance.now();
  const poll = () => {
    const canvas = document.querySelector('#render-canvas');
    if (canvas?.dataset.vehicleModel === 'ferrari-488-pista-ready') resolveResult(true);
    else if (performance.now() - started > 12000) reject(new Error('runtime timeout'));
    else setTimeout(poll, 25);
  };
  poll();
})`);

// La primera orden de conducción desbloquea Web Audio como lo haría el jugador.
await key('keyDown', 'KeyW', 'w', 87);
await evaluate(`new Promise((resolveResult, reject) => {
  const started = performance.now();
  const poll = () => {
    const status = document.querySelector('#render-canvas')?.dataset.audioStatus;
    if (status === 'samples-ready') resolveResult(true);
    else if (status === 'error') reject(new Error('audio initialization failed'));
    else if (performance.now() - started > 15000) reject(new Error('audio load timeout'));
    else setTimeout(poll, 30);
  };
  poll();
})`);
await delay(1200);
await key('keyUp', 'KeyW', 'w', 87);
await key('keyDown', 'KeyS', 's', 83);
await delay(450);

const result = await evaluate(`(() => {
  const canvas = document.querySelector('#render-canvas');
  return {
    audioStatus: canvas?.dataset.audioStatus,
    brakeLights: canvas?.dataset.brakeLights,
    brakeTrigger: Number(canvas?.dataset.brakeTrigger),
    brakeEmissiveIntensity: Number(canvas?.dataset.brakeEmissiveIntensity),
    brakeProjectionIntensity: Number(canvas?.dataset.brakeProjectionIntensity),
    brakeInputSource: canvas?.dataset.brakeInputSource,
    brakeLightProjection: canvas?.dataset.brakeLightProjection,
    brakeLightMaterialCount: Number(canvas?.dataset.brakeLightMaterialCount),
    brakeLightAnchorCount: Number(canvas?.dataset.brakeLightAnchorCount),
    racingLineSource: canvas?.dataset.racingLineSource,
    racingLinePointCount: Number(canvas?.dataset.racingLinePointCount),
    speedKmh: Number(canvas?.dataset.vehicleSpeedKmh),
    runtimeStatus: canvas?.dataset.runtimeStatus,
  };
})()`);

const screenshot = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: false,
});
const artifactDirectory = resolve('artifacts');
mkdirSync(artifactDirectory, { recursive: true });
writeFileSync(
  resolve(artifactDirectory, 'audio-brake-audit.png'),
  Buffer.from(screenshot.data, 'base64'),
);
await key('keyUp', 'KeyS', 's', 83);

result.runtimeErrors = runtimeErrors;
if (result.audioStatus !== 'samples-ready' && result.audioStatus !== 'synth-active') {
  throw new Error(`Unexpected audio status: ${result.audioStatus}`);
}
if (result.brakeLights !== 'on' || result.brakeTrigger < 0.99) {
  throw new Error(`Brake trigger did not activate lights: ${JSON.stringify(result)}`);
}
if (
  result.brakeEmissiveIntensity < 0.75
  || result.brakeEmissiveIntensity > 1.1
) {
  throw new Error(`Brake emissive outside target: ${result.brakeEmissiveIntensity}`);
}
if (
  result.brakeProjectionIntensity < 4
  || result.brakeProjectionIntensity > 8
) {
  throw new Error(`Brake projection outside target: ${result.brakeProjectionIntensity}`);
}
if (result.racingLineSource !== 'approximation' || result.racingLinePointCount < 3) {
  throw new Error(`Racing line unavailable: ${JSON.stringify(result)}`);
}
if (runtimeErrors.length > 0) throw new Error(`Runtime errors: ${runtimeErrors.join(', ')}`);

console.log(JSON.stringify(result, null, 2));
socket.close();
