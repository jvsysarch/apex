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
await send('Page.navigate', {
  url: `http://127.0.0.1:${appPort}/`,
});
await evaluate(`new Promise((resolveAudit, reject) => {
  const started = performance.now();
  const poll = () => {
    const canvas = document.querySelector('#render-canvas');
    if (
      canvas?.dataset.experienceMode === 'parking-selection'
      && canvas.dataset.parkingLazyState === 'ready'
      && canvas.dataset.runtimeStatus?.includes('ApexPhysics activo')
    ) resolveAudit(true);
    else if (performance.now() - started > 25000) reject(new Error(
      'Parking audit timeout: '
      + JSON.stringify({
        mode: canvas?.dataset.experienceMode,
        lazy: canvas?.dataset.parkingLazyState,
        runtime: canvas?.dataset.runtimeStatus,
      })
    ));
    else setTimeout(poll, 25);
  };
  poll();
})`);

const selection = await evaluate(`Promise.all([
  import('/src/world/ApexParkingLot.ts'),
  import('/src/vehicle/ApexCarCatalog.ts'),
]).then(([parking, cars]) => {
  const data = document.querySelector('#render-canvas').dataset;
  const preview = parking.APEX_PARKING_PREVIEW;
  const lot = parking.APEX_PARKING_LOT;
  const lastCenterX = preview.firstX
    + (cars.APEX_CAR_CATALOG.length - 1) * preview.spacingM;
  const lastBayMaximumX = lastCenterX + preview.bayWidthM * 0.5;
  const lotMaximumX = lot.centerX + lot.widthM * 0.5;
  return {
    mode: data.experienceMode,
    layout: data.parkingLayout,
    bayCount: Number(data.parkingBayCount),
    catalogCount: cars.APEX_CAR_CATALOG.length,
    selectedIndex: Number(data.parkingSelectedIndex),
    selectedCar: data.parkingSelectedCar,
    lazyState: data.parkingLazyState,
    lastBayMaximumX,
    lotMaximumX,
    containmentMarginM: lotMaximumX - lastBayMaximumX,
  };
})`);

const artifactDirectory = resolve('artifacts');
mkdirSync(artifactDirectory, { recursive: true });
const screenshot = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: false,
});
writeFileSync(
  resolve(artifactDirectory, 'parking-layout-audit.png'),
  Buffer.from(screenshot.data, 'base64'),
);

await evaluate(`document.querySelector('#parking-car-confirm').click()`);
await evaluate(`new Promise((resolveAudit, reject) => {
  const started = performance.now();
  const poll = () => {
    const canvas = document.querySelector('#render-canvas');
    if (
      canvas?.dataset.experienceMode === 'parking-drive'
      && canvas.dataset.vehiclePosition
    ) resolveAudit(true);
    else if (performance.now() - started > 10000) reject(new Error(
      'Parking activation timeout: ' + canvas?.dataset.experienceMode
    ));
    else setTimeout(poll, 25);
  };
  poll();
})`);
const activation = await evaluate(`(() => {
  const data = document.querySelector('#render-canvas').dataset;
  return {
    mode: data.experienceMode,
    vehiclePosition: data.vehiclePosition.split(',').map(Number),
    vehicleModel: data.vehicleModel,
  };
})()`);

const report = {
  generatedAt: new Date().toISOString(),
  selection,
  activation,
  runtimeExceptions,
};
writeFileSync(
  resolve(artifactDirectory, 'parking-layout-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
socket.close();

if (
  runtimeExceptions.length > 0
  || selection.mode !== 'parking-selection'
  || selection.layout !== 'paddock-linear-v2'
  || selection.bayCount !== selection.catalogCount
  || selection.containmentMarginM < 0
  || activation.mode !== 'parking-drive'
  || activation.vehiclePosition.some(value => !Number.isFinite(value))
) {
  process.exitCode = 1;
}
