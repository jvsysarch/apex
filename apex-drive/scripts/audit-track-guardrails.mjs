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
const evaluate = async (expression, awaitPromise = false) => {
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise,
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
  url: `http://127.0.0.1:${appPort}/?track=autopista-cumbre&ui=off&audit=guardrail&physicsHz=360&contactCount=8`,
});
await evaluate(`new Promise((resolveAudit, reject) => {
  const started = performance.now();
  const poll = () => {
    if (window.__apexGuardrailAuditResult) resolveAudit(true);
    else if (performance.now() - started > 20000) reject(new Error(
      'Guardrail audit timeout: '
      + (document.querySelector('#render-canvas')?.dataset.runtimeStatus ?? '')
    ));
    else setTimeout(poll, 20);
  };
  poll();
})`, true);
const result = await evaluate(`({
  physics: window.__apexGuardrailAuditResult,
  rendering: (() => {
    const data = document.querySelector('#render-canvas').dataset;
    return {
      trackId: data.trackId,
      safetySystem: data.trackSafetySystem,
      geometry: data.trackGuardrailGeometry,
      sections: Number(data.trackGuardrailSectionCount),
      visualSegments: Number(data.trackGuardrailSegmentCount),
      physicalSegments: Number(data.trackPhysicsGuardrailSegmentCount),
      protectedLengthM: Number(data.trackGuardrailProtectedLengthM),
      arrowCount: Number(data.trackGuardrailArrowCount),
      orientationErrors: Number(data.trackGuardrailOrientationErrors),
      maximumJoinGapM: Number(data.trackGuardrailMaximumJoinGapM),
      lod: data.trackLod,
      lodChunks: Number(data.trackLodChunks),
      lodLevels: Number(data.trackLodLevels),
      lodMeshes: Number(data.trackLodMeshes),
      lodDistancesM: data.trackLodDistancesM,
    };
  })(),
})`);
result.rendering.topology = await evaluate(`import(
  '/src/track/ApexTestTrack.ts'
).then(module => module.TEST_TRACK_SAFETY.sections.map(section => ({
  id: section.id,
  side: section.side,
  lengthM: section.lengthM,
  firstSourceIndex: section.segments[0]?.sourceIndex,
  lastSourceIndex: section.segments.at(-1)?.sourceIndex,
  arrowSourceIndices: section.segments
    .filter(segment => segment.arrows)
    .map(segment => segment.sourceIndex),
})))`, true);
const screenshot = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: false,
});
const artifactDirectory = resolve('artifacts');
mkdirSync(artifactDirectory, { recursive: true });
writeFileSync(
  resolve(artifactDirectory, 'track-guardrail-audit.png'),
  Buffer.from(screenshot.data, 'base64'),
);
const report = {
  generatedAt: new Date().toISOString(),
  ...result,
  runtimeExceptions,
};
writeFileSync(
  resolve(artifactDirectory, 'track-guardrail-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
socket.close();

if (
  !result.physics.contained
  || !result.physics.airborneCase?.contained
  || !result.physics.allCasesReachedBarrier
  || !result.physics.allCasesSlidAlongBarrier
  || result.physics.orientationErrorCount > 0
  || runtimeExceptions.length > 0
) {
  process.exitCode = 1;
}
