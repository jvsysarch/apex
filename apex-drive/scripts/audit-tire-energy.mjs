import WebSocket from 'ws';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const debugPort = process.argv[2] ?? '9232';
const appPort = process.argv[3] ?? '5175';
const outputFileName = process.argv[4] ?? 'tire-energy-benchmark.json';
const targets = await fetch(`http://127.0.0.1:${debugPort}/json`).then(
  response => response.json(),
);
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
await send('Page.navigate', { url: `http://127.0.0.1:${appPort}/?ui=off` });
await new Promise(resolveDelay => setTimeout(resolveDelay, 500));

const report = await evaluate(`(async () => {
  const [
    { ApexVehicleWorld },
    { ApexTMeasy },
    surfaceModule,
    { loadApexPhysicsBrowserRuntime },
    { createApexGlobalFloorCollisionGroup },
  ] = await Promise.all([
    import('/src/apex-vehicle.ts'),
    import('/src/physics/tires/force/ApexTMeasy.ts'),
    import('/src/physics/surfaces/SurfaceRegistry.ts'),
    import('/src/runtime/loadApexPhysicsBrowserRuntime.ts'),
    import('/src/world/physics/ApexWorldStaticCollisionBuilder.ts'),
  ]);
  const physicsHz = 360;
  const dt = 1 / physicsHz;
  const vehicleMassKg = 1550;
  const wheelIds = ['FL', 'FR', 'RL', 'RR'];
  const clamp = (value, minimum, maximum) => Math.max(
    minimum,
    Math.min(maximum, value),
  );
  const control = (throttle, steering, handbrake = false) => ({
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake,
    throttle,
    brake: 0,
    steering,
  });
  const createWorld = async () => {
    const J = await loadApexPhysicsBrowserRuntime(() => {});
    const world = ApexVehicleWorld.create(J);
    const surfaces = new surfaceModule.SurfaceRegistry();
    world.replaceStaticColliderGroup(createApexGlobalFloorCollisionGroup(
      2000,
      surfaces.get('grass').lateralMu,
    ));
    world.configureTireContactEvaluation(8, physicsHz);
    world.setTireModel('apex-tmeasy-v1');
    world.setHandlingStage('tire-only');
    world.setActiveSurface('asphalt');
    return world;
  };
  const accelerateTo = (world, targetSpeedKmh) => {
    let state = world.getState();
    let steps = 0;
    while (state.speedKmh < targetSpeedKmh && steps < physicsHz * 14) {
      world.step(control(1, 0));
      state = world.getState();
      steps += 1;
    }
    return state;
  };
  const radiusSteering = (state, radiusM) => {
    if (!Number.isFinite(radiusM)) return 0;
    const desiredYawRate = state.speedKmh / 3.6 / radiusM;
    const yawError = desiredYawRate - Math.abs(state.yawRate);
    return -clamp(0.08 + yawError * 0.42, 0.035, 0.58);
  };
  const settleCircle = (world, targetSpeedKmh, radiusM, durationSeconds = 3) => {
    let state = world.getState();
    for (let step = 0; step < durationSeconds * physicsHz; step += 1) {
      const speedError = targetSpeedKmh - state.speedKmh;
      const throttle = clamp(0.22 + speedError * 0.055, 0, 1);
      world.step(control(throttle, radiusSteering(state, radiusM)));
      state = world.getState();
    }
    return state;
  };
  const summarize = (initialState, samples, finalState, durationSeconds) => {
    const average = selector => samples.reduce(
      (sum, sample) => sum + selector(sample),
      0,
    ) / Math.max(1, samples.length);
    const wheelMetrics = Object.fromEntries(wheelIds.map((id, wheelIndex) => {
      const finalWheel = finalState.wheels[wheelIndex];
      return [id, {
        averageAbsFxN: average(state => Math.abs(
          state.wheels[wheelIndex].longitudinalForceN,
        )),
        averageAbsFyN: average(state => Math.abs(
          state.wheels[wheelIndex].lateralForceN,
        )),
        averageSlipAngleDeg: average(state => Math.abs(
          state.wheels[wheelIndex].lateralSlipRadians,
        )) * 180 / Math.PI,
        averageLongitudinalPowerLossW: average(
          state => state.wheels[wheelIndex].longitudinalPowerLossW,
        ),
        averageLateralPowerLossW: average(
          state => state.wheels[wheelIndex].lateralPowerLossW,
        ),
        longitudinalEnergyLossJ: finalWheel.longitudinalEnergyLossJ,
        lateralEnergyLossJ: finalWheel.lateralEnergyLossJ,
      }];
    }));
    const totalLongitudinalEnergyJ = Object.values(wheelMetrics).reduce(
      (sum, wheel) => sum + wheel.longitudinalEnergyLossJ,
      0,
    );
    const totalLateralEnergyJ = Object.values(wheelMetrics).reduce(
      (sum, wheel) => sum + wheel.lateralEnergyLossJ,
      0,
    );
    const translationalKineticEnergyLossJ = 0.5 * vehicleMassKg * (
      (initialState.speedKmh / 3.6) ** 2
      - (finalState.speedKmh / 3.6) ** 2
    );
    const averageTotalPowerLossW = (
      totalLongitudinalEnergyJ + totalLateralEnergyJ
    ) / durationSeconds;
    return {
      durationSeconds,
      initialSpeedKmh: initialState.speedKmh,
      finalSpeedKmh: finalState.speedKmh,
      speedLossKmhPerSecond: (
        initialState.speedKmh - finalState.speedKmh
      ) / durationSeconds,
      averageSpeedKmh: average(state => state.speedKmh),
      averageAbsYawRate: average(state => Math.abs(state.yawRate)),
      averageLateralAccelerationG: average(
        state => state.speedKmh / 3.6 * Math.abs(state.yawRate) / 9.81,
      ),
      averageMeasuredRadiusM: average(state => {
        const yawRate = Math.abs(state.yawRate);
        return yawRate > 0.05 ? state.speedKmh / 3.6 / yawRate : 10000;
      }),
      averageDeliveredEngineTorqueNm: average(
        state => state.deliveredEngineTorqueNm,
      ),
      totalLongitudinalEnergyJ,
      totalLateralEnergyJ,
      totalEnergyJ: totalLongitudinalEnergyJ + totalLateralEnergyJ,
      averageTotalPowerLossW,
      translationalKineticEnergyLossJ,
      averageTranslationalKineticPowerLossW:
        translationalKineticEnergyLossJ / durationSeconds,
      averagePowerLossOutsideMeasuredTireSlipW:
        translationalKineticEnergyLossJ / durationSeconds - averageTotalPowerLossW,
      wheels: wheelMetrics,
    };
  };
  const measure = (
    world,
    durationSeconds,
    inputForState,
  ) => {
    world.resetTireEnergyDissipation();
    const initialState = world.getState();
    let state = initialState;
    const samples = [];
    for (let step = 0; step < durationSeconds * physicsHz; step += 1) {
      world.step(inputForState(state, step));
      state = world.getState();
      samples.push(state);
    }
    return summarize(initialState, samples, state, durationSeconds);
  };

  // 1. Curva a radio objetivo sin acelerador, preparada a varias velocidades.
  const constantRadiusCoast = [];
  for (const targetSpeedKmh of [40, 60, 80]) {
    const world = await createWorld();
    accelerateTo(world, targetSpeedKmh);
    settleCircle(world, targetSpeedKmh, 40);
    constantRadiusCoast.push({
      targetSpeedKmh,
      targetRadiusM: 40,
      metrics: measure(
        world,
        4,
        state => control(0, radiusSteering(state, 40)),
      ),
    });
  }

  // 2. Barrido matemático de slip angle a carga y velocidad constantes.
  const model = new ApexTMeasy();
  const surface = surfaceModule.SURFACE_CATALOG.find(
    candidate => candidate.id === 'asphalt',
  );
  const sweepSpeedMps = 20;
  const slipAngleSweep = [0, 3, 5, 8, 12, 20, 30].map(slipAngleDeg => {
    const slipAngleRadians = slipAngleDeg * Math.PI / 180;
    const forces = model.evaluate({
      wheelIndex: 0,
      verticalLoadN: 3800,
      slipRatio: 0,
      slipAngleRadians,
      forwardSpeedMps: sweepSpeedMps,
      angularVelocityRadPerSecond: sweepSpeedMps / 0.34,
      wheelRadiusM: 0.34,
      surface,
      deltaTimeSeconds: dt,
    });
    const lateralVelocityMps = Math.tan(slipAngleRadians) * sweepSpeedMps;
    return {
      slipAngleDeg,
      lateralForceN: forces.lateralForceN,
      parasiticLongitudinalForceN: forces.longitudinalForceN,
      lateralVelocityMps,
      lateralPowerLossW: Math.abs(forces.lateralForceN * lateralVelocityMps),
      longitudinalPowerLossW: 0,
      aligningMomentNm: forces.aligningMomentNm,
      adhesion: forces.state.adhesion,
    };
  });

  // 3. Coast-down con la misma velocidad inicial y severidad lateral creciente.
  const coastDown = [];
  for (const condition of [
    { id: 'straight', radiusM: Infinity, steering: 0 },
    { id: 'mild', radiusM: 80 },
    { id: 'medium', radiusM: 40 },
    { id: 'drift', radiusM: null, steering: -0.55 },
  ]) {
    const world = await createWorld();
    accelerateTo(world, 80);
    if (Number.isFinite(condition.radiusM)) {
      settleCircle(world, 80, condition.radiusM);
    } else if (condition.id === 'drift') {
      let state = world.getState();
      for (let step = 0; step < physicsHz; step += 1) {
        world.step(control(0.35, condition.steering));
        state = world.getState();
      }
    }
    coastDown.push({
      condition: condition.id,
      targetRadiusM: condition.radiusM,
      metrics: measure(world, 5, state => control(
        0,
        Number.isFinite(condition.radiusM)
          ? radiusSteering(state, condition.radiusM)
          : condition.steering,
      )),
    });
  }

  // 4. Mismo círculo con throttle constante.
  const constantThrottleCircle = [];
  for (const throttle of [0, 0.25, 0.5, 0.75]) {
    const world = await createWorld();
    accelerateTo(world, 60);
    settleCircle(world, 60, 40);
    constantThrottleCircle.push({
      throttle,
      targetRadiusM: 40,
      metrics: measure(
        world,
        5,
        state => control(throttle, radiusSteering(state, 40)),
      ),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    model: model.id,
    physicsHz,
    contactCount: 8,
    operatingParameters: model.getOperatingParameters(),
    stages: {
      constantRadiusCoast,
      slipAngleSweep,
      coastDown,
      constantThrottleCircle,
    },
  };
})()`);

