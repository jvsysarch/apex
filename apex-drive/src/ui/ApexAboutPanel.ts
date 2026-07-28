export interface ApexAboutPanelOptions {
  readonly version: string;
  readonly repositoryUrl: string;
  readonly linkedinUrl: string;
}

export class ApexAboutPanel {
  private readonly root: HTMLElement;
  private readonly trigger: HTMLButtonElement;
  private readonly panel: HTMLElement;

  constructor(host: HTMLElement, options: ApexAboutPanelOptions) {
    this.root = document.createElement('aside');
    this.root.className = 'apex-about';
    this.root.setAttribute('aria-label', 'Acerca de APEX Drive');
    this.root.innerHTML = `
      <button
        class="apex-about__trigger"
        type="button"
        aria-controls="apex-about-panel"
        aria-expanded="false"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M12 10.5v6M12 7.2v.2"></path>
        </svg>
        <span>
          <strong>APEX DRIVE ${options.version}</strong>
          <small>PRE-ALPHA · ABOUT</small>
        </span>
      </button>
      <section
        id="apex-about-panel"
        class="apex-about__panel"
        role="dialog"
        aria-labelledby="apex-about-title"
        hidden
      >
        <header>
          <div>
            <small>APEX ECOSYSTEM · TECHNOLOGY PREVIEW</small>
            <h2 id="apex-about-title">APEX Drive ${options.version}</h2>
          </div>
          <button
            class="apex-about__close"
            type="button"
            aria-label="Cerrar información"
          >×</button>
        </header>

        <p class="apex-about__lead">
          Una demostración interactiva del ecosistema APEX: conducción,
          dinámica vehicular y rendering en tiempo real trabajando como un
          único sistema.
        </p>

        <dl class="apex-about__features">
          <div>
            <dt>APEX Physics</dt>
            <dd>
              Es el núcleo headless de dinámica vehicular. Jolt Physics
              resuelve cuerpos rígidos y colisiones; APEX añade el vehículo,
              su integración, superficies y estados de simulación.
            </dd>
          </div>
          <div>
            <dt>APEX TMeasy</dt>
            <dd>
              Esta demo usa el modelo de cubiertas APEX TMeasy para calcular
              fuerzas longitudinales y laterales según carga, deslizamiento y
              contacto con la pista.
            </dd>
          </div>
          <div>
            <dt>WebAssembly</dt>
            <dd>
              La física corre sobre una compilación WebAssembly mantenida por
              APEX, generada desde su integración nativa con Jolt y ejecutada
              localmente en el navegador.
            </dd>
          </div>
          <div>
            <dt>WebGPU</dt>
            <dd>
              La escena y la iluminación se renderizan con WebGPU. La GPU
              también participa en la deformación visual de las cubiertas para
              mantener fluida la presentación.
            </dd>
          </div>
        </dl>

        <p class="apex-about__note">
          APEX Physics es software original y usa Jolt Physics como dependencia
          independiente; no es un fork ni una modificación de Jolt.
        </p>

        <footer>
          <span>
            Diseñado y desarrollado por
            <strong>Jonathan Villaverde</strong>
          </span>
          <nav aria-label="Enlaces del proyecto">
            <a
              href="${options.repositoryUrl}"
              target="_blank"
              rel="noreferrer"
            >Apex Physics · GitHub ↗</a>
            <a
              href="${options.linkedinUrl}"
              target="_blank"
              rel="noreferrer"
            >LinkedIn ↗</a>
          </nav>
        </footer>
      </section>
    `;

    this.trigger = this.root.querySelector<HTMLButtonElement>(
      '.apex-about__trigger',
    )!;
    this.panel = this.root.querySelector<HTMLElement>('.apex-about__panel')!;
    const close = this.root.querySelector<HTMLButtonElement>(
      '.apex-about__close',
    )!;

    this.trigger.addEventListener('click', () => {
      this.setOpen(this.panel.hidden);
    });
    close.addEventListener('click', () => this.setOpen(false));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !this.panel.hidden) {
        this.setOpen(false);
        this.trigger.focus();
      }
    });
    document.addEventListener('pointerdown', event => {
      if (
        !this.panel.hidden
        && event.target instanceof Node
        && !this.root.contains(event.target)
      ) {
        this.setOpen(false);
      }
    });

    host.append(this.root);
  }

  private setOpen(open: boolean): void {
    this.panel.hidden = !open;
    this.trigger.setAttribute('aria-expanded', String(open));
    this.root.classList.toggle('apex-about--open', open);
  }
}
