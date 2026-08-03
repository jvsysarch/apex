const SONY_VENDOR_ID = 0x054c;
const DUALSHOCK4_PRODUCT_IDS = new Set([0x05c4, 0x09cc, 0x0ba0]);
const DUALSENSE_PRODUCT_IDS = new Set([0x0ce6, 0x0df2]);
const FULL_TILT_DEGREES = 45;
const GYRO_COUNTS_PER_DEGREE_PER_SECOND = 1024;

interface ApexHidInputReportEvent extends Event {
  readonly device: ApexHidDevice;
  readonly reportId: number;
  readonly data: DataView;
}

interface ApexHidDevice {
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  readonly opened: boolean;
  open(): Promise<void>;
  addEventListener(
    type: 'inputreport',
    listener: (event: ApexHidInputReportEvent) => void,
  ): void;
  removeEventListener(
    type: 'inputreport',
    listener: (event: ApexHidInputReportEvent) => void,
  ): void;
}

interface ApexHidApi {
  getDevices(): Promise<readonly ApexHidDevice[]>;
  requestDevice(options: {
    readonly filters: readonly { readonly vendorId: number }[];
  }): Promise<readonly ApexHidDevice[]>;
}

const hidApi = (): ApexHidApi | undefined => (
  (navigator as Navigator & { readonly hid?: ApexHidApi }).hid
);
const wrapDegrees = (degrees: number): number => {
  let wrapped = (degrees + 180) % 360;
  if (wrapped < 0) wrapped += 360;
  return wrapped - 180;
};
const supportedProduct = (device: ApexHidDevice): boolean => (
  device.vendorId === SONY_VENDOR_ID
  && (
    DUALSHOCK4_PRODUCT_IDS.has(device.productId)
    || DUALSENSE_PRODUCT_IDS.has(device.productId)
  )
);

export interface ApexMotionSteeringSnapshot {
  readonly active: boolean;
  readonly connected: boolean;
  readonly calibrated: boolean;
  readonly steering: number;
  readonly tiltDegrees: number;
  readonly deviceName?: string;
}

/**
 * Dirección absoluta para DualShock 4 y DualSense mediante WebHID.
 * El acelerómetro fija el ángulo absoluto y el giróscopo aporta respuesta
 * inmediata; la corrección gravitatoria impide que la integración derive.
 */
export class ApexDualShockMotionSteering {
  private device?: ApexHidDevice;
  private enabled = false;
  private calibrated = false;
  private centerDegrees = 0;
  private fusedRollDegrees = 0;
  private tiltDegrees = 0;
  private steering = 0;
  private previousTimestampMs?: number;
  private lastReportTimestampMs?: number;
  private receivedSamples = 0;

  readonly supported = hidApi() !== undefined;

  private readonly onInputReport = (event: ApexHidInputReportEvent): void => {
    if (event.device !== this.device) return;
    const dualSense = DUALSENSE_PRODUCT_IDS.has(event.device.productId);
    const commonOffset = (
      (dualSense && event.reportId === 0x31)
      || (!dualSense && event.reportId === 0x11)
    ) ? 2 : 0;
    const gyroRollOffset = commonOffset + (dualSense ? 19 : 16);
    const accelerometerOffset = commonOffset + (dualSense ? 21 : 18);
    if (event.data.byteLength < accelerometerOffset + 6) return;

    const gyroRoll = event.data.getInt16(gyroRollOffset, true)
      / GYRO_COUNTS_PER_DEGREE_PER_SECOND;
    const accelerationX = event.data.getInt16(accelerometerOffset, true);
    const accelerationZ = event.data.getInt16(accelerometerOffset + 4, true);
    if (Math.abs(accelerationX) + Math.abs(accelerationZ) < 256) return;

    const accelerometerRoll = Math.atan2(
      accelerationX,
      accelerationZ,
    ) * 180 / Math.PI;
    const timestampMs = performance.now();
    this.lastReportTimestampMs = timestampMs;
    const dt = this.previousTimestampMs === undefined
      ? 0
      : Math.min(0.05, Math.max(0, (timestampMs - this.previousTimestampMs) / 1000));
    this.previousTimestampMs = timestampMs;

    if (this.receivedSamples === 0 || dt === 0) {
      this.fusedRollDegrees = accelerometerRoll;
    } else {
      const positivePrediction = wrapDegrees(
        this.fusedRollDegrees + gyroRoll * dt,
      );
      const negativePrediction = wrapDegrees(
        this.fusedRollDegrees - gyroRoll * dt,
      );
      const prediction = Math.abs(wrapDegrees(
        accelerometerRoll - positivePrediction,
      )) <= Math.abs(wrapDegrees(accelerometerRoll - negativePrediction))
        ? positivePrediction
        : negativePrediction;
      const gravityCorrection = 1 - Math.exp(-10 * dt);
      this.fusedRollDegrees = wrapDegrees(
        prediction
        + wrapDegrees(accelerometerRoll - prediction) * gravityCorrection,
      );
    }
    this.receivedSamples += 1;
    if (!this.calibrated && this.receivedSamples >= 8) this.calibrate();
    this.tiltDegrees = this.calibrated
      ? wrapDegrees(this.fusedRollDegrees - this.centerDegrees)
      : 0;
    this.steering = Math.max(-1, Math.min(
      1,
      this.tiltDegrees / FULL_TILT_DEGREES,
    ));
  };

  private async attach(device: ApexHidDevice): Promise<void> {
    if (this.device && this.device !== device) {
      this.device.removeEventListener('inputreport', this.onInputReport);
    }
    if (!device.opened) await device.open();
    this.device = device;
    this.device.addEventListener('inputreport', this.onInputReport);
    this.enabled = true;
    this.calibrated = false;
    this.receivedSamples = 0;
    this.previousTimestampMs = undefined;
    this.lastReportTimestampMs = undefined;
  }

  async connect(): Promise<boolean> {
    const hid = hidApi();
    if (!hid) return false;
    const granted = (await hid.getDevices()).find(supportedProduct);
    const selected = granted ?? (await hid.requestDevice({
      filters: [{ vendorId: SONY_VENDOR_ID }],
    })).find(supportedProduct);
    if (!selected) return false;
    await this.attach(selected);
    return true;
  }

  async restoreGrantedDevice(): Promise<boolean> {
    const hid = hidApi();
    if (!hid) return false;
    const granted = (await hid.getDevices()).find(supportedProduct);
    if (!granted) return false;
    await this.attach(granted);
    return true;
  }

  calibrate(): void {
    if (!this.device || this.receivedSamples === 0) return;
    this.centerDegrees = this.fusedRollDegrees;
    this.calibrated = true;
    this.tiltDegrees = 0;
    this.steering = 0;
  }

  disable(): void {
    this.enabled = false;
    this.steering = 0;
  }

  enable(): void {
    if (this.device) this.enabled = true;
  }

  snapshot(): ApexMotionSteeringSnapshot {
    const reportsAreCurrent = this.lastReportTimestampMs !== undefined
      && performance.now() - this.lastReportTimestampMs < 250;
    const active = this.enabled
      && this.calibrated
      && this.device !== undefined
      && reportsAreCurrent;
    return Object.freeze({
      active,
      connected: this.device !== undefined,
      calibrated: this.calibrated,
      steering: active ? this.steering : 0,
      tiltDegrees: this.tiltDegrees,
      ...(this.device ? { deviceName: this.device.productName } : {}),
    });
  }
}

export const APEX_MOTION_STEERING_FULL_TILT_DEGREES = FULL_TILT_DEGREES;
