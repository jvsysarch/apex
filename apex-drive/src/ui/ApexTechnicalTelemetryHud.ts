import * as THREE from 'three/webgpu';
import type { VehiclePose } from '../rendering/ApexVehiclePoseAdapter';

const WHEEL_IDS = ['FL', 'FR', 'RL', 'RR'] as const;
const WHEEL_COLORS = ['#55d8e8', '#e9ca72', '#b47cf1', '#ff7f8f'] as const;
const SLIP_HISTORY_SAMPLES = 120;
const SUSPENSION_DISPLAY_MIN_M = 0.2;
const SUSPENSION_DISPLAY_MAX_M = 0.5;
const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
);

export class ApexTechnicalTelemetryHud {
  readonly root: HTMLElement;

  private readonly toggle: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private readonly speed: HTMLOutputElement;
  private readonly steering: HTMLOutputElement;
  private readonly maximumSlip: HTMLOutputElement;
  private readonly totalLoad: HTMLOutputElement;
  private readonly clutch: HTMLElement;
  private readonly clutchStatus: HTMLOutputElement;
  private readonly clutchValue: HTMLOutputElement;
  private readonly clutchFill: HTMLElement;
  private readonly physicsRate: HTMLElement;
  private readonly tireBackend: HTMLElement;
  private readonly slipCanvas: HTMLCanvasElement;
  private readonly slipScale: HTMLOutputElement;
  private readonly slipValues: readonly HTMLOutputElement[];
  private readonly wheelGroups: readonly SVGGElement[];
  private readonly wheelTires: readonly SVGRectElement[];
  private readonly wheelSuspensionLinks: readonly SVGLineElement[];
  private readonly wheelContacts: readonly SVGCircleElement[];
  private readonly wheelVectors: readonly SVGLineElement[];
  private readonly wheelCards: readonly HTMLElement[];
  private readonly slipHistories = WHEEL_IDS.map(
    () => new Float32Array(SLIP_HISTORY_SAMPLES),
  );
  private slipHistoryCursor = 0;
  private slipHistoryLength = 0;
  private readonly smoothedSuspensionExtensions = [0.5, 0.5, 0.5, 0.5];
  private elapsedSinceDomUpdate = 1;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('aside');
    this.root.className = 'apex-technical-telemetry';
    this.root.hidden = true;
    this.root.innerHTML = this.markup();
    parent.append(this.root);

    this.toggle = this.required('.apex-technical-telemetry__toggle');
    this.panel = this.required('.apex-technical-telemetry__panel');
    this.speed = this.required('[data-telemetry-speed]');
    this.steering = this.required('[data-telemetry-steering]');
    this.maximumSlip = this.required('[data-telemetry-slip]');
    this.totalLoad = this.required('[data-telemetry-load]');
    this.clutch = this.required('[data-telemetry-clutch]');
    this.clutchStatus = this.required('[data-telemetry-clutch-status]');
    this.clutchValue = this.required('[data-telemetry-clutch-value]');
    this.clutchFill = this.required('[data-telemetry-clutch-fill]');
    this.physicsRate = this.required('[data-telemetry-physics-rate]');
    this.tireBackend = this.required('[data-telemetry-tire-backend]');
    this.slipCanvas = this.required('[data-telemetry-slip-canvas]');
    this.slipScale = this.required('[data-telemetry-slip-scale]');
    this.slipValues = WHEEL_IDS.map(id => (
      this.required<HTMLOutputElement>(`[data-telemetry-slip-value="${id}"]`)
    ));
    this.wheelGroups = WHEEL_IDS.map(id => (
      this.required<SVGGElement>(`[data-telemetry-wheel="${id}"]`)
    ));
    this.wheelTires = WHEEL_IDS.map(id => (
      this.required<SVGRectElement>(`[data-telemetry-tire="${id}"]`)
    ));
    this.wheelSuspensionLinks = WHEEL_IDS.map(id => (
      this.required<SVGLineElement>(`[data-telemetry-suspension="${id}"]`)
    ));
    this.wheelContacts = WHEEL_IDS.map(id => (
      this.required<SVGCircleElement>(`[data-telemetry-contact="${id}"]`)
    ));
    this.wheelVectors = WHEEL_IDS.map(id => (
      this.required<SVGLineElement>(`[data-telemetry-vector="${id}"]`)
    ));
    this.wheelCards = WHEEL_IDS.map(id => (
      this.required<HTMLElement>(`[data-telemetry-card="${id}"]`)
    ));

