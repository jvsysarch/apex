import type { ApexCommandSender } from '@jvsysarch/apex-contracts';
import type { TelemetryHistory } from '../telemetry/core/TelemetryHistory';
import { OverviewWorkspace } from '../telemetry/workspaces/OverviewWorkspace';

export interface ApexWorkspaceProps {
  readonly history: TelemetryHistory;
  readonly runtimeStatus: string;
  readonly commands?: ApexCommandSender;
}

/** Único punto visual donde se componen lectura de telemetría y comandos. */
export function ApexWorkspace({ runtimeStatus }: ApexWorkspaceProps) {
  return (
    <main className="telemetry-workspace">
      <OverviewWorkspace runtimeStatus={runtimeStatus} />
      <div className="telemetry-controls" aria-label="Vehicle controls">
        <kbd>W</kbd><kbd>S</kbd><span>THROTTLE / BRAKE</span>
        <b>·</b>
        <kbd>A</kbd><kbd>D</kbd><span>STEER</span>
        <b>·</b>
        <kbd>SPACE</kbd><span>HANDBRAKE</span>
      </div>
    </main>
  );
}
