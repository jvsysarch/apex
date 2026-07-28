export const TELEMETRY_METRICS = {
  speedKmh: { label: 'Speed', unit: 'km/h', decimals: 0, scale: 1 },
  rpm: { label: 'Engine speed', unit: 'rpm', decimals: 0, scale: 1 },
  gear: { label: 'Gear', unit: undefined, decimals: 0, scale: 1 },
  throttle: { label: 'Throttle', unit: '%', decimals: 0, scale: 100 },
  brake: { label: 'Brake', unit: '%', decimals: 0, scale: 100 },
  physicsHz: { label: 'Physics', unit: 'Hz', decimals: 0, scale: 1 },
  grounded: { label: 'Grounded', unit: undefined, decimals: 0, scale: 1 },
  yawRate: { label: 'Yaw rate', unit: 'rad/s', decimals: 2, scale: 1 },
  slipRatio: { label: 'Slip ratio', unit: '%', decimals: 1, scale: 100 },
  slipAngle: { label: 'Slip angle', unit: '°', decimals: 1, scale: 1 },
  wheelLoad: { label: 'Wheel load', unit: 'N', decimals: 0, scale: 1 },
  suspensionLength: { label: 'Suspension', unit: 'm', decimals: 3, scale: 1 },
} as const;

export type MetricKey = keyof typeof TELEMETRY_METRICS;

export function formatMetric(key: MetricKey, value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const metric = TELEMETRY_METRICS[key];
  return (value * metric.scale).toFixed(metric.decimals);
}
