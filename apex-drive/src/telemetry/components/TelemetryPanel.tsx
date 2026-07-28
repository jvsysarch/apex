import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

interface PanelPosition {
  x: number;
  y: number;
}

interface PersistedPanelLayout extends PanelPosition {
  open: boolean;
}

export interface TelemetryPanelProps {
  id: string;
  title: string;
  children: ReactNode;
  defaultPosition: PanelPosition;
  defaultOpen?: boolean;
  width?: number;
}

const HEADER_VISIBLE_HEIGHT = 38;
let frontmostPanel = 10;

function storageKey(id: string): string {
  return `apex-run.v3.telemetry-panel.${id}`;
}

function readLayout(id: string, fallback: PersistedPanelLayout): PersistedPanelLayout {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(id)) ?? 'null') as Partial<PersistedPanelLayout> | null;
    if (
      typeof saved?.x === 'number'
      && typeof saved.y === 'number'
      && typeof saved.open === 'boolean'
    ) {
      return { x: saved.x, y: saved.y, open: saved.open };
    }
  } catch {
    // El layout vuelve a su posición inicial cuando storage no está disponible.
  }
  return fallback;
}

function saveLayout(id: string, layout: PersistedPanelLayout): void {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(layout));
  } catch {
    // El panel sigue funcionando aunque el navegador bloquee localStorage.
  }
}

function clampPosition(position: PanelPosition, width: number): PanelPosition {
  return {
    x: Math.min(Math.max(0, position.x), Math.max(0, window.innerWidth - width)),
    y: Math.min(Math.max(0, position.y), Math.max(0, window.innerHeight - HEADER_VISIBLE_HEIGHT)),
  };
}

export function TelemetryPanel({
  id,
  title,
  children,
  defaultPosition,
  defaultOpen = true,
  width = 326,
}: TelemetryPanelProps) {
  const initialLayout = useRef(readLayout(id, { ...defaultPosition, open: defaultOpen })).current;
  const [position, setPosition] = useState<PanelPosition>(() => clampPosition(initialLayout, width));
  const [open, setOpen] = useState(initialLayout.open);
  const [dragging, setDragging] = useState(false);
  const [zIndex, setZIndex] = useState(frontmostPanel);
  const panelRef = useRef<HTMLElement>(null);
  const positionRef = useRef(position);
  const suppressClick = useRef(false);
  const drag = useRef({
    active: false,
    moved: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  });

  const movePanel = (next: PanelPosition) => {
    const clamped = clampPosition(next, panelRef.current?.offsetWidth ?? width);
    positionRef.current = clamped;
    setPosition(clamped);
  };

  useEffect(() => {
    const keepInsideViewport = () => movePanel(positionRef.current);
    window.addEventListener('resize', keepInsideViewport);
    return () => window.removeEventListener('resize', keepInsideViewport);
  }, [width]);

  useEffect(() => {
    saveLayout(id, { ...positionRef.current, open });
  }, [id, open]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    frontmostPanel += 1;
    setZIndex(frontmostPanel);
    drag.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: positionRef.current.x,
      startTop: positionRef.current.y,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current.active || drag.current.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.current.startX;
    const dy = event.clientY - drag.current.startY;
    if (!drag.current.moved && Math.hypot(dx, dy) <= 3) return;
    drag.current.moved = true;
    movePanel({ x: drag.current.startLeft + dx, y: drag.current.startTop + dy });
  };

  const stopDragging = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current.active || drag.current.pointerId !== event.pointerId) return;
    const moved = drag.current.moved;
    drag.current.active = false;
    setDragging(false);
    if (moved) {
      suppressClick.current = true;
      saveLayout(id, { ...positionRef.current, open });
    }
  };

  const style = {
    '--panel-width': `${width}px`,
    left: position.x,
    top: position.y,
    zIndex,
  } as CSSProperties;

  return (
    <section
      ref={panelRef}
      className="telemetry-panel"
      data-open={open || undefined}
      data-dragging={dragging || undefined}
      style={style}
    >
      <button
        type="button"
        className="telemetry-panel-handle"
        aria-expanded={open}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          setOpen(current => !current);
        }}
      >
        <span className="telemetry-panel-caret" aria-hidden="true">{open ? '▼' : '▶'}</span>
        <span>{title}</span>
        <small>20 HZ</small>
      </button>
      {open && <div className="telemetry-panel-content">{children}</div>}
    </section>
  );
}
