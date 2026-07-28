const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Velocímetro de v2 con DOM persistente. El SVG se crea una vez; update()
 * sólo muta atributos y textos para no provocar layout/GC en cada frame.
 */
export class RacingHudSvg {
  private readonly speedText: SVGTextElement;
  private readonly gearText: SVGTextElement;
  private readonly needle: SVGGElement;
  private readonly activeGlow: SVGPathElement;
  private readonly activeCore: SVGPathElement;
  private readonly throttleFill: SVGRectElement;
  private readonly brakeFill: SVGRectElement;
  private previousSpeed = -1;
  private previousGear = '';

  constructor(private readonly root: HTMLElement) {
    this.root.innerHTML = this.markup();
    this.speedText = this.required('hud-speed');
    this.gearText = this.required('hud-gear');
    this.needle = this.required('hud-needle');
    this.activeGlow = this.required('hud-active-glow');
    this.activeCore = this.required('hud-active-core');
    this.throttleFill = this.required('hud-throttle');
    this.brakeFill = this.required('hud-brake');
  }

  update(rpm: number, speed: number, gear: string, throttle: number, brake: number): void {
    const roundedSpeed = Math.round(speed);
    if (roundedSpeed !== this.previousSpeed) {
      this.speedText.textContent = String(roundedSpeed);
      this.previousSpeed = roundedSpeed;
    }
    if (gear !== this.previousGear) {
      this.gearText.textContent = gear;
      this.previousGear = gear;
    }
    const rpmFraction = clamp01(rpm / 8500);
    const rpmAngle = 225 + rpmFraction * 270;
    this.needle.setAttribute('transform', `rotate(${rpmAngle.toFixed(2)} 250 255)`);
    const activeArc = this.arc(250, 255, 180, 225, Math.min(rpmFraction, 7000 / 8500) * 270);
    this.activeGlow.setAttribute('d', activeArc);
    this.activeCore.setAttribute('d', activeArc);
    this.activeGlow.setAttribute('stroke-width', (12 + rpmFraction * 12).toFixed(2));
    this.updatePedal(this.throttleFill, throttle);
    this.updatePedal(this.brakeFill, brake);
  }

  private required<T extends Element>(id: string): T {
    const element = this.root.querySelector<T>(`#${id}`);
    if (!element) throw new Error(`Falta el nodo persistente ${id} del velocímetro`);
    return element;
  }

  private updatePedal(element: SVGRectElement, rawValue: number): void {
    const value = clamp01(rawValue);
    const height = 64 * value;
    element.setAttribute('y', (416 - height).toFixed(2));
    element.setAttribute('height', height.toFixed(2));
    element.setAttribute('opacity', (0.3 + value * 0.7).toFixed(2));
  }

  private polar(cx: number, cy: number, radius: number, angle: number) {
    const radians = (angle - 90) * Math.PI / 180;
    return {
      x: cx + radius * Math.cos(radians),
      y: cy + radius * Math.sin(radians),
    };
  }

  private arc(cx: number, cy: number, radius: number, start: number, sweep: number): string {
    const safeSweep = Math.max(0.001, sweep);
    const from = this.polar(cx, cy, radius, start);
    const to = this.polar(cx, cy, radius, start + safeSweep);
    return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${radius} ${radius} 0 ${safeSweep > 180 ? 1 : 0} 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
  }

