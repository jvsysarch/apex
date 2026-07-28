import WebSocket from 'ws';

const debugPort = process.argv[2] ?? '9231';
const appPort = process.argv[3] ?? '5175';
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
  await send('Page.navigate', {
    url: `http://127.0.0.1:${appPort}/?audit=drive&${query}`,
  });
  await evaluate(`new Promise((resolve, reject) => {
    const started = performance.now();
    const poll = () => {
      if (window.__apexAuditResult) resolve(true);
      else if (performance.now() - started > 30000) reject(new Error('Vibration audit timeout'));
      else setTimeout(poll, 20);
    };
    poll();
  })`, true);
  return {
    name,
    result: await evaluate('window.__apexAuditResult'),
  };
}

const mean = values => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const rms = values => Math.sqrt(mean(values.map(value => value * value)));
const standardDeviation = values => {
  const average = mean(values);
  return Math.sqrt(mean(values.map(value => (value - average) ** 2)));
};
const range = values => Math.max(...values) - Math.min(...values);
const radiansToDegrees = 180 / Math.PI;
const unwrapDegrees = values => values.reduce((result, value) => {
  if (result.length === 0) return [value];
  let candidate = value;
  const previous = result.at(-1);
  while (candidate - previous > 180) candidate -= 360;
  while (candidate - previous < -180) candidate += 360;
  result.push(candidate);
  return result;
}, []);

function attitude(rotation) {
  const [x, y, z, w] = rotation;
  return {
    pitch: Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)) * radiansToDegrees,
    roll: Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)) * radiansToDegrees,
  };
}

function summarize(samples) {
  const verticalAcceleration = samples.slice(2).map((sample, index) => (
    (sample.positionY - 2 * samples[index + 1].positionY + samples[index].positionY) * 3600
  ));
  const attitudes = samples.map(sample => attitude(sample.rotation));
  const wheelLoads = [0, 1, 2, 3].flatMap(index => samples.map(sample => sample.wheels[index].loadN));
  const suspensionVelocities = [0, 1, 2, 3]
    .flatMap(index => samples.map(sample => sample.wheels[index].suspensionVelocity));
  const longitudinalSlip = [0, 1, 2, 3]
    .flatMap(index => samples.map(sample => sample.wheels[index].slipRatio));
  const lateralSlip = [0, 1, 2, 3]
    .flatMap(index => samples.map(sample => sample.wheels[index].slipAngleRadians));
  const throttle = samples.map(sample => sample.throttle);
  const yawRate = samples.map(sample => sample.yawRate);

  return {
    speedEndKmh: samples.at(-1)?.speedKmh ?? 0,
    verticalRangeMm: range(samples.map(sample => sample.positionY)) * 1000,
    verticalAccelerationRms: rms(verticalAcceleration),
    verticalAccelerationPeak: Math.max(...verticalAcceleration.map(Math.abs), 0),
    pitchRangeDeg: range(unwrapDegrees(attitudes.map(value => value.pitch))),
    rollRangeDeg: range(unwrapDegrees(attitudes.map(value => value.roll))),
    yawRateRms: rms(yawRate),
    yawRateDeltaRms: rms(yawRate.slice(1).map((value, index) => value - yawRate[index])),
    throttleStd: standardDeviation(throttle),
    throttleDeltaRms: rms(throttle.slice(1).map((value, index) => value - throttle[index])),
    wheelLoadStdN: standardDeviation(wheelLoads),
    suspensionVelocityRms: rms(suspensionVelocities),
    longitudinalSlipRms: rms(longitudinalSlip),
    longitudinalSlipPeak: Math.max(...longitudinalSlip.map(Math.abs), 0),
    lateralSlipRmsDeg: rms(lateralSlip) * radiansToDegrees,
    contactLossSamples: samples.reduce(
      (count, sample) => count + sample.wheels.filter(wheel => !wheel.grounded).length,
      0,
    ),
    surfaces: [...new Set(samples.flatMap(sample => sample.wheels.map(wheel => wheel.surface)))],
  };
}

const phases = {
  settle: [1, 120],
  acceleration: [121, 360],
  turn: [361, 432],
  countersteer: [433, 480],
  straighten: [481, 552],
  coast: [553, 672],
};

function phaseReport(samples) {
  return Object.fromEntries(Object.entries(phases).map(([name, [start, end]]) => [
    name,
    summarize(samples.filter(sample => sample.step >= start && sample.step <= end)),
  ]));
}

await send('Runtime.enable');
await send('Page.enable');

const cases = [
  await runCase('jolt', 'ui=off'),
  await runCase('apex-after-settle', 'ui=tuning&auditSwitchStep=120'),
  await runCase('apex-during-acceleration', 'ui=tuning&auditSwitchStep=360'),
];

const joltSamples = cases[0].result.samples;
const report = {
  exactBeforeSwitch: {
    apexAfterSettle: JSON.stringify(joltSamples.slice(0, 120))
      === JSON.stringify(cases[1].result.samples.slice(0, 120)),
    apexDuringAcceleration: JSON.stringify(joltSamples.slice(0, 360))
      === JSON.stringify(cases[2].result.samples.slice(0, 360)),
  },
  cases: Object.fromEntries(cases.map(entry => [
    entry.name,
    {
      traceHash: entry.result.traceHash,
      finalTireModel: entry.result.finalState.tireModel,
      phases: phaseReport(entry.result.samples),
    },
  ])),
};

console.log(JSON.stringify(report, null, 2));
socket.close();
