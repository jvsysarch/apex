export class CircularSeries {
  private readonly values: Float32Array;
  private cursor = 0;
  private count = 0;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 2) {
      throw new Error('CircularSeries capacity must be an integer greater than one');
    }
    this.values = new Float32Array(capacity);
  }

  get length(): number {
    return this.count;
  }

  get latest(): number | undefined {
    if (this.count === 0) return undefined;
    const index = (this.cursor - 1 + this.values.length) % this.values.length;
    return this.values[index];
  }

  push(value: number): void {
    this.values[this.cursor] = Number.isFinite(value) ? value : 0;
    this.cursor = (this.cursor + 1) % this.values.length;
    this.count = Math.min(this.count + 1, this.values.length);
  }

  forEachChronological(visitor: (value: number, index: number, count: number) => void): void {
    const start = (this.cursor - this.count + this.values.length) % this.values.length;
    for (let index = 0; index < this.count; index += 1) {
      visitor(this.values[(start + index) % this.values.length], index, this.count);
    }
  }
}
