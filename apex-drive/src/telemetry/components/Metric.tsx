export interface MetricProps {
  label: string;
  value: number | string;
  unit?: string;
  status?: 'normal' | 'warning' | 'critical';
}

export function Metric({ label, value, unit, status = 'normal' }: MetricProps) {
  return (
    <div className="metric" data-status={status}>
      <span className="metric-label">{label}</span>
      <span className="metric-reading">
        <strong>{value}</strong>
        {unit && <small>{unit}</small>}
      </span>
    </div>
  );
}
