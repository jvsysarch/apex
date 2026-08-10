/**
 * The identity surface itself. Its entry point lives in the Ether toolbar,
 * alongside the track and settings controls.
 */
export class ApexVoidProfileGate {
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly status: HTMLElement;
  private readonly provider: HTMLElement;
  private readonly dismiss: HTMLButtonElement;

  constructor(parent: HTMLElement = document.body) {
    this.root = document.createElement('aside');
    this.root.className = 'apex-void-profile-gate';
    this.root.dataset.state = 'required';
    this.root.setAttribute('aria-label', 'Perfil de Time Trial');
    this.root.innerHTML = `
      <section class="apex-void-profile-gate__panel" hidden aria-label="Iniciar sesion para Time Trial">
        <div class="apex-void-profile-gate__identity">
          <span>TIME TRIAL</span>
          <h2>Guarda tus tiempos</h2>
        </div>
        <p class="apex-void-profile-gate__status">Inicia sesion con Google para guardar tu historial personal y tus mejores vueltas.</p>
        <div class="apex-void-profile-gate__provider"></div>
        <button class="apex-void-profile-gate__skip" type="button">Continuar sin iniciar sesión</button>
      </section>
    `;
    parent.append(this.root);
    this.panel = this.root.querySelector<HTMLElement>('.apex-void-profile-gate__panel')!;
    this.status = this.root.querySelector<HTMLElement>('.apex-void-profile-gate__status')!;
    this.provider = this.root.querySelector<HTMLElement>('.apex-void-profile-gate__provider')!;
    this.dismiss = this.root.querySelector<HTMLButtonElement>('.apex-void-profile-gate__skip')!;
    this.dismiss.addEventListener('click', () => this.closePanel());
  }

  identityHost(): HTMLElement {
    return this.provider;
  }

  open(callback: () => void): void {
    this.dismiss.hidden = false;
    this.panel.hidden = false;
    callback();
  }

  setStatus(message: string, state: 'required' | 'authenticated' | 'error' = 'required'): void {
    this.status.textContent = message;
    this.root.dataset.state = state;
  }

  closePanel(): void {
    this.panel.hidden = true;
  }

  markAuthenticated(): void {
    this.root.dataset.state = 'authenticated';
    this.dismiss.hidden = true;
  }
}
