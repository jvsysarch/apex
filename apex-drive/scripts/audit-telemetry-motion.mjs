import WebSocket from 'ws';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const port = process.argv[2] ?? '9225';
const telemetryMode = process.argv[3] ?? 'on';
const tireModel = process.argv[4] ?? 'jolt-default';
const surface = process.argv[5] ?? 'track';
const appPort = process.argv[6] ?? '5173';
const steeringDurationMs = Number(process.argv[7] ?? 550);
const accelerationDurationMs = Number(process.argv[8] ?? 2200);
const targets = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json());
const target = targets.find(candidate => candidate.type === 'page' && candidate.url.includes('127.0.0.1'))
  ?? targets.find(candidate => candidate.type === 'page');
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
  const response = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

await send('Runtime.enable');
await send('Page.enable');
const uiMode = telemetryMode === 'off'
  ? 'off'
  : telemetryMode === 'read' ? 'read' : 'tuning';
const testUrl = `http://127.0.0.1:${appPort}/?ui=${uiMode}`;
if (target.url !== testUrl) await send('Page.navigate', { url: testUrl });
await new Promise(resolve => setTimeout(resolve, 1800));
await evaluate(`new Promise((resolve, reject) => {
  const started = performance.now();
  const poll = () => {
    const canvas = document.querySelector('#render-canvas');
    if (canvas?.dataset.vehiclePosition) resolve(true);
    else if (performance.now() - started > 15000) reject(new Error(
      'Physics did not start: ' + document.body.innerText.replace(/\s+/g, ' ').slice(0, 500)
    ));
    else setTimeout(poll, 50);
  };
  poll();
})`, true);

