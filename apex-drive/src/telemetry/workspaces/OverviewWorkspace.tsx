import { Metric } from '../components/Metric';
import { MetricGrid } from '../components/MetricGrid';
import { TelemetryGroup } from '../components/TelemetryGroup';
import { TelemetryPanel } from '../components/TelemetryPanel';
import { useTelemetryFrame } from '../core/TelemetryProvider';
import { formatMetric, TELEMETRY_METRICS } from '../metrics/metricCatalog';

export interface OverviewWorkspaceProps {
  runtimeStatus: string;
}

const gearLabel = (gear: number | undefined) => {
  if (gear === undefined) return '—';
  if (gear < 0) return 'R';
  if (gear === 0) return 'N';
  return String(gear);
};

export function OverviewWorkspace({ runtimeStatus }: OverviewWorkspaceProps) {
  const frame = useTelemetryFrame();
  const vehicle = frame?.vehicle;
  const drivetrain = frame?.drivetrain;
  const initialPanelPosition = {
    x: Math.max(12, window.innerWidth - 342),
    y: 16,
  };

  return (
    <>
      <TelemetryPanel
        id="overview"
        title="◉ TELEMETRY · OVERVIEW"
        defaultPosition={initialPanelPosition}
      >
        <TelemetryGroup id="overview-primary" title="VEHICLE / DRIVETRAIN">
          <MetricGrid compact>
            <Metric label={TELEMETRY_METRICS.speedKmh.label} value={formatMetric('speedKmh', vehicle?.speedKmh)} unit={TELEMETRY_METRICS.speedKmh.unit} />
            <Metric label={TELEMETRY_METRICS.rpm.label} value={formatMetric('rpm', drivetrain?.rpm)} unit={TELEMETRY_METRICS.rpm.unit} />
            <Metric label={TELEMETRY_METRICS.gear.label} value={gearLabel(drivetrain?.gear)} />
            <Metric label={TELEMETRY_METRICS.physicsHz.label} value={formatMetric('physicsHz', vehicle?.physicsHz)} unit={TELEMETRY_METRICS.physicsHz.unit} />
            <Metric label="Tire model" value={vehicle?.tireModel ?? '—'} />
            <Metric
              label="Tire contacts"
              value={vehicle?.configuredTireContactCount ?? '—'}
            />
            <Metric
              label="Compound"
              value={vehicle?.tireOperatingParameters.compound ?? '—'}
            />
            <Metric
              label="Pressure"
              value={vehicle
                ? vehicle.tireOperatingParameters.pressurePsi.toFixed(1)
                : '—'}
              unit="psi"
            />
            <Metric
              label="Tire temp"
              value={vehicle
                ? vehicle.tireOperatingParameters.temperatureC.toFixed(0)
                : '—'}
              unit="°C"
            />
            <Metric
              label="Grip scale"
              value={vehicle ? vehicle.tireOperatingGripScale.toFixed(3) : '—'}
              unit="×"
            />
          </MetricGrid>
        </TelemetryGroup>

        <TelemetryGroup id="overview-input" title="DRIVER INPUT">
          <MetricGrid compact>
            <Metric label={TELEMETRY_METRICS.throttle.label} value={formatMetric('throttle', drivetrain?.throttle)} unit={TELEMETRY_METRICS.throttle.unit} />
            <Metric label={TELEMETRY_METRICS.brake.label} value={formatMetric('brake', drivetrain?.brake)} unit={TELEMETRY_METRICS.brake.unit} status={(drivetrain?.brake ?? 0) > 0 ? 'warning' : 'normal'} />
          </MetricGrid>
        </TelemetryGroup>

        <TelemetryGroup id="overview-contact" title="WHEEL CONTACT">
          <MetricGrid compact>
            {(['FL', 'FR', 'RL', 'RR'] as const).map(id => {
              const grounded = frame?.wheels.find(wheel => wheel.id === id)?.grounded;
              return (
                <Metric
                  key={id}
                  label={id}
                  value={grounded === undefined ? '—' : grounded ? 'ON' : 'AIR'}
                  status={grounded === false ? 'warning' : 'normal'}
                />
              );
            })}
          </MetricGrid>
        </TelemetryGroup>

        <div className="telemetry-runtime">
          <i aria-hidden="true" />
          <span>{runtimeStatus}</span>
        </div>
      </TelemetryPanel>

    </>
  );
}