    const storedOpen = localStorage.getItem(
      'apex-drive.technical-telemetry.open',
    ) === 'true';
    this.setOpen(storedOpen);
    this.toggle.addEventListener('click', () => {
      this.setOpen(this.panel.hidden);
    });
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  update(
    pose: VehiclePose,
    deltaSeconds: number,
    physicsHz: number,
    tireExecutionBackend: string,
  ): void {
    const delta = clamp(deltaSeconds, 1 / 240, 0.1);
    this.elapsedSinceDomUpdate += delta;
    if (this.elapsedSinceDomUpdate < 1 / 20) return;
    this.elapsedSinceDomUpdate = 0;

    const steeringDegrees = pose.steering * 30;
    const maximumLongitudinalSlip = Math.max(
      0,
      ...pose.wheelLongitudinalSlips.map(Math.abs),
    );
    const maximumLateralSlipDegrees = THREE.MathUtils.radToDeg(Math.max(
      0,
      ...pose.wheelLateralSlipRadians.map(Math.abs),
    ));
    const totalLoadN = pose.wheelVerticalLoadsN.reduce(
      (total, load) => total + Math.max(0, load),
      0,
    );

    this.speed.value = Math.round(pose.speedKmh).toString().padStart(3, '0');
    this.steering.value = `${steeringDegrees >= 0 ? '+' : ''}${steeringDegrees.toFixed(1)}°`;
    this.maximumSlip.value = `${Math.round(maximumLongitudinalSlip * 100)}% · ${maximumLateralSlipDegrees.toFixed(1)}°`;
    this.totalLoad.value = `${(totalLoadN / 1000).toFixed(1)} kN`;
    const clutchState = pose.gear === 0
      ? 'free'
      : pose.transmissionSwitchingGear
        ? 'switching'
        : pose.clutchEngagement >= 0.85
          ? 'engaged'
          : pose.clutchEngagement <= 0.1 ? 'free' : 'coupling';
    const clutchLabel = {
      engaged: 'ACOPLADO',
      switching: 'DESACOPLANDO',
      coupling: 'ACOPLANDO',
      free: 'LIBRE',
    }[clutchState];
    this.clutch.dataset.state = clutchState;
    this.clutchStatus.value = clutchLabel;
    this.clutchValue.value = `${Math.round(pose.clutchEngagement * 100)}%`;
    this.clutchFill.style.width = `${Math.round(pose.clutchEngagement * 100)}%`;
    this.physicsRate.textContent = `${physicsHz} HZ`;
    this.tireBackend.textContent = tireExecutionBackend
      .replace(/^compiled-/, '')
      .replace(/-/g, ' ')
      .toUpperCase();

    const currentSlip = WHEEL_IDS.map(
      (_, index) => pose.wheelLongitudinalSlips[index] ?? 0,
    );
    currentSlip.forEach((value, index) => {
      this.slipHistories[index]![this.slipHistoryCursor] = value;
      this.slipValues[index]!.value = `${(value * 100).toFixed(1)}%`;
    });
    this.slipHistoryCursor = (
      this.slipHistoryCursor + 1
    ) % SLIP_HISTORY_SAMPLES;
    this.slipHistoryLength = Math.min(
      SLIP_HISTORY_SAMPLES,
      this.slipHistoryLength + 1,
    );
    this.drawSlipScope();

    WHEEL_IDS.forEach((id, index) => {
      const grounded = pose.wheelGrounded[index] ?? false;
      const longSlip = pose.wheelLongitudinalSlips[index] ?? 0;
      const lateralSlipRadians = pose.wheelLateralSlipRadians[index] ?? 0;
      const lateralSlipDegrees = THREE.MathUtils.radToDeg(lateralSlipRadians);
      const loadN = Math.max(0, pose.wheelVerticalLoadsN[index] ?? 0);
      const suspensionLengthM = (
        pose.wheelSuspensionLengthsM[index] ?? SUSPENSION_DISPLAY_MAX_M
      );
      const suspensionExtension = clamp(
        (
          suspensionLengthM - SUSPENSION_DISPLAY_MIN_M
        ) / (
          SUSPENSION_DISPLAY_MAX_M - SUSPENSION_DISPLAY_MIN_M
        ),
        0,
        1,
      );
      this.smoothedSuspensionExtensions[index] = THREE.MathUtils.lerp(
        this.smoothedSuspensionExtensions[index]!,
        suspensionExtension,
        0.22,
      );
      const smoothedExtension = this.smoothedSuspensionExtensions[index]!;
      const suspensionCompression = 1 - smoothedExtension;
      const wheelSide = index % 2 === 0 ? -1 : 1;
      const chassisEdgeX = wheelSide < 0 ? 43 : 117;
      const wheelGap = THREE.MathUtils.lerp(4, 23, smoothedExtension);
      const wheelX = chassisEdgeX + wheelSide * wheelGap;
      const wheelY = index < 2 ? 57 : 163;
      const angularVelocity = Math.abs(
        pose.wheelAngularVelocitiesRadiansPerSecond[index] ?? 0,
      );
      const locked = (
        grounded
        && pose.brake > 0.12
        && pose.speedKmh > 4
        && (
          longSlip < -0.5
          || (
            angularVelocity < 2.2
            && Math.abs(longSlip) > 0.28
          )
        )
      );
      const wheelAngle = index < 2 ? steeringDegrees : 0;
      const slipIntensity = locked
        ? 1
        : grounded
          ? clamp(
            Math.max(
              Math.abs(longSlip) / 0.5,
              Math.abs(lateralSlipDegrees) / 14,
            ),
            0,
            1,
          )
          : 0;
      const visibleSlipIntensity = Math.pow(slipIntensity, 0.72);
      const tireFillColor = new THREE.Color('#101d22')
        .lerp(new THREE.Color('#ff203f'), visibleSlipIntensity)
        .getStyle();
      const tireStrokeColor = new THREE.Color('#b7edf3')
        .lerp(new THREE.Color('#ff3858'), visibleSlipIntensity)
        .getStyle();
      this.wheelGroups[index]!.setAttribute(
        'transform',
        `translate(${wheelX.toFixed(2)} ${wheelY}) rotate(${wheelAngle.toFixed(2)})`,
      );
      this.wheelGroups[index]!.dataset.state = locked
        ? 'locked'
        : grounded ? 'grounded' : 'airborne';
      const tire = this.wheelTires[index]!;
      const tireWidth = THREE.MathUtils.lerp(11, 24, suspensionCompression);
      const tireHeight = THREE.MathUtils.lerp(50, 26, suspensionCompression);
      tire.setAttribute('x', (-tireWidth * 0.5).toFixed(2));
      tire.setAttribute('y', (-tireHeight * 0.5).toFixed(2));
      tire.setAttribute('width', tireWidth.toFixed(2));
      tire.setAttribute('height', tireHeight.toFixed(2));
      tire.style.fill = tireFillColor;
      tire.style.stroke = tireStrokeColor;
      tire.style.filter = visibleSlipIntensity > 0.04
        ? `drop-shadow(0 0 ${(2 + visibleSlipIntensity * 5).toFixed(1)}px ${tireStrokeColor})`
        : 'none';
      const suspensionLink = this.wheelSuspensionLinks[index]!;
      suspensionLink.setAttribute('x1', chassisEdgeX.toString());
      suspensionLink.setAttribute('y1', wheelY.toString());
      suspensionLink.setAttribute(
        'x2',
        (wheelX - wheelSide * 8).toFixed(2),
      );
      suspensionLink.setAttribute('y2', wheelY.toString());
      suspensionLink.setAttribute(
        'stroke-width',
        (0.8 + suspensionCompression * 1.8).toFixed(2),
      );
      suspensionLink.setAttribute(
        'opacity',
        (0.32 + suspensionCompression * 0.68).toFixed(2),
      );
      this.wheelContacts[index]!.setAttribute(
        'class',
        locked ? 'is-locked' : grounded ? 'is-grounded' : 'is-airborne',
      );
      this.wheelVectors[index]!.setAttribute(
        'x2',
        clamp(lateralSlipDegrees * 1.5, -20, 20).toFixed(2),
      );
      this.wheelVectors[index]!.setAttribute(
        'y2',
        (-clamp(longSlip * 42, -22, 22)).toFixed(2),
      );
      this.wheelVectors[index]!.style.stroke = tireStrokeColor;
      this.wheelVectors[index]!.style.filter = visibleSlipIntensity > 0.04
        ? `drop-shadow(0 0 ${(2 + visibleSlipIntensity * 4).toFixed(1)}px ${tireStrokeColor})`
        : '';
      const card = this.wheelCards[index]!;
      card.dataset.contact = grounded ? 'grounded' : 'airborne';
      card.dataset.state = locked ? 'locked' : 'rolling';
      card.style.borderColor = tireStrokeColor;
      card.style.boxShadow = visibleSlipIntensity > 0.04
        ? `inset 0 0 14px rgba(255, 32, 63, ${(visibleSlipIntensity * 0.24).toFixed(2)})`
        : '';
      card.querySelector<HTMLElement>('[data-wheel-slip]')!.textContent = (
        `${(longSlip * 100).toFixed(1)}% / ${lateralSlipDegrees.toFixed(1)}°`
      );
      card.querySelector<HTMLElement>('[data-wheel-load]')!.textContent = (
        `${(loadN / 1000).toFixed(2)} kN`
      );
      card.querySelector<HTMLElement>('[data-wheel-surface]')!.textContent = (
        pose.wheelSurfaces[index]?.toUpperCase() ?? '—'
      );
      card.querySelector<HTMLElement>('[data-wheel-id]')!.textContent = id;
    });
  }

