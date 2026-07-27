/** Modelo físico de fuerzas aerodinámicas, independiente de pista y render. */
export interface AerodynamicForces {
  readonly dragX: number;
  readonly dragY: number;
  readonly dragZ: number;
  readonly frontDownforce: number;
  readonly rearDownforce: number;
  readonly liftOffFrontDownforce: number;
}

export interface AerodynamicSettings {
  readonly airDensity: number;
  readonly dragArea: number;
  readonly downforceArea: number;
  readonly frontBalance: number;
  readonly maximumDownforce: number;
  readonly liftOffFrontArea: number;
  readonly maximumLiftOffFrontDownforce: number;
}

export class ApexAerodynamics {
  private readonly settings: AerodynamicSettings;

  constructor(settings: AerodynamicSettings) {
    this.settings = settings;
  }

  calculate(
    velocityX: number,
    velocityY: number,
    velocityZ: number,
    liftOffFrontBlend = 0,
  ): AerodynamicForces {
    const speed = Math.hypot(velocityX, velocityY, velocityZ);
    if (speed < 0.1) {
      return Object.freeze({
        dragX: 0,
        dragY: 0,
        dragZ: 0,
        frontDownforce: 0,
        rearDownforce: 0,
        liftOffFrontDownforce: 0,
      });
    }
    const dynamicPressure = 0.5 * this.settings.airDensity * speed * speed;
    const dragMagnitude = dynamicPressure * this.settings.dragArea;
    const downforce = Math.min(this.settings.maximumDownforce, dynamicPressure * this.settings.downforceArea);
    const liftOffFrontDownforce = Math.min(
      this.settings.maximumLiftOffFrontDownforce,
      dynamicPressure * this.settings.liftOffFrontArea,
    ) * Math.max(0, Math.min(1, liftOffFrontBlend));
    return Object.freeze({
      dragX: -velocityX / speed * dragMagnitude,
      dragY: -velocityY / speed * dragMagnitude,
      dragZ: -velocityZ / speed * dragMagnitude,
      frontDownforce: downforce * this.settings.frontBalance + liftOffFrontDownforce,
      rearDownforce: downforce * (1 - this.settings.frontBalance),
      liftOffFrontDownforce,
    });
  }
}
