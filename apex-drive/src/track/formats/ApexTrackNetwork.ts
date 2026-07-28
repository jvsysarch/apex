import type { ApexTrackBoundaryMode } from '../TrackBoundaryMode';
import type { ApexTrackRoadsideMode } from '../TrackRoadsideMode';

export type ApexTrackSegmentKind = 'road' | 'connector' | 'branch';
export type ApexTrackSegmentVisualMode =
  | 'inherit'
  | 'procedural'
  | 'collision-only'
  | 'asset-reference';
export type ApexTrackRouteDirection = 'forward' | 'reverse';
export type ApexTrackEndpoint = 'start' | 'end';
export type ApexTrackJunctionKind =
  | 'hard'
  | 'smooth'
  | 'merge'
  | 'crossing'
  | 'underpass'
  | 'overpass';

export interface ApexTrackNetworkPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly bankRadians: number;
  readonly surface?: string;
}

export interface ApexTrackSegmentEditorConfiguration {
  readonly closed: boolean;
  readonly controlSpacingM: number;
  readonly collisionSpacingM: number;
  readonly simplificationToleranceM: number;
}

export interface ApexTrackSegmentGeometryConfiguration {
  readonly roadWidthM: number;
  readonly laneCount: number;
  readonly surface: string;
  readonly boundaryMode: ApexTrackBoundaryMode;
  readonly roadsideMode: ApexTrackRoadsideMode;
  readonly visualMode: ApexTrackSegmentVisualMode;
}

export interface ApexTrackSourceSegment {
  readonly id: string;
  readonly name: string;
  readonly kind: ApexTrackSegmentKind;
  /** Ausente en fuentes antiguas equivale a true. */
  readonly enabled?: boolean;
  readonly editor: ApexTrackSegmentEditorConfiguration;
  readonly geometry: ApexTrackSegmentGeometryConfiguration;
  readonly controlPoints: readonly ApexTrackNetworkPoint[];
  readonly evaluatedPoints: readonly ApexTrackNetworkPoint[];
}

export interface ApexTrackJunctionConnection {
  readonly segmentId: string;
  readonly endpoint: ApexTrackEndpoint;
}

export interface ApexTrackJunction {
  readonly id: string;
  readonly kind: ApexTrackJunctionKind;
  readonly connections: readonly ApexTrackJunctionConnection[];
}

export interface ApexTrackRouteSegmentReference {
  readonly segmentId: string;
  readonly direction: ApexTrackRouteDirection;
}

export interface ApexTrackRoute {
  readonly id: string;
  readonly name: string;
  readonly closed: boolean;
  readonly segments: readonly ApexTrackRouteSegmentReference[];
}

export interface ApexTrackNetwork {
  readonly primaryRouteId: string;
  readonly segments: readonly ApexTrackSourceSegment[];
  readonly junctions: readonly ApexTrackJunction[];
  readonly routes: readonly ApexTrackRoute[];
}

export const findApexTrackRoute = (
  network: ApexTrackNetwork,
  routeId = network.primaryRouteId,
): ApexTrackRoute | undefined => (
  network.routes.find(route => route.id === routeId)
);

export const findApexTrackSegment = (
  network: ApexTrackNetwork,
  segmentId: string,
): ApexTrackSourceSegment | undefined => (
  network.segments.find(segment => segment.id === segmentId)
);

export const primaryApexTrackSegment = (
  network: ApexTrackNetwork,
): ApexTrackSourceSegment => {
  const route = findApexTrackRoute(network);
  const firstReference = route?.segments[0];
  const segment = firstReference
    ? findApexTrackSegment(network, firstReference.segmentId)
    : network.segments[0];
  if (!segment) throw new Error('La red de pista no contiene segmentos');
  return segment;
};
