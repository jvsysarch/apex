export interface ApexAboutPanelOptions {
  readonly version: string;
  readonly repositoryUrl: string;
  readonly linkedinUrl: string;
  readonly documentationUrl: string;
  readonly showcaseUrl: string;
}

type ApexAboutLanguage = 'es' | 'en';

const ABOUT_LANGUAGE_STORAGE_KEY = 'apex-drive.about-language.v1';

const initialAboutLanguage = (): ApexAboutLanguage => {
  try {
    const stored = localStorage.getItem(ABOUT_LANGUAGE_STORAGE_KEY);
    if (stored === 'es' || stored === 'en') return stored;
  } catch {
    // Storage may be unavailable in a restricted browser context.
  }
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
};

export class ApexAboutPanel {
  private readonly root: HTMLElement;
  private readonly trigger: HTMLButtonElement;
  private readonly panel: HTMLDialogElement;

  constructor(host: HTMLElement, options: ApexAboutPanelOptions) {
    this.root = document.createElement('aside');
    this.root.className = 'apex-about';
    this.root.setAttribute('aria-label', 'About APEX Drive / Acerca de APEX Drive');
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
      <dialog
        id="apex-about-panel"
        class="apex-about__panel"
        aria-labelledby="apex-about-title"
      >
        <header>
          <div>
            <small>APEX ECOSYSTEM · TECHNOLOGY PREVIEW</small>
            <h2 id="apex-about-title">APEX Drive ${options.version}</h2>
          </div>
          <div class="apex-about__header-actions">
            <div class="apex-about__languages" aria-label="Idioma / Language">
              <button type="button" data-about-language="es">ES</button>
              <button type="button" data-about-language="en">EN</button>
            </div>
            <button
              class="apex-about__close"
              type="button"
              aria-label="Cerrar / Close"
            >×</button>
          </div>
        </header>

        <div class="apex-about__copy" data-about-copy="es" lang="es">
          <p class="apex-about__lead">
            Una demostración interactiva del ecosistema APEX: conducción,
            dinámica vehicular y renderizado en tiempo real trabajando como un
            único sistema.
          </p>

          <div class="apex-about__authorship" aria-label="Autoría">
            <small>INVESTIGACIÓN INDEPENDIENTE</small>
            <p>
              <span>Autor</span>
              <a
                href="${options.linkedinUrl}"
                target="_blank"
                rel="noreferrer"
              >Jonathan Villaverde ↗</a>
            </p>
            <nav aria-label="Proyecto y documentación">
              <a
                href="${options.repositoryUrl}"
                target="_blank"
                rel="noreferrer"
              >GitHub Repo ↗</a>
              <a
                href="${options.documentationUrl}"
                target="_blank"
                rel="noreferrer"
              >Documentación ↗</a>
              <a
                href="${options.showcaseUrl}"
                target="_blank"
                rel="noreferrer"
              >Showcase ↗</a>
            </nav>
          </div>

          <dl class="apex-about__features">
            <div>
              <dt>APEX Physics</dt>
              <dd>
                Es el núcleo headless de dinámica vehicular. Jolt Physics
                resuelve cuerpos rígidos y colisiones; APEX añade la simulación
                del vehículo, su integración, superficies y estados numéricos.
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
                también participa en la deformación visual de las cubiertas
                para mantener fluida la presentación.
              </dd>
            </div>
          </dl>

          <p class="apex-about__note">
            APEX Physics es software original y usa Jolt Physics como
            dependencia independiente; no es un fork ni una modificación de
            Jolt.
          </p>
        </div>

        <div class="apex-about__copy" data-about-copy="en" lang="en">
          <p class="apex-about__lead">
            An interactive demonstration of the APEX ecosystem: driving,
            vehicle dynamics and real-time rendering working together as a
            single system.
          </p>

          <div class="apex-about__authorship" aria-label="Authorship">
            <small>INDEPENDENT RESEARCH</small>
            <p>
              <span>Author</span>
              <a
                href="${options.linkedinUrl}"
                target="_blank"
                rel="noreferrer"
              >Jonathan Villaverde ↗</a>
            </p>
            <nav aria-label="Project and documentation">
              <a
                href="${options.repositoryUrl}"
                target="_blank"
                rel="noreferrer"
              >GitHub Repo ↗</a>
              <a
                href="${options.documentationUrl}"
                target="_blank"
                rel="noreferrer"
              >Documentation ↗</a>
              <a
                href="${options.showcaseUrl}"
                target="_blank"
                rel="noreferrer"
              >Showcase ↗</a>
            </nav>
          </div>

          <dl class="apex-about__features">
            <div>
              <dt>APEX Physics</dt>
              <dd>
                The headless vehicle-dynamics core. Jolt Physics resolves rigid
                bodies and collisions; APEX adds vehicle simulation,
                integration, surfaces and numeric state snapshots.
              </dd>
            </div>
            <div>
              <dt>APEX TMeasy</dt>
              <dd>
                This demo uses the APEX TMeasy tire model to calculate
                longitudinal and lateral forces from load, slip and track
                contact.
              </dd>
            </div>
            <div>
              <dt>WebAssembly</dt>
              <dd>
                Physics runs on an APEX-maintained WebAssembly build generated
                from its native Jolt integration and executed locally in the
                browser.
              </dd>
            </div>
            <div>
              <dt>WebGPU</dt>
              <dd>
                The scene and lighting are rendered with WebGPU. The GPU also
                handles visual tire deformation to keep the presentation
                responsive.
              </dd>
            </div>
          </dl>

          <p class="apex-about__note">
            APEX Physics is original software that uses Jolt Physics as an
            independent dependency; it is not a fork or modification of Jolt.
          </p>
        </div>
      </dialog>
    `;
    const socialLinks = document.createElement('nav');
    socialLinks.className = 'apex-about__social-links';
    socialLinks.setAttribute('aria-label', 'Enlaces de Jonathan Villaverde');
    socialLinks.innerHTML = `
      <a
        href="${options.repositoryUrl}"
        target="_blank"
        rel="noreferrer"
      >GitHub Repo ↗</a>
      <a
        href="${options.linkedinUrl}"
        target="_blank"
        rel="noreferrer"
      >LinkedIn ↗</a>
    `;

    this.trigger = this.root.querySelector<HTMLButtonElement>(
      '.apex-about__trigger',
    )!;
    this.panel = this.root.querySelector<HTMLDialogElement>(
      '.apex-about__panel',
    )!;
    const close = this.root.querySelector<HTMLButtonElement>(
      '.apex-about__close',
    )!;
    const languageButtons = Array.from(
      this.root.querySelectorAll<HTMLButtonElement>('[data-about-language]'),
    );
    const copies = Array.from(
      this.root.querySelectorAll<HTMLElement>('[data-about-copy]'),
    );
    const setLanguage = (language: ApexAboutLanguage) => {
      copies.forEach(copy => {
        copy.hidden = copy.dataset.aboutCopy !== language;
      });
      languageButtons.forEach(button => {
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.aboutLanguage === language),
        );
      });
      this.panel.lang = language;
      this.root.dataset.aboutLanguage = language;
      try {
        localStorage.setItem(ABOUT_LANGUAGE_STORAGE_KEY, language);
      } catch {
        // The language still changes even when persistence is unavailable.
      }
    };

    languageButtons.forEach(button => {
      button.addEventListener('click', () => {
        const language = button.dataset.aboutLanguage;
        if (language === 'es' || language === 'en') setLanguage(language);
      });
    });
    setLanguage(initialAboutLanguage());

    this.trigger.addEventListener('click', () => {
      this.setOpen(!this.panel.open);
    });
    close.addEventListener('click', () => this.setOpen(false));
    this.panel.addEventListener('cancel', event => {
      event.preventDefault();
      this.setOpen(false);
      this.trigger.focus();
    });
    this.panel.addEventListener('pointerdown', event => {
      const bounds = this.panel.getBoundingClientRect();
      if (
        event.clientX < bounds.left
        || event.clientX > bounds.right
        || event.clientY < bounds.top
        || event.clientY > bounds.bottom
      ) {
        this.setOpen(false);
      }
    });
    host.append(this.root, socialLinks);
  }

  private setOpen(open: boolean): void {
    if (open && !this.panel.open) {
      this.panel.showModal();
    } else if (!open && this.panel.open) {
      this.panel.close();
    }
    this.trigger.setAttribute('aria-expanded', String(open));
    this.root.classList.toggle('apex-about--open', open);
  }
}
