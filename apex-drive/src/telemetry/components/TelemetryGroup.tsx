import { type ReactNode, useState } from 'react';

export interface TelemetryGroupProps {
  id: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

function readInitialState(id: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(`apex-run.v3.telemetry-group.${id}`);
    return value === null ? fallback : value === 'open';
  } catch {
    return fallback;
  }
}

export function TelemetryGroup({ id, title, children, defaultOpen = true }: TelemetryGroupProps) {
  const [open, setOpen] = useState(() => readInitialState(id, defaultOpen));

  const toggle = () => {
    setOpen(current => {
      const next = !current;
      try {
        localStorage.setItem(`apex-run.v3.telemetry-group.${id}`, next ? 'open' : 'closed');
      } catch {
        // Mantiene el estado en memoria si storage no está disponible.
      }
      return next;
    });
  };

  return (
    <section className="telemetry-group" data-group={id} data-open={open || undefined}>
      <button type="button" className="telemetry-group-heading" aria-expanded={open} onClick={toggle}>
        <span>{title}</span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="telemetry-group-content">{children}</div>}
    </section>
  );
}