  private markup(): string {
    const majorTicks = Array.from({ length: 9 }, (_, index) => {
      const angle = 225 + index / 8 * 270;
      const outer = this.polar(250, 255, 174, angle);
      const inner = this.polar(250, 255, 162, angle);
      const label = this.polar(250, 255, 140, angle);
      const color = index >= 7 ? '#ff9aab' : 'rgba(255,255,255,.82)';
      return `<line x1="${outer.x}" y1="${outer.y}" x2="${inner.x}" y2="${inner.y}" stroke="${color}" stroke-width="2.5"/><text x="${label.x}" y="${label.y + 9}" text-anchor="middle" font-family="Orbitron,monospace" font-size="28" font-weight="600" fill="${color}">${index}</text>`;
    }).join('');
    const minorTicks = Array.from({ length: 40 }, (_, index) => index)
      .filter(index => index % 5 !== 0)
      .map(index => {
        const angle = 225 + index / 40 * 270;
        const outer = this.polar(250, 255, 172, angle);
        const inner = this.polar(250, 255, 166, angle);
        return `<line x1="${outer.x}" y1="${outer.y}" x2="${inner.x}" y2="${inner.y}" stroke="rgba(255,255,255,.25)"/>`;
      }).join('');
    const pedal = (x: number, id: string, label: string, color: string) => (
      `<g><rect x="${x}" y="348" width="12" height="70" rx="6" fill="rgba(255,255,255,.055)" stroke="rgba(255,255,255,.18)"/><rect id="${id}" x="${x + 2}" y="416" width="8" height="0" rx="4" fill="${color}" filter="url(#hud-glow)"/><text x="${x + 6}" y="438" text-anchor="middle" font-family="Rajdhani,sans-serif" font-size="11" font-weight="700" fill="${color}">${label}</text></g>`
    );
    return `<svg viewBox="0 0 500 500" role="img" aria-label="Tacómetro y velocímetro deportivo">
      <defs>
        <filter id="hud-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="hud-strong-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="hud-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#142235" stop-opacity=".34"/><stop offset=".72" stop-color="#050a10" stop-opacity=".08"/><stop offset="1" stop-color="#05080c" stop-opacity="0"/></linearGradient>
        <linearGradient id="hud-rpm-flow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#fff"/><stop offset="1" stop-color="#ff163f"/></linearGradient>
      </defs>
      <circle cx="250" cy="255" r="198" fill="url(#hud-face)" stroke="rgba(255,255,255,.22)" stroke-width="1.5"/>
      <path d="${this.arc(250, 255, 180, 225, 270)}" fill="none" stroke="rgba(255,255,255,.055)" stroke-width="12"/>
      <path id="hud-active-glow" d="${this.arc(250, 255, 180, 225, .001)}" fill="none" stroke="url(#hud-rpm-flow)" stroke-width="12" opacity=".42" filter="url(#hud-strong-glow)"/>
      <path id="hud-active-core" d="${this.arc(250, 255, 180, 225, .001)}" fill="none" stroke="url(#hud-rpm-flow)" stroke-width="3" opacity=".95"/>
      ${minorTicks}${majorTicks}
      <text x="250" y="162" text-anchor="middle" font-family="Rajdhani,sans-serif" font-size="14" letter-spacing="2" fill="rgba(255,255,255,.52)">RPM x1000</text>
      <g id="hud-needle" transform="rotate(225 250 255)"><line x1="250" y1="255" x2="250" y2="86" stroke="#00e5ff" stroke-width="2" opacity=".75"/><polygon points="250,75 243,257 257,257" fill="#e0f8ff" filter="url(#hud-strong-glow)"/></g>
      <circle cx="250" cy="255" r="20" fill="#0a1520" stroke="#00b4ff" stroke-width="2"/><circle cx="250" cy="255" r="5" fill="#00cfff" filter="url(#hud-glow)"/>
      <text id="hud-gear" x="250" y="320" text-anchor="middle" font-family="Orbitron,monospace" font-size="36" font-weight="900" fill="#fff" filter="url(#hud-glow)">N</text>
      <text id="hud-speed" x="250" y="410" text-anchor="middle" font-family="Orbitron,monospace" font-size="79" font-weight="700" fill="#fff" filter="url(#hud-glow)">0</text>
      <text x="250" y="438" text-anchor="middle" font-family="Rajdhani,sans-serif" font-size="13" letter-spacing="4" fill="rgba(255,255,255,.55)">km/h</text>
      ${pedal(406, 'hud-throttle', 'THR', '#dffaff')}${pedal(442, 'hud-brake', 'BRK', '#ff6171')}
    </svg>`;
  }
}
