export type SurfaceId =
  | 'asphalt'
  | 'asphalt-low-grip'
  | 'asphalt-high-grip'
  | 'grass'
  | 'gravel'
  | 'wet-asphalt';
export type SurfaceMode = 'track' | SurfaceId;

export interface SurfaceProperties {
  readonly id: SurfaceId;
  readonly label: string;
  readonly longitudinalMu: number;
  readonly lateralMu: number;
  readonly peakSlipRatio: number;
  readonly peakSlipAngleRadians: number;
  readonly slidingGripRetention: number;
  readonly breakawayFalloff: number;
}

const degreesToRadians = Math.PI / 180;

export const SURFACE_CATALOG: readonly SurfaceProperties[] = Object.freeze(([
  {
    id: 'asphalt',
    label: 'Asphalt',
    longitudinalMu: 1.32,
    lateralMu: 1.32,
    peakSlipRatio: 0.105,
    peakSlipAngleRadians: 6.3 * degreesToRadians,
    slidingGripRetention: 0.84,
    breakawayFalloff: 1.28,
  },
  {
    id: 'asphalt-low-grip',
    label: 'Asphalt test · low grip',
    longitudinalMu: 0.92,
    lateralMu: 0.88,
    peakSlipRatio: 0.13,
    peakSlipAngleRadians: 8 * degreesToRadians,
    slidingGripRetention: 0.72,
    breakawayFalloff: 1.1,
  },
  {
    id: 'asphalt-high-grip',
    label: 'Asphalt test · high grip',
    longitudinalMu: 1.3,
    lateralMu: 1.27,
    peakSlipRatio: 0.1,
    peakSlipAngleRadians: 6.5 * degreesToRadians,
    slidingGripRetention: 0.78,
    breakawayFalloff: 1.4,
  },
  {
    id: 'grass',
    label: 'Grass',
    longitudinalMu: 0.62,
    lateralMu: 0.56,
    peakSlipRatio: 0.18,
    peakSlipAngleRadians: 12 * degreesToRadians,
    slidingGripRetention: 0.66,
    breakawayFalloff: 0.64,
  },
  {
    id: 'gravel',
    label: 'Gravel',
    longitudinalMu: 0.7,
    lateralMu: 0.62,
    peakSlipRatio: 0.17,
    peakSlipAngleRadians: 11 * degreesToRadians,
    slidingGripRetention: 0.66,
    breakawayFalloff: 0.85,
  },
  {
    id: 'wet-asphalt',
    label: 'Wet asphalt',
    longitudinalMu: 0.82,
    lateralMu: 0.76,
    peakSlipRatio: 0.14,
    peakSlipAngleRadians: 9 * degreesToRadians,
    slidingGripRetention: 0.68,
    breakawayFalloff: 1.05,
  },
] satisfies readonly SurfaceProperties[]).map(surface => Object.freeze(surface)));

export class SurfaceRegistry {
  private readonly surfaces = new Map<SurfaceId, SurfaceProperties>();

  constructor(surfaces: readonly SurfaceProperties[] = SURFACE_CATALOG) {
    for (const surface of surfaces) this.surfaces.set(surface.id, surface);
  }

  get(id: SurfaceId): SurfaceProperties {
    const surface = this.surfaces.get(id);
    if (!surface) throw new Error(`Unknown surface: ${id}`);
    return surface;
  }

  list(): readonly SurfaceProperties[] {
    return Object.freeze(Array.from(this.surfaces.values()));
  }
}
