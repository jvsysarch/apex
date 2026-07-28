import WebSocket from 'ws';

const debugPort = process.argv[2] ?? '9230';
const appPort = process.argv[3] ?? '5173';
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

async function runCase(name, query) {
  const url = `http://127.0.0.1:${appPort}/?audit=drive&${query}`;
  await send('Page.navigate', { url });
  await evaluate(`new Promise((resolve, reject) => {
    const started = performance.now();
    const poll = () => {
      if (window.__apexAuditResult) resolve(true);
      else if (performance.now() - started > 30000) {
        reject(new Error('Audit timeout: ' + document.body.innerText.replace(/\\s+/g, ' ').slice(0, 300)));
      } else setTimeout(poll, 20);
    };
    poll();
  })`, true);

  return evaluate(`(() => ({
    name: ${JSON.stringify(name)},
    result: window.__apexAuditResult,
    uiChildren: document.querySelector('#telemetry-root')?.childElementCount ?? -1,
    tuningControls: document.querySelectorAll('.tire-model-controls').length,
    uiModuleRequested: performance.getEntriesByType('resource')
      .some(entry => entry.name.includes('/src/ui/ApexUiRuntime')),
  }))()`);
}

await send('Runtime.enable');
await send('Page.enable');

const cases = [];
cases.push(await runCase('off', 'ui=off'));
cases.push(await runCase('read', 'ui=read'));
cases.push(await runCase('tuning-idle', 'ui=tuning'));
cases.push(await runCase('tuning-switch', 'ui=tuning&auditSwitchStep=360'));

const baselineHash = cases[0].result.traceHash;
const report = {
  passed: (
    cases[0].result.uiRuntimeLoaded === false
    && cases[0].uiChildren === 0
    && cases[0].uiModuleRequested === false
    && cases[1].result.tuningCapability === false
    && cases[1].tuningControls === 0
    && cases[2].result.tuningCapability === true
    && cases[2].tuningControls === 1
    && cases[0].result.traceHash === cases[1].result.traceHash
    && cases[0].result.traceHash === cases[2].result.traceHash
    && cases[3].result.traceHash !== baselineHash
    && cases[3].result.finalState.tireModel === 'apex-v1'
  ),
  comparisons: {
    offEqualsRead: cases[0].result.traceHash === cases[1].result.traceHash,
    offEqualsTuningIdle: cases[0].result.traceHash === cases[2].result.traceHash,
    commandedSwitchDiverges: cases[3].result.traceHash !== baselineHash,
  },
  cases: cases.map(entry => ({
    name: entry.name,
    traceHash: entry.result.traceHash,
    uiRuntimeLoaded: entry.result.uiRuntimeLoaded,
    tuningCapability: entry.result.tuningCapability,
    uiChildren: entry.uiChildren,
    tuningControls: entry.tuningControls,
    uiModuleRequested: entry.uiModuleRequested,
    finalTireModel: entry.result.finalState.tireModel,
    maximumSpeedKmh: entry.result.maximumSpeedKmh,
    verticalRangeM: entry.result.verticalRangeM,
    maximumVerticalStepM: entry.result.maximumVerticalStepM,
  })),
};

console.log(JSON.stringify(report, null, 2));
socket.close();
if (!report.passed) process.exitCode = 1;
