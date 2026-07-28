import type { WheelId } from './TelemetryFrame';
import type { TelemetryReader } from './TelemetryStore';
import { CircularSeries } from './CircularSeries';

export interface WheelSeriesSet {
  readonly FL: CircularSeries;
  readonly FR: CircularSeries;
  readonly RL: CircularSeries;
  readonly RR: CircularSeries;
}

const createWheelSeries = (capacity: number): WheelSeriesSet => ({
  FL: new CircularSeries(capacity),
  FR: new CircularSeries(capacity),
  RL: new CircularSeries(capacity),
  RR: new CircularSeries(capacity),
});

/** Históricos tipados fuera de React: cada muestra ocupa sólo un float. */
export class TelemetryHistory {
  readonly slipRatio: WheelSeriesSet;
  readonly slipAngle: WheelSeriesSet;
  readonly wheelLoad: WheelSeriesSet;
  private readonly unsubscribe: () => void;

  constructor(source: TelemetryReader, capacity = 240) {
    this.slipRatio = createWheelSeries(capacity);
    this.slipAngle = createWheelSeries(capacity);
    this.wheelLoad = createWheelSeries(capacity);
    this.unsubscribe = source.subscribe(frame => {
      for (const wheel of frame.wheels) {
        const id: WheelId = wheel.id;
        this.slipRatio[id].push(wheel.slipRatio);
        this.slipAngle[id].push(wheel.slipAngle);
        this.wheelLoad[id].push(wheel.load);
      }
    });
  }

  dispose(): void {
    this.unsubscribe();
  }
}