const outputDirectory = resolve('artifacts');
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  resolve(outputDirectory, outputFileName),
  `${JSON.stringify(report, null, 2)}\n`,
);

const compact = {
  model: report.model,
  operatingParameters: report.operatingParameters,
  constantRadiusCoast: report.stages.constantRadiusCoast.map(result => ({
    targetSpeedKmh: result.targetSpeedKmh,
    speedLossKmhPerSecond: result.metrics.speedLossKmhPerSecond,
    averageMeasuredRadiusM: result.metrics.averageMeasuredRadiusM,
    averageLateralAccelerationG: result.metrics.averageLateralAccelerationG,
    averageTotalPowerLossKw: result.metrics.averageTotalPowerLossW / 1000,
    averagePowerLossOutsideMeasuredTireSlipKw:
      result.metrics.averagePowerLossOutsideMeasuredTireSlipW / 1000,
    lateralEnergyKj: result.metrics.totalLateralEnergyJ / 1000,
  })),
  slipAngleSweep: report.stages.slipAngleSweep,
  coastDown: report.stages.coastDown.map(result => ({
    condition: result.condition,
    speedLossKmhPerSecond: result.metrics.speedLossKmhPerSecond,
    averageTotalPowerLossKw: result.metrics.averageTotalPowerLossW / 1000,
    averagePowerLossOutsideMeasuredTireSlipKw:
      result.metrics.averagePowerLossOutsideMeasuredTireSlipW / 1000,
    lateralEnergyKj: result.metrics.totalLateralEnergyJ / 1000,
  })),
  constantThrottleCircle: report.stages.constantThrottleCircle.map(result => ({
    throttle: result.throttle,
    initialSpeedKmh: result.metrics.initialSpeedKmh,
    finalSpeedKmh: result.metrics.finalSpeedKmh,
    averageDeliveredEngineTorqueNm: result.metrics.averageDeliveredEngineTorqueNm,
    averageTotalPowerLossKw: result.metrics.averageTotalPowerLossW / 1000,
  })),
};
console.log(JSON.stringify(compact, null, 2));
socket.close();
