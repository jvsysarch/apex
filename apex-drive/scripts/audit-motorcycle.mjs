import WebSocket from 'ws';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const debugPort = process.argv[2] ?? '9232';
const appPort = process.argv[3] ?? '5173';
const uiMode = process.argv[4] ?? 'read';
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
const runtimeErrors = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') {
    runtimeErrors.push(message.params.exceptionDetails.exception?.description
      ?? message.params.exceptionDetails.text);
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
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
};
const key = (type, code, keyValue, keyCode) => send('Input.dispatchKeyEvent', {
  type,
  code,
  key: keyValue,
  windowsVirtualKeyCode: keyCode,
});
const delay = milliseconds => new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', {
  url: `http://127.0.0.1:${appPort}/?ui=${uiMode}&vehicle=motorcycle`,
});
await evaluate(`new Promise((resolveResult, reject) => {
  const started = performance.now();
  const poll = () => {
    const canvas = document.querySelector('#render-canvas');
    if (canvas?.dataset.vehiclePosition) resolveResult(true);
    else if (performance.now() - started > 12000) {
      reject(new Error(canvas?.dataset.runtimeStatus ?? 'motorcycle timeout'));
    } else setTimeout(poll, 25);
  };
  poll();
})`);

await delay(700);
await key('keyDown', 'KeyW', 'w', 87);
await delay(2200);
await key('keyDown', 'KeyA', 'a', 65);
await delay(450);
await key('keyUp', 'KeyA', 'a', 65);
await delay(600);
await key('keyUp', 'KeyW', 'w', 87);
await delay(350);

const result = await evaluate(`(() => {
  const canvas = document.querySelector('#render-canvas');
  return {
    vehicleKind: canvas?.dataset.vehicleKind,
    vehicleModel: canvas?.dataset.vehicleModel,
    runtimeStatus: canvas?.dataset.runtimeStatus,
    speedKmh: Number(canvas?.dataset.vehicleSpeedKmh),
    position: canvas?.dataset.vehiclePosition,
    wheelContactErrorsMm: canvas?.dataset.wheelContactErrorsMm,
    wheelCount: canvas?.dataset.wheelContactErrorsMm?.split(',').length ?? 0,
    trackMaxElevationM: Number(canvas?.dataset.trackMaxElevationM),
    trackMaxBankDeg: Number(canvas?.dataset.trackMaxBankDeg),
  };
})()`);
result.runtimeErrors = runtimeErrors;

const screenshot = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: false,
});
const artifactDirectory = resolve('artifacts');
mkdirSync(artifactDirectory, { recursive: true });
writeFileSync(
  resolve(artifactDirectory, 'motorcycle-audit.png'),
  Buffer.from(screenshot.data, 'base64'),
);

if (result.vehicleKind !== 'motorcycle' || result.wheelCount !== 2) {
  throw new Error(`Motorcycle selection failed: ${JSON.stringify(result)}`);
}
if (result.speedKmh < 1) throw new Error(`Motorcycle did not move: ${JSON.stringify(result)}`);
if (runtimeErrors.length) throw new Error(runtimeErrors.join('\n'));

console.log(JSON.stringify(result, null, 2));
socket.close();
