export interface ApexTrackSegmentOutlinerEntry {
  readonly id: string;
  readonly name: string;
  readonly pointCount: number;
  readonly enabled: boolean;
  readonly primary: boolean;
}

export interface ApexTrackSegmentOutlinerOptions {
  readonly segments: readonly ApexTrackSegmentOutlinerEntry[];
  readonly activeSegmentId: string;
  readonly onSelect: (segmentId: string) => void;
  readonly onEnabledChange: (segmentId: string, enabled: boolean) => void;
  readonly onCreate: () => void;
}

export interface ApexTrackSegmentOutliner {
  readonly root: HTMLElement;
  setActiveSegment(segmentId: string): void;
  setSegments(segments: readonly ApexTrackSegmentOutlinerEntry[]): void;
  setDrawing(active: boolean): void;
}

export const createApexTrackSegmentOutliner = (
  options: ApexTrackSegmentOutlinerOptions,
): ApexTrackSegmentOutliner => {
  const root = document.createElement('aside');
  root.className = 'track-segment-outliner';
  root.setAttribute('aria-label', 'Tramos de pista');

  const header = document.createElement('header');
  const title = document.createElement('strong');
  title.textContent = 'RED DE PISTA';
  const count = document.createElement('small');
  header.append(title, count);
  root.append(header);

  const list = document.createElement('div');
  list.className = 'track-segment-outliner__list';
  root.append(list);
  let activeSegmentId = options.activeSegmentId;
  let segments = [...options.segments];
  let drawing = false;

  const renderList = (): void => {
    list.replaceChildren();
    count.textContent = (
      `${segments.filter(segment => segment.enabled).length}/${segments.length}`
    );
    segments.forEach((segment, index) => {
      const row = document.createElement('div');
      row.className = 'track-segment-outliner__row';
      row.dataset.enabled = String(segment.enabled);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'track-segment-outliner__select';
      button.dataset.segmentId = segment.id;
      button.dataset.active = String(segment.id === activeSegmentId);
      button.disabled = drawing;
      const label = document.createElement('span');
      label.textContent = (
        `${String(index + 1).padStart(2, '0')} · ${segment.name}`
      );
      const detail = document.createElement('small');
      detail.textContent = (
        `${segment.pointCount} nodos · ${segment.enabled ? 'visible' : 'oculto'}`
      );
      button.append(label, detail);
      button.addEventListener('click', () => {
        if (segment.id !== activeSegmentId) options.onSelect(segment.id);
      });
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'track-segment-outliner__toggle';
      toggle.textContent = segment.enabled ? 'ON' : 'OFF';
      toggle.dataset.enabled = String(segment.enabled);
      toggle.setAttribute('aria-pressed', String(segment.enabled));
      toggle.setAttribute(
        'aria-label',
        `${segment.enabled ? 'Desactivar' : 'Activar'} ${segment.name}`,
      );
      toggle.title = segment.primary
        ? 'El tramo primario permanece activo mientras define la ruta y salida'
        : segment.enabled
          ? 'Desactivar tramo sin borrarlo'
          : 'Volver a incluir el tramo en render y física';
      toggle.disabled = drawing || segment.primary;
      toggle.addEventListener('click', () => {
        options.onEnabledChange(segment.id, !segment.enabled);
      });
      row.append(button, toggle);
      list.append(row);
    });
  };

  const create = document.createElement('button');
  create.type = 'button';
  create.className = 'track-segment-outliner__create';
  create.textContent = '+ Nuevo tramo';
  create.title = 'Dibujar un tramo nuevo con la cámara libre';
  create.addEventListener('click', options.onCreate);
  root.append(create);

  const hint = document.createElement('p');
  hint.textContent = (
    'Cada tramo conserva geometría, superficie y colisión propias.'
  );
  root.append(hint);
  document.body.append(root);
  renderList();
  return Object.freeze({
    root,
    setActiveSegment: (segmentId: string) => {
      activeSegmentId = segmentId;
      renderList();
    },
    setSegments: (nextSegments: readonly ApexTrackSegmentOutlinerEntry[]) => {
      segments = [...nextSegments];
      renderList();
    },
    setDrawing: (active: boolean) => {
      drawing = active;
      root.dataset.drawing = String(active);
      create.disabled = active;
      renderList();
      hint.textContent = active
        ? 'Dibujando un tramo nuevo · terminalo o cancelalo para continuar.'
        : 'Cada tramo conserva geometría, superficie y colisión propias.';
    },
  });
};