  private drawSlipScope(): void {
    const bounds = this.slipCanvas.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    const width = Math.round(bounds.width * pixelRatio);
    const height = Math.round(bounds.height * pixelRatio);
    if (this.slipCanvas.width !== width || this.slipCanvas.height !== height) {
      this.slipCanvas.width = width;
      this.slipCanvas.height = height;
    }
    const context = this.slipCanvas.getContext('2d');
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);

    context.lineWidth = 1;
    context.strokeStyle = '#5d7d852b';
    for (let row = 1; row < 4; row += 1) {
      const y = bounds.height * row / 4;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(bounds.width, y);
      context.stroke();
    }
    for (let column = 1; column < 6; column += 1) {
      const x = bounds.width * column / 6;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, bounds.height);
      context.stroke();
    }
    const laneHeight = bounds.height / WHEEL_IDS.length;
    WHEEL_IDS.forEach((_, wheelIndex) => {
      const centerY = (wheelIndex + 0.5) * laneHeight;
      context.strokeStyle = `${WHEEL_COLORS[wheelIndex]}45`;
      context.beginPath();
      context.moveTo(0, centerY);
      context.lineTo(bounds.width, centerY);
      context.stroke();
    });

    let maximumAbsoluteSlip = 0.04;
    this.slipHistories.forEach(history => {
      for (let index = 0; index < this.slipHistoryLength; index += 1) {
        maximumAbsoluteSlip = Math.max(
          maximumAbsoluteSlip,
          Math.abs(history[index]!),
        );
      }
    });
    const scale = clamp(maximumAbsoluteSlip * 1.2, 0.04, 0.6);
    this.slipScale.value = `±${Math.round(scale * 100)}%`;
    const amplitude = laneHeight * 0.38;

    this.slipHistories.forEach((history, wheelIndex) => {
      if (this.slipHistoryLength < 2) return;
      const centerY = (wheelIndex + 0.5) * laneHeight;
      context.beginPath();
      context.strokeStyle = WHEEL_COLORS[wheelIndex]!;
      context.lineWidth = 1.65;
      context.shadowColor = WHEEL_COLORS[wheelIndex]!;
      context.shadowBlur = 3;
      let latestX = 0;
      let latestY = centerY;
      for (let sample = 0; sample < this.slipHistoryLength; sample += 1) {
        const historyIndex = this.slipHistoryLength < SLIP_HISTORY_SAMPLES
          ? sample
          : (this.slipHistoryCursor + sample) % SLIP_HISTORY_SAMPLES;
        const x = bounds.width - (
          (this.slipHistoryLength - 1 - sample)
          / (SLIP_HISTORY_SAMPLES - 1)
        ) * bounds.width;
        const y = centerY - clamp(
          history[historyIndex]! / scale,
          -1,
          1,
        ) * amplitude;
        latestX = x;
        latestY = y;
        if (sample === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
      context.beginPath();
      context.fillStyle = WHEEL_COLORS[wheelIndex]!;
      context.arc(latestX, latestY, 2.3, 0, Math.PI * 2);
      context.fill();
    });
    context.shadowBlur = 0;
  }

  private setOpen(open: boolean): void {
    this.panel.hidden = !open;
    this.root.dataset.open = open ? 'true' : 'false';
    this.toggle.setAttribute('aria-expanded', String(open));
    this.toggle.title = open ? 'Cerrar telemetría' : 'Abrir telemetría';
    localStorage.setItem(
      'apex-drive.technical-telemetry.open',
      String(open),
    );
  }

  private required<T extends Element>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Falta el nodo de telemetría ${selector}`);
    return element;
  }

  private markup(): string {
    const wheel = (id: typeof WHEEL_IDS[number]) => `
      <line
        class="apex-vehicle-schematic__suspension"
        data-telemetry-suspension="${id}"
      ></line>
      <g data-telemetry-wheel="${id}">
        <rect
          data-telemetry-tire="${id}"
          x="-8"
          y="-20"
          width="16"
          height="40"
          rx="4"
        ></rect>
        <line data-telemetry-vector="${id}" x1="0" y1="0" x2="0" y2="0"></line>
        <circle data-telemetry-contact="${id}" cx="0" cy="0" r="3"></circle>
      </g>
    `;
    const wheelCard = (id: typeof WHEEL_IDS[number]) => `
      <article class="apex-wheel-telemetry" data-telemetry-card="${id}">
        <header>
          <strong data-wheel-id>${id}</strong>
          <span data-wheel-surface>ASPHALT</span>
        </header>
        <output data-wheel-slip>0.0% / 0.0°</output>
        <small>SLIP RATIO / ANGLE</small>
        <output data-wheel-load>0.00 kN</output>
        <small>VERTICAL LOAD</small>
      </article>
    `;

    return `
      <button
        class="apex-technical-telemetry__toggle"
        type="button"
        aria-label="Telemetría técnica"
        aria-expanded="false"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 18V9M9 18V5M14 18v-7M19 18V7"></path>
          <path d="M3 18.5h18M4 12l5-3 5 4 5-4"></path>
        </svg>
        <span>LIVE</span>
      </button>
      <section class="apex-technical-telemetry__panel" hidden>
        <header class="apex-technical-telemetry__header">
          <div>
            <small>APEX PHYSICS · LIVE</small>
            <strong>VEHICLE DYNAMICS</strong>
          </div>
          <div class="apex-technical-telemetry__badges">
            <span data-telemetry-physics-rate>360 HZ</span>
            <span>WASM</span>
            <span data-telemetry-tire-backend>WEBGPU</span>
          </div>
        </header>
        <div class="apex-technical-telemetry__overview">
          <figure class="apex-vehicle-schematic">
            <figcaption>SUSPENSION + CONTACT + SLIP</figcaption>
            <svg viewBox="0 0 160 220" role="img" aria-label="Vista cenital del vehículo">
              <path class="apex-vehicle-schematic__body" d="M55 31 Q80 17 105 31 L117 80 L112 189 Q80 204 48 189 L43 80 Z"></path>
              <path class="apex-vehicle-schematic__center" d="M80 24v174M52 110h56"></path>
              ${WHEEL_IDS.map(wheel).join('')}
            </svg>
          </figure>
          <figure class="apex-slip-scope">
            <figcaption>
              <span>WHEEL SLIP RATIO · LIVE</span>
              <output data-telemetry-slip-scale>±12%</output>
            </figcaption>
            <canvas data-telemetry-slip-canvas aria-label="Historial de slip de las cuatro ruedas"></canvas>
            <div class="apex-slip-scope__legend">
              ${WHEEL_IDS.map((id, index) => `
                <span style="--wheel-color:${WHEEL_COLORS[index]}">
                  ${id} <output data-telemetry-slip-value="${id}">0.0%</output>
                </span>
              `).join('')}
            </div>
          </figure>
        </div>
        <section class="apex-technical-telemetry__metrics">
          <article><small>SPEED</small><output data-telemetry-speed>000</output><span>km/h</span></article>
          <article><small>STEERING</small><output data-telemetry-steering>+0.0°</output></article>
          <article><small>MAX SLIP</small><output data-telemetry-slip>0% · 0.0°</output></article>
          <article><small>TOTAL LOAD</small><output data-telemetry-load>0.0 kN</output></article>
        </section>
        <section class="apex-clutch-telemetry" data-telemetry-clutch data-state="free">
          <span class="apex-clutch-telemetry__lamp" aria-hidden="true"></span>
          <div>
            <small>TRANSMISSION · CLUTCH</small>
            <output data-telemetry-clutch-status>LIBRE</output>
          </div>
          <div class="apex-clutch-telemetry__track" aria-hidden="true">
            <i data-telemetry-clutch-fill></i>
          </div>
          <output data-telemetry-clutch-value>0%</output>
        </section>
        <section class="apex-technical-telemetry__wheels">
          ${WHEEL_IDS.map(wheelCard).join('')}
        </section>
      </section>
    `;
  }
}
