import {
  parseApexDriveCarSpecification,
  type ApexDriveCarSpecification,
} from '@jvsysarch/apex-car';
import { apexDrivePublicUrl } from '../runtime/ApexDrivePublicUrl';

const BUILT_IN_VEHICLE_MANIFESTS = Object.freeze([
  'assets/vehicles/apex-demo-car-001/vehicle.json',
  'assets/vehicles/ford-mustang-shelby-gt500/vehicle.json',
]);

export interface ApexVehicleManifestLoadOptions {
  readonly publicDemo: boolean;
  readonly searchParams: URLSearchParams;
  readonly voidBaseUrl: string;
  readonly configuredManifest?: string;
  readonly configuredManifests?: string;
}

const parseConfiguredManifests = (
  configuredManifest: string | undefined,
  encodedManifests: string | undefined,
): readonly string[] => {
  if (!encodedManifests) {
    return configuredManifest ? [configuredManifest] : [];
  }
  const manifests = JSON.parse(encodedManifests) as unknown;
  if (
    !Array.isArray(manifests)
    || manifests.some(manifest => typeof manifest !== 'string')
  ) {
    throw new Error(
      'VITE_APEX_DRIVE_VEHICLE_MANIFESTS debe ser una lista de URLs.',
    );
  }
  return manifests.map(manifest => manifest.trim()).filter(Boolean);
};

const loadStudioVehicle = async (
  voidBaseUrl: string,
  vehicleId: string | undefined,
  revision: string | undefined,
): Promise<ApexDriveCarSpecification | undefined> => {
  if (!vehicleId || !revision) return undefined;
  const encodedId = encodeURIComponent(vehicleId);
  const encodedRevision = encodeURIComponent(revision);
  const response = await fetch(
    `${voidBaseUrl}/api/void/drive-cars/${encodedId}`
    + `/revisions/${encodedRevision}/files/vehicle.json`,
  );
  if (!response.ok) {
    throw new Error(
      `APEX Void no pudo cargar ${vehicleId} (${response.status})`,
    );
  }
  return parseApexDriveCarSpecification(await response.json());
};

const loadVehicleManifest = async (
  configuredManifest: string,
): Promise<ApexDriveCarSpecification> => {
  const manifestUrl = (() => {
    try {
      return new URL(configuredManifest).toString();
    } catch {
      return new URL(
        apexDrivePublicUrl(configuredManifest),
        window.location.href,
      ).toString();
    }
  })();
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(
      `No se pudo cargar el manifiesto del vehículo (${response.status})`,
    );
  }
  const document = await response.json() as {
    asset?: { modelUrl?: string; revision?: string };
  };
  if (document.asset?.modelUrl) {
    const configuredModelUrl = document.asset.modelUrl;
    const modelUrl = (() => {
      try {
        return new URL(configuredModelUrl);
      } catch {
        const assetUrl = /^\/?assets\//.test(configuredModelUrl)
          ? apexDrivePublicUrl(configuredModelUrl)
          : configuredModelUrl;
        return new URL(assetUrl, manifestUrl);
      }
    })();
    if (document.asset.revision) {
      modelUrl.searchParams.set('revision', document.asset.revision);
    }
    document.asset.modelUrl = modelUrl.toString();
  }
  return parseApexDriveCarSpecification(document);
};

export const loadApexDriveVehicleSpecifications = async (
  options: ApexVehicleManifestLoadOptions,
): Promise<readonly ApexDriveCarSpecification[]> => {
  const configuredManifests = parseConfiguredManifests(
    options.configuredManifest?.trim(),
    options.configuredManifests?.trim(),
  );
  const studioVehicle = await loadStudioVehicle(
    options.voidBaseUrl.replace(/\/+$/, ''),
    options.publicDemo
      ? undefined
      : options.searchParams.get('studioVehicleId')?.trim(),
    options.publicDemo
      ? undefined
      : options.searchParams.get('studioVehicleRevision')?.trim(),
  );
  if (studioVehicle) return [studioVehicle];

  const requestedManifest = options.publicDemo
    ? undefined
    : options.searchParams.get('vehicleManifest')?.trim();
  const manifests = configuredManifests.length > 0
    ? configuredManifests
    : requestedManifest
      ? [requestedManifest]
      : BUILT_IN_VEHICLE_MANIFESTS;
  return Promise.all(manifests.map(loadVehicleManifest));
};
