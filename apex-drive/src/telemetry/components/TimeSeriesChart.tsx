import { useEffect, useRef } from 'react';
import type { CircularSeries } from '../core/CircularSeries';

export interface TimeSeriesLine {
  readonly label: string;
  readonly color: string;
  readonly values: CircularSeries;
}

export interface TimeSeriesChartProps {
  readonly title: string;
  readonly unit: string;
  readonly lines: readonly TimeSeriesLine[];
  readonly revision: number;
  readonly min: number;
  readonly max: number;
  readonly decimals?: number;
}

export function TimeSeriesChart({
  title,
  unit,
  lines,
  revision,
  min,
  max,
  decimals = 1,
}: TimeSeriesChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    const width = Math.max(1, Math.round(bounds.width * pixelRatio));
    const height = Math.max(1, Math.round(bounds.height * pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);

    const plotWidth = bounds.width;
    const plotHeight = bounds.height;
    const span = Math.max(Number.EPSILON, max - min);
    const valueToY = (value: number) => plotHeight - ((Math.min(max, Math.max(min, value)) - min) / span) * plotHeight;

    context.lineWidth = 1;
    context.strokeStyle = '#5d7d852e';
    for (let row = 1; row < 4; row += 1) {
      const y = (plotHeight * row) / 4;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(plotWidth, y);
      context.stroke();
    }
    if (min < 0 && max > 0) {
      context.strokeStyle = '#8fb8c244';
      context.beginPath();
      context.moveTo(0, valueToY(0));
      context.lineTo(plotWidth, valueToY(0));
      context.stroke();
    }

    for (const line of lines) {
      if (line.values.length < 2) continue;
      context.beginPath();
      context.strokeStyle = line.color;
      context.lineWidth = 1.35;
      line.values.forEachChronological((value, index, count) => {
        const x = count <= 1 ? 0 : (index / (count - 1)) * plotWidth;
        const y = valueToY(value);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
    }
  }, [decimals, lines, max, min, revision, title, unit]);

  return (
    <figure className="time-series-chart">
      <figcaption>
        <strong>{title}</strong>
        <span>{lines.map(line => (
          <i key={line.label} style={{ '--series-color': line.color } as React.CSSProperties}>
            {line.label} <b>{line.values.latest?.toFixed(decimals) ?? '—'}</b>
          </i>
        ))}</span>
        <small>{unit}</small>
      </figcaption>
      <canvas ref={canvasRef} aria-label={`${title}, history for four wheels`} />
    </figure>
  );
}
