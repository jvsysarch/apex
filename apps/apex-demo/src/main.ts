import {
  ApexTMeasy,
  SurfaceRegistry,
  TIRE_COMPOUNDS,
  type SurfaceId,
} from '@jvsysarch/apex-physics';
import './style.css';

const radians = (degrees: number) => degrees * Math.PI / 180;
const registry = new SurfaceRegistry();
const tire = new ApexTMeasy();

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="masthead">
    <a class="brand" href="https://github.com/jvsysarch/apex" aria-label="Apex repository">APEX <span>PHYSICS</span></a>
    <p>Public technology preview · tire-force laboratory</p>
  </header>
  <main class="layout">
    <section class="intro">
      <p class="eyebrow">Interactive model</p>
      <h1>Feel the edge of grip.</h1>
      <p class="lede">Change surface, load, slip and tire condition. The graph and force vector are evaluated live by the public Apex TMeasy model.</p>
      <p class="scope">This is a focused public demo. Track authoring, vehicle integration, diagnostics and local services remain in the Apex Drive test bench.</p>
    </section>
    <section class="lab" aria-label="Tire force controls and chart">
      <div class="controls">
        <label>Surface
          <select id="surface"></select>
        </label>
        <label>Compound
          <select id="compound"></select>
        </label>
        <label>Vertical load <output id="load-value"></output>
          <input id="load" type="range" min="1000" max="8000" step="50" value="3800" />
        </label>
        <label>Longitudinal slip <output id="ratio-value"></output>
          <input id="ratio" type="range" min="-0.28" max="0.28" step="0.005" value="0.08" />
        </label>
        <label>Slip angle <output id="angle-value"></output>
          <input id="angle" type="range" min="-18" max="18" step="0.25" value="4" />
        </label>
        <label>Pressure <output id="pressure-value"></output>
          <input id="pressure" type="range" min="18" max="45" step="0.5" value="30" />
        </label>
        <label>Temperature <output id="temperature-value"></output>
          <input id="temperature" type="range" min="0" max="140" step="1" value="85" />
        </label>
        <button id="reset" type="button">Reset laboratory</button>
      </div>
      <div class="visuals">
        <canvas id="chart" aria-label="Longitudinal tire-force chart"></canvas>
        <section class="readout" aria-live="polite">
          <div><span>Longitudinal</span><strong id="fx">0 N</strong></div>
          <div><span>Lateral</span><strong id="fy">0 N</strong></div>
          <div><span>Available grip</span><strong id="grip">0%</strong></div>
          <div><span>Combined slip</span><strong id="combined">0.00</strong></div>
        </section>
      </div>
    </section>
  </main>
  <footer>
    <span>Apex TMeasy v1 · experimental API</span>
    <a href="https://github.com/jvsysarch/apex/tree/main/packages/apex-physics">Explore the source</a>
  </footer>