if (uiMode === 'tuning') {
  await evaluate(`new Promise((resolve, reject) => {
    const started = performance.now();
    const selectModel = () => {
      const button = document.querySelector('[data-model="${tireModel}"]');
      if (button && !button.disabled) {
        button.click();
        resolve(true);
      } else if (performance.now() - started > 5000) reject(new Error('Tire controls did not start'));
      else setTimeout(selectModel, 50);
    };
    selectModel();
  })`, true);
  await new Promise(resolve => setTimeout(resolve, 120));
  await evaluate(`(() => {
    const select = document.querySelector('.tire-model-controls select');
    if (!select) throw new Error('Surface selector not found');
    select.value = '${surface}';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await new Promise(resolve => setTimeout(resolve, 120));
}

await evaluate(`(() => {
  window.__motionAudit = [];
  let previous = performance.now();
  const sample = now => {
    const canvas = document.querySelector('#render-canvas');
    const position = canvas?.dataset.vehiclePosition?.split(',').map(Number);
    if (position?.length === 3) {
      window.__motionAudit.push({
        t: now,
        dt: now - previous,
        position,
        liftOffFrontAeroBlend: Number(canvas.dataset.liftOffFrontAeroBlend ?? 0),
        liftOffFrontDownforceN: Number(canvas.dataset.liftOffFrontDownforceN ?? 0),
        wheelContactErrorsMm: canvas.dataset.wheelContactErrorsMm,
        wheelSurfaces: canvas.dataset.wheelSurfaces,
      });
      if (window.__motionAudit.length > 2000) window.__motionAudit.shift();
    }
    previous = now;
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  return true;
})()`);

const key = async (type, code, keyValue) => send('Input.dispatchKeyEvent', {
  type,
  code,
  key: keyValue,
  windowsVirtualKeyCode: keyValue.charCodeAt(0),
  nativeVirtualKeyCode: keyValue.charCodeAt(0),
});
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

await delay(1200);
await key('keyDown', 'KeyW', 'W');
await delay(accelerationDurationMs);
await key('keyDown', 'KeyA', 'A');
await delay(steeringDurationMs);
await key('keyUp', 'KeyA', 'A');
await delay(350);
await key('keyUp', 'KeyW', 'W');
await delay(1200);

const samples = await evaluate('window.__motionAudit');
const summary = samples.slice(1).map((sample, index) => {
  const previous = samples[index];
  const [x, y, z] = sample.position;
  const [px, py, pz] = previous.position;
  const distance = Math.hypot(x - px, y - py, z - pz);
  return { ...sample, distance, metresPerSecond: sample.dt > 0 ? distance / (sample.dt / 1000) : 0 };
});
const byDistance = [...summary].sort((a, b) => b.distance - a.distance).slice(0, 12);
const byFrameTime = [...summary].sort((a, b) => b.dt - a.dt).slice(0, 12);
const result = {
  telemetryMode,
  tireModel,
  surface,
  sampleCount: samples.length,
  first: samples[0],
  last: samples.at(-1),
  maximumSingleFrameDistanceM: byDistance[0]?.distance,
  maximumDerivedSpeedMps: Math.max(...summary.filter(sample => sample.dt < 80).map(sample => sample.metresPerSecond)),
  verticalRangeM: Math.max(...samples.map(sample => sample.position[1])) - Math.min(...samples.map(sample => sample.position[1])),
  maximumVerticalStepM: Math.max(...samples.slice(1).map((sample, index) => Math.abs(sample.position[1] - samples[index].position[1]))),
  maximumAbsLateralPositionM: Math.max(...samples.map(sample => Math.abs(sample.position[0]))),
  grassContactSampleCount: samples.filter(sample => (
    sample.wheelSurfaces?.includes('grass')
    && !sample.wheelContactErrorsMm?.includes('air')
  )).length,
  framesOver25ms: summary.filter(sample => sample.dt > 25).length,
  framesOver50ms: summary.filter(sample => sample.dt > 50).length,
  finalSpeedKmh: await evaluate(`Number(document.querySelector('#render-canvas')?.dataset.vehicleSpeedKmh ?? 0)`),
  maximumLiftOffFrontAeroBlend: Math.max(...samples.map(sample => sample.liftOffFrontAeroBlend)),
  maximumLiftOffFrontDownforceN: Math.max(...samples.map(sample => sample.liftOffFrontDownforceN)),
  activeTireModel: await evaluate(`document.querySelector('.tire-model-switch button[data-active]')?.dataset.model ?? null`),
  runtimeTireModel: await evaluate(`document.querySelector('#render-canvas')?.dataset.tireModel ?? null`),
  runtimePhysicsHz: await evaluate(`Number(document.querySelector('#render-canvas')?.dataset.physicsHz ?? 0)`),
  runtimeTireContactCount: await evaluate(`Number(document.querySelector('#render-canvas')?.dataset.tireContactCount ?? 0)`),
  centerOfMass: await evaluate(`({
    worldPosition: document.querySelector('#render-canvas')?.dataset.centerOfMassPosition ?? null,
    label: document.querySelector('.center-of-mass-label')?.textContent ?? null,
    visible: !document.querySelector('.center-of-mass-label')?.hidden,
  })`),
  tireOperatingControls: await evaluate(`({
    compound: document.querySelector('.tire-operating-controls select')?.value ?? null,
    pressurePsi: Number(document.querySelectorAll('.tire-operating-controls input')[0]?.value ?? 0),
    temperatureC: Number(document.querySelectorAll('.tire-operating-controls input')[1]?.value ?? 0),
    outputs: Array.from(document.querySelectorAll('.tire-operating-controls output'))
      .map(output => output.textContent),
  })`),
  activeSurface: await evaluate(`document.querySelector('.tire-model-controls select')?.value ?? null`),
  graphReadouts: await evaluate(`Array.from(document.querySelectorAll('.time-series-chart figcaption')).map(node => node.textContent?.replace(/\\s+/g, ' ').trim())`),
  graphCanvases: await evaluate(`Array.from(document.querySelectorAll('.time-series-chart canvas')).map(canvas => ({ width: canvas.width, height: canvas.height }))`),
  largestMoves: byDistance.slice(0, 3),
  slowestFrames: byFrameTime.slice(0, 3),
  browserErrors: await evaluate(`performance.getEntriesByType('resource')
    .filter(entry => entry.name.includes('apex-physics'))
    .map(entry => ({ name: entry.name, duration: entry.duration }))`),
  sportHud: await evaluate(`({
    hidden: document.querySelector('#sport-hud')?.hidden ?? true,
    hasSvg: Boolean(document.querySelector('#sport-hud-svg svg')),
    speedText: Array.from(document.querySelectorAll('#sport-hud-svg text'))
      .map(node => node.textContent)
      .find(text => /^\\d+$/.test(text ?? '')) ?? null,
  })`),
};

const screenshot = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: false,
});
const artifactDirectory = resolve('artifacts');
mkdirSync(artifactDirectory, { recursive: true });
writeFileSync(
  resolve(artifactDirectory, 'shoulder-hud-audit.png'),
  Buffer.from(screenshot.data, 'base64'),
);

console.log(JSON.stringify(result, null, 2));
socket.close();
