import type { ReactNode } from 'react';

export interface MetricGridProps {
  children: ReactNode;
  compact?: boolean;
}

export function MetricGrid({ children, compact = false }: MetricGridProps) {
  return <div className="metric-grid" data-compact={compact || undefined}>{children}</div>;
}
