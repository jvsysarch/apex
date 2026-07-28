import { type ReactNode, useMemo } from 'react';
import { TimeSeriesChart, type TimeSeriesLine } from '../components/TimeSeriesChart';
import { TelemetryPanel } from '../components/TelemetryPanel';
import type { TelemetryHistory, WheelSeriesSet } from '../core/TelemetryHistory';
import { useTelemetryFrame } from '../core/TelemetryProvider';

export interface TiresWorkspaceProps {
  readonly history: TelemetryHistory;
  readonly toolbar?: ReactNode;
}

const WHEEL_COLORS = {
  FL: '#55d8e8',
  FR: '#e9ca72',
  RL: '#b47cf1',
  RR: '#ff7f8f',
} as const;

function chartLines(series: WheelSeriesSet): readonly TimeSeriesLine[] {
  return (['FL', 'FR', 'RL', 'RR'] as const).map(id => ({
    label: id,
    color: WHEEL_COLORS[id],
    values: series[id],
  }));
}

export function TiresWorkspace({ history, toolbar }: TiresWorkspaceProps) {
  const frame = useTelemetryFrame();
  const slipRatioLines = useMemo(() => chartLines(history.slipRatio), [history]);
  const slipAngleLines = useMemo(() => chartLines(history.slipAngle), [history]);
  const loadLines = useMemo(() => chartLines(history.wheelLoad), [history]);
  const initialPosition = { x: 16, y: 16 };
  const revision = frame?.timestamp ?? 0;

  return (
    <TelemetryPanel id="tires" title="◉ TIRES · LIVE" defaultPosition={initialPosition} width={470}>
      {toolbar}
      <div className="tire-chart-stack">
        <div className="tire-energy-grid" aria-label="Tire energy dissipation">
          {frame?.wheels.map(wheel => {
            const totalPowerKw = (
              wheel.longitudinalPowerLossW + wheel.lateralPowerLossW
            ) / 1000;
            const totalEnergyKj = (
              wheel.longitudinalEnergyLossJ + wheel.lateralEnergyLossJ
            ) / 1000;
            return (
              <div key={wheel.id} className="tire-energy-card">
                <strong>{wheel.id}</strong>
                <span>{totalPowerKw.toFixed(2)} kW</span>
                <small>
                  LAT {(wheel.lateralPowerLossW / 1000).toFixed(2)}
                  {' · LONG '}
                  {(wheel.longitudinalPowerLossW / 1000).toFixed(2)}
                </small>
                <output>{totalEnergyKj.toFixed(1)} kJ</output>
              </div>
            );
          })}
        </div>
        <TimeSeriesChart title="SLIP RATIO" unit="ratio" lines={slipRatioLines} revision={revision} min={-0.5} max={0.5} decimals={3} />
        <TimeSeriesChart title="SLIP ANGLE" unit="degrees" lines={slipAngleLines} revision={revision} min={-20} max={20} decimals={1} />
        <TimeSeriesChart title="WHEEL LOAD" unit="newtons" lines={loadLines} revision={revision} min={0} max={8000} decimals={0} />
      </div>
    </TelemetryPanel>
  );
}