`;

const inputs = {
  surface: document.querySelector<HTMLSelectElement>('#surface')!,
  compound: document.querySelector<HTMLSelectElement>('#compound')!,
  load: document.querySelector<HTMLInputElement>('#load')!,
  ratio: document.querySelector<HTMLInputElement>('#ratio')!,
  angle: document.querySelector<HTMLInputElement>('#angle')!,
  pressure: document.querySelector<HTMLInputElement>('#pressure')!,
  temperature: document.querySelector<HTMLInputElement>('#temperature')!,
};
const outputs = {
  load: document.querySelector<HTMLOutputElement>('#load-value')!,
  ratio: document.querySelector<HTMLOutputElement>('#ratio-value')!,
  angle: document.querySelector<HTMLOutputElement>('#angle-value')!,
  pressure: document.querySelector<HTMLOutputElement>('#pressure-value')!,
  temperature: document.querySelector<HTMLOutputElement>('#temperature-value')!,
  fx: document.querySelector<HTMLElement>('#fx')!,
  fy: document.querySelector<HTMLElement>('#fy')!,
  grip: document.querySelector<HTMLElement>('#grip')!,
  combined: document.querySelector<HTMLElement>('#combined')!,
};
const canvas = document.querySelector<HTMLCanvasElement>('#chart')!;
const context = canvas.getContext('2d')!;

for (const surface of registry.list()) {
  inputs.surface.add(new Option(surface.label, surface.id));
}
for (const compound of TIRE_COMPOUNDS) {
  inputs.compound.add(new Option(compound.label, compound.id));
}
inputs.surface.value = 'asphalt';
inputs.compound.value = 'semi-slick';

const value = (input: HTMLInputElement) => Number(input.value);
const forceLabel = (force: number) => `${Math.round(force).toLocaleString('en-US')} N`;

const sampleFor = (slipRatio: number) => ({
  wheelIndex: 0,
  verticalLoadN: value(inputs.load),
  slipRatio,
  slipAngleRadians: radians(value(inputs.angle)),
  forwardSpeedMps: 27.8,
  angularVelocityRadPerSecond: 27.8 * (1 + slipRatio) / 0.33,
  wheelRadiusM: 0.33,
  surface: registry.get(inputs.surface.value as SurfaceId),
  deltaTimeSeconds: 1 / 360,
});

const drawChart = () => {
  const width = Math.max(320, canvas.clientWidth);
  const height = Math.max(260, canvas.clientHeight);
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, width, height);

  const pad = { left: 44, right: 18, top: 24, bottom: 34 };
  const graphWidth = width - pad.left - pad.right;
  const graphHeight = height - pad.top - pad.bottom;
  const centerY = pad.top + graphHeight / 2;
  const current = tire.evaluate(sampleFor(value(inputs.ratio)));
  const limit = Math.max(1000, current.longitudinalCapacityN);

  context.strokeStyle = 'rgba(174, 214, 224, 0.16)';
  context.lineWidth = 1;
  for (let index = 0; index < 5; index += 1) {
    const y = pad.top + graphHeight * index / 4;
    context.beginPath();
    context.moveTo(pad.left, y);
    context.lineTo(width - pad.right, y);
    context.stroke();
  }
  context.beginPath();
  context.moveTo(pad.left, centerY);
  context.lineTo(width - pad.right, centerY);
  context.stroke();

  context.strokeStyle = '#72e6ff';
  context.lineWidth = 2.5;
  context.beginPath();
  for (let index = 0; index <= 160; index += 1) {
    const slipRatio = -0.28 + index * 0.56 / 160;
    const forces = tire.evaluate(sampleFor(slipRatio));
    const x = pad.left + graphWidth * index / 160;
    const y = centerY - forces.longitudinalForceN / limit * graphHeight * 0.42;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();

  const markerX = pad.left + (value(inputs.ratio) + 0.28) / 0.56 * graphWidth;
  const markerY = centerY - current.longitudinalForceN / limit * graphHeight * 0.42;
  context.fillStyle = '#ffb45f';
  context.beginPath();
  context.arc(markerX, markerY, 5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#a9c0c9';
  context.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText('BRAKING', pad.left, height - 10);
  context.fillText('ACCELERATION', width - 116, height - 10);
  context.fillText('LONGITUDINAL FORCE', pad.left, 14);
};

const update = () => {
  tire.configureOperatingParameters({
    compound: inputs.compound.value as typeof TIRE_COMPOUNDS[number]['id'],
    pressurePsi: value(inputs.pressure),
    temperatureC: value(inputs.temperature),
  });
  const forces = tire.evaluate(sampleFor(value(inputs.ratio)));
  outputs.load.value = `${value(inputs.load).toLocaleString('en-US')} N`;
  outputs.ratio.value = `${(value(inputs.ratio) * 100).toFixed(1)}%`;
  outputs.angle.value = `${value(inputs.angle).toFixed(1)}°`;
  outputs.pressure.value = `${value(inputs.pressure).toFixed(1)} psi`;
  outputs.temperature.value = `${value(inputs.temperature).toFixed(0)}°C`;
  outputs.fx.textContent = forceLabel(forces.longitudinalForceN);
  outputs.fy.textContent = forceLabel(forces.lateralForceN);
  outputs.grip.textContent = `${Math.round(forces.state.adhesion * 100)}%`;
  outputs.combined.textContent = forces.state.combinedSlip.toFixed(2);
  drawChart();
};

Object.values(inputs).forEach(input => input.addEventListener('input', update));
document.querySelector<HTMLButtonElement>('#reset')!.addEventListener('click', () => {
  inputs.surface.value = 'asphalt';
  inputs.compound.value = 'semi-slick';
  inputs.load.value = '3800';
  inputs.ratio.value = '0.08';
  inputs.angle.value = '4';
  inputs.pressure.value = '30';
  inputs.temperature.value = '85';
  update();
});
window.addEventListener('resize', update);
update();
