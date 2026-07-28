import type { VehiclePose } from '../rendering/ApexVehiclePoseAdapter';
import type { RacingLinePoint } from '../race/ApexRacingLineLearner';
import type { ApexSegmentTimingSnapshot } from '../race/ApexSegmentTimer';
import type { ApexAutonomousTelemetry } from '../vehicle/ApexAutonomousDriver';

export interface ApexAutonomousPanelFrame {
  readonly enabled: boolean;
  readonly manualCorrection: boolean;
  readonly manualOverrideChannels: readonly string[];
  readonly telemetry: ApexAutonomousTelemetry;
  readonly segmentTiming: ApexSegmentTimingSnapshot;
  readonly pose: VehiclePose;
  readonly trackCenterLine: readonly RacingLinePoint[];
  readonly line: readonly RacingLinePoint[];
  readonly trackWidthM: number;
  readonly learningLapNumber: number;
  readonly lapElapsedMs: number;
  readonly lapSource: 'race' | 'free';
  readonly ghostReady: boolean;
}

const formatLapTime = (milliseconds: number | undefined): string => {
  if (!Number.isFinite(milliseconds) || milliseconds! <= 0) return '--:--.---';
  const minutes = Math.floor(milliseconds! / 60_000);
  const seconds = Math.floor(milliseconds! % 60_000 / 1000);
  const millis = Math.floor(milliseconds! % 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${
    millis.toString().padStart(3, '0')
  }`;
};

const formatSegmentTime = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const millis = Math.floor(milliseconds % 1000);
  return `${seconds}.${millis.toString().padStart(3, '0')}`;
};

const output = (id: string) => (
  document.querySelector<HTMLOutputElement>(`#${id}`)!
);

export class ApexAutonomousPanel {
  private readonly state = document.querySelector<HTMLElement>(
    '#autonomous-panel-state',
  )!;
  private readonly canvas = document.querySelector<HTMLCanvasElement>(
    '#autonomous-vision',
  )!;
  private readonly context = this.canvas.getContext('2d')!;
  private visionLateralRangeM = 32;
  private readonly mode = output('ai-mode');
  private readonly lap = output('ai-lap');
  private readonly progress = output('ai-progress');
  private readonly power = output('ai-power');
  private readonly nextPower = output('ai-next-power');
  private readonly speed = output('ai-speed');
  private readonly targetSpeed = output('ai-target-speed');
  private readonly speedLimit = output('ai-speed-limit');
  private readonly cornerPhase = output('ai-corner-phase');
  private readonly brakePreview = output('ai-brake-preview');
  private readonly attackOffset = output('ai-attack-offset');
  private readonly zone = output('ai-zone');
  private readonly zoneClass = output('ai-zone-class');
  private readonly zoneMinimum = output('ai-zone-minimum');
  private readonly zoneMaximum = output('ai-zone-maximum');
  private readonly driverSpeed = output('ai-driver-speed');
  private readonly nextTrial = output('ai-next-trial');
  private readonly improvementPotential = output('ai-improvement-potential');
  private readonly coverage = output('ai-coverage');
  private readonly crossTrack = output('ai-cross-track');
  private readonly racingLineError = output('ai-racing-line-error');
  private readonly headingError = output('ai-heading-error');
  private readonly lookAhead = output('ai-look-ahead');
  private readonly steeringLimit = output('ai-steering-limit');
  private readonly longSlip = output('ai-long-slip');
  private readonly lateralSlip = output('ai-lateral-slip');
  private readonly groundedWheels = output('ai-grounded-wheels');
  private readonly cleanPasses = output('ai-clean-passes');
  private readonly zoneIncidents = output('ai-zone-incidents');
  private readonly totalIncidents = output('ai-total-incidents');
  private readonly lineOffset = output('ai-line-offset');
  private readonly fastZones = output('ai-fast-zones');
  private readonly brakingZones = output('ai-braking-zones');
  private readonly caution = output('ai-caution');
  private readonly bestZoneSpeed = output('ai-best-zone-speed');
  private readonly currentLap = output('ai-current-lap');
  private readonly bestLap = output('ai-best-lap');
  private readonly ghost = output('ai-ghost');
  private readonly learningStatus = output('ai-learning-status');
  private readonly segmentRows = Array.from({ length: 10 }, (_, index) => ({
    row: document.querySelector<HTMLElement>(`#ai-segment-row-${index}`)!,
    current: output(`ai-segment-current-${index}`),
    best: output(`ai-segment-best-${index}`),
    delta: output(`ai-segment-delta-${index}`),
  }));
  private readonly throttleBar = document.querySelector<HTMLElement>(
    '#ai-throttle-bar',
  )!;
  private readonly brakeBar = document.querySelector<HTMLElement>(
    '#ai-brake-bar',
  )!;
  private readonly steeringBar = document.querySelector<HTMLElement>(
    '#ai-steering-bar',
  )!;

  update(frame: ApexAutonomousPanelFrame): void {
    const ai = frame.telemetry;
    this.state.textContent = !frame.enabled
      ? 'STANDBY'
      : frame.manualCorrection
        ? `MANUAL OVERRIDE ${frame.manualOverrideChannels.join('+')}`
        : 'AUTONOMOUS ASSIST';
    this.mode.textContent = ai.mode;
    this.lap.textContent = String(frame.learningLapNumber);
    this.progress.textContent = `${Math.round(ai.trackProgress * 100)}%`;
    this.power.textContent = `${Math.round(ai.powerLimit * 100)}%`;
    this.nextPower.textContent = `${Math.round(ai.nextLapPowerLimit * 100)}%`;
    this.speed.textContent = `${frame.pose.speedKmh.toFixed(0)} km/h`;
    this.targetSpeed.textContent = `${ai.targetSpeedKmh.toFixed(0)} km/h`;
    this.speedLimit.textContent = `${ai.learnedSpeedLimitKmh.toFixed(0)} km/h`;
    const cornerPhaseLabels = {
      straight: 'RECTA',
      braking: 'FRENADA',
      'turn-in': 'ENTRADA',
      apex: 'VÉRTICE',
      exit: 'SALIDA',
    } as const;
    this.cornerPhase.textContent = cornerPhaseLabels[ai.cornerPhase];
    this.brakePreview.textContent = ai.previewBrakeDistanceM === undefined
      ? '--'
      : `${ai.previewBrakeDistanceM.toFixed(0)} m`;
    this.attackOffset.textContent = `${
      ai.attackLineOffsetM >= 0 ? '+' : ''
    }${ai.attackLineOffsetM.toFixed(2)} m`;
    this.zone.textContent = `${ai.zoneIndex + 1} / ${ai.zoneCount}`;
    const zoneClassLabels = {
      learning: 'APRENDIENDO',
      recovery: 'RECUPERACIÓN',
      probing: 'SONDEANDO',
      validated: 'VALIDADA',
      optimal: 'ÓPTIMA',
      fast: 'RÁPIDA',
    } as const;
    this.zoneClass.textContent = zoneClassLabels[ai.zoneClassification];
    this.zoneMinimum.textContent = ai.minimumCleanSpeedKmh > 0
      ? `${ai.minimumCleanSpeedKmh.toFixed(0)} km/h`
      : '--';
    this.zoneMaximum.textContent = ai.bestCleanSpeedKmh > 0
      ? `${ai.bestCleanSpeedKmh.toFixed(0)} km/h`
      : '--';
    this.driverSpeed.textContent = ai.driverValidatedSpeedKmh > 0
      ? `${ai.driverValidatedSpeedKmh.toFixed(0)} km/h · ${
          ai.driverValidationCount
        }x`
      : frame.manualCorrection ? 'APRENDIENDO' : '--';
    this.nextTrial.textContent = `${ai.nextTrialSpeedKmh.toFixed(0)} km/h`;
    this.improvementPotential.textContent = ai.optimizationLocked
      ? 'ÓPTIMO · BLOQUEADO'
      : ai.improvementPotentialKmh > 0.05
      ? `+${ai.improvementPotentialKmh.toFixed(1)} km/h · -${
          (ai.estimatedZoneGainMs / 1000).toFixed(2)
        } s`
      : `CONVERGENCIA ${ai.stagnantPasses} / 5`;
    this.coverage.textContent = `${Math.round(ai.lapCoverage * 100)}%`;
    this.crossTrack.textContent = `${ai.crossTrackErrorM >= 0 ? '+' : ''}${
      ai.crossTrackErrorM.toFixed(2)
    } m`;
    this.racingLineError.textContent = `${
      ai.racingLineErrorM >= 0 ? '+' : ''
    }${ai.racingLineErrorM.toFixed(2)} m`;
    this.headingError.textContent = `${
      (ai.headingErrorRadians * 180 / Math.PI).toFixed(1)
    }°`;
    this.lookAhead.textContent = `${ai.lookAheadM.toFixed(1)} m`;
    this.steeringLimit.textContent = `${Math.round(ai.steeringLimit * 100)}%`;
    const maximumLongSlip = Math.max(
      0,
      ...frame.pose.wheelLongitudinalSlips.map(Math.abs),
    );
    const maximumLateralSlip = Math.max(
      0,
      ...frame.pose.wheelLateralSlipRadians.map(Math.abs),
    );
    this.longSlip.textContent = `${Math.round(maximumLongSlip * 100)}%`;
    this.lateralSlip.textContent = `${
      (maximumLateralSlip * 180 / Math.PI).toFixed(1)
    }°`;
    this.groundedWheels.textContent = `${
      frame.pose.wheelGrounded.filter(Boolean).length
    } / ${frame.pose.wheelGrounded.length}`;
    this.cleanPasses.textContent = String(ai.cleanPasses);
    this.zoneIncidents.textContent = String(ai.incidentCount);
    this.totalIncidents.textContent = String(ai.totalIncidentCount);
    this.lineOffset.textContent = `${ai.desiredLineOffsetM >= 0 ? '+' : ''}${
      ai.desiredLineOffsetM.toFixed(2)
    } m`;
    this.fastZones.textContent = String(ai.fastZoneCount);
    this.brakingZones.textContent = String(ai.brakingZoneCount);
    this.caution.textContent = ai.upcomingCautionDistanceM !== undefined
      ? `${ai.cautionLevel > 0 ? `S${ai.cautionLevel.toFixed(1)}` : 'MEM'} / ${
          ai.upcomingCautionDistanceM?.toFixed(0) ?? 0
        } m`
      : 'LIBRE';
    this.bestZoneSpeed.textContent = `${ai.bestCleanSpeedKmh.toFixed(0)} km/h`;
    this.currentLap.textContent = formatLapTime(frame.lapElapsedMs);
    this.bestLap.textContent = formatLapTime(ai.bestLapMs);
    this.ghost.textContent = frame.ghostReady ? 'VUELTA ANTERIOR' : 'GRABANDO';
    this.updateSegmentTiming(frame.segmentTiming);
    this.learningStatus.textContent = [
      frame.lapSource === 'race' ? 'CRONOMETRAJE OFICIAL' : 'VUELTA LIBRE',
      ai.baselineCaptureActive
        ? `GRABANDO BASE · ${formatLapTime(frame.lapElapsedMs)}`
        : ai.baselineReady
          ? `BASE ${formatLapTime(ai.baselineLapMs)}`
          : 'ESPERANDO VUELTA ASISTIDA',
      ai.segmentRetryAttempt > 0
        ? `CELDA 10 M · REINTENTO ${ai.segmentRetryAttempt}/6 · ${
            formatSegmentTime(ai.segmentBestTimeMs ?? 0)
          } OBJ`
        : ai.segmentBestTimeMs !== undefined
          ? `CELDA 10 M · MEJOR ${formatSegmentTime(ai.segmentBestTimeMs)}`
          : `MEMORIA V${ai.completedLearningLaps}`,
      `${cornerPhaseLabels[ai.cornerPhase]} · ${
        ai.previewBrakeDistanceM === undefined
          ? 'SIN FRENADA'
          : `${
              ai.brakeCommand > 0.02 ? 'FRENANDO' : 'PREPARA FRENADA'
            } · CURVA ${ai.previewBrakeDistanceM.toFixed(0)} M`
      }`,
      ai.driverLearningActive && !ai.incident
        ? `APRENDIENDO DEL PILOTO · ${frame.pose.speedKmh.toFixed(0)} KM/H`
        : ai.incident
        ? `INCIDENTE ${ai.incident.toUpperCase()} ${
            ai.incidentSide === 0 || ai.incidentSide === undefined
              ? ''
              : ai.incidentSide > 0 ? 'DER' : 'IZQ'
          } S${(ai.incidentSeverity ?? 0).toFixed(2)}`
        : `ZONA ${zoneClassLabels[ai.zoneClassification]} · ${
            ai.optimizationLocked
              ? `ÓPTIMO BLOQUEADO · ${ai.bestCleanSpeedKmh.toFixed(0)} KM/H`
              : ai.improvementPotentialKmh > 0.05
              ? `PRÓXIMA +${ai.improvementPotentialKmh.toFixed(1)} KM/H`
              : `CONVERGENCIA ${ai.stagnantPasses}/5`
          }`,
    ].join(' / ');
    this.setBar(this.throttleBar, ai.throttleCommand);
    this.setBar(this.brakeBar, ai.brakeCommand);
    this.setSteeringBar(ai.steeringCommand);
    this.drawVision(frame);
  }

  private updateSegmentTiming(timing: ApexSegmentTimingSnapshot): void {
    this.segmentRows.forEach((elements, index) => {
      const active = index === timing.activeSegmentIndex;
      const currentMs = active
        ? timing.activeElapsedMs
        : timing.currentLapTimesMs[index]
          ?? timing.previousLapTimesMs[index];
      const bestMs = timing.bestTimesMs[index];
      const deltaMs = (
        currentMs !== undefined
        && bestMs !== undefined
        && (!active || currentMs >= bestMs * 0.22)
      )
        ? currentMs - bestMs
        : undefined;
      elements.row.classList.toggle('is-active', active);
      elements.current.textContent = currentMs === undefined
        ? '--'
        : formatSegmentTime(currentMs);
      elements.best.textContent = bestMs === undefined
        ? '--'
        : formatSegmentTime(bestMs);
      elements.delta.textContent = deltaMs === undefined
        ? '--'
        : `${deltaMs > 0 ? '+' : deltaMs < 0 ? '−' : '±'}${
            (Math.abs(deltaMs) / 1000).toFixed(3)
          }`;
      elements.delta.classList.toggle('is-gain', (deltaMs ?? 0) < 0);
      elements.delta.classList.toggle('is-loss', (deltaMs ?? 0) > 0);
    });
  }

  private setBar(element: HTMLElement, value: number): void {
    element.style.setProperty('--ai-command', String(
      Math.max(0, Math.min(1, value)),
    ));
  }

  private setSteeringBar(value: number): void {
    const steering = Math.max(-1, Math.min(1, value));
    this.steeringBar.style.setProperty(
      '--ai-steering-width',
      `${Math.abs(steering) * 50}%`,
    );
    this.steeringBar.style.setProperty(
      '--ai-steering-left',
      `${steering < 0 ? 50 - Math.abs(steering) * 50 : 50}%`,
    );
  }

  private drawVision(frame: ApexAutonomousPanelFrame): void {
    const { context: ctx, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const background = ctx.createRadialGradient(
      width * 0.5,
      height * 0.56,
      20,
      width * 0.5,
      height * 0.56,
      height * 0.72,
    );
    background.addColorStop(0, '#190202');
    background.addColorStop(0.58, '#090000');
    background.addColorStop(1, '#020000');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const centerLine = frame.trackCenterLine;
    if (centerLine.length < 2) return;
    const [qx, qy, qz, qw] = [
      frame.pose.rotation.x,
      frame.pose.rotation.y,
      frame.pose.rotation.z,
      frame.pose.rotation.w,
    ];
    const forwardX = 2 * (qx * qz + qw * qy);
    const forwardZ = 1 - 2 * (qx * qx + qy * qy);
    const forwardLength = Math.hypot(forwardX, forwardZ) || 1;
    const fx = forwardX / forwardLength;
    const fz = forwardZ / forwardLength;
    const rx = fz;
    const rz = -fx;

    const visibleMapWidthM = 95;
    const visibleMapHeightM = 180;
    const mapScale = Math.min(
      width * 0.88 / visibleMapWidthM,
      height * 0.78 / visibleMapHeightM,
    );
    const carScreenX = width * 0.5;
    const carScreenY = height * 0.68;
    const mapPlaneTilt = 0.82;
    const mapLocalPoint = (rightM: number, forwardM: number) => {
      const depthRatio = Math.max(
        -0.45,
        Math.min(1, forwardM / visibleMapHeightM),
      );
      const perspectiveWidth = 1 - depthRatio * 0.24;
      return {
        x: carScreenX - rightM * mapScale * perspectiveWidth,
        y: carScreenY - forwardM * mapScale * mapPlaneTilt,
      };
    };
    const mapPoint = (point: Readonly<{ x: number; z: number }>) => {
      const dx = point.x - frame.pose.position.x;
      const dz = point.z - frame.pose.position.z;
      const rightM = dx * rx + dz * rz;
      const forwardM = dx * fx + dz * fz;
      return mapLocalPoint(rightM, forwardM);
    };
    const tracePath = (
      points: readonly Readonly<{ x: number; z: number }>[],
      close: boolean,
    ) => {
      ctx.beginPath();
      points.forEach((point, index) => {
        const mapped = mapPoint(point);
        if (index === 0) ctx.moveTo(mapped.x, mapped.y);
        else ctx.lineTo(mapped.x, mapped.y);
      });
      if (close) ctx.closePath();
    };

    ctx.strokeStyle = '#2c0808';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 9]);
    ctx.beginPath();
    for (let forwardM = -80; forwardM <= 160; forwardM += 20) {
      const left = mapLocalPoint(-visibleMapWidthM * 0.62, forwardM);
      const right = mapLocalPoint(visibleMapWidthM * 0.62, forwardM);
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
    }
    for (
      let rightM = -visibleMapWidthM * 0.6;
      rightM <= visibleMapWidthM * 0.6;
      rightM += 20
    ) {
      const near = mapLocalPoint(rightM, -80);
      const far = mapLocalPoint(rightM, 160);
      ctx.moveTo(near.x, near.y);
      ctx.lineTo(far.x, far.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const roadWidthPx = Math.max(7, frame.trackWidthM * mapScale);
    tracePath(centerLine, true);
    ctx.strokeStyle = 'rgba(255, 20, 20, .18)';
    ctx.lineWidth = roadWidthPx + 12;
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 18;
    ctx.stroke();

    tracePath(centerLine, true);
    ctx.strokeStyle = '#3c0a0a';
    ctx.lineWidth = roadWidthPx;
    ctx.shadowBlur = 0;
    ctx.stroke();

    tracePath(centerLine, true);
    ctx.strokeStyle = '#c62e2e';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (frame.line.length > 1) {
      tracePath(frame.line, true);
      ctx.strokeStyle = '#ff7777';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 7]);
      ctx.shadowColor = '#ff2323';
      ctx.shadowBlur = 7;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
    }

    const firstPoint = centerLine[0];
    const lastPoint = centerLine[centerLine.length - 1];
    const trackLengthM = lastPoint.distanceM + Math.hypot(
      firstPoint.x - lastPoint.x,
      firstPoint.z - lastPoint.z,
    );
    const aheadDistanceM = (distanceM: number) => (
      distanceM
      - frame.telemetry.trackDistanceM
      + trackLengthM
    ) % trackLengthM;
    const previewSamples = centerLine
      .map(point => ({
        point,
        aheadM: aheadDistanceM(point.distanceM),
      }))
      .filter(({ aheadM }) => aheadM <= 140)
      .sort((a, b) => a.aheadM - b.aheadM);
    const previewPoints = previewSamples.map(({ point }) => point);
    if (previewPoints.length > 1) {
      tracePath(previewPoints, false);
      ctx.strokeStyle = '#ff3838';
      ctx.lineWidth = Math.max(3, roadWidthPx * 0.34);
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    const learnedPreviewSamples = frame.line
      .map(point => ({
        point,
        aheadM: aheadDistanceM(point.distanceM),
      }))
      .filter(({ aheadM }) => aheadM <= 140)
      .sort((a, b) => a.aheadM - b.aheadM);
    learnedPreviewSamples.forEach(({ point }, index) => {
      if (index % 3 !== 0) return;
      const learnedPoint = mapPoint(point);
      if (
        learnedPoint.x < 0
        || learnedPoint.x > width
        || learnedPoint.y < 54
        || learnedPoint.y > height - 48
      ) return;
      ctx.fillStyle = '#ff9b9b';
      ctx.beginPath();
      ctx.arc(learnedPoint.x, learnedPoint.y, 1.7, 0, Math.PI * 2);
      ctx.fill();
    });

    const sampleNearest = (distanceM: number) => previewSamples.reduce(
      (nearest, candidate) => (
        Math.abs(candidate.aheadM - distanceM)
          < Math.abs(nearest.aheadM - distanceM)
          ? candidate
          : nearest
      ),
      previewSamples[0],
    );
    const curveSignals = [25, 60, 100].flatMap(distanceM => {
      if (previewSamples.length < 5) return [];
      const before = sampleNearest(Math.max(2, distanceM - 11));
      const current = sampleNearest(distanceM);
      const after = sampleNearest(Math.min(138, distanceM + 11));
      const incomingX = current.point.x - before.point.x;
      const incomingZ = current.point.z - before.point.z;
      const outgoingX = after.point.x - current.point.x;
      const outgoingZ = after.point.z - current.point.z;
      const turnRadians = Math.atan2(
        incomingX * outgoingZ - incomingZ * outgoingX,
        incomingX * outgoingX + incomingZ * outgoingZ,
      );
      const grade = (
        (after.point.y - before.point.y)
        / Math.max(
          1,
          Math.hypot(
            after.point.x - before.point.x,
            after.point.z - before.point.z,
          ),
        )
        * 100
      );
      if (Math.abs(turnRadians) < 0.025 && Math.abs(grade) < 0.7) return [];
      return [{
        distanceM: current.aheadM,
        direction: Math.abs(turnRadians) < 0.025
          ? 'RECTO'
          : turnRadians > 0 ? 'DER' : 'IZQ',
        angleDegrees: Math.abs(turnRadians * 180 / Math.PI),
        grade,
        screen: mapPoint(current.point),
      }];
    });
    curveSignals.forEach((signal, index) => {
      const labelRight = signal.screen.x < carScreenX;
      const labelX = Math.max(
        78,
        Math.min(
          width - 78,
          signal.screen.x + (labelRight ? 24 : -24),
        ),
      );
      const labelY = signal.screen.y - 8 - index * 4;
      ctx.strokeStyle = '#ff6969';
      ctx.fillStyle = '#ff9a9a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(signal.screen.x, signal.screen.y, 4, 0, Math.PI * 2);
      ctx.moveTo(signal.screen.x, signal.screen.y);
      ctx.lineTo(labelX, labelY);
      ctx.stroke();
      ctx.textAlign = labelRight ? 'left' : 'right';
      ctx.font = '700 10px ui-monospace, monospace';
      ctx.fillText(
        `${signal.direction} ${signal.angleDegrees.toFixed(0)}° · ${
          signal.distanceM.toFixed(0)
        }M`,
        labelX + (labelRight ? 3 : -3),
        labelY - 2,
      );
      if (Math.abs(signal.grade) >= 0.7) {
        ctx.fillStyle = '#b84c4c';
        ctx.font = '9px ui-monospace, monospace';
        ctx.fillText(
          `${signal.grade > 0 ? 'SUBE' : 'BAJA'} ${
            Math.abs(signal.grade).toFixed(1)
          }%`,
          labelX + (labelRight ? 3 : -3),
          labelY + 10,
        );
      }
    });
    ctx.textAlign = 'left';

    const drawLearningMarker = (
      distanceM: number | undefined,
      label: string,
      color: string,
    ) => {
      if (
        distanceM === undefined
        || distanceM < 0
        || distanceM > 140
        || previewSamples.length === 0
      ) return;
      const sample = sampleNearest(distanceM);
      const marker = mapPoint(sample.point);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffe0e0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(marker.x, marker.y - 10);
      ctx.lineTo(marker.x - 8, marker.y + 7);
      ctx.lineTo(marker.x + 8, marker.y + 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffb0b0';
      ctx.font = '800 9px ui-monospace, monospace';
      ctx.fillText(`${label} ${distanceM.toFixed(0)}M`, marker.x + 11, marker.y + 3);
    };
    drawLearningMarker(
      frame.telemetry.previewBrakeDistanceM,
      'BRAKE',
      '#ff3030',
    );
    drawLearningMarker(
      frame.telemetry.upcomingCautionDistanceM,
      'MEM',
      '#a90000',
    );

    for (let index = 0; index < 10; index += 1) {
      const point = centerLine[Math.floor(index * centerLine.length / 10)];
      if (!point) continue;
      const marker = mapPoint(point);
      ctx.fillStyle = index === frame.telemetry.zoneIndex
        ? '#fff1f1'
        : '#8e2929';
      ctx.beginPath();
      ctx.arc(
        marker.x,
        marker.y,
        index === frame.telemetry.zoneIndex ? 4 : 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.strokeStyle = '#ff8a8a';
    ctx.fillStyle = '#ff4040';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(carScreenX, carScreenY - 15);
    ctx.lineTo(carScreenX - 9, carScreenY + 12);
    ctx.lineTo(carScreenX, carScreenY + 7);
    ctx.lineTo(carScreenX + 9, carScreenY + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ff5555';
    ctx.font = '700 18px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${frame.pose.speedKmh.toFixed(0)} KPH`, 18, 30);
    ctx.textAlign = 'right';
    ctx.fillText(
      `TGT ${frame.telemetry.targetSpeedKmh.toFixed(0)}`,
      width - 18,
      30,
    );
    ctx.font = '700 10px ui-monospace, monospace';
    ctx.fillStyle = '#b84c4c';
    ctx.textAlign = 'center';
    ctx.fillText(
      `TRACK MESH · AUTO FIXED · MAP ROT ${
        Math.atan2(fx, fz) * 180 / Math.PI >= 0 ? '+' : ''
      }${(Math.atan2(fx, fz) * 180 / Math.PI).toFixed(0)}°`,
      width * 0.5,
      50,
    );
    ctx.fillStyle = '#ff7777';
    ctx.fillText(
      `LEARN V${frame.telemetry.completedLearningLaps} · ${
        frame.telemetry.zoneClassification.toUpperCase()
      } · TRY ${frame.telemetry.nextTrialSpeedKmh.toFixed(0)} KPH`,
      width * 0.5,
      66,
    );
    ctx.fillStyle = '#a84747';
    ctx.fillText(
      `LINE ${
        frame.telemetry.desiredLineOffsetM >= 0 ? '+' : ''
      }${frame.telemetry.desiredLineOffsetM.toFixed(2)}M · ERR ${
        frame.telemetry.racingLineErrorM >= 0 ? '+' : ''
      }${frame.telemetry.racingLineErrorM.toFixed(2)}M`,
      width * 0.5,
      80,
    );
    ctx.fillStyle = '#b84c4c';
    ctx.fillText(
      `S${frame.telemetry.zoneIndex + 1}/10 · ${
        frame.telemetry.cornerPhase.toUpperCase()
      } · ${Math.round(frame.telemetry.powerLimit * 100)}% PWR`,
      width * 0.5,
      height - 22,
    );
    ctx.textAlign = 'left';

    if (frame.telemetry.incident) {
      ctx.fillStyle = 'rgba(255, 0, 0, .16)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ffd0d0';
      ctx.textAlign = 'center';
      ctx.font = '900 16px ui-monospace, monospace';
      ctx.fillText(
        `INCIDENT · ${frame.telemetry.incident.toUpperCase()}`,
        width * 0.5,
        height * 0.52,
      );
      ctx.textAlign = 'left';
    }

    ctx.fillStyle = 'rgba(255, 0, 0, .065)';
    for (let y = 0; y < height; y += 6) {
      ctx.fillRect(0, y, width, 2);
    }
  }

  private drawPerspectiveVision(frame: ApexAutonomousPanelFrame): void {
    const { context: ctx, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, '#170000');
    background.addColorStop(0.56, '#090000');
    background.addColorStop(1, '#020000');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const [qx, qy, qz, qw] = [
      frame.pose.rotation.x,
      frame.pose.rotation.y,
      frame.pose.rotation.z,
      frame.pose.rotation.w,
    ];
    const forwardX = 2 * (qx * qz + qw * qy);
    const forwardZ = 1 - 2 * (qx * qx + qy * qy);
    const forwardLength = Math.hypot(forwardX, forwardZ) || 1;
    const fx = forwardX / forwardLength;
    const fz = forwardZ / forwardLength;
    const rx = fz;
    const rz = -fx;
    const firstLinePoint = frame.trackCenterLine[0];
    const lastLinePoint = frame.trackCenterLine[
      frame.trackCenterLine.length - 1
    ];
    const trackLengthM = firstLinePoint && lastLinePoint
      ? lastLinePoint.distanceM + Math.hypot(
          firstLinePoint.x - lastLinePoint.x,
          firstLinePoint.z - lastLinePoint.z,
        )
      : 1;
    const visionDistanceM = 140;
    const projectLinePoint = (point: RacingLinePoint) => {
      const dx = point.x - frame.pose.position.x;
      const dz = point.z - frame.pose.position.z;
      const alongM = (
        point.distanceM
        - frame.telemetry.trackDistanceM
        + trackLengthM
      ) % trackLengthM;
      return {
        alongM,
        carForwardM: dx * fx + dz * fz,
        rightM: dx * rx + dz * rz,
        elevationM: point.y - frame.pose.position.y,
        worldX: point.x,
        worldY: point.y,
        worldZ: point.z,
      };
    };
    const projected = frame.trackCenterLine
      .map(projectLinePoint)
      .filter(point => point.alongM > 1.5 && point.alongM < visionDistanceM)
      .sort((a, b) => a.alongM - b.alongM);
    const targetProjected = frame.line
      .map(projectLinePoint)
      .filter(point => point.alongM > 1.5 && point.alongM < visionDistanceM)
      .sort((a, b) => a.alongM - b.alongM);

    const mapOriginY = height * 0.91;
    const mapHorizonY = height * 0.12;
    const nearPlaneHalfWidth = width * 0.46;
    const farPlaneHalfWidth = width * 0.28;
    const maximumVisibleRightM = Math.max(
      frame.trackWidthM,
      ...projected.map(point => Math.abs(point.rightM)),
      ...targetProjected.map(point => Math.abs(point.rightM)),
    );
    const targetLateralRangeM = Math.max(
      frame.trackWidthM * 1.6,
      maximumVisibleRightM * 1.12,
    );
    const lateralRangeBlend = targetLateralRangeM > this.visionLateralRangeM
      ? 0.16
      : 0.035;
    this.visionLateralRangeM += (
      targetLateralRangeM - this.visionLateralRangeM
    ) * lateralRangeBlend;
    const lateralRangeM = this.visionLateralRangeM;
    const planeHalfWidthAt = (depth: number) => (
      nearPlaneHalfWidth
      + (farPlaneHalfWidth - nearPlaneHalfWidth) * depth
    );
    const screenPoint = (
      _carForwardM: number,
      rightM: number,
      elevationM: number,
      alongM: number,
    ) => {
      const depth = Math.max(0, Math.min(1, alongM / visionDistanceM));
      const planeHalfWidth = planeHalfWidthAt(depth);
      return {
        x: width * 0.5 - rightM / lateralRangeM * planeHalfWidth,
        y: mapOriginY
          + (mapHorizonY - mapOriginY) * depth
          - elevationM * (5.4 - depth * 2.2),
      };
    };

    ctx.fillStyle = 'rgba(35, 2, 2, .72)';
    ctx.strokeStyle = '#7b1717';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(width * 0.5 - nearPlaneHalfWidth, mapOriginY);
    ctx.lineTo(width * 0.5 + nearPlaneHalfWidth, mapOriginY);
    ctx.lineTo(width * 0.5 + farPlaneHalfWidth, mapHorizonY);
    ctx.lineTo(width * 0.5 - farPlaneHalfWidth, mapHorizonY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#4b0d0d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const lateralRatio of [-0.66, -0.33, 0, 0.33, 0.66]) {
      ctx.moveTo(
        width * 0.5 + nearPlaneHalfWidth * lateralRatio,
        mapOriginY,
      );
      ctx.lineTo(
        width * 0.5 + farPlaneHalfWidth * lateralRatio,
        mapHorizonY,
      );
    }
    ctx.stroke();

    ctx.strokeStyle = '#5f1010';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 10]);
    for (const distanceM of [20, 40, 60, 80, 100, 120, 140]) {
      const depth = distanceM / visionDistanceM;
      const markerY = mapOriginY + (mapHorizonY - mapOriginY) * depth;
      const markerHalfWidth = planeHalfWidthAt(depth);
      ctx.beginPath();
      ctx.moveTo(width * 0.5 - markerHalfWidth, markerY);
      ctx.lineTo(width * 0.5 + markerHalfWidth, markerY);
      ctx.stroke();
      ctx.fillStyle = '#8a2929';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText(
        `${distanceM}M`,
        width * 0.5 - markerHalfWidth + 5,
        markerY - 4,
      );
    }
    ctx.setLineDash([]);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(width * 0.5 - nearPlaneHalfWidth, mapOriginY);
    ctx.lineTo(width * 0.5 + nearPlaneHalfWidth, mapOriginY);
    ctx.lineTo(width * 0.5 + farPlaneHalfWidth, mapHorizonY);
    ctx.lineTo(width * 0.5 - farPlaneHalfWidth, mapHorizonY);
    ctx.closePath();
    ctx.clip();

    const edgeScreenPoint = (
      index: number,
      side: number,
    ): { x: number; y: number } => {
      const point = projected[index];
      const previous = projected[Math.max(0, index - 1)];
      const next = projected[Math.min(projected.length - 1, index + 1)];
      const tangentX = next.worldX - previous.worldX;
      const tangentZ = next.worldZ - previous.worldZ;
      const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
      const lateralX = tangentZ / tangentLength;
      const lateralZ = -tangentX / tangentLength;
      const edgeX = point.worldX
        + lateralX * frame.trackWidthM * 0.5 * side;
      const edgeZ = point.worldZ
        + lateralZ * frame.trackWidthM * 0.5 * side;
      const dx = edgeX - frame.pose.position.x;
      const dz = edgeZ - frame.pose.position.z;
      return screenPoint(
        dx * fx + dz * fz,
        dx * rx + dz * rz,
        point.worldY - frame.pose.position.y,
        point.alongM,
      );
    };

    if (projected.length > 1) {
      ctx.fillStyle = 'rgba(105, 4, 4, .25)';
      ctx.beginPath();
      projected.forEach((_point, index) => {
        const edge = edgeScreenPoint(index, -1);
        if (index === 0) ctx.moveTo(edge.x, edge.y);
        else ctx.lineTo(edge.x, edge.y);
      });
      for (let index = projected.length - 1; index >= 0; index -= 1) {
        const edge = edgeScreenPoint(index, 1);
        ctx.lineTo(edge.x, edge.y);
      }
      ctx.closePath();
      ctx.fill();
    }

    if (projected.length > 1) for (const side of [-1, 1]) {
      ctx.strokeStyle = '#ff2424';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      projected.forEach((_point, index) => {
        const edge = edgeScreenPoint(index, side);
        if (index === 0) ctx.moveTo(edge.x, edge.y);
        else ctx.lineTo(edge.x, edge.y);
      });
      ctx.stroke();
    }

    ctx.shadowBlur = 7;
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3;
    ctx.setLineDash([15, 12]);
    ctx.beginPath();
    targetProjected.forEach((point, index) => {
      const previous = targetProjected[Math.max(0, index - 1)];
      const next = targetProjected[
        Math.min(targetProjected.length - 1, index + 1)
      ];
      const tangentX = next.worldX - previous.worldX;
      const tangentZ = next.worldZ - previous.worldZ;
      const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
      const offsetX = point.worldX
        + tangentZ / tangentLength
          * frame.telemetry.desiredLineOffsetM;
      const offsetZ = point.worldZ
        - tangentX / tangentLength
          * frame.telemetry.desiredLineOffsetM;
      const dx = offsetX - frame.pose.position.x;
      const dz = offsetZ - frame.pose.position.z;
      const screen = screenPoint(
        dx * fx + dz * fz,
        dx * rx + dz * rz,
        point.elevationM,
        point.alongM,
      );
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.restore();

    const signals = [30, 70, 110].flatMap(distanceM => {
      if (projected.length < 5) return [];
      let index = 2;
      for (
        let candidateIndex = 3;
        candidateIndex < projected.length - 2;
        candidateIndex += 1
      ) {
        if (
          Math.abs(projected[candidateIndex].alongM - distanceM)
          < Math.abs(projected[index].alongM - distanceM)
        ) index = candidateIndex;
      }
      const previous = projected[index - 2];
      const current = projected[index];
      const next = projected[index + 2];
      const incomingX = current.worldX - previous.worldX;
      const incomingZ = current.worldZ - previous.worldZ;
      const outgoingX = next.worldX - current.worldX;
      const outgoingZ = next.worldZ - current.worldZ;
      const turnRadians = Math.atan2(
        incomingX * outgoingZ - incomingZ * outgoingX,
        incomingX * outgoingX + incomingZ * outgoingZ,
      );
      const grade = (
        (next.worldY - previous.worldY)
        / Math.max(
          1,
          Math.hypot(
            next.worldX - previous.worldX,
            next.worldZ - previous.worldZ,
          ),
        )
        * 100
      );
      const screen = screenPoint(
        current.carForwardM,
        current.rightM,
        current.elevationM,
        current.alongM,
      );
      return [{
        distanceM: current.alongM,
        direction: Math.abs(turnRadians) < 0.035
          ? 'RECTO'
          : turnRadians > 0 ? 'DER' : 'IZQ',
        turnDegrees: Math.abs(turnRadians * 180 / Math.PI),
        grade,
        screen,
        strength: (
          Math.abs(turnRadians) * 22
          + Math.abs(grade) * 0.08
        ),
      }];
    }).filter(signal => signal.strength > 0.55);

    ctx.shadowBlur = 0;
    const previousLabelYBySide = new Map<'left' | 'right', number>();
    signals.forEach(signal => {
      const labelRight = signal.screen.x < width * 0.6;
      const labelSide = labelRight ? 'right' : 'left';
      const labelX = Math.max(
        78,
        Math.min(width - 78, signal.screen.x + (labelRight ? 20 : -20)),
      );
      const desiredLabelY = signal.screen.y - 8;
      const previousLabelY = previousLabelYBySide.get(labelSide);
      const labelY = previousLabelY === undefined
        ? desiredLabelY
        : Math.min(desiredLabelY, previousLabelY - 28);
      previousLabelYBySide.set(labelSide, labelY);
      ctx.strokeStyle = '#ff5757';
      ctx.fillStyle = '#ff7777';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(signal.screen.x, signal.screen.y, 5, 0, Math.PI * 2);
      ctx.moveTo(signal.screen.x, signal.screen.y);
      ctx.lineTo(labelX, labelY);
      ctx.stroke();
      ctx.textAlign = labelRight ? 'left' : 'right';
      ctx.font = '700 11px ui-monospace, monospace';
      const curveLabel = signal.direction === 'RECTO'
        ? 'RECTO'
        : `${signal.direction} ${signal.turnDegrees.toFixed(0)}°`;
      ctx.fillText(
        `${curveLabel} · ${signal.distanceM.toFixed(0)}M`,
        labelX + (labelRight ? 3 : -3),
        labelY - 2,
      );
      if (Math.abs(signal.grade) >= 1) {
        ctx.fillStyle = '#b84c4c';
        ctx.font = '9px ui-monospace, monospace';
        ctx.fillText(
          `${signal.grade > 0 ? 'SUBE' : 'BAJA'} ${
            Math.abs(signal.grade).toFixed(1)
          }%`,
          labelX + (labelRight ? 3 : -3),
          labelY + 10,
        );
      }
    });
    ctx.textAlign = 'left';

    if (frame.telemetry.upcomingCautionDistanceM !== undefined) {
      const cautionPoint = projected.reduce((nearest, candidate) => (
        Math.abs(
          candidate.alongM - frame.telemetry.upcomingCautionDistanceM!
        ) < Math.abs(
          nearest.alongM - frame.telemetry.upcomingCautionDistanceM!
        )
          ? candidate
          : nearest
      ), projected[0]);
      if (cautionPoint) {
        const cautionScreen = screenPoint(
          cautionPoint.carForwardM,
          cautionPoint.rightM,
          cautionPoint.elevationM,
          cautionPoint.alongM,
        );
        ctx.fillStyle = '#ff2020';
        ctx.strokeStyle = '#ff9b9b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cautionScreen.x, cautionScreen.y - 13);
        ctx.lineTo(cautionScreen.x - 11, cautionScreen.y + 8);
        ctx.lineTo(cautionScreen.x + 11, cautionScreen.y + 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.font = '900 11px ui-monospace, monospace';
        ctx.fillText(
          `MEM CAUTION ${
            frame.telemetry.upcomingCautionDistanceM.toFixed(0)
          }M`,
          cautionScreen.x + 15,
          cautionScreen.y + 3,
        );
      }
    }

    ctx.strokeStyle = '#ff4545';
    ctx.fillStyle = '#ff4545';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.5, mapOriginY - 17);
    ctx.lineTo(width * 0.5 - 10, mapOriginY + 11);
    ctx.lineTo(width * 0.5, mapOriginY + 6);
    ctx.lineTo(width * 0.5 + 10, mapOriginY + 11);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(width * 0.5, mapOriginY, 25, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ff4444';
    ctx.font = '700 20px ui-monospace, monospace';
    ctx.fillText(
      `${frame.pose.speedKmh.toFixed(0)} KPH`,
      22,
      32,
    );
    ctx.textAlign = 'right';
    ctx.fillText(
      `TGT ${frame.telemetry.targetSpeedKmh.toFixed(0)}`,
      width - 22,
      32,
    );
    ctx.textAlign = 'left';
    ctx.font = '15px ui-monospace, monospace';
    ctx.fillText(
      `ZONE ${frame.telemetry.zoneIndex + 1}  PWR ${
        Math.round(frame.telemetry.powerLimit * 100)
      }%`,
      22,
      height - 15,
    );
    ctx.textAlign = 'center';
    ctx.font = '900 11px ui-monospace, monospace';
    ctx.fillStyle = '#ff7777';
    ctx.fillText(
      `ZONE ${frame.telemetry.zoneClassification.toUpperCase()} · SAFE ${
        frame.telemetry.minimumCleanSpeedKmh > 0
          ? frame.telemetry.minimumCleanSpeedKmh.toFixed(0)
          : '--'
      }–${
        frame.telemetry.bestCleanSpeedKmh > 0
          ? frame.telemetry.bestCleanSpeedKmh.toFixed(0)
          : '--'
      } · ${
        frame.telemetry.optimizationLocked
          ? `OPTIMAL LOCK ${frame.telemetry.bestCleanSpeedKmh.toFixed(0)}`
          : `TRY ${frame.telemetry.nextTrialSpeedKmh.toFixed(0)} ${
            frame.telemetry.improvementPotentialKmh > 0.05
          ? `(+${frame.telemetry.improvementPotentialKmh.toFixed(1)} / -${
              (frame.telemetry.estimatedZoneGainMs / 1000).toFixed(2)
            }S)`
          : ''}`
      }`,
      width * 0.5,
      54,
    );
    const immediateSignal = signals[0];
    ctx.textAlign = 'right';
    ctx.fillText(
      immediateSignal
        ? `NEXT ${immediateSignal.direction} ${
            immediateSignal.distanceM.toFixed(0)
          }M`
        : 'PATH CLEAR',
      width - 22,
      height - 15,
    );
    ctx.textAlign = 'left';

    if (frame.telemetry.incident) {
      ctx.fillStyle = 'rgba(255, 0, 0, .22)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ffb0b0';
      ctx.textAlign = 'center';
      ctx.font = '900 24px ui-monospace, monospace';
      ctx.fillText('INCIDENT VECTOR RECORDED', width * 0.5, 62);
      ctx.textAlign = 'left';
    }

    ctx.fillStyle = 'rgba(255, 0, 0, .075)';
    for (let y = 0; y < height; y += 6) {
      ctx.fillRect(0, y, width, 2);
    }
  }
}
