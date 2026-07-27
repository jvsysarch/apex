/**
 * Entrada autoritativa que el runtime físico consume en cada step.
 *
 * Los campos digitales conservan compatibilidad con teclado. Los valores
 * analógicos permiten que joystick, conducción autónoma y auditorías usen el
 * mismo contrato sin depender de UI ni de Apex Drive.
 */
export interface DriverInput {
  readonly forward: boolean;
  readonly backward: boolean;
  readonly left: boolean;
  readonly right: boolean;
  readonly handbrake: boolean;
  readonly throttle?: number;
  readonly brake?: number;
  readonly steering?: number;
}
